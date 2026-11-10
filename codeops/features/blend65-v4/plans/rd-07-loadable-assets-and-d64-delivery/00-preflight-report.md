# Preflight Report: RD-07 Loadable Assets and D64 Delivery Plan

> **Status**: ✅ PASSED WITH NOTES — 41 first-scan findings plus 18 re-review findings; all critical/major resolved, remaining minors accepted with evidence
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: Implementation plan at `codeops/features/blend65-v4/plans/rd-07-loadable-assets-and-d64-delivery/`
> **Codebase Grounded**: 38 source files examined, 62 references verified
> **Last Updated**: 2026-11-10 09:40

> **SAME-SESSION REVIEW**: This artifact was created in the current session. Five independent
> preflight-auditor clusters reviewed it in fresh contexts. One cluster finding was refuted against
> primary KERNAL documentation; the rest were reconciled and fixed.

## Codebase Context Summary

**Tech Stack:** TypeScript 7.0.2, Node 22, ESM/NodeNext, Yarn classic, Vitest, ACME 0.97, VICE 3.10.

**Architecture:** `frontend -> semantic -> whole-program -> machine lower -> shared-storage
draft/final layout -> ACME -> evidence -> immutable publication`. SFA closes in
`storage/closure.ts` after the symbolic machine program exists. The D64 profile and packager do not
exist yet. Version-1 sidecars are exact-key validated.

**Key Files Examined:** `frontend/scalar-expressions.ts`, `frontend/profile.ts`,
`frontend/semantic-types.ts`, `frontend/flow-facts.ts`, `semantic/lower.ts`,
`semantic/whole-program.ts`, `semantic/interrupt-ownership.ts`, `machine/lower-c64.ts`,
`storage/closure.ts`, `storage/irq-stack.ts`, `services/shared-storage.ts`,
`services/evidence.ts`, `services/vice.ts`, `target/profile.ts`, `target/c64-kernal.ts`,
`profile/c64-kernal.ts`, `artifacts/acme-validate.ts`, `artifacts/build-evidence-validator.ts`,
`artifacts/assets-evidence-validator.ts`, `artifacts/memory-evidence-validator.ts`,
`artifacts/costs-evidence-validator.ts`, `artifacts/debug-evidence-records.ts`,
`publication/current-record.ts`, `publication/sidecar-consistency.ts`,
`project/basename.ts`, `spec/03-variables.md`, `spec/13-data-inclusion.md`,
`spec/14-diagnostics.md`, `spec/appendix-c64.md`.

## Summary by Severity

| Severity | Count | Status |
| -------- | ----- | ------ |
| CRITICAL | 0 | — |
| MAJOR | 24 | all resolved |
| MINOR | 15 | resolved or accepted with evidence |
| OBSERVATION | 2 | accepted |

## Findings and resolutions

### PF-001 — KERNAL SA=0 + X/Y + file header conflict — 🟠 MAJOR — **Dismissed (refuted)**

**Location:** `03-03`, `03-05`, `03-07`, ST-82.
**Problem raised:** The reviewers claimed SA=0 uses the file header, so a `$0000` header would load
to `$0000`.
**Evidence:** Primary C64 KERNAL documentation (`skoolkid` C64 ROM, `codebase64`, C64 Programmer's
Reference) states that with secondary address 0 the file header is ignored and X/Y supplies the
load address; with secondary address 1 or 2 the file header supplies it. The frozen spec says the
same. The unit header is consumed and ignored.
**Resolution:** **Dismissed — primary documentation refutes the finding.** Clarified in 03-03 and
03-05 that the KERNAL consumes the 2-byte header and ignores it for placement; the plan's SA=0 +
X/Y contract is correct.

### PF-002 — D64 profile admitted only in Phase 7 while Phases 2–6 need it — 🟠 MAJOR

**Fix:** Move profile identity/facts/selection into Phase 2 (before the load capability). Phase 2–5
tests use `checkProject`; full D64 build/publication remains Phase 7. Widen
`C64KernalProfileId`, `PackagerFacts`, `TargetProfile.packager`, and `storage.profileId`; add
`profileKind: "prg" | "d64"`. Add `artifacts/acme-validate.ts` to the modification set.

### PF-003 — BAM header offsets are +4 bytes — 🟠 MAJOR

**Fix:** Correct to name 144–159, `$A0 $A0` 160–161, ID 162–163, `$A0` 164, `"2A"` 165–166,
`$A0 ×4` 167–170, zero 171–255. Pin the exact 32-byte slice in ST-78 and the independent decoder.

### PF-004 — On-disk PRG header, chunk/block accounting, zero-byte units, staged ninth file — 🟠 MAJOR

