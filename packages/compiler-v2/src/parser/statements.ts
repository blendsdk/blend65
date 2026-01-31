/**
 * Statement Parser for Blend65 Compiler v2 - C-Style Syntax
 *
 * Extends ModuleParser to provide statement parsing capabilities:
 * - Statement dispatcher (parseStatement)
 * - Expression statement parsing (expressions used as statements)
 * - Control flow statement parsing (if, while, for, do-while, switch)
 * - Break/continue statement parsing
 * - Return statement parsing
 *
 * C-Style Syntax:
 * - All block statements use curly braces { }
 * - Conditions are wrapped in parentheses ( )
 * - No 'then', 'end', 'next', 'elseif' keywords
 * - 'else if' is two separate keywords (parsed as nested if in else)
 * - New do-while loop: do { } while (cond);
 * - For loop supports: step, downto
 */

import {
  BreakStatement,
  CaseClause,
  ContinueStatement,
  DiagnosticCode,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
  ForStatement,
  IfStatement,
  ReturnStatement,
  SourceLocation,
  Statement,
  SwitchStatement,
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
 * This layer uses C-style syntax with curly braces for blocks.
 *
 * Current statement support:
 * - Expression statements: foo(); x = 5;
 * - Function-local variable declarations: let x: byte = 10;
 * - If statements: if (condition) { ... } else if (cond) { ... } else { ... }
 * - While loops: while (condition) { ... }
 * - Do-while loops: do { ... } while (condition);
 * - For loops: for (i = 0 to 10) { ... }, for (i = 10 downto 0) { ... }, for (i = 0 to 10 step 2) { ... }
 * - Switch statements: switch (value) { case 1: ... break; default: ... }
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

    // Control flow statements (C-style syntax)
    if (this.check(TokenType.IF)) return this.parseIfStatement();
    if (this.check(TokenType.WHILE)) return this.parseWhileStatement();
    if (this.check(TokenType.DO)) return this.parseDoWhileStatement();
    if (this.check(TokenType.FOR)) return this.parseForStatement();
    if (this.check(TokenType.SWITCH)) return this.parseSwitchStatement();
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
   * @returns ExpressionStatement AST node wrapping the expression
   */
  protected parseExpressionStatement(): ExpressionStatement {
    const expr = this.parseExpression();

    this.expectSemicolon('Expected semicolon after expression statement');

    return new ExpressionStatement(expr, expr.getLocation());
  }

  // ============================================
  // CONTROL FLOW STATEMENT PARSING (C-STYLE)
  // ============================================

  /**
   * Parses if statement with C-style syntax
   *
   * Grammar: 'if' '(' Expression ')' '{' Statement* '}' ['else' (if_stmt | '{' Statement* '}')]
   *
   * Examples:
   * - Simple if: if (x > 0) { return; }
   * - If-else: if (flag) { doThis(); } else { doThat(); }
   * - If-else if-else: if (x > 10) { big(); } else if (x > 5) { medium(); } else { small(); }
   *
   * Implementation Note:
   * 'else if' is parsed as two keywords: ELSE followed by IF.
   * This creates a nested if statement inside the else branch,
   * which is the standard C/JS approach. No special ELSEIF token needed.
   *
   * @returns IfStatement AST node
   */
  protected parseIfStatement(): IfStatement {
    const startToken = this.expect(TokenType.IF, "Expected 'if'");

    // Expect '(' before condition
    if (!this.match(TokenType.LEFT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '(' after 'if'"
      );
    }

    // Parse condition expression
    const condition = this.parseExpression();

    // Expect ')' after condition
    if (!this.match(TokenType.RIGHT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected ')' after if condition"
      );
    }

    // Expect '{' for then branch
    if (!this.match(TokenType.LEFT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '{' for if body"
      );
    }

    // Parse then branch statements
    const thenBranch = this.parseStatementBlock([TokenType.RIGHT_BRACE]);

    // Expect '}' to close then branch
    if (!this.match(TokenType.RIGHT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '}' to close if body"
      );
    }

    // Parse optional else/else if
    let elseBranch: Statement[] | null = null;

    if (this.match(TokenType.ELSE)) {
      if (this.check(TokenType.IF)) {
        // 'else if' - parse as nested if in the else branch
        const nestedIf = this.parseIfStatement();
        elseBranch = [nestedIf];
      } else {
        // Regular else - expect '{' for else block
        if (!this.match(TokenType.LEFT_BRACE)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            "Expected '{' for else body"
          );
        }

        elseBranch = this.parseStatementBlock([TokenType.RIGHT_BRACE]);

        if (!this.match(TokenType.RIGHT_BRACE)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            "Expected '}' to close else body"
          );
        }
      }
    }

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new IfStatement(condition, thenBranch, elseBranch, location);
  }

  /**
   * Parses while statement with C-style syntax
   *
   * Grammar: 'while' '(' Expression ')' '{' Statement* '}'
   *
   * Examples:
   * - Simple while: while (running) { doSomething(); }
   * - Nested while: while (x > 0) { while (y > 0) { doInner(); } }
   * - With break: while (true) { if (done) { break; } }
   *
   * @returns WhileStatement AST node
   */
  protected parseWhileStatement(): WhileStatement {
    const startToken = this.expect(TokenType.WHILE, "Expected 'while'");

    // Use ScopeManager for loop scope tracking
    this.scopeManager.enterLoopScope();

    // Expect '(' before condition
    if (!this.match(TokenType.LEFT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '(' after 'while'"
      );
    }

    // Parse condition expression
    const condition = this.parseExpression();

    // Expect ')' after condition
    if (!this.match(TokenType.RIGHT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected ')' after while condition"
      );
    }

    // Expect '{' for body
    if (!this.match(TokenType.LEFT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '{' for while body"
      );
    }

    // Parse body statements
    const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);

    // Expect '}' to close body
    if (!this.match(TokenType.RIGHT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '}' to close while body"
      );
    }

    // Exit loop scope
    this.scopeManager.exitLoopScope();

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new WhileStatement(condition, body, location);
  }

  /**
   * Parses do-while statement (NEW in C-style syntax)
   *
   * Grammar: 'do' '{' Statement* '}' 'while' '(' Expression ')' ';'
   *
   * Examples:
   * - Simple do-while: do { process(); } while (!done);
   * - With counter: do { count += 1; } while (count < 10);
   *
   * Note: The body executes at least once before condition is checked.
   * This is a common pattern in 6502 programming for efficient loops.
   *
   * @returns DoWhileStatement AST node
   */
  protected parseDoWhileStatement(): DoWhileStatement {
    const startToken = this.expect(TokenType.DO, "Expected 'do'");

    // Use ScopeManager for loop scope tracking
    this.scopeManager.enterLoopScope();

    // Expect '{' for body
    if (!this.match(TokenType.LEFT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '{' for do body"
      );
    }

    // Parse body statements
    const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);

    // Expect '}' to close body
    if (!this.match(TokenType.RIGHT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '}' to close do body"
      );
    }

    // Expect 'while' keyword
    if (!this.match(TokenType.WHILE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected 'while' after do body"
      );
    }

    // Expect '(' before condition
    if (!this.match(TokenType.LEFT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '(' after 'while'"
      );
    }

    // Parse condition expression
    const condition = this.parseExpression();

    // Expect ')' after condition
    if (!this.match(TokenType.RIGHT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected ')' after do-while condition"
      );
    }

    // Expect semicolon at end of do-while
    this.expectSemicolon('Expected semicolon after do-while statement');

    // Exit loop scope
    this.scopeManager.exitLoopScope();

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new DoWhileStatement(body, condition, location);
  }

  /**
   * Parses for statement with C-style syntax and extended features
   *
   * Grammar: 'for' '(' [let Identifier ':' Type] Identifier '=' Expression ('to' | 'downto') Expression ['step' Expression] ')' '{' Statement* '}'
   *
   * Examples:
   * - Simple for: for (i = 0 to 10) { process(i); }
   * - Downto: for (i = 255 downto 0) { buffer[i] = 0; }
   * - With step: for (i = 0 to 100 step 5) { process(i); }
   * - With type: for (let i: word = 0 to 5000) { bigBuffer[i] = 0; }
   *
   * Note: The variable type can be specified for 16-bit counters.
   * If not specified, the semantic analyzer will infer byte/word based on range.
   *
   * @returns ForStatement AST node
   */
  protected parseForStatement(): ForStatement {
    const startToken = this.expect(TokenType.FOR, "Expected 'for'");

    // Use ScopeManager for loop scope tracking
    this.scopeManager.enterLoopScope();

    // Expect '(' to start for specification
    if (!this.match(TokenType.LEFT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '(' after 'for'"
      );
    }

    // Parse optional 'let variable: type' or just variable name
    let variableType: string | null = null;
    let variable: string;

    if (this.match(TokenType.LET)) {
      // Explicit type declaration: let i: word
      const varToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'let'");
      variable = varToken.value;

      if (this.match(TokenType.COLON)) {
        // Parse type
        if (this.check(TokenType.BYTE, TokenType.WORD, TokenType.IDENTIFIER)) {
          variableType = this.advance().value;
        } else {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            "Expected type after ':' in for loop variable declaration"
          );
          variableType = 'byte'; // Default fallback
        }
      }
    } else {
      // Just variable name
      const varToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'for ('");
      variable = varToken.value;
    }

    // Expect '='
    if (!this.match(TokenType.ASSIGN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '=' after for loop variable"
      );
    }

    // Parse start expression
    const start = this.parseExpression();

    // Parse direction: 'to' or 'downto'
    let direction: 'to' | 'downto' = 'to';
    if (this.match(TokenType.TO)) {
      direction = 'to';
    } else if (this.match(TokenType.DOWNTO)) {
      direction = 'downto';
    } else {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected 'to' or 'downto' in for loop"
      );
    }

    // Parse end expression
    const end = this.parseExpression();

    // Parse optional 'step' expression
    let step: Expression | null = null;
    if (this.match(TokenType.STEP)) {
      step = this.parseExpression();
    }

    // Expect ')' to close for specification
    if (!this.match(TokenType.RIGHT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected ')' after for specification"
      );
    }

    // Expect '{' for body
    if (!this.match(TokenType.LEFT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '{' for for body"
      );
    }

    // Parse body statements
    const body = this.parseStatementBlock([TokenType.RIGHT_BRACE]);

    // Expect '}' to close body
    if (!this.match(TokenType.RIGHT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '}' to close for body"
      );
    }

    // Exit loop scope
    this.scopeManager.exitLoopScope();

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ForStatement(variable, variableType, start, end, direction, step, body, location);
  }

  /**
   * Parses switch statement with C-style syntax
   *
   * Grammar: 'switch' '(' Expression ')' '{' ('case' Expression ':' Statement*)* ['default' ':' Statement*] '}'
   *
   * Examples:
   * - Simple switch: switch (x) { case 1: doOne(); break; case 2: doTwo(); break; }
   * - With default: switch (x) { case 1: doOne(); break; default: doDefault(); }
   * - Fall-through: switch (x) { case 1: case 2: doOneOrTwo(); break; }
   *
   * Note: Fall-through is explicit (no automatic break). Use 'break' to exit case.
   *
   * @returns SwitchStatement AST node
   */
  protected parseSwitchStatement(): SwitchStatement {
    const startToken = this.expect(TokenType.SWITCH, "Expected 'switch'");

    // Expect '(' before value
    if (!this.match(TokenType.LEFT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '(' after 'switch'"
      );
    }

    // Parse value expression
    const value = this.parseExpression();

    // Expect ')' after value
    if (!this.match(TokenType.RIGHT_PAREN)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected ')' after switch value"
      );
    }

    // Expect '{' for switch body
    if (!this.match(TokenType.LEFT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '{' for switch body"
      );
    }

    const cases: CaseClause[] = [];
    let defaultCase: Statement[] | null = null;

    // Parse case clauses and optional default
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      if (this.match(TokenType.CASE)) {
        // Parse case clause
        const caseStartToken = this.getCurrentToken();
        const caseValue = this.parseExpression();

        // Expect ':'
        if (!this.match(TokenType.COLON)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            "Expected ':' after case value"
          );
        }

        // Parse case body statements (until next case, default, or closing brace)
        const caseBody = this.parseStatementBlock([
          TokenType.CASE,
          TokenType.DEFAULT,
          TokenType.RIGHT_BRACE,
        ]);

        const caseLocation = this.createLocation(caseStartToken, this.getCurrentToken());
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
            'Multiple default cases in switch statement'
          );
        }

        // Expect ':'
        if (!this.match(TokenType.COLON)) {
          this.reportError(
            DiagnosticCode.EXPECTED_TOKEN,
            "Expected ':' after 'default'"
          );
        }

        // Parse default body statements
        defaultCase = this.parseStatementBlock([
          TokenType.CASE,
          TokenType.RIGHT_BRACE,
        ]);
      } else {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected 'case' or 'default' in switch statement"
        );
        this.advance(); // Skip problematic token
      }
    }

    // Expect '}' to close switch body
    if (!this.match(TokenType.RIGHT_BRACE)) {
      this.reportError(
        DiagnosticCode.EXPECTED_TOKEN,
        "Expected '}' to close switch body"
      );
    }

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new SwitchStatement(value, cases, defaultCase, location);
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

    // Parse optional return value
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
   * @param value - Return value expression (null for void returns)
   * @param location - Source location for error reporting
   */
  protected validateReturnStatement(value: Expression | null, location: SourceLocation): void {
    if (!this.scopeManager.isInFunction()) {
      return;
    }

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
  }

  /**
   * Parses break statement
   *
   * Grammar: 'break' ';'
   *
   * @returns BreakStatement AST node
   */
  protected parseBreakStatement(): BreakStatement {
    const startToken = this.expect(TokenType.BREAK, "Expected 'break'");

    // Validate loop context
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
   * @returns ContinueStatement AST node
   */
  protected parseContinueStatement(): ContinueStatement {
    const startToken = this.expect(TokenType.CONTINUE, "Expected 'continue'");

    // Validate loop context
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
  // FUNCTION-LOCAL VARIABLE DECLARATIONS
  // ============================================

  /**
   * Parses function-local variable declarations
   *
   * Grammar: ['const'] 'let' identifier [':' type] ['=' expression] ';'
   *
   * Examples:
   * - let temp: byte = 10;
   * - const MAX: byte = 100;
   * - let result: word;
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

    return new VariableDecl(
      varName,
      typeAnnotation,
      initializer,
      location,
      null, // storageClass: not allowed inside functions (v2: handled by frame allocator)
      isConst, // isConstant: true for const, false for let
      false // isExported: function-local variables cannot be exported
    );
  }

  // ============================================
  // COMMON HELPERS
  // ============================================

  /**
   * Parses a block of statements until hitting one of the terminator tokens
   *
   * @param terminators - Token types that signal end of statement block
   * @returns Array of parsed statements
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
}