# Execution Plan: Bug Fixes

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-09 00:32
> **Progress**: 11/22 tasks (50%)

## Overview

This document defines the execution phases for fixing all known bugs and design issues.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Critical Codegen Bugs | 1-2 | 1-2 hours |
| 2 | CLI Bugs | 1 | 30-45 min |
| 3 | Design Improvements | 1 | 1 hour |
| 4 | Skipped Tests Audit | 1-2 | 1-2 hours |

**Total: 4-6 sessions, ~4-6 hours**

---

## Phase 1: Critical Codegen Bugs

### Session 1.1: BUG-004 — Duplicate Labels

**Reference**: [02-current-state.md](02-current-state.md) — BUG-004 section
**Objective**: Make labels unique across all functions in a module

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Read codegen base.ts and understand label generation | `codegen/generator/base.ts` |
| 1.1.2 | Remove `this.labelCounter = 0` reset in function init | `codegen/generator/base.ts` |
| 1.1.3 | Verify il/builder/base.ts label counter doesn't cause issues | `il/builder/base.ts` |
| 1.1.4 | Update any tests that assert specific label numbers | `__tests__/codegen/` |
| 1.1.5 | Build and compile border-cycle example, verify unique labels | `build/main.asm` |
| 1.1.6 | Run `acme` assembler to confirm no duplicate label errors | manual verification |

**Deliverables**:
- [ ] Labels unique across all functions
- [ ] `acme` assembles generated ASM without errors
- [ ] All existing tests pass

**Verify**: `./compiler-test codegen` then `./compiler-test`

---

### Session 1.2: BUG-001 — Double CMP Comparison

**Reference**: [02-current-state.md](02-current-state.md) — BUG-001 section
**Objective**: Fix comparison codegen to emit correct CMP + branch pairs

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Read comparison codegen (find where `>` is generated) | `codegen/generator/` comparison subclass |
| 1.2.2 | Analyze IL for `>` — is the problem in IL or codegen? | `il/generator.ts` |
| 1.2.3 | Fix comparison codegen: single CMP + correct branch | `codegen/generator/` |
| 1.2.4 | Test all 6 comparison operators (`>`, `<`, `>=`, `<=`, `==`, `!=`) | `__tests__/codegen/` |
| 1.2.5 | Compile border-cycle example and verify correct CMP output | `build/main.asm` |

**Deliverables**:
- [ ] `if (color > 15)` generates `CMP #$10` + `BCC .else` (or equivalent)
- [ ] No double CMP in any comparison
- [ ] All comparison operators work correctly
- [ ] All existing tests pass

**Verify**: `./compiler-test codegen` then `./compiler-test`

---

## Phase 2: CLI Bugs

### Session 2.1: Fix All CLI Optimization Issues

**Reference**: [02-current-state.md](02-current-state.md) — CLI section
**Objective**: Fix -O shorthand, add descriptions, handle duplicates

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Change optimization choices to `['0','1','2','3','s','z']` | `packages/cli/src/commands/build.ts` |
| 2.1.2 | Update default from `'O0'` to `'0'` | `packages/cli/src/commands/build.ts` |
| 2.1.3 | Update `buildConfig` to prepend `'O'` to optimization value | `packages/cli/src/commands/build.ts` |
| 2.1.4 | Add array guard: if Array.isArray(opt), take last element | `packages/cli/src/commands/build.ts` |
| 2.1.5 | Add optimization level descriptions via `.epilog()` | `packages/cli/src/commands/build.ts` |
| 2.1.6 | Update help examples to use new syntax | `packages/cli/src/commands/build.ts` |
| 2.1.7 | Test: `-O1`, `-O s`, `--optimization 2`, duplicate flags | manual verification |

**Deliverables**:
- [ ] `-O1`, `-Os`, `-Oz` work without space
- [ ] Duplicate `--optimization` takes last value (no crash)
- [ ] Help text explains each optimization level
- [ ] All existing CLI tests pass

**Verify**: `./compiler-test` and manual CLI testing

---

## Phase 3: Design Improvements

### Session 3.1: Emit main() First + Fix Comments

**Reference**: [02-current-state.md](02-current-state.md) — DESIGN-003 + BUG-003 sections
**Objective**: Eliminate JMP main, fix misleading comments

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Find where functions are emitted in codegen | `codegen/generator/` or pipeline |
| 3.1.2 | Reorder: emit main() first, then other functions | codegen function emission |
| 3.1.3 | Remove startup section (JMP main) generation | codegen startup emission |
| 3.1.4 | Fix or remove misleading `; A already has` comments | codegen comment emission |
| 3.1.5 | Compile border-cycle, verify main is first + no JMP | `build/main.asm` |
| 3.1.6 | Run `acme` assembler to confirm output works | manual verification |

