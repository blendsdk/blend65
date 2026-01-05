/**
 * Simplified 6502 code generator for Blend65
 * Basic implementation to enable first compiled programs
 */
import { ILProgram } from '@blend65/il';
export interface SimpleCodeGenOptions {
    /** Target platform (c64, vic20, c128, etc.) */
    target: string;
    /** Include debug information */
    debug: boolean;
    /** Generate auto-run BASIC stub */
    autoRun: boolean;
}
export interface SimpleCodeGenResult {
    /** Generated assembly code */
    assembly: string;
    /** Compilation statistics */
    stats: {
        instructionCount: number;
        codeSize: number;
        compilationTime: number;
    };
}
/**
 * Simple 6502 code generator
 * Generates basic ACME assembly from Blend65 IL
 */
export declare class SimpleCodeGenerator {
    private options;
    private platform;
    private labelCounter;
    constructor(options: SimpleCodeGenOptions);
    /**
     * Generate 6502 assembly from IL program
     */
    generate(program: ILProgram): Promise<SimpleCodeGenResult>;
    /**
     * Generate BASIC stub for auto-run
     */
    private generateBasicStub;
    /**
     * Generate assembly for a function
     */
    private generateFunction;
    /**
     * Helper to check if operand is an IL value (not parameter/return reference)
     */
    private isILValue;
    /**
     * Map IL instruction to 6502 assembly
     */
    private mapInstruction;
    /**
     * Estimate code size from assembly
     */
    private estimateCodeSize;
}
//# sourceMappingURL=simple-code-generator.d.ts.map