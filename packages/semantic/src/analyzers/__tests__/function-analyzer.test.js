/**
 * Tests for Function Declaration Analysis
 * Task 1.5: Implement Function Declaration Analysis
 * Task 1.9: Enhanced Function Analysis with Optimization Metadata
 *
 * Comprehensive test suite covering:
 * - Basic function declaration validation
 * - Callback function declarations and assignments
 * - Function signature validation
 * - Parameter type checking
 * - Return type validation
 * - Function call validation
 * - Export handling
 * - Error detection and reporting
 * - Function optimization metadata collection (Task 1.9)
 * - Function inlining analysis
 * - Callback function optimization
 * - 6502-specific optimization hints
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FunctionAnalyzer } from '../function-analyzer.js';
import { SymbolTable } from '../../symbol-table.js';
import { TypeChecker } from '../../type-system.js';
import { createPrimitiveType, createCallbackType, createVariableSymbol } from '../../types.js';
describe('FunctionAnalyzer', () => {
    let symbolTable;
    let typeChecker;
    let analyzer;
    beforeEach(() => {
        symbolTable = new SymbolTable();
        typeChecker = new TypeChecker((name) => symbolTable.lookupSymbol(name));
        analyzer = new FunctionAnalyzer(symbolTable, typeChecker);
    });
    // Helper function to create test function declarations
    function createFunctionDecl(options) {
        return {
            type: 'FunctionDeclaration',
            name: options.name,
            params: options.params || [],
            returnType: options.returnType || {
                type: 'PrimitiveType',
                name: 'void',
                metadata: {
                    start: { line: 1, column: 1, offset: 0 },
                    end: { line: 1, column: 4, offset: 3 },
                },
            },
            body: [],
            callback: options.callback || false,
            exported: options.exported || false,
            metadata: {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
            },
        };
    }
    // Helper function to create test parameters
    function createParam(name, type, hasDefault = false) {
        return {
            type: 'Parameter',
            name,
            paramType: {
                type: 'PrimitiveType',
                name: type,
                metadata: {
                    start: { line: 1, column: 1, offset: 0 },
                    end: { line: 1, column: 4, offset: 3 },
                },
            },
            optional: hasDefault,
            defaultValue: hasDefault
                ? {
                    type: 'Literal',
                    value: type === 'boolean' ? true : 0,
                    raw: type === 'boolean' ? 'true' : '0',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 1, offset: 0 },
                    },
                }
                : null,
            metadata: {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
            },
        };
    }
    // Helper function to create literal expressions
    function createLiteral(value) {
        return {
            type: 'Literal',
            value,
            raw: value.toString(),
            metadata: {
                start: { line: 1, column: 1, offset: 0 },
                end: { line: 1, column: 1, offset: 0 },
            },
        };
    }
    describe('Basic Function Declaration Analysis', () => {
        it('should analyze simple function declaration', () => {
            const funcDecl = createFunctionDecl({
                name: 'test',
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('test');
                expect(result.data.symbolType).toBe('Function');
                expect(result.data.parameters).toHaveLength(0);
                expect(result.data.returnType.kind).toBe('primitive');
                expect(result.data.returnType.name).toBe('void');
                expect(result.data.isCallback).toBe(false);
                expect(result.data.isExported).toBe(false);
            }
        });
        it('should analyze function with parameters', () => {
            const funcDecl = createFunctionDecl({
                name: 'add',
                params: [createParam('a', 'byte'), createParam('b', 'byte')],
                returnType: {
                    type: 'PrimitiveType',
                    name: 'byte',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.parameters).toHaveLength(2);
                expect(result.data.parameters[0].name).toBe('a');
                expect(result.data.parameters[0].type.kind).toBe('primitive');
                expect(result.data.parameters[0].type.name).toBe('byte');
                expect(result.data.parameters[1].name).toBe('b');
                expect(result.data.returnType.name).toBe('byte');
            }
        });
        it('should analyze exported function', () => {
            const funcDecl = createFunctionDecl({
                name: 'publicFunction',
                exported: true,
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isExported).toBe(true);
            }
        });
        it('should detect duplicate function declarations', () => {
            // First declaration
            const funcDecl1 = createFunctionDecl({ name: 'duplicate' });
            const result1 = analyzer.analyzeFunctionDeclaration(funcDecl1, 'Global');
            expect(result1.success).toBe(true);
            // Second declaration (duplicate)
            const funcDecl2 = createFunctionDecl({ name: 'duplicate' });
            const result2 = analyzer.analyzeFunctionDeclaration(funcDecl2, 'Global');
            expect(result2.success).toBe(false);
            if (!result2.success) {
                expect(result2.errors[0].errorType).toBe('DuplicateSymbol');
                expect(result2.errors[0].message).toContain('already declared');
            }
        });
        it('should detect duplicate parameter names', () => {
            const funcDecl = createFunctionDecl({
                name: 'badParams',
                params: [
                    createParam('x', 'byte'),
                    createParam('x', 'byte'), // Duplicate parameter name
                ],
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('DuplicateSymbol');
                expect(result.errors[0].message).toContain('used multiple times');
            }
        });
    });
    describe('Callback Function Analysis', () => {
        it('should analyze basic callback function', () => {
            const funcDecl = createFunctionDecl({
                name: 'irqHandler',
                callback: true,
                returnType: {
                    type: 'PrimitiveType',
                    name: 'void',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isCallback).toBe(true);
                expect(result.data.name).toBe('irqHandler');
            }
        });
        it('should analyze callback function with simple parameters', () => {
            const funcDecl = createFunctionDecl({
                name: 'simpleCallback',
                callback: true,
                params: [createParam('x', 'byte'), createParam('y', 'byte')],
                returnType: {
                    type: 'PrimitiveType',
                    name: 'boolean',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 7, offset: 6 },
                    },
                },
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isCallback).toBe(true);
                expect(result.data.parameters).toHaveLength(2);
            }
        });
        it('should reject callback function with too many parameters', () => {
            const funcDecl = createFunctionDecl({
                name: 'tooManyParams',
                callback: true,
                params: [
                    createParam('a', 'byte'),
                    createParam('b', 'byte'),
                    createParam('c', 'byte'),
                    createParam('d', 'byte'),
                    createParam('e', 'byte'), // 5 parameters - too many for callback
                ],
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('CallbackMismatch');
                expect(result.errors[0].message).toContain('4 or fewer parameters');
            }
        });
        it('should warn about complex callback parameter types', () => {
            // This would need to be tested with array types, but we need to create proper TypeAnnotation
            const funcDecl = createFunctionDecl({
                name: 'complexCallback',
                callback: true,
                params: [
                    {
                        type: 'Parameter',
                        name: 'buffer',
                        paramType: {
                            type: 'ArrayType',
                            elementType: {
                                type: 'PrimitiveType',
                                name: 'byte',
                                metadata: {
                                    start: { line: 1, column: 1, offset: 0 },
                                    end: { line: 1, column: 4, offset: 3 },
                                },
                            },
                            size: {
                                type: 'Literal',
                                value: 10,
                                raw: '10',
                                metadata: {
                                    start: { line: 1, column: 1, offset: 0 },
                                    end: { line: 1, column: 1, offset: 0 },
                                },
                            },
                            metadata: {
                                start: { line: 1, column: 1, offset: 0 },
                                end: { line: 1, column: 1, offset: 0 },
                            },
                        },
                        optional: false,
                        defaultValue: null,
                        metadata: {
                            start: { line: 1, column: 1, offset: 0 },
                            end: { line: 1, column: 1, offset: 0 },
                        },
                    },
                ],
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors.some((e) => e.errorType === 'CallbackMismatch')).toBe(true);
            }
        });
    });
    describe('Callback Assignment Validation', () => {
        it('should validate valid callback assignment', () => {
            // First create a callback function
            const callbackDecl = createFunctionDecl({
                name: 'handler',
                callback: true,
                params: [createParam('value', 'byte')],
                returnType: {
                    type: 'PrimitiveType',
                    name: 'void',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(callbackDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const callbackFunction = funcResult.data;
                const callbackType = createCallbackType([createPrimitiveType('byte')], createPrimitiveType('void'));
                const assignmentResult = analyzer.validateCallbackAssignment(callbackType, callbackFunction, { line: 1, column: 1, offset: 0 });
                expect(assignmentResult.success).toBe(true);
            }
        });
        it('should reject assignment of regular function to callback variable', () => {
            // Create a regular (non-callback) function
            const regularDecl = createFunctionDecl({
                name: 'regularFunc',
                callback: false,
                params: [createParam('x', 'byte')],
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(regularDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const regularFunction = funcResult.data;
                const callbackType = createCallbackType([createPrimitiveType('byte')], createPrimitiveType('void'));
                const assignmentResult = analyzer.validateCallbackAssignment(callbackType, regularFunction, { line: 1, column: 1, offset: 0 });
                expect(assignmentResult.success).toBe(false);
                if (!assignmentResult.success) {
                    expect(assignmentResult.errors[0].errorType).toBe('CallbackMismatch');
                    expect(assignmentResult.errors[0].message).toContain('Only callback functions can be assigned');
                }
            }
        });
        it('should reject callback assignment with signature mismatch', () => {
            // Create callback function with wrong signature
            const callbackDecl = createFunctionDecl({
                name: 'wrongSignature',
                callback: true,
                params: [createParam('x', 'word')], // word instead of byte
                returnType: {
                    type: 'PrimitiveType',
                    name: 'void',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(callbackDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const callbackFunction = funcResult.data;
                const expectedCallbackType = createCallbackType([createPrimitiveType('byte')], // Expects byte
                createPrimitiveType('void'));
                const assignmentResult = analyzer.validateCallbackAssignment(expectedCallbackType, callbackFunction, { line: 1, column: 1, offset: 0 });
                expect(assignmentResult.success).toBe(false);
                if (!assignmentResult.success) {
                    expect(assignmentResult.errors[0].errorType).toBe('CallbackMismatch');
                    expect(assignmentResult.errors[0].message).toContain('signature does not match');
                }
            }
        });
        it('should reject assignment to non-callback type', () => {
            const callbackDecl = createFunctionDecl({
                name: 'validCallback',
                callback: true,
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(callbackDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const callbackFunction = funcResult.data;
                const nonCallbackType = createPrimitiveType('byte'); // Not a callback type
                const assignmentResult = analyzer.validateCallbackAssignment(nonCallbackType, callbackFunction, { line: 1, column: 1, offset: 0 });
                expect(assignmentResult.success).toBe(false);
                if (!assignmentResult.success) {
                    expect(assignmentResult.errors[0].errorType).toBe('CallbackMismatch');
                    expect(assignmentResult.errors[0].message).toContain('non-callback type');
                }
            }
        });
    });
    describe('Function Call Validation', () => {
        it('should validate function call with correct arguments', () => {
            // Create function to call
            const funcDecl = createFunctionDecl({
                name: 'multiply',
                params: [createParam('a', 'byte'), createParam('b', 'byte')],
                returnType: {
                    type: 'PrimitiveType',
                    name: 'byte',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const functionSymbol = funcResult.data;
                // Create arguments
                const args = [createLiteral(5), createLiteral(10)];
                const callResult = analyzer.validateFunctionCall(functionSymbol, args, {
                    line: 1,
                    column: 1,
                    offset: 0,
                });
                expect(callResult.success).toBe(true);
                if (callResult.success) {
                    expect(callResult.data.kind).toBe('primitive');
                    expect(callResult.data.name).toBe('byte');
                }
            }
        });
        it('should reject function call with wrong argument count', () => {
            const funcDecl = createFunctionDecl({
                name: 'needsTwoArgs',
                params: [createParam('a', 'byte'), createParam('b', 'byte')],
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const functionSymbol = funcResult.data;
                // Only provide one argument
                const args = [createLiteral(5)];
                const callResult = analyzer.validateFunctionCall(functionSymbol, args, {
                    line: 1,
                    column: 1,
                    offset: 0,
                });
                expect(callResult.success).toBe(false);
                if (!callResult.success) {
                    expect(callResult.errors[0].errorType).toBe('TypeMismatch');
                    expect(callResult.errors[0].message).toContain('expects 2 arguments, got 1');
                }
            }
        });
        it('should handle functions with optional parameters', () => {
            const funcDecl = createFunctionDecl({
                name: 'withDefault',
                params: [
                    createParam('required', 'byte'),
                    createParam('optional', 'byte', true), // Has default value
                ],
            });
            const funcResult = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(funcResult.success).toBe(true);
            if (funcResult.success) {
                const functionSymbol = funcResult.data;
                // Call with only required argument
                const args = [createLiteral(5)];
                const callResult = analyzer.validateFunctionCall(functionSymbol, args, {
                    line: 1,
                    column: 1,
                    offset: 0,
                });
                expect(callResult.success).toBe(true);
            }
        });
    });
    describe('Callback Function Call Validation', () => {
        it('should validate callback call through variable', () => {
            // Create a callback variable
            const scope = symbolTable.getCurrentScope();
            const callbackType = createCallbackType([createPrimitiveType('byte')], createPrimitiveType('word'));
            const callbackVar = createVariableSymbol('handler', callbackType, scope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            const varResult = symbolTable.declareSymbol(callbackVar);
            expect(varResult.success).toBe(true);
            // Test callback call
            const args = [createLiteral(42)];
            const callResult = analyzer.validateCallbackCall(callbackVar, args, {
                line: 1,
                column: 1,
                offset: 0,
            });
            expect(callResult.success).toBe(true);
            if (callResult.success) {
                expect(callResult.data.kind).toBe('primitive');
                expect(callResult.data.name).toBe('word');
            }
        });
        it('should reject callback call on non-callback variable', () => {
            // Create a regular variable
            const scope = symbolTable.getCurrentScope();
            const regularVar = createVariableSymbol('notCallback', createPrimitiveType('byte'), scope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            const varResult = symbolTable.declareSymbol(regularVar);
            expect(varResult.success).toBe(true);
            const args = [];
            const callResult = analyzer.validateCallbackCall(regularVar, args, {
                line: 1,
                column: 1,
                offset: 0,
            });
            expect(callResult.success).toBe(false);
            if (!callResult.success) {
                expect(callResult.errors[0].errorType).toBe('CallbackMismatch');
                expect(callResult.errors[0].message).toContain('Cannot call variable');
            }
        });
        it('should reject callback call with wrong argument count', () => {
            const scope = symbolTable.getCurrentScope();
            const callbackType = createCallbackType([createPrimitiveType('byte'), createPrimitiveType('byte')], // Expects 2 args
            createPrimitiveType('void'));
            const callbackVar = createVariableSymbol('twoArgCallback', callbackType, scope, {
                line: 1,
                column: 1,
                offset: 0,
            });
            symbolTable.declareSymbol(callbackVar);
            // Provide only one argument
            const args = [createLiteral(42)];
            const callResult = analyzer.validateCallbackCall(callbackVar, args, {
                line: 1,
                column: 1,
                offset: 0,
            });
            expect(callResult.success).toBe(false);
            if (!callResult.success) {
                expect(callResult.errors[0].errorType).toBe('TypeMismatch');
                expect(callResult.errors[0].message).toContain('expects 2 arguments, got 1');
            }
        });
    });
    describe('Export and Scope Validation', () => {
        it('should allow function export at global scope', () => {
            const funcDecl = createFunctionDecl({
                name: 'exportedFunc',
                exported: true,
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.isExported).toBe(true);
            }
        });
        it('should reject function export at non-global scope', () => {
            const funcDecl = createFunctionDecl({
                name: 'localExported',
                exported: true,
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Function'); // Not global
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('InvalidScope');
                expect(result.errors[0].message).toContain('only be exported at module scope');
            }
        });
        it('should reject empty function names', () => {
            const funcDecl = createFunctionDecl({
                name: '', // Empty name
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('InvalidOperation');
                expect(result.errors[0].message).toContain('cannot be empty');
            }
        });
    });
    // ============================================================================
    // TASK 1.9: FUNCTION OPTIMIZATION METADATA TESTS
    // ============================================================================
    describe('Function Optimization Metadata Collection', () => {
        beforeEach(() => {
            // Create test functions for optimization analysis
            const smallFunc = createFunctionDecl({
                name: 'smallFunction',
                params: [createParam('x', 'byte')],
            });
            const largeFunc = createFunctionDecl({
                name: 'largeFunction',
                params: [
                    createParam('a', 'byte'),
                    createParam('b', 'byte'),
                    createParam('c', 'byte'),
                    createParam('d', 'byte'),
                    createParam('e', 'byte'),
                ],
            });
            const callbackFunc = createFunctionDecl({
                name: 'interruptHandler',
                callback: true,
                params: [createParam('x', 'byte')],
            });
            analyzer.analyzeFunctionDeclaration(smallFunc, 'Global');
            analyzer.analyzeFunctionDeclaration(largeFunc, 'Global');
            analyzer.analyzeFunctionDeclaration(callbackFunc, 'Global');
        });
        describe('Function Call Metadata Collection', () => {
            it('should collect function call metadata', () => {
                const functions = [
                    symbolTable.lookupSymbol('smallFunction'),
                    symbolTable.lookupSymbol('largeFunction'),
                ].filter(Boolean);
                const callMetadata = analyzer.collectFunctionCallMetadata(functions);
                expect(callMetadata).toBeTruthy();
                expect(callMetadata.size).toBe(2);
                const smallFuncData = callMetadata.get('smallFunction');
                expect(smallFuncData).toBeTruthy();
                expect(smallFuncData.callCount).toBe(0); // No actual calls analyzed yet
                expect(smallFuncData.callFrequency).toBe('never');
                expect(smallFuncData.callSites).toEqual([]);
            });
        });
        describe('Function Inlining Analysis', () => {
            it('should identify small functions as inlining candidates', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const functions = [smallFunc].filter(Boolean);
                const candidates = analyzer.analyzeFunctionInliningCandidates(functions);
                expect(candidates).toBeTruthy();
                expect(candidates.length).toBe(1);
                const candidate = candidates[0];
                expect(candidate.isCandidate).toBe(true);
                expect(candidate.inliningScore).toBeGreaterThan(0);
                expect(candidate.complexityMetrics).toBeTruthy();
                expect(candidate.recommendation).toBe('strongly_recommended');
                expect(candidate.inliningFactors.length).toBeGreaterThan(0);
            });
            it('should reject large functions for inlining', () => {
                const largeFunc = symbolTable.lookupSymbol('largeFunction');
                const inliningAnalysis = analyzer.buildFunctionOptimizationMetadata(largeFunc);
                expect(inliningAnalysis.inliningCandidate).toBeTruthy();
                expect(inliningAnalysis.inliningCandidate.isCandidate).toBe(false);
                expect(inliningAnalysis.inliningCandidate.antiInliningFactors.length).toBeGreaterThan(0);
                // Should have penalty for many parameters or large function
                const antiInliningFactors = inliningAnalysis.inliningCandidate.antiInliningFactors.filter((factor) => factor.factor === 'large_function' ||
                    factor.factor === 'many_parameters' ||
                    factor.description.includes('large') ||
                    factor.description.includes('parameters'));
                expect(antiInliningFactors.length).toBeGreaterThan(0);
            });
            it('should include complexity metrics in inlining analysis', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const inliningAnalysis = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const metrics = inliningAnalysis.inliningCandidate.complexityMetrics;
                expect(metrics.astNodeCount).toBeGreaterThan(0);
                expect(metrics.estimatedCodeSize).toBeGreaterThan(0);
                expect(metrics.cyclomaticComplexity).toBeGreaterThan(0);
                expect(typeof metrics.hasLoops).toBe('boolean');
                expect(typeof metrics.hasComplexControlFlow).toBe('boolean');
            });
        });
        describe('Callback Function Optimization', () => {
            it('should analyze callback functions for optimization opportunities', () => {
                const callbackFunc = symbolTable.lookupSymbol('interruptHandler');
                const functions = [callbackFunc].filter(Boolean);
                const optimizations = analyzer.analyzeCallbackOptimization(functions);
                expect(optimizations).toBeTruthy();
                expect(optimizations.length).toBe(1);
                const optimization = optimizations[0];
                expect(optimization.isCallbackFunction).toBe(true);
                expect(optimization.callbackUsage).toBeTruthy();
                expect(optimization.performanceAnalysis).toBeTruthy();
                expect(optimization.performanceAnalysis.indirectCallOverhead).toBeGreaterThan(0);
                expect(optimization.optimizationOpportunities.length).toBeGreaterThan(0);
            });
            it('should provide interrupt handler specific optimizations', () => {
                const callbackFunc = symbolTable.lookupSymbol('interruptHandler');
                const optimization = analyzer.buildFunctionOptimizationMetadata(callbackFunc);
                const interruptOpt = optimization.callbackOptimization.interruptOptimization;
                expect(interruptOpt).toBeTruthy();
                expect(interruptOpt.interruptType).toBeTruthy();
                expect(interruptOpt.registerPreservation).toBeTruthy();
                expect(interruptOpt.registerPreservation.registersToPreserve.length).toBeGreaterThan(0);
                expect(interruptOpt.timingConstraints).toBeTruthy();
                expect(interruptOpt.timingConstraints.maxExecutionTime).toBeGreaterThan(0);
            });
        });
        describe('Function Call Optimization Analysis', () => {
            it('should analyze function calling conventions', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const largeFunc = symbolTable.lookupSymbol('largeFunction');
                const functions = [smallFunc, largeFunc].filter(Boolean);
                const callOptimization = analyzer.analyzeFunctionCallOptimization(functions);
                expect(callOptimization.optimizations).toBeTruthy();
                expect(callOptimization.optimizations.length).toBe(2);
                expect(callOptimization.globalOptimizations).toBeTruthy();
            });
            it('should optimize parameter passing for simple functions', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const paramOpt = optimization.callOptimization.parameterOptimization;
                expect(paramOpt.parameterCount).toBe(1);
                expect(paramOpt.registerParameters.length).toBe(1); // Byte parameter should go in register
                expect(paramOpt.stackParameters.length).toBe(0);
                expect(paramOpt.passingCost.totalCycles).toBeLessThan(5); // Should be efficient
                expect(paramOpt.passingCost.isEfficient).toBe(true);
            });
            it('should use stack for functions with many parameters', () => {
                const largeFunc = symbolTable.lookupSymbol('largeFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(largeFunc);
                const paramOpt = optimization.callOptimization.parameterOptimization;
                expect(paramOpt.parameterCount).toBe(5);
                expect(paramOpt.registerParameters.length).toBe(2); // Only first 2 in registers
                expect(paramOpt.stackParameters.length).toBe(3); // Rest on stack
                expect(paramOpt.passingCost.totalCycles).toBeGreaterThan(10); // Less efficient
                expect(paramOpt.passingCost.isEfficient).toBe(false);
            });
        });
        describe('6502-Specific Optimization Hints', () => {
            it('should generate 6502-specific optimization hints', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const hints = optimization.sixtyTwoHints;
                expect(hints.zeroPageOptimization).toBeTruthy();
                expect(hints.zeroPageOptimization.benefitsFromZeroPage).toBe(true); // Small function with few params
                expect(hints.registerStrategy).toBeTruthy();
                expect(hints.registerStrategy.strategy).toBe('balanced');
                expect(hints.memoryLayout).toBeTruthy();
                expect(hints.performanceCharacteristics).toBeTruthy();
                expect(hints.optimizationOpportunities.length).toBeGreaterThan(0);
            });
            it('should provide register allocation recommendations', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const registerStrategy = optimization.sixtyTwoHints.registerStrategy;
                expect(registerStrategy.registerAssignments.length).toBeGreaterThan(0);
                const assignment = registerStrategy.registerAssignments[0];
                expect(assignment.register).toBe('A'); // First parameter should go in A
                expect(assignment.purpose).toBe('parameter');
                expect(assignment.variable).toBe('x'); // Parameter name
                expect(assignment.benefit).toBeGreaterThan(0);
            });
        });
        describe('Function Performance Profile', () => {
            it('should create comprehensive performance profiles', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const profile = optimization.performanceProfile;
                // Execution statistics
                expect(profile.executionStats).toBeTruthy();
                expect(profile.executionStats.estimatedCycles).toBeGreaterThan(0);
                expect(profile.executionStats.callFrequency).toBe('occasional');
                expect(profile.executionStats.executionTimeDistribution).toBeTruthy();
                expect(profile.executionStats.performanceVariability.variability).toBe('low');
                // Resource usage
                expect(profile.resourceUsage).toBeTruthy();
                expect(profile.resourceUsage.registerUsage).toBeTruthy();
                expect(profile.resourceUsage.memoryUsage).toBeTruthy();
                expect(profile.resourceUsage.stackUsage).toBeTruthy();
                expect(profile.resourceUsage.zeroPageUsage).toBeTruthy();
                // Performance metrics
                expect(profile.performanceMetrics).toBeTruthy();
                expect(profile.performanceMetrics.cyclesPerCall).toBeGreaterThan(0);
                expect(profile.performanceMetrics.instructionsPerCall).toBeGreaterThan(0);
                expect(profile.performanceMetrics.efficiencyRating).toBe('good');
                // Optimization recommendations
                expect(profile.optimizationRecommendations).toBeTruthy();
                expect(profile.optimizationRecommendations.length).toBeGreaterThan(0);
                const recommendation = profile.optimizationRecommendations[0];
                expect(recommendation.recommendation).toBe('optimize_registers');
                expect(recommendation.priority).toBe('medium');
                expect(recommendation.estimatedBenefit).toBeGreaterThan(0);
            });
            it('should provide different profiles for different function types', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const largeFunc = symbolTable.lookupSymbol('largeFunction');
                const smallOpt = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const largeOpt = analyzer.buildFunctionOptimizationMetadata(largeFunc);
                // Small function should be more efficient
                expect(smallOpt.performanceProfile.performanceMetrics.cyclesPerCall).toBeLessThan(largeOpt.performanceProfile.performanceMetrics.cyclesPerCall);
                // Large function should use more stack space
                expect(largeOpt.performanceProfile.resourceUsage.stackUsage.maxStackDepth).toBeGreaterThan(smallOpt.performanceProfile.resourceUsage.stackUsage.maxStackDepth);
            });
        });
        describe('Comprehensive Function Optimization Integration', () => {
            it('should build complete optimization metadata', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const optimization = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                // Verify all major components are present
                expect(optimization.callStatistics).toBeTruthy();
                expect(optimization.inliningCandidate).toBeTruthy();
                expect(optimization.callOptimization).toBeTruthy();
                expect(optimization.callbackOptimization).toBeTruthy();
                expect(optimization.sixtyTwoHints).toBeTruthy();
                expect(optimization.performanceProfile).toBeTruthy();
                // Verify integration between components
                expect(optimization.inliningCandidate.isCandidate).toBe(true); // Small function
                expect(optimization.sixtyTwoHints.zeroPageOptimization.benefitsFromZeroPage).toBe(true);
                expect(optimization.callOptimization.parameterOptimization.passingCost.isEfficient).toBe(true);
            });
            it('should provide consistent optimization recommendations', () => {
                const smallFunc = symbolTable.lookupSymbol('smallFunction');
                const callbackFunc = symbolTable.lookupSymbol('interruptHandler');
                const smallOpt = analyzer.buildFunctionOptimizationMetadata(smallFunc);
                const callbackOpt = analyzer.buildFunctionOptimizationMetadata(callbackFunc);
                // Small regular function should be inlining candidate
                expect(smallOpt.inliningCandidate.isCandidate).toBe(true);
                expect(smallOpt.inliningCandidate.recommendation).toBe('strongly_recommended');
                // Callback function should not be inlining candidate
                expect(callbackOpt.inliningCandidate.isCandidate).toBe(false);
                expect(callbackOpt.inliningCandidate.antiInliningFactors.some((f) => f.factor === 'callback_function')).toBe(true);
                // But callback should have specific callback optimizations
                expect(callbackOpt.callbackOptimization.isCallbackFunction).toBe(true);
                expect(callbackOpt.callbackOptimization.optimizationOpportunities.length).toBeGreaterThan(0);
            });
        });
        describe('Enhanced Analysis Statistics with Optimization Data', () => {
            it('should include optimization statistics in analysis results', () => {
                const stats = analyzer.getAnalysisStatistics();
                // Verify enhanced statistics are present
                expect(typeof stats.optimizationCandidates).toBe('number');
                expect(typeof stats.inliningCandidates).toBe('number');
                // Should have some optimization candidates from our test functions
                expect(stats.optimizationCandidates).toBeGreaterThan(0);
                expect(stats.inliningCandidates).toBeGreaterThan(0);
                // Inlining candidates should be subset of optimization candidates
                expect(stats.inliningCandidates).toBeLessThanOrEqual(stats.optimizationCandidates);
            });
        });
    });
    describe('Analysis Statistics', () => {
        it('should provide accurate analysis statistics', () => {
            // Create several functions
            const regularFunc = createFunctionDecl({ name: 'regular' });
            const callbackFunc = createFunctionDecl({
                name: 'callback',
                callback: true,
                params: [createParam('x', 'byte')],
            });
            const exportedFunc = createFunctionDecl({
                name: 'exported',
                exported: true,
                returnType: {
                    type: 'PrimitiveType',
                    name: 'byte',
                    metadata: {
                        start: { line: 1, column: 1, offset: 0 },
                        end: { line: 1, column: 4, offset: 3 },
                    },
                },
            });
            analyzer.analyzeFunctionDeclaration(regularFunc, 'Global');
            analyzer.analyzeFunctionDeclaration(callbackFunc, 'Global');
            analyzer.analyzeFunctionDeclaration(exportedFunc, 'Global');
            const stats = analyzer.getAnalysisStatistics();
            expect(stats.functionsAnalyzed).toBe(3);
            expect(stats.callbackFunctions).toBe(1);
            expect(stats.exportedFunctions).toBe(1);
            expect(stats.averageParameterCount).toBeCloseTo(1 / 3); // Only callback has parameter
            expect(stats.functionsByReturnType['void']).toBe(2);
            expect(stats.functionsByReturnType['byte']).toBe(1);
            // Task 1.9: Check optimization statistics
            expect(stats.optimizationCandidates).toBeGreaterThan(0);
            expect(stats.inliningCandidates).toBeGreaterThan(0);
        });
    });
    describe('Integration with Existing Infrastructure', () => {
        it('should work with symbol table lookup', () => {
            // Create and register a function
            const funcDecl = createFunctionDecl({ name: 'lookupTest' });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(true);
            // Verify it can be looked up
            const symbol = symbolTable.lookupSymbol('lookupTest');
            expect(symbol).toBeTruthy();
            expect(symbol?.symbolType).toBe('Function');
            expect(symbol?.name).toBe('lookupTest');
        });
        it('should integrate with type checker for parameter validation', () => {
            // This test verifies that the function analyzer properly uses the TypeChecker
            const funcDecl = createFunctionDecl({
                name: 'typeTest',
                params: [
                    createParam('valid', 'byte'),
                    {
                        type: 'Parameter',
                        name: 'invalid',
                        paramType: {
                            type: 'ArrayType',
                            elementType: {
                                type: 'PrimitiveType',
                                name: 'byte',
                                metadata: {
                                    start: { line: 1, column: 1, offset: 0 },
                                    end: { line: 1, column: 4, offset: 3 },
                                },
                            },
                            size: {
                                type: 'Literal',
                                value: -1, // Invalid array size
                                raw: '-1',
                                metadata: {
                                    start: { line: 1, column: 1, offset: 0 },
                                    end: { line: 1, column: 1, offset: 0 },
                                },
                            },
                            metadata: {
                                start: { line: 1, column: 1, offset: 0 },
                                end: { line: 1, column: 1, offset: 0 },
                            },
                        },
                        optional: false,
                        defaultValue: null,
                        metadata: {
                            start: { line: 1, column: 1, offset: 0 },
                            end: { line: 1, column: 1, offset: 0 },
                        },
                    },
                ],
            });
            const result = analyzer.analyzeFunctionDeclaration(funcDecl, 'Global');
            expect(result.success).toBe(false);
            if (!result.success) {
                // Should get error from TypeChecker about invalid array size
                expect(result.errors.some((e) => e.errorType === 'ConstantRequired')).toBe(true);
            }
        });
    });
});
//# sourceMappingURL=function-analyzer.test.js.map