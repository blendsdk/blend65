import { describe, expect, it } from "vitest";
import type { AnalysisResult, TypedProgram } from "@blend65/compiler/frontend";
import { analyzeProfileSource } from "./profile-fixture.js";

const profiles = [
  { id: "c64-pal-prg-kernal-6581", lines: 312n, cycles: 63n, rate: 50124n, clock: 985n },
  { id: "c64-pal-prg-kernal-8580", lines: 312n, cycles: 63n, rate: 50124n, clock: 985n },
  { id: "c64-ntsc-prg-kernal-6581", lines: 263n, cycles: 65n, rate: 59826n, clock: 1022n },
  { id: "c64-ntsc-prg-kernal-8580", lines: 263n, cycles: 65n, rate: 59826n, clock: 1022n },
] as const;

/** Require fully checked frontend output, allowing ordinary unused-source warnings. */
function complete(result: AnalysisResult): TypedProgram {
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  if (result.kind !== "complete") throw new Error("Expected complete frontend analysis");
  return result.program;
}

/** Locate a source declaration through the public binding identity rather than array order. */
function declaration(program: TypedProgram, name: string) {
  const binding = program.bindings.find((item) => item.qualifiedName === `Game.${name}`);
  if (!binding) throw new Error(`Missing Game.${name}`);
  const value = program.declarations.find(
    (item) =>
      item.binding.sourceId === binding.id.sourceId &&
      item.binding.span.start === binding.id.span.start,
  );
  if (!value) throw new Error(`Missing typed declaration Game.${name}`);
  return value;
}

const forms = [
  {
    name: "qualified",
    imports: "",
    lines: "c64.profile.rasterLines",
    cycles: "c64.profile.cyclesPerLine",
  },
  {
    name: "selective",
    imports: "import { rasterLines, cyclesPerLine } from c64.profile;",
    lines: "rasterLines",
    cycles: "cyclesPerLine",
  },
  {
    name: "aliased",
    imports: "import { rasterLines as lines, cyclesPerLine as cycles } from c64.profile;",
    lines: "lines",
    cycles: "cycles",
  },
] as const;

