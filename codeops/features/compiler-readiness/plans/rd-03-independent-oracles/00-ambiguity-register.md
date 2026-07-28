# Ambiguity Register: RD-03 Independent Semantic, Diagnostic and Metamorphic Oracles

> **Status**: ✅ GATE PASSED — all 43 items resolved
> **Last Updated**: 2026-07-27
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd03-20260727-01`
> **Policy version**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which requirement and plan boundary does this plan implement? | Implement only `compiler-readiness/RD-03` over the exact nine RD-02 modeled scalar/memory rules. Arrays, nested calls, branches, loops, loop unrolling and the remaining inventory population stay owned by RD-08. | User-authorized RD-03 preflight PF-001 | ✅ Resolved |
| AR-P2 | Scope | May RD-03 change the frozen language specification or decide contradictory division-by-zero behavior? | No. `spec/` remains byte-untouched. Both identified division-by-zero conflicts remain `blocked-errata` and `oracle-unmodeled`; the plan neither chooses a result nor a diagnostic. | User-authorized RD-03 preflight PF-012; project D3 | ✅ Resolved |
| AR-P3 | Architecture | What is the executable oracle surface? | Add one closed oracle protocol shared by the four declared façades and one closed `transform.semantic-relations` handler. The four façades route only their declared observable contracts; one transform implementation owns the five relation IDs. | AI delegated by `--auto-design`; RD-03 preflight PF-002 | ✅ Resolved |
| AR-P4 | Data & state | Where does diagnostic truth live without upgrading inventory schema v1? | Add canonical closed diagnostic-manifest JSON plus independently authored digest-bound review JSON. Join compiler-invalid source projections exhaustively to the nine-rule modeled registry. Keep external parameter-binding rejection in a separate closed authority. Executable code consumes validated authority and never derives expected results from compiler output. | AI delegated by `--auto-design`; RD-03 preflight PF-003/PF-006 | ✅ Resolved |
| AR-P5 | Behavioral | What does the reference evaluator execute? | Execute one named function entry over an immutable structurally valid and oracle-semantically-closed generator IR: constants in dependency order, exact parameter bindings, locals, assignments, ordered volatile reads/writes, return, unary operations and binary operations. Unsupported semantics and absent routes are unmodeled; malformed requests and inconsistent authority fail closed. | AI delegated by `--auto-design`; RD-03 plan preflight PF-004/PF-008 | ✅ Resolved |
| AR-P6 | Semantics | How are scalar values represented and normalized? | Represent integers with `bigint`; for same-signed mixed-width arithmetic, bitwise and comparison operands, widen both to the declared wider type before dispatch, in either operand order, then normalize arithmetic/bitwise results to that type. Preserve booleans as a distinct variant and implement signed comparison/right-shift through declared types. Reject narrowing IR. Evaluate binary operands left-to-right. | AI delegated by `--auto-design`; grounded in frozen type/operator rules and plan preflight PF-007 | ✅ Resolved |
| AR-P7 | Semantics | How are division and remainder handled? | Reject divisor zero as `oracle-unmodeled` for both constant-shaped and runtime-shaped expressions because frozen authorities conflict. For non-zero operands, use truncation toward zero and type-width normalization. Mutation and boundary vectors include signed extrema without executing the blocked case. | AI delegated by `--auto-design`; user-authorized blocked-errata ruling | ✅ Resolved |
| AR-P8 | Memory | What is the exact memory-state contract? | Require an explicit versioned fixture of initialized byte cells. Reads of absent cells and any complete access outside `$0000..$ffff`, including word access at `$ffff`, return `oracle-unmodeled`. Word access is little-endian; writes update cells in low/high order and append ordered effects; later overlapping operations observe prior writes. | AI delegated by `--auto-design`; RD-03 requirement contract | ✅ Resolved |
| AR-P9 | Input safety | How do public entries handle hostile or oversized input? | Every public oracle/transform entry accepts `unknown`, snapshots and validates own data through bounded independent-IR parsing, rejects accessors, cycles, exotic prototypes, unknown fields/IDs and non-canonical values, and evaluates only the immutable validated snapshot. Transformed output is independently revalidated before use. | AI delegated by `--auto-design`; RD-03 security contract | ✅ Resolved |
| AR-P10 | Resources | Which oracle limits and consumption rules are fixed? | Add a closed positive-integer `OracleBudgetV1` covering input nodes, expression depth, evaluation steps, entry frames, initialized memory cells, recorded effects and transformed-output nodes. Validation is preflighted; one event is charged before each constant/statement/expression/memory effect/transform-node action. Exactly-at-limit succeeds; the next charge returns `oracle-budget` without partial success. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P11 | Metamorphic behavior | Which relation IDs exist in v1? | The closed union is `relation.identifier-renaming`, `relation.literal-to-local`, `relation.local-to-parameter`, `relation.algebraic-identity` and `relation.independent-declaration-reordering`. Unknown IDs reject; a false precondition returns `relation-inapplicable`, never pass. | AI delegated by `--auto-design`; RD-03 approved scope | ✅ Resolved |
| AR-P12 | Metamorphic soundness | What makes each rewrite semantics-preserving? | Identifier renaming is capture-avoiding and rewrites one complete declaration/reference binding set; literal-to-local inserts one typed immutable local before first use; local-to-parameter replaces one immutable entry local and adds the exact external binding; algebraic identity applies only type-correct identities and retains operand evaluation; declaration reordering follows an explicit dependency graph and moves only independent immutable declarations. | AI delegated by `--auto-design`; relation-specific preconditions required by PF-004 | ✅ Resolved |
| AR-P13 | Comparison | How are source and transformed observations compared? | Each relation owns a closed observable projection and comparator. Value/state relations compare typed return, ordered effects and the complete final initialized-memory projection. Diagnostic relations compare manifest-owned code, phase and normalized observable fields while excluding source-name/span fields changed by the relation. No global equality fallback exists. | AI delegated by `--auto-design`; RD-03 preflight PF-004 | ✅ Resolved |
| AR-P14 | Identity | How is oracle evidence identified without changing RD-02 case identity? | Verify complete RD-02 replay provenance. Add role-separated source/transformed content digests and an evaluation identity binding provenance, content, relation, entry function, initial-memory digest, authority, budget, policy, projection and every selected participant revision. RD-02 identities remain unchanged. | AI delegated by `--auto-design`; RD-03 preflight PF-007; plan preflight PF-002/PF-003; Iteration 2 identity correction | ✅ Resolved |
| AR-P15 | Publication | How can the diagnostic authority and five RD-03 handlers be selected atomically without an illicit publication-v1 format mutation before RD-07? | Preserve the exact seven-member `PublicationManifestV1` and legacy four-handler preparation wrapper. Add an explicit incremental preparation API naming the selected base snapshot and exact target handler set. Include diagnostic authority in relevant dependency closures, exclude accepted review bytes, revalidate reconstructed review units during every resolution, and publish four byte-identical carried rows plus five promotions. | AI delegated by `--auto-design`; independent challenger corrected incremental promotion and review circularity; plan preflight PF-009/PF-010 | ✅ Resolved |
| AR-P16 | Binding compatibility | How are five new handlers declared and resolved? | Add the missing transform declaration to inventory v1 using existing schema fields; retain the four existing oracle declarations; register content-derived fresh candidates with exact kind/contract compatibility; extend the package-owned fixed publication profile; and expose lookup only through a digest-verified opaque selected snapshot. Reject missing, duplicate, undeclared, stale and incompatible entries. | AI delegated by `--auto-design`; RD-03 preflight PF-002/PF-006 | ✅ Resolved |
| AR-P17 | Mutation adequacy | What constitutes exhaustive mutation evidence? | Add closed versioned operation and path registries plus an exact exhaustive join over every required `(operationId, pathId)` pair. Conformance seams dispatch production paths through the selected variant; source checks reject missing, extra, duplicate or unreachable paths, and the specification suite kills every required mutant. Each vector runs in a bounded worker thread so timeout/crash/protocol failures are harness failures rather than kills. | AI delegated by `--auto-design`; RD-03 preflight PF-005; plan preflight PF-005/PF-014 | ✅ Resolved |
| AR-P18 | Diagnostics | What are the stable result categories? | Public calls return closed discriminated success, `oracle-unmodeled`, `relation-inapplicable` or failure results. Failures use stable families for invalid/over-limit input, authority missing/stale/not-accepted, route/contract mismatch, budget exhaustion, identity collision and relation violation, each with an RFC 6901 path and bounded message. Expected compiler diagnostics remain manifest data rather than oracle-engine failures. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P19 | Module boundaries | How is independence mechanically enforced? | Production oracle/transform modules may import only Node standard library and public or relative modules contained by `packages/readiness`; a TypeScript-AST module-graph test rejects every `@blend65/*` import, any relative resolution escaping the package, and non-literal dynamic imports. Compiler packages are test subjects only in later tier adapters, not semantic authority. | AI delegated by `--auto-design`; RD-03 AC-1 | ✅ Resolved |
| AR-P20 | Testing | Which test tiers and coverage rules apply? | Author immutable `*.spec.test.ts` suites first and observe targeted RED before implementation; add `*.impl.test.ts` suites only for internals. Include an implementation-blind package-boundary suite before evaluator work, a relation-scoped fault seam before relation GREEN, concurrent mutation-context isolation, worker-thread mutation containment, and separate final-publication specs that never reopen the staging spec. Retain at least 90% branch coverage. | AI delegated by `--auto-design`; repository standards; plan preflight PF-012–PF-017 | ✅ Resolved |
| AR-P21 | Ordering | What implementation order prevents circular or prematurely authoritative evidence? | Contracts and boundary specs → evaluator semantics and semantic-closure validation → relation-scoped fault seam and relations → pure provenance/content/evaluation identity primitives plus exhaustive worker-contained mutation → declaration/candidate staging → final-publication specs → independent review → snapshot-bound evaluation API and atomic publication. No RD-03 capability is authoritative before exact review and selection. | AI delegated by `--auto-design`; plan preflight PF-003/PF-015/PF-016/PF-017 | ✅ Resolved |
| AR-P22 | Verification | What command gates each checkpoint and final completion? | Run `yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test`; additionally run targeted readiness tests, `npx prettier --check` on touched files, JSON parsing/schema checks for authority files, the repository's frozen-`spec/` cleanliness check, CodeOps traceability validation/readiness and selected-publication resolution. Never commit a red checkpoint and never push. | User-supplied repository policy; `--auto-commit` | ✅ Resolved |
| AR-P23 | Integration | Does RD-03 add runtime dependencies or external services? | No new package dependency, subprocess, network, credential, database, authentication or deployment surface is introduced. Use existing Node crypto/filesystem primitives and Vitest infrastructure only. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P24 | Closeout | What downstream ownership must be checked before RD-03 closes? | Re-scan the requirement ambiguity register, RD Won't Have sections and `spec/future-considerations.md` for deferral-rationale expiry. Preserve RD-08 ownership of broader IR/oracle expansion, record every user-hittable restriction in the expressiveness ledger when applicable, update feature/portfolio roadmaps under branch policy and leave `spec/` unchanged. | Project deferral-expiry directive | ✅ Resolved |
| AR-P25 | Published invocation | How does a selected handler receive accepted authority without caller substitution? | The resolver creates an opaque snapshot-bound `PublishedOracleContext`. Authoritative evaluation accepts only that context and a request; it supplies the exact reviewed suite and selected participant metadata internally. Raw suites remain source-authoring/test capabilities. | AI delegated by `--auto-design`; plan preflight PF-001; user authorized | ✅ Resolved |
| AR-P26 | Provenance | How is a caller-supplied source case proven to be the RD-02 case named by its identity? | Carry full campaign/configuration/generation-path/ordinal replay provenance, regenerate deterministically, compare the immutable case and external bindings, and reject any mismatch before evaluation. A digest plus case content alone is insufficient. | AI delegated by `--auto-design`; plan preflight PF-002; user authorized | ✅ Resolved |
| AR-P27 | Content identity | How are transformed cases identified when they have no RD-02 campaign coordinates? | Define separate domain-separated canonical content digests for the verified source case and revalidated transformed case. A transformed case never receives synthetic RD-02 coordinates. | AI delegated by `--auto-design`; plan preflight PF-002; user authorized | ✅ Resolved |
| AR-P28 | Evidence envelope | Where does revision-complete evaluation evidence live? | Pure identity primitives are implemented before publication. After selection, the snapshot-bound evaluation API returns a closed `{ result, evaluationIdentity, sourceProvenance, contentIdentities }` envelope derived from one selected snapshot. Raw handler results do not claim publication authority. | AI delegated by `--auto-design`; plan preflight PF-003; user authorized | ✅ Resolved |
| AR-P29 | Failure taxonomy | Which malformed, inconsistent, unsupported and absent-route states are exact? | Malformed requests return `oracle.input.invalid`; inconsistent reviewed suite/model state returns authority failure; structurally valid unsupported semantics and absent routes return `oracle-unmodeled`. No category is implementation-selectable. | AI delegated by `--auto-design`; plan preflight PF-004; user authorized | ✅ Resolved |
| AR-P30 | Mutation paths | How does the catalog prove every branch rather than one row per broad operation? | Maintain a closed stable `pathId` registry and exact operation/path join. The source gate rejects unreachable registered paths and any missing, extra or duplicate required pair. | AI delegated by `--auto-design`; plan preflight PF-005; user authorized | ✅ Resolved |
| AR-P31 | Diagnostic separation | How are invalid external parameter values represented? | Compiler-invalid source projections alone use the diagnostic manifest. A separate closed external-binding rejection contract owns invalid parameter spelling/type/range values and is independently joined and reviewed. | AI delegated by `--auto-design`; plan preflight PF-006; user authorized | ✅ Resolved |
| AR-P32 | Semantic closure | What prevents structurally valid but language-illegal constant initializers from reaching the oracle? | Run an oracle semantic-closure validator after structural validation and before suite construction/evaluation. It enforces compile-time-constant purity and every evaluator prerequisite. Record the broader RD-02 structural-validator discrepancy as separately owned corrective debt. | AI delegated by `--auto-design`; plan preflight PF-008; user authorized | ✅ Resolved |
| AR-P33 | Preparation compatibility | How is RD-02's immutable four-handler bootstrap preserved? | Keep the legacy prepare/publish wrapper unchanged. New incremental preparation names a selected base and exact target set and returns an opaque root/base/target/release/review-bound capability; only its companion incremental publisher may commit the four-plus-five transaction after re-resolving the base. | AI delegated by `--auto-design`; plan preflight PF-009; user authorized; Iteration 2 transaction correction | ✅ Resolved |
| AR-P34 | Resolution review | Does resolving immutable release bytes trust stored acceptance? | No. Reconstruct release-derived semantic units and dependencies, call factored `validateReviewEvidence`, and reject missing, extra, stale or rejected evidence before creating any snapshot. | AI delegated by `--auto-design`; plan preflight PF-010; user authorized | ✅ Resolved |
| AR-P35 | Commit reconciliation | What result follows a fault after atomic pointer replacement? | Re-read and fully resolve. Exact new release selected returns committed success; exact old release selected returns ordinary failure; inability to determine either returns closed `commit-indeterminate` with bounded recovery data. | AI delegated by `--auto-design`; plan preflight PF-011; user authorized | ✅ Resolved |
| AR-P36 | Mutation concurrency | How are simultaneous baseline and mutant dispatches isolated? | Use `AsyncLocalStorage` and prove isolation with an immutable barrier-controlled baseline plus two-mutant interleaving across awaited boundaries. Serial catalog scheduling remains permissible for throughput. | AI delegated by `--auto-design`; plan preflight PF-012; user authorized | ✅ Resolved |
| AR-P37 | Reader concurrency | How is atomic four-to-nine observation tested? | Use deterministic barrier-controlled worker-thread readers forced across pointer replacement. On the existing verified inode/path replacement race, restart full resolution once without reusing partial state; a second change fails closed. Every successful resolution is exactly old four-row or new nine-row, never mixed. | AI delegated by `--auto-design`; plan preflight PF-013; user authorized; Iteration 2 edge-case correction | ✅ Resolved |
| AR-P38 | Mutant containment | How can synchronous nontermination respect a deadline? | Execute each stable mutant/vector pair in a bounded worker thread and terminate at deadline. A closed run-result failure branch records stable mutant/vector IDs and bounded startup/timeout/crash/protocol/budget/harness diagnostics without kill credit. | AI delegated by `--auto-design`; plan preflight PF-014; user authorized; Iteration 2 testability correction | ✅ Resolved |
| AR-P39 | Spec immutability | How are final publication behaviors specified without leaving a repository-wide RED checkpoint? | Author staged-context ST-46–ST-47 in `oracle-published-evidence.spec.test.ts` before the Phase 5 wrapper and make them GREEN in Phase 5. Author pointer ST-48–ST-49 separately before Phase 6 integration. Never reopen any earlier specification. | AI delegated by `--auto-design`; plan preflight PF-015; user authorized; Iteration 2 feasibility correction | ✅ Resolved |
| AR-P40 | Relation fault seam | When does relation fault injection become available? | Introduce the relation-scoped production dispatch seam before Phase 3 GREEN so immutable relation specs can inject precondition/rewrite/comparator faults. Phase 4 generalizes it into the exhaustive catalog without changing those specs. | AI delegated by `--auto-design`; plan preflight PF-016; user authorized | ✅ Resolved |
| AR-P41 | Boundary oracle | How is package independence specification-tested before evaluator implementation? | Author `oracle-boundary.spec.test.ts` before Phase 2 production work with positive discovery and seeded forbidden package, relative-escape and non-literal dynamic-import fixtures. Add the same invariant to `readiness:source-check` as defense in depth. | AI delegated by `--auto-design`; plan preflight PF-017; user authorized | ✅ Resolved |
| AR-P42 | Public API `(runtime)` | Which exact Phase 1 exports and result members let immutable specification tests bind the approved oracle contract without inventing names or premature publication authority? | Export two bounded authority parsers, `createOracleSuite`, `resolveOracleRoute`, and four individually named raw evaluators: `evaluateFrontendResultOracle`, `evaluateCompilerResultOracle`, `evaluateEmittedProgramOracle`, and `evaluateRuntimeStateOracle`. Export closed parser, route, raw-result and passive published-evidence types. Phase 1 exports no published-context constructor, context factory or selected-evaluation value. Parser structure failures use input diagnostics; exact-join failures use authority/contract diagnostics at the authority member's stable pointer. | AI delegated by `--auto-design`; independent challenger converged on individually named functions and rejected a handler map/generic dispatcher; resolved during execution | ✅ Resolved |
| AR-P43 | Provenance contract `(runtime)` | Is `Rd02ReplayProvenanceV1` a new overlapping record, and what exact nested values make a minimal oracle request? | Define `Rd02ReplayProvenanceV1` as the existing identity-verified `ReplayEnvelopeV1`; it already carries the complete campaign, configuration, case path and ordinal. `case` is the exact RD-02 `GeneratedModeledCase`. `memory` and `budget` use the closed shapes in the evaluator specification. Tests obtain a real replay envelope/case from RD-02 factories rather than fabricating identities. | AI delegated by `--auto-design`; single viable compatibility-preserving mapping grounded in existing RD-02 replay contracts; resolved during execution | ✅ Resolved |
| AR-P44 | Declaration review sequencing `(runtime)` | Who may re-accept the inventory `shared-contracts` review after Phase 1 adds the required unbound semantic-relations declaration, and must the historical unbound publication fixture advance with it? | Pull forward a narrow independent semantics review of only the additive unbound declaration and its generated projections. On acceptance, refresh the real inventory review dependency digests and the historical unbound publication fixture/evidence to their exact new contents; do not accept any RD-03 oracle/evaluator semantics or bind any new handler. Phase 6 retains the full RD-03 semantic acceptance and publication review. | AI delegated by `--auto-design`; accepted without findings by `codex-semantics-reviewer-rd03-p1-arp44`; resolved during execution | ✅ Resolved |
| AR-P45 | Superseded immutable expectation `(runtime)` | How can the older RD-02 publication specification keep asserting the complete unbound declaration set after RD-03 intentionally adds a fifth unbound transform? | Rebaseline its complete unbound set from four oracle declarations to those four plus `transform.semantic-relations`, while preserving the assertion that exactly four RD-02 handlers become bound. | User authorized; independent challenger found no honest implementation seam; resolved during execution | ✅ Resolved |
| AR-P46 | Diagnostic authority conflict `(runtime)` | What exact diagnostic authority applies to boolean wrong-type projections and memory-intrinsic wrong-argument-type projections when E10086 is cast-only and the frozen chapters disagree on E10171/E10172? | Distinguish source diagnostic context rather than guess one code per `(ruleId, neighborId)`; use E10152 for initializer/assignment mismatch and E10172 for return-expression and intrinsic-argument mismatch, resolving the Ch 14 E10171 row as superseded by Ch 06 plus F020. | User authorized; semantics review SR-001; exact context-key shape independently hardened during remediation | ✅ Resolved |
| AR-P47 | Replay registry authenticity `(runtime)` | Does suite construction prove exact six-component freshness without a request envelope? | Require factory-produced `RevisionRegistry` membership at suite construction and snapshot the capability reference; verify the exact six requested revisions and regenerated case per request, where the replay envelope supplies those identities. Reject structural lookalikes before exposing routes. | AI delegated by `--auto-design`; correctness RV-001 and semantics SR-002 converged on the only representation compatible with the existing input shape | ✅ Resolved |
| AR-P48 | Hostile aggregate bytes `(runtime)` | How is provenance rejected before serialization can allocate from one enormous string/key? | Extend hostile-input snapshot accounting with a fixed aggregate UTF-8 key/value byte limit, charge before retaining each string/key, reject before `JSON.stringify`, and add boundary/oversize tests. | AI delegated by `--auto-design`; correctness RV-002; internal resource-bound mechanism | ✅ Resolved |

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | Bounded evaluator, diagnostic and five-relation behavior resolved by AR-P1–AR-P13 |
| Scope | Exact nine-rule current-IR population and RD-08 continuation resolved by AR-P1–AR-P2 |
| Technical unknowns | Handler, identity, mutation, module and backward-compatible publication composition resolved |
| Edge cases | Wrap, signedness, division conflict, absent/out-of-range memory and budget boundaries resolved |
| Integration | RD-02 IR, modeled registry, identity and publication seams covered by AR-P14–AR-P16 |
| Data and state | Closed diagnostic authority, immutable state, memory effects and canonical identities resolved |
| Security | Hostile objects, path/import escapes, resource bounds and dynamic-code exclusion resolved |
| Non-functional | Determinism, bounded work, freshness, crash consistency and branch coverage resolved |
| UX/presentation | Failures-as-data and stable bounded diagnostics resolved; no end-user UI introduced |
| Stakeholder conflict | User-owned scope correction and frozen-spec contradiction handling are explicitly authorized |
| Naming | Oracle, relation, evaluation identity, unmodeled and inapplicable states are closed |
| Dependencies | No new dependency; RD-01/RD-02 prerequisites and RD-08 continuation are explicit |

## AR-P44 Delegated Resolution Record

- **Authority / eligibility:** AI, delegated by `--auto-design`; review sequencing and exact
  content-addressed fixture maintenance inside the already approved additive unbound declaration.
  It changes no product scope, frozen specification, handler binding or selected publication.
- **Objective:** keep the Phase 1 repository gate green without falsely accepting future oracle,
  evaluator, relation or publication semantics.
- **Evidence:** the required declaration adds exactly
  `transform.semantic-relations` as an unbound `readiness-rd03` transform at contract version
  `1.0.0`. The independent review recomputed current and historical-unbound review/projection
  digests and confirmed that all nineteen non-aggregate semantic units remain byte-identical.
- **Decision:** refresh only every record's `shared-contracts` dependency, the aggregate semantic
  digest, generated projection digests and appended reviewer attribution in the current and
  historical-unbound evidence. Phase 3 retains relation behavior; Phase 6 retains full semantic
  review and publication selection.
- **Rejected alternatives:** carrying stale evidence fails closed and leaves the repository RED;
  removing the declaration contradicts the approved Phase 1 deliverable; accepting broader RD-03
  semantics here would bypass their specification-first phases and final independent review.
- **Confidence:** High. Reopen if any non-aggregate semantic digest changes, any declaration becomes
  bound, any rule gains a new transform reference, or the selected publication changes.
- **Hardening:** `codex-semantics-reviewer-rd03-p1-arp44` independently accepted the narrow delta
  with no findings and supplied exact current/historical digest values.
- **Policy / invocation:** policy version 1; root invocation `rd03-exec-20260727`.

## AR-P46 User Resolution Record

- **Authority:** user-owned frozen-spec and acceptance-oracle correction, explicitly authorized
  during execution.
- **Objective:** remove cast-only `E10086` from non-cast generated programs while preserving exact,
  independently authored diagnostic authority.
- **Evidence:** Chapter 02 limits `E10086` to explicit boolean/integer casts. Chapter 06 and F020
  assign `E10172` to argument/return mismatch while Chapter 14 conflicts with `E10171` for
  arguments and assigns `E10152` to assignment/initializer mismatch. The boolean wrong-type
  neighbor reaches both initializer and return sites.
- **Decision:** add optional
  `diagnosticContext: "initializer" | "assignment" | "return-expression" |
  "intrinsic-argument"` to diagnostic-authority records only. Context is derived from regenerated
  projection structure, never caller input or construction spelling. Split the boolean row into
  initializer `E10152` and return-expression `E10172`; change memory wrong-argument-type rows to
  `E10172`; preserve numeric `E10084` and arity `E10041`. Diagnostic observations remain unchanged.
  The canonical population becomes twenty rows, while the separate binding authority remains its
  independently defined nine rows.
- **Rejected alternatives:** one guessed code per rule/neighbor cannot represent the generated
  contexts; spelling is representation rather than diagnostic site; separate authority families
  duplicate review truth.
- **Confidence:** High. Reopen if a generated invalid projection reaches an unlisted diagnostic
  site or the frozen specification resolves these diagnostic families differently.
- **Hardening:** independent semantics review identified the conflict; an independent challenger
  selected the optional context qualifier and identified the binding-slice coupling.
- **Policy / invocation:** policy version 1; root invocation `rd03-exec-20260727`.

## AR-P42 Delegated Resolution Record

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal TypeScript API naming,
  result representation and phase sequencing within the already approved oracle behavior. It
  changes no product scope, acceptance criterion, frozen specification, publication format or
  external policy.
- **Objective:** give the implementation-blind Phase 1 specification author a complete stable
  contract while keeping raw source-authoring capabilities visibly non-authoritative.
- **Evidence:** adjacent readiness APIs use individually named factories, queries and route-specific
  callables (`createModeledGeneratorSuite`, `getRuleGenerationDomain`, `generateFrontendCase`,
  `generateCompilerCase`, `generateRuntimeCase`). The approved design requires two separate
  authorities, four explicit façades and a resolver-owned published context.
- **Decision:** use the exact signatures and discriminated unions added to the Phase 1 component
  specification. Parser success carries the validated manifest and digest. Route success names the
  exact rule, handler, observable and authority; unsupported routes return a closed unmodeled
  reason. Raw results use modeled, unmodeled, relation-inapplicable or failure branches and never
  carry published evidence. Only passive published-context/evidence types exist in Phase 1.
- **Rejected alternatives:** a public handler record invites enumeration and object-identity
  coupling; a generic dispatcher duplicates the four-facade surface and weakens route-specific
  discovery; `Published*` parser/suite names falsely imply selected authority before resolution.
- **Strongest counterargument:** four exports repeat small wrappers over one internal dispatcher.
  The repetition is deliberate public clarity; dispatch and validation remain shared internally.
- **Confidence:** High. Reopen if a façade cannot share the closed result union without losing a
  handler-specific invariant, or if resolver integration proves the passive context type cannot
  remain constructor-free.
- **Hardening:** an independent blind challenger selected individually named functions, rejected
  the map and generic dispatcher, and identified the wrapper-repetition tradeoff. Its suggested
  published naming was reconciled against the explicit non-authoritative Phase 1 boundary.
- **Policy / invocation:** policy version 1; root invocation `rd03-exec-20260727`.

## AR-P43 Delegated Resolution Record

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal type reuse and fixture
  construction inside the approved complete-replay requirement.
- **Objective:** make request provenance exact without creating a second representation of RD-02
  campaign/configuration/path/ordinal identity.
- **Evidence:** `ReplayEnvelopeV1` already contains schema version, complete campaign identity,
  campaign digest, `CaseIdentity` with generation path and ordinal, and the complete generation
  configuration. `GeneratedModeledCase` is the existing immutable semantic case carried separately
  by the request and checked through regeneration.
- **Decision:** alias `Rd02ReplayProvenanceV1` to `ReplayEnvelopeV1`; retain
  `GeneratedModeledCase` unchanged as `case`; use the already specified `MemoryFixtureV1` and
  `OracleBudgetV1` records. Specification fixtures must use real RD-02 factories.
- **Rejected alternatives:** a copied provenance interface can drift from replay validation; a
  digest-only record omits the configuration and replay coordinates the approved requirement
  explicitly demands.
- **Strongest counterargument:** the alias couples oracle input to the v1 replay envelope. That is
  intentional for the v1 compatibility slice; any replay format evolution must be versioned by
  its owning evolution gate.
- **Confidence:** High. Reopen if replay provenance needs information not already committed by the
  envelope, or if deterministic regeneration cannot recover the exact modeled case.
- **Hardening:** one viable representation survived repository grounding; no materially distinct
  alternative preserves both compatibility and complete replay.
- **Policy / invocation:** policy version 1; root invocation `rd03-exec-20260727`.

## AR-P15 Delegated Resolution Record

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal compatibility,
  content-addressing and publication-composition mechanism within the approved atomic-publication
  requirement. No frozen-spec, product-scope, deployment or outward-facing decision changes.
- **Objective:** atomically select the five RD-03 handlers and diagnostic authority without
  mutating the closed seven-member v1 release or activating the RD-07 evolution gate early.
- **Evidence:** implementation revisions already digest arbitrary canonical dependency bytes;
  semantic review already carries dependency digests and review units; `bindings-v1.json` may
  contain the complete nine-row binding set; the release digest already commits both bindings and
  semantic review. Manifest parsing requires exactly seven ordered members.
- **Decision:** diagnostic manifest/projection/parser bytes enter relevant handler closures and a
  dedicated semantic-review dependency. Accepted review bytes do not enter implementation
  closures because they approve the resulting revisions. One transaction carries forward the
  four selected RD-02 rows unchanged and promotes exactly five new candidates. Candidate
  reconstruction keys from the serialized binding rows instead of assuming the newest fixed
  profile, preserving resolution of historical four-row releases.
- **Rejected alternatives:** adding an eighth v1 member is rejected by the exact member parser and
  would be an ungoverned format mutation; embedding accepted review bytes in implementation
  revisions creates circular identity; a v2 release is deferred until RD-07's evolution gate.
- **Strongest counterargument:** the immutable release commits the diagnostic digest and handler
  closures but does not store standalone historical diagnostic-manifest bytes. The current
  resolver intentionally reconstructs exact source closures and fails closed if unavailable;
  immutable release-only replay would require the RD-07-gated v2 alternative.
- **Confidence:** High. Reopen if historical four-row releases stop resolving, carried bindings
  can change during promotion, or readiness requires release-only reconstruction without source
  closure bytes.
- **Hardening:** independent challenger found and resolved the review-circularity and incremental
  promotion hazards.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd03-20260727-01`.

## Gate

The systematic scan covers every required category, every item is resolved, and the independent
challenge has converged. The Zero-Ambiguity Gate is open; the remaining plan documents may be
created.
