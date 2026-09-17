# Execution Plan: RD-02 Foundation

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-17 23:20
> **Progress**: 13/35 tasks (37%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the owning RD through real behavior checkpoints, not a horizontal
compiler skeleton. Preflight must PASS before execution. Scope/authority is
[AR-P1–AR-P8](00-ambiguity-register.md); contracts and signatures are in the
three component documents. This checklist alone owns task progress.

## Implementation Phases

| Phase | Outcome | Tasks |
|---|---|---|
| 1 | First green toolchain/manifest foundation and inventory-led v3 removal | 13 |
| 2 | Contained deterministic project-loading service | 12 |
| 3 | Truthful CLI, native-host qualification, and closeout | 10 |

**Total: 35 tasks across three phases.** No fabricated hour estimate.

> **Execution rule:** After implementing each task, mark `[~]` with the actual
> timestamp; after its directed verification passes, mark `[x]`. Update this
> header's progress and Last Updated immediately after each task. Resume the
> first `[~]`, otherwise the first `[ ]`, top to bottom. Mark a blocker `[!]`
> with its concrete reason. Only `[x]` counts complete. Use actual local time,
> not a copied planning timestamp. Task lines appear once, never in a duplicate
> consolidated checklist.

Specification-first order is mandatory in every phase. Spec-author packets
contain only the owning RD, ST excerpts, public signatures, the Phase 2 private
limit/checkpoint declarations in `03-02`, authority inventory,
and allowed fixture inputs. Production `packages/*/src` files, old test logic,
and the import-boundary implementation helper are forbidden to the spec author.
New spec expectations are immutable; inventory-approved removal of unselected
v3 tests does not authorize editing new expectations. Independent review follows
the configured project quality policy, using the actual phase baseline tree.

Intermediate tasks may leave the working transition temporarily red, never a
committed checkpoint. Verify directed obligations for each task; run the complete
foundation command at each phase checkpoint and before committing production
changes. Commit only coherent green outcomes using the git-commit skill; never
push. Do not create fake pass/stub code to get an intermediate commit.

## Phase 1: First Green Manifest Foundation

> **Phase baseline tree**: `b90711e391423f8d4a329a3289fa6eed24644afb`
> **Lenses**: migration safety, local input validation, public boundaries

**Scope mode:** strict. Original goal and minimum design remain the index's
foundation-only baseline. Expected modification set: this plan's inventory,
execution evidence and index; the v4 feature roadmap; inventory-rejected
inherited surfaces; root guidance/configuration/task/lock files; the real compiler
package's configuration, public barrel and focused project manifest/diagnostic
modules/tests; root foundation/import-boundary tests/helper. No frozen spec,
active expert, parked worktree or portfolio mutation. No new support machinery.

### Step 1.1: Inventory and Specification Tests

**Reference**: `03-01` Inventory/First Green Checkpoint; `03-02` Manifest;
ST-01–ST-13. No implementation before the tests below.

- [x] 1.1.1 Verify bootstrap/frozen identities and complete the component salvage inventory — `04-salvage-inventory.md`; `03-01` Inventory; ST-01–ST-02. ✅ (completed: 2026-09-17 21:36)
- [x] 1.1.2 [spec-author] Author independent structural/import-boundary tests — `test/foundation.spec.test.ts`, `test/import-boundary.spec.test.ts`; ST-01–ST-08. ✅ (completed: 2026-09-17 21:42)
- [x] 1.1.3 [spec-author] Author pure manifest/name/position tests — `packages/compiler/src/project/{manifest,manifest-diagnostics,basename,positions}.spec.test.ts`; ST-09–ST-13; `03-02` public signatures. ✅ (completed: 2026-09-17 21:49)
- [x] 1.1.4 Demonstrate focused red tests before replacement; record already-passing baseline checks and proof each new oracle detects a contract violation — task evidence in this plan; ST-01–ST-13. ✅ (completed: 2026-09-17 21:49)

**Verify**: Run only the new explicit test paths with the available Vitest
executable. Red is expected here, not a commit checkpoint. No inherited suite.

**Task 1.1.1 evidence:** 2,136 baseline tracked paths partitioned into 126
schema-complete rows; reusable discovery/offset/line-map/host/asset/tool/hash
candidates assessed separately. No production port/adaptation admitted.
Bootstrap ancestry, parked v3 identity/cleanliness and all frozen spec/expert
hashes reproduced. Targeted Markdown formatting and diff checks passed.
Log: `/tmp/blend65-rd02-inventory-verify.log`. No compiler test or native-host
qualification result is claimed by this documentation checkpoint.

**Task 1.1.2 evidence:** Fresh implementation-blind spec author produced seven
structural tests and 24 parameterized boundary cases. Directed red run: two
baseline passes (authority/inventory with real mismatching fixtures); four actual
contract-red assertions (old topology, TypeScript 5, forbidden operational tasks,
rejected paths); one missing local `tsc` infrastructure failure, not contract
proof. Boundary collection fails on the absent planned helper; its 24 predicates
are authored but not yet executed. No old implementation/test/helper was read.
Parent repeated the directed run and checked documentation/targeted formatting.
Log: `/tmp/blend65-rd02-task112-red.log`. No red transition committed.

**Task 1.1.3 evidence:** Four focused pure files contain 410 independent cases.
The diagnostics concern is split into its own ordinary test file. The initial
run could not collect the inherited barrel because dependencies are not installed.
A temporary diagnostic-only resolver used parked, read-only dependency exports
while still loading this worktree's public barrel: all 410 cases then collected
and failed on the missing public manifest/name/position APIs. No production/stub
was written; no inherited tests ran. Formatting/documentation checks passed.
Log: `/tmp/blend65-rd02-pure-public-api-red.log`.

**Task 1.1.4 evidence:** Full explicit new-test red run collected 417 cases:
two authority/inventory passes, four structural contract failures, 410 missing
public-API failures, one missing executable failure. Boundary collection separately
fails because its required helper does not exist. These last infrastructure
failures do not prove its 24 edge predicates; synthetic real forbidden graphs
must prove them at the green checkpoint. No replacement or stub preceded this run.
Log: `/tmp/blend65-rd02-phase1-red.log`.

### Step 1.2: Implement the Green Transition

**Reference**: `03-01` Packages/Root Toolchain/Rejected Surface Removal;
`03-02` Manifest/Project Diagnostics; AR-P3–AR-P6.

- [x] 1.2.1 Remove exactly inventory-rejected v3 implementation/test/fixture/example/script/config surfaces; label retained historical CodeOps evidence and make root status truthful — exact inventory file groups; `03-01` Rejected Surface Removal; ST-03. ✅ (completed: 2026-09-17 21:53)
- [x] 1.2.2 Replace root dependency/task ownership and pin the stable toolchain — `package.json`, `yarn.lock`, `turbo.json`; `03-01` Root Toolchain; ST-04, ST-08. ✅ (completed: 2026-09-17 21:53)
- [x] 1.2.3 Configure the one real library package and strict project-reference build — compiler package/TS configs, root/base TS configs and `.nvmrc`; `03-01` Packages/Root Toolchain; ST-04, ST-07–ST-08. ✅ (completed: 2026-09-17 21:54)
- [x] 1.2.4 Implement project diagnostic records/sorting and exact byte-position conversion — `compiler/src/project/diagnostics.ts`, `positions.ts`; `03-02` Public Signatures/Project Diagnostics; ST-10–ST-12. ✅ (completed: 2026-09-17 21:54)
- [x] 1.2.5 Implement the pure name/schema contract and honest public manifest exports — `compiler/src/project/basename.ts`, `manifest.ts`, `types.ts`, library barrel; `03-02` Manifest; ST-09–ST-13. ✅ (completed: 2026-09-17 21:56)
- [x] 1.2.6 Implement the direct import-boundary helper and focused root test discovery/ignored generated outputs — `test/import-boundary.ts`, root Vitest config, `.gitignore`; `03-01` Direct Boundary Test; ST-03–ST-08. ✅ (completed: 2026-09-17 21:58)
- [x] 1.2.7 Run the new Phase 1 specification tests green; fix production only — directed Phase 1 paths; ST-01–ST-13. ✅ (completed: 2026-09-17 21:59)

Task 1.2.1 is mechanical inventory-backed removal, not a port/refactor. Review
the exact target list before removal; do not split it into hundreds of per-file
microtasks or use a broad unresolved destructive target. Small declarative tool
config edits form one build concern. If a production logic task exceeds normal
reviewable size, split that implementation task before executing it, preserving
the spec-first dependency and updating this sole checklist.

**Verify**: Directed new tests plus currently owned library build/typecheck.
The complete checkpoint command below must pass before the transition is committed.

### Step 1.3: Internal Tests and First Green Checkpoint

- [x] 1.3.1 Add focused implementation tests for JSONC/offset/name/diagnostic/import-reader internals — corresponding `*.impl.test.ts` files; `07` Test Ownership; do not alter spec tests. ✅ (completed: 2026-09-17 22:01)
- [x] 1.3.2 Run full foundation verification and independent phase review, resolve findings under the project policy, commit the first green foundation and bind inventory proof — `04-salvage-inventory.md`; `03-01` First Green Checkpoint; ST-01–ST-13. ✅ (verified: 2026-09-17 23:20; 461 tests actual/clean clone; approved correction and single fix review complete; actual green commit bound immediately after creation)

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
plus targeted Prettier/Markdown checks and unchanged frozen spec/expert identities.
No CLI placeholder exists at this checkpoint.

## Phase 2: Contained Immutable Snapshot Service

> **Phase baseline tree**: recorded at phase start by exec-plan
> **Lenses**: path security, deterministic identity, concurrent input changes

### Step 2.1: Specification Tests

**Reference**: `03-02`; ST-14–ST-31.

- [ ] 2.1.1 [spec-author] Author native discovery/path/inventory oracles — `compiler/src/project/{discovery,paths,inventory}.spec.test.ts`; ST-14–ST-22, ST-26–ST-27.
- [ ] 2.1.2 [spec-author] Author immutable identity/revalidation/diagnostic/no-output oracles — `compiler/src/project/{snapshot,diagnostics}.spec.test.ts`; ST-23–ST-31.
- [ ] 2.1.3 Demonstrate directed red tests before host/snapshot implementation — Phase 2 task evidence; ST-14–ST-31.

**Verify**: Directed Phase 2 spec paths; red expected, Phase 1 remains green.

### Step 2.2: Project Service Implementation

**Reference**: `03-02` Public Signatures/Discovery and Containment/Inventory and
Bounds/Snapshot and Identity; AR-P4–AR-P5.

- [ ] 2.2.1 Implement final source/snapshot/options/result records without mutable public buffers — `compiler/src/project/types.ts`; ST-24, ST-29–ST-31.
- [ ] 2.2.2 Implement nearest/explicit discovery and manifest-relative containment/output-state validation — `compiler/src/project/discovery.ts`, `paths.ts`; ST-14–ST-17.
- [ ] 2.2.3 Implement bounded exact-name inventory, aliases/cycles, and output exclusion — `compiler/src/project/inventory.ts`; ST-17–ST-22, ST-27.
- [ ] 2.2.4 Implement bounded regular-file reads, fatal UTF-8 and handle/path identity guards — `compiler/src/project/reads.ts`; ST-20, ST-24–ST-27, ST-31.
- [ ] 2.2.5 Implement full-attempt revalidation/retry and canonical snapshot input hashing — `compiler/src/project/snapshot.ts`; ST-23–ST-30.
- [ ] 2.2.6 Integrate public loadProject and frozen authority/build metadata exports — compiler barrel and `build-info.ts`; `03-02` Public Signatures; ST-01, ST-29–ST-31.
- [ ] 2.2.7 Run Phase 2 spec tests green and all Phase 1 regressions — directed new library/root suites; ST-01–ST-31.

**Verify**: Directed service spec paths, library build/typecheck, and root boundary
test. Expected user/host failures are values; no output is created.

### Step 2.3: Internal Tests and Service Checkpoint

- [ ] 2.3.1 Add internal tests for directory iteration, handle cleanup, unstable reads and retry seams — focused project `*.impl.test.ts`; `07` Test Ownership.
- [ ] 2.3.2 Run full foundation verification and independent phase review, resolve findings under policy and commit the green service — `03-02`; ST-01–ST-31.

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
plus targeted formatting/link checks and unchanged spec/expert/output checks.
Do not claim Windows qualification based on Linux results.

## Phase 3: CLI and Qualified Foundation Closeout

> **Phase baseline tree**: recorded at phase start by exec-plan
> **Lenses**: CLI truthfulness, native-host evidence, deferral expiry

### Step 3.1: Specification Tests

**Reference**: `03-03`; ST-32–ST-40.

- [ ] 3.1.1 [spec-author] Author CLI public/bin behavior oracles — `cli/src/cli.spec.test.ts`, `bin.spec.test.ts`; ST-32–ST-35.
- [ ] 3.1.2 [spec-author] Author host/configuration/frozen-ownership tests and declare the direct native/measurement/deferral inspection checklist — additions to `test/foundation.spec.test.ts` for ST-37–ST-38 and ST-40 facts; checklist in task evidence for ST-36/ST-39/ST-40 walk; unchanged Phase 1 expectations; approved PF-002.
- [ ] 3.1.3 Demonstrate directed red Phase 3 runnable oracles; record baseline-only passes and the declared later-evidence obligations — Phase 3 task evidence; ST-32–ST-35, ST-37–ST-38, ST-40 facts; inspection evidence not yet claimed.

**Verify**: Directed Phase 3 paths; red expected. Existing service stays green.

**Mechanical test-path correction:** use `cli.spec.test.ts` rather than the
inherited `main.spec.test.ts` slot. This keeps the new v4 oracle distinct from
the inventory-rejected v3 test without changing command behavior or weakening
the Phase 1 old-test absence assertion. Implementation remains `main.ts`.

### Step 3.2: Real Consumer and Native Integration

**Reference**: `03-03` CLI Shell/Example/Verification; AR-P5–AR-P7.

- [ ] 3.2.1 Add the behavior-owning CLI package/bin and reference/dependency declarations — CLI package/TS configs and real bin entry; root references; `03-01` Packages; ST-04, ST-07–ST-08, ST-32.
- [ ] 3.2.2 Implement the strict argument shell using public loadProject and shared diagnostic rendering — CLI `main.ts`, `args.ts`, `render.ts`; `03-03` CLI Shell; ST-32–ST-35.
- [ ] 3.2.3 Adapt the existing native-host CI job and add the minimal contained example — `.github/workflows/ci.yml`, example manifest/source; `03-03` Example/Verification; ST-33, ST-36–ST-38.
- [ ] 3.2.4 Update truthful current root/package guidance and active/reference-only ownership labels — `README.md`, project guidance/notes and inventory-approved labels; `03-01` Rejected Surface Removal; `03-03` Closeout; ST-03, ST-40.
- [ ] 3.2.5 Run all CLI/service/root runnable specification suites green, including built-bin E2E — new owned suite paths; ST-01–ST-35, ST-37–ST-38, ST-40 frozen/ownership facts; ST-36/ST-39/ST-40 walk remain mandatory later direct evidence, not premature runtime gates.

**Verify**: Directed CLI tests/bin E2E, library/CLI build/typecheck and boundary
tests. No shell construction or assembler/emulator execution.

### Step 3.3: Internal Tests, Native Qualification and Closeout

- [ ] 3.3.1 Add focused CLI adapter/internal-host tests and record real example phase-separated observations — CLI/project `*.impl.test.ts`, `08-closeout.md`; `03-03` Observations; ST-39.
- [ ] 3.3.2 Complete full native Linux/Windows foundation qualification, independent phase review and deferral-expiry closeout; commit green checkpoints and update the feature roadmap on actual completion — `08-closeout.md`, feature roadmap; `03-03` Verification/Closeout; ST-01–ST-40.

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
on both declared production hosts, then record those actual results and directly
inspect ST-36, ST-39, and ST-40's completed deferral walk. Also verify targeted
formatting/links, identity/topology and no-output checks. Every ST-01–ST-40
obligation must have its real test or inspection evidence before final review,
green commit, or Done. Missing native evidence blocks this last
task; no push or new external infrastructure is authorized to bypass that condition.

## Dependencies and Completion

RD-01 closed -> Phase 1 green foundation -> Phase 2 green service -> Phase 3 real
CLI and complete host evidence -> RD-02 Done -> RD-03 planning.

Completion means all tasks verified, RD-02 AC-01–AC-29 satisfied, independent
findings resolved/ruled under policy, frozen authorities unchanged, no dead or
future-placeholder package, no compiler artifact publication, and no expired
unowned deferral. Observational duration/memory values are never completion gates.
