import type { BindingState, HandlerKind } from "./model.js";
import type { ModelBindingDiagnostic, Sha256Digest } from "./model-registry-model.js";
import type { FreshImplementationRevision } from "./implementation-revision.js";

/** Runtime declaration input joined against executable handler bindings. */
export interface BindingDeclarationInput {
  /** Stable declaration identifier. */
  readonly id: string;
  /** Executable operation family declared by the handler. */
  readonly kind: HandlerKind;
  /** Inventory or rule owner responsible for the declaration. */
  readonly owner: string;
  /** Contract version required by the declaration. */
  readonly contractVersion: string;
  /** Whether published authority expects the handler to be bound. */
  readonly binding: BindingState;
}

/** Callable implementation stored in the executable handler registry. */
export type HandlerImplementation = (...args: never[]) => unknown;

/** Candidate executable implementation and its content-addressed identity. */
export interface ExecutableBindingInput<
  TImplementation extends HandlerImplementation = HandlerImplementation,
> {
  /** Stable declaration identifier implemented by the candidate. */
  readonly handlerId: string;
  /** Executable operation family implemented by the candidate. */
  readonly kind: HandlerKind;
  /** Contract version implemented by the callable. */
  readonly contractVersion: string;
  /** Claimed canonical content revision of the implementation closure. */
  readonly implementationRevision: string;
  /** Candidate callable, retained only after successful validation. */
  readonly implementation: TImplementation;
}

/** Executable binding proven compatible with its declaration. */
export interface ExecutableBinding<
  TImplementation extends HandlerImplementation = HandlerImplementation,
> {
  /** Stable declaration identifier implemented by the binding. */
  readonly handlerId: string;
  /** Validated executable operation family. */
  readonly kind: HandlerKind;
  /** Validated handler contract version. */
  readonly contractVersion: string;
  /** Canonical implementation dependency revision. */
  readonly implementationRevision: Sha256Digest;
  /** Validated executable callable. */
  readonly implementation: TImplementation;
}

/** Immutable registry returned by candidate or published-state validation. */
export interface ValidatedBindingRegistry {
  /** Lexically ordered immutable binding snapshot. */
  readonly bindings: readonly ExecutableBinding[];
  /** Exact handler lookup with no fallback. */
  readonly get: (handlerId: string) => ExecutableBinding | undefined;
}

/** Result of candidate or published executable-binding validation. */
export type BindingValidationResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Closed immutable executable binding registry. */
      readonly bindings: ValidatedBindingRegistry;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic binding validation failures. */
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

declare const PUBLISHED_SNAPSHOT_BRAND: unique symbol;

/**
 * Opaque capability representing one digest-verified selected publication.
 *
 * Instances are produced only by the publication resolver.
 */
export interface PublishedSnapshot {
  /** Compile-time marker paired with publication resolver authority. */
  readonly [PUBLISHED_SNAPSHOT_BRAND]: true;
}

const FRESH_CANDIDATE_REGISTRATION_BRAND: unique symbol = Symbol("fresh-candidate-registration");

/** Opaque freshness-gated executable candidate registration. */
export interface FreshCandidateRegistration {
  /** Compile-time marker paired with module-private runtime registration authority. */
  readonly [FRESH_CANDIDATE_REGISTRATION_BRAND]: true;
  /** Executable binding proven against current implementation bytes. */
  readonly binding: ExecutableBinding;
}

/** Closed input for freshness-gating one structurally valid executable candidate. */
export interface FreshCandidateRegistrationInput {
  /** Raw executable metadata and callable to register. */
  readonly binding: ExecutableBindingInput;
  /** Non-forgeable proof for the exact revision and contract version. */
  readonly freshness: FreshImplementationRevision;
}

/** Result of freshness-gating an executable candidate before authoritative registration. */
export type FreshCandidateRegistrationResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Non-forgeable freshness-gated candidate registration. */
      readonly registration: FreshCandidateRegistration;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic registration failures. */
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

/** Module-private runtime brand shared by the freshness-gated registration implementation. */
export const FRESH_CANDIDATE_REGISTRATION_CAPABILITY: typeof FRESH_CANDIDATE_REGISTRATION_BRAND =
  FRESH_CANDIDATE_REGISTRATION_BRAND;
