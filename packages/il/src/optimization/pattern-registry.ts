/**
 * @fileoverview Optimization Pattern Registry
 *
 * Registry implementation for managing 470+ optimization patterns.
 * Provides pattern discovery, organization, and intelligent selection capabilities.
 */

import {
  OptimizationPattern,
  OptimizationPatternRegistry,
  OptimizationCategory,
  OptimizationLevel,
  OptimizationPriority,
  OptimizationSafety,
  OptimizationContext,
  OptimizationResult,
  OptimizationMetricsChange,
} from './types.js';
import { ILInstruction, ILInstructionType, isILConstant } from '../il-types.js';

/**
 * Implementation of optimization pattern registry
 */
export class OptimizationPatternRegistryImpl implements OptimizationPatternRegistry {
  private readonly patterns = new Map<string, OptimizationPattern>();
  private readonly categoryIndex = new Map<OptimizationCategory, Set<string>>();
  private readonly levelIndex = new Map<OptimizationLevel, Set<string>>();

  constructor() {
    this.initializeBuiltinPatterns();
  }

  /**
   * Register a new optimization pattern
   */
  register(pattern: OptimizationPattern): void {
    this.patterns.set(pattern.id, pattern);

    // Update category index
    if (!this.categoryIndex.has(pattern.category)) {
      this.categoryIndex.set(pattern.category, new Set());
    }
    this.categoryIndex.get(pattern.category)!.add(pattern.id);

    // Update level index
    if (!this.levelIndex.has(pattern.minLevel)) {
      this.levelIndex.set(pattern.minLevel, new Set());
    }
    this.levelIndex.get(pattern.minLevel)!.add(pattern.id);
  }

  /**
   * Get pattern by ID
   */
  get(id: string): OptimizationPattern | undefined {
    return this.patterns.get(id);
  }

