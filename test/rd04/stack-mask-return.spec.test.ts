import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

/** Build and inspect one isolated public artifact generation with optimization disabled. */
async function withBuild(
  source: string,
  inspect: (result: Awaited<ReturnType<typeof buildProject>>) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-stack-mask-return-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-mask-return",
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

/** Main's saved disabled statuses keep the helper entry masked until its explicit CLI. */
function ordinarySource(helper: string, call: string): string {
  return [
    "module Game;",
    "import { setIRQ, restoreIRQ } from c64.system;",
    "const INPUT: word = $0400; const OUTPUT: word = $0401;",
    `interrupt function onIRQ(): void { ${"asm_php(); ".repeat(10)}${"asm_plp(); ".repeat(10)} }`,
    helper,
    "function main(): void {",
    "  asm_sei(); asm_nop(); setIRQ(&onIRQ);",
    `  ${"asm_php(); ".repeat(219)}`,
    `  ${call}`,
    `  ${"asm_plp(); ".repeat(219)}`,
    "  restoreIRQ();",
    "}",
  ].join("\n");
}

describe("IRQ mask delay through ordinary and interrupt returns", () => {
  // CLI still recognizes with disabled old I. The next instruction, bare RTS, removes its two
  // return bytes before recognition: 219 main saves + 7 entry bytes + 10 handler saves = 236.
  it("excludes the ordinary return address when bare RTS first permits IRQ recognition", async () => {
    await withBuild(
      ordinarySource("function enable(): void { asm_cli(); }", "enable();"),
      (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
        expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
        const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
        expect(warnings).toHaveLength(1);
        expect(warnings[0]?.message).toBe(
          "Maximum simultaneous hardware-stack use is 236 bytes on 'c64-pal-prg-kernal-6581'; usable capacity is 236 (calls 0, interrupt entries 7, explicit pushes 229)",
        );
      },
    );
  }, 60_000);

  // A volatile read materializes the byte return after CLI but before RTS, so recognition still
  // sees the helper's return address: 219 + 2 + 7 + 10 = 238 bytes, above usable capacity.
  it("charges the live return address when a byte result is read before RTS", async () => {
    await withBuild(
      ordinarySource(
        "function enable(): byte { asm_cli(); return peek(INPUT); }",
        "poke(OUTPUT, enable());",
      ),
      (result) => {
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
        const errors = result.diagnostics.filter(({ severity }) => severity === "error");
        expect(errors).toHaveLength(1);
        expect(errors[0]).toMatchObject({ code: "E10238" });
        expect(errors[0]?.message).toMatch(
          /^Target resource budget exceeded for '[^']*[Ss]tack[^']*' — used 238, available 236 on 'c64-pal-prg-kernal-6581'$/u,
        );
        expect(result).not.toHaveProperty("generation");
      },
    );
  }, 60_000);

  // Both selected epilogues execute an instruction before the old interrupt frame is unwound.
  // A final source CLI therefore admits another entry during that epilogue without a finite bound.
  it.each(["setIRQ", "setIRQExclusive"])(
    "rejects unbounded reentry when a returning %s handler ends with CLI",
    async (installer) => {
      await withBuild(
        [
          "module Game;",
          `import { ${installer}, restoreIRQ } from c64.system;`,
          "interrupt function onIRQ(): void { asm_cli(); }",
          `function main(): void { asm_cli(); asm_nop(); ${installer}(&onIRQ); asm_nop(); restoreIRQ(); }`,
        ].join("\n"),
        (result) => {
          expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
          expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([
            expect.objectContaining({ code: "E10245" }),
          ]);
          expect(result).not.toHaveProperty("generation");
        },
      );
    },
    60_000,
  );
});
