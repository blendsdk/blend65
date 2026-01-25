# Optimizer MVP Execution Plan

> **Status**: Active Execution Plan
> **Created**: January 25, 2026
> **Last Updated**: January 25, 2026
> **Target**: -O1 through -O3 optimization levels
> **Estimated Sessions**: ~25 small sessions across 6 waves

---

## Executive Summary

This execution plan provides a **granular, session-based approach** to implementing the Blend65 optimizer. Each session is designed to fit within AI context window limitations.

### Key Principles

1. **Small Sessions**: 15-30 tests, 100-200 lines, 1-3 files per session
2. **Working Milestones**: Each wave produces measurably better code
3. **Two Peephole Levels**: IL-level AND ASM-IL-level optimization
4. **Full User Control**: All optimization levels (O0-O3, Os, Oz) with per-pass control

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BLEND65 OPTIMIZATION PIPELINE                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Blend Source → Lexer → Parser → AST → Semantic → IL Generator          │
│                                                                         │
│                           ↓                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    IL OPTIMIZER (Waves 1-4)                        │ │
│  │  ┌────────────────┐  ┌─────────────────┐  ┌────────────────┐       │ │
│  │  │ Analysis Passes│→ │ Transform Passes│→ │ IL Peephole    │       │ │
│  │  │ • Use-Def      │  │ • DCE           │  │ • Load/Store   │       │ │
│  │  │ • Liveness     │  │ • Const Fold    │  │ • Arithmetic   │       │ │
│  │  │ • (more later) │  │ • Const Prop    │  │ • (patterns)   │       │ │
│  │  └────────────────┘  └─────────────────┘  └────────────────┘       │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                           ↓                                             │
│                    Code Generator (dumb translator)                     │
│                           ↓                                             │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                ASM-IL OPTIMIZER (Wave 5)                           │ │
│  │  ┌────────────────────────────────────────────────────────────────┐│ │
│  │  │ ASM Peephole (6502-Specific)                                   ││ │
│  │  │ • Redundant CLC/SEC removal                                    ││ │
│  │  │ • Zero-flag optimization (LDA + CMP #0)                        ││ │
│  │  │ • Load-Store elimination                                       ││ │
│  │  │ • Branch patterns                                              ││ │
│  │  └────────────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                           ↓                                             │
│                    ACME Emitter → .asm file                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Optimization Levels

| Level  | Value | Description                    | Passes Enabled                      |
| ------ | ----- | ------------------------------ | ----------------------------------- |
| **O0** | 0     | No optimization (working code) | None (pass-through)                 |
| **O1** | 1     | Basic optimizations            | DCE, ConstFold, ConstProp, CopyProp |
| **O2** | 2     | Standard (release default)     | O1 + CSE + IL Peephole              |
| **O3** | 3     | Aggressive                     | O2 + LICM + Loop opts + Advanced    |
| **Os** | 10    | Size optimization              | O2 with size preference             |
| **Oz** | 11    | Minimum size                   | Aggressive size reduction           |

**User Control:**

- Per-level presets
- Individual pass enable/disable
- Verbose output for debugging
- Target-specific options (C64, C128, X16)

---

## Wave Overview

| Wave      | Focus                | Sessions | Milestone                 |
| --------- | -------------------- | -------- | ------------------------- |
| **0**     | Infrastructure & E2E | 3        | E2E test framework ready  |
| **1**     | IL Optimizer Core    | 4        | Pass manager working      |
| **2**     | Basic Analysis       | 3        | Analysis passes available |
| **3**     | O1 Transforms        | 5        | O1 produces better code   |
| **4**     | IL Peephole (O2)     | 5        | O2 = O1 + peephole        |
| **5**     | ASM-IL Peephole      | 5        | ASM output optimized      |
| **TOTAL** |                      | **~25**  | Full MVP                  |

---

## Wave 0: Infrastructure & E2E Setup

**Goal:** Create test infrastructure to validate optimization improvements

### Session 0.1: Create Execution Plan (Part 1) ✅

- **Status:** ✅ Complete
- **Deliverables:**
  - [x] Create this execution plan document (Part 1)
  - [x] Overview, architecture, Waves 0-2 detail
- **Tests:** 0 (planning only)
- **Files:** 1

### Session 0.2: Create Execution Plan (Part 2) ✅

- **Status:** ✅ Complete
- **Deliverables:**
  - [x] Complete Waves 3-5 detail in execution plan
  - [x] Create OPTIMIZER-UNIFIED-TEST-PLAN.md
- **Tests:** 0 (planning only)
- **Files:** 2

### Session 0.3: E2E Test Infrastructure

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `__tests__/e2e/` directory structure
  - [ ] Create first E2E fixtures (dead-code, const-fold)
  - [ ] Create `optimizer-metrics.test.ts` scaffold
- **Tests:** ~10-15 (E2E framework tests)
- **Files:** 5-7

**Wave 0 Success Criteria:**

- ✅ E2E test directory exists
- ✅ Fixtures directory with sample Blend code
- ✅ Metrics comparison framework ready

---

## Wave 1: IL Optimizer Core

**Goal:** Establish the pass manager infrastructure

**Dependencies:** None (foundational)

### Session 1.1: Pass Base Classes

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/pass.ts`
  - [ ] Define `Pass`, `AnalysisPass`, `TransformPass` base classes
  - [ ] Define `PassKind` enum
  - [ ] Add JSDoc documentation
- **Tests:** ~25 tests
- **Files:** 2 (pass.ts, pass.test.ts)

```typescript
// Expected structure
export enum PassKind { Analysis, Transform, Utility }
export abstract class Pass { ... }
export abstract class AnalysisPass<T> extends Pass { ... }
export abstract class TransformPass extends Pass { ... }
```

### Session 1.2: PassManager Core

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/pass-manager.ts`
  - [ ] Implement pass registration
  - [ ] Implement pass execution
  - [ ] Implement analysis caching
- **Tests:** ~30 tests
- **Files:** 2 (pass-manager.ts, pass-manager.test.ts)

```typescript
// Expected structure
export class PassManager {
  registerPass(pass: Pass): void;
  getAnalysis<T>(name: string, func: ILFunction): T;
  run(module: ILModule): OptimizationResult;
}
```

### Session 1.3: OptimizationOptions Enhancement

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Enhance `optimizer/options.ts`
  - [ ] Add per-pass enable/disable options
  - [ ] Add level-to-pass mapping
  - [ ] Add `getPassesForLevel()` function
- **Tests:** ~20 tests
- **Files:** 2 (options.ts update, options.test.ts update)

```typescript
// Expected additions
export interface OptimizationOptions {
  level: OptimizationLevel;
  enableDCE?: boolean;
  enableConstantFold?: boolean;
  // ... more per-pass options
}
export function getPassesForLevel(level: OptimizationLevel): string[];
```

### Session 1.4: Pipeline Builder & Integration

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/pipeline.ts`
  - [ ] Implement `PipelineBuilder` class
  - [ ] Create preset pipelines (O0, O1, O2, O3, Os, Oz)
  - [ ] Integrate with existing `Optimizer` class
- **Tests:** ~25 tests
- **Files:** 3 (pipeline.ts, integration tests)

**Wave 1 Success Criteria:**

- ✅ PassManager can register and execute passes
- ✅ Analysis results are cached and invalidated correctly
- ✅ Pipeline presets exist for all optimization levels
- ✅ All ~100 tests passing

---

## Wave 2: Basic Analysis Passes

**Goal:** Implement minimum analysis needed for O1 transforms

**Dependencies:** Wave 1 (Pass Manager)

### Session 2.1: Use-Def Analysis

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/analysis/use-def.ts`
  - [ ] Implement `UseDefAnalysis` class
  - [ ] Track definitions and uses for each value
  - [ ] Implement `getUseCount()`, `isUnused()`, `hasOneUse()`
- **Tests:** ~25 tests
- **Files:** 2

```typescript
export class UseDefAnalysis extends AnalysisPass<UseDefInfo> {
  readonly name = 'use-def';
  analyze(func: ILFunction): UseDefInfo;
}

export interface UseDefInfo {
  getDefinition(value: ILValue): ILInstruction | null;
  getUses(value: ILValue): ILInstruction[];
  getUseCount(value: ILValue): number;
  isUnused(value: ILValue): boolean;
}
```

### Session 2.2: Liveness Analysis

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/analysis/liveness.ts`
  - [ ] Implement backward dataflow analysis
  - [ ] Compute liveIn/liveOut for each block
  - [ ] Implement `isLiveAt()` query
- **Tests:** ~25 tests
- **Files:** 2

```typescript
export class LivenessAnalysis extends AnalysisPass<LivenessInfo> {
  readonly name = 'liveness';
  analyze(func: ILFunction): LivenessInfo;
}

export interface LivenessInfo {
  getBlockLiveness(block: BasicBlock): BlockLiveness;
  isLiveAt(reg: VirtualRegister, instruction: ILInstruction): boolean;
}
```

### Session 2.3: Analysis Infrastructure & Integration

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/analysis/index.ts`
  - [ ] Create analysis directory structure
  - [ ] Register analyses with PassManager
  - [ ] Write integration tests
- **Tests:** ~20 tests
- **Files:** 3-4

**Wave 2 Success Criteria:**

- ✅ Use-Def analysis tracks all definitions and uses
- ✅ Liveness analysis computes correct live sets
- ✅ Analyses integrate with PassManager
- ✅ All ~70 tests passing (cumulative ~170)

---

## Wave 3: O1 Transform Passes

**Goal:** Implement basic transforms for -O1 level

**Dependencies:** Wave 2 (Analysis Passes)

### Session 3.1: Dead Code Elimination (DCE)

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/transforms/dce.ts`
  - [ ] Implement `DCEPass` class that extends `TransformPass`
  - [ ] Track side-effect instructions (stores, calls, volatile)
  - [ ] Iterate until fixed point (no more changes)
- **Tests:** ~25 tests
- **Files:** 2 (dce.ts, dce.test.ts)

```typescript
// Expected structure
export class DCEPass extends TransformPass {
  readonly name = 'dce';
  readonly requires = ['use-def'];
  readonly invalidates = ['liveness'];
  readonly levels = [O1, O2, O3, Os, Oz];

  transform(func: ILFunction): boolean {
    // Remove unused instructions (except side-effect)
  }

  protected isDeadInstruction(inst: ILInstruction, useDef: UseDefInfo): boolean;
  protected hasSideEffects(inst: ILInstruction): boolean;
}
```

**Test Cases:**

- Unused arithmetic removed
- Unused load removed
- Store preserved (side effect)
- Call preserved (side effect)
- Volatile read preserved
- Chained dead code removal
- Phi node handling

### Session 3.2: Constant Folding

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/transforms/constant-fold.ts`
  - [ ] Implement `ConstantFoldPass` class
  - [ ] Handle 6502 overflow semantics (byte: & 0xFF, word: & 0xFFFF)
  - [ ] Support arithmetic, bitwise, and comparison ops
- **Tests:** ~30 tests
- **Files:** 2 (constant-fold.ts, constant-fold.test.ts)

```typescript
// Expected structure
export class ConstantFoldPass extends TransformPass {
  readonly name = 'constant-fold';
  readonly requires = [];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];

  transform(func: ILFunction): boolean;
  protected tryFold(inst: ILInstruction): number | null;
  protected foldAdd(a: number, b: number, type: ILType): number;
  protected foldSub(a: number, b: number, type: ILType): number;
  // ... more fold methods
}
```

**Test Cases:**

- `1 + 2` → `3`
- `10 - 3` → `7`
- `5 * 4` → `20`
- `255 + 1` → `0` (byte overflow)
- `$FFFF + 1` → `0` (word overflow)
- Bitwise AND/OR/XOR/NOT
- Shift left/right
- Comparison folding (`1 < 2` → `true`)

### Session 3.3: Constant Propagation

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/transforms/constant-prop.ts`
  - [ ] Implement `ConstantPropPass` class
  - [ ] Find all constant definitions
  - [ ] Replace uses with constant values
- **Tests:** ~25 tests
- **Files:** 2 (constant-prop.ts, constant-prop.test.ts)

```typescript
// Expected structure
export class ConstantPropPass extends TransformPass {
  readonly name = 'constant-prop';
  readonly requires = ['use-def'];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];

  transform(func: ILFunction): boolean {
    // 1. Find all constant definitions
    // 2. Replace uses with constants
  }
}
```

**Test Cases:**

- `let x = 5; y = x + 1` → `y = 5 + 1`
- Constant through multiple blocks
- No propagation of non-constants
- Phi node handling
- Loop-carried constants

### Session 3.4: Copy Propagation

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/transforms/copy-prop.ts`
  - [ ] Implement `CopyPropPass` class
  - [ ] Track copy chains (a=b, b=c → a=c)
  - [ ] Replace uses with original values
