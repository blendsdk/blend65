# Preflight Report: RD-03 Pipeline Completion

> **Status**: ✅ PASSED — all 16 findings resolved
> **Iteration**: 2 (fix verification and bounded full re-scan)
> **Artifact**: full implementation plan at `codeops/features/blend65-v4/plans/rd-03-pipeline-completion/`
> **Original Identity**: committed plan tree `9a4cc75b28173cae6da0ebd07dc4875165a46f0b`
> **Corrected Content Hash**: `dd5bd43c5316062957dc01802d74e84de8a404094f0001e55441787b2e6ac17d`
> **Codebase Grounded**: all 12 plan documents plus 18 current source/config/test files examined
> **Last Updated**: 2026-09-20

The plan was created and reviewed in the same parent session. Five independent dimension clusters
and one independent recommendation challenger were used to reduce same-author bias. A fresh-session
review remains useful if the corrected plan changes materially before execution.

## Codebase Context Summary

**Tech stack:** TypeScript 7.0.2, Node 22, Yarn classic workspaces, Turbo, Vitest and targeted
Prettier. The current checkout has no general linter or bundler.

**Architecture:** The repository currently has only `@blend65/compiler` and `@blend65/cli`.
RD-02 project loading and the RD-03 frontend exist; the semantic backend, SFA, target lowering,
artifact publication and editor packages do not. The CLI is load-only. The root TypeScript graph
references only the two current packages, and CI does not install ACME.

**Key evidence:** root `package.json`, `tsconfig.json`, `turbo.json`, `.github/workflows/ci.yml`,
`test/foundation.spec.test.ts`, `test/import-boundary.ts`, compiler/CLI manifests and entry points,
the frontend service/types, project loader/types/path guards, and the RD-03 requirement.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---:|---|---:|---|
| 1 | Ambiguities | 1 | 🟠 Major |
| 2 | Implicit Assumptions | 0 | — |
| 3 | Logical Contradictions | 1 | 🟠 Major |
| 4 | Completeness Gaps | 3 | 🟠 Major |
| 5 | Dependency Issues | 1 | 🟠 Major |
| 6 | Feasibility Concerns | 1 | 🟠 Major |
| 7 | Testability | 2 | 🟡 Minor |
| 8 | Security Blind Spots | 3 | 🟠 Major |
| 9 | Edge Cases | 1 | 🟡 Minor |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering and Sequencing | 1 | 🟠 Major |
| 12 | Consistency | 1 | 🟠 Major |
| 13 | Codebase Alignment | 1 | 🟠 Major |

| Severity | Count | Status |
|---|---:|---|
| Critical | 0 | — |
| Major | 12 | All resolved and verified |
| Minor | 4 | All resolved and verified |
| Observation | 0 | — |

## Findings and Resolutions

### PF-001: Final SFA closure and its tests were scheduled too early 🟠 MAJOR

**Dimension:** Ordering and Sequencing
**Location:** `03-02-sfa-and-abi.md`, Final Storage Closure; `99-execution-plan.md`, Phases 1, 3 and 4
**Codebase Evidence:** `packages/compiler/src/frontend/service.ts` currently ends at frontend
analysis; no legalizer/binder exists to supply real storage demand.

**Problem:** Phase 3 claimed a final storage certificate before Phase 4 could add spills, pointer
pairs or helper scratch. ST-65 was in Phase 1 although its target facts arrive in Phase 4; ST-61,
ST-63 and ST-64 likewise depended partly on Phase-4 owners.

**Only viable correction:** Make Phase 3 the provisional inventory/allocation/closure engine. Move
the target-dependent cases to Phase 4, feed real binder/legalizer demand through the engine, then
freeze the final certificate before layout. Pulling backend work earlier or mocking missing owners
was dropped because either would break ownership or produce false proof.

**Decision:** Resolved — plan-owned correction applied under the accepted RD-03 scope and the
user's instruction to proceed.
**Confidence:** High. **Hardening:** challenger converged.

