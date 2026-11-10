# Execution Plan: RD-07 Loadable Assets and D64 Delivery

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-10 10:12
> **Progress**: 37/131 tasks (28%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-07 in nine phases. Phases 1–8 follow the specification-first rule: spec tests → red →
implement → green → impl tests → verify. Phase 9 is an explicit qualification phase: its security
and integration cases were authored with red evidence in Phases 1–8, and Phase 9 runs the bounded
runtime and closeout evidence. The D64 profile identity is admitted in Phase 2 so semantic phases
can use `checkProject`; full D64 build/publication is Phase 7.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Loadable unit model | 17 |
| 2 | Profile and destination proof | 17 |
| 3 | Publication, aliases, and quiescence | 14 |
| 4 | Loader lowering and resources | 12 |
| 5 | Joint layout and memory | 14 |
| 6 | D64 packager and independent codec | 17 |
| 7 | D64 build, publication, and run | 15 |
| 8 | Evidence and costs | 12 |
| 9 | Examples, qualification, and closeout | 13 |

**Total: 131 tasks across 9 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. On implementation mark `[~]` with a timestamp; on verify pass promote to
> `[x]`; on blocker mark `[!]` with the reason. Update the Progress header and Last Updated stamp
> after every task. Only `[x]` counts as complete. Resume at the first `[~]`, else the first `[ ]`.
> Executors never edit `*.spec.test.ts` files; only `[spec-author]` tasks write them.

---

## Phase 1: Loadable Unit Model

> **Reasoning**: high — new cross-stage unit identity and byte materialization.
> **Lenses**: semantics, SFA/ABI.

### Step 1.1: Specification Tests

**Reference**: [03-01](03-01-loadable-unit-model.md) · ST-1..ST-7, ST-9..ST-11, ST-143..ST-149 · AR-P1, AR-P16, AR-P17, AR-P24
**Objective**: Define the exact unit record, bytes, identity, aliasing, native asset behavior,
illegal uses, and tooling handoff before implementation.

- [x] 1.1.1 [spec-author] Write specification tests from ST-1..ST-7, ST-9..ST-11, ST-143..ST-149 — `test/rd07/loadable-model.spec.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.1.2 [spec-author] Extend the import-boundary spec for the packaging-free frontend handoff — `test/import-boundary.spec.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.1.3 Run the new spec suites and record the red phase ✅ (completed: 2026-11-10 09:46)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-loadable-unit-model.md) §Implementation Details

- [x] 1.2.1 Add the immutable `LoadUnitRecord`, provenance, and identity helper — `packages/compiler/src/semantic/load-units.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.2 Materialize scalar unit bytes — `packages/compiler/src/semantic/load-units.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.3 Materialize fixed array/struct unit bytes — `packages/compiler/src/semantic/load-units.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.4 Materialize embedded/composed bytes and carry RD-06 destination constraints — `packages/compiler/src/semantic/load-units.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.5 Collect module-level loadable declarations — `packages/compiler/src/frontend/analyzer.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.6 Collect local loadable declarations with function-qualified identity — `packages/compiler/src/frontend/analyzer-scalars.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.7 Merge import aliases by declaration identity — `packages/compiler/src/semantic/load-units.ts` ✅ (completed: 2026-11-10 09:46)
- [ ] 1.2.8 Extend whole-program reachability to units referenced by reachable load calls — `packages/compiler/src/semantic/whole-program.ts` `[!] Blocked: needs the Phase 3 load operation`
- [x] 1.2.9 Allow native/raw assets under `loadable const`; keep the expressiveness-ledger row deferred until Phase 7 — `packages/compiler/src/assets/asset-dispatch.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.10 Prove zero resident bytes and resident/loadable separation — `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/machine/lower-data.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.11 Add the frontend-safe `LoadableHandoff` view — `packages/compiler/src/frontend/handoff.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.2.12 Run ST-1..ST-7, ST-9..ST-11, ST-143..ST-149 and record the green phase ✅ (completed: 2026-11-10 09:46)

### Step 1.3: Implementation Tests and Verification

- [x] 1.3.1 Write implementation tests for byte order, alias merging, provenance, constraint carry, and local identity — `packages/compiler/src/semantic/load-units.impl.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 1.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier ✅ (completed: 2026-11-10 09:46)

