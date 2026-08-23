# Execution Plan: RD-04 Tiered Compiler, ACME and VICE Execution

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-08-23
> **Progress**: 71/88 tasks (81%)
> **Commit Mode**: Auto-commit at verified local checkpoints; never push
> **Design Mode**: Auto-design within the resolved ambiguity register
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-04 in seven dependency-ordered phases. Every phase follows immutable specification
tests → observed RED → production implementation → GREEN → implementation tests → independent
quality review and full verification. Execution publication selection occurs only after local real
ACME/VICE evidence is accepted.

**🚨 Update this document after EACH completed task.**

## Implementation phases

| Phase | Title | Tasks |
|---|---|---:|
| 1 | Closed contracts, policy and route planning | 11 |
| 2 | Envelope, identity and diagnostic provenance | 12 |
| 3 | Real adapters and bounded lifecycle | 12 |
| 4 | Cancellable VICE control and durable lease | 13 |
| 5 | Runtime observation and local authority proof | 11 |
| 6 | Child execution publication and composite resolution | 12 |
| 7 | Campaign orchestration, selection and closeout | 17 |

**Total: 88 tasks across 7 phases**

> **Execution rule:**
>
> 1. Mark an implementation-started task `[~]` with a timestamp.
> 2. Promote only verified tasks to `[x]` with a completion timestamp.
> 3. Update Progress and Last Updated after every task; only `[x]` counts.
> 4. Resume the first `[~]`, otherwise the first `[ ]`, scanning top-to-bottom.
> 5. Preserve every authored specification test after its RED checkpoint. If implementation and
>    oracle disagree, use the runtime ambiguity protocol; never edit the spec oracle silently.

## Phase 1: Closed Contracts, Policy and Route Planning

> **Lenses**: compiler-semantics, api-surface, performance
> **Reference**: 03-01 · AR-P2, AR-P6, AR-P9 · ST-01–ST-10

- [x] 1.1.1 Create the behavior-free `@blend65/readiness-execution` package/test scaffold so its first immutable specification is discoverable; add no production source or readiness-core workspace import — verified 2026-08-22 02:38 CEST
- [x] 1.1.2 [spec-author] Write ST-01–ST-10 in new `packages/readiness-execution/src/execution-contracts-routing.spec.test.ts` from the declared interfaces only; do not open future implementation files — verified 2026-08-22 02:48 CEST; 13 assertions cover all 10 scenarios
- [x] 1.1.3 Run the Phase 1 specification suite and record RED caused only by absent contracts/planner — verified 2026-08-22 02:49 CEST; 13/13 RED at missing `./index.js`
- [x] 1.2.1 Connect the scaffold to the root TypeScript build, then add the exact documented passive execution tier, capability, composite-planning projection, stage, result, cleanup-blocker, policy and budget interfaces plus callable `parseExecutionContractsV1` and pure `reduceExecutionTerminalV1` seams in `packages/readiness/src/execution-contracts.ts`; use only canonical RD-compatible result codes — verified 2026-08-22 03:05 CEST
- [x] 1.2.2 Implement positive-safe-integer validation, inclusive canonical maxima, canonical serialization and readiness-owned genuine-campaign → serializable planning projection in focused readiness modules — verified 2026-08-22 03:05 CEST
- [x] 1.2.3 Implement strict serializable composite/campaign projection validation, cheapest-tier assignment and independent prerequisite/obligation expansion in `execution-route-planner.ts`; the route plan conveys no execution authority and exposes no adapter seam — verified 2026-08-22 03:05 CEST
- [x] 1.2.4 Implement domain-separated candidate ranking, lexical strata and round-robin selection in `execution-selector.ts` — verified 2026-08-22 03:05 CEST
- [x] 1.2.5 Implement mandatory per-runtime-rule VICE minima and fail-closed 16/256 capacity accounting — verified 2026-08-22 03:05 CEST
- [x] 1.2.6 Run ST-01–ST-10 GREEN; fix production implementation only — verified 2026-08-22 03:05 CEST; 13/13 specification assertions pass
- [x] 1.3.1 Add implementation tests for validation paths, canonical bytes, adversarial ordering, 10× population and budget/result precedence; prove ≥90% branch coverage for touched readiness cores — verified 2026-08-22 03:05 CEST; 22/22 implementation assertions pass; branch coverage 92.34% execution and 91.42% readiness core
- [x] 1.3.2 Run configured correctness/semantics/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit the green phase without pushing — verified 2026-08-22 04:04 CEST; all correctness, semantic and performance majors closed on re-review; immutable spec hash preserved; exact full gate green with 1,328 readiness tests, 26 readiness-execution tests and 33 root boundary tests

