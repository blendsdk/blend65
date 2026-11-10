# Execution Plan: RD-07 Loadable Assets and D64 Delivery

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-10 08:44
> **Progress**: 0/120 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-07 in nine specification-first phases: loadable unit model, destination proof,
publication/quiescence, loader lowering, joint layout/memory, D64 packager, D64 artifact/run,
evidence/costs, and examples/qualification. Each phase writes its specification tests first, proves
the red phase, implements, proves the green phase, adds implementation tests, and verifies.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Loadable unit model | 15 |
| 2 | Load operation and destination proof | 13 |
| 3 | Publication, aliases, and quiescence | 14 |
| 4 | Loader lowering and resources | 13 |
| 5 | Joint layout and memory | 13 |
| 6 | D64 packager and independent codec | 17 |
| 7 | D64 profile, publication, and run | 13 |
| 8 | Evidence and costs | 12 |
| 9 | Examples, qualification, and closeout | 10 |

**Total: 120 tasks across 9 phases**

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. On implementation mark `[~]` with a timestamp; on verify pass promote to
> `[x]`; on blocker mark `[!]` with the reason. Update the Progress header and Last Updated stamp
> after every task. Only `[x]` counts as complete. Resume at the first `[~]`, else the first `[ ]`.

---

## Phase 1: Loadable Unit Model

> **Reasoning**: high — new cross-stage unit identity and byte materialization.
> **Lenses**: semantics, SFA/ABI.

### Step 1.1: Specification Tests

**Reference**: [03-01](03-01-loadable-unit-model.md) · ST-1..ST-12 · AR-P1, AR-P16, AR-P17
**Objective**: Define the exact unit record, bytes, identity, aliasing, reachability, and native
asset behavior before implementation.

- [ ] 1.1.1 [spec-author] Write specification tests from ST-1..ST-12 — `test/rd07/loadable-model.spec.test.ts`
- [ ] 1.1.2 Run the new spec suite and record the red phase (every case fails for the expected missing behavior)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-loadable-unit-model.md) §Implementation Details

- [ ] 1.2.1 Add the immutable `LoadUnitRecord`, provenance, and identity helper — `packages/compiler/src/semantic/load-units.ts`
- [ ] 1.2.2 Materialize scalar unit bytes — `packages/compiler/src/semantic/load-units.ts`
- [ ] 1.2.3 Materialize fixed array/struct unit bytes — `packages/compiler/src/semantic/load-units.ts`
- [ ] 1.2.4 Materialize embedded/composed bytes and carry RD-06 destination constraints — `packages/compiler/src/semantic/load-units.ts`
- [ ] 1.2.5 Collect module-level loadable declarations — `packages/compiler/src/frontend/analyzer.ts`, `packages/compiler/src/semantic/lower.ts`
- [ ] 1.2.6 Collect local loadable declarations — `packages/compiler/src/frontend/analyzer-scalars.ts`
- [ ] 1.2.7 Merge import aliases by declaration identity — `packages/compiler/src/semantic/load-units.ts`
- [ ] 1.2.8 Extend whole-program reachability to units referenced by reachable load calls — `packages/compiler/src/semantic/whole-program.ts`
- [ ] 1.2.9 Allow native/raw assets under `loadable const`; retire the E10204 loadable row and update the expressiveness ledger — `packages/compiler/src/assets/asset-dispatch.ts`, `test/rd04/expressiveness-ledger.json`
- [ ] 1.2.10 Prove zero resident bytes and resident/loadable separation for both forms — `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/machine/lower-data.ts`
- [ ] 1.2.11 Run ST-1..ST-12 and record the green phase

### Step 1.3: Implementation Tests and Verification

- [ ] 1.3.1 Write implementation tests for byte order, alias merging, provenance, and constraint carry — `packages/compiler/src/semantic/load-units.impl.test.ts`
- [ ] 1.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Unit inventory survives to semantic lowering
- [ ] Native loadable assets accepted
- [ ] All Phase 1 verification passing

