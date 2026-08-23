import { randomUUID } from "node:crypto";
import { renameSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  resolvePublishedExecutionRelease,
  type ExecutionOperationResultV1,
  type PublishedExecutionRelease,
} from "@blend65/readiness";
import {
  getPublishedExecutionReleaseDescriptorV1,
  type PublishedExecutionReleaseDescriptorV1,
} from "@blend65/readiness/execution-publication-internals";

import {
  computeExecutionCatalogStateImmediatelyV1,
  computeExecutionCatalogStateV1,
  executionCatalogSelectionFaultPointV1,
  executionCatalogSelectionReconciliationObservationV1,
  runExecutionCatalogDependencyFaultBoundaryV1,
  shouldFailExecutionCatalogDirectorySyncV1,
} from "./execution-publication-catalog-conformance-v1.js";
import { GENERATED_EXECUTION_HANDLER_CATALOG_V1 } from "./execution-handler-catalog.generated.js";
import { createLiveExecutionHandlersV1 } from "./execution-live-handlers.js";
import {
  cleanupSecureSelectionFileV1,
  pinSecureSelectionDirectoryV1,
  readSecureSelectionFileV1,
  synchronizeSecureSelectionDirectoryV1,
  verifySecureSelectionDirectoryV1,
  writeSecureSelectionFileV1,
  type SecureSelectionDirectoryIdentityV1,
  type SecureSelectionFileIdentityV1,
} from "./execution-publication-secure-filesystem.js";
import {
  readSelectedExecutionParentDigestV1,
  validateExactExecutionCatalogRowsV1,
  validateExecutionChildReleaseFilesV1,
  validateExecutionParentFreshnessFilesV1,
} from "./execution-publication-selection-validation.js";
import type { PublishedExecutionHandlersV1 } from "./execution-route-adapters.js";

declare const LIVE_EXECUTION_CONTEXT_BRAND: unique symbol;

/** Opaque live capability created only after passive bytes match the fixed generated catalog. */
export interface LiveExecutionContextV1 {
  readonly [LIVE_EXECUTION_CONTEXT_BRAND]: true;
}

interface LiveExecutionContextStateV1 {
  readonly release: PublishedExecutionRelease;
  readonly handlers: PublishedExecutionHandlersV1;
}

const LIVE_CONTEXTS = new WeakMap<object, LiveExecutionContextStateV1>();
const FIXED_HANDLERS = createLiveExecutionHandlersV1();
const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });

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

function selectionFailure<T>(
  code:
    | "execution.io"
    | "execution.identity"
    | "execution.reconciliation"
    | "execution.stale-authority",
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

function renderExecutionPointer(digest: string): Uint8Array {
  return ENCODER.encode(
    `${JSON.stringify({
      schemaVersion: 1,
      kind: "execution-publication-pointer-v1",
      publicationDigest: digest,
    })}\n`,
  );
}

function guardAndRenameSelection(
  passive: PublishedExecutionReleaseDescriptorV1,
  directory: SecureSelectionDirectoryIdentityV1,
  temporary: SecureSelectionFileIdentityV1,
  pointerBytes: Uint8Array,
): ExecutionOperationResultV1<true> {
  const current = computeExecutionCatalogStateImmediatelyV1();
  if (!current.ok) return current;
  const exact = validateExactExecutionCatalogRowsV1(passive.bindings, current.value.rows);
  if (!exact.ok) return exact;
  const parent = readSelectedExecutionParentDigestV1(
    passive.repositoryRoot,
    passive.parentPointerPath,
  );
  if (!parent.ok) return parent;
  if (parent.value !== passive.parentDigest) {
    return selectionFailure(
      "execution.stale-authority",
      "/parentDigest",
      "Execution child parent is not the currently selected exact parent.",
    );
  }
  const parentFreshness = validateExecutionParentFreshnessFilesV1(passive);
  if (!parentFreshness.ok) return parentFreshness;
  const childRelease = validateExecutionChildReleaseFilesV1(passive);
  if (!childRelease.ok) return childRelease;
  if (
    passive.executionPublicationRoot !== directory.path ||
    dirname(passive.executionPointerPath) !== directory.path ||
    dirname(temporary.path) !== directory.path ||
    !verifySecureSelectionDirectoryV1(directory)
  ) {
    return selectionFailure(
      "execution.identity",
      "",
      "Execution selection directory changed before the commit point.",
    );
  }
  const retainedTemporary = readSecureSelectionFileV1(
    passive.repositoryRoot,
    temporary.path,
    512,
    temporary,
  );
  if (!retainedTemporary.ok) return retainedTemporary;
  if (!exactBytes(retainedTemporary.value, pointerBytes)) {
    return selectionFailure(
      "execution.identity",
      "",
      "Execution pointer temporary bytes changed before the commit point.",
    );
  }
  try {
    renameSync(temporary.path, passive.executionPointerPath);
  } catch {
    return selectionFailure(
      "execution.io",
      "",
      "Execution publication pointer rename failed safely.",
    );
  }
  const retainedPointer = readSecureSelectionFileV1(
    passive.repositoryRoot,
    passive.executionPointerPath,
    512,
    temporary,
  );
  if (!retainedPointer.ok || !exactBytes(retainedPointer.value, pointerBytes)) {
    return selectionFailure(
      "execution.reconciliation",
      "",
      "Renamed execution pointer identity or bytes could not be proven.",
    );
  }
  return success(true);
}

function executionPointerDigest(bytes: Uint8Array): string | undefined {
  try {
    const value: unknown = JSON.parse(DECODER.decode(bytes));
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Reflect.ownKeys(value).length !== 3 ||
      !("schemaVersion" in value) ||
      value.schemaVersion !== 1 ||
      !("kind" in value) ||
      value.kind !== "execution-publication-pointer-v1" ||
      !("publicationDigest" in value) ||
      typeof value.publicationDigest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(value.publicationDigest) ||
      !exactBytes(bytes, renderExecutionPointer(value.publicationDigest))
    ) {
      return undefined;
    }
    return value.publicationDigest;
  } catch {
    return undefined;
  }
}

