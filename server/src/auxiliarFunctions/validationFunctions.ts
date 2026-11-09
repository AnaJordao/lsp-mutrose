import {
	GmFile,
	GmNode,
} from '../interfaces';
import {
	errors,
	errorsSourceTypes,
	propertyContextMap,
	flowStepContextMap,
} from '../constants';
import {
	auxiliarGetContextFromDocument,
	auxiliarGetErrorPositionFromJsonParseError,
	auxiliarGetKnowledgeClassAttributeIndexForDocument,
	auxiliarGetConfigurationForDocument,
	auxiliarGetHddlForDocument,
	extractTaskId,
	extractTaskName,
	ResolvedConfiguration,
	ResolvedHddl,
} from './getFunctions';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { validateAchieveCondition, validateQueriedProperty } from './oclParser';


// Helper to find the range of "text": "..." property in a node
export function findNodeTextRange(
	nodeId: string,
	text: string,
): { startLine: number; startChar: number; endLine: number; endChar: number } | null {
	const nodeIdPattern = new RegExp(`"id"\\s*:\\s*"${nodeId}"`, 'g');
	const match = nodeIdPattern.exec(text);
	if (!match) {
		return null;
	}

	// Find the bounds of this node object
	let objStart = text.lastIndexOf('{', match.index);
	if (objStart === -1) {
		objStart = match.index;
	}

	let objEnd = text.indexOf('}', match.index);
	if (objEnd === -1) {
		objEnd = text.length;
	}

	const nodeSlice = text.substring(objStart, objEnd + 1);
	const textPropPattern = /"text"\s*:\s*"([^"]*)"/;
	const textPropMatch = textPropPattern.exec(nodeSlice);

	if (!textPropMatch) {
		return null;
	}

	const propIndex = objStart + textPropMatch.index;
	const colonIndex = textPropMatch[0].indexOf(':');
	const valueQuoteStart = textPropMatch[0].indexOf('"', colonIndex >= 0 ? colonIndex : 0);
	const valueQuoteEnd = textPropMatch[0].lastIndexOf('"');

	const valueStartIndex = valueQuoteStart >= 0 ? propIndex + valueQuoteStart + 1 : propIndex;
	const valueEndIndex = valueQuoteEnd > valueQuoteStart ? propIndex + valueQuoteEnd : propIndex + textPropMatch[0].length;

	const startLines = text.substring(0, valueStartIndex).split('\n');
	const startLine = startLines.length - 1;
	const startChar = startLines[startLines.length - 1].length;

	const endLines = text.substring(0, valueEndIndex).split('\n');
	const endLine = endLines.length - 1;
	const endChar = endLines[endLines.length - 1].length;

	return { startLine, startChar, endLine, endChar };
}

