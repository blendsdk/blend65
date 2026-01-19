# Phase 8 Tier 4 - Granular Implementation Steps (HAL-Integrated)

> **Status**: Implementation Ready  
> **Created**: January 18, 2026  
> **Updated**: January 18, 2026 - Aligned with Hardware Abstraction Layer  
> **Scope**: 15 tasks → 67 granular steps  
> **Estimated Time**: 91 hours total (split into 2-4 hour steps)  
> **Tests Required**: 282+ tests

---

## Overview

This document breaks down Phase 8 Tier 4 (God-Level Analysis) into small, actionable implementation steps. Each step is designed to be completable within 2-4 hours with clear deliverables.

**HAL Integration**: This plan is aligned with the Hardware Abstraction Layer (HAL) implemented in:
- `packages/compiler/src/target/` - Target architecture system
- `packages/compiler/src/semantic/analysis/hardware/` - Hardware analyzers

### Prerequisites

Before starting, verify:
- ✅ Tiers 1-3 complete (all tests passing)
- ✅ `advanced-analyzer.ts` orchestrating Tiers 1-3
- ✅ Metadata key infrastructure (`optimization-metadata-keys.ts`)
- ✅ **HAL implemented** (`target/` and `hardware/` directories exist)
- ✅ `C64HardwareAnalyzer` with zero-page analysis complete
- ✅ `analyzeGraphics()` and `analyzeSound()` placeholders ready for Tier 4

### HAL Architecture Summary

```
Level 1: Universal (Always Run)
├── Dead code, unused functions, constant propagation
├── Liveness, reaching definitions, definite assignment
└── GVN, CSE, loop invariants, value range analysis

Level 2: 6502-Common (All Targets)
├── Register hints (A, X, Y preference)
├── Branch distance analysis (±127 bytes)  ← common-6502-analyzer.ts
├── Carry/Decimal flag dataflow
└── Stack depth analysis (256-byte limit)

Level 3: Target-Specific (C64)
├── C64HardwareAnalyzer (zero-page done)
├── VIC-II timing (Tier 4 - to implement)
├── SID conflicts (Tier 4 - to implement)
└── C64 memory regions (Tier 4 - to implement)
```

---

## File Location Summary (HAL-Aligned)

### Category A: C64-Specific Hardware → `hardware/c64/`
```
packages/compiler/src/semantic/analysis/hardware/c64/
├── vic-ii-timing.ts          # Task 8.15 (integrate with analyzeGraphics)
├── sid-conflicts.ts          # Task 8.16 (integrate with analyzeSound)
└── c64-memory-regions.ts     # Task 8.17 (C64 memory map)
```

### Category A: 6502-Common → `hardware/`
```
packages/compiler/src/semantic/analysis/hardware/
└── branch-distance.ts        # Task 8.20 (6502-common, not C64-specific)
```

### Category B-D: Modern Compiler → `analysis/`
```
packages/compiler/src/semantic/analysis/
├── value-range.ts            # Task 8.22
├── carry-flag.ts             # Task 8.23
├── interrupt-safety.ts       # Task 8.26
├── jsr-overhead.ts           # Task 8.24
├── tail-calls.ts             # Task 8.25
├── strength-reduction.ts     # Task 8.27
├── load-store-coalesce.ts    # Task 8.28
├── instruction-schedule.ts   # Task 8.29
├── whole-program-call-graph.ts  # Task 8.30
└── global-constants.ts          # Task 8.31
```

### Test Files → Mirror Source Structure
```
packages/compiler/src/__tests__/semantic/analysis/hardware/c64/
├── vic-ii-timing.test.ts
├── sid-conflicts.test.ts
└── c64-memory-regions.test.ts

packages/compiler/src/__tests__/semantic/analysis/hardware/
└── branch-distance.test.ts

packages/compiler/src/__tests__/semantic/analysis/
├── value-range.test.ts
├── carry-flag.test.ts
... (other test files)
```

---

## Category A: C64 Hardware-Specific Analysis

