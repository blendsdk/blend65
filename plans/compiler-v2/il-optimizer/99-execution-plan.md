# Execution Plan: IL Optimizer

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-03 16:00
> **Progress**: 14/24 tasks (58%)

## Overview

This document defines the execution phases and sessions for implementing the god-level IL Optimizer.

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Infrastructure | 2 | 2-3 hours |
| 2 | DCE Pass | 1-2 | 1-2 hours |
| 3 | Constant Folding | 1 | 1-2 hours |
| 4 | Constant Propagation | 1-2 | 1-2 hours |
| 5 | Copy Propagation | 1 | 1-2 hours |
| 6 | IL Peephole | 1-2 | 1-2 hours |
| 7 | Integration | 1 | 1 hour |

**Total: 8-11 sessions, ~8-14 hours**

---

## Phase 1: Infrastructure

### Session 1.1: Core Types

**Reference**: [03-infrastructure.md](03-infrastructure.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Create optimizer directory | `src/optimizer/` |
| 1.1.2 | Create options.ts | `optimizer/options.ts` |
| 1.1.3 | Create pass.ts interface | `optimizer/pass.ts` |
| 1.1.4 | Add unit tests | `__tests__/optimizer/types.test.ts` |

**Verify**: `./compiler-test optimizer`

---

### Session 1.2: Pass Manager

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.2.1 | Create pass-manager.ts | `optimizer/pass-manager.ts` |
| 1.2.2 | Implement pass ordering | `optimizer/pass-manager.ts` |
| 1.2.3 | Create il-optimizer.ts | `optimizer/il-optimizer.ts` |
| 1.2.4 | Create index.ts exports | `optimizer/index.ts` |
| 1.2.5 | Add pass manager tests | `__tests__/optimizer/pass-manager.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 2: DCE Pass

### Session 2.1: Dead Code Elimination

**Reference**: [04-dce.md](04-dce.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Create passes directory | `optimizer/passes/` |
| 2.1.2 | Create dce.ts | `optimizer/passes/dce.ts` |
| 2.1.3 | Implement dead store removal | `optimizer/passes/dce.ts` |
| 2.1.4 | Implement unreachable code | `optimizer/passes/dce.ts` |
| 2.1.5 | Add DCE tests | `__tests__/optimizer/passes/dce.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 3: Constant Folding

### Session 3.1: Constant Folding Pass

**Reference**: [05-constant-fold.md](05-constant-fold.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Create constant-fold.ts | `optimizer/passes/constant-fold.ts` |
| 3.1.2 | Implement all fold patterns | `optimizer/passes/constant-fold.ts` |
| 3.1.3 | Add constant fold tests | `__tests__/optimizer/passes/constant-fold.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 4: Constant Propagation

### Session 4.1: Constant Propagation Pass

**Reference**: [06-constant-prop.md](06-constant-prop.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Create constant-prop.ts | `optimizer/passes/constant-prop.ts` |
| 4.1.2 | Implement value tracking | `optimizer/passes/constant-prop.ts` |
| 4.1.3 | Implement propagation | `optimizer/passes/constant-prop.ts` |
| 4.1.4 | Add constant prop tests | `__tests__/optimizer/passes/constant-prop.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 5: Copy Propagation

### Session 5.1: Copy Propagation Pass

**Reference**: [07-copy-prop.md](07-copy-prop.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 5.1.1 | Create copy-prop.ts | `optimizer/passes/copy-prop.ts` |
| 5.1.2 | Implement copy tracking | `optimizer/passes/copy-prop.ts` |
| 5.1.3 | Add copy prop tests | `__tests__/optimizer/passes/copy-prop.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 6: IL Peephole

### Session 6.1: IL Peephole Pass

**Reference**: [08-il-peephole.md](08-il-peephole.md)

**Tasks**:

| # | Task | File |
|---|------|------|
| 6.1.1 | Create il-peephole.ts | `optimizer/passes/il-peephole.ts` |
| 6.1.2 | Implement identity elimination | `optimizer/passes/il-peephole.ts` |
| 6.1.3 | Implement strength reduction | `optimizer/passes/il-peephole.ts` |
| 6.1.4 | Implement load-store elim | `optimizer/passes/il-peephole.ts` |
| 6.1.5 | Add peephole tests | `__tests__/optimizer/passes/il-peephole.test.ts` |

**Verify**: `./compiler-test optimizer`

---

## Phase 7: Integration

### Session 7.1: Full Integration

**Tasks**:

| # | Task | File |
|---|------|------|
| 7.1.1 | Register all passes | `optimizer/pass-manager.ts` |
| 7.1.2 | Add integration tests | `__tests__/optimizer/integration.test.ts` |
| 7.1.3 | Add E2E tests | `__tests__/optimizer/e2e.test.ts` |
| 7.1.4 | Run full test suite | - |

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Infrastructure ✅ COMPLETE
- [x] 1.1.1 Create optimizer directory ✅ (completed: 2026-02-03 15:45)
- [x] 1.1.2 Create options.ts ✅ (completed: 2026-02-03 15:45)
- [x] 1.1.3 Create pass.ts interface ✅ (completed: 2026-02-03 15:46)
- [x] 1.1.4 Add unit tests for types ✅ (completed: 2026-02-03 15:50)
- [x] 1.2.1 Create pass-manager.ts ✅ (completed: 2026-02-03 15:47)
- [x] 1.2.2 Implement pass ordering ✅ (completed: 2026-02-03 15:47)
- [x] 1.2.3 Create il-optimizer.ts ✅ (completed: 2026-02-03 15:48)
- [x] 1.2.4 Create index.ts exports ✅ (completed: 2026-02-03 15:48)
- [x] 1.2.5 Add pass manager tests ✅ (completed: 2026-02-03 15:51)

### Phase 2: DCE ✅ COMPLETE
- [x] 2.1.1 Create passes directory ✅ (completed: 2026-02-03 15:56)
- [x] 2.1.2 Create dce.ts ✅ (completed: 2026-02-03 15:56)
- [x] 2.1.3 Implement dead store removal ✅ (completed: 2026-02-03 15:56)
- [x] 2.1.4 Implement unreachable code ✅ (completed: 2026-02-03 15:56)
- [x] 2.1.5 Add DCE tests ✅ (completed: 2026-02-03 15:58)

### Phase 3: Constant Folding
- [ ] 3.1.1 Create constant-fold.ts
- [ ] 3.1.2 Implement all fold patterns
- [ ] 3.1.3 Add constant fold tests

### Phase 4: Constant Propagation
- [ ] 4.1.1 Create constant-prop.ts
- [ ] 4.1.2 Implement value tracking
- [ ] 4.1.3 Implement propagation
- [ ] 4.1.4 Add constant prop tests

### Phase 5: Copy Propagation
- [ ] 5.1.1 Create copy-prop.ts
- [ ] 5.1.2 Implement copy tracking
- [ ] 5.1.3 Add copy prop tests

### Phase 6: IL Peephole
- [ ] 6.1.1 Create il-peephole.ts
- [ ] 6.1.2 Implement identity elimination
- [ ] 6.1.3 Implement strength reduction
- [ ] 6.1.4 Implement load-store elim
- [ ] 6.1.5 Add peephole tests

### Phase 7: Integration
- [ ] 7.1.1 Register all passes
- [ ] 7.1.2 Add integration tests
- [ ] 7.1.3 Add E2E tests
- [ ] 7.1.4 Run full test suite

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/compiler-v2/il-optimizer/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test optimizer

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**IL Optimizer is complete when:**

1. ✅ All phases completed
2. ✅ All tests passing
3. ✅ O0 through O3 working
4. ✅ No semantic changes between levels
5. ✅ Measurable code size reduction

---

## Next Steps (After IL Optimizer)

After completing the IL Optimizer, the next components are:

1. **Code Generator** (Phase 8 compiler-v2) - Converts optimized IL to ASM-IL
2. **ASM-IL Optimizer** (Phase 9 compiler-v2) - God-level 6502 peephole
3. **Emitter** - ACME output

A separate plan will be created for the ASM-IL Optimizer.