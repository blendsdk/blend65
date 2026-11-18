import { beforeAll, describe, expect, it, vi } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { closeSource } from "./low-byte-write-forwarding-test-support.js";
import type { ClosedSource } from "./low-byte-write-forwarding-test-support.js";
import { lowerMachineProgram } from "./lower.js";
import * as publicationProof from "./sprite-publication-proof.js";

const source = `module Main; function main():void {
  let value:byte=165; let step:byte=37;
  while(true){value=value+step;poke($D005,value);}
}`;

/** Keep the changed body as the actual function object seen by the certificate. */
function withSource(base: ClosedSource, body: SemanticFunction): ClosedSource {
  return {
    source: body,
    input: {
      ...base.input,
      program: {
        ...base.input.program,
        semantic: {
          ...base.input.program.semantic,
          functions: base.input.program.semantic.functions.map((fn) =>
            fn === base.source ? body : fn,
          ),
        },
      },
    },
  };
}

/** Collect assignment results while deliberately overstating the supplied use hints. */
function candidates(fixture: ClosedSource) {
  const expected = new Set<string>();
  const uses = new Set<string>();
  for (const block of fixture.source.blocks) {
    for (const [index, operation] of block.operations.entries()) {
      if ("result" in operation && operation.result !== null) uses.add(operation.result);
      const store = block.operations[index + 1];
      if (
        operation.kind === "binary" &&
        (operation.operator === "+" || operation.operator === "-") &&
        store?.kind === "store" &&
        store.value === operation.result
      )
        expected.add(operation.result);
    }
  }
  return { expected, uses };
}

/** Exercise the production opt-in with the original closed source and use hints. */
function select(fixture: ClosedSource) {
  return selectAnonymousByteWriteValues(
    fixture.input,
    fixture.source,
    fixture.source.blocks,
    candidates(fixture).uses,
    true,
  );
}

describe("byte assignment selection internals", () => {
  let base: ClosedSource;
  beforeAll(async () => {
    base = await closeSource(source);
  });

  it("should preserve every original operation and named-store object", () => {
    const blocks = [...base.source.blocks];
    const operations = blocks.map((block) => [...block.operations]);
    expect(select(base)).toEqual(candidates(base).expected);
    for (const [index, block] of blocks.entries()) {
      expect(base.source.blocks[index]).toBe(block);
      expect(block.operations).toEqual(operations[index]);
      for (const [position, operation] of block.operations.entries())
        expect(operation).toBe(operations[index]?.[position]);
    }
  });

  it("should omit proof work when named assignments are not opted in", () => {
    const proof = vi.spyOn(publicationProof, "proveSpritePublications");
    try {
      expect(
        selectAnonymousByteWriteValues(
          base.input,
          base.source,
          base.source.blocks,
          candidates(base).uses,
        ),
      ).toEqual(new Set());
      expect(proof).not.toHaveBeenCalled();
    } finally {
      proof.mockRestore();
    }
  });

  it.each(["duplicate block", "missing entry", "missing successor"])(
    "should decline malformed graphs with a %s before proof traversal",
    (damage) => {
      const body: SemanticFunction =
        damage === "duplicate block"
          ? { ...base.source, blocks: [...base.source.blocks, base.source.blocks[0]!] }
          : damage === "missing entry"
            ? { ...base.source, entry: "missing.entry" }
            : {
                ...base.source,
                blocks: base.source.blocks.map((block) =>
                  block.id === base.source.entry
                    ? { ...block, terminator: { kind: "jump", target: "missing.target" } }
                    : block,
                ),
              };
      const proof = vi.spyOn(publicationProof, "proveSpritePublications");
      try {
        expect(select(withSource(base, body))).toEqual(new Set());
        expect(proof).not.toHaveBeenCalled();
      } finally {
        proof.mockRestore();
      }
    },
  );

  it("should traverse a long entry chain iteratively", () => {
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
    expect(select(changed)).toEqual(candidates(base).expected);
  });

  it("should share one real certificate query across dense named assignments", async () => {
    const fixture = await closeSource(`module Main;function main():void{
      let value:byte=165;let step:byte=37;
      while(true){${"value=value+step;".repeat(256)}poke($D005,value);}
    }`);
    const { expected } = candidates(fixture);
    expect(expected.size).toBe(256);
    const proof = vi.spyOn(publicationProof, "proveSpritePublications");
    try {
      expect(select(fixture)).toEqual(expected);
      expect(proof).toHaveBeenCalledTimes(1);
    } finally {
      proof.mockRestore();
    }
  });

  it("should close storage without requests for the selected anonymous result", () => {
    const logicalStorage = inventoryStorage(base.input.program);
    const allocation = allocateStorage(
      logicalStorage,
      buildInterference(logicalStorage),
      base.input.profile.storage,
    );
    if (allocation.kind !== "complete") throw new Error("Expected provisional source allocation");
    const lowered = lowerMachineProgram({
      ...base.input,
      logicalStorage,
      placement: allocation.placement,
    });
    if (lowered.kind !== "complete") throw new Error("Expected complete machine lowering");
    const { expected } = candidates(base);
    expect(expected.size).toBe(1);
    for (const result of expected) {
      const suffix = `:retained-value:${result}`;
      expect(lowered.inventory.requests.some((request) => request.id.endsWith(suffix))).toBe(false);
      expect(lowered.program.requiredStorage.some((request) => request.id.endsWith(suffix))).toBe(
        false,
      );
    }
  });
});
