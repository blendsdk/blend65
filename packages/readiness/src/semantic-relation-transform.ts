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
  semanticRelationPreconditionPath,
  semanticRelationRewritePath,
} from "./semantic-relation-conformance.js";
import { createOracleBudgetMeter } from "./oracle-budget.js";
import type { OracleFailure } from "./oracle-input.js";
import { isGenIdentifier } from "./generator-ir.js";
import type {
  BinaryOperator,
  GenExpression,
  GenFunction,
  GenModule,
  GenStatement,
  ScalarType,
} from "./generator-ir.js";
import type {
  GeneratedCaseProjection,
  GeneratedModeledCase,
  InvalidSourceTransform,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import type { PreparedSemanticRelationRequestV1 } from "./semantic-relation-input.js";
import {
  freezeSemanticRelationValue,
  snapshotSemanticRelationValue,
} from "./semantic-relation-freeze.js";

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

function expressionNodeCount(expression: GenExpression): bigint {
  switch (expression.kind) {
    case "literal":
    case "name":
      return 1n;
    case "unary":
      return 1n + expressionNodeCount(expression.operand);
    case "binary":
      return 1n + expressionNodeCount(expression.left) + expressionNodeCount(expression.right);
    case "memory-read":
      return 1n + expressionNodeCount(expression.address);
  }
}

function moduleNodeCount(module: GenModule): bigint {
  let count = 1n + BigInt(module.constants.length + module.functions.length);
  for (const constant of module.constants) count += expressionNodeCount(constant.value);
  for (const fn of module.functions) {
    count += BigInt(fn.parameters.length + fn.body.length);
    for (const statement of fn.body) {
      if (statement.kind === "local") count += expressionNodeCount(statement.initializer);
      else if (statement.kind === "assign") count += expressionNodeCount(statement.value);
      else if (statement.kind === "memory-write") {
        count += expressionNodeCount(statement.address) + expressionNodeCount(statement.value);
      } else if (statement.value !== undefined) count += expressionNodeCount(statement.value);
    }
  }
  return count;
}

function transformedBudgetFailure(
  prepared: PreparedSemanticRelationRequestV1,
  nodeCount: bigint,
): OracleFailure | undefined {
  const charged = createOracleBudgetMeter(prepared.request.budget).charge(
    "transformedNodes",
    nodeCount,
    "/transformedCase",
  );
  return charged.ok ? undefined : Object.freeze({ ok: false, diagnostics: charged.diagnostics });
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
    moduleNodeCount(prepared.sourceModule) - expressionNodeCount(statement.initializer),
  );
}

function freezeExpression(expression: GenExpression): GenExpression {
  switch (expression.kind) {
    case "literal":
    case "name":
      return Object.freeze({ ...expression });
    case "unary":
      return Object.freeze({ ...expression, operand: freezeExpression(expression.operand) });
    case "binary":
      return Object.freeze({
        ...expression,
        left: freezeExpression(expression.left),
        right: freezeExpression(expression.right),
      });
    case "memory-read":
      return Object.freeze({ ...expression, address: freezeExpression(expression.address) });
  }
}

function mapExpressionNames(
  expression: GenExpression,
  oldName: string,
  newName: string,
): GenExpression {
  switch (expression.kind) {
    case "literal":
      return Object.freeze({ ...expression });
    case "name":
      return Object.freeze({
        ...expression,
        name: expression.name === oldName && isGenIdentifier(newName) ? newName : expression.name,
      });
    case "unary":
      return Object.freeze({
        ...expression,
        operand: mapExpressionNames(expression.operand, oldName, newName),
      });
    case "binary":
      return Object.freeze({
        ...expression,
        left: mapExpressionNames(expression.left, oldName, newName),
        right: mapExpressionNames(expression.right, oldName, newName),
      });
    case "memory-read":
      return Object.freeze({
        ...expression,
        address: mapExpressionNames(expression.address, oldName, newName),
      });
  }
}

