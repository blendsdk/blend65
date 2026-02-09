# Phase 4: Pattern Framework

> **Document**: 01-pattern-framework.md  
> **Phase**: 4 - IL Peephole  
> **Focus**: Pattern base class, matching engine, pattern combinators  
> **Est. Lines**: ~350

---

## Overview

The **Pattern Framework** is the foundation for both IL-level and ASM-level peephole optimization. It provides a flexible, extensible system for defining optimization patterns that can recognize and transform instruction sequences.

**Key Design Goals:**
1. **Reusability** - Same framework for IL and ASM patterns
2. **Composability** - Patterns can be combined
3. **Safety** - Validation before and after transformation
4. **Testability** - Patterns easily unit tested in isolation

---

## Pattern Interface

### Base Pattern Definition

```typescript
/**
 * Result of a successful pattern match.
 * Contains all information needed to apply the transformation.
 */
export interface MatchResult<TInstruction> {
  /** Starting index of the matched sequence */
  readonly startIndex: number;
  
  /** Number of instructions matched (consumed) */
  readonly length: number;
  
  /** The matched instructions (for verification) */
  readonly matched: readonly TInstruction[];
  
  /** Captured values for use in replacement */
  readonly captures: Map<string, unknown>;
  
  /** Pattern name for debugging/metrics */
  readonly patternName: string;
}

/**
 * Base interface for all optimization patterns.
 * Generic over instruction type for IL/ASM reuse.
 */
export interface Pattern<TInstruction> {
  /** Unique pattern identifier */
  readonly name: string;
  
  /** Human-readable description */
  readonly description: string;
  
  /** Priority (higher = tried first) */
  readonly priority: number;
  
  /** Minimum instructions needed for match attempt */
  readonly minLength: number;
  
  /** Maximum instructions this pattern can match */
  readonly maxLength: number;
  
  /**
   * Attempt to match pattern at given index.
   * Returns null if no match, MatchResult if successful.
   */
  match(
    instructions: readonly TInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<TInstruction> | null;
  
  /**
   * Apply transformation, producing replacement instructions.
   * Called only after successful match.
   */
  apply(
    match: MatchResult<TInstruction>,
    context: PatternContext
  ): TInstruction[];
  
  /**
   * Optional validation after apply.
   * Returns error message if invalid, null if OK.
   */
  validate?(
    original: readonly TInstruction[],
    replacement: readonly TInstruction[]
  ): string | null;
}
```

### Pattern Context

```typescript
/**
 * Context provided to patterns during matching.
 * Contains analysis results and utilities.
 */
export interface PatternContext {
  /** Access to use-def chains (if available) */
  readonly useDef?: UseDefAnalysis;
  
  /** Access to liveness info (if available) */
  readonly liveness?: LivenessAnalysis;
  
  /** Current function being optimized */
  readonly function?: ILFunction;
  
  /** Current basic block */
  readonly block?: BasicBlock;
  
  /** Statistics collection */
  readonly stats: OptimizationStats;
  
  /** Debug mode flag */
  readonly debug: boolean;
}

/**
 * Statistics for tracking pattern effectiveness.
 */
export interface OptimizationStats {
  /** Pattern match attempts */
  matchAttempts: number;
  
  /** Successful matches */
  matchSuccesses: number;
  
  /** Transformations applied */
  transformsApplied: number;
  
  /** Instructions removed */
  instructionsRemoved: number;
  
  /** Instructions added */
  instructionsAdded: number;
  
  /** Per-pattern breakdown */
  byPattern: Map<string, PatternStats>;
}

interface PatternStats {
  attempts: number;
  matches: number;
  applied: number;
  savedInstructions: number;
}
```

---

## Abstract Pattern Base Class

### BasePattern Implementation

