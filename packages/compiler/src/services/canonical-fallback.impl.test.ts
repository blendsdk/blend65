import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "./services.js";

/** Narrow generated evidence without treating malformed or missing fields as defaults. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Expected an evidence record");
  return value as Record<string, unknown>;
}

/** Build one actual public service request and inspect its published selection evidence. */
async function decision(source: string, optimization: "size" | "balanced" | "speed") {
  const root = await mkdtemp(join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "canonical-fallback-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "canonical-fallback",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization,
      }),
    );
    const result = await buildProject({ project });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a published generation");
    const costs: unknown = JSON.parse(
      await readFile(join(result.generation.directory, ".costs.json"), "utf8"),
    );
    const decisions = record(costs).decisions;
    if (!Array.isArray(decisions) || decisions.length !== 1)
      throw new Error("Expected one whole-program decision");
    return record(decisions[0]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("authenticated canonical fallback", () => {
  it.each(["size", "balanced", "speed"] as const)(
    "should publish exact canonical reuse only after every transformed %s recipe rejects",
    async (mode) => {
      const selected = await decision(
        "module Game;function main():void{poke(peekw($C110),42);}",
        mode,
      );
      expect(selected.selectedCandidateId).toMatch(/:canonical$/u);
      const candidates = selected.candidates;
      if (!Array.isArray(candidates)) throw new Error("Expected candidate evidence");
      const feasible = candidates
        .map(record)
        .filter((candidate) => record(candidate.feasibility).kind === "feasible");
      expect(feasible).toHaveLength(1);
      expect(feasible[0]?.id).toBe(selected.selectedCandidateId);
      expect(selected.baselineCandidateId).toBe(selected.selectedCandidateId);
      expect(record(feasible[0]?.feasibility).vector).toBeDefined();
    },
    30_000,
  );

  it("should not admit a canonical fallback when a transformed recipe is feasible", async () => {
    const selected = await decision("module Game;function main():void{}", "size");
    expect(selected.selectedCandidateId).not.toMatch(/:canonical$/u);
    const candidates = selected.candidates;
    if (!Array.isArray(candidates)) throw new Error("Expected candidate evidence");
    expect(candidates.map(record).some(({ id }) => String(id).endsWith(":canonical"))).toBe(false);
  });
});
