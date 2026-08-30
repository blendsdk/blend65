import { isDeepStrictEqual } from "node:util";

import { renderGeneratedCase } from "./case-generator.js";
import { createFailureClaimWitnessesV1 } from "./failure-claim-witness.js";
import { compareFailureTransformationsV1 } from "./failure-transformation-model.js";
import { validateGeneratorIr } from "./generator-ir-validator.js";
import { renderSourceModule } from "./source-renderer.js";
import { createUtf8ByteBoundaryIndex } from "./utf8-byte-boundaries.js";

import type { FailureClaimWitnessV1 } from "./failure-envelope.js";
import type { FailureTransformationV1 } from "./failure-transformation-model.js";
import type { GenExpression, GenModule, GenStatement } from "./generator-ir.js";
import type { MalformedTokenSpanV1 } from "./malformed-diagnostic-case.js";
import type { InvalidSourceTransform, ParameterValueBinding } from "./modeled-generator-model.js";
import type { ReductionCandidateDraftV1 } from "./reduction-candidate.js";

const DELETE = Symbol("delete-reduction-value");
type InvalidDraft = Extract<ReductionCandidateDraftV1, { readonly kind: "typed-invalid" }>;

/** Lazy deterministic source of compact transformation descriptors. */
export interface FailureTransformationDescriptorSourceV1 {
  /** Returns one zero-based descriptor, or `undefined` after complete enumeration. */
  at(ordinal: number): FailureTransformationV1 | undefined;
  /** Materializes the complete descriptor set for explicit inspection APIs. */
  all(): readonly FailureTransformationV1[];
  /** Whether the authenticated reducer budget is too small to inspect the complete typed catalog. */
  readonly capacityExceeded: boolean;
}

interface ExpressionLocation {
  readonly path: string;
  readonly expression: GenExpression;
}

interface ModuleLocations {
  readonly statements: readonly string[];
  readonly expressions: readonly ExpressionLocation[];
  readonly truncated: boolean;
}

interface LocationAllowance {
  remaining: number;
  truncated: boolean;
}

/** Splits one internally minted canonical pointer into path segments. */
function pointerParts(path: string): readonly string[] | undefined {
  if (!path.startsWith("/") || path.includes("~")) return undefined;
  return path
    .slice(1)
    .split("/")
    .filter((part) => part.length > 0);
}

/** Immutably updates or removes the value at one retained canonical path. */
function updateAt(
  value: unknown,
  parts: readonly string[],
  replacement: (current: unknown) => unknown | typeof DELETE,
): unknown | typeof DELETE {
  if (parts.length === 0) return replacement(value);
  const head = parts[0];
  if (head === undefined) return value;
  const tail = parts.slice(1);
  if (Array.isArray(value)) {
    const index = Number(head);
    if (!Number.isSafeInteger(index) || index < 0 || index >= value.length) return value;
    const changed = updateAt(value[index], tail, replacement);
    if (changed === DELETE) return value.filter((_item, itemIndex) => itemIndex !== index);
    return value.map((item, itemIndex) => (itemIndex === index ? changed : item));
  }
  if (typeof value !== "object" || value === null || !Object.hasOwn(value, head)) return value;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const changed = key === head ? updateAt(child, tail, replacement) : child;
    if (changed !== DELETE) output[key] = changed;
  }
  return output;
}

/** Records expressions in the same parent-before-child order used by canonical pointers. */
function visitExpression(
  expression: GenExpression,
  path: string,
  output: ExpressionLocation[],
  allowance?: LocationAllowance,
): void {
  if (allowance !== undefined) {
    if (allowance.remaining === 0) {
      allowance.truncated = true;
      return;
    }
    allowance.remaining -= 1;
  }
  output.push({ path, expression });
  if (expression.kind === "unary") {
    visitExpression(expression.operand, `${path}/operand`, output, allowance);
  } else if (expression.kind === "binary") {
    visitExpression(expression.left, `${path}/left`, output, allowance);
    visitExpression(expression.right, `${path}/right`, output, allowance);
  } else if (expression.kind === "memory-read") {
    visitExpression(expression.address, `${path}/address`, output, allowance);
  }
}

