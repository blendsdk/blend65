/**
 * IL Builder Helper Functions
 * Task 2.6: Complete IL System Integration and Testing
 *
 * Provides convenient helper functions for constructing IL programs, modules,
 * and functions with common patterns and best practices built-in.
 *
 * This builder system makes it easy to construct complex IL structures
 * while maintaining proper validation and optimization hint integration.
 */
import type { ILProgram, ILModule, ILFunction, ILInstruction, ILValue, ILTemporary, ILLabel } from './il-types.js';
/**
 * IL Builder Context
 * Maintains state during IL construction to simplify creation
 */
export interface ILBuilderContext {
    /** Current module being built */
    currentModule: string;
    /** Current function being built */
    currentFunction: string | null;
    /** Next temporary variable ID */
    nextTempId: number;
    /** Next label ID */
    nextLabelId: number;
    /** Compilation target */
    target: 'c64' | 'vic20' | 'x16';
    /** Optimization level */
    optimizationLevel: 'O0' | 'O1' | 'O2' | 'O3';
    /** Debug mode */
    debug: boolean;
}
/**
 * Create a new IL builder context
 */
export declare function createILBuilderContext(moduleName: string, target?: 'c64' | 'vic20' | 'x16', optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3', debug?: boolean): ILBuilderContext;
/**
 * IL Program Builder
 * Convenient builder for creating complete IL programs
 */
export declare class ILProgramBuilder {
    private modules;
    private target;
    private optimizationLevel;
    private debug;
    constructor(target?: 'c64' | 'vic20' | 'x16', optimizationLevel?: 'O0' | 'O1' | 'O2' | 'O3', debug?: boolean);
    /**
     * Add a module to the program
     */
    addModule(module: ILModule): ILProgramBuilder;
    /**
     * Create and add a module using a builder function
     */
    module(name: string, builder: (moduleBuilder: ILModuleBuilder) => void): ILProgramBuilder;
    /**
     * Build the complete IL program
     */
    build(): ILProgram;
}
/**
 * IL Module Builder
 * Convenient builder for creating IL modules
 */
export declare class ILModuleBuilder {
    private functions;
    private context;
    constructor(name: string, target?: 'c64' | 'vic20' | 'x16');
    /**
     * Add a function to the module
     */
    addFunction(func: ILFunction): ILModuleBuilder;
    /**
     * Create and add a function using a builder function
     */
    function(name: string, builder: (functionBuilder: ILFunctionBuilder) => void): ILModuleBuilder;
    /**
     * Build the module
     */
    build(): ILModule;
}
/**
 * IL Function Builder
 * Convenient builder for creating IL functions with common patterns
 */
export declare class ILFunctionBuilder {
    private instructions;
    private parameters;
    private localVariables;
    private context;
    private functionName;
    constructor(name: string, context: ILBuilderContext);
    /**
     * Add an instruction to the function
     */
    addInstruction(instruction: ILInstruction): ILFunctionBuilder;
    /**
     * Create a new temporary variable
     */
    createTemp(_name?: string): ILTemporary;
    /**
     * Create a new label
     */
    createLabel(name?: string): ILLabel;
    /**
     * Add a comment instruction
     */
    comment(text: string): ILFunctionBuilder;
    /**
     * Add a label instruction
     */
    label(label: ILLabel | string): ILFunctionBuilder;
    /**
     * Load immediate value into a temporary
     */
    loadImmediate(value: number, target?: ILTemporary): ILTemporary;
    /**
     * Load variable into a temporary
     */
    loadVariable(variableName: string, target?: ILTemporary): ILTemporary;
    /**
     * Store value to variable
     */
    storeVariable(variableName: string, source: ILValue): ILFunctionBuilder;
    /**
     * Add two values
     */
    add(left: ILValue, right: ILValue, target?: ILTemporary): ILTemporary;
    /**
     * Subtract two values
     */
    subtract(left: ILValue, right: ILValue, target?: ILTemporary): ILTemporary;
    /**
     * Multiply two values
     */
    multiply(left: ILValue, right: ILValue, target?: ILTemporary): ILTemporary;
    /**
     * Divide two values
     */
    divide(left: ILValue, right: ILValue, target?: ILTemporary): ILTemporary;
    /**
     * Unconditional branch
     */
    branch(target: ILLabel): ILFunctionBuilder;
    /**
     * Conditional branch if value is true
     */
    branchIfTrue(condition: ILValue, target: ILLabel): ILFunctionBuilder;
    /**
     * Conditional branch if value is false
     */
    branchIfFalse(condition: ILValue, target: ILLabel): ILFunctionBuilder;
    /**
     * Function call
     */
    call(_functionName: string, args?: ILValue[], target?: ILTemporary): ILTemporary | null;
    /**
     * Return from function
     */
    return(value?: ILValue): ILFunctionBuilder;
    /**
     * Create a simple loop pattern (for common loop constructs)
     */
    simpleLoop(initValue: number, endValue: number, stepValue: number | undefined, loopBody: (builder: ILFunctionBuilder, counter: ILTemporary, exitLabel: ILLabel) => void): ILFunctionBuilder;
    /**
     * Build the function
     */
    build(): ILFunction;
}
/**
 * Convenience functions for common IL construction patterns
 */
/**
 * Create a simple arithmetic expression: (a + b) * c
 */
export declare function createArithmeticExpression(builder: ILFunctionBuilder, a: ILValue, b: ILValue, c: ILValue): ILTemporary;
/**
 * Create a simple if-then-else pattern
 */
export declare function createIfThenElse(builder: ILFunctionBuilder, condition: ILValue, thenBlock: (builder: ILFunctionBuilder) => void, elseBlock?: (builder: ILFunctionBuilder) => void): ILFunctionBuilder;
/**
 * Create a variable assignment pattern
 */
export declare function createAssignment(builder: ILFunctionBuilder, variableName: string, expression: (builder: ILFunctionBuilder) => ILTemporary): ILFunctionBuilder;
/**
 * Create a function prologue (common function entry pattern)
 */
export declare function createFunctionPrologue(builder: ILFunctionBuilder, localVarCount?: number): ILFunctionBuilder;
/**
 * Create a function epilogue (common function exit pattern)
 */
export declare function createFunctionEpilogue(builder: ILFunctionBuilder, returnValue?: ILValue): ILFunctionBuilder;
/**
 * Quick IL program creation for testing and simple cases
 */
export declare function quickProgram(target: "c64" | "vic20" | "x16" | undefined, builder: (programBuilder: ILProgramBuilder) => void): ILProgram;
/**
 * Quick IL function creation for testing
 */
export declare function quickFunction(name: string, builder: (functionBuilder: ILFunctionBuilder) => void): ILFunction;
/**
 * Summary of IL Builder System:
 *
 * ✅ ILBuilderContext for managing construction state
 * ✅ ILProgramBuilder for convenient program construction
 * ✅ ILModuleBuilder for module assembly
 * ✅ ILFunctionBuilder for function construction with common patterns
 * ✅ Temporary variable and label management
 * ✅ Common pattern helpers (if-then-else, loops, arithmetic)
 * ✅ Function prologue/epilogue patterns
 * ✅ Quick construction utilities for testing
 * ✅ Integration with existing IL type system
 * ✅ Support for all target platforms (C64, VIC-20, X16)
 * ✅ Optimization metadata integration
 *
 * The builder system provides:
 * - Fluent API for readable IL construction
 * - Automatic temporary and label management
 * - Common pattern helpers to reduce boilerplate
 * - Integration with optimization framework
 * - Support for complex control flow patterns
 * - Easy testing and debugging utilities
 */
//# sourceMappingURL=il-builder.d.ts.map