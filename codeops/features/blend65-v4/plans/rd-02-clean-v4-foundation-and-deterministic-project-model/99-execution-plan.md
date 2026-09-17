# Execution Plan: RD-02 Foundation

> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-17 20:42
> **Progress**: 0/35 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement the owning RD through real behavior checkpoints, not a horizontal
compiler skeleton. Preflight must PASS before execution. Scope/authority is
[AR-P1–AR-P7](00-ambiguity-register.md); contracts and signatures are in the
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
contain only the owning RD, ST excerpts, public signatures, authority inventory,
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

> **Phase baseline tree**: recorded at phase start by exec-plan
> **Lenses**: migration safety, local input validation, public boundaries

### Step 1.1: Inventory and Specification Tests

**Reference**: `03-01` Inventory/First Green Checkpoint; `03-02` Manifest;
ST-01–ST-13. No implementation before the tests below.

- [ ] 1.1.1 Verify bootstrap/frozen identities and complete the component salvage inventory — `04-salvage-inventory.md`; `03-01` Inventory; ST-01–ST-02.
- [ ] 1.1.2 [spec-author] Author independent structural/import-boundary tests — `test/foundation.spec.test.ts`, `test/import-boundary.spec.test.ts`; ST-01–ST-08.
- [ ] 1.1.3 [spec-author] Author pure manifest/name/position tests — `packages/compiler/src/project/{manifest,basename,positions}.spec.test.ts`; ST-09–ST-13; `03-02` public signatures.
- [ ] 1.1.4 Demonstrate focused red tests before replacement; record already-passing baseline checks and proof each new oracle detects a contract violation — task evidence in this plan; ST-01–ST-13.

**Verify**: Run only the new explicit test paths with the available Vitest
executable. Red is expected here, not a commit checkpoint. No inherited suite.

### Step 1.2: Implement the Green Transition

**Reference**: `03-01` Packages/Root Toolchain/Rejected Surface Removal;
`03-02` Manifest/Project Diagnostics; AR-P3–AR-P6.

- [ ] 1.2.1 Remove exactly inventory-rejected v3 implementation/test/fixture/example/script/config surfaces; label retained historical CodeOps evidence and make root status truthful — exact inventory file groups; `03-01` Rejected Surface Removal; ST-03.
- [ ] 1.2.2 Replace root dependency/task ownership and pin the stable toolchain — `package.json`, `yarn.lock`, `turbo.json`; `03-01` Root Toolchain; ST-04, ST-08.
- [ ] 1.2.3 Configure the one real library package and strict project-reference build — compiler package/TS configs, root/base TS configs and `.nvmrc`; `03-01` Packages/Root Toolchain; ST-04, ST-07–ST-08.
- [ ] 1.2.4 Implement project diagnostic records/sorting and exact byte-position conversion — `compiler/src/project/diagnostics.ts`, `positions.ts`; `03-02` Public Signatures/Project Diagnostics; ST-10–ST-12.
- [ ] 1.2.5 Implement the pure name/schema contract and honest public manifest exports — `compiler/src/project/basename.ts`, `manifest.ts`, `types.ts`, library barrel; `03-02` Manifest; ST-09–ST-13.
- [ ] 1.2.6 Implement the direct import-boundary helper and focused root test discovery/ignored generated outputs — `test/import-boundary.ts`, root Vitest config, `.gitignore`; `03-01` Direct Boundary Test; ST-03–ST-08.
- [ ] 1.2.7 Run the new Phase 1 specification tests green; fix production only — directed Phase 1 paths; ST-01–ST-13.

Task 1.2.1 is mechanical inventory-backed removal, not a port/refactor. Review
the exact target list before removal; do not split it into hundreds of per-file
microtasks or use a broad unresolved destructive target. Small declarative tool
config edits form one build concern. If a production logic task exceeds normal
reviewable size, split that implementation task before executing it, preserving
the spec-first dependency and updating this sole checklist.

