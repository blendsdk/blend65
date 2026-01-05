/**
 * X16 65C02 Processor Analyzer - Commander X16 specific implementation
 *
 * Implements cycle-perfect timing analysis for the WDC 65C02 processor
 * used in the Commander X16, including enhanced CMOS features,
 * additional instructions, and VERA graphics chip integration.
 *
 * Key X16 65C02 Features:
 * - Enhanced CMOS 65C02 instruction set
 * - Additional addressing modes ((zp) indirect)
 * - New instructions (BRA, PHX, PHY, PLX, PLY, STZ, TRB, TSB)
 * - VERA graphics chip integration
 * - Enhanced memory banking capabilities
 * - Improved timing characteristics vs NMOS 6502
 */
import { ILFunction, ILInstruction } from '../../il-types.js';
import { Base6502Analyzer } from './base-6502-analyzer.js';
import { InstructionTimingInfo, MemoryLayoutValidationResult, HardwareConstraintValidation, SixtyTwo6502Optimization, InstructionAnalysisContext, PlatformMemoryMap } from '../types/6502-analysis-types.js';
/**
 * X16 65C02 specific analyzer implementation
 */
export declare class X16_65C02Analyzer extends Base6502Analyzer {
    /**
     * Get instruction timing with 65C02 enhanced cycle counts
     */
    getInstructionTiming(instruction: ILInstruction, _context: InstructionAnalysisContext): InstructionTimingInfo;
    /**
     * Get X16 specific platform timing factors
     */
    getPlatformTimingFactors(): Record<string, any>;
    /**
     * Validate X16 memory layout
     */
    validateMemoryLayout(ilFunction: ILFunction): MemoryLayoutValidationResult;
    /**
     * Get X16 platform memory map
     */
    getPlatformMemoryMap(): PlatformMemoryMap;
    /**
     * Validate X16 hardware constraints
     */
    validateHardwareConstraints(ilFunction: ILFunction): HardwareConstraintValidation;
    /**
     * Generate X16 specific optimization recommendations
     */
    generateOptimizationRecommendations(_ilFunction: ILFunction, _analysisResults: any): SixtyTwo6502Optimization[];
    /**
     * Generate X16 platform compatibility report
     */
    generatePlatformCompatibilityReport(_ilFunction: ILFunction, analysisResults: any): any;
    private hasPageBoundaryCrossing;
    private usesEnhancedAddressing;
    private usesZeroPageAddressing;
    private getAddressingMode;
    private analyzeStackUsage;
}
//# sourceMappingURL=x16-65c02-analyzer.d.ts.map