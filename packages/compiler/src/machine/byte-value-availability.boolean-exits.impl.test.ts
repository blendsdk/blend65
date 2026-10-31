import { describe, expect, it } from "vitest";
import type { SemanticFunction, SemanticOperation } from "../semantic/operations.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import {
  deriveBooleanExitFacts,
  machineCost,
  machineInstruction,
  validBooleanExitFacts,
} from "./lower-control.js";
import { selectBooleanCallFlags as selectFlags } from "./lower-call.js";
import { lowerMachineProgram } from "./lower.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
  MachineJumpTerminator,
} from "./machine-types.js";
import {
  BOOLEAN,
  VOID,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceSpan,
  state,
  wholeProgramFor,
} from "./lowering-test-support.js";

const profile = selectedProfile();

/** Fix the fixture CPU while testing exact source-owner and machine-body inputs. */
function selectBooleanCallFlags(
  functions: readonly MachineFunction[],
  owners: ReadonlyMap<string, SemanticFunction>,
) {
  return selectFlags(functions, owners, profile.cpu);
}

/** Use the real CPU state/cost tables for every instruction, including flag restores. */
function instruction(opcode: string, value?: number): MachineInstruction {
  return machineInstruction(
    profile.cpu,
    opcode,
    value === undefined ? "implied" : "immediate",
    value === undefined ? null : { kind: "immediate", value },
    [],
    sourceSpan(30),
  );
}

/** Ordinary returns make no extra state changes in these selected-block fixtures. */
function returned(label: string, instructions: readonly MachineInstruction[] = []): MachineBlock {
  return { label, instructions, terminator: { kind: "return" } };
}

/** Keep transfer targets explicit while using the real CPU's jump cost. */
function jump(target: string): MachineJumpTerminator {
  return { kind: "jump", opcode: "jmp", target, cost: machineCost(profile.cpu, "jmp", "absolute") };
}

/** Small real CFG with a shared empty false return after an accumulator-producing branch. */
function booleanBody(): MachineFunction {
  return {
    id: "selected.callee",
    blocks: [
      {
        label: "entry",
        instructions: [
          machineInstruction(profile.cpu, "lda", "absolute", { kind: "absolute", value: 0x3200 }),
        ],
        terminator: {
          kind: "branch",
          opcode: "beq",
          target: "false",
          fallthrough: "true",
          uses: state([], ["z"]),
          cost: machineCost(profile.cpu, "beq", "relative"),
        },
      },
      returned("false"),
      returned("true", [instruction("lda", 1)]),
    ],
  };
}

/** Source-identified ordinary direct call and exact selected post-call suffix. */
function callFixture(negated = false, suffix?: readonly MachineInstruction[]) {
  const calleeSource = semanticFunction(10, "Any.boolean", [], BOOLEAN, [
    semanticBlock("callee", [], { kind: "unreachable" }),
  ]);
  const call: Extract<SemanticOperation, { kind: "call" }> = {
    kind: "call",
    callee: calleeSource.id,
    arguments: [],
    result: "answer",
    type: BOOLEAN,
    span: sourceSpan(20),
  };
  const callerSource = semanticFunction(1, "Any.caller", [], VOID, [
    semanticBlock(
      "source.entry",
      [
        call,
        ...(negated
          ? [
              {
                kind: "unary" as const,
                operator: "!",
                operand: "answer",
                result: "negated",
                type: BOOLEAN,
                span: sourceSpan(21),
              },
            ]
          : []),
      ],
      {
        kind: "branch",
        condition: negated ? "negated" : "answer",
        whenTrue: "yes",
        whenFalse: "no",
      },
    ),
    semanticBlock("yes", [], { kind: "return", value: null }),
    semanticBlock("no", [], { kind: "return", value: null }),
  ]);
  const capture = { kind: "storage" as const, requestId: "private.call-result" };
  const captured = [
    machineInstruction(profile.cpu, "sta", "storage", capture),
    machineInstruction(profile.cpu, "lda", "storage", capture),
  ];
  const callee = booleanBody();
  const caller: MachineFunction = {
    id: "selected.caller",
    blocks: [
      {
        label: "caller.entry",
        instructions: [
          machineInstruction(
            profile.cpu,
            "jsr",
            "absolute",
            { kind: "label", label: callee.id },
            [],
            call.span,
          ),
          ...(suffix ?? captured),
        ],
        terminator: {
          kind: "branch",
          opcode: negated ? "beq" : "bne",
          target: "yes",
          fallthrough: "no",
          uses: state([], ["z"]),
          cost: machineCost(profile.cpu, "bne", "relative"),
        },
      },
      returned("yes", [instruction("ldx", 0), instruction("lda", 1)]),
      returned("no", [instruction("ldx", 0), instruction("lda", 0)]),
    ],
  };
  const owners = new Map([
    [callee.id, calleeSource],
    [caller.id, callerSource],
  ]);
  return { caller, callee, owners, call };
}

