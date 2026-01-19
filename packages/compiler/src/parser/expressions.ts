/**
 * Expression Parser for Blend65 Compiler
 *
 * Extends BaseParser to provide expression parsing capabilities:
 * - Primary expressions (literals, identifiers, parenthesized)
 * - Binary expressions with Pratt parser (precedence climbing)
 * - Number parsing (decimal, hex, binary formats)
 * - Expression utilities and precedence handling
 *
 * Future phases will add advanced expressions (calls, member access, assignments).
 */

import {
  ArrayLiteralExpression,
  AssignmentExpression,
  BinaryExpression,
  CallExpression,
  Expression,
  IdentifierExpression,
  IndexExpression,
  LiteralExpression,
  MemberExpression,
  UnaryExpression,
  DiagnosticCode,
} from '../ast/index.js';
import { TokenType } from '../lexer/types.js';
import {
  getPrecedence,
  isBinaryOperator,
  isRightAssociative,
  OperatorPrecedence,
} from './precedence.js';
import { BaseParser } from './base.js';

/**
 * Expression parser class - extends BaseParser with expression parsing capabilities
 *
 * Handles all expression parsing using Pratt parser algorithm for proper
 * operator precedence and associativity. Provides the foundation that
 * statement and declaration parsers can build upon.
 *
 * Current expression support (Phase 0):
 * - Number literals: 42, $D000, 0xFF, 0b1010
 * - String literals: "hello", 'world'
 * - Boolean literals: true, false
 * - Identifiers: counter, myVar
 * - Parenthesized expressions: (2 + 3)
 * - Binary expressions: +, -, *, /, ==, !=, <, >, etc.
 *
 * Future expression support (Phase 3):
 * - Function calls: foo(x, y)
 * - Member access: obj.property
 * - Index access: array[index]
 * - Assignment: x = value
 * - Unary operators: -x, !flag
 */
export abstract class ExpressionParser extends BaseParser {
  // ============================================
  // PRIMARY EXPRESSION PARSING
  // ============================================

  /**
   * Parses a primary expression
   *
   * Primary expressions are the "atoms" of the language - the simplest
   * expressions that cannot be broken down further. These are the base
   * case for recursive expression parsing.
   *
   * Primary expressions supported:
   * - Number literals: 42, $D000, 0xFF, 0b1010
   * - String literals: "hello", 'world'
   * - Boolean literals: true, false
   * - Identifiers: counter, myVar
   * - Parenthesized expressions: (2 + 3)
   *
   * @returns Expression AST node representing a primary expression
   */
  protected parsePrimaryExpression(): Expression {
    // Number literals
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      const value = this.parseNumberValue(token.value);
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // String literals
    if (this.check(TokenType.STRING_LITERAL)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new LiteralExpression(token.value, location);
    }

    // Boolean literals
    if (this.check(TokenType.BOOLEAN_LITERAL)) {
      const token = this.advance();
      const value = token.value === 'true';
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // Type keywords (for sizeof() and other compile-time operations)
    // These are parsed as literals containing the type name string
    if (
      this.check(TokenType.BYTE) ||
      this.check(TokenType.WORD) ||
      this.check(TokenType.BOOLEAN) ||
      this.check(TokenType.VOID)
    ) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      // Store the type name as a string literal
      return new LiteralExpression(token.value, location);
    }

    // Identifiers
    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new IdentifierExpression(token.value, location);
    }