/** Records every expression carried by one closed statement shape. */
function visitStatement(
  statement: GenStatement,
  path: string,
  output: ExpressionLocation[],
  allowance?: LocationAllowance,
): void {
  if (statement.kind === "local") {
    visitExpression(statement.initializer, `${path}/initializer`, output, allowance);
  } else if (statement.kind === "assign") {
    visitExpression(statement.value, `${path}/value`, output, allowance);
  } else if (statement.kind === "memory-write") {
    visitExpression(statement.address, `${path}/address`, output, allowance);
    visitExpression(statement.value, `${path}/value`, output, allowance);
  } else if (statement.value !== undefined) {
    visitExpression(statement.value, `${path}/value`, output, allowance);
  }
}

/** Returns all statement and expression pointers under one selected root name. */
function moduleLocations(
  module: GenModule,
  root: "module" | "baseline",
  maximumLocations = Number.MAX_SAFE_INTEGER,
): ModuleLocations {
  const statements: string[] = [];
  const expressions: ExpressionLocation[] = [];
  const allowance: LocationAllowance = { remaining: maximumLocations, truncated: false };
  for (const [index, constant] of module.constants.entries()) {
    visitExpression(constant.value, `/${root}/constants/${index}/value`, expressions, allowance);
    if (allowance.truncated) return { statements, expressions, truncated: true };
  }
  for (const [functionIndex, fn] of module.functions.entries()) {
    if (fn.body.length === 0) {
      if (allowance.remaining === 0) return { statements, expressions, truncated: true };
      allowance.remaining -= 1;
    }
    for (const [statementIndex, statement] of fn.body.entries()) {
      if (allowance.remaining === 0) return { statements, expressions, truncated: true };
      allowance.remaining -= 1;
      const path = `/${root}/functions/${functionIndex}/body/${statementIndex}`;
      statements.push(path);
      visitStatement(statement, path, expressions, allowance);
      if (allowance.truncated) return { statements, expressions, truncated: true };
    }
  }
  return { statements, expressions, truncated: false };
}

/** Removes constants no expression references after one simplification. */
function removeUnusedConstants(module: GenModule): GenModule {
  const usedNames = new Set<string>();
  for (const { expression } of moduleLocations(module, "module").expressions) {
    if (expression.kind === "name") usedNames.add(expression.name);
  }
  return { ...module, constants: module.constants.filter(({ name }) => usedNames.has(name)) };
}

/** Creates all structurally possible typed edits before invariant filtering. */
function typedDescriptors(
  module: GenModule,
  maximumDescriptors: number,
): { readonly descriptors: readonly FailureTransformationV1[]; readonly truncated: boolean } {
  const { statements, expressions, truncated } = moduleLocations(
    module,
    "module",
    maximumDescriptors + 1,
  );
  const edits: FailureTransformationV1[] = [];
  if (module.path.length > 1) {
    edits.push({
      revision: "failure-transformation-v1",
      kind: "typed-statement-delete",
      path: `/module/path/${module.path.length - 1}`,
    });
  }
  for (const path of statements) {
    edits.push({ revision: "failure-transformation-v1", kind: "typed-statement-delete", path });
  }
  for (const { path, expression } of expressions) {
    if (expression.kind === "literal" && expression.value !== 0n) {
      edits.push({
        revision: "failure-transformation-v1",
        kind: "typed-literal-simplify",
        path,
        value: "0",
      });
    } else if (expression.kind === "binary") {
      if (expression.left.type === expression.type) {
        edits.push({
          revision: "failure-transformation-v1",
          kind: "typed-expression-simplify",
          path,
          replacement: "left",
        });
      }
      if (expression.right.type === expression.type) {
        edits.push({
          revision: "failure-transformation-v1",
          kind: "typed-expression-simplify",
          path,
          replacement: "right",
        });
      }
    } else if (expression.kind === "unary" && expression.operand.type === expression.type) {
      edits.push({
        revision: "failure-transformation-v1",
        kind: "typed-expression-simplify",
        path,
        replacement: "operand",
      });
    } else if (expression.kind === "name") {
      edits.push({
        revision: "failure-transformation-v1",
        kind: "typed-expression-simplify",
        path,
        replacement: expression.type === "boolean" ? "false" : "zero",
      });
    }
  }
  const sorted = edits.sort(compareFailureTransformationsV1);
  return {
    descriptors: Object.freeze(sorted.slice(0, maximumDescriptors + 1)),
    truncated: truncated || sorted.length > maximumDescriptors,
  };
}

