import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "../index.js";

/** Compile a small C64 program to check interrupt-domain diagnostics. */
async function buildSource(source: string) {
  const root = await mkdtemp(join(tmpdir(), "blend65-handler-update-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "handler-update",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source);
    return await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
  } finally {
    await rm(root, { recursive: true });
  }
}

describe("IRQ handler vector updates", () => {
  it("rejects a balanced vector update inside an IRQ handler", async () => {
    const result = await buildSource(
      [
        "module Game;",
        "import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function first(): void {}",
        "interrupt function second(): void { setIRQ(&first); restoreIRQ(); }",
        "function main(): void { setIRQ(&second); restoreIRQ(); }",
      ].join("\n"),
    );
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "E10245",
            message: expect.stringContaining("during interrupt execution"),
          }),
        ]),
      );
    }
  });

  it("rejects a vector update in a helper reached from an IRQ handler", async () => {
    const result = await buildSource(
      [
        "module Game;",
        "import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function first(): void {}",
        "function replace(): void { setIRQ(&first); restoreIRQ(); }",
        "interrupt function second(): void { replace(); }",
        "function main(): void { setIRQ(&second); restoreIRQ(); }",
      ].join("\n"),
    );
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.diagnostics.map(({ code }) => code)).toContain("E10245");
    }
  });
});
