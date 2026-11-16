import { describe, expect, it } from "vitest";
import type { BindingId, IntegerFacts, SemanticType } from "../frontend/semantic-types.js";
import type {
  BinaryOperation,
  ConstantOperation,
  LoadOperation,
  SemanticOperation,
  StoreOperation,
} from "../semantic/operations.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceSpan,
} from "./lowering-test-support.js";
import { boundedCounterLoads } from "./sprite-publication-proof.js";

const BOOLEAN: SemanticType = { kind: "scalar", name: "boolean" };
const WORD: SemanticType = { kind: "scalar", name: "word" };
const byteInteger: IntegerFacts = { width: 8, signed: false, wrap: true };
const frame = sourceBinding(10);
const place = { root: frame, path: [] };

/** Give every value its real fixed-width semantics rather than inferred maxima. */
function constant(result: string, value: bigint, type = BYTE): ConstantOperation {
  return {
    kind: "constant",
    result,
    value,
    type,
    integer: type === WORD ? { width: 16, signed: false, wrap: true } : byteInteger,
    span: sourceSpan(20),
  };
}

function read(result: string, root: BindingId = frame): LoadOperation {
  return {
    kind: "load",
    result,
    place: { root, path: [] },
    type: BYTE,
    integer: byteInteger,
    span: sourceSpan(21),
  };
}

function store(value: string): StoreOperation {
  return { kind: "store", place, value, type: BYTE, span: sourceSpan(22) };
}

/** Build byte arithmetic or a Boolean comparison without changing operand widths. */
function binary(result: string, operator: string, left: string, right: string): BinaryOperation {
  const comparison = operator === "==" || operator === ">=";
  return {
    kind: "binary",
    result,
    operator,
    left,
    right,
    type: comparison ? BOOLEAN : BYTE,
    integer: comparison ? null : byteInteger,
    span: sourceSpan(23),
  };
}

/** Independent volatile input keeps every update direction and the unchanged path reachable. */
function choice(): SemanticOperation {
  return {
    kind: "memory-read",
    result: "choice",
    address: "input",
    width: 1,
    byteOrder: "low-first",
    volatile: true,
    type: BYTE,
    integer: byteInteger,
    span: sourceSpan(24),
  };
}

/** Build an inductive loop, including the temporarily out-of-range increment before clamping. */
function counterLoop(mode: "bounded" | "underflow" | "nine" = "bounded") {
  const publication = read("publication");
  const transient = read("transient");
  const source = semanticFunction(1, "main", [], VOID, [
    semanticBlock(
      "entry",
      [
        constant("zero", 0n),
        constant("one", 1n),
        constant("three", 3n),
        constant("four", 4n),
        constant("nine", 9n),
        constant("two", 2n),
        constant("input", 0xdc00n, WORD),
        constant("pointer", 0x07f8n, WORD),
        store("zero"),
      ],
      { kind: "jump", target: "dispatch" },
    ),
    semanticBlock("dispatch", [choice(), binary("unchanged", "==", "choice", "zero")], {
      kind: "branch",
      condition: "unchanged",
      whenTrue: "publication",
      whenFalse: "direction",
    }),
    semanticBlock("direction", [binary("forward", "==", "choice", "one")], {
      kind: "branch",
      condition: "forward",
      whenTrue: "increment",
      whenFalse: mode === "nine" ? "choose-nine" : "reverse",
    }),
    ...(mode === "nine"
      ? [
          semanticBlock("choose-nine", [binary("bad-path", "==", "choice", "two")], {
            kind: "branch",
            condition: "bad-path",
            whenTrue: "nine",
            whenFalse: "reverse",
          }),
          semanticBlock("nine", [store("nine")], { kind: "jump", target: "publication" }),
        ]
      : []),
    semanticBlock(
      "increment",
      [
        read("before-increment"),
        binary("incremented", "+", "before-increment", "one"),
        store("incremented"),
        transient,
        binary("clamp", ">=", "transient", "four"),
      ],
      { kind: "branch", condition: "clamp", whenTrue: "reset", whenFalse: "publication" },
    ),
    semanticBlock("reset", [store("zero")], { kind: "jump", target: "publication" }),
    mode === "underflow"
      ? semanticBlock("reverse", [], { kind: "jump", target: "decrement" })
      : semanticBlock(
          "reverse",
          [read("before-zero-test"), binary("is-zero", "==", "before-zero-test", "zero")],
          { kind: "branch", condition: "is-zero", whenTrue: "wrap", whenFalse: "decrement" },
        ),
    semanticBlock("wrap", [store("three")], { kind: "jump", target: "publication" }),
    semanticBlock(
      "decrement",
      [
        read("before-decrement"),
        binary("decremented", "-", "before-decrement", "one"),
        store("decremented"),
      ],
      { kind: "jump", target: "publication" },
    ),
    semanticBlock(
      "publication",
      [
        publication,
        {
          kind: "memory-write",
          address: "pointer",
          value: publication.result,
          width: 1,
          byteOrder: "low-first",
          volatile: true,
          span: sourceSpan(25),
        },
      ],
      { kind: "jump", target: "dispatch" },
    ),
  ]);
  return { source, publication, transient };
}

