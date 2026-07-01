import { VariableInfo } from './interfaces';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentSymbolParams, SymbolInformation, SymbolKind } from 'vscode-languageserver/node';
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  Position,
  Range,
  DefinitionParams,
  Hover,
} from "vscode-languageserver/node";
import { 
  fileUriToPath, 
  validateTextDocument, 
  indexDocument, 
  getGmCompletionItems,
  getCompletionItems,
  getHover,
  getWordRangeAtPosition
} from './helperFunctions';

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments<TextDocument>(TextDocument);

export let workspaceFolders: string[] = [];
export const variableDefinitions = new Map<string, VariableInfo>();
 
connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders.map((folder) =>
      fileUriToPath(folder.uri),
    );
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [":", "."],
      },
      definitionProvider: true,
      hoverProvider: true,
      workspaceSymbolProvider: true,
      documentSymbolProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true,
        },
      },
    },
  };
});

documents.onDidOpen((e) => {
  indexDocument(e.document);
  validateTextDocument(e.document);
});

documents.onDidChangeContent((change) => {
  indexDocument(change.document);
  validateTextDocument(change.document).then((diagnostics) => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  });
});

connection.onCompletion((params): CompletionItem[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return [];
  }

  // Check if this is a .gm file
  if (doc.uri.endsWith(".gm")) {
    return getGmCompletionItems(doc, params.position);
  }

  return getCompletionItems(doc, params.position, variableDefinitions);
});

// Resolve additional information for completion items (prevents error messages)
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return item;
});

connection.onDefinition((params: DefinitionParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }

  const pos = params.position;
  const wordRange = getWordRangeAtPosition(doc, pos);
  if (!wordRange) {
    return null;
  }

  const word = doc.getText(wordRange);
  const info = variableDefinitions.get(word);

  return info ? info.location : null;
});

connection.onDocumentSymbol(
  (params: DocumentSymbolParams): SymbolInformation[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) {
      return [];
    }

    const symbols: SymbolInformation[] = [];
    const text = doc.getText();
    const lines = text.split(/\r?\n/);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const match = line.match(/^([a-zA-Z_]\w*)\s*=/);
      if (match) {
        const varName = match[1];
        symbols.push({
          name: varName,
          kind: SymbolKind.Variable,
          location: {
            uri: doc.uri,
            range: Range.create(
              Position.create(lineIndex, 0),
              Position.create(lineIndex, varName.length),
            ),
          },
        });
      }
    }

    return symbols;
  },
);

connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {
    return null;
  }

  return getHover(doc, params.position, variableDefinitions);
});

documents.listen(connection);
connection.listen();
