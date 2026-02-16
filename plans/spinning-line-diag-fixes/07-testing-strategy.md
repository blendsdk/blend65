# Testing Strategy: Spinning-Line Diagnostic Fixes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests for each specific fix
- Regression tests that prevent re-introduction of each bug
- E2E tests verifying full compilation pipeline at multiple optimization levels
- `diag_app` re-run as final acceptance test

## Test Categories

### Unit Tests

| Test | Description | Priority | Bug |
|------|-------------|----------|-----|
| CALL defUse includes param slots | Verify CALL instructions have parameter slot names in `defUse.uses` | High | #1 |
| DCE preserves param stores before CALL | Verify `isDeadStore()` returns false for stores followed by CALL that uses the slot | High | #1 |
| DCE still removes truly dead stores | Verify DCE still removes stores to unused variables (not regressed) | High | #1 |
| StoreLoadPass eliminates STA/LDA pair | Verify the pass removes `LDA $07` after `STA $07` with only `STX $08` between | High | #2 |
| StoreLoadPass eliminates STX/LDX pair | Verify the pass removes `LDX $08` after `STX $08` with only `STA $07` between | High | #2 |
| Inliner no JMP-to-next (single RETURN) | Verify inliner doesn't emit JMP to continuation when RETURN is last instruction | High | #3 |
| Inliner keeps JMP for non-final RETURN | Verify inliner still emits JMP for RETURN in middle of function body | High | #3 |

### Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| Function call param passing O1 | IL gen + DCE + codegen | Compile code with function calls at O1, verify params are passed correctly |
| Function call param passing Os | IL gen + DCE + codegen | Same test at Os level |
| Inlined function cleanup | Inliner + codegen | Compile code with inlining, verify no JMP-to-next in output |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| spinning-line O1 correctness | Compile `spinning-line` at O1, inspect assembly | `STA $02` present before `JSR getSpriteFrame` |
| spinning-line Os correctness | Compile at Os, inspect assembly | Same parameter stores preserved |
| spinning-line all-levels pass | `diag_app spinning-line` | All 6 levels pass, no REDUN bugs |
| Store/reload elimination | Compile any function with word param, inspect asm | No STA/LDA to same address pair |

## Test Data

### Fixtures Needed

**Blend source for Bug #1 regression test:**
```js
// Minimal reproduction: function with byte parameter called from 2+ sites
module TestParamStore;

function addOffset(base: word, offset: byte): byte {
    return lo(base / 64) + offset;
}

export function main(): void {
    poke($0400, addOffset($1000, 0));
    poke($0401, addOffset($1000, 1));
}
```

**Blend source for Bug #3 regression test:**
```js
// Minimal reproduction: function that gets inlined at O1
module TestInlineJMP;

function helper(): void {
    poke($D020, 1);
}

export function main(): void {
    helper();
    poke($D020, 0);
}
```

### Mock Requirements

No mocks needed — all tests use real compiler infrastructure per code.md Rule 25.

## Verification Checklist

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No regressions in existing tests (`./compiler-test`)
- [ ] `diag_app spinning-line` shows 0 Critical and 0 High bugs
- [ ] Test coverage for new code meets standards
