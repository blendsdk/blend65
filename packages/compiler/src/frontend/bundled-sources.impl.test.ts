import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { cp, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { freshTree, project, put, removeTree } from "../../test/project-fixtures.js";
import { projectInputSha256 } from "../project/input-identity.js";
import { DEFAULT_LIMITS } from "../project/reads.js";
import { loadProjectWithControls } from "../project/snapshot.js";
import type { ProjectSnapshot } from "../project/types.js";
import { prepareAnalysisInputs } from "./bundled-sources.js";
import { analyzeProject } from "./service.js";

const execute = promisify(execFile);
const compilerRoot = join(import.meta.dirname, "../..");
const libraryId = "@blend65/stdlib/c64/input.blend";
const dependencyRoot = dirname(createRequire(import.meta.url).resolve("jsonc-parser/package.json"));

/** Keep fixture lifetime bounded and supply a real user-only snapshot. */
async function withSnapshot<T>(inspect: (snapshot: ProjectSnapshot, root: string) => Promise<T>) {
  const root = await freshTree();
  try {
    await project(root);
    await put(root, "src/main.blend", "module Foundation; function main(): void {}");
    const loaded = await loadProjectWithControls({ cwd: root });
    if (loaded.kind !== "success") throw new Error("Expected a real project snapshot");
    return await inspect(loaded.snapshot, root);
  } finally {
    await removeTree(root);
  }
}

/** Observe real native reads in an isolated process without replacing their behavior. */
const nativeProbe = `
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const { prepareAnalysisInputs } = await import(process.argv[1]);
const snapshot = JSON.parse(process.argv[2]);
const nativeRead = fs.readSync, nativeOpen = fs.openSync, nativeClose = fs.closeSync;
const lengths = [], flags = [];
let closes = 0, bytesRead = 0;
fs.openSync = (...args) => { flags.push(args[1]); return nativeOpen(...args); };
fs.closeSync = (...args) => { closes++; return nativeClose(...args); };
fs.readSync = (...args) => {
  lengths.push(args[3]);
  const count = nativeRead(...args);
  bytesRead += count;
  if (process.argv[3] === 'grow' && lengths.length === 1) fs.appendFileSync(process.argv[4], '  ');
  return count;
};
syncBuiltinESMExports();
const result = prepareAnalysisInputs(snapshot);
const library = result.kind === 'complete' ? result.snapshot.sources.find(s => s.sourceId === '${libraryId}') : null;
let repeatedSha256 = null;
if (process.argv[3] === 'repeat') {
  fs.appendFileSync(process.argv[4], ' ');
  const repeated = prepareAnalysisInputs(snapshot);
  repeatedSha256 = repeated.kind === 'complete' ? repeated.snapshot.sources.find(s => s.sourceId === '${libraryId}')?.sha256 : null;
}
process.stdout.write(JSON.stringify({ kind: result.kind, diagnostics: result.diagnostics,
  lengths, flags, closes, bytesRead, repeatedSha256, library: library ? {
    byteLength: library.byteLength, sha256: library.sha256, prefix: library.text.slice(0, 8)
  } : null }));
`;

/** Validate child-process JSON before using it as evidence. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reject malformed observation output instead of bypassing the evidence type boundary. */
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected native read evidence");
  }
  return value;
}

/** Install only the built module closure in an owned tree; never mutate the live library. */
async function probe(
  snapshot: ProjectSnapshot,
  root: string,
  content: Uint8Array | "directory",
  grow = false,
  repeat = false,
) {
  const installed = join(root, "installed");
  await cp(join(compilerRoot, "dist"), join(installed, "dist"), { recursive: true });
  await cp(join(compilerRoot, "package.json"), join(installed, "package.json"));
  await cp(dependencyRoot, join(root, "node_modules/jsonc-parser"), { recursive: true });
  const library = join(installed, "stdlib/c64/input.blend");
  await mkdir(dirname(library), { recursive: true });
  if (content === "directory") await mkdir(library);
  else await writeFile(library, content);
  const child = await execute(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      nativeProbe,
      pathToFileURL(join(installed, "dist/frontend/bundled-sources.js")).href,
      JSON.stringify(snapshot),
      grow ? "grow" : repeat ? "repeat" : "fixed",
      library,
    ],
    { cwd: root, timeout: 15_000, maxBuffer: 128 * 1024 },
  );
  const output: unknown = JSON.parse(child.stdout);
  return record(output);
}

