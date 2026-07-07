/**
 * The terminal diagnostic renderer — the Ch 14 §1 caret format.
 *
 * A pure function over a policy-applied `Diagnostic[]` (renderers never
 * re-derive meaning): resolves spans through the {@link SourceMap}, echoes
 * sanitized source excerpts with byte-column caret runs, and optionally paints
 * hand-rolled ANSI color. Rendering lives in core but is invoked only by
 * consumers (CLI/LSP) — nothing in the compiler pipeline calls this, and core
 * itself never prints.
 */

import type { Diagnostic, Severity } from "./diagnostic.js";
import type { SourceSpan } from "./source-span.js";
import type { SourceMap } from "./source-map.js";
import { utf8ByteLength } from "./line-map.js";
import { BOLD, CYAN, RED, YELLOW, paint } from "./ansi.js";

/** Options accepted by {@link renderTerminal}. */
export interface RenderTerminalOptions {
  /** Apply ANSI color. `false` yields byte-identical plain text. */
  readonly color: boolean;
}

/** Fixed indent for `= note:`/`= help:` when there is no excerpt. */
const DEGRADED_INDENT = "   ";

/** Severity → SGR foreground code. */
function severityColor(severity: Severity): number {
  return severity === "error" ? RED : YELLOW;
}

/**
 * Result of sanitizing one echoed source line while re-anchoring a
 * raw byte range into sanitized-byte coordinates.
 */
interface SanitizedLine {
  /** The line with C0 (except TAB) and C1 controls stripped. */
  text: string;
  /** Caret-run start, as a byte offset into the *sanitized* line. */
  start: number;
  /** Caret-run end (exclusive), as a byte offset into the *sanitized* line. */
  end: number;
}

/**
 * Strips control characters from an echoed source line and maps
 * the raw caret byte range `[rawStart, rawEnd)` to sanitized coordinates.
 *
 * C0 controls other than TAB (`0x09`) and all C1 controls (`0x80–0x9F`) are
 * removed so a hostile source cannot inject terminal escapes. Caret columns
 * are computed against the sanitized text: stripped bytes before the span do
 * not count toward the caret indent, keeping alignment correct. A range end
 * past the line clamps to the sanitized line end (multi-line spans underline
 * only the first line).
 */
function sanitizeLine(raw: string, rawStart: number, rawEnd: number): SanitizedLine {
  let text = "";
  let rawByte = 0;
  let sanitizedByte = 0;
  let start = -1;
  let end = -1;

  for (const char of raw) {
    // `for..of` iterates code points, so surrogate pairs stay intact.
    if (start < 0 && rawByte >= rawStart) {
      start = sanitizedByte;
    }
    if (end < 0 && rawByte >= rawEnd) {
      end = sanitizedByte;
    }

    const codePoint = char.codePointAt(0) as number;
    const isC0 = codePoint < 0x20 && codePoint !== 0x09;
    const isDelOrC1 = codePoint >= 0x7f && codePoint <= 0x9f;
    if (!isC0 && !isDelOrC1) {
      text += char;
      sanitizedByte += utf8ByteLength(codePoint);
    }
    rawByte += utf8ByteLength(codePoint);
  }

  // Ranges at or past the end of the line anchor to the sanitized line end.
  if (start < 0) {
    start = sanitizedByte;
  }
  if (end < 0) {
    end = sanitizedByte;
  }
  return { text, start, end };
}

/**
 * Renders one excerpt sub-block (primary or secondary mini-block): the
 * `  --> ` location line, bare gutter, sanitized excerpt, and caret line.
 *
 * The gutter width is derived from THIS excerpt's line number — widths are
 * never shared across sub-blocks.
 *
 * @param span A span whose `sourceId` is known to be interned.
 * @param label Caret-line label (secondary spans only); `null` renders
 *   carets alone (the primary span has no label).
 * @returns The sub-block's lines plus its gutter width (the primary's width
 *   anchors the `= note:`/`= help:` alignment).
 */
