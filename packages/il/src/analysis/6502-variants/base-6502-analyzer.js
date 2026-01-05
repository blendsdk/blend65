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
import { ILInstructionType, } from '../../il-types.js';
/**
 * Abstract base class for all 6502 family processor analyzers
 *
 * Provides common functionality while requiring processor-specific
 * implementations for timing, memory layout, and hardware features.
 */
export class Base6502Analyzer {
    options;
    processorVariant;
    platformTarget;
    constructor(options) {
        this.options = options;
        this.processorVariant = options.processorVariant;
        this.platformTarget = options.targetPlatform;
    }
    // ============================================================================
    // COMMON IMPLEMENTATION - Shared across all processors
    // ============================================================================
    /**
     * Analyze register allocation for IL function
     *
     * @param ilFunction IL function to analyze
     * @param cfgAnalysis Control flow graph analysis
     * @returns Register allocation analysis
     */
    analyzeRegisterAllocation(ilFunction, cfgAnalysis) {
        // Common register allocation logic shared across all 6502 variants
        const registerPressure = this.calculateRegisterPressure(ilFunction);
        const allocationRecommendations = this.generateRegisterRecommendations(ilFunction, cfgAnalysis);
        const interferenceAnalysis = this.analyzeRegisterInterference(ilFunction, cfgAnalysis);
        const optimizationOpportunities = this.findRegisterOptimizationOpportunities(ilFunction);
        // Check if register allocation is valid (no unresolvable conflicts)
        const isValid = interferenceAnalysis.conflicts.every((conflict) => conflict.severity !== 'high');
        return {
            isValid,
            registerPressure,
            allocationRecommendations,
            interferenceAnalysis,
            optimizationOpportunities,
        };
    }
    /**
     * Detect performance hotspots in IL function
     *
     * @param ilFunction IL function to analyze
     * @param timingAnalysis Timing analysis results
     * @param cfgAnalysis Control flow graph analysis
     * @returns Performance hotspot analysis
     */
    detectPerformanceHotspots(_ilFunction, timingAnalysis, cfgAnalysis) {
        const hotspotInstructions = this.identifyHotspotInstructions(timingAnalysis, cfgAnalysis);
        const criticalPaths = this.findCriticalPaths(cfgAnalysis, timingAnalysis);
        const performanceScore = this.calculatePerformanceScore(timingAnalysis, cfgAnalysis);
        const optimizationPotential = this.estimateOptimizationPotential(hotspotInstructions, criticalPaths);
        return {
            hotspotInstructions,
            performanceScore,
            criticalPaths,
            optimizationPotential,
        };
    }
    // ============================================================================
    // PROTECTED HELPER METHODS - Common implementation utilities
    // ============================================================================
    /**
     * Calculate register pressure across the function
     */
    calculateRegisterPressure(ilFunction) {
        const registerUsage = { A: 0, X: 0, Y: 0, AX: 0, XY: 0 };
        const totalInstructions = ilFunction.instructions.length;
        if (totalInstructions === 0) {
            return registerUsage;
        }
        // Analyze register usage patterns
        for (const instruction of ilFunction.instructions) {
            const registerHints = instruction.sixtyTwoHints?.preferredRegister;
            if (registerHints) {
                switch (registerHints) {
                    case 'A':
                        registerUsage.A += 1;
                        break;
                    case 'X':
                        registerUsage.X += 1;
                        break;
                    case 'Y':
                        registerUsage.Y += 1;
                        break;
                    case 'AX':
                        registerUsage.AX += 1;
                        break;
                    case 'XY':
                        registerUsage.XY += 1;
                        break;
                }
            }
        }
        // Convert to pressure percentages (0-100)
        return {
            A: Math.min(100, (registerUsage.A / totalInstructions) * 100),
            X: Math.min(100, (registerUsage.X / totalInstructions) * 100),
            Y: Math.min(100, (registerUsage.Y / totalInstructions) * 100),
            AX: Math.min(100, (registerUsage.AX / totalInstructions) * 100),
            XY: Math.min(100, (registerUsage.XY / totalInstructions) * 100),
        };
    }
    /**
     * Generate register allocation recommendations
     */
    generateRegisterRecommendations(ilFunction, cfgAnalysis) {
        const recommendations = [];
        // Analyze variable usage patterns to recommend register allocation
        const variableUsage = this.analyzeVariableUsagePatterns(ilFunction, cfgAnalysis);
        for (const [variable, usage] of variableUsage.entries()) {
            if (usage.frequency > 3) {
                // High usage variables are good register candidates
                recommendations.push({
                    target: variable,
                    recommendedRegister: this.selectOptimalRegister(variable, usage),
                    benefit: this.calculateRegisterBenefit(usage),
                    reason: `High usage variable (${usage.frequency} uses) - good register candidate`,
                    cycleSavings: Math.floor(usage.frequency * 1.5), // Estimated cycle savings
                });
            }
        }
        return recommendations;
    }
    /**
     * Analyze register interference patterns
     */
    analyzeRegisterInterference(_ilFunction, _cfgAnalysis) {
        return {
            conflicts: [],
            spillCosts: [],
        };
    }
    /**
     * Find register optimization opportunities
     */
    findRegisterOptimizationOpportunities(ilFunction) {
        const opportunities = [];
        // Look for load/store patterns that could benefit from register allocation
        for (let i = 0; i < ilFunction.instructions.length - 1; i++) {
            const current = ilFunction.instructions[i];
            const next = ilFunction.instructions[i + 1];
            // Look for load followed by immediate use patterns
            if (current.type === ILInstructionType.LOAD_VARIABLE &&
                this.isVariableUse(next, this.getVariableName(current))) {
                opportunities.push({
                    type: 'register_allocation',
                    description: 'Load-use pattern could benefit from register allocation',
                    benefit: 75,
                });
            }
        }
        return opportunities;
    }
    /**
     * Identify performance hotspot instructions
     */
    identifyHotspotInstructions(timingAnalysis, cfgAnalysis) {
        const hotspots = [];
        const averageCycles = timingAnalysis.averageCyclesPerInstruction;
        // Instructions that take significantly more than average cycles are hotspots
        timingAnalysis.instructionTiming.forEach((timing, index) => {
            if (timing.cycles > averageCycles * 1.5) {
                hotspots.push({
                    instruction: timing.instruction,
                    instructionIndex: index,
                    frequency: this.estimateInstructionFrequency(index, cfgAnalysis),
                    cycles: timing.cycles,
                    impact: timing.cycles * this.estimateInstructionFrequency(index, cfgAnalysis),
                    optimizations: this.suggestInstructionOptimizations(timing.instruction),
                });
            }
        });
        // Sort by impact (highest first)
        hotspots.sort((a, b) => b.impact - a.impact);
        return hotspots;
    }
    /**
     * Find critical execution paths
     */
    findCriticalPaths(_cfgAnalysis, timingAnalysis) {
        // Simplified critical path analysis - in a full implementation,
        // this would trace through the CFG to find the longest paths
        return [
            {
                pathId: 'main_path',
                instructions: Array.from({ length: timingAnalysis.instructionTiming.length }, (_, i) => i),
                totalCycles: timingAnalysis.totalCycles,
                probability: 1.0,
            },
        ];
    }
    /**
     * Calculate overall performance score
     */
    calculatePerformanceScore(timingAnalysis, _cfgAnalysis) {
        // Simple performance scoring based on cycles per instruction
        const avgCycles = timingAnalysis.averageCyclesPerInstruction;
        // Good performance: 2-3 cycles per instruction
        // Poor performance: 5+ cycles per instruction
        if (avgCycles <= 3) {
            return 90 + Math.max(0, (3 - avgCycles) * 5);
        }
        else if (avgCycles <= 4) {
            return 70 + (4 - avgCycles) * 20;
        }
        else {
            return Math.max(10, 70 - (avgCycles - 4) * 10);
        }
    }
    /**
     * Estimate optimization potential
     */
    estimateOptimizationPotential(hotspots, _criticalPaths) {
        if (hotspots.length === 0)
            return 10; // Already well optimized
        const totalImpact = hotspots.reduce((sum, hotspot) => sum + hotspot.impact, 0);
        const maxImpact = Math.max(...hotspots.map(h => h.impact));
        // More hotspots or higher impact means more optimization potential
        return Math.min(95, Math.max(20, (totalImpact / maxImpact) * 25 + hotspots.length * 5));
    }
    // ============================================================================
    // UTILITY METHODS
    // ============================================================================
    analyzeVariableUsagePatterns(ilFunction, _cfgAnalysis) {
        const usage = new Map();
        // Count variable usage frequency
        for (const instruction of ilFunction.instructions) {
            for (const operand of instruction.operands) {
                // Only process IL values (not parameter/return references)
                if ('valueType' in operand && this.isVariable(operand)) {
                    const variable = operand;
                    const current = usage.get(variable) || { frequency: 0, lastUse: -1 };
                    current.frequency += 1;
                    usage.set(variable, current);
                }
            }
        }
        return usage;
    }
    selectOptimalRegister(_variable, usage) {
        // Simple register selection - A for most frequently used
        return usage.frequency > 5 ? 'A' : 'X';
    }
    calculateRegisterBenefit(usage) {
        // Higher frequency = higher benefit
        return Math.min(100, usage.frequency * 10);
    }
    isVariableUse(instruction, variableName) {
        return instruction.operands.some(op => this.isVariable(op) && this.getVariableName(op) === variableName);
    }
    getVariableName(value) {
        if (value && 'valueType' in value && value.valueType === 'variable') {
            return value.name;
        }
        return '';
    }
    isVariable(operand) {
        return operand && 'valueType' in operand && operand.valueType === 'variable';
    }
    estimateInstructionFrequency(_index, _cfgAnalysis) {
        // Simplified frequency estimation - in a real implementation,
        // this would use CFG analysis to determine execution frequency
        return 1.0;
    }
    suggestInstructionOptimizations(instruction) {
        const optimizations = [];
        // Suggest common 6502 optimizations based on instruction type
        switch (instruction.type) {
            case ILInstructionType.LOAD_MEMORY:
                optimizations.push('Consider zero page addressing if possible');
                break;
            case ILInstructionType.MUL:
                optimizations.push('Consider shift operations for powers of 2');
                break;
            case ILInstructionType.STORE_MEMORY:
                optimizations.push('Consider register allocation to avoid store');
                break;
        }
        return optimizations;
    }
    // ============================================================================
    // PROCESSOR INFORMATION
    // ============================================================================
    getProcessorVariant() {
        return this.processorVariant;
    }
    getPlatformTarget() {
        return this.platformTarget;
    }
    getAnalysisOptions() {
        return { ...this.options };
    }
}
//# sourceMappingURL=base-6502-analyzer.js.map