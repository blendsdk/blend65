/**
 * Parser Error Message Constants
 *
 * Centralized error messages for consistent, clear diagnostics.
 * All parser error messages should use these constants instead of inline strings.
 *
 * Benefits:
 * - Consistency: Same error in different contexts uses same wording
 * - Maintainability: Change message in one place
 * - Testability: Easy to verify error messages
 * - Localization: Future i18n support
 * - Documentation: Single source of truth for all error messages
 *
 * Organization:
 * - Base Parser: Token-level errors
 * - Expression Parser: Expression-related errors
 * - Statement Parser: Control flow and statement errors
 * - Declaration Parser: Variable, function, map declaration errors
 * - Module Parser: Module, import, export errors
 */

/**
 * Base Parser Error Messages
 *
 * Token-level parsing errors that can occur in any parser layer.
 */
export const BaseParserErrors = {
  /**
   * Expected a specific token but found something else
   *
   * @param expected - Description of what was expected
   * @param found - Description of what was found
   * @returns Formatted error message
   *
   * @example
   * BaseParserErrors.expectedToken("';'", "'}'")
   * // "Expected ';' but found '}'"
   */
  expectedToken: (expected: string, found?: string): string => {
    if (found) {
      return `Expected ${expected} but found ${found}`;
    }
    return `Expected ${expected}`;
  },

  /**
   * Unexpected token encountered
   *
   * @param token - Description of unexpected token
   * @param context - Optional context where token appeared
   * @returns Formatted error message
   */
  unexpectedToken: (token: string, context?: string): string => {
    if (context) {
      return `Unexpected token ${token} in ${context}`;
    }
    return `Unexpected token ${token}`;
  },

  /**
   * Unexpected end of file
   *
   * @param expected - What was expected before EOF
   * @returns Formatted error message
   */
  unexpectedEOF: (expected: string): string => {
    return `Unexpected end of file, expected ${expected}`;
  },
} as const;

/**
 * Expression Parser Error Messages
 *
 * Errors related to parsing expressions (literals, operators, function calls, etc.).
 */
export const ExpressionParserErrors = {
  /**
   * Invalid primary expression
   *
   * @param token - The token that couldn't be parsed as expression
   * @returns Formatted error message
   */
  invalidPrimaryExpression: (token: string): string => {
    return `Cannot parse '${token}' as an expression`;
  },

  /**
   * Missing operand in binary expression
   *
   * @param operator - The operator missing an operand
   * @param side - Which side is missing ('left' or 'right')
   * @returns Formatted error message
   */
  missingOperand: (operator: string, side: 'left' | 'right'): string => {
    return `Missing ${side} operand for operator '${operator}'`;
  },

  /**
   * Missing closing parenthesis in expression
   *
   * @returns Formatted error message
   */
  missingClosingParen: (): string => {
    return "Expected ')' to close grouped expression";
  },

  /**
   * Missing closing bracket in array access
   *
   * @returns Formatted error message
   */
  missingClosingBracket: (): string => {
    return "Expected ']' to close array index";
  },

  /**
   * Invalid assignment target
   *
   * @param target - Description of invalid target
   * @returns Formatted error message
   */
  invalidAssignmentTarget: (target: string): string => {
    return `Cannot assign to ${target}`;
  },
} as const;

/**
 * Statement Parser Error Messages
 *
 * Errors related to parsing statements (if, while, for, return, etc.).
 */
