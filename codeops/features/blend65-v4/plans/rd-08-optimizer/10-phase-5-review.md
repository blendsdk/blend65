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
| `none` identity | **2163 bytes**, SHA-256 `0417b7da…` | `optimizer-exact-output.impl.test.ts` |
| Exact optimized identity | saved 709 / acquisition 943, full PRG SHA-256 pinned | `optimizer-exact-output.impl.test.ts` |
| Publication / ACME / frontier | **40 / 40** | `publication.spec.test.ts`, `acme.spec.test.ts`, `input-size-frontier.spec.test.ts` |
| Compiler suite | **3438 pass**, same 29 pre-existing failures | `yarn workspace @blend65/compiler test` |
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

Install, build, typecheck, the owned compiler suite, saved/adquisition/native
VICE cases and the exact-output test pass. Host time/RSS remains a tracked
measurement gap: the service currently records `peakRssBytes: "Unknown"`, and
the frontier/observer scaling debt is tracked in #138.

### 5.4 Independent reviews

Six independent read-only reviews were run at HEAD before the final fixes:
correctness, semantics/DX, SFA/ABI, target/platform, machine-code and host
performance. Findings and dispositions are below.

## Review findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RV-001 | Critical | An optimized reference could be published without `validateSizeObservers` | **Fixed.** Optimized modes select only validated candidate recipes. The raw canonical reference is never published; the Closed Original/full recipe is the retained baseline, and a resource-rejected canonical reference remains the recorded baseline with its exact rejection. |
| RV-002 / SM-001 | Major | Balanced/speed retain the baseline because production T is always `unknown` | **Tracked #136.** This is compliant with the exact unknown rule but leaves the modes inert on real programs. A semantic-path cycle model is the smallest path to a real win. |
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

- Balanced/speed production selection is exact but inert while T is `unknown`
  (#136). `size` is the qualified production optimizer.
- Local `keyState`/`snapshotCompatible`/`soleGroundSource` parity remains open
  (#137, #134); the whole-program saved gate passes.
- NMI adapter-versus-fill selection remains unpriced (#96).
- Host peak RSS is not recorded (#138); no wall-clock or RSS claim is made.
- All native results are VICE-verified, hardware-unverified.

## Closeout statement

RD-08 meets the frozen saved **725** and acquisition **963** whole-program gates
with unchanged limits, oracles, ABI, platform contracts and `none` identity.
The four modes are wired and exactly specified. Remaining local-parity, cycle
cost, NMI layout and host-scaling debt is recorded in #96, #134, #136, #137 and
#138. No push is performed by this closeout.
