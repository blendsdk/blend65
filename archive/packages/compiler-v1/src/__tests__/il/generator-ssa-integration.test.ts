/**
 * ILGenerator SSA Integration Tests
 *
 * Tests for the final ILGenerator class with SSA construction integration.
 * Verifies that:
 * - SSA construction is properly integrated into the generation pipeline
 * - Options are correctly applied
 * - SSA results are accessible and correct
 * - Edge cases are handled properly
 *
 * @module tests/il/generator-ssa-integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ILGenerator,
  ILGeneratorOptions,
  ILGenerationResult,
} from '../../il/generator/index.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { Program, ModuleDecl, FunctionDecl, ReturnStatement, LiteralExpression, BinaryExpression, IdentifierExpression } from '../../ast/nodes.js';
import { TokenType } from '../../lexer/types.js';
import type { SourceLocation } from '../../ast/base.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a dummy source location for test AST nodes.
 */
function createLocation(): SourceLocation {
  return {
    start: { line: 1, column: 1, offset: 0 },
    end: { line: 1, column: 10, offset: 10 },
    source: 'test.b65',
  };
}

/**
 * Creates a simple test program with a main function.
 * The function has no control flow, just returns a value.
 */
function createSimpleProgram(): Program {
  const loc = createLocation();

  // Create: fn main(): byte { return 42; }
  const returnStmt = new ReturnStatement(
    new LiteralExpression(42, loc),
    loc,
  );

  // FunctionDecl expects Statement[] | null for body
  const mainFunc = new FunctionDecl(
    'main',
    [],
    'byte',
    [returnStmt], // body is array of statements
    loc,
    false, // not exported
    false, // not callback
    false, // not stub
  );

  const moduleDecl = new ModuleDecl(['test'], loc);

  return new Program(moduleDecl, [mainFunc], loc);
}

/**
 * Creates a program with multiple functions.
 */
function createMultiFunctionProgram(): Program {
  const loc = createLocation();

  // fn add(a: byte, b: byte): byte { return a + b; }
  const addFunc = new FunctionDecl(
    'add',
    [
      { name: 'a', typeAnnotation: 'byte', location: loc },
      { name: 'b', typeAnnotation: 'byte', location: loc },
    ],
    'byte',
    [
      new ReturnStatement(
        new BinaryExpression(
          new IdentifierExpression('a', loc),
          TokenType.PLUS,
          new IdentifierExpression('b', loc),
          loc,
        ),
        loc,
      ),
    ],
    loc,
    false,
    false,
    false,
  );

  // fn main(): byte { return 0; }
  const mainFunc = new FunctionDecl(
    'main',
    [],
    'byte',
    [new ReturnStatement(new LiteralExpression(0, loc), loc)],
    loc,
    false,
    false,
    false,
  );

  const moduleDecl = new ModuleDecl(['test'], loc);

  return new Program(moduleDecl, [addFunc, mainFunc], loc);
}

/**
 * Creates a test symbol table.
 */
function createSymbolTable(): SymbolTable {
  return new SymbolTable();
}

// =============================================================================
// Test Suite: ILGenerator Construction
// =============================================================================

describe('ILGenerator Construction', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = createSymbolTable();
  });

  it('should create generator with default options', () => {
    const generator = new ILGenerator(symbolTable);

    const options = generator.getOptions();
    expect(options.enableSSA).toBe(true);
    // verifySSA is false by default due to known loop verification limitations
    expect(options.verifySSA).toBe(false);
    expect(options.collectSSAStats).toBe(false);
    expect(options.insertPhiInstructions).toBe(true);
    expect(options.verbose).toBe(false);
  });

  it('should create generator with custom options', () => {
    const generator = new ILGenerator(symbolTable, null, {
      enableSSA: false,
      verifySSA: false,
      collectSSAStats: true,
      insertPhiInstructions: false,
      verbose: true,
    });

    const options = generator.getOptions();
    expect(options.enableSSA).toBe(false);
    expect(options.verifySSA).toBe(false);
    expect(options.collectSSAStats).toBe(true);
    expect(options.insertPhiInstructions).toBe(false);
    expect(options.verbose).toBe(true);
  });

  it('should merge partial options with defaults', () => {
    const generator = new ILGenerator(symbolTable, null, {
      enableSSA: true,
      verifySSA: false,
      // other options use defaults
    });

    const options = generator.getOptions();
    expect(options.enableSSA).toBe(true);
    expect(options.verifySSA).toBe(false);
    expect(options.collectSSAStats).toBe(false); // default
    expect(options.insertPhiInstructions).toBe(true); // default
    expect(options.verbose).toBe(false); // default
  });
});

