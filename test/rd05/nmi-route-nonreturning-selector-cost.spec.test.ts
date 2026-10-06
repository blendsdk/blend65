import { buildProject, checkProject } from "@blend65/compiler";
import { beforeAll, describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const SOURCE = `module Game;
import { setNMI, restoreNMI, setIRQ, restoreIRQ } from c64.system;
interrupt function B(): void {}
interrupt function C(): void {}
function terminal(): void { while (true) {} }
function anotherTerminal(): void { while (true) {} }
function H(): void {
  let target: fn(): void = peek($c012) != 0 ? &terminal : &anotherTerminal;
  target();
  setNMI(&C); restoreNMI(); poke($c014, 11);
}
interrupt function Q(): void { H(); }
export function main(): void {
  setNMI(&B);
  asm_php(); asm_sei(); asm_nop();
  setIRQ(&Q);
  pokew($c010, word(&Q));
  restoreIRQ(); asm_plp(); restoreNMI();
}
`;

type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Require actual integer addresses rather than treating missing evidence as zero. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new TypeError("Missing integer evidence");
  return value;
}

/** Preserve source identity, entry labels and physical code membership across variants. */
function functionCode(artifacts: Artifacts, name: string) {
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const variants = profileRecords(functions[functionIndex]!.entryVariants);
  expect(variants.length).toBeGreaterThan(0);
  const ranges = profileRecords(artifacts.debug.ranges);
  const contexts = profileRecords(artifacts.debug.contexts);
  const labels = new Map<string, number>();
  for (const match of artifacts.labels.matchAll(/\b([A-Za-z_][\w.]*)\s*=\s*\$([0-9a-f]+)/gi))
    labels.set(match[1]!.toLowerCase(), parseInt(match[2]!, 16));
  const addresses = new Set<number>();
  const entries = variants.map((variant, entryVariantIndex) => {
    expect(typeof variant.label).toBe("string");
    const entry = labels.get(String(variant.label).toLowerCase());
    expect(entry).toBeDefined();
    if (!Array.isArray(variant.rangeIndexes)) throw new TypeError("Missing entry range membership");
    for (const rangeIndex of variant.rangeIndexes) {
      const range = ranges[integer(rangeIndex)]!;
      const owner = profileRecord(range.owner);
      if (owner.kind !== "function" || owner.functionIndex !== functionIndex) continue;
      expect(contexts[integer(range.contextIndex)]).toMatchObject({
        kind: "entry",
        functionIndex,
        entryVariantIndex,
      });
      const machine = profileRecord(range.machine);
      for (let address = integer(machine.start); address < integer(machine.end); address += 1)
        addresses.add(address);
    }
    expect(addresses.has(entry!)).toBe(true);
    return entry!;
  });
  return { addresses, entries, variants };
}

/** Access actual loaded bytes by CPU address, including the PRG load header. */
function byteAt(artifacts: Artifacts, address: number): number {
  const offset = address - artifacts.prg.readUInt16LE(0) + 2;
  expect(offset).toBeGreaterThanOrEqual(2);
  expect(offset).toBeLessThan(artifacts.prg.length);
  return artifacts.prg[offset]!;
}

/** Reconstruct a little-endian CPU operand without relying on assembly text. */
function wordAt(artifacts: Artifacts, address: number): number {
  return byteAt(artifacts, address) | (byteAt(artifacts, address + 1) << 8);
}

