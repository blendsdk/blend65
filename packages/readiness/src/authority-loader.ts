import { createHash } from "node:crypto";
import { lstat, readdir, readFile, realpath } from "node:fs/promises";
import { join } from "node:path";
import { createDiagnostic } from "./diagnostics.js";
import { INVENTORY_V1_LIMITS } from "./limits.js";
import type { InventoryDiagnostic, InventoryV1, ResolvedSourceFragment } from "./model.js";
import { computeInventoryReviewDigests, INVENTORY_REVIEW_UNIT_IDS } from "./review-digests.js";
import { validateReviewEvidence, type SemanticReviewRecord } from "./review-evidence.js";
import { createSourceRepository, validateInventorySources } from "./source-repository.js";
import { validateInventorySemantics } from "./semantic-validator.js";
import { readInventoryVersioned } from "./versioning.js";

export interface AuthorityPaths {
  readonly inventory: string;
  readonly identityLedger: string;
  readonly reviewEvidence: string;
}

type AuthorityLoadFailure = {
  readonly ok: false;
  readonly diagnostics: readonly InventoryDiagnostic[];
};

export type AuthorityLoadResult =
  | { readonly ok: true; readonly inventory: InventoryV1 }
  | AuthorityLoadFailure;

/** Validated loose authority inputs needed to derive staged semantic-review digests. */
export interface PublicationAuthorityContext {
  readonly inventory: InventoryV1;
  readonly fragments: readonly ResolvedSourceFragment[];
  readonly identityLedgerBytes: Uint8Array;
}

/** Result of loading validated loose authority for publication preparation. */
export type PublicationAuthorityContextResult =
  | { readonly ok: true; readonly context: PublicationAuthorityContext }
  | AuthorityLoadFailure;

interface ValidatedAuthorityState {
  readonly inventory: InventoryV1;
  readonly publicationContext: PublicationAuthorityContext;
}

type AuthorityValidationResult =
  | { readonly ok: true; readonly state: ValidatedAuthorityState }
  | AuthorityLoadFailure;

interface AuthorityLoadTestHooks {
  readonly afterValidation?: () => void | Promise<void>;
}

let cachedAuthority:
  | { readonly fingerprint: string; readonly result: Promise<AuthorityValidationResult> }
  | undefined;

function failure(code: string, path: string, message: string): AuthorityLoadFailure {
  return {
    ok: false,
    diagnostics: [createDiagnostic({ phase: "ledger", code, path, message })],
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sorted = [...expected].sort();
  return actual.length === sorted.length && actual.every((key, index) => key === sorted[index]);
}

function parseReviewRecord(value: unknown): SemanticReviewRecord | undefined {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, [
      "unitId",
      "reviewer",
      "specRevision",
      "semanticDigest",
      "dependencyDigests",
      "outcome",
      "resolvedDisagreementIds",
    ]) ||
    typeof value.unitId !== "string" ||
    typeof value.reviewer !== "string" ||
    typeof value.specRevision !== "string" ||
    typeof value.semanticDigest !== "string" ||
    !isRecord(value.dependencyDigests) ||
    Object.values(value.dependencyDigests).some((digest) => typeof digest !== "string") ||
    (value.outcome !== "accepted" && value.outcome !== "blocked") ||
    !Array.isArray(value.resolvedDisagreementIds) ||
    value.resolvedDisagreementIds.some((id) => typeof id !== "string")
  ) {
    return undefined;
  }
  return {
    unitId: value.unitId,
    reviewer: value.reviewer,
    specRevision: value.specRevision,
    semanticDigest: value.semanticDigest,
    dependencyDigests: Object.fromEntries(
      Object.entries(value.dependencyDigests).map(([key, digest]) => [key, String(digest)]),
    ),
    outcome: value.outcome,
    resolvedDisagreementIds: value.resolvedDisagreementIds,
  };
}

/** Parses the closed semantic-review evidence envelope used by the authority gate. */
export function parseSemanticReviewEvidence(
  bytes: Uint8Array,
): readonly SemanticReviewRecord[] | undefined {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ["schemaVersion", "reviews"]) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.reviews)
  ) {
    return undefined;
  }
  const records: SemanticReviewRecord[] = [];
  for (const candidate of value.reviews) {
    const record = parseReviewRecord(candidate);
    if (record === undefined) return undefined;
    records.push(record);
  }
  return records;
}

async function hashTree(
  hash: ReturnType<typeof createHash>,
  root: string,
  relative = "",
): Promise<void> {
  const directory = join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
    hash.update(path).update("\0");
    if (entry.isDirectory()) {
      hash.update("directory\0");
      await hashTree(hash, root, path);
    } else if (entry.isFile()) {
      hash
        .update("file\0")
        .update(await readFile(join(root, path)))
        .update("\0");
    } else {
      hash.update("unsupported\0");
    }
  }
}

async function authorityFingerprint(
  repositoryRoot: string,
  paths: AuthorityPaths,
): Promise<string> {
  const hash = createHash("sha256").update("blend65.readiness-authority.v1\0");
  for (const path of [paths.inventory, paths.identityLedger, paths.reviewEvidence]) {
    hash
      .update(path)
      .update("\0")
      .update(await readFile(join(repositoryRoot, path)))
      .update("\0");
  }
  await hashTree(hash, join(repositoryRoot, "spec"));
  return hash.digest("hex");
}

async function rejectSymlinkPath(repositoryRoot: string, relativePath: string): Promise<void> {
  const canonicalRoot = await realpath(repositoryRoot);
  const parts = relativePath.split("/");
  let current = canonicalRoot;
  for (const part of parts) {
    if (part === "" || part === "." || part === "..")
      throw new Error("Non-canonical authority path.");
    current = join(current, part);
    if ((await lstat(current)).isSymbolicLink()) throw new Error("Symlink authority path.");
  }
}

