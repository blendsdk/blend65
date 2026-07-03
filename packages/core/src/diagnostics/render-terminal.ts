/**
 * The terminal diagnostic renderer — the Ch 14 §1 caret format.
 *
 * A pure function over a policy-applied `Diagnostic[]` (R32 — renderers never
 * re-derive meaning): resolves spans through the {@link SourceMap}, echoes
 * sanitized source excerpts with byte-column caret runs, and optionally paints
 * hand-rolled ANSI color (AR-Q9/AR-17). Rendering lives in core but is invoked
 * only by consumers (CLI/LSP) — nothing in the compiler pipeline calls this
 * (R37/AC-14), and core itself never prints.
 *
 * Covers RD-11 R32–R35, R51, R52 · §3.7/§4.5 · AC-12 · AR-105 presentation
 * contract (AR-Q8/Q9/Q14, PF-004/PF-007/PF-009/PF-010/PF-013).
 */

import type { Diagnostic, Severity } from "./diagnostic.js";
import type { SourceSpan } from "./source-span.js";
import type { SourceMap } from "./source-map.js";
import { utf8ByteLength } from "./line-map.js";
import { BOLD, CYAN, RED, YELLOW, paint } from "./ansi.js";

/** Options accepted by {@link renderTerminal}. */
export interface RenderTerminalOptions {
  /** Apply ANSI color (AR-Q9 map). `false` yields byte-identical plain text. */
  readonly color: boolean;
}

/** Fixed indent for `= note:`/`= help:` when there is no excerpt (PF-004). */
const DEGRADED_INDENT = "   ";

/** Severity → SGR foreground code (AR-Q9). */
function severityColor(severity: Severity): number {
  return severity === "error" ? RED : YELLOW;
}

/**
 * Result of sanitizing one echoed source line against R52 while re-anchoring a
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
 * Strips control characters from an echoed source line (R52/PF-010) and maps
 * the raw caret byte range `[rawStart, rawEnd)` to sanitized coordinates.
 *
 * C0 controls other than TAB (`0x09`) and all C1 controls (`0x80–0x9F`) are
 * removed so a hostile source cannot inject terminal escapes. Caret columns
 * are computed against the sanitized text: stripped bytes before the span do
 * not count toward the caret indent, keeping alignment correct. A range end
 * past the line clamps to the sanitized line end (multi-line spans underline
 * only the first line, R33/PF-013).
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
 * never shared across sub-blocks (PF-004).
 *
 * @param span A span whose `sourceId` is known to be interned.
 * @param label Caret-line label (secondary spans only, AR-Q8); `null` renders
 *   carets alone (AR-Q14 — the primary span has no label).
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

  // R51 degradation: a null primary span (span-less ICE) or an id the map
  // cannot resolve (e.g. the RD-16 config sentinel -2) drops every location
  // element — header, notes, and help only. Never throw.
  const primary = diagnostic.primarySpan;
  const resolvable = primary !== null && sourceMap.has(primary.sourceId);

  // With no excerpt there is no gutter: notes/help use the fixed 3-space
  // indent (PF-004); with one, they align to the PRIMARY excerpt's gutter.
  let markerIndent = DEGRADED_INDENT;

  if (resolvable) {
    const primaryBlock = renderExcerpt(primary, null, diagnostic.severity, sourceMap, color);
    lines.push(...primaryBlock.lines);
    markerIndent = `${" ".repeat(primaryBlock.gutterWidth)} `;

    for (const secondary of diagnostic.secondarySpans) {
      // R51 applies per-span: unresolvable secondary ids degrade to nothing.
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
 * Renders diagnostics in the Ch 14 §1 terminal caret format (AC-12).
 *
 * Blocks are joined by one blank line and the output ends with a trailing
 * newline; an empty input renders as the empty string. No summary footer is
 * emitted — the "N errors, M warnings" line belongs to the CLI (RD-15, AR-Q8).
 * Total over hostile input: unresolvable ids and null spans degrade per R51,
 * and echoed excerpts are sanitized per R52.
 *
 * @param diagnostics The policy-applied diagnostics, in final order (R18).
 * @param sourceMap The registry used to resolve span source ids (R35).
 * @param options `color: true` paints the AR-Q9 ANSI map; `false` is plain.
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
