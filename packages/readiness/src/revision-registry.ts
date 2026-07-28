import { Buffer } from "node:buffer";

import { inspectGeneratorInput } from "./generator-ir-validator.js";
import { isSha256Digest } from "./canonical-identity.js";
import { isFreshCandidateRegistration } from "./binding-validator.js";
import type { ExecutableBinding } from "./binding-model.js";
import {
  MODELED_GENERATOR_SUITE_CAPABILITY,
  type ModeledGeneratorSuite,
} from "./modeled-generator-model.js";
import { getModeledSuiteState } from "./modeled-generator-suite.js";
import type { Sha256Digest } from "./model-registry-model.js";
import type { ReplayDiagnostic, ReplayEnvelopeV1 } from "./replay-input.js";

/** Closed campaign component identities resolved during exact replay. */
export type IdentityComponent =
  | "inventory"
  | "rule-model"
  | "generator"
  | "boundary-transform"
  | "renderer"
  | "configuration";

/** One exact content revision and its replay value. */
export interface RevisionEntry {
  /** Campaign identity component represented by this entry. */
  readonly component: IdentityComponent;
  /** Exact content revision accepted for replay. */
  readonly revision: Sha256Digest;
  /** Immutable data or freshness-gated executable associated with the revision. */
  readonly value: unknown;
}

const REVISION_REGISTRY_BRAND: unique symbol = Symbol("revision-registry");

/** Exact revision lookup with no ambient-current or nearest-revision operation. */
export interface RevisionRegistry {
  /**
   * Returns the raw value retained for an exact compatibility-set key.
   *
   * This lookup does not establish that a value describes its key. Envelope-aware resolution
   * performs the authority checks required for replay.
   */
  readonly resolve: (component: IdentityComponent, revision: Sha256Digest) => unknown | undefined;
}

/** Result of closing exact revision entries into an immutable registry. */
export type RevisionRegistryResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Factory-produced exact immutable revision registry. */
      readonly registry: RevisionRegistry;
      /** Empty diagnostic tuple for the successful branch. */
      readonly diagnostics: readonly [];
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Non-empty deterministic schema or resource-limit failures. */
      readonly diagnostics: readonly ReplayDiagnostic[];
    };

/** Exact replay resolution or the first unavailable campaign component. */
export type RevisionResolutionResult =
  | {
      /** Success discriminator. */
      readonly ok: true;
      /** Exact immutable values for all six replay identity components. */
      readonly resolved: Readonly<Record<IdentityComponent, unknown>>;
    }
  | {
      /** Failure discriminator. */
      readonly ok: false;
      /** Stable replay compatibility failure category. */
      readonly kind: "replay-incompatible";
      /** First exact component unavailable from the registry. */
      readonly missing: IdentityComponent;
    };

const ENTRY_KEYS = ["component", "revision", "value"] as const;
const COMPONENTS: readonly IdentityComponent[] = Object.freeze([
  "inventory",
  "rule-model",
  "generator",
  "boundary-transform",
  "renderer",
  "configuration",
]);
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const MAX_REVISION_ENTRIES = 4_096;
const MAX_REVISION_VALUE_NODES = 65_536;
const MAX_REVISION_VALUE_BYTES = 4_194_304;
const REVISION_REGISTRIES = new WeakSet<object>();
const RESOLVED_FRESH_BINDINGS = new WeakMap<object, "generator" | "boundary-transform">();

interface ValueBudget {
  nodes: number;
  bytes: number;
}

type ClosedValueResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly path: string; readonly message: string };

type SelfDescribedRevision =
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "present"; readonly revision: Sha256Digest };

function diagnostic(
  path: string,
  message: string,
  code: ReplayDiagnostic["code"] = "replay.schema.invalid",
): ReplayDiagnostic {
  return Object.freeze({ code, path, message });
}

function failure(
  path: string,
  message: string,
  code: ReplayDiagnostic["code"] = "replay.schema.invalid",
): RevisionRegistryResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message, code)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return (
    actual.length === keys.length &&
    actual.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function isIdentityComponent(value: unknown): value is IdentityComponent {
  return (
    value === "inventory" ||
    value === "rule-model" ||
    value === "generator" ||
    value === "boundary-transform" ||
    value === "renderer" ||
    value === "configuration"
  );
}

function hasModeledGeneratorSuiteMarker(value: unknown): value is ModeledGeneratorSuite {
  if (typeof value !== "object" || value === null) return false;
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, MODELED_GENERATOR_SUITE_CAPABILITY);
    return descriptor !== undefined && "value" in descriptor && descriptor.value === true;
  } catch {
    return false;
  }
}

