# Task 8.12b: Ordering Algorithms & Fixed-Point

> **Task**: 8.12b of 12 (Peephole Phase - Pattern Ordering)  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: Task 8.12a (Pattern Dependency Analysis)

---

## Overview

Implement pattern ordering algorithms including fixed-point iteration for determining when to stop applying patterns. The optimizer must apply patterns repeatedly until no more matches are found (fixed-point), while respecting ordering constraints and maximizing optimization benefit.

---

## Directory Structure

```
packages/compiler/src/optimizer/ordering/
├── index.ts              # Exports
├── types.ts              # Ordering types
├── dependency-graph.ts   # Dependency graph
├── pattern-analysis.ts   # Pattern relationship analysis
├── conflict-detection.ts # Conflict detection
├── ordering-strategy.ts  # Ordering strategies (THIS TASK)
├── fixed-point.ts        # Fixed-point iteration (THIS TASK)
└── worklist.ts           # Worklist algorithms (THIS TASK)
```

---

## Implementation

### File: `ordering-strategy.ts`

```typescript
import { DependencyGraph } from './dependency-graph.js';
import { PatternRelationship, DependencyEdge } from './types.js';
import { PeepholePattern } from '../peephole/pattern.js';

/**
 * Ordering strategy type
 */
export enum OrderingStrategy {
  /** Use topological sort based on dependencies */
  Topological = 'topological',
  /** Priority-based ordering */
  Priority = 'priority',
  /** Category-based grouping */
  CategoryBased = 'category-based',
  /** Greedy (highest benefit first) */
  Greedy = 'greedy',
  /** Round-robin (fair scheduling) */
  RoundRobin = 'round-robin',
}

/**
 * Pattern with ordering metadata
 */
export interface OrderedPattern {
  /** The pattern */
  readonly pattern: PeepholePattern;
  /** Computed order position */
  readonly position: number;
  /** Priority within same position */
  readonly priority: number;
  /** Category for grouping */
  readonly category: string;
}

/**
 * Result of ordering computation
 */
export interface OrderingResult {
  /** Ordered list of patterns */
  readonly ordered: OrderedPattern[];
  /** Patterns that couldn't be ordered (cycles) */
  readonly unordered: PeepholePattern[];
  /** Strategy used */
  readonly strategy: OrderingStrategy;
  /** Any warnings */
  readonly warnings: string[];
}

/**
 * Computer for pattern ordering
 */
export class PatternOrderingComputer {
  protected graph: DependencyGraph;
  
  constructor(graph: DependencyGraph) {
    this.graph = graph;
  }
  
  /**
   * Compute ordering using specified strategy
   */
  computeOrdering(
    patterns: PeepholePattern[],
    strategy: OrderingStrategy
  ): OrderingResult {
    switch (strategy) {
      case OrderingStrategy.Topological:
        return this.topologicalOrdering(patterns);
      case OrderingStrategy.Priority:
        return this.priorityOrdering(patterns);
      case OrderingStrategy.CategoryBased:
        return this.categoryOrdering(patterns);
      case OrderingStrategy.Greedy:
        return this.greedyOrdering(patterns);
      case OrderingStrategy.RoundRobin:
        return this.roundRobinOrdering(patterns);
      default:
        return this.topologicalOrdering(patterns);
    }
  }
  
  /**
   * Topological ordering based on dependencies
   */
  protected topologicalOrdering(
    patterns: PeepholePattern[]
  ): OrderingResult {
    const warnings: string[] = [];
    const sorted = this.graph.topologicalSort();
    
    if (!sorted) {
      warnings.push('Dependency graph has cycles, using partial order');
      return this.fallbackOrdering(patterns, warnings);
    }
    
    const ordered: OrderedPattern[] = [];
    const patternMap = new Map(patterns.map(p => [p.id, p]));
    
    for (let i = 0; i < sorted.length; i++) {
      const pattern = patternMap.get(sorted[i]);
      if (pattern) {
        ordered.push({
          pattern,
          position: i,
          priority: sorted.length - i,
          category: pattern.category,
        });
      }
    }
    
    return {
      ordered,
      unordered: [],
      strategy: OrderingStrategy.Topological,
      warnings,
    };
  }
  
  /**
   * Priority-based ordering
   */
  protected priorityOrdering(
    patterns: PeepholePattern[]
  ): OrderingResult {
    // Sort by explicit priority metadata
    const sorted = [...patterns].sort((a, b) => {
      const aPriority = (a as any).priority ?? 50;
      const bPriority = (b as any).priority ?? 50;
      return bPriority - aPriority;
    });
    
    const ordered: OrderedPattern[] = sorted.map((pattern, i) => ({
      pattern,
      position: i,
      priority: (pattern as any).priority ?? 50,
      category: pattern.category,
    }));
    
    return {
      ordered,
      unordered: [],
      strategy: OrderingStrategy.Priority,
      warnings: [],
    };
  }
  
  /**
   * Category-based grouping
   */
  protected categoryOrdering(
    patterns: PeepholePattern[]
  ): OrderingResult {
    // Define category execution order
    const categoryOrder: string[] = [
      'dead-code',
      'constant-fold',
      'redundancy',
      'load-store',
      'arithmetic',
      'transfer',
      'combining',
      'branch',
      'flag',
      'general',
    ];
    
    const ordered: OrderedPattern[] = [];
    const byCategory = new Map<string, PeepholePattern[]>();
    
    // Group by category
    for (const pattern of patterns) {
      const cat = pattern.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(pattern);
    }
    
    // Order by category, then by ID within category
    let position = 0;
    for (const cat of categoryOrder) {
      const categoryPatterns = byCategory.get(cat) || [];
      categoryPatterns.sort((a, b) => a.id.localeCompare(b.id));
      
      for (const pattern of categoryPatterns) {
        ordered.push({
          pattern,
          position: position++,
          priority: categoryOrder.length - categoryOrder.indexOf(cat),
          category: cat,
        });
      }
    }
    
    // Add any uncategorized patterns at end
    for (const [cat, categoryPatterns] of byCategory) {
      if (!categoryOrder.includes(cat)) {
        for (const pattern of categoryPatterns) {
          ordered.push({
            pattern,
            position: position++,
            priority: 0,
            category: cat,
          });
        }
      }
    }
    
    return {
      ordered,
      unordered: [],
      strategy: OrderingStrategy.CategoryBased,
      warnings: [],
    };
  }
  
  /**
   * Greedy ordering by expected benefit
   */
  protected greedyOrdering(
    patterns: PeepholePattern[]
  ): OrderingResult {
    // Sort by estimated benefit (window size * category weight)
    const sorted = [...patterns].sort((a, b) => {
      const aBenefit = this.estimateBenefit(a);
      const bBenefit = this.estimateBenefit(b);
      return bBenefit - aBenefit;
    });
    
    const ordered: OrderedPattern[] = sorted.map((pattern, i) => ({
      pattern,
      position: i,
      priority: this.estimateBenefit(pattern),
      category: pattern.category,
    }));
    
    return {
      ordered,
      unordered: [],
      strategy: OrderingStrategy.Greedy,
      warnings: [],
    };
  }
  
  /**
   * Round-robin fair scheduling
   */
  protected roundRobinOrdering(
    patterns: PeepholePattern[]
  ): OrderingResult {
    const byCategory = new Map<string, PeepholePattern[]>();
    
    for (const pattern of patterns) {
      const cat = pattern.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(pattern);
    }
    
    const categories = [...byCategory.keys()];
    const ordered: OrderedPattern[] = [];
    let position = 0;
    let anyRemaining = true;
    
    // Round-robin through categories
    while (anyRemaining) {
      anyRemaining = false;
      for (const cat of categories) {
        const catPatterns = byCategory.get(cat)!;
        if (catPatterns.length > 0) {
          const pattern = catPatterns.shift()!;
          ordered.push({
            pattern,
            position: position++,
            priority: 50,
            category: cat,
          });
          anyRemaining = anyRemaining || catPatterns.length > 0;
        }
      }
    }
    
    return {
      ordered,
      unordered: [],
      strategy: OrderingStrategy.RoundRobin,
      warnings: [],
    };
  }
  
  /**
   * Fallback ordering when graph has cycles
   */
  protected fallbackOrdering(
    patterns: PeepholePattern[],
    warnings: string[]
  ): OrderingResult {
    // Use category ordering as fallback
    return {
      ...this.categoryOrdering(patterns),
      warnings,
    };
  }
  
  /**
   * Estimate benefit of a pattern
   */
  protected estimateBenefit(pattern: PeepholePattern): number {
    // Larger window patterns often have more impact
    const windowBonus = pattern.windowSize * 10;
    
    // Category weight
    const categoryWeights: Record<string, number> = {
      'dead-code': 100,
      'constant-fold': 90,
      'redundancy': 80,
      'load-store': 70,
      'arithmetic': 60,
      'combining': 50,
      'branch': 40,
      'transfer': 30,
      'flag': 20,
    };
    
    const categoryBonus = categoryWeights[pattern.category] ?? 10;
    
    return windowBonus + categoryBonus;
  }
}
```

