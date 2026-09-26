import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkProject } from "@blend65/compiler";
import { analyzeProjectOverlay, loadProject } from "@blend65/compiler/frontend";
import { describe, expect, it } from "vitest";
import { analyzeDiagnosticSource, diagnosticSpan } from "./diagnostic-fixture.js";

/** Supply real source and asset files so public project analysis owns every emitted record. */
async function withProject(
  source: string,
  other: string | null,
  inspect: (result: Awaited<ReturnType<typeof analyzeProjectOverlay>>, root: string) => void,
) {
  const root = await mkdtemp(join(tmpdir(), "blend65-project-records-"));
  try {
    await mkdir(join(root, "src"));
    await mkdir(join(root, "assets"));
    await writeFile(join(root, "src/game.blend"), source);
    if (other !== null) await writeFile(join(root, "src/other.blend"), other);
    await writeFile(join(root, "assets/data.bin"), Uint8Array.of(7, 8));
    await writeFile(join(root, "assets/empty.bin"), new Uint8Array());
    await writeFile(join(root, "assets/bad.spd"), Uint8Array.of(1, 2, 3));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "project-records",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: ["assets"],
        outDir: "out",
        optimization: "none",
      }),
    );
    const loaded = await loadProject({ cwd: root });
    if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
    inspect(await analyzeProjectOverlay(loaded.snapshot, []), root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

const assetCases = [
  {
    code: "E10131",
    declarations: 'const DATA: byte[] = embed("empty.bin");',
    proof: 'embed("empty.bin")',
    message: "Embedded file 'empty.bin' is empty",
  },
  {
    code: "E10136",
    declarations: 'const PATH: byte[8] = "data.bin"; const DATA: byte[] = embed(PATH);',
    proof: "PATH",
    occurrence: 1,
    message: "'embed()' path must be a string literal",
  },
  {
    code: "E10137",
    declarations: 'const DATA: byte[] = embed("data.bin", "sprites");',
    proof: 'embed("data.bin", "sprites")',
    message: "No format handler is registered for extension '.bin' with selector 'sprites'",
  },
  {
    code: "E10250",
    declarations: 'const KEY: byte[7] = "sprites"; const DATA: byte[] = embed("data.bin", KEY);',
    proof: "KEY",
    occurrence: 1,
    message: "'embed()' selector must be a string literal — found 'KEY'",
  },
] as const;

describe("canonical project asset failures", () => {
  // Asset failures stay associated with the call or argument that requested the rejected input.
  it.each(assetCases)("should report $code with the exact asset request", async (testCase) => {
    const source = `module Game; ${testCase.declarations} function main(): void {}`;
    await withProject(source, null, (result) => {
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors.map(({ code }) => code)).toEqual([testCase.code]);
      expect(errors[0]).toMatchObject({
        code: testCase.code,
        severity: "error",
        pointer: null,
        message: testCase.message,
        primarySpan: diagnosticSpan(
          source,
          testCase.proof,
          "occurrence" in testCase ? testCase.occurrence : 0,
        ),
        related: [],
      });
    });
  });

  // Search locations follow the source directory and configured asset directories, in that order.
  it("should report E10130 with the independently known ordered search paths", async () => {
    const source =
      'module Game; const DATA: byte[] = embed("missing.bin"); function main(): void {}';
    await withProject(source, null, (result, root) => {
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        code: "E10130",
        severity: "error",
        pointer: null,
        message: expect.stringMatching(/^File not found: 'missing\.bin' — searched .+$/u),
        primarySpan: diagnosticSpan(source, 'embed("missing.bin")'),
        related: [],
      });
      const message = errors[0]?.message ?? "";
      const sourceDirectory = join(root, "src");
      const assetDirectory = join(root, "assets");
      expect(message).toContain(sourceDirectory);
      expect(message).toContain(assetDirectory);
      expect(message.indexOf(sourceDirectory)).toBeLessThan(message.indexOf(assetDirectory));
    });
  });
});

