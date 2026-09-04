import { isGenIdentifier } from "./generator-ir.js";
import type {
  GenExpression,
  GenFunction,
  GenModule,
  GenStatement,
  GenStructuredExpression,
  GenStructuredStatement,
  ScalarType,
} from "./generator-ir.js";

/** Parsed declaration selected by one canonical relation pointer. */
export type RelationDeclarationSelection =
  | { readonly kind: "constant"; readonly constantIndex: number }
  | { readonly kind: "function"; readonly functionIndex: number }
  | { readonly kind: "parameter"; readonly functionIndex: number; readonly parameterIndex: number }
  | { readonly kind: "local"; readonly functionIndex: number; readonly statementIndex: number };

/** Parsed expression selected from a constant or function statement. */
export type RelationExpressionSelection =
  | {
      /** Constant-selection discriminator. */
      readonly kind: "constant";
      /** Constant containing the expression. */
      readonly constantIndex: number;
      /** Ordered child fields below the initializer expression. */
      readonly expressionPath: readonly ("left" | "right" | "operand" | "address")[];
    }
  | {
      /** Statement-selection discriminator. */
      readonly kind: "statement";
      /** Function containing the expression. */
      readonly functionIndex: number;
      /** Statement containing the expression. */
      readonly statementIndex: number;
      /** Expression-bearing statement field. */
      readonly field: "initializer" | "value" | "address";
      /** Ordered child fields below the statement's root expression. */
      readonly expressionPath: readonly ("left" | "right" | "operand" | "address")[];
    };

function canonicalIndex(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|[1-9][0-9]*)$/u.test(value)) return undefined;
  const index = Number(value);
  return Number.isSafeInteger(index) && String(index) === value ? index : undefined;
}

/**
 * Resolves a declaration pointer against the immutable module.
 *
 * @param module Validated source module.
 * @param path Canonical declaration pointer.
 * @returns Exact declaration selection, or `undefined` when the pointer misses.
 */
export function resolveDeclarationSelection(
  module: GenModule,
  path: string,
): RelationDeclarationSelection | undefined {
  const segments = path.split("/");
  if (segments[0] !== "") return undefined;
  if (segments.length === 3 && segments[1] === "constants") {
    const constantIndex = canonicalIndex(segments[2]);
    return constantIndex !== undefined && module.constants[constantIndex] !== undefined
      ? Object.freeze({ kind: "constant", constantIndex })
      : undefined;
  }
  if (segments[1] !== "functions") return undefined;
  const functionIndex = canonicalIndex(segments[2]);
  if (functionIndex === undefined) return undefined;
  const fn = module.functions[functionIndex];
  if (fn === undefined) return undefined;
  if (segments.length === 3) {
    return Object.freeze({ kind: "function", functionIndex });
  }
  if (segments.length === 5 && segments[3] === "parameters") {
    const parameterIndex = canonicalIndex(segments[4]);
    return parameterIndex !== undefined && fn.parameters[parameterIndex] !== undefined
      ? Object.freeze({ kind: "parameter", functionIndex, parameterIndex })
      : undefined;
  }
  if (segments.length === 5 && segments[3] === "body") {
    const statementIndex = canonicalIndex(segments[4]);
    if (statementIndex === undefined) return undefined;
    const statement = fn.body[statementIndex];
    return statement?.kind === "local"
      ? Object.freeze({ kind: "local", functionIndex, statementIndex })
      : undefined;
  }
  return undefined;
}

/**
 * Resolves an initializer/value pointer against one executable statement.
 *
 * @param module Validated source module.
 * @param path Canonical expression pointer.
 * @returns Exact expression selection, or `undefined` when the pointer misses.
 */
export function resolveExpressionSelection(
  module: GenModule,
  path: string,
): RelationExpressionSelection | undefined {
  const segments = path.split("/");
  let expression: GenExpression | undefined;
  let constantIndex: number | undefined;
  if (
    segments.length >= 4 &&
    segments[0] === "" &&
    segments[1] === "constants" &&
    segments[3] === "value"
  ) {
    constantIndex = canonicalIndex(segments[2]);
    expression = constantIndex === undefined ? undefined : module.constants[constantIndex]?.value;
  }
  if (constantIndex !== undefined && expression !== undefined) {
    const childPath = resolveExpressionChildPath(expression, segments.slice(4));
    return childPath === undefined
      ? undefined
      : Object.freeze({
          kind: "constant",
          constantIndex,
          expressionPath: Object.freeze(childPath),
        });
  }
  if (
    segments.length < 6 ||
    segments[0] !== "" ||
    segments[1] !== "functions" ||
    segments[3] !== "body" ||
    (segments[5] !== "initializer" && segments[5] !== "value" && segments[5] !== "address")
  ) {
    return undefined;
  }
  const functionIndex = canonicalIndex(segments[2]);
  const statementIndex = canonicalIndex(segments[4]);
  if (functionIndex === undefined || statementIndex === undefined) return undefined;
  const statement = module.functions[functionIndex]?.body[statementIndex];
  if (statement === undefined) return undefined;
  const field = segments[5];
  expression = undefined;
  if (field === "initializer" && statement.kind === "local") expression = statement.initializer;
  else if (
    field === "value" &&
    (statement.kind === "assign" || statement.kind === "memory-write")
  ) {
    expression = statement.value;
  } else if (field === "value" && statement.kind === "return") {
    expression = statement.value;
  } else if (field === "address" && statement.kind === "memory-write") {
    expression = statement.address;
  }
  if (expression === undefined) return undefined;
  const childPath = resolveExpressionChildPath(expression, segments.slice(6));
  return childPath === undefined
    ? undefined
    : Object.freeze({
        kind: "statement",
        functionIndex,
        statementIndex,
        field,
        expressionPath: Object.freeze(childPath),
      });
}

