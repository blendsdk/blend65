/**
 * VIC-20 6502 Processor Analyzer - Pure NMOS 6502 implementation
 *
 * Implements cycle-perfect timing analysis for the original MOS 6502 processor
 * used in the VIC-20, serving as the reference implementation for pure 6502
 * behavior without the complexities of banking or advanced interference.
 *
 * Key VIC-20 6502 Features:
 * - Pure NMOS 6502 instruction set and timing
 * - Simple memory layout without banking
 * - VIA 6522 I/O chip timing
 * - No VIC-II interference (simpler VIC chip)
 * - Direct memory access patterns
 */
import { ILFunction, ILInstruction } from '../../il-types.js';
import { Base6502Analyzer } from './base-6502-analyzer.js';
import { InstructionTimingInfo, MemoryLayoutValidationResult, HardwareConstraintValidation, SixtyTwo6502Optimization, InstructionAnalysisContext, PlatformMemoryMap } from '../types/6502-analysis-types.js';
/**
 * VIC-20 6502 specific analyzer implementation
 */
export declare class VIC20_6502Analyzer extends Base6502Analyzer {
    /**
     * Get instruction timing with pure 6502 cycle counts
     */
    getInstructionTiming(instruction: ILInstruction, _context: InstructionAnalysisContext): InstructionTimingInfo;
    /**
     * Get VIC-20 specific platform timing factors
     */
    getPlatformTimingFactors(): Record<string, any>;
    /**
     * Validate VIC-20 memory layout
     */
    validateMemoryLayout(ilFunction: ILFunction): MemoryLayoutValidationResult;
    /**
     * Get VIC-20 platform memory map
     */
    getPlatformMemoryMap(): PlatformMemoryMap;
    /**
     * Validate VIC-20 hardware constraints
     */
    validateHardwareConstraints(ilFunction: ILFunction): HardwareConstraintValidation;
    /**
     * Generate VIC-20 specific optimization recommendations
     */
    generateOptimizationRecommendations(_ilFunction: ILFunction, _analysisResults: any): SixtyTwo6502Optimization[];
    /**
     * Generate VIC-20 platform compatibility report
     */
    generatePlatformCompatibilityReport(_ilFunction: ILFunction, analysisResults: any): any;
    private hasPageBoundaryCrossing;
    private usesZeroPageAddressing;
    private getAddressingMode;
    private analyzeStackUsage;
}
//# sourceMappingURL=vic20-6502-analyzer.d.ts.map