**Fix:** Define the on-disk file as 2-byte header + body; boot header `$01 $08`, unit header
`$00 $00`. `blocks = ceil((2 + bodyBytes)/254)`. `bytes` evidence includes the header;
`outputSha256` hashes header+body; `logicalSha256` hashes the body. Zero-byte units are one 2-byte
data sector. Delete the staged `<name>.prg` after packaging; keep exactly eight published names.

### PF-005 — R7.48 tooling handoff missing — 🟠 MAJOR

**Fix:** Add a frontend-safe `LoadableHandoff` view (type/size/provenance, illegal uses,
destination compatibility) and a build-only `LoadableBuildView` (directory/sector/address/strategy/
quiescence/memory-proof/cost). Add ST-132/ST-133 and Phase 1/8 tasks. Assert the frontend import
graph never reaches packaging.

### PF-006 — R7.40 quiescence/publication point has no memory field — 🟠 MAJOR

**Fix:** Add one additive version-1 `.memory.json` field `loadStates` with
`{callSite, unitId, destinationIntervalIds, quiescence, publicationPoint}`. Update the exact-key
validator and ST-110. Record the additive field in AR-P14.

### PF-007 — R7.38 loader identity, ordered components, measurement home — 🟠 MAJOR

**Fix:** Add `loaderStrategyId: "kernal-sequential-uncompressed"` to the D64 package and validator.
Require components in directory order (boot first). Record the allocation measurement in a
plan-local `09-allocation-measurement.md`; `.build.json` carries the policy id. Add ST-134.

### PF-008 — `.build.json` component `source` shape — 🟠 MAJOR

**Fix:** Use the admitted `componentSource` union: boot `{kind:"generated", identity:<project name>,
sha256:<body hash>}`, unit `{kind:"generated", identity:<declaration>, sha256:<logical hash>}`.
Keep `SourceSiteRecord` only for `destinationCalls`.

### PF-009 — Loadable asset/destination matcher and `.debug.json` loadUnit identity — 🟠 MAJOR

**Fix:** Extend `assetPlacementsMatchMemory` to match loadable destinations by their actual
symbol/global/loadDestination owner. Set `.debug.json` `loadUnit.name` to the `.build.json`
component id; keep the source declaration in the component `source`. Order `loadUnits` by name.

### PF-010 — Loader/call-site cost double counting — 🟠 MAJOR

**Fix:** Split the function code interval attribution into `code`, `loader`, and `callSite` subsets
that sum exactly to the interval bytes. `programBytes` remains the boot PRG body length; each byte
is counted once.

### PF-011 — `evidenceAgrees` D64 branch still derives PRG fields — 🟠 MAJOR

**Fix:** In the D64 branch, omit the PRG load/end comparisons; take `programBytes` from the boot
component body; verify the D64 primary hash and package fields.

### PF-012 — Pipeline order misstated — 🟠 MAJOR

**Fix:** Correct to `machine lower -> shared-storage draft/final closure -> final layout`. Add
`services/shared-storage.ts` to Phase 4 resource tasks. Loader temporaries/destination evaluation
must exist in the symbolic machine program before closure.

### PF-013 — Capability/effect types are not representable — 🟠 MAJOR

**Fix:** Special-case `c64.loader.load` before generic capability binding; add a `LoadUnitType` and
`PlaceType` only if the existing type model needs them, otherwise validate the two arguments
directly. Add `"blocking-write"` to `ProfileEffect` (or model the operation as `volatile-write` plus
its own effect). Add the flow-fact copy points (`snapshotScalarFacts`, `restoreScalarFacts`,
`captureBranchFacts`) to Phase 3.

### PF-014 — Existing E10275 guard also matches the D64 profile — 🟠 MAJOR

**Fix:** Narrow `frontend/scalar-expressions.ts:192-212` to `packager.id === "cbm-prg"` or the four
PRG IDs. Add a regression test.

### PF-015 — Quiescence cites the wrong module and a missing audio stop — 🟠 MAJOR

**Fix:** Use `semantic/interrupt-ownership.ts` for IRQ/NMI depth. Treat audio routes as recognized
IRQ/NMI sinks (covered by ownership) or mainline ticks that cannot run during the blocking call;
do not add a new `c64.audio.stop` API. Update ST-47 and AC-21 wording.

### PF-016 — Loader stack not modeled — 🟠 MAJOR

**Fix:** Add an explicit `load-unit` stack fact (JSR `$FFD5` + KERNAL internal peak + stock IRQ
frame) to the SFA certificate and memory `stackDomains`. Add a VICE canary case with periodic IRQs.

### PF-017 — Phase 9 violates spec-first ordering — 🟠 MAJOR

