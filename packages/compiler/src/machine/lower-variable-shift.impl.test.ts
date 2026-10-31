import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { ordinalBoundsForFunction } from "./lower-bounds.js";
import { placeUses } from "../semantic/aggregate-place-proof.js";
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

/** Query authentic selected-loop facts without inventing maxima or bypassing closure. */
function countBounds(body: string, boundsCheck = false, loopPrefix = "") {
  const text = `module Game;let seed:byte=255;let answer:byte=0;let data:byte[8];
function touch():void{seed+=1;}
function main():void{
for(let i:word=0;i<8;i+=1){${loopPrefix}data[i]=byte(i);}
${body}}`;
  const input = effectFixture(text, "size", boundsCheck, "low-byte");
  const fn = input.checked.program.semantic.functions.find(
    (fn) => fn.id === input.checked.program.semantic.main,
  )!;
  const facts = input.candidate.lowered.program.storageSelection!.sourceFacts.functions.get(fn)!;
  expect(facts.loops).toHaveLength(1);
  const blocks = [
    fn.blocks.find((block) => block.id === fn.entry)!,
    ...fn.blocks.filter((block) => block.id !== fn.entry),
  ];
  const uses = blocks
    .flatMap((block) => block.operations)
    .filter(
      (op) =>
        op.span.start >= text.indexOf(body) &&
        ((op.kind === "binary" && op.operator === "<<") ||
          (op.kind !== "store" &&
            placeUses(op).some(({ place }) => place.path.some((part) => part.kind === "index")))),
    );
  const context = { program: input.checked.program, profile: input.checked.profile };
  return {
    input,
    facts,
    uses,
    selected: ordinalBoundsForFunction(blocks, context, facts.loops),
    original: ordinalBoundsForFunction(blocks, context),
  };
}

