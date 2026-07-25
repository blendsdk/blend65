import { isGenIdentifier, isScalarType } from "./generator-ir.js";
import type { BinaryOperator, GenIdentifier, ScalarType, UnaryOperator } from "./generator-ir.js";
import type {
  RoundTripDiagnostic,
  RoundTripExpression,
  RoundTripFunction,
  RoundTripModule,
  RoundTripParseResult,
  RoundTripStatement,
} from "./roundtrip-model.js";
import { tokenizeRoundTripSource } from "./roundtrip-tokenizer.js";
import type { RoundTripToken, RoundTripTokenKind } from "./roundtrip-tokenizer.js";

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: true });
const MAX_ROUND_TRIP_SOURCE_BYTES = 1_048_576;

const INVERSE_BINDING_POWER: Readonly<Record<BinaryOperator, number>> = Object.freeze({
  "*": 11,
  "/": 11,
  "%": 11,
  "+": 10,
  "-": 10,
  "<<": 9,
  ">>": 9,
  "<": 8,
  "<=": 8,
  ">": 8,
  ">=": 8,
  "==": 7,
  "!=": 7,
  "&": 6,
  "^": 5,
  "|": 4,
});

class ParseFailure extends Error {
  readonly offset: number;

  constructor(offset: number) {
    super("unsupported source");
    this.offset = offset;
  }
}

function failure(
  code: RoundTripDiagnostic["code"],
  path: string,
  message: string,
): RoundTripParseResult {
  return {
    ok: false,
    diagnostics: [Object.freeze({ code, path, message })],
  };
}

function intrinsicByteLength(value: Uint8Array): number | undefined {
  try {
    const byteLength = Reflect.get(Uint8Array.prototype, "byteLength", value);
    return typeof byteLength === "number" ? byteLength : undefined;
  } catch {
    return undefined;
  }
}

function asIdentifier(token: RoundTripToken): GenIdentifier {
  if (token.kind !== "identifier" || !isGenIdentifier(token.lexeme)) {
    throw new ParseFailure(token.offset);
  }
  return token.lexeme;
}

function asModulePathSegment(token: RoundTripToken): GenIdentifier {
  if (!isGenIdentifier(token.lexeme)) {
    throw new ParseFailure(token.offset);
  }
  return token.lexeme;
}

function asScalarType(token: RoundTripToken): ScalarType {
  if (token.kind !== "scalar-type" || !isScalarType(token.lexeme)) {
    throw new ParseFailure(token.offset);
  }
  return token.lexeme;
}

function asBinaryOperator(lexeme: string): BinaryOperator | undefined {
  switch (lexeme) {
    case "+":
    case "-":
    case "*":
    case "/":
    case "%":
    case "&":
    case "|":
    case "^":
    case "<<":
    case ">>":
    case "==":
    case "!=":
    case "<":
    case "<=":
    case ">":
    case ">=":
      return lexeme;
    default:
      return undefined;
  }
}

function asUnaryOperator(lexeme: string): UnaryOperator | undefined {
  return lexeme === "-" || lexeme === "~" || lexeme === "!" ? lexeme : undefined;
}

function parseInteger(token: RoundTripToken): bigint {
  if (token.kind !== "integer") {
    throw new ParseFailure(token.offset);
  }
  if (token.lexeme.startsWith("$")) {
    return BigInt(`0x${token.lexeme.slice(1)}`);
  }
  return BigInt(token.lexeme);
}

class Parser {
  readonly tokens: readonly RoundTripToken[];
  cursor = 0;
  environment = new Map<string, ScalarType>();

  constructor(tokens: readonly RoundTripToken[]) {
    this.tokens = tokens;
  }

  current(): RoundTripToken {
    const token = this.tokens[this.cursor];
    if (token === undefined) {
      throw new ParseFailure(this.tokens.at(-1)?.offset ?? 0);
    }
    return token;
  }

  advance(): RoundTripToken {
    const token = this.current();
    this.cursor += 1;
    return token;
  }

  expect(kind: RoundTripTokenKind, lexeme?: string): RoundTripToken {
    const token = this.current();
    if (token.kind !== kind || (lexeme !== undefined && token.lexeme !== lexeme)) {
      throw new ParseFailure(token.offset);
    }
    this.cursor += 1;
    return token;
  }

