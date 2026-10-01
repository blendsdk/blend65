import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execute = promisify(execFile);
const compilerRoot = join(import.meta.dirname, "../../packages/compiler");
const dependencyRoot = dirname(createRequire(import.meta.url).resolve("jsonc-parser/package.json"));
const libraryId = "@blend65/stdlib/c64/input.blend";
const source = `module Game;
import { joystickUpMask, joystickDownMask, joystickLeftMask, joystickRightMask, joystickFireMask, joystickControlsMask } from c64.input;
const selected: byte = joystickUpMask; function main(): void {}`;
const minimal = "module Game; function main(): void {}";

// The child uses only the installed public exports; package resolution begins in its consumer root.
const inspectInstalled = `
import { buildProject, checkProject, loadProject } from '@blend65/compiler';
import { analyzeProject, analyzeProjectOverlay } from '@blend65/compiler/frontend';
const project = process.argv[1];
const loaded = await loadProject({ project });
let output = { loaded };
if (loaded.kind === 'success') {
  const sync = analyzeProject(loaded.snapshot);
  const asyncResult = await analyzeProjectOverlay(loaded.snapshot, []);
  const projection = result => ({
    kind: result.kind, diagnostics: result.diagnostics, inputs: result.inputs ?? null,
    hasProgram: 'program' in result,
    masks: result.kind === 'complete' ? result.program.bindings
      .filter(binding => binding.storage === 'constant' && binding.exported && binding.qualifiedName?.startsWith('c64.input.'))
      .map(binding => ({
        name: binding.name, sourceId: binding.id.sourceId, type: binding.type,
        value: result.program.declarations.find(declaration =>
          declaration.binding.sourceId === binding.id.sourceId &&
          declaration.binding.span.start === binding.id.span.start)?.initializer?.constant
      })) : []
  });
  output = { loaded, sync: projection(sync), asyncResult: projection(asyncResult),
    reloaded: await loadProject({ project }) };
  if (process.argv[2] === 'build') {
    output.checked = await checkProject({ project });
    output.built = await buildProject({ project, optimization: 'none' });
  }
}
process.stdout.write(JSON.stringify(output, (_, value) => typeof value === 'bigint' ? String(value) : value));
`;

