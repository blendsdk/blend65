import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

// These source fixtures supplement the independently asserted canonical messages and primary sites.
const cases = [
  { code: "E10001", source: "" },
  { code: "E10002", source: "module Game; module Other;", related: ["module Game;"] },
  { code: "E10010", source: "module Game; poke(1,2);" },
  { code: "E10150", source: "module Game; let x = 1;" },
  { code: "E10170", source: "module Game; function f() {}" },
  { code: "E10224", source: "module Game; type Thing = byte;" },
  {
    code: "E10031",
    source: "module Game; zeropage { const BAD: byte = 1; good: byte; } function main(): void {}",
  },
  {
    code: "E10033",
    source: "module Game; zeropage { let BAD: byte; good: byte; } function main(): void {}",
  },
  { code: "E10212", body: "let peek: byte = 1;" },
  { code: "E10217", source: 'module Game; const TEXT: byte[] = "A\nx' },
  { code: "E10218", source: 'module Game; const TEXT: byte[] = "HELLO' },
  { code: "E10239", body: "poke($0400, absent);" },
  { code: "E10171", body: "poke($0400);" },
  { code: "E10160", body: "const ratio: byte = 7 / 0; poke($0400, ratio);" },
  { code: "E10154", body: "let ordered: boolean = true < false; if (ordered) {}" },
  { code: "E10203", body: "poke($0400, byte(length(7)));" },
  {
    code: "E10096",
    declarations: "struct Pair { first: byte; second: byte; }",
    body: "let item: Pair = { first: 1 };",
    related: ["second"],
  },
  {
    code: "E10097",
    declarations: "struct Pair { first: byte; second: byte; }",
    body: "let item: Pair = { second: 2, first: 1 };",
    related: ["first"],
  },
  { code: "E10112", body: "let values: byte[1] = [1, 2];" },
  { code: "E10113", body: "const values: byte[2] = [1];" },
  { code: "E10114", body: "let values: byte[] = [1; 0];" },
  { code: "E10116", body: 'let values: byte[] = ["hi", 1];' },
  {
    code: "E10121",
    body: "let left: byte[1] = [1]; let right: byte[1] = [1]; if (left == right) {}",
  },
  { code: "E10124", body: 'let text: byte[1] = "HI";' },
  {
    code: "E10240",
    body: "let values: byte[2] = [1, 2]; poke($0400, values[2]);",
    related: ["values"],
  },
  {
    code: "E10242",
    declarations: "struct Pair { first: byte; }",
    body: "let item: Pair = { first: 1 }; poke($0400, item.missing);",
    related: ["Pair"],
  },
  {
    code: "E10243",
    declarations: "struct Pair { first: byte; }",
    body: "let item: Pair = { first: 1, missing: 2 };",
    related: ["Pair"],
  },
  { code: "E10263", body: "let values: byte[2] = [1, 2]; poke($0400, values[true]);" },
  {
    code: "E10094",
    declarations:
      "struct Pair { value: byte; } const ITEM: Pair = { value: 1 }; function update(item: Pair): void { item.value = 2; }",
    body: "update(ITEM);",
    related: ["ITEM", "item"],
  },
  {
    code: "E10231",
    declarations: "enum Mode { On }",
    body: "let value: Mode = Mod.On;",
    related: ["Mode"],
    optionalRelated: true,
  },
  {
    code: "E10247",
    declarations: "import { setIRQ } from c64.system;",
    body: "let address: word = peekw($0400); setIRQ(address);",
  },
  {
    code: "W10070",
    body: "let value: word = peekw($0400); switch (value) { case 1: poke($0401, 1); case 2: poke($0401, 2); }",
  },
  { code: "W10100", body: "let value: sbyte = sbyte(127) + sbyte(1); poke($0400, byte(value));" },
  {
    code: "W10111",
    declarations:
      "struct Triple { a: byte; b: byte; c: byte; } let values: Triple[2] = [{ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 }];",
    body: "let index: byte = peek($0400); poke($0401, values[index].a);",
  },
  {
    code: "W10112",
    declarations:
      "struct Pair { value: byte; } function update(left: Pair, right: Pair): void { left.value = 1; right.value = 2; }",
    body: "let item: Pair = { value: 0 }; update(item, item);",
    related: ["left", "right"],
  },
  { code: "W10130", body: "if (false) { poke($0400, 1); }" },
  { code: "W10131", body: "return; poke($0400, 1);" },
  {
    code: "W10160",
    body: "let input: byte = peek($0400); let value: word = input + 1; pokew($0402, value);",
  },
  { code: "W10181", declarations: "function unused(): void {}", body: "" },
  { code: "W10191", body: "let unused: byte = 1;" },
] as const;

describe("complete auxiliary fields of source diagnostic records", () => {
  // Related declarations explain nonlocal constraints; self-contained roots have no invented sites.
  it.each(cases)("should complete the public fields of $code", async (testCase) => {
    const source =
      "source" in testCase
        ? testCase.source
        : `module Game; ${"declarations" in testCase ? testCase.declarations : ""} function main(): void { ${testCase.body} }`;
    const result = await analyzeDiagnosticSource(source);
    const records = result.diagnostics.filter(({ code }) => code === testCase.code);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      code: testCase.code,
      severity: testCase.code.startsWith("W") ? "warning" : "error",
      pointer: null,
    });
    const expectedRelated =
      "related" in testCase ? testCase.related.map((proof) => diagnosticSpan(source, proof)) : [];
    const actualRelated = records[0]?.related.map(({ span }) => span);
    if ("optionalRelated" in testCase) {
      expect([[], expectedRelated]).toContainEqual(actualRelated);
    } else {
      expect(actualRelated).toHaveLength(expectedRelated.length);
      expect(actualRelated).toEqual(expect.arrayContaining(expectedRelated));
    }
    expect(records[0]?.help === null || typeof records[0]?.help === "string").toBe(true);
  });

  // The second declaration is the proving site and the first declaration explains the collision.
  it("should complete E10003 with a previous same-scope declaration", async () => {
    const source =
      "module Game; function main(): void { let value: byte = 1; let value: byte = 2; }";
    const result = await analyzeDiagnosticSource(source);
    const records = result.diagnostics.filter(({ code }) => code === "E10003");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      code: "E10003",
      severity: "error",
      pointer: null,
      primarySpan: diagnosticSpan(source, "value", 1),
      message: `Duplicate declaration 'value' in the same scope — also declared at src/game.blend:1:${source.indexOf("value") + 1}`,
    });
    expect(records[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "value")]);
  });

  // Two blocks in one source exercise the same module-wide uniqueness rule without virtual sources.
  it("should complete E10030 with the first zeropage declaration", async () => {
    const source =
      "module Game; zeropage { first: byte; } zeropage { second: byte; } function main(): void {}";
    const result = await analyzeDiagnosticSource(source);
    const records = result.diagnostics.filter(({ code }) => code === "E10030");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      code: "E10030",
      severity: "error",
      pointer: null,
      primarySpan: diagnosticSpan(source, "zeropage", 1),
      message: "Only one 'zeropage' block is allowed per module — combine the declarations",
    });
    expect(records[0]?.related.map(({ span }) => span)).toEqual([
      diagnosticSpan(source, "zeropage"),
    ]);
  });
});