function resolveExpressionChildPath(
  root: GenExpression,
  segments: readonly string[],
): ("left" | "right" | "operand" | "address")[] | undefined {
  let expression = root;
  const childPath: ("left" | "right" | "operand" | "address")[] = [];
  for (const child of segments) {
    if (child === "operand" && expression.kind === "unary") expression = expression.operand;
    else if (child === "left" && expression.kind === "binary") expression = expression.left;
    else if (child === "right" && expression.kind === "binary") expression = expression.right;
    else if (child === "address" && expression.kind === "memory-read") {
      expression = expression.address;
    } else {
      return undefined;
    }
    childPath.push(child);
  }
  return childPath;
}

/** Returns the expression named by a previously resolved selection. */
export function selectedExpression(
  module: GenModule,
  selection: RelationExpressionSelection,
): GenExpression | undefined {
  if (selection.kind === "constant") {
    const expression = module.constants[selection.constantIndex]?.value;
    return descendSelectedExpression(expression, selection.expressionPath);
  }
  const statement = module.functions[selection.functionIndex]?.body[selection.statementIndex];
  let expression: GenExpression | undefined;
  if (selection.field === "initializer" && statement?.kind === "local") {
    expression = statement.initializer;
  } else if (
    selection.field === "value" &&
    (statement?.kind === "assign" || statement?.kind === "memory-write")
  ) {
    expression = statement.value;
  } else if (selection.field === "value" && statement?.kind === "return") {
    expression = statement.value;
  } else if (selection.field === "address" && statement?.kind === "memory-write") {
    expression = statement.address;
  }
  return descendSelectedExpression(expression, selection.expressionPath);
}

function descendSelectedExpression(
  root: GenExpression | undefined,
  expressionPath: readonly ("left" | "right" | "operand" | "address")[],
): GenExpression | undefined {
  let expression = root;
  for (const child of expressionPath) {
    if (child === "operand" && expression?.kind === "unary") expression = expression.operand;
    else if (child === "left" && expression?.kind === "binary") expression = expression.left;
    else if (child === "right" && expression?.kind === "binary") expression = expression.right;
    else if (child === "address" && expression?.kind === "memory-read") {
      expression = expression.address;
    } else {
      return undefined;
    }
  }
  return expression;
}

/** Reports whether an expression is closed and side-effect-free. */
export function isPureRelationExpression(expression: GenExpression): boolean {
  switch (expression.kind) {
    case "literal":
    case "name":
      return true;
    case "unary":
      return isPureRelationExpression(expression.operand);
    case "binary":
      return (
        isPureRelationExpression(expression.left) && isPureRelationExpression(expression.right)
      );
    case "memory-read":
      return false;
  }
}

/** Collects every lexical name referenced by an expression. */
export function relationExpressionNames(expression: GenExpression): ReadonlySet<string> {
  const names = new Set<string>();
  const stack: GenExpression[] = [expression];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    if (current.kind === "name") names.add(current.name);
    else if (current.kind === "unary") stack.push(current.operand);
    else if (current.kind === "binary") stack.push(current.right, current.left);
    else if (current.kind === "memory-read") stack.push(current.address);
  }
  return names;
}

function statementExpressions(statement: GenStatement): readonly GenExpression[] {
  switch (statement.kind) {
    case "local":
      return [statement.initializer];
    case "assign":
      return [statement.value];
    case "memory-write":
      return [statement.address, statement.value];
    case "return":
      return statement.value === undefined ? [] : [statement.value];
  }
}

/** Returns every declaration name in the module's intersecting lexical scopes. */
export function declaredRelationNames(module: GenModule): ReadonlySet<string> {
  const names = new Set<string>();
  for (const constant of module.constants) names.add(constant.name);
  for (const fn of module.functions) {
    names.add(fn.name);
    for (const parameter of fn.parameters) names.add(parameter.name);
    for (const statement of fn.body) {
      if (statement.kind === "local") names.add(statement.name);
    }
  }
  return names;
}

/**
 * Derives a deterministic valid identifier absent from all intersecting scopes.
 *
 * @param base Existing declaration name.
 * @param occupied All names unavailable to the rewrite.
 * @returns Capture-free sibling identifier.
 */
