# Phase 1 Verification

## Scope and Result

The first library foundation exports three real pure APIs: `parseManifest`,
`validateProjectName` and `byteOffsetToPosition`. It does not compile Blend65.
Project loading and the CLI remain later phases.

| Obligation               | Evidence                                                                                                                                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen authority         | Root identity test verifies full spec and expert tree against the RD-01 authority commit, plus independent corpus/router/release digests                                                                                      |
| Salvage partition        | 2,136 baseline paths, 126 complete rows; no production port/adaptation admitted                                                                                                                                               |
| Removal                  | 1,400 exact rejected targets inspected clean before removal; 1,396 absent, four compiler paths rewritten (package manifest, public barrel, TS config and Vitest config); six binary/non-UTF-8 blobs removed by explicit paths |
| Recovery                 | Removed v3 material remains in Git and the clean parked v3 checkout; no legacy copy                                                                                                                                           |
| Stable tools             | Node 22, Yarn 1.22.22, TypeScript 7.0.2; compatible Turbo 2.9.16, Vitest 2.1.9, Prettier 3.8.3, Node declarations 22.19.19 and JSONC parser 3.3.1                                                                             |
| Specification tests      | 441 cases: 410 pure, seven structural and 24 boundary; all green after meaningful pre-replacement red evidence                                                                                                                |
| Internal tests           | 20 cases: Unicode/JSONC/record/order internals and real import-reader fixtures                                                                                                                                                |
| Reference freshness      | Real two-project compiler fixture builds twice, then rejects the consumer after a deliberate dependency API change                                                                                                            |
| Private helper typecheck | Normal TypeScript 7 with `--ignoreConfig --types node`; strict NodeNext/ES2023 check passes                                                                                                                                   |
| Native host              | Linux only; no Windows qualification or universal silicon proof claimed                                                                                                                                                       |
| CI validation            | YAML parser and owned-command inspection pass; actionlint is not installed                                                                                                                                                    |
| Independent review       | Initial review and single fix review completed; technical findings closed; explicit oracle exception recorded                                                                                                                 |

