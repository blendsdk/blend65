# Qualification and Activation: Specification 4.0 and Expert Authority Freeze

> **Document**: 03-06-qualification-and-activation.md
> **Parent**: [Index](00-index.md)

## Overview

This component qualifies the immutable Spec 4/expert `2.0.0` candidate, obtains explicit authority
approval, activates the one release record, and freezes the result for RD-02. RD-01 R1.22–R1.25 own
the acceptance sequence.

## Architecture

### Current Architecture

The v1.0 release record already distinguishes deterministic gates, complete blind coverage,
focused correction evidence, independent grading, and immutable content/release checkpoints. P3
evidence is historical input and cannot be relabelled for Spec 4.

### Proposed Changes

Reuse the composed-evidence method under AR-P3. Qualification closes in two checkpoints:

1. immutable Spec 4 and expert `2.0.0` candidate content with complete evidence;
2. post-approval release bookkeeping and roadmap/closeout state.

The first checkpoint never contains an active `2.0.0` release claim. The second cannot change
candidate router, references, cases, or normative specification bytes.

## Implementation Details

### Candidate Qualification

Run deterministic structural/source/oracle checks first, then independent changed-surface and
dependency-traced review. Run one complete isolated blind sample for the full case inventory, with
the candidate packet as the only project content visible to the evaluator and the oracle visible
only to an independent grader. Negative and positive sandbox controls are required.

A knowledge or oracle defect invalidates its changed and dependency-traced evidence and returns to
review plus focused reruns. An evaluator-only omission may receive a fresh response capture without
invalidating unrelated passing evidence. Final evidence is composed; no single lucky transcript is
required. See RD-01 R1.22 and AR-P3.

### Candidate Content Checkpoint

After every case has applicable green evidence and independent review has zero unresolved critical
or major finding, verify the exact content allowlist and commit the immutable candidate. Record its
commit ID in a temporary Phase 8 activation packet; do not amend the checkpoint.

### Explicit Approval Gate

Present the user with the complete change summary, Guard result, qualification evidence, removed
target claims, future constraints, Spec identity, raw hashes, and candidate content commit. The
user must explicitly approve activation. A prior approval of the requirements or plan does not
satisfy this gate.

### Atomic Activation

After approval, edit the sole `qualification/release.md` to activate `2.0.0` and bind the immutable
content commit and Spec identity. Finalize `08-closeout.md`, update the feature roadmap, and commit
the release tail. The active skill tree must expose exactly one release, and no candidate content
may differ from the qualified checkpoint.

### Deferral-Expiry Gate

Before RD-01 closes, walk the v4 ambiguity register, RD-01 Won't Have, P3
`future-considerations.md`, and expert deferrals. Record whether the new frozen authorities remove
any stated rationale. Reopen every expired item with a named successor owner; RD-01 cannot close
while one of its own future slices remains named as an orphaned owner.

## Integration Points

| Consumer | Contract |
|---|---|
| `qualification/coverage-matrix.md` | Complete final case/source/spec dependency state |
| `qualification/release.md` | Sole active expert release after approval only |
| `08-closeout.md` | Complete crosswalk, hashes, evidence, approval, freeze, and deferral answer |
| Feature roadmap | Moves Plan Created → Plan Preflighted → Executing → Done |
| RD-02 | Reproduces identities and verifies zero post-freeze spec drift |

## Error Handling

| Error case | Handling strategy | AR Ref |
|---|---|---|
| Deterministic check fails | Do not evaluate; repair candidate and rerun affected gates | AR-P4 |
| Independent critical/major finding | Block activation; resolve and re-review blast radius | AR-P3 |
| User does not approve | Keep v1.0 active; preserve candidate evidence; stop | AR-P6 |
| Release-tail changes candidate content | Invalidate activation and return to qualification | AR-P3 |
| Expired deferral has no owner | Block RD closeout | AR-P6 |

## Testing Requirements

- ST-34–ST-40 cover composed evidence, isolation, review, approval, release binding, freeze, and
  deferral closeout.
- `tests/qualification-activation.spec.test.md` is authored before qualification/release changes.
- `tests/qualification-activation.impl.test.md` records exact packet, command, evaluator, grader,
  review, hash, allowlist, approval, and negative mutation evidence.
