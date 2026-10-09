import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type {
  ArrayType,
  IntegerFacts,
  SemanticType,
  StructType,
} from "../frontend/semantic-types.js";
import { semanticTypeSize } from "../frontend/semantic-type-relations.js";
import {
  BYTE,
  WORD,
  VOID,
  selectedProfile,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
  wholeProgramFor,
} from "../machine/lowering-test-support.js";
import type {
  BinaryOperation,
  ConstantOperation,
  ConvertOperation,
  LoadOperation,
  SemanticGlobal,
  SemanticOperation,
  SemanticProgram,
} from "./operations.js";
import { retainObservableGlobals } from "./reachable-globals.js";

/** Preserve real fixed-width facts while varying their boundary deliberately. */
function integer(width: 8 | 16 = 16, signed = false): IntegerFacts {
  return { width, signed, wrap: true };
}

/** One packed array with the same complete size used by production type relations. */
function array(length = 8, element: SemanticType = BYTE): ArrayType {
  return { kind: "array", length, element, size: length * semanticTypeSize(element) };
}

/** A genuine mathematical constant; the mask query must not execute other arithmetic. */
function constant(value: bigint, result = "mask"): ConstantOperation {
  return { kind: "constant", result, value, type: WORD, integer: integer(), span: sourceSpan(1) };
}

/** Dynamic input has no defining constant; only the opposite operand supplies a mask. */
function masked(facts: IntegerFacts | null = integer(), reversed = false): BinaryOperation {
  return {
    kind: "binary",
    result: "ordinal",
    operator: "&",
    left: reversed ? "mask" : "input",
    right: reversed ? "input" : "mask",
    type: WORD,
    integer: facts,
    span: sourceSpan(2),
  };
}

/** Destination facts, rather than the spelling of a cast, govern preservation. */
function convert(result: string, operand: string, facts: IntegerFacts | null): ConvertOperation {
  return {
    kind: "convert",
    result,
    operand,
    conversion: "identity",
    type: WORD,
    integer: facts,
    span: sourceSpan(3),
  };
}

/** A borrowed/local root cannot make an unchecked index safe by declaration alone. */
function load(rootType: SemanticType = array(), ordinal = "ordinal"): LoadOperation {
  return {
    kind: "load",
    result: "selected",
    place: { root: sourceBinding(500), rootType, path: [{ kind: "index", value: ordinal }] },
    type: BYTE,
    integer: integer(8),
    span: sourceSpan(4),
  };
}

/** One unrelated removable byte and one reached source body isolate the public selector. */
function program(operations: readonly SemanticOperation[]): SemanticProgram {
  const main = semanticFunction(0, "main", [], VOID, [
    semanticBlock("entry", operations, { kind: "return", value: null }),
  ]);
  const cold: SemanticGlobal = {
    id: sourceBinding(100),
    storage: "module",
    exported: false,
    type: BYTE,
    initialBytes: null,
    runtimeInitialBytes: null,
    entry: null,
    blocks: [],
    source: sourceSpan(100),
  };
  return { ...wholeProgramFor([main]).semantic, globals: [cold] };
}

/** Use selected inclusive allocation windows without replacing any proof operation. */
function select(input: SemanticProgram): SemanticProgram {
  return retainObservableGlobals(
    input,
    new Set(input.functions.map(({ id }) => bindingIdentityKey(id))),
    selectedProfile().storage,
  );
}

