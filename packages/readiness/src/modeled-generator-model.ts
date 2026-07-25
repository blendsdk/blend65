import type { GenerationSpelling } from "./canonical-identity.js";
import type {
  BoundaryVariantResult,
  GenExpression,
  GenModule,
  GenerationBudget,
  GenerationUsage,
} from "./generator-ir.js";
import type {
  NeighborId,
  PredicateId,
  RuleId,
  RuleModelReason,
  Sha256Digest,
} from "./model-registry-model.js";

/** Stable failure categories emitted before or during modeled generation. */
export type ModeledGenerationDiagnosticCode =
  | "modeled.input.invalid"
  | "modeled.input.limit"
  | "modeled.seed.mismatch"
  | "modeled.review.missing"
  | "modeled.review.stale"
  | "modeled.review.not-accepted"
  | "modeled.citation.mismatch"
  | "modeled.rule.unavailable"
  | "modeled.handler.route"
  | "modeled.choice.invalid"
  | "modeled.operation.failed";

/** One bounded modeled-generation failure. */
export interface ModeledGenerationDiagnostic {
  /** Stable machine-readable category. */
  readonly code: ModeledGenerationDiagnosticCode;
  /** RFC 6901 path into the rejected input. */
  readonly path: string;
  /** Bounded human-readable explanation. */
  readonly message: string;
}

/** Runtime marker paired with module-private suite authority. */
export const MODELED_GENERATOR_SUITE_CAPABILITY: unique symbol = Symbol("modeled-generator-suite");

/** Opaque authority proving that model facts and independent review agree. */
export interface ModeledGeneratorSuite {
  /** Compile-time marker paired with module-private runtime authority. */
  readonly [MODELED_GENERATOR_SUITE_CAPABILITY]: true;
}

/** Raw authority artifacts required to create a reviewed generator suite. */
export interface ModeledGeneratorSuiteInput {
  /** Closed version-one seed contract bytes. */
  readonly seedContractBytes: Uint8Array;
  /** Exhaustive version-one rule-model manifest bytes. */
  readonly ruleModelBytes: Uint8Array;
  /** Independent digest-bound review bytes. */
  readonly reviewEvidenceBytes: Uint8Array;
  /** Validated inventory authority whose rules supply citations. */
  readonly inventory: unknown;
}

/** Result of validating the complete modeled-generator authority. */
export type ModeledGeneratorSuiteResult =
  | {
      readonly ok: true;
      readonly suite: ModeledGeneratorSuite;
      readonly seedContractDigest: Sha256Digest;
      readonly ruleModelDigest: Sha256Digest;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledGenerationDiagnostic[];
    };

/** One scalar construction choice from a reviewed rule domain. */
export interface ScalarCaseChoice {
  readonly kind: "scalar";
  readonly ruleId: RuleId;
  readonly spelling: GenerationSpelling;
  readonly value: bigint | boolean;
}

/** Whether a memory address is a direct value or a computed expression. */
export type MemoryExpressionForm = "direct" | "computed";

/** One memory-intrinsic construction choice from a reviewed rule domain. */
export interface MemoryCaseChoice {
  readonly kind: "memory";
  readonly ruleId: RuleId;
  readonly addressSpelling: GenerationSpelling;
  readonly addressForm: MemoryExpressionForm;
  readonly valueSpelling?: GenerationSpelling;
}

/** Closed choice union exposed by reviewed generation domains. */
export type ModeledCaseChoice = ScalarCaseChoice | MemoryCaseChoice;

/** Successful modeled domain for one reviewed rule. */
export interface ModeledRuleGenerationDomain {
  readonly ok: true;
  readonly state: "modeled";
  readonly ruleId: RuleId;
  readonly handlerId: "generator.frontend-cases" | "generator.runtime-cases";
  readonly choices: readonly ModeledCaseChoice[];
  readonly diagnostics: readonly [];
}

/** Explicit non-generatable domain retained from the exhaustive manifest. */
export interface UnavailableRuleGenerationDomain {
  readonly ok: true;
  readonly state: "unmodeled" | "not-generatable";
  readonly ruleId: RuleId;
  readonly reason: RuleModelReason;
  readonly diagnostics: readonly [];
}

/** Result of resolving one rule through the reviewed suite. */
export type RuleGenerationDomainResult =
  | ModeledRuleGenerationDomain
  | UnavailableRuleGenerationDomain
  | { readonly ok: false; readonly diagnostics: readonly ModeledGenerationDiagnostic[] };

