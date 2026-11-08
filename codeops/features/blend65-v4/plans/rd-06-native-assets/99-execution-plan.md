# Execution Plan: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-11-07
> **Progress**: 0/151 tasks (0%)
> **CodeOps Artifact Schema**: 1

## Overview

Implement RD-06 in nine active phases plus the final closeout. Phases 1–8 are unblocked: core
dispatch and public fixtures, PSID, Koala, compile-time refinement, resident layout/evidence,
examples/status, SpritePad and CharPad. The vendor manuals and real examples are available under
`/home/gevik/workdir/github/blend65.ri/apps`. Phase 9 (GoatTracker 2.77) is moved out of RD-06 by
AR-58. Phase 10.1 is the unblocked integration and contingency closeout; Phase 10.2 is the final
verification and closeout.

**🚨 Update this document after EACH completed task!**

---

## Implementation Phases

| Phase | Title | Tasks |
| ----- | ----- | ----- |
| 1 | Asset handler core, dispatch and public fixtures | 34 |
| 2 | PSID data and callable-audio seam | 19 |
| 3 | Koala parser and components | 13 |
| 4 | Compile-time refinement and Q-P15 | 13 |
| 5 | Resident layout, derived fields and evidence | 24 |
| 6 | Examples, evidence and status | 13 |
| 7 | SpritePad SPD v5 | 12 |
| 8 | CharPad CTM v9 | 12 |
| 9 | GoatTracker 2.77 adapter (moved out) | 0 |
| 10 | Integration and final closeout | 11 |

**Total: 151 tasks across 10 phases** (Phase 9 has no tasks). No fabricated hour estimates; scope is
bounded by the CodeOps task-size criteria: one reviewable change, 1–3 files, about 50–150 lines,
immediately testable.

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes in the phase sections below are the **single source of truth** for progress.
> Every task line appears exactly once in this document. The executing agent MUST:
>
> 1. **On implementation:** mark the task `[~]` with a timestamp —
>    `- [~] 1.1.1 Task description ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote it to `[x]` —
>    `- [x] 1.1.1 Task description ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header** (`> **Progress**: X/Y tasks (Z%)`) and the Last Updated stamp
>    after EVERY task — never batch updates. Only `[x]` counts as complete.
> 4. **Resume** by scanning the phase sections top-to-bottom: the first `[~]` task is resumed first,
>    else the first `[ ]` task. A `[!]` task is blocked and is skipped until its gate is cleared.
> 5. **On blocker:** mark the task `[!]` and append `Blocked: <short reason>` on the same line.
>    The plan lifecycle is `Ready`, `Executing`, `Done`, or `Blocked`, derived from these markers.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented. Failure to keep the marks current
> means progress is invisible after crashes, context resets, or session handoffs.

---

## Phase 1: Asset handler core and dispatch

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, target platform
> **Reasoning**: high — typed frontend, identity and dispatch boundary

### Step 1.1: Specification tests first

**Reference**: [03-01](03-01-asset-handler-core.md) · ST-1–ST-6, ST-10–ST-13, ST-17, ST-18, ST-165–ST-170 · AR-3, AR-4, AR-9, AR-10, AR-11, AR-17, AR-18, AR-23, AR-26, AR-53
**Objective**: Lock the handler contract, identity, scalar typing, owner rules and security boundary before code.

- [ ] 1.1.1 [spec-author] Write core dispatch, identity and typing specification tests from ST-1–ST-6, ST-10–ST-13, ST-17 and ST-18 — `packages/compiler/src/assets/asset-handler.spec.test.ts`
- [ ] 1.1.2 [spec-author] Write frontend-metadata and security specification tests from ST-165–ST-170 — `test/rd06/frontend-assets.spec.test.ts`, `test/rd06/security-assets.spec.test.ts`
- [ ] 1.1.3 Run both specification suites and record the red phase — `yarn workspace @blend65/compiler test src/assets/asset-handler.spec.test.ts && yarn vitest run test/rd06/frontend-assets.spec.test.ts test/rd06/security-assets.spec.test.ts`

**Deliverables**:
- [ ] All core, frontend-metadata and security cases encoded with concrete input/output pairs
- [ ] Red evidence recorded in the task line

**Verify**: `yarn workspace @blend65/compiler test src/assets/asset-handler.spec.test.ts && yarn vitest run test/rd06/frontend-assets.spec.test.ts test/rd06/security-assets.spec.test.ts` (must fail for the expected reasons)

### Step 1.2: Implementation

**Reference**: [03-01](03-01-asset-handler-core.md) · AR-3, AR-4, AR-9, AR-10, AR-11
**Objective**: Add the target-neutral seam, scalar values, identity, dispatch and owner rule.