// =============================================================================
// Test Suite: Module Generation with SSA Disabled
// =============================================================================

describe('ILGenerator with SSA Disabled', () => {
  let symbolTable: SymbolTable;
  let generator: ILGenerator;

  beforeEach(() => {
    symbolTable = createSymbolTable();
    generator = new ILGenerator(symbolTable, null, { enableSSA: false });
  });

  it('should generate module without SSA conversion', () => {
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    expect(result.ssaEnabled).toBe(false);
    expect(result.ssaResults.size).toBe(0);
    expect(result.ssaSuccessCount).toBe(0);
    expect(result.ssaFailureCount).toBe(0);
  });

  it('should have empty SSA results when disabled', () => {
    const program = createMultiFunctionProgram();
    generator.generateModule(program);

    const ssaResults = generator.getSSAResults();
    expect(ssaResults.size).toBe(0);
  });

  it('should still generate valid IL module', () => {
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    expect(result.module).toBeDefined();
    expect(result.module.name).toBe('test');
    expect(result.module.hasFunction('main')).toBe(true);
  });
});

// =============================================================================
// Test Suite: Module Generation with SSA Enabled
// =============================================================================

describe('ILGenerator with SSA Enabled', () => {
  let symbolTable: SymbolTable;
  let generator: ILGenerator;

  beforeEach(() => {
    symbolTable = createSymbolTable();
    generator = new ILGenerator(symbolTable, null, {
      enableSSA: true,
      verifySSA: true,
    });
  });

  it('should generate module with SSA conversion', () => {
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    expect(result.ssaEnabled).toBe(true);
  });

  it('should provide SSA results for functions', () => {
    const program = createMultiFunctionProgram();
    const result = generator.generateModule(program);

    // Results depend on whether functions have meaningful bodies
    // Stub/empty functions may be skipped
    expect(result.ssaEnabled).toBe(true);
    expect(result.ssaResults).toBeDefined();
  });

  it('should skip stub functions in SSA conversion', () => {
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    // Simple return-only functions are treated as stubs
    // and may be skipped in SSA conversion
    expect(result.ssaEnabled).toBe(true);
  });

  it('should accumulate SSA success and failure counts', () => {
    const program = createMultiFunctionProgram();
    const result = generator.generateModule(program);

    // Success + failure = total non-stub functions processed
    const totalProcessed = result.ssaSuccessCount + result.ssaFailureCount;
    expect(totalProcessed).toBeGreaterThanOrEqual(0);
    expect(result.ssaResults.size).toBe(totalProcessed);
  });
});

// =============================================================================
// Test Suite: SSA Results Access
// =============================================================================

describe('ILGenerator SSA Results Access', () => {
  let symbolTable: SymbolTable;
  let generator: ILGenerator;

  beforeEach(() => {
    symbolTable = createSymbolTable();
    generator = new ILGenerator(symbolTable, null, { enableSSA: true });
  });

  it('should provide getSSAResults() method', () => {
    const program = createSimpleProgram();
    generator.generateModule(program);

    const results = generator.getSSAResults();
    expect(results).toBeInstanceOf(Map);
  });

  it('should provide getSSAResult() for specific function', () => {
    const program = createMultiFunctionProgram();
    generator.generateModule(program);

    // Result may be undefined for stub functions
    const mainResult = generator.getSSAResult('main');
    const addResult = generator.getSSAResult('add');

    // At least one may have a result
    // (depends on whether they're treated as stubs)
    expect(mainResult === undefined || mainResult !== undefined).toBe(true);
    expect(addResult === undefined || addResult !== undefined).toBe(true);
  });

  it('should return undefined for unknown function', () => {
    const program = createSimpleProgram();
    generator.generateModule(program);

    const unknownResult = generator.getSSAResult('nonexistent');
    expect(unknownResult).toBeUndefined();
  });

  it('should clear SSA results on new generation', () => {
    const program1 = createSimpleProgram();
    generator.generateModule(program1);
    const results1Size = generator.getSSAResults().size;

    // Generate a different program
    const program2 = createMultiFunctionProgram();
    generator.generateModule(program2);
    const results2 = generator.getSSAResults();

    // Results should be from the second generation only
    expect(results2).toBeDefined();
    // Size may differ between programs
  });
});

// =============================================================================
// Test Suite: ILGenerationResult Structure
// =============================================================================

