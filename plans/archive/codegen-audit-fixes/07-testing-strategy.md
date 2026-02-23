# Testing Strategy: Codegen Audit Fixes

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals
- Unit tests: Each bug fix has specific unit tests
- Integration tests: compile spinning-line at all 6 levels after each phase
- E2E tests: full pipeline verification (source → ASM) for multi-arg and const conditions

## Test Categories

### Unit Tests

| Test | Description | Bug | Priority |
|------|-------------|-----|----------|
| Multi-arg 2 params | `generateCallArguments` stores 2nd arg to param slot | C1 | High |
| Multi-arg 3 params | 3-arg call stores args 2 and 3 before arg 0 | C1 | High |
| Multi-arg word param | 2nd arg is word-typed, store with STORE_WORD | C1 | High |
| Const in if-condition | `if (x == CONST)` generates CMP #value | C2 | High |
| Const in while-condition | `while (x < CONST)` generates CMP #value | C2 | Medium |
| Const various operators | `!=`, `<`, `<=`, `>`, `>=` all resolve const | C2 | Medium |
| Barrier blocks unroll | Loop with `barrier()` is not unrolled | O1 | High |
| Body extraction no counter | `extractBodyInstructions` excludes INC on counter | L1 | High |
| Label remapping in clone | `cloneInstructions(body, 2)` produces `label_u2` | L2 | High |
| Redundant JMP removal | JUMP label + LABEL label → remove JUMP | I2 | Low |

### Integration Tests

| Test | Components | Description |
|------|-----------|-------------|
| Spinning-line O0 | IL gen + codegen | Verify multi-arg passing and const comparison |
| Spinning-line O1 | IL gen + inliner + codegen | Verify inlining without ghost instructions |
| Spinning-line O2 | IL gen + optimizer + codegen | Verify loop unrolling is correct |
| Spinning-line O3 | IL gen + optimizer + codegen | Verify no duplicate labels, assemblable |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Multi-arg function call | Parse → IL → codegen at O0 | ASM shows STA for 2nd arg before JSR |
| Const condition resolution | Parse → IL → codegen at O0 | ASM shows CMP #immediate, not CMP $addr |
| Loop with barrier | Parse → IL → optimize O2 → codegen | Loop body NOT unrolled |
| Clean unroll O2 | Parse → IL → optimize O2 → codegen | 1 increment per iteration, unique labels |

## Verification Method

### Per-Phase Verification Script

After each phase, run the existing debug script to compile at all 6 levels:

```bash
clear && npx tsx scripts/debug-spinning-line-all-opts.ts
```

Then manually inspect (or diff) the generated ASM files to verify fixes.

### Regression Check

```bash
./compiler-test
```

All existing tests must continue to pass.

## Test Data

### Fixtures Needed

No new fixture files needed — the existing `examples/spinning-line/main.blend`
is the primary test fixture. Tests may also use inline Blend source strings
for unit-level verification.

### Mock Requirements

No mocks needed. Use real Lexer, Parser, ILGenerator, Optimizer, and Codegen
instances per code.md Rule 25 (MUST NOT mock real objects).