### File: `fixed-point.ts`

```typescript
import { PeepholePattern, PatternMatch, PatternReplacement } from '../peephole/pattern.js';
import { OrderedPattern } from './ordering-strategy.js';

/**
 * Fixed-point iteration result
 */
export interface FixedPointResult {
  /** Final instruction list */
  readonly instructions: ILInstruction[];
  /** Number of iterations performed */
  readonly iterations: number;
  /** Total patterns applied */
  readonly patternsApplied: number;
  /** Whether fixed-point was reached */
  readonly converged: boolean;
  /** Reason if not converged */
  readonly stopReason: string;
  /** Per-iteration statistics */
  readonly stats: IterationStats[];
}

/**
 * Statistics for one iteration
 */
export interface IterationStats {
  /** Iteration number */
  readonly iteration: number;
  /** Patterns applied this iteration */
  readonly patternsApplied: number;
  /** Instructions before */
  readonly instructionsBefore: number;
  /** Instructions after */
  readonly instructionsAfter: number;
  /** Cycles saved this iteration */
  readonly cyclesSaved: number;
}

/**
 * Fixed-point iteration configuration
 */
export interface FixedPointConfig {
  /** Maximum iterations before giving up */
  readonly maxIterations: number;
  /** Stop if no improvement for this many iterations */
  readonly stagnationLimit: number;
  /** Minimum patterns per iteration to continue */
  readonly minPatternsPerIteration: number;
  /** Enable debug logging */
  readonly debug: boolean;
}

/**
 * Default fixed-point configuration
 */
export const DEFAULT_FIXED_POINT_CONFIG: FixedPointConfig = {
  maxIterations: 100,
  stagnationLimit: 3,
  minPatternsPerIteration: 1,
  debug: false,
};

/**
 * Fixed-point iterator for peephole optimization
 */
export class FixedPointIterator {
  protected config: FixedPointConfig;
  
  constructor(config: Partial<FixedPointConfig> = {}) {
    this.config = { ...DEFAULT_FIXED_POINT_CONFIG, ...config };
  }
  
  /**
   * Run fixed-point iteration
   */
  iterate(
    instructions: ILInstruction[],
    patterns: OrderedPattern[],
    applyPattern: PatternApplicator
  ): FixedPointResult {
    let current = [...instructions];
    const stats: IterationStats[] = [];
    let totalApplied = 0;
    let stagnationCount = 0;
    let iteration = 0;
    
    while (iteration < this.config.maxIterations) {
      iteration++;
      
      const before = current.length;
      const result = this.runIteration(current, patterns, applyPattern);
      const after = result.instructions.length;
      
      stats.push({
        iteration,
        patternsApplied: result.applied,
        instructionsBefore: before,
        instructionsAfter: after,
        cyclesSaved: result.cyclesSaved,
      });
      
      totalApplied += result.applied;
      current = result.instructions;
      
      if (this.config.debug) {
        console.log(`Iteration ${iteration}: applied ${result.applied}, ` +
                    `${before} -> ${after} instructions`);
      }
      
      // Check for convergence
      if (result.applied === 0) {
        return {
          instructions: current,
          iterations: iteration,
          patternsApplied: totalApplied,
          converged: true,
          stopReason: 'No more patterns matched',
          stats,
        };
      }
      
      // Check for stagnation
      if (result.applied < this.config.minPatternsPerIteration) {
        stagnationCount++;
        if (stagnationCount >= this.config.stagnationLimit) {
          return {
            instructions: current,
            iterations: iteration,
            patternsApplied: totalApplied,
            converged: true,
            stopReason: 'Stagnation limit reached',
            stats,
          };
        }
      } else {
        stagnationCount = 0;
      }
    }
    
    // Max iterations reached
    return {
      instructions: current,
      iterations: iteration,
      patternsApplied: totalApplied,
      converged: false,
      stopReason: `Max iterations (${this.config.maxIterations}) reached`,
      stats,
    };
  }
  
  /**
   * Run one iteration of pattern application
   */
  protected runIteration(
    instructions: ILInstruction[],
    patterns: OrderedPattern[],
    applyPattern: PatternApplicator
  ): { instructions: ILInstruction[]; applied: number; cyclesSaved: number } {
    let current = instructions;
    let totalApplied = 0;
    let totalCyclesSaved = 0;
    
    // Apply patterns in order
    for (const ordered of patterns) {
      const result = applyPattern(current, ordered.pattern);
      if (result.applied > 0) {
        current = result.instructions;
        totalApplied += result.applied;
        totalCyclesSaved += result.cyclesSaved;
      }
    }
    
    return {
      instructions: current,
      applied: totalApplied,
      cyclesSaved: totalCyclesSaved,
    };
  }
  
  /**
   * Check if two instruction lists are equivalent
   */
  protected instructionsEqual(
    a: ILInstruction[],
    b: ILInstruction[]
  ): boolean {
    if (a.length !== b.length) return false;
    
    for (let i = 0; i < a.length; i++) {
      if (!this.instructionEqual(a[i], b[i])) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Check if two instructions are equivalent
   */
  protected instructionEqual(
    a: ILInstruction,
    b: ILInstruction
  ): boolean {
    return a.opcode === b.opcode &&
           JSON.stringify(a.operands) === JSON.stringify(b.operands);
  }
}

/**
 * Pattern application function type
 */
export type PatternApplicator = (
  instructions: ILInstruction[],
  pattern: PeepholePattern
) => { instructions: ILInstruction[]; applied: number; cyclesSaved: number };

/** Default fixed-point iterator */
export const fixedPointIterator = new FixedPointIterator();
```

