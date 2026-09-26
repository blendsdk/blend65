import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { escapeDiagnosticText, projectDiagnostic, PROJECT_CODES } from "../project/diagnostics.js";
import { isContained, sameIdentity, sameMetadata } from "../project/paths.js";
import { firstUnpairedSurrogate } from "../project/positions.js";
import type { ProjectDiagnostic, ProjectSnapshot } from "../project/types.js";
import { SCALAR_TYPES } from "../frontend/constants.js";
import type { ArrayType } from "../frontend/semantic-types.js";
import type { RawAssetResult, SemanticAsset } from "./asset-types.js";

const MAX_ARRAY_BYTES = 0xffff;

interface CachedAsset {
  readonly literalPath: string;
  readonly logicalPath: string;
  readonly resolvedPath: string;
  readonly metadata: BigIntStats;
  readonly identity: string;
  readonly result: Extract<RawAssetResult, { readonly kind: "complete" }>;
}

interface SnapshotAssetCache {
  readonly byLiteral: Map<string, CachedAsset>;
  readonly byIdentity: Map<string, CachedAsset>;
}

const snapshotCaches = new WeakMap<ProjectSnapshot, SnapshotAssetCache>();

function error(code: string, message: string): RawAssetResult {
  const diagnostic: ProjectDiagnostic = projectDiagnostic(code, message);
  return Object.freeze({ kind: "error", diagnostics: Object.freeze([diagnostic]) });
}

function cacheFor(snapshot: ProjectSnapshot): SnapshotAssetCache {
  const prior = snapshotCaches.get(snapshot);
  if (prior !== undefined) return prior;
  const created = {
    byLiteral: new Map<string, CachedAsset>(),
    byIdentity: new Map<string, CachedAsset>(),
  };
  snapshotCaches.set(snapshot, created);
  return created;
}

function identity(metadata: BigIntStats): string {
  return `${metadata.dev}:${metadata.ino}:${metadata.mode}`;
}

function portablePath(projectRoot: string, path: string): string {
  return relative(projectRoot, path).split(sep).join("/");
}

function validLiteralPath(literalPath: string): boolean {
  if (
    literalPath.length === 0 ||
    literalPath.includes("\0") ||
    literalPath.includes("\\") ||
    firstUnpairedSurrogate(literalPath) !== null ||
    isAbsolute(literalPath) ||
    /^[A-Za-z]:/u.test(literalPath)
  ) {
    return false;
  }
  const components = literalPath.split("/");
  return components.every((component) => component.length > 0 && component !== "..");
}

async function observedMetadata(path: string): Promise<BigIntStats | null> {
  try {
    return await lstat(path, { bigint: true });
  } catch (caught) {
    if (caught instanceof Error && "code" in caught && caught.code === "ENOENT") return null;
    throw caught;
  }
}

async function changed(cached: CachedAsset): Promise<boolean> {
  try {
    const logical = await lstat(cached.logicalPath, { bigint: true });
    if (logical.isSymbolicLink() || !logical.isFile() || !sameMetadata(logical, cached.metadata)) {
      return true;
    }
    const resolved = await realpath(cached.logicalPath);
    return resolved !== cached.resolvedPath;
  } catch {
    return true;
  }
}

function hostFailure(literalPath: string, caught: unknown): RawAssetResult {
  const code =
    caught instanceof Error && "code" in caught && typeof caught.code === "string"
      ? caught.code
      : "UNKNOWN";
  return error(
    PROJECT_CODES.read,
    `Cannot read raw asset '${escapeDiagnosticText(literalPath)}': ${code}`,
  );
}

function extentFailure(literalPath: string, size: bigint): RawAssetResult {
  const displayedPath = escapeDiagnosticText(literalPath);
  if (size === 0n) return error("E10131", `Embedded file '${displayedPath}' is empty`);
  return error(
    "E10265",
    `Type 'byte[${size}]' requires ${size} bytes — fixed array and struct types are limited to 65535 bytes`,
  );
}

