import { TextDocument } from 'vscode-languageserver-textdocument';
import { Diagnostic } from 'vscode-languageserver';
import {
  CompletionItem,
  Position,
  Range,
  Hover,
} from "vscode-languageserver/node";
import { VariableInfo } from './interfaces';
import {
	auxiliarGetHover,
	auxiliarGetIndexDocument,
	auxiliarGetFileUriToPath,
	auxiliarGetCompletionItems,
	auxiliarGetGmCompletionItems,
	auxiliarGetWordRangeAtPosition,
} from './auxiliarFunctions/getFunctions';
import { auxiliarValidateTextDocument } from './auxiliarFunctions/validationFunctions';

export function fileUriToPath(uri: string): string {
  return auxiliarGetFileUriToPath(uri);
}

// Validate the entire text document
export async function validateTextDocument(
	textDocument: TextDocument,
): Promise<Diagnostic[]> {
	return auxiliarValidateTextDocument(textDocument);
}

// Index variable definitions in the document for quick lookup during completions and hover
export function indexDocument(doc: TextDocument): Map<string, VariableInfo> {
  return auxiliarGetIndexDocument(doc);
}

// Get completion items for .gm (Goal Model)
export function getGmCompletionItems(
  doc: TextDocument,
  position: Position,
): CompletionItem[] {
  return auxiliarGetGmCompletionItems(doc, position);
}

export function getCompletionItems(
	doc: TextDocument,
	position: Position,
	variableDefinitions: Map<string, VariableInfo>,
): CompletionItem[] {
	return auxiliarGetCompletionItems(doc, position, variableDefinitions);
}

export function getHover(
  doc: TextDocument,
  position: Position,
  variableDefinitions: Map<string, VariableInfo>,
): Hover | null {
  return auxiliarGetHover(doc, position, variableDefinitions);
}

export function getWordRangeAtPosition(
  doc: TextDocument,
  pos: Position,
): Range | null {
  return auxiliarGetWordRangeAtPosition(doc, pos);
}