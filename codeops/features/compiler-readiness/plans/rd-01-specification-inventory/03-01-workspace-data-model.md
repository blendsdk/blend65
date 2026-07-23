# Workspace and Data Model: RD-01 Specification Inventory

> **Document**: 03-01-workspace-data-model.md
> **Parent**: [Index](00-index.md)

## Overview

The private `@blend65/readiness` workspace owns reusable typed mechanisms. Root `readiness/` owns
authoritative data and generated projections (AR-P2, AR-P3). The package has no dependency on any
`@blend65/*` compiler package.

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
├── conformance/fragmentation-v1.json
└── generated/compiler-readiness.md
```

JSON under `inventory/` is authoritative. The generated Markdown is reviewable but never an input
to validation or readiness computation (AR-P3).

## V1 contracts

`InventoryV1` mirrors every top-level field owned by RD-01. Nested objects are discriminated
unions for authority classification, ledger disposition, handler kind/binding, evidence
capability, applicability, domain descriptor and lineage. Every discriminator is a string-literal
union exported from `model.ts`; runtime acceptance still comes from the committed schema and
semantic validator, not TypeScript erasure (AR-P5).

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

`parseInventoryJson(bytes, limits)` first checks byte and nesting bounds, parses a
`jsonc-parser` tree with comments and trailing commas rejected, traverses every object property to
detect duplicate keys, and only then materializes a JavaScript value (AR-P4, AR-P11). Parse
failure returns diagnostics and never a partial inventory.

Ajv v8 compiles the committed draft-2020-12 schema with remote references and data mutation
disabled. Ajv diagnostics are normalized into the common ordering. Semantic validation receives
only schema-valid `InventoryV1` values (AR-P5).

## Limits

`limits.ts` exports one immutable `INVENTORY_V1_LIMITS` object covering input bytes, nesting,
sources, fragments, rules, string lengths, arrays and relationship fan-out. Exact numbers are
selected during implementation from measured frozen-corpus maxima with at least 4× headroom and
are pinned by exact-boundary/one-over specification tests (AR-P11). Changing a cap requires an
inventory-version review.

## Integration Points

- Root `readiness:check` builds the package and invokes the CLI in check mode.
- Root `readiness:generate` invokes explicit generation after full validation.
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
- Implementation tests cover diagnostic sorting, Ajv normalization and measured-limit helpers.
- Static boundary test rejects imports from all other `@blend65/*` packages.
