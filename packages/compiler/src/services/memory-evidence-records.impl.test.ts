import { describe, expect, it } from "vitest";
import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
  selectedProfile,
  wholeProgramFor,
  lowerFunctions,
} from "../machine/lowering-test-support.js";
import type { SemanticGlobal } from "../semantic/operations.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { deriveMemoryIntervals, sfaClosureHash } from "./memory-evidence-records.js";

/** Project one physical source interval using real semantic inventory and an empty SFA certificate. */
function ledger(start: number, end: number) {
  const main = semanticFunction(0, "main", [], VOID, [
    semanticBlock("entry", [], { kind: "return", value: null }),
  ]);
  const global: SemanticGlobal = {
    id: sourceBinding(100),
    name: "sourceByte",
    exported: true,
    storage: "module",
    type: BYTE,
    initialBytes: null,
    runtimeInitialBytes: null,
    entry: null,
    blocks: [],
    source: sourceSpan(100),
  };
  const base = wholeProgramFor([main]);
  const inventory = inventoryStorage({
    ...base,
    semantic: { ...base.semantic, globals: [global] },
  });
  const closure = closeStorage(inventory, selectedProfile().storage, () => []);
  if (closure.kind !== "complete") throw new Error("Expected empty storage closure");
  const machine = lowerFunctions([main]);
  if (machine.kind !== "complete") throw new Error("Expected minimal machine program");
  // This internal projection isolates classification; it is not a serialized-layout oracle.
  const layout: CompleteC64Layout = {
    kind: "complete",
    spriteBlocks: [],
    loadRange: { start: 0x801, end: 0x801 },
    program: machine.program,
    intervals: [
      { id: `global.${bindingIdentityKey(global.id)}`, kind: "bss", start, end, bytes: null },
    ],
  };
  return deriveMemoryIntervals(layout, inventory, closure.certificate, new Map());
}

describe("physical zero-page resource reporting", () => {
  it.each([
    { start: 2, end: 2, resourceClass: "zeroPage" },
    { start: 0xfe, end: 0xff, resourceClass: "zeroPage" },
    { start: 0xff, end: 0xff, resourceClass: "zeroPage" },
    { start: 0xff, end: 0x100, resourceClass: "general" },
    { start: 0x100, end: 0x100, resourceClass: "general" },
    { start: 0xc000, end: 0xc001, resourceClass: "general" },
  ])(
    "should classify the complete $start–$end interval without changing source ownership",
    ({ start, end, resourceClass }) => {
      const intervals = ledger(start, end);
      expect(intervals).toHaveLength(1);
      expect(intervals[0]).toMatchObject({
        start,
        end: end + 1,
        size: end - start + 1,
        kind: "bss",
        resourceClass,
        owner: { kind: "symbol" },
        mutability: "mutable",
        payloadBytes: end - start + 1,
        paddingBytes: 0,
        reservedBytes: 0,
      });
      expect(sfaClosureHash(intervals)).toBe(sfaClosureHash([]));
    },
  );
});
