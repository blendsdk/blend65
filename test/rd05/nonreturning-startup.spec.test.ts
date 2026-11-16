import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const EXAMPLE = fileURLToPath(new URL("../../examples/boing-ball/", import.meta.url));
const RESTORE_SUFFIX = `_${Buffer.from("startup.restore", "utf8").toString("hex")}`;
const ENTRY_SUFFIX = `_${Buffer.from("startup.entry", "utf8").toString("hex")}`;
const RASTER_POLL = Buffer.from([0xad, 0x12, 0xd0, 0x49, 0xfb, 0xd0, 0xf9]);

/** Each build owns only its source, one asset and manifest; the example output stays untouched. */
async function buildBoing(target: string) {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "dead-restore-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await copyFile(join(EXAMPLE, "src", "main.blend"), join(root, "src", "main.blend"));
    await copyFile(join(EXAMPLE, "assets", "ball.bin"), join(root, "assets", "ball.bin"));
    const manifest: unknown = JSON.parse(await readFile(join(EXAMPLE, "blend65.json"), "utf8"));
    const project = join(root, "blend65.json");
    await writeFile(project, JSON.stringify(profileRecord(manifest)));
    const result = await buildProject({ project, target, optimization: "none" });
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("Unchanged example source must build");
    return await readProfileArtifacts(result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Validate byte evidence before doing arithmetic on unknown JSON fields. */
function byteCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("Artifact byte counts must be nonnegative safe integers");
  }
  return value;
}

/** Sum only program-owned components, never reservations or overlapping address views. */
function componentBytes(costs: Record<string, unknown>, component: string): number {
  const entries = profileRecords(costs.entries).filter(
    (entry) => entry.accounting === "program" && entry.component === component,
  );
  expect(entries.length).toBeGreaterThan(0);
  return entries.reduce((total, entry) => total + byteCount(entry.bytes), 0);
}

/** Search resident code bytes, so an accidental matching asset sequence cannot satisfy the poll. */
function hasRasterPoll(prg: Buffer, memory: Record<string, unknown>): boolean {
  expect(prg.length).toBeGreaterThan(2);
  const loadAddress = prg.readUInt16LE(0);
  const code = profileRecords(memory.intervals).filter((interval) => interval.kind === "code");
  expect(code.length).toBeGreaterThan(0);
  return code.some((interval) => {
    const start = byteCount(interval.start) - loadAddress + 2;
    const end = byteCount(interval.end) - loadAddress + 2;
    if (start < 2 || end > prg.length || end <= start) return false;
    return prg.subarray(start, end).includes(RASTER_POLL);
  });
}

describe("public nonreturning cooperative startup artifacts", () => {
  it.each(PROFILES)(
    "should remove dead restoration while retaining source, entry and poll contracts on %s",
    async (target) => {
      const artifacts = await buildBoing(target);
      expect(artifacts.assembly).not.toContain(RESTORE_SUFFIX);
      expect(artifacts.labels).not.toContain(RESTORE_SUFFIX);
      expect(artifacts.assembly).toContain(ENTRY_SUFFIX);
      expect(componentBytes(artifacts.costs, "code")).toBeLessThan(1593);
      expect(componentBytes(artifacts.costs, "asset")).toBe(1024);
      expect(componentBytes(artifacts.costs, "startup")).toBe(12);
      expect(byteCount(profileRecord(artifacts.costs.totals).programBytes)).toBe(7167);
      expect(artifacts.prg).toHaveLength(7169);
      expect(hasRasterPoll(artifacts.prg, artifacts.memory)).toBe(true);
      const snapshots = profileRecords(artifacts.memory.intervals).filter(
        (interval) => interval.id === "platform.startup-state",
      );
      expect(snapshots.length).toBeGreaterThan(0);
      for (const state of snapshots) {
        expect(byteCount(state.end) - byteCount(state.start)).toBe(49);
      }
    },
    120_000,
  );

  it.each(PROFILES)(
    "should keep ordinary restoration for a returning public main on %s",
    async (target) => {
      const artifacts = await buildProfileSource("module Game; function main(): void {}", target);
      expect(artifacts.assembly).toContain(RESTORE_SUFFIX);
      expect(artifacts.labels).toContain(RESTORE_SUFFIX);
      expect(artifacts.assembly).toContain(ENTRY_SUFFIX);
    },
    120_000,
  );
});
