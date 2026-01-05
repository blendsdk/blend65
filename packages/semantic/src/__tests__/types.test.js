/**
 * Comprehensive Test Suite for Semantic Analysis Infrastructure
 * Task 1.1: Create Semantic Analysis Infrastructure - Tests
 *
 * This file thoroughly tests all the foundational types and functions
 * we've built for the Blend65 semantic analyzer.
 *
 * Educational Focus:
 * - Test-driven development for compilers
 * - Type system validation
 * - Error handling verification
 * - Symbol and scope management testing
 */
import { describe, it, expect } from 'vitest';
import { // Type guards
isVariableSymbol, isFunctionSymbol, isModuleSymbol, isPrimitiveType, isArrayType, isNamedType, isCallbackType, // Factory functions
createPrimitiveType, createArrayType, createNamedType, createCallbackType, createVariableSymbol, createFunctionSymbol, createModuleSymbol, createScope, // Type compatibility functions
isAssignmentCompatible, areTypesEqual, areCallbackTypesCompatible, typeToString, validateStorageClassUsage, } from '../types.js';
// ============================================================================
// TEST HELPERS
// ============================================================================
/**
 * Create a test source position
 */
function createTestLocation(line = 1, column = 1) {
    return { line, column, offset: (line - 1) * 80 + column };
}
/**
 * Create a test scope hierarchy
 */
