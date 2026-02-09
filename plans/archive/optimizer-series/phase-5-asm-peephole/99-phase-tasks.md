# Phase 5: ASM Peephole - Task Checklist

> **Document**: 99-phase-tasks.md  
> **Phase**: 5 of 7  
> **Sessions**: ~5-6  
> **Total Tests**: ~287  
> **Milestone**: **main.asm redundant instructions ELIMINATED!** ✅

---

## Overview

This document contains the complete task breakdown for Phase 5: ASM Peephole optimization. This phase implements 6502-specific patterns that directly fix the poor code quality in the current compiler output.

**THIS PHASE FIXES main.asm!**

---

## Session Structure

| Session | Focus | Tests | Est. Time |
|---------|-------|-------|-----------|
| 5.1 | Pattern Framework + Load-Store Core | ~60 | 45 min |
| 5.2 | Load-Store Patterns Complete | ~50 | 40 min |
| 5.3 | Flag Patterns (CLC/SEC/Zero) | ~50 | 40 min |
| 5.4 | Branch Patterns | ~57 | 40 min |
| 5.5 | Transfer Patterns | ~55 | 35 min |
| 5.6 | Integration + main.asm verification | ~15 | 30 min |

**Total: ~287 tests across 6 sessions**

---

## Session 5.1: Pattern Framework + Load-Store Core

**Reference**: [02-load-store-asm.md](02-load-store-asm.md)

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.1.1 | Create ASM pattern base types | `asm-il/optimizer/types.ts` | 5 |
| 5.1.2 | Implement AsmPeepholeEngine | `asm-il/optimizer/peephole-engine.ts` | 15 |
| 5.1.3 | Create AsmPatternRegistry | `asm-il/optimizer/pattern-registry.ts` | 10 |
| 5.1.4 | Implement StoreLoadEliminationPattern | `asm-il/optimizer/passes/load-store.ts` | 20 |
| 5.1.5 | Implement DeadLoadPattern | `asm-il/optimizer/passes/load-store.ts` | 10 |

### Deliverables

