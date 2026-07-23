# Workspace and Data Model: RD-01 Specification Inventory

> **Document**: 03-01-workspace-data-model.md
> **Parent**: [Index](00-index.md)

## Overview

The private `@blend65/readiness` workspace owns reusable typed mechanisms. Root `readiness/` owns
authoritative data and generated projections (AR-P2, AR-P3). The package has no dependency on any
`@blend65/*` compiler package; its runtime dependencies are restricted to explicitly declared
validation libraries.

## Architecture

### Package surface

```text
packages/readiness/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── model.ts
    ├── limits.ts
    ├── diagnostics.ts
    ├── json-input.ts
    ├── schema-validator.ts
    ├── declaration-generator.ts
    ├── generated/
    │   └── declarations.ts
    └── cli.ts
```

The public internal barrel exports data contracts and pure APIs needed by downstream readiness
packages. The CLI is a thin adapter over those APIs, not a second validation implementation
(AR-P2, AR-P7).

### Authority surface

```text
readiness/
├── README.md
├── schema/inventory-v1.schema.json
├── inventory/compiler-readiness-v1.json
├── inventory/rule-identities-v1.jsonl
├── conformance/fragmentation-v1.json
├── reviews/compiler-readiness-v1-review.json
└── generated/compiler-readiness.md
```

JSON under `inventory/` is semantic authority. Review JSON is unit/dependency-digest and
aggregate-revision process evidence that gates closeout but never supplies rule meaning. Generated
Markdown and TypeScript are reviewable projections and never inputs to validation or readiness
computation (AR-P3).

## V1 contracts

`InventoryV1` mirrors every top-level field owned by RD-01. Its `identityLedgerHead` anchors the
current digest of `rule-identities-v1.jsonl`. That separate append-only ledger begins at a fixed v1
genesis and records each allocation or retirement event with the predecessor digest; it never
reactivates an ID. Full-chain validation rejects truncation, reordering, mutation, duplicate
allocation and any head mismatch before projecting active/retired identity state into the
inventory. Active rules reference active identities. Nested objects are discriminated
unions for authority classification, ledger disposition, handler kind/binding, evidence
capability, applicability, domain descriptor and lineage. Every discriminator is a string-literal
union exported from `model.ts`; runtime acceptance still comes from the committed schema and
semantic validator, not TypeScript erasure (AR-P5).

### Closed v1 field surface

The requirements-derived tests target this exact public shape before implementation. Every object
is closed. Optional collections default to empty only in test builders; persisted JSON carries all
required top-level registries explicitly.

- `InventoryV1`: `schemaVersion`, `inventoryVersion`, `specRevision`, `identityLedgerHead`,
  `fragmentationProfile`, `normativeSources`, `handlerDeclarations`,
  `evidenceCapabilityDeclarations`, `clauseLedger`, `conflicts`, `rules`, `evolutionGate`.
- `FragmentationProfile`: `profileId`, `version`, `contentHashAlgorithm`, `newlinePolicy`.
- `NormativeSource`: `path`, `order`, `classification`, `sections`; each `SourceSection` has
  `headingAncestry`, `classification`, `contentHash`.
- `HandlerDeclaration`: `id`, `kind`, `owner`, `contractVersion`, `binding`.
- `EvidenceCapabilityDeclaration`: `id`, `owner`, `contractVersion`, `binding`,
  `observableContract`, `prerequisiteRoute`.
- `ClauseLedgerEntry`: `fragmentId`, `disposition`, plus exactly the fields selected by that
  disposition: `ruleIds`, `childOutcomes`, `reasonCode`, `canonicalRuleId`, or `conflictId`.
- `ConflictRecord`: `conflictId`, `classification`, `citations`, `ruleIds`, `resolution`.
- `InventoryRule`: `ruleId`, `source`, `requirement`, `category`, `polarity`, `applicability`,
  optional `applicabilityReason`, `validDomains`, `invalidNeighbors`, `boundaryFamilies`,
  `generatorIds`, `oracleIds`, `transformIds`, optional `handlerAbsenceReason`,
  `evidenceObligations`, `prerequisiteRuleIds`, `relatedRuleIds`, optional `lineage`, and
  optional `universalProjection`.
- `SourceCitation`: `path`, `headingAncestry`, `quote`, `contentHash`, `displayLine`.
- Domain and neighbor descriptors are closed `{ kind, values }` objects. Applicability reasons are
  closed `{ code, target, citation }` objects. Lineage is a closed object with optional
  `supersedes`, `splitFrom`, and `mergedFrom` ID arrays. Universal projection is a closed
  `{ parentRuleId, target }` object.
- `EvolutionGate` is either `null` or a closed object containing `owner`, `semanticRevision`,
  `acceptanceGate`, and `validatedAt`.

