/**
 * Zero-dependency color resolution + local SGR accent helpers for `blendc`
 * (RD-15 R35/R37, AR-V2/V16 — amends requirements AR-17).
 *
 * The CLI owns color detection because core's `renderTerminal` takes an explicit
 * `{ color: boolean }`; {@link resolveColor} computes that one boolean, and the
 * helpers below paint the CLI's own accents (the count trailer's severity word).
 * No chalk. SGR codes mirror `core/src/diagnostics/ansi.ts` (AR-Q9).
 */

/** The SGR reset sequence terminating every painted run. */
const RESET = "[0m";
/** SGR: bold. */
const BOLD = 1;
/** SGR: red foreground (error severity). */
const RED = 31;
/** SGR: yellow foreground (warning severity). */
const YELLOW = 33;

/**
 * Resolve whether to emit color (AR-V16 precedence):
 * explicit `--color` forces ON > explicit `--no-color` forces OFF > `NO_COLOR`
 * env (any value) OFF > `isTTY` decides > otherwise OFF.
 *
 * @param flag The `--color`/`--no-color` value (`undefined` when not passed).
 * @param env The process environment (checked for `NO_COLOR`).
 * @param isTTY Whether stdout is a TTY.
 * @returns `true` when color should be emitted.
 */
export function resolveColor(
  flag: boolean | undefined,
  env: Record<string, string | undefined>,
  isTTY: boolean,
): boolean {
  if (flag !== undefined) {
    return flag;
  }
  if (env.NO_COLOR !== undefined) {
    return false;
  }
  return isTTY;
}

/** Wrap `text` in an SGR sequence applying `codes`, or return it unchanged. */
function paint(text: string, codes: number[]): string {
  return codes.length === 0 ? text : `[${codes.join(";")}m${text}${RESET}`;
}

/**
 * Paint the trailer's error severity word bold red when color is on (AR-Q9).
 *
 * @param text The word to paint (e.g. `"error"`).
 * @param color Whether color is enabled.
 * @returns The (possibly) painted text.
 */
export function errorAccent(text: string, color: boolean): string {
  return paint(text, color ? [BOLD, RED] : []);
}

/**
 * Paint the trailer's warning severity word bold yellow when color is on (AR-Q9).
 *
 * @param text The word to paint (e.g. `"warning"`).
 * @param color Whether color is enabled.
 * @returns The (possibly) painted text.
 */
export function warningAccent(text: string, color: boolean): string {
  return paint(text, color ? [BOLD, YELLOW] : []);
}
