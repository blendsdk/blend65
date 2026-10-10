# Phase 1 review — existing-consumer output corrections

> **Status**: Qualified — Phase 1 only; all reviews and fresh full checkpoint complete
> **Date**: 2026-10-10
> **Task**: 1.3.4 (formerly 1.3.3; mechanical module-size task inserted before the checkpoint)
> **Baseline tree**: `55940197c46b22e2de82893372d1d932382185cb`
> **CodeOps Artifact Schema**: 1

## Boundary

This checkpoint owns only AR-P12's three existing-consumer compiler corrections.
It publishes no acquisition/decoder API and does not close RD-05 or DEF-7.
The six production owners are `lower-scalar.ts`, `lower-state.ts`,
`lower-aggregate-index.ts`, `lower-aggregate.ts`, `lower-aggregate-place.ts` and
`lower-register-forwarding.ts`. The existing address-place module receives the
unchanged address routine/cache helper to keep the aggregate owner below the
repository size limit; imports and a compatibility re-export are the only
organization changes. Existing `lower-call.ts` is reused unchanged.
No pass, IR kind, solver, runtime, dependency, harness, admission mechanism or
source restriction is added.

Eight new public specification files were independently authored before the
production changes. The baseline ran all 80 cases: 56 behavior/safety passes,
24 intended output failures, zero skips. After correction all 80 pass with the
same behavior and cost expectations. The new index implementation file and
two extended internal files contain 38 passing cases, zero skips.

Only AR-P13's exactly approved local CRA setup pairs change existing specification
tests; every source, assertion and measured interval is unchanged. Frozen
specification and active expert files stay untouched. AR-P6's exact nine-name
inventory exception remains unused; it belongs to Phase 2. The three new-fixture coordination/provenance corrections were
independently reviewed and preserve every source and expected behavior/cost:
wait before resume, delayed read-trace collection after the saved RTS register
observation, and gap-free coverage of all nested assignment origins.

## Verification

