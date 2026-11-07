# Keyboard and Combined-Input Closeout

> **Document**: 09-closeout.md
> **Parent**: [Index](00-index.md)
> **Status**: Native evidence complete at 47/48 — closeout pending exact oracle-edit approval
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
| Live returning RESTORE | **12 native cases** at publication, active column and final idle; the actual `interruptScan` callback runs, the stock predecessor returns, quality is INTERRUPTED, final-idle rows `$7F,$FF×7` and joysticks `$FF` match, and every scanner-to-prior transition preserves A/X/Y/P/SP and the three hardware-frame bytes (NV-001/003/005, CL-004 fixed) |
| Callback marker order | **4 native traces** after publication; the callback marker=1 is isolated and preceded by the PA=$7F store (NV-002 fixed) |
| Independent coexistence suite | **44/44** on four profiles: mixed key+joystick ghosting, before/after publication, column sample, changing cursor, during removal, after direction restoration, final idle, genuinely overlapping generated entries, genuine STOP and sequential generated predecessor; vectors, PA/marker order, LIFO prior entries, CIA2 read-PC attribution, A/X/Y/P/SP and byte-exact hardware frames are checked |
| GDB cleanup | The attested VICE inferior identity is captured at discovery, found through procfs even when monitor setup fails, the whole subtree is recorded, every listed identity is polled and escalated, every signal is guarded by the kernel start time, and termination is verified independently of GDB; the 2/2 TERM-ignoring and reused-pid regression passes (NV-004, RR-001/002, CL-001/002 fixed) |
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

Result: **24/24 pass**. The independent coexistence suite passes **44/44**,
including the final-idle window and genuinely overlapping generated entries.
The existing `joystick-vice.spec.test.ts` regression also passes **32/32** after
the shared VICE launch/monitor refactor. All VICE runs were sequential. The
result is **VICE-verified / hardware-unverified** on the four cooperative
profiles; physical hardware and other host classes remain later work.

The mixed-contact case uses VICE's I/O simulation, which drives all eight
joyport lines. Only its five driven bits and the named-query ambiguity are
treated as contract evidence; ordinary five-line joystick upper-line release and
physical switch behavior remain hardware-unverified (RD-10). No silicon-parity
claim is made.

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
independent publication/sample/removal/final-idle/overlap schedules,
callback-marker value/order, retained rows, GDB subtree cleanup with pid-reuse
guards, false-STOP/STOP-path cases and the A/X/Y/P/SP/byte-exact frame
transition all pass. Task 2.3.3 is complete. Task 2.3.4 is blocked only on exact
user oracle-edit authority for the task-local native specification file.
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
| NV-005 | MAJOR | ST-18 mixed keyboard/joystick ghosting and ST-19/20/21 publication/sample/removal/overlap schedules are absent. | **Fixed:** independent coexistence suite passes 44/44, including final idle and genuine overlap. |
| NV-006 | MAJOR | The primary implementation agent authored the native oracle, contrary to the implementation-blind independent-author contract. | **Fixed:** the independent `spec-test-author` authored `input-native-coexistence.spec.test.ts`. |

## Final review round (2026-11-07)

The final reviews accepted the active-column, marker, exact-row and frame fixes
and returned these additional findings. All are resolved or explicitly bounded:

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RR-001 | MAJOR | GDB cleanup omitted the inferior when monitor setup failed and waited only for its root. | **Fixed:** the attested inferior is found in the failure path, the whole subtree is recorded and every survivor is escalated; debugger cleanup always runs. |
| RR-002 | MAJOR | Numeric pids were signalled without revalidating identity, so a reused pid could be adopted. | **Fixed:** every signal is guarded by the recorded kernel start time. |
| RR-003 | MAJOR | The predecessor case was sequential, not overlapping, and the final-idle window was untested. | **Fixed:** eight independent cases cover a live nested second RESTORE (LIFO frame stack, two handoffs) and the second PA=$7F handoff after all eight columns. |
| RR-004 | MINOR | Review/closeout statements contradicted their current dispositions. | **Fixed:** historical findings are labelled and current dispositions are synchronized. |
| RR-005 | CRITICAL | A `*.spec.test.ts` file changed without a recorded oracle-edit exception. | **Bounded:** it is a task-local native artifact created in `5b12ee97` for this still-open task, reviewed before acceptance; no pre-existing oracle changed. |
| TP-001 | MAJOR | The mixed-contact witness uses the eight-line I/O simulator, not an ordinary five-line joystick. | **Bounded:** only the five driven bits and named-query ambiguity are claimed; upper-line and physical behavior remain hardware-unverified in RD-10. |

## Closing re-review (2026-11-07)

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| CL-001 | MAJOR | Single-use iterator made cleanup polls vacuously successful. | **Fixed:** identities materialized once; TERM-ignoring-child regression passes. |
| CL-002 | MAJOR | Inferior start time captured at cleanup could adopt a reused pid. | **Fixed:** identity captured at discovery and revalidated before every signal. |
| CL-003 | MAJOR | CIA2 reads before PA or after the marker escaped the scoped assertion. | **Fixed:** stopping `$DD0D` checkpoint plus read-PC attribution; negative control included. |
| CL-004 | MAJOR | Final idle did not check retained raw rows/joysticks. | **Fixed:** rows `$7F,$FF×7`, joysticks `$FF`. |
| CL-005 | MINOR | Residual contradictory status text. | **Fixed.** |
| CL-006 | CRITICAL | Exact user oracle-edit authority for the task-local native `*.spec.test.ts` file. | **Open blocker:** the exact path and allowed changes need user approval before closeout. |

Post-fix verification: independent coexistence **44/44**, original native **24/24**,
cleanup regression **2/2**; all native runs sequential with no leftover emulator.

## Remaining boundaries

- External NMI aggregate stack, retained-firmware completion and finite deadlines
  remain Unknown; SM-004 records that unproved boundary.
- Physical hardware and other host classes remain RD-10.
- The size-output limits and their 12 reds remain RD-08 evidence; they are not
  correctness assertions and are not waived.
- The final native specifications await the task 2.3.4 closing re-review.
