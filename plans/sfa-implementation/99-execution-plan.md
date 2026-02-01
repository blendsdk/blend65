# SFA Execution Plan

> **Document**: 99-execution-plan.md
> **Parent**: [00-index.md](00-index.md)
> **Last Updated**: 2025-01-02
> **Progress**: 0/20 sessions (0%)

## Overview

This document defines the multi-session execution plan for SFA implementation. Each session is designed to be 15-25 minutes of focused work.

**🚨 IMPORTANT: Update this document after EACH completed session!**

---

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 0 | Test Infrastructure | 3 | 45 min |
| 1 | Type Definitions | 4 | 1 hr |
| 2 | Frame Allocator Core | 6 | 2 hr |
| 3 | Frame Coalescing | 4 | 1.5 hr |
| 4 | Compiler Integration | 5 | 2 hr |

**Total: 20 sessions, ~7 hours**

---

## Phase 0: Test Infrastructure

### Session 0.1: Test Helper Setup

**Reference**: [05-testing/06-test-infra.md](05-testing/06-test-infra.md)

**Objective**: Create test helper directory and builders

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.1.1 | Create helpers directory | `__tests__/frame/helpers/` |
| 0.1.2 | Implement builders.ts | `helpers/builders.ts` |
| 0.1.3 | Implement fixtures.ts | `helpers/fixtures.ts` |
| 0.1.4 | Create index.ts exports | `helpers/index.ts` |

**Verify**: `./compiler-test`

---

### Session 0.2: Test Assertions

**Objective**: Create custom test assertions

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.2.1 | Implement assertions.ts | `helpers/assertions.ts` |
| 0.2.2 | Implement mocks.ts | `helpers/mocks.ts` |
| 0.2.3 | Create inline fixtures | `helpers/fixtures.ts` |

**Verify**: `./compiler-test`

---

### Session 0.3: Test Fixtures

**Reference**: [05-testing/07-fixtures.md](05-testing/07-fixtures.md)

**Objective**: Create SFA test fixture files

**Tasks**:
| # | Task | File |
|---|------|------|
| 0.3.1 | Create fixture directories | `fixtures/sfa/01-basic/` etc. |
| 0.3.2 | Create basic fixtures (5) | `01-basic/*.blend` |
| 0.3.3 | Create coalescing fixtures (3) | `02-coalescing/*.blend` |

**Verify**: Files exist and parse correctly

---

## Phase 1: Type Definitions

### Session 1.1: Enums

**Reference**: [10-types/10-overview.md](10-types/10-overview.md)

**Objective**: Create SFA enum definitions

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Create frame directory | `frame/` |
| 1.1.2 | Implement enums.ts | `frame/enums.ts` |
| 1.1.3 | Write enum tests | `__tests__/frame/enums.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 1.2: Core Types

**Objective**: Create core interface definitions

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Implement types.ts | `frame/types.ts` |
| 1.2.2 | Write type tests | `__tests__/frame/types.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 1.3: Platform Config

**Objective**: Create platform configurations

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.3.1 | Implement platform.ts | `frame/platform.ts` |
| 1.3.2 | Add C64 and X16 configs | `frame/platform.ts` |
| 1.3.3 | Write platform tests | `__tests__/frame/platform.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 1.4: Type Guards and Exports

**Objective**: Create type guards and module exports

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.4.1 | Implement guards.ts | `frame/guards.ts` |
| 1.4.2 | Implement index.ts | `frame/index.ts` |
| 1.4.3 | Write guard tests | `__tests__/frame/guards.test.ts` |

**Verify**: `./compiler-test frame`

---

## Phase 2: Frame Allocator Core

### Session 2.1: Frame Calculator

**Reference**: [20-allocator/20-overview.md](20-allocator/20-overview.md)

**Objective**: Calculate frame sizes from functions

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Create allocator directory | `frame/allocator/` |
| 2.1.2 | Implement frame-calculator.ts | `allocator/frame-calculator.ts` |
| 2.1.3 | Write calculator tests | `__tests__/frame/frame-calculator.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 2.2: ZP Pool

