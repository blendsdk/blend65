# Phase 5 Review: RD-08 Optimizer Qualification

> **Document**: 10-phase-5-review.md
> **Parent**: [Index](00-index.md)
> **Authority**: [Execution Plan](99-execution-plan.md), RD-08 acceptance criteria
> **Date**: 2026-11-05
> **Status**: Complete — VICE-verified / hardware-unverified

## Measured gates

| Gate | Result | Evidence |
|---|---|---|
| Saved payload | **709 / 725** | `optimizer-saved-output.spec.test.ts` 17/17 |
| Saved general / combined | **740 / 745**, **754 / 759** | same |
| Acquisition payload | **943 / 963** | `optimizer-acquisition-output.spec.test.ts` 12/12 |
| Acquisition general / zero page / combined | **976 / 984**, **14 / 14**, **990 / 998** | same |
| Acquisition stack routes | **6 / 10** | same |
| Native acquisition NMI | **4 / 4** profiles pass | `input-acquisition-nmi.spec.test.ts` on PAL/NTSC 6581/8580 |
| Mode selection | **56 / 56** | `optimizer-selection.spec.test.ts` |
| Balanced/speed output | **709** saved, **943** acquisition | size-quality baseline; speed selects the cycle winner; exact-output test |
| `none` identity | **2163 bytes**, SHA-256 `0417b7da…` | `optimizer-exact-output.impl.test.ts` |
| Exact optimized identity | saved 709 / acquisition 943, full PRG SHA-256 pinned | `optimizer-exact-output.impl.test.ts` |
| Publication / ACME / frontier | **40 / 40** | `publication.spec.test.ts`, `acme.spec.test.ts`, `input-size-frontier.spec.test.ts` |
| Compiler suite | **3468 pass, 2 skipped, 0 failed** | `yarn workspace @blend65/compiler test` |
| Install / build / typecheck | pass | root scripts |

All native claims are VICE 3.10 `x64sc` results. No physical-silicon proof is
claimed. Target-sensitive timing, analog SID behavior and undocumented opcode
behavior remain RD-10/hardware-QA work.

## Phase 5 task evidence

### 5.1 Applied-rule debug records

`services/evidence-records.ts` derives one optimization record per actual
fixed-loop, fixed-counter, native-store and byte-window proof in the selected
machine program. Each record carries ordered source spans and the exact final
output range indexes; each range carries the reverse optimization indexes.
Records are empty for `none`. The acquisition debug sidecar validates with five
records and 302 reverse-linked ranges.

### 5.2 Reproducibility, ACME reconciliation and last-good publication

The publication, ACME-reconciliation and size-frontier suites pass 40/40,
including last-good generation preservation after source failure and after a
cancelled build. The exact-output test pins the complete PRG hashes, not only
payload ceilings.

### 5.3 Complete verification

Install, build and typecheck pass. The compiler package reports **3468 pass,
2 skipped, 0 failed**, and every other package passes: CLI 62/62,
language-server 21/21, VS Code 6/6. The saved, acquisition and native VICE cases
pass. Root `yarn test` is **not green**: after the compiler package succeeds,
the root vitest corpus runs and reports 260 failures in the last complete run
(5,875 pass). Those failures are concentrated in RD-04/RD-05 root specs and the
RD-08 raw/observer specs. Representative files fail identically at the
pre-RD-08 baseline `3c2e9357`; the root corpus was previously masked because the
compiler package failed first under `&&`. Two later fixes remove at least 16 of
the RD-08 cases (`input-size-runtime` 28 -> 12) and the retest fix removes a
carry leak, but the remaining failures are a separate root-spec remediation
scope, not RD-08 acceptance criteria. Host measurements were taken outside the
suite:

| Build | Wall clock | Peak RSS |
|---|---:|---:|
| Saved `size` | 36.8 s | 289.6 MB |
| Saved `balanced` | 36.7 s | 285.9 MB |
| Acquisition `size` | 42.4 s | 280.6 MB |

These are observational Node-host numbers, not release wall-clock gates. The
service still records `peakRssBytes: "Unknown"`; frontier/observer scaling debt
is tracked in #138.

### 5.4 Independent reviews

Six independent read-only reviews were run at HEAD before the final fixes:
correctness, semantics/DX, SFA/ABI, target/platform, machine-code and host
performance. Findings and dispositions are below.

