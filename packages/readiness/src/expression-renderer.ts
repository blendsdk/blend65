import type { BinaryOperator, GenExpression } from "./generator-ir.js";
import type { LiteralSpellingClass } from "./roundtrip-model.js";

/** Associativity used by the renderer-owned expression policy. */
export type RendererAssociativity = "left" | "right";

/** One renderer-owned infix decision. */
export interface RendererBinaryRule {
  /** Binding power; larger values bind more tightly. */
  readonly bindingPower: number;
  /** Tree grouping used when child and parent powers are equal. */
  readonly associativity: RendererAssociativity;
}

/** Complete renderer policy, deliberately separate from inverse parsing policy. */
export interface RendererExpressionPolicy {
  /** Rule for every binary operator in the independent IR. */
  readonly binaryRules: Readonly<Record<BinaryOperator, RendererBinaryRule>>;
  /** Optional expression path whose otherwise-required parentheses are omitted in tests. */
  readonly omitRequiredParenthesesPath?: string;
}

/** Context needed to render one expression without ambient state. */
export interface ExpressionRenderContext {
  /** Literal spelling selected by canonical expression path. */
  readonly literalSpellings: ReadonlyMap<string, LiteralSpellingClass>;
  /** Renderer-owned precedence and grouping policy. */
  readonly policy: RendererExpressionPolicy;
}

const BINARY_RULES: Readonly<Record<BinaryOperator, RendererBinaryRule>> = Object.freeze({
  "*": Object.freeze({ bindingPower: 11, associativity: "left" }),
  "/": Object.freeze({ bindingPower: 11, associativity: "left" }),
  "%": Object.freeze({ bindingPower: 11, associativity: "left" }),
  "+": Object.freeze({ bindingPower: 10, associativity: "left" }),
  "-": Object.freeze({ bindingPower: 10, associativity: "left" }),
  "<<": Object.freeze({ bindingPower: 9, associativity: "left" }),
  ">>": Object.freeze({ bindingPower: 9, associativity: "left" }),
  "<": Object.freeze({ bindingPower: 8, associativity: "left" }),
  "<=": Object.freeze({ bindingPower: 8, associativity: "left" }),
  ">": Object.freeze({ bindingPower: 8, associativity: "left" }),
  ">=": Object.freeze({ bindingPower: 8, associativity: "left" }),
  "==": Object.freeze({ bindingPower: 7, associativity: "left" }),
  "!=": Object.freeze({ bindingPower: 7, associativity: "left" }),
  "&": Object.freeze({ bindingPower: 6, associativity: "left" }),
  "^": Object.freeze({ bindingPower: 5, associativity: "left" }),
  "|": Object.freeze({ bindingPower: 4, associativity: "left" }),
});

/** Default expression policy used by production rendering. */
export const DEFAULT_RENDERER_EXPRESSION_POLICY: RendererExpressionPolicy = Object.freeze({
  binaryRules: BINARY_RULES,
});

interface RenderedExpression {
  readonly text: string;
  readonly bindingPower: number;
}

function renderMagnitude(value: bigint, spelling: LiteralSpellingClass): string {
  const magnitude = value < 0n ? -value : value;
  if (spelling === "hex-dollar") {
    return `$${magnitude.toString(16).toUpperCase()}`;
  }
  if (spelling === "hex-prefix") {
    return `0x${magnitude.toString(16).toUpperCase()}`;
  }
  if (spelling === "binary-prefix") {
    return `0b${magnitude.toString(2)}`;
  }
  return magnitude.toString(10);
}

function maybeParenthesize(
  rendered: RenderedExpression,
  required: boolean,
  path: string,
  policy: RendererExpressionPolicy,
): string {
  if (!required || policy.omitRequiredParenthesesPath === path) {
    return rendered.text;
  }
  return `(${rendered.text})`;
}

function renderNode(
  expression: GenExpression,
  path: string,
  context: ExpressionRenderContext,
): RenderedExpression {
  if (expression.kind === "literal") {
    if (expression.type === "boolean") {
      return { text: expression.value === 0n ? "false" : "true", bindingPower: 14 };
    }
    const spelling = context.literalSpellings.get(path) ?? "decimal";
    const magnitude = renderMagnitude(expression.value, spelling);
    return {
      text: expression.value < 0n ? `-${magnitude}` : magnitude,
      bindingPower: expression.value < 0n ? 13 : 14,
    };
  }
  if (expression.kind === "name") {
    return { text: expression.name, bindingPower: 14 };
  }
  if (expression.kind === "memory-read") {
    const address = renderNode(expression.address, `${path}/address`, context);
    const intrinsic = expression.width === 1 ? "peek" : "peekw";
    return { text: `${intrinsic}(${address.text})`, bindingPower: 14 };
  }
  if (expression.kind === "unary") {
    const operandPath = `${path}/operand`;
    const operand = renderNode(expression.operand, operandPath, context);
    return {
      text: `${expression.operator}${maybeParenthesize(
        operand,
        operand.bindingPower < 13 || expression.operand.kind === "literal",
        operandPath,
        context.policy,
      )}`,
      bindingPower: 13,
    };
  }

  const rule = context.policy.binaryRules[expression.operator];
  const leftPath = `${path}/left`;
  const rightPath = `${path}/right`;
  const left = renderNode(expression.left, leftPath, context);
  const right = renderNode(expression.right, rightPath, context);
  const leftNeedsGrouping =
    left.bindingPower < rule.bindingPower ||
    (left.bindingPower === rule.bindingPower && rule.associativity === "right");
  const rightNeedsGrouping =
    right.bindingPower < rule.bindingPower ||
    (right.bindingPower === rule.bindingPower && rule.associativity === "left");
  return {
    text: `${maybeParenthesize(left, leftNeedsGrouping, leftPath, context.policy)} ${
      expression.operator
    } ${maybeParenthesize(right, rightNeedsGrouping, rightPath, context.policy)}`,
    bindingPower: rule.bindingPower,
  };
}

/**
 * Renders one already validated expression with deterministic grouping.
 *
 * @param expression Independent generator expression.
 * @param expressionPath Canonical path used for spelling and mutation selection.
 * @param context Closed renderer policy and spelling selections.
 * @returns Canonical expression source.
 */
export function renderExpression(
  expression: GenExpression,
  expressionPath: string,
  context: ExpressionRenderContext,
): string {
  return renderNode(expression, expressionPath, context).text;
}

/**
 * Creates a fully closed policy with one binary rule replaced.
 *
 * @param operator Operator whose rule changes.
 * @param replacement Complete replacement rule.
 * @returns Immutable renderer policy.
 */
export function replaceRendererBinaryRule(
  operator: BinaryOperator,
  replacement: RendererBinaryRule,
): RendererExpressionPolicy {
  return Object.freeze({
    binaryRules: Object.freeze({
      ...BINARY_RULES,
      [operator]: Object.freeze({ ...replacement }),
    }),
  });
}

/**
 * Reads one immutable default renderer rule for conformance mutation.
 *
 * @param operator Binary operator.
 * @returns Default renderer-owned rule.
 */
export function defaultRendererBinaryRule(operator: BinaryOperator): RendererBinaryRule {
  return BINARY_RULES[operator];
}

/**
 * Creates a policy that omits one otherwise-required parenthesis pair.
 *
 * @param expressionPath Canonical child expression path.
 * @returns Immutable renderer policy used only by conformance tests.
 */
export function omitRendererParenthesesAt(expressionPath: string): RendererExpressionPolicy {
  return Object.freeze({
    binaryRules: BINARY_RULES,
    omitRequiredParenthesesPath: expressionPath,
  });
}