describe("joint loop and use-site ordinal bounds", () => {
  it.each([false, true])(
    "should keep a tighter local maximum for both consumers with bounds=%s",
    (bounds) => {
      for (const setup of ["let count:byte=seed&7;", "let count:byte=seed;if(count>=8){return;}"]) {
        const result = countBounds(`${setup}answer=1<<count;answer=data[count];`, bounds);
        expect(result.uses).toHaveLength(2);
        for (const use of result.uses) {
          const values = [...result.original.get(use)!.entries()];
          expect(values).toHaveLength(1);
          const [value, maximum] = values[0]!;
          expect(maximum).toBe(7n);
          expect(result.facts.loops[0]!.valueBounds.get(value)).toBe(255n);
          expect(result.selected.get(use)?.get(value)).toBe(7n);
        }
      }
    },
  );

  it("should keep an ordinary mask bound when no use-site reload fact is needed", () => {
    const result = countBounds("answer=1<<(seed&7);answer=data[seed&7];");
    expect(result.uses).toHaveLength(2);
    for (const use of result.uses) {
      expect([...result.original.get(use)!.values()]).toEqual([7n]);
      expect([...result.selected.get(use)!.values()]).toEqual([7n]);
    }
  });

  it("should retain tighter induction bounds instead of widening them to the local answer", () => {
    const result = countBounds("let count:byte=seed;answer=1<<count;", false, "touch();");
    const loop = result.facts.loops[0]!;
    const use = loop.body.operations.find((op) => op.kind === "store" && op.place.path.length > 0)!;
    expect([...result.selected.get(use)!.values()]).toEqual([7n]);
    expect(result.original.has(use)).toBe(false);
    expect([...result.selected.get(result.uses[0]!)!.values()]).toEqual([255n]);
  });

  it.each([
    ["count=seed;", 255n, false],
    ["touch();", 255n, false],
    ["let callback:fn():void=&touch;callback();", 255n, false],
    ["poke($C100,1);", 255n, false],
    ["poke(word(seed),1);", 255n, false],
    ["data[0]=1;", 255n, false],
    ["if(seed==0){count=7;}else{count=15;}", 15n, true],
    ["if(seed==0){count=seed;}", 255n, false],
    ["asm_nop();", 7n, true],
  ] as const)("should preserve reload invalidation through %s", (barrier, maximum, known) => {
    const result = countBounds(
      `let count:byte=seed&7;${barrier}answer=1<<count;answer=data[count];`,
    );
    expect(result.uses).toHaveLength(2);
    for (const use of result.uses) {
      expect([...result.selected.get(use)!.values()]).toEqual([maximum]);
      expect(result.original.has(use)).toBe(known);
      if (known) expect([...result.original.get(use)!.values()]).toEqual([maximum]);
    }
  });

  it.each([0, 7, 8, 255])("should keep the exact inclusive mask maximum %s", (mask) => {
    const result = countBounds(`let count:byte=seed&${mask};answer=1<<count;answer=data[count];`);
    for (const use of result.uses)
      expect([...result.selected.get(use)!.values()]).toEqual([BigInt(mask)]);
  });

  it("should leave a word reload unknown when neither proof bounds that value", () => {
    const result = countBounds("let count:word=word(seed);answer=1<<count;answer=data[count];");
    expect(result.uses).toHaveLength(2);
    for (const use of result.uses) {
      expect(result.original.has(use)).toBe(false);
      expect(result.selected.has(use)).toBe(false);
    }
  });

  it("should not turn a global mask store into a private reload guarantee", () => {
    const result = countBounds("seed=seed&7;answer=1<<seed;answer=data[seed];");
    expect(result.uses).toHaveLength(2);
    for (const use of result.uses) {
      expect(result.original.has(use)).toBe(false);
      expect([...result.selected.get(use)!.values()]).toEqual([255n]);
    }
  });

  it("should retain an already captured value across a later call, but not reload its binding", () => {
    const result = countBounds("let count:byte=seed&7;answer=1<<count;touch();");
    const fn = result.facts.function;
    const shift = result.uses[0]!;
    const call = fn.blocks.flatMap((block) => block.operations).find((op) => op.kind === "call")!;
    // Model an evaluated count held across a call: move only the call after that
    // load and before its immutable-value consumer, retaining every real identity.
    const blocks = fn.blocks.map((block) => ({
      ...block,
      operations: block.operations
        .filter((op) => op !== call)
        .flatMap((op) => (op === shift ? [call, op] : [op])),
    }));
    const maxima = ordinalBoundsForFunction(
      blocks,
      { program: result.input.checked.program, profile: result.input.checked.profile },
      result.facts.loops,
    );
    expect([...maxima.get(shift)!.values()]).toEqual([7n]);
  });

  it.each([false, true])(
    "should omit only the unreachable saved-query guard with bounds=%s",
    (bounds) => {
      const text = readFileSync(
        new URL("../../../../test/rd05/fixtures/input-saved-caller.blend", import.meta.url),
        "utf8",
      );
      const input = effectFixture(text, "size", bounds, "low-byte");
      const packet = [
        ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
      ].find((packet) =>
        packet.function.blocks.some((block) =>
          block.operations.some(
            (op) =>
              op.kind === "binary" &&
              op.operator === "<<" &&
              input.checked.sourceText(op.span) === "1 << row",
          ),
        ),
      )!;
      const shift = packet.function.blocks
        .flatMap((block) => block.operations)
        .find(
          (op) =>
            op.kind === "binary" &&
            op.operator === "<<" &&
            input.checked.sourceText(op.span) === "1 << row",
        )!;
      const blocks = [
        packet.function.blocks.find((block) => block.id === packet.function.entry)!,
        ...packet.function.blocks.filter((block) => block.id !== packet.function.entry),
      ];
      const maxima = ordinalBoundsForFunction(
        blocks,
        { program: input.checked.program, profile: input.checked.profile },
        packet.loops,
      );
      expect([...maxima.get(shift)!.values()]).toEqual([7n]);
      const actual = input.candidate.shared.layout.program.functions.find(
        (fn) => fn.sourceFunction === packet.function.id,
      )!;
      const instructions = actual.blocks
        .flatMap((block) => block.instructions)
        .filter((item) => item.source === shift.span);
      expect(
        instructions.some(
          (item) =>
            item.opcode === "cpx" && item.operand?.kind === "immediate" && item.operand.value === 8,
        ),
      ).toBe(false);
      expect(instructions.filter((item) => item.opcode === "asl")).toHaveLength(1);
      expect(instructions.filter((item) => item.opcode === "dex")).toHaveLength(1);
    },
  );
});
