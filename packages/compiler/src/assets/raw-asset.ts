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
import type { AssetProvenance, AssetSelectorInfo } from "./asset-handler.js";
import { rawAssetId } from "./asset-identity.js";

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
  const relativePath = relative(projectRoot, path).split(sep).join("/");
  return relativePath === "" ? "." : relativePath;
}

/**
 * Return whether one asset spelling is a safe project-relative path.
 *
 * The check rejects empty paths, host separators, absolute or drive-absolute
 * spellings, parent traversal, NUL and unpaired surrogate code units before any
 * host lookup.
 */
export function isValidAssetLiteralPath(literalPath: string): boolean {
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

/**
 * Revalidate cached bytes as well as file identity before reusing an asset.
 * Some hosts preserve timestamps across same-size rewrites, so metadata alone
 * cannot prove the content is unchanged. Read at most the admitted size plus one
 * byte, then check handle/path identity around the read and compare its digest.
 * Any failed observation invalidates the cache entry rather than trusting it.
 */
async function changed(cached: CachedAsset): Promise<boolean> {
  let handle;
  try {
    const logical = await lstat(cached.logicalPath, { bigint: true });
    if (logical.isSymbolicLink() || !logical.isFile() || !sameMetadata(logical, cached.metadata)) {
      return true;
    }
    const resolved = await realpath(cached.logicalPath);
    if (resolved !== cached.resolvedPath) return true;
    handle = await open(
      resolved,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const opened = await handle.stat({ bigint: true });
    if (!sameMetadata(logical, opened)) return true;
    const size = Number(cached.metadata.size);
    const bytes = Buffer.alloc(size + 1);
    let length = 0;
    for (;;) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0 || length === bytes.length) break;
      length += read.bytesRead;
    }
    if (length !== size) return true;
    const after = await handle.stat({ bigint: true });
    const afterPath = await lstat(cached.logicalPath, { bigint: true });
    if (
      !sameMetadata(opened, after) ||
      !sameMetadata(after, afterPath) ||
      (await realpath(cached.logicalPath)) !== resolved
    )
      return true;
    return (
      createHash("sha256").update(bytes.subarray(0, size)).digest("hex") !==
      cached.result.asset.outputSha256
    );
  } catch {
    return true;
  } finally {
    await handle?.close();
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
    const assetId = rawAssetId(sourcePath, sha256);
    const bytes = Object.freeze([...raw]);
    const type: ArrayType = Object.freeze({
      kind: "array",
      element: SCALAR_TYPES.byte,
      length: size,
      size,
    });
    const selectors: readonly AssetSelectorInfo[] = Object.freeze([
      Object.freeze({
        name: "raw",
        type: Object.freeze({ kind: "array" as const, array: type }),
        available: true,
        default: true,
      }),
    ]);
    const handler: AssetProvenance = Object.freeze({
      handlerKey: "raw",
      handlerVersion: "1",
      selector: "raw",
      representation: "raw",
      inputSha256: sha256,
      outputSha256: sha256,
      selectors,
    });
    const asset: SemanticAsset = Object.freeze({
      kind: "resident-asset",
      id: assetId,
      sourcePath,
      inputSha256: sha256,
      inputBytes: size,
      outputSha256: sha256,
      bytes,
      handler,
      constraints: Object.freeze([]),
    });
    const result: Extract<RawAssetResult, { readonly kind: "complete" }> = Object.freeze({
      kind: "complete",
      asset,
      value: Object.freeze({ kind: "embedded", assetId, type, constant: true, bytes }),
    });
    const concurrentlyAdmitted = cache.byLiteral.get(cacheKey);
    if (concurrentlyAdmitted !== undefined) {
      return concurrentlyAdmitted.identity === key &&
        concurrentlyAdmitted.result.asset.outputSha256 === sha256
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
  if (!isValidAssetLiteralPath(literalPath)) {
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
    `File not found: '${escapeDiagnosticText(literalPath)}' — searched ${roots
      .map((root) => `'${escapeDiagnosticText(portablePath(snapshot.projectRoot, root))}'`)
      .join(", ")}`,
  );
}

/** Hard upper bound for one native asset input, independent of selected output extent. */
export const MAX_NATIVE_ASSET_BYTES = 1024 * 1024;

/** One successfully read native input with its portable identity. */
export interface NativeAssetBytes {
  /** Portable project-relative spelling. */
  readonly sourcePath: string;
  /** Exact immutable bytes read from the file. */
  readonly bytes: readonly number[];
  /** Lowercase SHA-256 of those bytes. */
  readonly inputSha256: string;
  /** Exact admitted byte count. */
  readonly inputBytes: number;
}

/** Complete native read or one proving diagnostic. */
export type NativeAssetReadResult =
  | { readonly kind: "complete"; readonly asset: NativeAssetBytes }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

interface CachedNative {
  readonly literalPath: string;
  readonly logicalPath: string;
  readonly resolvedPath: string;
  readonly metadata: BigIntStats;
  readonly identity: string;
  readonly asset: NativeAssetBytes;
}

interface NativeRequestBinding {
  readonly logicalPath: string;
  readonly resolvedPath: string;
}

interface SnapshotNativeCache {
  /** One admitted entry per resolved file. */
  readonly byResolved: Map<string, CachedNative>;
  /** The resolved file last admitted for one logical spelling. */
  readonly byLogical: Map<string, string>;
  /** One admitted entry per host file identity. */
  readonly byIdentity: Map<string, CachedNative>;
  /** The exact candidate selected by one source-and-literal request. */
  readonly byRequest: Map<string, NativeRequestBinding>;
}

const nativeCaches = new WeakMap<ProjectSnapshot, SnapshotNativeCache>();

function nativeCacheFor(snapshot: ProjectSnapshot): SnapshotNativeCache {
  const prior = nativeCaches.get(snapshot);
  if (prior !== undefined) return prior;
  const created = {
    byResolved: new Map<string, CachedNative>(),
    byLogical: new Map<string, string>(),
    byIdentity: new Map<string, CachedNative>(),
    byRequest: new Map<string, NativeRequestBinding>(),
  };
  nativeCaches.set(snapshot, created);
  return created;
}

/** Re-read one cached native input through its original logical spelling. */
async function nativeChanged(cached: CachedNative): Promise<boolean> {
  let handle;
  try {
    const logical = await lstat(cached.logicalPath, { bigint: true });
    if (logical.isSymbolicLink() || !logical.isFile() || !sameMetadata(logical, cached.metadata)) {
      return true;
    }
    const resolved = await realpath(cached.logicalPath);
    if (resolved !== cached.resolvedPath) return true;
    handle = await open(
      resolved,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0),
    );
    const opened = await handle.stat({ bigint: true });
    if (!sameIdentity(logical, opened)) return true;
    const size = Number(cached.metadata.size);
    const bytes = Buffer.alloc(size + 1);
    let length = 0;
    for (;;) {
      const read = await handle.read(bytes, length, bytes.length - length, null);
      if (read.bytesRead === 0 || length === bytes.length) break;
      length += read.bytesRead;
    }
    if (length !== size) return true;
    const after = await handle.stat({ bigint: true });
    const afterPath = await lstat(cached.logicalPath, { bigint: true });
    if (
      !sameMetadata(opened, after) ||
      !sameMetadata(after, afterPath) ||
      (await realpath(cached.logicalPath)) !== cached.resolvedPath
    ) {
      return true;
    }
    return (
      createHash("sha256").update(bytes.subarray(0, size)).digest("hex") !==
      cached.asset.inputSha256
    );
  } catch {
    return true;
  } finally {
    await handle?.close();
  }
}

/**
 * Read one native input through the bounded, symlink-safe path.
 *
 * The reader validates the literal spelling and containment before reading,
 * caps the input at one mebibyte, verifies file identity around the read and
 * revalidates both the logical spelling and the resolved file before reuse. A
 * spelling which now resolves to another file, a changed file reached through a
 * second spelling and a hard-link alias all fail deterministically instead of
 * mixing versions inside one analysis.
 */
export async function readNativeAsset(
  snapshot: ProjectSnapshot,
  literalPath: string,
  sourceId: string = snapshot.sources[0]?.sourceId ?? "",
): Promise<NativeAssetReadResult> {
  if (!isValidAssetLiteralPath(literalPath)) {
    return error(
      PROJECT_CODES.path,
      `Invalid native asset path '${escapeDiagnosticText(literalPath)}'`,
    );
  }
  const source = snapshot.sources.find((candidate) => candidate.sourceId === sourceId);
  if (source === undefined) {
    return error(
      PROJECT_CODES.path,
      `Unknown source for native asset '${escapeDiagnosticText(literalPath)}'`,
    );
  }
  const cache = nativeCacheFor(snapshot);
  const cacheKey = `${sourceId}\0${literalPath}`;
  const byRequest = cache.byRequest.get(cacheKey);

  const admit = async (logicalPath: string): Promise<NativeAssetReadResult | null> => {
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
        `Invalid native asset path '${escapeDiagnosticText(literalPath)}': expected a regular file`,
      );
    }
    const root = dirname(logicalPath);
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
          `Invalid native asset path '${escapeDiagnosticText(literalPath)}': escapes an asset root`,
        );
      }
    } catch (caught) {
      return hostFailure(literalPath, caught);
    }

    if (byRequest !== undefined) {
      if (byRequest.logicalPath !== logicalPath || byRequest.resolvedPath !== resolvedPath) {
        return error(
          PROJECT_CODES.changed,
          `Native asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
        );
      }
    } else {
      const priorLogical = cache.byLogical.get(logicalPath);
      if (priorLogical !== undefined && priorLogical !== resolvedPath) {
        return error(
          PROJECT_CODES.changed,
          `Native asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
        );
      }
    }
    const prior = cache.byResolved.get(resolvedPath);
    if (prior !== undefined) {
      if (await nativeChanged(prior)) {
        return error(
          PROJECT_CODES.changed,
          `Native asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
        );
      }
      if (prior.logicalPath !== logicalPath) {
        const alias = Object.freeze({ ...prior, literalPath, logicalPath });
        if (await nativeChanged(alias)) {
          return error(
            PROJECT_CODES.changed,
            `Native asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
          );
        }
      }
      cache.byLogical.set(logicalPath, resolvedPath);
      cache.byRequest.set(cacheKey, Object.freeze({ logicalPath, resolvedPath }));
      return Object.freeze({ kind: "complete", asset: prior.asset });
    }

    const key = identity(before);
    const priorAlias = cache.byIdentity.get(key);
    if (priorAlias !== undefined && priorAlias.resolvedPath !== resolvedPath) {
      return error(
        PROJECT_CODES.alias,
        `Native asset '${escapeDiagnosticText(literalPath)}' aliases the already admitted '${escapeDiagnosticText(priorAlias.literalPath)}'`,
      );
    }
    if (before.size === 0n || before.size > BigInt(MAX_NATIVE_ASSET_BYTES)) {
      return error(
        "E10204",
        before.size === 0n
          ? `Native asset '${escapeDiagnosticText(literalPath)}' is empty`
          : `Native asset '${escapeDiagnosticText(literalPath)}' is ${before.size} bytes — native inputs are limited to ${MAX_NATIVE_ASSET_BYTES} bytes`,
      );
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
          `Native asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
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
          `Native asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
        );
      }
      const after = await handle.stat({ bigint: true });
      if (!sameMetadata(before, opened) || !sameMetadata(opened, after)) {
        return error(
          PROJECT_CODES.changed,
          `Native asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
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
          `Native asset '${escapeDiagnosticText(literalPath)}' changed while being read`,
        );
      }
      const raw = buffer.subarray(0, size);
      const asset: NativeAssetBytes = Object.freeze({
        sourcePath: portablePath(snapshot.projectRoot, resolvedPath),
        bytes: Object.freeze([...raw]),
        inputSha256: createHash("sha256").update(raw).digest("hex"),
        inputBytes: size,
      });
      const admitted = Object.freeze({
        literalPath,
        logicalPath,
        resolvedPath,
        metadata: after,
        identity: key,
        asset,
      });
      cache.byResolved.set(resolvedPath, admitted);
      cache.byLogical.set(logicalPath, resolvedPath);
      cache.byIdentity.set(key, admitted);
      cache.byRequest.set(cacheKey, Object.freeze({ logicalPath, resolvedPath }));
      return Object.freeze({ kind: "complete", asset });
    } catch (caught) {
      return hostFailure(literalPath, caught);
    } finally {
      await handle?.close();
    }
  };

  if (byRequest !== undefined) {
    const result = await admit(byRequest.logicalPath);
    return (
      result ??
      error(
        PROJECT_CODES.changed,
        `Native asset '${escapeDiagnosticText(literalPath)}' changed after validation`,
      )
    );
  }
  const roots = [dirname(source.resolvedPath), ...snapshot.assetPaths];
  const searched: string[] = [];
  for (const root of roots) {
    searched.push(portablePath(snapshot.projectRoot, root));
    const result = await admit(join(root, ...literalPath.split("/")));
    if (result !== null) return result;
  }
  return error(
    "E10130",
    `File not found: '${escapeDiagnosticText(literalPath)}' — searched ${searched.map((root) => `'${escapeDiagnosticText(root)}'`).join(", ")}`,
  );
}
