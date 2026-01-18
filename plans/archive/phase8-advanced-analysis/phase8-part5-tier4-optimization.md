# Phase 8 Implementation Plan - Part 5: Tier 4 - Call/Instruction & Cross-Module

> **Navigation**: [Part 4](phase8-part4-tier4-hardware.md) ← [Part 5] → [Part 6: Summary & Checklist](phase8-part6-summary.md)
>
> **Focus**: Weeks 5-6 - Advanced Optimization & Whole-Program Analysis
> **Tasks**: 8.24-8.25, 8.27-8.32 (8 tasks, 45 hours, 140+ tests)
> **Prerequisites**: Part 4 complete (Tier 4 Hardware & Modern Compiler with expansions) ✅

---

## Tier 4 Categories C & D Overview

**Category C: Advanced Call & Instruction Optimization**
- JSR/RTS overhead analysis → Inline small functions
- Tail call optimization → JMP instead of JSR/RTS
- Strength reduction → Replace expensive ops with cheap ones
- Load/store coalescing → Eliminate redundant memory access
- Instruction scheduling → Optimal instruction order

**Category D: Cross-Module God-Level Analysis**
- Whole-program call graph → Cross-module optimization
- Global constant propagation → Constants across modules
- Final integration → All 33 tasks working together

---

## Category C: Advanced Call & Instruction Optimization

### Task 8.24: JSR/RTS Overhead Analysis (5 hours)

**File**: `packages/compiler/src/semantic/analysis/jsr-overhead.ts`

**Goal**: Calculate call overhead vs function body cost, recommend inlining

**Why Critical**: 6502 JSR/RTS is expensive:
- JSR: 6 cycles
- RTS: 6 cycles
- Total: 12 cycles minimum

For a function with 10 cycles of body, overhead is 54%! Inlining saves cycles.

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.CallOverhead;       // number - JSR/RTS cycles (12+)
OptimizationMetadataKey.BodyCycles;         // number - function body cycles
OptimizationMetadataKey.InlineThreshold;    // boolean - worth inlining
OptimizationMetadataKey.LeafFunction;       // boolean - calls no other functions
```

**Implementation**:

```typescript
/**
 * JSR/RTS overhead analyzer
 *
 * Determines if inlining is worthwhile by comparing
 * call overhead to function body cost.
 */
export class JSROverheadAnalyzer {
  private readonly JSR_CYCLES = 6;
  private readonly RTS_CYCLES = 6;
  private readonly INLINE_THRESHOLD = 20; // Inline if body < 20 cycles

  analyze(): void {
    for (const func of this.getAllFunctions()) {
      const bodyCycles = this.estimateBodyCycles(func);
      const callOverhead = this.JSR_CYCLES + this.RTS_CYCLES;
      const isLeaf = this.isLeafFunction(func);
      
      func.metadata = func.metadata || new Map();
      func.metadata.set(OptimizationMetadataKey.CallOverhead, callOverhead);
      func.metadata.set(OptimizationMetadataKey.BodyCycles, bodyCycles);
      func.metadata.set(OptimizationMetadataKey.LeafFunction, isLeaf);
      
      // Inline if:
      // 1. Body is small (< threshold)
      // 2. Is a leaf function (no nested calls)
      // 3. Overhead > body cost
      const shouldInline = 
        bodyCycles < this.INLINE_THRESHOLD &&
        isLeaf &&
        callOverhead >= bodyCycles * 0.5;
      
      func.metadata.set(
        OptimizationMetadataKey.InlineThreshold,
        shouldInline
      );
    }
  }
}
```

**Tests** (12+): Small leaf functions (inline), large functions (no inline), recursive functions, overhead calculation, inline benefit calculation, call site analysis

---

### Task 8.25: Tail Call Optimization (5 hours)

**File**: `packages/compiler/src/semantic/analysis/tail-calls.ts`

**Goal**: Detect tail calls that can become JMP instead of JSR/RTS

**Why Critical**: Tail call optimization saves 9 cycles:
- Without: JSR (6) + RTS (6) = 12 cycles
- With: JMP (3) = 3 cycles
- Savings: 9 cycles (75% reduction!)

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.TailCallCandidate;  // boolean - is tail call
OptimizationMetadataKey.TailCallSavings;    // number - cycles saved
```

**Implementation**: Detect functions where last statement is return of function call

