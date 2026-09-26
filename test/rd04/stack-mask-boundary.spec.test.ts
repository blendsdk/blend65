import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Keep every build isolated while varying only the operation between CLI and the first PLP. */
async function withBuild(
  between: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-stack-mask-boundary-"));
  const source = [
    "module Game;",
    "import { setIRQ, restoreIRQ } from c64.system;",
    "const OUTPUT: word = $0400;",
    `interrupt function onIRQ(): void { ${"asm_php(); ".repeat(10)}${"asm_plp(); ".repeat(10)} }`,
    "function main(): void {",
    "  asm_sei(); asm_nop(); setIRQ(&onIRQ);",
    `  ${"asm_php(); ".repeat(220)}`,
    `  asm_cli(); ${between}`,
    `  ${"asm_plp(); ".repeat(220)}`,
    "  restoreIRQ();",
    "}",
  ].join("\n");
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-mask-boundary",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    inspect(await buildProject({ project: join(root, "blend65.json"), optimization: "none" }));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("NMOS IRQ recognition at instruction boundaries", () => {
  // CLI and PLP use their old I flag for recognition. CLI cannot admit IRQ here; the first PLP
  // can, after popping one byte: 219 main saves + 7 entry bytes + 10 handler saves = 236.
  // VICE's primary CPU model preserves this old-I distinction in its CLI/PLP/SEI handlers:
  // https://raw.githubusercontent.com/VICE-Team/svn-mirror/main/vice/src/6510core.c
  it.each([
    ["the immediately following PLP", ""],
    ["a discarded compile-time value followed by PLP", "1;"],
  ])(
    "reports exactly 236 bytes with %s",
    async (_name, between) => {
      await withBuild(between, (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
        expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
        const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.message).toBe(
          "Maximum simultaneous hardware-stack use is 236 bytes on 'c64-pal-prg-kernal-6581'; usable capacity is 236 (calls 0, interrupt entries 7, explicit pushes 229)",
        );
      });
    },
    60_000,
  );

  // An actual emitted instruction after CLI recognizes the enabled mask before a status byte is
  // pulled, so all 220 main saves remain live: 220 + 7 + 10 = 237, exceeding capacity by one.
  it.each([
    ["NOP", "asm_nop();"],
    ["a memory write", "poke(OUTPUT, 1);"],
  ])(
    "rejects a 237-byte peak when %s separates CLI from PLP",
    async (_name, between) => {
      await withBuild(between, (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ code: "E10238" });
        expect(errors[0]?.message).toMatch(
          /^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used 237, available 236 on 'c64-pal-prg-kernal-6581'$/u,
        );
        expect(result).not.toHaveProperty("generation");
      });
    },
    60_000,
  );
});
