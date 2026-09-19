# Execution Plan: RD-03 Pipeline Completion

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-09-20 00:43
> **Progress**: 0/71 tasks (0%)
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
| 1 | Frozen M1 inputs, selected profile and raw asset | 11 |
| 2 | Semantic operations, explicit CFG and whole-program closure | 8 |
| 3 | SFA and ABI closure | 8 |
| 4 | Legal 6510 machine program and platform layout | 11 |
| 5 | ACME artifacts and atomic publication | 10 |
| 6 | Compiler services and CLI | 7 |
| 7 | Diagnostics-only editor bundle | 7 |
| 8 | Full M1 ACME/VICE qualification and handoff | 9 |

## Phase 1: Frozen Inputs, Profile and Raw Asset

> **Scope mode**: strict
> **Expected modification set**: `examples/m1/`; focused compiler profile/asset/frontend files;
> this plan's progress/review evidence and feature roadmap. No backend lowering, publication,
> editor workspace, frozen specification or sibling requirement changes.
> **Lenses**: correctness, api-surface, security, simplicity

### Step 1.1: Specification Tests

- [ ] 1.1.1 [spec-author] Write ST-55/ST-65 profile specification cases —
  `packages/compiler/src/frontend/profile.spec.test.ts`; forbidden: production compiler files.
- [ ] 1.1.2 [spec-author] Write ST-66–ST-68/ST-96 raw-asset cases —
  `packages/compiler/src/assets/raw-asset.spec.test.ts`; forbidden: production compiler files.
- [ ] 1.1.3 [spec-author] Write ST-97–ST-98 independent behavior cases —
  `test/m1/behavior.spec.test.ts`; forbidden: production compiler code and generated output.
- [ ] 1.1.4 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 1.2: Implementation

- [ ] 1.2.1 Add the readable M1 manifest/source skeleton and deterministic raw-sprite recipe/output —
  `examples/m1/blend65.json`, `examples/m1/src/game.blend`, `examples/m1/assets/sprites.bin`.
- [ ] 1.2.2 Add the independent fixed trace, pure behavior model and provenance notes —
  `examples/m1/qualification/{win-trace.json,oracle.ts,README.md}`.
- [ ] 1.2.3 Implement the one selected frontend profile declaration environment and exact M1 API
  identities — `packages/compiler/src/frontend/{profile.ts,semantic-types.ts}`; AR-C5/AR-C17.
- [ ] 1.2.4 Implement the literal raw-asset resolver and immutable asset identity/value —
  `packages/compiler/src/assets/{raw-asset.ts,asset-types.ts}`; AR-C6/AR-C14.
- [ ] 1.2.5 Complete frontend embed/profile obligations without leaking target facts into typed source
  semantics — `packages/compiler/src/frontend/{analyzer.ts,service.ts,analysis-result.ts}`.

### Step 1.3: Implementation Tests and Hardening

- [ ] 1.3.1 Reach GREEN; add focused implementation tests for identity races, containment and recipe
  determinism — `packages/compiler/src/assets/raw-asset.impl.test.ts`,
  `test/m1/behavior.impl.test.ts`; run phase qualification.
- [ ] 1.3.2 Record independent phase review, simplicity check and corrections —
  `08-phase-1-review.md`; commit green checkpoint.

Deliverable: requirements-frozen M1 inputs and one proved raw asset/profile frontend boundary.

## Phase 2: Semantic CFG and Whole Program

> **Scope mode**: strict
> **Expected modification set**: focused `packages/compiler/src/semantic/` files and tests; plan
> evidence/roadmap. No storage homes, opcodes, target addresses, packages or artifacts.
> **Lenses**: correctness, semantics, api-surface, simplicity

### Step 2.1: Specification Tests

- [ ] 2.1.1 [spec-author] Write ST-49–ST-54/ST-56 —
  `packages/compiler/src/semantic/{operations,cfg,whole-program}.spec.test.ts`; forbidden:
  production semantic modules.
