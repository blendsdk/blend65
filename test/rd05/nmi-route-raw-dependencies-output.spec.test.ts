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

/** Read actual assembled instruction bytes through the public debug boundaries. */
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

/** Preserve exact source-operation attribution, including operations in retained raw dependencies. */
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

/** Decode literal stores without prescribing which register carries the constant. */
function stores(code: Instruction[], destinations: number[]) {
  const loads = new Map([
    [0x8d, 0xa9],
    [0x8e, 0xa2],
    [0x8c, 0xa0],
  ]);
  return code.flatMap((instruction, index) => {
    if (!loads.has(instruction.bytes[0]!)) return [];
    const destination = instruction.bytes[1]! | (instruction.bytes[2]! << 8);
    if (!destinations.includes(destination)) return [];
    expect(instruction.bytes).toHaveLength(3);
    const previous = code[index - 1]!;
    expect(previous.bytes).toHaveLength(2);
    expect(previous.bytes[0]).toBe(loads.get(instruction.bytes[0]!));
    return [{ destination, value: previous.bytes[1]!, instruction }];
  });
}

/** A numeric address is checked against the real source function's published variant and code ranges. */
function entryAt(artifacts: Artifacts, name: string, address: number) {
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const entries = profileRecords(functions[functionIndex]!.entryVariants).filter((entry) => {
    expect(typeof entry.label).toBe("string");
    const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = artifacts.labels.match(
      new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"),
    );
    expect(match).not.toBeNull();
    return Number.parseInt(match![1]!, 16) === address;
  });
  expect(entries).toHaveLength(1);
  const indexes = entries[0]!.rangeIndexes;
  if (!Array.isArray(indexes)) throw new TypeError("Missing real function entry ranges");
  const ranges = profileRecords(artifacts.debug.ranges);
  for (const index of indexes) {
    expect(Number.isInteger(index)).toBe(true);
    expect(ranges[Number(index)]!.owner).toMatchObject({ kind: "function", functionIndex });
  }
  const code = instructions(artifacts)
    .filter(({ index }) => indexes.includes(index))
    .sort((left, right) => left.address - right.address);
  expect(code.length).toBeGreaterThan(0);
  expect(code[0]!.address).toBe(address);
  return code;
}

/** Two actual little-endian writes expose one source address, not a selected-variant alias. */
function pointer(code: Instruction[], destination: number) {
  const written = stores(code, [destination, destination + 1]);
  expect(written.map(({ destination }) => destination)).toEqual([destination, destination + 1]);
  return written[0]!.value | (written[1]!.value << 8);
}

describe.each(PROFILES)("raw handler address dependencies on %s", (profile) => {
  for (const helper of [false, true]) {
    it(`should retain a raw handler address exposed ${helper ? "through an ordinary helper" : "directly by another raw handler"}`, async () => {
      // Numeric exposure retains all visible source dependencies without certifying any external invocation.
      const source = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function R(): void { poke($0401, 9); }
${helper ? "function expose(): void { pokew($c010, word(&R)); }" : ""}
interrupt function Q(): void { ${helper ? "expose();" : "pokew($c010, word(&R));"} }
function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQ(&Q); pokew($c000, word(&Q)); restoreIRQ(); asm_plp(); restoreNMI(); }`;
      await withProfileProject(source, profile, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success")
          throw new Error("Expected complete raw-dependency publication");
        const artifacts = await readProfileArtifacts(built);
        expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
        const selectedAddress = pointer(operation(artifacts, source, "setIRQ(&Q)"), 0x0314);
        const selected = entryAt(artifacts, "Q", selectedAddress);
        expect(selected).toHaveLength(1);
        expect(selected[0]!.bytes).toHaveLength(3);
        expect(selected[0]!.bytes[0]).toBe(0x6c);
        const rawQAddress = pointer(operation(artifacts, source, "pokew($c000, word(&Q))"), 0xc000);
        expect(rawQAddress).not.toBe(selectedAddress);
        const rawQ = entryAt(artifacts, "Q", rawQAddress);
        const exposure = operation(artifacts, source, "pokew($c010, word(&R))");
        let exposureOwner = rawQ;
        if (helper) {
          const calls = operation(artifacts, source, "expose()", 1).filter(
            ({ bytes }) => bytes[0] === 0x20,
          );
          expect(calls).toHaveLength(1);
          expect(rawQ.map(({ index }) => index)).toContain(calls[0]!.index);
          expect(calls[0]!.bytes).toHaveLength(3);
          exposureOwner = entryAt(
            artifacts,
            "expose",
            calls[0]!.bytes[1]! | (calls[0]!.bytes[2]! << 8),
          );
        }
        expect(exposure.length).toBeGreaterThan(0);
        for (const instruction of exposure)
          expect(exposureOwner.map(({ index }) => index)).toContain(instruction.index);
        const rawRAddress = pointer(exposure, 0xc010);
        const rawR = entryAt(artifacts, "R", rawRAddress);
        const screen = stores(operation(artifacts, source, "poke($0401, 9)"), [0x0401]);
        expect(screen.map(({ destination, value }) => ({ destination, value }))).toEqual([
          { destination: 0x0401, value: 9 },
        ]);
        expect(rawR.map(({ index }) => index)).toContain(screen[0]!.instruction.index);
        expect(selected.map(({ index }) => index)).not.toContain(screen[0]!.instruction.index);
      });
    }, 60_000);
  }
});
