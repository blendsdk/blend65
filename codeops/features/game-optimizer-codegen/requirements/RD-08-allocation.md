# RD-08: Register, Zero-Page and Static-Frame Allocation

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02–RD-07
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Allocate the NMOS 6502's A/X/Y registers, scarce zero page and statically allocated frame storage
as one whole-program problem. The allocator must minimize loads/stores/spills while respecting
special register roles, calls, interrupts, indirect addressing and static call-graph lifetimes.

## Functional Requirements

### Must Have

- [ ] Compute instruction-accurate liveness and interference for values, flags, A/X/Y, ZP slots,
  frame slots and call/interrupt boundaries. (AR-10)
- [ ] Model register-class constraints for accumulator operations, index addressing, shifts,
  comparisons, calls and implicit clobbers.
- [ ] Allocate hot values to registers/ZP using the exact cost vector and profile weights, not
  declaration order.
- [ ] Coalesce moves/copies when live ranges and required register states permit.
- [ ] Split live ranges and place spills/reloads at minimum-cost points rather than spilling a
  value for its entire lifetime.
- [ ] Overlay frame/ZP storage for call-graph-disjoint lifetimes and mutually exclusive regions.
- [ ] Reserve interrupt-safe storage for values live across IRQ/NMI interference and preserve
  reentrant/recursive constraints.
- [ ] Coordinate internal ABI argument/result locations with call-site allocation.
- [ ] Respect fixed platform/compiler ZP reservations and report exact remaining pressure.
- [ ] Use deterministic bounded regional search with a documented safe fallback.

### Should Have

- [ ] Rematerialize cheap constants/addresses instead of spilling when cheaper.
- [ ] Re-run local selection after allocation to exploit chosen register/addressing states.

### Won't Have

- Pretending A/X/Y are interchangeable general-purpose registers.
- Silent reuse of platform-reserved ZP.
- Allocation based only on source variable names or declaration scope.

## Technical Requirements

Allocation is hierarchical: whole-program storage classes and call overlays, regional
register/ZP decisions, then local repair/selection. Costs include extra bytes/cycles from every
move, spill, reload, register transfer and absolute-versus-ZP addressing change.

## Integration Points

- RD-04 supplies call graph/internal ABI; RD-07 supplies memory objects.
- RD-09 performs selection with allocation alternatives.
- RD-13 supplies interrupt entry/clobber/timing contracts.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Resources | Joint A/X/Y + ZP + static frame | AR-10 |
| Search | Deterministic bounded regional + safe fallback | AR-10, AR-15 |
| IRQ safety | Explicit interference/reservations | AR-14 |

## Security Considerations

Allocation graphs and candidate fronts are size-bounded with checked cost arithmetic. Failure to
allocate returns a deterministic compiler diagnostic/ICE before emission; it never overlaps live
storage or reserved regions.

## Acceptance Criteria

1. [ ] A hot byte loop value remains in the cheapest legal register/ZP state across iterations
   without redundant absolute frame loads/stores.
2. [ ] A value used as an index is placed in X/Y when that lowers complete path cost; accumulator
   constraints remain valid.
3. [ ] Two call-graph-disjoint frames/ZP ranges overlay; recursive or concurrently interrupt-visible
   ranges never overlap.
4. [ ] Move coalescing removes a copy only when source/destination live ranges do not interfere.
5. [ ] Spill splitting places reloads only on paths that use the value and improves the linked cost
   over whole-range spilling.
6. [ ] Every call and intrinsic clobber invalidates the exact affected register facts.
7. [ ] Platform-reserved ZP bytes remain untouched, and the report's used/free totals equal the
   target profile exactly.
8. [ ] Two fresh allocations of the same program/profile produce byte-identical plans.
9. [ ] A forced search-budget exhaustion uses the safe fallback, preserves semantics and reports
   the fallback in quality evidence rather than silently claiming optimality.
