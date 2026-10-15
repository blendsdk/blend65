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
    label: `${operation.type} ${operation.operator} masked ${countType}`,
  })),
);

function source(type: string, operator: string, countType: string): string {
  return `module Game;
place(at: $3300) let input: ${type};
place(at: $3304) let inputCount: ${countType};
place(at: $3200) let result: ${type};
export function shift(value: ${type}, count: ${countType}): ${type} { return value ${operator} (count & 7); }
export function observed(): void { }
export function main(): void { while (true) { result = shift(input, inputCount); observed(); } }`;
}

/** Identify the declared parameter, never a similarly sized temporary or another binding. */
function parameterHome(
  artifacts: LibraryArtifacts,
  text: string,
  name: string,
  type: string,
  width: number,
): number {
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
      throw new Error("Missing location");
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
          machine.end !== machine.start + width
        )
          throw new Error("Missing whole home");
        return machine.start;
      });
  });
  const unique = [...new Set(homes)];
  expect(unique).toHaveLength(1);
  return unique[0]!;
}

interface Instruction {
  readonly offset: number;
  readonly opcode: number;
  readonly operand: number;
  readonly width: number;
  readonly cycles: number;
}
// Official NMOS scalar forms include staging and saturation traffic, not just the desired loop.
const SHAPES = new Map<number, readonly [number, number]>([
  ...[0x09, 0x29, 0x49, 0x69, 0xa0, 0xa2, 0xa9, 0xc0, 0xc9, 0xe0, 0xe9].map(
    (op) => [op, [2, 2] as const] as const,
  ),
  ...[0x05, 0x25, 0x45, 0x65, 0x84, 0x85, 0x86, 0xa4, 0xa5, 0xa6, 0xc4, 0xc5, 0xe4, 0xe5].map(
    (op) => [op, [2, 3] as const] as const,
  ),
  ...[0x0d, 0x2d, 0x4d, 0x6d, 0x8c, 0x8d, 0x8e, 0xac, 0xad, 0xae, 0xcc, 0xcd, 0xec, 0xed].map(
    (op) => [op, [3, 4] as const] as const,
  ),
  ...[0x0a, 0x18, 0x2a, 0x38, 0x4a, 0x6a, 0x88, 0x8a, 0x98, 0xa8, 0xaa, 0xc8, 0xca, 0xe8, 0xea].map(
    (op) => [op, [1, 2] as const] as const,
  ),
  ...[0x10, 0x30, 0x90, 0xb0, 0xd0, 0xf0].map((op) => [op, [2, 2] as const] as const),
  [0x4c, [3, 3]],
  [0x60, [1, 6]],
]);
const BRANCHES = [0x10, 0x30, 0x90, 0xb0, 0xd0, 0xf0];
const IMMEDIATES = [0x09, 0x29, 0x49, 0x69, 0xa0, 0xa2, 0xa9, 0xc0, 0xc9, 0xe0, 0xe9];

function decode(bytes: Buffer): Instruction[] {
  const result: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const shape = SHAPES.get(opcode);
    if (!shape || offset + shape[0] > bytes.length)
      throw new Error(`Unaccounted whole-leaf opcode $${opcode.toString(16)}`);
    result.push({
      offset,
      opcode,
      width: shape[0],
      cycles: shape[1],
      operand:
        shape[0] === 1 ? 0 : shape[0] === 2 ? bytes[offset + 1]! : bytes.readUInt16LE(offset + 1),
    });
    offset += shape[0];
  }
  return result;
}

