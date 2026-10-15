import { describe, expect, it } from "vitest";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { IntegerFacts, SemanticType } from "../frontend/semantic-types.js";
import {
  BYTE,
  WORD,
  semanticBlock,
  sourceBinding,
  sourceSpan,
} from "../machine/lowering-test-support.js";
import {
  literalResolver,
  ordinalBoundResolver,
  valueDefinitions,
} from "./aggregate-place-proof.js";
import { guardedOrdinalBounds } from "./guarded-place-proof.js";
import type { LoadOperation, SemanticBlock, SemanticOperation } from "./operations.js";

const unsigned: IntegerFacts = { width: 16, signed: false, wrap: true };
const boolean: SemanticType = { kind: "scalar", name: "boolean" };
const column = { root: sourceBinding(1), rootType: WORD, path: [] };
const rows = {
  root: sourceBinding(2),
  rootType: { kind: "array" as const, element: BYTE, length: 8, size: 8 },
  path: [{ kind: "index" as const, value: "index" }],
};

/** An unsigned source scalar is read separately for comparison and for access. */
function load(result: string): LoadOperation {
  return {
    kind: "load",
    result,
    place: column,
    type: WORD,
    integer: unsigned,
    span: sourceSpan(1),
  };
}

/** Literal limits supply bounds, never an inferred declaration extent. */
function constant(result: string, value: bigint | boolean): SemanticOperation {
  return {
    kind: "constant",
    result,
    value,
    type: typeof value === "boolean" ? boolean : WORD,
    integer: typeof value === "boolean" ? null : unsigned,
    span: sourceSpan(2),
  };
}

/** The result is Boolean; the compared value's own definition owns its unsigned facts. */
function compare(left = "tested", operator = "<", right = "limit"): SemanticOperation {
  return {
    kind: "binary",
    result: "condition",
    left,
    right,
    operator,
    type: boolean,
    integer: null,
    span: sourceSpan(3),
  };
}

/** Keep the observed operation identity unchanged for the sparse consumer handoff. */
function access(): LoadOperation {
  return {
    kind: "load",
    result: "answer",
    place: rows,
    type: BYTE,
    integer: { ...unsigned, width: 8 },
    span: sourceSpan(4),
  };
}

/** Run the real existing literal/mask resolvers beside the use-site proof. */
function prove(
  blocks: readonly SemanticBlock[],
  unstable = new Set<string>(),
  mayAlias: (operation: SemanticOperation) => boolean = () => false,
) {
  const definitions = valueDefinitions(blocks);
  const literal = literalResolver(definitions);
  return guardedOrdinalBounds(
    blocks[0]!.id,
    blocks,
    definitions,
    unstable,
    literal,
    ordinalBoundResolver(definitions, literal),
    mayAlias,
  );
}

/** A real write breaks reload equivalence even when the earlier tested value survives. */
function overwrite(): SemanticOperation {
  return { kind: "store", place: column, value: "unknown", type: WORD, span: sourceSpan(5) };
}