- [ ] 2.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 2.2: Implementation

- [ ] 2.2.1 Define the minimum semantic operation, place/effect and CFG unions —
  `packages/compiler/src/semantic/{operations.ts,cfg.ts}`.
- [ ] 2.2.2 Lower completed typed functions to operations/edges —
  `packages/compiler/src/semantic/{lower.ts,cfg.ts}`.
- [ ] 2.2.3 Preserve exact evaluation, value/place identity, spans and volatile effects —
  `packages/compiler/src/semantic/lower.ts`.
- [ ] 2.2.4 Close all whole-program roots/edges and reject cycles/unknowns —
  `packages/compiler/src/semantic/whole-program.ts`.

### Step 2.3: Implementation Tests and Hardening

- [ ] 2.3.1 Reach GREEN; add graph/order/poison tests —
  `packages/compiler/src/semantic/{cfg,whole-program}.impl.test.ts`; run phase qualification.
- [ ] 2.3.2 Record independent correctness/semantics review and corrections —
  `08-phase-2-review.md`; commit green checkpoint.

Deliverable: one target-neutral whole semantic program with explicit CFG and complete direct edges.

## Phase 3: SFA and ABI Closure

> **Scope mode**: strict
> **Expected modification set**: focused `packages/compiler/src/storage/` and ABI files/tests;
> plan evidence/roadmap. No layout addresses, ACME, publication or runtime library.
> **Lenses**: correctness, semantics, resource ownership, simplicity

### Step 3.1: Specification Tests

- [ ] 3.1.1 [spec-author] Write ST-57–ST-64 —
  `packages/compiler/src/storage/{sfa,closure}.spec.test.ts`; forbidden: production storage/ABI
  modules.
- [ ] 3.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 3.2: Implementation

- [ ] 3.2.1 Define request, lifetime/interference, home and certificate records —
  `packages/compiler/src/storage/{storage-types.ts,interference.ts}`.
- [ ] 3.2.2 Inventory parameters, returns, locals, temporaries, argument staging and pointer/helper
  demand — `packages/compiler/src/storage/inventory.ts`.
- [ ] 3.2.3 Implement deterministic overlay/placement and conflicts —
  `packages/compiler/src/storage/{interference.ts,allocate.ts}`.
- [ ] 3.2.4 Implement bounded monotonic re-close and certificate freeze —
  `packages/compiler/src/storage/closure.ts`.

### Step 3.3: Implementation Tests and Hardening

- [ ] 3.3.1 Reach GREEN; add determinism/nonconvergence/stack tests —
  `packages/compiler/src/storage/{sfa,closure}.impl.test.ts`; run phase qualification.
- [ ] 3.3.2 Record independent correctness/semantics review and corrections —
  `08-phase-3-review.md`; commit green checkpoint.

Deliverable: every function-lifetime byte has a proved final home before layout.

## Phase 4: Machine Lowering and Platform Layout

> **Scope mode**: strict
> **Expected modification set**: focused `compiler/src/{target,machine,layout}/` files and tests;
> plan evidence/roadmap. No optional optimizer, textual pseudo-assembly, generic target registry or
> publication code.
> **Lenses**: correctness, 6502 semantics, expert output, simplicity

### Step 4.1: Specification Tests

- [ ] 4.1.1 [spec-author] Write ST-69–ST-74 machine-lowering cases —
  `packages/compiler/src/machine/lowering.spec.test.ts`; forbidden: production backend modules.
- [ ] 4.1.2 [spec-author] Write ST-75–ST-76 startup/layout cases —
  `packages/compiler/src/layout/c64-layout.spec.test.ts`; forbidden: production backend modules.
- [ ] 4.1.3 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 4.2: Implementation

- [ ] 4.2.1 Add direct selected CPU/machine/serializer/packager facts —
  `packages/compiler/src/target/{nmos6510.ts,c64-pal-kernal.ts,profile.ts}`.
