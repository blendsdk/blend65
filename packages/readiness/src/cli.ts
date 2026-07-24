import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { replaceFileAtomically, type PublicationHooks } from "./atomic-writer.js";
import { loadValidatedAuthority } from "./authority-loader.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { acquireGenerationLock } from "./generation-lock.js";
import type { InventoryDiagnostic, InventoryV1 } from "./model.js";
import {
  checkProjectionFreshness,
  renderGeneratedProjections,
  type GeneratedProjectionSet,
} from "./projection.js";

export const READINESS_PATHS = {
  inventory: "readiness/inventory/compiler-readiness-v1.json",
  identityLedger: "readiness/inventory/rule-identities-v1.jsonl",
  reviewEvidence: "readiness/reviews/compiler-readiness-v1-review.json",
  declarations: "packages/readiness/src/generated/declarations.ts",
  markdown: "readiness/generated/compiler-readiness.md",
  lock: "readiness/generated/.generation-lock",
} as const;

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

/** Runs the fixed-path projection trust gate or explicit generator. */
export async function runReadinessCommand(
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

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  if (command !== "check" && command !== "generate") {
    process.stderr.write("Usage: cli.js <check|generate>\n");
    process.exitCode = 2;
  } else {
    const result = await runReadinessCommand(command, process.cwd());
    for (const item of sortDiagnostics(result.diagnostics)) {
      process.stderr.write(`${item.code}: ${item.message}\n`);
    }
    process.exitCode = result.ok ? 0 : 1;
  }
}