/** Returns the one pointer field carried by every closed invalid transform. */
function invalidTransformTarget(transform: InvalidSourceTransform): string {
  if (transform.kind === "parameter-binding-replace") return transform.parameterPath;
  return transform.kind === "scalar-expression-replace"
    ? transform.expressionPath
    : transform.callPath;
}

/** Rebases a pointer after deleting one statement, or rejects a pointer into that statement. */
function rebasePointerAfterStatementDelete(
  pointer: string,
  deletedPath: string,
  pointerRoot: "transform" | "witness",
): string | undefined {
  const pointerSegments = pointerParts(pointer);
  const deletedSegments = pointerParts(deletedPath);
  if (pointerSegments === undefined || deletedSegments === undefined) return undefined;
  const deletedRoot = deletedSegments[0];
  if (
    deletedSegments.length !== 5 ||
    (deletedRoot !== "module" && deletedRoot !== "baseline") ||
    deletedSegments[1] !== "functions" ||
    deletedSegments[3] !== "body"
  ) {
    return pointer;
  }
  const comparablePointer =
    pointerRoot === "witness" ? pointerSegments : [deletedRoot, ...pointerSegments];
  if (
    comparablePointer[0] !== deletedRoot ||
    comparablePointer[1] !== "functions" ||
    comparablePointer[2] !== deletedSegments[2] ||
    comparablePointer[3] !== "body"
  ) {
    return pointer;
  }
  const deletedIndex = Number(deletedSegments[4]);
  const targetIndex = Number(comparablePointer[4]);
  if (!Number.isSafeInteger(deletedIndex) || !Number.isSafeInteger(targetIndex)) return undefined;
  if (targetIndex === deletedIndex) return undefined;
  if (targetIndex < deletedIndex) return pointer;
  const rebased = [...comparablePointer];
  rebased[4] = String(targetIndex - 1);
  return `/${(pointerRoot === "witness" ? rebased : rebased.slice(1)).join("/")}`;
}

/** Rebases the target pointer carried by one invalid transform. */
function rebaseInvalidTransform(
  transform: InvalidSourceTransform,
  deletedPath: string,
): InvalidSourceTransform | undefined {
  const rebased = rebasePointerAfterStatementDelete(
    invalidTransformTarget(transform),
    deletedPath,
    "transform",
  );
  if (rebased === undefined) return undefined;
  if (transform.kind === "parameter-binding-replace") return transform;
  if (transform.kind === "scalar-expression-replace") {
    return Object.freeze({ ...transform, expressionPath: rebased });
  }
  return Object.freeze({ ...transform, callPath: rebased });
}

/** Rebase retained witnesses and remove only incidental claims deleted with their witness. */
function rebaseClaimsAfterStatementDelete(
  claims: readonly string[],
  witnesses: readonly FailureClaimWitnessV1[],
  deletedPath: string,
): { readonly claims: readonly string[]; readonly witnesses: readonly FailureClaimWitnessV1[] } {
  const rebased: FailureClaimWitnessV1[] = [];
  for (const witness of witnesses) {
    const path = rebasePointerAfterStatementDelete(witness.path, deletedPath, "witness");
    if (path !== undefined) rebased.push(Object.freeze({ ...witness, path }));
  }
  const retainedRuleIds = new Set(rebased.map(({ ruleId }) => ruleId));
  return {
    claims: Object.freeze(claims.filter((ruleId) => retainedRuleIds.has(ruleId))),
    witnesses: Object.freeze(rebased),
  };
}

