import { describe, expect, it } from "vitest";
import { analyzeProfileSource, profileSpan } from "./profile-fixture.js";

const profiles = [
  { id: "c64-pal-prg-kernal-6581", lines: 312n },
  { id: "c64-pal-prg-kernal-8580", lines: 312n },
  { id: "c64-ntsc-prg-kernal-6581", lines: 263n },
  { id: "c64-ntsc-prg-kernal-8580", lines: 263n },
] as const;

describe.each(profiles)("profile diagnostics for $id", ({ id, lines }) => {
  // Synthetic scalar constants obey the ordinary readonly and no-storage rules.
  it.each([
    {
      name: "qualified assignment",
      imports: "",
      body: "c64.profile.rasterLines = 1;",
      code: "E10192",
      proof: "c64.profile.rasterLines",
    },
    {
      name: "aliased assignment",
      imports: "import { rasterLines as lines } from c64.profile;",
      body: "lines = 1;",
      code: "E10192",
      proof: "lines",
      occurrence: 1,
    },
    {
      name: "qualified address",
      imports: "",
      body: "pokew($0400, &c64.profile.rasterLines);",
      code: "E10040",
      proof: "&c64.profile.rasterLines",
    },
    {
      name: "aliased address",
      imports: "import { rasterLines as lines } from c64.profile;",
      body: "pokew($0400, &lines);",
      code: "E10040",
      proof: "&lines",
    },
  ])("should reject $name at its exact source proof", async (testCase) => {
    const source = `module Game; ${testCase.imports} /* £ */ function main(): void { ${testCase.body} }`;
    const result = await analyzeProfileSource(source, id);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
    expect(errors[0]).toMatchObject({
      code: testCase.code,
      severity: "error",
      pointer: null,
      primarySpan: profileSpan(source, testCase.proof, testCase.occurrence ?? 0),
    });
  });

  // Full-precision constants exceeding a byte fail at their initializer without wrapping.
  it("should reject raster lines as a byte with the exact selected value", async () => {
    const source =
      "module Game; /* £ */ const lines: byte = c64.profile.rasterLines; function main(): void {}";
    const result = await analyzeProfileSource(source, id);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10084",
      severity: "error",
      pointer: null,
      message: `Value ${lines} is out of range for type 'byte' (0–255)`,
      primarySpan: profileSpan(source, "c64.profile.rasterLines"),
    });
  });

  // The same selected value is legal when the declaration provides sufficient width.
  it("should accept raster lines as a word without a range diagnostic", async () => {
    const source =
      "module Game; const lines: word = c64.profile.rasterLines; function main(): void {}";
    const result = await analyzeProfileSource(source, id);
    expect(result.kind).toBe("complete");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (result.kind !== "complete") throw new Error("Expected complete word declaration");
    expect(
      result.program.declarations.find((item) => item.initializer !== null)?.initializer?.constant,
    ).toBe(lines);
  });

  // An actual profile module does not make unknown synthetic names into exported declarations.
  it.each([false, true])(
    "should reject a missing import with source contribution %s",
    async (mixed) => {
      const source = "module Game; import { missing } from c64.profile; function main(): void {}";
      const result = await analyzeProfileSource(
        source,
        id,
        mixed ? "module c64.profile; export const extra: word = 7;" : undefined,
      );
      expect(result.kind).toBe("error");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10012",
        severity: "error",
        pointer: null,
        message: "'missing' is not exported from module 'c64.profile'",
        primarySpan: profileSpan(source, "missing"),
      });
    },
  );

  // Profile membership never grants export visibility to private source declarations.
  it("should reject a private source member imported from the profile namespace", async () => {
    const source = "module Game; import { extra } from c64.profile; function main(): void {}";
    const other = "module c64.profile; const extra: word = 7;";
    const result = await analyzeProfileSource(source, id, other);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10012",
      severity: "error",
      pointer: null,
      message: "'extra' is not exported from module 'c64.profile'",
      primarySpan: profileSpan(source, "extra"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([
      profileSpan(other, "extra", 0, "src/profile.blend"),
    ]);
  });

  // Qualified access must enforce the same source export boundary as a selective import.
  it("should reject a qualified private member of the profile namespace", async () => {
    const source = "module Game; const VALUE: word = c64.profile.extra; function main(): void {}";
    const other = "module c64.profile; const extra: word = 7;";
    const result = await analyzeProfileSource(source, id, other);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10012",
      severity: "error",
      pointer: null,
      message: "'extra' is not exported from module 'c64.profile'",
      primarySpan: profileSpan(source, "c64.profile.extra"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([
      profileSpan(other, "extra", 0, "src/profile.blend"),
    ]);
  });

  // The second import alias cannot overwrite the first, with or without source contributions.
  it.each([false, true])(
    "should reject duplicate import aliases with source contribution %s",
    async (mixed) => {
      const source =
        "module Game; import { rasterLines as lines, cyclesPerLine as lines } from c64.profile; function main(): void {}";
      const result = await analyzeProfileSource(
        source,
        id,
        mixed ? "module c64.profile; export const extra: word = 7;" : undefined,
      );
      expect(result.kind).toBe("error");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10003"]);
      expect(errors[0]).toMatchObject({
        severity: "error",
        pointer: null,
        primarySpan: profileSpan(source, "lines", 1),
      });
    },
  );

  // A profile namespace remains reserved only at its actual synthetic member names.
  it.each(["", "export const extra: word = 7;"])(
    "should reject a reserved source definition beside %s",
    async (extra) => {
      const source =
        "module Game; import { rasterLines } from c64.profile; function main(): void {}";
      const other = `module c64.profile; export const rasterLines: word = 7; ${extra}`;
      const result = await analyzeProfileSource(source, id, other);
      expect(result.kind).toBe("error");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10003"]);
      expect(errors[0]).toMatchObject({
        severity: "error",
        pointer: null,
        primarySpan: profileSpan(other, "rasterLines", 0, "src/profile.blend"),
      });
    },
  );

  // Encoding failures retain the selected identity and the original multibyte source span.
  it("should name the selected profile for an unencodable screen character", async () => {
    const source = "module Game; const VALUE: byte = screen_codes('é'); function main(): void {}";
    const result = await analyzeProfileSource(source, id);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10249",
      severity: "error",
      pointer: null,
      message: `Encoding 'screen_codes' cannot represent literal character or escape 'é' as the required byte on platform '${id}' — select an available named encoding or use '\\xNN' for an exact byte`,
      primarySpan: profileSpan(source, "screen_codes('é')"),
      related: [],
    });
  });

  // Resident profiles cannot gain a loader simply by selecting a different video or SID model.
  it("should name the selected resident profile in the unavailable-loader diagnostic", async () => {
    const source =
      "module Game; loadable const DATA: byte[2] = [1, 2]; let target: byte[2]; function main(): void { c64.loader.load(DATA, target); }";
    const result = await analyzeProfileSource(source, id);
    expect(result.kind).toBe("error");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10275",
      severity: "error",
      pointer: null,
      message: expect.stringContaining(id),
      primarySpan: profileSpan(source, "c64.loader.load(DATA, target)"),
    });
    expect(errors[0]?.message).toMatch(/^Cannot load 'DATA' into 'target' — .+$/u);
    expect(errors[0]?.related).toEqual([]);
  });
});

describe("profile branches remain semantically checked", () => {
  // A false profile condition cannot suppress a source-level constant range error.
  it.each(["c64-ntsc-prg-kernal-6581", "c64-ntsc-prg-kernal-8580"])(
    "should reject invalid source inside a PAL-only branch on %s",
    async (id) => {
      const source =
        "module Game; function main(): void { if (c64.profile.isPal) { const tooLarge: byte = 300; } }";
      const result = await analyzeProfileSource(source, id);
      expect(result.kind).toBe("error");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10084",
        severity: "error",
        pointer: null,
        message: "Value 300 is out of range for type 'byte' (0–255)",
        primarySpan: profileSpan(source, "300"),
      });
    },
  );
});
