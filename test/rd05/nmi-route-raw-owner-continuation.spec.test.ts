import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** One actual linked instruction; source association comes from public debug ranges. */
interface Instruction {
  readonly address: number;
  readonly opcode: number;
  readonly operand: number;
  readonly bytes: readonly number[];
}

/** A complete materialized variant, resolved independently of internal symbol spellings. */
interface Entry {
  readonly address: number;
  readonly rangeIndexes: readonly number[];
  readonly code: readonly Instruction[];
}

/** Reject missing or ill-typed numeric evidence. */
function numeric(value: unknown): number {
  if (typeof value !== "number") throw new TypeError("Missing numeric evidence");
  return value;
}

/** Bind native symbols, function owners, and actual bytes using the published artifact contract. */
function publicEntries(
  debug: Record<string, unknown>,
  labels: string,
  prg: Buffer,
  name: string,
): Entry[] {
  const symbols = new Map(
    [...labels.matchAll(/^\s*(\S+)\s*=\s*\$([\da-f]+)\b/gim)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
  const functions = profileRecords(debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex, `Retained source function ${name}`).toBeGreaterThanOrEqual(0);
  const fn = functions[functionIndex];
  if (fn === undefined) throw new Error(`Missing function ${name}`);
  const ranges = profileRecords(debug.ranges);
  let restore: Record<string, unknown> | undefined;
  if (name === "main") {
    // Match the exact injective native identity, not a readable label hint or any outside JMP.
    const suffix = `_${Buffer.from("startup.restore", "utf8").toString("hex")}`;
    const matches = [...symbols].filter(([label]) => label.endsWith(suffix));
    expect(matches).toHaveLength(1);
    const start = numeric(matches[0]?.[1]);
    const selected = ranges.filter((range) => profileRecord(range.machine).start === start);
    expect(selected).toHaveLength(1);
    expect(profileRecord(selected[0]!.owner)).toMatchObject({ kind: "platform", name: "startup" });
    expect(profileRecord(selected[0]!.origin)).toMatchObject({
      kind: "generated",
      cause: "startup",
    });
    restore = profileRecord(selected[0]!.machine);
    const cpu = profileRecords(debug.addressSpaces).findIndex(
      (space) => space.id === "cpu16" && space.kind === "cpu",
    );
    expect(cpu).toBeGreaterThanOrEqual(0);
    expect(restore.addressSpaceIndex).toBe(cpu);
    expect(numeric(restore.end)).toBeGreaterThan(start);
  }
  /** Decode owned bytes completely; only main's caller can supply the proved platform exit. */
  function decode(
    start: number,
    owned: readonly Record<string, unknown>[],
    exit?: Record<string, unknown>,
  ): Instruction[] {
    const code: Instruction[] = [];
    const visited = new Set<number>();
    let pc = start;
    while (!visited.has(pc)) {
      visited.add(pc);
      const range = owned.find((range) => numeric(range.start) <= pc && pc < numeric(range.end));
      expect(range).toBeDefined();
      const offset = pc - prg.readUInt16LE(0) + 2;
      expect(offset).toBeGreaterThanOrEqual(2);
      expect(offset).toBeLessThan(prg.length);
      const opcode = prg[offset]!;
      const size = [0x20, 0x4c, 0x6c, 0x8c, 0x8d, 0x8e, 0xac, 0xad, 0xae].includes(opcode)
        ? 3
        : [0x09, 0x29, 0x84, 0x85, 0x86, 0xa0, 0xa2, 0xa4, 0xa5, 0xa6, 0xa9].includes(opcode)
          ? 2
          : [
                0x08, 0x28, 0x40, 0x48, 0x60, 0x68, 0x78, 0x8a, 0x98, 0x9a, 0xaa, 0xa8, 0xd8, 0xea,
              ].includes(opcode)
            ? 1
            : 0;
      expect(size, `Documented witness instruction at $${pc.toString(16)}`).toBeGreaterThan(0);
      if (size === 0) throw new Error("Unexpected instruction in ownership witness");
      expect(pc + size).toBeLessThanOrEqual(numeric(range!.end));
      const bytes = [...prg.subarray(offset, offset + size)];
      expect(bytes).toHaveLength(size);
      const operand = size === 3 ? bytes[1]! | (bytes[2]! << 8) : (bytes[1] ?? 0);
      code.push({ address: pc, opcode, operand, bytes });
      if ([0x40, 0x60, 0x6c].includes(opcode)) {
        expect(exit, "Main must exit through its proved platform restore").toBeUndefined();
        return code;
      }
      if (opcode === 0x4c && exit !== undefined && operand === numeric(exit.start)) {
        expect(pc + size).toBe(Math.max(...owned.map((range) => numeric(range.end))));
        expect(
          owned.some((range) => numeric(range.start) <= operand && operand < numeric(range.end)),
        ).toBe(false);
        const platform = decode(operand, [exit]);
        // No early return, skipped bytes or borrowed source ownership may stand in for restoration.
        expect(platform.flatMap((instruction) => instruction.bytes)).toHaveLength(
          numeric(exit.end) - operand,
        );
        expect(platform.slice(-2).map((instruction) => instruction.opcode)).toEqual([0x28, 0x60]);
        expect(platform.at(-1)!.address + 1).toBe(exit.end);
        return code;
      }
      // A source placement adapter may jump to its complete owned entry.
      pc = opcode === 0x4c ? operand : pc + size;
    }
    throw new Error("Materialized entry has no complete terminal");
  }
  return profileRecords(fn.entryVariants).map((variant) => {
    if (typeof variant.label !== "string" || !Array.isArray(variant.rangeIndexes))
      throw new TypeError("Missing public variant association");
    const address = numeric(symbols.get(variant.label));
    const rangeIndexes = variant.rangeIndexes.map(numeric);
    const machines = rangeIndexes.map((index) => {
      const range = ranges[index];
      if (range === undefined) throw new Error("Missing variant range");
      expect(profileRecord(range.owner)).toMatchObject({ kind: "function", functionIndex });
      return profileRecord(range.machine);
    });
    return { address, rangeIndexes, code: decode(address, machines, restore) };
  });
}

/** Locate source calls using source spans, including separately selected variants of one function. */
function callsAt(
  debug: Record<string, unknown>,
  source: string,
  entry: Entry,
  proof: string,
  occurrence: number,
): Instruction[] {
  const span = profileSpan(source, proof, occurrence);
  const sourceIndex = profileRecords(debug.sources).findIndex(
    (item) => item.path === span.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const ranges = profileRecords(debug.ranges);
  return entry.code.filter(
    (instruction) =>
      instruction.opcode === 0x20 &&
      entry.rangeIndexes.some((index) => {
        const range = ranges[index]!;
        const origin = profileRecord(range.origin);
        if (origin.kind !== "source") return false;
        const sourceSpan = profileRecord(origin.span);
        const machine = profileRecord(range.machine);
        return (
          sourceSpan.sourceIndex === sourceIndex &&
          numeric(sourceSpan.startByte) < span.end &&
          span.start < numeric(sourceSpan.endByte) &&
          numeric(machine.start) <= instruction.address &&
          instruction.address < numeric(machine.end)
        );
      }),
  );
}

/** Assert actual read/store operands without attributing any execution to the raw boundary. */
function transfer(code: readonly Instruction[], from: number, to: number) {
  const pairs = code.filter((instruction, index) => {
    const next = code[index + 1];
    const write =
      instruction.opcode === 0xad || instruction.opcode === 0xa5
        ? [0x8d, 0x85]
        : instruction.opcode === 0xae || instruction.opcode === 0xa6
          ? [0x8e, 0x86]
          : instruction.opcode === 0xac || instruction.opcode === 0xa4
            ? [0x8c, 0x84]
            : [];
    return (
      instruction.operand === from &&
      next !== undefined &&
      write.includes(next.opcode) &&
      next.operand === to
    );
  });
  expect(
    pairs,
    `Exactly one linked transfer $${from.toString(16)} to $${to.toString(16)}`,
  ).toHaveLength(1);
  return code.indexOf(pairs[0]!);
}

/** Identify a saved predecessor from the selected empty handler's complete terminal. */
function savedWord(entry: Entry): number {
  const body = entry.code.filter((instruction) => instruction.opcode !== 0x4c);
  expect(body.map((instruction) => instruction.opcode)).toEqual([0x6c]);
  const saved = body[0]!.operand;
  expect(saved & 0xff).toBeLessThanOrEqual(0xfe);
  return saved;
}

/** Find the high-byte publication of this exact complete selected entry. */
function publication(install: Entry, c: Entry): number {
  return install.code.findIndex((instruction, index) => {
    const next = install.code[index + 1];
    return (
      instruction.opcode === 0xa9 &&
      instruction.operand === c.address >> 8 &&
      next?.opcode === 0x8d &&
      next.operand === 0x0319
    );
  });
}

/** Check an interprocedural install/restore pair against one distinct persistent predecessor word. */
function ownershipPair(install: Entry, restore: Entry, c: Entry, outerWord: number) {
  const saved = savedWord(c);
  expect(
    [saved, saved + 1].some((address) => address === outerWord || address === outerWord + 1),
  ).toBe(false);
  const lowCapture = transfer(install.code, 0x0318, saved);
  const highCapture = transfer(install.code, 0x0319, saved + 1);
  const publish = publication(install, c);
  expect(c.address & 0xff).toBe(0x47);
  expect(publish).toBeGreaterThan(lowCapture);
  expect(publish).toBeGreaterThan(highCapture);
  transfer(restore.code, saved + 1, 0x0319);
  expect(restore.code.at(-1)?.opcode).toBe(0x60);
  const writesWord = (instruction: Instruction) =>
    [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(instruction.opcode) &&
    [saved, saved + 1].includes(instruction.operand);
  expect(install.code.filter(writesWord)).toHaveLength(2);
  expect(restore.code.filter(writesWord)).toHaveLength(0);
  for (const address of [0x0318, 0x0319])
    expect(
      install.code.filter(
        (instruction) =>
          [0xac, 0xad, 0xae].includes(instruction.opcode) && instruction.operand === address,
      ),
    ).toHaveLength(1);
  for (const entry of [install, restore]) {
    expect(
      entry.code.filter(
        (instruction) =>
          [0x8c, 0x8d, 0x8e].includes(instruction.opcode) && instruction.operand === 0x0319,
      ),
    ).toHaveLength(1);
    expect(
      entry.code.some(
        (instruction) =>
          [0x8c, 0x8d, 0x8e].includes(instruction.opcode) && instruction.operand === 0x0318,
      ),
    ).toBe(false);
  }
}

describe("raw handler interprocedural ownership continuation", () => {
  for (const target of PROFILES) {
    for (const actualHelperCalls of [false, true]) {
      it(`should retain ${actualHelperCalls ? "separate actual and raw helper" : "raw install and ordinary restore"} ownership continuation on ${target}`, async () => {
        // An ordinary helper may return a net ownership effect for a later helper to restore.
        const source = `module Game;
import {setNMI,restoreNMI,setIRQ,restoreIRQ} from c64.system;
interrupt function B():void {}
interrupt function C():void {}
${actualHelperCalls ? "function H():void {setNMI(&C);}" : ""}
function J():void {restoreNMI();}
interrupt function Q():void {${actualHelperCalls ? "H();" : "setNMI(&C);"}J();}
function main():void {
  setNMI(&B);${actualHelperCalls ? "H();J();" : ""}
  asm_php();asm_sei();asm_nop();setIRQ(&Q);
  pokew($c000,word(&Q));restoreIRQ();asm_plp();restoreNMI();
}`;
        await withProfileProject(source, target, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected complete public output");
          const artifacts = await readProfileArtifacts(built);
          const entries = (name: string) =>
            publicEntries(artifacts.debug, artifacts.labels, artifacts.prg, name);
          const main = entries("main");
          expect(main).toHaveLength(1);
          const b = entries("B");
          expect(b).toHaveLength(1);
          const outerWord = savedWord(b[0]!);
          transfer(main[0]!.code, 0x0318, outerWord);
          transfer(main[0]!.code, 0x0319, outerWord + 1);
          transfer(main[0]!.code, outerWord + 1, 0x0319);
          const raw = entries("Q").filter((entry) => entry.code.at(-1)?.opcode === 0x40);
          expect(raw).toHaveLength(1);
          const q = raw[0]!;
          const resolveCall = (caller: Entry, proof: string, occurrence: number, name: string) => {
            const calls = callsAt(artifacts.debug, source, caller, proof, occurrence);
            expect(calls).toHaveLength(1);
            const destinations = entries(name).filter(
              (entry) => entry.address === calls[0]!.operand,
            );
            expect(destinations).toHaveLength(1);
            return destinations[0]!;
          };
          const rawRestore = resolveCall(q, "J();", 0, "J");
          const rawInstall = actualHelperCalls ? resolveCall(q, "H();", 0, "H") : q;
          const cEntries = entries("C");
          const rawC = cEntries.filter(
            (entry) =>
              publication(rawInstall, entry) >= 0 &&
              rawRestore.code.some((instruction) => instruction.operand === savedWord(entry) + 1),
          );
          expect(rawC).toHaveLength(1);
          ownershipPair(rawInstall, rawRestore, rawC[0]!, outerWord);
          if (actualHelperCalls) {
            const actualInstall = resolveCall(main[0]!, "H();", 1, "H");
            const actualRestore = resolveCall(main[0]!, "J();", 1, "J");
            const actualC = cEntries.filter(
              (entry) =>
                publication(actualInstall, entry) >= 0 &&
                actualRestore.code.some(
                  (instruction) => instruction.operand === savedWord(entry) + 1,
                ),
            );
            expect(actualC).toHaveLength(1);
            ownershipPair(actualInstall, actualRestore, actualC[0]!, outerWord);
            expect(
              main[0]!.code.findIndex(
                (instruction) =>
                  instruction.opcode === 0x20 && instruction.operand === actualInstall.address,
              ),
            ).toBeLessThan(
              main[0]!.code.findIndex(
                (instruction) =>
                  instruction.opcode === 0x20 && instruction.operand === actualRestore.address,
              ),
            );
          }
          // Raw retention is a source dependency obligation, with no external-caller or arrival proof.
          const rawCalls = q.code.filter((instruction) => instruction.opcode === 0x20);
          expect(rawCalls.map((instruction) => instruction.operand)).toEqual(
            actualHelperCalls ? [rawInstall.address, rawRestore.address] : [rawRestore.address],
          );
          const normalization = q.code.findIndex((instruction) => instruction.opcode === 0xd8);
          expect(normalization).toBeGreaterThanOrEqual(0);
          expect(normalization).toBeLessThan(
            actualHelperCalls
              ? q.code.indexOf(rawCalls[0]!)
              : transfer(q.code, 0x0318, savedWord(rawC[0]!)),
          );
          if (!actualHelperCalls)
            expect(publication(q, rawC[0]!)).toBeLessThan(q.code.indexOf(rawCalls[0]!));
          // A direct installer may own a balanced transaction save; calls-only Q needs no wrapper P save.
          if (actualHelperCalls)
            expect(q.code.some((instruction) => [0x08, 0x28].includes(instruction.opcode))).toBe(
              false,
            );
        });
      });
    }
  }
});
