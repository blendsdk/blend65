import { createHash } from "node:crypto";
import type { SemanticAsset } from "../assets/asset-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { initializerBytes } from "./constant-bytes.js";
import { semanticTypeSize } from "./semantic-type-relations.js";
import { bindingIdentityKey, semanticTypeKey } from "./semantic-types.js";
import type { SemanticBinding, SemanticType, TypedExpr } from "./semantic-types.js";
import type { TypedDeclaration } from "./semantic-analysis-types.js";

/** Where a load unit's exact bytes came from. */
export type LoadUnitProvenance =
  | { readonly kind: "constant"; readonly expression: string }
  | { readonly kind: "embedded"; readonly assetId: string; readonly handler: string }
  | { readonly kind: "composed"; readonly roots: readonly string[] };

/** One source declaration retained as a nonresident load unit. */
export interface LoadUnitRecord {
  /** Stable identity derived from the qualified declaration, not its bytes. */
  readonly id: string;
  /** Deterministic uppercase directory name derived from the identity. */
  readonly diskName: string;
  /** Source declaration identity used by load operations. */
  readonly binding: import("./module-graph-types.js").BindingId;
  /** Qualified source declaration name. */
  readonly declaration: string;
  /** Declaration source span. */
  readonly source: SourceSpan;
  /** Exact fixed logical type. */
  readonly type: SemanticType;
  /** Exact logical byte count. */
  readonly size: number;
  /** Exact uncompressed logical bytes. */
  readonly bytes: readonly number[];
  /** SHA-256 of `bytes`. */
  readonly logicalSha256: string;
  /** Source initializer provenance. */
  readonly provenance: LoadUnitProvenance;
  /** RD-06 handler constraints that constrain every destination. */
  readonly destinationConstraints: readonly string[];
  /** Reachable canonical aliases. */
  readonly aliases: readonly string[];
}

/** One locally declared loadable initializer retained by body analysis. */
export interface LoadableInitializer {
  /** Binding created for the local declaration. */
  readonly binding: SemanticBinding;
  /** Exact fixed declared type. */
  readonly type: SemanticType;
  /** Checked initializer. */
  readonly initializer: TypedExpr;
}

/** Frontend-safe loadable metadata for tooling consumers. */
export interface LoadableHandoff {
  /** Exact retained units. */
  readonly units: readonly LoadUnitRecord[];
  /** Illegal resident-use diagnostics already proved by the frontend. */
  readonly illegalUses: readonly {
    readonly code: string;
    readonly span: SourceSpan;
    readonly message: string;
  }[];
}

/** Build the stable unit identity from declaration facts. */
export function loadUnitIdentity(
  binding: SemanticBinding,
  type: SemanticType,
  provenance: LoadUnitProvenance,
): string {
  const identity = [
    binding.qualifiedName ?? binding.name,
    bindingIdentityKey(binding.id),
    semanticTypeKey(type),
    provenance.kind,
    provenance.kind === "embedded" ? provenance.assetId : "",
  ].join("\u0000");
  return createHash("sha256").update(identity, "utf8").digest("hex");
}

/** Derive the deterministic uppercase disk name for one unit identity. */
export function loadUnitDiskName(identity: string): string {
  return `L${identity.slice(0, 12).toUpperCase()}`;
}

/** Build one unit record from a typed declaration and its exact initializer. */
function unitFromDeclaration(
  declaration: TypedDeclaration,
  binding: SemanticBinding,
  embeddedAssets: ReadonlyMap<string, SemanticAsset>,
): LoadUnitRecord | null {
  if (declaration.initializer === null) return null;
  const bytes = initializerBytes(declaration.initializer, declaration.type);
  if (bytes === null || bytes.length !== semanticTypeSize(declaration.type)) return null;
  const embedded = declaration.initializer.embedded;
  const provenance: LoadUnitProvenance =
    embedded === undefined
      ? { kind: "constant", expression: binding.qualifiedName ?? binding.name }
      : embedded.kind === "embedded"
        ? {
            kind: "embedded",
            assetId: embedded.assetId,
            handler: embeddedAssets.get(embedded.assetId)?.handler.handlerKey ?? "unknown",
          }
        : { kind: "composed", roots: [] };
  const id = loadUnitIdentity(binding, declaration.type, provenance);
  const constraints =
    embedded?.kind === "embedded"
      ? (embeddedAssets.get(embedded.assetId)?.constraints ?? []).map((constraint) =>
          JSON.stringify(constraint),
        )
      : [];
  return Object.freeze({
    id,
    diskName: loadUnitDiskName(id),
    binding: declaration.binding,
    declaration: binding.qualifiedName ?? binding.name,
    source: declaration.binding.span,
    type: declaration.type,
    size: bytes.length,
    bytes,
    logicalSha256: createHash("sha256").update(Uint8Array.from(bytes)).digest("hex"),
    provenance,
    destinationConstraints: Object.freeze(constraints),
    aliases: Object.freeze([binding.qualifiedName ?? binding.name]),
  });
}

