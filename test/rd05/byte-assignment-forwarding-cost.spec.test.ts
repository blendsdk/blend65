import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { expect, it } from "vitest";
import { profileRecord, profileRecords, readProfileArtifacts } from "./profile-fixture.js";

/** Missing accounting is an error, never an implicit zero-byte contribution. */
function numberField(record: Record<string, unknown>, field: string): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Missing numeric ${field}`);
  return value;
}

it("should remove the seven eligible captures when building the unchanged Boing workload", async () => {
  const root = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "byte-assignment-boing-"),
  );
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    for (const file of ["blend65.json", "src/main.blend", "assets/ball.bin"]) {
      await copyFile(join("examples/boing-ball", file), join(root, file));
    }
    const built = await buildProject({
      project: join(root, "blend65.json"),
      target: "c64-pal-prg-kernal-6581",
      optimization: "none",
    });
    if (built.kind !== "success") throw new Error("Unchanged Boing source must build successfully");
    const artifacts = await readProfileArtifacts(built);
    const entries = profileRecords(artifacts.costs.entries).filter(
      (entry) => entry.accounting === "program",
    );
    expect(entries.length).toBeGreaterThan(0);
    const entryIds = entries.map((entry) => entry.id);
    expect(entryIds.every((id) => typeof id === "string" && id.length > 0)).toBe(true);
    expect(new Set(entryIds).size).toBe(entries.length);
    expect(
      entries.every((entry) =>
        ["code", "asset", "startup", "padding", "helper"].includes(String(entry.component)),
      ),
    ).toBe(true);
    for (const component of ["code", "asset", "startup", "padding"]) {
      const matches = entries.filter((entry) => entry.component === component);
      expect(matches.length).toBeGreaterThan(0);
    }
    const sum = (component: string) =>
      entries
        .filter((entry) => entry.component === component)
        .reduce((total, entry) => total + numberField(entry, "bytes"), 0);
    expect(sum("code")).toBeLessThanOrEqual(1151);
    expect(sum("asset")).toBe(1024);
    expect(sum("startup")).toBe(12);
    expect(entries.filter((entry) => entry.component === "helper")).toHaveLength(0);
    expect(sum("helper")).toBe(0);
    const payload = ["code", "asset", "startup", "padding", "helper"].reduce(
      (total, component) => total + sum(component),
      0,
    );
    const totals = profileRecord(artifacts.costs.totals);
    expect(payload).toBe(numberField(totals, "programBytes"));
    expect(payload).toBe(7167);
    expect(artifacts.prg.length - 2).toBe(payload);
    const resources = profileRecords(totals.resources);
    for (const [id, limit] of [
      ["residentRam", 7246],
      ["zeroPage", 0],
      ["scratch", 0],
      ["hardwareStack", 1],
    ] as const) {
      const matches = resources.filter((resource) => resource.id === id);
      expect(matches).toHaveLength(1);
      if (id === "residentRam")
        expect(numberField(matches[0]!, "value")).toBeLessThanOrEqual(limit);
      else expect(numberField(matches[0]!, "value")).toBe(limit);
    }
    const intervals = profileRecords(artifacts.memory.intervals).filter(
      (entry) => entry.addressSpaceId === "cpu16",
    );
    for (const [id, size] of [
      ["code.startup.entry", 326],
      ["platform.startup-state", 49],
    ] as const) {
      const matches = intervals.filter((interval) => interval.id === id);
      expect(matches).toHaveLength(1);
      const interval = matches[0]!;
      expect(numberField(interval, "size")).toBe(size);
      expect(numberField(interval, "end") - numberField(interval, "start")).toBe(size);
    }
    const frames = intervals.filter((entry) => entry.kind === "sfa");
    expect(frames.length).toBeGreaterThan(0);
    expect(
      frames.reduce((total, frame) => total + numberField(frame, "size"), 0),
    ).toBeLessThanOrEqual(30);
    for (const interval of intervals) {
      expect(numberField(interval, "end") - numberField(interval, "start")).toBe(
        numberField(interval, "size"),
      );
    }
    const code = intervals.filter((entry) => entry.kind === "code");
    expect(code.length).toBeGreaterThan(0);
    const origin = artifacts.prg.readUInt16LE(0);
    const codeChunks = code.map((interval) => {
      const start = numberField(interval, "start") - origin + 2;
      const end = numberField(interval, "end") - origin + 2;
      expect(start).toBeGreaterThanOrEqual(2);
      expect(end).toBeLessThanOrEqual(artifacts.prg.length);
      return artifacts.prg.subarray(start, end);
    });
    expect(codeChunks.reduce((total, chunk) => total + chunk.length, 0)).toBe(
      sum("code") + sum("startup"),
    );
    // Poll raster line 251 without adding a captured comparison value.
    expect(artifacts.assembly).toMatch(/\beor\s+#\$fb\b/i);
    const rasterPoll = Buffer.from([0xad, 0x12, 0xd0, 0x49, 0xfb, 0xd0, 0xf9]);
    expect(codeChunks.some((chunk) => chunk.includes(rasterPoll))).toBe(true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 300_000);
