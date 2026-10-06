import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
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
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;
type Instruction = { index: number; address: number; bytes: number[] };

/** Decode actual bytes at public instruction boundaries, excluding the PRG load word. */
function instructions(artifacts: Artifacts): Instruction[] {
  const load = artifacts.prg.readUInt16LE(0);
  return profileRecords(artifacts.debug.ranges).map((range, index) => {
    const machine = profileRecord(range.machine);
    const start = Number(machine.start);
    const end = Number(machine.end);
    expect(start).toBeGreaterThanOrEqual(load);
    expect(end).toBeGreaterThan(start);
    expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
    return {
      index,
      address: start,
      bytes: [...artifacts.prg.subarray(start - load + 2, end - load + 2)],
    };
  });
}

/** Exact source spans distinguish normal and retained raw calls without inventing invocation contexts. */
function operation(artifacts: Artifacts, source: string, proof: string, occurrence = 0) {
  const span = profileSpan(source, proof, occurrence);
  const sources = profileRecords(artifacts.debug.sources);
  const ranges = profileRecords(artifacts.debug.ranges);
  return instructions(artifacts)
    .filter(({ index }) => {
      const origin = profileRecord(ranges[index]!.origin);
      if (origin.kind !== "source") return false;
      const actual = profileRecord(origin.span);
      return (
        sources[Number(actual.sourceIndex)]?.path === span.sourceId &&
        actual.startByte === span.start &&
        actual.endByte === span.end
      );
    })
    .sort((left, right) => left.address - right.address);
}

/** An absolute or zero-page operand is little-endian in the assembled instruction. */
function operand(instruction: Instruction) {
  expect([2, 3]).toContain(instruction.bytes.length);
  return instruction.bytes[1]! | ((instruction.bytes[2] ?? 0) << 8);
}

/** Resolve actual call/address operands to a source-owned published variant, allowing distinct legal variants. */
function entryAt(artifacts: Artifacts, name: string, address: number) {
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const entries = profileRecords(functions[functionIndex]!.entryVariants).filter((entry) => {
    const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = artifacts.labels.match(
      new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"),
    );
    expect(match).not.toBeNull();
    return Number.parseInt(match![1]!, 16) === address;
  });
  expect(entries).toHaveLength(1);
  const indexes = entries[0]!.rangeIndexes;
  if (!Array.isArray(indexes)) throw new TypeError("Missing source-owned entry ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  for (const index of indexes)
    expect(ranges[Number(index)]!.owner).toMatchObject({ kind: "function", functionIndex });
  const code = instructions(artifacts).filter(({ index }) => indexes.includes(index));
  expect(code.some((instruction) => instruction.address === address)).toBe(true);
  return code;
}

/** Two coherent source-owned capture reads identify the exact predecessor word used by an installation. */
function capturedHome(code: Instruction[]) {
  const stores = new Map([
    [0xad, [0x85, 0x8d]],
    [0xae, [0x86, 0x8e]],
    [0xac, [0x84, 0x8c]],
  ]);
  const captured = [0x0318, 0x0319].map((vector) => {
    const reads = code.filter(
      (instruction) => stores.has(instruction.bytes[0]!) && operand(instruction) === vector,
    );
    expect(reads).toHaveLength(1);
    const next = code[code.indexOf(reads[0]!) + 1]!;
    expect(stores.get(reads[0]!.bytes[0]!)).toContain(next.bytes[0]);
    return operand(next);
  });
  expect(captured[1]).toBe(captured[0]! + 1);
  expect(captured[0]! & 0xff).toBeLessThanOrEqual(0xfe);
  return captured[0]!;
}

describe.each(PROFILES)("retained raw helper and observed mainline context on %s", (profile) => {
  it("should retain the raw helper dependency and the normal call's distinct NMI predecessor word", async () => {
    // Retaining raw code cannot replace the helper context reached by the normal mainline call.
    const source = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {} interrupt function C(): void {}
function H(): void { setNMI(&C); poke($0400, 7); restoreNMI(); }
interrupt function Q(): void { H(); }
function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); pokew($c000, word(&Q)); restoreIRQ(); asm_plp(); H(); restoreNMI(); }`;
    await withProfileProject(source, profile, async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected complete helper publication");
      const artifacts = await readProfileArtifacts(built);
      expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
      const calls = operation(artifacts, source, "H()", 2).filter(({ bytes }) => bytes[0] === 0x20);
      expect(calls).toHaveLength(1);
      const mainH = entryAt(artifacts, "H", operand(calls[0]!));
      const inMainH = (code: Instruction[]) =>
        code.filter((instruction) => mainH.some(({ index }) => index === instruction.index));
      const inner = capturedHome(inMainH(operation(artifacts, source, "setNMI(&C)")));
      const outer = capturedHome(operation(artifacts, source, "setNMI(&B)"));
      for (const address of [inner, inner + 1]) expect([outer, outer + 1]).not.toContain(address);
      const restore = inMainH(operation(artifacts, source, "restoreNMI()"));
      const writes = restore.filter(
        (instruction) => instruction.bytes[0] === 0x8d && operand(instruction) === 0x0319,
      );
      expect(writes).toHaveLength(1);
      const load = restore[restore.indexOf(writes[0]!) - 1]!;
      expect([0xa5, 0xad]).toContain(load.bytes[0]);
      expect(operand(load)).toBe(inner + 1);
      const screen = inMainH(operation(artifacts, source, "poke($0400, 7)"));
      const screenStores = screen.filter(
        (instruction) => instruction.bytes[0] === 0x8d && operand(instruction) === 0x0400,
      );
      expect(screenStores).toHaveLength(1);
      expect(screen[screen.indexOf(screenStores[0]!) - 1]!.bytes).toEqual([0xa9, 7]);
      const exposure = operation(artifacts, source, "pokew($c000, word(&Q))");
      const pointer = [0xc000, 0xc001].map((destination) => {
        const writes = exposure.filter(
          (instruction) => instruction.bytes[0] === 0x8d && operand(instruction) === destination,
        );
        expect(writes).toHaveLength(1);
        const load = exposure[exposure.indexOf(writes[0]!) - 1]!;
        expect(load.bytes[0]).toBe(0xa9);
        expect(load.bytes).toHaveLength(2);
        return load.bytes[1]!;
      });
      const rawQ = entryAt(artifacts, "Q", pointer[0]! | (pointer[1]! << 8));
      const rawCalls = operation(artifacts, source, "H()", 1).filter(
        (instruction) =>
          instruction.bytes[0] === 0x20 && rawQ.some(({ index }) => index === instruction.index),
      );
      expect(rawCalls).toHaveLength(1);
      expect(entryAt(artifacts, "H", operand(rawCalls[0]!)).length).toBeGreaterThan(0);
    });
  }, 60_000);
});
