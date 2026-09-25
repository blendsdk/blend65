import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build one interrupt program through the same public entry used by developers. */
async function buildInterrupt(source: readonly string[]) {
  const root = await mkdtemp(join(tmpdir(), "blend65-interrupt-spec-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "interrupt-spec",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source.join("\n"));
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    return {
      result,
      assembly:
        result.kind === "success"
          ? await readFile(join(result.generation.directory, ".asm"), "utf8")
          : null,
    };
  } finally {
    await rm(root, { recursive: true });
  }
}

describe("C64 interrupt entry and ownership", () => {
  it("uses the KERNAL post-save chain without saving registers twice or returning directly", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      "interrupt function handler(): void { poke($D019, 1); }",
      "function main(): void { setIRQ(&handler); restoreIRQ(); }",
    ]);

    expect(
      built.result.kind,
      built.result.kind === "failure" ? JSON.stringify(built.result.diagnostics) : "",
    ).toBe("success");
    expect(built.assembly).toMatch(/^\s*php\s*\n\s*cld\b/imu);
    expect(built.assembly).toMatch(/^\s*plp\s*\n\s*jmp\s*\(/imu);
  });

  it("uses the declared firmware restore tail for an exclusive CINV handler", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { setIRQExclusive, restoreIRQ } from c64.system;",
      "interrupt function handler(): void { poke($D019, 1); }",
      "function main(): void { setIRQExclusive(&handler); restoreIRQ(); }",
    ]);

    expect(
      built.result.kind,
      built.result.kind === "failure" ? JSON.stringify(built.result.diagnostics) : "",
    ).toBe("success");
    expect(built.assembly).toMatch(/^\s*jmp\s+\$ea81\b/imu);
  });

  it("accepts balanced nested installs and restores", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      "interrupt function first(): void {}",
      "interrupt function second(): void {}",
      "function main(): void { setIRQ(&first); setIRQ(&second); restoreIRQ(); restoreIRQ(); }",
    ]);

    expect(
      built.result.kind,
      built.result.kind === "failure" ? JSON.stringify(built.result.diagnostics) : "",
    ).toBe("success");
  });

  it("rejects a restore without a matching installed predecessor", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { restoreIRQ } from c64.system;",
      "function main(): void { restoreIRQ(); }",
    ]);

    expect(built.result.kind).toBe("failure");
    expect(built.result.diagnostics.map(({ code }) => code)).toContain("E10278");
  });

  it("rejects unequal install ownership at a control-flow join", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      "interrupt function handler(): void {}",
      "function main(): void {",
      "  if (peek($0400) != 0) { setIRQ(&handler); }",
      "  restoreIRQ();",
      "}",
    ]);

    expect(built.result.kind).toBe("failure");
    expect(built.result.diagnostics.map(({ code }) => code)).toContain("E10278");
  });

  it("warns for a shared byte update and a shared word access across mainline and IRQ", async () => {
    const built = await buildInterrupt([
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      "let count: byte = 0; let position: word = 0;",
      "interrupt function handler(): void { count += 1; position += 1; }",
      "function main(): void {",
      "  setIRQ(&handler);",
      "  count += 1; position += 1;",
      "  restoreIRQ();",
      "}",
    ]);

    expect(
      built.result.kind,
      built.result.kind === "failure" ? JSON.stringify(built.result.diagnostics) : "",
    ).toBe("success");
    expect(built.result.diagnostics.map(({ code }) => code)).toContain("W10211");
    expect(built.result.diagnostics.map(({ code }) => code)).toContain("W10212");
  });
});
