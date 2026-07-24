# RD-01: Specification Inventory and Rule Schema

> **Document**: RD-01-specification-inventory.md
> **Status**: Done
> **Created**: 2026-07-23
> **Project**: Compiler Readiness
> **Depends On**: —
> **CodeOps Artifact Schema**: 1

## Feature Overview

Create the authoritative, machine-readable denominator for C64 v3.0 readiness. Every normative
rule must be identifiable, attributable to uniquely resolvable specification text and assigned
one or more sufficient evidence obligations before generated evidence can count.

## Functional Requirements

### Must Have

- [x] Maintain a closed, ordered normative-source manifest. It includes chapters 00–15, normative
  grammar sections and the applicable C64 appendix; every other file or section under `spec/` is
  explicitly classified as non-authoritative context, deferred/rejected material or blocked
  pending errata. Chapters 00–15 own consolidated language semantics; the C64 appendix owns
  target-specific obligations. (AR-1, AR-10)
- [x] Detect duplicate or conflicting statements across included and contextual sources.
  Canonical restatements link to one owning rule; unresolved conflicts become one
  `blocked-errata` record containing every conflicting citation.
- [x] Build a clause ledger over every included source fragment. Each fragment maps to one or more
  inventory rules, a reason-coded non-normative disposition or `blocked-errata`; no fragment may
  disappear silently. A versioned fragmentation profile deterministically derives total,
  non-overlapping Markdown and EBNF node spans from the source bytes.
- [x] Inventory every mandatory C64 v3.0 rule with a stable rule ID, exact source citation,
  category, applicability and normative polarity. (AR-1, AR-10)
- [x] Store inventory data in versioned JSON validated by a committed JSON Schema. (AR-4)
- [x] Decompose specification text into one rule per independently falsifiable normative outcome,
  polarity and applicability. Attach the complete sufficient evidence-obligation set to that rule;
  split only when the normative outcomes themselves are independently falsifiable. Decomposed
  parent fragments require exhaustive child coverage, and split/merge operations preserve explicit
  ID lineage.
- [x] Record valid domains, invalid neighbors, boundary families, handler declarations, evidence
  obligations and typed relationships between rules.
- [x] Represent ambiguity as `blocked-errata`, never as an ordinary exclusion or passing case.
- [x] Permit only reason-coded non-applicability; the C64 readiness denominator excludes a rule
  only when the specification itself makes it target-inapplicable.
- [x] Project universally quantified multi-platform obligations into stable per-target child rules
  with source-preserving lineage. The C64 child participates in this claim; other target children
  remain visible as `out-of-claim-target` and cannot support an unqualified readiness claim.
- [x] Validate every generator/oracle/transform ID against a versioned TypeScript handler
  declaration. RD-02 and RD-03 bind executable implementations; declared-but-unbound handlers
  cannot run a campaign or contribute readiness evidence.
- [x] Produce human-readable inventory documentation from JSON without making generated Markdown
  authoritative.

### Won't Have

- Changes to the frozen specification.
- Embedded executable semantic logic in inventory JSON.
- Readiness inferred from test-file or generated-case counts.

## Technical Requirements

The JSON Schema owns local shape and conditional constraints. A deterministic semantic validator
owns cross-record uniqueness, source resolution, handler declarations, conflict checks and graph
integrity. One validation command runs both layers and emits one ordered diagnostic model.

Every object is closed by default (`additionalProperties: false`). Inventory v1 includes:

| Field | Constraint |
|---|---|
| `schemaVersion` | exact supported positive integer |
| `inventoryVersion` | semantic version |
| `specRevision` | digest of the complete normative-source manifest and its source bytes |
| `normativeSources` | ordered, closed source/section manifest with authority classification |
| `fragmentationProfile` | versioned deterministic Markdown/EBNF node-span rules |
| `handlerDeclarations` | versioned generator, oracle and transform IDs with owner RD, contract and binding state |
| `evidenceCapabilityDeclarations` | versioned tier IDs with observable contract, prerequisite route, owner RD and binding state |
| `clauseLedger` | exhaustive source-fragment dispositions and child-rule mappings |
| `evolutionGate` | null for v1 creation; required validated RD-07 revision record for any format upgrade |
| `rules` | bounded array of closed rule objects |