### PF-002: Scalar register returns were incorrectly required to have RAM homes 🟠 MAJOR

**Dimension:** Logical Contradictions
**Location:** `03-02-sfa-and-abi.md`, Direct Records and ABI; `07-testing-strategy.md`, ST-57

**Problem:** The ABI returns byte scalars in A and words in A/X, while ST-57 said every return had a
memory home.

**Only viable correction:** Give every result one explicit ABI location and allocate SFA storage
only for addressable, staged or spilled results. Forcing all scalar results into RAM was dropped as
worse-than-expert output with no requirement.

**Decision:** Resolved — result location and optional return staging are now distinct.
**Confidence:** High. **Hardening:** challenger converged.

### PF-003: The language server could not load a project through its permitted import 🟠 MAJOR

**Dimension:** Dependency Issues
**Location:** `03-05-public-consumers.md`, Backend-Free Frontend Subpath; `99-execution-plan.md`, Phase 6
**Codebase Evidence:** `packages/compiler/src/index.ts` owns `loadProject`, while the current
frontend service accepts an existing `ProjectSnapshot`.

**Problem:** The server must discover/load the nearest project but may import only the frontend
subpath.

**Only viable correction:** Re-export the existing safe project loader and its types from the
frontend subpath without importing the compiler root. Root imports or duplicated discovery were
dropped because they violate the boundary or duplicate the project owner.

**Decision:** Resolved — Phase 6 now owns the exact export and boundary proof.
**Confidence:** High. **Hardening:** challenger converged.

### PF-004: Compiler and CLI entry points were not wired 🟠 MAJOR

**Dimension:** Completeness Gaps
**Location:** `99-execution-plan.md`, Phase 6
**Codebase Evidence:** `packages/compiler/src/index.ts` exports only project loading;
`packages/cli/src/main.ts` remains load-only and `bin.ts` calls it.

**Problem:** New service and command modules would have remained disconnected from the public
package and installed executable.

**Only viable correction:** Add bounded tasks for compiler-root exports and CLI index/main/bin
wiring, covered by the existing public-journey tests.

**Decision:** Resolved — explicit composition-root tasks were added.
**Confidence:** High. **Hardening:** challenger converged.

### PF-005: Editor workspaces conflicted with the current foundation oracle and lacked build ownership 🟠 MAJOR

**Dimension:** Codebase Alignment
**Location:** `07-testing-strategy.md`, Test Policy; `99-execution-plan.md`, Phase 7
**Codebase Evidence:** `test/foundation.spec.test.ts` permits only compiler/CLI and rejects Vite;
root `tsconfig.json` references only those packages.

**Problem:** RD-03 requires two editor packages and permits Vite, but the plan omitted package
TypeScript projects, root references, exact dependency/lockfile work and the superseded oracle
transition.

**Only viable correction:** Before editor implementation, narrowly replace only the obsolete
RD-02 topology assertions with RD-03's exact four-package, editor-only Vite and Linux-CI ACME rule.
Then add explicit package/root/lockfile tasks. Skipping or broadly weakening the oracle was dropped.

**Decision:** Resolved — the requirement-supersession correction and integration tasks are explicit.
**Confidence:** High. **Hardening:** challenger converged and stressed preserving negative checks.

### PF-006: Required ACME CI evidence had no owner 🟠 MAJOR

**Dimension:** Completeness Gaps
**Location:** `03-04-artifacts-and-publication.md`, Testing Requirements; `99-execution-plan.md`, Phase 7
**Codebase Evidence:** `.github/workflows/ci.yml` installs Node dependencies only.

**Problem:** The RD requires real ACME and pure artifact checks in CI, but missing ACME would have
reported `Unknown` everywhere.

**Only viable correction:** Provision checksum-pinned ACME 0.97 on Linux CI, verify the version and
make its tier required there. Installing it on Windows was dropped because native Windows evidence
is already owned by AR-C16/RD-10.