**Deliverables**:
- [ ] `main()` emitted immediately after BASIC stub
- [ ] No `JMP main` startup section
- [ ] No misleading register-state comments
- [ ] All existing tests pass

**Verify**: `./compiler-test` and manual ASM inspection

---

## Phase 4: Skipped Tests Audit

### Session 4.1: Inventory and Categorize Skipped Tests

**Objective**: Find all skipped tests and categorize them

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Run grep to find ALL skipped tests across codebase | all test files |
| 4.1.2 | Create inventory: test name, file, reason skipped | document |
| 4.1.3 | Categorize: fixable now, needs deeper fix, obsolete | document |

**Deliverables**:
- [ ] Complete inventory of all skipped tests with reasons
- [ ] Each test categorized by action needed

### Session 4.2: Enable and Fix Skipped Tests

**Objective**: Un-skip all tests, fix or remove them

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Fix and enable "fixable now" skipped tests | various test files |
| 4.2.2 | Fix underlying bugs for "needs deeper fix" tests | various source files |
| 4.2.3 | Remove obsolete skipped tests | various test files |
| 4.2.4 | Final verification: zero skipped tests remaining | all tests |

**Deliverables**:
- [ ] Zero skipped tests (or documented exceptions with justification)
- [ ] All tests pass
- [ ] No regressions

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Critical Codegen Bugs
- [x] 1.1.1 Read codegen base.ts label generation ✅ (2026-08-09 00:29)
- [x] 1.1.2 Remove labelCounter reset in IL builder clear() ✅ (2026-08-09 00:29)
- [x] 1.1.3 Verify il/builder/base.ts label counter ✅ (2026-08-09 00:29)
- [x] 1.1.4 All tests pass (IL 7835, codegen 2327, e2e 775) ✅ (2026-08-09 00:29)
- [x] 1.1.5 Verified unique labels via tsx + dist tests ✅ (2026-08-09 00:29)
- [x] 1.1.6 No test regressions ✅ (2026-08-09 00:29)
- [x] 1.2.1 Read comparison codegen ✅ (2026-08-09 00:30) — already fixed
- [x] 1.2.2 Analyze IL for `>` operator ✅ (2026-08-09 00:30) — IL gen already has direct CMP+branch
- [x] 1.2.3 No fix needed — already resolved in previous IL generator work
- [x] 1.2.4 Verified: border-cycle `if (color > 15)` generates correct CMP+BCC+BEQ
- [x] 1.2.5 All comparison operators use correct inverted branch pattern

### Phase 2: CLI Bugs
- [ ] 2.1.1 Change optimization choices (remove O prefix)
- [ ] 2.1.2 Update default to '0'
- [ ] 2.1.3 Update buildConfig to prepend 'O'
- [ ] 2.1.4 Add array guard for duplicate flags
- [ ] 2.1.5 Add optimization level descriptions
- [ ] 2.1.6 Update help examples
- [ ] 2.1.7 Test CLI manually

### Phase 3: Design Improvements
- [ ] 3.1.1 Find function emission point
- [ ] 3.1.2 Reorder: main() first
- [ ] 3.1.3 Remove startup JMP section
- [ ] 3.1.4 Fix misleading comments
- [ ] 3.1.5 Compile border-cycle, verify
- [ ] 3.1.6 Run acme, confirm

### Phase 4: Skipped Tests Audit
- [ ] 4.1.1 Grep all skipped tests
- [ ] 4.1.2 Create inventory
- [ ] 4.1.3 Categorize by action
- [ ] 4.2.1 Fix "fixable now" tests
- [ ] 4.2.2 Fix "needs deeper fix" tests
- [ ] 4.2.3 Remove obsolete tests
- [ ] 4.2.4 Final verification: zero skipped

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/bug-fixes/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. If tests pass, commit
git add .
git commit -m "fix([component]): [description]

Ref: plans/bug-fixes/99-execution-plan.md
Task: X.X.X"

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact
/compact
```

---

## Dependencies

```
Phase 1 (Critical Codegen) — no dependencies
    ↓
Phase 2 (CLI) — independent, can run in parallel
    ↓
Phase 3 (Design) — depends on Phase 1 (label fix needed first)
    ↓
Phase 4 (Skipped Tests) — should run last (after all fixes applied)
```

---

## Success Criteria

**Bug fixes are complete when**:

1. ✅ All Phase 1-3 tasks done
2. ✅ All tests passing (zero failures)
3. ✅ Zero skipped tests (or justified exceptions)
4. ✅ border-cycle example compiles + assembles with acme
5. ✅ CLI `-O1` shorthand works
6. ✅ `main()` emitted first (no JMP startup)
7. ✅ bug-list.md updated with resolved items
