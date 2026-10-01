# Preflight report: VIC-II collision reads

> **Status**: ✅ PREFLIGHT PASSED — 1 finding resolved
> **Iteration**: 1 — first scan
> **Artifact**: Seven plan documents at `codeops/features/blend65-v4/plans/rd-05-vic-collision-reads`
> **Audited revision**: `0b6286d1`; target tree `31eba0b4c3ef9f6aaf74fb6fe7af6f3660328a0c`
> **Verified corrected content**: SHA-256 `364f3f075ebbc67203bec3993e447196f7dc5be642783e70c45d7fc580a440df`
> **Last Updated**: 2026-10-01 07:08
> **CodeOps Artifact Schema**: 1

SAME-SESSION REVIEW: The lead created this plan in the current session. Five independent
cluster audits supplement the lead review; they do not constitute human hardware qualification.

## Scope and context

Audit target: the register, index, requirements delta, current state, component contract,
testing strategy and execution plan. Scope is strict: two approved consuming hardware reads.
The initial audit authorized no corrections. The user subsequently approved the narrow
PF-001 plan correction on 2026-10-01. No compiler or test-code edit is authorized by this step.
The report is the review record; findings do not silently expand the modification set.

Context only: AGENTS.md, RD-05, frozen Specification 4, expert 2.0.1, actual compiler and test
paths listed below. No sibling plan, requirement, frozen authority or portfolio is audited as passed.

## Codebase context summary

TypeScript 7.0.2, Node 22, Yarn 1.22.22 and Vitest 2.1.9 are declared in `package.json`.
Frontend declarations carry typed effects into structured platform operations; target lowering
selects device instructions and existing result retention stores a sample without rereading.

| Evidence | Verified role |
|---|---|
| `frontend/profile.ts:163–299` | Existing closed operation inventory and consuming CIA-read effect; proposed collision bindings absent |
| `frontend/profile-bindings.ts:21–30,149–157`; `frontend/direct-calls.ts:140–148` | Binding construction, signatures and arity validation |
| `semantic/lower-calls.ts:172–184`; `semantic/cfg.ts:204–206` | Effect propagation and discarded-expression execution |
| `machine/lower-platform.ts:144–162`; `machine/lower-state.ts:263–315` | Existing sampled-result retention |
| `machine/lower-c64.ts:330–386`; `machine/lower-c64-cia.ts:295–302` | Direct device lowering seam; no new representation required |
| `target/c64-kernal.ts:4–67,101–134` | Typed machine facts and common addresses |
| `frontend/profile.spec.test.ts:65–79`; `profile-constants.spec.test.ts:55–106` | Approved exact specification inventory exception |
| `frontend/profile-constants.impl.test.ts:89–101` | Additional implementation-test inventory impact, PF-001 |
| `test/rd05/cia-api.spec.test.ts`; `cia-output.spec.test.ts:20–29`; `cia-vice.spec.test.ts:114–158` | Existing source, output and bounded four-profile runtime patterns |
| `test/rd05/profile-fixture.ts:95–117`; `test/m1/vice-monitor.ts:490–524`; `vice-runtime.ts:239–288` | Existing artifact and sequential monitor/runtime utilities |
| Root/compiler Vitest configuration; `package.json:18` | Separate owned runners; full root verification includes both |

Source paths without a prefix above are under `packages/compiler/src/`. All seven documents,
15 local links, four resolved creation decisions and ten unique specification-first tasks pass
structural checks. Proposed new files are explicitly future deliverables, not phantom dependencies.

## Primary semantics and lineage

