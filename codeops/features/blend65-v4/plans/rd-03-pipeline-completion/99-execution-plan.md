# Execution Plan: RD-03 Pipeline Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-21 20:43
> **Progress**: 59/79 tasks (75%)
> **CodeOps Artifact Schema**: 1

## Execution Rules

Execute only after preflight passes. Use specification-first order in every phase: immutable
requirements-derived tests, recorded RED, implementation, GREEN, implementation tests, then the
phase quality review. Each task owns at most three focused files. Split only when the code-size or
single-responsibility rule requires it; do not introduce another layer to make tasks look smaller.

The checklist below is the sole progress authority. On implementation, mark the task `[~]` with the
host timestamp; after verification, promote it to `[x]`. Only `[x]` counts as complete. Update
Progress and Last Updated after every task. Resume the first `[~]`, otherwise the first `[ ]`, in
document order. Mark a genuine blocker `[!]` with its reason on the task line. Commit each coherent
green checkpoint without asking and never push. Keep `spec/` unchanged and update the feature
roadmap at lifecycle transitions.

Every phase checkpoint runs
`yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test` plus that phase's
directed, boundary and tool cases. This is verification, not authority to broaden a phase.

Specification-test authors receive only the cited requirement/design excerpts and public
signatures. They must not open the phase's production implementation files. Record the oracle hash
and behavioral RED before implementation. A failing immutable specification test means production
is wrong unless the user explicitly authorizes an oracle correction.

The eight phases match real ownership boundaries. They do not authorize a pass framework, target
registry, asset framework, readiness product or package-per-stage split. Only
`@blend65/language-server` and `@blend65/vscode` are new workspaces (AR-C2, AR-C10).

## Phase Summary

| Phase | Deliverable | Tasks |
|---|---|---:|
| 1 | Frozen M1 inputs, selected profile and raw asset | 12 |
| 2 | Semantic operations, explicit CFG and whole-program closure | 8 |
| 3 | SFA and ABI closure engine | 8 |
| 4 | Legal 6510 machine program and platform layout | 12 |
| 5 | ACME artifacts and atomic publication | 10 |
| 6 | Compiler services and CLI | 9 |
| 7 | Diagnostics-only editor bundle | 11 |
| 8 | Full M1 ACME/VICE qualification and handoff | 9 |

## Phase 1: Frozen Inputs, Profile and Raw Asset

> **Phase baseline tree**: `6a78205f495e68394f9647a165cbaf69ebd49600`
> **Scope mode**: strict
> **Expected modification set**: `examples/m1/`; focused compiler profile/asset/frontend files;
> this plan's progress/review evidence and feature roadmap. No backend lowering, publication,
> editor workspace, frozen specification or sibling requirement changes.
> **Lenses**: correctness, api-surface, security, simplicity

### Step 1.1: Specification Tests

- [x] 1.1.1 [spec-author] Write ST-55 frontend-profile specification cases —
  `packages/compiler/src/frontend/profile.spec.test.ts`; forbidden: production compiler files. ✅
  (completed: 2026-09-20 01:47 CEST)
- [x] 1.1.2 [spec-author] Write ST-66–ST-68/ST-96 raw-asset cases —
  `packages/compiler/src/assets/raw-asset.spec.test.ts`; forbidden: production compiler files. ✅
  (completed: 2026-09-20 01:47 CEST)
- [x] 1.1.3 [spec-author] Write ST-97–ST-98 independent behavior cases —
  `test/m1/behavior.spec.test.ts`; forbidden: production compiler code and generated output. ✅
  (completed: 2026-09-20 01:47 CEST)
- [x] 1.1.4 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-20 01:47 CEST)

#### Phase 1 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/frontend/profile.spec.test.ts` | `84b5e70c37f725b62877f024bbc37d62ab595002e93f40532d57b963366a4b8e` | Missing planned `frontend/profile.ts` |
| `packages/compiler/src/assets/raw-asset.spec.test.ts` | `c8e2ea5240706b464bd4f53f2b8445ed103f91c177702bc494c6286b7e33d053` | Missing planned `assets/raw-asset.ts` |
| `test/m1/behavior.spec.test.ts` | `942a83d5bf0bf278549e36f1a2defe9d0ea275f985bcb47fa279b8a9efd43062` | Missing planned M1 recipe/oracle modules |

