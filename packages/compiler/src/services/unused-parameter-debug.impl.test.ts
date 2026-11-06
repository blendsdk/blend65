import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateDebugEvidence } from "../artifacts/evidence.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import { inventoryStorage } from "../storage/inventory.js";
import { unusedByteParameterAtEntry } from "./debug-machine-ranges.js";
import { buildProject } from "./services.js";

const SOURCE =
  "module Game;let answer:byte;function first(left:byte,unused:byte):byte{return left;}function main():void{answer=first(7,9);}";
const LOOP_SOURCE =
  "module Game;let run:byte=peek($C110);let sample:byte=peek($C111);let answer:byte;function mutate():void{sample=sample+1;}function loop(used:byte,unused:byte):byte{while(run!=0){let inside:byte=sample;mutate();answer=inside;run=0;}return used;}function main():void{answer=loop(7,9);}";

/** Reject missing coordinates instead of accepting an absent debug entry. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative debug index");
  return value;
}

/** Narrow a nested public record before following its source or range coordinates. */
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new TypeError("Expected a debug record");
  return value as Record<string, unknown>;
}

/** Resolve the actual assembled entry rather than assuming that it has the lowest address. */
function entryAddress(labels: string, label: unknown): number {
  if (typeof label !== "string") throw new TypeError("Expected an assembled entry label");
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const matches = [
    ...labels.matchAll(new RegExp(`^\\s*${escaped}\\s*=\\s*\\$([0-9a-f]+)\\b`, "gimu")),
  ];
  expect(matches).toHaveLength(1);
  return Number.parseInt(matches[0]![1]!, 16);
}

/** Use an actual inventory request so every lifetime and binding field is present. */
function entryFixture() {
  const parameter = sourceParameter(2, BYTE);
  const body = semanticFunction(1, "first", [parameter], VOID, [
    semanticBlock("entry", [], { kind: "return", value: null, span: sourceSpan(3) }),
  ]);
  const request = inventoryStorage(wholeProgramFor([body])).requests.find(
    ({ storageClass }) => storageClass === "parameter",
  );

  if (request === undefined) throw new Error("Expected the declared ABI parameter");
  return { body, request, parameter };
}

