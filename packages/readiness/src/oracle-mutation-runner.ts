import { createHash } from "node:crypto";

import type { Sha256Digest } from "./model-registry-model.js";
import {
  isValidatedOracleMutationCatalog,
  oracleMutationVectorIdForPath,
  resolveOracleMutationPath,
  type ValidatedOracleMutationCatalogV1,
} from "./oracle-mutation-model.js";
import {
  runOracleMutationWorkerSelection,
  type OracleMutationWorkerFailureResultV1,
} from "./oracle-mutation-worker.js";
import type { OracleDiagnostic } from "./oracle-model.js";

/** Request for exhaustive execution of one exact validated mutation catalog. */
export interface OracleMutationRunRequestV1 {
  /** Exact-joined mutation catalog. */
  readonly catalog: ValidatedOracleMutationCatalogV1;
  /** Complete lexical set of private canonical vector IDs. */
  readonly vectorIds: readonly string[];
  /** Fixed per-worker deadline in milliseconds. */
  readonly deadlineMilliseconds: number;
}

/** Exhaustive mutation success or one closed harness failure. */
export type OracleMutationRunResultV1 =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Digest of the exact validated catalog value. */
      readonly catalogDigest: Sha256Digest;
      /** Number of required mutants. */
      readonly required: bigint;
      /** Number killed by their immutable assertions. */
      readonly killed: bigint;
      /** Lexical stable IDs of surviving mutants. */
      readonly survivors: readonly string[];
    }
  | OracleMutationWorkerFailureResultV1;

const CONCURRENCY = 2;

function diagnostic(message: string): OracleDiagnostic {
  return Object.freeze({
    code: "oracle.contract.invalid",
    path: "/mutationCatalog",
    message: message.slice(0, 512),
  });
}

function harnessFailure(
  mutantId: string,
  vectorId: string,
  message: string,
): OracleMutationWorkerFailureResultV1 {
  return Object.freeze({
    ok: false,
    failure: "harness-failure",
    mutantId,
    vectorId,
    diagnostic: diagnostic(message),
  });
}

function catalogDigest(catalog: ValidatedOracleMutationCatalogV1): Sha256Digest {
  const bytes = new TextEncoder().encode(JSON.stringify(catalog));
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function equalLexicalSets(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length || new Set(left).size !== left.length) return false;
  const sorted = [...left].sort();
  return sorted.every((value, index) => value === right[index]);
}

/**
 * Executes every required baseline/mutant vector pair in bounded dedicated workers.
 *
 * Worker or harness failures stop the run without kill credit. Ordinary surviving
 * mutants are reported only after every required row completes successfully.
 *
 * @param request Validated catalog, complete vector set, and fixed deadline.
 * @returns Exhaustive kill report or one closed worker/harness failure.
 *
 * @example
 * ```ts
 * const result = await runOracleMutationCatalog(request);
 * ```
 */
export async function runOracleMutationCatalog(
  request: OracleMutationRunRequestV1,
): Promise<OracleMutationRunResultV1> {
  try {
    if (!isValidatedOracleMutationCatalog(request.catalog)) {
      return harnessFailure("", "", "Mutation catalog lacks exact validation identity.");
    }
    const rows = request.catalog.mutants.map((mutant) => {
      const path = resolveOracleMutationPath(mutant);
      return Object.freeze({
        mutant,
        vectorId: oracleMutationVectorIdForPath(path),
      });
    });
    const requiredVectorIds = rows.map(({ vectorId }) => vectorId).sort();
    if (!equalLexicalSets(request.vectorIds, requiredVectorIds)) {
      return harnessFailure("", "", "Mutation vector IDs do not equal the complete required set.");
    }
    if (
      !Number.isSafeInteger(request.deadlineMilliseconds) ||
      request.deadlineMilliseconds < 1 ||
      request.deadlineMilliseconds > 60_000
    ) {
      return harnessFailure("", "", "Mutation worker deadline is outside fixed bounds.");
    }

    const results: Awaited<ReturnType<typeof runOracleMutationWorkerSelection>>[] = [];
    for (let offset = 0; offset < rows.length; offset += CONCURRENCY) {
      const batch = rows.slice(offset, offset + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(({ mutant, vectorId }) =>
          runOracleMutationWorkerSelection(mutant, vectorId, request.deadlineMilliseconds),
        ),
      );
      const failed = batchResults.find(
        (result): result is OracleMutationWorkerFailureResultV1 => !result.ok,
      );
      if (failed !== undefined) return failed;
      results.push(...batchResults);
    }
    const survivors = results
      .filter((result) => result.ok && !result.killed)
      .map(({ mutantId }) => mutantId)
      .sort();
    return Object.freeze({
      ok: true,
      catalogDigest: catalogDigest(request.catalog),
      required: BigInt(rows.length),
      killed: BigInt(rows.length - survivors.length),
      survivors: Object.freeze(survivors),
    });
  } catch {
    return harnessFailure("", "", "Mutation catalog execution failed closed.");
  }
}
