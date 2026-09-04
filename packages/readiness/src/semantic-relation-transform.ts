import {
  allOnesForType,
  constantsAreIndependent,
  declaredRelationNames,
  freshRelationName,
  isPureRelationExpression,
  localInitializerDependenciesAreLiftable,
  localIsReassigned,
  resolveDeclarationSelection,
  resolveExpressionSelection,
  selectedExpression,
} from "./semantic-relation-analysis.js";
import {
  currentSemanticRelationFault,
  semanticRelationPreconditionAccepted,
  semanticRelationRewritePath,
} from "./semantic-relation-conformance.js";
import { oracleFailure, type OracleFailure } from "./oracle-input.js";
import { isGenIdentifier } from "./generator-ir.js";
import type {
  BinaryOperator,
  GenExpression,
  GenModule,
  GenStatement,
  ScalarType,
} from "./generator-ir.js";
import type {
  GeneratedModeledCase,
  InvalidSourceTransform,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import type { PreparedSemanticRelationRequestV1 } from "./semantic-relation-input.js";
import {
  freezeExpression,
  freezeFunction,
  freezeModule,
  inapplicable,
  invalidTransformResolves,
  mapExpressionNames,
  mapStatementNames,
  renamedInvalidTransform,
  replaceNestedExpression,
  replaceStatementExpression,
  transformedCase,
} from "./semantic-relation-transform-helpers.js";
import {
  applySemanticRelationRewriteMutationCore,
  nonPreservingFault,
  semanticClosureFault,
} from "./semantic-relation-transform-faults.js";
import {
  moduleNodeCount,
  relationExpressionNodeCount,
  transformedBudgetFailure,
} from "./semantic-relation-transform-budget.js";

/** Successful immutable rewrite before transformed structural/semantic validation. */
export interface SemanticRelationTransformSuccessV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** Rewritten modeled case. */
  readonly transformedCase: GeneratedModeledCase;
  /** Rewritten module selected for validation/evaluation. */
  readonly transformedModule: GenModule;
  /** Entry name after a possible function rename. */
  readonly transformedEntryFunction: string;
}

/** False relation precondition without a transformed case. */
export interface SemanticRelationTransformInapplicableV1 {
  /** Success discriminator. */
  readonly ok: true;
  /** False-precondition discriminator. */
  readonly outcome: "relation-inapplicable";
}

/** Closed rewrite result. */
export type SemanticRelationTransformResultV1 =
  | SemanticRelationTransformSuccessV1
  | SemanticRelationTransformInapplicableV1
  | OracleFailure;

const EMPTY_BINDINGS: readonly ParameterValueBinding[] = Object.freeze([]);

function forcedApplicabilityFailure(): OracleFailure {
  return oracleFailure(
    "oracle.relation.invalid",
    "/selectionPath",
    "Selected relation is not applicable to the requested source location.",
  );
}

function sourceProjectionAllowsRelation(prepared: PreparedSemanticRelationRequestV1): boolean {
  return (
    prepared.request.sourceCase.projection.kind !== "invalid" ||
    prepared.request.relationId === "relation.identifier-renaming" ||
    prepared.request.relationId === "relation.independent-declaration-reordering"
  );
}

/**
 * Rejects an applicable local lift whose transformed tree cannot fit its budget.
 *
 * The source evaluator can materialize a large final-memory observation, so this
 * check runs before the one source execution used to capture the local value.
 *
 * @param prepared Replay-verified immutable request.
 * @returns A transformed-node budget failure, or `undefined` when evaluation may proceed.
 */
