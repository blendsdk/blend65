import { beforeAll, describe, expect, it } from "vitest";
import type { IntegerFacts } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import {
  alter,
  fixture,
  select,
  sourceText,
  witness,
} from "./byte-write-forwarding-test-support.js";

type Fixture = Awaited<ReturnType<typeof fixture>>;

describe("anonymous byte-write selection", () => {
  let base: Fixture;
  beforeAll(async () => {
    base = await fixture(sourceText);
  });

  it("should select the sole adjacent byte result when no sprite publications exist", () => {
    expect(select(base)).toEqual(new Set([witness(base.source).operation.result]));
  });

  it.each([1n, 21n, 255n])("should select a direct nonzero byte constant %s", (value) => {
    const changed = alter(base, (operations, producer) =>
      operations.map((operation) =>
        operation.kind === "constant" && operation.result === producer.right
          ? { ...operation, value }
          : operation,
      ),
    );
    expect(select(changed)).toEqual(new Set([witness(changed.source).operation.result]));
  });

  it("should select every eligible result rather than only one constant or destination", async () => {
    const actual = await fixture(
      sourceText.replace(
        "poke($D005,counter+21);",
        "poke($D005,counter+1);poke($D007,counter+255);",
      ),
    );
    const expected = actual.source.blocks.flatMap((block) =>
      block.operations.flatMap((operation, index) => {
        const write = block.operations[index + 1];
        return operation.kind === "binary" &&
          write?.kind === "memory-write" &&
          write.value === operation.result
          ? [operation.result]
          : [];
      }),
    );
    expect(expected).toHaveLength(2);
    expect(select(actual, new Set(expected))).toEqual(new Set(expected));
  });

  it("should include all four original vertical-offset witnesses in the real boing source", async () => {
    const actual = await fixture();
    const expected: string[] = [];
    for (const block of actual.source.blocks) {
      for (const [index, operation] of block.operations.entries()) {
        const write = block.operations[index + 1];
        if (
          operation.kind !== "binary" ||
          operation.operator !== "+" ||
          write?.kind !== "memory-write" ||
          write.value !== operation.result
        )
          continue;
        const right = actual.source.blocks
          .flatMap((item) => item.operations)
          .find((item) => "result" in item && item.result === operation.right);
        if (right?.kind === "constant" && right.value === 21n) expected.push(operation.result);
      }
    }
    expect(expected).toHaveLength(4);
    const selected = select(actual, new Set(expected));
    expect(selected).toEqual(new Set(expected));
  });

  const arithmeticBarriers: readonly [string, string, IntegerFacts | null][] = [
    ["signed", "+", { width: 8, signed: true, wrap: true }],
    ["word", "+", { width: 16, signed: false, wrap: true }],
    ["nonwrapping", "+", { width: 8, signed: false, wrap: false }],
    ["missing integer facts", "+", null],
    ["subtraction", "-", { width: 8, signed: false, wrap: true }],
    ["bitwise operation", "|", { width: 8, signed: false, wrap: true }],
  ];
  it.each(arithmeticBarriers)("should decline %s arithmetic", (_name, operator, integer) => {
    const changed = alter(base, (operations, producer) =>
      operations.map((operation) =>
        operation === producer ? { ...producer, operator, integer } : operation,
      ),
    );
    expect(select(changed).size).toBe(0);
  });

  it("should decline a non-byte result type even with byte integer facts", () => {
    const changed = alter(base, (operations, producer) =>
      operations.map((operation) =>
        operation === producer
          ? { ...producer, type: { kind: "scalar", name: "sbyte" } }
          : operation,
      ),
    );
    expect(select(changed).size).toBe(0);
  });

  it.each([0n, -1n, 256n, true])("should decline the unsupported direct constant %s", (value) => {
    const changed = alter(base, (operations, producer) =>
      operations.map((operation) =>
        operation.kind === "constant" && operation.result === producer.right
          ? { ...operation, value }
          : operation,
      ),
    );
    expect(select(changed).size).toBe(0);
  });

  it.each(["right", "address"] as const)("should decline a converted %s constant", (operand) => {
    const changed = alter(base, (operations, producer, write) =>
      operations.map((operation) => {
        if (
          operation.kind !== "constant" ||
          operation.result !== (operand === "right" ? producer.right : write.address)
        )
          return operation;
        const { value: _value, ...definition } = operation;
        return { ...definition, kind: "convert", conversion: "identity", operand: producer.left };
      }),
    );
    expect(select(changed).size).toBe(0);
  });

  it.each([-1n, 65536n, false])("should decline an invalid direct address %s", (value) => {
    const changed = alter(base, (operations, _producer, write) =>
      operations.map((operation) =>
        operation.kind === "constant" && operation.result === write.address
          ? { ...operation, value }
          : operation,
      ),
    );
    expect(select(changed).size).toBe(0);
  });

  it.each(["right", "address"] as const)("should decline a missing %s definition", (operand) => {
    const changed = alter(base, (operations, producer, write) =>
      operations.map((operation) => {
        if (operand === "right" && operation === producer)
          return { ...producer, right: "missing.definition" };
        if (operand === "address" && operation === write)
          return { ...write, address: "missing.definition" };
        return operation;
      }),
    );
    expect(select(changed).size).toBe(0);
  });

  it.each([
    "runtime right",
    "dynamic address",
    "wide write",
    "gap",
    "constant gap",
    "conversion gap",
    "named store",
  ])("should decline %s", (mode) => {
    const changed = alter(base, (operations, producer, write, index) => {
      if (mode === "gap")
        return [
          ...operations.slice(0, index + 1),
          { kind: "cpu-control", control: "asm_nop", span: producer.span },
          ...operations.slice(index + 1),
        ];
      if (mode === "constant gap" || mode === "conversion gap") {
        const gap: SemanticOperation =
          mode === "constant gap"
            ? { ...producer, kind: "constant", result: "gap.constant", value: 0n }
            : {
                ...producer,
                kind: "convert",
                result: "gap.convert",
                operand: producer.left,
                conversion: "identity",
              };
        return [...operations.slice(0, index + 1), gap, ...operations.slice(index + 1)];
      }
      const named = operations.find((operation) => operation.kind === "store");
      if (mode === "named store" && named?.kind !== "store")
        throw new Error("Fixture has no named storage");
      return operations.map((operation) => {
        if (mode === "runtime right" && operation === producer)
          return { ...producer, right: producer.left };
        if (operation !== write) return operation;
        if (mode === "dynamic address") return { ...write, address: producer.left };
        if (mode === "wide write") return { ...write, width: 2 };
        return mode === "named store" && named?.kind === "store"
          ? { ...named, value: producer.result }
          : write;
      });
    });
    expect(select(changed).size).toBe(0);
  });
});
