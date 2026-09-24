import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { describeFoundToken } from "./diagnostics.js";
import { TypeParser } from "./parser-types.js";
import { parseBlock } from "./statements.js";
import type { StatementContext } from "./statements.js";
import { PAYLOAD_KIND, TokenKind } from "./tokens.js";
import type { Token } from "./tokens.js";
import type {
  EnumDeclaration,
  EnumMember,
  Expr,
  FunctionDeclaration,
  FunctionParameter,
  ImportDeclaration,
  ImportItem,
  ModuleHeader,
  PlacementArgument,
  PlacementClause,
  PoisonStatement,
  StructDeclaration,
  StructField,
  TypeSyntax,
  VariableDeclaration,
  ZeropageBlock,
} from "./syntax.js";

/** The shared cursor and recovery operations needed by declaration parsing. */
export interface DeclarationContext extends StatementContext {
  /** Tokens include the zero-width end marker. */
  readonly tokens: readonly Token[];
  /** Current token index. */
  readonly index: number;
  /** Regions of valid syntax that are not yet checked. */
  readonly unchecked: SourceSpan[];
  /** False once an error or unchecked region is encountered. */
  complete: boolean;
  /** Add a bounded canonical diagnostic. */
  addDiagnostic(diagnostic: ProjectDiagnostic): void;
}

/** Parse one dotted name without changing declaration recovery ownership. */
function parseQualifiedName(
  context: DeclarationContext,
): { readonly name: string; readonly span: SourceSpan } | null {
  const first = context.expect(TokenKind.IDENTIFIER, "an identifier");
  if (first === null) return null;
  let name = first.payload?.kind === PAYLOAD_KIND.identifier ? first.payload.text : null;
  if (name === null) return null;
  let end = first;
  while (context.match(TokenKind.DOT) !== null) {
    const part = context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (part === null) return null;
    const text = part.payload?.kind === PAYLOAD_KIND.identifier ? part.payload.text : null;
    if (text === null) return null;
    name += "." + text;
    end = part;
  }
  return Object.freeze({ name, span: context.spanFrom(first, end) });
}

/** Skip one rejected zero-page member without consuming its block's closing brace. */
function skipRejectedZeropageMember(context: DeclarationContext): void {
  while (
    !context.check(TokenKind.SEMICOLON) &&
    !context.check(TokenKind.RBRACE) &&
    !context.check(TokenKind.EOF)
  ) {
    context.advance();
  }
  context.match(TokenKind.SEMICOLON);
}

/** Parse type and declaration forms through the source parser's single shared cursor. */
export class DeclarationParser {
  /** Type spellings share this parser's token cursor and recovery state. */
  private readonly types: TypeParser;

  constructor(private readonly context: DeclarationContext) {
    this.types = new TypeParser(context);
  }

  /** Return the exact identifier payload carried by a validated identifier token. */
  identifier(token: Token): string | null {
    return token.payload?.kind === PAYLOAD_KIND.identifier ? token.payload.text : null;
  }

  /** Parse a primitive, qualified, function, or fixed-array type form. */
  parseType(): TypeSyntax | null {
    return this.types.parseType();
  }

  /** Parse a dotted identifier sequence. */
  parseQualifiedName(): { readonly name: string; readonly span: SourceSpan } | null {
    return parseQualifiedName(this.context);
  }

  /** Parse the closed module-level placement vocabulary. */
  parsePlaceClause(): PlacementClause | null {
    const start = this.context.advance();
    const opener = this.context.expect(TokenKind.LPAREN, "'('");
    if (opener === null) return null;
    const arguments_: PlacementArgument[] = [];
    do {
      const keyToken = this.context.expect(TokenKind.IDENTIFIER, "a placement key");
      if (keyToken === null) return null;
      const spelling = this.identifier(keyToken);
      if (
        spelling !== "at" &&
        spelling !== "align" &&
        spelling !== "noCross" &&
        spelling !== "region"
      ) {
        this.context.addDiagnostic(
          projectDiagnostic(
            "E10272",
            `Invalid place constraint on 'declaration' — key '${spelling}' is not allowed; allowed keys are at, align, noCross, and region on module-level stored data or emitted functions`,
            keyToken.span,
          ),
        );
        return null;
      }
      if (this.context.expect(TokenKind.COLON, "':'") === null) return null;
      if (spelling === "region") {
        const region = this.parseQualifiedName();
        if (region === null) return null;
        arguments_.push(
          Object.freeze({
            key: spelling,
            value: region.name,
            span: this.context.spanFrom(keyToken, region),
          }),
        );
      } else {
        const value = this.context.parseExpression();
        if (value === null) return null;
        arguments_.push(
          Object.freeze({ key: spelling, value, span: this.context.spanFrom(keyToken, value) }),
        );
      }
    } while (this.context.match(TokenKind.COMMA) !== null);
    const closer = this.context.expect(TokenKind.RPAREN, "')'", opener);
    if (closer === null) return null;
    return Object.freeze({
      span: this.context.spanFrom(start, closer),
      arguments: Object.freeze(arguments_),
    });
  }

