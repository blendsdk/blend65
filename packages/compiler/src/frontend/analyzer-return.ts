import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { isScalarType } from "./constants.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import { freezeSourceSpan } from "./semantic-types.js";
import type {
  ScalarExpressionContext,
  SemanticType,
  TypedExitStatement,
} from "./semantic-types.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";
import type { Statement } from "./syntax.js";

/** Check a return value and its borrowed-address lifetime at the source exit. */
export function analyzeReturnStatement(
  statement: Extract<Statement, { readonly kind: "return" }>,
  returnType: SemanticType,
  functionName: string,
  context: ScalarExpressionContext,
  expressions: ScalarExpressionAnalyzer,
  diagnostics: ProjectDiagnostic[],
): TypedExitStatement {
  const value =
    statement.value === null
      ? null
      : expressions.analyze(
          statement.value,
          isScalarType(returnType) && returnType.name === "void" ? null : returnType,
          context,
        ).node;
  if ((value?.addressOrigins?.length ?? 0) > 0) {
    diagnostics.push(
      projectDiagnostic(
        "E10260",
        "A local address or derived fragment cannot be returned beyond its owner's lifetime",
        statement.value?.span ?? statement.span,
        null,
        (value?.addressOrigins ?? []).map((origin) => ({
          span: origin.span,
          message: "Borrowed local address originates here",
        })),
      ),
    );
  }
  if (isScalarType(returnType) && returnType.name === "void" && statement.value !== null) {
    diagnostics.push(
      projectDiagnostic(
        "E10173",
        `Cannot return a value from void function '${functionName}'`,
        statement.span,
      ),
    );
  } else if (
    (!isScalarType(returnType) || returnType.name !== "void") &&
    statement.value === null
  ) {
    diagnostics.push(
      projectDiagnostic(
        "E10174",
        `Missing return value — function '${functionName}' returns '${semanticTypeName(returnType)}' but this 'return' has no expression`,
        statement.span,
      ),
    );
  }
  return Object.freeze({ kind: "return", span: freezeSourceSpan(statement.span), value });
}
