import { DEFAULT_RENDERER_EXPRESSION_POLICY, renderExpression } from "./expression-renderer.js";
import type { GenExpression, GenFunction, GenStatement } from "./generator-ir.js";
import { inspectGeneratorInput } from "./generator-ir-validator.js";
import {
  deriveInvalidRoundTripProjection,
  validateInvalidRoundTripProjection,
} from "./invalid-roundtrip-projection.js";
import type {
  GeneratedModeledCase,
  InvalidSourceTransform,
  ParameterValueBinding,
} from "./modeled-generator-model.js";
import type { CaseRenderResult, CaseRenderSuccess } from "./campaign-model.js";
import { parseRenderedSource } from "./roundtrip-parser.js";
import type { RoundTripDiagnostic, SourceRenderOptions } from "./roundtrip-model.js";
import { prepareSourceRenderInput, type PreparedSourceRenderInput } from "./source-renderer.js";
import { validateRoundTrip } from "./roundtrip-validator.js";

const EMPTY_DIAGNOSTICS: readonly [] = Object.freeze([]);
const TEXT_ENCODER = new TextEncoder();
const POINTER_PATTERN = /^(?:\/(?:[^~/]|~0|~1)+)+$/u;

function failure(
  code: RoundTripDiagnostic["code"],
  path: string,
  message: string,
): CaseRenderResult {
  return Object.freeze({
    ok: false,
    diagnostics: Object.freeze([Object.freeze({ code, path, message })]),
  });
}

function isBinding(value: unknown): value is ParameterValueBinding {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== 3 ||
      keys.some(
        (key) => typeof key !== "string" || !["kind", "parameterPath", "value"].includes(key),
      )
    ) {
      return false;
    }
    const kind = Reflect.getOwnPropertyDescriptor(value, "kind");
    const path = Reflect.getOwnPropertyDescriptor(value, "parameterPath");
    const bindingValue = Reflect.getOwnPropertyDescriptor(value, "value");
    return (
      kind !== undefined &&
      "value" in kind &&
      kind.value === "parameter-value" &&
      path !== undefined &&
      "value" in path &&
      typeof path.value === "string" &&
      POINTER_PATTERN.test(path.value) &&
      bindingValue !== undefined &&
      "value" in bindingValue &&
      (typeof bindingValue.value === "bigint" || typeof bindingValue.value === "boolean")
    );
  } catch {
    return false;
  }
}

function closeBindings(value: unknown): readonly ParameterValueBinding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const bindings: ParameterValueBinding[] = [];
  const paths = new Set<string>();
  for (const candidate of value) {
    if (!isBinding(candidate) || paths.has(candidate.parameterPath)) return undefined;
    paths.add(candidate.parameterPath);
    bindings.push(
      Object.freeze({
        kind: "parameter-value",
        parameterPath: candidate.parameterPath,
        value: candidate.value,
      }),
    );
  }
  return Object.freeze(bindings);
}

function effectiveBindings(
  generatedCase: GeneratedModeledCase,
): readonly ParameterValueBinding[] | undefined {
  const retained = closeBindings(generatedCase.parameterBindings);
  if (retained === undefined) return undefined;
  const module =
    generatedCase.projection.kind === "valid"
      ? generatedCase.projection.module
      : generatedCase.projection.baseline;
  const bindings = [...retained];
  const paths = new Set(bindings.map((binding) => binding.parameterPath));
  const firstFunction = module.functions[0];
  if (firstFunction !== undefined) {
    firstFunction.parameters.forEach((parameter, index) => {
      const parameterPath = `/functions/0/parameters/${index}`;
      if (paths.has(parameterPath)) return;
      const value =
        parameter.name === "modeledAddress"
          ? 0xd020n
          : parameter.name === "modeledValue"
            ? parameter.type === "byte"
              ? 0x20n
              : 0x2000n
            : undefined;
      if (value !== undefined) {
        paths.add(parameterPath);
        bindings.push(
          Object.freeze({
            kind: "parameter-value",
            parameterPath,
            value,
          }),
        );
      }
    });
  }
  if (
    generatedCase.projection.kind !== "invalid" ||
    generatedCase.projection.transform.kind !== "parameter-binding-replace"
  ) {
    return Object.freeze(bindings);
  }
  const transform = generatedCase.projection.transform;
  let replacements = 0;
  let changed = false;
  const effective = bindings.map((binding) => {
    if (binding.parameterPath !== transform.parameterPath) return binding;
    replacements += 1;
    if (binding.value !== transform.replacement.value) changed = true;
    return Object.freeze({
      kind: "parameter-value" as const,
      parameterPath: binding.parameterPath,
      value: transform.replacement.value,
    });
  });
  return replacements === 1 && changed ? Object.freeze(effective) : undefined;
}

function renderInteger(value: bigint): string {
  return value.toString(10);
}

