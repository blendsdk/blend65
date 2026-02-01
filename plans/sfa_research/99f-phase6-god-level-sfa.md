# Phase 6: God-Level SFA Design

> **Document**: 99f-phase6-god-level-sfa.md
> **Parent**: [Execution Plan](99-execution-plan.md)
> **Last Updated**: 2025-02-01 01:20
> **Progress**: 16/16 tasks (100%) ✅ COMPLETE

## Phase Overview

**Objective**: Design a superior Static Frame Allocation system that incorporates the best practices from all analyzed compilers while avoiding their pitfalls.

**Prerequisites**: Phases 1-5 must be complete before starting design.

**Key Decisions Applied**:
- ✅ Static-only allocation (no recursion)
- ✅ Combined ZP strategy (automatic + `@zp` override)
- ✅ Full call graph analysis (maximum frame reuse)
- ✅ Multi-platform support

## Sessions Summary

| Session | Objective | Est. Time |
|---------|-----------|-----------|
| 6.1 | Design Philosophy & Types | 1-2 hours |
| 6.2 | Allocation Algorithm | 1-2 hours |
| 6.3 | ZP Strategy & Frame Reuse | 1-2 hours |
| 6.4 | Edge Cases & Testing | 1 hour |

---

## Session 6.1: Design Philosophy & Types

**Objective**: Establish design philosophy and core type definitions.

### Input Documents

| Document | Content |
|----------|---------|
| `synthesis/01-best-practices.md` | Collected best practices |
| `synthesis/00-comparison-matrix.md` | Feature comparison |
| `plans/compiler-v2/07-frame-allocator.md` | Existing Blend design |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 6.1.1 | Define design philosophy | Notes | [ ] |
| 6.1.2 | Review existing Blend design | Notes | [ ] |
| 6.1.3 | Define core types (FrameSlot, Frame, etc.) | Notes | [ ] |
| 6.1.4 | Document design philosophy | `god-level-sfa/00-overview.md` | [ ] |
| 6.1.5 | Document data structures | `god-level-sfa/01-data-structures.md` | [ ] |

### Deliverables

- [ ] `god-level-sfa/00-overview.md` complete with:
  - Design philosophy statement
  - Key principles
  - Non-goals and constraints
  - Architecture overview

- [ ] `god-level-sfa/01-data-structures.md` complete with:
  - Core TypeScript interfaces
  - FrameSlot definition
  - Frame definition
  - CallGraphNode definition
  - Platform configuration types

### Design Principles

1. **Simplicity Over Cleverness**
   - Predictable allocation patterns
   - Easy-to-debug frame layouts
   - Clear error messages

2. **Performance First**
   - Minimize runtime overhead
   - Aggressive ZP usage for hot paths
   - Efficient frame reuse

3. **Developer Control**
   - `@zp` override for explicit ZP allocation
   - Configurable frame regions
   - Platform-specific tuning

4. **Testability**
   - Deterministic allocation
   - Observable frame layouts
   - Comprehensive diagnostics

---

## Session 6.2: Allocation Algorithm

**Objective**: Design the core allocation algorithm.

### Input Documents

| Document | Content |
|----------|---------|
| `synthesis/01-best-practices.md` | Allocation best practices |
| `kickc/03-memory-coalesce.md` | Coalescing algorithm |
| `oscar64/04-global-analysis.md` | Global analysis approach |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 6.2.1 | Design call graph construction | Notes | [ ] |
| 6.2.2 | Design frame size calculation | Notes | [ ] |
| 6.2.3 | Design allocation ordering | Notes | [ ] |
| 6.2.4 | Document allocation algorithm | `god-level-sfa/02-allocation-algorithm.md` | [ ] |

### Deliverables

- [ ] `god-level-sfa/02-allocation-algorithm.md` complete with:
  - Algorithm overview
  - Phase 1: Call graph construction
  - Phase 2: Frame size calculation
  - Phase 3: Frame address assignment
  - Phase 4: Slot layout
  - Pseudocode and examples

### Algorithm Phases

```
1. Build Call Graph
   - Traverse all functions
   - Record caller-callee relationships
   - Detect and reject recursion

2. Calculate Frame Sizes
   - For each function:
     - Sum parameter sizes
     - Sum local variable sizes
     - Add alignment padding

3. Assign Frame Addresses
   - Topological sort by call depth
   - Assign non-overlapping ranges
   - Enable reuse for non-overlapping paths

4. Layout Slots
   - Order: parameters, then locals
   - Apply ZP priority for hot slots
   - Record final addresses
```

---

## Session 6.3: ZP Strategy & Frame Reuse

**Objective**: Design zero page allocation and frame reuse strategies.

### Input Documents

| Document | Content |
|----------|---------|
| `kickc/04-zeropage-allocation.md` | KickC ZP approach |
| `synthesis/01-best-practices.md` | ZP best practices |
| `kickc/03-memory-coalesce.md` | Memory coalescing |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 6.3.1 | Design ZP priority algorithm | Notes | [ ] |
| 6.3.2 | Design hotness detection | Notes | [ ] |
| 6.3.3 | Design frame reuse via call graph | Notes | [ ] |
| 6.3.4 | Document ZP strategy | `god-level-sfa/03-zeropage-strategy.md` | [ ] |
| 6.3.5 | Document frame reuse | `god-level-sfa/04-call-graph-reuse.md` | [ ] |