Each rule object includes:

| Field | Constraint |
|---|---|
| `ruleId` | unique stable ID matching the closed ID pattern |
| `source` | canonical repository-relative path, heading ancestry, normalized bounded quote/hash and display line |
| `requirement` | concise normative statement |
| `category` | registered specification-area ID |
| `polarity` | `positive`, `negative-diagnostic`, `negative-rejection` or `quality-obligation` |
| `applicability` | `mandatory-c64`, `not-applicable-c64`, `out-of-claim-target` or `blocked-errata` |
| `applicabilityReason` | reason code, target and citation; required unless `mandatory-c64` |
| `validDomains` | bounded declarative domain descriptors |
| `invalidNeighbors` | bounded declarative neighbor descriptors, required for negative boundaries where defined |
| `boundaryFamilies` | registered boundary-family IDs |
| `generatorIds`, `oracleIds`, `transformIds` | declared handler IDs or a reason-coded absence state |
| `evidenceObligations` | non-empty registered capability/tier IDs sufficient to observe the rule |
| `prerequisiteRuleIds` | unique existing IDs forming a DAG |
| `relatedRuleIds` | unique existing IDs; cycles allowed |
| `lineage` | optional `supersedes`, `splitFrom` and `mergedFrom` stable IDs |

RD-01 declares evidence-capability contracts for `frontend`, `compiler-api`, `cli`, `emit`, `acme`
and `vice`. RD-04 binds executable routes to those declarations. Unbound capabilities are valid
inventory metadata but cannot execute or satisfy readiness. A rule may require multiple
obligations. Runtime semantics always include bounded ACME and VICE evidence even when cheaper
obligations also apply. (AR-7)

The fragmentation profile derives stable ordered spans for heading ancestry, paragraphs, each list
item, normative table rows/cells, fenced grammar productions and every residual non-whitespace
span. Fragment IDs include normalized content hashes. Compound fragments may map to multiple
independently falsifiable rules, but every derived span receives exactly one ledger disposition.

Source validation canonicalizes beneath the allowed `spec/` root and requires every citation to
resolve exactly once with matching normalized quote/hash. Line numbers are display metadata, not
identity.

The v1 reader rejects unknown versions deterministically. RD-01 defines version dispatch, the
migration interface and invalidation-report shape. Before the first schema or inventory-format
upgrade, the upgrade command requires an `evolutionGate` record naming RD-07, its current semantic
revision, the evolution acceptance gate and validation time. Missing or stale records reject the
upgrade before output. Every migration is deterministic, failure-atomic and explicit about replay
invalidation. (AR-9)

`prerequisiteRuleIds` rejects self-edges, duplicate edges, cycles and mandatory rules that require
an inapplicable prerequisite. A target-projected child may depend only on a target-neutral rule or
the same-target projection of its prerequisite; universal parent edges are deterministically
rewritten to corresponding target children. Cross-target siblings use lineage or
`relatedRuleIds`, never executable prerequisites. Validation emits a deterministic cycle path and
topological order. `relatedRuleIds` is descriptive and never controls execution.

## Scope Decisions

| Decision | Chosen | AR |
|---|---|---|
| Denominator | Specification rules | AR-1 |
| Representation | Closed JSON Schema + semantic validator + declared/bound handlers | AR-4 |
| First target | C64 v3.0 only | AR-10 |

## Security Considerations

Treat every inventory value as hostile repository data. Canonicalize paths beneath `spec/`; reject
absolute paths, `..` and symlink escapes; never evaluate JSON content or emit shell fragments.
Bound file size, rule count, nesting, field lengths, arrays and relationship fan-out. Generate
Markdown through context-specific escaping, restrict IDs to an allowlist and disable or sanitize
raw HTML and unsafe link schemes. There is no authentication, network endpoint, sensitive data,
encryption or rate-limiting requirement.

## Acceptance Criteria

1. [x] JSON Schema fixtures reject unknown fields at every nesting level, missing required fields,
   invalid enums, malformed IDs and violations of every conditional absence/presence rule.
