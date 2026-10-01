# Windows branch integration and closeout review

> **Date**: 2026-10-01
> **Status**: Done — native foundation accepted, CI selection corrected and full merged checkpoint green
> **Scope**: RD-02 foundation closeout and RD-03 Linux milestone handoff
> **CodeOps Artifact Schema**: 1

## Exact integration boundary

The user requested a committed and pushed safety checkpoint, then inspection and
integration of `feature/v4-windows` with the necessary closeout checks. Existing
work was already committed. The five outstanding commits through
`7b2e994d82e43fccf2c0cdfc3ddada92f81823bf` were pushed normally to
`origin/feature/v4-rebuild` before merging.

| Input | Git identity |
|---|---|
| Local collision-read checkpoint | `7b2e994d82e43fccf2c0cdfc3ddada92f81823bf` |
| Windows branch tip | `8baf206c73fdf0c27dcce4d282780a15fbfc2ecd` |
| Common ancestor | `5970ed3bc064df8c6a0b8d4e7c6abf7d78408721` |

`git merge-tree --write-tree` found no conflict. The ordinary non-fast-forward
merge is ready for its local green commit after the approved CI correction. No
subsequent push is authorized or performed. The current collision-read
plan remains complete at 10/10. Neither frozen Specification 4 nor the active
expert skill changes.

The reviewed expert baseline is qualified version `2.0.1`, content commit
`1ce4852016e2a883cf1f733c6014c45e176bfc69`. Its release record and all frozen
specification files remain byte-identical to the pre-merge checkout.

## Imported evidence and bounded closeout

Native Windows results are the committed records supplied by the Windows branch,
not tests rerun on this Linux host. The [foundation closeout](08-closeout.md)
records native Windows x64, Node 24.18.0, frozen install/build/typecheck, 565
passing project cases, 56 direct root boundary cases, full owned workspace tests,
real symlink/ACL fixtures and direct CLI output/process checks. RD-02 AR-P12
explicitly admits Node 22 and newer; Node 24 is not presented as a Node 22 run.

The [pipeline closeout](../rd-03-pipeline-completion/08-closeout.md), RD-03 AR-P12
and requirements AR-051 close RD-03 as the Linux development milestone. Native
Windows live cancellation, publication and editor evidence do not prove normal
owner exit with a surviving descendant. That exact obligation remains DEF-3,
owned by RD-10 AC-10 and blocking Windows release. New macOS arm64/x64 release
claims also require native RD-10 evidence. This merge qualifies neither claim.
The configured hosted CI job is not treated as passing execution evidence.
The user's subsequent clarification confirms that compiler development happens
only on Linux. Windows and macOS are user release hosts, to be used when the
compiler is ready. No additional native host or cross-platform development
environment is requested.

## Independent review and oracle authority

One independent correctness reviewer inspected the complete incoming diff,
including concurrency, local-path security, public boundaries and evidence
honesty. No unresolved compiler implementation finding was reported. The bounded
follow-up reviewed the local corrections and the subsequently discovered hosted
CI run; it identified the remaining ST-38 closeout gate below.

| Finding | Disposition |
|---|---|
| RV-001: blanket CRITICAL flag for eight incoming spec-test file edits | Governing approval resolution below; no new local spec-test edit |
| RV-002: planning IDs in the root test-config comment | Removed; durable host-tier rationale retained |
| RV-003: missing explanations of non-trivial host behavior | Added focused JSDoc for cached-byte revalidation, the pinned bundle identities and the test launcher |
| MAJOR closeout gate: ST-38 Linux CI tier mismatch | Corrected under user-approved AR-P15; exact selection checks and the CI-style checkpoint pass |

The reviewer's mechanical rule flags every spec-test edit without exception.
The root resolution is the project's overriding workflow authority, the recorded
Windows-branch approvals and the user's request to integrate the inspected
branch. RD-02 AR-P12 approves the minimum Node version correction; AR-P13
approves only portable TypeScript invocation and committed frozen-content
identity checks with the existing dirty-tree guard; AR-P14 approves pinned
Windows ACME provisioning. RD-03 AR-P11 approves the exact Windows VICE
empty-banner exception. Other incoming fixture corrections retain the same
path, permission, direct-spawn, artifact, cancellation and pin obligations on
their native hosts. The normal-exit limitation is explicitly owned, not hidden
by a passing substitute. No spec-test file is edited after the merge.

## Completed local verification

The first merged install/build/typecheck passed. Its full test run failed only
the existing five-second implementation test that builds M1 twice and checks
fresh publication identity. The separate unchanged directed retry also timed
out under load above 20 on eight CPUs. Its premature cleanup then raced the
unfinished build. The test does not assert a performance requirement.

Only that implementation test now has a bounded 30-second timeout. Every
behavioral assertion remains unchanged. The directed repeat passes 8/8; the fresh
complete install/build/typecheck/test checkpoint passes with 2,981 tests:
compiler 1,621, CLI 62, language server 14, editor extension 6 and root 1,278.
Two native-Windows-only implementation cases are explicitly skipped on Linux.
The 108-file root run includes sequential VICE, M1 and all collision-read cases.
No production
timeout, compiler behavior, spec oracle or test selection changes in this local
correction.

