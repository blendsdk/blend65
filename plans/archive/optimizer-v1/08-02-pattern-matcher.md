# Task 8.2: Pattern Matcher

> **Task**: 8.2 of 12 (Peephole Phase)  
> **Time**: ~2 hours  
> **Tests**: ~60 tests  
> **Prerequisites**: Task 8.1 (Pattern Framework)

---

## Overview

Implement the pattern matching engine that:
- Applies patterns from the registry to IL code
- Uses sliding window approach for pattern matching
- Handles match ordering and conflict resolution
- Tracks statistics for optimization reporting

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/
├── index.ts           # Exports
├── pattern.ts         # Pattern interfaces (Task 8.1)
├── registry.ts        # Pattern registry (Task 8.1)
├── types.ts           # Pattern types (Task 8.1)
├── matcher.ts         # Pattern matcher (THIS TASK)
└── optimizer.ts       # Peephole optimizer (THIS TASK)
```

---

## Implementation

### File: `matcher.ts`

```typescript
import { BasicBlock, ILInstruction } from '../../il/index.js';
import { PeepholePattern, PatternMatch, PatternReplacement } from './pattern.js';
import { PatternRegistry } from './registry.js';

/**
 * Result of applying patterns to a block
 */
export interface MatcherResult {
  /** Pattern that matched */
  readonly pattern: PeepholePattern;
  /** Match details */
  readonly match: PatternMatch;
  /** Replacement instructions */
  readonly replacement: PatternReplacement;
  /** Index in instruction stream where match starts */
  readonly startIndex: number;
}

/**
 * Statistics from pattern matching
 */
export interface MatcherStats {
  /** Patterns checked */
  readonly patternsChecked: number;
  /** Successful matches */
  readonly matchesFound: number;
  /** Matches applied */
  readonly matchesApplied: number;
  /** Total cycles saved */
  readonly cyclesSaved: number;
  /** Total bytes saved */
  readonly bytesSaved: number;
  /** Per-pattern match counts */
  readonly patternCounts: Map<string, number>;
}

/**
 * Configuration for pattern matcher
 */
export interface MatcherConfig {
  /** Maximum iterations to prevent infinite loops */
  readonly maxIterations: number;
  /** Whether to collect detailed stats */
  readonly collectStats: boolean;
  /** Patterns to exclude by ID */
  readonly excludePatterns: Set<string>;
}

/**
 * Default matcher configuration
 */
export const DEFAULT_MATCHER_CONFIG: MatcherConfig = {
  maxIterations: 100,
  collectStats: true,
  excludePatterns: new Set(),
};

/**
 * Pattern matcher - applies patterns to instruction streams
 */
export class PatternMatcher {
  protected readonly registry: PatternRegistry;
  protected readonly config: MatcherConfig;
  
  /** Current statistics */
  protected stats: MatcherStats;
  
  constructor(registry: PatternRegistry, config: Partial<MatcherConfig> = {}) {
    this.registry = registry;
    this.config = { ...DEFAULT_MATCHER_CONFIG, ...config };
    this.stats = this.createEmptyStats();
  }
  
