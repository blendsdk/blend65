# Preflight Report: RD-01 Specification Inventory and Rule Schema

> **Status**: ✅ PREFLIGHT PASSED — all 13 findings resolved
> **Iteration**: 2 (bounded rescan after authorized fixes)
> **Artifact**: single requirement at
> `codeops/features/compiler-readiness/requirements/RD-01-specification-inventory.md`
> **Artifact Blob**: `621a5eb7de95bbf48ccf8298242b3d5009475d76`
> **Codebase Grounded**: frozen specification, requirements graph, compiler boundaries, validation
> patterns and tests examined
> **Mode**: Auto-design
> **Root Invocation ID**: `compiler-readiness-rd01-preflight-20260723-01`
> **Last Updated**: 2026-07-23

## Audit scope

- **Target**: `RD-01-specification-inventory.md` only.
- **Context only**: compiler-readiness ambiguity register, requirements index, roadmap and
  traceability; frozen `spec/`; project manifests, source boundaries and existing tests.
- **Modification set**: this report only. Requirement fixes were not authorized by the invocation.
- **Domain lenses**: compiler/language; data/migration.
- **Deterministic gate**: `compiler-readiness/RD-01` passed the CodeOps `audit` readiness gate.
- **Same-agent safeguard**: the requirement was created in the preceding workflow in this session.
  Five independent dimension-cluster reviews and one blind recommendation challenger were used.

## Codebase context summary

Blend65 is a strict TypeScript compiler pipeline with distinct frontend, compiler API, CLI,
assembly emission, ACME and VICE observation boundaries. The intended readiness denominator is the
frozen v3.0 specification, but `spec/` is heterogeneous: it contains chapters, grammar, platform
appendixes, accepted evaluation histories, an overview/index, future and rejected items, migration
and build documents, and a prior preflight report.

The index describes itself as an overview and canonical diagnostic registry
(`spec/00-feature-index.md:3-5`). It does not enumerate the chapter-level normative obligations.
The build plan says chapters 00–15 supersede evaluation documents and conflicts resolve in favor
of the chapters (`spec/build-plan.md:19,106-107`). Concrete diagnostic conflicts remain between
the index and Chapter 14. RD-02 and RD-03 depend on RD-01 but own executable generators and
oracles, so RD-01 cannot require their implementations as a closeout condition.

## Summary

| # | Dimension | Findings | Highest severity |
|---|---|---:|---|
| 1 | Ambiguities | 3 | 🟠 Major |
| 2 | Implicit assumptions | 4 | 🟠 Major |
| 3 | Logical contradictions | 2 | 🟠 Major |
| 4 | Completeness gaps | 7 | 🟠 Major |
| 5 | Dependency issues | 3 | 🟠 Major |
| 6 | Feasibility concerns | 5 | 🟠 Major |
| 7 | Testability | 8 | 🟠 Major |
| 8 | Security blind spots | 2 | 🟡 Minor |
| 9 | Edge cases | 5 | 🟠 Major |
| 10 | Scope creep indicators | 0 | — |
| 11 | Ordering and sequencing | 3 | 🟠 Major |
| 12 | Consistency | 4 | 🟠 Major |
| 13 | Codebase alignment | 7 | 🟠 Major |

Root causes are de-duplicated below.

| Severity | Count | Resolution selected | Applied |
|---|---:|---:|---:|
| 🔴 Critical | 0 | — | — |
| 🟠 Major | 10 | 10 delegated | 0 |
| 🟡 Minor | 2 | 2 delegated | 0 |
| 🔵 Observation | 0 | — | — |

## Findings

### PF-001: The normative source boundary and conflict precedence are undefined 🟠 MAJOR

**Dimensions:** Ambiguities, Contradictions, Completeness, Codebase Alignment

**Location:** RD-01 lines 12–27 and 47

**Evidence:** `spec/00-introduction.md:162,178,190-197`;
`spec/build-plan.md:19,106-107`; `spec/00-feature-index.md:3-5`;
`spec/14-diagnostics.md:41-56`