// Validate individual goal or task node in .gm file
export function auxiliarValidateGmNode(
	node: GmNode,
	text: string,
	diagnostics: Diagnostic[],
	classAttributes: Map<string, Set<string>>,
	configResolution?: ResolvedConfiguration | null,
	seenTaskIds?: Set<string>,
	hddlResolution?: ResolvedHddl | null,
): void {
	const nodeType = node.type;

	// Validate Task name and binding for istar.Task nodes
	if (nodeType === 'istar.Task') {
		const taskText = typeof node.text === 'string' ? node.text : '';
		const textRange = findNodeTextRange(node.id, text);
		const range = textRange || { startLine: 0, startChar: 0, endLine: 0, endChar: taskText.length };

		const taskId = extractTaskId(taskText);
		if (!taskId) {
			const diag = errors.taskInvalidNameFormatError(
				range.startLine,
				range.startChar,
				range.endLine,
				range.endChar,
				taskText,
			);
			diag.data = { nodeId: node.id };
			diagnostics.push(diag);
		} else {
			if (seenTaskIds) {
				if (seenTaskIds.has(taskId)) {
					const diag = errors.taskDuplicateIdError(
						range.startLine,
						range.startChar,
						range.endLine,
						range.endChar,
						taskId,
					);
					diag.data = { nodeId: node.id };
					diagnostics.push(diag);
				} else {
					seenTaskIds.add(taskId);
				}
			}

			if (configResolution) {
				const validTaskIds = Array.from(configResolution.taskIds).sort();
				if (!configResolution.taskIds.has(taskId)) {
					const diag = errors.taskMissingBindingError(
						range.startLine,
						range.startChar,
						range.endLine,
						range.endChar,
						taskId,
						taskText,
						validTaskIds,
					);
					diag.data = { nodeId: node.id };
					diagnostics.push(diag);
				}
			}

			if (hddlResolution) {
				const taskName = extractTaskName(taskText);
				const validHddlTasks = Array.from(hddlResolution.tasks).sort();
				if (!taskName) {
					const diag = errors.taskMissingHddlDefinitionError(
						range.startLine,
						range.startChar,
						range.endLine,
						range.endChar,
						"(empty)",
						validHddlTasks,
					);
					diag.data = { nodeId: node.id };
					diagnostics.push(diag);
				} else {
					const found = hddlResolution.taskLookup.has(taskName.toLowerCase());
					if (!found) {
						const diag = errors.taskMissingHddlDefinitionError(
							range.startLine,
							range.startChar,
							range.endLine,
							range.endChar,
							taskName,
							validHddlTasks,
						);
						diag.data = { nodeId: node.id };
						diagnostics.push(diag);
					}
				}
			}
		}
	}

	if (!node.customProperties) {
		return;
	}

	const properties = node.customProperties;

	// Determine context based on node type
	let context = '';
	let goalType = '';

	if (nodeType === 'istar.Goal') {
		context = 'goal';
		goalType = properties.GoalType?.toLowerCase() || '';
		if (goalType) {
			context = goalType;
		}
	} else if (nodeType === 'istar.Task') {
		context = 'task';
	}

	// Find the position of this node's customProperties in the JSON text
	const nodeIdPattern = new RegExp(`"id"\\s*:\\s*"${node.id}"`, 'g');
	const match = nodeIdPattern.exec(text);

	if (!match) {
		return;
	}

	// Validate each property in customProperties
	const nodeText = text.substring(match.index);
	for (const [propName] of Object.entries(properties)) {
		// Skip standard properties
		if (propName === 'Description') {
			continue;
		}

		// Find the property line inside this node's JSON slice, not the whole document.
		const propPattern = new RegExp(`"${propName}"\\s*:\\s*"[^"]*"`, 'g');
		const propMatch = propPattern.exec(nodeText);

		if (!propMatch) {
			continue;
		}

		const propIndex = match.index + propMatch.index;
		const propLines = text.substring(0, propIndex).split('\n');
		const propLine = propLines.length - 1;
		const propChar = propLines[propLines.length - 1].length;

		const valueStartInMatch = propMatch[0].indexOf(':');
		const valueQuoteStart = valueStartInMatch >= 0 ? propMatch[0].indexOf('"', valueStartInMatch) : -1;
		const valueQuoteEnd = valueQuoteStart >= 0 ? propMatch[0].lastIndexOf('"') : -1;
		const valueStartIndex = valueQuoteStart >= 0 ? propIndex + valueQuoteStart + 1 : propIndex;
		const valueEndIndex = valueQuoteEnd >= 0 ? propIndex + valueQuoteEnd : propIndex + propMatch[0].length;

		const valueStartLines = text.substring(0, valueStartIndex).split('\n');
		const valueLine = valueStartLines.length - 1;
		const valueChar = valueStartLines[valueStartLines.length - 1].length;

		const valueEndLines = text.substring(0, valueEndIndex).split('\n');
		const valueEndLine = valueEndLines.length - 1;
		const valueEndChar = valueEndLines[valueEndLines.length - 1].length;

		const validContexts = propertyContextMap[propName];
		// Validate property based on context
		if (validContexts) {
			let isValidContext = false;

			// Special handling for GoalType: always validate against "goal" context, not the derived goalType
			if (propName === 'GoalType' && nodeType === 'istar.Goal') {
				isValidContext = validContexts.includes('goal');
			} else if (goalType) {
				isValidContext = validContexts.includes(goalType);
			} else {
				isValidContext = validContexts.includes(context);
			}

			if (!isValidContext) {
				const diag = errors.wrongPropertyContextError(propLine, propChar, propName, nodeType, goalType || undefined, validContexts);
				diag.data = { nodeId: node.id };
				diagnostics.push(diag);
				continue;
			}
		} else {
			const diag = errors.wrongPropertyContextError(propLine, propChar, propName, nodeType, goalType || undefined, []);
			diag.data = { nodeId: node.id };
			diagnostics.push(diag);
			continue;
		}

		// Check if query goals have any achieve-only properties
		if (goalType === 'query') {
			const achieveOnlyProps = ['AchieveCondition', 'Group', 'Divisible'];
			if (achieveOnlyProps.includes(propName)) {
				const diag = errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(propLine, propChar, propName, 'Achieve', 'Query', errorsSourceTypes.mutroseGMValidator);
				diag.data = { nodeId: node.id };
				diagnostics.push(diag);
			}
		}

		// Check if achieve goals have any query-only properties
		if (goalType === 'achieve') {
			const queryOnlyProps = ['QueriedProperty'];
			if (queryOnlyProps.includes(propName)) {
				const diag = errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(propLine, propChar, propName, 'Query', 'Achieve', errorsSourceTypes.mutroseGMValidator);
				diag.data = { nodeId: node.id };
				diagnostics.push(diag);
			}
		}

		// Validate QueriedProperty format for Query goals
		if (propName === 'QueriedProperty' && goalType === 'query') {
			const value = properties[propName];
			const queriedPropertyErrors = validateQueriedProperty(value, classAttributes);
			for (const error of queriedPropertyErrors) {
				const isAttributeWarning = error.startsWith("Attribute '");
				const diag = errors.formatValidationError(
					isAttributeWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
					valueLine,
					valueChar,
					valueEndLine,
					valueEndChar,
					error
				);
				diag.data = { nodeId: node.id };
				diagnostics.push(diag);
			}
		}

		// Validate AchieveCondition format for Achieve goals
		if (propName === 'AchieveCondition' && goalType === 'achieve') {
			const value = properties[propName];
			const monitorVars = properties['Monitors'] || '';
			const controlVars = properties['Controls'] || '';
			const achieveErrors = validateAchieveCondition(value, monitorVars, controlVars, classAttributes);
			for (const error of achieveErrors) {
				const isAttributeWarning = error.startsWith("Attribute '");
				const diag = errors.formatValidationError(
					isAttributeWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
					valueLine,
					valueChar,
					valueEndLine,
					valueEndChar,
					error
				);
				diag.data = { nodeId: node.id };
				diagnostics.push(diag);
			}
		}
	}
}

