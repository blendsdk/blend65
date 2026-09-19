import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { scalarWarning } from "./constants.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { Place, ScalarValueState, SemanticType, TypedExpr } from "./semantic-types.js";
import type { Expr, VariableDeclaration } from "./syntax.js";

/** Return whether an aggregate uses the direct literal form handled by this slice. */
export function isDirectAggregateLiteral(type: SemanticType, initializer: Expr): boolean {
  return (
    (type.kind === "array" && initializer.kind === "array-literal") ||
    (type.kind === "struct" && initializer.kind === "struct-literal")
  );
}

/** Append declaration diagnostics which depend on fixed-array coverage. */
export function diagnoseArrayInitialization(
  declaration: VariableDeclaration,
  type: SemanticType,
  initializer: TypedExpr | null,
  diagnose: (diagnostic: ProjectDiagnostic) => void,
): void {
  if (type.kind !== "array" || type.length === 0) return;
  if (initializer === null) {
    if (declaration.initializer === null && declaration.declarationKind === "let") {
      diagnose(
        scalarWarning(
          "W10141",
          `Mutable array '${declaration.name}' has no initializer`,
          declaration.nameSpan,
        ),
      );
    }
    return;
  }
  const ranges = initializer.initialized ?? [];
  const complete = ranges.some(({ start, end }) => start === 0 && end >= type.length);
  if (complete) return;
  diagnose(
    declaration.declarationKind === "const"
      ? projectDiagnostic(
          "E10113",
          `Const array '${declaration.name}' must initialize every element`,
          declaration.span,
        )
      : scalarWarning(
          "W10140",
          `Mutable array '${declaration.name}' is only partially initialized`,
          declaration.span,
        ),
  );
}

/** Update definite-initialization facts from one accepted initializer or assignment value. */
export function updateInitializedState(state: ScalarValueState, value: TypedExpr | null): void {
  if (value === null) {
    state.initialized = state.binding.type?.kind === "array" && state.binding.type.length === 0;
    state.initializedRanges = Object.freeze([]);
    state.initializedPaths = Object.freeze([]);
    return;
  }
  if (state.binding.type?.kind !== "array") {
    state.initialized = true;
    state.initializedRanges = Object.freeze([]);
    state.initializedPaths = Object.freeze([]);
    return;
  }
  const arrayType = state.binding.type;
  const ranges =
    value.kind === "array-literal"
      ? (value.initialized ?? Object.freeze([]))
      : Object.freeze([{ start: 0, end: arrayType.length }]);
  state.initializedRanges = ranges;
  state.initialized =
    arrayType.length === 0 ||
    ranges.some(({ start, end }) => start === 0 && end >= arrayType.length);
  state.initializedPaths = Object.freeze([]);
}

/** Render an exact scalar sub-place key when every array index is compile-time known. */
export function initializedPlaceKey(place: Place): string | null {
  const parts: string[] = [];
  for (const component of place.path) {
    if (typeof component === "string") parts.push(`.${component}`);
    else if (typeof component.constant === "bigint") parts.push(`[${component.constant}]`);
    else return null;
  }
  return parts.length === 0 ? null : parts.join("");
}

/** Return a warning when a function-local read is not definitely initialized on every path. */
export function uninitializedReadDiagnostic(
  place: Place,
  span: SourceSpan,
  states: ReadonlyMap<string, ScalarValueState>,
): ProjectDiagnostic | null {
  const state = states.get(bindingIdentityKey(place.binding));
  if (state === undefined || state.binding.storage !== "local" || state.initialized) return null;
  const key = initializedPlaceKey(place);
  if (key !== null && state.initializedPaths.includes(key)) return null;
  if (state.binding.type?.kind === "array" && place.path.length > 0) {
    const index = place.path[0];
    const constant = typeof index === "string" ? null : index.constant;
    if (
      typeof constant === "bigint" &&
      state.initializedRanges.some(
        ({ start, end }) => constant >= BigInt(start) && constant < BigInt(end),
      )
    ) {
      return null;
    }
  }
  return scalarWarning(
    "W10190",
    `Local '${state.binding.name}' may be read before it is initialized`,
    span,
  );
}