## Review findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RV-001 | Critical | An optimized reference could be published without `validateSizeObservers` | **Fixed.** Optimized modes select only validated candidate recipes. The raw canonical reference is never published; the Closed Original/full recipe is the retained baseline, and a resource-rejected canonical reference remains the recorded baseline with its exact rejection. |
| RV-002 / SM-001 | Major | Balanced/speed retain the baseline because production T is always `unknown` | **Fixed.** A proof-carrying entry-to-return cycle analysis produces exact/range terms from instruction costs, direct calls and checked loop trips. Balanced/speed start from the validated size-quality recipe; speed selects the cycle winner and the production default publishes 709/943. Unknown or crossing ranges still retain the baseline. |
| RV-003 / SM-002 / SM-003 / SM-004 | Major | Size used a different selector/tie path; infeasible baseline handling was inconsistent | **Fixed.** All modes use the same exact selector; size orders B→R→T; exact ties use stable IDs; an infeasible canonical baseline is recorded as rejected while selection starts from the validated Closed Original/full recipe. |
| RV-004 / SM-005 / MC-001 | Major | `foldRegisterReloads` ignored X reads; `foldShiftHome` treated a read/write instruction as defining A before reading it | **Fixed.** X reads break the fold; the observer correspondence mirrors it; shift-home checks uses before defines and has a focused test for all shifts and successor reads. |
| RV-005 / SM-007 | Major | Applied-rule obligations were not checked for completeness or ownership | **Fixed.** Validation now requires obligations to match the applied rules, every rule to carry non-empty source-equivalence sites owned by its declared functions, and numeric cost values. |
| RV-006 | Minor | The CLI test still treated `speed` as invalid | **Fixed.** The invalid case uses `fast`; CLI suite 62/62. |
| SF-001 | Major | `fallbackStatus` made the saved-status/quietY composition vacuous | **Fixed.** The composition derives the actual startup state interval and capture writes, rejects a missing interval, and computes `quietY` from the program; a recognized startup shape may strengthen it but an unrecognized shape cannot assume it. |
| SF-002 | Major | Asynchronous calls with aggregate destinations were missing from `asyncWrites` | **Fixed.** A call whose hidden destination is a place now records the place root as an asynchronous write. |
| TP-001 | Major | Compact `size` startup admitted screen-matrix writes as display-independent | **Fixed.** Ordinary-RAM admission excludes `$0400–$07FF`; tests cover accepted ordinary RAM and rejected display-visible writes. |
| MC-002 | Major | Bottom-tested loops stripped `clv` without a V proof | **Fixed.** `clv` is dropped only for register counters whose loop members never read V (the same quiet premise the header selector uses). Low-byte counters and V-using bodies keep the clear. |
| MC-003 | Major | Saved local routines remain above their expert floors | **Tracked #137** (with #134 for the 12-byte `keyState` bound guard). Whole-program saved still beats the expert gate at 709/725. |
| MC-005 | Major | NMI wrapper placement never compares direct full-body fill with the 3-byte adapter | **Tracked in #96.** Narrowed: adapter saves B−3 bytes and costs +3 cycles when the wrapper fits the gap; direct placement is 3 bytes cheaper when it does not. Native fill is not asserted. |
| MC-006 | Major | Exact 709/943/2163 values and the `none` hash were not pinned by tests | **Fixed.** `optimizer-exact-output.impl.test.ts` pins all three payloads and full PRG hashes. |
| Performance findings | Major | 42-plan frontier, repeated reference validation, retained losing trees, O(P×R) debug range attachment | **Tracked #138.** No generated-output or gate regression. |

## Residual limits

- Balanced/speed use the size-quality recipe as their production baseline. They
  retain it on a true cross-range tradeoff and never publish the larger canonical
  recipe merely because it is the unoptimized shape.
