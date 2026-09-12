# C64, Language Guard, and Diagnostics: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-04-c64-guard-and-diagnostics.md
> **Parent**: [Index](00-index.md)

## Overview

This component makes C64 the only normative target family, removes false target authority, updates
the Language Guard, and closes whole-spec grammar and diagnostic integrity. RD-01 R1.15–R1.20 own
the platform and validation behavior.

## Architecture

### Current Architecture

P3 presents C64, C64U, Commander X16, Atari 800XL, and Atari 7800 as active targets. The Guard also
assumes five targets. C64 asset, profile, loader, and product-boundary statements are distributed
across the introduction, platform chapter, data-inclusion chapter, appendix, evaluations, and
expert knowledge.

### Proposed Changes

`spec/appendix-c64.md` becomes the sole normative machine appendix. Core chapters remain target
neutral. `spec/future-considerations.md` retains only explicit non-supporting constraints for future
targets. The four non-C64 appendices and obsolete workflow/migration documents are removed from the
active tree and accounted for in the closeout crosswalk. See AR-P2, AR-P5, and RD-01 R1.15–R1.18.

## Implementation Details

### C64 Authority Owners

| Concern | Normative owner | Consistency owners |
|---|---|---|
| Exact active profile IDs and common fields | `spec/15-platform-profile.md` | Introduction, inventory, C64 appendix |
| CPU/video/startup/banking/IRQ/SID/exit facts | `spec/appendix-c64.md` | Platform chapter and affected evaluations |
| Native asset formats and Koala byte meaning | `spec/13-data-inclusion.md`; C64 appendix | `F015-data-inclusion.md` |
| D64/KERNAL loader and `HLE-010` | C64 appendix | Data-inclusion chapter, F015, future constraints |
| Product boundary | C64 appendix | Feature index and later expert references |
| Future-target constraints | `spec/future-considerations.md` | Non-normative only |

The appendix defines typed hardware operations and exact external adapter contracts but no renderer,
game loop, scene system, scheduler, mixer, collision system, or gameplay policy.

### Target Removal

Delete exactly:

- `spec/appendix-c64u.md`
- `spec/appendix-cx16.md`
- `spec/appendix-a800xl.md`
- `spec/appendix-a7800.md`

Delete obsolete `spec/build-plan.md`, `spec/preflight-report.md`, and
`spec/v2-to-v3-migration.md` after their P3 dispositions are captured in the crosswalk. Any useful
future-target constraint must first be restated narrowly in the non-normative future register.

### Language Guard

Update `.clinerules/language-guard.md` to identify Specification 4.0, evaluate all qualified active
profiles, and separate target conformance from future-target pressure. Each changed feature's
evaluation records all 23 results. Conditional results name the authorized condition; a failed
result blocks the candidate. The Guard remains one framework, not duplicated in the plan.

### Grammar and Diagnostic Closure

After semantic/platform content is complete, compare positive and invalid examples against the one
grammar, verify every diagnostic owner against `spec/14-diagnostics.md`, and check reserved/retired
codes. The final registry comparison includes E10101, E10267–E10271, and the distinct load-
invalidation diagnostic required by R1.20. Phase 4 may repair only derived inconsistencies; a new
semantic choice reopens the ambiguity gate.

## Integration Points

| Consumer | Contract |
|---|---|
| Normative inventory | Exactly one C64 appendix and no normative false-target path |
| Core semantics | Target-neutral meaning with profile-linked legality/effects only |
| Expert skill | Receives exact C64 facts, sources, HLE, and product boundary |
| RD-02 | Accepts only the nine normative C64 profile identifiers |
| RD-10 | Owns later production and C64U handoff qualification |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Removed appendix contains a needed future constraint | Move only the constraint to non-normative future text before deletion | AR-P6 |
| Any changed feature has a failed Guard rule | Block candidate freeze | AR-P4 |
| Diagnostic or grammar mismatch is semantic | Reopen the ambiguity gate; do not make a derived repair | AR-P1 |
| C64 module promises application policy | Remove the promise and keep only hardware/adapter authority | AR-P2 |

## Testing Requirements

- ST-21–ST-28 cover exact targets, removed claims, assets, loader, product boundary, Guard,
  diagnostics, and stale identity.
- `tests/c64-guard-diagnostics.spec.test.md` is authored before platform edits.
- `tests/c64-guard-diagnostics.impl.test.md` records exact set comparisons, negative searches,
  all-23 Guard coverage, grammar/example checks, and diagnostic closure.
