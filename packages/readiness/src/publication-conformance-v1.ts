import { AsyncLocalStorage } from "node:async_hooks";

import type { Sha256Digest } from "./model-registry-model.js";
import {
  inspectPublicationLimits,
  publicationFailure,
  type PublicationResult,
} from "./publication-model.js";

/** Durable publication points available to crash and failure-injection specifications. */
export type PublicationFaultPoint =
  | "after-publication-directory-sync"
  | "after-member-sync"
  | "after-staging-directory-sync"
  | "before-release-rename"
  | "after-release-rename"
  | "after-releases-directory-sync"
  | "before-staged-validation"
  | "after-staged-validation"
  | "after-pointer-temporary-sync"
  | "after-pointer-rename"
  | "after-publication-root-sync";

/** Internal filesystem race and failure boundaries available to implementation tests. */
export type PublicationFilesystemFaultPoint =
  | "after-directory-lstat"
  | "before-directory-sync"
  | "after-file-lstat"
  | "after-file-open"
  | "before-file-read"
  | "after-file-read"
  | "after-output-open"
  | "after-file-sync"
  | "after-directory-enumeration"
  | "before-remove";

/** Operation-scoped conformance hooks for publication fault injection. */
export interface PublicationConformanceHooks {
  /** Called immediately after one named durable publication transition. */
  readonly atFaultPoint?: (
    point: PublicationFaultPoint,
    context: {
      readonly publicationDigest?: Sha256Digest;
      readonly memberPath?: string;
    },
  ) => void | Promise<void>;
  /** Called at one internal filesystem boundary without changing production defaults. */
  readonly atFilesystemPoint?: (
    point: PublicationFilesystemFaultPoint,
    context: { readonly path: string },
  ) => void | Promise<void>;
  /** Optional deterministic digest replacement used only by collision specifications. */
  readonly digest?: (domain: string, bytes: Uint8Array) => Sha256Digest;
  /** Forces a typed result on platforms without the required durability contract. */
  readonly forceDurabilityUnsupported?: boolean;
  /** Forces package-owned staged invariant validation to fail before pointer replacement. */
  readonly forceStagedValidationFailure?: boolean;
}

/** Closed numeric input to the version-one publication limit inspector. */
export interface PublicationLimitInspectionInput {
  readonly pointerBytes: number;
  readonly manifestBytes: number;
  readonly bindingBytes: number;
  readonly semanticReviewBytes: number;
  readonly memberCount: number;
  readonly memberBytes: number;
  readonly totalReleaseBytes: number;
}

/** One production file supplied to the pure publication-boundary validator. */
export interface PublicationBoundaryFile {
  readonly path: string;
  readonly source: string;
}

const CONFORMANCE = new AsyncLocalStorage<PublicationConformanceHooks>();
const ALLOWED_PUBLICATION_MODULES: ReadonlySet<string> = new Set([
  "binding-publication.ts",
  "publication-conformance-v1.ts",
  "publication-model.ts",
  "publication-pointer.ts",
  "publication-resolver.ts",
  "publication-review.ts",
]);
const PUBLICATION_LITERAL =
  /(?:readiness\/publications|current-publication\.json|bindings-v1\.json|semantic-review-v1\.json|manifest\.json)/u;
const SNAPSHOT_CONSTRUCTION =
  /(?:\bas\s+PublishedSnapshot\b|:\s*PublishedSnapshot\s*=\s*(?:Object\.freeze\s*\()?[{[])/u;

/**
 * Runs one operation with isolated async publication conformance hooks.
 *
 * @param hooks Closed operation-local failure and digest hooks.
 * @param operation Async operation that consumes the hooks.
 * @returns The operation's exact result.
 */
export function runWithPublicationConformance<T>(
  hooks: PublicationConformanceHooks,
  operation: () => Promise<T>,
): Promise<T> {
  return CONFORMANCE.run(Object.freeze({ ...hooks }), operation);
}

/** Returns the hooks scoped to the current async publication operation. */
export function currentPublicationConformance(): PublicationConformanceHooks | undefined {
  return CONFORMANCE.getStore();
}

/** Invokes one scoped publication fault point when configured. */
export async function publicationFaultPoint(
  point: PublicationFaultPoint,
  context: {
    readonly publicationDigest?: Sha256Digest;
    readonly memberPath?: string;
  } = {},
): Promise<void> {
  await CONFORMANCE.getStore()?.atFaultPoint?.(point, context);
}

/** Invokes one scoped internal filesystem fault point when configured. */
export async function publicationFilesystemFaultPoint(
  point: PublicationFilesystemFaultPoint,
  path: string,
): Promise<void> {
  await CONFORMANCE.getStore()?.atFilesystemPoint?.(point, { path });
}

/**
 * Applies every exact and aggregate version-one publication resource limit.
 *
 * @param input Closed measured sizes supplied by a conformance test.
 * @returns Success at every exact limit and a typed failure above any limit.
 */
export function inspectPublicationLimitsForTest(
  input: PublicationLimitInspectionInput,
): PublicationResult<true> {
  return inspectPublicationLimits(input);
}

/**
 * Validates that publication authority cannot leak into ordinary production modules.
 *
 * @param files Complete production source records discovered by the boundary test.
 * @returns Success only when path constants and snapshot construction stay in exact owners.
 */
export function validatePublicationModuleBoundary(
  files: readonly PublicationBoundaryFile[],
): PublicationResult<true> {
  if (!Array.isArray(files) || files.length > 512) {
    return publicationFailure(
      "invalid",
      "publication.input.invalid",
      "/files",
      "Publication boundary input must be a bounded file array.",
    );
  }
  const seen = new Set<string>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const path = `/files/${index}`;
    if (
      typeof file !== "object" ||
      file === null ||
      typeof file.path !== "string" ||
      typeof file.source !== "string" ||
      seen.has(file.path)
    ) {
      return publicationFailure(
        "invalid",
        "publication.input.invalid",
        path,
        "Publication boundary file must have one unique path and source.",
      );
    }
    seen.add(file.path);
    if (
      !ALLOWED_PUBLICATION_MODULES.has(file.path) &&
      (PUBLICATION_LITERAL.test(file.source) || SNAPSHOT_CONSTRUCTION.test(file.source))
    ) {
      return publicationFailure(
        "invalid",
        "publication.path.invalid",
        file.path,
        "Publication path authority or snapshot construction escaped its owning modules.",
      );
    }
  }
  return { ok: true, value: true, diagnostics: [] };
}
