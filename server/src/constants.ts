import { Flow, ErrorsTypes, AttributeCompletionsTypes } from './interfaces';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/lib/node/main';
import {
  CompletionItem,
  CompletionItemKind,
} from "vscode-languageserver/node";

export const selectBodyRegex = /select\s*\(\s*([A-Za-z_][\w]*)\s*(?::\s*([A-Za-z_][\w.]*)\s*)?\|/i;
export const forAllBodyRegex = /forAll\s*\(\s*([A-Za-z_][\w]*)\s*(?::\s*([A-Za-z_][\w.]*)\s*)?\|/i;

export const errorsSourceTypes: Record<string, string> = {
	mutroseGMValidator: "MutRoSe GM Validator",
	mutroseOCLValidator: "MutRoSe OCL Validator",
	mutroseFlowValidator: "MutRoSe Flow Validator",
};

export const errors: ErrorsTypes = {
	jsonParsingError: (pos: any, error: any): Diagnostic[] => [{
				severity: DiagnosticSeverity.Error,
				range: {
					start: { line: pos.line, character: pos.character },
					end: { line: pos.line, character: pos.character },
				},
				message: `Invalid JSON format: ${error instanceof Error ? error.message : "Unknown error"}`,
				source: errorsSourceTypes.mutroseGMValidator,
	}],
	wrongPropertyContextError: (
		propLine: number, 
		propChar: number, 
		propName: string, 
		nodeType: string, 
		goalType: string | undefined, 
		validContexts: string[]
	): Diagnostic => ({
				severity: DiagnosticSeverity.Error,
				range: {
				start: { line: propLine, character: propChar },
				end: { line: propLine, character: propChar + propName.length + 2 }
					},
				message: `Property '${propName}' is not valid for ${nodeType}${goalType ? ` with GoalType '${goalType}'` : ''}. Valid contexts: ${validContexts.join(', ')}`,
				source: errorsSourceTypes.mutroseGMValidator
			}),
	propertyCanOnlyBeUsedInSpecificGoalTypeError: (
		propLine: number, 
		propChar: number, 
		propName: string, 
		rightGoalType: string, 
		wrongGoalType: string,
		source: string,
	): Diagnostic => ({
			severity: DiagnosticSeverity.Error,
			range: {
					start: { line: propLine, character: propChar },
					end: { line: propLine, character: propChar + propName.length + 2 }
			},
			message: `Property '${propName}' can only be used with '${rightGoalType}' goals, not '${wrongGoalType}' goals.`,
			source: source
	}),
	formatValidationError: (
		severity: DiagnosticSeverity,
		valueLine: number, 
		valueChar: number, 
		valueEndLine: number, 
		valueEndChar: number, 
		error: string
	): Diagnostic => ({
		severity: severity,
		range: {
			start: { line: valueLine, character: valueChar },
			end: { line: valueEndLine, character: valueEndChar }
		},
		message: error,
		source: errorsSourceTypes.mutroseOCLValidator
	}),
	propertyValidationInFlowError: (
		line: number,
		startChar: number,
		endChar: number,
		property: string,
		currentContext: string,
		currentGoalType: string | undefined,
		validContexts: string[]
	): Diagnostic => ({
		severity: DiagnosticSeverity.Error,
		range: {
			start: { line: line, character: startChar },
			end: { line: line, character: endChar },
		},
		message: `Property '${property}' is not valid in ${currentContext}${currentGoalType ? ` (${currentGoalType})` : ""} context. Valid contexts: ${validContexts.join(", ")}`,
		source: errorsSourceTypes.mutroseFlowValidator,
	}),
	flowStepValidationError: (
		line: number,
		startChar: number,
		endChar: number,
		stepName: string,
		currentContext: string,
		currentGoalType: string | undefined,
		validContexts: string[]
	): Diagnostic => ({
		severity: DiagnosticSeverity.Error,
		range: {
			start: { line: line, character: startChar },
			end: { line: line, character: endChar },
		},
		message: `Flow step '${stepName}' is not valid in ${currentContext}${currentGoalType ? ` (${currentGoalType})` : ""} context. Valid contexts: ${validContexts.join(", ")}`,
		source: "MutRoSe Flow Validator",
	}),
};

export const attributeCompletions: AttributeCompletionsTypes = {
	goalType: {
		label: "GoalType",
		kind: CompletionItemKind.Property,
		insertText: '"GoalType": "${1:Achieve}"',
		insertTextFormat: 2,
		documentation: "Goal type (Achieve, Query, or Perform)",
	},
	changeGoalType: (type: string, data: number): CompletionItem => ({
		label: type,
		kind: CompletionItemKind.EnumMember,
		detail: `Goal Type: ${type}`,
		documentation: `Sets the goal type to ${type}`,
		data: data,
	}),
	achieve: {
		label: "Achieve",
		kind: CompletionItemKind.EnumMember,
		insertText: "Achieve",
		documentation: "Goal type Achieve",
	},
	achieveCondition: {
		label: "AchieveCondition",
		kind: CompletionItemKind.Property,
		insertText: '"AchieveCondition": "${1:}"',
		insertTextFormat: 2,
		documentation: "Condition for Achieve goals",
	},
	group: {
		label: "Group",
		kind: CompletionItemKind.Property,
		insertText: '"Group": ${1:true}',
		insertTextFormat: 2,
		documentation: "Group property for Achieve goals",
	},
	divisible: {
		label: "Divisible",
		kind: CompletionItemKind.Property,
		insertText: '"Divisible": ${1:false}',
		insertTextFormat: 2,
		documentation: "Divisible property for Achieve goals",
	},
	query: {
		label: "Query",
		kind: CompletionItemKind.EnumMember,
		insertText: "Query",
		documentation: "Goal type Query",
	},
	queriedProperty: {
		label: "QueriedProperty",
		kind: CompletionItemKind.Property,
		insertText: '"QueriedProperty": "${1:}"',
		insertTextFormat: 2,
		documentation: "Queried property for Query goals",
	},
	perform:{
		label: "Perform",
		kind: CompletionItemKind.EnumMember,
		insertText: "Perform",
		documentation: "Goal type Perform",
	},
	controls: {
		label: "Controls",
		kind: CompletionItemKind.Property,
		insertText: '"Controls": "${1:}"',
		insertTextFormat: 2,
		documentation: "Controls for goals",
	},
	monitors: {
		label: "Monitors",
		kind: CompletionItemKind.Property,
		insertText: '"Monitors": "${1:}"',
		insertTextFormat: 2,
		documentation: "Monitors for goals",
	},
	params: {
		label: "Params",
		kind: CompletionItemKind.Property,
		insertText: '"Params": "${1:}"',
		insertTextFormat: 2,
		documentation: "Task parameters",
	},
	location: {
		label: "Location",
		kind: CompletionItemKind.Property,
		insertText: '"Location": "${1:}"',
		insertTextFormat: 2,
		documentation: "Task location",
	},
	robotNumber: {
		label: "RobotNumber",
		kind: CompletionItemKind.Property,
		insertText: '"RobotNumber": ${1:1}',
		insertTextFormat: 2,
		documentation: "Number of robots for task",
	},
	description: {
		label: "Description",
		kind: CompletionItemKind.Property,
		insertText: '"Description": "${1:}"',
		insertTextFormat: 2,
		documentation: "Node description",
	},
	class: (className: string): CompletionItem => ({
		label: className,
		kind: CompletionItemKind.Class,
		insertText: className,
		detail: "Knowledge class",
		documentation: `Class from knowledge folder: ${className}`,
	}),
	sequenceOfClass: (className: string): CompletionItem => ({
		label: `Sequence(${className})`,
		kind: CompletionItemKind.Class,
		insertText: `Sequence(${className})`,
		detail: "Knowledge class sequence",
		documentation: `Sequence of ${className}`,
	}),
	variable: (varName: string, type: string): CompletionItem => ({
		label: varName,
		kind: CompletionItemKind.Variable,
		insertText: varName,
		detail: `: ${type}`,
		documentation: `Variable from Controls: ${varName} : ${type}`,
	}),
	variableDefinition: (name: string, data: number): CompletionItem => ({
			label: name,
			kind: CompletionItemKind.Variable,
			data: data,
	}),
	flowStep: (stepName: string, message: string, context: string, data: number): CompletionItem => ({
		label: stepName,
		kind: CompletionItemKind.Function,
		detail: message,
		documentation: `Flow step: ${message} (Valid in ${context} context)`,
		data: data,
	}),
};

export const snippets: Record<string, (nextGoalNumber: number) => CompletionItem> = {
	achieveGoalSnippet: (nextGoalNumber: number): CompletionItem => ({
			label: "Achieve Goal",
			kind: CompletionItemKind.Snippet,
			insertText: `{
	"id": "\${1:goal-id}",
	"text": "\${2:G${nextGoalNumber}: Goal Name}",
	"type": "istar.Goal",
	"x": \${3:100},
	"y": \${4:100},
	"customProperties": {
		"Description": "",
		"GoalType": "Achieve",
		"AchieveCondition": "\${5:condition}",
		"Controls": "\${6:}",
		"Monitors": "\${7:}"
	}
}`,
			documentation: "Insert an Achieve Goal node with all attributes",
			insertTextFormat: 2,
		}),
	queryGoalSnippet: (nextGoalNumber: number): CompletionItem => ({
			label: "Query Goal",
			kind: CompletionItemKind.Snippet,
			insertText: `{
	"id": "\${1:goal-id}",
	"text": "\${2:G${nextGoalNumber}: Goal Name}",
	"type": "istar.Goal",
	"x": \${3:100},
	"y": \${4:100},
	"customProperties": {
		"Description": "",
		"GoalType": "Query",
		"QueriedProperty": "\${5:property}",
		"Controls": "\${6:}",
		"Monitors": "\${7:}"
	}
}`,
			documentation: "Insert a Query Goal node with all attributes",
			insertTextFormat: 2,
		}),
	basicGoalSnippet: (nextGoalNumber: number): CompletionItem => ({
			label: "Basic Goal",
			kind: CompletionItemKind.Snippet,
			insertText: `{
	"id": "\${1:goal-id}",
	"text": "\${2:G${nextGoalNumber}: Goal Name}",
	"type": "istar.Goal",
	"x": \${3:100},
	"y": \${4:100},
	"customProperties": {
		"Description": "",
		"Monitors": "\${5:}",
		"Controls": "\${6:}"
	}
}`,
			documentation: "Insert a basic Goal node",
			insertTextFormat: 2,
		}),
	taskSnippet: (nextTaskNumber: number): CompletionItem => ({
			label: "Task",
			kind: CompletionItemKind.Snippet,
			insertText: `{
	"id": "\${1:task-id}",
	"text": "\${2:A${nextTaskNumber}: Task Name}",
	"type": "istar.Task",
	"x": \${3:100},
	"y": \${4:100},
	"customProperties": {
		"Description": "",
		"Params": "\${5:}",
		"Location": "\${6:}",
		"RobotNumber": \${7:1}
	}
}`,
			documentation: "Insert a Task node with all attributes",
			insertTextFormat: 2,
		}),
};

export const flow: Record<string, Flow> = {
	goal: {
		message: "Define Goal",
		options: [
			{ label: "Name", next: "goalName" },
			{ label: "Goal Type", next: "goalType" },
		],
		metadata: { type: "option", propertyName: "istar.Goal" },
	},
	goalName: {
		message: "Define Goal Name",
		options: [],
		metadata: { type: "input", goTo: "goal", propertyName: "Name" },
	},
	goalType: {
		message: "Define Goal Type",
		options: [
			{ label: "Achieve", next: "achieve" },
			{ label: "Query", next: "query" },
			{ label: "Perform", next: "goalType" },
		],
		metadata: {
			type: "option",
			propertyName: "GoalType",
			requiresConfirmation: true,
		},
	},
	achieve: {
		message: "Define the attributes",
		options: [
			{ label: "Achieve Condition", next: "achieveCondition" },
			{ label: "Controls", next: "controls" },
			{ label: "Monitors", next: "monitors" },
			{ label: "Group", next: "group" },
		],
		metadata: { type: "option" },
	},
	achieveCondition: {
		message: "Define the achieve condition",
		options: [],
		metadata: {
			type: "input",
			goTo: "achieve",
			propertyName: "AchieveCondition",
		},
	},
	controls: {
		message: "Define the controls",
		options: [],
		metadata: { type: "input", goTo: "achieve", propertyName: "Controls" },
	},
	monitors: {
		message: "Define the monitors",
		options: [],
		metadata: { type: "input", goTo: "achieve", propertyName: "Monitors" },
	},
	group: {
		message: "Define the group",
		options: [
			{ label: "True", next: "divisible" },
			{ label: "False", next: "achieve" },
		],
		metadata: { type: "boolean", propertyName: "Group" },
	},
	divisible: {
		message: "Define the divisible",
		options: [
			{ label: "True", next: "achieve" },
			{ label: "False", next: "achieve" },
		],
		metadata: { type: "boolean", propertyName: "Divisible" },
	},
	query: {
		message: "Define the attributes",
		options: [{ label: "Queried Property", next: "queriedProperty" }],
		metadata: { type: "option", goTo: "goalType" },
	},
	queriedProperty: {
		message: "Define the queried property",
		options: [],
		metadata: {
			type: "input",
			goTo: "goalType",
			propertyName: "QueriedProperty",
		},
	},
	task: {
		message: "Define Task",
		options: [
			{ label: "Name", next: "taskName" },
			{ label: "Task Attributes", next: "taskAttributes" },
		],
		metadata: { type: "option", propertyName: "istar.Task" },
	},
	taskName: {
		message: "Define Task Name",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Name" },
	},
	taskAttributes: {
		message: "Define the task attributes",
		options: [
			{ label: "Location", next: "location" },
			{ label: "Params", next: "params" },
			{ label: "Robot Numbers", next: "robotNumbers" },
		],
		metadata: { type: "option" },
	},
	location: {
		message: "Choose an option to define the location",
		options: [
			{ label: "Variables", next: "locationVariables" },
			{ label: "Name", next: "locationName" },
			{ label: "Type", next: "locationType" },
			{ label: "Collection", next: "locationCollection" },
		],
		metadata: { type: "option" },
	},
	locationVariables: {
		message: "Choose the variables to define the location",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Location" },
	},
	locationName: {
		message: "Choose the name to define the location",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Location" },
	},
	locationType: {
		message: "Choose the type to define the location",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Location" },
	},
	locationCollection: {
		message: "Choose the collection to define the location",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Location" },
	},
	params: {
		message: "Define the params",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "Params" },
	},
	robotNumbers: {
		message: "Define the number of robots",
		options: [
			{ label: "Number", next: "robotSingleNumber" },
			{ label: "Range", next: "robotNumRange" },
		],
		metadata: { type: "option" },
	},
	robotSingleNumber: {
		message: "Choose the range of number",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "RobotNumber" },
	},
	robotNumRange: {
		message: "Choose the range of number",
		options: [],
		metadata: { type: "input", goTo: "task", propertyName: "RobotNumber" },
	},
};

