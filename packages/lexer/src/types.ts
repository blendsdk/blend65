/**
 * Token types for the Blend65 lexer
 * Blend65 is a multi-target 6502 language without OOP features
 */

export enum TokenType {
  // Literals
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  IDENTIFIER = 'IDENTIFIER',

  // Keywords - Core language constructs
  MODULE = 'MODULE',
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  FROM = 'FROM',
  TARGET = 'TARGET',
  FUNCTION = 'FUNCTION',
  END = 'END',
  RETURN = 'RETURN',

  // Control flow keywords
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  WHILE = 'WHILE',
  FOR = 'FOR',
  TO = 'TO',
  NEXT = 'NEXT',
  MATCH = 'MATCH',
  CASE = 'CASE',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  DEFAULT = 'DEFAULT',

  // Type and variable declarations
  VAR = 'VAR',
  TYPE = 'TYPE',
  EXTENDS = 'EXTENDS',
  ENUM = 'ENUM',

  // Storage class keywords
  ZP = 'ZP', // Zero page storage
  RAM = 'RAM', // RAM storage
  DATA = 'DATA', // Initialized data
  CONST = 'CONST', // Constant/ROM data

  // Primitive type keywords
  BYTE = 'BYTE',
  WORD = 'WORD',
  VOID = 'VOID',
  CALLBACK = 'CALLBACK', // NEW: Callback keyword token

  // Operators - Arithmetic
  PLUS = 'PLUS',
  MINUS = 'MINUS',
  MULTIPLY = 'MULTIPLY',
  DIVIDE = 'DIVIDE',
  MODULO = 'MODULO',

  // Operators - Assignment
  ASSIGN = 'ASSIGN',
  PLUS_ASSIGN = 'PLUS_ASSIGN',
  MINUS_ASSIGN = 'MINUS_ASSIGN',
  MULTIPLY_ASSIGN = 'MULTIPLY_ASSIGN',
  DIVIDE_ASSIGN = 'DIVIDE_ASSIGN',
  MODULO_ASSIGN = 'MODULO_ASSIGN',

  // Operators - Comparison
  EQUAL = 'EQUAL',
  NOT_EQUAL = 'NOT_EQUAL',
  LESS_THAN = 'LESS_THAN',
  LESS_EQUAL = 'LESS_EQUAL',
  GREATER_THAN = 'GREATER_THAN',
  GREATER_EQUAL = 'GREATER_EQUAL',

  // Operators - Logical
  AND = 'AND', // Blend65 uses 'and' keyword
  OR = 'OR', // Blend65 uses 'or' keyword
  NOT = 'NOT', // Blend65 uses 'not' keyword

  // Operators - Bitwise
  BITWISE_AND = 'BITWISE_AND',
  BITWISE_OR = 'BITWISE_OR',
  BITWISE_XOR = 'BITWISE_XOR',
  BITWISE_NOT = 'BITWISE_NOT',
  LEFT_SHIFT = 'LEFT_SHIFT',
  RIGHT_SHIFT = 'RIGHT_SHIFT',

  // Bitwise assignment operators
  BITWISE_AND_ASSIGN = 'BITWISE_AND_ASSIGN',
  BITWISE_OR_ASSIGN = 'BITWISE_OR_ASSIGN',
  BITWISE_XOR_ASSIGN = 'BITWISE_XOR_ASSIGN',
  LEFT_SHIFT_ASSIGN = 'LEFT_SHIFT_ASSIGN',
  RIGHT_SHIFT_ASSIGN = 'RIGHT_SHIFT_ASSIGN',

  // Punctuation
  LEFT_PAREN = 'LEFT_PAREN',
  RIGHT_PAREN = 'RIGHT_PAREN',
  LEFT_BRACKET = 'LEFT_BRACKET',
  RIGHT_BRACKET = 'RIGHT_BRACKET',
  LEFT_BRACE = 'LEFT_BRACE',
  RIGHT_BRACE = 'RIGHT_BRACE',

  COMMA = 'COMMA',
  SEMICOLON = 'SEMICOLON',
  COLON = 'COLON',
  DOT = 'DOT',

  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',

  // Comments
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',
}

/**
 * Source position information for tokens
 */
export interface SourcePosition {
  line: number;
  column: number;
  offset: number;
}

/**
 * Token with type, value, and source location
 */
export interface Token {
  type: TokenType;
  value: string;
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * Keywords in Blend65 language
 */
export const KEYWORDS = new Set([
  'module',
  'import',
  'export',
  'from',
  'function',
  'end',
  'return',
  'if',
  'then',
  'else',
  'while',
  'for',
  'to',
  'next',
  'match',
  'case',
  'break',
  'continue',
  'default',
  'var',
  'type',
  'extends',
  'enum',
  'zp',
  'ram',
  'data',
  'const',
  'byte',
  'word',
  'void',
  'callback', // NEW: Add callback keyword
  'and',
  'or',
  'not',
]);

/**
 * Storage class keywords
 */
export const STORAGE_CLASSES = new Set(['zp', 'ram', 'data', 'const']);

/**
 * Primitive type keywords
 */
export const PRIMITIVE_TYPES = new Set([
  'byte',
  'word',
  'void',
  'callback', // NEW: Add callback primitive type
]);

/**
 * Control flow keywords
 */
export const CONTROL_FLOW_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'while',
  'for',
  'to',
  'next',
  'match',
  'case',
  'break',
  'continue',
  'default',
  'end',
  'callback', // NEW: Add to control flow keywords
]);
