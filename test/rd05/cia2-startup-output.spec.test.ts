import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const source = "module Game; place(at: $2000) function main(): void {}";

// Official NMOS instruction lengths; zero marks an undocumented encoding.
const lengths = new Map<number, number>();
for (const [length, opcodes] of [
  [1, "00 08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8"],
  [
    2,
    "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
  ],
  [
    3,
    "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
  ],
] as const) {
  for (const opcode of opcodes.split(" ")) lengths.set(Number.parseInt(opcode, 16), length);
}

/** One complete official NMOS instruction observed in an assembled code span. */
type Instruction = { opcode: number; operand: number; bytes: number[] };

/** Decode a bounded public startup span, rejecting truncated or undocumented opcodes. */
function instructions(prg: Buffer, start: number, end: number): Instruction[] {
  const load = prg.readUInt16LE(0);
  const first = start - load + 2;
  const last = end - load + 2;
  expect(Number.isInteger(start) && Number.isInteger(end)).toBe(true);
  expect(first).toBeGreaterThanOrEqual(2);
  expect(last).toBeGreaterThan(first);
  expect(last).toBeLessThanOrEqual(prg.length);
  const result: Instruction[] = [];
  for (let cursor = first; cursor < last; ) {
    const opcode = prg[cursor]!;
    const length = lengths.get(opcode) ?? 0;
    expect(length, `official opcode at $${(cursor + load - 2).toString(16)}`).toBeGreaterThan(0);
    expect(cursor + length).toBeLessThanOrEqual(last);
    const bytes = [...prg.subarray(cursor, cursor + length)];
    result.push({
      opcode,
      operand: length === 3 ? bytes[1]! | (bytes[2]! << 8) : (bytes[1] ?? 0),
      bytes,
    });
    cursor += length;
  }
  return result;
}

describe.sequential("CIA2 fixed-bank startup assembled output", () => {
  for (const profile of profiles) {
    it(`${profile}: saves directions, selects input-mode bank zero, and restores within the resource ceiling`, async () => {
      const artifacts = await buildProfileSource(source, profile);
      expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
      const intervals = profileRecords(artifacts.memory.intervals);
      const startupState = intervals.filter((interval) => interval.id === "platform.startup-state");
      expect(startupState).toHaveLength(1);
      expect(startupState[0]!.kind).toBe("bss");
      expect(startupState[0]!.owner).toEqual({
        kind: "compiler",
        id: "platform.startup-state",
      });
      expect(startupState[0]!.size).toBe(49);
      expect(
        intervals.filter(
          (interval) =>
            interval.kind === "bss" &&
            profileRecord(interval.owner).kind === "compiler" &&
            profileRecord(interval.owner).id === "platform.startup-state",
        ),
      ).toHaveLength(1);
      expect(Number(startupState[0]!.end) - Number(startupState[0]!.start)).toBe(49);
      expect(
        intervals.filter((interval) =>
          ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
        ),
      ).toEqual([]);
      const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
      for (const id of ["zeroPage", "scratch"]) {
        expect(
          resources.filter((resource) => resource.kind === "standard" && resource.id === id),
        ).toEqual([{ kind: "standard", id, value: 0 }]);
      }

      const slices = ["code.startup.entry", "code.startup.restore"].map((id) => {
        const matches = intervals.filter((interval) => interval.id === id);
        expect(matches).toHaveLength(1);
        const interval = matches[0]!;
        expect(interval.kind).toBe("code");
        expect(interval.owner).toEqual({ kind: "platform", id: "startup" });
        return instructions(artifacts.prg, Number(interval.start), Number(interval.end));
      });
      const entry = slices[0]!;
      const restore = slices[1]!;
      const all = [...entry, ...restore];
      expect(
        all.filter(
          (instruction) => instruction.bytes.length === 3 && instruction.operand === 0xdd00,
        ),
      ).toEqual([]);
      const reads = entry.flatMap((instruction, index) =>
        instruction.opcode === 0xad && instruction.operand === 0xdd02 ? [index] : [],
      );
      const writes = entry.flatMap((instruction, index) =>
        instruction.opcode === 0x8d && instruction.operand === 0xdd02 ? [index] : [],
      );
      const returnWrites = restore.flatMap((instruction, index) =>
        instruction.opcode === 0x8d && instruction.operand === 0xdd02 ? [index] : [],
      );
      expect(reads).toHaveLength(1);
      expect(writes).toHaveLength(1);
      expect(returnWrites).toHaveLength(1);
      expect(
        all.filter(
          (instruction) => instruction.bytes.length === 3 && instruction.operand === 0xdd02,
        ),
      ).toHaveLength(3);

      const capture = reads[0]!;
      const cpuPortWrites = entry.flatMap((instruction, index) =>
        [0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c].includes(instruction.opcode) &&
        [0, 1].includes(instruction.operand)
          ? [{ index, address: instruction.operand }]
          : [],
      );
      const latchWrite = cpuPortWrites.find((write) => write.address === 1);
      const directionWrite = cpuPortWrites.find((write) => write.address === 0);
      expect(latchWrite).toBeDefined();
      expect(directionWrite).toBeDefined();
      expect(latchWrite!.index).toBeLessThan(directionWrite!.index);
      expect(cpuPortWrites.every((write) => write.index < capture)).toBe(true);
      const saved = entry[capture + 1]!;
      expect(saved.opcode).toBe(0x8d);
      expect(saved.operand).toBeGreaterThanOrEqual(Number(startupState[0]!.start));
      expect(saved.operand).toBeLessThan(Number(startupState[0]!.end));
      const setup = writes[0]!;
      expect(entry[setup - 1]!.bytes).toEqual([0x29, 0xfc]);
      const adjacent = setup === capture + 3;
      if (!adjacent) {
        expect(entry[setup - 2]!.bytes).toEqual([0xad, saved.bytes[1], saved.bytes[2]]);
      }
      const returned = returnWrites[0]!;
      expect(restore[returned - 1]!.bytes).toEqual([0xad, saved.bytes[1], saved.bytes[2]]);
      // Absolute load/store cost four cycles, immediate AND costs two.
      const transaction = [
        entry[capture]!,
        saved,
        ...(adjacent ? [] : [entry[setup - 2]!]),
        entry[setup - 1]!,
        entry[setup]!,
        restore[returned - 1]!,
        restore[returned]!,
      ];
      expect(
        transaction.reduce((sum, instruction) => sum + instruction.bytes.length, 0),
      ).toBeLessThanOrEqual(17);
      expect(
        transaction.reduce((sum, instruction) => sum + (instruction.opcode === 0x29 ? 2 : 4), 0),
      ).toBeLessThanOrEqual(22);
      expect(
        transaction.some((instruction) =>
          [0x08, 0x28, 0x48, 0x68, 0x20, 0x60].includes(instruction.opcode),
        ),
      ).toBe(false);
    }, 30_000);
  }
});
