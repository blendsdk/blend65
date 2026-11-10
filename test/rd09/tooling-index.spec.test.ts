import { describe, expect, it } from "vitest";
import {
  analyzeProjectOverlay,
  buildToolingIndex,
  completionAt,
  documentSymbols,
  hoverAt,
  loadProject,
  referencesFor,
  renameEdits,
  semanticTokenFacts,
  signatureAt,
  symbolAt,
  visibleSymbols,
  workspaceSymbols,
} from "@blend65/compiler/frontend";
import type { AnalysisResult, SourceSpan, ToolingIndex } from "@blend65/compiler/frontend";
import { withProject } from "../rd06/project-fixture.js";

const SOURCE = [
  "module Game;",
  "",
  "struct Point { x: byte; y: byte; }",
  "enum Mode { idle = 0, run = 1 }",
  "",
  "let globalCounter: byte = 3;",
  "const LIMIT: byte = 10;",
  "",
  "function add(a: byte, b: byte): byte {",
  "    let sum: byte = a + b;",
  "    if (sum > LIMIT) {",
  "        let sum: byte = 0;",
  "        return sum;",
  "    }",
  "    return sum;",
  "}",
  "",
  "function main(): void {",
  "    let p: Point = { x: 1, y: 2 };",
  "    p.x = add(p.x, globalCounter);",
  "}",
  "",
].join("\n");

/** Convert one exact source substring to a UTF-8 byte span. */
function span(
  source: string,
  proof: string,
  sourceId = "src/game.blend",
  occurrence = 0,
): SourceSpan {
  let index = -1;
  for (let n = 0; n <= occurrence; n += 1) index = source.indexOf(proof, index + 1);
  if (index < 0) throw new Error(`Missing source proof: ${proof}`);
  const start = Buffer.byteLength(source.slice(0, index));
  return { sourceId, start, end: start + Buffer.byteLength(proof) };
}

/** Convert one exact source substring to a cursor offset. */
function at(
  source: string,
  proof: string,
  sourceId = "src/game.blend",
  occurrence = 0,
): { sourceId: string; offset: number } {
  const target = span(source, proof, sourceId, occurrence);
  return { sourceId, offset: target.start };
}

/** Analyze a real temporary project and return its admitted result. */
async function analyzed(source: string): Promise<AnalysisResult> {
  return withProject(source, [], async (project) => {
    const loaded = await loadProject({ project });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    return analyzeProjectOverlay(loaded.snapshot, []);
  });
}

/** Build a tooling index or fail with the analysis diagnostics. */
async function indexed(source: string): Promise<ToolingIndex> {
  const result = await analyzed(source);
  if (result.kind === "error") throw new Error(JSON.stringify(result.diagnostics));
  const index = buildToolingIndex(result);
  if (index === null) throw new Error("Expected a tooling index");
  return index;
}

