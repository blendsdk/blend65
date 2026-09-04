import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";
import type { PublishedExecutionReleaseDescriptorV1 } from "@blend65/readiness/execution-publication-internals";

import type { CurrentExecutionCatalogStateV1 } from "./execution-publication-catalog-conformance-v1.js";
import { readSecureSelectionFileV1 } from "./execution-publication-secure-filesystem.js";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const MAX_PARENT_FRESHNESS_FILES = 512;
const MAX_PARENT_FRESHNESS_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PARENT_FRESHNESS_TOTAL_BYTES = 64 * 1024 * 1024;

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function failure<T>(
  code: "execution.io" | "execution.identity" | "execution.stale-authority",
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      Readonly<{ code: typeof code; path: string; message: string }>,
    ],
  });
}

function exactBytes(left: Uint8Array, right: Uint8Array): boolean {
  return (
    left.byteLength === right.byteLength && left.every((value, index) => value === right[index])
  );
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

/** Revalidates the retained child directory, exact member inventory, identities, and bytes. */
export function validateExecutionChildReleaseFilesV1(
  passive: PublishedExecutionReleaseDescriptorV1,
): ExecutionOperationResultV1<true> {
  try {
    const release = lstatSync(passive.executionReleaseRoot, { bigint: true });
    if (
      release.isSymbolicLink() ||
      !release.isDirectory() ||
      release.dev !== passive.executionReleaseDevice ||
      release.ino !== passive.executionReleaseInode ||
      realpathSync(passive.executionReleaseRoot) !== passive.executionReleaseRoot
    ) {
      return failure(
        "execution.identity",
        "/digest",
        "Execution child release directory changed before selection.",
      );
    }
    const expectedNames = passive.childReleaseFiles
      .map(({ path }) => path.slice(path.lastIndexOf("/") + 1))
      .sort();
    const actualNames = readdirSync(passive.executionReleaseRoot).sort();
    if (
      expectedNames.length !== actualNames.length ||
      expectedNames.some((name, index) => name !== actualNames[index])
    ) {
      return failure(
        "execution.identity",
        "/digest",
        "Execution child release members changed before selection.",
      );
    }
    for (const file of passive.childReleaseFiles) {
      const current = readSecureSelectionFileV1(
        passive.repositoryRoot,
        resolve(passive.repositoryRoot, file.path),
        256 * 1024,
        { device: file.device, inode: file.inode, size: file.byteLength },
      );
      if (!current.ok) return current;
      if (current.value.byteLength !== file.byteLength || sha256(current.value) !== file.digest) {
        return failure(
          "execution.stale-authority",
          `/${file.path}`,
          "Execution child release bytes changed before selection.",
        );
      }
    }
    return success(true);
  } catch {
    return failure(
      "execution.io",
      "/digest",
      "Execution child release could not be revalidated before selection.",
    );
  }
}

/** Reads either supported parent pointer only when its bytes are exact canonical authority. */
export function readSelectedExecutionParentDigestV1(
  repositoryRoot: string,
  pointerPath: string,
): ExecutionOperationResultV1<string> {
  const read = readSecureSelectionFileV1(repositoryRoot, pointerPath, 512);
  if (!read.ok) return read;
  try {
    const value: unknown = JSON.parse(DECODER.decode(read.value));
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      !("schemaVersion" in value) ||
      !("publicationDigest" in value) ||
      typeof value.publicationDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(value.publicationDigest)
    ) {
      return failure(
        "execution.stale-authority",
        "/parentDigest",
        "Selected parent pointer is not exact canonical authority.",
      );
    }
    const keys = Reflect.ownKeys(value);
    const canonical =
      value.schemaVersion === 1 && keys.length === 2
        ? ENCODER.encode(
            `${JSON.stringify({
              schemaVersion: 1,
              publicationDigest: value.publicationDigest,
            })}\n`,
          )
        : value.schemaVersion === 2 &&
            keys.length === 3 &&
            "kind" in value &&
            value.kind === "rule-family-publication-pointer-v2"
          ? ENCODER.encode(
              `${JSON.stringify({
                schemaVersion: 2,
                kind: "rule-family-publication-pointer-v2",
                publicationDigest: value.publicationDigest,
              })}\n`,
            )
          : undefined;
    if (canonical === undefined || !exactBytes(read.value, canonical)) {
      return failure(
        "execution.stale-authority",
        "/parentDigest",
        "Selected parent pointer is not exact canonical authority.",
      );
    }
    return success(value.publicationDigest);
  } catch {
    return failure(
      "execution.stale-authority",
      "/parentDigest",
      "Selected parent pointer is not valid canonical JSON.",
    );
  }
}

