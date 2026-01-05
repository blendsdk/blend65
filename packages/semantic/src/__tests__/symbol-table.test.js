/**
 * Tests for Symbol Table Management
 * Task 1.2: Implement Symbol Table Management - Test Suite
 *
 * Comprehensive test coverage for symbol table functionality including:
 * - Hierarchical scope management
 * - Symbol declaration and lookup
 * - Module system support with imports/exports
 * - Symbol visibility and shadowing
 * - Error handling and recovery
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SymbolTable, createSymbolTable, validateSymbolTable } from '../symbol-table.js';
import { createVariableSymbol, createFunctionSymbol, createModuleSymbol, createPrimitiveType, createCallbackType, } from '../types.js';
describe('SymbolTable', () => {
    let symbolTable;
    const mockLocation = { line: 1, column: 1, offset: 0 };
    beforeEach(() => {
        symbolTable = createSymbolTable();
    });
    describe('Scope Management', () => {
        it('should initialize with global scope', () => {
            const globalScope = symbolTable.getGlobalScope();
            expect(globalScope.scopeType).toBe('Global');
            expect(globalScope.parent).toBeNull();
            expect(globalScope.symbols.size).toBe(0);
            expect(symbolTable.getCurrentScope()).toBe(globalScope);
        });
        it('should enter and exit scopes correctly', () => {
            const globalScope = symbolTable.getGlobalScope();
            // Enter function scope
            symbolTable.enterScope('Function', 'testFunction');
            const functionScope = symbolTable.getCurrentScope();
            expect(functionScope.scopeType).toBe('Function');
            expect(functionScope.parent).toBe(globalScope);
            expect(functionScope.name).toBe('testFunction');
            expect(globalScope.children).toContain(functionScope);
            // Enter block scope
            symbolTable.enterScope('Block', 'testBlock');
            const blockScope = symbolTable.getCurrentScope();
            expect(blockScope.scopeType).toBe('Block');
            expect(blockScope.parent).toBe(functionScope);
            expect(functionScope.children).toContain(blockScope);
            // Exit block scope
            symbolTable.exitScope();
            expect(symbolTable.getCurrentScope()).toBe(functionScope);
            // Exit function scope
            symbolTable.exitScope();
            expect(symbolTable.getCurrentScope()).toBe(globalScope);
        });
        it('should prevent exiting global scope', () => {
            symbolTable.exitScope(); // Try to exit global scope
            expect(symbolTable.hasErrors()).toBe(true);
            const errors = symbolTable.getErrors();
            expect(errors).toHaveLength(1);
            expect(errors[0].errorType).toBe('InvalidScope');
            expect(errors[0].message).toContain('Cannot exit global scope');
        });
        it('should maintain scope hierarchy correctly', () => {
            symbolTable.enterScope('Module', 'TestModule');
            symbolTable.enterScope('Function', 'TestFunction');
            symbolTable.enterScope('Block');
            const currentScope = symbolTable.getCurrentScope();
            expect(currentScope.scopeType).toBe('Block');
            expect(currentScope.parent?.scopeType).toBe('Function');
            expect(currentScope.parent?.parent?.scopeType).toBe('Module');
            expect(currentScope.parent?.parent?.parent?.scopeType).toBe('Global');
        });
    });
    describe('Symbol Declaration', () => {
        it('should declare variables in current scope', () => {
            const varSymbol = createVariableSymbol('counter', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            const result = symbolTable.declareSymbol(varSymbol);
            expect(result.success).toBe(true);
            expect(symbolTable.getCurrentScopeSymbols().get('counter')).toBe(varSymbol);
        });
        it('should declare functions in current scope', () => {
            const funcSymbol = createFunctionSymbol('add', [
                { name: 'a', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
                { name: 'b', type: createPrimitiveType('byte'), optional: false, defaultValue: null },
            ], createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            const result = symbolTable.declareSymbol(funcSymbol);
            expect(result.success).toBe(true);
            expect(symbolTable.getCurrentScopeSymbols().get('add')).toBe(funcSymbol);
        });
        it('should detect duplicate symbol declarations', () => {
            const varSymbol1 = createVariableSymbol('counter', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            const varSymbol2 = createVariableSymbol('counter', createPrimitiveType('word'), symbolTable.getCurrentScope(), { line: 2, column: 1, offset: 10 });
            const result1 = symbolTable.declareSymbol(varSymbol1);
            expect(result1.success).toBe(true);
            const result2 = symbolTable.declareSymbol(varSymbol2);
            expect(result2.success).toBe(false);
            if (!result2.success) {
                expect(result2.errors).toHaveLength(1);
                expect(result2.errors[0].errorType).toBe('DuplicateSymbol');
                expect(result2.errors[0].message).toContain("Symbol 'counter' is already declared");
            }
        });
        it('should register modules correctly', () => {
            const moduleSymbol = createModuleSymbol('Game', ['Game', 'Main'], symbolTable.getCurrentScope(), mockLocation);
            const result = symbolTable.declareSymbol(moduleSymbol);
            expect(result.success).toBe(true);
            expect(symbolTable.getAllModules().get('Game.Main')).toBe(moduleSymbol);
        });
    });
    describe('Symbol Lookup', () => {
        let varSymbol;
        let funcSymbol;
        beforeEach(() => {
            varSymbol = createVariableSymbol('globalVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            funcSymbol = createFunctionSymbol('globalFunc', [], createPrimitiveType('void'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.declareSymbol(funcSymbol);
        });
        it('should look up symbols in current scope', () => {
            const foundVar = symbolTable.lookupSymbol('globalVar');
            const foundFunc = symbolTable.lookupSymbol('globalFunc');
            expect(foundVar).toBe(varSymbol);
            expect(foundFunc).toBe(funcSymbol);
        });
        it('should look up symbols in parent scopes', () => {
            symbolTable.enterScope('Function', 'testFunc');
            const foundVar = symbolTable.lookupSymbol('globalVar');
            const foundFunc = symbolTable.lookupSymbol('globalFunc');
            expect(foundVar).toBe(varSymbol);
            expect(foundFunc).toBe(funcSymbol);
        });
        it('should return null for non-existent symbols', () => {
            const notFound = symbolTable.lookupSymbol('nonexistent');
            expect(notFound).toBeNull();
        });
        it('should handle symbol shadowing correctly', () => {
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('globalVar', // Same name as global variable
            createPrimitiveType('word'), symbolTable.getCurrentScope(), { line: 2, column: 1, offset: 10 });
            symbolTable.declareSymbol(localVar);
            // Should find the local variable (shadows global)
            const found = symbolTable.lookupSymbol('globalVar');
            expect(found).toBe(localVar);
        });
        it('should look up symbols in specific scope', () => {
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('localVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(localVar);
            // Look up in current scope
            const foundLocal = symbolTable.lookupSymbolInScope('localVar', symbolTable.getCurrentScope());
            expect(foundLocal).toBe(localVar);
            // Look up in global scope (should not find local variable)
            const notFoundInGlobal = symbolTable.lookupSymbolInScope('localVar', symbolTable.getGlobalScope());
            expect(notFoundInGlobal).toBeNull();
        });
        it('should get all accessible symbols', () => {
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('localVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(localVar);
            const accessible = symbolTable.getAccessibleSymbols();
            expect(accessible.get('globalVar')).toBe(varSymbol);
            expect(accessible.get('globalFunc')).toBe(funcSymbol);
            expect(accessible.get('localVar')).toBe(localVar);
        });
    });
    describe('Module System', () => {
        let gameModule;
        let utilsModule;
        beforeEach(() => {
            gameModule = createModuleSymbol('Game', ['Game'], symbolTable.getCurrentScope(), mockLocation);
            utilsModule = createModuleSymbol('Utils', ['Utils'], symbolTable.getCurrentScope(), {
                line: 2,
                column: 1,
                offset: 10,
            });
        });
        it('should enter and exit module scopes', () => {
            const result = symbolTable.enterModule(gameModule);
            expect(result.success).toBe(true);
            expect(symbolTable.getCurrentScope().scopeType).toBe('Module');
            expect(symbolTable.getCurrentModule()).toBe(gameModule);
            symbolTable.exitModule();
            expect(symbolTable.getCurrentScope().scopeType).toBe('Global');
            expect(symbolTable.getCurrentModule()).toBeNull();
        });
        it('should export symbols from modules', () => {
            symbolTable.enterModule(gameModule);
            const exportedVar = createVariableSymbol('playerScore', createPrimitiveType('word'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(exportedVar);
            const exportResult = symbolTable.exportSymbol(exportedVar);
            expect(exportResult.success).toBe(true);
            expect(exportedVar.isExported).toBe(true);
            expect(gameModule.exports.get('playerScore')).toBe(exportedVar);
        });
        it('should prevent exports outside module scope', () => {
            const globalVar = createVariableSymbol('globalVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            const result = symbolTable.exportSymbol(globalVar);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('InvalidScope');
                expect(result.errors[0].message).toContain('Cannot export');
            }
        });
        it('should detect duplicate exports', () => {
            symbolTable.enterModule(gameModule);
            const var1 = createVariableSymbol('sharedVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            const var2 = createVariableSymbol('sharedVar', createPrimitiveType('word'), symbolTable.getCurrentScope(), { line: 2, column: 1, offset: 10 });
            symbolTable.declareSymbol(var1);
            symbolTable.exportSymbol(var1);
            symbolTable.enterScope('Function', 'testFunc');
            symbolTable.declareSymbol(var2);
            const result = symbolTable.exportSymbol(var2);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('DuplicateSymbol');
            }
        });
        it('should import symbols from other modules', () => {
            // Set up source module with exports
            symbolTable.enterModule(utilsModule);
            const utilityFunc = createFunctionSymbol('randomByte', [], createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(utilityFunc);
            symbolTable.exportSymbol(utilityFunc);
            symbolTable.exitModule();
            // Set up importing module
            symbolTable.enterModule(gameModule);
            const importInfo = {
                importedName: 'randomByte',
                localName: 'random',
                sourceModule: ['Utils'],
                resolvedSymbol: undefined,
            };
            const result = symbolTable.importSymbol(importInfo, mockLocation);
            expect(result.success).toBe(true);
            expect(importInfo.resolvedSymbol).toBe(utilityFunc);
            expect(gameModule.imports.get('random')).toBe(importInfo);
            expect(symbolTable.lookupSymbol('random')).toBe(utilityFunc);
        });
        it('should detect missing source modules for imports', () => {
            symbolTable.enterModule(gameModule);
            const importInfo = {
                importedName: 'nonexistentFunc',
                localName: 'nonexistentFunc',
                sourceModule: ['NonexistentModule'],
                resolvedSymbol: undefined,
            };
            const result = symbolTable.importSymbol(importInfo, mockLocation);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('ImportNotFound');
                expect(result.errors[0].message).toContain('Cannot find module');
            }
        });
        it('should detect missing symbols for imports', () => {
            symbolTable.enterModule(utilsModule);
            symbolTable.exitModule();
            symbolTable.enterModule(gameModule);
            const importInfo = {
                importedName: 'nonexistentFunc',
                localName: 'nonexistentFunc',
                sourceModule: ['Utils'],
                resolvedSymbol: undefined,
            };
            const result = symbolTable.importSymbol(importInfo, mockLocation);
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.errors[0].errorType).toBe('ImportNotFound');
                expect(result.errors[0].message).toContain('is not exported by module');
            }
        });
        it('should look up qualified symbols', () => {
            symbolTable.enterModule(utilsModule);
            const utilityFunc = createFunctionSymbol('randomByte', [], createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(utilityFunc);
            symbolTable.exportSymbol(utilityFunc);
            symbolTable.exitModule();
            // Look up qualified symbol
            const found = symbolTable.lookupQualifiedSymbol(['Utils', 'randomByte']);
            expect(found).toBe(utilityFunc);
            // Look up non-existent qualified symbol
            const notFound = symbolTable.lookupQualifiedSymbol(['Utils', 'nonexistent']);
            expect(notFound).toBeNull();
        });
    });
    describe('Symbol Visibility and Shadowing', () => {
        it('should detect symbol shadowing', () => {
            const globalVar = createVariableSymbol('counter', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(globalVar);
            symbolTable.enterScope('Function', 'testFunc');
            const result = symbolTable.checkShadowing('counter', { line: 2, column: 1, offset: 10 });
            expect(result.success).toBe(true);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].errorType).toBe('InvalidScope');
            expect(result.warnings[0].message).toContain('shadows symbol');
        });
        it('should not warn for non-shadowing symbols', () => {
            symbolTable.enterScope('Function', 'testFunc');
            const result = symbolTable.checkShadowing('uniqueName', mockLocation);
            expect(result.success).toBe(true);
            expect(result.warnings).toBeUndefined();
        });
        it('should check symbol visibility correctly', () => {
            const globalVar = createVariableSymbol('globalVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(globalVar);
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('localVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(localVar);
            // Both should be visible from current scope
            expect(symbolTable.isSymbolVisible(globalVar)).toBe(true);
            expect(symbolTable.isSymbolVisible(localVar)).toBe(true);
            symbolTable.exitScope();
            // Only global should be visible from global scope
            expect(symbolTable.isSymbolVisible(globalVar)).toBe(true);
            expect(symbolTable.isSymbolVisible(localVar)).toBe(false);
        });
    });
    describe('Error Handling', () => {
        it('should accumulate errors correctly', () => {
            expect(symbolTable.hasErrors()).toBe(false);
            expect(symbolTable.getErrors()).toHaveLength(0);
            // Create a duplicate symbol error
            const varSymbol = createVariableSymbol('test', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.declareSymbol(varSymbol); // Duplicate
            expect(symbolTable.hasErrors()).toBe(true);
            expect(symbolTable.getErrors()).toHaveLength(1);
        });
        it('should clear errors', () => {
            const varSymbol = createVariableSymbol('test', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.declareSymbol(varSymbol); // Create error
            expect(symbolTable.hasErrors()).toBe(true);
            symbolTable.clearErrors();
            expect(symbolTable.hasErrors()).toBe(false);
            expect(symbolTable.getErrors()).toHaveLength(0);
        });
    });
    describe('Debugging and Introspection', () => {
        it('should generate string representation', () => {
            const varSymbol = createVariableSymbol('globalVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('localVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(localVar);
            const str = symbolTable.toString();
            expect(str).toContain('Scope[Global]');
            expect(str).toContain('Variable: globalVar');
            expect(str).toContain('Scope[testFunc]');
            expect(str).toContain('Variable: localVar');
        });
        it('should provide statistics', () => {
            const varSymbol = createVariableSymbol('globalVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.enterScope('Function', 'testFunc');
            const localVar = createVariableSymbol('localVar', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(localVar);
            const stats = symbolTable.getStatistics();
            expect(stats.totalSymbols).toBe(2);
            expect(stats.totalScopes).toBe(2); // Global + Function
            expect(stats.moduleCount).toBe(0);
            expect(stats.errorCount).toBe(0);
            expect(stats.maxScopeDepth).toBe(1); // Function scope is depth 1
        });
    });
    describe('Symbol Table Validation', () => {
        it('should validate healthy symbol table', () => {
            const varSymbol = createVariableSymbol('test', createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(varSymbol);
            symbolTable.enterScope('Function', 'testFunc');
            symbolTable.exitScope();
            const result = validateSymbolTable(symbolTable);
            expect(result.success).toBe(true);
        });
    });
    describe('Callback Function Support', () => {
        it('should handle callback function symbols', () => {
            const callbackFunc = createFunctionSymbol('onInterrupt', [], createPrimitiveType('void'), symbolTable.getCurrentScope(), mockLocation, { isCallback: true });
            const result = symbolTable.declareSymbol(callbackFunc);
            expect(result.success).toBe(true);
            expect(callbackFunc.isCallback).toBe(true);
            expect(symbolTable.lookupSymbol('onInterrupt')).toBe(callbackFunc);
        });
        it('should handle callback type variables', () => {
            const callbackVar = createVariableSymbol('interruptHandler', createCallbackType([], createPrimitiveType('void')), symbolTable.getCurrentScope(), mockLocation);
            const result = symbolTable.declareSymbol(callbackVar);
            expect(result.success).toBe(true);
            expect(callbackVar.varType.kind).toBe('callback');
            expect(symbolTable.lookupSymbol('interruptHandler')).toBe(callbackVar);
        });
    });
    describe('Factory Functions', () => {
        it('should create symbol table with factory function', () => {
            const newTable = createSymbolTable();
            expect(newTable).toBeInstanceOf(SymbolTable);
            expect(newTable.getGlobalScope().scopeType).toBe('Global');
            expect(newTable.getCurrentScope().scopeType).toBe('Global');
        });
    });
    describe('Complex Scenarios', () => {
        it('should handle realistic multi-module scenario', () => {
            // Create Utils module with exported function
            const utilsModule = createModuleSymbol('Utils', ['Utils'], symbolTable.getCurrentScope(), mockLocation);
            symbolTable.enterModule(utilsModule);
            const randomFunc = createFunctionSymbol('random', [], createPrimitiveType('byte'), symbolTable.getCurrentScope(), mockLocation);
            symbolTable.declareSymbol(randomFunc);
            symbolTable.exportSymbol(randomFunc);
            symbolTable.exitModule();
            // Create Game module that imports from Utils
            const gameModule = createModuleSymbol('Game', ['Game'], symbolTable.getCurrentScope(), {
                line: 10,
                column: 1,
                offset: 100,
            });
            symbolTable.enterModule(gameModule);
            const importInfo = {
                importedName: 'random',
                localName: 'getRandom',
                sourceModule: ['Utils'],
                resolvedSymbol: undefined,
            };
            const importResult = symbolTable.importSymbol(importInfo, {
                line: 11,
                column: 1,
                offset: 110,
            });
            expect(importResult.success).toBe(true);
            // Declare game-specific function
            const updateFunc = createFunctionSymbol('updateGame', [], createPrimitiveType('void'), symbolTable.getCurrentScope(), { line: 12, column: 1, offset: 120 });
            symbolTable.declareSymbol(updateFunc);
            symbolTable.exportSymbol(updateFunc);
            // Function scope within module
            symbolTable.enterScope('Function', 'updateGame');
            const localVar = createVariableSymbol('deltaTime', createPrimitiveType('byte'), symbolTable.getCurrentScope(), { line: 13, column: 1, offset: 130 });
            symbolTable.declareSymbol(localVar);
            // Verify all symbols are accessible as expected
            expect(symbolTable.lookupSymbol('getRandom')).toBe(randomFunc);
            expect(symbolTable.lookupSymbol('updateGame')).toBe(updateFunc);
            expect(symbolTable.lookupSymbol('deltaTime')).toBe(localVar);
            // Verify qualified lookup works
            expect(symbolTable.lookupQualifiedSymbol(['Utils', 'random'])).toBe(randomFunc);
            expect(symbolTable.lookupQualifiedSymbol(['Game', 'updateGame'])).toBe(updateFunc);
            symbolTable.exitScope(); // Exit function
            symbolTable.exitModule(); // Exit Game module
            // Verify module isolation
            expect(symbolTable.lookupSymbol('deltaTime')).toBeNull(); // Local var not accessible
            expect(symbolTable.lookupSymbol('getRandom')).toBeNull(); // Import not accessible outside module
            expect(symbolTable.lookupQualifiedSymbol(['Game', 'updateGame'])).toBe(updateFunc); // But qualified access works
        });
    });
});
//# sourceMappingURL=symbol-table.test.js.map