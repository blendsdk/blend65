import { registerFreshCandidateBinding, validateCandidateBindings } from "./binding-validator.js";
import type { FreshCandidateRegistration, ValidatedBindingRegistry } from "./binding-model.js";
import {
  validateImplementationRevision,
  type ImplementationRevisionDiagnostic,
  type ImplementationRevisionInput,
} from "./implementation-revision.js";
import {
  MODELED_BOUNDARY_REVISION,
  MODELED_GENERATOR_REVISION,
  type GeneratedCandidateRevision,
} from "./modeled-candidate-revisions.generated.js";
import {
  boundaryVariantsHandler,
  generateCompilerCase,
  generateFrontendCase,
  generateRuntimeCase,
} from "./modeled-generators.js";
import type { ModelBindingDiagnostic } from "./model-registry-model.js";

/** Complete dependency metadata for the four candidate-only modeled callables. */
export interface ModeledCandidateDependencyInput {
  /** Frontend generator closure rooted at the modeled generator module. */
  readonly frontend: ImplementationRevisionInput;
  /** Compiler-composition generator closure rooted at the modeled generator module. */
  readonly compiler: ImplementationRevisionInput;
  /** Runtime generator closure rooted at the modeled generator module. */
  readonly runtime: ImplementationRevisionInput;
  /** Boundary-transform closure rooted at the boundary implementation module. */
  readonly boundary: ImplementationRevisionInput;
}

/** Failure emitted while deriving, freshness-checking, or registering candidates. */
export type ModeledCandidateDiagnostic = ImplementationRevisionDiagnostic | ModelBindingDiagnostic;

/** Result of creating four freshness-gated candidate registrations. */
export type ModeledCandidateRegistrationResult =
  | {
      readonly ok: true;
      readonly registrations: readonly FreshCandidateRegistration[];
      readonly bindings: ValidatedBindingRegistry;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledCandidateDiagnostic[];
    };

const DECLARATIONS = Object.freeze([
  Object.freeze({
    id: "generator.frontend-cases",
    kind: "generator",
    owner: "readiness",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "generator.compiler-cases",
    kind: "generator",
    owner: "readiness",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "generator.runtime-cases",
    kind: "generator",
    owner: "readiness",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
  Object.freeze({
    id: "transform.boundary-variants",
    kind: "transform",
    owner: "readiness",
    contractVersion: "1.0.0",
    binding: "unbound",
  }),
]);

const INPUT_KEYS = ["frontend", "compiler", "runtime", "boundary"] as const;
const INPUT_KEY_SET: ReadonlySet<string> = new Set(INPUT_KEYS);
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function snapshotInput(value: unknown): ModeledCandidateDependencyInput | undefined {
  try {
    if (!isRecord(value)) return undefined;
    const prototype = Object.getPrototypeOf(value);
    const keys = Reflect.ownKeys(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      prototype !== Object.prototype ||
      keys.length !== INPUT_KEYS.length ||
      !keys.every((key) => typeof key === "string" && INPUT_KEY_SET.has(key)) ||
      !INPUT_KEYS.every((key) => {
        const descriptor = descriptors[key];
        return descriptor !== undefined && "value" in descriptor && descriptor.enumerable;
      })
    ) {
      return undefined;
    }
    const frontend = descriptors.frontend;
    const compiler = descriptors.compiler;
    const runtime = descriptors.runtime;
    const boundary = descriptors.boundary;
    if (
      frontend === undefined ||
      compiler === undefined ||
      runtime === undefined ||
      boundary === undefined ||
      !("value" in frontend) ||
      !("value" in compiler) ||
      !("value" in runtime) ||
      !("value" in boundary)
    ) {
      return undefined;
    }
    return {
      frontend: frontend.value,
      compiler: compiler.value,
      runtime: runtime.value,
      boundary: boundary.value,
    };
  } catch {
    return undefined;
  }
}

function inputFailure(message: string): ModeledCandidateRegistrationResult {
  return {
    ok: false,
    diagnostics: [
      {
        code: "implementation.input.invalid",
        path: "",
        message,
      },
    ],
  };
}

function matchesGeneratedClosure(
  normalizedPaths: readonly string[],
  expected: GeneratedCandidateRevision,
): boolean {
  return (
    normalizedPaths.length === expected.dependencyPaths.length &&
    normalizedPaths.every((path, index) => path === expected.dependencyPaths[index])
  );
}

/**
 * Derives current revisions and creates four non-published freshness-gated candidates.
 *
 * The caller supplies complete dependency bytes; revisions are always derived here and then
 * revalidated before the authoritative registration seam is crossed.
 *
 * @param input Complete production dependency closures for the four callable identities.
 * @returns Four candidate registrations plus a structural candidate registry, never publication.
 */
export function registerModeledCandidateBindings(
  input: unknown,
): ModeledCandidateRegistrationResult {
  const snapshot = snapshotInput(input);
  if (snapshot === undefined) {
    return inputFailure("Modeled candidate dependencies must use the exact closed shape.");
  }
  const entries = [
    {
      handlerId: "generator.frontend-cases",
      kind: "generator",
      implementation: generateFrontendCase,
      metadata: snapshot.frontend,
      expected: MODELED_GENERATOR_REVISION,
    },
    {
      handlerId: "generator.compiler-cases",
      kind: "generator",
      implementation: generateCompilerCase,
      metadata: snapshot.compiler,
      expected: MODELED_GENERATOR_REVISION,
    },
    {
      handlerId: "generator.runtime-cases",
      kind: "generator",
      implementation: generateRuntimeCase,
      metadata: snapshot.runtime,
      expected: MODELED_GENERATOR_REVISION,
    },
    {
      handlerId: "transform.boundary-variants",
      kind: "transform",
      implementation: boundaryVariantsHandler,
      metadata: snapshot.boundary,
      expected: MODELED_BOUNDARY_REVISION,
    },
  ] as const;
  const registrations: FreshCandidateRegistration[] = [];
  for (const entry of entries) {
    const freshness = validateImplementationRevision({
      claimedRevision: entry.expected.claimedRevision,
      metadata: entry.metadata,
    });
    if (!freshness.ok) return freshness;
    if (
      !matchesGeneratedClosure(
        freshness.normalizedFiles.map(({ path }) => path),
        entry.expected,
      )
    ) {
      return inputFailure(
        `Dependency closure for '${entry.handlerId}' does not match generated path authority.`,
      );
    }
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
