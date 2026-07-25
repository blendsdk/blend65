import { Buffer } from "node:buffer";

import { printParseErrorCode, visit, type JSONPath } from "jsonc-parser";

/** Stable structural failure from bounded strict JSON parsing. */
export interface StrictJsonProblem {
  /** RFC 6901 path where validation stopped. */
  readonly path: string;
  /** Bounded explanation suitable for a higher-level diagnostic. */
  readonly message: string;
}

/** Result of parsing one strict JSON data value. */
export type StrictJsonResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly problem: StrictJsonProblem };

class StrictJsonAbort extends Error {
  public constructor(public readonly problem: StrictJsonProblem) {
    super(problem.message);
  }
}

const MAX_DEPTH = 32;
const MAX_VALUES = 262_144;
const MAX_STRING_BYTES = 65_536;

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function pointer(path: JSONPath): string {
  return path.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function abort(path: JSONPath, message: string): never {
  throw new StrictJsonAbort({ path: pointer(path), message });
}

/**
 * Parses bounded UTF-8 JSON while rejecting comments, trailing commas, and duplicate keys.
 *
 * @param bytes Raw JSON bytes already constrained by the caller's artifact byte limit.
 * @returns The parsed data value or the first stable structural failure.
 */
export function parseStrictJson(bytes: Uint8Array): StrictJsonResult {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, problem: { path: "", message: "Input is not valid UTF-8." } };
  }

  const objectKeys: Set<string>[] = [];
  let depth = 0;
  let values = 0;
  try {
    visit(
      text,
      {
        onObjectBegin: (_offset, _length, _line, _column, pathSupplier) => {
          values += 1;
          depth += 1;
          if (values > MAX_VALUES) abort(pathSupplier(), "JSON value limit exceeded.");
          if (depth > MAX_DEPTH) abort(pathSupplier(), "JSON nesting limit exceeded.");
          objectKeys.push(new Set());
        },
        onObjectProperty: (property, _offset, _length, _line, _column, pathSupplier) => {
          if (Buffer.byteLength(property, "utf8") > MAX_STRING_BYTES) {
            abort([...pathSupplier(), property], "JSON property exceeds the string byte limit.");
          }
          const keys = objectKeys.at(-1);
          if (keys?.has(property) === true) {
            abort([...pathSupplier(), property], "JSON object property occurs more than once.");
          }
          keys?.add(property);
        },
        onObjectEnd: () => {
          objectKeys.pop();
          depth -= 1;
        },
        onArrayBegin: (_offset, _length, _line, _column, pathSupplier) => {
          values += 1;
          depth += 1;
          if (values > MAX_VALUES) abort(pathSupplier(), "JSON value limit exceeded.");
          if (depth > MAX_DEPTH) abort(pathSupplier(), "JSON nesting limit exceeded.");
        },
        onArrayEnd: () => {
          depth -= 1;
        },
        onLiteralValue: (value: unknown, _offset, _length, _line, _column, pathSupplier) => {
          values += 1;
          if (values > MAX_VALUES) abort(pathSupplier(), "JSON value limit exceeded.");
          if (typeof value === "string" && Buffer.byteLength(value, "utf8") > MAX_STRING_BYTES) {
            abort(pathSupplier(), "JSON string exceeds the byte limit.");
          }
        },
        onComment: (_offset, _length, _line, _column) => {
          abort([], "JSON comments are not permitted.");
        },
        onError: (error) => {
          abort([], `Invalid JSON: ${printParseErrorCode(error)}.`);
        },
      },
      { allowTrailingComma: false, disallowComments: true },
    );
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch (error) {
    return error instanceof StrictJsonAbort
      ? { ok: false, problem: error.problem }
      : { ok: false, problem: { path: "", message: "JSON could not be parsed safely." } };
  }
}