  /**
   * Find all pattern matches in an instruction window
   * 
   * @param instructions - Instructions to examine
   * @param patterns - Patterns to try (defaults to all in registry)
   * @returns All matches found
   */
  findMatches(
    instructions: ILInstruction[],
    patterns?: PeepholePattern[]
  ): MatcherResult[] {
    const results: MatcherResult[] = [];
    const patternsToTry = patterns || [...this.registry.patterns.values()];
    
    // Sliding window over instructions
    for (let i = 0; i < instructions.length; i++) {
      for (const pattern of patternsToTry) {
        // Skip excluded patterns
        if (this.config.excludePatterns.has(pattern.id)) {
          continue;
        }
        
        // Get window of instructions
        const windowEnd = Math.min(i + pattern.windowSize, instructions.length);
        const window = instructions.slice(i, windowEnd);
        
        // Skip if window is smaller than pattern needs
        if (window.length < pattern.windowSize) {
          continue;
        }
        
        if (this.config.collectStats) {
          this.stats = {
            ...this.stats,
            patternsChecked: this.stats.patternsChecked + 1,
          };
        }
        
        // Try to match
        const match = pattern.match(window);
        if (match) {
          const replacement = pattern.replace(match);
          results.push({
            pattern,
            match,
            replacement,
            startIndex: i,
          });
          
          if (this.config.collectStats) {
            const count = this.stats.patternCounts.get(pattern.id) || 0;
            const newCounts = new Map(this.stats.patternCounts);
            newCounts.set(pattern.id, count + 1);
            
            this.stats = {
              ...this.stats,
              matchesFound: this.stats.matchesFound + 1,
              patternCounts: newCounts,
            };
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Find the best non-overlapping matches
   * 
   * Uses greedy algorithm: take highest-benefit matches first
   * 
   * @param matches - All matches found
   * @returns Non-overlapping matches sorted by benefit
   */
  selectBestMatches(matches: MatcherResult[]): MatcherResult[] {
    if (matches.length === 0) return [];
    
    // Sort by benefit (cycles + bytes saved)
    const sorted = [...matches].sort((a, b) => {
      const benefitA = a.replacement.cyclesSaved + a.replacement.bytesSaved;
      const benefitB = b.replacement.cyclesSaved + b.replacement.bytesSaved;
      return benefitB - benefitA; // Descending
    });
    
    const selected: MatcherResult[] = [];
    const usedIndices = new Set<number>();
    
    for (const match of sorted) {
      // Check if any instruction in this match is already used
      const matchEnd = match.startIndex + match.match.matched.length;
      let overlaps = false;
      
      for (let i = match.startIndex; i < matchEnd; i++) {
        if (usedIndices.has(i)) {
          overlaps = true;
          break;
        }
      }
      
      if (!overlaps) {
        selected.push(match);
        // Mark indices as used
        for (let i = match.startIndex; i < matchEnd; i++) {
          usedIndices.add(i);
        }
      }
    }
    
    // Sort by start index for application order
    return selected.sort((a, b) => a.startIndex - b.startIndex);
  }
  
  /**
   * Apply selected matches to instruction array
   * 
   * @param instructions - Original instructions
   * @param matches - Non-overlapping matches to apply
   * @returns New instruction array
   */
  applyMatches(
    instructions: ILInstruction[],
    matches: MatcherResult[]
  ): ILInstruction[] {
    if (matches.length === 0) return [...instructions];
    
    // Sort by start index descending (apply from end to preserve indices)
    const sorted = [...matches].sort((a, b) => b.startIndex - a.startIndex);
    
    const result = [...instructions];
    
    for (const match of sorted) {
      const deleteCount = match.match.matched.length;
      result.splice(
        match.startIndex,
        deleteCount,
        ...match.replacement.instructions
      );
      
      if (this.config.collectStats) {
        this.stats = {
          ...this.stats,
          matchesApplied: this.stats.matchesApplied + 1,
          cyclesSaved: this.stats.cyclesSaved + match.replacement.cyclesSaved,
          bytesSaved: this.stats.bytesSaved + match.replacement.bytesSaved,
        };
      }
    }
    
    return result;
  }
  
  /**
   * Run one iteration of pattern matching and application
   * 
   * @param instructions - Instructions to optimize
   * @param patterns - Optional subset of patterns to use
   * @returns Optimized instructions and whether changes were made
   */
  optimizeOnce(
    instructions: ILInstruction[],
    patterns?: PeepholePattern[]
  ): { instructions: ILInstruction[]; changed: boolean } {
    const matches = this.findMatches(instructions, patterns);
    const selected = this.selectBestMatches(matches);
    
    if (selected.length === 0) {
      return { instructions, changed: false };
    }
    
    const optimized = this.applyMatches(instructions, selected);
    return { instructions: optimized, changed: true };
  }
  
  /**
   * Run pattern matching until no more changes or max iterations
   * 
   * @param instructions - Instructions to optimize
   * @param patterns - Optional subset of patterns to use
   * @returns Fully optimized instructions
   */
  optimize(
    instructions: ILInstruction[],
    patterns?: PeepholePattern[]
  ): ILInstruction[] {
    let current = instructions;
    let iterations = 0;
    
    while (iterations < this.config.maxIterations) {
      const result = this.optimizeOnce(current, patterns);
      if (!result.changed) {
        break;
      }
      current = result.instructions;
      iterations++;
    }
    
    return current;
  }
  
  /**
   * Get current statistics
   */
  getStats(): MatcherStats {
    return this.stats;
  }
  
  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
  }
  
  /**
   * Create empty stats object
   */
  protected createEmptyStats(): MatcherStats {
    return {
      patternsChecked: 0,
      matchesFound: 0,
      matchesApplied: 0,
      cyclesSaved: 0,
      bytesSaved: 0,
      patternCounts: new Map(),
    };
  }
}
```

### File: `optimizer.ts`

```typescript
import { ILModule, ILFunction, BasicBlock } from '../../il/index.js';
import { PatternMatcher, MatcherStats, MatcherConfig } from './matcher.js';
import { PatternRegistry, patternRegistry } from './registry.js';
import { OptimizationLevel } from '../types.js';

/**
 * Result of peephole optimization
 */
export interface PeepholeResult {
  /** Optimized module */
  readonly module: ILModule;
  /** Combined statistics */
  readonly stats: MatcherStats;
  /** Per-function statistics */
  readonly functionStats: Map<string, MatcherStats>;
}

/**
 * Configuration for peephole optimizer
 */
export interface PeepholeConfig extends MatcherConfig {
  /** Optimization level */
  readonly level: OptimizationLevel;
  /** Whether to optimize only hot functions */
  readonly hotOnly: boolean;
}

/**
 * Default peephole configuration
 */
export const DEFAULT_PEEPHOLE_CONFIG: PeepholeConfig = {
  maxIterations: 100,
  collectStats: true,
  excludePatterns: new Set(),
  level: OptimizationLevel.O2,
  hotOnly: false,
};

/**
 * Peephole optimizer - applies patterns to entire module
 */
export class PeepholeOptimizer {
  protected readonly registry: PatternRegistry;
  protected readonly config: PeepholeConfig;
  
  constructor(
    registry: PatternRegistry = patternRegistry,
    config: Partial<PeepholeConfig> = {}
  ) {
    this.registry = registry;
    this.config = { ...DEFAULT_PEEPHOLE_CONFIG, ...config };
  }
  
  /**
   * Optimize an entire IL module
   * 
   * @param module - Module to optimize
   * @returns Optimized module and statistics
   */
  optimize(module: ILModule): PeepholeResult {
    const functionStats = new Map<string, MatcherStats>();
    let totalStats = this.createEmptyStats();
    
    // Get patterns for current optimization level
    const patterns = this.registry.getForLevel(this.config.level);
    
    // Optimize each function
    for (const func of module.functions.values()) {
      if (this.config.hotOnly && !this.isHotFunction(func)) {
        continue;
      }
      
      const matcher = new PatternMatcher(this.registry, this.config);
      
      // Optimize each basic block
      for (const block of func.blocks.values()) {
        const optimized = matcher.optimize(
          block.instructions,
          patterns
        );
        
        // Update block instructions
        block.instructions.length = 0;
        block.instructions.push(...optimized);
      }
      
      // Collect stats for this function
      const funcStats = matcher.getStats();
      functionStats.set(func.name, funcStats);
      
      // Aggregate total stats
      totalStats = this.mergeStats(totalStats, funcStats);
    }
    
    return {
      module,
      stats: totalStats,
      functionStats,
    };
  }
  
  /**
   * Optimize a single function
   * 
   * @param func - Function to optimize
   * @returns Statistics from optimization
   */
  optimizeFunction(func: ILFunction): MatcherStats {
    const patterns = this.registry.getForLevel(this.config.level);
    const matcher = new PatternMatcher(this.registry, this.config);
    
    for (const block of func.blocks.values()) {
      const optimized = matcher.optimize(block.instructions, patterns);
      block.instructions.length = 0;
      block.instructions.push(...optimized);
    }
    
    return matcher.getStats();
  }
  
  /**
   * Optimize a single basic block
   * 
   * @param block - Block to optimize
   * @returns Statistics from optimization
   */
  optimizeBlock(block: BasicBlock): MatcherStats {
    const patterns = this.registry.getForLevel(this.config.level);
    const matcher = new PatternMatcher(this.registry, this.config);
    
    const optimized = matcher.optimize(block.instructions, patterns);
    block.instructions.length = 0;
    block.instructions.push(...optimized);
    
    return matcher.getStats();
  }
  
  /**
   * Check if a function is considered "hot" (frequently executed)
   * 
   * @param func - Function to check
   * @returns True if function is hot
   */
  protected isHotFunction(func: ILFunction): boolean {
    // Check for hot annotation
    if (func.attributes?.has('hot')) {
      return true;
    }
    
    // Check for interrupt handlers (always hot)
    if (func.attributes?.has('interrupt')) {
      return true;
    }
    
    // Check execution count if available
    const execCount = func.metadata?.get('executionCount');
    if (typeof execCount === 'number' && execCount > 1000) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Merge two stats objects
   */
  protected mergeStats(a: MatcherStats, b: MatcherStats): MatcherStats {
    const mergedCounts = new Map(a.patternCounts);
    for (const [id, count] of b.patternCounts) {
      mergedCounts.set(id, (mergedCounts.get(id) || 0) + count);
    }
    
    return {
      patternsChecked: a.patternsChecked + b.patternsChecked,
      matchesFound: a.matchesFound + b.matchesFound,
      matchesApplied: a.matchesApplied + b.matchesApplied,
      cyclesSaved: a.cyclesSaved + b.cyclesSaved,
      bytesSaved: a.bytesSaved + b.bytesSaved,
      patternCounts: mergedCounts,
    };
  }
  
  /**
   * Create empty stats object
   */
  protected createEmptyStats(): MatcherStats {
    return {
      patternsChecked: 0,
      matchesFound: 0,
      matchesApplied: 0,
      cyclesSaved: 0,
      bytesSaved: 0,
      patternCounts: new Map(),
    };
  }
}
```

### Updated `index.ts` Exports

```typescript
// Types
export * from './types.js';

// Pattern framework (Task 8.1)
export * from './pattern.js';
export * from './registry.js';

// Pattern matcher (Task 8.2)
export * from './matcher.js';
export * from './optimizer.js';
```

---

## Tests Required

### Matcher Tests (`matcher.test.ts`)

| Test | Description |
|------|-------------|
| `findMatches empty` | No matches in empty instruction list |
| `findMatches no patterns` | No patterns to apply |
| `findMatches single match` | Find one pattern match |
| `findMatches multiple matches` | Find multiple pattern matches |
| `findMatches overlapping` | Find overlapping matches |
| `findMatches window size` | Respect pattern window size |
| `findMatches excluded` | Skip excluded patterns |
| `selectBestMatches empty` | Handle empty match list |
| `selectBestMatches single` | Select single match |
| `selectBestMatches non-overlapping` | Select all non-overlapping |
| `selectBestMatches overlapping` | Pick best from overlapping |
| `selectBestMatches benefit order` | Higher benefit wins |
| `applyMatches empty` | No changes with no matches |
| `applyMatches single` | Apply single replacement |
| `applyMatches multiple` | Apply multiple replacements |
| `applyMatches preserves order` | Maintains instruction order |
| `optimizeOnce no change` | Returns unchanged when no matches |
| `optimizeOnce with change` | Returns changed flag on match |
| `optimize iteration` | Iterates until stable |
| `optimize max iterations` | Respects max iteration limit |
| `stats tracking` | Correctly tracks statistics |
| `stats reset` | Reset clears statistics |
| `config options` | Respects configuration |

### Optimizer Tests (`optimizer.test.ts`)

| Test | Description |
|------|-------------|
| `optimize module` | Optimizes all functions |
| `optimize function stats` | Collects per-function stats |
| `optimize hot only` | Only optimizes hot functions |
| `optimize single function` | optimizeFunction works |
| `optimize single block` | optimizeBlock works |
| `isHotFunction hot attr` | Detects hot attribute |
| `isHotFunction interrupt` | Treats interrupts as hot |
| `isHotFunction exec count` | Checks execution count |
| `isHotFunction default` | Returns false for normal |
| `mergeStats` | Correctly merges statistics |
| `level filtering` | Uses patterns for opt level |
| `empty module` | Handles empty module |
| `empty function` | Handles empty function |
| `empty block` | Handles empty block |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `matcher.ts` | [ ] |
| Create `optimizer.ts` | [ ] |
| Update `index.ts` exports | [ ] |
| Write matcher unit tests | [ ] |
| Write optimizer unit tests | [ ] |
| 100% coverage | [ ] |

---

## Integration Notes

### Using the Matcher

```typescript
import { PatternMatcher, patternRegistry } from './peephole/index.js';

// Create matcher with custom config
const matcher = new PatternMatcher(patternRegistry, {
  maxIterations: 50,
  collectStats: true,
});

// Optimize instructions
const optimized = matcher.optimize(instructions);

// Check statistics
const stats = matcher.getStats();
console.log(`Cycles saved: ${stats.cyclesSaved}`);
```

### Using the Optimizer

```typescript
import { PeepholeOptimizer, OptimizationLevel } from './peephole/index.js';

// Create optimizer
const optimizer = new PeepholeOptimizer(patternRegistry, {
  level: OptimizationLevel.O3,
  hotOnly: true,
});

// Optimize entire module
const result = optimizer.optimize(module);

// Check results
console.log(`Total cycles saved: ${result.stats.cyclesSaved}`);
for (const [funcName, stats] of result.functionStats) {
  console.log(`  ${funcName}: ${stats.matchesApplied} matches`);
}
```

---

**Previous Task**: 8.1 → `08-01-pattern-framework.md`  
**Next Task**: 8.3 → `08-03-load-store-patterns.md`