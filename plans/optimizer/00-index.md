# God-Level Optimizer Implementation Plan - Master Index

> **Status**: Implementation Plan (v1.0 - God-Level Production Quality)  
> **Date**: January 22, 2026  
> **Priority**: CRITICAL - Core Compiler Component  
> **Estimated Time**: ~200+ hours (~12-14 weeks)  
> **Prerequisites**: IL Generator with SSA (COMPLETE ✅)

---

## 🚨 MANDATORY: Unified Test Plan

**BEFORE implementing any phase, read:**
- [OPTIMIZER-UNIFIED-TEST-PLAN.md](OPTIMIZER-UNIFIED-TEST-PLAN.md) - **SINGLE SOURCE OF TRUTH for ALL testing**

This unified document:
- Maps tests to specific phases and test files
- Includes ~4,000+ tests (Regular + Extreme + Fuzzing)
- Contains code.md compliance requirements
- Provides clear phase → test file mapping

---

## Executive Summary

This document series provides a **god-level, production-quality implementation plan** for the Blend65 Optimizer. The optimizer is the **heart of the compiler** - a failure here means the entire project produces suboptimal code that can't compete with hand-written assembly.

### Why "God-Level" Optimizer?

The 6502 is an extremely constrained architecture:
- **Only 3 general-purpose registers** (A, X, Y)
- **256-byte stack limit**
- **256-byte zero page** (precious fast memory)
- **Limited addressing modes**
- **No hardware multiply/divide**
- **Cycle-critical timing** (raster effects, audio sync)

A god-level optimizer must:
1. **Match or beat hand-tuned assembly** in common cases
2. **Exploit every 6502 quirk** (carry flag, zero flag, decimal mode)
3. **Respect hardware timing** (raster windows, IRQ handlers)
4. **Support multiple optimization levels** (-O0 to -O3, -Os, -Oz)
5. **Be extensible** for future targets (C128, X16, Atari)
6. **Have exhaustive test coverage** (every edge case)

### Inspiration Sources

This optimizer draws from the best production compilers:

| Source | What We Take |
|--------|--------------|
| **GCC** | SSA passes, RTL optimizations, interprocedural analysis |
| **LLVM** | Pass manager architecture, instruction combining, GVN |
| **Rust/MIR** | Move semantics, escape analysis, inline cost model |
| **cc65** | 6502-specific wisdom, zero-page strategies, peephole patterns |
| **V8** | Escape analysis, allocation sinking |
| **Turbo Pascal** | Blazing fast compilation for development mode |

---

## Document Structure

This plan is split into focused documents for manageability:

| Document | Description | Tasks | Est. Time |
|----------|-------------|-------|-----------|
| [01-architecture.md](01-architecture.md) | Pass Manager & Infrastructure | 8 | ~16 hr |
| [02-analysis-passes.md](02-analysis-passes.md) | Analysis Passes (no transforms) | 12 | ~24 hr |
| [03-classical-optimizations.md](03-classical-optimizations.md) | DCE, ConstProp, CopyProp, CSE | 10 | ~20 hr |
| [04-control-flow.md](04-control-flow.md) | CFG Optimizations | 8 | ~16 hr |
| [05-loop-optimizations.md](05-loop-optimizations.md) | Loop Transforms | 10 | ~20 hr |
| [06-register-allocation.md](06-register-allocation.md) | 6502 Register Allocation | 8 | ~20 hr |
| [07-6502-specific.md](07-6502-specific.md) | 6502-Specific Optimizations | 14 | ~28 hr |
| [08-peephole.md](08-peephole.md) | Pattern-Based Peephole | 12 | ~24 hr |
| [09-target-specific.md](09-target-specific.md) | C64/C128/X16 Specifics | 8 | ~16 hr |
| [10-smc-optimizations.md](10-smc-optimizations.md) | Self-Modifying Code (opt-in) | 6 | ~12 hr |
| [11-testing.md](11-testing.md) | Test Strategy & Validation | 6 | ~12 hr |
| **TOTAL** | | **102** | **~208 hr** |

---

## Optimization Level Philosophy