The compiler-package and root Vitest commands failed at collection only on those absent production
modules. No production file existed or was read by the specification-test author before this
checkpoint. These three test files are immutable implementation inputs from this point onward.
The behavior test hash was re-frozen once after its author corrected two requirement-preserving
harness mistakes: Node `Buffer` versus `Uint8Array` comparison and the trace's actual fresh-fire
frame (440, not 432). The behavior and expected bytes did not change.

### Step 1.2: Implementation

- [x] 1.2.1 Add the readable M1 manifest/source skeleton —
  `examples/m1/blend65.json`, `examples/m1/src/game.blend`.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.2.2 Add the deterministic raw-sprite recipe and its exact output —
  `examples/m1/qualification/sprite-recipe.ts`, `examples/m1/assets/sprites.bin`; this is raw-fixture
  evidence only and does not pull SpritePad work forward from RD-06.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.2.3 Add the independent fixed trace, pure behavior model and provenance notes —
  `examples/m1/qualification/{win-trace.json,oracle.ts,README.md}`.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.2.4 Implement the one selected frontend profile declaration environment and exact M1 API
  identities — `packages/compiler/src/frontend/{profile.ts,semantic-types.ts}`; AR-C5/AR-C17.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.2.5 Implement the literal raw-asset resolver and immutable asset identity/value —
  `packages/compiler/src/assets/{raw-asset.ts,asset-types.ts}`; AR-C6/AR-C14.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.2.6 Complete frontend embed/profile obligations without leaking target facts into typed source
  semantics — `packages/compiler/src/frontend/{analyzer.ts,service.ts,analysis-result.ts}`.
  ✅ (completed: 2026-09-20 02:18 CEST)

### Step 1.3: Implementation Tests and Hardening

- [x] 1.3.1 Reach GREEN; add focused implementation tests for identity races, containment and recipe
  determinism — `packages/compiler/src/assets/raw-asset.impl.test.ts`,
  `test/m1/behavior.impl.test.ts`; run phase qualification.
  ✅ (completed: 2026-09-20 02:18 CEST)
- [x] 1.3.2 Record independent phase review, simplicity check and corrections —
  `08-phase-1-review.md`; commit green checkpoint.
  ✅ (completed: 2026-09-20 02:18 CEST)

Deliverable: requirements-frozen M1 inputs and one proved raw asset/profile frontend boundary.

## Phase 2: Semantic CFG and Whole Program

> **Phase baseline tree**: `72de8f80050130febcd1df14f2bd8ae45b3e6ee5`
> **Scope mode**: strict
> **Expected modification set**: focused `packages/compiler/src/semantic/` files and tests; the
> necessary review correction in `packages/compiler/src/frontend/{effects.ts,profile.impl.test.ts}`;
> plan evidence/roadmap. No storage homes, opcodes, target addresses, packages or artifacts.
> **Lenses**: correctness, semantics, api-surface, simplicity

### Step 2.1: Specification Tests

- [x] 2.1.1 [spec-author] Write ST-49–ST-54/ST-56 —
  `packages/compiler/src/semantic/{operations,cfg,whole-program}.spec.test.ts`; forbidden:
  production semantic modules. ✅ (completed: 2026-09-20 02:30 CEST)
- [x] 2.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-20 02:30 CEST)

#### Phase 2 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/semantic/operations.spec.test.ts` | `46c2adec9e4295503f7b4ba7b55fe6f612804a6bb97091e57b767b8df895b25d` | Missing planned `semantic/lower.ts` |
| `packages/compiler/src/semantic/cfg.spec.test.ts` | `49dc4598ac56613cbe627d52f3b5e3017e82cd6c4d3feac4af732a18eb6d11b1` | Missing planned `semantic/lower.ts` |
| `packages/compiler/src/semantic/whole-program.spec.test.ts` | `b4352c0deefb970f1f2ae49bf21428b87bc4d46f8f643d13d576f286c51c2220` | Missing planned semantic modules |

The compiler Vitest command failed at collection only on the absent Phase 2 production modules;
zero tests executed. The author read no forbidden semantic production file. These three files are
immutable implementation inputs from this point onward.

### Step 2.2: Implementation

- [x] 2.2.1 Define the minimum semantic operation, place/effect and CFG unions —
  `packages/compiler/src/semantic/{operations.ts,cfg.ts}`. ✅
  (completed: 2026-09-20 03:07 CEST)
