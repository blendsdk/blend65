/**
 * IL Type System Tests
 * Task 2.1: Create IL Type System
 *
 * Comprehensive tests for the Blend65 Intermediate Language type system.
 * These tests verify the core IL types, factory functions, type guards,
 * and utility functions work correctly.
 */
import { describe, it, expect } from 'vitest';
import { 
// Core types
ILInstructionType, // Factory functions
createILConstant, createILVariable, createILRegister, createILTemporary, createILLabel, createILInstruction, createILProgram, createILModule, createILFunction, // Type guards
isILConstant, isILVariable, isILRegister, isILTemporary, isILLabel, isILParameterReference, isILReturnReference, // Utility functions
ilValueToString, ilInstructionToString, getInstructionCategory, isInstructionInCategory, getEstimatedCycles, // Constants
IL_VERSION, SUPPORTED_PLATFORMS, INSTRUCTION_CATEGORIES, } from '../index.js';
import { createPrimitiveType } from '@blend65/semantic';
describe('IL Type System', () => {
    describe('Factory Functions', () => {
        describe('createILConstant', () => {
            it('should create byte constants', () => {
                const byteType = createPrimitiveType('byte');
                const constant = createILConstant(byteType, 42);
                expect(constant.valueType).toBe('constant');
                expect(constant.type).toEqual(byteType);
                expect(constant.value).toBe(42);
                expect(constant.representation).toBe('decimal');
            });
            it('should create hex constants', () => {
                const byteType = createPrimitiveType('byte');
                const constant = createILConstant(byteType, 255, 'hexadecimal');
                expect(constant.representation).toBe('hexadecimal');
                expect(constant.value).toBe(255);
            });
            it('should create boolean constants', () => {
                const boolType = createPrimitiveType('boolean');
                const constant = createILConstant(boolType, true, 'boolean');
                expect(constant.value).toBe(true);
                expect(constant.representation).toBe('boolean');
            });
            it('should create string constants', () => {
                const byteType = createPrimitiveType('byte');
                const constant = createILConstant(byteType, 'Hello', 'string');
                expect(constant.value).toBe('Hello');
                expect(constant.representation).toBe('string');
            });
        });
        describe('createILVariable', () => {
            it('should create local variables', () => {
                const byteType = createPrimitiveType('byte');
                const variable = createILVariable('counter', byteType);
                expect(variable.valueType).toBe('variable');
                expect(variable.name).toBe('counter');
                expect(variable.type).toEqual(byteType);
                expect(variable.qualifiedName).toEqual([]);
                expect(variable.storageClass).toBeNull();
                expect(variable.scope).toBe('local');
            });
            it('should create global variables with qualified names', () => {
                const byteType = createPrimitiveType('byte');
                const variable = createILVariable('playerX', byteType, ['Game', 'Player'], 'zp', 'global');
                expect(variable.name).toBe('playerX');
                expect(variable.qualifiedName).toEqual(['Game', 'Player']);
                expect(variable.storageClass).toBe('zp');
                expect(variable.scope).toBe('global');
            });
        });
        describe('createILRegister', () => {
            it('should create 8-bit register references', () => {
                const byteType = createPrimitiveType('byte');
                const register = createILRegister('A', byteType);
                expect(register.valueType).toBe('register');
                expect(register.register).toBe('A');
                expect(register.type).toEqual(byteType);
            });
            it('should create 16-bit register pairs', () => {
                const wordType = createPrimitiveType('word');
                const register = createILRegister('AX', wordType);
                expect(register.register).toBe('AX');
                expect(register.type).toEqual(wordType);
            });
        });
        describe('createILTemporary', () => {
            it('should create temporary values', () => {
                const byteType = createPrimitiveType('byte');
                const temporary = createILTemporary(1, byteType, 'expression');
                expect(temporary.valueType).toBe('temporary');
                expect(temporary.id).toBe(1);
                expect(temporary.type).toEqual(byteType);
                expect(temporary.scope).toBe('expression');
            });
        });
        describe('createILLabel', () => {
            it('should create label references', () => {
                const label = createILLabel('loop_start');
                expect(label.valueType).toBe('label');
                expect(label.name).toBe('loop_start');
                expect(label.targetInstruction).toBeUndefined();
            });
        });
        describe('createILInstruction', () => {
            it('should create basic instructions', () => {
                const byteType = createPrimitiveType('byte');
                const dest = createILRegister('A', byteType);
                const value = createILConstant(byteType, 42);
                const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [value], 1, {
                    result: dest,
                });
                expect(instruction.type).toBe(ILInstructionType.LOAD_IMMEDIATE);
                expect(instruction.operands).toEqual([value]);
                expect(instruction.result).toEqual(dest);
                expect(instruction.id).toBe(1);
            });
            it('should create instructions with hints', () => {
                const byteType = createPrimitiveType('byte');
                const value = createILConstant(byteType, 42);
                const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [value], 1, {
                    sixtyTwoHints: {
                        preferredRegister: 'A',
                        isHotPath: true,
                        estimatedCycles: 2,
                    },
                });
                expect(instruction.sixtyTwoHints?.preferredRegister).toBe('A');
                expect(instruction.sixtyTwoHints?.isHotPath).toBe(true);
                expect(instruction.sixtyTwoHints?.estimatedCycles).toBe(2);
            });
        });
        describe('createILProgram', () => {
            it('should create empty program structures', () => {
                const program = createILProgram('TestGame');
                expect(program.name).toBe('TestGame');
                expect(program.modules).toEqual([]);
                expect(program.globalData).toEqual([]);
                expect(program.imports).toEqual([]);
                expect(program.exports).toEqual([]);
                expect(program.sourceInfo.compilerVersion).toBe('0.1.0');
                expect(program.sourceInfo.targetPlatform).toBe('c64');
                expect(program.sourceInfo.originalFiles).toEqual([]);
            });
        });
        describe('createILModule', () => {
            it('should create module structures', () => {
                const module = createILModule(['Game', 'Main']);
                expect(module.qualifiedName).toEqual(['Game', 'Main']);
                expect(module.functions).toEqual([]);
                expect(module.moduleData).toEqual([]);
                expect(module.exports).toEqual([]);
                expect(module.imports).toEqual([]);
            });
        });
        describe('createILFunction', () => {
            it('should create function structures', () => {
                const voidType = createPrimitiveType('void');
                const sourceLocation = { line: 1, column: 1, offset: 0 };
                const func = createILFunction('main', ['Game', 'Main'], voidType, sourceLocation);
                expect(func.name).toBe('main');
                expect(func.qualifiedName).toEqual(['Game', 'Main']);
                expect(func.returnType).toEqual(voidType);
                expect(func.sourceLocation).toEqual(sourceLocation);
                expect(func.parameters).toEqual([]);
                expect(func.localVariables).toEqual([]);
                expect(func.instructions).toEqual([]);
                expect(func.labels.size).toBe(0);
                expect(func.isCallback).toBe(false);
                expect(func.isExported).toBe(false);
            });
        });
    });
    describe('Type Guards', () => {
        const byteType = createPrimitiveType('byte');
        const constant = createILConstant(byteType, 42);
        const variable = createILVariable('test', byteType);
        const register = createILRegister('A', byteType);
        const temporary = createILTemporary(1, byteType);
        const label = createILLabel('test');
        it('should correctly identify constants', () => {
            expect(isILConstant(constant)).toBe(true);
            expect(isILConstant(variable)).toBe(false);
            expect(isILConstant(register)).toBe(false);
        });
        it('should correctly identify variables', () => {
            expect(isILVariable(variable)).toBe(true);
            expect(isILVariable(constant)).toBe(false);
            expect(isILVariable(register)).toBe(false);
        });
        it('should correctly identify registers', () => {
            expect(isILRegister(register)).toBe(true);
            expect(isILRegister(constant)).toBe(false);
            expect(isILRegister(variable)).toBe(false);
        });
        it('should correctly identify temporaries', () => {
            expect(isILTemporary(temporary)).toBe(true);
            expect(isILTemporary(constant)).toBe(false);
            expect(isILTemporary(variable)).toBe(false);
        });
        it('should correctly identify labels', () => {
            expect(isILLabel(label)).toBe(true);
            expect(isILLabel(constant)).toBe(false);
            expect(isILLabel(variable)).toBe(false);
        });
        it('should correctly identify parameter references', () => {
            const paramRef = {
                operandType: 'parameter',
                parameterIndex: 0,
                parameterName: 'arg1',
                type: byteType,
            };
            expect(isILParameterReference(paramRef)).toBe(true);
            expect(isILParameterReference(constant)).toBe(false);
        });
        it('should correctly identify return references', () => {
            const returnRef = {
                operandType: 'return',
                type: byteType,
            };
            expect(isILReturnReference(returnRef)).toBe(true);
            expect(isILReturnReference(constant)).toBe(false);
        });
    });
    describe('Utility Functions', () => {
        describe('ilValueToString', () => {
            const byteType = createPrimitiveType('byte');
            it('should format decimal constants', () => {
                const constant = createILConstant(byteType, 42, 'decimal');
                expect(ilValueToString(constant)).toBe('42');
            });
            it('should format hexadecimal constants', () => {
                const constant = createILConstant(byteType, 255, 'hexadecimal');
                expect(ilValueToString(constant)).toBe('$FF');
            });
            it('should format binary constants', () => {
                const constant = createILConstant(byteType, 7, 'binary');
                expect(ilValueToString(constant)).toBe('0b111');
            });
            it('should format character constants', () => {
                const constant = createILConstant(byteType, 'A', 'character');
                expect(ilValueToString(constant)).toBe("'A'");
            });
            it('should format string constants', () => {
                const constant = createILConstant(byteType, 'Hello', 'string');
                expect(ilValueToString(constant)).toBe('"Hello"');
            });
            it('should format boolean constants', () => {
                const boolType = createPrimitiveType('boolean');
                const constant = createILConstant(boolType, true, 'boolean');
                expect(ilValueToString(constant)).toBe('true');
            });
            it('should format variables', () => {
                const variable = createILVariable('counter', byteType);
                expect(ilValueToString(variable)).toBe('counter');
            });
            it('should format qualified variables', () => {
                const variable = createILVariable('playerX', byteType, ['Game', 'Player']);
                expect(ilValueToString(variable)).toBe('Game.Player.playerX');
            });
            it('should format registers', () => {
                const register = createILRegister('A', byteType);
                expect(ilValueToString(register)).toBe('A');
            });
            it('should format temporaries', () => {
                const temporary = createILTemporary(5, byteType);
                expect(ilValueToString(temporary)).toBe('temp_5');
            });
            it('should format labels', () => {
                const label = createILLabel('loop_start');
                expect(ilValueToString(label)).toBe('loop_start');
            });
        });
        describe('ilInstructionToString', () => {
            it('should format simple instructions', () => {
                const byteType = createPrimitiveType('byte');
                const value = createILConstant(byteType, 42);
                const dest = createILRegister('A', byteType);
                const instruction = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [value], 1, {
                    result: dest,
                });
                const str = ilInstructionToString(instruction);
                expect(str).toBe('LOAD_IMMEDIATE(42) -> A');
            });
            it('should format instructions with multiple operands', () => {
                const byteType = createPrimitiveType('byte');
                const left = createILRegister('A', byteType);
                const right = createILConstant(byteType, 5);
                const result = createILRegister('A', byteType);
                const instruction = createILInstruction(ILInstructionType.ADD, [left, right], 2, {
                    result,
                });
                const str = ilInstructionToString(instruction);
                expect(str).toBe('ADD(A, 5) -> A');
            });
            it('should format instructions without result', () => {
                const byteType = createPrimitiveType('byte');
                const value = createILConstant(byteType, 42);
                const instruction = createILInstruction(ILInstructionType.RETURN, [value], 3);
                const str = ilInstructionToString(instruction);
                expect(str).toBe('RETURN(42)');
            });
        });
        describe('getInstructionCategory', () => {
            it('should categorize memory instructions', () => {
                expect(getInstructionCategory(ILInstructionType.LOAD_IMMEDIATE)).toBe('MEMORY');
                expect(getInstructionCategory(ILInstructionType.STORE_MEMORY)).toBe('MEMORY');
            });
            it('should categorize arithmetic instructions', () => {
                expect(getInstructionCategory(ILInstructionType.ADD)).toBe('ARITHMETIC');
                expect(getInstructionCategory(ILInstructionType.MUL)).toBe('ARITHMETIC');
            });
            it('should categorize control flow instructions', () => {
                expect(getInstructionCategory(ILInstructionType.BRANCH)).toBe('CONTROL_FLOW');
                expect(getInstructionCategory(ILInstructionType.BRANCH_IF_TRUE)).toBe('CONTROL_FLOW');
            });
            it('should categorize hardware instructions', () => {
                expect(getInstructionCategory(ILInstructionType.PEEK)).toBe('HARDWARE');
                expect(getInstructionCategory(ILInstructionType.POKE)).toBe('HARDWARE');
            });
        });
        describe('isInstructionInCategory', () => {
            it('should correctly identify instruction categories', () => {
                expect(isInstructionInCategory(ILInstructionType.ADD, 'ARITHMETIC')).toBe(true);
                expect(isInstructionInCategory(ILInstructionType.ADD, 'MEMORY')).toBe(false);
                expect(isInstructionInCategory(ILInstructionType.BRANCH, 'CONTROL_FLOW')).toBe(true);
                expect(isInstructionInCategory(ILInstructionType.BRANCH, 'ARITHMETIC')).toBe(false);
            });
        });
        describe('getEstimatedCycles', () => {
            it('should provide cycle estimates for memory operations', () => {
                expect(getEstimatedCycles(ILInstructionType.LOAD_IMMEDIATE)).toBe(2);
                expect(getEstimatedCycles(ILInstructionType.LOAD_MEMORY, 'zero_page')).toBe(3);
                expect(getEstimatedCycles(ILInstructionType.LOAD_MEMORY, 'absolute')).toBe(4);
            });
            it('should provide cycle estimates for arithmetic operations', () => {
                expect(getEstimatedCycles(ILInstructionType.ADD)).toBe(2);
                expect(getEstimatedCycles(ILInstructionType.MUL)).toBe(20);
                expect(getEstimatedCycles(ILInstructionType.DIV)).toBe(40);
            });
            it('should provide cycle estimates for function operations', () => {
                expect(getEstimatedCycles(ILInstructionType.CALL)).toBe(6);
                expect(getEstimatedCycles(ILInstructionType.RETURN)).toBe(4);
            });
            it('should provide default estimate for unknown instructions', () => {
                // Using a valid instruction type but checking default behavior
                expect(getEstimatedCycles('UNKNOWN_INSTRUCTION')).toBe(4);
            });
        });
    });
    describe('Constants and Metadata', () => {
        it('should export correct version', () => {
            expect(IL_VERSION).toBe('0.1.0');
        });
        it('should export supported platforms', () => {
            expect(SUPPORTED_PLATFORMS).toEqual(['c64', 'vic20', 'x16']);
        });
        it('should export instruction categories', () => {
            expect(INSTRUCTION_CATEGORIES.MEMORY).toContain('LOAD_IMMEDIATE');
            expect(INSTRUCTION_CATEGORIES.ARITHMETIC).toContain('ADD');
            expect(INSTRUCTION_CATEGORIES.CONTROL_FLOW).toContain('BRANCH');
            expect(INSTRUCTION_CATEGORIES.HARDWARE).toContain('PEEK');
        });
        it('should have all instruction types categorized', () => {
            const allInstructions = Object.values(ILInstructionType);
            const categorizedInstructions = Object.values(INSTRUCTION_CATEGORIES).flat();
            for (const instruction of allInstructions) {
                expect(categorizedInstructions).toContain(instruction);
            }
        });
    });
    describe('Integration Tests', () => {
        it('should create a complete IL function with instructions', () => {
            const byteType = createPrimitiveType('byte');
            const voidType = createPrimitiveType('void');
            // Create function
            const func = createILFunction('testFunction', ['Test', 'Module'], voidType, {
                line: 1,
                column: 1,
                offset: 0,
            });
            // Create some variables
            const counter = createILVariable('counter', byteType, [], null, 'local');
            const value = createILConstant(byteType, 42);
            const regA = createILRegister('A', byteType);
            // Create instructions
            const loadInstr = createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [value], 1, {
                result: regA,
            });
            const storeInstr = createILInstruction(ILInstructionType.STORE_VARIABLE, [counter, regA], 2);
            // Add to function
            func.instructions.push(loadInstr, storeInstr);
            func.localVariables.push({
                name: 'counter',
                type: byteType,
                allocationMethod: 'register',
            });
            // Verify structure
            expect(func.instructions).toHaveLength(2);
            expect(func.localVariables).toHaveLength(1);
            expect(func.instructions[0].type).toBe(ILInstructionType.LOAD_IMMEDIATE);
            expect(func.instructions[1].type).toBe(ILInstructionType.STORE_VARIABLE);
        });
        it('should create a complete IL program structure', () => {
            const program = createILProgram('TestGame');
            const module = createILModule(['Game', 'Main']);
            program.modules.push(module);
            expect(program.modules).toHaveLength(1);
            expect(program.modules[0].qualifiedName).toEqual(['Game', 'Main']);
        });
    });
});
//# sourceMappingURL=il-types.test.js.map