- **Tests:** ~20 tests
- **Files:** 2 (copy-prop.ts, copy-prop.test.ts)

```typescript
// Expected structure
export class CopyPropPass extends TransformPass {
  readonly name = 'copy-prop';
  readonly requires = ['use-def'];
  readonly invalidates = ['use-def'];
  readonly levels = [O1, O2, O3, Os, Oz];

  transform(func: ILFunction): boolean {
    // 1. Find all copy instructions (x = y)
    // 2. Replace uses of x with y
  }
}
```

**Test Cases:**

- Simple copy: `x = y; use(x)` → `use(y)`
- Copy chain: `a = b; b = c` → `a = c`
- Cross-block propagation
- No propagation of modified values

### Session 3.5: O1 Pipeline Integration + E2E Validation

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/transforms/index.ts` exports
  - [ ] Register all O1 passes with PassManager
  - [ ] Update `getPassesForLevel(O1)` to return [DCE, ConstFold, ConstProp, CopyProp]
  - [ ] Create E2E fixtures for O1 validation
  - [ ] Write E2E tests proving O1 produces smaller code
- **Tests:** ~25 tests (10 unit + 15 E2E)
- **Files:** 4-5 (transforms/index.ts, pipeline updates, E2E fixtures)

**E2E Validation:**

```typescript
// Test that O1 improves code
it('should reduce instruction count with O1', () => {
  const o0Result = compile(fixture, { level: O0 });
  const o1Result = compile(fixture, { level: O1 });
  expect(o1Result.instructionCount).toBeLessThan(o0Result.instructionCount);
});
```

**Wave 3 Success Criteria:**

- ✅ All ~125 tests passing
- ✅ DCE removes unused code
- ✅ Constants fold and propagate correctly
- ✅ Copies are eliminated
- ✅ O1 measurably reduces instruction count
- ✅ No semantic changes to programs

---

## Wave 4: IL Peephole (O2)

**Goal:** Implement IL-level peephole patterns for -O2

**Dependencies:** Wave 3 (O1 Transforms)

### Session 4.1: Pattern Framework

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/peephole/types.ts`
  - [ ] Create `optimizer/peephole/pattern.ts`
  - [ ] Define `PeepholePattern` interface
  - [ ] Define `BasePattern` abstract class
  - [ ] Define pattern categories (LoadStore, Arithmetic, Branch, etc.)