describe.each(TARGETS)("Nonreturning selector expert costs on %s", (target) => {
  let artifacts: Artifacts;
  beforeAll(async () => {
    artifacts = await withProfileProject(SOURCE, target, async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected real ACME output");
      return readProfileArtifacts(built);
    });
  }, 30_000);

  // One volatile read and one conditional branch select an ordinary call without materializing a function word.
  it("should use eleven selector bytes and execute one read followed by the chosen ordinary call", () => {
    const helper = functionCode(artifacts, "H");
    expect(helper.addresses.size, "Complete physical helper code").toBe(11);
    const addresses = [...helper.addresses].sort((a, b) => a - b);
    const start = addresses[0]!;
    expect(addresses).toEqual(Array.from({ length: 11 }, (_, offset) => start + offset));
    expect(byteAt(artifacts, start)).toBe(0xad);
    expect(wordAt(artifacts, start + 1)).toBe(0xc012);
    const branch = byteAt(artifacts, start + 3);
    expect([0xf0, 0xd0]).toContain(branch);
    expect(byteAt(artifacts, start + 5)).toBe(0x20);
    expect(byteAt(artifacts, start + 8)).toBe(0x20);
    const terminal = functionCode(artifacts, "terminal");
    const another = functionCode(artifacts, "anotherTerminal");
    for (const observed of [0, 1, 255]) {
      // LDA sets Z from the independently seeded device value; BEQ/BNE consumes that flag.
      const taken = branch === 0xf0 ? observed === 0 : observed !== 0;
      const displacement = byteAt(artifacts, start + 4);
      const branchTarget = start + 5 + (displacement < 128 ? displacement : displacement - 256);
      const call = taken ? branchTarget : start + 5;
      expect([start + 5, start + 8]).toContain(call);
      expect(byteAt(artifacts, call)).toBe(0x20);
      expect((observed === 0 ? another : terminal).entries).toContain(wordAt(artifacts, call + 1));
      const pagePenalty = taken && (start + 5) >>> 8 !== call >>> 8 ? 1 : 0;
      expect(4 + (taken ? 3 : 2) + pagePenalty + 6).toBe(taken ? 13 + pagePenalty : 12);
    }
  });

  // Storage-free bodies are shared across contexts while distinct source function identities remain distinct.
  it("should emit one three-byte three-cycle self-loop for each distinct terminal source", () => {
    const terminals = ["terminal", "anotherTerminal"].map((name) => functionCode(artifacts, name));
    for (const terminal of terminals) {
      expect(terminal.addresses.size, "All variants of one terminal source share one body").toBe(3);
      const addresses = [...terminal.addresses].sort((a, b) => a - b);
      const start = addresses[0]!;
      expect(addresses).toEqual([start, start + 1, start + 2]);
      expect(new Set(terminal.entries)).toEqual(new Set([start]));
      expect(byteAt(artifacts, start)).toBe(0x4c);
      expect(wordAt(artifacts, start + 1)).toBe(start);
    }
    expect(terminals[0]!.entries[0]).not.toBe(terminals[1]!.entries[0]);
  });

  // A transient selection may stay in flags; no function-value word needs a private frame home.
  it("should allocate no private RAM or zero-page home for the selector", () => {
    for (const interval of profileRecords(artifacts.memory.intervals)) {
      if (!["sfa", "zeroPage", "scratch"].includes(String(interval.kind))) continue;
      const owner = profileRecord(interval.owner);
      if (!["function", "helper"].includes(String(owner.kind))) continue;
      if (typeof owner.id !== "string") throw new TypeError("Missing private-home owner");
      const names: unknown = owner.id.startsWith("overlay:")
        ? JSON.parse(owner.id.slice(8))
        : [owner.id];
      if (!Array.isArray(names) || names.some((name) => typeof name !== "string"))
        throw new TypeError("Invalid private-home owner identities");
      expect(names).not.toContain("src/game.blend::Game.H");
    }
  });

  // Resident state beyond the contiguous PRG payload occupies RAM but adds no loaded file bytes.
  it("should charge physical loaded code and fill independently of trailing resident state", () => {
    const load = artifacts.prg.readUInt16LE(0);
    const loadEnd = load + artifacts.prg.length - 2;
    const loaded = new Set<number>();
    for (const interval of profileRecords(artifacts.memory.intervals)) {
      const start = integer(interval.start);
      const end = integer(interval.end);
      const clippedStart = Math.max(load, start);
      const clippedEnd = Math.min(loadEnd, end);
      if (start >= loadEnd) expect(Math.max(0, clippedEnd - clippedStart)).toBe(0);
      for (let address = clippedStart; address < clippedEnd; address += 1) {
        loaded.add(address);
        if (interval.kind === "padding") expect(byteAt(artifacts, address)).toBe(0);
      }
    }
    expect(loaded.size).toBe(artifacts.prg.length - 2);
    expect(profileRecord(artifacts.costs.totals).programBytes).toBe(loaded.size);
  });

  // A retained raw source address and a selected firmware sink have different entry obligations.
  it("should preserve distinct raw and firmware interrupt entry identities", () => {
    const handler = functionCode(artifacts, "Q");
    for (const variant of handler.variants) expect(variant.kind).toBe("interrupt");
    expect(new Set(handler.variants.map((variant) => variant.label)).size).toBe(
      handler.variants.length,
    );
    expect(new Set(handler.entries).size).toBe(handler.entries.length);
    expect(handler.entries.length).toBeGreaterThanOrEqual(2);
    const rawPrefix = [0x48, 0x8a, 0x48, 0x98, 0x48, 0xd8];
    const rawEntries = handler.entries.filter((entry) =>
      rawPrefix.every((opcode, offset) => byteAt(artifacts, entry + offset) === opcode),
    );
    expect(rawEntries).toHaveLength(1);
    const references = handler.entries.filter((entry) => byteAt(artifacts, entry) === 0x6c);
    expect(references).toHaveLength(1);
    expect(rawEntries[0]).not.toBe(references[0]);
    const savedVector = wordAt(artifacts, references[0]! + 1);
    expect(savedVector & 0xff).not.toBe(0xff);
    expect(
      profileRecords(artifacts.memory.intervals).some(
        (interval) =>
          integer(interval.start) <= savedVector && integer(interval.end) >= savedVector + 2,
      ),
    ).toBe(true);
  });
});
