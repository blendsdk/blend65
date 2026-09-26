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
  it.each(["poke($0314, 0);", "poke($0315, 0);", "pokew($0313, 0);", "pokew($0315, 0);"])(
    "invalidates an owned vector after the overlapping raw write %s",
    async (write) => {
      const result = await buildSource(
        [
          "module Game; import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function handler(): void {}",
          `function overwrite(): void { ${write} }`,
          "function main(): void { setIRQ(&handler); overwrite(); restoreIRQ(); }",
        ].join("\n"),
      );
      expect(result.kind).toBe("failure");
      expect(result.diagnostics.map(({ code }) => code)).toContain("E10278");
    },
  );

  it("preserves IRQ ownership when a raw write does not touch its selected vector", async () => {
    const result = await buildSource(
      [
        "module Game; import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function handler(): void {}",
        "function main(): void { setIRQ(&handler); poke($0313, 0); poke($0316, 0); restoreIRQ(); }",
      ].join("\n"),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
  });

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
            message: expect.stringContaining(
              "can overlap or consume hardware stack without a static bound",
            ),
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
