import type {
  BindingDeclarationInput,
  BindingValidationResult,
  ExecutableBinding,
  FreshCandidateRegistration,
  FreshCandidateRegistrationInput,
  FreshCandidateRegistrationResult,
  HandlerImplementation,
  PublishedSnapshot,
  ValidatedBindingRegistry,
} from "./binding-model.js";
import { FRESH_CANDIDATE_REGISTRATION_CAPABILITY } from "./binding-model.js";
import {
  isFreshImplementationRevision,
  matchesFreshImplementationRevision,
} from "./implementation-revision.js";
import type { BindingState, HandlerKind } from "./model.js";
import type {
  ModelBindingDiagnostic,
  ModelBindingDiagnosticCode,
  Sha256Digest,
} from "./model-registry-model.js";
import { inspectPlainDataTree } from "./programmatic-input.js";
import { lookupPublishedBinding } from "./publication-binding-lookup.js";
import { isRuleModelId } from "./rule-model-registry.js";

const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const HANDLER_KINDS: ReadonlySet<string> = new Set(["generator", "oracle", "transform"]);
const BINDING_STATES: ReadonlySet<string> = new Set(["bound", "unbound"]);
const DECLARATION_KEYS = ["id", "kind", "owner", "contractVersion", "binding"] as const;
const BINDING_KEYS = [
  "handlerId",
  "kind",
  "contractVersion",
  "implementationRevision",
  "implementation",
] as const;
const FRESH_REGISTRATION_KEYS = ["binding", "freshness"] as const;
const FRESH_CANDIDATE_REGISTRATIONS = new WeakSet<object>();
const EMPTY_BINDING_DIAGNOSTICS: readonly [] = Object.freeze([]);

interface IndexedDeclaration {
  readonly declaration: BindingDeclarationInput;
  readonly index: number;
}

interface NormalizedBindingCandidate {
  readonly handlerId: string;
  readonly kind: HandlerKind;
  readonly contractVersion: string;
  readonly implementationRevision: string;
  readonly implementation: HandlerImplementation;
}

