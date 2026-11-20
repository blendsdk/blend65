import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Every program in this suite assigns its word destinations inside `Game.main`. */
const MAIN_SCOPE = "src/game.blend::Game.main";

/** The C64 maps hardware registers across this window, so these addresses are never RAM homes. */
const IO_WINDOW_START = 0xd000;
const IO_WINDOW_END = 0xdfff;

/**
 * One-byte moves grouped by the register they pass through. A load of one RAM
 * address followed immediately by the matching store is a copy, whichever
 * register carries the byte.
 */
const COPY_FAMILIES = [
  { load: "lda", store: "sta" },
  { load: "ldx", store: "stx" },
  { load: "ldy", store: "sty" },
] as const;

/** Instructions that put a new byte into a variable without first loading it from elsewhere. */
const WRITE_OPCODES = ["sta", "stx", "sty", "inc", "dec", "asl", "lsr", "rol", "ror"];

/**
 * Absolute and zero-page encodings of the same one-byte moves, grouped by
 * register. The assembled scan exists to catch a copy whose assembly operands
 * are spelled as names rather than numbers.
 */
const COPY_ENCODINGS: readonly {
  readonly loads: readonly number[];
  readonly stores: readonly number[];
}[] = [
  { loads: [0xad, 0xa5], stores: [0x8d, 0x85] },
  { loads: [0xae, 0xa6], stores: [0x8e, 0x86] },
  { loads: [0xac, 0xa4], stores: [0x8c, 0x84] },
];