- [ ] 1.2.1 Add the target-neutral handler, request, output, constraint and selector types — `packages/compiler/src/assets/asset-handler.ts`
- [ ] 1.2.2 Add `EmbeddedScalarValue`, `EmbeddedValue` union, provenance and extended `SemanticAsset` — `packages/compiler/src/assets/asset-types.ts`
- [ ] 1.2.3 Add native and raw canonical identity helpers — `packages/compiler/src/assets/asset-identity.ts`
- [ ] 1.2.4 Add extension dispatch, selector resolution, owner guard and failure mapping — `packages/compiler/src/assets/asset-dispatch.ts`
- [ ] 1.2.5 Expose the existing resident/loadable owner on every embedded request without narrowing the internal mutable/local owner values — `packages/compiler/src/frontend/source-discovery.ts`
- [ ] 1.2.6 Select the profile and route native requests through `dispatchAsset`; keep raw behavior unchanged — `packages/compiler/src/frontend/service.ts`
- [ ] 1.2.7 Inject scalar and array embedded values and distinguish E10144 from E10140 — `packages/compiler/src/frontend/builtin-calls.ts`, `packages/compiler/src/frontend/aggregate-types.ts`, `packages/compiler/src/frontend/aggregates.ts`
- [ ] 1.2.8 Merge handler constraints with source `place(...)` and keep the loadable rule — `packages/compiler/src/frontend/asset-placement.ts`
- [ ] 1.2.9 Carry handler provenance and constraints into semantic assets — `packages/compiler/src/semantic/lower.ts`
- [ ] 1.2.10 Update W10151 grouping and extend the `.assets.json` evidence id with input identity/representation — `packages/compiler/src/frontend/service.ts`, `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/artifacts/assets-evidence-validator.ts`
- [ ] 1.2.11 Add the E10204 native-loadable guard, precise resident-only message and expressiveness-ledger entry; keep raw loadable behavior — `packages/compiler/src/assets/asset-handler.impl.test.ts`, `test/rd04/expressiveness-ledger.json`
- [ ] 1.2.12 Expose selector inventory, exact types, availability, provenance and pre-layout constraints in the shared semantic model — `packages/compiler/src/frontend/semantic-types.ts`, `packages/compiler/src/frontend/analyzer.ts`
- [ ] 1.2.13 Add the diagnostic formatting/redaction helper for declaration, relative spelling, handler identity, failed field and remedy — `packages/compiler/src/assets/asset-diagnostics.ts`, `packages/compiler/src/frontend/diagnostics.ts`
- [ ] 1.2.14 Harden native dispatch containment and ACME-safe handling of names/tags — `packages/compiler/src/assets/asset-dispatch.ts`, `packages/compiler/src/artifacts/acme-serializer.ts`
- [ ] 1.2.15 Add the closed `reservedExtensions` profile set and fail-closed dispatch before raw fallback — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/assets/asset-dispatch.ts`
- [ ] 1.2.16 Make `SemanticAsset` a resident/scalar union and exclude scalar and zero-byte assets from resident roots — `packages/compiler/src/semantic/lower.ts`, `packages/compiler/src/assets/asset-types.ts`
- [ ] 1.2.17 Add the native 1 MiB bounded read path and the 65,535-byte selected-output gate, preserving raw behavior — `packages/compiler/src/assets/raw-asset.ts`, `packages/compiler/src/assets/asset-dispatch.ts`

**Deliverables**:
- [ ] Handler contract, identity and dispatch compile against the public frontend boundary
- [ ] Raw tests and existing selector-free behavior remain unchanged

**Verify**: `yarn workspace @blend65/compiler test src/assets src/frontend`

### Step 1.3: Green, implementation tests and hardening

**Reference**: AR-6, AR-38
**Objective**: Prove the spec tests pass, cover internals, and run the phase checkpoint.

- [ ] 1.3.1 Run the core specification tests and verify the green phase — `yarn workspace @blend65/compiler test src/assets/asset-handler.spec.test.ts`
- [ ] 1.3.2 Run the frontend-metadata and security specification tests and verify the green phase — `yarn vitest run test/rd06/frontend-assets.spec.test.ts test/rd06/security-assets.spec.test.ts`
- [ ] 1.3.3 Write implementation tests for identity collisions, owner edges, selector ordering, reserved extensions and diagnostic spans — `packages/compiler/src/assets/asset-handler.impl.test.ts`
- [ ] 1.3.4 Write security implementation tests for path containment, hostile names/tags, overflow boundaries, diagnostic redaction and ACME injection — `test/rd06/security-assets.impl.test.ts`
- [ ] 1.3.5 Run the directed package and root tests — `yarn workspace @blend65/compiler test src/assets src/frontend && yarn vitest run test/rd06/frontend-assets.spec.test.ts test/rd06/security-assets.spec.test.ts test/rd06/security-assets.impl.test.ts`
- [ ] 1.3.6 Run `yarn prettier --check` on touched files, `yarn build` and `yarn typecheck`
- [ ] 1.3.7 Dispatch independent correctness, semantics and target-platform reviews of the phase diff and record dispositions

**Deliverables**:
- [ ] Core, frontend-metadata and security ST cases pass
- [ ] No regression in existing raw-asset tests
- [ ] Review findings recorded and resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/assets src/frontend && yarn vitest run test/rd06/frontend-assets.spec.test.ts test/rd06/security-assets.spec.test.ts test/rd06/security-assets.impl.test.ts`

### Step 1.4: Public fixture foundation (unblocked)

**Reference**: [03-07](03-07-fixtures-qualification.md) · AR-7, AR-15
**Objective**: Create the manifest and public fixtures before the handler spec tests need them.

- [ ] 1.4.1 Add the manifest schema, types and validator — `test/rd06/fixture-tools/manifest.ts`
- [ ] 1.4.2 Commit the public raw fixtures and boundary cases — `test/rd06/fixtures/public/raw/`
- [ ] 1.4.3 Commit the public PSID v1–v4 fixed/payload fixtures — `test/rd06/fixtures/public/psid/`
- [ ] 1.4.4 Commit the public Koala zero/patterned/high-nibble fixtures — `test/rd06/fixtures/public/koala/`
- [ ] 1.4.5 Record every fixture entry, spec-derived expectation and SHA-256 — `test/rd06/fixtures/manifest.json`
- [ ] 1.4.6 Add the fixture-manifest completeness/hash test — `test/rd06/fixtures.spec.test.ts`
- [ ] 1.4.7 Run the fixture foundation tests — `yarn vitest run test/rd06/fixtures.spec.test.ts`

