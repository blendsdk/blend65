# Testing Strategy: O3 Address-Expr Folding Regression Fix

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests for each new pattern variant (positive + negative)
- Integration tests via `diag_app` for real-world verification
- Full regression test: `./compiler-test` (9204+ tests)

## Test Categories

### Unit Tests — Address-Expr Store-Gap Pattern (Phase 1)

| Test | Description | Priority |
|------|-------------|----------|
| Store-gap matches 4-instr sequence | `LOAD_ADDRESS, STORE_WORD(dead), SHR_WORD 6, LO` → `LOAD_ADDRESS_EXPR` | High |
| Store-gap with different shift counts | N=1..8 to verify all valid shifts | High |
| Store-gap skips when slot is live | `STORE_WORD x` followed by later `LOAD_WORD x` → no fold | High |
| Store-gap skips when STORE not WORD | `STORE_BYTE` between LOAD_ADDRESS and SHR_WORD → no match | Medium |
| Store-gap skips when not STORE_WORD | Random instruction between LOAD_ADDRESS and SHR_WORD → no match | Medium |
| Direct pattern still works | Existing `LOAD_ADDRESS, SHR_WORD, LO` → `LOAD_ADDRESS_EXPR` unchanged | High |
| Gap pattern still works | Existing `LOAD_ADDRESS, STORE_WORD, LOAD_WORD, SHR_WORD, LO` unchanged | High |

### Unit Tests — Load-Store Inline Label Elimination (Phase 2)

| Test | Description | Priority |
|------|-------------|----------|
| STORE_WORD/LABEL/LOAD_WORD elimination | `STORE_WORD x; LABEL _inline_*_cont; LOAD_WORD x` → remove LOAD_WORD | High |
| STORE_BYTE/LABEL/LOAD_BYTE elimination | `STORE_BYTE x; LABEL _inline_*_cont; LOAD_BYTE x` → remove LOAD_BYTE | High |
| Skips non-inline labels | `STORE_WORD x; LABEL regular_label; LOAD_WORD x` → no elimination | High |
| Skips mismatched slots | `STORE_WORD x; LABEL _inline_*_cont; LOAD_WORD y` → no elimination | High |
| Existing consecutive patterns unaffected | `STORE_WORD x; LOAD_WORD x` (no label) still eliminated | High |

### Integration Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| spinning-line O3 | `diag_app spinning-line` | O3 PRG ≤ 385 B |
| spinning-line all levels | `diag_app spinning-line` | All 10 levels pass |
| balloon-sprite all levels | `diag_app balloon-sprite` | All 10 levels pass |

## Verification Checklist

- [ ] All new unit tests pass
- [ ] All existing tests pass (`./compiler-test`, 9204+ tests)
- [ ] O3 spinning-line ≤ 385 B
- [ ] No regressions at O0, O1, O2, Os, Oz, O3z
- [ ] `diag_app` clean for both example apps
