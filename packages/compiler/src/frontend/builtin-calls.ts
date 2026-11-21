import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { scopedBorrowOrigin } from "./address-provenance.js";
import {
  createScalarTypedExpression,
  integerFacts,
  isIntegerType,
  SCALAR_TYPES,
} from "./constants.js";
import { clearCallVisibleScalarFacts } from "./flow-facts.js";
import { analyzeMachineIntrinsic } from "./machine-intrinsics.js";
import { firmwareVectorSink } from "./profile.js";
import { semanticTypeName } from "./semantic-type-relations.js";
import type {
  FunctionSignature,
  ScalarExpressionContext,
  ScalarExpressionHost,
  ScalarExpressionResult,
  SemanticType,
  TypedExpr,
} from "./semantic-types.js";
import type { Expr } from "./syntax.js";
import type { AnalyzeExpression } from "./aggregates.js";

/** One recognized firmware vector a raw word write would overwrite. */
interface FirmwareVector {
  /** Exact compile-time destination address. */
  readonly address: bigint;
  /** Platform operation that installs a handler here with the entry variant this vector needs. */
  readonly sink: string;
}

/**
 * Name the interrupt function behind an unconverted address-of argument.
 *
 * Only the written spelling is read, because this runs before the argument is analyzed — which is
 * the point: once the conversion rule has had its say the value is gone, and the write would be
 * reported as a conversion mistake rather than as the installation it was meant to be.
 *
 * A name that cannot be resolved to an interrupt function yields null, leaving the ordinary
 * conversion rule to reject the write. That is a weaker message but never a wrong one.
 *
 * @param argument Exact value argument as written.
 * @param context Enclosing scope the name resolves in.
 * @param host Frontend services for resolution and source text.
 * @returns The handler's source spelling, or null when the argument is not one.
 */
function bareInterruptHandler(
  argument: Expr,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
): string | null {
  if (argument.kind !== "unary" || argument.operator !== "&") return null;
  const operand = argument.operand;
  if (operand === undefined || (operand.kind !== "name" && operand.kind !== "member")) return null;
  const name = host.sourceText(operand.span);
  const resolved = host.resolveName(name, context);
  if (resolved === null) return null;
  return resolved.binding.storage === "function" && resolved.binding.functionMode === "interrupt"
    ? name
    : null;
}

/**
 * Refuse a raw interrupt-entry address written straight into a recognized firmware vector.
 *
 * The address itself is real and the write would land. What cannot hold is the convention: each
 * vector is entered with its own stack and exit contract, and an entry compiled for one of them
 * does not satisfy another. The remedy is therefore the platform operation for that vector, which
 * picks the matching entry variant, rather than anything the author can do to the address.
 *
 * @param handlerName Source spelling of the interrupt function whose address was written.
 * @param vector Destination vector and the operation that owns it.
 * @param expression Exact write being refused.
 * @param context Enclosing scope, used to point at the handler's declaration.
 * @param host Frontend services for resolution.
 * @returns The refusal, with the handler's declaration attached when it can be found.
 * @example rawVectorHandlerError("onRaster", vector, expression, context, host)
 */
function rawVectorHandlerError(
  handlerName: string,
  vector: FirmwareVector,
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
): ProjectDiagnostic {
  const declaration = host.resolveName(handlerName, context);
  const name = `$${vector.address.toString(16).padStart(4, "0")}`;
  return projectDiagnostic(
    "E10252",
    `Raw interrupt-entry address for '${handlerName}' cannot be written directly to firmware vector '${name}' — use '${vector.sink}' so the compiler selects the required entry variant`,
    expression.span,
    null,
    declaration === null
      ? []
      : [{ span: declaration.nameSpan, message: "Interrupt function is declared here" }],
  );
}

/** Keep a visible handler address through an explicit word conversion. */
function handlerAddress(expression: TypedExpr): TypedExpr | null {
  if (expression.type.kind === "interrupt-handler") return expression;
  const operand = expression.operand;
  return expression.kind === "cast" && operand !== undefined && "type" in operand
    ? handlerAddress(operand)
    : null;
}

