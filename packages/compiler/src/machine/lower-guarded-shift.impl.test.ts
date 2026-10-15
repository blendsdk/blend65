import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { InterruptExecutionContext } from "../semantic/interrupt-contexts.js";
import type { SemanticBlock, SemanticOperation } from "../semantic/operations.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import { lowerFunction } from "./lower-function.js";
import { bindingLabel } from "./lower-state.js";
import {
  BOOLEAN,
  BYTE,
  VOID,
  WORD,
  loadOperation,
  lowerFunctions,
  semanticBlock,
  semanticFunction,
  selectedProfile,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
} from "./lowering-test-support.js";

const SBYTE: SemanticType = { kind: "scalar", name: "sbyte" };
const span = sourceSpan(9480);
const nop: SemanticOperation = { kind: "cpu-control", control: "asm_nop", span };

/** Construct the exact guarded leaf and real homes without changing the public oracle. */
function guardedLeaf(
  options: {
    countType?: SemanticType;
    resultType?: SemanticType;
    operator?: "<<" | ">>";
    rejection?: "direct" | "alias" | "chain";
    effect?: "guard" | "accepted" | "done" | "rejected" | "prefix";
    extraEntry?: boolean;
    aliasValue?: boolean;
    startup?: boolean;
    interrupt?: boolean;
    domain?: InterruptExecutionContext["domain"];
  } = {},
) {
  const countType = options.countType ?? BYTE;
  const resultType = options.resultType ?? BYTE;
  const value = sourceParameter(9481, resultType);
  const count = options.aliasValue ? value : sourceParameter(9482, countType);
  const facts = {
    width: countType === WORD ? (16 as const) : (8 as const),
    signed: countType === SBYTE,
    wrap: true,
  };
  const fallback = semanticBlock(
    "fallback",
    [
      ...(options.effect === "rejected" ? [nop] : []),
      { kind: "constant", result: "fallback", value: 0x55n, type: resultType, integer: null, span },
    ],
    { kind: "return", value: "fallback" },
  );
  const rejection = options.rejection ?? "direct";
  const blocks: SemanticBlock[] = [
    ...(options.effect === "prefix"
      ? [semanticBlock("prefix", [nop], { kind: "jump", target: "entry" })]
      : []),
    semanticBlock(
      "entry",
      [
        loadOperation("value", value, 9483),
        { ...loadOperation("count", count, 9484), integer: facts },
        { kind: "constant", result: "eight", value: 8n, type: countType, integer: facts, span },
        {
          kind: "binary",
          result: "valid",
          operator: "<",
          left: "count",
          right: "eight",
          type: BOOLEAN,
          integer: null,
          span,
        },
        ...(options.effect === "guard" ? [nop] : []),
      ],
      {
        kind: "branch",
        condition: "valid",
        whenTrue: "accepted",
        whenFalse: rejection === "direct" ? "fallback" : "rejected",
      },
    ),
    semanticBlock(
      "accepted",
      [
        ...(options.effect === "accepted" ? [nop] : []),
        {
          kind: "binary",
          result: "shifted",
          operator: options.operator ?? ">>",
          left: "value",
          right: "count",
          type: resultType,
          integer: null,
          span,
        },
        ...(options.effect === "done" ? [nop] : []),
      ],
      { kind: "return", value: "shifted" },
    ),
    ...(rejection === "direct"
      ? []
      : [
          semanticBlock("rejected", [], {
            kind: "jump",
            target: rejection === "alias" ? "fallback" : "rejected.again",
          }),
          ...(rejection === "chain"
            ? [semanticBlock("rejected.again", [], { kind: "jump", target: "fallback" })]
            : []),
        ]),
    fallback,
    ...(options.extraEntry
      ? [semanticBlock("extra-entry", [], { kind: "jump", target: "accepted" })]
      : []),
  ];
  const fn = {
    ...semanticFunction(
      9485,
      "shift",
      options.aliasValue ? [value] : [value, count],
      resultType,
      blocks,
    ),
    entryKind: options.interrupt ? ("interrupt" as const) : ("ordinary" as const),
  };
  const main = semanticFunction(9490, "main", [], VOID, [
    semanticBlock("main.entry", [], { kind: "return", value: null }),
  ]);
  const functions = options.startup ? [fn] : [main, fn];
  const lifetimes = valueLifetimes(fn);
  const program = wholeProgramFor(functions, lifetimes);
  const inventory = inventoryStorage(program);
  const profile = selectedProfile();
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected real parameter allocation");
  if (options.domain !== undefined || options.interrupt) {
    // Inspect an actual function selection in the requested interrupt context;
    // route admission and wrapper qualification remain separate public contracts.
    return {
      blocks: lowerFunction(
        bindingLabel("fn", fn.id),
        fn.id,
        fn.blocks,
        { program, placement: allocation.placement, profile },
        [],
        new Map(),
        [],
        [],
        options.startup ?? false,
        { domain: options.domain ?? "main", irq: 0, nmi: 0 },
      ).blocks,
      parameters: inventory.requests.filter(({ storageClass }) => storageClass === "parameter"),
    };
  }
  const lowered = lowerFunctions(functions, lifetimes);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(inventory, profile.storage, lowered.binder);
  if (closed.kind !== "complete") throw new Error("Expected selected storage closure");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  const selected = lowered.program.functions.find(({ id }) => id === bindingLabel("fn", fn.id));
  if (selected === undefined) throw new Error("Expected the ordinary shift function");
  return {
    blocks: selected.blocks,
    parameters: closed.inventory.requests.filter(
      ({ storageClass }) => storageClass === "parameter",
    ),
  };
}