**Deliverable:** pure closed execution vocabulary and a byte-deterministic, capacity-safe plan for
every selected obligation before any external work.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 2: Envelope, Identity and Diagnostic Provenance

> **Lenses**: compiler-semantics, api-surface, compatibility
> **Reference**: 03-02, 03-04 · AR-P3, AR-P7, AR-P8 · ST-11–ST-22

- [x] 2.1.1 [spec-author] Write ST-11–ST-22 in new `execution-envelope-evidence.spec.test.ts`; derive only from requirements and planned interfaces — verified 2026-08-22 04:20 CEST; 12 scenarios; immutable SHA-256 `9a38885e2b13bf09010cec4d7ce61071c111917ff97caf61d7647cf0ba25c257`
- [x] 2.1.2 Run the Phase 2 suite and record RED caused only by absent envelope/evidence APIs — verified 2026-08-22 04:20 CEST; 12/12 RED only for 17 absent planned exports
- [x] 2.2.1 Add documented `ExecutionEnvelopeIrV1`, exact post-entry store sequence, argument, fixture, observation and layout contracts with closed validation — verified 2026-08-22 04:51 CEST
- [x] 2.2.2 Implement runtime-backed opaque `ExecutionCaseV1` construction from a genuine prepared campaign and ordinal, a readiness-owned guarded frozen passive-record projection accessor with fresh caller-owned source-byte copies for cross-package rendering, deterministic valid-only envelope rendering with actual stores and completion `0xA5` last, and historical structural replay resolution through its named campaign; reject structural forgery, copied/proxied handles, expectation leakage and invalid-case wrapping and prove copy mutation cannot affect registered state — verified 2026-08-22 04:51 CEST
- [x] 2.2.3 Implement the shared register-behavior table, `c64-vic-color-readback-v1` input projection and separate identity-bound `c64-vic-color-observation-v1` logical-write projection for `$D020..$D022` and little-endian words without changing RD-03 effects — verified 2026-08-22 04:51 CEST
- [x] 2.2.4 Implement canonical rendered-source validation, passive fixture-readback validation, pre-build and label-resolved execution identity preimages including canonical fixture-content digest and lexically sorted `{capabilityId, contractVersion, implementationRevision}` handler participants without changing source-case identity — verified 2026-08-22 04:51 CEST
- [x] 2.2.5 Extend compiler diagnostic-bag construction with accepted-entry identity, active real phase and final-severity sidecar while leaving ordinary diagnostics unchanged; add pure exact diagnostic and invalid-case emission classifiers — verified 2026-08-22 04:51 CEST
- [x] 2.2.6 Add an evidence compiler façade and optional same-invocation CLI façade/observer injection without altering default CLI output or exit behavior — verified 2026-08-22 04:51 CEST
- [x] 2.2.7 Implement genuine-case-bound label/report observation-layout proof across code/data, semantic footprint, stack, MMIO, result and completion ranges, retaining exact selected symbols and emitted completion-last store order in the final identity — verified 2026-08-22 04:51 CEST; strengthened during quality review under AR-P17
- [x] 2.2.8 Run ST-11–ST-22 GREEN; fix production implementation only — verified 2026-08-22 04:51 CEST; 12/12 immutable scenarios pass
- [x] 2.3.1 Add implementation/compatibility tests for bag dedup/caps, severity policy, renderer JSON, CLI output, identity collisions, stale sentinel and layout mutants; meet coverage floors — verified 2026-08-22 04:51 CEST; 90.40% execution branch coverage; core/compiler/CLI compatibility suites green
- [x] 2.3.2 Run configured semantics/correctness/compatibility review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing — verified 2026-08-22 06:11 CEST; all review majors closed on re-review; immutable spec preserved; 91.34% execution branch coverage; exact full gate green with 1,336 readiness, 53 execution, 409 test-harness and 33 root boundary tests

