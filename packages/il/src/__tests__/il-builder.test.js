/**
 * IL Builder Integration Tests
 * Task 2.6: Complete IL System Integration and Testing
 *
 * Comprehensive tests for the IL Builder system including:
 * - Program construction
 * - Module assembly
 * - Function building
 * - Common patterns
 * - Integration with optimization framework
 * - Performance benchmarking
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ILProgramBuilder, ILModuleBuilder, ILFunctionBuilder, createILBuilderContext, quickProgram, quickFunction, createArithmeticExpression, createIfThenElse, createAssignment, createFunctionPrologue, createFunctionEpilogue, } from '../il-builder.js';
import { createILConstant, ILInstructionType } from '../il-types.js';
// Helper function to create a basic byte type
const byteType = { kind: 'primitive', name: 'byte' };
describe('IL Builder System Integration Tests', () => {
    let context;
    let programBuilder;
    let moduleBuilder;
    let functionBuilder;
    beforeEach(() => {
        context = createILBuilderContext('TestModule', 'c64', 'O1', false);
        programBuilder = new ILProgramBuilder('c64', 'O1', false);
        moduleBuilder = new ILModuleBuilder('TestModule', 'c64');
        functionBuilder = new ILFunctionBuilder('testFunction', context);
    });
    describe('IL Builder Context', () => {
        it('should create a valid builder context', () => {
            expect(context.currentModule).toBe('TestModule');
            expect(context.currentFunction).toBeNull();
            expect(context.nextTempId).toBe(1);
            expect(context.nextLabelId).toBe(1);
            expect(context.target).toBe('c64');
            expect(context.optimizationLevel).toBe('O1');
            expect(context.debug).toBe(false);
        });
        it('should support different targets', () => {
            const vic20Context = createILBuilderContext('VIC20Module', 'vic20');
            expect(vic20Context.target).toBe('vic20');
            const x16Context = createILBuilderContext('X16Module', 'x16');
            expect(x16Context.target).toBe('x16');
        });
        it('should support different optimization levels', () => {
            const o0Context = createILBuilderContext('Module', 'c64', 'O0');
            expect(o0Context.optimizationLevel).toBe('O0');
            const o3Context = createILBuilderContext('Module', 'c64', 'O3');
            expect(o3Context.optimizationLevel).toBe('O3');
        });
    });
    describe('IL Program Builder', () => {
        it('should build an empty program', () => {
            const program = programBuilder.build();
            expect(program.name).toBe('generated_program');
            expect(program.modules).toHaveLength(0);
            expect(program.sourceInfo.targetPlatform).toBe('c64');
            expect(program.sourceInfo.compilationOptions?.optimizationLevel).toBe('O1');
        });
        it('should build a program with modules', () => {
            const program = programBuilder
                .module('GameModule', m => {
                m.function('main', f => {
                    f.comment('Main function');
                    f.return();
                });
            })
                .module('UtilsModule', m => {
                m.function('helper', f => {
                    f.comment('Helper function');
                    f.return();
                });
            })
                .build();
            expect(program.modules).toHaveLength(2);
            expect(program.modules[0].qualifiedName).toEqual(['GameModule']);
            expect(program.modules[1].qualifiedName).toEqual(['UtilsModule']);
            expect(program.modules[0].functions).toHaveLength(1);
            expect(program.modules[1].functions).toHaveLength(1);
        });
        it('should include optimization metadata in program', () => {
            const program = programBuilder.build();
            expect(program.optimizationMetadata).toBeDefined();
            expect(program.optimizationMetadata?.totalInstructions).toBe(0);
            expect(program.optimizationMetadata?.hotPaths).toEqual([]);
            expect(program.optimizationMetadata?.globalOptimizations).toEqual([]);
            expect(program.optimizationMetadata?.resourceUsage.memoryUsage).toBe(0);
        });
    });
    describe('IL Module Builder', () => {
        it('should build an empty module', () => {
            const module = moduleBuilder.build();
            expect(module.qualifiedName).toEqual(['TestModule']);
            expect(module.functions).toHaveLength(0);
            expect(module.moduleData).toEqual([]);
            expect(module.exports).toEqual([]);
            expect(module.imports).toEqual([]);
        });
        it('should build a module with functions', () => {
            const module = moduleBuilder
                .function('func1', f => {
                f.comment('Function 1');
                f.return();
            })
                .function('func2', f => {
                f.comment('Function 2');
                f.return();
            })
                .build();
            expect(module.functions).toHaveLength(2);
            expect(module.functions[0].name).toBe('func1');
            expect(module.functions[1].name).toBe('func2');
        });
        it('should include optimization metadata in module', () => {
            const module = moduleBuilder.function('testFunc', f => f.return()).build();
            expect(module.optimizationMetadata).toBeDefined();
            expect(module.optimizationMetadata?.instructionCount).toBe(0);
            expect(module.optimizationMetadata?.moduleResourceUsage.instructionCount).toBe(1);
        });
    });
    describe('IL Function Builder', () => {
        it('should build an empty function', () => {
            const func = functionBuilder.build();
            expect(func.name).toBe('testFunction');
            expect(func.qualifiedName).toEqual(['TestModule']);
            expect(func.instructions).toHaveLength(0);
            expect(func.parameters).toEqual([]);
            expect(func.localVariables).toEqual([]);
        });
        it('should create temporary variables with incrementing IDs', () => {
            const temp1 = functionBuilder.createTemp();
            const temp2 = functionBuilder.createTemp('namedTemp');
            const temp3 = functionBuilder.createTemp();
            expect(temp1.id).toBe(1);
            expect(temp2.id).toBe(2);
            expect(temp3.id).toBe(3);
            expect(temp1.scope).toBe('function');
            expect(temp2.scope).toBe('function');
            expect(temp3.scope).toBe('function');
        });
        it('should create labels with incrementing IDs', () => {
            const label1 = functionBuilder.createLabel();
            const label2 = functionBuilder.createLabel('namedLabel');
            const label3 = functionBuilder.createLabel();
            expect(label1.name).toBe('label_1');
            expect(label2.name).toBe('namedLabel');
            expect(label3.name).toBe('label_2');
        });
        it('should build function with instructions', () => {
            functionBuilder.comment('Start of function');
            functionBuilder.loadImmediate(42);
            functionBuilder.loadVariable('testVar');
            functionBuilder.return();
            const func = functionBuilder.build();
            expect(func.instructions).toHaveLength(4);
            expect(func.instructions[0].type).toBe(ILInstructionType.COMMENT);
            expect(func.instructions[1].type).toBe(ILInstructionType.LOAD_IMMEDIATE);
            expect(func.instructions[2].type).toBe(ILInstructionType.LOAD_VARIABLE);
            expect(func.instructions[3].type).toBe(ILInstructionType.RETURN);
        });
        it('should support arithmetic operations', () => {
            const val1 = functionBuilder.loadImmediate(10);
            const val2 = functionBuilder.loadImmediate(20);
            const sum = functionBuilder.add(val1, val2);
            const product = functionBuilder.multiply(sum, functionBuilder.loadImmediate(2));
            const func = functionBuilder.return(product).build();
            expect(func.instructions).toHaveLength(6); // 3 loads + 1 add + 1 mul + 1 return
        });
        it('should support control flow operations', () => {
            const condition = functionBuilder.loadImmediate(1);
            const endLabel = functionBuilder.createLabel('end');
            const func = functionBuilder
                .branchIfTrue(condition, endLabel)
                .comment('This runs if condition is false')
                .label(endLabel)
                .comment('This always runs')
                .return()
                .build();
            expect(func.instructions).toHaveLength(6);
            expect(func.instructions[1].type).toBe(ILInstructionType.BRANCH_IF_TRUE);
            expect(func.instructions[3].type).toBe(ILInstructionType.LABEL);
        });
        it('should include IL optimization metadata', () => {
            const func = functionBuilder.build();
            expect(func.ilOptimizationMetadata).toBeDefined();
            expect(func.ilOptimizationMetadata?.controlFlowGraph).toBeDefined();
            expect(func.ilOptimizationMetadata?.basicBlocks).toEqual([]);
            expect(func.ilOptimizationMetadata?.dataFlowAnalysis).toBeDefined();
            expect(func.ilOptimizationMetadata?.registerUsage).toBeDefined();
        });
    });
    describe('Quick Builder Functions', () => {
        it('should create a quick program', () => {
            const program = quickProgram('c64', pb => {
                pb.module('QuickModule', mb => {
                    mb.function('quickFunc', fb => {
                        fb.comment('Quick function');
                        fb.return();
                    });
                });
            });
            expect(program.name).toBe('generated_program');
            expect(program.modules).toHaveLength(1);
            expect(program.modules[0].functions).toHaveLength(1);
        });
        it('should create a quick function', () => {
            const func = quickFunction('quickFunc', fb => {
                fb.comment('Quick function implementation');
                const result = fb.loadImmediate(100);
                fb.return(result);
            });
            expect(func.name).toBe('quickFunc');
            expect(func.instructions).toHaveLength(3);
            expect(func.instructions[0].type).toBe(ILInstructionType.COMMENT);
            expect(func.instructions[1].type).toBe(ILInstructionType.LOAD_IMMEDIATE);
            expect(func.instructions[2].type).toBe(ILInstructionType.RETURN);
        });
    });
    describe('Common Pattern Helpers', () => {
        it('should create arithmetic expressions', () => {
            const a = createILConstant(byteType, 5, 'decimal');
            const b = createILConstant(byteType, 10, 'decimal');
            const c = createILConstant(byteType, 2, 'decimal');
            const result = createArithmeticExpression(functionBuilder, a, b, c);
            const func = functionBuilder.return(result).build();
            // Should have: add(a, b) -> temp1, mul(temp1, c) -> temp2, return temp2
            expect(func.instructions).toHaveLength(3);
            expect(func.instructions[0].type).toBe(ILInstructionType.ADD);
            expect(func.instructions[1].type).toBe(ILInstructionType.MUL);
            expect(func.instructions[2].type).toBe(ILInstructionType.RETURN);
        });
        it('should create if-then-else patterns', () => {
            const condition = functionBuilder.loadImmediate(1);
            createIfThenElse(functionBuilder, condition, fb => {
                fb.comment('Then block');
                fb.loadImmediate(42);
            }, fb => {
                fb.comment('Else block');
                fb.loadImmediate(0);
            });
            const func = functionBuilder.return().build();
            // Should have proper if-then-else structure with branches and labels
            const instructions = func.instructions;
            expect(instructions.some(i => i.type === ILInstructionType.BRANCH_IF_FALSE)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.BRANCH)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.LABEL)).toBe(true);
        });
        it('should create assignment patterns', () => {
            createAssignment(functionBuilder, 'result', fb => {
                const val = fb.loadImmediate(42);
                return fb.add(val, fb.loadImmediate(8));
            });
            const func = functionBuilder.return().build();
            // Should have loads, add, and store
            expect(func.instructions.some(i => i.type === ILInstructionType.LOAD_IMMEDIATE)).toBe(true);
            expect(func.instructions.some(i => i.type === ILInstructionType.ADD)).toBe(true);
            expect(func.instructions.some(i => i.type === ILInstructionType.STORE_VARIABLE)).toBe(true);
        });
        it('should create function prologue and epilogue', () => {
            createFunctionPrologue(functionBuilder, 2);
            functionBuilder.comment('Function body');
            const returnVal = functionBuilder.loadImmediate(0);
            createFunctionEpilogue(functionBuilder, returnVal);
            const func = functionBuilder.build();
            // Should start with prologue, have body, end with epilogue
            expect(func.instructions[0].type).toBe(ILInstructionType.COMMENT); // "Function prologue"
            expect(func.instructions[1].type).toBe(ILInstructionType.DECLARE_LOCAL);
            expect(func.instructions[2].type).toBe(ILInstructionType.DECLARE_LOCAL);
            expect(func.instructions[3].type).toBe(ILInstructionType.COMMENT); // "Function body"
            expect(func.instructions[5].type).toBe(ILInstructionType.COMMENT); // "Function epilogue"
            expect(func.instructions[6].type).toBe(ILInstructionType.RETURN);
        });
    });
    describe('Complex Integration Patterns', () => {
        it('should build a complete game loop function', () => {
            const gameLoop = quickFunction('gameLoop', fb => {
                createFunctionPrologue(fb, 3); // 3 local variables
                fb.comment('Game initialization');
                const frameCounter = fb.loadImmediate(0);
                fb.storeVariable('frameCounter', frameCounter);
                fb.comment('Main game loop');
                fb.simpleLoop(0, 60, 1, (builder, counter, exitLabel) => {
                    builder.comment('Update game state');
                    const currentFrame = builder.loadVariable('frameCounter');
                    const nextFrame = builder.add(currentFrame, builder.loadImmediate(1));
                    builder.storeVariable('frameCounter', nextFrame);
                    builder.comment('Check for exit condition');
                    const maxFrames = builder.loadImmediate(60);
                    // In a real implementation, we'd have proper comparison and conditional exit
                    builder.comment('Exit check would go here');
                });
                fb.comment('Game cleanup');
                createFunctionEpilogue(fb, fb.loadImmediate(0));
            });
            expect(gameLoop.name).toBe('gameLoop');
            expect(gameLoop.instructions.length).toBeGreaterThan(10);
            // Verify it has the expected structure
            const instructions = gameLoop.instructions;
            expect(instructions.some(i => i.type === ILInstructionType.COMMENT)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.DECLARE_LOCAL)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.LOAD_IMMEDIATE)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.STORE_VARIABLE)).toBe(true);
        });
        it('should build a math utility function with multiple operations', () => {
            const mathFunc = quickFunction('calculateScore', fb => {
                fb.comment('Calculate game score: (base * multiplier) + bonus');
                // Load parameters (simulated)
                const base = fb.loadImmediate(100);
                const multiplier = fb.loadImmediate(2);
                const bonus = fb.loadImmediate(50);
                // Calculate (base * multiplier) + bonus
                const result = createArithmeticExpression(fb, base, multiplier, bonus);
                // Store in a variable for later use
                fb.storeVariable('finalScore', result);
                // Return the result
                fb.return(result);
            });
            expect(mathFunc.name).toBe('calculateScore');
            const instructions = mathFunc.instructions;
            expect(instructions.some(i => i.type === ILInstructionType.LOAD_IMMEDIATE)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.MUL)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.ADD)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.STORE_VARIABLE)).toBe(true);
            expect(instructions.some(i => i.type === ILInstructionType.RETURN)).toBe(true);
        });
    });
    describe('Performance and Validation', () => {
        it('should handle large function construction efficiently', () => {
            const startTime = performance.now();
            const largeFunc = quickFunction('largeFunction', fb => {
                // Create a function with many instructions
                for (let i = 0; i < 1000; i++) {
                    fb.comment(`Instruction ${i}`);
                    const val = fb.loadImmediate(i % 256);
                    if (i % 10 === 0) {
                        fb.storeVariable(`var_${i}`, val);
                    }
                }
                fb.return();
            });
            const endTime = performance.now();
            const buildTime = endTime - startTime;
            // Should complete in reasonable time (< 100ms)
            expect(buildTime).toBeLessThan(100);
            expect(largeFunc.instructions.length).toBeGreaterThan(2000); // Verify we have many instructions
        });
        it('should maintain temporary ID consistency', () => {
            const func = quickFunction('tempTest', fb => {
                const temp1 = fb.createTemp();
                const temp2 = fb.createTemp();
                const temp3 = fb.createTemp();
                expect(temp1.id).toBe(1);
                expect(temp2.id).toBe(2);
                expect(temp3.id).toBe(3);
                // Use temporaries in operations
                fb.add(temp1, temp2, temp3);
                fb.return(temp3);
            });
            expect(func.instructions).toHaveLength(2);
        });
        it('should support all target platforms consistently', () => {
            const targets = ['c64', 'vic20', 'x16'];
            for (const target of targets) {
                const program = quickProgram(target, pb => {
                    pb.module('TestModule', mb => {
                        mb.function('testFunc', fb => {
                            fb.comment(`Function for ${target}`);
                            fb.return();
                        });
                    });
                });
                expect(program.sourceInfo.targetPlatform).toBe(target);
                expect(program.modules[0].functions[0].instructions).toHaveLength(2);
            }
        });
    });
});
/**
 * Performance Benchmarks for IL Builder System
 */
