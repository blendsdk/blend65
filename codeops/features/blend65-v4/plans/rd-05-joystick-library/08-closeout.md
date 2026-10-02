# Joystick and bundled C64 library — closeout

> **Date**: 2026-10-02
> **Status**: Complete — 21/21 verified; green checkpoint
> **Boundary**: This pilot only, not complete RD-05 or production qualification

## Delivered

One real source file ships six documented ordinary byte constants in `c64.input`, consumed through
existing module analysis. Detached installed-package tests prove its actual bytes, availability
outside this checkout, portable source identity, and agreement between frontend, compiler/build
evidence and editor diagnostics. User-only project inputs and overlays remain unchanged.
There is no package manager, resolver framework, persistent cache or runtime input policy.

Both joystick ports and all five saved-byte active-low predicates are available on the four
cooperative PAL/NTSC × 6581/8580 profiles. Each read performs one volatile full-byte observation;
discarded reads remain. Pure predicates do not reread hardware. Direct fixed byte stores use the
existing guarded forwarding seam, with no temporary home, redundant transfer or helper call.
The [user guide](../../../../../docs/platform-libraries.md) explains ordinary imports and keyboard
sharing. Callable operations remain compiler-owned today; the six masks are real Blend65 source.
Neither takeover profiles nor combined keyboard scanning are claimed by this pilot.

## Verification and authority

| Evidence | Result |
| --- | --- |
| Phase 1 | 11/11 verified; 24 independent source/distribution/editor specification cases pass |
| Phase 2 qualification | 252/252 API/output/runtime cases and 55 inventory cases pass |
| Phase 2 directed implementation | 55/55 pass, including exact masks/effects and negative forwarding guards |
| Full Linux checkpoint | Install/build/typecheck pass; all 3,421 tests pass, with two unchanged native-host skips |
| Independent reviews | No new implementation defect; 28 additional semantic probes pass; exact prior oracle approvals recorded |
| Frozen authority | Specification 4 and expert 2.0.1/content `1ce4852016e2a883cf1f733c6014c45e176bfc69` unchanged |
| Final documents | Exact guide source builds on four profiles; final 91 local links/anchors and feature counter 4/10 pass; final document review has no new findings |

The first complete run had one existing CIA1 pre-release stopped-address failure. All four unchanged
cases and the complete unchanged-command retry pass. No timeout, source, fixture or assertion was
changed for that retry; no unproved causal explanation is presented. The
[phase review](09-phase-review.md) retains the original failure, current oracle identities,
exact AR-P8/AR-P10/AR-P11/AR-P12 authority and the historical inverse-proof evidence limitation.
The review role's automatic specification-edit finding is resolved by those prior exact user
rulings, not by a new silent waiver.

## Output costs and RD-08 targets

Costs below are assembled main intervals, including the equal-contract three-byte/three-cycle
transfer to restoration. Common startup/restoration and other resources remain charged in complete
artifact/resource evidence. Cycles are nominal instruction paths, not VIC-stall or wall-clock proof;
actual branch page penalties are included. SFA is function-execution storage in bytes.

| Scenario | Current bytes / cycles / SFA | Independent expert bytes / worst cycles / SFA |
| --- | --- | --- |
| Discarded read | 6 / 7 / 0 | 6 / 7 / 0 |
| Direct fixed byte store | 9 / 11 / 0 | 9 / 11 / 0 |
| Retained sample, two fixed stores | 27 / 35 / 2 | 12 / 15 / 0 |
| Positive saved-byte branch | 33 / 30–37 / 2 | 15 / 17 / 0 |
| Negated saved-byte branch | 55 / 54–61 / 3 | 15 / 17 / 0 |
| Escaping Boolean | 37 / 45 / 3 | 16 / 19 / 0 |

