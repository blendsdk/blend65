# Execution Plan: Extreme E2E Testing Infrastructure

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementing the extreme E2E testing infrastructure.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Infrastructure Setup | 2 | 2-3 hours |
| 2 | Test Runner Implementation | 2 | 2-3 hours |
| 3 | Integration Fixtures (Initial Category) | 3 | 4-5 hours |
| 4 | Parser & Semantic Fixtures | 4 | 5-6 hours |
| 5 | Optimizer & Codegen Fixtures | 3 | 4-5 hours |
| 6 | Error Case Fixtures | 2 | 2-3 hours |
| 7 | Real-World Program Fixtures | 3 | 4-5 hours |
| 8 | Edge Cases & Regressions | 2 | 2-3 hours |

**Total: ~21 sessions, ~26-33 hours**

---

## Phase 1: Infrastructure Setup

### Session 1.1: Directory Structure & Metadata Format

**Reference**: [Fixture Structure](03-fixture-structure.md)

**Objective**: Create the fixture directory structure and metadata parser

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create `fixtures/` directory structure | `fixtures/**/` |
| 1.1.2 | Create fixture metadata type definitions | `src/__tests__/e2e/fixture-types.ts` |
| 1.1.3 | Implement metadata parser | `src/__tests__/e2e/fixture-parser.ts` |
| 1.1.4 | Add unit tests for metadata parser | `src/__tests__/e2e/fixture-parser.test.ts` |

**Deliverables**:
- [ ] Directory structure created
- [ ] Metadata type definitions
- [ ] Working metadata parser
- [ ] Parser tests passing

**Verify**: `./compiler-test e2e`

---

### Session 1.2: Sample Fixtures & Format Validation

**Objective**: Create initial sample fixtures and validate the format

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Create 5 sample fixtures in different categories | `fixtures/**/*.blend` |
| 1.2.2 | Implement fixture validation utility | `src/__tests__/e2e/fixture-validator.ts` |
| 1.2.3 | Validate sample fixtures | Tests |
| 1.2.4 | Document fixture format | `fixtures/README.md` |

**Deliverables**:
- [ ] 5 sample fixtures created
- [ ] Validation utility working
- [ ] Format documented

---

## Phase 2: Test Runner Implementation

### Session 2.1: Core Test Runner

**Reference**: [Test Runner](04-test-runner.md)

**Objective**: Implement the core fixture test runner

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Create fixture discovery utility | `src/__tests__/e2e/fixture-discovery.ts` |
| 2.1.2 | Implement compilation executor | `src/__tests__/e2e/fixture-executor.ts` |
| 2.1.3 | Implement result validator | `src/__tests__/e2e/fixture-validator.ts` |
| 2.1.4 | Create main test runner | `src/__tests__/e2e/fixture-runner.test.ts` |

**Deliverables**:
- [ ] Discovery finds all fixtures
- [ ] Executor compiles fixtures
- [ ] Validator checks outcomes
- [ ] Sample fixtures pass

**Verify**: `./compiler-test e2e`

---

### Session 2.2: Reporter & CI Integration

**Objective**: Add reporting and CI integration

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.2.1 | Add detailed failure reporting | `fixture-runner.test.ts` |
| 2.2.2 | Add timing and statistics | Reporter |
| 2.2.3 | Ensure CI compatibility | Exit codes |
| 2.2.4 | Add fixture-test script | `package.json` |

**Deliverables**:
- [ ] Clear failure messages
- [ ] Statistics reporting
- [ ] CI-compatible exit codes
- [ ] Easy-to-run script

---

## Phase 3: Integration Fixtures (Initial Category)

**Goal**: Create comprehensive integration fixtures to validate the approach

### Session 3.1: Real-World Programs - Part 1

**Reference**: [Real Programs](06-real-programs.md)

**Objective**: Create sprite and graphics-related fixtures

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Sprite movement fixture | `fixtures/10-integration/real-programs/sprite-movement.blend` |
| 3.1.2 | Multi-sprite manager fixture | `fixtures/10-integration/real-programs/sprite-manager.blend` |
| 3.1.3 | Screen drawing fixture | `fixtures/10-integration/real-programs/screen-draw.blend` |
| 3.1.4 | Color cycling fixture | `fixtures/10-integration/real-programs/color-cycle.blend` |
| 3.1.5 | Validate all pass | Tests |

**Deliverables**:
- [ ] 4 real-world fixtures
- [ ] All compile successfully
- [ ] Use multiple language features

---

### Session 3.2: Real-World Programs - Part 2

**Objective**: Create game logic and input handling fixtures

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Input handler fixture | `fixtures/10-integration/real-programs/input-handler.blend` |
| 3.2.2 | Game loop fixture | `fixtures/10-integration/real-programs/game-loop.blend` |
| 3.2.3 | Score system fixture | `fixtures/10-integration/real-programs/score-system.blend` |
| 3.2.4 | Collision detection fixture | `fixtures/10-integration/real-programs/collision.blend` |

**Deliverables**:
- [ ] 4 more real-world fixtures
- [ ] All compile successfully

---