  /** Parse one complete leading module declaration. */
  parseModuleHeader(): ModuleHeader | null {
    const start = this.context.expect(TokenKind.KW_MODULE, "'module'");
    if (start === null) return null;
    const qualified = this.parseQualifiedName();
    if (qualified === null) return null;
    const closer = this.context.expect(TokenKind.SEMICOLON, "';'");
    if (closer === null) return null;
    return Object.freeze({
      kind: "module",
      span: this.context.spanFrom(start, closer),
      name: qualified.name,
      nameSpan: qualified.span,
    });
  }

  /** Parse one import declaration with contextual aliases. */
  parseImport(): ImportDeclaration | null {
    const start = this.context.advance();
    const opener = this.context.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const items: ImportItem[] = [];
    do {
      const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
      if (nameToken === null) return null;
      const name = this.identifier(nameToken);
      if (name === null) return null;
      let alias: string | null = null;
      let aliasSpan: SourceSpan | null = null;
      let end = nameToken;
      if (
        this.context.current.payload?.kind === PAYLOAD_KIND.identifier &&
        this.context.current.payload.text === "as"
      ) {
        this.context.advance();
        const aliasToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
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
          span: this.context.spanFrom(nameToken, end),
        }),
      );
    } while (this.context.match(TokenKind.COMMA) !== null);
    if (this.context.expect(TokenKind.RBRACE, "'}'", opener) === null) return null;
    if (this.context.expect(TokenKind.KW_FROM, "'from'") === null) return null;
    const module = this.parseQualifiedName();
    if (module === null) return null;
    const closer = this.context.expect(TokenKind.SEMICOLON, "';'");
    if (closer === null) return null;
    return Object.freeze({
      kind: "import",
      span: this.context.spanFrom(start, closer),
      module: module.name,
      moduleSpan: module.span,
      items: Object.freeze(items),
    });
  }

  /** Parse a variable declaration in module, block, or for-header position. */
  parseVariable(
    exported: boolean,
    requireSemicolon: boolean,
    declarationStart = this.context.current,
    loadable = false,
    placement: PlacementClause | null = null,
  ): VariableDeclaration | PoisonStatement | null {
    const start = declarationStart;
    if (loadable) {
      this.context.advance();
      if (this.context.expect(TokenKind.KW_CONST, "'const'") === null) {
        return this.context.recoverPoison(start);
      }
    }
    const declarationToken = loadable ? null : this.context.advance();
    const declarationKind =
      loadable || declarationToken?.kind === TokenKind.KW_CONST ? "const" : "let";
    const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return this.context.recoverPoison(start);
    const name = this.identifier(nameToken);
    if (name === null) return this.context.recoverPoison(start);

    let type: TypeSyntax | null = null;
    let missingType = false;
    if (this.context.match(TokenKind.COLON) !== null) {
      type = this.parseType();
      if (type === null) return this.context.recoverPoison(start);
    } else missingType = true;

    let initializer: Expr | null = null;
    if (this.context.match(TokenKind.EQUAL) !== null) {
      initializer = this.context.parseExpression();
      if (initializer === null) return this.context.recoverPoison(start);
    }
    const missingInitializer = declarationKind === "const" && initializer === null;

    let end = initializer?.span.end ?? type?.span.end ?? nameToken.span.end;
    if (requireSemicolon) {
      const closer = this.context.match(TokenKind.SEMICOLON);
      if (closer === null) {
        this.context.reportExpected("';'");
        return this.context.recoverPoison(start, end);
      }
      end = closer.span.end;
    }
    const span = this.context.spanFrom(start, end);
    if (missingType) {
      this.context.addDiagnostic(
        projectDiagnostic(
          "E10150",
          `Type annotation required for variable '${name}' — add ': <type>'`,
          span,
        ),
      );
    }
    if (missingInitializer) {
      this.context.addDiagnostic(
        projectDiagnostic("E10190", `Const declaration '${name}' requires an initializer`, span),
      );
    }
    return Object.freeze({
      kind: "variable",
      span,
      name,
      nameSpan: nameToken.span,
      declarationKind,
      loadable,
      zeropage: false,
      placement,
      exported,
      type,
      initializer,
    });
  }

  /** Parse an ordinary, compile-time, or interrupt function declaration. */
  parseFunction(
    exported: boolean,
    start: Token,
    mode: FunctionDeclaration["mode"] = "ordinary",
    placement: PlacementClause | null = null,
  ): FunctionDeclaration | null {
    this.context.advance();
    const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = this.identifier(nameToken);
    if (name === null) return null;
    const opener = this.context.expect(TokenKind.LPAREN, "'('");
    if (opener === null) return null;
    const parameters: FunctionParameter[] = [];
    if (!this.context.check(TokenKind.RPAREN)) {
      do {
        const parameterStart = this.context.current;
        const parameterNameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
        if (parameterNameToken === null) return null;
        const parameterName = this.identifier(parameterNameToken);
        if (parameterName === null) return null;
        let readonly = false;
        let type: TypeSyntax | null = null;
        if (this.context.match(TokenKind.COLON) !== null) {
          readonly = this.context.match(TokenKind.KW_CONST) !== null;
          type = this.parseType();
          if (type === null) return null;
        } else {
          this.context.addDiagnostic(
            projectDiagnostic(
              "E10150",
              `Type annotation required for parameter '${parameterName}' — add ': <type>'`,
              parameterNameToken.span,
            ),
          );
          while (
            !this.context.check(TokenKind.COMMA) &&
            !this.context.check(TokenKind.RPAREN) &&
            !this.context.check(TokenKind.EOF)
          ) {
            this.context.advance();
          }
        }
        parameters.push(
          Object.freeze({
            name: parameterName,
            nameSpan: parameterNameToken.span,
            type,
            readonly,
            span: this.context.spanFrom(parameterStart, type ?? parameterNameToken),
          }),
        );
      } while (this.context.match(TokenKind.COMMA) !== null);
    }
    if (this.context.expect(TokenKind.RPAREN, "')'", opener) === null) return null;
    let returnType: TypeSyntax | null = null;
    const missingReturnType = this.context.match(TokenKind.COLON) === null;
    if (!missingReturnType) returnType = this.parseType();
    const body = parseBlock(this.context);
    const span = this.context.spanFrom(start, body);
    if (missingReturnType) {
      this.context.addDiagnostic(
        projectDiagnostic(
          "E10170",
          `Return type required — write 'function ${name}(): void' for a function that returns nothing`,
          span,
        ),
      );
    }
    return Object.freeze({
      kind: "function",
      mode,
      placement,
      span,
      name,
      nameSpan: nameToken.span,
      exported,
      parameters: Object.freeze(parameters),
      returnType,
      body,
    });
  }

  /** Parse enum members without evaluating their constant expressions yet. */
  parseEnum(exported: boolean, start: Token): EnumDeclaration | null {
    this.context.advance();
    const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = this.identifier(nameToken);
    if (name === null) return null;
    const opener = this.context.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const members: EnumMember[] = [];
    while (!this.context.check(TokenKind.RBRACE) && !this.context.check(TokenKind.EOF)) {
      const memberToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
      if (memberToken === null) return null;
      const memberName = this.identifier(memberToken);
      if (memberName === null) return null;
      const hasValue = this.context.match(TokenKind.EQUAL) !== null;
      const value = hasValue ? this.context.parseExpression() : null;
      if (hasValue && value === null) return null;
      members.push(
        Object.freeze({
          name: memberName,
          nameSpan: memberToken.span,
          value,
          span: this.context.spanFrom(memberToken, value ?? memberToken),
        }),
      );
      if (this.context.match(TokenKind.COMMA) === null) break;
    }
    const closer = this.context.expect(TokenKind.RBRACE, "'}'", opener);
    if (closer === null) return null;
    if (members.length === 0) {
      this.context.addDiagnostic(
        projectDiagnostic(
          "E10234",
          `Enum '${name}' must declare at least one member`,
          this.context.spanFrom(start, closer),
        ),
      );
    }
    return Object.freeze({
      kind: "enum",
      span: this.context.spanFrom(start, closer),
      name,
      nameSpan: nameToken.span,
      exported,
      members: Object.freeze(members),
    });
  }

  /** Parse a zero-page block and its keyword-free mutable declarations. */
  parseZeropageBlock(): ZeropageBlock | null {
    const start = this.context.advance();
    const opener = this.context.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const variables: VariableDeclaration[] = [];
    let rejectedMember = false;
    while (!this.context.check(TokenKind.RBRACE) && !this.context.check(TokenKind.EOF)) {
      const variableStart = this.context.current;
      const exported = this.context.match(TokenKind.KW_EXPORT) !== null;
      const hasPlacement = this.context.check(TokenKind.KW_PLACE);
      const placement = hasPlacement ? this.parsePlaceClause() : null;
      if (hasPlacement && placement === null) {
        rejectedMember = true;
        skipRejectedZeropageMember(this.context);
        continue;
      }
      if (this.context.current.kind !== TokenKind.IDENTIFIER) {
        const invalid = this.context.current;
        const spelling = describeFoundToken(invalid);
        this.context.addDiagnostic(
          invalid.kind === TokenKind.KW_CONST
            ? projectDiagnostic(
                "E10031",
                "Constants are not allowed in 'zeropage' — use a module-level 'const' declaration",
                invalid.span,
              )
            : projectDiagnostic(
                "E10033",
                `Unexpected ${spelling} in zeropage block — declare '[export] name: type [= expression];' without 'let' or 'const'`,
                invalid.span,
              ),
        );
        rejectedMember = true;
        skipRejectedZeropageMember(this.context);
        continue;
      }
      const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
      if (nameToken === null) return null;
      const name = this.identifier(nameToken);
      if (name === null) return null;
      if (this.context.expect(TokenKind.COLON, "':'") === null) return null;
      const type = this.parseType();
      if (type === null) return null;
      const hasInitializer = this.context.match(TokenKind.EQUAL) !== null;
      const initializer = hasInitializer ? this.context.parseExpression() : null;
      if (hasInitializer && initializer === null) return null;
      const closer = this.context.expect(TokenKind.SEMICOLON, "';'");
      if (closer === null) return null;
      variables.push(
        Object.freeze({
          kind: "variable",
          span: this.context.spanFrom(variableStart, closer),
          name,
          nameSpan: nameToken.span,
          declarationKind: "let",
          loadable: false,
          zeropage: true,
          placement,
          exported,
          type,
          initializer,
        }),
      );
    }
    if (variables.length === 0 && !rejectedMember) {
      this.context.reportExpected("a zero-page variable", opener);
      return null;
    }
    const closer = this.context.expect(TokenKind.RBRACE, "'}'", opener);
    if (closer === null) return null;
    return Object.freeze({
      kind: "zeropage",
      span: this.context.spanFrom(start, closer),
      variables: Object.freeze(variables),
    });
  }

  /** Parse one non-empty struct declaration. */
  parseStruct(exported: boolean, start: Token): StructDeclaration | null {
    this.context.advance();
    const nameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
    if (nameToken === null) return null;
    const name = this.identifier(nameToken);
    if (name === null) return null;
    const opener = this.context.expect(TokenKind.LBRACE, "'{'");
    if (opener === null) return null;
    const fields: StructField[] = [];
    while (!this.context.check(TokenKind.RBRACE) && !this.context.check(TokenKind.EOF)) {
      const fieldStart = this.context.current;
      const fieldNameToken = this.context.expect(TokenKind.IDENTIFIER, "an identifier");
      if (fieldNameToken === null) return null;
      const fieldName = this.identifier(fieldNameToken);
      if (fieldName === null) return null;
      let type: TypeSyntax | null = null;
      let closer: Token | null = null;
      if (this.context.match(TokenKind.COLON) !== null) {
        type = this.parseType();
        if (type === null) return null;
        closer = this.context.expect(TokenKind.SEMICOLON, "';'");
        if (closer === null) return null;
      } else {
        this.context.addDiagnostic(
          projectDiagnostic(
            "E10150",
            `Type annotation required for field '${fieldName}' — add ': <type>'`,
            fieldNameToken.span,
          ),
        );
        while (
          !this.context.check(TokenKind.SEMICOLON) &&
          !this.context.check(TokenKind.RBRACE) &&
          !this.context.check(TokenKind.EOF)
        ) {
          this.context.advance();
        }
        closer = this.context.match(TokenKind.SEMICOLON);
      }
      fields.push(
        Object.freeze({
          name: fieldName,
          nameSpan: fieldNameToken.span,
          type,
          span: this.context.spanFrom(fieldStart, closer ?? fieldNameToken),
        }),
      );
    }
    const closer = this.context.expect(TokenKind.RBRACE, "'}'", opener);
    if (closer === null) return null;
    const span = this.context.spanFrom(start, closer);
    if (fields.length === 0) {
      this.context.addDiagnostic(
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
}
