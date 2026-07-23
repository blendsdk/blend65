# Testing Strategy: RD-01 Specification Inventory

> **Document**: 07-testing-strategy.md
> **Parent**: [Index](00-index.md)

## Testing Overview

### Coverage Goals

| Code type | Target |
|---|---|
| Parsers, source containment, schema and semantic validators | 95% branches |
| Fragmentation, graph/projection and version dispatch | 100% contracted cases |
| CLI/glue | 80% branches |
| Authoritative inventory | 100% source-fragment disposition |

Specification tests are derived only from RD-01 requirements and acceptance criteria without
reading implementation targets. Plan-selected mechanisms belong in implementation tests.
Implementation tests follow the implementation and cover algorithms, package boundaries,
diagnostic normalization, generation internals and performance edges (AR-P12).

## 🚨 Specification Test Cases

> These cases derive exclusively from RD-01. Plan documents may identify interfaces and file
> placement but never supply immutable expectations.
> If implementation behavior differs, the implementation is wrong.

### Strict input and schema

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-1 | Minimal well-formed v1 inventory fixture | Strict intake and schema validation succeed | RD-01 AC-1; 03-01 §V1 contracts |
| ST-2 | Add an unknown property independently to each object kind | Every fixture fails at the exact property path | RD-01 AC-1; AR-P5 |
| ST-3 | Remove each required field or substitute an invalid enum/ID | Each fixture fails with a stable schema diagnostic | RD-01 AC-1; 03-01 §Strict JSON intake |
| ST-4 | Duplicate `ruleId` key in one raw object and duplicate a nested citation key | Both fail before value materialization; neither last value wins | RD-01 AC-2; AR-P4 |
| ST-5 | JSON containing a comment, trailing comma, malformed UTF-8 or depth one above the limit | Each fails in input phase with no inventory result | RD-01 Technical Requirements; RD-01 Security Considerations |
| ST-6 | Inputs at every v1 numeric/string/array limit and one unit above | Exact-boundary fixtures pass; one-over fixtures fail before excess traversal | RD-01 AC-17 |

### Fragmentation, manifest and citations

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-8 | Independent vectors for headings, paragraphs, list items, table rows/cells, fenced EBNF and residual text | Ordered kinds, byte start/end, ancestry and hashes match byte-for-byte | RD-01 AC-6 |
| ST-10 | Delete one byte and delete one complete derived span from a vector-backed ledger | Hash mismatch and undisposed-fragment errors respectively | RD-01 AC-6 |
| ST-11 | Real `spec/` tree plus an added unclassified file or excluded required section | Real tree classifies completely; each mutation fails manifest completeness | RD-01 AC-3 |
| ST-12 | Chapter rule restated by feature index and C64-specific value restated outside appendix | Chapter/C64 owner wins and contextual occurrence links without a second rule | RD-01 AC-3, AC-4 |
| ST-13 | Missing path, absolute path, `..`, symlink escape, repeated heading and stale quote/hash fixtures | Each fails before an escaped or ambiguous source is accepted | RD-01 AC-8 |
| ST-14 | Same citation with a changed display line but identical unique ancestry/quote/hash | Citation remains valid and display line is recomputed | RD-01 Technical Requirements |

### Ledger, conflicts and rule identity

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-15 | Included fragments with mapped, decomposed, non-normative, restatement and blocked dispositions | Every fragment has exactly one valid ledger disposition | RD-01 AC-5 |
| ST-16 | One fragment absent, duplicated or mapped to overlapping child outcomes | Validation fails with the affected fragment/outcome identity | RD-01 AC-5, AC-7 |
| ST-17 | Equivalent restatement, duplicate ownership, overlapping obligation and contradiction fixtures | Four classifications remain distinct; contradiction yields exactly one blocked aggregate with all citations | RD-01 AC-4 |
| ST-18 | Split one rule into two, merge two rules, then attempt retired-ID reuse, ledger truncation/reordering or head mismatch | Lineage and the genesis-to-head identity chain are preserved; reuse and chain corruption fail | RD-01 AC-7; RD-01 Technical Requirements |
| ST-18a | Two distinct rule records carry the same `ruleId` value | One deterministic semantic diagnostic names both record paths; no rule index or graph output is produced | RD-01 AC-2 |
| ST-19 | `not-applicable-c64` without reason/citation, then with uniquely resolved proof | First fails; second passes but does not enter the C64 denominator | RD-01 AC-9 |

