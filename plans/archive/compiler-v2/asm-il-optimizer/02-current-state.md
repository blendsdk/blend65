# Current State: ASM-IL Optimizer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

The compiler-v1 package already contains a complete ASM-IL optimizer infrastructure that we can leverage and extend for compiler-v2.

### What Exists (compiler-v1)

**Location**: `packages/compiler/src/asm-il/optimizer/`

| File | Purpose | Status |
|------|---------|--------|
| `types.ts` | Pass interface, config, result types | ✅ Complete |
| `base-optimizer.ts` | Base optimizer class | ✅ Complete |
| `asm-optimizer.ts` | Pass manager with fixed-point | ✅ Complete |
| `pass-through.ts` | No-op pass for testing | ✅ Complete |
| `index.ts` | Module exports | ✅ Complete |

### ASM-IL Types (compiler-v1)

**Location**: `packages/compiler/src/asm-il/types.ts`

```typescript
// Full 6502 ASM-IL representation
export interface AsmModule {
  name: string;
  origin: number;
  target: string;
  items: AsmItem[];
  labels: Map<string, AsmLabel>;
  metadata: AsmModuleMetadata;
}

export type AsmItem =
  | AsmInstruction
  | AsmLabel
  | AsmData
  | AsmOrigin
  | AsmComment
  | AsmBlankLine
  | AsmRaw;

export interface AsmInstruction {
  kind: 'instruction';
  mnemonic: Mnemonic;      // 'LDA', 'STA', 'TAX', etc.
  mode: AddressingMode;    // Immediate, ZeroPage, Absolute, etc.
  operand?: number | string;
  cycles: number;
  bytes: number;
  comment?: string;
  sourceLocation?: SourceLocation;
}
```

### Optimizer Infrastructure (compiler-v1)

```typescript
// Pass interface - what each optimization pass must implement
export interface AsmOptimizationPass {
  readonly name: string;
  readonly isTransform: boolean;
  run(module: AsmModule): AsmModule;
}

// Configuration for the optimizer
export interface AsmOptimizerConfig {
  enabled: boolean;
  passes: AsmOptimizationPass[];
  maxIterations: number;
  debug: boolean;
}

// Result from running the optimizer
export interface AsmOptimizationResult {
  module: AsmModule;
  changed: boolean;
  iterations: number;
  passStats: Map<string, AsmPassStatistics>;
}
```

### Pass Manager Implementation

```typescript
export class AsmOptimizer extends BaseAsmOptimizer {
  optimize(module: AsmModule): AsmOptimizationResult {
    // Pass-through if disabled
    if (!this.isEnabled()) {
      return this.createPassThroughResult(module);
    }

    // Run passes with fixed-point iteration
    for (let i = 0; i < this.config.maxIterations; i++) {
      let iterationChanged = false;
      
      for (const pass of this.config.passes) {
        const result = pass.run(currentModule);
        if (result !== currentModule) {
          currentModule = result;
          iterationChanged = true;
        }
      }

      // Stop if no changes (fixed-point reached)
      if (!iterationChanged) break;
    }

    return { module: currentModule, changed, iterations, passStats };
  }
}
```

## Relevant Files

### From compiler-v1 (to migrate/reference)

| File | Purpose | Migration Plan |
|------|---------|----------------|
| `asm-il/types.ts` | ASM-IL types | Migrate to v2 |
| `asm-il/optimizer/types.ts` | Pass interface | Migrate to v2 |
| `asm-il/optimizer/asm-optimizer.ts` | Pass manager | Migrate to v2 |
| `asm-il/optimizer/base-optimizer.ts` | Base class | Migrate to v2 |

### For compiler-v2 (to create)

| File | Purpose |
|------|---------|
| `asm-il/optimizer/passes/flag-patterns.ts` | CLC/SEC/CMP optimization |
| `asm-il/optimizer/passes/store-load.ts` | STA/LDA elimination |
| `asm-il/optimizer/passes/branch-opt.ts` | Branch chain collapse |
| `asm-il/optimizer/passes/transfer-opt.ts` | TAX/TXA optimization |
| `asm-il/optimizer/passes/zp-promotion.ts` | Zero-page promotion |
| `asm-il/optimizer/passes/strength-6502.ts` | 6502 strength reduction |
| `asm-il/optimizer/passes/stack-opt.ts` | PHA/PLA elimination |
| `asm-il/optimizer/passes/size-opt.ts` | Size optimization |
| `asm-il/optimizer/passes/index.ts` | Pass exports |

