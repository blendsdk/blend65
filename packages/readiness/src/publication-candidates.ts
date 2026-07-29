import type { FreshCandidateRegistration } from "./binding-model.js";
import {
  registerModeledCandidateBindings,
  type ModeledCandidateDiagnostic,
} from "./modeled-candidate-bindings.js";
import {
  MODELED_BOUNDARY_REVISION,
  MODELED_GENERATOR_REVISION,
  type GeneratedCandidateRevision,
} from "./modeled-candidate-revisions.generated.js";
import { type ImplementationRevisionInput } from "./implementation-revision.js";
import {
  registerOracleCandidateBindings,
  type OracleCandidateDiagnostic,
} from "./oracle-candidate-bindings.js";
import {
  ORACLE_COMPILER_RESULT_REVISION,
  ORACLE_EMITTED_PROGRAM_REVISION,
  ORACLE_FRONTEND_RESULT_REVISION,
  ORACLE_RUNTIME_STATE_REVISION,
  ORACLE_SEMANTIC_RELATIONS_REVISION,
} from "./oracle-candidate-revisions.generated.js";
import {
  readPublicationAuthorityFiles,
  validatePublicationImplementation,
} from "./publication-authority-loader.js";

/**
 * Exact handler identities eligible for a version-one publication.
 *
 * Keeping this profile separate from the catalog prevents future catalog additions from becoming
 * publishable before their own semantic review and publication-version decision.
 */
export const PUBLICATION_V1_HANDLER_IDS = Object.freeze([
  "generator.compiler-cases",
  "generator.frontend-cases",
  "generator.runtime-cases",
  "transform.boundary-variants",
] as const);

/** Exact additive handler identities eligible for the compatible staged release. */
export const RD03_PUBLICATION_HANDLER_IDS = Object.freeze([
  "oracle.compiler-result",
  "oracle.emitted-program",
  "oracle.frontend-result",
  "oracle.runtime-state",
  "transform.semantic-relations",
] as const);

const COMPATIBLE_HANDLER_IDS = Object.freeze(
  [...PUBLICATION_V1_HANDLER_IDS, ...RD03_PUBLICATION_HANDLER_IDS].sort(),
);
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

/** Result of loading the package-owned fixed publication candidate catalog. */
export type PublicationCandidateCatalogResult =
  | {
      readonly ok: true;
      readonly candidates: readonly FreshCandidateRegistration[];
      readonly authorityBytes: ReadonlyMap<string, Uint8Array>;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly (ModeledCandidateDiagnostic | OracleCandidateDiagnostic)[];
    };

/** Closed release-directed candidate-loading input. */
export interface LoadPublicationCandidatesInput {
  /** Canonical repository root containing exact implementation bytes. */
  readonly repositoryRoot: string;
  /** Lexical unique subset of compatible serialized handler IDs. */
  readonly handlerIds: readonly string[];
}

function dependencyInput(
  revision: GeneratedCandidateRevision,
  authorityBytes: ReadonlyMap<string, Uint8Array>,
): ImplementationRevisionInput {
  const metadata: ImplementationRevisionInput = {
    contractVersion: "1.0.0",
    entryPath: revision.entryPath,
    files: revision.dependencyPaths.map((path) => ({
      path,
      content: authorityBytes.get(path) ?? new Uint8Array(),
    })),
  };
  const freshness = validatePublicationImplementation(revision, authorityBytes);
  if (!freshness.ok) {
    throw new TypeError("Package-owned candidate dependency authority is stale.");
  }
  return metadata;
}

