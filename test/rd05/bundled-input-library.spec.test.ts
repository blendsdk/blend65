import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { checkProject, loadProject } from "@blend65/compiler";
import { analyzeProject, analyzeProjectOverlay } from "@blend65/compiler/frontend";
import type {
  AnalysisResult,
  ProjectSnapshot,
  SourceRecord,
  SourceSpan,
  TypedProgram,
} from "@blend65/compiler/frontend";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const masks = [
  ["joystickUpMask", 1n],
  ["joystickDownMask", 2n],
  ["joystickLeftMask", 4n],
  ["joystickRightMask", 8n],
  ["joystickFireMask", 16n],
  ["joystickControlsMask", 31n],
] as const;
const libraryId = "@blend65/stdlib/c64/input.blend";
const installedPath = join(
  dirname(createRequire(import.meta.url).resolve("@blend65/compiler")),
  "../stdlib/c64/input.blend",
);
const main = "function main(): void {}";

function sha256(text: string | Uint8Array): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Validate every public source-record field before trusting consumed-input evidence. */
function isSourceRecord(value: unknown): value is SourceRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "sourceId" in value &&
    typeof value.sourceId === "string" &&
    "text" in value &&
    typeof value.text === "string" &&
    "sha256" in value &&
    typeof value.sha256 === "string" &&
    "byteLength" in value &&
    typeof value.byteLength === "number" &&
    "resolvedPath" in value &&
    typeof value.resolvedPath === "string"
  );
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Missing consumed-input evidence must fail an assertion, never crash on property access. */
function consumed(result: unknown): {
  readonly sources: readonly SourceRecord[];
  readonly inputSha256: string;
} {
  const inputs =
    typeof result === "object" && result !== null && "inputs" in result ? result.inputs : undefined;
  expect(inputs, "analysis must expose its actual consumed inputs").toBeDefined();
  if (typeof inputs !== "object" || inputs === null)
    throw new Error("Expected consumed-input metadata");
  const sources = "sources" in inputs ? inputs.sources : undefined;
  const hash = "inputSha256" in inputs ? inputs.inputSha256 : undefined;
  expect(isUnknownArray(sources), "consumed sources must be an array").toBe(true);
  if (!isUnknownArray(sources)) throw new Error("Expected consumed source inventory");
  expect(sources.every(isSourceRecord), "consumed sources must be complete records").toBe(true);
  if (!sources.every(isSourceRecord)) throw new Error("Expected complete consumed records");
  expect(hash, "consumed input identity must be a SHA-256").toMatch(/^[a-f0-9]{64}$/u);
  if (typeof hash !== "string") throw new Error("Expected consumed input identity");
  return { sources, inputSha256: hash };
}

/** Require fully checked declarations while allowing ordinary warning diagnostics. */
function complete(result: AnalysisResult): TypedProgram {
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  if (result.kind !== "complete") throw new Error("Expected complete analysis");
  return result.program;
}

/** Follow public declaration identities rather than relying on source or binding order. */
function declaration(program: TypedProgram, qualifiedName: string) {
  const binding = program.bindings.find((item) => item.qualifiedName === qualifiedName);
  expect(binding, `missing binding ${qualifiedName}`).toBeDefined();
  if (!binding) throw new Error(`Expected ${qualifiedName}`);
  const typed = program.declarations.find(
    (item) =>
      item.binding.sourceId === binding.id.sourceId &&
      item.binding.span.start === binding.id.span.start &&
      item.binding.span.end === binding.id.span.end,
  );
  expect(typed, `missing declaration ${qualifiedName}`).toBeDefined();
  if (!typed) throw new Error(`Expected typed ${qualifiedName}`);
  return { binding, typed };
}

/** Decode only the exact proving UTF-8 bytes within the identified consumed source. */
function spanText(source: SourceRecord, span: SourceSpan): string {
  expect(span.sourceId).toBe(source.sourceId);
  expect(span.start).toBeGreaterThanOrEqual(0);
  expect(span.end).toBeGreaterThan(span.start);
  expect(span.end).toBeLessThanOrEqual(source.byteLength);
  return Buffer.from(source.text).subarray(span.start, span.end).toString("utf8");
}

