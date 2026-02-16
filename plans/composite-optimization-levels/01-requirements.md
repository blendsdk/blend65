# Requirements: Composite Optimization Levels

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

Expand the Blend65 optimization system from 6 mutually exclusive levels to 10 levels
using a two-dimensional model: aggressiveness (O1/O2/O3) × goal (speed/size/min-size).

## Functional Requirements

### Must Have

- [ ] 4 new optimization levels: O1s, O1z, O3s, O3z
- [ ] Each new level has correct pass configuration for both IL and AsmIL optimizers
- [ ] `O2s` accepted as silent alias for `Os`, `O2z` for `Oz`
- [ ] `O0s` and `O0z` rejected with clear error message
- [ ] CLI `--help` shows all 10 levels with clear two-dimensional explanation
- [ ] CLI accepts new level values via `-O` flag (e.g., `-O 1s`, `-O 3z`)
- [ ] `diag_app.sh` tests all 10 viable levels
- [ ] All existing tests continue to pass
- [ ] New tests for each new optimization level

### Should Have

- [ ] CLI help presents the mental model clearly (base + modifier)
- [ ] `diag_app.sh` generates diffs for all 10 levels vs O0

### Won't Have (Out of Scope)

- Per-pass enable/disable CLI flags (e.g., `--enable-pass size-opt`)
- Arbitrary pass combination testing
- Changes to the actual optimization pass implementations
- New optimization passes

## Technical Requirements

### Backward Compatibility

- All existing 6 levels (O0, O1, O2, O3, Os, Oz) must work identically
- No changes to existing pass behavior or configurations
- `blend65.json` files using existing levels continue to work

### Size Goal Rules

The `s`/`z` suffix modifies behavior consistently:

1. **Disables function inlining** (inlining increases code size)
2. **Disables loop unrolling** (unrolling increases code size)
3. **Enables SizeOpt pass** in AsmIL optimizer
4. **Enables ZP promotion** with 4 slots (ZP instructions are 1 byte smaller)
5. **`z` additionally enables multi-iteration** (more optimization passes = smaller code)

### Invalid Combination Rules

| Input | Action | Reason |
|-------|--------|--------|
| O0s | Error: "Size optimization requires at least O1" | No passes to optimize |
| O0z | Error: "Size optimization requires at least O1" | No passes to optimize |
| O2s | Silently normalize to Os | Backward-compatible alias |
| O2z | Silently normalize to Oz | Backward-compatible alias |

## Scope Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Alias handling | Reject O2s/O2z, Accept as alias, Warn | Accept silently | Principle of least surprise |
| O1s/O1z ZP slots | No ZP, 4 ZP slots | 4 ZP slots | ZP instructions serve size goal |
| Invalid combos | Silent ignore, Warning, Error | Error | Fail fast, clear DX |
| CLI flag format | `-O1s`, `-O 1s`, `--optimization O1s` | All three | Flexibility for developer |

## Acceptance Criteria

1. [ ] All 10 optimization levels compile programs correctly
2. [ ] CLI accepts and validates all level inputs
3. [ ] Invalid combinations produce clear error messages
4. [ ] `diag_app.sh` tests all 10 levels
5. [ ] All existing 8963+ tests pass
6. [ ] New tests for each new level (config, IL, AsmIL, CLI)
7. [ ] CLI `--help` clearly documents all levels
