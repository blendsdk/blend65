import { beforeAll, describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { fixture, select, sourceText, witness } from "./byte-write-forwarding-test-support.js";
import type { Fixture } from "./byte-write-forwarding-test-support.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { lowerMachineProgram } from "./lower.js";

/** Keep the actual source association while testing a deliberately changed graph. */
function withSource(base: Fixture, source: SemanticFunction): Fixture {
  return {
    ...base,
    source,
    input: {
      ...base.input,
      program: {
        ...base.input.program,
        semantic: {
          ...base.input.program.semantic,
          functions: base.input.program.semantic.functions.map((fn) =>
            fn === base.source ? source : fn,
          ),
        },
      },
    },
  };
}

describe("anonymous byte-write selection internals", () => {
  let base: Fixture;
  beforeAll(async () => {
    base = await fixture(sourceText);
  });

  it("should not mutate original semantic operations or source identities", () => {
    const blocks = [...base.source.blocks];
    const operations = blocks.map((block) => [...block.operations]);
    expect(select(base)).toEqual(new Set([base.candidate]));
    expect(base.input.program.semantic.functions).toContain(base.source);
    for (const [index, block] of blocks.entries()) {
      expect(base.source.blocks[index]).toBe(block);
      expect(block.operations).toEqual(operations[index]);
      for (const [position, operation] of block.operations.entries())
        expect(operation).toBe(operations[index]?.[position]);
    }
  });

  it.each(["duplicate block", "missing entry", "missing successor"])(
    "should decline a malformed graph with a %s before certificate traversal",
    (damage) => {
      const source: SemanticFunction =
        damage === "duplicate block"
          ? { ...base.source, blocks: [...base.source.blocks, base.source.blocks[0]!] }
          : damage === "missing entry"
            ? { ...base.source, entry: "unknown.entry" }
            : {
                ...base.source,
                blocks: base.source.blocks.map((block) =>
                  block.id === base.source.entry
                    ? { ...block, terminator: { kind: "jump", target: "unknown.target" } }
                    : block,
                ),
              };
      const changed = withSource(base, source);
      expect(select(changed).size).toBe(0);
    },
  );

  it("should walk a long entry chain iteratively without a recursion limit", () => {
    const count = 6000;
    const chain: SemanticBlock[] = Array.from({ length: count }, (_, index) => ({
      id: `chain.${index}`,
      operations: [],
      terminator: {
        kind: "jump",
        target: index + 1 === count ? base.source.entry : `chain.${index + 1}`,
      },
    }));
    const changed = withSource(base, {
      ...base.source,
      entry: chain[0]!.id,
      blocks: [...chain, ...base.source.blocks],
    });
    expect(select(changed)).toEqual(new Set([base.candidate]));
  });

  it("should select a dense finite group of independent candidates", async () => {
    const count = 256;
    const source = `module Main; function main():void {
      let counter:byte=0;
      while(true){${"poke($D005,counter+21);".repeat(count)}counter+=1;}
    }`;
    const actual = await fixture(source);
    const candidates = new Set(
      actual.source.blocks.flatMap((block) =>
        block.operations.flatMap((operation, index) => {
          const next = block.operations[index + 1];
          return operation.kind === "binary" &&
            operation.operator === "+" &&
            next?.kind === "memory-write" &&
            next.value === operation.result
            ? [operation.result]
            : [];
        }),
      ),
    );
    expect(candidates.size).toBe(count);
    expect(
      selectAnonymousByteWriteValues(actual.input, actual.source, actual.source.blocks, candidates),
    ).toEqual(candidates);
  });

  it("should omit selected temporary demands before the returned storage inventory closes", () => {
    const logicalStorage = inventoryStorage(base.input.program);
    const allocation = allocateStorage(
      logicalStorage,
      buildInterference(logicalStorage),
      base.input.profile.storage,
    );
    if (allocation.kind !== "complete") throw new Error("Expected provisional source allocation");
    const result = lowerMachineProgram({
      ...base.input,
      logicalStorage,
      placement: allocation.placement,
    });
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected machine selection");
    const suffix = `:retained-value:${witness(base.source).operation.result}`;
    expect(result.inventory.requests.some((request) => request.id.endsWith(suffix))).toBe(false);
    expect(result.program.requiredStorage.some((request) => request.id.endsWith(suffix))).toBe(
      false,
    );
    expect(base.source.blocks).toContain(witness(base.source).block);
  });
});