/** Execute the complete scalar leaf; no source-expression slicing or opcode-cost filtering. */
function measure(
  code: readonly Instruction[],
  start: number,
  memory: Map<number, number>,
  incomingCarry: boolean,
) {
  let a = 0xa5,
    x = 0x5a,
    y = 0x3c,
    z = false,
    n = false,
    c = incomingCarry,
    pc = 0;
  let nominal = 0,
    pages = 0;
  const instructions = new Map(code.map((row) => [row.offset, row]));
  const nz = (value: number) => {
    z = value === 0;
    n = value >= 128;
    return value;
  };
  const read = (address: number) => {
    const value = memory.get(address);
    if (value === undefined) throw new Error(`Uninitialized leaf read $${address.toString(16)}`);
    return value;
  };
  for (let step = 0; step < 10_000; step += 1) {
    const row = instructions.get(pc);
    if (!row) throw new Error("Execution left the published complete leaf");
    const { opcode, operand, width } = row;
    nominal += row.cycles;
    let next = pc + width;
    if (opcode === 0x60) return { value: a, nominal, pages, total: nominal + pages };
    if (opcode === 0x4c) {
      pc = operand - start;
      continue;
    }
    if (BRANCHES.includes(opcode)) {
      const taken =
        opcode === 0x10
          ? !n
          : opcode === 0x30
            ? n
            : opcode === 0x90
              ? !c
              : opcode === 0xb0
                ? c
                : opcode === 0xd0
                  ? !z
                  : z;
      if (taken) {
        nominal += 1;
        const target = next + (operand < 128 ? operand : operand - 256);
        pages += (start + next) >>> 8 !== (start + target) >>> 8 ? 1 : 0;
        next = target;
      }
    } else if ([0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(opcode)) {
      memory.set(
        operand,
        [0x85, 0x8d].includes(opcode) ? a : [0x86, 0x8e].includes(opcode) ? x : y,
      );
    } else if (opcode === 0x18 || opcode === 0x38) c = opcode === 0x38;
    else if ([0x0a, 0x2a, 0x4a, 0x6a].includes(opcode)) {
      const carry = c;
      c = opcode === 0x0a || opcode === 0x2a ? a >= 128 : a % 2 === 1;
      a = nz(
        opcode === 0x0a
          ? (a * 2) % 256
          : opcode === 0x2a
            ? (a * 2 + Number(carry)) % 256
            : Math.floor(a / 2) + (opcode === 0x6a && carry ? 128 : 0),
      );
    } else if (opcode === 0xaa) x = nz(a);
    else if (opcode === 0xa8) y = nz(a);
    else if (opcode === 0x8a) a = nz(x);
    else if (opcode === 0x98) a = nz(y);
    else if (opcode === 0xca || opcode === 0xe8) x = nz((x + (opcode === 0xca ? 255 : 1)) % 256);
    else if (opcode === 0x88 || opcode === 0xc8) y = nz((y + (opcode === 0x88 ? 255 : 1)) % 256);
    else if (opcode !== 0xea) {
      const value = IMMEDIATES.includes(opcode) ? operand : read(operand);
      if ([0xa9, 0xa5, 0xad].includes(opcode)) a = nz(value);
      else if ([0xa2, 0xa6, 0xae].includes(opcode)) x = nz(value);
      else if ([0xa0, 0xa4, 0xac].includes(opcode)) y = nz(value);
      else if ([0x29, 0x25, 0x2d].includes(opcode)) a = nz(a & value);
      else if ([0x49, 0x45, 0x4d].includes(opcode)) a = nz(a ^ value);
      else if ([0x09, 0x05, 0x0d].includes(opcode)) a = nz(a | value);
      else if ([0xc9, 0xc5, 0xcd, 0xe0, 0xe4, 0xec, 0xc0, 0xc4, 0xcc].includes(opcode)) {
        const register = [0xe0, 0xe4, 0xec].includes(opcode)
          ? x
          : [0xc0, 0xc4, 0xcc].includes(opcode)
            ? y
            : a;
        c = register >= value;
        nz((register - value + 256) % 256);
      } else {
        const subtract = [0xe9, 0xe5, 0xed].includes(opcode);
        const sum = subtract ? a - value - Number(!c) : a + value + Number(c);
        c = subtract ? sum >= 0 : sum >= 256;
        a = nz((sum + 256) % 256);
      }
    }
    pc = next;
  }
  throw new Error("The complete masked leaf did not return");
}

function expected(value: number, count: number, left: boolean, arithmetic: boolean): number {
  let result = arithmetic && value >= 128 ? value - 256 : value;
  for (let i = 0; i < count; i += 1) result = left ? (result * 2) % 256 : Math.floor(result / 2);
  return (result + 256) % 256;
}

describe.each(sourceLibraryProfiles)(
  "complete masked byte-result shift leaves on %s",
  (profile) => {
    it.each(CASES)(
      "should meet the complete mask load loop and return budget for $label",
      async (testCase) => {
        const text = source(testCase.type, testCase.operator, testCase.countType);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const width = testCase.countType === "word" ? 2 : 1;
          const valueHome = parameterHome(artifacts, text, "value", testCase.type, 1);
          const countHome = parameterHome(artifacts, text, "count", testCase.countType, width);
          const variants = cia2FunctionVariants(artifacts, "shift");
          expect(variants).toHaveLength(1);
          for (const { bytes, start } of variants) {
            const code = decode(bytes);
            expect(code.reduce((sum, row) => sum + row.width, 0)).toBe(bytes.length);
            const measurements = [];
            for (const value of [0, 1, 0x7f, 0x80, 0xff])
              for (const rawCount of [0, 1, 2, 3, 4, 5, 6, 7, 8, 255, 256, 65535])
                for (const carry of [false, true]) {
                  const declaredCount = width === 1 ? rawCount % 256 : rawCount;
                  const count = declaredCount % 8;
                  const memory = new Map([
                    [valueHome, value],
                    [countHome, declaredCount % 256],
                  ]);
                  if (width === 2) memory.set(countHome + 1, Math.floor(declaredCount / 256));
                  const measured = measure(code, start, memory, carry);
                  expect(measured.value).toBe(
                    expected(value, count, testCase.operator === "<<", testCase.arithmetic),
                  );
                  expect(measured.total).toBe(measured.nominal + measured.pages);
                  measurements.push({ value, rawCount, count, carry, ...measured });
                }
            console.info("Complete masked leaf accounting", {
              profile,
              case: testCase.label,
              completeBytes: bytes.length,
              maximumNominalCycles: Math.max(...measurements.map((row) => row.nominal)),
              maximumBranchPageCycles: Math.max(...measurements.map((row) => row.pages)),
            });
            // Absolute count/value loads plus mask/transfer, zero test, complete loop and RTS:
            // 18 bytes, zero 23 cycles; positive k: 21 + 7k. Sign injection adds 2 bytes and 2k cycles.
            // Count's source word home remains two bytes; masking makes its high byte irrelevant here.
            for (const measured of measurements)
              expect(measured.nominal).toBeLessThanOrEqual(
                measured.count === 0 ? 23 : 21 + (testCase.arithmetic ? 9 : 7) * measured.count,
              );
            expect(bytes.length).toBeLessThanOrEqual(testCase.arithmetic ? 20 : 18);
          }
        });
      },
      180_000,
    );
  },
);