/** Whether one parameter binding is unused by expressions and is not the intentional target. */
function bindingIsUnused(
  module: GenModule,
  binding: ParameterValueBinding,
  transform: InvalidSourceTransform,
  referencedNames: ReadonlySet<string>,
): boolean {
  if (
    transform.kind === "parameter-binding-replace" &&
    transform.parameterPath === binding.parameterPath
  ) {
    return false;
  }
  const parts = pointerParts(binding.parameterPath);
  if (
    parts === undefined ||
    parts.length !== 4 ||
    parts[0] !== "functions" ||
    parts[2] !== "parameters"
  ) {
    return false;
  }
  const functionIndex = Number(parts[1]);
  const parameterIndex = Number(parts[3]);
  const parameter = module.functions[functionIndex]?.parameters[parameterIndex];
  if (parameter === undefined) return false;
  return !referencedNames.has(parameter.name);
}

/** Creates all actual invalid baseline, rebase, simplify, and unused-binding descriptors. */
function invalidDescriptors(
  draft: InvalidDraft,
  maximumDescriptors: number,
): { readonly descriptors: readonly FailureTransformationV1[]; readonly truncated: boolean } {
  const edits: FailureTransformationV1[] = [];
  const locations = moduleLocations(draft.baseline, "baseline", maximumDescriptors + 1);
  const referencedNames = new Set(
    locations.expressions
      .filter(({ expression }) => expression.kind === "name")
      .map(({ expression }) => (expression.kind === "name" ? expression.name : "")),
  );
  const target = invalidTransformTarget(draft.transform);
  let hasTargetRebase = false;
  for (const path of locations.statements) {
    const rebased = rebasePointerAfterStatementDelete(target, path, "transform");
    if (rebased !== undefined) {
      if (rebased !== target) hasTargetRebase = true;
      edits.push({
        revision: "failure-transformation-v1",
        kind: rebased === target ? "invalid-baseline-delete" : "invalid-transform-target-rebase",
        path,
      });
    }
    edits.push({
      revision: "failure-transformation-v1",
      kind: "invalid-baseline-simplify",
      path,
    });
  }
  if (!hasTargetRebase) {
    const targetStatement = /^\/functions\/([0-9]+)\/body\/([0-9]+)(?:\/|$)/u.exec(target);
    const fallbackPath =
      targetStatement === null
        ? locations.statements[0]
        : `/baseline/functions/${targetStatement[1]}/body/${targetStatement[2]}`;
    if (fallbackPath !== undefined) {
      edits.push({
        revision: "failure-transformation-v1",
        kind: "invalid-transform-target-rebase",
        path: fallbackPath,
      });
    }
  }
  let hasUnusedBinding = false;
  let bindingScanTruncated = false;
  let bindingScanCount = 0;
  for (const binding of locations.truncated ? [] : draft.parameterBindings) {
    if (bindingScanCount > maximumDescriptors) {
      bindingScanTruncated = true;
      break;
    }
    bindingScanCount += 1;
    if (bindingIsUnused(draft.baseline, binding, draft.transform, referencedNames)) {
      hasUnusedBinding = true;
      edits.push({
        revision: "failure-transformation-v1",
        kind: "invalid-unused-binding-remove",
        parameterPath: binding.parameterPath,
      });
    }
  }
  let fallbackBindingPath = draft.parameterBindings[0]?.parameterPath;
  if (fallbackBindingPath === undefined) {
    const functionLimit = Math.min(draft.baseline.functions.length, maximumDescriptors + 1);
    for (let functionIndex = 0; functionIndex < functionLimit; functionIndex += 1) {
      if ((draft.baseline.functions[functionIndex]?.parameters.length ?? 0) > 0) {
        fallbackBindingPath = `/functions/${functionIndex}/parameters/0`;
        break;
      }
    }
    if (draft.baseline.functions.length > functionLimit) bindingScanTruncated = true;
  }
  fallbackBindingPath ??= target;
  if (!hasUnusedBinding) {
    edits.push({
      revision: "failure-transformation-v1",
      kind: "invalid-unused-binding-remove",
      parameterPath: fallbackBindingPath,
    });
  }
  const sorted = edits.sort(compareFailureTransformationsV1);
  return {
    descriptors: Object.freeze(sorted.slice(0, maximumDescriptors + 1)),
    truncated: locations.truncated || bindingScanTruncated || sorted.length > maximumDescriptors,
  };
}

