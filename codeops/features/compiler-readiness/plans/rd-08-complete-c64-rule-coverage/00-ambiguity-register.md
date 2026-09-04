# Ambiguity Register: RD-08 Complete C64 Rule Coverage Plan

> **Status**: ✅ ZERO-AMBIGUITY GATE PASSED — 34 items resolved
> **Last Updated**: 2026-09-03
> **Mode**: Normal
> **Execution note**: AR-9 was added and resolved during Phase 1 before any specification or
> production code was changed.

## Planning Scope Contract

| Boundary | Recorded boundary |
|---|---|
| Planning target | Implement the approved and preflighted `compiler-readiness/RD-08`, with the first phase centered on real generated Blend programs and independent semantics for arrays, calls, branches and bounded loops. |
| Context artifacts | RD-01–RD-08 requirements and plans; readiness and readiness-execution source, tests, publications and command graph; frozen v3.0 specification as read-only semantic authority; compiler/conformance/parity/optimizer ownership artifacts. |
| Modification set | This RD-08 plan directory and the compiler-readiness roadmaps. Planning does not authorize changes to requirements, `spec/`, production code, tests, publications or sibling feature artifacts. |

| # | Category | Ambiguity / Gap | Options Presented | User Decision | Status |
|---|---|---|---|---|---|
| AR-1 | Scope | Does this plan implement all of RD-08 while preserving the mandatory first-phase priority and exclusions? | **Recommended:** yes—plan the full RD, but make phase 1 the smallest real-program vertical slice and keep generalized frameworks, unfinished RD-05/RD-07 work, readiness-execution expansion, compiler fixes and optimizer profiles out. | User accepted recommendation: full RD with the stated first-phase priority and exclusions. | ✅ Resolved |
| AR-2 | Behavioral | What concrete first-phase generated-program surface is sufficient? | **Recommended:** a bounded set of real programs covering fixed arrays with direct/computed reads and writes; zero/multiple-argument and nested scalar calls with return propagation; both branch outcomes plus nesting; and bounded loops with zero/one/multiple iterations. Include invalid neighbors and exact-bound/first-over-bound cases, but no denominator-wide expansion in phase 1. | User accepted recommendation: the bounded arrays/calls/branches/loops surface and named edges. | ✅ Resolved |
| AR-3 | Scope | How is the first vertical rule population kept exact without creating another manifest system? | **Recommended:** enumerate only the exact inventory IDs directly claimed by the phase-1 ST cases in the existing publication's `firstVerticalRuleIds`; validate lexical order, uniqueness, family membership and exact equality. Do not infer extra members from broad chapter/category predicates. | User accepted recommendation: explicit ST-owned IDs in the existing publication authority. | ✅ Resolved |
| AR-4 | Technical | Where should new structured IR validation and evaluation logic live given existing file sizes? | **Recommended:** minimally extend the central closed IR unions, but put array/call/control-flow validation, rendering and evaluation in focused companion modules invoked by the existing seams. Do not grow the 952-line validator, 735-line modeled generator or 654-line evaluator into larger monoliths. | User accepted recommendation: central union delta plus focused companion modules. | ✅ Resolved |
| AR-5 | Data & state | How should publication evolution be sequenced? | **Recommended:** phase 1 produces and proves cases without selecting a changed publication; phase 2 adds only the minimal version dispatch/migration/replay invalidation needed for the changed-format parent, then publishes through the existing separate parent/child pointers with fail-closed stale-pair recovery. | User accepted recommendation: cases first, minimal evolution before changed selection, existing pointers retained. | ✅ Resolved |
| AR-6 | Ordering | How should the denominator-wide remainder be divided after the vertical slice? | **Recommended:** proceed by reviewed rule families and evidence tier: terminal disposition/quality classification, remaining source families and non-source handlers, declared public-route campaigns, then atomic publication and closeout. Each phase stays independently bounded and specification-first. | User accepted recommendation: bounded family/tier phases through closeout. | ✅ Resolved |
| AR-7 | Verification | What command is authoritative before every commit and final completion? | **Recommended:** use the project command verbatim: `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`, plus Prettier checks on touched files and `git status --porcelain spec/`. Exhaustive readiness and production VICE remain explicit phase acceptance commands, never part of normal `yarn test`. | User accepted recommendation: exact project verification and explicit exhaustive/emulator tiers. | ✅ Resolved |
| AR-8 | Naming & integration | What artifact/module naming and dependency policy should the plan enforce? | **Recommended:** plan folder `rd-08-complete-c64-rule-coverage`; use descriptive `structured-*`, `rule-family-*`, and `readiness-smoke-*` module names selected during task decomposition; add no dependency and preserve the bidirectional compiler/readiness import prohibition. | User accepted recommendation: descriptive local modules, no dependency, preserved boundary. | ✅ Resolved |
| AR-9 | Runtime technical | Which exact public contracts may implementation-blind Phase-1 specification tests target for structured evaluation, loop unrolling, boundary rejection, diagnostics and canonical source? | **Recommended (only viable):** amend `03-01` and `07-testing-strategy` with closed v2 request/result types, exact entry names, grammar, diagnostic families and relation/mutation IDs that extend the existing `evaluateOracleProgram`, `evaluateSemanticRelation`, `scanReadinessOracleBoundary` and renderer seams additively. Preserve all v1 shapes and reject deriving tests from implementation. Reading production logic while authoring tests was rejected because it violates the immutable-oracle gate; inventing test-local interfaces was rejected because implementation could satisfy tests without satisfying the planned public contract. | User accepted the expert recommendation; the exact additive contracts are now authoritative in `03-01` and `07-testing-strategy`. | ✅ Resolved |
| AR-10 | Runtime technical | How do implementation-blind tests obtain authenticated structured relation/execution cases and validate the first vertical bindings without guessing opaque v1 authorities or adding a second runner/publication system? | **Recommended:** add narrow authenticated structured-case resolvers, an additive `createExecutionCaseV1` request overload plus authority projections that feed the unchanged `createExecutionRouteRequestV1`/handler table, and a passive first-vertical candidate validator backed by the same case registry. Preserve v1 call signatures/results, do not accept caller-supplied observations/digests, and defer persistence/selection to Phase 2. A test-only forged authority was rejected because it would test rejection; a new runner or publication subsystem was rejected as scope expansion. | User's standing direction delegates technical plan choices to the expert recommendation; the exact contracts are recorded in `03-01` and `07-testing-strategy`. | ✅ Resolved |
| AR-11 | Runtime technical | May the 883-line formatted structured oracle implementation be split when the contract names one public owning module and the repository requires source files to stay below approximately 700 lines? | **Recommended:** retain `structured-oracle-evaluator.ts` as the sole public contract owner and add one private `structured-oracle-runtime.ts` implementation companion. This is the minimum split that preserves the four-module public architecture and AR-4's delegation intent. An oversized file and formatter suppression were rejected because both violate repository standards without improving the contract. | User's standing direction delegates technical plan choices to the expert recommendation; the private runtime companion is authorized and recorded in `03-01`, `07-testing-strategy` and task 1.2.4. | ✅ Resolved |
| AR-12 | Runtime authority | How can the structured execution case supply the contract-required oracle token to the unchanged execution route when genuine publication contexts are authenticated only by a private publication WeakMap and Phase 1 must not manufacture or select a publication? | **Recommended after independent challenge:** bind a fresh structured oracle token to the exact execution-case state, expose one purpose-limited `isExecutionCaseOraclePairV1(executionCase, oracle)` verifier through the existing `@blend65/readiness/execution-runtime` subpath, and have the unchanged route-construction entry call that verifier. Legacy pairs retain the existing published-context probe. A standalone structured context mint was rejected because it permits cross-case substitution and distorts published-request semantics; adapter-owned duplicate authority and synthetic full publications were rejected as weaker or out of scope. | User's standing direction delegates technical plan choices to the expert recommendation; execution-runtime and adapter ownership are amended in `03-01`, `07-testing-strategy` and task 1.2.5. | ✅ Resolved |
| AR-13 | Runtime ordering / publication compatibility | How can Phase 1 reach its mandatory green checkpoint after its truthful current implementation revisions make immutable v1 binding rows non-executable, while v1 bytes must remain unchanged and replay must never substitute current code? | **Recommended after independently challenged repository evidence:** pause final verification of task 1.2.5, execute the coherent Phase-2 parent compatibility slice (tasks 2.1.1–2.2.4) as an explicit prerequisite, then return to finish Phase 1. That slice distinguishes passive historical resolution from exact-revision replay, adds v1/v2 dispatch, requires deterministic explicit migration of all nine changed handlers, and publishes the first current v2 parent. A passive-only shim was rejected because current publication/failure-history tests need executable authority; historical-callable duplication, an interim v1 release, implicit mixed migration and accepted RED were rejected. | User's standing direction delegates technical plan choices to the expert recommendation; the execution exception and exact compatibility contract are recorded in `03-03`, `07-testing-strategy`, `99-execution-plan` and the roadmap. | ✅ Resolved |
| AR-14 | Runtime interface authority | Which exact public contracts may implementation-blind Phase-2 specification tests target for family/disposition v2 data, passive historical resolution, exact replay invalidation, nine-handler migration, parent/child publication, embed fixtures and the optimizer consumer projection? | **Recommended after three grounded API maps and independent challenge:** add the exact contracts in `03-05`: complete v2 model/parent documents, opaque passive record and executable authority separation, derived all-nine migration, authenticated embed references, existing one-use parent transaction/fault seams, unchanged execution-child v1 transaction, and an identity-only consumer projection. Reinterpreting v1, adding a needless child v2, a combined transaction, current-handler replay fallback and cost authority were rejected. | User's standing direction delegates technical plan choices to the expert recommendation; `03-05` is authoritative and affected plan/test tasks are amended. | ✅ Resolved |
| AR-15 | Runtime test/authority seam | How can readiness-execution prepare a genuine v2 parent for ST-26 without importing a private readiness test fixture or independently rebuilding the security-sensitive 2,112-row model oracle? | **Recommended:** add `createFirstRuleModelRegistryV2`, which derives the exact initial registry from an authenticated passive source record, first-vertical capability and fixture-set capability. Both packages then use the same public authority seam; no test-only package export, duplicate denominator builder or caller-supplied row set is introduced. | User's standing direction delegates technical plan choices to the expert recommendation; the exact factory is added to `03-05` and task 2.2.1. | ✅ Resolved |
| AR-16 | Runtime published payload authority | Which immutable publication member owns the ST-37 source, independent expectation and unchanged execution-envelope bytes, and which first-vertical rule owns the combined exemplar? | **Recommended:** add one authenticated parent member, `structured-execution-exemplar-v2.json`, produced only from the combined case authority. It binds the combined case to its existing registry-declared primary inclusive-loop rule and stores canonical base64 payloads plus digests. The consumer reads those published bytes through a genuine composite pair; it never reconstructs them from the current registry, changes child v1 or treats cost data as authority. | User's standing direction delegates technical plan choices to the expert recommendation; `03-05` and tasks 2.2.1/2.2.4 now name the exact member and factory. | ✅ Resolved |
| AR-17 | Runtime execution ordering | Can the AR-13 prerequisite return to Phase 1 after task 2.2.4 when immutable task-2.1.1 specs for the intentionally later child recovery and consumer tasks remain RED in mandatory `yarn test`? | **Recommended after independent challenge:** no—execute tasks 2.2.1–2.2.7 as one coherent Phase-2 compatibility unit, then return to Phase 1. Quarantining/skipping already-authored specs or accepting a red checkpoint violates specification-first and green-checkpoint rules. | User's standing direction delegates technical plan choices to the expert recommendation; AR-17 supersedes only AR-13's partial-Phase-2 sequencing clause. | ✅ Resolved |
| AR-18 | Runtime migrated inventory semantics | The v2 parent publishes nine exact handler rows, but its authenticated predecessor inventory has only eight declarations, marks four unbound and omits `transform.semantic-relations`. What bytes may the same-named member carry in the new v2 release? | **Recommended after independent challenge:** derive one canonical schema-v1 successor inventory from the authenticated predecessor and the closed nine-handler catalog. Verify retained metadata, add only the missing catalog declaration, mark all nine bound, render once and require the model, member and manifest digests to agree. Preserve every predecessor byte/digest; do not weaken binding validation or reinterpret the old release. | User's standing direction delegates technical plan choices to the independently hardened expert recommendation. | ✅ Resolved |
| AR-19 | Runtime specification conflict | The 2026-07 legacy `oracle-publication.spec.test.ts` requires executable resolution of obsolete v1 digest `sha256:41af…3403`, while immutable Phase-2 `rule-family-migration.spec.test.ts` and `03-05` require the same API/digest to fail exact-revision replay with `publication.implementation-unavailable`. Which contract owns the superseding behavior and how should the old coverage migrate without weakening specification-test integrity? | **Recommended after independent challenge:** split historical and executable-base fixtures. Keep `createOraclePublicationSpecFixture` bound to the exact historical digest for passive/stale tests. Add `createCurrentOraclePublicationSpecFixture`, which establishes an ephemeral reviewed four-handler v1 base using current exact revisions, and let an implementation-blind spec owner switch only legacy tests that require a callable base. Preserve their staging, hostile-input and byte assertions. | User's standing direction delegates technical plan choices to the independently hardened recommendation; obsolete implementation restoration, current substitution, special-casing and test retirement are rejected. | ✅ Resolved |
| AR-20 | Runtime specification fixture assertion | After the AR-19 fixture split, `oracle-published-evidence.spec.test.ts` still requires the executable-current base's carried generator and boundary rows to equal obsolete historical revision constants. How is byte-identical carry-forward preserved without contradicting current exact authority? | **Recommended:** the spec owner replaces only those two fixed-value assertions with equality against the corresponding rows resolved from the same current four-handler base. This preserves the durable carried-row invariant; fixed historical values remain confined to historical/stale tests or hostile caller-input data. | User's standing direction delegates this direct AR-19 consequence to the expert recommendation; implementation remains paused until the spec owner records expected RED/GREEN evidence. | ✅ Resolved |
| AR-21 | Runtime historical parent/child specification | `execution-publication.spec.test.ts` requires the obsolete historical v1 parent to resolve through the executable parent resolver and then form a composite with its child, contradicting the exact stale behavior while its current-v2 branch remains valid. How is dual-shape history preserved? | **Recommended:** the spec owner resolves the historical parent through the passive v2 record API, resolves its child independently and asserts the executable parent resolver's exact stale diagnostic; only the current v2 parent forms an executable composite. Preserve byte-for-byte snapshots of both parent shapes and both child releases. | User's standing direction delegates this direct passive/executable consequence to the expert recommendation; current substitution and weakening exact replay remain prohibited. | ✅ Resolved |
| AR-22 | Runtime historical execution-pair identity | The AR-21 correction still tries to prepare a new child against migration-source parent `sha256:41af…3403`, but child preparation correctly rejects obsolete executable authority. Which historical child can be resolved independently? | **Recommended:** use the existing checked-in historical execution pair: parent `sha256:e5796e…d3e5` and child `sha256:2afaa8…d228`. Export those identities from the execution-publication fixture, passively authenticate the parent, independently resolve the child and assert the parent's executable-stale result. Do not mint a child against either obsolete parent. | User's standing direction delegates this direct AR-21 correction to the expert recommendation; the migration-source `41af…3403` remains separately covered as passive/stale. | ✅ Resolved |
| AR-23 | Runtime isolated historical-child fixture | `createIsolatedRepository` intentionally excludes all execution publications, so the AR-22 test cannot resolve the exact historical child inside its isolated root. How is that one immutable release supplied without polluting every execution-publication test? | **Recommended:** add test-fixture helper `installHistoricalExecutionRelease(repositoryRoot)` that copies and validates only child `sha256:2afaa8…d228` into the isolated repository without selecting it. The AR-22 spec calls it explicitly; the general isolated-repository factory remains empty and all other test initial-state assumptions remain unchanged. | User's standing direction delegates this fixture-isolation consequence to the expert recommendation; global copying and synthetic child reconstruction are rejected. | ✅ Resolved |
| AR-24 | Runtime passive child-history authority | After exact AR-23 installation, `resolvePublishedExecutionRelease` rejects historical child `sha256:2afaa8…d228` because its parent is executable-stale. Which API authenticates historical child bytes and parent identity without granting composite execution authority? | **Recommended after independent challenge:** add opaque `PublishedExecutionReleaseRecordV1` resolution/projection backed by one shared child-byte validator, while leaving `resolvePublishedExecutionRelease` executable-compatible and source-compatible. The passive record authenticates only child manifest/member bytes and stored parent identity; it never reads the parent and cannot form a composite. | User's standing direction delegates technical plan choices to the independently hardened recommendation; redefining the existing resolver, weakening named history and restoring obsolete implementations are rejected. | ✅ Resolved |
| AR-25 | Runtime projection member type | The AR-24 projection must expose the manifest plus its three described members, but its declared `path` type admitted only `EXECUTION_PUBLICATION_MEMBER_FILENAMES`, which deliberately excludes the manifest. Which closed type represents the required four-file projection without an unsafe cast or changing manifest semantics? | **Recommended:** use the exact union `typeof EXECUTION_MANIFEST_V1_FILENAME \| (typeof EXECUTION_PUBLICATION_MEMBER_FILENAMES)[number]`. This admits precisely the four already-required lexical paths, preserves the manifest's existing three-member meaning and requires no runtime change. | User's standing direction delegates this direct representability correction to the expert recommendation; omitting the manifest, widening to `string`, changing the existing member constant and using an unsafe cast are rejected. | ✅ Resolved |
| AR-26 | Runtime cross-package executable fixture | The readiness-execution catalog fixture still stages callable children from obsolete parent `sha256:41af…3403`, reproducing the AR-19 stale-base contradiction outside readiness's original spec-fixture sweep. Which parent should executable catalog and campaign tests use? | **Recommended:** have `createHistoricalExecutionParentFixtureV1` use its existing current-authority repository path and resolve the copied selected current v2 parent directly (currently `sha256:95196a…dfdf6`). Child v1 already accepts any authenticated parent digest without interpreting its wire version, so no synthetic v1 parent or cross-package test-helper export is needed. Keep the separate historical-authority fixture unchanged for passive/safety coverage. | User's standing direction delegates this direct AR-19 consequence to the expert recommendation; restoring obsolete callables, importing a readiness-private fixture, duplicating unbound-authority restoration and creating an unnecessary synthetic v1 parent are rejected. | ✅ Resolved |
| AR-27 | Runtime static loop-work semantics | Review proved nested loops and calls are undercounted, while validation receives a module and budget but no entry function. What exact bounded cost is authoritative? | **Recommended after independent challenge:** compute a saturating call-expanded DAG recurrence per possible function root and take the maximum. Count every executed loop iteration: a `for` with domain `N` costs `N + N × bodyWork`; sequential work sums, branches take the greater arm, and callee loop work expands at each call site. Saturate every operation at `limit + 1`. Only statically false `while` and false-guard `do-while` receive finite zero/one-trip costs; other unproved dynamic loops reject as over-bound. | User's standing direction delegates technical plan choices to the independently hardened recommendation; summing mutually exclusive roots and ignoring call expansion are rejected. | ✅ Resolved |
| AR-28 | Runtime structured-case identity | Review proved validity and placement can mutate while `caseDigest` remains unchanged. Which durable identity binds the complete case authority? | **Recommended after independent challenge:** retain the public `caseDigest` field but derive it from canonical length-prefixed fields under `blend65.readiness.structured-case-authority.v1`, binding the exact structured IR, rendered bytes, validity, rule claims, bindings, entry, memory, placement, budgets, expectation authority, relation path and validated replay provenance. Deep-snapshot/freeze the same values before registry insertion. | User's standing direction delegates technical plan choices to the independently hardened recommendation; source-only digests and process-local auxiliary capabilities are rejected because they do not give durable cross-process authority. | ✅ Resolved |
| AR-29 | Runtime structured diagnostic vocabulary | Full semantic closure needs stable name/scope/operator/initializer/assignment/memory/return/counter reasons, but the existing union has only call-specific type mismatch. Which vocabulary is exact? | **Recommended after independent challenge:** keep `generation-type-invalid` and add focused reasons `name-unresolved`, `name-conflict`, `expression-type-mismatch`, `initializer-type-mismatch`, `assignment-type-mismatch`, `memory-operand-type-mismatch`, `return-type-mismatch` and `loop-counter-read-only`, with precise first-offending paths. Retain existing array/call/condition reasons where they are more specific. | User's standing direction delegates technical plan choices to the independently hardened recommendation; misusing call-argument mismatch and one generic semantic bucket are rejected. | ✅ Resolved |
| AR-30 | Runtime authenticated identity transitions | The migration contract says revisions come only from authenticated source/current authorities but also blanket-rejects no-op rows. After a current v2 parent is selected, a legitimate successor deterministically has equal source/current revisions. Are authority-derived identity transitions valid? | **Recommended after independent challenge:** yes. Treat the document as a deterministic revision-transition manifest. Each of the nine ordered rows must exactly match the authenticated source revision and independently package-derived current revision. Equality is valid only when those authorities genuinely agree; caller-substituted identity rows reject whenever either authority differs. | User's standing direction delegates technical plan choices to the independently hardened recommendation; global equality rejection makes deterministic current-parent successors impossible, while a second refresh schema adds unnecessary divergent replay machinery. | ✅ Resolved |
| AR-31 | Runtime dynamic-loop work | Dynamic `for` bounds are legal, but treating their static domain as zero bypasses the generation budget. What conservative work is authoritative without making validation depend on one entry binding? | **Recommended after independent challenge:** give each compile-time bound interval `[v,v]` and each dynamic bound its full scalar-type interval. For positive step `s`, use `ceil(max(0,endMax-startMin)/s)` for `until`, `floor((endMax-startMin)/s)+1` for non-empty `to`, and `floor((startMax-endMin)/s)+1` for non-empty `downto`. Charge bound-call work once and `N × (1 + bodyWork)` with limit-plus-one saturation. Runtime charges one evaluation step before every iteration. | User's standing direction delegates technical plan choices to the independently hardened recommendation; zero work is unsound, rejecting all dynamic bounds contradicts the language, and binding-aware structural validation weakens reproducibility. | ✅ Resolved |
| AR-32 | Runtime module constants | Valid functions can reference module constants, but the evaluator has no constant environment and the validator has no dependency/cycle/value closure. What exact policy applies? | **Recommended after independent challenge:** evaluate the existing literal/name/unary/binary constant-expression subset once before any function frame using a memoized dependency graph. Forward references are valid; declaration order breaks independent ties; the first deterministic back-edge rejects. Add `constant-expression-not-constant`/E10193, `constant-dependency-cycle`/E10194, `constant-value-out-of-range`/E10084 and `constant-zero-divisor` without a compiler-code claim. Normalize immutable declared-type values into a read-only global environment inherited by every call. Charge one evaluation step per declaration and expression node, with no frame/memory/effect charge. | User's standing direction delegates technical plan choices to the independently hardened recommendation; declaration-only evaluation breaks forward references and runtime mutable constants violate frozen compile-time semantics. | ✅ Resolved |
| AR-33 | Runtime zero-divisor semantics | Frozen runtime semantics define `/ 0` and `% 0`, while constant zero division is invalid and its compiler diagnostic code is contradictory. Should structured v2 block all zero divisors or model the defined runtime? | **Recommended after independent challenge:** structured validation rejects a divisor that is a compile-time constant expression evaluating to zero with `constant-zero-divisor` and no compiler-code claim. A dynamic runtime `/ 0` returns the result type maximum and `% 0` returns typed zero; nonzero division truncates toward zero. Keep legacy RD-03 oracle behavior unchanged under its own domain. | User's standing direction delegates technical plan choices to the independently hardened recommendation; propagating legacy errata into the new domain would contradict explicit frozen runtime semantics, while inventing a diagnostic code is prohibited. | ✅ Resolved |
| AR-34 | Runtime OOB/index-tier evidence | The two published runtime-OOB cases use a foldable `16 + 16` index and the word-scaling test turns a Tier-1 array index into an illegal `word`. Which case shapes prove runtime behavior and scaling honestly? | **Recommended after independent challenge:** use authenticated entry-parameter bindings for runtime indices. Enforce `byte` index for known total size at most 256 bytes and `word` above 256, with either unsigned width for unsized parameters. A mismatch uses reason `array-index-tier-mismatch` at the exact `/index` path; Tier 1 uses family `array-index-byte-required`/E10117 and Tier 2 uses `array-index-word-required`/E10118. The public/wrap case uses `byte[4]`, `i: byte = $20`, placement `$FFF0` and address `$0010`. The unscaled mutation uses `word[129]`, `i: word = $0081`, placement `$FFF0`; correct scaled/wrapped address `$00F2` contains `$1234`, while unscaled/wrapped `$0071` contains `$ABCD`. Add a valid `main(): void` to the public-route module. | User's standing direction delegates technical plan choices to the independently hardened recommendation; foldable or literal-backed locals remain compile-time evidence, and accepting `word` for a small Tier-1 array contradicts the frozen tier contract. | ✅ Resolved |

