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
  { name: "unsigned left", type: "byte", operator: "<<", signed: false },
  { name: "unsigned right", type: "byte", operator: ">>", signed: false },
  { name: "signed left", type: "sbyte", operator: "<<", signed: false },
  { name: "signed right", type: "sbyte", operator: ">>", signed: true },
] as const;
const MODES = [
  "masked byte",
  "masked word",
  "guarded byte",
  "guarded word",
  "converted word",
] as const;
const CASES = MODES.flatMap((mode) =>
  OPERATIONS.map((operation) => ({ ...operation, mode, label: `${mode} ${operation.name}` })),
);

function source(
  type: string,
  operator: string,
  mode: string,
): { text: string; expression: string; width: number } {
  const width = mode.endsWith("byte") ? 1 : 2;
  const countType = width === 1 ? "byte" : "word";
  const rhs =
    mode.startsWith("guarded") || mode.startsWith("unknown")
      ? "count"
      : mode.startsWith("converted")
        ? "byte(count & 7)"
        : "(count & 7)";
  const expression = `value ${operator} ${rhs}`;
  const body = mode.startsWith("guarded")
    ? `if (count < 8) { return ${expression}; } return $55;`
    : `return ${expression};`;
  return {
    width,
    expression,
    text: `module Game;
place(at: $3300) let input: ${type};
place(at: $3304) let inputCount: ${countType};
place(at: $3200) let result: ${type};
export function shift(value: ${type}, count: ${countType}): ${type} { ${body} }
export function observed(): void { }
export function main(): void { while (true) { result = shift(input, inputCount); observed(); } }`,
  };
}

/** The declared parameter, not a producer temporary, retains its exact source width and physical home. */
function parameterHome(
  artifacts: LibraryArtifacts,
  text: string,
  name: string,
  type: string,
  width: number,
): number {
  const wanted = profileSpan(text, `${name}: ${type}`);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === wanted.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const inventory = profileRecords(artifacts.debug.symbols);
  const matches = inventory.filter((symbol) => {
    if (symbol.kind !== "parameter" || symbol.scope !== "src/game.blend::Game.shift") return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte <= wanted.start &&
      span.endByte >= wanted.start + name.length
    );
  });
  expect(matches).toHaveLength(1);
  const symbol = matches[0]!;
  expect(symbol.type).toBe(type);
  expect(symbol.byteWidth).toBe(width);
  if (!Array.isArray(symbol.locationIndexes)) throw new Error("Missing parameter location indexes");
  const locations = profileRecords(artifacts.debug.locations);
  const homes = symbol.locationIndexes.flatMap((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || !locations[index])
      throw new Error("Missing parameter location");
    const location = locations[index]!;
    expect(location.symbolIndex).toBe(inventory.indexOf(symbol));
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") return [];
    return profileRecords(availability.pieces)
      .filter((piece) => piece.kind === "memory")
      .map((piece) => {
        expect(piece.byteLength).toBe(width);
        expect(piece.valueOffset).toBe(0);
        const machine = profileRecord(piece.machine);
        if (typeof machine.start !== "number" || !Number.isInteger(machine.start))
          throw new Error("Missing physical parameter home");
        expect(machine.end).toBe(machine.start + width);
        return machine.start;
      });
  });
  const unique = [...new Set(homes)];
  expect(unique).toHaveLength(1);
  expect(unique[0]).toBeGreaterThanOrEqual(0);
  expect(unique[0]).toBeLessThanOrEqual(65536 - width);
  return unique[0]!;
}

/** Official NMOS decoding includes mask, guard, saturation, carry and return instructions. */
const SHAPES = new Map<number, readonly [number, number]>();
for (const row of [
  "05:2:3 09:2:2 0a:1:2 0d:3:4 18:1:2 25:2:3 29:2:2 2a:1:2 2d:3:4 38:1:2",
  "45:2:3 49:2:2 4a:1:2 4c:3:3 4d:3:4 60:1:6 65:2:3 69:2:2 6a:1:2 6d:3:4",
  "84:2:3 85:2:3 86:2:3 88:1:2 8a:1:2 8c:3:4 8d:3:4 8e:3:4 98:1:2",
  "a0:2:2 a2:2:2 a4:2:3 a5:2:3 a6:2:3 a8:1:2 a9:2:2 aa:1:2 ac:3:4 ad:3:4 ae:3:4",
  "c0:2:2 c4:2:3 c5:2:3 c8:1:2 c9:2:2 ca:1:2 cc:3:4 cd:3:4",
  "e0:2:2 e4:2:3 e5:2:3 e8:1:2 e9:2:2 ea:1:2 ec:3:4 ed:3:4",
  "10:2:2 30:2:2 90:2:2 b0:2:2 d0:2:2 f0:2:2",
])
  for (const encoded of row.split(" ")) {
    const [opcode, width, cycles] = encoded.split(":");
    SHAPES.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }
interface Instruction {
  readonly offset: number;
  readonly opcode: number;
  readonly operand: number | null;
  readonly width: number;
  readonly cycles: number;
}
function decode(bytes: Buffer): Instruction[] {
  const result: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const shape = SHAPES.get(opcode);
    if (!shape || offset + shape[0] > bytes.length)
      throw new Error(`Unaccounted complete shift instruction $${opcode.toString(16)}`);
    result.push({
      offset,
      opcode,
      width: shape[0],
      cycles: shape[1],
      operand:
        shape[0] === 1
          ? null
          : shape[0] === 2
            ? bytes[offset + 1]!
            : bytes.readUInt16LE(offset + 1),
    });
    offset += shape[0];
  }
  return result;
}

const BRANCHES = [0x10, 0x30, 0x90, 0xb0, 0xd0, 0xf0];
const INDEX_LOADS = [0xa0, 0xa2, 0xa4, 0xa6, 0xa8, 0xaa, 0xac, 0xae];

function shiftTail(
  artifacts: LibraryArtifacts,
  text: string,
  expression: string,
  code: readonly Instruction[],
  start: number,
  identity: { readonly functionIndex: number; readonly variantIndex: number },
  guarded?: {
    readonly countHome: number;
    readonly valueHome: number;
    readonly width: number;
  },
): Set<number> {
  const { functionIndex, variantIndex } = identity;
  const wanted = profileSpan(text, expression.replace(/\)+$/, ""));
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === wanted.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const owner = profileRecords(artifacts.debug.functions)[functionIndex];
  expect(owner?.qualifiedName).toBe("src/game.blend::Game.shift");
  const variant = profileRecords(owner!.entryVariants)[variantIndex];
  if (!variant || !Array.isArray(variant.rangeIndexes)) throw new Error("Missing variant ranges");
  const integer = (value: unknown): number => {
    if (typeof value !== "number" || !Number.isInteger(value)) throw new Error("Invalid integer");
    return value;
  };
  const ranges = profileRecords(artifacts.debug.ranges);
  const rows = variant.rangeIndexes.map((index) => {
    const row = ranges[integer(index)];
    if (!row) throw new Error("Missing debug range");
    const cpu = profileRecord(row.machine);
    const origin = profileRecord(row.origin);
    const value = origin.kind === "source" ? origin.span : origin.sourceSpan;
    const raw = value === undefined ? null : profileRecord(value);
    const span = raw && {
      sourceIndex: integer(raw.sourceIndex),
      start: integer(raw.startByte),
      end: integer(raw.endByte),
    };
    const first = integer(cpu.start) - start,
      end = integer(cpu.end) - start;
    if (end <= first || (span && span.end <= span.start)) throw new Error("Invalid range extent");
    return { start: first, end, span };
  });
  const candidates = rows.filter(
    ({ span }) =>
      span?.sourceIndex === sourceIndex && span.start <= wanted.start && wanted.end <= span.end,
  );
  if (!candidates.length) throw new Error("Missing source-owned shift coverage");
  const width = Math.min(...candidates.map(({ span }) => span!.end - span!.start));
  const selected = candidates.filter(({ span }) => span!.end - span!.start === width);
  for (const range of selected) {
    expect(code.some(({ offset }) => offset === range.start)).toBe(true);
    expect(code.some(({ offset, width }) => offset + width === range.end)).toBe(true);
  }
  const groupStart = Math.min(...selected.map((row) => row.start));
  const groupEnd = Math.max(...selected.map((row) => row.end));
  for (const { start: rangeStart, end, span } of rows) {
    if (!span || rangeStart >= groupEnd || end <= groupStart) continue;
    if (span.sourceIndex !== sourceIndex || span.end <= wanted.start || wanted.end <= span.start)
      throw new Error("Unrelated source code in shift hull");
  }
  const operations = code.filter(({ offset }) => offset >= groupStart && offset < groupEnd);
  const firstShift = operations.findIndex(({ opcode }) => [0x0a, 0x4a, 0x6a].includes(opcode));
  expect(firstShift, "Runtime count needs a shift").toBeGreaterThanOrEqual(0);
  let first = operations.slice(0, firstShift).find(({ opcode }) => INDEX_LOADS.includes(opcode));
  if (!first && guarded) {
    // The accepted guard path can supply X before the source-owned shift. Admit
    // only this complete private-home prefix; its bytes and executed cycles stay
    // charged as prefix work. No intervening instruction may change X or A.
    const zeroTest = operations
      .slice(0, firstShift)
      .find(({ opcode, operand }) => opcode === 0xe0 && operand === 0);
    if (!zeroTest) throw new Error("Missing source-owned zero-count test");
    const prefix = code.filter(({ offset }) => offset < zeroTest.offset);
    const word = guarded.width === 2;
    const low = word ? 2 : 0;
    if (
      ![1, 2].includes(guarded.width) ||
      prefix.length !== low + 4 ||
      prefix[0]?.offset !== 0 ||
      ![0xa6, 0xae].includes(prefix[low]!.opcode) ||
      prefix[low]!.operand !== guarded.countHome ||
      prefix[low + 1]!.opcode !== 0xe0 ||
      prefix[low + 1]!.operand !== 8 ||
      prefix[low + 2]!.opcode !== 0xb0 ||
      ![0xa5, 0xad].includes(prefix[low + 3]!.opcode) ||
      prefix[low + 3]!.operand !== guarded.valueHome ||
      (word &&
        (![0xa5, 0xad].includes(prefix[0]!.opcode) ||
          prefix[0]!.operand !== guarded.countHome + 1 ||
          prefix[1]!.opcode !== 0xd0))
    )
      throw new Error("Unproved private-count guard prefix");
    const reject = code.at(-2);
    if (
      !reject ||
      reject.offset < groupEnd ||
      reject.opcode !== 0xa9 ||
      reject.operand !== 0x55 ||
      code.at(-1)?.opcode !== 0x60
    )
      throw new Error("Missing outside-tail guard rejection arm");
    for (const branch of word ? [prefix[1]!, prefix[low + 2]!] : [prefix[low + 2]!]) {
      const target = branch.offset + branch.width + ((Number(branch.operand) + 128) % 256) - 128;
      if (target !== reject.offset) throw new Error("Unproved guard rejection target");
    }
    first = zeroTest;
  }
  if (!first) throw new Error("Missing private count boundary");
  const tail = new Set<number>();
  for (const { offset } of operations) if (offset >= first.offset) tail.add(offset);
  if (operations.at(-1)?.opcode === 0x60) return tail;
  for (let next = groupEnd, seen = new Set<number>(); ; ) {
    const instruction = code.find(({ offset }) => offset === next);
    if (!instruction || seen.has(next)) throw new Error("Missing shift return boundary");
    seen.add(next);
    tail.add(next);
    if (instruction.opcode === 0x60) break;
    if (BRANCHES.includes(instruction.opcode)) {
      const target = next + instruction.width + ((Number(instruction.operand) + 128) % 256) - 128;
      const prior = code.find(({ offset, width }) => offset + width === next);
      const head = code.find(({ offset }) => offset === target);
      const rotate = head?.opcode === 0xc9 && head.operand === 0x80;
      const ror = code.find(({ offset }) => offset === target + 2)?.opcode === 0x6a;
      if (instruction.opcode !== 0xd0 || prior?.opcode !== 0xca) throw new Error("DEX/BNE");
      if (target >= next || !tail.has(target)) throw new Error("Missing selected loop target");
      if (![0x0a, 0x4a].includes(head?.opcode ?? -1) && !(rotate && ror))
        throw new Error("Missing loop head");
    }
    next =
      instruction.opcode === 0x4c ? Number(instruction.operand) - start : next + instruction.width;
  }
  return tail;
}