- [x] 2.2.2 Lower completed typed functions to operations/edges —
  `packages/compiler/src/semantic/{lower.ts,cfg.ts}`. ✅
  (completed: 2026-09-20 03:07 CEST)
- [x] 2.2.3 Preserve exact evaluation, value/place identity, spans and volatile effects —
  `packages/compiler/src/semantic/lower.ts`. ✅
  (completed: 2026-09-20 03:07 CEST)
- [x] 2.2.4 Close all whole-program roots/edges and reject cycles/unknowns —
  `packages/compiler/src/semantic/whole-program.ts`. ✅
  (completed: 2026-09-20 03:07 CEST)

### Step 2.3: Implementation Tests and Hardening

- [x] 2.3.1 Reach GREEN; add graph/order/poison tests —
  `packages/compiler/src/semantic/{cfg,whole-program}.impl.test.ts`; run phase qualification. ✅
  (completed: 2026-09-20 03:07 CEST)
- [x] 2.3.2 Record independent correctness/semantics review and corrections —
  `08-phase-2-review.md`; commit green checkpoint. ✅
  (completed: 2026-09-20 03:12 CEST)

Deliverable: one target-neutral whole semantic program with explicit CFG and complete direct edges.

## Phase 3: SFA and ABI Closure Engine

> **Phase baseline tree**: `03757f7c2e99514d3fa8162720ab2167a257601a`
> **Scope mode**: strict
> **Expected modification set**: focused `packages/compiler/src/storage/` and ABI files/tests;
> plan evidence/roadmap. No layout addresses, ACME, publication or runtime library.
> **Lenses**: correctness, semantics, resource ownership, simplicity

### Step 3.1: Specification Tests

- [x] 3.1.1 [spec-author] Write ST-57–ST-60, ST-62 and the SFA-only half of ST-63 —
  `packages/compiler/src/storage/{sfa,closure}.spec.test.ts`; forbidden: production storage/ABI
  modules. ✅ (completed: 2026-09-20 03:29 CEST)
- [x] 3.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-20 03:29 CEST)

#### Phase 3 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/storage/sfa.spec.test.ts` | `9c325b9fa5a042fadc604a3b92e6da23ea997b8bac13c2b1aa9f72ad05e316cc` | Missing planned `storage/allocate.ts` |
| `packages/compiler/src/storage/closure.spec.test.ts` | `2f1c36987150876e0cf04e3b968c304ac0c382b651a4eb3213aa42f092bb6609` | Missing planned `storage/allocate.ts` |

The compiler Vitest command failed at collection only on the absent Phase 3 production modules;
zero tests executed. The author read no forbidden storage production file. Before freezing, the
oracle was narrowed so ordinary immediate/register values do not acquire needless RAM homes and
only an explicit required pointer requests zero page. These two files are immutable implementation
inputs from this point onward. The current frontend has no enum semantic type, so the ABI oracle
covers the representable byte/sbyte/boolean and word/sword result classes without inventing a type.

### Step 3.2: Implementation

- [x] 3.2.1 Define request, lifetime/interference, home and certificate records —
  `packages/compiler/src/storage/{storage-types.ts,interference.ts}`.
  (completed: 2026-09-20 03:45 CEST)
- [x] 3.2.2 Inventory parameters, result locations/required return staging, locals, temporaries,
  argument staging and pointer/helper demand — `packages/compiler/src/storage/inventory.ts`.
  (completed: 2026-09-20 03:45 CEST)
- [x] 3.2.3 Implement deterministic overlay/placement and conflicts —
  `packages/compiler/src/storage/{interference.ts,allocate.ts}`.
  (completed: 2026-09-20 03:45 CEST)
- [x] 3.2.4 Implement bounded monotonic re-close and provisional certificate construction —
  `packages/compiler/src/storage/closure.ts`.
  (completed: 2026-09-20 03:45 CEST)

### Step 3.3: Implementation Tests and Hardening

- [x] 3.3.1 Reach GREEN; add determinism/nonconvergence/stack tests —
  `packages/compiler/src/storage/{sfa,closure}.impl.test.ts`; run phase qualification.
  (completed: 2026-09-20 03:45 CEST)
- [x] 3.3.2 Record independent correctness/semantics review and corrections —
  `08-phase-3-review.md`; commit green checkpoint. ✅
  (completed: 2026-09-20 09:29 CEST)

Deliverable: complete provisional storage inventory/placement plus the bounded closure engine;
Phase 4 supplies real machine demand and freezes the final certificate before layout.

