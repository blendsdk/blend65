# Keyboard and Combined-Input Closeout

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Correctness evidence complete; final reviews pending
> **Updated**: 2026-11-01 23:15 CET

## Scope

This closeout covers the ordinary saved-input and scoped CIA1 acquisition library
on the four cooperative C64 profiles under the `none` correctness baseline. The
`size` output limits remain experimental and are owned by the full RD-08
optimizer plan. No source workaround, runtime, loader, game policy or limit
change is included.

## Native evidence

| Evidence | Result |
|---|---|
| Saved/acquisition behavior suite | 76/76 cases pass under `none` |
| Saved matrix and native observation cases | Pass on all four profiles, including the existing 4,356 observations / 322,344 answers matrix |
| Saved query purity | 4/4 profile cases pass; saved bytes retained, no fresh scanner resources |
| Acquisition normal/timer/unavailable paths | 24/24 cases pass; 14 reads/15 writes, timer and PBON contracts retained |
| Acquisition predecessor ownership | 8/8 cases pass; chained and exclusive routes preserved |
| NMI immutable links | 12/12 cases pass after the approved held-P decoder/stack expectation correction |
| Restoration / ABI / accounting | Pass in the behavior and native cases; no behavior limit was changed |
| Input-library implementation closure | 2/2 new checks pass: private helper/callback reachability and non-overlay selected homes |

All VICE runs were sequential. The result is **VICE-verified /
hardware-unverified** on the four cooperative profiles; physical hardware and
other host classes remain later work.

## Known deferred reds

The three complete-size output files still report **12 failing cases**:

- acquisition/library payload `2442/963`;
- saved payload `1623/725`.

These are unchanged RD-08 optimizer targets. They are not deleted, skipped or
weakened. The full [RD-08 optimizer plan](../rd-08-optimizer/00-index.md) owns
their closure. This correctness track does not claim complete-size GREEN.

## Deferral-expiry check

The former whole-input prerequisite is stopped at 29/40. Its cost/observer
findings remain historical evidence; the new RD-08 plan owns the saved 725 and
acquisition 963 milestones. No deferral names a future slice of this keyboard
plan as its landing place. The only deferred items are the size-output limits
and physical/user-host qualification.

## Completion boundary

The keyboard source/API and correctness/native evidence are complete for this
track. Task 2.3.3 updates the platform guide; task 2.3.4 performs the final
independent review and records any finding. No publication, push or optimized
release claim follows from this document.
