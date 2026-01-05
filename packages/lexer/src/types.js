/**
 * Token types for the Blend65 lexer
 * Blend65 is a multi-target 6502 language without OOP features
 */
export var TokenType;
(function (TokenType) {
    // Literals
    TokenType["NUMBER"] = "NUMBER";
    TokenType["STRING"] = "STRING";
    TokenType["BOOLEAN"] = "BOOLEAN";
    TokenType["IDENTIFIER"] = "IDENTIFIER";
    // Keywords - Core language constructs
    TokenType["MODULE"] = "MODULE";
    TokenType["IMPORT"] = "IMPORT";
    TokenType["EXPORT"] = "EXPORT";
    TokenType["FROM"] = "FROM";
    TokenType["TARGET"] = "TARGET";
    TokenType["FUNCTION"] = "FUNCTION";
    TokenType["END"] = "END";
    TokenType["RETURN"] = "RETURN";
    // Control flow keywords
    TokenType["IF"] = "IF";
    TokenType["THEN"] = "THEN";
    TokenType["ELSE"] = "ELSE";
    TokenType["WHILE"] = "WHILE";
    TokenType["FOR"] = "FOR";
    TokenType["TO"] = "TO";
    TokenType["NEXT"] = "NEXT";
    TokenType["MATCH"] = "MATCH";
    TokenType["CASE"] = "CASE";
    TokenType["BREAK"] = "BREAK";
    TokenType["CONTINUE"] = "CONTINUE";
    TokenType["DEFAULT"] = "DEFAULT";
    // Type and variable declarations
    TokenType["VAR"] = "VAR";
    TokenType["TYPE"] = "TYPE";
    TokenType["EXTENDS"] = "EXTENDS";
    TokenType["ENUM"] = "ENUM";
    // Storage class keywords
    TokenType["ZP"] = "ZP";
    TokenType["RAM"] = "RAM";
    TokenType["DATA"] = "DATA";
    TokenType["CONST"] = "CONST";
    TokenType["IO"] = "IO";
    // Primitive type keywords
    TokenType["BYTE"] = "BYTE";
    TokenType["WORD"] = "WORD";
    TokenType["VOID"] = "VOID";
    TokenType["CALLBACK"] = "CALLBACK";
    // Operators - Arithmetic
    TokenType["PLUS"] = "PLUS";
    TokenType["MINUS"] = "MINUS";
    TokenType["MULTIPLY"] = "MULTIPLY";
    TokenType["DIVIDE"] = "DIVIDE";
    TokenType["MODULO"] = "MODULO";
    // Operators - Assignment
    TokenType["ASSIGN"] = "ASSIGN";
    TokenType["PLUS_ASSIGN"] = "PLUS_ASSIGN";
    TokenType["MINUS_ASSIGN"] = "MINUS_ASSIGN";
    TokenType["MULTIPLY_ASSIGN"] = "MULTIPLY_ASSIGN";
    TokenType["DIVIDE_ASSIGN"] = "DIVIDE_ASSIGN";
    TokenType["MODULO_ASSIGN"] = "MODULO_ASSIGN";
    // Operators - Comparison
    TokenType["EQUAL"] = "EQUAL";
    TokenType["NOT_EQUAL"] = "NOT_EQUAL";
    TokenType["LESS_THAN"] = "LESS_THAN";
    TokenType["LESS_EQUAL"] = "LESS_EQUAL";
    TokenType["GREATER_THAN"] = "GREATER_THAN";
    TokenType["GREATER_EQUAL"] = "GREATER_EQUAL";
    // Operators - Logical
    TokenType["AND"] = "AND";
    TokenType["OR"] = "OR";
    TokenType["NOT"] = "NOT";
    // Operators - Bitwise
    TokenType["BITWISE_AND"] = "BITWISE_AND";
    TokenType["BITWISE_OR"] = "BITWISE_OR";
    TokenType["BITWISE_XOR"] = "BITWISE_XOR";
    TokenType["BITWISE_NOT"] = "BITWISE_NOT";
    TokenType["LEFT_SHIFT"] = "LEFT_SHIFT";
    TokenType["RIGHT_SHIFT"] = "RIGHT_SHIFT";
    // Bitwise assignment operators
    TokenType["BITWISE_AND_ASSIGN"] = "BITWISE_AND_ASSIGN";
    TokenType["BITWISE_OR_ASSIGN"] = "BITWISE_OR_ASSIGN";
    TokenType["BITWISE_XOR_ASSIGN"] = "BITWISE_XOR_ASSIGN";
    TokenType["LEFT_SHIFT_ASSIGN"] = "LEFT_SHIFT_ASSIGN";
    TokenType["RIGHT_SHIFT_ASSIGN"] = "RIGHT_SHIFT_ASSIGN";
    // Punctuation
    TokenType["LEFT_PAREN"] = "LEFT_PAREN";
    TokenType["RIGHT_PAREN"] = "RIGHT_PAREN";
    TokenType["LEFT_BRACKET"] = "LEFT_BRACKET";
    TokenType["RIGHT_BRACKET"] = "RIGHT_BRACKET";
    TokenType["LEFT_BRACE"] = "LEFT_BRACE";
    TokenType["RIGHT_BRACE"] = "RIGHT_BRACE";
    TokenType["COMMA"] = "COMMA";
    TokenType["SEMICOLON"] = "SEMICOLON";
    TokenType["COLON"] = "COLON";
    TokenType["DOT"] = "DOT";
    // Special
    TokenType["NEWLINE"] = "NEWLINE";
    TokenType["EOF"] = "EOF";
    // Comments
    TokenType["LINE_COMMENT"] = "LINE_COMMENT";
    TokenType["BLOCK_COMMENT"] = "BLOCK_COMMENT";
})(TokenType || (TokenType = {}));
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
    'io',
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
export const STORAGE_CLASSES = new Set(['zp', 'ram', 'data', 'const', 'io']);
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
//# sourceMappingURL=types.js.map