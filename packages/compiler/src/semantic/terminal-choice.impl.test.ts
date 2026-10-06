import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { analyzeProject } from "../frontend/service.js";
import type { ProjectSnapshot } from "../project/types.js";
import { buildSemanticProgram } from "./lower.js";

/** Exercise source CFG construction without assembler or filesystem fixtures. */
function lowerSource(text: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const target = "c64-pal-prg-kernal-6581";
  const snapshot: ProjectSnapshot = {
    manifest: {
      schemaVersion: 1,
      name: "terminal-choice",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    },
    manifestSource: {
      sourceId: "blend65.json",
      text: "{}",
      sha256: hash("{}"),
      byteLength: 2,
      resolvedPath: "/probe/blend65.json",
    },
    sources: [
      {
        sourceId: "src/game.blend",
        text,
        sha256: hash(text),
        byteLength: Buffer.byteLength(text),
        resolvedPath: "/probe/src/game.blend",
      },
    ],
    inputSha256: hash(text),
    projectRoot: "/probe",
    sourceRoot: "/probe/src",
    assetPaths: [],
    outDir: "/probe/out",
    overrides: { target: null, entry: null },
    effectiveTarget: target,
    effectiveEntry: "Game",
  };
  const analysis = analyzeProject(snapshot);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error("Expected completed semantic construction");
  const fn = semantic.program.functions.find(({ name }) => name === "Game.H");
  if (fn === undefined) throw new Error("Missing helper");
  return fn.blocks.flatMap(({ operations }) => operations);
}

/** Keep the selected target local unless a test explicitly changes that boundary. */
function source(body: string, right = "while (true) {}", left = "while (true) {}") {
  return `module Game;
function left(): void { ${left} }
function right(): void { ${right} }
function H(): void {
  ${body}
}
function main(): void { H(); }
`;
}

const choice = "let target: fn(): void = peek($c012) != 0 ? &left : &right;";

describe("terminal callback CFG construction", () => {
  it("sinks only the immediate terminal call and removes its obsolete local and merge", () => {
    const operations = lowerSource(source(`${choice} target();`));
    expect(operations.filter(({ kind }) => kind === "call")).toHaveLength(2);
    expect(
      operations.some(({ kind }) =>
        ["merge", "load", "store", "function-address", "indirect-call"].includes(kind),
      ),
    ).toBe(false);
    expect(operations.filter(({ kind }) => kind === "memory-read")).toHaveLength(1);
  });

  it("retains the ordered volatile prefix before the original condition", () => {
    const operations = lowerSource(source(`poke($c011, 5); ${choice} target();`));
    const kinds = operations.map(({ kind }) => kind);
    expect(kinds.indexOf("memory-write")).toBeLessThan(kinds.indexOf("memory-read"));
    expect(operations.filter(({ kind }) => kind === "call")).toHaveLength(2);
  });

  it.each([
    ["returning alternative", `${choice} target();`, "", "while (true) {}"],
    [
      "intervening volatile write",
      `${choice} poke($c011, 5); target();`,
      "while (true) {}",
      "while (true) {}",
    ],
    [
      "explicit machine barrier",
      `${choice} asm_nop(); target();`,
      "while (true) {}",
      "while (true) {}",
    ],
    [
      "additional function-value copy",
      `${choice} let copy: fn(): void = target; target();`,
      "while (true) {}",
      "while (true) {}",
    ],
    [
      "observed numeric identity",
      `${choice} pokew($c020, word(target)); target();`,
      "while (true) {}",
      "while (true) {}",
    ],
    [
      "effectful terminal leaf",
      `${choice} target();`,
      "while (true) {}",
      "while (true) { poke($c013, 1); }",
    ],
  ])("keeps the existing function-value path for %s", (_name, body, right, left) => {
    const operations = lowerSource(source(body, right, left));
    expect(operations.filter(({ kind }) => kind === "indirect-call")).toHaveLength(1);
    expect(operations.some(({ kind }) => kind === "merge")).toBe(true);
  });

  it("does not sink argument-bearing calls or change argument evaluation", () => {
    const operations = lowerSource(`module Game;
function left(value: byte): void { while (true) {} }
function right(value: byte): void { while (true) {} }
function H(): void { let target: fn(byte): void = peek($c012) != 0 ? &left : &right; target(peek($c013)); }
function main(): void { H(); }`);
    expect(operations.filter(({ kind }) => kind === "indirect-call")).toHaveLength(1);
    expect(operations.filter(({ kind }) => kind === "memory-read")).toHaveLength(2);
  });
});