export function preflightSemanticRelationTransformBudget(
  prepared: PreparedSemanticRelationRequestV1,
): OracleFailure | undefined {
  if (prepared.request.relationId !== "relation.local-to-parameter") return undefined;
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  if (selection?.kind !== "local" || selection.functionIndex !== prepared.entryFunctionIndex) {
    return undefined;
  }
  const fn = prepared.sourceModule.functions[selection.functionIndex];
  const statement = fn?.body[selection.statementIndex];
  if (
    fn === undefined ||
    statement?.kind !== "local" ||
    !isPureRelationExpression(statement.initializer) ||
    !localInitializerDependenciesAreLiftable(prepared.sourceModule, fn, statement.initializer) ||
    localIsReassigned(fn, statement.name, selection.statementIndex)
  ) {
    return undefined;
  }
  return transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) - relationExpressionNodeCount(statement.initializer),
  );
}

function rewriteIdentifier(
  prepared: PreparedSemanticRelationRequestV1,
): SemanticRelationTransformResultV1 {
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  const occupied = declaredRelationNames(prepared.sourceModule);
  let selectedName: string | undefined;
  if (selection?.kind === "constant") {
    selectedName = prepared.sourceModule.constants[selection.constantIndex]?.name;
  } else if (selection?.kind === "function") {
    selectedName = prepared.sourceModule.functions[selection.functionIndex]?.name;
  } else if (selection?.kind === "parameter") {
    selectedName =
      prepared.sourceModule.functions[selection.functionIndex]?.parameters[selection.parameterIndex]
        ?.name;
  } else if (selection?.kind === "local") {
    const statement =
      prepared.sourceModule.functions[selection.functionIndex]?.body[selection.statementIndex];
    selectedName = statement?.kind === "local" ? statement.name : undefined;
  }
  const fresh = selectedName === undefined ? undefined : freshRelationName(selectedName, occupied);
  const applicable =
    selection !== undefined &&
    selectedName !== undefined &&
    fresh !== undefined &&
    isGenIdentifier(fresh) &&
    sourceProjectionAllowsRelation(prepared);
  if (!semanticRelationPreconditionAccepted(prepared.request.relationId, applicable)) {
    return inapplicable();
  }
  if (!applicable || selection === undefined || selectedName === undefined || fresh === undefined) {
    return forcedApplicabilityFailure();
  }
  const budgetFailure = transformedBudgetFailure(prepared, moduleNodeCount(prepared.sourceModule));
  if (budgetFailure !== undefined) return budgetFailure;

  const constants = prepared.sourceModule.constants.map((constant, index) =>
    Object.freeze({
      ...constant,
      name:
        selection.kind === "constant" &&
        index === selection.constantIndex &&
        constant.name === selectedName
          ? fresh
          : constant.name,
      value:
        selection.kind === "constant"
          ? mapExpressionNames(constant.value, selectedName, fresh)
          : freezeExpression(constant.value),
    }),
  );
  const functions = prepared.sourceModule.functions.map((fn, functionIndex) => {
    const renameWithinFunction =
      selection.kind === "constant" ||
      (selection.kind !== "function" && selection.functionIndex === functionIndex);
    const parameters = fn.parameters.map((parameter, parameterIndex) =>
      Object.freeze({
        ...parameter,
        name:
          selection.kind === "parameter" &&
          functionIndex === selection.functionIndex &&
          parameterIndex === selection.parameterIndex &&
          parameter.name === selectedName
            ? fresh
            : parameter.name,
      }),
    );
    const body = fn.body.map((statement, statementIndex) =>
      renameWithinFunction
        ? mapStatementNames(
            statement,
            selectedName,
            fresh,
            selection.kind === "local" &&
              functionIndex === selection.functionIndex &&
              statementIndex === selection.statementIndex,
          )
        : mapStatementNames(statement, "", fresh, false),
    );
    return Object.freeze({
      ...fn,
      name:
        selection.kind === "function" &&
        functionIndex === selection.functionIndex &&
        fn.name === selectedName
          ? fresh
          : fn.name,
      parameters: Object.freeze(parameters),
      body: Object.freeze(body),
    });
  });
  return finalizeTransform(
    prepared,
    freezeModule({ ...prepared.sourceModule, constants, functions }),
    selection.kind === "function" && selectedName === prepared.request.entryFunction
      ? fresh
      : prepared.request.entryFunction,
    undefined,
    renamedInvalidTransform(prepared.request.sourceCase.projection, selectedName, fresh),
  );
}