interface InvalidRenderContext {
  readonly prepared: PreparedSourceRenderInput;
  readonly transform: Exclude<
    InvalidSourceTransform,
    { readonly kind: "parameter-binding-replace" }
  >;
  applied: number;
}

function renderTransformedExpression(
  expression: GenExpression,
  path: string,
  context: InvalidRenderContext,
): string {
  if (
    context.transform.kind === "scalar-expression-replace" &&
    context.transform.expressionPath === path
  ) {
    context.applied += 1;
    return renderInteger(context.transform.replacement.value);
  }
  if (
    expression.kind === "memory-read" &&
    context.transform.kind !== "scalar-expression-replace" &&
    context.transform.callPath === path
  ) {
    context.applied += 1;
    const argumentsValue = applyArgumentTransform(
      [expression.address],
      [`${path}/address`],
      context.transform,
    );
    const intrinsic = expression.width === 1 ? "peek" : "peekw";
    return `${intrinsic}(${argumentsValue
      .map(({ expression: argument, path: argumentPath }) =>
        renderExpression(argument, argumentPath, {
          literalSpellings: context.prepared.literalSpellings,
          policy: DEFAULT_RENDERER_EXPRESSION_POLICY,
        }),
      )
      .join(", ")})`;
  }
  return renderExpression(expression, path, {
    literalSpellings: context.prepared.literalSpellings,
    policy: DEFAULT_RENDERER_EXPRESSION_POLICY,
  });
}

interface RenderArgument {
  readonly expression: GenExpression;
  readonly path: string;
}

function applyArgumentTransform(
  expressions: readonly GenExpression[],
  paths: readonly string[],
  transform: Extract<
    InvalidSourceTransform,
    {
      readonly kind:
        | "intrinsic-argument-remove"
        | "intrinsic-argument-insert"
        | "intrinsic-argument-replace";
    }
  >,
): readonly RenderArgument[] {
  const argumentsValue = expressions.map((expression, index) => ({
    expression,
    path: paths[index] ?? `${transform.callPath}/arguments/${index}`,
  }));
  if (transform.kind === "intrinsic-argument-remove") {
    argumentsValue.splice(transform.argumentIndex, 1);
  } else if (transform.kind === "intrinsic-argument-insert") {
    argumentsValue.splice(transform.argumentIndex, 0, {
      expression: transform.argument,
      path: `${transform.callPath}/arguments/${transform.argumentIndex}`,
    });
  } else {
    argumentsValue[transform.argumentIndex] = {
      expression: transform.argument,
      path:
        paths[transform.argumentIndex] ??
        `${transform.callPath}/arguments/${transform.argumentIndex}`,
    };
  }
  return argumentsValue;
}

function renderTransformedStatement(
  statement: GenStatement,
  path: string,
  context: InvalidRenderContext,
): string {
  if (statement.kind === "local") {
    return `let ${statement.name}: ${statement.type} = ${renderTransformedExpression(
      statement.initializer,
      `${path}/initializer`,
      context,
    )};`;
  }
  if (statement.kind === "assign") {
    return `${statement.target} = ${renderTransformedExpression(
      statement.value,
      `${path}/value`,
      context,
    )};`;
  }
  if (statement.kind === "memory-write") {
    if (
      context.transform.kind !== "scalar-expression-replace" &&
      context.transform.callPath === path
    ) {
      context.applied += 1;
      const argumentsValue = applyArgumentTransform(
        [statement.address, statement.value],
        [`${path}/address`, `${path}/value`],
        context.transform,
      );
      const intrinsic = statement.width === 1 ? "poke" : "pokew";
      const rendered = argumentsValue.map(({ expression, path: expressionPath }) =>
        renderExpression(expression, expressionPath, {
          literalSpellings: context.prepared.literalSpellings,
          policy: DEFAULT_RENDERER_EXPRESSION_POLICY,
        }),
      );
      return `${intrinsic}(${rendered.join(", ")});`;
    }
    const intrinsic = statement.width === 1 ? "poke" : "pokew";
    return `${intrinsic}(${renderTransformedExpression(
      statement.address,
      `${path}/address`,
      context,
    )}, ${renderTransformedExpression(statement.value, `${path}/value`, context)});`;
  }
  return statement.value === undefined
    ? "return;"
    : `return ${renderTransformedExpression(statement.value, `${path}/value`, context)};`;
}

function renderFunction(
  fn: GenFunction,
  functionIndex: number,
  context: InvalidRenderContext,
): string {
  const parameters = fn.parameters
    .map((parameter) => `${parameter.name}: ${parameter.type}`)
    .join(", ");
  const lines = [`function ${fn.name}(${parameters}): ${fn.returnType} {`];
  fn.body.forEach((statement, statementIndex) => {
    lines.push(
      `  ${renderTransformedStatement(
        statement,
        `/functions/${functionIndex}/body/${statementIndex}`,
        context,
      )}`,
    );
  });
  lines.push("}");
  return lines.join("\n");
}