### Declarations, evidence and graph

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-20 | Declared/bound, declared/unbound, undeclared and duplicate handler fixtures for generator/oracle/transform | Bound passes; unbound yields blocker; undeclared/duplicate fail validation | RD-01 AC-11 |
| ST-21 | Capability fixtures for frontend, compiler-api, CLI, emit, ACME and VICE, including a rule with three obligations | All six contracts resolve; multiple obligations remain attached; unbound routes block readiness | RD-01 AC-12 |
| ST-22 | Blocking inventory containing erratum, unresolved conflict, unbound handler and unbound capability | Four distinct ordered machine-readable reason kinds are emitted | RD-01 AC-14 |
| ST-23 | Universal five-target obligation | Five stable source-linked children result; only C64 is mandatory, four are out-of-claim | RD-01 AC-10 |
| ST-24 | Universal prerequisite edge whose parent rules both project | Each child points to same-target child; no cross-target edge remains | RD-01 AC-13 |
| ST-25 | Self, duplicate, unknown, cycle, mandatory-to-inapplicable, cross-target and missing-child graph fixtures | Each fails with deterministic diagnostics and cycle path | RD-01 AC-13 |
| ST-26 | DAG with tied zero-indegree nodes and a cycle in `relatedRuleIds` | Topological order is lexically stable; related cycle does not affect it | RD-01 AC-13 |

### Projection, command and evolution

| # | Input / Scenario | Expected Output / Behavior | Source |
|---|---|---|---|
| ST-27 | Render the same valid inventory twice | Bytes are identical and every rule appears once with equal source/applicability/evidence/relationships | RD-01 AC-15 |
| ST-28 | Rule values contain pipes, newlines, raw HTML and `javascript:`/absolute links | Output cannot add table columns or raw HTML; unsafe links fail | RD-01 AC-16 |
| ST-29 | Both committed projections match, then each differs by one byte | Check mode succeeds first, then reports each stale output without changing tracked, authoritative, conformance, review-evidence or generated artifacts | RD-01 AC-15; RD-01 Security Considerations |
| ST-30 | Unknown version and a v1-to-test-v2 migration with absent, stale and current evolution gates | Unknown/absent/stale reject without output; current gate permits deterministic migration | RD-01 AC-18 |
| ST-31 | Inject failure before/during replacement, run two concurrent writers with different input revisions, then kill a subprocess after its first rename | No failed/crashed writer reports success; live contention cannot publish a mixed pair; check mode diagnoses a crash-created digest mismatch; a new invocation safely reclaims the dead-owner lock, re-reads authority and repairs both outputs | RD-01 AC-18 |
| ST-32 | Full authoritative inventory, without requiring generated projections or review-process evidence | Validation succeeds, all included fragments are disposed, all `spec/` files are classified and all blockers remain explicit | RD-01 AC-3, AC-5, AC-14 |
| ST-35 | Full authoritative inventory plus both generated projections | Clean-checkout validation succeeds and both projections are fresh, complete and byte-identical across repeated rendering | RD-01 AC-3, AC-5, AC-15 |

## Test Categories

### Specification Tests

