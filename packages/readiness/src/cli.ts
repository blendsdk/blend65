import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replaceFileAtomically, type PublicationHooks } from "./atomic-writer.js";
import { loadValidatedAuthority } from "./authority-loader.js";
import {
  PUBLICATION_SEMANTIC_REVIEW_SOURCE_PATH,
  publishBindingTransaction,
} from "./binding-publication.js";
import { createDiagnostic } from "./diagnostics.js";
import { acquireGenerationLock } from "./generation-lock.js";
import type { InventoryDiagnostic, InventoryV1 } from "./model.js";
import type { PublicationDiagnostic } from "./publication-model.js";
import { resolvePublishedSnapshot } from "./publication-resolver.js";
import {
  checkProjectionFreshness,
  renderGeneratedProjections,
  type GeneratedProjectionSet,
} from "./projection.js";
import {
  checkReadinessOracleBoundary,
  type ReadinessBoundaryDiagnosticV1,
} from "./readiness-boundary-scanner.js";

export const READINESS_PATHS = {
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
  declarations: "packages/readiness/src/generated/declarations.ts",
  markdown: "readiness/generated/compiler-readiness.md",
  lock: "readiness/generated/.generation-lock",
} as const;

type ReadinessCommandDiagnostic =
  | InventoryDiagnostic
  | PublicationDiagnostic
  | ReadinessBoundaryDiagnosticV1;

interface ReadinessCommandResult {
  readonly ok: boolean;
  readonly diagnostics: readonly ReadinessCommandDiagnostic[];
}

function diagnostic(code: string, path: string, message: string): InventoryDiagnostic {
  return createDiagnostic({ phase: "evolution", code, path, message });
}

async function optionalBytes(path: string): Promise<Uint8Array | undefined> {
  try {
    return await readFile(path);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

async function loadOutputs(
  inventory: InventoryV1,
): Promise<
  | { readonly ok: true; readonly outputs: GeneratedProjectionSet }
  | { readonly ok: false; readonly diagnostics: readonly InventoryDiagnostic[] }
> {
  const rendered = renderGeneratedProjections(inventory);
  return rendered.ok && rendered.outputs !== undefined
    ? { ok: true, outputs: rendered.outputs }
    : { ok: false, diagnostics: rendered.diagnostics };
}

async function loadAuthority(
  repositoryRoot: string,
): Promise<
  | { readonly ok: true; readonly inventory: InventoryV1; readonly outputs: GeneratedProjectionSet }
  | { readonly ok: false; readonly diagnostics: readonly InventoryDiagnostic[] }
> {
  const authority = await loadValidatedAuthority(repositoryRoot, READINESS_PATHS);
  if (!authority.ok) return authority;
  const rendered = await loadOutputs(authority.inventory);
  const result = rendered.ok
    ? { ok: true as const, inventory: authority.inventory, outputs: rendered.outputs }
    : rendered;
  return result;
}

/** Runs the fixed-path loose projection check or explicit generator. */
async function runSourceAuthoringCommand(
  command: "check" | "generate",
  repositoryRoot: string,
  hooks?: { readonly publication?: PublicationHooks },
): Promise<{ readonly ok: boolean; readonly diagnostics: readonly InventoryDiagnostic[] }> {
  const root = resolve(repositoryRoot);
  let lock: Awaited<ReturnType<typeof acquireGenerationLock>>;
  if (command === "generate") {
    await mkdir(dirname(join(root, READINESS_PATHS.lock)), { recursive: true });
    lock = await acquireGenerationLock(join(root, READINESS_PATHS.lock));
    if (lock === undefined) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "generation-lock.contended",
            READINESS_PATHS.lock,
            "Another live generator owns the readiness publication lock.",
          ),
        ],
      };
    }
  }

  try {
    const rendered = await loadAuthority(root);
    if (!rendered.ok) return rendered;

    if (command === "check") {
      const declarations = await optionalBytes(join(root, READINESS_PATHS.declarations));
      const markdown = await optionalBytes(join(root, READINESS_PATHS.markdown));
      const freshness = checkProjectionFreshness(rendered.outputs, {
        ...(declarations === undefined ? {} : { declarations }),
        ...(markdown === undefined ? {} : { markdown }),
      });
      return { ok: freshness.ok, diagnostics: freshness.diagnostics };
    }

    await mkdir(dirname(join(root, READINESS_PATHS.declarations)), { recursive: true });
    await mkdir(dirname(join(root, READINESS_PATHS.markdown)), { recursive: true });
    try {
      await replaceFileAtomically(
        join(root, READINESS_PATHS.declarations),
        rendered.outputs.declarations,
        "declarations",
        hooks?.publication,
      );
      await replaceFileAtomically(
        join(root, READINESS_PATHS.markdown),
        rendered.outputs.markdown,
        "markdown",
        hooks?.publication,
      );
    } catch {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "publication.failed",
            "readiness/generated",
            "The generated projection pair could not be published.",
          ),
        ],
      };
    }
    const declarations = await optionalBytes(join(root, READINESS_PATHS.declarations));
    const markdown = await optionalBytes(join(root, READINESS_PATHS.markdown));
    const freshness = checkProjectionFreshness(rendered.outputs, {
      ...(declarations === undefined ? {} : { declarations }),
      ...(markdown === undefined ? {} : { markdown }),
    });
    return { ok: freshness.ok, diagnostics: freshness.diagnostics };
  } catch {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "publication.input-read",
          READINESS_PATHS.inventory,
          "Readiness input could not be read.",
        ),
      ],
    };
  } finally {
    await lock?.release();
  }
}