## Resolution Notes

The user explicitly accepted AR-1–AR-8 as one recommendation package on 2026-09-02 and accepted
the recommended AR-9 closure on the same date.

**AR-1–AR-3:** The recommendation carries the user's explicit minimum-sufficient constraint and the
preflight-corrected first-publication contract into a plan-local execution boundary.

**AR-4:** Grounded in `packages/readiness/src/generator-ir-validator.ts` (952 lines),
`modeled-generators.ts` (735 lines) and `oracle-evaluator.ts` (654 lines). Focused companion modules
are the only viable minimum-sufficient direction under the repository's file-size standard; a new
generalized framework and further monolith growth were rejected.

**AR-5–AR-6:** These preserve RD-08's staged RD-05/RD-07 dependencies without resuming either
deferred plan.

**AR-7:** Detected verbatim from the user-supplied project instructions and root command graph.

**AR-9:** The exact specification-facing request/result, validation, rendering, relation, mutation
and boundary contracts were added to `03-01`; `07-testing-strategy` names their file ownership and
test authority. Independent challenge then closed six internal consistency gaps: callable reverse
boundary scanning, normalized unroll-domain proof, structured-budget carriage, complete budget and
shape diagnostics, and force-applicable volatile mutation. Every v1 request, result, digest and
canonical byte remains unchanged.

