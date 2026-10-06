import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { address: number; opcode: number; operand: number };

// Decode instruction boundaries only; this does not execute the program.
function instructions(a: Artifacts, indexes: number[]): Instruction[] {
  const two = new Set(
    "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6"
      .split(" ")
      .map((n) => parseInt(n, 16)),
  );
  const three = new Set(
    "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe"
      .split(" ")
      .map((n) => parseInt(n, 16)),
  );
  const ranges = profileRecords(a.debug.ranges);
  const result = new Map<number, Instruction>();
  const load = a.prg.readUInt16LE(0);
  for (const index of indexes) {
    const machine = profileRecord(ranges[index]!.machine);
    for (let address = Number(machine.start); address < Number(machine.end); ) {
      const offset = address - load + 2;
      const opcode = a.prg[offset]!;
      const width = three.has(opcode) ? 3 : two.has(opcode) ? 2 : 1;
      expect(address + width).toBeLessThanOrEqual(Number(machine.end));
      result.set(address, {
        address,
        opcode,
        operand:
          width === 3 ? a.prg.readUInt16LE(offset + 1) : width === 2 ? a.prg[offset + 1]! : 0,
      });
      address += width;
    }
  }
  return [...result.values()].sort((x, y) => x.address - y.address);
}

function sourceCode(a: Artifacts, source: string, expression: string) {
  const span = profileSpan(source, expression);
  const indexes = profileRecords(a.debug.ranges).flatMap((range, index) => {
    const origin = profileRecord(range.origin);
    const value = origin.kind === "source" ? origin.span : undefined;
    if (value === undefined) return [];
    const s = profileRecord(value);
    return Number(s.startByte) < span.end && Number(s.endByte) > span.start ? [index] : [];
  });
  return instructions(a, indexes);
}

