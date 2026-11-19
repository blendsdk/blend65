# Final global callable-proof repair (#164, bounded unit)

> **Type**: Task (lightweight) · **Feature**: blend65-v4 · **CodeOps Artifact Schema**: 1
> **Owner**: T-33 / #164
> **Progress**: 6/6 tasks (100%)
> **Status**: Done as engineering, awaiting the user's ruling on the review dispositions; #164 stays open for what this unit does not cover
> **Phase baseline tree**: `0a9ae8e4d89c6019eae81fcc8459ca703adfb840`
> **Baseline**: `acbc1c8c`, clean `feature/v4-rebuild`
> **Scope**: strict; automatic global storage and final build admission
> **Reasoning**: high — physical placement must preserve the call proof already consumed by SFA and lowering
> **Created**: 2026-11-19

## Objective and authority

Prevent publication of the [confirmed #164 output](../automatic-callable-placement-check/99-execution-plan.md#t-1644-classification-and-finding-gate):
a constant write changes an automatically placed global callable's bytes, but the compiler still
uses its earlier source-function target.

The user approved a separate bounded repair plan, **without waiver**, after that diagnosis.
The user requested execution on 2026-11-19. This invocation runs only T-33.1, not repair
implementation, issue closure, a frozen-language change or release approval.

**Planning target:** the diagnosed automatic-global proof boundary in `blend65-v4`.
**Context artifacts:** the diagnostic mini-plan; normative function, memory and diagnostic rules;
existing semantic target/kill analysis; data lowering, final layout and build admission.
**Planning modification set:** this mini-plan and the new T-33 feature-roadmap row.
**T-33.1 modification set (strict):** this mini-plan, only T-33's feature-roadmap row and the new
`test/rd04/automatic-callable-placement.spec.test.ts`. Existing tests/helpers and production code
remain read-only; intentional RED is not committed.

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

## T-33.3 implementation-test record

Two new files add 22 tests that need no filesystem, assembler or emulator:

| File | Covers |
| --- | --- |
| `packages/compiler/src/semantic/final-placement-proof.impl.test.ts` (13) | Both skip conditions, byte-exact overlap including the two endpoint cases, source order before and after the call, restoration by a complete typed assignment, the three sites a lost proof must name, and that the earlier target set is really found by the containment check |
| `packages/compiler/src/services/final-callable-proof.impl.test.ts` (9) | Inclusive-to-half-open conversion at a real layout, an inlined constant that was never materialized, all three producer disagreements, the canonical failure, and the optional representation's withdrawal with its partial facts kept |

The containment test exists because the earlier target set is looked up by operation identity; it
asserts the lookup returns the closed set rather than only that no widening was reported. The
withdrawal test closes the gap T-33.2 reported, since no public fixture can reach that branch.

Two corrections came out of this chunk. A withdrawn construction previously described itself as a
resource rejection, which understated a lost source proof; it now says the construction places
callable storage under a raw write. The rejection family it reports was already `semantics`.

### Accepted output is unchanged

The nine-profile, four-mode control matrix was re-run against the repaired compiler: **36/36
accepted with no diagnostics**. The anchor payload is still 659 bytes with SHA-256
`a4364e5135963aeb192abfb88cb6c320d3c54c0a32126ec5299b6c93d2b0a717`, byte-identical to the baseline
captured before any source change, and the cost vector is unchanged at 657 program bytes, 711
resident RAM, 2 hardware-stack bytes and zero zero-page or scratch. No storage demand was added.

## T-33.4 directed coverage record

All runs below are on the tree after the review repairs.

| Command | Coverage | Result |
| --- | --- | --- |
| `yarn vitest run --config vitest.integration.config.ts test/rd04/automatic-callable-placement.spec.test.ts test/rd04/raw-write-callable-invalidation.spec.test.ts test/rd04/interprocedural-kill-cost.impl.test.ts` | The new oracle across nine profiles × four modes, plus the existing raw-write invalidation suite over its four cooperative profiles and the interprocedural cost checks | **113 passed** |
| `yarn vitest run --config vitest.vice.config.ts test/rd04/callable-field-helper-vice.spec.test.ts` | Real emulator, serialized, four cooperative profiles | **4 passed** |
| Nine-profile, four-mode control matrix | Accepted output identity | **36/36**, payload digest unchanged |

The emulator case proves that a program whose callable storage is genuinely untouched still calls
the right function at runtime, so the new rejection did not become an over-rejection in practice.

Provenance, stated exactly: these two runs predate the cost repairs recorded below, which landed
afterwards. They are not re-stated as final-tree evidence on their own. The complete gate in T-33.6
re-covered both the host and emulator tiers on the final tree, and that run is what the coverage
claim rests on.

`yarn test:changed --host` was started against the earlier tree and reported 1,282 fast, 497
semantic, 985 service and 60 oracle tests passing before it was stopped part-way through the host
tier, once the review repairs had superseded the tree it was testing. It is **not** counted as
evidence here; the complete gate in T-33.6 covers the same ground on the final tree.

Still unqualified by this unit, unchanged from the plan: callable values in function-local storage,
interference between an interrupt handler and the main program over callable bytes, automatic
relocation instead of rejection, and physical hardware.

## T-33.5 review record

Three reviews returned first. Every finding was inside this unit's own new code, so each was
repaired rather than waived; nothing needed a specification, oracle or placement-policy change.

| Finding | Severity | Disposition |
| --- | --- | --- |
| SM-001 — the error never named the address that made it true, so the author could not act on it | MAJOR | Fixed. The write note now reads "replaces the callable bytes placed at $xxxx–$xxxx here". |
| MC-002 — a lost proof in the stack-preference alternative, which was never going to be published, failed the whole build | MAJOR | Fixed at that call site: this outcome now drops the preference and keeps the original construction, which is proved on its own. |
| SM-002 — cause notes were filtered by a root the call may not name, which could leave no write note at all | MINOR | Fixed. When the filter matches nothing, every covering write is shown. |
| RV-001 — a parameter comment claimed a handler proof the function does not perform | MINOR | Fixed. The comment now says handler sinks keep their earlier proof and why. |
| RV-002 / MC-003 — blocks and definitions were walked twice, and cause collection ran on the accepted path | MINOR | Fixed. Each body is prepared once and the cause data is derived only on the first failure. |
| RV-003 — a global absent from the producer's data but present in the layout was read as "no storage" | MINOR | Fixed. That direction is now a producer disagreement too. |
| MC-001 — a zero-size global could raise a false producer disagreement and fail the build | MINOR | Fixed by skipping zero-size globals before the interval lookup, which also settles the reviewer's open question about declaring one. |
| RV-004 — the pre-serialization re-check still has no executing test | MINOR | Record corrected rather than tested; see below. |

The cost review found the first version far too expensive, and one of its findings was also a
correctness exposure.

| Finding | Severity | Disposition |
| --- | --- | --- |
| PE-001 — every materialized global was handed to an analysis that treats neighbouring storage as aliasing, making it quadratic in global count and, past 256 adjacent globals, collapsing into a blanket rejection of every indirect call | MAJOR | Fixed. Only globals whose type can hold a callable value are passed, which restores the sparse map the earlier closure already used and removes the exposure. |
| PE-002 — the skip asked whether a program writes raw memory at all, which on this machine is nearly always true, so the re-proof ran up to 44 times per build | MAJOR | Fixed. The skip now asks whether a write can actually reach one of those callable ranges; a write to a hardware register or to a typed place no longer forces the work, and a write the analysis cannot read still counts. |
| PE-003 — value definitions were built for every body before anything needed them | MINOR | Fixed. Each body builds them on first use. |
| PE-004 — the cheapest check expanded one entry per array element to answer a yes-or-no question | MINOR | Fixed by using the path form that does not expand elements. |
| PE-005 — the guard before serialization repeats a proof the same pair already passed | MINOR | Kept deliberately as a last guard, now cheap for ordinary programs after the two fixes above. Recorded rather than removed. |
| Stale comment claiming at most 36 construction recipes | MINOR | Corrected to 42. |

The narrowing in PE-001 is worth stating plainly: a typed write that runs past the end of its own
object into a neighbouring callable global is not caught. That was equally true before this unit,
so it is not a regression, and it is not the condition #164 describes.

The storage and calling-convention review confirmed the parts that matter most — nothing is added
after storage closes, the projection stays on module-level globals, the containment guard is sound
and not vacuous, and a target captured before a corrupting argument keeps its proof. It raised two
MAJOR findings by static reasoning, both about rejecting legal source. Each was given its own
decisive probe on this tree, and **neither reproduces**:

| Finding | Probe | Result |
| --- | --- | --- |
| SF-002 — enough adjacent globals would form one long alias chain, collapse into a blanket unknown and refuse every indirect call | 300 module variables holding function values, one raw write, one call through the first | **Builds, no diagnostics** |
| SF-003 — a raw write inside a never-called function would poison a reachable call | First the plain shape, then the reviewer's exact shape: a never-called function writes over the chosen bytes and then calls the helper that performs the call | **Both build, no diagnostics** |

SF-002 was written against the first version, which handed every materialized global to the
analysis; the cost repair above already removed that condition, which is why the chain never forms.
SF-003's channel is closed because an unreachable function contributes no kills to a reachable one.

SF-001 (MINOR) notes that cause collection reads constant addresses only, so a write through a
typed place would not be named. Left as is, with reasoning rather than silence: supplying chosen
addresses can only add kills through a constant write that lands on callable bytes, because a
write through a typed place projects only onto storage its own bytes overlap, and callable globals
do not overlap each other. Every failure this check introduces therefore has a constant write to
name, and the fallback added for SM-002 prevents an empty note list in any case.

The deviation recorded in T-33.2 was reviewed: treating the data producer's own emitted output as
the record of what exists was judged an acceptable simplification, because it is that producer's
filter output and cannot drift from it. The reviewer's condition was the missing opposite
direction, which RV-003 now covers.

The pre-serialization re-check remains hooked but unexercised, and deliberately so: every path that
reaches it has already proved the same pair, so no fixture can present it with an invalid one. It
stays as a last guard against a future selection change. The earlier T-33.2 note that T-33.3 would
reach all three previously unexercised hooks was too optimistic; it reached two.

A semantics reviewer point worth carrying forward: this makes a correct rejection depend on an
address the compiler chose, so the same source can build in one optimization mode and not another.
Moving the automatic variable out of the way instead of rejecting is the better long-term answer
and remains open work on #164, outside this unit.

## T-33.6 complete checkpoint

Ran once on the final tree: `yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`,
`yarn test:full`.

| Stage | Result |
| --- | --- |
| Install | Already up to date, lockfile unchanged |
| Build | 4/4 workspace tasks |
| Typecheck | 7/7 tasks |
| Workspace package tests | compiler 4,322 passed with 2 existing skips; CLI 70; language server 21; extension 18 |
| Root host tier | 252 files, **5,290 passed** |
| Root emulator tier | 133 files, **2,402 passed**, 4 existing skips, 1 failed |

The single failure is the known VIC sprite-collision latch case under full-suite load, in
`test/rd05/vic-collision-vice.spec.test.ts`. It reads a collision mask through the emulator and has
no callable value, function pointer or raw write over callable storage anywhere in it, so this unit
cannot reach it. Re-run alone on the serialized emulator configuration it passes **16/16**, which is
the same behaviour this case showed at the previous checkpoint. It is a pre-existing timing
sensitivity under load, not a regression, and nothing about it is waived here.

## Open for the user's ruling

Every review decision below was taken by repair or by evidence, never by waiving anything. Under
this project's quality policy those dispositions still need the user's ratification, which has not
been given. Until it is, this unit is complete as engineering and provisional as governance.

| Item | Disposition taken | What ratification means |
| --- | --- | --- |
| Using the data producer's own emitted output as the record of what exists, instead of the separate omission record this plan described | Accepted, with the opposite-direction check added | Accept the deviation, or ask for the original form |
| SM-001 and MC-002, both MAJOR | Repaired in this unit's own code and re-verified | Accept the repairs |
| SF-002 and SF-003, both MAJOR and both inferred rather than run | Refuted by their own probes; no code change | Accept the refutations, or ask for more probing |
| PE-001 and PE-002, both MAJOR | Repaired; PE-001 also narrowed what the check sees, as recorded above | Accept the repairs and that narrowing |
| PE-005, the repeated guard before serialization | Kept deliberately | Accept keeping it, or have it removed |
| The complete gate is not literally all green | The one failure is the known collision-latch case, which passes 16/16 alone, as at the previous checkpoint | Accept that disposition as at T-30, or order one more complete gate |

The frozen oracle was verified against the commit itself: `git show HEAD:` on
`test/rd04/automatic-callable-placement.spec.test.ts` hashes to
`bfe38c994367c8b262fa6bb44af5cab243f553b0401cf9282a6b0382b8bff611`, the value frozen at RED.

## Small execution chunks

Run at most one numbered chunk per invocation and report its real state. An implementation chunk
may remain `[~]` across runs; do not claim GREEN or commit a tree with failing impacted tests.

- [x] T-33.1 Independently author the assigned specification tests, run meaningful RED, bind oracle hashes and capture accepted-control baselines. No production code. Verified 2026-11-19: 60 cases authored blind; the actual run is 49 failed / 11 passed, every failure on the same behavior assertion; oracle hash frozen; accepted-control matrix 36/36. The independent oracle review stays with the other reviews in T-33.5.
- [x] T-33.2 Implement the bounded producer record, final-range projection, semantic adapter and all real admission/fallback hooks; run the independent specification tests GREEN without changing their oracles. Verified 2026-11-19: the frozen oracle is 60/60 with its hash unchanged; build, `yarn typecheck` and `yarn test:fast` are clean; the six closest existing callable suites stay at 239/239.
- [x] T-33.3 Add focused implementation tests and harden ordering, mapping, target capture, subset closure and failure/publication behavior; verify no accepted target bytes or SFA demands were added. Verified 2026-11-19: 22 new implementation tests pass, including the candidate withdrawal the oracle cannot reach; the control PRG stays byte-identical to its pre-change digest with unchanged costs.
- [x] T-33.4 Run directed host/import-boundary coverage, all-mode/profile controls and affected sequential VICE acceptance cases using existing helpers and waits; record exact coverage and any still-unqualified domains. Verified 2026-11-19: directed integration 113/113, serialized emulator 4/4 on the cooperative profiles, control matrix 36/36 with an unchanged payload digest.
- [x] T-33.5 Obtain the applicable independent reviews below; record and resolve findings under user authority. No waiver, unapproved oracle edit or implicit issue close. Verified 2026-11-19: five independent reviews; every actionable finding repaired inside this unit's own code, the two inferred MAJOR regressions refuted by their own probes, and the remaining item recorded with reasoning. Nothing waived.
- [x] T-33.6 Run the complete checkpoint once after install/build/typecheck, close the bounded unit with exact evidence/residual owners, synchronize the roadmap and commit GREEN locally through the git-commit skill. Never push automatically. Verified 2026-11-19: install, build and typecheck clean; host tier 5,290 passed; emulator tier 2,402 passed with the one known collision-latch case, which passes 16/16 alone. Committed locally; nothing pushed.

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

Planning completed at `d66be6e2`. Execution was requested on 2026-11-19 and remains **0/6**
until the first chunk's evidence is complete. No product finding is waived.

## T-33.1 execution record

Entry checks: the current-schema mini-plan is the complete lightweight plan. There is no open
material ambiguity or unresolved plan-review finding. The known MAJOR #164 product defect is the
explicitly authorized repair target, not an accepted risk. Specification-first ordering and the
one-chunk limit remain mandatory.

Baseline: `d66be6e20c4c2f25cc93d1091e35901051d65b20`, clean `feature/v4-rebuild`;
phase tree `0a9ae8e4d89c6019eae81fcc8459ca703adfb840`.
The independent author receives approved behavior requirements, normative rules and public
build/artifact interfaces, not this plan's implementation design or production source.
Parent owns all actual command execution and accepted-control capture.

### Accepted-control baselines

Thirty-six uncached builds of the disjoint reference source, nine selected profiles × four modes,
all succeeded with no diagnostics. Every build reports the same two-byte automatic interval for the
module-level callable and the same costs: 657 program bytes, 711 resident RAM, 2 hardware-stack
bytes, 0 zero page and 0 scratch. The eight PRG profiles publish `.prg` payloads; the selected D64
profile publishes a 174,848-byte disk image, so its baseline is the image digest rather than a PRG
digest. The PAL/KERNAL/6581 `none` payload reproduces the earlier recorded digest
`a4364e5135963aeb192abfb88cb6c320d3c54c0a32126ec5299b6c93d2b0a717` exactly. Per-profile digests
stay in this run's owned scratch; they are reproducible from the same inputs on demand.

### Specification run and oracle freeze

Actual command:
`yarn vitest run --config vitest.integration.config.ts test/rd04/automatic-callable-placement.spec.test.ts`.
Result: **49 failed, 11 passed, 60 total**, 47.13 s.

Every failure is the same behavior assertion — the published representation is accepted while the
constant write still covers that same representation's own callable bytes. None is an import,
missing-file, assembler or timeout failure, so the RED is meaningful rather than incidental.
The eleven passing cases are the intended already-correct controls: disjoint sibling bytes, a word
ending exactly at the callable, a following sibling starting at the endpoint (each on both packed
roots), a write before the assignment, a write after the last call, complete typed reassignment,
captured-target evaluation order and left-to-right argument effects. They must keep passing after
the repair.

The reporter printed only ten of the eleven passes; the write-before-assignment control was dropped
from its rendered list. A separate filtered run confirmed that case executes and passes rather than
being skipped, so no pass is unexplained and none is vacuous — each asserts a successful build whose
final callable bytes are genuinely untouched.

The root test tree is outside `yarn typecheck`, which covers the four workspace packages only, so
freezing this file cannot introduce a later package typecheck failure.

Frozen oracle: `test/rd04/automatic-callable-placement.spec.test.ts`, 462 lines, SHA-256
`bfe38c994367c8b262fa6bb44af5cab243f553b0401cf9282a6b0382b8bff611` after formatting.
Later chunks may not edit this file without exact user approval. It carries no planning identifiers
or artifact paths in its comments.

The author disclosed two reads beyond its assigned excerpt scope: the shared profile/library test
helper bodies and the small public entry-point forwarding body. Neither contains callable target
analysis, final placement logic or expected verdicts, so oracle independence is intact; the
disclosure is recorded rather than dismissed.

Limits: public fixtures cannot force internal candidate and fallback branches, and cannot prove
runtime execution counts. Those remain T-33.3 implementation tests and T-33.4 emulator coverage.
This run changed no production source and no existing test. The failing tree is deliberately
uncommitted.

## T-33.2 implementation record

### What changed

| File | Change |
| --- | --- |
| `packages/compiler/src/semantic/function-targets.ts` | `resolveTargetSets` takes an optional map of absolute global intervals and merges it into the placement facts the existing kill analysis already consumes. Callers without a layout are unchanged. |
| `packages/compiler/src/semantic/whole-program.ts` | `CallEdge` and `unresolvedCallDiagnostic` are exported, and the diagnostic accepts further cause notes. With no causes its output is byte-identical to before. |
| `packages/compiler/src/semantic/final-placement-proof.ts` (new) | Re-proves reachable calls against chosen addresses, rejects any widening of a closed target set as a producer fault, and attaches the storage declaration and the covering write to each error. |
| `packages/compiler/src/services/final-callable-proof.ts` (new) | Joins each source global to the interval the layout gave it, converting the layout's inclusive end to the analysis's half-open end. |
| `packages/compiler/src/services/size-selection.ts` | `closeCanonicalReference` runs the check once a real layout exists. A `semantics` stage carries an optional representation's withdrawal; the canonical representation fails the build instead. |
| `packages/compiler/src/services/services.ts` | The exact selected representation is checked again immediately before serialization. |

No lowering decision, placement policy, instruction selection or cost changed, so an accepted
program keeps the bytes it had. No public package export, CLI flag or specification text changed.

### Design points worth keeping in view

The projection treats data lowering's own output as the record of what exists: a global that
producer did not materialize has no storage to overwrite, while one it did materialize must be
placed exactly once at its declared size. Any other combination is reported as a producer
disagreement rather than silently read as "no overlap".

Supplying addresses can only remove target candidates, never add them, so the check needs no
second allocation pass. It also skips immediately when a program has no stored callable, no
materialized intervals or no raw memory write at all, because none of those programs can be
affected by the addresses chosen.

### Verification

| Command | Result |
| --- | --- |
| `yarn workspace @blend65/compiler build` | Clean |
| `yarn typecheck` | 7/7 tasks successful |
| `yarn vitest run --config vitest.integration.config.ts test/rd04/automatic-callable-placement.spec.test.ts` | **60 passed, 0 failed** |
| `yarn test:fast` | 178 files / 2,811 passed with 2 existing skips, then 45 files / 1,282 passed |
| `yarn prettier --check` on the six touched files | Clean |

The frozen oracle is unchanged: `test/rd04/automatic-callable-placement.spec.test.ts` still hashes
to `bfe38c994367c8b262fa6bb44af5cab243f553b0401cf9282a6b0382b8bff611` and remains untracked, so the
green result comes from the compiler rather than from an edited expectation.

One oracle expectation drove a second iteration: a callable packed inside a struct or array names
its field declaration, which does not point at the stored root. The implementation now also shows
the declaration of the storage that actually holds the value.

### What this chunk does not yet show

Three hooks exist in code but recorded **zero executions** in every run above: the optional
representation's `semantics` withdrawal, the re-check immediately before serialization, and both
producer-disagreement arms. The oracle cannot reach them, because in optimized modes the canonical
representation fails first and no public fixture can force a candidate or fallback branch. Read
"every publication path is hooked" as exactly that, not as "every path is exercised"; T-33.3 owns
the tests that reach them.

The producer evidence was obtained differently from the plan's wording. The plan proposed adding an
omission record to data lowering; the implementation instead treats membership in that producer's
own emitted data as the record, which needs no change to the producer and cannot drift from it.
This is a **design deviation and needs a T-33.5 ruling**, not a delivered plan detail.

Two follow-ups are queued for T-33.3 rather than changed now: a withdrawn candidate's reason text
still reads as a resource rejection, which understates a lost source proof in candidate evidence;
and the widening check looks its earlier target set up by operation identity, so its test must
assert that the lookup actually hits rather than only that no widening was reported.

As an early regression check, the six closest existing callable suites were re-run together and
stayed at 239/239: raw-write invalidation, its interprocedural form, callable-field helper
transfer, constant-index recovery, bounded local index and the canonical diagnostic records. The
seventh related file, `test/rd05/callable-helper-assignment.spec.test.ts`, belongs to the emulator
tier and was correctly not selected here. Full-suite and emulator coverage remain T-33.4 and are
not claimed by this chunk.

Author `ses_e0c505687ffeuAf4nE0bpQYMNf`, Sol/high: an external coding-standards read was denied
by its native permissions. No retry or bypass was attempted. The parent supplied the already
read applicable standards/routing excerpts through the charter's excerpt path.
The author also disclosed that a permitted source-library helper read returned bodies beyond the
profile/signature excerpt scope. No compiler implementation or callable verdict was exposed;
those bodies are not semantic authority, and the author was instructed not to use or reread them.
This limited packet overread is disclosed, not silently treated as a fully exact allowlist read.

Reference pre-repair public build: success, diagnostics `[]`, callback CPU16 `[$0A92,$0A94)`,
659 PRG bytes, SHA-256
`a4364e5135963aeb192abfb88cb6c320d3c54c0a32126ec5299b6c93d2b0a717`.
It reproduces the earlier diagnostic control without a cache wrapper.
### Accepted-control baseline

**36/36 uncached public builds accepted**, diagnostics `[]`: each of the nine selected profiles
with `none`, `balanced`, `speed` and `size`. Source is exactly the diagnostic reference above,
SHA-256 `0cf2182bb0160192388a1cc86e0b818501dbc37852ccbba02f32945fe17b0b32`.
Manifest recipe is the diagnostic reference's ordered fields and two-space/trailing-newline
format, replacing `target` and `optimization` for each cell. The eight PRG profiles retain
`name: "callable-reference"`; D64 uses `name: "callable-ref"` within its 16-byte disk-name limit.
All other inputs remain unchanged.

| Profile group, each in all four modes | Cells | Callable CPU16 interval | File bytes / program bytes | Resident / ZP / scratch / reported stack |
| --- | --- | --- | --- | --- |
| `c64-{pal,ntsc}-prg-kernal-{6581,8580}` | 16 | `[$0A92,$0A94)` | 659 / 657 | 711 / 0 / 0 / 2 |
| `c64-{pal,ntsc}-prg-takeover-{6581,8580}` | 16 | `[$094B,$094D)` | 332 / 330 | 343 / 0 / 0 / 9 |
| `c64-pal-d64-kernal-6581` | 4 | `[$0A92,$0A94)` | 174848 disk image / 657 | 711 / 0 / 0 / 2 |

PRG SHA-256 is identical across every mode/profile within each PRG group:

- Cooperative: `a4364e5135963aeb192abfb88cb6c320d3c54c0a32126ec5299b6c93d2b0a717`.
- Takeover: `c6364b6105672d284e27c8fb805335c452d3b3438b6bf1a5470e4c0eedabd94a`.

D64's `primaryArtifact` is `callable-ref.d64`, **not a PRG**. The observed disk-image digests
are mode-specific build records, not a claim of reproducible package metadata:

| Mode | D64 SHA-256 |
| --- | --- |
| `none` | `c572ec4e64b6e717de2f9456ddef5d91d6c83f6695aac6e546654e43946216b3` |
| `balanced` | `9e4e6e0df4bb8d2b614d7723b0898d43758c2b366d9d480fac5f645221f7e6a0` |
| `speed` | `0c6decfd40abef86892ff1f865ad283eab6f330455f2e613fd21e2ef562e1bdd` |
| `size` | `a83cc2221ce0f57cf08c7cd836b6c333781bee257b7650af9b0402cfead2b0f2` |

Two parent probe setup mistakes are excluded from RED: the first D64 attempt used a 17-byte name
and failed its disk-name limit; a supplemental payload probe assumed a standalone `.prg` file,
but the successful D64 generation contains only its disk image and sidecars. Neither is evidence
of callable rejection or an implemented repair. No repeated full-suite run or product change
followed. No emulator or hardware execution ran; reported costs are build evidence only.

Specification authoring: 60 tests in the sole assigned file, 466 pre-format lines.
The author also disclosed seeing the small `loadProject` forwarding body in its permitted public
index read; no callable implementation or existing callable verdicts were read. This adds a
second bounded interface overread, not a semantic expectation source. Independent oracle review
will assess the stated blindness boundary. Public fixtures cannot force every internal optional
candidate/fallback branch or prove runtime exactly-once behavior; those remain later-task evidence.
RED qualification, review and oracle freeze are pending.
