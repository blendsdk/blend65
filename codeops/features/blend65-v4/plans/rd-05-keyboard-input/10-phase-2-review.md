# Phase-2 Review: Keyboard Correctness Track

> **Document**: 10-phase-2-review.md
> **Parent**: [Index](00-index.md)
> **Status**: Native evidence complete at 47/48 — task 2.3.4 reviews and closeout remain
> **Reviewed**: 2026-11-01 23:31 CET; native evidence 2026-11-07
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
| SM-001 / TP-001 | MAJOR | No native pressed key/joystick acquisition through `readInputSnapshot` | **Fixed:** 64 held matrix coordinates and 32×2 joystick states pass on all four profiles; exact raw bytes and COMPLETE quality |
| SM-002 / TP-001 | MAJOR | No `none`-mode live returning NMI into the actual `interruptScan` callback; only a `size` case exists | **Fixed:** live returning RESTORE runs the actual callback on all four profiles; quality INTERRUPTED and named queries UNCERTAIN |
| SM-003 | MAJOR | No genuine STOP/RESTORE or false-STOP case for the installed library | **Fixed:** false-STOP witness returns without TIMB; genuine STOP reaches the stock TIMB $FE66 path on all four profiles |
| SM-004 / SF-001 | MAJOR/MINOR | External NMI aggregate stack, retained-ROM completion and finite deadline were not carried into the closeout | **Fixed in docs:** closeout and guide now state the unproved boundaries; no whole-program guarantee claimed |
| SM-005 | MINOR | Active-NMI re-entry restriction not documented | **Fixed in docs:** guide/source state the compatible-owner, no-competing-writer and non-reentrancy boundary |
| SM-006 / TP-004 | MINOR | `UNAVAILABLE` described as general port configuration instead of PBON timer output | **Fixed in docs/source:** PBON wording and ownership precondition |
| SM-007 | MINOR | PA latch/status restoration wording too broad | **Fixed in docs/source:** `$7F` handback and direction/status scope stated |
| SM-008 | MINOR | Raw joystick mask wording implied switch certainty | **Fixed in docs:** low line vs `joystickState` certainty |
| SF-002 | MINOR | New impl test did not check stack/resource accounting | **Fixed:** stack arithmetic and standard resource records now checked |
| SF-004 / TP-003 | MINOR | Callback marker trace does not prove PA-before-marker or retained interrupted rows | **Fixed:** native trace shows the PA=$7F store immediately before the marker; rows stay readable and queries UNCERTAIN |
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

## Native evidence (2026-11-07)

[`test/rd05/input-native-qualification.spec.test.ts`](../../../../../test/rd05/input-native-qualification.spec.test.ts)
passes **20/20 directed tests / 524 native scans** on the four cooperative
profiles. The suite covers all 64 held matrix coordinates, 32 states for each
joystick port, the live returning `interruptScan` callback, the PA-before-marker
trace, the false-STOP witness and the genuine STOP path.

The run uses the existing GDB/VICE procedure: the debugger calls the unmodified
VICE `keyboard_event_playback` and `machine_set_restore_key` on the emulation
thread at `kbuf_feed`. No ROM bytes, CPU frames, CIA pins or source bytes are
patched. The pinned VICE 3.10 identity and all four profile identities are the
same as the ordinary native suite. The implementation review of these new specs
is task 2.3.4; this review section records the evidence, not an independent
verdict on it.

## Gate result

Task 2.3.1, the 2.3.2 oracle correction, 2.3.3 and the full native 2.3.2 qualification are verified. Task 2.3.4 remains: independent correctness, semantics/DX, SFA/ABI, platform and host-performance reviews, finding disposition and closeout. Progress is **47/48**. No phase-2 completion, release or optimized claim is made.