**Deliverable:** replayable valid programs with independent actual observation and directly observed
diagnostic phase, without public diagnostic or source-case compatibility changes.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 3: Real Adapters and Bounded Lifecycle

> **Lenses**: security, concurrency, performance, compatibility
> **Reference**: 03-04, 03-05 · AR-P2, AR-P3, AR-P9, AR-P10, AR-P18 · ST-23–ST-33

- [x] 3.1.1 [spec-author] Write ST-23–ST-33 in new `execution-adapters-safety.spec.test.ts` plus its immutable spec-owned genuine fixture using only the AR-P18 production contract kernel; freeze both hashes — verified 2026-08-22 after AR-P20/AR-P22–P31 corrections; 24 immutable scenarios; spec `b767bb7dd3405037f95107d817b7a1bc92dbefb6c116be26e57d465a83e61517`, fixture `3bba5811bec2dfd4ad3315bc081607272d58c28c1120da21ce9d55fd081f42f1`
- [x] 3.1.2 Run the Phase 3 suite and record RED caused only by absent adapters/supervisor — verified 2026-08-22; AR-P29 correction characterizes 18 passed / 6 RED: five solely on absent process-anchor kernel exports and one preserved output-exhaustion case exposing production accounting regression; every genuine fixture and raw kernel boundary executes
- [x] 3.2.1 Define the opaque published diagnostic-case authority and valid/invalid route union, prevent invalid cases satisfying emit/ACME/VICE obligations, then implement strict tier/case-kind structured-clone worker requests/evidence responses, parser and one all-tier start/completion/termination executor; production workers import the real facades while the parent alone owns expectations and terminal classification — baseline verified 2026-08-22 07:25 CEST; opaque dual-provenance authority and caller-campaign replay-input hardening completed under AR-P20/P23/P28
- [x] 3.2.2 Implement real frontend, compiler-API and CLI adapters with distinct contract evidence and strict later-artifact absence checks — verified 2026-08-22 07:25 CEST
- [x] 3.2.3 Implement real emit adapter and additive bounded ACME runner seam; distinguish discovery absence, invocation failure and missing artifacts — verified 2026-08-22 07:25 CEST; legacy ACME compatibility green
- [x] 3.2.4 Implement the production workspace-provider port plus canonical mode-0700 case workspaces, lexical path allowlist, pinned containment and regular-file revalidation — verified 2026-08-22 07:25 CEST
- [x] 3.2.5 Implement the production process/time ports, argv-only owned process groups, positive child-start identity and graceful/forced cleanup inside a fixed reserved grace; preserve the first operational result and attach mandatory cleanup blockers — verified 2026-08-22 07:25 CEST
- [x] 3.2.6 Implement continuously drained stdout/stderr with one monotonic aggregate selected limit, independent bounded head/tail/count/hash records and fixed stdout-then-stderr serialization; never impose per-stream failure budgets or authorize callback arrival order, and exclude every scheduler-dependent flood stream field from authority — verified 2026-08-22 07:25 CEST
- [x] 3.2.7 Implement the callable lazy 16 MiB evidence ledger and cumulative budget scope: hard/work deadlines with policy validation, the 15-second launch-attempt cap, reserved cleanup grace, stage limits, retries and per-child absolute stopwatch baselines under one cancellation scope — verified 2026-08-22 07:25 CEST
- [x] 3.2.8 Run ST-23–ST-33 GREEN; fix production implementation only — verified 2026-08-22 07:25 CEST; immutable 11/11 green
- [x] 3.3.1 Add process/worker/path/output/race implementation tests including all four tier-to-worker mappings, strict response mutants, explicit absence of parent-side real-facade calls, default API regressions and coverage floors; keep all scripted fakes and ownership probes test-local — verified 2026-08-22 07:25 CEST; 93 focused tests green; 90.28% branch coverage
- [x] 3.3.2 Run configured security/correctness/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing — verified 2026-08-22 14:22 CEST; final review found no criticals and 11 consolidated majors, all fixed; AR-P29–P31 introduced the persistent process-group anchor and raw bootstrap kernel; immutable 24/24 specification scenarios and 159/159 package tests pass at 90.18% branch coverage; exact full gate green with 1,339 readiness, 159 readiness-execution, 409 test-harness and 33 root boundary tests

