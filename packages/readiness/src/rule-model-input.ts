import { readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { Ajv2020, type AnySchemaObject, type ErrorObject } from "ajv/dist/2020.js";
import { printParseErrorCode, visit, type JSONPath } from "jsonc-parser";
import {
  RULE_MODEL_V1_LIMITS,
  type ModelBindingDiagnostic,
  type ModelBindingDiagnosticCode,
  type RuleModelInputLimits,
  type RuleModelRegistryInput,
  type RuleModelRegistryParseResult,
} from "./model-registry-model.js";

class ModelInputAbort extends Error {
  public constructor(public readonly diagnostic: ModelBindingDiagnostic) {
    super(diagnostic.message);
  }
}

function diagnostic(
  code: ModelBindingDiagnosticCode,
  path: string,
  message: string,
): ModelBindingDiagnostic {
  return { code, path, message };
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll("~", "~0").replaceAll("/", "~1");
}

function jsonPointer(path: JSONPath): string {
  return path.map((segment) => `/${escapePointerSegment(String(segment))}`).join("");
}

function decodeStrictUtf8(bytes: Uint8Array): string | ModelBindingDiagnostic {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return diagnostic("model.input.invalid-utf8", "", "Input is not valid UTF-8.");
  }
}

function inspectStructure(
  text: string,
  limits: RuleModelInputLimits,
): ModelBindingDiagnostic | undefined {
  const objectKeys: Set<string>[] = [];
  const arrayFrames: { count: number; readonly limit: number }[] = [];
  const containerKinds: ("array" | "object")[] = [];
  let depth = 0;

  const arrayLimit = (path: JSONPath): number =>
    path.at(-1) === "rules" ? limits.maxRules : limits.maxArrayItems;

  const countArrayItem = (path: JSONPath): void => {
    if (containerKinds.at(-1) !== "array") return;
    const frame = arrayFrames[arrayFrames.length - 1];
    frame.count += 1;
    if (frame.count > frame.limit) {
      throw new ModelInputAbort(
        diagnostic(
          "model.input.limit",
          jsonPointer(path),
          `Array contains more than ${frame.limit} items.`,
        ),
      );
    }
  };

  const beginContainer = (pathSupplier: () => JSONPath): JSONPath => {
    const path = pathSupplier();
    countArrayItem(path);
    depth += 1;
    if (depth > limits.maxDepth) {
      throw new ModelInputAbort(
        diagnostic(
          "model.input.limit",
          jsonPointer(path),
          `Input nesting exceeds ${limits.maxDepth}.`,
        ),
      );
    }
    return path;
  };

  const checkString = (value: string, path: JSONPath): void => {
    if (Buffer.byteLength(value, "utf8") > limits.maxStringBytes) {
      throw new ModelInputAbort(
        diagnostic(
          "model.input.limit",
          jsonPointer(path),
          `String exceeds ${limits.maxStringBytes} UTF-8 bytes.`,
        ),
      );
    }
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
            throw new ModelInputAbort(
              diagnostic(
                "model.input.invalid-json",
                jsonPointer(propertyPath),
                `Object property '${property}' occurs more than once.`,
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
          arrayFrames.push({ count: 0, limit: arrayLimit(path) });
        },
        onArrayEnd: () => {
          containerKinds.pop();
          arrayFrames.pop();
          depth -= 1;
        },
        onLiteralValue: (value: unknown, _offset, _length, _line, _column, pathSupplier) => {
          const path = pathSupplier();
          countArrayItem(path);
          if (typeof value === "string") {
            checkString(value, path);
          }
        },
        onComment: () => {
          throw new ModelInputAbort(
            diagnostic(
              "model.input.invalid-json",
              "",
              "Comments are not permitted in canonical rule-model JSON.",
            ),
          );
        },
        onError: (error) => {
          throw new ModelInputAbort(
            diagnostic(
              "model.input.invalid-json",
              "",
              `Invalid JSON: ${printParseErrorCode(error)}.`,
            ),
          );
        },
      },
      { allowTrailingComma: false, disallowComments: true },
    );
  } catch (error) {
    if (error instanceof ModelInputAbort) {
      return error.diagnostic;
    }
    throw error;
  }
  return undefined;
}

function isSchemaObject(value: unknown): value is AnySchemaObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadSchema(): AnySchemaObject {
  const schemaPath = new URL(
    "../../../readiness/schema/rule-models-v1.schema.json",
    import.meta.url,
  );
  const parsed: unknown = JSON.parse(readFileSync(schemaPath, "utf8"));
  if (!isSchemaObject(parsed)) {
    throw new TypeError("The rule-model schema must contain a JSON object.");
  }
  return parsed;
}

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  discriminator: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false,
});
const validateSchema = ajv.compile<RuleModelRegistryInput>(loadSchema());

function isRuleModelRegistryInput(value: unknown): value is RuleModelRegistryInput {
  return validateSchema(value) === true;
}

function errorPath(error: ErrorObject): string {
  if (error.keyword === "required") {
    return `${error.instancePath}/${escapePointerSegment(String(error.params.missingProperty))}`;
  }
  if (error.keyword === "additionalProperties") {
    return `${error.instancePath}/${escapePointerSegment(String(error.params.additionalProperty))}`;
  }
  if (error.keyword === "discriminator") {
    return `${error.instancePath}/state`;
  }
  return error.instancePath;
}

function schemaDiagnostics(): readonly ModelBindingDiagnostic[] {
  const seen = new Set<string>();
  const diagnostics: ModelBindingDiagnostic[] = [];
  for (const error of validateSchema.errors ?? []) {
    const path = errorPath(error);
    const key = `${path}\u0000${String(error.message)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push(
      diagnostic(
        "model.schema.invalid",
        path,
        `Invalid rule-model schema: ${String(error.message)}.`,
      ),
    );
  }
  return diagnostics.sort(
    (left, right) =>
      left.path.localeCompare(right.path) || left.message.localeCompare(right.message),
  );
}

/**
 * Parses bounded canonical rule-model JSON without extensions or duplicate keys.
 *
 * @param bytes Raw UTF-8 registry bytes.
 * @param limits Resource policy applied before materialization.
 * @returns A closed typed registry input or deterministic diagnostics.
 *
 * @example
 * ```ts
 * const result = parseRuleModelRegistry(
 *   new TextEncoder().encode('{"schemaVersion":1,"registryVersion":"models-v1","rules":[]}'),
 * );
 * ```
 */
export function parseRuleModelRegistry(
  bytes: Uint8Array,
  limits: RuleModelInputLimits = RULE_MODEL_V1_LIMITS,
): RuleModelRegistryParseResult {
  if (bytes.byteLength > limits.maxInputBytes) {
    return {
      ok: false,
      diagnostics: [
        diagnostic(
          "model.input.limit",
          "",
          `Input contains ${bytes.byteLength} bytes; maximum is ${limits.maxInputBytes}.`,
        ),
      ],
    };
  }

  const decoded = decodeStrictUtf8(bytes);
  if (typeof decoded !== "string") {
    return { ok: false, diagnostics: [decoded] };
  }

  const structuralFailure = inspectStructure(decoded, limits);
  if (structuralFailure !== undefined) {
    return { ok: false, diagnostics: [structuralFailure] };
  }

  const value: unknown = JSON.parse(decoded);
  if (!isRuleModelRegistryInput(value)) {
    return { ok: false, diagnostics: schemaDiagnostics() };
  }

  return { ok: true, input: value, diagnostics: [] };
}

export { validateRuleModelRegistry } from "./rule-model-validator.js";
