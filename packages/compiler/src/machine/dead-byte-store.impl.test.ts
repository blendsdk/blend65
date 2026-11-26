import { describe, expect, it } from "vitest";
import { deadByteStore, unreadTemporaryBytes } from "./dead-byte-store.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineProgram,
} from "./machine-types.js";
import {
  BYTE,
  VOID,
  lowerFunctions,
  nop,
  semanticBlock,
  semanticFunction,
  sourceParameter,
  sourceSpan,
} from "./lowering-test-support.js";

/** The temporary every case stores into. */
const TEMP = "machine:test:retained-value:temp";

/** The source function every machine body below is attributed to. */
const SOURCE = semanticFunction(10, "owner", [sourceParameter(11, BYTE)], VOID, [
  semanticBlock("owner.entry", [], Object.freeze({ kind: "return" as const, value: null })),
]);

/**
 * A real lowered program whose declared storage gains one private two-byte
 * temporary, so the rule's temporary test sees an ordinary request.
 */
function baseProgram(): MachineProgram {
  const lowered = lowerFunctions([SOURCE]);
  if (lowered.kind !== "complete") throw new Error("Expected complete lowering");
  const template = [...lowered.program.requiredStorage, ...lowered.inventory.requests][0];
  if (template === undefined) throw new Error("Expected a storage request to copy");
  return Object.freeze({
    ...lowered.program,
    requiredStorage: Object.freeze([
      ...lowered.program.requiredStorage,
      Object.freeze({ ...template, id: TEMP, binding: null, bytes: 2, persistent: false }),
    ]),
  });
}

/** One instruction on the temporary, in a direct or indexed mode. */
function onTemp(opcode: string, offset: number, mode = "storage"): MachineInstruction {
  return Object.freeze({
    ...nop(),
    opcode,
    mode,
    operand: Object.freeze({ kind: "storage" as const, requestId: TEMP, offset }),
    cost: Object.freeze({ bytes: 3, minCycles: 4, maxCycles: 4 }),
    source: sourceSpan(20 + offset),
  });
}

/** One returning body. */
function body(id: string, instructions: readonly MachineInstruction[]): MachineFunction {
  const block: MachineBlock = Object.freeze({
    label: `${id}.0`,
    instructions: Object.freeze(instructions),
    terminator: Object.freeze({ kind: "return" as const }),
  });
  return Object.freeze({ id, blocks: Object.freeze([block]) });
}

/**
 * Run the rule with `items` as the bodies it may rewrite and `others` present
 * in the program but outside its reach.
 */
function run(
  items: readonly MachineFunction[],
  others: readonly MachineFunction[] = [],
  allowed?: ReadonlySet<string>,
) {
  const program = Object.freeze({
    ...baseProgram(),
    functions: Object.freeze([...items, ...others]),
  });
  return deadByteStore(program, items, () => SOURCE, allowed);
}

/** Opcodes left in the first body after the rule. */
function opcodes(result: ReturnType<typeof run>): readonly string[] {
  return result.functions[0]!.blocks[0]!.instructions.map(({ opcode }) => opcode);
}

describe("dead temporary-byte stores", () => {
  it("removes a store to a byte nothing reads while keeping the byte that is read", () => {
    const result = run([body("fn.a", [onTemp("sta", 0), onTemp("stx", 1), onTemp("lda", 0)])]);
    expect(opcodes(result)).toEqual(["sta", "lda"]);
    expect(result.applied.map(({ ruleId }) => ruleId)).toEqual(["cleanup.dead-byte-store"]);
  });

  it("keeps a store whose byte an indexed read can reach", () => {
    // `lda temp,y` reads temp + Y, so it cannot vouch for any one byte being unread.
    const result = run([
      body("fn.a", [onTemp("sta", 0), onTemp("stx", 1), onTemp("lda", 0, "absolute-y")]),
    ]);
    expect(opcodes(result)).toEqual(["sta", "stx", "lda"]);
    expect(result.applied).toEqual([]);
  });

  it("keeps an indexed store, whose byte depends on a register", () => {
    const result = run([body("fn.a", [onTemp("sta", 1, "absolute-x")])]);
    expect(opcodes(result)).toEqual(["sta"]);
  });

  it("keeps a store whose byte a body outside the rewritten set reads", () => {
    const reader = body("fn.reader", [onTemp("lda", 1)]);
    const result = run([body("fn.a", [onTemp("sta", 1)])], [reader]);
    expect(opcodes(result)).toEqual(["sta"]);
  });

  it("keeps every store to a temporary read through an indirect pointer", () => {
    const pointer: MachineInstruction = Object.freeze({
      ...nop(),
      opcode: "lda",
      mode: "indirect-indexed-y",
      operand: Object.freeze({ kind: "indirect-y" as const, requestId: TEMP }),
    });
    const result = run([body("fn.a", [onTemp("sta", 0), onTemp("sta", 1), pointer])]);
    expect(opcodes(result)).toEqual(["sta", "sta", "lda"]);
  });

  it("keeps a store the reference still reads, even when this layout does not", () => {
    // Representations are proved against the reference instruction for
    // instruction, so a store may go only where the reference has no reader.
    const store = () => [body("fn.a", [onTemp("sta", 1)])];
    expect(opcodes(run(store(), [], new Set([`${TEMP}:0`])))).toEqual(["sta"]);
    expect(run(store(), [], new Set([`${TEMP}:1`])).applied).toHaveLength(1);
  });

  it("publishes exactly the temporary bytes no body reads", () => {
    const program = Object.freeze({
      ...baseProgram(),
      functions: Object.freeze([
        body("fn.a", [onTemp("sta", 0), onTemp("sta", 1), onTemp("lda", 0)]),
      ]),
    });
    expect([...unreadTemporaryBytes(program)]).toEqual([`${TEMP}:1`]);
  });
});
