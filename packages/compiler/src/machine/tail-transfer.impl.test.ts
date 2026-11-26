import { describe, expect, it } from "vitest";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import {
  VOID,
  nop,
  selectedProfile,
  semanticBlock,
  semanticFunction,
} from "./lowering-test-support.js";
import { tailTransfer } from "./tail-transfer.js";

/** The single source function every machine body below is attributed to. */
const SOURCE = semanticFunction(10, "caller", [], VOID, [
  semanticBlock("caller.entry", [], Object.freeze({ kind: "return" as const, value: null })),
]);

/** One instruction built from the inert default, overriding only what a case needs. */
function instruction(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return Object.freeze({ ...nop(), ...overrides });
}

/** A plain direct call naming one label. */
function call(label: string, overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return instruction({
    opcode: "jsr",
    mode: "absolute",
    operand: Object.freeze({ kind: "label" as const, label }),
    cost: Object.freeze({ bytes: 3, minCycles: 6, maxCycles: 6 }),
    ...overrides,
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

/** Mainline as the cleanup pipeline defines it: no interrupt context. */
function mainline(fn: MachineFunction): boolean {
  const context = fn.executionContext;
  return (
    context === undefined || (context.domain === "main" && context.irq === 0 && context.nmi === 0)
  );
}

/** Run the rule over a whole program in which every body may change. */
function run(bodies: readonly MachineFunction[]) {
  return tailTransfer(selectedProfile().cpu, bodies, bodies, mainline, () => SOURCE);
}

/** A callee that only returns. */
const child = body("fn.child", [block("fn.child.0", [instruction()])]);

describe("tail transfer", () => {
  it("turns a closing call before a return into a jump to the same label", () => {
    const caller = body("fn.touch", [block("fn.touch.0", [instruction(), call("fn.child")])]);
    const result = run([caller, child]);
    const changed = result.functions[0]!.blocks[0]!;
    expect(changed.instructions.map(({ opcode }) => opcode)).toEqual(["nop"]);
    expect(changed.terminator).toMatchObject({ kind: "jump", opcode: "jmp", target: "fn.child" });
    expect(result.applied).toHaveLength(1);
    expect(result.applied[0]!.ruleId).toBe("cleanup.tail-transfer");
    // A call (6) and a return (6) become one jump (3).
    expect(result.applied[0]!.obligations).toContainEqual({
      kind: "cost",
      before: { component: "T", value: "9" },
      after: { component: "T", value: "0" },
    });
  });

  it("keeps a call that is followed by more work", () => {
    const caller = body("fn.touch", [block("fn.touch.0", [call("fn.child"), instruction()])]);
    const result = run([caller, child]);
    expect(result.functions[0]).toBe(caller);
    expect(result.applied).toEqual([]);
  });

  it("keeps a call whose block leaves by a jump rather than a return", () => {
    // The entry function's continuation is the restoration, not a return.
    const caller = body("fn.main", [
      block("fn.main.0", [call("fn.child")], {
        terminator: Object.freeze({
          kind: "jump" as const,
          opcode: "jmp" as const,
          target: "startup.restore",
          cost: Object.freeze({ bytes: 3, minCycles: 3, maxCycles: 3 }),
        }),
      }),
    ]);
    expect(run([caller, child]).applied).toEqual([]);
  });

  it("keeps the call when anything reachable from the callee reads the stack pointer", () => {
    // `fn.child` calls `fn.peek`, which reads the stack above its frame.
    const peek = body("fn.peek", [block("fn.peek.0", [instruction({ opcode: "tsx" })])]);
    const reading = body("fn.child", [block("fn.child.0", [call("fn.peek")])]);
    const caller = body("fn.touch", [block("fn.touch.0", [call("fn.child")])]);
    const result = run([caller, reading, peek]);
    expect(result.functions[0]).toBe(caller);
  });

  it("keeps the call when the callee moves the stack pointer", () => {
    const moving = body("fn.child", [block("fn.child.0", [instruction({ opcode: "txs" })])]);
    const caller = body("fn.touch", [block("fn.touch.0", [call("fn.child")])]);
    expect(run([caller, moving]).functions[0]).toBe(caller);
  });

  it("ignores data labels when walking the callee", () => {
    // A load from a global names a label where no code runs.
    const loading = body("fn.child", [
      block("fn.child.0", [
        instruction({
          opcode: "lda",
          mode: "absolute",
          operand: Object.freeze({ kind: "label" as const, label: "global.total" }),
        }),
      ]),
    ]);
    const caller = body("fn.touch", [block("fn.touch.0", [call("fn.child")])]);
    expect(run([caller, loading]).applied).toHaveLength(1);
  });

  it("keeps a call to code outside the program", () => {
    const caller = body("fn.touch", [block("fn.touch.0", [call("firmware.chrout")])]);
    expect(run([caller]).functions[0]).toBe(caller);
  });

  it("keeps the call in a body that runs in interrupt context", () => {
    const handler = body("fn.handler", [block("fn.handler.0", [call("fn.child")])], {
      executionContext: Object.freeze({ domain: "irq" as const, irq: 1, nmi: 0 }),
    });
    expect(run([handler, child]).functions[0]).toBe(handler);
  });

  it("keeps the call into a body that runs in interrupt context", () => {
    const shared = body("fn.child", [block("fn.child.0", [instruction()])], {
      executionContext: Object.freeze({ domain: "irq" as const, irq: 1, nmi: 0 }),
    });
    const caller = body("fn.touch", [block("fn.touch.0", [call("fn.child")])]);
    expect(run([caller, shared]).functions[0]).toBe(caller);
  });

  it("keeps a call that belongs to a KERNAL load sequence", () => {
    const caller = body("fn.touch", [
      block("fn.touch.0", [call("fn.child", { loadUnitRole: "callSite" })]),
    ]);
    expect(run([caller, child]).functions[0]).toBe(caller);
  });

  it("keeps a call naming part of a label rather than its whole address", () => {
    const caller = body("fn.touch", [
      block("fn.touch.0", [
        call("fn.child", {
          operand: Object.freeze({ kind: "label" as const, label: "fn.child", offset: 1 }),
        }),
      ]),
    ]);
    expect(run([caller, child]).functions[0]).toBe(caller);
  });

  it("transfers to a block of the caller's own body, such as an emitted helper", () => {
    const caller = body("fn.calculate", [
      block("fn.calculate.0", [call("fn.calculate.helper")]),
      block("fn.calculate.helper", [instruction()]),
    ]);
    const result = run([caller]);
    expect(result.functions[0]!.blocks[0]!.terminator).toMatchObject({
      kind: "jump",
      target: "fn.calculate.helper",
    });
  });
});