The direct read body is the expert's three-byte/four-cycle LDA; a sole fixed byte store is
six bytes/eight cycles. A required volatile bus read cannot itself be shortened. Local meet and
the measured path to a whole-program win are tracked in
[issue #95](https://github.com/blendsdk/blend65/issues/95), owned by RD-08; the separate collision
retention issue #94 is not misrepresented as joystick coverage.

Under the user's explicit [AR-P12](00-ambiguity-register.md#ar-p12-output-scope-and-independent-cost-evidence)
pilot-only correction, general local/condition/layout differences remain RD-08 inputs, not new
canonical-output goldens or production acceptance. The preserved targets require shared lifetime/
register proof before SFA closure, condition propagation and compact branch layout. Callable source
helpers additionally require qualified general function expansion under R8.19/AC-17. No early
optimizer or production cycle reporter was introduced; public whole-program cycles remain Unknown.
Optimized and game-grade closeout must revisit these targets, not extend this pilot exception.

## Runtime qualification boundary

Sequential VICE cases prove all 32 simulated switch combinations per port, all five predicates,
full-byte upper-pin behavior, shared-line interference, CIA1 latch/DDR preservation, both caller
IRQ states and separate mainline/cooperative-handler samples. The independent API oracle also
checks all 256 saved-byte values, short circuit and ordered read effects.

Tools are Linux x64 / Node 22.23.1 / Yarn 1.22.22 / ACME 0.97 / VICE 3.10 `x64sc`.
Runtime identity logs bind executable SHA-256, all three ROM hashes, PRG hashes and resources:
VIC-II model 0/3, SID model 0/1, CIA1/CIA2 model 0, KERNAL revision 3.
VICE executable SHA-256 is `f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74`.
Evidence logs are in `/tmp/blend65-joystick-phase2.Lkb8GS/`; the phase review names the exact runs.
Finite host waits and simulated opposite-direction combinations are not physical-stick or
silicon-timing guarantees. Status remains **VICE-verified / hardware-unverified**. Reads promise
neither electrical joystick isolation nor an atomic two-port snapshot. Physical and native
Windows/macOS user-release evidence remain RD-10; compiler development remains Linux-only.

## Deferral-expiry check

**Did this pilot's deliverables expire any deferral's stated rationale?** No previously deferred
implementation becomes safe or zero-cost merely because real constants and both-port observations
now work. Remaining input work is due as the next RD-05 slice, not treated as completed or orphaned.

The check walked this plan's AR-P2/AR-P5/AR-P7/AR-P12, the requirements ambiguity register, Stage A,
handler-IRQ, CIA, CIA1-return, collision and NMI registers, RD-04's carried restrictions, RD-05's
Won't Have section, all active future-consideration triggers, and the current
[expressiveness ledger](../../../../../test/rd04/expressiveness-ledger.json).
The historical AGENTS.md package-harness ledger path is absent from this rebuild; the current
ledger and its direct expiry test above are the actual authority checked, not an invented file.

| Remaining item | Rationale still holding / owner and next gate |
| --- | --- |
| Callable library helpers | Ordinary calls still cost ABI marshalling and JSR/RTS. RD-08 R8.19/AC-17; migrate only after equal-contract function expansion is qualified. |
| Whole-local joystick output | Preserved measured targets above; RD-08 before optimized/game-grade closeout. Pilot acceptance does not retire them. |
| Complete joystick/keyboard coexistence | Raw shared-line observations are proved, not a combined matrix scan. RD-05 R5.24/AC-19 and R5.25 own the declared scan/drive/restoration/ghosting contract. |
| NMI/CIA2 safety, DEF-7 | No new finite all-source/reentry bound or atomic vector proof. RD-05 R5.15–R5.17; active ledger guard remains. |
| Handler-side IRQ and stack-overlap restrictions | Already retired by their own owners; joystick work neither reopens nor claims to have fixed them. |
| Restoring-handler analysis, takeover and other platform families | Unchanged obligations owned by RD-05, which remains Executing. |
| Native assets / delivery / complete tooling | RD-06 / RD-07 / RD-09 retain their separate contracts; bundled constants do not qualify them. |
| Future language proposals | FUT-006/007/011/012/015/016/017/018 and both rejected-feature bars gain no new necessity, stack-pressure, optimizer, linker or image-conversion proof here. No frozen-authority change. |
| Incremental analysis and release proof | No evidence attributing a real-project delay to repeated unchanged analysis; existing AR-011/AR-026 gate holds. Physical and native user-host release proof remain RD-10. |

No new source restriction is added. No live deferral names a future slice of this now-completed
pilot as its landing place. Complete RD-05 must repeat the broader expiry gate before it closes.

## Conditional final analysis and expert-skill follow-ups

**Recommended: retain a bounded final platform-library analysis as a later requirements gate,
dependent on qualified RD-08 optimization.** This pilot proves actual source distribution and
zero-runtime-cost constants, but not zero-cost callable source helpers. That distinction justifies
an evidence-led inventory of other helper candidates after optimization, not a broad rewrite now.
Any final RD belongs after the existing roadmap, with refactoring conditional on measured defects
or benefits. AR-P7 requires the requirements gate before creating it; no extra RD is created here.

The approved library-first direction also warrants a later expert-skill candidate update through
the separate `blend65-expert-skillset` owner. It must use product decisions, frozen semantics and
primary hardware evidence, never current compiler output as doctrine. Bump its version, qualify
and activate atomically; maintain one active baseline. No skill content or release changed here.

Next implementation family: the bounded RD-05 keyboard/combined-input contract, preserving these
raw joystick APIs and application-owned debounce/repeat policy. No input manager or game engine.
