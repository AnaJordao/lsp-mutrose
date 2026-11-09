import { TextDocument } from "vscode-languageserver-textdocument";
import { DiagnosticSeverity } from "vscode-languageserver";

jest.mock("vscode-languageserver/node", () => {
  const actual = jest.requireActual("vscode-languageserver/node");
  return {
    ...actual,
    createConnection: jest.fn(() => ({
      onInitialize: jest.fn(),
      onCompletion: jest.fn(),
      onCompletionResolve: jest.fn(),
      onDefinition: jest.fn(),
      onDocumentSymbol: jest.fn(),
      onHover: jest.fn(),
      sendDiagnostics: jest.fn(),
      listen: jest.fn(),
    })),
    TextDocuments: jest.fn().mockImplementation(() => ({
      onDidOpen: jest.fn(),
      onDidChangeContent: jest.fn(),
      get: jest.fn(),
      listen: jest.fn(),
    })),
  };
});

import {
  extractTaskId,
  extractTaskName,
  parseHddlTasks,
  ResolvedConfiguration,
  ResolvedHddl,
} from "../auxiliarFunctions/getFunctions";
import {
  auxiliarValidateGmNode,
  auxiliarValidateGmFile,
  findNodeTextRange,
} from "../auxiliarFunctions/validationFunctions";
import { GmNode } from "../interfaces";
import * as path from "path";
import * as fs from "fs";