/** Type raw-memory and byte-extraction built-ins without fabricating declarations. */
export function analyzeBuiltinCall(
  expression: Extract<Expr, { readonly kind: "call" }>,
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult | null {
  const name = expression.callee.kind === "name" ? expression.callee.name : "";
  const machineIntrinsic = analyzeMachineIntrinsic(expression, name, context, host, analyze);
  if (machineIntrinsic !== null) return machineIntrinsic;
  if (name === "embed") {
    const embedded = host.embeddedValue(expression);
    if (embedded === null) return null;
    if (embedded.kind === "embedded-scalar") {
      return {
        node: createScalarTypedExpression(expression, embedded.type, embedded.value, {
          embedded,
          evaluation: "left-to-right",
        }),
        exact: embedded.value,
      };
    }
    return {
      node: createScalarTypedExpression(expression, embedded.type, null, {
        embedded,
        initialized: Object.freeze([{ start: 0, end: embedded.type.length }]),
        evaluation: "left-to-right",
      }),
      exact: null,
    };
  }
  if (name === "lo" || name === "hi") {
    return analyzeByteExtraction(expression, name, context, host, analyze);
  }
  const signatures: Readonly<
    Record<
      string,
      {
        readonly parameters: readonly SemanticType[];
        readonly result: SemanticType;
        readonly memory: NonNullable<TypedExpr["memory"]> | null;
      }
    >
  > = {
    peek: { parameters: [SCALAR_TYPES.word], result: SCALAR_TYPES.byte, memory: memory("read", 1) },
    poke: {
      parameters: [SCALAR_TYPES.word, SCALAR_TYPES.byte],
      result: SCALAR_TYPES.void,
      memory: memory("write", 1),
    },
    peekw: {
      parameters: [SCALAR_TYPES.word],
      result: SCALAR_TYPES.word,
      memory: memory("read", 2),
    },
    pokew: {
      parameters: [SCALAR_TYPES.word, SCALAR_TYPES.word],
      result: SCALAR_TYPES.void,
      memory: memory("write", 2),
    },
  };
  const builtin = signatures[name];
  if (builtin === undefined) return null;
  if (
    context.constantContext ||
    (context.caller !== null && host.functionMode?.(context.caller) === "comptime")
  ) {
    host.diagnose(
      projectDiagnostic(
        "E10191",
        `Expression must be compile-time evaluable — '${host.sourceText(expression.span)}' accesses runtime memory`,
        expression.span,
      ),
    );
    for (const argument of expression.arguments) analyze(argument, null, context);
    return { node: null, exact: null };
  }
  let valid = expression.arguments.length === builtin.parameters.length;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects ${builtin.parameters.length} parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  const arguments_: TypedExpr[] = [];
  // Set once the address argument has proved to be a compile-time firmware vector, so the value
  // argument can be judged against the vector it is about to overwrite.
  let vector: FirmwareVector | null = null;
  expression.arguments.forEach((argument, index) => {
    if (index === 1 && vector !== null) {
      // A bare handler address is the spelling the platform appendix rejects outright, and it has
      // to be recognized here, before the value is converted. Left to the generic conversion rule
      // it would send its author to write an explicit 'word(...)' that this same diagnostic then
      // rejects in turn, while saying nothing about the sink that would have worked.
      const bare = bareInterruptHandler(argument, context, host);
      if (bare !== null) {
        host.diagnose(rawVectorHandlerError(bare, vector, expression, context, host));
        valid = false;
        return;
      }
    }
    const result = analyze(argument, builtin.parameters[index] ?? null, {
      ...context,
      ordinalContext: false,
    });
    if (result.node === null) {
      valid = false;
      return;
    }
    arguments_.push(result.node);
    if (index === 0 && name === "pokew" && typeof result.node.constant === "bigint") {
      const sink = firmwareVectorSink(host.profileId ?? null, result.node.constant);
      if (sink !== null) vector = { address: result.node.constant, sink };
    }
  });
  if (!valid) return { node: null, exact: null };
  const converted = arguments_[1] === undefined ? null : handlerAddress(arguments_[1]);
  if (vector !== null && converted !== null) {
    const operand = converted.operand;
    host.diagnose(
      rawVectorHandlerError(
        operand !== undefined && "type" in operand
          ? host.sourceText(operand.span)
          : host.sourceText(converted.span),
        vector,
        expression,
        context,
        host,
      ),
    );
    return { node: null, exact: null };
  }
  if (
    (name === "poke" || name === "pokew") &&
    arguments_[0]?.addressPlaces?.some((place) => place.readonly)
  ) {
    const origins = arguments_[0].addressPlaces
      .filter((place) => place.readonly)
      .map((place) => scopedBorrowOrigin(place.binding, context.scope));
    host.diagnose(
      projectDiagnostic(
        "E10123",
        `Cannot modify through read-only origin '${origins.map((origin) => origin.name).join(", ")}'`,
        expression.arguments[0]?.span ?? expression.span,
        null,
        origins.map((origin) => ({ span: origin.span, message: "Read-only origin declared here" })),
      ),
    );
    return { node: null, exact: null };
  }
  if (builtin.memory !== null) clearCallVisibleScalarFacts(context.scope);
  const signature: FunctionSignature = Object.freeze({
    parameters: Object.freeze(
      builtin.parameters.map((type) => Object.freeze({ type, readonly: false })),
    ),
    returnType: builtin.result,
  });
  const callee = createScalarTypedExpression(expression.callee, builtin.result, null, {
    name,
  });
  return {
    node: createScalarTypedExpression(expression, builtin.result, null, {
      callee,
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      memory: builtin.memory,
      integer: integerFacts(builtin.result, true),
    }),
    exact: null,
  };
}

/** Type low/high-byte extraction for every fixed-width integer input. */
function analyzeByteExtraction(
  expression: Extract<Expr, { readonly kind: "call" }>,
  name: "lo" | "hi",
  context: ScalarExpressionContext,
  host: ScalarExpressionHost,
  analyze: AnalyzeExpression,
): ScalarExpressionResult {
  let valid = expression.arguments.length === 1;
  if (!valid) {
    host.diagnose(
      projectDiagnostic(
        "E10171",
        `Wrong argument count — '${name}()' expects 1 parameters, got ${expression.arguments.length}`,
        expression.span,
      ),
    );
  }
  const arguments_: TypedExpr[] = [];
  for (const argument of expression.arguments) {
    const result = analyze(argument, null, { ...context, ordinalContext: false });
    if (result.node === null) valid = false;
    else arguments_.push(result.node);
  }
  const argument = arguments_[0];
  const boolean = argument?.type.kind === "scalar" && argument.type.name === "boolean";
  if (argument !== undefined && !isIntegerType(argument.type)) {
    host.diagnose(
      projectDiagnostic(
        boolean ? "E10086" : "E10080",
        boolean
          ? "Cannot cast 'boolean' to 'word' — boolean is not convertible to or from an integer"
          : `Cannot implicitly convert '${semanticTypeName(argument.type)}' to 'word' — '${name}()' requires an integer value`,
        expression.arguments[0]!.span,
      ),
    );
    valid = false;
  }
  if (!valid || argument === undefined || !isIntegerType(argument.type)) {
    return { node: null, exact: null };
  }
  const facts = integerFacts(argument.type, false)!;
  let bits =
    typeof argument.constant === "bigint"
      ? argument.constant & ((1n << BigInt(facts.width)) - 1n)
      : null;
  if (name === "hi" && bits !== null && facts.width === 8 && facts.signed && bits >= 0x80n) {
    bits |= 0xff00n;
  }
  const constant = bits === null ? null : name === "lo" ? bits & 0xffn : (bits >> 8n) & 0xffn;
  const signature: FunctionSignature = Object.freeze({
    parameters: Object.freeze([Object.freeze({ type: argument.type, readonly: false })]),
    returnType: SCALAR_TYPES.byte,
  });
  const callee = createScalarTypedExpression(expression.callee, SCALAR_TYPES.byte, null, { name });
  return {
    node: createScalarTypedExpression(expression, SCALAR_TYPES.byte, constant, {
      callee,
      arguments: Object.freeze(arguments_),
      signature,
      evaluation: "left-to-right",
      integer: integerFacts(SCALAR_TYPES.byte, true),
    }),
    exact: constant,
  };
}

/** Create immutable raw-memory metadata. */
function memory(access: "read" | "write", width: 1 | 2): NonNullable<TypedExpr["memory"]> {
  return Object.freeze({ volatile: true, access, width, byteOrder: "low-first" });
}
