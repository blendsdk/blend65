import { readFailureEnvelopeDataPropertyV1 } from "./failure-envelope-codec.js";
import { validateGeneratorIrSyntax } from "./generator-ir-validator.js";
import { readExecutionRecord } from "./execution-validation.js";

import type { GenExpression } from "./generator-ir.js";
import type { InvalidSourceTransform } from "./modeled-generator-model.js";

function decodeExpression(input: unknown): GenExpression | undefined {
  const fallbackType = readFailureEnvelopeDataPropertyV1(input, "type");
  const module = validateGeneratorIrSyntax({
    kind: "module",
    path: ["History"],
    constants: [{ kind: "const", name: "value", type: fallbackType, value: input }],
    functions: [],
  });
  return module.ok ? module.module.constants[0]?.value : undefined;
}

/**
 * Decodes one closed invalid-source transform from canonical historical data.
 *
 * Every path and scalar is validated before a fresh immutable value is returned. This prevents a
 * historical record from smuggling prototype state or a future transform arm into replay.
 */
export function decodeHistoricalInvalidTransformV1(
  input: unknown,
): InvalidSourceTransform | undefined {
  const kind = readExecutionRecord(input, ["kind", "callPath", "argumentIndex"]);
  if (
    kind !== undefined &&
    kind.kind === "intrinsic-argument-remove" &&
    typeof kind.callPath === "string" &&
    /^\/(?:[A-Za-z0-9~_-]+\/)*[A-Za-z0-9~_-]+$/u.test(kind.callPath) &&
    typeof kind.argumentIndex === "number" &&
    Number.isSafeInteger(kind.argumentIndex) &&
    kind.argumentIndex >= 0
  ) {
    return Object.freeze({
      kind: "intrinsic-argument-remove",
      callPath: kind.callPath,
      argumentIndex: kind.argumentIndex,
    });
  }
  const argument = readExecutionRecord(input, ["kind", "callPath", "argumentIndex", "argument"]);
  if (
    argument !== undefined &&
    (argument.kind === "intrinsic-argument-insert" ||
      argument.kind === "intrinsic-argument-replace") &&
    typeof argument.callPath === "string" &&
    /^\/(?:[A-Za-z0-9~_-]+\/)*[A-Za-z0-9~_-]+$/u.test(argument.callPath) &&
    typeof argument.argumentIndex === "number" &&
    Number.isSafeInteger(argument.argumentIndex) &&
    argument.argumentIndex >= 0
  ) {
    const normalized = decodeExpression(argument.argument);
    if (normalized === undefined) return undefined;
    return Object.freeze({
      kind: argument.kind,
      callPath: argument.callPath,
      argumentIndex: argument.argumentIndex,
      argument: normalized,
    });
  }
  const scalar = readExecutionRecord(input, ["kind", "expressionPath", "replacement"]);
  const scalarReplacement =
    scalar === undefined ? undefined : readExecutionRecord(scalar.replacement, ["kind", "value"]);
  if (
    scalar !== undefined &&
    scalar.kind === "scalar-expression-replace" &&
    typeof scalar.expressionPath === "string" &&
    /^\/(?:[A-Za-z0-9~_-]+\/)*[A-Za-z0-9~_-]+$/u.test(scalar.expressionPath) &&
    scalarReplacement?.kind === "integer-literal" &&
    typeof scalarReplacement.value === "bigint"
  ) {
    return Object.freeze({
      kind: "scalar-expression-replace",
      expressionPath: scalar.expressionPath,
      replacement: Object.freeze({ kind: "integer-literal", value: scalarReplacement.value }),
    });
  }
  const binding = readExecutionRecord(input, ["kind", "parameterPath", "replacement"]);
  const bindingReplacement =
    binding === undefined ? undefined : readExecutionRecord(binding.replacement, ["kind", "value"]);
  if (
    binding !== undefined &&
    binding.kind === "parameter-binding-replace" &&
    typeof binding.parameterPath === "string" &&
    /^\/functions\/[0-9]+\/parameters\/[0-9]+$/u.test(binding.parameterPath) &&
    bindingReplacement?.kind === "integer-literal" &&
    typeof bindingReplacement.value === "bigint"
  ) {
    return Object.freeze({
      kind: "parameter-binding-replace",
      parameterPath: binding.parameterPath,
      replacement: Object.freeze({ kind: "integer-literal", value: bindingReplacement.value }),
    });
  }
  return undefined;
}