**Tests** (12+): Direct tail calls, conditional tail calls, non-tail calls, mutual recursion, savings calculation

---

### Task 8.27: Strength Reduction Enhancement (6 hours)

**File**: `packages/compiler/src/semantic/analysis/strength-reduction.ts`

**Goal**: Replace expensive operations with cheap equivalents

**Why Critical**: 6502 has NO multiply/divide instructions! Software multiply/divide is 50-200+ cycles. Strength reduction can replace:
- `x * 2` → `x << 1` (shift) - saves ~45 cycles
- `x * 4` → `x << 2` - saves ~90 cycles
- `x / 8` → `x >> 3` - saves ~100 cycles

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.StrengthReducible;  // boolean - can reduce
OptimizationMetadataKey.ReplacementOp;      // string - what to replace with
OptimizationMetadataKey.CycleSavings;       // number - cycles saved
```

**Implementation**: Pattern matching on multiplication/division by powers of 2, modulo operations

**Tests** (15+): Multiply by 2/4/8/16, divide by powers of 2, modulo optimization, shift-and-add patterns, non-power-of-2 (no reduction)

---

### Task 8.28: Load/Store Coalescing (6 hours)

**File**: `packages/compiler/src/semantic/analysis/load-store-coalesce.ts`

**Goal**: Combine redundant memory accesses

**Why Critical**: 6502 has extreme register pressure (only A, X, Y). Redundant loads/stores waste cycles:
- LDA: 3-4 cycles
- STA: 3-4 cycles
- Eliminating one LDA/STA pair saves 6-8 cycles

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.RedundantLoad;      // boolean - load can be eliminated
OptimizationMetadataKey.CoalesceCandidate;  // boolean - can coalesce with previous
```

**Implementation**: Track register contents, detect redundant loads, identify store forwarding opportunities

**Tests** (12+): Redundant load elimination, store forwarding, register reuse, intervening writes (breaks optimization), different addressing modes

---

### Task 8.29: Instruction Scheduling (6 hours)

**File**: `packages/compiler/src/semantic/analysis/instruction-schedule.ts`

**Goal**: Reorder instructions to minimize register conflicts

**Why Critical**: Optimal instruction ordering reduces register spilling (fewer memory accesses = faster code)

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.SchedulingHint;     // string - suggested order
OptimizationMetadataKey.RegisterConflict;   // boolean - conflict detected
```

**Implementation**: Dependency analysis, topological sort of independent operations, register allocation awareness

**Tests** (12+): Independent operations reordering, dependency respect, register conflict resolution, optimal sequencing, no-reorder cases

---

## Category D: Cross-Module God-Level Analysis

### Task 8.30: Whole-Program Call Graph (5 hours)

**File**: `packages/compiler/src/semantic/analysis/whole-program-call-graph.ts`

**Goal**: Build call graph across ALL modules (not just current module)

**Why Critical**: Enables:
- Cross-module inlining
- Global dead code elimination
- Whole-program optimization metadata

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.GlobalCallGraph;            // Graph - complete call graph
OptimizationMetadataKey.CrossModuleInlineCandidate; // boolean - inline across modules
```

**Implementation**:

```typescript
/**
 * Whole-program call graph builder
 *
 * Builds complete call graph across ALL modules for
 * god-level cross-module optimization.
 */
export class WholeProgramCallGraphBuilder {
  private callGraph = new Map<string, Set<string>>();
  
  constructor(
    private moduleRegistry: ModuleRegistry,
    private symbolTables: Map<string, SymbolTable>
  ) {}

  analyze(): void {
    // Phase 1: Build local call graphs per module
    for (const [modulePath, symbolTable] of this.symbolTables) {
      this.buildModuleCallGraph(modulePath, symbolTable);
    }

    // Phase 2: Resolve cross-module calls via imports/exports
    this.resolveCrossModuleCalls();

    // Phase 3: Detect cross-module inline opportunities
    this.detectCrossModuleInlining();

    // Phase 4: Global dead code elimination
    this.findGlobalUnusedFunctions();
  }

  private resolveCrossModuleCalls(): void {
    // Follow import chains to find actual implementations
    for (const [caller, callees] of this.callGraph) {
      for (const callee of callees) {
        if (this.isImportedSymbol(callee)) {
          const actualImpl = this.resolveImportChain(callee);
          if (actualImpl) {
            this.callGraph.get(caller)!.delete(callee);
            this.callGraph.get(caller)!.add(actualImpl);
          }
        }
      }
    }
  }
}
```