**AR-10:** Two independent spec-author dispatches confirmed that opaque relation, execution and
publication authorities were not constructible from the original packet. The additive resolvers
and passive validator now make those requirements executable without exposing a caller-controlled
expectation, adding a runner or selecting a publication in Phase 1.

**AR-11:** Prettier expanded the independent evaluator implementation to 883 lines. The private
runtime companion changes no public import, authority or result shape; it only keeps the semantic
interpreter below the repository's file-size ceiling while `structured-oracle-evaluator.ts` remains
the declared public owner.

**AR-12:** The existing route adapter authenticated its oracle independently from the execution
case by probing the publication-only request façade. Independent challenge identified a stronger
minimum seam: the execution case already owns private WeakMap authority, so its structured token is
accepted only as the exact retained pair. The token remains invalid at `createPublishedOracleRequest`
and therefore cannot impersonate selected publication authority. The existing execution-runtime
subpath is the narrow cross-package owner; route entry and handler shapes remain unchanged.

**AR-13:** The first recommendation—passive v1 resolution plus exact replay invalidation—was
challenged again after inspecting the 17 affected tests. Their fixtures need an executable base,
and Phase 1 changed the dependency closures of all four modeled and five oracle handlers. The
smallest honest executable base is therefore a reviewed v2 parent with all nine current revisions.
Tasks 2.1.1–2.2.4 move ahead only as a prerequisite slice; execution-child and consumer work remain
in their original Phase-2 order. Phase 1 and this parent slice share the next green checkpoint.

