# Execution Plan: E2E CodeGen Testing

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

Implementation phases and AI chat sessions for the E2E testing infrastructure.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Test Infrastructure | 1-2 | 1-2 hours |
| 2 | Semantic Tests | 2-3 | 2-3 hours |
| 3 | CodeGen Tests | 3-4 | 3-4 hours |
| 4 | Gap Analysis | 1 | 30 min |

**Total: 7-10 sessions, ~7-10 hours**

---

## Phase 1: Test Infrastructure

### Session 1.1: Create Test Helpers

**Objective**: Build compilation and ASM validation utilities

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create e2e test directory structure | `__tests__/e2e/` |
| 1.1.2 | Implement `compile()` helper | `helpers/compile-helper.ts` |
| 1.1.3 | Implement `compileToAsm()` helper | `helpers/compile-helper.ts` |
| 1.1.4 | Implement ASM pattern matchers | `helpers/asm-validator.ts` |
| 1.1.5 | Create sample test to verify infrastructure | `smoke.test.ts` |

**Deliverables**:
- [x] `compile()` function that compiles Blend source to CompileResult
- [x] `compileToAsm()` function that returns ASM string
- [x] ASM validators: `expectAsmContains`, `expectAsmNotContains`
- [x] Smoke test passes (28/28 pass, 2 skipped for known bugs)

**Verify**: `./compiler-test e2e`

---

## Phase 2: Semantic Validation Tests

### Session 2.1: Type Acceptance Tests

**Objective**: Test what types are accepted in various contexts

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| 2.1.1 | Intrinsic `length()` with byte[] | Should pass |
| 2.1.2 | Intrinsic `length()` with string | Should pass (currently fails) |
| 2.1.3 | Intrinsic `sizeof()` with types | Test all type names |
| 2.1.4 | Variable type annotations | Test all valid types |
| 2.1.5 | Function parameter types | Test array params |
| 2.1.6 | Function return types | Test all valid types |

**Deliverables**:
- [ ] `type-acceptance.test.ts` with 20+ test cases
- [ ] All known type issues documented as failing tests

### Session 2.2: Intrinsic Signature Tests

**Objective**: Test all intrinsic functions accept correct arguments

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| 2.2.1 | Memory intrinsics | peek, poke, peekw, pokew |
| 2.2.2 | Byte extraction | lo, hi |
| 2.2.3 | CPU control | sei, cli, nop, brk |
| 2.2.4 | Stack operations | pha, pla, php, plp |
| 2.2.5 | Optimization | barrier, volatile_read, volatile_write |
| 2.2.6 | Compile-time | sizeof, length |

**Deliverables**:
- [ ] `intrinsic-signatures.test.ts` with tests for each intrinsic
- [ ] Document which intrinsics have signature limitations

---

## Phase 3: Code Generation Tests

### Session 3.1: Literal & Variable Tests

**Objective**: Test literals and variables generate correct code

**Tasks**:
| # | Task | Expected Output |
|---|------|-----------------|
| 3.1.1 | Numeric literals | `LDA #$xx` |
| 3.1.2 | Array literals | `!byte $01, $02, ...` |
| 3.1.3 | String literals | `!text "..."` |
| 3.1.4 | Global variable init | Correct data section |
| 3.1.5 | Local variable store | Valid STA instruction |
| 3.1.6 | Local variable load | Valid LDA instruction |

**Deliverables**:
- [ ] `literals.test.ts` with literal tests
- [ ] `variables.test.ts` with variable tests
- [ ] Array initializer bug documented as failing test
- [ ] Local variable bug documented as failing test

### Session 3.2: Expression Tests

**Objective**: Test expressions generate correct operations

**Tasks**:
| # | Task | Expected Output |
|---|------|-----------------|
| 3.2.1 | Addition | `ADC` sequence |
| 3.2.2 | Subtraction | `SBC` sequence |
| 3.2.3 | Bitwise AND | `AND` |
| 3.2.4 | Bitwise OR | `ORA` |
| 3.2.5 | Comparisons | `CMP`, branch |
| 3.2.6 | Logical operators | Proper flag handling |

**Deliverables**:
- [ ] `expressions.test.ts` with operator tests
- [ ] Document any expression codegen issues

### Session 3.3: Control Flow & Function Tests

**Objective**: Test control flow and function codegen

**Tasks**:
| # | Task | Expected Output |
|---|------|-----------------|
| 3.3.1 | If statement | Branch instructions |
| 3.3.2 | If-else | Proper jump structure |
| 3.3.3 | While loop | Loop structure |
| 3.3.4 | For loop | Counter handling |
| 3.3.5 | Function call | `JSR` instruction |
| 3.3.6 | Function return | `RTS` instruction |

**Deliverables**:
- [ ] `control-flow.test.ts`
- [ ] `functions.test.ts`
- [ ] Document any control flow/function issues

### Session 3.4: Intrinsic CodeGen Tests

**Objective**: Test intrinsics generate correct assembly

**Tasks**:
| # | Task | Expected Output |
|---|------|-----------------|
| 3.4.1 | peek() | `LDA addr` |
| 3.4.2 | poke() | `STA addr` |
| 3.4.3 | sei() | `SEI` |
| 3.4.4 | cli() | `CLI` |
| 3.4.5 | lo() | Low byte extraction |
| 3.4.6 | hi() | High byte extraction |

**Deliverables**:
- [ ] `intrinsics-codegen.test.ts`
- [ ] All intrinsics validated

---

## Phase 4: Gap Analysis

### Session 4.1: Generate Gap Report

**Objective**: Summarize all findings

**Tasks**:
| # | Task | Description |
|---|------|-------------|
| 4.1.1 | Run all e2e tests | Collect results |
| 4.1.2 | Categorize failures | Bug vs Not Implemented |
| 4.1.3 | Create gap report | Summary document |
| 4.1.4 | Prioritize fixes | Critical → Nice to have |

**Deliverables**:
- [ ] `GAP-REPORT.md` in project root
- [ ] Prioritized list of issues to fix
- [ ] Clear path forward

---

## Task Checklist (All Phases)

### Phase 1: Test Infrastructure
- [x] 1.1.1 Create e2e test directory
- [x] 1.1.2 Implement compile() helper
- [x] 1.1.3 Implement compileToAsm() helper
- [x] 1.1.4 Implement ASM pattern matchers
- [x] 1.1.5 Create smoke test

### Phase 2: Semantic Tests
- [ ] 2.1.1-2.1.6 Type acceptance tests
- [ ] 2.2.1-2.2.6 Intrinsic signature tests

### Phase 3: CodeGen Tests
- [ ] 3.1.1-3.1.6 Literal & variable tests
- [ ] 3.2.1-3.2.6 Expression tests
- [ ] 3.3.1-3.3.6 Control flow & function tests
- [ ] 3.4.1-3.4.6 Intrinsic codegen tests

### Phase 4: Gap Analysis
- [ ] 4.1.1-4.1.4 Generate gap report

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/e2e-codegen-testing/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test e2e

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**Testing infrastructure is complete when**:

1. ✅ All phases completed
2. ✅ 100+ e2e test cases
3. ✅ All known bugs have failing tests
4. ✅ Gap report generated
5. ✅ Clear prioritization for fixes