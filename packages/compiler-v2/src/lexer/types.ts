/**
 * Token types for the Blend65 v2 lexer
 * Blend65 is a multi-target 6502 language without OOP features
 *
 * This enum defines all possible token types that can be produced by the lexer,
 * including literals, keywords, operators, and punctuation.
 *
 * NOTE: v2 removes @map syntax - memory-mapped I/O uses peek/poke intrinsics instead.
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
  RETURN = 'RETURN',

  // Control flow keywords
  IF = 'IF',
  ELSE = 'ELSE',
  WHILE = 'WHILE',
  FOR = 'FOR',
  TO = 'TO',
  DOWNTO = 'DOWNTO',
  STEP = 'STEP',
  DO = 'DO',
  SWITCH = 'SWITCH',
  CASE = 'CASE',
  BREAK = 'BREAK',
  CONTINUE = 'CONTINUE',
  DEFAULT = 'DEFAULT',

  // Type and variable declarations
  TYPE = 'TYPE',
  ENUM = 'ENUM',

  // Mutability modifiers
  LET = 'LET', // Mutable variable
  CONST = 'CONST', // Immutable constant

  // Storage class keywords (v2: no MAP - uses peek/poke intrinsics instead)
  ZP = 'ZP', // Zero page storage
  RAM = 'RAM', // RAM storage
  DATA = 'DATA', // Initialized data

  // Primitive type keywords
  BYTE = 'BYTE',
  WORD = 'WORD',
  VOID = 'VOID',
  CALLBACK = 'CALLBACK',
  ADDRESS = 'ADDRESS', // Address of a variable

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
  QUESTION = 'QUESTION', // For ternary operator ?:
  AT = 'AT', // @ sign (for storage classes, address-of)

  // Special
  NEWLINE = 'NEWLINE',
  EOF = 'EOF',

  // Comments
  LINE_COMMENT = 'LINE_COMMENT',
  BLOCK_COMMENT = 'BLOCK_COMMENT',
}

/**
 * Source position information for tokens
 * Tracks the exact location of tokens in the source code for error reporting
 */
export interface SourcePosition {
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column: number;
  /** Absolute character offset from the start of the source */
  offset: number;
}

/**
 * Token with type, value, and source location
 * Represents a single lexical token produced by the lexer
 */
export interface Token {
  /** The type of token (keyword, operator, literal, etc.) */
  type: TokenType;
  /** The actual string value from the source code */
  value: string;
  /** Starting position of the token in the source */
  start: SourcePosition;
  /** Ending position of the token in the source */
  end: SourcePosition;
}

/**
 * Module and import/export keywords
 * Used for module system declarations and dependency management
 */
export const eModuleKeyword = {
  MODULE: 'module',
  IMPORT: 'import',
  EXPORT: 'export',
  FROM: 'from',
};

/**
 * Function keywords
 * Used for function declarations and return statements
 */
export const eFunctionKeyword = {
  FUNCTION: 'function',
  RETURN: 'return',
};

/**
 * Declaration keywords
 * Used for type aliases and enum declarations
 */
export const eDeclarationKeyword = {
  TYPE: 'type',
  ENUM: 'enum',
};

/**
 * Mutability modifiers
 * Define whether a variable can be reassigned after initialization
 */
export const eMutabilityModifier = {
  LET: 'let',
  CONST: 'const',
};

/**
 * Control flow keywords
 * Used for conditional statements, loops, and switch statements
 * C-style syntax with curly braces
 */
export const eControlFlowKeyword = {
  IF: 'if',
  ELSE: 'else',
  WHILE: 'while',
  FOR: 'for',
  TO: 'to',
  DOWNTO: 'downto',
  STEP: 'step',
  DO: 'do',
  SWITCH: 'switch',
  CASE: 'case',
  BREAK: 'break',
  CONTINUE: 'continue',
  DEFAULT: 'default',
};

/**
 * Storage class enumeration (memory location specifiers)
 * Defines where variables are stored in 6502 memory architecture
 * - ZP: Zero page (fast access, limited space)
 * - RAM: Regular RAM storage
 * - DATA: Initialized data section
 *
 * NOTE: v2 removes MAP - memory-mapped I/O now uses peek/poke intrinsics
 */
export const eStorageClass = {
  ZP: '@zp',
  RAM: '@ram',
  DATA: '@data',
};

/**
 * Primitive type keywords
 * Built-in data types supported by Blend65
 */
export const ePrimitiveType = {
  BYTE: 'byte',
  WORD: 'word',
  VOID: 'void',
  CALLBACK: 'callback',
  BOOLEAN: 'boolean',
  STRING: 'string',
  ADDRESS: '@address',
};

/**
 * All keywords in Blend65 v2 language
 * Built from categorized keyword objects to avoid duplicates and ensure consistency.
 * This set is used by the lexer to distinguish keywords from identifiers.
 *
 * NOTE: v2 removes @map-related keywords (at, layout)
 */
export const KEYWORDS = new Set([
  ...Object.values(eModuleKeyword),
  ...Object.values(eFunctionKeyword),
  ...Object.values(eDeclarationKeyword),
  ...Object.values(eMutabilityModifier),
  ...Object.values(eControlFlowKeyword),
  ...Object.values(eStorageClass),
  ...Object.values(ePrimitiveType),
]);