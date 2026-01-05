/**
 * Base 6502 Analyzer - Abstract foundation for all 6502 family processors
 *
 * Implements common functionality shared across all 6502 variants while
 * providing abstract methods for processor-specific behavior.
 *
 * This class establishes the contract for cycle-perfect timing analysis,
 * memory layout validation, and hardware constraint checking that all
 * 6502 family processors must implement.
 */
import { ILFunction, ILInstruction, ILValue, Register6502 } from '../../il-types.js';
import { ControlFlowAnalysisResult } from '../types/control-flow-types.js';
import { SixtyTwo6502AnalysisOptions, ProcessorVariant, PlatformTarget, InstructionTimingInfo, CycleTimingResult, MemoryLayoutValidationResult, RegisterAllocationAnalysis, PerformanceHotspotAnalysis, HardwareConstraintValidation, SixtyTwo6502Optimization, InstructionAnalysisContext, PlatformMemoryMap } from '../types/6502-analysis-types.js';
/**
 * Abstract base class for all 6502 family processor analyzers
 *
 * Provides common functionality while requiring processor-specific
 * implementations for timing, memory layout, and hardware features.
 */
export declare abstract class Base6502Analyzer {
    protected readonly options: SixtyTwo6502AnalysisOptions;
    protected readonly processorVariant: ProcessorVariant;
    protected readonly platformTarget: PlatformTarget;
    constructor(options: SixtyTwo6502AnalysisOptions);
    /**
     * Get processor-specific instruction timing
     *
     * @param instruction IL instruction to analyze
     * @param context Execution context for the instruction
     * @returns Detailed timing information including cycle-perfect counts
     */
    abstract getInstructionTiming(instruction: ILInstruction, context: InstructionAnalysisContext): InstructionTimingInfo;
    /**
     * Get platform-specific timing factors
     *
     * @returns Platform-specific timing information (VIC interference, etc.)
     */
    abstract getPlatformTimingFactors(): Record<string, any>;
    /**
     * Validate memory layout for target platform
     *
     * @param ilFunction IL function to validate
     * @returns Memory layout validation result
     */
    abstract validateMemoryLayout(ilFunction: ILFunction): MemoryLayoutValidationResult;
    /**
     * Get platform memory map
     *
     * @returns Complete memory map for target platform
     */
    abstract getPlatformMemoryMap(): PlatformMemoryMap;
    /**
     * Validate hardware-specific constraints
     *
     * @param ilFunction IL function to validate
     * @returns Hardware constraint validation result
     */
    abstract validateHardwareConstraints(ilFunction: ILFunction): HardwareConstraintValidation;
    /**
     * Generate platform-specific optimization recommendations
     *
     * @param ilFunction IL function to optimize
     * @param analysisResults Combined analysis results
     * @returns Array of optimization recommendations
     */
    abstract generateOptimizationRecommendations(ilFunction: ILFunction, analysisResults: {
        timing: CycleTimingResult;
        memory: MemoryLayoutValidationResult;
        registers: RegisterAllocationAnalysis;
        hotspots: PerformanceHotspotAnalysis;
        constraints: HardwareConstraintValidation;
    }): SixtyTwo6502Optimization[];
    /**
     * Generate platform compatibility report
     *
     * @param ilFunction IL function to analyze
     * @param analysisResults Combined analysis results
     * @returns Platform compatibility information
     */
    abstract generatePlatformCompatibilityReport(ilFunction: ILFunction, analysisResults: {
        timing: CycleTimingResult;
        memory: MemoryLayoutValidationResult;
    }): any;
    /**
     * Analyze register allocation for IL function
     *
     * @param ilFunction IL function to analyze
     * @param cfgAnalysis Control flow graph analysis
     * @returns Register allocation analysis
     */
    analyzeRegisterAllocation(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult): RegisterAllocationAnalysis;
    /**
     * Detect performance hotspots in IL function
     *
     * @param ilFunction IL function to analyze
     * @param timingAnalysis Timing analysis results
     * @param cfgAnalysis Control flow graph analysis
     * @returns Performance hotspot analysis
     */
    detectPerformanceHotspots(_ilFunction: ILFunction, timingAnalysis: CycleTimingResult, cfgAnalysis: ControlFlowAnalysisResult): PerformanceHotspotAnalysis;
    /**
     * Calculate register pressure across the function
     */
    protected calculateRegisterPressure(ilFunction: ILFunction): any;
    /**
     * Generate register allocation recommendations
     */
    protected generateRegisterRecommendations(ilFunction: ILFunction, cfgAnalysis: ControlFlowAnalysisResult): any[];
    /**
     * Analyze register interference patterns
     */
    protected analyzeRegisterInterference(_ilFunction: ILFunction, _cfgAnalysis: ControlFlowAnalysisResult): any;
    /**
     * Find register optimization opportunities
     */
    protected findRegisterOptimizationOpportunities(ilFunction: ILFunction): any[];
    /**
     * Identify performance hotspot instructions
     */
    protected identifyHotspotInstructions(timingAnalysis: CycleTimingResult, cfgAnalysis: ControlFlowAnalysisResult): any[];
    /**
     * Find critical execution paths
     */
    protected findCriticalPaths(_cfgAnalysis: ControlFlowAnalysisResult, timingAnalysis: CycleTimingResult): any[];
    /**
     * Calculate overall performance score
     */
    protected calculatePerformanceScore(timingAnalysis: CycleTimingResult, _cfgAnalysis: ControlFlowAnalysisResult): number;
    /**
     * Estimate optimization potential
     */
    protected estimateOptimizationPotential(hotspots: any[], _criticalPaths: any[]): number;
    protected analyzeVariableUsagePatterns(ilFunction: ILFunction, _cfgAnalysis: ControlFlowAnalysisResult): Map<ILValue, any>;
    protected selectOptimalRegister(_variable: ILValue, usage: any): Register6502;
    protected calculateRegisterBenefit(usage: any): number;
    protected isVariableUse(instruction: ILInstruction, variableName: string): boolean;
    protected getVariableName(value: ILInstruction | ILValue | any): string;
    protected isVariable(operand: any): operand is ILValue;
    protected estimateInstructionFrequency(_index: number, _cfgAnalysis: ControlFlowAnalysisResult): number;
    protected suggestInstructionOptimizations(instruction: ILInstruction): string[];
    getProcessorVariant(): ProcessorVariant;
    getPlatformTarget(): PlatformTarget;
    getAnalysisOptions(): SixtyTwo6502AnalysisOptions;
}
//# sourceMappingURL=base-6502-analyzer.d.ts.map