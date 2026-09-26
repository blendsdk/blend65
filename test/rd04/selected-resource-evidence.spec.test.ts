import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const platform = "c64-pal-prg-kernal-6581";
const origin = 0x0801;
const ramBudget = 51_199;

/** Keep the selected public build and its artifacts alive for one independent inspection. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => Promise<void> | void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-selected-resource-evidence-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "selected-resource-evidence",
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

/** Require an actual sidecar object instead of accepting missing evidence. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Require a sidecar collection whose entries are individually inspected as unknown data. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected evidence records");
  return value.map(record);
}

/** Reject numeric strings and absent fields in exact byte evidence. */
function bytes(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected a nonnegative byte count or address");
  }
  return value;
}

/** Emit balanced source status operations with an independently known live depth. */
function statusSaves(count: number, body = ""): string {
  return `${"asm_php(); ".repeat(count)}${body}${"asm_plp(); ".repeat(count)}`;
}

describe("selected numerical resource evidence", () => {
  it("reports RAM percentage from emitted padding and every occupied trailing byte", async () => {
    const source =
      "module Game; place(at: $A000) const MARK: byte = $A5; let buffer: byte[1024]; function main(): void { buffer[0] = MARK; poke($0400, buffer[0]); }";
    await withBuild(source, async (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected a placed-data build");
      const directory = result.generation.directory;
      const image = await readFile(join(directory, result.generation.primaryArtifact));
      const memory: unknown = JSON.parse(await readFile(join(directory, ".memory.json"), "utf8"));
      const costs: unknown = JSON.parse(await readFile(join(directory, ".costs.json"), "utf8"));
      const payloadBytes = 0xa001 - origin;
      expect(image.readUInt16LE(0)).toBe(origin);
      expect(image.length - 2).toBe(payloadBytes);
      expect(image.at(-1)).toBe(0xa5);
      expect(record(memory).acmeReconciled).toBe(true);

      const shared = records(record(memory).intervals)
        .filter((interval) => bytes(interval.start) >= origin && bytes(interval.end) <= 0xd000)
        .sort((left, right) => bytes(left.start) - bytes(right.start));
      expect(shared.length).toBeGreaterThan(0);
      let cursor = origin;
      for (const interval of shared) {
        expect(interval.start, "No double-counted or unreported occupied bytes").toBe(cursor);
        expect(interval.size).toBe(bytes(interval.end) - bytes(interval.start));
        expect(interval.size).toBe(
          bytes(interval.payloadBytes) +
            bytes(interval.paddingBytes) +
            bytes(interval.reservedBytes),
        );
        cursor = bytes(interval.end);
      }
      const occupiedBytes = shared.reduce((sum, interval) => sum + bytes(interval.size), 0);
      const trailing = shared.filter((interval) => bytes(interval.start) >= 0xa001);
      const trailingBytes = trailing.reduce((sum, interval) => sum + bytes(interval.size), 0);
      expect(trailingBytes).toBeGreaterThanOrEqual(1024);
      expect(occupiedBytes).toBe(payloadBytes + trailingBytes);
      expect(occupiedBytes).toBe(cursor - origin);
      expect(occupiedBytes).toBeLessThanOrEqual(ramBudget);
      expect(
        shared.reduce((sum, interval) => sum + bytes(interval.paddingBytes), 0),
      ).toBeGreaterThan(0);
      expect(record(record(costs).totals).programBytes).toBe(payloadBytes);
      expect(
        records(record(costs).entries)
          .filter((entry) => entry.kind === "bytes" && entry.accounting === "program")
          .reduce((sum, entry) => sum + bytes(entry.bytes), 0),
      ).toBe(payloadBytes);

      const warnings = result.diagnostics.filter(({ code }) => code === "W10033");
      expect(warnings).toHaveLength(1);
      const match =
        /^RAM usage is (\d+(?:\.\d+)?)% of platform 'c64-pal-prg-kernal-6581' budget$/u.exec(
          warnings[0]?.message ?? "",
        );
      expect(match).not.toBeNull();
      const displayed = match![1]!;
      const precision = displayed.split(".")[1]?.length ?? 0;
      // Presentation may round or truncate, but its numerator includes the complete shared footprint.
      expect(Math.abs(Number(displayed) - (100 * occupiedBytes) / ramBudget)).toBeLessThan(
        10 ** -precision,
      );
    });
  }, 60_000);

  it.each([187, 188, 236, 237])(
    "reports the exact selected stack boundary for %i simultaneously live status saves",
    async (count) => {
      await withBuild(
        `module Game; function main(): void { ${statusSaves(count)} }`,
        async (result) => {
          if (count > 236) {
            expect(result.kind).toBe("failure");
            const errors = result.diagnostics.filter(({ severity }) => severity === "error");
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({ code: "E10238" });
            expect(errors[0]?.message).toMatch(
              /^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used 237, available 236 on 'c64-pal-prg-kernal-6581'$/u,
            );
            expect(result).not.toHaveProperty("generation");
            return;
          }
          expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
          if (result.kind !== "success") throw new Error("Expected a bounded status-stack build");
          const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
          // This fixture has no calls or generated interrupt route to add a live return/frame.
          expect(assembly).not.toMatch(/^\s*jsr(?:\+\d+)?\s/imu);
          const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
          expect(warnings).toHaveLength(count >= 188 ? 1 : 0);
          if (count >= 188) {
            expect(warnings[0]?.message).toBe(
              `Maximum simultaneous hardware-stack use is ${count} bytes on '${platform}'; usable capacity is 236 (calls 0, interrupt entries 0, explicit pushes ${count})`,
            );
          }
        },
      );
    },
    60_000,
  );

  it("charges two live call returns together with the status saves spanning those calls", async () => {
    const source = [
      "module Game;",
      `function leaf(): void { ${statusSaves(44)} }`,
      `function middle(): void { ${statusSaves(40, "leaf(); ")} }`,
      `function main(): void { ${statusSaves(100, "middle(); ")} }`,
    ].join("\n");
    await withBuild(source, async (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected a bounded nested-call build");
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      expect(assembly.match(/^\s*jsr(?:\+\d+)?\s+\S+/gimu)).toHaveLength(2);
      const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
      expect(warnings).toHaveLength(1);
      // 100 + 40 + 44 live PHP bytes, plus two two-byte JSR return addresses.
      expect(warnings[0]?.message).toBe(
        `Maximum simultaneous hardware-stack use is 188 bytes on '${platform}'; usable capacity is 236 (calls 4, interrupt entries 0, explicit pushes 184)`,
      );
    });
  }, 60_000);
});
