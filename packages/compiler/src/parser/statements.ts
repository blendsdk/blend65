/**
 * Statement Parser for Blend65 Compiler
 *
 * Extends ModuleParser to provide statement parsing capabilities:
 * - Statement dispatcher (parseStatement)
 * - Block statement parsing (sequences of statements)
 * - Expression statement parsing (expressions used as statements)
 * - Foundation for control flow statements (if, while, for, etc.)
 *
 * This layer provides the core statement parsing infrastructure that
 * control flow and function parsing will build upon.
 */

import {
  BlockStatement,
  BreakStatement,
  CaseClause,
  ContinueStatement,
  DiagnosticCode,
  ExpressionStatement,
  ForStatement,
  IfStatement,
  LiteralExpression,
  MatchStatement,
  ReturnStatement,
  Statement,
  WhileStatement,
} from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import { ModuleParser } from './modules.js';

/**
 * Statement parser class - extends ModuleParser with statement parsing capabilities
 *
 * Provides the foundation for parsing all statement types in Blend65.
 * This layer focuses on the core statement infrastructure while leaving
 * specific statement implementations for future phases.
 *
 * Current statement support (Phase 1):
 * - Block statements: { stmt1; stmt2; }
 * - Expression statements: foo(); x = 5;
 * - Statement dispatcher routing (foundation for control flow)
 *
 * Future statement support (Phase 2+):
 * - If statements: if condition then ... end if
 * - While statements: while condition ... end while
 * - For statements: for i = 1 to 10 ... next i
 * - Match statements: match value case 1: ... end match
 * - Return/break/continue statements
 */
export abstract class StatementParser extends ModuleParser {
  // ============================================
  // LOOP CONTEXT TRACKING
  // ============================================

  /**
   * Track loop nesting level for break/continue validation
   *
   * In 6502 development, early error detection is crucial for fast feedback.
   * We validate break/continue statements at parse-time rather than during
   * semantic analysis to catch errors immediately.
   */
  protected loopNestingLevel: number = 0;

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
   * Current routing (Phase 1):
   * - '{' → parseBlockStatement()
   * - Everything else → parseExpressionStatement()
   *
   * Future routing (Phase 2+):
   * - 'if' → parseIfStatement()
   * - 'while' → parseWhileStatement()
   * - 'for' → parseForStatement()
   * - 'match' → parseMatchStatement()
   * - 'return' → parseReturnStatement()
   * - 'break' → parseBreakStatement()
   * - 'continue' → parseContinueStatement()
   *
   * @returns Statement AST node representing the parsed statement
   */
  protected parseStatement(): Statement {
    // Block statements
    if (this.check(TokenType.LEFT_BRACE)) {
      return this.parseBlockStatement();
    }

    // Control flow statements (Phase 2)
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
  // BLOCK STATEMENT PARSING
  // ============================================

  /**
   * Parses a block statement (sequence of statements in braces)
   *
   * Grammar: '{' Statement* '}'
   *
   * Block statements are used in:
   * - Function bodies: function foo() { stmt1; stmt2; }
   * - If/else branches: if condition { stmt1; } else { stmt2; }
   * - Loop bodies: while condition { stmt1; stmt2; }
   * - Standalone blocks for scoping: { let temp: byte = x; ... }
   *
   * Examples:
   * - Empty block: { }
   * - Single statement: { x = 5; }
   * - Multiple statements: { x = 5; y = 10; foo(); }
   * - Nested blocks: { { inner(); } outer(); }
   *
   * Error Recovery:
   * - Missing opening brace: Error reported, attempts to continue
   * - Missing closing brace: Error reported, synchronizes to likely end
   * - Invalid statements inside: Individual errors, continues parsing
   *
   * @returns BlockStatement AST node containing all parsed statements
   */
  protected parseBlockStatement(): BlockStatement {
    const startToken = this.expect(TokenType.LEFT_BRACE, "Expected '{'");

    const statements: Statement[] = [];

    // Parse statements until we hit closing brace or EOF
    while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        statements.push(stmt);
      } catch (error) {
        // Error recovery: skip problematic token and try to continue
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Error parsing statement: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        this.synchronize();
      }
    }

