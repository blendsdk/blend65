import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceRecord, SourceSpan } from "../project/types.js";
import { sortFrontendDiagnostics, syntaxDiagnostic } from "./diagnostics.js";
import { DeclarationParser } from "./parser-declarations.js";
import { parseExpression as parseOwnedExpression } from "./expressions.js";
import type { ExpressionContext } from "./expressions.js";
import { lexSource } from "./lexer.js";
import type { StatementContext } from "./statements.js";
import { TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type {
  Declaration,
  EnumDeclaration,
  Expr,
  FunctionDeclaration,
  HeaderResult,
  ImportDeclaration,
  ModuleHeader,
  ParseResult,
  PlacementClause,
  PoisonStatement,
  StructDeclaration,
  SyntaxUnit,
  TypeSyntax,
  UncheckedSyntax,
  VariableDeclaration,
  ZeropageBlock,
} from "./syntax.js";

/** Language errors are bounded independently from warning observations. */
const MAX_ERRORS = 20;

/** Spellings used when a placement modifier precedes an ineligible owner. */
const INVALID_PLACE_OWNER: Readonly<Partial<Record<TokenKind, string>>> = Object.freeze({
  [TokenKind.KW_LOADABLE]: "loadable const",
  [TokenKind.KW_COMPTIME]: "comptime function",
  [TokenKind.KW_STRUCT]: "struct",
  [TokenKind.KW_ENUM]: "enum",
  [TokenKind.KW_ZEROPAGE]: "zeropage",
});

/** Parse one source with a single shared token cursor and recovery state. */
class Parser implements ExpressionContext, StatementContext {
  /** Tokens include one zero-width EOF marker. */
  readonly tokens: readonly Token[];
  /** Reports from scanning and parsing before deterministic final ordering. */
  readonly diagnostics: ProjectDiagnostic[];
  /** Deferred valid-language regions in source order. */
  readonly unchecked: SourceSpan[] = [];
  /** Type and declaration grammar shares this parser's cursor and recovery state. */
  readonly declarations: DeclarationParser;
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
    this.declarations = new DeclarationParser(this);
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

  /** Record a diagnostic while enforcing the shared twenty-error ceiling. */
  addDiagnostic(diagnostic: ProjectDiagnostic): void {
    if (diagnostic.severity === "error") {
      this.complete = false;
      if (this.errorCount >= MAX_ERRORS) return;
      this.errorCount += 1;
    }
    this.diagnostics.push(diagnostic);
  }

  /** Parse a type through the declaration owner. */
  parseType(): TypeSyntax | null {
    return this.declarations.parseType();
  }
  /** Parse the required leading module header. */
  parseModuleHeader(): ModuleHeader | null {
    return this.declarations.parseModuleHeader();
  }
  /** Parse one import declaration. */
  parseImport(): ImportDeclaration | null {
    return this.declarations.parseImport();
  }
  /** Parse a declaration in module, block, or for-header position. */
  parseVariable(
    exported: boolean,
    requireSemicolon: boolean,
    declarationStart = this.current,
    loadable = false,
    placement: PlacementClause | null = null,
  ): VariableDeclaration | PoisonStatement | null {
    return this.declarations.parseVariable(
      exported,
      requireSemicolon,
      declarationStart,
      loadable,
      placement,
    );
  }
  /** Parse an ordinary, compile-time, or interrupt function and its body. */
  parseFunction(
    exported: boolean,
    start: Token,
    mode: FunctionDeclaration["mode"] = "ordinary",
    placement: PlacementClause | null = null,
  ): FunctionDeclaration | null {
    return this.declarations.parseFunction(exported, start, mode, placement);
  }
  /** Parse explicit module-level placement constraints. */
  parsePlaceClause(): PlacementClause | null {
    return this.declarations.parsePlaceClause();
  }
  /** Parse keyword-free variables in one zero-page block. */
  parseZeropageBlock(): ZeropageBlock | null {
    return this.declarations.parseZeropageBlock();
  }
  /** Parse an enum declaration. */
  parseEnum(exported: boolean, start: Token): EnumDeclaration | null {
    return this.declarations.parseEnum(exported, start);
  }
  /** Parse a struct declaration. */
  parseStruct(exported: boolean, start: Token): StructDeclaration | null {
    return this.declarations.parseStruct(exported, start);
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

  /** Reject a whole ineligible declaration so its interior cannot become a sibling. */
  consumePoisonedDeclaration(start: Token): PoisonStatement {
    let depth = 0;
    let sawBrace = false;
    let end = start.span.end;
    while (!this.check(TokenKind.EOF)) {
      const token = this.advance();
      if (
        token.kind === TokenKind.LBRACE ||
        token.kind === TokenKind.LPAREN ||
        token.kind === TokenKind.LBRACKET
      ) {
        depth += 1;
        if (token.kind === TokenKind.LBRACE) sawBrace = true;
      } else if (
        token.kind === TokenKind.RBRACE ||
        token.kind === TokenKind.RPAREN ||
        token.kind === TokenKind.RBRACKET
      ) {
        depth = Math.max(0, depth - 1);
      }
      end = token.span.end;
      if (
        depth === 0 &&
        (token.kind === TokenKind.SEMICOLON || (sawBrace && token.kind === TokenKind.RBRACE))
      )
        break;
    }
    this.complete = false;
    return Object.freeze({ kind: "poison", span: this.spanFrom(start, end) });
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
      kind === TokenKind.KW_LOADABLE ||
      kind === TokenKind.KW_IF ||
      kind === TokenKind.KW_WHILE ||
      kind === TokenKind.KW_DO ||
      kind === TokenKind.KW_FOR ||
      kind === TokenKind.KW_SWITCH ||
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
      const hasPlacement = this.check(TokenKind.KW_PLACE);
      const placement = hasPlacement ? this.parsePlaceClause() : null;
      if (hasPlacement && placement === null) {
        declarations.push(this.consumePoisonedDeclaration(start));
        continue;
      }
      if (
        placement !== null &&
        !this.check(TokenKind.KW_LET) &&
        !this.check(TokenKind.KW_CONST) &&
        !this.check(TokenKind.KW_FUNCTION) &&
        !this.check(TokenKind.KW_INTERRUPT)
      ) {
        const owner = INVALID_PLACE_OWNER[this.current.kind] ?? "declaration";
        this.addDiagnostic(
          projectDiagnostic(
            "E10272",
            `Invalid place constraint on '${owner}' — this declaration form is not placeable; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions`,
            placement.span,
          ),
        );
        declarations.push(this.consumePoisonedDeclaration(start));
        continue;
      }
      if (this.check(TokenKind.KW_LET) || this.check(TokenKind.KW_CONST)) {
        const declaration = this.parseVariable(exported, true, start, false, placement);
        if (declaration !== null) declarations.push(declaration);
        continue;
      }
      if (this.check(TokenKind.KW_LOADABLE)) {
        const declaration = this.parseVariable(exported, true, start, true);
        if (declaration !== null) declarations.push(declaration);
        continue;
      }
      if (this.check(TokenKind.KW_FUNCTION)) {
        const declaration = this.parseFunction(exported, start, "ordinary", placement);
        if (declaration !== null) declarations.push(declaration);
        else declarations.push(this.recoverPoison(start));
        continue;
      }
      if (this.check(TokenKind.KW_COMPTIME) || this.check(TokenKind.KW_INTERRUPT)) {
        const mode = this.check(TokenKind.KW_COMPTIME) ? "comptime" : "interrupt";
        this.advance();
        if (!this.check(TokenKind.KW_FUNCTION)) {
          this.reportExpected("'function'");
          declarations.push(this.recoverPoison(start));
          continue;
        }
        const declaration = this.parseFunction(exported, start, mode, placement);
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
      if (this.check(TokenKind.KW_ENUM)) {
        const declaration = this.parseEnum(exported, start);
        if (declaration !== null) declarations.push(declaration);
        else declarations.push(this.recoverPoison(start));
        continue;
      }
      if (this.check(TokenKind.KW_ZEROPAGE)) {
        if (exported) {
          this.reportExpected("a declaration after 'export'");
          declarations.push(this.consumePoisonedDeclaration(start));
          continue;
        }
        const declaration = this.parseZeropageBlock();
        if (declaration !== null) declarations.push(declaration);
        else declarations.push(this.recoverPoison(start));
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