describe("frontend tooling index", () => {
  // One symbol per declaration with stable identity, exact spans, and deterministic order.
  it("should derive module, function, parameter, local, constant, struct, enum, and field symbols", async () => {
    const index = await indexed(SOURCE);
    const names = index.symbols.map(({ name }) => name);
    for (const expected of [
      "Game",
      "Point",
      "x",
      "y",
      "Mode",
      "idle",
      "run",
      "globalCounter",
      "LIMIT",
      "add",
      "a",
      "b",
      "sum",
      "main",
      "p",
    ]) {
      expect(names, `missing symbol ${expected}`).toContain(expected);
    }
    expect(index.symbols.filter(({ name }) => name === "sum")).toHaveLength(2);
    for (const symbol of index.symbols) {
      expect(symbol.nameSpan.sourceId).toBe("src/game.blend");
      expect(symbol.nameSpan.start).toBeGreaterThanOrEqual(symbol.declaration.start);
      expect(symbol.nameSpan.end).toBeLessThanOrEqual(symbol.declaration.end);
    }
    for (let position = 1; position < index.symbols.length; position += 1) {
      expect(index.symbols[position]!.declaration.start).toBeGreaterThanOrEqual(
        index.symbols[position - 1]!.declaration.start,
      );
    }
  });

  // A source position resolves to exactly the semantic declaration, including references.
  it("should resolve declaration and reference positions to the same stable symbol", async () => {
    const index = await indexed(SOURCE);
    const declaration = symbolAt(index, at(SOURCE, "globalCounter"));
    const reference = symbolAt(index, at(SOURCE, "globalCounter", "src/game.blend", 1));
    expect(declaration?.name).toBe("globalCounter");
    expect(reference?.id).toBe(declaration?.id);
  });

  // Nested shadowing keeps inner and outer bindings distinct and visible only in scope.
  it("should keep same-spelling shadowed bindings distinct before, inside, and after the inner block", async () => {
    const index = await indexed(SOURCE);
    const outerDeclaration = span(SOURCE, "sum");
    const innerDeclaration = span(SOURCE, "sum", "src/game.blend", 2);
    const insideUse = span(SOURCE, "sum", "src/game.blend", 3);
    const afterUse = span(SOURCE, "sum", "src/game.blend", 4);
    const outer = symbolAt(index, at(SOURCE, "sum"));
    const inner = symbolAt(index, at(SOURCE, "sum", "src/game.blend", 2));
    expect(outer?.id).not.toBe(inner?.id);
    expect(symbolAt(index, at(SOURCE, "sum", "src/game.blend", 3))?.id).toBe(inner?.id);
    expect(symbolAt(index, at(SOURCE, "sum", "src/game.blend", 4))?.id).toBe(outer?.id);
    expect(
      visibleSymbols(index, "src/game.blend", innerDeclaration.start).map(({ id }) => id),
    ).toContain(inner?.id);
    expect(visibleSymbols(index, "src/game.blend", afterUse.start).map(({ id }) => id)).toContain(
      outer?.id,
    );
    expect(
      visibleSymbols(index, "src/game.blend", afterUse.start).map(({ id }) => id),
    ).not.toContain(inner?.id);
  });

  // Field references resolve to the field declaration, not to a same-spelled local.
  it("should resolve struct field definitions and references through a typed member expression", async () => {
    const index = await indexed(SOURCE);
    const field = index.symbols.find(({ name, kind }) => name === "x" && kind === "field");
    expect(field).toBeDefined();
    const reference = symbolAt(index, at(SOURCE, "x", "src/game.blend", 1));
    expect(reference?.id).toBe(field?.id);
    expect(referencesFor(index, field!.id, true).length).toBeGreaterThanOrEqual(2);
  });

  // Poisoned declarations never become editor facts, while a valid neighbour still resolves.
  it("should exclude poisoned declarations and keep valid nearby facts", async () => {
    const poisoned = [
      "module Game;",
      "",
      "let ok: byte = 1;",
      "function broken(): void { let bad: = 2; }",
      "",
    ].join("\n");
    const result = await analyzed(poisoned);
    expect(result.kind).not.toBe("complete");
    expect(result.kind === "error" ? null : buildToolingIndex(result)).toBeNull();
  });

  // Completion is context-aware and excludes symbols that are not visible at the cursor.
  it("should offer visible symbols, member fields, and no out-of-scope local", async () => {
    const index = await indexed(SOURCE);
    const functionBody = SOURCE.indexOf("let p: Point");
    const at = Buffer.byteLength(SOURCE.slice(0, functionBody));
    const candidates = completionAt(index, "src/game.blend", at, {});
    const labels = candidates.map(({ label }) => label);
    expect(labels).toContain("globalCounter");
    expect(labels).toContain("add");
    expect(labels).toContain("Point");
    expect(labels).not.toContain("sum");

    const memberStart = SOURCE.indexOf("p.x = add");
    const afterDot = Buffer.byteLength(SOURCE.slice(0, memberStart + 2));
    const members = completionAt(index, "src/game.blend", afterDot, {});
    expect(members.map(({ label }) => label).sort()).toEqual(["x", "y"]);
  });

  // Hover and signature help report proved facts, not guessed final addresses.
  it("should report exact hover and signature facts", async () => {
    const index = await indexed(SOURCE);
    const add = symbolAt(index, at(SOURCE, "add"));
    expect(add).not.toBeNull();
    const hover = hoverAt(index, add!.id);
    expect(hover.markdown).toContain("function");
    expect(hover.markdown).toContain("add");
    expect(hover.markdown).not.toMatch(/\$[0-9A-Fa-f]{4}/);

    const call = SOURCE.indexOf("add(p.x, globalCounter)");
    const argumentOffset = Buffer.byteLength(SOURCE.slice(0, call + "add(p.x, ".length));
    const signature = signatureAt(index, "src/game.blend", argumentOffset);
    expect(signature).not.toBeNull();
    expect(signature!.activeParameter).toBe(1);
    expect(signature!.parameters.map(({ type }) => type)).toEqual(["byte", "byte"]);
    expect(signature!.returnType).toBe("byte");
  });

  // Rename edits every semantic reference and preserves shadowed same-spelling bindings.
  it("should rename a user-owned symbol without touching a shadowed binding", async () => {
    const index = await indexed(SOURCE);
    const outer = symbolAt(index, at(SOURCE, "sum"));
    const inner = symbolAt(index, at(SOURCE, "sum", "src/game.blend", 2));
    expect(outer).not.toBeNull();
    const renamed = renameEdits(index, outer!.id, "total");
    expect(renamed.kind).toBe("edits");
    if (renamed.kind !== "edits") return;
    expect(renamed.edits.length).toBe(3);
    expect(renamed.edits.some(({ span: target }) => target.start === inner!.nameSpan.start)).toBe(
      false,
    );
  });

  it("should reject a rename that would be captured by a nested binding", async () => {
    const source = [
      "module Game;",
      "",
      "function main(): void {",
      "    let i: byte = 1;",
      "    if (i > 0) {",
      "        let j: byte = 2;",
      "        i = j;",
      "    }",
      "}",
      "",
    ].join("\n");
    const index = await indexed(source);
    const symbol = symbolAt(index, at(source, "i: byte"));
    expect(symbol).not.toBeNull();
    expect(renameEdits(index, symbol!.id, "j").kind).toBe("rejected");
  });

  it("should resolve a struct-literal field label to the field, not a value token", async () => {
    const source = [
      "module Game;",
      "",
      "struct P { a: byte; b: byte; }",
      "function main(): void {",
      "    let b: byte = 1;",
      "    let p: P = { a: b, b: 2 };",
      "}",
      "",
    ].join("\n");
    const index = await indexed(source);
    const field = index.symbols.find(({ name, kind }) => name === "b" && kind === "field");
    const label = symbolAt(index, at(source, "b: 2"));
    expect(field).toBeDefined();
    expect(label?.id).toBe(field?.id);
  });

  it("should expose a for-loop initializer variable as a local symbol", async () => {
    const source = [
      "module Game;",
      "",
      "function main(): void {",
      "    for (let i: byte = 0; i < 2; i += 1) {",
      "    }",
      "}",
      "",
    ].join("\n");
    const index = await indexed(source);
    const symbol = symbolAt(index, at(source, "i: byte"));
    expect(symbol?.name).toBe("i");
    expect(symbol?.kind).toBe("local");
    expect(referencesFor(index, symbol!.id, true).length).toBeGreaterThanOrEqual(3);
  });

  it("should rename a user-owned struct field and reject a sibling collision", async () => {
    const index = await indexed(SOURCE);
    const field = index.symbols.find(({ name, kind }) => name === "x" && kind === "field");
    expect(field).toBeDefined();
    const renamed = renameEdits(index, field!.id, "z");
    expect(renamed.kind).toBe("edits");
    if (renamed.kind === "edits") expect(renamed.edits.length).toBe(4);
    expect(renameEdits(index, field!.id, "y").kind).toBe("rejected");
  });

  it("should keep installed-library sources outside the rename source set", async () => {
    const index = await indexed(SOURCE);
    expect(index.sources.find(({ sourceId }) => sourceId.startsWith("@blend65/"))?.installed).toBe(
      true,
    );
    const symbol = symbolAt(index, at(SOURCE, "globalCounter"));
    expect(symbol).not.toBeNull();
    const renamed = renameEdits(index, symbol!.id, "renamed");
    expect(renamed.kind).toBe("edits");
    if (renamed.kind === "edits") {
      expect(renamed.edits.every(({ sourceId }) => sourceId === "src/game.blend")).toBe(true);
    }
  });

  // Document/workspace symbols preserve source order and the documented result bound.
  it("should return ordered document symbols and bounded workspace symbols", async () => {
    const index = await indexed(SOURCE);
    const symbols = documentSymbols(index, "src/game.blend");
    expect(symbols.map(({ name }) => name)).toEqual([
      "Game",
      "Point",
      "Mode",
      "globalCounter",
      "LIMIT",
      "add",
      "main",
    ]);
    const point = symbols.find(({ name }) => name === "Point");
    expect(point?.children?.map(({ name }) => name)).toEqual(["x", "y"]);
    const add = symbols.find(({ name }) => name === "add");
    expect(add?.children?.map(({ name }) => name)).toEqual(["a", "b", "sum", "sum"]);
    expect(workspaceSymbols(index, "global", 100).map(({ name }) => name)).toEqual([
      "globalCounter",
    ]);
    expect(workspaceSymbols(index, "", 3)).toHaveLength(3);
  });

  // Semantic tokens classify proved references and keep exact spans.
  it("should publish semantic token facts for proved references", async () => {
    const index = await indexed(SOURCE);
    const tokens = semanticTokenFacts(index, "src/game.blend");
    expect(tokens.some(({ type }) => type === "variable")).toBe(true);
    expect(tokens.some(({ modifiers }) => modifiers.includes("declaration"))).toBe(true);
    expect(tokens.every(({ span: target }) => target.end > target.start)).toBe(true);
  });
});