describe("bounded sprite-frame counter loads", () => {
  it("certifies publication after either update direction or an unchanged iteration, not transient four", () => {
    const { source, publication, transient } = counterLoop();
    const certified = boundedCounterLoads(source, frame, 4n, () => false);
    expect(certified.has(publication)).toBe(true);
    expect(certified.has(transient)).toBe(false);
    // Certificates identify actual reads, not copies with matching value IDs or spans.
    expect(certified.has({ ...publication })).toBe(false);
    const actual = new Set(source.blocks.flatMap((block) => block.operations));
    for (const operation of certified) expect(actual.has(operation)).toBe(true);
  });

  it("does not certify publication after an unguarded byte decrement can wrap zero to 255", () => {
    const { source, publication } = counterLoop("underflow");
    expect(boundedCounterLoads(source, frame, 4n, () => false).has(publication)).toBe(false);
  });

  it("joins every reachable path, including an unchanged frame-nine publication", () => {
    const { source, publication } = counterLoop("nine");
    expect(boundedCounterLoads(source, frame, 4n, () => false).has(publication)).toBe(false);
  });

  it("does not let a comparison of an older capture refine storage overwritten with nine", () => {
    const publication = read("publication");
    const source = semanticFunction(1, "main", [], VOID, [
      semanticBlock(
        "entry",
        [
          constant("zero", 0n),
          constant("four", 4n),
          constant("nine", 9n),
          store("zero"),
          read("old-frame"),
          store("nine"),
          binary("old-clamp", ">=", "old-frame", "four"),
        ],
        { kind: "branch", condition: "old-clamp", whenTrue: "reset", whenFalse: "publication" },
      ),
      semanticBlock("reset", [store("zero")], { kind: "jump", target: "publication" }),
      semanticBlock("publication", [publication], { kind: "return", value: null }),
    ]);
    expect(boundedCounterLoads(source, frame, 4n, () => false).has(publication)).toBe(false);
  });

  it("ignores an unreachable uninitialized predecessor while preserving an unchanged backedge", () => {
    const publication = read("publication");
    const source = semanticFunction(1, "main", [], VOID, [
      semanticBlock("entry", [constant("zero", 0n), store("zero")], {
        kind: "jump",
        target: "publication",
      }),
      semanticBlock("publication", [publication], { kind: "jump", target: "publication" }),
      semanticBlock("unreachable", [], { kind: "jump", target: "publication" }),
    ]);
    expect(boundedCounterLoads(source, frame, 4n, () => false).has(publication)).toBe(true);
  });

  it("invalidates a bound at an effect the caller identifies as possibly aliasing local storage", () => {
    const publication = read("publication");
    const effect: SemanticOperation = {
      kind: "memory-write",
      address: "address",
      value: "zero",
      width: 1,
      byteOrder: "low-first",
      volatile: true,
      span: sourceSpan(30),
    };
    const source = semanticFunction(1, "main", [], VOID, [
      semanticBlock(
        "entry",
        [
          constant("zero", 0n),
          constant("address", 0x2000n, WORD),
          store("zero"),
          effect,
          publication,
        ],
        { kind: "return", value: null },
      ),
    ]);
    expect(boundedCounterLoads(source, frame, 4n, () => false).has(publication)).toBe(true);
    expect(
      boundedCounterLoads(source, frame, 4n, (operation) => operation === effect).has(publication),
    ).toBe(false);
  });

  it("does not reuse load objects from another source with equal declaration and value identities", () => {
    const first = counterLoop();
    const second = counterLoop();
    const certified = boundedCounterLoads(second.source, frame, 4n, () => false);
    expect(certified.has(second.publication)).toBe(true);
    expect(certified.has(first.publication)).toBe(false);
  });
});
