/**
 * The core character encoders: one Unicode code point → one platform byte.
 *
 * Encoders are core-resident (not platform-plugin-resident) so every consumer
 * — the compile path's const/typing engine and the future language server —
 * resolves string/char literals to byte-identical results. The platform
 * plugins' `encodeChar`/`encodeString` hooks delegate here.
 *
 * Every encoder is deliberately **fallible**: a code point outside the target
 * set returns `null` instead of leaking a wrong byte into the binary. Code
 * points above `$FF` can never fit a single byte, so they are unmappable in
 * every encoder. Full per-platform table fidelity (graphics characters,
 * shifted sets) is not modeled; the encodings cover the printable-ASCII
 * subset plus the control characters the escape set can produce.
 */

import type { CharEncoding } from "./platform-profile.js";

const LF = 0x0a;
const CR = 0x0d;
const TAB = 0x09;

/**
 * Encodes single Unicode code points into bytes of one target character set.
 */
export interface CharEncoder {
  /**
   * The profile encoding this encoder implements, for diagnostics. `"raw"`
   * is the no-profile default (byte-identical to the `"ascii"` encoder).
   */
  readonly name: CharEncoding | "raw";
  /**
   * Encode one code point to a single target byte, or `null` when the code
   * point has no representation in this encoding.
   */
  encodeCodePoint(cp: number): number | null;
}

/**
 * PETSCII (Commodore family). Uppercase/graphics mode: `A–Z`, digits, space,
 * and printable-ASCII punctuation keep their codes; `a–z` shift into the
 * `$C1–$DA` letter range. LF and CR both map to the PETSCII carriage return
 * `$0D`; TAB keeps `$09`. Anything outside printable ASCII is unmappable.
 */
function encodePetscii(cp: number): number | null {
  if (cp === LF || cp === CR) return 0x0d;
  if (cp === TAB) return 0x09;
  if (cp >= 0x61 && cp <= 0x7a) return cp + 0x60;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  return null;
}

/**
 * ATASCII (Atari 8-bit family). Printable ASCII maps identically except
 * `` ` `` `{` `}` `~`, which ATASCII does not contain. LF and CR both map to
 * the ATASCII end-of-line byte `$9B`. TAB is deliberately unmapped (`\xNN`
 * remains available for the raw control byte).
 */
function encodeAtascii(cp: number): number | null {
  if (cp === LF || cp === CR) return 0x9b;
  if (cp === 0x60 || cp === 0x7b || cp === 0x7d || cp === 0x7e) return null;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  return null;
}

/**
 * Plain ASCII: identity over printable ASCII `$20–$7E`, with LF/CR/TAB kept
 * as their ASCII control bytes. Everything else — including `$00–$1F`,
 * `$7F`, and all non-ASCII — is unmappable (raw bytes are expressible with
 * `\xNN` escapes instead).
 */
function encodeAscii(cp: number): number | null {
  if (cp === LF || cp === CR || cp === TAB) return cp;
  if (cp >= 0x20 && cp <= 0x7e) return cp;
  return null;
}

const PETSCII_ENCODER: CharEncoder = { name: "petscii", encodeCodePoint: encodePetscii };
const ATASCII_ENCODER: CharEncoder = { name: "atascii", encodeCodePoint: encodeAtascii };
const ASCII_ENCODER: CharEncoder = { name: "ascii", encodeCodePoint: encodeAscii };
/** The no-profile default: byte-identical to ASCII, named distinctly. */
const RAW_ENCODER: CharEncoder = { name: "raw", encodeCodePoint: encodeAscii };

/**
 * Returns the encoder for a profile encoding. An `undefined` profile encoding
 * (no target profile, or a profile without `defaultEncoding`) selects the raw
 * encoder — deterministic ASCII-identity bytes.
 *
 * @param encoding The profile's `defaultEncoding`, or `undefined` for raw.
 * @returns The encoder implementing that encoding.
 */
export function encoderFor(encoding: CharEncoding | undefined): CharEncoder {
  switch (encoding) {
    case "petscii":
      return PETSCII_ENCODER;
    case "atascii":
      return ATASCII_ENCODER;
    case "ascii":
      return ASCII_ENCODER;
    case undefined:
      return RAW_ENCODER;
  }
}
