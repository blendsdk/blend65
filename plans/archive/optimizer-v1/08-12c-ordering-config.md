# Task 8.12c: Priority Config & Pass Scheduling

> **Task**: 8.12c of 12 (Peephole Phase - Pattern Ordering)  
> **Time**: ~2 hours  
> **Tests**: ~30 tests  
> **Prerequisites**: Task 8.12b (Ordering Algorithms)

---

## Overview

Implement the configuration system for pattern priorities and pass scheduling. This task provides configurable control over which patterns run, in what order, and how optimization passes are organized. Different optimization levels and use cases require different scheduling strategies.

---

## Directory Structure

```
packages/compiler/src/optimizer/ordering/
├── index.ts              # Exports
├── types.ts              # Ordering types
├── dependency-graph.ts   # Dependency graph
├── pattern-analysis.ts   # Pattern relationship analysis
├── conflict-detection.ts # Conflict detection
├── ordering-strategy.ts  # Ordering strategies
├── fixed-point.ts        # Fixed-point iteration
├── worklist.ts           # Worklist algorithms
├── priority-config.ts    # Priority configuration (THIS TASK)
├── pass-scheduler.ts     # Pass scheduling (THIS TASK)
└── optimization-level.ts # Optimization level configs (THIS TASK)
```

---

## Implementation

### File: `priority-config.ts`