export function freshRelationName(base: string, occupied: ReadonlySet<string>): string | undefined {
  for (let ordinal = 1; ordinal <= 1_000; ordinal += 1) {
    const suffix = `_relation${ordinal}`;
    const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
    if (isGenIdentifier(candidate) && !occupied.has(candidate)) return candidate;
  }
  return undefined;
}

/** Reports whether a local is assigned after its declaration. */
export function localIsReassigned(fn: GenFunction, name: string, statementIndex: number): boolean {
  return fn.body
    .slice(statementIndex + 1)
    .some((statement) => statement.kind === "assign" && statement.target === name);
}

/**
 * Checks whether a local initializer references only constants and existing parameters.
 *
 * @param module Source module containing the entry function.
 * @param fn Entry function.
 * @param expression Candidate initializer.
 * @returns Whether every lexical dependency is permitted.
 */
export function localInitializerDependenciesAreLiftable(
  module: GenModule,
  fn: GenFunction,
  expression: GenExpression,
): boolean {
  const allowed = new Set<string>([
    ...module.constants.map((constant) => constant.name),
    ...fn.parameters.map((parameter) => parameter.name),
  ]);
  return [...relationExpressionNames(expression)].every((name) => allowed.has(name));
}

/** Reports whether two adjacent constants have no dependency path in either direction. */
export function constantsAreIndependent(
  module: GenModule,
  firstIndex: number,
  secondIndex: number,
): boolean {
  const first = module.constants[firstIndex];
  const second = module.constants[secondIndex];
  if (
    first === undefined ||
    second === undefined ||
    !isPureRelationExpression(first.value) ||
    !isPureRelationExpression(second.value)
  ) {
    return false;
  }
  const constantNames = new Set<string>(module.constants.map((constant) => constant.name));
  const dependencies = new Map<string, Set<string>>(
    module.constants.map((constant) => [
      constant.name,
      new Set<string>(
        [...relationExpressionNames(constant.value)].filter((name) => constantNames.has(name)),
      ),
    ]),
  );
  function reaches(start: string, target: string): boolean {
    const pending = [start];
    const seen = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop();
      if (current === undefined || seen.has(current)) continue;
      seen.add(current);
      for (const dependency of dependencies.get(current) ?? []) {
        if (dependency === target) return true;
        pending.push(dependency);
      }
    }
    return false;
  }
  return !reaches(first.name, second.name) && !reaches(second.name, first.name);
}

/** Returns whether any expression in a function references a selected name. */
export function functionReferencesName(fn: GenFunction, name: string): boolean {
  return fn.body.some((statement) =>
    statementExpressions(statement).some((expression) =>
      relationExpressionNames(expression).has(name),
    ),
  );
}

/** Returns the all-ones identity literal for one numeric scalar type. */
export function allOnesForType(type: ScalarType): bigint | undefined {
  switch (type) {
    case "byte":
      return 255n;
    case "sbyte":
      return -1n;
    case "word":
      return 65_535n;
    case "sword":
      return -1n;
    case "boolean":
      return undefined;
  }
}

function structuredExpressionIsVolatile(expression: GenStructuredExpression): boolean {
  switch (expression.kind) {
    case "memory-read":
      return true;
    case "unary":
      return structuredExpressionIsVolatile(expression.operand);
    case "binary":
      return (
        structuredExpressionIsVolatile(expression.left) ||
        structuredExpressionIsVolatile(expression.right)
      );
    case "index":
      return structuredExpressionIsVolatile(expression.index);
    case "call":
      return expression.arguments.some(
        (argument) =>
          argument.kind !== "array-reference" && structuredExpressionIsVolatile(argument),
      );
    case "literal":
    case "name":
      return false;
  }
}

/** Reports whether a structured statement tree contains an ordered volatile access. */
export function structuredStatementsHaveVolatileEffects(
  statements: readonly GenStructuredStatement[],
): boolean {
  return statements.some((statement) => {
    switch (statement.kind) {
      case "memory-write":
        return true;
      case "local":
        return structuredExpressionIsVolatile(statement.initializer);
      case "array":
        return statement.initializer.some(structuredExpressionIsVolatile);
      case "assign":
        return (
          structuredExpressionIsVolatile(statement.value) ||
          (typeof statement.target !== "string" &&
            structuredExpressionIsVolatile(statement.target.index))
        );
      case "return":
        return statement.value !== undefined && structuredExpressionIsVolatile(statement.value);
      case "call-statement":
        return statement.arguments.some(
          (argument) =>
            argument.kind !== "array-reference" && structuredExpressionIsVolatile(argument),
        );
      case "if":
        return (
          structuredExpressionIsVolatile(statement.condition) ||
          structuredStatementsHaveVolatileEffects(statement.thenBody) ||
          structuredStatementsHaveVolatileEffects(statement.elseBody)
        );
      case "while":
      case "do-while":
        return (
          structuredExpressionIsVolatile(statement.condition) ||
          structuredStatementsHaveVolatileEffects(statement.body)
        );
      case "for":
        return (
          structuredExpressionIsVolatile(statement.start) ||
          structuredExpressionIsVolatile(statement.end) ||
          structuredStatementsHaveVolatileEffects(statement.body)
        );
    }
  });
}
