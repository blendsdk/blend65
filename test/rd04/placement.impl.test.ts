import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Qualify a placed helper through the real assembler and PRG reconciliation path. */
describe("source function placement", () => {
  it("assembles reverse-ordered fixed code with data in the gaps", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-sparse-placement-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "sparse-placement",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; place(at: $3000) function high(): void { poke($0401, 2); } place(at: $2000) function low(): void { poke($0400, 1); } place(at: $2100) const MID: byte = 7; const AUTO: byte[2] = [3, 4]; function main(): void { low(); high(); poke($0402, MID); poke($0403, AUTO[0]); }",
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") throw new Error("Expected a sparse placed build");
      const image = await readFile(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      expect(image[2 + 0x2100 - 0x0801]).toBe(7);
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("keeps a fixed helper address in a complete C64 build", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-placed-helper-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "placed-helper",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; place(at: $2000, align: 256) function helper(): void { poke($0400, 1); } function main(): void { helper(); }",
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("keeps zero-page declarations out of the resident data image", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-zero-page-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "zero-page",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; zeropage { counter: byte; } place(at: $2000) function main(): void { counter = 1; poke($0400, counter); }",
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
    } finally {
      await rm(root, { recursive: true });
    }
  });

  it("reserves explicit user zero page before pointer scratch and uses short instructions", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-user-zero-page-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "user-zero-page",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        "module Game; zeropage { place(at: $02) counter: byte; } function main(): void { let address: word = $0400; counter = 1; poke(address, counter); }",
      );
      const result = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(result.kind, result.kind === "failure" ? JSON.stringify(result.diagnostics) : "").toBe(
        "success",
      );
      if (result.kind !== "success") throw new Error("Expected a zero-page build");
      const assembly = await readFile(join(result.generation.directory, ".asm"), "utf8");
      const memory = await readFile(join(result.generation.directory, ".memory.json"), "utf8");
      expect(assembly).toMatch(/sta\+1\s+b65_[0-9a-f]+/iu);
      expect(assembly).toMatch(/lda\+1\s+b65_[0-9a-f]+/iu);
      expect(memory).toContain('"start":2');
      expect(memory).not.toContain('"start":2,"end":3,"kind":"sfa"');
    } finally {
      await rm(root, { recursive: true });
    }
  });
});