```typescript
/**
 * Abstract base class providing common pattern functionality.
 * Subclasses implement matchCore and applyCore.
 */
export abstract class BasePattern<TInstruction> implements Pattern<TInstruction> {
  abstract readonly name: string;
  abstract readonly description: string;
  
  readonly priority: number;
  readonly minLength: number;
  readonly maxLength: number;
  
  constructor(options: PatternOptions = {}) {
    this.priority = options.priority ?? 0;
    this.minLength = options.minLength ?? 1;
    this.maxLength = options.maxLength ?? this.minLength;
  }
  
  /**
   * Main match entry point with validation and stats.
   */
  match(
    instructions: readonly TInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<TInstruction> | null {
    // Update stats
    context.stats.matchAttempts++;
    const patternStats = this.getPatternStats(context);
    patternStats.attempts++;
    
    // Check bounds
    const remaining = instructions.length - index;
    if (remaining < this.minLength) {
      return null;
    }
    
    // Delegate to subclass
    const result = this.matchCore(instructions, index, context);
    
    if (result) {
      context.stats.matchSuccesses++;
      patternStats.matches++;
    }
    
    return result;
  }
  
  /**
   * Main apply entry point with validation.
   */
  apply(
    match: MatchResult<TInstruction>,
    context: PatternContext
  ): TInstruction[] {
    const result = this.applyCore(match, context);
    
    // Validate if method provided
    if (this.validate) {
      const error = this.validate(match.matched, result);
      if (error) {
        throw new Error(
          `Pattern ${this.name} produced invalid transformation: ${error}`
        );
      }
    }
    
    // Update stats
    const patternStats = this.getPatternStats(context);
    patternStats.applied++;
    
    const instructionsSaved = match.length - result.length;
    patternStats.savedInstructions += instructionsSaved;
    context.stats.instructionsRemoved += match.length;
    context.stats.instructionsAdded += result.length;
    context.stats.transformsApplied++;
    
    return result;
  }
  
  /**
   * Core matching logic - implemented by subclasses.
   */
  protected abstract matchCore(
    instructions: readonly TInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<TInstruction> | null;
  
  /**
   * Core transformation logic - implemented by subclasses.
   */
  protected abstract applyCore(
    match: MatchResult<TInstruction>,
    context: PatternContext
  ): TInstruction[];
  
  /**
   * Create a match result helper.
   */
  protected createMatch(
    instructions: readonly TInstruction[],
    startIndex: number,
    length: number,
    captures?: Map<string, unknown>
  ): MatchResult<TInstruction> {
    return {
      startIndex,
      length,
      matched: instructions.slice(startIndex, startIndex + length),
      captures: captures ?? new Map(),
      patternName: this.name
    };
  }
  
  /**
   * Get or create pattern stats entry.
   */
  protected getPatternStats(context: PatternContext): PatternStats {
    let stats = context.stats.byPattern.get(this.name);
    if (!stats) {
      stats = { attempts: 0, matches: 0, applied: 0, savedInstructions: 0 };
      context.stats.byPattern.set(this.name, stats);
    }
    return stats;
  }
}

interface PatternOptions {
  priority?: number;
  minLength?: number;
  maxLength?: number;
}
```

---

## Pattern Matching Engine

### PeepholeEngine Class