async function validateFixedAuthorityPaths(
  repositoryRoot: string,
  paths: AuthorityPaths,
): Promise<void> {
  await Promise.all([
    rejectSymlinkPath(repositoryRoot, paths.inventory),
    rejectSymlinkPath(repositoryRoot, paths.identityLedger),
    rejectSymlinkPath(repositoryRoot, paths.reviewEvidence),
    rejectSymlinkPath(repositoryRoot, "spec"),
  ]);
}

/** Loads and validates every authority dependency required before projection. */
async function validateAuthority(
  repositoryRoot: string,
  paths: AuthorityPaths,
): Promise<AuthorityValidationResult> {
  try {
    const inventoryBytes = await readFile(join(repositoryRoot, paths.inventory));
    const dispatched = readInventoryVersioned(inventoryBytes);
    if (!dispatched.ok || dispatched.inventory === undefined) {
      return { ok: false, diagnostics: dispatched.diagnostics };
    }
    const repository = await createSourceRepository({
      repositoryRoot,
      specRoot: join(repositoryRoot, "spec"),
      limits: INVENTORY_V1_LIMITS,
    });
    const sources = await validateInventorySources(repository, dispatched.inventory);
    if (!sources.ok || sources.inventory === undefined || sources.resolvedFragments === undefined) {
      return { ok: false, diagnostics: sources.diagnostics };
    }
    const identityLedgerBytes = await readFile(join(repositoryRoot, paths.identityLedger));
    const fragments = sources.resolvedFragments;
    const semantics = validateInventorySemantics(sources.inventory, {
      fragments,
      identityLedgerBytes,
      limits: INVENTORY_V1_LIMITS,
    });
    if (!semantics.ok || semantics.inventory === undefined) {
      return { ok: false, diagnostics: semantics.diagnostics };
    }
    const reviewBytes = await readFile(join(repositoryRoot, paths.reviewEvidence));
    const reviews = parseSemanticReviewEvidence(reviewBytes);
    if (reviews === undefined) {
      return failure(
        "review-evidence.invalid-shape",
        paths.reviewEvidence,
        "Review evidence does not satisfy its closed runtime shape.",
      );
    }
    const digests = computeInventoryReviewDigests(
      semantics.inventory,
      fragments,
      identityLedgerBytes,
    );
    const evidence = validateReviewEvidence(reviews, {
      expectedSpecRevision: semantics.inventory.specRevision,
      requiredUnitIds: INVENTORY_REVIEW_UNIT_IDS,
      requiredDependencyIdsByUnit: digests.requiredDependencyIdsByUnit,
      currentDigests: digests.currentDigests,
    });
    if (!evidence.ok) return { ok: false, diagnostics: evidence.diagnostics };
    const publicationContext = Object.freeze({
      inventory: semantics.inventory,
      fragments,
      identityLedgerBytes,
    });
    return {
      ok: true,
      state: Object.freeze({
        inventory: semantics.inventory,
        publicationContext,
      }),
    };
  } catch {
    return failure(
      "review-evidence.authority-read",
      repositoryRoot,
      "Readiness authority could not be loaded and validated.",
    );
  }
}

/**
 * Loads the validated loose inventory plus exact digest inputs used by publication preparation.
 *
 * This is not a published readiness capability; only the digest-verified resolver can produce one.
 */
export async function loadPublicationAuthorityContext(
  repositoryRoot: string,
  paths: AuthorityPaths,
): Promise<PublicationAuthorityContextResult> {
  const result = await loadValidatedAuthorityState(repositoryRoot, paths);
  return result.ok ? { ok: true, context: result.state.publicationContext } : result;
}

/**
 * Loads the complete validated authority state behind both public views.
 *
 * Sharing this cache is important because semantic validation covers every inventory rule.
 * Callers asking for publication inputs must not repeat that expensive validation after the
 * loose-authority loader has already accepted the exact same dependency fingerprint.
 */
async function loadValidatedAuthorityState(
  repositoryRoot: string,
  paths: AuthorityPaths,
  testHooks?: AuthorityLoadTestHooks,
): Promise<AuthorityValidationResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let fingerprint: string;
    try {
      await validateFixedAuthorityPaths(repositoryRoot, paths);
      fingerprint = await authorityFingerprint(repositoryRoot, paths);
    } catch {
      return failure(
        "review-evidence.authority-read",
        repositoryRoot,
        "Readiness authority could not be fingerprinted.",
      );
    }
    if (cachedAuthority?.fingerprint === fingerprint) return cachedAuthority.result;
    const result = await validateAuthority(repositoryRoot, paths);
    await testHooks?.afterValidation?.();
    let completedFingerprint: string;
    try {
      await validateFixedAuthorityPaths(repositoryRoot, paths);
      completedFingerprint = await authorityFingerprint(repositoryRoot, paths);
    } catch {
      continue;
    }
    if (completedFingerprint !== fingerprint) continue;
    const completed = Promise.resolve(result);
    cachedAuthority = { fingerprint, result: completed };
    return result;
  }
  return failure(
    "review-evidence.authority-changed",
    repositoryRoot,
    "Readiness authority changed while it was being validated.",
  );
}

/** Loads and validates authority, reusing only a complete dependency-identical result. */
export async function loadValidatedAuthority(
  repositoryRoot: string,
  paths: AuthorityPaths,
  testHooks?: AuthorityLoadTestHooks,
): Promise<AuthorityLoadResult> {
  const result = await loadValidatedAuthorityState(repositoryRoot, paths, testHooks);
  return result.ok ? { ok: true, inventory: result.state.inventory } : result;
}