function candidateRevisions(handlerIds: readonly string[]): readonly GeneratedCandidateRevision[] {
  const wantsLegacy = handlerIds.some((handlerId) =>
    (PUBLICATION_V1_HANDLER_IDS as readonly string[]).includes(handlerId),
  );
  const wantsCompatible = handlerIds.some((handlerId) =>
    (RD03_PUBLICATION_HANDLER_IDS as readonly string[]).includes(handlerId),
  );
  return Object.freeze([
    ...(wantsLegacy ? [MODELED_GENERATOR_REVISION, MODELED_BOUNDARY_REVISION] : []),
    ...(wantsCompatible
      ? [
          ORACLE_FRONTEND_RESULT_REVISION,
          ORACLE_COMPILER_RESULT_REVISION,
          ORACLE_EMITTED_PROGRAM_REVISION,
          ORACLE_RUNTIME_STATE_REVISION,
          ORACLE_SEMANTIC_RELATIONS_REVISION,
        ]
      : []),
  ]);
}

/**
 * Loads exact checked-in dependency bytes and creates the four previously published candidates.
 *
 * This package-owned catalog is intentionally absent from the public package index.
 */
export async function loadPublicationCandidateCatalog(
  repositoryRoot: string,
): Promise<PublicationCandidateCatalogResult> {
  return loadPublicationCandidatesForHandlerIds({
    repositoryRoot,
    handlerIds: PUBLICATION_V1_HANDLER_IDS,
  });
}

function handlerIdsFromInput(input: unknown): readonly string[] | undefined {
  try {
    if (
      typeof input !== "object" ||
      input === null ||
      Array.isArray(input) ||
      Object.getPrototypeOf(input) !== Object.prototype ||
      Reflect.ownKeys(input).length !== 2
    ) {
      return undefined;
    }
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const root = descriptors.repositoryRoot;
    const ids = descriptors.handlerIds;
    if (
      root === undefined ||
      ids === undefined ||
      !("value" in root) ||
      !("value" in ids) ||
      !root.enumerable ||
      !ids.enumerable ||
      typeof root.value !== "string" ||
      !Array.isArray(ids.value) ||
      Object.getPrototypeOf(ids.value) !== Array.prototype ||
      Reflect.ownKeys(ids.value).some(
        (key, index) => key !== (index === ids.value.length ? "length" : String(index)),
      )
    ) {
      return undefined;
    }
    const values: string[] = [];
    for (let index = 0; index < ids.value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(ids.value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        !descriptor.enumerable ||
        typeof descriptor.value !== "string"
      ) {
        return undefined;
      }
      values.push(descriptor.value);
    }
    return Object.freeze(values);
  } catch {
    return undefined;
  }
}

function invalidHandlerIds(): PublicationCandidateCatalogResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code: "implementation.dependency.invalid",
        path: "/handlerIds",
        message: "Publication handler IDs must be an exact lexical compatible set.",
      }),
    ]),
  });
}

function validHandlerIds(handlerIds: readonly string[]): boolean {
  return (
    handlerIds.length > 0 &&
    handlerIds.every(
      (handlerId, index) =>
        COMPATIBLE_HANDLER_IDS.includes(handlerId as (typeof COMPATIBLE_HANDLER_IDS)[number]) &&
        (index === 0 || handlerIds[index - 1] < handlerId),
    )
  );
}

/**
 * Returns the lexical union of generated candidate implementation paths for one release profile.
 *
 * @param handlerIds Lexical compatible handler set.
 * @returns Unique authority paths, or `undefined` for an invalid handler set.
 *
 * @example
 * ```ts
 * const paths = publicationCandidateDependencyPaths(PUBLICATION_V1_HANDLER_IDS);
 * ```
 */
export function publicationCandidateDependencyPaths(
  handlerIds: readonly string[],
): readonly string[] | undefined {
  if (!validHandlerIds(handlerIds)) return undefined;
  return Object.freeze(
    [
      ...new Set(candidateRevisions(handlerIds).flatMap(({ dependencyPaths }) => dependencyPaths)),
    ].sort(),
  );
}

/**
 * Reconstructs exact candidates from a caller-retained implementation authority snapshot.
 *
 * @param handlerIds Lexical compatible handler set.
 * @param authorityBytes Exact bytes containing every generated dependency path.
 * @returns One fresh candidate per handler ID, retaining the supplied byte snapshot.
 *
 * @example
 * ```ts
 * const candidates = publicationCandidatesFromAuthority(handlerIds, authorityBytes);
 * ```
 */
