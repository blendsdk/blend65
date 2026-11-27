import { describe, expect, it } from "vitest";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import {
  VOID,
  nop,
  selectedProfile,
  semanticBlock,
  semanticFunction,
} from "./lowering-test-support.js";
import { soleContinuation } from "./sole-continuation.js";

/** The single source function every machine body below is attributed to. */
const SOURCE = semanticFunction(10, "caller", [], VOID, [
  semanticBlock("caller.entry", [], Object.freeze({ kind: "return" as const, value: null })),
]);

/** The startup code the program entry continues into. */
const RESTORE = "startup.restore";

/** One instruction built from the inert default, overriding only what a case needs. */
function instruction(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return Object.freeze({ ...nop(), ...overrides });
}

/** A plain direct call naming one label. */
function call(label: string): MachineInstruction {
  return instruction({
    opcode: "jsr",
    mode: "absolute",
    operand: Object.freeze({ kind: "label" as const, label }),
    cost: Object.freeze({ bytes: 3, minCycles: 6, maxCycles: 6 }),
  });
}

/** A jump terminator to one label. */
function jump(target: string) {
  return Object.freeze({
    kind: "jump" as const,
    opcode: "jmp" as const,
    target,
    cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
  });
}

/** One block that returns unless a case replaces its terminator. */
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

/** One ordinary mainline body. */
function body(
  id: string,
  blocks: readonly MachineBlock[],
  overrides: Partial<MachineFunction> = {},
): MachineFunction {
  return Object.freeze({ id, blocks: Object.freeze(blocks), ...overrides });
}

/** The program entry, which ends by calling `callee` and continuing into the restoration. */
function entry(callee: string, before: readonly MachineInstruction[] = []): MachineFunction {
  return body("fn.main", [
    block("fn.main.0", [...before, call(callee)], { terminator: jump(RESTORE) }),
  ]);
}

/** Mainline as the cleanup pipeline defines it: no interrupt context. */
function mainline(fn: MachineFunction): boolean {
  const context = fn.executionContext;
  return (
    context === undefined || (context.domain === "main" && context.irq === 0 && context.nmi === 0)
  );
}

/** Run the rule over a whole program in which every body may change. */
function run(bodies: readonly MachineFunction[]) {
  return soleContinuation(selectedProfile().cpu, bodies, bodies, mainline, () => SOURCE);
}

/** A leaf that does one thing and returns. */
const work = body("fn.work", [block("fn.work.0", [instruction()])]);

describe("sole continuation", () => {
  it("continues the entry into a body it calls last and nobody else calls", () => {
    const result = run([entry("fn.work"), work]);
    const [main, leaf] = result.functions;
    expect(main!.blocks[0]!.instructions).toEqual([]);
    expect(main!.blocks[0]!.terminator).toMatchObject({
      kind: "jump",
      target: "fn.work",
      continuation: true,
    });
    expect(leaf!.blocks[0]!.terminator).toMatchObject({
      kind: "jump",
      target: RESTORE,
      continuation: true,
    });
    expect(result.applied.map(({ ruleId }) => ruleId)).toEqual([
      "cleanup.sole-continuation",
      "cleanup.sole-continuation",
    ]);
  });

  it("follows the continuation into a body the continued body calls last", () => {
    const middle = body("fn.middle", [block("fn.middle.0", [instruction(), call("fn.work")])]);
    const result = run([entry("fn.middle"), middle, work]);
    const [, continued, leaf] = result.functions;
    expect(continued!.blocks[0]!.instructions.map(({ opcode }) => opcode)).toEqual(["nop"]);
    expect(continued!.blocks[0]!.terminator).toMatchObject({ kind: "jump", target: "fn.work" });
    expect(leaf!.blocks[0]!.terminator).toMatchObject({ kind: "jump", target: RESTORE });
  });

  it("keeps the calls to a body that is called more than once", () => {
    const twice = body("fn.main", [
      block("fn.main.0", [call("fn.work"), call("fn.work")], { terminator: jump(RESTORE) }),
    ]);
    const result = run([twice, work]);
    expect(result.functions[0]).toBe(twice);
    expect(result.applied).toEqual([]);
  });

  it("keeps the call to a body whose address is taken", () => {
    const taken = instruction({
      opcode: "lda",
      mode: "immediate",
      operand: Object.freeze({ kind: "label" as const, label: "fn.work", addressByte: "low" }),
    });
    const result = run([entry("fn.work", [taken]), work]);
    expect(result.applied).toEqual([]);
  });

  it("keeps the call to a body with more than one return, which a jump would make larger", () => {
    const branching = body("fn.work", [
      block("fn.work.0", [instruction()], {
        terminator: Object.freeze({
          kind: "branch" as const,
          opcode: "bne" as const,
          target: "fn.work.1",
          fallthrough: "fn.work.2",
          uses: Object.freeze({ registers: Object.freeze([]), flags: Object.freeze(["z"]) }),
          cost: Object.freeze({ bytes: 2, minCycles: 2, maxCycles: 4 }),
        }),
      }),
      block("fn.work.1", [instruction()]),
      block("fn.work.2", [instruction()]),
    ]);
    expect(run([entry("fn.work"), branching]).applied).toEqual([]);
  });

  it("keeps the call to a body that leaves through another body", () => {
    // A transfer out of the callee would let a later return skip the restoration.
    const transfer = body("fn.work", [block("fn.work.0", [], { terminator: jump("fn.other") })]);
    const other = body("fn.other", [block("fn.other.0", [instruction()])]);
    expect(run([entry("fn.work"), transfer, other]).applied).toEqual([]);
  });

  it("keeps the call when anything reachable from the callee reads the stack pointer", () => {
    const reader = body("fn.reader", [block("fn.reader.0", [instruction({ opcode: "tsx" })])]);
    const calling = body("fn.work", [block("fn.work.0", [call("fn.reader"), instruction()])]);
    expect(run([entry("fn.work"), calling, reader]).applied).toEqual([]);
  });

  it("keeps the call to a body that runs in an interrupt context", () => {
    const handler = body("fn.work", work.blocks, {
      executionContext: Object.freeze({ domain: "irq" as const, irq: 1, nmi: 0 }),
    });
    expect(run([entry("fn.work"), handler]).applied).toEqual([]);
  });

  it("leaves a body whose last block returns, rather than continuing into the restoration, alone", () => {
    const ordinary = body("fn.touch", [block("fn.touch.0", [call("fn.work")])]);
    expect(run([ordinary, work]).applied).toEqual([]);
  });

  it("keeps the call when the callee calls code at a numeric address", () => {
    // Firmware or other code the program does not contain may read above its frame.
    const firmware = instruction({
      opcode: "jsr",
      mode: "absolute",
      operand: Object.freeze({ kind: "absolute" as const, value: 0x4000 }),
      cost: Object.freeze({ bytes: 3, minCycles: 6, maxCycles: 6 }),
    });
    const calling = body("fn.work", [block("fn.work.0", [firmware])]);
    expect(run([entry("fn.work"), calling]).applied).toEqual([]);
  });

  it("keeps the call to a body placed at a fixed address", () => {
    // Its exit could never fall into the restoration, and a jump in place of its
    // return can extend the program when it is the last thing loaded.
    const fixed = body("fn.work", work.blocks, {
      placement: Object.freeze({ at: 0xc000, align: 1, noCross: null, region: null }),
    });
    expect(run([entry("fn.work"), fixed]).applied).toEqual([]);
  });
});