Closed discriminators are: handler kind `generator | oracle | transform`; binding
`bound | unbound`; source/section classification `normative-chapter | normative-grammar |
normative-target | contextual | deferred | rejected | blocked-errata`; ledger disposition
`mapped | decomposed | non-normative | canonical-restatement | blocked-errata`; conflict
classification `equivalent-restatement | duplicate-ownership | overlapping-obligation |
contradiction`; and the rule polarity/applicability values already listed in the owning
requirement. IDs use ASCII allowlists and semantic revisions/content hashes use lowercase
`sha256:<64 hex>`.

The result model is:

```ts
interface InventoryDiagnostic {
  readonly phase:
    | "input"
    | "schema"
    | "source"
    | "declaration"
    | "conflict"
    | "ledger"
    | "graph"
    | "evolution";
  readonly code: string;
  readonly severity: "error" | "warning";
  readonly path: string;
  readonly location?: { readonly line: number; readonly column: number };
  readonly relatedPaths: readonly string[];
  readonly message: string;
}

interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly inventory?: InventoryV1;
  readonly topologicalRuleIds?: readonly string[];
  readonly blockingReasons: readonly ReadinessBlockingReason[];
}
```

Diagnostics sort by phase order, code, canonical path, location, then message. A phase that lacks
valid prerequisites does not run, preventing cascades while preserving independent findings
(AR-P7).

## Strict JSON intake

`parseInventoryJson(bytes, limits)` first checks the byte bound and malformed UTF-8. It then uses
the pinned `jsonc-parser.visit` API as a non-tree pass with explicit depth and per-object key stacks.
The pass aborts at the exact depth or duplicate-key violation before `parseTree` or materialization.
A pinned behavioral contract test must prove that abort prevents suffix traversal; if that proof
fails, execution uses a minimal strict-JSON byte structural scanner instead. Only bounded,
duplicate-free input reaches `parseTree` and materialization (AR-P4, AR-P11). Comments and trailing
commas remain rejected. Parse failure returns diagnostics and never a partial inventory.

Ajv v8 compiles the committed draft-2020-12 schema with remote references and data mutation
disabled. Ajv diagnostics are normalized into the common ordering. Semantic validation receives
only schema-valid `InventoryV1` values (AR-P5).

## Limits

`limits.ts` exports one immutable `INVENTORY_V1_LIMITS` object with these exact fields and values:
`maxInputBytes: 8_388_608`, `maxDepth: 64`, `maxSources: 256`, `maxSectionsPerSource: 256`,
`maxFragments: 65_536`, `maxRules: 32_768`, `maxStringBytes: 65_536`,
`maxArrayItems: 65_536`, and `maxRelationshipsPerRule: 512`. The frozen specification is currently
919,012 bytes across 50 files, so the byte/source caps exceed measured maxima by more than 4×;
the structural caps deliberately leave headroom for one complete fragmentation and decomposition
pass without becoming unbounded. Exact-boundary/one-over specification tests pin the contract
(AR-P11, AR-P14). Changing a cap requires an inventory-version review.

## Integration Points

- Root `readiness:check` builds the package, invokes the CLI in check mode and verifies both
  generated outputs without altering tracked, authoritative, conformance, review-evidence or
  generated paths. Ignored build outputs are outside this non-mutation contract.
- Root `readiness:generate` validates and renders both generated outputs in memory, then replaces
  only `packages/readiness/src/generated/declarations.ts` and
  `readiness/generated/compiler-readiness.md`.
- `packages/readiness/src/generated/declarations.ts` contains bounded literal unions and contract
  records for handler, capability and declaration identities. `RuleId` remains a branded string
  validated against the inventory registry.
- Phase 4 validates deterministic declaration rendering in memory after each population unit.
  Committed declaration freshness begins only in Phase 5, where the complete inventory exists and
  the publication command owns both projections.
- RD-02–RD-04 import only exported model/declaration contracts.
- No compiler package imports readiness during RD-01.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|---|---|---|
| Invalid UTF-8/JSON, comments or trailing commas | Input diagnostic; stop before schema | AR-P4, AR-P7 |
| Duplicate object property | One diagnostic per duplicate occurrence path; no materialization | AR-P4 |
| Unsupported schema version | Deterministic input/version diagnostic; no partial output | AR-P7, AR-P10 |
| Schema violation | Normalize Ajv errors; semantic phases do not run | AR-P5, AR-P7 |
| Limit exceeded | Reject before allocation/traversal beyond the named bound | AR-P11 |
| CLI failure | Structured diagnostics to stderr and nonzero exit; no stack trace for data errors | AR-P7 |

## Testing Requirements

- Strict-intake specification tests cover duplicate keys at every nesting depth and JSONC rejection.
- Schema fixtures cover every closed object, enum and conditional field.
- Implementation tests cover visitor early-abort behavior, diagnostic sorting, Ajv normalization,
  measured-limit helpers, the hash-chained identity ledger and the generated-declaration lifecycle.
- Static boundary test rejects imports from all other `@blend65/*` packages.
