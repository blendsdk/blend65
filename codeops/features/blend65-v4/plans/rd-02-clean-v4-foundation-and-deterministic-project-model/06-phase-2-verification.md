# Phase 2 Verification

## Entry Checks

Phase 2 began on 2026-09-17 from the clean committed Phase 1 worktree.
The complete phase baseline tree is
`e3b9426a0ffaf51899f680c319ab01db11258e8e`.

| Check                                 | Actual result                                                         |
| ------------------------------------- | --------------------------------------------------------------------- |
| Development branch                    | `feature/v4-rebuild`                                                  |
| Recorded v3 and frozen RD-01 ancestry | Both ancestor checks pass                                             |
| Parked v3 evidence                    | Clean at `4c2f27f54273a713c0bbf398bf6c56be45f4aae3`                   |
| Frozen specification and expert       | No differences from RD-01 authority commit                            |
| Resume build, typecheck and tests     | PASS, 461 existing tests; `/tmp/blend65-rd02-phase2-resume-check.log` |
| Actual local host                     | Node 22.23.1, Linux x64, effective uid 1000                           |

## Scope and Simplicity

Only the contained project-loading service is being implemented. Focused
internal modules use Node built-ins and the existing JSONC dependency. No new
dependency, general host abstraction, watcher, cache, compiler pipeline or
artifact publication is authorized. A small test-only fixture helper supports
real temporary projects; it is not shipped in compiler build output.

The independent author receives only approved requirements, test scenarios,
planned public/private declarations and frozen authority inputs. Existing
production, tests and the import-boundary helper are forbidden. No host/snapshot
implementation precedes the Phase 2 tests and their recorded red run.

These entry results are not Phase 2 completion or native Windows qualification.

## Independent Path and Inventory Oracles

Task 2.1.1 contains 65 cases across five concern files. Parent reproduced 45
behavioral failures on absent public `loadProject`; two private-control suites
cannot collect until `snapshot.ts` exists (20 authored cases). Those collection
failures are infrastructure evidence, not proof of their edge predicates.
Logs: `/tmp/blend65-rd02-task211-parent-red.log` and the independent author's
final `/tmp/blend65-rd02-task211-spec-red.log`.

The original author confirmed no forbidden production/existing-test reads.
Native permission fixtures assert actual denial, using current-user Windows
ACLs or restored-mode POSIX permissions. Linux denial is reproduced; Windows
fixture construction remains native-unverified. Parent reviewed the requirements
mapping and documentation and repeated formatting, helper typecheck and diff
checks: PASS (`/tmp/blend65-rd02-task211-author-check.log`).

Final independent-author hashes before implementation:

| File (relative to `packages/compiler/`)  | SHA-256                                                            |
| ---------------------------------------- | ------------------------------------------------------------------ |
| `test/project-fixtures.ts`               | `a54c2a1e38aada5390e861078c5a90ec1511a2f5f47b41bb1bb3718943fd5356` |
| `src/project/discovery.spec.test.ts`     | `3c3528289bdd4b0bc2ae4e4b7bb6ecbfb0a41cc45a3b9a6ffda58c8eb3b28f3a` |
| `src/project/paths.spec.test.ts`         | `78ba8dfba4da245b1a8299b182ead01e942353707aeb891ab81feee0a575fd28` |
| `src/project/inventory.spec.test.ts`     | `a3a54d769b11d624f273de7de11ca5f22b9a19b8c694cb98b763d89d365d8320` |
| `src/project/host-bounds.spec.test.ts`   | `67bf754345c8ef81792ec944ec3a5d806bf1fa8acce6b18cadd5ccdd89f22056` |
| `src/project/guarded-input.spec.test.ts` | `8481121b550c73437ea7dee02a4fce16ab421513ed3552ee9ec5476623ac83c2` |

Concern splits and the shared test-only helper are ordinary tests within the
approved modification set. They add no runtime dependency or support framework.

## Snapshot Oracles and Complete Red Checkpoint

Task 2.1.2 adds 57 cases: snapshot 7, diagnostics 25, controlled changes 16,
and retry policy 9. Combined Phase 2 total: 122 authored cases. Parent's explicit
combined run reproduces 77 behavioral failures on absent public `loadProject`
and four private-control collection failures (45 cases not yet executed).
No host/snapshot replacement or stub existed at this run.

