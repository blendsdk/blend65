import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import {
  BYTE,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

const ARRAY: SemanticType = { kind: "array", element: BYTE, length: 11, size: 11 };

/** Exercise source identity and final storage closure without inventing an aggregate alias proof. */
function returning(kind: "local" | "borrowed" | "path" | "multiuse" | "nonadjacent") {
  const rootType: SemanticType =
    kind === "path" ? { kind: "array", element: ARRAY, length: 2, size: 22 } : ARRAY;
  const parameter = sourceParameter(9161, rootType);
  const borrowed = kind === "borrowed" || kind === "path";
  const place = {
    root: borrowed ? parameter.id : sourceBinding(9162),
    rootType,
    path: kind === "path" ? [{ kind: "index" as const, value: "zero" }] : [],
  };
  const operations: SemanticOperation[] = [];
  if (kind === "path")
    operations.push({
      kind: "constant",
      result: "zero",
      value: 0n,
      type: BYTE,
      integer: null,
      span: sourceSpan(9163),
    });
  operations.push({
    kind: "place-address",
    result: "source",
    place,
    type: ARRAY,
    integer: null,
    span: sourceSpan(9164),
  });
  if (kind === "multiuse")
    operations.push({
      kind: "store",
      place: { root: sourceBinding(9165), rootType: ARRAY, path: [] },
      value: "source",
      type: ARRAY,
      span: sourceSpan(9166),
    });
  if (kind === "nonadjacent")
    operations.push({ kind: "cpu-control", control: "asm_nop", span: sourceSpan(9167) });
  const fn = semanticFunction(9160, "fixed-return", borrowed ? [parameter] : [], ARRAY, [
    semanticBlock("return.entry", operations, { kind: "return", value: "source" }),
  ]);
  const lowered = lowerFunctions([fn]);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(
    inventoryStorage(wholeProgramFor([fn])),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closed.kind !== "complete") throw new Error("Expected complete function storage");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  return {
    requests: closed.inventory.requests,
    instructions: lowered.program.functions[0]!.blocks.flatMap(({ instructions }) => instructions),
  };
}

describe("fixed whole-local terminal return selection", () => {
  it("should retain the local and hidden destination but never reserve an unused source pair", () => {
    const { requests, instructions } = returning("local");
    expect(requests.filter(({ id }) => id.includes("aggregate-address:source"))).toEqual([]);
    expect(requests.filter(({ id }) => id.includes("aggregate-return-destination"))).toHaveLength(
      1,
    );
    expect(requests.find(({ storageClass }) => storageClass === "local")).toMatchObject({
      bytes: 11,
      region: "ram",
    });
    expect(
      instructions.find(({ opcode, mode }) => opcode === "lda" && mode === "absolute-y"),
    ).toBeDefined();
    expect(
      instructions.find(({ opcode, mode }) => opcode === "sta" && mode === "indirect-indexed-y"),
    ).toBeDefined();
    expect(instructions.some(({ opcode }) => opcode === "cpy")).toBe(true);
  });

  it.each(["borrowed", "path", "multiuse", "nonadjacent"] as const)(
    "should retain the existing source-address path for %s",
    (kind) => {
      const { requests } = returning(kind);
      expect(requests.find(({ id }) => id.includes("aggregate-address:source"))).toMatchObject({
        bytes: 2,
        region: "zero-page-required",
      });
    },
  );
});