**Verify**: `yarn test test/rd07/loadable-model.spec.test.ts packages/compiler/src/semantic/load-units.impl.test.ts` plus `yarn build` and `yarn typecheck`

---

## Phase 2: Load Operation and Destination Proof

> **Reasoning**: max — type/place/lifetime/alias proof is the semantic core.
> **Lenses**: semantics, SFA/ABI, security.

### Step 2.1: Specification Tests

**Reference**: [03-02](03-02-load-operation-and-publication.md) · ST-13..ST-30 · AR-P2, AR-P3
**Objective**: Pin every accepted and rejected destination form and the finite candidate set.

- [ ] 2.1.1 [spec-author] Write specification tests from ST-13..ST-30 — `test/rd07/load-destination.spec.test.ts`
- [ ] 2.1.2 Run the new spec suite and record the red phase

### Step 2.2: Implementation

**Reference**: [03-02](03-02-load-operation-and-publication.md) §Destination proof

- [ ] 2.2.1 Add the D64-only `c64.loader.load` capability — `packages/compiler/src/frontend/profile.ts`
- [ ] 2.2.2 Add the `load-unit` semantic operation — `packages/compiler/src/semantic/operations.ts`
- [ ] 2.2.3 Resolve the second argument to a mutable fixed place — `packages/compiler/src/frontend/`
- [ ] 2.2.4 Evaluate the destination exactly once — `packages/compiler/src/frontend/`
- [ ] 2.2.5 Build the finite candidate set for a runtime fixed-array index; reject non-finite sets — `packages/compiler/src/semantic/`
- [ ] 2.2.6 Prove exact type, size, mutability, and lifetime — `packages/compiler/src/semantic/`
- [ ] 2.2.7 Prove alignment, visibility, and the end address — `packages/compiler/src/semantic/`
- [ ] 2.2.8 Implement E10275 reasons and E10279 profile behavior; preserve E10274 — `packages/compiler/src/frontend/scalar-expressions.ts`
- [ ] 2.2.9 Run ST-13..ST-30 and record the green phase

### Step 2.3: Implementation Tests and Verification

- [ ] 2.3.1 Write implementation tests for place paths, candidate ordering, one-evaluation, and diagnostic spans — `packages/compiler/src/frontend/load-destination.impl.test.ts`
- [ ] 2.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] All accepted destination forms compile
- [ ] All rejected forms produce exact E10275 reasons
- [ ] PRG profiles keep E10275

**Verify**: `yarn test test/rd07/load-destination.spec.test.ts packages/compiler/src/frontend/load-destination.impl.test.ts`

---

## Phase 3: Publication, Aliases, and Quiescence

> **Reasoning**: max — definite assignment, aliasing, loops, and interrupt ownership.
> **Lenses**: semantics, SFA/ABI, target platform.

### Step 3.1: Specification Tests

**Reference**: [03-02](03-02-load-operation-and-publication.md) · ST-31..ST-50 · AR-P4, AR-P5
**Objective**: Pin the capture/result identity, every flow join, alias class, and route proof.

- [ ] 3.1.1 [spec-author] Write specification tests from ST-31..ST-50 — `test/rd07/load-publication.spec.test.ts`, `test/rd07/load-quiescence.spec.test.ts`
- [ ] 3.1.2 Run the new spec suites and record the red phase

### Step 3.2: Implementation

**Reference**: [03-02](03-02-load-operation-and-publication.md) §Publication rules, §Alias model, §Quiescence

