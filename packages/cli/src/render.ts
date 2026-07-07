/**
 * Output orchestration for `blendc`.
 *
 * Owns every write the CLI performs: diagnostics + count trailer to stderr, the
 * build summary / JSON report to stdout, and the `--emit-*` artifact files. Pure
 * routing over the shipped core renderers — no compiler logic. Diagnostics and
 * summary never mix streams (diagnostics → stderr, machine output → stdout).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  renderJson,
  renderReportJson,
  renderReportTerminal,
  renderTerminal,
  type Diagnostic,
  type ResourceReport,
  type SourceMap,
} from "@blend65/core";
import { errorAccent, warningAccent } from "./color.js";
import type { CliIo } from "./io.js";

/**
 * Render diagnostics + the count trailer to stderr.
 *
 * Terminal format: the caret blocks then the `error:`/`warning:` trailer (severity
 * word accented when color is enabled). JSON format: the diagnostics array only,
 * with NO trailer. An empty diagnostic set writes nothing.
 *
 * @param io The CLI IO surface.
 * @param diagnostics The final, severity-policy-applied diagnostics.
 * @param sourceMap The source map for span resolution.
 * @param format `"terminal"` or `"json"`.
 * @param color Whether to paint accents/carets.
 */
export function renderDiagnostics(
  io: CliIo,
  diagnostics: readonly Diagnostic[],
  sourceMap: SourceMap,
  format: "terminal" | "json",
  color: boolean,
): void {
  if (format === "json") {
    if (diagnostics.length > 0) {
      io.writeErr(renderJson(diagnostics));
    }
    return;
  }

  const rendered = renderTerminal(diagnostics, sourceMap, { color });
  if (rendered.length > 0) {
    io.writeErr(rendered);
  }
  const trailer = buildTrailer(diagnostics, color);
  if (trailer !== null) {
    io.writeErr(`${trailer}\n`);
  }
}

/**
 * Build the count trailer: errors present →
 * `error: <N> error[s][, <M> warning[s]] emitted`; else warnings present →
 * `warning: <M> warning[s] emitted`; else `null`.
 */
function buildTrailer(diagnostics: readonly Diagnostic[], color: boolean): string | null {
  const errors = diagnostics.filter((d) => d.severity === "error").length;
  const warnings = diagnostics.filter((d) => d.severity === "warning").length;

  if (errors > 0) {
    const warnClause = warnings > 0 ? `, ${warnings} ${plural(warnings, "warning")}` : "";
    return `${errorAccent("error", color)}: ${errors} ${plural(errors, "error")}${warnClause} emitted`;
  }
  if (warnings > 0) {
    return `${warningAccent("warning", color)}: ${warnings} ${plural(warnings, "warning")} emitted`;
  }
  return null;
}

/** Pluralize `word` for a count (`1 error` / `2 errors`). */
function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

/**
 * Render the terminal build summary to stdout (uncolored by design).
 *
 * @param io The CLI IO surface.
 * @param report The resource report.
 */
export function renderBuildSummary(io: CliIo, report: ResourceReport): void {
  io.writeOut(renderReportTerminal(report));
}

/**
 * Render the JSON resource report to stdout.
 *
 * @param io The CLI IO surface.
 * @param report The resource report.
 */
export function renderJsonReport(io: CliIo, report: ResourceReport): void {
  io.writeOut(renderReportJson(report));
}

/**
 * Write a text artifact under `dir` (creating it if needed) — the `--emit-*`
 * CLI-side writes. Throws on an fs error; `main.ts` maps that to a
 * `blendc: <message>` stderr line + exit 2.
 *
 * @param dir The output directory.
 * @param filename The file name (e.g. `main.asm`).
 * @param content The text content.
 * @returns The absolute path written.
 */
export function writeTextArtifact(dir: string, filename: string, content: string): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  writeFileSync(path, content, "utf8");
  return path;
}