### Deliverables

- [ ] `god-level-sfa/03-zeropage-strategy.md` complete with:
  - ZP region configuration
  - Priority algorithm
  - Hotness scoring
  - `@zp` override handling
  - Spillover to RAM

- [ ] `god-level-sfa/04-call-graph-reuse.md` complete with:
  - Call graph analysis
  - Non-overlapping path detection
  - Address assignment algorithm
  - Memory savings calculation
  - Examples

### ZP Priority Scoring

```typescript
// Conceptual scoring algorithm
function calculateZpScore(slot: FrameSlot): number {
  let score = 0;
  
  // Size bonus (smaller = better for ZP)
  score += (4 - slot.size) * 10;
  
  // Loop depth bonus
  score += slot.maxLoopDepth * 20;
  
  // Access count bonus
  score += Math.min(slot.accessCount, 100);
  
  // Explicit @zp annotation
  if (slot.hasZpAnnotation) score += 1000;
  
  return score;
}
```

---

## Session 6.4: Edge Cases & Testing

**Objective**: Document edge case handling and testing strategy.

### Input Documents

| Document | Content |
|----------|---------|
| `synthesis/03-edge-cases.md` | Edge case catalog |
| `synthesis/02-anti-patterns.md` | What to avoid |

### Tasks

| # | Task | Output | Status |
|---|------|--------|--------|
| 6.4.1 | Design edge case handling | Notes | [ ] |
| 6.4.2 | Design error messages | Notes | [ ] |
| 6.4.3 | Design testing strategy | Notes | [ ] |
| 6.4.4 | Document recursion handling | `god-level-sfa/05-recursion-handling.md` | [ ] |
| 6.4.5 | Document edge cases | `god-level-sfa/06-edge-cases.md` | [ ] |
| 6.4.6 | Document testing strategy | `god-level-sfa/07-testing-strategy.md` | [ ] |

### Deliverables

- [ ] `god-level-sfa/05-recursion-handling.md` complete with:
  - Detection algorithm
  - Error messages
  - User guidance

- [ ] `god-level-sfa/06-edge-cases.md` complete with:
  - Large frame handling (>256 bytes)
  - Deep call nesting
  - ZP exhaustion
  - Platform-specific limits
  - Interrupt context

- [ ] `god-level-sfa/07-testing-strategy.md` complete with:
  - Unit test categories
  - Integration test scenarios
  - Edge case tests
  - Performance benchmarks
  - Platform coverage

### Edge Case Categories

| Category | Handling Strategy |
|----------|-------------------|
| Frame > 256 bytes | Split into ZP + RAM regions |
| Call depth > 10 | Warning, but allow |
| ZP exhaustion | Spill to RAM with warning |
| Recursion detected | Compilation error |
| Platform limits | Platform-specific validation |

---

## Task Checklist (Phase 6 Only)

### Session 6.1: Philosophy & Types
- [x] 6.1.1 Define design philosophy ✅
- [x] 6.1.2 Review existing Blend design ✅
- [x] 6.1.3 Define core types ✅
- [x] 6.1.4 Document design philosophy ✅
- [x] 6.1.5 Document data structures ✅

### Session 6.2: Allocation Algorithm
- [x] 6.2.1 Design call graph construction ✅ (02a-call-graph-construction.md)
- [x] 6.2.2 Design frame size calculation ✅ (02b-frame-size-calculation.md)
- [x] 6.2.3 Design allocation ordering ✅ (02c-address-assignment.md)
- [x] 6.2.4 Document allocation algorithm ✅ (02d-slot-layout.md)

### Session 6.3: ZP & Frame Reuse
- [x] 6.3.1 Design ZP priority algorithm ✅ (03-zeropage-strategy.md)
- [x] 6.3.2 Design hotness detection ✅ (03-zeropage-strategy.md)
- [x] 6.3.3 Design frame reuse ✅ (04a, 04b, 04c)
- [x] 6.3.4 Document ZP strategy ✅ (03-zeropage-strategy.md)
- [x] 6.3.5 Document frame reuse ✅ (04a-coalescing-theory.md, 04b-coalescing-algorithm.md, 04c-coalescing-examples.md)

### Session 6.4: Edge Cases & Testing
- [x] 6.4.1 Design edge case handling ✅
- [x] 6.4.2 Design error messages ✅
- [x] 6.4.3 Design testing strategy ✅
- [x] 6.4.4 Document recursion handling ✅ (05-recursion-handling.md)
- [x] 6.4.5 Document edge cases ✅ (06-edge-cases.md)
- [x] 6.4.6 Document testing strategy ✅ (07a, 07b, 07c, 07d)

---

## Session Protocol

**See [99-execution-plan.md](99-execution-plan.md) for the continuous execution workflow.**

### Quick Reference

- **Continue research**: `continue sfa research per plans/sfa_research/99-execution-plan.md`
- **During session**: Mark tasks `[x]` as completed, update progress counter
- **At ~85% context**: Wrap up, `agent.sh finished`, `attempt_completion`, then `/compact`
- **Cross-phase**: When Phase 6 is done, continue to Phase 7 in same session if context allows

---

**Previous Phase**: [99e-phase5-synthesis.md](99e-phase5-synthesis.md)
**Next Phase**: [99g-phase7-blend-integration.md](99g-phase7-blend-integration.md)