function mapStatementNames(
  statement: GenStatement,
  oldName: string,
  newName: string,
  renameDeclaration: boolean,
): GenStatement {
  if (!isGenIdentifier(newName)) return statement;
  switch (statement.kind) {
    case "local":
      return Object.freeze({
        ...statement,
        name: renameDeclaration && statement.name === oldName ? newName : statement.name,
        initializer: mapExpressionNames(statement.initializer, oldName, newName),
      });
    case "assign":
      return Object.freeze({
        ...statement,
        target: statement.target === oldName ? newName : statement.target,
        value: mapExpressionNames(statement.value, oldName, newName),
      });
    case "memory-write":
      return Object.freeze({
        ...statement,
        address: mapExpressionNames(statement.address, oldName, newName),
        value: mapExpressionNames(statement.value, oldName, newName),
      });
    case "return":
      return Object.freeze({
        ...statement,
        ...(statement.value === undefined
          ? {}
          : { value: mapExpressionNames(statement.value, oldName, newName) }),
      });
  }
}

function freezeFunction(fn: GenFunction): GenFunction {
  return Object.freeze({
    ...fn,
    parameters: Object.freeze(fn.parameters.map((parameter) => Object.freeze({ ...parameter }))),
    body: Object.freeze(
      fn.body.map((statement) =>
        statement.kind === "local"
          ? Object.freeze({ ...statement, initializer: freezeExpression(statement.initializer) })
          : statement.kind === "assign"
            ? Object.freeze({ ...statement, value: freezeExpression(statement.value) })
            : statement.kind === "memory-write"
              ? Object.freeze({
                  ...statement,
                  address: freezeExpression(statement.address),
                  value: freezeExpression(statement.value),
                })
              : Object.freeze({
                  ...statement,
                  ...(statement.value === undefined
                    ? {}
                    : { value: freezeExpression(statement.value) }),
                }),
      ),
    ),
  });
}

function freezeModule(module: GenModule): GenModule {
  return Object.freeze({
    ...module,
    path: Object.freeze([...module.path]),
    constants: Object.freeze(
      module.constants.map((constant) =>
        Object.freeze({ ...constant, value: freezeExpression(constant.value) }),
      ),
    ),
    functions: Object.freeze(module.functions.map(freezeFunction)),
  });
}

function replaceProjectionModule(
  projection: GeneratedCaseProjection,
  module: GenModule,
  transform: InvalidSourceTransform | undefined,
): GeneratedCaseProjection {
  return projection.kind === "valid"
    ? Object.freeze({ kind: "valid", module })
    : Object.freeze({
        kind: "invalid",
        baseline: module,
        transform: snapshotSemanticRelationValue(transform ?? projection.transform),
      });
}

function transformedCase(
  source: GeneratedModeledCase,
  module: GenModule,
  parameterBindings: readonly ParameterValueBinding[] = source.parameterBindings,
  transform?: InvalidSourceTransform,
): GeneratedModeledCase {
  return freezeSemanticRelationValue({
    ...source,
    projection: replaceProjectionModule(source.projection, module, transform),
    parameterBindings: Object.freeze(
      parameterBindings.map((binding) => Object.freeze({ ...binding })),
    ),
    claimedRuleIds: Object.freeze([...source.claimedRuleIds]),
    validity: Object.freeze({ ...source.validity }),
    constructionUsage: Object.freeze({ ...source.constructionUsage }),
  });
}

function inapplicable(): SemanticRelationTransformInapplicableV1 {
  return Object.freeze({ ok: true, outcome: "relation-inapplicable" });
}

function canonicalIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) && String(index) === value ? index : undefined;
}