export function publicationCandidatesFromAuthority(
  handlerIds: readonly string[],
  authorityBytes: ReadonlyMap<string, Uint8Array>,
): PublicationCandidateCatalogResult {
  if (!validHandlerIds(handlerIds)) return invalidHandlerIds();
  try {
    const candidates = new Map<string, FreshCandidateRegistration>();
    const revisions = candidateRevisions(handlerIds);
    for (const revision of revisions) {
      if (!validatePublicationImplementation(revision, authorityBytes).ok) {
        throw new TypeError("Package-owned candidate dependency authority is stale.");
      }
    }
    const wantsLegacy = handlerIds.some((handlerId) =>
      (PUBLICATION_V1_HANDLER_IDS as readonly string[]).includes(handlerId),
    );
    const wantsCompatible = handlerIds.some((handlerId) =>
      (RD03_PUBLICATION_HANDLER_IDS as readonly string[]).includes(handlerId),
    );
    if (wantsLegacy) {
      const generator = dependencyInput(MODELED_GENERATOR_REVISION, authorityBytes);
      const boundary = dependencyInput(MODELED_BOUNDARY_REVISION, authorityBytes);
      const legacy = registerModeledCandidateBindings({
        frontend: generator,
        compiler: generator,
        runtime: generator,
        boundary,
      });
      if (!legacy.ok) return legacy;
      for (const candidate of legacy.registrations) {
        candidates.set(candidate.binding.handlerId, candidate);
      }
    }
    if (wantsCompatible) {
      const registered = registerOracleCandidateBindings({
        frontendResult: dependencyInput(ORACLE_FRONTEND_RESULT_REVISION, authorityBytes),
        compilerResult: dependencyInput(ORACLE_COMPILER_RESULT_REVISION, authorityBytes),
        emittedProgram: dependencyInput(ORACLE_EMITTED_PROGRAM_REVISION, authorityBytes),
        runtimeState: dependencyInput(ORACLE_RUNTIME_STATE_REVISION, authorityBytes),
        semanticRelations: dependencyInput(ORACLE_SEMANTIC_RELATIONS_REVISION, authorityBytes),
      });
      if (!registered.ok) return registered;
      for (const candidate of registered.registrations) {
        candidates.set(candidate.binding.handlerId, candidate);
      }
    }
    const selected = handlerIds.map((handlerId) => candidates.get(handlerId));
    if (selected.some((candidate) => candidate === undefined)) return invalidHandlerIds();
    return Object.freeze({
      ok: true,
      candidates: Object.freeze(selected as FreshCandidateRegistration[]),
      authorityBytes,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return invalidHandlerIds();
  }
}

/**
 * Loads only the package-owned candidates named by serialized release rows.
 *
 * @param input Canonical root and lexical compatible handler set.
 * @returns One exact fresh candidate per requested handler ID.
 *
 * @example
 * ```ts
 * const loaded = await loadPublicationCandidatesForHandlerIds({
 *   repositoryRoot,
 *   handlerIds: RD03_PUBLICATION_HANDLER_IDS,
 * });
 * ```
 */
export async function loadPublicationCandidatesForHandlerIds(
  input: LoadPublicationCandidatesInput,
): Promise<PublicationCandidateCatalogResult> {
  const handlerIds = handlerIdsFromInput(input);
  if (handlerIds === undefined || !validHandlerIds(handlerIds)) {
    return invalidHandlerIds();
  }
  const paths = publicationCandidateDependencyPaths(handlerIds);
  if (paths === undefined) return invalidHandlerIds();
  const authorityBytes = await readPublicationAuthorityFiles(input.repositoryRoot, paths);
  if (!authorityBytes.ok) return invalidHandlerIds();
  return publicationCandidatesFromAuthority(handlerIds, authorityBytes.value);
}
