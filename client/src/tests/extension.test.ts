/**
 * Unit tests for client/src/extension.ts
 *
 * Place this file at: client/src/tests/extension.test.ts
 * (adjust '../extension' import below if your layout differs)
 *
 * Both 'vscode' and 'vscode-languageclient/node' are mocked entirely —
 * they are VS Code host APIs that don't exist in a Jest/Node environment.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockStart = jest.fn();
const mockStop = jest.fn().mockResolvedValue(undefined);

const MockLanguageClient = jest.fn().mockImplementation(() => ({
  start: mockStart,
  stop: mockStop,
}));

jest.mock("vscode-languageclient/node", () => ({
  LanguageClient: MockLanguageClient,
  TransportKind: { ipc: "ipc" },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(resolvedPath = "/fake/server/out/server.js"): any {
  return {
    asAbsolutePath: jest.fn().mockReturnValue(resolvedPath),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("extension.ts", () => {
  let activate: (ctx: any) => void;
  let deactivate: () => Thenable<void> | undefined;

  beforeAll(() => {
    const ext = require("../extension");
    activate = ext.activate;
    deactivate = ext.deactivate;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock LanguageClient so each test gets a fresh instance tracked by MockLanguageClient
    MockLanguageClient.mockImplementation(() => ({
      start: mockStart,
      stop: mockStop,
    }));
  });

  // -------------------------------------------------------------------------
  describe("activate", () => {
    it("resolves the server module path via context.asAbsolutePath", () => {
      const ctx = makeContext();
      activate(ctx);

      expect(ctx.asAbsolutePath).toHaveBeenCalledWith(
        expect.stringContaining("server.js"),
      );
    });

    it("constructs a LanguageClient with the correct id and name", () => {
      activate(makeContext());

      expect(MockLanguageClient).toHaveBeenCalledWith(
        "languageServerExample",
        "Language Server Example",
        expect.any(Object),
        expect.any(Object),
      );
    });

    it("configures serverOptions to use IPC transport for both run and debug", () => {
      activate(makeContext("/abs/server.js"));

      const serverOptions = MockLanguageClient.mock.calls[0][2];
      expect(serverOptions.run).toEqual({
        module: "/abs/server.js",
        transport: "ipc",
      });
      expect(serverOptions.debug).toEqual({
        module: "/abs/server.js",
        transport: "ipc",
      });
    });

    it("configures clientOptions to handle plaintext and .gm files", () => {
      activate(makeContext());

      const clientOptions = MockLanguageClient.mock.calls[0][3];
      expect(clientOptions.documentSelector).toEqual(
        expect.arrayContaining([
          { scheme: "file", language: "plaintext" },
          { scheme: "file", pattern: "**/*.gm" },
        ]),
      );
    });

    it("sets up a file system watcher for .txt and .gm files", () => {
      const vscode = require("vscode");
      activate(makeContext());

      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith(
        "**/*.{txt,gm}",
      );

      const clientOptions = MockLanguageClient.mock.calls[0][3];
      expect(clientOptions.synchronize.fileEvents).toBeDefined();
    });

    it("starts the language client", () => {
      activate(makeContext());
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  describe("deactivate", () => {
    it("returns undefined when the client was never activated", () => {
      // Import a fresh copy of the module so `client` is undefined
      jest.resetModules();
      MockLanguageClient.mockImplementation(() => ({
        start: mockStart,
        stop: mockStop,
      }));
      const fresh = require("../extension");

      expect(fresh.deactivate()).toBeUndefined();
      expect(mockStop).not.toHaveBeenCalled();
    });

    it("calls client.stop() and returns its promise after activation", async () => {
      const stopResult = Promise.resolve();
      mockStop.mockReturnValue(stopResult);

      activate(makeContext());
      const result = deactivate();

      expect(mockStop).toHaveBeenCalledTimes(1);
      expect(result).toBe(stopResult);
      await result;
    });
  });
});