    this.expect(TokenType.RIGHT_BRACE, "Expected '}' to close block");

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new BlockStatement(statements, location);
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
   * Grammar: 'if' Expression 'then' Statement* ['else' Statement*] 'end' 'if'
   *
   * Examples:
   * - Simple if: if x > 0 then return; end if
   * - If-else: if flag then doThis(); else doThat(); end if
   * - Nested if: if x > 0 then if y > 0 then doSomething(); end if end if
   *
   * Error Recovery:
   * - Missing 'then': Reports error, continues parsing
   * - Missing 'end if': Reports error, synchronizes to likely end
   * - Invalid condition: Reports error, uses dummy condition
   *
   * @returns IfStatement AST node
   */
  protected parseIfStatement(): IfStatement {
    const startToken = this.expect(TokenType.IF, "Expected 'if'");

    // Parse condition expression
    let condition;
    try {
      condition = this.parseExpression();
    } catch (error) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Invalid if condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Use a dummy literal for error recovery
      const dummyLocation = this.getCurrentToken()
        ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
        : this.createLocation(startToken, startToken);
      condition = new LiteralExpression(false, dummyLocation);
    }

    // Expect 'then' keyword
    if (!this.match(TokenType.THEN)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'then' after if condition");
      // Try to recover by looking for statements anyway
    }

