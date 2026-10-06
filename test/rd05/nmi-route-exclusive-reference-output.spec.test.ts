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

/** Extract only actual assembled bytes covered by a public instruction range. */
function bytesAt(artifacts: Artifacts, range: Record<string, unknown>) {
  const load = artifacts.prg.readUInt16LE(0);
  const machine = profileRecord(range.machine);
  const start = Number(machine.start);
  const end = Number(machine.end);
  expect(start).toBeGreaterThanOrEqual(load);
  expect(end).toBeGreaterThan(start);
  expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
  return [...artifacts.prg.subarray(start - load + 2, end - load + 2)];
}

/** Resolve the selected source entry from the literal address actually published into CINV. */
function expectExclusiveShell(artifacts: Artifacts, source: string) {
  const span = profileSpan(source, "setIRQExclusive(&Q)");
  const sources = profileRecords(artifacts.debug.sources);
  const ranges = profileRecords(artifacts.debug.ranges);
  const install = ranges
    .filter((range) => {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") return false;
      const actual = profileRecord(origin.span);
      return (
        sources[Number(actual.sourceIndex)]?.path === span.sourceId &&
        actual.startByte === span.start &&
        actual.endByte === span.end
      );
    })
    .sort(
      (left, right) =>
        Number(profileRecord(left.machine).start) - Number(profileRecord(right.machine).start),
    )
    .map((range) => bytesAt(artifacts, range));
  const loads = new Map([
    [0x8d, 0xa9],
    [0x8e, 0xa2],
    [0x8c, 0xa0],
  ]);
  const publication = install.flatMap((bytes, index) => {
    if (!loads.has(bytes[0]!)) return [];
    const address = bytes[1]! | (bytes[2]! << 8);
    if (![0x0314, 0x0315].includes(address)) return [];
    expect(bytes).toHaveLength(3);
    const load = install[index - 1]!;
    expect(load).toHaveLength(2);
    expect(load[0]).toBe(loads.get(bytes[0]!));
    return [{ address, value: load[1]! }];
  });
  expect(publication.map(({ address }) => address)).toEqual([0x0314, 0x0315]);
  const address = publication[0]!.value | (publication[1]!.value << 8);
  expect(address).toBe(0x2000);
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex((fn) => fn.qualifiedName === "src/game.blend::Game.Q");
  expect(functionIndex).toBeGreaterThanOrEqual(0);
  const entries = profileRecords(functions[functionIndex]!.entryVariants);
  expect(entries).toHaveLength(1);
  const entry = entries[0]!;
  expect(typeof entry.label).toBe("string");
  const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  expect(artifacts.labels).toMatch(new RegExp(`^\\s*${label}\\s*=\\s*\\$2000\\b`, "im"));
  const indexes = entry.rangeIndexes;
  if (!Array.isArray(indexes)) throw new TypeError("Missing selected entry instruction ranges");
  expect(indexes).toHaveLength(1);
  expect(Number.isInteger(indexes[0])).toBe(true);
  const range = ranges[Number(indexes[0])]!;
  expect(range.owner).toMatchObject({ kind: "function", functionIndex });
  expect(range.machine).toMatchObject({ start: address, end: address + 3 });
  expect(bytesAt(artifacts, range)).toEqual([0x4c, 0x81, 0xea]);
  // NMOS JMP absolute takes three nominal cycles, preserves A/X/Y/P, and adds no stack bytes.
  const objects = profileRecords(artifacts.memory.intervals).filter(
    (interval) =>
      interval.kind === "code" && profileRecord(interval.owner).id === "src/game.blend::Game.Q",
  );
  expect(objects).toHaveLength(1);
  expect(objects[0]).toMatchObject({
    start: 0x2000,
    end: 0x2003,
    size: 3,
    owner: { kind: "function", id: "src/game.blend::Game.Q" },
  });
  const homes = profileRecords(artifacts.memory.intervals).filter((interval) =>
    ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
  );
  // Only the mainline's NMI and IRQ predecessor words remain; the shell owns no private home.
  expect(homes.reduce((sum, interval) => sum + Number(interval.size), 0)).toBe(4);
}

describe.each(PROFILES)("reference-only exclusive IRQ output on %s", (profile) => {
  for (const fixture of [
    { name: "empty handler", body: "" },
    { name: "nonreturning handler", body: "while (true) {}" },
  ]) {
    it(`should materialize only the firmware-tail jump for a masked ${fixture.name}`, async () => {
      // No body can execute while this exclusive lifetime is masked; final restore still releases ownership.
      const source = `module Game;
import { setNMI, restoreNMI, setIRQExclusive, restoreIRQ } from c64.system;
interrupt function B(): void {}
place(at: $2000) interrupt function Q(): void { ${fixture.body} }
function main(): void { setNMI(&B); asm_php(); asm_sei(); asm_nop();
setIRQExclusive(&Q); restoreIRQ(); asm_plp(); restoreNMI(); }`;
      await withProfileProject(source, profile, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected complete publication");
        const artifacts = await readProfileArtifacts(built);
        expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
        expectExclusiveShell(artifacts, source);
      });
    }, 60_000);
  }
});
