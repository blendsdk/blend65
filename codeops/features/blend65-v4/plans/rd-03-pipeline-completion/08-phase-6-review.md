# Phase 6 Independent Review

> **Phase baseline tree**: `9e41226584cfe2b685b685666b1b2a934d5ba6e0`
> **Scope mode**: strict
> **Reviewed**: 2026-09-21
> **Status**: ✅ Complete — all accepted findings corrected; no open critical or major finding
> **Fix baseline snapshot**: `a76f39a1da5c8454f1f4826b0b8b2ff873eb5db0`

## Review Scope

One independent correctness reviewer inspected the complete snapshot-aware Phase 6 diff through
correctness, API-surface, security, standards and simplicity lenses. The review covered compiler
services, evidence preparation, CLI parsing/routing/process integration, the backend-free frontend
subpath, the bounded address-of prerequisite and the authorized CLI-oracle corrections.

Verification supplied to the reviewer was green: compiler 977/977, CLI 60/60 and root 52/52 tests;
build, typecheck, Prettier and whitespace checks passed; `spec/` was untouched. The reviewer made no
edits and confirmed no unauthorized specification-test change.

## Findings

| ID | Severity | Lens | Evidence | Finding | Smallest correction | Ruling |
|---|---|---|---|---|---|---|
| RV-001 | 🟠 Major | Correctness / API surface | `packages/compiler/src/services/evidence.ts:105`, `:270`, `:379` | Successful builds publish SFA memory intervals under a generic compiler owner, hash an empty SFA projection and publish empty debug address/function/context/symbol/location/range collections. The generation therefore claims complete evidence while omitting required final closure and debug facts. | Derive the existing memory/debug schema records directly from the semantic program, final certificate, final layout and reconciled labels. Add no schema layer or evidence framework. | ✅ Accepted 2026-09-21 |
| RV-002 | 🟠 Major | Correctness / security | `packages/compiler/src/services/services.ts:414` | VICE probe overflow and timeout only send `SIGTERM`, do not retain the termination reason and can hang or accept a forced zero exit with a non-exact version such as `3.100`. | Track normal/limit/timeout/cancel states, retain bounded bytes, use bounded TERM-then-KILL cleanup, await close and accept only an exact VICE 3.10 banner after a normal in-bound exit. | ✅ Accepted 2026-09-21 |
| RV-003 | 🟠 Major | Correctness / security | `packages/compiler/src/services/services.ts:446` | Interactive VICE inherits uncontrolled terminal output and cancellation owns only the immediate process, so descendants may survive after the generation pin is released. | Use the existing direct launcher with ignored bounded stdio and owned Linux process-group cleanup using TERM then KILL; keep the portable direct-child path for the deferred Windows qualification. Release the pin only after cleanup completes. | ✅ Accepted 2026-09-21 |
| RV-004 | 🟠 Major | Correctness / security | `packages/compiler/src/services/evidence.ts:194` | Evidence reads and record construction occur before the function's guarded result boundary. An exception can reject the public service and leave compiler-owned staging output behind. | Guard the complete existing evidence path and remove the verified owned staging directory on an unexpected pre-publication failure. Add no transaction or recovery service. | ✅ Accepted 2026-09-21 |

## Recommendation

Accept all four corrections. Each closes an already-required success, evidence or process-cleanup
contract. None expands product scope or needs a new abstraction. Dismissing any finding would leave
the Phase 6 deliverable untruthful or leave owned process/filesystem state after failure.

## Re-review Rule

After accepted fixes pass the complete Phase 6 gate, one fix-only independent re-review will inspect
only the correction diff. No third review cycle will run.

## Final Fix-Only Re-review

The single permitted fix-only review completed on 2026-09-21. It confirmed that the corrections
added no framework, registry or new public product surface, and that immutable specification-test
hashes remained unchanged. It reported these four surviving major gaps; no further review cycle
will run.