Manufacturer drawing 318014, internal sheet 8 (scan page 7), defines sprite-participation bits
in registers `$1E/$1F` and automatic clearing on reads. Internal sheet 11 (scan page 10) separately
defines interrupt-latch acknowledgement by writing a selected one bit to `$19`. Both passages
were visually inspected in the [manufacturer specification](https://www.zimmers.net/anonftp/pub/cbm/documents/chipdata/6567_vicII_preliminary.pdf).
Downloaded SHA-256 matches the source manifest:
`6fbad4b037e4c4880e28bd9c34caa940a8ceb82041a41a0c22f8e6b12014567b`.
The preliminary 6567 document does not universalize silicon revisions or PAL timing.

Frozen `spec/04-expressions-operators.md:42–56` requires left-to-right observable effects.
The approved contract and ST-3–ST-9 preserve this, consuming-read count, high bits, separate
latches and fresh-event boundaries. Independent behavior and assembled cost expectations remain
distinct; implementation, measured cost and runtime qualification remain **Unknown** until execution.

Expert lineage: version `2.0.1`, content `1ce4852016e2a883cf1f733c6014c45e176bfc69`;
`c64-hardware.md#vic-ii-sprites` / `#volatile-and-rmw-policy`,
`blend65-semantics.md#semantic-preservation-checklist`. Governing source keys:
`BLEND65-SPEC-4-1c2a2d75`, `CSG-6567-318014`, `CBM-C64-PRG-1982`.

## Dimension scan

| # | Dimension | Findings | Highest severity |
|---|---|---|---|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit assumptions | 0 | — |
| 3 | Logical contradictions | 0 | — |
| 4 | Completeness gaps | 0 | — |
| 5 | Dependencies | 0 | — |
| 6 | Feasibility | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security blind spots | 0 | — |
| 9 | Edge cases | 0 | — |
| 10 | Scope creep | 0 | — |
| 11 | Ordering | 0 | — |
| 12 | Consistency | 0 | — |
| 13 | Codebase alignment | 1 | 🟡 Minor |

Severity totals: zero critical, zero major, one minor resolved, zero observations.
Compiler/language lens: no additional finding. Independent clusters: soundness, delivery,
risk and fit report no findings; grounding supplies the single finding below.

## PF-001: Include the affected implementation-test inventory — 🟡 MINOR

**Dimension:** 13 — test impact.
**Location:** `02-current-state.md:15–16`; `99-execution-plan.md:39–43,48`.
**Codebase evidence:** `packages/compiler/src/frontend/profile-constants.impl.test.ts:89,100–101`
hard-codes 60 bindings and the operation/constant boundary 35. Construction concatenates
capabilities and constants in `frontend/profile-bindings.ts:21–30`.

**Problem:** The two approved operations produce 62 bindings and move the boundary to 37.
The existing implementation test will fail, but the plan does not name its adjustment.
The full checkpoint catches this, so it is bounded rework rather than a major semantic defect.

**Best option:** Add this file to the current-state impact list and existing hardening task
1.3.1, with directed verification. Change only the expected total 60→62 and both boundaries
35→37, preserving identity, immutability and fresh-state assertions. Do not add a task or framework.
AR-P3 remains unchanged: this is an implementation test, not an additional specification oracle.

**Refutation:** Updating the new spec inventories alone does not affect this separate file.
The full suite exposes rather than resolves the omission. Deriving expectations from the same
capability list would make the cardinality check less independent; exact updated counts suffice.

**User Decision:** Resolved — user: “i approve”, 2026-10-01; accepted the narrow plan correction.

**Fix verification:** The impact list now names the existing implementation test, and task
1.3.1 contains the exact count/boundary adjustments and directed verification. No task was
added; progress remains 0/10. AR-P3 and all source/test files are unchanged. The added impact
entry and hardening instruction do not change API behavior, ownership, dependency order,
security or compatibility. Verified this minor edit directly; no new full audit was needed.
The corrected-content hash covers the seven target filenames in index order: filename,
NUL, exact file bytes, NUL. It excludes this report and the derived roadmap. Future execution
checks this content identity; the original revision above remains the initial scan's evidence.

## Simplicity and adversarial checks

The approved solution remains the smallest direct extension. No new dependency, layer, IR,
runtime manager, collision policy or harness is planned. The additional test impact above
does not justify support machinery or an expanded oracle exception.

Adversarial checks asked whether existing retention secretly rereads, whether unused calls
could disappear, whether two latches or IRQ acknowledgement were conflated, and whether the
monitor could consume the oracle. Existing paths and explicit ST/fixture obligations refute
those concerns at plan level; execution still must supply direct evidence.

Windows and physical QA stay at RD-10. No deferred decision is re-litigated. The plan is
preflighted, not implemented. No additional finding remains open.
