/**
 * Error Message Tests
 *
 * Validates all error message constants for:
 * - Correct parameter handling
 * - Grammatical correctness
 * - Message consistency
 * - Complete coverage of all error scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  BaseParserErrors,
  ExpressionParserErrors,
  StatementParserErrors,
  DeclarationParserErrors,
  ModuleParserErrors,
  ParserErrorMessages,
} from '../../parser/error-messages.js';

describe('BaseParserErrors', () => {
  describe('expectedToken', () => {
    it('should format message with expected token only', () => {
      const msg = BaseParserErrors.expectedToken("';'");
      expect(msg).toBe("Expected ';'");
    });

    it('should format message with expected and found tokens', () => {
      const msg = BaseParserErrors.expectedToken("';'", "'}'");
      expect(msg).toBe("Expected ';' but found '}'");
    });

    it('should handle complex token descriptions', () => {
      const msg = BaseParserErrors.expectedToken('identifier', 'number literal');
      expect(msg).toBe('Expected identifier but found number literal');
    });
  });

  describe('unexpectedToken', () => {
    it('should format message without context', () => {
      const msg = BaseParserErrors.unexpectedToken("'@'");
      expect(msg).toBe("Unexpected token '@'");
    });

    it('should format message with context', () => {
      const msg = BaseParserErrors.unexpectedToken("'@'", 'expression');
      expect(msg).toBe("Unexpected token '@' in expression");
    });
  });

  describe('unexpectedEOF', () => {
    it('should format EOF message', () => {
      const msg = BaseParserErrors.unexpectedEOF('closing brace');
      expect(msg).toBe('Unexpected end of file, expected closing brace');
    });
  });
});

describe('ExpressionParserErrors', () => {
  describe('invalidPrimaryExpression', () => {
    it('should format invalid expression message', () => {
      const msg = ExpressionParserErrors.invalidPrimaryExpression('@');
      expect(msg).toBe("Cannot parse '@' as an expression");
    });
  });

  describe('missingOperand', () => {
    it('should format left operand missing', () => {
      const msg = ExpressionParserErrors.missingOperand('+', 'left');
      expect(msg).toBe("Missing left operand for operator '+'");
    });

    it('should format right operand missing', () => {
      const msg = ExpressionParserErrors.missingOperand('*', 'right');
      expect(msg).toBe("Missing right operand for operator '*'");
    });
  });

  describe('missingClosingParen', () => {
    it('should format closing paren message', () => {
      const msg = ExpressionParserErrors.missingClosingParen();
      expect(msg).toBe("Expected ')' to close grouped expression");
    });
  });

  describe('missingClosingBracket', () => {
    it('should format closing bracket message', () => {
      const msg = ExpressionParserErrors.missingClosingBracket();
      expect(msg).toBe("Expected ']' to close array index");
    });
  });

  describe('invalidAssignmentTarget', () => {
    it('should format invalid target message', () => {
      const msg = ExpressionParserErrors.invalidAssignmentTarget('literal');
      expect(msg).toBe('Cannot assign to literal');
    });
  });
});

describe('StatementParserErrors', () => {
  describe('if statement errors', () => {
    it('should have correct then message', () => {
      const msg = StatementParserErrors.expectedThenAfterIfCondition();
      expect(msg).toBe("Expected 'then' after if condition");
    });

    it('should have correct end if message', () => {
      const msg = StatementParserErrors.expectedEndToCloseIf();
      expect(msg).toBe("Expected 'end' to close if statement");
    });

    it('should have correct if after end message', () => {
      const msg = StatementParserErrors.expectedIfAfterEnd();
      expect(msg).toBe("Expected 'if' after 'end'");
    });
  });

  describe('while statement errors', () => {
    it('should have correct end while message', () => {
      const msg = StatementParserErrors.expectedEndToCloseWhile();
      expect(msg).toBe("Expected 'end' to close while statement");
    });

    it('should have correct while after end message', () => {
      const msg = StatementParserErrors.expectedWhileAfterEnd();
      expect(msg).toBe("Expected 'while' after 'end'");
    });
  });

  describe('for statement errors', () => {
    it('should have correct assign message', () => {
      const msg = StatementParserErrors.expectedAssignAfterForVariable();
      expect(msg).toBe("Expected '=' after for variable");
    });

    it('should have correct to message', () => {
      const msg = StatementParserErrors.expectedToAfterForStart();
      expect(msg).toBe("Expected 'to' after for start expression");
    });

    it('should have correct next message', () => {
      const msg = StatementParserErrors.expectedNextToCloseFor();
      expect(msg).toBe("Expected 'next' to close for loop");
    });

    it('should format variable mismatch message', () => {
      const msg = StatementParserErrors.forVariableMismatch('i', 'j');
      expect(msg).toBe("Expected loop variable 'i' after 'next', but found 'j'");
    });
  });

  describe('match statement errors', () => {
    it('should have correct case colon message', () => {
      const msg = StatementParserErrors.expectedColonAfterCase();
      expect(msg).toBe("Expected ':' after case expression");
    });

    it('should have correct default colon message', () => {
      const msg = StatementParserErrors.expectedColonAfterDefault();
      expect(msg).toBe("Expected ':' after 'default'");
    });

    it('should have correct end match message', () => {
      const msg = StatementParserErrors.expectedEndToCloseMatch();
      expect(msg).toBe("Expected 'end' to close match statement");
    });

    it('should have correct match after end message', () => {
      const msg = StatementParserErrors.expectedMatchAfterEnd();
      expect(msg).toBe("Expected 'match' after 'end'");
    });
  });

  describe('break/continue errors', () => {
    it('should have correct break outside loop message', () => {
      const msg = StatementParserErrors.breakOutsideLoop();
      expect(msg).toBe("Cannot use 'break' outside of a loop (while, for)");
    });

    it('should have correct continue outside loop message', () => {
      const msg = StatementParserErrors.continueOutsideLoop();
      expect(msg).toBe("Cannot use 'continue' outside of a loop (while, for)");
    });
  });

  describe('return statement errors', () => {
    it('should have correct return outside function message', () => {
      const msg = StatementParserErrors.returnOutsideFunction();
      expect(msg).toBe("Cannot use 'return' outside of a function");
    });

    it('should format void function returning value', () => {
      const msg = StatementParserErrors.voidFunctionReturningValue('test');
      expect(msg).toBe("Function 'test' is declared as void but returns a value");
    });

    it('should format non-void function returning void', () => {
      const msg = StatementParserErrors.nonVoidFunctionReturningVoid('test', 'u8');
      expect(msg).toBe("Function 'test' must return a value of type 'u8'");
    });

    it('should format return type mismatch', () => {
      const msg = StatementParserErrors.returnTypeMismatch('u8', 'u16');
      expect(msg).toBe("Expected return type 'u8' but got 'u16'");
    });
  });

  describe('general statement errors', () => {
    it('should format invalid statement message', () => {
      const msg = StatementParserErrors.invalidStatement('break', 'function body');
      expect(msg).toBe("Invalid statement 'break' in function body");
    });
  });
});

describe('DeclarationParserErrors', () => {
  describe('variable declaration errors', () => {
    it('should have correct let/const message', () => {
      const msg = DeclarationParserErrors.expectedLetOrConst();
      expect(msg).toBe("Expected 'let' or 'const'");
    });

    it('should have correct type after colon message', () => {
      const msg = DeclarationParserErrors.expectedTypeAfterColon();
      expect(msg).toBe('Expected type name after colon');
    });

    it('should have correct type annotation message', () => {
      const msg = DeclarationParserErrors.expectedTypeAnnotation();
      expect(msg).toBe('Expected type annotation');
    });

    it('should format const without initializer', () => {
      const msg = DeclarationParserErrors.constWithoutInitializer('PI');
      expect(msg).toBe("Constant 'PI' must have an initializer");
    });

    it('should format duplicate variable', () => {
      const msg = DeclarationParserErrors.duplicateVariable('x', 'local');
      expect(msg).toBe("Variable 'x' is already declared in local scope");
    });
  });

  describe('function declaration errors', () => {
    it('should have correct function name message', () => {
      const msg = DeclarationParserErrors.expectedFunctionName();
      expect(msg).toBe('Expected function name');
    });

    it('should have correct open paren message', () => {
      const msg = DeclarationParserErrors.expectedOpenParenAfterFunctionName();
      expect(msg).toBe("Expected '(' after function name");
    });

    it('should have correct close paren message', () => {
      const msg = DeclarationParserErrors.expectedCloseParenAfterParameters();
      expect(msg).toBe("Expected ')' after function parameters");
    });

    it('should have correct parameter name message', () => {
      const msg = DeclarationParserErrors.expectedParameterName();
      expect(msg).toBe('Expected parameter name');
    });

    it('should have correct parameter type message', () => {
      const msg = DeclarationParserErrors.expectedParameterType();
      expect(msg).toBe('Expected parameter type');
    });

    it('should have correct return type message', () => {
      const msg = DeclarationParserErrors.expectedReturnType();
      expect(msg).toBe('Expected return type');
    });

    it('should have correct end function message', () => {
      const msg = DeclarationParserErrors.expectedEndToCloseFunction();
      expect(msg).toBe("Expected 'end' to close function");
    });

    it('should have correct function after end message', () => {
      const msg = DeclarationParserErrors.expectedFunctionAfterEnd();
      expect(msg).toBe("Expected 'function' after 'end'");
    });

    it('should format duplicate function', () => {
      const msg = DeclarationParserErrors.duplicateFunction('test');
      expect(msg).toBe("Function 'test' is already declared");
    });
  });

  describe('map declaration errors', () => {
    it('should have correct map variable name message', () => {
      const msg = DeclarationParserErrors.expectedMapVariableName();
      expect(msg).toBe('Expected variable name after @map');
    });

    it('should have correct at keyword message', () => {
      const msg = DeclarationParserErrors.expectedAtKeywordInMap();
      expect(msg).toBe("Expected 'at' keyword in @map declaration");
    });

    it('should have correct address message', () => {
      const msg = DeclarationParserErrors.expectedAddressInMap();
      expect(msg).toBe('Expected memory address in @map declaration');
    });

    it('should format invalid address', () => {
      const msg = DeclarationParserErrors.invalidMapAddress('xyz');
      expect(msg).toBe("Invalid memory address 'xyz' - must be numeric or hex literal");
    });

    it('should have correct type in map message', () => {
      const msg = DeclarationParserErrors.expectedTypeInMap();
      expect(msg).toBe('Expected type annotation in @map declaration');
    });
  });

  describe('type errors', () => {
    it('should have correct type name message', () => {
      const msg = DeclarationParserErrors.expectedTypeName();
      expect(msg).toBe('Expected type name');
    });

    it('should format invalid type', () => {
      const msg = DeclarationParserErrors.invalidType('xyz');
      expect(msg).toBe("Invalid type 'xyz'");
    });

    it('should have correct array element type message', () => {
      const msg = DeclarationParserErrors.expectedArrayElementType();
      expect(msg).toBe('Expected array element type after []');
    });

    it('should have correct array size message', () => {
      const msg = DeclarationParserErrors.expectedArraySize();
      expect(msg).toBe('Expected array size in brackets');
    });
  });
});

describe('ModuleParserErrors', () => {
  describe('module declaration errors', () => {
    it('should have correct module name message', () => {
      const msg = ModuleParserErrors.expectedModuleName();
      expect(msg).toBe('Expected module name');
    });

    it('should format duplicate module', () => {
      const msg = ModuleParserErrors.duplicateModule('test');
      expect(msg).toBe("Module 'test' is already declared in this file");
    });

    it('should have correct module after implicit message', () => {
      const msg = ModuleParserErrors.moduleAfterImplicitGlobal();
      expect(msg).toBe('Cannot declare module after top-level declarations - module must be first');
    });
  });

  describe('import errors', () => {
    it('should have correct module path message', () => {
      const msg = ModuleParserErrors.expectedModulePath();
      expect(msg).toBe("Expected module path after 'from'");
    });

    it('should format invalid import syntax', () => {
      const msg = ModuleParserErrors.invalidImportSyntax('missing from keyword');
      expect(msg).toBe('Invalid import syntax: missing from keyword');
    });

    it('should have correct wildcard message', () => {
      const msg = ModuleParserErrors.wildcardInPath();
      expect(msg).toBe('Wildcard imports are not supported in Blend65');
    });

    it('should have correct import specifier message', () => {
      const msg = ModuleParserErrors.expectedImportSpecifier();
      expect(msg).toBe('Expected import specifier (symbol name)');
    });
  });

  describe('export errors', () => {
    it('should have correct export requires declaration message', () => {
      const msg = ModuleParserErrors.exportRequiresDeclaration();
      expect(msg).toBe('Export keyword must be followed by a declaration');
    });

    it('should format invalid export syntax', () => {
      const msg = ModuleParserErrors.invalidExportSyntax('missing declaration');
      expect(msg).toBe('Invalid export syntax: missing declaration');
    });

    it('should have correct reexport message', () => {
      const msg = ModuleParserErrors.reexportNotSupported();
      expect(msg).toBe('Re-export syntax is not supported - import then export separately');
    });
  });

  describe('ordering errors', () => {
    it('should have correct declaration after code message', () => {
      const msg = ModuleParserErrors.declarationAfterCode();
      expect(msg).toBe('Declarations must appear before executable statements');
    });

    it('should have correct executable at module scope message', () => {
      const msg = ModuleParserErrors.executableAtModuleScope();
      expect(msg).toBe('Executable statements are not allowed at module scope - use functions');
    });

    it('should format invalid module scope construct', () => {
      const msg = ModuleParserErrors.invalidModuleScopeConstruct('return statement');
      expect(msg).toBe('return statement is not allowed at module scope');
    });
  });
});

describe('ParserErrorMessages', () => {
  it('should export all error message categories', () => {
    expect(ParserErrorMessages.Base).toBe(BaseParserErrors);
    expect(ParserErrorMessages.Expression).toBe(ExpressionParserErrors);
    expect(ParserErrorMessages.Statement).toBe(StatementParserErrors);
    expect(ParserErrorMessages.Declaration).toBe(DeclarationParserErrors);
    expect(ParserErrorMessages.Module).toBe(ModuleParserErrors);
  });

  it('should allow consistent access pattern', () => {
    const msg = ParserErrorMessages.Statement.expectedThenAfterIfCondition();
    expect(msg).toBe("Expected 'then' after if condition");
  });
});

describe('Message Consistency', () => {
  it('should use consistent "Expected X" pattern for missing tokens', () => {
    const messages = [
      StatementParserErrors.expectedThenAfterIfCondition(),
      StatementParserErrors.expectedEndToCloseIf(),
      DeclarationParserErrors.expectedLetOrConst(),
      DeclarationParserErrors.expectedTypeAfterColon(),
      ModuleParserErrors.expectedModuleName(),
    ];

    messages.forEach(msg => {
      expect(msg).toMatch(/^Expected/);
    });
  });

  it('should use consistent "Cannot use X outside Y" pattern for scope errors', () => {
    const messages = [
      StatementParserErrors.breakOutsideLoop(),
      StatementParserErrors.continueOutsideLoop(),
      StatementParserErrors.returnOutsideFunction(),
    ];

    messages.forEach(msg => {
      expect(msg).toMatch(/^Cannot use/);
    });
  });

  it('should use consistent closing syntax messages', () => {
    const closingMessages = [
      StatementParserErrors.expectedEndToCloseIf(),
      StatementParserErrors.expectedEndToCloseWhile(),
      StatementParserErrors.expectedEndToCloseMatch(),
      DeclarationParserErrors.expectedEndToCloseFunction(),
    ];

    closingMessages.forEach(msg => {
      expect(msg).toMatch(/Expected 'end' to close/);
    });
  });

  it('should use consistent "X after Y" pattern', () => {
    const afterMessages = [
      StatementParserErrors.expectedIfAfterEnd(),
      StatementParserErrors.expectedWhileAfterEnd(),
      StatementParserErrors.expectedMatchAfterEnd(),
      DeclarationParserErrors.expectedFunctionAfterEnd(),
    ];

    afterMessages.forEach(msg => {
      expect(msg).toMatch(/Expected '\w+' after 'end'/);
    });
  });
});

describe('Message Quality', () => {
  it('should have no messages ending with periods', () => {
    // Error messages shouldn't end with periods per common style guides
    const allMessages = [
      BaseParserErrors.expectedToken("';'"),
      BaseParserErrors.unexpectedToken('@'),
      BaseParserErrors.unexpectedEOF('token'),
      ExpressionParserErrors.invalidPrimaryExpression('@'),
      ExpressionParserErrors.missingOperand('+', 'left'),
      ExpressionParserErrors.missingClosingParen(),
      ExpressionParserErrors.missingClosingBracket(),
      ExpressionParserErrors.invalidAssignmentTarget('literal'),
      StatementParserErrors.expectedThenAfterIfCondition(),
      StatementParserErrors.breakOutsideLoop(),
      StatementParserErrors.returnOutsideFunction(),
      DeclarationParserErrors.expectedLetOrConst(),
      DeclarationParserErrors.constWithoutInitializer('x'),
      ModuleParserErrors.expectedModuleName(),
      ModuleParserErrors.wildcardInPath(),
    ];

    allMessages.forEach(msg => {
      expect(msg).not.toMatch(/\.$/);
    });
  });

  it('should have clear, actionable messages', () => {
    // Messages should tell user what to do or what went wrong
    const msg1 = StatementParserErrors.expectedThenAfterIfCondition();
    expect(msg1).toContain('Expected');
    expect(msg1).toContain('then');
    expect(msg1).toContain('if condition');

    const msg2 = StatementParserErrors.breakOutsideLoop();
    expect(msg2).toContain('Cannot use');
    expect(msg2).toContain('break');
    expect(msg2).toContain('loop');
  });

  it('should properly quote language keywords', () => {
    const messages = [
      StatementParserErrors.expectedThenAfterIfCondition(),
      StatementParserErrors.expectedIfAfterEnd(),
      DeclarationParserErrors.expectedLetOrConst(),
    ];

    messages.forEach(msg => {
      // Keywords should be in single quotes
      expect(msg).toMatch(/'[a-z]+'/);
    });
  });
});