- **Tests:** ~25 tests
- **Files:** 3 (types.ts, pattern.ts, pattern.test.ts)

```typescript
// Expected structure
export interface PatternMatch {
  readonly matched: ILInstruction[];
  readonly captures: Map<string, ILValue>;
  readonly confidence: number;
}

export interface PeepholePattern {
  readonly id: string;
  readonly description: string;
  readonly category: PatternCategory;
  readonly levels: OptimizationLevel[];
  readonly windowSize: number;

  match(instructions: ILInstruction[]): PatternMatch | null;
  replace(match: PatternMatch): PatternReplacement;
}

export abstract class BasePattern implements PeepholePattern { ... }
```

### Session 4.2: Pattern Registry & Matcher

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/peephole/registry.ts`
  - [ ] Create `optimizer/peephole/matcher.ts`
  - [ ] Implement `PatternRegistry` class
  - [ ] Implement pattern matching engine (sliding window)
  - [ ] Support pattern filtering by level
- **Tests:** ~25 tests
- **Files:** 3 (registry.ts, matcher.ts, tests)

```typescript
// Expected structure
export class PatternRegistry {
  register(pattern: PeepholePattern): void;
  get(id: string): PeepholePattern | undefined;
  getByCategory(category: PatternCategory): PeepholePattern[];
  getForLevel(level: OptimizationLevel): PeepholePattern[];
}