describe("Task validation and binding", () => {
  describe("extractTaskId", () => {
    it("extracts task ID from standard task names", () => {
      expect(extractTaskId("AT1: WipeTable")).toBe("AT1");
      expect(extractTaskId("AT2: TakeOffDishes")).toBe("AT2");
      expect(extractTaskId("AT10: LeadClientToTable")).toBe("AT10");
      expect(extractTaskId("at3: lower case")).toBe("AT3");
      expect(extractTaskId("AT4")).toBe("AT4");
      expect(extractTaskId("  AT5: With Spaces  ")).toBe("AT5");
    });

    it("returns null for task names without AT<number> prefix", () => {
      expect(extractTaskId("WipeTable")).toBeNull();
      expect(extractTaskId("G1: Goal Name")).toBeNull();
      expect(extractTaskId("A1: Single A")).toBeNull();
      expect(extractTaskId("")).toBeNull();
    });
  });

  describe("extractTaskName", () => {
    it("extracts task name from standard task text", () => {
      expect(extractTaskName("AT1: WipeTable")).toBe("WipeTable");
      expect(extractTaskName("AT2: ApproachNurse")).toBe("ApproachNurse");
      expect(extractTaskName("AT3: clean-table")).toBe("clean-table");
      expect(extractTaskName("AT4 : SpacedName")).toBe("SpacedName");
    });

    it("returns null when no task name follows the colon", () => {
      expect(extractTaskName("AT1:")).toBeNull();
      expect(extractTaskName("AT1: ")).toBeNull();
      expect(extractTaskName("AT1")).toBeNull();
      expect(extractTaskName("")).toBeNull();
      expect(extractTaskName("JustATaskName")).toBeNull();
    });
  });

  describe("parseHddlTasks", () => {
    it("extracts all task definitions from HDDL content", () => {
      const hddl = `
        (define (domain test)
          (:task WipeTable :parameters (?r - robot ?t - table))
          (:task TakeOffDishes :parameters (?r - robot ?t - table))
          (:action navto :parameters (?r - robot ?l - location))
        )
      `;
      const { tasks, taskLookup } = parseHddlTasks(hddl);
      expect(tasks.has("WipeTable")).toBe(true);
      expect(tasks.has("TakeOffDishes")).toBe(true);
      expect(tasks.has("navto")).toBe(false);
      expect(taskLookup.get("wipetable")).toBe("WipeTable");
    });
  });

  describe("findNodeTextRange", () => {
    it("locates the range of the text property inside the node", () => {
      const json = JSON.stringify(
        {
          id: "node-1",
          text: "AT1: WipeTable",
          type: "istar.Task",
        },
        null,
        2,
      );

      const range = findNodeTextRange("node-1", json);
      expect(range).not.toBeNull();
      expect(range!.startLine).toBeGreaterThan(0);
      expect(range!.endLine).toBe(range!.startLine);

      // Verify the slice in the json matches the text
      const lines = json.split("\n");
      const textLine = lines[range!.startLine];
      const slice = textLine.substring(range!.startChar, range!.endChar);
      expect(slice).toBe("AT1: WipeTable");
    });
  });

  describe("auxiliarValidateGmNode task binding", () => {
    const mockClassAttributes = new Map<string, Set<string>>();
    const mockConfig: ResolvedConfiguration = {
      path: "/fake/path/configuration.json",
      taskIds: new Set(["AT1", "AT2", "AT3"]),
      config: {
        var_mapping: [{ task_id: "AT1" }, { task_id: "AT2" }, { task_id: "AT3" }],
      },
    };

    it("reports no diagnostics when task ID matches configuration binding", () => {
      const node: GmNode = {
        id: "task-1",
        text: "AT1: WipeTable",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const json = JSON.stringify(node, null, 2);
      const diagnostics: any[] = [];
      const seenTaskIds = new Set<string>();

      auxiliarValidateGmNode(
        node,
        json,
        diagnostics,
        mockClassAttributes,
        mockConfig,
        seenTaskIds,
      );

      expect(diagnostics).toHaveLength(0);
      expect(seenTaskIds.has("AT1")).toBe(true);
    });

    it("reports error when task ID does not exist in configuration binding", () => {
      const node: GmNode = {
        id: "task-99",
        text: "AT99: UnknownTask",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const json = JSON.stringify(node, null, 2);
      const diagnostics: any[] = [];

      auxiliarValidateGmNode(
        node,
        json,
        diagnostics,
        mockClassAttributes,
        mockConfig,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toContain("AT99");
      expect(diagnostics[0].message).toContain("does not match any binding in configuration.json");
      expect(diagnostics[0].data).toEqual({ nodeId: "task-99" });
    });

    it("reports error when task text does not have a valid AT<number> format", () => {
      const node: GmNode = {
        id: "task-bad-format",
        text: "InvalidTaskNameWithoutPrefix",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const json = JSON.stringify(node, null, 2);
      const diagnostics: any[] = [];

      auxiliarValidateGmNode(
        node,
        json,
        diagnostics,
        mockClassAttributes,
        mockConfig,
      );

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toContain("must start with a valid task ID prefix");
      expect(diagnostics[0].data).toEqual({ nodeId: "task-bad-format" });
    });

    it("reports error on duplicate task IDs in the same goal model", () => {
      const node1: GmNode = {
        id: "task-1",
        text: "AT1: FirstTask",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const node2: GmNode = {
        id: "task-2",
        text: "AT1: DuplicateTask",
        type: "istar.Task",
        x: 200,
        y: 200,
        customProperties: {},
      };
      const json = JSON.stringify([node1, node2], null, 2);
      const diagnostics: any[] = [];
      const seenTaskIds = new Set<string>();

      auxiliarValidateGmNode(
        node1,
        json,
        diagnostics,
        mockClassAttributes,
        mockConfig,
        seenTaskIds,
      );
      expect(diagnostics).toHaveLength(0);

      auxiliarValidateGmNode(
        node2,
        json,
        diagnostics,
        mockClassAttributes,
        mockConfig,
        seenTaskIds,
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics[0].message).toContain("Duplicate task ID 'AT1'");
      expect(diagnostics[0].data).toEqual({ nodeId: "task-2" });
    });

    it("validates task name against HDDL definitions", () => {
      const mockHddl: ResolvedHddl = {
        path: "/fake/path/domain.hddl",
        tasks: new Set(["WipeTable", "TakeOffDishes"]),
        taskLookup: new Map([
          ["wipetable", "WipeTable"],
          ["takeoffdishes", "TakeOffDishes"],
        ]),
      };

      const validNode: GmNode = {
        id: "task-valid-hddl",
        text: "AT1: WipeTable",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const validJson = JSON.stringify(validNode, null, 2);
      const diagnostics1: any[] = [];

      auxiliarValidateGmNode(
        validNode,
        validJson,
        diagnostics1,
        mockClassAttributes,
        mockConfig,
        undefined,
        mockHddl,
      );
      expect(diagnostics1).toHaveLength(0);

      const invalidNode: GmNode = {
        id: "task-invalid-hddl",
        text: "AT1: UnknownHddlTask",
        type: "istar.Task",
        x: 100,
        y: 100,
        customProperties: {},
      };
      const invalidJson = JSON.stringify(invalidNode, null, 2);
      const diagnostics2: any[] = [];

      auxiliarValidateGmNode(
        invalidNode,
        invalidJson,
        diagnostics2,
        mockClassAttributes,
        mockConfig,
        undefined,
        mockHddl,
      );
      expect(diagnostics2).toHaveLength(1);
      expect(diagnostics2[0].severity).toBe(DiagnosticSeverity.Error);
      expect(diagnostics2[0].message).toContain("Task 'UnknownHddlTask' does not exist in HDDL domain definition");
      expect(diagnostics2[0].data).toEqual({ nodeId: "task-invalid-hddl" });
    });
  });

  describe("auxiliarValidateGmFile with real workspace files", () => {
    it("validates RoboticRestaurant manageRestaurant.gm against its configuration.json and HDDL", () => {
      const gmPath = path.resolve(
        __dirname,
        "../../../examples/RoboticRestaurant/gm/manageRestaurant.gm",
      );

      if (fs.existsSync(gmPath)) {
        const text = fs.readFileSync(gmPath, "utf8");
        const doc = TextDocument.create(
          `file://${gmPath}`,
          "plaintext",
          1,
          text,
        );

        const diags = auxiliarValidateGmFile(doc);
        // The real manageRestaurant.gm has tasks AT1 to AT7 which all match configuration.json and restaurant.hddl
        const taskErrors = diags.filter(
          (d) =>
            d.message.includes("does not match any binding in configuration.json") ||
            d.message.includes("must start with a valid task ID prefix") ||
            d.message.includes("does not exist in HDDL domain definition"),
        );
        expect(taskErrors).toHaveLength(0);
      }
    });

    it("detects task missing from HDDL when file is validated", () => {
      const gmPath = path.resolve(
        __dirname,
        "../../../examples/RoboticRestaurant/gm/manageRestaurant.gm",
      );

      if (fs.existsSync(gmPath)) {
        const gmContent = {
          actors: [
            {
              id: "actor-1",
              text: "Actor",
              type: "istar.Actor",
              nodes: [
                {
                  id: "task-missing-hddl",
                  text: "AT1: TaskNotInHddl",
                  type: "istar.Task",
                  x: 10,
                  y: 10,
                  customProperties: {},
                },
              ],
            },
          ],
          orphans: [],
        };

        const doc = TextDocument.create(
          `file://${gmPath}`,
          "plaintext",
          1,
          JSON.stringify(gmContent, null, 2),
        );

        const diags = auxiliarValidateGmFile(doc);
        const hddlDiag = diags.find((d) =>
          d.message.includes("Task 'TaskNotInHddl' does not exist in HDDL domain definition"),
        );

        expect(hddlDiag).toBeDefined();
        expect(hddlDiag!.severity).toBe(DiagnosticSeverity.Error);
        expect((hddlDiag as any).data).toEqual({
          nodeId: "task-missing-hddl",
        });
      }
    });

    it("detects unbound task in a document when configuration is present", () => {
      const gmPath = path.resolve(
        __dirname,
        "../../../examples/RoboticRestaurant/gm/manageRestaurant.gm",
      );

      if (fs.existsSync(gmPath)) {
        const gmContent = {
          actors: [
            {
              id: "actor-1",
              text: "Actor",
              type: "istar.Actor",
              nodes: [
                {
                  id: "task-valid",
                  text: "AT1: WipeTable",
                  type: "istar.Task",
                  x: 10,
                  y: 10,
                  customProperties: {},
                },
                {
                  id: "task-wrong-binding",
                  text: "AT88: NonExistentTask",
                  type: "istar.Task",
                  x: 20,
                  y: 20,
                  customProperties: {},
                },
              ],
            },
          ],
          orphans: [],
        };

        const doc = TextDocument.create(
          `file://${gmPath}`,
          "plaintext",
          1,
          JSON.stringify(gmContent, null, 2),
        );

        const diags = auxiliarValidateGmFile(doc);
        const wrongBindingDiag = diags.find((d) => d.message.includes("AT88"));

        expect(wrongBindingDiag).toBeDefined();
        expect(wrongBindingDiag!.severity).toBe(DiagnosticSeverity.Error);
        expect((wrongBindingDiag as any).data).toEqual({
          nodeId: "task-wrong-binding",
        });
      }
    });
  });
});