/** Creates a lazy coarse-to-fine raw descriptor source ending at individual code points. */
function rawDescriptorSource(
  bytes: Uint8Array,
  tokens: readonly MalformedTokenSpanV1[],
  maximumDescriptors: number,
): FailureTransformationDescriptorSourceV1 {
  const index = createUtf8ByteBoundaryIndex(bytes, true);
  const boundaries = index === undefined ? new Uint32Array() : Uint32Array.from(index.values());
  const pointCount = Math.max(0, boundaries.length - 1);
  const cache: FailureTransformationV1[] = [];
  const seenRanges = new Set<string>();
  let partitions = pointCount === 0 ? 0 : 1;
  let partitionIndex = 0;
  let tokenIndex = 0;
  let chunksComplete = pointCount === 0;

  const appendNext = (): boolean => {
    while (!chunksComplete) {
      if (partitionIndex >= partitions) {
        if (partitions === pointCount) {
          chunksComplete = true;
          break;
        }
        partitions = Math.min(partitions * 2, pointCount);
        partitionIndex = 0;
        continue;
      }
      const currentIndex = partitionIndex;
      partitionIndex += 1;
      const startPoint = Math.floor((pointCount * currentIndex) / partitions);
      const endPoint = Math.floor((pointCount * (currentIndex + 1)) / partitions);
      const startByte = boundaries[startPoint];
      const endByte = boundaries[endPoint];
      if (startByte === undefined || endByte === undefined || startByte >= endByte) continue;
      const key = `${startByte}:${endByte}`;
      if (seenRanges.has(key)) continue;
      seenRanges.add(key);
      cache.push({
        revision: "failure-transformation-v1",
        kind: "malformed-byte-chunk-delete",
        startByte,
        endByte,
      });
      return true;
    }
    const token = tokens[tokenIndex];
    if (token === undefined) return false;
    tokenIndex += 1;
    cache.push({
      revision: "failure-transformation-v1",
      kind: "malformed-token-range-delete",
      startByte: token.startByte,
      endByte: token.endByte,
    });
    return true;
  };
  return {
    get capacityExceeded() {
      return cache.length > maximumDescriptors;
    },
    at(ordinal) {
      if (ordinal > maximumDescriptors) return undefined;
      while (cache.length <= ordinal && appendNext()) {
        // The source advances one compact descriptor at a time.
      }
      return cache[ordinal];
    },
    all() {
      while (cache.length <= maximumDescriptors && appendNext()) {
        // Explicit inspection drains only its authenticated finite allowance.
      }
      return cache.length > maximumDescriptors ? Object.freeze([]) : Object.freeze([...cache]);
    },
  };
}

/** Creates a descriptor source without eagerly expanding large raw inputs. */
export function createFailureTransformationDescriptorSourceV1(
  draft: ReductionCandidateDraftV1,
  maximumDescriptors = 4_096,
): FailureTransformationDescriptorSourceV1 {
  if (draft.kind !== "raw-malformed") {
    const result =
      draft.kind === "typed-valid"
        ? typedDescriptors(draft.module, maximumDescriptors)
        : invalidDescriptors(draft, maximumDescriptors);
    return {
      capacityExceeded: result.truncated,
      at: (ordinal) => result.descriptors[ordinal],
      all: () => result.descriptors,
    };
  }
  return rawDescriptorSource(draft.sourceBytes, draft.tokens, maximumDescriptors);
}

/** Creates canonical structural descriptors without evaluating candidate invariants. */
export function createFailureTransformationDescriptorsV1(
  draft: ReductionCandidateDraftV1,
): readonly FailureTransformationV1[] {
  return Object.freeze(
    createFailureTransformationDescriptorSourceV1(draft)
      .all()
      .map((descriptor) => Object.freeze(descriptor)),
  );
}

