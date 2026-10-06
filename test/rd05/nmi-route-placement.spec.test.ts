import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const IMPORTS = "module Game; import { setNMI, restoreNMI } from c64.system;";
const MAIN = "function main(): void { setNMI(&handler); restoreNMI(); }";
const COLLISION = `${IMPORTS} place(at: $2047) interrupt function handler(): void {} place(at: $2047) const RESERVED: byte[3] = [1, 2, 3]; function main(): void { setNMI(&handler); poke($0400, RESERVED[0]); restoreNMI(); }`;
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Resolve the stable public entry symbol without using compiler-private label names. */
function labelAddress(artifacts: Artifacts, label: string): number {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = artifacts.labels.match(
    new RegExp(`^\\s*${escaped}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"),
  );
  expect(match).not.toBeNull();
  return Number.parseInt(match![1]!, 16);
}

/** Extract actual linked object bytes from the PRG's explicit load-address header. */
function bytesAt(artifacts: Artifacts, start: number, end: number): number[] {
  const load = artifacts.prg.readUInt16LE(0);
  expect(start).toBeGreaterThanOrEqual(load);
  expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
  return [...artifacts.prg.subarray(start - load + 2, end - load + 2)];
}

/** The complete constrained wrapper and immutable entry remain separately accountable. */
function expectAdaptedWrapper(artifacts: Artifacts, fixed?: number) {
  const functions = profileRecords(artifacts.debug.functions);
  const index = functions.findIndex((fn) => fn.qualifiedName === "src/game.blend::Game.handler");
  expect(index).toBeGreaterThanOrEqual(0);
  const entries = profileRecords(functions[index]!.entryVariants);
  expect(entries).toHaveLength(1);
  const entry = entries[0]!;
  const published = labelAddress(artifacts, String(entry.label));
  expect(published & 0xff).toBe(0x47);
  const code = profileRecords(artifacts.memory.intervals).filter((interval) => {
    const owner = profileRecord(interval.owner);
    return (
      interval.kind === "code" &&
      owner.kind === "function" &&
      owner.id === "src/game.blend::Game.handler"
    );
  });
  expect(code).toHaveLength(2);
  const wrapper = code.find(
    (interval) => bytesAt(artifacts, Number(interval.start), Number(interval.end))[0] === 0x6c,
  );
  expect(wrapper).toBeDefined();
  const address = Number(wrapper!.start);
  if (fixed !== undefined) expect(address).toBe(fixed);
  else expect(address % 256).toBe(0);
  expect(wrapper!.size).toBe(3);
  const wrapperBytes = bytesAt(artifacts, address, Number(wrapper!.end));
  expect(wrapperBytes).toHaveLength(3);
  expect(wrapperBytes[1]).toBeLessThanOrEqual(0xfe);
  expect(bytesAt(artifacts, published, published + 3)).toEqual([
    0x4c,
    address & 0xff,
    address >> 8,
  ]);
  const ranges = profileRecords(artifacts.debug.ranges);
  const covered = (entry.rangeIndexes as number[]).map((rangeIndex) => {
    const range = ranges[rangeIndex]!;
    expect(range.owner).toMatchObject({ kind: "function", functionIndex: index });
    return profileRecord(range.machine);
  });
  expect(covered).toContainEqual(expect.objectContaining({ start: address, end: address + 3 }));
  expect(covered).toContainEqual(expect.objectContaining({ start: published, end: published + 3 }));
  const row = profileRecords(artifacts.memory.stackDomains).find(
    (candidate) => candidate.id === `nmi-entry:${String(entry.id)}`,
  );
  expect(row).toMatchObject({ peakBytes: 3, capacityBytes: 236, headroomBytes: 233 });
  // The JMP adapter adds exactly 3 loaded bytes/3 cycles, no pushes and no homes.
  const payload = artifacts.prg.length - 2;
  expect(profileRecord(artifacts.costs.totals).programBytes).toBe(payload);
  const loaded = profileRecords(artifacts.costs.entries).filter(
    (piece) => piece.kind === "bytes" && piece.accounting === "program",
  );
  expect(loaded.reduce((sum, piece) => sum + Number(piece.bytes), 0)).toBe(payload);
  const packageRecord = profileRecord(artifacts.build.package);
  expect(packageRecord).toMatchObject({
    kind: "prg",
    loadAddress: artifacts.prg.readUInt16LE(0),
    endAddress: artifacts.prg.readUInt16LE(0) + payload,
  });
}

/** Snapshot every file in the owned publication tree, including generation and pointer files. */
async function publicationFiles(directory: string, prefix = ""): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      Object.assign(result, await publicationFiles(join(directory, entry.name), `${relative}/`));
    else result[relative] = (await readFile(join(directory, entry.name))).toString("hex");
  }
  return result;
}

describe("stock-chained NMI complete-object placement", () => {
  for (const placement of ["place(at: $2000)", "place(align: 256)"]) {
    it.each(PROFILES)(
      `should retain the complete source constraint when ${placement} builds on %s`,
      async (profile) => {
        const source = `${IMPORTS} ${placement} interrupt function handler(): void {} ${MAIN}`;
        const artifacts = await buildProfileSource(source, profile);
        expectAdaptedWrapper(artifacts, placement.includes("at:") ? 0x2000 : undefined);
      },
      60_000,
    );
  }

  const impossible = [
    { name: "fixed wrapper collides with reachable fixed data", source: COLLISION },
    {
      name: "complete wrapper crosses its fixed noCross boundary",
      source: `${IMPORTS} place(at: $20fe, noCross: 256) interrupt function handler(): void {} ${MAIN}`,
    },
    {
      name: "non-equivalent IRQ and NMI wrappers claim the same fixed address",
      source:
        "module Game; import { setNMI,restoreNMI,setIRQ,restoreIRQ } from c64.system; place(at: $2000) interrupt function handler(): void { poke($0400, 7); } function main(): void { asm_sei(); asm_nop(); setNMI(&handler); setIRQ(&handler); restoreIRQ(); restoreNMI(); }",
    },
  ];
  for (const fixture of impossible) {
    it.each(PROFILES)(
      `should fail without partial publication when ${fixture.name} on %s`,
      async (profile) => {
        await withProfileProject(fixture.source, profile, async (project, root) => {
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("failure");
          if (built.kind !== "failure") throw new Error("Expected failed placement");
          expect(built.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E10273");
          expect(built).not.toHaveProperty("generation");
          await expect(readdir(join(root, "out"))).rejects.toMatchObject({ code: "ENOENT" });
        });
      },
      60_000,
    );
  }

  it.each(PROFILES)(
    "should preserve every earlier published byte when a later fixed collision fails on %s",
    async (profile) => {
      await withProfileProject(
        "module Game; function main(): void {}",
        profile,
        async (project, root) => {
          const first = await buildProject({ project, optimization: "none" });
          expect(first.kind, JSON.stringify(first.diagnostics)).toBe("success");
          if (first.kind !== "success") throw new Error("Expected initial generation");
          const before = await publicationFiles(join(root, "out"));
          expect(Object.keys(before).length).toBeGreaterThan(0);
          await writeFile(join(root, "src/game.blend"), COLLISION);
          const failed = await buildProject({ project, optimization: "none" });
          expect(failed.kind, JSON.stringify(failed.diagnostics)).toBe("failure");
          if (failed.kind !== "failure") throw new Error("Expected failed final placement");
          expect(failed.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E10273");
          expect(failed).not.toHaveProperty("generation");
          expect(await publicationFiles(join(root, "out"))).toEqual(before);
        },
      );
    },
    60_000,
  );
});
