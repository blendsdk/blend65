import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { bindingIdentityKey, type BindingId } from "../frontend/semantic-types.js";
import type { SemanticBlock, SemanticFunction, SemanticProgram } from "./operations.js";
import { checkCiaOwnership } from "./cia-ownership.js";
import { checkProject } from "../index.js";

/** Check complete IRQ ownership without invoking assembly or an emulator. */
async function checkSource(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-cia-ownership-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "cia-ownership",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source);
    return await checkProject({ project: join(root, "blend65.json") });
  } finally {
    await rm(root, { recursive: true });
  }
}

/** A source return is allowed only when the selected vector and timer state remain unchanged. */
function program(body: string): string {
  return `module Game;
import { setIRQExclusive, restoreIRQ } from c64.system;
interrupt function onIRQ(): void {}
function main(): void {
  asm_php(); asm_sei();
  setIRQExclusive(&onIRQ);
  ${body}
}`;
}

/** Make two static paths per layer while keeping execution depth linear. */
function helperDiamond(nonreturning: boolean): {
  readonly program: SemanticProgram;
  readonly reachable: ReadonlySet<string>;
} {
  const ids: BindingId[] = Array.from({ length: 24 }, (_, index) => ({
    sourceId: "diamond.blend",
    span: { sourceId: "diamond.blend", start: index, end: index + 1 },
  }));
  const voidType = { kind: "scalar", name: "void" } as const;
  const functions: SemanticFunction[] = ids.map((id, index) => {
    const next = ids[index + 1];
    const blocks: SemanticBlock[] =
      next === undefined
        ? [
            {
              id: "entry",
              operations: [],
              terminator: nonreturning
                ? { kind: "jump", target: "entry" }
                : { kind: "return", value: null },
            },
          ]
        : [
            {
              id: "entry",
              operations: [],
              terminator: {
                kind: "branch",
                condition: "condition",
                whenTrue: "yes",
                whenFalse: "no",
              },
            },
            ...["yes", "no"].map((blockId) => ({
              id: blockId,
              operations: [
                {
                  kind: "call" as const,
                  result: null,
                  callee: next,
                  arguments: [],
                  type: voidType,
                  span: id.span,
                },
              ],
              terminator: { kind: "return" as const, value: null },
            })),
          ];
    return {
      id,
      parameters: [],
      result: voidType,
      entry: "entry",
      blocks,
      source: id.span,
    };
  });
  return {
    program: {
      main: ids[0]!,
      globals: [],
      functions,
      assets: [],
      initializerOrder: [],
    },
    reachable: new Set(ids.map(bindingIdentityKey)),
  };
}

describe("CIA1 ownership dataflow internals", () => {
  it("merges a possible timer mutation from either side of a branch before IRQ restore", async () => {
    const source = program(`if (peek($0400) == 0) { poke($dc04, 1); }
  else { poke($dc03, 1); }
  restoreIRQ(); asm_plp();`);
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
    expect(result.diagnostics[0]?.message).toMatch(/CIA1.*state|device state/u);
  });

  it("carries a raw ICR write around a loop until the mask is known again", async () => {
    const source = program(`c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let count: byte = peek($0400);
  while (count != 0) { poke($dc0d, 0); count -= 1; }
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);
  asm_plp(); for (;;) { asm_nop(); }`);
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
    expect(result.diagnostics[0]?.message).toMatch(/mask.*unreadable|prior source mask/u);
  });

  it("recognizes a word write whose high byte overlaps ICR", async () => {
    const source = program(`c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  pokew($dc0c, 0);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);
  asm_plp(); for (;;) { asm_nop(); }`);
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
  });

  it("does not mistake adjacent DDR writes for timer or ICR mutation", async () => {
    const result = await checkSource(program(`pokew($dc02, 0); restoreIRQ(); asm_plp();`));
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
  });

  it("retains a mirrored ICR write through a temporary chained IRQ route", async () => {
    const source = `module Game;
import { setIRQExclusive, setIRQ, restoreIRQ } from c64.system;
interrupt function firstIRQ(): void {}
interrupt function nextIRQ(): void {}
function main(): void {
  asm_php(); asm_sei();
  setIRQExclusive(&firstIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  setIRQ(&nextIRQ);
  poke($dc1d, $81);
  restoreIRQ(); asm_plp();
  for (;;) { asm_nop(); }
}`;
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
  });

  it("does not reuse a known mask after an IRQ handler can write raw ICR", async () => {
    const source = `module Game;
interrupt function onIRQ(): void {
  poke($dc0d, $81);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerB);
}
function main(): void {
  asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  asm_plp();
  for (;;) { asm_nop(); }
}`;
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
  });

  it("does not hand a live handler's newly enabled source to a chained route", async () => {
    const source = `module Game;
interrupt function firstIRQ(): void {
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerB);
}
interrupt function nextIRQ(): void {}
function main(): void {
  asm_php(); asm_sei();
  c64.system.setIRQExclusive(&firstIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  asm_plp();
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  c64.system.setIRQ(&nextIRQ);
  for (;;) { asm_nop(); }
}`;
    const result = await checkSource(source);
    expect(result.kind).toBe("failure");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toMatchObject([
      { code: "E10278", primarySpan: { sourceId: "src/game.blend" } },
    ]);
    expect(result.diagnostics[0]?.message).toMatch(/enabled CIA1 sources.*chained/u);
  });

  it("checks a shared 24-layer helper diamond without revisiting every call path", () => {
    const { program, reachable } = helperDiamond(false);
    const result = checkCiaOwnership(program, reachable, new Map(), []);
    expect(result).toEqual([]);
  }, 20_000);

  it("checks a nonreturning helper diamond without repeating every call path", () => {
    const { program, reachable } = helperDiamond(true);
    const result = checkCiaOwnership(program, reachable, new Map(), []);
    expect(result).toEqual([]);
  }, 20_000);
});