function rewriteLiteralToLocal(
  prepared: PreparedSemanticRelationRequestV1,
): SemanticRelationTransformResultV1 {
  const selection = resolveExpressionSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  const expression =
    selection === undefined ? undefined : selectedExpression(prepared.sourceModule, selection);
  const occupied = declaredRelationNames(prepared.sourceModule);
  const name = freshRelationName("introduced", occupied);
  const applicable =
    selection === undefined ||
    selection.kind !== "statement" ||
    selection.functionIndex !== prepared.entryFunctionIndex ||
    expression?.kind !== "literal" ||
    !isGenIdentifier(name) ||
    !sourceProjectionAllowsRelation(prepared)
      ? false
      : true;
  if (!semanticRelationPreconditionAccepted(prepared.request.relationId, applicable)) {
    return inapplicable();
  }
  if (
    !applicable ||
    selection?.kind !== "statement" ||
    expression?.kind !== "literal" ||
    !isGenIdentifier(name)
  ) {
    return forcedApplicabilityFailure();
  }
  const statementSelection = selection;
  const localName = name;
  const budgetFailure = transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) + 2n,
  );
  if (budgetFailure !== undefined) return budgetFailure;
  const functions = prepared.sourceModule.functions.map((fn, functionIndex) => {
    if (functionIndex !== statementSelection.functionIndex) return freezeFunction(fn);
    const body: GenStatement[] = [];
    for (let index = 0; index < fn.body.length; index += 1) {
      const statement = fn.body[index];
      if (statement === undefined) continue;
      if (index === statementSelection.statementIndex) {
        body.push(
          Object.freeze({
            kind: "local",
            name: localName,
            type: expression.type,
            initializer: freezeExpression(expression),
          }),
        );
        const replacement = Object.freeze({
          kind: "name" as const,
          name: localName,
          type: expression.type,
        });
        const replaced = replaceStatementExpression(
          statement,
          statementSelection.field,
          statementSelection.expressionPath,
          replacement,
        );
        if (replaced === undefined) return freezeFunction(fn);
        body.push(replaced);
      } else {
        body.push(freezeFunction({ ...fn, body: [statement] }).body[0] ?? statement);
      }
    }
    return Object.freeze({
      ...fn,
      parameters: Object.freeze([...fn.parameters]),
      body: Object.freeze(body),
    });
  });
  return finalizeTransform(
    prepared,
    freezeModule({ ...prepared.sourceModule, functions }),
    prepared.request.entryFunction,
  );
}