## Phase 4: Machine Lowering and Platform Layout

> **Phase baseline tree**: `c5c117a4bb72c4ab1be4aaff4d55ea11c0ad8342`
> **Scope mode**: strict
> **Expected modification set**: focused `compiler/src/{target,machine,layout,storage}/` files and tests;
> plan evidence/roadmap. No optional optimizer, textual pseudo-assembly, generic target registry or
> publication code.
> **Lenses**: correctness, 6502 semantics, expert output, simplicity

### Step 4.1: Specification Tests

- [x] 4.1.1 [spec-author] Write ST-69–ST-74 machine-lowering cases —
  `packages/compiler/src/machine/lowering.spec.test.ts`; forbidden: production backend modules. ✅
  (completed: 2026-09-20 09:50 CEST)
- [x] 4.1.2 [spec-author] Write ST-61, the layout half of ST-63, ST-64–ST-65 and ST-75–ST-76
  integration/startup/layout cases — `packages/compiler/src/storage/closure-integration.spec.test.ts`,
  `packages/compiler/src/target/profile.spec.test.ts`,
  `packages/compiler/src/layout/c64-layout.spec.test.ts`; forbidden: production backend modules. ✅
  (completed: 2026-09-20 09:50 CEST)
- [x] 4.1.3 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-20 09:50 CEST)

#### Phase 4 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/machine/lowering.spec.test.ts` | `f10ec0db94825c7b5252b20d42f4661f0e55cb63aaa3cd89728fab121706d018` | Missing planned `target/profile.ts` |
| `packages/compiler/src/storage/closure-integration.spec.test.ts` | `d369a176c80a7f8aa9f227f324075f91f3a51ad2697472a7df38a90e2ed03197` | Missing planned `machine/bind.ts` |
| `packages/compiler/src/target/profile.spec.test.ts` | `5439c26dff38d584752bb7cf70b8488055b68c19110f9cc6b7854052cbff271c` | Missing planned `target/profile.ts` |
| `packages/compiler/src/layout/c64-layout.spec.test.ts` | `ad15651d2b50278644cd8057e770a6d6fd817987d446e5d5a8a576af015f6caa` | Missing planned `target/profile.ts` |

The directed compiler command failed at collection only on the absent Phase 4 production modules;
zero tests executed. The specification-test author read no forbidden backend production file. A
pre-freeze correction removed an invalid requirement that every signed comparison consume overflow:
sign normalization and sign splitting remain legal, while any actual overflow use must follow its
own definition. These four test files are immutable implementation inputs from this point onward.

### Step 4.2: Implementation

- [x] 4.2.1 Add direct selected CPU/machine/serializer/packager facts —
  `packages/compiler/src/target/{nmos6510.ts,c64-pal-kernal.ts,profile.ts}`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.2 Define structured machine records and legality validation —
  `packages/compiler/src/machine/{machine-types.ts,validate.ts}`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.3 Lower scalar/aggregate/call/control operations with explicit flags, widths and byte/word
  order — `packages/compiler/src/machine/{lower.ts,lower-control.ts}`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.4 Lower raw PEEK/POKE and named C64 operations —
  `packages/compiler/src/machine/{lower-memory.ts,lower-c64.ts}`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.5 Bind resources and choose legal candidate forms —
  `packages/compiler/src/machine/bind.ts`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.6 Feed every real binder/legalizer request through the closure engine and freeze the final
  storage certificate — `packages/compiler/src/machine/bind.ts`,
  `packages/compiler/src/storage/closure.ts`. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.2.7 Repair branches and implement startup/return plus deterministic non-overlapping
  C64/VIC-aware layout and sprite blocks — `packages/compiler/src/machine/block-layout.ts`,
  `packages/compiler/src/layout/{startup.ts,c64-layout.ts}`. ✅
  (completed: 2026-09-20 18:29 CEST)

### Step 4.3: Implementation Tests and Hardening

- [x] 4.3.1 Reach GREEN; add instruction/cycle/edge tests —
  `packages/compiler/src/machine/lowering.impl.test.ts`,
  `packages/compiler/src/layout/c64-layout.impl.test.ts`; run phase qualification. ✅
  (completed: 2026-09-20 18:29 CEST)
- [x] 4.3.2 Record independent 6502-semantics/expert review and corrections —
  `08-phase-4-review.md`; commit green checkpoint. ✅
  (completed: 2026-09-20 18:29 CEST)

