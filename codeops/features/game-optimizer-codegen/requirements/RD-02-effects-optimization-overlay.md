# RD-02: Effect Model and Optimization Overlay

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-01
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Build the semantic substrate for aggressive optimization without replacing the shipped mutable TAC
boundary. Each function receives a derived SSA value graph, dominance/loop structure and memory
effect graph. All transformations must preserve the closed observable-effect model.

## Functional Requirements

### Must Have

- [ ] Construct a deterministic derived SSA/value graph from every valid canonical `ILProgram`;
  the canonical serialized IL remains unchanged at the public boundary. (AR-6)
- [ ] Represent φ-like merge values, def-use chains, dominators, post-dominators, natural loops and
  irreducible regions without exposing a third public lowering level.
- [ ] Model ordinary locals/frames, module storage, const data, zero page, indirect memory,
  absolute memory and unknown/escaped memory as explicit alias regions. (AR-7)
- [ ] Classify reads, writes, volatile/MMIO, calls, intrinsics, interrupts, termination and unknown
  effects in one closed effect vocabulary.
- [ ] Preserve source evaluation order, integer width/sign/wrap behavior and short-circuit control
  flow exactly.
- [ ] Treat volatile/MMIO and CPU-control operations as ordered barriers unless a stronger
  target-specific proof explicitly permits a rewrite. (AR-14)
- [ ] Produce proof queries consumed by all later passes: `mayAlias`, `mayRead`, `mayWrite`,
  `mayTrapOrTerminate`, `isVolatile`, `isInterruptVisible`, and `isMotionSafe`.
- [ ] Lower optimized overlay results back to valid canonical IL with deterministic temp/block
  naming and no semantic loss.
- [ ] Reject unsupported/malformed IL with an ICE before transformation; never guess effects.

### Should Have

- [ ] Cache immutable analyses by canonical IL and effect-model revision.
- [ ] Emit a developer-only graph form suitable for failure diagnosis.

### Won't Have

- Optimistic aliasing based on naming conventions.
- Treating all memory as volatile.
- Persisting the optimization overlay as a stable public ABI.

## Technical Requirements

The effect lattice must distinguish at least:

| Effect | Reorder/remove rule |
|---|---|
| Pure | May move when operands dominate and termination is preserved |
| Ordinary read | May move across proven non-aliasing writes |
| Ordinary write | Requires alias and liveness proof |
| Volatile/MMIO read | Never remove, merge or reorder across another ordered effect |
| Volatile/MMIO write | Preserve value, count and order |
| CPU-control intrinsic | Full ordered barrier unless its contract states otherwise |
| Call | Use content-revisioned summary; unknown call is conservative |
| Interrupt-visible access | Respect interrupt interference and atomicity |
| Termination/unknown | Blocks speculative motion |

## Integration Points

- Consumes canonical IL and source-derived type/effect metadata from the compiler.
- Supplies summaries and proof queries to RD-04–RD-11.
- RD-14 independently validates round-trip and effect preservation.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Optimizer representation | Derived SSA/value-memory overlay | AR-6 |
| Memory safety | Closed conservative alias/effect model | AR-7 |
| Hardware ordering | Volatile/CPU barriers | AR-14 |

## Security Considerations

Graph construction is bounded by validated IL size and uses checked arithmetic for node/edge
counts. Debug output uses stable symbols, not host paths. No dynamic evaluation, module loading,
shell or network access is permitted.

## Acceptance Criteria

1. [ ] Building and immediately lowering the overlay for every committed IL golden yields canonical
   IL with identical observable behavior and deterministic text.
2. [ ] A diamond CFG creates one merge value per live variable and reconstructs both predecessor
   stores correctly.
3. [ ] An irreducible CFG is classified and processed conservatively without nontermination.
4. [ ] Two non-escaping distinct frame slots return `mayAlias=false`; an escaped or unknown pointer
   returns `mayAlias=true`.
5. [ ] A `poke`, volatile `peek`, CPU-control intrinsic and unknown call cannot be removed or moved
   across one another.
6. [ ] Byte, sbyte, word and sword boundary operations retain exact wrap/sign behavior through
   overlay round-trip.
7. [ ] A missing call summary behaves as read/write/termination unknown and cannot produce a
   speculative optimization.
8. [ ] A generated interrupt/mainline fixture retains every interrupt-visible access under all
   pass profiles.
9. [ ] Graph construction exceeding its declared node/edge limit returns a classified bounded
   failure and emits no partially optimized IL.
