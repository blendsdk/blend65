import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";

async function put(root: string, name: string, content: string): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

async function buildArithmetic(body: readonly string[], divisionZeroCheck?: boolean) {
  const root = await mkdtemp(join(tmpdir(), "blend65-arithmetic-warnings-"));
  try {
    await put(
      root,
      "blend65.json",
      JSON.stringify({
        schemaVersion: 1,
        name: "arithmetic-warnings",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
        divisionZeroCheck,
      }),
    );
    await put(
      root,
      "src/game.blend",
      ["module Game;", "function main(): void {", ...body, "}"].join("\n"),
    );
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Arithmetic warning build did not succeed");
    return {
      diagnostics: built.diagnostics,
      assembly: await readFile(join(built.generation.directory, ".asm"), "utf8"),
    };
  } finally {
    await rm(root, { recursive: true });
  }
}

function warningCodes(
  diagnostics: readonly { readonly code: string; readonly severity: string }[],
) {
  return diagnostics
    .filter(({ code }) => /^W1017[0-3]$/u.test(code))
    .map(({ code, severity }) => ({ code, severity }));
}

function jsrCount(assembly: string): number {
  return [...assembly.matchAll(/^\s*jsr(?:\+\d+)?\s+\S+/gimu)].length;
}

describe("selected arithmetic warnings", () => {
  it("reports a software multiply warning for each variable operand width", async () => {
    const built = await buildArithmetic([
      "let a: byte = peek($0400); let b: byte = peek($0401);",
      "let wa: word = peekw($0402); let wb: word = peekw($0404);",
      "poke($0420, a * b); pokew($0421, wa * wb);",
    ]);
    expect(warningCodes(built.diagnostics)).toEqual([
      { code: "W10170", severity: "warning" },
      { code: "W10170", severity: "warning" },
    ]);
    const multiplyWarnings = built.diagnostics.filter(({ code }) => code === "W10170");
    for (const [index, width] of [8, 16].entries()) {
      const message = multiplyWarnings[index]?.message;
      const matched =
        /^Runtime multiply uses a software sequence of about ([1-9]\d*) cycles for (8|16)-bit operands$/u.exec(
          message ?? "",
        );
      expect(matched).not.toBeNull();
      expect(Number(matched?.[1])).toBeGreaterThan(0);
      expect(Number(matched?.[2])).toBe(width);
    }
  });

  it("warns for shift-and-add multiplication by three but not a power-of-two shift", async () => {
    const built = await buildArithmetic([
      "let value: byte = peek($0400);",
      "poke($0420, value * byte(3));",
      "poke($0421, value * byte(4));",
    ]);
    expect(warningCodes(built.diagnostics)).toEqual([{ code: "W10172", severity: "warning" }]);
    const message = built.diagnostics.find(({ code }) => code === "W10172")?.message ?? "";
    const matched =
      /^Multiply by 3 uses a shift-and-add sequence of about ([1-9]\d*) cycles — consider a power-of-two stride when practical$/u.exec(
        message,
      );
    expect(matched).not.toBeNull();
    expect(Number(matched?.[1])).toBeGreaterThan(0);
  });

  it("warns about an uncertain unchecked divisor and ties helper warnings to selected calls", async () => {
    const input = [
      "let numerator: byte = peek($0400); let divisor: byte = peek($0401);",
      "poke($0420, numerator / divisor);",
    ];
    const baseline = await buildArithmetic([
      "let numerator: byte = peek($0400); let divisor: byte = peek($0401);",
      "poke($0420, numerator + divisor);",
    ]);
    const unchecked = await buildArithmetic(input);
    const checked = await buildArithmetic(input, true);

    for (const built of [unchecked, checked]) {
      const helperSelected = jsrCount(built.assembly) > jsrCount(baseline.assembly);
      const helperWarnings = built.diagnostics.filter(({ code }) => code === "W10171");
      expect(helperWarnings).toHaveLength(helperSelected ? 1 : 0);
      if (helperSelected) {
        expect(helperWarnings[0]).toMatchObject({ code: "W10171", severity: "warning" });
        const matched =
          /^Runtime division or remainder uses a software sequence of about ([1-9]\d*) cycles for 8-bit operands$/u.exec(
            helperWarnings[0]?.message ?? "",
          );
        expect(matched).not.toBeNull();
        expect(Number(matched?.[1])).toBeGreaterThan(0);
      }
    }

    expect(checked.diagnostics.some(({ code }) => code === "W10173")).toBe(false);
    expect(unchecked.diagnostics.filter(({ code }) => code === "W10173")).toMatchObject([
      {
        code: "W10173",
        severity: "warning",
        message:
          "Runtime divisor 'divisor' is not proven nonzero — zero has an unspecified valid-width result; guard it or use '--division-zero-check'",
      },
    ]);
  });
});
