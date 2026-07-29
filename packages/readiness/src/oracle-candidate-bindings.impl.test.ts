import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isFreshCandidateRegistration } from "./binding-validator.js";
import type { ImplementationRevisionInput } from "./implementation-revision.js";
import { registerOracleCandidateBindings } from "./oracle-candidate-bindings.js";
import { evaluateCompilerResultCandidate } from "./oracle-compiler-result-candidate.js";
import { evaluateEmittedProgramCandidate } from "./oracle-emitted-program-candidate.js";
import { evaluateFrontendResultCandidate } from "./oracle-frontend-result-candidate.js";
import type { OracleSuite } from "./oracle-model.js";
import { evaluateRuntimeStateCandidate } from "./oracle-runtime-state-candidate.js";
import {
  ORACLE_COMPILER_RESULT_REVISION,
  ORACLE_EMITTED_PROGRAM_REVISION,
  ORACLE_FRONTEND_RESULT_REVISION,
  ORACLE_RUNTIME_STATE_REVISION,
  ORACLE_SEMANTIC_RELATIONS_REVISION,
} from "./oracle-candidate-revisions.generated.js";
import {
  loadPublicationCandidatesForHandlerIds,
  RD03_PUBLICATION_HANDLER_IDS,
} from "./publication-candidates.js";
import { createOraclePublicationSpecFixture } from "./test-fixtures/oracle-publication-spec-fixture.js";

async function metadata(
  entryPath: string,
  dependencyPaths: readonly string[],
): Promise<ImplementationRevisionInput> {
  return {
    contractVersion: "1.0.0",
    entryPath,
    files: await Promise.all(
      dependencyPaths.map(async (path) => ({
        path,
        content: await readFile(new URL(`../../../${path}`, import.meta.url)),
      })),
    ),
  };
}

async function dependencies(): Promise<{
  readonly frontendResult: ImplementationRevisionInput;
  readonly compilerResult: ImplementationRevisionInput;
  readonly emittedProgram: ImplementationRevisionInput;
  readonly runtimeState: ImplementationRevisionInput;
  readonly semanticRelations: ImplementationRevisionInput;
}> {
  const dependencyPaths = ORACLE_FRONTEND_RESULT_REVISION.dependencyPaths;
  const files = (await metadata(ORACLE_FRONTEND_RESULT_REVISION.entryPath, dependencyPaths)).files;
  const forEntry = (entryPath: string): ImplementationRevisionInput => ({
    contractVersion: "1.0.0",
    entryPath,
    files,
  });
  return {
    frontendResult: forEntry(ORACLE_FRONTEND_RESULT_REVISION.entryPath),
    compilerResult: forEntry(ORACLE_COMPILER_RESULT_REVISION.entryPath),
    emittedProgram: forEntry(ORACLE_EMITTED_PROGRAM_REVISION.entryPath),
    runtimeState: forEntry(ORACLE_RUNTIME_STATE_REVISION.entryPath),
    semanticRelations: forEntry(ORACLE_SEMANTIC_RELATIONS_REVISION.entryPath),
  };
}

describe("oracle candidate registrations", () => {
  it.each([
    [evaluateFrontendResultCandidate, "oracle.compiler-result"],
    [evaluateCompilerResultCandidate, "oracle.emitted-program"],
    [evaluateEmittedProgramCandidate, "oracle.runtime-state"],
    [evaluateRuntimeStateCandidate, "oracle.frontend-result"],
  ] as const)(
    "rejects a cross-handler request before adapter evaluation",
    (evaluate, handlerId) => {
      expect(evaluate({} as OracleSuite, { handlerId })).toMatchObject({
        ok: false,
        diagnostics: [{ code: "oracle.route.invalid", path: "/handlerId" }],
      });
    },
  );

  it("freshness-gates five independent candidates against generated closure authority", async () => {
    const result = registerOracleCandidateBindings(await dependencies());

    expect(result).toMatchObject({ ok: true, diagnostics: [] });
    if (!result.ok) return;
    expect(result.registrations.map(({ binding }) => binding.handlerId)).toEqual([
      "oracle.compiler-result",
      "oracle.emitted-program",
      "oracle.frontend-result",
      "oracle.runtime-state",
      "transform.semantic-relations",
    ]);
    expect(result.registrations.every(isFreshCandidateRegistration)).toBe(true);
    expect(
      new Set(result.registrations.map(({ binding }) => binding.implementationRevision)),
    ).toHaveLength(5);
  });

  it("rejects changed package bytes instead of publishing a newly derived revision", async () => {
    const fixture = await createOraclePublicationSpecFixture();
    try {
      const path = join(fixture.repositoryRoot, "packages/readiness/src/oracle-handlers.ts");
      const original = await readFile(path);
      await writeFile(path, new Uint8Array([...original, 0x0a]));

      expect(
        await loadPublicationCandidatesForHandlerIds({
          repositoryRoot: fixture.repositoryRoot,
          handlerIds: RD03_PUBLICATION_HANDLER_IDS,
        }),
      ).toMatchObject({
        ok: false,
        diagnostics: [{ code: "implementation.dependency.invalid" }],
      });
    } finally {
      await fixture.cleanup();
    }
  });

  it("fails closed without invoking accessor-backed input", () => {
    const getter = () => {
      throw new Error("must not execute");
    };
    const hostile = Object.defineProperty({}, "frontendResult", {
      enumerable: true,
      get: getter,
    });

    expect(() => registerOracleCandidateBindings(hostile)).not.toThrow();
    expect(registerOracleCandidateBindings(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "implementation.input.invalid" }],
    });
  });
});
