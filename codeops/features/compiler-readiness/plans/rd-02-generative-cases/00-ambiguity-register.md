# Ambiguity Register: RD-02 Typed Generative Cases and Deterministic Replay

> **Status**: ✅ GATE PASSED — all 41 items resolved
> **Last Updated**: 2026-07-26 14:18 UTC
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd02-20260724-01`
> **Policy version**: 1

## Register

| # | Category | Ambiguity / Gap | Resolution | Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Which rules form the first non-vacuous modeled subset? | Model exactly the five scalar-domain and four memory-signature rule IDs listed in 03-01 with a closed per-rule contract/spelling matrix and digest-bound independent review. Arithmetic/comparison and module/function forms are composition machinery, not additional coverage claims. Every other rule remains visibly unmodeled/not-generatable. | AI delegated by `--auto-design`; independently challenged and preflight-hardened | ✅ Resolved |
| AR-P2 | Data & state | Where do typed rule models live without changing inventory v1? | A closed canonical JSON model manifest owns serializable reviewed facts and reason-coded coverage state; a TypeScript registry owns executable constructors/neighbor operations and must bind one-to-one to modeled manifest records. Validation joins both against the RD-01 inventory. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P3 | Technical | What independent IR is sufficient for the first subset? | Immutable discriminated unions for modules, consts, functions, parameters, locals, scalar types, expressions, calls, assignments, returns and memory intrinsics; no compiler AST/spans/symbol objects. Unsupported constructs are unrepresentable. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P4 | Technical | Which deterministic PRNG is pinned? | A counter-based domain-separated SHA-256 generator identified as `blend65-sha256-ctr-v1`; every draw binds seed, generation path and draw ordinal, with rejection sampling for bounded integers. No mutable global stream or host RNG participates. | AI delegated by `--auto-design`; challenger improved the design | ✅ Resolved |
| AR-P5 | Data & state | How are campaign and case identities canonicalized? | RFC-independent canonical UTF-8 encoding with fixed field order, decimal BigInt strings, sorted record keys and LF; domain-separated SHA-256 for configuration, campaign and case identities. Case path is an integer-choice path plus ordinal, not arbitrary text. Replay carries the bounded normalized configuration preimage and verifies its digest. | AI delegated by `--auto-design`; preflight-hardened | ✅ Resolved |
| AR-P6 | Behavioral | What happens when an exact replay revision is unavailable? | Return a typed `replay-incompatible` result naming the missing identity component; never load nearest/current code and never generate partial source. Handler revisions are freshly derived from the handler's complete transitive production dependency bytes, never supplied labels. | AI delegated by `--auto-design`; preflight-hardened | ✅ Resolved |
| AR-P7 | Technical | How is renderer independence proven? | A renderer and a separate bounded tokenizer/Pratt parser-normalizer share only public IR types and token-kind names; they do not share precedence tables or formatting helpers. Structural equality ignores only explicit normalization fields. | AI delegated by `--auto-design`; independently challenged | ✅ Resolved |
| AR-P8 | Behavioral | How is “exactly one intentional violation” established? | Begin from a model-valid IR, apply one named neighbor operation, revalidate every participating model contract, and require the target contract alone to flip valid→invalid; otherwise generation rejects the case. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P9 | Integration | How are executable bindings represented? | A closed in-memory registry binds generated handler IDs to kind, contract version, content revision and callable implementation. Candidate and published-state validators are separate APIs. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P10 | Data & state | How is binding publication made atomic with existing RD-01 files? | Stage and durably sync a content-addressed release containing inventory, rule models, both review-evidence sets, bindings and projections; validate and test it through an isolated opaque snapshot; then atomically replace and sync one regular-file pointer. Published claims require that snapshot capability; source authoring remains explicitly non-authoritative. | AI delegated by `--auto-design`; challenger and preflight improved the design | ✅ Resolved |
| AR-P11 | Edge cases | Which limits are enforced before compilation? | Closed positive integer budgets for modules, declarations, IR nodes, statements, expression depth, loop-work product, source bytes and generation attempts; checked during construction and again on the completed case with overflow-safe BigInt arithmetic. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P12 | Security | How are external registry/replay inputs handled? | Parse as bounded bytes with closed schemas; allowlist IDs/targets/algorithms; reject duplicate keys, unknown fields, unsupported versions, absolute/traversal paths and oversize values before resolution or filesystem access. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P13 | Testing | What verification and coverage policy applies? | Follow repository full verify; readiness logic retains ≥90% branch coverage, changed files pass Prettier checks, spec tests are written and observed red before implementation, and `spec/` remains byte-untouched. | AI delegated by `--auto-design`; verify command detected from AGENTS.md | ✅ Resolved |
| AR-P14 | Ordering | What phase order prevents false readiness? | Foundations → rule-model registry → bindings/identity → IR/generation/budgets → renderer/inverse → replay/campaigns → authority publication/closeout. No handler becomes bound before the complete generation surface is verified. | AI delegated by `--auto-design` | ✅ Resolved |
| AR-P15 | Runtime API | What exact public result and diagnostic shapes are immutable Phase 1 specification tests allowed to target? | Closed discriminated results with stable diagnostic codes and JSON paths: `RuleModelRegistryResult = { ok: true; registry; counts; diagnostics: [] } \| { ok: false; diagnostics }`; `BindingValidationResult = { ok: true; bindings; diagnostics: [] } \| { ok: false; diagnostics }`; `getPublishedBinding(snapshot: PublishedSnapshot, handlerId: HandlerId): ExecutableBinding \| undefined`. Validation failures are data, not exceptions. | **A — accepted by user 2026-07-24** | ✅ Resolved |
| AR-P16 | Runtime wire contract | Which exact JSON envelope, binding input fields and diagnostic code/path taxonomy complete AR-P15's immutable oracle? | Model JSON is `{ schemaVersion: 1, registryVersion, rules }`; every rule entry is `{ ruleId, state, ...stateFields }`; binding inputs use the existing declaration fields plus `{ handlerId, kind, contractVersion, implementationRevision, implementation }`. Codes are closed by category: `model.input.*`, `model.schema.*`, `model.rule.missing/duplicate/unknown`, `model.modeled.incomplete`, `model.operation.unknown`, and `binding.declaration.missing/duplicate`, `binding.entry.duplicate/kind/contract/revision`, `binding.candidate.state`, `binding.published.state/missing`. Paths are RFC 6901 JSON pointers rooted at `/rules`, `/declarations` or `/bindings`. Phase 1 does not fabricate a published snapshot; it proves candidate results cannot be consumed by `getPublishedBinding`, while runtime published lookup waits for Phase 7's opaque snapshot. | **A — accepted by user 2026-07-24** | ✅ Resolved |
| AR-P17 | Semantic fact DSL | What minimal closed record shapes and operation lookup make a valid modeled fixture independently testable? | Closed reason codes are `outside-initial-slice`, `requires-semantic-oracle`, `not-source-generatable`; citations are `{ sourcePath, contentHash }`; preconditions are `{ kind: "type-in" \| "value-range" \| "arity" \| "spelling-in", subject, values }`; typed domains are `{ subject, type, values }`; invalid contracts are `{ contractId, diagnosticFamily, neighborIds }`; operation/spelling IDs are allowlisted lexical IDs. Parsing and semantic joining are separate: `parseRuleModelRegistry(bytes)` proves the closed bounded wire shape, then `validateRuleModelRegistry(input, inventoryRuleIds, executableOperationIds)` proves exhaustiveness and operation existence. Specification fixtures inject known operation IDs instead of depending on Phase 5 implementations. | **A — accepted by user with `--auto-design` 2026-07-24** | ✅ Resolved |
| AR-P18 | Phase 2 API | Which exact IR, budget, neighbor and boundary APIs may immutable ST-08–ST-14 tests target? | Use the closed contracts in 03-02: explicit module/const/function/parameter nodes; `validateGeneratorIr`, `validateGenerationBudget`, `createGenerationBudgetTracker`, `applyInvalidNeighbor` and `createBoundaryVariants` return discriminated failures-as-data with stable codes/dimensions. Predicates and neighbor operations are injected fixture capabilities; no Phase 5 model implementation is required. | AI delegated by accepted `--auto-design`; back-propagated before Phase 2 spec authoring | ✅ Resolved |
| AR-P19 | Phase 2 result envelopes | Which exact result, tracker, boundary-descriptor and diagnostic-path shapes complete AR-P18? | Use the closed declarations in 03-02: every operation returns `{ ok: true, ..., diagnostics: [] } \| { ok: false, diagnostics }`; tracker usage is an immutable dimension record; boundary variants use a closed kind/value/spelling/depth descriptor; neighbor paths root at `/baseline`, `/operation`, `/predicates`; budget paths root at `/budget`, `/dimension`, `/amount`, `/sourceBytes`, `/attempts` or `/usage/<dimension>`. | AI delegated by accepted `--auto-design`; test-author blocker back-propagated before test creation | ✅ Resolved |
| AR-P20 | Phase 3 cryptographic/wire contract | Which exact canonical bytes, identity fields, counter semantics, replay envelope, revision APIs and freshness diagnostics may immutable Phase 3 tests target? | Use the complete closed contracts in 03-03: u32-BE length-prefixed canonical fields; fixed `blend65-*-v1` domain tags; exact campaign/binding/configuration structures; SHA-256 counter blocks with 256-bit rejection sampling; bounded replay-v1 JSON and fixed limits/codes; exact revision registry with no fallback; implementation revision over lexical path/content closure with LF normalization and freshness validation. | AI delegated by accepted `--auto-design`; consolidated spec-author blocker back-propagated before test creation | ✅ Resolved |
| AR-P21 | Freshness compatibility | How can Phase 3 require implementation freshness without contradicting Phase 1 ST-06's raw candidate metadata validator? | Preserve `validateCandidateBindings` as non-authoritative structural/compatibility validation over raw revision metadata; add `registerFreshCandidateBinding` and revision-registry APIs that require a module-private, non-forgeable `FreshImplementationRevision` returned only by successful freshness validation. Published lookup and replay accept only freshness-gated registrations. | **A — accepted by user 2026-07-24** | ✅ Resolved |
| AR-P22 | Phase 3 review remediation | How are freshness authority and in-memory registries bounded without weakening the immutable wire contract? | Derivation and validation return distinct success types; only successful claimed-revision validation produces freshness authority, bound module-privately to both exact revision and contract version. Collision registries fail closed at 4,096 entries or 16 MiB retained preimages and expose terminal disposal. Revision registries use exact own-key entry closure, retain at most 65,536 aggregate value nodes and 4 MiB UTF-8 value/key bytes, close factory values once and mark factory registries module-privately so exact replay avoids cloning them again. A reusable factory-produced choice context validates seed/path once and pre-encodes their invariant canonical chunks; public single-operation wrappers remain unchanged and use the same prepared-state path. | AI delegated by accepted `--auto-design`; Phase 3 correctness/performance review remediation | ✅ Resolved |
| AR-P23 | Phase 4 runtime contract | Which exact renderer, inverse, conformance and diagnostic shapes may immutable Phase 4 tests target without making the oracle circular? | Use the complete closed contract in 03-04. Production exports expose named render/project/parse/validate operations and passive result/projection types. A non-package-exported versioned conformance seam owns only policy mutation and pure module-graph validation. The immutable spec suite owns the expected token, spelling, normalization and precedence vectors; production never exports a normative syntax catalog for tests to echo. Explicit literal spellings are a renderer option keyed by validated expression JSON pointers, so the Phase 2 IR remains unchanged. | AI delegated by accepted `--auto-design`; runtime spec-author blocker resolved after independent challenge | ✅ Resolved |
| AR-P24 | Phase 4 semantic remediation | Which facts can the syntax round trip honestly preserve after review exposed non-injective IR-to-source mappings? | Preserve source-observable structure and declaration types, not unobservable recursive expression type annotations. Emit boolean IR values as `true`/`false`; prohibit numeric spelling overrides for them. Distinguish explicit unary-minus literals with grouping, while an ungrouped sign remains a signed literal. Reject lexical keywords before rendering, snapshot hostile options under guarded own-data inspection, scan static and dynamic inverse imports, and limit mutation claims to the eight binary precedence rows, binary associativity and required-parenthesis decisions the seam can actually perturb. | AI delegated by accepted `--auto-design`; Phase 4 correctness and semantics review remediation | ✅ Resolved |
| AR-P25 | Phase 4 authorized remediation | How are the surviving composition and syntax-only inverse findings closed after the automatic review loop is exhausted? | Prepare one immutable module/options snapshot and share it across render, project and validate. Discriminate boolean and integer literal projections. Parse void-value returns and unresolved assignments structurally, dispatch `poke`/`pokew` as intrinsics only before `(`, and AST-walk all static/dynamic imports while rejecting non-literal dynamic targets. Retain the frozen inverse token-vector acceptance of keyword-shaped module segments as an explicit parser superset; the renderer still rejects them as non-emittable Blend65 source. | **Authorized by user 2026-07-25, including a third remediation pass if needed** | ✅ Resolved |
| AR-P26 | Phase 5 runtime API | Which exact callable boundary lets immutable tests observe reviewed seed authority and typed generation without merging rule-model and handler identities? | Validate injected seed-contract, rule-model and review-evidence bytes plus inventory authority into an opaque `ModeledGeneratorSuite`. Stateless typed constructor/predicate/neighbor operations and the three generator handlers take the suite explicitly. The suite exposes lexical modeled domains; the five scalar rules route to frontend, the four memory rules to runtime, and compiler has a deliberate zero-direct-domain composition route. Four exact stateless callables become candidate bindings at contract `1.0.0`; candidate validation creates no published capability. | AI delegated by accepted `--auto-design`; runtime spec-author blocker; independent challenger recommended the typed capability-injected suite | ✅ Resolved |
| AR-P27 | Phase 5 invalid-case representation | How can wrong-arity and wrong-type memory neighbors exist without corrupting the valid-only typed IR contract? | Keep `GenModule` valid-only. An invalid case is a validated baseline plus exactly one closed `InvalidSourceTransform` that inserts, removes or replaces one intrinsic argument at a canonical call path. Predicates independently derive effective arity/types from the projected call and prove only the named contract flips. Invalid rendering applies the descriptor structurally at the argument-list seam and uses its own frozen vectors; it never passes through the valid round-trip oracle or edits rendered strings. | AI delegated by accepted `--auto-design`; runtime impossibility found before test authoring; independent challenger selected the narrow delta model | ✅ Resolved |
| AR-P28 | Phase 5 scalar neighbors | How can reviewed scalar nearest-invalid neighbors execute without weakening valid typed literals? | Keep the baseline IR valid and use one closed `scalar-expression-replace` descriptor containing only the canonical integer literal immediately outside the numeric range, or integer zero for boolean wrong-type. Parameter cases use a distinct `parameter-binding-replace` descriptor. Resolve and apply the path against the full semantic case, then independently prove only the named scalar predicate flips. | AI delegated by accepted `--auto-design`; independent challenger selected the narrow source/binding delta | ✅ Resolved |
| AR-P29 | Phase 5 parameter boundaries | How do parameter-spelling min/max cases remain distinct when the independent IR has no call expression? | Store one immutable external parameter binding keyed by the canonical parameter declaration path and exact chosen value. Identical function source is allowed; case metadata and replay identity are not identical. Phase 6 must reproduce the binding, and compilation alone cannot claim that the parameter value executed. | AI delegated by accepted `--auto-design`; independent challenger rejected reopening Phase 4 call IR | ✅ Resolved |
| AR-P30 | Phase 6 orchestration API | Which exact campaign, generated-case, dependency, replay and fresh-process contracts may the immutable Phase 6 oracle target? | Use the closed prepared-campaign capability and random-access APIs in 03-03. `createCampaignPlan` validates and binds all campaign-wide authority once; `getCampaignPlanItem`, `generateCase`, `generateCampaignCase` and `replayCase` are output-pure by ordinal and have closed failures-as-data. The total is exactly `caseCount`; mandatory valid spelling coverage is allocated first and invalid cases fill only remaining slots up to `maxInvalidCases`. One campaign accepts rules routed to one exact generator binding. A campaign-specific collision index proves all case identities before the immutable plan becomes available. The final case carries parsed round-trip evidence, effective parameter bindings, exact usage and attempts. Fresh-process replay uses one bounded stdin envelope and one canonical stdout response, with no ambient configuration or path input. | AI delegated by accepted `--auto-design`; runtime spec-author blocker; independent challenger selected an immutable prepared campaign over stateless repetition and callback injection | ✅ Resolved |
| AR-P31 | Phase 6 freshness composition | How do campaign and replay fixtures carry executable dependencies without bypassing Phase 3's non-forgeable freshness gate? | Public campaign creation accepts `FreshCandidateRegistration` capabilities for the generator and boundary transform, never raw executable bindings. Revision registration accepts those same capabilities and may expose only their already verified binding to its private replay composition path. The rule-model revision value is the factory-produced `ModeledGeneratorSuite` capability, preserved by identity rather than cloned into an empty record. Renderer and immutable data remain exact opaque values selected by their content-addressed registry keys. Test fixtures create real freshness capabilities from bounded fixture dependency bytes; missing-revision spies use a different fresh capability and prove it is not invoked. | AI delegated by accepted `--auto-design`; runtime conflict found before GREEN; preserves AR-P21 rather than weakening revision registration | ✅ Resolved |
| AR-P32 | Phase 6 replay performance | Must exact replay repeat the full campaign collision proof before regenerating one carried ordinal? | No. Public `createCampaignPlan` remains the only producer of a fully proven `PreparedCampaign` and still proves every identity before returning it. Normal replay instead creates a distinct private target-only capability after the same bounded campaign, configuration, dependency and domain validation; it derives the carried ordinal's lane, path, plan item and complete identity only, then regenerates and compares that exact case. It must never masquerade as a fully proven public campaign. An explicitly supplied conformance collision index retains the full-proof path. | AI delegated by accepted `--auto-design`; Phase 6 performance review; independent challenger found no schema-compatible sublinear proof of global uniqueness | ✅ Resolved |
| AR-P33 | Phase 6 campaign accounting | How does campaign generation avoid repeating construction snapshots and IR recounts without weakening validation? | The factory-produced modeled suite privately prepares the finite reviewed valid/neighbor construction templates once, including independent semantic validation and authoritative construction usage. Per-case generation invokes the exact freshness-gated handler, binds a frozen template result, checks cached usage against the prepared budget and publishes one final usage snapshot after source bytes and attempts are known. Arbitrary or unbranded handler output retains full structural validation. Renderer parsing and projection comparison remain independent per case. Plan-item derivation uses one choice context and the internal campaign path consumes one already-verified item; the public caller-supplied-item API retains defensive membership validation. | AI delegated by accepted `--auto-design`; Phase 5 PE-003 expiry found by Phase 6 performance review; independent challenger selected prepared finite templates over memoized outputs or a new batch API | ✅ Resolved |
| AR-P34 | Phase 6 rule-model authority | Does campaign `ruleModelVersion` equal the manifest's `registryVersion`, and which facts bind a suite to replay identity? | They are distinct. Campaign `ruleModelVersion` is the v1 generator/replay protocol compatibility label and must equal the suite-owned constant `rule-model-v1`. The suite separately retains manifest `registryVersion` (`rule-models-v1` for the current reviewed release) and the SHA-256 digest of the exact validated manifest bytes. Campaign composition requires the exact protocol label and digest; resolved replay authority requires the registry key and campaign digest to equal the retained digest. Generic identity derivation may hash any closed version string, but composing a real suite rejects aliases. Replay protocol or digest disagreement is `replay-incompatible` for `rule-model`, never fallback. | AI delegated by accepted `--auto-design`; Phase 6 provenance remediation exposed the naming collision; independent challenger reconciled immutable oracle and reviewed manifest authority | ✅ Resolved |
| AR-P35 | Phase 6 revision-set validation | May a revision registry retain an alternate rule-model suite under a nonmatching key when that entry is not the requested exact revision? | Yes, as a non-authoritative compatibility-set entry. Registry creation closes and preserves the factory suite but does not claim that every stored key/content pair is usable authority. Raw `RevisionRegistry.resolve` is compatibility-set lookup only. Exported `resolveReplayRevisions` establishes authority: after exact lookup it verifies the suite's retained protocol and digest against both the requested key and campaign; disagreement is `replay-incompatible` naming `rule-model` before any handler runs. This preserves the immutable missing-revision oracle, which deliberately supplies a nonrequested alternate suite, while preventing that suite from authorizing a falsely labeled replay through either public replay API. Public campaign composition still requires exact suite protocol/digest directly. | AI delegated by accepted `--auto-design`; immutable Phase 6 missing-revision case exposed the distinction; independent adjudicator moved enforcement to the exported authoritative resolver | ✅ Resolved |
| AR-P36 | Phase 7 publication contract | Which exact API, wire, durability, crash, boundary and CLI contracts may the immutable publication oracle target? | Use the complete contract in 03-05. Public production exposes deterministic `prepareBindingPublicationReview`, one indivisible `publishBindingTransaction`, `resolvePublishedSnapshot` and capability-gated metadata/inventory/binding reads. Low-level member writes, release promotion, pointer replacement and snapshot construction remain private; a non-package-exported conformance seam owns fault points and injected collision/durability behavior. Closed v1 pointer, manifest, binding and review JSON use exact named caps and a length-prefixed `blend65-publication-v1` digest. The sole pointer commit follows accepted digest-bound review, fully synced inert release construction and package-owned staged invariant validation through the isolated resolver. CLI commands are exactly `source-check`, `generate`, `check`, `publish` with fixed exit/output behavior. Only the three generators and boundary transform become bound; all four RD-03 oracles and all RD-04 evidence capabilities remain unbound. | AI delegated by accepted `--auto-design`; Phase 7 spec-author blocker; independent challenger selected one high-level transaction over bypassable public stage/promote primitives | ✅ Resolved |
| AR-P37 | Phase 7 callable authority | How does a published binding prove that the executable callable is the implementation named by its reviewed dependency revision, rather than an arbitrary function paired with valid metadata? | Remove candidates from public publication preparation, transaction and resolution inputs. Every operation reconstructs the package-owned candidate catalog from exact dependency bytes and selects an explicit version-one profile containing only the four approved handlers. Generic freshness registrations remain available to campaign/replay but cannot choose a published callable. The publication oracle uses the real catalog rather than synthetic functions. | **Option C authorized by user 2026-07-26**; independent semantic review and design challenger | ✅ Resolved |
| AR-P38 | Phase 7 staged acceptance | How can the complete specification gate run against an isolated staged digest before the pointer commit without recursively invoking the publication specification itself or exposing bypassable public stage/commit primitives? | Separate the two gates by responsibility. Runtime package-owned acceptance is complete staged-release invariant validation through the isolated resolver before pointer replacement. CodeOps runs ST-01–ST-40 on the exact unchanged tree immediately before the one real publication and records the tree/result; the transaction then recomputes reviewed authority and validates its exact staged digest. Production never launches Vitest recursively or exposes stage/commit bypass primitives. | **Option B authorized by user 2026-07-26**; independent semantic review and design challenger | ✅ Resolved |
| AR-P39 | Phase 7 oracle alignment | Which command owns loose-projection freshness after selected publication becomes authoritative? | The specification author replaces only obsolete `check` command calls with `source-check`; assertions and failure expectations remain immutable. `check` remains selected-publication-only and never falls back to loose source authority. | AI delegated by `--auto-design`; bounded specification-author correction | ✅ Resolved |
| AR-P40 | Phase 7 review ruling | How are RV-001–RV-006 governed after the recovery review? | Treat the current requirements-derived specification tests as the authorized immutable pre-remediation baseline, waive no risk, and remediate every production finding through implementation and implementation-test changes only. | **Authorized by user 2026-07-26 with `--auto-design --auto-commit`** | ✅ Resolved |
| AR-P41 | Phase 7 filesystem hardening | How can portable Node publication close symlink, bounded-read and crash-retry gaps without changing the accepted release layout? | Use one shared guard layer that verifies every existing directory component without following links, creates persistent directories one level at a time, pins bigint device/inode identities around every path mutation, and synchronizes each parent after child creation. Collision reuse enumerates at most the exact member count plus one and reads exact expected lengths through single-link handles with `O_NOFOLLOW` where available plus compensating `lstat`/`fstat` identity checks. Both fresh and reused releases synchronize `releases/` before pointer work. Lock failures remain typed, and the static boundary scans the complete real production closure using exact owner paths. | AI delegated by `--auto-design`; independent challenger selected portable A+ | ✅ Resolved |

## Delegated Resolution Provenance

All entries are eligible internal architecture, algorithm, data-shape, validation, security,
testing or sequencing decisions within the approved RD-02 behavior and scope.

- **Objective:** produce independent, deterministic, replayable generative evidence without
  treating compiler output or unreviewed prose inference as semantic authority.
- **Evidence:** RD-02 preflight; `packages/readiness` public contracts and dependency boundary;
  empty generation-domain arrays in the 2,112-rule authority; existing atomic writer, generation
  lock, review evidence and projection pipeline.
- **Rejected alternatives:** compiler AST reuse violates independence; broad inventory-v1 schema
  mutation triggers premature evolution; TypeScript-only semantic facts are not independently
  reviewable; text-only fuzzing cannot establish valid semantics; snapshots cannot prove renderer
  structure; binding before end-to-end verification creates false readiness.
- **Strongest counterargument:** the hybrid registry and independent inverse add substantial
  machinery before the first campaign runs.
- **Confidence:** High — reopen if the first modeled subset cannot express ordinary
  const/local/parameter memory-intrinsic arguments without compiler types, or if exact replay needs
  an identity input not listed by RD-02.
- **Hardening:** the independent challenger converged on AR-P1, AR-P2, AR-P7 and AR-P14. It
  improved AR-P4 from mutable-stream PCG32 to path-local SHA-256 counter generation so unrelated
  cases survive traversal changes, and improved AR-P10 from sequential loose-file renames to one
  content-addressed snapshot pointer so authority and bindings cannot become half-visible.
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd02-20260724-01`
- **Reopen triggers:** an unmodeled case is counted as coverage; a case-shaping change preserves
  identity; renderer/parser share behavioral tables; publication can expose half-bound state; or a
  generated program requires compiler-owned semantic types.

### AR-P23 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal API, test-seam,
  validation and module-boundary design inside approved RD-02 behavior. No product scope,
  compatibility promise, frozen-spec edit or external action changes.
- **Objective:** make the Phase 4 immutable oracle exhaustive and implementation-independent while
  keeping production compatibility surface proportional.
- **Evidence:** the implemented Phase 2 `GenModule` union, frozen Blend65 operator table and source
  grammar, Phase 4 specification, and the spec-author's seven concrete blocker categories.
- **Decision:** production gets named render/project/parse/validate APIs and passive data types;
  versioned mutation/graph validation remains an internal conformance seam; expected syntax
  catalogs remain test-owned; literal spelling selection is a renderer option keyed by validated
  IR expression paths.
- **Rejected alternatives:** exporting production syntax catalogs makes the test circular and
  freezes test machinery as public API; test-only generic callbacks can mutate a parallel path
  rather than the renderer; one public service aggregate couples independently authored sides and
  invites whole-contract substitution.
- **Strongest counterargument:** even an internal TypeScript seam can become a de facto API.
  Mitigation: it is absent from package exports and the public index, explicitly versioned, and
  contains no syntax oracle catalog.
- **Confidence:** High — the contract covers every blocker without changing Phase 2 IR or the
  frozen spec. Reopen if a generated spelling cannot be represented by expression-path selection,
  or if package tooling exposes the internal seam publicly.
- **Hardening:** an independent challenger rejected all three initial options as stated and
  proposed the adopted split facade/internal-conformance design; its completeness correction
  requires directory-wide inverse discovery so new modules cannot evade the boundary.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P24 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal projection,
  source-rendering, validation and test-boundary corrections inside approved RD-02 behavior.
- **Evidence:** independent correctness and formal-semantics reviews reproduced comparison operand
  type loss, signed-literal ambiguity, invalid numeric boolean source, hostile proxy exceptions,
  dynamic-import blindness and overclaimed mutation coverage.
- **Decision:** the passive projection contains only facts recoverable from Blend65 source;
  declaration types remain exact, recursive expression types stay in the independently validated
  generator IR but are not invented by the syntax inverse. Canonical source distinguishes signed
  literals from explicit unary nodes and uses the frozen language's boolean keywords.
- **Rejected alternatives:** adding non-language type tags would stop rendering Blend65 source;
  inferring recursive types in the inverse would falsely convert semantic guesses into structural
  evidence; widening Phase 2's literal representation is unnecessary because its closed bigint
  boolean domain maps exactly to `false` and `true`.
- **Confidence:** High — the counterexamples now have direct implementation tests and the
  production compiler remains the later RD-04 semantic authority.

### AR-P25 user-authorized remediation provenance

- **Authority:** explicit user authorization on 2026-07-25 after the single CodeOps rescan retained
  major findings.
- **Evidence:** reproduced stateful-proxy throws in composition APIs, non-literal dynamic-import
  blindness, boolean/integer projection collision, semantic checks in the syntax-only inverse and
  `poke` assignment misclassification.
- **Decision:** one prepared snapshot is the sole composition input; literal surface classes are
  distinct projection variants; the inverse parses syntax without name/return semantics; the
  boundary uses the TypeScript AST and rejects unresolved import targets.
- **Frozen-oracle constraint:** the specification vector explicitly accepts `module token.const;`.
  The inverse therefore retains that conformance superset while production rendering rejects
  keyword identifiers. No specification test was modified.

### AR-P26–AR-P27 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal API, immutable test seam,
  data validation and invalid-case representation within approved RD-02 scope. No product
  behavior, frozen-spec rule, publication, compatibility promise or external action changes.
- **Objective:** make the exact nine-rule generator slice independently testable while preserving
  separate replay identities and the valid-only meaning of `GenModule`.
- **Evidence:** the Phase 5 spec author could not observe reviewed seed authority through existing
  generic validators; operation and binding registries erase callable signatures; replay resolves
  rule-model and implementation revisions separately; `GenMemoryReadExpression` and
  `GenMemoryWriteStatement` encode correct arity while semantic IR validation rejects wrong types.
- **Decision:** an injected-byte factory returns an opaque suite; stateless typed handlers receive
  that suite explicitly. Invalid signatures are one structural argument-list delta over a valid
  baseline, not invalid nodes in the main IR.
- **Rejected alternatives:** a closure-based facade hides model state behind the implementation
  revision; direct raw tables make accepted review optional; the generic operation registry loses
  type safety; widening the main IR forces every valid consumer to handle malformed nodes; a
  second invalid IR/renderer duplicates precedence and scaffolding.
- **Strongest counterargument:** the explicit suite and wider invalid-case projection add more
  named contracts and a second predicate seam. This is narrower than merging replay identities or
  duplicating the IR, and keeps each proof boundary observable.
- **Confidence:** High — reopen if replay intentionally merges rule-model and handler identities,
  or if a required invalid contract cannot be expressed as one intrinsic argument-list delta.
- **Hardening:** an independent challenger proposed the adopted typed suite as a stronger fourth
  option, then separately converged on the structural invalid-source transform.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P28–AR-P29 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; invalid-case representation and
  generator metadata inside the already approved exact nine-rule slice. No frozen specification,
  product scope, publication or external compatibility promise changes.
- **Objective:** make every reviewed scalar neighbor executable and keep parameter boundary
  choices semantically distinct without weakening valid generator IR or reopening the Phase 4
  source grammar.
- **Evidence:** the accepted seed advertises numeric below/above and boolean wrong-type neighbors;
  valid typed literals reject those values; function parameters carry types but the independent IR
  has no call expression; Phase 6 owns composition and exact replay.
- **Decision:** non-parameter scalar invalid cases use one closed
  `scalar-expression-replace` source descriptor over a valid baseline; parameter invalid cases use
  the sibling `parameter-binding-replace` descriptor. Numeric replacements are exactly
  minimum-minus-one or maximum-plus-one; boolean wrong-type is canonical integer zero. Valid
  parameter cases retain one immutable `parameterBindings` value keyed by the canonical parameter
  path; source may match while semantic case metadata and later replay do not.
- **Rejected alternatives:** removing scalar neighbors or parameter cross-products contradicts the
  accepted seed and requires renewed review; invalid typed IR nodes weaken every valid consumer;
  adding call IR now reopens the closed renderer, inverse and budget vectors; a general invalid
  expression mini-IR creates a second shadow language.
- **Strongest counterargument:** parameter boundary source bytes remain identical. That is correct:
  the boundary is an invocation value, and it cannot count as executed evidence until a later
  adapter consumes the binding.
- **Confidence / hardening:** High. An independent challenger selected each design after comparing
  the viable alternatives. Reopen if Phase 6 cannot replay bindings exactly or if invalid rendering
  cannot resolve the canonical scalar-expression path.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P30 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal orchestration API,
  deterministic planning, performance preparation, replay and test-protocol design within the
  approved RD-02 acceptance criteria. No frozen specification, product scope, publication,
  external compatibility or deployment decision changes.
- **Objective:** let an implementation-blind oracle prove complete campaign generation and exact
  replay without repeating campaign-wide validation per case, hiding ambient fallback, dropping
  parameter bindings or making generation depend on call order.
- **Evidence:** the Phase 6 spec author identified six missing contract families; Phase 3 exposes
  exact revision resolution but no current fallback; Phase 5 exposes an opaque reviewed suite,
  three stateless generator handlers, structural invalid transforms and external parameter
  bindings; the existing 4,096-entry general collision registry is too small for a bounded
  100,000-case campaign; `caseCount` is the campaign total and `maxInvalidCases` is a ceiling.
- **Decision:** one immutable prepared-campaign capability validates exact dependencies and
  pre-proves its case-identity set. Plan items are lazy and random-access through fixed
  coverage-valid, random-valid and invalid path lanes. Mandatory spelling coverage consumes valid
  slots first; invalid slots use only the remainder up to the configured maximum. Each campaign
  binds exactly one generator handler, while separate campaigns cover frontend and runtime
  domains. Case rendering validates valid/binding-only source by independent round trip and
  source-transform invalid cases by independent parse plus exact transform-path evidence.
- **Rejected alternatives:** stateless per-case dependency assembly repeats validation and allows
  ordinary generation and replay to diverge; generic callbacks widen the identity boundary with
  behavior that is not closed by carried revisions; eager materialization of every plan item
  wastes memory; treating `maxInvalidCases` as additional required cases contradicts its name and
  the already validated `maxInvalidCases <= caseCount` invariant; a mixed-handler campaign cannot
  be represented by the approved singular generator identity.
- **Strongest counterargument:** an opaque prepared capability can conceal mutable caches.
  Mitigation: it has no cursor or ambient lookup, exposes closed plan/item metadata, precomputes
  collision evidence before publication and must pass repetition, permutation, concurrency and
  fresh-process equivalence.
- **Confidence / hardening:** High. The independent challenger converged on the prepared-campaign
  capability and added lazy planning, a 100,000-case bound, whole-campaign collision evidence and
  a closed child protocol. The final design corrected its proposed case-count interpretation to
  preserve the existing total/count ceiling contract. Reopen if one enabled rule set needs more
  than one generator identity, or if exact invalid rendering cannot produce independent
  transform-path evidence without sharing renderer policy.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P31 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal capability composition and
  test-fixture construction inside approved replay/freshness behavior. No product, frozen-spec,
  publication or compatibility decision changes.
- **Objective:** compose executable campaigns without creating a second raw-callable path around
  the exact dependency-byte proof already required for authoritative registration and replay.
- **Evidence:** AR-P21 restricts revision registration/replay to non-forgeable freshness-gated
  candidates; `registerFreshCandidateBinding` already produces the required capability;
  `createRevisionRegistry` validates that capability and retains only its verified binding; the
  first Phase 6 fixture instead supplied raw wrappers with invented revision labels.
- **Decision:** campaign creation takes the existing candidate-registration capability for both
  executable dependencies. Replay receives those capabilities through exact revision entries and
  uses only resolver-authorized bindings internally. A module-private suite predicate preserves
  the already immutable reviewed rule-model capability as one opaque registry value. Renderer and
  data values retain the existing exact-key registry behavior.
- **Rejected alternatives:** accepting a new closed raw wrapper makes freshness optional;
  test-only bypasses make the oracle prove a path production cannot use; re-deriving handler
  closures inside every replay repeats file authority and introduces filesystem dependence;
  publishing bindings early violates Phase 7 ordering.
- **Strongest counterargument:** fixture freshness metadata proves the fixture wrapper's declared
  dependency bytes, not the production handler's complete generated closure. That is deliberate:
  Phase 5 independently proves the production closure, while Phase 6 tests capability enforcement
  and orchestration without duplicating that oracle.
- **Confidence / hardening:** High — this reuses the sole existing non-forgeable seam and removes,
  rather than adds, authority paths. Reopen if revision resolution can expose a binding that did
  not enter through a fresh registration, or if preserving the suite capability requires
  weakening its factory brand.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P32–AR-P33 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; private replay preparation and
  bounded campaign-accounting architecture inside the already approved exact-replay behavior.
- **Objective:** remove campaign-size work from one-case replay and retire repeated construction
  accounting without weakening collision proof, exact identity, freshness or independent parsing.
- **Evidence:** the Phase 6 performance audit measured seconds of repeated 100,000-case collision
  proof per replay and found seven usage snapshots plus repeated IR validation/recount per case.
  The replay envelope carries one case identity but no independently verifiable global uniqueness
  proof. The modeled domain is finite and already closed behind a factory-produced suite.
- **Decision:** distinguish a public, globally collision-proven campaign from a private,
  target-validated replay capability. Prepare finite construction templates and their usage behind
  the suite capability, while preserving full fallback validation for arbitrary handler output.
- **Rejected alternatives:** an ambient proof cache breaks fresh-process isolation; a Merkle root
  does not prove leaf uniqueness; a signed or succinct proof changes the v1 trust/schema model;
  merely mutating the budget tracker still repeats construction and IR walks; whole-case memoization
  risks ordinal growth and misleading callable provenance; a batch generator widens the immutable
  public contract.
- **Strongest counterargument:** a strict reading could require every replay to re-prove global
  campaign uniqueness. The current envelope cannot establish that sublinearly. Public campaign
  creation therefore retains the global proof, while replay proves exact membership and complete
  identity for the carried target without claiming to have prepared the whole campaign.
- **Confidence / hardening:** High. An independent challenger converged after evaluating persistent
  caches, proof certificates, succinct proofs, tracker-only changes, whole-case memoization and a
  batch API. Reopen if replay becomes an authority for first-time campaign publication or if the
  modeled domain ceases to be finitely preparable.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P34 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal version-authority
  semantics needed to close a runtime remediation without changing the frozen specification.
- **Evidence:** immutable campaign and identity oracles use `rule-model-v1`, while the reviewed
  manifest's closed `registryVersion` is `rule-models-v1`. Replay selects exact content by digest.
- **Decision:** retain protocol version, manifest release version and exact content digest as
  three separately named suite facts. Protocol and digest must match campaign authority; the
  digest must match the revision-registry key.
- **Rejected alternatives:** equating both version fields contradicts the immutable oracle and
  reviewed manifest; accepting arbitrary aliases makes the compatibility field meaningless.
- **Confidence / hardening:** High. An independent challenger verified the wire fixtures, identity
  primitive, manifest model and digest-based resolver. Reopen only if a protocol revision changes
  the suite/generator contract independently of a manifest release.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P35 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; replay compatibility
  classification inside the frozen Phase 6 behavior.
- **Evidence:** the immutable missing-rule-model case intentionally stores the real suite under a
  different, nonrequested revision so it can prove that replay does not fall back. Rejecting the
  alternate at registry construction prevents that required scenario, while resolved-content
  validation still closes the false-authority exploit.
- **Decision:** registry construction and its raw `resolve` method are compatibility-set storage
  and lookup. Exported `resolveReplayRevisions` establishes authority only for the exact resolved
  component after key/content/protocol comparison; `replayCase` retains defense-in-depth checks.
- **Rejected alternative:** rejecting all nonmatching stored alternatives contradicts the
  immutable oracle and conflates storage closure with exact replay authorization.
- **Confidence / hardening:** High. The earlier semantics review required individual
  resolved-component classification and permitted registry-time rejection only where possible.
  A post-remediation independent adjudicator found the registry-time remedy incompatible with the
  immutable no-fallback oracle, but identified and closed the narrower exported-resolver gap.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P36 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; internal persistence, capability,
  wire, validation, resource-bound and CLI design inside the approved atomic-publication scope.
- **Objective:** give the immutable Phase 7 oracle a closed surface without exposing any operation
  that can select unreviewed, unsynced or untested publication bytes.
- **Evidence:** 03-05 fixed the content-addressed layout and pointer ordering but omitted callable
  shapes, wire fields, caps, fault boundaries and CLI results. Existing code already has a
  freshness capability, exact candidate/published validators, shared generation lock and
  file-sync primitive, but its nominal `PublishedSnapshot` still exposes bindings directly.
- **Decision:** expose review preparation, one transaction and opaque resolution/read APIs. Keep
  write/promote/snapshot operations private and use a non-package conformance seam for deterministic
  crash, collision and unsupported-durability tests. Freeze the schemas, limits, digest encoding,
  handler matrix and CLI protocol in 03-05.
- **Rejected alternatives:** public stage/build/promote primitives allow ordering bypass; trusting
  a prepared capability permits stale inputs; serializing functions is non-portable; silently
  degrading directory sync makes the crash-durability claim false.
- **Strongest counterargument:** one transaction makes fault testing and isolated staging broader.
  The private conformance seam supplies exact fault points without becoming a production bypass.
- **Confidence / hardening:** High. An independent challenger grounded the design in the existing
  lock, writer, binding validator, review evidence, authority loader and CLI, and converged from a
  larger low-level API to the smaller transaction boundary.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P37 user-resolution provenance

- **Authority:** explicit user authorization on 2026-07-26 for Option C and the corresponding
  immutable-oracle correction.
- **Evidence:** freshness validation binds dependency bytes, revision and contract but has no
  callable input. Generic registration accepted any function carrying those claims, and the
  resolver joined serialized bindings back to caller-supplied candidates by metadata alone.
- **Decision:** publication APIs accept only a canonical repository root and review evidence.
  They reconstruct executable authority internally from the package-owned catalog and an explicit
  four-handler version-one profile. Campaign and replay retain generic freshness registrations.
- **Rejected alternatives:** function-reference checks in publication duplicate catalog authority
  while preserving a misleading generic API; another process-local publication brand retains
  caller-controlled candidate transport and widens the capability surface.
- **Confidence / hardening:** High. The independent challenger selected the same design and added
  the explicit versioned profile so future catalog growth cannot silently widen publication.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P38 user-resolution provenance

- **Authority:** explicit user authorization on 2026-07-26 for Option B and the corresponding
  immutable-oracle correction.
- **Evidence:** the transaction already validates every staged member, digest, authority artifact,
  binding join and published-state invariant through the isolated resolver. Running the publication
  specification recursively from that transaction would invoke the transaction again and would
  add Vitest/build tooling to production.
- **Decision:** runtime acceptance means isolated staged invariant validation. The complete
  ST-01–ST-40 suite is a CodeOps workflow gate on the exact unchanged tree immediately before the
  one real transaction. The tree revision and green result are recorded as execution evidence.
- **Rejected alternatives:** private stage/commit orchestration adds cross-process state, new crash
  boundaries and bypass primitives; a purpose-built runtime test subset is not the complete suite;
  unsigned acceptance evidence is forgeable, while signed attestations are disproportionate here.
- **Confidence / hardening:** High. An independent challenger reconciled the existing indivisible
  API, the resolver's complete invariant validation and the execution plan's pre-publication ST
  task without weakening runtime validation.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P39 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; mechanical oracle alignment within
  the already user-approved Phase 7 four-command protocol.
- **Evidence:** the older repository-command oracle still sent loose-projection checks through
  `check`, while AR-P38 and 03-05 reserve `check` for the selected publication and name
  `source-check` as the non-authoritative loose-projection check.
- **Decision:** a specification-test author changed only the obsolete command names in
  `readiness-command.spec.test.ts`; implementation tests exercising the same internal boundary were
  aligned separately. All assertions and failure expectations remain unchanged.
- **Rejected alternative:** falling back from `check` to loose source when no pointer exists would
  silently restore split authority and contradict the accepted publication boundary.
- **Confidence / hardening:** High. The bounded spec-author diff changed no assertion and its
  focused immutable oracle passed 3/3.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-20260724-01`.

### AR-P40 user-resolution provenance

- **Authority:** explicit user authorization on 2026-07-26 with `--auto-design --auto-commit`.
- **Decision:** baseline tree `7de5559b753e89927aef989ba4692232a8b46a6a` makes the existing
  requirements-derived specification tests immutable for remediation review. RV-002–RV-006 must
  be fixed; no finding or risk is waived.
- **Reopen triggers:** any remediation edit to `*.spec.test.*`, any skipped major finding, or any
  review diff not rooted at the authorized baseline.

### AR-P41 delegated-resolution provenance

- **Authority / eligibility:** AI, delegated by `--auto-design`; portable internal filesystem,
  recovery, validation and boundary-test mechanisms inside the already approved publication
  behavior and exact wire layout.
- **Objective:** prevent pre-existing path substitution and unbounded collision reads, preserve
  the sole pointer commit, and make release durability true across fresh creation and crash retry.
- **Evidence:** Node 22 exposes handle `stat`, directory sync and `O_NOFOLLOW` on supporting hosts
  but has no portable `openat`/`renameat`; the resolver already uses bounded handle reads; the
  current writer recursively creates path components, omits reuse sync and authorizes boundary
  owners by basename.
- **Decision:** select portable A+ as recorded in the register. The guarantee is fail-closed
  detection before pointer commit; portable Node cannot promise zero out-of-tree side effects
  against a hostile same-user parent swap during the path-based syscall window.
- **Rejected alternatives:** `/proc/self/fd` anchoring is Linux/procfs-specific; a single bundle
  breaks the accepted seven-member layout without removing pointer-parent races; dual Linux and
  portable backends double a security-critical implementation for a threat model not required by
  the plan.
- **Strongest counterargument:** identity rechecks can detect but cannot undo an operation
  redirected during one syscall window. If hostile concurrent same-user mutation becomes an
  explicit containment requirement, portable path-based Node is insufficient.
- **Confidence / hardening:** High. An independent challenger selected A+ with required bigint
  identity pinning, bounded enumeration, exact-size handle reads and honest residual guarantees.
- **Policy / invocation:** policy version 1; root invocation
  `compiler-readiness-rd02-recovery-20260726-01`.
- **Reopen triggers:** a hostile concurrent same-user containment requirement, portable
  `openat`/`renameat` support in Node, or evidence that device/inode identities are unavailable on
  a supported publication host.

## Systematic Gate Scan

| Category | Result |
|---|---|
| Feature and behavioral gaps | Generator/model/binding/replay workflows closed by AR-P1–AR-P10 |
| Scope | First subset and exclusions fixed by AR-P1 |
| Technical unknowns | IR, PRNG, identities, inverse and publication resolved |
| Edge cases | Empty/unavailable/collision/overflow/limit states resolved |
| Integration | RD-01 authority and future RD-03/RD-04 boundaries explicit |
| Data and state | Manifest, registry, identity and publication ownership explicit |
| Security | Closed bounded parsing and path rejection explicit |
| Non-functional | Determinism, replay and budgets explicit |
| UX/presentation | Typed results and stable IDs; no end-user UI introduced |
| Stakeholder conflicts | Frozen spec authority and modern-source ergonomics preserved |
| Naming and terminology | Public type/module terms fixed by AR-P2–AR-P11 |