**Objective**: Manage Zero Page address pool

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.2.1 | Implement zp-pool.ts | `allocator/zp-pool.ts` |
| 2.2.2 | Write pool tests | `__tests__/frame/zp-pool.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 2.3: ZP Allocator - Scoring

**Objective**: Implement ZP scoring algorithm

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.3.1 | Create zp-allocator.ts | `allocator/zp-allocator.ts` |
| 2.3.2 | Implement calculateZPScore | `allocator/zp-allocator.ts` |
| 2.3.3 | Write scoring tests | `__tests__/frame/zp-allocator.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 2.4: ZP Allocator - Allocation

**Objective**: Implement ZP allocation algorithm

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.4.1 | Implement allocate method | `allocator/zp-allocator.ts` |
| 2.4.2 | Handle directives (@zp, @ram) | `allocator/zp-allocator.ts` |
| 2.4.3 | Write allocation tests | `__tests__/frame/zp-allocator.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 2.5: Frame Allocator - Basic

**Objective**: Create main allocator class

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.5.1 | Create frame-allocator.ts | `allocator/frame-allocator.ts` |
| 2.5.2 | Implement allocate method (basic) | `allocator/frame-allocator.ts` |
| 2.5.3 | Implement recursion check | `allocator/frame-allocator.ts` |
| 2.5.4 | Write basic allocator tests | `__tests__/frame/frame-allocator.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 2.6: Frame Allocator - Integration

**Objective**: Wire up all allocator components

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.6.1 | Wire FrameCalculator | `allocator/frame-allocator.ts` |
| 2.6.2 | Wire ZPAllocator | `allocator/frame-allocator.ts` |
| 2.6.3 | Compute stats | `allocator/frame-allocator.ts` |
| 2.6.4 | Write integration tests | `__tests__/frame/integration/basic-allocation.test.ts` |

**Verify**: `./compiler-test frame`

---

## Phase 3: Frame Coalescing

### Session 3.1: Overlap Detection

**Reference**: [30-coalescing/30-overview.md](30-coalescing/30-overview.md)

**Objective**: Detect overlapping function execution

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Create coalescer.ts | `allocator/coalescer.ts` |
| 3.1.2 | Implement overlaps method | `allocator/coalescer.ts` |
| 3.1.3 | Write overlap tests | `__tests__/frame/coalescer.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 3.2: Thread Context

**Objective**: Detect main vs ISR thread context

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Implement determineThreadContext | `allocator/coalescer.ts` |
| 3.2.2 | Handle callback detection | `allocator/coalescer.ts` |
| 3.2.3 | Write thread context tests | `__tests__/frame/coalescer.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 3.3: Group Building

**Objective**: Build coalesce groups from non-overlap graph

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.3.1 | Implement buildCoalesceGroups | `allocator/coalescer.ts` |
| 3.3.2 | Implement greedy grouping | `allocator/coalescer.ts` |
| 3.3.3 | Write grouping tests | `__tests__/frame/coalescer.test.ts` |

**Verify**: `./compiler-test frame`

---

### Session 3.4: Coalescing Integration

**Objective**: Integrate coalescer into allocator

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.4.1 | Wire coalescer in FrameAllocator | `allocator/frame-allocator.ts` |
| 3.4.2 | Implement address assignment | `allocator/frame-allocator.ts` |
| 3.4.3 | Calculate memory savings | `allocator/frame-allocator.ts` |
| 3.4.4 | Write coalescing integration tests | `__tests__/frame/integration/coalescing.test.ts` |

**Verify**: `./compiler-test frame`

---

## Phase 4: Compiler Integration

### Session 4.1: Semantic Integration

**Reference**: [40-integration/40-overview.md](40-integration/40-overview.md)

**Objective**: Call FrameAllocator from semantic analyzer

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Add FrameAllocator call | `semantic/analyzer.ts` |
| 4.1.2 | Pass FrameMap in result | `semantic/types.ts` |
| 4.1.3 | Write semantic integration tests | `__tests__/semantic/frame-integration.test.ts` |

**Verify**: `./compiler-test semantic`

---

### Session 4.2: IL Generator Integration

