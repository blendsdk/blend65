# RD-13: Hardware-Aware and Timing-Constrained Code Generation

> **Status**: Approved
> **Created**: 2026-07-24
> **Project**: Commercial-Game Optimizer and Code Generator
> **Depends On**: RD-02–RD-12
> **Complexity**: XL
> **CodeOps Artifact Schema**: 1

## Feature Overview

Preserve and exploit C64/NMOS 6502 hardware behavior: volatile VIC/CIA/SID access, interrupt
interference, raster deadlines, page-cross costs and frame budgets. Hardware contracts are named
and measurable without forcing ordinary Blend65 programmers to hand-schedule assembly.

## Functional Requirements

### Must Have

- [ ] Treat every declared volatile/MMIO read/write and CPU-control intrinsic as an ordered effect
  with exact value, count and relative-order obligations. (AR-14)
- [ ] Model IRQ/NMI entry roots, clobbers, nesting policy, mainline interference and atomicity.
- [ ] Define external configuration/fixture contracts for maximum frame cycles, IRQ path cycles,
  interrupt latency, raster completion points and forbidden jitter.
- [ ] Verify worst-case path cost including taken branches, page crossings, calls, helpers and
  interrupt save/restore.
- [ ] Optimize MMIO setup/update sequences only when all ordering/effect contracts remain true.
- [ ] Consume provider-owned named-register/platform-library contracts and compile their lowering
  hooks efficiently; user source need not spell magic addresses or block granularities. (AR-20)
- [ ] Schedule hot frame/IRQ work against hard budgets before accepting code-size trade-offs.
- [ ] Preserve self-consistency when code/data relocation changes page-cross and raster costs.
- [ ] Execute timing-critical acceptance workloads on cycle-accurate VICE and distinguish semantic,
  deadline and jitter failures.
- [ ] Keep incidental timing outside the language semantics when no timing contract is declared.

### Should Have

- [ ] Certify provider-owned platform primitives for common raster wait, sprite update, SID
  cadence and CIA/input sequences at zero wrapper overhead.
- [ ] Report the critical path and remaining cycle slack for each declared budget.

### Won't Have

- Silent dependence on KERNAL boot state.
- Treating faster ordinary code as a semantic change.
- Source syntax changes without the Language Guard.

## Technical Requirements

Timing contracts bind program/profile/target/VICE revisions and named completion observations.
Worst-case analysis is conservative; unknown/unbounded paths cannot satisfy a deadline. Hardware
register metadata owns volatility, access width, side effects and ordering groups.

The target contract also owns observable bus accesses and interrupt sampling: NMOS dummy
reads/writes, read-modify-write double writes, read-to-clear/write-to-ack registers, indexed dummy
access into I/O, CLI/SEI recognition latency, IRQ/NMI priority/simultaneous arrival and nesting.
Transforms preserve the declared bus trace and sampling behavior or remain unmodeled.

## Integration Points

- Platform packages/libraries supply named hardware contracts.
- RD-12 supplies profile weights; RD-14 validates with VICE.
- IRQ/raster/source-level syntax beyond current v3 remains an explicit conformance/future-spec
  dependency.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| MMIO | Ordered volatile effects | AR-7, AR-14 |
| Timing | Explicit named contracts only | AR-14 |
| Ergonomics | Zero-cost named APIs, inferred hardware lore | AR-20 |

## Security Considerations

Register/timing schemas use allowlisted targets and finite addresses/cycles. VICE execution is
isolated and bounded. Generated programs cannot choose host monitor commands, paths or arbitrary
completion scripts.

## Acceptance Criteria

1. [ ] Reordering, merging or deleting any MMIO access in a seeded sequence fails the semantic
   effect oracle.
2. [ ] An IRQ/mainline fixture preserves live shared state and declared clobbers under every
   profile.
3. [ ] A raster kernel exceeding its exact worst-case budget by one cycle fails with the critical
   path and delta.
4. [ ] Page relocation that adds a page-cross cycle is reflected in the final timing result.
5. [ ] Missing/unbounded completion paths cannot satisfy a frame/IRQ deadline.
6. [ ] A faster ordinary non-timed routine remains semantically valid.
7. [ ] Named platform primitives emit instruction-for-instruction equal or better code than their
   expert twins with zero wrapper overhead.
8. [ ] VICE distinguishes wrong memory state, missed completion, timeout and cycle-budget failure.
9. [ ] Reports contain exact slack for every passing frame/IRQ contract.
10. [ ] MMIO RMW versus load/modify/store, indexed dummy-access, IRQ acknowledgement, CLI latency,
    simultaneous IRQ/NMI and nested-interrupt counterexamples preserve the target-declared trace.
