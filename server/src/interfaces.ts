import { Location, Position } from "vscode-languageserver/node";
import { CompletionItem, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/lib/node/main';

export interface ErrorsTypes {
  jsonParsingError(pos: Position, error: unknown): Diagnostic[];
  wrongPropertyContextError(
    propLine: number,
    propChar: number,
    propName: string,
    nodeType: string,
    goalType: string | undefined,
    validContexts: string[]
  ): Diagnostic;
  propertyCanOnlyBeUsedInSpecificGoalTypeError(
    propLine: number,
    propChar: number,
    propName: string,
    rightGoalType: string,
    wrongGoalType: string,
    source: string,
  ): Diagnostic;
  formatValidationError(
    severity: DiagnosticSeverity,
    valueLine: number,
    valueChar: number,
    valueEndLine: number,
    valueEndChar: number,
    error: string
  ): Diagnostic;
  propertyValidationInFlowError(
    line: number,
		startChar: number,
		endChar: number,
		property: string,
		currentContext: string,
		currentGoalType: string | undefined,
		validContexts: string[]
  ): Diagnostic;
  flowStepValidationError(
		line: number,
		startChar: number,
		endChar: number,
		stepName: string,
		currentContext: string,
		currentGoalType: string | undefined,
		validContexts: string[]
	): Diagnostic;
}

export interface AttributeCompletionsTypes {
  goalType: CompletionItem;
  changeGoalType: (type: string, data: number) => CompletionItem;
  achieve: CompletionItem;
  achieveCondition: CompletionItem;
  group: CompletionItem;
  divisible: CompletionItem;
  query: CompletionItem;
  queriedProperty: CompletionItem;
  perform: CompletionItem;
  controls: CompletionItem;
  monitors: CompletionItem;
  params: CompletionItem;
  location: CompletionItem;
  robotNumber: CompletionItem;
  description: CompletionItem;
  class: (className: string) => CompletionItem;
  sequenceOfClass: (className: string) => CompletionItem;
  variable: (varName: string, type: string) => CompletionItem;
  variableDefinition: (name: string, data: number) => CompletionItem;
  flowStep: (stepName: string, message: string, context: string, data: number)=> CompletionItem;
}

export interface KnowledgeClassInfo {
  name: string;
  attributes: string[];
}

export interface OclAttributeCompletionContext {
	variableName: string;
  typeName: string;
  attributePrefix: string;
}

export interface VariableInfo {
  location: Location;
  value?: string;
}

export interface GmNode {
  id: string;
  text: string;
  type: "istar.Goal" | "istar.Task";
  x: number;
  y: number;
  customProperties: Record<string, string>;
}

export interface GmActor {
  id: string;
  text: string;
  type: string;
  nodes: GmNode[];
}

export interface GmFile {
  actors: GmActor[];
  orphans: GmNode[];
  dependencies: unknown[];
  links: unknown[];
}

export interface FlowMetadata {
  type: "option" | "input" | "boolean";
  propertyName?: string;
  goTo?: string;
  requiresConfirmation?: boolean;
}

export interface Flow {
  message: string;
  options: { label: string; next?: string }[];
  metadata?: FlowMetadata;
  onChange?: (input: string) => Promise<void> | void;
}