### Task 8.15: VIC-II Timing & Raster Analysis (8 hours → 6 steps)

**Goal**: Estimate cycle counts and validate raster timing constraints  
**Location**: `hardware/c64/vic-ii-timing.ts`  
**Integration**: Called from `C64HardwareAnalyzer.analyzeGraphics()`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.15.1 | Create `vic-ii-timing.ts` with class structure, constants (CYCLES_PER_LINE=63, CYCLES_PER_FRAME_PAL=19656, BADLINE_STEAL=40) from `C64_CONFIG.graphicsChip` | 1h | 49 | [x] |
| 8.15.2 | Implement `estimateStatementCycles()` and `estimateExpressionCycles()` for sophisticated cycle analysis | 1.5h | 43 | [x] |
| 8.15.3 | Implement `estimateLoopCycles()` with iteration detection and body cycle estimation | 1.5h | 20 | [x] |
| 8.15.4 | Implement hardware penalty detection: Sprite DMA (2 cycles/sprite), page crossing (+1), RMW operations (+2) | 2h | 16 | [x] |
| 8.15.5 | Implement raster safety check (`VICIIRasterSafe`, `VICIIBadlineAware` metadata) and badline warnings | 1h | 5 | [x] |
| 8.15.6 | Integrate into `C64HardwareAnalyzer.analyzeGraphics()` and update `hardware/c64/index.ts` exports | 1h | 4 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/hardware/c64/vic-ii-timing.ts`
- `packages/compiler/src/__tests__/semantic/analysis/hardware/c64/vic-ii-timing.test.ts`
- Updated `C64HardwareAnalyzer.analyzeGraphics()` to use VIC-II timing
- 30+ tests passing

---

### Task 8.16: SID Resource Conflict Analysis (6 hours → 4 steps)

**Goal**: Detect SID voice and filter resource conflicts  
**Location**: `hardware/c64/sid-conflicts.ts`  
**Integration**: Called from `C64HardwareAnalyzer.analyzeSound()`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.16.1 | Create `sid-conflicts.ts` with SID register definitions from `C64_CONFIG.soundChip`, voice tracking structures | 1h | 3 | [ ] |
| 8.16.2 | Implement voice usage tracking: Detect writes to voice control registers, track which voices are in use | 1.5h | 4 | [ ] |
| 8.16.3 | Implement filter conflict detection: Filter is shared, detect when multiple voices try to use different filter settings | 2h | 5 | [ ] |
| 8.16.4 | Integrate into `C64HardwareAnalyzer.analyzeSound()` and add IRQ timing analysis | 1.5h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/hardware/c64/sid-conflicts.ts`
- `packages/compiler/src/__tests__/semantic/analysis/hardware/c64/sid-conflicts.test.ts`
- Updated `C64HardwareAnalyzer.analyzeSound()` to use SID conflict detection
- 15+ tests passing

---

### Task 8.17: C64 Memory Region Conflict Analysis (6 hours → 5 steps)

**Goal**: Detect I/O region conflicts, alignment requirements, VIC-II banking  
**Location**: `hardware/c64/c64-memory-regions.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.17.1 | Create `c64-memory-regions.ts` with MemoryRegion enum, VIC bank definitions (0-3, each 16K), alignment constants | 1h | 4 | [ ] |
| 8.17.2 | Implement alignment validation: Sprite (64-byte), Screen (1K), Charset (2K), Bitmap (8K) | 1.5h | 6 | [ ] |
| 8.17.3 | Implement VIC-II bank detection and cross-bank conflict detection (screen/charset must be in same bank) | 1.5h | 5 | [ ] |
| 8.17.4 | Implement Character ROM conflict detection at offsets $1000-$1FFF in banks 0 and 2 | 1h | 5 | [ ] |
| 8.17.5 | Integrate with `C64HardwareAnalyzer` and add memory overlap warnings | 1h | 6 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/hardware/c64/c64-memory-regions.ts`
- `packages/compiler/src/__tests__/semantic/analysis/hardware/c64/c64-memory-regions.test.ts`
- 26+ tests passing

