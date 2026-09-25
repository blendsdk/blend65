import { projectDiagnostic } from "../project/diagnostics.js";
import { createScalarTypedExpression, integerFacts, SCALAR_TYPES } from "./constants.js";
import { semanticTypeName } from "./aggregate-types.js";
import type {
  FunctionSignature,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";

/** Analyze one child using the host's ordinary expression recursion. */
type AnalyzeExpression = (
  expression: Expr,
  expected: SemanticType | null,
  context: ScalarExpressionContext,
) => ScalarExpressionResult;

const CPU_CONTROLS = new Set(["asm_sei", "asm_cli", "asm_php", "asm_plp", "asm_nop"]);

/** Convert a packed decimal value to an integer only after every nibble is valid. */
function decimalValue(value: bigint, digits: 2 | 4): bigint {
  let decimal = 0n;
  let place = 1n;
  for (let index = 0; index < digits; index += 1) {
    decimal += ((value >> BigInt(index * 4)) & 15n) * place;
    place *= 10n;
  }
  return decimal;
}

/** Pack an integer back into the selected two- or four-digit BCD width. */
function packedValue(value: bigint, digits: 2 | 4): bigint {
  let packed = 0n;
  for (let index = 0; index < digits; index += 1) {
    packed |= (value % 10n) << BigInt(index * 4);
    value /= 10n;
  }
  return packed;
}

/** Return whether any represented nibble is not a decimal digit. */
export function invalidPackedBcdDigit(value: bigint, digits: 2 | 4): boolean {
  for (let index = 0; index < digits; index += 1) {
    if (((value >> BigInt(index * 4)) & 15n) > 9n) return true;
  }
  return false;
}

/** Fold valid two- or four-digit packed decimal arithmetic with discarded final carry. */
export function foldPackedBcd(
  name: "bcd_add" | "bcd_sub",
  left: bigint,
  right: bigint,
  digits: 2 | 4,
): bigint {
  const modulo = digits === 2 ? 100n : 10000n;
  const lhs = decimalValue(left, digits);
  const rhs = decimalValue(right, digits);
  return packedValue((lhs + (name === "bcd_add" ? rhs : modulo - rhs)) % modulo, digits);
}

/** Check the closed CPU-control and packed-BCD built-in surface. */
export function analyzeMachineIntrinsic(
  expression: Extract<Expr, { readonly kind: "call" }>,
  name: string,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult | null {
  const control = CPU_CONTROLS.has(name);
  if (!control && name !== "bcd_add" && name !== "bcd_sub") return null;
  const count = control ? 0 : 2;
  let valid = expression.arguments.length === count;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects ${count} parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  if (control && context.cpuStatementExpression !== expression) {
    host.diagnose(
      projectDiagnostic(
        "SEMANTIC_ERROR",
        `CPU control '${name}()' must be a statement`,
        expression.span,
      ),
    );
    valid = false;
  }
  const arguments_: TypedExpr[] = [];
  for (const argument of expression.arguments) {
    const checked = analyze(argument, null, context);
    if (checked.node === null) valid = false;
    else arguments_.push(checked.node);
  }
  let type: SemanticType = SCALAR_TYPES.void;
  let constant: bigint | null = null;
  if (!control && arguments_.length === 2) {
    const left = arguments_[0]!;
    const right = arguments_[1]!;
    if (
      left.type.kind !== "scalar" ||
      (left.type.name !== "byte" && left.type.name !== "word") ||
      right.type.kind !== "scalar" ||
      right.type.name !== left.type.name
    ) {
      host.diagnose(
        projectDiagnostic(
          "E10172",
          `Arguments of '${name}()' must have the same unsigned byte or word type; found '${semanticTypeName(left.type)}' and '${semanticTypeName(right.type)}'`,
          expression.span,
        ),
      );
      valid = false;
    } else {
      type = left.type;
      const digits: 2 | 4 = left.type.name === "byte" ? 2 : 4;
      for (const operand of [left, right]) {
        if (
          typeof operand.constant === "bigint" &&
          invalidPackedBcdDigit(operand.constant, digits)
        ) {
          host.diagnose(
            projectDiagnostic(
              "E10254",
              "Packed BCD operand contains a non-decimal digit",
              operand.span,
            ),
          );
          valid = false;
        }
      }
      if (valid && typeof left.constant === "bigint" && typeof right.constant === "bigint") {
        constant = foldPackedBcd(
          name === "bcd_add" ? "bcd_add" : "bcd_sub",
          left.constant,
          right.constant,
          digits,
        );
      }
    }
  }
  if (!valid) return { node: null, exact: null };
  const signature: FunctionSignature = Object.freeze({
    parameters: Object.freeze(
      arguments_.map((argument) => Object.freeze({ type: argument.type, readonly: false })),
    ),
    returnType: type,
  });
  return {
    node: createScalarTypedExpression(expression, type, constant, {
      callee: createScalarTypedExpression(expression.callee, type, null, { name }),
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      integer: integerFacts(type, true),
    }),
    exact: constant,
  };
}
