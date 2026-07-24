import type { BindingState, HandlerKind } from "./model.js";
import type { ModelBindingDiagnostic, Sha256Digest } from "./model-registry-model.js";

/** Runtime declaration input joined against executable handler bindings. */
export interface BindingDeclarationInput {
  readonly id: string;
  readonly kind: HandlerKind;
  readonly owner: string;
  readonly contractVersion: string;
  readonly binding: BindingState;
}

/** Callable implementation stored in the executable handler registry. */
export type HandlerImplementation = (...args: never[]) => unknown;

/** Candidate executable implementation and its content-addressed identity. */
export interface ExecutableBindingInput<
  TImplementation extends HandlerImplementation = HandlerImplementation,
> {
  readonly handlerId: string;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: string;
  readonly implementation: TImplementation;
}

/** Executable binding proven compatible with its declaration. */
export interface ExecutableBinding<
  TImplementation extends HandlerImplementation = HandlerImplementation,
> {
  readonly handlerId: string;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: Sha256Digest;
  readonly implementation: TImplementation;
}

/** Immutable registry returned by candidate or published-state validation. */
export interface ValidatedBindingRegistry {
  readonly bindings: readonly ExecutableBinding[];
  readonly get: (handlerId: string) => ExecutableBinding | undefined;
}

/** Result of candidate or published executable-binding validation. */
export type BindingValidationResult =
  | {
      readonly ok: true;
      readonly bindings: ValidatedBindingRegistry;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ModelBindingDiagnostic[];
    };

declare const PUBLISHED_SNAPSHOT_BRAND: unique symbol;

/**
 * Opaque capability representing one digest-verified selected publication.
 *
 * Instances are produced only by the publication resolver.
 */
export interface PublishedSnapshot {
  readonly [PUBLISHED_SNAPSHOT_BRAND]: true;
  readonly bindings: ValidatedBindingRegistry;
}