describe("all-exit Boolean certificates", () => {
  it("should prove both canonical exits including the empty edge-proved false arm", () => {
    const fn = booleanBody();
    expect(deriveBooleanExitFacts(fn)?.exits).toEqual(["false", "true"]);
  });

  it("should preserve canonicality when zero and one join at a shared RTS", () => {
    const fn = booleanBody();
    const blocks = fn.blocks.map((block) =>
      block.label === "true"
        ? { ...block, terminator: { kind: "fallthrough" as const, target: "false" } }
        : block,
    );
    expect(deriveBooleanExitFacts({ ...fn, blocks })?.exits).toEqual(["false"]);
  });

  it.each(["plp", "ldx", "cmp", "lda", "jsr"])(
    "should reject an exit invalidated by %s",
    (opcode) => {
      const fn = booleanBody();
      const poison =
        opcode === "ldx"
          ? instruction("ldx", 9)
          : opcode === "cmp"
            ? instruction("cmp", 1)
            : opcode === "lda"
              ? instruction("lda", 2)
              : opcode === "jsr"
                ? machineInstruction(profile.cpu, "jsr", "absolute", {
                    kind: "label",
                    label: "opaque",
                  })
                : instruction(opcode);
      const blocks = fn.blocks.map((block) =>
        block.label === "true"
          ? { ...block, instructions: [...block.instructions, poison] }
          : block,
      );
      expect(deriveBooleanExitFacts({ ...fn, blocks })).toBeNull();
    },
  );

  it("should accept PLP followed by a new canonical A/N/Z producer, but not PLP itself", () => {
    expect(
      deriveBooleanExitFacts({
        id: "fresh",
        blocks: [returned("entry", [instruction("plp"), instruction("lda", 0)])],
      }),
    ).not.toBeNull();
  });

  it("should reject a noncanonical join and an unresolved external jump", () => {
    const fn = booleanBody();
    const join = returned("join");
    const blocks: MachineBlock[] = fn.blocks.map((block) =>
      block.label === "entry"
        ? block
        : {
            ...block,
            instructions: block.label === "true" ? [instruction("lda", 2)] : block.instructions,
            terminator: jump("join"),
          },
    );
    expect(deriveBooleanExitFacts({ ...fn, blocks: [...blocks, join] })).toBeNull();
    expect(
      deriveBooleanExitFacts({
        ...fn,
        blocks: [{ ...join, terminator: jump("absent") }],
      }),
    ).toBeNull();
  });

  it("should ignore unreachable poison but bind a certificate to the exact selected body", () => {
    const fn = booleanBody();
    const extended = {
      ...fn,
      blocks: [...fn.blocks, returned("dead", [instruction("lda", 255)])],
    };
    const facts = deriveBooleanExitFacts(extended)!;
    expect(validBooleanExitFacts(facts, extended)).toBe(true);
    expect(validBooleanExitFacts(facts, { ...extended })).toBe(false);
    expect(validBooleanExitFacts({ ...facts, function: fn }, fn)).toBe(false);
  });

  it("should terminate on cycles and accept only separately proved reachable exits", () => {
    const fn = booleanBody();
    const loop: MachineBlock = { label: "cycle", instructions: [], terminator: jump("cycle") };
    expect(deriveBooleanExitFacts({ ...fn, blocks: [loop] })).toBeNull();
  });
});