- [ ] 3.2.1 Add the `LoadCapture` fact and fresh result identity — `packages/compiler/src/frontend/semantic-types.ts`
- [ ] 3.2.2 Wire the true/false edges — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.3 Preserve/drop the capture across joins — `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.4 Preserve/drop the capture across loops and retries — `packages/compiler/src/frontend/`
- [ ] 3.2.5 Follow the capture through stored results — `packages/compiler/src/frontend/`
- [ ] 3.2.6 Implement must/may/partial alias propagation — `packages/compiler/src/frontend/address-provenance.ts`, `packages/compiler/src/frontend/flow-facts.ts`
- [ ] 3.2.7 Implement E10276 with read, load, and blocking-edge spans — `packages/compiler/src/frontend/`
- [ ] 3.2.8 Query RD-05 IRQ/NMI/audio route state at the call — `packages/compiler/src/storage/irq-stack.ts`, `packages/compiler/src/frontend/`
- [ ] 3.2.9 Implement the quiescence E10275 diagnostic and remedy — `packages/compiler/src/frontend/`
- [ ] 3.2.10 Run ST-31..ST-50 and record the green phase

### Step 3.3: Implementation Tests and Verification

- [ ] 3.3.1 Write implementation tests for range intersection, alias sets, and route-state transitions — `packages/compiler/src/frontend/load-publication.impl.test.ts`, `packages/compiler/src/frontend/load-quiescence.impl.test.ts`
- [ ] 3.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] No runtime validity state emitted
- [ ] Every flow/alias case has an exact result
- [ ] Active routes reject with a remedy

**Verify**: `yarn test test/rd07/load-publication.spec.test.ts test/rd07/load-quiescence.spec.test.ts`

---

## Phase 4: Loader Lowering and Resources

> **Reasoning**: max — exact assembly, ABI, stack, and resource closure.
> **Lenses**: machine code, SFA/ABI, target platform.

### Step 4.1: Specification Tests

**Reference**: [03-03](03-03-loader-lowering-and-resources.md) · ST-51..ST-64 · AR-P6, AR-P7
**Objective**: Pin the exact sequence, success check, linking, and resource facts.

- [ ] 4.1.1 [spec-author] Write specification tests from ST-51..ST-64 — `test/rd07/loader-lowering.spec.test.ts`
- [ ] 4.1.2 Run the new spec suite and record the red phase

### Step 4.2: Implementation

**Reference**: [03-03](03-03-loader-lowering-and-resources.md) §Exact sequence

- [ ] 4.2.1 Add the machine `load-unit` operation and retain the complete effect — `packages/compiler/src/machine/`
- [ ] 4.2.2 Lower the static SETLFS/SETNAM/LOAD sequence — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.3 Lower the dynamic destination once into X/Y and compute the runtime expected end — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.4 Implement the carry/end-address boolean check and `$10000` case — `packages/compiler/src/machine/lower-c64.ts`
- [ ] 4.2.5 Emit one name data object per unit and link code/data only when reached — `packages/compiler/src/machine/lower-data.ts`, `packages/compiler/src/layout/`
- [ ] 4.2.6 Close loader stack peak and compiler temporaries — `packages/compiler/src/storage/`
- [ ] 4.2.7 Prove KERNAL workspace and SFA interference — `packages/compiler/src/storage/`
- [ ] 4.2.8 Run ST-51..ST-64 and record the green phase

### Step 4.3: Implementation Tests and Verification

- [ ] 4.3.1 Write implementation tests for sequence bytes/cycles, dynamic arithmetic, and unreachable omission — `packages/compiler/src/machine/loader.impl.test.ts`
- [ ] 4.3.2 Add the exact assembly/cost expectation and record the 27-byte/37-cycle setup floor — `test/rd07/loader-lowering.spec.test.ts`
- [ ] 4.3.3 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Exact KERNAL sequence and success check
- [ ] No loader when unreachable
- [ ] Resources closed before final layout

**Verify**: `yarn test test/rd07/loader-lowering.spec.test.ts packages/compiler/src/machine/loader.impl.test.ts`

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

- [ ] 5.2.1 Prove and record every physical destination interval — `packages/compiler/src/layout/`
- [ ] 5.2.2 Reject code/SFA/stack/vector/loader conflicts with every owner — `packages/compiler/src/layout/`
- [ ] 5.2.3 Reject MMIO/ROM/player conflicts with every owner — `packages/compiler/src/layout/`
- [ ] 5.2.4 Prove CPU/VIC visibility and BASIC-ROM banking — `packages/compiler/src/layout/`
- [ ] 5.2.5 Derive VIC fields from the destination — `packages/compiler/src/machine/vic-fields.ts`
- [ ] 5.2.6 Add exclusive load-state residencies — `packages/compiler/src/services/evidence.ts`
- [ ] 5.2.7 Emit state views without double counting — `packages/compiler/src/services/evidence.ts`
- [ ] 5.2.8 Emit loader/destination/KERNAL records and free-space facts — `packages/compiler/src/services/memory-evidence-records.ts`
- [ ] 5.2.9 Run ST-65..ST-76 and record the green phase

### Step 5.3: Implementation Tests and Verification

- [ ] 5.3.1 Write implementation tests for exclusive views, tiling, and overlap diagnostics — `packages/compiler/src/services/d64-memory.impl.test.ts`
- [ ] 5.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Every destination is proved or rejected with owners
- [ ] State views never double-count
- [ ] Disk bytes never appear as RAM

**Verify**: `yarn test test/rd07/load-layout.spec.test.ts packages/compiler/src/services/d64-memory.impl.test.ts`

---

## Phase 6: D64 Packager and Independent Codec

> **Reasoning**: max — binary format, capacity, determinism, and an independent oracle.
> **Lenses**: machine code, target platform, security.

### Step 6.1: Specification Tests and Oracle

**Reference**: [03-05](03-05-d64-packager.md) · ST-77..ST-96 · AR-P9..AR-P13
**Objective**: Build the independent decoder and pin every byte-level D64 rule.

- [ ] 6.1.1 [spec-author] Write the independent D64 decoder with no production-serializer import — `test/rd07/d64-decoder.ts`
- [ ] 6.1.2 [spec-author] Write specification tests from ST-77..ST-96 — `test/rd07/d64-codec.spec.test.ts`
- [ ] 6.1.3 Run the new spec suite and record the red phase

### Step 6.2: Implementation

**Reference**: [03-05](03-05-d64-packager.md) §Format facts, §Directory, §File data

- [ ] 6.2.1 Measure the representative multi-block KERNAL load under VICE 3.10 and record the policy decision — `codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/`
- [ ] 6.2.2 Implement geometry, offsets, and the 174,848-byte image buffer — `packages/compiler/src/packaging/d64/geometry.ts`
- [ ] 6.2.3 Implement the BAM, header, label, ID, DOS type, and free counts — `packages/compiler/src/packaging/d64/bam.ts`
- [ ] 6.2.4 Implement the directory chain — `packages/compiler/src/packaging/d64/directory.ts`
- [ ] 6.2.5 Implement directory entries and names — `packages/compiler/src/packaging/d64/directory.ts`, `names.ts`
- [ ] 6.2.6 Implement interleave-10 allocation — `packages/compiler/src/packaging/d64/allocator.ts`
- [ ] 6.2.7 Implement 254-byte chunks, links, and final-sector lengths — `packages/compiler/src/packaging/d64/image.ts`
- [ ] 6.2.8 Implement boot-first ordering and `$0000` unit headers — `packages/compiler/src/packaging/d64/image.ts`
- [ ] 6.2.9 Implement fill and deterministic assembly — `packages/compiler/src/packaging/d64/image.ts`
- [ ] 6.2.10 Implement capacity, name-collision, and structural validation — `packages/compiler/src/packaging/d64/`
- [ ] 6.2.11 Run ST-77..ST-96 and record the green phase

### Step 6.3: Implementation Tests and Verification

- [ ] 6.3.1 Write implementation tests for allocator wrap, final-sector edges, name limits, and invariants — `packages/compiler/src/packaging/d64/*.impl.test.ts`
- [ ] 6.3.2 Decode the exact image and verify BAM, directory, chains, component bytes, fill, and hashes — `test/rd07/d64-codec.spec.test.ts`
- [ ] 6.3.3 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Byte-exact deterministic D64
- [ ] Independent decoder proves every structure
- [ ] Exact-fit and one-over capacity behavior

**Verify**: `yarn test test/rd07/d64-codec.spec.test.ts packages/compiler/src/packaging/d64`

---

## Phase 7: D64 Profile, Publication, and Run

> **Reasoning**: high — profile composition, atomic publication, and emulator binding.
> **Lenses**: target platform, SFA/ABI, security.

### Step 7.1: Specification Tests

**Reference**: [03-06](03-06-artifact-publication-and-run.md) · ST-97..ST-108 · AR-P9, AR-P15
**Objective**: Pin the profile, eight-file generation, publication, and exact VICE behavior.

- [ ] 7.1.1 [spec-author] Write specification tests from ST-97..ST-108 — `test/rd07/d64-publication.spec.test.ts`
- [ ] 7.1.2 Run the new spec suite and record the red phase

### Step 7.2: Implementation

**Reference**: [03-06](03-06-artifact-publication-and-run.md) §Profile composition, §Publication, §`run`

- [ ] 7.2.1 Add the D64 profile row and packager facts — `packages/compiler/src/profile/c64-kernal.ts`, `packages/compiler/src/target/c64-kernal.ts`
- [ ] 7.2.2 Admit exact D64 profile selection — `packages/compiler/src/target/profile.ts`
- [ ] 7.2.3 Invoke the packager after verified ACME output and stage the `.d64` — `packages/compiler/src/services/services.ts`
- [ ] 7.2.4 Accept the D64 primary in publication and `evidenceAgrees` — `packages/compiler/src/publication/`
- [ ] 7.2.5 Write the eight-file generation and D64 `.build.json` package — `packages/compiler/src/services/evidence.ts`
- [ ] 7.2.6 Probe VICE 3.10 and freeze the exact drive-8/autostart argv — `test/rd07/`, `packages/compiler/src/services/vice.ts`
- [ ] 7.2.7 Bind `run` to the pinned fresh image and first boot entry — `packages/compiler/src/services/services.ts`, `packages/compiler/src/services/vice.ts`
- [ ] 7.2.8 Separate build/pin/mount/autostart/runtime/timeout/cancellation failures — `packages/compiler/src/services/`
- [ ] 7.2.9 Run ST-97..ST-108 and record the green phase

### Step 7.3: Implementation Tests and Verification

- [ ] 7.3.1 Write implementation tests for profile composition, primary acceptance, and argv construction — `packages/compiler/src/services/d64-publication.impl.test.ts`
- [ ] 7.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] Executable D64 profile
- [ ] Fresh pinned image mounted as drive 8
- [ ] PRG path unchanged

**Verify**: `yarn test test/rd07/d64-publication.spec.test.ts packages/compiler/src/services/d64-publication.impl.test.ts`

---

## Phase 8: Evidence and Costs

> **Reasoning**: high — cross-sidecar truth and no double counting.
> **Lenses**: semantics, security, target platform.

### Step 8.1: Specification Tests

**Reference**: [03-07](03-07-evidence-and-costs.md) · ST-109..ST-115 · AR-P14
**Objective**: Pin every D64, loader, destination, load-unit, and cost field and its reconciliation.

- [ ] 8.1.1 [spec-author] Write specification tests from ST-109..ST-115 — `test/rd07/d64-evidence.spec.test.ts`
- [ ] 8.1.2 Run the new spec suite and record the red phase

### Step 8.2: Implementation

**Reference**: [03-07](03-07-evidence-and-costs.md) §Implementation Details

- [ ] 8.2.1 Emit loadable asset placements, constraints, and aliases — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.2 Emit loader and destination memory records — `packages/compiler/src/services/memory-evidence-records.ts`
- [ ] 8.2.3 Emit exclusive-state memory views — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.4 Emit boot/loader/filename/call-site/disk/KERNAL cost entries and `Unknown` timing — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.5 Populate debug load units and `loadUnitIndex` ranges — `packages/compiler/src/services/evidence-records.ts`
- [ ] 8.2.6 Emit the D64 `.build.json` package and component set — `packages/compiler/src/services/evidence.ts`
- [ ] 8.2.7 Add cross-sidecar reference and accounting checks — `packages/compiler/src/publication/sidecar-consistency.ts`
- [ ] 8.2.8 Run ST-109..ST-115 and record the green phase

### Step 8.3: Implementation Tests and Verification

- [ ] 8.3.1 Write implementation tests for field ordering, unknown timing, and mismatch rejection — `packages/compiler/src/services/d64-evidence.impl.test.ts`
- [ ] 8.3.2 Run directed tests, `yarn build`, `yarn typecheck`, and targeted Prettier

**Deliverables**:
- [ ] All version-1 D64 records produced
- [ ] No double counting
- [ ] Mismatch rejects before publication

**Verify**: `yarn test test/rd07/d64-evidence.spec.test.ts packages/compiler/src/services/d64-evidence.impl.test.ts`

---

## Phase 9: Examples, Qualification, and Closeout

> **Reasoning**: high — end-to-end proof and honest boundary.
> **Lenses**: semantics, target platform, machine code, security.

### Step 9.1: Examples and Runtime Qualification

**Reference**: [03-06](03-06-artifact-publication-and-run.md), [03-07](03-07-evidence-and-costs.md) · ST-116..ST-131

- [ ] 9.1.1 Add focused examples: composite level, sequential reuse, failure path, quiescence/restoration, unreachable omission, capacity — `examples/rd07-loadable/`
- [ ] 9.1.2 Build the VICE fixture and bounded observation driver — `test/rd07/vice-driver.ts`
- [ ] 9.1.3 Prove boot, load success, exact bytes, canaries, failure, BASIC return, and no hidden copy — `test/rd07/d64-vice.spec.test.ts`
- [ ] 9.1.4 Run the bounded longer-replacement observation with an isolated destination and canaries — `test/rd07/d64-vice.spec.test.ts`
- [ ] 9.1.5 Record D64 serialization, decode, flow analysis, build, and bounded-run host observations — `test/rd07/qualification.spec.test.ts`
- [ ] 9.1.6 Add security cases for path containment, name collision, no external packager, and seeded integrity failures — `test/rd07/security.spec.test.ts`

### Step 9.2: Boundary and Closeout

- [ ] 9.2.1 Run the complete RD-07 boundary once after integration, including affected existing suites
- [ ] 9.2.2 Run the deferral-expiry and durable-register scan; re-own every due item
- [ ] 9.2.3 Write the closeout with `VICE-verified / hardware-unverified`, evidence, and remaining debt — `codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/09-closeout.md`
- [ ] 9.2.4 Update the feature and portfolio roadmaps; verify `spec/` is untouched; final Prettier/build/typecheck/test

**Deliverables**:
- [ ] Playable load example on the fresh D64
- [ ] Runtime evidence and honest hardware boundary
- [ ] Closed deferrals and updated roadmap

**Verify**: complete RD-07 boundary, `yarn build`, `yarn typecheck`, `yarn test`, targeted Prettier

---

## Dependencies

```
Phase 1 (units)
    ↓
Phase 2 (destination proof)
    ↓
Phase 3 (publication/quiescence)
    ↓
Phase 4 (loader lowering)
    ↓
Phase 5 (layout/memory)
    ↓
Phase 6 (D64 packager)
    ↓
Phase 7 (profile/publication/run)
    ↓
Phase 8 (evidence/costs)
    ↓
Phase 9 (examples/qualification)
```

Phases 5 and 6 may proceed in parallel after Phase 4 for the serializer and memory-record work, but
Phase 7 waits for both.

## Success Criteria

1. All 120 tasks are `[x]`.
2. Every RD-07 Must/Should item is implemented or explicitly bounded.
3. Specification tests pass; independent decoder proves the image.
4. `yarn build`, `yarn typecheck`, and the complete RD-07 boundary pass.
5. `spec/` is byte-identical to the frozen baseline.
6. No `PLACEHOLDER`/`TODO`/dead code remains in the new surface.
7. The closeout records `VICE-verified / hardware-unverified` and the exact remaining debt.