**AR-14:** Both implementation-blind spec authors stopped before inventing Phase-2 signatures.
Three read-only maps grounded the existing parent transaction, child transaction/pointers,
publication fault hooks, structured cases and compiler/readiness boundary. Independent challenge
then confirmed an additive v2 parent with the existing child v1 is the minimum contract: the child
already binds an opaque parent digest, so a second child schema would add migration without a new
invariant. `03-05` records the complete test-facing types, entries, wire members and diagnostics.

**AR-15:** The execution-package spec cannot import readiness's private test fixtures through the
package's production-only exports, and separately assembling 2,112 rows would duplicate the very
oracle being tested. The authenticated factory is smaller and stronger: it owns the projection in
production, accepts only opaque authorities and leaves each package to compose its ordinary public
publication setup locally.

**AR-16:** The original parent member set authenticated identities but contained no owner for the
consumer's promised source, expectation and envelope bytes. Re-deriving them from today's registry
would lose historical provenance, while adding them to child v1 would violate its frozen format.
One parent exemplar member is therefore the minimum honest authority and is reviewed atomically
with the rest of the v2 parent.

**AR-17:** Once task 2.1.1 activated immutable ST-26 and ST-37 specifications, AR-13's plan to stop
after parent task 2.2.4 could no longer reach a green checkpoint. Independent challenge found no
viable alternative: skipping those tests would corrupt the specification-first gate and accepting
RED would violate mandatory verification. The Phase-2 compatibility unit therefore runs through
2.2.7 before returning to Phase 1; later phases retain their order.

