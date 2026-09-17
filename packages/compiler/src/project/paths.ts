import { lstat, opendir, realpath, stat } from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { findNodeAtLocation, parseTree } from "jsonc-parser";
import {
  escapeDiagnosticText,
  hostErrorCode,
  projectDiagnostic,
  PROJECT_CODES,
  ProjectChanged,
  ProjectFailure,
  throwReadFailure,
} from "./diagnostics.js";
import { firstUnpairedSurrogate, utf16ByteBounds } from "./positions.js";
import type { ProjectManifest, SourceRecord, SourceSpan } from "./types.js";

/** Logical path, canonical identity and high-resolution metadata stay separate. */
export interface ResolvedInput {
  /** Absolute logical host spelling used to derive the source ID. */
  readonly logicalPath: string;
  /** Canonical absolute path used for native opens. */
  readonly resolvedPath: string;
  /** Exact project-relative spelling with forward slash separators. */
  readonly sourceId: string;
  /** Host-only identity captured before use. */
  readonly metadata: BigIntStats;
}

/** Validated path state for one complete load attempt. */
export interface ProjectPaths {
  /** Logical manifest directory. */
  readonly logicalRoot: string;
  /** Canonical manifest directory. */
  readonly root: string;
  /** Resolved source directory. */
  readonly source: ResolvedInput;
  /** Resolved asset directories in manifest order. */
  readonly assets: readonly ResolvedInput[];
  /** Logical output location, including permitted missing components. */
  readonly logicalOutput: string;
  /** Canonical output location, including permitted missing components. */
  readonly output: string;
}

/** Compare path components rather than accepting a root-prefix sibling. */
export function isContained(root: string, path: string): boolean {
  const tail = relative(root, path);
  return tail === "" || (!isAbsolute(tail) && tail !== ".." && !tail.startsWith(".." + sep));
}

/** Preserve native filename spelling; only native separators become forward slashes. */
export function sourceId(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

/** Regular-file aliases and opened-handle identity use the native device/inode pair. */
export function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;
}

