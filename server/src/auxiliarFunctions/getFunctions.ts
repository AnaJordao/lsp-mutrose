import * as fs from 'fs';
import * as path from 'path';
import {
  Hover,
  Range,
  Location,
  Position,
  MarkupKind,
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node";
import { 
	flow, 
	snippets,
	forAllBodyRegex,
	selectBodyRegex, 
	propertyContextMap, 
	flowStepContextMap,
	attributeCompletions
} from '../constants';
import { 
	VariableInfo,
	KnowledgeClassInfo, 
	OclAttributeCompletionContext, 
} from '../interfaces';
import { workspaceFolders, variableDefinitions } from '../server';
import { TextDocument } from 'vscode-languageserver-textdocument';

// take classes and their attributes defined in the world knowledge xml
function auxiliarGetClassInfoFromWorldKnowledgeXml(xmlElement: string): KnowledgeClassInfo[] {
	const classes = new Map<string, Set<string>>();
	const worldDbMatch = xmlElement.match(
		/<world_db[^>]*>([\s\S]*?)<\/world_db>/i,
	);
	const contentToParse = worldDbMatch ? worldDbMatch[1] : xmlElement;
	const classBlockRegex = /<([A-Za-z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/g;

	let match: RegExpExecArray | null;
	while ((match = classBlockRegex.exec(contentToParse)) !== null) {
		const className = match[1];
		const classContent = match[2];
		if (className.toLowerCase() === 'world_db') {
			continue;
		}

		if (!classes.has(className)) {
			classes.set(className, new Set<string>());
		}

		// collect direct child tags as attributes (e.g. <occupied>, <tableIsClean>)
		const attributeRegex = /<([A-Za-z_][\w-]*)\b[^>]*>/g;
		let attrMatch: RegExpExecArray | null;
		while ((attrMatch = attributeRegex.exec(classContent)) !== null) {
			const attributeName = attrMatch[1];
			if (attributeName.toLowerCase() !== className.toLowerCase()) {
				classes.get(className)!.add(attributeName);
			}
		}
	}

	return Array.from(classes.entries())
		.map(([name, attributes]) => ({
			name,
			attributes: Array.from(attributes).sort(),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

// map every directory that can have a world knowledge xml and find all the classes
// defined in those, returning a sorted list with all the classes names
function auxiliarGetWorldKnowledgeClassesForDocument(doc: TextDocument): KnowledgeClassInfo[] {
	const classes = new Map<string, Set<string>>();
	const gmFilePath = auxiliarGetFileUriToPath(doc.uri);
	const gmDirName = path.dirname(gmFilePath);
	const candidateDirs = [path.resolve(gmDirName, "..", "knowledge")];

	for (const workspaceFolder of workspaceFolders) {
		candidateDirs.push(path.resolve(workspaceFolder, "knowledge"));
		candidateDirs.push(path.resolve(workspaceFolder, "examples"));
	}

	for (const dirPath of candidateDirs) {
		if (!fs.existsSync(dirPath)) {
			continue;
		}

		if (path.basename(dirPath).toLowerCase() === "examples") {
			const exampleFolders = fs
				.readdirSync(dirPath, { withFileTypes: true })
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name);

			for (const exampleFolder of exampleFolders) {
				const knowledgeDir = path.join(dirPath, exampleFolder, "knowledge");
				if (!fs.existsSync(knowledgeDir)) {
					continue;
				}

				const files = fs
					.readdirSync(knowledgeDir)
					.filter((fileName) => fileName.toLowerCase().endsWith(".xml"));
				for (const fileName of files) {
					const fullPath = path.join(knowledgeDir, fileName);
					try {
						const xmlContent = fs.readFileSync(fullPath, "utf8");
						for (const classInfo of auxiliarGetClassInfoFromWorldKnowledgeXml(
							xmlContent,
						)) {
							if (!classes.has(classInfo.name)) {
								classes.set(classInfo.name, new Set<string>());
							}

							for (const attribute of classInfo.attributes) {
								classes.get(classInfo.name)!.add(attribute);
							}
						}
					} catch {
						// Ignore malformed/unreadable knowledge files for completion fallback.
					}
				}
			}
			continue;
		}

		if (!fs.statSync(dirPath).isDirectory()) {
			continue;
		}

		const files = fs
			.readdirSync(dirPath)
			.filter((fileName) => fileName.toLowerCase().endsWith(".xml"));

		for (const fileName of files) {
			const fullPath = path.join(dirPath, fileName);
			try {
				const xmlContent = fs.readFileSync(fullPath, "utf8");
				for (const classInfo of auxiliarGetClassInfoFromWorldKnowledgeXml(xmlContent)) {
					if (!classes.has(classInfo.name)) {
						classes.set(classInfo.name, new Set<string>());
					}

					for (const attribute of classInfo.attributes) {
						classes.get(classInfo.name)!.add(attribute);
					}
				}
			} catch {
				// Ignore malformed/unreadable knowledge files for completion fallback.
			}
		}
	}

	return Array.from(classes.entries())
		.map(([name, attributes]) => ({
			name,
			attributes: Array.from(attributes).sort(),
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

function auxiliarGetNormalizedKnowledgeTypeName(typeName: string): string {
	const trimmed = typeName.trim();
	const sequenceMatch = trimmed.match(/^Sequence\(([^)]+)\)$/i);
	const unwrapped = sequenceMatch ? sequenceMatch[1].trim() : trimmed;
	const dotIndex = unwrapped.lastIndexOf('.');
	return dotIndex >= 0 ? unwrapped.substring(dotIndex + 1) : unwrapped;
}

function auxiliarGetFieldValueBeforeCursor(textBeforeCursor: string, fieldName: string): string | undefined {
	const fieldMarker = `"${fieldName}"`;
	const fieldIndex = textBeforeCursor.lastIndexOf(fieldMarker);
	if (fieldIndex < 0) {
		return undefined;
	}

	const fieldSlice = textBeforeCursor.slice(fieldIndex);
	const colonIndex = fieldSlice.indexOf(':');
	if (colonIndex < 0) {
		return undefined;
	}

	const openingQuoteIndex = fieldSlice.indexOf('"', colonIndex);
	if (openingQuoteIndex < 0) {
		return undefined;
	}

	return fieldSlice.slice(openingQuoteIndex + 1);
}

function auxiliarGetOclAttributeCompletionContext(
	textBeforeCursor: string,
	fieldName: 'AchieveCondition' | 'QueriedProperty',
): OclAttributeCompletionContext | undefined {
	const fieldValue = auxiliarGetFieldValueBeforeCursor(textBeforeCursor, fieldName);
	if (!fieldValue) {
		return undefined;
	}

	const declarationPattern = fieldName === 'QueriedProperty'
		? selectBodyRegex
		: forAllBodyRegex;
	const declarationMatch = fieldValue.match(declarationPattern);
	if (!declarationMatch || !declarationMatch[2]) {
		return undefined;
	}

	const variableName = declarationMatch[1];
	const typeName = declarationMatch[2].trim();
	const attributeAccessPattern = new RegExp(`(?:^|[^A-Za-z0-9_])${variableName}\\.([A-Za-z_][\\w]*)?$`);
	const attributeAccessMatch = fieldValue.match(attributeAccessPattern);

	return {
		variableName,
		typeName,
		attributePrefix: attributeAccessMatch?.[1] ?? ''
	};
}

function auxiliarGetAttributeCompletionItems(
	doc: TextDocument,
	position: Position,
	textBeforeCursor: string,
	fieldName: 'AchieveCondition' | 'QueriedProperty',
): CompletionItem[] {
	const classAttributes = auxiliarGetKnowledgeClassAttributeIndexForDocument(doc);
	const context = auxiliarGetOclAttributeCompletionContext(textBeforeCursor, fieldName);
	if (!context) {
		return [];
	}

	const knownAttributes = classAttributes.get(auxiliarGetNormalizedKnowledgeTypeName(context.typeName));
	if (!knownAttributes || knownAttributes.size === 0) {
		return [];
	}

	const filteredAttributes = Array.from(knownAttributes)
		.sort()
		.filter(attribute => context.attributePrefix === '' || attribute.startsWith(context.attributePrefix));

	if (filteredAttributes.length === 0) {
		return [];
	}

	const replacementStart = Math.max(0, position.character - context.attributePrefix.length);
	const replacementRange = Range.create(
		Position.create(position.line, replacementStart),
		position,
	);

	return filteredAttributes.map(attribute => ({
		label: attribute,
		kind: CompletionItemKind.Property,
		detail: context.typeName,
		documentation: `Attribute available on ${context.typeName}`,
		textEdit: {
			range: replacementRange,
			newText: attribute,
		},
	}));
}

// Extract all variables defined in Controls fields throughout the .gm file
function auxiliarGetControlsVariables(text: string): Map<string, string> {
  const variables = new Map<string, string>();
  // Match all Controls fields: "Controls": "varName : Type"
  const controlsRegex = /"Controls"\s*:\s*"([^"]+)"/g;
  let match;

  while ((match = controlsRegex.exec(text)) !== null) {
    const controlsValue = match[1];
    // Parse variable definitions (format: "varName : Type" or multiple comma-separated)
    const varDefinitions = controlsValue.split(",").map((v) => v.trim());

    for (const varDefinition of varDefinitions) {
      const colonIndex = varDefinition.indexOf(":");
      if (colonIndex > 0) {
        const varName = varDefinition.substring(0, colonIndex).trim();
        const varType = varDefinition.substring(colonIndex + 1).trim();
        if (varName) {
          variables.set(varName, varType);
        }
      }
    }
  }

  return variables;
}

// Get the next available goal and task numbers for their names
function auxiliarGetNextGoalAndTaskNumbers(text: string): {
  nextGoalNumber: number;
  nextTaskNumber: number;
} {
  let maxGoalNumber = 0;
  let maxTaskNumber = 0;

  const goalRegex = /\bG(\d+)\s*:/gi;
  let goalMatch: RegExpExecArray | null;
  while ((goalMatch = goalRegex.exec(text)) !== null) {
    const parsed = Number.parseInt(goalMatch[1], 10);
    if (!Number.isNaN(parsed)) {
      maxGoalNumber = Math.max(maxGoalNumber, parsed);
    }
  }

  const taskRegex = /\bAT(\d+)\s*:/gi;
  let taskMatch: RegExpExecArray | null;
  while ((taskMatch = taskRegex.exec(text)) !== null) {
    const parsed = Number.parseInt(taskMatch[1], 10);
    if (!Number.isNaN(parsed)) {
      maxTaskNumber = Math.max(maxTaskNumber, parsed);
    }
  }

  return {
    nextGoalNumber: maxGoalNumber + 1,
    nextTaskNumber: maxTaskNumber + 1,
  };
}

// Determine the current node context (Goal or Task) and GoalType (Achieve, Query, Perform) based on the text before the cursor in the .gm file
function auxiliarGetCurrentGmNodeContext(textBeforeCursor: string): {
  nodeType: "Goal" | "Task" | null;
  goalType: "achieve" | "query" | "perform" | null;
} {
  let nodeType: "Goal" | "Task" | null = null;
  let goalType: "achieve" | "query" | "perform" | null = null;

  const typeRegex = /"type"\s*:\s*"istar\.(Goal|Task)"/g;
  let typeMatch: RegExpExecArray | null;
  while ((typeMatch = typeRegex.exec(textBeforeCursor)) !== null) {
    nodeType = typeMatch[1] as "Goal" | "Task";
  }

  const customPropertiesIndex =
    textBeforeCursor.lastIndexOf('"customProperties"');
  if (customPropertiesIndex >= 0) {
    const currentCustomPropertiesText = textBeforeCursor.substring(
      customPropertiesIndex,
    );
    const goalTypeRegex = /"GoalType"\s*:\s*"(Achieve|Query|Perform)"/gi;
    let goalTypeMatch: RegExpExecArray | null;
    while (
      (goalTypeMatch = goalTypeRegex.exec(currentCustomPropertiesText)) !== null
    ) {
      goalType = goalTypeMatch[1].toLowerCase() as
        | "achieve"
        | "query"
        | "perform";
    }
  }

  return { nodeType, goalType };
}

// Extract existing custom property names from the current "customProperties" block to avoid suggesting duplicates in completions
function auxiliarGetExistingCustomProperties(
  text: string,
  offset: number,
): Set<string> {
  const existingProperties = new Set<string>();
  const currentCustomPropertiesText = auxiliarGetCurrentCustomPropertiesBlock(
    text,
    offset,
  );
  if (!currentCustomPropertiesText) {
    return existingProperties;
  }

  const propRegex = /"([A-Za-z_][\w]*)"\s*:/g;
  let propMatch: RegExpExecArray | null;
  while ((propMatch = propRegex.exec(currentCustomPropertiesText)) !== null) {
    existingProperties.add(propMatch[1]);
  }

  return existingProperties;
}

function auxiliarGetWordStart(text: string, offset: number): number {
  while (offset > 0 && /\w/.test(text[offset - 1])) {
    offset--;
  }
  return offset;
}

function auxiliarGetWordEnd(text: string, offset: number): number {
  while (offset < text.length && /\w/.test(text[offset])) {
    offset++;
  }
  return offset;
}


// =======================================================
//
//          EXPORTS
//
// =======================================================

export function auxiliarGetKnowledgeClassAttributeIndexForDocument(doc: TextDocument): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>();
	const classes = auxiliarGetWorldKnowledgeClassesForDocument(doc);

	for (const classInfo of classes) {
		index.set(classInfo.name, new Set(classInfo.attributes));
	}

	return index;
}

// Detect the context (goal, achieve, query, task) based on the current line and its surrounding lines in the document
export function auxiliarGetContextFromDocument(
	text: string,
	currentLine: number,
): { context: string; goalType: string } {
	const lines = text.split(/\r?\n/);
	let context = "";
	let goalType = "";
	let foundGoalStart = false;
	let foundTaskStart = false;
	let pendingGoalType = "";

	// Look backwards from current line to find context
	for (let i = currentLine; i >= 0; i--) {
		const line = lines[i];

		// Checks if is goal or task
		const goalMatch = line.match(/istar\.Goal/);
		const taskMatch = line.match(/istar\.Task/);

		if (taskMatch && !foundTaskStart && !foundGoalStart) {
			foundTaskStart = true;
			context = "task";
			break;
		} else if (goalMatch && !foundGoalStart && !foundTaskStart) {
			foundGoalStart = true;
			// Apply goalType unless we're on the definition line and it's the only content
			if (pendingGoalType) {
				goalType = pendingGoalType;
				context = goalType;
			} else {
				context = "goal";
			}
			break;
		}

		// Checks GoalType - store it for when we find the Goal
		const goalTypeMatch = line.match(
			/GoalType\s*[=:]\s*['"](Achieve|Query|Perform)['"]?/i,
		);
		if (goalTypeMatch && !pendingGoalType) {
			pendingGoalType = goalTypeMatch[1].toLowerCase();
		}
	}

	return { context, goalType };
}

export function auxiliarGetErrorPositionFromJsonParseError(error: SyntaxError): {
	line: number;
	character: number;
} {
	const match = error.message.match(/line (\d+) column (\d+)/);
	if (match) {
		return {
			line: parseInt(match[1], 10) - 1,
			character: parseInt(match[2], 10) - 1,
		};
	}
	return { line: 0, character: 0 };
}

// Extract existing custom property names from the current "customProperties" block to avoid suggesting duplicates in completions
export function auxiliarGetCurrentCustomPropertiesBlock(text: string, offset: number): string {
  const textBeforeCursor = text.substring(0, offset);
  const customPropertiesIndex =
    textBeforeCursor.lastIndexOf('"customProperties"');
  if (customPropertiesIndex < 0) {
    return "";
  }

  const openBraceIndex = text.indexOf("{", customPropertiesIndex);
  if (openBraceIndex < 0) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openBraceIndex; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
      continue;
    }

    if (ch === "}") {
      depth--;
      if (depth === 0) {
        return text.substring(openBraceIndex + 1, i);
      }
    }
  }

  return text.substring(openBraceIndex + 1);
}

export function auxiliarGetFileUriToPath(uri: string): string {
	if (!uri.startsWith("file://")) {
		return uri;
	}

	let filePath = decodeURIComponent(uri.replace("file://", ""));
	if (process.platform === "win32" && filePath.startsWith("/")) {
		filePath = filePath.substring(1);
	}
	return filePath;
}

export function auxiliarGetIndexDocument(doc: TextDocument): Map<string, VariableInfo> {
	const text = doc.getText();
	const lines = text.split(/\r?\n/);
	const localVariableDefinitions = new Map<string, VariableInfo>();

	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		const match = line.match(/^([a-zA-Z_]\w*)\s*=\s*(.*)/);
		if (match) {
			const varName = match[1];
			const varValue = match[2];

			const loc: Location = {
				uri: doc.uri,
				range: Range.create(
					Position.create(lineIndex, 0),
					Position.create(lineIndex, varName.length),
				),
			};

			localVariableDefinitions.set(varName, { location: loc, value: varValue });
			variableDefinitions.set(varName, { location: loc, value: varValue });
		}
	}

	return localVariableDefinitions;
}

export function auxiliarGetGmCompletionItems(
	doc: TextDocument,
	position: Position,
): CompletionItem[] {
	const completionItems: CompletionItem[] = [];
	const text = doc.getText();
	const offset = doc.offsetAt(position);
	const textBeforeCursor = text.substring(0, offset);

	// Check if we're in a nodes array or customProperties section
	const inNodesArray = /"nodes"\s*:\s*\[[^\]]*$/.test(textBeforeCursor);
	const inCustomProperties = /"customProperties"\s*:\s*\{[^}]*$/.test(
		textBeforeCursor,
	);

	// Check if we're typing in the Monitors field value
	const inMonitorsValue = /"Monitors"\s*:\s*"[^"]*$/.test(textBeforeCursor);

	// Check if we're typing the type part of Controls: "varName : <here>"
	const inControlsTypeValue = /"Controls"\s*:\s*"[^"]*:\s*[^"]*$/.test(
		textBeforeCursor,
	);

	// Check if we're typing in AchieveCondition or QueriedProperty fields
	const inAchieveConditionValue = /"AchieveCondition"\s*:\s*"[^"]*$/.test(
		textBeforeCursor,
	);
	const inQueriedPropertyValue = /"QueriedProperty"\s*:\s*"[^"]*$/.test(
		textBeforeCursor,
	);
	const inGoalTypeValue = /"GoalType"\s*:\s*"[^"]*$/.test(textBeforeCursor);

	if (inGoalTypeValue) {
		completionItems.push(
			attributeCompletions.achieve, 
			attributeCompletions.query, 
			attributeCompletions.perform
		);
		return completionItems;
	}

	if (inControlsTypeValue) {
		const knowledgeClasses = auxiliarGetWorldKnowledgeClassesForDocument(doc);
		for (const classInfo of knowledgeClasses) {
			const className = classInfo.name;
			completionItems.push(attributeCompletions.class(className));
			completionItems.push(attributeCompletions.sequenceOfClass(className));
		}
		return completionItems;
	}

	if (inQueriedPropertyValue) {
		const attributeItems = auxiliarGetAttributeCompletionItems(
			doc,
			position,
			textBeforeCursor,
			'QueriedProperty',
		);
		if (attributeItems.length > 0) {
			return attributeItems;
		}
	}

	if (inAchieveConditionValue) {
		const attributeItems = auxiliarGetAttributeCompletionItems(
			doc,
			position,
			textBeforeCursor,
			'AchieveCondition',
		);
		if (attributeItems.length > 0) {
			return attributeItems;
		}
	}

	// If typing in Monitors, AchieveCondition, or QueriedProperty value, suggest variables from Controls
	if (inMonitorsValue || inAchieveConditionValue || inQueriedPropertyValue) {
		const controlsVars = auxiliarGetControlsVariables(text);
		controlsVars.forEach((type, varName) => {
			completionItems.push(attributeCompletions.variable(varName, type));
		});
		return completionItems;
	}

	// Provide node templates only at node-array level (not inside customProperties)
	if (inNodesArray && !inCustomProperties) {
		const { nextGoalNumber, nextTaskNumber } = auxiliarGetNextGoalAndTaskNumbers(text);

		// Achieve Goal snippet
		completionItems.push(snippets.achieveGoalSnippet(nextGoalNumber));

		// Query Goal snippet
		completionItems.push(snippets.queryGoalSnippet(nextGoalNumber));

		// Task snippet
		completionItems.push(snippets.taskSnippet(nextTaskNumber));

		// Basic Goal (no GoalType specified)
		completionItems.push(snippets.basicGoalSnippet(nextGoalNumber));
	}

	// Provide property completions when in customProperties
	if (inCustomProperties) {
		const { nodeType, goalType } = auxiliarGetCurrentGmNodeContext(textBeforeCursor);
		const existingProperties = auxiliarGetExistingCustomProperties(text, offset);
		const addIfMissing = (item: CompletionItem): void => {
			if (!existingProperties.has(item.label)) {
				completionItems.push(item);
			}
		};

		if (nodeType === "Goal") {
			// Add goal properties
			if (!goalType || goalType === "achieve") {
				addIfMissing(attributeCompletions.goalType);
				addIfMissing(attributeCompletions.achieveCondition);
				addIfMissing(attributeCompletions.group);
				addIfMissing(attributeCompletions.divisible);
			}

			if (!goalType || goalType === "query") {
				addIfMissing(attributeCompletions.queriedProperty);
			}

			// Properties available to all goals
			addIfMissing(attributeCompletions.controls);
			addIfMissing(attributeCompletions.monitors);
		} else if (nodeType === "Task") {
			// Add task properties
			addIfMissing(attributeCompletions.params);
			addIfMissing(attributeCompletions.location);
			addIfMissing(attributeCompletions.robotNumber);
		}

		// Description is available for all
		addIfMissing(attributeCompletions.description);
	}

	return completionItems;
}

