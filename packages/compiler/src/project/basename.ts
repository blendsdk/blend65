import { firstUnpairedSurrogate } from "./positions.js";
import { RESULT_KIND } from "./types.js";
import type { NameValidationResult } from "./types.js";

/**
 * Check whether a project basename can be preserved literally on Linux and Windows.
 * This is a lexical safety floor, not a filesystem operation or a length limit.
 * The first failed predicate and its original spelling are returned; no repair,
 * trimming, case folding or Unicode normalization is applied to the name.
 * @example validateProjectName("Game Ω 1.2") // { kind: "success" }
 * @example validateProjectName("Bad/Name") // failure with offending "/"
 */
export function validateProjectName(name: string): NameValidationResult {
  if (name.length === 0) return failure("empty", null);
  const surrogate = firstUnpairedSurrogate(name);
  if (surrogate !== null) return failure("ill-formed-unicode", surrogate);
  for (const scalar of name) {
    if (scalar.codePointAt(0)! <= 0x1f || '<>:"/\\|?*'.includes(scalar)) {
      return failure("forbidden-character", scalar);
    }
  }
  if (name === "." || name === "..") return failure("dot-name", name);
  const final = name[name.length - 1]!;
  if (final === " " || final === ".") return failure("trailing-character", final);
  const stem = name.split(".", 1)[0]!;
  // Only ASCII casing belongs to the device predicate; Unicode spelling stays literal.
  const folded = stem.replace(/[a-z]/g, (letter) => letter.toUpperCase());
  if (/^(?:CON|PRN|AUX|NUL|(?:COM|LPT)[1-9¹²³])$/.test(folded)) {
    return failure("reserved-device-stem", stem);
  }
  return Object.freeze({ kind: RESULT_KIND.success });
}

/** Preserve a failed predicate's original offending text without suggesting a replacement. */
function failure(
  reason: Extract<NameValidationResult, { kind: "failure" }>["reason"],
  offending: string | null,
): NameValidationResult {
  return Object.freeze({ kind: RESULT_KIND.failure, reason, offending });
}