**Deliverables**:
- [ ] Unit inventory survives to semantic lowering
- [ ] Native loadable assets accepted
- [ ] Frontend handoff is packaging-free

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/loadable-model.spec.test.ts test/import-boundary.spec.test.ts` plus `yarn workspace @blend65/compiler test src/semantic/load-units.impl.test.ts`, `yarn build`, `yarn typecheck`

---

## Phase 2: Profile and Destination Proof

> **Reasoning**: max — profile composition plus type/place/lifetime proof.
> **Lenses**: semantics, SFA/ABI, security, target platform.

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-load-operation-and-publication.md), [03-06](03-06-artifact-publication-and-run.md) · ST-8, ST-12, ST-13..ST-30, ST-136 · AR-P2, AR-P3, AR-P21
**Objective**: Admit the D64 profile early and pin every accepted/rejected destination form.

- [ ] 2.1.1 [spec-author] Write specification tests from ST-8, ST-12, ST-13..ST-30, ST-136 — `test/rd07/load-destination.spec.test.ts`
- [x] 2.1.2 [spec-author] Update the existing D64 profile expectation to admit the executable profile — `packages/compiler/src/target/cooperative-profiles.spec.test.ts` ✅ (completed: 2026-11-10 10:12)
- [x] 2.1.3 Run the new spec suites and record the red phase ✅ (completed: 2026-11-10 10:12)

### Step 2.2: Implementation

**Reference**: [03-02](03-02-load-operation-and-publication.md) §Destination proof; [03-06](03-06-artifact-publication-and-run.md) §Profile composition

- [x] 2.2.1 Widen `C64KernalProfileId`, `PackagerFacts`, `TargetProfile`, and `storage.profileId`; add the D64 facts row and `profileKind` — `packages/compiler/src/profile/c64-kernal.ts`, `packages/compiler/src/target/c64-kernal.ts`, `packages/compiler/src/target/profile.ts` ✅ (completed: 2026-11-10 10:12)
- [x] 2.2.2 Admit exact D64 selection and narrow the existing E10275 guard to PRG packagers — `packages/compiler/src/target/profile.ts`, `packages/compiler/src/frontend/scalar-expressions.ts` ✅ (completed: 2026-11-10 10:12)
- [x] 2.2.3 Accept `cbm-d64` in the ACME input validator — `packages/compiler/src/artifacts/acme-validate.ts` ✅ (completed: 2026-11-10 10:12)
- [ ] 2.2.4 Add the `c64.loader.load` special form and the `load-unit` semantic operation — `packages/compiler/src/frontend/scalar-expressions.ts`, `packages/compiler/src/semantic/operations.ts`
- [ ] 2.2.5 Resolve the second argument to a mutable fixed place — `packages/compiler/src/frontend/load-call.ts`
- [ ] 2.2.6 Evaluate the destination exactly once — `packages/compiler/src/frontend/load-call.ts`
- [ ] 2.2.7 Build the finite candidate set for a runtime fixed-array index; reject non-finite sets — `packages/compiler/src/semantic/load-destination.ts`
- [ ] 2.2.8 Prove exact type, size, mutability, and lifetime — `packages/compiler/src/semantic/load-destination.ts`
- [ ] 2.2.9 Prove alignment, visibility, end address, and KERNAL-ROM exclusion — `packages/compiler/src/semantic/load-destination.ts`
- [ ] 2.2.10 Implement E10275 reasons and E10279 profile behavior; preserve E10274 — `packages/compiler/src/frontend/scalar-expressions.ts`
- [ ] 2.2.11 Add the minimal machine `load-unit` operation and effect so `checkProject` can complete before the exact KERNAL lowering exists — `packages/compiler/src/machine/operations.ts`, `packages/compiler/src/machine/lower-operation.ts`
- [ ] 2.2.12 Run ST-13..ST-30 and record the green phase

### Step 2.3: Implementation Tests and Verification

- [ ] 2.3.1 Write implementation tests for place paths, candidate ordering, one-evaluation, and diagnostic spans — `packages/compiler/src/frontend/load-destination.impl.test.ts`
- [ ] 2.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] D64 profile selectable through `checkProject`
- [ ] All accepted destination forms compile
- [ ] PRG profiles keep E10275

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/load-destination.spec.test.ts` plus `yarn workspace @blend65/compiler test src/target/cooperative-profiles.spec.test.ts src/frontend/load-destination.impl.test.ts`