| Test File | ST Cases Covered | Component |
|---|---|---|
| `packages/readiness/src/json-input.spec.test.ts` | ST-4–ST-5 | Strict intake |
| `packages/readiness/src/limits.spec.test.ts` | ST-6 | Limits |
| `packages/readiness/src/schema-validator.spec.test.ts` | ST-1–ST-3 | Closed schema |
| `packages/readiness/src/fragmenter.spec.test.ts` | ST-8, ST-10 | Fragmentation |
| `packages/readiness/src/source-repository.spec.test.ts` | ST-11–ST-14 | Manifest and citations |
| `packages/readiness/src/ledger-validator.spec.test.ts` | ST-15–ST-16, ST-18–ST-19, ST-18a | Ledger, identity and lineage |
| `packages/readiness/src/conflict-validator.spec.test.ts` | ST-17 | Conflict classification |
| `packages/readiness/src/declaration-validator.spec.test.ts` | ST-20–ST-22 | Declarations and blockers |
| `packages/readiness/src/rule-graph.spec.test.ts` | ST-23–ST-26 | Projection and graph |
| `packages/readiness/src/projection.spec.test.ts` | ST-27–ST-29 | Markdown and freshness |
| `packages/readiness/src/versioning.spec.test.ts` | ST-30–ST-31 | Dispatch and migration |
| `packages/readiness/src/inventory.spec.test.ts` | ST-32 | Authoritative denominator |
| `packages/readiness/src/readiness-command.spec.test.ts` | ST-35 | Clean-checkout aggregate gate |

### Implementation Tests

| Test File | Description | Priority |
|---|---|---|
| `json-input.impl.test.ts` | Tree traversal, pointer formatting and parser-error normalization | High |
| `dependency-boundary.impl.test.ts` | Compiler/toolchain-package independence | High |
| `diagnostics.impl.test.ts` | Stable sorting and cascade suppression | High |
| `fragmenter.impl.test.ts` | Scanner states, hash normalization, BOM/newline/Unicode, escaped-table, nested-list and unterminated-fence behavior | High |
| `semantic-validator.impl.test.ts` | Index construction, Kahn ordering and canonical cycle selection | High |
| `projection.impl.test.ts` | Context-specific escaping and stable formatting helpers | High |
| `versioning.impl.test.ts` | Migration-chain and identity-ledger lookup plus temp-file cleanup | High |
| `declaration-generator.impl.test.ts` | Bounded union generation, barrel freshness and deterministic rendering | High |
| `review-evidence.impl.test.ts` | Unit/dependency digest invalidation and aggregate-review freshness process gate | High |
| `atomic-writer.impl.test.ts` | Live contention, PID/token ownership, dead-owner quarantine/reclamation, unique temp ownership and crash-repair digest consistency | High |

### Integration Tests

| Test | Components | Description |
|---|---|---|
| `readiness:check` | All validators + projection | Non-mutating real-repository trust gate |
| `readiness:generate` | Validation + renderers + writer | Explicit deterministic update of both projections |
| downstream type fixture | Declaration exports | RD-02/RD-04 can consume typed IDs without compiler deps |

### End-to-End Tests

| Scenario | Steps | Expected Result |
|---|---|---|
| Clean checkout | Build package, run `yarn readiness:check` | Valid denominator, current semantic review and fresh projections |
| Source drift simulation | Copy fixture spec, alter cited bytes, validate | Stale-source failure before readiness output |
| Inventory omission simulation | Remove one ledger row, validate | Undisposed fragment failure |

## Test Data

### Fixtures Needed

- Strict raw JSON fixtures kept as text so duplicate keys survive.
- Independent fragmentation vectors with literal byte encodings.
- Temporary `spec/` trees for traversal/symlink and source-drift cases.
- Small complete inventories for conflict, lineage, declaration, graph and projection behavior.
- One test-only migration registry and injectable atomic-writer failure.
- Concurrent-writer fixtures and unit/dependency-digest plus aggregate semantic-review evidence.

### Mock Requirements

No compiler components are mocked. Filesystem tests use real temporary directories. Only the atomic
writer's injected failure seam is substituted to prove rollback.

## Verification Checklist

- [ ] All ST cases have concrete inputs and expected behavior.
- [ ] Specification tests are written before their implementation phase.
- [ ] New specification tests are observed red or justified when guarding existing structure.
- [ ] Implementation makes immutable specification tests green.
- [ ] Implementation tests cover internals and error paths.
- [ ] `yarn readiness:check` passes without modifying tracked, authoritative, conformance,
      review-evidence or generated artifacts.
- [ ] `yarn workspace @blend65/readiness test:coverage` meets the declared branch thresholds.
- [ ] `npx prettier --check` passes for touched files.
- [ ] Full AGENTS.md verify passes at every phase close.
- [ ] `spec/` remains unchanged.
