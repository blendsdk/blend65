import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { PlacementConstraints, ScalarExpressionContext } from "./semantic-types.js";
import type { Expr, PlacementClause } from "./syntax.js";
import type { ScalarExpressionAnalyzer } from "./scalar-expressions.js";

/** Check an optional source placement using the already shared expression analyzer. */
export function checkedPlacement(
  clause: PlacementClause | null,
  context: ScalarExpressionContext,
  expressions: ScalarExpressionAnalyzer,
  diagnostics: ProjectDiagnostic[],
  owner: string,
): PlacementConstraints | null {
  const placement =
    clause === null
      ? null
      : resolvePlacement(
          clause,
          context,
          (expression, active) =>
            expressions.analyze(expression, null, active).node?.constant ?? null,
          (diagnostic) => diagnostics.push(diagnostic),
          owner,
        );
  if (placement?.at != null && placement.at % placement.align !== 0 && clause !== null) {
    diagnostics.push(
      projectDiagnostic(
        "E10273",
        `Cannot place '${owner}' — fixed-address constraints conflict with alignment ${placement.align}; change or remove the explicit constraint`,
        clause.span,
      ),
    );
    return null;
  }
  return placement;
}

/** Resolve a closed source placement modifier without assigning a machine address. */
export function resolvePlacement(
  clause: PlacementClause,
  context: ScalarExpressionContext,
  analyze: (expression: Expr, context: ScalarExpressionContext) => bigint | boolean | null,
  diagnose: (diagnostic: ProjectDiagnostic) => void,
  owner = "declaration",
): PlacementConstraints | null {
  const seen = new Map<string, SourceSpan>();
  let valid = true;
  let at: number | null = null;
  let align = 1;
  let noCross: number | null = null;
  let region: string | null = null;
  const invalid = (detail: string, span: SourceSpan, related: ProjectDiagnostic["related"] = []) =>
    diagnose(
      projectDiagnostic(
        "E10272",
        `Invalid place constraint on '${owner}' — ${detail}; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions`,
        span,
        null,
        related,
      ),
    );
  for (const argument of clause.arguments) {
    const keySpan = { ...argument.span, end: argument.span.start + argument.key.length };
    if (seen.has(argument.key)) {
      invalid(`duplicate key '${argument.key}'`, keySpan, [
        { span: seen.get(argument.key)!, message: "The first constraint is here" },
      ]);
      valid = false;
      continue;
    }
    seen.set(argument.key, keySpan);
    if (argument.key === "region") {
      region = typeof argument.value === "string" ? argument.value : null;
      invalid(
        `region '${region ?? "<invalid>"}' is not exported by the selected resident profile`,
        { ...argument.span, start: argument.span.end - (region?.length ?? 0) },
      );
      valid = false;
      continue;
    }
    const value =
      typeof argument.value === "string"
        ? null
        : analyze(argument.value, { ...context, constantContext: true });
    const withinAddress = typeof value === "bigint" && value >= 0n && value <= 65535n;
    const withinWindow = typeof value === "bigint" && value > 0n && value <= 65536n;
    const powerOfTwo = withinWindow && (value & (value - 1n)) === 0n;
    const admissible = argument.key === "at" ? withinAddress : powerOfTwo;
    if (!admissible) {
      invalid(
        `key '${argument.key}' requires ${argument.key === "at" ? "an address in 0..65535" : "a positive power-of-two window"}`,
        typeof argument.value === "string" ? argument.span : argument.value.span,
      );
      valid = false;
      continue;
    }
    if (typeof value !== "bigint") continue;
    if (argument.key === "at") at = Number(value);
    else if (argument.key === "align") align = Number(value);
    else noCross = Number(value);
  }
  return valid ? Object.freeze({ at, align, noCross, region }) : null;
}
