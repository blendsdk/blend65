import type { FragmentationProfile, InventoryDiagnostic } from "./model.js";
import type { InventoryLimits } from "./limits.js";

/** Source construct represented by the byte-oriented fragmentation profile. */
export type FragmentKind =
  | "heading"
  | "paragraph"
  | "list-item"
  | "table-row"
  | "table-cell"
  | "ebnf-fence"
  | "ebnf-production"
  | "residual";

/** Canonical source path and its untouched bytes. */
export interface SourceDocument {
  readonly path: string;
  readonly bytes: Uint8Array;
}

/** One authoritative raw span and its normalized identity metadata. */
export interface SourceFragment {
  readonly fragmentId: string;
  readonly parentFragmentId?: string;
  readonly kind: FragmentKind;
  readonly startByte: number;
  readonly endByte: number;
  readonly headingAncestry: readonly string[];
  readonly sectionIdentity: string;
  readonly contentHash: `sha256:${string}`;
  readonly displayLine: number;
  readonly displayColumn: number;
}

/** Complete result of fragmenting one source document. */
export interface FragmentationResult {
  readonly ok: boolean;
  readonly fragments: readonly SourceFragment[];
  readonly diagnostics: readonly InventoryDiagnostic[];
}

/** Public source-fragmentation function signature. */
export type FragmentSource = (
  source: SourceDocument,
  profile: FragmentationProfile,
  limits: InventoryLimits,
) => FragmentationResult;
