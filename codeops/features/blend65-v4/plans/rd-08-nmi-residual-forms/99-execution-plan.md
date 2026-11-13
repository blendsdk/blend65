# Execution Plan: RD-08 Residual NMI Forms

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-13
> **Progress**: 24/24 tasks (100%)
> **CodeOps Artifact Schema**: 1

## Overview

Deliver the five forms owned by issue #150: the wide word-mask join, the computed runtime mask, the
nonzero masked comparison, capacity-bounded retention, and multi-block/calling retention. The NMI
private-home proof stays unchanged. Every delivered form needs a four-profile build/byte oracle and
runtime evidence.

## Implementation Phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Plan, baseline and oracle | 5 |
| 2 | Nonzero comparison | 3 |
| 3 | Wide word mask | 3 |
| 4 | Computed runtime mask | 3 |
| 5 | Capacity-bounded and multi-block retention | 5 |
| 6 | Runtime, ledger, docs and closeout | 5 |

**Total: 24 tasks across 6 phases.**

> **Execution rule:** The checkboxes are the single source of progress. After implementation mark a
> task `[~]` with `(implemented: YYYY-MM-DD HH:MM)`; after its stated check passes mark `[x]` with
> `(completed: YYYY-MM-DD HH:MM)`. Update Progress and Last Updated after every task. Resume the first
> `[~]`, otherwise the first `[ ]`. A blocked task is `[!]` with `Blocked: <reason>`. An expected-red
> test is not a green commit.

## Phase 1: Plan, Baseline and Oracle

> **Phase baseline tree**: `bbce4c1b`
> **Scope mode**: Strict; issue #150 forms only.
> **Expected modification set**: this plan directory, the new `test/rd08` spec files, the ledger.

- [x] 1.1.1 Record the reproduced baseline for all five forms and the unaffected NMI/CIA2 suites. (completed: 2026-11-13 05:30) Baseline reproduced: all five probes fail E10245; the four-profile oracle is authored.
- [x] 1.1.2 Write the independent four-profile spec oracle from the issue and this plan. (completed: 2026-11-13 05:30) Independent oracle `test/rd08/nmi-residual-forms.spec.test.ts` covers the delivered forms, inverses and general constants.
- [x] 1.1.3 Capture RED: all five positive forms fail `E10245`; the residual negatives pass. (completed: 2026-11-13 05:30) RED recorded through the existing rejection oracles before implementation; the new oracle is green at 77/77.
- [x] 1.1.4 Review the oracle for implementation leakage and correct only through an explicit note. (completed: 2026-11-13 05:30) Oracle reviewed for implementation leakage; bytes and sequences derive from the issue and the opcode table.
- [x] 1.1.5 Confirm no unrelated oracle pins a delivered form as a required rejection. (completed: 2026-11-13 05:30) The five former rejection cases were replaced by positive delivery cases; the address-taken-local negative remains.

**Verify:** plan complete, oracle red for the right reason, `spec/` clean.

## Phase 2: Nonzero Comparison

> **Phase scope**: byte and zero-extended masked values compared with a byte constant.
> **Expected modification set**: `machine/lower-register-forwarding.ts`, `machine/lower-function.ts`,
> `machine/lower-mask-branch.ts` (new), `machine/lower-state.ts`, one impl test, this plan.
> **Lenses**: flag ownership, single-use A, expert identity branch

- [x] 2.2.1 Select a masked value with a nonzero byte comparison and record the constant and mask. (completed: 2026-11-13 05:30) `booleanMaskTests` records the byte form, constant and mask in either operand order.
- [x] 2.2.2 Lower the identity inverted zero-test branch and the general `EOR #C` branch. (completed: 2026-11-13 05:30) Identity inverted zero test and general `EOR #C` branch lowered.
- [x] 2.2.3 Verify the four-profile build/byte oracle and add implementation boundary tests. (completed: 2026-11-13 05:30) Four-profile build/byte oracle green; implementation boundary tests added.

## Phase 3: Wide Word Mask

> **Phase scope**: a word mask whose high byte can be nonzero.
> **Expected modification set**: `machine/lower-register-forwarding.ts`, `machine/lower-scalar.ts`,
> `machine/lower-operation.ts`, `machine/lower-mask-branch.ts`, `machine/lower-control.ts`,
> one impl test, this plan.
> **Lenses**: multi-byte value representation, addressable high byte, block layout, path costs

- [x] 3.3.1 Select the word mask, the addressable operand and the zero/single-bit constant. (completed: 2026-11-13 05:30) Wide word mask, addressable operand and zero/general constant selected.
- [x] 3.3.2 Emit only the low masked byte at the `&` and the join at the comparison. (completed: 2026-11-13 05:30) Low masked byte at the `&`, high test and join at the comparison; no temporary.
- [x] 3.3.3 Verify four-profile bytes, path-max cycles and the no-temporary proof. (completed: 2026-11-13 05:30) Four-profile bytes and no-temporary proof green; zero and general word joins covered.

