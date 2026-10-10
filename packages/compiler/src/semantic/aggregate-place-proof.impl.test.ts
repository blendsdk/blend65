import { describe, expect, it } from "vitest";
import type { ArrayType, IntegerFacts, StructType } from "../frontend/semantic-types.js";
import {
  BYTE,
  WORD,
  selectedProfile,
  sourceBinding,
  sourceSpan,
} from "../machine/lowering-test-support.js";
import type { SemanticOperation } from "./operations.js";
import {
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  rawMayObserve,
  rawMaySelectHardwareRam,
  platformIsDisjoint,
} from "./aggregate-place-proof.js";

const INTEGER: IntegerFacts = { width: 16, signed: false, wrap: true };

/** Give a real definition map mathematical constants and fixed-width conversions. */
function constant(result: string, value: bigint): SemanticOperation {
  return { kind: "constant", result, value, type: WORD, integer: INTEGER, span: sourceSpan(1) };
}

/** Keep conversion facts explicit rather than guessing from the destination spelling. */
function conversion(result: string, operand: string, integer = INTEGER): SemanticOperation {
  return {
    kind: "convert",
    result,
    operand,
    conversion: "identity",
    type: WORD,
    integer,
    span: sourceSpan(2),
  };
}

/** A dynamic ordinal is bounded only by its constant mask, never by its declared array. */
function masked(integer = INTEGER): SemanticOperation {
  return {
    kind: "binary",
    result: "masked",
    operator: "&",
    left: "input",
    right: "mask",
    type: WORD,
    integer,
    span: sourceSpan(3),
  };
}

/** Count definition reads independently to distinguish memoization from repeated walks. */
class CountedDefinitions extends Map<string, SemanticOperation> {
  reads = 0;
  override get(key: string): SemanticOperation | undefined {
    this.reads += 1;
    return super.get(key);
  }
}

describe("shared aggregate place proof internals", () => {
  it.each([
    { value: 255n, width: 8 as const, signed: false, bound: 255n },
    { value: 255n, width: 8 as const, signed: true, bound: undefined },
    { value: 127n, width: 8 as const, signed: true, bound: 127n },
    { value: 65535n, width: 16 as const, signed: false, bound: 65535n },
    { value: -1n, width: 16 as const, signed: false, bound: undefined },
  ])(
    "should keep masks within their signed/unsigned width: $value/$width/$signed",
    ({ value, width, signed, bound }) => {
      const definitions = new Map([
        ["mask", constant("mask", value)],
        ["masked", masked({ width, signed, wrap: true })],
      ]);
      const literal = literalResolver(definitions);
      expect(literal("masked")).toBeUndefined();
      expect(ordinalBoundResolver(definitions, literal)("masked")).toBe(bound);
    },
  );

  it.each([
    { mask: 127n, signed: true, bound: 127n },
    { mask: 128n, signed: true, bound: undefined },
    { mask: 255n, signed: false, bound: 255n },
    { mask: 256n, signed: false, bound: undefined },
  ])(
    "should reject narrowing that changes a possible ordinal: $mask/$signed",
    ({ mask, signed, bound }) => {
      const definitions = new Map([
        ["mask", constant("mask", mask)],
        ["masked", masked()],
        ["converted", conversion("converted", "masked", { width: 8, signed, wrap: true })],
      ]);
      expect(ordinalBoundResolver(definitions, literalResolver(definitions))("converted")).toBe(
        bound,
      );
    },
  );

  it("should include packed offsets, word stride and both final bytes", () => {
    const words: ArrayType = { kind: "array", element: WORD, length: 4, size: 8 };
    const packed: StructType = {
      kind: "struct",
      name: "Packed",
      binding: sourceBinding(11),
      fields: [
        { name: "prefix", type: BYTE, offset: 0 },
        { name: "words", type: words, offset: 1 },
      ],
      size: 9,
    };
    const place = {
      root: sourceBinding(10),
      rootType: packed,
      path: [
        { kind: "field" as const, name: "words" },
        { kind: "index" as const, value: "index" },
      ],
    };
    expect(placeMayEscapeRoot({ place, width: 2 }, () => 3n)).toBe(false);
    expect(placeMayEscapeRoot({ place, width: 3 }, () => 3n)).toBe(true);
    expect(placeMayEscapeRoot({ place, width: 2 }, () => 4n)).toBe(true);
    expect(placeMayEscapeRoot({ place, width: 2 }, () => undefined)).toBe(true);
    expect(
      placeMayEscapeRoot({ place: { ...place, rootType: undefined }, width: 2 }, () => 0n),
    ).toBe(true);
  });

  it("should check wrapped byte footprints and inclusive allocation endpoints", () => {
    const windows = [
      { start: 0, end: 0 },
      { start: 0x2000, end: 0x2001 },
    ];
    expect(rawMayObserve(0xffffn, 1, windows)).toBe(false);
    expect(rawMayObserve(0xffffn, 2, windows)).toBe(true);
    expect(rawMayObserve(0x1fffn, 2, windows)).toBe(true);
    expect(rawMayObserve(0x2001n, 1, windows)).toBe(true);
    expect(rawMayObserve(0x2002n, 2, windows)).toBe(false);
    expect(rawMayObserve(undefined, 1, windows)).toBe(true);
    expect(rawMayObserve(0xd020n, 1, undefined)).toBe(true);
  });

  it("should decode hardware publisher mirrors without treating colors as RAM selectors", () => {
    const profile = selectedProfile();
    for (const address of [0xd011n, 0xd051n, 0xd015n, 0xd018n, 0xdd00n, 0xdd12n, 0x07ffn])
      expect(rawMaySelectHardwareRam(address, 1, profile), address.toString(16)).toBe(true);
    expect(rawMaySelectHardwareRam(0xd014n, 2, profile)).toBe(true);
    expect(rawMaySelectHardwareRam(0xd020n, 1, profile)).toBe(false);
    expect(platformIsDisjoint(profile.storage, profile)).toBe(true);
    expect(
      platformIsDisjoint({ ...profile.storage, ram: [{ start: 0x07ff, end: 0x07ff }] }, profile),
    ).toBe(false);
  });

  it("should keep long shared conversion walks bounded and cycles unknown", () => {
    const length = 10_000;
    const definitions = new CountedDefinitions([
      ["mask", constant("mask", 7n)],
      ["masked", masked()],
    ]);
    for (let index = 0; index < length; index += 1)
      definitions.set(
        `v${index}`,
        conversion(`v${index}`, index === 0 ? "masked" : `v${index - 1}`),
      );
    const literal = literalResolver(definitions);
    const bound = ordinalBoundResolver(definitions, literal);
    expect(bound(`v${length - 1}`)).toBe(7n);
    const reads = definitions.reads;
    for (let index = 0; index < length; index += 1) expect(bound(`v${index}`)).toBe(7n);
    expect(definitions.reads).toBe(reads);
    expect(reads).toBeLessThan(length * 3 + 20);
    definitions.set("cycle-a", conversion("cycle-a", "cycle-b"));
    definitions.set("cycle-b", conversion("cycle-b", "cycle-a"));
    expect(literal("cycle-a")).toBeUndefined();
    expect(bound("cycle-b")).toBeUndefined();
  });
});