**Deliverable:** real frontend-through-ACME routes whose synchronous work, filesystem, output and
process trees remain bounded and clean on every outcome.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 4: Cancellable VICE Control and Durable Lease

> **Lenses**: security, concurrency, compatibility, performance
> **Reference**: 03-06 · AR-P4, AR-P10, AR-P11, AR-P32, AR-P33 · ST-34–ST-43, ST-60–ST-62
> **Phase baseline tree**: b790f7ce67cfe7b5bba4480bd7d5f7b71f746b98
> **Scope mode**: strict
> **Expected modification set**: `packages/test-harness/src/emulator/vice/**`, additive test-harness
> exports/configuration needed for `@blend65/test-harness/vice-control`,
> `packages/readiness-execution/src/**`, readiness-execution package configuration, and RD-04
> plan/roadmap state

- [x] 4.1.1 [spec-author] Write the test-harness-owned low-level portions of ST-34–ST-35, ST-42–ST-43 in new `packages/test-harness/src/emulator/vice/vice-control.spec.test.ts`; forbid inspection of new control implementation files — verified 2026-08-22 14:47 CEST; 29 scenarios; immutable SHA-256 `c48953c2a1237ea03016a3ef185be4944c95ff4c413e02cecd3d32ebfffdaf2a` after AR-P34's semantics-neutral typed-array annotation; RED solely on absent `./vice-control.js`
- [x] 4.1.2 [spec-author] Write readiness-execution-owned aggregate ST-35, ST-36–ST-41, route-retry ST-42, ST-60–ST-62 and the lease/policy portion of ST-43 in new `packages/readiness-execution/src/execution-vice-lease.spec.test.ts`; forbid inspection of new lease/runtime implementation files — verified 2026-08-22 15:08 CEST after AR-P33 and the raw-wire packet; 35 scenarios; immutable SHA-256 `124fcdac4cfe681a58b17122cb37a81513f8efed25bdd5a33cfaaa45e4705897` after AR-P35–P37 corrected retained inode, POSIX directory-link and matching-STOPPED facts; RED solely on absent VICE execution runtime exports
- [x] 4.1.3 Run both Phase 4 specification suites and record RED caused only by absent owner-specific control and lease contracts — verified 2026-08-22 15:08 CEST; test-harness 0 collected at absent `./vice-control.js`; readiness-execution 32/32 RED at absent planned runtime exports; replacement control hash after AR-P34 and the lease hash are frozen
- [x] 4.2.1 Factor binary/text transports, validated `1..65535` instruction codec, AR-P32 raw host/runtime factory and composite owned-endpoint/C64/version handshake behind additive `@blend65/test-harness/vice-control` — verified 2026-08-22; immutable control suite 29/29 GREEN
- [x] 4.2.2 Refactor existing `ViceDriver` as a compatibility wrapper and prove all pre-existing emulator suites unchanged — verified 2026-08-22; full test-harness 451/451 GREEN and legacy real-VICE behavior preserved
- [x] 4.2.3 Implement the AR-P33 runtime factory and singleton facade, trusted host-wide effective-UID/target lease namespace, checksummed generation/nonce records, no-follow mode/owner/link/device/inode validation, atomic acquisition/fencing state transitions and runtime-backed single-active/single-use lease handles that reject forgery, foreign coordinators, concurrent mutation and reuse before launch — verified 2026-08-22
- [x] 4.2.4 Implement Linux boot ID and `/proc/<pid>/stat` start-time identity provider with fail-closed unsupported-host result — verified 2026-08-22
- [x] 4.2.5 Implement the feature-gated same-PID record-then-`process.execve` launcher, durable pre-exec child record and immediate pre-signal identity revalidation; unavailable runtime support must prevent spawn — verified 2026-08-22; real same-PID VICE route GREEN with clean process/lease teardown
- [x] 4.2.6 Implement fresh distinct loopback endpoints, at-most-eight route attempts, child liveness and the AR-P32 owned-endpoint dual-protocol C64/version handshake — verified 2026-08-22
- [x] 4.2.7 Implement cancellable monitor pending-command/checkpoint registry, exact completion STORE checkpoint/readback, full requested-chunk charging and per-child stopwatch baselines with route-cumulative instruction/cycle/wall behavior — verified 2026-08-22
- [x] 4.2.8 Run ST-34–ST-43 and ST-60–ST-62 GREEN; fix production implementation only — verified 2026-08-22; control 29/29 and lease 35/35 GREEN at frozen hashes
- [x] 4.3.1 Add launcher/lease lifecycle crash matrix, trusted-filesystem and PID-reuse/token/generation races, guarded inspect/exact-generation clear, process-tree, stopwatch and codec implementation tests with coverage floors — verified 2026-08-22; readiness-execution 274/274 GREEN; 92.23% statements/lines, 90.06% branches and 92.27% functions
- [x] 4.3.2 Run configured security/concurrency/correctness/performance review, resolve required findings, update plan/roadmap state, run full verification and auto-commit without pushing — verified 2026-08-22; correctness/concurrency RV-001–RV-016, security SA-001–SA-006 and performance PE-001–PE-005 resolved with all three closure reviews reporting no findings; exact repository verification GREEN (install, 10-package build/typecheck/lint, 297 readiness-execution tests, 461 test-harness tests and 33 root boundary tests); frozen spec hashes and `spec/` cleanliness confirmed

