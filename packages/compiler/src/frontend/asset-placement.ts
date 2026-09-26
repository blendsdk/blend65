import type { SemanticAsset } from "../assets/asset-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { ModuleGraph } from "./module-graph-types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { PlacementConstraints, TypedDeclaration } from "./semantic-types.js";

/** Merge source constraints on one deduplicated resident asset without copying its bytes. */
export function placeSemanticAssets(
  assets: readonly SemanticAsset[],
  declarations: readonly TypedDeclaration[],
  modules: ModuleGraph["modules"],
): {
  readonly assets: readonly SemanticAsset[];
  readonly diagnostics: readonly ProjectDiagnostic[];
} {
  const placements = new Map<string, PlacementConstraints>();
  const sourceSpans = new Map<string, SourceSpan>();
  for (const module of modules)
    for (const unit of module.units) {
      for (const declaration of unit.declarations) {
        if (!("placement" in declaration) || declaration.placement === null) continue;
        sourceSpans.set(
          bindingIdentityKey({ sourceId: declaration.span.sourceId, span: declaration.span }),
          declaration.placement.span,
        );
      }
    }
  const contributors = new Map<string, readonly SourceSpan[]>();
  const diagnostics: ProjectDiagnostic[] = [];
  for (const declaration of declarations) {
    const embedded = declaration.initializer?.embedded;
    const next = declaration.placement;
    if (declaration.loadable || embedded === undefined || next == null) continue;
    const previous = placements.get(embedded.assetId);
    const span =
      sourceSpans.get(bindingIdentityKey(declaration.binding)) ?? declaration.binding.span;
    const combined: PlacementConstraints = {
      at: previous?.at ?? next.at,
      align: Math.max(previous?.align ?? 1, next.align),
      noCross:
        previous?.noCross == null
          ? next.noCross
          : next.noCross === null
            ? previous.noCross
            : Math.min(previous.noCross, next.noCross),
      region: previous?.region ?? next.region,
    };
    // Alignment and no-cross windows are powers of two, so the stronger constraint
    // contains the weaker one. Fixed addresses and named regions must agree exactly.
    const incompatible =
      (previous?.at != null && next.at !== null && previous.at !== next.at) ||
      (previous?.region != null && next.region !== null && previous.region !== next.region) ||
      (combined.noCross !== null && embedded.bytes.length > combined.noCross) ||
      (combined.at !== null &&
        (combined.at % combined.align !== 0 ||
          (combined.noCross !== null &&
            Math.floor(combined.at / combined.noCross) !==
              Math.floor((combined.at + embedded.bytes.length - 1) / combined.noCross))));
    if (incompatible) {
      diagnostics.push(
        projectDiagnostic(
          "E10273",
          `Cannot place '${assets.find(({ id }) => id === embedded.assetId)?.sourcePath ?? embedded.assetId}' — combined explicit placement constraints conflict with another declaration of the same embedded object; change or remove the explicit constraint`,
          span,
          null,
          (contributors.get(embedded.assetId) ?? []).map((span) => ({
            span,
            message: "Contributing placement constraint is here",
          })),
        ),
      );
    } else {
      placements.set(embedded.assetId, Object.freeze(combined));
      contributors.set(embedded.assetId, [...(contributors.get(embedded.assetId) ?? []), span]);
    }
  }
  return Object.freeze({
    assets: Object.freeze(
      assets.map((asset) => {
        const placement = placements.get(asset.id);
        return placement === undefined ? asset : Object.freeze({ ...asset, placement });
      }),
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}
