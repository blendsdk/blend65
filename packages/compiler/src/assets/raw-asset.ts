import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { lstat, open, realpath } from "node:fs/promises";
import type { BigIntStats } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { escapeDiagnosticText, projectDiagnostic, PROJECT_CODES } from "../project/diagnostics.js";
import { isContained, sameIdentity, sameMetadata } from "../project/paths.js";
import { firstUnpairedSurrogate } from "../project/positions.js";
import type { ProjectDiagnostic, ProjectSnapshot } from "../project/types.js";
import { SCALAR_TYPES } from "../frontend/constants.js";
import type { ArrayType } from "../frontend/semantic-types.js";
import type { RawAssetResult, SemanticAsset } from "./asset-types.js";

const RAW_ASSET_BYTES = 512;

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
  readonly byIdentity: Map<string, string>;
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
    byIdentity: new Map<string, string>(),
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
  return components.every(
    (component) => component.length > 0 && component !== "." && component !== "..",
  );
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

function extentFailure(literalPath: string, size: number): RawAssetResult {
  const displayedPath = escapeDiagnosticText(literalPath);
  if (size === 0) return error("E10131", `Embedded file '${displayedPath}' is empty`);
  return error(
    "E10140",
    `Embedded data size mismatch for '${displayedPath}' — expected ${RAW_ASSET_BYTES} elements, got ${size}`,
  );
}

async function readCandidate(
  snapshot: ProjectSnapshot,
  root: string,
  literalPath: string,
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
  const priorLiteral = cache.byIdentity.get(key);
  if (priorLiteral !== undefined && priorLiteral !== literalPath) {
    return error(
      PROJECT_CODES.alias,
      `Raw asset '${escapeDiagnosticText(literalPath)}' aliases the already admitted '${escapeDiagnosticText(priorLiteral)}'`,
    );
  }
  if (Number(before.size) !== RAW_ASSET_BYTES) {
    return extentFailure(literalPath, Number(before.size));
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
    const buffer = Buffer.alloc(RAW_ASSET_BYTES + 1);
    let length = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
      if (bytesRead === 0 || length === buffer.length) break;
      length += bytesRead;
    }
    if (length !== RAW_ASSET_BYTES) return extentFailure(literalPath, length);
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

    const raw = buffer.subarray(0, RAW_ASSET_BYTES);
    const sha256 = createHash("sha256").update(raw).digest("hex");
    const sourcePath = portablePath(snapshot.projectRoot, logicalPath);
    const assetId = createHash("sha256")
      .update(`blend65-raw-v1\0${sourcePath}\0${sha256}`, "utf8")
      .digest("hex");
    const bytes = Object.freeze([...raw]);
    const type: ArrayType = Object.freeze({
      kind: "array",
      element: SCALAR_TYPES.byte,
      length: RAW_ASSET_BYTES,
      size: RAW_ASSET_BYTES,
    });
    const asset: SemanticAsset = Object.freeze({ id: assetId, sourcePath, sha256, bytes });
    const result: Extract<RawAssetResult, { readonly kind: "complete" }> = Object.freeze({
      kind: "complete",
      asset,
      value: Object.freeze({ kind: "embedded", assetId, type, constant: true, bytes }),
    });
    const concurrentlyAdmitted = cache.byLiteral.get(literalPath);
    if (concurrentlyAdmitted !== undefined) {
      return concurrentlyAdmitted.identity === key
        ? concurrentlyAdmitted.result
        : error(
            PROJECT_CODES.changed,
            `Raw asset '${escapeDiagnosticText(literalPath)}' changed while being admitted`,
          );
    }
    const concurrentAlias = cache.byIdentity.get(key);
    if (concurrentAlias !== undefined && concurrentAlias !== literalPath) {
      return error(
        PROJECT_CODES.alias,
        `Raw asset '${escapeDiagnosticText(literalPath)}' aliases the already admitted '${escapeDiagnosticText(concurrentAlias)}'`,
      );
    }
    cache.byLiteral.set(
      literalPath,
      Object.freeze({
        literalPath,
        logicalPath,
        resolvedPath,
        metadata: after,
        identity: key,
        result,
      }),
    );
    cache.byIdentity.set(key, literalPath);
    return result;
  } catch (caught) {
    return hostFailure(literalPath, caught);
  } finally {
    await handle?.close();
  }
}

/**
 * Resolve the bounded raw M1 asset from canonical project asset roots.
 * The function reads exactly 512 bytes and never exposes partial data on failure.
 */
export async function resolveRawAsset(
  snapshot: ProjectSnapshot,
  literalPath: string,
): Promise<RawAssetResult> {
  if (!validLiteralPath(literalPath)) {
    return error(
      PROJECT_CODES.path,
      `Invalid raw asset path '${escapeDiagnosticText(literalPath)}'`,
    );
  }
  const cache = cacheFor(snapshot);
  const prior = cache.byLiteral.get(literalPath);
  if (prior !== undefined) {
    return (await changed(prior))
      ? error(
          PROJECT_CODES.changed,
          `Raw asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
        )
      : prior.result;
  }
  for (const root of snapshot.assetPaths) {
    const result = await readCandidate(snapshot, root, literalPath, cache);
    if (result !== null) return result;
  }
  return error("E10130", `File not found: '${escapeDiagnosticText(literalPath)}'`);
}
