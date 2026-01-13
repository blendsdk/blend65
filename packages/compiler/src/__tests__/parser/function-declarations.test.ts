/**
 * Function Declaration Parser Tests
 *
 * Tests for Phase 4 function declaration parsing implementation.
 * Covers all function declaration syntax from the language specification.
 */

import { describe, test, expect } from 'vitest';
import { Lexer } from '../../lexer/index.js';
import { Parser } from '../../parser/index.js';
import { FunctionDecl, Program, DiagnosticSeverity } from '../../ast/index.js';

/**
 * Helper function to parse complete Blend65 source code
 */
function parseBlendProgram(source: string) {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  return {
    ast,
    parser,
    diagnostics: parser.getDiagnostics(),
    errors: parser.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.ERROR),
    warnings: parser.getDiagnostics().filter(d => d.severity === DiagnosticSeverity.WARNING),
  };
}

describe('Function Declaration Parser', () => {
  describe('Basic Function Declarations', () => {
    test('parses simple function with no parameters', () => {
      const source = `
        function init(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(1);

      const functionDecl = declarations[0] as FunctionDecl;
      expect(functionDecl.getName()).toBe('init');
      expect(functionDecl.getParameters()).toHaveLength(0);
      expect(functionDecl.getReturnType()).toBe('void');
      expect(functionDecl.isExportedFunction()).toBe(false);
      expect(functionDecl.isCallbackFunction()).toBe(false);
      expect(functionDecl.getBody()).toHaveLength(0);
    });

    test('parses function with parameters', () => {
      const source = `
        function add(a: byte, b: byte): byte
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getName()).toBe('add');

      const parameters = functionDecl.getParameters();
      expect(parameters).toHaveLength(2);
      expect(parameters[0].name).toBe('a');
      expect(parameters[0].typeAnnotation).toBe('byte');
      expect(parameters[1].name).toBe('b');
      expect(parameters[1].typeAnnotation).toBe('byte');

      expect(functionDecl.getReturnType()).toBe('byte');
    });

    test('parses function with multiple parameter types', () => {
      const source = `
        function complexCalc(count: byte, offset: word, flag: boolean): word
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      const parameters = functionDecl.getParameters();
      expect(parameters).toHaveLength(3);
      expect(parameters[0].typeAnnotation).toBe('byte');
      expect(parameters[1].typeAnnotation).toBe('word');
      expect(parameters[2].typeAnnotation).toBe('boolean');
      expect(functionDecl.getReturnType()).toBe('word');
    });

    test('parses function without return type', () => {
      const source = `
        function doSomething()
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getReturnType()).toBe(null);
    });
  });

  describe('Export Modifier', () => {
    test('parses exported function', () => {
      const source = `
        export function clearScreen(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getName()).toBe('clearScreen');
      expect(functionDecl.isExportedFunction()).toBe(true);
    });

    test('handles main function auto-export with warning', () => {
      const source = `
        function main(): void
        end function
      `;

      const { ast, warnings, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toContain('Main function should be explicitly exported');

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getName()).toBe('main');
      expect(functionDecl.isExportedFunction()).toBe(true); // Auto-exported
    });

    test('explicitly exported main function should not warn', () => {
      const source = `
        export function main(): void
        end function
      `;

      const { warnings } = parseBlendProgram(source);

      expect(warnings).toHaveLength(0); // No warning for explicit export
    });
  });

  describe('Callback Functions', () => {
    test('parses callback function', () => {
      const source = `
        callback function rasterIRQ(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getName()).toBe('rasterIRQ');
      expect(functionDecl.isCallbackFunction()).toBe(true);
      expect(functionDecl.isExportedFunction()).toBe(false);
    });

    test('parses exported callback function', () => {
      const source = `
        export callback function vblankIRQ(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getName()).toBe('vblankIRQ');
      expect(functionDecl.isCallbackFunction()).toBe(true);
      expect(functionDecl.isExportedFunction()).toBe(true);
    });
  });

  describe('Function Body Parsing', () => {
    test('parses empty function body', () => {
      const source = `
        function noop(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      expect(functionDecl.getBody()).toHaveLength(0);
    });

    test('parses function with variable declarations', () => {
      const source = `
        function calculate(): word
          let result: word = 0;
          let multiplier: byte = 2;
          return result;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body).toHaveLength(3); // 2 variable declarations + 1 return statement
    });

    test('parses function with assignment statements', () => {
      const source = `
        function updatePlayer(x: byte, y: byte): void
          playerX = x;
          playerY = y;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body).toHaveLength(2); // 2 assignment statements
    });

    test('parses function with expression statements', () => {
      const source = `
        function initialize(): void
          clearScreen();
          initSound();
          setupSprites();
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body).toHaveLength(3); // 3 function call statements
    });

    test('parses function with control flow statements', () => {
      const source = `
        function processInput(key: byte): void
          if (key == 32) then
            fireWeapon();
          end if

          while (enemyCount > 0)
            updateEnemies();
          end while
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body).toHaveLength(2); // 1 if statement + 1 while statement
    });

    test('parses function with return statements', () => {
      const source = `
        function getValue(): byte
          return 42;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body).toHaveLength(1); // 1 return statement
    });

    test('parses complex function with mixed statements', () => {
      const source = `
        function gameUpdate(deltaTime: word): boolean
          let playerMoved: boolean = false;
          let inputKey: byte = getInput();

          if (inputKey != 0) then
            let newX: byte = playerX;
            let newY: byte = playerY;

            if (inputKey == KEY_LEFT) then
              newX = newX - 1;
            end if

            if (inputKey == KEY_RIGHT) then
              newX = newX + 1;
            end if

            if (newX != playerX) then
              playerX = newX;
              playerMoved = true;
            end if
          end if

          updateAnimations(deltaTime);
          return playerMoved;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      const body = functionDecl.getBody();

      expect(body.length).toBeGreaterThan(3); // Multiple complex statements
    });
  });

  describe('Function Body Error Handling', () => {
    test('parses void function with return value (no semantic validation in Phase 4)', () => {
      const source = `
        function doSomething(): void
          return 42;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      // Phase 4: Parse structure correctly, semantic validation is future work
      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      expect(functionDecl.getBody()).toHaveLength(1); // Return statement parsed
    });

    test('parses typed function with empty return (validates return statement in Task 3.3)', () => {
      const source = `
        function getValue(): byte
          return;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      // Task 3.3: Return statement validation now active
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('must return a value');

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      expect(functionDecl.getBody()).toHaveLength(1); // Return statement still parsed
    });

    test('detects duplicate local variable declarations', () => {
      const source = `
        function test(): void
          let x: byte = 1;
          let x: byte = 2;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      // Parser's ScopeManager correctly detects duplicate variable declarations
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('already declared');

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;
      expect(functionDecl.getBody()).toHaveLength(2); // Both variable declarations parsed despite error
    });

    test('reports error for duplicate parameter names', () => {
      const source = `
        function test(x: byte, x: word): void
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);
      const duplicateError = errors.find(e => e.message.includes('Duplicate parameter'));
      expect(duplicateError).toBeDefined();
    });

    test('handles syntax errors gracefully with recovery', () => {
      const source = `
        function test(): void
          let x: byte = ;
          let y: byte = 42;
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      // Parser should recover and continue parsing after error
      expect(functionDecl.getName()).toBe('test');
    });
  });

  describe('Function Scope Validation', () => {
    test('parameters are available in function scope', () => {
      const source = `
        function add(a: byte, b: byte): byte
          let result: byte = a + b;
          return result;
        end function
      `;

      const { errors } = parseBlendProgram(source);

      // Should not report undefined variable errors for parameters
      expect(errors).toHaveLength(0);
    });

    test('local variables are properly scoped', () => {
      const source = `
        function test(): void
          let x: byte = 1;
          if (x > 0) then
            let y: byte = x + 1;
          end if
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);
    });

    test('function calls work in function bodies', () => {
      const source = `
        function helper(): byte
          return 42;
        end function

        function main(): void
          let value: byte = helper();
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);
    });
  });

  describe('Multiple Function Declarations', () => {
    test('parses multiple functions in same module', () => {
      const source = `
        function init(): void
        end function

        export function main(): void
        end function

        callback function timerIRQ(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const declarations = program.getDeclarations();
      expect(declarations).toHaveLength(3);

      const [init, main, timer] = declarations as FunctionDecl[];

      expect(init.getName()).toBe('init');
      expect(init.isExportedFunction()).toBe(false);

      expect(main.getName()).toBe('main');
      expect(main.isExportedFunction()).toBe(true);

      expect(timer.getName()).toBe('timerIRQ');
      expect(timer.isCallbackFunction()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('reports error for missing function name', () => {
      const source = `
        function (): void
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Expected function name');
    });

    test('reports error for missing parameter type', () => {
      const source = `
        function test(x): void
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);
      // Check that at least one error mentions the missing colon
      const colonError = errors.find(e => e.message.includes("Expected ':' after parameter name"));
      expect(colonError).toBeDefined();
    });

    test('reports error for missing end function', () => {
      const source = `
        function test(): void
          return;
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);
      // Check that at least one error mentions the missing 'end' keyword
      const endError = errors.find(e => e.message.includes("Expected 'end' after function body"));
      expect(endError).toBeDefined();
    });

    test('handles parameter parsing errors gracefully', () => {
      const source = `
        function test(a: byte, , c: word): void
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('Expected parameter name');
    });
  });

  describe('Specification Compliance', () => {
    test('follows exact grammar from language specification', () => {
      const source = `
        export callback function irqHandler(): void
        end function
      `;

      const { ast, errors } = parseBlendProgram(source);

      expect(errors).toHaveLength(0);

      const program = ast as Program;
      const functionDecl = program.getDeclarations()[0] as FunctionDecl;

      // Verify all specification requirements
      expect(functionDecl.getName()).toBe('irqHandler');
      expect(functionDecl.isExportedFunction()).toBe(true);
      expect(functionDecl.isCallbackFunction()).toBe(true);
      expect(functionDecl.getParameters()).toHaveLength(0);
      expect(functionDecl.getReturnType()).toBe('void');
      expect(functionDecl.getBody().length).toBe(0);
    });

    test('rejects invalid syntax not in specification', () => {
      const source = `
        function* generator(): void
        end function
      `;

      const { errors } = parseBlendProgram(source);

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