**Decision:** Resolved — one CI task owns the Linux proof.
**Confidence:** High. **Hardening:** challenger converged.

### PF-007: A synchronous frontend cannot be aborted by a queued LSP change 🟠 MAJOR

**Dimension:** Feasibility Concerns
**Location:** `03-05-public-consumers.md`, Language Server; `99-execution-plan.md`, Phase 7
**Codebase Evidence:** `packages/compiler/src/frontend/service.ts` performs synchronous analysis.

**Problem:** The original wording promised in-flight abort that the event loop cannot observe.

**Only viable correction:** Use one small trailing-edge queue per project, cancel superseded
snapshot I/O, yield before publication and suppress stale results by generation. Making the entire
frontend asynchronous now was dropped as unnecessary machinery.

**Decision:** Resolved — the plan now states the honest queue and suppression contract.
**Confidence:** High. **Hardening:** challenger converged.

### PF-008: Publication did not revalidate output ancestors before mutation 🟠 MAJOR

**Dimension:** Security Blind Spots
**Location:** `03-04-artifacts-and-publication.md`, Paths and Lock / Commit and Current Record
**Codebase Evidence:** RD-02 resolves output paths during snapshot load, but later publication uses
path-based mutation and cleanup.

**Problem:** Replacing an output ancestor with a symlink after load could redirect writes or
deletion outside the validated root.

**Only viable correction:** Re-resolve containment and recorded identities at every mutation
boundary, create missing components one at a time with non-following checks, and stop cleanup on
any change. Platform-specific descriptor-relative infrastructure was dropped as disproportionate
for the portable Node scope.

**Decision:** Resolved — contract, task and swap tests were added.
**Confidence:** Medium — Node path APIs cannot prove the stronger descriptor-relative model.
**Hardening:** challenger kept the direct fail-closed design and named that limit.

### PF-009: The VICE monitor endpoint was not tied to the spawned child 🟠 MAJOR

**Dimension:** Security Blind Spots
**Location:** `03-04-artifacts-and-publication.md`, VICE Process and Monitor; `99-execution-plan.md`, Phase 8

**Problem:** Selecting a free loopback port leaves a bind race. Protocol/version responses do not
prove that the peer is the spawned VICE process.

**Only viable correction:** On Linux, attest that the listening socket belongs to the owned VICE
process tree before connecting and fail closed on mismatch. A proxy/broker was dropped as needless
infrastructure; native Windows attestation remains with AR-C16.

**Decision:** Resolved — exact Linux attestation is now an M1 helper obligation.
**Confidence:** Medium — container/PID namespaces may require the test to report tool failure.
**Hardening:** challenger converged with the same bounded caveat.

### PF-010: Editor overlay bounds were not implementable 🟠 MAJOR

**Dimension:** Security Blind Spots
**Location:** `03-05-public-consumers.md`, Backend-Free Frontend Subpath / Testing Requirements

**Problem:** The plan called overlays bounded but gave no count or byte limits, allowing excessive
open text to drive unbounded memory and repeated synchronous analysis.

**Only viable correction:** Reuse RD-02's 4 MiB/source, 10,000-source and 256 MiB/project limits,
reject unpaired Unicode before encoding and test every boundary. A second editor-specific policy
was dropped because no evidence requires another limit system.

**Decision:** Resolved — exact limits and cases were added.
**Confidence:** High. **Hardening:** challenger converged.

### PF-011: Determinism test contradicted the build schema 🟠 MAJOR

**Dimension:** Consistency
**Location:** `07-testing-strategy.md`, ST-77

**Problem:** ST-77 required every JSON byte to match even though the RD permits `.build.json` to
differ in `generationId` and declared host provenance.

**Only viable correction:** Compare all portable outputs byte-for-byte and compare a canonical
build projection that excludes only those declared fields. Broad JSON normalization was dropped
because it could hide other nondeterminism.