/** Produces a zero-valued statement with fewer expression nodes when that is possible. */
function simplifyStatement(current: unknown): unknown {
  if (typeof current !== "object" || current === null) return current;
  const kind = Reflect.get(current, "kind");
  const field =
    kind === "local"
      ? "initializer"
      : kind === "assign" || kind === "return" || kind === "memory-write"
        ? "value"
        : undefined;
  if (field === undefined) return current;
  const expression = Reflect.get(current, field);
  if (typeof expression !== "object" || expression === null) return current;
  const type = Reflect.get(expression, "type");
  if (typeof type !== "string") return current;
  return { ...current, [field]: { kind: "literal", type, value: 0n } };
}

/** Renders one complete invalid draft so its exact source remains coupled to its transform. */
function renderInvalidDraft(draft: InvalidDraft): InvalidDraft | undefined {
  const rendered = renderGeneratedCase(
    {
      projection: { kind: "invalid", baseline: draft.baseline, transform: draft.transform },
      parameterBindings: draft.parameterBindings,
      primaryRuleId: draft.primaryRuleId,
      claimedRuleIds: draft.claimedRuleIds,
      spelling: "literal",
      validity: {
        kind: "invalid",
        neighborId: draft.neighborId,
        violatedPredicateId: draft.violatedPredicateId,
        expectedDiagnosticFamily: draft.diagnosticFamily,
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
  return rendered.ok ? { ...draft, sourceBytes: rendered.sourceBytes } : undefined;
}

/** Deletes one code-point-aligned raw range and rebases retained token spans. */
function deleteRawRange(
  bytes: Uint8Array,
  tokens: readonly MalformedTokenSpanV1[],
  startByte: number,
  endByte: number,
): { readonly bytes: Uint8Array; readonly tokens: readonly MalformedTokenSpanV1[] } | undefined {
  const boundaries = createUtf8ByteBoundaryIndex(bytes, true);
  if (
    boundaries === undefined ||
    !boundaries.has(startByte) ||
    !boundaries.has(endByte) ||
    startByte >= endByte
  ) {
    return undefined;
  }
  const output = new Uint8Array(bytes.length - (endByte - startByte));
  output.set(bytes.subarray(0, startByte));
  output.set(bytes.subarray(endByte), startByte);
  const shift = endByte - startByte;
  const retained: MalformedTokenSpanV1[] = [];
  for (const token of tokens) {
    if (token.endByte <= startByte) retained.push(token);
    else if (token.startByte >= endByte) {
      retained.push(
        Object.freeze({
          ...token,
          startByte: token.startByte - shift,
          endByte: token.endByte - shift,
        }),
      );
    }
  }
  return { bytes: output, tokens: Object.freeze(retained) };
}

/** Applies one typed-valid descriptor and refreshes source plus rebased claim metadata. */
function typedDraftAfter(
  draft: Extract<ReductionCandidateDraftV1, { readonly kind: "typed-valid" }>,
  transformation: FailureTransformationV1,
): ReductionCandidateDraftV1 | undefined {
  if (
    transformation.kind !== "typed-statement-delete" &&
    transformation.kind !== "typed-literal-simplify" &&
    transformation.kind !== "typed-expression-simplify"
  ) {
    return undefined;
  }
  const parts = pointerParts(transformation.path);
  if (parts?.[0] !== "module") return undefined;
  let updated: unknown;
  if (transformation.kind === "typed-statement-delete") {
    updated = updateAt(draft.module, parts.slice(1), () => DELETE);
  } else if (transformation.kind === "typed-literal-simplify") {
    updated = updateAt(draft.module, parts.slice(1), (current) => {
      if (typeof current !== "object" || current === null) return current;
      return { ...current, value: BigInt(transformation.value) };
    });
  } else {
    updated = updateAt(draft.module, parts.slice(1), (current) => {
      if (typeof current !== "object" || current === null) return current;
      const replacement = transformation.replacement;
      if (replacement === "left" || replacement === "right" || replacement === "operand") {
        return Reflect.get(current, replacement);
      }
      return { kind: "literal", type: Reflect.get(current, "type"), value: 0n };
    });
    const intermediate = validateGeneratorIr(updated);
    if (!intermediate.ok) return undefined;
    updated = removeUnusedConstants(intermediate.module);
  }
  if (updated === DELETE || isDeepStrictEqual(updated, draft.module)) return undefined;
  const validated = validateGeneratorIr(updated);
  if (!validated.ok) return undefined;
  const rendered = renderSourceModule(validated.module, {
    maxSourceBytes: 1_048_576,
    literalSpellings: [],
  });
  if (!rendered.ok) return undefined;
  const claims =
    transformation.kind === "typed-statement-delete"
      ? rebaseClaimsAfterStatementDelete(
          draft.claimedRuleIds,
          draft.claimWitnesses,
          transformation.path,
        )
      : {
          claims: draft.claimedRuleIds,
          witnesses: createFailureClaimWitnessesV1(
            validated.module,
            draft.claimedRuleIds,
            "module",
          ),
        };
  if (claims.witnesses === undefined) return undefined;
  return {
    ...draft,
    module: validated.module,
    sourceBytes: rendered.sourceBytes,
    claimedRuleIds: claims.claims,
    claimWitnesses: claims.witnesses,
  };
}

/** Applies one typed-invalid descriptor, including deletion-coupled target and witness rebasing. */
function invalidDraftAfter(
  draft: InvalidDraft,
  transformation: FailureTransformationV1,
): ReductionCandidateDraftV1 | undefined {
  if (transformation.kind === "invalid-unused-binding-remove") {
    const bindings = draft.parameterBindings.filter(
      ({ parameterPath }) => parameterPath !== transformation.parameterPath,
    );
    if (bindings.length === draft.parameterBindings.length) return undefined;
    return renderInvalidDraft({ ...draft, parameterBindings: Object.freeze(bindings) });
  }
  if (
    transformation.kind !== "invalid-baseline-delete" &&
    transformation.kind !== "invalid-baseline-simplify" &&
    transformation.kind !== "invalid-transform-target-rebase"
  ) {
    return undefined;
  }
  const parts = pointerParts(transformation.path);
  if (parts?.[0] !== "baseline") return undefined;
  const deleting = transformation.kind !== "invalid-baseline-simplify";
  const updated = updateAt(
    draft.baseline,
    parts.slice(1),
    deleting ? () => DELETE : simplifyStatement,
  );
  if (updated === DELETE || isDeepStrictEqual(updated, draft.baseline)) return undefined;
  const validated = validateGeneratorIr(updated);
  if (!validated.ok) return undefined;
  const transform = deleting
    ? rebaseInvalidTransform(draft.transform, transformation.path)
    : draft.transform;
  if (transform === undefined) return undefined;
  const claims = deleting
    ? rebaseClaimsAfterStatementDelete(
        draft.claimedRuleIds,
        draft.claimWitnesses,
        transformation.path,
      )
    : { claims: draft.claimedRuleIds, witnesses: draft.claimWitnesses };
  return renderInvalidDraft({
    ...draft,
    baseline: validated.module,
    transform,
    claimedRuleIds: claims.claims,
    claimWitnesses: claims.witnesses,
  });
}

/** Applies one structural descriptor without trusting it as an invariant-preserving proposal. */
export function applyFailureTransformationDraftV1(
  draft: ReductionCandidateDraftV1,
  transformation: FailureTransformationV1,
): ReductionCandidateDraftV1 | undefined {
  if (draft.kind === "typed-valid") return typedDraftAfter(draft, transformation);
  if (draft.kind === "typed-invalid") return invalidDraftAfter(draft, transformation);
  if (
    transformation.kind !== "malformed-byte-chunk-delete" &&
    transformation.kind !== "malformed-token-range-delete"
  ) {
    return undefined;
  }
  const deleted = deleteRawRange(
    draft.sourceBytes,
    draft.tokens,
    transformation.startByte,
    transformation.endByte,
  );
  return deleted === undefined
    ? undefined
    : { ...draft, sourceBytes: deleted.bytes, tokens: deleted.tokens };
}