// Validate Goal Model
export function auxiliarValidateGmFile(doc: TextDocument): Diagnostic[] {
	const text = doc.getText();
	const diagnostics: Diagnostic[] = [];
	const classAttributes = auxiliarGetKnowledgeClassAttributeIndexForDocument(doc);
	const configResolution = auxiliarGetConfigurationForDocument(doc);
	const hddlResolution = auxiliarGetHddlForDocument(doc);
	const seenTaskIds = new Set<string>();

	try {
		const gmData: GmFile = JSON.parse(text);
		console.log('Parsed GM data:', gmData);
		// Validate all nodes in actors
		if (gmData.actors && Array.isArray(gmData.actors)) {
			for (const actor of gmData.actors) {
				if (actor.nodes && Array.isArray(actor.nodes)) {
					for (const node of actor.nodes) {
						auxiliarValidateGmNode(
							node,
							text,
							diagnostics,
							classAttributes,
							configResolution,
							seenTaskIds,
							hddlResolution,
						);
					}
				}
			}
		}

		// Validate orphan nodes
		if (gmData.orphans && Array.isArray(gmData.orphans)) {
			for (const node of gmData.orphans) {
				auxiliarValidateGmNode(
					node,
					text,
					diagnostics,
					classAttributes,
					configResolution,
					seenTaskIds,
					hddlResolution,
				);
			}
		}
	} catch (error) {
		// JSON parsing error
		const pos = auxiliarGetErrorPositionFromJsonParseError(error as SyntaxError);
		diagnostics.push(...errors.jsonParsingError(pos, error));
	}

	return diagnostics;
}

