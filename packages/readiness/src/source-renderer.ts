import { validateGeneratorIrSyntax } from "./generator-ir-validator.js";
import type { GenExpression, GenFunction, GenModule, GenStatement } from "./generator-ir.js";
import { DEFAULT_RENDERER_EXPRESSION_POLICY, renderExpression } from "./expression-renderer.js";
import type { ExpressionRenderContext, RendererExpressionPolicy } from "./expression-renderer.js";
import type {
  LiteralSpellingClass,
  RoundTripDiagnostic,
  SourceRenderFailure,
  SourceRenderOptions,
  SourceRenderResult,
} from "./roundtrip-model.js";

/** Maximum source accepted or emitted by the Phase 4 substrate. */
export const MAX_ROUND_TRIP_SOURCE_BYTES = 1_048_576;

/** Maximum explicit literal spelling selections in one render. */
export const MAX_LITERAL_SPELLING_SELECTIONS = 1_024;

const TEXT_ENCODER = new TextEncoder();
const LANGUAGE_KEYWORDS = new Set([
  "module",
  "import",
  "export",
  "from",
  "function",
  "return",
  "interrupt",
  "if",
  "else",
  "while",
  "do",
  "for",
  "switch",
  "case",
  "default",
  "fallthrough",
  "break",
  "continue",
  "let",
  "const",
  "zeropage",
  "struct",
  "byte",
  "sbyte",
  "word",
  "sword",
  "boolean",
  "void",
  "true",
  "false",
  "enum",
  "type",
]);

interface ValidatedRenderOptions {
  readonly maxSourceBytes: number;
  readonly literalSpellings: ReadonlyMap<string, LiteralSpellingClass>;
}

/** Immutable input snapshot shared by renderer composition operations. */
export interface PreparedSourceRenderInput {
  /** Deeply frozen generator module. */
  readonly module: GenModule;
  /** Validated source-byte ceiling. */
  readonly maxSourceBytes: number;
  /** Validated literal spelling selections. */
  readonly literalSpellings: ReadonlyMap<string, LiteralSpellingClass>;
}

/** Closed result of preparing renderer input without retaining caller-owned objects. */
export type PreparedSourceRenderResult =
  | {
      readonly ok: true;
      readonly input: PreparedSourceRenderInput;
      readonly diagnostics: readonly [];
    }
  | SourceRenderFailure;

function isLiteralSpellingClass(value: unknown): value is LiteralSpellingClass {
  return (
    value === "decimal" ||
    value === "hex-dollar" ||
    value === "hex-prefix" ||
    value === "binary-prefix"
  );
}

/** Renderer capability returned by the internal conformance factory. */
export interface SourceRenderer {
  /**
   * Renders one module with the renderer instance's immutable policy.
   *
   * @param module Independent generator module.
   * @param options Closed source limits and spelling selections.
   * @returns Source only when validation and the byte budget succeed.
   */
  renderSourceModule(module: GenModule, options: SourceRenderOptions): SourceRenderResult;
}

function diagnostic(
  code: RoundTripDiagnostic["code"],
  path: string,
  message: string,
): SourceRenderFailure {
  return {
    ok: false,
    diagnostics: [Object.freeze({ code, path, message })],
  };
}

function hasExactOwnKeys(value: object, keys: readonly string[]): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === keys.length &&
    ownKeys.every((key) => typeof key === "string" && keys.includes(key))
  );
}

function ownData(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor ? descriptor.value : undefined;
}

function isCanonicalPointer(value: string): boolean {
  return (
    value.startsWith("/") &&
    TEXT_ENCODER.encode(value).byteLength <= 256 &&
    !value.includes("//") &&
    /^(?:\/(?:[^~/]|~0|~1)+)+$/u.test(value)
  );
}

function collectLiteralPaths(
  expression: GenExpression,
  path: string,
  output: Map<string, GenExpression["type"]>,
): void {
  if (expression.kind === "literal") {
    output.set(path, expression.type);
    return;
  }
  if (expression.kind === "unary") {
    collectLiteralPaths(expression.operand, `${path}/operand`, output);
    return;
  }
  if (expression.kind === "binary") {
    collectLiteralPaths(expression.left, `${path}/left`, output);
    collectLiteralPaths(expression.right, `${path}/right`, output);
    return;
  }
  if (expression.kind === "memory-read") {
    collectLiteralPaths(expression.address, `${path}/address`, output);
  }
}

function collectStatementLiteralPaths(
  statement: GenStatement,
  path: string,
  output: Map<string, GenExpression["type"]>,
): void {
  if (statement.kind === "local") {
    collectLiteralPaths(statement.initializer, `${path}/initializer`, output);
  } else if (statement.kind === "assign") {
    collectLiteralPaths(statement.value, `${path}/value`, output);
  } else if (statement.kind === "memory-write") {
    collectLiteralPaths(statement.address, `${path}/address`, output);
    collectLiteralPaths(statement.value, `${path}/value`, output);
  } else if (statement.value !== undefined) {
    collectLiteralPaths(statement.value, `${path}/value`, output);
  }
}

