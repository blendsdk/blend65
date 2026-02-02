# Phase 2: KickC Analysis

> **Document**: 99b-phase2-kickc.md
> **Parent**: [Execution Plan](99-execution-plan.md)
> **Last Updated**: 2025-01-31 23:38
> **Progress**: 16/16 tasks (100%)  COMPLETE

## Phase Overview

**Objective**: Deep analysis of KickC's SSA-based frame allocation and memory coalescing.

**Why KickC**: KickC is a modern C compiler using SSA (Static Single Assignment) form with sophisticated memory coalescing. Its approach to static allocation without recursion is directly relevant to Blend's design decisions.

**Repository**: `/sfa_learning/kickc/src/main/java/dk/camelot64/kickc/`

## Sessions Summary

| Session | Objective | Est. Time |
|---------|-----------|-----------|
| 2.1 | Architecture Overview | 1 hour |
| 2.2 | Recursion Detection | 1 hour |
| 2.3 | Memory Coalescing | 1-2 hours |
| 2.4 | Zero Page Allocation | 1 hour |

---

## Session 2.1: Architecture Overview

**Objective**: Understand KickC's overall compiler architecture and pass system.

### Files to Analyze

| File | Purpose |
|------|---------|
| `passes/` directory structure | Pass organization |
| `Compiler.java` | Main compiler orchestration |
| `model/` | Core data models |
| `passes/Pass.java` | Base pass interface |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 2.1.1 | Map passes/ directory structure | Notes | [ ] |
| 2.1.2 | Study Compiler.java pass orchestration | Notes | [ ] |
| 2.1.3 | Identify SFA-related passes | Notes | [ ] |
| 2.1.4 | Start kickc overview document | `kickc/00-overview.md` | [ ] |

### Deliverables

- [ ] `kickc/00-overview.md` started with:
  - Pass-based architecture overview
  - SSA pipeline structure
  - Key data models for frame allocation

### Questions to Answer

1. What is the overall pass sequence?
2. Which passes relate to frame/variable allocation?
3. How does SSA form affect allocation?
4. What is the compilation pipeline?

---

## Session 2.2: Recursion Detection

**Objective**: Understand how KickC detects and prevents recursion.

### Files to Analyze

| File | Purpose |
|------|---------|
| `passes/Pass1AssertNoRecursion.java` | Recursion detection |
| `passes/Pass1CallGraph.java` | Call graph building (if exists) |
| `model/CallGraph.java` | Call graph data structure |
| `passes/Pass1AssertNoCalls*.java` | Call assertion passes |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 2.2.1 | Analyze Pass1AssertNoRecursion.java | Notes | [ ] |
| 2.2.2 | Study call graph construction | Notes | [ ] |
| 2.2.3 | Understand recursion error handling | Notes | [ ] |
| 2.2.4 | Document recursion detection | `kickc/01-recursion-detection.md` | [ ] |

### Deliverables

- [ ] `kickc/01-recursion-detection.md` complete with:
  - Recursion detection algorithm
  - Call graph analysis
  - Error messages and handling
  - How static allocation is enforced

### Questions to Answer

1. How is the call graph constructed?
2. What algorithm detects recursion (DFS? SCC?)?
3. How are mutual recursion cases handled?
4. What error messages are generated?

---

## Session 2.3: Memory Coalescing

**Objective**: Understand KickC's sophisticated memory coalescing strategy.

### Files to Analyze

| File | Purpose |
|------|---------|
| `passes/Pass4MemoryCoalesce.java` | Main coalescing pass |
| `passes/Pass4MemoryCoalesceAssignment.java` | Assignment-based coalescing |
| `passes/Pass4MemoryCoalesceCallGraph.java` | Call-graph-based coalescing |
| `model/LiveRangeEquivalenceClass.java` | Live range tracking |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 2.3.1 | Analyze Pass4MemoryCoalesce.java | Notes | [ ] |
| 2.3.2 | Study assignment-based coalescing | Notes | [ ] |
| 2.3.3 | Study call-graph-based coalescing | Notes | [ ] |
| 2.3.4 | Document memory coalescing | `kickc/03-memory-coalesce.md` | [ ] |

### Deliverables

- [ ] `kickc/03-memory-coalesce.md` complete with:
  - Coalescing algorithm details
  - Live range analysis
  - Assignment vs call-graph approaches
  - Memory savings achieved

### Questions to Answer