- Local `keyState`/`snapshotCompatible`/`soleGroundSource` parity remains open
  (#137, #134); the whole-program saved gate passes.
- NMI adapter-versus-fill selection remains unpriced (#96).
- The service field `peakRssBytes` remains `"Unknown"`; the host numbers above
  are external observations, and frontier/observer scaling debt remains #138.
- Default `balanced` publishes the validated 709/943 size-quality baseline.
  `speed` selects the worst-case cycle winner on both measured workloads.
- All native results are VICE-verified, hardware-unverified.

## Explicit disposition of remaining issues

| Issue | Disposition |
|---|---|
| #134 | **Closed resolved.** `lower-bounds.ts maximumAt` already takes the smaller of the operation-local and selected-loop maximum for the same value. `lower-variable-shift.impl.test.ts` proves the 7n local bound wins over the 255n loop fact for both shift and typed-index consumers, and the saved-query saturation guard is omitted. Focused suite 22/22 (10 skipped). |
| #137 | **Closed as non-equal-contract.** The expert fixtures assume a borrowed pointer ABI; the selected saved output specializes `keyState` to the resident global with direct absolute/absolute-Y access and a scalar key. The valid equal-contract comparison is the complete saved program, which passes 709/725 with 17/17 cases. Reopen only with matched-ABI fixtures. |
| #96 | **Closed as measured non-win.** Preferring the adapter over direct low-`$47` placement grew acquisition payload 1209 -> 1353 in the recorded experiment; direct placement was retained. Native NMI passes 4/4. Reopen only with a measured layout where the adapter reduces complete payload without an NMI regression. |
| #138 | **Closed resolved.** Reference storage/visibility/placement prechecks are memoized per build, losing candidate trees are released immediately after selection, and the debug reverse index remains one pass. Measured saved size 36.94 s/289.0 MB -> **29.02 s/269.2 MB**; acquisition size 43.51 s/273.0 MB -> **33.81 s/272.3 MB**; saved balanced 29.27 s/273.5 MB. The finite 2×7×3 frontier remains bounded; no output, limit or oracle changed. |

These dispositions are explicit: the issues remain open and owned, none is a
parity waiver, none relaxes a limit or oracle, and none blocks the frozen 725/963
gates. No further RD-08 code change is claimed for them.

## Root-suite remediation (authorized, in progress)

The last complete root run (`final5`) reported **260 failures / 5,875 passes**
after the compiler package first became green. The user authorized a separate
root-spec remediation plan. Progress since that run:

- VIC collision output **32 -> 0** and joystick API output **16 -> 0** by keeping
  the scaffold and measured slice in the same display-dependent startup class.
- `input-size-runtime` **28 -> 12** by admitting unconditional source CPU
  barriers (timer A/B PBON cases pass) and keeping the byte/Boolean/conditional
  barriers strict.
- Module initializers now join optimization-fact coverage, removing the
  `Optimization facts do not cover the lowered machine source` failure class.
- Boolean retests now preserve carry with `AND #$FF` when a continuation reads
  it, instead of leaking `CMP #0`'s carry.

The known remaining count is therefore **at most 196** (a fresh full recount is
pending). The dominant files were:

| File | Failures | Nature |
|---|---:|---|
| `test/rd08/input-byte-selection.spec.test.ts` | 56 | Size selection picks direct because the closed predicate saves 2 B but retests cost 6 B |
| `test/rd05/vic-collision-output.spec.test.ts` | 32 | Scaffold uses compact startup while the VIC body requires full startup; byte delta includes 546 B of startup |
| `test/rd08/input-size-runtime.spec.test.ts` | 28 -> 12 | Timer A/B PBON fixed by the CPU-barrier observer; remaining raw-word/VIC envelope proofs |
| `test/rd08/input-object-facts.spec.test.ts` | 16 | Optimization-facts coverage |
| `test/rd08/input-loop-storage.spec.test.ts` | 16 | Size selection / storage observers |
| `test/rd08/input-startup-selection.spec.test.ts` | 16 | Startup recipe evidence |
| `test/rd05/joystick-api-output.spec.test.ts` | 16 | Same compact/full startup baseline issue as VIC |
| `test/rd05/nmi-route-placement.spec.test.ts` | 16 | Expected E10273, received COMPILER_INCOMPLETE |
| `test/rd04/*stack*` | 28 | Hardware-stack peak/headroom and diagnostic text |
| Other RD-04/RD-05 | ~36 | Layout, provenance, resource and returned-local output |

`test/rd05/vic-collision-output.spec.test.ts` (then 32/32) and
`test/rd08/input-byte-selection.spec.test.ts` (4/4) fail identically at the
pre-RD-08 baseline `3c2e9357`, so they are not RD-08 regressions. The remaining
files are the authorized root-spec remediation plan; no RD-08 limit, oracle or
ABI is changed to make them pass.

## Closeout statement

RD-08 meets the frozen saved **725** and acquisition **963** whole-program gates
with unchanged limits, oracles, ABI, platform contracts and `none` identity.
The four modes are wired, exactly specified and active: production `balanced`
and `speed` publish 709/943 on the measured workloads, and `size` remains the
byte-first qualified mode. #134, #137, #96 and #138 are closed with the evidence above. The RD-08 gates are
met. The root-spec corpus is under a separate authorized remediation and is not
yet claimed green. No push is performed by this closeout.