function moduleLiteralPaths(module: GenModule): Map<string, GenExpression["type"]> {
  const paths = new Map<string, GenExpression["type"]>();
  module.constants.forEach((constant, index) => {
    collectLiteralPaths(constant.value, `/constants/${index}/value`, paths);
  });
  module.functions.forEach((fn, functionIndex) => {
    fn.body.forEach((statement, statementIndex) => {
      collectStatementLiteralPaths(
        statement,
        `/functions/${functionIndex}/body/${statementIndex}`,
        paths,
      );
    });
  });
  return paths;
}

function expressionHasKeyword(expression: GenExpression): boolean {
  if (expression.kind === "name") return LANGUAGE_KEYWORDS.has(expression.name);
  if (expression.kind === "unary") return expressionHasKeyword(expression.operand);
  if (expression.kind === "binary") {
    return expressionHasKeyword(expression.left) || expressionHasKeyword(expression.right);
  }
  return expression.kind === "memory-read" && expressionHasKeyword(expression.address);
}

function statementHasKeyword(statement: GenStatement): boolean {
  if (statement.kind === "local") {
    return LANGUAGE_KEYWORDS.has(statement.name) || expressionHasKeyword(statement.initializer);
  }
  if (statement.kind === "assign") {
    return LANGUAGE_KEYWORDS.has(statement.target) || expressionHasKeyword(statement.value);
  }
  if (statement.kind === "memory-write") {
    return expressionHasKeyword(statement.address) || expressionHasKeyword(statement.value);
  }
  return statement.value !== undefined && expressionHasKeyword(statement.value);
}

function validateOptions(
  options: unknown,
  module: GenModule,
): ValidatedRenderOptions | SourceRenderFailure {
  try {
    if (
      typeof options !== "object" ||
      options === null ||
      Array.isArray(options) ||
      !hasExactOwnKeys(options, ["maxSourceBytes", "literalSpellings"])
    ) {
      return diagnostic("render.input.invalid", "/options", "expected closed render options");
    }
    const maxSourceBytes = ownData(options, "maxSourceBytes");
    const selections = ownData(options, "literalSpellings");
    if (
      typeof maxSourceBytes !== "number" ||
      !Number.isSafeInteger(maxSourceBytes) ||
      maxSourceBytes < 1 ||
      maxSourceBytes > MAX_ROUND_TRIP_SOURCE_BYTES
    ) {
      return diagnostic(
        "render.input.invalid",
        "/options/maxSourceBytes",
        "source-byte limit must be a positive safe integer at most 1048576",
      );
    }
    if (!Array.isArray(selections) || selections.length > MAX_LITERAL_SPELLING_SELECTIONS) {
      return diagnostic(
        "render.spelling.invalid",
        "/options/literalSpellings",
        "literal spelling selections must be a bounded array",
      );
    }

    const literalPaths = moduleLiteralPaths(module);
    const result = new Map<string, LiteralSpellingClass>();
    for (let index = 0; index < selections.length; index += 1) {
      const selection = selections[index];
      const path = `/options/literalSpellings/${index}`;
      if (
        typeof selection !== "object" ||
        selection === null ||
        Array.isArray(selection) ||
        !hasExactOwnKeys(selection, ["expressionPath", "spelling"])
      ) {
        return diagnostic("render.spelling.invalid", path, "expected a closed spelling selection");
      }
      const expressionPath = ownData(selection, "expressionPath");
      const spelling = ownData(selection, "spelling");
      if (
        typeof expressionPath !== "string" ||
        !isCanonicalPointer(expressionPath) ||
        literalPaths.get(expressionPath) === undefined ||
        literalPaths.get(expressionPath) === "boolean" ||
        !isLiteralSpellingClass(spelling) ||
        result.has(expressionPath)
      ) {
        return diagnostic(
          "render.spelling.invalid",
          path,
          "selection must uniquely name one numeric literal and one supported spelling",
        );
      }
      result.set(expressionPath, spelling);
    }
    return Object.freeze({ maxSourceBytes, literalSpellings: result });
  } catch {
    return diagnostic("render.input.invalid", "/options", "render options could not be inspected");
  }
}

/**
 * Defensively snapshots a module and renderer options exactly once.
 *
 * This internal composition API is intentionally absent from the package index.
 *
 * @param module Unknown generator module input.
 * @param options Unknown renderer options input.
 * @returns Immutable prepared input or bounded diagnostics.
 */
export function prepareSourceRenderInput(
  module: unknown,
  options: unknown,
): PreparedSourceRenderResult {
  const validated = validateGeneratorIrSyntax(module);
  if (!validated.ok) {
    return diagnostic(
      "render.input.invalid",
      validated.diagnostics[0]?.path ?? "/module",
      "generator module is not valid",
    );
  }
  if (
    validated.module.path.some((name) => LANGUAGE_KEYWORDS.has(name)) ||
    validated.module.constants.some(
      (constant) => LANGUAGE_KEYWORDS.has(constant.name) || expressionHasKeyword(constant.value),
    ) ||
    validated.module.functions.some(
      (fn) =>
        LANGUAGE_KEYWORDS.has(fn.name) ||
        fn.parameters.some((parameter) => LANGUAGE_KEYWORDS.has(parameter.name)) ||
        fn.body.some(statementHasKeyword),
    )
  ) {
    return diagnostic(
      "render.input.invalid",
      "/module",
      "module contains a language keyword where source requires an identifier",
    );
  }
  const validatedOptions = validateOptions(options, validated.module);
  if ("ok" in validatedOptions) return validatedOptions;
  return {
    ok: true,
    input: Object.freeze({
      module: validated.module,
      maxSourceBytes: validatedOptions.maxSourceBytes,
      literalSpellings: validatedOptions.literalSpellings,
    }),
    diagnostics: [],
  };
}

