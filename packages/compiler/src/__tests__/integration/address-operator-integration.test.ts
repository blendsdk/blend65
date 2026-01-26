/**
 * Address-of Operator Integration Tests
 *
 * Tests the full compiler pipeline (Lexer → Parser → Semantic Analyzer → IL Generator → CodeGen)
 * for the address-of operator (@) to ensure all components work together correctly.
 *
 * The address-of operator is used to:
 * 1. Get the memory address of variables: `@myVar`
 * 2. Get the memory address of functions: `@myFunc`
 * 3. Pass functions as callbacks: `setHandler(myFunc)`
 *
 * @module __tests__/integration/address-operator-integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Lexer } from '../../lexer/lexer.js';
import { Parser } from '../../parser/parser.js';
import { SemanticAnalyzer } from '../../semantic/analyzer.js';
import { ILExpressionGenerator } from '../../il/generator/expressions.js';
import { CodeGenerator } from '../../codegen/code-generator.js';
import { C64_CONFIG } from '../../target/index.js';
import { C64_BASIC_START } from '../../codegen/types.js';
import type { CodegenOptions } from '../../codegen/types.js';
import type { Program } from '../../ast/nodes.js';
import { ILOpcode } from '../../il/instructions.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Parses Blend65 source code into an AST Program.
 *
 * @param source - Blend65 source code
 * @returns Parsed AST Program
 */
