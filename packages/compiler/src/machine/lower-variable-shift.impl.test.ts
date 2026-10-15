import { describe, expect, it } from "vitest";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { valueLifetimes } from "../semantic/value-lifetimes.js";
import { closeStorage } from "../storage/closure.js";
import { inventoryStorage } from "../storage/inventory.js";
import { bindMachineProgram } from "./bind.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BOOLEAN,
  BYTE,
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

const span = sourceSpan(9380);
const signedByte: SemanticType = { kind: "scalar", name: "sbyte" };

/** Close actual selected storage for a mask, its byte conversion, a guard or an unknown count. */
function lowerShift(
  mode: "masked" | "converted" | "guarded" | "unknown",
  countType: SemanticType,
  resultType: SemanticType = BYTE,
  barrier = false,
) {
  const value = sourceParameter(9381, resultType);
  const count = sourceParameter(9382, countType);
  const countFacts = { width: countType === WORD ? 16 : 8, signed: false, wrap: true } as const;
  const usesMask = mode === "masked" || mode === "converted";
  const literal: SemanticOperation = {
    kind: "constant",
    result: "limit",
    value: usesMask ? 7n : 8n,
    type: countType,
    integer: countFacts,
    span,
  };
  const shift: SemanticOperation = {
    kind: "binary",
    result: "shifted",
    operator: ">>",
    left: "value",
    right: mode === "converted" ? "converted" : usesMask ? "masked" : "count",
    type: resultType,
    integer: null,
    span,
  };
  // Real frontend count loads and masks carry unsigned width facts. Omitting
  // them would deliberately deny the proof this fixture is meant to exercise.
  const loads = [
    loadOperation("value", value, 9383),
    { ...loadOperation("count", count, 9384), integer: countFacts },
  ];
  const blocks =
    mode === "guarded"
      ? [
          semanticBlock(
            "entry",
            [
              ...loads,
              literal,
              {
                kind: "binary",
                result: "valid",
                operator: "<",
                left: "count",
                right: "limit",
                type: BOOLEAN,
                integer: null,
                span,
              },
            ],
            { kind: "branch", condition: "valid", whenTrue: "accepted", whenFalse: "reject" },
          ),
          semanticBlock("accepted", [shift], { kind: "return", value: "shifted" }),
          semanticBlock(
            "reject",
            [{ ...literal, result: "fallback", value: 0x55n, type: resultType }],
            {
              kind: "return",
              value: "fallback",
            },
          ),
        ]
      : [
          semanticBlock(
            "entry",
            [
              ...loads,
              ...(usesMask
                ? [
                    literal,
                    {
                      kind: "binary" as const,
                      result: "masked",
                      operator: "&" as const,
                      left: "count",
                      right: "limit",
                      type: countType,
                      integer: countFacts,
                      span,
                    },
                  ]
                : []),
              ...(mode === "converted"
                ? [
                    {
                      kind: "convert" as const,
                      result: "converted",
                      operand: "masked",
                      conversion: "truncate" as const,
                      type: BYTE,
                      integer: { width: 8 as const, signed: false, wrap: true },
                      span,
                    },
                  ]
                : []),
              ...(barrier
                ? [{ kind: "cpu-control" as const, control: "asm_nop" as const, span }]
                : []),
              shift,
            ],
            { kind: "return", value: "shifted" },
          ),
        ];
  const fn = semanticFunction(9385, "shift", [value, count], resultType, blocks);
  const lifetimes = valueLifetimes(fn);
  const lowered = lowerFunctions([fn], lifetimes);
  if (lowered.kind !== "complete") throw new Error(lowered.reason);
  const closed = closeStorage(
    inventoryStorage(wholeProgramFor([fn], lifetimes)),
    selectedProfile().storage,
    lowered.binder,
  );
  if (closed.kind !== "complete") throw new Error("Expected complete shift storage");
  expect(bindMachineProgram(lowered.program, closed.certificate).kind).toBe("complete");
  const selected = lowered.program.functions[0]!.blocks;
  return { blocks: selected, requests: closed.inventory.requests };
}

