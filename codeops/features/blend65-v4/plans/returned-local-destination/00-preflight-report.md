# Preflight: proved returned-local destination

> **Status**: ✅ PREFLIGHT PASSED — all 5 findings resolved
> **Iteration**: 2 — bounded corrective rescan; 0 new findings
> **Artifact**: exactly the seven authored plan documents in this directory
> **Compiler baseline**: `3394f47b83d472ecdb16f67921777ca3e58e2cba`
> **Last Updated**: 2026-10-09
> **CodeOps Artifact Schema**: 1

⚠️ SAME-SESSION REVIEW: the primary authored this plan in the current session.
Five independent core clusters, a native semantics/concurrency review and blind
recommendation challenges reduce shared framing risk. Consider a fresh-session
or human domain review for additional independence; this is not compiler qualification.

## Scope and authority

Strict target: [decisions](00-ambiguity-register.md), [index](00-index.md),
[requirements](01-requirements.md), [current state](02-current-state.md),
[technical contract](03-01-destination.md), [tests](07-testing-strategy.md) and
[execution](99-execution-plan.md). This report and continuity notes are not audit
targets. AGENTS, routing/configuration, RD-05, upstream keyboard AR-P11, frozen
normative text and existing code are context, not additional passed artifacts.

Original goal: remove the reproduced ordinary returned-local copy. Smallest
approved design: whole-function eligibility, one retained ownership fact before
SFA and binding through the existing hidden destination. No per-call variants,
forced temporaries, new solver/pass/IR/runtime/API/dependency/harness or old-oracle edit.

**Correction authority:** the user's explicit AGENTS workflow prime directive
requires plan-owned technical decisions to proceed on the tagged best option,
without a prompt, and overrides default CodeOps pauses. The standing request also
authorizes corrections and fixes while finishing RD-05. The five corrections below
stay within the approved support boundary. This is not `--auto-design`, a new
user approval, a risk waiver, or authority for the separate partial-array repair.
The primary announced the best option before applying it. Scope/product expansion,
frozen authorities and protected test amendments still require their own gates.

## Codebase context

TypeScript 7.0.2, ESM/NodeNext, Node 22+, Yarn 1.22.22, Turbo and Vitest.
Public compiler exports resolve to built `dist`; root service fixtures consume
those exports. Whole-program facts precede SFA inventory and machine lowering.
Missing local inventory alone falls through to a global-label assumption.

Recon mapped the thirteen producer/consumer anchors in
[02-current-state](02-current-state.md), plus the partial-initializer chain,
public package/build edges, artifact/VICE fixture signatures and final closure.
All existing anchors resolve; the two proposed focused helpers are explicitly
new, not phantom references. Seven required documents, fifteen unique tasks and
eighteen named cases remain. No new tool or dependency is needed.

## Scan results

| #   | Dimension               | Findings      | Highest |
| --- | ----------------------- | ------------- | ------- |
| 1   | Ambiguities             | 0             | —       |
| 2   | Implicit assumptions    | PF-001        | MAJOR   |
| 3   | Logical contradictions  | 0             | —       |
| 4   | Completeness gaps       | 0             | —       |
| 5   | Dependency issues       | PF-002/PF-003 | MINOR   |
| 6   | Feasibility             | 0             | —       |
| 7   | Testability             | PF-004        | MAJOR   |
| 8   | Security blind spots    | 0             | —       |
| 9   | Edge cases              | PF-005        | MAJOR   |
| 10  | Scope creep             | 0             | —       |
| 11  | Ordering and sequencing | PF-002/PF-003 | MINOR   |
| 12  | Consistency             | 0             | —       |
| 13  | Codebase alignment      | PF-001        | MAJOR   |

Counts are by root cause, not table appearances: 0 critical, 3 major, 2 minor,
0 observations; all five resolved. Compiler/language and generated asynchronous
observation lenses add PF-004/PF-005. Distributed-runtime and persistent-format
migration checks are inapplicable.

### PF-001: partial-array runtime is not a working baseline (MAJOR)

**Severity/dimension:** 🟠 MAJOR; assumptions/alignment. **Location:** original
[ST-7](07-testing-strategy.md), task 1.1.2 and the GREEN requirement.
**Evidence:** `packages/compiler/src/frontend/aggregates.ts:317` retains supplied
elements; `semantic/lower-aggregate-literal.ts:228` retains null fill;
`machine/lower-aggregate-members.ts:44` expands the complete extent and throws
on an absent element. The existing frontend diagnostic test at
`test/rd04/diagnostics-aggregate-permissions.spec.test.ts:114` proves warnings,
not execution.

**Problem:** ST-7 assumed the unchanged partial-array fallback could execute.
The public probe instead confirms complete frontend analysis with W10140/W10190,
then public check/build failure: `COMPILER_LOWERING: Fixed array construction is
missing an element`. Requiring runtime GREEN here would silently import another repair.

| Viable response                                                                                              | Benefit                                                         | Cost/risk                                                                  |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A: preserve frontend legality and structural fallback checks here; own the missing runtime repair separately | Keeps the approved correction bounded without hiding the defect | Partial-array runtime remains pending                                      |
| B: separately approve and qualify the partial-array repair first                                             | Establishes that runtime prerequisite                           | Adds an unrelated dependency; justified only if the user requires it first |

