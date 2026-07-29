import type { FreshCandidateRegistration, ValidatedBindingRegistry } from "./binding-model.js";
import { registerFreshCandidateBinding, validateCandidateBindings } from "./binding-validator.js";
import {
  deriveImplementationRevision,
  validateImplementationRevision,
  type ImplementationRevisionDiagnostic,
  type ImplementationRevisionInput,
} from "./implementation-revision.js";
import type { ModelBindingDiagnostic } from "./model-registry-model.js";
import { evaluateCompilerResultCandidate } from "./oracle-compiler-result-candidate.js";
import { evaluateEmittedProgramCandidate } from "./oracle-emitted-program-candidate.js";
import { evaluateFrontendResultCandidate } from "./oracle-frontend-result-candidate.js";
import { evaluateRuntimeStateCandidate } from "./oracle-runtime-state-candidate.js";
import { evaluateSemanticRelationsCandidate } from "./oracle-semantic-relations-candidate.js";

/** Exact dependency closures for the five independent oracle candidates. */
export interface OracleCandidateDependencyInput {
  /** Frontend-result adapter closure. */
  readonly frontendResult: ImplementationRevisionInput;
  /** Compiler-result adapter closure. */
  readonly compilerResult: ImplementationRevisionInput;
  /** Emitted-program adapter closure. */
  readonly emittedProgram: ImplementationRevisionInput;
  /** Runtime-state adapter closure. */
  readonly runtimeState: ImplementationRevisionInput;
  /** Semantic-relation adapter closure. */
  readonly semanticRelations: ImplementationRevisionInput;
}

/** Failure emitted while deriving or registering an oracle candidate. */
export type OracleCandidateDiagnostic = ImplementationRevisionDiagnostic | ModelBindingDiagnostic;

/** Result of creating five freshness-gated candidate registrations. */
export type OracleCandidateRegistrationResult =
  | {
      readonly ok: true;
      readonly registrations: readonly FreshCandidateRegistration[];
      readonly bindings: ValidatedBindingRegistry;
      readonly diagnostics: readonly [];
    }
  | { readonly ok: false; readonly diagnostics: readonly OracleCandidateDiagnostic[] };

const INPUT_KEYS = [
  "frontendResult",
  "compilerResult",
  "emittedProgram",
  "runtimeState",
  "semanticRelations",
] as const;
const INPUT_KEY_SET: ReadonlySet<string> = new Set(INPUT_KEYS);
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const DECLARATIONS = Object.freeze([
  Object.freeze({
    id: "oracle.compiler-result",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "oracle.emitted-program",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "oracle.frontend-result",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "oracle.runtime-state",
    kind: "oracle",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "transform.semantic-relations",
    kind: "transform",
    owner: "readiness-rd03",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotInput(value: unknown): OracleCandidateDependencyInput | undefined {
  try {
    if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      keys.length !== INPUT_KEYS.length ||
      !keys.every((key) => typeof key === "string" && INPUT_KEY_SET.has(key)) ||
      !INPUT_KEYS.every((key) => {
        const descriptor = descriptors[key];
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    ) {
      return undefined;
    }
    return {
      frontendResult: descriptors.frontendResult?.value,
      compilerResult: descriptors.compilerResult?.value,
      emittedProgram: descriptors.emittedProgram?.value,
      runtimeState: descriptors.runtimeState?.value,
      semanticRelations: descriptors.semanticRelations?.value,
    } as OracleCandidateDependencyInput;
  } catch {
    return undefined;
  }
}

function inputFailure(message: string): OracleCandidateRegistrationResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([
      Object.freeze({
        code: "implementation.input.invalid",
        path: "",
        message,
      }),
    ]),
  });
}

/**
 * Derives and freshness-gates the five independent oracle candidate bindings.
 *
 * @param input Exact content closures, one per candidate entrypoint.
 * @returns Five lexical registrations and their validated structural registry.
 *
 * @example
 * ```ts
 * const result = registerOracleCandidateBindings(dependencies);
 * ```
 */
export function registerOracleCandidateBindings(input: unknown): OracleCandidateRegistrationResult {
  const snapshot = snapshotInput(input);
  if (snapshot === undefined) {
    return inputFailure("Oracle candidate dependencies must use the exact closed shape.");
  }
  const entries = [
    {
      handlerId: "oracle.compiler-result",
      kind: "oracle",
      metadata: snapshot.compilerResult,
      implementation: evaluateCompilerResultCandidate,
    },
    {
      handlerId: "oracle.emitted-program",
      kind: "oracle",
      metadata: snapshot.emittedProgram,
      implementation: evaluateEmittedProgramCandidate,
    },
    {
      handlerId: "oracle.frontend-result",
      kind: "oracle",
      metadata: snapshot.frontendResult,
      implementation: evaluateFrontendResultCandidate,
    },
    {
      handlerId: "oracle.runtime-state",
      kind: "oracle",
      metadata: snapshot.runtimeState,
      implementation: evaluateRuntimeStateCandidate,
    },
    {
      handlerId: "transform.semantic-relations",
      kind: "transform",
      metadata: snapshot.semanticRelations,
      implementation: evaluateSemanticRelationsCandidate,
    },
  ] as const;
  const registrations: FreshCandidateRegistration[] = [];
  for (const entry of entries) {
    const derived = deriveImplementationRevision(entry.metadata);
    if (!derived.ok) return derived;
    const freshness = validateImplementationRevision({
      claimedRevision: derived.revision,
      metadata: entry.metadata,
    });
    if (!freshness.ok) return freshness;
    const registered = registerFreshCandidateBinding({
      binding: {
        handlerId: entry.handlerId,
        kind: entry.kind,
        contractVersion: "1.0.0",
        implementationRevision: freshness.revision,
        implementation: entry.implementation,
      },
      freshness,
    });
    if (!registered.ok) return registered;
    registrations.push(registered.registration);
  }
  const bindings = validateCandidateBindings(
    DECLARATIONS,
    registrations.map(({ binding }) => binding),
  );
  if (!bindings.ok) return bindings;
  return Object.freeze({
    ok: true,
    registrations: Object.freeze(registrations),
    bindings: bindings.bindings,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}