/** Parses only the canonical selection-pointer encoding used by reconciliation checks. */
export function parseExecutionSelectionPointerForConformanceV1(
  bytes: Uint8Array,
): string | undefined {
  return executionPointerDigest(bytes);
}

async function reconcileLiveSelection(
  passive: PublishedExecutionReleaseDescriptorV1,
  expectedDigest: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  const selected = readSecureSelectionFileV1(
    passive.repositoryRoot,
    passive.executionPointerPath,
    512,
  );
  const selectedDigest = selected.ok ? executionPointerDigest(selected.value) : undefined;
  const state =
    selectedDigest === undefined
      ? ("ambiguous" as const)
      : selectedDigest === expectedDigest
        ? ("committed" as const)
        : ("prior-selection" as const);
  try {
    await executionCatalogSelectionReconciliationObservationV1({
      operation: "execution-publication-selection",
      expectedDigest,
      ...(selectedDigest === undefined ? {} : { selectedDigest }),
      state,
    });
    await executionCatalogSelectionFaultPointV1("during-reconciliation", {
      expectedDigest,
      selectedDigest,
      state,
    });
  } catch {
    // Reconciliation remains indeterminate when observation or fault handling fails.
  }
  return selectionFailure(
    "execution.reconciliation",
    "",
    "Execution publication selection requires operator reconciliation.",
  );
}

/** Verifies all generated participant closures against current dependency bytes. */
export function assertGeneratedExecutionBindingsFreshV1(): ExecutionOperationResultV1<true> {
  const current = computeExecutionCatalogStateV1();
  return current.ok ? success(true) : current;
}

/** Resolves one passive release into separately branded live execution authority. */
export function resolveLiveExecutionContextV1(
  release: PublishedExecutionRelease,
): ExecutionOperationResultV1<LiveExecutionContextV1> {
  const current = computeExecutionCatalogStateV1();
  if (!current.ok) return current;
  const passive = getPublishedExecutionReleaseDescriptorV1(release);
  if (passive === undefined) {
    return failure("", "A genuine passive execution release is required.");
  }
  const exact = validateExactExecutionCatalogRowsV1(passive.bindings, current.value.rows);
  if (!exact.ok) return exact;
  const context = Object.freeze({}) as LiveExecutionContextV1;
  LIVE_CONTEXTS.set(context, Object.freeze({ release, handlers: FIXED_HANDLERS }));
  return success(context);
}

/**
 * Returns the fixed real route-handler table for a genuine live context.
 *
 * @throws {TypeError} When the value was not minted by the live catalog resolver.
 */