function diagnostic(
  code: ModelBindingDiagnosticCode,
  path: string,
  message: string,
): ModelBindingDiagnostic {
  return { code, path, message };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isHandlerKind(value: unknown): value is HandlerKind {
  return typeof value === "string" && HANDLER_KINDS.has(value);
}

function isBindingState(value: unknown): value is BindingState {
  return typeof value === "string" && BINDING_STATES.has(value);
}

function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isHandlerImplementation(value: unknown): value is HandlerImplementation {
  return typeof value === "function";
}

function schemaFailure(path: string, message: string): ModelBindingDiagnostic {
  return diagnostic("model.schema.invalid", path, message);
}

function normalizeDeclaration(
  value: unknown,
  index: number,
  mode: "candidate" | "published",
): BindingDeclarationInput | ModelBindingDiagnostic {
  const base = `/declarations/${index}`;
  if (!isRecord(value) || !hasExactKeys(value, DECLARATION_KEYS)) {
    return schemaFailure(base, "Handler declaration must use the exact closed record shape.");
  }
  if (!isRuleModelId(value.id)) {
    return schemaFailure(`${base}/id`, "Handler declaration ID is not canonical.");
  }
  if (!isHandlerKind(value.kind)) {
    return diagnostic("binding.entry.kind", `${base}/kind`, "Handler kind is not supported.");
  }
  if (!isRuleModelId(value.owner)) {
    return schemaFailure(`${base}/owner`, "Handler declaration owner is not canonical.");
  }
  if (typeof value.contractVersion !== "string" || value.contractVersion.length === 0) {
    return diagnostic(
      "binding.entry.contract",
      `${base}/contractVersion`,
      "Handler declaration contract version must be non-empty.",
    );
  }
  if (!isBindingState(value.binding)) {
    return diagnostic(
      mode === "candidate" ? "binding.candidate.state" : "binding.published.state",
      `${base}/binding`,
      "Handler declaration binding state is not supported.",
    );
  }
  return Object.freeze({
    id: value.id,
    kind: value.kind,
    owner: value.owner,
    contractVersion: value.contractVersion,
    binding: value.binding,
  });
}

function normalizeBinding(
  value: unknown,
  index: number,
): NormalizedBindingCandidate | ModelBindingDiagnostic {
  const base = `/bindings/${index}`;
  if (!isRecord(value) || !hasExactKeys(value, BINDING_KEYS)) {
    return schemaFailure(base, "Executable binding must use the exact closed record shape.");
  }
  if (!isRuleModelId(value.handlerId)) {
    return schemaFailure(`${base}/handlerId`, "Executable binding handler ID is not canonical.");
  }
  if (!isHandlerKind(value.kind)) {
    return diagnostic("binding.entry.kind", `${base}/kind`, "Binding kind is not supported.");
  }
  if (typeof value.contractVersion !== "string" || value.contractVersion.length === 0) {
    return diagnostic(
      "binding.entry.contract",
      `${base}/contractVersion`,
      "Binding contract version must be non-empty.",
    );
  }
  if (typeof value.implementationRevision !== "string") {
    return diagnostic(
      "binding.entry.revision",
      `${base}/implementationRevision`,
      "Implementation revision must be a string.",
    );
  }
  if (!isHandlerImplementation(value.implementation)) {
    return schemaFailure(
      `${base}/implementation`,
      "Executable binding implementation is not callable.",
    );
  }
  return {
    handlerId: value.handlerId,
    kind: value.kind,
    contractVersion: value.contractVersion,
    implementationRevision: value.implementationRevision,
    implementation: value.implementation,
  };
}

function closeRegistry(bindings: readonly ExecutableBinding[]): ValidatedBindingRegistry {
  const closedBindings = Object.freeze([...bindings]);
  const byHandlerId = new Map(closedBindings.map((binding) => [binding.handlerId, binding]));
  return Object.freeze({
    bindings: closedBindings,
    get: (handlerId: string): ExecutableBinding | undefined => byHandlerId.get(handlerId),
  });
}

function validateBindingsUnchecked(
  mode: "candidate" | "published",
  declarationValues: readonly unknown[],
  bindingValues: readonly unknown[],
): BindingValidationResult {
  const diagnostics: ModelBindingDiagnostic[] = [];
  const declarationsById = new Map<string, IndexedDeclaration>();
  const declarations: IndexedDeclaration[] = [];
  const invalidDeclarationIds = new Set<string>();

  declarationValues.forEach((value, index) => {
    const declaration = normalizeDeclaration(value, index, mode);
    if ("code" in declaration) {
      diagnostics.push(declaration);
      if (isRecord(value) && isRuleModelId(value.id)) {
        invalidDeclarationIds.add(value.id);
      }
      return;
    }
    if (declarationsById.has(declaration.id)) {
      diagnostics.push(
        diagnostic(
          "binding.declaration.duplicate",
          `/declarations/${index}/id`,
          `Handler declaration '${declaration.id}' occurs more than once.`,
        ),
      );
      return;
    }
    const indexed = { declaration, index };
    declarationsById.set(declaration.id, indexed);
    declarations.push(indexed);
  });

  const seenBindings = new Set<string>();
  const closedBindings: ExecutableBinding[] = [];
  bindingValues.forEach((value, index) => {
    const binding = normalizeBinding(value, index);
    if ("code" in binding) {
      diagnostics.push(binding);
      return;
    }
    if (seenBindings.has(binding.handlerId)) {
      diagnostics.push(
        diagnostic(
          "binding.entry.duplicate",
          `/bindings/${index}/handlerId`,
          `Executable binding '${binding.handlerId}' occurs more than once.`,
        ),
      );
      return;
    }
    seenBindings.add(binding.handlerId);

    const declarationEntry = declarationsById.get(binding.handlerId);
    if (declarationEntry === undefined) {
      if (invalidDeclarationIds.has(binding.handlerId)) return;
      diagnostics.push(
        diagnostic(
          "binding.declaration.missing",
          `/bindings/${index}/handlerId`,
          `Executable binding '${binding.handlerId}' has no declaration.`,
        ),
      );
      return;
    }

    const { declaration, index: declarationIndex } = declarationEntry;
    let compatible = true;
    const implementationRevision = isSha256Digest(binding.implementationRevision)
      ? binding.implementationRevision
      : undefined;
    if (implementationRevision === undefined) {
      diagnostics.push(
        diagnostic(
          "binding.entry.revision",
          `/bindings/${index}/implementationRevision`,
          "Implementation revision is not a canonical SHA-256 digest.",
        ),
      );
      compatible = false;
    }
    if (binding.kind !== declaration.kind) {
      diagnostics.push(
        diagnostic(
          "binding.entry.kind",
          `/bindings/${index}/kind`,
          `Binding kind '${binding.kind}' does not match declaration kind '${declaration.kind}'.`,
        ),
      );
      compatible = false;
    }
    if (binding.contractVersion !== declaration.contractVersion) {
      diagnostics.push(
        diagnostic(
          "binding.entry.contract",
          `/bindings/${index}/contractVersion`,
          "Binding contract version does not match its declaration.",
        ),
      );
      compatible = false;
    }
    if (mode === "candidate" && declaration.binding !== "unbound") {
      diagnostics.push(
        diagnostic(
          "binding.candidate.state",
          `/declarations/${declarationIndex}/binding`,
          "Candidate binding requires an unbound declaration.",
        ),
      );
      compatible = false;
    }
    if (mode === "published" && declaration.binding !== "bound") {
      diagnostics.push(
        diagnostic(
          "binding.published.state",
          `/declarations/${declarationIndex}/binding`,
          "Published binding requires a bound declaration.",
        ),
      );
      compatible = false;
    }
    if (compatible && implementationRevision !== undefined) {
      closedBindings.push(
        Object.freeze({
          handlerId: binding.handlerId,
          kind: binding.kind,
          contractVersion: binding.contractVersion,
          implementationRevision,
          implementation: binding.implementation,
        }),
      );
    }
  });

  if (mode === "published") {
    declarations.forEach(({ declaration, index }) => {
      if (declaration.binding === "bound" && !seenBindings.has(declaration.id)) {
        diagnostics.push(
          diagnostic(
            "binding.published.missing",
            `/declarations/${index}/id`,
            `Bound declaration '${declaration.id}' has no executable binding.`,
          ),
        );
      }
    });
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, bindings: closeRegistry(closedBindings), diagnostics: [] };
}

function validateBindings(
  mode: "candidate" | "published",
  declarations: unknown,
  bindings: unknown,
): BindingValidationResult {
  try {
    const declarationFailure = inspectPlainDataTree(declarations, "/declarations", () => false);
    if (declarationFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [schemaFailure(declarationFailure.path, declarationFailure.message)],
      };
    }
    const bindingFailure = inspectPlainDataTree(bindings, "/bindings", (path) =>
      /^\/bindings\/[0-9]+\/implementation$/u.test(path),
    );
    if (bindingFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [schemaFailure(bindingFailure.path, bindingFailure.message)],
      };
    }
    if (!Array.isArray(declarations) || !Array.isArray(bindings)) {
      return {
        ok: false,
        diagnostics: [schemaFailure("", "Declarations and bindings must be arrays.")],
      };
    }
    return validateBindingsUnchecked(mode, declarations, bindings);
  } catch {
    return {
      ok: false,
      diagnostics: [schemaFailure("", "Binding input could not be inspected safely.")],
    };
  }
}

