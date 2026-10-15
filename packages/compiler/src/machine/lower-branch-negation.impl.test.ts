import { describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import type { StorageRequest } from "../storage/storage-types.js";
import { bindMachineProgram } from "./bind.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import { hasByteReturnArms } from "./lower-terminal-byte.js";
import { lowerFunction } from "./lower-function.js";
import {
  BOOLEAN,
  BYTE,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

const span = sourceSpan(9381);
const call: Extract<SemanticOperation, { kind: "call" }> = {
  kind: "call",
  result: "truth",
  callee: sourceBinding(9382),
  arguments: [],
  type: BOOLEAN,
  integer: null,
  span,
};
const negate: Extract<SemanticOperation, { kind: "unary" }> = {
  kind: "unary",
  result: "negated",
  operator: "!",
  operand: "truth",
  type: BOOLEAN,
  integer: null,
  span,
};
const barrier: SemanticOperation = { kind: "cpu-control", control: "asm_nop", span };
const branch = { kind: "branch" as const, condition: "negated", whenTrue: "yes", whenFalse: "no" };

/** Inspect the existing adjacency decision without teaching it any callee-flag facts. */
function forwards(operations: readonly SemanticOperation[], singleUse = true) {
  return selectRegisterForwarding(
    [semanticBlock("entry", operations, branch)],
    new Set(singleUse ? ["truth"] : []),
  ).forwardedRegisterValues.has("truth");
}

/** Exercise each selected or conservative unary path through real function-storage closure. */
function lowerNegation(kind: "parameter" | "call" | "intervening" | "materialized") {
  const parameter = sourceParameter(9383, BOOLEAN);
  const operations: SemanticOperation[] = [
    kind === "call" ? call : loadOperation("truth", parameter, 9384),
    negate,
  ];
  const saved = { id: sourceBinding(9385), type: BOOLEAN };
  if (kind === "materialized" || kind === "intervening")
    operations.push({
      kind: "store",
      place: { root: saved.id, rootType: BOOLEAN, path: [] },
      value: "negated",
      type: BOOLEAN,
      span,
    });
  if (kind === "intervening")
    operations.push({ ...call, result: null }, loadOperation("observed", saved, 9386));
  const yes: SemanticOperation = {
    kind: "constant",
    result: "yes",
    value: 17n,
    type: BYTE,
    integer: null,
    span,
  };
  const fn = semanticFunction(9380, "choose-negated", kind === "call" ? [] : [parameter], BYTE, [
    semanticBlock(
      "entry",
      operations,
      kind === "intervening" ? { ...branch, condition: "observed" } : branch,
    ),
    semanticBlock("yes", [yes], { kind: "return", value: "yes" }),
    semanticBlock("no", [{ ...yes, result: "no", value: 34n }], { kind: "return", value: "no" }),
  ]);
  const callee = semanticFunction(9382, "ready", [], BOOLEAN, [
    semanticBlock("callee", [{ ...yes, result: "answer", value: false, type: BOOLEAN }], {
      kind: "return",
      value: "answer",
    }),
  ]);
  const functions = kind === "call" || kind === "intervening" ? [fn, callee] : [fn];
  const lifetimes = functions.flatMap(valueLifetimes);
  const lowered = lowerFunctions(functions, lifetimes);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(
    inventoryStorage(wholeProgramFor(functions, lifetimes)),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closed.kind !== "complete") throw new Error("Expected closed Boolean execution storage");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  return {
    block: lowered.program.functions[0]!.blocks[0]!,
    requests: closed.inventory.requests,
    functions,
    lifetimes,
    fn,
  };
}

/** Inspect the actual selector in a chosen domain, including normalized NMI ownership depth. */
function contextualCallNegation(context: InterruptExecutionContext) {
  const { functions, lifetimes, fn } = lowerNegation("call");
  const program = wholeProgramFor(functions, lifetimes);
  const profile = selectedProfile();
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected provisional function storage");
  const requests: StorageRequest[] = [];
  const body = lowerFunction(
    "contextual-negation",
    fn.id,
    fn.blocks,
    { program, placement: allocation.placement, profile },
    requests,
    new Map(),
    [],
    [],
    false,
    context,
  );
  expect(requests).toEqual([]);
  return body.blocks[0]!;
}

describe("immediate branch-only Boolean negation", () => {
  it("forwards only a sole adjacent direct Boolean call to the final branch negation", () => {
    expect(forwards([call, negate])).toBe(true);
    expect(forwards([call, negate], false)).toBe(false);
    expect(forwards([call, barrier, negate])).toBe(false);
    expect(forwards([call, negate, barrier])).toBe(false);
    expect(forwards([{ ...call, type: WORD }, negate])).toBe(false);
    expect(forwards([{ ...call, type: BYTE }, negate])).toBe(false);
    expect(forwards([call, { ...negate, operand: "other" }])).toBe(false);
    expect(forwards([call, { ...negate, operator: "~" }])).toBe(false);
    expect(
      selectRegisterForwarding(
        [
          semanticBlock("entry", [call], { kind: "jump", target: "later" }),
          semanticBlock("later", [negate], branch),
        ],
        new Set(["truth"]),
      ).forwardedRegisterValues.has("truth"),
    ).toBe(false);
  });

  it("uses the parameter load's own zero flag with its original one-byte home", () => {
    const { block, requests } = lowerNegation("parameter");
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["lda"]);
    expect(block.terminator).toMatchObject({ kind: "branch", opcode: "beq" });
    expect(
      requests.filter(({ storageClass }) => storageClass === "parameter").map(({ bytes }) => bytes),
    ).toEqual([1]);
    expect(requests.filter(({ storageClass }) => storageClass === "temporary")).toEqual([]);
  });

  it("retains the explicit A test for the synthetic startup-return fixture", () => {
    const { block, requests } = lowerNegation("call");
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["jsr", "cmp"]);
    expect(block.instructions[1]!.operand).toEqual({ kind: "immediate", value: 0 });
    expect(block.instructions[1]!.defines.registers).toEqual([]);
    expect(block.terminator).toMatchObject({ kind: "branch", opcode: "beq" });
    expect(requests.filter(({ storageClass }) => storageClass === "temporary")).toEqual([]);
  });

  it("tests returned A with disposable X before ordinary constant-byte returns", () => {
    const block = contextualCallNegation({ domain: "main", irq: 0, nmi: 0 });
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["jsr", "tax"]);
    expect(block.instructions[1]!.operand).toBeNull();
    expect(block.instructions[1]!.defines.registers).toEqual(["x"]);
    expect(block.terminator).toMatchObject({ kind: "branch", opcode: "beq" });
  });

  it.each([0, 1])("retains CMP in the NMI execution domain at ownership depth %s", (nmi) => {
    const block = contextualCallNegation({ domain: "nmi", irq: 0, nmi });
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["jsr", "cmp"]);
    expect(block.instructions[1]!.operand).toEqual({ kind: "immediate", value: 0 });
    expect(block.instructions[1]!.defines.registers).toEqual([]);
    expect(block.terminator).toMatchObject({ kind: "branch", opcode: "beq" });
  });

  it("permits disposable X in the IRQ domain whose entry already preserves it", () => {
    const block = contextualCallNegation({ domain: "irq", irq: 0, nmi: 0 });
    expect(block.instructions.map(({ opcode }) => opcode)).toEqual(["jsr", "tax"]);
    expect(block.instructions[1]!.defines.registers).toEqual(["x"]);
  });

  it("rejects unknown, wider, effectful and non-direct constant return arms", () => {
    const { fn } = lowerNegation("call");
    const entry = fn.blocks[0]!;
    const indexes = new Map(fn.blocks.map((block, index) => [block.id, index] as const));
    expect(hasByteReturnArms(entry, fn.blocks, indexes)).toBe(true);
    expect(hasByteReturnArms(entry, fn.blocks, new Map())).toBe(false);
    const yes = fn.blocks[1]!;
    const constant = yes.operations[0]!;
    if (constant.kind !== "constant") throw new Error("Expected a constant return fixture");
    for (const arm of [
      { ...yes, operations: [{ ...constant, type: WORD }] },
      { ...yes, operations: [constant, barrier] },
      { ...yes, terminator: { kind: "jump" as const, target: "no" } },
      { ...yes, terminator: { kind: "return" as const, value: "unrelated" } },
    ])
      expect(hasByteReturnArms(entry, [entry, arm, fn.blocks[2]!], indexes)).toBe(false);
  });

  it.each(["intervening", "materialized"] as const)(
    "retains value construction for %s uses",
    (kind) => {
      const { block, requests } = lowerNegation(kind);
      expect(
        block.instructions.some(
          ({ opcode, operand }) => opcode === "adc" && operand?.kind === "immediate",
        ),
      ).toBe(true);
      expect(block.instructions.some(({ opcode }) => opcode === "eor")).toBe(true);
      expect(
        requests
          .filter(({ storageClass }) => storageClass === "temporary")
          .some(({ bytes }) => bytes === 1),
      ).toBe(true);
    },
  );
});
