import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const CODE = [
  "module Game;",
  "",
  "let value: byte = 1;",
  "function main(): void {",
  "    value = value + 1;",
  "}",
  "",
].join("\n");

/** Build one project whose only difference is a trailing source comment. */
async function buildWithComment(comment: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-rd09-zero-cost-"));
  roots.push(root);
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/game.blend"), `${CODE}${comment}\n`);
  const project = join(root, "blend65.json");
  await writeFile(
    project,
    JSON.stringify({
      schemaVersion: 1,
      name: "zero-cost",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  const built = await buildProject({ project });
  if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
  const read = (name: string) => readFile(join(built.generation.directory, name));
  return {
    primary: await read(built.generation.primaryArtifact),
    assembly: await read(".asm"),
    labels: await read(".labels"),
    memory: await read(".memory.json"),
    costs: await read(".costs.json"),
    debug: await read(".debug.json"),
  };
}

describe("zero target debug cost", () => {
  it("should keep every target artifact identical when host debug observation differs", async () => {
    const first = await buildWithComment("// first observation");
    const second = await buildWithComment("// second observation");
    expect(first.debug.equals(second.debug)).toBe(false);
    expect(first.primary.equals(second.primary)).toBe(true);
    expect(first.labels.equals(second.labels)).toBe(true);
    expect(first.memory.equals(second.memory)).toBe(true);
    expect(first.costs.equals(second.costs)).toBe(true);
    // Source comments are not target instructions. The assembler may retain
    // them as comments, so compare the emitted instruction stream.
    const instructions = (assembly: Buffer) =>
      assembly
        .toString("utf8")
        .split("\n")
        .filter((line) => line.trim().length > 0 && !line.trim().startsWith(";"))
        .join("\n");
    expect(instructions(first.assembly)).toBe(instructions(second.assembly));
  }, 30_000);
});