---

## Phase 3: Publication, Aliases, and Quiescence

> **Reasoning**: max — definite assignment, aliasing, loops, and interrupt ownership.
> **Lenses**: semantics, SFA/ABI, target platform.

### Step 3.1: Specification Tests

**Reference**: [03-02](03-02-load-operation-and-publication.md) · ST-31..ST-50, ST-150 · AR-P4, AR-P5
**Objective**: Pin capture/result identity, every flow join, alias class, and route proof.

- [ ] 3.1.1 [spec-author] Write specification tests from ST-31..ST-50, ST-150 — `test/rd07/load-publication.spec.test.ts`, `test/rd07/load-quiescence.spec.test.ts`
- [ ] 3.1.2 Run the new spec suites and record the red phase

### Step 3.2: Implementation

**Reference**: [03-02](03-02-load-operation-and-publication.md) §Publication rules, §Alias model, §Quiescence

- [ ] 3.2.1 Add the `LoadCapture` fact, fresh result identity, and all flow-copy points — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.2 Wire the true/false edges — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.3 Preserve/drop the capture across joins — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.4 Preserve/drop the capture across loops and retries — `packages/compiler/src/frontend/flow-loops.ts`
- [ ] 3.2.5 Follow the capture through stored results — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.6 Implement must/may/partial alias propagation — `packages/compiler/src/frontend/address-provenance.ts`, `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.7 Implement E10276 with read, load, and blocking-edge spans — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.8 Query ownership depth at the call — `packages/compiler/src/semantic/interrupt-ownership.ts`, `packages/compiler/src/frontend/load-quiescence.ts`
- [ ] 3.2.9 Implement the quiescence E10275 diagnostic and remedy — `packages/compiler/src/frontend/load-quiescence.ts`
- [ ] 3.2.10 Run ST-31..ST-50, ST-150 and record the green phase

### Step 3.3: Implementation Tests and Verification

- [ ] 3.3.1 Write implementation tests for range intersection, alias sets, and route-state transitions — `packages/compiler/src/frontend/load-publication.impl.test.ts`, `packages/compiler/src/frontend/load-quiescence.impl.test.ts`
- [ ] 3.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] No runtime validity state emitted
- [ ] Every flow/alias case has an exact result
- [ ] Active routes reject with a remedy

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/load-publication.spec.test.ts test/rd07/load-quiescence.spec.test.ts` plus the two impl-test paths

---

## Phase 4: Loader Lowering and Resources

> **Reasoning**: max — exact assembly, ABI, stack, and resource closure.
> **Lenses**: machine code, SFA/ABI, target platform.

### Step 4.1: Specification Tests

**Reference**: [03-03](03-03-loader-lowering-and-resources.md) · ST-51..ST-64, ST-139 · AR-P6, AR-P7, AR-P23
**Objective**: Pin the exact sequence, success check, linking, and resource facts.

- [ ] 4.1.1 [spec-author] Write specification tests from ST-51..ST-64 (runtime halves noted for VICE) — `test/rd07/loader-lowering.spec.test.ts`
- [ ] 4.1.2 Run the new spec suite and record the red phase

### Step 4.2: Implementation

**Reference**: [03-03](03-03-loader-lowering-and-resources.md) §Exact sequence

- [ ] 4.2.1 Lower the static SETLFS/SETNAM/LOAD sequence — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.2 Lower the dynamic destination once into X/Y and compute the runtime expected end — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.3 Implement the carry/end-address boolean check and `$10000` case — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.4 Emit one name data object per unit and link code/data only when reached — `packages/compiler/src/machine/lower-data.ts`
- [ ] 4.2.5 Add the loader stack fact (inline JSR + KERNAL peak + stock IRQ frame) to shared-storage closure — `packages/compiler/src/services/shared-storage.ts`, `packages/compiler/src/storage/closure.ts`
- [ ] 4.2.6 Prove KERNAL workspace and SFA interference; keep the `$02–$8F` window unchanged — `packages/compiler/src/storage/allocate.ts`
- [ ] 4.2.7 Run ST-51..ST-64 and record the green phase