function renderExcerpt(
  span: SourceSpan,
  label: string | null,
  severity: Severity,
  sourceMap: SourceMap,
  color: boolean,
): { lines: string[]; gutterWidth: number } {
  const lineMap = sourceMap.getLineMap(span.sourceId);
  const path = sourceMap.getPath(span.sourceId);
  const { line, column } = lineMap.getLineCol(span.start);
  const rawText = lineMap.getLineText(span.start);

  // Byte offset of the line head; caret math happens in line-local bytes.
  const lineStart = span.start - (column - 1);
  const sanitized = sanitizeLine(rawText, column - 1, Math.max(span.end - lineStart, 0));
  // An empty (or fully clamped) range still renders one caret (R33).
  const caretCount = Math.max(1, sanitized.end - sanitized.start);

  const gutterWidth = String(line).length;
  const pad = " ".repeat(gutterWidth);
  const arrow = color ? paint("-->", CYAN) : "-->";
  const pipe = color ? paint("|", CYAN) : "|";
  const lineNo = color ? paint(String(line), CYAN) : String(line);
  const carets = "^".repeat(caretCount);
  const caretRun = color ? paint(carets, severityColor(severity)) : carets;
  const labelSuffix =
    label === null ? "" : ` ${color ? paint(label, severityColor(severity)) : label}`;

  return {
    gutterWidth,
    lines: [
      `  ${arrow} ${path}:${line}:${column}`,
      `${pad} ${pipe}`,
      `${lineNo} ${pipe} ${sanitized.text}`,
      `${pad} ${pipe} ${" ".repeat(sanitized.start)}${caretRun}${labelSuffix}`,
    ],
  };
}

/** Renders one diagnostic block (header, excerpts, notes/help). */
function renderBlock(diagnostic: Diagnostic, sourceMap: SourceMap, color: boolean): string {
  const lines: string[] = [];

  const headerPrefix = `${diagnostic.severity}[${diagnostic.code}]`;
  const painted = color
    ? paint(headerPrefix, BOLD, severityColor(diagnostic.severity))
    : headerPrefix;
  lines.push(`${painted}: ${diagnostic.message}`);

  // Degradation: a null primary span (span-less ICE) or an id the map
  // cannot resolve (e.g. the reserved config-sentinel id -2) drops every
  // location element — header, notes, and help only. Never throw.
  const primary = diagnostic.primarySpan;
  const resolvable = primary !== null && sourceMap.has(primary.sourceId);

  // With no excerpt there is no gutter: notes/help use the fixed 3-space
  // indent; with one, they align to the PRIMARY excerpt's gutter.
  let markerIndent = DEGRADED_INDENT;

  if (resolvable) {
    const primaryBlock = renderExcerpt(primary, null, diagnostic.severity, sourceMap, color);
    lines.push(...primaryBlock.lines);
    markerIndent = `${" ".repeat(primaryBlock.gutterWidth)} `;

    for (const secondary of diagnostic.secondarySpans) {
      // Degradation applies per-span: unresolvable secondary ids degrade to nothing.
      if (!sourceMap.has(secondary.span.sourceId)) {
        continue;
      }
      lines.push(
        ...renderExcerpt(secondary.span, secondary.label, diagnostic.severity, sourceMap, color)
          .lines,
      );
    }
  }

  const marker = color ? paint("=", CYAN) : "=";
  for (const note of diagnostic.notes) {
    lines.push(`${markerIndent}${marker} note: ${note}`);
  }
  if (diagnostic.help !== undefined) {
    lines.push(`${markerIndent}${marker} help: ${diagnostic.help}`);
  }

  return lines.join("\n");
}

/**
 * Renders diagnostics in the Ch 14 §1 terminal caret format.
 *
 * Blocks are joined by one blank line and the output ends with a trailing
 * newline; an empty input renders as the empty string. No summary footer is
 * emitted — the "N errors, M warnings" line belongs to the caller (e.g. the
 * CLI). Robust over hostile input: unresolvable ids and null spans degrade
 * gracefully, and echoed excerpts are sanitized.
 *
 * @param diagnostics The policy-applied diagnostics, in final order.
 * @param sourceMap The registry used to resolve span source ids.
 * @param options `color: true` paints the ANSI color map; `false` is plain.
 * @returns The rendered text (pure — this function never prints).
 */
export function renderTerminal(
  diagnostics: readonly Diagnostic[],
  sourceMap: SourceMap,
  options: RenderTerminalOptions,
): string {
  if (diagnostics.length === 0) {
    return "";
  }
  const blocks = diagnostics.map((d) => renderBlock(d, sourceMap, options.color));
  return `${blocks.join("\n\n")}\n`;
}
