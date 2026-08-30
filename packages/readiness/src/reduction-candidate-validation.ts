import { isDeepStrictEqual } from "node:util";

import { renderGeneratedCase } from "./case-generator.js";
import { copyUint8Array, uint8ArrayByteLength } from "./canonical-identity.js";
import {
  getAuthorizedFailureEnvelopeStateV1,
  type AuthorizedFailureEnvelopeV1,
  type FailureClaimWitnessV1,
  type FailureEnvelopeInitialCandidateV1,
} from "./failure-envelope.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { isScalarType } from "./generator-ir.js";
import {
  malformedUtf8BoundariesV1,
  type MalformedTokenSpanV1,
} from "./malformed-diagnostic-case.js";
import { renderSourceModule } from "./source-renderer.js";
import { failureWitnessEntailsRuleV1 } from "./failure-claim-witness.js";
import {
  compareExecutionText,
  isExecutionIdentifier,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";
import { digestReductionValueV1, encodeReductionValueV1 } from "./reduction-value.js";

import type { GenExpression, GenModule, GenParameter, ScalarType } from "./generator-ir.js";
import type { InvalidSourceTransform, ParameterValueBinding } from "./modeled-generator-model.js";
import type {
  ReductionCandidateDraftV1,
  ReductionSizeV1,
  ValidatedReductionCandidateProjectionV1,
} from "./reduction-candidate.js";

const VALID_KEYS = [
  "revision",
  "kind",
  "sourceBytes",
  "module",
  "parameterBindings",
  "primaryRuleId",
  "claimedRuleIds",
  "claimWitnesses",
] as const;
const INVALID_KEYS = [
  "revision",
  "kind",
  "sourceBytes",
  "baseline",
  "transform",
  "parameterBindings",
  "primaryRuleId",
  "claimedRuleIds",
  "claimWitnesses",
  "neighborId",
  "violatedPredicateId",
  "diagnosticFamily",
] as const;
const RAW_KEYS = ["revision", "kind", "sourceBytes", "tokens"] as const;
const WITNESS_KEYS = ["ruleId", "path"] as const;
const TOKEN_KEYS = ["kind", "startByte", "endByte"] as const;

function nodeCount(value: unknown): number {
  if (typeof value !== "object" || value === null || value instanceof Uint8Array) return 1;
  if (Array.isArray(value)) return 1 + value.reduce((total, item) => total + nodeCount(item), 0);
  return 1 + Object.values(value).reduce((total, item) => total + nodeCount(item), 0);
}

interface NormalizedClaims {
  readonly claims: readonly string[];
  readonly witnesses: readonly FailureClaimWitnessV1[];
}

function normalizeClaims(
  claimsInput: unknown,
  witnessesInput: unknown,
): NormalizedClaims | undefined {
  const claimsRaw = readExecutionArray(claimsInput, 4_096);
  const witnessesRaw = readExecutionArray(witnessesInput, 4_096);
  if (claimsRaw === undefined || witnessesRaw === undefined) return undefined;
  const claims: string[] = [];
  const claimSet = new Set<string>();
  for (const value of claimsRaw) {
    if (!isExecutionIdentifier(value) || claimSet.has(value)) return undefined;
    claimSet.add(value);
    claims.push(value);
  }
  const witnesses: FailureClaimWitnessV1[] = [];
  const witnessedRules = new Set<string>();
  for (const value of witnessesRaw) {
    const witness = readExecutionRecord(value, WITNESS_KEYS);
    if (
      witness === undefined ||
      !isExecutionIdentifier(witness.ruleId) ||
      typeof witness.path !== "string" ||
      witnessedRules.has(witness.ruleId)
    ) {
      return undefined;
    }
    witnessedRules.add(witness.ruleId);
    witnesses.push(Object.freeze({ ruleId: witness.ruleId, path: witness.path }));
  }
  if (
    witnesses.some(({ ruleId }) => !claimSet.has(ruleId)) ||
    claims.some((ruleId) => !witnessedRules.has(ruleId))
  ) {
    return undefined;
  }
  claims.sort(compareExecutionText);
  witnesses.sort((left, right) => compareExecutionText(left.ruleId, right.ruleId));
  return { claims: Object.freeze(claims), witnesses: Object.freeze(witnesses) };
}

function canonicalIndex(value: string): number | undefined {
  if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && String(parsed) === value ? parsed : undefined;
}

function pointerSegment(value: string): string | undefined {
  if (/~(?:[^01]|$)/u.test(value)) return undefined;
  return value.replaceAll("~1", "/").replaceAll("~0", "~");
}

/**
 * Resolves one canonical JSON pointer without executing accessors or accepting array aliases.
 * Validated generator trees use ordinary immutable data, but this boundary remains defensive
 * because candidate drafts are hostile input.
 */
function resolvePointer(root: unknown, pointer: string): unknown {
  if (!pointer.startsWith("/")) return undefined;
  let current = root;
  for (const encoded of pointer.slice(1).split("/")) {
    const segment = pointerSegment(encoded);
    if (segment === undefined || typeof current !== "object" || current === null) return undefined;
    if (Array.isArray(current)) {
      const index = canonicalIndex(segment);
      if (index === undefined || index >= current.length) return undefined;
      current = current[index];
      continue;
    }
    const descriptor = Reflect.getOwnPropertyDescriptor(current, segment);
    if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
      return undefined;
    }
    current = descriptor.value;
  }
  return current;
}

