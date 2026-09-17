import type { ProjectDiagnostic, SourceSpan } from "@blend65/compiler";

/** Escape native names and diagnostic insertions without sending terminal controls. */
export function escapeTerminalText(text: string): string {
  return text.replace(
    /[\u0000-\u001f\u007f-\u009f]/gu,
    (character) => "U+" + character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0"),
  );
}

/** Quoted display names are escaped, never rewritten in project input or identity. */
export function displayProjectName(name: string): string {
  return escapeTerminalText(name).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** A failed load has no trusted source text, so report exact byte spans instead of guessed lines. */
function location(span: SourceSpan): string {
  return `${escapeTerminalText(span.sourceId)}:bytes ${span.start}..${span.end}`;
}

/**
 * Render shared service records in their existing deterministic order.
 * No additional file read, validator or source excerpt is needed. Byte locations
 * are labelled explicitly; converting to line/UTF-16 coordinates would require
 * the trusted input text, which a failed load deliberately does not expose.
 * @param diagnostics Shared errors or successful-load observations.
 * @returns Safe terminal text with relative proving locations and known help.
 */
export function renderDiagnostics(diagnostics: readonly ProjectDiagnostic[]): string {
  const lines: string[] = [];
  for (const diagnostic of diagnostics) {
    lines.push(
      `${diagnostic.severity}[${diagnostic.code}]: ${escapeTerminalText(diagnostic.message)}`,
    );
    if (diagnostic.primarySpan !== null) lines.push(`  --> ${location(diagnostic.primarySpan)}`);
    if (diagnostic.pointer !== null)
      lines.push(`  field: ${escapeTerminalText(diagnostic.pointer)}`);
    for (const related of diagnostic.related) {
      lines.push(`  related: ${location(related.span)}: ${escapeTerminalText(related.message)}`);
    }
    if (diagnostic.help !== null) lines.push(`  help: ${escapeTerminalText(diagnostic.help)}`);
  }
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}