**Deliverables**:
- [ ] Public fixtures are deterministic, committed and manifest-backed
- [ ] Phase 2/3 spec tests can use them without a cycle

**Verify**: `yarn vitest run test/rd06/fixtures.spec.test.ts`

---

## Phase 2: PSID data and callable-audio seam

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, SFA/ABI, machine code, target platform
> **Reasoning**: max — untrusted binary parsing, fixed placement, audio ABI and overlap proof

### Step 2.1: Specification tests first

**Reference**: [03-03](03-03-psid-and-player-adapters.md) · ST-14–ST-16, ST-66–ST-91, ST-93, ST-181 · AR-13, AR-21, AR-44, AR-47
**Objective**: Lock every PSID version, load rule, rejection and audio-contract behavior.

- [ ] 2.1.1 [spec-author] Write PSID container, version, load/entry and rejection specification tests from ST-66–ST-82 — `packages/compiler/src/assets/c64/psid.spec.test.ts`
- [ ] 2.1.2 [spec-author] Write PSID compatibility, scalar typing and audio-contract specification tests from ST-14–ST-16, ST-83–ST-91, ST-93 and ST-181 — `packages/compiler/src/assets/c64/psid.spec.test.ts`
- [ ] 2.1.3 Run the PSID specification tests and record the red phase — `yarn workspace @blend65/compiler test src/assets/c64/psid.spec.test.ts`

**Deliverables**:
- [ ] Every accepted version, load form, scalar type, rejection and audio operation encoded
- [ ] Red evidence recorded

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/psid.spec.test.ts` (must fail for the expected reasons)

### Step 2.2: Implementation

**Reference**: [03-03](03-03-psid-and-player-adapters.md) · AR-21, AR-44, AR-47
**Objective**: Implement PSID parsing, compatibility, fixed load and the generic audio seam.

- [ ] 2.2.1 Add PSID header constants, offsets, version-specific structure and nonzero-relocation rejection — `packages/compiler/src/assets/c64/psid.ts`
- [ ] 2.2.2 Resolve payload, effective load, init and play addresses with overflow-safe arithmetic — `packages/compiler/src/assets/c64/psid.ts`
- [ ] 2.2.3 Decode video/model/second/third SID fields and emit E10261 — `packages/compiler/src/assets/c64/psid.ts`
- [ ] 2.2.4 Build the selector inventory and typed `data`/`init_address`/`play_address` outputs — `packages/compiler/src/assets/c64/psid.ts`
- [ ] 2.2.5 Attach the fixed-load constraint and merge it with source placement — `packages/compiler/src/assets/c64/psid.ts`, `packages/compiler/src/frontend/asset-placement.ts`
- [ ] 2.2.6 Register the PSID handler in the C64 profile map — `packages/compiler/src/assets/c64/index.ts`, `packages/compiler/src/frontend/profile.ts`
- [ ] 2.2.7 Add the closed `AudioPlayerContract` record (full §7.3.1 obligations) and the empty baseline map — `packages/compiler/src/assets/c64/audio-contract.ts`
- [ ] 2.2.8 Add `c64.audio` capabilities, contract lookup, E10256 and E10257 — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/frontend/direct-calls.ts`
- [ ] 2.2.9 Add static domain-overlap analysis and E10258 — `packages/compiler/src/semantic/whole-program.ts`, `packages/compiler/src/semantic/interrupt-domains.ts`
- [ ] 2.2.10 Lower constant audio operations through `lower-platform.ts` to register setup and absolute JSR — `packages/compiler/src/machine/lower-platform.ts`, `packages/compiler/src/machine/lower-call.ts`

**Deliverables**:
- [ ] PSID v1–v4 parse and reject exactly as specified
- [ ] Plain PSID never becomes callable without a contract
- [ ] Empty baseline contract map is honest

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64 src/frontend`

### Step 2.3: Green, implementation tests, VICE and review

**Reference**: AR-6, AR-38
**Objective**: Prove the specification, cover boundaries, and observe fixed placement at runtime.

- [ ] 2.3.1 Run the PSID specification tests and verify the green phase — `yarn workspace @blend65/compiler test src/assets/c64/psid.spec.test.ts`
- [ ] 2.3.2 Write PSID arithmetic, relocation, reserved-flag, overflow, boundary and malformed-derivation implementation tests — `packages/compiler/src/assets/c64/psid.impl.test.ts`
- [ ] 2.3.3 Write audio-contract validation, feature pruning and overlap implementation tests — `packages/compiler/src/assets/c64/audio-contract.impl.test.ts`
- [ ] 2.3.4 Add a bounded VICE check for fixed-load and payload-load-address placement — `test/rd06/vice-psid.spec.test.ts`
- [ ] 2.3.5 Run the directed PSID/audio tests and the phase checkpoint — `yarn workspace @blend65/compiler test src/assets/c64 && yarn vitest run test/rd06/vice-psid.spec.test.ts`
- [ ] 2.3.6 Dispatch independent semantics, SFA/ABI, machine-code and platform reviews and record dispositions

**Deliverables**:
- [ ] ST-66–ST-93 pass
- [ ] Fixed placement is VICE-observed
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/assets/c64 && yarn vitest run test/rd06/vice-psid.spec.test.ts`

---

## Phase 3: Koala and VIC display fields

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: machine code, target platform
> **Reasoning**: high — hardware alignment/visibility and derived register fields

### Step 3.1: Specification tests first

**Reference**: [03-04](03-04-koala.md) · ST-94–ST-110, ST-186 · AR-22, AR-30
**Objective**: Lock the exact Koala components, high-bit rule and VIC fields.