describe.each(profiles)(
  "source profile constants for $id",
  ({ id, lines, cycles, rate, clock }) => {
    // The same scalar facts must be available before arrays, structs, enums and function headers.
    it.each(forms)("should resolve $name facts in all early constant consumers", async (form) => {
      const source = `module Game; ${form.imports}
      const LINES: word = ${form.lines}; const CYCLES: byte = ${form.cycles};
      let direct: byte[${form.lines}]; let derived: byte[LINES];
      struct Buffer { direct: byte[${form.lines}]; derived: byte[LINES]; }
      enum Timing { Direct = ${form.cycles}, Derived = CYCLES + 1 }
      const ENUM_DIRECT: byte = Timing.Direct; const ENUM_DERIVED: byte = Timing.Derived;
      function copy(values: byte[${form.lines}]): byte[${form.lines}] { return values; }
      function copyDerived(values: byte[LINES]): byte[LINES] { return values; }
      function main(): void {}`;
      const program = complete(await analyzeProfileSource(source, id));
      expect(declaration(program, "LINES").initializer?.constant).toBe(lines);
      expect(declaration(program, "CYCLES").initializer?.constant).toBe(cycles);
      for (const name of ["direct", "derived"]) {
        expect(declaration(program, name).type).toMatchObject({
          kind: "array",
          length: Number(lines),
          size: Number(lines),
        });
      }
      expect(
        program.bindings.find((item) => item.qualifiedName === "Game.Buffer")?.type,
      ).toMatchObject({
        kind: "struct",
        size: Number(lines) * 2,
        fields: [
          { name: "direct", type: { kind: "array", length: Number(lines) } },
          { name: "derived", type: { kind: "array", length: Number(lines) } },
        ],
      });
      for (const name of ["copy", "copyDerived"]) {
        expect(declaration(program, name).type).toMatchObject({
          kind: "array",
          length: Number(lines),
        });
      }
      const parameters = program.bindings.filter(
        (item) => item.name === "values" && item.storage === "parameter",
      );
      expect(parameters).toHaveLength(2);
      for (const parameter of parameters)
        expect(parameter.type).toMatchObject({ kind: "array", length: Number(lines) });
      expect(declaration(program, "ENUM_DIRECT").initializer?.constant).toBe(cycles);
      expect(declaration(program, "ENUM_DERIVED").initializer?.constant).toBe(cycles + 1n);
    });

    // Source contributions retain their ordinary exports while selected synthetic facts coexist.
    it.each(forms)(
      "should combine $name facts with an unrelated source profile export",
      async (form) => {
        const source = `module Game; ${form.imports} import { extra } from c64.profile;
      const LINES: word = ${form.lines}; let data: byte[${form.lines}];
      enum Timing { Line = ${form.cycles} } const CYCLE: byte = Timing.Line;
      const EXTRA: word = extra; const QUALIFIED: word = c64.profile.extra;
      function main(): void {}`;
        const program = complete(
          await analyzeProfileSource(
            source,
            id,
            "module c64.profile; export const extra: word = 7;",
          ),
        );
        expect(declaration(program, "LINES").initializer?.constant).toBe(lines);
        expect(declaration(program, "data").type).toMatchObject({
          kind: "array",
          length: Number(lines),
        });
        expect(declaration(program, "CYCLE").initializer?.constant).toBe(cycles);
        expect(declaration(program, "EXTRA").initializer?.constant).toBe(7n);
        expect(declaration(program, "QUALIFIED").initializer?.constant).toBe(7n);
      },
    );

    // Compile-time functions can read selected facts through ordinary constant lookup.
    it.each(forms)("should evaluate a compile-time function reading $name facts", async (form) => {
      const source = `module Game; ${form.imports}
      comptime function selectedLines(): word { return ${form.lines}; }
      const LINES: word = selectedLines(); function main(): void {}`;
      const program = complete(await analyzeProfileSource(source, id));
      expect(declaration(program, "LINES").initializer?.constant).toBe(lines);
      expect(program.calls).toEqual([]);
    });

    // Constant contexts retain full precision even when intermediate products exceed a word.
    it("should evaluate exact profile rates without narrowing intermediate products", async () => {
      const source = `module Game;
      const RATE: word = c64.profile.frameRateWhole * 1000 + c64.profile.frameRateFractionNumerator * 1000 / c64.profile.frameRateFractionDenominator;
      const CLOCK: word = c64.profile.cpuClockKilohertz; function main(): void {}`;
      const program = complete(await analyzeProfileSource(source, id));
      expect(declaration(program, "RATE").initializer?.constant).toBe(rate);
      expect(declaration(program, "CLOCK").initializer?.constant).toBe(clock);
    });

    // Child declarations shadow imports for expressions and extents, then the outer alias resumes.
    it.each(["let", "const"])(
      "should preserve lexical shadowing with a child %s",
      async (storage) => {
        const source = `module Game; import { rasterLines as lines } from c64.profile;
      function main(): void { const before: word = lines; {
        ${storage} lines: word = 7; let local: word = lines;
        const qualified: word = c64.profile.rasterLines;
        ${storage === "const" ? "let data: byte[lines];" : ""}
      } const after: word = lines; }`;
        const program = complete(await analyzeProfileSource(source, id));
        const statements = declaration(program, "main").body?.statements;
        const before = statements?.[0];
        const block = statements?.[1];
        const after = statements?.[2];
        expect(before?.kind).toBe("variable");
        expect(after?.kind).toBe("variable");
        if (before?.kind !== "variable" || after?.kind !== "variable" || block?.kind !== "block")
          throw new Error("Expected checked lexical blocks");
        expect(before.initializer?.constant).toBe(lines);
        expect(after.initializer?.constant).toBe(lines);
        const local = block.statements[1];
        const qualified = block.statements[2];
        if (local?.kind !== "variable" || qualified?.kind !== "variable")
          throw new Error("Expected local reads");
        expect(local.initializer?.constant).toBe(7n);
        expect(qualified.initializer?.constant).toBe(lines);
        if (storage === "const")
          expect(block.statements[3]).toMatchObject({
            kind: "variable",
            type: { kind: "array", length: 7 },
          });
      },
    );
  },
);

describe("independent profile snapshots", () => {
  const source =
    "module Game; const LINES: word = c64.profile.rasterLines; let data: byte[c64.profile.rasterLines]; function main(): void {}";

  /** Check both late constant evaluation and early extent preparation in a retained result. */
  function check(result: AnalysisResult, lines: bigint) {
    const program = complete(result);
    expect(declaration(program, "LINES").initializer?.constant).toBe(lines);
    expect(declaration(program, "data").type).toMatchObject({
      kind: "array",
      length: Number(lines),
    });
  }

  // Repeated selection cannot mutate earlier results or retain another target's facts.
  it("should keep PAL then NTSC then PAL analyses isolated", async () => {
    const first = await analyzeProfileSource(source, "c64-pal-prg-kernal-6581");
    const second = await analyzeProfileSource(source, "c64-ntsc-prg-kernal-8580");
    const third = await analyzeProfileSource(source, "c64-pal-prg-kernal-6581");
    check(first, 312n);
    check(second, 263n);
    check(third, 312n);
    expect(third.diagnostics).toEqual(first.diagnostics);
  });

  // Concurrent frontends must own their selected facts independently.
  it("should isolate concurrent PAL and NTSC analyses", async () => {
    const [pal, ntsc] = await Promise.all([
      analyzeProfileSource(source, "c64-pal-prg-kernal-8580"),
      analyzeProfileSource(source, "c64-ntsc-prg-kernal-6581"),
    ]);
    check(pal, 312n);
    check(ntsc, 263n);
  });
});
