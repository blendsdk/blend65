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

  it("accepts a balanced vector update inside an IRQ handler", async () => {
    const result = await buildSource(
      [
        "module Game;",
        "import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function first(): void {}",
        "interrupt function second(): void { setIRQ(&first); restoreIRQ(); }",
        "function main(): void { setIRQ(&second); restoreIRQ(); }",
      ].join("\n"),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
  });

  it("accepts a balanced vector update in a helper reached from an IRQ handler", async () => {
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
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
  });

  it.each([false, true])(
    "keeps the unbounded self-install diagnostic across branch order %s",
    async (selfFirst) => {
      const first = selfFirst ? "setIRQ(&A);" : "setIRQ(&B);";
      const second = selfFirst ? "setIRQ(&B);" : "setIRQ(&A);";
      const result = await buildSource(
        [
          "module Game; import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function B(): void {}",
          `interrupt function A(): void { if (peek($0400) == 0) { ${first} } else { ${second} } }`,
          "function main(): void { setIRQ(&A); restoreIRQ(); }",
        ].join("\n"),
      );
      expect(result.kind).toBe("failure");
      expect(
        result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
      ).toEqual(["E10245"]);
    },
  );

  it("reports a helper's unbalanced self-install at its install site", async () => {
    const source = [
      "module Game; import { setIRQ, restoreIRQ } from c64.system;",
      "function installSelf(): void { setIRQ(&A); }",
      "interrupt function A(): void { installSelf(); }",
      "function main(): void { setIRQ(&A); restoreIRQ(); }",
    ].join("\n");
    const result = await buildSource(source);
    expect(result.kind).toBe("failure");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
    const span = errors[0]?.primarySpan;
    expect(span).not.toBeNull();
    expect(source.slice(span!.start, span!.end)).toBe("setIRQ(&A)");
  });

  it.each([false, true])(
    "reports a helper's conditional unbalanced self-install in branch order %s",
    async (selfFirst) => {
      const first = selfFirst ? "setIRQ(&A);" : "setIRQ(&B);";
      const second = selfFirst ? "setIRQ(&B);" : "setIRQ(&A);";
      const source = [
        "module Game; import { setIRQ, restoreIRQ } from c64.system;",
        "interrupt function B(): void {}",
        `function installChoice(): void { if (peek($0400) == 0) { ${first} } else { ${second} } }`,
        "interrupt function A(): void { installChoice(); }",
        "function main(): void { setIRQ(&A); restoreIRQ(); }",
      ].join("\n");
      const result = await buildSource(source);
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10245"]);
      const span = errors[0]?.primarySpan;
      expect(span).not.toBeNull();
      expect(source.slice(span!.start, span!.end)).toBe("setIRQ(&A)");
    },
  );

  it("points an unbounded nested IRQ route at its handler and selected installs", async () => {
    const source = [
      "module Game; import { setIRQ, restoreIRQ } from c64.system;",
      "interrupt function B(): void {}",
      "interrupt function A(): void { setIRQ(&B); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }",
      "function main(): void { setIRQ(&A); asm_cli(); asm_nop(); asm_sei(); restoreIRQ(); }",
    ].join("\n");
    const result = await buildSource(source);
    expect(result.kind).toBe("failure");
    const diagnostic = result.diagnostics.find(({ code }) => code === "E10245");
    expect(diagnostic).toBeDefined();
    const primary = diagnostic?.primarySpan;
    expect(primary).not.toBeNull();
    expect(source.slice(primary!.start, primary!.end)).toContain("interrupt function A");
    const related = diagnostic?.related.map(({ span }) => source.slice(span.start, span.end));
    expect(related).toEqual(expect.arrayContaining(["setIRQ(&A)", "setIRQ(&B)"]));
  });
});
