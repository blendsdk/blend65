import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { literalResolver, valueDefinitions } from "../semantic/aggregate-place-proof.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type {
  BinaryOperation,
  MemoryReadOperation,
  SemanticFunction,
  SemanticOperation,
} from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import {
  canOmitComparisonCaptureReload,
  hasUnobservedByteCapture,
} from "./byte-capture-observers.js";
import { functionValueUses } from "./lower-state.js";
import type { MachineLoweringInput } from "./machine-types.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";
import {
  boundedCounterLoads,
  proveSpritePublications,
  selectAnonymousComparisonValues,
} from "./sprite-publication-proof.js";

/** Analyze an overlay of the real asset fixture without writing project files or build artifacts. */
async function fixture(transform: (text: string) => string = (text) => text) {
  const project = fileURLToPath(
    new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
  );
  const loaded = await loadProject({ project });
  if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
  const original = await readFile(
    new URL("../../../../examples/boing-ball/src/main.blend", import.meta.url),
    "utf8",
  );
  const analysis = await analyzeProjectOverlay(loaded.snapshot, [
    { sourceId: "src/main.blend", text: transform(original) },
  ]);
  if (analysis.kind !== "complete") throw new Error(JSON.stringify(analysis.diagnostics));
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error(JSON.stringify(semantic));
  const selected = selectTargetProfile(loaded.snapshot.effectiveTarget);
  if (selected.kind !== "complete") throw new Error("Expected a cooperative profile");
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error(JSON.stringify(closed.diagnostics));
  const input: MachineLoweringInput = { program: closed.program, profile: selected.profile };
  const source = input.program.semantic.functions.find(
    (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(input.program.semantic.main),
  );
  if (source === undefined) throw new Error("Expected actual main source");
  const literal = literalResolver(valueDefinitions(source.blocks));
  const capture = source.blocks
    .flatMap(({ operations }) => operations)
    .find(
      (op): op is MemoryReadOperation =>
        op.kind === "memory-read" && literal(op.address) === 0xd012n,
    );
  if (capture === undefined) throw new Error("Expected real raster capture");
  return { input, source, capture };
}

/** Pass the same existing operation-use inventories that the lowering owner supplies. */
function selection(input: MachineLoweringInput, source: SemanticFunction, blocks = source.blocks) {
  const { singleUseValues, materializedValues } = functionValueUses(blocks);
  return selectAnonymousComparisonValues(
    input,
    source,
    blocks,
    singleUseValues,
    materializedValues,
  );
}

describe("sprite publication implementation boundaries", () => {
  it("should retain the exact read and source guards when qualifying anonymous values", async () => {
    const { input, source, capture } = await fixture();
    expect(selection(input, source).has(capture.result)).toBe(true);
    expect(hasUnobservedByteCapture(input, source, capture)).toBe(false);
    expect(
      hasUnobservedByteCapture(
        input,
        source,
        capture,
        proveSpritePublications(input, source) ?? undefined,
      ),
    ).toBe(true);
    expect(canOmitComparisonCaptureReload(input, source, [])).toBe(false);
    expect(selection({ ...input, metadataOnly: true }, source).size).toBe(0);
    expect(
      selection(
        input,
        source,
        source.blocks.map((block) => ({ ...block })),
      ).size,
    ).toBe(0);
  });

  for (const [name, prefix, entry] of [
    [
      "generated IRQ pointer mutation",
      "import { setIRQ } from c64.system;\ninterrupt function Observer(): void { poke($07F8, 0); }\n",
      "setIRQ(&Observer);",
    ],
    ["a reached helper", "function observe(): void { poke($D020, 0); }\n", "observe();"],
    [
      "an escaped local",
      "",
      "let exposed: byte = 0; let address: word = word(&exposed); poke(address, 0);",
    ],
    ["a mode register mirror", "", "poke($D056, 0);"],
    ["an IRQ vector write", "", "poke($0314, 0);"],
    ...["$DC04", "$DC14", "$DD0D", "$DD1D"].map((address) => [
      "CIA configuration or mirror",
      "",
      `poke(${address}, 0);`,
    ]),
    ["a word crossing into CIA configuration", "", "pokew($DBFF, 0);"],
    ["a word crossing firmware workspace and the pointer table", "", "pokew($07F7, 0);"],
    [
      "firmware cursor routing",
      "",
      "poke($D1, 0); poke($D2, $24); poke($CC, 0); poke($CD, 1); poke($D020, peek($CE));",
    ],
  ]) {
    it(`should keep ordinary capture for ${name}`, async () => {
      const { input, source } = await fixture((text) =>
        text
          .replace("module Main;", `module Main;\n${prefix}`)
          .replace("function main(): void {", `function main(): void {\n${entry}`),
      );
      expect(proveSpritePublications(input, source) === null).toBe(true);
      expect(selection(input, source).size).toBe(0);
    });
  }

  it("should retain a firmware-workspace barrier even without sprite publication", async () => {
    const { input, source } = await fixture((text) =>
      text
        .replace("function main(): void {", "function main(): void { poke($D1, 0);")
        .replace(/poke\(\$(?:07F[8-F]|D015),[^;]+;/gu, ""),
    );
    expect(selection(input, source).size).toBe(0);
  });

  for (const poll of [
    "while (true) { let sample: byte = peek($D012); if (sample != 251) { continue; } break; }",
    "while (true) { let samples: byte[1] = [peek($D012)]; if (samples[0] == 251) { break; } }",
    "while (true) { let waiting: boolean[1] = [peek($D012) != 251]; if (!waiting[0]) { break; } }",
  ]) {
    it("should preserve named and aggregate capture materialization", async () => {
      const { input, source } = await fixture((text) =>
        text.replace(/while \(peek\(\$D012\) != 251\) \{\s*\}/u, poll),
      );
      expect(selection(input, source).size).toBe(0);
    });
  }

  it("should count branch conditions as well as operation uses", async () => {
    const { input, source, capture } = await fixture();
    const block = source.blocks.find((entry) => entry.operations.includes(capture))!;
    const replacement = {
      ...source,
      blocks: source.blocks.map((entry) =>
        entry === block
          ? {
              ...entry,
              terminator: {
                kind: "branch" as const,
                condition: capture.result,
                whenTrue: source.entry,
                whenFalse: source.entry,
              },
            }
          : entry,
      ),
    };
    const changed = {
      ...input,
      program: {
        ...input.program,
        semantic: { ...input.program.semantic, functions: [replacement] },
      },
    };
    expect(selection(changed, replacement).size).toBe(0);
  });

  it("should resolve long asset-offset chains without consuming the host call stack", async () => {
    const { input, source } = await fixture();
    const literal = literalResolver(valueDefinitions(source.blocks));
    const pointer = source.blocks
      .flatMap(({ operations }) => operations)
      .find((op) => op.kind === "memory-write" && literal(op.address) === 0x07f8n);
    if (pointer?.kind !== "memory-write") throw new Error("Expected first pointer publication");
    const zero: SemanticOperation = {
      kind: "constant",
      result: "long.zero",
      value: 0n,
      type: BYTE,
      integer: { width: 8, signed: false, wrap: true },
      span: pointer.span,
    };
    const chain: BinaryOperation[] = [];
    let left = pointer.value;
    for (let index = 0; index < 8000; index += 1) {
      const result = `long.${index}`;
      chain.push({
        kind: "binary",
        result,
        operator: "+",
        left,
        right: "long.zero",
        type: BYTE,
        integer: { width: 8, signed: false, wrap: true },
        span: pointer.span,
      });
      left = result;
    }
    const replacement = {
      ...source,
      blocks: source.blocks.map((block) => ({
        ...block,
        operations: block.operations.flatMap((op): readonly SemanticOperation[] =>
          op === pointer ? [zero, ...chain, { ...pointer, value: left }] : [op],
        ),
      })),
    };
    const changed = {
      ...input,
      program: {
        ...input.program,
        semantic: { ...input.program.semantic, functions: [replacement] },
      },
    };
    expect(proveSpritePublications(changed, replacement)).not.toBeNull();
  });

  it("should not apply a current positive bound to a stale decrement operand", () => {
    const root = sourceBinding(70000);
    const place = { root, path: [] };
    const span = sourceSpan(70001);
    const load = (result: string): SemanticOperation => ({
      kind: "load",
      result,
      place,
      type: BYTE,
      integer: { width: 8, signed: false, wrap: true },
      span,
    });
    const publication = load("publication");
    const source = semanticFunction(70000, "main", [], VOID, [
      semanticBlock(
        "entry",
        [
          {
            kind: "constant",
            result: "zero",
            value: 0n,
            type: BYTE,
            integer: { width: 8, signed: false, wrap: true },
            span,
          },
          {
            kind: "constant",
            result: "one",
            value: 1n,
            type: BYTE,
            integer: { width: 8, signed: false, wrap: true },
            span,
          },
          { kind: "store", place, value: "zero", type: BYTE, span },
          load("old"),
          { kind: "store", place, value: "one", type: BYTE, span },
          {
            kind: "binary",
            result: "decrement",
            operator: "-",
            left: "old",
            right: "one",
            type: BYTE,
            integer: { width: 8, signed: false, wrap: true },
            span,
          },
          { kind: "store", place, value: "decrement", type: BYTE, span },
          publication,
        ],
        { kind: "return", value: null },
      ),
    ]);
    expect(boundedCounterLoads(source, root, 4n, () => false).has(publication)).toBe(false);
    for (const limit of [0n, -1n, 256n])
      expect(boundedCounterLoads(source, root, limit, () => false).size).toBe(0);
  });
});