**Fix:** Explicitly classify Phase 9 as a qualification phase exempt from the red-phase rule;
security cases move to Phase 7/8 where they can be red. Update the plan overview.

### PF-018 — R7.2/AC-02 and R7.42/AC-04 test gaps — 🟠 MAJOR

**Fix:** Add ST cases for index, mutation, cast, return, store, compare, iterate, and a prior
initialized candidate after a failed dynamic load. Add them to Phase 1/3.

### PF-019 — AC-18 user documentation missing — 🟠 MAJOR

**Fix:** Add a Phase 9 task for user-facing trusted-media documentation naming HLE-010 and the
no-containment boundary.

### PF-020 — Directed verification commands run the whole corpus — 🟠 MAJOR

**Fix:** Use `yarn vitest run test/rd07/...` for root specs and
`yarn workspace @blend65/compiler test src/...` for package impl tests. Add
`yarn install --frozen-lockfile` to each phase checkpoint. Reserve `yarn test` for the final
boundary.

### PF-021 — Allocation measurement cannot run before the serializer — 🟠 MAJOR

**Fix:** Add a checked-in reference D64 fixture (created once, not a build dependency) and measure a
multi-block KERNAL load before serializer code. Record the fixture, hash, VICE version, and
duration in `09-allocation-measurement.md`.

### PF-022 — Duplicate evidence ownership across Phases 5 and 8 — 🟠 MAJOR

**Fix:** Phase 5 owns memory intervals/residencies/views; Phase 8 owns assets, costs, debug load
units, `.build.json`, and cross-sidecar checks. Remove the duplicated producer tasks.

### PF-023 — Executor tasks edit specification oracles — 🟠 MAJOR

**Fix:** Delete the assertion-writing from 4.3.2/6.3.2; ST-52 and ST-77..96 already own the
expectations. Any new expectation goes to a `[spec-author]` task with a red phase.

### PF-024 — Expressiveness ledger retired before the load exists — 🟠 MAJOR

**Fix:** Keep the row until Phase 7; retire it with an end-to-end load test and the named
replacement case.

### PF-025 — `D64_PROFILE` has no producer; diagnostic drift — 🟡 MINOR

**Fix:** Remove `D64_PROFILE`; use E10279 for unsupported profiles. Use E10267 for sidecar/component
mismatch and `D64_STRUCTURE` for image-structure failures. Add ST-135.

### PF-026 — Unknown timing literal — 🟡 MINOR

**Fix:** `.costs.json` uses `{kind:"unknown"}`; `"Unknown"` stays in `.build.json` host provenance.
Update ST-112.

### PF-027 — Name encoding rejects normal project names — 🟡 MINOR

**Fix:** Use the Specification 4 lower-upper PETSCII policy for the boot name and label; allow
letters, digits, and spec-representable punctuation. Reject >16 bytes with `D64_NAME`; never
truncate. Unit names remain `L` + 12 uppercase hex. Add lowercase/hyphen/16/17-byte tests.

### PF-028 — `$10000` acceptance conflicts with visible KERNAL ROM — 🟡 MINOR

**Fix:** Keep the `$10000` arithmetic at the lowering/unit level; the D64 source destination proof
rejects any interval intersecting `$E000–$FFFF` under the current profile. Add a lowering-level
ST-30 and a source-level ST-64 note. Record the interpretation in AR-P21.

### PF-029 — ST-12 uses `byte[8]` for a 2048-byte charset — 🟡 MINOR

**Fix:** Change to `byte[2048]` or use an 8-byte raw fixture.

### PF-030 — Local loadable unit has no oracle — 🟡 MINOR

**Fix:** Add ST-136 for a reachable local unit and an unreachable local unit, plus an impl test for
the function-qualified identity.

### PF-031 — Integration test files unscheduled — 🟡 MINOR

**Fix:** Map `d64-capacity` into `d64-codec`, `prg-regression` into `d64-publication`, and add one
`d64-e2e` task.

### PF-032 — VICE boundedness unspecified — 🟡 MINOR

**Fix:** State the cycle limit, observation checkpoint, soft-skip rule, and reuse of the existing
VICE driver conventions.

### PF-033 — Directory-only task targets — 🟡 MINOR

**Fix:** Replace directory-only targets with exact file paths.

### PF-034 — Plan/roadmap lifecycle mismatch — 🟡 MINOR

**Fix:** Keep the plan index at `Plan Created` until this preflight passes; then update both to
`Plan Preflighted`.

### PF-035 — BAM/directory hash projections undefined — 🟡 MINOR