export function getPublishedExecutionHandlersV1(
  context: LiveExecutionContextV1,
): PublishedExecutionHandlersV1 {
  const state =
    typeof context === "object" && context !== null ? LIVE_CONTEXTS.get(context) : undefined;
  if (state === undefined) throw new TypeError("A genuine live execution context is required.");
  return state.handlers;
}

/**
 * Selects one child only after current and immediate pre-rename closure verification.
 *
 * @param root Canonical repository root.
 * @param digest Exact passive child digest.
 */
export async function selectExecutionPublicationByDigestV1(
  root: string,
  digest: string,
): Promise<ExecutionOperationResultV1<PublishedExecutionRelease>> {
  const passive = await resolvePublishedExecutionRelease(root, digest);
  if (!passive.ok) return passive;
  const descriptor = getPublishedExecutionReleaseDescriptorV1(passive.value);
  if (
    descriptor === undefined ||
    descriptor.repositoryRoot !== root ||
    descriptor.digest !== digest
  ) {
    return selectionFailure(
      "execution.identity",
      "/digest",
      "Execution release could not be pinned for operational selection.",
    );
  }
  const generated = validateExactExecutionCatalogRowsV1(
    descriptor.bindings,
    GENERATED_EXECUTION_HANDLER_CATALOG_V1.rows,
  );
  if (!generated.ok) return generated;
  const directory = pinSecureSelectionDirectoryV1(descriptor.executionPublicationRoot);
  if (!directory.ok) return directory;
  const temporaryPath = resolve(
    descriptor.executionPublicationRoot,
    `.execution-pointer.${randomUUID()}.tmp`,
  );
  const pointerBytes = renderExecutionPointer(digest);
  try {
    await executionCatalogSelectionFaultPointV1("before-pointer-write", {
      publicationDigest: digest,
    });
  } catch {
    return selectionFailure(
      "execution.io",
      "",
      "Execution pointer write fault boundary failed safely.",
    );
  }
  const written = writeSecureSelectionFileV1(directory.value, temporaryPath, pointerBytes);
  if (!written.ok) {
    const cleanup = cleanupSecureSelectionFileV1(temporaryPath, directory.value);
    return cleanup.ok ? written : cleanup;
  }
  try {
    await executionCatalogSelectionFaultPointV1("after-pointer-file-sync", {
      publicationDigest: digest,
    });
    await executionCatalogSelectionFaultPointV1("before-pointer-rename", {
      publicationDigest: digest,
    });
  } catch {
    const cleanup = cleanupSecureSelectionFileV1(temporaryPath, directory.value);
    return cleanup.ok
      ? selectionFailure("execution.io", "", "Execution precommit fault boundary failed safely.")
      : cleanup;
  }
  const faultBoundary = runExecutionCatalogDependencyFaultBoundaryV1();
  if (!faultBoundary.ok) {
    const cleanup = cleanupSecureSelectionFileV1(temporaryPath, directory.value);
    return cleanup.ok ? faultBoundary : cleanup;
  }
  const committed = guardAndRenameSelection(
    descriptor,
    directory.value,
    written.value,
    pointerBytes,
  );
  if (!committed.ok) {
    const cleanup = cleanupSecureSelectionFileV1(temporaryPath, directory.value);
    if (!cleanup.ok) return cleanup;
    return committed.issues[0].code === "execution.reconciliation"
      ? reconcileLiveSelection(descriptor, digest)
      : committed;
  }
  try {
    await executionCatalogSelectionFaultPointV1("after-pointer-rename", {
      publicationDigest: digest,
    });
  } catch {
    return reconcileLiveSelection(descriptor, digest);
  }
  const durable = synchronizeSecureSelectionDirectoryV1(
    directory.value,
    shouldFailExecutionCatalogDirectorySyncV1,
  );
  if (!durable.ok) return reconcileLiveSelection(descriptor, digest);
  try {
    await executionCatalogSelectionFaultPointV1("after-pointer-directory-sync", {
      publicationDigest: digest,
    });
  } catch {
    return reconcileLiveSelection(descriptor, digest);
  }
  const selected = await resolvePublishedExecutionRelease(root);
  if (!selected.ok) return reconcileLiveSelection(descriptor, digest);
  const selectedDescriptor = getPublishedExecutionReleaseDescriptorV1(selected.value);
  return selectedDescriptor?.digest === digest
    ? success(selected.value)
    : reconcileLiveSelection(descriptor, digest);
}