export const StatementParserErrors = {
  // ============================================
  // IF STATEMENT ERRORS
  // ============================================

  /**
   * Missing 'then' keyword after if condition
   */
  expectedThenAfterIfCondition: (): string => {
    return "Expected 'then' after if condition";
  },

  /**
   * Missing 'end' keyword to close if statement
   */
  expectedEndToCloseIf: (): string => {
    return "Expected 'end' to close if statement";
  },

  /**
   * Missing 'if' keyword after 'end'
   */
  expectedIfAfterEnd: (): string => {
    return "Expected 'if' after 'end'";
  },

  // ============================================
  // WHILE STATEMENT ERRORS
  // ============================================

  /**
   * Missing 'end' keyword to close while statement
   */
  expectedEndToCloseWhile: (): string => {
    return "Expected 'end' to close while statement";
  },

  /**
   * Missing 'while' keyword after 'end'
   */
  expectedWhileAfterEnd: (): string => {
    return "Expected 'while' after 'end'";
  },

  // ============================================
  // FOR STATEMENT ERRORS
  // ============================================

  /**
   * Missing '=' after for loop variable
   */
  expectedAssignAfterForVariable: (): string => {
    return "Expected '=' after for variable";
  },

  /**
   * Missing 'to' keyword after for start expression
   */
  expectedToAfterForStart: (): string => {
    return "Expected 'to' after for start expression";
  },

  /**
   * Missing 'next' keyword to close for loop
   */
  expectedNextToCloseFor: (): string => {
    return "Expected 'next' to close for loop";
  },

  /**
   * Variable name after 'next' doesn't match loop variable
   *
   * @param expected - The loop variable name
   * @param found - The name found after 'next'
   * @returns Formatted error message
   */
  forVariableMismatch: (expected: string, found: string): string => {
    return `Expected loop variable '${expected}' after 'next', but found '${found}'`;
  },

  // ============================================
  // MATCH STATEMENT ERRORS
  // ============================================

  /**
   * Missing ':' after case expression
   */
  expectedColonAfterCase: (): string => {
    return "Expected ':' after case expression";
  },

  /**
   * Missing ':' after 'default' keyword
   */
  expectedColonAfterDefault: (): string => {
    return "Expected ':' after 'default'";
  },

  /**
   * Missing 'end' keyword to close match statement
   */
  expectedEndToCloseMatch: (): string => {
    return "Expected 'end' to close match statement";
  },

  /**
   * Missing 'match' keyword after 'end'
   */
  expectedMatchAfterEnd: (): string => {
    return "Expected 'match' after 'end'";
  },

  // ============================================
  // BREAK/CONTINUE ERRORS
  // ============================================

  /**
   * Break statement outside of loop
   */
  breakOutsideLoop: (): string => {
    return "Cannot use 'break' outside of a loop (while, for)";
  },

  /**
   * Continue statement outside of loop
   */
  continueOutsideLoop: (): string => {
    return "Cannot use 'continue' outside of a loop (while, for)";
  },

  // ============================================
  // RETURN STATEMENT ERRORS
  // ============================================

  /**
   * Return statement outside of function
   */
  returnOutsideFunction: (): string => {
    return "Cannot use 'return' outside of a function";
  },

  /**
   * Void function returning a value
   *
   * @param functionName - Name of the function
   * @returns Formatted error message
   */
  voidFunctionReturningValue: (functionName: string): string => {
    return `Function '${functionName}' is declared as void but returns a value`;
  },

  /**
   * Non-void function returning without value
   *
   * @param functionName - Name of the function
   * @param returnType - Expected return type
   * @returns Formatted error message
   */
  nonVoidFunctionReturningVoid: (functionName: string, returnType: string): string => {
    return `Function '${functionName}' must return a value of type '${returnType}'`;
  },

  /**
   * Return type mismatch
   *
   * @param expected - Expected return type
   * @param actual - Actual return type
   * @returns Formatted error message
   */
  returnTypeMismatch: (expected: string, actual: string): string => {
    return `Expected return type '${expected}' but got '${actual}'`;
  },

  // ============================================
  // GENERAL STATEMENT ERRORS
  // ============================================

  /**
   * Invalid statement in current context
   *
   * @param statement - Description of statement
   * @param context - Where it appeared
   * @returns Formatted error message
   */
  invalidStatement: (statement: string, context: string): string => {
    return `Invalid statement '${statement}' in ${context}`;
  },
} as const;

/**
 * Declaration Parser Error Messages
 *
 * Errors related to parsing declarations (variables, functions, maps, etc.).
 */
export const DeclarationParserErrors = {
  // ============================================
  // VARIABLE DECLARATION ERRORS
  // ============================================

  /**
   * Expected 'let' or 'const' for variable declaration
   */
  expectedLetOrConst: (): string => {
    return "Expected 'let' or 'const'";
  },

  /**
   * Missing type annotation after colon
   */
  expectedTypeAfterColon: (): string => {
    return 'Expected type name after colon';
  },

  /**
   * Missing type annotation
   */
  expectedTypeAnnotation: (): string => {
    return 'Expected type annotation';
  },

  /**
   * Constant without initializer
   *
   * @param name - Name of the constant
   * @returns Formatted error message
   */
  constWithoutInitializer: (name: string): string => {
    return `Constant '${name}' must have an initializer`;
  },

  /**
   * Duplicate variable declaration
   *
   * @param name - Variable name
   * @param scope - Scope where duplicate occurred
   * @returns Formatted error message
   */
  duplicateVariable: (name: string, scope: string): string => {
    return `Variable '${name}' is already declared in ${scope} scope`;
  },

  // ============================================
  // FUNCTION DECLARATION ERRORS
  // ============================================

  /**
   * Missing function name
   */
  expectedFunctionName: (): string => {
    return 'Expected function name';
  },

  /**
   * Missing '(' after function name
   */
  expectedOpenParenAfterFunctionName: (): string => {
    return "Expected '(' after function name";
  },

  /**
   * Missing ')' after function parameters
   */
  expectedCloseParenAfterParameters: (): string => {
    return "Expected ')' after function parameters";
  },

  /**
   * Missing parameter name
   */
  expectedParameterName: (): string => {
    return 'Expected parameter name';
  },

  /**
   * Missing parameter type
   */
  expectedParameterType: (): string => {
    return 'Expected parameter type';
  },

  /**
   * Missing return type
   */
  expectedReturnType: (): string => {
    return 'Expected return type';
  },

  /**
   * Missing 'end' to close function
   */
  expectedEndToCloseFunction: (): string => {
    return "Expected 'end' to close function";
  },

  /**
   * Missing 'function' after 'end'
   */
  expectedFunctionAfterEnd: (): string => {
    return "Expected 'function' after 'end'";
  },

  /**
   * Duplicate function declaration
   *
   * @param name - Function name
   * @returns Formatted error message
   */
  duplicateFunction: (name: string): string => {
    return `Function '${name}' is already declared`;
  },

  // ============================================
  // MAP DECLARATION ERRORS
  // ============================================

  /**
   * Missing variable name after @map
   */
  expectedMapVariableName: (): string => {
    return 'Expected variable name after @map';
  },

  /**
   * Missing 'at' keyword in @map declaration
   */
  expectedAtKeywordInMap: (): string => {
    return "Expected 'at' keyword in @map declaration";
  },

  /**
   * Missing address in @map declaration
   */
  expectedAddressInMap: (): string => {
    return 'Expected memory address in @map declaration';
  },

  /**
   * Invalid address format
   *
   * @param address - The invalid address
   * @returns Formatted error message
   */
  invalidMapAddress: (address: string): string => {
    return `Invalid memory address '${address}' - must be numeric or hex literal`;
  },

  /**
   * Missing type in @map declaration
   */
  expectedTypeInMap: (): string => {
    return 'Expected type annotation in @map declaration';
  },

  // ============================================
  // TYPE ERRORS
  // ============================================

  /**
   * Expected type name
   */
  expectedTypeName: (): string => {
    return 'Expected type name';
  },

  /**
   * Invalid type name
   *
   * @param type - The invalid type
   * @returns Formatted error message
   */
  invalidType: (type: string): string => {
    return `Invalid type '${type}'`;
  },

  /**
   * Array type missing element type
   */
  expectedArrayElementType: (): string => {
    return 'Expected array element type after []';
  },

  /**
   * Missing array size
   */
  expectedArraySize: (): string => {
    return 'Expected array size in brackets';
  },
} as const;