export async function auxiliarValidateTextDocument(
	textDocument: TextDocument,
): Promise<Diagnostic[]> {
	const text = textDocument.getText();
	const diagnostics: Diagnostic[] = [];

	// Check if this is a .gm file (JSON format)
	if (textDocument.uri.endsWith(".gm")) {
		return auxiliarValidateGmFile(textDocument);
	}

	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Flow validation: detect context for current line
		const { context: currentContext, goalType: currentGoalType } =
			auxiliarGetContextFromDocument(text, i);
		console.log(currentContext, currentGoalType);
		// Validate properties based on context
		for (const [property, validContexts] of Object.entries(
			propertyContextMap,
		)) {
			const propertyRegex = new RegExp(`\\b${property}\\b`, "i");
			const propertyMatch = line.match(propertyRegex);

			if (propertyMatch && currentContext) {
				// Skip validation if this appears to be a property value, not a property name
				const matchIndex = propertyMatch.index!;
				const beforeMatch = line.substring(0, matchIndex);

				const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);

				if (!isLikelyValue) {
					const isValidContext =
						validContexts.includes(currentContext) ||
						(currentGoalType && validContexts.includes(currentGoalType));

					if (!isValidContext) {
						const startChar = matchIndex;
						const endChar = startChar + property.length;
						console.log("aqui")
						diagnostics.push(errors.propertyValidationInFlowError(
							i,
							startChar,
							endChar,
							property,
							currentContext,
							currentGoalType || undefined,
							validContexts,
						));
					}
				}
			}
		}

		// Validate flow steps based on context
		for (const [stepName, validContexts] of Object.entries(
			flowStepContextMap,
		)) {
			const stepRegex = new RegExp(`\\b${stepName}\\b`, "i");
			const stepMatch = line.match(stepRegex);

			if (stepMatch && currentContext) {
				// Skip validation if this appears to be a property value, not a step name
				const matchIndex = stepMatch.index!;
				const beforeMatch = line.substring(0, matchIndex);

				const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);

				if (!isLikelyValue) {
					let isValidContext = false;

					if (currentGoalType) {
						isValidContext = validContexts.includes(currentGoalType);
					} else {
						isValidContext = validContexts.includes(currentContext);
					}

					if (!isValidContext) {
						const startChar = matchIndex;
						const endChar = startChar + stepName.length;

						diagnostics.push(errors.flowStepValidationError(
							i,
							startChar,
							endChar,
							stepName,
							currentContext,
							currentGoalType || undefined,
							validContexts,
						));
					}
				}
			}
		}

		// Validate specific achieve-only properties in query context
		if (currentGoalType === "query") {
			const achieveOnlyProps = ["AchieveCondition", "Group", "Divisible"];
			for (const prop of achieveOnlyProps) {
				const propMatch = line.match(new RegExp(`\\b${prop}\\b`, "i"));
				if (propMatch) {
					// Skip validation if this appears to be a property value, not a property name
					const matchIndex = propMatch.index!;
					const beforeMatch = line.substring(0, matchIndex);
					const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);

					if (!isLikelyValue) {
						diagnostics.push(errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(
							i,
							matchIndex,
							prop,
							'Achieve',
							'Query',
							errorsSourceTypes.mutroseFlowValidator,
						));
					}
				}
			}
		}

		// Validate query-only properties in achieve context
		if (currentGoalType === "achieve") {
			const queryOnlyProps = ["QueriedProperty"];
			for (const prop of queryOnlyProps) {
				const propMatch = line.match(new RegExp(`\\b${prop}\\b`, "i"));
				if (propMatch) {
					// Skip validation if this appears to be a property value, not a property name
					const matchIndex = propMatch.index!;
					const beforeMatch = line.substring(0, matchIndex);
					const isLikelyValue = /[=:]\s*['"]*\s*$/.test(beforeMatch);

					if (!isLikelyValue) {
						diagnostics.push(errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(
							i,
							matchIndex,
							prop,
							'Query',
							'Achieve',
							errorsSourceTypes.mutroseFlowValidator,
						));
					}
				}
			}
		}
	}

	return diagnostics;
}