export class PatternMatcher {
  findMatches(block: BasicBlock, patterns: PeepholePattern[]): PatternMatch[];
  applyMatch(block: BasicBlock, match: PatternMatch): void;
}
```

### Session 4.3: Load/Store Peephole Patterns

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/peephole/patterns/load-store.ts`
  - [ ] Implement `StoreLoadElimination` pattern (store x; load x → store x)
  - [ ] Implement `LoadLoadElimination` pattern (load x; load x → load x)
  - [ ] Implement `DeadStoreElimination` pattern (store x; store x → store x)
- **Tests:** ~25 tests
- **Files:** 2 (load-store.ts, load-store.test.ts)

```typescript
// Example pattern
export class StoreLoadElimination extends BasePattern {
  readonly id = 'store-load-elimination';
  readonly windowSize = 2;

  match(instructions: ILInstruction[]): PatternMatch | null {
    const [first, second] = instructions;
    if (!first.isStore() || !second.isLoad()) return null;
    if (first.getAddress() !== second.getAddress()) return null;
    // Match: STORE addr; LOAD addr → STORE addr (reuse stored value)
    return { matched: [first, second], captures: new Map(), confidence: 1 };
  }

  replace(match: PatternMatch): PatternReplacement {
    // Remove redundant load
    return { instructions: [match.matched[0]], cyclesSaved: 4, bytesSaved: 2 };
  }
}
```

