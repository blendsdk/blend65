import type { GenerationDiagnostic, GenerationDiagnosticCode, ScalarType } from "./generator-ir.js";

/** Result of parsing one closed generator IR node. */
export type GeneratorNodeResult<T> =
  | { readonly ok: true; readonly node: T }
  | { readonly ok: false; readonly diagnostic: GenerationDiagnostic };

/** Builds one immutable generator diagnostic. */
export function generatorDiagnostic(
  code: GenerationDiagnosticCode,
  path: string,
  message: string,
): GenerationDiagnostic {
  return Object.freeze({ code, path, message });
}

/** Builds a failed generator node result. */
export function generatorNodeFailure<T>(
  code: GenerationDiagnosticCode,
  path: string,
  message: string,
): GeneratorNodeResult<T> {
  return { ok: false, diagnostic: generatorDiagnostic(code, path, message) };
}

/** Builds a successful generator node result. */
export function generatorNodeSuccess<T>(node: T): GeneratorNodeResult<T> {
  return { ok: true, node };
}

/** Narrows a value to a non-array record. */
export function isGeneratorRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns whether a record contains exactly the requested enumerable string keys. */
export function hasExactGeneratorKeys(
  value: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

/** Returns the closed representable range for a structured scalar type. */
export function generatorScalarRange(type: ScalarType): {
  readonly minimum: bigint;
  readonly maximum: bigint;
} {
  switch (type) {
    case "boolean":
      return { minimum: 0n, maximum: 1n };
    case "byte":
      return { minimum: 0n, maximum: 255n };
    case "sbyte":
      return { minimum: -128n, maximum: 127n };
    case "word":
      return { minimum: 0n, maximum: 65_535n };
    case "sword":
      return { minimum: -32_768n, maximum: 32_767n };
  }
}
