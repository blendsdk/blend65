# Cross-join NMI sample consumption — execution plan

> **Owner**: issue [#152](https://github.com/blendsdk/blend65/issues/152), blocked slice.
> **Scope mode**: strict. No new runtime, source restriction or `spec/` change.

## Problem

The `CROSS_JOIN` handler retains a sample across an if/else join. The current sequence loads the
slot in the then arm and pops it once at the join: 36 bytes, peak 6. The expert pops once per arm
and carries the sample in A to the join: 27 bytes, peak 5.

## Decision

The required proof is a per-predecessor stack and A fact:

- Mark the then arm's last load as a pop.
- Insert an explicit pop at the end of the else arm, which has no source load.
- Forward the join's load from A because every predecessor leaves the same sample there.
- Drop the wrapper's X save once no `TSX`/slot load remains.

The current plan marks only the last load in the single return block, so it cannot express this
shape. Implementing it without the complete per-path proof risks a double pop or a stale A. The
slice is **blocked**; no code, oracle or limit is changed.

## Tasks

- [x] T-152.1 Record the current `CROSS_JOIN` oracle and the 36-byte / peak-6 sequence.
- [x] T-152.2 Identify the missing per-predecessor consume/A-merge fact.
- [ ] T-152.3 Add the plan and machine forwarding facts.
- [ ] T-152.4 Rebind the wrapper without the X save.
- [ ] T-152.5 Four-profile byte/cycle/peak and genuine-NMI runtime evidence.

## Acceptance

| Area | State |
| --- | --- |
| Current behavior and single ICR read | Pinned by the existing oracle; unchanged. |
| Expert 27 bytes / peak 5 | **Open** — requires the per-path consume proof. |
| No double pop or stale A | Enforced by the missing proof; no partial change is made. |

## Residuals

| Residual | Owner |
| --- | --- |
| Per-predecessor retention and A merge | #152 |
| Wrapper X-save removal | #152 |

## Constraints

- `spec/` and the ledger stay byte-identical. No test or VICE journey is weakened. No push.
