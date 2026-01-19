/**
 * Statement Parser for Blend65 Compiler
 *
 * Extends ModuleParser to provide statement parsing capabilities:
 * - Statement dispatcher (parseStatement)
 * - Expression statement parsing (expressions used as statements)
 * - Control flow statement parsing (if, while, for, match)
 * - Break/continue statement parsing
 * - Return statement parsing
 *
 * This layer provides the core statement parsing infrastructure that
 * control flow and function parsing will build upon.
 */

import {
  BreakStatement,
  CaseClause,
  ContinueStatement,
  DiagnosticCode,
  Expression,
  ExpressionStatement,
  ForStatement,
  IfStatement,
  MatchStatement,
  ReturnStatement,
  SourceLocation,
  Statement,
  VariableDecl,
  WhileStatement,
} from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import { StatementParserErrors } from './error-messages.js';
import { ModuleParser } from './modules.js';

/**
 * Statement parser class - extends ModuleParser with statement parsing capabilities
 *
 * Provides the foundation for parsing all statement types in Blend65.
 * This layer focuses on the core statement infrastructure following the
 * language specification (no C-style braces).
 *
 * Current statement support:
 * - Expression statements: foo(); x = 5;
 * - Function-local variable declarations: let x: byte = 10;
 * - If statements: if condition then ... end if
 * - While loops: while condition ... end while
 * - For loops: for i = 1 to 10 ... next i
 * - Match statements: match value case 1: ... end match
 * - Return/break/continue statements
 */
export abstract class StatementParser extends ModuleParser {
  // ============================================
  // STATEMENT DISPATCHER
  // ============================================

  /**
   * Parses any statement - main dispatcher method
   *
   * This method routes to the appropriate specific statement parser
   * based on the current token. It serves as the central hub for all
   * statement parsing in the language.
   *
   * Current routing:
   * - 'let'/'const' → parseLocalVariableDeclaration() (Function-local variables)
   * - Control flow statements → parseIfStatement(), parseWhileStatement(), etc.
   * - Everything else → parseExpressionStatement()
   *
   * @returns Statement AST node representing the parsed statement
   */
  protected parseStatement(): Statement {
    // Function-local variable declarations
    if (this.check(TokenType.LET, TokenType.CONST)) {
      return this.parseLocalVariableDeclaration();
    }

    // Control flow statements
    if (this.check(TokenType.IF)) return this.parseIfStatement();
    if (this.check(TokenType.WHILE)) return this.parseWhileStatement();
    if (this.check(TokenType.FOR)) return this.parseForStatement();
    if (this.check(TokenType.MATCH)) return this.parseMatchStatement();
    if (this.check(TokenType.RETURN)) return this.parseReturnStatement();
    if (this.check(TokenType.BREAK)) return this.parseBreakStatement();
    if (this.check(TokenType.CONTINUE)) return this.parseContinueStatement();

    // Default: expression statement
    return this.parseExpressionStatement();
  }

  // ============================================
  // EXPRESSION STATEMENT PARSING
  // ============================================

  /**
   * Parses an expression statement (expression used as a statement)
   *
   * Grammar: Expression ';'
   *
   * Expression statements allow expressions to be used where statements
   * are expected. This is essential for function calls, assignments,
   * and other side-effecting expressions.
   *
   * Examples:
   * - Function call: foo();
   * - Assignment: x = 5;
   * - Complex expression: array[i] = getValue() + 10;
   * - Method call: player.update();
   *
   * Note: Semicolons are strictly required in Blend65 for statement
   * termination. This eliminates ambiguity and parsing complexity.
   *
   * Error Recovery:
   * - Invalid expression: Error reported, attempts to recover with dummy
   * - Missing semicolon: Error reported, continues (may cause cascading errors)
   *
   * @returns ExpressionStatement AST node wrapping the expression
   */
  protected parseExpressionStatement(): ExpressionStatement {
    const expr = this.parseExpression();

    this.expectSemicolon('Expected semicolon after expression statement');

    return new ExpressionStatement(expr, expr.getLocation());
  }

