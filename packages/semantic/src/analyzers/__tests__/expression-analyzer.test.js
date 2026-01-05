/**
 * Expression Analyzer Tests
 * Task 1.7: Expression and Statement Analysis Implementation
 *
 * Comprehensive test suite for the ExpressionAnalyzer class covering:
 * - Expression type analysis and validation
 * - Optimization metadata collection
 * - Variable usage tracking and access pattern analysis
 * - Side effect detection and purity analysis
 * - 6502-specific optimization hints
 * - Register pressure analysis
 * - Statement and block analysis
 * - Control flow analysis
 * - Error reporting and edge cases
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ExpressionAnalyzer, createExpressionContext, } from '../expression-analyzer.js';
import { SymbolTable } from '../../symbol-table.js';
import { TypeChecker } from '../../type-system.js';
import { createVariableSymbol, createFunctionSymbol, createPrimitiveType, createArrayType, } from '../../types.js';
import { ASTNodeFactory } from '@blend65/ast';
describe('ExpressionAnalyzer', () => {
    let analyzer;
    let symbolTable;
    let typeChecker;
    let factory;
    let context;
    beforeEach(() => {
        symbolTable = new SymbolTable();
        typeChecker = new TypeChecker((name) => symbolTable.lookupSymbol(name));
        analyzer = new ExpressionAnalyzer(symbolTable, typeChecker);
        factory = new ASTNodeFactory();
        context = createExpressionContext({
            loopDepth: 0,
            inHotPath: false,
            inCondition: false,
            inAssignment: false,
            hardwareContext: 'normal',
            optimizationLevel: 'balanced',
        });
    });
    // ============================================================================
    // EXPRESSION TYPE ANALYSIS TESTS
    // ============================================================================
    describe('Binary Expression Analysis', () => {
        it('should analyze arithmetic binary expressions correctly', () => {
            // Create test expressions: 5 + 10
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(10, '10');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.isConstant).toBe(false); // Both literals but not folded yet
            expect(result.optimizationData.constantFoldingCandidate).toBe(true);
        });
        it('should detect word type promotion in arithmetic', () => {
            // Test: byte + word = word
            const left = factory.createLiteral(255, '255'); // byte
            const right = factory.createLiteral(256, '256'); // word
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('word'));
            expect(result.errors).toHaveLength(0);
        });
        it('should analyze comparison expressions', () => {
            const left = factory.createIdentifier('x');
            const right = factory.createLiteral(10, '10');
            const expr = factory.createBinaryExpr('==', left, right);
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('x', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('boolean'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.usedVariables).toHaveLength(1);
            expect(result.optimizationData.usedVariables[0].symbol.name).toBe('x');
        });
        it('should analyze logical expressions', () => {
            const left = factory.createLiteral(true, 'true');
            const right = factory.createLiteral(false, 'false');
            const expr = factory.createBinaryExpr('&&', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('boolean'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.constantFoldingCandidate).toBe(true);
        });
        it('should report type mismatch errors for incompatible types', () => {
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(true, 'true');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Cannot perform');
        });
        it('should detect unknown binary operators', () => {
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(10, '10');
            const expr = {
                type: 'BinaryExpr',
                operator: '??', // Unknown operator
                left,
                right,
            };
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('InvalidOperation');
            expect(result.errors[0].message).toContain('Unknown binary operator');
        });
    });
    describe('Unary Expression Analysis', () => {
        it('should analyze arithmetic unary expressions', () => {
            const operand = factory.createLiteral(10, '10');
            const expr = factory.createUnaryExpr('-', operand);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
        });
        it('should analyze logical not expressions', () => {
            const operand = factory.createLiteral(true, 'true');
            const expr = factory.createUnaryExpr('!', operand);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('boolean'));
            expect(result.errors).toHaveLength(0);
        });
        it('should validate increment/decrement operand types', () => {
            const operand = factory.createLiteral(true, 'true'); // boolean not valid for ++
            const expr = factory.createUnaryExpr('++', operand);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Cannot apply');
        });
        it('should detect unknown unary operators', () => {
            const operand = factory.createLiteral(10, '10');
            const expr = {
                type: 'UnaryExpr',
                operator: '@', // Unknown operator
                operand,
            };
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('InvalidOperation');
            expect(result.errors[0].message).toContain('Unknown unary operator');
        });
    });
    describe('Assignment Expression Analysis', () => {
        it('should analyze valid assignments', () => {
            const left = factory.createIdentifier('x');
            const right = factory.createLiteral(42, '42');
            const expr = factory.createAssignmentExpr('=', left, right);
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('x', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.hasSideEffects).toBe(true);
            expect(result.optimizationData.isPure).toBe(false);
        });
        it('should report type mismatch in assignments', () => {
            const left = factory.createIdentifier('x');
            const right = factory.createLiteral(true, 'true'); // boolean to byte
            const expr = factory.createAssignmentExpr('=', left, right);
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('x', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Cannot assign');
        });
    });
    describe('Function Call Expression Analysis', () => {
        it('should analyze valid function calls', () => {
            const callee = factory.createIdentifier('add');
            const arg1 = factory.createLiteral(5, '5');
            const arg2 = factory.createLiteral(10, '10');
            const expr = factory.createCallExpr(callee, [arg1, arg2]);
            // Set up function in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const funcSymbol = createFunctionSymbol('add', [
                { name: 'a', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
                { name: 'b', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
            ], createPrimitiveType('byte'), globalScope, { line: 1, column: 1, offset: 0 });
            symbolTable.declareSymbol(funcSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.hasSideEffects).toBe(true);
            expect(result.optimizationData.hasNestedCalls).toBe(true);
        });
        it('should report argument count mismatch', () => {
            const callee = factory.createIdentifier('add');
            const arg1 = factory.createLiteral(5, '5');
            const expr = factory.createCallExpr(callee, [arg1]); // Missing one argument
            // Set up function in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const funcSymbol = createFunctionSymbol('add', [
                { name: 'a', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
                { name: 'b', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
            ], createPrimitiveType('byte'), globalScope, { line: 1, column: 1, offset: 0 });
            symbolTable.declareSymbol(funcSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('expects 2 arguments');
        });
        it('should report argument type mismatch', () => {
            const callee = factory.createIdentifier('add');
            const arg1 = factory.createLiteral(5, '5');
            const arg2 = factory.createLiteral(true, 'true'); // boolean instead of byte
            const expr = factory.createCallExpr(callee, [arg1, arg2]);
            // Set up function in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const funcSymbol = createFunctionSymbol('add', [
                { name: 'a', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
                { name: 'b', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
            ], createPrimitiveType('byte'), globalScope, { line: 1, column: 1, offset: 0 });
            symbolTable.declareSymbol(funcSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Argument 2');
        });
        it('should analyze callback function calls', () => {
            const callee = factory.createIdentifier('callback');
            const expr = factory.createCallExpr(callee, []);
            // Set up callback variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const callbackType = {
                kind: 'callback',
                parameterTypes: [],
                returnType: createPrimitiveType('void'),
            };
            const varSymbol = createVariableSymbol('callback', callbackType, globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('void'));
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('Array Access Expression Analysis', () => {
        it('should analyze valid array access', () => {
            const array = factory.createIdentifier('arr');
            const index = factory.createLiteral(5, '5');
            const expr = factory.createIndexExpr(array, index);
            // Set up array variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const arrayType = createArrayType(createPrimitiveType('byte'), 10);
            const varSymbol = createVariableSymbol('arr', arrayType, globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.hasComplexAddressing).toBe(true);
        });
        it('should report invalid array index types', () => {
            const array = factory.createIdentifier('arr');
            const index = factory.createLiteral(true, 'true'); // boolean index
            const expr = factory.createIndexExpr(array, index);
            // Set up array variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const arrayType = createArrayType(createPrimitiveType('byte'), 10);
            const varSymbol = createVariableSymbol('arr', arrayType, globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Array index must be numeric');
        });
        it('should report indexing into non-array types', () => {
            const array = factory.createIdentifier('notArray');
            const index = factory.createLiteral(5, '5');
            const expr = factory.createIndexExpr(array, index);
            // Set up non-array variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('notArray', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Cannot index into non-array type');
        });
    });
    describe('Identifier Analysis', () => {
        it('should analyze valid variable identifiers', () => {
            const expr = factory.createIdentifier('myVar');
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('myVar', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.hasVariableAccess).toBe(true);
            expect(result.optimizationData.usedVariables).toHaveLength(1);
        });
        it('should analyze function identifiers as callback types', () => {
            const expr = factory.createIdentifier('myFunc');
            // Set up function in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const funcSymbol = createFunctionSymbol('myFunc', [{ name: 'x', type: createPrimitiveType('byte'), optional: false, defaultValue: null }], createPrimitiveType('word'), globalScope, { line: 1, column: 1, offset: 0 });
            symbolTable.declareSymbol(funcSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType.kind).toBe('callback');
            expect(result.errors).toHaveLength(0);
        });
        it('should report undefined symbol errors', () => {
            const expr = factory.createIdentifier('undefinedVar');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('UndefinedSymbol');
            expect(result.errors[0].message).toContain('Undefined symbol');
            expect(result.errors[0].suggestions).toBeDefined();
        });
    });
    describe('Literal Analysis', () => {
        it('should analyze number literals within byte range', () => {
            const expr = factory.createLiteral(255, '255');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.isConstant).toBe(true);
            expect(result.optimizationData.constantValue).toBe(255);
        });
        it('should analyze number literals within word range', () => {
            const expr = factory.createLiteral(256, '256');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('word'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.isConstant).toBe(true);
        });
        it('should report out-of-range number literals', () => {
            const expr = factory.createLiteral(70000, '70000'); // > 65535
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('out of range for 6502');
        });
        it('should analyze boolean literals', () => {
            const expr = factory.createLiteral(true, 'true');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('boolean'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.isConstant).toBe(true);
        });
        it('should analyze string literals as byte arrays', () => {
            const expr = factory.createLiteral('hello', '"hello"');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType.kind).toBe('array');
            expect(result.resolvedType.elementType).toEqual(createPrimitiveType('byte'));
            expect(result.resolvedType.size).toBe(5);
            expect(result.errors).toHaveLength(0);
        });
    });
    describe('Array Literal Analysis', () => {
        it('should analyze homogeneous array literals', () => {
            const elements = [
                factory.createLiteral(1, '1'),
                factory.createLiteral(2, '2'),
                factory.createLiteral(3, '3'),
            ];
            const expr = factory.createArrayLiteral(elements);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.resolvedType.kind).toBe('array');
            expect(result.resolvedType.elementType).toEqual(createPrimitiveType('byte'));
            expect(result.resolvedType.size).toBe(3);
            expect(result.errors).toHaveLength(0);
        });
        it('should report type mismatches in array elements', () => {
            const elements = [
                factory.createLiteral(1, '1'),
                factory.createLiteral(true, 'true'), // boolean in byte array
                factory.createLiteral(3, '3'),
            ];
            const expr = factory.createArrayLiteral(elements);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Array element 2');
        });
        it('should report empty array literal errors', () => {
            const expr = factory.createArrayLiteral([]);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('TypeMismatch');
            expect(result.errors[0].message).toContain('Empty array literals');
        });
    });
    // ============================================================================
    // OPTIMIZATION METADATA TESTS
    // ============================================================================
    describe('Constant Analysis', () => {
        it('should identify constant expressions', () => {
            const expr = factory.createLiteral(42, '42');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.isConstant).toBe(true);
            expect(result.optimizationData.constantValue).toBe(42);
            expect(result.optimizationData.isCompileTimeConstant).toBe(true);
        });
        it('should identify constant folding candidates', () => {
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(10, '10');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.constantFoldingCandidate).toBe(true);
        });
        it('should identify non-constant expressions', () => {
            const expr = factory.createIdentifier('variable');
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('variable', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.isConstant).toBe(false);
            expect(result.optimizationData.constantValue).toBeUndefined();
        });
    });
    describe('Variable Usage Tracking', () => {
        it('should track variable references', () => {
            const expr = factory.createIdentifier('testVar');
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('testVar', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.hasVariableAccess).toBe(true);
            expect(result.optimizationData.usedVariables).toHaveLength(1);
            expect(result.optimizationData.usedVariables[0].symbol.name).toBe('testVar');
            expect(result.optimizationData.usedVariables[0].accessType).toBe('read');
        });
        it('should analyze access patterns', () => {
            const expr = factory.createIdentifier('var1');
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('var1', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.variableAccessPattern).toBe('single_use');
        });
    });
    describe('Side Effect Analysis', () => {
        it('should detect function calls as side effects', () => {
            const callee = factory.createIdentifier('sideEffectFunc');
            const expr = factory.createCallExpr(callee, []);
            // Set up function in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const funcSymbol = createFunctionSymbol('sideEffectFunc', [], createPrimitiveType('void'), globalScope, { line: 1, column: 1, offset: 0 });
            symbolTable.declareSymbol(funcSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.hasSideEffects).toBe(true);
            expect(result.optimizationData.isPure).toBe(false);
            expect(result.optimizationData.sideEffects).toHaveLength(1);
            expect(result.optimizationData.sideEffects[0].type).toBe('function_call');
        });
        it('should detect assignments as side effects', () => {
            const left = factory.createIdentifier('var1');
            const right = factory.createLiteral(42, '42');
            const expr = factory.createAssignmentExpr('=', left, right);
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('var1', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.hasSideEffects).toBe(true);
            expect(result.optimizationData.isPure).toBe(false);
        });
        it('should identify pure expressions', () => {
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(10, '10');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.hasSideEffects).toBe(false);
            expect(result.optimizationData.isPure).toBe(true);
        });
    });
    describe('Performance Analysis', () => {
        it('should calculate complexity scores', () => {
            const nested = factory.createBinaryExpr('*', factory.createLiteral(2, '2'), factory.createLiteral(3, '3'));
            const expr = factory.createBinaryExpr('+', factory.createLiteral(1, '1'), nested);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.complexityScore).toBeGreaterThan(1);
            expect(result.optimizationData.nodeCount).toBe(5); // 1 + (2 * 3) = 5 nodes
        });
        it('should estimate execution cycles', () => {
            const expr = factory.createLiteral(42, '42');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.estimatedCycles).toBeGreaterThan(0);
        });
        it('should calculate expression depth', () => {
            // Create nested expression: 1 + (2 * (3 + 4))
            const innerNested = factory.createBinaryExpr('+', factory.createLiteral(3, '3'), factory.createLiteral(4, '4'));
            const middleNested = factory.createBinaryExpr('*', factory.createLiteral(2, '2'), innerNested);
            const expr = factory.createBinaryExpr('+', factory.createLiteral(1, '1'), middleNested);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.depth).toBe(4); // 1 + (2 * (3 + 4)) = depth 4
        });
    });
    // ============================================================================
    // 6502-SPECIFIC OPTIMIZATION TESTS
    // ============================================================================
    describe('6502 Optimization Hints', () => {
        it('should provide register allocation hints', () => {
            const expr = factory.createLiteral(42, '42');
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.registerPressure.preferredRegister).toBeDefined();
            expect(result.optimizationData.registerPressure.canUseZeroPage).toBeDefined();
            expect(result.optimizationData.sixtyTwoHints.addressingMode).toBeDefined();
        });
        it('should identify accumulator operations', () => {
            const left = factory.createLiteral(5, '5');
            const right = factory.createLiteral(10, '10');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.sixtyTwoHints.accumulatorOperation).toBeDefined();
        });
        it('should analyze memory bank preferences', () => {
            const expr = factory.createIdentifier('zpVar');
            // Set up zero page variable
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('zpVar', createPrimitiveType('byte'), globalScope, { line: 1, column: 1, offset: 0 }, { storageClass: 'zp' });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.optimizationData.sixtyTwoHints.memoryBankPreference).toBeDefined();
        });
    });
    // ============================================================================
    // STATEMENT ANALYSIS TESTS
    // ============================================================================
    describe('Statement Analysis', () => {
        it('should analyze expression statements', () => {
            const expr = factory.createLiteral(42, '42');
            const stmt = factory.createExpressionStatement(expr);
            const result = analyzer.analyzeStatement(stmt, context);
            expect(result.expressions).toHaveLength(1);
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.isTerminal).toBe(false);
        });
        it('should analyze if statements with control flow', () => {
            const condition = factory.createLiteral(true, 'true');
            const thenBody = [];
            const elseBody = [];
            const stmt = factory.createIfStatement(condition, thenBody, elseBody);
            const result = analyzer.analyzeStatement(stmt, context);
            expect(result.expressions).toHaveLength(1); // condition
            expect(result.controlFlow.hasControlFlow).toBe(true);
            expect(result.controlFlow.flowType).toBe('conditional');
            expect(result.optimizationData.conditionalExecution).toBe(true);
            expect(result.optimizationData.branchInstruction).toBe(true);
        });
        it('should analyze while statements', () => {
            const condition = factory.createIdentifier('flag');
            const body = [];
            const stmt = factory.createWhileStatement(condition, body);
            // Set up variable in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol = createVariableSymbol('flag', createPrimitiveType('boolean'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(varSymbol);
            const result = analyzer.analyzeStatement(stmt, context);
            expect(result.controlFlow.hasControlFlow).toBe(true);
            expect(result.controlFlow.flowType).toBe('loop');
            expect(result.optimizationData.loopStatement).toBe(true);
            expect(result.optimizationData.branchInstruction).toBe(true);
        });
        it('should analyze return statements', () => {
            const value = factory.createLiteral(42, '42');
            const stmt = factory.createReturnStatement(value);
            const result = analyzer.analyzeStatement(stmt, context);
            expect(result.expressions).toHaveLength(1); // return value
            expect(result.controlFlow.hasControlFlow).toBe(true);
            expect(result.controlFlow.flowType).toBe('return');
            expect(result.optimizationData.isTerminal).toBe(true);
            expect(result.optimizationData.jumpInstruction).toBe(true);
        });
        it('should detect constant conditions', () => {
            const condition = factory.createLiteral(true, 'true');
            const thenBody = [];
            const stmt = factory.createIfStatement(condition, thenBody);
            const result = analyzer.analyzeStatement(stmt, context);
            expect(result.optimizationData.constantCondition).toBe(true);
        });
    });
    describe('Block Analysis', () => {
        it('should analyze blocks of statements', () => {
            const statements = [
                factory.createExpressionStatement(factory.createLiteral(1, '1')),
                factory.createExpressionStatement(factory.createLiteral(2, '2')),
                factory.createExpressionStatement(factory.createLiteral(3, '3')),
            ];
            const result = analyzer.analyzeBlock(statements, context);
            expect(result.statements).toHaveLength(3);
            expect(result.blockOptimizationData.statementCount).toBe(3);
            expect(result.blockOptimizationData.expressionCount).toBe(3);
        });
        it('should aggregate variable accesses in blocks', () => {
            // Set up variables in symbol table
            const globalScope = symbolTable.getGlobalScope();
            const varSymbol1 = createVariableSymbol('var1', createPrimitiveType('byte'), globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            const varSymbol2 = createVariableSymbol('var2', createPrimitiveType('byte'), globalScope, {
                line: 2,
                column: 1,
                offset: 10,
            });
            symbolTable.declareSymbol(varSymbol1);
            symbolTable.declareSymbol(varSymbol2);
            const statements = [
                factory.createExpressionStatement(factory.createIdentifier('var1')),
                factory.createExpressionStatement(factory.createIdentifier('var2')),
                factory.createExpressionStatement(factory.createIdentifier('var1')), // var1 used twice
            ];
            const result = analyzer.analyzeBlock(statements, context);
            expect(result.blockOptimizationData.variableAccesses.length).toBeGreaterThan(0);
        });
        it('should calculate block performance metrics', () => {
            const statements = [
                factory.createExpressionStatement(factory.createLiteral(1, '1')),
                factory.createExpressionStatement(factory.createLiteral(2, '2')),
            ];
            const result = analyzer.analyzeBlock(statements, context);
            expect(result.blockOptimizationData.estimatedCycles).toBeGreaterThan(0);
            expect(result.blockOptimizationData.codeSize).toBeGreaterThan(0);
        });
    });
    // ============================================================================
    // LOOP CONTEXT TESTS
    // ============================================================================
    describe('Loop Context Analysis', () => {
        it('should identify loop invariant expressions in loop context', () => {
            const loopContext = createExpressionContext({
                loopDepth: 1,
                inHotPath: true,
            });
            const expr = factory.createLiteral(42, '42');
            const result = analyzer.analyzeExpression(expr, loopContext);
            expect(result.optimizationData.loopInvariant).toBe(true);
            expect(result.optimizationData.hotPathCandidate).toBe(true);
        });
        it('should adjust execution frequency based on loop depth', () => {
            const loopContext = createExpressionContext({
                loopDepth: 2,
                inHotPath: false,
            });
            const expr = factory.createLiteral(1, '1');
            const stmt = factory.createExpressionStatement(expr);
            const result = analyzer.analyzeStatement(stmt, loopContext);
            expect(result.optimizationData.executionFrequency).toBe('frequent');
        });
        it('should identify hot path expressions', () => {
            const hotPathContext = createExpressionContext({
                loopDepth: 1,
                inHotPath: true,
            });
            const expr = factory.createLiteral(1, '1');
            const stmt = factory.createExpressionStatement(expr);
            const result = analyzer.analyzeStatement(stmt, hotPathContext);
            expect(result.optimizationData.executionFrequency).toBe('hot');
            expect(result.optimizationData.hotPath).toBe(true);
        });
    });
    // ============================================================================
    // EDGE CASES AND ERROR HANDLING TESTS
    // ============================================================================
    describe('Edge Cases', () => {
        it('should handle unknown expression types gracefully', () => {
            const unknownExpr = {
                type: 'UnknownExpression',
                metadata: { start: { line: 1, column: 1, offset: 0 } },
            };
            const result = analyzer.analyzeExpression(unknownExpr, context);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].errorType).toBe('InvalidOperation');
        });
        it('should handle expressions with missing metadata', () => {
            const expr = factory.createLiteral(42, '42');
            expr.metadata = undefined;
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors).toHaveLength(0); // Should not crash
        });
        it('should accumulate multiple errors in complex expressions', () => {
            const left = factory.createIdentifier('undefinedVar1');
            const right = factory.createIdentifier('undefinedVar2');
            const expr = factory.createBinaryExpr('+', left, right);
            const result = analyzer.analyzeExpression(expr, context);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });
    describe('API Methods', () => {
        it('should provide access to errors and warnings', () => {
            const expr = factory.createIdentifier('undefinedVar');
            analyzer.analyzeExpression(expr, context);
            const errors = analyzer.getErrors();
            const warnings = analyzer.getWarnings();
            expect(errors).toHaveLength(1);
            expect(warnings).toHaveLength(0);
        });
        it('should clear errors and warnings', () => {
            const expr = factory.createIdentifier('undefinedVar');
            analyzer.analyzeExpression(expr, context);
            analyzer.clearErrors();
            expect(analyzer.getErrors()).toHaveLength(0);
            expect(analyzer.getWarnings()).toHaveLength(0);
        });
        it('should provide access to optimization metadata', () => {
            const expr = factory.createLiteral(42, '42');
            const result = analyzer.analyzeExpression(expr, context);
            const metadata = analyzer.getOptimizationMetadata(expr);
            expect(metadata).toBeDefined();
            expect(metadata?.isConstant).toBe(true);
        });
        it('should provide access to statement metadata', () => {
            const expr = factory.createLiteral(1, '1');
            const stmt = factory.createExpressionStatement(expr);
            const result = analyzer.analyzeStatement(stmt, context);
            const metadata = analyzer.getStatementMetadata(stmt);
            expect(metadata).toBeDefined();
            expect(metadata?.isTerminal).toBe(false);
        });
    });
    describe('Context Factory', () => {
        it('should create expression context with defaults', () => {
            const defaultContext = createExpressionContext();
            expect(defaultContext.loopDepth).toBe(0);
            expect(defaultContext.inHotPath).toBe(false);
            expect(defaultContext.hardwareContext).toBe('normal');
            expect(defaultContext.optimizationLevel).toBe('balanced');
        });
        it('should create expression context with custom options', () => {
            const customContext = createExpressionContext({
                loopDepth: 3,
                inHotPath: true,
                hardwareContext: 'interrupt_handler',
                optimizationLevel: 'aggressive',
            });
            expect(customContext.loopDepth).toBe(3);
            expect(customContext.inHotPath).toBe(true);
            expect(customContext.hardwareContext).toBe('interrupt_handler');
            expect(customContext.optimizationLevel).toBe('aggressive');
        });
    });
    // ============================================================================
    // INTEGRATION TESTS
    // ============================================================================
    describe('Integration Tests', () => {
        it('should analyze complete realistic expressions', () => {
            // Complex expression: arr[i] + (func(x, y) * 2)
            const globalScope = symbolTable.getGlobalScope();
            // Set up array variable
            const arrayType = createArrayType(createPrimitiveType('byte'), 100);
            const arrSymbol = createVariableSymbol('arr', arrayType, globalScope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(arrSymbol);
            // Set up index variable
            const iSymbol = createVariableSymbol('i', createPrimitiveType('byte'), globalScope, {
                line: 2,
                column: 1,
                offset: 10,
            });
            symbolTable.declareSymbol(iSymbol);
            // Set up function
            const funcSymbol = createFunctionSymbol('func', [
                { name: 'x', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
                { name: 'y', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
            ], createPrimitiveType('byte'), globalScope, { line: 3, column: 1, offset: 20 });
            symbolTable.declareSymbol(funcSymbol);
            // Set up variables x and y
            const xSymbol = createVariableSymbol('x', createPrimitiveType('byte'), globalScope, {
                line: 4,
                column: 1,
                offset: 30,
            });
            const ySymbol = createVariableSymbol('y', createPrimitiveType('byte'), globalScope, {
                line: 5,
                column: 1,
                offset: 40,
            });
            symbolTable.declareSymbol(xSymbol);
            symbolTable.declareSymbol(ySymbol);
            // Build expression: arr[i] + (func(x, y) * 2)
            const arrRef = factory.createIdentifier('arr');
            const iRef = factory.createIdentifier('i');
            const arrayAccess = factory.createIndexExpr(arrRef, iRef);
            const funcRef = factory.createIdentifier('func');
            const xRef = factory.createIdentifier('x');
            const yRef = factory.createIdentifier('y');
            const funcCall = factory.createCallExpr(funcRef, [xRef, yRef]);
            const two = factory.createLiteral(2, '2');
            const multiplication = factory.createBinaryExpr('*', funcCall, two);
            const finalExpression = factory.createBinaryExpr('+', arrayAccess, multiplication);
            const result = analyzer.analyzeExpression(finalExpression, context);
            expect(result.resolvedType).toEqual(createPrimitiveType('byte'));
            expect(result.errors).toHaveLength(0);
            expect(result.optimizationData.usedVariables.length).toBeGreaterThan(0);
            expect(result.optimizationData.hasNestedCalls).toBe(true);
            expect(result.optimizationData.hasComplexAddressing).toBe(true);
            expect(result.optimizationData.hasSideEffects).toBe(true);
            expect(result.optimizationData.complexityScore).toBeGreaterThan(5);
        });
        it('should handle mixed statement types in blocks', () => {
            // Set up variables
            const globalScope = symbolTable.getGlobalScope();
            const counterSymbol = createVariableSymbol('counter', createPrimitiveType('byte'), globalScope, { line: 1, column: 1, offset: 0 });
            const flagSymbol = createVariableSymbol('flag', createPrimitiveType('boolean'), globalScope, {
                line: 2,
                column: 1,
                offset: 10,
            });
            symbolTable.declareSymbol(counterSymbol);
            symbolTable.declareSymbol(flagSymbol);
            // Create mixed statements
            const statements = [
                // Assignment: counter = 0
                factory.createExpressionStatement(factory.createAssignmentExpr('=', factory.createIdentifier('counter'), factory.createLiteral(0, '0'))),
                // Conditional: if flag then
                factory.createIfStatement(factory.createIdentifier('flag'), [factory.createExpressionStatement(factory.createLiteral(1, '1'))], [factory.createExpressionStatement(factory.createLiteral(2, '2'))]),
                // Return statement
                factory.createReturnStatement(factory.createIdentifier('counter')),
            ];
            const result = analyzer.analyzeBlock(statements, context);
            expect(result.statements).toHaveLength(3);
            expect(result.errors).toHaveLength(0);
            expect(result.blockOptimizationData.variableAccesses.length).toBeGreaterThan(0);
            // Check individual statement analysis
            const assignmentResult = result.statements[0];
            expect(assignmentResult.optimizationData.isTerminal).toBe(false);
            const conditionalResult = result.statements[1];
            expect(conditionalResult.controlFlow.hasControlFlow).toBe(true);
            const returnResult = result.statements[2];
            expect(returnResult.optimizationData.isTerminal).toBe(true);
        });
    });
});
//# sourceMappingURL=expression-analyzer.test.js.map