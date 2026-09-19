import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { sortFrontendDiagnostics, syntaxDiagnostic } from "./diagnostics.js";
import { parseExpression as parseOwnedExpression } from "./expressions.js";
import type { ExpressionContext } from "./expressions.js";
import { lexSource } from "./lexer.js";
import { parseBlock } from "./statements.js";
import type { StatementContext } from "./statements.js";
import { PAYLOAD_KIND, TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type {
  Declaration,
  Expr,
  FunctionDeclaration,
  FunctionParameter,
  HeaderResult,
  ImportDeclaration,
  ImportItem,
  ModuleHeader,
  ParseResult,
  PoisonStatement,
  StructDeclaration,
  StructField,
  SyntaxUnit,
  TypeSyntax,
  UncheckedSyntax,
  VariableDeclaration,
} from "./syntax.js";

/** Language errors are bounded independently from warning observations. */
const MAX_ERRORS = 20;

/** Primitive and no-value type spellings keyed by their fixed tokens. */
const TYPE_NAMES: Readonly<Partial<Record<TokenKind, string>>> = Object.freeze({
  [TokenKind.KW_BYTE]: "byte",
  [TokenKind.KW_SBYTE]: "sbyte",
  [TokenKind.KW_WORD]: "word",
  [TokenKind.KW_SWORD]: "sword",
  [TokenKind.KW_BOOLEAN]: "boolean",
  [TokenKind.KW_VOID]: "void",
});

/** Parse one source with a single shared token cursor and recovery state. */
class Parser implements ExpressionContext, StatementContext {
  /** Tokens include one zero-width EOF marker. */
  readonly tokens: readonly Token[];
  /** Reports from scanning and parsing before deterministic final ordering. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Deferred valid-language regions in source order. */
  readonly unchecked: SourceSpan[] = [];
  /** Current token index; it never advances beyond EOF. */
  index = 0;
  /** Completion becomes false after poison, truncation, or an unchecked region. */
  complete: boolean;
  /** Error count excludes warnings. */
  errorCount: number;
  /** Host-recursion guard; exhaustion leaves syntax incomplete without a language error. */
  expressionDepth = 0;
  /** Nested block count used to keep hostile input inside the host stack limit. */
  blockDepth = 0;

  /** Preserve the immutable source while sharing lexer output. */
  constructor(readonly source: SourceRecord) {
    const lexical = lexSource(source);
    this.tokens = lexical.tokens;
    this.diagnostics = [...lexical.diagnostics];
    this.errorCount = lexical.diagnostics.filter(({ severity }) => severity === "error").length;
    this.complete = lexical.complete && lexical.poisoned.length === 0;
  }

  /** Token currently being considered. */
  get current(): Token {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!;
  }

  /** Consume and return the current token. */
  advance(): Token {
    const token = this.current;
    if (token.kind !== TokenKind.EOF) this.index += 1;
    return token;
  }

  /** Test the current token without consuming it. */
  check(kind: TokenKind): boolean {
    return this.current.kind === kind;
  }

  /** Consume the current token only when it has the requested kind. */
  match(kind: TokenKind): Token | null {
    return this.check(kind) ? this.advance() : null;
  }

  /** Consume a required token or record one grammar error. */
  expect(kind: TokenKind, expected: string, opener?: Token): Token | null {
    if (this.check(kind)) return this.advance();
    this.reportExpected(expected, opener);
    return null;
  }

  /** Record one approved syntax expectation at the current token. */
  reportExpected(expected: string, opener?: Token): void {
    this.addDiagnostic(syntaxDiagnostic(expected, this.current, opener));
  }

  /** Delegate every expression position to the one Pratt parser. */
  parseExpression(minBindingPower = 1): Expr | null {
    if (this.expressionDepth >= 256) {
      this.complete = false;
      return null;
    }
    this.expressionDepth += 1;
    try {
      return parseOwnedExpression(this, minBindingPower);
    } finally {
      this.expressionDepth -= 1;
    }
  }

  /** Enter one structured block unless the bounded recursion budget is exhausted. */
  enterBlock(): boolean {
    if (this.blockDepth >= 256) {
      this.complete = false;
      return false;
    }
    this.blockDepth += 1;
    return true;
  }

  /** Release one structured block recursion slot. */
  leaveBlock(): void {
    this.blockDepth = Math.max(0, this.blockDepth - 1);
  }

  /** Build a span from a starting token through a token, node, or byte boundary. */
  spanFrom(start: Token, end: Token | { readonly span: SourceSpan } | number): SourceSpan {
    return Object.freeze({
      sourceId: this.source.sourceId,
      start: start.span.start,
      end: typeof end === "number" ? end : end.span.end,
    });
  }

  /** Return the exact identifier payload carried by a validated identifier token. */
  identifier(token: Token): string | null {
    return token.payload?.kind === PAYLOAD_KIND.identifier ? token.payload.text : null;
  }

  /** Record a diagnostic while enforcing the shared twenty-error ceiling. */
  addDiagnostic(diagnostic: ProjectDiagnostic): void {
    if (diagnostic.severity === "error") {
      this.complete = false;
      if (this.errorCount >= MAX_ERRORS) return;
      this.errorCount += 1;
    }
    this.diagnostics.push(diagnostic);
  }

  /** Parse a primitive, qualified, array, or explicitly unchecked type form. */
  parseType(): TypeSyntax | null {
    if (this.check(TokenKind.KW_FN)) return this.parseUncheckedFunctionType();
    const start = this.current;
    let name = TYPE_NAMES[start.kind] ?? null;
    let end = start;
    if (name !== null) {
      this.advance();
    } else if (start.kind === TokenKind.IDENTIFIER) {
      this.advance();
      name = this.identifier(start);
      if (name === null) return null;
      while (this.match(TokenKind.DOT) !== null) {
        const part = this.expect(TokenKind.IDENTIFIER, "an identifier");
        if (part === null) return null;
        const text = this.identifier(part);
        if (text === null) return null;
        name += "." + text;
        end = part;
      }
    } else {
      this.reportExpected("a type");
      return null;
    }

    let type: TypeSyntax = Object.freeze({
      kind: "named-type",
      span: this.spanFrom(start, end),
      name,
    });
    while (this.match(TokenKind.LBRACKET) !== null) {
      const opener = this.tokens[this.index - 1]!;
      const extent = this.check(TokenKind.RBRACKET) ? null : this.parseExpression();
      if (!this.check(TokenKind.RBRACKET) && extent === null) return null;
      const closer = this.expect(TokenKind.RBRACKET, "']'", opener);
      if (closer === null) return null;
      type = Object.freeze({
        kind: "array-type",
        span: Object.freeze({
          sourceId: this.source.sourceId,
          start: type.span.start,
          end: closer.span.end,
        }),
        element: type,
        extent,
      });
    }
    return type;
  }

  /** Retain a function type as one bounded pending-language region. */
  parseUncheckedFunctionType(): UncheckedSyntax {
    const start = this.advance();
    let depth = 0;
    let end = start.span.end;
    while (!this.check(TokenKind.EOF)) {
      if (
        depth === 0 &&
        (this.check(TokenKind.SEMICOLON) ||
          this.check(TokenKind.COMMA) ||
          this.check(TokenKind.EQUAL) ||
          this.check(TokenKind.RPAREN))
      ) {
        break;
      }
      const token = this.advance();
      if (token.kind === TokenKind.LPAREN) depth += 1;
      if (token.kind === TokenKind.RPAREN) depth -= 1;
      end = token.span.end;
    }
    const span = this.spanFrom(start, end);
    this.unchecked.push(span);
    this.complete = false;
    return Object.freeze({ kind: "unchecked", span });
  }

  /** Parse a dotted identifier sequence. */
  parseQualifiedName(): { readonly name: string; readonly span: SourceSpan } | null {
    const first = this.expect(TokenKind.IDENTIFIER, "an identifier");
    if (first === null) return null;
    let name = this.identifier(first);
    if (name === null) return null;
    let end = first;
    while (this.match(TokenKind.DOT) !== null) {
      const part = this.expect(TokenKind.IDENTIFIER, "an identifier");
      if (part === null) return null;
      const text = this.identifier(part);
      if (text === null) return null;
      name += "." + text;
      end = part;
    }
    return Object.freeze({ name, span: this.spanFrom(first, end) });
  }

  /** Parse one complete leading module declaration. */
  parseModuleHeader(): ModuleHeader | null {
    const start = this.expect(TokenKind.KW_MODULE, "'module'");
    if (start === null) return null;
    const qualified = this.parseQualifiedName();
    if (qualified === null) return null;
    const closer = this.expect(TokenKind.SEMICOLON, "';'");
    if (closer === null) return null;
    return Object.freeze({
      kind: "module",
      span: this.spanFrom(start, closer),
      name: qualified.name,
      nameSpan: qualified.span,
    });
  }

  /** Parse one import declaration with contextual aliases. */
  parseImport(): ImportDeclaration | null {
    const start = this.advance();
    const opener = this.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const items: ImportItem[] = [];
    do {
      const nameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
      if (nameToken === null) return null;
      const name = this.identifier(nameToken);
      if (name === null) return null;
      let alias: string | null = null;
      let aliasSpan: SourceSpan | null = null;
      let end = nameToken;
      if (
        this.current.payload?.kind === PAYLOAD_KIND.identifier &&
        this.current.payload.text === "as"
      ) {
        this.advance();
        const aliasToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
        if (aliasToken === null) return null;
        alias = this.identifier(aliasToken);
        aliasSpan = aliasToken.span;
        end = aliasToken;
      }
      items.push(
        Object.freeze({
          name,
          nameSpan: nameToken.span,
          alias,
          aliasSpan,
          span: this.spanFrom(nameToken, end),
        }),
      );
    } while (this.match(TokenKind.COMMA) !== null);
    if (this.expect(TokenKind.RBRACE, "'}'", opener) === null) return null;
    if (this.expect(TokenKind.KW_FROM, "'from'") === null) return null;
    const module = this.parseQualifiedName();
    if (module === null) return null;
    const closer = this.expect(TokenKind.SEMICOLON, "';'");
    if (closer === null) return null;
    return Object.freeze({
      kind: "import",
      span: this.spanFrom(start, closer),
      module: module.name,
      moduleSpan: module.span,
      items: Object.freeze(items),
    });
  }

  /** Parse a variable declaration in module, block, or for-header position. */
  parseVariable(
    exported: boolean,
    requireSemicolon: boolean,
    declarationStart = this.current,
  ): VariableDeclaration | PoisonStatement | null {
    const start = declarationStart;
    const declarationToken = this.advance();
    const declarationKind = declarationToken.kind === TokenKind.KW_CONST ? "const" : "let";
    const nameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return this.recoverPoison(start);
    const name = this.identifier(nameToken);
    if (name === null) return this.recoverPoison(start);

    let type: TypeSyntax | null = null;
    let missingType = false;
    if (this.match(TokenKind.COLON) !== null) type = this.parseType();
    else missingType = true;

    let initializer: Expr | null = null;
    if (this.match(TokenKind.EQUAL) !== null) {
      initializer = this.parseExpression();
      if (initializer === null) return this.recoverPoison(start);
    }
    const missingInitializer = declarationKind === "const" && initializer === null;

    let end = initializer?.span.end ?? type?.span.end ?? nameToken.span.end;
    if (requireSemicolon) {
      const closer = this.match(TokenKind.SEMICOLON);
      if (closer === null) {
        this.reportExpected("';'");
        return this.recoverPoison(start, end);
      }
      end = closer.span.end;
    }
    const span = this.spanFrom(start, end);
    if (missingType) {
      this.addDiagnostic(
        projectDiagnostic(
          "E10150",
          `Type annotation required for variable '${name}' — add ': <type>'`,
          span,
        ),
      );
    }
    if (missingInitializer) {
      this.addDiagnostic(
        projectDiagnostic("E10190", `Const declaration '${name}' requires an initializer`, span),
      );
    }
    return Object.freeze({
      kind: "variable",
      span,
      name,
      nameSpan: nameToken.span,
      declarationKind,
      exported,
      type,
      initializer,
    });
  }

  /** Parse one ordinary function declaration and its structured body. */
  parseFunction(exported: boolean, start: Token): FunctionDeclaration | null {
    this.advance();
    const nameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = this.identifier(nameToken);
    if (name === null) return null;
    const opener = this.expect(TokenKind.LPAREN, "'('");
    if (opener === null) return null;
    const parameters: FunctionParameter[] = [];
    if (!this.check(TokenKind.RPAREN)) {
      do {
        const parameterStart = this.current;
        const parameterNameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
        if (parameterNameToken === null) return null;
        const parameterName = this.identifier(parameterNameToken);
        if (parameterName === null) return null;
        let readonly = false;
        let type: TypeSyntax | null = null;
        if (this.match(TokenKind.COLON) !== null) {
          readonly = this.match(TokenKind.KW_CONST) !== null;
          type = this.parseType();
          if (type === null) return null;
        } else {
          this.addDiagnostic(
            projectDiagnostic(
              "E10150",
              `Type annotation required for parameter '${parameterName}' — add ': <type>'`,
              parameterNameToken.span,
            ),
          );
          while (
            !this.check(TokenKind.COMMA) &&
            !this.check(TokenKind.RPAREN) &&
            !this.check(TokenKind.EOF)
          ) {
            this.advance();
          }
        }
        parameters.push(
          Object.freeze({
            name: parameterName,
            nameSpan: parameterNameToken.span,
            type,
            readonly,
            span: this.spanFrom(parameterStart, type ?? parameterNameToken),
          }),
        );
      } while (this.match(TokenKind.COMMA) !== null);
    }
    if (this.expect(TokenKind.RPAREN, "')'", opener) === null) return null;
    let returnType: TypeSyntax | null = null;
    const missingReturnType = this.match(TokenKind.COLON) === null;
    if (!missingReturnType) returnType = this.parseType();
    const body = parseBlock(this);
    const span = this.spanFrom(start, body);
    if (missingReturnType) {
      this.addDiagnostic(
        projectDiagnostic(
          "E10170",
          `Return type required — write 'function ${name}(): void' for a function that returns nothing`,
          span,
        ),
      );
    }
    return Object.freeze({
      kind: "function",
      span,
      name,
      nameSpan: nameToken.span,
      exported,
      parameters: Object.freeze(parameters),
      returnType,
      body,
    });
  }

  /** Parse one non-empty struct declaration. */
  parseStruct(exported: boolean, start: Token): StructDeclaration | null {
    this.advance();
    const nameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = this.identifier(nameToken);
    if (name === null) return null;
    const opener = this.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const fields: StructField[] = [];
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      const fieldStart = this.current;
      const fieldNameToken = this.expect(TokenKind.IDENTIFIER, "an identifier");
      if (fieldNameToken === null) return null;
      const fieldName = this.identifier(fieldNameToken);
      if (fieldName === null) return null;
      let type: TypeSyntax | null = null;
      let closer: Token | null = null;
      if (this.match(TokenKind.COLON) !== null) {
        type = this.parseType();
        if (type === null) return null;
        closer = this.expect(TokenKind.SEMICOLON, "';'");
        if (closer === null) return null;
      } else {
        this.addDiagnostic(
          projectDiagnostic(
            "E10150",
            `Type annotation required for field '${fieldName}' — add ': <type>'`,
            fieldNameToken.span,
          ),
        );
        while (
          !this.check(TokenKind.SEMICOLON) &&
          !this.check(TokenKind.RBRACE) &&
          !this.check(TokenKind.EOF)
        ) {
          this.advance();
        }
        closer = this.match(TokenKind.SEMICOLON);
      }
      fields.push(
        Object.freeze({
          name: fieldName,
          nameSpan: fieldNameToken.span,
          type,
          span: this.spanFrom(fieldStart, closer ?? fieldNameToken),
        }),
      );
    }
    const closer = this.expect(TokenKind.RBRACE, "'}'", opener);
    if (closer === null) return null;
    const span = this.spanFrom(start, closer);
    if (fields.length === 0) {
      this.addDiagnostic(
        projectDiagnostic("E10090", `Struct '${name}' must have at least one field`, span),
      );
    }
    return Object.freeze({
      kind: "struct",
      span,
      name,
      nameSpan: nameToken.span,
      exported,
      fields: Object.freeze(fields),
    });
  }

  /** Consume one balanced valid-language form not implemented by this partial parser. */
  consumeUncheckedDeclaration(): UncheckedSyntax {
    const start = this.current;
    let braceDepth = 0;
    let parenDepth = 0;
    let bracketDepth = 0;
    let sawBrace = false;
    let end = start.span.end;
    do {
      const token = this.advance();
      if (token.kind === TokenKind.LBRACE) {
        braceDepth += 1;
        sawBrace = true;
      } else if (token.kind === TokenKind.RBRACE) braceDepth -= 1;
      else if (token.kind === TokenKind.LPAREN) parenDepth += 1;
      else if (token.kind === TokenKind.RPAREN) parenDepth -= 1;
      else if (token.kind === TokenKind.LBRACKET) bracketDepth += 1;
      else if (token.kind === TokenKind.RBRACKET) bracketDepth -= 1;
      end = token.span.end;
      if (braceDepth === 0 && parenDepth === 0 && bracketDepth === 0) {
        if ((sawBrace && start.kind !== TokenKind.KW_DO) || token.kind === TokenKind.SEMICOLON) {
          break;
        }
      }
    } while (!this.check(TokenKind.EOF));
    const span = this.spanFrom(start, end);
    this.unchecked.push(span);
    this.complete = false;
    return Object.freeze({ kind: "unchecked", span });
  }

  /** Retain an unsupported for loop without splitting its initializer from its body. */
  consumeUncheckedFor(start: Token): UncheckedSyntax {
    let parenDepth = 1;
    let braceDepth = 0;
    let sawBody = false;
    let end = this.current.span.start;
    while (!this.check(TokenKind.EOF)) {
      const token = this.advance();
      if (token.kind === TokenKind.LPAREN) parenDepth += 1;
      else if (token.kind === TokenKind.RPAREN) parenDepth = Math.max(0, parenDepth - 1);
      else if (parenDepth === 0 && token.kind === TokenKind.LBRACE) {
        braceDepth += 1;
        sawBody = true;
      } else if (parenDepth === 0 && token.kind === TokenKind.RBRACE) {
        braceDepth = Math.max(0, braceDepth - 1);
      }
      end = token.span.end;
      if (
        parenDepth === 0 &&
        ((sawBody && braceDepth === 0) || (!sawBody && token.kind === TokenKind.SEMICOLON))
      ) {
        break;
      }
    }
    const span = this.spanFrom(start, end);
    this.unchecked.push(span);
    this.complete = false;
    return Object.freeze({ kind: "unchecked", span });
  }

  /** Recover one rejected statement or declaration without crossing a safe sibling start. */
  recoverPoison(start: Token, knownEnd = this.current.span.start): PoisonStatement {
    let end = knownEnd;
    let depth = 0;
    while (!this.check(TokenKind.EOF) && !this.check(TokenKind.RBRACE)) {
      if (depth === 0 && this.isSafeSiblingStart(this.current.kind)) break;
      const token = this.advance();
      if (
        token.kind === TokenKind.LPAREN ||
        token.kind === TokenKind.LBRACKET ||
        token.kind === TokenKind.LBRACE
      ) {
        depth += 1;
      } else if (
        token.kind === TokenKind.RPAREN ||
        token.kind === TokenKind.RBRACKET ||
        token.kind === TokenKind.RBRACE
      ) {
        depth = Math.max(0, depth - 1);
      }
      end = token.span.end;
      if (depth === 0 && token.kind === TokenKind.SEMICOLON) break;
    }
    this.complete = false;
    return Object.freeze({ kind: "poison", span: this.spanFrom(start, end) });
  }

  /** Identify starts at which recovery can safely return ownership to its caller. */
  isSafeSiblingStart(kind: TokenKind): boolean {
    return (
      kind === TokenKind.KW_LET ||
      kind === TokenKind.KW_CONST ||
      kind === TokenKind.KW_IF ||
      kind === TokenKind.KW_WHILE ||
      kind === TokenKind.KW_FOR ||
      kind === TokenKind.KW_RETURN ||
      kind === TokenKind.KW_BREAK ||
      kind === TokenKind.KW_CONTINUE ||
      kind === TokenKind.KW_FUNCTION ||
      kind === TokenKind.KW_STRUCT ||
      kind === TokenKind.KW_IMPORT ||
      kind === TokenKind.KW_EXPORT
    );
  }

  /** Identify a token that safely begins a new module item. */
  isModuleItemStart(kind: TokenKind): boolean {
    return (
      kind === TokenKind.KW_MODULE ||
      kind === TokenKind.KW_IMPORT ||
      kind === TokenKind.KW_EXPORT ||
      kind === TokenKind.KW_LET ||
      kind === TokenKind.KW_CONST ||
      kind === TokenKind.KW_FUNCTION ||
      kind === TokenKind.KW_STRUCT ||
      kind === TokenKind.KW_ENUM ||
      kind === TokenKind.KW_COMPTIME ||
      kind === TokenKind.KW_INTERRUPT ||
      kind === TokenKind.KW_LOADABLE ||
      kind === TokenKind.KW_ZEROPAGE ||
      kind === TokenKind.KW_PLACE ||
      kind === TokenKind.KW_TYPE
    );
  }

  /** Consume a module-level executable form through its balanced terminator. */
  consumeModuleStatement(): SourceSpan {
    const start = this.current;
    let depth = 0;
    let sawBrace = false;
    let end = start.span.end;
    do {
      if (this.current !== start && depth === 0 && this.isModuleItemStart(this.current.kind)) break;
      const token = this.advance();
      if (
        token.kind === TokenKind.LPAREN ||
        token.kind === TokenKind.LBRACKET ||
        token.kind === TokenKind.LBRACE
      ) {
        depth += 1;
        if (token.kind === TokenKind.LBRACE) sawBrace = true;
      } else if (
        token.kind === TokenKind.RPAREN ||
        token.kind === TokenKind.RBRACKET ||
        token.kind === TokenKind.RBRACE
      ) {
        depth = Math.max(0, depth - 1);
      }
      end = token.span.end;
      if (depth === 0 && token.kind === TokenKind.SEMICOLON) break;
      if (depth === 0 && sawBrace && token.kind === TokenKind.RBRACE) {
        if (start.kind === TokenKind.KW_IF && this.check(TokenKind.KW_ELSE)) continue;
        if (start.kind === TokenKind.KW_DO && this.check(TokenKind.KW_WHILE)) continue;
        break;
      }
    } while (!this.check(TokenKind.EOF));
    return this.spanFrom(start, end);
  }

  /** Detect a later module declaration only when it appears outside braces. */
  hasLaterTopLevelModule(): boolean {
    let braceDepth = 0;
    for (let index = this.index + 1; index < this.tokens.length; index += 1) {
      const kind = this.tokens[index]!.kind;
      if (kind === TokenKind.LBRACE) braceDepth += 1;
      else if (kind === TokenKind.RBRACE) braceDepth = Math.max(0, braceDepth - 1);
      else if (braceDepth === 0 && kind === TokenKind.KW_MODULE) return true;
    }
    return false;
  }

  /** Parse the complete source root and all admitted module items. */
  parse(): ParseResult {
    let header: ModuleHeader | null = null;
    const hasLateModule = !this.check(TokenKind.KW_MODULE) && this.hasLaterTopLevelModule();
    if (this.check(TokenKind.KW_MODULE)) header = this.parseModuleHeader();
    else if (!hasLateModule) {
      this.addDiagnostic(
        projectDiagnostic(
          "E10001",
          "Module declaration required — every source file must begin with 'module <name>;'",
          this.current.span,
        ),
      );
    }

    const imports: ImportDeclaration[] = [];
    const declarations: Declaration[] = [];
    while (!this.check(TokenKind.EOF)) {
      if (this.check(TokenKind.KW_MODULE)) {
        const candidate = this.parseModuleHeader();
        if (header === null && hasLateModule) {
          header = candidate;
          this.addDiagnostic(
            projectDiagnostic(
              "E10237",
              "Module declaration must be the first source item after leading comments",
              candidate?.span ?? this.current.span,
            ),
          );
        } else {
          this.addDiagnostic(
            projectDiagnostic(
              "E10002",
              "Only one module declaration is allowed per source file",
              candidate?.span ?? this.current.span,
            ),
          );
        }
        continue;
      }
      if (this.check(TokenKind.KW_IMPORT)) {
        const import_ = this.parseImport();
        if (import_ !== null) imports.push(import_);
        else declarations.push(this.recoverPoison(this.current));
        continue;
      }
      const start = this.current;
      const exported = this.match(TokenKind.KW_EXPORT) !== null;
      if (this.check(TokenKind.KW_LET) || this.check(TokenKind.KW_CONST)) {
        const declaration = this.parseVariable(exported, true, start);
        if (declaration !== null) declarations.push(declaration);
        continue;
      }
      if (this.check(TokenKind.KW_FUNCTION)) {
        const declaration = this.parseFunction(exported, start);
        if (declaration !== null) declarations.push(declaration);
        else declarations.push(this.recoverPoison(start));
        continue;
      }
      if (this.check(TokenKind.KW_STRUCT)) {
        const declaration = this.parseStruct(exported, start);
        if (declaration !== null) declarations.push(declaration);
        else declarations.push(this.recoverPoison(start));
        continue;
      }
      if (
        this.check(TokenKind.KW_ENUM) ||
        this.check(TokenKind.KW_COMPTIME) ||
        this.check(TokenKind.KW_INTERRUPT) ||
        this.check(TokenKind.KW_LOADABLE) ||
        this.check(TokenKind.KW_ZEROPAGE) ||
        this.check(TokenKind.KW_PLACE)
      ) {
        declarations.push(this.consumeUncheckedDeclaration());
        continue;
      }
      if (this.check(TokenKind.KW_TYPE)) {
        const keyword = this.advance();
        this.addDiagnostic(
          projectDiagnostic(
            "E10224",
            "'type' is reserved for a future Blend65 version",
            keyword.span,
          ),
        );
        this.recoverPoison(keyword);
        continue;
      }
      const statementSpan = this.consumeModuleStatement();
      this.addDiagnostic(
        projectDiagnostic(
          "E10010",
          "Executable statements are not allowed at module level — place code inside a function",
          statementSpan,
        ),
      );
    }

    const unit: SyntaxUnit = Object.freeze({
      span: Object.freeze({
        sourceId: this.source.sourceId,
        start: 0,
        end: this.source.byteLength,
      }),
      header,
      imports: Object.freeze(imports),
      declarations: Object.freeze(declarations),
    });
    return Object.freeze({
      unit,
      diagnostics: sortFrontendDiagnostics(this.diagnostics),
      complete: this.complete,
      unchecked: Object.freeze(this.unchecked),
    });
  }
}

