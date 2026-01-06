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
  STRING_LITERAL = 'STRING_LITERAL',
  BOOLEAN_LITERAL = 'BOOLEAN_LITERAL',

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
  // TODO: implement later EXTENDS = 'EXTENDS',
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
  CALLBACK = 'CALLBACK',

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
  AND = 'AND',
  OR = 'OR',
  NOT = 'NOT',

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
  'enum',
  'zp',
  'ram',
  'data',
  'const',
  'byte',
  'word',
  'void',
  'callback',
  'boolean',
  'string',
]);

/**
 * Storage class enumeration
 */
export const eStorageClass = {
  ZP: 'zp',
  RAM: 'ram',
  DATA: 'data',
  CONST: 'const',
};

/**
 * Storage class keywords
 */
export const STORAGE_CLASSES = new Set(Object.values(eStorageClass));

export const ePrimitiveType = {
  BYTE: 'byte',
  WORD: 'word',
  VOID: 'void',
  CALLBACK: 'callback',
  BOOLEAN: 'boolean',
  STRING: 'string',
};

/**
 * Primitive type keywords
 */
export const PRIMITIVE_TYPES = new Set(Object.values(ePrimitiveType));

export const eControlFlowKeyword = {
  IF: 'if',
  THEN: 'then',
  ELSE: 'else',
  WHILE: 'while',
  FOR: 'for',
  TO: 'to',
  NEXT: 'next',
  MATCH: 'match',
  CASE: 'case',
  BREAK: 'break',
  CONTINUE: 'continue',
  DEFAULT: 'default',
  END: 'end',
  CALLBACK: 'callback',
};

/**
 * Control flow keywords
 */
export const CONTROL_FLOW_KEYWORDS = new Set(Object.values(eControlFlowKeyword));