```typescript
import { PeepholePattern } from '../peephole/pattern.js';
import { PatternCategory } from '../peephole/types.js';

/**
 * Pattern priority configuration
 */
export interface PatternPriority {
  /** Pattern ID */
  readonly patternId: string;
  /** Base priority (0-100) */
  readonly basePriority: number;
  /** Category override priority */
  readonly categoryPriority?: number;
  /** Enabled for these optimization levels */
  readonly enabledLevels: OptimizationLevel[];
  /** Custom conditions for enabling */
  readonly conditions?: PriorityCondition[];
}

/**
 * Optimization levels
 */
export enum OptimizationLevel {
  /** No optimization */
  O0 = 'O0',
  /** Basic optimization (safe, fast) */
  O1 = 'O1',
  /** Standard optimization */
  O2 = 'O2',
  /** Aggressive optimization */
  O3 = 'O3',
  /** Size optimization */
  Os = 'Os',
  /** Speed optimization (ignore size) */
  Ofast = 'Ofast',
}

/**
 * Condition for priority adjustment
 */
export interface PriorityCondition {
  /** Condition type */
  readonly type: 'loop' | 'function' | 'region' | 'custom';
  /** Condition matches? Priority multiplier */
  readonly multiplier: number;
  /** Additional data for condition */
  readonly data?: unknown;
}

/**
 * Category priority defaults
 */
export const DEFAULT_CATEGORY_PRIORITIES: Record<string, number> = {
  [PatternCategory.LoadStore]: 80,
  [PatternCategory.Arithmetic]: 70,
  [PatternCategory.Branch]: 60,
  [PatternCategory.Transfer]: 50,
  [PatternCategory.Flag]: 40,
  [PatternCategory.General]: 30,
};

/**
 * Priority configuration manager
 */
export class PriorityConfigManager {
  protected patternPriorities: Map<string, PatternPriority> = new Map();
  protected categoryPriorities: Map<string, number>;
  protected currentLevel: OptimizationLevel = OptimizationLevel.O2;
  
  constructor() {
    this.categoryPriorities = new Map(
      Object.entries(DEFAULT_CATEGORY_PRIORITIES)
    );
  }
  
  /**
   * Set optimization level
   */
  setOptimizationLevel(level: OptimizationLevel): void {
    this.currentLevel = level;
  }
  
  /**
   * Get current optimization level
   */
  getOptimizationLevel(): OptimizationLevel {
    return this.currentLevel;
  }
  
  /**
   * Set pattern priority
   */
  setPatternPriority(priority: PatternPriority): void {
    this.patternPriorities.set(priority.patternId, priority);
  }
  
  /**
   * Set category priority
   */
  setCategoryPriority(category: string, priority: number): void {
    this.categoryPriorities.set(category, priority);
  }
  
  /**
   * Get effective priority for a pattern
   */
  getEffectivePriority(
    pattern: PeepholePattern,
    context?: PriorityContext
  ): number {
    const config = this.patternPriorities.get(pattern.id);
    
    // Start with base priority or category default
    let priority = config?.basePriority ??
                   this.categoryPriorities.get(pattern.category) ??
                   50;
    
    // Apply category override
    if (config?.categoryPriority !== undefined) {
      priority = config.categoryPriority;
    }
    
    // Apply condition multipliers
    if (config?.conditions && context) {
      for (const condition of config.conditions) {
        if (this.evaluateCondition(condition, context)) {
          priority *= condition.multiplier;
        }
      }
    }
    
    // Clamp to valid range
    return Math.max(0, Math.min(100, priority));
  }
  
  /**
   * Check if pattern is enabled at current level
   */
  isPatternEnabled(pattern: PeepholePattern): boolean {
    const config = this.patternPriorities.get(pattern.id);
    
    // If no config, use pattern's own level settings
    if (!config) {
      return pattern.levels.includes(this.currentLevel);
    }
    
    return config.enabledLevels.includes(this.currentLevel);
  }
  
  /**
   * Get all enabled patterns sorted by priority
   */
  getEnabledPatternsSorted(
    patterns: PeepholePattern[],
    context?: PriorityContext
  ): PeepholePattern[] {
    return patterns
      .filter(p => this.isPatternEnabled(p))
      .sort((a, b) => {
        const prioA = this.getEffectivePriority(a, context);
        const prioB = this.getEffectivePriority(b, context);
        return prioB - prioA;
      });
  }
  
  /**
   * Evaluate a priority condition
   */
  protected evaluateCondition(
    condition: PriorityCondition,
    context: PriorityContext
  ): boolean {
    switch (condition.type) {
      case 'loop':
        return context.inLoop ?? false;
      case 'function':
        return context.functionName === condition.data;
      case 'region':
        return context.regionType === condition.data;
      default:
        return false;
    }
  }
  
  /**
   * Export configuration
   */
  exportConfig(): PriorityConfigExport {
    return {
      level: this.currentLevel,
      patterns: [...this.patternPriorities.values()],
      categories: Object.fromEntries(this.categoryPriorities),
    };
  }
  
  /**
   * Import configuration
   */
  importConfig(config: PriorityConfigExport): void {
    this.currentLevel = config.level;
    this.patternPriorities.clear();
    for (const p of config.patterns) {
      this.patternPriorities.set(p.patternId, p);
    }
    this.categoryPriorities = new Map(Object.entries(config.categories));
  }
}

/**
 * Context for priority evaluation
 */
export interface PriorityContext {
  /** Are we in a loop? */
  readonly inLoop?: boolean;
  /** Current function name */
  readonly functionName?: string;
  /** Region type (hot/cold/normal) */
  readonly regionType?: string;
  /** Loop nesting depth */
  readonly loopDepth?: number;
}

/**
 * Export format for priority config
 */
export interface PriorityConfigExport {
  readonly level: OptimizationLevel;
  readonly patterns: PatternPriority[];
  readonly categories: Record<string, number>;
}

/** Default priority config manager */
export const priorityConfig = new PriorityConfigManager();
```

### File: `pass-scheduler.ts`

