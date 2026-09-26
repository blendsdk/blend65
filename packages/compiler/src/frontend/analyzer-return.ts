import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { isScalarType } from "./constants.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import { bindingIdentityKey, freezeSourceSpan } from "./semantic-types.js";
import type {
  ScalarExpressionContext,
  ScalarScope,
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
  functionSpan: SourceSpan,
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
    const origins = (value?.addressOrigins ?? []).map((origin) => {
      for (let scope: ScalarScope | null = context.scope; scope !== null; scope = scope.parent) {
        for (const state of scope.values.values()) {
          if (bindingIdentityKey(state.binding.id) === bindingIdentityKey(origin))
            return {
              name: state.binding.name,
              span: state.nameSpan,
            };
        }
      }
      return { name: "<unknown>", span: origin.span };
    });
    diagnostics.push(
      projectDiagnostic(
        "E10260",
        `Address derived from '${origins.map(({ name }) => name).join(", ")}' escapes its lifetime through return from '${functionName}' — the address may only be used while its origin is alive or passed to a proven non-retaining parameter; move persistent data to module scope or keep it caller-owned`,
        statement.value?.span ?? statement.span,
        null,
        origins.map((origin) => ({
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
        statement.value.span,
        null,
        [{ span: functionSpan, message: "Function declared here" }],
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
        { ...statement.span, end: statement.span.start + "return".length },
        null,
        [{ span: functionSpan, message: "Function declared here" }],
      ),
    );
  }
  return Object.freeze({ kind: "return", span: freezeSourceSpan(statement.span), value });
}