| ID | Severity | Lens | Evidence | Finding | Smallest correction | Ruling |
|---|---|---|---|---|---|---|
| RV-FIX-001 | 🟠 Major | Correctness / API surface | `packages/compiler/src/services/evidence-records.ts:629` | Every SFA-backed symbol claims its owner's complete function range instead of its actual lifetime, so overlaid values can appear simultaneously available. | Map each request's retained lifetime to the existing final machine ranges and reference only those ranges. Add no mapping framework. | ✅ Accepted 2026-09-21 |
| RV-FIX-002 | 🟠 Major | Correctness / security | `packages/compiler/src/services/services.ts:503`, `:567`, `:575`, `:652` | Cleanup uncertainty is discarded on cancellation or reduced to an ordinary runtime error, after which the generation pin is released even though an owned process may remain. | Return one cleanup-uncertain internal outcome; retain the pin and return `recovery-required` unless cleanup is confirmed. | ✅ Accepted 2026-09-21 |
| RV-FIX-003 | 🟠 Major | Correctness / security | `packages/compiler/src/services/services.ts:506` | The banner check still accepts suffixed spellings such as `3.10beta` and `3.10-evil`. | Parse the recognized banner's version token and require exact `3.10`. | ✅ Accepted 2026-09-21 |
| RV-FIX-004 | 🟠 Major | Security | `packages/compiler/src/services/services.ts:335`, `:356` | Evidence-failure cleanup recursively removes the staging path without verifying that it is still the directory created for this attempt. | Retain device/inode identity and remove only after a non-following identity match; otherwise leave it and return `recovery-required`. | ✅ Accepted 2026-09-21 |

Verification before this ruling point remained green: compiler 979/979, CLI 60/60 and root 52/52;
build, typecheck, focused evidence/publication/service tests, Prettier and whitespace checks passed;
`spec/` remained untouched.

## Accepted-Fix Resolution

| Finding | Resolution evidence |
|---|---|
| RV-001 | Final memory evidence now partitions emitted code, names semantic/global/asset/SFA owners and hashes the populated closure projection. Debug evidence publishes address spaces, functions, contexts, symbols, locations and exact machine ranges. |
| RV-002 | The bounded VICE probe retains normal/limit/timeout/cancel outcomes, caps output, performs TERM-then-KILL cleanup and accepts only a recognized banner containing the exact `3.10` token. |
| RV-003 | Interactive VICE uses ignored stdio and an owned Linux process group. The cancellation regression confirms both the parent and descendant are gone before return. |
| RV-004 | The complete evidence path is guarded. Pre-publication failure cleans only the retained compiler-owned staging identity and otherwise returns `recovery-required`. |
| RV-FIX-001 | Each SFA location now maps `request.lifetime.liveAt` positions to final instruction ranges. A regression proves two disjoint occupants share one physical home without sharing any debug live range. |
| RV-FIX-002 | Probe and launch cleanup return a distinct internal `cleanup-uncertain` outcome. That outcome returns `recovery-required` immediately and deliberately retains the generation pin. |
| RV-FIX-003 | Exact-token cases reject `3.100`, `3.10beta`, `3.10-evil` and `3.10.0`; normal `VICE 3.10` remains accepted. |
| RV-FIX-004 | Staging identity is retained immediately after assembly as device/inode data. Every pre-publication recursive cleanup rechecks a non-following directory identity and leaves a replacement untouched. |

## Final Verification

The accepted fixes passed the complete Phase 6 gate on 2026-09-21: frozen install, build and
typecheck; 67 compiler suites with 983 tests, 7 CLI suites with 60 tests, and 5 root suites with 52
tests. Touched-file Prettier, `git diff --check`, immutable-oracle hashes and the frozen `spec/`
check passed. The checkout defines no lint script or Turbo lint task, so no lint result is claimed.
The agreed single fix-only re-review is the final review cycle; no third review was run.