async function runSelectedPublicationCommand(
  command: "check" | "publish",
  repositoryRoot: string,
): Promise<ReadinessCommandResult> {
  const root = resolve(repositoryRoot);
  if (command === "check") {
    const resolved = await resolvePublishedSnapshot({
      repositoryRoot: root,
    });
    return { ok: resolved.ok, diagnostics: resolved.diagnostics };
  }
  let semanticReviewBytes: Uint8Array;
  try {
    semanticReviewBytes = await readFile(join(root, PUBLICATION_SEMANTIC_REVIEW_SOURCE_PATH));
  } catch {
    return {
      ok: false,
      diagnostics: [
        {
          code: "publication.io",
          path: PUBLICATION_SEMANTIC_REVIEW_SOURCE_PATH,
          message: "Staged semantic-review evidence could not be read.",
        },
      ],
    };
  }
  const published = await publishBindingTransaction({
    repositoryRoot: root,
    semanticReviewBytes,
  });
  return { ok: published.ok, diagnostics: published.diagnostics };
}

/**
 * Runs one closed readiness command without granting authority to loose source artifacts.
 *
 * @param command Exact source-authoring, generation, selected-check or publication command.
 * @param repositoryRoot Repository root used by the fixed package-owned paths.
 * @param hooks Legacy loose-projection publication hooks used only by `generate`.
 * @returns Deterministic command status and sorted diagnostics.
 */
export async function runReadinessCommand(
  command: "source-check" | "generate" | "check" | "publish",
  repositoryRoot: string,
  hooks?: { readonly publication?: PublicationHooks },
): Promise<ReadinessCommandResult> {
  if (command === "source-check") {
    const projection = await runSourceAuthoringCommand("check", repositoryRoot, hooks);
    if (!projection.ok) return projection;
    const boundary = await checkReadinessOracleBoundary(repositoryRoot);
    return { ok: boundary.ok, diagnostics: boundary.diagnostics };
  }
  if (command === "generate") {
    return runSourceAuthoringCommand("generate", repositoryRoot, hooks);
  }
  return runSelectedPublicationCommand(command, repositoryRoot);
}

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
const modulePath = fileURLToPath(import.meta.url);
const invocationIndex = process.argv.findIndex((value, index) => {
  if (index === 0 || value.startsWith("-")) return false;
  try {
    return resolve(value) === modulePath;
  } catch {
    return false;
  }
});
if (invokedPath === modulePath || invocationIndex > 0) {
  const argumentOffset = invocationIndex > 0 ? invocationIndex : 1;
  const command = process.argv[argumentOffset + 1];
  const commandArguments = process.argv.slice(argumentOffset + 1);
  if (
    commandArguments.length !== 1 ||
    (command !== "source-check" &&
      command !== "generate" &&
      command !== "check" &&
      command !== "publish")
  ) {
    process.stderr.write("Usage: cli.js <source-check|generate|check|publish>\n");
    process.exitCode = 2;
  } else {
    const result = await runReadinessCommand(command, process.cwd());
    for (const item of [...result.diagnostics].sort(
      (left, right) =>
        left.code.localeCompare(right.code) ||
        left.path.localeCompare(right.path) ||
        left.message.localeCompare(right.message),
    )) {
      process.stderr.write(`${item.code}: ${item.path}: ${item.message}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  }
}
