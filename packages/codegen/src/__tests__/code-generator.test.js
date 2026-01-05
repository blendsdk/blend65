/**
 * Tests for the code generators
 */
import { describe, it, expect } from 'vitest';
import { createILProgram, createILModule, createILFunction, ILInstructionType, createILInstruction, createILConstant } from '@blend65/il';
import { SimpleCodeGenerator } from '../simple-code-generator.js';
describe('SimpleCodeGenerator', () => {
    const defaultOptions = {
        target: 'c64',
        debug: false,
        autoRun: true
    };
    it('should create a simple code generator instance', () => {
        expect(() => {
            new SimpleCodeGenerator(defaultOptions);
        }).not.toThrow();
    });
    it('should generate basic assembly for empty program', async () => {
        // Create a minimal IL program for testing
        const program = createILProgram('test');
        program.modules = [];
        program.globalData = [];
        program.imports = [];
        program.exports = [];
        const generator = new SimpleCodeGenerator(defaultOptions);
        const result = await generator.generate(program);
        expect(result).toBeDefined();
        expect(result.assembly).toContain('Blend65 Generated Assembly - test');
        expect(result.assembly).toContain('Commodore 64');
        expect(result.assembly).toContain('BASIC Stub');
        expect(result.assembly).toContain('Program cleanup');
        expect(result.stats.compilationTime).toBeGreaterThan(0);
    });
    it('should generate assembly with global data', async () => {
        const program = createILProgram('test_with_data');
        program.modules = [];
        program.globalData = [
            {
                name: 'myConstant',
                qualifiedName: ['Main'],
                type: { name: 'byte' },
                storageClass: 'const',
                initialValue: createILConstant({ name: 'byte' }, 42),
                isExported: false
            },
            {
                name: 'myVariable',
                qualifiedName: ['Main'],
                type: { name: 'byte' },
                storageClass: 'data',
                initialValue: createILConstant({ name: 'byte' }, 0),
                isExported: false
            }
        ];
        program.imports = [];
        program.exports = [];
        const generator = new SimpleCodeGenerator(defaultOptions);
        const result = await generator.generate(program);
        expect(result.assembly).toContain('Global Data Section');
        expect(result.assembly).toContain('Main_myConstant = 42');
        expect(result.assembly).toContain('Main_myVariable: !byte 0');
    });
    it('should generate assembly with function', async () => {
        // Create a simple function that loads a constant and returns
        const func = createILFunction('testFunction', ['Main', 'testFunction'], { name: 'byte' }, { line: 1, column: 1, length: 10 });
        // Add some simple instructions
        func.instructions = [
            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ name: 'byte' }, 42)], 1, { sourceLocation: { line: 1, column: 1, length: 5 } }),
            createILInstruction(ILInstructionType.RETURN, [], 2, { sourceLocation: { line: 2, column: 1, length: 6 } })
        ];
        const module = createILModule(['Main']);
        module.functions = [func];
        const program = createILProgram('test_with_function');
        program.modules = [module];
        program.globalData = [];
        program.imports = [];
        program.exports = [];
        const generator = new SimpleCodeGenerator(defaultOptions);
        const result = await generator.generate(program);
        expect(result.assembly).toContain('Module: Main');
        expect(result.assembly).toContain('Function: testFunction');
        expect(result.assembly).toContain('Main_testFunction:');
        expect(result.assembly).toContain('LDA #42');
        expect(result.assembly).toContain('RTS');
        expect(result.stats.instructionCount).toBe(2);
    });
    it('should support multiple platforms', () => {
        const c64Generator = new SimpleCodeGenerator({ target: 'c64', debug: false, autoRun: true });
        expect(c64Generator).toBeDefined();
        const vic20Generator = new SimpleCodeGenerator({ target: 'vic20', debug: false, autoRun: true });
        expect(vic20Generator).toBeDefined();
        const c128Generator = new SimpleCodeGenerator({ target: 'c128', debug: false, autoRun: true });
        expect(c128Generator).toBeDefined();
    });
    it('should reject unsupported platform', () => {
        expect(() => {
            new SimpleCodeGenerator({ target: 'invalid', debug: false, autoRun: true });
        }).toThrow('Unsupported platform: invalid');
    });
    it('should generate different BASIC stubs for different platforms', async () => {
        const program = createILProgram('platform_test');
        program.modules = [];
        program.globalData = [];
        program.imports = [];
        program.exports = [];
        // Test C64 (starts at $0801)
        const c64Generator = new SimpleCodeGenerator({ target: 'c64', debug: false, autoRun: true });
        const c64Result = await c64Generator.generate(program);
        expect(c64Result.assembly).toContain('* = $0801');
        expect(c64Result.assembly).toContain('* = $0810');
        // Test VIC-20 (starts at $1001)
        const vic20Generator = new SimpleCodeGenerator({ target: 'vic20', debug: false, autoRun: true });
        const vic20Result = await vic20Generator.generate(program);
        expect(vic20Result.assembly).toContain('* = $1001');
        expect(vic20Result.assembly).toContain('* = $1010');
    });
    it('should handle arithmetic operations', async () => {
        const func = createILFunction('mathFunction', ['Main', 'mathFunction'], { name: 'byte' }, { line: 1, column: 1, length: 10 });
        func.instructions = [
            // Load 10
            createILInstruction(ILInstructionType.LOAD_IMMEDIATE, [createILConstant({ name: 'byte' }, 10)], 1),
            // Add 5 (10 + 5)
            createILInstruction(ILInstructionType.ADD, [
                createILConstant({ name: 'byte' }, 10),
                createILConstant({ name: 'byte' }, 5)
            ], 2),
            // Subtract 3 (15 - 3)
            createILInstruction(ILInstructionType.SUB, [
                createILConstant({ name: 'byte' }, 15),
                createILConstant({ name: 'byte' }, 3)
            ], 3),
            createILInstruction(ILInstructionType.RETURN, [], 4)
        ];
        const module = createILModule(['Main']);
        module.functions = [func];
        const program = createILProgram('math_test');
        program.modules = [module];
        program.globalData = [];
        program.imports = [];
        program.exports = [];
        const generator = new SimpleCodeGenerator(defaultOptions);
        const result = await generator.generate(program);
        expect(result.assembly).toContain('LDA #10');
        expect(result.assembly).toContain('CLC');
        expect(result.assembly).toContain('ADC #5');
        expect(result.assembly).toContain('SEC');
        expect(result.assembly).toContain('SBC #3');
        expect(result.stats.instructionCount).toBe(4);
    });
});
//# sourceMappingURL=code-generator.test.js.map