/** The library must be one parsed installed input whose exact bytes prove every normal export. */
async function expectLibrary(result: AnalysisResult, expectedId = libraryId) {
  const program = complete(result);
  const inputs = consumed(result);
  const libraries = inputs.sources.filter(({ sourceId }) => sourceId === expectedId);
  expect(libraries).toHaveLength(1);
  const library = libraries[0];
  if (!library) throw new Error("Expected one installed source library");
  const bytes = await readFile(installedPath);
  expect(library.resolvedPath).toBe(await realpath(installedPath));
  expect(library.text).toBe(bytes.toString("utf8"));
  expect(library.byteLength).toBe(bytes.length);
  expect(library.sha256).toBe(sha256(bytes));
  expect(library.text).toMatch(/\bmodule\s+c64\.input\s*;/u);
  const exports = program.bindings.filter(
    (binding) => binding.id.sourceId === expectedId && binding.exported,
  );
  expect(exports.map(({ name }) => name).sort()).toEqual(masks.map(([name]) => name).sort());
  for (const [name, value] of masks) {
    const { binding, typed } = declaration(program, `c64.input.${name}`);
    expect(binding.id.sourceId).toBe(expectedId);
    expect(binding.exported).toBe(true);
    expect(binding.storage).toBe("constant");
    expect(binding.type).toEqual({ kind: "scalar", name: "byte" });
    expect(typed.type).toEqual({ kind: "scalar", name: "byte" });
    expect(typed.initializer?.constant).toBe(value);
    expect(spanText(library, binding.id.span)).toMatch(
      new RegExp(`^(?:export\\s+)?const\\s+${name}\\s*:\\s*byte\\s*=\\s*[^;]+;$`, "u"),
    );
  }
  expect(inputs.sources.map(({ sourceId }) => sourceId)).toEqual(
    inputs.sources
      .map(({ sourceId }) => sourceId)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right))),
  );
  for (const record of inputs.sources) {
    expect(record.sha256).toBe(sha256(record.text));
    expect(record.byteLength).toBe(Buffer.byteLength(record.text));
  }
  return { program, inputs, library };
}

/** Retain the public loader's user-only snapshot without introducing a partial-load fixture. */
async function snapshot(project: string): Promise<ProjectSnapshot> {
  const loaded = await loadProject({ project });
  expect(loaded.kind).toBe("success");
  if (loaded.kind !== "success") throw new Error(JSON.stringify(loaded.diagnostics));
  return loaded.snapshot;
}

describe.each(profiles)("bundled input source on %s", (target) => {
  it.each(["imported", "qualified"] as const)(
    "resolves every %s mask as an exported byte from installed source",
    async (form) => {
      const imports =
        form === "imported"
          ? `import { ${masks.map(([name]) => name).join(", ")} } from c64.input;`
          : "";
      const values = masks
        .map(
          ([name], index) =>
            `const value${index}: byte = ${form === "qualified" ? "c64.input." : ""}${name};`,
        )
        .join("\n");
      await withProfileProject(
        `module Game; ${imports}\n${values}\n${main}`,
        target,
        async (project) => {
          const user = await snapshot(project);
          const before = structuredClone(user);
          const { program, inputs } = await expectLibrary(analyzeProject(user));
          for (const [index, [, value]] of masks.entries())
            expect(declaration(program, `Game.value${index}`).typed.initializer?.constant).toBe(
              value,
            );
          expect(user).toEqual(before);
          expect(user.sources.map(({ sourceId }) => sourceId)).toEqual(["src/game.blend"]);
          expect(inputs.sources.filter(({ sourceId }) => sourceId !== libraryId)).toEqual(
            user.sources,
          );
          expect(inputs.inputSha256).not.toBe(user.inputSha256);
        },
      );
    },
  );
});