### File: `worklist.ts`

```typescript
import { PeepholePattern } from '../peephole/pattern.js';
import { OrderedPattern } from './ordering-strategy.js';

/**
 * Worklist item
 */
export interface WorklistItem {
  /** Pattern to apply */
  readonly pattern: PeepholePattern;
  /** Instruction range to check */
  readonly startIndex: number;
  readonly endIndex: number;
  /** Priority for processing order */
  readonly priority: number;
}

/**
 * Worklist algorithm result
 */
export interface WorklistResult {
  /** Final instructions */
  readonly instructions: ILInstruction[];
  /** Items processed */
  readonly itemsProcessed: number;
  /** Patterns applied */
  readonly patternsApplied: number;
  /** Whether worklist emptied */
  readonly completed: boolean;
}

/**
 * Worklist-based optimizer
 */
export class WorklistOptimizer {
  protected worklist: WorklistItem[] = [];
  protected maxWorklistSize: number;
  
  constructor(maxSize: number = 10000) {
    this.maxWorklistSize = maxSize;
  }
  
  /**
   * Initialize worklist with all patterns for all positions
   */
  initialize(
    instructions: ILInstruction[],
    patterns: OrderedPattern[]
  ): void {
    this.worklist = [];
    
    for (const ordered of patterns) {
      const windowSize = ordered.pattern.windowSize;
      for (let i = 0; i <= instructions.length - windowSize; i++) {
        this.addItem({
          pattern: ordered.pattern,
          startIndex: i,
          endIndex: i + windowSize,
          priority: ordered.priority,
        });
      }
    }
    
    // Sort by priority (descending)
    this.worklist.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Add item to worklist
   */
  addItem(item: WorklistItem): void {
    if (this.worklist.length < this.maxWorklistSize) {
      this.worklist.push(item);
    }
  }
  
  /**
   * Add items for updated region
   */
  addUpdatedRegion(
    startIndex: number,
    endIndex: number,
    patterns: OrderedPattern[]
  ): void {
    for (const ordered of patterns) {
      const windowSize = ordered.pattern.windowSize;
      
      // Add items that could be affected by the change
      const rangeStart = Math.max(0, startIndex - windowSize + 1);
      const rangeEnd = endIndex;
      
      for (let i = rangeStart; i <= rangeEnd - windowSize; i++) {
        this.addItem({
          pattern: ordered.pattern,
          startIndex: i,
          endIndex: i + windowSize,
          priority: ordered.priority,
        });
      }
    }
    
    // Re-sort
    this.worklist.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Get next item from worklist
   */
  getNext(): WorklistItem | undefined {
    return this.worklist.shift();
  }
  
  /**
   * Check if worklist is empty
   */
  isEmpty(): boolean {
    return this.worklist.length === 0;
  }
  
  /**
   * Get worklist size
   */
  size(): number {
    return this.worklist.length;
  }
  
  /**
   * Run worklist algorithm
   */
  run(
    instructions: ILInstruction[],
    patterns: OrderedPattern[],
    applyPattern: SinglePatternApplicator
  ): WorklistResult {
    let current = [...instructions];
    this.initialize(current, patterns);
    
    let itemsProcessed = 0;
    let patternsApplied = 0;
    
    while (!this.isEmpty()) {
      const item = this.getNext()!;
      itemsProcessed++;
      
      // Skip if indices are now out of bounds
      if (item.startIndex >= current.length ||
          item.endIndex > current.length) {
        continue;
      }
      
      // Try to apply pattern at this location
      const window = current.slice(item.startIndex, item.endIndex);
      const result = applyPattern(window, item.pattern);
      
      if (result.applied) {
        // Replace instructions
        const before = current.length;
        current = [
          ...current.slice(0, item.startIndex),
          ...result.replacement,
          ...current.slice(item.endIndex),
        ];
        
        patternsApplied++;
        
        // Add new worklist items for affected region
        const sizeDiff = result.replacement.length - (item.endIndex - item.startIndex);
        const newEnd = item.startIndex + result.replacement.length;
        
        this.addUpdatedRegion(item.startIndex, newEnd, patterns);
        
        // Adjust indices of remaining items
        this.adjustIndices(item.startIndex, sizeDiff);
      }
    }
    
    return {
      instructions: current,
      itemsProcessed,
      patternsApplied,
      completed: true,
    };
  }
  
  /**
   * Adjust indices after instruction change
   */
  protected adjustIndices(changeIndex: number, sizeDiff: number): void {
    if (sizeDiff === 0) return;
    
    for (const item of this.worklist) {
      if (item.startIndex > changeIndex) {
        (item as any).startIndex += sizeDiff;
        (item as any).endIndex += sizeDiff;
      }
    }
    
    // Remove invalid items
    this.worklist = this.worklist.filter(
      item => item.startIndex >= 0 && item.endIndex >= item.startIndex
    );
  }
  
  /**
   * Clear the worklist
   */
  clear(): void {
    this.worklist = [];
  }
}

/**
 * Single pattern application function type
 */
export type SinglePatternApplicator = (
  window: ILInstruction[],
  pattern: PeepholePattern
) => { applied: boolean; replacement: ILInstruction[] };

/** Default worklist optimizer */
export const worklistOptimizer = new WorklistOptimizer();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `ordering-strategy.topological` | Topological sort ordering |
| `ordering-strategy.priority` | Priority-based ordering |
| `ordering-strategy.category` | Category-based ordering |
| `ordering-strategy.greedy` | Greedy benefit ordering |
| `ordering-strategy.roundRobin` | Fair round-robin ordering |
| `fixed-point.iterate` | Full iteration to convergence |
| `fixed-point.runIteration` | Single iteration |
| `fixed-point.stagnation` | Detect and handle stagnation |
| `fixed-point.maxIterations` | Respect iteration limit |
| `worklist.initialize` | Create initial worklist |
| `worklist.addUpdatedRegion` | Add items for changes |
| `worklist.run` | Complete worklist algorithm |
| `worklist.adjustIndices` | Index adjustment after changes |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `ordering-strategy.ts` | [ ] |
| Create `fixed-point.ts` | [ ] |
| Create `worklist.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.12c → `08-12c-ordering-config.md`