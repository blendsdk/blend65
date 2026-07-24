# RD-15: Game-Shaped Corpus and Commercial Acceptance Gate

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01, RD-09–RD-14
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Judge the compiler on original game-shaped kernels and complete programs rather than a corpus
dominated by constant microfixtures. The gate represents scrolling, sprite, sound, input, AI,
collision, animation, streaming boundaries and interrupt/mainline behavior under expert twins and
hard frame/memory budgets.

## Functional Requirements

### Must Have

- [ ] Maintain a manifest whose rows name fixture kind, workload class, semantic rules, target,
  execution route, twin, budgets, capability dependencies and ownership. (AR-19, AR-24)
- [ ] Include original kernels for vertical/horizontal scrolling, screen/colour/bitmap update,
  sprite multiplexing/pointer animation, collision, input, AI, decompression, sound cadence,
  IRQ/mainline coordination and loader/streaming boundaries.
- [ ] Include at least three complete original programs: smooth horizontal scroller, vertical
  action scroller, and isometric/multiload engine shell using substitute assets/data.
- [ ] Give every performance fixture an expert hand-written twin or a documented reason it cannot
  yet participate; no waiver counts toward acceptance.
- [ ] Measure exact linked bytes/cycles/RAM/ZP/padding, hot paths, frame/IRQ budgets and runtime
  helper costs under reference/static/PGO profiles as applicable.
- [ ] Require each routine to meet or beat the expert twin and the whole program to beat the
  realistic expert result on its active objective; meet-only results file debt. (AR-1)
- [ ] Require all semantic/timing obligations to pass RD-14 independently.
- [ ] Keep capability blockers distinct: an optimizer pass cannot turn missing streaming/overlay/
  indirect-call/sound/library functionality into a pass. (AR-3, AR-24)
- [ ] Gate corpus completeness: every fixture directory has exactly the artifacts its manifest tier
  requires and no untracked game fixture can appear.
- [ ] Update the game-feasibility matrix only after the complete applicable capability ships.

### Should Have

- [ ] Add one game-shaped regression for every optimizer defect class found in production work.
- [ ] Track compile-time/search-budget fallbacks in corpus reports.

### Won't Have

- Copyrighted game code/assets.
- Reduced-scope acceptance that drops characteristic scrolling, multiplexing, streaming or sound.
- A single aggregate ratio that hides a failing routine or hard budget.

## Technical Requirements

The manifest distinguishes `kernel`, `whole-program`, `probe`, `negative` and `future-capability`.
Acceptance uses per-row gates plus an aggregate summary. Programs use deterministic generated or
repository-owned assets and stable VICE workloads.

## Integration Points

- Extends asm-parity infrastructure/ratchets rather than copying it.
- Uses RD-14 semantic/timing results and RD-16 reports.
- RD-17 owns missing external-capability routes.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Workloads | Game-shaped kernels + whole programs | AR-2, AR-19 |
| Parity | Local floor, whole-program win | AR-1, AR-16 |
| Missing capability | Explicit blocker, never optimizer pass | AR-3, AR-24 |

## Security Considerations

Fixtures/assets are repository-owned and license/provenance recorded. Asset and manifest paths are
canonical/relative. VICE execution remains isolated/bounded and reports exclude host data.

## Acceptance Criteria

1. [ ] Manifest and fixture directory agree exactly; missing/extra fixtures and missing/forbidden
   artifacts fail with the offender named.
2. [ ] The corpus contains all eleven workload categories listed above and all three complete
   original program classes.
3. [ ] Every counting performance row has an expert twin, exact budget and independent semantic
   result.
4. [ ] No routine exceeds a 1.0 expert bytes/cycles ratio on its active objective; every meet-only
   row links a concrete improvement issue.
5. [ ] Each complete program beats its realistic expert whole-program result while satisfying all
   frame/IRQ/RAM/ZP/stack budgets.
6. [ ] A one-cycle frame-budget miss, one-byte memory-region overflow or one semantic mismatch
   blocks the commercial gate regardless of aggregate improvement.
7. [ ] Removing characteristic scrolling/multiplexing/streaming behavior cannot make a fixture pass
   as faithful.
8. [ ] Copyright/license provenance validation rejects unapproved third-party code/assets.
9. [ ] Commando-class optimizer evidence and Last Ninja-class streaming dependency are reported
   separately and cannot satisfy each other.
10. [ ] The feasibility matrix changes only when all named dependencies for a game row are shipped
    and the faithful acceptance workloads pass.
