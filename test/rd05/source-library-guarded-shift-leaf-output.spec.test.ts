import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const OPERATIONS = [
  { type: "byte", operator: "<<", arithmetic: false },
  { type: "byte", operator: ">>", arithmetic: false },
  { type: "sbyte", operator: "<<", arithmetic: false },
  { type: "sbyte", operator: ">>", arithmetic: true },
] as const;
const CASES = ["byte", "word"].flatMap((countType) =>
  OPERATIONS.map((operation) => ({
    ...operation,
    countType,
    label: `${operation.type} ${operation.operator} guarded ${countType}`,
  })),
);

function source(type: string, operator: string, countType: string): string {
  return `module Game;
place(at: $3300) let input: ${type};
place(at: $3304) let inputCount: ${countType};
place(at: $3200) let result: ${type};
export function shift(value: ${type}, count: ${countType}): ${type} {
  if (count < 8) { return value ${operator} count; }
  return $55;
}
export function observed(): void { }
export function main(): void {
  while (true) { result = shift(input, inputCount); observed(); }
}`;
}

/** Source declaration identity and the available complete home both retain the parameter width. */
function expectParameterWidth(
  artifacts: LibraryArtifacts,
  text: string,
  name: string,
  type: string,
  width: number,
): void {
  const declaration = profileSpan(text, `${name}: ${type}`);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === declaration.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matches = symbols.filter((row) => {
    if (row.kind !== "parameter" || row.scope !== "src/game.blend::Game.shift") return false;
    const origin = profileRecord(row.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte <= declaration.start &&
      span.endByte >= declaration.start + name.length
    );
  });
  expect(matches).toHaveLength(1);
  const symbol = matches[0]!;
  expect(symbol.type).toBe(type);
  expect(symbol.byteWidth).toBe(width);
  if (!Array.isArray(symbol.locationIndexes)) throw new Error("Missing parameter locations");
  const locations = profileRecords(artifacts.debug.locations);
  const homes = symbol.locationIndexes.flatMap((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || !locations[index])
      throw new Error("Missing source parameter location");
    const location = locations[index]!;
    expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") return [];
    return profileRecords(availability.pieces)
      .filter((piece) => piece.kind === "memory")
      .map((piece) => {
        const machine = profileRecord(piece.machine);
        expect(piece.byteLength).toBe(width);
        expect(piece.valueOffset).toBe(0);
        if (
          typeof machine.start !== "number" ||
          typeof machine.end !== "number" ||
          !Number.isInteger(machine.start) ||
          machine.start < 0 ||
          machine.end > 65536 ||
          machine.end !== machine.start + width
        )
          throw new Error("Missing complete CPU parameter home");
        return machine.start;
      });
  });
  expect([...new Set(homes)]).toHaveLength(1);
}

describe.each(sourceLibraryProfiles)(
  "complete guarded byte-result shift leaves on %s",
  (profile) => {
    it.each(CASES)(
      "should include the guard rejection loop and returns in the $label budget",
      async (testCase) => {
        const text = source(testCase.type, testCase.operator, testCase.countType);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts) => {
          expectLibraryAccounting(artifacts);
          expectParameterWidth(artifacts, text, "value", testCase.type, 1);
          expectParameterWidth(
            artifacts,
            text,
            "count",
            testCase.countType,
            testCase.countType === "word" ? 2 : 1,
          );
          const variants = cia2FunctionVariants(artifacts, "shift");
          expect(variants).toHaveLength(1);
          const completeBytes =
            22 + (testCase.countType === "word" ? 5 : 0) + (testCase.arithmetic ? 2 : 0);
          for (const { bytes } of variants) {
            // Absolute count/value loads, zero test, shift loop and RTS total 15 bytes.
            // Upper compare/branch adds 4; rejection's immediate result/RTS adds 3.
            // Word high-byte load/branch adds 5; signed-right sign injection adds 2.
            // Accepted nominal byte paths: zero 23, positive k 21+7k (signed right 21+9k).
            // Word high-zero precheck adds 6 cycles; taken-branch page penalties are separate.
            // This focused oracle measures complete bytes, not an executable complete-cycle proof.
            console.info("Complete guarded shift leaf bytes", {
              profile,
              case: testCase.label,
              completeBytes: bytes.length,
              ceiling: completeBytes,
            });
            expect(bytes.length).toBeLessThanOrEqual(completeBytes);
          }
        });
      },
      180_000,
    );
  },
);
