import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";
import { cia2OperationGroups, cia2PrgBytes } from "./cia2-output-fixture.js";
import { profileRecord, profileRecords, profileSpan } from "./profile-fixture.js";

/** The complete source-owned operation whose effects and cost are observed. */
const ASSIGNMENT = "rows[column & 7] = peek(CIA1_PB);";
/** Named hardware registers and observation barriers shared by both source cases. */
const COMMON = `module Game;
const CIA1_PA: word = $DC00;
const CIA1_PB: word = $DC01;
const selectedMask: byte = $FE;
place(at: $3300) let output: byte[8];
function armed(): void { asm_nop(); }
function observed(): void { asm_nop(); }
`;
/** An ordinary fresh local recipient leaves the returned destination private. */
const RETURN_SOURCE = `${COMMON}
function sample(column: word): byte[8] {
  let rows: byte[8] = [0; 0];
  poke(CIA1_PA, selectedMask);
  ${ASSIGNMENT}
  return rows;
}
function main(): void {
  asm_sei(); armed();
  let result: byte[8] = sample(peekw($3002));
  output = result;
  observed();
}`;
/** A runtime outer ordinal borrows one row without copying across the CPU port. */
const BORROW_SOURCE = `${COMMON}
place(at: $30FC) let outer: byte[1][8];
function sample(rows: byte[8], column: word): void {
  poke(CIA1_PA, selectedMask);
  ${ASSIGNMENT}
}
function main(): void {
  asm_sei(); armed();
  sample(outer[peekw($3000)], peekw($3002));
  observed();
}`;

/** Documented NMOS lengths/cycles for straight-line load/store address formation. */
const OPCODES = new Map<number, readonly [number, number]>();
for (const [length, cycles, opcodes] of [
  [1, 2, "18 38 58 78 b8 d8 f8 ea aa a8 ba 8a 9a 98 ca 88 e8 c8 0a 4a 2a 6a"],
  [2, 2, "69 29 c9 e0 c0 49 a9 a2 a0 09 e9"],
  [2, 3, "65 25 24 c5 e4 c4 45 a5 a6 a4 05 e5 85 86 84"],
  [3, 4, "6d 2d 2c cd ec cc 4d ad ae ac 0d ed 8d 8e 8c bd b9"],
  [2, 5, "71 31 d1 51 b1 11 f1"],
  [2, 6, "61 21 c1 41 a1 01 e1 81 91"],
  [3, 5, "9d 99"],
] as const) {
  for (const opcode of opcodes.split(" ")) OPCODES.set(parseInt(opcode, 16), [length, cycles]);
}

/** Decode complete instructions so operand bytes cannot masquerade as stores. */
function instructions(bytes: Uint8Array, start: number) {
  const decoded: { address: number; opcode: number; operand: number; cycles: number }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const facts = OPCODES.get(opcode);
    if (!facts) throw new Error(`Unsupported address opcode ${opcode.toString(16)}`);
    const [length, cycles] = facts;
    expect(offset + length, "complete instruction").toBeLessThanOrEqual(bytes.length);
    decoded.push({
      address: start + offset,
      opcode,
      operand: (bytes[offset + 1] ?? 0) | ((length === 3 ? bytes[offset + 2]! : 0) << 8),
      cycles,
    });
    offset += length;
  }
  return decoded;
}

/** Include nested operands between the preceding PA write and the completed row store. */
function assignmentSlices(artifacts: LibraryArtifacts, source: string) {
  const writes = cia2OperationGroups(artifacts, source, "poke(CIA1_PA, selectedMask);", "sample");
  const assignment = profileSpan(source, ASSIGNMENT);
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    ({ path }) => path === assignment.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const ranges = profileRecords(artifacts.debug.ranges);
  const functions = profileRecords(artifacts.debug.functions);
  return writes.map((write) => {
    const variant = profileRecords(functions[write.functionIndex]!.entryVariants)[
      write.variantIndex
    ]!;
    if (!Array.isArray(variant.rangeIndexes)) throw new Error("Missing variant ranges");
    const spans = variant.rangeIndexes.flatMap((index: unknown) => {
      const range = ranges[evidenceInteger(index)]!;
      const origin = profileRecord(range.origin);
      const value = origin.kind === "source" ? origin.span : origin.sourceSpan;
      if (value === undefined) return [];
      const span = profileRecord(value);
      if (
        span.sourceIndex !== sourceIndex ||
        evidenceInteger(span.startByte) < assignment.start ||
        evidenceInteger(span.endByte) > assignment.end
      )
        return [];
      const machine = profileRecord(range.machine);
      return [{ start: evidenceInteger(machine.start), end: evidenceInteger(machine.end) }];
    });
    spans.sort((a, b) => a.start - b.start);
    expect(spans.length).toBeGreaterThan(0);
    const start = write.end;
    let end = start;
    for (const span of spans) {
      expect(span.start).toBeGreaterThanOrEqual(start);
      expect(span.start, "complete adjacent operation coverage").toBeLessThanOrEqual(end);
      expect(span.end).toBeGreaterThan(span.start);
      end = Math.max(end, span.end);
    }
    expect(start).toBeLessThan(end);
    return { ...write, start, end, bytes: cia2PrgBytes(artifacts, start, end) };
  });
}

