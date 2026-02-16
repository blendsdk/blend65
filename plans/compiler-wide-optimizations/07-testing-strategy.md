# Testing Strategy: Compiler-Wide Optimization Initiative

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- All existing unit/integration/e2e tests pass (zero regressions)
- New test programs compile and assemble at ALL 6 optimization levels
- `diag_app` produces clean reports for spinning-line and balloon-sprite
- Negative tests verify unsafe optimizations are NOT applied

## Test Programs

### Existing Benchmarks

| Program | Primary Themes Tested | Status |
|---------|----------------------|--------|
| `examples/spinning-line/main.blend` | A, C, F, G, H, J | Existing ✅ |
| `examples/balloon-sprite/main.blend` | A, F, H | Existing ✅ |

### New Test Programs to Create

#### 1. `examples/counter-wrap/main.blend` — Theme C (modulo→bitmask)

Tests multiple power-of-2 wrap patterns (mod 2, 4, 8, 16) AND a non-power-of-2 case (mod 5) as a negative test. Verifies AND bitmask is applied for power-of-2 and NOT applied for mod 5.

#### 2. `examples/loop-patterns/main.blend` — Theme H (for-loop register promotion)

Tests various for-loop patterns: byte count-up, word count-up, nested loops, loops with function calls in body. Verifies register promotion works across loop types.

#### 3. `examples/multi-sprite/main.blend` — Themes A, C, F combined

Tests multiple sprite animations with different frame counts, multiple calls to a shared `setSpriteFrame()` function. Stresses inliner parameter handling and label arithmetic folding across multiple call sites.

## Verification Strategy

### Per-Theme Verification

| Theme | How to Verify |
|-------|---------------|
| **CG** | Check O0 assembly for SHR_WORD: shift≥8 should use TXA pattern, not PHA/TXA/LSR loop |
| **A** | Check O1+ assembly: `@var / 64` through inlined params should emit `LDA #(label/64)` |
| **C** | Check O1+ assembly: increment-compare-reset with N=4 should emit `AND #$03`, NOT with N=5 |
| **F** | Check O1+ assembly: inlined params should NOT have STA/LDA to same address consecutively |
| **H** | Check O1+ assembly: simple byte for-loops should use DEX/BNE or DEY/BNE, not INC/CMP/JMP |
| **G** | Check O1+ assembly: `lo(word >> N)` should NOT emit full 16-bit shift when N≥8 |
| **J** | Check O1+ assembly: inlined call with literal 0 arg should not emit ADD with 0 |

### Diagnostic Verification

After each phase, run:
```bash
./scripts/diag_app.sh examples/spinning-line/main.blend
./scripts/diag_app.sh examples/balloon-sprite/main.blend
```

Verify:
1. All 6 optimization levels compile and assemble successfully
2. Assembly quality improves (fewer bytes, fewer redundant patterns)
3. No new redundancies introduced

### Regression Testing

After every change:
```bash
./compiler-test
```

All 6500+ existing tests must pass.

## Unit Tests

### New Unit Tests to Add

| Test | Description | File |
|------|-------------|------|
| IL peephole: modulo bitmask | Verify ADD+CMP+JUMP_NE+LOAD+STORE → ADD+AND+STORE for N=2,4,8 | `__tests__/optimizer/il-peephole-modulo.test.ts` |
| IL peephole: modulo negative | Verify mod 5 is NOT replaced with AND | Same file |
| IL peephole: store/reload word | Verify STORE_WORD+LOAD_WORD elimination | `__tests__/optimizer/il-peephole-store-reload.test.ts` |
| IL peephole: address expr fold | Verify LOAD_ADDRESS+SHR_WORD → LOAD_ADDRESS_EXPR | `__tests__/optimizer/il-peephole-addr-fold.test.ts` |
| Codegen: SHR_WORD shift≥8 | Verify shift-by-8 emits TXA, not 8×(PHA/TXA/LSR/TAX/PLA/ROR) | `__tests__/codegen/shr-word-quality.test.ts` |

### End-to-End Tests

| Test | Description |
|------|-------------|
| Spinning-line all levels | Compile at O0-Oz, verify ACME assembles, check for known patterns |
| Balloon-sprite all levels | Same as above |
| New test programs all levels | Compile each new example at all 6 levels |

## Acceptance Checklist

- [ ] `./compiler-test` passes (zero regressions)
- [ ] `diag_app spinning-line` — clean at all 6 levels
- [ ] `diag_app balloon-sprite` — clean at all 6 levels  
- [ ] New test programs compile at all 6 levels
- [ ] Theme C negative test: mod 5 NOT optimized
- [ ] Assembly output visually inspected for key patterns