function rewriteLocalToParameter(
  prepared: PreparedSemanticRelationRequestV1,
  liftedValue: bigint | boolean | undefined,
): SemanticRelationTransformResultV1 {
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  const fn =
    selection?.kind === "local"
      ? prepared.sourceModule.functions[selection.functionIndex]
      : undefined;
  const statement = selection?.kind === "local" ? fn?.body[selection.statementIndex] : undefined;
  const occupied = declaredRelationNames(prepared.sourceModule);
  const name =
    statement?.kind === "local" ? freshRelationName(statement.name, occupied) : undefined;
  const applicable =
    selection?.kind === "local" &&
    selection.functionIndex === prepared.entryFunctionIndex &&
    liftedValue !== undefined &&
    fn !== undefined &&
    statement?.kind === "local" &&
    isPureRelationExpression(statement.initializer) &&
    localInitializerDependenciesAreLiftable(prepared.sourceModule, fn, statement.initializer) &&
    !localIsReassigned(fn, statement.name, selection.statementIndex) &&
    name !== undefined &&
    isGenIdentifier(name) &&
    sourceProjectionAllowsRelation(prepared);
  if (!semanticRelationPreconditionAccepted(prepared.request.relationId, applicable)) {
    return inapplicable();
  }
  if (
    !applicable ||
    selection?.kind !== "local" ||
    fn === undefined ||
    statement?.kind !== "local" ||
    liftedValue === undefined ||
    name === undefined
  ) {
    return forcedApplicabilityFailure();
  }
  const budgetFailure = transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) - relationExpressionNodeCount(statement.initializer),
  );
  if (budgetFailure !== undefined) return budgetFailure;
  const functions = prepared.sourceModule.functions.map((candidate, functionIndex) => {
    if (functionIndex !== selection.functionIndex) return freezeFunction(candidate);
    return Object.freeze({
      ...candidate,
      parameters: Object.freeze([
        ...candidate.parameters.map((parameter) => Object.freeze({ ...parameter })),
        Object.freeze({ name, type: statement.type }),
      ]),
      body: Object.freeze(
        candidate.body
          .filter((_item, index) => index !== selection.statementIndex)
          .map((item) => mapStatementNames(item, statement.name, name, false)),
      ),
    });
  });
  const parameterIndex = fn.parameters.length;
  const bindings = Object.freeze([
    ...prepared.generatedCase.effectiveParameterBindings.map((binding) =>
      Object.freeze({ ...binding }),
    ),
    Object.freeze({
      kind: "parameter-value" as const,
      parameterPath: `/functions/${selection.functionIndex}/parameters/${parameterIndex}`,
      value: liftedValue,
    }),
  ]);
  return finalizeTransform(
    prepared,
    freezeModule({ ...prepared.sourceModule, functions }),
    prepared.request.entryFunction,
    bindings,
  );
}

function numericType(type: ScalarType): type is Exclude<ScalarType, "boolean"> {
  return type !== "boolean";
}

function algebraicOperator(variantId: string): BinaryOperator | undefined {
  const operators: Readonly<Record<string, BinaryOperator>> = Object.freeze({
    "add-zero-right": "+",
    "subtract-zero-right": "-",
    "multiply-one-right": "*",
    "divide-one-right": "/",
    "or-zero-right": "|",
    "xor-zero-right": "^",
    "and-all-ones-right": "&",
    "shift-left-zero": "<<",
    "shift-right-zero": ">>",
  });
  return operators[variantId];
}

function rewriteAlgebraicIdentity(
  prepared: PreparedSemanticRelationRequestV1,
): SemanticRelationTransformResultV1 {
  const selection = resolveExpressionSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  const expression =
    selection === undefined ? undefined : selectedExpression(prepared.sourceModule, selection);
  const operator = algebraicOperator(prepared.request.variantId);
  const rightValue =
    prepared.request.variantId === "multiply-one-right" ||
    prepared.request.variantId === "divide-one-right"
      ? 1n
      : prepared.request.variantId === "and-all-ones-right" &&
          expression !== undefined &&
          numericType(expression.type)
        ? allOnesForType(expression.type)
        : 0n;
  const applicable =
    selection === undefined ||
    expression === undefined ||
    operator === undefined ||
    !numericType(expression.type) ||
    rightValue === undefined ||
    !sourceProjectionAllowsRelation(prepared)
      ? false
      : true;
  if (!semanticRelationPreconditionAccepted(prepared.request.relationId, applicable)) {
    return inapplicable();
  }
  if (
    !applicable ||
    selection === undefined ||
    expression === undefined ||
    operator === undefined ||
    !numericType(expression.type) ||
    rightValue === undefined
  ) {
    return forcedApplicabilityFailure();
  }
  const budgetFailure = transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) + 2n,
  );
  if (budgetFailure !== undefined) return budgetFailure;
  const rightType =
    prepared.request.variantId === "shift-left-zero" ||
    prepared.request.variantId === "shift-right-zero"
      ? "byte"
      : expression.type;
  const wrapped: GenExpression = Object.freeze({
    kind: "binary",
    type: expression.type,
    operator,
    left: freezeExpression(expression),
    right: Object.freeze({ kind: "literal", type: rightType, value: rightValue }),
  });
  const constants = prepared.sourceModule.constants.map((constant, constantIndex) => {
    if (selection.kind !== "constant" || constantIndex !== selection.constantIndex) {
      return Object.freeze({ ...constant, value: freezeExpression(constant.value) });
    }
    return Object.freeze({
      ...constant,
      value:
        replaceNestedExpression(constant.value, selection.expressionPath, wrapped) ??
        freezeExpression(constant.value),
    });
  });
  const functions = prepared.sourceModule.functions.map((fn, functionIndex) => {
    if (selection.kind !== "statement" || functionIndex !== selection.functionIndex) {
      return freezeFunction(fn);
    }
    return Object.freeze({
      ...fn,
      parameters: Object.freeze(fn.parameters.map((parameter) => Object.freeze({ ...parameter }))),
      body: Object.freeze(
        fn.body.map((statement, statementIndex) =>
          statementIndex === selection.statementIndex
            ? (replaceStatementExpression(
                statement,
                selection.field,
                selection.expressionPath,
                wrapped,
              ) ?? statement)
            : (freezeFunction({ ...fn, body: [statement] }).body[0] ?? statement),
        ),
      ),
    });
  });
  return finalizeTransform(
    prepared,
    freezeModule({ ...prepared.sourceModule, constants, functions }),
    prepared.request.entryFunction,
  );
}

