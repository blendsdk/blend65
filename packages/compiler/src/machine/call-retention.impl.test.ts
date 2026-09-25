import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticProgram } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import { lowerMachineProgram } from "./lower.js";
import {
  BYTE,
  VOID,
  loadOperation,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

function lowerCloseBind(program: WholeProgram) {
  const profile = selectedProfile();
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected provisional allocation");
  const lowered = lowerMachineProgram({ program, placement: allocation.placement, profile });
  if (lowered.kind !== "complete") throw new Error(`Expected lowering: ${lowered.reason}`);
  const closure = closeStorage(inventory, profile.storage, lowered.binder);
  if (closure.kind !== "complete") throw new Error("Expected closed storage");
  const bound = bindMachineProgram(lowered.program, closure.certificate);
  if (bound.kind !== "complete") throw new Error("Expected bound machine program");
  return { inventory, lowered, closure, bound };
}

function aggregateLoad(result: string, root: ReturnType<typeof sourceBinding>, type: SemanticType) {
  return Object.freeze({
    kind: "load" as const,
    result,
    type,
    integer: null,
    place: Object.freeze({ root, rootType: type, path: Object.freeze([]) }),
    span: sourceSpan(root.span.start + 1),
  });
}

function voidCall(
  callee: ReturnType<typeof sourceBinding>,
  args: readonly string[],
  start: number,
) {
  return Object.freeze({
    kind: "call" as const,
    result: null,
    callee,
    arguments: Object.freeze(args),
    type: VOID,
    span: sourceSpan(start),
  });
}

describe("call ABI and scalar retention", () => {
  it("binds a no-argument two-target call to a page-safe local thunk", () => {
    const callbackType = Object.freeze({
      kind: "function" as const,
      parameters: Object.freeze([]),
      returnType: VOID,
    });
    const callback = Object.freeze({ id: sourceBinding(1601), type: callbackType });
    const indirect = Object.freeze({
      kind: "indirect-call" as const,
      result: null,
      target: "callback",
      arguments: Object.freeze([]),
      signature: callbackType,
      type: VOID,
      span: sourceSpan(1602),
    });
    const main = semanticFunction(1600, "main", [callback], VOID, [
      semanticBlock(
        "main.entry",
        [loadOperation("callback", callback, 1603), indirect],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const first = semanticFunction(1610, "first", [], VOID, [
      semanticBlock("first.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const second = semanticFunction(1620, "second", [], VOID, [
      semanticBlock("second.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const base = wholeProgramFor([main, first, second]);
    const program: WholeProgram = Object.freeze({
      ...base,
      callGraph: Object.freeze([
        Object.freeze({ function: main.id, callees: Object.freeze([first.id, second.id]) }),
        Object.freeze({ function: first.id, callees: Object.freeze([]) }),
        Object.freeze({ function: second.id, callees: Object.freeze([]) }),
      ]),
      indirectTargets: new Map([[indirect, Object.freeze([first.id, second.id])]]),
    });
    const { bound } = lowerCloseBind(program);
    const blocks = bound.program.functions[0]!.blocks;
    const instructions = blocks.flatMap(({ instructions }) => instructions);
    expect(instructions.filter(({ opcode }) => opcode === "cmp")).toEqual([]);
    const thunkCall = instructions.find(({ opcode }) => opcode === "jsr");
    expect(thunkCall?.operand).toMatchObject({ kind: "label" });
    const thunk = blocks.find(
      ({ label }) =>
        label === (thunkCall?.operand?.kind === "label" ? thunkCall.operand.label : ""),
    );
    expect(thunk?.instructions).toMatchObject([{ opcode: "jmp", mode: "indirect" }]);
    const pointer = thunk?.instructions[0]?.operand;
    expect(pointer?.kind).toBe("absolute");
    if (pointer?.kind !== "absolute") throw new Error("Expected bound indirect pointer");
    expect(pointer.value & 0xff).not.toBe(0xff);
    expect(instructions.some(({ operand }) => operand?.kind === "storage")).toBe(false);
  });

  it("closes the one-byte retained-pointer scratch before directional copy binding", () => {
    const array: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 300,
      size: 300,
    });
    const input = Object.freeze({ id: sourceBinding(1400), type: array });
    const output = Object.freeze({ id: sourceBinding(1401), type: array });
    const sourcePlace = Object.freeze({
      root: input.id,
      rootType: array,
      path: Object.freeze([]),
    });
    const targetPlace = Object.freeze({
      root: output.id,
      rootType: array,
      path: Object.freeze([]),
    });
    const copy = semanticFunction(1399, "copy", [input, output], VOID, [
      semanticBlock(
        "copy.entry",
        [
          Object.freeze({
            kind: "place-address" as const,
            result: "borrowed",
            place: sourcePlace,
            type: array,
            integer: null,
            span: sourceSpan(1402),
          }),
          Object.freeze({
            kind: "store" as const,
            place: targetPlace,
            value: "borrowed",
            type: array,
            span: sourceSpan(1403),
          }),
          Object.freeze({
            kind: "store" as const,
            place: targetPlace,
            value: "borrowed",
            type: array,
            span: sourceSpan(1404),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const result = lowerCloseBind(wholeProgramFor([copy]));
    const savedPage = result.closure.inventory.requests.find(({ id }) =>
      id.includes("aggregate-source-page:borrowed"),
    );
    expect(savedPage).toMatchObject({ storageClass: "temporary", bytes: 1, region: "ram" });
    expect(result.inventory.requests.some(({ id }) => id === savedPage?.id)).toBe(false);
    expect(result.lowered.binder.candidateRequestIds).toContain(savedPage?.id);
    expect(
      result.closure.certificate.homes.some(({ requestId }) => requestId === savedPage?.id),
    ).toBe(true);
    expect(
      result.closure.inventory.requests.some(({ id }) => id.includes("aggregate-snapshot")),
    ).toBe(false);
    const sourcePointer = result.closure.inventory.requests.find(({ id }) =>
      id.includes("aggregate-address:borrowed"),
    );
    expect(sourcePointer).toMatchObject({ storageClass: "pointer", bytes: 2 });
    expect(
      result.closure.certificate.interference.some(
        ({ left, right }) =>
          (left === savedPage?.id && right === sourcePointer?.id) ||
          (right === savedPage?.id && left === sourcePointer?.id),
      ),
    ).toBe(true);
    expect(result.bound.kind).toBe("complete");
  });

  it("omits inlined scalar constants from resident data", () => {
    const main = semanticFunction(900, "main", [], VOID, [
      semanticBlock("main.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const constant = sourceBinding(910);
    const base = wholeProgramFor([main]);
    const semantic: SemanticProgram = Object.freeze({
      ...base.semantic,
      globals: Object.freeze([
        Object.freeze({
          id: constant,
          storage: "constant" as const,
          type: BYTE,
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: null,
          blocks: Object.freeze([]),
          source: constant.span,
        }),
      ]),
    });
    const result = lowerCloseBind(Object.freeze({ ...base, semantic }));

    expect(result.bound.program.data.filter(({ kind }) => kind === "immutable")).toEqual([]);
  });

  it("passes a fixed-array base address and forwards its two-byte parameter pointer", () => {
    const array: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 4,
      size: 4,
    });
    const local = sourceBinding(1010);
    const forwardedParameter = Object.freeze({ id: sourceBinding(1020), type: array });
    const sinkParameter = Object.freeze({ id: sourceBinding(1030), type: array });
    const sink = semanticFunction(1040, "sink", [sinkParameter], VOID, [
      semanticBlock("sink.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const forward = semanticFunction(1050, "forward", [forwardedParameter], VOID, [
      semanticBlock(
        "forward.entry",
        [
          aggregateLoad("forwarded", forwardedParameter.id, array),
          voidCall(sink.id, ["forwarded"], 1051),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const main = semanticFunction(1000, "main", [], VOID, [
      semanticBlock(
        "main.entry",
        [aggregateLoad("local", local, array), voidCall(forward.id, ["local"], 1012)],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);

    const result = lowerCloseBind(wholeProgramFor([main, forward, sink]));
    const mainInstructions = result.lowered.program.functions[0]!.blocks[0]!.instructions;
    const forwardInstructions = result.lowered.program.functions[1]!.blocks[0]!.instructions;
    expect(
      mainInstructions
        .filter(({ opcode }) => opcode === "lda")
        .slice(0, 2)
        .map(({ mode, operand }) => ({ mode, operand })),
    ).toEqual([
      expect.objectContaining({
        mode: "immediate",
        operand: expect.objectContaining({ kind: "storage", addressByte: "low" }),
      }),
      expect.objectContaining({
        mode: "immediate",
        operand: expect.objectContaining({ kind: "storage", addressByte: "high" }),
      }),
    ]);
    const forwardedLoads = forwardInstructions
      .filter(({ opcode }) => opcode === "lda")
      .slice(0, 2)
      .map(({ operand }) => operand);
    expect(forwardedLoads).toEqual([
      expect.objectContaining({ kind: "storage", offset: 0 }),
      expect.objectContaining({ kind: "storage", offset: 1 }),
    ]);
    expect(forwardedLoads.every((operand) => operand !== null && !("addressByte" in operand))).toBe(
      true,
    );
    expect(
      result.inventory.requests.filter(({ storageClass }) => storageClass === "parameter"),
    ).toEqual([expect.objectContaining({ bytes: 2 }), expect.objectContaining({ bytes: 2 })]);
  });

  it("passes a global packed-struct base address through closure and binding", () => {
    const globalId = sourceBinding(1110);
    const record: SemanticType = Object.freeze({
      kind: "struct",
      binding: sourceBinding(1111),
      size: 3,
      fields: Object.freeze([
        Object.freeze({ name: "tag", type: BYTE, offset: 0 }),
        Object.freeze({ name: "value", type: BYTE, offset: 1 }),
        Object.freeze({ name: "flags", type: BYTE, offset: 2 }),
      ]),
    });
    const parameter = Object.freeze({ id: sourceBinding(1120), type: record });
    const sink = semanticFunction(1130, "sink-struct", [parameter], VOID, [
      semanticBlock("sink.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const main = semanticFunction(1100, "main", [], VOID, [
      semanticBlock(
        "main.entry",
        [
          aggregateLoad("global-record", globalId, record),
          voidCall(sink.id, ["global-record"], 1102),
        ],
        Object.freeze({ kind: "return" as const, value: null }),
      ),
    ]);
    const base = wholeProgramFor([main, sink]);
    const semantic: SemanticProgram = Object.freeze({
      ...base.semantic,
      globals: Object.freeze([
        Object.freeze({
          id: globalId,
          storage: "module" as const,
          type: record,
          initialBytes: null,
          runtimeInitialBytes: null,
          entry: null,
          blocks: Object.freeze([]),
          source: sourceSpan(1110),
        }),
      ]),
    });
    const program = Object.freeze({ ...base, semantic });

    const result = lowerCloseBind(program);
    const instructions = result.lowered.program.functions[0]!.blocks[0]!.instructions;
    expect(
      instructions
        .filter(({ opcode }) => opcode === "lda")
        .slice(0, 2)
        .map(({ mode, operand }) => ({ mode, operand })),
    ).toEqual([
      expect.objectContaining({
        mode: "immediate",
        operand: expect.objectContaining({ kind: "label", addressByte: "low" }),
      }),
      expect.objectContaining({
        mode: "immediate",
        operand: expect.objectContaining({ kind: "label", addressByte: "high" }),
      }),
    ]);
    expect(result.bound.program.data).toEqual([
      expect.objectContaining({ kind: "bss", bytes: [0, 0, 0] }),
      expect.objectContaining({
        id: "platform.startup-state",
        kind: "bss",
        bytes: new Array<number>(50).fill(0),
      }),
    ]);
  });

  it("captures a scalar load before a call can mutate its source", () => {
    const value = Object.freeze({ id: sourceBinding(1210), type: BYTE });
    const mutate = semanticFunction(1220, "mutate", [], VOID, [
      semanticBlock("mutate.entry", [], Object.freeze({ kind: "return" as const, value: null })),
    ]);
    const call = voidCall(mutate.id, [], 1202);
    const main = semanticFunction(1200, "main", [value], BYTE, [
      semanticBlock(
        "main.entry",
        [loadOperation("old", value, 1201), call],
        Object.freeze({ kind: "return" as const, value: "old" }),
      ),
    ]);
    const lifetime: ValueLifetime = Object.freeze({
      function: main.id,
      value: "old",
      definition: Object.freeze({ block: "main.entry", operation: 0 }),
      liveAt: Object.freeze([Object.freeze({ block: "main.entry", operation: 2 })]),
      callsCrossed: Object.freeze([call.span]),
    });

    const result = lowerCloseBind(wholeProgramFor([main, mutate], [lifetime]));
    const stage = result.inventory.requests.filter(
      ({ storageClass, value: staged }) => storageClass === "argument-stage" && staged === "old",
    );
    expect(stage).toHaveLength(1);
    const instructions = result.lowered.program.functions[0]!.blocks[0]!.instructions;
    const callIndex = instructions.findIndex(({ opcode }) => opcode === "jsr");
    expect(instructions.slice(0, callIndex).map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(instructions.at(-1)?.operand).toEqual(
      expect.objectContaining({ kind: "storage", requestId: stage[0]!.id }),
    );
    expect(
      result.lowered.program.requiredStorage.some(({ id }) => id.includes("retained-value:old")),
    ).toBe(false);
  });

  it("captures a scalar load before a same-place store", () => {
    const value = Object.freeze({ id: sourceBinding(1310), type: BYTE });
    const main = semanticFunction(1300, "main", [value], BYTE, [
      semanticBlock(
        "main.entry",
        [
          loadOperation("old", value, 1301),
          Object.freeze({
            kind: "constant" as const,
            result: "replacement",
            type: BYTE,
            integer: null,
            value: 9n,
            span: sourceSpan(1302),
          }),
          Object.freeze({
            kind: "store" as const,
            place: Object.freeze({ root: value.id, path: Object.freeze([]) }),
            value: "replacement",
            type: BYTE,
            span: sourceSpan(1303),
          }),
        ],
        Object.freeze({ kind: "return" as const, value: "old" }),
      ),
    ]);
    const lifetime: ValueLifetime = Object.freeze({
      function: main.id,
      value: "old",
      definition: Object.freeze({ block: "main.entry", operation: 0 }),
      liveAt: Object.freeze([Object.freeze({ block: "main.entry", operation: 2 })]),
      callsCrossed: Object.freeze([]),
    });

    const result = lowerCloseBind(wholeProgramFor([main], [lifetime]));
    const stage = result.inventory.requests.filter(
      ({ storageClass, value: staged }) => storageClass === "argument-stage" && staged === "old",
    );
    expect(stage).toHaveLength(1);
    const instructions = result.lowered.program.functions[0]!.blocks[0]!.instructions;
    expect(instructions.slice(0, 2).map(({ opcode }) => opcode)).toEqual(["lda", "sta"]);
    expect(instructions.at(-1)?.operand).toEqual(
      expect.objectContaining({ kind: "storage", requestId: stage[0]!.id }),
    );
  });
});