| Check | Local log / result |
|---|---|
| First full attempt | `/tmp/blend65-windows-merge-full.JiqMhu.log`; five-second timeout only |
| Unchanged directed retry | `/tmp/blend65-windows-merge-services.29r3oY.log`; timeout and premature-cleanup race |
| Bounded directed repeat | `/tmp/blend65-windows-merge-services-bounded.nxReFO.log`; 8/8 pass |
| Full retry | `/tmp/blend65-windows-merge-retry.XCoH7o.log`; install/build/typecheck and 2,981 tests pass, exit 0 |
| Final corrected full checkpoint | `/tmp/blend65-windows-closeout-final.f4GVdo.log`; install/build/typecheck and 2,981 tests pass, exit 0; `TURBO_FORCE=1` reruns all package suites; CI selection flag absent |
| Corrected CI-style checkpoint | `/tmp/blend65-foundation-ci-final.kaIW4u.log`; install/build/typecheck and 56 root foundation/boundary tests pass, exit 0; previously verified package results reused |
| Incoming touched-file formatting | `/tmp/blend65-windows-merge-format.9BGZsK.log`; pass |
| Final touched-file formatting | `/tmp/blend65-windows-closeout-format.log`; pass; new integration review checked separately |

Workflow YAML parsing, local Markdown links, diff whitespace and unchanged frozen
authorities pass. `actionlint` is not installed; no workflow-linter or hosted-CI
pass is claimed. The approved CI configuration correction and the fresh complete
Linux checkpoint pass. RD-02's final task is complete; RD-03's Linux milestone is
Done. The feature counter advances to the engine-derived 4/10 completed RDs.
The imported portfolio edit is
not accepted on this non-integration branch; the original portfolio is retained
and its pre-existing numerical drift waits for the integration-branch cascade.

The derived-plan helper confirms RD-02 Done at 35/35 with no problems. Its
repo-wide exit remains nonzero because two unchanged task mini-plans contain
only their permitted `99-execution-plan.md`, while the helper expects an index.
No repo-wide helper pass is claimed and no unrelated plan is expanded here.

## Hosted CI finding and approved correction

[CI run 36835713610](https://github.com/blendsdk/blend65/actions/runs/36835713610)
executed the exact supplied Windows branch tip and failed. Its downloaded log is
`/tmp/blend65-windows-branch-ci.VysduC.log`. Earlier imported statements that the
hosted revision was unrun are superseded by this observation.

| Host | Observed failure | Qualification meaning |
|---|---|---|
| Windows | ACME archive checksum mismatch before install/build/tests | No hosted Windows pass; the prior local native proof remains valid |
| Linux | Package tests pass; 67 root cases fail because pinned VICE is unavailable | CI selects a broader tier than its approved foundation-only setup |

A read-only download from the same official Windows archive URL is a real ZIP
and reproduces the trusted SHA-256
`68f7c80c23806eced6ab96622d8e22b500ed76b4d34a01af33461dee04edc359`.
The hosted log does not identify the unexpected downloaded bytes. Do not replace
or weaken the hash. Windows hosted delivery correction remains with RD-10's
final user-host qualification under the user's clarified sequencing.

ST-36 native qualification and ST-37 host classification are satisfied by the
recorded evidence and approved Node amendment. The user approved AR-P15 on
2026-10-01: "approved, please proceed". The workflow Test step alone now sets
`BLEND65_FOUNDATION_CI=1`; the existing root config selects the four foundation
and import-boundary files under that exact flag or on Windows. No package config,
test oracle, trusted hash, dependency or workflow command changes. No emulator
installation or generalized runner is added. RD-03 AR-P12 independently permits
its Linux milestone closeout.

Directed checks using actual `vitest list --filesOnly` prove exactly four files
under the flag, all 108 local Linux files without it, and all 109 compiler files
with or without it. Generic `CI=true`, flag `0` and flag `true` do not narrow the
Linux root suite. YAML parsing proves the flag is confined to the Test step and
both native matrix hosts remain configured. The existing immutable root oracle
passes all 56 cases in the CI-style install/build/typecheck/test checkpoint:
`/tmp/blend65-foundation-ci-final.kaIW4u.log`, exit 0. Turbo reuses the already
verified unchanged package results in this directed checkpoint. The subsequent
full local checkpoint passes after forcing every package suite to execute again,
with the flag absent and VICE cases sequential. Compiler 1,621, CLI 62, language
server 14, editor extension 6 and root 1,278 pass; only the two native-Windows-only
implementation cases are skipped on Linux. Every ST-01–ST-40 obligation now has
its accepted native, automated or direct-inspection evidence. RD-02 is closed;
the known Windows hosted-delivery failure remains explicitly RD-10-owned.

The bounded independent review of the merged implementation remains the review
authority; this approved, trivial two-file CI/config correction is inspected
inline against its exact contract and actual collection results, not sent for
a third whole-phase review. Security/performance specialist reviews are not
needed for test selection: no runtime, machine-code or new input surface changes.

## Deferral-expiry check

**Did this RD's deliverables expire any deferral's stated rationale?** Yes:
the supplied native Windows foundation evidence removes DEF-1's missing-host
reason. RD-02 has no remaining landing slice. The requirements and plan
registers, RD-02/RD-03 Won't Have sections and frozen future-consideration
criteria retain their other owners. DEF-3's missing-host reason also expires,
but its separately identified normal-exit process-ownership proof is still due
under RD-10. No new source restriction or language reconsideration is introduced
by host portability; the live NMI restriction and other compiler/asset/optimizer
deferrals do not expire. RD-05 remains Executing.