  parseModule(): RoundTripModule {
    this.expect("module");
    const path: GenIdentifier[] = [asModulePathSegment(this.advance())];
    while (this.current().kind === "dot") {
      this.advance();
      path.push(asModulePathSegment(this.advance()));
    }
    this.expect("semicolon");

    const constants = [];
    const functions: RoundTripFunction[] = [];
    while (this.current().kind === "const") {
      this.advance();
      const name = asIdentifier(this.expect("identifier"));
      this.expect("colon");
      const type = asScalarType(this.expect("scalar-type"));
      this.expect("operator", "=");
      const value = this.parseExpression(0, type);
      this.expect("semicolon");
      this.environment.set(name, type);
      constants.push(Object.freeze({ kind: "const" as const, name, type, value }));
    }
    while (this.current().kind === "function") {
      functions.push(this.parseFunction());
    }
    this.expect("eof");
    return Object.freeze({
      kind: "module",
      path: Object.freeze(path),
      constants: Object.freeze(constants),
      functions: Object.freeze(functions),
    });
  }

  parseFunction(): RoundTripFunction {
    this.expect("function");
    const name = asIdentifier(this.expect("identifier"));
    this.expect("lparen");
    const parameters = [];
    const previousEnvironment = this.environment;
    this.environment = new Map(previousEnvironment);
    if (this.current().kind !== "rparen") {
      do {
        const parameterName = asIdentifier(this.expect("identifier"));
        this.expect("colon");
        const parameterType = asScalarType(this.expect("scalar-type"));
        parameters.push(Object.freeze({ name: parameterName, type: parameterType }));
        this.environment.set(parameterName, parameterType);
        if (this.current().kind !== "comma") {
          break;
        }
        this.advance();
      } while (true);
    }
    this.expect("rparen");
    this.expect("colon");
    const returnToken = this.advance();
    const returnType = returnToken.kind === "void" ? "void" : asScalarType(returnToken);
    this.expect("lbrace");
    const body: RoundTripStatement[] = [];
    while (this.current().kind !== "rbrace") {
      body.push(this.parseStatement());
    }
    this.expect("rbrace");
    this.environment = previousEnvironment;
    return Object.freeze({
      kind: "function",
      name,
      parameters: Object.freeze(parameters),
      returnType,
      body: Object.freeze(body),
    });
  }

  parseStatement(): RoundTripStatement {
    const token = this.current();
    if (token.kind === "let") {
      this.advance();
      const name = asIdentifier(this.expect("identifier"));
      this.expect("colon");
      const type = asScalarType(this.expect("scalar-type"));
      this.expect("operator", "=");
      const initializer = this.parseExpression(0, type);
      this.expect("semicolon");
      this.environment.set(name, type);
      return Object.freeze({ kind: "local", name, type, initializer });
    }
    if (token.kind === "return") {
      this.advance();
      if (this.current().kind === "semicolon") {
        this.advance();
        return Object.freeze({ kind: "return" });
      }
      const value = this.parseExpression(0, "word");
      this.expect("semicolon");
      return Object.freeze({ kind: "return", value });
    }
    if (
      token.kind === "poke" ||
      token.kind === "pokew" ||
      (token.kind === "identifier" &&
        (token.lexeme === "poke" || token.lexeme === "pokew") &&
        this.tokens[this.cursor + 1]?.kind === "lparen")
    ) {
      const width = token.kind === "poke" || token.lexeme === "poke" ? 1 : 2;
      const intrinsic = width === 1 ? "poke" : "pokew";
      this.advance();
      this.expect("lparen");
      const argumentsValue = this.parseIntrinsicArguments(["word", width === 1 ? "byte" : "word"]);
      this.expect("semicolon");
      if (argumentsValue.length !== 2) {
        return Object.freeze({
          kind: "invalid-memory-write",
          intrinsic,
          arguments: argumentsValue,
        });
      }
      const address = argumentsValue[0];
      const value = argumentsValue[1];
      if (address === undefined || value === undefined) {
        throw new ParseFailure(token.offset);
      }
      return Object.freeze({ kind: "memory-write", width, address, value });
    }
    const target = asIdentifier(this.expect("identifier"));
    const type = this.environment.get(target) ?? "word";
    this.expect("operator", "=");
    const value = this.parseExpression(0, type);
    this.expect("semicolon");
    return Object.freeze({ kind: "assign", target, value });
  }

  parseIntrinsicArguments(expectedTypes: readonly ScalarType[]): readonly RoundTripExpression[] {
    const argumentsValue: RoundTripExpression[] = [];
    while (this.current().kind !== "rparen") {
      const expectedType = expectedTypes[argumentsValue.length] ?? "word";
      argumentsValue.push(this.parseExpression(0, expectedType));
      if (this.current().kind !== "comma") break;
      this.advance();
    }
    this.expect("rparen");
    return Object.freeze(argumentsValue);
  }