### Level Definitions

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    OPTIMIZATION LEVELS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ -O0 (None)     │ No optimization, fastest compile, for debugging        │
│                │ - Direct IL → assembly translation                      │
│                │ - All debug info preserved                              │
│                │ - Compile time: < 0.1s per 1000 lines                  │
├─────────────────────────────────────────────────────────────────────────┤
│ -O1 (Basic)    │ Quick wins, minimal compile time impact                │
│                │ - Dead code elimination                                 │
│                │ - Constant folding & propagation                        │
│                │ - Copy propagation                                      │
│                │ - Compile time: < 0.5s per 1000 lines                  │
├─────────────────────────────────────────────────────────────────────────┤
│ -O2 (Standard) │ Production-ready optimization (DEFAULT for release)    │
│                │ - All -O1 optimizations                                 │
│                │ - Common subexpression elimination                      │
│                │ - Strength reduction                                    │
│                │ - Loop invariant code motion                            │
│                │ - Basic register allocation                             │
│                │ - Peephole optimization                                 │
│                │ - Compile time: < 2s per 1000 lines                    │
├─────────────────────────────────────────────────────────────────────────┤
│ -O3 (Aggressive) │ Maximum speed, longer compile time acceptable        │
│                  │ - All -O2 optimizations                               │
│                  │ - Function inlining                                   │
│                  │ - Loop unrolling                                      │
│                  │ - Global value numbering                              │
│                  │ - Partial redundancy elimination                      │
│                  │ - Advanced register allocation                        │
│                  │ - Compile time: < 10s per 1000 lines                 │
├─────────────────────────────────────────────────────────────────────────┤
│ -Os (Size)     │ Optimize for smallest code size                        │
│                │ - Like -O2 but favors size over speed                  │
│                │ - No loop unrolling                                     │
│                │ - Aggressive code deduplication                         │
│                │ - Tail merging                                          │
│                │ - Critical for 64KB memory limit                        │
├─────────────────────────────────────────────────────────────────────────┤
│ -Oz (Min Size) │ Extreme size optimization                              │
│                │ - Like -Os but more aggressive                         │
│                │ - Sacrifice some speed for size                        │
│                │ - For extremely memory-constrained situations          │
├─────────────────────────────────────────────────────────────────────────┤
│ -Osmc (SMC)    │ Self-modifying code optimizations (opt-in)             │
│                │ - Enables SMC transforms where beneficial              │
│                │ - Requires code in RAM (not ROM)                       │
│                │ - Can achieve 20-40% speedup in loops                  │
│                │ - Off by default due to complexity                     │
├─────────────────────────────────────────────────────────────────────────┤
│ -Ozp (ZP)      │ Aggressive zero-page optimization                      │
│                │ - Maximize zero-page usage                             │
│                │ - For performance-critical code                        │
│                │ - May conflict with OS/BASIC zero-page usage           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Level → Pass Mapping

| Pass | O0 | O1 | O2 | O3 | Os | Oz |
|------|----|----|----|----|----|----|
| Dead Code Elimination | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Constant Folding | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Constant Propagation | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Copy Propagation | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CSE | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Strength Reduction | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| LICM | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Peephole | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Register Allocation | Basic | Basic | Standard | Advanced | Standard | Basic |
| Function Inlining | ❌ | ❌ | Small | Aggressive | Small | ❌ |
| Loop Unrolling | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| GVN | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| PRE | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tail Merging | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Code Deduplication | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |

---

