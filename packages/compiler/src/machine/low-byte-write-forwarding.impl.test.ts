import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import {
  closeSource,
  replaceBlocks,
  select,
  windowOf,
} from "./low-byte-write-forwarding-test-support.js";
import type { ClosedSource } from "./low-byte-write-forwarding-test-support.js";
import { lowerMachineProgram } from "./lower.js";
import * as publicationProof from "./sprite-publication-proof.js";

/** Preserve actual program membership when testing a changed entry or block graph. */
function withSource(base: ClosedSource, source: SemanticFunction): ClosedSource {
  return {
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

describe("low-byte write selection internals", () => {
  let base: ClosedSource;
  beforeAll(async () => {
    base = await closeSource();
  });

  it("should preserve every original block, operation and named-word load", () => {
    const blocks = [...base.source.blocks];
    const operations = blocks.map((block) => [...block.operations]);
    expect(select(base)).toEqual(new Set([windowOf(base).lo.result]));
    for (const [index, block] of blocks.entries()) {
      expect(base.source.blocks[index]).toBe(block);
      expect(block.operations).toEqual(operations[index]);
      for (const [position, operation] of block.operations.entries())
        expect(operation).toBe(operations[index]?.[position]);
    }
  });

  it.each(["duplicate block", "missing entry", "missing successor"])(
    "should decline a malformed graph with a %s",
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
      expect(select(withSource(base, source))).toEqual(new Set());
    },
  );

  it("should decline a conflicting operand definition without querying the certificate", () => {
    const { load } = windowOf(base);
    const changed = replaceBlocks(base, [
      ...base.source.blocks,
      {
        id: "conflicting.definition",
        operations: [{ ...load }],
        terminator: { kind: "unreachable" },
      },
    ]);
    const proof = vi.spyOn(publicationProof, "proveSpritePublications");
    try {
      expect(select(changed)).toEqual(new Set());
      expect(proof).not.toHaveBeenCalled();
    } finally {
      proof.mockRestore();
    }
  });

  it("should walk a long entry chain without recursive traversal", () => {
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
    expect(select(changed)).toEqual(new Set([windowOf(base).lo.result]));
  });

  it("should share one real certificate query across a dense group of extractions", async () => {
    const count = 256;
    const fixture = await closeSource(`module Main; function main():void {
      let value:word=$12A5;
      while(true){${"poke($D005,lo(value));".repeat(count)}value+=257;}
    }`);
    const candidates = new Set<string>();
    const uses = new Set<string>();
    for (const block of fixture.source.blocks) {
      for (const [index, operation] of block.operations.entries()) {
        const load = block.operations[index - 1];
        const write = block.operations[index + 1];
        if (
          operation.kind === "unary" &&
          operation.operator === "lo" &&
          load?.kind === "load" &&
          load.result === operation.operand &&
          write?.kind === "memory-write" &&
          write.value === operation.result
        ) {
          candidates.add(operation.result);
          uses.add(operation.result);
          uses.add(load.result);
        }
      }
    }
    expect(candidates.size).toBe(count);
    const proof = vi.spyOn(publicationProof, "proveSpritePublications");
    try {
      expect(
        selectAnonymousByteWriteValues(fixture.input, fixture.source, fixture.source.blocks, uses),
      ).toEqual(candidates);
      expect(proof).toHaveBeenCalledTimes(1);
    } finally {
      proof.mockRestore();
    }
  });

  it("should close storage without a capture demand for the selected extraction", () => {
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
    if (result.kind !== "complete") throw new Error("Expected complete machine selection");
    const suffix = `:retained-value:${windowOf(base).lo.result}`;
    expect(result.inventory.requests.some((request) => request.id.endsWith(suffix))).toBe(false);
    expect(result.program.requiredStorage.some((request) => request.id.endsWith(suffix))).toBe(
      false,
    );
    expect(base.source.blocks).toContain(windowOf(base).block);
  });
});