/** Build one unit record from a local loadable initializer. */
function unitFromLocal(
  local: LoadableInitializer,
  embeddedAssets: ReadonlyMap<string, SemanticAsset>,
): LoadUnitRecord | null {
  const bytes = initializerBytes(local.initializer, local.type);
  if (bytes === null || bytes.length !== semanticTypeSize(local.type)) return null;
  const embedded = local.initializer.embedded;
  const provenance: LoadUnitProvenance =
    embedded === undefined
      ? { kind: "constant", expression: local.binding.qualifiedName ?? local.binding.name }
      : embedded.kind === "embedded"
        ? {
            kind: "embedded",
            assetId: embedded.assetId,
            handler: embeddedAssets.get(embedded.assetId)?.handler.handlerKey ?? "unknown",
          }
        : { kind: "composed", roots: [] };
  const id = loadUnitIdentity(local.binding, local.type, provenance);
  const constraints =
    embedded?.kind === "embedded"
      ? (embeddedAssets.get(embedded.assetId)?.constraints ?? []).map((constraint) =>
          JSON.stringify(constraint),
        )
      : [];
  return Object.freeze({
    id,
    diskName: loadUnitDiskName(id),
    binding: local.binding.id,
    declaration: local.binding.qualifiedName ?? local.binding.name,
    source: local.binding.declaration,
    type: local.type,
    size: bytes.length,
    bytes,
    logicalSha256: createHash("sha256").update(Uint8Array.from(bytes)).digest("hex"),
    provenance,
    destinationConstraints: Object.freeze(constraints),
    aliases: Object.freeze([local.binding.qualifiedName ?? local.binding.name]),
  });
}

/**
 * Collect every loadable declaration without filtering by reachability.
 * Whole-program reachability later decides which units are packaged.
 */
export function collectLoadUnits(
  declarations: readonly TypedDeclaration[],
  bindings: readonly SemanticBinding[],
  locals: readonly LoadableInitializer[],
  assets: readonly SemanticAsset[],
): readonly LoadUnitRecord[] {
  const bindingsByKey = new Map(
    bindings.map((binding) => [bindingIdentityKey(binding.id), binding] as const),
  );
  const embeddedAssets = new Map(
    assets.filter((asset) => asset.kind === "resident-asset").map((asset) => [asset.id, asset]),
  );
  const units: LoadUnitRecord[] = [];
  for (const declaration of declarations) {
    if (declaration.loadable !== true) continue;
    const binding = bindingsByKey.get(bindingIdentityKey(declaration.binding));
    if (binding === undefined) continue;
    const unit = unitFromDeclaration(declaration, binding, embeddedAssets);
    if (unit !== null) units.push(unit);
  }
  for (const local of locals) {
    const unit = unitFromLocal(local, embeddedAssets);
    if (unit !== null) units.push(unit);
  }
  return Object.freeze(
    [...new Map(units.map((unit) => [unit.id, unit] as const)).values()].sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    ),
  );
}

/** Build the frontend-safe handoff view. */
export function loadableHandoff(
  units: readonly LoadUnitRecord[],
  diagnostics: readonly ProjectDiagnostic[],
): LoadableHandoff {
  return Object.freeze({
    units,
    illegalUses: Object.freeze(
      diagnostics
        .filter((diagnostic) => diagnostic.code === "E10274")
        .map((diagnostic) => ({
          code: diagnostic.code,
          span:
            diagnostic.primarySpan ??
            Object.freeze({ sourceId: "", start: 0, end: 0 }),
          message: diagnostic.message,
        })),
    ),
  });
}