- [ ] 3.1.1 [spec-author] Write Koala length, component and high-bit specification tests from ST-94–ST-101 — `packages/compiler/src/assets/c64/koala.spec.test.ts`
- [ ] 3.1.2 [spec-author] Write Koala requested-only, transfer and fallback specification tests from ST-108, ST-109 and ST-110 — `packages/compiler/src/assets/c64/koala.spec.test.ts`
- [ ] 3.1.3 Run the Koala specification tests and record the red phase — `yarn workspace @blend65/compiler test src/assets/c64/koala.spec.test.ts`

**Deliverables**:
- [ ] Four selectors, high-bit preservation, alignment and derived fields encoded
- [ ] Red evidence recorded

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/koala.spec.test.ts` (must fail for the expected reasons)

### Step 3.2: Implementation

**Reference**: [03-04](03-04-koala.md) · AR-22, AR-30
**Objective**: Implement the Koala handler and the two missing VIC select operations.

- [ ] 3.2.1 Add Koala length/load-address/component validation — `packages/compiler/src/assets/c64/koala.ts`
- [ ] 3.2.2 Build the four typed outputs and preserve every source byte — `packages/compiler/src/assets/c64/koala.ts`
- [ ] 3.2.3 Attach bitmap 8-KiB and screen 1-KiB alignment/visibility constraints — `packages/compiler/src/assets/c64/koala.ts`
- [ ] 3.2.4 Register the Koala handler for `.kla` and `.koa` — `packages/compiler/src/assets/c64/index.ts`
- [ ] 3.2.5 Add `vicCharsetSelect`, `vicBitmapSelect` and `vicScreenSelect` pure-field capabilities — `packages/compiler/src/frontend/profile.ts`
- [ ] 3.2.6 Add the three derived-field transforms and post-layout resolution; define them as pure field constants — `packages/compiler/src/machine/lower-c64.ts`, `packages/compiler/src/machine/machine-types.ts`, `packages/compiler/src/layout/c64-layout-objects.ts`

**Deliverables**:
- [ ] Koala selectors emit only requested bytes
- [ ] Bitmap/screen fields derive from final placement

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64 src/layout`

### Step 3.3: Green, implementation tests, VICE and review

**Reference**: AR-6, AR-38
**Objective**: Prove the specification and observe display data in VICE.

- [ ] 3.3.1 Run the Koala specification tests and verify the green phase — `yarn workspace @blend65/compiler test src/assets/c64/koala.spec.test.ts`
- [ ] 3.3.2 Write Koala boundary, high-bit, extension-casing and requested-only implementation tests — `packages/compiler/src/assets/c64/koala.impl.test.ts`
- [ ] 3.3.3 Run the directed Koala tests and the phase checkpoint — `yarn workspace @blend65/compiler test src/assets/c64`
- [ ] 3.3.4 Dispatch independent machine-code and platform reviews and record dispositions

**Deliverables**:
- [ ] ST-94–ST-101, ST-108 and ST-110 pass
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/assets/c64`

---

## Phase 4: Compile-time refinement and Q-P15

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, machine code
> **Reasoning**: high — compile-time evaluation, artifact identity and Q-P15 proof

### Step 4.1: Specification tests first

**Reference**: [03-05](03-05-comptime-and-qp15.md) · ST-111–ST-128 · AR-27, AR-28
**Objective**: Freeze the Q-P15 workload and lock compile-time-only behavior before implementation.

- [ ] 4.1.1 [spec-author] Author the Q-P15 workload source, panel data, conflict metadata, user renderer and expected artifact/runtime values — `test/rd06/qualification/q-p15/`
- [ ] 4.1.2 [spec-author] Write compile-time refinement and Q-P15 specification tests from ST-111–ST-128 against the frozen workload — `test/rd06/comptime-assets.spec.test.ts`, `test/rd06/qp15.spec.test.ts`
- [ ] 4.1.3 Run the compile-time/Q-P15 specification tests and record the red phase — `yarn vitest run test/rd06/comptime-assets.spec.test.ts test/rd06/qp15.spec.test.ts`

**Deliverables**:
- [ ] Compile-time reads, budget, forbidden operations and Q-P15 expectations encoded
- [ ] Red evidence recorded

**Verify**: `yarn vitest run test/rd06/comptime-assets.spec.test.ts test/rd06/qp15.spec.test.ts` (must fail for the expected reasons)

### Step 4.2: Implementation and Q-P15 workload

**Reference**: [03-05](03-05-comptime-and-qp15.md) · AR-27, AR-28
**Objective**: Make embedded values readable at compile time and build the Q-P15 oracle.

- [ ] 4.2.1 Add scalar embedded reads to the compile-time evaluator — `packages/compiler/src/frontend/comptime.ts`, `packages/compiler/src/frontend/comptime-aggregates.ts`
- [ ] 4.2.2 Prove embedded array reads and fix any gap without a new language feature — `packages/compiler/src/frontend/comptime-aggregates.ts`
- [ ] 4.2.3 Verify the visibility/budget rule and add the regression test — `packages/compiler/src/frontend/comptime-budget.ts`
- [ ] 4.2.4 Build the frozen Q-P15 workload and verify the artifact oracle for bytes, masks, priority, reuse, padding and visibility — `test/rd06/qualification/q-p15/`, `test/rd06/qp15.spec.test.ts`
- [ ] 4.2.5 Add the bounded Q-P15 VICE observations reusing the existing harness — `test/rd06/vice-qp15.spec.test.ts`

**Deliverables**:
- [ ] Embedded scalars/arrays usable in `comptime function`
- [ ] Q-P15 builds both representations with exact metadata
- [ ] No runtime support module

**Verify**: `yarn vitest run test/rd06/comptime-assets.spec.test.ts test/rd06/qp15.spec.test.ts`

### Step 4.3: Green, implementation tests, VICE and review

**Reference**: AR-6, AR-38
**Objective**: Prove the specification and observe Q-P15 at runtime.

- [ ] 4.3.1 Run the compile-time/Q-P15 specification tests and verify the green phase — `yarn vitest run test/rd06/comptime-assets.spec.test.ts test/rd06/qp15.spec.test.ts`
- [ ] 4.3.2 Write compile-time budget and aggregate-read implementation tests — `packages/compiler/src/frontend/comptime-assets.impl.test.ts`
- [ ] 4.3.3 Run the Q-P15 VICE check sequentially — `yarn vitest run test/rd06/vice-qp15.spec.test.ts`
- [ ] 4.3.4 Run the directed compile-time/Q-P15 tests and the phase checkpoint
- [ ] 4.3.5 Dispatch independent semantics and machine-code reviews and record dispositions

**Deliverables**:
- [ ] ST-111–ST-128 pass
- [ ] Q-P15 runtime observed
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn vitest run test/rd06/comptime-assets.spec.test.ts test/rd06/qp15.spec.test.ts test/rd06/vice-qp15.spec.test.ts`