/**
 * Parse one immutable source into admitted syntax and explicit recovery regions.
 * @example parseSource(source).unit?.header?.name
 */
export function parseSource(source: SourceRecord): ParseResult {
  return new Parser(source).parse();
}

/**
 * Read only the leading module header without validating the remaining body.
 * @example readModuleHeader(source).header?.name
 */
export function readModuleHeader(source: SourceRecord): HeaderResult {
  const parser = new Parser(source);
  if (!parser.check(TokenKind.KW_MODULE)) {
    const boundary = parser.current.span.start;
    const diagnostics = sortFrontendDiagnostics([
      ...parser.diagnostics.filter(
        ({ primarySpan }) => primarySpan !== null && primarySpan.start <= boundary,
      ),
      projectDiagnostic(
        "E10001",
        "Module declaration required — every source file must begin with 'module <name>;'",
        parser.current.span,
      ),
    ]);
    return Object.freeze({
      header: null,
      diagnostics,
      complete: false,
    });
  }
  const header = parser.parseModuleHeader();
  const boundary = header?.span.end ?? parser.current.span.start;
  const diagnostics = sortFrontendDiagnostics(
    parser.diagnostics.filter(
      ({ primarySpan }) => primarySpan !== null && primarySpan.start <= boundary,
    ),
  );
  return Object.freeze({
    header,
    diagnostics,
    complete: header !== null && diagnostics.every(({ severity }) => severity !== "error"),
  });
}
