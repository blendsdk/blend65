import { beforeAll, describe, expect, it } from "vitest";
import type { SemanticOperation } from "../semantic/operations.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import {
  changeWindow,
  closeSource,
  select,
  windowOf,
} from "./low-byte-write-forwarding-test-support.js";
import type { ClosedSource } from "./low-byte-write-forwarding-test-support.js";

describe("adjacent ordinary-word low-byte writes", () => {
  let base: ClosedSource;
  beforeAll(async () => {
    base = await closeSource();
  });

  it("selects only the byte extraction, without removing the named word load", () => {
    const { lo } = windowOf(base);
    expect(select(base)).toEqual(new Set([lo.result]));
  });

  it("accepts the same window rebound consistently into the actual program", () => {
    const fixture = changeWindow(base, () => {});
    expect(select(fixture)).toEqual(new Set([windowOf(base).lo.result]));
  });

  it.each([
    "hi",
    "word result",
    "signed result",
    "signed operand",
    "byte operand",
    "missing root type",
    "signed root",
    "byte root",
    "aggregate root",
    "field",
    "index",
    "wrong operand",
    "wide write",
    "dynamic write",
    "nonvolatile write",
  ] as const)("rejects %s", (shape) => {
    const { load, lo, write } = windowOf(base);
    const fixture = changeWindow(base, (operations, index) => {
      switch (shape) {
        case "hi":
          operations[index] = { ...lo, operator: "hi" };
          break;
        case "word result":
          operations[index] = { ...lo, type: { kind: "scalar", name: "word" } };
          break;
        case "signed result":
          operations[index] = { ...lo, type: { kind: "scalar", name: "sbyte" } };
          break;
        case "signed operand":
          operations[index - 1] = { ...load, type: { kind: "scalar", name: "sword" } };
          break;
        case "byte operand":
          operations[index - 1] = { ...load, type: { kind: "scalar", name: "byte" } };
          break;
        case "missing root type": {
          const { rootType: omitted, ...place } = load.place;
          void omitted;
          operations[index - 1] = { ...load, place };
          break;
        }
        case "signed root":
        case "byte root":
          operations[index - 1] = {
            ...load,
            place: {
              ...load.place,
              rootType: { kind: "scalar", name: shape === "signed root" ? "sword" : "byte" },
            },
          };
          break;
        case "aggregate root":
          operations[index - 1] = {
            ...load,
            place: {
              ...load.place,
              rootType: { kind: "array", element: load.type, length: 1, size: 2 },
            },
          };
          break;
        case "field":
          operations[index - 1] = {
            ...load,
            place: { ...load.place, path: [{ kind: "field", name: "member" }] },
          };
          break;
        case "index":
          operations[index - 1] = {
            ...load,
            place: { ...load.place, path: [{ kind: "index", value: write.address }] },
          };
          break;
        case "wrong operand":
          operations[index] = { ...lo, operand: write.address };
          break;
        case "wide write":
          operations[index + 1] = { ...write, width: 2 };
          break;
        case "dynamic write":
          operations[index + 1] = { ...write, address: load.result };
          break;
        case "nonvolatile write":
          // Runtime corruption deliberately violates the literal-true metadata contract.
          operations[index + 1] = Object.defineProperty({ ...write }, "volatile", { value: false });
          break;
      }
    });
    expect(
      selectAnonymousByteWriteValues(
        fixture.input,
        fixture.source,
        fixture.source.blocks,
        new Set([load.result, lo.result]),
      ),
    ).toEqual(new Set());
  });

  it.each(["constant", "computed", "converted", "symbolic", "raw"] as const)(
    "rejects a %s word operand",
    (kind) => {
      const { load, lo, write } = windowOf(base);
      const common = {
        result: load.result,
        type: load.type,
        integer: load.integer,
        span: load.span,
      };
      const replacements: Record<typeof kind, SemanticOperation> = {
        constant: { ...common, kind: "constant", value: 0x12a5n },
        computed: {
          ...common,
          kind: "binary",
          operator: "+",
          left: write.address,
          right: write.address,
        },
        converted: { ...common, kind: "convert", operand: write.address, conversion: "identity" },
        symbolic: { ...common, kind: "place-address", place: load.place },
        raw: {
          ...common,
          kind: "memory-read",
          address: write.address,
          width: 2,
          volatile: true,
          byteOrder: "low-first",
        },
      };
      const fixture = changeWindow(base, (operations, index) => {
        operations[index - 1] = replacements[kind];
      });
      expect(
        selectAnonymousByteWriteValues(
          fixture.input,
          fixture.source,
          fixture.source.blocks,
          new Set([load.result, lo.result]),
        ),
      ).toEqual(new Set());
    },
  );

  it.each([-1n, 65536n, true])("rejects non-address constant %s", (value) => {
    const { write } = windowOf(base);
    const fixture = changeWindow(base, (operations) => {
      expect(
        operations.filter(
          (operation) => operation.kind === "constant" && operation.result === write.address,
        ),
      ).toHaveLength(1);
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        if (operation?.kind === "constant" && operation.result === write.address)
          operations[i] = { ...operation, value };
      }
    });
    expect(select(fixture)).toEqual(new Set());
  });

  it.each(["converted", "symbolic"] as const)(
    "requires a direct, not %s, address definition",
    (kind) => {
      const { write, load } = windowOf(base);
      const fixture = changeWindow(base, (operations) => {
        const index = operations.findIndex(
          (operation) => operation.kind === "constant" && operation.result === write.address,
        );
        const address = operations[index];
        if (address?.kind !== "constant")
          throw new Error("Fixture address is not a direct constant");
        if (kind === "converted")
          operations.splice(
            index,
            1,
            { ...address, result: "unconverted-address" },
            {
              kind: "convert",
              result: address.result,
              operand: "unconverted-address",
              conversion: "identity",
              type: address.type,
              integer: address.integer,
              span: address.span,
            },
          );
        else
          operations[index] = {
            kind: "place-address",
            result: address.result,
            place: load.place,
            type: address.type,
            integer: address.integer,
            span: address.span,
          };
      });
      expect(select(fixture)).toEqual(new Set());
    },
  );

  it.each([1, 255])("retains unsigned wrapping byte-plus-%i forwarding", async (constant) => {
    const fixture = await closeSource(`module Main; function main():void {
      let value:byte=5;while(true){poke($D005,value+${constant});value=value+1;}
    }`);
    const candidates = fixture.source.blocks.flatMap((block) =>
      block.operations.flatMap((operation, index) => {
        const next = block.operations[index + 1];
        return operation.kind === "binary" &&
          operation.operator === "+" &&
          operation.type.kind === "scalar" &&
          operation.type.name === "byte" &&
          next?.kind === "memory-write" &&
          next.value === operation.result
          ? [operation.result]
          : [];
      }),
    );
    expect(candidates).toHaveLength(1);
    expect(
      selectAnonymousByteWriteValues(
        fixture.input,
        fixture.source,
        fixture.source.blocks,
        new Set(candidates),
      ),
    ).toEqual(new Set(candidates));
  });
});