---

## Phase 5: Resident layout, derived fields and evidence

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: SFA/ABI, machine code, target platform
> **Reasoning**: max — whole-program interval proof, derived hardware fields and evidence integrity

### Step 5.1: Specification tests first

**Reference**: [03-06](03-06-resident-layout-evidence.md) · ST-92, ST-129–ST-154, ST-182, ST-185 · AR-5, AR-11, AR-14, AR-29–AR-35
**Objective**: Lock every interval, view, derived field and sidecar expectation.

- [ ] 5.1.1 [spec-author] Write interval, alignment, Koala placement, VIC-field and composition specification tests from ST-102–ST-107, ST-109, ST-129–ST-145, ST-182, ST-185 and ST-186 — `test/rd06/layout-assets.spec.test.ts`
- [ ] 5.1.2 [spec-author] Write evidence, scalar-record and cross-sidecar specification tests from ST-92 and ST-146–ST-154 — `test/rd06/layout-assets.spec.test.ts`
- [ ] 5.1.3 Run the layout/evidence specification tests and record the red phase — `yarn vitest run test/rd06/layout-assets.spec.test.ts`

**Deliverables**:
- [ ] Interval, view, alignment, visibility, derived-field and sidecar expectations encoded
- [ ] Red evidence recorded

**Verify**: `yarn vitest run test/rd06/layout-assets.spec.test.ts` (must fail for the expected reasons)

### Step 5.2: Implementation

**Reference**: [03-06](03-06-resident-layout-evidence.md) · AR-5, AR-11, AR-14, AR-29–AR-35
**Objective**: Extend the existing first-fit with views, constraints, derived fields and evidence.

- [ ] 5.2.1 Add view and free-interval types and per-view hole calculation bounded to the allocatable resident window — `packages/compiler/src/layout/c64-layout.ts`, `packages/compiler/src/layout/c64-layout-objects.ts`
- [ ] 5.2.2 Add the object constraint model and source/handler intersection — `packages/compiler/src/layout/c64-layout-placement.ts`
- [ ] 5.2.3 Enforce sprite 64, charset 2,048, bitmap 8,192 and screen 1,024 alignment — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.4 Enforce VIC visibility, global character-ROM reservation/avoidance and same-bank pairing — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.5 Enforce PSID fixed load, full-bank sprite hole search and the 256-record-plus-screen failure with interval evidence — `packages/compiler/src/layout/c64-layout.ts`
- [ ] 5.2.6 Add the `c64.vic.bank0` profile region and reject other regions — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/frontend/placement.ts`
- [ ] 5.2.7 Populate `.assets.json` handler, selector, constraints, placement, aliases, writable ranges and `compileTime` scalar records; extend the evidence id — `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/artifacts/assets-evidence-validator.ts`
- [ ] 5.2.8 Populate `.memory.json` intervals, views, free intervals, reservations and Color RAM view — `packages/compiler/src/services/evidence.ts`, `packages/compiler/src/services/memory-evidence-records.ts`
- [ ] 5.2.9 Populate `.costs.json` zero/runtime costs and `.debug.json` asset records — `packages/compiler/src/services/evidence.ts`
- [ ] 5.2.10 Keep ACME output free of asset paths and permissive binary directives — `packages/compiler/src/artifacts/acme-serializer.ts`
- [ ] 5.2.11 Extend cross-sidecar reconciliation for handler/selector/constraint and compile-time scalar fields — `packages/compiler/src/publication/sidecar-consistency.ts`
- [ ] 5.2.12 Keep the existing Specification 4 W10150 percentage warning unchanged and add its regression — `packages/compiler/src/services/resource-diagnostics.ts`
- [ ] 5.2.13 Add the `c64.vic.bank0` region and reject other regions; publish per-asset bank/visibility evidence — `packages/compiler/src/frontend/profile.ts`, `packages/compiler/src/frontend/placement.ts`, `packages/compiler/src/services/evidence.ts`

**Deliverables**:
- [ ] Every resident object solves as a physical interval with views
- [ ] Hardware fields derive from final placement
- [ ] Evidence reports complete, reconciled facts

**Verify**: `yarn workspace @blend65/compiler test src/layout src/publication`

### Step 5.3: Green, implementation tests, regression and review

**Reference**: AR-6, AR-38
**Objective**: Prove the specification and keep existing output stable.

- [ ] 5.3.1 Run the layout/evidence specification tests and verify the green phase — `yarn vitest run test/rd06/layout-assets.spec.test.ts`
- [ ] 5.3.2 Write layout cursor, noCross, alignment, derived-field and free-interval implementation tests — `packages/compiler/src/layout/c64-layout-assets.impl.test.ts`
- [ ] 5.3.3 Write sidecar completeness, canonical order and reconciliation implementation tests — `test/rd06/evidence-assets.impl.test.ts`
- [ ] 5.3.4 Run the focused M1/RD-05 layout and artifact regressions — `yarn vitest run test/m1/pipeline.spec.test.ts test/rd05/profile-output.spec.test.ts`
- [ ] 5.3.5 Run the directed layout/evidence suite and phase checkpoint
- [ ] 5.3.6 Dispatch independent SFA/ABI, machine-code and platform reviews and record dispositions
- [ ] 5.3.7 Audit existing fixtures for character-ROM crossings and record any expected artifact changes — `test/m1`, `test/rd05`
- [ ] 5.3.8 Run the bounded Koala visibility and Color RAM transfer VICE check — `test/rd06/vice-koala.spec.test.ts`

**Deliverables**:
- [ ] ST-129–ST-154 pass
- [ ] Existing non-asset output unchanged unless it crosses the character-ROM window; crossings are audited
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/layout src/publication && yarn vitest run test/rd06/layout-assets.spec.test.ts test/rd06/evidence-assets.impl.test.ts`

