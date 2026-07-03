/**
 * RD-09 VICE label-file parser — `parseLabelFile`
 * (`plans/rd-09-acme-emitter/03-02-acme-process-layer.md`, R45–R47; §4.6, AR-67).
 *
 * ACME's `--vicelabels` output is a VICE-format symbol file: one line per
 * symbol, `al C:xxxx .label_name`, where `C:` is the VICE "compute" address-space
 * prefix and `xxxx` is the 4-digit hex address. (ACME's `-l`/`--symbollist`, by
 * contrast, writes a native `<name> = $<addr>` format this parser cannot read —
 * DEF-2/AR-H7, why `invokeAcme` uses `--vicelabels`.) This parser turns that text into a
 * `Map<string, number>` (symbol → address) used downstream by the resource report
 * (RD-11) and the test harness's `runUntilLabel` (RD-12).
 *
 * Robustness (R47): any line that does not match the expected shape — a blank
 * line, a comment, or output from an unexpected ACME version — is silently
 * skipped rather than failing the build. Parsing is therefore total: it never
 * throws and always returns a (possibly empty) map.
 *
 * Pure text→data transformation, no I/O. Lives in `@blend65/compiler` (the
 * integration layer; R15/AR-20).
 */

/**
 * A single VICE label line: `al C:xxxx .name`.
 *
 * - `al` — VICE "add label" directive.
 * - `C:` — the "compute" memory-space prefix.
 * - `([0-9a-fA-F]{4})` — the 4-digit hex address (captured).
 * - `\.(.+)` — the dot-prefixed label name (captured, trimmed below).
 */
const LABEL_LINE = /^al\s+C:([0-9a-fA-F]{4})\s+\.(.+)$/;

/**
 * Parse a VICE label file into a symbol→address map (R45–R47).
 *
 * @param content The raw label-file text (as produced by ACME's `--vicelabels` output).
 * @returns A map from label name to its absolute address. Unparseable lines are
 *   skipped (R47); empty input yields an empty map.
 */
export function parseLabelFile(content: string): Map<string, number> {
  const symbols = new Map<string, number>();
  for (const line of content.split("\n")) {
    const match = LABEL_LINE.exec(line.trim());
    if (match === null) {
      // Blank line, comment, or unexpected format — skip (R47), do not throw.
      continue;
    }
    const address = parseInt(match[1], 16);
    const name = match[2].trim();
    symbols.set(name, address);
  }
  return symbols;
}