describe("fixed bundled input preparation internals", () => {
  it.each([false, true])(
    "should order the bound constant despite a rejected duplicate and retain independent errors: %s",
    async (independentError) => {
      await withSnapshot(async (snapshot, root) => {
        const files = {
          "0/shared.blend": "module Shared; export const item: byte = 1;",
          "game.blend": `module Game; const selected: byte = Shared.item; ${independentError ? "const invalid: byte = peek($0400);" : ""} function main(): void { poke($0400, selected); }`,
          "z/shared.blend": "module Shared; export const item: byte = 7;",
        };
        const sources = Object.freeze(
          Object.entries(files).map(([sourceId, text]) =>
            Object.freeze({
              sourceId,
              text,
              byteLength: Buffer.byteLength(text),
              sha256: createHash("sha256").update(text).digest("hex"),
              resolvedPath: join(root, sourceId),
            }),
          ),
        );
        const result = analyzeProject({
          ...snapshot,
          effectiveTarget: "test.target",
          effectiveEntry: "Game",
          sources,
        });
        expect(result.kind).toBe("error");
        expect(result.diagnostics.map(({ code }) => code)).toEqual(
          independentError ? ["E10191", "E10003"] : ["E10003"],
        );
      });
    },
  );

  it("should produce fresh immutable views from the same unchanged user snapshot", async () => {
    await withSnapshot(async (snapshot) => {
      const before = structuredClone(snapshot);
      const first = prepareAnalysisInputs(snapshot);
      const second = prepareAnalysisInputs(snapshot);
      expect(first.kind).toBe("complete");
      expect(second).toEqual(first);
      if (first.kind !== "complete" || second.kind !== "complete")
        throw new Error("Expected preparation");
      expect(first.snapshot).not.toBe(second.snapshot);
      expect(Object.isFrozen(first.snapshot)).toBe(true);
      expect(Object.isFrozen(first.snapshot.sources)).toBe(true);
      expect(first.snapshot.sources.every(Object.isFrozen)).toBe(true);
      expect(first.snapshot.sources.filter(({ sourceId }) => sourceId === libraryId)).toHaveLength(
        1,
      );
      expect(
        first.snapshot.sources.find(({ sourceId }) => sourceId === snapshot.sources[0]?.sourceId),
      ).toBe(snapshot.sources[0]);
      expect(first.snapshot.inputSha256).toBe(
        projectInputSha256(snapshot.manifestSource, first.snapshot.sources, snapshot.overrides),
      );
      expect(snapshot).toEqual(before);
    });
  });

  it("should preserve repeated user-name collisions and order the new identity by UTF-8 bytes", async () => {
    await withSnapshot(async (snapshot) => {
      const user = snapshot.sources[0]!;
      const collisions = Array.from({ length: 8 }, (_, index) =>
        Object.freeze({ ...user, sourceId: "@".repeat(index) + libraryId }),
      );
      const sources = Object.freeze([...snapshot.sources, ...collisions].reverse());
      const supplied = Object.freeze({ ...snapshot, sources });
      const result = prepareAnalysisInputs(supplied);
      if (result.kind !== "complete") throw new Error("Expected collision-safe preparation");
      for (const source of sources) expect(result.snapshot.sources).toContain(source);
      const library = result.snapshot.sources.find(
        ({ sourceId }) => sourceId === "@".repeat(8) + libraryId,
      );
      expect(library).toBeDefined();
      expect(result.snapshot.sources.map(({ sourceId }) => sourceId)).toEqual(
        [...result.snapshot.sources]
          .sort((a, b) => Buffer.compare(Buffer.from(a.sourceId), Buffer.from(b.sourceId)))
          .map(({ sourceId }) => sourceId),
      );
      expect(supplied.sources).toBe(sources);
    });
  });

  it("should return the same neutral snapshot without an installed source read", async () => {
    await withSnapshot(async (snapshot, root) => {
      const neutral = { ...snapshot, effectiveTarget: "test.target" };
      expect(prepareAnalysisInputs(neutral)).toEqual({ kind: "complete", snapshot: neutral });
      const observed = await probe(neutral, root, "directory");
      expect(observed).toMatchObject({
        kind: "complete",
        lengths: [],
        flags: [],
        closes: 0,
        library: null,
      });
    });
  });

  it("should accept the exact byte ceiling through bounded reads and close its handle", async () => {
    await withSnapshot(async (snapshot, root) => {
      const bytes = Buffer.alloc(DEFAULT_LIMITS.sourceBytes, 32);
      Buffer.from("\uFEFFé\r\n").copy(bytes);
      const observed = await probe(snapshot, root, bytes);
      expect(observed.kind).toBe("complete");
      expect(observed.closes).toBe(1);
      expect(observed.bytesRead).toBe(bytes.length);
      expect(record(observed.library)).toMatchObject({
        byteLength: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        prefix: bytes.toString("utf8").slice(0, 8),
      });
      if (!Array.isArray(observed.lengths) || !Array.isArray(observed.flags))
        throw new Error("Expected native call inventory");
      expect(observed.lengths).toHaveLength(65);
      expect(observed.lengths.at(-1)).toBe(1);
      expect(
        observed.lengths.every((length: unknown) => typeof length === "number" && length <= 65_536),
      ).toBe(true);
      const flags: unknown = observed.flags[0];
      if (typeof flags !== "number") throw new Error("Expected native open flags");
      expect(flags & (constants.O_NONBLOCK ?? 0)).toBe(constants.O_NONBLOCK ?? 0);
      expect(flags & (constants.O_NOFOLLOW ?? 0)).toBe(constants.O_NOFOLLOW ?? 0);
    });
  }, 30_000);

  it.each([
    {
      name: "initial overflow",
      content: Buffer.alloc(DEFAULT_LIMITS.sourceBytes + 1, 32),
      grow: false,
      code: "PROJECT_HOST_LIMIT",
      reads: 0,
    },
    {
      name: "growth overflow",
      content: Buffer.alloc(DEFAULT_LIMITS.sourceBytes - 1, 32),
      grow: true,
      code: "PROJECT_HOST_LIMIT",
      reads: 65,
    },
    {
      name: "invalid UTF-8",
      content: Buffer.from([0xff]),
      grow: false,
      code: "PROJECT_INVALID_UTF8",
      reads: 2,
    },
    {
      name: "changing metadata",
      content: Buffer.from("module c64.input;"),
      grow: true,
      code: "PROJECT_READ_FAILED",
      reads: 3,
    },
    {
      name: "nonregular input",
      content: "directory",
      grow: false,
      code: "PROJECT_READ_FAILED",
      reads: 0,
    },
  ] as const)(
    "should reject $name without leaking a handle or private host exception",
    async ({ content, grow, code, reads }) => {
      await withSnapshot(async (snapshot, root) => {
        const observed = await probe(snapshot, root, content, grow);
        expect(observed).toMatchObject({ kind: "error", closes: 1, library: null });
        if (!Array.isArray(observed.diagnostics)) throw new Error("Expected safe diagnostics");
        expect(observed.diagnostics.map((item: unknown) => record(item).code)).toEqual([code]);
        expect(observed.lengths).toHaveLength(reads);
        expect(JSON.stringify(observed.diagnostics)).not.toContain(root);
        expect(JSON.stringify(observed.diagnostics)).not.toMatch(/ENOENT|EACCES|Error:|\n\s*at\s/u);
      });
    },
    30_000,
  );

  it("should reread changed installed bytes instead of retaining a process cache", async () => {
    await withSnapshot(async (snapshot, root) => {
      const original = Buffer.from("module c64.input;");
      const observed = await probe(snapshot, root, original, false, true);
      expect(record(observed.library).sha256).toBe(
        createHash("sha256").update(original).digest("hex"),
      );
      expect(observed.repeatedSha256).toBe(
        createHash("sha256")
          .update(Buffer.concat([original, Buffer.from(" ")]))
          .digest("hex"),
      );
      expect(observed.repeatedSha256).not.toBe(record(observed.library).sha256);
      expect(observed.closes).toBe(2);
    });
  }, 30_000);
});
