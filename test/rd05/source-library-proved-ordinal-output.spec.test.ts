import { describe, expect, it } from "vitest";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";
import { sourceLibraryProfiles, withLibraryBuild } from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

/** Complete guard/false-return budgets are separate from the bounded borrowed-read tail. */
const CASES = [
  {
    name: "true upper bound",
    body: "if (index < 256) { return rows[index]; } return 0;",
    budget: [29, 41, 21, 35],
  },
  {
    name: "false comparison arm",
    body: "if (index >= 256) { return 0; } else { return rows[index]; }",
    budget: [29, 41, 21, 35],
  },
  {
    name: "early-return continuation",
    body: "if (index >= 256) { return 0; } return rows[index];",
    budget: [29, 41, 21, 35],
  },
  {
    name: "smaller upper bound",
    body: "if (index < 128) { return rows[index]; } return 0;",
    budget: [36, 49, 21, 35],
  },
  {
    name: "byte-range mask",
    body: "return rows[index & $ff];",
    budget: [21, 35, 21, 35],
  },
  {
    name: "nonwrapping constant offset",
    body: "if (index < 253) { return rows[index + 3]; } return 0;",
    budget: [39, 53, 24, 39],
  },
  {
    name: "bound on every join path",
    body: "if (choice == 0) { if (index >= 256) { return 0; } } else { if (index >= 256) { return 0; } } return rows[index];",
    budget: [42, 50, 21, 35],
  },
  {
    name: "different sufficient join bounds",
    body: "if (choice == 0) { if (index >= 128) { return 0; } } else { if (index >= 256) { return 0; } } return rows[index];",
    budget: [49, 58, 21, 35],
  },
] as const;

/** A copied word parameter stays private while the caller's word remains ordinary source storage. */
function source(body: string): string {
  return `module Game;
place(at: $40f0) let data: byte[300];
place(at: $3300) let ordinal: word;
place(at: $3302) let selector: byte;
place(at: $3200) let result: byte;
export function query(rows: const byte[300], index: word, choice: byte): byte { ${body} }
export function observed(): void { }
export function main(): void { while (true) { result = query(data, ordinal, selector); observed(); } }`;
}

/** Resolve a declared word parameter's actual two-byte home using public source/location evidence. */
function wordHome(artifacts: LibraryArtifacts, text: string): number {
  const wanted = profileSpan(text, "index");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (row) => row.path === wanted.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const symbols = profileRecords(artifacts.debug.symbols);
  const matches = symbols.filter((symbol) => {
    if (symbol.kind !== "parameter" || symbol.scope !== "src/game.blend::Game.query") return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const span = profileRecord(origin.span);
    return (
      span.sourceIndex === sourceIndex &&
      typeof span.startByte === "number" &&
      typeof span.endByte === "number" &&
      span.startByte <= wanted.start &&
      span.endByte >= wanted.end
    );
  });
  expect(matches, "A real copied source-word parameter is required").toHaveLength(1);
  const symbol = matches[0]!;
  expect(symbol.type).toBe("word");
  expect(symbol.byteWidth).toBe(2);
  if (!Array.isArray(symbol.locationIndexes))
    throw new Error("The word parameter needs published locations");
  const locations = profileRecords(artifacts.debug.locations);
  const homes = symbol.locationIndexes.flatMap((index) => {
    if (typeof index !== "number" || !Number.isInteger(index) || locations[index] === undefined)
      throw new Error("A parameter location must resolve");
    const location = locations[index]!;
    expect(location.symbolIndex).toBe(symbols.indexOf(symbol));
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") return [];
    return profileRecords(availability.pieces)
      .filter((piece) => piece.kind === "memory")
      .map((piece) => {
        expect(piece.byteLength).toBe(2);
        expect(piece.valueOffset).toBe(0);
        const machine = profileRecord(piece.machine);
        if (typeof machine.start !== "number" || !Number.isInteger(machine.start))
          throw new Error("The word home needs a physical address");
        expect(machine.end).toBe(machine.start + 2);
        return machine.start;
      });
  });
  const unique = [...new Set(homes)];
  expect(unique, "Word storage stays two bytes").toHaveLength(1);
  const address = unique[0]!;
  expect(address).toBeGreaterThanOrEqual(0);
  expect(address).toBeLessThanOrEqual(65534);
  return address;
}

