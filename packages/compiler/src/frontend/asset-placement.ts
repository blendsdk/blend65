import type { ResidentAsset, SemanticAsset } from "../assets/asset-types.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { ModuleGraph } from "./module-graph-types.js";
import { bindingIdentityKey } from "./semantic-types.js";
import type { PlacementConstraints, TypedDeclaration } from "./semantic-types.js";

/** Empty placement that satisfies every object trivially. */
function noPlacement(): PlacementConstraints {
  return { at: null, align: 1, noCross: null, region: null };
}

/** Derive the handler-owned placement requirements from one resident asset. */
function handlerPlacement(asset: ResidentAsset): PlacementConstraints {
  let placement = noPlacement();
  for (const constraint of asset.constraints) {
    switch (constraint.kind) {
      case "at":
        placement = { ...placement, at: constraint.start };
        break;
      case "align":
        placement = { ...placement, align: Math.max(placement.align, constraint.bytes) };
        break;
      case "noCross":
        placement = {
          ...placement,
          noCross:
            placement.noCross === null
              ? constraint.boundaryBytes
              : Math.min(placement.noCross, constraint.boundaryBytes),
        };
        break;
      case "region":
        placement = { ...placement, region: constraint.regionId };
        break;
      default:
        break;
    }
  }
  return Object.freeze(placement);
}

/** Return whether an object can occupy one interval under its constraints. */
function satisfiable(placement: PlacementConstraints, bytes: number): boolean {
  if (placement.at !== null && placement.at % placement.align !== 0) return false;
  if (placement.noCross !== null && bytes > placement.noCross) return false;
  if (placement.at !== null && placement.noCross !== null) {
    if (
      Math.floor(placement.at / placement.noCross) !==
      Math.floor((placement.at + bytes - 1) / placement.noCross)
    ) {
      return false;
    }
  }
  return true;
}

/** Describe the exact constraint that failed for one handler-owned object. */
function constraintMessage(asset: ResidentAsset, placement: PlacementConstraints): string {
  if (placement.at !== null && placement.at % placement.align !== 0) {
    return `handler requires ${placement.align}-byte alignment at $${placement.at.toString(16)}`;
  }
  if (placement.noCross !== null && asset.bytes.length > placement.noCross) {
    return `handler requires ${placement.noCross} contiguous bytes but the output is ${asset.bytes.length} bytes`;
  }
  if (placement.at !== null) {
    return `handler requires the fixed load address $${placement.at.toString(16)}`;
  }
  return "handler placement requirement cannot be satisfied";
}

/**
 * Merge handler and source constraints on deduplicated resident assets.
 *
 * Handler requirements are the base. Source `place(...)` may strengthen them,
 * but may never weaken, move or contradict them. Contradictions report E10273
 * with every contributing declaration; an impossible handler-only requirement
 * reports E10143 naming the exact constraint. Scalar and zero-byte outputs never
 * receive a placement because they own no resident storage.
 */
export function placeSemanticAssets(
  assets: readonly SemanticAsset[],
  declarations: readonly TypedDeclaration[],
  modules: ModuleGraph["modules"],
): {
  readonly assets: readonly SemanticAsset[];
  readonly diagnostics: readonly ProjectDiagnostic[];
} {
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

  const byId = new Map(assets.map((asset) => [asset.id, asset] as const));
  const placements = new Map<string, PlacementConstraints>();
  const handlerBase = new Map<string, PlacementConstraints>();
  const declarationSpan = new Map<string, SourceSpan>();
  const contributors = new Map<string, readonly SourceSpan[]>();
  const diagnostics: ProjectDiagnostic[] = [];

  for (const declaration of declarations) {
    const embedded = declaration.initializer?.embedded;
    if (embedded === undefined) continue;
    const asset = byId.get(embedded.assetId);
    if (asset?.kind !== "resident-asset" || asset.bytes.length === 0) continue;
    if (!declarationSpan.has(asset.id)) {
      declarationSpan.set(
        asset.id,
        sourceSpans.get(bindingIdentityKey(declaration.binding)) ?? declaration.binding.span,
      );
    }
  }

  for (const asset of assets) {
    if (asset.kind !== "resident-asset" || asset.bytes.length === 0) continue;
    const base = handlerPlacement(asset);
    handlerBase.set(asset.id, base);
    if (!satisfiable(base, asset.bytes.length)) {
      diagnostics.push(
        projectDiagnostic(
          "E10143",
          `Cannot place '${asset.sourcePath}' — ${constraintMessage(asset, base)}; change the asset or its format settings`,
          declarationSpan.get(asset.id) ?? null,
        ),
      );
      continue;
    }
    placements.set(asset.id, base);
  }

  for (const declaration of declarations) {
    const embedded = declaration.initializer?.embedded;
    const next = declaration.placement;
    if (next == null || embedded === undefined || embedded.kind !== "embedded") continue;
    const span =
      sourceSpans.get(bindingIdentityKey(declaration.binding)) ?? declaration.binding.span;
    if (declaration.loadable) {
      diagnostics.push(
        projectDiagnostic(
          "E10272",
          "Loadable assets have no resident placement — remove place(...) or declare a resident asset",
          span,
        ),
      );
      continue;
    }
    if (embedded.bytes.length === 0) {
      diagnostics.push(
        projectDiagnostic(
          "E10272",
          "A zero-byte selected output has no resident placement — remove place(...) or choose a non-empty selector",
          span,
        ),
      );
      continue;
    }
    const asset = byId.get(embedded.assetId);
    if (asset?.kind !== "resident-asset") continue;
    const previous = placements.get(embedded.assetId) ?? noPlacement();
    const base = handlerBase.get(embedded.assetId) ?? noPlacement();
    const combined: PlacementConstraints = {
      at: previous.at ?? next.at,
      align: Math.max(previous.align, next.align),
      noCross:
        previous.noCross == null
          ? next.noCross
          : next.noCross === null
            ? previous.noCross
            : Math.min(previous.noCross, next.noCross),
      region: previous.region ?? next.region,
    };
    const weakensHandler =
      (base.at !== null && next.at !== null && base.at !== next.at) ||
      (base.region !== null && next.region !== null && base.region !== next.region) ||
      (base.noCross !== null && next.noCross !== null && next.noCross > base.noCross);
    const incompatible =
      weakensHandler ||
      (previous?.at != null && next.at !== null && previous.at !== next.at) ||
      (previous?.region != null && next.region !== null && previous.region !== next.region) ||
      !satisfiable(combined, embedded.bytes.length);
    if (incompatible) {
      const detail = weakensHandler
        ? constraintMessage(asset, base)
        : combined.at !== null && combined.at % combined.align !== 0
          ? `the combined ${combined.align}-byte alignment cannot be satisfied at $${combined.at.toString(16)}`
          : combined.noCross !== null && embedded.bytes.length > combined.noCross
            ? `the output is ${embedded.bytes.length} bytes but must stay within ${combined.noCross} bytes`
            : "the combined constraints cannot be satisfied together";
      diagnostics.push(
        projectDiagnostic(
          "E10273",
          `Cannot place '${asset.sourcePath}' — combined explicit placement constraints conflict with the handler requirement (${detail}); change or remove the explicit constraint`,
          span,
          null,
          (contributors.get(embedded.assetId) ?? []).map((contributor) => ({
            span: contributor,
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
        if (asset.kind !== "resident-asset") return asset;
        const placement = placements.get(asset.id);
        return placement === undefined ? asset : Object.freeze({ ...asset, placement });
      }),
    ),
    diagnostics: Object.freeze(diagnostics),
  });
}
