# Preflight Report — NMI Register-Only Source Reads

> **Target**: [Plan index](00-index.md) and the full plan set
> **Status**: PASS WITH FIXES — all findings dispositioned before implementation
> **Date**: 2026-11-12

## Method

An independent read-only preflight auditor compared the plan against issue #100, the frozen NMI
private-home contract, the qualified expert references, and the real lowering, storage and test
seams. The auditor did not modify files, run the suite or launch VICE. Reviewer `gh` access was
unavailable, so issue #100 was read through its published text; the issue body is the same content
recorded in this plan.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| PA-001 | Major | The ledger probe sources live in `test/rd04/expressiveness-ledger.spec.test.ts`, but Phase 1's modification set named only `test/rd08/*`. The ledger task was unexecutable under the plan's own authorship rule. | Fixed: Phase 4 names the ledger JSON and its existing probe entry; AR-N4a records issue #100's explicit instruction as the edit authority and bounds the edit to the row text and probe sources. |
| PA-002 | Major | The row owner is `issue #100`; closing #100 would orphan the two remaining restrictions. | Fixed: AR-N4b and task 4.4.3 require a follow-up issue before closure and move the row owner to it. |
| PA-003 | Major | The verification command was the compiler package suite, but the pinned optimizer artifacts and the ledger gate are root tests. | Fixed: the plan now requires the root `yarn test` and records the two tiers separately. |
| PA-004 | Minor | The stated cycle counts (29 not-taken / 30 taken) were wrong; the store path is 29 and the branch-taken path is 24. | Fixed in the design. |
| PA-005 | Minor | The index claimed an A/X/Y save while the design and code use an A-only save for these bodies. | Fixed in the index. |
| PA-006 | Minor | The A-only total depends on the existing dead-register save elision but the design did not name that premise. | Fixed: the design cites the dead-register rule; no specification edit is implied. |
| PA-007 | Minor | The rule accepted only the left-operand order, leaving `mask & read()` and non-constant masks unrecorded. | Fixed: reversed order is accepted and verified; the non-constant mask is recorded as remaining. |
| PA-008 | Minor | The `call` producer class widened the surface beyond issue #100 with no dedicated oracle. | Fixed: the rule is restricted to `platform` producers. |
| PA-009 | Minor | The plan did not say what a missing VICE runtime does; a skip would present an unrun case as green. | Fixed: the runtime case must fail, never skip. |
| PA-010 | Minor | The ledger task said "add probes", which would create new probe entries and fail the row/probe identity gate. | Fixed: the task adds sources to the existing probe entry. |

## Residual risk

The rule changes mainline output wherever a single-use platform byte result feeds a constant-mask
bitwise operation. That is the intended win, but it can move pinned optimizer artifacts. The root
`yarn test` run is the guard, and any moved artifact is treated as a defect to explain, not a
baseline to update silently.

## Gate verdict

**PASS WITH FIXES** — every finding is dispositioned; implementation may start with the independent
spec oracle.
