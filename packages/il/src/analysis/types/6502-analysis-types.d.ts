/**
 * Type definitions for 6502-specific IL analysis system
 *
 * Comprehensive type system supporting cycle-perfect timing analysis,
 * hardware constraint validation, and multi-variant 6502 processor support.
 */
import { ILFunction, ILInstruction, ILValue, Register6502, AddressingMode6502 } from '../../il-types.js';
import { SourcePosition } from '@blend65/lexer';
/**
 * Supported 6502 processor variants
 */
export type ProcessorVariant = '6502' | '6510' | '65C02' | '6507' | '65816';
/**
 * Target platform identification
 */
export type PlatformTarget = 'c64' | 'vic20' | 'x16' | 'atari2600' | 'nes' | 'snes' | 'generic';
/**
 * Timing accuracy modes
 */
export type TimingAccuracy = 'cycle_perfect' | 'approximate' | 'rough' | 'disabled';
/**
 * Memory model accuracy modes
 */
export type MemoryModelAccuracy = 'hardware_accurate' | 'simplified' | 'disabled';
/**
 * Configuration options for 6502-specific analysis
 */
export interface SixtyTwo6502AnalysisOptions {
    /** Target platform for analysis */
    targetPlatform: PlatformTarget;
    /** Processor variant to target */
    processorVariant: ProcessorVariant;
    /** Enable cycle-perfect timing analysis */
    enableCyclePerfectTiming: boolean;
    /** Enable memory layout validation */
    enableMemoryLayoutValidation: boolean;
    /** Enable register allocation analysis */
    enableRegisterAllocationAnalysis: boolean;
    /** Enable performance hotspot detection */
    enablePerformanceHotspotDetection: boolean;
    /** Enable hardware constraint validation */
    enableHardwareConstraintValidation: boolean;
    /** Enable optimization recommendations */
    enableOptimizationRecommendations: boolean;
    /** Timing analysis accuracy */
    timingAccuracy: TimingAccuracy;
    /** Memory model accuracy */
    memoryModelAccuracy: MemoryModelAccuracy;
    /** Enable VIC-II interference modeling (C64 specific) */
    enableVICInterferenceModeling: boolean;
    /** Enable SID timing validation (C64 specific) */
    enableSIDTimingValidation: boolean;
    /** Enable CIA timing validation (C64/VIC-20 specific) */
    enableCIATimingValidation: boolean;
    /** Maximum analysis time in milliseconds */
    maxAnalysisTimeMs: number;
    /** Enable performance profiling */
    enablePerformanceProfiling: boolean;
}
/**
 * Detailed timing information for a single instruction
 */
export interface InstructionTimingInfo {
    /** The instruction being analyzed */
    instruction: ILInstruction;
    /** Base cycle count for this instruction */
    baseCycles: number;
    /** Additional cycles due to page boundary crossing */
    pageBoundaryCycles: number;
    /** Additional cycles due to platform-specific interference */
    platformInterferenceCycles: number;
    /** Total cycles for this instruction */
    totalCycles: number;
    /** Human-readable timing explanation */
    timingNotes: string[];
    /** Addressing mode used */
    addressingMode: AddressingMode6502;
    /** Whether this instruction is on critical path */
    isCriticalPath: boolean;
}
/**
 * Complete timing analysis result
 */
export interface CycleTimingResult {
    /** Total cycles for entire function */
    totalCycles: number;
    /** Cycles for critical execution path */
    criticalPathCycles: number;
    /** Average cycles per instruction */
    averageCyclesPerInstruction: number;
    /** Detailed timing for each instruction */
    instructionTiming: Array<{
        instruction: ILInstruction;
        cycles: number;
        details: string;
    }>;
    /** Cycle breakdown by instruction type */
    cycleBreakdown: Record<string, number>;
    /** Timing analysis accuracy achieved */
    timingAccuracy: TimingAccuracy;
    /** Platform-specific timing factors */
    platformSpecificFactors: Record<string, any>;
}
/**
 * Memory usage breakdown
 */
export interface MemoryUsageInfo {
    /** Zero page usage in bytes */
    zeroPage: number;
    /** Stack usage in bytes */
    stack: number;
    /** RAM usage in bytes */
    ram: number;
    /** Total memory usage in bytes */
    total: number;
}
/**
 * Memory allocation entry
 */
export interface MemoryAllocationEntry {
    /** Variable or data name */
    name: string;
    /** Memory address */
    address: number;
    /** Size in bytes */
    size: number;
    /** Memory bank/region */
    bank: string;
    /** Whether allocation is optimal */
    isOptimal: boolean;
    /** Optimization recommendations for this allocation */
    recommendations: string[];
}
/**
 * Memory layout validation result
 */
