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

function code(a: Artifacts, indexes: number[]): Instruction[] {
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
  const indexes = profileRecords(a.debug.ranges).flatMap((r, index) => {
    const origin = profileRecord(r.origin);
    if (origin.kind !== "source") return [];
    const s = profileRecord(origin.span);
    return Number(s.startByte) < span.end && Number(s.endByte) > span.start ? [index] : [];
  });
  return code(a, indexes);
}

function variants(a: Artifacts, name: string) {
  const f = profileRecords(a.debug.functions).find(
    (f) => f.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(f).toBeDefined();
  return profileRecords(f!.entryVariants).map((v) => {
    const label = String(v.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = a.labels.match(new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)`, "im"));
    expect(match).not.toBeNull();
    return { address: parseInt(match![1]!, 16), code: code(a, v.rangeIndexes as number[]) };
  });
}

function capturedLink(instructions: Instruction[]) {
  const read = instructions.findIndex((i) => i.opcode === 0xad && i.operand === 0x318);
  expect(read).toBeGreaterThanOrEqual(0);
  const store = instructions[read + 1]!;
  expect([0x85, 0x8d]).toContain(store.opcode);
  expect(instructions[read + 2]).toMatchObject({ opcode: 0xad, operand: 0x319 });
  expect(instructions[read + 3]).toMatchObject({
    opcode: store.opcode,
    operand: store.operand + 1,
  });
  return store.operand;
}

const prefix = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
`;
const main = `function main(): void {
  setNMI(&B); asm_php(); asm_sei(); asm_nop();
  setIRQ(&Q); pokew($c010, word(&Q)); restoreIRQ(); asm_plp(); restoreNMI();
}`;

describe("retained finite indirect calls", () => {
  it.each(profiles)(
    "selects installer entries whose saved link agrees with the later restore and chained tail on %s",
    async (profile) => {
      const source = `${prefix}
function H(): void { setNMI(&C); }
function K(): void { setNMI(&C); }
function J(): void { restoreNMI(); }
interrupt function Q(): void {
  let install: fn(): void = peek($c012) != 0 ? &H : &K;
  install(); J();
}
${main}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        const restoreCall = sourceCode(a, source, "J();").filter((i) => i.opcode === 0x20);
        expect(restoreCall).toHaveLength(1);
        const restore = variants(a, "J").find((v) => v.address === restoreCall[0]!.operand);
        expect(restore).toBeDefined();
        const publish = restore!.code.findIndex((i) => i.opcode === 0x8d && i.operand === 0x319);
        expect(publish).toBeGreaterThan(0);
        const reload = restore!.code[publish - 1]!;
        expect([0xa5, 0xad]).toContain(reload.opcode);
        const link = reload.operand - 1;
        expect(
          variants(a, "C").some((v) => v.code.some((i) => i.opcode === 0x6c && i.operand === link)),
        ).toBe(true);
        const dispatch = sourceCode(a, source, "install()");
        const destinations = dispatch
          .filter((i) => i.opcode === 0x20 || i.opcode === 0x4c)
          .map((i) => i.operand);
        for (const name of ["H", "K"]) {
          const entries = variants(a, name);
          const reached = entries.filter((v) => destinations.includes(v.address));
          if (reached.length !== 0) {
            for (const v of reached) expect(capturedLink(v.code)).toBe(link);
          } else {
            // A canonical indirect call is safe only if every retained source entry agrees.
            expect(destinations.length).toBeGreaterThan(0);
            for (const v of entries) expect(capturedLink(v.code)).toBe(link);
          }
        }
      });
    },
  );

  it.each(profiles)(
    "keeps a compatible canonical finite indirect call legal on %s",
    async (profile) => {
      const source = `${prefix}
function H(): void { poke($c014, 7); }
function K(): void { poke($c014, 9); }
interrupt function Q(): void {
  let install: fn(): void = peek($c012) != 0 ? &H : &K;
  install();
}
${main}`;
      await withProfileProject(source, profile, async (project) => {
        expect((await checkProject({ project })).kind).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind).toBe("success");
        if (built.kind !== "success") return;
        const a = await readProfileArtifacts(built);
        expect(sourceCode(a, source, "install()").some((i) => i.opcode === 0x20)).toBe(true);
        for (const name of ["H", "K"]) {
          expect(
            variants(a, name).some((v) =>
              v.code.some((i) => i.opcode === 0x8d && i.operand === 0xc014),
            ),
          ).toBe(true);
        }
      });
    },
  );
});