function renderSourceTransform(
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
): CaseRenderResult {
  if (generatedCase.projection.kind !== "invalid") {
    return failure("render.input.invalid", "/generatedCase/projection", "Invalid case expected.");
  }
  const transform = generatedCase.projection.transform;
  if (transform.kind === "parameter-binding-replace") {
    return failure(
      "render.input.invalid",
      "/generatedCase/projection/transform",
      "Source transform expected.",
    );
  }
  const prepared = prepareSourceRenderInput(generatedCase.projection.baseline, options);
  if (!prepared.ok) return prepared;
  const expectedProjection = deriveInvalidRoundTripProjection(prepared.input, transform);
  if (!expectedProjection.ok) return expectedProjection;
  const context: InvalidRenderContext = { prepared: prepared.input, transform, applied: 0 };
  try {
    const lines = [`module ${prepared.input.module.path.join(".")};`];
    prepared.input.module.constants.forEach((constant, index) => {
      lines.push(
        `const ${constant.name}: ${constant.type} = ${renderTransformedExpression(
          constant.value,
          `/constants/${index}/value`,
          context,
        )};`,
      );
    });
    prepared.input.module.functions.forEach((fn, index) => {
      lines.push(renderFunction(fn, index, context));
    });
    if (context.applied !== 1) {
      return failure(
        "render.input.invalid",
        "/generatedCase/projection/transform",
        "Invalid transform must resolve exactly once.",
      );
    }
    const source = `${lines.join("\n")}\n`;
    const sourceBytes = TEXT_ENCODER.encode(source);
    if (sourceBytes.byteLength > prepared.input.maxSourceBytes) {
      return failure(
        "render.budget.source-bytes",
        "/sourceBytes",
        "Rendered source exceeds the configured byte limit.",
      );
    }
    const parsed = parseRenderedSource(sourceBytes, prepared.input.maxSourceBytes);
    if (!parsed.ok) return parsed;
    const verifiedProjection = validateInvalidRoundTripProjection(
      expectedProjection.projection,
      parsed.projection,
    );
    if (!verifiedProjection.ok) return verifiedProjection;
    const bindings = effectiveBindings(generatedCase);
    if (bindings === undefined) {
      return failure(
        "roundtrip-mismatch",
        "/generatedCase/parameterBindings",
        "Parameter bindings are invalid.",
      );
    }
    return Object.freeze({
      ok: true,
      kind: "invalid-source-transform",
      source,
      sourceBytes,
      projection: verifiedProjection.projection,
      effectiveParameterBindings: bindings,
      diagnostics: EMPTY_DIAGNOSTICS,
    });
  } catch {
    return failure(
      "render.input.invalid",
      "/generatedCase/projection/transform",
      "Invalid transform could not be rendered safely.",
    );
  }
}

function roundTripCase(
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
): CaseRenderResult {
  const module =
    generatedCase.projection.kind === "valid"
      ? generatedCase.projection.module
      : generatedCase.projection.baseline;
  const roundTrip = validateRoundTrip(module, options);
  if (!roundTrip.ok) return roundTrip;
  const bindings = effectiveBindings(generatedCase);
  if (bindings === undefined) {
    return failure(
      "roundtrip-mismatch",
      "/generatedCase/parameterBindings",
      "Parameter binding transform does not resolve exactly once.",
    );
  }
  const kind: CaseRenderSuccess["kind"] =
    generatedCase.projection.kind === "valid" ? "valid" : "invalid-parameter-binding";
  return Object.freeze({
    ok: true,
    kind,
    source: roundTrip.source,
    sourceBytes: roundTrip.sourceBytes,
    projection: roundTrip.projection,
    effectiveParameterBindings: bindings,
    diagnostics: EMPTY_DIAGNOSTICS,
  });
}

/**
 * Renders one generated case and independently parses its complete source.
 *
 * @param generatedCase Reviewed valid baseline and optional single invalid transform.
 * @param options Closed source budget and literal spelling selections.
 * @returns Source, parsed projection and effective bindings only after all proofs succeed.
 *
 * @example
 * ```ts
 * const rendered = renderGeneratedCase(generatedCase, {
 *   maxSourceBytes: 4096,
 *   literalSpellings: [],
 * });
 * ```
 */
export function renderGeneratedCase(
  generatedCase: GeneratedModeledCase,
  options: SourceRenderOptions,
): CaseRenderResult {
  try {
    const structure = inspectGeneratorInput(generatedCase, "/generatedCase", () => false);
    if (structure !== undefined) {
      return failure("render.input.invalid", structure.path, structure.message);
    }
    return generatedCase.projection.kind === "invalid" &&
      generatedCase.projection.transform.kind !== "parameter-binding-replace"
      ? renderSourceTransform(generatedCase, options)
      : roundTripCase(generatedCase, options);
  } catch {
    return failure(
      "render.input.invalid",
      "/generatedCase",
      "Generated case could not be inspected safely.",
    );
  }
}
