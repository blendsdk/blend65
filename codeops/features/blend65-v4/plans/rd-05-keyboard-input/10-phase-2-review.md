# Phase-2 Review: Keyboard Correctness Track

> **Document**: 10-phase-2-review.md
> **Parent**: [Index](00-index.md)
> **Status**: Native evidence complete at 47/48 — task 2.3.4 reviews and closeout remain
> **Reviewed**: 2026-11-01 23:31 CET; native review 2026-11-07
> **Baseline**: HEAD `91a1dee3` plus reviewed working tree

## Reviewers

Independent read-only reviews covered correctness, semantics/DX, SFA/ABI,
C64 platform, emitted code, and host performance. No source, specification,
expert or security boundary was changed by the reviewers.

## Findings and disposition

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RV-001 | MAJOR | `input-library.impl.test.ts` used a non-existent `owner.functionIndex`; owner checks were vacuous | **Fixed:** resolve normal and overlay owner IDs against debug function names; add non-vacuity and stack/resource checks; 2/2 focused tests pass |
| RV-002 | MINOR | NMI stack comment summed to 10 while assertion is 11 | **Fixed:** comment now includes the startup held-P byte |
| RV-003 | MINOR | Plan exception list did not name AR-P39 | **Fixed:** AR-P39 recorded in the keyboard register; this review carries the exception record |
| MC-001 | MAJOR | Four existing `none` startup/stack specification oracles still encoded the removed stored-P startup | **Fixed:** AR-P40 re-derived held-P ledger/state/decoder/stack values; 56/56 tests pass |
| MC-002 / TP-002 | MINOR | NMI stack comment stale | **Fixed** with RV-002 |
| SM-001 / TP-001 | MAJOR | No native pressed key/joystick acquisition through `readInputSnapshot` | **Fixed:** isolated coordinates/states and the independent mixed-contact/ghosting case pass on all four profiles |
| SM-002 / TP-001 | MAJOR | No `none`-mode live returning NMI into the actual `interruptScan` callback; only a `size` case exists | **Fixed:** independent cases cover before/after publication, column sample, changing cursor, during removal, after restoration and the generated predecessor on all four profiles |
| SM-003 | MAJOR | No genuine STOP/RESTORE or false-STOP case for the installed library | **Fixed:** genuine STOP reaches TIMB; the active-column PA=$FE false-STOP witness returns without TIMB on all four profiles |
| SM-004 / SF-001 | MAJOR/MINOR | External NMI aggregate stack, retained-ROM completion and finite deadline were not carried into the closeout | **Fixed in docs:** closeout and guide now state the unproved boundaries; no whole-program guarantee claimed |
| SM-005 | MINOR | Active-NMI re-entry restriction not documented | **Fixed in docs:** guide/source state the compatible-owner, no-competing-writer and non-reentrancy boundary |
| SM-006 / TP-004 | MINOR | `UNAVAILABLE` described as general port configuration instead of PBON timer output | **Fixed in docs/source:** PBON wording and ownership precondition |
| SM-007 | MINOR | PA latch/status restoration wording too broad | **Fixed in docs/source:** `$7F` handback and direction/status scope stated |
| SM-008 | MINOR | Raw joystick mask wording implied switch certainty | **Fixed in docs:** low line vs `joystickState` certainty |
| SF-002 | MINOR | New impl test did not check stack/resource accounting | **Fixed:** stack arithmetic and standard resource records now checked |
| SF-004 / TP-003 | MINOR | Callback marker trace does not prove PA-before-marker or retained interrupted rows | **Partial:** callback marker=1, PA-before-marker, exact rows and zero CIA2 ICR reads pass; the interrupted-frame A/X/Y/P/SP check remains open (NV-003) |
| SF-005 | MINOR | “non-overlay selected homes” wording exceeded the test | **Fixed:** closeout now says owner-mapped selected private homes |
| PE-001 | MINOR | New build-based impl tests used Vitest’s 5-second default timeout | **Fixed:** both cases use `120_000` ms |

## Integrity notes

- The 12 size-output failures are the explicit RD-08 deferral and are not counted
  as correctness findings.
- AR-P39’s `0xE8`/`0xBD` decoder additions and held-P stack values are exact,
  documented NMOS instruction sizes and stricter stack accounting. They do not
  weaken an oracle.
- No finding was waived. Native pressed-input, live `none` NMI, STOP/RESTORE and
  callback-order evidence are still absent.
- The four stale `none` startup/stack oracles are independent specification files;
  they cannot be edited without exact approval.

## Native evidence review (2026-11-07)

The implementation-authored suite
[`test/rd05/input-native-qualification.spec.test.ts`](../../../../../test/rd05/input-native-qualification.spec.test.ts)
passes **24/24 directed tests / 528 native scans**; the independent coexistence suite passes **36/36** on the four cooperative
profiles. It is supporting evidence for isolated held keys, isolated joystick
states, the publication-time and active-column returning RESTORE, the callback marker
and the stock STOP path.

Independent correctness, semantics/DX and SFA/ABI reviews of commit `5b12ee97`
did **not** accept it as full ST-18–ST-23 closure. They found six merged gaps:

| ID | Severity | Finding | Status |
|---|---|---|---|
| NV-001 | MAJOR | False-STOP witness is at vector publication (PA=$7F), not the hazardous active-column PA=$FE condition. | **Fixed:** active-column Cursor U/D + RESTORE returns without TIMB on all four profiles. |
| NV-002 | MINOR | Marker trace selects the initial `scanInterrupted=0` clear, not the callback marker=1 store. | **Fixed:** trace starts after publication; a marker store checkpoint proves value 1 and the preceding PA=$7F store. |
| NV-003 | MAJOR | Interrupted rows use `some(value !== 0)`; no exact row vector or A/X/Y/P/SP/live-stack frame check. | **Fixed:** exact row vectors plus A/X/Y/P/SP and byte-exact hardware-frame checks pass at every scanner-to-prior transition. |
| NV-004 | MAJOR | GDB cleanup may leave the VICE inferior in a separate process group. | **Fixed:** the attested VICE inferior is tracked and its termination is verified independently of GDB. |
| NV-005 | MAJOR | ST-18 mixed keyboard/joystick ghosting and ST-19/20/21 publication/sample/removal/overlap schedules are absent. | **Fixed:** the independent coexistence spec passes 36/36 across the missing schedules. |
| NV-006 | MAJOR | The implementation agent authored the native oracle; an independent `spec-test-author` companion is required. | **Fixed:** `test/rd05/input-native-coexistence.spec.test.ts` was authored by the independent spec-test-author; no implementation internals or forbidden native test were read. |

The run uses the existing GDB/VICE procedure: the debugger calls the unmodified
VICE `keyboard_event_playback` and `machine_set_restore_key` on the emulation
thread at `kbuf_feed`. No ROM bytes, CPU frames, CIA pins or source bytes are
patched. VICE is pinned to 3.10 with executable SHA-256
`f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
External NMI stack, retained-firmware completion and deadlines remain Unknown;
physical hardware remains unverified.

## Gate result

Task 2.3.1, the 2.3.2 oracle correction and 2.3.3 are verified. Task 2.3.2 is complete: NV-001..006 are fixed, the original suite passes 24/24 and the independent coexistence suite passes 36/36. Task 2.3.4 remains. Task 2.3.4 remains blocked on the corrected native evidence and finding disposition. Progress is **46/48**. No phase-2 completion, release or optimized claim is made.