**Tests** (15+): Single-module call graph, cross-module calls, import chain resolution, transitive calls, mutual imports, cross-module inlining, global unused detection

---

### Task 8.31: Global Constant Propagation (5 hours)

**File**: `packages/compiler/src/semantic/analysis/global-constants.ts`

**Goal**: Propagate constants across module boundaries

**Why Critical**: Constants exported from one module can be folded in importing modules

**Metadata Keys Used**:

```typescript
OptimizationMetadataKey.GlobalConstant;           // boolean - const across modules
OptimizationMetadataKey.CrossModulePropagation;   // boolean - can propagate
```

**Implementation**: Track exported constants, propagate through import chains, enable whole-program constant folding

**Tests** (12+): Exported constants, imported constant usage, transitive propagation, re-exported constants, non-const detection, conditional exports

---

### Task 8.32: Final Integration & God-Level Testing (7 hours)

**File**: Update `packages/compiler/src/semantic/analysis/advanced-analyzer.ts`

**Goal**: Integrate ALL Tier 4 analyses, comprehensive end-to-end testing

**Deliverables**:
- Update `AdvancedAnalyzer.runTier4GodLevelAnalysis()` to run all 15 god-level analyses
- Create `god-level-integration.test.ts` with comprehensive test suite
- Real C64 game code pattern testing
- Performance benchmarking (ensure <2s for 10,000 LOC)

**Tests** (50+):
- Complete pipeline (Tiers 1-4 all working)
- Real C64 code patterns (sprite multiplexing, raster effects, music/SFX)
- Cross-module optimization
- Performance benchmarks
- Memory usage validation
- Complex game logic
- Hardware interaction patterns
- Interrupt-driven code
- Large programs (5000+ LOC)

**Example Integration Test**:

```typescript
describe('God-Level Integration', () => {
  it('should optimize complete C64 game loop', () => {
    const gameModule = `
      export function gameLoop() {
        // VIC-II timing critical
        updateSprites();    // Should inline (small)
        updatePlayer();     // Tail call candidate
        updateEnemies();    // Loop optimization
      }
    `;

    const spriteModule = `
      @map vicSpriteX at $D000: [byte; 8];
      
      export function updateSprites() {
        for (let i: byte = 0; i < 8; i = i + 1) {
          vicSpriteX[i] = vicSpriteX[i] + 1;
        }
      }
    `;

    const { ast, analyzer } = setupMultiModuleTest([gameModule, spriteModule]);
    analyzer.analyze();

    // Check ALL god-level analyses worked:
    
    // 1. VIC-II timing
    const gameLoop = findFunction(ast, 'gameLoop');
    expect(gameLoop.metadata?.get(OptimizationMetadataKey.VICIICyclesBudget))
      .toBeLessThan(63); // Fits in raster line
    
    // 2. Cross-module inlining
    expect(gameLoop.metadata?.get(OptimizationMetadataKey.CrossModuleInlineCandidate))
      .toBe(true);
    
    // 3. Loop optimization
    const updateSprites = findFunction(ast, 'updateSprites');
    expect(updateSprites.metadata?.get(OptimizationMetadataKey.LoopUnrollable))
      .toBe(true); // Small fixed count
    
    // 4. Register hints
    expect(updateSprites.metadata?.get(OptimizationMetadataKey.M6502RegisterPreference))
      .toBe(Register.X); // Loop counter
    
    // All 661+ tests passing!
  });
});
```

---

## Tier 4 Category C+D Summary

| Task      | Description                   | Hours      | Tests         | Category       | Status  |
| --------- | ----------------------------- | ---------- | ------------- | -------------- | ------- |
| 8.24      | JSR/RTS overhead              | 5          | 12+           | Call Opt.      | [ ]     |
| 8.25      | Tail calls                    | 5          | 12+           | Call Opt.      | [ ]     |
| 8.27      | Strength reduction            | 6          | 15+           | Instruction    | [ ]     |
| 8.28      | Load/store coalesce           | 6          | 12+           | Instruction    | [ ]     |
| 8.29      | Instruction scheduling        | 6          | 12+           | Instruction    | [ ]     |
| 8.30      | Whole-program call graph      | 5          | 15+           | Cross-Module   | [ ]     |
| 8.31      | Global constant propagation   | 5          | 12+           | Cross-Module   | [ ]     |
| 8.32      | Final integration             | 7          | 50+           | Integration    | [ ]     |
| **Total** | **Call/Inst + Cross-Module**  | **45 hrs** | **140+ tests**| **8 analyses** | **[ ]** |