/**
 * Module Parser Error Messages
 *
 * Errors related to parsing modules, imports, and exports.
 */
export const ModuleParserErrors = {
  // ============================================
  // MODULE DECLARATION ERRORS
  // ============================================

  /**
   * Missing module name
   */
  expectedModuleName: (): string => {
    return 'Expected module name';
  },

  /**
   * Duplicate module declaration
   *
   * @param name - Module name
   * @returns Formatted error message
   */
  duplicateModule: (name: string): string => {
    return `Module '${name}' is already declared in this file`;
  },

  /**
   * Module declaration after implicit global
   */
  moduleAfterImplicitGlobal: (): string => {
    return 'Cannot declare module after top-level declarations - module must be first';
  },

  // ============================================
  // IMPORT ERRORS
  // ============================================

  /**
   * Missing module path in import
   */
  expectedModulePath: (): string => {
    return "Expected module path after 'from'";
  },

  /**
   * Invalid import syntax
   *
   * @param details - Details about what's wrong
   * @returns Formatted error message
   */
  invalidImportSyntax: (details: string): string => {
    return `Invalid import syntax: ${details}`;
  },

  /**
   * Wildcard in module path (not supported)
   */
  wildcardInPath: (): string => {
    return 'Wildcard imports are not supported in Blend65';
  },

  /**
   * Missing import specifier
   */
  expectedImportSpecifier: (): string => {
    return 'Expected import specifier (symbol name)';
  },

  // ============================================
  // EXPORT ERRORS
  // ============================================

  /**
   * Export without declaration
   */
  exportRequiresDeclaration: (): string => {
    return 'Export keyword must be followed by a declaration';
  },

  /**
   * Invalid export syntax
   *
   * @param details - Details about what's wrong
   * @returns Formatted error message
   */
  invalidExportSyntax: (details: string): string => {
    return `Invalid export syntax: ${details}`;
  },

  /**
   * Re-export not supported
   */
  reexportNotSupported: (): string => {
    return 'Re-export syntax is not supported - import then export separately';
  },

  // ============================================
  // ORDERING ERRORS
  // ============================================

  /**
   * Declaration after executable code
   */
  declarationAfterCode: (): string => {
    return 'Declarations must appear before executable statements';
  },

  /**
   * Executable statement at module scope
   */
  executableAtModuleScope: (): string => {
    return 'Executable statements are not allowed at module scope - use functions';
  },

  /**
   * Invalid construct at module scope
   *
   * @param construct - What was found
   * @returns Formatted error message
   */
  invalidModuleScopeConstruct: (construct: string): string => {
    return `${construct} is not allowed at module scope`;
  },
} as const;

/**
 * All parser error messages grouped by category
 *
 * Use this for easier imports:
 * @example
 * import { ParserErrorMessages } from './error-messages.js';
 * const msg = ParserErrorMessages.Statement.expectedThenAfterIfCondition();
 */
export const ParserErrorMessages = {
  Base: BaseParserErrors,
  Expression: ExpressionParserErrors,
  Statement: StatementParserErrors,
  Declaration: DeclarationParserErrors,
  Module: ModuleParserErrors,
} as const;

/**
 * Type-safe error message generator
 *
 * Ensures all error messages follow consistent patterns and are type-checked.
 */
export type ErrorMessageGenerator = {
  readonly [K in keyof typeof ParserErrorMessages]: (typeof ParserErrorMessages)[K];
};
