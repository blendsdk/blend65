import type {
  BoundarySpelling,
  BoundaryVariant,
  BoundaryVariantInput,
  BoundaryVariantResult,
  GenerationDiagnostic,
  ScalarType,
} from "./generator-ir.js";
import { isScalarType } from "./generator-ir.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";

interface ScalarBoundary {
  readonly minimum: bigint | boolean;
  readonly maximum: bigint | boolean;
  readonly nearestBelow?: bigint;
  readonly nearestAbove?: bigint;
}

const INPUT_KEYS = [
  "type",
  "spellings",
  "minNestingDepth",
  "maxNestingDepth",
  "allowEmpty",
] as const;
const SPELLINGS: ReadonlySet<string> = new Set(["literal", "const", "local", "parameter"]);
const MAX_NESTING_DEPTH = 1_024;
const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);

function diagnostic(path: string, message: string): GenerationDiagnostic {
  return Object.freeze({ code: "generation-input-invalid", path, message });
}

function failed(path: string, message: string): BoundaryVariantResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([diagnostic(path, message)]),
  });
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}

function isBoundarySpelling(value: unknown): value is BoundarySpelling {
  return typeof value === "string" && SPELLINGS.has(value);
}

function isDepth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_NESTING_DEPTH
  );
}

function scalarBoundary(type: ScalarType): ScalarBoundary {
  switch (type) {
    case "boolean":
      return { minimum: false, maximum: true };
    case "byte":
      return { minimum: 0n, maximum: 255n, nearestBelow: -1n, nearestAbove: 256n };
    case "sbyte":
      return { minimum: -128n, maximum: 127n, nearestBelow: -129n, nearestAbove: 128n };
    case "word":
      return { minimum: 0n, maximum: 65_535n, nearestBelow: -1n, nearestAbove: 65_536n };
    case "sword":
      return {
        minimum: -32_768n,
        maximum: 32_767n,
        nearestBelow: -32_769n,
        nearestAbove: 32_768n,
      };
  }
}

function variantKey(variant: BoundaryVariant): string {
  const value =
    typeof variant.value === "bigint" ? `${variant.value.toString()}n` : String(variant.value);
  return [
    variant.kind,
    variant.type,
    value,
    variant.spelling ?? "",
    variant.nestingDepth?.toString() ?? "",
  ].join("|");
}

function appendVariant(
  variants: BoundaryVariant[],
  seen: Set<string>,
  variant: BoundaryVariant,
): void {
  const key = variantKey(variant);
  if (seen.has(key)) return;
  seen.add(key);
  variants.push(Object.freeze(variant));
}

function normalizeInput(value: unknown): BoundaryVariantInput | BoundaryVariantResult {
  if (!isRecord(value) || !hasExactKeys(value, INPUT_KEYS)) {
    return failed("", "Boundary input must use the exact closed record shape.");
  }
  if (!isScalarType(value.type)) {
    return failed("/type", "Boundary scalar type is not supported.");
  }
  if (!Array.isArray(value.spellings) || !value.spellings.every(isBoundarySpelling)) {
    return failed("/spellings", "Boundary spellings must use the closed spelling set.");
  }
  if (!isDepth(value.minNestingDepth)) {
    return failed("/minNestingDepth", "Minimum nesting depth is outside its closed integer range.");
  }
  if (!isDepth(value.maxNestingDepth)) {
    return failed("/maxNestingDepth", "Maximum nesting depth is outside its closed integer range.");
  }
  if (value.minNestingDepth > value.maxNestingDepth) {
    return failed("/maxNestingDepth", "Maximum nesting depth must not be below the minimum depth.");
  }
  if (typeof value.allowEmpty !== "boolean") {
    return failed("/allowEmpty", "Empty-boundary permission must be boolean.");
  }
  return Object.freeze({
    type: value.type,
    spellings: Object.freeze([...value.spellings]),
    minNestingDepth: value.minNestingDepth,
    maxNestingDepth: value.maxNestingDepth,
    allowEmpty: value.allowEmpty,
  });
}

function isFailure(
  value: BoundaryVariantInput | BoundaryVariantResult,
): value is BoundaryVariantResult {
  return "ok" in value;
}

/**
 * Expands one scalar choice into stable, typed, duplicate-free boundary descriptors.
 *
 * @param input Closed scalar, spelling, nesting, and empty-form request.
 * @returns Immutable variants in deterministic boundary/spelling/depth order.
 *
 * @example
 * ```ts
 * createBoundaryVariants({
 *   type: "byte",
 *   spellings: ["literal", "parameter"],
 *   minNestingDepth: 0,
 *   maxNestingDepth: 2,
 *   allowEmpty: false,
 * });
 * ```
 */
export function createBoundaryVariants(input: unknown): BoundaryVariantResult {
  try {
    const structuralFailure = inspectGeneratorInput(input, "", () => false);
    if (structuralFailure !== undefined) {
      return failed(structuralFailure.path, structuralFailure.message);
    }
    const normalized = normalizeInput(input);
    if (isFailure(normalized)) return normalized;

    const variants: BoundaryVariant[] = [];
    const seen = new Set<string>();
    const boundary = scalarBoundary(normalized.type);
    if (normalized.allowEmpty) {
      appendVariant(variants, seen, {
        kind: "empty",
        type: normalized.type,
        value: null,
      });
    }
    appendVariant(variants, seen, {
      kind: "minimum",
      type: normalized.type,
      value: boundary.minimum,
    });
    appendVariant(variants, seen, {
      kind: "maximum",
      type: normalized.type,
      value: boundary.maximum,
    });
    if (boundary.nearestBelow !== undefined) {
      appendVariant(variants, seen, {
        kind: "nearest-below",
        type: normalized.type,
        value: boundary.nearestBelow,
      });
    }
    if (boundary.nearestAbove !== undefined) {
      appendVariant(variants, seen, {
        kind: "nearest-above",
        type: normalized.type,
        value: boundary.nearestAbove,
      });
    }

    const spellings = [...new Set(normalized.spellings)].sort();
    for (const spelling of spellings) {
      appendVariant(variants, seen, {
        kind: "spelling",
        type: normalized.type,
        value: null,
        spelling,
      });
    }
    for (
      let nestingDepth = normalized.minNestingDepth;
      nestingDepth <= normalized.maxNestingDepth;
      nestingDepth += 1
    ) {
      appendVariant(variants, seen, {
        kind: "nesting",
        type: normalized.type,
        value: null,
        nestingDepth,
      });
    }

    return Object.freeze({
      ok: true,
      variants: Object.freeze(variants),
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failed("", "Boundary input could not be inspected safely.");
  }
}