**Best option:** strengthened A. ST-7 now proves frontend legality/warnings;
internal tests require both no certificate and unchanged semantic operations/local
inventory. [T-15](../../00-roadmap.md) owns the backend defect and pending independent
runtime oracle: initialized byte 0 equals 7; no value is assigned to byte 1.
That runtime portion is not skipped, counted as passing, or waived. No source ban.
**Decision:** resolved under the explicit standing technical-correction authority.
**Verification:** independent grounding fix review reports no remaining findings.

Confidence: Medium — independent recommendation challenge used verified supplied
excerpts/probe, not direct filesystem inspection. Hardening: added structural
noninterference and retained the pending independent runtime expectation.
Challenger: converged. Strongest counterargument: internal checks do not prove
eventual runtime behavior; T-15 must still qualify it.

### PF-002: activate only after every root consumer is ready (MINOR)

**Severity/dimension:** 🟡 MINOR; dependency/order.
**Location:** original task 1.2.5 omitted the local before tasks 1.2.6/1.2.7.
**Evidence:** `packages/compiler/src/storage/inventory.ts:483` reserves the local;
`machine/lower-state.ts:239` expects its home and otherwise forms a global label.
**Problem:** an intermediate production checkpoint could remove storage while
construction/returns still use the old binding.
**Best option:** prepare proof and consumers inertly, then publish the fact and
matching inventory omission together in 1.2.7. No runtime activation system is added.
Keeping all dependent changes in one unbounded earlier task was considered and
dropped because the staged preparation is smaller and preserves green checkpoints.
**Decision:** resolved under standing technical authority.
**Verification:** grounding fix review confirms the revised dependency order.

### PF-003: rebuild before testing public package consumers (MINOR)

**Severity/dimension:** 🟡 MINOR; dependency/order.
**Location:** original 1.2.8 and directed verification lines.
**Evidence:** `packages/compiler/package.json:8` exports `dist/index.js`;
`test/rd05/source-library-fixture.ts:3` imports that public package.
**Problem:** directed tests could run stale compiler output after source edits.
**Best option:** run `yarn build` before post-edit public-package directed tests;
retain the full phase checkpoint. A source alias would change the tested boundary
and is unnecessary.
**Decision:** resolved under standing technical authority.
**Verification:** grounding fix review confirms both explicit build requirements.

### PF-004: independently test word-valued destination binding (MAJOR)

**Severity/dimension:** 🟠 MAJOR; testability/compiler semantics.
**Location:** original ST-17 contained only `byte[257]`.
**Evidence:** technical contract §Whole-function eligibility requires complete
widths/strides; §Root and construction consumers changes indirect root accesses.
Internal footprint tests and old literal/borrowed-return cases do not prove this
new certified word-root path.
**Problem:** dropped high bytes or byte stride could pass every new value oracle.
**Best option:** extend ST-17 with fresh returned `word[129] = [;0]`, writes
127/128 to `$1234`/`$5678`, exact bytes 254–257 `34 12 78 56`, all prior bytes
zero, and no redundant complete home/copy. Reusing an existing oracle remains
viable only if it demonstrably reaches and distinguishes this exact bound path;
none was found. No new file/harness.
**Decision:** resolved under standing technical authority.
**Verification:** native semantics fix review confirms the obligation and spec-first owner.

Confidence: High for the plan amendment; exact existing coverage would change the
reuse decision. Hardening: retain separate certified-path and fallback witnesses,
not one combined case. Challenger: converged. Strongest counterargument: possible
duplicate coverage, but no equivalent independent case was established.

### PF-005: distinguish live NMI from masked IRQ (MAJOR)

**Severity/dimension:** 🟠 MAJOR; edge cases/generated concurrency.
**Location:** original ST-11 covered IRQ and direct hardware-RAM publication only.
**Evidence:** `test/rd05/nmi-route-boundaries.spec.test.ts:208` supplies an admitted
masked-main/live-NMI immediate writer; `nmi-route-output.spec.test.ts:148` supplies
the constant-write route. Frozen Chapter 06 §7.5, Chapter 15 interrupt-source
contract and the qualified NMI entry contract prohibit treating I as an NMI mask.
**Problem:** a checker discarding all asynchronous observers at I=1 could pass
the proposed cases.
**Best option:** extend ST-11 with the live NMI `poke($D018,$18)` observer and an
otherwise identical I=1/no-live-generated-NMI positive control. Live NMI retains
the complete local/copy; the eligible control binds the destination. Both yield
`Pair {x:1,y:7}`. Preserve baseline warnings. Existing general IRQ/NMI coverage
would be reusable only with this exact binding/fallback distinction; none was
identified. No route implementation or new external firmware guarantee.
**Decision:** resolved under standing technical authority.
**Verification:** native semantics fix review confirms the paired discriminator.

