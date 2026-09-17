# Ambiguity Register: RD-02 Foundation Planning

> **Status**: ✅ GATE PASSED — all 10 items resolved; systematic review completed
> **Last Updated**: 2026-09-18
> **CodeOps Artifact Schema**: 1

## Planning Boundaries

| Boundary | Proposed scope |
|---|---|
| Planning target | `blend65-v4/RD-02` only: clean foundation and deterministic project loading, not a compiler pipeline. |
| Context artifacts | Phase 0 handoff; RD-01 closeout and frozen identities; v4 requirements and preflight report; inherited manifests, source, tests, scripts, workflows, documentation, and historical roadmaps as salvage evidence only. |
| Modification set | This RD-02 plan directory, required feature-roadmap lifecycle rows, and the approved correction to RD-02 AC-15 and its Paths verification-table row. No implementation, specification, active expert, parked-worktree, or sibling-RD changes. |

## Decisions

| ID | Category | Question | Recommendation | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Confirm the planning target and modification boundary. | Plan only RD-02 from its accepted requirements. Preserve the frozen spec and expert. Keep compiler, packaging, emulator, and future infrastructure work out. | User approved on 2026-09-17: "i do", in response to the foundation-only scope and narrow correction. | ✅ Resolved |
| AR-P2 | Scope / upstream correction | AC-15 requires output creation and artifact-publication tests despite the explicit exclusion of publication from RD-02. | Correct RD-02 only: validate missing contained `outDir` without creating it; test the pure basename validator and input containment here; leave native artifact creation, collision/alias, and publication proof with RD-03 and subsequent artifact-producing owners. Align the Paths verification-table row. Preserve R2.25 as a later-producer contract, not an RD-02 implementation task. | User explicitly approved on 2026-09-17: "i do". AC-15 and the Paths verification row corrected. | ✅ Resolved |
| AR-P3 | Technical / package ownership | What is the smallest useful foundation graph and salvage approach? | **Recommended:** `@blend65/compiler` owns project loading as internal modules; `@blend65/cli` consumes its public exports. Retain the existing `jsonc-parser` dependency. Inventory first; adapt only independently proven small discovery/UTF-8 conversion units; rewrite the changed manifest, identity, containment, snapshot, diagnostic registry, and CLI integration. No additional package or dependency. | Planning choice made under the user's AGENTS.md workflow directive 4: compiler/plan-owned decisions are made on the tagged recommendation without a prompt. Not a claimed per-item user acceptance or `--auto-design` invocation. | ✅ Resolved |
| AR-P4 | Technical / host safety and snapshot representation | How should the service remain bounded and immutable without persistent machinery? | **Recommended:** immutable UTF-8 text records, exact relative string source IDs, SHA-256 content hashes, separate host-only identities, and a bounded full-load/revalidation attempt. Fixed host-safety defaults: 1 MiB manifest, 4 MiB per source, 256 MiB total manifest/source bytes, 10,000 source files, 100,000 visited entries, depth 64, and at most three complete attempts. Test smaller limits through internal arguments, not new manifest keys. Any detected change discards the entire attempt. | Plan-owned choice under the same explicit project directive; R2.22 and the host-safety requirement supply the behavior boundary. No filesystem lock, watcher, cache, or public host abstraction. | ✅ Resolved |
| AR-P5 | Technical / public API and CLI integration | What truthful API and CLI shell should RD-02 expose? | **Recommended:** `loadProject(options)` returns success/snapshot/observations or failure/diagnostics; export the pure basename validator and byte-position conversion. `blendc` supports help/version and project loading only, with `--project`, `--target`, and `--entry`; no command means project load, not compile. Exit 0 for success/help/version, 1 for invalid project, 2 for invalid invocation. Stable project-host diagnostic identifiers remain separate from language codes; invalid profile uses normative E10279. | Plan-owned implementation of R2.12, R2.16, R2.20, R2.23, and R2.24 under project directive 4. No added compile/check/build/run capability. | ✅ Resolved |
| AR-P6 | Technical / verification and production hosts | Which commands and evidence determine green foundation checkpoints? | **Recommended:** retain the detected install/build/typecheck/test command roles, remove their lint/readiness/compiler ownership as required, and verify with `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`, plus targeted Prettier checks. Adapt the existing CI job to native Node 22 Linux x64 and Windows x64 runs, without ACME, VICE, scoreboard, remote cache, or new CI service. Windows simulation never substitutes for native evidence. | Detected root scripts and the user's impact-based verification directive, R2.27, and accepted requirements AR-048; project directives 1 and 4 authorize green checkpoints and plan-owned command selection without a further prompt. | ✅ Resolved |
| AR-P7 | Technical / execution decomposition | How is the foundation delivered without another large framework-first plan? | **Recommended:** three phases: green toolchain plus complete pure manifest/diagnostic behavior and rejected-surface removal; contained discovery/inventory/snapshot service; truthful CLI, native-host integration, focused qualification, and deferral closeout. Each phase uses spec tests/red, implementation/green, then internal tests/verification. Coherent outcome tasks, not a task per field or failure vector. | Plan-owned sequencing under project directive 4, within the user-confirmed RD-02 scope. | ✅ Resolved |
| AR-P8 | Technical (runtime) / private test signature and name result representation | Independent test author needs the boundary helper signature and exact `offending` value/escaping order. | **Recommended:** one private `inspectImportBoundary(root)` returning violation strings; raw offending input in the pure name result, fixed predicate priority and diagnostic Unicode/JSON escaping, as clarified in `03-01`/`03-02`. No new name predicate, public API, test framework, dependency or support layer. | Plan-owned technical clarification on 2026-09-17 under the user's overriding directive 4; not a claimed user vote or auto-design delegation. | ✅ Resolved |
| AR-P9 | Technical (runtime) / limit labels and observed disappearance | Independent Phase 2 author needs exact diagnostic limit names and classification of a previously resolved input disappearing before open. | **Recommended:** diagnostic limit names are the existing `ProjectLimits` property names. Disappearance after successful resolution/inventory is observed instability and discards the whole attempt; initial missing/unreadable required paths are direct typed host failures. | Plan-owned representation clarification on 2026-09-17 under the user's overriding directive 4. Existing bounded-read/retry contracts, not new behavior or machinery. | ✅ Resolved |
| AR-P10 | Technical (runtime) / host-classification oracle signature | Phase 3 author cannot exercise ST-37's synthetic runtime identities without a declared private signature. | **Recommended:** declare the already-existing private `hostObservations(nodeMajor, os, arch)` signature and its typed failure in `03-02`; add a focused compiler-local host-identity spec file. Keep the public API unchanged. | Plan-owned test-interface clarification on 2026-09-18 under overriding project directive 4. No implementation change, injected host framework, new support surface or simulated Windows qualification. | ✅ Resolved |

