import { renderGeneratedCase } from "./case-generator.js";
import type { CampaignRendererBindingV1 } from "./campaign-model.js";
import {
  readPublicationAuthorityFiles,
  validatePublicationImplementation,
} from "./publication-authority-loader.js";
import { PUBLISHED_RENDERER_REVISION } from "./published-replay-authority.generated.js";

/** Retained renderer implementation and the exact bytes that authorized it. */
export interface PublishedRendererAuthority {
  /** Fresh renderer binding. */
  readonly binding: CampaignRendererBindingV1;
  /** Exact implementation closure bytes used for freshness validation. */
  readonly authorityBytes: ReadonlyMap<string, Uint8Array>;
}

/**
 * Validates the renderer against a caller-retained implementation authority snapshot.
 *
 * @param authorityBytes Exact bytes containing every generated renderer dependency.
 * @returns Fresh renderer binding retaining the supplied byte snapshot, or `undefined`.
 *
 * @example
 * ```ts
 * const renderer = publishedRendererAuthorityFromBytes(authorityBytes);
 * ```
 */
export function publishedRendererAuthorityFromBytes(
  authorityBytes: ReadonlyMap<string, Uint8Array>,
): PublishedRendererAuthority | undefined {
  const freshness = validatePublicationImplementation(PUBLISHED_RENDERER_REVISION, authorityBytes);
  return freshness.ok
    ? Object.freeze({
        binding: Object.freeze({
          implementationRevision: freshness.revision,
          implementation: renderGeneratedCase,
        }),
        authorityBytes,
      })
    : undefined;
}

/**
 * Freshness-checks the package renderer against its complete generated dependency authority.
 *
 * @param repositoryRoot Canonical repository root.
 * @returns Exact renderer binding, or `undefined` when any dependency is stale.
 */
export async function loadPublishedRendererAuthority(
  repositoryRoot: string,
): Promise<PublishedRendererAuthority | undefined> {
  const loaded = await readPublicationAuthorityFiles(
    repositoryRoot,
    PUBLISHED_RENDERER_REVISION.dependencyPaths,
  );
  if (!loaded.ok) return undefined;
  return publishedRendererAuthorityFromBytes(loaded.value);
}
