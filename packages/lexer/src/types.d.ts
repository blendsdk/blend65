/**
 * Token types for the Blend65 lexer
 * Blend65 is a multi-target 6502 language without OOP features
 */
export declare enum TokenType {
    NUMBER = "NUMBER",
    STRING = "STRING",
    BOOLEAN = "BOOLEAN",
    IDENTIFIER = "IDENTIFIER",
    MODULE = "MODULE",
    IMPORT = "IMPORT",
    EXPORT = "EXPORT",
    FROM = "FROM",
    TARGET = "TARGET",
    FUNCTION = "FUNCTION",
    END = "END",
    RETURN = "RETURN",
    IF = "IF",
    THEN = "THEN",
    ELSE = "ELSE",
    WHILE = "WHILE",
    FOR = "FOR",
    TO = "TO",
    NEXT = "NEXT",
    MATCH = "MATCH",
    CASE = "CASE",
    BREAK = "BREAK",
    CONTINUE = "CONTINUE",
    DEFAULT = "DEFAULT",
    VAR = "VAR",
    TYPE = "TYPE",
    EXTENDS = "EXTENDS",
    ENUM = "ENUM",
    ZP = "ZP",// Zero page storage
    RAM = "RAM",// RAM storage
    DATA = "DATA",// Initialized data
    CONST = "CONST",// Constant/ROM data
    IO = "IO",// Memory-mapped I/O
    BYTE = "BYTE",
    WORD = "WORD",
    VOID = "VOID",
    CALLBACK = "CALLBACK",// NEW: Callback keyword token
    PLUS = "PLUS",
    MINUS = "MINUS",
    MULTIPLY = "MULTIPLY",
    DIVIDE = "DIVIDE",
    MODULO = "MODULO",
    ASSIGN = "ASSIGN",
    PLUS_ASSIGN = "PLUS_ASSIGN",
    MINUS_ASSIGN = "MINUS_ASSIGN",
    MULTIPLY_ASSIGN = "MULTIPLY_ASSIGN",
    DIVIDE_ASSIGN = "DIVIDE_ASSIGN",
    MODULO_ASSIGN = "MODULO_ASSIGN",
    EQUAL = "EQUAL",
    NOT_EQUAL = "NOT_EQUAL",
    LESS_THAN = "LESS_THAN",
    LESS_EQUAL = "LESS_EQUAL",
    GREATER_THAN = "GREATER_THAN",
    GREATER_EQUAL = "GREATER_EQUAL",
    AND = "AND",// Blend65 uses 'and' keyword
    OR = "OR",// Blend65 uses 'or' keyword
    NOT = "NOT",// Blend65 uses 'not' keyword
    BITWISE_AND = "BITWISE_AND",
    BITWISE_OR = "BITWISE_OR",
    BITWISE_XOR = "BITWISE_XOR",
    BITWISE_NOT = "BITWISE_NOT",
    LEFT_SHIFT = "LEFT_SHIFT",
    RIGHT_SHIFT = "RIGHT_SHIFT",
    BITWISE_AND_ASSIGN = "BITWISE_AND_ASSIGN",
    BITWISE_OR_ASSIGN = "BITWISE_OR_ASSIGN",
    BITWISE_XOR_ASSIGN = "BITWISE_XOR_ASSIGN",
    LEFT_SHIFT_ASSIGN = "LEFT_SHIFT_ASSIGN",
    RIGHT_SHIFT_ASSIGN = "RIGHT_SHIFT_ASSIGN",
    LEFT_PAREN = "LEFT_PAREN",
    RIGHT_PAREN = "RIGHT_PAREN",
    LEFT_BRACKET = "LEFT_BRACKET",
    RIGHT_BRACKET = "RIGHT_BRACKET",
    LEFT_BRACE = "LEFT_BRACE",
    RIGHT_BRACE = "RIGHT_BRACE",
    COMMA = "COMMA",
    SEMICOLON = "SEMICOLON",
    COLON = "COLON",
    DOT = "DOT",
    NEWLINE = "NEWLINE",
    EOF = "EOF",
    LINE_COMMENT = "LINE_COMMENT",
    BLOCK_COMMENT = "BLOCK_COMMENT"
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
export declare const KEYWORDS: Set<string>;
/**
 * Storage class keywords
 */
export declare const STORAGE_CLASSES: Set<string>;
/**
 * Primitive type keywords
 */
export declare const PRIMITIVE_TYPES: Set<string>;
/**
 * Control flow keywords
 */
export declare const CONTROL_FLOW_KEYWORDS: Set<string>;
//# sourceMappingURL=types.d.ts.map