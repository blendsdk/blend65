import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import {
  expectLibraryAccounting,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

const CASES = [
  { type: "byte", operator: "<<", completeBytes: 18 },
  { type: "byte", operator: ">>", completeBytes: 18 },
  { type: "sbyte", operator: "<<", completeBytes: 18 },
  { type: "sbyte", operator: ">>", completeBytes: 20 },
] as const;

function source(type: string, operator: string): string {
  return `module Game;
place(at: $3300) let input: ${type};
place(at: $3304) let inputCount: word;
place(at: $3200) let result: ${type};
export function shift(value: ${type}, count: word): ${type} {
  return value ${operator} byte(count & 7);
}
export function observed(): void { }
export function main(): void {
  while (true) { result = shift(input, inputCount); observed(); }
}`;
}

describe.each(sourceLibraryProfiles)("complete converted masked-count shifts on %s", (profile) => {
  it.each(CASES)(
    "should charge the complete value-preserving converted $type $operator leaf",
    async (testCase) => {
      await withLibraryBuild(
        source(testCase.type, testCase.operator),
        "module Extra;",
        profile,
        async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const variants = cia2FunctionVariants(artifacts, "shift");
          expect(variants).toHaveLength(1);
          for (const { bytes } of variants) {
            // The word mask's exact 0..7 value fits a byte; narrowing selects that same low byte.
            // Absolute count/value loads: 6 bytes; mask/transfer: 3; zero test/branch: 4;
            // shift/decrement/back-edge: 4; RTS: 1. Arithmetic right adds 2 for sign injection.
            // Charge every retained body byte, including producers, bridges and all returns.
            console.info("Complete converted shift leaf bytes", {
              profile,
              type: testCase.type,
              operator: testCase.operator,
              completeBytes: bytes.length,
            });
            expect(bytes.length).toBeLessThanOrEqual(testCase.completeBytes);
          }
        },
      );
    },
    180_000,
  );
});