async function readCandidate(
  snapshot: ProjectSnapshot,
  root: string,
  literalPath: string,
  cacheKey: string,
  cache: SnapshotAssetCache,
): Promise<RawAssetResult | null> {
  const logicalPath = join(root, ...literalPath.split("/"));
  let before: BigIntStats | null;
  try {
    before = await observedMetadata(logicalPath);
  } catch (caught) {
    return hostFailure(literalPath, caught);
  }
  if (before === null) return null;
  if (before.isSymbolicLink() || !before.isFile()) {
    return error(
      PROJECT_CODES.path,
      `Invalid raw asset path '${escapeDiagnosticText(literalPath)}': expected a regular file`,
    );
  }

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(logicalPath);
    const canonicalRoot = await realpath(root);
    if (
      !isContained(canonicalRoot, resolvedPath) ||
      !isContained(snapshot.projectRoot, resolvedPath)
    ) {
      return error(
        PROJECT_CODES.path,
        `Invalid raw asset path '${escapeDiagnosticText(literalPath)}': escapes an asset root`,
      );
    }
  } catch (caught) {
    return hostFailure(literalPath, caught);
  }

  const key = identity(before);
  const priorAsset = cache.byIdentity.get(key);
  if (priorAsset !== undefined && priorAsset.resolvedPath !== resolvedPath) {
    return error(
      PROJECT_CODES.alias,
      `Raw asset '${escapeDiagnosticText(literalPath)}' aliases the already admitted '${escapeDiagnosticText(priorAsset.literalPath)}'`,
    );
  }
  if (priorAsset !== undefined) {
    if (await changed(priorAsset)) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
      );
    }
    // Bytes are canonical, but every spelling must retain its own path checks.
    const alias = Object.freeze({ ...priorAsset, literalPath, logicalPath, resolvedPath });
    if (await changed(alias)) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
      );
    }
    cache.byLiteral.set(cacheKey, alias);
    return priorAsset.result;
  }
  if (before.size === 0n || before.size > BigInt(MAX_ARRAY_BYTES)) {
    return extentFailure(literalPath, before.size);
  }

  let handle;
  try {
    handle = await open(
      resolvedPath,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const opened = await handle.stat({ bigint: true });
    if (!opened.isFile() || !sameIdentity(before, opened)) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
      );
    }
    const size = Number(before.size);
    const buffer = Buffer.alloc(size + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0 || length === buffer.length) break;
      length += bytesRead;
    }
    if (length !== size) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
      );
    }
    const after = await handle.stat({ bigint: true });
    if (!sameMetadata(before, opened) || !sameMetadata(opened, after)) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
      );
    }
    const afterPath = await lstat(logicalPath, { bigint: true });
    if (
      afterPath.isSymbolicLink() ||
      !sameMetadata(before, afterPath) ||
      (await realpath(logicalPath)) !== resolvedPath
    ) {
      return error(
        PROJECT_CODES.changed,
        `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
      );
    }

    const raw = buffer.subarray(0, size);
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const sourcePath = portablePath(snapshot.projectRoot, resolvedPath);
    const assetId = createHash("sha256")
      .update(`blend65-raw-v1\0${sourcePath}\0${sha256}`, "utf8")
      .digest("hex");
    const bytes = Object.freeze([...raw]);
    const type: ArrayType = Object.freeze({
      kind: "array",
      element: SCALAR_TYPES.byte,
      length: size,
      size,
    });
    const asset: SemanticAsset = Object.freeze({ id: assetId, sourcePath, sha256, bytes });
    const result: Extract<RawAssetResult, { readonly kind: "complete" }> = Object.freeze({
      kind: "complete",
      asset,
      value: Object.freeze({ kind: "embedded", assetId, type, constant: true, bytes }),
    });
    const concurrentlyAdmitted = cache.byLiteral.get(cacheKey);
    if (concurrentlyAdmitted !== undefined) {
      return concurrentlyAdmitted.identity === key
        ? concurrentlyAdmitted.result
        : error(
            PROJECT_CODES.changed,
            `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being admitted`,
          );
    }
    const concurrentAlias = cache.byIdentity.get(key);
    if (concurrentAlias !== undefined && concurrentAlias.resolvedPath !== resolvedPath) {
      return error(
        PROJECT_CODES.alias,
        `Raw asset '${escapeDiagnosticText(literalPath)}' aliases the already admitted '${escapeDiagnosticText(concurrentAlias.literalPath)}'`,
      );
    }
    const admitted = Object.freeze({
      literalPath,
      logicalPath,
      resolvedPath,
      metadata: after,
      identity: key,
      result,
    });
    cache.byLiteral.set(cacheKey, admitted);
    cache.byIdentity.set(key, admitted);
    return result;
  } catch (caught) {
    return hostFailure(literalPath, caught);
  } finally {
    await handle?.close();
  }
}

/**
 * Resolve a nonempty raw asset from the containing source directory, then asset search roots.
 * The bounded read never exposes partial data on failure.
 */
export async function resolveRawAsset(
  snapshot: ProjectSnapshot,
  literalPath: string,
  sourceId: string = snapshot.sources[0]?.sourceId ?? "",
): Promise<RawAssetResult> {
  if (!validLiteralPath(literalPath)) {
    return error(
      PROJECT_CODES.path,
      `Invalid raw asset path '${escapeDiagnosticText(literalPath)}'`,
    );
  }
  const source = snapshot.sources.find((candidate) => candidate.sourceId === sourceId);
  if (source === undefined) {
    return error(
      PROJECT_CODES.path,
      `Unknown source for raw asset '${escapeDiagnosticText(literalPath)}'`,
    );
  }
  const cacheKey = `${sourceId}\0${literalPath}`;
  const cache = cacheFor(snapshot);
  const prior = cache.byLiteral.get(cacheKey);
  if (prior !== undefined) {
    return (await changed(prior))
      ? error(
          PROJECT_CODES.changed,
          `Raw asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
        )
      : prior.result;
  }
  const roots = [dirname(source.resolvedPath), ...snapshot.assetPaths];
  for (const root of roots) {
    const result = await readCandidate(snapshot, root, literalPath, cacheKey, cache);
    if (result !== null) return result;
  }
  return error(
    "E10130",
    `File not found: '${escapeDiagnosticText(literalPath)}' — searched ${roots.map((root) => `'${escapeDiagnosticText(root)}'`).join(", ")}`,
  );
}