Deliverable: a closed legal documented-NMOS machine program and exact final C64 layout.

## Phase 5: ACME Artifacts and Publication

> **Phase baseline tree**: `5693703d9dd2c7eaff74e821d384a8173c860d7b`
> **Scope mode**: strict
> **Expected modification set**: focused `compiler/src/{artifacts,publication,tools}/` files/tests;
> plan evidence/roadmap. No build system, cache, database, generic schema or readiness service.
> **Lenses**: correctness, security, concurrency, artifact integrity, simplicity

### Step 5.1: Specification Tests

- [x] 5.1.1 [spec-author] Write ST-77–ST-87 — ✅ (completed: 2026-09-21 01:49 CEST)
  `packages/compiler/src/{artifacts/acme,artifacts/evidence,publication/publication}.spec.test.ts`;
  forbidden: production artifact/publication/tool modules.
- [x] 5.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-21 01:50 CEST)

#### Phase 5 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/artifacts/acme.spec.test.ts` | `70b2660a5c5533fda9eb1d053e9961b4bdd2d3eb61a98e9f47dcf486c9d62835` | Missing planned `tools/acme.ts` |
| `packages/compiler/src/artifacts/evidence.spec.test.ts` | `5ca2aa8b99406d529c7bd7a4a34d1e5a7b5a452d98ab7160b03860bf790c43fb` | Missing planned `artifacts/evidence.ts` |
| `packages/compiler/src/publication/publication.spec.test.ts` | `f0ee374cd3f0735109216dd369976c9db148c6cf8ea7a3f6fba58b731abcaf2a` | Missing planned `artifacts/evidence.ts`; authorized `access()` → `lstat()` helper correction plus cancellation-after-rename, cleanup pin-rescan and pin-replacement regressions preserve and strengthen the accepted publication contract |

The compiler-package command failed at collection only on the three absent Phase 5 production
modules while all 58 pre-existing suites and 931 tests passed. The 13 new cases did not execute.
The specification-test author read no forbidden artifact, publication or tool production file.
These three files are immutable implementation inputs from this point onward.

### Step 5.2: Implementation

- [x] 5.2.1 Implement terminal ACME serialization/form validation — ✅
  (completed: 2026-09-21 01:53 CEST)
  `packages/compiler/src/artifacts/{acme-serializer.ts,acme-validate.ts}`.
- [x] 5.2.2 Implement ACME 0.97 discovery/invocation/cleanup — ✅
  (completed: 2026-09-21 01:58 CEST)
  `packages/compiler/src/tools/{discovery.ts,acme.ts}`.
- [x] 5.2.3 Verify reports/symbols/bytes/segments/PRG/assets — ✅
  (completed: 2026-09-21 02:02 CEST)
  `packages/compiler/src/artifacts/{acme-output.ts,prg.ts}`.
- [x] 5.2.4 Implement direct canonical sidecars and cross-hashes — ✅
  (completed: 2026-09-21 02:08 CEST)
  `packages/compiler/src/artifacts/{evidence.ts,evidence-types.ts}`.
- [x] 5.2.5 Implement staging/generation/current commit — ✅
  (completed: 2026-09-21 02:13 CEST)
  `packages/compiler/src/publication/{publication.ts,current-record.ts}`; revalidate output-root
  containment and ancestor identity at every mutation boundary.
- [x] 5.2.6 Implement the exact directory lock, independent pins, predecessor retention and fail-closed
  cleanup — ✅ (completed: 2026-09-21 09:51 CEST)
  `packages/compiler/src/publication/{lock.ts,pins.ts,cleanup.ts}`.

#### Phase 5 immutable-oracle blocker

Publication specification cases passed through atomic commit, competing publication, independent
pins, retention and cancellation. The malformed-pin case left its dangling symlink untouched, but
its `exists()` helper used `fs.access()`, which follows the dangling target and therefore reported
`false`. The user authorized the smallest mechanical correction on 2026-09-21: check directory
entry existence with `lstat()` without changing the security expectation.

### Step 5.3: Implementation Tests and Hardening

- [x] 5.3.1 Reach GREEN with real ACME/filesystem/process/concurrency and ancestor-swap tests — ✅
  (completed: 2026-09-21 09:57 CEST)
  `packages/compiler/src/{artifacts/acme,publication/publication}.impl.test.ts`; qualify phase.