function witnessesResolve(
  rootName: "module" | "baseline",
  module: GenModule,
  witnesses: readonly FailureClaimWitnessV1[],
): boolean {
  const root = Object.freeze({ [rootName]: module });
  return witnesses.every(({ ruleId, path }) => {
    if (path !== `/${rootName}` && !path.startsWith(`/${rootName}/`)) return false;
    const resolved = resolvePointer(root, path);
    return failureWitnessEntailsRuleV1(ruleId, resolved);
  });
}

function normalizeTokens(
  input: unknown,
  bytes: Uint8Array,
): readonly MalformedTokenSpanV1[] | undefined {
  const values = readExecutionArray(input, 4_096);
  const boundaries = malformedUtf8BoundariesV1(bytes);
  if (
    values === undefined ||
    boundaries === undefined ||
    (bytes.length === 0 && values.length > 0)
  ) {
    return undefined;
  }
  const tokens: MalformedTokenSpanV1[] = [];
  let previousEnd = 0;
  for (const value of values) {
    const token = readExecutionRecord(value, TOKEN_KEYS);
    if (
      token === undefined ||
      (token.kind !== "token" && token.kind !== "trivia" && token.kind !== "unknown") ||
      typeof token.startByte !== "number" ||
      !Number.isSafeInteger(token.startByte) ||
      typeof token.endByte !== "number" ||
      !Number.isSafeInteger(token.endByte) ||
      token.startByte < previousEnd ||
      token.endByte <= token.startByte ||
      !boundaries.has(token.startByte) ||
      !boundaries.has(token.endByte)
    ) {
      return undefined;
    }
    tokens.push(
      Object.freeze({ kind: token.kind, startByte: token.startByte, endByte: token.endByte }),
    );
    previousEnd = token.endByte;
  }
  return Object.freeze(tokens);
}

function sourceBytes(input: unknown, allowEmpty: boolean): Uint8Array | undefined {
  const byteLength = uint8ArrayByteLength(input);
  const bytes =
    byteLength !== undefined && byteLength <= 1_048_576 ? copyUint8Array(input) : undefined;
  if (bytes === undefined || (!allowEmpty && bytes.byteLength === 0)) {
    return undefined;
  }
  return malformedUtf8BoundariesV1(bytes) === undefined ? undefined : bytes;
}

function normalizeBindings(input: unknown): readonly ParameterValueBinding[] | undefined {
  const values = readExecutionArray(input, 256);
  if (values === undefined) return undefined;
  const bindings: ParameterValueBinding[] = [];
  const paths = new Set<string>();
  for (const value of values) {
    const binding = readExecutionRecord(value, ["kind", "parameterPath", "value"]);
    if (
      binding === undefined ||
      binding.kind !== "parameter-value" ||
      typeof binding.parameterPath !== "string" ||
      (typeof binding.value !== "bigint" && typeof binding.value !== "boolean") ||
      paths.has(binding.parameterPath)
    ) {
      return undefined;
    }
    paths.add(binding.parameterPath);
    bindings.push(
      Object.freeze({
        kind: "parameter-value",
        parameterPath: binding.parameterPath,
        value: binding.value,
      }),
    );
  }
  return Object.freeze(bindings);
}