**Deliverable:** one reusable live-verified VICE control substrate and an exclusive Linux lease that
never signals an ambiguously identified process.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 5: Runtime Observation and Local Authority Proof

> **Lenses**: compiler-semantics, security, performance
> **Reference**: 03-02, 03-06 · AR-P7, AR-P8, AR-P9, AR-P38 · ST-44

- [x] 5.1.1 [spec-author] Write ST-44 in new `packages/readiness-execution/src/execution-runtime-acceptance.spec.test.ts` plus fixed source/oracle fixtures; do not inspect runtime adapter implementation — verified 2026-08-22; 10 immutable scenarios frozen at final SHA-256 `8ed1ab9c2d2df76704c302d5e4e13dce54a520677b15137c329a0b1b56176f32`; fixture SHA-256 `4cb63caa59df653be63f7d0222d327955153efbd7380929afead37d02f49ac33` after AR-P39–AR-P46 restored valid policy, projected read truth, VIC-aware fake readback, suite-scoped authority lifetime, single-release provenance, advance-triggered simultaneous timing and the independent canonical durable-child lifecycle
- [x] 5.1.2 Run the CI-safe portion RED for absent VICE runtime adapter and record the local-suite prerequisite — verified 2026-08-22; 10/10 RED solely on absent readiness runtime-evaluation authority and evaluated VICE runtime exports; local prerequisite remains ACME plus VICE 3.10 for the same four fixed cases, both word starts and STORE timing
- [x] 5.2.1 Implement VICE binary loading, fixture establishment/readback, entry setup, exact completion STORE checkpoint/readback and actual-byte/direct-MMIO observation through the versioned post-write projection — verified 2026-08-23; immutable ST-44 GREEN 10/10 and real four-case acceptance GREEN
- [x] 5.2.2 Implement full-chunk charging, per-child stopwatch deltas, exact completion/instruction/cycle/wall precedence and all-outcomes cancellation/cleanup integration — verified 2026-08-23; instruction-before-cycle-before-wall precedence, cancellation and private exact-child cleanup covered
- [x] 5.2.3 Join actual runtime observations to the selected RD-03 host evaluator without serializing expected values into source or producer evidence — verified 2026-08-23; genuine authority implementation 28/28 GREEN and hostile/replay inputs consume authority safely
- [x] 5.2.4 Run the CI-safe ST-44 contract GREEN with the fake control seam; fix production implementation only — verified 2026-08-23; frozen ST-44 SHA-256 unchanged at `8ed1ab9c2d2df76704c302d5e4e13dce54a520677b15137c329a0b1b56176f32`
- [x] 5.2.5 Add fake-monitor implementation tests for exact/mismatched checkpoint, committed readback, post-return mutation, wrong byte, stale/missing completion, fixture mismatch, restart baselines and simultaneous budgets — verified 2026-08-23; readiness-execution 348/348 GREEN at 90.02% branch coverage
- [x] 5.3.1 Run focused coverage, expert-6502 output review and configured semantics/security/performance/correctness review; resolve every code-changing finding and file any meet-only measured parity gap with its path to beat — verified 2026-08-23; semantics and performance reviewers report no findings after PE-001–PE-004 closure; correctness reviewer reports no findings after RV-001–RV-005 closure; readiness-execution 386/386 coverage tests GREEN at 90.00% branches; no meet-only parity gap remains
- [x] 5.3.2 Run exact full verification after review fixes and auto-commit the reviewed implementation without pushing — verified 2026-08-23; exact install/build/typecheck/lint/test gate GREEN after refreshing the reviewed Slice7/Slice7b generated artifacts; root boundary and scoreboard tiers 33/33 GREEN; local commit follows this plan transition without pushing
- [x] 5.3.3 Run all ST-44 cases GREEN through real ACME and VICE 3.10 for STORE-checkpoint timing, committed `$A5`, no post-return mutation, `$D020..$D022`, both word starts and one selected `peek`, `peekw`, `poke`, `pokew` case — verified 2026-08-23 after final AR-P55 bytes; repeated sealed runs GREEN for all four cases on ACME 0.97 and VICE 3.10 with stable build/result digests
- [x] 5.3.4 Freeze accepted local evidence digests/tool versions only after the reviewed real rerun; any participating semantic byte change invalidates and reopens this task — verified 2026-08-23 after final correctness closure and refrozen after Phase 6 changed the content-bound publication authority revision; two repeated real ACME 0.97 / VICE 3.10 runs preserve exact four-case source/binary/layout/build bytes, usage, observed bytes and completion STORE proofs while recording the new evaluation, route and result identities

