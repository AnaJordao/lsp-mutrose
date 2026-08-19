/**
 * Unit tests for src/server.ts
 *
 * server.ts has module-level side effects: it calls createConnection(),
 * instantiates TextDocuments, registers all connection.on*() handlers, and
 * calls .listen() -- all at import time. To test it in isolation we mock
 * 'vscode-languageserver/node' so we can:
 *   1. Capture the callback each connection.onX(...) call registers.
 *   2. Invoke those callbacks directly with fake params.
 *   3. Assert they call through to (mocked) helperFunctions correctly.
 *
 * Assumed devDependencies: jest, ts-jest, @types/jest.
 * Assumed location: src/tests/server.test.ts (adjust the relative imports
 * below -- '../server' and '../helperFunctions' -- if your server.ts lives
 * elsewhere). Keep this file scoped to a folder ignored by your Mocha
 * config / covered by jest.config.js's `roots`, so the two runners don't
 * collide over the same compiled output.
 */

import { Position, Range, SymbolKind } from "vscode-languageserver/node";
import type {
  CompletionItem,
  DefinitionParams,
  DocumentSymbolParams,
  Hover,
  InitializeParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConnection = {
  onInitialize: jest.fn(),
  onCompletion: jest.fn(),
  onCompletionResolve: jest.fn(),
  onDefinition: jest.fn(),
  onDocumentSymbol: jest.fn(),
  onHover: jest.fn(),
  sendDiagnostics: jest.fn(),
  listen: jest.fn(),
};

// Populated by the TextDocuments mock factory below. Must be prefixed with
// "mock" so Jest's module factory hoisting allows referencing it.
let mockDocumentsInstance: {
  onDidOpen: jest.Mock;
  onDidChangeContent: jest.Mock;
  get: jest.Mock;
  listen: jest.Mock;
};

jest.mock("vscode-languageserver/node", () => {
  const actual = jest.requireActual(
    "vscode-languageserver/node",
  ) as typeof import("vscode-languageserver/node");
  return {
    ...actual,
    createConnection: jest.fn(() => mockConnection),
    TextDocuments: jest.fn().mockImplementation(() => {
      mockDocumentsInstance = {
        onDidOpen: jest.fn(),
        onDidChangeContent: jest.fn(),
        get: jest.fn(),
        listen: jest.fn(),
      };
      return mockDocumentsInstance;
    }),
  };
});

jest.mock("../helperFunctions", () => ({
  fileUriToPath: jest.fn(),
  validateTextDocument: jest.fn(),
  indexDocument: jest.fn(),
  getGmCompletionItems: jest.fn(),
  getCompletionItems: jest.fn(),
  getHover: jest.fn(),
  getWordRangeAtPosition: jest.fn(),
}));

import * as helperFunctions from "../helperFunctions";

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("server.ts", () => {
  let serverModule: typeof import("../server");

  let onInitializeCallback: (params: InitializeParams) => any;
  let onCompletionCallback: (params: any) => CompletionItem[];
  let onCompletionResolveCallback: (item: CompletionItem) => CompletionItem;
  let onDefinitionCallback: (params: DefinitionParams) => any;
  let onDocumentSymbolCallback: (params: DocumentSymbolParams) => any;
  let onHoverCallback: (params: any) => Hover | null;
  let onDidOpenCallback: (e: { document: TextDocument }) => void;
  let onDidChangeContentCallback: (change: { document: TextDocument }) => void;

  let documentsListenCalledWithConnection: boolean;
  let connectionListenCallCount: number;

  beforeAll(() => {
    // Importing server.ts runs its top-level side effects against the
    // mocked connection/documents, registering all the handlers we need.
    serverModule = require("../server");

    onInitializeCallback = mockConnection.onInitialize.mock.calls[0][0] as any;
    onCompletionCallback = mockConnection.onCompletion.mock.calls[0][0] as any;
    onCompletionResolveCallback = mockConnection.onCompletionResolve.mock
      .calls[0][0] as any;
    onDefinitionCallback = mockConnection.onDefinition.mock.calls[0][0] as any;
    onDocumentSymbolCallback = mockConnection.onDocumentSymbol.mock
      .calls[0][0] as any;
    onHoverCallback = mockConnection.onHover.mock.calls[0][0] as any;
    onDidOpenCallback = mockDocumentsInstance.onDidOpen.mock.calls[0][0] as any;
    onDidChangeContentCallback = mockDocumentsInstance.onDidChangeContent.mock
      .calls[0][0] as any;

    // Capture these before any beforeEach clears mock call history.
    documentsListenCalledWithConnection =
      mockDocumentsInstance.listen.mock.calls.some(
        (call) => call[0] === mockConnection,
      );
    connectionListenCallCount = mockConnection.listen.mock.calls.length;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  describe("module wiring", () => {
    it("starts listening on both the documents manager and the connection", () => {
      expect(documentsListenCalledWithConnection).toBe(true);
      expect(connectionListenCallCount).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onInitialize", () => {
    it("converts each workspace folder URI and stores it in workspaceFolders", () => {
      (helperFunctions.fileUriToPath as jest.Mock).mockImplementation(
        (uri: string) => uri.replace("file://", ""),
      );

      const params = {
        workspaceFolders: [
          { uri: "file:///home/user/project-a", name: "project-a" },
          { uri: "file:///home/user/project-b", name: "project-b" },
        ],
      } as unknown as InitializeParams;

      onInitializeCallback(params);

      expect(serverModule.workspaceFolders).toEqual([
        "/home/user/project-a",
        "/home/user/project-b",
      ]);
    });

    it("leaves workspaceFolders empty when none are provided", () => {
      serverModule.workspaceFolders = [];
      onInitializeCallback({
        workspaceFolders: null,
      } as unknown as InitializeParams);
      expect(serverModule.workspaceFolders).toEqual([]);
    });

    it("advertises the expected server capabilities", () => {
      const result = onInitializeCallback({
        workspaceFolders: null,
      } as unknown as InitializeParams);

      expect(result.capabilities.completionProvider).toEqual({
        resolveProvider: true,
        triggerCharacters: [":", "."],
      });
      expect(result.capabilities.definitionProvider).toBe(true);
      expect(result.capabilities.hoverProvider).toBe(true);
      expect(result.capabilities.workspaceSymbolProvider).toBe(true);
      expect(result.capabilities.documentSymbolProvider).toBe(true);
      expect(result.capabilities.workspace).toEqual({
        workspaceFolders: { supported: true, changeNotifications: true },
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("documents.onDidOpen", () => {
    it("indexes and validates the document", () => {
      const doc = TextDocument.create("file:///a.gm", "json", 1, "{}");
      (helperFunctions.validateTextDocument as jest.Mock).mockResolvedValue([]);

      onDidOpenCallback({ document: doc });

      expect(helperFunctions.indexDocument as jest.Mock).toHaveBeenCalledWith(
        doc,
      );
      expect(
        helperFunctions.validateTextDocument as jest.Mock,
      ).toHaveBeenCalledWith(doc);
    });
  });

  // -------------------------------------------------------------------------
  describe("documents.onDidChangeContent", () => {
    it("indexes, validates, and forwards diagnostics for the changed document", async () => {
      const doc = TextDocument.create("file:///a.gm", "json", 1, "{}");
      const diagnostics = [
        {
          message: "oops",
          range: Range.create(Position.create(0, 0), Position.create(0, 1)),
        },
      ];
      (helperFunctions.validateTextDocument as jest.Mock).mockResolvedValue(
        diagnostics,
      );

      onDidChangeContentCallback({ document: doc });
      // Flush the microtask queue so the validateTextDocument(...).then(...) resolves.
      await Promise.resolve();
      await Promise.resolve();

      expect(helperFunctions.indexDocument as jest.Mock).toHaveBeenCalledWith(
        doc,
      );
      expect(
        helperFunctions.validateTextDocument as jest.Mock,
      ).toHaveBeenCalledWith(doc);
      expect(mockConnection.sendDiagnostics).toHaveBeenCalledWith({
        uri: doc.uri,
        diagnostics,
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onCompletion", () => {
    it("returns an empty array when the document cannot be found", () => {
      mockDocumentsInstance.get.mockReturnValue(undefined);

      const result = onCompletionCallback({
        textDocument: { uri: "file:///missing.gm" },
        position: Position.create(0, 0),
      });

      expect(result).toEqual([]);
      expect(
        helperFunctions.getGmCompletionItems as jest.Mock,
      ).not.toHaveBeenCalled();
      expect(
        helperFunctions.getCompletionItems as jest.Mock,
      ).not.toHaveBeenCalled();
    });

    it("delegates to getGmCompletionItems for .gm files", () => {
      const doc = TextDocument.create("file:///model.gm", "json", 1, "{}");
      mockDocumentsInstance.get.mockReturnValue(doc);
      const items: CompletionItem[] = [
        { label: "AchieveCondition" } as CompletionItem,
      ];
      (helperFunctions.getGmCompletionItems as jest.Mock).mockReturnValue(
        items,
      );

      const position = Position.create(2, 4);
      const result = onCompletionCallback({
        textDocument: { uri: doc.uri },
        position,
      });

      expect(
        helperFunctions.getGmCompletionItems as jest.Mock,
      ).toHaveBeenCalledWith(doc, position);
      expect(
        helperFunctions.getCompletionItems as jest.Mock,
      ).not.toHaveBeenCalled();
      expect(result).toBe(items);
    });

    it("delegates to getCompletionItems (with the shared variableDefinitions map) for non-.gm files", () => {
      const doc = TextDocument.create("file:///flow.txt", "plaintext", 1, "");
      mockDocumentsInstance.get.mockReturnValue(doc);
      const items: CompletionItem[] = [{ label: "goto" } as CompletionItem];
      (helperFunctions.getCompletionItems as jest.Mock).mockReturnValue(items);

      const position = Position.create(1, 1);
      const result = onCompletionCallback({
        textDocument: { uri: doc.uri },
        position,
      });

      expect(
        helperFunctions.getCompletionItems as jest.Mock,
      ).toHaveBeenCalledWith(doc, position, serverModule.variableDefinitions);
      expect(
        helperFunctions.getGmCompletionItems as jest.Mock,
      ).not.toHaveBeenCalled();
      expect(result).toBe(items);
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onCompletionResolve", () => {
    it("returns the completion item unchanged", () => {
      const item = { label: "Foo" } as CompletionItem;
      expect(onCompletionResolveCallback(item)).toBe(item);
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onDefinition", () => {
    const baseParams = {
      textDocument: { uri: "file:///a.txt" },
      position: Position.create(0, 0),
    } as unknown as DefinitionParams;

    it("returns null when the document cannot be found", () => {
      mockDocumentsInstance.get.mockReturnValue(undefined);
      expect(onDefinitionCallback(baseParams)).toBeNull();
    });

    it("returns null when there is no word range at the cursor", () => {
      const doc = TextDocument.create("file:///a.txt", "plaintext", 1, "");
      mockDocumentsInstance.get.mockReturnValue(doc);
      (helperFunctions.getWordRangeAtPosition as jest.Mock).mockReturnValue(
        null,
      );

      expect(onDefinitionCallback(baseParams)).toBeNull();
    });

    it("returns null when the word under the cursor is not a known variable", () => {
      const doc = TextDocument.create(
        "file:///a.txt",
        "plaintext",
        1,
        "unknownVar",
      );
      mockDocumentsInstance.get.mockReturnValue(doc);
      (helperFunctions.getWordRangeAtPosition as jest.Mock).mockReturnValue(
        Range.create(Position.create(0, 0), Position.create(0, 10)),
      );

      expect(onDefinitionCallback(baseParams)).toBeNull();
    });

    it("returns the stored location when the word matches a known variable", () => {
      const doc = TextDocument.create("file:///a.txt", "plaintext", 1, "myVar");
      mockDocumentsInstance.get.mockReturnValue(doc);
      (helperFunctions.getWordRangeAtPosition as jest.Mock).mockReturnValue(
        Range.create(Position.create(0, 0), Position.create(0, 5)),
      );

      const location = {
        uri: "file:///a.txt",
        range: Range.create(Position.create(0, 0), Position.create(0, 5)),
      };
      serverModule.variableDefinitions.set("myVar", { location, value: "42" });

      try {
        expect(onDefinitionCallback(baseParams)).toEqual(location);
      } finally {
        serverModule.variableDefinitions.delete("myVar");
      }
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onDocumentSymbol", () => {
    it("returns an empty array when the document cannot be found", () => {
      mockDocumentsInstance.get.mockReturnValue(undefined);
      expect(
        onDocumentSymbolCallback({
          textDocument: { uri: "file:///missing.txt" },
        } as DocumentSymbolParams),
      ).toEqual([]);
    });

    it("extracts one symbol per top-level variable-assignment line", () => {
      const text = [
        "foo = 1",
        "  indented = 2", // leading whitespace -- regex is anchored, should not match
        "bar=3",
        "not a variable line",
      ].join("\n");
      const doc = TextDocument.create("file:///vars.txt", "plaintext", 1, text);
      mockDocumentsInstance.get.mockReturnValue(doc);

      const result = onDocumentSymbolCallback({
        textDocument: { uri: doc.uri },
      } as DocumentSymbolParams);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        name: "foo",
        kind: SymbolKind.Variable,
        location: {
          uri: doc.uri,
          range: Range.create(Position.create(0, 0), Position.create(0, 3)),
        },
      });
      expect(result[1]).toMatchObject({
        name: "bar",
        kind: SymbolKind.Variable,
        location: {
          uri: doc.uri,
          range: Range.create(Position.create(2, 0), Position.create(2, 3)),
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  describe("connection.onHover", () => {
    const params = {
      textDocument: { uri: "file:///x.txt" },
      position: Position.create(3, 3),
    };

    it("returns null when the document cannot be found", () => {
      mockDocumentsInstance.get.mockReturnValue(undefined);
      expect(onHoverCallback(params)).toBeNull();
    });

    it("delegates to getHover with the document, position, and shared variableDefinitions map", () => {
      const doc = TextDocument.create("file:///x.txt", "plaintext", 1, "");
      mockDocumentsInstance.get.mockReturnValue(doc);
      const hover: Hover = { contents: { kind: "markdown", value: "hi" } };
      (helperFunctions.getHover as jest.Mock).mockReturnValue(hover);

      const result = onHoverCallback(params);

      expect(helperFunctions.getHover as jest.Mock).toHaveBeenCalledWith(
        doc,
        params.position,
        serverModule.variableDefinitions,
      );
      expect(result).toBe(hover);
    });
  });
});