/**
 * Validates executable candidates against currently unbound handler declarations.
 *
 * @param declarations Authoritative handler declarations.
 * @param bindings Candidate executable bindings.
 * @returns Candidate-only validated bindings or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const result = validateCandidateBindings(declarations, candidates);
 * ```
 */
export function validateCandidateBindings(
  declarations: unknown,
  bindings: unknown,
): BindingValidationResult {
  return validateBindings("candidate", declarations, bindings);
}

/**
 * Validates selected published bindings bidirectionally against handler declarations.
 *
 * @param declarations Authoritative published handler declarations.
 * @param bindings Executable bindings contained by the same publication.
 * @returns Published-state validated bindings or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const result = validatePublishedBindings(declarations, publishedBindings);
 * ```
 */
export function validatePublishedBindings(
  declarations: unknown,
  bindings: unknown,
): BindingValidationResult {
  return validateBindings("published", declarations, bindings);
}

/**
 * Looks up an executable handler only through an opaque selected publication.
 *
 * @deprecated Import the package-level publication resolver API in new code.
 * @param snapshot Digest-verified selected publication.
 * @param handlerId Handler identity to resolve.
 * @returns The published executable binding when present.
 */
export function getPublishedBinding(
  snapshot: PublishedSnapshot,
  handlerId: string,
): ExecutableBinding<HandlerImplementation> | undefined {
  return lookupPublishedBinding(snapshot, handlerId);
}

/**
 * Reports whether a value is a freshness-gated candidate registration.
 *
 * @param value Candidate registration capability.
 * @returns Whether the value came from successful freshness-gated registration.
 *
 * @example
 * ```ts
 * if (isFreshCandidateRegistration(value)) value.binding.implementation();
 * ```
 */