## Evidence and Resolution Notes

### AR-P1 — Startup checks

The worktree is clean on `feature/v4-rebuild` at
`5deb2a5341bea00cf6050a0aba4668315198d91a`. It descends from the Phase 0 base
`4c2f27f54273a713c0bbf398bf6c56be45f4aae3`. The parked v3 worktree remains clean at
that recorded base. RD-01 is Done; RD-02 has no implementation plan yet.

### AR-P2 — Why the correction is necessary

[RD-02](../../requirements/RD-02-clean-v4-foundation-and-deterministic-project-model.md)
R2.17 permits output-directory creation only during publication. R2.25 supplies a pure
basename validator here and explicitly assigns actual artifact creation to later
artifact-producing RDs. The Won't Have section excludes compiler artifact publication.
AC-15 nevertheless asks RD-02 to prove first-build directory creation and native
artifact creation/collision behavior. Its Paths verification-table row repeats that
premature artifact proof.

[RD-03](../../requirements/RD-03-playable-m1-complete-pipeline.md), Artifact publication,
already owns selected-profile artifact components, native alias/limit rejection,
exclusive creation, staging, and preservation of the prior generation. No new subsystem,
test framework, or sibling-RD redesign is needed. Planning those operations in RD-02
would either violate its scope or create premature publication support code. The narrow
correction removes that conflict without weakening the later publication contract.

The user approved the narrow correction and scope on 2026-09-17. No sibling RD or
specification change is needed.

## Project Authority

The user's AGENTS.md prime workflow directive explicitly overrides default CodeOps
guardrails and instructs that compiler/plan-owned choices are made on the single
tagged recommendation without prompting. AR-P3 through AR-P7 use that authority,
not inferred acceptance, historical delegation, or an unrequested `--auto-design`
mode. Scope and upstream modification remain user-owned and were explicitly
approved in AR-P1/AR-P2. No material support surface beyond the accepted foundation
is introduced, so no complexity escalation is approved or pending.

## Approved Preflight Corrections

On 2026-09-17 the user answered **"i do approve"** to the explicit request to
approve the separate host-error boundary and authorize all five plan-only
corrections. [PF-001–PF-005](00-preflight-report.md) own this decision history;
they are not new unresolved planning rows or approval of extra machinery.

