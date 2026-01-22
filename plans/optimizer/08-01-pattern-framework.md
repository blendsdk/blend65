# Task 8.1: Peephole Pattern Framework

> **Task**: 8.1 of 12 (Peephole Phase)  
> **Time**: ~2 hours  
> **Tests**: ~50 tests  
> **Prerequisites**: Phase 7 (6502-Specific)

---

## Overview

Create the foundational peephole optimization framework. This task establishes:
- Pattern definition interfaces
- Pattern registration system
- Base classes for pattern types

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/
├── index.ts           # Exports
├── pattern.ts         # Pattern interfaces (THIS TASK)
├── registry.ts        # Pattern registry (THIS TASK)
└── types.ts           # Pattern types (THIS TASK)
```

---

## Implementation

### File: `types.ts`

```typescript
/**
 * Pattern match result
 */
export interface PatternMatch {
  /** Instructions matched */
  readonly matched: ILInstruction[];
  /** Captured values for replacement */
  readonly captures: Map<string, ILValue>;
  /** Match confidence (0-1) */
  readonly confidence: number;
}

/**
 * Pattern replacement result
 */
export interface PatternReplacement {
  /** New instructions */
  readonly instructions: ILInstruction[];
  /** Cycles saved (negative = slower) */
  readonly cyclesSaved: number;
  /** Bytes saved (negative = larger) */
  readonly bytesSaved: number;
}

/**
 * Pattern categories
 */
export enum PatternCategory {
  LoadStore = 'load-store',
  Arithmetic = 'arithmetic',
  Branch = 'branch',
  Transfer = 'transfer',
  Flag = 'flag',
  General = 'general',
}
```

### File: `pattern.ts`

```typescript
import { PatternMatch, PatternReplacement, PatternCategory } from './types.js';

/**
 * Base interface for all peephole patterns
 */
export interface PeepholePattern {
  /** Unique pattern identifier */
  readonly id: string;
  /** Human-readable description */
  readonly description: string;
  /** Pattern category */
  readonly category: PatternCategory;
  /** Optimization levels where enabled */
  readonly levels: OptimizationLevel[];
  /** Number of instructions this pattern examines */
  readonly windowSize: number;
  
  /**
   * Attempt to match this pattern
   * @param instructions - Window of instructions to examine
   * @returns Match result or null if no match
   */
  match(instructions: ILInstruction[]): PatternMatch | null;
  
  /**
   * Generate replacement instructions
   * @param match - The match result from match()
   * @returns Replacement instructions
   */
  replace(match: PatternMatch): PatternReplacement;
}

/**
 * Abstract base class for patterns
 */
export abstract class BasePattern implements PeepholePattern {
  abstract readonly id: string;
  abstract readonly description: string;
  abstract readonly category: PatternCategory;
  abstract readonly levels: OptimizationLevel[];
  abstract readonly windowSize: number;
  
  abstract match(instructions: ILInstruction[]): PatternMatch | null;
  abstract replace(match: PatternMatch): PatternReplacement;
  
  /** Helper: Check if instruction is a load */
  protected isLoad(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Load;
  }
  
  /** Helper: Check if instruction is a store */
  protected isStore(inst: ILInstruction): boolean {
    return inst.opcode === ILOpcode.Store;
  }
  
  /** Helper: Create a capture map */
  protected capture(entries: [string, ILValue][]): Map<string, ILValue> {
    return new Map(entries);
  }
}
```

### File: `registry.ts`

```typescript
import { PeepholePattern, PatternCategory } from './types.js';

/**
 * Central registry for all peephole patterns
 */
export class PatternRegistry {
  /** All registered patterns */
  protected patterns: Map<string, PeepholePattern> = new Map();
  
  /** Patterns by category */
  protected byCategory: Map<PatternCategory, PeepholePattern[]> = new Map();
  
  /**
   * Register a new pattern
   */
  register(pattern: PeepholePattern): void {
    if (this.patterns.has(pattern.id)) {
      throw new Error(`Pattern ${pattern.id} already registered`);
    }
    
    this.patterns.set(pattern.id, pattern);
    
    // Add to category index
    const categoryPatterns = this.byCategory.get(pattern.category) || [];
    categoryPatterns.push(pattern);
    this.byCategory.set(pattern.category, categoryPatterns);
  }
  
  /**
   * Get pattern by ID
   */
  get(id: string): PeepholePattern | undefined {
    return this.patterns.get(id);
  }
  
  /**
   * Get all patterns for a category
   */
  getByCategory(category: PatternCategory): PeepholePattern[] {
    return this.byCategory.get(category) || [];
  }
  
  /**
   * Get all patterns enabled for optimization level
   */
  getForLevel(level: OptimizationLevel): PeepholePattern[] {
    return [...this.patterns.values()]
      .filter(p => p.levels.includes(level));
  }
  
  /**
   * Get pattern count
   */
  get size(): number {
    return this.patterns.size;
  }
}

/** Global pattern registry instance */
export const patternRegistry = new PatternRegistry();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| Pattern interface | Verify interface contract |
| BasePattern helpers | Test isLoad, isStore, capture |
| Registry register | Add patterns to registry |
| Registry get | Retrieve by ID |
| Registry category | Filter by category |
| Registry level | Filter by opt level |
| Duplicate rejection | Reject duplicate pattern IDs |
| Empty registry | Handle empty state |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `types.ts` | [ ] |
| Create `pattern.ts` | [ ] |
| Create `registry.ts` | [ ] |
| Create `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.2 → `08-02-pattern-matcher.md`