function parameterAt(module: GenModule, path: string): GenParameter | undefined {
  const segments = path.split("/");
  if (
    segments.length !== 5 ||
    segments[0] !== "" ||
    segments[1] !== "functions" ||
    segments[3] !== "parameters"
  ) {
    return undefined;
  }
  // The exact five-segment check above proves both indexed segments exist.
  const functionIndex = canonicalIndex(segments[2]!);
  const parameterIndex = canonicalIndex(segments[4]!);
  return functionIndex === undefined || parameterIndex === undefined
    ? undefined
    : module.functions[functionIndex]?.parameters[parameterIndex];
}

function valueMatches(type: ScalarType, value: bigint | boolean): boolean {
  if (type === "boolean") return typeof value === "boolean";
  if (typeof value !== "bigint") return false;
  switch (type) {
    case "byte":
      return value >= 0n && value <= 255n;
    case "sbyte":
      return value >= -128n && value <= 127n;
    case "word":
      return value >= 0n && value <= 65_535n;
    case "sword":
      return value >= -32_768n && value <= 32_767n;
  }
}

function bindingsResolve(
  module: GenModule,
  bindings: readonly ParameterValueBinding[],
  intentionalInvalidPath?: string,
): boolean {
  let intentionalViolations = 0;
  for (const binding of bindings) {
    const parameter = parameterAt(module, binding.parameterPath);
    if (parameter === undefined) return false;
    if (!valueMatches(parameter.type, binding.value)) {
      if (binding.parameterPath !== intentionalInvalidPath) return false;
      intentionalViolations += 1;
    }
  }
  return intentionalInvalidPath === undefined
    ? intentionalViolations === 0
    : intentionalViolations === 1;
}

function intrinsicArgumentType(
  module: GenModule,
  callPath: string,
  argumentIndex: number,
): ScalarType | undefined {
  const target = resolvePointer(module, callPath);
  if (typeof target !== "object" || target === null) return undefined;
  const kind = Reflect.getOwnPropertyDescriptor(target, "kind");
  if (kind === undefined || !("value" in kind)) return undefined;
  if (kind.value === "memory-read") return argumentIndex === 0 ? "word" : undefined;
  if (kind.value !== "memory-write") return undefined;
  if (argumentIndex === 0) return "word";
  if (argumentIndex !== 1) return undefined;
  const width = Reflect.getOwnPropertyDescriptor(target, "width");
  return width !== undefined && "value" in width && width.value === 1
    ? "byte"
    : width !== undefined && "value" in width && width.value === 2
      ? "word"
      : undefined;
}

/**
 * Proves the retained transform still creates one intentional invalid delta. Rendering separately
 * proves that its path applies exactly once; this check proves that replacement data is actually
 * outside the target's scalar contract instead of merely carrying historical neighbor labels.
 */
function transformRetainsIntentionalViolation(
  module: GenModule,
  bindings: readonly ParameterValueBinding[],
  transform: InvalidSourceTransform,
): boolean {
  if (transform.kind === "parameter-binding-replace") {
    const parameter = parameterAt(module, transform.parameterPath);
    const binding = bindings.find(({ parameterPath }) => parameterPath === transform.parameterPath);
    return (
      parameter !== undefined &&
      binding !== undefined &&
      binding.value === transform.replacement.value &&
      !valueMatches(parameter.type, binding.value)
    );
  }
  if (transform.kind === "scalar-expression-replace") {
    const target = resolvePointer(module, transform.expressionPath);
    if (typeof target !== "object" || target === null) return false;
    const type = Reflect.getOwnPropertyDescriptor(target, "type");
    return (
      type !== undefined &&
      "value" in type &&
      isScalarType(type.value) &&
      !valueMatches(type.value, transform.replacement.value)
    );
  }
  if (
    transform.kind === "intrinsic-argument-remove" ||
    transform.kind === "intrinsic-argument-insert"
  ) {
    return intrinsicArgumentType(module, transform.callPath, 0) !== undefined;
  }
  const expectedType = intrinsicArgumentType(module, transform.callPath, transform.argumentIndex);
  return expectedType !== undefined && transform.argument.type !== expectedType;
}