export function isFreshCandidateRegistration(value: unknown): value is FreshCandidateRegistration {
  return typeof value === "object" && value !== null && FRESH_CANDIDATE_REGISTRATIONS.has(value);
}

/**
 * Registers one candidate only when its claimed revision has fresh dependency proof.
 *
 * This is the authoritative registration seam. The earlier candidate validator remains a
 * non-authoritative structural and declaration-compatibility check.
 *
 * @param input Raw binding metadata plus successful implementation freshness validation.
 * @returns A non-forgeable registration capability or stable binding diagnostics.
 *
 * @example
 * ```ts
 * const result = registerFreshCandidateBinding({ binding, freshness });
 * ```
 */
export function registerFreshCandidateBinding(
  input: FreshCandidateRegistrationInput,
): FreshCandidateRegistrationResult {
  try {
    if (!isRecord(input)) {
      return {
        ok: false,
        diagnostics: [schemaFailure("", "Fresh candidate registration must be a plain record.")],
      };
    }
    const prototype = Object.getPrototypeOf(input);
    const keys = Reflect.ownKeys(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (
      (prototype !== Object.prototype && prototype !== null) ||
      keys.length !== FRESH_REGISTRATION_KEYS.length ||
      keys.some(
        (key) =>
          typeof key !== "string" || !FRESH_REGISTRATION_KEYS.some((allowed) => allowed === key),
      )
    ) {
      return {
        ok: false,
        diagnostics: [
          schemaFailure("", "Fresh candidate registration must use the exact closed shape."),
        ],
      };
    }
    for (const key of FRESH_REGISTRATION_KEYS) {
      const descriptor = descriptors[key];
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return {
          ok: false,
          diagnostics: [
            schemaFailure(
              `/${key}`,
              "Fresh candidate property must be an enumerable own data property.",
            ),
          ],
        };
      }
    }

    const bindingFailure = inspectPlainDataTree(
      input.binding,
      "/binding",
      (path) => path === "/binding/implementation",
    );
    if (bindingFailure !== undefined) {
      return {
        ok: false,
        diagnostics: [schemaFailure(bindingFailure.path, bindingFailure.message)],
      };
    }
    const normalized = normalizeBinding(input.binding, 0);
    if ("code" in normalized) {
      return {
        ok: false,
        diagnostics: [
          Object.freeze({
            ...normalized,
            path: normalized.path.replace("/bindings/0", "/binding"),
          }),
        ],
      };
    }
    if (!isSha256Digest(normalized.implementationRevision)) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "binding.entry.revision",
            "/binding/implementationRevision",
            "Implementation revision is not a canonical SHA-256 digest.",
          ),
        ],
      };
    }
    if (!isFreshImplementationRevision(input.freshness)) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "binding.entry.revision",
            "/freshness",
            "Implementation freshness was not produced by successful validation.",
          ),
        ],
      };
    }
    if (input.freshness.revision !== normalized.implementationRevision) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "binding.entry.revision",
            "/binding/implementationRevision",
            "Binding revision does not match its freshness capability.",
          ),
        ],
      };
    }
    if (
      !matchesFreshImplementationRevision(
        input.freshness,
        normalized.implementationRevision,
        normalized.contractVersion,
      )
    ) {
      return {
        ok: false,
        diagnostics: [
          diagnostic(
            "binding.entry.contract",
            "/binding/contractVersion",
            "Binding contract version does not match its freshness capability.",
          ),
        ],
      };
    }

    const binding: ExecutableBinding = Object.freeze({
      handlerId: normalized.handlerId,
      kind: normalized.kind,
      contractVersion: normalized.contractVersion,
      implementationRevision: normalized.implementationRevision,
      implementation: normalized.implementation,
    });
    const registrationValue: FreshCandidateRegistration = {
      [FRESH_CANDIDATE_REGISTRATION_CAPABILITY]: true,
      binding,
    };
    const registration = Object.freeze(registrationValue);
    FRESH_CANDIDATE_REGISTRATIONS.add(registration);
    return Object.freeze({
      ok: true,
      registration,
      diagnostics: EMPTY_BINDING_DIAGNOSTICS,
    });
  } catch {
    return {
      ok: false,
      diagnostics: [
        schemaFailure("", "Fresh candidate registration could not be inspected safely."),
      ],
    };
  }
}
