# Ambiguity Register: RD-01 Specification Inventory and Rule Schema (plan)

> **Status**: ✅ GATE PASSED — all 12 items resolved
> **Last Updated**: 2026-07-23 22:02
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
| AR-P2 | Technical | Where should reusable readiness code live? | (A) a new private `@blend65/readiness` workspace; (B) `@blend65/test-harness`; (C) root scripts only | **A** — dedicated dependency-free domain boundary, with repository data under `readiness/` | ✅ Resolved |
| AR-P3 | Data & state | Where do authoritative and generated artifacts live? | (A) root `readiness/` with `schema/`, `inventory/`, `conformance/`, and `generated/`; (B) package source; (C) `docs/` | **A** — separates durable data from executable code and marks generated Markdown non-authoritative | ✅ Resolved |
| AR-P4 | Technical | How are duplicate JSON keys preserved for rejection before ordinary parsing erases them? | (A) inspect a `jsonc-parser` syntax tree, reject comments/trailing commas and duplicates, then materialize; (B) write a JSON parser; (C) accept `JSON.parse` loss | **A** — reuse a declared parser dependency while retaining exact property occurrences | ✅ Resolved |
| AR-P5 | Technical | How are JSON Schema and semantic validation divided? | (A) committed draft-2020-12 schema compiled by explicit Ajv v8, followed by ordered semantic passes; (B) custom validation only; (C) schema-only | **A** — portable local constraints plus TypeScript-owned relational checks, exposed through one result model and command | ✅ Resolved |
| AR-P6 | Technical | How are Markdown/EBNF fragments derived with stable byte spans? | (A) a versioned, purpose-built byte-oriented scanner over UTF-8/LF source; (B) a general Markdown AST and inferred offsets; (C) hand-authored fragments | **A** — the RD's total non-overlapping byte-span contract needs a smaller explicit grammar than a renderer-oriented AST | ✅ Resolved |
| AR-P7 | Behavioral | What ordering and failure contract does the validation command use? | (A) parse/limits → schema → source/fragment → declarations → conflicts/ledger → graph/projection → evolution, returning all deterministically sortable diagnostics and no partial outputs; (B) fail-fast | **A** — deterministic complete diagnostics, with unsafe source access and unsupported versions rejected before later phases | ✅ Resolved |
| AR-P8 | Data & state | How are identifiers and source identity stabilized? | (A) human-assigned allowlisted rule IDs plus hash-based fragment/source identity and explicit lineage; (B) derive all rule IDs from source hashes | **A** — source edits can invalidate evidence without silently changing semantic rule identity | ✅ Resolved |
| AR-P9 | Integration | How are RD-02–RD-04 handlers and evidence routes represented before implementations exist? | (A) generated TypeScript declaration unions and contract records with explicit `unbound` state; (B) placeholders that count as bound; (C) free-form strings | **A** — compile-time ID exhaustiveness without falsely claiming executable readiness | ✅ Resolved |
| AR-P10 | Data & migration | What version-evolution surface ships in v1? | (A) strict version dispatcher, migration registry/interface, atomic writer abstraction and deterministic invalidation report, with no v2 migrator; (B) speculative v2 migration; (C) reject-only reader | **A** — proves the upgrade boundary without inventing a future format; RD-07 remains the gate owner | ✅ Resolved |
| AR-P11 | Security & non-functional | Which concrete bounds and hostile-input controls govern v1? | (A) named constants enforced before allocation/traversal, canonical real paths beneath `spec/`, no symlink escape, Markdown escaping and safe relative links; (B) rely on repository trust | **A** — inventory data is hostile by RD contract and boundary tests need one executable policy | ✅ Resolved |
| AR-P12 | Testing & process | What verification and execution structure governs the work? | (A) five specification-first phases, targeted red/green checks per phase, Prettier on touched files and the full AGENTS.md verify at every phase close; (B) one monolithic phase | **A** — isolates infrastructure, fragmentation, semantics, population and evolution/docs while preserving one CI-equivalent close gate | ✅ Resolved |

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
- **Reopen triggers:** the workspace boundary cannot remain compiler-independent or the repository
  adopts a single tooling package

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
- **Rejected alternatives:** bound placeholders make unavailable evidence appear usable; strings
  lose compile-time exhaustiveness
- **Strongest counterargument:** generated unions can drift from JSON; generation freshness and
  round-trip tests are part of the same phase
- **Confidence:** Very high
- **Hardening:** preflight PF-005/PF-007 resolution already challenged
- **Policy version:** 1
- **Reopen triggers:** downstream handlers need richer contracts than v1 declarations can express

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