function invalidTransformResolves(module: GenModule, transform: InvalidSourceTransform): boolean {
  if (transform.kind === "parameter-binding-replace") {
    return resolveDeclarationSelection(module, transform.parameterPath)?.kind === "parameter";
  }
  if (transform.kind === "scalar-expression-replace") {
    const segments = transform.expressionPath.split("/");
    if (segments.length === 4 && segments[1] === "constants" && segments[3] === "value") {
      const index = canonicalIndex(segments[2]);
      return index !== undefined && module.constants[index] !== undefined;
    }
    return resolveExpressionSelection(module, transform.expressionPath) !== undefined;
  }
  const segments = transform.callPath.split("/");
  const functionIndex = canonicalIndex(segments[2]);
  const statementIndex = canonicalIndex(segments[4]);
  if (
    segments[0] !== "" ||
    segments[1] !== "functions" ||
    segments[3] !== "body" ||
    functionIndex === undefined ||
    statementIndex === undefined
  ) {
    return false;
  }
  const statement = module.functions[functionIndex]?.body[statementIndex];
  const argumentCount =
    segments.length === 5 && statement?.kind === "memory-write"
      ? 2
      : segments.length === 6 &&
          segments[5] === "value" &&
          statement?.kind === "return" &&
          statement.value?.kind === "memory-read"
        ? 1
        : undefined;
  if (argumentCount === undefined || !Number.isSafeInteger(transform.argumentIndex)) return false;
  return transform.kind === "intrinsic-argument-insert"
    ? transform.argumentIndex >= 0 && transform.argumentIndex <= argumentCount
    : transform.argumentIndex >= 0 && transform.argumentIndex < argumentCount;
}

function replaceNestedExpression(
  current: GenExpression,
  expressionPath: readonly ("left" | "right" | "operand" | "address")[],
  replacement: GenExpression,
): GenExpression | undefined {
  const [head, ...tail] = expressionPath;
  if (head === undefined) return replacement;
  if (head === "operand" && current.kind === "unary") {
    const operand = replaceNestedExpression(current.operand, tail, replacement);
    return operand === undefined ? undefined : Object.freeze({ ...current, operand });
  }
  if ((head === "left" || head === "right") && current.kind === "binary") {
    const child = replaceNestedExpression(current[head], tail, replacement);
    return child === undefined ? undefined : Object.freeze({ ...current, [head]: child });
  }
  if (head === "address" && current.kind === "memory-read") {
    const address = replaceNestedExpression(current.address, tail, replacement);
    return address === undefined ? undefined : Object.freeze({ ...current, address });
  }
  return undefined;
}

function replaceStatementExpression(
  statement: GenStatement,
  field: "initializer" | "value" | "address",
  expressionPath: readonly ("left" | "right" | "operand" | "address")[],
  expression: GenExpression,
): GenStatement | undefined {
  let root: GenExpression | undefined;
  if (field === "initializer" && statement.kind === "local") {
    root = statement.initializer;
  } else if (
    field === "value" &&
    (statement.kind === "assign" || statement.kind === "memory-write")
  ) {
    root = statement.value;
  } else if (field === "value" && statement.kind === "return") {
    root = statement.value;
  } else if (field === "address" && statement.kind === "memory-write") {
    root = statement.address;
  }
  if (root === undefined) return undefined;
  const replaced = replaceNestedExpression(root, expressionPath, expression);
  if (replaced === undefined) return undefined;
  if (field === "initializer" && statement.kind === "local") {
    return Object.freeze({ ...statement, initializer: replaced });
  }
  if (field === "address" && statement.kind === "memory-write") {
    return Object.freeze({ ...statement, address: replaced });
  }
  return field === "value" ? Object.freeze({ ...statement, value: replaced }) : undefined;
}

function renamedInvalidTransform(
  projection: GeneratedCaseProjection,
  oldName: string,
  newName: string,
): InvalidSourceTransform | undefined {
  if (projection.kind !== "invalid") return undefined;
  const transform = projection.transform;
  if (
    transform.kind === "intrinsic-argument-insert" ||
    transform.kind === "intrinsic-argument-replace"
  ) {
    return Object.freeze({
      ...transform,
      argument: mapExpressionNames(transform.argument, oldName, newName),
    });
  }
  return snapshotSemanticRelationValue(transform);
}

