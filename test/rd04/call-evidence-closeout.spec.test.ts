import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Keep each public build and its sidecars isolated until their assertions complete. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => Promise<void> | void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-call-evidence-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "call-evidence",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
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

/** Reject absent or malformed evidence before examining its public fields. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Inspect every element as unknown JSON rather than trusting a sidecar type assertion. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected evidence records");
  return value.map(record);
}

describe("ordinary call evidence and parameter capacity", () => {
  // Every emitted caller variant owns the source calls made in that variant, even across IRQ domains.
  it("records the leaf call under every mainline and IRQ helper entry context", async () => {
    const callExpression = "leaf(value)";
    const source = [
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      "const OUTPUT: word = $0400;",
      "function leaf(value: byte): byte { return value + 1; }",
      `function helper(value: byte): byte { return ${callExpression}; }`,
      "interrupt function onIRQ(): void { poke(OUTPUT, helper(2)); }",
      "function main(): void { asm_cli(); asm_nop(); setIRQ(&onIRQ); poke(OUTPUT, helper(1)); restoreIRQ(); }",
    ].join("\n");
    await withBuild(source, async (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      if (result.kind !== "success") throw new Error("Expected a multi-context call build");
      const debug = record(
        JSON.parse(await readFile(join(result.generation.directory, ".debug.json"), "utf8")),
      );
      const sources = records(debug.sources);
      const sourceIndex = sources.findIndex(({ path }) => path === "src/game.blend");
      expect(sourceIndex).toBeGreaterThanOrEqual(0);
      expect(sources[sourceIndex]?.byteLength).toBe(Buffer.byteLength(source, "utf8"));
      const functions = records(debug.functions);
      const helperIndex = functions.findIndex(
        ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.helper",
      );
      const leafIndex = functions.findIndex(
        ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.leaf",
      );
      expect(helperIndex).toBeGreaterThanOrEqual(0);
      expect(leafIndex).toBeGreaterThanOrEqual(0);
      const variants = records(functions[helperIndex]?.entryVariants);
      expect(variants.length).toBeGreaterThanOrEqual(2);
      const contexts = records(debug.contexts);
      const callOffset = source.indexOf(callExpression);
      expect(callOffset).toBeGreaterThanOrEqual(0);
      const startByte = Buffer.byteLength(source.slice(0, callOffset), "utf8");
      const callSite = {
        sourceIndex,
        startByte,
        endByte: startByte + Buffer.byteLength(callExpression, "utf8"),
      };
      for (let entryVariantIndex = 0; entryVariantIndex < variants.length; entryVariantIndex += 1) {
        const entries = contexts
          .map((context, index) => ({ context, index }))
          .filter(
            ({ context }) =>
              context.kind === "entry" &&
              context.functionIndex === helperIndex &&
              context.entryVariantIndex === entryVariantIndex,
          );
        expect(entries, `Entry evidence for helper variant ${entryVariantIndex}`).toHaveLength(1);
        const parentContextIndex = entries[0]!.index;
        const calls = contexts.filter(
          (context) =>
            context.kind === "call" &&
            context.functionIndex === leafIndex &&
            context.parentContextIndex === parentContextIndex,
        );
        expect(calls, `Leaf call evidence for helper variant ${entryVariantIndex}`).toEqual([
          { kind: "call", functionIndex: leafIndex, parentContextIndex, callSite },
        ]);
      }
    });
  }, 60_000);

  // Parameter count is limited by actual frame resources, not an arbitrary language arity cap.
  it("builds a resource-fitting ordinary call with sixty-four byte parameters", async () => {
    const parameters = Array.from({ length: 64 }, (_, index) => `p${index}: byte`).join(", ");
    const argumentsList = Array.from({ length: 64 }, (_, index) => String(index)).join(", ");
    const source = [
      "module Game;",
      "const OUTPUT: word = $0400;",
      `function last(${parameters}): byte { return p63; }`,
      `function main(): void { poke(OUTPUT, last(${argumentsList})); }`,
    ].join("\n");
    await withBuild(source, (result) => {
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10171");
      expect(result.diagnostics.map(({ message }) => message).join("\n")).not.toMatch(
        /arity|parameter count|argument count|truncat/iu,
      );
    });
  }, 60_000);
});
