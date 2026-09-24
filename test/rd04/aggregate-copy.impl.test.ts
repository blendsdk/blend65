import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Narrow a published sidecar field before checking cross-file accounting. */
function evidenceRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Read the exact published JSON, not an in-memory pre-publication draft. */
async function sidecar(directory: string, name: string): Promise<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(await readFile(join(directory, name), "utf8"));
  return evidenceRecord(parsed);
}

describe.sequential("aggregate copy machine implementation", () => {
  // The first and last bytes on both sides of a page boundary must survive an alias-safe copy.
  it("should copy a 300-byte borrowed array through a snapshot in VICE", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-copy-pages-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "copy-pages",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "let source: byte[300] = [; 0];",
          "let target: byte[300] = [; 0];",
          "function copy(input: const byte[300], output: byte[300]): void { output = input; }",
          "function clone(input: const byte[300]): byte[300] { return input; }",
          "function fill(output: byte[300]): void { output = [; 7]; }",
          "function main(): void {",
          "  source[0] = 1; source[255] = 2; source[256] = 3; source[299] = 4;",
          "  copy(source, target);",
          "  copy(target, target);",
          "  target = clone(target);",
          "  poke($0420, target[0]); poke($0421, target[255]);",
          "  poke($0422, target[256]); poke($0423, target[299]);",
          "  fill(target);",
          "  poke($0424, target[0]); poke($0425, target[255]);",
          "  poke($0426, target[256]); poke($0427, target[299]);",
          "}",
        ].join("\n"),
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Aggregate copy build did not succeed");
      const memory = await sidecar(built.generation.directory, ".memory.json");
      const costs = await sidecar(built.generation.directory, ".costs.json");
      const debug = await sidecar(built.generation.directory, ".debug.json");
      expect(memory).toMatchObject({ kind: "blend65.memory", acmeReconciled: true });
      expect(costs).toMatchObject({ kind: "blend65.costs", mode: "none" });
      expect(debug).toMatchObject({ kind: "blend65.debug", optimization: "none" });
      const intervals = memory.intervals;
      const resources = evidenceRecord(costs.totals).resources;
      const functions = debug.functions;
      const ranges = debug.ranges;
      const symbols = debug.symbols;
      if (
        !Array.isArray(intervals) ||
        !Array.isArray(resources) ||
        !Array.isArray(functions) ||
        !Array.isArray(ranges) ||
        !Array.isArray(symbols)
      ) {
        throw new TypeError("Aggregate evidence is missing a required record array");
      }
      const physical = intervals.map(evidenceRecord);
      const resourceRecords = resources.map(evidenceRecord);
      expect(
        physical.some(
          ({ kind, size }) => kind === "sfa" && typeof size === "number" && size >= 300,
        ),
      ).toBe(true);
      expect(resourceRecords.find(({ id }) => id === "residentRam")?.value).toBe(
        physical.reduce((total, item) => total + Number(item.size), 0),
      );
      expect(resourceRecords.find(({ id }) => id === "zeroPage")?.value).toBe(
        physical
          .filter(({ resourceClass }) => resourceClass === "zeroPage")
          .reduce((total, item) => total + Number(item.size), 0),
      );
      expect(functions.map((item) => evidenceRecord(item).qualifiedName)).toEqual(
        expect.arrayContaining([
          expect.stringContaining(".copy"),
          expect.stringContaining(".clone"),
          expect.stringContaining(".fill"),
        ]),
      );
      const snapshotSymbols = symbols
        .map(evidenceRecord)
        .filter(
          ({ qualifiedName }) =>
            typeof qualifiedName === "string" && qualifiedName.includes("aggregate-snapshot"),
        );
      expect(snapshotSymbols.length).toBeGreaterThan(0);
      expect(
        snapshotSymbols.every(({ kind, byteWidth }) => kind === "temporary" && byteWidth === 300),
      ).toBe(true);
      expect(ranges.length).toBeGreaterThan(0);
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const returnLabel = `b65_${Buffer.from("startup.restore").toString("hex")}`;
      const returnMatch = labels.match(
        new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
      );
      expect(returnMatch).not.toBeNull();
      const returnAddress = Number.parseInt(returnMatch?.[1] ?? "", 16);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      try {
        const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
        try {
          const stopped = started.monitor.waitForStop(20_000);
          await started.monitor.resume();
          expect(await stopped).toBe(returnAddress);
          expect([...(await started.monitor.readMemory(0x0420, 0x0423))]).toEqual([1, 2, 3, 4]);
          expect([...(await started.monitor.readMemory(0x0424, 0x0427))]).toEqual([7, 7, 7, 7]);
        } finally {
          await started.monitor.deleteCheckpoint(checkpoint);
        }
      } finally {
        await stopVice({ child: started.child, monitor: started.monitor });
      }
    } finally {
      await rm(root, { recursive: true });
    }
  }, 60_000);
});