- PF-001: `PROJECT_*` and `CLI_INVALID_ARGUMENT` are project/CLI host-result
  identifiers, outside Chapter 14's language/compiler diagnostic registry.
  This explicit product decision governs the host service; frozen spec content
  stays unchanged. Normative E10279 remains exactly Chapter 14-owned.
- PF-002: runnable tests precede internal hardening; actual host/measurement/
  deferral evidence is inspected directly at closeout, after its production.
- PF-003: malformed raw-byte encoding vectors belong to Phase 2.
- PF-004: parser stack exhaustion is a typed failure; use the existing parser.
- PF-005: declare existing private limit/checkpoint parameters only, in project
  modules, not a public host interface or test framework.

## Systematic Review

| Category | Closure evidence |
|---|---|
| Feature gaps | All R2.1–R2.30 and AC-01–AC-29 remain owned by RD-02; pure manifest/service/CLI responsibilities cover them. AR-P2 resolves the publication conflict. |
| Behavioral gaps | RD-02 owns success/failure, nearest/explicit discovery, defaults, exact-name preservation, retries, and no usable partial snapshot. AR-P4/AR-P5 select the direct implementation. |
| Scope ambiguities | AR-P1/AR-P2; no pipeline or publication work here. |
| Technical unknowns | AR-P3–AR-P7; only accepted toolchain roles and existing JSONC dependency. |
| Edge cases | Manifest duplicates/types, basename variants, native path aliases/escape/cycles/races, output exclusion, disappearance, empty roots, UTF-8/BOM, and bounded work are direct test obligations. |
| Integration points | AR-P3/AR-P5; one service for CLI now, later frontend/editor consumers without backend imports. |
| Data and state | AR-P4; exact immutable text and hashes, separate host identity, no persistent project state. |
| Security | Contained regular-file reads, bounded traversal, typed errors, escaped messages, no shell/config evaluation, no source uploads or stack traces. No server/auth boundary. |
| Non-functional | Deterministic identities and diagnostics; observations only, not timing or memory acceptance thresholds. |
| UX and presentation | AR-P5; truthful project-load messages and exit classes, no compilation claims. |
| Stakeholder conflicts | Modern source ergonomics and expert output remain frozen; this host-only RD produces no machine code. |
| Naming and terminology | AR-P3/AR-P5; existing public package/CLI names retained, exact project-relative source names are not module names. |

Selected domain lenses: data/migration for schema 1 and the inventory-led branch
transition; concurrency for files changing during reads; compiler/language for
UTF-8 coordinates, profile identity, and the future frontend/backend boundary.
No language parser, distributed service, database migration, or new infrastructure
framework is inferred from those lenses.

All rows are resolved. There are no plan-local deferrals or user-owned forks left
open. Future artifact creation remains with its existing RD-03/later owners, not a
new deferred RD-02 task.

## Runtime Clarification — AR-P8

The independent test author surfaced the name result representation gap before
production work. A raw offending input preserves evidence without changing the
basename; escaping belongs to diagnostic rendering. The smallest private boundary
signature lets real temporary fixtures prove the existing graph predicates.
The same representation clarification binds JSONC spans to full tokens/root
objects and the between-CR/LF position to the preceding line's content end,
following the primary LSP text-document convention. These are existing coordinate
obligations, not new input restrictions or machinery.
`03-01` and `03-02` contain the exact declarations. The product/scope baseline is
unchanged. No complexity escalation or new user-owned choice is involved.

## Approved Review Correction — RV-001

On 2026-09-17 the user answered **"you may"** to the explicit request to correct
the locked test separation. Preserve R2.1 as actual local execution evidence,
not a dependency of ordinary CI tests on this machine's exact branch or parked
sibling checkout. Keep portable frozen-authority and repository-lineage checks.
The independent test author owns the narrow correction; no manifest/name/position
or import-boundary expectation changes. Existing CI checkout must fetch the
history needed by the portable lineage/inventory checks. No fake worktree,
additional CI service, dependency or custom runner is authorized.

## Runtime Clarification — AR-P9

The limit diagnostic uses `manifestBytes`, `sourceBytes`, `totalBytes`,
`sourceFiles`, `visitedEntries`, or `depth`, matching the declared limit rather
than inventing a second vocabulary. The existing pure parser already reports
`manifestBytes`. Attempt exhaustion retains the separate `PROJECT_CHANGED`
message with the actual complete-attempt count.

A source or manifest that disappears after this attempt successfully resolved
or inventoried it has changed during loading. Discard that attempt and retry
from the manifest; one-attempt exhaustion reports `PROJECT_CHANGED`. A missing
explicit manifest or required directory at its initial resolution is a direct
typed host/path failure, not evidence of a changing attempt. Permission failures
and invalid schema/type/containment/limit violations remain direct failures.
