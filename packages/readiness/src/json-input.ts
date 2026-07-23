import { printParseErrorCode, visit, type JSONPath } from "jsonc-parser";
import { Buffer } from "node:buffer";
import { createDiagnostic } from "./diagnostics.js";
import type { InventoryLimits } from "./limits.js";
import type { InventoryDiagnostic, ParsedInventoryResult } from "./model.js";

class InputAbort extends Error {
  public constructor(public readonly diagnostic: InventoryDiagnostic) {
    super(diagnostic.message);
  }
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function jsonPointer(path: JSONPath): string {
  return path.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function fail(diagnostic: InventoryDiagnostic): ParsedInventoryResult {
  return {
    ok: false,
    diagnostics: [diagnostic],
    inventory: undefined,
    blockingReasons: [],
  };
}

function inputDiagnostic(
  code: string,
  path: string,
  message: string,
  line?: number,
  column?: number,
): InventoryDiagnostic {
  return createDiagnostic({
    phase: "input",
    code,
    path,
    message,
    ...(line === undefined || column === undefined
      ? {}
      : { location: { line: line + 1, column: column + 1 } }),
  });
}

function decodeStrictUtf8(bytes: Uint8Array): string | InventoryDiagnostic {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return inputDiagnostic("input.invalid-utf8", "", "Input is not valid UTF-8.");
  }
}

function inspectStructure(text: string, limits: InventoryLimits): InventoryDiagnostic | undefined {
  const objectKeys: Set<string>[] = [];
  const arrayFrames: { readonly path: JSONPath; count: number; readonly limit: number }[] = [];
  const containerKinds: ("array" | "object")[] = [];
  let depth = 0;

  const arrayLimit = (path: JSONPath): number => {
    const field = path.at(-1);
    if (field === "normativeSources") return limits.maxSources;
    if (field === "sections") return limits.maxSectionsPerSource;
    if (field === "clauseLedger") return limits.maxFragments;
    if (field === "rules") return limits.maxRules;
    if (field === "prerequisiteRuleIds" || field === "relatedRuleIds") {
      return limits.maxRelationshipsPerRule;
    }
    return limits.maxArrayItems;
  };

  const countArrayItem = (path: JSONPath, line: number, column: number): void => {
    if (containerKinds.at(-1) !== "array") return;
    const frame = arrayFrames[arrayFrames.length - 1];
    frame.count += 1;
    if (frame.count > frame.limit) {
      throw new InputAbort(
        inputDiagnostic(
          "input.array-limit",
          jsonPointer(path),
          `Array contains more than ${frame.limit} items.`,
          line,
          column,
        ),
      );
    }
  };

  const beginContainer = (pathSupplier: () => JSONPath, line: number, column: number): JSONPath => {
    const path = pathSupplier();
    countArrayItem(path, line, column);
    depth += 1;
    if (depth > limits.maxDepth) {
      throw new InputAbort(
        inputDiagnostic(
          "input.depth-limit",
          jsonPointer(path),
          `Input nesting exceeds ${limits.maxDepth}.`,
          line,
          column,
        ),
      );
    }
    return path;
  };

  try {
    visit(
      text,
      {
        onObjectBegin: (_offset, _length, line, column, pathSupplier) => {
          beginContainer(pathSupplier, line, column);
          containerKinds.push("object");
          objectKeys.push(new Set<string>());
        },
        onObjectProperty: (property, _offset, _length, line, column, pathSupplier) => {
          const propertyPath = [...pathSupplier(), property];
          if (Buffer.byteLength(property, "utf8") > limits.maxStringBytes) {
            throw new InputAbort(
              inputDiagnostic(
                "input.string-limit",
                jsonPointer(propertyPath),
                `String exceeds ${limits.maxStringBytes} UTF-8 bytes.`,
                line,
                column,
              ),
            );
          }
          const keys = objectKeys.at(-1);
          if (keys?.has(property) === true) {
            throw new InputAbort(
              inputDiagnostic(
                "input.duplicate-key",
                jsonPointer(propertyPath),
                `Object property '${property}' occurs more than once.`,
                line,
                column,
              ),
            );
          }
          keys?.add(property);
        },
        onObjectEnd: () => {
          containerKinds.pop();
          objectKeys.pop();
          depth -= 1;
        },
        onArrayBegin: (_offset, _length, line, column, pathSupplier) => {
          const path = beginContainer(pathSupplier, line, column);
          containerKinds.push("array");
          arrayFrames.push({ path, count: 0, limit: arrayLimit(path) });
        },
        onArrayEnd: () => {
          containerKinds.pop();
          arrayFrames.pop();
          depth -= 1;
        },
        onLiteralValue: (value: unknown, _offset, _length, line, column, pathSupplier) => {
          const path = pathSupplier();
          countArrayItem(path, line, column);
          if (
            typeof value === "string" &&
            Buffer.byteLength(value, "utf8") > limits.maxStringBytes
          ) {
            throw new InputAbort(
              inputDiagnostic(
                "input.string-limit",
                jsonPointer(path),
                `String exceeds ${limits.maxStringBytes} UTF-8 bytes.`,
                line,
                column,
              ),
            );
          }
        },
        onComment: (_offset, _length, line, column) => {
          throw new InputAbort(
            inputDiagnostic(
              "input.comment",
              "",
              "Comments are not permitted in authoritative JSON.",
              line,
              column,
            ),
          );
        },
        onError: (error, _offset, _length, line, column) => {
          throw new InputAbort(
            inputDiagnostic(
              "input.invalid-json",
              "",
              `Invalid JSON: ${printParseErrorCode(error)}.`,
              line,
              column,
            ),
          );
        },
      },
      { allowTrailingComma: false, disallowComments: true },
    );
  } catch (error) {
    if (error instanceof InputAbort) {
      return error.diagnostic;
    }
    throw error;
  }
  return undefined;
}

/**
 * Parses authoritative inventory bytes without accepting JSON extensions or duplicate keys.
 *
 * @param bytes Raw UTF-8 inventory bytes.
 * @param limits Resource limits applied before materialization.
 * @returns Either the parsed unknown value or one deterministic input diagnostic.
 *
 * @example
 * ```ts
 * const result = parseInventoryJson(new TextEncoder().encode('{"schemaVersion":1}'), limits);
 * ```
 */
export function parseInventoryJson(
  bytes: Uint8Array,
  limits: InventoryLimits,
): ParsedInventoryResult {
  if (bytes.byteLength > limits.maxInputBytes) {
    return fail(
      inputDiagnostic(
        "input.byte-limit",
        "",
        `Input contains ${bytes.byteLength} bytes; maximum is ${limits.maxInputBytes}.`,
      ),
    );
  }

  const decoded = decodeStrictUtf8(bytes);
  if (typeof decoded !== "string") {
    return fail(decoded);
  }

  const structuralFailure = inspectStructure(decoded, limits);
  if (structuralFailure !== undefined) {
    return fail(structuralFailure);
  }

  // The strict visitor has already consumed the complete document without a parse error.
  const inventory: unknown = JSON.parse(decoded);

  return {
    ok: true,
    diagnostics: [],
    inventory,
    blockingReasons: [],
  };
}
