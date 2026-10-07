import { describe, expect, it } from "vitest";
import { inventoryStorage } from "../storage/inventory.js";
import { closeStorage } from "../storage/closure.js";
import { bindMachineProgram } from "./bind.js";
import {
  BYTE,
  WORD,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

describe("copied parameter address binding", () => {
  it.each([BYTE, WORD])("should take the home address of a copied $name parameter", (type) => {
    const parameter = { id: sourceBinding(1701), type };
    const fn = semanticFunction(1700, "borrow", [parameter], BYTE, [
      semanticBlock(
        "borrow.entry",
        [
          {
            kind: "place-address",
            result: "address",
            type: WORD,
            integer: { width: 16, signed: false, wrap: true },
            place: { root: parameter.id, rootType: type, path: [] },
            span: sourceSpan(1702),
          },
          {
            kind: "memory-read",
            result: "observed",
            type: BYTE,
            integer: { width: 8, signed: false, wrap: true },
            address: "address",
            width: 1,
            byteOrder: "low-first",
            volatile: true,
            span: sourceSpan(1703),
          },
        ],
        { kind: "return", value: "observed" },
      ),
    ]);
    const lowered = lowerFunctions([fn]);
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") throw new Error("Expected parameter address lowering");
    const instructions = lowered.program.functions[0]!.blocks[0]!.instructions;
    const parameterOperands = instructions.flatMap(({ operand }) =>
      operand?.kind === "storage" && operand.requestId.includes(":parameter:") ? [operand] : [],
    );
    // A copied parameter is not a two-byte borrowed pointer to somebody else's object.
    expect(parameterOperands.map(({ addressByte, offset }) => ({ addressByte, offset }))).toEqual([
      { addressByte: "low", offset: 0 },
      { addressByte: "high", offset: 0 },
    ]);
    const inventory = inventoryStorage(wholeProgramFor([fn]));
    const closure = closeStorage(inventory, selectedProfile().storage, lowered.binder);
    expect(closure.kind).toBe("complete");
    if (closure.kind !== "complete") throw new Error("Expected closed borrowed parameter storage");
    const bound = bindMachineProgram(lowered.program, closure.certificate);
    expect(bound.kind).toBe("complete");
    // The access remains one volatile read after its address is formed and bound.
    if (bound.kind !== "complete") throw new Error("Expected bound borrowed parameter address");
    expect(
      bound.program.functions[0]!.blocks[0]!.instructions.flatMap(({ memory }) =>
        memory.filter(({ kind, volatile }) => kind === "read" && volatile),
      ),
    ).toHaveLength(1);
  });
});
