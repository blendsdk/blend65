import type { SourceRecord, SourceSpan } from "../project/types.js";
import { ANALYSIS_OBLIGATION_KIND } from "./semantic-types.js";
import type { AnalysisObligation } from "./semantic-types.js";

/** Freeze a span copy so no result shares a mutable caller-owned record. */
export function freezeSpan(span: SourceSpan): SourceSpan {
  return Object.freeze({ sourceId: span.sourceId, start: span.start, end: span.end });
}

/** Render a one-based raw-byte position without converting it to an editor column. */
export function rawByteLocation(source: SourceRecord, offset: number): string {
  const bytes = Buffer.from(source.text, "utf8");
  let line = 1;
  let column = 1;
  let previousCR = false;
  for (let index = 0; index < Math.min(offset, bytes.length); index += 1) {
    const byte = bytes[index]!;
    if (byte === 0x0d) {
      line += 1;
      column = 1;
      previousCR = true;
    } else if (byte === 0x0a) {
      if (!previousCR) line += 1;
      column = 1;
      previousCR = false;
    } else {
      column += 1;
      previousCR = false;
    }
  }
  return `${source.sourceId}:${line}:${column}`;
}

/** Decode one raw-byte source range whose boundaries came from the scanner. */
export function sourceSlice(source: SourceRecord, start: number, end: number): string {
  return Buffer.from(source.text, "utf8").subarray(start, end).toString("utf8");
}

/** Classify a retained unchecked region without fabricating accepted syntax. */
export function uncheckedObligation(source: SourceRecord, span: SourceSpan): AnalysisObligation {
  const spelling = sourceSlice(source, span.start, span.end).trimStart();
  const implementationForm =
    /^(?:comptime|do|enum|fn|for|interrupt|loadable|place|switch|zeropage)\b/u.test(spelling);
  return Object.freeze({
    kind: implementationForm
      ? ANALYSIS_OBLIGATION_KIND.implementation
      : ANALYSIS_OBLIGATION_KIND.analysisLimit,
    span: freezeSpan(span),
    message: implementationForm
      ? "Source form is not implemented by the current frontend slice"
      : "Frontend analysis stopped at its defensive nesting limit",
  });
}

/** Add one dependency obligation once, preserving its first proving location. */
export function addMissingDependency(
  obligations: AnalysisObligation[],
  missing: Set<string>,
  moduleName: string,
  span: SourceSpan | null,
): void {
  if (missing.has(moduleName)) return;
  missing.add(moduleName);
  obligations.push(
    Object.freeze({
      kind: ANALYSIS_OBLIGATION_KIND.dependency,
      span: span === null ? null : freezeSpan(span),
      message: `Required module '${moduleName}' is unavailable`,
    }),
  );
}