---

## Phase 6: Fixtures, examples and status

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: target platform, semantics
> **Reasoning**: medium — data fixtures, examples and honest reporting

### Step 6.1: Specification tests first

**Reference**: [03-07](03-07-fixtures-qualification.md) · ST-155–ST-164, ST-180, ST-183, ST-184 · AR-7, AR-15, AR-37–AR-40
**Objective**: Lock manifest completeness, examples, blocked gates and status evidence.

- [ ] 6.1.1 [spec-author] Write fixture-manifest, status and AC-gap specification tests from ST-155–ST-164, ST-180, ST-183 and ST-184 — `test/rd06/fixtures.spec.test.ts`
- [ ] 6.1.2 [spec-author] Write example build/output specification tests — `test/rd06/examples.spec.test.ts`
- [ ] 6.1.3 [spec-author] Write integration, aliasing and blocked-gate specification tests — `test/rd06/integration.spec.test.ts`, `test/rd06/aliasing.spec.test.ts`, `test/rd06/blocked-gates.spec.test.ts`
- [ ] 6.1.4 Run the fixture/example/integration specification tests and record the red phase — `yarn vitest run test/rd06/fixtures.spec.test.ts test/rd06/examples.spec.test.ts test/rd06/integration.spec.test.ts test/rd06/aliasing.spec.test.ts test/rd06/blocked-gates.spec.test.ts`

**Deliverables**:
- [ ] Manifest, hash, public-fixture and status expectations encoded
- [ ] Red evidence recorded

**Verify**: `yarn vitest run test/rd06/fixtures.spec.test.ts` (must fail for the expected reasons)

### Step 6.2: Implementation

**Reference**: [03-07](03-07-fixtures-qualification.md) · AR-7, AR-15, AR-37–AR-40
**Objective**: Create the producer checkpoint, examples and status records.

- [ ] 6.2.1 Add the producer-checkpoint validator and blocked-family checks — `test/rd06/fixture-tools/producer-checkpoint.ts`
- [ ] 6.2.2 Add the focused raw, PSID, Koala, audio embed-only, aliasing and compile-time refinement examples with `blend65.json` + `src/` — `examples/rd06-assets/`
- [ ] 6.2.3 Record per-handler host observations and public status text — `codeops/features/blend65-v4/plans/rd-06-native-assets/08-host-observations.md`
- [ ] 6.2.4 Add the blocked-gate manifest fixtures/expectations — `test/rd06/fixtures/manifest.json`, `test/rd06/blocked-gates.spec.test.ts`

**Deliverables**:
- [ ] Manifest drives every public and producer fixture
- [ ] Public fixtures are deterministic and committed
- [ ] Examples compile and teach consumption without a game architecture

**Verify**: `yarn vitest run test/rd06/fixtures.spec.test.ts`

### Step 6.3: Green, implementation tests and review

**Reference**: AR-6, AR-38
**Objective**: Prove the fixture/status behavior and build the examples.

- [ ] 6.3.1 Run the fixture/status specification tests and verify the green phase — `yarn vitest run test/rd06/fixtures.spec.test.ts`
- [ ] 6.3.2 Write manifest duplicate/unlisted/hash-mismatch implementation tests — `test/rd06/fixtures.impl.test.ts`
- [ ] 6.3.3 Build every focused example and verify exact outputs — `yarn vitest run test/rd06/examples.spec.test.ts`
- [ ] 6.3.4 Run the complete unblocked RD-06 suite and phase checkpoint — `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
- [ ] 6.3.5 Dispatch independent semantics and target-platform reviews of examples and status text

**Deliverables**:
- [ ] ST-155–ST-164, ST-180, ST-183 and ST-184 pass
- [ ] Examples build and report exact outputs
- [ ] Status is honest about missing producer evidence
- [ ] Complete unblocked suite is green

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

---

## Phase 7: SpritePad SPD v5

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, machine code, target platform
> **Reasoning**: max — untrusted producer format, optional matrix and VIC placement
> **Gate**: AR-54–AR-57. Evidence is available at `/home/gevik/workdir/github/blend65.ri/apps`; the official vendor manual and selected real examples are local-only, and the committed fixtures are synthetic.

### Step 7.1: Evidence checkpoint

- [ ] 7.1.1 Record the installed SpritePad 3.80 manual and selected real SPD v5 examples (paths, sizes, SHA-256, local-only retention) and create the producer-evidence manifest — `test/rd06/fixtures/producer-evidence.json`, `test/rd06/fixtures/manifest.json`

**Deliverables**:
- [ ] Vendor manual path/hash and selected real example paths/hashes recorded
- [ ] Local-only retention disposition recorded
- [ ] Expected selector outputs derived from the manual and verified against the real examples

**Verify**: `yarn vitest run test/rd06/fixtures.spec.test.ts`

### Step 7.2: Specification tests first

**Reference**: [03-02](03-02-spritepad-charpad.md) · ST-19–ST-40
**Objective**: Lock every SPD v5 selector, optional matrix and rejection.

- [ ] 7.2.1 [spec-author] Write SpritePad specification tests from ST-7–ST-9, ST-19–ST-40 and the retained ST-187 `bad.spd` oracle — `packages/compiler/src/assets/c64/spritepad.spec.test.ts`
- [ ] 7.2.2 Run the SpritePad specification tests and record the red phase

**Deliverables**:
- [ ] All ST-19–ST-40 encoded
- [ ] Red evidence recorded

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/spritepad.spec.test.ts`