“Every mandatory rule in `spec/`” includes both current normative material and historical,
deferred, rejected and planning documents. RD-01 does not define inclusion, canonical ownership,
or how duplicate and conflicting statements become one blocking erratum. Known diagnostic-code
conflicts can otherwise become two independently passing inventory rows.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal authority-mapping mechanism within the user-confirmed frozen v3.0 scope
- **Objective:** ensure one executable, auditable source of semantic truth
- **Decision:** define a closed, ordered normative-source manifest for chapters 00–15, normative
  grammar sections and the applicable C64 appendix; classify all other `spec/` files explicitly.
  Add canonical-owner precedence and a conflict detector that creates one `blocked-errata` record
  containing every conflicting citation.
- **Evidence:** the repository already states chapter precedence, while the index is only an
  overview and live conflicts exist
- **Rejected alternative:** evaluations-only authority contradicts the repository’s consolidation
  rule and drops chapter/platform obligations
- **Strongest counterargument:** the manifest could become a second semantic authority; it must
  store only source classification and precedence, never copied rule content
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** the frozen spec’s canonical-owner policy changes or a required normative
  source cannot be represented by the manifest
- **State:** selected, not applied

### PF-002: The completeness gate is weaker than the claimed denominator 🟠 MAJOR

**Dimensions:** Contradictions, Completeness, Testability, Codebase Alignment

**Location:** RD-01 lines 12–24 and 75–76

**Evidence:** `spec/00-feature-index.md:3-5,23-49`;
`spec/15-platform-profile.md:141-161`

AC-2 checks feature-index entries, not normative clauses. A 23-row feature mapping can pass while
omitting axioms, chapter rules, diagnostics and C64 platform obligations.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** technical coverage-proof design within the confirmed readiness threshold
- **Objective:** make “zero rules disappear silently” falsifiable
- **Decision:** require a mechanically checked clause ledger over the normative-source manifest.
  Every discovered normative fragment must map to one or more inventory rules, an explicit
  reason-coded non-normative disposition, or `blocked-errata`. Keep feature-index reconciliation as
  a secondary roll-up only.
- **Evidence:** the index calls itself an overview and does not enumerate Chapter 15 obligations
- **Rejected alternative:** signed chapter counts can agree while covering the wrong clauses
- **Strongest counterargument:** natural-language extraction cannot decide normativity perfectly;
  discovery may over-report and require explicit classification rather than silently decide
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** clause discovery cannot be made deterministic enough to expose every
  included source fragment for review
- **State:** selected, not applied

### PF-003: Rule granularity can manipulate the readiness denominator 🟠 MAJOR

**Dimensions:** Ambiguities, Completeness, Testability, Data Migration

**Location:** RD-01 lines 20–24, 46–52 and 75–76

**Evidence:** `spec/15-platform-profile.md:145-161`

The document does not say how compound prose, tables, alternatives or mixed observable outcomes
are split. Two authors can produce different rule counts and both claim complete coverage.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal rule-decomposition and identity lifecycle
- **Objective:** keep the denominator independently falsifiable and stable across refinements
- **Decision:** use one rule per independently falsifiable normative outcome, polarity,
  applicability and evidence obligation. Record parent source fragments with exhaustive child
  coverage. Preserve stable IDs and explicit `supersedes`, `splitFrom` and `mergedFrom` lineage.
- **Evidence:** Chapter 15 bundles several independently observable compiler and platform duties
- **Rejected alternative:** human-locked IDs alone preserve identity but do not prevent coarse
  rules from masking failures
- **Strongest counterargument:** lineage adds early complexity; without it, later split/merge work
  silently breaks replay and trend history
- **Confidence:** High
- **Hardening:** challenger proposed and justified the hybrid resolution
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** an independently testable obligation cannot be decomposed without
  duplicating or losing source coverage
- **State:** selected, not applied

### PF-004: The closed schema omits required semantic fields 🟠 MAJOR

**Dimensions:** Ambiguities, Completeness, Consistency, Testability

**Location:** RD-01 lines 20–28 and 40–52

The Must Have list requires category, polarity, domains, invalid neighbors, boundary families and
transform IDs, but the closed schema table omits them. “Where applicable” does not define when
handler lists may be empty.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal data-schema design
- **Objective:** prevent schema-valid inventories from losing required readiness semantics
- **Decision:** enumerate the complete top-level and per-rule v1 shape, controlled vocabularies,
  nesting and conditional requirements. Include transform IDs and reason-coded absence states.
  Add closed-nesting, required-presence and lossless round-trip fixtures.