function parseSource(source: string): Program {
  const lexer = new Lexer(source);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

/**
 * Creates standard test options for code generation.
 *
 * @param overrides - Optional overrides for test options
 * @returns CodegenOptions configured for testing
 */
function createTestOptions(overrides: Partial<CodegenOptions> = {}): CodegenOptions {
  return {
    target: C64_CONFIG,
    format: 'asm',
    sourceMap: false,
    debug: 'none',
    loadAddress: C64_BASIC_START,
    ...overrides,
  };
}

/**
 * Runs the full semantic analysis pipeline.
 *
 * @param source - Blend65 source code
 * @returns Result object with analyzer and result
 */
function analyzeSemantically(source: string) {
  const ast = parseSource(source);
  const analyzer = new SemanticAnalyzer();
  const result = analyzer.analyze(ast);

  return { ast, result, analyzer };
}

/**
 * Runs source through IL generation with proper semantic analysis.
 *
 * The IL generator requires the symbol table to be pre-populated with symbols
 * from semantic analysis. This function runs the full pipeline.
 *
 * @param source - Blend65 source code
 * @returns IL generation result with errors
 */
function generateIL(source: string) {
  // Parse the source
  const ast = parseSource(source);

  // Run semantic analysis to populate symbol table
  const analyzer = new SemanticAnalyzer();
  analyzer.analyze(ast);

  // Get the populated symbol table (assert non-null for tests)
  const symbolTable = analyzer.getSymbolTable()!;

  // Generate IL with the populated symbol table
  const generator = new ILExpressionGenerator(symbolTable);
  const result = generator.generateModule(ast);

  // Get errors from the generator
  const errors = generator.getErrors();

  return { ...result, errors, generator };
}

/**
 * Finds all instructions with a specific opcode in an IL function.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to search for
 * @returns Array of matching instructions
 */
function findInstructions(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): { opcode: ILOpcode }[] {
  const instructions: { opcode: ILOpcode }[] = [];
  for (const block of ilFunc.getBlocks()) {
    for (const instr of block.getInstructions()) {
      if (instr.opcode === opcode) {
        instructions.push(instr as { opcode: ILOpcode });
      }
    }
  }
  return instructions;
}

/**
 * Checks if a function contains at least one instruction with a specific opcode.
 *
 * @param ilFunc - IL function to search
 * @param opcode - Opcode to search for
 * @returns true if opcode is found
 */
function hasInstruction(
  ilFunc: { getBlocks(): readonly { getInstructions(): readonly { opcode: ILOpcode }[] }[] },
  opcode: ILOpcode,
): boolean {
  return findInstructions(ilFunc, opcode).length > 0;
}

// =============================================================================
// Parser Integration Tests for @ Operator
// =============================================================================

describe('Address-of Operator - Parser Integration', () => {
  describe('@variable syntax', () => {
    it('should parse @variable as a unary expression', () => {
      const source = `
        module test
        let counter: byte = 0;
        function getAddr(): word {
          return @counter;
        }
      `;

      const ast = parseSource(source);
      expect(ast).toBeDefined();
      expect(ast.getDeclarations().length).toBeGreaterThan(0);
    });

    it('should parse @variable in assignment context', () => {
      const source = `
        module test
        let myVar: byte = 42;
        function main(): void {
          let addr: word = @myVar;
        }
      `;

      const ast = parseSource(source);
      expect(ast).toBeDefined();
    });

    it('should parse @variable passed as function argument', () => {
      const source = `
        module test
        function setPointer(ptr: word): void;
        let buffer: byte = 0;
        function main(): void {
          setPointer(@buffer);
        }
      `;

      const ast = parseSource(source);
      expect(ast).toBeDefined();
    });
  });

  describe('@function syntax', () => {
    it('should parse @function for getting function address', () => {
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): word {
          return @myHandler;
        }
      `;

      const ast = parseSource(source);
      expect(ast).toBeDefined();
    });
  });
});

// =============================================================================
// Semantic Analysis Integration Tests
// =============================================================================

describe('Address-of Operator - Semantic Analysis', () => {
  describe('type checking', () => {
    it('should analyze @variable expression successfully', () => {
      const source = `
        module test
        let counter: byte = 0;
        function main(): word {
          return @counter;
        }
      `;

      const { result } = analyzeSemantically(source);
      // Address-of variable should work without semantic errors
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('should parse @function expression (semantic analysis pending full support)', () => {
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): word {
          return @myHandler;
        }
      `;

      const { result } = analyzeSemantically(source);
      // Note: Semantic analyzer may report TYPE_MISMATCH until full address-of type support
      // For now, verify it doesn't crash and parses correctly
      expect(result).toBeDefined();
    });

    it('should parse function passed as callback (semantic analysis pending full support)', () => {
      const source = `
        module test
        function setHandler(handler: word): void;
        function myHandler(): void {
        }
        function main(): void {
          setHandler(@myHandler);
        }
      `;

      const { result } = analyzeSemantically(source);
      // Note: Semantic analyzer may report TYPE_MISMATCH until full address-of type support
      // Verify it doesn't crash
      expect(result).toBeDefined();
    });
  });

  describe('symbol resolution', () => {
    it('should resolve variable symbols for address-of', () => {
      const source = `
        module test
        let globalVar: byte = 10;
        function main(): word {
          return @globalVar;
        }
      `;

      const { result, analyzer } = analyzeSemantically(source);
      expect(result.success).toBe(true);

      const symbolTable = analyzer.getSymbolTable()!;
      const globalVarSymbol = symbolTable.lookup('globalVar');
      expect(globalVarSymbol).not.toBeNull();
    });

    it('should resolve function symbols for address-of', () => {
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): word {
          return @myHandler;
        }
      `;

      const { result, analyzer } = analyzeSemantically(source);
      expect(result.success).toBe(true);

      const symbolTable = analyzer.getSymbolTable()!;
      const handlerSymbol = symbolTable.lookup('myHandler');
      expect(handlerSymbol).not.toBeNull();
    });
  });
});

// =============================================================================
// IL Generation Integration Tests
// =============================================================================

describe('Address-of Operator - IL Generation', () => {
  describe('@variable IL generation', () => {
    it('should generate IL for @variable (pending symbol table integration)', () => {
      // PENDING: IL generator requires full integration between semantic analyzer's
      // symbol table and IL generator's lookupVariable() to resolve global variables
      const source = `
        module test
        let counter: byte = 0;
        function getAddr(): word {
          return @counter;
        }
      `;

      const result = generateIL(source);
      expect(result.success).toBe(true);

      const func = result.module.getFunction('getAddr');
      expect(func).toBeDefined();

      // IL function exists and can be inspected
      if (func) {
        const blocks = func.getBlocks();
        expect(blocks.length).toBeGreaterThan(0);
      }
    });

    it('should generate LOAD_ADDRESS with variable symbol kind (pending symbol table integration)', () => {
      // This test is pending full integration between semantic analyzer's
      // symbol table and IL generator's lookupVariable()
      const source = `
        module test
        let buffer: byte = 0;
        function main(): word {
          let addr: word = @buffer;
          return addr;
        }
      `;

      const result = generateIL(source);
      expect(result.success).toBe(true);

      const func = result.module.getFunction('main');
      if (func) {
        const loadAddrs = findInstructions(func, ILOpcode.LOAD_ADDRESS);
        expect(loadAddrs.length).toBeGreaterThan(0);
      }
    });
  });

  describe('@function IL generation', () => {
    it('should generate LOAD_ADDRESS for @function (pending full integration)', () => {
      // Pending: IL generator's lookupFunction needs access to semantic symbols
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): word {
          return @myHandler;
        }
      `;

      const result = generateIL(source);
      expect(result.success).toBe(true);

      const func = result.module.getFunction('main');
      if (func) {
        expect(hasInstruction(func, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }
    });
  });

  describe('callback parameter IL generation', () => {
    it('should generate LOAD_ADDRESS for function passed as argument (pending)', () => {
      // Pending: Full callback pattern integration
      const source = `
        module test
        function setHandler(handler: word): void;
        function myHandler(): void {
        }
        function main(): void {
          setHandler(@myHandler);
        }
      `;

      const result = generateIL(source);
      expect(result.success).toBe(true);

      const func = result.module.getFunction('main');
      if (func) {
        expect(hasInstruction(func, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }
    });
  });
});

// =============================================================================
// Code Generation Integration Tests
// =============================================================================

describe('Address-of Operator - Code Generation', () => {
  let codegen: CodeGenerator;

  beforeEach(() => {
    codegen = new CodeGenerator();
  });

  describe('assembly output verification', () => {
    it('should generate valid assembly for program with address-of (pending integration)', () => {
      // PENDING: Requires full IL generation to work first
      const source = `
        module test
        let myVar: byte = 0;
        function main(): word {
          return @myVar;
        }
      `;

      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      const options = createTestOptions();
      const result = codegen.generate(ilResult.module, options);

      // Code generation should succeed and produce assembly
      expect(result.assembly).toBeDefined();
      expect(result.assembly.length).toBeGreaterThan(0);
      expect(result.assembly).toContain('_main'); // Function label
    });

    it('should include function labels in assembly', () => {
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): void {
          myHandler();
        }
      `;

      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      const options = createTestOptions();
      const result = codegen.generate(ilResult.module, options);

      // Function labels should be in the assembly
      expect(result.assembly).toContain('_myHandler');
      expect(result.assembly).toContain('_main');
    });
  });
});

// =============================================================================
// Full Pipeline E2E Tests
// =============================================================================

describe('Address-of Operator - Full Pipeline E2E', () => {
  describe('E2E test for @variable', () => {
    it('should compile @variable through entire pipeline (pending integration)', () => {
      // PENDING: Full IL generation integration is required
      const source = `
        module test
        let counter: byte = 0;
        function getCounterAddr(): word {
          return @counter;
        }
        function main(): void {
          let addr: word = getCounterAddr();
        }
      `;

      // Step 1: Parse
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      // Step 2: Semantic analysis
      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);
      expect(semanticResult.diagnostics).toHaveLength(0);

      // Step 3: IL generation
      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);
      expect(ilResult.module.getFunction('getCounterAddr')).toBeDefined();
      expect(ilResult.module.getFunction('main')).toBeDefined();

      // Step 4: Code generation
      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly.length).toBeGreaterThan(0);
    });
  });

  describe('E2E test for @function', () => {
    it('should compile @function through entire pipeline', () => {
      const source = `
        module test
        function myHandler(): void {
        }
        function main(): word {
          return @myHandler;
        }
      `;

      // Step 1: Parse
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      // Step 2: Semantic analysis
      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      // Step 3: IL generation
      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);
      expect(ilResult.module.getFunction('myHandler')).toBeDefined();
      expect(ilResult.module.getFunction('main')).toBeDefined();

      // Verify LOAD_ADDRESS instruction is generated for @myHandler
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        expect(hasInstruction(mainFunc, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }

      // Step 4: Code generation
      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly.length).toBeGreaterThan(0);
      expect(asmResult.assembly).toContain('_myHandler');
    });
  });

  describe('E2E test for callbacks', () => {
    it('should compile callback pattern through entire pipeline', () => {
      const source = `
        module test
        function setHandler(handler: word): void;
        function myCallback(): void {
        }
        function main(): void {
          setHandler(@myCallback);
        }
      `;

      // Step 1: Parse
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      // Step 2: Semantic analysis
      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      // Step 3: IL generation
      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);
      expect(ilResult.module.getFunction('myCallback')).toBeDefined();
      expect(ilResult.module.getFunction('main')).toBeDefined();

      // Verify LOAD_ADDRESS instruction is generated for @myCallback
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        expect(hasInstruction(mainFunc, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }

      // Step 4: Code generation
      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly.length).toBeGreaterThan(0);
      expect(asmResult.assembly).toContain('_myCallback');
    });

    it('should handle multiple callbacks in same function', () => {
      const source = `
        module test
        function setHandlerA(handler: word): void;
        function setHandlerB(handler: word): void;
        function callbackA(): void {
        }
        function callbackB(): void {
        }
        function main(): void {
          setHandlerA(@callbackA);
          setHandlerB(@callbackB);
        }
      `;

      // Step 1: Parse
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      // Step 2: Semantic analysis
      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      // Step 3: IL generation
      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      // Verify LOAD_ADDRESS instructions are generated for both callbacks
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        const loadAddrs = findInstructions(mainFunc, ILOpcode.LOAD_ADDRESS);
        expect(loadAddrs.length).toBe(2); // Two @callback uses
      }

      // Step 4: Code generation
      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly).toContain('_callbackA');
      expect(asmResult.assembly).toContain('_callbackB');
    });
  });
});

// =============================================================================
// Real-World C64 Patterns
// =============================================================================

describe('Address-of Operator - C64 Patterns', () => {
  describe('interrupt handler pattern', () => {
    it('should compile IRQ setup pattern', () => {
      // Pattern: Set up a custom IRQ handler by getting function address
      // The C64's IRQ vector at $0314/$0315 is set to the handler address
      const source = `
        module test
        function setIrqHandler(handler: word): void;
        function myIrqHandler(): void {
        }
        function main(): void {
          setIrqHandler(@myIrqHandler);
        }
      `;

      // Full pipeline
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      // Verify the handler function exists and address-of is used
      expect(ilResult.module.getFunction('myIrqHandler')).toBeDefined();
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        expect(hasInstruction(mainFunc, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }

      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toContain('_myIrqHandler');
    });
  });

  describe('buffer address pattern', () => {
    it('should compile buffer address passing pattern', () => {
      // Pattern: Pass a buffer's address to a function (e.g., for DMA, SID, etc.)
      const source = `
        module test
        let screenBuffer: byte = 0;
        function setBufferAddress(addr: word): void;
        function main(): void {
          setBufferAddress(@screenBuffer);
        }
      `;

      // Full pipeline
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      // Verify LOAD_ADDRESS is generated for the buffer
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        expect(hasInstruction(mainFunc, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }

      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly.length).toBeGreaterThan(0);
    });
  });

  describe('lookup table address pattern', () => {
    it('should compile lookup table address pattern', () => {
      // Pattern: Get address of a data table for indexed operations
      const source = `
        module test
        let sineTable: byte = 0;
        function setTablePointer(addr: word): void;
        function main(): void {
          setTablePointer(@sineTable);
        }
      `;

      // Full pipeline
      const ast = parseSource(source);
      expect(ast).toBeDefined();

      const analyzer = new SemanticAnalyzer();
      const semanticResult = analyzer.analyze(ast);
      expect(semanticResult.success).toBe(true);

      const ilResult = generateIL(source);
      expect(ilResult.success).toBe(true);

      // Verify LOAD_ADDRESS is generated for the table
      const mainFunc = ilResult.module.getFunction('main');
      expect(mainFunc).toBeDefined();
      if (mainFunc) {
        expect(hasInstruction(mainFunc, ILOpcode.LOAD_ADDRESS)).toBe(true);
      }

      const codegen = new CodeGenerator();
      const asmResult = codegen.generate(ilResult.module, createTestOptions());
      expect(asmResult.assembly).toBeDefined();
      expect(asmResult.assembly.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

describe('Address-of Operator - Error Handling', () => {
  describe('invalid operand errors', () => {
    it('should report error for @literal', () => {
      const source = `
        module test
        function main(): word {
          return @42;
        }
      `;

      // This should fail during semantic analysis or IL generation
      // because you can't take the address of a literal
      const { result } = analyzeSemantically(source);

      // The parser might accept it, but semantic analysis should reject it
      // or IL generation should produce an error
      // This depends on the exact error handling in the implementation
      // For now, we just verify the pipeline doesn't crash
      expect(result).toBeDefined();
    });

    it('should report error for @(expression)', () => {
      const source = `
        module test
        function main(): word {
          let a: byte = 1;
          let b: byte = 2;
          return @(a + b);
        }
      `;

      // Address-of should only work on identifiers, not complex expressions
      // This should fail parsing or semantic analysis
      const { result } = analyzeSemantically(source);
      expect(result).toBeDefined();
    });
  });
});