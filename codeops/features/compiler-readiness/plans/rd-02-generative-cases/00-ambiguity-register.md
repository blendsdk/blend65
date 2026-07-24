# Ambiguity Register: RD-02 Typed Generative Cases and Deterministic Replay

> **Status**: ✅ GATE PASSED — all 25 items resolved
> **Last Updated**: 2026-07-25 01:15 UTC
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
