import { checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { analyzeProfileSource, profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

const operations = [
  "readAndClearSpriteSpriteCollisions",
  "readAndClearSpriteBackgroundCollisions",
] as const;

/** Keep each observation in ordinary source so no interrupt-ownership handoff is implied. */
function sampleSource(operation: string, argumentsText = ""): string {
  return `module Game;
function main(): void {
  let participants: byte = c64.vic.${operation}(${argumentsText});
  poke($0400, participants);
}`;
}

/** Require the exact root error rather than accepting a missing operation as an arity failure. */
async function expectDiagnostic(source: string, code: string, proof: string) {
  await withProfileProject(source, profiles[0], async (project) => {
    const result = await checkProject({ project });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code: actual }) => actual)).toEqual([code]);
    expect(errors[0]).toMatchObject({
      code,
      severity: "error",
      primarySpan: profileSpan(source, proof),
    });
  });
}

describe.each(profiles)("VIC collision source API on %s", (profile) => {
  // Each operation is a zero-argument, unsigned byte observation with a consuming volatile effect.
  it.each(operations)(
    "should accept an unsigned byte volatile read when %s is called without arguments",
    async (operation) => {
      const source = sampleSource(operation);
      const result = await analyzeProfileSource(source, profile);
      expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
      expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
      if (result.kind !== "complete")
        throw new Error("Expected complete collision source analysis");
      const binding = result.program.bindings.find(
        ({ qualifiedName }) => qualifiedName === `c64.vic.${operation}`,
      );
      expect(binding).toMatchObject({
        operationEffect: "volatile-read",
      });
      const main = result.program.bindings.find(
        ({ qualifiedName }) => qualifiedName === "Game.main",
      );
      expect(main).toBeDefined();
      const declaration = result.program.declarations.find(
        ({ binding: id }) => JSON.stringify(id) === JSON.stringify(main!.id),
      );
      const sample = declaration?.body?.statements[0];
      expect(sample?.kind).toBe("variable");
      if (sample?.kind !== "variable") throw new Error("Expected the source-owned sample variable");
      expect(sample.initializer).toMatchObject({
        type: { kind: "scalar", name: "byte" },
        integer: { width: 8, signed: false },
        signature: { parameters: [], returnType: { kind: "scalar", name: "byte" } },
        arguments: [],
      });
      const effects = result.program.effects.find(
        ({ function: id }) => JSON.stringify(id) === JSON.stringify(main!.id),
      );
      expect(effects).toMatchObject({ operationEffects: ["volatile-read"] });
    },
  );
});

describe("VIC collision source diagnostics", () => {
  // An extra argument must reach the recognized zero-argument signature, not fail name resolution.
  it.each(operations)(
    "should report the arity error when %s receives an extra argument",
    async (operation) => {
      const call = `c64.vic.${operation}(1)`;
      await expectDiagnostic(sampleSource(operation, "1"), "E10171", call);
    },
  );

  // Misspelled public operations must retain the ordinary module-export diagnostic.
  it.each(operations)("should report the export error when %s is misspelled", async (operation) => {
    const misspelled = `${operation}Typo`;
    await expectDiagnostic(sampleSource(misspelled), "E10012", `c64.vic.${misspelled}`);
  });

  // A collision operation cannot turn an unsupported profile selection into a qualified target.
  it("should report the profile error when a collision read selects an unsupported target", async () => {
    await withProfileProject(
      sampleSource(operations[0]),
      "c64-pal-prg-kernal-unknown",
      async (project) => {
        const result = await checkProject({ project });
        expect(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
        expect(
          result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
        ).toEqual(["E10279"]);
      },
    );
  });
});