- **Evidence:** `additionalProperties: false` makes omitted fields structurally consequential
- **Rejected alternative:** narrowing Must Haves would weaken the already-confirmed generator and
  oracle design
- **Strongest counterargument:** a complete v1 may overconstrain discovery; use explicit
  versioned extension points rather than implicit fields
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** a mandatory rule dimension cannot be expressed without an unversioned field
- **State:** selected, not applied

### PF-005: Handler registration contradicts the RD dependency order 🟠 MAJOR

**Dimensions:** Contradictions, Dependencies, Ordering, Feasibility

**Location:** RD-01 lines 7, 28, 51 and 73–74

**Evidence:** `requirements/RD-02-generative-cases.md:7,19-30`;
`requirements/RD-03-independent-oracles.md:7,20-32`;
`requirements/README.md:45-63`

RD-01 requires registered generator/oracle implementations, while RD-02 and RD-03 depend on RD-01
and own those implementations. Placeholders would make the gate green without evidence capacity.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal interface and implementation sequencing
- **Objective:** preserve clean dependencies without weakening referential integrity
- **Decision:** RD-01 owns typed handler contracts, versioned ID declarations and metadata. RD-02
  and RD-03 bind implementations. Campaign and readiness gates reject declared-but-unbound IDs and
  record implementation revision hashes.
- **Evidence:** declaration and executable binding are different lifecycle states
- **Rejected alternative:** merging/reordering RD-01–RD-03 sacrifices useful phase separation
- **Strongest counterargument:** declarations can drift; generated types and exhaustive binding
  checks close that gap
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** handler contracts cannot be validated independently of implementations
- **State:** selected, not applied

### PF-006: JSON Schema is assigned checks it cannot perform alone 🟠 MAJOR

**Dimensions:** Assumptions, Feasibility, Testability, Codebase Alignment

**Location:** RD-01 lines 22, 40–52 and 73–74

Standard JSON Schema cannot enforce uniqueness of one property across array entries or validate
IDs against TypeScript registries. Existing-rule references, citations and graph properties also
need cross-record checks.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal validation architecture
- **Objective:** make every acceptance failure implementable, portable and diagnosable
- **Decision:** use JSON Schema for shape and local conditions, followed by one deterministic
  semantic inventory validator for unique IDs, references, citations, handler declarations and
  graph integrity. Expose both through one validation command and result model.
- **Evidence:** the repository currently uses purpose-built TypeScript validators; ordinary JSON
  Schema has no external-registry or property-projection uniqueness facility
- **Rejected alternative:** custom schema keywords/generated enums reduce portability and still
  cannot cover all graph and citation constraints
- **Strongest counterargument:** two layers may drift; one command and integrated fixtures must
  exercise both
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** the selected JSON Schema implementation gains portable equivalents for all
  semantic checks or the two-layer diagnostics cannot remain deterministic
- **State:** selected, not applied

### PF-007: The terminal-tier model omits real observable boundaries 🟠 MAJOR

**Dimensions:** Assumptions, Completeness, Testability, Codebase Alignment

**Location:** RD-01 lines 12–14 and 47–51

**Evidence:** `spec/15-platform-profile.md:145-184`;
`packages/compiler/src/api/build.ts:143`;
`packages/cli/src/main.ts:106-115`; `packages/cli/src/render.ts:86-91`

`frontend | emit | acme | vice` cannot unambiguously express whole-compiler API behavior, CLI
stream/rendering behavior, or rules requiring more than one independently observed outcome.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal evidence-routing architecture
- **Objective:** assign every normative outcome to a sufficient observable boundary
- **Decision:** use registered, capability-defined evidence-tier IDs, initially `frontend`,
  `compiler-api`, `cli`, `emit`, `acme` and `vice`. A rule may declare multiple evidence
  obligations; execution still uses the cheapest sufficient route per obligation.
- **Evidence:** resource reporting and CLI rendering are distinct existing boundaries
- **Rejected alternative:** making `emit` an umbrella hides materially different contracts
- **Strongest counterargument:** multiple obligations add authoring and execution cost; defaults
  and tier-aware scheduling optimize cost without collapsing semantics
- **Confidence:** High
- **Hardening:** challenger converged with the explicit pipeline/API naming refinement
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** a mandatory rule requires an observation capability outside the registered
  tier model
- **State:** selected, not applied