```typescript
/**
 * The pattern matching engine that applies patterns to instruction sequences.
 * Used by both IL and ASM peephole optimizers.
 */
export class PeepholeEngine<TInstruction> {
  protected readonly patterns: Pattern<TInstruction>[];
  protected readonly context: PatternContext;
  
  constructor(
    patterns: Pattern<TInstruction>[],
    context: PatternContext
  ) {
    // Sort by priority (highest first)
    this.patterns = [...patterns].sort((a, b) => b.priority - a.priority);
    this.context = context;
  }
  
  /**
   * Optimize an instruction sequence using registered patterns.
   * Applies patterns in a single pass (for this version).
   */
  optimize(instructions: TInstruction[]): TInstruction[] {
    const result: TInstruction[] = [];
    let index = 0;
    
    while (index < instructions.length) {
      const match = this.findMatch(instructions, index);
      
      if (match) {
        // Apply pattern transformation
        const replacement = match.pattern.apply(match.result, this.context);
        result.push(...replacement);
        index += match.result.length;
        
        if (this.context.debug) {
          this.logMatch(match);
        }
      } else {
        // No match - copy instruction unchanged
        result.push(instructions[index]);
        index++;
      }
    }
    
    return result;
  }
  
  /**
   * Optimize with fixed-point iteration.
   * Continues until no more patterns match.
   */
  optimizeFixedPoint(
    instructions: TInstruction[],
    maxIterations: number = 100
  ): TInstruction[] {
    let current = instructions;
    let iteration = 0;
    
    while (iteration < maxIterations) {
      const sizeBefore = current.length;
      current = this.optimize(current);
      const sizeAfter = current.length;
      
      // Stop if no changes
      if (sizeAfter === sizeBefore) {
        break;
      }
      
      iteration++;
    }
    
    if (iteration >= maxIterations) {
      console.warn(
        `PeepholeEngine: Hit max iterations (${maxIterations})`
      );
    }
    
    return current;
  }
  
  /**
   * Find first matching pattern at given index.
   */
  protected findMatch(
    instructions: TInstruction[],
    index: number
  ): { pattern: Pattern<TInstruction>; result: MatchResult<TInstruction> } | null {
    for (const pattern of this.patterns) {
      const result = pattern.match(instructions, index, this.context);
      if (result) {
        return { pattern, result };
      }
    }
    return null;
  }
  
  /**
   * Debug logging for pattern matches.
   */
  protected logMatch(match: { pattern: Pattern<TInstruction>; result: MatchResult<TInstruction> }): void {
    console.log(
      `[PeepholeEngine] Pattern "${match.pattern.name}" matched at index ${match.result.startIndex}, ` +
      `consumed ${match.result.length} instruction(s)`
    );
  }
}
```

---

## IL-Specific Pattern Types

### ILPattern Base Class

```typescript
import { ILInstruction, ILOpcode } from '../types.js';

/**
 * Base class for IL-level patterns.
 * Provides IL-specific matching utilities.
 */
export abstract class ILPattern extends BasePattern<ILInstruction> {
  /**
   * Check if instruction has specific opcode.
   */
  protected hasOpcode(inst: ILInstruction, opcode: ILOpcode): boolean {
    return inst.opcode === opcode;
  }
  
  /**
   * Check if instruction has any of the specified opcodes.
   */
  protected hasAnyOpcode(inst: ILInstruction, opcodes: ILOpcode[]): boolean {
    return opcodes.includes(inst.opcode);
  }
  
  /**
   * Get operand as immediate value if possible.
   */
  protected getImmediate(inst: ILInstruction, index: number): number | null {
    const operand = inst.operands[index];
    if (operand && operand.kind === 'immediate') {
      return operand.value;
    }
    return null;
  }
  
  /**
   * Get operand as virtual register if possible.
   */
  protected getVirtualReg(inst: ILInstruction, index: number): string | null {
    const operand = inst.operands[index];
    if (operand && operand.kind === 'virtual') {
      return operand.name;
    }
    return null;
  }
  
  /**
   * Check if operand is an immediate with specific value.
   */
  protected isImmediateValue(inst: ILInstruction, index: number, value: number): boolean {
    const imm = this.getImmediate(inst, index);
    return imm === value;
  }
  
  /**
   * Check if two operands refer to the same virtual register.
   */
  protected sameVirtualReg(
    inst1: ILInstruction,
    index1: number,
    inst2: ILInstruction,
    index2: number
  ): boolean {
    const reg1 = this.getVirtualReg(inst1, index1);
    const reg2 = this.getVirtualReg(inst2, index2);
    return reg1 !== null && reg1 === reg2;
  }
  
  /**
   * Create an IL instruction.
   */
  protected createInstruction(
    opcode: ILOpcode,
    operands: ILOperand[],
    result?: string
  ): ILInstruction {
    return {
      opcode,
      operands,
      result,
      location: null  // Synthetic instruction
    };
  }
  
  /**
   * Create a COPY instruction.
   */
  protected createCopy(dest: string, source: string): ILInstruction {
    return this.createInstruction(
      ILOpcode.COPY,
      [{ kind: 'virtual', name: source }],
      dest
    );
  }
  
  /**
   * Create a CONST instruction.
   */
  protected createConst(dest: string, value: number, type: ILType): ILInstruction {
    return this.createInstruction(
      ILOpcode.CONST,
      [{ kind: 'immediate', value, type }],
      dest
    );
  }
}
```