**AR-18:** The selected authenticated predecessor contains eight declarations rather than the
current catalog's exact nine: four are unbound and `transform.semantic-relations` is absent.
Independent challenge confirmed that the existing publication pattern already creates a new
content-addressed schema-v1 inventory without rewriting its predecessor. One shared deterministic
projection therefore joins the predecessor to the closed handler catalog, verifies all retained
metadata, adds only that missing declaration, marks all nine bound and canonically renders the
successor once. The registry's `inventoryDigest`, member bytes and v2 manifest member digest must
agree before unchanged strict binding validation runs. The schema and filename remain v1 because
their wire shape is unchanged; historical release bytes, digest and meaning remain immutable.

**AR-19:** The newer approved RD-08 exact-revision contract supersedes the old test setup's
assumption that the July v1 release remains executable forever; RD-03 records a successful
publication, not perpetual installation of obsolete implementation revisions. Independent
challenge rejected the initial passive-base proposal because the still-supported v1 staging
transaction legitimately requires an opaque executable snapshot. Historical and executable test
authority are therefore split: `createOraclePublicationSpecFixture` continues to reproduce exact
digest `sha256:41af…3403` for passive authentication and stale-execution coverage, while
`createCurrentOraclePublicationSpecFixture` builds an isolated reviewed four-handler schema-v1
base using current exact revisions. An implementation-blind spec owner changes only fixture calls
for tests exercising callable v1 staging; their behavioral assertions remain unchanged. No
checked-in historical release, resolver invariant or obsolete implementation is changed.