### PF-008: Source citations are neither uniquely resolvable nor replay-stable 🟠 MAJOR

**Dimensions:** Assumptions, Feasibility, Testability, Edge Cases, Data Migration

**Location:** RD-01 lines 20–21, 47, 54–55 and 73–80

A present heading/line selector can resolve nowhere, match repeated headings, or drift away from
the inventoried clause. Acceptance checks presence and traversal safety, not exact resolution or
source-byte provenance.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal citation identity and replay mechanism
- **Objective:** prove every rule still points to the intended normative bytes
- **Decision:** store a spec revision digest and, per citation, canonical path, heading ancestry,
  normalized bounded quote/hash and display-only line metadata. Validation requires exactly one
  match inside the allowed source root and rejects zero, multiple or hash-mismatched resolutions.
- **Evidence:** headings can repeat and line numbers identify a position only within one blob
- **Rejected alternative:** a repository commit hash identifies the tree but not the intended
  normative fragment
- **Strongest counterargument:** harmless heading/prose edits cause churn; the frozen baseline
  minimizes churn and real changes should produce explicit migration
- **Confidence:** Very high
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** normalized anchors cannot uniquely resolve a valid normative fragment
- **State:** selected, not applied

### PF-009: Schema evolution ownership and sequencing are incomplete 🟠 MAJOR

**Dimensions:** Completeness, Dependencies, Ordering, Data Migration

**Location:** RD-01 lines 54–55 and 71–80

**Evidence:** `requirements/RD-07-non-functional.md:12-24,79-82`;
`requirements/README.md:45-73`

RD-01 requires migration/invalidation but has no migration acceptance criteria. RD-07 supplies
evolution guarantees only after RD-06 in the suggested order, allowing durable readiness evidence
before its compatibility policy exists.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** reversible schema-evolution mechanism and implementation sequencing
- **Objective:** make v1 strict now and prevent an ungoverned first upgrade
- **Decision:** RD-01 defines v1 version dispatch, supported-version policy, migration interface
  and unknown/old-version acceptance tests. RD-07’s evolution gate becomes a mechanically recorded
  prerequisite before the first schema or inventory-format upgrade and before upgraded evidence
  can count.
- **Evidence:** v1 creation needs dispatch behavior even when no migration runs yet
- **Rejected alternative:** a separate data-lifecycle RD adds ceremony without a distinct
  subsystem at current scope
- **Strongest counterargument:** a conditional cross-RD prerequisite is easy to miss; encode it in
  traceability, roadmap and tests
- **Confidence:** High
- **Hardening:** challenger converged
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** migrations expand into a separately deployable or multi-format subsystem
- **State:** selected, not applied

### PF-010: Rule relationships lack executable graph semantics 🟠 MAJOR

**Dimensions:** Dependencies, Feasibility, Testability, Edge Cases

**Location:** RD-01 lines 23–24 and 52

`dependsOn` permits self-edges and cycles, but language rules can also be mutually explanatory
without being execution prerequisites. One ambiguous edge type makes traversal and readiness
ordering arbitrary.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal graph and execution-order design
- **Objective:** distinguish semantic relationships from executable prerequisites
- **Decision:** replace the ambiguous edge with `relatedRules` (cycles allowed) and
  `prerequisiteRuleIds` (DAG). Reject self-edges, duplicate edges, cycles and applicable rules
  depending on inapplicable prerequisites; emit a deterministic cycle path and order.
- **Evidence:** referential existence alone does not give cyclic prerequisites coherent readiness
  semantics
- **Rejected alternative:** forcing every relationship into a DAG misrepresents mutually related
  language rules
- **Strongest counterargument:** authors may misuse relations to evade prerequisite validation;
  define operational meanings and require generators/oracles to use only DAG prerequisites
- **Confidence:** High
- **Hardening:** challenger selected the split-edge design over the initial all-DAG framing
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** a genuinely cyclic executable prerequisite is discovered and cannot be
  represented as one grouped atomic rule
- **State:** selected, not applied

### PF-011: Generated documentation is deterministic but not safe or faithful 🟡 MINOR

**Dimensions:** Testability, Security, Edge Cases

**Location:** RD-01 lines 29–30, 67–69 and 79