**Decision:** Resolved — ST-77 now has an exact variance whitelist.
**Confidence:** High. **Hardening:** challenger converged.

### PF-012: CLI exit categories had no numeric contract 🟠 MAJOR

**Dimension:** Ambiguities
**Location:** `03-05-public-consumers.md`, CLI

**Problem:** Specification tests could not prove “fixed exit statuses” without exact numbers.

**Only viable correction:** Freeze one small numeric table for success, internal/usage failures,
each public category and cancellation. Testing only nonzero or collapsing categories would violate
the RD.

**Decision:** Resolved — the table is now explicit and Phase 6 owns it.
**Confidence:** High. **Hardening:** challenger converged.

### PF-013: Two checked-in M1 evidence files lacked exact ownership 🟡 MINOR

**Dimension:** Completeness Gaps
**Location:** `03-06-m1-qualification.md`, Checked-In Fixture; `99-execution-plan.md`, Phases 1 and 8

**Problem:** `sprite-recipe.ts` exceeded its task's file ownership and `expert-ledger.json` was
absent from the exact inventory.

**Only viable correction:** Add the ledger to the inventory and give the raw recipe/output a small
Phase-1 task, explicitly retaining SpritePad in RD-06.

**Decision:** Resolved — both files now have one owner.
**Confidence:** High.

### PF-014: VICE proof could inherit user resources 🟡 MINOR

**Dimension:** Edge Cases
**Location:** `03-04-artifacts-and-publication.md`, VICE Process and Monitor

**Problem:** “Fixed profile settings” did not reset persisted VICE configuration.

**Only viable correction:** Freeze and test the ordered automated argument array beginning with
`-default` and including the selected model/video/SID, bounded run, monitor and input device.

**Decision:** Resolved — the exact array is in the plan.
**Confidence:** High.

### PF-015: Phase checkpoints did not name the required frozen install 🟡 MINOR

**Dimension:** Testability
**Location:** `07-testing-strategy.md`, Verification Commands; `99-execution-plan.md`, Execution Rules

**Problem:** Dependency-changing checkpoints could verify against a stale local install.

**Only viable correction:** State the repository's required frozen-install/build/typecheck/test
checkpoint once in the execution rules and add phase-specific cases after it.

**Decision:** Resolved — every phase checkpoint and final acceptance now use the exact sequence.
**Confidence:** High. **Hardening:** the challenger proposed dependency-triggered installs; the
repository's stricter phase-checkpoint rule governs.

### PF-016: Phase 8 named immutable spec files as edit targets 🟡 MINOR

**Dimension:** Testability
**Location:** `99-execution-plan.md`, task 8.2.3

**Problem:** “Reach GREEN” followed by spec-test paths could be read as permission to edit the
oracle after seeing generated output.

**Only viable correction:** Mark the spec files run-only and implementation/evidence as the only
edit targets. A faulty expectation requires explicit replanning.

**Decision:** Resolved — task wording now preserves oracle immutability.
**Confidence:** High.

## Iteration 2 Verification

All 16 corrections were checked against the unchanged RD-03 scope and the current repository.
The bounded full re-scan found no new critical, major, minor or observation finding. In particular:

- the final SFA certificate now has one real freeze point before layout;
- every test is scheduled with the first phase that can produce its evidence;
- compiler, CLI, editor, root graph, lockfile and CI integration have explicit owners;
- the foundation-oracle transition is narrow and retains exact negative checks;
- publication, overlay and monitor security rules are directly testable; and
- the simplicity gate still rejects registries, pass frameworks, daemons, generic schema/runtime
  services, emulator abstractions and speculative targets.

## Verdict

✅ **PREFLIGHT PASSED — all 16 findings resolved.** The corrected plan remains the minimum-sufficient
RD-03 implementation: focused compiler modules, two required editor workspaces, direct ACME/VICE
paths, one raw fixture and no optional framework or future-target machinery.