function isModeledGeneratorSuite(value: unknown): value is ModeledGeneratorSuite {
  return hasModeledGeneratorSuiteMarker(value) && getModeledSuiteState(value) !== undefined;
}

/**
 * Reports whether a replay value is a binding verified by a factory revision registry.
 *
 * @param value Resolved replay value.
 * @param component Executable component the binding must implement.
 * @returns Whether the registry accepted the original freshness registration.
 *
 * @example
 * ```ts
 * if (isResolvedFreshReplayBinding(value, "generator")) value.implementation();
 * ```
 */
export function isResolvedFreshReplayBinding(
  value: unknown,
  component: "generator" | "boundary-transform",
): value is ExecutableBinding {
  return (
    typeof value === "object" && value !== null && RESOLVED_FRESH_BINDINGS.get(value) === component
  );
}

/**
 * Reports whether a value is an exact factory-created revision registry.
 *
 * This package-internal capability check uses runtime identity rather than a forgeable structural
 * shape. Consumers still resolve all six envelope-selected revisions for each replay request.
 *
 * @param value Candidate revision registry capability.
 * @returns Whether the value was produced by `createRevisionRegistry`.
 *
 * @example
 * ```ts
 * if (!isFactoryRevisionRegistry(value)) return;
 * ```
 */
export function isFactoryRevisionRegistry(value: unknown): value is RevisionRegistry {
  return typeof value === "object" && value !== null && REVISION_REGISTRIES.has(value);
}

function registryKey(component: IdentityComponent, revision: Sha256Digest): string {
  return `${component}\u0000${revision}`;
}

function selfDescribedRevision(value: unknown, key: string): SelfDescribedRevision {
  if (typeof value !== "object" || value === null) return { kind: "absent" };
  try {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) return { kind: "absent" };
    if (!("value" in descriptor) || !descriptor.enumerable) return { kind: "invalid" };
    return isSha256Digest(descriptor.value)
      ? { kind: "present", revision: descriptor.value }
      : { kind: "invalid" };
  } catch {
    return { kind: "invalid" };
  }
}

function consumeBudget(
  budget: ValueBudget,
  path: string,
  byteCount: number,
): ClosedValueResult | undefined {
  budget.nodes += 1;
  budget.bytes += byteCount;
  if (budget.nodes > MAX_REVISION_VALUE_NODES) {
    return {
      ok: false,
      path,
      message: `Revision values exceed ${MAX_REVISION_VALUE_NODES} aggregate nodes.`,
    };
  }
  if (!Number.isSafeInteger(budget.bytes) || budget.bytes > MAX_REVISION_VALUE_BYTES) {
    return {
      ok: false,
      path,
      message: `Revision values exceed ${MAX_REVISION_VALUE_BYTES} aggregate UTF-8 bytes.`,
    };
  }
  return undefined;
}

function closeOpaqueValue(
  value: unknown,
  path: string,
  budget: ValueBudget,
  closedObjects: WeakMap<object, unknown>,
): ClosedValueResult {
  const primitiveBytes =
    typeof value === "string"
      ? Buffer.byteLength(value, "utf8")
      : typeof value === "bigint"
        ? Buffer.byteLength(value.toString(10), "utf8")
        : value === null
          ? 0
          : typeof value === "number"
            ? 8
            : typeof value === "boolean"
              ? 1
              : 0;
  const exhausted = consumeBudget(budget, path, primitiveBytes);
  if (exhausted !== undefined) return exhausted;

  if (Array.isArray(value)) {
    const cached = closedObjects.get(value);
    if (cached !== undefined) return { ok: true, value: cached };
    const output: unknown[] = [];
    closedObjects.set(value, output);
    for (let index = 0; index < value.length; index += 1) {
      const closed = closeOpaqueValue(value[index], `${path}/${index}`, budget, closedObjects);
      if (!closed.ok) return closed;
      output.push(closed.value);
    }
    return { ok: true, value: Object.freeze(output) };
  }
  if (isRecord(value)) {
    const cached = closedObjects.get(value);
    if (cached !== undefined) return { ok: true, value: cached };
    const output: Record<string, unknown> = {};
    closedObjects.set(value, output);
    for (const [key, member] of Object.entries(value)) {
      const keyBudget = consumeBudget(budget, `${path}/${key}`, Buffer.byteLength(key, "utf8"));
      if (keyBudget !== undefined) return keyBudget;
      const closed = closeOpaqueValue(member, `${path}/${key}`, budget, closedObjects);
      if (!closed.ok) return closed;
      output[key] = closed.value;
    }
    return { ok: true, value: Object.freeze(output) };
  }
  return { ok: true, value };
}