### Session 4.4: Arithmetic Peephole Patterns

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/peephole/patterns/arithmetic.ts`
  - [ ] Implement identity patterns (`x + 0 → x`, `x * 1 → x`)
  - [ ] Implement strength reduction (`x * 2 → x << 1`, `x * 4 → x << 2`)
  - [ ] Implement algebraic simplification (`x - x → 0`, `x | x → x`)
- **Tests:** ~25 tests
- **Files:** 2 (arithmetic.ts, arithmetic.test.ts)

```typescript
// Example patterns
export class AddZeroElimination extends BasePattern {
  // x + 0 → x
}

export class MultiplyByPowerOfTwo extends BasePattern {
  // x * 2 → x << 1 (strength reduction)
}

export class SubtractSelfElimination extends BasePattern {
  // x - x → 0
}
```

### Session 4.5: O2 Pipeline Integration + E2E Validation

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `optimizer/peephole/index.ts` exports
  - [ ] Create `PeepholePass` that integrates with PassManager
  - [ ] Register all IL peephole patterns
  - [ ] Update `getPassesForLevel(O2)` to include peephole pass
  - [ ] Create E2E fixtures for O2 validation
  - [ ] Write E2E tests proving O2 > O1
- **Tests:** ~25 tests (10 unit + 15 E2E)
- **Files:** 4-5

**E2E Validation:**

```typescript
it('should reduce instruction count with O2 vs O1', () => {
  const o1Result = compile(fixture, { level: O1 });
  const o2Result = compile(fixture, { level: O2 });
  expect(o2Result.instructionCount).toBeLessThanOrEqual(o1Result.instructionCount);
});

it('should apply strength reduction', () => {
  const result = compile('let x = y * 4;', { level: O2 });
  expect(result.asm).toContain('ASL'); // Shift instead of multiply
});
```

**Wave 4 Success Criteria:**

- ✅ All ~125 tests passing
- ✅ Pattern framework is extensible
- ✅ Load/Store patterns eliminate redundancy
- ✅ Arithmetic patterns apply strength reduction
- ✅ O2 measurably improves on O1
- ✅ No semantic changes to programs

---

## Wave 5: ASM-IL Peephole

**Goal:** Implement ASM-level peephole patterns (6502-specific)

**Dependencies:** Wave 4 (IL Peephole)

**Note:** The ASM-IL optimizer infrastructure (pass-through mode) already exists in `packages/compiler/src/asm-il/optimizer/`. This wave adds actual optimization passes.

### Session 5.1: Redundant Flag Patterns

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `asm-il/optimizer/passes/redundant-clc.ts`
  - [ ] Create `asm-il/optimizer/passes/redundant-sec.ts`
  - [ ] Implement CLC removal after ADC (carry always cleared by addition)
  - [ ] Implement SEC removal before SBC when carry already set
  - [ ] Track flag state across instructions
- **Tests:** ~25 tests
- **Files:** 3 (redundant-clc.ts, redundant-sec.ts, tests)

```typescript
// Example patterns
/**
 * CLC is redundant if:
 * - Previous instruction was ADC (always clears/sets carry)
 * - Or previous CLC with no intervening carry-affecting instruction
 */