**Verify**: Directed new tests plus currently owned library build/typecheck.
The complete checkpoint command below must pass before the transition is committed.

### Step 1.3: Internal Tests and First Green Checkpoint

- [ ] 1.3.1 Add focused implementation tests for JSONC/offset/name/diagnostic/import-reader internals — corresponding `*.impl.test.ts` files; `07` Test Ownership; do not alter spec tests.
- [ ] 1.3.2 Run full foundation verification and independent phase review, resolve findings under the project policy, commit the first green foundation and bind inventory proof — `04-salvage-inventory.md`; `03-01` First Green Checkpoint; ST-01–ST-13.

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

- [ ] 3.1.1 [spec-author] Author CLI public/bin behavior oracles — `cli/src/main.spec.test.ts`, `bin.spec.test.ts`; ST-32–ST-35.
- [ ] 3.1.2 [spec-author] Author host/configuration/measurement/closeout obligations before their implementation — additions to `test/foundation.spec.test.ts`; ST-36–ST-40; unchanged Phase 1 expectations.
- [ ] 3.1.3 Demonstrate directed red Phase 3 oracles; record baseline-only passes — Phase 3 task evidence; ST-32–ST-40.

**Verify**: Directed Phase 3 paths; red expected. Existing service stays green.

### Step 3.2: Real Consumer and Native Integration

**Reference**: `03-03` CLI Shell/Example/Verification; AR-P5–AR-P7.

- [ ] 3.2.1 Add the behavior-owning CLI package/bin and reference/dependency declarations — CLI package/TS configs and real bin entry; root references; `03-01` Packages; ST-04, ST-07–ST-08, ST-32.
- [ ] 3.2.2 Implement the strict argument shell using public loadProject and shared diagnostic rendering — CLI `main.ts`, `args.ts`, `render.ts`; `03-03` CLI Shell; ST-32–ST-35.
- [ ] 3.2.3 Adapt the existing native-host CI job and add the minimal contained example — `.github/workflows/ci.yml`, example manifest/source; `03-03` Example/Verification; ST-33, ST-36–ST-38.
- [ ] 3.2.4 Update truthful current root/package guidance and active/reference-only ownership labels — `README.md`, project guidance/notes and inventory-approved labels; `03-01` Rejected Surface Removal; `03-03` Closeout; ST-03, ST-40.
- [ ] 3.2.5 Run all CLI/service/root specification suites green, including built-bin E2E — new owned suite paths; ST-01–ST-40.

**Verify**: Directed CLI tests/bin E2E, library/CLI build/typecheck and boundary
tests. No shell construction or assembler/emulator execution.

### Step 3.3: Internal Tests, Native Qualification and Closeout

- [ ] 3.3.1 Add focused CLI adapter/internal-host tests and record real example phase-separated observations — CLI/project `*.impl.test.ts`, `08-closeout.md`; `03-03` Observations; ST-39.
- [ ] 3.3.2 Complete full native Linux/Windows foundation qualification, independent phase review and deferral-expiry closeout; commit green checkpoints and update the feature roadmap on actual completion — `08-closeout.md`, feature roadmap; `03-03` Verification/Closeout; ST-01–ST-40.

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
on both declared production hosts, plus targeted formatting/links, identity/topology,
no-output and deferral-expiry checks. Missing native evidence blocks this last
task; no push or new external infrastructure is authorized to bypass that condition.

## Dependencies and Completion

RD-01 closed -> Phase 1 green foundation -> Phase 2 green service -> Phase 3 real
CLI and complete host evidence -> RD-02 Done -> RD-03 planning.

Completion means all tasks verified, RD-02 AC-01–AC-29 satisfied, independent
findings resolved/ruled under policy, frozen authorities unchanged, no dead or
future-placeholder package, no compiler artifact publication, and no expired
unowned deferral. Observational duration/memory values are never completion gates.
