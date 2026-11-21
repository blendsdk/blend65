import { beforeAll, describe, expect, it } from "vitest";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import { changeWindow, closeSource, windowOf } from "./low-byte-write-forwarding-test-support.js";
import type { ClosedSource } from "./low-byte-write-forwarding-test-support.js";
import type { MachineLoweringInput } from "./machine-types.js";

// These cases were written after the selection they cover, so they are implementation tests and
// not an oracle: the frozen low-half suite proves each of these barriers in the configuration it
// was authored against, and this suite's job is to prove the same barriers still hold once the
// high half is admitted. Without it, every barrier for this window would be exercised only with
// the admission turned off, and a later edit to the operator condition could widen the shape in
// the configuration that actually ships while every existing test stayed green.

/**
 * Admit the high half without changing the exported function's required arity.
 *
 * The two trailing flags are independent: the first admits adjacent whole-byte arithmetic
 * assignments, the second the high half of an adjacent named-word read.
 */
const select: (
  input: MachineLoweringInput,
  source: SemanticFunction | undefined,
  blocks: readonly SemanticBlock[],
  singleUseValues: ReadonlySet<string>,
  includeNamedArithmeticStores?: boolean,
  includeHighByteExtractions?: boolean,
) => ReadonlySet<string> = selectAnonymousByteWriteValues;

/**
 * Every barrier the extraction window must still fail, expressed as the frozen low-half oracle
 * expresses them, so the two halves are compared on identical ground.
 */
const BARRIERS = [
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
] as const;

describe("adjacent ordinary-word high-byte writes", () => {
  let base: ClosedSource;
  beforeAll(async () => {
    base = await closeSource();
  });

  it("selects the high extraction only when it is explicitly admitted", () => {
    const { load, lo } = windowOf(base);
    const uses = new Set([load.result, lo.result]);
    const high = changeWindow(base, (operations, index) => {
      operations[index] = { ...lo, operator: "hi" };
    });

    expect(
      select(high.input, high.source, high.source.blocks, uses, true, true),
      "an explicitly admitted high extraction was not selected",
    ).toEqual(new Set([lo.result]));
    expect(
      select(high.input, high.source, high.source.blocks, uses),
      "the high extraction was selected without being asked for",
    ).toEqual(new Set());
  });

  it.each(BARRIERS)("rejects %s even when the high extraction is admitted", (shape) => {
    const { load, lo, write } = windowOf(base);
    const fixture = changeWindow(base, (operations, index) => {
      // Take the high half first, so each barrier is judged against the newly admitted operator
      // rather than against a shape that was already rejected for being the low half's sibling.
      operations[index] = { ...lo, operator: "hi" };
      switch (shape) {
        case "word result":
          operations[index] = { ...lo, operator: "hi", type: { kind: "scalar", name: "word" } };
          break;
        case "signed result":
          operations[index] = { ...lo, operator: "hi", type: { kind: "scalar", name: "sbyte" } };
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
          operations[index] = { ...lo, operator: "hi", operand: write.address };
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
      select(
        fixture.input,
        fixture.source,
        fixture.source.blocks,
        new Set([load.result, lo.result]),
        true,
        true,
      ),
    ).toEqual(new Set());
  });
});