function integerReplacement(
  input: unknown,
): { readonly kind: "integer-literal"; readonly value: bigint } | undefined {
  const replacement = readExecutionRecord(input, ["kind", "value"]);
  return replacement !== undefined &&
    replacement.kind === "integer-literal" &&
    typeof replacement.value === "bigint"
    ? Object.freeze({ kind: "integer-literal", value: replacement.value })
    : undefined;
}

function normalizeArgumentExpression(input: unknown): GenExpression | undefined {
  const validated = validateGeneratorIr({
    kind: "module",
    path: ["ReductionArgument"],
    constants: [{ kind: "const", name: "argument", type: "word", value: input }],
    functions: [],
  });
  // Successful validation preserves the single constant constructed above.
  return validated.ok ? validated.module.constants[0]!.value : undefined;
}

function normalizeInvalidTransform(input: unknown): InvalidSourceTransform | undefined {
  const remove = readExecutionRecord(input, ["kind", "callPath", "argumentIndex"]);
  if (
    remove !== undefined &&
    remove.kind === "intrinsic-argument-remove" &&
    typeof remove.callPath === "string" &&
    Number.isSafeInteger(remove.argumentIndex) &&
    Number(remove.argumentIndex) >= 0
  ) {
    return Object.freeze({
      kind: "intrinsic-argument-remove",
      callPath: remove.callPath,
      argumentIndex: Number(remove.argumentIndex),
    });
  }
  const argumentRecord = readExecutionRecord(input, [
    "kind",
    "callPath",
    "argumentIndex",
    "argument",
  ]);
  const argument =
    argumentRecord === undefined ? undefined : normalizeArgumentExpression(argumentRecord.argument);
  if (
    argumentRecord !== undefined &&
    (argumentRecord.kind === "intrinsic-argument-insert" ||
      argumentRecord.kind === "intrinsic-argument-replace") &&
    typeof argumentRecord.callPath === "string" &&
    Number.isSafeInteger(argumentRecord.argumentIndex) &&
    Number(argumentRecord.argumentIndex) >= 0 &&
    argument !== undefined
  ) {
    return Object.freeze({
      kind: argumentRecord.kind,
      callPath: argumentRecord.callPath,
      argumentIndex: Number(argumentRecord.argumentIndex),
      argument,
    });
  }
  const expressionRecord = readExecutionRecord(input, ["kind", "expressionPath", "replacement"]);
  const expressionReplacement =
    expressionRecord === undefined ? undefined : integerReplacement(expressionRecord.replacement);
  if (
    expressionRecord !== undefined &&
    expressionRecord.kind === "scalar-expression-replace" &&
    typeof expressionRecord.expressionPath === "string" &&
    expressionReplacement !== undefined
  ) {
    return Object.freeze({
      kind: "scalar-expression-replace",
      expressionPath: expressionRecord.expressionPath,
      replacement: expressionReplacement,
    });
  }
  const bindingRecord = readExecutionRecord(input, ["kind", "parameterPath", "replacement"]);
  const bindingReplacement =
    bindingRecord === undefined ? undefined : integerReplacement(bindingRecord.replacement);
  return bindingRecord !== undefined &&
    bindingRecord.kind === "parameter-binding-replace" &&
    typeof bindingRecord.parameterPath === "string" &&
    bindingReplacement !== undefined
    ? Object.freeze({
        kind: "parameter-binding-replace",
        parameterPath: bindingRecord.parameterPath,
        replacement: bindingReplacement,
      })
    : undefined;
}

function claimsMatchEnvelope(
  original: AuthorizedFailureEnvelopeV1,
  expected: Extract<
    FailureEnvelopeInitialCandidateV1,
    { readonly kind: "typed-valid" | "typed-invalid" }
  >,
  claims: NormalizedClaims,
  primaryRuleId: unknown,
  rootName: "module" | "baseline",
  module: GenModule,
): primaryRuleId is string {
  const state = getAuthorizedFailureEnvelopeStateV1(original);
  if (
    state === undefined ||
    state.projection.family !== expected.kind ||
    !isExecutionIdentifier(primaryRuleId) ||
    primaryRuleId !== expected.primaryRuleId ||
    primaryRuleId !== state.projection.predicate.primaryRuleId
  ) {
    return false;
  }
  const originalClaims = new Set(expected.claimedRuleIds);
  const retainedClaims = new Set(claims.claims);
  return (
    claims.claims.every((ruleId) => originalClaims.has(ruleId)) &&
    retainedClaims.has(primaryRuleId) &&
    state.projection.predicate.requiredClaimedRuleIds.every((ruleId) =>
      retainedClaims.has(ruleId),
    ) &&
    witnessesResolve(rootName, module, claims.witnesses)
  );
}

