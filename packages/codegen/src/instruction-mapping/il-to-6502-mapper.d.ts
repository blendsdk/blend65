/**
 * IL to 6502 instruction mapping system
 * Converts Blend65 IL instructions to 6502 assembly sequences
 */
import { ILInstruction } from '@blend65/il';
import { CommodorePlatform } from '../platform/commodore-platform.js';
export interface CodeGenContext {
    /** Current platform for code generation */
    platform: CommodorePlatform;
    /** Available 6502 registers */
    registers: {
        a: boolean;
        x: boolean;
        y: boolean;
    };
    /** Current stack depth */
    stackDepth: number;
    /** Label counter for unique labels */
    labelCounter: number;
    /** Current function context */
    currentFunction?: string;
}
export interface MappingResult {
    /** Generated 6502 assembly */
    assembly: string[];
    /** Modified register state */
    registersUsed: ('a' | 'x' | 'y')[];
    /** Stack depth change */
    stackChange: number;
    /** Generated labels */
    labels: string[];
}
/**
 * Maps IL instructions to 6502 assembly sequences
 * Handles register allocation, addressing modes, and platform-specific optimizations
 */
export declare class ILTo6502Mapper {
    private context;
    constructor(context: CodeGenContext);
    /**
     * Map single IL instruction to 6502 assembly
     */
    mapInstruction(instruction: ILInstruction): MappingResult;
    /**
     * Map LOAD_IMMEDIATE instruction: Load immediate value into register/memory
     */
    private mapLoadImmediate;
    /**
     * Map LOAD_MEMORY instruction: Load from memory location
     */
    private mapLoadMemory;
    /**
     * Map STORE_MEMORY instruction: Store to memory location
     */
    private mapStoreMemory;
    /**
     * Map COPY instruction: Copy value from source to destination
     */
    private mapCopy;
    /**
     * Map ADD instruction: Add operands
     */
    private mapAdd;
    /**
     * Map SUB instruction: Subtract operands
     */
    private mapSubtract;
    /**
     * Map MUL instruction: 8-bit multiplication
     */
    private mapMultiply;
    /**
     * Map DIV instruction: 8-bit division
     */
    private mapDivide;
    /**
     * Map compare instructions
     */
    private mapCompare;
    /**
     * Map BRANCH instruction: Unconditional branch
     */
    private mapBranch;
    /**
     * Map conditional branch instructions
     */
    private mapConditionalBranch;
    /**
     * Map CALL instruction: Function call
     */
    private mapCall;
    /**
     * Map RETURN instruction: Function return
     */
    private mapReturn;
    /**
     * Map LABEL instruction: Code label
     */
    private mapLabel;
    /**
     * Map NOP instruction: No operation
     */
    private mapNop;
    /**
     * Resolve variable address based on storage class
     */
    private resolveVariableAddress;
    /**
     * Generate unique label
     */
    private generateLabel;
}
//# sourceMappingURL=il-to-6502-mapper.d.ts.map