Full command: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`.
Logs: `/tmp/blend65-rd02-phase1-full-verify-captured.log`,
`/tmp/blend65-rd02-phase1-spec-green.log`,
`/tmp/blend65-rd02-phase1-red.log`.

The temporary red resolver read parked dependencies only. It did not redirect
the tested public barrel, install into the parked checkout, write a stub or run
inherited tests. Missing helper/executable failures were recorded as infrastructure
failures, not proof of individual boundary predicates. The green synthetic graph
cases now exercise those predicates.

## Simplicity Check

One operational library package, one runtime dependency, ordinary focused files.
No placeholder compiler stages, abstract host API, plugin model, caching service,
policy DSL, registry generator, custom runner, bundler or replacement linter.
The private 326-line import reader is the direct test helper already in the plan.
The manifest module is 350 lines; other production modules are below 110 lines.

Dedicated security/performance auditors are skipped because no named security
profile or performance-critical tag is active for this host-only phase. Local
input validation and public boundaries are included in the required reviewer.
The quality policy still requires one independent reviewer and stops on major
findings, subject to the project's plan-owned technical-decision authority.

## Independent Oracle Integrity

These hashes bind the independent author's finalized tests before internal tests
and the initial phase review. The original hashes are preserved as history;
the explicitly approved RV-001 correction hash is recorded below. Production
work must not change selected expectations without such approval. The author strengthened
the frozen-tree identity check after its own self-review; parent changed no
assertion. Rejected v3 oracles were removed only under the completed inventory.

| File                                                              | SHA-256                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------ |
| `test/foundation.spec.test.ts`                                    | `8e95dda4b960c93dbafcd9c794e93c392e6c1d0a241e92ed48f30291abeb4f6e` |
| `test/import-boundary.spec.test.ts`                               | `7fa7c68adb50ce9f13ab6e73be68b216f20a30a7229163ac8db420a53328916f` |
| `packages/compiler/src/project/basename.spec.test.ts`             | `ba6a1c11de8fc7432277d1a83a14ad8b6f3258cec81da54ccfa19143d926a8c0` |
| `packages/compiler/src/project/manifest-diagnostics.spec.test.ts` | `5bfafa52a1df22e089df217c4893d878b309189467ded127dc322bed287900fb` |
| `packages/compiler/src/project/manifest.spec.test.ts`             | `164ccdf9aae1e4516ecd63f944600067d5e9232e0098b3d5b0f7d3f7a5fb0fb2` |
| `packages/compiler/src/project/positions.spec.test.ts`            | `75f0837a9ba6937534ac3bb38fc9523da2fcabacb1fe9c87f6e54b429ed39ad5` |

## Formatting and Ownership

Targeted production/test/config formatting and diff checks are required. The
inherited Markdown ignore file skips Markdown by default; explicitly ignoring
that ignore file exposes historical layout drift in retained documents. No
claim of whole-document Markdown formatting cleanliness is made. New prose and
evidence are checked without rewriting inherited historical tables.

The v4 roadmap stays Executing. Historical feature roadmaps are labelled
reference-only. The expert roadmap distinguishes its original v1 qualification
from the frozen active v2 authority. Portfolio numeric roll-up waits for
integration, as approved; no portfolio, spec, active expert or parked-tree
mutation is authorized.

## Independent Review and Checkpoint Pause

Reviewer: `/root/rd02_phase1_review`, final inspected tree
`f0f6319ed3c20d6295e101eaa5beb1fb904ce684`, against the phase baseline
`b90711e391423f8d4a329a3289fa6eed24644afb`.

| Finding | Severity           | Evidence                                                                                                                                                                                                          | Ruling / next action                                                                                                                                                                                                                                                                                                                                        |
| ------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RV-001  | Major, correctness | `.github/workflows/ci.yml:26` invokes ordinary tests whose `test/foundation.spec.test.ts:104–106` bootstrap check requires this development branch and parked sibling worktree; normal checkout cannot satisfy it | Best option selected: preserve R2.1 as local execution evidence and retain portable frozen-authority checks in ordinary tests. User explicitly approved on 2026-09-17: "you may". Independent-author correction and full local/clean-clone verification pass; technical finding closed. No fabricated workspace, extra CI service or silent test weakening. |
| RV-002  | Minor, correctness | Original removal count omitted the rewritten public barrel                                                                                                                                                        | Factual evidence corrected: four rewritten targets, 1,396 absent. No changed deletion target or implementation.                                                                                                                                                                                                                                             |

The reviewer confirmed all six finalized oracle hashes, inventory-backed
deletions, unchanged frozen authority/portfolio, and the simplicity check.
No additional production, API or security findings. The expert lineage is the
frozen v2.0.0 content commit above; no assembly/hardware proof is claimed.

## Approved Correction and Portable Verification

The user explicitly approved the narrow locked-oracle correction with **"you may"**.
The original independent author corrected only the identity test and its private
comparison helper. The other six foundation tests are byte-identical (suffix
SHA-256 `5a49b8d44b2ac4cf37d4825eb5433d3ff882ac55ad9a3d6ef797944a6837740b`);
the other five selected spec files retain the original hashes above.

The corrected foundation file SHA-256 is
`ae2b98231343094b6432ee2a7cf0b1de1a611e827d1b2a0c53acbc3acf1f0f4d`.
Portable tests retain actual repository ancestry, corpus/router/release hashes,
full frozen-tree equality, and seven real authority-mismatch fixtures.
Exact local branch/parked identity checks remain mandatory direct execution
evidence, repeated successfully in
`/tmp/blend65-rd02-bootstrap-recheck.log`.

| Run                                                 | Result / evidence                                                                                                                                                   |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actual worktree complete foundation command         | PASS, 461 tests; `/tmp/blend65-rd02-phase1-approved-fix-verify.log`                                                                                                 |
| Independent detached clean clone, no parked sibling | PASS, fresh frozen install/build/typecheck and 461 tests; `/tmp/blend65-rd02-portable-full-verify.log`                                                              |
| Clone input tree                                    | `5b911865529fed505f7f9e164376f0edba086471`; scratch checkout `/tmp/blend65-rd02-portable-xhB8VW/checkout`                                                           |
| CI correction                                       | Existing checkout fetches full history; no fake development branch/worktree, new service, credential, dependency or custom runner                                   |
| Single fix review                                   | Original reviewer confirms technical RV-001 closure, RV-002 correction, preserved five oracles/six unrelated tests and simplicity; no additional technical findings |

The clean-clone verification used a temporary Git snapshot object without moving
a user branch or ref. It proves portable Linux execution, not a remote CI run or
native Windows qualification. No selected manifest/name/position or boundary
expectation changed.

## Fix Review Policy Ruling

The reviewer's no-exceptions role contract also emitted a CRITICAL integrity
finding solely because a selected oracle changed. It explicitly acknowledged
the user's approval and found no unauthorized change or behavioral defect.
Its remedy is to record the approved exception, changed hash, independent author
and successful requalification, rather than claim the oracle was unchanged.

That remedy is satisfied by this record. The primary governing coding standard
allows an explicitly approved spec correction; the user supplied that exact
approval. This is a documented authorized exception, not an inferred vote,
risk waiver or silent weakening. The author remained implementation-blind,
the corrected hash is bound above, and full actual/portable verification passes.
No reviewer-role policy or other spec expectation was changed. The single
permitted fix review is complete; no third review is requested.

The production checkpoint and its actual inventory commit binding remain the
last Phase 1 actions.
