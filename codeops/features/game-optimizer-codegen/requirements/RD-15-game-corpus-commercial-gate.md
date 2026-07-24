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

- [ ] Maintain a manifest whose rows name a stable workload ID, fixture kind, semantic rules,
  target, execution route, `CommercialWorkloadContract`, budgets, capability dependencies and
  ownership. (AR-19, AR-24)
- [ ] Cover every closed workload ID in the table below; prose labels never define completeness.
- [ ] Include at least three complete original programs: smooth horizontal scroller, vertical
  action scroller, and isometric/multiload engine shell using substitute assets/data.
- [ ] Give every performance fixture an expert hand-written twin or a documented reason it cannot
  yet participate; no waiver counts toward acceptance.
- [ ] Measure exact linked bytes/cycles/RAM/ZP/padding, hot paths, frame/IRQ budgets and runtime
  helper costs under reference/static/PGO profiles as applicable.
- [ ] Require final output to have both byte and cycle ratios ≤1.0 for each expert-covered routine
  and each complete program to strictly beat its versioned expert workload contract on the active
  objective; exact meets always file improvement debt. (AR-1)
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

| Workload ID | Required behavior |
|---|---|
| `scroll-horizontal` | Smooth horizontal screen/colour/bitmap update |
| `scroll-vertical` | Smooth vertical screen/colour/bitmap update |
| `sprite-multiplex` | Multiplexing plus pointer animation |
| `collision` | Game-shaped collision detection/response |
| `input` | Joystick/keyboard input cadence |
| `ai` | Bounded game-agent decision/update loop |
| `decompression-boundary` | Optimizer-owned calls across a provider decompression boundary |
| `sound-cadence-boundary` | Optimizer-owned scheduling across a provider sound boundary |
| `irq-mainline` | Interrupt/mainline interference and deadlines |
| `loader-stream-boundary` | Optimizer-owned state around provider loader/stream events |
| `animation-update` | Frame animation/state update |

Each complete program owns a versioned `CommercialWorkloadContract` containing scenario inputs,
frame count/duration, completion observations, fidelity invariants, required capability events,
source/asset provenance, expert artifact and independent approval revisions, routine mapping,
active objective, both local floors, hard budgets and exact measurement route. Negative mutations
remove each characteristic behavior and must fail its fidelity oracle. Baseline changes require
independent approval and a new content revision.

Two distinct gates are published:

- `optimizer-commercial-quality` may close using optimizer-owned behavior plus provider-boundary
  fixtures; external capabilities remain named blockers and cannot be simulated as shipped.
- `commercial-toolchain-ready` is a portfolio gate outside this feature and requires every provider
  plus faithful end-to-end complete programs to ship.

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
2. [ ] The manifest covers each of the eleven closed workload IDs exactly as required and contains
   all three complete original program classes.
3. [ ] Every counting performance row has an expert twin, exact budget and independent semantic
   result.
4. [ ] No final routine exceeds 1.0 on either expert byte or cycle ratio; every exact-meet row links
   a concrete improvement issue.
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
11. [ ] Removing any fidelity invariant or characteristic event fails a negative mutation and
    cannot improve a workload into acceptance.
12. [ ] `optimizer-commercial-quality` can pass with explicit provider blockers, while
    `commercial-toolchain-ready` remains blocked until those exact provider claims ship.