function rewriteIndependentConstants(
  prepared: PreparedSemanticRelationRequestV1,
): SemanticRelationTransformResultV1 {
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  const constants = [...prepared.sourceModule.constants];
  const first = selection?.kind === "constant" ? constants[selection.constantIndex] : undefined;
  const second =
    selection?.kind === "constant" ? constants[selection.constantIndex + 1] : undefined;
  const projection = prepared.request.sourceCase.projection;
  let projectionAllows = true;
  if (projection.kind === "invalid") {
    const transformPath =
      projection.transform.kind === "parameter-binding-replace"
        ? projection.transform.parameterPath
        : projection.transform.kind === "scalar-expression-replace"
          ? projection.transform.expressionPath
          : projection.transform.callPath;
    const selectedPrefix =
      selection?.kind === "constant" ? `/constants/${selection.constantIndex}` : "";
    const adjacentPrefix =
      selection?.kind === "constant" ? `/constants/${selection.constantIndex + 1}` : "";
    if (
      transformPath === selectedPrefix ||
      transformPath.startsWith(`${selectedPrefix}/`) ||
      transformPath === adjacentPrefix ||
      transformPath.startsWith(`${adjacentPrefix}/`)
    ) {
      projectionAllows = false;
    }
  }
  const applicable =
    selection?.kind === "constant" &&
    constantsAreIndependent(
      prepared.sourceModule,
      selection.constantIndex,
      selection.constantIndex + 1,
    ) &&
    first !== undefined &&
    second !== undefined &&
    projectionAllows &&
    sourceProjectionAllowsRelation(prepared);
  if (!semanticRelationPreconditionAccepted(prepared.request.relationId, applicable)) {
    return inapplicable();
  }
  if (
    !applicable ||
    selection?.kind !== "constant" ||
    first === undefined ||
    second === undefined
  ) {
    return forcedApplicabilityFailure();
  }
  const budgetFailure = transformedBudgetFailure(prepared, moduleNodeCount(prepared.sourceModule));
  if (budgetFailure !== undefined) return budgetFailure;
  constants[selection.constantIndex] = second;
  constants[selection.constantIndex + 1] = first;
  return finalizeTransform(
    prepared,
    freezeModule({ ...prepared.sourceModule, constants }),
    prepared.request.entryFunction,
  );
}