---

### Task 8.20: Branch Distance Analysis (6 hours → 4 steps)

**Goal**: Detect branches exceeding ±127 byte limit  
**Location**: `hardware/branch-distance.ts` (6502-common, shared by all targets)

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.20.1 | Create `branch-distance.ts` in `hardware/` (not c64-specific) with code size estimation | 1h | 3 | [ ] |
| 8.20.2 | Implement branch target distance calculation (forward and backward branches) | 2h | 4 | [ ] |
| 8.20.3 | Implement long branch detection (>127 bytes) and JMP recommendation metadata | 1.5h | 3 | [ ] |
| 8.20.4 | Integrate with `Common6502Analyzer` and add branch frequency hints | 1.5h | 2 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/hardware/branch-distance.ts`
- `packages/compiler/src/__tests__/semantic/analysis/hardware/branch-distance.test.ts`
- Updated `common-6502-analyzer.ts` to use branch distance analysis
- 12+ tests passing

---

## Category B: Modern Compiler Techniques

### Task 8.22: Integer Range Analysis (7 hours → 5 steps)

**Goal**: Track value ranges to eliminate overflow checks  
**Location**: `analysis/value-range.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.22.1 | Create `value-range.ts` with ValueRange type ({min, max}), initialize ranges from type declarations | 1h | 4 | [ ] |
| 8.22.2 | Implement range computation for literals and basic operations (+, -, &, |) | 1.5h | 5 | [ ] |
| 8.22.3 | Implement dataflow-based range refinement with worklist algorithm | 2h | 4 | [ ] |
| 8.22.4 | Implement overflow/underflow detection and OverflowImpossible metadata | 1.5h | 4 | [ ] |
| 8.22.5 | Implement array bounds check elimination hints | 1h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/value-range.ts`
- `packages/compiler/src/__tests__/semantic/analysis/value-range.test.ts`
- 20+ tests passing

---

### Task 8.23: Carry Flag Dataflow Analysis (6 hours → 5 steps)

**Goal**: Track carry flag state to eliminate redundant CLC/SEC  
**Location**: `analysis/carry-flag.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.23.1 | Create `carry-flag.ts` with CarryState type (Clear/Set/Unknown), DecimalState type | 1h | 3 | [ ] |
| 8.23.2 | Implement carry state propagation through basic blocks | 1.5h | 4 | [ ] |
| 8.23.3 | Implement carry state at merge points (if both paths have same state, keep it; else Unknown) | 1h | 4 | [ ] |
| 8.23.4 | Implement decimal mode tracking (SED/CLD) and IRQ handler decimal flag risk detection | 1.5h | 6 | [ ] |
| 8.23.5 | Generate RequiresCLC/RequiresSEC metadata and redundancy warnings | 1h | 4 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/carry-flag.ts`
- `packages/compiler/src/__tests__/semantic/analysis/carry-flag.test.ts`
- 21+ tests passing

---

### Task 8.26: Interrupt Safety Analysis (7 hours → 5 steps)

**Goal**: Detect race conditions, non-reentrant code, critical sections  
**Location**: `analysis/interrupt-safety.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.26.1 | Create `interrupt-safety.ts` with shared variable tracking infrastructure | 1h | 3 | [ ] |
| 8.26.2 | Identify IRQ handlers (functions with @irq annotation or specific names) | 1.5h | 4 | [ ] |
| 8.26.3 | Detect shared variable access (variables used in both main code and IRQ handlers) | 1.5h | 4 | [ ] |
| 8.26.4 | Implement race condition detection: Non-atomic operations on shared variables | 2h | 4 | [ ] |
| 8.26.5 | Generate RequiresCriticalSection metadata and interrupt safety warnings | 1h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/interrupt-safety.ts`
- `packages/compiler/src/__tests__/semantic/analysis/interrupt-safety.test.ts`
- 18+ tests passing

---

## Category C: Advanced Call & Instruction Optimization

### Task 8.24: JSR/RTS Overhead Analysis (5 hours → 4 steps)

**Goal**: Calculate call overhead vs function body cost  
**Location**: `analysis/jsr-overhead.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.24.1 | Create `jsr-overhead.ts` with JSR_CYCLES=6, RTS_CYCLES=6 constants | 1h | 3 | [ ] |
| 8.24.2 | Implement body cycle estimation (reuse VIC-II timing estimates) | 1.5h | 3 | [ ] |
| 8.24.3 | Implement leaf function detection (functions that call no other functions) | 1h | 3 | [ ] |
| 8.24.4 | Generate InlineThreshold metadata based on overhead vs body cost | 1.5h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/jsr-overhead.ts`
- `packages/compiler/src/__tests__/semantic/analysis/jsr-overhead.test.ts`
- 12+ tests passing

---

### Task 8.25: Tail Call Optimization (5 hours → 4 steps)

**Goal**: Detect tail calls that can become JMP instead of JSR/RTS  
**Location**: `analysis/tail-calls.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.25.1 | Create `tail-calls.ts` with tail call detection infrastructure | 1h | 3 | [ ] |
| 8.25.2 | Implement tail position detection (last statement before return is a call) | 1.5h | 4 | [ ] |
| 8.25.3 | Handle conditional tail calls (tail call in if/else branches) | 1.5h | 3 | [ ] |
| 8.25.4 | Generate TailCallCandidate and TailCallSavings metadata | 1h | 2 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/tail-calls.ts`
- `packages/compiler/src/__tests__/semantic/analysis/tail-calls.test.ts`
- 12+ tests passing

---

### Task 8.27: Strength Reduction Enhancement (6 hours → 4 steps)

**Goal**: Replace expensive operations with cheap equivalents  
**Location**: `analysis/strength-reduction.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.27.1 | Create `strength-reduction.ts` with pattern matching infrastructure | 1h | 3 | [ ] |
| 8.27.2 | Implement power-of-2 multiply detection (`x * 2` → `x << 1`) | 2h | 5 | [ ] |
| 8.27.3 | Implement power-of-2 divide/modulo detection (`x / 2` → `x >> 1`, `x % 8` → `x & 7`) | 2h | 4 | [ ] |
| 8.27.4 | Generate StrengthReducible, ReplacementOp, CycleSavings metadata | 1h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/strength-reduction.ts`
- `packages/compiler/src/__tests__/semantic/analysis/strength-reduction.test.ts`
- 15+ tests passing

---

### Task 8.28: Load/Store Coalescing (6 hours → 4 steps)

**Goal**: Combine redundant memory accesses  
**Location**: `analysis/load-store-coalesce.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.28.1 | Create `load-store-coalesce.ts` with register content tracking | 1h | 3 | [ ] |
| 8.28.2 | Implement redundant load detection (same value already in register) | 2h | 4 | [ ] |
| 8.28.3 | Implement store forwarding detection (load after store from same location) | 2h | 3 | [ ] |
| 8.28.4 | Generate RedundantLoad and CoalesceCandidate metadata | 1h | 2 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/load-store-coalesce.ts`
- `packages/compiler/src/__tests__/semantic/analysis/load-store-coalesce.test.ts`
- 12+ tests passing

---

### Task 8.29: Instruction Scheduling (6 hours → 4 steps)

**Goal**: Reorder instructions to minimize register conflicts  
**Location**: `analysis/instruction-schedule.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.29.1 | Create `instruction-schedule.ts` with dependency graph structure | 1h | 3 | [ ] |
| 8.29.2 | Build dependency graph from statement data dependencies | 2h | 3 | [ ] |
| 8.29.3 | Implement topological sort with register pressure awareness | 2h | 4 | [ ] |
| 8.29.4 | Generate SchedulingHint and RegisterConflict metadata | 1h | 2 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/instruction-schedule.ts`
- `packages/compiler/src/__tests__/semantic/analysis/instruction-schedule.test.ts`
- 12+ tests passing

---

## Category D: Cross-Module Analysis

### Task 8.30: Whole-Program Call Graph (5 hours → 4 steps)

**Goal**: Build call graph across ALL modules  
**Location**: `analysis/whole-program-call-graph.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.30.1 | Create `whole-program-call-graph.ts` with multi-module infrastructure | 1h | 3 | [ ] |
| 8.30.2 | Build local call graphs per module, then merge via import/export chains | 2h | 5 | [ ] |
| 8.30.3 | Resolve cross-module calls through import chain following | 1h | 4 | [ ] |
| 8.30.4 | Detect cross-module inline candidates and global dead functions | 1h | 3 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/whole-program-call-graph.ts`
- `packages/compiler/src/__tests__/semantic/analysis/whole-program-call-graph.test.ts`
- 15+ tests passing

---

### Task 8.31: Global Constant Propagation (5 hours → 4 steps)

**Goal**: Propagate constants across module boundaries  
**Location**: `analysis/global-constants.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.31.1 | Create `global-constants.ts` with exported constant tracking | 1h | 3 | [ ] |
| 8.31.2 | Identify exported constants and their values | 1.5h | 3 | [ ] |
| 8.31.3 | Propagate constant values through import chains | 1.5h | 4 | [ ] |
| 8.31.4 | Generate GlobalConstant and CrossModulePropagation metadata | 1h | 2 | [ ] |