**AR-20:** The split fixture made two fixed historical revision assertions self-contradictory: an
executable-current base must carry current exact revisions. The meaningful behavior was always
byte-identical carry-forward, not perpetual equality to a July implementation hash. The spec owner
therefore compares the staged generator and boundary rows to the corresponding rows obtained from
that same authenticated current base. All request-identity, hostile-input and evidence assertions
remain unchanged; historical constants remain valid only in historical/stale coverage or as
rejected caller-controlled data.

**AR-21:** Parent wire compatibility does not imply perpetual executable availability. The legacy
execution-publication test may still prepare and resolve a child that names the exact historical
parent digest, and it must prove neither release is rewritten. The historical parent itself now
resolves through `resolvePublishedRuleFamilyRecordByDigestV2`; its executable resolver returns the
required `publication.implementation-unavailable` diagnostic, so no composite authority is formed.
The current v2 parent and its child continue through the existing executable composite assertions.
This preserves both parent shapes and child history without substituting current implementations.

**AR-22:** The migration-source parent `sha256:41af…3403` predates any checked-in execution child,
and the transaction correctly refuses to create a new child from its obsolete executable
authority. Historical parent-child preservation is instead proven with the existing immutable
pair: v1 parent `sha256:e5796e…d3e5` and child-v1 `sha256:2afaa8…d228`. The parent resolves
passively and executable-stale; the child resolves independently and both release trees remain
byte-identical. The current v2 parent/child branch alone forms a new executable composite.

