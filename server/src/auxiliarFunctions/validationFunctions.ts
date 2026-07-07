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
} from './getFunctions';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { validateAchieveCondition, validateQueriedProperty } from './oclParser';
import { goalValidation } from '../validations/goal';
import { Validation } from '../validations/base';


// Validate individual goal or task node in .gm file
function auxiliarValidateGmNode(
	node: GmNode,
	text: string,
	diagnostics: Diagnostic[],
	classAttributes: Map<string, Set<string>>,
): void {
	if (!node.customProperties) {
		return;
	}

	const properties = node.customProperties;
	const nodeType = node.type;

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
				diagnostics.push(errors.wrongPropertyContextError(propLine, propChar, propName, nodeType, goalType || undefined, validContexts));
			}
		}

		// Check if query goals have any achieve-only properties
		if (goalType === 'query') {
			const achieveOnlyProps = ['AchieveCondition', 'Group', 'Divisible'];
			if (achieveOnlyProps.includes(propName)) {
				diagnostics.push(errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(propLine, propChar, propName, 'Achieve', 'Query', errorsSourceTypes.mutroseGMValidator));
			}
		}

		// Check if achieve goals have any query-only properties
		if (goalType === 'achieve') {
			const queryOnlyProps = ['QueriedProperty'];
			if (queryOnlyProps.includes(propName)) {
				diagnostics.push(errors.propertyCanOnlyBeUsedInSpecificGoalTypeError(propLine, propChar, propName, 'Query', 'Achieve', errorsSourceTypes.mutroseGMValidator));
			}
		}

		// Validate QueriedProperty format for Query goals
		if (propName === 'QueriedProperty' && goalType === 'query') {
			const value = properties[propName];
			const queriedPropertyErrors = validateQueriedProperty(value, classAttributes);
			for (const error of queriedPropertyErrors) {
				const isAttributeWarning = error.startsWith("Attribute '");
				diagnostics.push(errors.formatValidationError(
					isAttributeWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
					valueLine,
					valueChar,
					valueEndLine,
					valueEndChar,
					error
				));
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
				diagnostics.push(errors.formatValidationError(
					isAttributeWarning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
					valueLine,
					valueChar,
					valueEndLine,
					valueEndChar,
					error
				));
			}
		}
	}
}

// Validate Goal Model
export function auxiliarValidateGmFile(doc: TextDocument): Diagnostic[] {
	const text = doc.getText();
	let diagnostics: Diagnostic[] = [];
	const classAttributes = auxiliarGetKnowledgeClassAttributeIndexForDocument(doc);
	const validations: Validation<GmNode>[] = [goalValidation(text, classAttributes)];

	try {
		const gmData: GmFile = JSON.parse(text);

		// Validate all nodes in actors
		if (gmData.actors && Array.isArray(gmData.actors)) {
			for (const actor of gmData.actors) {
				if (actor.nodes && Array.isArray(actor.nodes)) {
					for (const node of actor.nodes) {
						diagnostics = diagnostics.concat(
							validations.reduce((acc: Diagnostic[], validation) => {
								const diagnostics = validation.run(node);
								return [...acc, ...diagnostics];
							}, [])
						);
						// auxiliarValidateGmNode(node, text, diagnostics, classAttributes);
					}
				}
			}
		}

		// Validate orphan nodes
		if (gmData.orphans && Array.isArray(gmData.orphans)) {
			for (const node of gmData.orphans) {
				auxiliarValidateGmNode(node, text, diagnostics, classAttributes);
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