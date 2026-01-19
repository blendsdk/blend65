/**
 * Token types for the Blend65 lexer
 * Blend65 is a multi-target 6502 language without OOP features
 *
 * This enum defines all possible token types that can be produced by the lexer,
 * including literals, keywords, operators, and punctuation.
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
  ELSEIF = 'ELSEIF',
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
  TYPE = 'TYPE',
  ENUM = 'ENUM',

  // Mutability modifiers
  LET = 'LET', // Mutable variable
  CONST = 'CONST', // Immutable constant

  // Storage class keywords
  ZP = 'ZP', // Zero page storage
  RAM = 'RAM', // RAM storage
  DATA = 'DATA', // Initialized data
  MAP = 'MAP', // Memory-mapped I/O

  // Memory mapping keywords
  AT = 'AT', // Address specifier for @map
  LAYOUT = 'LAYOUT', // Explicit layout keyword for @map structs

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
 * Used for conditional statements, loops, and pattern matching
 */
export const eControlFlowKeyword = {
  IF: 'if',
  THEN: 'then',
  ELSE: 'else',
  ELSEIF: 'elseif',
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
};

/**
 * Storage class enumeration (memory location specifiers)
 * Defines where variables are stored in 6502 memory architecture
 * - ZP: Zero page (fast access, limited space)
 * - RAM: Regular RAM storage
 * - DATA: Initialized data section
 * - MAP: Memory-mapped I/O (hardware registers at fixed addresses)
 */
export const eStorageClass = {
  ZP: '@zp',
  RAM: '@ram',
  DATA: '@data',
  MAP: '@map',
};

/**
 * Memory mapping keywords
 * Used for @map declarations to specify address locations
 */
export const eMemoryMappingKeyword = {
  AT: 'at',
  LAYOUT: 'layout',
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
 * All keywords in Blend65 language
 * Built from categorized keyword objects to avoid duplicates and ensure consistency.
 * This set is used by the lexer to distinguish keywords from identifiers.
 */
export const KEYWORDS = new Set([
  ...Object.values(eModuleKeyword),
  ...Object.values(eFunctionKeyword),
  ...Object.values(eDeclarationKeyword),
  ...Object.values(eMutabilityModifier),
  ...Object.values(eControlFlowKeyword),
  ...Object.values(eStorageClass),
  ...Object.values(eMemoryMappingKeyword),
  ...Object.values(ePrimitiveType),
]);