export interface MemoryLayoutValidationResult {
    /** Whether memory layout is valid */
    isValid: boolean;
    /** Memory usage breakdown */
    memoryUsage: MemoryUsageInfo;
    /** Memory allocation map */
    memoryMap: MemoryAllocationEntry[];
    /** Memory-related validation issues */
    validationIssues: ValidationIssue[];
}
/**
 * Register pressure information
 */
export interface RegisterPressureInfo {
    /** Pressure on A register (0-100) */
    A: number;
    /** Pressure on X register (0-100) */
    X: number;
    /** Pressure on Y register (0-100) */
    Y: number;
    /** Pressure on AX register pair (0-100) */
    AX: number;
    /** Pressure on XY register pair (0-100) */
    XY: number;
}
/**
 * Register allocation recommendation
 */
export interface RegisterAllocationRecommendation {
    /** Variable or value to allocate */
    target: ILValue;
    /** Recommended register */
    recommendedRegister: Register6502;
    /** Benefit score (0-100) */
    benefit: number;
    /** Explanation of recommendation */
    reason: string;
    /** Estimated cycle savings */
    cycleSavings: number;
}
/**
 * Register interference analysis
 */
export interface RegisterInterferenceAnalysis {
    /** Register conflicts detected */
    conflicts: Array<{
        register: Register6502;
        conflictingInstructions: number[];
        severity: 'low' | 'medium' | 'high';
    }>;
    /** Register spill costs */
    spillCosts: Array<{
        register: Register6502;
        spillCycles: number;
        spillLocations: number[];
    }>;
}
/**
 * Register allocation analysis result
 */
export interface RegisterAllocationAnalysis {
    /** Whether register allocation is valid */
    isValid: boolean;
    /** Register pressure analysis */
    registerPressure: RegisterPressureInfo;
    /** Allocation recommendations */
    allocationRecommendations: RegisterAllocationRecommendation[];
    /** Interference analysis */
    interferenceAnalysis: RegisterInterferenceAnalysis;
    /** Optimization opportunities */
    optimizationOpportunities: Array<{
        type: string;
        description: string;
        benefit: number;
    }>;
}
/**
 * Performance hotspot instruction
 */
export interface HotspotInstruction {
    /** Instruction causing hotspot */
    instruction: ILInstruction;
    /** Instruction index in function */
    instructionIndex: number;
    /** Estimated execution frequency */
    frequency: number;
    /** Cycles consumed by this instruction */
    cycles: number;
    /** Total impact (frequency * cycles) */
    impact: number;
    /** Optimization opportunities */
    optimizations: string[];
}
/**
 * Critical execution path
 */
export interface CriticalPath {
    /** Path identifier */
    pathId: string;
    /** Instructions in this path */
    instructions: number[];
    /** Total cycles for this path */
    totalCycles: number;
    /** Execution probability */
    probability: number;
}
/**
 * Performance hotspot analysis result
 */
export interface PerformanceHotspotAnalysis {
    /** Hotspot instructions identified */
    hotspotInstructions: HotspotInstruction[];
    /** Overall performance score (0-100) */
    performanceScore: number;
    /** Critical execution paths */
    criticalPaths: CriticalPath[];
    /** Optimization potential (0-100) */
    optimizationPotential: number;
}
/**
 * Hardware constraint violation
 */
export interface HardwareConstraintViolation {
    /** Type of constraint violated */
    constraintType: 'stack_overflow' | 'register_conflict' | 'timing_violation' | 'memory_conflict' | 'hardware_limit';
    /** Severity of violation */
    severity: 'error' | 'warning' | 'info';
    /** Description of violation */
    message: string;
    /** Instruction causing violation */
    instruction?: ILInstruction;
    /** Location in code */
    location?: SourcePosition;
    /** Suggested resolution */
    resolution?: string;
}
/**
 * Hardware constraint validation result
 */
export interface HardwareConstraintValidation {
    /** Whether stack usage is valid */
    stackUsageValid: boolean;
    /** Whether timing constraints are met */
    timingConstraintsValid: boolean;
    /** Whether hardware resources are properly used */
    hardwareResourcesValid: boolean;
    /** All constraint violations */
    constraintViolations: HardwareConstraintViolation[];
}
/**
 * 6502-specific optimization recommendation
 */
export interface SixtyTwo6502Optimization {
    /** Type of optimization */
    type: 'register_allocation' | 'memory_layout' | 'instruction_selection' | 'addressing_mode' | 'loop_optimization' | 'peephole';
    /** Priority of optimization (0-100) */
    priority: number;
    /** Estimated benefit */
    estimatedBenefit: {
        /** Cycle savings */
        cycleSavings: number;
        /** Memory savings in bytes */
        memorySavings: number;
        /** Code size change in bytes */
        codeSizeChange: number;
    };
    /** Description of optimization */
    description: string;
    /** Instructions affected */
    affectedInstructions: number[];
    /** Implementation difficulty */
    difficulty: 'easy' | 'medium' | 'hard';
    /** Platform-specific notes */
    platformNotes?: string;
}
/**
 * Validation issue
 */