/** Closes one hostile draft and proves its complete family-specific invariant. */
export function validateReductionCandidateDraftV1(
  original: AuthorizedFailureEnvelopeV1,
  input: unknown,
): ValidatedReductionCandidateProjectionV1 | undefined {
  const envelope = getAuthorizedFailureEnvelopeStateV1(original);
  if (envelope === undefined) return undefined;
  const expected = envelope.projection.initialCandidate;
  const valid = readExecutionRecord(input, VALID_KEYS);
  if (
    valid !== undefined &&
    valid.revision === "reduction-candidate-draft-v1" &&
    valid.kind === "typed-valid"
  ) {
    if (
      envelope.projection.family !== "typed-valid" ||
      expected.kind !== "typed-valid" ||
      envelope.projection.replay.kind !== "typed-campaign" ||
      envelope.projection.replay.generatedProjection.kind !== "valid"
    )
      return undefined;
    const bytes = sourceBytes(valid.sourceBytes, false);
    const moduleResult = validateGeneratorIr(valid.module);
    const claims = normalizeClaims(valid.claimedRuleIds, valid.claimWitnesses);
    const bindings = normalizeBindings(valid.parameterBindings);
    if (
      bytes === undefined ||
      !moduleResult.ok ||
      claims === undefined ||
      bindings === undefined ||
      !claimsMatchEnvelope(
        original,
        expected,
        claims,
        valid.primaryRuleId,
        "module",
        moduleResult.module,
      ) ||
      !bindingsResolve(moduleResult.module, bindings)
    ) {
      return undefined;
    }
    const rendered = renderSourceModule(moduleResult.module, {
      maxSourceBytes: 1_048_576,
      literalSpellings: [],
    });
    if (!rendered.ok || !isDeepStrictEqual(rendered.sourceBytes, bytes)) return undefined;
    const draft: ReductionCandidateDraftV1 = Object.freeze({
      revision: "reduction-candidate-draft-v1",
      kind: "typed-valid",
      sourceBytes: bytes,
      module: moduleResult.module,
      parameterBindings: bindings,
      primaryRuleId: valid.primaryRuleId,
      claimedRuleIds: claims.claims,
      claimWitnesses: claims.witnesses,
    });
    const size: ReductionSizeV1 = Object.freeze([
      nodeCount(moduleResult.module),
      encodeReductionValueV1(moduleResult.module).byteLength,
      bytes.byteLength,
      encodeReductionValueV1(draft).byteLength,
    ]);
    return Object.freeze({
      revision: "validated-reduction-candidate-projection-v1",
      family: "typed-valid",
      draft,
      size,
      contentDigest: digestReductionValueV1(draft),
    });
  }
  const invalid = readExecutionRecord(input, INVALID_KEYS);
  if (
    invalid !== undefined &&
    invalid.revision === "reduction-candidate-draft-v1" &&
    invalid.kind === "typed-invalid"
  ) {
    if (
      envelope.projection.family !== "typed-invalid" ||
      expected.kind !== "typed-invalid" ||
      envelope.projection.replay.kind !== "typed-campaign" ||
      envelope.projection.replay.generatedProjection.kind !== "invalid"
    )
      return undefined;
    const bytes = sourceBytes(invalid.sourceBytes, false);
    const baseline = validateGeneratorIr(invalid.baseline);
    const claims = normalizeClaims(invalid.claimedRuleIds, invalid.claimWitnesses);
    const bindings = normalizeBindings(invalid.parameterBindings);
    const transform = normalizeInvalidTransform(invalid.transform);
    if (
      bytes === undefined ||
      !baseline.ok ||
      claims === undefined ||
      bindings === undefined ||
      transform === undefined ||
      !claimsMatchEnvelope(
        original,
        expected,
        claims,
        invalid.primaryRuleId,
        "baseline",
        baseline.module,
      ) ||
      invalid.neighborId !== expected.neighborId ||
      invalid.violatedPredicateId !== expected.violatedPredicateId ||
      invalid.diagnosticFamily !== expected.diagnosticFamily ||
      !transformRetainsIntentionalViolation(baseline.module, bindings, transform) ||
      !bindingsResolve(
        baseline.module,
        bindings,
        transform.kind === "parameter-binding-replace" ? transform.parameterPath : undefined,
      )
    ) {
      return undefined;
    }
    const rendered =
      transform.kind === "parameter-binding-replace"
        ? renderSourceModule(baseline.module, {
            maxSourceBytes: 1_048_576,
            literalSpellings: [],
          })
        : renderGeneratedCase(
            {
              projection: { kind: "invalid", baseline: baseline.module, transform },
              parameterBindings: bindings,
              primaryRuleId: invalid.primaryRuleId,
              claimedRuleIds: claims.claims,
              spelling: "literal",
              validity: {
                kind: "invalid",
                neighborId: invalid.neighborId,
                violatedPredicateId: invalid.violatedPredicateId,
                expectedDiagnosticFamily: invalid.diagnosticFamily,
              },
              constructionUsage: {
                modules: 0n,
                declarations: 0n,
                "ir-nodes": 0n,
                statements: 0n,
                "expression-depth": 0n,
                "loop-work": 0n,
              },
            },
            { maxSourceBytes: 1_048_576, literalSpellings: [] },
          );
    if (!rendered.ok || !isDeepStrictEqual(rendered.sourceBytes, bytes)) return undefined;
    const draft: ReductionCandidateDraftV1 = Object.freeze({
      revision: "reduction-candidate-draft-v1",
      kind: "typed-invalid",
      sourceBytes: bytes,
      baseline: baseline.module,
      transform,
      parameterBindings: bindings,
      primaryRuleId: invalid.primaryRuleId,
      claimedRuleIds: claims.claims,
      claimWitnesses: claims.witnesses,
      neighborId: invalid.neighborId,
      violatedPredicateId: invalid.violatedPredicateId,
      diagnosticFamily: invalid.diagnosticFamily,
    });
    const size: ReductionSizeV1 = Object.freeze([
      nodeCount(baseline.module),
      encodeReductionValueV1(draft.transform).byteLength,
      encodeReductionValueV1({ claims: draft.claimedRuleIds, bindings: draft.parameterBindings })
        .byteLength,
    ]);
    return Object.freeze({
      revision: "validated-reduction-candidate-projection-v1",
      family: "typed-invalid",
      draft,
      size,
      contentDigest: digestReductionValueV1(draft),
    });
  }
  const raw = readExecutionRecord(input, RAW_KEYS);
  if (
    raw !== undefined &&
    raw.revision === "reduction-candidate-draft-v1" &&
    raw.kind === "raw-malformed"
  ) {
    if (
      envelope.projection.family !== "raw-malformed" ||
      expected.kind !== "raw-malformed" ||
      envelope.projection.replay.kind !== "raw-malformed" ||
      envelope.projection.replay.envelope.ruleId !== envelope.projection.predicate.primaryRuleId ||
      envelope.projection.predicate.requiredClaimedRuleIds.length !== 1 ||
      envelope.projection.predicate.requiredClaimedRuleIds[0] !==
        envelope.projection.replay.envelope.ruleId
    ) {
      return undefined;
    }
    const bytes = sourceBytes(raw.sourceBytes, true);
    if (bytes === undefined) return undefined;
    const tokens = normalizeTokens(raw.tokens, bytes);
    if (tokens === undefined) return undefined;
    const draft: ReductionCandidateDraftV1 = Object.freeze({
      revision: "reduction-candidate-draft-v1",
      kind: "raw-malformed",
      sourceBytes: bytes,
      tokens,
    });
    const size: ReductionSizeV1 = Object.freeze([
      tokens.length,
      bytes.byteLength,
      digestReductionValueV1(bytes),
    ]);
    return Object.freeze({
      revision: "validated-reduction-candidate-projection-v1",
      family: "raw-malformed",
      draft,
      size,
      contentDigest: digestReductionValueV1(draft),
    });
  }
  return undefined;
}