Phase qualification after accepted review corrections: install, build and typecheck passed; all 64
compiler suites and 966 tests, all 5 CLI suites and 61 tests, and all 5 root suites and 52 tests
passed, including real ACME 0.97 and filesystem/concurrency cases. Prettier and `git diff --check`
passed; `spec/` remained untouched. The checkout has no root, Turbo or compiler `lint` task, so no
lint command exists despite the stale project-guidance entry.
- [x] 5.3.2 Record independent correctness/security/concurrency review and corrections — ✅
  `08-phase-5-review.md`; commit green checkpoint.
  (completed: 2026-09-21 11:21 CEST)

Deliverable: one verified eight-file immutable generation published atomically.

## Phase 6: Compiler Services and CLI

> **Phase baseline tree**: `9e41226584cfe2b685b685666b1b2a934d5ba6e0`
> **Scope mode**: strict
> **Expected modification set**: compiler public/service files, CLI files/tests, manifests only when
> required; the AR-C31 frontend/semantic address-of prerequisite and focused oracle; plan
> evidence/roadmap. No editor work, daemon or command framework.
> **Lenses**: correctness, api-surface, security, simplicity

### Step 6.1: Specification Tests

- [x] 6.1.1 [spec-author] Write ST-88–ST-90 — ✅
  `packages/compiler/src/services/services.spec.test.ts`, `packages/cli/src/commands.spec.test.ts`;
  forbidden: production compiler-service and CLI files. (completed: 2026-09-21 11:55 CEST)
