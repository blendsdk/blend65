# Requirements: Size-Opt Duplicate Label Fix

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Bug Description

When the ASM-IL optimizer runs multiple iterations (z-levels: O1z, Oz, O3z with `maxIterations: 5`), the `SizeOptPass` generates duplicate `.factored_N` labels, causing ACME to fail with "Symbol already defined".

### Reproduction

```bash
./scripts/diag_app.sh examples/armenian-charset/main.blend
```

**O1z ACME errors:**
```
Error - line 511: Symbol already defined.
Error - line 520: Symbol already defined.
Error - line 530: Symbol already defined.
Error - line 540: Symbol already defined.
```

**Output shows 5 separate `_factored_routines` sections, each with `.factored_0`:**
```asm
; --- Section: _factored_routines ---     ; iteration 1
.factored_0
  ...
; --- Section: _factored_routines ---     ; iteration 2
.factored_0                               ; DUPLICATE!
  ...
```

## Functional Requirements

### Must Have

- [ ] No duplicate labels across optimizer iterations
- [ ] z-levels (O1z, Oz, O3z) produce valid assembly for armenian-charset
- [ ] All existing tests continue to pass

### Should Have

- [ ] Factored routines consolidated into single `_factored_routines` section
- [ ] Clean, deterministic label naming

### Won't Have (Out of Scope)

- Changing the "one candidate per iteration" design
- Changing the tail-call optimization
- Performance optimizations to the factoring algorithm

## Acceptance Criteria

1. [ ] `diag_app examples/armenian-charset/main.blend` passes all 10 optimization levels
2. [ ] All 9364+ tests pass
3. [ ] No duplicate label errors from ACME at any optimization level
