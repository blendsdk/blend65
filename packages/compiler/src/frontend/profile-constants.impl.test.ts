import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { C64_KERNAL_PROFILES, selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { ProjectSnapshot, SourceRecord } from "../project/types.js";
import { createProfileBindings, resolveProfileConstant } from "./profile-bindings.js";
import { selectFrontendProfile } from "./profile.js";
import { analyzeProject } from "./service.js";
import type { ModuleGraph } from "./semantic-types.js";

/** Build a loader-shaped immutable snapshot without introducing a project fixture layer. */
function snapshot(text: string, extra?: string): ProjectSnapshot {
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const source = (value: string, sourceId: string): SourceRecord =>
    Object.freeze({
      sourceId,
      text: value,
      sha256: hash(value),
      byteLength: Buffer.byteLength(value),
      resolvedPath: `/checkout/${sourceId}`,
    });
  const target = "c64-ntsc-prg-kernal-8580";
  return Object.freeze({
    manifest: Object.freeze({
      schemaVersion: 1,
      name: "profile-internals",
      sourceRoot: "src",
      entry: "Game",
      target,
      assetPaths: Object.freeze([]),
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    }),
    manifestSource: source("{}", "blend65.json"),
    sources: Object.freeze([
      source(text, "src/game.blend"),
      ...(extra === undefined ? [] : [source(extra, "src/profile.blend")]),
    ]),
    inputSha256: hash(text + (extra ?? "")),
    projectRoot: "/checkout",
    sourceRoot: "/checkout/src",
    assetPaths: Object.freeze([]),
    outDir: "/checkout/out",
    overrides: Object.freeze({ target: null, entry: null }),
    effectiveTarget: target,
    effectiveEntry: "Game",
  });
}

/** Select a declared profile, failing locally rather than hiding an invalid fixture. */
function profile(id = "c64-ntsc-prg-kernal-8580") {
  const result = selectFrontendProfile(id);
  if (result.kind !== "complete") throw new Error("Expected a declared cooperative profile");
  return result.profile;
}

describe("selected profile state internals", () => {
  it("keeps every shared fact row and declaration deeply immutable", () => {
    expect(Object.isFrozen(C64_KERNAL_PROFILES)).toBe(true);
    for (const facts of C64_KERNAL_PROFILES) {
      expect(Object.isFrozen(facts)).toBe(true);
      expect(selectC64KernalFacts(facts.id)).toBe(facts);
      expect(facts.clockHz * facts.frameRateFractionDenominator).toBe(
        facts.cyclesPerFrame *
          (facts.frameRateWhole * facts.frameRateFractionDenominator +
            facts.frameRateFractionNumerator),
      );
      const selected = profile(facts.id);
      expect(Object.isFrozen(selected)).toBe(true);
      expect(Object.isFrozen(selected.constants)).toBe(true);
      for (const item of selected.constants) {
        expect(Object.isFrozen(item)).toBe(true);
        expect(Object.isFrozen(item.type)).toBe(true);
      }
    }
  });

  it("rejects unknown facts and creates no state without a selected profile", () => {
    expect(selectC64KernalFacts("c64-ntsc")).toBeNull();
    expect(selectC64KernalFacts("C64-NTSC-PRG-KERNAL-8580")).toBeNull();
    expect(createProfileBindings(null)).toEqual([]);
  });

  it("preserves operation identities and gives each analysis fresh mutable reaching state", () => {
    const selected = profile();
    const first = createProfileBindings(selected);
    const second = createProfileBindings(selected);
    expect(first).toHaveLength(60);
    expect(Object.isFrozen(first)).toBe(true);
    first.forEach((state, index) => {
      expect(state).not.toBe(second[index]);
      expect(state.binding).toEqual(second[index]?.binding);
      expect(Object.isFrozen(state.binding)).toBe(true);
      expect(Object.isFrozen(state.binding.id.span)).toBe(true);
      expect(state.binding.id).toEqual({
        sourceId: `profile:${selected.id}`,
        span: { sourceId: `profile:${selected.id}`, start: index, end: index + 1 },
      });
      expect(state.binding.storage).toBe(index < 35 ? "function" : "constant");
      expect(state.readonly).toBe(index >= 35);
    });
    const lines = first.find(({ binding }) => binding.name === "rasterLines")!;
    lines.known = 1n;
    lines.initialized = false;
    expect(second.find(({ binding }) => binding.name === "rasterLines")).toMatchObject({
      known: 263n,
      initialized: true,
    });
    expect(
      createProfileBindings(profile("c64-pal-prg-kernal-6581")).find(
        ({ binding }) => binding.name === "rasterLines",
      )?.known,
    ).toBe(312n);
  });

  it("uses accepted import identity without letting early facts overwrite source declarations", () => {
    const states = createProfileBindings(profile());
    const lines = states.find(({ binding }) => binding.name === "rasterLines")!;
    const graph: ModuleGraph = {
      modules: [],
      bindings: [],
      imports: [
        {
          alias: "lines",
          binding: lines.binding.id,
          sourceSpan: { sourceId: "src/game.blend", start: 0, end: 5 },
        },
      ],
      entry: null,
    };
    expect(resolveProfileConstant(states, graph, "lines", "Game", "src/game.blend")).toBe(lines);
    expect(resolveProfileConstant(states, graph, "lines", "Game", "elsewhere.blend")).toBeNull();
    expect(
      resolveProfileConstant(
        states,
        { ...graph, bindings: [lines.binding] },
        "c64.profile.rasterLines",
        "Game",
        "src/game.blend",
      ),
    ).toBeNull();
  });
});

describe("ordinary constant semantics used by selected facts", () => {
  it.each(["foo as rasterLines", "rasterLines"])(
    "rejects a reserved profile-module import name: %s",
    (item) => {
      const text = `module c64.profile; import { ${item} } from Game; export const extra: word = rasterLines;`;
      const result = analyzeProject(
        snapshot(
          "module Game; import { extra } from c64.profile; export const foo: word = 7; export const rasterLines: word = 8; function main(): void {}",
          text,
        ),
      );
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10003",
        primarySpan: {
          sourceId: "src/profile.blend",
          start: text.indexOf("rasterLines"),
          end: text.indexOf("rasterLines") + 11,
        },
      });
    },
  );

  it.each([
    ["2825 * 1000 / 3419", 826n],
    ["65535 * 2 / 2", 65535n],
    ["256 / 2", 128n],
    ["word(2825 * 1000) / 3419", 2n],
    ["wrapped(2825)", 2n],
    ["(c64.profile.usesKernal ? c64.profile.rasterLines * 1000 : 0) / 1000", 263n],
  ])("keeps the existing constant or runtime arithmetic mode for %s", (expression, expected) => {
    const result = analyzeProject(
      snapshot(`module Game;
      comptime function wrapped(value: word): word { return value * 1000 / 3419; }
      const VALUE: word = ${expression}; function main(): void {}`),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected checked constant");
    expect(
      result.program.declarations.find((item) => item.initializer !== null)?.initializer?.constant,
    ).toBe(expected);
  });

  it.each(["==", "!="])("accepts early Boolean %s in direct and derived extents", (operator) => {
    const result = analyzeProject(
      snapshot(`module Game;
      const N: byte = c64.profile.isPal ${operator} true ? 2 : 3;
      let direct: byte[c64.profile.isPal ${operator} true ? 2 : 3]; let derived: byte[N];
      function main(): void {}`),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected checked extents");
    for (const binding of result.program.bindings.filter(({ name }) =>
      ["direct", "derived"].includes(name),
    )) {
      expect(binding.type).toMatchObject({ kind: "array", length: operator === "==" ? 3 : 2 });
    }
  });

  it.each([
    ["true", "E10162"],
    ["missing", "E10110"],
  ])("rejects invalid unselected extent arm %s", (arm, code) => {
    const result = analyzeProject(
      snapshot(`module Game;
        let data: byte[c64.profile.usesKernal ? 2 : ${arm}]; function main(): void {}`),
    );
    expect(result.kind).toBe("error");
    expect(
      result.diagnostics
        .filter(({ severity }) => severity === "error")
        .map((diagnostic) => diagnostic.code),
    ).toEqual([code]);
  });

  it("orders a source-only qualified dependency without a selective import", () => {
    const result = analyzeProject(
      snapshot(
        "module Game; const VALUE: word = c64.profile.extra; function main(): void {}",
        "module c64.profile; export const extra: word = rasterLines;",
      ),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected checked source contribution");
    expect(
      result.program.declarations
        .filter((item) => item.initializer !== null)
        .map((item) => item.initializer?.constant),
    ).toEqual([263n, 263n]);
  });

  it("keeps a lexical value root as ordinary struct field access", () => {
    const result = analyzeProject(
      snapshot(`module Game;
      struct Facts { rasterLines: word; } struct Holder { profile: Facts; }
      function main(): void { let c64: Holder = {profile: {rasterLines: 7}};
        let local: word = c64.profile.rasterLines; }`),
    );
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  });

  it("recognizes qualified constants in the ordinary zero-divisor diagnostic", () => {
    const result = analyzeProject(
      snapshot(`module Game; function main(): void {
      let bad: word = 1 / (c64.profile.rasterLines - c64.profile.rasterLines); }`),
    );
    expect(result.kind).toBe("error");
    expect(
      result.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code),
    ).toEqual(["E10160"]);
  });
});