---

## Pattern Combinators

### Sequence Pattern

```typescript
/**
 * Matches a sequence of patterns in order.
 * All sub-patterns must match consecutively.
 */
export class SequencePattern<TInstruction> extends BasePattern<TInstruction> {
  readonly name: string;
  readonly description: string;
  
  protected readonly subPatterns: Pattern<TInstruction>[];
  protected readonly applyFn: (
    matches: MatchResult<TInstruction>[],
    context: PatternContext
  ) => TInstruction[];
  
  constructor(
    name: string,
    subPatterns: Pattern<TInstruction>[],
    applyFn: (matches: MatchResult<TInstruction>[], context: PatternContext) => TInstruction[],
    options?: PatternOptions & { description?: string }
  ) {
    const minLen = subPatterns.reduce((sum, p) => sum + p.minLength, 0);
    const maxLen = subPatterns.reduce((sum, p) => sum + p.maxLength, 0);
    
    super({ ...options, minLength: minLen, maxLength: maxLen });
    
    this.name = name;
    this.description = options?.description ?? `Sequence of ${subPatterns.length} patterns`;
    this.subPatterns = subPatterns;
    this.applyFn = applyFn;
  }
  
  protected matchCore(
    instructions: readonly TInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<TInstruction> | null {
    const matches: MatchResult<TInstruction>[] = [];
    let currentIndex = index;
    
    for (const subPattern of this.subPatterns) {
      const match = subPattern.match(instructions, currentIndex, context);
      if (!match) {
        return null;  // Sequence broken
      }
      matches.push(match);
      currentIndex += match.length;
    }
    
    // Combine all captures
    const allCaptures = new Map<string, unknown>();
    for (let i = 0; i < matches.length; i++) {
      for (const [key, value] of matches[i].captures) {
        allCaptures.set(`${i}.${key}`, value);
      }
    }
    
    return this.createMatch(
      instructions,
      index,
      currentIndex - index,
      allCaptures
    );
  }
  
  protected applyCore(
    match: MatchResult<TInstruction>,
    context: PatternContext
  ): TInstruction[] {
    // Reconstruct individual matches for applyFn
    const matches: MatchResult<TInstruction>[] = [];
    let offset = 0;
    
    for (const subPattern of this.subPatterns) {
      const subMatch: MatchResult<TInstruction> = {
        startIndex: match.startIndex + offset,
        length: subPattern.minLength,  // Approximation
        matched: match.matched.slice(offset, offset + subPattern.minLength),
        captures: this.extractSubCaptures(match.captures, matches.length),
        patternName: subPattern.name
      };
      matches.push(subMatch);
      offset += subPattern.minLength;
    }
    
    return this.applyFn(matches, context);
  }
  
  protected extractSubCaptures(
    allCaptures: Map<string, unknown>,
    index: number
  ): Map<string, unknown> {
    const result = new Map<string, unknown>();
    const prefix = `${index}.`;
    
    for (const [key, value] of allCaptures) {
      if (key.startsWith(prefix)) {
        result.set(key.slice(prefix.length), value);
      }
    }
    
    return result;
  }
}
```

### Predicate Pattern

