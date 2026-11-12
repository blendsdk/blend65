# Preflight Report — RD-05 Takeover Resident Profiles

> **Target**: [Plan index](00-index.md) and the full plan set
> **Status**: PASS WITH FIXES — all findings dispositioned before implementation
> **Date**: 2026-11-12

## Method

An independent read-only preflight auditor compared the plan against the frozen
Specification 4.0 takeover contract (`spec/appendix-c64.md` §2, §3, §5.1, §9.2;
`spec/06-functions.md` §7.5–§7.9), the qualified expert doctrine
(`c64-memory-and-runtime.md`, `qualification/release.md`), and the real compiler seams.
The auditor did not modify files, run the suite, or launch VICE.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| PA-1 | Critical | A source raw IRQ handler that never clears CIA1 Timer A would re-enter forever; the plan only rejected *changed* CIA1 state. | Fixed: AR-T7 now requires an empty possible-source set or a handler that consumes/disables every CIA1 source before install; ST-T5/ST-T7 add the negative and positive cases. |
| PA-2 | Critical | Raw NMI admission reused the cooperative private-home-free exception, which the frozen text withholds from takeover. | Fixed: `setRawNMI`/`restoreRawNMI` are not exposed in this slice; startup still owns a complete default NMI entry. Deferred as `V4-TAKEOVER-F2` with the exact authority reason. |
| PA-3 | Critical | The `$05` mapping was believed to leave BASIC ROM visible at `$A000–$BFFF`, which would make ordinary takeover code/data there unreadable. | Corrected during implementation: the qualified `HIRAM=0, LORAM=1` row selects RAM at `$A000–$BFFF`, and a VICE read/write probe under the running `$05` mapping confirmed it. The full frozen `$0801–$CFFF` range stays available; no reservation or F1 finding remains. |
| PA-4 | Major | The takeover state omitted CIA2 DDR/VIC-bank ownership and restore. | Fixed: state offset 7 captures `$DD02`; entry clears the low bank bits; restore writes it before the CPU port. Design §3.1/§3.2/§3.4 and ST-T8 updated. |
| PA-5 | Major | Borrowed BASIC zero-page bytes were sized but never captured, so the restore would write zeroes. | Fixed: entry captures every `borrowedBasicBytes` byte; restore writes the exact values. ST-T8 now asserts exact incoming values. |
| PA-6 | Major | Default IRQ entry cost was stated as 8 bytes/19 cycles; the required sequence is 12 bytes/25 cycles. | Fixed in design §6 and ST-T4. Default NMI is now 4 bytes/10 cycles. |
| PA-7 | Major | A bare `RTI` default NMI could leave inherited CIA2 pending state unowned. | Fixed: default NMI reads `$DD0D` once before `RTI`; exact incoming assumption recorded. |
| PA-8 | Major | The VICE matrix never executed the NMI route. | Fixed: each takeover case injects a CIA2 timer NMI under the monitor and executes the default NMI entry; ST-T4/ST-T6 and the VICE procedure updated. |
| PA-9 | Major | The plan assigned spec-test authoring to the implementation session. | Fixed: the testing strategy and execution plan require an implementation-blind spec-test author; the executor writes only `*.impl.test.ts`. |
| PA-10 | Major | Torn-vector and unhandled-NMI negatives were missing. | Fixed: ST-T10 adds both classes, plus the raw NMI/placement negatives. |
| PA-11 | Minor | The plan claimed raw NMI wrappers are always placed at low `$47`, ignoring the existing three-byte adapter. | Fixed: raw NMI installation is deferred, so no adapter claim remains. The default NMI entry is a single function and is placed at low `$47` directly. |
| PA-12 | Minor | The plan said `launchVice` still used a string match; it already derives from facts. | Fixed: design §7 scopes the change to `viceLaunchArguments`/`startVice`; `launchVice` only needs the new facts. |
| PA-13 | Minor | Progress count mismatch (25 vs 30) and a missing preflight link. | Fixed: index is 0/30; this report now exists. |
| PA-14 | Minor | Phase 1 could ship a takeover profile that runs the cooperative constructor. | Fixed: task 1.1.2 adds a temporary admission guard until the Phase 2 constructor exists. |
| PA-15 | Minor | The plan used `E10247` for an unavailable sink; that code means unproved entry ABI. | Fixed: unavailable sinks use the ordinary frontend unknown-name diagnostic. |

## Residual authority decisions

One frozen-authority conflict remains: **source-installed raw NMI**
(`V4-TAKEOVER-F2`). The plan implements the complete startup default NMI route, but does
not expose an installer whose admission would require the withheld cooperative exception.
A future governing decision and a finite arrival/reentrancy proof are required. The `$05`
visibility concern in PA-3 was a mistaken premise; the qualified `$05` row selects RAM at
`$A000–$BFFF`, confirmed by a VICE read/write probe. Neither item blocks the four-profile
startup/banking/return qualification or the raw IRQ capability.

## Gate verdict

**PASS WITH FIXES** — every finding is dispositioned in the plan set; implementation may
start with the Phase 1 profile/admission work.
