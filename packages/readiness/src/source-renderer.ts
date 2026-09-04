import { validateStructuredGeneratorIrSyntax } from "./generator-ir-validator.js";
import type {
  GenExpression,
  GenModule,
  GenStructuredExpression,
  GenStructuredModule,
  GenStructuredStatement,
} from "./generator-ir.js";
import { DEFAULT_RENDERER_EXPRESSION_POLICY, renderExpression } from "./expression-renderer.js";
import type { ExpressionRenderContext, RendererExpressionPolicy } from "./expression-renderer.js";
import { renderStructuredFunctions } from "./structured-source-renderer.js";
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

/** Immutable prepared input for additive structured source rendering. */
export interface PreparedStructuredSourceRenderInput extends Omit<
  PreparedSourceRenderInput,
  "module"
> {
  /** Deeply frozen structured generator module. */
  readonly module: GenStructuredModule;
}

/** Closed result of preparing renderer input without retaining caller-owned objects. */
export type PreparedSourceRenderResult =
  | {
      readonly ok: true;
      readonly input: PreparedSourceRenderInput;
      readonly diagnostics: readonly [];
    }
  | SourceRenderFailure;

/** Closed result of preparing legacy or structured renderer input. */
export type PreparedStructuredSourceRenderResult =
  | {
      readonly ok: true;
      readonly input: PreparedStructuredSourceRenderInput;
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
  renderSourceModule(
    module: GenModule | GenStructuredModule,
    options: SourceRenderOptions,
  ): SourceRenderResult;
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
  expression: GenExpression | GenStructuredExpression,
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
  } else if (expression.kind === "index") {
    collectLiteralPaths(expression.index, `${path}/index`, output);
  } else if (expression.kind === "call") {
    expression.arguments.forEach((argument, index) => {
      if (argument.kind !== "array-reference") {
        collectLiteralPaths(argument, `${path}/arguments/${index}`, output);
      }
    });
  }
}

function collectStatementLiteralPaths(
  statement: GenStructuredStatement,
  path: string,
  output: Map<string, GenExpression["type"]>,
): void {
  if (statement.kind === "local") {
    collectLiteralPaths(statement.initializer, `${path}/initializer`, output);
  } else if (statement.kind === "array") {
    statement.initializer.forEach((value, index) =>
      collectLiteralPaths(value, `${path}/initializer/${index}`, output),
    );
  } else if (statement.kind === "assign") {
    if (typeof statement.target !== "string") {
      collectLiteralPaths(statement.target.index, `${path}/target/index`, output);
    }
    collectLiteralPaths(statement.value, `${path}/value`, output);
  } else if (statement.kind === "memory-write") {
    collectLiteralPaths(statement.address, `${path}/address`, output);
    collectLiteralPaths(statement.value, `${path}/value`, output);
  } else if (statement.kind === "return" && statement.value !== undefined) {
    collectLiteralPaths(statement.value, `${path}/value`, output);
  } else if (statement.kind === "call-statement") {
    statement.arguments.forEach((argument, index) => {
      if (argument.kind !== "array-reference") {
        collectLiteralPaths(argument, `${path}/arguments/${index}`, output);
      }
    });
  } else if (statement.kind === "if") {
    collectLiteralPaths(statement.condition, `${path}/condition`, output);
    statement.thenBody.forEach((child, index) =>
      collectStatementLiteralPaths(child, `${path}/thenBody/${index}`, output),
    );
    statement.elseBody.forEach((child, index) =>
      collectStatementLiteralPaths(child, `${path}/elseBody/${index}`, output),
    );
  } else if (statement.kind === "while" || statement.kind === "do-while") {
    collectLiteralPaths(statement.condition, `${path}/condition`, output);
    statement.body.forEach((child, index) =>
      collectStatementLiteralPaths(child, `${path}/body/${index}`, output),
    );
  } else if (statement.kind === "for") {
    collectLiteralPaths(statement.start, `${path}/start`, output);
    collectLiteralPaths(statement.end, `${path}/end`, output);
    statement.body.forEach((child, index) =>
      collectStatementLiteralPaths(child, `${path}/body/${index}`, output),
    );
  }
}

