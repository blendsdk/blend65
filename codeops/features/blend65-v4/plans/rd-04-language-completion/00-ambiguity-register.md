# Ambiguity Register: RD-04 Language Completion

> **Status**: AR-P1–AR-P26 resolved; implementation qualification remains open
> **Last Updated**: 2026-09-26
> **CodeOps Artifact Schema**: 1

## Planning Scope Contract

| Boundary | Authorized scope |
|---|---|
| Planning target | The complete RD-04 core language and correct `optimization: none` compiler for the first qualified C64 profile |
| Context artifacts | Frozen Specification 4, active `blend65-domain-expert` 2.0.0, RD-04 and its accepted requirements preflight, completed RD-01 through RD-03 artifacts, current compiler/CLI/LSP source and tests, ACME 0.97 and VICE 3.10 evidence |
| Modification set | This plan folder, the Blend65 v4 feature/portfolio roadmaps at lifecycle transitions, and the user-authorized AC-34/AC-37 correction already committed to RD-04; Specification 4 and sibling RDs remain read-only |

## Decisions

| ID | Category | Decision | Authority | Status |
|---|---|---|---|---|
| AR-P1 | Scope | Plan every RD-04 Must/Should requirement and acceptance criterion. Do not pull forward RD-05 platform systems, RD-06 native asset formats, RD-07 loaders/disk delivery, RD-08 optional optimization, or RD-09 production editor features. | User approved the recommended planning baseline on 2026-09-23. | ✅ Resolved |
| AR-P2 | Technical / plan partition (complex) | Use one plan folder with nine ordered phases. Each language-family phase carries specification tests through the existing semantic/SFA/machine/ACME/VICE path where runtime behavior applies; do not split the RD into duplicate plan workflows or separate frontend/backend programs. | User approved on 2026-09-23. Independent challenger converged with High confidence: one plan avoids duplicated gates and fragmented shared-seam ownership; phase boundaries control size. | ✅ Resolved |
| AR-P3 | Verification | Use focused family/package checks during implementation. At integration boundaries run `yarn install --frozen-lockfile && yarn build && yarn typecheck && yarn test`, plus applicable ACME/VICE qualification, touched-file Prettier, whitespace checks, and a read-only frozen-`spec/` proof. Claim no lint result because the actual checkout has no lint script, Turbo task, or ESLint executable. | User approved the recommended planning baseline on 2026-09-23. | ✅ Resolved |
| AR-P4 | Expert-output boundary | Keep direct `optimization: none` lowering free of alternative search or parity-selection logic, while independent qualification requires every implemented operation family to meet or beat an equal-contract expert reference. A meet-only result creates an authorized actionable issue; a worse result blocks RD-04. | User authorized the AC-34/AC-37 correction on 2026-09-23; committed as `4801ac0`. | ✅ Resolved |
| AR-P5 | Native Windows evidence | Implement platform-independent semantics now and prove them on Linux plus pure deterministic cases. Defer native Node 22 Windows x64 execution to RD-10 when the user supplies access; this does not block Linux RD-04 implementation or RD-05 through RD-09 work, but the missing native evidence remains explicit. | User's standing direction places Windows at the end; the approved planning baseline retained that boundary on 2026-09-23. | ✅ Resolved |
| AR-P6 | Completion crosswalk | Keep one checked static JSON crosswalk under `test/rd04/` and one direct Vitest which compares its source keys with the frozen grammar productions, named semantic rules, active diagnostics, and applicable conformance clauses. Each row names only its implementation owner, decisive proof, and status. Add no generator, service, dashboard, or second specification. | User approved the recommendation on 2026-09-23. Required by RD-04 R4.2; no equivalent artifact exists in the current tree. | ✅ Resolved |
| AR-P7 | Qualification layout | Keep focused specification and implementation tests beside the existing compiler/CLI/LSP modules. Put only cross-stage fixtures, independent behavior oracles, expert references, ACME checks, and bounded sequential VICE cases under `test/rd04/`, reusing the public compiler and the RD-03 VICE protocol. Add no package or general test framework. | User approved the recommendation on 2026-09-23. This follows the current co-located compiler tests and root `test/m1/` qualification boundary. | ✅ Resolved |
| AR-P8 | Source structure | Extend the existing frontend → semantic → SFA → machine → artifact path. When a phase touches an existing file already above roughly 700 lines, first move its current responsibility into a focused module in the same directory, then add the required behavior there. Do not pre-split smaller files, change package topology, or add a pass/plugin framework. | User approved the recommendation on 2026-09-23. `parser.ts`, `analyzer.ts`, `semantic/lower.ts`, and `machine/lower.ts` are already 766–857 lines; RD-04 forbids a new framework. | ✅ Resolved |
| AR-P9 | Expressiveness-ledger location | Keep the conformance feature as the ownership destination, but place RD-04's v4 ledger and executable expiry gate at `test/rd04/expressiveness-ledger.json` and `test/rd04/expressiveness-ledger.spec.test.ts`, beside the other approved cross-stage evidence. Do not recreate the absent `packages/test-harness` package. The gate compiles each recorded restriction and turns red when the restriction disappears so closeout must retire or re-own it. | User approved on 2026-09-23. The named `packages/test-harness` package/file does not exist in this checkout; the conformance roadmap records the older ledger pattern. | ✅ Resolved |
| AR-P10 | Technical (runtime) — coverage keys | Use only stable names printed by the frozen specification: the grammar's 106 indexed production names, semantic rule IDs qualified by source file, active Chapter 14 diagnostic codes, and Chapter 15 §5.1–§5.5 subsection names. Do not assign invented IDs to nested prose, bullets or table rows. The checked JSON remains one static audit artifact and one direct test; no new product or framework. | User explicitly approved the recommended named-item scheme on 2026-09-23. | ✅ Resolved |
| AR-P11 | Test authority (runtime) — obsolete partial-parser spec cases | Supersede the four RD-03-era cases in `parser.spec.test.ts` that require valid Specification 4 grammar to stay `unchecked`; replace them with complete-grammar expectations while preserving their source fixtures. Update the two corresponding implementation tests in `parser.impl.test.ts`. Keep the new Specification 4 grammar cases unchanged. The same valid inputs cannot simultaneously be complete and unchecked. | User approved on 2026-09-23. Frozen Specification 4 is the authority; the old partial-parser expectations were temporary RD-03 behavior, not current language semantics. | ✅ Resolved |
| AR-P12 | Test/API authority (runtime) — asset-aware overlay | Make the existing `analyzeProjectOverlay` async so it uses the same bounded asset resolution as `checkProject`, await it in the language server, and supersede the five RD-03-era synchronous overlay expectations in `server.spec.test.ts` with awaited expectations that preserve their fixtures and assertions. Keep the new CLI/editor diagnostic-identity tests unchanged. | User approved on 2026-09-24. The existing raw-asset resolver is async, so one awaited overlay path is the minimum sufficient way to make CLI/editor diagnostics identical without a second analysis API. | ✅ Resolved |
| AR-P13 | Test seam (runtime) — Phase 2 scalar execution and conditional facts | Write one direct `test/rd04/scalars-runtime.spec.test.ts` using the existing public `buildProject` and `test/m1/vice-runtime.ts` monitor to observe fixed memory results; define the minimum stored-result identity and captured-range fact on the existing frontend flow-fact merge surface so one synthetic test can check agreeing and disagreeing joins. Add no general harness, package, or transfer implementation. | User explicitly approved the recommended minimum test contracts on 2026-09-24. AR-P7 already permits cross-stage evidence in `test/rd04/`; this ruling fixes its two test-facing contracts. | ✅ Resolved |
| AR-P14 | Test authority (runtime) — obsolete aggregate-return incompleteness | Supersede only the two old `service.spec.test.ts` expectations that require a valid fixed aggregate return to stay incomplete. Preserve their fixtures and all other pending-result cases. The plain return is complete; the same source with an undeclared name is an error retaining E10239. Leave new Phase 4 specification cases unchanged. | User explicitly approved the recommended narrow supersession on 2026-09-24. Frozen Specification 4 requires the return; both old expectations encoded the previous partial compiler state. | ✅ Resolved |
| AR-P15 | Test authority (runtime) — closed profile capability list | Extend only the old exact-list expectation in `packages/compiler/src/frontend/profile.spec.test.ts` to include the Specification 4 C64 interrupt sink/restore operations while preserving its existing 11 entries, ordering check, and other assertions. The current assertion calls those 11 the complete declaration environment, so it cannot remain exact after the required `c64.system` operations are added. Keep the new Phase 6 interrupt specification cases unchanged; add no second capability registry solely to preserve the obsolete list. | User approved the recommended narrow supersession on 2026-09-25. Grounded in `profile.spec.test.ts`'s exact `capabilities` array and `frontend/profile.ts`'s single `capabilities` declaration environment; frozen Spec 4 Ch 06 §7.7 and Appendix C64 §9.2 require the sink operations. | ✅ Resolved |
| AR-P16 | Technical (runtime) — NMI install/reentry proof | Defer usable cooperative `setNMI`/`setNMIExclusive` for the selected C64 profile. Its unbounded NMI self-reentry and non-atomic two-byte NMINV update cannot be proved safe; reject reachable sinks with E10245 before lowering. Finish Phase 6's safe IRQ route without claiming NMI success. RD-05 R5.15–R5.17 owns a qualified finite NMI source/update contract and any separately authorized Specification 4 correction. | User approved the recommended deferral on 2026-09-25. Frozen Specification 4 Ch 15 §5.3 and Appendix C64 §9.2; expert C64 runtime authority v2.0.0; independent safety challenge on 2026-09-25. | ✅ Resolved |
| AR-P17 | Technical (runtime) — handler-side IRQ vector updates | Defer IRQ vector installs/restores from interrupt-domain execution to RD-05 R5.16 with E10245 and tracked expressiveness debt. Mainline IRQ installs remain in scope. RD-05 must give handler-owned predecessors separate live storage and prove chain-safe contexts before accepting this valid source form. | User approved the recommended narrow deferral on 2026-09-25 after Phase 6 review found live-link aliasing and self-mask context growth. Frozen Specification 4 permits finite balanced nesting generally; this is a temporary compiler limitation, not a language rule. | ✅ Resolved |
| AR-P18 | Technical (runtime) — compile-time evaluator test entry | Use one internal-only evaluation entry with optional reduced step/byte/depth limits and observable typed results for specification tests. Production `check`/`build` always use the fixed `comptime-budget-v1` constants; source, manifest, environment and CLI gain no override. This one entry permits exact N/N+1 budget cases and the full canonical `sin16` stream without a second harness or public setting. | User explicitly approved the recommended private test entry on 2026-09-25. The plan required reduced-limit cases but named no interface; the implementation-blind author had stopped before inventing one. | ✅ Resolved |
| AR-P19 | Scope (runtime) — selected-profile source facts | Remove only the duplicate source-level profile-fact branch obligation from RD-04 R4.34/AC-28 and ST-42. RD-05 R5.3/AC-03 already own compile-time profile facts across PAL/NTSC; frozen Specification 4 Ch 15 and Appendix C64 define the facts without a source-visible binding or spelling. Complete RD-04's memory, size, CPU, BCD and embed surface without inventing an API. | User approved the recommended narrow deferral on 2026-09-25. Frozen `spec/` remains untouched under D3; RD-05 retains the source-fact obligation. | ✅ Resolved |
| AR-P20 | Test authority (runtime) — obsolete fixed raw-asset size | Replace only the old `raw-asset.spec.test.ts` expectation that rejects 511- and 513-byte files with acceptance of nonempty inferred lengths. Keep empty-file rejection, explicit-size E10140, all containment/alias/change checks, the new Phase 7 raw-embed tests, and M1's sprite consumer/layout checks. Extend the existing resolver and layout path; add no second raw-asset mode. Frozen Ch 13 §§2.1, 3 EMB-4, 5 make raw extent file-derived, whereas the old M1 test requires exactly 512 bytes for every raw file. | User explicitly approved the narrow test-authority correction on 2026-09-26. | ✅ Resolved |
| AR-P21 | Runtime / Phase 7 whole-routine parity | Seven byte/word BCD routines now match complete equal-contract expert references. The final two-volatile-operand cases are byte subtraction at 18 bytes / 26 cycles / one scratch byte, word addition at 34 / 48 / one, and word subtraction at 34 / 48 / one; VICE confirms behavior. [#86](https://github.com/blendsdk/blend65/issues/86) records the repair history. This was direct lowering work, not a reason to introduce an optimizer or change the frozen spec. | The user-approved AR-P4 required fixing worse-than-expert output before Phase 7 closed. The apparent new scope fork was false; an independent challenge confirmed bounded direct BCD lowering and rejected pulling a generic optimizer into RD-04. The narrow repair is complete and verified. | ✅ Resolved |

| AR-P22 | Scope (runtime) — future-target representation tests | Keep RD-04's audit that shared semantics are target-independent and preserve current symbolic identities, effects and placement. Do not invent and exercise unused bank/address-space/transfer/DMA/clock fields before their contracts exist. Add concrete representation facts with their first real consumers: RD-05 for C64 banking/clock ownership, RD-07 for transfers, and the separate C64U target feature for its DMA/address spaces. This narrowly changes R4.54/AC-41/ST-52 wording, not frozen Specification 4, current behavior or optimization obligations. | User approved on 2026-09-26. The independent Phase 8 author found no declared future-field API; the accepted correction keeps current target-independence proof without speculative structure. | ✅ Resolved |

| AR-P23 | Test authority (runtime) — completed warnings and readable-label observers | Update only old diagnostic expectations to include the warnings required by frozen Specification 4, and update test-only label lookup/format matching for the approved source-readable assembly. Preserve source fixtures, error expectations, exact runtime values, memory/MMIO order, ABI/flags, expert costs, uniqueness checks and all new Phase 8 specification expectations. Do not suppress warnings globally, add compatibility aliases solely for tests, relax cost limits, or change the frozen specification. Exact affected files and evidence are listed below. | User explicitly approved the narrow test-only modification set on 2026-09-26, then confirmed the High-effort handoff. Updates are verified: install, build, typecheck and all 1,615 tests pass. Phase 8 coverage and review remain open. | ✅ Resolved |

| AR-P24 | Interface (runtime) — canonical artifact diagnostics | Keep the five existing evidence-validator signatures and their `kind`, `reason`, and safe `diagnostic` string; add `record: ProjectDiagnostic` to their error results so E10267/E10268 carry code, severity, message, input/field location, related spans and optional help. Use the known sidecar name as the input identity; preserve envelope/version precedence and report the failed supported-version invariant. Propagate that record through existing service consumers where applicable. No new public command/export, schema version, generic validator or framework. Existing tests remain immutable. | User explicitly approved the recommended additive record on 2026-09-26. Task 8.1.2 resumes at the already-confirmed High effort; the implementation and qualification remain pending. | ✅ Resolved |

| AR-P25 | Test authority (runtime) | Replace two literal E10235 placeholders with valid source-specific suggestions; preserve fixtures and semantics. | User approved both recommended corrections by instructing “proceed” on 2026-09-26. | ✅ Resolved |
| AR-P26 | Scope / test authority (runtime) | Keep E10204 native-format parsing proof with RD-06; retain RD-04 honest-unavailability checks. | User approved both recommended corrections by instructing “proceed” on 2026-09-26. | ✅ Resolved |

## Resolution Notes

### AR-P25 — Replace literal diagnostic placeholders, not language behavior (runtime)

**Approved, 2026-09-26:** authorize only the two E10235 message expectations in
`packages/compiler/src/frontend/scalars.spec.test.ts` (the existing nominal-enum test).
Replace `Direction(<expr>)` with useful source-specific conversion suggestions:
`Direction(raw)` and `Direction(byte(State.Up))`. The latter must retain the explicit
enum-to-byte conversion required by frozen Chapter 9 before converting to another enum.
Preserve the source fixture, error codes, severity, third E10236 expectation and all new tests.

Evidence: the frozen Chapter-14 E10235 template substitutes `<expr>`, and the new independent
`diagnostics-scalar-records.spec.test.ts` expects `Mode(peek($0400))`. The old two assertions
literally expect `<expr>`. Keeping both would require fixture-dependent messages rather than
one honest producer. The frontend regression exposes exactly this specification-test conflict.
The separate implementation test that used spanless E10020 as a sorting fixture was corrected
to test sorting directly; an additional integration case preserves the now-required module
header location. No existing specification test was changed during this correction batch.

This is a narrow test-authority ruling, not permission to alter enum conversion semantics,
freeze code generation, weaken diagnostics, or change the frozen specification.

### AR-P26 — Keep native-format parsing proof with its existing owner (runtime)

**Approved, 2026-09-26:** move only the decisive E10204 native-format parsing proof from
RD-04 to RD-06. Preserve the three-byte malformed SpritePad fixture and its expected diagnostic
contract in RD-06's pending qualification requirements before removing that one active case
from `test/rd04/diagnostics-project-records.spec.test.ts`. Reassign only the E10204 crosswalk row;
all 182 keys remain accounted for (171 RD-04, ten RD-06, one RD-07). Existing RD-04 native-format
unavailability/no-raw-fallback tests remain required. Do not invent a partial native parser or
report an unexamined file as malformed merely to satisfy this case.

Evidence: RD-04 ST-45/ST-51 explicitly require honest unavailability for later native handlers;
RD-06 R6.2/R6.3 and its native format requirements already own structural E10204 parsing and
truncation proofs (`RD-06-native-assets-compile-time-composition-and-resident-layout.md`, lines
74, 103, 128, 201, 695 and 712). Frozen Chapter 14 defines E10204 as a genuine parse failure.
The new RD-04 case expects a signature/header/version/truncation reason for `bad.spd`, but the
current frontend correctly has no native parser. The diagnostic inventory included this code
without reconciling the existing ownership boundary. This is an ownership correction requiring
approval, not a new deferral of compiler functionality or a reason to expand RD-04.

Both decisions were surfaced and approved on 2026-09-26. Apply the exact two old message
expectations, preserve the E10204 fixture under RD-06 before removing its RD-04 case, update
only that coverage row, and resume the already-confirmed High-effort correction batch.

### AR-P24 — Structured errors from the existing report-file validators

Frozen Chapter 14 requires E10267 for malformed public artifacts and E10268 for a valid envelope
with an unsupported positive schema version. The existing RD-03 design deliberately gives
`validateBuildEvidence`, `validateAssetsEvidence`, `validateMemoryEvidence`,
`validateCostsEvidence` and `validateDebugEvidence` an error union with only `reason` and a
plain `diagnostic` string. No E10267/E10268 producer exists. Task 8.1.2 cannot independently assert
the required canonical fields through that approved interface.

The user-approved additive record uses the already-owned `ProjectDiagnostic` shape; it does not
replace existing callers' text or require another reader API. The modification set is this plan's
artifact/interface specification, focused new artifact specification tests, the existing evidence
validators and their service adapters when the implementation task begins. Frozen `spec/`, public
sidecar formats, package exports and CLI commands remain unchanged. This is an interface decision,
not permission to build a generalized diagnostic or schema subsystem.

### AR-P23 — Two outdated test assumptions, no new product scope

All 49 new diagnostic cases pass, as do build and typecheck. The broader checks expose two
incompatible old assumptions:

1. Old legal-source tests require an empty diagnostic list even for unused declarations,
   always-false conditions, or costly struct indexing. Frozen Chapter 14 requires these warnings.
   The warning is advisory: legal source still compiles and no runtime storage or code is added.
2. Runtime observers decode only `b65_<hex>` labels. The approved readable output uses
   `b65_<source-hint>_<hex-identity>`. These tests fail while finding their checkpoint, before
   observing behavior. Keep the complete stable identity and unique-address checks; change only
   how the test locates that same checkpoint.

**Authorized modification set (user approval, 2026-09-26):**

| Concern | Exact paths (brace groups enumerate filenames, not a broad directory grant) |
|---|---|
| Warning expectations, specification tier | `packages/compiler/src/frontend/{address-of,aggregates,comptime,effects,flow,intrinsics,profile,scalars,service}.spec.test.ts`; `packages/compiler/src/semantic/{cfg,operations,whole-program}.spec.test.ts`; `packages/compiler/src/services/services.spec.test.ts`; `packages/language-server/src/server.spec.test.ts` |
| Warning expectations, implementation tier | `packages/compiler/src/frontend/{aggregates,comptime,scalars}.impl.test.ts` |
| Label lookup inside specification fixtures | `test/rd04/{aggregate-abi,aggregate-runtime,function-values,intrinsics-runtime,scalars-arithmetic-runtime,scalars-runtime,vice}.spec.test.ts` |
| Label lookup/format assertions in implementation fixtures | `test/rd04/{aggregate-copy,aggregate-review,bounds,expert-calls,expert-intrinsics,interrupt-selection,placement}.impl.test.ts` |
| Shared M1 observer | `test/m1/vice-driver.ts`; leave `test/m1/vice.spec.test.ts` and its behavioral oracle unchanged |

Each warning must be justified by its fixture. Do not replace diagnostic assertions with
unconditional acceptance or blanket warning filtering. Any false warning is an implementation
bug, not authorization to adjust its test. The implementation-only different-array-extent case
was already corrected from generic E10080 to canonical call mismatch E10172; its fixture and
no-call-edge assertion remain intact. The fixed-versus-unsized E10253 specification expectation
remains unchanged and passes after retaining the more specific error.

**Pre-approval evidence, 2026-09-26:** focused diagnostics 49/49 pass; compiler suite 1,192 pass / 120 fail,
all reported failures are added-warning expectations; root suite 195 pass / 26 fail, all failures
are old label lookup/format assumptions; CLI 62/62 pass; language server 13 pass / 1 fail from
the extra unused-variable warning in its exact diagnostic array; editor 6/6 pass. Existing
specification files are untouched. No commit or push was made. These results are not complete
runtime qualification: failing checkpoint lookup prevents those VICE observations.

**Post-approval evidence, 2026-09-26 14:12:** install, build, typecheck and all owned tests pass:
compiler 1,312/1,312; root 221/221; CLI 62/62; language server 14/14; editor 6/6. The root
VICE cases ran sequentially and now reach their unchanged runtime assertions. Status is
VICE-verified / hardware-unverified. Targeted formatting, whitespace and frozen-spec checks
pass. Only the authorized old test expectations/observers changed; no source fixture or cost
limit was relaxed, and warnings remain explicit assertions. These changes depend on the
unfinished Phase 8 implementation and remain uncommitted with it; no push was made.

### AR-P2 — Why one plan is simpler

RD-04 has many language families but one connected compiler. Separate plan folders would duplicate
ambiguity gates, preflights, closeouts and ownership of shared representations. One plan keeps a
single progress authority. Its nine phases remain independently reviewable and qualify complete
families instead of postponing all backend integration to the end.

The strongest counterargument is that later task detail may become stale as earlier representation
work lands. The plan therefore fixes phase contracts and tests, while each phase re-evaluates its
current implementation before execution as required by the project workflow.

**Confidence:** High. **Hardening:** Independent challenger converged; no better partition was
identified.