function createTestScopes() {
    const globalScope = createScope('Global', null, 'global');
    const moduleScope = createScope('Module', globalScope, 'TestModule');
    const functionScope = createScope('Function', moduleScope, 'testFunction');
    globalScope.children.push(moduleScope);
    moduleScope.children.push(functionScope);
    return { globalScope, moduleScope, functionScope };
}
// ============================================================================
// PHASE 1: PRIMITIVE TYPE FACTORY TESTS
// ============================================================================
describe('Type Factory Functions', () => {
    describe('createPrimitiveType', () => {
        it('should create byte type', () => {
            const byteType = createPrimitiveType('byte');
            expect(byteType).toEqual({
                kind: 'primitive',
                name: 'byte',
            });
        });
        it('should create word type', () => {
            const wordType = createPrimitiveType('word');
            expect(wordType).toEqual({
                kind: 'primitive',
                name: 'word',
            });
        });
        it('should create boolean type', () => {
            const boolType = createPrimitiveType('boolean');
            expect(boolType).toEqual({
                kind: 'primitive',
                name: 'boolean',
            });
        });
        it('should create void type', () => {
            const voidType = createPrimitiveType('void');
            expect(voidType).toEqual({
                kind: 'primitive',
                name: 'void',
            });
        });
        it('should create callback primitive type', () => {
            const callbackType = createPrimitiveType('callback');
            expect(callbackType).toEqual({
                kind: 'primitive',
                name: 'callback',
            });
        });
    });
    describe('createArrayType', () => {
        it('should create byte array type', () => {
            const elementType = createPrimitiveType('byte');
            const arrayType = createArrayType(elementType, 256);
            expect(arrayType).toEqual({
                kind: 'array',
                elementType: { kind: 'primitive', name: 'byte' },
                size: 256,
            });
        });
        it('should create nested array type', () => {
            const byteType = createPrimitiveType('byte');
            const innerArray = createArrayType(byteType, 10);
            const outerArray = createArrayType(innerArray, 5);
            expect(outerArray).toEqual({
                kind: 'array',
                elementType: {
                    kind: 'array',
                    elementType: { kind: 'primitive', name: 'byte' },
                    size: 10,
                },
                size: 5,
            });
        });
    });
    describe('createNamedType', () => {
        it('should create named type reference', () => {
            const namedType = createNamedType('Player');
            expect(namedType).toEqual({
                kind: 'named',
                name: 'Player',
            });
        });
    });
    describe('createCallbackType', () => {
        it('should create callback type with no parameters', () => {
            const voidType = createPrimitiveType('void');
            const callbackType = createCallbackType([], voidType);
            expect(callbackType).toEqual({
                kind: 'callback',
                parameterTypes: [],
                returnType: { kind: 'primitive', name: 'void' },
            });
        });
        it('should create callback type with parameters', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const callbackType = createCallbackType([byteType, byteType], wordType);
            expect(callbackType).toEqual({
                kind: 'callback',
                parameterTypes: [
                    { kind: 'primitive', name: 'byte' },
                    { kind: 'primitive', name: 'byte' },
                ],
                returnType: { kind: 'primitive', name: 'word' },
            });
        });
    });
});
// ============================================================================
// PHASE 2: TYPE GUARD TESTS
// ============================================================================
describe('Type Guard Functions', () => {
    describe('Blend65 Type Guards', () => {
        it('should correctly identify primitive types', () => {
            const byteType = createPrimitiveType('byte');
            const arrayType = createArrayType(byteType, 10);
            const namedType = createNamedType('TestType');
            const callbackType = createCallbackType([], byteType);
            expect(isPrimitiveType(byteType)).toBe(true);
            expect(isPrimitiveType(arrayType)).toBe(false);
            expect(isPrimitiveType(namedType)).toBe(false);
            expect(isPrimitiveType(callbackType)).toBe(false);
        });
        it('should correctly identify array types', () => {
            const byteType = createPrimitiveType('byte');
            const arrayType = createArrayType(byteType, 10);
            const namedType = createNamedType('TestType');
            const callbackType = createCallbackType([], byteType);
            expect(isArrayType(arrayType)).toBe(true);
            expect(isArrayType(byteType)).toBe(false);
            expect(isArrayType(namedType)).toBe(false);
            expect(isArrayType(callbackType)).toBe(false);
        });
        it('should correctly identify named types', () => {
            const byteType = createPrimitiveType('byte');
            const arrayType = createArrayType(byteType, 10);
            const namedType = createNamedType('TestType');
            const callbackType = createCallbackType([], byteType);
            expect(isNamedType(namedType)).toBe(true);
            expect(isNamedType(byteType)).toBe(false);
            expect(isNamedType(arrayType)).toBe(false);
            expect(isNamedType(callbackType)).toBe(false);
        });
        it('should correctly identify callback types', () => {
            const byteType = createPrimitiveType('byte');
            const arrayType = createArrayType(byteType, 10);
            const namedType = createNamedType('TestType');
            const callbackType = createCallbackType([], byteType);
            expect(isCallbackType(callbackType)).toBe(true);
            expect(isCallbackType(byteType)).toBe(false);
            expect(isCallbackType(arrayType)).toBe(false);
            expect(isCallbackType(namedType)).toBe(false);
        });
    });
    describe('Symbol Type Guards', () => {
        const { moduleScope } = createTestScopes();
        const location = createTestLocation();
        const byteType = createPrimitiveType('byte');
        it('should correctly identify variable symbols', () => {
            const variableSymbol = createVariableSymbol('test', byteType, moduleScope, location);
            const functionSymbol = createFunctionSymbol('test', [], byteType, moduleScope, location);
            expect(isVariableSymbol(variableSymbol)).toBe(true);
            expect(isVariableSymbol(functionSymbol)).toBe(false);
        });
        it('should correctly identify function symbols', () => {
            const variableSymbol = createVariableSymbol('test', byteType, moduleScope, location);
            const functionSymbol = createFunctionSymbol('test', [], byteType, moduleScope, location);
            expect(isFunctionSymbol(functionSymbol)).toBe(true);
            expect(isFunctionSymbol(variableSymbol)).toBe(false);
        });
        it('should correctly identify module symbols', () => {
            const moduleSymbol = createModuleSymbol('TestModule', ['Test', 'Module'], moduleScope, location);
            const variableSymbol = createVariableSymbol('test', byteType, moduleScope, location);
            expect(isModuleSymbol(moduleSymbol)).toBe(true);
            expect(isModuleSymbol(variableSymbol)).toBe(false);
        });
    });
});
// ============================================================================
// PHASE 3: TYPE COMPATIBILITY TESTS
// ============================================================================
describe('Type Compatibility Functions', () => {
    describe('areTypesEqual', () => {
        it('should return true for identical primitive types', () => {
            const byte1 = createPrimitiveType('byte');
            const byte2 = createPrimitiveType('byte');
            expect(areTypesEqual(byte1, byte2)).toBe(true);
        });
        it('should return false for different primitive types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            expect(areTypesEqual(byteType, wordType)).toBe(false);
        });
        it('should return true for identical array types', () => {
            const byteType = createPrimitiveType('byte');
            const array1 = createArrayType(byteType, 10);
            const array2 = createArrayType(createPrimitiveType('byte'), 10);
            expect(areTypesEqual(array1, array2)).toBe(true);
        });
        it('should return false for arrays with different sizes', () => {
            const byteType = createPrimitiveType('byte');
            const array1 = createArrayType(byteType, 10);
            const array2 = createArrayType(byteType, 20);
            expect(areTypesEqual(array1, array2)).toBe(false);
        });
        it('should return false for arrays with different element types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const array1 = createArrayType(byteType, 10);
            const array2 = createArrayType(wordType, 10);
            expect(areTypesEqual(array1, array2)).toBe(false);
        });
        it('should return true for identical callback types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const callback1 = createCallbackType([byteType, byteType], wordType);
            const callback2 = createCallbackType([createPrimitiveType('byte'), createPrimitiveType('byte')], createPrimitiveType('word'));
            expect(areTypesEqual(callback1, callback2)).toBe(true);
        });
        it('should return false for callbacks with different parameter counts', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const callback1 = createCallbackType([byteType], wordType);
            const callback2 = createCallbackType([byteType, byteType], wordType);
            expect(areTypesEqual(callback1, callback2)).toBe(false);
        });
    });
    describe('isAssignmentCompatible', () => {
        it('should allow assignment of same types', () => {
            const byte1 = createPrimitiveType('byte');
            const byte2 = createPrimitiveType('byte');
            expect(isAssignmentCompatible(byte1, byte2)).toBe(true);
        });
        it('should not allow implicit byte to word conversion', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            // Blend65 requires explicit conversions between byte and word
            expect(isAssignmentCompatible(wordType, byteType)).toBe(false);
            expect(isAssignmentCompatible(byteType, wordType)).toBe(false);
        });
        it('should allow assignment of compatible array types', () => {
            const byteType = createPrimitiveType('byte');
            const array1 = createArrayType(byteType, 10);
            const array2 = createArrayType(createPrimitiveType('byte'), 10);
            expect(isAssignmentCompatible(array1, array2)).toBe(true);
        });
        it('should not allow assignment of incompatible array types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const byteArray = createArrayType(byteType, 10);
            const wordArray = createArrayType(wordType, 10);
            expect(isAssignmentCompatible(byteArray, wordArray)).toBe(false);
        });
        it('should allow assignment of compatible callback types', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const callback1 = createCallbackType([byteType], voidType);
            const callback2 = createCallbackType([createPrimitiveType('byte')], createPrimitiveType('void'));
            expect(isAssignmentCompatible(callback1, callback2)).toBe(true);
        });
        it('should not allow assignment of incompatible callback types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const voidType = createPrimitiveType('void');
            const callback1 = createCallbackType([byteType], voidType);
            const callback2 = createCallbackType([wordType], voidType);
            expect(isAssignmentCompatible(callback1, callback2)).toBe(false);
        });
    });
    describe('areCallbackTypesCompatible', () => {
        it('should return true for identical callback signatures', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const callback1 = createCallbackType([byteType, byteType], voidType);
            const callback2 = createCallbackType([createPrimitiveType('byte'), createPrimitiveType('byte')], createPrimitiveType('void'));
            expect(areCallbackTypesCompatible(callback1, callback2)).toBe(true);
        });
        it('should return false for different return types', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const wordType = createPrimitiveType('word');
            const callback1 = createCallbackType([byteType], voidType);
            const callback2 = createCallbackType([byteType], wordType);
            expect(areCallbackTypesCompatible(callback1, callback2)).toBe(false);
        });
        it('should return false for different parameter counts', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const callback1 = createCallbackType([byteType], voidType);
            const callback2 = createCallbackType([byteType, byteType], voidType);
            expect(areCallbackTypesCompatible(callback1, callback2)).toBe(false);
        });
        it('should return false for different parameter types', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const voidType = createPrimitiveType('void');
            const callback1 = createCallbackType([byteType], voidType);
            const callback2 = createCallbackType([wordType], voidType);
            expect(areCallbackTypesCompatible(callback1, callback2)).toBe(false);
        });
    });
});
// ============================================================================
// PHASE 4: TYPE STRING REPRESENTATION TESTS
// ============================================================================
describe('typeToString', () => {
    it('should format primitive types correctly', () => {
        expect(typeToString(createPrimitiveType('byte'))).toBe('byte');
        expect(typeToString(createPrimitiveType('word'))).toBe('word');
        expect(typeToString(createPrimitiveType('boolean'))).toBe('boolean');
        expect(typeToString(createPrimitiveType('void'))).toBe('void');
        expect(typeToString(createPrimitiveType('callback'))).toBe('callback');
    });
    it('should format array types correctly', () => {
        const byteType = createPrimitiveType('byte');
        const arrayType = createArrayType(byteType, 256);
        expect(typeToString(arrayType)).toBe('byte[256]');
    });
    it('should format nested array types correctly', () => {
        const byteType = createPrimitiveType('byte');
        const innerArray = createArrayType(byteType, 10);
        const outerArray = createArrayType(innerArray, 5);
        expect(typeToString(outerArray)).toBe('byte[10][5]');
    });
    it('should format named types correctly', () => {
        const namedType = createNamedType('Player');
        expect(typeToString(namedType)).toBe('Player');
    });
    it('should format callback types correctly', () => {
        const byteType = createPrimitiveType('byte');
        const wordType = createPrimitiveType('word');
        const voidType = createPrimitiveType('void');
        // Callback with no parameters and void return
        const simpleCallback = createCallbackType([], voidType);
        expect(typeToString(simpleCallback)).toBe('callback()');
        // Callback with parameters and non-void return
        const complexCallback = createCallbackType([byteType, byteType], wordType);
        expect(typeToString(complexCallback)).toBe('callback(byte, byte): word');
        // Callback with parameters and void return
        const voidCallback = createCallbackType([byteType], voidType);
        expect(typeToString(voidCallback)).toBe('callback(byte)');
    });
});
// ============================================================================
// PHASE 5: STORAGE CLASS VALIDATION TESTS
// ============================================================================
describe('validateStorageClassUsage', () => {
    it('should allow storage classes at module scope', () => {
        const result = validateStorageClassUsage('zp', 'Module', false);
        expect(result.success).toBe(true);
    });
    it('should allow storage classes at global scope', () => {
        const result = validateStorageClassUsage('ram', 'Global', false);
        expect(result.success).toBe(true);
    });
    it('should reject storage classes in function scope', () => {
        const result = validateStorageClassUsage('zp', 'Function', false);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors[0].errorType).toBe('InvalidStorageClass');
            expect(result.errors[0].message).toContain('not allowed in function scope');
            expect(result.errors[0].suggestions).toBeDefined();
            expect(result.errors[0].suggestions?.length).toBeGreaterThan(0);
        }
    });
    it('should reject storage classes in block scope', () => {
        const result = validateStorageClassUsage('ram', 'Block', false);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors[0].errorType).toBe('InvalidStorageClass');
        }
    });
    it('should require initializers for const variables', () => {
        const result = validateStorageClassUsage('const', 'Module', false);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors[0].errorType).toBe('ConstantRequired');
            expect(result.errors[0].message).toContain('must have an initializer');
        }
    });
    it('should require initializers for data variables', () => {
        const result = validateStorageClassUsage('data', 'Module', false);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors[0].errorType).toBe('ConstantRequired');
        }
    });
    it('should allow const variables with initializers', () => {
        const result = validateStorageClassUsage('const', 'Module', true);
        expect(result.success).toBe(true);
    });
    it('should allow data variables with initializers', () => {
        const result = validateStorageClassUsage('data', 'Module', true);
        expect(result.success).toBe(true);
    });
    it('should reject initializers for io variables', () => {
        const result = validateStorageClassUsage('io', 'Module', true);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.errors[0].errorType).toBe('InvalidStorageClass');
            expect(result.errors[0].message).toContain('cannot have initializers');
        }
    });
    it('should allow io variables without initializers', () => {
        const result = validateStorageClassUsage('io', 'Module', false);
        expect(result.success).toBe(true);
    });
    it('should allow zp and ram variables with or without initializers', () => {
        expect(validateStorageClassUsage('zp', 'Module', true).success).toBe(true);
        expect(validateStorageClassUsage('zp', 'Module', false).success).toBe(true);
        expect(validateStorageClassUsage('ram', 'Module', true).success).toBe(true);
        expect(validateStorageClassUsage('ram', 'Module', false).success).toBe(true);
    });
});
// ============================================================================
// PHASE 6: SYMBOL CREATION TESTS
// ============================================================================
describe('Symbol Creation Functions', () => {
    const { globalScope, moduleScope, functionScope } = createTestScopes();
    const location = createTestLocation(5, 10);
    describe('createVariableSymbol', () => {
        it('should create a basic variable symbol', () => {
            const byteType = createPrimitiveType('byte');
            const symbol = createVariableSymbol('counter', byteType, moduleScope, location);
            expect(symbol).toEqual({
                name: 'counter',
                symbolType: 'Variable',
                sourceLocation: location,
                scope: moduleScope,
                isExported: false,
                varType: byteType,
                storageClass: null,
                initialValue: null,
                isLocal: false,
            });
        });
        it('should create a variable symbol with storage class', () => {
            const byteType = createPrimitiveType('byte');
            const symbol = createVariableSymbol('fastVar', byteType, moduleScope, location, {
                storageClass: 'zp',
                isExported: true,
                isLocal: false,
            });
            expect(symbol.storageClass).toBe('zp');
            expect(symbol.isExported).toBe(true);
            expect(symbol.isLocal).toBe(false);
        });
        it('should create a local variable symbol', () => {
            const byteType = createPrimitiveType('byte');
            const symbol = createVariableSymbol('localVar', byteType, functionScope, location, {
                isLocal: true,
            });
            expect(symbol.isLocal).toBe(true);
            expect(symbol.storageClass).toBe(null);
        });
    });
    describe('createFunctionSymbol', () => {
        it('should create a basic function symbol', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const parameters = [
                { name: 'x', type: byteType, optional: false, defaultValue: null },
            ];
            const symbol = createFunctionSymbol('testFunc', parameters, voidType, moduleScope, location);
            expect(symbol).toEqual({
                name: 'testFunc',
                symbolType: 'Function',
                sourceLocation: location,
                scope: moduleScope,
                isExported: false,
                parameters,
                returnType: voidType,
                isCallback: false,
            });
        });
        it('should create a callback function symbol', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const symbol = createFunctionSymbol('onInterrupt', [], voidType, moduleScope, location, {
                isCallback: true,
                isExported: true,
            });
            expect(symbol.isCallback).toBe(true);
            expect(symbol.isExported).toBe(true);
        });
    });
    describe('createModuleSymbol', () => {
        it('should create a module symbol', () => {
            const qualifiedName = ['Game', 'Player'];
            const symbol = createModuleSymbol('Player', qualifiedName, globalScope, location);
            expect(symbol).toEqual({
                name: 'Player',
                symbolType: 'Module',
                sourceLocation: location,
                scope: globalScope,
                isExported: false, // Modules are not exported
                qualifiedName,
                exports: new Map(),
                imports: new Map(),
            });
        });
    });
    describe('createScope', () => {
        it('should create a scope with no parent', () => {
            const scope = createScope('Global', null, 'global');
            expect(scope).toEqual({
                scopeType: 'Global',
                parent: null,
                symbols: new Map(),
                children: [],
                name: 'global',
            });
        });
        it('should create a scope with parent', () => {
            const parent = createScope('Global');
            const child = createScope('Module', parent, 'TestModule');
            expect(child.parent).toBe(parent);
            expect(child.scopeType).toBe('Module');
            expect(child.name).toBe('TestModule');
        });
    });
});
// ============================================================================
// PHASE 7: COMPREHENSIVE INTEGRATION TESTS
// ============================================================================
describe('Integration Tests', () => {
    describe('Complete Symbol Table Scenario', () => {
        it('should handle a complex Blend65 program structure', () => {
            // Create scope hierarchy
            const globalScope = createScope('Global', null, 'global');
            const gameModuleScope = createScope('Module', globalScope, 'Game.Main');
            const updateFunctionScope = createScope('Function', gameModuleScope, 'updateGame');
            globalScope.children.push(gameModuleScope);
            gameModuleScope.children.push(updateFunctionScope);
            // Create types
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            const boolType = createPrimitiveType('boolean');
            const voidType = createPrimitiveType('void');
            const spriteArrayType = createArrayType(byteType, 8);
            const interruptCallbackType = createCallbackType([], voidType);
            const location = createTestLocation();
            // Create symbols for a game program
            const playerXSymbol = createVariableSymbol('playerX', byteType, gameModuleScope, location, {
                storageClass: 'zp',
                isExported: true,
            });
            const scoreSymbol = createVariableSymbol('score', wordType, gameModuleScope, location, {
                storageClass: 'ram',
                isExported: true,
            });
            const spriteDataSymbol = createVariableSymbol('spriteData', spriteArrayType, gameModuleScope, location, {
                storageClass: 'data',
            });
            const updateGameSymbol = createFunctionSymbol('updateGame', [], voidType, gameModuleScope, location, {
                isExported: true,
            });
            const onRasterIrqSymbol = createFunctionSymbol('onRasterIrq', [], voidType, gameModuleScope, location, {
                isCallback: true,
            });
            const localCounterSymbol = createVariableSymbol('counter', byteType, updateFunctionScope, location, {
                isLocal: true,
            });
            // Add symbols to scopes
            gameModuleScope.symbols.set('playerX', playerXSymbol);
            gameModuleScope.symbols.set('score', scoreSymbol);
            gameModuleScope.symbols.set('spriteData', spriteDataSymbol);
            gameModuleScope.symbols.set('updateGame', updateGameSymbol);
            gameModuleScope.symbols.set('onRasterIrq', onRasterIrqSymbol);
            updateFunctionScope.symbols.set('counter', localCounterSymbol);
            // Test symbol retrieval and type checking
            expect(gameModuleScope.symbols.get('playerX')).toBe(playerXSymbol);
            expect(gameModuleScope.symbols.get('score')).toBe(scoreSymbol);
            expect(gameModuleScope.symbols.get('updateGame')).toBe(updateGameSymbol);
            expect(updateFunctionScope.symbols.get('counter')).toBe(localCounterSymbol);
            // Test symbol type guards
            const foundPlayerX = gameModuleScope.symbols.get('playerX');
            if (foundPlayerX && isVariableSymbol(foundPlayerX)) {
                expect(foundPlayerX.storageClass).toBe('zp');
                expect(foundPlayerX.isExported).toBe(true);
                expect(foundPlayerX.varType.kind).toBe('primitive');
                if (isPrimitiveType(foundPlayerX.varType)) {
                    expect(foundPlayerX.varType.name).toBe('byte');
                }
            }
            const foundUpdateGame = gameModuleScope.symbols.get('updateGame');
            if (foundUpdateGame && isFunctionSymbol(foundUpdateGame)) {
                expect(foundUpdateGame.isCallback).toBe(false);
                expect(foundUpdateGame.isExported).toBe(true);
                expect(foundUpdateGame.returnType.kind).toBe('primitive');
                if (isPrimitiveType(foundUpdateGame.returnType)) {
                    expect(foundUpdateGame.returnType.name).toBe('void');
                }
            }
            const foundCallback = gameModuleScope.symbols.get('onRasterIrq');
            if (foundCallback && isFunctionSymbol(foundCallback)) {
                expect(foundCallback.isCallback).toBe(true);
                expect(foundCallback.isExported).toBe(false);
            }
            const foundSpriteData = gameModuleScope.symbols.get('spriteData');
            if (foundSpriteData && isVariableSymbol(foundSpriteData)) {
                expect(foundSpriteData.storageClass).toBe('data');
                expect(foundSpriteData.varType.kind).toBe('array');
                if (isArrayType(foundSpriteData.varType)) {
                    expect(foundSpriteData.varType.size).toBe(8);
                    expect(foundSpriteData.varType.elementType.kind).toBe('primitive');
                }
            }
            // Test scope hierarchy
            expect(gameModuleScope.parent).toBe(globalScope);
            expect(updateFunctionScope.parent).toBe(gameModuleScope);
            expect(globalScope.children).toContain(gameModuleScope);
            expect(gameModuleScope.children).toContain(updateFunctionScope);
        });
    });
    describe('Type System Integration', () => {
        it('should validate complex callback type assignments', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            const wordType = createPrimitiveType('word');
            // Create callback types
            const simpleCallback = createCallbackType([], voidType);
            const paramCallback = createCallbackType([byteType, byteType], voidType);
            const returnCallback = createCallbackType([byteType], wordType);
            // Test callback compatibility
            expect(areCallbackTypesCompatible(simpleCallback, createCallbackType([], voidType))).toBe(true);
            expect(areCallbackTypesCompatible(paramCallback, simpleCallback)).toBe(false);
            expect(areCallbackTypesCompatible(returnCallback, paramCallback)).toBe(false);
            // Test type string formatting
            expect(typeToString(simpleCallback)).toBe('callback()');
            expect(typeToString(paramCallback)).toBe('callback(byte, byte)');
            expect(typeToString(returnCallback)).toBe('callback(byte): word');
        });
        it('should handle nested array type validation', () => {
            const byteType = createPrimitiveType('byte');
            const wordType = createPrimitiveType('word');
            // Create nested array types
            const byteArray = createArrayType(byteType, 10);
            const nestedByteArray = createArrayType(byteArray, 5);
            const wordArray = createArrayType(wordType, 10);
            const nestedWordArray = createArrayType(wordArray, 5);
            // Test nested array compatibility
            expect(areTypesEqual(nestedByteArray, createArrayType(createArrayType(byteType, 10), 5))).toBe(true);
            expect(areTypesEqual(nestedByteArray, nestedWordArray)).toBe(false);
            expect(isAssignmentCompatible(nestedByteArray, nestedWordArray)).toBe(false);
            // Test type string formatting
            expect(typeToString(nestedByteArray)).toBe('byte[10][5]');
            expect(typeToString(nestedWordArray)).toBe('word[10][5]');
        });
    });
});
// ============================================================================
// PHASE 8: EDUCATIONAL SUMMARY TEST
// ============================================================================
describe('Educational Summary', () => {
    it('should demonstrate the complete semantic analysis foundation', () => {
        // This test demonstrates all the key concepts we've built:
        // 1. Symbol system for tracking program entities
        const { moduleScope } = createTestScopes();
        const location = createTestLocation();
        const byteType = createPrimitiveType('byte');
        const playerSymbol = createVariableSymbol('player', byteType, moduleScope, location, {
            storageClass: 'zp',
            isExported: true,
        });
        expect(playerSymbol.symbolType).toBe('Variable');
        expect(isVariableSymbol(playerSymbol)).toBe(true);
        // 2. Type system with 6502-specific storage classes
        expect(playerSymbol.storageClass).toBe('zp');
        const validation = validateStorageClassUsage('zp', 'Module', false);
        expect(validation.success).toBe(true);
        // 3. Type compatibility checking
        const anotherByteType = createPrimitiveType('byte');
        expect(areTypesEqual(byteType, anotherByteType)).toBe(true);
        expect(isAssignmentCompatible(byteType, anotherByteType)).toBe(true);
        // 4. Error reporting (testing error case)
        const errorResult = validateStorageClassUsage('zp', 'Function', false);
        expect(errorResult.success).toBe(false);
        if (!errorResult.success) {
            expect(errorResult.errors[0].errorType).toBe('InvalidStorageClass');
            expect(errorResult.errors[0].suggestions).toBeDefined();
        }
        // 5. Scope management
        expect(moduleScope.scopeType).toBe('Module');
        expect(moduleScope.symbols).toBeInstanceOf(Map);
        // 6. Helper utilities
        expect(typeToString(byteType)).toBe('byte');
        // This foundation enables the complete semantic analyzer implementation!
    });
});
//# sourceMappingURL=types.test.js.map