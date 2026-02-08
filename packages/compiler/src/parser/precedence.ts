/**
 * Operator Precedence for Pratt Parser - Blend65 v2
 *
 * Defines the precedence (binding power) of operators for expression parsing.
 * Higher precedence = tighter binding.
 *
 * Example: In "2 + 3 * 4", * has higher precedence than +,
 * so it binds tighter, resulting in "2 + (3 * 4)" not "(2 + 3) * 4"
 */

import { TokenType } from '../lexer/types.js';

/**
 * Operator precedence levels
 *
 * Lower number = lower precedence (binds less tightly)
 * Higher number = higher precedence (binds more tightly)
 *
 * Precedence ladder (from lowest to highest):
 * 1. Assignment (=, +=, -=, etc.)
 * 2. Ternary conditional (? :)
 * 3. Logical OR (||)
 * 4. Logical AND (&&)
 * 5. Bitwise OR (|)
 * 6. Bitwise XOR (^)
 * 7. Bitwise AND (&)
 * 8. Equality (==, !=)
 * 9. Relational (<, <=, >, >=)
 * 10. Shift (<<, >>)
 * 11. Additive (+, -)
 * 12. Multiplicative (*, /, %)
 * 13. Unary (!, ~, unary -, unary +)
 * 14. Postfix ([], ., ())
 *
 * Based on C operator precedence with adjustments for Blend65.
 */
export enum OperatorPrecedence {
  /** No precedence (not an operator) */
  NONE = 0,

  /** Assignment operators: =, +=, -=, *=, /=, %=, &=, |=, ^=, <<=, >>= */
  ASSIGNMENT = 1,

  /** Ternary conditional: condition ? then : else (right-associative) */
  TERNARY = 2,

  /** Logical OR: || */
  LOGICAL_OR = 3,

  /** Logical AND: && */
  LOGICAL_AND = 4,

  /** Bitwise OR: | */
  BITWISE_OR = 5,

  /** Bitwise XOR: ^ */
  BITWISE_XOR = 6,

  /** Bitwise AND: & */
  BITWISE_AND = 7,

  /** Equality: ==, != */
  EQUALITY = 8,

  /** Relational: <, <=, >, >= */
  RELATIONAL = 9,

  /** Shift: <<, >> */
  SHIFT = 10,

  /** Additive: +, - */
  ADDITIVE = 11,

  /** Multiplicative: *, /, % */
  MULTIPLICATIVE = 12,

  /** Unary: !, ~, unary -, unary + */
  UNARY = 13,

  /** Postfix: [], ., () */
  POSTFIX = 14,
}

/**
 * Operator precedence table
 *
 * Maps token types to their precedence levels.
 * Used by the Pratt parser to determine how to group operators.
 *
 * Example usage:
 * ```typescript
 * const precedence = PRECEDENCE_TABLE.get(TokenType.PLUS);
 * if (precedence > minPrecedence) {
 *   // Parse as infix operator
 * }
 * ```
 */