### Step 4.3: Implementation Tests and Verification

- [ ] 4.3.1 Write implementation tests for sequence bytes/cycles, dynamic arithmetic, and unreachable omission — `packages/compiler/src/machine/loader.impl.test.ts`
- [ ] 4.3.2 Run the exact assembly/cost assertions already owned by ST-52; do not edit the spec file — `test/rd07/loader-lowering.spec.test.ts`
- [ ] 4.3.3 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Exact KERNAL sequence and success check
- [ ] No loader when unreachable
- [ ] Loader stack included in SFA closure

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/loader-lowering.spec.test.ts` plus `yarn workspace @blend65/compiler test src/machine/loader.impl.test.ts`

---

## Phase 5: Joint Layout and Memory

> **Reasoning**: high — interval overlap, exclusive states, visibility, and evidence.
> **Lenses**: SFA/ABI, target platform, machine code.

### Step 5.1: Specification Tests

**Reference**: [03-04](03-04-joint-layout-and-memory.md) · ST-65..ST-76 · AR-P7, AR-P21
**Objective**: Pin every legal destination, conflict, visibility rule, and memory view.

- [ ] 5.1.1 [spec-author] Write specification tests from ST-65..ST-76 — `test/rd07/load-layout.spec.test.ts`
- [ ] 5.1.2 Run the new spec suite and record the red phase

### Step 5.2: Implementation

**Reference**: [03-04](03-04-joint-layout-and-memory.md) §Destination intervals, §Exclusive memory states

- [ ] 5.2.1 Prove and record every physical destination interval — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.2 Reject code/SFA/stack/vector/loader conflicts with every owner — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.3 Reject MMIO/ROM/player conflicts with every owner — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.4 Prove CPU/VIC visibility and BASIC-ROM banking — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.5 Derive VIC fields from the destination — `packages/compiler/src/machine/vic-fields.ts`
- [ ] 5.2.6 Add per-destination/per-candidate exclusive residencies — `packages/compiler/src/services/evidence.ts`
- [ ] 5.2.7 Emit state views and the additive `loadStates` records — `packages/compiler/src/services/evidence.ts`
- [ ] 5.2.8 Emit loader/destination/KERNAL records, free-space facts, and stack domains — `packages/compiler/src/services/memory-evidence-records.ts`
- [ ] 5.2.9 Add `loadStates` to the `MemoryEvidence` type and the exact-key memory validator — `packages/compiler/src/artifacts/evidence-types.ts`, `packages/compiler/src/artifacts/memory-evidence-validator.ts`
- [ ] 5.2.10 Run ST-65..ST-76 and record the green phase

### Step 5.3: Implementation Tests and Verification

- [ ] 5.3.1 Write implementation tests for exclusive views, tiling, and overlap diagnostics — `packages/compiler/src/services/d64-memory.impl.test.ts`
- [ ] 5.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Every destination is proved or rejected with owners
- [ ] State views never double-count
- [ ] `loadStates` carries quiescence/publication

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/load-layout.spec.test.ts` plus `yarn workspace @blend65/compiler test src/services/d64-memory.impl.test.ts`

---

## Phase 6: D64 Packager and Independent Codec

> **Reasoning**: max — binary format, capacity, determinism, and an independent oracle.
> **Lenses**: machine code, target platform, security.

### Step 6.1: Specification Tests and Oracle

**Reference**: [03-05](03-05-d64-packager.md) · ST-77..ST-96, ST-135, ST-137 · AR-P9..AR-P13
**Objective**: Build the independent decoder and pin every byte-level D64 rule.

- [x] 6.1.1 [spec-author] Write the independent D64 decoder with no production-serializer import — `test/rd07/d64-decoder.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.1.2 [spec-author] Write specification tests from ST-77..ST-96, ST-135, ST-137 — `test/rd07/d64-codec.spec.test.ts`, `test/rd07/d64-capacity.spec.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.1.3 Run the new spec suites and record the red phase ✅ (completed: 2026-11-10 09:46)