**AR-23:** Execution-publication tests deliberately start with no copied execution releases, so
globally adding historical data to `createIsolatedRepository` would change every test's initial
state. One explicit `installHistoricalExecutionRelease(repositoryRoot)` fixture helper copies only
the exact checked-in child `sha256:2afaa8…d228`, validates that it names parent
`sha256:e5796e…d3e5`, and does not select it. The AR-22 history case calls this helper before taking
its byte snapshot. No release is synthesized, no pointer changes and unrelated tests retain their
empty execution-publication root.

**AR-24:** Despite earlier documentation calling it passive, `resolvePublishedExecutionRelease`
performs executable parent resolution, declaration joins and freshness retention; selection,
catalog and composite callers rely on those fail-closed semantics. Independent challenge therefore
keeps it unchanged and adds `resolvePublishedExecutionReleaseRecordByDigestV1` plus a defensive
projection for child-only history. One shared internal validator authenticates the canonical child
manifest, exact members, byte lengths/digests, bindings, review and stored parent identity. Passive
resolution never reads parent bytes, pointers or freshness and its opaque record cannot enter
composite resolution. Executable resolution consumes the same authenticated record, then performs
all existing parent/spec/declaration/freshness checks before minting live authority.

**AR-25:** The execution manifest authenticates descriptors for three payload members but is also
itself one of the four exact files retained by the passive projection. The projection path type is
therefore the closed union of `EXECUTION_MANIFEST_V1_FILENAME` and the existing three-value
`EXECUTION_PUBLICATION_MEMBER_FILENAMES` tuple. Widening to `string` would weaken exhaustiveness;
adding the manifest to the existing tuple would change manifest validation and digest semantics.

