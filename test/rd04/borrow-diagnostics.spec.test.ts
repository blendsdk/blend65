import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { diagnosticSpan } from "./diagnostic-fixture.js";

/** Exercise borrow diagnostics through the same public build that must suppress invalid artifacts. */
async function buildSource(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-borrow-records-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "borrow-records",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("alternate borrowed-address escape diagnostics", () => {
  it.each([
    {
      name: "persistent module storage",
      declaration: "let saved: word = 0;",
      escape: "saved = &value;",
      sink: /saved|module|persistent/iu,
    },
    {
      name: "a raw-memory value argument",
      declaration: "",
      escape: "poke($0400, lo(&value));",
      sink: /poke|raw|memory/iu,
    },
  ])("should identify the first escape through $name and its local origin", async (testCase) => {
    const source = `module Game; ${testCase.declaration} function main(): void { let value: byte = 7; ${testCase.escape} }`;
    const result = await buildSource(source);
    expect(result.kind).toBe("failure");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10260"]);
    const diagnostic = errors[0];
    expect(diagnostic).toMatchObject({ code: "E10260", severity: "error", pointer: null });
    const match =
      /^Address derived from 'value' escapes its lifetime through (.+) — the address may only be used while its origin is alive or passed to a proven non-retaining parameter; move persistent data to module scope or keep it caller-owned$/u.exec(
        diagnostic?.message ?? "",
      );
    expect(match, diagnostic?.message).not.toBeNull();
    expect(match?.[1]).toMatch(testCase.sink);
    const escape = diagnosticSpan(source, testCase.escape);
    expect(diagnostic?.primarySpan?.sourceId).toBe(escape.sourceId);
    expect(diagnostic?.primarySpan?.start).toBeGreaterThanOrEqual(escape.start);
    expect(diagnostic?.primarySpan?.end).toBeLessThanOrEqual(escape.end);
    expect(diagnostic?.primarySpan?.end).toBeGreaterThan(
      diagnostic?.primarySpan?.start ?? Infinity,
    );
    expect(diagnostic?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "value")]);
    expect(result).not.toHaveProperty("generation");
  });

  it("should allow a transitive non-retaining borrow and publish data read through it", async () => {
    const result = await buildSource(
      "module Game; function readNow(address: word): byte { return peek(address); } function forward(address: word): byte { return readNow(address); } function main(): void { let value: byte = 7; let address: word = &value; poke(address, 9); poke($0400, forward(address)); }",
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.diagnostics.filter(({ code }) => code === "E10260")).toEqual([]);
  }, 60_000);
});
