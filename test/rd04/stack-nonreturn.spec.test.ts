import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Balanced source status saves make the two handler candidates' depths explicit. */
function saves(count: number): string {
  return `${"asm_php(); ".repeat(count)}${"asm_plp(); ".repeat(count)}`;
}

describe("non-returning interrupt chain stack reachability", () => {
  // A chain tail is unreachable when its current handler never returns; masked installs and
  // restores prevent the older handler from running in either surrounding ownership interval.
  it("excludes the predecessor of a non-returning handler from the simultaneous peak", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-stack-nonreturn-"));
    const source = [
      "module Game;",
      "import { setIRQ, restoreIRQ } from c64.system;",
      `interrupt function older(): void { ${saves(210)} }`,
      "interrupt function newest(): void { while (true) { asm_nop(); } }",
      "function main(): void {",
      "  asm_sei(); asm_nop();",
      "  setIRQ(&older); setIRQ(&newest);",
      "  asm_cli(); asm_nop();",
      `  ${saves(20)}`,
      "  asm_sei(); asm_nop();",
      "  restoreIRQ(); restoreIRQ();",
      "}",
    ].join("\n");
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), source);
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "stack-nonreturn",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
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
      // Only main's twenty saves and the newest handler's seven entry bytes can overlap.
      expect(result.diagnostics.map(({ code }) => code)).not.toContain("E10238");
      expect(result.diagnostics.map(({ code }) => code)).not.toContain("W10180");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 60_000);
});
