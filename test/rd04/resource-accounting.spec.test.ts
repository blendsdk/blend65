import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const platform = "c64-pal-prg-kernal-6581";
const origin = 0x0801;
const budget = 51_199;

/** Build a source in isolation and retain its artifacts until inspection finishes. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => Promise<void> | void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-resource-accounting-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "resource-accounting",
        sourceRoot: "src",
        entry: "Game",
        target: platform,
        outDir: "out",
        optimization: "none",
      }),
    );
    await inspect(
      await buildProject({ project: join(root, "blend65.json"), optimization: "none" }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Reject malformed evidence instead of silently treating it as an empty resource report. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Read a required interval collection without accepting absent accounting. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected evidence records");
  return value.map(record);
}

describe("final shared resource accounting", () => {
  it("should admit fixed constant data near the inclusive upper RAM boundary", async () => {
    await withBuild(
      "module Game; place(at: $CF00) const MARK: byte = $A5; function main(): void { poke($0400, MARK); }",
      async (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
        if (result.kind !== "success") throw new Error("Expected legal upper-range placement");
        const image = await readFile(join(result.generation.directory, "resource-accounting.prg"));
        expect(image.readUInt16LE(0)).toBe(origin);
        expect(image.length - 2).toBe(0xcf01 - origin);
        expect(image.at(-1)).toBe(0xa5);
        expect(image.length - 2).toBeLessThanOrEqual(budget);
        expect(result.diagnostics.filter(({ code }) => code === "W10033")).toHaveLength(1);
      },
    );
  }, 60_000);

  it("should count emitted padding and keep trailing mutable storage out of the PRG", async () => {
    await withBuild(
      "module Game; place(at: $A000) const MARK: byte = $A5; let buffer: byte[1024]; function main(): void { buffer[0] = MARK; poke($0400, buffer[0]); }",
      async (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
        if (result.kind !== "success") throw new Error("Expected padding and BSS build");
        const directory = result.generation.directory;
        const image = await readFile(join(directory, "resource-accounting.prg"));
        const payloadBytes = 0xa001 - origin;
        expect(image.readUInt16LE(0)).toBe(origin);
        expect(image.length - 2).toBe(payloadBytes);
        expect(image.at(-1)).toBe(0xa5);
        const memory = record(JSON.parse(await readFile(join(directory, ".memory.json"), "utf8")));
        expect(memory.acmeReconciled).toBe(true);
        const intervals = records(memory.intervals);
        const shared = intervals.filter(
          (interval) => Number(interval.start) >= origin && Number(interval.end) <= 0xd000,
        );
        const emitted = shared.filter((interval) => Number(interval.start) < 0xa001);
        const suffix = shared.filter((interval) => Number(interval.start) >= 0xa001);
        expect(emitted.length).toBeGreaterThan(0);
        expect(suffix.length).toBeGreaterThan(0);
        const ordered = [...emitted].sort((a, b) => Number(a.start) - Number(b.start));
        let cursor = origin;
        for (const interval of ordered) {
          expect(interval.start).toBe(cursor);
          expect(interval.size).toBe(Number(interval.end) - Number(interval.start));
          cursor = Number(interval.end);
        }
        expect(cursor).toBe(0xa001);
        expect(emitted.reduce((sum, interval) => sum + Number(interval.size), 0)).toBe(
          payloadBytes,
        );
        expect(
          emitted.reduce((sum, interval) => sum + Number(interval.paddingBytes), 0),
        ).toBeGreaterThan(0);
        const suffixBytes = suffix.reduce((sum, interval) => sum + Number(interval.size), 0);
        expect(suffixBytes).toBeGreaterThanOrEqual(1024);
        expect(payloadBytes + suffixBytes).toBeLessThanOrEqual(budget);
        expect(payloadBytes * 100).toBeGreaterThanOrEqual(75 * budget);
        const warnings = result.diagnostics.filter(({ code }) => code === "W10033");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
          severity: "warning",
          message: expect.stringMatching(
            /^RAM usage is \d+(?:\.\d+)?% of platform 'c64-pal-prg-kernal-6581' budget$/u,
          ),
        });
        const costs = record(JSON.parse(await readFile(join(directory, ".costs.json"), "utf8")));
        expect(record(costs.totals).programBytes).toBe(payloadBytes);
      },
    );
  }, 60_000);

  it("should reject an oversized non-emitted buffer as shared RAM rather than binary size", async () => {
    await withBuild(
      "module Game; let buffer: byte[51200]; function main(): void { buffer[0] = 7; poke($0400, buffer[0]); }",
      (result) => {
        expect(result.kind).toBe("failure");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors.map(({ code }) => code)).toEqual(["E10238"]);
        const match =
          /^Target resource budget exceeded for '([^']+)' — used (\d+), available 51199 on 'c64-pal-prg-kernal-6581'$/u.exec(
            errors[0]?.message ?? "",
          );
        expect(match).not.toBeNull();
        expect(match?.[1]).toMatch(/ram/i);
        expect(Number(match?.[2])).toBeGreaterThanOrEqual(51_200);
        expect(result).not.toHaveProperty("generation");
      },
    );
  }, 60_000);

  it("should not combine caller status saves with a callee invoked after those saves are restored", async () => {
    const saves = "asm_php(); ".repeat(120);
    const restores = "asm_plp(); ".repeat(120);
    const source = `module Game; function callee(): void { ${saves}${restores} } function main(): void { ${saves}${restores}callee(); }`;
    await withBuild(source, (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      expect(result.diagnostics.filter(({ code }) => code === "W10180")).toEqual([]);
    });
  }, 60_000);
});
