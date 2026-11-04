import { validateQueriedProperty, validateAchieveCondition } from "../auxiliarFunctions/oclParser";

describe("validateQueriedProperty", () => {
  const classAttributes = new Map<string, Set<string>>([
    ["Delivery", new Set(["name", "pickup_location", "nurse"])],
    ["Arm", new Set(["name"])],
  ]);

  describe("whitespace rules", () => {
    it("should reject leading whitespace", () => {
      const errors = validateQueriedProperty(
        " world_db->select(a:Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errors).toContain(
        "QueriedProperty must not have leading whitespace.",
      );
    });

    it("should reject trailing whitespace", () => {
      const errors = validateQueriedProperty(
        "world_db->select(a:Arm | a.name in pharmacy_loc.arm) ",
        classAttributes,
      );
      expect(errors).toContain(
        "QueriedProperty must not have trailing whitespace.",
      );
    });

    it("should reject spaces around '->'", () => {
      const errorsBefore = validateQueriedProperty(
        "world_db ->select(a:Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errorsBefore).toContain(
        "QueriedProperty must not contain spaces before or after '->'.",
      );

      const errorsAfter = validateQueriedProperty(
        "world_db-> select(a:Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errorsAfter).toContain(
        "QueriedProperty must not contain spaces before or after '->'.",
      );
    });

    it("should reject spaces before ':'", () => {
      const errors = validateQueriedProperty(
        "world_db->select(a :Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errors).toContain(
        "QueriedProperty must not contain spaces before ':'.",
      );
    });

    it("should allow 0 or 1 space after ':'", () => {
      const errors0 = validateQueriedProperty(
        "world_db->select(a:Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errors0).toEqual([]);

      const errors1 = validateQueriedProperty(
        "world_db->select(a: Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errors1).toEqual([]);

      const errors2 = validateQueriedProperty(
        "world_db->select(a:  Arm | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errors2).toContain(
        "QueriedProperty allows at most one space after ':'.",
      );
    });

    it("should allow at most one space before and after '|'", () => {
      const errorsMultiBefore = validateQueriedProperty(
        "world_db->select(a:Arm  | a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errorsMultiBefore).toContain(
        "QueriedProperty allows at most one space before '|'.",
      );

      const errorsMultiAfter = validateQueriedProperty(
        "world_db->select(a:Arm |  a.name in pharmacy_loc.arm)",
        classAttributes,
      );
      expect(errorsMultiAfter).toContain(
        "QueriedProperty allows at most one space after '|'.",
      );
    });

    it("should allow spaces before ')'", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery | )",
        classAttributes,
      );
      expect(errors).toEqual([]);
    });
  });

  describe("select without condition", () => {
    it("should accept select with pipe and space (world_db->select(d:Delivery| ))", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery| )",
        classAttributes,
      );
      expect(errors).toEqual([]);
    });

    it("should accept select with spaces around pipe (world_db->select(d:Delivery | ))", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery | )",
        classAttributes,
      );
      expect(errors).toEqual([]);
    });

    it("should reject select without space after pipe (world_db->select(d:Delivery|))", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery|)",
        classAttributes,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain(
        "QueriedProperty must follow OCL select syntax",
      );
    });

    it("should reject select with space before pipe but not after (world_db->select(d:Delivery |))", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery |)",
        classAttributes,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain(
        "QueriedProperty must follow OCL select syntax",
      );
    });

    it("should reject select without pipe (world_db->select(d:Delivery))", () => {
      const errors = validateQueriedProperty(
        "world_db->select(d:Delivery)",
        classAttributes,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain(
        "QueriedProperty must follow OCL select syntax",
      );
    });
  });

  describe("select with condition", () => {
    it("should accept valid select with condition", () => {
      const errors = validateQueriedProperty(
        'world_db->select(d:Delivery | d.name = "Pharmacy")',
        classAttributes,
      );
      expect(errors).toEqual([]);
    });

    it("should reject select with invalid attribute in condition", () => {
      const errors = validateQueriedProperty(
        'world_db->select(d:Delivery | d.nonExistent = "value")',
        classAttributes,
      );
      expect(errors).toEqual([
        "Attribute 'nonExistent' does not belong to class 'Delivery'.",
      ]);
    });

    it("should reject invalid query variable identifier", () => {
      const errors = validateQueriedProperty(
        "world_db->select(123:Delivery| )",
        classAttributes,
      );
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain(
        "QueriedProperty must follow OCL select syntax",
      );
    });
  });
});

describe("validateAchieveCondition", () => {
  const classAttributes = new Map<string, Set<string>>([
    ["Client", new Set(["clientIsWaitingTable"])],
  ]);

  describe("whitespace rules", () => {
    it("should reject leading whitespace", () => {
      const errors = validateAchieveCondition(
        " clients_waiting_for_table->forAll(client:Client | !client.clientIsWaitingTable)",
        "clients_waiting_for_table",
        "client",
        classAttributes,
      );
      expect(errors).toContain(
        "AchieveCondition must not have leading whitespace.",
      );
    });

    it("should reject trailing whitespace", () => {
      const errors = validateAchieveCondition(
        "clients_waiting_for_table->forAll(client:Client | !client.clientIsWaitingTable) ",
        "clients_waiting_for_table",
        "client",
        classAttributes,
      );
      expect(errors).toContain(
        "AchieveCondition must not have trailing whitespace.",
      );
    });

    it("should reject spaces around '->'", () => {
      const errors = validateAchieveCondition(
        "clients_waiting_for_table ->forAll(client:Client | !client.clientIsWaitingTable)",
        "clients_waiting_for_table",
        "client",
        classAttributes,
      );
      expect(errors).toContain(
        "AchieveCondition must not contain spaces before or after '->'.",
      );
    });
  });
});

