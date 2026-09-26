# Requirements Delta: RD-05 Stage A

> **Parent**: [Index](00-index.md)
> **Source**: [RD-05](../../requirements/RD-05-c64-platform-profiles-and-game-workload-compiler-support.md) — owning requirements document

## Scope of This Plan

AR-P3/AR-P4 authorize a bounded first stage, not removal or weakening of any RD requirement.
The following table accounts for all R5.1–R5.56; the RD retains their full wording and acceptance
criteria. Partial coverage must not mark an RD requirement or acceptance criterion complete.

| Requirement keys | Stage A treatment / remaining owner |
|---|---|
| R5.1–R5.4, R5.6–R5.7 | Cooperative-family subset, source facts and existing operations only. Later RD-05 planning retains takeover, future operation state and full eight-profile qualification. |
| R5.5 | Later RD-05 planning; depends on the unresolved interrupt/source and banking contract. |
| R5.8–R5.14 | Later RD-05 memory/banking and named-device work; existing layout/effects are preserved, not claimed complete. |
| R5.15–R5.23 | Later RD-05 interrupt/timing work, including AR-P3 and carried handler-side IRQ work. Existing negative safety checks remain. |
| R5.24–R5.28 | Later RD-05 input and direct display operations. Existing M1 APIs are compatibility obligations only. |
| R5.29–R5.34 | Later RD-05 user-authored sprite, scrolling and buffering qualification. |
| R5.35–R5.40 | Later RD-05 SID/player-adapter work; Stage A identifies the SID but adds no audio operation. |
| R5.41–R5.46 | Later RD-05 user-authored state/data workload qualification. |
| R5.47–R5.56 | Apply diagnostics, independent oracles, output quality and impact-based verification to this stage. Full reports, examples, workloads, responsiveness and RD closeout remain later RD-05 work. |

AC-01–AC-06 cannot be closed by this stage: their whole-RD inventories, ownership-mode pairs
and eight-profile proofs exceed this scope. All other RD acceptance criteria retain their owners.
Existing manifests may recognize more IDs than the current executable compiler supports.

## Plan-Local Decisions

| Concern | Owning decision / specification |
|---|---|
| Staging and NMI safety | AR-P3/AR-P4; no new interrupt route, scoped banking or takeover execution |
| Missing library bindings | AR-P2/AR-P5; [03-01](03-01-profile-facts.md) |
| Implementation and compatibility | AR-P6/AR-P7; [03-02](03-02-cooperative-pipeline.md) |
| Verification and host boundary | AR-P8; [07](07-testing-strategy.md) |

Native assets remain RD-06; loading/D64 remains RD-07; optional optimization remains RD-08;
developer tooling remains RD-09; Windows and physical-machine qualification remain RD-10
(AR-P1). No additional host access is requested for this stage.

## Stage Acceptance

Stage A is complete only when its execution tasks and independent reviews are green, its
[ST cases](07-testing-strategy.md#specification-test-cases) pass, and its stage handoff records
the remaining RD-05 ownership. It must not claim usable NMI, raw takeover, complete platform
support or physical-machine qualification. No requirement checkboxes are duplicated here.

At the handoff, check whether the delivered profile facts expire any existing deferral rationale.
Retain AR-P3 and the handler-side IRQ obligation explicitly unless their own proofs are separately
resolved. The full mandatory RD-closeout deferral audit still applies when RD-05 actually closes.
