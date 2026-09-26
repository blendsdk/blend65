import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

describe("canonical full zero-page advisory", () => {
  // A fully occupied legal profile range is a warning; its 100 percent requires no rounding policy.
  it("should report W10030 for all 142 allocatable zero-page bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-full-zeropage-"));
    const source =
      "module Game; zeropage { values: byte[142]; } function main(): void { values[0] = 7; poke($0400, values[0]); }";
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), source);
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "full-zeropage",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      const warnings = result.diagnostics.filter(({ code }) => code === "W10030");
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: "W10030",
        severity: "warning",
        pointer: null,
        message: "Zero-page usage is 142/142 bytes (100%) on 'c64-pal-prg-kernal-6581'",
        primarySpan: diagnosticSpan(source, "values"),
        related: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