export function auxiliarGetCompletionItems(
	doc: TextDocument,
	position: Position,
	variableDefinitions: Map<string, VariableInfo>,
): CompletionItem[] {
	const completionItems: CompletionItem[] = [];

	// Add variable completions
	Array.from(variableDefinitions.keys()).forEach((name, i) => attributeCompletions.variableDefinition(name, i));

	const { context, goalType } = auxiliarGetContextFromDocument(
		doc.getText(),
		position.line,
	);

	if (context) {
		// Add flow step completions based on current context
		for (const [stepName, validContexts] of Object.entries(
			flowStepContextMap,
		)) {
			let isValidForContext = false;

			// Check if flow step is valid for current context
			if (goalType) {
				// If we have a specific goal type (achieve/query), use that for validation
				isValidForContext = validContexts.includes(goalType);
			} else {
				// Fall back to general context (goal/task)
				isValidForContext = validContexts.includes(context);
			}

			if (isValidForContext) {
				const flowStep = flow[stepName];
				if (flowStep) {
					completionItems.push(attributeCompletions.flowStep(
						stepName, 
						flowStep.message, 
						(goalType || context), 
						completionItems.length
					));
				}
			}
		}

		// Add goal type specific completions
		if (context === "goal" && !goalType) {
			// If we're in a goal context but no goal type defined yet, suggest goal types
			const goalTypes = ["Achieve", "Query", "Perform"];
			goalTypes.forEach((type) => {
				completionItems.push(attributeCompletions.changeGoalType(type, completionItems.length));
			});
		}
	}

	return completionItems;
}