describe("body-local masked index containment", () => {
  const boundaries = [
    { width: 8, signed: false, mask: 0n, extent: 1, retained: false },
    { width: 8, signed: false, mask: 255n, extent: 256, retained: false },
    { width: 8, signed: false, mask: 256n, extent: 512, retained: true },
    { width: 8, signed: true, mask: 127n, extent: 128, retained: false },
    { width: 8, signed: true, mask: 128n, extent: 256, retained: true },
    { width: 16, signed: false, mask: 32768n, extent: 32769, retained: false },
    { width: 16, signed: false, mask: 65535n, extent: 65535, retained: true },
    { width: 16, signed: false, mask: 65536n, extent: 65535, retained: true },
    { width: 16, signed: true, mask: 32767n, extent: 32768, retained: false },
    { width: 16, signed: true, mask: 32768n, extent: 32769, retained: true },
    { width: 16, signed: true, mask: -1n, extent: 8, retained: true },
    { width: 16, signed: false, mask: 7n, extent: 7, retained: true },
  ] as const;
  for (const reversed of [false, true]) {
    it.each(boundaries)(
      `should honor $width-bit signed=$signed mask=$mask extent=$extent (reversed=${reversed})`,
      ({ width, signed, mask, extent, retained }) => {
        const input = program([
          constant(mask),
          masked(integer(width, signed), reversed),
          load(array(extent)),
        ]);
        const result = select(input);
        expect(result.globals).toHaveLength(retained ? 1 : 0);
        expect(result.functions).toBe(input.functions);
        expect(result.functions[0]!.blocks).toBe(input.functions[0]!.blocks);
        if (retained) expect(result).toBe(input);
      },
    );
  }

  it.each([
    { mask: 127n, width: 8, signed: true, retained: false },
    { mask: 255n, width: 8, signed: false, retained: false },
    { mask: 255n, width: 8, signed: true, retained: true },
    { mask: 256n, width: 8, signed: false, retained: true },
    { mask: 32767n, width: 16, signed: true, retained: false },
    { mask: 32768n, width: 16, signed: true, retained: true },
    { mask: 32768n, width: 16, signed: false, retained: false },
  ] as const)(
    "should preserve only fitting converted ranges $mask/$width/$signed",
    ({ mask, width, signed, retained }) => {
      const input = program([
        constant(mask),
        masked(),
        convert("converted", "ordinal", integer(width, signed)),
        load(array(Number(mask) + 1), "converted"),
      ]);
      expect(select(input).globals).toHaveLength(retained ? 1 : 0);
    },
  );

  it.each(["+", "%", "|", "^"])(
    "should not infer a range for unrelated %s arithmetic",
    (operator) => {
      const input = program([constant(7n), { ...masked(), operator }, load()]);
      expect(select(input)).toBe(input);
    },
  );

  it("should retain data for absent definitions, Boolean masks and missing integer facts", () => {
    const cases: readonly (readonly SemanticOperation[])[] = [
      [masked(), load()],
      [{ ...constant(7n), value: true }, masked(), load()],
      [constant(7n), masked(null), load()],
      [constant(7n), masked(), convert("converted", "ordinal", null), load(array(), "converted")],
      [load()],
      [constant(-1n, "ordinal"), load()],
    ];
    for (const operations of cases) {
      const input = program(operations);
      expect(select(input)).toBe(input);
    }
  });

  it("should preserve exact literal conversion behavior even when the original literal changes", () => {
    const input = program([constant(263n), convert("ordinal", "mask", integer(8)), load()]);
    expect(select(input).globals).toEqual([]);
  });

  it("should admit a mask supplied by an exact conversion but not fold the dynamic result", () => {
    const input = program([
      constant(263n, "wide-mask"),
      convert("mask", "wide-mask", integer(8)),
      masked(),
      load(),
    ]);
    expect(select(input).globals).toEqual([]);
  });

  it.each(["memory-read", "memory-write"] as const)(
    "should not supply an exact raw address for %s",
    (kind) => {
      const shared = {
        address: "ordinal",
        width: 1 as const,
        byteOrder: "low-first" as const,
        volatile: true as const,
        span: sourceSpan(5),
      };
      const observer: SemanticOperation =
        kind === "memory-read"
          ? { ...shared, kind, result: "raw", type: BYTE, integer: integer(8) }
          : { ...shared, kind, value: "input" };
      const input = program([constant(0xd018n), masked(), observer]);
      expect(select(input)).toBe(input);
    },
  );

  it("should include every nested stride, packed field offset and accessed byte", () => {
    const nested = array(2, array(8, WORD));
    const packed: StructType = {
      kind: "struct",
      binding: sourceBinding(600),
      size: 35,
      fields: [{ name: "rows", offset: 3, type: nested }],
    };
    const observer: LoadOperation = {
      ...load(packed),
      type: WORD,
      place: {
        root: sourceBinding(500),
        rootType: packed,
        path: [
          { kind: "field", name: "rows" },
          { kind: "index", value: "row" },
          { kind: "index", value: "ordinal" },
        ],
      },
    };
    const definitions = [constant(7n), masked(), constant(1n, "row")];
    const valid = program([...definitions, observer]);
    expect(select(valid).globals).toEqual([]);
    const malformed: readonly LoadOperation[] = [
      { ...observer, place: { ...observer.place, rootType: { ...packed, size: 34 } } },
      { ...observer, place: { ...observer.place, rootType: { ...packed, fields: [] } } },
      { ...observer, place: { ...observer.place, rootType: BYTE } },
      { ...load(), type: WORD },
      { ...load(), place: { root: sourceBinding(500), path: load().place.path } },
      { ...load(), place: { ...load().place, rootType: { ...array(), size: 7 } } },
    ];
    for (const use of malformed) {
      const input = program([...definitions, use]);
      expect(select(input)).toBe(input);
    }
    const outside = program([constant(8n), masked(), constant(1n, "row"), observer]);
    expect(select(outside)).toBe(outside);
  });

  it("should keep same-named definitions local to each reached body", () => {
    const first = program([constant(7n), masked(), load()]);
    const other = semanticFunction(10, "other", [], VOID, [
      semanticBlock("other", [constant(8n), masked(), load()], { kind: "return", value: null }),
    ]);
    const input = { ...first, functions: [...first.functions, other] };
    expect(select(input)).toBe(input);
  });

  it("should leave cyclic conversion definitions unknown without host recursion", () => {
    const input = program([
      convert("ordinal", "tail", integer()),
      convert("tail", "ordinal", integer()),
      load(),
    ]);
    expect(select(input)).toBe(input);
  });

  it("should memoize deep shared masked conversion tails with linear work", () => {
    const depth = 8000;
    const uses = 2000;
    let factReads = 0;
    const facts = integer();
    const operations: SemanticOperation[] = [constant(7n), masked()];
    let value = "ordinal";
    for (let index = 0; index < depth; index += 1) {
      const operation = convert(`converted:${index}`, value, facts);
      operations.push({
        ...operation,
        get integer() {
          factReads += 1;
          return facts;
        },
      });
      value = operation.result;
    }
    for (let index = 0; index < uses; index += 1)
      operations.push({ ...load(array(), value), result: `selected:${index}` });
    const input = program(operations);
    const result = select(input);
    expect(result.globals).toEqual([]);
    expect(result.functions).toBe(input.functions);
    expect(result.functions[0]!.blocks[0]!.operations).toBe(operations);
    // Count real fact access, not a load-sensitive wall-clock deadline or a mock proof.
    expect(factReads).toBeLessThanOrEqual(depth * 12 + uses * 2);
  });
});