function hash(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Narrow JSON protocol/evidence values before inspecting any fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function object(value: unknown): Record<string, unknown> {
  expect(isRecord(value)).toBe(true);
  if (!isRecord(value)) throw new Error("Expected an evidence object");
  return value;
}

function objects(value: unknown): Record<string, unknown>[] {
  expect(Array.isArray(value), "expected an evidence inventory").toBe(true);
  if (!Array.isArray(value)) throw new Error("Expected evidence records");
  return value.map((item: unknown) => object(item));
}

function string(value: unknown): string {
  expect(typeof value).toBe("string");
  if (typeof value !== "string") throw new Error("Expected an evidence string");
  return value;
}

/** Extract only a validated package-relative tarball into an owned consumer tree. */
async function install(root: string, archive: string, consumerName: string) {
  const consumer = join(root, consumerName);
  const staging = join(consumer, "unpacked");
  const installed = join(consumer, "node_modules/@blend65/compiler");
  await mkdir(staging, { recursive: true });
  await execute("tar", ["-xzf", archive, "-C", staging]);
  await mkdir(dirname(installed), { recursive: true });
  await rename(join(staging, "package"), installed);
  await cp(dependencyRoot, join(consumer, "node_modules/jsonc-parser"), { recursive: true });
  return { consumer, installed, library: join(installed, "stdlib/c64/input.blend") };
}

/** Pack the actual built compiler once; all consumers and mutations remain in this owned root. */
async function withPacked<T>(
  inspect: (fixture: {
    root: string;
    archive: string;
    entries: readonly string[];
    installation: Awaited<ReturnType<typeof install>>;
  }) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "blend65-input-evidence-"));
  try {
    const archive = join(root, "compiler.tgz");
    await execute("yarn", ["pack", "--filename", archive], { cwd: compilerRoot, timeout: 30_000 });
    const listing = await execute("tar", ["-tzf", archive]);
    const entries = listing.stdout.trim().split("\n");
    for (const entry of entries) {
      expect(entry === "package" || entry.startsWith("package/")).toBe(true);
      expect(entry.split("/")).not.toContain("..");
      expect(entry).not.toContain("\\");
    }
    const installation = await install(root, archive, "first");
    return await inspect({ root, archive, entries, installation });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Write identical portable project inputs without copying any checkout source or configuration. */
async function project(consumer: string, text: string) {
  const root = join(consumer, "game");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src/game.blend"), text);
  const manifest = join(root, "blend65.json");
  await writeFile(
    manifest,
    JSON.stringify({
      schemaVersion: 1,
      name: "input-evidence",
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
    }),
  );
  return manifest;
}

async function inspect(consumer: string, manifest: string, mode: "analyze" | "build") {
  const result = await execute(
    process.execPath,
    ["--input-type=module", "-e", inspectInstalled, manifest, mode],
    {
      cwd: consumer,
      timeout: 45_000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  const parsed: unknown = JSON.parse(result.stdout);
  return object(parsed);
}

/** Successful public services must agree with frontend consumed identity, not user discovery alone. */
function acceptance(output: Record<string, unknown>) {
  const loaded = object(output.loaded);
  const reloaded = object(output.reloaded);
  expect(loaded.kind).toBe("success");
  expect(reloaded).toEqual(loaded);
  const user = object(loaded.snapshot);
  const sync = object(output.sync);
  const asynchronous = object(output.asyncResult);
  expect(sync.kind, JSON.stringify(sync.diagnostics)).toBe("complete");
  expect(asynchronous).toEqual(sync);
  const inputs = object(sync.inputs);
  const checked = object(output.checked);
  const built = object(output.built);
  expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
  expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
  expect(checked.snapshotSha256).toBe(inputs.inputSha256);
  expect(checked.snapshotSha256).not.toBe(user.inputSha256);
  expect(objects(user.sources).map(({ sourceId }) => sourceId)).toEqual(["src/game.blend"]);
  const values = objects(sync.masks).map(({ name, value, type, sourceId }) => ({
    name,
    value,
    type,
    sourceId,
  }));
  expect(values).toEqual(
    expect.arrayContaining([
      ...[
        ["joystickUpMask", "1"],
        ["joystickDownMask", "2"],
        ["joystickLeftMask", "4"],
        ["joystickRightMask", "8"],
        ["joystickFireMask", "16"],
        ["joystickControlsMask", "31"],
      ].map(([name, value]) => ({
        name,
        value,
        type: { kind: "scalar", name: "byte" },
        sourceId: libraryId,
      })),
    ]),
  );
  expect(values).toHaveLength(6);
  return { user, inputs, checked, built };
}

/** Independently bind both unchanged sidecar schemas to the exact installed source bytes. */
async function evidence(output: Record<string, unknown>, library: string) {
  const accepted = acceptance(output);
  const bytes = await readFile(library);
  const libraryRecord = objects(accepted.inputs.sources).filter(
    ({ sourceId }) => sourceId === libraryId,
  );
  expect(libraryRecord).toHaveLength(1);
  expect(libraryRecord[0]).toMatchObject({
    sourceId: libraryId,
    resolvedPath: library,
    text: bytes.toString("utf8"),
    byteLength: bytes.length,
    sha256: hash(bytes),
  });
  const generation = object(accepted.built.generation);
  const directory = string(generation.directory);
  const buildJson: unknown = JSON.parse(await readFile(join(directory, ".build.json"), "utf8"));
  const debugJson: unknown = JSON.parse(await readFile(join(directory, ".debug.json"), "utf8"));
  const build = object(buildJson);
  const debug = object(debugJson);
  expect(build).toMatchObject({ kind: "blend65.build", schemaVersion: 1 });
  expect(debug).toMatchObject({ kind: "blend65.debug", schemaVersion: 1 });
  const buildSources = objects(object(build.semanticInputs).sources).filter(
    ({ path }) => path === libraryId,
  );
  const debugSources = objects(debug.sources).filter(({ path }) => path === libraryId);
  expect(buildSources).toEqual([{ path: libraryId, bytes: bytes.length, sha256: hash(bytes) }]);
  expect(debugSources).toEqual([
    { path: libraryId, byteLength: bytes.length, sha256: hash(bytes) },
  ]);
  return accepted;
}

describe("bundled source evidence and installed admission", () => {
  it("keeps relocated compiler input identities portable and changes them for one installed source byte", async () => {
    await withPacked(async ({ root, archive, installation }) => {
      const second = await install(root, archive, "second");
      const firstProject = await project(installation.consumer, source);
      const secondProject = await project(second.consumer, source);
      const first = await evidence(
        await inspect(installation.consumer, firstProject, "build"),
        installation.library,
      );
      const relocated = await evidence(
        await inspect(second.consumer, secondProject, "build"),
        second.library,
      );
      expect(relocated.checked.snapshotSha256).toBe(first.checked.snapshotSha256);
      expect(relocated.user.inputSha256).toBe(first.user.inputSha256);
      expect(installation.library).not.toBe(second.library);
      const original = await readFile(installation.library);
      await writeFile(installation.library, Buffer.concat([original, Buffer.from(" ")]));
      const changed = await evidence(
        await inspect(installation.consumer, firstProject, "build"),
        installation.library,
      );
      expect(changed.checked.snapshotSha256).not.toBe(first.checked.snapshotSha256);
      expect(changed.user).toEqual(first.user);
      expect(await readFile(second.library)).toEqual(original);
      expect(await readFile(join(dirname(firstProject), "src/game.blend"), "utf8")).toBe(source);
    });
  }, 120_000);

  it.each([
    { name: "missing", code: "PROJECT_READ_FAILED" },
    { name: "invalid UTF-8", code: "PROJECT_INVALID_UTF8" },
    { name: "oversized", code: "PROJECT_HOST_LIMIT" },
  ])(
    "rejects a $name installed library in both public analysis paths",
    async ({ name, code }) => {
      await withPacked(async ({ installation, root }) => {
        await mkdir(dirname(installation.library), { recursive: true });
        if (name === "missing") await rm(installation.library, { force: true });
        else
          await writeFile(
            installation.library,
            name === "invalid UTF-8" ? Buffer.from([0xff]) : Buffer.alloc(4 * 1024 * 1024 + 1, 32),
          );
        const manifest = await project(installation.consumer, minimal);
        const output = await inspect(installation.consumer, manifest, "analyze");
        const loaded = object(output.loaded);
        expect(loaded.kind).toBe("success");
        const user = object(loaded.snapshot);
        for (const result of [object(output.sync), object(output.asyncResult)]) {
          expect(result.kind).toBe("error");
          expect(result.hasProgram).toBe(false);
          const diagnostics = objects(result.diagnostics);
          expect(diagnostics.map(({ code }) => code)).toEqual([code]);
          for (const diagnostic of diagnostics) {
            expect(diagnostic.severity).toBe("error");
            const message = string(diagnostic.message);
            expect(message).toContain(libraryId);
            expect(message).not.toContain(root);
            expect(message).not.toMatch(/ENOENT|EACCES|ENOTDIR|Error:|\n\s*at\s/iu);
          }
          const inputs = object(result.inputs);
          expect(objects(inputs.sources)).toEqual(objects(user.sources));
          expect(inputs.inputSha256).toMatch(/^[a-f0-9]{64}$/u);
        }
        expect(output.reloaded).toEqual(loaded);
      });
    },
    60_000,
  );

  it("ships exact source bytes in the real tarball and analyzes and builds outside the checkout", async () => {
    await withPacked(async ({ entries, installation }) => {
      expect(entries.filter((entry) => entry === "package/stdlib/c64/input.blend")).toHaveLength(1);
      expect(await readFile(installation.library)).toEqual(
        await readFile(join(compilerRoot, "stdlib/c64/input.blend")),
      );
      const manifest = await project(installation.consumer, source);
      await evidence(await inspect(installation.consumer, manifest, "build"), installation.library);
    });
  }, 60_000);
});