// Property to context mapping for validation
export const propertyContextMap: Record<string, string[]> = {
	AchieveCondition: ["achieve"],
	Controls: ["achieve", "query"],
	Monitors: ["goal", "achieve", "query"],
	Group: ["achieve"],
	Divisible: ["achieve"],
	QueriedProperty: ["query"],
	Location: ["task"],
	Params: ["task"],
	RobotNumber: ["task"],
	Name: ["goal", "task"],
	GoalType: ["goal"],
};

// Flow step to context mapping for completions
export const flowStepContextMap: Record<string, string[]> = {
	// Goal level steps (available in all goal contexts)
	goalName: ["goal", "achieve", "query"],
	goalType: ["goal"],

	// Achieve goal steps
	achieveCondition: ["achieve"],
	controls: ["achieve", "query"],
	monitors: ["goal", "achieve", "query"],
	group: ["achieve"],
	divisible: ["achieve"],

	// Query goal steps
	queriedProperty: ["query"],

	// Task steps (available in all task contexts)
	taskName: ["task"],
	taskAttributes: ["task"],
	location: ["task"],
	locationVariables: ["task"],
	locationName: ["task"],
	locationType: ["task"],
	locationCollection: ["task"],
	params: ["task"],
	robotNumbers: ["task"],
	robotSingleNumber: ["task"],
	robotNumRange: ["task"],
};