export class RedundantCLCPass implements AsmOptimizationPass {
  readonly name = 'redundant-clc';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // Track carry flag state, remove redundant CLC
  }
}
```

**Test Cases:**

- `ADC #$10; CLC; ADC #$20` → `ADC #$10; ADC #$20` (remove CLC)
- `CLC; CLC; ADC` → `CLC; ADC` (remove duplicate)
- `CLC; BCC label; CLC` → preserve (control flow changes state)

### Session 5.2: Zero-Flag Optimization

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `asm-il/optimizer/passes/zero-flag.ts`
  - [ ] Remove `CMP #0` after LDA (LDA already sets zero flag)
  - [ ] Remove redundant comparisons after AND/ORA/EOR
  - [ ] Detect flag-setting patterns
- **Tests:** ~25 tests
- **Files:** 2 (zero-flag.ts, zero-flag.test.ts)

```typescript
/**
 * Remove CMP #0 after load/arithmetic that already sets Z flag.
 *
 * Pattern: LDA addr; CMP #0; BEQ label
 * Optimized: LDA addr; BEQ label
 */
export class ZeroFlagOptimizationPass implements AsmOptimizationPass {
  readonly name = 'zero-flag';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // Find CMP #0 after flag-setting instruction, remove it
  }
}
```

**Test Cases:**

- `LDA $1000; CMP #0; BEQ label` → `LDA $1000; BEQ label`
- `AND #$0F; CMP #0; BNE label` → `AND #$0F; BNE label`
- `LDA #$10; CMP #$20; BEQ` → preserve (non-zero comparison)

### Session 5.3: Load-Store Elimination

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `asm-il/optimizer/passes/load-store.ts`
  - [ ] Remove redundant `STA addr; LDA addr` sequences
  - [ ] Remove redundant `LDX; TXA` when A already has value
  - [ ] Track register contents across instructions
- **Tests:** ~25 tests
- **Files:** 2 (load-store.ts, load-store.test.ts)

```typescript
/**
 * Remove redundant load after store to same address.
 *
 * Pattern: STA $1000; LDA $1000
 * Optimized: STA $1000 (A already contains value)
 */
export class LoadStoreEliminationPass implements AsmOptimizationPass {
  readonly name = 'load-store';
  readonly isTransform = true;

  run(module: AsmModule): AsmModule {
    // Track what's in A/X/Y, eliminate redundant loads
  }
}
```

**Test Cases:**