| Additional file (relative to `packages/compiler/src/project/`) | Final SHA-256                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `snapshot.spec.test.ts`                                        | `b5559395a9c40c576d3f993f83dcc5f4c59e9df27cc07f3a0f8ea9c708029884` |
| `diagnostics.spec.test.ts`                                     | `4b36641a2307ea23501879abfdbe80789def3c844dd09dc21a3da4feeaba9150` |
| `snapshot-races.spec.test.ts`                                  | `a7b0fe59fb64d94651369f2fc372fc0989d2d0338c2a629346e2de43657ab421` |
| `retry-policy.spec.test.ts`                                    | `3e68005a84fd2b9967ab344c18d150faf7a1eb31ed3bdaa14c40e354ea2d8139` |

The author added documentation only to four nested test helpers during final
authoring; assertions, fixtures and case counts did not change. Parent formatting,
documentation and diff checks pass. Logs:
`/tmp/blend65-rd02-task212-author-check.log` and
`/tmp/blend65-rd02-phase2-parent-red.log`. The independent author's detailed
per-case red report is `/tmp/blend65-rd02-phase2-spec-report.md`.

Whole-tree equality and prior-output checks cannot alone prove that a temporary
write never occurred. No flaky filesystem observer is added. The installed
`strace` tool and direct read-only production-call inspection will supply actual
attempted-write evidence at the green checkpoint, recorded below. This was not
claimed by the red tests. All 45 private-control cases now execute green.

## Green Service Qualification

| Actual check                                                                | Result / evidence                                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Types and directed native discovery/path/inventory/read checks              | PASS; `/tmp/blend65-rd02-task221-verify.log`, `task222-verify.log`, `task222-native-check.log`, `task223-verify.log`, `task223-native-check.log`, `task224-verify.log`, `task224-native-check.log` under `/tmp/blend65-rd02-`                                            |
| Private race/limit/retry/handle specification cases                         | All 45 collected and pass; `/tmp/blend65-rd02-task225-verify.log`                                                                                                                                                                                                        |
| Complete Phase 2 specification suite                                        | All 122 pass; `/tmp/blend65-rd02-task226-verify.log`                                                                                                                                                                                                                     |
| Built public package API and frozen metadata                                | PASS; private controls absent from barrel; `/tmp/blend65-rd02-task226-public-api-check.log`                                                                                                                                                                              |
| All existing regressions plus Phase 2 specifications                        | 583 pass; `/tmp/blend65-rd02-task227-regressions.log`                                                                                                                                                                                                                    |
| New implementation cases                                                    | 15 pass; `/tmp/blend65-rd02-task231-verify.log`                                                                                                                                                                                                                          |
| Complete frozen install/build/typecheck/test and targeted source formatting | PASS, 598 tests; `/tmp/blend65-rd02-phase2-full-verify.log`                                                                                                                                                                                                              |
| Attempted filesystem writes                                                 | Native Linux `strace -f -yy` observes actual public success, invalid encoding, invalid path and native permission failure. No project-file mutation or write-capable open; `/tmp/blend65-rd02-phase2-write-proof.log`, raw `/tmp/blend65-rd02-phase2-write-syscalls.log` |
| Frozen authorities and oracle integrity                                     | Spec/expert byte-identical to RD-01; all nine finalized new oracle hashes and fixture helper match their pre-implementation records. Existing Phase 1 spec files unchanged.                                                                                              |

Production host code calls only native discovery, canonicalization, directory
open/read/close, stat and bounded regular-file reads using `O_RDONLY`. It has no
write, publication, subprocess, configuration execution, network or temporary-file
path. The trace supplements this direct read-only call inspection; it is actual
Linux evidence, not a claim about unexecuted Windows syscalls.

Largest new service module is 281 lines. No new package/dependency/framework,
persistent state, watcher or cache is introduced. Single-directory entry names
are retained only after streamed budget checks, then byte-sorted to keep first
failures independent of creation order; there is no unbounded recursive glob.

## Independent Review and Checkpoint

Independent correctness review completed on 2026-09-18 with **no findings**.
It compared baseline `e3b9426a0ffaf51899f680c319ab01db11258e8e` with final
service snapshot `1be9f571b43e1b92dbf8fed9cb642c5cc90eed19` through correctness,
maintainability, standards, security, concurrency and API-surface lenses.
Oracle integrity and the simplicity check both pass. The final inventory guard
rechecks output exclusion against the path actually retained after resolution;
its formatting, build, typecheck and all 598 tests pass again in
`/tmp/blend65-rd02-phase2-final-guard-verify.log`.

This evidence is included in the local green Phase 2 checkpoint. No push is
authorized. Native Windows qualification and the CLI remain Phase 3 obligations;
RD-02 is still Executing, not closed.
