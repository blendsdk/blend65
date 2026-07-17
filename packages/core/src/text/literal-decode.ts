/**
 * The literal escape decoder: raw inter-quote text → encodable segments.
 *
 * The lexer validates escapes but does not decode them — a string token's
 * value is the raw text between the quotes. This module turns that raw text
 * into a segment list that separates the two byte-production paths:
 *
 * - `codePoint` segments resolve through a {@link CharEncoder} — plain
 *   characters and the character escapes (`\n` `\r` `\t` `\"` `\'`), whose
 *   byte value depends on the target encoding.
 * - `rawByte` segments bypass any encoder — `\xNN`, `\0`, and `\\` (pinned
 *   to the backslash byte `$5C`) mean those exact bytes on every platform.
 *
 * Iteration is by code point, never UTF-16 unit, so an astral character
 * yields one (unmappable) code point rather than two surrogate halves.
 */

/** One decoded piece of a string/char literal. */
export type LiteralSegment =
  /** A Unicode code point that resolves through the target encoder. */
  | { readonly kind: "codePoint"; readonly cp: number }
  /** An exact byte value that bypasses the encoder. */
  | { readonly kind: "rawByte"; readonly value: number };

/**
 * Decodes raw inter-quote literal text into segments. Pure; never throws.
 * The lexer has already validated the escape set, so unknown or truncated
 * escapes cannot reach here; the defensive fallbacks below keep the function
 * total anyway.
 *
 * @param raw The literal's raw inter-quote text (escapes undecoded).
 * @returns The decoded segment list, in source order.
 */
export function decodeLiteral(raw: string): LiteralSegment[] {
  const segments: LiteralSegment[] = [];
  let i = 0;
  while (i < raw.length) {
    if (raw[i] === "\\") {
      const marker = raw[i + 1];
      switch (marker) {
        case "x": {
          const value = Number.parseInt(raw.slice(i + 2, i + 4), 16);
          segments.push({ kind: "rawByte", value: Number.isNaN(value) ? 0 : value });
          i += 4;
          continue;
        }
        case "0":
          segments.push({ kind: "rawByte", value: 0x00 });
          i += 2;
          continue;
        case "\\":
          segments.push({ kind: "rawByte", value: 0x5c });
          i += 2;
          continue;
        case "n":
          segments.push({ kind: "codePoint", cp: 0x0a });
          i += 2;
          continue;
        case "r":
          segments.push({ kind: "codePoint", cp: 0x0d });
          i += 2;
          continue;
        case "t":
          segments.push({ kind: "codePoint", cp: 0x09 });
          i += 2;
          continue;
        case '"':
          segments.push({ kind: "codePoint", cp: 0x22 });
          i += 2;
          continue;
        case "'":
          segments.push({ kind: "codePoint", cp: 0x27 });
          i += 2;
          continue;
        case undefined:
          // A trailing lone backslash — lexer-unreachable; keep the byte.
          segments.push({ kind: "rawByte", value: 0x5c });
          i += 1;
          continue;
        default:
          // An unknown escape — lexer-unreachable; fall through to emit the
          // escaped character itself as a plain code point.
          i += 1;
          continue;
      }
    }
    const cp = raw.codePointAt(i);
    if (cp === undefined) break;
    segments.push({ kind: "codePoint", cp });
    i += cp > 0xffff ? 2 : 1;
  }
  return segments;
}