export function auxiliarGetWordRangeAtPosition(
	doc: TextDocument,
	pos: Position,
): Range | null {
	const text = doc.getText();
	const offset = doc.offsetAt(pos);
	const start = auxiliarGetWordStart(text, offset);
	const end = auxiliarGetWordEnd(text, offset);
	if (start < 0 || end < 0) {
		return null;
	}
	return Range.create(doc.positionAt(start), doc.positionAt(end));
}

export function auxiliarGetHover(
	doc: TextDocument,
	position: Position,
	variableDefinitions: Map<string, VariableInfo>,
): Hover | null {
	const wordRange = auxiliarGetWordRangeAtPosition(doc, position);
	if (!wordRange) {
		return null;
	}

	const word = doc.getText(wordRange);

	// Check if it's a variable definition
	const info = variableDefinitions.get(word);
	if (info) {
		const contents = {
			kind: MarkupKind.Markdown,
			value: `\`${word} = ${info.value ?? "??"}\`\n\n**Defined in** [${info.location.uri.split("/").pop()}](${info.location.uri})`,
		};
		return { contents };
	}

	// Check if it's a flow property
	const validContexts = propertyContextMap[word];
	if (validContexts) {
		const { context, goalType } = auxiliarGetContextFromDocument(
			doc.getText(),
			position.line,
		);
		const isValidInCurrentContext =
			validContexts.includes(context) ||
			(goalType && validContexts.includes(goalType));

		const contextInfo = context
			? `\n\n**Current context:** ${context}${goalType ? ` (${goalType})` : ""}`
			: "";
		const validityInfo = context
			? isValidInCurrentContext
				? " ✅"
				: " ❌"
			: "";

		const contents = {
			kind: MarkupKind.Markdown,
			value: `**Property:** \`${word}\`${validityInfo}\n\n**Valid contexts:** ${validContexts.join(", ")}${contextInfo}`,
		};
		return { contents };
	}

	// Check if it's a flow step name
	const flowStepContexts = flowStepContextMap[word];
	if (flowStepContexts) {
		const { context, goalType } = auxiliarGetContextFromDocument(
			doc.getText(),
			position.line,
		);
		let isValidInCurrentContext = false;

		if (goalType) {
			isValidInCurrentContext = flowStepContexts.includes(goalType);
		} else {
			isValidInCurrentContext = flowStepContexts.includes(context);
		}

		const contextInfo = context
			? `\n\n**Current context:** ${context}${goalType ? ` (${goalType})` : ""}`
			: "";
		const validityInfo = context
			? isValidInCurrentContext
				? " ✅"
				: " ❌"
			: "";

		const flowStep = flow[word];
		const stepMessage = flowStep ? flowStep.message : "Unknown flow step";

		const contents = {
			kind: MarkupKind.Markdown,
			value: `**Flow Step:** \`${word}\`${validityInfo}\n\n**Message:** ${stepMessage}\n\n**Valid contexts:** ${flowStepContexts.join(", ")}${contextInfo}`,
		};
		return { contents };
	}

	// Check if it's a flow step
	const flowStep = flow[word];
	if (flowStep) {
		const metadataType = flowStep.metadata?.type || "unknown";
		const contents = {
			kind: MarkupKind.Markdown,
			value: `**Flow Step:** \`${word}\`\n\n**Message:** ${flowStep.message}\n\n**Type:** ${metadataType}\n\n**Options:** ${flowStep.options.length > 0 ? flowStep.options.map((opt) => opt.label).join(", ") : "None"}`,
		};
		return { contents };
	}

	return null;
}