**Deliverable:** bounded real C64 execution with authoritative input projection, completion-last
observation and locally accepted evidence for all four modeled runtime rules.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 6: Child Execution Publication and Composite Resolution

> **Lenses**: data-migration, concurrency, security, compatibility
> **Reference**: 03-03 · AR-P5, AR-P13, AR-P61–P62 · ST-45–ST-50, ST-55–ST-57, ST-63

- [x] 6.1.1 [spec-author] Write ST-45–ST-50, the readiness-owned portion of ST-55 and passive transaction/reconciliation portion of ST-57 in new `packages/readiness/src/execution-publication.spec.test.ts` plus independent wire fixture `test-fixtures/execution-publication-spec-fixture.ts` from passive publication/composite contracts only — verified and refrozen 2026-08-23; 17 scenarios; immutable test SHA-256 `0fb898f76ead5f2733eb620b573075a1f86360c5fdeb2580a4ef2cde7a6b9ca4`, fixture `36d0e0a41f207fe3a05739146b87e819b9b303a2937e83b85b715b2a4b2f8e01`; AR-P56–P57 closed the initial packet gap, AR-P58 corrected the raw-inventory rule expectation, AR-P59–P60 added bounded real authority, and AR-P62 refreshed only the exact parent digest; the final fixture correction normalizes Node buffers to the declared `Uint8Array` oracle type
- [x] 6.1.2 [spec-author] Write the readiness-execution-owned portion of ST-55, ST-56 and public live-gated select/old→new→old portion of ST-57 in new `packages/readiness-execution/src/execution-publication-catalog.spec.test.ts` plus independent fixture `test-fixtures/execution-publication-catalog-spec-fixture.ts` from the declared live-catalog interfaces only; never inspect readiness production or the other package's specification file — verified and refrozen 2026-08-23; immutable test SHA-256 `86523daf47ed7fed5e01a651611fb937419daaf140d424f13aad53f726b941e4`, fixture `7412bfb7b4cac99ecea5dafffc992dfbe26e2b8f5c71e9d6cab3f24b4d300c08`; final replacement adds only strict compatible-result/digest typing, bounded package-independent authority copying and the AR-P62 fresh parent digest, with assertions unchanged
- [x] 6.1.3 Run both Phase 6 specification files together and record RED caused only by absent child publication/resolver, source-boundary, generated-catalog and guarded-reselection APIs — verified and rerun after AR-P58 on 2026-08-23; readiness 15/17 RED solely absent planned public/conformance APIs with two negative guardrails green; readiness-execution module-load RED solely absent planned catalog conformance module; replacement frozen hashes confirmed
- [x] 6.2.1 Add strict manifest, parent-reference, exact-six-binding and semantic-review schemas for `execution-publication-v1`, plus a distinct exact path-family source-boundary owner set across both packages — verified 2026-08-23 10:44 CEST
- [x] 6.2.2 Generalize pinned/bounded publication filesystem primitives for the isolated execution-publications root without changing the historical publication-v1 owner set — verified 2026-08-23 10:44 CEST; historical publication filesystem and conformance owners remain byte-identical
- [x] 6.2.3 Implement passive child-byte validation in readiness and the fixed six-handler live catalog identified by lexically sorted capability/contract-version/implementation-revision participants plus parsed emitted-runtime dependency closures in readiness-execution; include the minimal readiness execution-runtime leaf, literal dynamic/worker/anchor/launcher and reached third-party executable/manifest edges, secure bounded descriptor scans and one unique scan/hash per dependency; reject the readiness root/TypeScript graph and forbid arbitrary registration, unresolved runtime edges, stale closure and current-handler fallback — verified 2026-08-23 10:44 CEST; generated closure binds 492 unique runtime files, 3,396,100 bytes and 13 third-party packages
- [x] 6.2.4 Implement review-unit reconstruction and require exact parent inventory revision plus accepted CI-safe, coverage and local ACME/VICE report digest before selection — verified 2026-08-23 10:44 CEST
- [x] 6.2.5 Implement runtime-backed opaque passive `PublishedExecutionRelease` and `CompositeReadinessSnapshot` resolution with canonical containment, complete ancestor pin/revalidation, guarded closed projection access, and separately runtime-backed live-context composition after fixed-catalog freshness proof; reject plain, copied and proxied authority objects — verified 2026-08-23 10:44 CEST
- [x] 6.2.6 Implement composite projection that clears exactly accepted child rows while preserving every other blocker and parent byte — verified 2026-08-23 10:44 CEST
- [x] 6.2.7 Implement bounded diagnostic inspect and readiness-execution-co-located live-gated select-by-digest with a final synchronous catalog/parent guard immediately invoking rename, bounded directory-durability retry, indeterminate reconciliation and historical named-release resolution including old→new→old; remove every exported raw commit path — verified 2026-08-23 10:44 CEST
- [x] 6.2.8 Run ST-45–ST-50, ST-55–ST-57 and ST-63 GREEN and prove old four-row/new nine-row parent fixtures remain byte-identical and resolvable — verified 2026-08-23 10:44 CEST; frozen readiness 17/17 and catalog 20/20 noncoverage specifications GREEN at exact hashes
- [x] 6.3.1 Add binding/catalog/freshness/source-boundary/publication/composite/fault/containment/durability implementation tests, run configured data/concurrency/security/performance review, resolve findings, meet focused new-core branch coverage at or above 90%, update state, run full noncoverage specs and full verify, and auto-commit without generating or selecting the real child pointer or pushing — verified 2026-08-23; all critical/major review findings closed including ambient worker preload authority; readiness focused core 97.14% branches and execution catalog cores 90.20%; after the expected content-bound Phase 5 identity invalidation, two real ACME/VICE reruns refroze reviewed authority identities and the exact full gate passed with 1,393 readiness tests, 428 readiness-execution tests and 33 root boundary tests