### Step 6.2: Implementation

**Reference**: [03-05](03-05-d64-packager.md) §Format facts, §Directory, §File data

- [ ] 6.2.1 Add a checked-in reference D64 fixture and measure the representative KERNAL load before serializer code; record it — `test/rd07/fixtures/reference.d64`, `codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/09-allocation-measurement.md`
- [x] 6.2.2 Implement geometry, offsets, and the 174,848-byte image buffer — `packages/compiler/src/packaging/d64/geometry.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.3 Implement the BAM, standard header offsets, label, ID, DOS type, and free counts — `packages/compiler/src/packaging/d64/bam.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.4 Implement the directory interleave-3 chain — `packages/compiler/src/packaging/d64/directory.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.5 Implement directory entries, names, and `$A0` padding — `packages/compiler/src/packaging/d64/directory.ts`, `packages/compiler/src/packaging/d64/names.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.6 Implement interleave-10 allocation — `packages/compiler/src/packaging/d64/allocator.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.7 Implement 2-byte headers, 254-byte chunks, links, and final-sector lengths — `packages/compiler/src/packaging/d64/image.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.8 Implement boot-first ordering, zero-byte units, and `$0000` headers — `packages/compiler/src/packaging/d64/image.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.9 Implement `$00` fill and deterministic assembly — `packages/compiler/src/packaging/d64/image.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.10 Implement capacity, name-collision, and structural validation — `packages/compiler/src/packaging/d64/image.ts`, `allocator.ts`, `names.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.2.11 Run ST-77..ST-96, ST-135, ST-137 and record the green phase ✅ (completed: 2026-11-10 09:46)

### Step 6.3: Implementation Tests and Verification

- [x] 6.3.1 Write implementation tests for allocator wrap, final-sector edges, name limits, and invariants — `packages/compiler/src/packaging/d64/d64.impl.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.3.2 Run the independent decoder against the exact image; do not edit the spec file — `test/rd07/d64-codec.spec.test.ts` ✅ (completed: 2026-11-10 09:46)
- [x] 6.3.3 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier ✅ (completed: 2026-11-10 09:46)

**Deliverables**:
- [ ] Byte-exact deterministic D64
- [ ] Independent decoder proves every structure
- [ ] Exact-fit and one-over capacity behavior

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/d64-codec.spec.test.ts test/rd07/d64-capacity.spec.test.ts` plus `yarn workspace @blend65/compiler test src/packaging/d64`

---

## Phase 7: D64 Build, Publication, and Run

> **Reasoning**: high — build integration, atomic publication, and emulator binding.
> **Lenses**: target platform, SFA/ABI, security.

### Step 7.1: Specification Tests

**Reference**: [03-06](03-06-artifact-publication-and-run.md) · ST-97..ST-108, ST-134, ST-140, ST-127..ST-131 · AR-P9, AR-P15
**Objective**: Pin the profile, eight-file generation, publication, run, and security boundaries.

- [ ] 7.1.1 [spec-author] Write specification tests from ST-97..ST-108, ST-134, ST-140 — `test/rd07/d64-publication.spec.test.ts`, `test/rd07/prg-regression.spec.test.ts`
- [ ] 7.1.2 [spec-author] Write security specification tests from ST-127..ST-131 — `test/rd07/security.spec.test.ts`
- [ ] 7.1.3 [spec-author] Write the end-to-end integration tests from ST-98, ST-102, ST-119..ST-120 — `test/rd07/d64-e2e.spec.test.ts`
- [ ] 7.1.4 Run the new spec suites and record the red phase

### Step 7.2: Implementation

**Reference**: [03-06](03-06-artifact-publication-and-run.md) §Profile composition, §Publication, §`run`

- [ ] 7.2.1 Invoke the packager after verified ACME output and stage the `.d64` — `packages/compiler/src/services/services.ts`
- [ ] 7.2.2 Delete the staged `<name>.prg` after packaging; assert the exact eight names — `packages/compiler/src/services/services.ts`
- [ ] 7.2.3 Accept the D64 primary in publication and the D64 `evidenceAgrees` branch — `packages/compiler/src/publication/current-record.ts`
- [ ] 7.2.4 Write the eight-file generation and D64 `.build.json` package with `loaderStrategyId` and ordered components — `packages/compiler/src/services/evidence.ts`
- [ ] 7.2.5 Probe VICE 3.10 and freeze the exact drive-8/autostart argv — `packages/compiler/src/services/vice.ts`
- [ ] 7.2.6 Bind `run` to the pinned fresh image and first boot entry — `packages/compiler/src/services/services.ts`, `packages/compiler/src/services/vice.ts`
- [ ] 7.2.7 Separate build/pin/mount/autostart/runtime/timeout/cancellation failures — `packages/compiler/src/services/services.ts`
- [ ] 7.2.8 Retire the expressiveness-ledger row with the end-to-end load test — `test/rd04/expressiveness-ledger.json`, `test/rd07/d64-e2e.spec.test.ts`
- [ ] 7.2.9 Run ST-97..ST-108, ST-134, ST-140, ST-127..ST-131 and record the green phase

### Step 7.3: Implementation Tests and Verification

- [ ] 7.3.1 Write implementation tests for profile composition, primary acceptance, and argv construction — `packages/compiler/src/services/d64-publication.impl.test.ts`
- [ ] 7.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Executable D64 build/publication
- [ ] Fresh pinned image mounted as drive 8
- [ ] PRG path unchanged

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/d64-publication.spec.test.ts test/rd07/security.spec.test.ts test/rd07/prg-regression.spec.test.ts` plus the impl-test path

