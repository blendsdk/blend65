# Preflight Report: RD-06 Native Assets, Compile-Time Composition, and Resident Layout

> **Status**: ✅ PREFLIGHT PASSED — all 18 findings resolved
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-v4/plans/rd-06-native-assets/` (14 documents)
> **Codebase Grounded**: 60+ source/test files examined; every path, API and test command checked against the checkout
> **Last Updated**: 2026-11-07

> **SAME-SESSION REVIEW:** This plan was created in the current session. Same-agent bias risk is
> elevated. The five auditor dispatches ran in fresh contexts; a new-session review is still
> recommended before execution.
>
> **2026-11-08 evidence update:** the licensed SpritePad 3.80 and CharPad 3.80 installations and
> their official SPD v5/CTM v9 manuals plus real examples were supplied at
> `/home/gevik/workdir/github/blend65.ri/apps`. AR-54–AR-58 supersede the earlier producer-blocked
> assumptions: SpritePad/CharPad are unblocked, the real examples are local-only evidence, committed
> fixtures are synthetic, and GoatTracker is moved to a follow-up. The findings remain resolved; the
> evidence path changed, not the plan's quality verdict.

### Codebase Context Summary

**Tech Stack:** TypeScript 7.0.2 ESM/NodeNext, Node 22+, Yarn classic workspaces, Vitest 2.1.9, Turbo, ACME 0.97, VICE 3.10.

**Architecture:** `packages/compiler/src` separates the target-neutral frontend (`frontend/`, `assets/`), backend (`semantic/`, `storage/`, `machine/`, `layout/`, `artifacts/`, `publication/`, `tools/`, `services/`), and target facts (`target/`). `test/import-boundary.ts` rejects any frontend-to-backend import. The root Vitest config includes only `test/**`; package tests run through the package workspace.

**Key Files Examined:** `frontend/service.ts`, `frontend/source-discovery.ts`, `assets/raw-asset.ts`, `assets/asset-types.ts`, `frontend/comptime*.ts`, `frontend/profile.ts`, `target/profile.ts`, `target/c64-kernal.ts`, `layout/c64-layout.ts`, `layout/c64-layout-placement.ts`, `machine/lower-data.ts`, `machine/lower-c64.ts`, `machine/lower-call.ts`, `semantic/interrupt-domains.ts`, `services/evidence.ts`, `services/memory-evidence-records.ts`, `artifacts/assets-evidence-validator.ts`, `artifacts/memory-evidence-validator.ts`, `publication/sidecar-consistency.ts`, `test/import-boundary.ts`, `vitest.config.ts`, `packages/compiler/vitest.config.ts`, `package.json`, `packages/compiler/package.json`.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 3 | 🟠 |
| 2 | Implicit Assumptions | 2 | 🔴 |
| 3 | Logical Contradictions | 4 | 🟠 |
| 4 | Completeness Gaps | 4 | 🟠 |
| 5 | Dependency Issues | 2 | 🟠 |
| 6 | Feasibility Concerns | 3 | 🟠 |
| 7 | Testability | 4 | 🔴 |
| 8 | Security Blind Spots | 1 | 🟠 |
| 9 | Edge Cases | 2 | 🟠 |
| 10 | Scope Creep Indicators | 1 | 🟡 |
| 11 | Ordering & Sequencing | 3 | 🟠 |
| 12 | Consistency | 3 | 🟠 |
| 13 | Codebase Alignment | 4 | 🔴 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 4 | All resolved |
| MAJOR | 10 | All resolved |
| MINOR | 4 | All resolved |
| OBSERVATION | 0 | — |

---

### PF-001: Frontend-to-target handler wiring violates the enforced import boundary [🔴 CRITICAL]

**Dimension:** 13 Codebase Alignment / 2 Implicit Assumptions
**Location:** `00-ambiguity-register.md` AR-4/AR-49; `03-01-asset-handler-core.md` §Proposed changes; `99-execution-plan.md` 1.2.6, 2.2.6
**Codebase Evidence:** `test/import-boundary.ts:25-28` treats `target`, `semantic`, `machine`, `layout`, `artifacts`, `publication`, `tools`, `services` as backend; `test/rd03-import-boundary.spec.test.ts:56,61` scans real sources; `frontend/service.ts:1-20` currently imports only `frontend/` and `assets/`; `frontend/profile.ts` is the frontend profile, not `target/profile.ts`

**The Problem:** The plan routes `frontend/service.ts` through `target/profile.ts` and `target/c64-assets/`. Any such import makes the actual import-boundary test fail. It also contradicts AR-49's claim that the existing `analyzeResolvedProject` selects `target/profile.ts`; it selects the frontend profile.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move C64 handler implementations to `packages/compiler/src/assets/c64/`; keep the generic contract in `assets/`; keep the selected profile's handler key/extension map as data in `frontend/profile.ts`; `target/` stays machine facts only | Preserves the import boundary and the selected-platform ownership boundary | Changes AR-4's exact directory choice |
| B | Keep `target/c64-assets/` and inject the handler map from `services/services.ts` into an explicitly parameterized frontend function | Keeps the target directory | The frontend entry point and language server would not have handlers; R6.55 frontend metadata becomes harder |
| C | Weaken or bypass the import-boundary test | Unacceptable; breaks a frozen architectural rule | — |

**Recommendation:** Option A. It is the smallest design that keeps the frontend target-neutral while the C64 profile still owns the handler identities and keys.

---

### PF-002: Scalar and zero-byte selector outputs have no resident or evidence representation [🔴 CRITICAL]

**Dimension:** 6 Feasibility / 13 Codebase Alignment
**Location:** `03-01-asset-handler-core.md` `EmbeddedScalarValue`; `03-06-resident-layout-evidence.md` §Evidence; `07-testing-strategy.md` ST-14/ST-146
**Codebase Evidence:** `semantic/lower.ts:250-258` adds every embedded declaration to `residentAssetRoots`; `machine/lower-data.ts:150-165` materializes every reachable asset as a layout object with `bytes`; `services/evidence.ts:284-297` throws when a reachable asset has no interval; `artifacts/assets-evidence-validator.ts:142-187` requires nonzero `payloadBytes` and a placement

**The Problem:** A scalar selector (`count`, `background`, `init_address`, `tile_mode`) has no target bytes and no address. The current pipeline assumes every `SemanticAsset` is byte-backed and resident, so scalar selectors would either fail layout/evidence or emit invented bytes. Empty optional arrays have the same zero-byte problem. The plan does not define a scalar evidence record, a resident-root filter, or an `.assets.json` shape.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Make `SemanticAsset` a union (`ResidentAsset` / `ScalarAsset`); exclude scalars and empty outputs from resident roots, layout, `.memory.json` and `.costs.json`; add an additive version-1 `.assets.json` `placement.kind:"compileTime"` record (payload 0, emitted 0, encoded output hash) | Complete evidence, no invented bytes, honest resident set | Additive validator change |
| B | Keep scalars out of `.assets.json` and record them only in `.debug.json`/semantic metadata | Smallest code change | R6.46 "every selected object" evidence is incomplete |
| C | Encode scalars as one-byte assets | Wrong type/semantics | Violates R6.5/R6.6 |

**Recommendation:** Option A. It is the only option that satisfies both R6.6 and R6.46 without lying about resident storage.

---

### PF-003: Directed package-test commands cannot run the new package tests [🔴 CRITICAL]

**Dimension:** 7 Testability / 13 Codebase Alignment
**Location:** `99-execution-plan.md` Phase 1–9 Verify lines and task commands (for example lines 71, 77, 103, 110, 138, 144, 167, 174)
**Codebase Evidence:** `vitest.config.ts:5-16` root include is `test/**`; `packages/compiler/vitest.config.ts:4` package include is `src/**/*.test.ts`; `package.json:16` runs package tests through Turbo

**The Problem:** `yarn vitest run packages/compiler/src/assets/asset-handler.spec.test.ts` at the root selects no package file, so the red phase can "fail" with no tests and the green phase can pass without executing the handler suite. The plan's primary gates are invalid as written.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Use `yarn workspace @blend65/compiler test src/<path>` for package tests and `yarn vitest run test/rd06/<path>` for root tests | Uses the existing two-tier design | Requires editing every affected Verify line |
| B | Add `packages/*/src/**` to the root Vitest include | One command | Duplicates package tests and changes the release corpus |

**Recommendation:** Option A.

---

### PF-004: The complete unblocked suite has no terminal gate before the blocked final phase [🔴 CRITICAL]

**Dimension:** 11 Ordering & Sequencing / 7 Testability
**Location:** `01-requirements.md` plan-local AC-3; `99-execution-plan.md` 10.1.1 and Phase 10 gate
**Codebase Evidence:** `AGENTS.md` requires install, build, typecheck and complete owned tests at a phase checkpoint; `package.json:16`

**The Problem:** The only complete `yarn test` run is Phase 10.1.1, which is blocked until SpritePad, CharPad and GoatTracker pass. If evidence never arrives, the unblocked work can never have a green complete-suite checkpoint or an honest blocked closeout.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Split Phase 10 into 10A (unblocked complete suite, evidence audit, blocked-state closeout, roadmap Blocked) and 10B (final producer-inclusive rerun/closeout) | Honest terminal state now; keeps final gate | Adds a few tasks |
| B | Leave Phase 10 as is | Simpler | No terminal state without producer evidence |

**Recommendation:** Option A.

---

### PF-005: Native asset identity cannot satisfy the frozen `.assets.json` id rule [🟠 MAJOR]

**Dimension:** 12 Consistency / 6 Feasibility
**Location:** `00-ambiguity-register.md` AR-9; `03-01-asset-handler-core.md` §New functions; `03-06-resident-layout-evidence.md` §Evidence
**Codebase Evidence:** `artifacts/assets-evidence-validator.ts:350-364` derives `id` from handler, version, selector, logical type, shape and output hash only; `:500-503` requires unique ids; `services/evidence.ts:153-162` hardcodes raw

**The Problem:** AR-9's identity adds path, input SHA-256 and representation, but the evidence id does not. Two different files with identical bytes (ST-13) produce the same evidence id and the sidecar is rejected. The plan cannot both keep the frozen id derivation and record both objects.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Extend the canonical `.assets.json` id inputs with `inputs` (path + input SHA-256) and `representation`; update the validator and affected expectations | Satisfies R6.7 exactly | Changes existing raw evidence ids |
| B | Keep the six-field evidence id and use a separate internal semantic id; merge identical outputs in evidence | No validator change | Cannot represent two distinct files with equal bytes; violates R6.7 |

**Recommendation:** Option A.

---

### PF-006: Blocked `.spd`/`.ctm` would silently become raw fallback [🟠 MAJOR]

**Dimension:** 13 Codebase Alignment / 8 Security
**Location:** `03-01-asset-handler-core.md` "An unregistered extension follows the existing raw path"; `03-02-spritepad-charpad.md` blocked work; `99-execution-plan.md` 1.2.6
**Codebase Evidence:** `frontend/service.ts:577,616-633` currently returns E10204 for every readable `.spd/.ctm`; AC-24 and R6.31 forbid raw fallback for a registered malformed file

**The Problem:** After Phase 1 the profile map contains only PSID/Koala. If `.spd`/`.ctm` are therefore "unregistered", a selector-less `embed("player.spd")` embeds raw producer bytes. That is a behavioral regression and a validation bypass.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a closed `reservedExtensions` profile set; dispatch returns E10204 for reserved-but-unimplemented extensions before raw fallback | Preserves AC-24; honest blocked state | One small profile fact |
| B | Register fail-closed placeholder handlers for SpritePad/CharPad | Also works | Pretends a handler exists before evidence |

**Recommendation:** Option A.

---

### PF-007: Unblocked test phases depend on blocked producer fixtures and later layout [🟠 MAJOR]

**Dimension:** 4 Completeness / 11 Ordering
**Location:** `07-testing-strategy.md` ST-7, ST-8, ST-9, ST-14, ST-15, ST-16, ST-92; `99-execution-plan.md` Phase 1/2/5
**Codebase Evidence:** `test/rd06/` does not exist; no `.spd/.ctm` fixtures exist; AR-1/AR-50 forbid fabricating them

**The Problem:** ST-7/8/9/14/15/16 require valid SpritePad/CharPad fixtures and handlers that are blocked until Phases 7/8. ST-92 requires Phase 5 layout enforcement. The Phase 1/2 green gates cannot pass honestly.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move producer-family ST cases to Phases 7/8; rewrite scalar cases against PSID/Koala selectors for Phase 2/3; move fixed-load placement cases to Phase 5 | Honest red/green gates | Reorders some cases |
| B | Keep the cases and mark Phases 1/2 blocked | Contradicts the unblocked premise | — |

**Recommendation:** Option A.

---

### PF-008: Public fixture creation is scheduled after the tests that need it [🟠 MAJOR]

**Dimension:** 5 Dependency / 11 Ordering
**Location:** `99-execution-plan.md` 2.1.1/3.1.1 vs 6.2.3/6.2.4/6.2.5; `03-07-fixtures-qualification.md`
**Codebase Evidence:** `test/rd06/` does not exist; `03-07` forbids generating fixtures at test time

**The Problem:** PSID/Koala spec tests are authored in Phases 2/3, but their committed fixtures and manifest are created in Phase 6. The dependency graph is cyclic (Phase 2/3 → Phase 6 → Phase 5).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Move manifest schema, public raw/PSID/Koala fixture creation and manifest entries into a new Phase 1 step before handler spec tests | Breaks the cycle; fixtures are inputs | Adds a few early tasks |
| B | Reorder Phase 6 before Phase 2 | Fixes the cycle | Splits fixtures/examples/status awkwardly |

**Recommendation:** Option A.

---

### PF-009: Q-P15 oracle is authored twice and by the implementation owner [🟠 MAJOR]

**Dimension:** 7 Testability / 11 Ordering
**Location:** `99-execution-plan.md` 4.1.1, 4.2.4–4.2.5; `03-05-comptime-and-qp15.md`
**Codebase Evidence:** `AGENTS.md` requires spec-test authors to stay implementation-blind; executors cannot edit specification tests

**The Problem:** 4.1.1 must write expected Q-P15 bytes before the Q-P15 source exists, and 4.2.5 re-authors the same oracle after implementation. The immutable oracle becomes self-confirming.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a `[spec-author]` task in 4.1 that authors the Q-P15 workload source, panel design, conflict metadata and expected bytes; 4.1.1 writes the test; delete 4.2.5 | Independent oracle | The workload design is frozen before compiler work |
| B | Keep the current order and accept a snapshot oracle | Simpler | Violates the oracle rule |

**Recommendation:** Option A.

---

### PF-010: R6.54 example coverage is incomplete and the example oracle is missing [🟠 MAJOR]

**Dimension:** 4 Completeness / 7 Testability
**Location:** `99-execution-plan.md` 6.2.7, 6.3.3; RD-06 R6.54
**Codebase Evidence:** `examples/m1/blend65.json` and `examples/m1/src/game.blend` show the required project shape

**The Problem:** R6.54 also requires callable-vs-embed-only audio, same-output aliasing, and one compile-time refinement example. No task creates them or `test/rd06/examples.spec.test.ts`; examples also lack `blend65.json` manifests.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add the three examples with manifests under `examples/rd06-assets/` and a `[spec-author]` example-oracle task in 6.1 | Closes R6.54 | Adds tasks |
| B | Narrow R6.54 in the owning RD | Shorter plan | Requires a requirements change outside this plan |

**Recommendation:** Option A.

---

### PF-011: Declared integration, aliasing and blocked-gate tests have no authoring task [🟠 MAJOR]

**Dimension:** 4 Completeness / 7 Testability
**Location:** `07-testing-strategy.md` test inventory; `99-execution-plan.md` (no matching tasks)
**Codebase Evidence:** `vitest.config.ts:16` silently ignores absent files

**The Problem:** `integration.spec.test.ts`, `aliasing.spec.test.ts` and `blocked-gates.spec.test.ts` are declared mandatory but never authored. The blocked-gate test is the only automated guarantee that missing evidence is never reported as verified.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add explicit spec-author/impl tasks for the three files | Closes the honesty and integration gaps | Adds tasks |
| B | Remove them from the strategy and record manual coverage | Shorter | Loses the safety net |

**Recommendation:** Option A.

---

### PF-012: GoatTracker and several acceptance criteria have no specification cases [🟠 MAJOR]

**Dimension:** 4 Completeness / 7 Testability
**Location:** `07-testing-strategy.md` (no GoatTracker rows); `99-execution-plan.md` 9.2.1; RD-06 AC-01–AC-37
**Codebase Evidence:** document-only

**The Problem:** AC-19/AC-20 (init/tick/`-Dx` SFX, pruning, writable ranges, no engine) have no ST cases, so the Phase 9 spec author must invent expectations. AC-03 (coherent snapshot), AC-18 positive (specific compatible set passes), AC-30 (reserved overlap/OOM), AC-34 (impact-based verification record) and AC-04 (mutable/runtime-local/extent mismatch) also lack cases. Twelve ACs are not referenced at all.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add ST-170–ST-177 for GoatTracker, the missing AC cases, and an AC-01–AC-37 coverage map | Complete traceability | Longer testing strategy |
| B | Accept partial coverage with an itemised exclusion list | Shorter | AC-19/20 remain untestable |

**Recommendation:** Option A.

---

### PF-013: Producer evidence gate has three different start thresholds [🟠 MAJOR]

**Dimension:** 1 Ambiguity / 5 Dependency
**Location:** RD-06 R6.1; `00-rd-06-producer-evidence-handoff.md`; `03-02-spritepad-charpad.md`; `99-execution-plan.md` Phase 7
**Codebase Evidence:** document-only

**The Problem:** RD-06 says the evidence checkpoint must exist before implementation planning; the handoff says one `MIN` is enough to start planning; the plan requires the complete set before spec authoring; the plan was authored with zero evidence. AR-1 approves blocked gates but does not record a deviation from R6.1.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add an explicit AR-51 "planning-before-evidence boundary": the plan may define the selector contract and gate, but no byte-level decoder design or decoder task executes before the complete checkpoint; align the handoff wording | Honest and auditable | Requires a user decision |
| B | Enforce R6.1 literally and remove the SpritePad/CharPad design/tasks from this plan | Strict conformance | Contradicts AR-1's full-plan choice |

**Recommendation:** Option A.

---

### PF-014: Character-ROM reservation conflicts with current placement and the "unchanged artifacts" claim [🟠 MAJOR]

**Dimension:** 6 Feasibility / 13 Codebase Alignment
**Location:** `03-06-resident-layout-evidence.md` §Address spaces and views; `02-current-state.md` risk table; `99-execution-plan.md` 5.2.4
**Codebase Evidence:** `layout/c64-layout.ts:275-283` places code from `$080D` with no ROM skip; `:474-515` places ordinary data the same way; `layout/startup.ts:299-306` sets `$01` with CHAREN=1, so character ROM is CPU-visible at `$1000-$1FFF`

**The Problem:** The plan calls character ROM "Reserved and VIC-invisible" and requires character-ROM avoidance, but existing code/data can be placed there. Reserving it globally may change existing artifacts; not reserving it leaves an incorrect CPU-visible placement. The plan says both "prove the window" and "existing non-asset output unchanged".

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reserve character ROM globally for CPU placement, audit existing fixtures, and update the "unchanged output" claim to "unchanged unless a program crosses the window" | Correct target behavior | Possible artifact updates |
| B | Restrict avoidance to VIC-visible assets and document the CPU carve-out | No artifact change | Leaves a known illegal CPU placement |

**Recommendation:** Option A.

---

### PF-015: W10150 conflicts with the frozen specification [🟠 MAJOR]

**Dimension:** 3 Contradiction / 6 Feasibility
**Location:** RD-06 R6.47/AC-31; `03-01-asset-handler-core.md` error table; `99-execution-plan.md` (no W10150 task)
**Codebase Evidence:** `spec/13-data-inclusion.md:253` and `spec/14-diagnostics.md:286` define W10150; `services/resource-diagnostics.ts:254-264` already emits it

**The Problem:** RD-06 says "There is no percentage-based embedded-data warning", but the frozen specification mandates W10150. The plan cannot retire it without a specification edit, which RD-06 does not authorize.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep W10150 and interpret R6.47 as "no new percentage warning beyond the existing Specification 4 W10150"; record the interpretation in the plan/closeout | Spec-conformant | Requires a requirements interpretation |
| B | Retire W10150 with a spec-authority decision | Matches R6.47 | Needs an authorized spec change outside RD-06 |

**Recommendation:** Option A. Do not silently remove a frozen diagnostic.

---

### PF-016: `loadable const` diagnostic E10275 does not match its specification [🟠 MAJOR]

**Dimension:** 1 Ambiguity / 3 Contradiction
**Location:** `03-01-asset-handler-core.md` §Owner and loadable behavior; `07-testing-strategy.md` ST-10; `00-ambiguity-register.md` AR-3
**Codebase Evidence:** `spec/13-data-inclusion.md:78-80,171-175` makes `loadable const` legal; `:243` defines E10275 for a rejected load call and its message requires a destination; `spec/14-diagnostics.md:246`

**The Problem:** The plan rejects the declaration at the `embed()` site with E10275, but E10275 is a load-call diagnostic. The message cannot be rendered correctly.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep the fail-closed RD-06 behavior but report E10204 with a precise "resident-only profile" message; record the temporary restriction in the expressiveness ledger | Honest temporary boundary | E10204 is not a perfect format-failure fit |
| B | Allow the `loadable const` declaration and fail only when a load operation is requested (E10275) | Spec-conformant | Native parsing for loadable declarations would occur, which the user rejected |
| C | Add a new diagnostic above E10281 | Exact | Requires a frozen-spec edit |

**Recommendation:** Option A. It keeps the user's fail-closed choice without misusing a load-call code.

---

### PF-017: `$D018` field operations have no composition semantics [🟠 MAJOR]

**Dimension:** 9 Edge Cases / 6 Feasibility
**Location:** `03-04-koala.md` §Placement and derived fields; `03-06-resident-layout-evidence.md` §Derived hardware fields; ST-105/ST-106
**Codebase Evidence:** `layout/startup.ts:340-353` writes `$D018 = $14`; `layout/c64-layout-objects.ts:122-174` resolves one field transform per operand

**The Problem:** Each operation computes one field. If written directly to `$D018`, enabling bitmap then screen clears the other field. The plan does not state whether these are field constants or complete register writes.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Define all three as pure field constants; source ORs them; add a combined bitmap+screen example and test | Composable and zero-cost | Source must combine fields |
| B | Implement a combined read-modify-write register operation | One call | More runtime work and a new register semantic |

**Recommendation:** Option A.

---

### PF-018: Plan hygiene defects (paths, examples, index, types, pinning, task size) [🟡 MINOR]

**Dimension:** 12 Consistency / 13 Codebase Alignment
**Location:** `99-execution-plan.md` 2.2.9/2.2.10, 6.2.7, 7.4.4, 8.4.4; `00-index.md`; `03-05` example; `02-current-state.md` dependencies; `03-01` types
**Codebase Evidence:** `semantic/interrupt-domains.ts` exists; `machine/interrupt-domains.ts` does not; `machine/lower-call.ts` and `machine/lower-platform.ts` exist; `machine/lower-calls.ts` does not; examples require `blend65.json` + `src/`; `comptime function` cannot return unsized `byte[]`; VICE Linux is version-pinned/hash-recorded, not pre-pinned; ACME hash is observed at discovery

**The Problem:** Phantom paths, missing example manifests, inconsistent status/index numbering, undefined `AssetValueType`/`AssetHandlerFailure`, an unsized example return, over-stated SHA-256 pinning, review lenses without owners, and spec-author tasks that exceed the plan's own size bound.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Apply the mechanical corrections listed above | Plan becomes executable and internally consistent | Many small edits |
| B | Leave them to execution | Shorter now | Avoidable failures and review friction |

**Recommendation:** Option A.

---

## Dispositions

| Finding | User Decision | Applied Resolution |
| --- | --- | --- |
| PF-001 | Accepted recommendation | C64 handlers moved to `assets/c64/`; frontend profile owns the data map; import boundary preserved |
| PF-002 | Accepted recommendation | `ResidentAsset`/`ScalarAsset` union; scalars excluded from resident roots and recorded with `compileTime` placement |
| PF-003 | Accepted recommendation | Package tests use `yarn workspace @blend65/compiler test src/...`; root tests use `yarn vitest run test/...` |
| PF-004 | Accepted recommendation | Phase 10 split into unblocked 10.1 and producer-inclusive 10.2 |
| PF-005 | Accepted recommendation | Evidence id extended with input identity and representation |
| PF-006 | Accepted recommendation | `reservedExtensions` fail closed with E10204 before raw fallback |
| PF-007 | Accepted recommendation | Producer-family ST cases use the vendor manuals and selected real examples; PSID/Koala scalar cases added |
| PF-008 | Accepted recommendation | Public fixtures and manifest moved to Phase 1.4 |
| PF-009 | Accepted recommendation | Q-P15 workload and oracle authored by `[spec-author]` before implementation |
| PF-010 | Accepted recommendation | Audio embed-only, aliasing and compile-time examples added; example oracle added |
| PF-011 | Accepted recommendation | Integration, aliasing and blocked-gate test tasks added |
| PF-012 | Accepted recommendation | ST-171–ST-184 and AC coverage map added; ST-171–ST-179 moved with GoatTracker |
| PF-013 | Option A — explicit AR-51 boundary | AR-51 updated: vendor manuals and real examples now satisfy the evidence boundary; no guessed schema remains |
| PF-014 | Accepted recommendation | Character ROM reserved globally; existing fixtures audited; output-change claim qualified |
| PF-015 | Option A — keep W10150 | AR-52 preserves the frozen warning; R6.47 interpreted as no new percentage warning |
| PF-016 | Option A — E10204 + ledger | AR-3 updated to E10204 with the expressiveness-ledger entry |
| PF-017 | Accepted recommendation | `vic*Select` defined as pure field constants with OR composition |
| PF-018 | Accepted recommendation | Paths, examples, index, types, pinning, task size and harness-binding corrections applied |

## Remaining Notes

- The plan is still a **same-session review**. A fresh-session preflight is recommended before
  execution if maximum review independence is required.
- The licensed SpritePad 3.80 and CharPad 3.80 manuals and real examples are available at
  `/home/gevik/workdir/github/blend65.ri/apps`. Real files are local-only evidence; committed
  fixtures are synthetic. The GoatTracker adapter is moved to a follow-up feature (AR-58).
