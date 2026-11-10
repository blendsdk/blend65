import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { LoadUnitRecord } from "../frontend/load-units.js";
import type { SemanticGlobal, SemanticFunction } from "./operations.js";

/** Physical requirements inherited from one load unit's native handler. */
interface DestinationRequirement {
  align: number;
  noCross: number | null;
  vicVisible: boolean;
}

/** Parse the JSON-encoded handler constraints retained on a load unit. */
function requirementOf(unit: LoadUnitRecord): DestinationRequirement {
  const requirement: DestinationRequirement = { align: 1, noCross: null, vicVisible: false };
  for (const raw of unit.destinationConstraints) {
    let constraint: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      constraint = parsed as Record<string, unknown>;
    } catch {
      continue;
    }
    if (constraint.kind === "align" && typeof constraint.bytes === "number") {
      requirement.align = Math.max(requirement.align, constraint.bytes);
    }
    if (constraint.kind === "noCross" && typeof constraint.boundaryBytes === "number") {
      requirement.noCross =
        requirement.noCross === null
          ? constraint.boundaryBytes
          : Math.min(requirement.noCross, constraint.boundaryBytes);
    }
    if (constraint.kind === "visibility" && constraint.consumer === "vic") {
      requirement.vicVisible = true;
    }
  }
  return requirement;
}

/** Render one destination constraint failure with the unit and range named. */
function constraintDiagnostic(
  unit: LoadUnitRecord,
  operationSpan: import("../project/types.js").SourceSpan,
  detail: string,
): ProjectDiagnostic {
  return projectDiagnostic(
    "E10275",
    `Cannot load unit '${unit.declaration}' into the destination — ${detail}; place the destination on a compatible global or choose a compatible unit`,
    operationSpan,
    null,
    [{ span: unit.source, message: "Load unit is declared here" }],
  );
}

/** Enforce handler alignment, window and VIC visibility on every load destination. */
export function enforceLoadDestinationConstraints(
  functions: readonly SemanticFunction[],
  globals: readonly SemanticGlobal[],
  loadUnits: readonly LoadUnitRecord[],
):
  | { readonly globals: readonly SemanticGlobal[] }
  | { readonly diagnostics: readonly ProjectDiagnostic[] } {
  const unitsById = new Map(loadUnits.map((unit) => [unit.id, unit] as const));
  const globalsByKey = new Map(
    globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  const requirements = new Map<
    string,
    DestinationRequirement & { readonly ranges: readonly { start: number; end: number }[] }
  >();
  const diagnostics: ProjectDiagnostic[] = [];
  for (const fn of functions) {
    for (const block of fn.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "load-unit") continue;
        const unit = unitsById.get(operation.unitId);
        if (unit === undefined) continue;
        const requirement = requirementOf(unit);
        const constrained =
          requirement.align > 1 || requirement.noCross !== null || requirement.vicVisible;
        const key = bindingIdentityKey(operation.destinationBinding);
        const global = globalsByKey.get(key);
        const size = operation.destinationRange.end - operation.destinationRange.start;
        if (!constrained) continue;
        if (global === undefined) {
          diagnostics.push(
            constraintDiagnostic(
              unit,
              operation.span,
              `it requires ${requirement.align > 1 ? `${requirement.align}-byte alignment` : ""}${
                requirement.align > 1 && requirement.vicVisible ? " and " : ""
              }${requirement.vicVisible ? "VIC visibility" : ""}, which a local or parameter home cannot prove yet`,
            ),
          );
          continue;
        }
        if (
          requirement.vicVisible &&
          global.placement?.region !== null &&
          global.placement?.region !== undefined &&
          global.placement.region !== "c64.vic.bank0" &&
          global.placement.region !== "c64.vic.bank0-ram"
        ) {
          diagnostics.push(
            constraintDiagnostic(
              unit,
              operation.span,
              `the destination is placed in region '${global.placement.region}', which cannot satisfy the required VIC visibility`,
            ),
          );
          continue;
        }
        const offset = operation.destinationRange.start;
        if (requirement.align > 1 && offset % requirement.align !== 0) {
          diagnostics.push(
            constraintDiagnostic(
              unit,
              operation.span,
              `the destination begins at field offset ${offset}, which is not a multiple of the required ${requirement.align}-byte alignment`,
            ),
          );
          continue;
        }
        const explicit = global.placement?.at ?? null;
        if (explicit !== null) {
          const physical = explicit + offset;
          const physicalEnd = physical + size - 1;
          if (requirement.align > 1 && physical % requirement.align !== 0) {
            diagnostics.push(
              constraintDiagnostic(
                unit,
                operation.span,
                `the placed destination starts at $${physical.toString(16)} and is not ${requirement.align}-byte aligned`,
              ),
            );
            continue;
          }
          if (
            requirement.noCross !== null &&
            Math.floor(physical / requirement.noCross) !==
              Math.floor(physicalEnd / requirement.noCross)
          ) {
            diagnostics.push(
              constraintDiagnostic(
                unit,
                operation.span,
                `the placed destination crosses a ${requirement.noCross}-byte boundary`,
              ),
            );
            continue;
          }
          if (requirement.vicVisible) {
            if (physical + size - 1 > 0x3fff) {
              diagnostics.push(
                constraintDiagnostic(
                  unit,
                  operation.span,
                  `the placed destination at $${physical.toString(16)} is outside the VIC bank-zero range`,
                ),
              );
              continue;
            }
            if (physical <= 0x1fff && physicalEnd >= 0x1000) {
              diagnostics.push(
                constraintDiagnostic(
                  unit,
                  operation.span,
                  `the placed destination at $${physical.toString(16)} intersects the character-ROM window and is not VIC-visible`,
                ),
              );
              continue;
            }
          }
        }
        const current = requirements.get(key);
        requirements.set(key, {
          align: Math.max(current?.align ?? 1, requirement.align),
          noCross:
            current?.noCross === null || current?.noCross === undefined
              ? requirement.noCross
              : requirement.noCross === null
                ? current.noCross
                : Math.min(current.noCross, requirement.noCross),
          vicVisible: (current?.vicVisible ?? false) || requirement.vicVisible,
          ranges: Object.freeze([
            ...(current?.ranges ?? []),
            Object.freeze({
              start: operation.destinationRange.start,
              end: operation.destinationRange.end,
            }),
          ]),
        });
      }
    }
  }
  if (diagnostics.length > 0) return Object.freeze({ diagnostics: Object.freeze(diagnostics) });
  const constrained = globals.map((global) => {
    const requirement = requirements.get(bindingIdentityKey(global.id));
    if (requirement === undefined) return global;
    const existing = global.placement ?? {
      at: null,
      align: 1,
      noCross: null,
      region: null,
    };
    if (
      requirement.vicVisible &&
      existing.region !== null &&
      existing.region !== "c64.vic.bank0" &&
      existing.region !== "c64.vic.bank0-ram"
    ) {
      return global;
    }
    return Object.freeze({
      ...global,
      placement: Object.freeze({
        ...existing,
        align: Math.max(existing.align, requirement.align),
        noCross: existing.noCross ?? requirement.noCross,
        region: requirement.vicVisible ? "c64.vic.bank0-ram" : existing.region,
      }),
    });
  });
  return Object.freeze({ globals: Object.freeze(constrained) });
}
