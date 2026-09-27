# Preflight Report: RD-05 Stage A

> ⚠️ **SAME-SESSION REVIEW:** The primary reviewer created this plan in the preceding turn.
> Same-agent bias risk is elevated. Five fresh-context auditors and one independent challenger
> checked the work. A fresh-session or human compiler-expert review remains useful for additional
> independence; it is not a new execution prerequisite.
>
> **Status**: ✅ PREFLIGHT PASSED — all 4 findings resolved; no new findings
> **Iteration**: 2 — bounded corrective rescan of the same eight-document target
> **Previous iteration**: BLOCKED — 3 major and 1 minor finding
> **Carried forward**: None — PF-001–PF-004 verified closed at plan level
> **Reviewed content SHA-256**: `8e3950fdccf4d3f2a041032dd654885cef2e0f4a4db6c3fa1455da390f9dc74e`
> **Artifact**: RD-05 Stage A implementation plan, eight documents listed below
> **Iteration 1 baseline commit**: `bb5fafd8e36cc3b213cb3fe05598736ab9575dbb`
> **Iteration 1 plan-directory tree**: `f85300f7ebb08644972b3eb1e639cdd94031e802`
> **Codebase Grounded**: at least 23 production, 11 test/support and 5 configuration files examined;
> additional frontend lookup and lowering dependencies checked
> **Last Updated**: 2026-09-27
> **CodeOps Artifact Schema**: 1

## Verdict and Scope

The corrected Stage A plan passes preflight and the simplicity check. All three integration
omissions and the inaccurate current-state claim now have verified plan corrections. The
implementation remains future work. No new framework, evaluator, registry, runner, schema,
dependency or product capability was added.

| Finding | Approved plan correction | Disposition |
|---|---|---|
| PF-001 | Include the final assembly admission check and retained negative checks. | Resolved |
| PF-002 | Supply profile constants before early array/enum type preparation. | Resolved |
| PF-003 | Recognize exact profile members during mixed-module resolution. | Resolved |
| PF-004 | Identify constant-switch simplification as required existing-task work. | Resolved |

The exact audit target is [00-ambiguity-register](00-ambiguity-register.md),
[00-index](00-index.md), [01-requirements](01-requirements.md),
[02-current-state](02-current-state.md), [03-01-profile-facts](03-01-profile-facts.md),
[03-02-cooperative-pipeline](03-02-cooperative-pipeline.md),
[07-testing-strategy](07-testing-strategy.md) and [99-execution-plan](99-execution-plan.md).
The report and temporary continuity notes are excluded from that baseline tree.

Scope is strict: four cooperative KERNAL PRG profiles and 14 ordinary scalar compile-time facts.
Requirements, frozen specification/expert material, roadmaps and implementation are context, not
additional audit targets. This report does not approve the whole RD-05 plan or qualify new runtime
behavior. AR-P3 remains an accepted, named NMI deferral with its existing owner/revisit trigger.
No takeover, new interrupt route, banking facility or game-policy API enters Stage A.

The user confirmed XHigh for this preflight and then said “i approve” to the explicit request
to apply PF-001–PF-004 and rescan. That approval authorizes the bounded plan corrections, not
compiler implementation or a push. The four corrections are applied and verified in iteration 2.

## Codebase Context

The observed stack is TypeScript 7.0.2, Node 22, Yarn 1.22.22, Turbo and Vitest. The compiler
resolves modules and types before expression analysis, then lowers through CFG and closed SFA
storage into target/layout and terminal ACME serialization. Build/run services publish and pin
the exact fresh generation. Existing VICE helpers own process cleanup and observations.

The documented inspection inventory includes these production paths under
`packages/compiler/src/`:

- `index.ts`; `project/manifest.ts`.
- `frontend/{index,profile,profile-bindings,analyzer,service,semantic-types,scalar-expressions,encoded-literals}.ts`.
- `target/{profile,c64-pal-kernal}.ts`; `layout/{startup,c64-layout}.ts`.
- `semantic/{lower,cfg,lower-calls}.ts`.
- `services/{services,vice,resource-diagnostics}.ts`.
- `artifacts/{acme-validate,acme-serializer,build-evidence-validator}.ts`.

Additional direct dependencies included frontend `modules.ts`, `module-bindings.ts`,
`aggregate-types.ts`, `aggregate-constants.ts`, `aggregate-names.ts`, `enum-types.ts`,
`comptime.ts`, and semantic `lower-control.ts`, `lower-expressions.ts`, `value-lifetimes.ts`.
Relevant test/support inspection covered compiler frontend profile, target profile, ACME and
service tests; root import-boundary files; RD-04 diagnostic/runtime fixtures; and M1
`vice-runtime.ts`, `vice-monitor.ts`, `vice-driver.ts`, `vice.spec.test.ts`. Root/compiler manifests,
both Vitest configurations and `codeops/codeops.json` supplied current configuration evidence.