```typescript
import { PeepholePattern } from '../peephole/pattern.js';
import { OrderedPattern, OrderingStrategy, PatternOrderingComputer, OrderingResult } from './ordering-strategy.js';
import { FixedPointIterator, FixedPointResult, PatternApplicator } from './fixed-point.js';
import { WorklistOptimizer, WorklistResult, SinglePatternApplicator } from './worklist.js';
import { DependencyGraph } from './dependency-graph.js';
import { PriorityConfigManager, priorityConfig, PriorityContext } from './priority-config.js';

/**
 * Pass definition
 */
export interface PassDefinition {
  /** Unique pass ID */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Patterns included in this pass */
  readonly patterns: string[];
  /** Ordering strategy for patterns */
  readonly strategy: OrderingStrategy;
  /** Whether to use worklist algorithm */
  readonly useWorklist: boolean;
  /** Maximum iterations for fixed-point */
  readonly maxIterations: number;
  /** Pass dependencies (run after these) */
  readonly runAfter: string[];
}

/**
 * Pass execution result
 */
export interface PassResult {
  /** Pass ID */
  readonly passId: string;
  /** Whether pass succeeded */
  readonly success: boolean;
  /** Instructions after pass */
  readonly instructions: ILInstruction[];
  /** Patterns applied */
  readonly patternsApplied: number;
  /** Iterations run */
  readonly iterations: number;
  /** Execution time (ms) */
  readonly executionTime: number;
  /** Cycles saved */
  readonly cyclesSaved: number;
}

/**
 * Complete scheduling result
 */
export interface SchedulingResult {
  /** Final instructions */
  readonly instructions: ILInstruction[];
  /** Results per pass */
  readonly passResults: PassResult[];
  /** Total patterns applied */
  readonly totalPatternsApplied: number;
  /** Total cycles saved */
  readonly totalCyclesSaved: number;
  /** Total execution time */
  readonly totalTime: number;
}

/**
 * Pass scheduler for organizing optimization passes
 */
export class PassScheduler {
  protected passes: Map<string, PassDefinition> = new Map();
  protected patternMap: Map<string, PeepholePattern> = new Map();
  protected priorityManager: PriorityConfigManager;
  
  constructor(priorityManager: PriorityConfigManager = priorityConfig) {
    this.priorityManager = priorityManager;
  }
  
  /**
   * Register all patterns
   */
  registerPatterns(patterns: PeepholePattern[]): void {
    this.patternMap.clear();
    for (const p of patterns) {
      this.patternMap.set(p.id, p);
    }
  }
  
  /**
   * Register a pass
   */
  registerPass(pass: PassDefinition): void {
    this.passes.set(pass.id, pass);
  }
  
  /**
   * Register default passes
   */
  registerDefaultPasses(): void {
    // Pass 1: Dead code and constants
    this.registerPass({
      id: 'early-cleanup',
      name: 'Early Cleanup',
      patterns: ['dead-store-*', 'constant-fold-*'],
      strategy: OrderingStrategy.CategoryBased,
      useWorklist: false,
      maxIterations: 10,
      runAfter: [],
    });
    
    // Pass 2: Load/store optimization
    this.registerPass({
      id: 'load-store',
      name: 'Load/Store Optimization',
      patterns: ['redundant-load-*', 'redundant-store-*', 'zp-*'],
      strategy: OrderingStrategy.Topological,
      useWorklist: true,
      maxIterations: 20,
      runAfter: ['early-cleanup'],
    });
    
    // Pass 3: Arithmetic optimization
    this.registerPass({
      id: 'arithmetic',
      name: 'Arithmetic Optimization',
      patterns: ['adc-*', 'sbc-*', 'inc-*', 'dec-*', 'shift-*'],
      strategy: OrderingStrategy.Greedy,
      useWorklist: false,
      maxIterations: 15,
      runAfter: ['load-store'],
    });
    
    // Pass 4: Transfer and flag optimization
    this.registerPass({
      id: 'transfer-flag',
      name: 'Transfer and Flag Optimization',
      patterns: ['tax-*', 'txa-*', 'clc-*', 'sec-*'],
      strategy: OrderingStrategy.Priority,
      useWorklist: false,
      maxIterations: 10,
      runAfter: ['arithmetic'],
    });
    
    // Pass 5: Branch optimization
    this.registerPass({
      id: 'branch',
      name: 'Branch Optimization',
      patterns: ['branch-*', 'cmp-*'],
      strategy: OrderingStrategy.CategoryBased,
      useWorklist: true,
      maxIterations: 15,
      runAfter: ['transfer-flag'],
    });
    
    // Pass 6: Final cleanup
    this.registerPass({
      id: 'final-cleanup',
      name: 'Final Cleanup',
      patterns: ['*'], // All patterns
      strategy: OrderingStrategy.Topological,
      useWorklist: false,
      maxIterations: 5,
      runAfter: ['branch'],
    });
  }
  
  /**
   * Compute pass execution order
   */
  computePassOrder(): string[] {
    // Topological sort based on runAfter dependencies
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();
    
    for (const [id, pass] of this.passes) {
      inDegree.set(id, pass.runAfter.length);
      for (const dep of pass.runAfter) {
        const deps = graph.get(dep) || [];
        deps.push(id);
        graph.set(dep, deps);
      }
    }
    
    const queue = [...this.passes.keys()].filter(
      id => (inDegree.get(id) || 0) === 0
    );
    const order: string[] = [];
    
    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(id);
      
      for (const dependent of graph.get(id) || []) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }
    
    return order;
  }
  
  /**
   * Run all passes
   */
  runAllPasses(
    instructions: ILInstruction[],
    applyPattern: PatternApplicator,
    applySingle: SinglePatternApplicator,
    context?: PriorityContext
  ): SchedulingResult {
    const startTime = Date.now();
    const passResults: PassResult[] = [];
    let current = instructions;
    let totalApplied = 0;
    let totalCyclesSaved = 0;
    
    const order = this.computePassOrder();
    
    for (const passId of order) {
      const pass = this.passes.get(passId)!;
      const result = this.runPass(
        pass,
        current,
        applyPattern,
        applySingle,
        context
      );
      
      passResults.push(result);
      current = result.instructions;
      totalApplied += result.patternsApplied;
      totalCyclesSaved += result.cyclesSaved;
    }
    
    return {
      instructions: current,
      passResults,
      totalPatternsApplied: totalApplied,
      totalCyclesSaved,
      totalTime: Date.now() - startTime,
    };
  }
  
  /**
   * Run a single pass
   */
  protected runPass(
    pass: PassDefinition,
    instructions: ILInstruction[],
    applyPattern: PatternApplicator,
    applySingle: SinglePatternApplicator,
    context?: PriorityContext
  ): PassResult {
    const startTime = Date.now();
    
    // Get patterns for this pass
    const patterns = this.getPatternsForPass(pass);
    const enabled = this.priorityManager.getEnabledPatternsSorted(
      patterns,
      context
    );
    
    // Build dependency graph
    const graph = new DependencyGraph();
    for (const p of enabled) {
      graph.addPattern(p.id);
    }
    
    // Create ordered patterns
    const computer = new PatternOrderingComputer(graph);
    const ordering = computer.computeOrdering(enabled, pass.strategy);
    
    // Run optimization
    let result: { instructions: ILInstruction[]; applied: number; cyclesSaved: number; iterations: number };
    
    if (pass.useWorklist) {
      const worklist = new WorklistOptimizer();
      const worklistResult = worklist.run(
        instructions,
        ordering.ordered,
        applySingle
      );
      result = {
        instructions: worklistResult.instructions,
        applied: worklistResult.patternsApplied,
        cyclesSaved: 0, // Would need to track in worklist
        iterations: 1,
      };
    } else {
      const iterator = new FixedPointIterator({
        maxIterations: pass.maxIterations,
      });
      const fpResult = iterator.iterate(
        instructions,
        ordering.ordered,
        applyPattern
      );
      result = {
        instructions: fpResult.instructions,
        applied: fpResult.patternsApplied,
        cyclesSaved: fpResult.stats.reduce((sum, s) => sum + s.cyclesSaved, 0),
        iterations: fpResult.iterations,
      };
    }
    
    return {
      passId: pass.id,
      success: true,
      instructions: result.instructions,
      patternsApplied: result.applied,
      iterations: result.iterations,
      executionTime: Date.now() - startTime,
      cyclesSaved: result.cyclesSaved,
    };
  }
  
  /**
   * Get patterns matching pass filter
   */
  protected getPatternsForPass(pass: PassDefinition): PeepholePattern[] {
    const patterns: PeepholePattern[] = [];
    
    for (const filter of pass.patterns) {
      if (filter === '*') {
        // All patterns
        return [...this.patternMap.values()];
      }
      
      if (filter.endsWith('*')) {
        // Prefix match
        const prefix = filter.slice(0, -1);
        for (const [id, pattern] of this.patternMap) {
          if (id.startsWith(prefix)) {
            patterns.push(pattern);
          }
        }
      } else {
        // Exact match
        const pattern = this.patternMap.get(filter);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }
    
    return patterns;
  }
}

/** Default pass scheduler */
export const passScheduler = new PassScheduler();
```

