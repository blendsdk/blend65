/**
 * Parser Class for Blend65 Compiler
 *
 * Final concrete parser class that extends the full inheritance chain:
 * BaseParser → ExpressionParser → DeclarationParser → ModuleParser → StatementParser → Parser
 *
 * This class provides the main entry point and orchestration for parsing
 * Blend65 source code into Abstract Syntax Trees (AST).
 *
 * The inheritance chain gives this class access to all parsing capabilities:
 * - Token management and error handling (BaseParser)
 * - Expression parsing with Pratt parser (ExpressionParser)
 * - Variable and @map declaration parsing (DeclarationParser)
 * - Module system parsing (ModuleParser)
 * - Statement parsing infrastructure (StatementParser)
 *
 * This class focuses solely on high-level orchestration and provides
 * the public API that external code uses.
 */

import {
  Declaration,
  DiagnosticCode,
  Program,
  FunctionDecl,
  Parameter,
  Statement,
  TypeDecl,
  EnumDecl,
  EnumMember,
  SourceLocation,
  isVariableDecl,
  isBreakStatement,
  isContinueStatement,
} from '../ast/index.js';
import { Token, TokenType } from '../lexer/types.js';
import { DeclarationParserErrors } from './error-messages.js';
import { StatementParser } from './statements.js';

/**
 * Complete Blend65 parser - final concrete implementation
 *
 * Inherits all parsing capabilities from the inheritance chain and provides
 * the main parse() entry point. This is the class that external code
 * should instantiate and use.
 *
 * Current parsing capabilities (Phase 4):
 * - Module declarations and implicit global modules
 * - Variable declarations with storage classes and export modifiers
 * - All @map declaration forms (simple, range, sequential, explicit)
 * - Expression parsing with proper operator precedence
 * - Function declarations with parameters and bodies (Phase 4)
 * - Comprehensive error handling and recovery
 *
 * Future capabilities (Phases 5-8):
 * - Import/export system
 * - Type system declarations (type aliases, enums)
 * - Complete language support
 *
 * Usage:
 * ```typescript
 * const lexer = new Lexer(source);
 * const tokens = lexer.tokenize();
 * const parser = new Parser(tokens);
 * const ast = parser.parse();
 *
 * if (parser.hasErrors()) {
 *   console.error(parser.getDiagnostics());
 * } else {
 *   console.log('AST:', ast);
 * }
 * ```
 */
export class Parser extends StatementParser {
  // ============================================
  // MAIN ENTRY POINT
  // ============================================