function incompatible(missing: IdentityComponent): RevisionResolutionResult {
  return Object.freeze({ ok: false, kind: "replay-incompatible", missing });
}

/**
 * Creates a duplicate-free registry for exact component/revision pairs.
 *
 * @param entries Closed revision entries with opaque replay values.
 * @returns An immutable exact registry or deterministic schema diagnostics.
 *
 * @example
 * ```ts
 * const result = createRevisionRegistry([{ component: "renderer", revision, value: render }]);
 * ```
 */
export function createRevisionRegistry(entries: readonly RevisionEntry[]): RevisionRegistryResult {
  try {
    if (!Array.isArray(entries)) {
      return failure("/entries", "Revision entries must be an array.");
    }
    if (Object.getPrototypeOf(entries) !== Array.prototype) {
      return failure("/entries", "Revision entries must use a plain array.");
    }
    const entryKeys = Reflect.ownKeys(entries);
    const elementKeys = entryKeys.filter((key) => key !== "length");
    if (
      entryKeys.some((key) => typeof key !== "string") ||
      elementKeys.length !== entries.length ||
      elementKeys.some((key, index) => key !== String(index))
    ) {
      return failure("/entries", "Revision entries must be dense and unadorned.");
    }
    if (entries.length > MAX_REVISION_ENTRIES) {
      return failure(
        "/entries",
        `Revision registry exceeds ${MAX_REVISION_ENTRIES} exact entries.`,
      );
    }

    const values = new Map<string, unknown>();
    const valueBudget: ValueBudget = { nodes: 0, bytes: 0 };
    const closedObjects = new WeakMap<object, unknown>();
    const verifiedBindings: {
      readonly binding: ExecutableBinding;
      readonly component: "generator" | "boundary-transform";
    }[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const base = `/entries/${index}`;
      if (!isRecord(entry) || !hasExactKeys(entry, ENTRY_KEYS)) {
        return failure(base, "Revision entry must use the exact closed shape.");
      }
      const prototype = Object.getPrototypeOf(entry);
      const descriptors = Object.getOwnPropertyDescriptors(entry);
      if (
        (prototype !== Object.prototype && prototype !== null) ||
        ENTRY_KEYS.some((key) => {
          const descriptor = descriptors[key];
          return descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable;
        })
      ) {
        return failure(base, "Revision entry properties must be enumerable own data.");
      }
      if (!isIdentityComponent(entry.component)) {
        return failure(`${base}/component`, "Revision component is not supported.");
      }
      if (!isSha256Digest(entry.revision)) {
        return failure(`${base}/revision`, "Revision must be a canonical SHA-256 digest.");
      }
      const key = registryKey(entry.component, entry.revision);
      if (values.has(key)) {
        return failure(base, "Component and revision pair occurs more than once.");
      }
      const describedRevision =
        entry.component === "inventory"
          ? selfDescribedRevision(entry.value, "inventoryDigest")
          : entry.component === "renderer"
            ? selfDescribedRevision(entry.value, "implementationRevision")
            : { kind: "absent" as const };
      if (describedRevision.kind === "invalid") {
        return failure(
          `${base}/value`,
          "Self-described replay revision must be enumerable canonical digest data.",
        );
      }
      if (describedRevision.kind === "present" && describedRevision.revision !== entry.revision) {
        return failure(
          `${base}/revision`,
          "Revision registry key does not match the value's self-described revision.",
        );
      }
      if (entry.component === "generator" || entry.component === "boundary-transform") {
        if (!isFreshCandidateRegistration(entry.value)) {
          return failure(
            `${base}/value`,
            "Executable replay revisions require a freshness-gated candidate registration.",
          );
        }
        if (entry.value.binding.implementationRevision !== entry.revision) {
          return failure(
            `${base}/revision`,
            "Executable replay revision does not match its freshness-gated binding.",
          );
        }
        const expectedKind = entry.component === "generator" ? "generator" : "transform";
        if (entry.value.binding.kind !== expectedKind) {
          return failure(
            `${base}/value`,
            "Executable replay component does not match its binding kind.",
          );
        }
        verifiedBindings.push({ binding: entry.value.binding, component: entry.component });
        values.set(key, entry.value.binding);
        continue;
      }
      if (entry.component === "rule-model") {
        if (!isModeledGeneratorSuite(entry.value)) {
          return failure(
            `${base}/value`,
            "Rule-model replay revisions require a factory-produced modeled suite.",
          );
        }
        values.set(key, entry.value);
        continue;
      }
      const valueFailure = inspectGeneratorInput(
        entry.value,
        `${base}/value`,
        (path) => path === `${base}/value` || path.startsWith(`${base}/value/`),
      );
      if (valueFailure !== undefined) {
        return failure(valueFailure.path, valueFailure.message);
      }
      const closed = closeOpaqueValue(entry.value, `${base}/value`, valueBudget, closedObjects);
      if (!closed.ok) {
        return failure(closed.path, closed.message, "replay.input.limit");
      }
      values.set(key, closed.value);
    }

    const registryValue = {
      [REVISION_REGISTRY_BRAND]: true,
      resolve: (component: IdentityComponent, revision: Sha256Digest): unknown | undefined => {
        if (!isIdentityComponent(component) || !isSha256Digest(revision)) return undefined;
        return values.get(registryKey(component, revision));
      },
    };
    const registry: RevisionRegistry = Object.freeze(registryValue);
    for (const verified of verifiedBindings) {
      RESOLVED_FRESH_BINDINGS.set(verified.binding, verified.component);
    }
    REVISION_REGISTRIES.add(registry);
    return Object.freeze({ ok: true, registry, diagnostics: EMPTY_DIAGNOSTICS });
  } catch {
    return failure("/entries", "Revision entries could not be inspected safely.");
  }
}