/** Query only one immutable mask/count consumer identity, not a producer-wide fact. */
function forwardsCount(
  options: {
    maximum?: bigint;
    omitBound?: boolean;
    barrier?: boolean;
    singleUse?: boolean;
    wideResult?: boolean;
    differentCount?: boolean;
    clonedConsumer?: boolean;
    converted?: boolean;
    conversionKind?: "truncate" | "reinterpret";
    maskType?: SemanticType;
    convertedType?: SemanticType;
    convertedMultipleUse?: boolean;
    preConversionBarrier?: boolean;
  } = {},
) {
  const literal: SemanticOperation = {
    kind: "constant",
    result: "seven",
    value: 7n,
    type: options.maskType ?? WORD,
    integer: null,
    span,
  };
  const mask: SemanticOperation = {
    kind: "binary",
    result: "masked",
    operator: "&",
    left: "count",
    right: "seven",
    type: options.maskType ?? WORD,
    integer: null,
    span,
  };
  const shift: SemanticOperation = {
    kind: "binary",
    result: "shifted",
    operator: ">>",
    left: "value",
    right: options.differentCount ? "other" : options.converted ? "converted" : "masked",
    type: options.wideResult ? WORD : BYTE,
    integer: null,
    span,
  };
  const consumer = options.clonedConsumer ? { ...shift } : shift;
  return selectRegisterForwarding(
    [
      semanticBlock(
        "entry",
        [
          literal,
          mask,
          ...(options.preConversionBarrier
            ? [{ kind: "cpu-control" as const, control: "asm_nop" as const, span }]
            : []),
          ...(options.converted
            ? [
                {
                  kind: "convert" as const,
                  result: "converted",
                  operand: "masked",
                  conversion: options.conversionKind ?? ("truncate" as const),
                  type: options.convertedType ?? BYTE,
                  integer: null,
                  span,
                },
              ]
            : []),
          ...(options.barrier
            ? [{ kind: "cpu-control" as const, control: "asm_nop" as const, span }]
            : []),
          consumer,
        ],
        { kind: "return", value: "shifted" },
      ),
    ],
    new Set([
      ...(options.singleUse === false ? [] : ["masked"]),
      ...(options.convertedMultipleUse ? [] : ["converted"]),
    ]),
    options.omitBound
      ? new Map()
      : new Map([
          [shift, new Map([[options.converted ? "converted" : "masked", options.maximum ?? 7n]])],
        ]),
  ).forwardedRegisterValues.has("masked");
}