## Code Analysis

### Strengths of Existing Infrastructure

1. **Well-Designed Pass Interface**
   - Simple `run(module): module` contract
   - Immutable transformation (returns new module if changed)
   - Statistics tracking built-in

2. **Fixed-Point Iteration Support**
   - `maxIterations` config for aggressive optimization
   - Automatic convergence detection
   - Per-pass statistics collection

3. **Comprehensive ASM-IL Types**
   - Full 6502 instruction set (`Mnemonic` type)
   - All addressing modes (`AddressingMode` enum)
   - Cycle and byte counts pre-calculated
   - Type guards for safe pattern matching

4. **Factory Functions**
   - `createAsmOptimizer()` for easy instantiation
   - Fluent builder pattern (`addPass()`, `setEnabled()`)

### Gaps Identified

### Gap 1: No Optimization Passes

**Current Behavior:** Only infrastructure exists, no actual passes.

**Required Behavior:** Need 8 optimization passes (flag, store-load, branch, transfer, ZP promotion, 6502 strength, stack, size).

**Fix Required:** Implement all passes following the `AsmOptimizationPass` interface.

### Gap 2: No Optimization Level Handling

**Current Behavior:** Pass list is manually configured.

**Required Behavior:** Automatic pass selection based on -O level.

**Fix Required:** Create `createPassesForLevel(level: OptimizationLevel): AsmOptimizationPass[]` function.

### Gap 3: No Flag/Register State Tracking

**Current Behavior:** No analysis infrastructure for tracking CPU state.

**Required Behavior:** Need to track which flags are valid, what registers hold, for safe optimization.

**Fix Required:** Create analysis utilities:
- `FlagStateAnalyzer` - Tracks C, Z, N, V flags
- `RegisterTracker` - Tracks A, X, Y contents
- `AliasAnalyzer` - Tracks potential memory aliases

### Gap 4: Not in compiler-v2 Package

**Current Behavior:** All ASM-IL code is in compiler-v1.

**Required Behavior:** Need working infrastructure in compiler-v2.

**Fix Required:** Migrate types and optimizer to `packages/compiler-v2/src/asm-il/`.

## Dependencies

### Internal Dependencies

- **ASM-IL Types** - Must be migrated first
- **Code Generator** - Produces `AsmModule` input
- **Emitter** - Consumes optimized `AsmModule` output

### External Dependencies

None - Pure TypeScript transformation.

## Architecture Decisions

### Decision 1: Immutable Transformations

**Decision:** Passes return new `AsmModule` if changed, same reference if unchanged.

**Rationale:**
- Easy convergence detection (`result !== input`)
- Functional programming benefits
- No side effects to track

### Decision 2: Pattern-Based Passes

**Decision:** Each pass focuses on one pattern category.

**Rationale:**
- Single responsibility principle
- Easier testing and debugging
- Can be enabled/disabled independently

### Decision 3: Analysis on Demand

**Decision:** Don't precompute all analysis; compute as needed per pass.

**Rationale:**
- Some passes don't need complex analysis
- Avoids wasted computation
- Can cache analysis results within a pass

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incorrect optimization | Medium | High | Comprehensive tests |
| Slow compilation | Low | Medium | Profile and optimize |
| Flag state complexity | Medium | Medium | Conservative approach |
| ZP allocation conflicts | Low | High | Careful slot management |

## Existing Test Infrastructure

Currently no tests for ASM-IL optimizer in v1 or v2.

**Test Infrastructure Needed:**
- Unit tests per pass
- Integration tests for pass combinations
- E2E tests (Blend → optimized ASM)
- Correctness verification (run optimized code)

## Migration Path

### Phase 1: Types Migration
1. Copy ASM-IL types to compiler-v2
2. Copy optimizer types to compiler-v2
3. Verify compilation

### Phase 2: Infrastructure Migration
1. Copy base optimizer
2. Copy pass manager
3. Add optimization level handling

### Phase 3: Pass Implementation
1. Implement Flag Patterns pass
2. Implement Store-Load pass
3. Implement Branch Optimization pass
4. Implement Transfer Optimization pass
5. Implement ZP Promotion pass
6. Implement 6502 Strength pass
7. Implement Stack Optimization pass
8. Implement Size Optimization pass

### Phase 4: Integration
1. Wire into compilation pipeline
2. Add CLI flags for optimization levels
3. End-to-end testing