/**
 * Resolves all six replay components and establishes their envelope-specific authority.
 *
 * @param envelope Parsed identity-verified replay envelope.
 * @param registry Exact revision registry with no fallback operation.
 * @returns The six resolved values or the first unavailable component.
 *
 * @example
 * ```ts
 * const resolved = resolveReplayRevisions(envelope, registry);
 * ```
 */
export function resolveReplayRevisions(
  envelope: ReplayEnvelopeV1,
  registry: RevisionRegistry,
): RevisionResolutionResult {
  const requested: Readonly<Record<IdentityComponent, Sha256Digest>> = Object.freeze({
    inventory: envelope.campaign.inventoryDigest,
    "rule-model": envelope.campaign.ruleModelDigest,
    generator: envelope.campaign.generator.implementationRevision,
    "boundary-transform": envelope.campaign.boundaryTransform.implementationRevision,
    renderer: envelope.campaign.rendererRevision,
    configuration: envelope.campaign.configurationDigest,
  });
  const values = new Map<IdentityComponent, unknown>();
  const factoryRegistry = isFactoryRevisionRegistry(registry);
  const fallbackBudget: ValueBudget = { nodes: 0, bytes: 0 };
  const fallbackClosedObjects = new WeakMap<object, unknown>();

  for (const component of COMPONENTS) {
    let value: unknown;
    try {
      value = registry.resolve(component, requested[component]);
    } catch {
      return incompatible(component);
    }
    if (value === undefined) return incompatible(component);
    if (factoryRegistry) {
      if (component === "rule-model") {
        if (!isModeledGeneratorSuite(value)) return incompatible(component);
        const state = getModeledSuiteState(value);
        if (
          state === undefined ||
          state.ruleModelDigest !== requested[component] ||
          state.protocolVersion !== envelope.campaign.ruleModelVersion
        ) {
          return incompatible(component);
        }
      }
      values.set(component, value);
      continue;
    }
    try {
      const closed = closeOpaqueValue(
        value,
        `/resolved/${component}`,
        fallbackBudget,
        fallbackClosedObjects,
      );
      if (!closed.ok) return incompatible(component);
      values.set(component, closed.value);
    } catch {
      return incompatible(component);
    }
  }

  const resolved: Readonly<Record<IdentityComponent, unknown>> = Object.freeze({
    inventory: values.get("inventory"),
    "rule-model": values.get("rule-model"),
    generator: values.get("generator"),
    "boundary-transform": values.get("boundary-transform"),
    renderer: values.get("renderer"),
    configuration: values.get("configuration"),
  });
  return Object.freeze({ ok: true, resolved });
}
