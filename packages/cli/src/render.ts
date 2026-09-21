import type { ProjectDiagnostic } from "@blend65/compiler";

/** Escape untrusted text without sending terminal control characters. */
export function escapeTerminalText(text: string): string {
  return text.replace(
    /[\u0000-\u001f\u007f-\u009f]/gu,
    (character) => "U+" + character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
  );
}

/**
 * Render the exact supported command and option surface.
 * @returns Human-readable usage text ending with one newline.
 */
export function renderUsage(): string {
  return (
    "Usage: blendc <check|build|run> [options]\n" +
    "       blendc --help (-h) | --version (-v)\n\n" +
    "Project options:\n" +
    "  --project PATH\n" +
    "  --target PROFILE\n" +
    "  --entry MODULE\n\n" +
    "Build/run options:\n" +
    "  --optimization none\n" +
    "  --bounds-check <true|false>\n" +
    "  --division-zero-check <true|false>\n"
  );
}

/** A failed load has no trusted source text, so locations use exact byte spans. */
function location(diagnostic: ProjectDiagnostic): string | null {
  const span = diagnostic.primarySpan;
  return span === null
    ? null
    : `${escapeTerminalText(span.sourceId)}:bytes ${span.start}..${span.end}`;
}

/**
 * Render shared diagnostics in their deterministic service order.
 * Every untrusted insertion is escaped, including related messages and JSON
 * pointers. The function does not reread source files or guess line numbers.
 * @param diagnostics Diagnostics returned by a compiler service.
 * @returns Safe terminal text, empty when there are no diagnostics.
 */
export function renderDiagnostics(diagnostics: readonly ProjectDiagnostic[]): string {
  const lines: string[] = [];
  for (const diagnostic of diagnostics) {
    lines.push(
      `${diagnostic.severity}[${escapeTerminalText(diagnostic.code)}]: ${escapeTerminalText(diagnostic.message)}`,
    );
    const primaryLocation = location(diagnostic);
    if (primaryLocation !== null) lines.push(`  --> ${primaryLocation}`);
    if (diagnostic.pointer !== null)
      lines.push(`  field: ${escapeTerminalText(diagnostic.pointer)}`);
    for (const related of diagnostic.related) {
      lines.push(
        `  related: ${escapeTerminalText(related.span.sourceId)}:bytes ${related.span.start}..${related.span.end}: ${escapeTerminalText(related.message)}`,
      );
    }
    if (diagnostic.help !== null) lines.push(`  help: ${escapeTerminalText(diagnostic.help)}`);
  }
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}
