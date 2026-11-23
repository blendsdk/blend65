import { describe, expect, it } from "vitest";
import { calleeRewritesFlags, directCallSites } from "./call-site-facts.js";
import type { MachineBlock, MachineFunction, MachineInstruction } from "./machine-types.js";
import { nop, state } from "./lowering-test-support.js";

/** The entry label of the body every case below asks about. */
const APPLY = "fn.apply";

/** One instruction built from the inert default, overriding only what a case needs. */
function instruction(overrides: Partial<MachineInstruction> = {}): MachineInstruction {
  return Object.freeze({ ...nop(), ...overrides });
}

/** A plain direct call naming one body. */
function call(label = APPLY, overrides: Partial<MachineInstruction> = {}): MachineInstruction {
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

describe("direct call-site enumeration", () => {
  it("finds one call and reports where it is", () => {
    const caller = body("fn.main", [block("fn.main.0", [instruction(), call()])]);
    const sites = directCallSites([caller], APPLY);
    expect(sites).toHaveLength(1);
    expect(sites?.[0]?.caller).toBe(caller);
    expect(sites?.[0]?.index).toBe(1);
  });

  it("finds every call across several bodies and blocks", () => {
    const sites = directCallSites(
      [
        body("fn.main", [block("fn.main.0", [call()]), block("fn.main.1", [call(), call()])]),
        body("fn.other", [block("fn.other.0", [call()])]),
      ],
      APPLY,
    );
    expect(sites).toHaveLength(4);
  });

  it("ignores calls to other bodies", () => {
    const sites = directCallSites(
      [body("fn.main", [block("fn.main.0", [call("fn.other"), call()])])],
      APPLY,
    );
    expect(sites).toHaveLength(1);
    expect(sites?.[0]?.index).toBe(1);
  });

  // An enumeration over no callers would otherwise read as vacuously satisfied,
  // which is exactly how a label-matching mistake would go unnoticed.
  it("refuses a body nothing calls", () => {
    expect(directCallSites([body("fn.main", [block("fn.main.0", [instruction()])])], APPLY)).toBe(
      null,
    );
    expect(directCallSites([], APPLY)).toBe(null);
  });

  // A stored pointer can be called from anywhere, so the callers are no longer
  // the ones this scan can see.
  it.each([
    [
      "an address byte is taken",
      [
        call(),
        instruction({
          opcode: "lda",
          mode: "immediate",
          operand: Object.freeze({ kind: "label" as const, label: APPLY, addressByte: "low" }),
        }),
      ],
    ],
    [
      "the label is reached through a layout relation",
      [
        call(),
        instruction({
          opcode: "lda",
          operand: Object.freeze({
            kind: "label" as const,
            label: APPLY,
            addressTransform: "block-index",
          }),
        }),
      ],
    ],
    [
      "the label is offset from its entry",
      [
        call(),
        call(APPLY, {
          operand: Object.freeze({ kind: "label" as const, label: APPLY, offset: 3 }),
        }),
      ],
    ],
    [
      "a memory effect names the label",
      [
        call(),
        instruction({
          opcode: "lda",
          memory: Object.freeze([
            Object.freeze({
              kind: "read" as const,
              address: Object.freeze({ kind: "symbolic" as const, label: APPLY }),
              width: 1 as const,
              volatile: false,
              order: 0,
            }),
          ]),
        }),
      ],
    ],
  ])("refuses a program where %s", (_reason, instructions) => {
    expect(directCallSites([body("fn.main", [block("fn.main.0", instructions)])], APPLY)).toBe(
      null,
    );
  });

  // A body a run-time transfer may reach returns to whoever called the dispatch
  // block, not to the transfer, so its callers are not enumerable here either.
  it("refuses a body a dispatch block records as a candidate", () => {
    const caller = body("fn.main", [
      block("fn.main.0", [call()]),
      block("fn.main.1", [], { indirectTargets: Object.freeze([APPLY]) }),
    ]);
    expect(directCallSites([caller], APPLY)).toBe(null);
  });

  it.each([
    ["jump", Object.freeze({ kind: "jump" as const, opcode: "jmp" as const, target: APPLY })],
    ["fallthrough", Object.freeze({ kind: "fallthrough" as const, target: APPLY })],
  ])("refuses a body entered by a %s rather than a call", (_kind, terminator) => {
    const caller = body("fn.main", [
      block("fn.main.0", [call()]),
      block("fn.main.1", [], { terminator }),
    ]);
    expect(directCallSites([caller], APPLY)).toBe(null);
  });
});

describe("called body flag rewriting", () => {
  /** Bodies indexed the way a call names them. */
  function bodies(opening: MachineInstruction): ReadonlyMap<string, MachineFunction> {
    return new Map([[APPLY, body(APPLY, [block("fn.apply.0", [opening])])]]);
  }

  /** A load writes N and Z from the byte it fetched and reads neither. */
  const load = instruction({
    opcode: "lda",
    mode: "absolute",
    defines: state(["a"], ["n", "z"]),
  });

  it("admits a body that opens by writing both flags", () => {
    expect(calleeRewritesFlags(bodies(load), call())).toBe(true);
  });

  // A call encodes no flag of its own, so without this the body behind it could
  // read exactly the pair being proved dead.
  it("refuses a body that opens by pushing the whole status register", () => {
    const push = instruction({
      opcode: "php",
      uses: state([], ["n", "v", "d", "i", "z", "c"]),
      defines: state(),
    });
    expect(calleeRewritesFlags(bodies(push), call())).toBe(false);
  });

  /**
   * Reading the pair is an observation whether or not the same instruction goes
   * on to rewrite it, so the two questions are asked separately. No opcode in the
   * documented set both writes N and Z and reads either, which is why this case
   * builds the opening rather than naming a mnemonic: the barrier holds for any
   * instruction a later pass might construct, not just for today's table.
   */
  it.each([
    ["the zero flag", "z"],
    ["the negative flag", "n"],
  ] as const)("refuses a body whose opening reads %s before rewriting it", (_reason, flag) => {
    const opening = instruction({
      opcode: "lda",
      uses: state([], [flag]),
      defines: state(["a"], ["n", "z"]),
    });
    expect(calleeRewritesFlags(bodies(opening), call())).toBe(false);
  });

  it.each([
    ["only the zero flag", state(["a"], ["z"])],
    ["only the negative flag", state(["a"], ["n"])],
    ["no flag at all", state(["a"])],
  ])("refuses a body whose opening writes %s", (_reason, defines) => {
    expect(calleeRewritesFlags(bodies(instruction({ opcode: "lda", defines })), call())).toBe(
      false,
    );
  });

  it("refuses a call whose target is not a body the program contains", () => {
    expect(calleeRewritesFlags(bodies(load), call("fn.elsewhere"))).toBe(false);
    expect(calleeRewritesFlags(new Map(), call())).toBe(false);
  });

  it("refuses an empty body, which settles nothing about the flags", () => {
    const empty = new Map([[APPLY, body(APPLY, [block("fn.apply.0", [])])]]);
    expect(calleeRewritesFlags(empty, call())).toBe(false);
  });

  it.each([
    [
      "an address byte",
      Object.freeze({ kind: "label" as const, label: APPLY, addressByte: "low" as const }),
    ],
    ["an offset", Object.freeze({ kind: "label" as const, label: APPLY, offset: 2 })],
    ["an absolute address", Object.freeze({ kind: "absolute" as const, value: 0xffd2 })],
  ])("refuses a call naming %s rather than one plain body", (_reason, operand) => {
    expect(calleeRewritesFlags(bodies(load), call(APPLY, { operand }))).toBe(false);
  });
});

describe("a called body that opens with a call of its own", () => {
  /** A load writes N and Z from the byte it fetched and reads neither. */
  const load = instruction({
    opcode: "lda",
    mode: "absolute",
    defines: state(["a"], ["n", "z"]),
  });

  /** One body whose single block holds exactly the given instructions. */
  function at(label: string, ...instructions: readonly MachineInstruction[]) {
    return [label, body(label, [block(`${label}.0`, instructions)])] as const;
  }

  it("follows a wrapper to the body that actually settles the pair", () => {
    const bodies = new Map([at(APPLY, call("fn.inner")), at("fn.inner", load)]);
    expect(calleeRewritesFlags(bodies, call())).toBe(true);
  });

  it("follows a chain of wrappers", () => {
    const bodies = new Map([
      at(APPLY, call("fn.middle")),
      at("fn.middle", call("fn.inner")),
      at("fn.inner", load),
    ]);
    expect(calleeRewritesFlags(bodies, call())).toBe(true);
  });

  it("refuses when the body at the end of the chain settles nothing", () => {
    const push = instruction({ opcode: "php", uses: state([], ["n", "z"]) });
    const bodies = new Map([at(APPLY, call("fn.inner")), at("fn.inner", push)]);
    expect(calleeRewritesFlags(bodies, call())).toBe(false);
  });

  it("refuses a wrapper whose own call names no single body", () => {
    const bodies = new Map([
      at(
        APPLY,
        call("fn.inner", { operand: Object.freeze({ kind: "absolute" as const, value: 0xffd2 }) }),
      ),
      at("fn.inner", load),
    ]);
    expect(calleeRewritesFlags(bodies, call())).toBe(false);
  });

  it("refuses a wrapper calling a body the program does not contain", () => {
    expect(calleeRewritesFlags(new Map([at(APPLY, call("fn.missing"))]), call())).toBe(false);
  });

  // Recursion is rejected by the language, so neither cycle is reachable from
  // accepted source. They are kept because a chain arriving back where it
  // started proves nothing, and termination must not rest on a diagnostic
  // raised in another subsystem.
  it("refuses a body that opens by calling itself", () => {
    expect(calleeRewritesFlags(new Map([at(APPLY, call(APPLY))]), call())).toBe(false);
  });

  it("refuses a cycle of two bodies", () => {
    const bodies = new Map([at(APPLY, call("fn.other")), at("fn.other", call(APPLY))]);
    expect(calleeRewritesFlags(bodies, call())).toBe(false);
  });
});