/** Reject a missing report field instead of letting absent evidence read as address zero. */
function numberField(record: Record<string, unknown>, name: string): number {
  const value = record[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    throw new Error(`Missing or noninteger report field: ${name}`);
  return value;
}

/** A RAM home lies outside the hardware window; a device register is not a copy source. */
function isRam(address: number): boolean {
  return address < IO_WINDOW_START || address > IO_WINDOW_END;
}

/** Read only declared CPU code, never asset bytes that happen to resemble instructions. */
function codeSegments(artifacts: Artifacts) {
  const origin = artifacts.prg.readUInt16LE(0);
  const intervals = profileRecords(artifacts.memory.intervals).filter(
    (interval) => interval.addressSpaceId === "cpu16" && interval.kind === "code",
  );
  expect(intervals.length).toBeGreaterThan(0);
  return intervals.map((interval) => {
    const start = numberField(interval, "start");
    const end = numberField(interval, "end");
    expect(end - start).toBe(numberField(interval, "size"));
    expect(start).toBeGreaterThanOrEqual(origin);
    expect(end - origin + 2).toBeLessThanOrEqual(artifacts.prg.length);
    return { start, bytes: artifacts.prg.subarray(start - origin + 2, end - origin + 2) };
  });
}

/** Preserve instruction adjacency while ignoring labels, directives and comments. */
function instructions(assembly: string) {
  return assembly.split(/\r?\n/).flatMap((line) => {
    const text = line.split(";")[0]?.trim() ?? "";
    const match = /^(?:[^\s:]+:\s*)?([a-z]{3})(?:\s+(.+))?$/i.exec(text);
    return match?.[1]
      ? [
          {
            opcode: match[1].toLowerCase(),
            operand: (match[2] ?? "").replace(/\s+/g, "").toLowerCase(),
          },
        ]
      : [];
  });
}

/**
 * Resolve a plain memory address operand. Immediates, indexed and indirect
 * operands cannot name a single fixed location, and a symbolic operand is left
 * to the byte scan.
 */
function directAddress(operand: string): number | undefined {
  if (/[#,()]/.test(operand)) return undefined;
  if (/^\$[0-9a-f]+$/i.test(operand)) return Number.parseInt(operand.slice(1), 16);
  if (/^0x[0-9a-f]+$/i.test(operand)) return Number.parseInt(operand.slice(2), 16);
  if (/^\d+$/.test(operand)) return Number(operand);
  return undefined;
}

/** Byte offsets of one exact declaration inside the program text. */
function declarationSpan(source: string, declaration: string) {
  const index = source.indexOf(declaration);
  if (index < 0) throw new Error(`Missing declaration in source: ${declaration}`);
  expect(source.indexOf(declaration, index + 1), `one '${declaration}'`).toBe(-1);
  const startByte = Buffer.byteLength(source.slice(0, index));
  return { startByte, endByte: startByte + Buffer.byteLength(declaration) };
}

/**
 * Resolve the machine address of one declared word variable from the public
 * debug report, selecting it by the exact declaration it came from. Reading
 * the home from the report rather than from the instructions that happen to
 * reach it keeps this check independent of instruction selection: a different
 * but equally correct way of publishing the value cannot move the address this
 * suite reasons about.
 */
function sourceWordHome(artifacts: Artifacts, source: string, declaration: string): number {
  const { startByte, endByte } = declarationSpan(source, declaration);
  const sources = profileRecords(artifacts.debug.sources);
  const matches = profileRecords(artifacts.debug.symbols)
    .map((symbol, index) => ({ symbol, index }))
    .filter(({ symbol }) => {
      if (symbol.kind !== "local" || symbol.type !== "word" || symbol.byteWidth !== 2) return false;
      if (symbol.scope !== MAIN_SCOPE) return false;
      const origin = profileRecord(symbol.origin);
      if (origin.kind !== "source") return false;
      const span = profileRecord(origin.span);
      const path = sources[numberField(span, "sourceIndex")]?.path;
      return (
        path === "src/game.blend" &&
        numberField(span, "startByte") === startByte &&
        numberField(span, "endByte") === endByte
      );
    });
  expect(matches, `one declared word variable for '${declaration}'`).toHaveLength(1);
  const declared = matches[0];
  if (declared === undefined) throw new Error(`Missing declared word variable: ${declaration}`);
  const homes = new Set<number>();
  for (const location of profileRecords(artifacts.debug.locations)) {
    if (location.symbolIndex !== declared.index) continue;
    const availability = profileRecord(location.availability);
    if (availability.kind !== "available") continue;
    for (const piece of profileRecords(availability.pieces)) {
      if (piece.kind !== "memory" || piece.valueOffset !== 0 || piece.byteLength !== 2) continue;
      const machine = profileRecord(piece.machine);
      const start = numberField(machine, "start");
      expect(numberField(machine, "end") - start).toBe(2);
      homes.add(start);
    }
  }
  expect([...homes], `one home for '${declaration}'`).toHaveLength(1);
  const home = [...homes][0];
  if (home === undefined) throw new Error(`Missing home address for: ${declaration}`);
  expect(isRam(home) && isRam(home + 1), `'${declaration}' lives in RAM`).toBe(true);
  expect(
    profileRecords(artifacts.memory.intervals).filter(
      (interval) =>
        interval.addressSpaceId === "cpu16" &&
        interval.kind !== "code" &&
        numberField(interval, "start") <= home &&
        numberField(interval, "end") >= home + 2,
    ).length,
    `declared storage covering '${declaration}'`,
  ).toBeGreaterThan(0);
  return home;
}

/** Describe adjacent instruction pairs in assembly text that copy a RAM byte into `targets`. */
function textCopiesInto(artifacts: Artifacts, targets: readonly number[]): string[] {
  const listing = instructions(artifacts.assembly);
  return listing.flatMap((store, index) => {
    const load = listing[index - 1];
    if (load === undefined) return [];
    const family = COPY_FAMILIES.find(
      (candidate) => candidate.load === load.opcode && candidate.store === store.opcode,
    );
    if (family === undefined) return [];
    const target = directAddress(store.operand);
    const source = directAddress(load.operand);
    if (target === undefined || source === undefined) return [];
    if (!targets.includes(target) || source === target || !isRam(source)) return [];
    return [`${load.opcode} ${load.operand} / ${store.opcode} ${store.operand}`];
  });
}

/** One assembled instruction of the application: where it starts and how long it is. */
interface Instruction {
  readonly start: number;
  readonly length: number;
}

/**
 * Instruction extents of the compiled application entry, taken from the public
 * debug report. Working from declared instruction boundaries keeps platform
 * startup code and operand bytes that happen to resemble an opcode out of the
 * assembled scan below.
 */
function applicationInstructions(artifacts: Artifacts): readonly Instruction[] {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (entry) => entry.qualifiedName === MAIN_SCOPE,
  );
  expect(functions, "one compiled application entry").toHaveLength(1);
  const entry = functions[0];
  if (entry === undefined) throw new Error("Missing compiled application entry");
  const indexes = entry.rangeIndexes;
  if (!Array.isArray(indexes) || indexes.length === 0)
    throw new Error("Compiled application entry has no instruction ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  // Several source spans can map onto one instruction, so extents are unique by start.
  const extents = new Map<number, number>();
  for (const index of indexes) {
    if (typeof index !== "number" || !Number.isInteger(index))
      throw new Error("Instruction range does not resolve");
    const range = ranges[index];
    if (range === undefined) throw new Error("Instruction range does not resolve");
    const machine = profileRecord(range.machine);
    const start = numberField(machine, "start");
    const end = numberField(machine, "end");
    expect(end).toBeGreaterThan(start);
    extents.set(start, end - start);
  }
  return [...extents]
    .map(([start, length]) => ({ start, length }))
    .sort((left, right) => left.start - right.start);
}

/** Decode one application instruction into its opcode and its single address operand. */
function decode(artifacts: Artifacts, instruction: Instruction) {
  const offset = instruction.start - artifacts.prg.readUInt16LE(0) + 2;
  if (offset < 2 || offset + instruction.length > artifacts.prg.length)
    throw new Error("Application instruction lies outside the delivered PRG");
  const opcode = artifacts.prg[offset];
  if (opcode === undefined) throw new Error("Application instruction has no opcode");
  if (instruction.length === 3) return { opcode, address: artifacts.prg.readUInt16LE(offset + 1) };
  if (instruction.length === 2) return { opcode, address: artifacts.prg[offset + 1] };
  return { opcode, address: undefined };
}

/** Describe assembled application instruction pairs that copy a RAM byte into `targets`. */
function assembledCopiesInto(artifacts: Artifacts, targets: readonly number[]): string[] {
  const listing = applicationInstructions(artifacts);
  const found: string[] = [];
  for (let index = 1; index < listing.length; index += 1) {
    const previous = listing[index - 1];
    const current = listing[index];
    if (previous === undefined || current === undefined) continue;
    if (previous.start + previous.length !== current.start) continue;
    const store = decode(artifacts, current);
    const load = decode(artifacts, previous);
    if (store.address === undefined || load.address === undefined) continue;
    if (!targets.includes(store.address)) continue;
    if (load.address === store.address || !isRam(load.address)) continue;
    const copies = COPY_ENCODINGS.some(
      (family) => family.loads.includes(load.opcode) && family.stores.includes(store.opcode),
    );
    if (copies)
      found.push(`copy into $${store.address.toString(16)} at $${previous.start.toString(16)}`);
  }
  return found;
}

/**
 * Require that the arithmetic assigned to a whole-word variable lands in that
 * variable itself. Both of the variable's bytes must really be written, and no
 * byte of it may arrive by being loaded out of another RAM location — which is
 * what computing into a separate scratch pair and copying the pair across
 * would look like.
 */
function expectArithmeticWrittenIntoDestination(
  artifacts: Artifacts,
  source: string,
  declaration: string,
): void {
  const home = sourceWordHome(artifacts, source, declaration);
  const targets = [home, home + 1];
  const listing = instructions(artifacts.assembly);
  for (const [offset, half] of [
    [0, "low"],
    [1, "high"],
  ] as const) {
    expect(
      listing.filter(
        (instruction) =>
          WRITE_OPCODES.includes(instruction.opcode) &&
          directAddress(instruction.operand) === home + offset,
      ).length,
      `'${declaration}': the ${half} byte is written`,
    ).toBeGreaterThan(0);
  }
  expect(
    textCopiesInto(artifacts, targets),
    `'${declaration}': no copy into the destination`,
  ).toEqual([]);
  expect(
    assembledCopiesInto(artifacts, targets),
    `'${declaration}': no assembled copy into the destination`,
  ).toEqual([]);
}

/** One whole-word variable updated in place once per frame, the shape an expert writes by hand. */
function selfDestinationSource(operator: "+" | "-", start: string): string {
  return `module Game;
function main(): void {
  let x: word = ${start};
  while (true) {
    while (peek($D012) != 251) { }
    x = x ${operator} 2;
    poke($D000, lo(x));
    poke($D001, hi(x));
  }
}`;
}

/** A second whole-word variable receives the arithmetic; the operand keeps its own value. */
function separateDestinationSource(operator: "+" | "-"): string {
  return `module Game;
function main(): void {
  let x: word = $00FE;
  let y: word = 0;
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 1;
    y = x ${operator} 2;
    poke($D000, lo(y));
    poke($D001, hi(y));
    poke($D002, lo(x));
    poke($D003, hi(x));
  }
}`;
}

/**
 * Shapes a whole-variable rewrite cannot be applied to, or must treat
 * conservatively, still have to compile and produce a program. None of them is
 * a reason for source to be rewritten by hand.
 */
const ACCEPTED_SHAPES = [
  [
    "module-level word destination",
    `module Game;
let x: word = $00FE;
function main(): void {
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 2;
    poke($D000, lo(x));
    poke($D001, hi(x));
  }
}`,
  ],
  [
    "word array element destination",
    `module Game;
let slots: word[2] = [$1234, 0];
function main(): void {
  let x: word = $00FE;
  let index: byte = 1;
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 1;
    slots[index] = x + 2;
    poke($D000, lo(slots[index]));
    poke($D001, hi(slots[0]));
  }
}`,
  ],
  [
    "struct field destination",
    `module Game;
struct Pair { first: word; second: word; }
let pair: Pair = { first: $5678, second: 0 };
function main(): void {
  let x: word = $00FE;
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 1;
    pair.second = x + 2;
    poke($D000, lo(pair.second));
    poke($D001, hi(pair.first));
  }
}`,
  ],
  [
    "hardware destination",
    `module Game;
function main(): void {
  let x: word = $00FE;
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 1;
    poke($D000, lo(x + 2));
    poke($D001, hi(x + 2));
  }
}`,
  ],
  [
    "signed word destination",
    `module Game;
function main(): void {
  let s: sword = 2;
  while (true) {
    while (peek($D012) != 251) { }
    s = s - 2;
    poke($D000, lo(word(s)));
    poke($D001, hi(word(s)));
  }
}`,
  ],
  [
    "chained arithmetic",
    `module Game;
function main(): void {
  let b: word = $00FD;
  let c: word = 5;
  let a: word = 0;
  while (true) {
    while (peek($D012) != 251) { }
    b = b + 1;
    c = c + 2;
    a = b + c - 2;
    poke($D000, lo(a));
    poke($D001, hi(a));
  }
}`,
  ],
  [
    "escaped destination address",
    `module Game;
function main(): void {
  let x: word = $00FE;
  let address: word = word(&x);
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 2;
    poke($D000, lo(x));
    poke($D001, peek(address));
  }
}`,
  ],
  [
    "installed interrupt",
    `module Game;
import { setIRQ } from c64.system;
interrupt function observe(): void { poke($D020, 1); }
function main(): void {
  let x: word = $00FE;
  setIRQ(&observe);
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 2;
    poke($D000, lo(x));
    poke($D001, hi(x));
  }
}`,
  ],
  [
    "helper-returned operand",
    `module Game;
function sample(): word { return word(peek($D012)); }
function main(): void {
  let x: word = $00FE;
  while (true) {
    while (peek($D012) != 251) { }
    x = sample() + 2;
    poke($D000, lo(x));
    poke($D001, hi(x));
  }
}`,
  ],
  [
    "word parameter operand",
    `module Game;
function publish(value: word): void {
  let next: word = value + 2;
  poke($D000, lo(next));
  poke($D001, hi(next));
}
function main(): void {
  let x: word = $00FE;
  while (true) {
    while (peek($D012) != 251) { }
    x = x + 1;
    publish(x);
  }
}`,
  ],
] as const;

describe("public whole-word assignment emission", () => {
  for (const profile of PROFILES) {
    for (const operator of ["+", "-"] as const) {
      it(`should write ${operator} arithmetic straight into the assigned variable on ${profile}`, async () => {
        const start = operator === "+" ? "$00FE" : "$0100";
        const source = selfDestinationSource(operator, start);
        const artifacts = await buildProfileSource(source, profile, "none");
        expectArithmeticWrittenIntoDestination(artifacts, source, `let x: word = ${start};`);
      }, 120_000);
    }
  }

  for (const operator of ["+", "-"] as const) {
    it(`should write ${operator} arithmetic straight into a separate destination variable`, async () => {
      const source = separateDestinationSource(operator);
      const artifacts = await buildProfileSource(source, PROFILES[0], "none");
      expectArithmeticWrittenIntoDestination(artifacts, source, "let y: word = 0;");
      expectArithmeticWrittenIntoDestination(artifacts, source, "let x: word = $00FE;");
    }, 120_000);
  }

  for (const [name, source] of ACCEPTED_SHAPES) {
    it(`should keep accepting ordinary source with a ${name}`, async () => {
      const artifacts = await buildProfileSource(source, PROFILES[0], "none");
      expect(artifacts.prg.length).toBeGreaterThan(2);
      expect(codeSegments(artifacts).length).toBeGreaterThan(0);
    }, 120_000);
  }
});