describe('IL Builder Performance Benchmarks', () => {
    it('should benchmark program construction performance', () => {
        const iterations = 100;
        const startTime = performance.now();
        for (let i = 0; i < iterations; i++) {
            const program = quickProgram('c64', pb => {
                pb.module('BenchModule', mb => {
                    mb.function('benchFunc', fb => {
                        fb.comment('Benchmark function');
                        const val1 = fb.loadImmediate(i);
                        const val2 = fb.loadImmediate(i * 2);
                        const result = fb.add(val1, val2);
                        fb.return(result);
                    });
                });
            });
            // Verify the program was built correctly
            expect(program.modules).toHaveLength(1);
        }
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / iterations;
        // Average time per program should be reasonable (< 1ms)
        expect(avgTime).toBeLessThan(1);
        console.log(`IL Builder Performance: ${iterations} programs built in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(3)}ms per program)`);
    });
    it('should benchmark complex function construction', () => {
        const startTime = performance.now();
        const complexFunc = quickFunction('complexFunction', fb => {
            // Simulate a complex function with many operations
            for (let i = 0; i < 100; i++) {
                const val1 = fb.loadImmediate(i);
                const val2 = fb.loadImmediate(i + 1);
                const sum = fb.add(val1, val2);
                const product = fb.multiply(sum, fb.loadImmediate(2));
                createIfThenElse(fb, product, builder => {
                    builder.storeVariable(`result_${i}`, product);
                }, builder => {
                    builder.storeVariable(`result_${i}`, fb.loadImmediate(0));
                });
            }
            fb.return();
        });
        const endTime = performance.now();
        const buildTime = endTime - startTime;
        // Should complete complex function in reasonable time (< 50ms)
        expect(buildTime).toBeLessThan(50);
        // Verify the function has expected number of instructions
        expect(complexFunc.instructions.length).toBeGreaterThan(500);
        console.log(`Complex Function Build: ${complexFunc.instructions.length} instructions in ${buildTime.toFixed(2)}ms`);
    });
});
//# sourceMappingURL=il-builder.test.js.map