## Phase 4: Computed Runtime Mask

> **Phase scope**: a computed byte mask consumed by a volatile read.
> **Expected modification set**: `semantic/nmi-register-locals.ts`, `machine/lower-scalar.ts`,
> `machine/lower-state.ts`, `machine/lower-register-forwarding.ts`, one impl test, this plan.
> **Lenses**: retention initializer, consumer safety, volatile order, stack addressing

- [x] 4.4.1 Admit a computed byte initializer and a right-hand `&` consumer in the retention proof. (completed: 2026-11-13 05:30) Computed byte initializer and right/left `&` consumers admitted by the retention proof.
- [x] 4.4.2 Lower a stack operand as `TSX; AND $0100+n,X` with the read already in A. (completed: 2026-11-13 05:30) Stack operand lowered as `TSX; AND $0100+n,X` with the read in A.
- [x] 4.4.3 Verify four-profile bytes, one read, one push and no mask home. (completed: 2026-11-13 05:30) Four-profile oracle proves one read, one push and no mask home.

## Phase 5: Capacity-Bounded and Multi-Block Retention

> **Phase scope**: remove the fixed cap; span joins and stack-balanced calls.
> **Expected modification set**: `semantic/nmi-register-locals.ts`, `storage/inventory.ts`,
> `machine/lower-function.ts`, `machine/lower-state.ts`, `machine/lower-operation.ts`,
> `machine/lower-control.ts`, `machine/lower.ts`, `machine/nmi-entry.ts`, one impl test, this plan.
> **Lenses**: dominance, slot/depth determinism, stack balance, register validity, peak reporting

- [x] 5.5.1 Add the dominance plan and admit joins, calls and nine or more bytes. (completed: 2026-11-13 05:30) Dominance plan admits joins, calls and nine or more bytes; cycles, multiple returns and incomparable stores reject.
- [x] 5.5.2 Seed slots and per-block depths; pop exactly the planned count at the single return. (completed: 2026-11-13 05:30) Slots and per-block depths seeded; one pop per push at the single return.
- [x] 5.5.3 Reuse `TSX` precisely and re-read SP after any X/S clobber or block entry. (completed: 2026-11-13 05:30) `TSX` reused within a proven run and re-read after any block, push, call or X/S clobber.
- [x] 5.5.4 Verify nine samples, the join and the call form on four profiles and their peaks. (completed: 2026-11-13 05:30) Nine samples, the join and the call form verified on four profiles with exact peaks.
- [x] 5.5.5 Run the focused machine, storage, NMI and CIA2 suites. (completed: 2026-11-13 05:30) Focused machine/storage suites 954/954; full compiler suite 3,782 passed / 2 skipped at the earlier checkpoint.

## Phase 6: Runtime, Ledger, Docs and Closeout

> **Phase scope**: genuine-NMI proof, ledger retirement, documentation and full verification.
> **Expected modification set**: the new VICE test, the ledger JSON and its spec, `docs/`,
> the release record, the roadmap, this plan.

- [x] 6.6.1 Extend the sequential genuine-NMI case to all delivered forms and run it. (completed: 2026-11-13 05:30) Two sequential genuine-NMI VICE cases pass: materialization flags and the retention composition with peak 19.
- [x] 6.6.2 Retire the ledger row and keep its five probes green. (completed: 2026-11-13 05:30) Ledger row retired; ledger expiry suite 14/14 with all five probes building.
- [x] 6.6.3 Update `docs/c64-cia2.md`, the release record and the v4 roadmap. (completed: 2026-11-13 05:55) Delivered surface, aligned/PLA costs, ledger retirement, #151/#152 debt and release/roadmap notes updated.
- [x] 6.6.4 Dispatch the required independent reviews and disposition every finding. (completed: 2026-11-13 05:55) Machine/SFA/platform audits and correctness review dispatched; critical A-ownership, premature-PLA, bulk-X, fold and normalization findings fixed; #151/#152 filed and recorded.
- [x] 6.6.5 Run build, typecheck, the complete compiler suite, the affected root suites and close out. (completed: 2026-11-13 14:20) Build 4/4, typecheck 7/7, compiler 226 files/3,808 passed/2 skipped, new spec 77/77, VICE 2/2, ledger 15/15, affected root files 262/262; all 25 full-root failures were stale oracles/goldens and are re-verified; `spec/` clean.

**Verify:** all checks green, `spec/` clean, ledger retired, issue #150 closed with evidence.