2. [x] Semantic validation rejects duplicate rule IDs, unknown references or handler declarations,
   conflicting source ownership and duplicate JSON keys before ordinary parsing can erase them.
3. [x] The normative-source manifest classifies every `spec/` file and included section and
   enforces chapter/C64 ownership precedence.
4. [x] Controlled conflict fixtures distinguish equivalent restatements, duplicate ownership,
   overlapping obligations and contradictions. Restatements link to one owning rule without a
   second denominator row; each contradiction yields exactly one `blocked-errata` record containing
   all citations and no competing passable row.
5. [x] The clause-ledger command reports every included normative fragment as mapped, exhaustively
   decomposed, reason-coded non-normative or `blocked-errata`; feature-index reconciliation is a
   secondary check and zero fragments disappear silently.
6. [x] Implementation-independent conformance vectors contain source bytes and expected ordered
   fragment IDs/spans for every supported Markdown/EBNF node kind; production output must match
   byte-for-byte, and deleting or leaving any derived span undisposed fails.
7. [x] Decomposition fixtures prove every independently falsifiable child is covered exactly once;
   split/merge fixtures preserve lineage without reusing retired IDs.
8. [x] Every source path exists beneath `spec/`, resolves exactly once and matches its normalized
   quote/hash; missing, repeated-heading, stale-hash, traversal, absolute-path and symlink fixtures
   fail before source access escapes the allowed root.
9. [x] A rule marked `not-applicable-c64` requires a reason code and a uniquely resolved
   specification citation proving target inapplicability.
10. [x] A universal five-platform obligation is projected into source-linked per-target children;
   only the C64 child enters the denominator and the other four remain `out-of-claim-target`.
11. [x] Handler declaration validation distinguishes declared, bound and unbound IDs; an unbound ID
    is valid inventory metadata and emits an `unbound-handler` readiness-blocking reason.
12. [x] Evidence-capability validation distinguishes declared, bound and unbound routes; fixtures
    cover frontend, compiler API, CLI, emission, ACME and VICE boundaries and prove that one rule
    can require multiple obligations.
13. [x] Graph fixtures reject self-edges, duplicates, cycles, cross-target prerequisites and
    missing corresponding projected children; same-target and target-neutral prerequisites pass,
    universal edges project deterministically, and related-rule cycles do not affect ordering.
14. [x] `blocked-errata`, unresolved source conflicts and unbound declarations emit distinct,
    machine-readable readiness-blocking reasons for RD-06 to consume.
15. [x] Two consecutive documentation generations from identical JSON are byte-identical and
    contain every rule exactly once with citation, applicability, evidence and relationships equal
    to JSON; no report-only rule or broken link is permitted.
16. [x] Adversarial Markdown values cannot create table columns, raw HTML or unsafe links.
17. [x] Exact-boundary and one-over fixtures cover file size, rule count, nesting, field lengths,
    arrays and relationship fan-out.
18. [x] The v1 reader rejects unknown/unsupported versions with no partial output. Upgrade fixtures
    reject absent/stale evolution-gate records, accept the current RD-07 revision, produce
    deterministic invalidation records and leave source evidence intact after injected failure.

## Closeout Evidence

Implemented and verified on 2026-07-24.

- The authority classifies the complete frozen specification tree and disposes every included
  fragment into 2,112 independently reviewed rules.
- The append-only identity ledger, closed schema, semantic graph, blockers and current unit plus
  aggregate review evidence pass the real repository trust gate.
- Both generated projections share one canonical generation digest. Check mode is non-mutating;
  generation holds one PID/token lock and recovers a crash-created mixed pair.
- Readiness package coverage passes at 95.13% branches with 327 tests, including a real subprocess
  crash/reclaim/repair case. The complete repository verification passes and `spec/` is unchanged.
- Deferral-expiry review found no expired rationale. RD-02/RD-03 still own executable handler
  bindings, RD-04 still owns evidence-route execution, and RD-07 still owns the first real format
  migration gate. No future-consideration item names RD-01 as its landing place.