## Optimizer Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         IL INPUT (SSA Form)                              │
│                    From IL Generator (COMPLETE ✅)                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PASS MANAGER                                     │
│  - Orchestrates all optimization passes                                  │
│  - Handles pass dependencies                                            │
│  - Manages analysis invalidation                                        │
│  - Respects optimization level                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐
│  ANALYSIS PASSES  │   │ TRANSFORM PASSES  │   │  UTILITY PASSES   │
│  (Don't modify)   │   │  (Modify IL)      │   │  (Support)        │
├───────────────────┤   ├───────────────────┤   ├───────────────────┤
│ • Dominator Tree  │   │ • DCE             │   │ • IL Printer      │
│ • Loop Info       │   │ • Const Fold      │   │ • IL Validator    │
│ • Alias Analysis  │   │ • Const Prop      │   │ • Statistics      │
│ • Liveness        │   │ • Copy Prop       │   │ • Debug Info      │
│ • Escape Analysis │   │ • CSE             │   │                   │
│ • Call Graph      │   │ • LICM            │   │                   │
│ • Memory Deps     │   │ • Reg Alloc       │   │                   │
│                   │   │ • Peephole        │   │                   │
└───────────────────┘   └───────────────────┘   └───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         IL OUTPUT (Optimized)                            │
│                      Ready for Code Generator                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure (Final)

```
packages/compiler/src/optimizer/
├── index.ts                        # Exports
├── pass-manager.ts                 # Pass orchestration
├── pass.ts                         # Pass base classes
├── options.ts                      # Optimization options
├── statistics.ts                   # Optimization statistics
├── analysis/
│   ├── index.ts                    # Analysis exports
│   ├── dominator-tree.ts           # Dominator analysis
│   ├── loop-info.ts                # Loop detection & analysis
│   ├── liveness.ts                 # Live variable analysis
│   ├── alias-analysis.ts           # Pointer/memory alias
│   ├── escape-analysis.ts          # Escape analysis
│   ├── call-graph.ts               # Call graph construction
│   ├── memory-deps.ts              # Memory dependencies
│   └── demanded-bits.ts            # Demanded bits analysis
├── transforms/
│   ├── index.ts                    # Transform exports
│   ├── dce.ts                      # Dead code elimination
│   ├── constant-fold.ts            # Constant folding
│   ├── constant-prop.ts            # Constant propagation
│   ├── copy-prop.ts                # Copy propagation
│   ├── cse.ts                      # Common subexpr elimination
│   ├── gvn.ts                      # Global value numbering
│   ├── pre.ts                      # Partial redundancy elim
│   ├── sccp.ts                     # Sparse conditional const prop
│   ├── reassociate.ts              # Expression reassociation
│   ├── simplify-cfg.ts             # CFG simplification
│   ├── unreachable.ts              # Unreachable code elim
│   ├── branch-fold.ts              # Branch folding
│   ├── tail-merge.ts               # Tail merging
│   └── inline.ts                   # Function inlining
├── loop/
│   ├── index.ts                    # Loop optimization exports
│   ├── licm.ts                     # Loop invariant code motion
│   ├── unroll.ts                   # Loop unrolling
│   ├── strength-reduce.ts          # Induction var strength red
│   ├── rotate.ts                   # Loop rotation
│   └── fusion.ts                   # Loop fusion
├── register/
│   ├── index.ts                    # Register allocation exports
│   ├── live-range.ts               # Live range computation
│   ├── interference.ts             # Interference graph
│   ├── graph-color.ts              # Graph coloring allocator
│   ├── spill.ts                    # Spill code generation
│   └── coalesce.ts                 # Register coalescing
├── m6502/
│   ├── index.ts                    # 6502-specific exports
│   ├── strength-reduce.ts          # 6502 strength reduction
│   ├── zp-promotion.ts             # Zero-page promotion
│   ├── indexed-mode.ts             # Indexed addressing opt
│   ├── flag-optimization.ts        # Carry/Zero flag optimization
│   ├── branch-distance.ts          # Branch distance optimization
│   ├── page-crossing.ts            # Page boundary optimization
│   └── decimal-mode.ts             # Decimal mode handling
├── peephole/
│   ├── index.ts                    # Peephole exports
│   ├── patterns.ts                 # Peephole pattern definitions
│   ├── matcher.ts                  # Pattern matcher
│   ├── combiner.ts                 # Instruction combiner
│   └── predefined/
│       ├── load-store.ts           # Load/store patterns
│       ├── arithmetic.ts           # Arithmetic patterns
│       ├── branch.ts               # Branch patterns
│       ├── transfer.ts             # Register transfer patterns
│       └── flag.ts                 # Flag-related patterns
├── target/
│   ├── index.ts                    # Target-specific exports
│   ├── c64.ts                      # C64 optimizations
│   ├── c128.ts                     # C128 optimizations
│   ├── x16.ts                      # Commander X16 optimizations
│   └── common.ts                   # Shared target code
└── smc/
    ├── index.ts                    # SMC exports
    ├── analyzer.ts                 # SMC opportunity detection
    ├── transformer.ts              # SMC transformation
    └── patterns.ts                 # SMC patterns
```

---

## Global Task Checklist

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| **1** | 1.1 | Create optimizer directory structure | [ ] |
| **1** | 1.2 | Define Pass base class hierarchy | [ ] |
| **1** | 1.3 | Implement PassManager | [ ] |
| **1** | 1.4 | Define OptimizationOptions | [ ] |
| **1** | 1.5 | Implement pass dependency system | [ ] |
| **1** | 1.6 | Implement analysis invalidation | [ ] |
| **1** | 1.7 | Create optimization statistics | [ ] |
| **1** | 1.8 | Implement pass pipeline builder | [ ] |
| **2** | 2.1 | Dominator tree analysis | [ ] |
| **2** | 2.2 | Loop detection & info | [ ] |
| **2** | 2.3 | Live variable analysis | [ ] |
| **2** | 2.4 | Use-def chains | [ ] |
| **2** | 2.5 | Alias analysis (basic) | [ ] |
| **2** | 2.6 | Escape analysis | [ ] |
| **2** | 2.7 | Call graph construction | [ ] |
| **2** | 2.8 | Memory dependency analysis | [ ] |
| **2** | 2.9 | Demanded bits analysis | [ ] |
| **2** | 2.10 | Loop nesting analysis | [ ] |
| **2** | 2.11 | Basic block frequency estimation | [ ] |
| **2** | 2.12 | Correlated value analysis | [ ] |
| **3** | 3.1 | Dead code elimination (DCE) | [ ] |
| **3** | 3.2 | Aggressive DCE (ADCE) | [ ] |
| **3** | 3.3 | Constant folding | [ ] |
| **3** | 3.4 | Constant propagation | [ ] |
| **3** | 3.5 | Sparse conditional const prop (SCCP) | [ ] |
| **3** | 3.6 | Copy propagation | [ ] |
| **3** | 3.7 | Common subexpression elimination | [ ] |
| **3** | 3.8 | Global value numbering (GVN) | [ ] |
| **3** | 3.9 | Partial redundancy elimination (PRE) | [ ] |
| **3** | 3.10 | Expression reassociation | [ ] |
| **4** | 4.1 | Unreachable code elimination | [ ] |
| **4** | 4.2 | Branch folding | [ ] |
| **4** | 4.3 | CFG simplification | [ ] |
| **4** | 4.4 | Tail merging | [ ] |
| **4** | 4.5 | Jump threading | [ ] |
| **4** | 4.6 | Conditional move conversion | [ ] |
| **4** | 4.7 | Cross-jumping | [ ] |
| **4** | 4.8 | Tail call optimization | [ ] |
| **5** | 5.1 | Loop invariant code motion (LICM) | [ ] |
| **5** | 5.2 | Loop unrolling | [ ] |
| **5** | 5.3 | Loop rotation | [ ] |
| **5** | 5.4 | Loop unswitching | [ ] |
| **5** | 5.5 | Induction variable optimization | [ ] |
| **5** | 5.6 | Loop strength reduction | [ ] |
| **5** | 5.7 | Loop fusion | [ ] |
| **5** | 5.8 | Loop distribution | [ ] |
| **5** | 5.9 | Loop-closed SSA form | [ ] |
| **5** | 5.10 | Loop bounds analysis | [ ] |
| **6** | 6.1 | Live range computation | [ ] |
| **6** | 6.2 | Interference graph construction | [ ] |
| **6** | 6.3 | Graph coloring allocator | [ ] |
| **6** | 6.4 | 6502 register constraints | [ ] |
| **6** | 6.5 | Spill code generation | [ ] |
| **6** | 6.6 | Register coalescing | [ ] |
| **6** | 6.7 | Rematerialization | [ ] |
| **6** | 6.8 | Live range splitting | [ ] |
| **7** | 7.1 | 6502 strength reduction (MUL→SHL) | [ ] |
| **7** | 7.2 | Zero-page promotion | [ ] |
| **7** | 7.3 | Indexed addressing optimization | [ ] |
| **7** | 7.4 | Carry flag optimization | [ ] |
| **7** | 7.5 | Zero flag optimization | [ ] |
| **7** | 7.6 | Negative flag optimization | [ ] |
| **7** | 7.7 | Branch distance optimization | [ ] |
| **7** | 7.8 | Page crossing elimination | [ ] |
| **7** | 7.9 | Decimal mode handling | [ ] |
| **7** | 7.10 | Accumulator-centric transforms | [ ] |
| **7** | 7.11 | Index register selection | [ ] |
| **7** | 7.12 | Stack frame optimization | [ ] |
| **7** | 7.13 | Self-modify opportunity detection | [ ] |
| **7** | 7.14 | Instruction scheduling | [ ] |
| **8** | 8.1 | Peephole pattern framework | [ ] |
| **8** | 8.2 | Pattern matcher implementation | [ ] |
| **8** | 8.3 | Load/store peephole patterns | [ ] |
| **8** | 8.4 | Arithmetic peephole patterns | [ ] |
| **8** | 8.5 | Branch peephole patterns | [ ] |
| **8** | 8.6 | Transfer peephole patterns | [ ] |
| **8** | 8.7 | Flag peephole patterns | [ ] |
| **8** | 8.8 | Instruction combining | [ ] |
| **8** | 8.9 | Redundant operation elimination | [ ] |
| **8** | 8.10 | Custom pattern DSL | [ ] |
| **8** | 8.11 | Pattern cost model | [ ] |
| **8** | 8.12 | Peephole ordering optimization | [ ] |
| **9** | 9.1 | C64 VIC-II timing hints | [ ] |
| **9** | 9.2 | C64 SID timing hints | [ ] |
| **9** | 9.3 | C64 raster-critical code | [ ] |
| **9** | 9.4 | C128 banking optimization | [ ] |
| **9** | 9.5 | C128 MMU utilization | [ ] |
| **9** | 9.6 | X16 VERA optimization | [ ] |
| **9** | 9.7 | X16 memory layout | [ ] |
| **9** | 9.8 | Target abstraction layer | [ ] |
| **10** | 10.1 | SMC opportunity analyzer | [ ] |
| **10** | 10.2 | SMC loop transformation | [ ] |
| **10** | 10.3 | SMC jump table transformation | [ ] |
| **10** | 10.4 | SMC safety analysis | [ ] |
| **10** | 10.5 | SMC configuration options | [ ] |
| **10** | 10.6 | SMC documentation | [ ] |
| **11** | 11.1 | Unit test framework | [ ] |
| **11** | 11.2 | Integration tests | [ ] |
| **11** | 11.3 | End-to-end tests | [ ] |
| **11** | 11.4 | Fuzzing infrastructure | [ ] |
| **11** | 11.5 | Benchmark suite | [ ] |
| **11** | 11.6 | Regression test system | [ ] |

---

## Test Coverage Targets

| Category | Tests | Coverage |
|----------|-------|----------|
| Pass Manager & Infrastructure | 200 | 100% |
| Analysis Passes | 400 | 100% |
| Classical Optimizations | 500 | 100% |
| Control Flow Optimizations | 300 | 100% |
| Loop Optimizations | 400 | 100% |
| Register Allocation | 350 | 100% |
| 6502-Specific Optimizations | 500 | 100% |
| Peephole Patterns | 600 | 100% |
| Target-Specific | 300 | 100% |
| SMC Optimizations | 200 | 100% |
| Integration & E2E | 250 | 100% |
| **TOTAL** | **~4,000** | **100%** |

---

## Implementation Priority Order

1. ✅ Read [OPTIMIZER-UNIFIED-TEST-PLAN.md](OPTIMIZER-UNIFIED-TEST-PLAN.md) FIRST
2. Then proceed with [01-architecture.md](01-architecture.md)
3. Follow phase order sequentially
4. Each phase must have all tests passing before next phase

---

## Success Criteria

### Overall Optimizer Success

- [ ] All 4,000+ tests passing
- [ ] Code quality matches or beats cc65 output
- [ ] Compile times meet level targets
- [ ] All optimization levels work correctly
- [ ] No regressions in semantics
- [ ] Documentation complete

### Performance Targets

| Metric | Target |
|--------|--------|
| -O2 code vs unoptimized | 40-60% faster |
| -O3 code vs unoptimized | 60-80% faster |
| -Os code vs unoptimized | 20-40% smaller |
| -O2 vs hand-tuned asm | Within 20% |
| Compilation speed -O0 | < 0.1s / 1000 lines |
| Compilation speed -O2 | < 2s / 1000 lines |

---

## Target Architecture Decision

> **Decision Date**: January 22, 2026  
> **Status**: CONFIRMED ✅

**Two-Target Architecture**: All heavy optimization happens at the IL level. Target emitters are simple translators.

```
Blend65 Source → Lexer → Parser → AST → IL Generator
                                          ↓
                            🔥 IL OPTIMIZATION PIPELINE 🔥
                                          ↓
                    ┌─────────────────────┴─────────────────────┐
                    ↓                                           ↓
          ACME Target (.asm)                       Native Target (.prg)
          ~500 LOC                                 ~1500 LOC
          For: libraries, integration             For: production builds
```

**Why Two Targets:**
- **ACME**: Text assembly output for library distribution, integration with existing projects, debugging
- **Native**: Direct binary output with address-aware optimizations, branch relaxation, page boundary placement

**Why Not KickAssembler**: Removed from consideration - ACME covers integration use cases sufficiently.

---

## Dependencies

```
IL Generator (COMPLETE ✅)
    ↓
Optimizer (THIS PLAN)
    ↓
Code Generator (FUTURE)
    ↓
Output (ACME .asm OR Native .prg)
```

---

**Next Document**: [01-architecture.md](01-architecture.md) - Pass Manager & Infrastructure