function renderStatement(
  statement: GenStatement,
  path: string,
  context: ExpressionRenderContext,
): string {
  if (statement.kind === "local") {
    return `let ${statement.name}: ${statement.type} = ${renderExpression(
      statement.initializer,
      `${path}/initializer`,
      context,
    )};`;
  }
  if (statement.kind === "assign") {
    return `${statement.target} = ${renderExpression(statement.value, `${path}/value`, context)};`;
  }
  if (statement.kind === "memory-write") {
    const intrinsic = statement.width === 1 ? "poke" : "pokew";
    return `${intrinsic}(${renderExpression(
      statement.address,
      `${path}/address`,
      context,
    )}, ${renderExpression(statement.value, `${path}/value`, context)});`;
  }
  return statement.value === undefined
    ? "return;"
    : `return ${renderExpression(statement.value, `${path}/value`, context)};`;
}

function renderFunction(
  fn: GenFunction,
  functionIndex: number,
  context: ExpressionRenderContext,
): string {
  const parameters = fn.parameters
    .map((parameter) => `${parameter.name}: ${parameter.type}`)
    .join(", ");
  const lines = [`function ${fn.name}(${parameters}): ${fn.returnType} {`];
  fn.body.forEach((statement, statementIndex) => {
    lines.push(
      `  ${renderStatement(
        statement,
        `/functions/${functionIndex}/body/${statementIndex}`,
        context,
      )}`,
    );
  });
  lines.push("}");
  return lines.join("\n");
}

function renderPreparedWithPolicy(
  prepared: PreparedSourceRenderInput,
  policy: RendererExpressionPolicy,
): SourceRenderResult {
  const context: ExpressionRenderContext = {
    literalSpellings: prepared.literalSpellings,
    policy,
  };
  const lines = [`module ${prepared.module.path.join(".")};`];
  prepared.module.constants.forEach((constant, index) => {
    lines.push(
      `const ${constant.name}: ${constant.type} = ${renderExpression(
        constant.value,
        `/constants/${index}/value`,
        context,
      )};`,
    );
  });
  prepared.module.functions.forEach((fn, index) => {
    lines.push(renderFunction(fn, index, context));
  });
  const source = `${lines.join("\n")}\n`;
  const sourceBytes = TEXT_ENCODER.encode(source);
  if (sourceBytes.byteLength > prepared.maxSourceBytes) {
    return diagnostic(
      "render.budget.source-bytes",
      "/sourceBytes",
      "rendered source exceeds the configured byte limit",
    );
  }
  return {
    ok: true,
    source,
    sourceBytes: sourceBytes.slice(),
    diagnostics: [],
  };
}

function renderWithPolicy(
  module: GenModule,
  options: SourceRenderOptions,
  policy: RendererExpressionPolicy,
): SourceRenderResult {
  const prepared = prepareSourceRenderInput(module, options);
  return prepared.ok ? renderPreparedWithPolicy(prepared.input, policy) : prepared;
}

/**
 * Renders one immutable prepared input through the production expression policy.
 *
 * @param prepared Input returned by `prepareSourceRenderInput`.
 * @returns Deterministic source or a byte-budget diagnostic.
 */
export function renderPreparedSourceModule(
  prepared: PreparedSourceRenderInput,
): SourceRenderResult {
  return renderPreparedWithPolicy(prepared, DEFAULT_RENDERER_EXPRESSION_POLICY);
}

/**
 * Creates a renderer with an immutable expression policy.
 *
 * @param policy Renderer-owned precedence and grouping policy.
 * @returns Closed renderer capability.
 */
export function createSourceRenderer(policy: RendererExpressionPolicy): SourceRenderer {
  return Object.freeze({
    renderSourceModule(module: GenModule, options: SourceRenderOptions): SourceRenderResult {
      return renderWithPolicy(module, options, policy);
    },
  });
}

/**
 * Renders a validated independent module as deterministic Blend65 source.
 *
 * @param module Independent generator module.
 * @param options Closed source limits and literal spellings.
 * @returns Source text and bytes only on success.
 *
 * @example
 * ```ts
 * const rendered = renderSourceModule(module, {
 *   maxSourceBytes: 4096,
 *   literalSpellings: [],
 * });
 * ```
 */
export function renderSourceModule(
  module: GenModule,
  options: SourceRenderOptions,
): SourceRenderResult {
  return renderWithPolicy(module, options, DEFAULT_RENDERER_EXPRESSION_POLICY);
}
