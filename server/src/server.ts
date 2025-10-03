import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  Location,
  Position,
  Range,
  DefinitionParams,
  Hover,
  MarkupKind
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentSymbolParams, SymbolInformation, SymbolKind } from 'vscode-languageserver/node';


const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments<TextDocument>(TextDocument);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let workspaceFolders: string[] = [];

interface VariableInfo {
  location: Location;
  value?: string;
}

const variableDefinitions = new Map<string, VariableInfo>();

connection.onInitialize((params: InitializeParams): InitializeResult => {
  if (params.workspaceFolders) {
    workspaceFolders = params.workspaceFolders.map(folder =>
      new URL(folder.uri).pathname
    );
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true
      },
      definitionProvider: true,
      hoverProvider: true,
      workspaceSymbolProvider: true,
      documentSymbolProvider: true,
      workspace: {
        workspaceFolders: {
          supported: true,
          changeNotifications: true
        }
      }
    }
  };
});


documents.onDidOpen(e => indexDocument(e.document));
documents.onDidChangeContent(change => indexDocument(change.document));

function indexDocument(doc: TextDocument) {
  const text = doc.getText();
  const lines = text.split(/\r?\n/);

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
          Position.create(lineIndex, varName.length)
        )
      };

      variableDefinitions.set(varName, { location: loc, value: varValue });
    }
  }
}

connection.onCompletion((): CompletionItem[] => {
  return Array.from(variableDefinitions.keys()).map((name, i) => ({
    label: name,
    kind: CompletionItemKind.Variable,
    data: i
  }));
});

connection.onDefinition((params: DefinitionParams) => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {return null;}

  const pos = params.position;
  const wordRange = getWordRangeAtPosition(doc, pos);
  if (!wordRange) {return null;}

  const word = doc.getText(wordRange);
  const info = variableDefinitions.get(word);

  return info ? info.location : null;
});

connection.onDocumentSymbol((params: DocumentSymbolParams): SymbolInformation[] => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {return [];}

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
            Position.create(lineIndex, varName.length)
          )
        }
      });
    }
  }

  return symbols;
});


connection.onHover((params): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) {return null;}

  const pos = params.position;
  const wordRange = getWordRangeAtPosition(doc, pos);
  if (!wordRange) {return null;}

  const word = doc.getText(wordRange);
  const info = variableDefinitions.get(word);
  if (!info) {return null;}

  const contents = {
    kind: MarkupKind.Markdown,
    value: `\`${word} = ${info.value ?? '??'}\`\n\n**Defined in** [${info.location.uri.split('/').pop()}](${info.location.uri})`
  };

  return { contents };
});


function getWordRangeAtPosition(doc: TextDocument, pos: Position): Range | null {
  const text = doc.getText();
  const offset = doc.offsetAt(pos);
  const start = findWordStart(text, offset);
  const end = findWordEnd(text, offset);
  if (start < 0 || end < 0) {return null;}
  return Range.create(doc.positionAt(start), doc.positionAt(end));
}

function findWordStart(text: string, offset: number): number {
  while (offset > 0 && /\w/.test(text[offset - 1])) {
    offset--;
  }
  return offset;
}

function findWordEnd(text: string, offset: number): number {
  while (offset < text.length && /\w/.test(text[offset])) {
    offset++;
  }
  return offset;
}

documents.listen(connection);
connection.listen();
