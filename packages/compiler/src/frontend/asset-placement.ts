import type { SemanticAsset } from "../assets/asset-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { PlacementConstraints, TypedDeclaration } from "./semantic-types.js";

/** Merge source constraints on one deduplicated resident asset without copying its bytes. */
export function placeSemanticAssets(
  assets: readonly SemanticAsset[],
  declarations: readonly TypedDeclaration[],
): {
  readonly assets: readonly SemanticAsset[];
  readonly diagnostics: readonly ProjectDiagnostic[];
} {
  const placements = new Map<string, PlacementConstraints>();
  const diagnostics: ProjectDiagnostic[] = [];
  for (const declaration of declarations) {
    const embedded = declaration.initializer?.embedded;
    const next = declaration.placement;
    if (declaration.loadable || embedded === undefined || next == null) continue;
    const previous = placements.get(embedded.assetId);
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
          declaration.binding.span,
        ),
      );
    } else {
      placements.set(embedded.assetId, Object.freeze(combined));
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
