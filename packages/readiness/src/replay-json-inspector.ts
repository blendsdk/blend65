import { Buffer } from "node:buffer";

import { printParseErrorCode, visit, type JSONPath } from "jsonc-parser";

import {
  replayDiagnostic,
  type ReplayDiagnostic,
  type ReplayInputLimits,
} from "./replay-input-model.js";

class ReplayInputAbort extends Error {
  public constructor(public readonly diagnostic: ReplayDiagnostic) {
    super(diagnostic.message);
  }
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function jsonPointer(path: JSONPath): string {
  return path.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function arrayLimit(path: JSONPath, limits: ReplayInputLimits): number {
  switch (path.at(-1)) {
    case "enabledRuleIds":
      return limits.maxRuleIds;
    case "generationPath":
      return limits.maxPathComponents;
    case "spellings":
      return limits.maxSpellings;
    default:
      return limits.maxValues;
  }
}

/**
 * Inspects replay JSON syntax, duplicates, nesting and aggregate values before materialization.
 *
 * @param text Strict UTF-8 replay JSON.
 * @param limits Fixed version-one resource policy.
 * @returns The first deterministic structural failure, or `undefined`.
 *
 * @example
 * ```ts
 * const problem = inspectReplayJson('{"schemaVersion":1}', REPLAY_V1_LIMITS);
 * ```
 */
export function inspectReplayJson(
  text: string,
  limits: ReplayInputLimits,
): ReplayDiagnostic | undefined {
  const objectKeys: Set<string>[] = [];
  const arrayFrames: { count: number; readonly limit: number }[] = [];
  const containerKinds: ("array" | "object")[] = [];
  let depth = 0;
  let values = 0;

  const countValue = (path: JSONPath): void => {
    values += 1;
    if (values > limits.maxValues) {
      throw new ReplayInputAbort(
        replayDiagnostic(
          "replay.input.limit",
          jsonPointer(path),
          `Replay input contains more than ${limits.maxValues} values.`,
        ),
      );
    }
    if (containerKinds.at(-1) !== "array") return;
    const frame = arrayFrames.at(-1);
    if (frame === undefined) return;
    frame.count += 1;
    if (frame.count > frame.limit) {
      throw new ReplayInputAbort(
        replayDiagnostic(
          "replay.input.limit",
          jsonPointer(path.slice(0, -1)),
          `Replay array contains more than ${frame.limit} entries.`,
        ),
      );
    }
  };

  const checkString = (value: string, path: JSONPath): void => {
    if (Buffer.byteLength(value, "utf8") > limits.maxStringBytes) {
      throw new ReplayInputAbort(
        replayDiagnostic(
          "replay.input.limit",
          jsonPointer(path),
          `Replay string exceeds ${limits.maxStringBytes} UTF-8 bytes.`,
        ),
      );
    }
  };

  const beginContainer = (pathSupplier: () => JSONPath): JSONPath => {
    const path = pathSupplier();
    countValue(path);
    depth += 1;
    if (depth > limits.maxDepth) {
      throw new ReplayInputAbort(
        replayDiagnostic(
          "replay.input.limit",
          jsonPointer(path),
          `Replay nesting exceeds ${limits.maxDepth}.`,
        ),
      );
    }
    return path;
  };

  try {
    visit(
      text,
      {
        onObjectBegin: (_offset, _length, _line, _column, pathSupplier) => {
          beginContainer(pathSupplier);
          containerKinds.push("object");
          objectKeys.push(new Set<string>());
        },
        onObjectProperty: (property, _offset, _length, _line, _column, pathSupplier) => {
          const propertyPath = [...pathSupplier(), property];
          checkString(property, propertyPath);
          const keys = objectKeys.at(-1);
          if (keys?.has(property) === true) {
            throw new ReplayInputAbort(
              replayDiagnostic(
                "replay.schema.invalid",
                jsonPointer(propertyPath),
                `Replay property '${property}' occurs more than once.`,
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
        onArrayBegin: (_offset, _length, _line, _column, pathSupplier) => {
          const path = beginContainer(pathSupplier);
          containerKinds.push("array");
          arrayFrames.push({ count: 0, limit: arrayLimit(path, limits) });
        },
        onArrayEnd: () => {
          containerKinds.pop();
          arrayFrames.pop();
          depth -= 1;
        },
        onLiteralValue: (value: unknown, _offset, _length, _line, _column, pathSupplier) => {
          const path = pathSupplier();
          countValue(path);
          if (typeof value === "string") checkString(value, path);
        },
        onComment: () => {
          throw new ReplayInputAbort(
            replayDiagnostic(
              "replay.input.invalid-json",
              "",
              "Replay JSON must not contain comments.",
            ),
          );
        },
        onError: (error) => {
          throw new ReplayInputAbort(
            replayDiagnostic(
              "replay.input.invalid-json",
              "",
              `Invalid replay JSON: ${printParseErrorCode(error)}.`,
            ),
          );
        },
      },
      { allowTrailingComma: false, disallowComments: true },
    );
  } catch (error) {
    if (error instanceof ReplayInputAbort) return error.diagnostic;
    throw error;
  }
  return undefined;
}
