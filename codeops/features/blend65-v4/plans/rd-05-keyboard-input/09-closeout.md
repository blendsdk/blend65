# Keyboard and Combined-Input Closeout

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Native evidence complete at 47/48 — independent phase-2 reviews and closeout remain
> **Updated**: 2026-11-07 CET

## Scope

This closeout covers the ordinary saved-input and scoped CIA1 acquisition library
on the four cooperative C64 profiles under the `none` correctness baseline. The
`size` output limits remain experimental and are owned by the full RD-08
optimizer plan. No source workaround, runtime, loader, game policy or limit
change is included.

## Native evidence

| Evidence | Result |
|---|---|
| Held keyboard matrix | 64 coordinates × 4 profiles = **256 native scans**; exact driven-column raw rows and COMPLETE quality through `readInputSnapshot` |
| Simulated joystick states | 32 states × both ports × 4 profiles = **256 native scans**; exact raw joystick bytes and COMPLETE quality through `readInputSnapshot` |
| Live returning RESTORE | **4 native cases**; the actual `interruptScan` callback runs, the stock predecessor returns, quality is INTERRUPTED, retained rows stay readable and both named queries are UNCERTAIN |
| Callback marker order | **4 native traces**; the handler's CIA1 PA=$7F store is immediately followed by the interruption marker store |
| False-STOP witness | **4 native cases** with Cursor U/D held; the returning RESTORE does not reach the stock TIMB $FE66 path |
| Genuine STOP | **4 native cases** with STOP held; the RESTORE reaches the stock TIMB $FE66 path |
| Saved/acquisition behavior suite | 76/76 cases pass under `none` |
| Saved matrix and native observation cases | Pass on all four profiles for saved software data; 4,356 observations / 322,344 answers |
| Saved query purity | 4/4 profile cases pass; saved bytes retained, no fresh scanner resources |
| Acquisition normal/timer/unavailable paths | 24/24 cases pass with released contacts; 14 reads/15 writes, timer and PBON contracts retained |
| Acquisition predecessor ownership | 8/8 cases pass; chained and exclusive routes preserved |
| NMI immutable links | 12/12 static link cases pass after the approved held-P decoder/stack correction; the live `none` callback quality now passes the returning native case |
| Restoration / ABI / accounting | Pass in the inspected behavior/native cases; external NMI stack/ROM/deadline remain Unknown |
| Input-library implementation closure | 2/2 new checks pass: private helper/callback reachability and owner-mapped selected private homes |

The new [native specification](../../../../../test/rd05/input-native-qualification.spec.test.ts)
runs **20 directed tests / 524 native scans** on all four profiles in one
sequential VICE/GDB pass. The debugger calls the unmodified VICE
`keyboard_event_playback` and `machine_set_restore_key` on the emulation thread at
`kbuf_feed`; no ROM bytes, CPU frames, CIA pins or source bytes are patched.
Matrix injection uses the 16-entry VICE PA→PB mask. The runtime is the pinned VICE
3.10 executable SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`
with the attested KERNAL/BASIC/chargen ROMs and `none` optimization.

Verification command:

```text
yarn vitest run test/rd05/input-native-qualification.spec.test.ts
```

Result: **20/20 pass in 122 s**. The existing `joystick-vice.spec.test.ts`
regression also passes **32/32** after the shared VICE launch/monitor refactor.
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
plan as its landing place. The only remaining deferred items are the size-output limits,
external NMI stack/ROM/deadline guarantees and physical/user-host qualification.
Native pressed-contact, live-NMI and STOP/RESTORE coverage is no longer deferred.

## Completion boundary

Task 2.3.2 is complete: native pressed-key and joystick acquisition, live
returning NMI, false-STOP and genuine STOP evidence pass on all four profiles.
Task 2.3.3 updated the platform guide. Task 2.3.4 (independent phase-2 reviews,
finding disposition and closeout) remains. Progress is **47/48**. No publication,
push or optimized release claim follows from this document.

## Remaining boundaries

- External NMI aggregate stack, retained-firmware completion and finite deadlines
  remain Unknown; SM-004 records that unproved boundary.
- Physical hardware and other host classes remain RD-10.
- The size-output limits and their 12 reds remain RD-08 evidence; they are not
  correctness assertions and are not waived.
- The new native specifications still require the independent 2.3.4 reviews.