describe("unused parameter entry locations", () => {
  it("should not report the original parameter value at a revisited aliased entry", async () => {
    const root = await mkdtemp(
      join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "parameter-loop-debug-"),
    );
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), LOOP_SOURCE);
      const project = join(root, "blend65.json");
      await writeFile(
        project,
        JSON.stringify({
          schemaVersion: 1,
          name: "parameter-loop",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "size",
        }),
      );
      const built = await buildProject({ project });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success")
        throw new Error("Expected a legal loop with an unused parameter");
      const directory = built.generation.directory;
      const decoded = validateDebugEvidence(await readFile(join(directory, ".debug.json")));
      if (decoded.kind !== "complete") throw new Error("Expected truthful loop evidence");
      const debug = decoded.value;
      const fn = debug.functions.find(
        ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.loop",
      );
      if (fn === undefined || !Array.isArray(fn.entryVariants))
        throw new Error("Missing loop body");
      const variant = record(fn.entryVariants[0]);
      const start = entryAddress(await readFile(join(directory, ".labels"), "utf8"), variant.label);
      const prg = await readFile(join(directory, built.generation.primaryArtifact));
      if (!Array.isArray(variant.rangeIndexes)) throw new Error("Missing loop instruction ranges");
      expect(
        variant.rangeIndexes.some((index) => {
          const machine = record(debug.ranges[integer(index)]!.machine);
          const offset = integer(machine.start) - prg.readUInt16LE(0) + 2;
          return prg[offset] === 0x4c && prg.readUInt16LE(offset + 1) === start;
        }),
        "An actual backedge revisits the instruction used for the entry anchor",
      ).toBe(true);
      const symbolIndex = debug.symbols.findIndex(
        (symbol) =>
          symbol.kind === "parameter" &&
          symbol.scope === "src/game.blend::Game.loop" &&
          record(record(symbol.origin).span).startByte === LOOP_SOURCE.indexOf("unused:byte"),
      );
      expect(symbolIndex).toBeGreaterThanOrEqual(0);
      const locations = debug.locations.filter((location) => location.symbolIndex === symbolIndex);
      expect(locations).toHaveLength(1);
      expect(locations[0]!.availability).toEqual({
        kind: "unavailable",
        reason: "notRepresentable",
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);

  it.each(["none", "size", "balanced", "speed"] as const)(
    "should preserve the real ABI home at entry without inventing a source instruction in %s",
    async (optimization) => {
      const root = await mkdtemp(
        join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "unused-parameter-debug-"),
      );
      try {
        await mkdir(join(root, "src"));
        await writeFile(join(root, "src/game.blend"), SOURCE);
        const project = join(root, "blend65.json");
        await writeFile(
          project,
          JSON.stringify({
            schemaVersion: 1,
            name: "unused-parameter",
            sourceRoot: "src",
            entry: "Game",
            target: "c64-pal-prg-kernal-6581",
            outDir: "out",
            optimization,
          }),
        );
        const built = await buildProject({ project });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected complete parameter evidence");
        const decoded = validateDebugEvidence(
          await readFile(join(built.generation.directory, ".debug.json")),
        );
        if (decoded.kind !== "complete") throw new Error("Expected valid debug evidence");
        const debug = decoded.value;
        const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
        const functionIndex = debug.functions.findIndex(
          ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.first",
        );
        expect(functionIndex).toBeGreaterThanOrEqual(0);
        const parameters = debug.symbols
          .map((symbol, symbolIndex) => ({ symbol, symbolIndex }))
          .filter(
            ({ symbol }) =>
              symbol.kind === "parameter" && symbol.scope === "src/game.blend::Game.first",
          );
        expect(parameters).toHaveLength(2);
        for (const { symbol, symbolIndex } of parameters) {
          expect(symbol.byteWidth).toBe(1);
          const locations = debug.locations.filter(
            (location) => location.symbolIndex === symbolIndex,
          );
          expect(locations).toHaveLength(1);
          const contextIndex = integer(locations[0]!.contextIndex);
          expect(debug.contexts[contextIndex]).toMatchObject({ kind: "entry", functionIndex });
          const ranges = locations[0]!.liveRangeIndexes;
          if (!Array.isArray(ranges)) throw new TypeError("Expected real instruction ranges");
          expect(ranges.length).toBeGreaterThan(0);
          for (const rangeIndex of ranges) {
            expect(debug.ranges[integer(rangeIndex)]).toMatchObject({ contextIndex });
          }
          const span = record(record(symbol.origin).span);
          // Only return shaping erases the declaration point and needs the entry fallback.
          if (optimization !== "none" && span.startByte === SOURCE.indexOf("unused:byte")) {
            expect(ranges).toHaveLength(1);
            const variants = debug.functions[functionIndex]!.entryVariants;
            if (!Array.isArray(variants)) throw new TypeError("Expected actual entry variants");
            const variant = record(
              variants[integer(debug.contexts[contextIndex]!.entryVariantIndex)],
            );
            expect(record(debug.ranges[integer(ranges[0])]!.machine).start).toBe(
              entryAddress(labels, variant.label),
            );
          }
          expect(locations[0]!.availability).toMatchObject({
            kind: "available",
            pieces: [{ kind: "memory", valueOffset: 0, byteLength: 1 }],
          });
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000,
  );

  it("should anchor only the unused declaration-only byte parameter", () => {
    const { body, request } = entryFixture();
    expect(unusedByteParameterAtEntry(request, body)).toBe(true);
    expect(unusedByteParameterAtEntry({ ...request, binding: sourceBinding(99) }, body)).toBe(
      false,
    );
    expect(unusedByteParameterAtEntry({ ...request, bytes: 2 }, body)).toBe(false);
  });

  it("should reject used parameters even when a malformed lifetime claims entry only", () => {
    const { body, request, parameter } = entryFixture();
    const used = {
      ...body,
      blocks: [
        semanticBlock(
          "entry",
          [
            {
              kind: "load",
              result: "read",
              type: BYTE,
              integer: null,
              span: sourceSpan(4),
              place: { root: parameter.id, path: [] },
            },
          ],
          { kind: "return", value: null, span: sourceSpan(5) },
        ),
      ],
    };
    expect(unusedByteParameterAtEntry(request, used)).toBe(false);
  });

  it("should retain normal range obligations for longer or non-entry lifetimes", () => {
    const { body, request } = entryFixture();
    expect(
      unusedByteParameterAtEntry(
        {
          ...request,
          lifetime: {
            ...request.lifetime,
            liveAt: [...request.lifetime.liveAt, { block: "entry", operation: 1 }],
          },
        },
        body,
      ),
    ).toBe(false);
    expect(
      unusedByteParameterAtEntry(
        {
          ...request,
          lifetime: { ...request.lifetime, definition: { block: "other", operation: 0 } },
        },
        body,
      ),
    ).toBe(false);
  });
});
