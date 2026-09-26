import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

const cases = [
  {
    code: "W10110",
    declarations: "struct Large { bytes: byte[35]; } zeropage { item: Large; }",
    body: "item.bytes[0] = 1; poke($0400, item.bytes[0]);",
    proof: "item",
    message: "Struct 'item' uses 35 zero-page bytes",
  },
  {
    code: "W10143",
    declarations: "let values: byte[256] = [0; 0];",
    body: "poke($0400, values[0]);",
    proof: "values",
    message: "Mutable array 'values' uses 256 RAM bytes on platform 'c64-pal-prg-kernal-6581'",
  },
] as const;

describe("canonical resource advisories", () => {
  // Threshold equality is sufficient; these legal declarations still receive a complete executable.
  it.each(cases)(
    "should report $code at the profile threshold without rejecting the program",
    async (testCase) => {
      const root = await mkdtemp(join(tmpdir(), "blend65-resource-warning-"));
      const source = `module Game; ${testCase.declarations} function main(): void { ${testCase.body} }`;
      try {
        await mkdir(join(root, "src"));
        await writeFile(join(root, "src/game.blend"), source);
        await writeFile(
          join(root, "blend65.json"),
          JSON.stringify({
            schemaVersion: 1,
            name: "resource-warning",
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
        const matching = result.diagnostics.filter(({ code }) => code === testCase.code);
        expect(matching).toHaveLength(1);
        expect(matching[0]).toMatchObject({
          code: testCase.code,
          severity: "warning",
          message: testCase.message,
          pointer: null,
          primarySpan: diagnosticSpan(source, testCase.proof),
        });
        expect(matching[0]?.related).toEqual([]);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
