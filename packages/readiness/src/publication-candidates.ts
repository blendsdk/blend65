import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
import type { ImplementationRevisionInput } from "./implementation-revision.js";

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

/** Result of loading the package-owned fixed publication candidate catalog. */
export type PublicationCandidateCatalogResult =
  | {
      readonly ok: true;
      readonly candidates: readonly FreshCandidateRegistration[];
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledCandidateDiagnostic[];
    };

async function dependencyInput(
  repositoryRoot: string,
  revision: GeneratedCandidateRevision,
): Promise<ImplementationRevisionInput> {
  return {
    contractVersion: "1.0.0",
    entryPath: revision.entryPath,
    files: await Promise.all(
      revision.dependencyPaths.map(async (path) => ({
        path,
        content: await readFile(join(repositoryRoot, path)),
      })),
    ),
  };
}

/**
 * Loads exact checked-in dependency bytes and creates the four RD-02 fresh candidates.
 *
 * This package-owned catalog is intentionally absent from the public package index.
 */
export async function loadPublicationCandidateCatalog(
  repositoryRoot: string,
): Promise<PublicationCandidateCatalogResult> {
  try {
    const generator = await dependencyInput(repositoryRoot, MODELED_GENERATOR_REVISION);
    const boundary = await dependencyInput(repositoryRoot, MODELED_BOUNDARY_REVISION);
    const registered = registerModeledCandidateBindings({
      frontend: generator,
      compiler: generator,
      runtime: generator,
      boundary,
    });
    if (!registered.ok) return registered;
    const byHandlerId = new Map(
      registered.registrations.map((registration) => [
        registration.binding.handlerId,
        registration,
      ]),
    );
    const candidates: FreshCandidateRegistration[] = [];
    for (const handlerId of PUBLICATION_V1_HANDLER_IDS) {
      const candidate = byHandlerId.get(handlerId);
      if (candidate === undefined) {
        return {
          ok: false,
          diagnostics: [
            {
              code: "implementation.dependency.invalid",
              path: "",
              message: "The package-owned publication profile is incomplete.",
            },
          ],
        };
      }
      candidates.push(candidate);
    }
    return {
      ok: true,
      candidates,
      diagnostics: [],
    };
  } catch {
    return {
      ok: false,
      diagnostics: [
        {
          code: "implementation.dependency.invalid",
          path: "",
          message: "Publication candidate dependency closure could not be read.",
        },
      ],
    };
  }
}