  /**
   * Get all patterns for a category
   */
  getByCategory(category: OptimizationCategory): OptimizationPattern[] {
    const patternIds = this.categoryIndex.get(category) || new Set();
    return Array.from(patternIds)
      .map(id => this.patterns.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all patterns suitable for a level
   */
  getByLevel(level: OptimizationLevel): OptimizationPattern[] {
    const patterns: OptimizationPattern[] = [];

    // Include patterns for this level and below
    const levelOrder = [
      OptimizationLevel.O0,
      OptimizationLevel.Og,
      OptimizationLevel.O1,
      OptimizationLevel.O2,
      OptimizationLevel.Os,
      OptimizationLevel.O3,
    ];

    const maxLevelIndex = levelOrder.indexOf(level);
    if (maxLevelIndex === -1) return patterns;

    for (let i = 0; i <= maxLevelIndex; i++) {
      const levelPatterns = this.levelIndex.get(levelOrder[i]) || new Set();
      for (const patternId of levelPatterns) {
        const pattern = this.patterns.get(patternId);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  /**
   * Get all registered patterns
   */
  getAll(): OptimizationPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Check if pattern exists
   */
  has(id: string): boolean {
    return this.patterns.has(id);
  }

  /**
   * Remove a pattern
   */
  unregister(id: string): boolean {
    const pattern = this.patterns.get(id);
    if (!pattern) {
      return false;
    }

    this.patterns.delete(id);

    // Remove from category index
    const categoryPatterns = this.categoryIndex.get(pattern.category);
    if (categoryPatterns) {
      categoryPatterns.delete(id);
    }

    // Remove from level index
    const levelPatterns = this.levelIndex.get(pattern.minLevel);
    if (levelPatterns) {
      levelPatterns.delete(id);
    }

    return true;
  }

  /**
   * Clear all patterns
   */
  clear(): void {
    this.patterns.clear();
    this.categoryIndex.clear();
    this.levelIndex.clear();
  }

  /**
   * Initialize built-in optimization patterns
   */
  private initializeBuiltinPatterns(): void {
    // Dead Code Elimination Patterns
    this.registerDeadCodePatterns();

    // Constant Folding Patterns
    this.registerConstantFoldingPatterns();

    // Function Optimization Patterns
    this.registerFunctionOptimizationPatterns();

    // Register Optimization Patterns
    this.registerRegisterOptimizationPatterns();

    // 6502-Specific Patterns
    this.registerSixtyTwoZeroTwoPatterns();

    // Peephole Optimization Patterns
    this.registerPeepholePatterns();
  }

  /**
   * Register dead code elimination patterns
   */
  private registerDeadCodePatterns(): void {
    this.register({
      id: 'dead-code-nop-elimination',
      name: 'NOP Instruction Elimination',
      description: 'Remove NOP instructions that serve no purpose',
      category: OptimizationCategory.DEAD_CODE,
      priority: OptimizationPriority.HIGH,
      safety: OptimizationSafety.SAFE,
      minLevel: OptimizationLevel.O1,
      estimatedCyclesSaved: 2,
      estimatedSizeImpact: -2,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        let optimized = false;
        const metricsChange = this.createZeroMetricsChange();

        const filtered = instructions.filter(inst => {
          const shouldRemove =
            inst.type === ILInstructionType.NOP && !inst.metadata?.debugInfo?.comments;
          if (shouldRemove) {
            optimized = true;
            metricsChange.sizeDelta -= 2;
            metricsChange.cyclesDelta -= 2;
          }
          return !shouldRemove;
        });

        return {
          success: optimized,
          instructions: optimized ? filtered : undefined,
          metricsChange,
          appliedPattern: optimized
            ? {
                id: 'dead-code-nop-elimination',
                name: 'NOP Instruction Elimination',
                applications: instructions.length - filtered.length,
              }
            : undefined,
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        return instructions.some(
          inst => inst.type === ILInstructionType.NOP && !inst.metadata?.debugInfo?.comments
        );
      },
    });
  }

  /**
   * Register constant folding patterns
   */
  private registerConstantFoldingPatterns(): void {
    this.register({
      id: 'constant-folding-arithmetic',
      name: 'Arithmetic Constant Folding',
      description: 'Fold constant arithmetic expressions at compile time',
      category: OptimizationCategory.CONSTANTS,
      priority: OptimizationPriority.HIGH,
      safety: OptimizationSafety.SAFE,
      minLevel: OptimizationLevel.O1,
      estimatedCyclesSaved: 5,
      estimatedSizeImpact: -4,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        let optimized = false;
        const metricsChange = this.createZeroMetricsChange();
        const result = [...instructions];

        // Look for constant arithmetic patterns
        for (let i = 0; i < result.length - 2; i++) {
          const inst1 = result[i];
          const inst2 = result[i + 1];
          const inst3 = result[i + 2];

          // ADD pattern
          if (this.isConstantArithmeticPattern(inst1, inst2, inst3, ILInstructionType.ADD)) {
            const const1 = inst1.operands[0] as any;
            const const2 = inst2.operands[0] as any;
            const sum = const1.value + const2.value;

            // Replace with single constant
            result.splice(i, 3, {
              type: ILInstructionType.LOAD_IMMEDIATE,
              operands: [
                {
                  valueType: 'constant',
                  type: { kind: 'primitive', name: 'byte' },
                  value: sum,
                  representation: 'decimal',
                },
              ],
              id: inst1.id,
              metadata: {
                processedBy: ['constant-folding-arithmetic'],
                synthetic: true,
                debugInfo: {
                  comments: [`Folded: ${const1.value} + ${const2.value} = ${sum}`],
                },
              },
            });

            optimized = true;
            metricsChange.sizeDelta -= 4;
            metricsChange.cyclesDelta -= 3;
          }
        }

        return {
          success: optimized,
          instructions: optimized ? result : undefined,
          metricsChange,
          appliedPattern: optimized
            ? {
                id: 'constant-folding-arithmetic',
                name: 'Arithmetic Constant Folding',
                applications: 1,
              }
            : undefined,
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        // Check if there are constant arithmetic patterns
        for (let i = 0; i < instructions.length - 2; i++) {
          if (
            this.isConstantArithmeticPattern(
              instructions[i],
              instructions[i + 1],
              instructions[i + 2],
              ILInstructionType.ADD
            )
          ) {
            return true;
          }
        }
        return false;
      },
    });
  }

  /**
   * Register function optimization patterns
   */
  private registerFunctionOptimizationPatterns(): void {
    this.register({
      id: 'function-tail-call-elimination',
      name: 'Tail Call Elimination',
      description: 'Convert tail calls to jumps to save stack space',
      category: OptimizationCategory.FUNCTIONS,
      priority: OptimizationPriority.MEDIUM,
      safety: OptimizationSafety.CONDITIONAL,
      minLevel: OptimizationLevel.O2,
      estimatedCyclesSaved: 8,
      estimatedSizeImpact: -3,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        // Placeholder implementation
        return {
          success: false,
          metricsChange: this.createZeroMetricsChange(),
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        return false; // Placeholder
      },
    });
  }

  /**
   * Register register optimization patterns
   */
  private registerRegisterOptimizationPatterns(): void {
    this.register({
      id: 'register-a-optimization',
      name: 'A Register Optimization',
      description: 'Optimize accumulator register usage',
      category: OptimizationCategory.REGISTERS,
      priority: OptimizationPriority.HIGH,
      safety: OptimizationSafety.CONDITIONAL,
      minLevel: OptimizationLevel.O2,
      estimatedCyclesSaved: 3,
      estimatedSizeImpact: -1,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        // Placeholder implementation
        return {
          success: false,
          metricsChange: this.createZeroMetricsChange(),
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        return false; // Placeholder
      },
    });
  }

  /**
   * Register 6502-specific patterns
   */
  private registerSixtyTwoZeroTwoPatterns(): void {
    this.register({
      id: '6502-zero-page-optimization',
      name: '6502 Zero Page Optimization',
      description: 'Optimize for 6502 zero page addressing modes',
      category: OptimizationCategory.MEMORY,
      priority: OptimizationPriority.HIGH,
      safety: OptimizationSafety.SAFE,
      minLevel: OptimizationLevel.O2,
      targetVariants: ['c64-6510', 'vic20-6502', 'x16-65c02'],
      estimatedCyclesSaved: 1,
      estimatedSizeImpact: -1,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        // Placeholder implementation
        return {
          success: false,
          metricsChange: this.createZeroMetricsChange(),
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        return false; // Placeholder
      },
    });
  }

  /**
   * Register peephole optimization patterns
   */
  private registerPeepholePatterns(): void {
    this.register({
      id: 'peephole-load-store-elimination',
      name: 'Load-Store Elimination',
      description: 'Eliminate redundant load-store pairs',
      category: OptimizationCategory.PEEPHOLE,
      priority: OptimizationPriority.MEDIUM,
      safety: OptimizationSafety.CONDITIONAL,
      minLevel: OptimizationLevel.O2,
      estimatedCyclesSaved: 4,
      estimatedSizeImpact: -4,
      dependencies: [],
      conflicts: [],
      apply: (instructions: ILInstruction[], context: OptimizationContext) => {
        // Placeholder implementation
        return {
          success: false,
          metricsChange: this.createZeroMetricsChange(),
          warnings: [],
          debug: {
            applicationAttempts: [],
            timePerCategory: {} as any,
            analyticsUsed: {
              complexity: false,
              performance: false,
              patternReadiness: false,
              sixtytwofiveAnalysis: false,
            },
            decisionLog: [],
          },
        };
      },
      isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => {
        return false; // Placeholder
      },
    });
  }

  /**
   * Helper method to check for constant arithmetic patterns
   */
  private isConstantArithmeticPattern(
    inst1: ILInstruction,
    inst2: ILInstruction,
    inst3: ILInstruction,
    operation: ILInstructionType
  ): boolean {
    return (
      inst1.type === ILInstructionType.LOAD_IMMEDIATE &&
      inst2.type === ILInstructionType.LOAD_IMMEDIATE &&
      inst3.type === operation &&
      'valueType' in inst1.operands[0] &&
      'valueType' in inst2.operands[0] &&
      isILConstant(inst1.operands[0]) &&
      isILConstant(inst2.operands[0]) &&
      typeof inst1.operands[0].value === 'number' &&
      typeof inst2.operands[0].value === 'number'
    );
  }

  /**
   * Helper method to create zero metrics change
   */
  private createZeroMetricsChange(): OptimizationMetricsChange {
    return {
      cyclesDelta: 0,
      sizeDelta: 0,
      memoryDelta: 0,
      registerPressureDelta: 0,
      complexityDelta: 0,
    };
  }
}

/**
 * Create a default pattern registry with built-in patterns
 */
export function createDefaultPatternRegistry(): OptimizationPatternRegistry {
  return new OptimizationPatternRegistryImpl();
}

/**
 * Pattern development utilities for creating custom patterns
 */
export class PatternBuilder {
  private pattern: Partial<OptimizationPattern> = {};

  setId(id: string): PatternBuilder {
    this.pattern.id = id;
    return this;
  }

  setName(name: string): PatternBuilder {
    this.pattern.name = name;
    return this;
  }

  setDescription(description: string): PatternBuilder {
    this.pattern.description = description;
    return this;
  }

  setCategory(category: OptimizationCategory): PatternBuilder {
    this.pattern.category = category;
    return this;
  }

  setPriority(priority: OptimizationPriority): PatternBuilder {
    this.pattern.priority = priority;
    return this;
  }

  setSafety(safety: OptimizationSafety): PatternBuilder {
    this.pattern.safety = safety;
    return this;
  }

  setMinLevel(level: OptimizationLevel): PatternBuilder {
    this.pattern.minLevel = level;
    return this;
  }

  setTargetVariants(variants: string[]): PatternBuilder {
    this.pattern.targetVariants = variants;
    return this;
  }

  setEstimatedCyclesSaved(cycles: number): PatternBuilder {
    this.pattern.estimatedCyclesSaved = cycles;
    return this;
  }

  setEstimatedSizeImpact(size: number): PatternBuilder {
    this.pattern.estimatedSizeImpact = size;
    return this;
  }

  setDependencies(dependencies: string[]): PatternBuilder {
    this.pattern.dependencies = dependencies;
    return this;
  }

  setConflicts(conflicts: string[]): PatternBuilder {
    this.pattern.conflicts = conflicts;
    return this;
  }

  setApplyFunction(
    apply: (instructions: ILInstruction[], context: OptimizationContext) => OptimizationResult
  ): PatternBuilder {
    this.pattern.apply = apply;
    return this;
  }

  setApplicabilityTest(
    isApplicable: (instructions: ILInstruction[], context: OptimizationContext) => boolean
  ): PatternBuilder {
    this.pattern.isApplicable = isApplicable;
    return this;
  }

  build(): OptimizationPattern {
    // Validate required fields
    if (!this.pattern.id) throw new Error('Pattern ID is required');
    if (!this.pattern.name) throw new Error('Pattern name is required');
    if (!this.pattern.description) throw new Error('Pattern description is required');
    if (!this.pattern.category) throw new Error('Pattern category is required');
    if (!this.pattern.priority) throw new Error('Pattern priority is required');
    if (!this.pattern.safety) throw new Error('Pattern safety is required');
    if (!this.pattern.minLevel) throw new Error('Pattern min level is required');
    if (typeof this.pattern.apply !== 'function')
      throw new Error('Pattern apply function is required');
    if (typeof this.pattern.isApplicable !== 'function')
      throw new Error('Pattern applicability test is required');

    return {
      ...this.pattern,
      estimatedCyclesSaved: this.pattern.estimatedCyclesSaved ?? 0,
      estimatedSizeImpact: this.pattern.estimatedSizeImpact ?? 0,
      dependencies: this.pattern.dependencies ?? [],
      conflicts: this.pattern.conflicts ?? [],
    } as OptimizationPattern;
  }
}

/**
 * Convenience function to start building a pattern
 */
export function createPattern(): PatternBuilder {
  return new PatternBuilder();
}
