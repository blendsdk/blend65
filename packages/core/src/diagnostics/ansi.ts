/**
 * Internal hand-rolled SGR (ANSI color) helpers for the terminal renderer.
 *
 * Deliberately minimal and NOT exported from the diagnostics barrel: core keeps
 * zero runtime dependencies (no chalk in core; chalk stays CLI-only), and no
 * other module needs color. Provides the raw SGR codes used by the terminal
 * renderer's color map.
 */

/** SGR parameter: bold. */
export const BOLD = 1;
/** SGR parameter: red foreground (error severity). */
export const RED = 31;
/** SGR parameter: yellow foreground (warning severity). */
export const YELLOW = 33;
/** SGR parameter: cyan foreground (gutter elements). */
export const CYAN = 36;
/** The SGR reset sequence terminating every painted run. */
export const RESET = "\u001b[0m";

/**
 * Wraps `text` in an SGR sequence applying `codes`, followed by a reset.
 *
 * @param text The text to colorize.
 * @param codes SGR parameter codes (e.g. `BOLD, RED`); with none, returns
 *   `text` unchanged so call sites can pass a conditional empty list.
 * @returns The painted string, e.g. `\u001b[1;31mtext\u001b[0m`.
 */
export function paint(text: string, ...codes: number[]): string {
  if (codes.length === 0) {
    return text;
  }
  return `\u001b[${codes.join(";")}m${text}${RESET}`;
}