1. What is the coalescing algorithm?
2. How are live ranges tracked?
3. How does call graph affect coalescing?
4. What memory savings are typical?

---

## Session 2.4: Zero Page Allocation

**Objective**: Understand KickC's zero page allocation strategy.

### Files to Analyze

| File | Purpose |
|------|---------|
| `passes/Pass4AssertZeropageAllocation.java` | ZP allocation verification |
| `passes/Pass4ZeroPageCoalesce.java` | ZP coalescing (if exists) |
| `model/Registers.java` | Register/ZP modeling |
| `passes/Pass4RegisterAllocation.java` | Register allocation |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 2.4.1 | Analyze Pass4AssertZeropageAllocation.java | Notes | [ ] |
| 2.4.2 | Study ZP vs RAM decision logic | Notes | [ ] |
| 2.4.3 | Document strengths | `kickc/05-strengths.md` | [ ] |
| 2.4.4 | Document weaknesses | `kickc/06-weaknesses.md` | [ ] |
| 2.4.5 | Document ZP allocation | `kickc/04-zeropage-allocation.md` | [ ] |
| 2.4.6 | Document call stack variables | `kickc/02-call-stack-vars.md` | [ ] |
| 2.4.7 | Complete overview | `kickc/00-overview.md` | [ ] |

### Deliverables

- [ ] `kickc/02-call-stack-vars.md` complete
- [ ] `kickc/04-zeropage-allocation.md` complete
- [ ] `kickc/05-strengths.md` complete
- [ ] `kickc/06-weaknesses.md` complete
- [ ] `kickc/00-overview.md` finalized

### Questions to Answer

1. How does KickC decide ZP vs RAM?
2. What priority system is used?
3. How is ZP pressure handled?
4. What are the allocation limits?

---

## Task Checklist (Phase 2 Only)

### Session 2.1: Architecture
- [x] 2.1.1 Map passes/ structure  (completed: 2025-01-31 23:30)
- [x] 2.1.2 Study Compiler.java  (completed: 2025-01-31 23:30)
- [x] 2.1.3 Identify SFA passes  (completed: 2025-01-31 23:31)
- [x] 2.1.4 Start overview  (completed: 2025-01-31 23:33)

### Session 2.2: Recursion
- [x] 2.2.1 Analyze Pass1AssertNoRecursion  (completed: 2025-01-31 23:31)
- [x] 2.2.2 Study call graph  (completed: 2025-01-31 23:31)
- [x] 2.2.3 Recursion error handling  (completed: 2025-01-31 23:34)
- [x] 2.2.4 Document recursion detection  (completed: 2025-01-31 23:34)

### Session 2.3: Memory Coalescing
- [x] 2.3.1 Analyze Pass4MemoryCoalesce  (completed: 2025-01-31 23:31)
- [x] 2.3.2 Assignment-based coalescing  (completed: 2025-01-31 23:36)
- [x] 2.3.3 Call-graph coalescing  (completed: 2025-01-31 23:31)
- [x] 2.3.4 Document coalescing  (completed: 2025-01-31 23:36)

### Session 2.4: Zero Page
- [x] 2.4.1 Analyze ZP allocation  (completed: 2025-01-31 23:36)
- [x] 2.4.2 ZP vs RAM decision  (completed: 2025-01-31 23:37)
- [x] 2.4.3 Document strengths  (completed: 2025-01-31 23:38)
- [x] 2.4.4 Document weaknesses  (completed: 2025-01-31 23:39)
- [x] 2.4.5 Document ZP allocation  (completed: 2025-01-31 23:37)
- [x] 2.4.6 Document call stack vars  (in overview)
- [x] 2.4.7 Complete overview  (completed: 2025-01-31 23:33)

---

## Session Protocol

**See [99-execution-plan.md](99-execution-plan.md) for the continuous execution workflow.**

### Quick Reference

- **Continue research**: `continue sfa research per plans/sfa_research/99-execution-plan.md`
- **During session**: Mark tasks `[x]` as completed, update progress counter
- **At ~85% context**: Wrap up, `agent.sh finished`, `attempt_completion`, then `/compact`
- **Cross-phase**: When Phase 2 is done, continue to Phase 3 in same session if context allows

---

**Previous Phase**: [99a-phase1-cc65.md](99a-phase1-cc65.md)
**Next Phase**: [99c-phase3-oscar64.md](99c-phase3-oscar64.md)