/** Execute only this bounded official scalar family while charging every actual prefix/core/return instruction. */
function execute(
  code: readonly Instruction[],
  start: number,
  memory: Map<number, number>,
  tail: ReadonlySet<number>,
  incomingCarry: boolean,
) {
  let a = 0xa5,
    x = 0x5a,
    y = 0x3c,
    z = false,
    n = false,
    c = incomingCarry,
    pc = 0;
  const cycles = { prefix: 0, tail: 0, pages: 0 };
  const byOffset = new Map(code.map((instruction) => [instruction.offset, instruction]));
  const nz = (value: number) => {
    z = value === 0;
    n = value >= 128;
    return value;
  };
  const read = (address: number) => {
    const value = memory.get(address);
    if (value === undefined)
      throw new Error(`Uninitialized scalar read at $${address.toString(16)}`);
    return value;
  };
  for (let step = 0; step < 1_000_000; step += 1) {
    const instruction = byOffset.get(pc);
    if (!instruction) throw new Error("Execution left the complete published function");
    const { opcode, operand, width } = instruction;
    const region = tail.has(pc) ? "tail" : "prefix";
    cycles[region] += instruction.cycles;
    const next = pc + width;
    if (opcode === 0x60)
      return { value: a, ...cycles, total: cycles.prefix + cycles.tail + cycles.pages };
    if (opcode === 0x4c) {
      pc = Number(operand) - start;
      continue;
    }
    if (BRANCHES.includes(opcode)) {
      const take =
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
      const displacement = Number(operand);
      const target = next + (displacement < 128 ? displacement : displacement - 256);
      if (take) {
        cycles[region] += 1;
        if ((start + next) >>> 8 !== (start + target) >>> 8) cycles.pages += 1;
      }
      pc = take ? target : next;
      continue;
    }
    const immediate = [0x09, 0x29, 0x49, 0x69, 0xa0, 0xa2, 0xa9, 0xc0, 0xc9, 0xe0, 0xe9].includes(
      opcode,
    );
    const source =
      width === 1 || [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(opcode)
        ? 0
        : immediate
          ? Number(operand)
          : read(Number(operand));
    if ([0xa5, 0xa9, 0xad].includes(opcode)) a = nz(source);
    else if ([0xa2, 0xa6, 0xae].includes(opcode)) x = nz(source);
    else if ([0xa0, 0xa4, 0xac].includes(opcode)) y = nz(source);
    else if ([0x85, 0x8d].includes(opcode)) memory.set(Number(operand), a);
    else if ([0x86, 0x8e].includes(opcode)) memory.set(Number(operand), x);
    else if ([0x84, 0x8c].includes(opcode)) memory.set(Number(operand), y);
    else if (opcode === 0xaa) x = nz(a);
    else if (opcode === 0xa8) y = nz(a);
    else if (opcode === 0x8a) a = nz(x);
    else if (opcode === 0x98) a = nz(y);
    else if ([0xc5, 0xc9, 0xcd, 0xe0, 0xe4, 0xec, 0xc0, 0xc4, 0xcc].includes(opcode)) {
      const left = [0xe0, 0xe4, 0xec].includes(opcode)
        ? x
        : [0xc0, 0xc4, 0xcc].includes(opcode)
          ? y
          : a;
      c = left >= source;
      nz((left - source + 256) % 256);
    } else if ([0x25, 0x29, 0x2d].includes(opcode)) a = nz(a & source);
    else if ([0x05, 0x09, 0x0d].includes(opcode)) a = nz(a | source);
    else if ([0x45, 0x49, 0x4d].includes(opcode)) a = nz(a ^ source);
    else if ([0x65, 0x69, 0x6d, 0xe5, 0xe9, 0xed].includes(opcode)) {
      const subtract = [0xe5, 0xe9, 0xed].includes(opcode);
      const sum = subtract ? a - source - (c ? 0 : 1) : a + source + (c ? 1 : 0);
      c = subtract ? sum >= 0 : sum >= 256;
      a = nz((sum + 256) % 256);
    } else if (opcode === 0x18) c = false;
    else if (opcode === 0x38) c = true;
    else if ([0x0a, 0x2a, 0x4a, 0x6a].includes(opcode)) {
      const previous = a,
        carry = c;
      const left = opcode === 0x0a || opcode === 0x2a;
      c = left ? previous >= 128 : previous % 2 !== 0;
      a = nz(
        left
          ? (previous * 2 + (opcode === 0x2a && carry ? 1 : 0)) % 256
          : Math.floor(previous / 2) + (opcode === 0x6a && carry ? 128 : 0),
      );
    } else if (opcode === 0xca) x = nz((x + 255) % 256);
    else if (opcode === 0x88) y = nz((y + 255) % 256);
    else if (opcode === 0xe8) x = nz((x + 1) % 256);
    else if (opcode === 0xc8) y = nz((y + 1) % 256);
    else if (opcode !== 0xea) throw new Error("Missing official scalar instruction semantics");
    pc = next;
  }
  throw new Error("Scalar shift did not terminate within its finite count domain");
}

function expected(value: number, count: number, operator: string, signed: boolean): number {
  if (count >= 8) return signed && value >= 128 ? 255 : 0;
  let result = signed && value >= 128 ? value - 256 : value;
  for (let step = 0; step < count; step += 1)
    result = operator === "<<" ? (result * 2) % 256 : Math.floor(result / 2);
  return (result + 256) % 256;
}

describe.each(sourceLibraryProfiles)(
  "ordinary mainline bounded byte-result shifts on %s",
  (profile) => {
    it.each(CASES)(
      "should remove unreachable saturation from the exact shift core for $label",
      async (testCase) => {
        const { text, expression, width } = source(testCase.type, testCase.operator, testCase.mode);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const valueHome = parameterHome(artifacts, text, "value", testCase.type, 1);
          const countHome = parameterHome(
            artifacts,
            text,
            "count",
            width === 1 ? "byte" : "word",
            width,
          );
          const variants = cia2FunctionVariants(artifacts, "shift");
          expect(variants).toHaveLength(1);
          for (const variant of variants) {
            const { bytes, start } = variant;
            const code = decode(bytes);
            expect(code.reduce((sum, row) => sum + row.width, 0)).toBe(bytes.length);
            const tail = shiftTail(
              artifacts,
              text,
              expression,
              code,
              start,
              variant,
              testCase.mode.startsWith("guarded") ? { countHome, valueHome, width } : undefined,
            );
            const core = code.filter(({ offset }) => tail.has(offset));
            const tailBytes = core.reduce((sum, row) => sum + row.width, 0);
            const prefixBytes = bytes.length - tailBytes;
            expect(prefixBytes + tailBytes).toBe(bytes.length);
            const measurements = [];
            for (const value of [0, 0x80, 0xff])
              for (const count of [0, 1, 2, 3, 4, 5, 6, 7])
                for (const carry of [false, true]) {
                  const memory = new Map([
                    [valueHome, value],
                    [countHome, count],
                  ]);
                  if (width === 2) memory.set(countHome + 1, 0);
                  const measured = execute(code, start, memory, tail, carry);
                  measurements.push({ value, count, carry, ...measured });
                  expect(measured.value).toBe(
                    expected(value, count, testCase.operator, testCase.signed),
                  );
                  expect(measured.total).toBe(measured.prefix + measured.tail + measured.pages);
                }
            // No prefix ceiling is claimed: every producer/guard and complete function byte/cycle is reported.
            console.info("Complete shift leaf accounting", {
              profile,
              case: testCase.label,
              completeBytes: bytes.length,
              prefixBytes,
              tailBytes,
              measurements,
            });
            expect(
              core.some(({ opcode, operand }) => opcode === 0xe0 && operand === 8),
              "A source guard must not be confused with shift saturation",
            ).toBe(false);
            expect(
              core.some(
                ({ opcode }, index) =>
                  [0xa4, 0xac].includes(opcode) && core[index + 1]?.opcode === 0xd0,
              ),
              "The bounded shift must not load and test a high count in Y",
            ).toBe(false);
            expect(
              core.some(
                ({ opcode, operand }) => opcode === 0xa9 && [0, 255].includes(Number(operand)),
              ),
              "No unreachable terminal fill remains in this operation",
            ).toBe(false);
            for (const measured of measurements)
              expect(measured.tail).toBeLessThanOrEqual(
                measured.count === 0 ? 19 : 17 + (testCase.signed ? 9 : 7) * measured.count,
              );
            expect(tailBytes).toBeLessThanOrEqual(testCase.signed ? 17 : 15);
          }
        });
      },
      180_000,
    );

    it.each(["unknown byte", "unknown word"])(
      "should retain full-count arithmetic saturation without a tighter local bound for %s",
      async (mode) => {
        const { text, width } = source("sbyte", ">>", mode);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const valueHome = parameterHome(artifacts, text, "value", "sbyte", 1);
          const countHome = parameterHome(
            artifacts,
            text,
            "count",
            width === 1 ? "byte" : "word",
            width,
          );
          const variants = cia2FunctionVariants(artifacts, "shift");
          expect(variants).toHaveLength(1);
          for (const { bytes, start } of variants) {
            const code = decode(bytes);
            for (const value of [0, 1, 0x7f, 0x80, 0xff])
              for (const rawCount of [0, 1, 7, 8, 255, 256, 65535]) {
                const count = width === 1 ? rawCount % 256 : rawCount;
                const memory = new Map([
                  [valueHome, value],
                  [countHome, count % 256],
                ]);
                if (width === 2) memory.set(countHome + 1, Math.floor(count / 256));
                expect(execute(code, start, memory, new Set(), false).value).toBe(
                  expected(value, count, ">>", true),
                );
              }
          }
        });
      },
      180_000,
    );
  },
);