/** Content guards exclude access time because this loader's own reads may update it. */
export function sameMetadata(left: BigIntStats, right: BigIntStats): boolean {
  return (
    sameIdentity(left, right) &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

/** Report a safe relative path or field, never an absolute host path. */
export function throwPathFailure(
  input: string,
  reason: string,
  span: SourceSpan | null = null,
  pointer: string | null = null,
): never {
  throw new ProjectFailure([
    projectDiagnostic(
      PROJECT_CODES.path,
      "Invalid project path '" + escapeDiagnosticText(input) + "': " + reason,
      span,
      pointer,
    ),
  ]);
}

/** Resolve a previously observed path without allowing an outside canonical identity. */
export async function resolveInput(
  logicalPath: string,
  logicalRoot: string,
  root: string,
  display = sourceId(logicalRoot, logicalPath),
  observed = false,
): Promise<ResolvedInput> {
  try {
    const resolvedPath = await realpath(logicalPath);
    if (!isContained(root, resolvedPath)) throwPathFailure(display, "escapes project root");
    return {
      logicalPath,
      resolvedPath,
      sourceId: sourceId(logicalRoot, logicalPath),
      metadata: await stat(resolvedPath, { bigint: true }),
    };
  } catch (error) {
    if (error instanceof ProjectFailure || error instanceof ProjectChanged) throw error;
    if (hostErrorCode(error) === "ELOOP")
      throw new ProjectFailure([
        projectDiagnostic(
          PROJECT_CODES.cycle,
          "Project path cycle: " + escapeDiagnosticText(display),
        ),
      ]);
    throwReadFailure(error, display, observed);
  }
}

/** Validate native lexical containment before resolving any user-declared content path. */
function lexicalPath(logicalRoot: string, spelling: string, pointer: string): string {
  if (spelling.includes("\0") || firstUnpairedSurrogate(spelling) !== null)
    throwPathFailure(pointer, "invalid native path spelling", null, pointer);
  if (isAbsolute(spelling) || (process.platform === "win32" && /^[A-Za-z]:/.test(spelling)))
    throwPathFailure(pointer, "must be relative", null, pointer);
  const path = resolve(logicalRoot, spelling);
  if (!isContained(logicalRoot, path))
    throwPathFailure(pointer, "escapes project root", null, pointer);
  return path;
}

/** Missing output components are permitted only beyond a contained existing directory. */
async function resolveOutput(logicalPath: string, root: string): Promise<string> {
  let parent = logicalPath;
  const missing: string[] = [];
  for (;;) {
    try {
      const canonical = await realpath(parent);
      if (!isContained(root, canonical))
        throwPathFailure("/outDir", "escapes project root", null, "/outDir");
      if (!(await stat(canonical)).isDirectory())
        throwPathFailure("/outDir", "expected a directory", null, "/outDir");
      return join(canonical, ...missing.toReversed());
    } catch (error) {
      if (error instanceof ProjectFailure) throw error;
      const code = hostErrorCode(error);
      if (code === "ENOTDIR") throwPathFailure("/outDir", "expected a directory", null, "/outDir");
      if (code !== "ENOENT") throwReadFailure(error, "/outDir");
      // A dangling symlink is an existing unresolved identity, not a missing directory.
      try {
        await lstat(parent);
        throwPathFailure("/outDir", "existing path cannot be resolved", null, "/outDir");
      } catch (missingError) {
        if (missingError instanceof ProjectFailure) throw missingError;
        if (hostErrorCode(missingError) !== "ENOENT") throwReadFailure(missingError, "/outDir");
      }
      missing.push(basename(parent));
      const next = dirname(parent);
      if (next === parent) throwReadFailure(error, "/outDir");
      parent = next;
    }
  }
}

/** Prove directory readability without enumerating asset contents. */
async function readableDirectory(input: ResolvedInput, pointer: string): Promise<void> {
  if (!input.metadata.isDirectory())
    throwPathFailure(pointer, "expected a directory", null, pointer);
  try {
    const directory = await opendir(input.resolvedPath);
    await directory.close();
  } catch (error) {
    throwReadFailure(error, pointer);
  }
}

/** Attach complete raw JSONC token spans to a responsible manifest path failure. */
function fieldSpan(manifestSource: SourceRecord, pointer: string): SourceSpan | null {
  const bom = manifestSource.text.startsWith("\ufeff") ? 1 : 0;
  const tree = parseTree(manifestSource.text.slice(bom), [], { allowTrailingComma: true });
  if (tree === undefined) return null;
  const parts = pointer
    .slice(1)
    .split("/")
    .map((part) => (/^\d+$/.test(part) ? Number(part) : part));
  const node = findNodeAtLocation(tree, parts);
  if (node === undefined) return null;
  const bounds = utf16ByteBounds(manifestSource.text);
  return Object.freeze({
    sourceId: manifestSource.sourceId,
    start: bounds.starts[node.offset + bom]!,
    end: bounds.ends[node.offset + node.length + bom]!,
  });
}

/** Validate input/output ownership without creating any output or reading asset bytes. */
export async function validatePaths(
  logicalRoot: string,
  root: string,
  manifest: ProjectManifest,
  manifestSource: SourceRecord,
  observed = false,
): Promise<ProjectPaths> {
  try {
    const logicalOutput = lexicalPath(logicalRoot, manifest.outDir, "/outDir");
    const output = await resolveOutput(logicalOutput, root);
    /** Explicit inputs cannot hide inside output through either spelling or canonical aliases. */
    async function directory(spelling: string, pointer: string): Promise<ResolvedInput> {
      const logical = lexicalPath(logicalRoot, spelling, pointer);
      if (isContained(logicalOutput, logical))
        throwPathFailure(pointer, "input is inside output", null, pointer);
      const input = await resolveInput(logical, logicalRoot, root, pointer, observed);
      if (isContained(output, input.resolvedPath))
        throwPathFailure(pointer, "input is inside output", null, pointer);
      await readableDirectory(input, pointer);
      return input;
    }
    const source = await directory(manifest.sourceRoot, "/sourceRoot");
    const assets: ResolvedInput[] = [];
    for (let index = 0; index < manifest.assetPaths.length; index++)
      assets.push(await directory(manifest.assetPaths[index]!, "/assetPaths/" + index));
    return { logicalRoot, root, source, assets, logicalOutput, output };
  } catch (error) {
    if (!(error instanceof ProjectFailure)) throw error;
    throw new ProjectFailure(
      error.diagnostics.map((diagnostic) => {
        const pointer =
          diagnostic.pointer ?? (diagnostic.message.includes("'/outDir'") ? "/outDir" : null);
        return Object.freeze({
          ...diagnostic,
          pointer,
          primarySpan:
            pointer === null ? diagnostic.primarySpan : fieldSpan(manifestSource, pointer),
        });
      }),
    );
  }
}