function entry(a: Artifacts, name: string, address: number) {
  const f = profileRecords(a.debug.functions).find(
    (f) => f.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(f).toBeDefined();
  const variant = profileRecords(f!.entryVariants).find((v) => {
    const label = String(v.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = a.labels.match(new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)`, "im"));
    return match !== null && parseInt(match[1]!, 16) === address;
  });
  expect(variant).toBeDefined();
  return instructions(a, variant!.rangeIndexes as number[]);
}

/** Identify the source declaration, not an implementation-specific debug name. */
function memoryHomes(a: Artifacts, source: string, owner: string, name: string, kind: string) {
  const start = source.indexOf(`${name}: byte`, source.indexOf(`function ${owner}(`));
  expect(start).toBeGreaterThanOrEqual(0);
  const declaredByte = Buffer.byteLength(source.slice(0, start));
  const sourceIndex = profileRecords(a.debug.sources).findIndex((s) => s.path === "src/game.blend");
  const symbols = profileRecords(a.debug.symbols);
  const locations = profileRecords(a.debug.locations);
  return symbols.flatMap((s, index) => {
    if (s.scope !== `src/game.blend::Game.${owner}` || s.kind !== kind) return [];
    const origin = profileRecord(s.origin);
    if (origin.kind !== "source") return [];
    const span = profileRecord(origin.span);
    if (
      span.sourceIndex !== sourceIndex ||
      Number(span.startByte) > declaredByte ||
      Number(span.endByte) < declaredByte + Buffer.byteLength(name)
    )
      return [];
    return locations
      .filter((l) => l.symbolIndex === index)
      .flatMap((l) => {
        const availability = profileRecord(l.availability);
        if (availability.kind !== "available" && availability.kind !== "split") return [];
        return profileRecords(availability.pieces).flatMap((p) =>
          p.kind === "memory" ? [Number(profileRecord(p.machine).start)] : [],
        );
      });
  });
}

/** Unknown calls/indexed writes cannot establish that one ABI pointer byte survives. */
function mayClobberHome(i: Instruction, home: number) {
  const indirect = [
    0x20, 0x81, 0x91, 0x94, 0x95, 0x96, 0x99, 0x9d, 0x16, 0x1e, 0x36, 0x3e, 0x56, 0x5e, 0x76, 0x7e,
    0xd6, 0xde, 0xf6, 0xfe,
  ];
  const direct = [
    0x85, 0x86, 0x84, 0x8d, 0x8e, 0x8c, 0x06, 0x0e, 0x26, 0x2e, 0x46, 0x4e, 0x66, 0x6e, 0xc6, 0xce,
    0xe6, 0xee,
  ];
  return indirect.includes(i.opcode) || (direct.includes(i.opcode) && i.operand === home);
}

function constantSetup(call: Instruction[], store: Instruction, value: number) {
  const storeIndex = call.indexOf(store);
  const load = call[storeIndex - 1]!;
  if (load.opcode === 0xa9) {
    expect(load.operand).toBe(value);
    return;
  }
  expect([0xa5, 0xad]).toContain(load.opcode);
  const staging = call
    .slice(0, storeIndex - 1)
    .findLast((i) => (i.opcode === 0x85 || i.opcode === 0x8d) && i.operand === load.operand);
  expect(staging).toBeDefined();
  expect(call[call.indexOf(staging!) - 1]).toMatchObject({ opcode: 0xa9, operand: value });
}

function marshalsByte(a: Artifacts, source: string, expression: string, value: number) {
  const call = sourceCode(a, source, expression);
  const jsrs = call.filter((i) => i.opcode === 0x20);
  expect(jsrs).toHaveLength(1);
  const callee = entry(a, "H", jsrs[0]!.operand);
  const homes = memoryHomes(a, source, "H", "x", "parameter");
  const reads = callee.filter(
    (i) => (i.opcode === 0xa5 || i.opcode === 0xad) && homes.includes(i.operand),
  );
  expect(reads).toHaveLength(1);
  const incoming = reads[0]!.operand;
  expect(
    call.some((i) => i.opcode === 0xa9 && i.operand === value && i.address < jsrs[0]!.address),
  ).toBe(true);
  const stores = call.filter(
    (i) =>
      (i.opcode === 0x85 || i.opcode === 0x8d) &&
      i.operand === incoming &&
      i.address < jsrs[0]!.address,
  );
  expect(stores).toHaveLength(1);
  constantSetup(call, stores[0]!, value);
  expect(callee.some((i) => i.opcode === 0x60)).toBe(true);
  return { call, callee, jsr: jsrs[0]! };
}

const preamble = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
`;
const retain = `asm_php(); asm_sei(); asm_nop();
  setIRQ(&Q); pokew($c010, word(&Q)); restoreIRQ(); asm_plp();`;

describe("retained ordinary call ABI", () => {
  it.each(profiles)(
    "marshals each byte into the selected helper's own incoming home on %s",
    async (profile) => {
      const source = `${preamble}
function H(x: byte): void { setNMI(&C); poke($c012, x); restoreNMI(); }
interrupt function Q(): void { H(9); }
function main(): void { setNMI(&B); H(7); ${retain} restoreNMI(); }
`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        marshalsByte(a, source, "H(7)", 7);
        marshalsByte(a, source, "H(9)", 9);
      });
    },
  );

  it.each(profiles)(
    "passes the caller-owned fixed-array destination through the selected helper ABI on %s",
    async (profile) => {
      const source = `${preamble}
function H(x: byte): byte[1] { setNMI(&C); restoreNMI(); return [x]; }
interrupt function Q(): void { let resultRaw: byte[1] = H(9); poke($c012, resultRaw[0]); }
function main(): void { setNMI(&B); let resultMain: byte[1] = H(7); poke($c012, resultMain[0]); ${retain} restoreNMI(); }
`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        for (const [expression, value, result] of [
          ["H(7)", 7, "resultMain"],
          ["H(9)", 9, "resultRaw"],
        ] as const) {
          const { call, callee, jsr } = marshalsByte(a, source, expression, value);
          const destinations = memoryHomes(a, source, value === 7 ? "main" : "Q", result, "local");
          expect(destinations).toHaveLength(1);
          const destination = destinations[0]!;
          const consumption = sourceCode(a, source, `poke($c012, ${result}[0])`);
          expect(
            consumption.some(
              (i) =>
                [0xa5, 0xad].includes(i.opcode) &&
                i.operand === destination &&
                i.address > jsr.address,
            ),
          ).toBe(true);
          const direct = callee.some(
            (i) => (i.opcode === 0x85 || i.opcode === 0x8d) && i.operand === destination,
          );
          if (direct) continue;
          const writes = callee.filter((i) => i.opcode === 0x91);
          expect(writes).toHaveLength(1);
          const pointer = writes[0]!.operand;
          const beforeWrite = callee.slice(0, callee.indexOf(writes[0]!));
          expect(
            beforeWrite.findLast((i) =>
              [0xa0, 0xa4, 0xac, 0xb4, 0xbc, 0xa8, 0xc8, 0x88].includes(i.opcode),
            ),
          ).toMatchObject({ opcode: 0xa0, operand: 0 });
          // The hidden destination may already be the closed pointer home itself.
          // A callee copy is required only when its indirect-store pair differs.
          const callerPopulated = [pointer, pointer + 1].every(
            (home) => !beforeWrite.some((i) => mayClobberHome(i, home)),
          );
          if (callerPopulated) {
            const locations = profileRecords(a.debug.locations);
            expect(
              profileRecords(a.debug.symbols).some(
                (symbol) =>
                  symbol.scope === "src/game.blend::Game.H" &&
                  symbol.byteWidth === 2 &&
                  (symbol.locationIndexes as number[]).some((index) =>
                    profileRecords(profileRecord(locations[index]!.availability).pieces).some(
                      (piece) =>
                        piece.kind === "memory" &&
                        profileRecord(piece.machine).start === pointer &&
                        profileRecord(piece.machine).end === pointer + 2,
                    ),
                  ),
              ),
            ).toBe(true);
          }
          const pointerLoads = [pointer, pointer + 1].map((home) => {
            if (callerPopulated) return home;
            const store = callee.findIndex((i) => i.opcode === 0x85 && i.operand === home);
            expect(store).toBeGreaterThan(0);
            expect(beforeWrite.slice(store + 1).some((i) => mayClobberHome(i, home))).toBe(false);
            const load = callee[store - 1]!;
            expect([0xa5, 0xad]).toContain(load.opcode);
            return load.operand;
          });
          for (const [index, incoming] of pointerLoads.entries()) {
            const stores = call.filter(
              (i) =>
                (i.opcode === 0x85 || i.opcode === 0x8d) &&
                i.operand === incoming &&
                i.address < jsr.address,
            );
            expect(stores).toHaveLength(1);
            constantSetup(call, stores[0]!, index === 0 ? destination & 255 : destination >> 8);
            const later = call.filter(
              (i) => i.address > stores[0]!.address && i.address < jsr.address,
            );
            expect(later.some((i) => mayClobberHome(i, incoming))).toBe(false);
          }
        }
      });
    },
  );
});