    // Parenthesized expressions
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RIGHT_PAREN, "Expected ')' after expression");
      return expr;
    }

    // Error - unexpected token
    this.reportError(
      DiagnosticCode.UNEXPECTED_TOKEN,
      `Expected expression, found '${this.getCurrentToken().value}'`
    );

    // Return dummy expression for recovery
    return this.createDummyExpression();
  }

  /**
   * Parses a number value from string
   *
   * Handles different number formats:
   * - Decimal: 42, 255
   * - Hex ($ prefix): $D000, $FF
   * - Hex (0x prefix): 0xD000, 0xFF
   * - Binary (0b prefix): 0b1010, 0b11110000
   *
   * @param value - String representation of number
   * @returns Numeric value
   */
  protected parseNumberValue(value: string): number {
    // Hex with $ prefix
    if (value.startsWith('$')) {
      return parseInt(value.substring(1), 16);
    }

    // Hex with 0x prefix
    if (value.startsWith('0x')) {
      return parseInt(value, 16);
    }

    // Binary with 0b prefix
    if (value.startsWith('0b')) {
      return parseInt(value.substring(2), 2);
    }

    // Decimal
    return parseInt(value, 10);
  }

  // ============================================
  // PRATT EXPRESSION PARSING INFRASTRUCTURE
  // ============================================

  /**
   * Parses an expression using Pratt parser with precedence climbing
   *
   * This is a universal expression parsing algorithm that works for any grammar.
   * It handles operator precedence and associativity by recursively parsing
   * operands and building binary expression trees.
   *
   * The algorithm:
   * 1. Parse left operand (primary expression)
   * 2. While current token is a binary operator with sufficient precedence:
   *    a. Save the operator and its precedence
   *    b. Consume the operator
   *    c. Calculate next minimum precedence (handles associativity)
   *    d. Recursively parse right operand
   *    e. Build binary expression node with merged locations
   *    f. Continue with result as new left operand
   * 3. Return final expression tree
   *
   * Examples of parsed expressions:
   * - Simple: 42 → LiteralExpression(42)
   * - Variable: counter → IdentifierExpression("counter")
   * - Binary: 2 + 3 → BinaryExpression(2, PLUS, 3)
   * - Precedence: x * y + z → BinaryExpression((x * y), PLUS, z)
   * - Associativity: a = b = c → BinaryExpression(a, ASSIGN, (b = c))
   *
   * @param minPrecedence - Minimum precedence for operators (default: NONE)
   *                        Used internally for precedence climbing
   * @returns Expression AST node representing the parsed expression
   */
  protected parseExpression(minPrecedence: number = OperatorPrecedence.NONE): Expression {
    // Parse left side (unary expression, which handles postfix and atomic expressions)
    let left = this.parseUnaryExpression();

    // Parse binary operators with precedence climbing
    while (this.isBinaryOp() && this.getCurrentPrecedence() >= minPrecedence) {
      const operator = this.getCurrentToken().type;
      const precedence = this.getCurrentPrecedence();

      this.advance(); // Consume operator

      // For right-associative operators (like =), use same precedence
      // For left-associative operators, use precedence + 1 to force tighter binding on right
      const nextMinPrecedence = this.isRightAssoc(operator) ? precedence : precedence + 1;

      const right = this.parseExpression(nextMinPrecedence);

      // Merge locations from left and right operands
      const location = this.mergeLocations(left.getLocation(), right.getLocation());

      // Handle assignment operators specially
      if (this.isAssignmentOperator(operator)) {
        // Validate left-hand side is a valid lvalue
        if (!this.isValidLValue(left)) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Invalid left-hand side in assignment expression'
          );
        }

        left = new AssignmentExpression(left, operator, right, location);
      } else {
        // Regular binary operators
        left = new BinaryExpression(left, operator, right, location);
      }
    }

    return left;
  }

  /**
   * Gets the precedence of the current token
   *
   * Used by Pratt parser to decide how to group operators.
   *
   * @returns Precedence level (0 = not an operator)
   */
  protected getCurrentPrecedence(): number {
    return getPrecedence(this.getCurrentToken().type);
  }

  /**
   * Checks if current token is a binary operator
   *
   * @returns True if current token is a binary operator
   */
  protected isBinaryOp(): boolean {
    return isBinaryOperator(this.getCurrentToken().type);
  }

  /**
   * Checks if an operator is right-associative
   *
   * Right-associative: a = b = c → a = (b = c)
   * Left-associative: a + b + c → (a + b) + c
   *
   * @param tokenType - Operator to check
   * @returns True if right-associative
   */
  protected isRightAssoc(tokenType: TokenType): boolean {
    return isRightAssociative(tokenType);
  }

  // ============================================
  // UNARY EXPRESSION PARSING (PHASE 3)
  // ============================================

  /**
   * Parses unary expressions with prefix operators
   *
   * Unary expressions have right-to-left associativity and high precedence.
   * They support nesting: --x, !!flag, ~-value
   *
   * Supported unary operators (from specification):
   * - ! (logical NOT): !flag, !!value
   * - ~ (bitwise NOT): ~mask, ~0xFF
   * - + (unary plus): +value (explicit positive)
   * - - (unary minus): -x, -42
   * - @ (address-of): @variable, @counter
   *
   * Address-of operator restrictions:
   * - Can only be applied to identifiers (variables)
   * - Cannot be applied to literals: @5 (compile error)
   * - Cannot be applied to expressions: @(x + y) (compile error)
   *
   * Grammar: unary_expr = [ unary_op ] , unary_expr | postfix_expr
   *
   * @returns Expression AST node representing unary or postfix expression
   */
  protected parseUnaryExpression(): Expression {
    // Check for unary operators: ! ~ + - @
    if (this.isUnaryOperator()) {
      const operatorToken = this.advance(); // Consume unary operator

      // Special validation for address-of operator
      if (operatorToken.type === TokenType.AT) {
        // Address-of can only be applied to identifiers
        if (!this.check(TokenType.IDENTIFIER)) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Address-of operator (@) can only be applied to variables, not literals or expressions'
          );

          // Return dummy expression for recovery (don't parse further)
          return this.createDummyExpression();
        }
      }

      // Parse operand recursively (right-associative: --x becomes -(-x))
      const operand = this.parseUnaryExpression();

      // Create location from operator to end of operand
      const location = this.createLocation(operatorToken, this.getCurrentToken());

      return new UnaryExpression(operatorToken.type, operand, location);
    }

    // No unary operator - delegate to postfix expression parsing
    return this.parsePostfixExpression();
  }

  /**
   * Parses postfix expressions - SPECIFICATION COMPLIANT
   *
   * Blend65 has LIMITED support for postfix operations, unlike object-oriented languages:
   *
   * SUPPORTED (specification-compliant):
   * - Function calls on identifiers: func(), calculateScore(a, b)
   * - Array indexing: array[0], matrix[row][col] (chained indexing allowed)
   * - @map member access: vic.borderColor (single level only)
   *
   * NOT SUPPORTED (not in specification):
   * - Method calls: obj.method()
   * - Complex chaining: obj.prop.method()[index].field
   * - Mixed operation chains: player.inventory.items[slot].getValue()
   *
   * @returns Expression AST node representing postfix or atomic expression
   */
  protected parsePostfixExpression(): Expression {
    // Start with primary expression (atomic expressions)
    let expr = this.parseAtomicExpression();

    // SPECIFICATION ENFORCEMENT: Only ONE postfix operation allowed, no chaining
    if (this.isPostfixOperator()) {
      if (this.check(TokenType.LEFT_PAREN)) {
        // Function calls: only on identifiers, absolutely no chaining after
        expr = this.parseCallExpression(expr);

        // CRITICAL: Detect and reject any further chaining attempts
        if (this.isPostfixOperator()) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Chaining after function calls is not supported in Blend65. Use standalone function calls only.'
          );
        }
        return expr;
      } else if (this.check(TokenType.LEFT_BRACKET)) {
        // Array indexing: allow multiple brackets (matrix[row][col])
        while (this.check(TokenType.LEFT_BRACKET)) {
          expr = this.parseIndexExpression(expr);
        }

        // CRITICAL: Detect and reject member access or function calls after indexing
        if (this.check(TokenType.DOT) || this.check(TokenType.LEFT_PAREN)) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Member access and function calls after array indexing are not supported in Blend65.'
          );
        }
        return expr;
      } else if (this.check(TokenType.DOT)) {
        // Member access: only for @map, single level only
        expr = this.parseMemberExpression(expr);

        // CRITICAL: Detect and reject any further chaining after member access
        if (this.isPostfixOperator()) {
          this.reportError(
            DiagnosticCode.UNEXPECTED_TOKEN,
            'Chaining after member access is not supported in Blend65. Use simple @map access only.'
          );
        }
        return expr;
      }
    }

    return expr;
  }

  /**
   * Parses atomic expressions (renamed from parsePrimaryExpression)
   *
   * These are the most basic expressions that cannot be decomposed further:
   * - Literals: 42, "hello", true
   * - Identifiers: counter, myVar
   * - Parenthesized expressions: (2 + 3)
   * - Array literals: [1, 2, 3], [[1, 2], [3, 4]]
   * - Type keywords: byte, word, boolean, void (for sizeof() and compile-time operations)
   *
   * @returns Expression AST node representing an atomic expression
   */
  protected parseAtomicExpression(): Expression {
    // Number literals
    if (this.check(TokenType.NUMBER)) {
      const token = this.advance();
      const value = this.parseNumberValue(token.value);
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // String literals
    if (this.check(TokenType.STRING_LITERAL)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new LiteralExpression(token.value, location);
    }

    // Boolean literals
    if (this.check(TokenType.BOOLEAN_LITERAL)) {
      const token = this.advance();
      const value = token.value === 'true';
      const location = this.createLocation(token, token);
      return new LiteralExpression(value, location);
    }

    // Type keywords (for sizeof() and other compile-time operations)
    // These are parsed as literals containing the type name string
    if (
      this.check(TokenType.BYTE) ||
      this.check(TokenType.WORD) ||
      this.check(TokenType.BOOLEAN) ||
      this.check(TokenType.VOID)
    ) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      // Store the type name as a string literal
      return new LiteralExpression(token.value, location);
    }

    // Identifiers
    if (this.check(TokenType.IDENTIFIER)) {
      const token = this.advance();
      const location = this.createLocation(token, token);
      return new IdentifierExpression(token.value, location);
    }

    // Array literals: [1, 2, 3]
    if (this.check(TokenType.LEFT_BRACKET)) {
      return this.parseArrayLiteral();
    }

    // Parenthesized expressions
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.parseExpression();
      this.expect(TokenType.RIGHT_PAREN, "Expected ')' after expression");
      return expr;
    }

    // Error - unexpected token
    this.reportError(
      DiagnosticCode.UNEXPECTED_TOKEN,
      `Expected expression, found '${this.getCurrentToken().value}'`
    );

    // Return dummy expression for recovery
    return this.createDummyExpression();
  }

  // ============================================
  // UTILITY METHODS FOR EXPRESSION PARSING
  // ============================================

  /**
   * Creates a dummy expression for error recovery
   *
   * **Purpose:**
   * When the parser encounters an error while parsing an expression
   * (e.g., unexpected token, missing operand, invalid syntax), we need
   * to return a synthetic expression to allow parsing to continue.
   *
   * **Why a Literal with Value 0?**
   * - Simple and predictable: won't cause secondary errors
   * - Type-safe: LiteralExpression is a valid Expression subtype
   * - Neutral value: 0 is safe for most contexts (arithmetic, boolean, etc.)
   * - Easy to identify: developers can see "0" in error recovery paths
   *
   * **Usage Patterns:**
   * This helper is called whenever:
   * - Expected expression token not found (parsePrimaryExpression)
   * - Invalid operand in unary expression
   * - Malformed postfix expression
   * - Error in function call arguments
   * - Any other expression parsing error
   *
   * **Error Recovery Strategy:**
   * By returning a dummy expression instead of throwing:
   * - Parser can continue and report multiple errors
   * - Partial AST can be constructed for IDE features
   * - Better developer experience (see all errors at once)
   * - Enables incremental parsing for editors
   *
   * @returns A dummy LiteralExpression(0) positioned at current location
   *
   * @example
   * ```typescript
   * // Parser expected expression but found '}'
   * if (!this.isExpression()) {
   *   this.reportError(...);
   *   return this.createDummyExpression(); // Returns LiteralExpression(0)
   * }
   * ```
   */
  protected createDummyExpression(): Expression {
    return new LiteralExpression(0, this.currentLocation());
  }

  /**
   * Checks if the current token is a unary operator
   *
   * @returns True if current token is a unary operator (!, ~, +, -, @)
   */
  protected isUnaryOperator(): boolean {
    const tokenType = this.getCurrentToken().type;
    return (
      tokenType === TokenType.NOT || // !
      tokenType === TokenType.BITWISE_NOT || // ~
      tokenType === TokenType.PLUS || // +
      tokenType === TokenType.MINUS || // -
      tokenType === TokenType.AT // @
    );
  }

  /**
   * Checks if the current token is a postfix operator
   *
   * @returns True if current token is a postfix operator ((), [], .)
   */
  protected isPostfixOperator(): boolean {
    const tokenType = this.getCurrentToken().type;
    return (
      tokenType === TokenType.LEFT_PAREN || // (
      tokenType === TokenType.LEFT_BRACKET || // [
      tokenType === TokenType.DOT // .
    );
  }

  /**
   * Checks if a token is an assignment operator
   *
   * Assignment operators from specification:
   * = += -= *= /= %= &= |= ^= <<= >>=
   *
   * @param tokenType - Token type to check
   * @returns True if token is an assignment operator
   */
  protected isAssignmentOperator(tokenType: TokenType): boolean {
    return (
      tokenType === TokenType.ASSIGN || // =
      tokenType === TokenType.PLUS_ASSIGN || // +=
      tokenType === TokenType.MINUS_ASSIGN || // -=
      tokenType === TokenType.MULTIPLY_ASSIGN || // *=
      tokenType === TokenType.DIVIDE_ASSIGN || // /=
      tokenType === TokenType.MODULO_ASSIGN || // %=
      tokenType === TokenType.BITWISE_AND_ASSIGN || // &=
      tokenType === TokenType.BITWISE_OR_ASSIGN || // |=
      tokenType === TokenType.BITWISE_XOR_ASSIGN || // ^=
      tokenType === TokenType.LEFT_SHIFT_ASSIGN || // <<=
      tokenType === TokenType.RIGHT_SHIFT_ASSIGN // >>=
    );
  }

  /**
   * Checks if an expression is a valid left-hand side value (lvalue)
   *
   * Valid lvalues from specification:
   * - Identifiers: counter, myVar
   * - Member expressions: player.health, Game.score
   * - Index expressions: array[0], buffer[i]
   *
   * Invalid lvalues (literals and function calls):
   * - Literals: 42, "hello", true
   * - Function calls: func(), getValue()
   * - Complex expressions: (x + y), -value
   *
   * @param expr - Expression to validate
   * @returns True if expression can be assigned to
   */
  protected isValidLValue(expr: Expression): boolean {
    return (
      expr instanceof IdentifierExpression || // counter, myVar
      expr instanceof MemberExpression || // player.health, Game.score
      expr instanceof IndexExpression // array[0], buffer[i]
    );
  }

  // ============================================
  // POSTFIX EXPRESSION METHODS (PHASE 3 - TO BE IMPLEMENTED)
  // ============================================

  /**
   * Parses function call expressions - SPECIFICATION COMPLIANT
   *
   * Function calls in Blend65 can ONLY be called on identifiers (standalone functions).
   * Object-oriented method calls (obj.method()) are NOT supported in Blend65.
   *
   * Valid calls:
   * - init()
   * - calculateScore(level, bonus)
   * - getValue()
   *
   * Invalid calls (not in specification):
   * - obj.method()  // No method calls
   * - array[i].func()  // No method calls on expressions
   *
   * Grammar: call_suffix = "(" , [ argument_list ] , ")" ;
   *          argument_list = expression , { "," , expression } ;
   *
   * @param callee - The expression being called (MUST be identifier only)
   * @returns CallExpression AST node
   */
  protected parseCallExpression(callee: Expression): CallExpression {
    // SPECIFICATION COMPLIANCE: Only allow function calls on identifiers
    if (!(callee instanceof IdentifierExpression)) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        'Function calls can only be made on standalone function names, not on expressions. Blend65 does not support object methods.'
      );
      // Return dummy call for error recovery
      const location = this.mergeLocations(callee.getLocation(), this.currentLocation());
      return new CallExpression(callee, [], location);
    }

    // Consume opening parenthesis
    this.expect(TokenType.LEFT_PAREN, "Expected '(' for function call");

    const args: Expression[] = [];

    // Parse argument list (if any)
    if (!this.check(TokenType.RIGHT_PAREN)) {
      do {
        // Parse each argument as a full expression
        args.push(this.parseExpression());
      } while (this.match(TokenType.COMMA));
    }

    // Consume closing parenthesis
    this.expect(TokenType.RIGHT_PAREN, "Expected ')' after function arguments");

    // Create location spanning from callee to closing parenthesis
    const location = this.mergeLocations(callee.getLocation(), this.currentLocation());

    return new CallExpression(callee, args, location);
  }

  /**
   * Parses member access expressions - SPECIFICATION COMPLIANT
   *
   * Member access in Blend65 is ONLY allowed for @map declarations (memory-mapped registers).
   * General object-oriented member access is NOT supported in Blend65.
   *
   * Valid member access:
   * - vic.borderColor  // If vic is a @map declaration
   * - sid.voice1Freq   // If sid is a @map declaration
   *
   * Invalid member access (not in specification):
   * - player.health    // No general object access
   * - obj.prop.subprop // No nested object access
   * - array[i].field   // No member access on expressions
   *
   * Grammar: member_suffix = "." , identifier ;
   *
   * @param object - The expression being accessed (MUST be @map identifier only)
   * @returns MemberExpression AST node
   */
  protected parseMemberExpression(object: Expression): MemberExpression {
    // SPECIFICATION COMPLIANCE: Only allow member access on @map declarations
    // For now, we only allow simple identifiers (not complex expressions)
    if (!(object instanceof IdentifierExpression)) {
      this.reportError(
        DiagnosticCode.UNEXPECTED_TOKEN,
        'Member access can only be used on @map declarations, not on expressions. Blend65 does not support general object-oriented syntax.'
      );
    }

    // Consume dot operator
    this.expect(TokenType.DOT, "Expected '.' for member access");

    // Property name must be an identifier
    const propertyToken = this.expect(TokenType.IDENTIFIER, "Expected property name after '.'");

    // Create location spanning from object to property
    const location = this.mergeLocations(object.getLocation(), this.currentLocation());

    return new MemberExpression(object, propertyToken.value, location);
  }

  /**
   * Parses index access expressions
   *
   * Index access has the form: expression[expression]
   * - Simple indexing: array[0]
   * - Expression indexing: buffer[i * 2 + 1]
   * - Chained indexing: matrix[row][col]
   * - On function calls: getData()[index]
   *
   * Grammar: index_suffix = "[" , expression , "]" ;
   *
   * @param array - The expression being indexed (left side of bracket)
   * @returns IndexExpression AST node
   */
  protected parseIndexExpression(array: Expression): IndexExpression {
    // Consume opening bracket
    this.expect(TokenType.LEFT_BRACKET, "Expected '[' for index access");

    // Parse index expression (can be any expression: literals, variables, complex expressions)
    const indexExpr = this.parseExpression();

    // Consume closing bracket
    this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after index expression");

    // Create location spanning from array to closing bracket
    const location = this.mergeLocations(array.getLocation(), this.currentLocation());

    return new IndexExpression(array, indexExpr, location);
  }

  // ============================================
  // ARRAY LITERAL PARSING
  // ============================================

  /**
   * Parses array literal expressions
   *
   * Array literals provide a concise syntax for initializing arrays inline.
   * Supports empty arrays, single/multiple elements, nested arrays (multidimensional),
   * and expressions as elements.
   *
   * Grammar:
   * array_literal = "[" , [ expression_list ] , "]" ;
   * expression_list = expression , { "," , expression } , [ "," ] ;
   *
   * Handles:
   * - Empty arrays: []
   * - Single element: [42]
   * - Multiple elements: [1, 2, 3]
   * - Nested arrays (multidimensional): [[1, 2], [3, 4]]
   * - Trailing commas: [1, 2, 3,]
   * - Expressions as elements: [x, y + 1, foo()]
   *
   * Note: Multidimensional arrays are syntactic sugar - they will compile to
   * flat arrays with calculated offsets for 6502 efficiency in code generation phase.
   *
   * @returns ArrayLiteralExpression AST node
   */
  protected parseArrayLiteral(): Expression {
    const startToken = this.getCurrentToken();

    // Parse opening bracket
    this.expect(TokenType.LEFT_BRACKET, "Expected '['");

    const elements: Expression[] = [];

    // Handle empty array: []
    if (this.check(TokenType.RIGHT_BRACKET)) {
      this.advance(); // consume ']'
      const location = this.createLocation(startToken, this.getCurrentToken());
      return new ArrayLiteralExpression(elements, location);
    }

    // Parse element list
    do {
      // Parse element expression (can be any expression, including nested arrays)
      const element = this.parseExpression();
      elements.push(element);

      // Check for comma (required between elements, optional after last)
      if (this.match(TokenType.COMMA)) {
        // Check for trailing comma: [1, 2, 3,]
        if (this.check(TokenType.RIGHT_BRACKET)) {
          break; // Allow trailing comma
        }
        // Continue parsing next element
      } else {
        // No comma, must be end of list
        break;
      }
    } while (!this.check(TokenType.RIGHT_BRACKET) && !this.isAtEnd());

    // Parse closing bracket
    this.expect(TokenType.RIGHT_BRACKET, "Expected ']' after array elements");

    const location = this.createLocation(startToken, this.getCurrentToken());
    return new ArrayLiteralExpression(elements, location);
  }
}
