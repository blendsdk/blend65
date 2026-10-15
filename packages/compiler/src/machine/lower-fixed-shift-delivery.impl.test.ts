import { describe, expect, it } from "vitest";
import type { SemanticOperation, SemanticTerminator } from "../semantic/operations.js";
import { selectRegisterForwarding } from "./lower-register-forwarding.js";
import {
  BYTE,
  VOID,
  WORD,
  semanticBlock,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";

const span = sourceSpan(9940);
const root = sourceBinding(9941);
const destination: SemanticOperation = {
  kind: "constant",
  result: "destination",
  value: 0x3200n,
  type: WORD,
  integer: null,
  span,
};
const shift: Extract<SemanticOperation, { kind: "binary" }> = {
  kind: "binary",
  result: "shifted",
  operator: ">>",
  left: "input",
  right: "count",
  type: BYTE,
  integer: null,
  span,
};
const write: Extract<SemanticOperation, { kind: "memory-write" }> = {
  kind: "memory-write",
  address: "destination",
  value: "shifted",
  width: 1,
  byteOrder: "low-first",
  volatile: true,
  span,
};
const store: Extract<SemanticOperation, { kind: "store" }> = {
  kind: "store",
  value: "shifted",
  place: { root, rootType: BYTE, path: [] },
  type: BYTE,
  span,
};
const conversion: Extract<SemanticOperation, { kind: "convert" }> = {
  kind: "convert",
  result: "converted",
  operand: "shifted",
  type: BYTE,
  conversion: "reinterpret",
  integer: null,
  span,
};

/** Query the existing adjacency owner without adding range or machine-state facts. */
function selected(
  count: bigint | undefined,
  tail: readonly SemanticOperation[],
  producer = shift,
  uses: readonly string[] = ["shifted", "converted"],
  terminator: SemanticTerminator = { kind: "return", value: null },
) {
  return selectRegisterForwarding(
    [
      semanticBlock(
        "entry",
        [
          destination,
          ...(count === undefined
            ? []
            : [
                {
                  kind: "constant" as const,
                  result: "count",
                  value: count,
                  type: BYTE,
                  integer: null,
                  span,
                },
              ]),
          producer,
          ...tail,
        ],
        terminator,
      ),
    ],
    new Set(uses),
  ).forwardedRegisterValues;
}

describe("fixed byte-shift delivery selection", () => {
  for (const operator of ["<<", ">>"]) {
    for (let count = 1n; count < 8n; count += 1n) {
      it(`${operator}${count} delivers to raw and unselected destinations`, () => {
        expect(selected(count, [write], { ...shift, operator }).has("shifted")).toBe(true);
        expect(selected(count, [store], { ...shift, operator }).has("shifted")).toBe(true);
      });
    }
  }
  it.each(["identity", "reinterpret"] as const)(
    "forwards both identities across one %s cast",
    (kind) => {
      const result = selected(3n, [
        { ...conversion, conversion: kind },
        { ...store, value: "converted" },
      ]);
      expect([...result]).toEqual(["shifted", "converted"]);
    },
  );
  it.each([undefined, 0n, 8n, 255n])("keeps count %s outside fixed-store delivery", (count) => {
    expect(selected(count, [write]).has("shifted")).toBe(false);
    expect(selected(count, [store]).has("shifted")).toBe(false);
    expect(
      selected(count, [], shift, ["shifted"], { kind: "return", value: "shifted" }).has("shifted"),
    ).toBe(true);
  });
  it("keeps wide values, other consumers and selected destinations stable", () => {
    const tails: readonly (readonly SemanticOperation[])[] = [
      [{ ...write, width: 2 }],
      [{ ...write, value: "other" }],
      [{ ...write, address: "runtime" }],
      [{ ...store, type: WORD }],
      [{ ...store, value: "other" }],
      [{ ...store, place: { ...store.place, path: [{ kind: "index", value: "index" }] } }],
      [{ ...store, place: { ...store.place, path: [{ kind: "field", name: "field" }] } }],
      [{ kind: "cpu-control", control: "asm_nop", span }, store],
      [
        {
          kind: "call",
          result: null,
          callee: sourceBinding(9942),
          arguments: [],
          type: VOID,
          span,
        },
        store,
      ],
      [
        {
          kind: "unary",
          result: "inverted",
          operand: "shifted",
          operator: "~",
          type: BYTE,
          integer: null,
          span,
        },
      ],
    ];
    for (const tail of tails) expect(selected(3n, tail).has("shifted")).toBe(false);
    expect(selected(3n, [store], { ...shift, type: WORD }).has("shifted")).toBe(false);
    expect(selected(3n, [store], { ...shift, operator: "+" }).has("shifted")).toBe(false);
    expect(selected(3n, [store], shift, []).has("shifted")).toBe(false);
  });
  it("does not cross an unsupported, multiply-used or nonadjacent cast", () => {
    for (const kind of ["truncate", "zero-extend", "sign-extend"] as const) {
      expect(
        selected(3n, [
          { ...conversion, conversion: kind },
          { ...store, value: "converted" },
        ]).has("shifted"),
      ).toBe(false);
    }
    for (const changed of [
      { ...conversion, type: WORD },
      { ...conversion, operand: "other" },
    ]) {
      expect(selected(3n, [changed, { ...store, value: "converted" }]).has("shifted")).toBe(false);
    }
    expect(
      selected(3n, [conversion, { ...store, value: "converted" }], shift, ["shifted"]).has(
        "shifted",
      ),
    ).toBe(false);
    expect(
      selected(3n, [
        conversion,
        { kind: "cpu-control", control: "asm_php", span },
        { ...store, value: "converted" },
      ]).has("shifted"),
    ).toBe(false);
    expect(
      selected(3n, [
        conversion,
        { ...conversion, result: "twice", operand: "converted" },
        { ...store, value: "twice" },
      ]).has("shifted"),
    ).toBe(false);
  });
});
