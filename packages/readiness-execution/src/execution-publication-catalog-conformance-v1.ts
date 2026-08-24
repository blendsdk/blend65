import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import {
  GENERATED_EXECUTION_HANDLER_CATALOG_V1,
  GENERATED_EXECUTION_RUNNER_CATALOG_V1,
} from "./execution-handler-catalog.generated.js";

/** One generated participant and its exact deterministic dependency closure. */
export interface ExecutionCatalogDescriptorRowV1 {
  readonly capabilityId: string;
  readonly contractVersion: string;
  readonly implementationRevision: string;
  readonly entryPath: string;
  readonly dependencyPaths: readonly string[];
  readonly dependencyDigests: Readonly<Record<string, string>>;
}

/** Defensive passive generated metadata available to implementation-blind conformance tests. */
export interface ExecutionCatalogFixtureDescriptorV1 {
  readonly rows: readonly ExecutionCatalogDescriptorRowV1[];
  readonly bindingBytes: Uint8Array;
  /** Content-derived revision for the evidence-deciding runner closure. */
  readonly runnerRevision: string;
  /** Exact generated dependency paths covered by the runner revision. */
  readonly runnerDependencyPaths: readonly string[];
}

/** Exactly one scoped dependency-byte mutation. */
export interface ExecutionCatalogDependencyMutationV1 {
  readonly capabilityId: string;
  readonly path: string;
  readonly offset: number;
  readonly xorByte: number;
}

/** Operation-local catalog conformance controls with no live callable access. */
export interface ExecutionCatalogConformanceHooksV1 {
  readonly mutateDependency?: ExecutionCatalogDependencyMutationV1;
  readonly atDependencyRead?: (path: string) => void;
  readonly failDirectorySyncAttempts?: number;
  readonly atSelectionFaultPoint?: (
    point: ExecutionCatalogSelectionFaultPointV1,
    context: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly atSelectionReconciliationObservation?: (
    observation: ExecutionCatalogSelectionReconciliationObservationV1,
  ) => void | Promise<void>;
}

/** Durable live-selection boundaries available only to isolated conformance scopes. */
export type ExecutionCatalogSelectionFaultPointV1 =
  | "before-pointer-write"
  | "after-pointer-file-sync"
  | "before-pointer-rename"
  | "after-pointer-rename"
  | "after-pointer-directory-sync"
  | "during-reconciliation";

/** Bounded classification of one post-rename live-selection failure. */
export interface ExecutionCatalogSelectionReconciliationObservationV1 {
  readonly operation: "execution-publication-selection";
  readonly expectedDigest: string;
  readonly selectedDigest?: string;
  readonly state: "committed" | "prior-selection" | "ambiguous";
}

/** One production source supplied to the pure live-catalog boundary validator. */
export interface ExecutionCatalogBoundaryFileV1 {
  readonly path: string;
  readonly source: string;
}

/** Reconstructed current dependency state used by the live catalog owner. */
export interface CurrentExecutionCatalogStateV1 {
  readonly rows: readonly ExecutionCatalogDescriptorRowV1[];
  readonly bindingBytes: Uint8Array;
  /** Content-derived revision for the evidence-deciding runner closure. */
  readonly runnerRevision: string;
}

declare global {
  // A shared process-local slot keeps source-loaded conformance tests and built public exports in
  // one async scope without exposing hooks through either package entry point.
  var __blend65ExecutionCatalogConformanceV1:
    | AsyncLocalStorage<ExecutionCatalogConformanceHooksV1>
    | undefined;
}

const REPOSITORY_ROOT = resolve(import.meta.dirname, "../../..");
const CANONICAL_REPOSITORY_ROOT = realpathSync(REPOSITORY_ROOT);
const CONFORMANCE =
  globalThis.__blend65ExecutionCatalogConformanceV1 ??
  new AsyncLocalStorage<ExecutionCatalogConformanceHooksV1>();
globalThis.__blend65ExecutionCatalogConformanceV1 = CONFORMANCE;
const CATALOG_OWNERS = new Set([
  "execution-publication-catalog.ts",
  "execution-handler-catalog.generated.ts",
  "execution-publication-catalog-conformance-v1.ts",
]);
const CATALOG_LITERAL =
  /(?:execution-handler-catalog-v1|execution-bindings-generated-v1|execution-handler-catalog\.generated)/u;
const EXECUTION_SELECTION_OWNER = "execution-publication-catalog.ts";
const EXECUTION_SELECTION_LITERAL = new RegExp(
  `(?:execution-publication-${"pointer-v1"}|\\.execution-${"pointer\\."}|publication-${"pointer-v1"})`,
  "u",
);
const ENCODER = new TextEncoder();
const MAX_DEPENDENCY_FILES = 2_048;
const MAX_DEPENDENCY_FILE_BYTES = 16 * 1024 * 1024;
const MAX_DEPENDENCY_TOTAL_BYTES = 128 * 1024 * 1024;
/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NO_FOLLOW = "O_NOFOLLOW" in constants ? constants.O_NOFOLLOW : 0;
/* v8 ignore next -- exercised only on hosts without the platform flag. */
const NON_BLOCKING = "O_NONBLOCK" in constants ? constants.O_NONBLOCK : 0;

function normalizedPackagePath(path: string): string | undefined {
  if (
    path.length === 0 ||
    path.includes("\\") ||
    isAbsolute(path) ||
    posix.normalize(path) !== path ||
    path === ".." ||
    path.startsWith("../") ||
    path.startsWith("./")
  ) {
    return undefined;
  }
  return path;
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function failure<T>(path: string, message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.stale-authority" as const, path, message }),
    ]) as readonly [Readonly<{ code: "execution.stale-authority"; path: string; message: string }>],
  });
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function implementationRevision(
  capabilityId: string,
  contractVersion: string,
  entryPath: string,
  dependencies: readonly { readonly path: string; readonly digest: string }[],
): string {
  const preimage = ENCODER.encode(
    `${JSON.stringify({ capabilityId, contractVersion, entryPath, dependencies })}\n`,
  );
  return `sha256:${createHash("sha256")
    .update(ENCODER.encode("blend65-execution-binding-v1\0"))
    .update(preimage)
    .digest("hex")}`;
}