---

## Phase 8: Evidence and Costs

> **Reasoning**: high — cross-sidecar truth and no double counting.
> **Lenses**: semantics, security, target platform.

### Step 8.1: Specification Tests

**Reference**: [03-07](03-07-evidence-and-costs.md) · ST-109..ST-115, ST-133, ST-138 · AR-P14, AR-P24
**Objective**: Pin every D64, loader, destination, load-unit, cost, and handoff field.

- [ ] 8.1.1 [spec-author] Write specification tests from ST-109..ST-115, ST-133, ST-138 — `test/rd07/d64-evidence.spec.test.ts`
- [ ] 8.1.2 Run the new spec suite and record the red phase

### Step 8.2: Implementation

**Reference**: [03-07](03-07-evidence-and-costs.md) §Implementation Details

- [ ] 8.2.1 Emit loadable asset placements, constraints, and aliases — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.2 Emit the boot/loader/filename/call-site/disk/KERNAL cost split with `{kind:"unknown"}` timing — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.3 Populate debug load units by component id and `loadUnitIndex` ranges — `packages/compiler/src/services/evidence-records.ts`
- [ ] 8.2.4 Assert the D64 package component sources, aliases, and ordered components emitted in Phase 7; fix only the evidence projection — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.5 Add the `loadStates` cross-check and extended loadable destination matcher — `packages/compiler/src/publication/sidecar-consistency.ts`
- [ ] 8.2.6 Add the build-only `LoadableBuildView` as a sidecar-derived shape — `packages/compiler/src/services/handoff.ts`
- [ ] 8.2.7 Add `loaderStrategyId` to the `BuildEvidence` type and the exact-key build validator — `packages/compiler/src/artifacts/evidence-types.ts`, `packages/compiler/src/artifacts/build-evidence-validator.ts`
- [ ] 8.2.8 Run ST-109..ST-115, ST-133, ST-138 and record the green phase

### Step 8.3: Implementation Tests and Verification

- [ ] 8.3.1 Write implementation tests for field ordering, unknown timing, cost sums, and mismatch rejection — `packages/compiler/src/services/d64-evidence.impl.test.ts`
- [ ] 8.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] All version-1 D64 records produced
- [ ] No double counting
- [ ] Mismatch rejects before publication

**Verify**: yarn install --frozen-lockfile; `yarn vitest run test/rd07/d64-evidence.spec.test.ts` plus `yarn workspace @blend65/compiler test src/services/d64-evidence.impl.test.ts`

---

## Phase 9: Examples, Qualification, and Closeout