describe("canonical cross-module failures", () => {
  // An incomplete manifest selection stays a profile error at the exact quoted JSON value.
  it("should report E10279 at a partial profile ID and enumerate exactly the qualified profiles", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-profile-record-"));
    const manifest = JSON.stringify({
      schemaVersion: 1,
      name: "profile-record",
      sourceRoot: "src",
      entry: "Game",
      target: "c64",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    });
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), "module Game; function main(): void {}");
      await writeFile(join(root, "blend65.json"), manifest);
      const result = await checkProject({ project: join(root, "blend65.json") });
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("failure");
      expect(errors.map(({ code }) => code)).toEqual(["E10279"]);
      const start = Buffer.byteLength(manifest.slice(0, manifest.indexOf('"c64"')));
      const prefix =
        "Target profile 'c64' is not a complete qualified profile ID — choose one of: ";
      expect(errors[0]).toMatchObject({
        code: "E10279",
        severity: "error",
        pointer: "/target",
        message: expect.stringMatching(
          /^Target profile 'c64' is not a complete qualified profile ID — choose one of: .+$/u,
        ),
        primarySpan: { sourceId: "blend65.json", start, end: start + 5 },
        related: [],
      });
      const qualified = [
        "c64-pal-prg-kernal-6581",
        "c64-pal-prg-kernal-8580",
        "c64-pal-prg-takeover-6581",
        "c64-pal-prg-takeover-8580",
        "c64-ntsc-prg-kernal-6581",
        "c64-ntsc-prg-kernal-8580",
        "c64-ntsc-prg-takeover-6581",
        "c64-ntsc-prg-takeover-8580",
        "c64-pal-d64-kernal-6581",
      ];
      expect(errors[0]?.message.slice(prefix.length).split(", ").sort()).toEqual(qualified.sort());
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  // A private declaration explains why an otherwise resolvable import is unavailable.
  it("should report E10012 at the private import and relate its declaration", async () => {
    const source = "module Game; import { helper } from Other; function main(): void { helper(); }";
    const other = "module Other; function helper(): void {}";
    await withProject(source, other, (result) => {
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors.map(({ code }) => code)).toEqual(["E10012"]);
      expect(errors[0]).toMatchObject({
        code: "E10012",
        severity: "error",
        pointer: null,
        message: "'helper' is not exported from module 'Other'",
        primarySpan: diagnosticSpan(source, "helper"),
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([
        { ...diagnosticSpan(other, "helper"), sourceId: "src/other.blend" },
      ]);
    });
  });

  // Both reachable entry declarations must be identified, rather than reporting only their names.
  it("should report E10021 at the second entry and relate the first", async () => {
    const source = "module Game; import { helper } from Other; function main(): void { helper(); }";
    const other = "module Other; export function helper(): void {} function main(): void {}";
    await withProject(source, other, (result) => {
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(result.kind).toBe("error");
      expect(errors.map(({ code }) => code)).toEqual(["E10021"]);
      expect(errors[0]).toMatchObject({
        code: "E10021",
        severity: "error",
        pointer: null,
        message:
          "Multiple entry points found — 'main' is defined in modules 'Game' and 'Other'; only one is allowed",
        primarySpan: { ...diagnosticSpan(other, "main"), sourceId: "src/other.blend" },
      });
      expect(errors[0]?.related.map(({ span }) => span)).toEqual([diagnosticSpan(source, "main")]);
    });
  });

  // Initializer dependencies use qualified identities, with each read edge shown in cycle order.
  it("should report E10194 with the complete ordered initializer cycle", async () => {
    const source =
      "module Game; let first: word = second; let second: word = first; function main(): void { pokew($0400, first); }";
    const result = await analyzeDiagnosticSource(source);
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(result.kind).toBe("error");
    expect(errors.map(({ code }) => code)).toEqual(["E10194"]);
    expect(errors[0]).toMatchObject({
      code: "E10194",
      severity: "error",
      pointer: null,
      message: "Circular module initializer dependency: Game.first → Game.second → Game.first",
      primarySpan: diagnosticSpan(source, "second"),
    });
    expect(errors[0]?.related.map(({ span }) => span)).toEqual([
      diagnosticSpan(source, "second"),
      diagnosticSpan(source, "first", 1),
    ]);
  });
});