Raw logs are retained under
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-plan-check.hzunZt/`.

| Check | Current result | Evidence |
| --- | --- | --- |
| Frozen install | PASS | `phase1-install.log` |
| Build | PASS | `phase1-build.log` |
| Typecheck | PASS | `phase1-typecheck.log` |
| Eight new public files | 80/80 PASS, no skips | `all-output-green.log` |
| Three internal files | 38/38 PASS, no skips | `all-new-internals-final.log` |
| Original full Linux suite (retained) | FAIL: 6,138 passes, two failures, two existing skips | `phase1-full-test.log` |
| Unchanged failing-file reruns | 13/13 PASS twice, no skips; first failure attribution Unknown | `old-runtime-diagnosis-1.log`, `old-runtime-diagnosis-2.log` |
| Approved AR-P13 directed run | 13/13 PASS, no skips, 21.02 seconds | `ar13-directed.log` |
| Fresh frozen install / build / typecheck | PASS | `ar13-install.log`, `ar13-build.log`, `ar13-typecheck.log` |
| Pre-move full Linux suite | Interrupted by root, exit 130; 33 completed root files, not a full checkpoint | `ar13-full-test.log` |
| Final module build / typecheck | PASS | `address-move-build-green.log`, `address-move-typecheck.log` |
| Final public / internal cases | 80/80 plus 38/38 PASS, no skips | `address-move-directed.log`, `address-move-internals.log` |
| Final mechanical review | No findings; all 9,866 moved characters identical; existing exports preserved | Baseline `ef4a8a552269db0db6b3cfc9a43b9773bb7eb323`; address owner 358 lines, aggregate owner 530 lines |
| Final frozen install / build / typecheck | PASS | `phase1-final-install.log`, `phase1-final-build.log`, `phase1-final-typecheck.log` |
| Final full Linux suite | PASS: 6,140 cases, two existing unrelated skips; 189/189 root files and 4,090/4,090 root cases | `phase1-final-full-test.log`; root 1,375.32 seconds, complete command 1,458.63 seconds |
| Targeted formatting | PASS | `phase1-final-format.log`; touched TypeScript only |
| Local links / whitespace | PASS | Direct final checks; Markdown remains under approved formatter exclusion |
| Immutable and old-oracle guards | Clear | Actual Git diff and status; only the exact AR-P13 old-fixture changes |

The first complete root run ends at 187/189 passing files and 4,088 passing/two
failing cases, duration 1,577.38 seconds. All package suites pass, including
1,961 compiler cases and its two existing skips. The complete command exits 1;
it is not a GREEN checkpoint. CIA1 BASIC-return fails at line 200 before its
first controlled timer injection: a handler entry arrives instead of the
expected `beforeRelease` entry. The exclusive/decimal/initially-enabled IRQ
status case fails at line 350, where the old CIA1 timer-A pending bit is expected
clear before controlled injection. These are device-precondition observations,
not evidence that the later restoration failed. No causal relation to the
production diff has been established.

The unchanged two-file reruns pass all 13 cases each, zero skips, in 22.40 and
22.04 seconds. They do not erase the first failures or prove their cause.
Independent platform follow-up TP-001 (MINOR, existing fixture setup) establishes
a valid Timer-A-phase counterexample in both cases: masking does not stop the
stock timer, a post-clear underflow can set pending data, and LOAD does not
acknowledge it. The failed logs lack counter/control/pending transitions, so
attribution of the recorded failures remains Unknown. The smallest proposed
remedy stops Timer A at each existing stopped startup/main checkpoint before
the unchanged source's initial consuming ICR read. `CRA & $EE` preserves other
readable bits and suppresses START/LOAD; no monitor ICR acknowledgement is added.

[AR-P13](00-ambiguity-register.md#ar-p13--deterministic-setup-for-two-existing-cia1-timer-fixtures)
names only the four BASIC-return profile cases and eight status-matrix cases in
those two existing files. No source, assertion, timeout, controlled injection,
observed MMIO interval or shared fixture changes. The user explicitly approved
that exact exception on 2026-10-10; both local setup pairs are now applied.
Independent correctness follow-up agrees that these two local read/write pairs
are the smallest sufficient setup correction and preserve substantive checks.
It verifies later deliberate underflow, exact handback trace, complete
status/register/stack and vector restoration, and KERNAL clock/keyboard service;
the status change belongs only in its eight-case callback, not shared `inVice()`.
Neither proposal follow-up edits files or runs VICE. Independent exact-fix
correctness review now reports no findings and confirms the actual diff is
exactly the two approved four-line additions. The directed run passes all
13 cases without skips. Fresh install/build/typecheck pass; the complete test
run starts at 13:24 CEST and is interrupted by root at 13:35 to verify the final
module organization instead. Exact-fix platform review also reports no findings:
the control write stops counting without acknowledging pending data, preserves
readable control bits, precedes the measured intervals and adds no generated-code
cost. Both applied-fix reviews are complete. The final full checkpoint passes
all 6,140 cases, with two existing unrelated skips, including both corrected
fixture families. The original failure's cause remains Unknown; this correction
qualifies a deterministic precondition, not retrospective attribution.

## Independent reviews

All six native roles are available. Reviewers are independent of the implementer
and specification authors. They inspect the complete baseline diff, including
untracked tests, and retained evidence; none runs a competing VICE instance.

| Lens | Reviewer | Current disposition |
| --- | --- | --- |
| Correctness / standards / oracle integrity | `keyboard_phase1_correctness` | No findings; fresh full checkpoint passes |
| Semantics / modern-source DX | `keyboard_phase1_semantics` | No findings |
| SFA / ABI / final closure | `keyboard_phase1_sfa` | No findings |
| Selected platform / bus effects | `keyboard_phase1_platform` | No findings |
| Actual assembly / complete costs | `keyboard_phase1_output` | No introduced blocking finding; three inherited MINOR debts explicitly owned |
| Host compiler performance | `keyboard_phase1_performance` | PE-001 MINOR; explicit RD-05 T-17 follow-up |

PE-001 identifies introduced repeated owner/block/producer-prefix scans for
eligible volatile reads, including old fixed peek-to-poke copies which cannot
use either new deferred-read path. Added cost is O(R(F+B+N)); a single block of
R copies adds quadratic inspections. New forwarding `indexOf` calls similarly
restart prefix searches. No measured latency or peak-RSS failure exists.
The smallest remedy is to retain the consumer index/fact in the existing
forwarding traversal and use that fact in retention, not introduce a general
lookup cache or framework. Disposition: keep the MINOR finding visible as
[RD-05 T-17](../../00-roadmap.md), due before RD closeout. The bounded correction
includes the existing state wiring, not a new optimization mechanism. No current
latency failure or emitted-output defect justifies expanding this three-family
checkpoint; the finding is neither fixed nor waived here. T-13 remains a distinct
baseline prefix-cloning follow-up.

The output auditor independently validates all 36 current and 34 retained
baseline generations. The generic local boundaries are 23 bytes/37 nominal
cycles for the opaque borrowed-base read, 23/34 for the hidden-destination store,
25/36 for the absolute-base store, 10/12–13 through the ordered predicate branch,
and 41/55 for the caller under generic callee-clobber assumptions. These are
local meets, not complete-source wins. Three inherited MINOR debts remain:

| Finding | Actual complete boundary and conditional expert candidate | Owner / disposition |
| --- | --- | --- |
| MC-001 | Opaque-base read 23/37; closed fixed-RAM caller permits a 21/35–36 candidate after complete footprint/dummy-read proof | RD-08 [#104](https://github.com/blendsdk/blend65/issues/104), reusing #89/#81 seams without duplicating their work |
| MC-002 | Complete predicate 19 bytes, 21 true/23 false cycles; equivalent same-page candidate 16 bytes, 20/21 cycles | Existing RD-08 [#51](https://github.com/blendsdk/blend65/issues/51) block layout |
| MC-003 | Caller 41/55; selected X-preserving callees permit a 39/53 candidate after cross-call availability proof | RD-08 [#104](https://github.com/blendsdk/blend65/issues/104) |

The candidate sequences are instruction-derived expectations, not newly assembled
or executed results. MC-001 is unsafe for a universal opaque base: an indexed
page crossing can add an observable MMIO dummy read. MC-003 is unsafe across an
unknown/X-clobbering callee. Their missing positive interprocedural proofs are
outside AR-P12's local corrections. MC-002 is existing whole-body layout debt,
not a prefix failure. All remain visible; none waives Phase 2's complete
acquisition/query/caller parity gate. Issue creation follows the prime directive's
durable meet-path authority; no existing issue is edited/closed and no Git push
occurs.

## Artifact evidence and limits

The retained evidence root is
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/keyboard-output-baselines.HKy67s/`.
`green-records.jsonl` identifies all 36 exact current generations. Reviewers
independently validate their PRG/build hashes, source identities, closure hashes
and complete memory totals. The nine same-source artifact comparisons and
resource deltas are in [task 1.2.7](99-execution-plan.md).
There is no BSS, SFA, ZP, generated-stack or scratch growth.

