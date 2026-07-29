import type { Sha256Digest } from "./model-registry-model.js";
import {
  readPublicationAuthorityFiles,
  validatePublicationImplementation,
} from "./publication-authority-loader.js";
import { COMPATIBLE_PUBLICATION_AUTHORITY_REVISION } from "./publication-authority-revision.generated.js";
import {
  publicationFailure,
  publicationSuccess,
  type PublicationResult,
} from "./publication-model.js";

/** Exact implementation content bound into compatible publication review identity. */
export interface PublicationImplementationAuthority {
  /** Fresh digest of the covered publication implementation. */
  readonly revision: Sha256Digest;
  /** Lexical dependency paths covered by the digest. */
  readonly dependencyPaths: readonly string[];
  /** Exact retained bytes used to validate the generated digest claim. */
  readonly authorityBytes: ReadonlyMap<string, Uint8Array>;
}

/**
 * Validates compatible publication code against a caller-retained authority snapshot.
 *
 * @param authorityBytes Exact bytes containing every generated implementation dependency.
 * @returns Retained implementation authority or a stable stale-review diagnostic.
 *
 * @example
 * ```ts
 * const authority = publicationImplementationAuthorityFromBytes(authorityBytes);
 * ```
 */
export function publicationImplementationAuthorityFromBytes(
  authorityBytes: ReadonlyMap<string, Uint8Array>,
): PublicationResult<PublicationImplementationAuthority> {
  const freshness = validatePublicationImplementation(
    COMPATIBLE_PUBLICATION_AUTHORITY_REVISION,
    authorityBytes,
  );
  if (!freshness.ok) {
    return publicationFailure(
      "invalid",
      "publication.review.stale",
      "/publicationImplementation",
      "Compatible publication implementation authority is stale.",
    );
  }
  return publicationSuccess(
    Object.freeze({
      revision: freshness.revision,
      dependencyPaths: COMPATIBLE_PUBLICATION_AUTHORITY_REVISION.dependencyPaths,
      authorityBytes,
    }),
  );
}

/**
 * Loads and freshness-checks the compatible publication implementation closure.
 *
 * @param repositoryRoot Canonical repository root.
 * @returns Retained exact implementation authority or stable publication diagnostics.
 *
 * @example
 * ```ts
 * const authority = await loadPublicationImplementationAuthority(repositoryRoot);
 * ```
 */
export async function loadPublicationImplementationAuthority(
  repositoryRoot: string,
): Promise<PublicationResult<PublicationImplementationAuthority>> {
  const loaded = await readPublicationAuthorityFiles(
    repositoryRoot,
    COMPATIBLE_PUBLICATION_AUTHORITY_REVISION.dependencyPaths,
  );
  if (!loaded.ok) return loaded;
  return publicationImplementationAuthorityFromBytes(loaded.value);
}
