# Testing Strategy: Armenian Charset Example

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

This is an **example program**, not a compiler feature. Testing focuses on:
1. Successful compilation at all optimization levels
2. Successful ACME assembly at all levels
3. No size regressions across optimization levels
4. No compiler test suite regressions

### Coverage Goals

- Compilation: 10/10 optimization levels pass
- Assembly: 10/10 optimization levels assemble
- Regression: 0 existing test failures introduced

## Test Categories

### Compilation Verification (via diag_app)

| Test | Description | Priority |
|------|-------------|----------|
| Compile O0 | Baseline compilation succeeds | High |
| Compile O1-O3z | All optimization levels compile | High |
| Assemble O0 | ACME produces valid .prg | High |
| Assemble O1-O3z | All levels assemble | High |
| No size regression | Optimized ≤ unoptimized PRG size | Medium |

### Compiler Test Suite (regression check)

| Test | Description | Priority |
|------|-------------|----------|
| Full test suite | All 9205+ tests still pass | High |
| No new failures | Zero regressions from this change | High |

## Verification Commands

### Primary Verification: diag_app

```bash
# Run full diagnostic at all 10 optimization levels
./scripts/diag_app.sh examples/armenian-charset/main.blend
```

**Expected output:**
- All 10 levels: ✅ PASS for both Blend65 and ACME
- PRG sizes reasonable (~2600-3000 bytes)
- No level produces larger output than O0

### Regression Check: Full Test Suite

```bash
# Ensure no compiler regressions
./compiler-test
```

**Expected output:**
- 9205+ tests passing
- 0 failures
- 0 new skips

## Verification Checklist

- [ ] `diag_app` runs successfully for armenian-charset example
- [ ] All 10 optimization levels compile (Blend65 PASS)
- [ ] All 10 optimization levels assemble (ACME PASS)
- [ ] No size regressions (optimized ≤ O0)
- [ ] Full compiler test suite passes (no regressions)
- [ ] Assembly output looks reasonable (contains charset data, screen writes)