/** Reconstructs the generated runner revision from exact current dependency bytes. */
function runnerRevision(
  dependencies: readonly { readonly path: string; readonly digest: string }[],
): string {
  const preimage = ENCODER.encode(`${JSON.stringify({ dependencies })}\n`);
  return `sha256:${createHash("sha256")
    .update(ENCODER.encode("blend65-execution-runner-v1\0"))
    .update(preimage)
    .digest("hex")}`;
}

function canonicalBindingBytes(rows: readonly ExecutionCatalogDescriptorRowV1[]): Uint8Array {
  return ENCODER.encode(
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "execution-bindings-v1",
      bindings: rows.map(({ capabilityId, contractVersion, implementationRevision }) => ({
        capabilityId,
        contractVersion,
        implementationRevision,
      })),
    })}\n`,
  );
}

function secureDependencyBytes(path: string): ExecutionOperationResultV1<Uint8Array> {
  const emittedModule =
    path.includes("/dist/") && !path.endsWith(".d.ts") && !path.endsWith(".map");
  const emittedPackageManifest = path.startsWith("packages/") && path.endsWith("/package.json");
  const installedRuntime =
    (path.startsWith("node_modules/") || path.includes("/node_modules/")) &&
    (path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".cjs") ||
      path.endsWith(".json") ||
      path.endsWith(".node"));
  const emittedRuntimeAsset =
    (path.startsWith("packages/codegen/runtime/") && path.endsWith(".asm")) ||
    ((path.startsWith("readiness/schema/") || path.startsWith("readiness/oracles/")) &&
      path.endsWith(".json"));
  if (
    normalizedPackagePath(path) === undefined ||
    (!emittedModule && !emittedPackageManifest && !installedRuntime && !emittedRuntimeAsset)
  ) {
    return failure(`/dependencies/${path}`, "Generated dependency path is not emitted authority.");
  }
  const absolutePath = resolve(REPOSITORY_ROOT, path);
  const relativePath = relative(CANONICAL_REPOSITORY_ROOT, absolutePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return failure(`/dependencies/${path}`, "Generated dependency escaped the repository root.");
  }
  let descriptor: number | undefined;
  try {
    if (realpathSync(absolutePath) !== absolutePath) {
      return failure(`/dependencies/${path}`, "Generated dependency traverses a substituted path.");
    }
    const before = lstatSync(absolutePath, { bigint: true });
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.nlink !== 1n ||
      before.size > BigInt(MAX_DEPENDENCY_FILE_BYTES)
    ) {
      return failure(
        `/dependencies/${path}`,
        "Generated dependency is not a bounded regular file.",
      );
    }
    descriptor = openSync(absolutePath, constants.O_RDONLY | NO_FOLLOW | NON_BLOCKING);
    const opened = fstatSync(descriptor, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size
    ) {
      return failure(`/dependencies/${path}`, "Generated dependency changed while it was opened.");
    }
    const bytes = new Uint8Array(Number(opened.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const bytesRead = readSync(descriptor, bytes, offset, bytes.byteLength - offset, offset);
      if (bytesRead === 0) {
        return failure(`/dependencies/${path}`, "Generated dependency changed while it was read.");
      }
      offset += bytesRead;
    }
    const completed = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(absolutePath, { bigint: true });
    if (
      !completed.isFile() ||
      completed.nlink !== 1n ||
      completed.dev !== opened.dev ||
      completed.ino !== opened.ino ||
      completed.size !== opened.size ||
      after.isSymbolicLink() ||
      !after.isFile() ||
      after.nlink !== 1n ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.size !== opened.size ||
      realpathSync(absolutePath) !== absolutePath
    ) {
      return failure(`/dependencies/${path}`, "Generated dependency identity changed during scan.");
    }
    return success(bytes);
  } catch {
    return failure(`/dependencies/${path}`, "Generated dependency is unavailable.");
  } finally {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        // The complete identity/read checks above determine authority; closing cannot restore it.
      }
    }
  }
}

/** Securely validates one dependency path without exposing its retained bytes. */
export function validateExecutionCatalogDependencyPathForConformanceV1(
  path: string,
): ExecutionOperationResultV1<true> {
  const read = secureDependencyBytes(path);
  return read.ok ? success(true) : read;
}

function applyScopedMutation(path: string, bytes: Uint8Array): ExecutionOperationResultV1<true> {
  const mutation = CONFORMANCE.getStore()?.mutateDependency;
  if (mutation === undefined || mutation.path !== path) return success(true);
  const participantPaths =
    mutation.capabilityId === "runner"
      ? GENERATED_EXECUTION_RUNNER_CATALOG_V1.dependencyPaths
      : GENERATED_EXECUTION_HANDLER_CATALOG_V1.rows.find(
          (row) => row.capabilityId === mutation.capabilityId,
        )?.dependencyPaths;
  if (participantPaths === undefined || !participantPaths.includes(path)) {
    return failure(
      `/dependencies/${path}`,
      "Scoped dependency mutation is outside its participant.",
    );
  }
  if (
    !Number.isSafeInteger(mutation.offset) ||
    mutation.offset < 0 ||
    mutation.offset >= bytes.byteLength ||
    !Number.isSafeInteger(mutation.xorByte) ||
    mutation.xorByte < 1 ||
    mutation.xorByte > 255
  ) {
    return failure(`/dependencies/${path}`, "Scoped dependency mutation is out of range.");
  }
  bytes[mutation.offset] = bytes[mutation.offset]! ^ mutation.xorByte;
  return success(true);
}

function generatedDependencyPaths(): readonly string[] {
  return [
    ...new Set(
      GENERATED_EXECUTION_HANDLER_CATALOG_V1.rows
        .flatMap((row) => [...row.dependencyPaths])
        .concat([...GENERATED_EXECUTION_RUNNER_CATALOG_V1.dependencyPaths]),
    ),
  ].sort();
}

/** Invokes every operation-local dependency fault hook before the final synchronous scan. */
export function runExecutionCatalogDependencyFaultBoundaryV1(): ExecutionOperationResultV1<true> {
  try {
    for (const path of generatedDependencyPaths()) {
      CONFORMANCE.getStore()?.atDependencyRead?.(path);
    }
    return success(true);
  } catch {
    return failure("/dependencies", "Execution dependency fault boundary failed safely.");
  }
}

/** Reconstructs current digests without invoking a hook or yielding before the caller commits. */
export function computeExecutionCatalogStateImmediatelyV1(): ExecutionOperationResultV1<CurrentExecutionCatalogStateV1> {
  const paths = generatedDependencyPaths();
  if (paths.length === 0 || paths.length > MAX_DEPENDENCY_FILES) {
    return failure("/dependencies", "Generated dependency closure exceeds its file-count bound.");
  }
  const currentDigests = new Map<string, string>();
  let totalBytes = 0;
  for (const path of paths) {
    const current = secureDependencyBytes(path);
    if (!current.ok) return current;
    totalBytes += current.value.byteLength;
    if (totalBytes > MAX_DEPENDENCY_TOTAL_BYTES) {
      return failure("/dependencies", "Generated dependency closure exceeds its aggregate bound.");
    }
    const mutated = applyScopedMutation(path, current.value);
    if (!mutated.ok) return mutated;
    currentDigests.set(path, sha256(current.value));
  }
  const rows: ExecutionCatalogDescriptorRowV1[] = [];
  for (const generated of GENERATED_EXECUTION_HANDLER_CATALOG_V1.rows) {
    const dependencies: { path: string; digest: string }[] = [];
    for (const path of generated.dependencyPaths) {
      const digest = currentDigests.get(path);
      if (digest === undefined) {
        return failure(`/dependencies/${path}`, "Generated dependency closure is incomplete.");
      }
      dependencies.push({ path, digest });
    }
    const currentRevision = implementationRevision(
      generated.capabilityId,
      generated.contractVersion,
      generated.entryPath,
      dependencies,
    );
    if (currentRevision !== generated.implementationRevision) {
      return failure(
        `/bindings/${generated.capabilityId}/implementationRevision`,
        "Generated execution dependency closure is stale.",
      );
    }
    const dependencyDigests = Object.freeze(
      Object.fromEntries(dependencies.map(({ path, digest }) => [path, digest])),
    );
    rows.push(
      Object.freeze({
        capabilityId: generated.capabilityId,
        contractVersion: generated.contractVersion,
        implementationRevision: generated.implementationRevision,
        entryPath: generated.entryPath,
        dependencyPaths: Object.freeze([...generated.dependencyPaths]),
        dependencyDigests,
      }),
    );
  }
  const closedRows = Object.freeze(rows);
  const runnerDependencies: { path: string; digest: string }[] = [];
  for (const path of GENERATED_EXECUTION_RUNNER_CATALOG_V1.dependencyPaths) {
    const digest = currentDigests.get(path);
    if (digest === undefined) {
      return failure(`/dependencies/${path}`, "Generated runner dependency closure is incomplete.");
    }
    runnerDependencies.push({ path, digest });
  }
  const currentRunnerRevision = runnerRevision(runnerDependencies);
  if (currentRunnerRevision !== GENERATED_EXECUTION_RUNNER_CATALOG_V1.revision) {
    return failure("/runnerRevision", "Generated execution runner closure is stale.");
  }
  return success(
    Object.freeze({
      rows: closedRows,
      bindingBytes: canonicalBindingBytes(closedRows),
      runnerRevision: currentRunnerRevision,
    }),
  );
}

/** Reconstructs every generated dependency digest from current workspace bytes. */
export function computeExecutionCatalogStateV1(): ExecutionOperationResultV1<CurrentExecutionCatalogStateV1> {
  const boundary = runExecutionCatalogDependencyFaultBoundaryV1();
  return boundary.ok ? computeExecutionCatalogStateImmediatelyV1() : boundary;
}

/**
 * Returns defensive generated metadata without exposing live callables or shared mutable bytes.
 */
export function getExecutionCatalogFixtureDescriptorV1(): ExecutionCatalogFixtureDescriptorV1 {
  const state = computeExecutionCatalogStateV1();
  if (!state.ok) {
    throw new TypeError(state.issues[0].message);
  }
  return Object.freeze({
    rows: Object.freeze(
      state.value.rows.map((row) =>
        Object.freeze({
          ...row,
          dependencyPaths: Object.freeze([...row.dependencyPaths]),
          dependencyDigests: Object.freeze({ ...row.dependencyDigests }),
        }),
      ),
    ),
    bindingBytes: new Uint8Array(state.value.bindingBytes),
    runnerRevision: state.value.runnerRevision,
    runnerDependencyPaths: Object.freeze([
      ...GENERATED_EXECUTION_RUNNER_CATALOG_V1.dependencyPaths,
    ]),
  });
}

/** Runs one operation with an isolated passive dependency-byte mutation. */
export function runWithExecutionCatalogConformanceV1<T>(
  hooks: ExecutionCatalogConformanceHooksV1,
  operation: () => T | Promise<T>,
): Promise<T> {
  const mutation = hooks.mutateDependency;
  const closed = Object.freeze({
    ...(mutation === undefined ? {} : { mutateDependency: Object.freeze({ ...mutation }) }),
    ...(hooks.atDependencyRead === undefined ? {} : { atDependencyRead: hooks.atDependencyRead }),
    ...(hooks.failDirectorySyncAttempts === undefined
      ? {}
      : { failDirectorySyncAttempts: hooks.failDirectorySyncAttempts }),
    ...(hooks.atSelectionFaultPoint === undefined
      ? {}
      : { atSelectionFaultPoint: hooks.atSelectionFaultPoint }),
    ...(hooks.atSelectionReconciliationObservation === undefined
      ? {}
      : {
          atSelectionReconciliationObservation: hooks.atSelectionReconciliationObservation,
        }),
  });
  return Promise.resolve(CONFORMANCE.run(closed, operation));
}

interface ReadinessSelectionConformanceHooksV1 {
  readonly atFaultPoint?: (
    point: ExecutionCatalogSelectionFaultPointV1,
    context: Readonly<Record<string, unknown>>,
  ) => void | Promise<void>;
  readonly atReconciliationObservation?: (
    observation: ExecutionCatalogSelectionReconciliationObservationV1,
  ) => void | Promise<void>;
}

function readinessSelectionHooks(): ReadinessSelectionConformanceHooksV1 | undefined {
  const shared = globalThis as typeof globalThis & {
    readonly __blend65ExecutionPublicationConformanceV1?: AsyncLocalStorage<ReadinessSelectionConformanceHooksV1>;
  };
  return shared.__blend65ExecutionPublicationConformanceV1?.getStore();
}

/** Invokes both live-package and readiness-package fault scopes at one durable boundary. */
export async function executionCatalogSelectionFaultPointV1(
  point: ExecutionCatalogSelectionFaultPointV1,
  context: Readonly<Record<string, unknown>> = Object.freeze({}),
): Promise<void> {
  const closed = Object.freeze({ ...context });
  await CONFORMANCE.getStore()?.atSelectionFaultPoint?.(point, closed);
  await readinessSelectionHooks()?.atFaultPoint?.(point, closed);
}

/** Emits one frozen reconciliation classification to both isolated conformance scopes. */
export async function executionCatalogSelectionReconciliationObservationV1(
  observation: ExecutionCatalogSelectionReconciliationObservationV1,
): Promise<void> {
  const closed = Object.freeze({ ...observation });
  await CONFORMANCE.getStore()?.atSelectionReconciliationObservation?.(closed);
  await readinessSelectionHooks()?.atReconciliationObservation?.(closed);
}

/** Returns whether one bounded operational directory-sync attempt should fail in conformance. */
export function shouldFailExecutionCatalogDirectorySyncV1(attempt: number): boolean {
  const count = CONFORMANCE.getStore()?.failDirectorySyncAttempts;
  return (
    typeof count === "number" &&
    Number.isSafeInteger(count) &&
    count > 0 &&
    count <= 2 &&
    attempt <= count
  );
}

/** Confines generated-catalog literals to the exact three live owner modules. */
export function validateExecutionCatalogModuleBoundaryV1(
  files: readonly ExecutionCatalogBoundaryFileV1[],
): ExecutionOperationResultV1<true> {
  if (!Array.isArray(files) || files.length > 512) {
    return failure("/files", "Execution catalog boundary input must be a bounded source array.");
  }
  const seen = new Set<string>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const normalized =
      typeof file === "object" && file !== null && typeof file.path === "string"
        ? normalizedPackagePath(file.path)
        : undefined;
    if (
      typeof file !== "object" ||
      file === null ||
      normalized === undefined ||
      typeof file.source !== "string" ||
      seen.has(normalized)
    ) {
      return failure(`/files/${index}`, "Execution catalog sources must have unique paths.");
    }
    seen.add(normalized);
    if (CATALOG_LITERAL.test(file.source) && !CATALOG_OWNERS.has(normalized)) {
      return failure(file.path, "Generated execution catalog literal escaped its owner module.");
    }
    if (EXECUTION_SELECTION_LITERAL.test(file.source) && normalized !== EXECUTION_SELECTION_OWNER) {
      return failure(file.path, "Execution selection authority literal escaped its live owner.");
    }
  }
  return success(true);
}
