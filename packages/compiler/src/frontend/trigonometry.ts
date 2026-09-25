import { projectDiagnostic } from "../project/diagnostics.js";
import { createScalarTypedExpression, SCALAR_TYPES } from "./constants.js";
import type {
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** The four reserved intrinsics share one phase-to-integer definition. */
export type TrigonometryIntrinsic = "sin8" | "cos8" | "sin16" | "cos16";

/** Recognize an intrinsic without treating its reserved name as a user binding. */
export function isTrigonometryIntrinsic(name: string): name is TrigonometryIntrinsic {
  return name === "sin8" || name === "cos8" || name === "sin16" || name === "cos16";
}

// Fixed decimal arithmetic makes the result independent of the host's floating-point library.
// The precision is far beyond the half-integer decision boundary for either allowed width.
const SCALE = 10n ** 100n;
const PI_SCALED =
  31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679n;

/** Evaluate the positive first-quadrant sine with a fixed-point Taylor series. */
function firstQuadrantSine(phase: number, turns: number): bigint {
  if (phase === 0) return 0n;
  const angle = (2n * PI_SCALED * BigInt(phase)) / BigInt(turns);
  const angleSquared = (angle * angle) / SCALE;
  let term = angle;
  let sum = term;
  for (let index = 1n; index < 80n; index += 1n) {
    term = (-term * angleSquared) / (2n * index * (2n * index + 1n) * SCALE);
    if (term === 0n) break;
    sum += term;
  }
  return sum;
}

/** Produce the specified signed integer using exact phase symmetry and half-away rounding. */
export function evaluateIntegerTrigonometry(
  intrinsic: TrigonometryIntrinsic,
  argument: bigint,
): bigint {
  const turns = intrinsic.endsWith("8") ? 256 : 65536;
  const amplitude = BigInt(turns / 2 - 1);
  const shifted = intrinsic.startsWith("cos") ? Number(argument) + turns / 4 : Number(argument);
  const phase = ((shifted % turns) + turns) % turns;
  const positive = phase < turns / 2;
  const halfPhase = phase % (turns / 2);
  const firstQuadrant = Math.min(halfPhase, turns / 2 - halfPhase);
  const scaled = firstQuadrantSine(firstQuadrant, turns) * amplitude;
  const rounded = (scaled + SCALE / 2n) / SCALE;
  return positive ? rounded : -rounded;
}

/** Check a reserved call using its exact byte/word signature and fold a known phase. */
export function analyzeTrigonometryCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: (
    expression: Expr,
    expected: SemanticType,
    context: ScalarExpressionContext,
  ) => ScalarExpressionResult,
): ScalarExpressionResult | null {
  if (expression.callee.kind !== "name" || !isTrigonometryIntrinsic(expression.callee.name)) {
    return null;
  }
  const name = expression.callee.name;
  const parameterType = name.endsWith("8") ? SCALAR_TYPES.byte : SCALAR_TYPES.word;
  const returnType = name.endsWith("8") ? SCALAR_TYPES.sbyte : SCALAR_TYPES.sword;
  if (expression.arguments.length !== 1) {
    host.diagnose(
      projectDiagnostic("E10171", `'${name}()' expects one phase argument`, expression.span),
    );
    return { node: null, exact: null };
  }
  const argument = analyze(expression.arguments[0]!, parameterType, {
    ...context,
    ordinalContext: false,
  });
  if (argument.node === null) return { node: null, exact: null };
  if (argument.node.type.kind !== "scalar" || argument.node.type.name !== parameterType.name) {
    host.diagnose(
      projectDiagnostic(
        "E10080",
        `'${name}()' requires a ${parameterType.name} phase`,
        expression.arguments[0]!.span,
      ),
    );
    return { node: null, exact: null };
  }
  const insideComptime =
    context.caller !== null && host.functionMode?.(context.caller) === "comptime";
  if (!insideComptime && typeof argument.exact !== "bigint") {
    host.diagnose(
      projectDiagnostic("E10191", `'${name}()' requires a compile-time phase`, expression.span),
    );
    return { node: null, exact: null };
  }
  const constant =
    typeof argument.exact === "bigint" ? evaluateIntegerTrigonometry(name, argument.exact) : null;
  const signature = Object.freeze({
    kind: "function" as const,
    parameters: Object.freeze([Object.freeze({ type: parameterType, readonly: false })]),
    returnType,
  });
  const callee = createScalarTypedExpression(expression.callee, signature, null, { name });
  return {
    node: createScalarTypedExpression(expression, returnType, constant, {
      callee,
      arguments: Object.freeze([argument.node]),
      evaluation: "left-to-right",
    }),
    exact: constant,
  };
}