  // ============================================
  // CONTROL FLOW STATEMENT PARSING (PHASE 2)
  // ============================================

  /**
   * Parses if statement
   *
   * Grammar: 'if' Expression 'then' Statement* ['elseif' Expression 'then' Statement*]* ['else' Statement*] 'end' 'if'
   *
   * Examples:
   * - Simple if: if x > 0 then return; end if
   * - If-else: if flag then doThis(); else doThat(); end if
   * - If-elseif-else: if x > 10 then big(); elseif x > 5 then medium(); else small(); end if
   * - Multiple elseif: if x == 1 then one(); elseif x == 2 then two(); elseif x == 3 then three(); end if
   * - Nested if: if x > 0 then if y > 0 then doSomething(); end if end if
   *
   * Implementation Note:
   * The elseif keyword is syntactic sugar that desugars to nested if-else during parsing.
   * This means semantic analysis sees a standard nested if structure, requiring no changes
   * to type checking, control flow analysis, or any other compiler phases.
   *
   * Error Recovery:
   * - Missing 'then': Reports error, continues parsing
   * - Missing 'end if': Reports error, synchronizes to likely end
   * - Invalid condition: Reports error, uses dummy condition
   * - elseif after else: Parse error (else must be last)
   *
   * @returns IfStatement AST node
   */
  protected parseIfStatement(): IfStatement {
    const startToken = this.expect(TokenType.IF, "Expected 'if'");

    // Parse condition expression
    const condition = this.parseExpression();

    // Expect 'then' keyword
    if (!this.match(TokenType.THEN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        StatementParserErrors.expectedThenAfterIfCondition()
      );
      // Try to recover by looking for statements anyway
    }

    // Parse then branch statements using helper
    // Stop on ELSEIF, ELSE, or END tokens
    const thenBranch = this.parseStatementBlock([TokenType.ELSEIF, TokenType.ELSE, TokenType.END]);

    // Parse optional elseif/else chain
    // Collect all elseif branches first, then build nested structure
    let elseBranch: Statement[] | null = null;

    // Collect elseif clauses
    interface ElseifClause {
      condition: Expression;
      thenBranch: Statement[];
      location: SourceLocation;
    }
    const elseifClauses: ElseifClause[] = [];

    while (this.check(TokenType.ELSEIF)) {
      const elseifStart = this.getCurrentToken();
      this.advance(); // Consume ELSEIF
      
      const elseifCondition = this.parseExpression();
      
      // Expect 'then' keyword
      if (!this.match(TokenType.THEN)) {
        this.reportError(
          DiagnosticCode.EXPECTED_TOKEN,
          StatementParserErrors.expectedThenAfterIfCondition()
        );
      }
      
      // Parse then branch for this elseif
      const elseifThenBranch = this.parseStatementBlock([TokenType.ELSEIF, TokenType.ELSE, TokenType.END]);
      
      elseifClauses.push({
        condition: elseifCondition,
        thenBranch: elseifThenBranch,
        location: this.createLocation(elseifStart, this.getCurrentToken())
      });
    }
    
    // Handle final else (if present)
    let finalElse: Statement[] | null = null;
    if (this.match(TokenType.ELSE)) {
      finalElse = this.parseStatementBlock([TokenType.END]);
    }

    // Build nested if structure from bottom up
    // Start with final else, then wrap each elseif around it
    if (elseifClauses.length > 0) {
      // Start with the final else (or null)
      let currentElseBranch: Statement[] | null = finalElse;
      
      // Process elseif clauses in reverse order (bottom-up)
      for (let i = elseifClauses.length - 1; i >= 0; i--) {
        const clause = elseifClauses[i];
        const nestedIf = new IfStatement(
          clause.condition,
          clause.thenBranch,
          currentElseBranch,
          clause.location
        );
        currentElseBranch = [nestedIf];
      }
      
      elseBranch = currentElseBranch;
    } else if (finalElse !== null) {
      // No elseifs, just a final else
      elseBranch = finalElse;
    }

    // Expect 'end if' using helper
    this.parseEndKeyword(TokenType.IF, 'if');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new IfStatement(condition, thenBranch, elseBranch, location);
  }

