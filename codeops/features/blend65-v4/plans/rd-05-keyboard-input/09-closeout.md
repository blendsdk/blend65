# Keyboard and Combined-Input Closeout

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Stopped at 46/48 — native coverage gaps recorded as open debt; RD-08 optimizer track started
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
| Saved matrix and native observation cases | Pass on all four profiles for saved software data; 4,356 observations / 322,344 answers |
| Saved query purity | 4/4 profile cases pass; saved bytes retained, no fresh scanner resources |
| Acquisition normal/timer/unavailable paths | 24/24 cases pass with released contacts; 14 reads/15 writes, timer and PBON contracts retained |
| Acquisition predecessor ownership | 8/8 cases pass; chained and exclusive routes preserved |
| NMI immutable links | 12/12 static link cases pass after the approved held-P decoder/stack expectation correction; live `none` callback quality is still Unknown |
| Restoration / ABI / accounting | Pass in the inspected behavior/native cases; external NMI stack/ROM/deadline remain Unknown |
| Input-library implementation closure | 2/2 new checks pass: private helper/callback reachability and owner-mapped selected private homes |

All VICE runs were sequential. The result is **VICE-verified /
hardware-unverified** on the four cooperative profiles; physical hardware and
other host classes remain later work.

## Known deferred reds

The three complete-size output files still report **12 failing cases**:

- acquisition/library payload `2442/963` for `none`;
- saved `none` payload `2163/725`; the RD-08 LowByte candidate is `1623`, still above 725.

These are not correctness assertions. The full RD-08 plan owns both the current
reds and the candidate cost.

These are unchanged RD-08 optimizer targets. They are not deleted, skipped or
weakened. The full [RD-08 optimizer plan](../rd-08-optimizer/00-index.md) owns
their closure. This correctness track does not claim complete-size GREEN.

## Deferral-expiry check

The former whole-input prerequisite is stopped at 29/40. Its cost/observer
findings remain historical evidence; the new RD-08 plan owns the saved 725 and
acquisition 963 milestones. No deferral names a future slice of this keyboard
plan as its landing place. The only deferred items are the size-output limits, native
pressed-contact/live-NMI/STOP-RESTORE coverage and physical/user-host qualification.

## Completion boundary

The keyboard source/API is implemented and its saved/acquisition behavior evidence
passes. The native pressed-contact, live returning-NMI, STOP/RESTORE and callback
order evidence remains partial. Task 2.3.3 updated the platform guide; task 2.3.4
remains blocked on those native coverage findings. The user stopped this track at 46/48 and started RD-08; the gaps remain tracked, not waived. No publication, push or optimized
release claim follows from this document.

## Native coverage gaps

- No current test presses a real matrix key or joystick and calls `readInputSnapshot()`.
- No `none` test injects a returning NMI into the actual `interruptScan` callback.
- No current test exercises genuine STOP/RESTORE or a changing-key false STOP.
- The callback marker order and interrupted raw rows are not independently traced.
- External NMI stack, retained-firmware completion and finite deadlines remain Unknown.

These are covered by the review findings and require an approved native test/oracle
scope before task 2.3.2/2.3.4 can close.