/** Focused official NMOS widths/base cycles include guard, pointer formation and return instructions. */
const NMOS = new Map<number, readonly [number, number]>();
for (const row of [
  "05:2:3 09:2:2 0d:3:4 18:1:2 25:2:3 29:2:2 2d:3:4 38:1:2",
  "45:2:3 49:2:2 4c:3:3 4d:3:4 60:1:6 65:2:3 69:2:2 6d:3:4",
  "85:2:3 86:2:3 8a:1:2 8d:3:4 8e:3:4 90:2:2 98:1:2 a0:2:2 a1:2:6",
  "a2:2:2 a4:2:3 a5:2:3 a6:2:3 a8:1:2 a9:2:2 aa:1:2 ac:3:4 ad:3:4 ae:3:4",
  "b0:2:2 b1:2:5 b9:3:4 bd:3:4 c5:2:3 c9:2:2 cd:3:4 d0:2:2",
  "e0:2:2 e5:2:3 e9:2:2 ed:3:4 f0:2:2",
])
  for (const encoded of row.split(" ")) {
    const [opcode, width, cycles] = encoded.split(":");
    NMOS.set(Number.parseInt(opcode!, 16), [Number(width), Number(cycles)]);
  }

/** One boundary-aligned instruction in the complete emitted source function. */
interface Instruction {
  readonly offset: number;
  readonly opcode: number;
  readonly operand: number | null;
  readonly width: number;
  readonly cycles: number;
}

/** No source-sliced producer traffic is omitted from the complete decode. */
function decode(bytes: Buffer): Instruction[] {
  const result: Instruction[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const shape = NMOS.get(opcode);
    if (!shape || offset + shape[0] > bytes.length)
      throw new Error(`Unaccounted ordinal instruction $${opcode.toString(16)} at ${offset}`);
    result.push({
      offset,
      opcode,
      operand:
        shape[0] === 1
          ? null
          : shape[0] === 2
            ? bytes[offset + 1]!
            : bytes.readUInt16LE(offset + 1),
      width: shape[0],
      cycles: shape[1],
    });
    offset += shape[0];
  }
  return result;
}

/** Relative branch targets include the signed displacement from the post-operand PC. */
function branchTarget(instruction: Instruction): number {
  if (instruction.operand === null) throw new Error("Missing relative displacement");
  return (
    instruction.offset +
    2 +
    (instruction.operand < 128 ? instruction.operand : instruction.operand - 256)
  );
}

/** Charge complete acyclic paths and taken branch page penalties, including all layout bridges. */
function pathCycles(code: readonly Instruction[], start: number, entry = 0): number {
  const instructions = new Map(code.map((instruction) => [instruction.offset, instruction]));
  const visit = (offset: number, active: ReadonlySet<number>): number => {
    const instruction = instructions.get(offset);
    if (!instruction || active.has(offset))
      throw new Error("The declared leaf boundary needs complete acyclic code");
    const visited = new Set([...active, offset]);
    const next = offset + instruction.width;
    if (instruction.opcode === 0x60) return 6;
    if (instruction.opcode === 0x4c) return 3 + visit(Number(instruction.operand) - start, visited);
    if ([0x90, 0xb0, 0xd0, 0xf0].includes(instruction.opcode)) {
      const target = branchTarget(instruction);
      const page = (start + next) >>> 8 === (start + target) >>> 8 ? 0 : 1;
      return 2 + Math.max(visit(next, visited), 1 + page + visit(target, visited));
    }
    // The reference pointer family explicitly sets Y=0. Other indexed reads include their page risk.
    const previousY = code
      .filter((row) => row.offset < offset && [0xa0, 0xa4, 0xac, 0xa8].includes(row.opcode))
      .at(-1);
    const page =
      instruction.opcode === 0xb1
        ? previousY?.opcode === 0xa0 && previousY.operand === 0
          ? 0
          : 1
        : [0xb9, 0xbd].includes(instruction.opcode)
          ? 1
          : 0;
    return instruction.cycles + page + visit(next, visited);
  };
  return visit(entry, new Set());
}