    // Parse then branch statements
    const thenBranch: Statement[] = [];
    while (!this.check(TokenType.ELSE) && !this.check(TokenType.END) && !this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        thenBranch.push(stmt);
      } catch (error) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Error parsing then branch: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        this.synchronize();
        break;
      }
    }

    // Parse optional else branch
    let elseBranch: Statement[] | null = null;
    if (this.match(TokenType.ELSE)) {
      elseBranch = [];
      while (!this.check(TokenType.END) && !this.isAtEnd()) {
        try {
          const stmt = this.parseStatement();
          elseBranch.push(stmt);
        } catch (error) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            `Error parsing else branch: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          this.synchronize();
          break;
        }
      }
    }

    // Expect 'end if'
    if (!this.match(TokenType.END)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'end' to close if statement");
    } else {
      if (!this.match(TokenType.IF)) {
        this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'if' after 'end'");
      }
    }

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

    // Increment loop nesting for break/continue validation
    this.loopNestingLevel++;

    // Parse condition expression
    let condition;
    try {
      condition = this.parseExpression();
    } catch (error) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Invalid while condition: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Use a dummy literal for error recovery
      const dummyLocation = this.getCurrentToken()
        ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
        : this.createLocation(startToken, startToken);
      condition = new LiteralExpression(false, dummyLocation);
    }

    // Parse body statements
    const body: Statement[] = [];
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        body.push(stmt);
      } catch (error) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Error parsing while body: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        this.synchronize();
        break;
      }
    }

    // Expect 'end while'
    if (!this.match(TokenType.END)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'end' to close while statement");
    } else {
      if (!this.match(TokenType.WHILE)) {
        this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'while' after 'end'");
      }
    }

    // Decrement loop nesting level
    this.loopNestingLevel--;

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

    // Increment loop nesting for break/continue validation
    this.loopNestingLevel++;

    // Parse loop variable
    const variableToken = this.expect(TokenType.IDENTIFIER, "Expected variable name after 'for'");
    const variable = variableToken.value;

    // Expect '='
    if (!this.match(TokenType.ASSIGN)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected '=' after for variable");
    }

    // Parse start expression
    let start;
    try {
      start = this.parseExpression();
    } catch (error) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Invalid for start expression: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Use dummy literal for error recovery
      const dummyLocation = this.getCurrentToken()
        ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
        : this.createLocation(startToken, startToken);
      start = new LiteralExpression(0, dummyLocation);
    }

    // Expect 'to'
    if (!this.match(TokenType.TO)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'to' after for start expression");
    }

    // Parse end expression
    let end;
    try {
      end = this.parseExpression();
    } catch (error) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Invalid for end expression: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Use dummy literal for error recovery
      const dummyLocation = this.getCurrentToken()
        ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
        : this.createLocation(startToken, startToken);
      end = new LiteralExpression(10, dummyLocation);
    }

    // Parse body statements
    const body: Statement[] = [];
    while (!this.check(TokenType.NEXT) && !this.isAtEnd()) {
      try {
        const stmt = this.parseStatement();
        body.push(stmt);
      } catch (error) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Error parsing for body: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        this.synchronize();
        break;
      }
    }

    // Expect 'next'
    if (!this.match(TokenType.NEXT)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'next' to close for loop");
    } else {
      // Expect matching variable name
      const nextVariableToken = this.expect(
        TokenType.IDENTIFIER,
        "Expected variable name after 'next'"
      );
      if (nextVariableToken.value !== variable) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Variable name mismatch: expected '${variable}' after 'next', got '${nextVariableToken.value}'`
        );
      }
    }

    // Decrement loop nesting level
    this.loopNestingLevel--;

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
    let value;
    try {
      value = this.parseExpression();
    } catch (error) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        `Invalid match expression: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      // Use dummy literal for error recovery
      const dummyLocation = this.getCurrentToken()
        ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
        : this.createLocation(startToken, startToken);
      value = new LiteralExpression(0, dummyLocation);
    }

    const cases: CaseClause[] = [];
    let defaultCase: Statement[] | null = null;

    // Parse case clauses and optional default
    while (!this.check(TokenType.END) && !this.isAtEnd()) {
      if (this.match(TokenType.CASE)) {
        // Parse case clause
        let caseValue;
        try {
          caseValue = this.parseExpression();
        } catch (error) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            `Invalid case expression: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          // Use dummy literal for error recovery
          const dummyLocation = this.getCurrentToken()
            ? this.createLocation(this.getCurrentToken(), this.getCurrentToken())
            : this.createLocation(startToken, startToken);
          caseValue = new LiteralExpression(0, dummyLocation);
        }

        // Expect ':'
        if (!this.match(TokenType.COLON)) {
          this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected ':' after case expression");
        }

        // Parse case body statements
        const caseBody: Statement[] = [];
        while (
          !this.check(TokenType.CASE) &&
          !this.check(TokenType.DEFAULT) &&
          !this.check(TokenType.END) &&
          !this.isAtEnd()
        ) {
          try {
            const stmt = this.parseStatement();
            caseBody.push(stmt);
          } catch (error) {
            this.reportError(
              DiagnosticCode.UNEXPECTED_TOKEN,
              `Error parsing case body: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            this.synchronize();
            break;
          }
        }

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
          this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected ':' after 'default'");
        }

        // Parse default body statements
        defaultCase = [];
        while (!this.check(TokenType.CASE) && !this.check(TokenType.END) && !this.isAtEnd()) {
          try {
            const stmt = this.parseStatement();
            defaultCase.push(stmt);
          } catch (error) {
            this.reportError(
              DiagnosticCode.UNEXPECTED_TOKEN,
              `Error parsing default case: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            this.synchronize();
            break;
          }
        }
      } else {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          "Expected 'case' or 'default' in match statement"
        );
        this.advance(); // Skip problematic token
      }
    }

    // Expect 'end match'
    if (!this.match(TokenType.END)) {
      this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'end' to close match statement");
    } else {
      if (!this.match(TokenType.MATCH)) {
        this.reportError(DiagnosticCode.EXPECTED_TOKEN, "Expected 'match' after 'end'");
      }
    }

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
   * Error Recovery:
   * - Invalid return expression: Reports error, uses null value
   * - Missing semicolon: Reports error, continues
   *
   * @returns ReturnStatement AST node
   */
  protected parseReturnStatement(): ReturnStatement {
    const startToken = this.expect(TokenType.RETURN, "Expected 'return'");

    // Parse optional return value
    let value = null;

    // Check if there's an expression before the semicolon
    if (!this.check(TokenType.SEMICOLON) && !this.isAtEnd()) {
      try {
        value = this.parseExpression();
      } catch (error) {
        this.reportError(
          DiagnosticCode.UNEXPECTED_TOKEN,
          `Invalid return expression: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
        // Continue with null value for error recovery
      }
    }

    this.expectSemicolon('Expected semicolon after return statement');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ReturnStatement(value, location);
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
   * Validation:
   * - Must be inside a loop (while, for) - validated at parse time
   * - Reports error if used outside loop context
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
    if (this.loopNestingLevel === 0) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "'break' statement must be inside a loop (while or for)"
      );
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
   * Validation:
   * - Must be inside a loop (while, for) - validated at parse time
   * - Reports error if used outside loop context
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
    if (this.loopNestingLevel === 0) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        "'continue' statement must be inside a loop (while or for)"
      );
    }

    this.expectSemicolon('Expected semicolon after continue statement');

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ContinueStatement(location);
  }
}