**Deliverable:** reviewed six-route child publication machinery with exact passive/live authority
handoff and atomic compatibility-safe selection; real candidate generation and selection remain
deferred to final campaign acceptance.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Phase 7: Campaign Orchestration, Selection and Closeout

> **Lenses**: compiler-semantics, security, concurrency, compatibility
> **Reference**: 03-07 · AR-P1, AR-P5, AR-P9, AR-P13 · ST-51–ST-54, ST-58–ST-59

- [ ] 7.1.1 [spec-author] Write ST-51–ST-54 and ST-58–ST-59 in new `packages/readiness-execution/src/execution-orchestration.spec.test.ts`; never reopen prior specifications
- [ ] 7.1.2 Run the Phase 7 suite and record RED caused only by absent campaign orchestrator/publication gate
- [ ] 7.2.1 Implement `executeReadinessCampaign` over opaque parent/execution/oracle contexts, recover the validated passive release from live-context private state, resolve and guard the composite projection, derive the campaign projection, pass the selected oracle digest, and require complete route-plan serialization before work
- [ ] 7.2.2 Implement canonical per-case results and per-rule/obligation summaries with unavailable and residual blockers preserved
- [ ] 7.2.3 Add exact `readiness:execute` root/local command grammar, closed exit taxonomy and canonical machine-neutral `ExecutionAuthorityReportV1` serializer with trusted atomic durable sink
- [ ] 7.2.4 Run ST-51–ST-54 and ST-58–ST-59 GREEN; fix production implementation only and preserve every prior specification
- [ ] 7.2.5 Add orchestration/blocker/CLI/report/atomic-fault implementation tests and run ST-01–ST-62 plus both 90% branch floors and source/boundary/publication checks
- [ ] 7.2.6 Run final configured correctness/semantics/security/performance review over every participating code byte and resolve all required findings before evidence freeze or publication generation
- [ ] 7.2.7 Run the exact full CI-safe repository verification after all review fixes
- [ ] 7.2.8 Rerun mandatory real ACME/VICE acceptance and atomically persist the canonical local authority report
- [ ] 7.2.9 Generate and freshness-check the six live-handler dependency closures from the reviewed final code bytes
- [ ] 7.2.10 Independently review the exact six route units and accepted report digest; record content-bound semantic/quality acceptance
- [ ] 7.2.11 Prepare the immutable child candidate from final bytes and resolve it without changing the selected pointer
- [ ] 7.2.12 Atomically select the six-binding child and prove exactly six blockers clear against the exact parent
- [ ] 7.2.13 Run only non-mutating post-selection source-boundary, freshness, named-resolution, old→new→old and fault-reconciliation checks; any code-changing fix reopens tasks 7.2.6–7.2.13
- [ ] 7.3.1 Perform deferral-expiry and expressiveness-ledger audit, keep `spec/` frozen, update RD/feature and portfolio roadmaps as applicable, and update opted-in technical docs
- [ ] 7.3.2 Run the final exact full verification without code changes and create the green local RD-04 closeout commit without pushing

**Deliverable:** all six routes selected as reviewed child authority, the selected modeled
population executed with independent results, residual blockers retained and RD-04 closed.

**Verify:** `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`

## Dependency graph

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

## Success criteria

1. All 88 tasks are verified and ST-01–ST-62 pass unchanged after their RED checkpoints.
2. The route plan is deterministic, obligation-complete and fixed before execution.
3. Every invalid case proves exact direct diagnostic provenance and absence of later artifacts.
4. Valid envelopes contain no expectation, complete their arguments and prove collision-free layout.
5. Current C64 memory semantics pass real ACME/VICE for all four modeled runtime rules.
6. Limits, output, workers, child trees, paths, lease and monitor commands remain bounded and clean.
7. Ambiguous process identity never signals a process and retains a recoverable blocked lease.
8. One reviewed child publication binds exactly six routes to the exact selected parent digest.
9. Historical parent/child releases remain byte-identical and independently resolvable.
10. Remaining population and unavailable-capability blockers cannot satisfy RD-06.
11. Both readiness cores retain at least 90% branch coverage and the exact repository gate passes.
12. `spec/` remains untouched, deferral-expiry ownership is recorded, checkpoints are committed and
    nothing is pushed.