export const PRECEDENCE_TABLE = new Map<TokenType, OperatorPrecedence>([
  // ============================================
  // ASSIGNMENT (Precedence 1)
  // ============================================
  // Right-associative in most languages
  [TokenType.ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.PLUS_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.MINUS_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.MULTIPLY_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.DIVIDE_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.MODULO_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.BITWISE_AND_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.BITWISE_OR_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.BITWISE_XOR_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.LEFT_SHIFT_ASSIGN, OperatorPrecedence.ASSIGNMENT],
  [TokenType.RIGHT_SHIFT_ASSIGN, OperatorPrecedence.ASSIGNMENT],

  // ============================================
  // TERNARY (Precedence 2) - Handled specially in parser
  // ============================================
  // Note: QUESTION token is not added here because ternary
  // parsing requires special handling (? and : are not
  // a simple binary operator). The parser checks for
  // QUESTION after parsing a condition expression.
  [TokenType.QUESTION, OperatorPrecedence.TERNARY],

  // ============================================
  // LOGICAL OR (Precedence 3)
  // ============================================
  [TokenType.OR, OperatorPrecedence.LOGICAL_OR],

  // ============================================
  // LOGICAL AND (Precedence 4)
  // ============================================
  [TokenType.AND, OperatorPrecedence.LOGICAL_AND],

  // ============================================
  // BITWISE OR (Precedence 5)
  // ============================================
  [TokenType.BITWISE_OR, OperatorPrecedence.BITWISE_OR],

  // ============================================
  // BITWISE XOR (Precedence 6)
  // ============================================
  [TokenType.BITWISE_XOR, OperatorPrecedence.BITWISE_XOR],

  // ============================================
  // BITWISE AND (Precedence 7)
  // ============================================
  [TokenType.BITWISE_AND, OperatorPrecedence.BITWISE_AND],

  // ============================================
  // EQUALITY (Precedence 8)
  // ============================================
  [TokenType.EQUAL, OperatorPrecedence.EQUALITY],
  [TokenType.NOT_EQUAL, OperatorPrecedence.EQUALITY],

  // ============================================
  // RELATIONAL (Precedence 9)
  // ============================================
  [TokenType.LESS_THAN, OperatorPrecedence.RELATIONAL],
  [TokenType.LESS_EQUAL, OperatorPrecedence.RELATIONAL],
  [TokenType.GREATER_THAN, OperatorPrecedence.RELATIONAL],
  [TokenType.GREATER_EQUAL, OperatorPrecedence.RELATIONAL],

  // ============================================
  // SHIFT (Precedence 10)
  // ============================================
  [TokenType.LEFT_SHIFT, OperatorPrecedence.SHIFT],
  [TokenType.RIGHT_SHIFT, OperatorPrecedence.SHIFT],

  // ============================================
  // ADDITIVE (Precedence 11)
  // ============================================
  [TokenType.PLUS, OperatorPrecedence.ADDITIVE],
  [TokenType.MINUS, OperatorPrecedence.ADDITIVE],

  // ============================================
  // MULTIPLICATIVE (Precedence 12)
  // ============================================
  [TokenType.MULTIPLY, OperatorPrecedence.MULTIPLICATIVE],
  [TokenType.DIVIDE, OperatorPrecedence.MULTIPLICATIVE],
  [TokenType.MODULO, OperatorPrecedence.MULTIPLICATIVE],

  // Note: Unary operators (precedence 13) are handled specially in the parser
  // They don't appear in the infix table because they're prefix operators

  // ============================================
  // POSTFIX (Precedence 14)
  // ============================================
  // These are handled specially as they have unique parsing logic
  [TokenType.LEFT_BRACKET, OperatorPrecedence.POSTFIX], // Array indexing: array[index]
  [TokenType.DOT, OperatorPrecedence.POSTFIX], // Member access: obj.prop
  [TokenType.LEFT_PAREN, OperatorPrecedence.POSTFIX], // Function call: func()
]);

/**
 * Gets the precedence of an operator token
 *
 * @param tokenType - The token type to check
 * @returns Precedence level, or NONE if not an operator
 *
 * @example
 * ```typescript
 * const prec = getPrecedence(TokenType.PLUS);
 * // Returns OperatorPrecedence.ADDITIVE (10)
 * ```
 */
export function getPrecedence(tokenType: TokenType): OperatorPrecedence {
  return PRECEDENCE_TABLE.get(tokenType) ?? OperatorPrecedence.NONE;
}

/**
 * Checks if a token is a binary operator
 *
 * A token is a binary operator if it has a defined precedence > NONE.
 *
 * @param tokenType - The token type to check
 * @returns True if the token is a binary operator
 *
 * @example
 * ```typescript
 * isBinaryOperator(TokenType.PLUS);  // true
 * isBinaryOperator(TokenType.IF);    // false
 * ```
 */
export function isBinaryOperator(tokenType: TokenType): boolean {
  return getPrecedence(tokenType) > OperatorPrecedence.NONE;
}

/**
 * Checks if an operator is right-associative
 *
 * Most operators are left-associative (a + b + c = (a + b) + c)
 * Assignment and ternary operators are right-associative:
 * - Assignment: a = b = c = (a = (b = c))
 * - Ternary: a ? b : c ? d : e = a ? b : (c ? d : e)
 *
 * @param tokenType - The token type to check
 * @returns True if right-associative
 *
 * @example
 * ```typescript
 * isRightAssociative(TokenType.ASSIGN);    // true
 * isRightAssociative(TokenType.QUESTION);  // true
 * isRightAssociative(TokenType.PLUS);      // false
 * ```
 */
export function isRightAssociative(tokenType: TokenType): boolean {
  const prec = getPrecedence(tokenType);
  // Assignment and ternary operators are right-associative in Blend65
  return prec === OperatorPrecedence.ASSIGNMENT || prec === OperatorPrecedence.TERNARY;
}

/**
 * Gets the binding power for Pratt parsing
 *
 * For right-associative operators, we need to use precedence - 1
 * when recursing to allow the right operand to bind at the same level.
 *
 * @param tokenType - The operator token
 * @returns Binding power to use when parsing right operand
 *
 * @example
 * ```typescript
 * // For left-associative: a + b + c
 * // After parsing "a +", we use precedence + 1 to ensure
 * // the next "+" doesn't bind as tightly
 *
 * // For right-associative: a = b = c
 * // After parsing "a =", we use precedence to allow
 * // the next "=" to bind at the same level
 * ```
 */
export function getBindingPower(tokenType: TokenType): OperatorPrecedence {
  const prec = getPrecedence(tokenType);
  // For right-associative operators, use same precedence
  // For left-associative, this will be incremented by caller
  return prec;
}