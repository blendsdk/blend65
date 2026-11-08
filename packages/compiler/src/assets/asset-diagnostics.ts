import { escapeDiagnosticText, projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";

/** Exact, source-linked description of one rejected native asset request. */
export interface NativeAssetDiagnosticDetails {
  /** Stable diagnostic code selected by the failure class. */
  readonly code: string;
  /** Source declaration spelling without host paths. */
  readonly declaration: string;
  /** Project-relative asset spelling with forward slashes. */
  readonly literalPath: string;
  /** Registered handler key. */
  readonly handlerKey: string;
  /** Registered handler version. */
  readonly handlerVersion: string;
  /** Failed field or block name, when the format defines one. */
  readonly field?: string;
  /** Zero-based byte offset inside the input, when known. */
  readonly offset?: number;
  /** One concrete action the author can take. */
  readonly remedy: string;
  /** Embed call span that owns the failure. */
  readonly span: SourceSpan;
  /** Optional related declaration spans. */
  readonly related?: readonly { readonly span: SourceSpan; readonly message: string }[];
}

/**
 * Build one safe native-asset diagnostic.
 *
 * The message names the declaration, the project-relative spelling, the exact
 * handler identity, the failed field and offset, and one remedy. It never
 * includes an absolute host path or arbitrary binary contents.
 *
 * @example
 * nativeAssetDiagnostic({
 *   code: "E10204",
 *   declaration: "SPRITES",
 *   literalPath: "assets/player.spd",
 *   handlerKey: "spritepad",
 *   handlerVersion: "3.80",
 *   field: "VERSION",
 *   offset: 3,
 *   remedy: "save the project as SPD version 5",
 *   span,
 * });
 */
export function nativeAssetDiagnostic(details: NativeAssetDiagnosticDetails): ProjectDiagnostic {
  const field =
    details.field === undefined
      ? ""
      : ` at field '${escapeDiagnosticText(details.field)}'${
          details.offset === undefined ? "" : ` (offset ${details.offset})`
        }`;
  const message = `Cannot use native asset '${escapeDiagnosticText(details.literalPath)}' in declaration '${escapeDiagnosticText(details.declaration)}' with handler '${escapeDiagnosticText(details.handlerKey)}' ${escapeDiagnosticText(details.handlerVersion)}${field} — ${details.remedy}`;
  return projectDiagnostic(details.code, message, details.span, null, details.related ?? []);
}
