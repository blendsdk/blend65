/**
 * Tolerant JSONC parsing for `blend65.json`.
 *
 * Wraps `jsonc-parser` so the rest of the package never sees its API
 * directly: one call yields the recovered value (best-effort), the parse
 * tree for per-key spans, and every parse error with its offset already
 * converted from a UTF-16 code-unit string index to the UTF-8 BYTE offset
 * `SourceSpan` requires.
 */

import { Buffer } from "node:buffer";
import {
  parse,
  parseTree,
  printParseErrorCode,
  type Node,
  type ParseError,
  type ParseOptions,
} from "jsonc-parser";

/** Tolerance: comments and trailing commas are legal in blend65.json. */
const JSONC_OPTIONS: ParseOptions = {
  allowTrailingComma: true,
  disallowComments: false,
};

/**
 * Result of {@link parseJsoncFile}: parse errors and the recovered parse
 * tree. `parseErrors` offsets/lengths are UTF-8 byte quantities (already
 * converted). `tree` is jsonc-parser's Node root (`undefined` when nothing
 * was recoverable); its node offsets remain raw code-unit offsets —
 * consumers convert them via {@link createOffsetConverter}.
 */
export interface JsoncParseResult {
  /** The recovered JavaScript value (best-effort on malformed input). */
  readonly value: unknown;
  /** jsonc-parser Node root — per-key spans for validation. */
  readonly tree: Node | undefined;
  /** All parse errors, offsets/lengths in UTF-8 bytes. */
  readonly parseErrors: readonly { offset: number; length: number; message: string }[];
  /**
   * The text every offset in this result (and in `tree`) refers to: the
   * input with a leading UTF-8 BOM stripped. Consumers building spans or
   * LineMaps MUST use this string, not their original input.
   */
  readonly text: string;
}

/**
 * Builds a UTF-16 code-unit offset → UTF-8 byte offset converter for `text`,
 * with an identity fast path when `text` is pure ASCII. Config files are
 * small, so the non-ASCII path's per-call prefix re-encode is deliberate
 * simplicity over a prefix-sum table.
 *
 * @param text The exact string the offsets index into.
 * @returns Converter mapping a code-unit offset to its byte offset.
 */
export function createOffsetConverter(text: string): (cuOffset: number) => number {
  if (!/[\u0080-\uffff]/.test(text)) {
    return (cuOffset) => cuOffset; // pure ASCII: code units ARE bytes
  }
  return (cuOffset) => Buffer.byteLength(text.slice(0, cuOffset), "utf8");
}

/**
 * Parses `text` as JSONC (comments + trailing commas tolerated), returning
 * the recovered value, the parse tree, and byte-offset parse errors. Never
 * throws: malformed input degrades to a partial value plus `parseErrors`
 * entries (best-effort recovery).
 *
 * @param rawText UTF-8 file content as a JavaScript string (BOM tolerated).
 * @returns See {@link JsoncParseResult}.
 */
export function parseJsoncFile(rawText: string): JsoncParseResult {
  // Strip a leading UTF-8 BOM: jsonc-parser would otherwise report it as an
  // InvalidSymbol parse error, turning every BOM'd config file into a
  // spurious E10241. All returned offsets refer to the stripped text.
  const text = rawText.startsWith("\uFEFF") ? rawText.slice(1) : rawText;
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, JSONC_OPTIONS);
  const tree = parseTree(text, undefined, JSONC_OPTIONS);
  const toByteOffset = createOffsetConverter(text);
  const parseErrors = errors.map((error) => {
    const startByte = toByteOffset(error.offset);
    const endByte = toByteOffset(error.offset + error.length);
    return {
      offset: startByte,
      length: endByte - startByte,
      message: printParseErrorCode(error.error),
    };
  });
  return { value, tree, parseErrors, text };
}