**Objective**: Use FrameMap for IL address resolution

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Accept FrameMap in generator | `il/generator.ts` |
| 4.2.2 | Resolve variable addresses | `il/generator.ts` |
| 4.2.3 | Write IL integration tests | `__tests__/il/frame-integration.test.ts` |

**Verify**: `./compiler-test il`

---

### Session 4.3: Code Generator - Basic

**Objective**: Emit assembly with frame addresses

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.3.1 | Accept slot location info | `codegen/generator.ts` |
| 4.3.2 | Emit ZP vs absolute addresses | `codegen/generator.ts` |
| 4.3.3 | Write codegen integration tests | `__tests__/codegen/frame-integration.test.ts` |

**Verify**: `./compiler-test codegen`

---

### Session 4.4: Code Generator - Addressing Modes

**Objective**: Use optimal 6502 addressing modes

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.4.1 | Implement ZP addressing | `codegen/generator.ts` |
| 4.4.2 | Implement indirect Y (ZP only) | `codegen/generator.ts` |
| 4.4.3 | Write addressing mode tests | `__tests__/codegen/addressing-modes.test.ts` |

**Verify**: `./compiler-test codegen`

---

### Session 4.5: E2E Validation

**Reference**: [05-testing/08-e2e-scenarios.md](05-testing/08-e2e-scenarios.md)

**Objective**: Validate full pipeline with E2E tests

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.5.1 | Create E2E test file | `__tests__/frame/e2e/sfa-validation.test.ts` |
| 4.5.2 | Test game loop scenario | E2E test |
| 4.5.3 | Test coalescing scenario | E2E test |
| 4.5.4 | Test ZP allocation scenario | E2E test |

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 0: Test Infrastructure
- [ ] 0.1.1 Create helpers directory
- [ ] 0.1.2 Implement builders.ts
- [ ] 0.1.3 Implement fixtures.ts
- [ ] 0.2.1 Implement assertions.ts
- [ ] 0.2.2 Implement mocks.ts
- [ ] 0.3.1 Create fixture directories
- [ ] 0.3.2 Create basic fixtures

### Phase 1: Type Definitions
- [ ] 1.1.1 Create frame directory
- [ ] 1.1.2 Implement enums.ts
- [ ] 1.2.1 Implement types.ts
- [ ] 1.3.1 Implement platform.ts
- [ ] 1.4.1 Implement guards.ts
- [ ] 1.4.2 Implement index.ts

### Phase 2: Frame Allocator Core
- [ ] 2.1.1 Create allocator directory
- [ ] 2.1.2 Implement frame-calculator.ts
- [ ] 2.2.1 Implement zp-pool.ts
- [ ] 2.3.1 Implement ZP scoring
- [ ] 2.4.1 Implement ZP allocation
- [ ] 2.5.1 Create frame-allocator.ts
- [ ] 2.6.1 Wire all components

### Phase 3: Frame Coalescing
- [ ] 3.1.1 Implement overlap detection
- [ ] 3.2.1 Implement thread context
- [ ] 3.3.1 Implement group building
- [ ] 3.4.1 Integrate coalescer

### Phase 4: Compiler Integration
- [ ] 4.1.1 Semantic integration
- [ ] 4.2.1 IL integration
- [ ] 4.3.1 Codegen basic integration
- [ ] 4.4.1 Addressing modes
- [ ] 4.5.1 E2E validation

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Session X.X per plans/sfa-implementation/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test frame

# 2. Update this document - mark tasks [x]

# 3. End agent settings
clear && scripts/agent.sh finished

# 4. Compact conversation
/compact
```

---

## Success Criteria

SFA implementation is complete when:

1. ✅ All 20 sessions completed
2. ✅ All tests passing (`./compiler-test`)
3. ✅ E2E scenarios verified
4. ✅ Memory savings 30-60% demonstrated
5. ✅ No regressions

---

## Dependencies

```
Phase 0: Test Infra
    ↓
Phase 1: Types
    ↓
Phase 2: Allocator
    ↓
Phase 3: Coalescing
    ↓
Phase 4: Integration
```

---

**To begin implementation, start with Session 0.1**