Byte-identical output may still omit or alter rules, and unescaped pipes, links, newlines or HTML
can corrupt the review surface.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** reversible documentation-generation mechanism
- **Objective:** keep the human review projection complete and structurally safe
- **Decision:** require every rule ID exactly once with citation, applicability, evidence tiers and
  relationships equal to JSON; reject report-only rows and broken links. Use context-specific
  Markdown escaping, restrict ID syntax and disable/sanitize raw HTML and unsafe link schemes.
- **Evidence:** JSON remains authoritative, but the generated document is the human audit surface
- **Rejected alternative:** a JSON appendix is lossless but materially less usable for review
- **Strongest counterargument:** repository content is trusted; generated review output should
  still be immune to valid prose corrupting its structure
- **Confidence:** High
- **Hardening:** in-context review combined fidelity and output-injection symptoms into one root
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** documentation moves to a renderer with a different escaping/security model
- **State:** selected, not applied

### PF-012: Declared resource caps have no acceptance evidence 🟡 MINOR

**Dimensions:** Security, Feasibility, Testability, Edge Cases

**Location:** RD-01 lines 67–69 and 71–80

The security section says fields are capped, but no schema limits, aggregate limits or boundary
tests are required.

**Delegated Resolution:**

- **Authority:** AI — delegated by `--auto-design`
- **Eligibility:** internal resource-safety mechanism
- **Objective:** make malformed inventory failure bounded and deterministic
- **Decision:** specify and test per-field lengths, array counts, dependency fan-out, nesting depth
  and aggregate file/rule limits, including exact-boundary and one-over cases.
- **Evidence:** inventories and migrations process repository input before it can be trusted
- **Rejected alternative:** file-size-only limits do not bound pathological post-parse structure
- **Strongest counterargument:** limits may reject legitimate future growth; version them and set
  them well above the complete v3 inventory with measured headroom
- **Confidence:** Medium-high
- **Hardening:** no change after forced reframing
- **Policy version:** 1
- **Root invocation ID:** `compiler-readiness-rd01-preflight-20260723-01`
- **Reopen triggers:** the completed inventory approaches 75% of any bound
- **State:** selected, not applied

## Verdict

The structural graph is healthy, but RD-01 cannot yet serve as the readiness authority. Its current
acceptance criteria permit false completeness, conflicting sources, unresolvable citations,
unimplementable handler sequencing and insufficient evidence tiers. Auto-design selected
remediations for all findings, but preflight does not authorize applying them.

## Iteration 2

> **Previous Iteration**: 12 findings — 10 major, 2 minor
> **This Iteration**: 1 new finding, resolved during bounded correction
> **Carried Forward**: none

The authorized remediation revised RD-01 and the directly affected handler, execution, readiness,
evolution, ambiguity and traceability contracts. Five clustered reviews rechecked all 13
dimensions. Residual wording and acceptance gaps were corrected and re-reviewed within the bounded
iteration.

| Finding | Iteration 2 result |
|---|---|
| PF-001 | Resolved — closed source authority, conflict classification and decisive fixtures |
| PF-002 | Resolved — deterministic fragmentation profile and conformance vectors prove clause coverage |
| PF-003 | Resolved — rule identity follows falsifiable outcomes; evidence remains a complete obligation set |
| PF-004 | Resolved — complete closed schema with conditional fields and lossless fixtures |
| PF-005 | Resolved — declarations belong to RD-01; downstream RDs bind implementations and own claim checks |
| PF-006 | Resolved — JSON Schema and semantic validation have explicit, testable boundaries |
| PF-007 | Resolved — capability declarations are separate from RD-04 executable route bindings |
| PF-008 | Resolved — source citations resolve uniquely against revisioned normalized content |
| PF-009 | Resolved — upgrades require a current machine-readable RD-07 evolution-gate record |
| PF-010 | Resolved — descriptive relations and target-compatible DAG prerequisites are distinct |
| PF-011 | Resolved — generated documentation is faithful, escaped and link-safe |
| PF-012 | Resolved — structural and aggregate resource bounds have boundary fixtures |
| PF-013 | Resolved — target projection rewrites universal prerequisites to same-target children |

Independent final rechecks found no residual ambiguity, contradiction, completeness, dependency,
ordering, feasibility, security, edge-case, testability, scope or codebase-alignment defect in the
target. The deterministic CodeOps graph and audit-readiness gates pass.

**Final verdict:** RD-01 is eligible to advance to **RD Preflighted**.