All original baseline records remain intact, but only 34 exact old generation
directories remain. Normal generation retention removed the read/PAL-6581 and
returned-store/PAL-6581 directories after diagnostic builds. Each missing
recorded PRG hash matches all three retained same-fixture profile PRGs. Those
bytes support a bounded byte comparison; the missing exact-generation sidecars
remain record-only. No recreated identity is presented as the original.

The retained `bounds` witness was built with checks disabled. Separate public
bounds-on cases and logs establish checked-stop behavior; they are distinct
artifact endpoints. Local cycle counts exclude bus stalls and applicable
crossing penalties. Looping whole-program deadlines, external aggregate NMI
stack and retained-firmware completion remain Unknown. No physical result is
claimed: **VICE-verified / hardware-unverified**.

## Authority and information hygiene

Expert **2.0.4**, immutable qualified content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; router SHA-256
`0760ec9d73fc7ed0e8575eb22d3fa9e5bdd2388d27b3989233239342c0b35ad8`;
Specification 4.0 key
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
Selected normative headings and frozen Chapters 04, 06, 08, 11 and 12 govern
the source/CPU/storage proof. Primary keys include MOS-PGM-1976, MOS-HW-1976,
MOS-6510-1982, MOS-6526-1981, CBM-C64-KERNAL-03, ACME-097-R266 and VICE-310-MANUAL.
Four cooperative PRG profiles, optimization `none`, NMOS 6510, ACME 0.97,
VICE 3.10 and Linux are the bounded target.

Mandatory routing-file orientation exposed historical setup summaries to some
reviewers. They reported and excluded those summaries from decisive evidence.
No expert qualification cases, grader answers or source manifest were opened
for these reviews. After those reviews, root's overly broad release-metadata
search also exposed historical qualification material. Root excludes it from
decisive evidence; source changes and independent review conclusions predate
that exposure. Future implementation-blind author packets use fresh contexts
and prohibit those historical records. This is a live-diff audit, not a blind
authority qualification.

Phase 1 is complete, GREEN and reviewed. Its local commit follows this record;
no push occurs. Phase 2, RD-05/DEF-7 and the explicitly owned follow-ups remain
open. This checkpoint publishes no input acquisition or classifier API.