/** Reject malformed public metadata before selecting source or machine intervals. */
function evidenceInteger(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Expected integer evidence metadata");
  return value;
}

describe.sequential("masked volatile input stores", () => {
  for (const profile of sourceLibraryProfiles) {
    // A caller-owned return retains exactly the sampled byte and all initialized rows.
    it(`should return the single sampled row after the selected column write on ${profile}`, async () => {
      await observeStore(RETURN_SOURCE, profile, false);
    }, 120_000);

    // Runtime unchecked ordinals form full addresses, including carry across $FFFF.
    it(`should store through a borrowed row across the address-space wrap on ${profile}`, async () => {
      await observeStore(BORROW_SOURCE, profile, true);
    }, 120_000);

    // Full destination formation precedes the volatile read and retains X with Y=0.
    it(`should meet the hidden-destination store budget on ${profile}`, async () => {
      await withLibraryBuild(RETURN_SOURCE, "module Extra;", profile, async (artifacts) => {
        const groups = assignmentSlices(artifacts, RETURN_SOURCE);
        expect(groups.length).toBeGreaterThan(0);
        for (const group of groups) {
          const code = instructions(group.bytes, group.start);
          // LDA abs, AND #, CLC, ADC zp, STA zp, LDA zp, ADC #,
          // STA zp, LDY #0, LDA abs, STA (zp),Y = 23 bytes / 34 cycles.
          expect.soft(group.bytes.length).toBeLessThanOrEqual(23);
          const cycles = code.reduce((sum, instruction) => sum + instruction.cycles, 0);
          expect.soft(cycles).toBeLessThanOrEqual(34);
          expect(code.at(-2)).toMatchObject({ opcode: 0xad, operand: 0xdc01 });
          expect(code.at(-1)!.opcode).toBe(0x91);
          expect(
            code.some(({ opcode }) =>
              [0xa2, 0xa6, 0xae, 0xb6, 0xbe, 0xaa, 0xba, 0xe8, 0xca].includes(opcode),
            ),
          ).toBe(false);
        }
      });
    }, 120_000);
  }
});

/** Observe source-owned accesses without patching code, CPU registers, or stack. */
async function observeStore(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  wrap: boolean,
) {
  await withLibraryBuild(source, "module Extra;", profile, async (artifacts, built) => {
    const [group] = assignmentSlices(artifacts, source);
    expect(group).toBeDefined();
    const code = instructions(group!.bytes, group!.start);
    const read = code.find(({ opcode, operand }) => opcode === 0xad && operand === 0xdc01);
    const store = code.findLast(({ opcode }) => opcode === 0x91);
    expect(read).toBeDefined();
    expect(store).toBeDefined();
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      const input = Uint8Array.from(wrap ? [0xe0, 0x19, 0xff, 0xff] : [0, 0, 0xff, 0xff]);
      await monitor.writeMemory(0x3000, input);
      await monitor.writeMemory(0x3300, new Uint8Array(8).fill(0xcc));
      await stopAt(libraryEntry(artifacts, "src/game.blend::Game.armed"));
      await monitor.writeIo(0xdc02, Uint8Array.of(0xff, 0xff));
      await monitor.writeIo(0xdc01, Uint8Array.of(0xa5));
      await monitor.takeCheckpointHits();
      const pa = await monitor.setAccessTracepoint(0xdc00, "store");
      const pb = await monitor.setAccessTracepoint(0xdc01, "load");
      const portWrites = [
        await monitor.setAccessTracepoint(0, "store"),
        await monitor.setAccessTracepoint(1, "store"),
      ];
      await stopAt(group!.start);
      // Startup owns initial mapping; this source operation must preserve that mapping.
      const port = await monitor.readMemory(0, 1);
      const before = await monitor.readCpuRegisters();
      await stopAt(read!.address + 3);
      const sample = (await monitor.readCpuRegisters()).a;
      expect(sample).toBe(0xa5);
      if (store!.address !== read!.address + 3) await stopAt(store!.address);
      const registers = await monitor.readCpuRegisters();
      const pointer = await monitor.readMemory(store!.operand, store!.operand + 1);
      const destination = (pointer[0]! + (pointer[1]! << 8) + registers.y) & 0xffff;
      if (wrap) expect(destination).toBe(3);
      expect(registers.a).toBe(sample);
      expect(registers.x).toBe(before.x);
      expect(registers.y).toBe(0);
      const selected = await monitor.setAccessTracepoint(destination, "store");
      await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
      const hits = await monitor.takeCheckpointHits();
      const expectedTrace = [pa, pb, selected];
      expect(hits.filter((id) => [...expectedTrace, ...portWrites].includes(id))).toEqual(
        expectedTrace,
      );
      expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(0xfe);
      expect((await monitor.readMemory(destination, destination))[0]).toBe(sample);
      expect(await monitor.readMemory(0x3000, 0x3003)).toEqual(input);
      expect(Array.from(await monitor.readMemory(0, 1))).toEqual(Array.from(port));
      if (!wrap)
        expect(Array.from(await monitor.readMemory(0x3300, 0x3307))).toEqual([
          ...new Uint8Array(7),
          sample,
        ]);
    });
  });
}