**Fix:** `bamSha256` = SHA-256 of BAM sector 18/0; `directorySha256` = SHA-256 of the 18 directory
sectors in numeric track/sector order. Pin in ST-78/ST-79.

### PF-036 — `D64PlacedFile` undefined — 🟡 MINOR

**Fix:** Define it as `{file: D64File; startTrack; startSector; endTrack; endSector; blocks}`.

### PF-037 — AR-P7 contradicts the component docs on registers/SFA — 🟡 MINOR

**Fix:** Clarify: A/X/Y/flags clobbered, live values spilled by the compiler, result in A; KERNAL
workspace above `$02–$8F`, so the SFA window is unchanged. Update AR-P7, 03-03, 03-04.

### PF-038 — `loadUnits` ordering — 🟡 MINOR

**Fix:** Covered by PF-009: order by name.

### PF-039 — E10191 used for an internal failure — 🔵 OBSERVATION

**Fix:** Use an internal compiler failure for an unmaterializable unit; keep E10191 for source
non-constant initializers.

### PF-040 — Packager-facts type widening unstated — 🔵 OBSERVATION

**Fix:** Covered by PF-002.

### PF-041 — Staged boot PRG kept out of the published set — 🔵 OBSERVATION

**Fix:** Covered by PF-004.

## Iteration 2 re-review

The bounded re-review found 5 major, 12 minor, and 1 observation. All majors were fixed; minors
were fixed or accepted with evidence.

| ID | Severity | Finding | Resolution |
| -- | -------- | ------- | ---------- |
| PA-001 | MAJOR | Additive `loaderStrategyId`/`loadStates` fields had no validator/type tasks | Added Phase 5 memory type/validator task and Phase 8 build type/validator task; ST-110 now names `loadStates`; 03-07 no longer claims the current validators admit them |
| PA-002 | MAJOR | Phase 2 could not reach green because machine lowering was Phase 4 | Added the minimal machine `load-unit` operation to Phase 2; exact KERNAL lowering, stack, and resources stay Phase 4; added a `[spec-author]` task to update the existing D64-unsupported expectation |
| PA-003 | MAJOR | Executors edited spec tests and qualification suites had no author | Added `[spec-author]` tasks for the import-boundary, VICE, and qualification suites; Phase 9 runs authored cases; ST-98/ST-102 deduplicated to `d64-e2e` |
| PA-004 | MAJOR | Boot load-unit residence could not satisfy the existing cross-check | Boot `loadUnit.name` is the component id with `residence: []`; boot ranges stay in normal debug ranges; unit id = component id pinned |
| PA-005 | MAJOR | Field/nested destinations had no non-overlapping evidence representation | Added object-interval partitioning at destination boundaries; `.assets.json` ranges match the segment |
| PA-006 | MINOR | Duplicate `.build.json` producer in Phases 7 and 8 | Phase 7 owns the package; Phase 8 asserts sources/aliases/order and fixes only the projection |
| PA-007 | MINOR | `yarn install --frozen-lockfile` missing from Phase 1–8 checkpoints | Added to every phase Verify line |
| PA-008 | MINOR | Two stale pipeline-order statements | Corrected `02-current-state` and `03-06` |
| PA-009 | MINOR | Unknown timing table still said `"Unknown"` | Changed to `{kind:"unknown"}` |
| PA-010 | MINOR | Sidecar/component mismatch mapped to `D64_STRUCTURE` | Changed to E10267 |
| PA-011 | MINOR | ST-78/ST-79 did not pin the exact header slice or hash projections | Added the 144–255 slice and both hash projections |
| PA-012 | MINOR | Phase 2 verify ran a package spec through the root runner | Changed to the package workspace command |
| PA-013 | MINOR | `loadUnit::` aliases had no debug symbols | Dropped the alias; `loadUnitId` is the reference |
| PA-014 | MINOR | Plan-local table said save/restore registers | Aligned with AR-P7 (compiler spills, adapter clobbers) |
| PA-015 | MINOR | Quick-reference example used nonexistent audio APIs | Replaced with the actual IRQ/NMI quiescence flow |
| PA-016 | MINOR | Loader vs call-site byte ownership undefined | Defined loader = setup sequence, callSite = destination/end-check/boolean |
| PA-017 | MINOR | Build-only view delivery channel could breach the editor boundary | Defined it as sidecar-derived; RD-09 reads published sidecars |
| PA-018 | OBSERVATION | Roadmap row stale | Updated to Plan Preflighted with 131 tasks |

## Gate check

- All critical/major findings resolved in the plan documents.
- Minor findings resolved or accepted with the evidence above.
- `spec/` remains untouched.
- The plan's 131-task structure is preserved; new tasks are balanced by moved/merged tasks.