Authority is frozen Specification 4.0, current recorded normative SHA-256
`ee2be7c2139ff82f22d1d8f169251bae1d2244e5e4a74bddbdfc4903af39fff8`, and qualified expert
`2.0.0`, content `c9e70fab6039e9ced3108e88f0ea9730d4fd3007`. The expert's earlier frozen
specification binding is not changed by this review. Relevant expert sections are
`blend65-semantics.md#authority-and-use`, `compiler-architecture.md#required-pipeline-invariants`,
`compiler-architecture.md#target-composition`, `c64-memory-and-runtime.md#startup-contracts`,
`evidence-parity-and-recovery.md#transformation-proof` and
`acme-and-artifacts.md#vice-proof-contract`.

Primary checks used [TS-18](../../../../../spec/02-type-system.md#ts-18--compile-time-constants),
the frozen [module rules](../../../../../spec/10-modules.md) and
[C64 appendix](../../../../../spec/appendix-c64.md) §§5.1 and 9.1. VICE model/resource claims
were checked against pinned source commit `4d283a2e7dd59b7e378524878e81ecc7826b700c`:
[model definitions](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64model.c),
[command options](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/c64/c64-cmdline-options.c),
[monitor resource response](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/monitor/monitor_binary.c)
and [VIC model values](https://raw.githubusercontent.com/VICE-Team/svn-mirror/4d283a2e7dd59b7e378524878e81ecc7826b700c/vice/src/vicii.h).

## Iteration 1 Coverage

Finding membership can overlap dimensions; the unique total is four.

| # | Dimension | Findings | Highest severity |
|---|---|---|---|
| 1 | Ambiguities | None | — |
| 2 | Implicit Assumptions | PF-002 | Major |
| 3 | Logical Contradictions | None | — |
| 4 | Completeness Gaps | PF-001 | Major |
| 5 | Dependency Issues | None beyond the assigned integration gaps | — |
| 6 | Feasibility Concerns | None | — |
| 7 | Testability | No separate finding; PF-002/PF-003 include missing discriminating cases | — |
| 8 | Security Blind Spots | None | — |
| 9 | Edge Cases | None beyond the assigned lookup gaps | — |
| 10 | Scope Creep Indicators | None | — |
| 11 | Ordering & Sequencing | No separate finding | — |
| 12 | Consistency | None | — |
| 13 | Codebase Alignment | PF-001–PF-004 | Major |

All ten alignment subchecks were completed. Architecture mismatch produced PF-002; impact
blindness produced PF-001/PF-003; stale assumptions produced PF-004. Test-impact corrections are
included under those root causes. Phantom references, redundancy, dependency reality, convention
violations, scope versus reality and migration/compatibility yielded no separate finding.

| Independent cluster | Dimensions | Result |
|---|---|---|
| Soundness | 1, 3, 12 | No findings |
| Grounding | 2, 13 | Three major findings and one minor finding |
| Delivery | 4, 5, 11 | Independently confirmed PF-001; deduplicated |
| Risk | 6, 8, 9 | No additional findings |
| Fit | 7, 10 | No additional findings; simplicity check passed |
| Challenger | Entire major-finding batch | All three upheld; converged on bounded remedies |

The lead also completed the three selected domain clusters:

| Domain lens | Grounded result |
|---|---|
| Compiler/language | PF-002/PF-003 expose earlier consumers of ordinary constants; PF-004 corrects lowering evidence. Existing branch checking, symbolic effects and pre-emission storage closure remain required. No new semantic rule is needed. |
| Data/migration | Exact rational/clock components fit scalar types; independent arithmetic gives 50124/59826 millihertz. Version-1 evidence already carries string profile identities (`build-evidence-validator.ts:432`). No data migration or new schema is necessary. PF-001 covers terminal admission. |
| Concurrency/failure | Per-analysis facts and pinned target identity are explicit. `services.ts:594`, `:626`, `:649` already own fresh-build, launch and uncertain-cleanup behavior. ST-9/ST-20/ST-21 exercise the relevant interleavings. Distributed-node/migration machinery is inapplicable. |

| Severity | Count | Disposition |
|---|---|---|
| 🔴 Critical | 0 | — |
| 🟠 Major | 3 | Resolved in iteration 2 |
| 🟡 Minor | 1 | Resolved in iteration 2 |
| 🔵 Observation | 0 | — |

## Iteration 1 Findings and Authorized Corrections

The original evidence below refers to the iteration 1 baseline. Each approved remedy is now
applied to the plan; iteration 2 supplies the verification verdict without renumbering findings.

### PF-001: Include the final profile admission check 🟠 MAJOR

**Dimension:** Completeness Gaps; Codebase Alignment / Impact Blindness.
**Location:** `03-02-cooperative-pipeline.md:42`, `99-execution-plan.md:112`,
`02-current-state.md:22`.
**Codebase evidence:** `packages/compiler/src/artifacts/acme-validate.ts:74`,
`artifacts/acme-serializer.ts:200`, `services/services.ts:393` (same compiler source prefix).

**Problem:** The plan changes startup/layout admission but omits the terminal serializer's
independent PAL/6581-only check. Every build calls it. The other three profiles would still fail
with `COMPILER_SERIALIZATION` before ACME runs. This consequence is inferred from the verified
call chain, not claimed as a run of unimplemented code.

**Recommended — only necessary correction:** Include `artifacts/acme-validate.ts` in the
current-state inventory, component contract and existing task 2.2.2. Admit the same closed four-ID
family while preserving serializer/packager checks and exact certificate/profile agreement.
ST-18 already builds all four profiles; retain negative format/certificate coverage. No additional
phase or serialization abstraction is needed.

**Refutation / strongest counterargument:** ST-16/ST-18 would catch the failure during execution.
That limits escape risk but does not give the omitted code an implementation owner. Preserving
version-1 evidence validators does not address this separate ACME-input validator. Removing the
guard or centralizing all validation would weaken or needlessly restructure the terminal defense.

**Confidence:** High; an earlier path that bypassed this validator would change the conclusion,
but the direct caller is unconditional. **Hardening:** no change to the remedy; independent
challenger converged and confirmed retained negative checks.
**User Decision:** Approved on 2026-09-27 — user accepted the recommended plan correction and
corrective rescan. Applied and verified closed in iteration 2.

### PF-002: Make profile constants available when types are prepared 🟠 MAJOR

**Dimension:** Implicit Assumptions; Codebase Alignment / Architecture Mismatch.
**Location:** `03-01-profile-facts.md:8`, `:80`, `:92`; `99-execution-plan.md:73`.
**Codebase evidence:** `packages/compiler/src/frontend/analyzer.ts:100`, `:111`, `:126`;
`aggregate-types.ts:54`, `:153`, `:370`; `aggregate-constants.ts:234`;
`aggregate-names.ts:23` (same frontend prefix). Frozen `spec/02-type-system.md:478` is TS-18.

**Problem:** The proposed binding injection happens after enum/struct preparation and declaration
header typing. Those earlier consumers use source-declaration lookup, not the later expression
evaluator's binding callback. Ordinary uses such as `byte[c64.profile.rasterLines]` in a signature
or a profile-derived enum value would remain unresolved. This contradicts the promised ordinary
constant behavior; TS-18 explicitly includes array sizes and enum member values.

**Recommended — smallest correction:** Supply the same immutable selected scalar declarations
to the existing early constant lookup before aggregate/header preparation. Name the analyzer and
aggregate lookup owners in Phase 1. Preserve source precedence, aliases, binding identity and
snapshot isolation; keep both existing evaluators rather than adding another one. Extend the
existing frontend test families with qualified/imported/aliased extents, a derived source constant,
struct-field and parameter/return extents, and an in-range enum value such as `cyclesPerLine`.

**Refutation / strongest counterargument:** Some later local imported constants can resolve
through a scalar scope. Early signatures have no such scope, and qualified names bypass it, so
that path does not fix the omission. A second lookup input risks duplicated resolution semantics:
keep it narrow and share the existing rules. Separating binding allocation from header resolution
is a viable broader implementation alternative, but reordering alone still leaves the requirement
for a source declaration; no evidence justifies that extra initialization-order change here.

**Confidence:** High; an existing early synthetic-constant path would change the conclusion,
but none is present in the inspected consumers. **Hardening:** remedy unchanged; challenger
converged and sharpened tests to include early extents and byte-range-valid enum values.
**User Decision:** Approved on 2026-09-27 — user accepted the recommended plan correction and
corrective rescan. Applied and verified closed in iteration 2.

### PF-003: Resolve mixed source/profile modules before reporting missing exports 🟠 MAJOR

**Dimension:** Codebase Alignment / Impact Blindness.
**Location:** `03-01-profile-facts.md:88`, `:96`; `99-execution-plan.md:73`, `:74`.
**Codebase evidence:** `packages/compiler/src/frontend/modules.ts:481`, `:549`;
`frontend/service.ts:293`, `:317`, `:391` (same compiler source prefix).

**Problem:** The contract allows unrelated source members in `c64.profile`. Once such a source
module exists, the earlier module resolver reports E10012 for synthetic members absent from its
source-export table. Later binding injection and unavailable-module obligation filtering do not
remove that error. For example, a source `c64.profile` exporting only `extra` would break an
otherwise valid import of `rasterLines`.

**Recommended — smallest correction:** Pass exact selected synthetic-member knowledge into the
existing resolver/service path before it reports missing exports. Keep genuine missing/private
source-member errors, reserved-name collisions, duplicate aliases and lexical shadowing. Name
this existing owner in Phase 1 and extend ST-2/ST-7 with positive qualified/selective-import mixed
module cases and matching missing/private/collision negatives. This is a declarative input, not
a platform registry or backend dependency.

**Refutation / strongest counterargument:** A narrowly provenance-checked E10012 filter is a
possible alternative, but risks hiding real visibility errors. The proposed obligation filter
does not filter E10012 at all. Selected profile information already exists before resolution
(`service.ts:286`), so early exact-member recognition fits the current flow. Reserving the whole
namespace would contradict the approved source contract. An in-memory public-frontend probe of
the analogous existing `c64.vic` operation confirmed E10012 appears when an unrelated source
export is added; no files were changed by the probe.

**Related:** PF-002 may share the same immutable declaration input, but its type-value lookup
failure is independent: fixing module acceptance alone does not fix early constant evaluation.
**Confidence:** High; an exact earlier profile-member resolution path would change the conclusion,
but the source-only resolver and retained diagnostics were directly inspected.
**Hardening:** remedy unchanged; independent challenger converged and retained visibility tests.
**User Decision:** Approved on 2026-09-27 — user accepted the recommended plan correction and
corrective rescan. Applied and verified closed in iteration 2.

### PF-004: Correct the current-state claim about constant switches 🟡 MINOR

**Dimension:** Codebase Alignment / Stale Assumptions.
**Location:** `02-current-state.md:18`.
**Codebase evidence:** `packages/compiler/src/semantic/cfg.ts:375`, `:390`;
`semantic/value-lifetimes.ts:25` (same compiler source prefix).

**Problem:** The row groups constant switches with conditions that already select their live
path. Current switch lowering emits the comparison chain and every clause body, and reachability
traverses both successors. It does not implement the claimed constant-selector pruning.

**Recommended — only necessary correction:** Distinguish already-supported conditional/if
selection from the demonstrated constant-switch gap. Mark the latter as concrete work for
existing task 2.2.3 and ST-14, not a new optimizer or phase.

**Refutation:** Task 2.2.3 already permits a demonstrated lowering repair, so this is a minor
reconnaissance correction, not an additional unowned major implementation requirement. Deleting
the whole evidence row would also discard useful verified facts. No broader change is warranted.
**User Decision:** Approved on 2026-09-27 — user accepted the recommended documentation correction
and corrective rescan. Applied and verified closed in iteration 2.

## Iteration 2 — Bounded Corrective Rescan

**Status: Verified complete. Claim kind: Fact** for the corrected plan and this scoped audit,
not for compiler implementation or runtime capability. Start commit: `1f2a2fed`.
Reviewed the same eight-document target, the authorized fix diff and direct dependencies.
No requirement, language, expert-baseline or product-scope change was introduced.

| Finding | Verified correction and retained proof |
|---|---|
| PF-001 | `03-02:42`, task 2.2.2 and ST-18 include the final `acme-validate.ts:74` admission gate and real four-profile serialization. Task 2.3.1 owns focused format/closed-certificate negatives in the already planned implementation-test file. Existing spec tests remain unchanged. |
| PF-002 | `03-01:80` and task 1.2.2 supply selected immutable declarations before the `analyzer.ts:100/111` preparation steps. ST-2/8/9 cover early extents, in-range enum values, derived constants, aliases, shadowing and snapshot isolation. No new evaluator or preparation framework. |
| PF-003 | `03-01:106` and task 1.2.3 separately own member recognition before `modules.ts:481/549` diagnostics and later obligation filtering. ST-2/ST-7 distinguish mixed-module success from missing/private/collision failures. No blanket E10012 suppression. |
| PF-004 | `02-current-state:20–21` separates existing branch selection from the switch gap. Task 2.2.3 requires the CFG repair, retaining selector effects, clause/fallthrough semantics, ST-14/ST-15 and pre-SFA removal. No new optimization pass. |

Short `03-01`, `03-02` and `02-current-state` references above name this plan's corresponding
Markdown files. Source basenames use the compiler paths recorded in the original findings.

| Rescan cluster | Dimensions | Review result |
|---|---|---|
| Soundness | 1, 3, 12 | Fresh independent auditor: no findings; four corrections consistent |
| Grounding | 2, 13, including all ten subchecks | Fresh independent auditor: PF-001–PF-004 closed; no new findings |
| Delivery | 4, 5, 11 | Independent read-only fallback auditor: owners and specification-first order verified; no findings |
| Risk | 6, 8, 9 | Lead inline: current seams remain feasible; exact-member visibility, closed terminal checks and per-analysis state retained; no findings |
| Fit | 7, 10 | Lead inline: concrete cases and file owners; same 33 tasks/25 families, no new support machinery; no findings |

Another auditor spawn reached the session thread limit. Delivery therefore reused the prior
independent challenger with a bounded audit packet, and risk/fit ran inline. Three independent
auditors participated; required reviewer independence/count and all 13 dimensions were preserved.
No new recommendation challenger was needed: the already challenged remedies were approved and
did not change. No further iteration is warranted.

The compiler/language lens verifies separate early name-acceptance and constant-value consumers,
ordinary constant semantics and effect-preserving switch work. Data/migration checks confirm
unchanged fact values and version-1 identities. Concurrency checks confirm immutable per-analysis
inputs, no shared profile cache, unchanged pinned-generation/process ownership, sequential VICE
and retained AR-P3. No additional domain finding resulted. The original expert lineage and
primary source checks remain applicable; no source implementation changed since iteration 1.

The reviewed-content digest hashes the UTF-8 concatenation of one record per target document,
in the order listed under Verdict and Scope: `filename`, NUL, lowercase SHA-256 of the file's
exact bytes, newline. Report, notes and roadmap are excluded. Recheck this digest before execution;
any target-content change needs a targeted freshness check, not an automatic wider audit.

## Simplicity and Decision Record

The closed fact module has immediate frontend/backend consumers. One monitor resource reader
proves the actual emulator model; the existing request/decoder/checkpoint controls support it.
The 33 tasks and 25 test families map to the scoped behavior and required quality steps; count
alone is not evidence of overengineering. Tests already separate semantic expectations from
assembly/cost expectations and prohibit copying production fact rows as their oracle.

The three major fixes fit existing tasks and tests. Extra time would not justify a general
declaration registry, evaluator rewrite or validation framework. The strongest contrary approach
is broader early-binding unification, but the demonstrated need is only to connect the selected
immutable declarations to two existing consumers. Recommendations would change if that earlier
path already existed; direct inspection found none.

The adversarial bias check exposed the creation-time assumption that expression bindings were
the only constant consumers and that startup/layout were the last profile guards. Frozen ordinary
constant rules and the terminal serializer contradict those assumptions. No hardware/specification
change is needed. AR-P2 library authority and AR-P3 deferral are respected, not reopened.

Iteration 1 changed only this report and roadmap bookkeeping. The approved iteration 2 changes
six of the eight target documents, this report and the feature roadmap. No compiler, spec test,
frozen specification or expert file changed, and no new four-profile VICE run is claimed.
Stage A advances to **Plan Preflighted**, still 0/33 implementation tasks. Full RD-05 remains
unfinished under its existing owners; full feature progress remains 2/10.

## Documentation Verification

Iteration 1 validated 85 local links and 14 heading anchors against its original eight blobs.
Iteration 2 passed 87 local links, 14 heading anchors, Markdown fences/whitespace, the reviewed
eight-document content digest, all 33 unchanged task IDs (11 per phase), all 25 ST family IDs
and all four resolved finding IDs. The scope/ambiguity register, requirements delta, compiler,
tests and frozen paths are unchanged. Targeted Prettier completed; authored Markdown is
intentionally excluded by `.prettierignore`, so direct structure/link/content checks supply the
formatting evidence. The compiler suite was not rerun for these documentation-only corrections.

The roadmap engine confirms the feature's 2/10 count. Its repository-wide check reports only
the existing portfolio difference (1/10 versus 2/10 and rolled-up status). Portfolio synchronization
is deferred until integration by branch policy; `codeops/00-roadmap.md` is not modified here.

## Next Steps

| Action | Owner |
|---|---|
| Confirm the effort handoff for Stage A Phase 1 implementation | User |
| After confirmation, execute Phase 1 specification-first against this passed plan | Coding agent |
