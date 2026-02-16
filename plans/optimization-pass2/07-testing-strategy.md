# Testing Strategy: Optimization Pass 2

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: All new patterns and edge cases covered
- Integration tests: spinning-line compile at all 10 levels
- E2E tests: PRG size comparisons before/after

## Test Categories

### Fix 1: SHR_WORD_LO Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| SHR_WORD_LO N=3 | Verify shift-left technique for N=3 produces correct result | High |
| SHR_WORD_LO N=4 | Verify for N=4 | High |
| SHR_WORD_LO N=5 | Verify for N=5 | High |
| SHR_WORD_LO N=6 | Verify for N=6 (spinning-line case) | High |
| SHR_WORD_LO N=7 | Verify for N=7 | High |
| SHR_WORD(N)+LO peephole N=3-7 | Verify IL peephole replaces with SHR_WORD_LO | High |
| SHR_WORD(N)+LO N=1-2 not replaced | Verify N=1,2 are NOT optimized | High |
| SHR_WORD without LO | Verify standalone SHR_WORD is NOT transformed | High |
| SHR_WORD(N≥8)+LO | Verify existing HI+SHR_BYTE still works (no regression) | High |
| Codegen byte count N=6 | Verify assembly is ~8 bytes, not 36 | Medium |

### Fix 2: Profitable Inlining Unit Tests

| Test | Description | Priority |
|------|-------------|----------|
| Single-call inlined at Os | Single-call-site function is inlined at Os | High |
| Single-call inlined at Oz | Same for Oz | High |
| Multi-call NOT inlined at Os (>4 instrs) | Large function not inlined at Os | High |
| Multi-call inlined at Os (≤4 instrs) | Tiny function inlined at Os | Medium |
| O2/O3 behavior unchanged | Existing O2/O3 inlining not affected | High |
| DFE after inlining at Os | Fully-inlined function removed | Medium |

### Fix 3: IL Peephole at O1

| Test | Description | Priority |
|------|-------------|----------|
| il-peephole runs at O1 | Verify pass is in O1 function passes | High |
| Store/reload eliminated at O1 | STORE_WORD+LOAD_WORD pair removed after inlining | High |
| Existing O1 tests pass | No regression in O1 behavior | High |
| O0 unchanged | O0 still has no optimization | Medium |

### Fix 4: Copy Propagation Through Inline Labels

| Test | Description | Priority |
|------|-------------|----------|
| Forward through inline cont label | Copy-prop forwards slot through `_inline_*_cont` label | High |
| Kill at regular label | Copy-prop still kills state at non-inline labels | High |
| Kill at loop label | Copy-prop kills at loop headers | High |
| Forward multiple slots | Multiple params forwarded through same inline label | Medium |
| Forward invalidated by write | Slot write between store and use kills forwarding | High |

### Fix 5: Constant Propagation Through Inline Labels

| Test | Description | Priority |
|------|-------------|----------|
| Propagate through inline cont label | Const-prop propagates constant through `_inline_*_cont` label | High |
| Kill at regular label | Const-prop still kills at non-inline labels | High |
| Propagate constant 0 → identity elim | LOAD_IMM 0 + STORE + ... + ADD → ADD_IMM 0 → removed | High |
| Multiple constants propagated | Multiple params with known constants | Medium |
| Constant killed by overwrite | Slot overwritten between store and use kills constant | High |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| spinning-line all levels | Full pipeline | Compile at all 10 levels, all PASS |
| spinning-line O2 size | Codegen + optimizer | O2 PRG ≤ O0 PRG (no size regression) |
| spinning-line Os size | Inliner + peephole | Os PRG ≤ O1 PRG |
| balloon-sprite all levels | Full pipeline | No regressions on secondary benchmark |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Size regression eliminated | Compile spinning-line at O0 and O2 | O2 ≤ O0 bytes |
| Os benefits from inlining | Compile at Os with new profitable inlining | Os has LOAD_ADDRESS_EXPR in output |
| O3 constant elimination | Compile at O3 | No ADC of known-0 param in output |

## Verification Checklist

- [ ] All new unit tests pass
- [ ] All 9100+ existing tests pass
- [ ] spinning-line: O2 PRG ≤ O0 PRG
- [ ] spinning-line: Os PRG ≤ O1 PRG
- [ ] `diag_app spinning-line` — no REDUN/MISSOPT at O2+
- [ ] balloon-sprite: all 10 levels PASS
- [ ] No warnings/errors in compiler output