/** Locate the complete guard-free block that constructs and reads the borrowed byte address. */
function readTail(
  code: readonly Instruction[],
  start: number,
  home: number,
): readonly Instruction[] {
  const reads = code.filter(({ opcode }) => [0xa1, 0xb1, 0xb9, 0xbd].includes(opcode));
  expect(
    reads,
    "The unknown borrowed byte read must have real address-dependent code",
  ).toHaveLength(1);
  const leaders = new Set([0]);
  for (const instruction of code) {
    if ([0x90, 0xb0, 0xd0, 0xf0].includes(instruction.opcode))
      leaders.add(branchTarget(instruction));
    if (instruction.opcode === 0x4c) leaders.add(Number(instruction.operand) - start);
    if ([0x90, 0xb0, 0xd0, 0xf0, 0x4c, 0x60].includes(instruction.opcode))
      leaders.add(instruction.offset + instruction.width);
  }
  const first = Math.max(...[...leaders].filter((offset) => offset <= reads[0]!.offset));
  const last = Math.min(...[...leaders].filter((offset) => offset > reads[0]!.offset));
  const tail = code.filter(({ offset }) => offset >= first && offset < last);
  // A cheaper equivalent may share an RTS; charge its actual bridge and terminal code too.
  while (tail.at(-1)?.opcode === 0x4c) {
    let offset = Number(tail.at(-1)!.operand) - start;
    while (true) {
      const instruction = code.find((row) => row.offset === offset);
      if (!instruction || tail.includes(instruction))
        throw new Error("Missing acyclic return tail");
      tail.push(instruction);
      if ([0x60, 0x4c].includes(instruction.opcode)) break;
      if ([0x90, 0xb0, 0xd0, 0xf0].includes(instruction.opcode))
        throw new Error("The read-tail boundary cannot hide another guard");
      offset += instruction.width;
    }
  }
  expect(tail.at(-1)?.opcode, "This cost boundary includes the successful scalar return").toBe(
    0x60,
  );
  expect(
    code.some(
      ({ operand, opcode }) =>
        operand === home && [0xa5, 0xad, 0xa4, 0xac, 0xa6, 0xae, 0x65, 0x6d].includes(opcode),
    ),
  ).toBe(true);
  expect(
    tail.some(
      ({ operand, opcode }) =>
        operand === home + 1 &&
        [
          0x05, 0x0d, 0x25, 0x2d, 0x45, 0x4d, 0x65, 0x6d, 0xa4, 0xa5, 0xa6, 0xac, 0xad, 0xae, 0xc5,
          0xcd, 0xe5, 0xed,
        ].includes(opcode),
    ),
    "The qualified address uses no high ordinal data",
  ).toBe(false);
  return tail;
}

describe.each(sourceLibraryProfiles)(
  "proved byte-range ordinals with unchecked bounds on %s",
  (profile) => {
    it.each(CASES)(
      "should preserve a word home and meet the complete access bound for $name",
      async (testCase) => {
        // The local read family is 20 bytes/29 cycles; RTS makes 21/35, without a whole-program claim.
        // Complete leaves also charge guards, rejected returns and join bridges; callers are separate.
        const text = source(testCase.body);
        await withLibraryBuild(text, "module Extra;", profile, async (artifacts) => {
          expect(profileRecord(artifacts.debug.safety).boundsCheck).toBe(false);
          const home = wordHome(artifacts, text);
          const variants = cia2FunctionVariants(artifacts, "query");
          expect(variants).toHaveLength(1);
          for (const { bytes, start } of variants) {
            const code = decode(bytes);
            const tail = readTail(code, start, home);
            expect(
              tail.reduce((sum, instruction) => sum + instruction.width, 0),
            ).toBeLessThanOrEqual(testCase.budget[2]);
            expect(pathCycles(tail, start, tail[0]!.offset)).toBeLessThanOrEqual(
              testCase.budget[3],
            );
            expect(bytes.length).toBeLessThanOrEqual(testCase.budget[0]);
            expect(pathCycles(code, start)).toBeLessThanOrEqual(testCase.budget[1]);
          }
        });
      },
      180_000,
    );
  },
);