### File: `optimization-level.ts`

```typescript
import { OptimizationLevel, PatternPriority } from './priority-config.js';
import { PassDefinition } from './pass-scheduler.js';

/**
 * Level-specific configuration
 */
export interface LevelConfig {
  /** Optimization level */
  readonly level: OptimizationLevel;
  /** Pattern priorities for this level */
  readonly patternPriorities: PatternPriority[];
  /** Enabled passes */
  readonly enabledPasses: string[];
  /** Fixed-point iteration limits */
  readonly maxIterations: number;
  /** Use worklist algorithm */
  readonly preferWorklist: boolean;
  /** Description */
  readonly description: string;
}

/**
 * Default level configurations
 */
export const LEVEL_CONFIGS: Record<OptimizationLevel, LevelConfig> = {
  [OptimizationLevel.O0]: {
    level: OptimizationLevel.O0,
    patternPriorities: [],
    enabledPasses: [],
    maxIterations: 0,
    preferWorklist: false,
    description: 'No optimization - fastest compilation',
  },
  
  [OptimizationLevel.O1]: {
    level: OptimizationLevel.O1,
    patternPriorities: [
      { patternId: 'dead-store-simple', basePriority: 80, enabledLevels: [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3] },
      { patternId: 'redundant-load-simple', basePriority: 75, enabledLevels: [OptimizationLevel.O1, OptimizationLevel.O2, OptimizationLevel.O3] },
    ],
    enabledPasses: ['early-cleanup'],
    maxIterations: 5,
    preferWorklist: false,
    description: 'Basic optimization - safe, fast',
  },
  
  [OptimizationLevel.O2]: {
    level: OptimizationLevel.O2,
    patternPriorities: [
      { patternId: '*', basePriority: 50, enabledLevels: [OptimizationLevel.O2, OptimizationLevel.O3] },
    ],
    enabledPasses: ['early-cleanup', 'load-store', 'arithmetic', 'transfer-flag', 'branch'],
    maxIterations: 20,
    preferWorklist: true,
    description: 'Standard optimization - good balance',
  },
  
  [OptimizationLevel.O3]: {
    level: OptimizationLevel.O3,
    patternPriorities: [
      { patternId: '*', basePriority: 60, enabledLevels: [OptimizationLevel.O3] },
    ],
    enabledPasses: ['early-cleanup', 'load-store', 'arithmetic', 'transfer-flag', 'branch', 'final-cleanup'],
    maxIterations: 50,
    preferWorklist: true,
    description: 'Aggressive optimization - maximum performance',
  },
  
  [OptimizationLevel.Os]: {
    level: OptimizationLevel.Os,
    patternPriorities: [
      { patternId: 'dead-store-*', basePriority: 90, enabledLevels: [OptimizationLevel.Os] },
      { patternId: 'combine-*', basePriority: 85, enabledLevels: [OptimizationLevel.Os] },
    ],
    enabledPasses: ['early-cleanup', 'load-store', 'final-cleanup'],
    maxIterations: 30,
    preferWorklist: false,
    description: 'Size optimization - smallest code',
  },
  
  [OptimizationLevel.Ofast]: {
    level: OptimizationLevel.Ofast,
    patternPriorities: [
      { patternId: '*', basePriority: 70, enabledLevels: [OptimizationLevel.Ofast] },
    ],
    enabledPasses: ['early-cleanup', 'load-store', 'arithmetic', 'transfer-flag', 'branch', 'final-cleanup'],
    maxIterations: 100,
    preferWorklist: true,
    description: 'Maximum speed - ignore size',
  },
};

/**
 * Level configuration manager
 */
export class LevelConfigManager {
  protected configs: Map<OptimizationLevel, LevelConfig>;
  
  constructor() {
    this.configs = new Map(
      Object.entries(LEVEL_CONFIGS).map(([_, v]) => [v.level, v])
    );
  }
  
  /**
   * Get configuration for a level
   */
  getConfig(level: OptimizationLevel): LevelConfig {
    return this.configs.get(level) || LEVEL_CONFIGS[OptimizationLevel.O2];
  }
  
  /**
   * Set custom configuration for a level
   */
  setConfig(level: OptimizationLevel, config: LevelConfig): void {
    this.configs.set(level, config);
  }
  
  /**
   * Get enabled passes for a level
   */
  getEnabledPasses(level: OptimizationLevel): string[] {
    return this.getConfig(level).enabledPasses;
  }
  
  /**
   * Get max iterations for a level
   */
  getMaxIterations(level: OptimizationLevel): number {
    return this.getConfig(level).maxIterations;
  }
  
  /**
   * Should use worklist for a level
   */
  shouldUseWorklist(level: OptimizationLevel): boolean {
    return this.getConfig(level).preferWorklist;
  }
  
  /**
   * Get all level descriptions
   */
  getLevelDescriptions(): Record<OptimizationLevel, string> {
    const result: Record<OptimizationLevel, string> = {} as any;
    for (const [level, config] of this.configs) {
      result[level] = config.description;
    }
    return result;
  }
}

/** Default level config manager */
export const levelConfig = new LevelConfigManager();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `priority-config.setOptimizationLevel` | Change optimization level |
| `priority-config.getEffectivePriority` | Calculate effective priority |
| `priority-config.isPatternEnabled` | Check pattern enabled |
| `priority-config.getEnabledPatternsSorted` | Get sorted enabled patterns |
| `priority-config.evaluateCondition` | Evaluate priority conditions |
| `pass-scheduler.registerPass` | Register optimization pass |
| `pass-scheduler.computePassOrder` | Compute dependency order |
| `pass-scheduler.runAllPasses` | Execute all passes |
| `pass-scheduler.getPatternsForPass` | Filter patterns by pass |
| `level-config.getConfig` | Get level configuration |
| `level-config.getEnabledPasses` | Get passes for level |
| `level-config.shouldUseWorklist` | Check worklist preference |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `priority-config.ts` | [ ] |
| Create `pass-scheduler.ts` | [ ] |
| Create `optimization-level.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

## 08-peephole Phase Complete! 🎉

This completes all 46 documents for the 08-peephole phase:

- Tasks 8.1-8.2: Framework & Matcher
- Tasks 8.3a-8.3c: Load/Store patterns
- Tasks 8.4a-8.4c: Arithmetic patterns
- Tasks 8.5a-8.5d: Branch patterns
- Tasks 8.6a-8.6b: Transfer patterns
- Tasks 8.7a-8.7b: Flag patterns
- Tasks 8.8a-8.8d: Combining patterns
- Tasks 8.9a-8.9j: Redundancy patterns
- Tasks 8.10a-8.10e: Pattern DSL
- Tasks 8.11a-8.11d: Cost Model
- Tasks 8.12a-8.12c: Pattern Ordering

**Next Phase**: 09-target-specific (Sessions 4.1a → 4.8)