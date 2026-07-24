import {
  defaultRendererBinaryRule,
  omitRendererParenthesesAt,
  replaceRendererBinaryRule,
} from "./expression-renderer.js";
import type { BinaryOperator } from "./generator-ir.js";
import type { RoundTripDiagnostic } from "./roundtrip-model.js";
import { createSourceRenderer } from "./source-renderer.js";
import type { SourceRenderer } from "./source-renderer.js";

/** One renderer policy mutation supported by the versioned conformance seam. */
export type RendererPolicyMutation =
  | {
      /** Changes one operator's binding power. */
      readonly kind: "precedence";
      /** Operator whose renderer rule changes. */
      readonly operator: BinaryOperator;
      /** Replacement binding power from 1 through 14. */
      readonly bindingPower: number;
    }
  | {
      /** Changes one operator's associativity. */
      readonly kind: "associativity";
      /** Operator whose renderer rule changes. */
      readonly operator: BinaryOperator;
      /** Replacement grouping direction. */
      readonly associativity: "left" | "right";
    }
  | {
      /** Omits one required renderer parenthesis pair. */
      readonly kind: "omit-required-parentheses";
      /** Canonical child expression pointer. */
      readonly expressionPath: string;
    };

/** One source module and its direct imports for pure boundary validation. */
export interface ModuleGraphFile {
  /** Repository-relative basename for the production module. */
  readonly path: string;
  /** Exact import specifiers read from that module. */
  readonly imports: readonly string[];
  /** Optional discovery classification; `unclassified` always fails closed. */
  readonly classification?: "inverse" | "neutral" | "composition" | "unclassified";
}

/** Successful inverse boundary validation. */
export interface ModuleGraphValidationSuccess {
  /** Success discriminator. */
  readonly ok: true;
  /** Successful validation carries no diagnostics. */
  readonly diagnostics: readonly [];
}

/** Failed inverse boundary validation. */
export interface ModuleGraphValidationFailure {
  /** Failure discriminator. */
  readonly ok: false;
  /** Bounded boundary diagnostics. */
  readonly diagnostics: readonly RoundTripDiagnostic[];
}

/** Closed inverse boundary result. */
export type ModuleGraphValidationResult =
  | ModuleGraphValidationSuccess
  | ModuleGraphValidationFailure;

function isBinaryOperator(value: unknown): value is BinaryOperator {
  return (
    value === "+" ||
    value === "-" ||
    value === "*" ||
    value === "/" ||
    value === "%" ||
    value === "&" ||
    value === "|" ||
    value === "^" ||
    value === "<<" ||
    value === ">>" ||
    value === "==" ||
    value === "!=" ||
    value === "<" ||
    value === "<=" ||
    value === ">" ||
    value === ">="
  );
}

function isCanonicalPointer(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("/") &&
    new TextEncoder().encode(value).byteLength <= 256 &&
    /^(?:\/(?:[^~/]|~0|~1)+)+$/u.test(value)
  );
}

function invalidMutation(): never {
  throw new TypeError("invalid renderer policy mutation");
}

/**
 * Creates a renderer whose real policy contains exactly one checked mutation.
 *
 * This internal seam is intentionally absent from the package public index.
 *
 * @param mutation Closed policy mutation.
 * @returns Renderer that exercises the production rendering path.
 */
export function createSourceRendererForTest(mutation: RendererPolicyMutation): SourceRenderer {
  if (mutation.kind === "precedence") {
    if (
      !isBinaryOperator(mutation.operator) ||
      !Number.isSafeInteger(mutation.bindingPower) ||
      mutation.bindingPower < 1 ||
      mutation.bindingPower > 14
    ) {
      return invalidMutation();
    }
    const current = defaultRendererBinaryRule(mutation.operator);
    return createSourceRenderer(
      replaceRendererBinaryRule(mutation.operator, {
        bindingPower: mutation.bindingPower,
        associativity: current.associativity,
      }),
    );
  }
  if (mutation.kind === "associativity") {
    if (
      !isBinaryOperator(mutation.operator) ||
      (mutation.associativity !== "left" && mutation.associativity !== "right")
    ) {
      return invalidMutation();
    }
    const current = defaultRendererBinaryRule(mutation.operator);
    return createSourceRenderer(
      replaceRendererBinaryRule(mutation.operator, {
        bindingPower: current.bindingPower,
        associativity: mutation.associativity,
      }),
    );
  }
  if (
    mutation.kind !== "omit-required-parentheses" ||
    !isCanonicalPointer(mutation.expressionPath)
  ) {
    return invalidMutation();
  }
  return createSourceRenderer(omitRendererParenthesesAt(mutation.expressionPath));
}

function boundaryFailure(path: string): ModuleGraphValidationFailure {
  return {
    ok: false,
    diagnostics: [
      Object.freeze({
        code: "roundtrip.boundary",
        path,
        message: "inverse module graph crosses the renderer-independence boundary",
      }),
    ],
  };
}

function isInversePath(path: string): boolean {
  return /^roundtrip-(?:tokenizer|parser|normalizer)(?:-[a-z0-9-]+)?\.ts$/u.test(path);
}

function isAllowedInverseImport(specifier: string): boolean {
  return (
    specifier.startsWith("node:") ||
    specifier === "./generator-ir.js" ||
    specifier === "./roundtrip-model.js" ||
    /^\.\/roundtrip-(?:tokenizer|parser|normalizer)(?:-[a-z0-9-]+)?\.js$/u.test(specifier)
  );
}

/**
 * Validates a complete discovered inverse-module graph without filesystem access.
 *
 * @param files Closed module/import records supplied by the repository boundary test.
 * @returns Success only when every inverse file is classified and renderer-independent.
 */
export function validateRoundTripModuleGraph(
  files: readonly ModuleGraphFile[],
): ModuleGraphValidationResult {
  if (!Array.isArray(files) || files.length > 128) {
    return boundaryFailure("/files");
  }
  const seen = new Set<string>();
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const path = `/files/${index}`;
    if (
      typeof file !== "object" ||
      file === null ||
      typeof file.path !== "string" ||
      !Array.isArray(file.imports) ||
      seen.has(file.path) ||
      file.classification === "unclassified" ||
      !isInversePath(file.path)
    ) {
      return boundaryFailure(path);
    }
    seen.add(file.path);
    for (let importIndex = 0; importIndex < file.imports.length; importIndex += 1) {
      const specifier = file.imports[importIndex];
      if (typeof specifier !== "string" || !isAllowedInverseImport(specifier)) {
        return boundaryFailure(`${path}/imports/${importIndex}`);
      }
    }
  }
  return { ok: true, diagnostics: [] };
}