/** Revalidates every exact parent implementation file retained by passive resolution. */
export function validateExecutionParentFreshnessFilesV1(
  passive: PublishedExecutionReleaseDescriptorV1,
): ExecutionOperationResultV1<true> {
  if (
    passive.parentFreshnessFiles.length === 0 ||
    passive.parentFreshnessFiles.length > MAX_PARENT_FRESHNESS_FILES
  ) {
    return failure(
      "execution.stale-authority",
      "/parentDigest",
      "Exact parent freshness closure exceeds its file-count bound.",
    );
  }
  let previous = "";
  let totalBytes = 0;
  for (const file of passive.parentFreshnessFiles) {
    if (
      file.path.length === 0 ||
      file.path.includes("\\") ||
      isAbsolute(file.path) ||
      posix.normalize(file.path) !== file.path ||
      file.path === ".." ||
      file.path.startsWith("../") ||
      file.path.startsWith("./") ||
      file.path <= previous ||
      !Number.isSafeInteger(file.byteLength) ||
      file.byteLength < 0 ||
      file.byteLength > MAX_PARENT_FRESHNESS_FILE_BYTES ||
      !/^sha256:[0-9a-f]{64}$/u.test(file.digest)
    ) {
      return failure(
        "execution.stale-authority",
        "/parentDigest",
        "Exact parent freshness closure is not canonical.",
      );
    }
    previous = file.path;
    const current = readSecureSelectionFileV1(
      passive.repositoryRoot,
      resolve(passive.repositoryRoot, file.path),
      MAX_PARENT_FRESHNESS_FILE_BYTES,
    );
    if (!current.ok) return current;
    totalBytes += current.value.byteLength;
    if (
      current.value.byteLength !== file.byteLength ||
      totalBytes > MAX_PARENT_FRESHNESS_TOTAL_BYTES ||
      sha256(current.value) !== file.digest
    ) {
      return failure(
        "execution.stale-authority",
        `/${file.path}`,
        "Exact parent freshness file changed before child selection.",
      );
    }
  }
  return success(true);
}

/** Joins passive rows to the fixed current catalog without registration or fallback. */
export function validateExactExecutionCatalogRowsV1(
  bindings: readonly {
    readonly capabilityId: string;
    readonly contractVersion: string;
    readonly implementationRevision: string;
  }[],
  rows: CurrentExecutionCatalogStateV1["rows"],
): ExecutionOperationResultV1<true> {
  if (bindings.length !== rows.length) {
    return failure(
      "execution.stale-authority",
      "/bindings",
      "Passive release does not contain the fixed generated catalog.",
    );
  }
  for (let index = 0; index < rows.length; index += 1) {
    const expected = rows[index];
    const actual = bindings[index];
    if (
      expected === undefined ||
      actual === undefined ||
      actual.capabilityId !== expected.capabilityId ||
      actual.contractVersion !== expected.contractVersion ||
      actual.implementationRevision !== expected.implementationRevision
    ) {
      return failure(
        "execution.stale-authority",
        `/bindings/${index}`,
        "Passive execution binding does not match the exact generated participant closure.",
      );
    }
  }
  return success(true);
}