describe("guarded shift count selection", () => {
  it.each([BYTE, WORD])("keeps the typed %j count in X with no new home", (countType) => {
    for (const resultType of [BYTE, SBYTE]) {
      for (const operator of ["<<", ">>"] as const) {
        for (const rejection of ["direct", "alias"] as const) {
          const selected = guardedLeaf({ countType, resultType, operator, rejection });
          const instructions = selected.blocks.flatMap(({ instructions }) => instructions);
          expect(instructions.filter(({ opcode }) => opcode === "ldx")).toHaveLength(1);
          expect(instructions.filter(({ opcode }) => opcode === "cpx")).toHaveLength(2);
          expect(instructions.some(({ opcode }) => opcode === "sbc")).toBe(false);
          expect(
            selected.blocks.find(({ label }) => label === "accepted")?.instructions,
          ).toHaveLength(1);
          expect(selected.parameters.map(({ bytes }) => bytes).sort()).toEqual(
            countType === WORD ? [1, 2] : [1, 1],
          );
          expect(selected.blocks[0]?.instructions[0]?.opcode).toBe(
            countType === WORD ? "lda" : "ldx",
          );
        }
      }
    }
  });

  it("allows the same private byte parameter as value and count", () => {
    const selected = guardedLeaf({ aliasValue: true });
    expect(selected.blocks[0]?.instructions[0]?.opcode).toBe("ldx");
    expect(selected.parameters.map(({ bytes }) => bytes)).toEqual([1]);
  });

  it.each(["guard", "accepted", "done", "rejected", "prefix"] as const)(
    "keeps the original count guard when %s contains an extra effect",
    (effect) => {
      const selected = guardedLeaf({ effect });
      expect(selected.blocks.find(({ label }) => label === "entry")?.instructions[0]?.opcode).toBe(
        "lda",
      );
    },
  );

  it.each([
    { rejection: "chain" as const },
    { extraEntry: true },
    { countType: SBYTE },
    { resultType: WORD },
    { startup: true },
    { interrupt: true },
    { domain: "irq" as const },
    { domain: "nmi" as const },
  ])("keeps a nonmatching source/entry/return contract unchanged: %j", (options) => {
    const selected = guardedLeaf(options);
    expect(selected.blocks.find(({ label }) => label === "entry")?.instructions[0]?.opcode).toBe(
      "lda",
    );
    expect(selected.blocks.some(({ label }) => label.endsWith(".shift.checked-count.low"))).toBe(
      false,
    );
  });
});