### Step 7.3: Implementation

**Reference**: [03-02](03-02-spritepad-charpad.md) · AR-19, AR-45
**Objective**: Implement the validated SPD v5 parser and selector projection.

- [ ] 7.3.1 Add SPD v5 signature/version/flags/counts/records/variable names/exact EOF validation — `packages/compiler/src/assets/c64/spritepad.ts`
- [ ] 7.3.2 Add native records, colors, counts and derived `sprite_attributes` — `packages/compiler/src/assets/c64/spritepad.ts`
- [ ] 7.3.3 Add tile, tag, overlay and both animation component selectors — `packages/compiler/src/assets/c64/spritepad.ts`
- [ ] 7.3.4 Attach 64-byte alignment and VIC visibility; register the handler — `packages/compiler/src/assets/c64/index.ts`

**Deliverables**:
- [ ] Every valid selector yields its exact type/length/hash
- [ ] Every malformed/adjacent version fails with E10204

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/spritepad.spec.test.ts`

### Step 7.4: Green, implementation tests, VICE and review

- [ ] 7.4.1 Run the SpritePad specification tests and verify the green phase
- [ ] 7.4.2 Write synthetic optional-matrix, adjacent-version and malformed-derivation implementation tests — `packages/compiler/src/assets/c64/spritepad.impl.test.ts`
- [ ] 7.4.3 Add the bounded producer VICE rendering check — `test/rd06/vice-spritepad.spec.test.ts`
- [ ] 7.4.4 Add the focused SpritePad example — `examples/rd06-assets/spritepad.blend`
- [ ] 7.4.5 Dispatch independent semantics, machine-code and platform reviews

**Deliverables**:
- [ ] ST-7–ST-9, ST-19–ST-40 and ST-187 pass
- [ ] Real-example acceptance and synthetic coverage recorded
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/assets/c64/spritepad.spec.test.ts && yarn vitest run test/rd06/vice-spritepad.spec.test.ts`

---

## Phase 8: CharPad CTM v9

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, machine code, target platform
> **Reasoning**: max — ordered block schema, width boundaries and VIC placement
> **Gate**: AR-54–AR-57. Evidence is available at `/home/gevik/workdir/github/blend65.ri/apps`; the official vendor manual and selected real examples are local-only, and the committed fixtures are synthetic.

### Step 8.1: Evidence checkpoint

- [ ] 8.1.1 Record the installed CharPad 3.80 manual and selected real CTM v9 examples (paths, sizes, SHA-256, local-only retention) and create the producer-evidence manifest — `test/rd06/fixtures/producer-evidence.json`, `test/rd06/fixtures/manifest.json`

**Deliverables**:
- [ ] Vendor manual path/hash and selected real example paths/hashes recorded
- [ ] Local-only retention disposition recorded
- [ ] Expected selector outputs derived from the manual and verified against the real examples

**Verify**: `yarn vitest run test/rd06/fixtures.spec.test.ts`

### Step 8.2: Specification tests first

**Reference**: [03-02](03-02-spritepad-charpad.md) · ST-41–ST-65
**Objective**: Lock every CTM v9 selector, width boundary, packed form and rejection.

- [ ] 8.2.1 [spec-author] Write CharPad specification tests from ST-8, ST-41–ST-65 — `packages/compiler/src/assets/c64/charpad.spec.test.ts`
- [ ] 8.2.2 Run the CharPad specification tests and record the red phase