- [ ] 4.2.2 Define structured machine records and legality validation —
  `packages/compiler/src/machine/{machine-types.ts,validate.ts}`.
- [ ] 4.2.3 Lower scalar/aggregate/call/control operations with explicit flags, widths and byte/word
  order — `packages/compiler/src/machine/{lower.ts,lower-control.ts}`.
- [ ] 4.2.4 Lower raw PEEK/POKE and named C64 operations —
  `packages/compiler/src/machine/{lower-memory.ts,lower-c64.ts}`.
- [ ] 4.2.5 Bind resources, choose legal forms and repair branches —
  `packages/compiler/src/machine/{bind.ts,block-layout.ts}`.
- [ ] 4.2.6 Implement startup/return plus deterministic non-overlapping C64/VIC-aware layout and
  sprite blocks — `packages/compiler/src/layout/{startup.ts,c64-layout.ts}`.

### Step 4.3: Implementation Tests and Hardening

- [ ] 4.3.1 Reach GREEN; add instruction/cycle/edge tests —
  `packages/compiler/src/machine/lowering.impl.test.ts`,
  `packages/compiler/src/layout/c64-layout.impl.test.ts`; run phase qualification.
- [ ] 4.3.2 Record independent 6502-semantics/expert review and corrections —
  `08-phase-4-review.md`; commit green checkpoint.

Deliverable: a closed legal documented-NMOS machine program and exact final C64 layout.

## Phase 5: ACME Artifacts and Publication

> **Scope mode**: strict
> **Expected modification set**: focused `compiler/src/{artifacts,publication,tools}/` files/tests;
> plan evidence/roadmap. No build system, cache, database, generic schema or readiness service.
> **Lenses**: correctness, security, concurrency, artifact integrity, simplicity

### Step 5.1: Specification Tests

- [ ] 5.1.1 [spec-author] Write ST-77–ST-87 —
  `packages/compiler/src/{artifacts/acme,artifacts/evidence,publication/publication}.spec.test.ts`;
  forbidden: production artifact/publication/tool modules.
- [ ] 5.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 5.2: Implementation

- [ ] 5.2.1 Implement terminal ACME serialization/form validation —
  `packages/compiler/src/artifacts/{acme-serializer.ts,acme-validate.ts}`.
- [ ] 5.2.2 Implement ACME 0.97 discovery/invocation/cleanup —
  `packages/compiler/src/tools/{discovery.ts,acme.ts}`.
- [ ] 5.2.3 Verify reports/symbols/bytes/segments/PRG/assets —
  `packages/compiler/src/artifacts/{acme-output.ts,prg.ts}`.
- [ ] 5.2.4 Implement direct canonical sidecars and cross-hashes —
  `packages/compiler/src/artifacts/{evidence.ts,evidence-types.ts}`.
- [ ] 5.2.5 Implement staging/generation/current commit —
  `packages/compiler/src/publication/{publication.ts,current-record.ts}`.
- [ ] 5.2.6 Implement the exact directory lock, independent pins, predecessor retention and fail-closed
  cleanup — `packages/compiler/src/publication/{lock.ts,pins.ts,cleanup.ts}`.

### Step 5.3: Implementation Tests and Hardening

- [ ] 5.3.1 Reach GREEN with real ACME/filesystem/process/concurrency tests —
  `packages/compiler/src/{artifacts/acme,publication/publication}.impl.test.ts`; qualify phase.
- [ ] 5.3.2 Record independent correctness/security/concurrency review and corrections —
  `08-phase-5-review.md`; commit green checkpoint.

Deliverable: one verified eight-file immutable generation published atomically.

## Phase 6: Compiler Services and CLI

> **Scope mode**: strict
> **Expected modification set**: compiler public/service files, CLI files/tests, manifests only when
> required; plan evidence/roadmap. No editor work, daemon or command framework.
> **Lenses**: correctness, api-surface, security, simplicity