export interface ValidationIssue {
    /** Issue type */
    type: string;
    /** Issue severity */
    severity: 'error' | 'warning' | 'info';
    /** Issue message */
    message: string;
    /** Related instruction */
    instruction?: ILInstruction;
    /** Source location */
    location?: SourcePosition;
}
/**
 * Platform compatibility report
 */
export interface PlatformCompatibilityReport {
    /** Overall compatibility score (0-100) */
    score: number;
    /** Compatibility issues */
    issues: string[];
    /** Platform-specific recommendations */
    recommendations?: string[];
}
/**
 * Analysis performance metrics
 */
export interface SixtyTwo6502AnalysisMetrics {
    /** Total analysis time in milliseconds */
    analysisTimeMs: number;
    /** Memory usage during analysis */
    memoryUsageBytes: number;
    /** Number of instructions analyzed */
    instructionCount: number;
    /** Number of basic blocks analyzed */
    basicBlockCount: number;
    /** Analysis accuracy score (0-1) */
    accuracyScore: number;
}
/**
 * Complete 6502-specific validation result
 */
export interface SixtyTwo6502ValidationResult {
    /** Whether IL is valid for target platform */
    isValid: boolean;
    /** Platform compatibility assessment */
    platformCompatibility: PlatformCompatibilityReport;
    /** Performance analysis results */
    performanceAnalysis: {
        totalCycles: number;
        criticalPathCycles: number;
        averageCyclesPerInstruction: number;
        hotspotInstructions: HotspotInstruction[];
        cycleBreakdown: Record<string, number>;
        performanceScore: number;
    };
    /** Hardware constraint validation results */
    constraintValidation: {
        memoryLayoutValid: boolean;
        registerUsageValid: boolean;
        stackUsageValid: boolean;
        timingConstraintsValid: boolean;
        hardwareResourcesValid: boolean;
    };
    /** Optimization recommendations */
    optimizationRecommendations: SixtyTwo6502Optimization[];
    /** All validation issues found */
    validationIssues: ValidationIssue[];
    /** Analysis performance metrics */
    analysisMetrics: SixtyTwo6502AnalysisMetrics;
    /** Target platform analyzed */
    targetPlatform: PlatformTarget;
    /** Processor variant analyzed */
    processorVariant: ProcessorVariant;
}
/**
 * Context information for instruction analysis
 */
export interface InstructionAnalysisContext {
    /** Index of instruction being analyzed */
    instructionIndex: number;
    /** Function being analyzed */
    function: ILFunction;
    /** Previous instruction (if any) */
    previousInstruction?: ILInstruction;
    /** Next instruction (if any) */
    nextInstruction?: ILInstruction;
    /** Current raster line (for VIC interference) */
    rasterLine?: number;
    /** Current cycle within raster line */
    rasterCycle?: number;
}
/**
 * VIC-II timing factors (C64 specific)
 */
export interface VICTimingFactors {
    /** Whether badline interference applies */
    isBadline: boolean;
    /** VIC DMA cycles stolen */
    dmaCycles: number;
    /** Raster line number */
    rasterLine: number;
    /** Cycle within raster line */
    cycleTiming: number;
}
/**
 * SID timing constraints (C64 specific)
 */
export interface SIDTimingConstraints {
    /** Voice timing requirements */
    voiceTimingCycles: number;
    /** Filter settling time */
    filterSettlingCycles: number;
    /** Volume register timing */
    volumeTimingCycles: number;
}
/**
 * CIA timing constraints (C64/VIC-20 specific)
 */
export interface CIATimingConstraints {
    /** Timer programming cycles */
    timerSetupCycles: number;
    /** Interrupt latency cycles */
    interruptLatencyCycles: number;
    /** Port access cycles */
    portAccessCycles: number;
}
/**
 * Memory region definition
 */
export interface MemoryRegion {
    /** Region name */
    name: string;
    /** Start address */
    startAddress: number;
    /** End address */
    endAddress: number;
    /** Region type */
    type: 'ram' | 'rom' | 'io' | 'unmapped';
    /** Whether region supports read access */
    readable: boolean;
    /** Whether region supports write access */
    writable: boolean;
    /** Whether region can be banked/switched */
    bankable: boolean;
    /** Access timing in cycles */
    accessCycles: number;
}
/**
 * Platform memory map
 */
export interface PlatformMemoryMap {
    /** Platform name */
    platform: PlatformTarget;
    /** All memory regions */
    regions: MemoryRegion[];
    /** Zero page region */
    zeroPage: MemoryRegion;
    /** Stack region */
    stack: MemoryRegion;
    /** Default RAM regions */
    defaultRAM: MemoryRegion[];
    /** I/O regions */
    ioRegions: MemoryRegion[];
}
//# sourceMappingURL=6502-analysis-types.d.ts.map