/**
 * Applies the selected non-preserving conformance variant to an already rewritten module.
 *
 * The ordinary transform finalizer and the stable-ID worker both use this exact
 * branch, so adequacy execution cannot substitute a copied rewrite.
 *
 * @param relationId Relation that owns the rewrite.
 * @param variantId Ordinary rewrite variant being finalized.
 * @param module Real rewritten module.
 * @param entryFunction Selected transformed entry function.
 * @returns Unchanged module or the selected non-preserving mutation.
 */
export function applySemanticRelationRewriteMutation(
  relationId: PreparedSemanticRelationRequestV1["request"]["relationId"],
  variantId: string,
  module: GenModule,
  entryFunction: string,
): GenModule {
  return applySemanticRelationRewriteMutationCore(relationId, variantId, module, entryFunction);
}

function finalizeTransform(
  prepared: PreparedSemanticRelationRequestV1,
  module: GenModule,
  entryFunction: string,
  bindings: readonly ParameterValueBinding[] = EMPTY_BINDINGS,
  invalidTransform?: InvalidSourceTransform,
): SemanticRelationTransformResultV1 {
  const pathId = semanticRelationRewritePath(prepared.request.relationId);
  const fault = currentSemanticRelationFault(pathId);
  const finalModule =
    fault?.faultId === "relation.fault.non-preserving-rewrite"
      ? nonPreservingFault(module, entryFunction)
      : fault?.faultId === "relation.fault.semantic-closure-invalid-rewrite"
        ? semanticClosureFault(module)
        : applySemanticRelationRewriteMutation(
            prepared.request.relationId,
            prepared.request.variantId,
            module,
            entryFunction,
          );
  const budgetFailure = transformedBudgetFailure(prepared, moduleNodeCount(finalModule));
  if (budgetFailure !== undefined) return budgetFailure;
  const selectedBindings =
    bindings === EMPTY_BINDINGS
      ? prepared.request.sourceCase.projection.kind === "invalid" &&
        prepared.request.sourceCase.projection.transform.kind === "parameter-binding-replace"
        ? prepared.request.sourceCase.parameterBindings
        : prepared.generatedCase.effectiveParameterBindings
      : bindings;
  const projection = prepared.request.sourceCase.projection;
  const selectedInvalidTransform =
    projection.kind === "invalid" ? (invalidTransform ?? projection.transform) : undefined;
  if (
    selectedInvalidTransform !== undefined &&
    !invalidTransformResolves(finalModule, selectedInvalidTransform)
  ) {
    return inapplicable();
  }
  return Object.freeze({
    ok: true,
    transformedCase: transformedCase(
      prepared.request.sourceCase,
      finalModule,
      selectedBindings,
      selectedInvalidTransform,
    ),
    transformedModule: finalModule,
    transformedEntryFunction: entryFunction,
  });
}

/**
 * Applies one relation rewrite through its stable precondition and rewrite paths.
 *
 * @param prepared Replay-verified immutable request.
 * @param liftedValue Evaluated local initializer for local-to-parameter.
 * @returns Immutable transformed case, inapplicable result or closed failure.
 */
export function applySemanticRelationTransform(
  prepared: PreparedSemanticRelationRequestV1,
  liftedValue?: bigint | boolean,
): SemanticRelationTransformResultV1 {
  switch (prepared.request.relationId) {
    case "relation.identifier-renaming":
      return rewriteIdentifier(prepared);
    case "relation.literal-to-local":
      return rewriteLiteralToLocal(prepared);
    case "relation.local-to-parameter":
      return rewriteLocalToParameter(prepared, liftedValue);
    case "relation.algebraic-identity":
      return rewriteAlgebraicIdentity(prepared);
    case "relation.independent-declaration-reordering":
      return rewriteIndependentConstants(prepared);
  }
}

export {
  applyStructuredLoopUnrollingTransform,
  type StructuredLoopTransformSuccessV2,
} from "./structured-loop-unroll-transform.js";