### Step 6.1: Specification Tests

- [ ] 6.1.1 [spec-author] Write ST-88–ST-90 —
  `packages/compiler/src/services/services.spec.test.ts`, `packages/cli/src/commands.spec.test.ts`;
  forbidden: production compiler-service and CLI files.
- [ ] 6.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 6.2: Implementation

- [ ] 6.2.1 Implement typed check/build/run results and cancellation —
  `packages/compiler/src/services/{types.ts,services.ts}`.
- [ ] 6.2.2 Export the backend-free `@blend65/compiler/frontend` subpath and extend transitive boundary
  proof — `packages/compiler/{package.json,src/frontend/index.ts}`, `test/import-boundary.ts`.
- [ ] 6.2.3 Map CLI commands/options/signals/output/exit statuses —
  `packages/cli/src/{args.ts,run.ts,render.ts}`.

### Step 6.3: Implementation Tests and Hardening

- [ ] 6.3.1 Reach GREEN; add fresh-build/stale-output/cancellation implementation tests and qualify
  compiler/CLI — `packages/compiler/src/services/services.impl.test.ts`,
  `packages/cli/src/commands.impl.test.ts`; run boundaries.
- [ ] 6.3.2 Record independent API/security review and corrections — `08-phase-6-review.md`; commit
  green checkpoint.

Deliverable: truthful library and CLI check/build/run journeys.

## Phase 7: Diagnostics-Only Editor Bundle

> **Scope mode**: strict
> **Expected modification set**: new `packages/language-server/`, `packages/vscode/`, compiler
> frontend-overlay files/tests, root workspace lock/config and boundary tests; plan evidence/roadmap.
> Only the dependencies in AR-C10 are allowed.
> **Lenses**: correctness, api-surface, security, package boundaries, simplicity

### Step 7.1: Specification Tests

- [ ] 7.1.1 [spec-author] Write ST-91–ST-95 — `test/rd03-import-boundary.spec.test.ts`,
  `packages/language-server/src/server.spec.test.ts`, `packages/vscode/src/extension.spec.test.ts`;
  forbidden: production editor/overlay implementations.
- [ ] 7.1.2 Record behavioral RED and immutable oracle hashes — `99-execution-plan.md`.

### Step 7.2: Implementation

- [ ] 7.2.1 Implement bounded overlays and UTF-8-to-UTF-16 mapping —
  `packages/compiler/src/frontend/{overlay.ts,positions.ts,service.ts}`.
- [ ] 7.2.2 Add stdio diagnostics server and latest-only publication —
  `packages/language-server/{package.json,src/server.ts,vite.config.ts}`.
- [ ] 7.2.3 Add thin VS Code manifest/client bundle —
  `packages/vscode/{package.json,src/extension.ts,vite.config.ts}`.

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
  `test/m1/{vice-monitor.ts,vice-driver.ts}`.
- [ ] 8.2.3 Reach GREEN for pure M1, real ACME 0.97 and the sequential VICE 3.10 fixed-trace journey;
  record `VICE-verified / hardware-unverified` — `test/m1/{pipeline,vice}.spec.test.ts`.

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

Run `yarn build && yarn typecheck && yarn test`, real ACME 0.97 qualification, the single sequential
VICE 3.10 M1 journey, touched-file Prettier and whitespace checks, and a read-only proof that
`spec/` is unchanged. Record observational timings/memory without thresholds. The closeout must
answer whether RD-03 expired any deferral rationale and must re-home every affected deferral before
changing the RD lifecycle state.

RD-03 Linux implementation is complete only when all 71 tasks are `[x]`, every phase review has no
open critical/major finding, all final checks pass, no dead code or unused package surface remains,
the roadmap/closeout evidence is current, and the sole missing native-host evidence is explicitly
bounded by AR-C16 rather than reported as a pass.
