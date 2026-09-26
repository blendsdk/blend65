import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { expect, it } from "vitest";

// Exercise readable boundaries in the same image as aggregates, calls, helpers and long branches.
it("keeps routine and placed-data boundaries readable in a combined backend build", async () => {
  const root = await mkdtemp(join(tmpdir(), "blend65-combined-assembly-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "assets/data.bin"), Uint8Array.of(13, 29, 47));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "combined",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        "struct Pair { first: byte; second: word; }",
        'place(at: $3000) const DATA: byte[] = embed("data.bin");',
        "place(at: $3100, align: 256) const MARK: byte = 91;",
        "let total: word = 0;",
        "zeropage { cursor: byte = 0; }",
        "function pair(value: byte): Pair { return { first: value, second: word(value) + 256 }; }",
        "function quotient(value: word, divisor: word): word { return value / divisor; }",
        "function main(): void {",
        "  let value: Pair = pair(DATA[0]);",
        "  total = quotient(value.second, word(peek($0400)) + 1);",
        "  while (cursor < 3) { poke($0420 + word(cursor), DATA[cursor]); cursor += 1; }",
        "  if (peek($0401) != 0) {",
        // Volatile writes make the branch long without imposing an algorithm on ordinary users.
        ...Array.from({ length: 40 }, (_, index) => `    poke($0500 + ${index}, MARK);`),
        "  }",
        "  poke($0423, value.first);",
        "}",
      ].join("\n"),
    );
    const result = await buildProject({ project: join(root, "blend65.json") });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected combined backend build");
    const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
    const labels = [...assembly.matchAll(/^([A-Za-z_][A-Za-z0-9_]*):\s*$/gm)].map(
      (match) => match[1]!,
    );
    expect(new Set(labels).size).toBe(labels.length);
    for (const name of ["main", "pair", "quotient", "DATA", "MARK"]) {
      expect(
        labels.some((label) => label.toLowerCase().includes(name.toLowerCase())),
        name,
      ).toBe(true);
      expect(assembly, `${name} boundary`).toMatch(new RegExp(`^\\s*;[^\\n]*${name}`, "mi"));
    }
    const image = await readFile(join(result.generation.directory, "combined.prg"));
    expect([...image.subarray(2 + 0x3000 - 0x0801, 2 + 0x3003 - 0x0801)]).toEqual([13, 29, 47]);
    expect(image[2 + 0x3100 - 0x0801]).toBe(91);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