function rewriteIdentifier(
  prepared: PreparedSemanticRelationRequestV1,
): SemanticRelationTransformResultV1 {
  const selection = resolveDeclarationSelection(
    prepared.sourceModule,
    prepared.request.selectionPath,
  );
  if (selection === undefined) return inapplicable();
  const occupied = declaredRelationNames(prepared.sourceModule);
  let selectedName: string | undefined;
  if (selection.kind === "constant") {
    selectedName = prepared.sourceModule.constants[selection.constantIndex]?.name;
  } else if (selection.kind === "function") {
    selectedName = prepared.sourceModule.functions[selection.functionIndex]?.name;
  } else if (selection.kind === "parameter") {
    selectedName =
      prepared.sourceModule.functions[selection.functionIndex]?.parameters[selection.parameterIndex]
        ?.name;
  } else {
    const statement =
      prepared.sourceModule.functions[selection.functionIndex]?.body[selection.statementIndex];
    selectedName = statement?.kind === "local" ? statement.name : undefined;
  }
  if (selectedName === undefined) return inapplicable();
  const fresh = freshRelationName(selectedName, occupied);
  if (!isGenIdentifier(fresh)) return inapplicable();
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
  if (
    selection === undefined ||
    selection.kind !== "statement" ||
    selection.functionIndex !== prepared.entryFunctionIndex ||
    expression?.kind !== "literal"
  ) {
    return inapplicable();
  }
  const occupied = declaredRelationNames(prepared.sourceModule);
  const name = freshRelationName("introduced", occupied);
  if (!isGenIdentifier(name)) return inapplicable();
  const budgetFailure = transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) + 2n,
  );
  if (budgetFailure !== undefined) return budgetFailure;
  const functions = prepared.sourceModule.functions.map((fn, functionIndex) => {
    if (functionIndex !== selection.functionIndex) return freezeFunction(fn);
    const body: GenStatement[] = [];
    for (let index = 0; index < fn.body.length; index += 1) {
      const statement = fn.body[index];
      if (statement === undefined) continue;
      if (index === selection.statementIndex) {
        body.push(
          Object.freeze({
            kind: "local",
            name,
            type: expression.type,
            initializer: freezeExpression(expression),
          }),
        );
        const replacement = Object.freeze({
          kind: "name" as const,
          name,
          type: expression.type,
        });
        const replaced = replaceStatementExpression(
          statement,
          selection.field,
          selection.expressionPath,
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
  if (
    selection?.kind !== "local" ||
    selection.functionIndex !== prepared.entryFunctionIndex ||
    liftedValue === undefined
  ) {
    return inapplicable();
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
    return inapplicable();
  }
  const occupied = declaredRelationNames(prepared.sourceModule);
  const name = freshRelationName(statement.name, occupied);
  if (!isGenIdentifier(name)) return inapplicable();
  const budgetFailure = transformedBudgetFailure(
    prepared,
    moduleNodeCount(prepared.sourceModule) - expressionNodeCount(statement.initializer),
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
  if (
    selection === undefined ||
    expression === undefined ||
    operator === undefined ||
    !numericType(expression.type)
  ) {
    return inapplicable();
  }
  const rightValue =
    prepared.request.variantId === "multiply-one-right" ||
    prepared.request.variantId === "divide-one-right"
      ? 1n
      : prepared.request.variantId === "and-all-ones-right"
        ? allOnesForType(expression.type)
        : 0n;
  if (rightValue === undefined) return inapplicable();
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
  if (
    selection?.kind !== "constant" ||
    !constantsAreIndependent(
      prepared.sourceModule,
      selection.constantIndex,
      selection.constantIndex + 1,
    )
  ) {
    return inapplicable();
  }
  const constants = [...prepared.sourceModule.constants];
  const first = constants[selection.constantIndex];
  const second = constants[selection.constantIndex + 1];
  if (first === undefined || second === undefined) return inapplicable();
  const projection = prepared.request.sourceCase.projection;
  if (projection.kind === "invalid") {
    const transformPath =
      projection.transform.kind === "parameter-binding-replace"
        ? projection.transform.parameterPath
        : projection.transform.kind === "scalar-expression-replace"
          ? projection.transform.expressionPath
          : projection.transform.callPath;
    const selectedPrefix = `/constants/${selection.constantIndex}`;
    const adjacentPrefix = `/constants/${selection.constantIndex + 1}`;
    if (
      transformPath === selectedPrefix ||
      transformPath.startsWith(`${selectedPrefix}/`) ||
      transformPath === adjacentPrefix ||
      transformPath.startsWith(`${adjacentPrefix}/`)
    ) {
      return inapplicable();
    }
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

function semanticClosureFault(module: GenModule): GenModule {
  const name = freshRelationName("impure", declaredRelationNames(module));
  if (!isGenIdentifier(name)) return module;
  return freezeModule({
    ...module,
    constants: [
      ...module.constants,
      Object.freeze({
        kind: "const" as const,
        name,
        type: "byte" as const,
        value: Object.freeze({
          kind: "memory-read" as const,
          type: "byte" as const,
          width: 1 as const,
          address: Object.freeze({ kind: "literal" as const, type: "word" as const, value: 0n }),
        }),
      }),
    ],
  });
}

function nonPreservingFault(module: GenModule, entryFunction: string): GenModule {
  const functions = module.functions.map((fn) => {
    if (fn.name !== entryFunction) return freezeFunction(fn);
    let changed = false;
    const body: GenStatement[] = [];
    for (const statement of fn.body) {
      if (!changed && statement.kind === "return") {
        changed = true;
        if (statement.value === undefined) {
          body.push(
            Object.freeze({
              kind: "memory-write",
              width: 1,
              address: Object.freeze({ kind: "literal", type: "word", value: 0xffffn }),
              value: Object.freeze({ kind: "literal", type: "byte", value: 1n }),
            }),
          );
          body.push(Object.freeze({ ...statement }));
          continue;
        }
        const value: GenExpression =
          statement.value.type === "boolean"
            ? Object.freeze({
                kind: "unary",
                type: "boolean",
                operator: "!",
                operand: freezeExpression(statement.value),
              })
            : Object.freeze({
                kind: "binary",
                type: statement.value.type,
                operator: "^",
                left: freezeExpression(statement.value),
                right: Object.freeze({
                  kind: "literal",
                  type: statement.value.type,
                  value: 1n,
                }),
              });
        body.push(Object.freeze({ ...statement, value }));
        continue;
      }
      body.push(freezeFunction({ ...fn, body: [statement] }).body[0] ?? statement);
    }
    if (!changed && fn.returnType === "void") {
      changed = true;
      body.push(
        Object.freeze({
          kind: "memory-write",
          width: 1,
          address: Object.freeze({ kind: "literal", type: "word", value: 0xffffn }),
          value: Object.freeze({ kind: "literal", type: "byte", value: 1n }),
        }),
      );
    }
    return changed ? Object.freeze({ ...fn, body: Object.freeze(body) }) : freezeFunction(fn);
  });
  return freezeModule({ ...module, functions });
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
        : module;
  const meter = createOracleBudgetMeter(prepared.request.budget);
  const charged = meter.charge(
    "transformedNodes",
    moduleNodeCount(finalModule),
    "/transformedCase",
  );
  if (!charged.ok) return Object.freeze({ ok: false, diagnostics: charged.diagnostics });
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
  const preconditionPath = semanticRelationPreconditionPath(prepared.request.relationId);
  if (
    currentSemanticRelationFault(preconditionPath)?.faultId ===
    "relation.fault.force-precondition-false"
  ) {
    return inapplicable();
  }
  if (
    prepared.request.sourceCase.projection.kind === "invalid" &&
    prepared.request.relationId !== "relation.identifier-renaming" &&
    prepared.request.relationId !== "relation.independent-declaration-reordering"
  ) {
    return inapplicable();
  }
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