```typescript
/**
 * Matches a single instruction that satisfies a predicate.
 */
export class PredicatePattern<TInstruction> extends BasePattern<TInstruction> {
  readonly name: string;
  readonly description: string;
  
  protected readonly predicate: (inst: TInstruction, context: PatternContext) => boolean;
  protected readonly captureKey?: string;
  
  constructor(
    name: string,
    predicate: (inst: TInstruction, context: PatternContext) => boolean,
    options?: PatternOptions & { description?: string; captureKey?: string }
  ) {
    super({ ...options, minLength: 1, maxLength: 1 });
    
    this.name = name;
    this.description = options?.description ?? `Predicate pattern: ${name}`;
    this.predicate = predicate;
    this.captureKey = options?.captureKey;
  }
  
  protected matchCore(
    instructions: readonly TInstruction[],
    index: number,
    context: PatternContext
  ): MatchResult<TInstruction> | null {
    const inst = instructions[index];
    
    if (!this.predicate(inst, context)) {
      return null;
    }
    
    const captures = new Map<string, unknown>();
    if (this.captureKey) {
      captures.set(this.captureKey, inst);
    }
    
    return this.createMatch(instructions, index, 1, captures);
  }
  
  protected applyCore(
    match: MatchResult<TInstruction>,
    _context: PatternContext
  ): TInstruction[] {
    // Default: return matched instruction unchanged
    return [...match.matched];
  }
}
```

---

## Testing Patterns

### Pattern Test Utilities

```typescript
/**
 * Utilities for testing patterns in isolation.
 */
export class PatternTestUtils {
  /**
   * Create a minimal pattern context for testing.
   */
  static createTestContext(options: Partial<PatternContext> = {}): PatternContext {
    return {
      debug: false,
      stats: this.createStats(),
      ...options
    };
  }
  
  /**
   * Create empty optimization stats.
   */
  static createStats(): OptimizationStats {
    return {
      matchAttempts: 0,
      matchSuccesses: 0,
      transformsApplied: 0,
      instructionsRemoved: 0,
      instructionsAdded: 0,
      byPattern: new Map()
    };
  }
  
  /**
   * Test that pattern matches at expected index.
   */
  static assertMatches<T>(
    pattern: Pattern<T>,
    instructions: T[],
    expectedIndex: number,
    expectedLength: number
  ): MatchResult<T> {
    const context = this.createTestContext();
    const result = pattern.match(instructions, expectedIndex, context);
    
    if (!result) {
      throw new Error(
        `Pattern ${pattern.name} did not match at index ${expectedIndex}`
      );
    }
    
    if (result.length !== expectedLength) {
      throw new Error(
        `Pattern ${pattern.name} matched ${result.length} instructions, expected ${expectedLength}`
      );
    }
    
    return result;
  }
  
  /**
   * Test that pattern does NOT match at index.
   */
  static assertNoMatch<T>(
    pattern: Pattern<T>,
    instructions: T[],
    index: number
  ): void {
    const context = this.createTestContext();
    const result = pattern.match(instructions, index, context);
    
    if (result) {
      throw new Error(
        `Pattern ${pattern.name} unexpectedly matched at index ${index}`
      );
    }
  }
  
  /**
   * Test full pattern application.
   */
  static assertTransforms<T>(
    pattern: Pattern<T>,
    input: T[],
    expected: T[],
    compareFn: (a: T, b: T) => boolean
  ): void {
    const context = this.createTestContext();
    const match = pattern.match(input, 0, context);
    
    if (!match) {
      throw new Error(`Pattern ${pattern.name} did not match input`);
    }
    
    const result = pattern.apply(match, context);
    
    if (result.length !== expected.length) {
      throw new Error(
        `Transform produced ${result.length} instructions, expected ${expected.length}`
      );
    }
    
    for (let i = 0; i < expected.length; i++) {
      if (!compareFn(result[i], expected[i])) {
        throw new Error(
          `Transform result[${i}] does not match expected[${i}]`
        );
      }
    }
  }
}
```

---

## Summary

The Pattern Framework provides:

1. **Pattern Interface** - Generic contract for all patterns
2. **BasePattern** - Abstract base with stats and validation
3. **PeepholeEngine** - Engine that applies patterns to instruction sequences
4. **ILPattern** - IL-specific utilities and helpers
5. **Combinators** - SequencePattern, PredicatePattern for composition
6. **Test Utilities** - Helpers for unit testing patterns

**Key Design Decisions:**
- Generic over instruction type for IL/ASM reuse
- Priority-based pattern ordering
- Optional fixed-point iteration
- Comprehensive statistics tracking
- Built-in validation support

---

**Next**: [02-pattern-registry.md](02-pattern-registry.md) - Pattern registration and management