describe("bounded variable shift selection and storage", () => {
  it.each([BYTE, WORD])(
    "forwards only an adjacent masked low count and closes its original parameter width",
    (countType) => {
      const { blocks, requests } = lowerShift("masked", countType);
      expect(
        requests
          .filter(({ storageClass }) => storageClass === "parameter")
          .map(({ bytes }) => bytes),
      ).toEqual([1, countType === WORD ? 2 : 1]);
      expect(
        requests.some(
          ({ id }) => id.includes("retained-value:masked") || id.includes("retained-value:shifted"),
        ),
      ).toBe(false);
      const instructions = blocks.flatMap(({ instructions }) => instructions);
      const tax = instructions.findIndex(({ opcode }) => opcode === "tax");
      expect(tax).toBeGreaterThan(0);
      expect(instructions[tax - 1]!.opcode).toBe("and");
      expect(instructions[tax + 1]!.opcode).toBe("lda");
      const zero = blocks.find(({ label }) => label.endsWith(".zero"));
      expect(zero?.instructions.map(({ opcode }) => opcode)).toEqual(["cpx"]);
      expect(blocks.some(({ label }) => label.endsWith(".saturated"))).toBe(false);
    },
  );

  it.each([BYTE, WORD])("uses fresh X zero only after two private-home loads", (countType) => {
    for (const resultType of [BYTE, signedByte]) {
      const { blocks } = lowerShift("guarded", countType, resultType);
      const entry = blocks.find(
        ({ terminator, instructions }) =>
          terminator.kind === "fallthrough" &&
          terminator.target.endsWith(".low") &&
          instructions.at(-1)?.opcode === "ldx",
      );
      expect(entry?.instructions.slice(-2).map(({ opcode }) => opcode)).toEqual(["lda", "ldx"]);
      expect(
        entry?.instructions.slice(-2).every(({ operand }) => operand?.kind === "storage"),
      ).toBe(true);
      const zero = blocks.find(({ label }) => label.endsWith(".zero"));
      expect(zero?.instructions).toHaveLength(0);
      expect(zero?.terminator).toMatchObject({
        kind: "branch",
        opcode: "beq",
        uses: { flags: ["z"] },
      });
      expect(blocks.some(({ label }) => label.endsWith(".saturated"))).toBe(false);
    }
  });

  it("keeps a lossless converted word mask in A without narrowing the source home", () => {
    const { blocks, requests } = lowerShift("converted", WORD);
    expect(
      requests.filter(({ storageClass }) => storageClass === "parameter").map(({ bytes }) => bytes),
    ).toEqual([1, 2]);
    expect(
      requests.some(
        ({ id }) => id.includes("retained-value:masked") || id.includes("argument-stage:converted"),
      ),
    ).toBe(false);
    const instructions = blocks.flatMap(({ instructions }) => instructions);
    const tax = instructions.findIndex(({ opcode }) => opcode === "tax");
    expect(tax).toBeGreaterThan(0);
    expect(instructions[tax - 1]!.opcode).toBe("and");
    expect(instructions[tax + 1]!.opcode).toBe("lda");
    expect(
      blocks.find(({ label }) => label.endsWith(".zero"))?.instructions.map(({ opcode }) => opcode),
    ).toEqual(["cpx"]);
  });

  it("retains the converted mask's stable home across an emitted barrier", () => {
    const { requests } = lowerShift("converted", WORD, BYTE, true);
    expect(requests.find(({ id }) => id.includes("retained-value:masked"))).toMatchObject({
      bytes: 1,
    });
  });

  it("keeps stable masked storage across an emitted barrier", () => {
    const { blocks, requests } = lowerShift("masked", WORD, BYTE, true);
    expect(requests.find(({ id }) => id.includes("retained-value:masked"))).toMatchObject({
      bytes: 1,
    });
    expect(
      blocks.flatMap(({ instructions }) => instructions).some(({ opcode }) => opcode === "tax"),
    ).toBe(false);
  });

  it("retains full-count saturation for unknown word counts and the general word-result path", () => {
    const unknown = lowerShift("unknown", WORD);
    expect(unknown.blocks.some(({ label }) => label.endsWith(".saturated"))).toBe(true);
    expect(
      unknown.blocks
        .flatMap(({ instructions }) => instructions)
        .some(
          ({ opcode, operand }) =>
            opcode === "cpx" && operand?.kind === "immediate" && operand.value === 8,
        ),
    ).toBe(true);
    expect(
      unknown.blocks
        .flatMap(({ instructions }) => instructions)
        .some(({ opcode }) => opcode === "ldy"),
    ).toBe(true);
    const wide = lowerShift("masked", WORD, WORD);
    expect(wide.requests.find(({ id }) => id.includes("variable-shift:shifted"))).toMatchObject({
      bytes: 2,
    });
    expect(wide.requests.find(({ id }) => id.includes("retained-value:masked"))).toMatchObject({
      bytes: 1,
    });
  });

  it("rejects stale identity, unproved bounds and every incompatible count consumer", () => {
    expect(forwardsCount()).toBe(true);
    for (const options of [
      { maximum: 8n },
      { maximum: -1n },
      { omitBound: true },
      { barrier: true },
      { singleUse: false },
      { wideResult: true },
      { differentCount: true },
      { clonedConsumer: true },
    ])
      expect(forwardsCount(options)).toBe(false);
  });

  it("crosses only the exact sole-use unsigned word-to-byte conversion window", () => {
    expect(forwardsCount({ converted: true })).toBe(true);
    for (const options of [
      { maximum: 8n },
      { maximum: -1n },
      { omitBound: true },
      { preConversionBarrier: true },
      { barrier: true },
      { singleUse: false },
      { convertedMultipleUse: true },
      { wideResult: true },
      { differentCount: true },
      { clonedConsumer: true },
      { maskType: { kind: "scalar", name: "sword" } as const },
      { conversionKind: "reinterpret" as const },
      { convertedType: WORD },
      { convertedType: signedByte },
    ])
      expect(forwardsCount({ converted: true, ...options })).toBe(false);
  });
});
