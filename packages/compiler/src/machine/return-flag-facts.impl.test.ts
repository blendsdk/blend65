import { describe, expect, it } from "vitest";
import { NMOS_6510, nmosInstructionState } from "../target/nmos6510.js";
import { nop, state } from "./lowering-test-support.js";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import { returnSettlesFlags } from "./return-flag-facts.js";

/** The entry label of the callee every case below asks about. */
const CALLEE = "fn.masked";

/** One instruction carrying the documented architectural effects of its mnemonic. */
function real(opcode: string, mode = "implied"): MachineInstruction {
  const facts = nmosInstructionState(NMOS_6510, opcode, mode);
  if (facts === null) throw new Error(`No documented form for ${opcode} ${mode}`);
  return Object.freeze({
    ...nop(),
    opcode,
    mode,
    uses: state(facts.usesRegisters, facts.usesFlags),
    defines: state(facts.definesRegisters, facts.definesFlags),
  });
}

/** One instruction built from the inert default, overriding only what a case needs. */
function instruction(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return Object.freeze({ ...nop(), ...overrides });
}

/** A plain direct call naming one body. */
function call(label = CALLEE, overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return instruction({
    opcode: "jsr",
    mode: "absolute",
    operand: Object.freeze({ kind: "label" as const, label }),
    ...overrides,
  });
}

/** One block whose terminator returns unless a case replaces it. */
function block(
  label: string,
  instructions: readonly MachineInstruction[],
  overrides: Partial<MachineBlock> = {},
): MachineBlock {
  return Object.freeze({
    label,
    instructions: Object.freeze(instructions),
    terminator: Object.freeze({ kind: "return" as const }),
    ...overrides,
  });
}

/** One body with a stable entry label and the blocks a case needs. */
function body(id: string, blocks: readonly MachineBlock[]): MachineFunction {
  return Object.freeze({ id, blocks: Object.freeze(blocks) });
}

/** The caller, which never matters to the answer except when it is the callee. */
const MAIN = body("fn.main", [block("fn.main.0", [call()])]);

/** Ask the question about one callee body. */
function settles(callee: MachineFunction, caller: MachineFunction = MAIN): boolean {
  return returnSettlesFlags(new Map([[callee.id, callee]]), call(callee.id), caller);
}

describe("a returned byte whose flags describe it", () => {
  it("accepts an exit whose last write of A set both flags", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("lda", "absolute"), real("and", "immediate")]),
    ]);
    expect(settles(callee)).toBe(true);
  });

  it("accepts a bare load returned", () => {
    expect(settles(body(CALLEE, [block(`${CALLEE}.0`, [real("lda", "absolute")])]))).toBe(true);
  });

  it("accepts a store after the producer, which writes no flag", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("lda", "absolute"), real("sta", "absolute")]),
    ]);
    expect(settles(callee)).toBe(true);
  });

  it("accepts two exits that both settle the pair", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("lda", "absolute"), real("and", "immediate")]),
      block(`${CALLEE}.1`, [real("lda", "immediate")]),
    ]);
    expect(settles(callee)).toBe(true);
  });

  it("ignores blocks that do not end in a return", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("asl", "accumulator"), real("dex")], {
        terminator: Object.freeze({ kind: "goto" as const, target: `${CALLEE}.1` }),
      }),
      block(`${CALLEE}.1`, [real("lda", "absolute")]),
    ]);
    expect(settles(callee)).toBe(true);
  });

  // The weakest exit governs: one of these leaves the flags of a loop counter.
  it("refuses when one of two exits does not settle the pair", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("lda", "absolute"), real("and", "immediate")]),
      block(`${CALLEE}.1`, [real("dex")]),
    ]);
    expect(settles(callee)).toBe(false);
  });

  // This is the shape the filed witness actually generates: the value falls out
  // of a shift loop into a block holding nothing but the return, so the flags
  // belong to the loop counter and say nothing about the byte in A.
  it("refuses an exit that writes no A at all", () => {
    expect(settles(body(CALLEE, [block(`${CALLEE}.0`, [])]))).toBe(false);
    const fallthrough = body(CALLEE, [
      block(`${CALLEE}.0`, [real("asl", "accumulator"), real("dex")], {
        terminator: Object.freeze({ kind: "goto" as const, target: `${CALLEE}.1` }),
      }),
      block(`${CALLEE}.1`, []),
    ]);
    expect(settles(fallthrough)).toBe(false);
  });

  it("refuses a later write of either flag", () => {
    for (const opcode of ["cmp", "cpx", "cpy"]) {
      const callee = body(CALLEE, [
        block(`${CALLEE}.0`, [real("lda", "absolute"), real(opcode, "immediate")]),
      ]);
      expect(settles(callee)).toBe(false);
    }
  });

  // No documented mnemonic writes A without writing both flags, so this one is
  // built. The barrier is kept because the claim is about this write settling
  // the pair, not about which opcodes happen to do so today.
  it("refuses a write of A that settles no flag", () => {
    const silent = instruction({ opcode: "lda", mode: "absolute", defines: state(["a"]) });
    expect(settles(body(CALLEE, [block(`${CALLEE}.0`, [silent])]))).toBe(false);
  });

  it("refuses a body with no reachable return", () => {
    const callee = body(CALLEE, [
      block(`${CALLEE}.0`, [real("lda", "absolute")], {
        terminator: Object.freeze({ kind: "unreachable" as const }),
      }),
    ]);
    expect(settles(callee)).toBe(false);
    expect(settles(body(CALLEE, []))).toBe(false);
  });

  it("refuses a call the program cannot resolve to a body", () => {
    const callee = body(CALLEE, [block(`${CALLEE}.0`, [real("lda", "absolute")])]);
    expect(returnSettlesFlags(new Map(), call(CALLEE), MAIN)).toBe(false);
    expect(returnSettlesFlags(new Map([[callee.id, callee]]), call("fn.other"), MAIN)).toBe(false);
  });

  it("refuses an operand that is not a plain entry label", () => {
    const callee = body(CALLEE, [block(`${CALLEE}.0`, [real("lda", "absolute")])]);
    const bodies = new Map([[callee.id, callee]]);
    for (const operand of [
      Object.freeze({ kind: "label" as const, label: CALLEE, offset: 2 }),
      Object.freeze({ kind: "label" as const, label: CALLEE, addressByte: "low" as const }),
      Object.freeze({
        kind: "label" as const,
        label: CALLEE,
        addressTransform: "block-index" as const,
      }),
      Object.freeze({ kind: "absolute" as const, value: 0x0900 }),
      null,
    ])
      expect(returnSettlesFlags(bodies, call(CALLEE, { operand }), MAIN)).toBe(false);
  });

  // Recursion is rejected by the language, so no accepted program reaches this.
  // It stays because a certificate resting on its own conclusion is not one.
  it("refuses a body asked about itself", () => {
    const self = body(CALLEE, [block(`${CALLEE}.0`, [real("lda", "absolute")])]);
    expect(settles(self, self)).toBe(false);
  });
});
