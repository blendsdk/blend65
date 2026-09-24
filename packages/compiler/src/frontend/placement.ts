import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { PlacementConstraints, ScalarExpressionContext } from "./semantic-types.js";
import type { Expr, PlacementClause } from "./syntax.js";

/** Resolve a closed source placement modifier without assigning a machine address. */
export function resolvePlacement(
  clause: PlacementClause,
  context: ScalarExpressionContext,
  analyze: (expression: Expr, context: ScalarExpressionContext) => bigint | boolean | null,
  diagnose: (diagnostic: ProjectDiagnostic) => void,
): PlacementConstraints | null {
  const seen = new Set<string>();
  let valid = true;
  let at: number | null = null;
  let align = 1;
  let noCross: number | null = null;
  let region: string | null = null;
  for (const argument of clause.arguments) {
    if (seen.has(argument.key)) {
      diagnose(projectDiagnostic("E10272", `Duplicate place key '${argument.key}'`, argument.span));
      valid = false;
      continue;
    }
    seen.add(argument.key);
    if (argument.key === "region") {
      region = typeof argument.value === "string" ? argument.value : null;
      diagnose(
        projectDiagnostic(
          "E10272",
          `Region '${region ?? "<invalid>"}' is not exported by the selected resident profile`,
          argument.span,
        ),
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
      diagnose(
        projectDiagnostic(
          "E10272",
          `Place key '${argument.key}' requires ${argument.key === "at" ? "an address in 0..65535" : "a positive power-of-two window"}`,
          argument.span,
        ),
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
