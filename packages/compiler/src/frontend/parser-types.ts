import type { DeclarationContext } from "./parser-declarations.js";
import { PAYLOAD_KIND, TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type { Expr, FunctionTypeParameter, FunctionTypeSyntax, TypeSyntax } from "./syntax.js";

/** Primitive and no-value type spellings keyed by their fixed tokens. */
const TYPE_NAMES: Readonly<Partial<Record<TokenKind, string>>> = Object.freeze({
  [TokenKind.KW_BYTE]: "byte",
  [TokenKind.KW_SBYTE]: "sbyte",
  [TokenKind.KW_WORD]: "word",
  [TokenKind.KW_SWORD]: "sword",
  [TokenKind.KW_BOOLEAN]: "boolean",
  [TokenKind.KW_VOID]: "void",
});

/** Parse recursive type spellings through the source parser's shared cursor. */
export class TypeParser {
  /** Bound recursive type spelling before host stack exhaustion. */
  private typeDepth = 0;

  constructor(private readonly context: DeclarationContext) {}

  /** Parse a primitive, qualified, function, or fixed-array type form. */
  parseType(): TypeSyntax | null {
    if (this.typeDepth >= 256) {
      this.context.complete = false;
      return null;
    }
    this.typeDepth += 1;
    try {
      return this.parseTypeBody();
    } finally {
      this.typeDepth -= 1;
    }
  }

  /** Parse the base type and zero or more array dimensions. */
  private parseTypeBody(): TypeSyntax | null {
    const start = this.context.current;
    let type: TypeSyntax;
    if (this.context.check(TokenKind.KW_FN)) {
      const functionType = this.parseFunctionType();
      if (functionType === null) return null;
      type = functionType;
    } else if (this.context.match(TokenKind.LPAREN) !== null) {
      const functionType = this.parseFunctionType();
      if (functionType === null) return null;
      const closer = this.context.expect(TokenKind.RPAREN, "')'", start);
      if (closer === null) return null;
      type = Object.freeze({ ...functionType, span: this.context.spanFrom(start, closer) });
    } else {
      let name = TYPE_NAMES[start.kind] ?? null;
      let end = start;
      if (name !== null) {
        this.context.advance();
      } else if (start.kind === TokenKind.IDENTIFIER) {
        this.context.advance();
        name = this.identifier(start);
        if (name === null) return null;
        while (this.context.match(TokenKind.DOT) !== null) {
          const part = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
          if (part === null) return null;
          const text = this.identifier(part);
          if (text === null) return null;
          name += "." + text;
          end = part;
        }
      } else {
        this.context.reportExpected("a type");
        return null;
      }
      type = Object.freeze({ kind: "named-type", span: this.context.spanFrom(start, end), name });
    }
    const dimensions: { readonly extent: Expr | null; readonly end: number }[] = [];
    while (this.context.match(TokenKind.LBRACKET) !== null) {
      const opener = this.context.tokens[this.context.index - 1]!;
      const extent = this.context.check(TokenKind.RBRACKET) ? null : this.context.parseExpression();
      if (!this.context.check(TokenKind.RBRACKET) && extent === null) return null;
      const closer = this.context.expect(TokenKind.RBRACKET, "']'", opener);
      if (closer === null) return null;
      dimensions.push({ extent, end: closer.span.end });
    }
    // The first written dimension is the outermost one: byte[2][3] is two rows of three bytes.
    // Wrap from the last dimension so each array node's element denotes its inner row.
    const completeEnd = dimensions.at(-1)?.end;
    for (let index = dimensions.length - 1; index >= 0; index -= 1) {
      const dimension = dimensions[index]!;
      type = Object.freeze({
        kind: "array-type",
        span: Object.freeze({
          sourceId: this.context.source.sourceId,
          start: type.span.start,
          end: completeEnd ?? dimension.end,
        }),
        element: type,
        extent: dimension.extent,
      });
    }
    return type;
  }

  /** Parse exact unnamed parameters and return type of a function value. */
  private parseFunctionType(): FunctionTypeSyntax | null {
    const start = this.context.advance();
    if (start.kind !== TokenKind.KW_FN) {
      this.context.reportExpected("'fn'");
      return null;
    }
    const opener = this.context.expect(TokenKind.LPAREN, "'('");
    if (opener === null) return null;
    const parameters: FunctionTypeParameter[] = [];
    if (!this.context.check(TokenKind.RPAREN)) {
      do {
        const parameterStart = this.context.current;
        const readonly = this.context.match(TokenKind.KW_CONST) !== null;
        const type = this.parseType();
        if (type === null) return null;
        parameters.push(
          Object.freeze({ readonly, type, span: this.context.spanFrom(parameterStart, type) }),
        );
      } while (this.context.match(TokenKind.COMMA) !== null);
    }
    if (this.context.expect(TokenKind.RPAREN, "')'", opener) === null) return null;
    if (this.context.expect(TokenKind.COLON, "':'") === null) return null;
    const returnType = this.parseType();
    if (returnType === null) return null;
    return Object.freeze({
      kind: "function-type",
      span: this.context.spanFrom(start, returnType),
      parameters: Object.freeze(parameters),
      returnType,
    });
  }

  /** Extract the validated identifier spelling carried by a token. */
  private identifier(token: Token): string | null {
    return token.payload?.kind === PAYLOAD_KIND.identifier ? token.payload.text : null;
  }
}