- [x] 6.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`. ✅
  (completed: 2026-09-21 11:56 CEST)

#### Phase 6 immutable RED checkpoint

| Specification oracle | SHA-256 | RED evidence |
|---|---|---|
| `packages/compiler/src/services/services.spec.test.ts` | `f2048ff99115daa4fc9546d7de5ec5c919ba241ac25bc83e676a561844962b26` | 6/6 cases fail only because the planned public compiler service exports are absent |
| `packages/cli/src/commands.spec.test.ts` | `3055c847430ec3b2195bf0741d54c20adf7dd466717a96bb773a6d566746ab46` | 26/26 cases fail only because the planned package-internal `run.ts` command seam is absent; AR-C32 later corrected only the cancellation test's start synchronization without changing its assertions |
| `packages/compiler/src/frontend/address-of.spec.test.ts` | `a1ff43c5fb3661d4b1dffeb9d4d03a3fdc9e83ec02d4f43755645324dcf1a55d` | 3/3 cases fail because address-of is deferred instead of completing the resident embedded place or reporting E10040/E10043 |

Both directed package commands reached behavioral RED. Prettier, whitespace and the documentation-
ban check passed. The implementation-blind author read no forbidden compiler-service or CLI
production file. These two files are immutable implementation inputs from this point onward.
The authorized AR-C31 prerequisite oracle was added independently under the same immutable rule.

### Step 6.2: Implementation

- [x] 6.2.1 Implement typed check/build/run results and cancellation — ✅
  `packages/compiler/src/services/{types.ts,services.ts}`; first apply the authorized AR-C31 direct
  address-of prerequisite correction and focused regression. The first real M1 ACME journey also
  corrected the existing serializer's accidental indirect parentheses and removed the redundant
  embedded-asset global; the resident bytes now have one identity and one placement.
  (completed: 2026-09-21 12:56 CEST)
- [x] 6.2.2 Export the backend-free `@blend65/compiler/frontend` subpath, including the existing safe
  `loadProject` entry/types, and extend transitive boundary proof —
  `packages/compiler/{package.json,src/frontend/index.ts}`, `test/import-boundary.ts`. ✅
  (completed: 2026-09-21 12:56 CEST)
- [x] 6.2.3 Wire the typed services into the compiler package root —
  `packages/compiler/src/index.ts`. ✅
  (completed: 2026-09-21 12:56 CEST)
- [x] 6.2.4 Map CLI commands/options/signals/output and the exact numeric exit table —
  `packages/cli/src/{args.ts,run.ts,render.ts}`. ✅ (completed: 2026-09-21 13:09 CEST;
  verification resumed after AR-C32 authorization)
- [x] 6.2.5 Wire CLI public/main/bin entry points to the command runner —
  `packages/cli/src/{index.ts,main.ts,bin.ts}`. ✅ (completed: 2026-09-21 13:11 CEST)

### Step 6.3: Implementation Tests and Hardening

- [x] 6.3.1 Reach GREEN; add fresh-build/stale-output/cancellation implementation tests and qualify
  compiler/CLI — `packages/compiler/src/services/services.impl.test.ts`,
  `packages/cli/src/commands.impl.test.ts`; run boundaries. ✅ (completed: 2026-09-21 13:21 CEST)

Phase qualification before independent review: frozen install, build and typecheck passed; all 67
compiler suites and 977 tests, all 7 CLI suites and 60 tests, and all 5 root suites and 52 tests
passed. Directed service tests passed 8/8 and frontend address tests passed 23/23. Prettier and
`git diff --check` passed; `spec/` remained untouched. The first full run caught and corrected one
function-address deferral regression before this green checkpoint.
- [x] 6.3.2 Record independent API/security review and corrections — `08-phase-6-review.md`; commit
  green checkpoint. ✅ (completed: 2026-09-21 20:43 CEST; all eight accepted findings corrected,
  complete Phase 6 gate green, no third review cycle)

Final Phase 6 qualification: frozen install, build and typecheck passed; all 67 compiler suites and
983 tests, all 7 CLI suites and 60 tests, and all 5 root suites and 52 tests passed. Touched-file
Prettier, `git diff --check`, immutable-oracle hashes and the frozen `spec/` check passed. The
checkout has no lint script or Turbo lint task, so no lint result is claimed.

Deliverable: truthful library and CLI check/build/run journeys.

## Phase 7: Diagnostics-Only Editor Bundle

> **Scope mode**: strict
> **Expected modification set**: new `packages/language-server/`, `packages/vscode/`, compiler
> frontend-overlay files/tests, root workspace lock/config and boundary tests; plan evidence/roadmap.
> Only the runtime/build dependencies in AR-C10 plus the VS Code host type package needed to
> compile the extension are allowed. No additional runtime or framework is introduced.
> **Lenses**: correctness, api-surface, security, package boundaries, simplicity

### Step 7.1: Specification Tests

- [ ] 7.1.1 [spec-author] Apply the pre-authorized requirement-supersession correction to only the
  stale two-workspace/no-Vite/no-ACME foundation assertions, replacing them with the exact four
  workspaces, editor-only Vite and Linux-CI-only ACME rule; write ST-91 —
  `test/foundation.spec.test.ts`, `test/rd03-import-boundary.spec.test.ts`; forbidden: production
  editor/overlay implementations and every unrelated foundation expectation.
- [ ] 7.1.2 [spec-author] Write ST-92–ST-95 —
  `packages/language-server/src/server.spec.test.ts`, `packages/vscode/src/extension.spec.test.ts`;
  forbidden: production editor/overlay implementations.
- [ ] 7.1.3 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 7.2: Implementation

- [ ] 7.2.1 Implement bounded overlays, unpaired-Unicode rejection and UTF-8-to-UTF-16 mapping using
  RD-02's 4 MiB/source, 10,000-source and 256 MiB/project limits —
  `packages/compiler/src/frontend/{overlay.ts,positions.ts,service.ts}`.
- [ ] 7.2.2 Add the stdio diagnostics server with one trailing-edge queue per project, snapshot-I/O
  cancellation, post-yield stale-result suppression and an explicit Node Vite bundle —
  `packages/language-server/src/server.ts`, `packages/language-server/vite.config.ts`.
- [ ] 7.2.3 Add the thin VS Code client entry and explicit Node Vite bundle —
  `packages/vscode/src/extension.ts`, `packages/vscode/vite.config.ts`.
- [ ] 7.2.4 Activate the language-server workspace with its exact manifest/dependencies, TypeScript
  project and lockfile update — `packages/language-server/{package.json,tsconfig.json}`, `yarn.lock`.
- [ ] 7.2.5 Activate the VS Code workspace with its exact manifest/dependencies, host type package,
  TypeScript project and lockfile update — `packages/vscode/{package.json,tsconfig.json}`, `yarn.lock`.
- [ ] 7.2.6 Add both projects to the root TypeScript graph and provision
  checksum-pinned ACME 0.97 only on the Linux CI leg so the real ACME tier is required there —
  `tsconfig.json`, `.github/workflows/ci.yml`.

### Step 7.3: Implementation Tests and Hardening

- [ ] 7.3.1 Reach GREEN; add editor implementation cases —
  `packages/language-server/src/server.impl.test.ts`,
  `packages/vscode/src/extension.impl.test.ts`; run stdio/bundle/boundary qualification.
- [ ] 7.3.2 Record independent boundary/security review and corrections — `08-phase-7-review.md`;
  commit green checkpoint.

Deliverable: a real minimal VS Code diagnostic bundle with no backend dependency.

## Phase 8: M1 End-to-End Qualification and Handoff

> **Scope mode**: strict
> **Expected modification set**: `examples/m1/qualification/`, focused `test/m1/` helpers/tests,
> closeout/review evidence, this plan and feature roadmap. Production corrections remain confined to
> their owning prior modules. No SpritePad, optimizer, C64U implementation or Windows substitute.
> **Lenses**: correctness, 6502 semantics, expert output, runtime evidence, simplicity

### Step 8.1: Specification Oracles and Tests

- [ ] 8.1.1 Finalize the independent expert ACME twin before inspecting generated M1 assembly; freeze
  its hash and comparison ledger — `examples/m1/qualification/{expert-m1.asm,expert-ledger.json}`.
- [ ] 8.1.2 [spec-author] Complete ST-99–ST-102 around the frozen oracle/twin; forbidden: compiler
  production code and generated output as an expectation source —
  `test/m1/{pipeline,vice}.spec.test.ts`.
- [ ] 8.1.3 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 8.2: Implementation

- [ ] 8.2.1 Complete M1 against only admitted modern APIs —
  `examples/m1/src/game.blend`; remove no oracle obligation.
- [ ] 8.2.2 Implement the small AR-C11 VICE qualification helper —
  `test/m1/{vice-monitor.ts,vice-driver.ts}`; use the exact `-default`-first argument array and prove
  Linux child/socket ownership before sending monitor commands.
- [ ] 8.2.3 Run the immutable specification tests to GREEN for pure M1, real ACME 0.97 and the
  sequential VICE 3.10 fixed-trace journey; edit implementation/evidence only and record
  `VICE-verified / hardware-unverified` — run-only inputs:
  `test/m1/{pipeline,vice}.spec.test.ts`.

### Step 8.3: Implementation Tests and Hardening

- [ ] 8.3.1 Compare generated output with the expert twin. Fail worse output; for any genuine meet-only
  result create the authorized issue — `examples/m1/qualification/expert-ledger.json`.
- [ ] 8.3.2 Run final Linux acceptance, touched formatting, frozen-spec check, C64U seam review and
  independent review — `08-phase-8-review.md`; correct all critical/major findings.
- [ ] 8.3.3 Write closeout evidence and deferral-expiry audit; keep AR-C16 assigned to RD-10, update the
  feature roadmap — `08-closeout.md`, `codeops/features/blend65-v4/00-roadmap.md`; commit the final
  green RD-03 Linux checkpoint without pushing.

Deliverable: the real playable M1 pipeline is Linux-qualified; only named native-Windows evidence
remains deferred to RD-10.

## Dependencies

| Phase | Requires | Reason |
|---|---|---|
| 1 | Completed frontend/RD-02 snapshot | Freezes real inputs and closes profile/asset frontend obligations |
| 2 | Phase 1 | Semantic lowering consumes the completed typed program |
| 3 | Phase 2 | SFA consumes the closed whole semantic program |
| 4 | Phase 3 | Machine binding must return storage demand before closure freezes |
| 5 | Phase 4 | ACME/publication consume only final machine/layout results |
| 6 | Phase 5 | Public services expose complete verified journeys |
| 7 | Phase 6 frontend subpath | Editor consumes only the published backend-free analysis route |
| 8 | Phases 1–7 | M1 qualifies the exact completed public product |

## Final Acceptance

Run `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`, real ACME 0.97
qualification, the single sequential VICE 3.10 M1 journey, touched-file Prettier and whitespace
checks, and a read-only proof that
`spec/` is unchanged. Record observational timings/memory without thresholds. The closeout must
answer whether RD-03 expired any deferral rationale and must re-home every affected deferral before
changing the RD lifecycle state.

RD-03 Linux implementation is complete only when all 79 tasks are `[x]`, every phase review has no
open critical/major finding, all final checks pass, no dead code or unused package surface remains,
the roadmap/closeout evidence is current, and the sole missing native-host evidence is explicitly
bounded by AR-C16 rather than reported as a pass.