/** Closed structural edit that creates one invalid intrinsic signature. */
export type InvalidSourceTransform =
  | {
      readonly kind: "intrinsic-argument-remove";
      readonly callPath: string;
      readonly argumentIndex: number;
    }
  | {
      readonly kind: "intrinsic-argument-insert";
      readonly callPath: string;
      readonly argumentIndex: number;
      readonly argument: GenExpression;
    }
  | {
      readonly kind: "intrinsic-argument-replace";
      readonly callPath: string;
      readonly argumentIndex: number;
      readonly argument: GenExpression;
    }
  | {
      readonly kind: "scalar-expression-replace";
      readonly expressionPath: string;
      readonly replacement: {
        readonly kind: "integer-literal";
        readonly value: bigint;
      };
    }
  | {
      readonly kind: "parameter-binding-replace";
      readonly parameterPath: string;
      readonly replacement: {
        readonly kind: "integer-literal";
        readonly value: bigint;
      };
    };

/** Valid generator IR or one deliberate invalid delta over a valid baseline. */
export type GeneratedCaseProjection =
  | { readonly kind: "valid"; readonly module: GenModule }
  | {
      readonly kind: "invalid";
      readonly baseline: GenModule;
      readonly transform: InvalidSourceTransform;
    };

/** Whether a request asks for a valid case or one named invalid neighbor. */
export type ModeledCaseValidity =
  | { readonly kind: "valid" }
  | { readonly kind: "invalid"; readonly neighborId: NeighborId };

/** Closed request accepted by the three stateless generator handlers. */
export interface ModeledCaseRequest {
  readonly handlerId:
    | "generator.frontend-cases"
    | "generator.compiler-cases"
    | "generator.runtime-cases";
  readonly modulePath: readonly string[];
  readonly choice: ModeledCaseChoice;
  readonly validity: ModeledCaseValidity;
  readonly budget: GenerationBudget;
}

/** Construction-only usage measured before rendering and attempt accounting. */
export type ConstructionUsage = Readonly<
  Pick<
    GenerationUsage,
    "modules" | "declarations" | "ir-nodes" | "statements" | "expression-depth" | "loop-work"
  >
>;

/** One reviewed generated case and its exact coverage claim. */
export interface GeneratedModeledCase {
  readonly projection: GeneratedCaseProjection;
  /** External values paired with function parameters for later composition and replay. */
  readonly parameterBindings: readonly ParameterValueBinding[];
  readonly primaryRuleId: RuleId;
  readonly claimedRuleIds: readonly RuleId[];
  readonly spelling: GenerationSpelling;
  readonly validity:
    | { readonly kind: "valid" }
    | {
        readonly kind: "invalid";
        readonly neighborId: NeighborId;
        readonly violatedPredicateId: PredicateId;
        readonly expectedDiagnosticFamily: string;
      };
  readonly constructionUsage: ConstructionUsage;
}

/** One immutable invocation value for a parameterized modeled case. */
export interface ParameterValueBinding {
  /** Stable descriptor discriminator. */
  readonly kind: "parameter-value";
  /** Canonical pointer to the parameter declaration in the valid baseline module. */
  readonly parameterPath: string;
  /** Exact semantic value supplied when the later campaign invokes the function. */
  readonly value: bigint | boolean;
}

/** Closed result returned by modeled construction and handler entrypoints. */
export type GeneratorCaseResult =
  | {
      readonly ok: true;
      readonly outcome: "generated";
      readonly case: GeneratedModeledCase;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: true;
      readonly outcome: "unavailable";
      readonly ruleId: RuleId;
      readonly state: "unmodeled" | "not-generatable";
      readonly reason: RuleModelReason;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledGenerationDiagnostic[];
    };

/** Result of evaluating one reviewed predicate against a closed case request. */
export type PredicateResult =
  | {
      readonly ok: true;
      readonly predicateId: PredicateId;
      readonly valid: boolean;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModeledGenerationDiagnostic[];
    };

/** Stateless version-one generator implementation stored in candidate bindings. */
export type GeneratorHandlerV1 = (
  suite: ModeledGeneratorSuite,
  request: unknown,
) => GeneratorCaseResult;

/** Stateless boundary-transform implementation stored in candidate bindings. */
export type BoundaryVariantsHandlerV1 = (input: unknown) => BoundaryVariantResult;