describe("bundled input composition", () => {
  it("shares consumed inputs across sync, asset-aware and overlay analysis without changing user files", async () => {
    const source = `module Game; const selected: byte = c64.input.joystickUpMask; ${main}`;
    await withProfileProject(source, profiles[0], async (project, root) => {
      const user = await snapshot(project);
      const before = structuredClone(user);
      const sync = await expectLibrary(analyzeProject(user));
      const asyncResult = await expectLibrary(await analyzeProjectOverlay(user, []));
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      if (checked.kind !== "success") throw new Error("Expected complete asset-aware compilation");
      expect(checked.snapshotSha256).toBe(sync.inputs.inputSha256);
      expect(asyncResult.inputs).toEqual(sync.inputs);
      const replacement = source.replace("joystickUpMask", "joystickFireMask");
      const overlay = await expectLibrary(
        await analyzeProjectOverlay(user, [{ sourceId: "src/game.blend", text: replacement }]),
      );
      expect(overlay.library).toEqual(sync.library);
      for (const original of [sync, asyncResult])
        expect(declaration(original.program, "Game.selected").typed.initializer?.constant).toBe(1n);
      expect(declaration(overlay.program, "Game.selected").typed.initializer?.constant).toBe(16n);
      expect(overlay.inputs.sources.find(({ sourceId }) => sourceId === "src/game.blend")).toEqual({
        ...user.sources[0],
        text: replacement,
        sha256: sha256(replacement),
        byteLength: Buffer.byteLength(replacement),
      });
      expect(overlay.inputs.inputSha256).not.toBe(sync.inputs.inputSha256);
      expect(user).toEqual(before);
      expect(await readFile(join(root, "src/game.blend"), "utf8")).toBe(source);
      expect(await snapshot(project)).toEqual(before);
    });
  });

  it("reports ordinary duplicate declarations with the user name and real installed proof", async () => {
    const source = `module Game; const value: byte = c64.input.joystickUpMask; ${main}`;
    await withProfileProject(source, profiles[0], async (project, root) => {
      const user = await snapshot(project);
      const text = "module c64.input; export const joystickUpMask: byte = 7;";
      const contribution: SourceRecord = {
        sourceId: "src/override.blend",
        text,
        sha256: sha256(text),
        byteLength: Buffer.byteLength(text),
        resolvedPath: join(root, "src/override.blend"),
      };
      const supplied: ProjectSnapshot = { ...user, sources: [...user.sources, contribution] };
      const result = analyzeProject(supplied);
      expect(result.kind).toBe("error");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors.map(({ code }) => code)).toEqual(["E10003"]);
      const duplicate = errors[0];
      if (!duplicate) throw new Error("Expected duplicate declaration diagnostic");
      expect(duplicate.message).toContain("joystickUpMask");
      const inputs = consumed(result);
      const library = inputs.sources.find(({ sourceId }) => sourceId === libraryId);
      expect(library).toBeDefined();
      if (!library) throw new Error("Expected admitted library evidence on the error result");
      expect(library.text).toBe(await readFile(installedPath, "utf8"));
      const locations = [duplicate.primarySpan, ...duplicate.related.map(({ span }) => span)];
      const userSpan = locations.find((span) => span?.sourceId === contribution.sourceId);
      const librarySpan = locations.find((span) => span?.sourceId === libraryId);
      expect(userSpan).toBeDefined();
      expect(librarySpan).toBeDefined();
      if (!userSpan || !librarySpan) throw new Error("Expected both declaration proofs");
      expect(spanText(contribution, userSpan)).toBe("joystickUpMask");
      expect(spanText(library, librarySpan)).toBe("joystickUpMask");
      expect(inputs.sources.filter(({ sourceId }) => sourceId !== libraryId)).toEqual(
        supplied.sources,
      );
    });
  });

  it("merges a differently named user export into c64.input with imports and qualified access", async () => {
    const source = `module Game; import { extra, joystickUpMask as up } from c64.input;
      const imported: byte = extra; const qualified: byte = c64.input.extra;
      const importedMask: byte = up; const qualifiedMask: byte = c64.input.joystickFireMask; ${main}`;
    await withProfileProject(source, profiles[0], async (project, root) => {
      const user = await snapshot(project);
      const contribution = "module c64.input; export const extra: byte = 7;";
      const record: SourceRecord = {
        sourceId: "src/unrelated-name.blend",
        text: contribution,
        sha256: sha256(contribution),
        byteLength: Buffer.byteLength(contribution),
        resolvedPath: join(root, "src/unrelated-name.blend"),
      };
      const merged: ProjectSnapshot = { ...user, sources: [...user.sources, record] };
      const { program, inputs } = await expectLibrary(analyzeProject(merged));
      for (const [name, value] of [
        ["imported", 7n],
        ["qualified", 7n],
        ["importedMask", 1n],
        ["qualifiedMask", 16n],
      ] as const)
        expect(declaration(program, `Game.${name}`).typed.initializer?.constant).toBe(value);
      expect(declaration(program, "c64.input.extra").binding.id.sourceId).toBe(record.sourceId);
      expect(inputs.sources).toContainEqual(record);
      expect(merged.sources).toEqual([...user.sources, record]);
    });
  });

  it("preserves colliding user identities and assigns one deterministic library identity", async () => {
    await withProfileProject(
      `module Game; const value: byte = c64.input.joystickUpMask; ${main}`,
      profiles[0],
      async (project, root) => {
        const user = await snapshot(project);
        const collisions: readonly SourceRecord[] = [libraryId, `@${libraryId}`].map(
          (sourceId, index) => {
            const text = `module User${index}; export const joystickUpMask: byte = 7;`;
            return Object.freeze({
              sourceId,
              text,
              sha256: sha256(text),
              byteLength: Buffer.byteLength(text),
              resolvedPath: join(root, `user${index}.blend`),
            });
          },
        );
        const sources = Object.freeze([...user.sources, ...collisions]);
        const supplied: ProjectSnapshot = Object.freeze({ ...user, sources });
        const reversed: ProjectSnapshot = Object.freeze({
          ...user,
          sources: Object.freeze([...sources].reverse()),
        });
        const before = structuredClone(supplied);
        const forward = await expectLibrary(analyzeProject(supplied), `@@${libraryId}`);
        const backward = await expectLibrary(analyzeProject(reversed), `@@${libraryId}`);
        expect(forward.inputs).toEqual(backward.inputs);
        expect(forward.inputs.sources).toHaveLength(sources.length + 1);
        for (const record of sources) expect(forward.inputs.sources).toContainEqual(record);
        expect(declaration(forward.program, "Game.value").typed.initializer?.constant).toBe(1n);
        expect(supplied).toEqual(before);
        expect(reversed.sources).toEqual([...sources].reverse());
      },
    );
  });

  it("keeps target-neutral direct analysis free of the C64 source library", async () => {
    await withProfileProject(
      `module Game; const value: byte = 7; ${main}`,
      profiles[0],
      async (project) => {
        const user = await snapshot(project);
        const manifest = { ...user.manifest, target: "test.target" };
        const text = JSON.stringify(manifest);
        const neutral: ProjectSnapshot = {
          ...user,
          manifest,
          effectiveTarget: "test.target",
          overrides: { ...user.overrides, target: null },
          manifestSource: {
            ...user.manifestSource,
            text,
            sha256: sha256(text),
            byteLength: Buffer.byteLength(text),
          },
        };
        const before = structuredClone(neutral);
        const result = analyzeProject(neutral);
        const program = complete(result);
        expect(program.profile).toBeNull();
        expect(declaration(program, "Game.value").typed.initializer?.constant).toBe(7n);
        expect(consumed(result).sources).toEqual(neutral.sources);
        expect(
          program.bindings.some(({ qualifiedName }) => qualifiedName?.startsWith("c64.input.")),
        ).toBe(false);
        expect(neutral).toEqual(before);
      },
    );
  });

  it("rejects an unknown C64 profile without exposing a usable project snapshot", async () => {
    await withProfileProject(
      `module Game; ${main}`,
      "c64-unknown-prg-kernal-6581",
      async (project) => {
        const loaded = await loadProject({ project });
        expect(loaded.kind).toBe("failure");
        if (loaded.kind !== "failure") throw new Error("Expected invalid profile rejection");
        expect(loaded.diagnostics.map(({ code }) => code)).toEqual(["E10279"]);
        expect("snapshot" in loaded).toBe(false);
      },
    );
  });
});