**Deliverables**:
- `packages/compiler/src/semantic/analysis/global-constants.ts`
- `packages/compiler/src/__tests__/semantic/analysis/global-constants.test.ts`
- 12+ tests passing

---

### Task 8.32: Final Integration & Testing (7 hours → 5 steps)

**Goal**: Integrate ALL Tier 4 analyses into AdvancedAnalyzer  
**Location**: `analysis/advanced-analyzer.ts`

| Step | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 8.32.1 | Add `runTier4HardwareAnalysis()` - orchestrates C64HardwareAnalyzer Tier 4 features | 1h | 5 | [ ] |
| 8.32.2 | Add `runTier4ModernCompilerAnalysis()` - value-range, carry-flag, interrupt-safety | 1h | 5 | [ ] |
| 8.32.3 | Add `runTier4CallInstructionAnalysis()` - jsr-overhead, tail-calls, strength-reduction, etc. | 1h | 5 | [ ] |
| 8.32.4 | Add `runTier4CrossModuleAnalysis()` - whole-program call graph, global constants | 1h | 5 | [ ] |
| 8.32.5 | Create `god-level-integration.test.ts` with real C64 game patterns | 3h | 30 | [ ] |

**Deliverables**:
- Updated `packages/compiler/src/semantic/analysis/advanced-analyzer.ts`
- `packages/compiler/src/__tests__/semantic/analysis/god-level-integration.test.ts`
- 50+ tests passing

---

## Current Progress Tracker

| Category | Tasks | Steps | Tests | Status |
|----------|-------|-------|-------|--------|
| A: C64 Hardware | 4 | 19 | 83+ | [ ] 0% |
| B: Modern Compiler | 3 | 15 | 59+ | [ ] 0% |
| C: Call/Instruction | 5 | 20 | 63+ | [ ] 0% |
| D: Cross-Module | 3 | 13 | 77+ | [ ] 0% |
| **Total** | **15** | **67** | **282+** | **[ ] 0%** |

---

## HAL Integration Checklist

Before implementing each task, ensure:

- [ ] Read relevant target config (e.g., `C64_CONFIG.graphicsChip` for VIC-II timing)
- [ ] Use existing `C64HardwareAnalyzer` placeholder methods where applicable
- [ ] Update `hardware/c64/index.ts` exports when adding new files
- [ ] Use `TargetConfig` interface values instead of hardcoded constants

---

**Document Status**: Ready for Implementation (HAL-Aligned)  
**Next Step**: Start with Step 8.15.1 (VIC-II Timing in `hardware/c64/`)