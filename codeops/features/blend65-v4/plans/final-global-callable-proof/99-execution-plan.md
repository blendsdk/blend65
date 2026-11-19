# Final global callable-proof repair (#164, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-33 / #164
> **Progress**: 0/6 tasks (0%)
> **Status**: Planned — no implementation or new tests authored
> **Baseline**: `acbc1c8c`, clean `feature/v4-rebuild`
> **Scope**: strict; automatic global storage and final build admission
> **Reasoning**: high — physical placement must preserve the call proof already consumed by SFA and lowering
> **Created**: 2026-11-19

## Objective and authority

Prevent publication of the [confirmed #164 output](../automatic-callable-placement-check/99-execution-plan.md#t-1644-classification-and-finding-gate):
a constant write changes an automatically placed global callable's bytes, but the compiler still
uses its earlier source-function target.

The user approved a separate bounded repair plan, **without waiver**, after that diagnosis.
This document plans corrective work; it does not authorize starting implementation in this run,
close #164, change the frozen language, or approve a release.

**Planning target:** the diagnosed automatic-global proof boundary in `blend65-v4`.
**Context artifacts:** the diagnostic mini-plan; normative function, memory and diagnostic rules;
existing semantic target/kill analysis; data lowering, final layout and build admission.
**Planning modification set:** this mini-plan and the new T-33 feature-roadmap row.

**Smallest viable design:** supply actual global intervals to the existing order-sensitive,
interprocedural target analysis through a small diagnostic-only adapter. Validate each real
representation before admission and the final selection before serialization. Do not rerun
allocation, replace the closed call graph, add a placement solver, or introduce a generic proof
framework, cache, runtime check or dispatcher.

## Requirements and boundaries

1. A materialized global whose bytes are changed before its callable value is evaluated must not
   retain an unsupported target fact. The governing rules are
   [function representation](../../../../../spec/02-type-system.md#23-function-types),
   [finite targets](../../../../../spec/06-functions.md#43-finite-target-proof) and
   [ordered memory effects](../../../../../spec/12-intrinsics.md#31-memory-access).
2. Use final global addresses from the **same closed representation**, not provisional storage,
   a prior build, display names or source `placement.at` flags synthesized after analysis.
3. Preserve disjoint writes, source ordering, definite typed restoration, initializer order and
   existing helper/alias behavior. A call target evaluated before an argument changes the global
   remains the captured target for that call; a later call must use the later facts.
4. Include callable leaves of materialized global structs/fixed arrays through the existing
   root-relative interval analysis. Do not discard enclosing-object identity.
5. A new final target set must be nonempty and contained in the set already consumed by lowering,
   effects, recursion and SFA. No newly discovered edge or storage demand is admitted after closure.
   A safe conservative existing superset need not be rewritten.
6. An invalid final representation must not publish. If no valid representation remains, preserve
   canonical E10277 at the failing call, with the necessary storage/write related locations.
   Do not substitute capacity exhaustion, an unrelated compiler error, a null-call runtime or
   an actual call to the overwritten numeric address.
7. Keep valid existing alternatives available: an invalid optional construction must not reject
   otherwise legal source when the exact canonical construction remains valid. Never treat a
   geometrically complete but proof-invalid reference as an accepted fallback.
8. Accepted unaffected controls keep their target instructions, volatile effects, PRG bytes and
   storage costs. In particular, `none` remains the canonical construction; this unit adds no
   optimization or new runtime bytes/homes.
9. Keep `checkProject`'s existing **pre-layout** boundary (`services.ts:238–246`), and keep editors
   frontend-only. A pre-layout check can succeed where final build rejects with E10277. Requiring
   final-layout diagnostics from those services is a separate product-scope decision.
10. SFA-local constant-address interactions, asynchronous handler/callable interference, automatic
    collision avoidance and general memory safety are **not qualified by this unit**. Existing
    #164 and interrupt-analysis ownership remain; no broader issue-close claim follows.

Existing `*.spec.test.ts`, shared helpers, timeouts, `spec/`, qualified expert authority and
historical release records stay unchanged. No inherited oracle-edit exception extends here.
The independently authored new specification file becomes immutable after its RED qualification.

## Grounded design

### Source identities and actual materialization

- [`lower-data.ts:113–148`](../../../../../packages/compiler/src/machine/lower-data.ts) creates
  global machine objects with `bindingLabel("global", global.id)`.
  [`lower-control.ts:167–169`](../../../../../packages/compiler/src/machine/lower-control.ts)
  defines this as `global.` plus the stable binding identity. Reuse that constructor in the
  build adapter; do not reconstruct names from assembly presentation labels.
- The existing data producer can intentionally omit constant scalars or unreferenced unconstrained
  globals (`lower-data.ts:114–126`). Refactor this existing filtering to record the omitted
  binding keys alongside its data result, without changing the filtering decision.
  Thread that small readonly omission record through the complete lowering result, not through
  SFA requests or emitted data. The field may remain optional for existing synthetic callers;
  absence never proves that a missing materialized global is safe.
- For each original source global, join its machine ID to the actual final layout interval or
  its explicit producer-recorded omission. Zero-sized objects have no occupied bytes. A missing,
  duplicate or inconsistent mapping is a terminal compiler invariant failure, not disjointness.
  Exclude platform/compiler BSS, assets and SFA homes from the source-global projection.
- [`C64LayoutInterval`](../../../../../packages/compiler/src/layout/c64-layout.ts) has inclusive
  `end`; [`PlacedRange`](../../../../../packages/compiler/src/semantic/raw-write-kills.ts) has
  half-open `end`. Convert once as `{ start, end: end + 1 }`, checking object identity/size.
  Use `shared.layout` after actual shared-storage closure, not its earlier draft.

### Reuse semantic proof without reopening storage

- Extend `resolveTargetSets` with an optional final-global-range context of the existing
  `ReadonlyMap<string, PlacedRange>` shape. Existing callers retain their current behavior.
  Feed the supplied ranges through the existing interprocedural kills and read-poisoning path
  (`function-targets.ts:685–715`).
- Keep source placement/eligibility flags unchanged. In particular, do not turn automatic globals
  into explicit source placement or lose helper definite-assignment guarantees.
  Validate against the original checked-source semantic program, not backend-added placement flags.
- Add a focused semantic diagnostic helper using the existing target resolution and reachable-call/
  initializer diagnostic traversal. Do not rerun all of `closeWholeProgram`, invent call edges,
  change the live storage certificate, or replace the already-lowered target map.
- Match each relevant call to its original semantic identity and require final coverage within its
  previously closed targets. Preserve target capture before argument evaluation. Reuse the
  canonical E10277 formatter rather than duplicate a divergent message.
- Carry only the diagnostic context necessary to explain the affected call, declaration and
  intervening write. Do not build a general causal-event or evidence framework.
- Keep most new logic in focused modules, rather than enlarging the existing large service and
  target-analysis functions. Add no public package export or frontend-to-backend import edge.

### Every admission/fallback uses its own final layout

Apply the same adapter at the current real admission seams:

| Existing path | Required handling |
| --- | --- |
| Generic canonical reference | Retain exact proof diagnostics independently of geometric/resource feasibility; an invalid reference cannot become a fallback. |
| Optional `none` object construction (`services.ts:371–405`) | Reject the unsafe optional representation and retain the valid generic canonical representation. |
| Optimized candidate admission (`services.ts:438–453`) | Exclude a proof-invalid candidate with a semantic reason before it enters the feasible-cost set. Do not label it as capacity rejection. |
| Exact canonical fallback (`services.ts:478–507`) | Require the same final proof; preserve existing observer checks and exact canonical identity. |
| Final selection (`services.ts:599–605`) | Assert validation of that exact selected source/layout tuple before serialization, tool discovery, staging or publication. |

Retain E10277 if semantic invalidity is the reason no representation can publish. Other independent
resource/observer failures keep their existing categories and precedence; source proof failure must
not become generic “size cost selection” failure.
Keep geometric feasibility separate from the callable-proof verdict, retaining the exact proof
diagnostics while other existing constructions are considered. Candidate evidence uses the existing
`semantics` rejection family (`costs-evidence-validator.ts:85–100`); no evidence-schema addition is
needed. A missing/corrupt mapping remains a terminal compiler invariant error, not that semantic
candidate rejection. The exact source/layout tuple and its verdict travel through the existing
construction record; do not create a separate proof registry or silently reuse another tuple's result.

Use existing cheap facts to avoid unnecessary target reanalysis when there are no relevant callable
globals or writes. Measure any repeated-analysis cost across the existing candidate frontier.
Do not add a new cache or benchmark framework to hide that cost.

### Design challenge

Independent challenge `ses_e0cdd7ec9ffejiK2oBWBoe56Aj`, Astra/xhigh, recommended this
diagnostic-only adapter over changing placement policy. Its strongest counterargument is that
automatic relocation can preserve compilation when a chosen layout collides; that remains a viable
later improvement, not a condition for stopping invalid publication now.

The challenge classified the bounded parameter/projection/diagnostic/admission work as **not a
material complexity escalation**. The previously missing producer confirmation is now grounded
above: exact binding-ID construction and existing omission rules were read directly.
The omission record carries an existing producer decision; it is not a new registry or allocator.
Any larger mechanism requires a fresh complexity stop and explicit approval.
Confidence: high in this seam; implementation and measured host cost are not yet verified.

## Specification-first evidence

Assign only `test/rd04/automatic-callable-placement.spec.test.ts` to an independent specification
author. Provide the approved requirements here, governing normative excerpts and public
`buildProject`/artifact interfaces—not compiler implementation or implementation tests.
Forbid reading semantic, machine, layout and service implementation files while authoring.
The execution owner, not the read-only reviewers, runs the real RED/GREEN commands.

| Case | Requirement-derived expectation |
| --- | --- |
| Confirmed bare global | Establish a candidate address through a reference build, change only the literal, then audit the candidate's own outcome: E10277 if its retained layout/proof is invalid; a success needs proved disjoint placement or legitimate storage elimination. The current accepted matching artifact must make the oracle meaningfully RED. |
| Disjoint control | The existing `$C100` case remains accepted; its actual range is disjoint. Preserve the baseline PRG/cost identity where inputs/mode match the diagnostic reference. |
| Byte boundaries / packed leaves | One-byte overlap, word crossing into the first callable byte and high-byte overlap lose proof; truly disjoint sibling writes retain it. Use actual final intervals and normative field offsets. |
| Source ordering | Write before assignment, write after the call, and complete typed reassignment before a later call retain the applicable proof. A possible unmatched write on a reaching branch does not. |
| Calls and initializers | Direct/transitive helper writes and ordered initializers use the same final range facts. Existing supported definite restoration stays supported; do not absorb separate #165 precision work. |
| Target capture | A target evaluated before an argument writes the global is preserved for that call. A subsequent call after that write has no stale target proof. |
| Representation selection | Across `none`, `balanced`, `speed`, `size`, invalid optional candidates cannot publish or displace a valid canonical fallback; an invalid canonical fallback cannot publish. No false capacity diagnostic. |
| Publication and diagnostics | Canonical E10277, primary call span and necessary causal notes; no new generation/current-pointer change on a failed build. Do not delete an earlier valid generation. |

Do not hardcode `$0A92` as a permanent layout. Distinguish final rejection, actual disjoint placement,
and producer-proved elimination; a missing interval alone is not a passing test.
If a public fixture cannot exercise a selection branch deterministically, report that limitation
and cover the real admission branch with a focused implementation test, not a skipped spec.

Initial RED must be an assertion exposing the old unsafe acceptance, not a missing import, missing
file, assembler failure or timeout. Record exact new-oracle hashes after RED; executors cannot edit
those files. Capture baseline accepted controls before changing production source.
New implementation tests then cover projection identity/endpoints/omission errors, subset checks,
reachable calls, semantic candidate rejection and exact fallback. Use existing test fixtures only.

## Small execution chunks

Run at most one numbered chunk per invocation and report its real state. An implementation chunk
may remain `[~]` across runs; do not claim GREEN or commit a tree with failing impacted tests.

- [ ] T-33.1 Independently author the assigned specification tests, run meaningful RED, bind oracle hashes and capture accepted-control baselines. No production code.
- [ ] T-33.2 Implement the bounded producer record, final-range projection, semantic adapter and all real admission/fallback hooks; run the independent specification tests GREEN without changing their oracles.
- [ ] T-33.3 Add focused implementation tests and harden ordering, mapping, target capture, subset closure and failure/publication behavior; verify no accepted target bytes or SFA demands were added.
- [ ] T-33.4 Run directed host/import-boundary coverage, all-mode/profile controls and affected sequential VICE acceptance cases using existing helpers and waits; record exact coverage and any still-unqualified domains.
- [ ] T-33.5 Obtain the applicable independent reviews below; record and resolve findings under user authority. No waiver, unapproved oracle edit or implicit issue close.
- [ ] T-33.6 Run the complete checkpoint once after install/build/typecheck, close the bounded unit with exact evidence/residual owners, synchronize the roadmap and commit GREEN locally through the git-commit skill. Never push automatically.

Do not commit the intentional RED stage or a partially GREEN implementation. Keep implementation
with one owner until the coherent reviewed checkpoint; leave accurate partial progress when paused.

## Verification

**Task verify:** T-33.1–3 explicitly run
`yarn vitest run --config vitest.integration.config.ts test/rd04/automatic-callable-placement.spec.test.ts`
with `yarn workspace @blend65/compiler build` first when production code changes.
T-33.2–3 also run `yarn typecheck` and `yarn test:fast`, plus touched-file formatting and directed
new implementation tests. Do not use `--passWithNoTests`; missing or unselected spec files block.
For T-33.1 the expected result is meaningful RED; no repair or release GREEN is claimed.

T-33.4 runs `yarn test:changed --host`, then explicitly:

- `yarn vitest run --config vitest.integration.config.ts test/rd04/automatic-callable-placement.spec.test.ts test/rd04/raw-write-callable-invalidation.spec.test.ts test/rd04/interprocedural-kill-cost.impl.test.ts`
- `yarn vitest run --config vitest.vice.config.ts test/rd04/callable-field-helper-vice.spec.test.ts`

The new integration test's control/matching matrix covers the nine selected manifest profiles
across all four optimization modes; ordering/precision cases may use the primary cooperative
profile, with actual coverage named in the result. The existing VICE acceptance file covers its
four cooperative profiles. Include the assigned new spec explicitly even if selection would omit it.
VICE is serialized; no concurrent `x64sc`. The complete gate retains all existing profile coverage;
no new emulator harness, helper or timeout change is needed for this compile-time check.

**Verify:** `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, then
`yarn test:full`, with targeted formatting and unchanged-authority/oracle guards.
Budget roughly 75–90 minutes for the complete gate using recent evidence; it is not an inner loop.
Diagnose any complete-gate failure before another full invocation. Isolated passes or increased
timeouts do not replace a required complete GREEN run.

Planning-only validation is targeted Markdown formatting, links, source-key/command checks,
checklist/roadmap consistency and unchanged source/test/frozen inputs—not the compiler corpus.
Run logs, manifests and scratch stay under `CODEOPS_TMPDIR`; remove owned temporary artifacts after
durable evidence capture. Never discard unrelated work or silently rewrite frozen expectations.

## Specialist Agents

| Role | Bounded responsibility at implementation review |
| --- | --- |
| correctness-reviewer | Phase scope, maintainability, oracle authority, exact finding dispositions and evidence limits |
| semantics-reviewer | Finite-target contract, ordering/restoration, diagnostics, ordinary source usability and pre-layout-check distinction |
| sfa-abi-auditor | No new call edges or homes after closure; globals remain outside SFA; captured-target lifetime |
| machine-code-auditor | Unchanged accepted target bytes/costs, no runtime descriptor or hidden code |
| target-platform-auditor | Actual C64 layout identity, inclusive/half-open mapping, selected profile/artifact/publication boundaries |
| performance-auditor | Concrete added host-analysis/frontier cost and fast-path behavior; no new benchmark system |

Specialist check: **None new**. Existing roles cover this exact semantic/layout/ABI/output boundary.
Use configured independent Astra reviewers and implementation-blind Sol spec author, explicit model
overrides and at most three concurrent children. Host input/path/tool-invocation code is not being
redesigned; no new security surface is planned. If that boundary changes, reassess rather than
silently expand scope.

## Scope of later implementation

Expected production edits: the named semantic target/diagnostic modules, data-lowering producer and
result types, focused build-adapter module, and existing build/admission service hooks. Owned tests:
the assigned new spec file and new/affected `*.impl.test.ts` only. Existing specification tests and
shared test infrastructure are read-only. Quality findings may use the plan's owned workflow ledger
when required; this planning run creates no such ledger.

No CLI flags, public package exports, frontend/backend graph expansion, specification change,
placement-policy change or gameplay/platform API is authorized. Stop if the smallest repair needs
one of these, another storage domain, material support machinery or an existing frozen-oracle edit.
#164 remains open outside what this bounded unit actually proves, and #168 remains separate.

Knowledge lineage: active qualified/frozen expert `2.0.4`, content
`0e2a6280ddf77e42252b7a50b85cf9ea3d732b15`; frozen Specification 4 identity
`BLEND65-SPEC-4-038b70e906c48ad9649793fce39602886fbbf21e3b0f9bdec3b7faaa63fd538b`.
References: `blend65-semantics.md#authority-and-use`,
`sfa-and-abi.md#storage-ownership-boundary`, `evidence-parity-and-recovery.md#transformation-proof`.

## Planning validation

Independent correctness review `ses_e0cc94375ffeXJaKcDORT22mr3`, Astra/high, returned **no
findings** in the mini-plan and T-33 roadmap row. It checked the bounded seam, tuple-specific
admission/fallback requirements, independent RED/freeze ordering, unqualified domains and
verification ownership against permitted source context. It did not independently authenticate
raw evidence, commands or a tool-level diff.

Targeted Markdown formatting, relative links, six unique unchecked tasks, known command/config
targets, exact new-file/roadmap-insertion scope and unchanged product/frozen inputs pass.
`yarn test:changed --host` selected documentation-only formatting and passed; it ran no compiler
or emulator tests. Owned validation scratch is cleaned. Portfolio synchronization remains deferred
off the integration branch.

Planning is complete; execution remains **0/6**. The assigned new spec file has not been written,
no implementation started and no product finding was waived. The local documentation checkpoint
records this plan; nothing is pushed. Execution requires a later user request.