  /**
   * Entry point - parses entire file into Program AST
   *
   * Implements grammar:
   * Program := [Module] Declaration*
   *
   * This method orchestrates the parsing process:
   * 1. Parse optional module declaration (or create implicit global)
   * 2. Parse sequence of declarations (variables, @map, functions, etc.)
   * 3. Handle errors and synchronization
   * 4. Return complete Program AST node
   *
   * @returns Program AST node representing the entire source file
   */
  public parse(): Program {
    // Check for explicit module declaration
    let moduleDecl;

    if (this.check(TokenType.MODULE)) {
      moduleDecl = this.parseModuleDecl();
    } else {
      // Create implicit "module global"
      moduleDecl = this.createImplicitGlobalModuleDecl();
    }

    // Parse declarations (variables, @map, functions, etc.)
    const declarations: Declaration[] = [];

    while (!this.isAtEnd()) {
      if (this.isAtEnd()) break;

      // Validate module scope
      this.validateModuleScopeItem(this.getCurrentToken());

      // Parse import declaration
      if (this.check(TokenType.IMPORT)) {
        declarations.push(this.parseImportDecl());
      }
      // Parse export declaration (wraps other declarations)
      else if (this.check(TokenType.EXPORT)) {
        declarations.push(this.parseExportDecl());
      }
      // Parse @map declaration
      else if (this.check(TokenType.MAP)) {
        declarations.push(this.parseMapDecl());
      }
      // Parse function declaration (callback or regular)
      else if (this.check(TokenType.CALLBACK, TokenType.FUNCTION)) {
        const functionDecl = this.parseFunctionDecl() as FunctionDecl;

        // Handle main function auto-export with warning (only for auto-exported main functions)
        if (
          functionDecl.getName() === 'main' &&
          functionDecl.isExportedFunction() &&
          !this.wasExplicitlyExported
        ) {
          this.reportWarning(
            DiagnosticCode.IMPLICIT_MAIN_EXPORT,
            "Main function should be explicitly exported. Automatically exporting 'main' function.",
            functionDecl.getLocation()
          );
        }

        declarations.push(functionDecl);
      }
      // Parse type alias declaration
      else if (this.check(TokenType.TYPE)) {
        declarations.push(this.parseTypeDecl());
      }
      // Parse enum declaration
      else if (this.check(TokenType.ENUM)) {
        declarations.push(this.parseEnumDecl());
      }
      // Parse variable declaration
      else if (this.isStorageClass() || this.isLetOrConst()) {
        declarations.push(this.parseVariableDecl());
      } else {
        // Unknown token - report error and synchronize
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Unexpected token '${this.getCurrentToken().value}'`
        );
        this.synchronize();
      }
    }

    // Create program node
    const location = this.createLocation(this.tokens[0], this.getCurrentToken());

    return new Program(moduleDecl, declarations, location);
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Tracks if the last parsed declaration had an explicit export modifier
   */
  protected wasExplicitlyExported: boolean = false;

  /**
   * Checks if the last parsed item was explicitly exported
   */
  protected isExplicitlyExported(): boolean {
    return this.wasExplicitlyExported;
  }

  // ============================================
  // SCOPE MANAGEMENT (Task 2.2 - ScopeManager Integration)
  // ============================================

  /**
   * Note: scopeManager is now inherited from BaseParser (Task 2.2)
   * No need to declare or initialize it here.
   */

  /**
   * Enter a new function scope with parameters
   *
   * Uses ScopeManager for centralized scope tracking.
   *
   * @param parameters Function parameters to add to scope
   * @param returnType Expected return type for validation
   * @param functionName Optional function name for error messages (Task 3.3)
   */
  protected enterFunctionScopeWithParams(
    parameters: Parameter[],
    returnType: string | null,
    functionName?: string
  ): void {
    // Call base class method first
    this.enterFunctionScope();

    // Use ScopeManager for centralized scope management (with function name for Task 3.3)
    this.scopeManager.enterFunctionScope(parameters, returnType, functionName);
  }

  /**
   * Exit the current function scope
   *
   * Uses ScopeManager for centralized scope tracking.
   */
  protected exitFunctionScopeWithCleanup(): void {
    // Use ScopeManager for centralized scope management
    this.scopeManager.exitFunctionScope();

    // Call base class method to reset module scope flag
    this.exitFunctionScope();
  }

  /**
   * Add a local variable to the current function scope
   *
   * @param name Variable name
   * @param type Variable type
   * @param location Location for error reporting
   */
  protected addLocalVariable(name: string, type: string, location: SourceLocation): void {
    // Use ScopeManager for variable tracking
    this.scopeManager.addLocalVariable(name, type, location);
  }

  /**
   * Check if a variable exists in the current function scope chain
   *
   * @param name Variable name to check
   * @returns Variable type if found, null otherwise
   */
  protected lookupVariable(name: string): string | null {
    // Use ScopeManager for variable lookup
    return this.scopeManager.lookupVariable(name);
  }

  /**
   * Check if we're currently inside a function
   */
  protected isInFunctionScope(): boolean {
    // Use ScopeManager to check function scope
    return this.scopeManager.isInFunction();
  }

  /**
   * Get current function return type for validation
   */
  protected getCurrentFunctionReturnType(): string | null {
    // Use ScopeManager for return type tracking
    return this.scopeManager.getCurrentFunctionReturnType();
  }

  /**
   * Check if we're inside a loop (for break/continue validation)
   */
  protected isInLoopContext(): boolean {
    // Use ScopeManager for loop context checking
    return this.scopeManager.isInLoop();
  }

  // ============================================
  // PHASE 4: FUNCTION DECLARATION PARSING
  // ============================================

  /**
   * Parse function declaration with optional export and callback modifiers
   *
   * Grammar:
   * FunctionDecl := [export] [callback] function identifier
   *                 ( [ParameterList] ) [: TypeName]
   *                 StatementList
   *                 end function
   *
   * Handles:
   * - Optional export modifier (makes function visible to other modules)
   * - Optional callback modifier (marks as interrupt handler/function pointer)
   * - Parameter list with type annotations
   * - Optional return type annotation
   * - Function body using existing statement parsing infrastructure
   * - Proper error recovery and diagnostics
   *
   * @returns FunctionDecl AST node
   */
  protected parseFunctionDecl(): Declaration {
    const startToken = this.getCurrentToken();

    // Parse optional export modifier (following same pattern as parseVariableDecl)
    const isExported = this.parseExportModifier();
    this.wasExplicitlyExported = isExported;

    // Parse optional callback modifier
    const isCallback = this.match(TokenType.CALLBACK);

    // Parse 'function' keyword
    this.expect(TokenType.FUNCTION, "Expected 'function'");

    // Parse function name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected function name');
    const functionName = nameToken.value;

    // Check for main function auto-export (per language specification)
    let shouldAutoExport = false;
    if (functionName === 'main' && !isExported) {
      shouldAutoExport = true;
    }

    // Parse parameter list
    this.expect(TokenType.LEFT_PAREN, "Expected '(' after function name");
    const parameters = this.parseParameterList();
    this.expect(TokenType.RIGHT_PAREN, "Expected ')' after parameters");

    // Parse optional return type
    let returnType: string | null = null;
    if (this.match(TokenType.COLON)) {
      // Return type can be a keyword (void, byte, word) or identifier (custom type)
      if (
        this.check(
          TokenType.VOID,
          TokenType.BYTE,
          TokenType.WORD,
          TokenType.BOOLEAN,
          TokenType.STRING,
          TokenType.IDENTIFIER
        )
      ) {
        returnType = this.advance().value;
      } else {
        this.reportError(
          DiagnosticCode.EXPECTED_TOKEN,
          DeclarationParserErrors.expectedReturnType()
        );
      }
    }

    // Check for stub function (semicolon-terminated)
    if (this.check(TokenType.SEMICOLON)) {
      this.advance(); // Consume semicolon

      // Create location spanning entire stub function declaration
      const location = this.createLocation(startToken, this.getCurrentToken());

      // Return stub function with no body
      return new FunctionDecl(
        functionName,
        parameters,
        returnType,
        null, // No body for stub functions
        location,
        isExported || shouldAutoExport, // Explicit export or auto-export main function
        isCallback,
        true // isStub = true
      );
    }

    // Regular function with body - enter function scope
    // Enter function scope with parameters and return type for validation (Subtask 4.3.4)
    // Pass function name for better error messages (Task 3.3)
    this.enterFunctionScopeWithParams(parameters, returnType, functionName);

    try {
      // Parse function body statements with scope management
      const body = this.parseFunctionBody();

      // Parse 'end function'
      this.expect(TokenType.END, "Expected 'end' after function body");
      this.expect(TokenType.FUNCTION, "Expected 'function' after 'end'");

      // Create location spanning entire function declaration
      const location = this.createLocation(startToken, this.getCurrentToken());

      // Return function with proper export status
      return new FunctionDecl(
        functionName,
        parameters,
        returnType,
        body,
        location,
        isExported || shouldAutoExport, // Explicit export or auto-export main function
        isCallback,
        false // isStub = false (regular function)
      );
    } finally {
      // Always exit function scope, even if parsing fails (Subtask 4.3.4)
      this.exitFunctionScopeWithCleanup();
    }
  }

  /**
   * Parse function parameter list
   *
   * Grammar:
   * ParameterList := Parameter (, Parameter)*
   * Parameter := identifier : TypeName
   *
   * @returns Array of Parameter objects with name, type, and location
   */
  protected parseParameterList(): Parameter[] {
    const parameters: Parameter[] = [];

    // Empty parameter list
    if (this.check(TokenType.RIGHT_PAREN)) {
      return parameters;
    }

    do {
      // Parse parameter name
      const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected parameter name');

      // Parse type annotation
      this.expect(TokenType.COLON, "Expected ':' after parameter name");

      // Parameter type can be a keyword (byte, word, void) or identifier (custom type)
      let typeToken: Token;
      if (
        this.check(
          TokenType.BYTE,
          TokenType.WORD,
          TokenType.VOID,
          TokenType.BOOLEAN,
          TokenType.STRING,
          TokenType.IDENTIFIER
        )
      ) {
        typeToken = this.advance();
      } else {
        this.reportError(
          DiagnosticCode.EXPECTED_TOKEN,
          DeclarationParserErrors.expectedParameterType()
        );
        typeToken = this.getCurrentToken(); // For error recovery
      }

      // Create parameter object
      const paramLocation = this.createLocation(nameToken, typeToken);
      parameters.push({
        name: nameToken.value,
        typeAnnotation: typeToken.value,
        location: paramLocation,
      });
    } while (this.match(TokenType.COMMA));

    return parameters;
  }

  /**
   * Parse function body statements
   *
   * Clean mainstream approach: Use complete statement parser for everything.
   * StatementParser now handles all statement types including variable declarations.
   *
   * @returns Array of Statement AST nodes
   */
  protected parseFunctionBody(): Statement[] {
    const statements: Statement[] = [];

    // Parse statements until we hit 'end' keyword - clean and simple
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      try {
        // Parse statement using complete statement parsing infrastructure
        const statement = this.parseStatement();
        statements.push(statement);

        // Handle local variable declarations - add to function scope
        if (this.isVariableDeclarationStatement(statement)) {
          this.handleLocalVariableDeclaration(statement);
        }

        // Note: Return statement validation is now handled directly in parseReturnStatement() (Task 3.3)
        // No additional validation needed here

        // Validate break/continue statements (not allowed in function scope, only in loops)
        if (this.isBreakOrContinueStatement(statement)) {
          this.validateBreakContinueInContext(statement);
        }
      } catch (error) {
        // Error recovery - synchronize to next statement boundary
        this.synchronizeToStatement();
      }
    }

    return statements;
  }

  /**
   * Synchronize parser to next statement or end of function for error recovery
   */
  protected synchronizeToStatement(): void {
    while (
      !this.isAtEnd() &&
      !this.check(TokenType.END) &&
      !this.check(TokenType.IF) &&
      !this.check(TokenType.WHILE) &&
      !this.check(TokenType.FOR) &&
      !this.check(TokenType.RETURN) &&
      !this.check(TokenType.LET) &&
      !this.check(TokenType.CONST)
    ) {
      this.advance();
    }
  }

  // ============================================
  // STATEMENT VALIDATION HELPERS (Subtask 4.3.2 & 4.3.3)
  // ============================================

  /**
   * Check if a statement is a variable declaration
   */
  protected isVariableDeclarationStatement(statement: Statement): boolean {
    // Use AST node type checking - need to import VariableDecl type
    return statement.constructor.name === 'VariableDecl';
  }

  /**
   * Handle local variable declaration in function scope
   *
   * Uses type guard to safely narrow statement to VariableDecl,
   * enabling type-safe access to variable-specific methods.
   */
  protected handleLocalVariableDeclaration(statement: Statement): void {
    // Use type guard for safe type narrowing
    if (isVariableDecl(statement)) {
      this.addLocalVariable(
        statement.getName(),
        statement.getTypeAnnotation() || 'unknown',
        statement.getLocation()
      );
    }
  }

  /**
   * Check if a statement is break or continue
   */
  protected isBreakOrContinueStatement(statement: Statement): boolean {
    const name = statement.constructor.name;
    return name === 'BreakStatement' || name === 'ContinueStatement';
  }

  /**
   * Validate break/continue statements are only used in loop context (Subtask 4.3.5)
   *
   * Uses type guards to safely access statement location without casting to any.
   */
  protected validateBreakContinueInContext(statement: Statement): void {
    if (!this.isInLoopContext()) {
      // Use type guards to determine statement type and get location
      let statementType: string;
      if (isBreakStatement(statement)) {
        statementType = 'break';
      } else if (isContinueStatement(statement)) {
        statementType = 'continue';
      } else {
        // Fallback (shouldn't happen if caller checks correctly)
        statementType = 'unknown';
      }

      this.reportError(
        DiagnosticCode.INVALID_MODULE_SCOPE, // Using closest available diagnostic code
        `'${statementType}' statement only allowed inside loops`,
        statement.getLocation()
      );
    }
  }

  // ============================================
  // PHASE 6: TYPE SYSTEM DECLARATION PARSING
  // ============================================

  /**
   * Parse type alias declaration
   *
   * Grammar:
   * TypeDecl := [export] "type" identifier "=" type_expr
   * type_expr := type_name | type_name "[" integer "]"
   *
   * Examples:
   * - type SpriteId = byte
   * - type Address = word
   * - type ScreenBuffer = byte[1000]
   * - export type Color = byte
   *
   * @returns TypeDecl AST node
   */
  protected parseTypeDecl(): TypeDecl {
    const startToken = this.getCurrentToken();

    // Parse optional export modifier
    const isExported = this.parseExportModifier();
    this.wasExplicitlyExported = isExported;

    // Parse 'type' keyword
    this.expect(TokenType.TYPE, "Expected 'type'");

    // Parse type alias name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected type name');

    // Parse '=' assignment
    this.expect(TokenType.ASSIGN, "Expected '=' after type name");

    // Parse type expression (simple type or array type)
    const aliasedType = this.parseTypeExpression();

    // Create location spanning entire type declaration
    const location = this.createLocation(startToken, this.getCurrentToken());

    return new TypeDecl(nameToken.value, aliasedType, location, isExported);
  }

  /**
   * Parse type expression for type aliases
   *
   * Grammar:
   * type_expr := type_name | type_name "[" integer "]"
   *
   * Handles:
   * - Simple types: byte, word, void, boolean, string
   * - Custom types: SpriteId, Address (identifiers)
   * - Array types: byte[256], word[100]
   *
   * @returns String representation of the type expression
   */
  protected parseTypeExpression(): string {
    // Parse base type (keyword or identifier)
    let baseType: string;

    if (
      this.check(
        TokenType.BYTE,
        TokenType.WORD,
        TokenType.VOID,
        TokenType.BOOLEAN,
        TokenType.STRING,
        TokenType.CALLBACK,
        TokenType.IDENTIFIER
      )
    ) {
      baseType = this.advance().value;
    } else {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, DeclarationParserErrors.expectedTypeName());
      baseType = 'unknown';
    }

    // Check for array type: type_name "[" integer "]"
    if (this.match(TokenType.LEFT_BRACKET)) {
      // Parse array size
      const sizeToken = this.expect(TokenType.NUMBER, 'Expected array size');
      this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array size");

      // Return array type representation
      return `${baseType}[${sizeToken.value}]`;
    }

    return baseType;
  }

  /**
   * Parse enum declaration with member parsing
   *
   * Grammar:
   * EnumDecl := [export] "enum" identifier NEWLINE
   *             { enum_member [","] NEWLINE }
   *             "end" "enum"
   * enum_member := identifier ["=" integer]
   *
   * Examples:
   * - enum Direction
   *     UP,
   *     DOWN,
   *     LEFT,
   *     RIGHT
   *   end enum
   *
   * - enum Color
   *     BLACK = 0,
   *     WHITE = 1,
   *     RED = 2
   *   end enum
   *
   * @returns EnumDecl AST node
   */
  protected parseEnumDecl(): EnumDecl {
    const startToken = this.getCurrentToken();

    // Parse optional export modifier
    const isExported = this.parseExportModifier();
    this.wasExplicitlyExported = isExported;

    // Parse 'enum' keyword
    this.expect(TokenType.ENUM, "Expected 'enum'");

    // Parse enum name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected enum name');

    // Parse enum members
    const members: EnumMember[] = [];
    let nextValue = 0;

    // Parse members until we hit 'end' keyword
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      const member = this.parseEnumMember(nextValue);
      members.push(member);

      // Update next auto-increment value
      // If member has explicit value, next value is explicit + 1
      // If member has no explicit value (null), it used nextValue, so increment
      nextValue = (member.value !== null ? member.value : nextValue) + 1;

      // Optional comma between members
      this.match(TokenType.COMMA);
    }

    // Parse 'end enum'
    this.expect(TokenType.END, "Expected 'end' after enum members");
    this.expect(TokenType.ENUM, "Expected 'enum' after 'end'");

    // Create location spanning entire enum declaration
    const location = this.createLocation(startToken, this.getCurrentToken());

    return new EnumDecl(nameToken.value, members, location, isExported);
  }

  /**
   * Parse a single enum member
   *
   * Grammar:
   * enum_member := identifier ["=" integer]
   *
   * Handles:
   * - Simple member: UP (auto-numbered)
   * - Explicit value: BLACK = 0
   *
   * @param defaultValue The auto-increment value to use if no explicit value
   * @returns EnumMember object with name, value, and location
   */
  protected parseEnumMember(defaultValue: number): EnumMember {
    const startToken = this.getCurrentToken();

    // Parse member name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected enum member name');

    // Check for explicit value assignment
    let value: number | null = null;
    if (this.match(TokenType.ASSIGN)) {
      const valueToken = this.expect(TokenType.NUMBER, 'Expected enum member value');
      value = parseInt(valueToken.value, 10);
    } else {
      // Use auto-increment value
      value = defaultValue;
    }

    // Create location for this member
    const location = this.createLocation(startToken, this.getCurrentToken());

    return {
      name: nameToken.value,
      value,
      location,
    };
  }
}