> **Reasoning**: high — end-to-end proof and honest boundary.
> **Lenses**: semantics, target platform, machine code, security.
>
> **Qualification phase**: the security and integration cases were authored with red evidence in
> Phases 1–8. This phase runs bounded runtime evidence and the closeout; it does not add new
> specification oracles.

### Step 9.1: Examples and Runtime Qualification

**Reference**: [03-06](03-06-artifact-publication-and-run.md), [03-07](03-07-evidence-and-costs.md) · ST-116..ST-126, ST-132, ST-139, ST-141..ST-142

- [ ] 9.1.1 [spec-author] Write the VICE and qualification specification tests from ST-116..ST-126, ST-132, ST-139, ST-141..ST-142 and record the red phase — `test/rd07/d64-vice.spec.test.ts`, `test/rd07/qualification.spec.test.ts`
- [ ] 9.1.2 Add focused examples: composite level, sequential reuse, failure path, quiescence/restoration, unreachable omission, capacity — `examples/rd07-loadable/`
- [ ] 9.1.3 Write user-facing trusted-media documentation naming HLE-010 and the no-containment boundary — `docs/loadable-assets.md`
- [ ] 9.1.4 Build the VICE fixture and bounded observation driver with explicit cycle limits and soft skip — `test/rd07/vice-driver.ts`
- [ ] 9.1.5 Prove boot, load success, exact bytes, canaries, failure, short load, BASIC return, and no hidden copy — `test/rd07/d64-vice.spec.test.ts`
- [ ] 9.1.6 Run the bounded longer-replacement observation with an isolated destination and canaries — `test/rd07/d64-vice.spec.test.ts`
- [ ] 9.1.7 Record D64 serialization, decode, flow analysis, build, and bounded-run host observations — `test/rd07/qualification.spec.test.ts`
- [ ] 9.1.8 Run the end-to-end, capacity, and PRG-regression integration suites — `test/rd07/d64-e2e.spec.test.ts`, `test/rd07/d64-capacity.spec.test.ts`, `test/rd07/prg-regression.spec.test.ts`
- [ ] 9.1.9 Run the determinism, product-boundary, and link/deferral scans — `test/rd07/qualification.spec.test.ts`

### Step 9.2: Boundary and Closeout

- [ ] 9.2.1 Run the complete RD-07 boundary once after integration, including affected existing suites
- [ ] 9.2.2 Run the deferral-expiry and durable-register scan; re-own every due item
- [ ] 9.2.3 Write the closeout with `VICE-verified / hardware-unverified`, evidence, and remaining debt — `codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/09-closeout.md`
- [ ] 9.2.4 Update the feature and portfolio roadmaps; verify `spec/` is untouched; final install/build/typecheck/test and targeted Prettier

**Deliverables**:
- [ ] Playable load example on the fresh D64
- [ ] Runtime evidence and honest hardware boundary
- [ ] Closed deferrals and updated roadmap

**Verify**: `yarn install --frozen-lockfile`, complete RD-07 boundary, `yarn build`, `yarn typecheck`, `yarn test`, targeted Prettier

---

## Dependencies

```
Phase 1 (units)
    ↓
Phase 2 (profile + destination proof)
    ↓
Phase 3 (publication/quiescence)
    ↓
Phase 4 (loader lowering)
    ↓
Phase 5 (layout/memory)
    ↓
Phase 6 (D64 packager)
    ↓
Phase 7 (build/publication/run)
    ↓
Phase 8 (evidence/costs)
    ↓
Phase 9 (examples/qualification)
```

Phases 5 and 6 may proceed in parallel after Phase 4 for the serializer and memory-record work, but
Phase 7 waits for both.

## Success Criteria

1. All 131 tasks are `[x]`.
2. Every RD-07 Must/Should item is implemented or explicitly bounded.
3. Specification tests pass; independent decoder proves the image.
4. `yarn build`, `yarn typecheck`, and the complete RD-07 boundary pass.
5. `spec/` is byte-identical to the frozen baseline.
6. No `PLACEHOLDER`/`TODO`/dead code remains in the new surface.
7. The closeout records `VICE-verified / hardware-unverified` and the exact remaining debt.