describe("selected Boolean call flags", () => {
  it("should remove only a branch-only capture/reload and retain its reference obligation", () => {
    const f = callFixture();
    const selected = selectBooleanCallFlags([f.caller, f.callee], f.owners);
    expect(selected[0]?.blocks[0]?.instructions.map((item) => item.opcode)).toEqual(["jsr"]);
    expect(selected[0]?.booleanCallProofs?.[0]).toMatchObject({
      call: f.call,
      callee: f.callee.id,
      pendingObservers: true,
    });
    expect(selected[0]?.booleanCallProofs?.[0]?.removed.map((item) => item.opcode)).toEqual([
      "sta",
      "lda",
    ]);
    expect(f.caller.blocks[0]?.instructions).toHaveLength(3);
    const reversed = selectBooleanCallFlags([f.callee, f.caller], f.owners);
    expect(reversed[1]?.blocks).toEqual(selected[0]?.blocks);
  });

  it.each(["plp", "lda", "php"])(
    "should retain a retest when intervening %s prevents an exact window",
    (opcode) => {
      const f = callFixture(false, [
        opcode === "lda" ? instruction("lda", 0) : instruction(opcode),
      ]);
      expect(selectBooleanCallFlags([f.caller, f.callee], f.owners)[0]).toBe(f.caller);
    },
  );

  it.each(["cmp", "tax"])(
    "should remove a negated %s only after both continuations kill its changed state",
    (opcode) => {
      const f = callFixture(true, [opcode === "cmp" ? instruction("cmp", 0) : instruction("tax")]);
      expect(
        selectBooleanCallFlags([f.caller, f.callee], f.owners)[0]?.blocks[0]?.instructions,
      ).toHaveLength(1);
      const blocks = f.caller.blocks.map((block) =>
        block.label === "no"
          ? {
              ...block,
              instructions: [instruction(opcode === "cmp" ? "php" : "txa"), ...block.instructions],
            }
          : block,
      );
      const observed = { ...f.caller, blocks };
      expect(selectBooleanCallFlags([observed, f.callee], f.owners)[0]).toBe(observed);
    },
  );

  it("should keep ordinary calls for a different context, non-Boolean signature or invalid exit", () => {
    const f = callFixture();
    expect(
      selectBooleanCallFlags([f.caller, { ...f.callee, id: "another.context" }], f.owners)[0],
    ).toBe(f.caller);
    expect(selectBooleanCallFlags([f.caller, f.callee], new Map())).toEqual([f.caller, f.callee]);
    const bad = {
      ...f.callee,
      blocks: [returned("entry", [instruction("lda", 1), instruction("plp")])],
    };
    expect(selectBooleanCallFlags([f.caller, bad], f.owners)[0]).toBe(f.caller);
    const owner = f.owners.get(f.callee.id)!;
    const owners = new Map(f.owners).set(f.callee.id, { ...owner, result: VOID });
    expect(selectBooleanCallFlags([f.caller, f.callee], owners)[0]).toBe(f.caller);
  });

  it("should retest A when a bare branch-only call has no all-exit flag certificate", () => {
    const f = callFixture(false, []);
    const callee = {
      ...f.callee,
      blocks: [returned("entry", [instruction("lda", 1), instruction("plp")])],
    };
    const selected = selectBooleanCallFlags([f.caller, callee], f.owners)[0]!;
    expect(selected.blocks[0]?.instructions.map((item) => item.opcode)).toEqual(["jsr", "cmp"]);
    expect(selected.booleanCallProofs?.[0]).toMatchObject({
      kind: "retest",
      removed: [],
      pendingObservers: true,
    });
  });

  it("should use the complete lowering handoff only for an explicit Closed bundle", () => {
    const main = semanticFunction(100, "Main", [], VOID, [
      semanticBlock("main", [], { kind: "return", value: null }),
    ]);
    const f = callFixture();
    const caller = f.owners.get(f.caller.id)!;
    const callee = semanticFunction(10, "Boolean", [], BOOLEAN, [
      semanticBlock(
        "bool.entry",
        [{ kind: "constant", result: "one", value: true, type: BOOLEAN, span: sourceSpan(11) }],
        { kind: "return", value: "one" },
      ),
    ]);
    const program = wholeProgramFor([main, caller, callee]);
    const inventory = inventoryStorage(program);
    const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
    if (allocation.kind !== "complete") throw new Error("Expected fixture allocation");
    const objects = deriveClosedObjectFacts(program, profile.storage);
    const functions = new Map(
      program.semantic.functions.map((fn) => [
        fn,
        { function: fn, objects, loops: [], lifetimes: new Map() },
      ]),
    );
    const lower = (nonLoopBundle: "closed" | "direct") =>
      lowerMachineProgram({
        program,
        profile,
        placement: allocation.placement,
        sourceFacts: { program, functions, nonLoopBundle },
      });
    const closed = lower("closed");
    const direct = lower("direct");
    if (closed.kind !== "complete" || direct.kind !== "complete")
      throw new Error("Expected complete lowering");
    expect(closed.program.functions.some((fn) => fn.booleanCallProofs?.length)).toBe(true);
    expect(direct.program.functions.some((fn) => fn.booleanCallProofs?.length)).toBe(false);
  });
});