**Deliverables**:
- [ ] All ST-41–ST-65 encoded
- [ ] Red evidence recorded

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/charpad.spec.test.ts`

### Step 8.3: Implementation

**Reference**: [03-02](03-02-spritepad-charpad.md) · AR-20, AR-46
**Objective**: Implement the validated CTM v9 parser and selector projection.

- [ ] 8.3.1 Add CTM v9 signature/version/ordered blocks/counts/EOF validation — `packages/compiler/src/assets/c64/charpad.ts`
- [ ] 8.3.2 Add charset, colors, color method, dimensions and tile mode — `packages/compiler/src/assets/c64/charpad.ts`
- [ ] 8.3.3 Add canonical width, forced word, low/high planes and packed-12 — `packages/compiler/src/assets/c64/charpad.ts`
- [ ] 8.3.4 Attach 2-KiB charset alignment and VIC visibility; register the handler — `packages/compiler/src/assets/c64/index.ts`

**Deliverables**:
- [ ] Every valid selector yields its exact type/length/hash
- [ ] Width and packed-12 boundaries never truncate

**Verify**: `yarn workspace @blend65/compiler test src/assets/c64/charpad.spec.test.ts`

### Step 8.4: Green, implementation tests, VICE and review

- [ ] 8.4.1 Run the CharPad specification tests and verify the green phase
- [ ] 8.4.2 Write synthetic block-order, truncation, display/color/tile-mode, width and packed-12 implementation tests — `packages/compiler/src/assets/c64/charpad.impl.test.ts`
- [ ] 8.4.3 Add the bounded producer VICE charset check — `test/rd06/vice-charpad.spec.test.ts`
- [ ] 8.4.4 Add the focused CharPad example — `examples/rd06-assets/charpad.blend`
- [ ] 8.4.5 Dispatch independent semantics, machine-code and platform reviews

**Deliverables**:
- [ ] ST-8, ST-41–ST-65 pass
- [ ] Real-example acceptance and synthetic coverage recorded
- [ ] Review findings resolved

**Verify**: `yarn build && yarn typecheck && yarn workspace @blend65/compiler test src/assets/c64/charpad.spec.test.ts && yarn vitest run test/rd06/vice-charpad.spec.test.ts`

---

## Phase 9: GoatTracker 2.77 adapter (moved out of RD-06)

> **Status**: Moved out of RD-06 by AR-58.
> **Reason**: The adapter needs exact GoatTracker archive/member hashes, exports, settings and ABI
> evidence. The generic `c64.audio` seam and empty contract map remain in RD-06; the GoatTracker
> binding is a separate follow-up feature.
>
> No tasks in this phase. The AC-19/AC-20 acceptance criteria are moved with the adapter.

---

## Phase 10: Final integration and closeout

> **Phase baseline tree**: _recorded by the exec-plan skill at phase start_
> **Lenses**: semantics, SFA/ABI, machine code, target platform
> **Reasoning**: max — full RD boundary, evidence integrity and closeout
> **Gate**: Step 10.1 is unblocked after Phase 8; Step 10.2 is the final closeout after 10.1.

### Step 10.1: Integration and contingency closeout

**Reference**: AR-1, AR-51, AR-52, AR-54–AR-57
**Objective**: Give the integrated work a verifiable terminal state even if a vendor example path is unavailable on a later host.

- [ ] 10.1.1 Run the complete unblocked RD-06 suite and record the impact-based verification record — `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`
- [ ] 10.1.2 Audit the unblocked `.assets.json`, `.memory.json`, `.costs.json` and `.debug.json` evidence set — `test/rd06/evidence-assets.impl.test.ts`
- [ ] 10.1.3 Record the contingency closeout, any unavailable vendor-evidence path and the honest roadmap state — `codeops/features/blend65-v4/plans/rd-06-native-assets/09-closeout.md`, `codeops/features/blend65-v4/00-roadmap.md`
- [ ] 10.1.4 Dispatch the unblocked-phase correctness, semantics, SFA/ABI, machine-code and platform reviews

**Deliverables**:
- [ ] Complete unblocked suite green
- [ ] Unblocked evidence audited
- [ ] Blocked-state closeout and roadmap record

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

### Step 10.2: Final verification and closeout

**Reference**: AR-1, AR-2, AR-51
**Objective**: Run the final boundary suite and close RD-06 after all active phases pass.

- [ ] 10.2.1 Run the complete RD-06 boundary suite once after all paths integrate — `yarn test`
- [ ] 10.2.2 Run the sequential four-profile VICE qualification — `yarn vitest run test/rd06 test/rd05`
- [ ] 10.2.3 Dispatch the final independent correctness, semantics, SFA/ABI, machine-code and platform reviews
- [ ] 10.2.4 Audit the complete evidence set and cross-sidecar reconciliation
- [ ] 10.2.5 Run the deferral-expiry gate and re-own every due item — `codeops/features/blend65-v4/plans/rd-06-native-assets/09-closeout.md`
- [ ] 10.2.6 Record honest public status, fixture roles, refreshed host observations and `VICE-verified / hardware-unverified` boundaries
- [ ] 10.2.7 Update the roadmap and closeout — `codeops/features/blend65-v4/00-roadmap.md`

**Deliverables**:
- [ ] Complete boundary suite green
- [ ] Sequential VICE green
- [ ] All review findings resolved
- [ ] Complete evidence set
- [ ] Deferral-expiry answer
- [ ] Honest status and roadmap
- [ ] Closeout document

**Verify**: `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`

---

## Dependencies

```
Phase 1 (core + public fixtures)
    ↓
Phase 2 (PSID) ─────┐
Phase 3 (Koala) ────┤
Phase 4 (comptime) ─┤
    ↓               │
Phase 5 (layout) ←──┘
    ↓
Phase 6 (examples/status + unblocked suite)
    ↓
Phase 7 (SpritePad) → Phase 8 (CharPad)
    ↓
Phase 10.1 (integration + contingency closeout)
    ↓
Phase 10.2 (final verification/closeout)
```

## Success Criteria

**Feature is complete when:**

1. ✅ All unblocked phases completed and verified.
2. ✅ SpritePad and CharPad producer evidence recorded without guessing; GoatTracker is explicitly moved to a follow-up (AR-58) and is not reported as verified.
3. ✅ All verification passing (`yarn install --frozen-lockfile`, `yarn build`, `yarn typecheck`, `yarn test`).
4. ✅ Sequential VICE qualification passes on the selected profiles.
5. ✅ No dead code, no hidden runtime, no compiler-supplied renderer/scheduler/mixer.
6. ✅ Evidence complete and reconciled; no partial artifact on failure.
7. ✅ Deferral-expiry gate answered; roadmap and status honest.
8. ✅ Independent reviews complete and findings resolved.
