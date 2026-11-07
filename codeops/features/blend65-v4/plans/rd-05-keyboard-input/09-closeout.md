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
| Held keyboard matrix | 64 isolated coordinates × 4 profiles = **256 native scans**; exact driven-column raw rows and COMPLETE quality. Mixed contacts and ghosting are covered by the independent coexistence suite |
| Simulated joystick states | 32 isolated states × both ports × 4 profiles = **256 native scans**; exact raw joystick bytes and COMPLETE quality. Mixed keyboard/joystick ghosting is covered independently |
| Live returning RESTORE at publication | **4 native cases**; the actual `interruptScan` callback runs, the stock predecessor returns, quality is INTERRUPTED and the retained publication-time rows match exact vectors. The hazardous active-column schedule and interrupted-frame check remain open (NV-001/003) |
| Callback marker order | **4 native traces** after publication; the callback marker=1 is isolated and preceded by the PA=$7F store (NV-002 fixed) |
| Independent coexistence suite | **36/36** on four profiles: mixed key+joystick ghosting, before/after publication, column sample, changing cursor, during removal, after direction restoration, genuine STOP and generated predecessor; vectors, PA/marker order, prior entries, zero callback CIA2 ICR reads, A/X/Y/P/SP and byte-exact hardware frames are checked |
| GDB cleanup | The attested VICE inferior is tracked through procfs and its termination is verified independently of GDB (NV-004 fixed) |
| False-STOP witness | **8 native cases**: publication-time and active-column PA=$FE Cursor U/D + RESTORE both return without TIMB on all four profiles; SM-003 is fixed (NV-001) |
| Genuine STOP | **4 native cases**; STOP reaches the stock TIMB $FE66 path. This is path-entry evidence, not completed warm-start proof |
| Saved/acquisition behavior suite | 76/76 cases pass under `none` |
| Saved matrix and native observation cases | Pass on all four profiles for saved software data; 4,356 observations / 322,344 answers |
| Saved query purity | 4/4 profile cases pass; saved bytes retained, no fresh scanner resources |
| Acquisition normal/timer/unavailable paths | 24/24 cases pass with released contacts; 14 reads/15 writes, timer and PBON contracts retained |
| Acquisition predecessor ownership | 8/8 cases pass; chained and exclusive routes preserved |
| NMI immutable links | 12/12 static link cases pass after the approved held-P decoder/stack correction; the live `none` callback quality now passes the returning native case |
| Restoration / ABI / accounting | Pass in the inspected behavior/native cases; external NMI stack/ROM/deadline remain Unknown |
| Input-library implementation closure | 2/2 new checks pass: private helper/callback reachability and owner-mapped selected private homes |

The new [native specification](../../../../../test/rd05/input-native-qualification.spec.test.ts)
runs **24 directed tests / 528 native scans** on all four profiles in one
sequential VICE/GDB pass. This is supporting evidence, not the independent
specification oracle required by the task: NV-006 records that the implementation
agent authored it. The debugger calls the unmodified VICE
`keyboard_event_playback` and `machine_set_restore_key` on the emulation thread at
`kbuf_feed`; no ROM bytes, CPU frames, CIA pins or source bytes are patched.
Matrix injection uses the 16-entry VICE PA→PB mask. The runtime is the pinned VICE
3.10 executable SHA-256 `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`
with the attested KERNAL/BASIC/chargen ROMs and `none` optimization.

Verification command:

```text
yarn vitest run test/rd05/input-native-qualification.spec.test.ts
```

Result: **24/24 pass**. The existing `joystick-vice.spec.test.ts`
regression also passes **32/32** after the shared VICE launch/monitor refactor.
The independent reviewers did not accept the suite as full ST-18–ST-21 closure;
NV-001..006 remain open.
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

Task 2.3.2 is complete. The isolated and mixed key/joystick cases, the
independent publication/sample/removal/overlap schedules, callback-marker
value/order, exact rows, GDB inferior cleanup, false-STOP/STOP-path cases and
the A/X/Y/P/SP/byte-exact frame transition all pass. Task 2.3.3 is complete.
Task 2.3.4 (independent reviews, finding disposition and closeout) remains.
Progress is **47/48**. No publication, push or optimized release claim follows
from this document.

## Independent review findings (2026-11-07)

The independent correctness, semantics and SFA/ABI reviews of `5b12ee97` returned
six merged findings. They are evidence/qualification gaps, not demonstrated
production-code defects, and they block task 2.3.2 closure.

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| NV-001 | MAJOR | The false-STOP witness triggers RESTORE at vector publication, when PA is already $7F; it never exercises the hazardous PA=$FE active-column condition. | **Fixed:** active-column Cursor U/D + RESTORE returns without TIMB on all four profiles. |
| NV-002 | MINOR | The marker trace selects the initial `scanInterrupted=0` clear, not the callback's marker=1 store. | **Fixed:** trace starts after publication; marker value 1 and the preceding PA=$7F store are asserted. |
| NV-003 | MAJOR | Interrupted raw rows use `some(value !== 0)` and no A/X/Y/P/SP/live-stack comparison proves frame restoration. | **Fixed:** exact row vectors plus A/X/Y/P/SP and byte-exact hardware-frame checks pass at every scanner-to-prior transition. |
| NV-004 | MAJOR | GDB cleanup may leave the VICE inferior in a separate process group. | **Fixed:** the attested VICE inferior is tracked and its termination is verified independently of GDB. |
| NV-005 | MAJOR | ST-18 mixed keyboard/joystick ghosting and ST-19/20/21 publication/sample/removal/overlap schedules are absent. | **Fixed:** independent coexistence suite passes 36/36. |
| NV-006 | MAJOR | The primary implementation agent authored the native oracle, contrary to the implementation-blind independent-author contract. | **Fixed:** the independent `spec-test-author` authored `input-native-coexistence.spec.test.ts`. |

## Remaining boundaries

- External NMI aggregate stack, retained-firmware completion and finite deadlines
  remain Unknown; SM-004 records that unproved boundary.
- Physical hardware and other host classes remain RD-10.
- The size-output limits and their 12 reds remain RD-08 evidence; they are not
  correctness assertions and are not waived.
- The new native specifications still require the independent 2.3.4 reviews.