Confidence: Medium — matched sources are publicly admitted, but corrected artifact
binding/fallback and runtime remain unqualified. Hardening: added the matched
positive control so unrelated rejection cannot make the fallback test pass.
Challenger: converged. Strongest counterargument: conservative rejection for a
different reason; the independent positive control must rule that out.

## Independent review and bounded rescan

| Review owner                 | Boundary                                                 | Result                                                              |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| Core soundness cluster       | Dimensions 1/3/12                                        | No findings                                                         |
| Core grounding cluster       | Dimensions 2/13                                          | PF-001; bounded fix verified                                        |
| Core delivery cluster        | Dimensions 4/5/11                                        | PF-002/PF-003; grounding fix verification closes their direct edges |
| Native SFA risk cluster      | Dimensions 6/8/9                                         | No findings                                                         |
| Core fit cluster             | Dimensions 7/10                                          | No findings                                                         |
| Native semantics reviewer    | Compiler/language and generated asynchronous observation | PF-004/PF-005; bounded fixes verified; no DX finding                |
| First blind challenger       | PF-001 scope                                             | Converged, structural strengthening                                 |
| Second/last blind challenger | Late PF-004/PF-005 oracle batch                          | Converged, matched NMI control                                      |

Iteration 2 rechecks all thirteen dimensions within these same seven documents:
changed test scope is explicitly owned, activation follows consumers, public tests
use fresh builds, wide/async witnesses distinguish the intended branches, and no
new authority, dependency, representation or support layer appears. No new finding.
Independent reviews were read-only; only the primary ran verification.

Earlier extra-role dispatches hit the runtime thread limit. Later native semantics
and both named challengers were available; the required independence was retained.
The delivery reviewer disclosed a bounded release-record read exposing historical
case names, not answers. Its dependency review is not a blind qualification case.
Neither challenge is counted as direct code, artifact or runtime verification.

## Direct evidence and limits

Private evidence root:
`/home/gevik/workdir/github/blend65.ri/blend65/.git/worktrees/v4/returned-local-planning.mnvVPp/`.

| Evidence                                                 | Result                                                           | Source SHA-256                                                     |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `partial-baseline.log`, `partial/src/game.blend`         | Frontend complete; check/build reproduce missing-element failure | `1e7e236c6744a107c6014c090b4d81c08352e8e7b647d692657930d592141bf7` |
| `domain-baselines.log`, `word/src/game.blend`            | Four-profile check/build succeeds, existing W10143               | `ea49acf14cb44af1c79ef6070a2215b8f5321446e0249aca4377112c1d93294a` |
| `domain-baselines.log`, `nmi/src/game.blend`             | Four-profile check/build succeeds, no diagnostics                | `94b5097c0bc9e5143dafc09e6af9f485f7e55a141a833230293a142e0044afae` |
| `nmi-control-baseline.log`, `nmi-control/src/game.blend` | Four-profile check/build succeeds, existing W10181               | `51e0b24a098a2960b9d345427c43b13a8a3a9609ca9467b8a954ab9c75d99ea8` |
| `foundation.log`                                         | Foundation qualification 12/12 pass, no skips                    | Compiler/source/test paths unchanged                               |

The admitted witness probes total 24 successful service operations, not 24 Vitest
tests. No VICE run occurred in preflight. Existing ordinary artifact costs are
upstream evidence, not this proposed correction's measured result.

Status: **Verified complete / Fact** for the corrected planning obligations.
Implementation, selected PA-only applicability, transformed bytes/resources,
runtime and silicon remain **Unknown**. No RD-05/DEF-7, public keyboard, universal
firmware/stack, production-grade or expert-output closeout follows.

Lineage: active expert `2.0.4`, immutable content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; semantic-preservation,
mandatory-semantic-payload/two-oracle-proof, memory effects, ABI/final-closure and
interrupt-entry headings. Governing keys `BLEND65-SPEC-4-038b70e9`,
`MOS-PGM-1976`, `CBM-C64-KERNAL-03`, `ACME-097-R266`. Frozen spec and expert
content, production and existing test files were not modified.

## Exact passed artifact identity

Compare these content hashes before execution. A contract edit needs a targeted
recheck; later task-progress timestamps do not inherit a different design pass.

| File                     | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| 00-ambiguity-register.md | `2fa105eaf1ada450c355df519ebbd0acdf0cf4a4778259cba174bbd888ccb30e` |
| 00-index.md              | `a35bb0c46eb90649ea6edd83f06e36835eb283d5e544b25361b2637f02009548` |
| 01-requirements.md       | `606b5c46bfce6408a1521d463fd12dac0eaa9ff90239119d0070233546b004af` |
| 02-current-state.md      | `65ae40be828697710a6c7d3bc55e99781b0a455264cf5300bf755603db5dfecd` |
| 03-01-destination.md     | `5b194761b1e4f5092712deda6e9adfd6c3c24954a1b8a46c675da1b3d9fb9e89` |
| 07-testing-strategy.md   | `b529ccc7df50955e37b06a8dbdca0685927f2ce967af0b1516a0a411eb41a3d0` |
| 99-execution-plan.md     | `df62ec8a0ada83d464e1f8a5fe9bdb4d754bc60b8a0d6ee47d9d455b275a3c6b` |
