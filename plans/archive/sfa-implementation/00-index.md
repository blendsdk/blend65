# Static Frame Allocation (SFA) Implementation Plan

> **Feature**: Static Frame Allocation for Blend65 Compiler v2
> **Status**: Ready for Implementation
> **Created**: 2025-01-02
> **Target**: Production-ready SFA with comprehensive testing

## Overview

This plan provides a complete, actionable guide to implement Static Frame Allocation (SFA) in the Blend65 compiler. SFA eliminates function call overhead by allocating function locals and parameters to fixed memory addresses at compile time.

**Key Benefits**:
- Zero call overhead (no stack manipulation = 50-80 cycles saved per call)
- Predictable memory layout
- Better debugging (fixed addresses)
- Smaller code size

**Trade-off**: No recursion (compile error if detected)

---

## Document Index

### Core Documents

| # | Document | Description |
|---|----------|-------------|
| 00 | [00-index.md](00-index.md) | This document - overview and navigation |
| 01 | [01-requirements.md](01-requirements.md) | Final requirements and approved decisions |
| 02 | [02-current-state.md](02-current-state.md) | Current compiler state analysis |

### Phase 0: Testing Infrastructure (Test-First Approach)

| # | Document | Description |
|---|----------|-------------|
| 05 | [05-testing/05-overview.md](05-testing/05-overview.md) | Test strategy overview |
| 06 | [05-testing/06-test-infra.md](05-testing/06-test-infra.md) | Test infrastructure setup |
| 07 | [05-testing/07-fixtures.md](05-testing/07-fixtures.md) | Test fixtures (Blend programs) |
| 08 | [05-testing/08-e2e-scenarios.md](05-testing/08-e2e-scenarios.md) | End-to-end test scenarios |

### Phase 1: Type Definitions

| # | Document | Description |
|---|----------|-------------|
| 10 | [10-types/10-overview.md](10-types/10-overview.md) | Types phase overview |
| 11 | [10-types/11-enums.md](10-types/11-enums.md) | SlotKind, SlotLocation, ZpDirective |
| 12 | [10-types/12-frame-slot.md](10-types/12-frame-slot.md) | FrameSlot interface |
| 13 | [10-types/13-frame.md](10-types/13-frame.md) | Frame interface |
| 14 | [10-types/14-frame-map.md](10-types/14-frame-map.md) | FrameMap and FrameAllocationResult |
| 15 | [10-types/15-platform-config.md](10-types/15-platform-config.md) | Platform configurations |

### Phase 2: Frame Allocator Core

| # | Document | Description |
|---|----------|-------------|
| 20 | [20-allocator/20-overview.md](20-allocator/20-overview.md) | Allocator phase overview |
| 21 | [20-allocator/21-frame-calculator.md](20-allocator/21-frame-calculator.md) | Frame size calculation |
| 22 | [20-allocator/22-zp-allocator.md](20-allocator/22-zp-allocator.md) | Zero page allocation |
| 23 | [20-allocator/23-frame-allocator.md](20-allocator/23-frame-allocator.md) | Main allocator class |

### Phase 3: Frame Coalescing

| # | Document | Description |
|---|----------|-------------|
| 30 | [30-coalescing/30-overview.md](30-coalescing/30-overview.md) | Coalescing phase overview |
| 31 | [30-coalescing/31-algorithm.md](30-coalescing/31-algorithm.md) | Coalescing algorithm |
| 32 | [30-coalescing/32-tests.md](30-coalescing/32-tests.md) | Coalescing test scenarios |

### Phase 4: Compiler Integration

| # | Document | Description |
|---|----------|-------------|
| 40 | [40-integration/40-overview.md](40-integration/40-overview.md) | Integration phase overview |
| 41 | [40-integration/41-semantic.md](40-integration/41-semantic.md) | Semantic analyzer integration |
| 42 | [40-integration/42-il.md](40-integration/42-il.md) | IL generator integration |
| 43 | [40-integration/43-codegen.md](40-integration/43-codegen.md) | Code generator integration |

### Execution Plan

| # | Document | Description |
|---|----------|-------------|
| 99 | [99-execution-plan.md](99-execution-plan.md) | Multi-session task breakdown |

---

## Quick Reference

### Final Decisions (Approved)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Recursion Handling | **Strict** - Compile error, no `recursive fn` |
| 2 | ZP Scoring | **Smart** - Auto-promotes hot variables |
| 3 | Frame Region Size | **Configurable** - Platform-specific |
| 4 | Coalescing | **Aggressive** - Maximize memory savings |
| 5 | ISR Handling | **Use `callback`** - No new syntax |

### Memory Layout (C64 Default)

| Region | Start | End | Size | Purpose |
|--------|-------|-----|------|---------|
| Zero Page | $02 | $8F | 142 bytes | Fast variables, @zp |
| Frame Region | $0200 | $03FF | 512 bytes | Function frames |
| General RAM | $0800+ | varies | ~38KB | @ram, globals |

### Storage Directives

| Directive | Effect |
|-----------|--------|
| `@zp` | **MUST** be in Zero Page (error if ZP full) |
| `@ram` | **MUST** be in RAM (never ZP) |
| (none) | Compiler decides based on ZP scoring |

---

## Research References

For deep-dive details, see the SFA research documents:

| Topic | Reference |
|-------|-----------|
| Design Philosophy | [../sfa_research/god-level-sfa/00-overview.md](../sfa_research/god-level-sfa/00-overview.md) |
| Data Structures | [../sfa_research/god-level-sfa/01-data-structures.md](../sfa_research/god-level-sfa/01-data-structures.md) |
| Call Graph | [../sfa_research/god-level-sfa/02a-call-graph-construction.md](../sfa_research/god-level-sfa/02a-call-graph-construction.md) |
| ZP Strategy | [../sfa_research/god-level-sfa/03-zeropage-strategy.md](../sfa_research/god-level-sfa/03-zeropage-strategy.md) |
| Coalescing | [../sfa_research/god-level-sfa/04a-coalescing-theory.md](../sfa_research/god-level-sfa/04a-coalescing-theory.md) |
| Integration | [../sfa_research/blend-integration/00-overview.md](../sfa_research/blend-integration/00-overview.md) |

---

## Implementation Strategy

### Test-Driven Development

1. **Test infrastructure first** - Create test helpers and fixtures before implementation
2. **Integration tests with each phase** - Not after
3. **E2E tests defined early** - Enabled incrementally as features complete
4. **Real-world scenarios** - Purpose-built test programs

### Session Size

- Each session: **15-20 minutes** of AI work
- ~50-100 lines of code per session
- Tests written WITH implementation (same session)
- Clear pass/fail criteria

---

## Success Criteria

The SFA implementation is complete when:

1. ✅ All type definitions implemented with unit tests
2. ✅ Frame allocator working with integration tests
3. ✅ Coalescing algorithm working with test scenarios
4. ✅ Semantic analyzer calls frame allocator
5. ✅ IL generator uses frame addresses
6. ✅ Code generator emits correct addressing modes
7. ✅ All E2E test scenarios pass
8. ✅ Real-world test programs compile correctly
9. ✅ Memory savings from coalescing verified (30-60%)
10. ✅ ZP allocation improves performance

---

**Next Document**: [01-requirements.md](01-requirements.md)