function moduleLiteralPaths(module: GenStructuredModule): Map<string, GenExpression["type"]> {
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

function expressionHasKeyword(expression: GenExpression | GenStructuredExpression): boolean {
  if (expression.kind === "name") return LANGUAGE_KEYWORDS.has(expression.name);
  if (expression.kind === "unary") return expressionHasKeyword(expression.operand);
  if (expression.kind === "binary") {
    return expressionHasKeyword(expression.left) || expressionHasKeyword(expression.right);
  }
  if (expression.kind === "memory-read") return expressionHasKeyword(expression.address);
  if (expression.kind === "index") {
    return LANGUAGE_KEYWORDS.has(expression.target) || expressionHasKeyword(expression.index);
  }
  if (expression.kind === "call") {
    return (
      LANGUAGE_KEYWORDS.has(expression.callee) ||
      expression.arguments.some((argument) =>
        argument.kind === "array-reference"
          ? LANGUAGE_KEYWORDS.has(argument.name)
          : expressionHasKeyword(argument),
      )
    );
  }
  return false;
}

function statementHasKeyword(statement: GenStructuredStatement): boolean {
  if (statement.kind === "local") {
    return LANGUAGE_KEYWORDS.has(statement.name) || expressionHasKeyword(statement.initializer);
  }
  if (statement.kind === "assign") {
    return (
      (typeof statement.target === "string"
        ? LANGUAGE_KEYWORDS.has(statement.target)
        : LANGUAGE_KEYWORDS.has(statement.target.target) ||
          expressionHasKeyword(statement.target.index)) || expressionHasKeyword(statement.value)
    );
  }
  if (statement.kind === "memory-write") {
    return expressionHasKeyword(statement.address) || expressionHasKeyword(statement.value);
  }
  if (statement.kind === "array") {
    return (
      LANGUAGE_KEYWORDS.has(statement.name) || statement.initializer.some(expressionHasKeyword)
    );
  }
  if (statement.kind === "return") {
    return statement.value !== undefined && expressionHasKeyword(statement.value);
  }
  if (statement.kind === "call-statement") {
    return (
      LANGUAGE_KEYWORDS.has(statement.callee) ||
      statement.arguments.some((argument) =>
        argument.kind === "array-reference"
          ? LANGUAGE_KEYWORDS.has(argument.name)
          : expressionHasKeyword(argument),
      )
    );
  }
  if (statement.kind === "if") {
    return (
      expressionHasKeyword(statement.condition) ||
      statement.thenBody.some(statementHasKeyword) ||
      statement.elseBody.some(statementHasKeyword)
    );
  }
  if (statement.kind === "while" || statement.kind === "do-while") {
    return expressionHasKeyword(statement.condition) || statement.body.some(statementHasKeyword);
  }
  return (
    LANGUAGE_KEYWORDS.has(statement.counter) ||
    expressionHasKeyword(statement.start) ||
    expressionHasKeyword(statement.end) ||
    statement.body.some(statementHasKeyword)
  );
}

function validateOptions(
  options: unknown,
  module: GenStructuredModule,
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
  module: GenModule,
  options: unknown,
): PreparedSourceRenderResult;
export function prepareSourceRenderInput(
  module: GenStructuredModule,
  options: unknown,
): PreparedStructuredSourceRenderResult;
export function prepareSourceRenderInput(
  module: unknown,
  options: unknown,
): PreparedStructuredSourceRenderResult;
export function prepareSourceRenderInput(
  module: unknown,
  options: unknown,
): PreparedStructuredSourceRenderResult {
  const validated = validateStructuredGeneratorIrSyntax(module);
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

function renderPreparedWithPolicy(
  prepared: PreparedStructuredSourceRenderInput,
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
  lines.push(...renderStructuredFunctions(prepared.module, context));
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
  module: GenModule | GenStructuredModule,
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
  prepared: PreparedStructuredSourceRenderInput,
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
    renderSourceModule(
      module: GenModule | GenStructuredModule,
      options: SourceRenderOptions,
    ): SourceRenderResult {
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
  module: GenModule | GenStructuredModule,
  options: SourceRenderOptions,
): SourceRenderResult {
  return renderWithPolicy(module, options, DEFAULT_RENDERER_EXPRESSION_POLICY);
}