### Session 3.3: Multi-Module Fixtures

**Objective**: Create multi-module import/export fixtures

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.3.1 | Simple import fixture | `fixtures/10-integration/multi-module/simple-import.blend` |
| 3.3.2 | Multiple imports fixture | `fixtures/10-integration/multi-module/multi-import.blend` |
| 3.3.3 | Circular dependency fixture | `fixtures/10-integration/multi-module/circular.blend` |
| 3.3.4 | Library-style module fixture | `fixtures/10-integration/multi-module/library-style.blend` |

**Deliverables**:
- [ ] 4 multi-module fixtures
- [ ] Import/export validation

---

## Phase 4-8: Remaining Categories

**Detailed sessions to be expanded during execution**

### Phase 4: Parser & Semantic (~50 fixtures)
- Session 4.1: Expression fixtures (15)
- Session 4.2: Statement fixtures (15)
- Session 4.3: Declaration fixtures (10)
- Session 4.4: Type checking fixtures (10)

### Phase 5: Optimizer & Codegen (~40 fixtures)
- Session 5.1: Dead code fixtures (15)
- Session 5.2: Constant folding fixtures (10)
- Session 5.3: Codegen pattern fixtures (15)

### Phase 6: Error Cases (~50 fixtures)
- Session 6.1: Parse error fixtures (25)
- Session 6.2: Semantic error fixtures (25)

### Phase 7: Real-World Programs (~20 fixtures)
- Session 7.1: Game patterns (7)
- Session 7.2: Hardware patterns (7)
- Session 7.3: Utility patterns (6)

### Phase 8: Edge Cases & Regressions
- Session 8.1: Boundary value fixtures (15)
- Session 8.2: Initial regression fixtures (10)

---

## Task Checklist (All Phases)

### Phase 1: Infrastructure Setup
- [x] 1.1.1 Create fixtures/ directory structure ✅
- [x] 1.1.2 Create fixture metadata type definitions ✅
- [x] 1.1.3 Implement metadata parser ✅
- [x] 1.1.4 Add unit tests for metadata parser ✅
- [x] 1.2.1 Create 6 sample fixtures ✅
- [x] 1.2.2 Implement fixture validation utility ✅
- [x] 1.2.3 Validate sample fixtures ✅
- [x] 1.2.4 Document fixture format ✅

### Phase 2: Test Runner Implementation
- [x] 2.1.1 Create fixture discovery utility ✅ (in fixture-validator.ts)
- [x] 2.1.2 Implement compilation executor ✅ (fixture-executor.ts)
- [x] 2.1.3 Implement result validator ✅ (in fixture-executor.ts)
- [x] 2.1.4 Create main test runner ✅ (fixture-runner.test.ts)
- [x] 2.2.1 Add detailed failure reporting ✅ (in fixture-runner.test.ts)
- [x] 2.2.2 Add timing and statistics ✅ (in fixture-runner.test.ts)
- [x] 2.2.3 Ensure CI compatibility ✅ (Vitest integration)
- [x] 2.2.4 Add fixture-test script ✅ (packages/compiler/package.json)

### Phase 3: Integration Fixtures
- [x] 3.1.x Create 4 sprite/graphics fixtures ✅
- [x] 3.2.x Create 4 game logic fixtures ✅
- [x] 3.3.x Create 4 multi-module fixtures ✅

### Phase 4: Parser & Semantic Fixtures
- [x] 4.1.x Create 15 expression fixtures ✅ (unary, binary, precedence, combinations, deeply-nested)
- [x] 4.2.x Create 15 statement fixtures ✅ (if-else, while, for, nested-control, do-while-pattern, break-continue)
- [x] 4.3.x Declaration fixtures exist (11 fixtures in 02-parser/declarations/)
- [x] 4.4.x Type checking fixtures exist (11 fixtures in 03-semantic/type-checking/)

### Phase 5: Optimizer & Codegen Fixtures
- [x] 5.1.x Create 13 dead code fixtures ✅ (dead-assignment, unreachable-after-break/continue, dead-else-branch, dead-store, return-in-both-branches, multiple-dead-assigns, if-false-dead, nested-dead-code, dead-after-loop-exit, unused-param, while-false-dead, infinite-loop-dead)
- [x] 5.2.x Create 8 constant folding fixtures ✅ (comparison-fold, logical-fold, shift-fold, nested-fold, mixed-fold, division-fold, unary-fold, complex-fold)
- [x] 5.3.x Create 8 codegen pattern fixtures ✅ (branch-instructions, jump-instructions, stack-operations, loop-codegen, function-call-codegen, memory-copy, increment-decrement, comparison-branch)

### Phase 6-8: To be detailed during execution

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/extreme-e2e-testing/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ Test runner infrastructure implemented
2. ✅ 350+ fixtures created and categorized
3. ✅ All success fixtures pass (100% pass rate)
4. ✅ Error fixtures correctly validate expected errors
5. ✅ Real-world fixtures demonstrate complex programs
6. ✅ CI pipeline runs fixture tests
7. ✅ Documentation complete
8. ✅ Easy to add new fixtures