  /**
   * Parses while statement
   *
   * Grammar: 'while' Expression Statement* 'end' 'while'
   *
   * Examples:
   * - Simple while: while running doSomething(); end while
   * - Nested while: while x > 0 while y > 0 doInner(); end while end while
   * - With break/continue: while true if done then break; end if end while
   *
   * Error Recovery:
   * - Missing 'end while': Reports error, synchronizes to likely end
   * - Invalid condition: Reports error, uses dummy condition
   *
   * @returns WhileStatement AST node
   */
  protected parseWhileStatement(): WhileStatement {
    const startToken = this.expect(TokenType.WHILE, "Expected 'while'");

    // Use ScopeManager for loop scope tracking
    this.scopeManager.enterLoopScope();

    // Parse condition expression
    const condition = this.parseExpression();

    // Parse body statements using helper
    const body = this.parseStatementBlock([TokenType.END]);

    // Expect 'end while' using helper
    this.parseEndKeyword(TokenType.WHILE, 'while');

    // Exit loop scope
    this.scopeManager.exitLoopScope();

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new WhileStatement(condition, body, location);
  }

  /**
   * Parses for statement
   *
   * Grammar: 'for' Identifier '=' Expression 'to' Expression Statement* 'next' Identifier
   *
   * Examples:
   * - Simple for: for i = 1 to 10 doSomething(); next i
   * - Countdown: for i = 10 to 0 doCountdown(); next i
   * - Nested for: for x = 0 to 10 for y = 0 to 10 process(x, y); next y next x
   *
   * Error Recovery:
   * - Missing '=': Reports error, continues parsing
   * - Missing 'to': Reports error, continues parsing
   * - Missing 'next': Reports error, synchronizes to likely end
   * - Mismatched variable names: Reports warning, continues
   *
   * @returns ForStatement AST node
   */
  protected parseForStatement(): ForStatement {
    const startToken = this.expect(TokenType.FOR, "Expected 'for'");

    // Use ScopeManager for loop scope tracking
    this.scopeManager.enterLoopScope();

    // Parse loop variable
    const variableToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'for'");
    const variable = variableToken.value;

    // Expect '='
    if (!this.match(TokenType.ASSIGN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        StatementParserErrors.expectedAssignAfterForVariable()
      );
    }

    // Parse start expression
    const start = this.parseExpression();

    // Expect 'to'
    if (!this.match(TokenType.TO)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        StatementParserErrors.expectedToAfterForStart()
      );
    }

    // Parse end expression
    const end = this.parseExpression();

    // Parse body statements using helper
    const body = this.parseStatementBlock([TokenType.NEXT]);

