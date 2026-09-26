import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

const platform = "c64-pal-prg-kernal-6581";

/** Balanced status saves expose an exact hardware-stack peak. */
function saves(count: number): string {
  return `${"asm_php(); ".repeat(count)}${"asm_plp(); ".repeat(count)}`;
}

/** Repeat equivalent installation choices across four ordinary call levels. */
function program(exclusive: boolean, distinctHandler = false): string {
  const install = exclusive ? "setIRQExclusive" : "setIRQ";
  const levels = Array.from({ length: 4 }, (_, level) => {
    const callee = level === 0 ? "leaf" : `level${level - 1}`;
    const alternative = distinctHandler && level === 0 ? "deeperIRQ" : "onIRQ";
    return `function level${level}(): void {
      if (peek($c000) == 0) {
        ${install}(&onIRQ); ${callee}(); restoreIRQ();
      } else {
        ${install}(&${alternative}); ${callee}(); restoreIRQ();
      }
    }`;
  });
  return [
    "module Game;",
    "import { setIRQ, setIRQExclusive, restoreIRQ } from c64.system;",
    "interrupt function onIRQ(): void {}",
    ...(distinctHandler ? [`interrupt function deeperIRQ(): void { ${saves(20)} }`] : []),
    `function leaf(): void { ${saves(190)} }`,
    ...levels,
    "function main(): void { asm_cli(); asm_nop(); level3(); }",
  ].join("\n");
}

/** Build through the public API and check the complete stack warning. */
async function expectPeak(source: string, peak: number, entries: number, pushes: number) {
  const root = await mkdtemp(join(tmpdir(), "blend65-stack-equivalent-contexts-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-equivalent-contexts",
        sourceRoot: "src",
        entry: "Game",
        target: platform,
        outDir: "out",
        optimization: "none",
      }),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toBe(
      `Maximum simultaneous hardware-stack use is ${peak} bytes on '${platform}'; usable capacity is 236 (calls 10, interrupt entries ${entries}, explicit pushes ${pushes})`,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("hardware-stack peaks across equivalent interrupt contexts", () => {
  // Five live JSR returns, 190 status saves, and one chained entry: 10 + 190 + 7.
  it("preserves the exact peak for equivalent chained installation choices", async () => {
    await expectPeak(program(false), 207, 7, 190);
  }, 60_000);

  // An exclusive source-body entry costs one byte less than its chained counterpart.
  it("preserves the distinct peak for equivalent exclusive installation choices", async () => {
    await expectPeak(program(true), 206, 6, 190);
  }, 60_000);

  // The deeper reachable handler adds 20 saves while predecessor bodies remain sequential.
  it("retains the deeper handler when one installation choice changes its identity", async () => {
    await expectPeak(program(false, true), 227, 7, 210);
  }, 60_000);
});