- [ ] ASM peephole engine operational
- [ ] Store-Load elimination working (**fixes STA $50; LDA $50**)
- [ ] Dead load elimination working (**fixes LDA _data; LDA #$05**)
- [ ] 60 tests passing

### Verification

```bash
./compiler-test asm-il/optimizer
```

---

## Session 5.2: Load-Store Patterns Complete

**Reference**: [02-load-store-asm.md](02-load-store-asm.md)

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.2.1 | Implement RedundantLoadPattern | `asm-il/optimizer/passes/load-store.ts` | 15 |
| 5.2.2 | Implement DeadStorePattern | `asm-il/optimizer/passes/load-store.ts` | 12 |
| 5.2.3 | Implement StoreLoadXPattern | `asm-il/optimizer/passes/load-store-xy.ts` | 10 |
| 5.2.4 | Implement StoreLoadYPattern | `asm-il/optimizer/passes/load-store-xy.ts` | 10 |
| 5.2.5 | Implement volatility detection | `asm-il/optimizer/volatility.ts` | 8 |

### Deliverables

- [ ] All load-store patterns complete
- [ ] X/Y register patterns working
- [ ] Hardware register volatility respected
- [ ] 50 tests passing (110 cumulative)

### Verification

```bash
./compiler-test asm-il/optimizer/load-store
```

---

## Session 5.3: Flag Patterns

**Reference**: [01-flag-patterns.md](01-flag-patterns.md)

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.3.1 | Implement RedundantCmpZeroPattern | `asm-il/optimizer/passes/zero-flag.ts` | 15 |
| 5.3.2 | Implement RedundantClcPattern | `asm-il/optimizer/passes/redundant-clc.ts` | 8 |
| 5.3.3 | Implement DeadClcPattern | `asm-il/optimizer/passes/redundant-clc.ts` | 12 |
| 5.3.4 | Implement RedundantSecPattern | `asm-il/optimizer/passes/redundant-sec.ts` | 8 |
| 5.3.5 | Implement DeadSecPattern | `asm-il/optimizer/passes/redundant-sec.ts` | 12 |

### Deliverables

- [ ] CMP #0 removal after zero-flag setters
- [ ] Redundant CLC/SEC removal
- [ ] Dead CLC/SEC detection
- [ ] 50 tests passing (160 cumulative)

### Verification

```bash
./compiler-test asm-il/optimizer/flag
```

---

## Session 5.4: Branch Patterns

**Reference**: [03-branch-patterns.md](03-branch-patterns.md)

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.4.1 | Implement BranchChainPattern | `asm-il/optimizer/passes/branch-chain.ts` | 12 |
| 5.4.2 | Implement ConditionalBranchChainPattern | `asm-il/optimizer/passes/branch-chain.ts` | 10 |
| 5.4.3 | Implement UnreachableCodePattern | `asm-il/optimizer/passes/unreachable.ts` | 15 |
| 5.4.4 | Implement BranchInversionPattern | `asm-il/optimizer/passes/branch-invert.ts` | 12 |
| 5.4.5 | Implement BranchOverNopPattern | `asm-il/optimizer/passes/branch-invert.ts` | 8 |

### Deliverables

- [ ] Branch chain collapse working
- [ ] Unreachable code elimination
- [ ] Branch inversion optimization
- [ ] 57 tests passing (217 cumulative)

### Verification

```bash
./compiler-test asm-il/optimizer/branch
```

---

## Session 5.5: Transfer Patterns

**Reference**: [04-transfer-patterns.md](04-transfer-patterns.md)

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.5.1 | Implement RoundTripTransferPattern | `asm-il/optimizer/passes/transfer-redundant.ts` | 12 |
| 5.5.2 | Implement DuplicateTransferPattern | `asm-il/optimizer/passes/transfer-redundant.ts` | 8 |
| 5.5.3 | Implement LoadTransferPattern | `asm-il/optimizer/passes/transfer-combine.ts` | 15 |
| 5.5.4 | Implement TransferStorePattern | `asm-il/optimizer/passes/transfer-combine.ts` | 12 |
| 5.5.5 | Implement StackTransferPattern | `asm-il/optimizer/passes/transfer-stack.ts` | 8 |

### Deliverables

- [ ] Round-trip transfer elimination
- [ ] Load+transfer → direct load
- [ ] Transfer+store → direct store
- [ ] 55 tests passing (272 cumulative)

### Verification

```bash
./compiler-test asm-il/optimizer/transfer
```

---

## Session 5.6: Integration + main.asm Verification

**Reference**: All Phase 5 documents

### Tasks

| # | Task | File(s) | Tests |
|---|------|---------|-------|
| 5.6.1 | Register all patterns in registry | `asm-il/optimizer/index.ts` | 5 |
| 5.6.2 | Create O1/O2/O3 presets for ASM | `asm-il/optimizer/presets.ts` | 5 |
| 5.6.3 | Integration tests with real code | `__tests__/asm-il/optimizer/integration.test.ts` | 10 |
| 5.6.4 | **Verify main.asm optimization** | `__tests__/e2e/main-asm-optimization.test.ts` | 5 |
| 5.6.5 | Performance benchmarks | `__tests__/asm-il/optimizer/benchmark.test.ts` | 5 |

### Deliverables

- [ ] All patterns registered and active
- [ ] Optimization levels configured
- [ ] **main.asm produces clean output** ✅
- [ ] 15 tests passing (287 total)

### Verification

```bash
# Full test suite
./compiler-test

# Compile example and verify output
yarn blend65 compile examples/simple/main.blend -o build/main.asm
cat build/main.asm  # Should be clean!
```

---

## Complete Task Checklist

### Session 5.1: Pattern Framework + Load-Store Core
- [ ] 5.1.1 Create ASM pattern base types
- [ ] 5.1.2 Implement AsmPeepholeEngine
- [ ] 5.1.3 Create AsmPatternRegistry
- [ ] 5.1.4 Implement StoreLoadEliminationPattern
- [ ] 5.1.5 Implement DeadLoadPattern

### Session 5.2: Load-Store Patterns Complete
- [ ] 5.2.1 Implement RedundantLoadPattern
- [ ] 5.2.2 Implement DeadStorePattern
- [ ] 5.2.3 Implement StoreLoadXPattern
- [ ] 5.2.4 Implement StoreLoadYPattern
- [ ] 5.2.5 Implement volatility detection

### Session 5.3: Flag Patterns
- [ ] 5.3.1 Implement RedundantCmpZeroPattern
- [ ] 5.3.2 Implement RedundantClcPattern
- [ ] 5.3.3 Implement DeadClcPattern
- [ ] 5.3.4 Implement RedundantSecPattern
- [ ] 5.3.5 Implement DeadSecPattern

### Session 5.4: Branch Patterns
- [ ] 5.4.1 Implement BranchChainPattern
- [ ] 5.4.2 Implement ConditionalBranchChainPattern
- [ ] 5.4.3 Implement UnreachableCodePattern
- [ ] 5.4.4 Implement BranchInversionPattern
- [ ] 5.4.5 Implement BranchOverNopPattern

### Session 5.5: Transfer Patterns
- [ ] 5.5.1 Implement RoundTripTransferPattern
- [ ] 5.5.2 Implement DuplicateTransferPattern
- [ ] 5.5.3 Implement LoadTransferPattern
- [ ] 5.5.4 Implement TransferStorePattern
- [ ] 5.5.5 Implement StackTransferPattern

### Session 5.6: Integration + Verification
- [ ] 5.6.1 Register all patterns in registry
- [ ] 5.6.2 Create O1/O2/O3 presets for ASM
- [ ] 5.6.3 Integration tests with real code
- [ ] 5.6.4 **Verify main.asm optimization**
- [ ] 5.6.5 Performance benchmarks

---

## Directory Structure After Phase 5

```
packages/compiler/src/asm-il/optimizer/
├── index.ts                      # Main exports
├── types.ts                      # ASM pattern types
├── peephole-engine.ts            # AsmPeepholeEngine
├── pattern-registry.ts           # AsmPatternRegistry
├── presets.ts                    # O1/O2/O3 configurations
├── volatility.ts                 # Hardware register detection
└── passes/
    ├── index.ts                  # Pass exports
    ├── load-store.ts             # STA/LDA patterns
    ├── load-store-xy.ts          # STX/LDX, STY/LDY patterns
    ├── zero-flag.ts              # CMP #0 elimination
    ├── redundant-clc.ts          # CLC patterns
    ├── redundant-sec.ts          # SEC patterns
    ├── branch-chain.ts           # JMP chain collapse
    ├── unreachable.ts            # Dead code elimination
    ├── branch-invert.ts          # Branch inversion
    ├── transfer-redundant.ts     # TAX/TXA patterns
    ├── transfer-combine.ts       # LDA+TAX → LDX patterns
    └── transfer-stack.ts         # TSX/TXS patterns

packages/compiler/src/__tests__/asm-il/optimizer/
├── peephole-engine.test.ts
├── pattern-registry.test.ts
├── load-store.test.ts
├── flag-patterns.test.ts
├── branch-patterns.test.ts
├── transfer-patterns.test.ts
├── integration.test.ts
└── benchmark.test.ts
```

---

## Success Criteria

### Functional Requirements

- [ ] Store-Load elimination removes `STA $x; LDA $x` patterns
- [ ] Dead load elimination removes `LDA x; LDA y` patterns
- [ ] CMP #0 removed after zero-flag setters
- [ ] Branch chains collapsed
- [ ] Unreachable code eliminated
- [ ] Transfer redundancies removed

### Performance Requirements

- [ ] Optimization runs in < 100ms for typical modules
- [ ] Fixed-point iteration converges in ≤ 5 passes
- [ ] Memory usage < 50MB for large modules

### Quality Requirements

- [ ] 287+ tests passing
- [ ] No semantic changes to optimized code
- [ ] All optimizations preserve program behavior
- [ ] Hardware register volatility respected

### **THE BIG ONE**

- [ ] **main.asm no longer contains redundant instructions!**

---

## Expected main.asm Output After Phase 5

### Before (Current Broken Output)

```asm
; main.asm - BEFORE optimization
    LDA _data           ; DEAD - immediately overwritten
    LDA #$05            ; v2 = 5
    STA $50             ; Store len
    LDA $50             ; REDUNDANT - A already has $05
    STA $D020           ; Set border color
```

### After (Clean Output)

```asm
; main.asm - AFTER Phase 5 optimization
    LDA #$05            ; v2 = 5
    STA $50             ; Store len
    STA $D020           ; Set border color (A still = $05)
```

**2 instructions removed, 6+ cycles saved!**

---

## Dependencies

### From Previous Phases

- Phase 4: Pattern framework architecture (reused for ASM)
- Phase 4: Pattern registry concept (adapted for ASM)

### From Existing Codebase

- `AsmModule`, `AsmInstruction` types
- `AsmOpcode` enum
- ASM-IL layer infrastructure

---

## Session Protocol

### Starting a Session

```bash
# 1. Switch to dev mode
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Session 5.X per plans/optimizer-series/phase-5-asm-peephole/99-phase-tasks.md"
```

### Ending a Session

```bash
# 1. Run tests
./compiler-test asm-il/optimizer

# 2. Switch to completion mode
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Phase Completion Verification

When Phase 5 is complete:

```bash
# 1. Run full test suite
./compiler-test

# 2. Compile example
yarn blend65 compile examples/simple/main.blend -o build/main.asm

# 3. Verify clean output
cat build/main.asm | grep -v "^;"  # Should show only necessary instructions

# 4. No redundant patterns should exist:
#    - No LDA immediately after LDA
#    - No LDA after STA to same address
#    - No duplicate CLC/SEC
#    - No unreachable code after JMP/RTS
```

---

**Parent Document**: [Phase Index](00-phase-index.md)  
**Previous Document**: [04 - Transfer Patterns](04-transfer-patterns.md)  
**Next Phase**: [Phase 6: 6502 Specific](../phase-6-6502-specific/00-phase-index.md)