    // Expect 'next'
    if (!this.match(TokenType.NEXT)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        StatementParserErrors.expectedNextToCloseFor()
      );
    } else {
      // Expect matching variable name
      const nextVariableToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected variable name after 'next'"
      );
      if (nextVariableToken.value !== variable) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          StatementParserErrors.forVariableMismatch(variable, nextVariableToken.value)
        );
      }
    }

    // Exit loop scope
    this.scopeManager.exitLoopScope();

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ForStatement(variable, start, end, body, location);
  }

  /**
   * Parses match statement
   *
   * Grammar: 'match' Expression ('case' Expression ':' Statement*)* ['default' ':' Statement*] 'end' 'match'
   *
   * Examples:
   * - Simple match: match value case 1: doOne(); case 2: doTwo(); end match
   * - With default: match value case 1: doOne(); default: doDefault(); end match
   * - Nested match: match x case 1: match y case 2: doDeep(); end match end match
   *
   * Error Recovery:
   * - Missing ':' after case: Reports error, continues parsing
   * - Missing 'end match': Reports error, synchronizes to likely end
   * - Invalid case expression: Reports error, uses dummy case
   *
   * @returns MatchStatement AST node
   */
  protected parseMatchStatement(): MatchStatement {
    const startToken = this.expect(TokenType.MATCH, "Expected 'match'");

    // Parse value expression
    const value = this.parseExpression();

    const cases: CaseClause[] = [];
    let defaultCase: Statement[] | null = null;

    // Parse case clauses and optional default
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.CASE)) {
        // Parse case clause
        const caseValue = this.parseExpression();

        // Expect ':'
        if (!this.match(TokenType.COLON)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            StatementParserErrors.expectedColonAfterCase()
          );
        }

        // Parse case body statements using helper
        const caseBody = this.parseStatementBlock([
          TokenType.CASE,
          TokenType.DEFAULT,
          TokenType.END,
        ]);

        const caseLocation = this.createLocation(startToken, this.getCurrentToken());
        cases.push({
          value: caseValue,
          body: caseBody,
          location: caseLocation,
        });
      } else if (this.match(TokenType.DEFAULT)) {
        // Parse default clause
        if (defaultCase !== null) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Multiple default cases in match statement'
          );
        }

        // Expect ':'
        if (!this.match(TokenType.COLON)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            StatementParserErrors.expectedColonAfterDefault()
          );
        }

        // Parse default body statements using helper
        defaultCase = this.parseStatementBlock([TokenType.CASE, TokenType.END]);
      } else {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected 'case' or 'default' in match statement"
        );
        this.advance(); // Skip problematic token
      }
    }

    // Expect 'end match' using helper
    this.parseEndKeyword(TokenType.MATCH, 'match');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new MatchStatement(value, cases, defaultCase, location);
  }

  /**
   * Parses return statement
   *
   * Grammar: 'return' [Expression] ';'
   *
   * Examples:
   * - Void return: return;
   * - Value return: return 42;
   * - Complex expressions: return getValue() + 10;
   * - Expression return: return x + y * z;
   *
   * Validation (Task 3.3):
   * - Must be inside a function
   * - Void functions must not return a value
   * - Non-void functions must return a value
   * - Basic type compatibility check
   *
   * Error Recovery:
   * - Invalid return expression: Reports error, uses null value
   * - Missing semicolon: Reports error, continues
   *
   * @returns ReturnStatement AST node
   */
  protected parseReturnStatement(): ReturnStatement {
    const startToken = this.expect(TokenType.RETURN, "Expected 'return'");

    // Validate: return must be inside a function
    if (!this.scopeManager.isInFunction()) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        StatementParserErrors.returnOutsideFunction()
      );
    }

    // Parse optional return value - no try-catch needed
    let value = null;

    // Check if there's an expression before the semicolon
    if (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      value = this.parseExpression();
    }

    // Validate return value matches function return type
    this.validateReturnStatement(value, this.createLocation(startToken, this.getCurrentToken()));

    this.expectSemicolon('Expected semicolon after return statement');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ReturnStatement(value, location);
  }

  /**
   * Validates return statement against function signature
   *
   * Checks (in order):
   * 1. Must be inside a function (checked first with isInFunction())
   * 2. Void functions must not return values
   * 3. Non-void functions must return values
   * 4. Basic type compatibility (presence check, not full type inference)
   *
   * Null Safety:
   * - Uses isInFunction() first to check function context
   * - Then safely calls getCurrentFunctionReturnType() which returns string | null
   * - null means void function, string means typed return
   *
   * @param value - Return value expression (null for void returns)
   * @param location - Source location for error reporting
   */
  protected validateReturnStatement(value: Expression | null, location: SourceLocation): void {
    // Check if we're in a function first (null-safe approach)
    if (!this.scopeManager.isInFunction()) {
      // Not in function - already reported by parseReturnStatement
      return;
    }

    // Get current function's return type (will be string or null, never undefined)
    const returnType = this.scopeManager.getCurrentFunctionReturnType();

    // Check void function returning value
    if (returnType === null && value !== null) {
      this.reportError(
        DiagnosticCode.TYPE_MISMATCH,
        StatementParserErrors.voidFunctionReturningValue(
          this.scopeManager.getCurrentFunctionName()
        ),
        location
      );
    }

    // Check non-void function returning void
    if (returnType !== null && value === null) {
      this.reportError(
        DiagnosticCode.TYPE_MISMATCH,
        StatementParserErrors.nonVoidFunctionReturningVoid(
          this.scopeManager.getCurrentFunctionName(),
          returnType
        ),
        location
      );
    }

    // Note: Full type checking (e.g., returning word when byte expected)
    // is deferred to semantic analysis phase. This is basic validation only.
  }

  /**
   * Parses break statement
   *
   * Grammar: 'break' ';'
   *
   * Examples:
   * - Loop breaking: while condition ... break; ... end while
   * - For loop breaking: for i = 1 to 10 ... break; ... next i
   *
   * Validation (Task 3.4):
   * - Must be inside a loop (while, for) - validated at parse time
   * - Must not cross function boundary (function inside loop)
   * - Reports error if used outside loop context or across function boundary
   *
   * Error Recovery:
   * - Missing semicolon: Reports error, continues
   * - Outside loop: Reports error, continues parsing anyway
   *
   * @returns BreakStatement AST node
   */
  protected parseBreakStatement(): BreakStatement {
    const startToken = this.expect(TokenType.BREAK, "Expected 'break'");

    // Validate loop context for 6502 early error detection
    // Use proper validation that checks for function boundary crossing
    if (!this.scopeManager.isInLoopWithoutFunctionBoundary()) {
      this.reportError(DiagnosticCode.UNEXPECTED_TOKEN, StatementParserErrors.breakOutsideLoop());
    }

    this.expectSemicolon('Expected semicolon after break statement');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new BreakStatement(location);
  }

  /**
   * Parses continue statement
   *
   * Grammar: 'continue' ';'
   *
   * Examples:
   * - Loop continuation: while condition ... continue; ... end while
   * - For loop continuation: for i = 1 to 10 ... continue; ... next i
   *
   * Validation (Task 3.4):
   * - Must be inside a loop (while, for) - validated at parse time
   * - Must not cross function boundary (function inside loop)
   * - Reports error if used outside loop context or across function boundary
   *
   * Error Recovery:
   * - Missing semicolon: Reports error, continues
   * - Outside loop: Reports error, continues parsing anyway
   *
   * @returns ContinueStatement AST node
   */
  protected parseContinueStatement(): ContinueStatement {
    const startToken = this.expect(TokenType.CONTINUE, "Expected 'continue'");

    // Validate loop context for 6502 early error detection
    // Use proper validation that checks for function boundary crossing
    if (!this.scopeManager.isInLoopWithoutFunctionBoundary()) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        StatementParserErrors.continueOutsideLoop()
      );
    }

    this.expectSemicolon('Expected semicolon after continue statement');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ContinueStatement(location);
  }

  // ============================================
  // FUNCTION-LOCAL VARIABLE DECLARATIONS (PHASE 4)
  // ============================================

  /**
   * Parses function-local variable declarations
   *
   * Grammar: ['const'] 'let' identifier [':' type] ['=' expression] ';'
   *
   * This enables variable declarations inside function bodies per language spec:
   * - Function scope (not block scope)
   * - Same syntax as module-level variables
   * - No storage classes allowed inside functions
   *
   * Examples:
   * - let temp: byte = 10;
   * - const MAX: byte = 100;
   * - let result: word;
   *
   * Error Recovery:
   * - Missing type: Reports error, continues with 'unknown' type
   * - Invalid initializer: Reports error, continues without initializer
   * - Missing semicolon: Reports error, continues
   *
   * Implementation Note:
   * Returns a real VariableDecl AST node (same as module-level variables).
   * This allows the semantic analyzer to visit function-local variables properly
   * using the standard visitor pattern.
   *
   * @returns VariableDecl AST node representing the variable declaration
   */
  protected parseLocalVariableDeclaration(): Statement {
    const startToken = this.getCurrentToken();

    // Parse mutability (let or const)
    const isConst = this.match(TokenType.CONST);
    if (!isConst) {
      this.expect(TokenType.LET, "Expected 'let' or 'const'");
    }

    // Parse variable name
    const nameToken = this.expect(TokenType.IDENTIFIER, 'Expected variable name');
    const varName = nameToken.value;

    // Parse optional type annotation
    let typeAnnotation: string | null = null;
    if (this.match(TokenType.COLON)) {
      if (
        this.check(
          TokenType.BYTE,
          TokenType.WORD,
          TokenType.BOOLEAN,
          TokenType.STRING,
          TokenType.IDENTIFIER
        )
      ) {
        typeAnnotation = this.advance().value;
      } else {
        this.reportError(DiagnosticCode.EXPECTED_TOKEN, 'Expected type after colon');
      }
    }

    // Parse optional initializer
    let initializer = null;
    if (this.match(TokenType.ASSIGN)) {
      initializer = this.parseExpression();
    }

    // Validate const requires initializer
    if (isConst && initializer === null) {
      this.reportError(
        DiagnosticCode.MISSING_CONST_INITIALIZER,
        'Const declarations must have an initializer'
      );
    }

    this.expectSemicolon('Expected semicolon after variable declaration');

    // Create location spanning entire variable declaration
    const location = this.createLocation(startToken, this.getCurrentToken());

    // Return real VariableDecl AST node (same as module-level variables)
    // This allows proper visitor pattern traversal in semantic analysis
    return new VariableDecl(
      varName,
      typeAnnotation,
      initializer,
      location,
      null, // storageClass: not allowed inside functions
      isConst, // isConstant: true for const, false for let
      false // isExported: function-local variables cannot be exported
    );
  }

  // ============================================
  // COMMON ERROR HANDLING HELPERS
  // ============================================

  /**
   * Parses a block of statements until hitting one of the terminator tokens
   *
   * This helper extracts the common pattern of parsing statement sequences
   * in control flow structures. It reduces code duplication and provides
   * consistent behavior across all control flow statement types.
   *
   * Pattern extracted from:
   * - If statement (then branch, else branch)
   * - While statement (loop body)
   * - For statement (loop body)
   * - Match statement (case bodies, default body)
   *
   * @param terminators - Token types that signal end of statement block
   * @returns Array of parsed statements
   *
   * @example
   * // Parse if then branch (terminates on ELSE or END)
   * const thenBranch = this.parseStatementBlock([TokenType.ELSE, TokenType.END]);
   *
   * @example
   * // Parse while body (terminates on END)
   * const body = this.parseStatementBlock([TokenType.END]);
   *
   * @example
   * // Parse match case body (terminates on CASE, DEFAULT, or END)
   * const caseBody = this.parseStatementBlock([TokenType.CASE, TokenType.DEFAULT, TokenType.END]);
   */
  protected parseStatementBlock(terminators: TokenType[]): Statement[] {
    const statements: Statement[] = [];

    // Parse statements until we hit a terminator or EOF
    while (!this.check(...terminators) && !this.isAtEnd()) {
      const stmt = this.parseStatement();
      statements.push(stmt);
    }

    return statements;
  }

  /**
   * Parses 'end KEYWORD' sequence with proper error handling
   *
   * This helper extracts the common pattern of parsing 'end' followed by
   * a specific keyword (if, while, match, etc). It provides consistent
   * error messages and recovery behavior.
   *
   * Pattern extracted from:
   * - If statement: 'end if'
   * - While statement: 'end while'
   * - Match statement: 'end match'
   *
   * Note: For statement uses 'next' instead of 'end', so doesn't use this helper.
   *
   * @param keyword - Expected keyword after 'end' (IF, WHILE, MATCH, etc.)
   * @param contextName - Human-readable name for error messages ('if', 'while', 'match')
   *
   * @example
   * // Parse 'end if'
   * this.parseEndKeyword(TokenType.IF, 'if');
   *
   * @example
   * // Parse 'end while'
   * this.parseEndKeyword(TokenType.WHILE, 'while');
   */
  protected parseEndKeyword(keyword: TokenType, contextName: string): void {
    // Expect 'end' token
    if (!this.match(TokenType.END)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        `Expected 'end' to close ${contextName} statement`
      );
      return; // Early return on missing 'end'
    }

    // Expect specific keyword after 'end'
    if (!this.match(keyword)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, `Expected '${contextName}' after 'end'`);
    }
  }
}