**AR-26:** The cross-package execution catalog needs executable parent authority, not a particular
parent wire version. Its existing current-authority fixture already copies the selected v2 release
whose exact installed revisions resolve today, and child v1 treats the parent as an authenticated
digest. The catalog fixture therefore resolves that selected parent directly. The separately named
historical-authority fixture and its overlays remain unchanged for passive and safety tests.

**AR-27:** A module-wide loop bound must be safe for every callable root without charging mutually
exclusive roots together. The independently challenged recurrence expands callee work at every
call site, multiplies nested work by the enclosing static trip count, and saturates at the first
over-bound value. This closes the review's nested-loop and call-multiplicity holes while preserving
deterministic bounded validation.

**AR-28:** The registry authority must survive process boundaries and reject semantic mutation.
The retained `caseDigest` name now identifies the complete canonical structured-case authority,
including all execution, expectation, budget and replay fields. Deep snapshotting and freezing the
same identity inputs prevents a previously authenticated case from changing through retained
references.

**AR-29:** One generic type failure cannot identify the first semantic defect precisely enough for
stable tests or diagnostics, while reusing call-argument mismatch would be false. Eight focused
reasons cover name/scope, expression, initializer, assignment, memory operand, return and loop
counter failures; existing more-specific array, call and condition reasons keep precedence.

**AR-30:** The migration rows authenticate a transition between two independent revision
authorities; they do not promise that every implementation changed. Global equality rejection
contradicted deterministic successor publication once the selected source already carried current
revisions. Exact row comparison remains the security boundary: an identity transition is accepted
only where authenticated source and package-derived current revisions agree. The historical
fixture still changes all nine rows, and its forged all-identity mutation still rejects.

**AR-31–AR-34:** Independent re-review found four places where the first correction set was
internally consistent but not yet faithful to frozen language behavior. Dynamic loop work now uses
a type-safe worst-case interval; module constants are dependency-evaluated once; structured-v2
zero division distinguishes compile-time rejection from defined runtime results; and runtime OOB
evidence uses authenticated parameters with the hardware tier chosen from total byte size. These
decisions require implementation-blind specification corrections before production changes.

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature gaps | Covered by upstream AR-11–AR-34 and plan AR-1–AR-3. |
| Behavioral gaps | Resolved by AR-2; later outcomes follow the RD's pass/fail/block evidence contract. |
| Scope ambiguities | Resolved by AR-1 and AR-6; strict scope prohibits optional additions. |
| Technical unknowns | Resolved by AR-4 and AR-9–AR-34: focused modules, exact executable contracts, authenticated fixture/route authority, one private evaluator runtime split, case-bound structured route authentication, honest historical/current publication separation, a closed Phase-2 API/wire contract, one authenticated initial-registry constructor, one immutable owner for consumer payload bytes, one green compatibility-unit sequence, one authenticated all-nine-bound successor-inventory projection, separate historical-versus-current executable fixtures, base-relative carry-forward assertions, exact existing-pair passive historical parent/child records, explicit isolated installation of that immutable child, an exact four-path passive projection type, current selected parent authority for cross-package executable catalog tests, call-expanded saturated loop work, complete immutable structured-case identity, focused semantic diagnostics, authority-derived identity transitions, conservative dynamic-loop bounds, constant dependency evaluation, defined structured zero-divisor behavior and parameter-shaped runtime OOB/tier evidence. |
| Edge cases | Exact/over-bound, invalid-neighbor, zero/one/multiple iteration and array-bound distinctions are included in AR-2. |
| Integration points | Resolved by AR-5 and AR-8; existing public compiler and publication seams remain authoritative. |
| Data & state | Resolved by AR-3 and AR-5; historical v1 bytes remain immutable. |
| Security & compliance | Upstream closed-input, canonical-path, subprocess and resource limits remain authoritative; no auth, credentials or PII are involved. |
| Non-functional gaps | Resolved by AR-7: bounded smoke and explicit exhaustive tiers remain separate. |
| UX & presentation | No user-facing UI; existing CLI/result vocabulary remains unchanged. |
| Stakeholder conflicts | Upstream AR-17–AR-34 retain compiler, conformance, parity and optimizer ownership boundaries. |
| Naming & terminology | Resolved by AR-8. |