- `STA $1000; LDA $1000` → `STA $1000`
- `LDA #$10; STA $1000; LDA #$10` → `LDA #$10; STA $1000`
- `STA $1000; INX; LDA $1000` → preserve (can't assume non-interference)

### Session 5.4: Branch & Transfer Patterns

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `asm-il/optimizer/passes/branch.ts`
  - [ ] Create `asm-il/optimizer/passes/transfer.ts`
  - [ ] Collapse `JMP -> JMP` chains
  - [ ] Remove unreachable code after unconditional JMP
  - [ ] Optimize transfer sequences (`TAX; TXA` → remove both)
- **Tests:** ~25 tests
- **Files:** 3 (branch.ts, transfer.ts, tests)

```typescript
/**
 * Collapse branch chains.
 * Pattern: JMP label1; ... label1: JMP label2
 * Optimized: JMP label2
 */
export class BranchChainCollapsePass implements AsmOptimizationPass { ... }

/**
 * Remove redundant transfers.
 * Pattern: TAX; TXA
 * Optimized: (remove both, values unchanged)
 */
export class TransferOptimizationPass implements AsmOptimizationPass { ... }
```

**Test Cases:**

- `JMP L1; ... L1: JMP L2` → `JMP L2`
- `TAX; TXA` → (empty)
- `TXA; TAX` → (empty, if X preserved)
- Dead code after `JMP` removed

### Session 5.5: ASM-IL Integration + E2E Validation

- **Status:** ⬜ Not started
- **Deliverables:**
  - [ ] Create `asm-il/optimizer/passes/index.ts` exports
  - [ ] Register all ASM-IL passes with AsmOptimizer
  - [ ] Create optimization level presets for ASM-IL
  - [ ] Enable ASM-IL optimizer in full compilation pipeline
  - [ ] Create E2E tests comparing full O2 with ASM peephole
- **Tests:** ~25 tests (10 unit + 15 E2E)
- **Files:** 4-5

**E2E Validation:**

```typescript
it('should reduce ASM output size with peephole', () => {
  const withoutPeephole = compile(fixture, { level: O2, asmPeephole: false });
  const withPeephole = compile(fixture, { level: O2, asmPeephole: true });
  expect(withPeephole.asmLines).toBeLessThanOrEqual(withoutPeephole.asmLines);
});

it('should remove redundant CLC/SEC', () => {
  const result = compile(fixture, { level: O2, asmPeephole: true });
  // Count CLC instructions, should be minimal
  const clcCount = (result.asm.match(/CLC/g) || []).length;
  expect(clcCount).toBeLessThan(expectedMaxCLC);
});
```

**Wave 5 Success Criteria:**

- ✅ All ~125 tests passing
- ✅ Redundant flag operations removed
- ✅ Zero-flag optimization works
- ✅ Load-Store elimination applied
- ✅ Branch chains collapsed
- ✅ Full pipeline produces optimized 6502 ASM
- ✅ No semantic changes to programs

---

## E2E Testing Strategy

### Test Directory Structure

```
packages/compiler/src/__tests__/e2e/
├── fixtures/                    # Blend source files for testing
│   ├── dead-code/              # DCE test cases
│   │   ├── unused-function.blend
│   │   ├── unused-variable.blend
│   │   └── unreachable-code.blend
│   ├── const-fold/             # Constant folding cases
│   │   ├── arithmetic.blend
│   │   ├── comparison.blend
│   │   └── overflow.blend
│   ├── const-prop/             # Constant propagation cases
│   ├── copy-prop/              # Copy propagation cases
│   └── peephole/               # Peephole pattern cases
├── optimizer-metrics.test.ts   # Instruction count comparison
├── semantic-correctness.test.ts # Verify same behavior
└── pattern-verification.test.ts # Verify patterns applied
```

### E2E Test Types

| Type            | What It Measures       | Example Assertion                                            |
| --------------- | ---------------------- | ------------------------------------------------------------ |
| **Metrics**     | Code size/efficiency   | `O1.instructionCount < O0.instructionCount`                  |
| **Correctness** | Same behavior          | `O1.output === O0.output`                                    |
| **Patterns**    | Specific optimizations | `O1.asm.contains('ASL') && !O1.asm.contains('JSR multiply')` |

---

## Session Checklist Template

Each session should follow this pattern:

```markdown
## Session X.Y: [Name]

**Pre-Session:**

1. [ ] Run `clear && scripts/agent.sh start`
2. [ ] Review previous session's work (if applicable)
3. [ ] Check tests pass: `clear && yarn clean && yarn build && yarn test`

**Implementation:** 4. [ ] Create/modify files as specified 5. [ ] Write unit tests (15-30 tests) 6. [ ] Run tests: `clear && yarn test` 7. [ ] Fix any failures

**Post-Session:** 8. [ ] Run full build: `clear && yarn clean && yarn build && yarn test` 9. [ ] Run `clear && scripts/agent.sh finished` 10. [ ] Call `attempt_completion` 11. [ ] User runs `/compact`
```

---

## Cross-References

- **Detailed Plans:** `plans/optimizer/01-architecture.md` through `plans/optimizer/11-testing.md`
- **Code Standards:** `.clinerules/code.md`
- **Session Rules:** `.clinerules/agents.md` (multi-session rules)
- **ASM-IL Optimizer:** `plans/end-to-end/03c-asm-il-optimizer.md`

---

## Revision History

| Date       | Change                       | By             |
| ---------- | ---------------------------- | -------------- |
| 2026-01-25 | Created Part 1 (Waves 0-2)   | AI Session 0.1 |
| 2026-01-25 | Completed Part 2 (Waves 3-5) | AI Session 0.2 |