  parseExpression(minimumBindingPower: number, expectedType: ScalarType): RoundTripExpression {
    let left = this.parsePrefix(expectedType);
    while (true) {
      const token = this.current();
      if (token.kind !== "operator") {
        break;
      }
      const operator = asBinaryOperator(token.lexeme);
      if (operator === undefined) {
        break;
      }
      const bindingPower = INVERSE_BINDING_POWER[operator];
      if (bindingPower < minimumBindingPower) {
        break;
      }
      this.advance();
      const right = this.parseExpression(bindingPower + 1, expectedType);
      left = Object.freeze({ kind: "binary", operator, left, right });
    }
    return left;
  }

  parsePrefix(expectedType: ScalarType): RoundTripExpression {
    const token = this.advance();
    if (token.kind === "boolean-literal") {
      return Object.freeze({
        kind: "boolean-literal",
        value: token.lexeme === "true",
      });
    }
    if (token.kind === "integer") {
      return Object.freeze({
        kind: "integer-literal",
        value: parseInteger(token),
        spelling: token.spelling ?? "decimal",
      });
    }
    if (
      (token.kind === "peek" ||
        token.kind === "peekw" ||
        (token.kind === "identifier" && (token.lexeme === "peek" || token.lexeme === "peekw"))) &&
      this.current().kind === "lparen"
    ) {
      const width = token.kind === "peek" || token.lexeme === "peek" ? 1 : 2;
      const intrinsic = width === 1 ? "peek" : "peekw";
      this.expect("lparen");
      const argumentsValue = this.parseIntrinsicArguments(["word"]);
      if (argumentsValue.length !== 1) {
        return Object.freeze({
          kind: "invalid-memory-read",
          intrinsic,
          arguments: argumentsValue,
        });
      }
      const address = argumentsValue[0];
      if (address === undefined) throw new ParseFailure(token.offset);
      return Object.freeze({
        kind: "memory-read",
        width,
        address,
      });
    }
    if (token.kind === "identifier") {
      return Object.freeze({
        kind: "name",
        name: asIdentifier(token),
      });
    }
    if (token.kind === "lparen") {
      const expression = this.parseExpression(0, expectedType);
      this.expect("rparen");
      return expression;
    }
    if (token.kind === "operator") {
      const operator = asUnaryOperator(token.lexeme);
      if (operator !== undefined) {
        const groupedOperand = this.current().kind === "lparen";
        const operand = this.parseExpression(13, expectedType);
        if (operator === "-" && operand.kind === "integer-literal" && !groupedOperand) {
          return Object.freeze({ ...operand, value: -operand.value });
        }
        return Object.freeze({
          kind: "unary",
          operator,
          operand,
        });
      }
    }
    throw new ParseFailure(token.offset);
  }
}

/**
 * Independently parses deterministic Blend65 source into a structure-only projection.
 *
 * @param sourceBytes Untrusted UTF-8 source bytes.
 * @param maxSourceBytes Positive caller limit, capped at 1 MiB.
 * @returns Complete projection or one bounded diagnostic; never partial state.
 *
 * @example
 * ```ts
 * const parsed = parseRenderedSource(bytes, 4096);
 * ```
 */
export function parseRenderedSource(
  sourceBytes: Uint8Array,
  maxSourceBytes: number,
): RoundTripParseResult {
  if (
    typeof sourceBytes !== "object" ||
    sourceBytes === null ||
    typeof maxSourceBytes !== "number" ||
    !Number.isSafeInteger(maxSourceBytes) ||
    maxSourceBytes < 1 ||
    maxSourceBytes > MAX_ROUND_TRIP_SOURCE_BYTES
  ) {
    return failure("roundtrip.input.invalid", "/source", "expected bounded source bytes");
  }
  const byteLength = intrinsicByteLength(sourceBytes);
  if (byteLength === undefined) {
    return failure("roundtrip.input.invalid", "/source", "expected intrinsic Uint8Array bytes");
  }
  if (byteLength > maxSourceBytes) {
    return failure(
      "roundtrip.input.source-bytes",
      "/source",
      "source exceeds the configured byte limit",
    );
  }
  let source: string;
  try {
    source = TEXT_DECODER.decode(sourceBytes);
  } catch {
    return failure("roundtrip.input.invalid-utf8", "/source/0", "source is not valid UTF-8");
  }
  const tokenized = tokenizeRoundTripSource(source);
  if (!tokenized.ok) {
    return tokenized;
  }
  try {
    const projection = new Parser(tokenized.tokens).parseModule();
    return { ok: true, projection, diagnostics: [] };
  } catch (error) {
    const offset = error instanceof ParseFailure ? error.offset : 0;
    return failure(
      "roundtrip-unsupported",
      `/source/${offset}`,
      "source is outside the independently parsed subset",
    );
  }
}
