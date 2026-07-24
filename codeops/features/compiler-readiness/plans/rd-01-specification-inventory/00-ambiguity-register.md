# Ambiguity Register: RD-01 Specification Inventory and Rule Schema (plan)

> **Status**: ✅ GATE PASSED — all 21 items resolved
> **Last Updated**: 2026-07-24 01:35
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd01-plan-20260723-01`
> **Scope**: Plan-level implementation decisions only. The owning RD and the requirements
> ambiguity register retain product scope, acceptance behavior and C64-v3.0 targeting.

The planning target is `compiler-readiness/RD-01`. The context set includes the complete
compiler-readiness requirement set, its RD-01 preflight, the frozen specification, repository
manifests, existing validation/test patterns and downstream RD contracts. The modification set is
this plan folder, RD-01 plan traceability nodes and deterministic roadmap lifecycle fields. No
requirement, sibling plan, compiler implementation or frozen specification file is in the
modification set.

| # | Category | Ambiguity / Gap | Options Presented | Decision / Authority | Status |
|---|---|---|---|---|---|
| AR-P1 | Scope | Does the plan populate the complete C64 v3.0 denominator or only build inventory tooling? | (A) tooling plus the complete manifest, clause ledger and rule inventory; (B) tooling only, deferring population | **A** — the RD's denominator does not exist until the authoritative inventory is populated and validated | ✅ Resolved |
| AR-P2 | Technical | Where should reusable readiness code live? | (A) a new private `@blend65/readiness` workspace; (B) `@blend65/test-harness`; (C) root scripts only | **A** — dedicated compiler/toolchain-independent domain boundary, with allowlisted validation dependencies and repository data under `readiness/` | ✅ Resolved |
| AR-P3 | Data & state | Where do authoritative and generated artifacts live? | (A) root `readiness/` with `schema/`, `inventory/`, `conformance/`, and `generated/`; (B) package source; (C) `docs/` | **A** — separates durable data from executable code and marks generated Markdown non-authoritative | ✅ Resolved |
| AR-P4 | Technical | How are duplicate JSON keys preserved for rejection before ordinary parsing erases them? | (A) inspect a `jsonc-parser` syntax tree, reject comments/trailing commas and duplicates, then materialize; (B) write a JSON parser; (C) accept `JSON.parse` loss | **A** — reuse a declared parser dependency while retaining exact property occurrences | ✅ Resolved |
| AR-P5 | Technical | How are JSON Schema and semantic validation divided? | (A) committed draft-2020-12 schema compiled by explicit Ajv v8, followed by ordered semantic passes; (B) custom validation only; (C) schema-only | **A** — portable local constraints plus TypeScript-owned relational checks, exposed through one result model and command | ✅ Resolved |
| AR-P6 | Technical | How are Markdown/EBNF fragments derived with stable byte spans? | (A) a versioned, purpose-built byte-oriented scanner over UTF-8/LF source; (B) a general Markdown AST and inferred offsets; (C) hand-authored fragments | **A** — the RD's total non-overlapping byte-span contract needs a smaller explicit grammar than a renderer-oriented AST | ✅ Resolved |
| AR-P7 | Behavioral | What ordering and failure contract does the validation command use? | (A) parse/limits → schema → source/fragment → declarations → conflicts/ledger → graph/projection → evolution, returning all deterministically sortable diagnostics and no partial outputs; (B) fail-fast | **A** — deterministic complete diagnostics, with unsafe source access and unsupported versions rejected before later phases | ✅ Resolved |
| AR-P8 | Data & state | How are identifiers and source identity stabilized? | (A) human-assigned allowlisted rule IDs plus hash-based fragment/source identity and explicit lineage; (B) derive all rule IDs from source hashes | **A** — source edits can invalidate evidence without silently changing semantic rule identity | ✅ Resolved |
| AR-P9 | Integration | How are RD-02–RD-04 handlers and evidence routes represented before implementations exist? | (A) generated TypeScript declaration unions and contract records with explicit `unbound` state; (B) placeholders that count as bound; (C) free-form strings | **A** — compile-time exhaustiveness for bounded declaration identities without falsely claiming executable readiness; semantic rule IDs remain branded and runtime-validated | ✅ Resolved |
| AR-P10 | Data & migration | What version-evolution surface ships in v1? | (A) strict version dispatcher, migration registry/interface, atomic writer abstraction and deterministic invalidation report, with no v2 migrator; (B) speculative v2 migration; (C) reject-only reader | **A** — proves the upgrade boundary without inventing a future format; RD-07 remains the gate owner | ✅ Resolved |
| AR-P11 | Security & non-functional | Which concrete bounds and hostile-input controls govern v1? | (A) named constants enforced before allocation/traversal, canonical real paths beneath `spec/`, no symlink escape, Markdown escaping and safe relative links; (B) rely on repository trust | **A** — inventory data is hostile by RD contract and boundary tests need one executable policy | ✅ Resolved |
| AR-P12 | Testing & process | What verification and execution structure governs the work? | (A) five specification-first phases, targeted red/green checks per phase, Prettier on touched files and the full AGENTS.md verify at every phase close; (B) one monolithic phase | **A** — isolates infrastructure, fragmentation, semantics, population and evolution/docs while preserving one CI-equivalent close gate | ✅ Resolved |
| AR-P13 | Technical (runtime) | How can the approved plan enter execution when the graph requires child-node execution snapshots but the transition API rejects execution-gate child targets? | (A) deterministically backfill only the missing execution snapshots in the approved graph, then validate and rerun readiness; (B) bypass the execution gate | **A** — preserve the gate and repair its evidence after the user approved the exact traceability scope expansion | ✅ Resolved |
| AR-P14 | Technical (runtime) | What exact closed v1 object surface and resource-limit names can requirements-derived Phase-1 tests target? | (A) freeze the smallest explicit aggregate/registry/rule/citation shapes and one named limits object that supports every approved downstream phase; (B) let tests infer fields from implementation | **A** — specification tests require an independent public contract before implementation exists | ✅ Resolved |
| AR-P15 | Testing (runtime) | Should the depth oracle identify a not-yet-visited child value or the container rejected immediately at the safety boundary? | (A) identify the rejected container and abort in its begin callback; (B) enter the excessive container to discover a deeper child path | **A** — immediate rejection prevents parser-stack exhaustion; the requirements promise an input-phase failure, not speculative child traversal | ✅ Resolved |
| AR-P16 | Security (runtime) | How can in-memory validation remain bounded without rejecting inventories that are legal under the published byte and collection caps? | (A) derive the traversal ceiling from `maxInputBytes` and detect only ancestor cycles; (B) keep an unrelated lower aggregate ceiling; (C) remove traversal bounds | **A** — every serialized JSON value consumes at least one input byte, so the published byte cap is a safe compatible ceiling while ancestor tracking accepts shared acyclic values | ✅ Resolved |
| AR-P17 | Technical (runtime) | What exact normalization, fragment identity, hierarchy and public API can independent Phase-2 byte vectors target? | (A) strict UTF-8 with hash-only BOM/newline/NFC normalization, hierarchical container/child spans, domain-separated length-framed 160-bit IDs and one mandatory-policy API; (B) delimiter/JSON IDs with flat overlapping spans and exported policy helpers; (C) raw-byte hashes and offset-derived IDs | **A** — it preserves raw authority, portable content identity, total non-overlapping coverage at each tree level and one composable source-validation policy | ✅ Resolved |
| AR-P18 | Technical (runtime) | Which exact bytes belong to headings, list items, table cells, EBNF productions, paragraphs and residual fragments? | (A) freeze the bounded line-oriented grammar and parent/child delimiter ownership in `03-02`; (B) defer offsets to implementation | **A** — literal independent vectors require one scanner grammar before implementation, including recognizer precedence and newline ownership | ✅ Resolved |
| AR-P19 | Technical (runtime) | What exact Phase-3 API, identity-event chain and authored-vs-derived boundary can independent semantic tests target? | (A) freeze pure validators over an explicit context, fixed-order hash-chained JSONL identity events, authored conflict/projection records and one composed validator; (B) let tests infer module signatures and ledger framing from implementation; (C) synthesize conflicts and target children from prose | **A** — immutable tests need literal events and outputs while reviewed semantic classifications and stable IDs must remain authored authority | ✅ Resolved |
| AR-P20 | Technical (runtime) | What exact context makes semantic-review evidence a closed enforceable gate? | (A) require expected spec revision, required unit IDs and current digests; reject missing/extra/duplicate/blocked/wrong-revision records and empty reviewers; (B) validate only whatever records happen to be supplied | **A** — review evidence cannot prove completeness or acceptance without an explicit expected set and revision | ✅ Resolved |
| AR-P21 | Technical (runtime) | How does review evidence prove each unit's dependency-digest set is closed? | (A) context supplies lexical unique required dependency IDs per required unit and records must match exactly; (B) trust dependency keys volunteered by records | **A** — omitted dependency classes otherwise never become stale | ✅ Resolved |
| AR-P23 | Technical (runtime) | What exact public Phase-5 contract can immutable projection, migration, publication and command tests target? | (A) freeze small result-based render/freshness/version/command APIs, fixed repository paths, test-only migration/publication seams and digest-based mixed-pair repair; (B) test the CLI only; (C) expose filesystem implementation details | **A — AI delegated by `--auto-design`**: it keeps the oracle independent while acknowledging that two file renames cannot be crash-atomic as one transaction | ✅ Resolved |
| AR-P24 | Testing (runtime) | How should the non-mutating command oracle compare repeated 7.3 MB authority snapshots without Vitest recursively expanding every byte? | (A) compare SHA-256 snapshots for each fixed artifact; (B) raise time/memory until raw-array deep equality completes | **A — AI delegated by `--auto-design`**: cryptographic byte snapshots preserve the exact oracle while bounding diagnostic work | ✅ Resolved |

## Resolution Notes

### AR-P1 — complete denominator

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** implementation sequencing inside the confirmed RD scope
- **Objective:** finish RD-01 with a usable denominator for RD-02 through RD-07
- **Evidence:** RD-01 requires both tooling and “every mandatory C64 v3.0 rule,” plus an exhaustive
  ledger (`RD-01:20-52,149-192`)
- **Rejected alternative:** tooling-only would pass code tests while leaving the RD's primary
  artifact and downstream denominator absent
- **Strongest counterargument:** full inventory authoring is large and review-intensive; phase it
  by source group and require mechanical ledger closure rather than weakening scope
- **Confidence:** High
- **Hardening:** in-context constraint and failure analysis; architecture challenger reviewed the
  enclosing phase design
- **Policy version:** 1
- **Reopen triggers:** the RD is formally split into separate tooling and population requirements

### AR-P2 — dedicated private workspace

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal architecture and module boundary
- **Objective:** give all later readiness RDs a stable API without coupling it to compiler or
  parity-test implementation
- **Evidence:** the monorepo discovers `packages/*` workspaces (`package.json:10-12`);
  `@blend65/test-harness` is publishable and already depends on the compiler
  (`packages/test-harness/package.json:13-21`), while RD-02 requires an independent generator
  boundary
- **Rejected alternatives:** test-harness ownership couples authoritative rule identity to an
  evidence consumer; root-only scripts provide no typed import boundary
- **Strongest counterargument:** an eleventh package adds manifests and build plumbing; that cost is
  smaller than allowing downstream readiness components to depend on a public compiler harness
- **Confidence:** High
- **Hardening:** blind independent challenger converged on A, refined as a private typed workspace
  plus root authority directory; it also converged on the parser, schema, fragmenter and five-phase
  sequence. Strongest objection was the eleventh-workspace/build-before-CLI overhead, outweighed by
  the stable API required by RD-02 through RD-07.
- **Policy version:** 1
- **Reopen triggers:** the workspace boundary cannot remain compiler-independent, an allowlisted
  validation dependency creates compiler coupling, or the repository adopts a single tooling package

### AR-P3 — root artifact layout

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal data organization
- **Objective:** make authority, generated projections and conformance fixtures visibly distinct
- **Evidence:** the RD says JSON is authoritative and generated Markdown is not
  (`RD-01:34,51-52`); package builds emit `dist/`, so durable evidence should not live beside
  generated JavaScript
- **Rejected alternatives:** package-source data blurs distribution and authority; `docs/` would
  misleadingly make the human projection look primary
- **Strongest counterargument:** a second root adds navigation; a README and the validation command
  make the boundary explicit
- **Confidence:** High
- **Hardening:** in-context comparison and downstream-consumer review
- **Policy version:** 1
- **Reopen triggers:** repository policy requires all machine-readable evidence to ship inside one
  package

### AR-P4 — lossless JSON intake

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** parsing and validation mechanism
- **Objective:** reject duplicate keys before conversion can discard evidence
- **Evidence:** AC-2 explicitly requires duplicate-key rejection (`RD-01:151-152`), and
  `jsonc-parser` is already locked in the repository while ordinary `JSON.parse` cannot retain
  duplicate property occurrences
- **Rejected alternatives:** a new parser duplicates security-sensitive syntax work; `JSON.parse`
  makes the acceptance criterion impossible
- **Strongest counterargument:** `jsonc-parser` accepts JSONC features; the intake layer must
  explicitly reject comments, trailing commas and parse errors so the accepted language remains
  strict JSON
- **Confidence:** High
- **Hardening:** adversarial-input and dependency-surface review
- **Policy version:** 1
- **Reopen triggers:** the parser cannot expose duplicate property nodes or strict-JSON rejection
  becomes unreliable

### AR-P5 — two validation layers

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** validation architecture
- **Objective:** make local shape portable and relational semantics deterministic
- **Evidence:** RD-01 assigns this exact split (`RD-01:62-64`); cross-array uniqueness, source
  resolution and graph cycles are not ordinary JSON Schema constraints
- **Rejected alternatives:** custom-only loses the committed portable schema; schema-only cannot
  satisfy AC-2, AC-8 or AC-13
- **Strongest counterargument:** two layers may drift; shared typed decoding fixtures and one
  ordered diagnostic API exercise them together
- **Confidence:** Very high
- **Hardening:** preflight resolution PF-006 already independently challenged and converged
- **Policy version:** 1
- **Reopen triggers:** Ajv cannot enforce the selected schema draft under Node 22 or schema/type
  parity cannot be tested

### AR-P6 — byte-oriented fragmentation

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** compiler-like parsing algorithm
- **Objective:** derive reproducible, total, non-overlapping source spans independent of a Markdown
  renderer
- **Evidence:** the required nodes and residual-span behavior are closed at `RD-01:107-110`, and
  AC-6 requires byte-for-byte independent vectors (`RD-01:162-164`)
- **Rejected alternatives:** a renderer AST may normalize or omit trivia; hand-authored fragments
  cannot prove exhaustive discovery
- **Strongest counterargument:** purpose-built Markdown handling can grow into a partial parser;
  its grammar is deliberately limited to the versioned node kinds and treats everything else as
  residual non-whitespace spans
- **Confidence:** High
- **Hardening:** compiler/language lens plus malformed-input counterexamples
- **Policy version:** 1
- **Reopen triggers:** a normative construct cannot be represented without interpreting full
  CommonMark semantics

### AR-P7 — diagnostic accumulation and ordering

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** failure and recovery design
- **Objective:** produce stable, useful failures without performing unsafe or semantically invalid
  later work
- **Evidence:** the RD requires one ordered diagnostic model (`RD-01:62-64`) and rejects unsafe
  paths before escaped access (`RD-01:167-169`)
- **Rejected alternative:** fail-fast hides independent omissions and makes inventory repair
  unnecessarily serial
- **Strongest counterargument:** accumulation can cascade noise; each phase runs only when its
  prerequisites are valid, and diagnostics sort by phase/code/path/location
- **Confidence:** High
- **Hardening:** failure-cascade and determinism review
- **Policy version:** 1
- **Reopen triggers:** accumulated errors cannot be separated from cascades deterministically

### AR-P8 — stable semantic IDs

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** identity and data-evolution mechanism
- **Objective:** preserve semantic identity while detecting source drift
- **Evidence:** RD-01 separately requires stable rule IDs, content hashes and lineage
  (`RD-01:32-39,85-99,107-114`)
- **Rejected alternative:** hash-derived rule IDs turn every wording edit into delete-and-create
  and defeat split/merge history
- **Strongest counterargument:** human IDs can be reassigned incorrectly; retired-ID and lineage
  validation makes reuse an explicit failure
- **Confidence:** Very high
- **Hardening:** data/migration lens and replay-history analysis
- **Policy version:** 1
- **Reopen triggers:** an external registry becomes the authoritative allocator of rule IDs

### AR-P9 — declarations before bindings

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal interface and dependency sequencing
- **Objective:** let later RDs bind implementations without creating false readiness
- **Evidence:** RD-01 owns declarations while RD-02/RD-03/RD-04 own bindings
  (`RD-01:48-50,101-105`)
- **Rejected alternatives:** bound placeholders make unavailable evidence appear usable; free-form
  declaration strings lose compile-time exhaustiveness. Generating unions for the potentially large
  semantic rule set was rejected in favor of branded runtime-validated rule IDs.
- **Strongest counterargument:** generated unions can drift from JSON; the generated declaration
  module has an explicit owner, output path, barrel export and post-population freshness gate
- **Confidence:** Very high
- **Hardening:** preflight PF-005/PF-007 resolution already challenged
- **Policy version:** 1
- **Reopen triggers:** downstream handlers need richer contracts than v1 declarations can express
  or measured declaration-union size becomes impractical

### AR-P10 — v1 evolution boundary

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** reversible migration architecture
- **Objective:** make the first future upgrade safe without speculating about its transformation
- **Evidence:** RD-01 requires dispatch, an interface, invalidation shape and a current RD-07 gate
  before upgrades (`RD-01:116-121,190-192`)
- **Rejected alternatives:** a speculative v2 encodes unknown semantics; reject-only has no
  failure-atomic migration seam to test
- **Strongest counterargument:** an interface with no migration can become ceremonial; injected
  writer failure and a test-only migration prove its atomicity and invalidation contract
- **Confidence:** High
- **Hardening:** data/migration failure and rollback review
- **Policy version:** 1
- **Reopen triggers:** RD-07 changes the gate record or migration-chain semantics

### AR-P11 — hostile-input policy

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** security mechanism inside the approved offline policy
- **Objective:** keep repository data from escaping roots, exhausting validation or injecting
  generated Markdown
- **Evidence:** the RD mandates canonicalization, symlink rejection, bounds and output escaping
  (`RD-01:138-145`)
- **Rejected alternative:** repository trust contradicts the explicit hostile-data requirement and
  omits AC-8, AC-16 and AC-17
- **Strongest counterargument:** exact numeric caps are policy-like; define exported v1 constants
  sized above the frozen corpus and change them only through inventory-version review
- **Confidence:** High
- **Hardening:** security and resource-exhaustion review
- **Policy version:** 1
- **Reopen triggers:** the frozen corpus exceeds a cap or readiness becomes a network service

### AR-P12 — five specification-first phases

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** testing strategy and implementation sequencing
- **Objective:** keep each change reviewable while preserving immutable specification oracles
- **Evidence:** AGENTS.md defines the full verify and separate `.spec.test.ts`/`.impl.test.ts`
  tiers; the RD has five cohesive risk clusters and eighteen acceptance criteria
- **Rejected alternative:** one phase exceeds the project's reviewable-change limits and delays
  feedback until authoritative data and mechanisms are entangled
- **Strongest counterargument:** phase boundaries add repeated full verification; that repetition is
  appropriate for an artifact that all later readiness claims trust
- **Confidence:** High
- **Hardening:** task-granularity, dependency and CI-equivalence review
- **Policy version:** 1
- **Reopen triggers:** execution discovers a phase cannot close green without consuming a later
  phase's behavior

### AR-P13 — execution snapshot repair

- **Authority:** AI — delegated by `--auto-design` after explicit user approval to modify
  `codeops/features/compiler-readiness/traceability.json`
- **Eligibility:** reversible workflow-state repair inside the approved RD-01 execution scope
- **Objective:** satisfy the mandatory execution-entry gate without weakening or bypassing it
- **Evidence:** the gate reported 24 missing snapshots, while the public transition command
  rejected the first required criterion refresh because the execution gate accepts only plan
  targets
- **Rejected alternative:** bypassing readiness would discard the semantic-drift protection that
  the graph is intended to provide
- **Strongest counterargument:** direct graph repair does not use the transition journal; the
  change is limited to deterministic validation records and is followed by schema validation,
  execution readiness and Git review
- **Confidence:** High — reconsider if the transition interface gains an atomic plan-closure
  snapshot refresh
- **Hardening:** dependency-order analysis showed no public transition sequence can start because
  every required child refresh is target-incompatible
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** graph validation fails, readiness still reports a missing/stale snapshot,
  or any semantic revision differs from the approved preflight graph

### AR-P14 — closed v1 test contract

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal data-contract and resource-limit design inside approved RD-01 behavior
- **Objective:** let independent tests define the immutable v1 boundary before implementation
- **Evidence:** ST-1–ST-3 require exact required/unknown-field behavior and ST-6 requires named
  exact limits, but the preflighted plan described both only narratively
- **Rejected alternative:** implementation-derived fixtures would make the specification tests
  tautological and violate the repository's immutable-oracle rule
- **Strongest counterargument:** freezing fields early increases migration cost; closed versioned
  objects and the existing evolution seam make that cost explicit instead of accidental
- **Confidence:** High — reconsider only if a requirements-level field cannot be represented by
  the recorded discriminated unions
- **Hardening:** the contract was checked against source, ledger, declaration, graph, projection
  and migration consumers; optional empty collections preserve a small minimal fixture
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** a later phase needs semantic authority that cannot be encoded without an
  additive v1 field or the frozen corpus exceeds a recorded cap

### AR-P15 — immediate depth rejection

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** hostile-input failure mechanism and test precision within the approved depth cap
- **Objective:** reject excessive nesting before the parser enters attacker-controlled containers
- **Evidence:** phase review reproduced a 10,000-array input throwing `RangeError`; the original
  oracle demanded the path of a child that cannot safely be visited
- **Rejected alternative:** delaying rejection until a property, literal or closing delimiter
  preserves a deeper path but allows container-only nesting to overflow the parser stack
- **Strongest counterargument:** the diagnostic path becomes the excessive container rather than
  its prospective child; that is the exact value the validator actually rejected
- **Confidence:** High
- **Hardening:** independent correctness and security reviews converged on begin-callback rejection
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** the parser supplies a bounded non-recursive traversal that can safely report
  a more specific path without entering the excessive container

### AR-P16 — contract-compatible traversal bound

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal resource-safety mechanism within the approved published v1 limits
- **Objective:** bound hostile in-memory traversal without introducing a hidden stricter contract
- **Evidence:** re-review reproduced a valid 14,000-rule inventory rejected by the fixed 262,144
  value ceiling; every value in authoritative JSON consumes at least one input byte
- **Rejected alternatives:** the unrelated fixed ceiling contradicted the published collection
  limits; removing the traversal ceiling would leave direct in-memory callers exposed
- **Strongest counterargument:** direct callers can construct graphs that were never serialized;
  the same ceiling deliberately applies the authoritative byte-budget invariant to that seam
- **Confidence:** High — reopen if a supported non-JSON producer needs a separately governed budget
- **Hardening:** independent re-review rejected the fixed ceiling; a 14,000-rule valid regression,
  exact boundary fixtures and cycle tests cover the corrected mechanism
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** the authoritative input format changes or a legal serialized inventory can
  exceed the derived traversal ceiling

### AR-P17 — independent fragmentation contract

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** parsing, hashing, internal interface and testability mechanisms within approved
  fragmentation, source-safety and ledger behavior
- **Objective:** let immutable tests compute exact hashes, IDs, spans and source outcomes without
  importing production policy
- **Evidence:** the spec author could not write ST-8 literals because normalization, serialization
  and signatures were narrative only; flat row/cell and fence/production spans also contradict
  global non-overlap
- **Rejected alternatives:** delimiter or canonical-JSON framing adds escaping/version ambiguity;
  raw hashes lose approved newline/BOM portability; offset IDs churn after unrelated preceding
  edits; exporting policy helpers permits later phases to compose a second validator
- **Strongest counterargument:** NFC intentionally gives canonically equivalent Unicode the same
  hash and identical repeated fragments use a local occurrence ordinal; raw spans still distinguish
  bytes, and the ordinal churn is narrower than offset-derived identity
- **Confidence:** High — reopen if the frozen corpus contains canonically distinct Unicode that
  must retain different semantic hashes or a required construct cannot fit the fragment hierarchy
- **Hardening:** blind challenger identified identical-fragment collisions and the container/child
  overlap contradiction; both are closed by occurrence ordinals and parent IDs
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** measured collision/identity instability, cross-platform path divergence, or
  a Phase-3 consumer needing policy not expressible through `validateInventorySources`

### AR-P18 — scanner byte ownership

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** compiler-like scanner grammar inside the approved supported node kinds
- **Objective:** make every expected byte offset independently computable and preserve total
  non-whitespace coverage without overlap at one hierarchy level
- **Evidence:** the spec author identified five offset-changing gaps after identity closure:
  terminators, heading ancestry, delimiters, fence ownership and paragraph/residual precedence
- **Rejected alternative:** implementation-selected boundaries would make ST-8 a tautology and
  allow scanner behavior to drift without changing the oracle
- **Strongest counterargument:** a purpose-built grammar will not implement all CommonMark edge
  cases; unsupported syntax is deliberately residual, keeping loss visible rather than guessed
- **Confidence:** High — reopen on an unrepresentable frozen-spec construct, not renderer parity
- **Hardening:** the hierarchy and precedence were checked against nested row/cell and
  fence/production overlap plus malformed/unterminated inputs
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** an independent vector exposes overlapping peers, lost non-whitespace bytes
  or an ambiguous recognizer at the same precedence

### AR-P19 — semantic validation and identity-chain contract

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal validation APIs, deterministic serialization and authored/derived
  boundaries within the approved Phase-3 behavior
- **Objective:** let the independent spec author construct literal ledger, conflict, declaration
  and graph fixtures before implementation
- **Evidence:** the Phase-3 spec author stopped because no validator signatures, identity JSONL
  record, genesis value, hash framing or conflict/projection ownership boundary was defined
- **Rejected alternatives:** implementation-derived APIs make the oracle circular; synthesized
  natural-language conflicts exceed mechanical authority; generated target IDs undermine the
  approved append-only identity ledger
- **Strongest counterargument:** authored target children are more verbose than synthesizing them,
  but they preserve reviewability, stable IDs and explicit source citations while projection
  validation remains deterministic
- **Confidence:** High — reopen if a literal Phase-3 fixture cannot be expressed without production
  helpers or if reciprocal lineage cannot represent an approved split/merge
- **Hardening:** independent challenger reviews fixed serialization, event ordering, reciprocal
  lineage, duplicate-ID fail-fast behavior and same-target prerequisite rewriting before tests
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** identity-chain ambiguity, a mechanically uncheckable authored aggregate, or
  a downstream consumer requiring a second semantic policy

### AR-P20 — closed semantic-review evidence

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal Phase-3 review-evidence validation contract
- **Objective:** prevent absent, blocked or stale review records from satisfying the population gate
- **Evidence:** Phase-3 correctness review showed that digest equality alone accepted empty
  reviewers, wrong spec revisions, blocked outcomes and an empty required-unit set
- **Decision:** `validateReviewEvidence` receives expected spec revision, lexical unique required
  unit IDs and current digests; records must cover that set exactly once, use a nonempty reviewer,
  match the expected revision/digests and have outcome `accepted`
- **Confidence:** High
- **Hardening:** independent correctness review RV-304
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** review units become optional or multiple review rounds per unit are required

### AR-P21 — closed per-unit review dependencies

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal review-evidence completeness mechanism
- **Decision:** review context includes `requiredDependencyIdsByUnit`; every required unit has one
  lexical unique dependency-ID list, and its record's dependency keys match that list exactly
- **Evidence:** the single Phase-3 re-review showed volunteered dependency maps could omit changed
  dependency classes while remaining valid
- **Confidence:** High
- **Hardening:** independent re-review RV-307
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** dependency closure becomes derivable from another frozen authoritative graph

### AR-P22 — semantic-population authoring contract (runtime)

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal inventory-authoring, stable-identity, classification and review-digest
  mechanisms within the approved frozen-spec denominator
- **Objective:** prevent a mechanically complete ledger from turning formatting, examples or
  duplicated prose into false compiler obligations
- **Decision:** table rows are the only semantic table carriers and table cells are structural;
  EBNF productions are the only grammar carriers and fences are structural; headings are
  structural; non-whitespace residuals in normative authority require explicit inspection.
  Initial rule IDs use reviewed canonical-owner labels and semantic outcome slugs, never fragment
  hashes, offsets or line numbers. They become append-only identities after review acceptance and
  do not change when wording changes. Rejected, uncommitted authoring drafts are replaced rather
  than recorded as permanent allocations; accepted IDs are never regenerated or reused.
  Non-normative reasons use the closed vocabulary `structural-heading`,
  `structural-table-cell`, `structural-ebnf-container`, `structural-markup`,
  `example-or-rationale`, `contextual-source`, `deferred-source`, `section-context`,
  `table-header`, `table-separator`, and `canonical-carrier-child`. Universal projection is
  limited to source text that explicitly quantifies a platform-profile obligation over the five
  named targets; ordinary target-neutral language rules remain direct C64 obligations. Canonical
  review digests hash UTF-8 canonical JSON containing the unit's ordered fragments,
  dispositions, owned rules and referenced conflicts with `displayLine` removed; shared dependency
  digests separately cover declarations/capabilities and the identity-ledger head.
- **Evidence:** both independent Phase-4 reviewers found that one-rule-per-fragment, modal-word
  classification, hash-derived IDs and blanket five-target projection would produce a false
  denominator despite passing the current mechanical validators
- **Rejected alternatives:** content-derived IDs churn when prose changes; table-cell ownership
  loses row context and duplicates row ownership; unrestricted reason strings are unauditable;
  keyword-only rule discovery misclassifies definitions, examples and rationale; projecting every
  core rule creates unjustified target children
- **Strongest counterargument:** authored semantic carriers and outcome ordinals require a
  substantial one-time review; that cost is intrinsic to creating an authoritative denominator
  and is bounded by the chapter units already approved
- **Confidence:** High — the two independent reviews converged; reopen if a frozen normative
  construct cannot be represented by row/production/paragraph/list carriers or a later edit needs
  to insert an outcome without preserving its allocated identity
- **Hardening:** independent compiler/language and correctness reviewers converged on the same
  carrier, identity, applicability, capability and digest boundaries
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260723-01`
- **Reopen triggers:** an unclassified normative residual, unstable ID under a non-semantic edit,
  incomplete digest dependency, or source evidence requiring a different universal projection

### AR-P23 — Phase-5 public execution contract (runtime)

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal API, failure-recovery and testing mechanism within approved Phase-5
  behavior; no product scope, compatibility or acceptance criterion changes
- **Objective:** let immutable specification tests state exact projection, migration, publication
  and command behavior without reading implementation files
- **Decision:** expose result-based pure render/freshness and strict version-dispatch APIs; keep
  production at v1 while a test-only dispatcher accepts migration registrations; publish two
  fixed-path outputs under one PID/token lock with exclusive invocation-owned temporary files and
  hooks after sync/rename; embed one canonical-inventory generation digest in both projections;
  check mode detects missing/stale/mixed projections without filesystem mutation. Generation
  guarantees individually atomic renames, no mixed-pair success, and deterministic dead-owner
  repair rather than impossible cross-file crash atomicity. Diagnostics use the existing lowercase
  dotted code convention and existing `source`/`evolution` phases.
- **Evidence:** existing results use `{ ok, diagnostics }`; `InventoryV1` already carries
  `evolutionGate` and source citations; root scripts already fix the output paths; POSIX rename is
  atomic for one target but cannot atomically replace two independent files
- **Rejected alternatives:** CLI-only tests cannot independently target escaping, migration chains
  or injected failures; exposing lock/temp internals as the primary API couples the oracle to the
  mechanism; a directory/pointer swap would change the approved artifact layout
- **Strongest counterargument:** exported test seams enlarge the internal package surface and can
  ossify recovery mechanics; the package is private, seams are narrowly typed, and only render,
  dispatch and command contracts are barrel exports
- **Confidence:** High — every approved behavior has a concrete observable seam and the filesystem
  guarantee matches what two fixed output paths can provide
- **Hardening:** blind design challenger converged on the result-based API and identified the
  impossible stronger crash-atomic interpretation; adopted that correction
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260724-02`
- **Reopen triggers:** output layout changes to one atomic directory/pointer, a production v2
  migration is approved, or a supported filesystem cannot provide exclusive creation and atomic
  same-directory rename

### AR-P24 — bounded exact artifact snapshots (runtime)

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** test-harness performance mechanism; the immutable no-mutation behavior and all
  acceptance expectations remain unchanged
- **Objective:** keep real-authority command tests bounded and failure diagnostics usable
- **Decision:** snapshot each fixed artifact as SHA-256 and compare the path-to-digest map; retain
  raw bytes only where a test intentionally mutates or restores one output
- **Evidence:** isolated production digest/generate completes in about 0.7 seconds at 147 MB, while
  Vitest recursive equality over repeated 7.3 MB byte arrays reached 3.4 GB and 30+ seconds
- **Rejected alternatives:** raising timeout/memory preserves an unnecessarily quadratic diagnostic
  path and risks CI instability; sampling bytes weakens exactness
- **Strongest counterargument:** a hash comparison is probabilistic rather than mathematical byte
  equality; SHA-256 collision risk is negligible for a repository integrity oracle and materially
  safer than an unbounded test runner
- **Confidence:** High — the production benchmark isolates the test matcher as the cost center
- **Hardening:** implementation-blind spec author owns the mechanical helper repair and may not
  change scenarios or expectations
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-exec-20260724-02`
- **Reopen triggers:** the matcher gains a bounded native byte-array comparator with concise
  diagnostics or the authority grows beyond the configured input limit

## Systematic 12-category closure

| Category | Closure |
|---|---|
| Feature gaps | Complete inventory population is included (AR-P1) |
| Behavioral gaps | Ordered validation and blocking-result behavior fixed (AR-P7) |
| Scope ambiguities | RD-01 only; sibling RDs remain declaration consumers (AR-P1, AR-P9) |
| Technical unknowns | Package, parser, schema, fragmenter and migration seams fixed (AR-P2–P6, P10) |
| Edge cases | Duplicate keys, residual spans, unsafe paths, cycles, caps and atomic failure included |
| Integration points | Typed declarations and repository command fixed (AR-P5, AR-P9) |
| Data & state | Artifact layout, identity, lineage and evolution fixed (AR-P3, AR-P8, AR-P10) |
| Security & compliance | Offline hostile-input boundary fixed; service controls remain inapplicable (AR-P11) |
| Non-functional gaps | Determinism, bounds, atomicity and full verification fixed (AR-P7, AR-P10–P12) |
| UX & presentation | Ordered diagnostics and escaped generated Markdown fixed (AR-P7, AR-P11) |
| Stakeholder conflicts | No unresolved conflict; frozen spec and C64-v3.0 decisions govern |
| Naming & terminology | Package, root folder, plan slug and artifact roles fixed (AR-P2, AR-P3) |