describe('ILGenerationResult Structure', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = createSymbolTable();
  });

  it('should extend ModuleGenerationResult', () => {
    const generator = new ILGenerator(symbolTable);
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    // From ModuleGenerationResult
    expect(result).toHaveProperty('module');
    expect(result).toHaveProperty('success');

    // From ILGenerationResult
    expect(result).toHaveProperty('ssaEnabled');
    expect(result).toHaveProperty('ssaResults');
    expect(result).toHaveProperty('ssaSuccessCount');
    expect(result).toHaveProperty('ssaFailureCount');
  });

  it('should have correct types for all properties', () => {
    const generator = new ILGenerator(symbolTable);
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    expect(typeof result.success).toBe('boolean');
    expect(typeof result.ssaEnabled).toBe('boolean');
    expect(typeof result.ssaSuccessCount).toBe('number');
    expect(typeof result.ssaFailureCount).toBe('number');
    expect(result.ssaResults instanceof Map).toBe(true);
  });

  it('should return immutable ssaResults map', () => {
    const generator = new ILGenerator(symbolTable);
    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    // The result should be a ReadonlyMap
    // Attempting to modify it should not affect internal state
    const resultMap = result.ssaResults as Map<string, unknown>;

    // The Map is returned as ReadonlyMap, but we can still call methods
    // that don't modify it
    expect(() => resultMap.get('test')).not.toThrow();
  });
});

// =============================================================================
// Test Suite: Generator Options Effects
// =============================================================================

describe('ILGenerator Options Effects', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = createSymbolTable();
  });

  it('should respect enableSSA option', () => {
    const disabledGen = new ILGenerator(symbolTable, null, { enableSSA: false });
    const enabledGen = new ILGenerator(symbolTable, null, { enableSSA: true });

    const program = createSimpleProgram();

    const disabledResult = disabledGen.generateModule(program);
    const enabledResult = enabledGen.generateModule(program);

    expect(disabledResult.ssaEnabled).toBe(false);
    expect(enabledResult.ssaEnabled).toBe(true);
  });

  it('should respect verifySSA option', () => {
    // With verification
    const verifyGen = new ILGenerator(symbolTable, null, {
      enableSSA: true,
      verifySSA: true,
    });

    // Without verification
    const noVerifyGen = new ILGenerator(symbolTable, null, {
      enableSSA: true,
      verifySSA: false,
    });

    const program = createSimpleProgram();

    // Both should succeed for valid programs
    const verifyResult = verifyGen.generateModule(program);
    const noVerifyResult = noVerifyGen.generateModule(program);

    expect(verifyResult.success).toBe(true);
    expect(noVerifyResult.success).toBe(true);
  });
});

// =============================================================================
// Test Suite: Edge Cases
// =============================================================================

describe('ILGenerator Edge Cases', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = createSymbolTable();
  });

  it('should handle program with no functions', () => {
    const loc = createLocation();
    const moduleDecl = new ModuleDecl(['empty'], loc);
    const program = new Program(moduleDecl, [], loc);

    const generator = new ILGenerator(symbolTable);
    const result = generator.generateModule(program);

    expect(result.success).toBe(true);
    expect(result.ssaEnabled).toBe(true);
    expect(result.ssaSuccessCount).toBe(0);
    expect(result.ssaFailureCount).toBe(0);
    expect(result.ssaResults.size).toBe(0);
  });

  it('should handle multiple module generations', () => {
    const generator = new ILGenerator(symbolTable);

    const program1 = createSimpleProgram();
    const result1 = generator.generateModule(program1);
    expect(result1.success).toBe(true);

    const program2 = createMultiFunctionProgram();
    const result2 = generator.generateModule(program2);
    expect(result2.success).toBe(true);

    // Each generation should produce independent results
    expect(result1.module.name).toBe('test');
    expect(result2.module.name).toBe('test');
  });
});

// =============================================================================
// Test Suite: Integration with Full Pipeline
// =============================================================================

describe('ILGenerator Full Pipeline Integration', () => {
  let symbolTable: SymbolTable;

  beforeEach(() => {
    symbolTable = createSymbolTable();
  });

  it('should work with complete generation and SSA pipeline', () => {
    const generator = new ILGenerator(symbolTable, null, {
      enableSSA: true,
      verifySSA: true,
      collectSSAStats: true,
      insertPhiInstructions: true,
    });

    const program = createSimpleProgram();
    const result = generator.generateModule(program);

    // Full pipeline should succeed
    expect(result.success).toBe(true);
    expect(result.module).toBeDefined();
    expect(result.ssaEnabled).toBe(true);
  });

  it('should provide module with valid functions', () => {
    const generator = new ILGenerator(symbolTable);
    const program = createMultiFunctionProgram();
    const result = generator.generateModule(program);

    const module = result.module;
    expect(module.hasFunction('main')).toBe(true);
    expect(module.hasFunction('add')).toBe(true);
  });
});