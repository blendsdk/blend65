/**
 * C64 6510 Processor Analyzer - Commodore 64 specific implementation
 *
 * Implements cycle-perfect timing analysis for the MOS 6510 processor
 * used in the Commodore 64, including VIC-II interference modeling,
 * bank switching validation, and C64-specific hardware constraints.
 *
 * Key C64 6510 Features:
 * - Built-in I/O port at $00/$01 for bank switching
 * - VIC-II memory interference (badlines, DMA cycles)
 * - SID timing constraints
 * - CIA timer validation
 * - C64-specific memory layout ($0000-$FFFF with banking)
 */
import { ILFunction, ILInstruction } from '../../il-types.js';
import { Base6502Analyzer } from './base-6502-analyzer.js';
import { InstructionTimingInfo, MemoryLayoutValidationResult, HardwareConstraintValidation, SixtyTwo6502Optimization, InstructionAnalysisContext, PlatformMemoryMap, CycleTimingResult, RegisterAllocationAnalysis, PerformanceHotspotAnalysis } from '../types/6502-analysis-types.js';
/**
 * C64 6510 specific analyzer implementation
 */
export declare class C64_6510Analyzer extends Base6502Analyzer {
    private currentRasterLine;
    private currentCycle;
    /**
     * Get instruction timing with C64 6510 specific cycle counts
     */
    getInstructionTiming(instruction: ILInstruction, context: InstructionAnalysisContext): InstructionTimingInfo;
    /**
     * Get C64-specific platform timing factors
     */
    getPlatformTimingFactors(): Record<string, any>;
    /**
     * Validate C64 memory layout
     */
    validateMemoryLayout(ilFunction: ILFunction): MemoryLayoutValidationResult;
    /**
     * Get C64 platform memory map
     */
    getPlatformMemoryMap(): PlatformMemoryMap;
    /**
     * Validate C64 hardware constraints
     */
    validateHardwareConstraints(ilFunction: ILFunction): HardwareConstraintValidation;
    /**
     * Generate C64-specific optimization recommendations
     */
    generateOptimizationRecommendations(ilFunction: ILFunction, analysisResults: {
        timing: CycleTimingResult;
        memory: MemoryLayoutValidationResult;
        registers: RegisterAllocationAnalysis;
        hotspots: PerformanceHotspotAnalysis;
        constraints: HardwareConstraintValidation;
    }): SixtyTwo6502Optimization[];
    /**
     * Generate C64 platform compatibility report
     */
    generatePlatformCompatibilityReport(ilFunction: ILFunction, analysisResults: {
        timing: CycleTimingResult;
        memory: MemoryLayoutValidationResult;
    }): any;
    private hasPageBoundaryCrossing;
    private calculateVICInterference;
    private usesZeroPageAddressing;
    private getAddressingMode;
    private isOnCriticalPath;
    private analyzeVariableMemoryAllocation;
    private analyzeStackUsage;
    private estimateCallDepth;
    private validateC64TimingConstraints;
    private validateC64HardwareResources;
    private findZeroPageOptimizations;
    private findVICTimingOptimizations;
    private findC64RegisterOptimizations;
    private findC64HardwareOptimizations;
    private calculateC64CompatibilityScore;
    private identifyC64CompatibilityIssues;
    private generateC64CompatibilityRecommendations;
}
//# sourceMappingURL=c64-6510-analyzer.d.ts.map