import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "../services/services.js";
import { validateDebugEvidence } from "./evidence.js";

describe("unambiguous ACME indirect operands", () => {
  it.each(["none", "size"] as const)(
    "should spell indirect byte loads and stores without a redundant width suffix in %s",
    async (optimization) => {
      const root = await mkdtemp(
        join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "acme-indirect-spelling-"),
      );
      const source = "module Game;function main():void{poke(peekw($C120),peek(peekw($C122)));}";
      try {
        await mkdir(join(root, "src"));
        await writeFile(join(root, "src/game.blend"), source);
        const project = join(root, "blend65.json");
        await writeFile(
          project,
          JSON.stringify({
            schemaVersion: 1,
            name: "indirect-spelling",
            sourceRoot: "src",
            entry: "Game",
            target: "c64-pal-prg-kernal-6581",
            outDir: "out",
            optimization,
          }),
        );
        const built = await buildProject({ project });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a real indirect-address build");
        const directory = built.generation.directory;
        const assembly = await readFile(join(directory, ".asm"), "utf8");
        const prg = await readFile(join(directory, built.generation.primaryArtifact));
        const decoded = validateDebugEvidence(await readFile(join(directory, ".debug.json")));
        if (decoded.kind !== "complete") throw new Error("Expected actual source ranges");
        const mainIndex = decoded.value.functions.findIndex(
          ({ qualifiedName }) => qualifiedName === "src/game.blend::Game.main",
        );
        const opcodes = decoded.value.ranges.flatMap((range) => {
          const owner = range.owner;
          const machine = range.machine;
          if (
            typeof owner !== "object" ||
            owner === null ||
            Array.isArray(owner) ||
            typeof machine !== "object" ||
            machine === null ||
            Array.isArray(machine) ||
            !("functionIndex" in owner) ||
            !("start" in machine) ||
            owner.functionIndex !== mainIndex ||
            typeof machine.start !== "number"
          )
            return [];
          const offset = machine.start - prg.readUInt16LE(0) + 2;
          return [prg[offset]];
        });
        // These NMOS forms have only a one-byte pointer operand. Parentheses and
        // the index register already determine their encoding without a suffix.
        expect(opcodes).toContain(0xb1);
        expect(opcodes).toContain(0x91);
        expect(assembly).toMatch(/^\s+lda \(\$[0-9a-f]{2}\),y$/mu);
        expect(assembly).toMatch(/^\s+sta \(\$[0-9a-f]{2}\),y$/mu);
        expect(assembly).not.toMatch(/^\s+(?:lda|sta)\+[12] \([^\n]+\),y$/mu);
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