---

## Complete Tier 4 Summary (All Categories)

| Category               | Tasks     | Hours      | Tests          | Status  |
| ---------------------- | --------- | ---------- | -------------- | ------- |
| A: 6502 Hardware       | 4 tasks   | 26 hours   | 89+ tests      | [ ]     |
| B: Modern Compiler     | 3 tasks   | 20 hours   | 53+ tests      | [ ]     |
| C: Call/Inst Opt       | 5 tasks   | 28 hours   | 63+ tests      | [ ]     |
| D: Cross-Module        | 3 tasks   | 17 hours   | 77+ tests      | [ ]     |
| **Tier 4 Total**       | **15 tasks** | **91 hrs** | **282+ tests** | **[ ]** |

**Note**: Category A increased from 65+ to 89+ tests (+24) due to Part 4 expansions of Tasks 8.15, 8.17, 8.23.

---

## Why Category C & D Matter

### JSR/RTS Overhead (8.24)
```typescript
// WITHOUT analysis: Wasteful function calls
function add(a: byte, b: byte): byte {
  return a + b;  // Body: 3 cycles, Overhead: 12 cycles (80% waste!)
}

// WITH analysis:
// INLINE: add() body directly at call site
// Saves: 12 cycles per call
```

### Strength Reduction (8.27)
```typescript
// WITHOUT analysis: Slow software multiply
let x: byte = value * 8;  // ~80 cycles (software multiply)

// WITH analysis:
// REPLACE: x = value << 3  // 6 cycles (shift left 3)
// Saves: 74 cycles (92% faster!)
```

### Whole-Program Call Graph (8.30)
```typescript
// module1.bl65
export function helper(): byte {
  return 42;  // Small, pure function
}

// module2.bl65
import { helper } from './module1';
let result: byte = helper();

// WITHOUT analysis: Cross-module call (JSR overhead)
// WITH analysis: INLINE across modules - saves 12 cycles
```

---

## Production C64 Game Pattern Tests

Task 8.32 includes tests for real-world C64 game patterns:

1. **Sprite Multiplexing**: VIC-II timing + raster interrupts
2. **Raster Split Effects**: Cycle-accurate timing + badline awareness
3. **Music Player**: SID voice management + interrupt safety
4. **Parallax Scrolling**: Loop optimization + memory access patterns
5. **Collision Detection**: Value range analysis + bounds checking
6. **Score Display**: BCD arithmetic + carry flag optimization
7. **Player Movement**: Input handling + zero-page allocation
8. **Enemy AI**: Branch prediction + instruction scheduling

---

## Next Steps

After completing **Part 5 (Tier 4 Categories C+D)**:

1. ✅ All 15 Tier 4 god-level analyses complete
2. ✅ 258+ tests passing for Tier 4
3. ✅ Cross-module optimization working
4. ✅ Complete Phase 8 functional (Tiers 1-4)

**→ Continue to [Part 6: Summary, File Structure & Checklist](phase8-part6-summary.md)**

---

## Part 5 Update Notes

**Cross-Reference Updates Applied:**
- ✅ Tier 4 Category A test count: 65+ → 89+ tests (+24 from Part 4 expansions)
- ✅ Tier 4 total tests: 258+ → 282+ tests
- ✅ Grand total tests updated: 596+ → 661+
- ✅ Part 4 prerequisites note updated to reference expansions

**Related Changes (Other Parts):**
- Part 2: Added Task 8.21 (Copy Propagation)
- Part 3: Added Tasks 8.18-8.19 (GVN, CSE), expanded 4 tasks
- Part 4: Expanded Tasks 8.15, 8.17, 8.23 (+24 tests)
- Overall: 33 → 36 tasks, 596+ → 661+ tests

---

**Part 5 Status**: Tier 4 Call/Inst & Cross-Module (8 tasks, 45 hours, 140+ tests)
**Architecture**: God-level optimization complete ✅