describe("guarded object-footprint facts", () => {
  it.each([
    { operator: "<", reversed: false, truth: true, limit: 8n, bound: 7n },
    { operator: ">=", reversed: false, truth: false, limit: 8n, bound: 7n },
    { operator: "<=", reversed: false, truth: true, limit: 7n, bound: 7n },
    { operator: ">", reversed: false, truth: false, limit: 7n, bound: 7n },
    { operator: ">", reversed: true, truth: true, limit: 8n, bound: 7n },
  ])(
    "should select only the comparison's bounded edge: $operator/$truth/$reversed",
    ({ operator, reversed, truth, limit, bound }) => {
      const use = access();
      const selected = [load("index"), use];
      const blocks = [
        semanticBlock(
          "entry",
          [
            load("tested"),
            constant("limit", limit),
            compare(reversed ? "limit" : "tested", operator, reversed ? "tested" : "limit"),
          ],
          {
            kind: "branch",
            condition: "condition",
            whenTrue: truth ? "bounded" : "other",
            whenFalse: truth ? "other" : "bounded",
          },
        ),
        semanticBlock("bounded", selected, { kind: "return", value: "answer" }),
        semanticBlock("other", [], { kind: "return", value: null }),
      ];
      expect(prove(blocks).get(use)?.get("index")).toBe(bound);
      expect(prove(blocks, new Set([bindingIdentityKey(column.root)])).get(use)).toBeUndefined();
    },
  );

  it("should preserve captured values but invalidate changed bindings before branching", () => {
    const use = access();
    const blocks = [
      semanticBlock("entry", [load("tested"), constant("limit", 8n), compare(), overwrite()], {
        kind: "branch",
        condition: "condition",
        whenTrue: "bounded",
        whenFalse: "other",
      }),
      semanticBlock("bounded", [load("index"), use], { kind: "return", value: "answer" }),
      semanticBlock("other", [], { kind: "return", value: null }),
    ];
    expect(prove(blocks).get(use)).toBeUndefined();
  });

  it.each([false, true])(
    "should select a short-circuit continuation without resurrecting a write: %s",
    (write) => {
      const use = access();
      const blocks = [
        semanticBlock("entry", [], {
          kind: "branch",
          condition: "quality",
          whenTrue: "bypass",
          whenFalse: "test",
        }),
        semanticBlock("bypass", [constant("invalid", true)], { kind: "jump", target: "merge" }),
        semanticBlock("test", [load("tested"), constant("limit", 8n), compare("tested", ">=")], {
          kind: "jump",
          target: "merge",
        }),
        semanticBlock(
          "merge",
          [
            {
              kind: "merge",
              result: "invalid-input",
              type: boolean,
              integer: null,
              incoming: [
                { block: "bypass", value: "invalid" },
                { block: "test", value: "condition" },
              ],
              span: sourceSpan(6),
            },
            ...(write ? [overwrite()] : []),
          ],
          { kind: "branch", condition: "invalid-input", whenTrue: "other", whenFalse: "bounded" },
        ),
        semanticBlock("bounded", [load("index"), use], { kind: "return", value: "answer" }),
        semanticBlock("other", [], { kind: "return", value: null }),
      ];
      expect(prove(blocks).get(use)?.get("index")).toBe(write ? undefined : 7n);
    },
  );

  it.each([7n, 16n, 65535n])(
    "should saturate fixed unsigned shift counts without host-sized shifts: %s",
    (shift) => {
      const use = access();
      const blocks = [
        semanticBlock("entry", [load("tested"), constant("limit", 64n), compare()], {
          kind: "branch",
          condition: "condition",
          whenTrue: "bounded",
          whenFalse: "other",
        }),
        semanticBlock(
          "bounded",
          [
            load("shifted"),
            constant("shift", shift),
            {
              kind: "binary",
              result: "index",
              left: "shifted",
              right: "shift",
              operator: ">>",
              type: WORD,
              integer: unsigned,
              span: sourceSpan(7),
            },
            use,
          ],
          { kind: "return", value: "answer" },
        ),
        semanticBlock("other", [], { kind: "return", value: null }),
      ];
      expect(prove(blocks).get(use)?.get("index")).toBe(0n);
    },
  );

  it("should clear reload facts after an unknown physical write, not a captured ordinal", () => {
    const capturedUse = access();
    const reloadUse: SemanticOperation = {
      ...access(),
      result: "later",
      place: {
        ...rows,
        path: [{ kind: "index", value: "reloaded" }],
      },
    };
    const raw: SemanticOperation = {
      kind: "memory-write",
      address: "unknown",
      value: "unknown",
      width: 1,
      byteOrder: "low-first",
      volatile: true,
      span: sourceSpan(8),
    };
    const blocks = [
      semanticBlock("entry", [load("tested"), constant("limit", 8n), compare()], {
        kind: "branch",
        condition: "condition",
        whenTrue: "bounded",
        whenFalse: "other",
      }),
      semanticBlock("bounded", [load("index"), raw, capturedUse, load("reloaded"), reloadUse], {
        kind: "return",
        value: "later",
      }),
      semanticBlock("other", [], { kind: "return", value: null }),
    ];
    const proof = prove(blocks, new Set(), (operation) => operation.kind === "memory-write");
    expect(proof.get(capturedUse)?.get("index")).toBe(7n);
    expect(proof.get(reloadUse)).toBeUndefined();
  });

  it.each([
    { width: 8, offset: 248n, reversed: false, bound: 255n },
    { width: 8, offset: 248n, reversed: true, bound: 255n },
    { width: 8, offset: 249n, reversed: false, bound: undefined },
    { width: 16, offset: 65528n, reversed: false, bound: 65535n },
    { width: 16, offset: 65529n, reversed: true, bound: undefined },
    { width: 16, offset: -1n, reversed: false, bound: undefined },
  ] as const)(
    "should extend a guarded unsigned maximum only without wrap: $width/$offset/$reversed",
    ({ width, offset, reversed, bound }) => {
      const use = access();
      const blocks = [
        semanticBlock("entry", [load("tested"), constant("limit", 8n), compare()], {
          kind: "branch",
          condition: "condition",
          whenTrue: "bounded",
          whenFalse: "other",
        }),
        semanticBlock(
          "bounded",
          [
            load("ordinal"),
            constant("offset", offset),
            {
              kind: "binary",
              result: "index",
              left: reversed ? "offset" : "ordinal",
              right: reversed ? "ordinal" : "offset",
              operator: "+",
              type: width === 8 ? BYTE : WORD,
              integer: { ...unsigned, width },
              span: sourceSpan(9),
            },
            use,
          ],
          { kind: "return", value: "answer" },
        ),
        semanticBlock("other", [], { kind: "return", value: null }),
      ];
      expect(prove(blocks).get(use)?.get("index")).toBe(bound);
    },
  );
});
