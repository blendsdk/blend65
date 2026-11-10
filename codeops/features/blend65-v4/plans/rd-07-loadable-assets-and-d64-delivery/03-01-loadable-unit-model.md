# Loadable Unit Model: RD-07 Loadable Assets and D64 Delivery

> **Document**: 03-01-loadable-unit-model.md
> **Parent**: [Index](00-index.md)

## Overview

A `loadable const` is a compile-time value with exact logical bytes but no resident address. This
component defines the unit record that carries those bytes from the typed frontend to the packager,
its stable identity, its reachability, and its relationship to RD-06 embedded/composed values. It
also defines how native assets become load units.

## Architecture

### Current architecture

The frontend already computes the exact typed initializer for every module `const`, including
packed aggregate bytes and embedded asset values (`frontend/analyzer.ts:366-394`,
`frontend/constant-bytes.ts:33-78`). The `loadable` flag is retained on `SemanticBinding` and
`TypedDeclaration` (`frontend/semantic-types.ts:141`, `semantic-analysis-types.ts:11`). Semantic
lowering then omits loadable declarations from globals and resident asset roots
(`semantic/lower.ts:225-260`), so the bytes are dropped before emission.

### Proposed changes

Add one semantic unit record and collect it before globals are lowered. The record is immutable and
contains everything later stages need; no later stage re-evaluates the initializer.

## Implementation Details

### New types

```ts
/** One exact nonresident value retained for packaging. */
export interface LoadUnitRecord {
  /** Stable unit identity derived from the qualified declaration, not its bytes. */
  readonly id: string;
  /** Qualified source declaration name, for diagnostics and evidence. */
  readonly declaration: string;
  /** Declaration source span. */
  readonly source: SourceSpan;
  /** Exact fixed logical type. */
  readonly type: SemanticType;
  /** Exact logical byte count. */
  readonly size: number;
  /** Exact uncompressed logical bytes. */
  readonly bytes: readonly number[];
  /** SHA-256 of `bytes`. */
  readonly logicalSha256: string;
  /** Source initializer provenance: constant, embedded asset, or composed value. */
  readonly provenance: LoadUnitProvenance;
  /** RD-06 handler constraints that constrain every destination. */
  readonly destinationConstraints: readonly AssetConstraint[];
  /** Reachable canonical aliases. */
  readonly aliases: readonly string[];
}

/** Where a load unit's bytes came from. */
export type LoadUnitProvenance =
  | { readonly kind: "constant"; readonly expression: string }
  | { readonly kind: "embedded"; readonly assetId: string; readonly handler: string }
  | { readonly kind: "composed"; readonly roots: readonly string[] };
```

A unit is created only when the initializer is a legal constant value. The frontend has already
rejected non-constant initializers with E10191 and unsized arrays with the existing type checks;
this component does not add a new rejection path.

### Collection

`collectLoadUnits(analysis)` runs once after module/local analysis and before semantic lowering:

1. Walk every module declaration and every function body; do not filter by reachability yet.
2. For each declaration with `loadable: true`, obtain the typed initializer.
3. Convert the initializer to exact bytes:
   - scalar constant → little-endian width bytes;
   - fixed array/struct → packed field/element order from `initializerBytes`;
   - embedded array → selected asset bytes;
   - composed value → the compile-time evaluator's encoded bytes.
4. Build the identity from the qualified declaration name, logical type descriptor, and
   initializer provenance. Content hash is recorded but never substitutes for identity.
5. Merge import aliases that resolve to the same declaration.
6. Reject a unit whose bytes cannot be materialized as a constant with an internal compiler
   failure. Source non-constant initializers were already rejected by E10191.

Local loadable declarations are collected with a function-qualified identity. A local unit is
packaged only when a reachable load call uses it. Local scope still creates no runtime storage.

### Reachability

The semantic whole-program pass already computes reachable functions and module initializers. Extend
its worklist with `load-unit` operations:

- A load call adds its unit to the reachable unit set.
- An unreachable function contributes no unit even if it contains a load call.
- A unit referenced only by an unreachable call contributes no bytes, name, or reservation.
- Canonical aliases resolve to the same unit record, so one disk entry serves every alias.

### Native assets

`assets/asset-dispatch.ts:69-75` currently rejects `request.owner === "loadable"` with E10204.
Remove that early rejection. The handler still validates selector, hash, identity, and output size.
The selected `EmbeddedArrayValue.bytes` become the unit payload and the handler constraints become
`destinationConstraints`. A scalar asset (`EmbeddedScalarValue`) has no byte payload and cannot be a
load unit; it remains compile-time metadata only.

### Resident separation

An ordinary `const` with `embed()` stays resident and addressable. Its loadable twin is disk-only.
Changing a declaration between the two forms is a source-visible residency change and is never done
automatically. The frontend/semantic boundary must not promote a unit into RAM or spill a resident
asset to disk.

### Tooling handoff

The shared semantic model exposes a frontend-safe `LoadableHandoff` view for RD-09:

```ts
interface LoadableHandoff {
  readonly units: readonly {
    readonly id: string;
    readonly declaration: string;
    readonly type: SemanticType;
    readonly size: number;
    readonly provenance: LoadUnitProvenance;
    readonly destinationCompatibility: readonly string[];
  }[];
  readonly illegalUses: readonly { code: string; span: SourceSpan; message: string }[];
}
```

It is exported from the `@blend65/compiler/frontend` entry point and imports no packaging, layout,
machine, serializer, or D64 module. A build-only `LoadableBuildView` (discussed in 03-07) adds the
directory, sector, address, strategy, quiescence, memory-proof, and cost facts after final layout.
An import-boundary test asserts the frontend graph never reaches packaging.

### Placement constraints

A load unit itself has no resident placement. `place(...)` on it remains E10272. RD-06 handler
constraints (alignment, VIC visibility, VIC role, no-cross windows) constrain every destination
interval instead. The load destination proof consumes them exactly as resident asset placement
does, so a loadable charset still requires a 2048-aligned VIC-visible destination and a loadable
sprite payload still requires 64-byte alignment.

## Integration Points

| Consumer | Input | Use |
| -------- | ----- | --- |
| `semantic/lower.ts` | unit inventory | Attach units to the semantic program |
| `semantic/whole-program.ts` | reachable calls | Filter to reachable units |
| `semantic/operations.ts` | unit id | Form the `load-unit` operation |
| `machine/lower-data.ts` | unit bytes | Emit no resident data; names are separate |
| `packaging/d64` | unit record | Build one PRG component per unit |
| `services/evidence.ts` | unit record | `.assets.json`, `.costs.json`, `.debug.json` |

## Error Handling

| Error case | Handling | Code / identity | AR Ref |
| ---------- | -------- | --------------- | ------ |
| Illegal resident use | Existing source rejection | E10274 | AR-P1 |
| `place(...)` on a load unit | Existing parser/placement rejection | E10272 | AR-P1 |
| Initializer is not a legal constant | Existing compile-time failure | E10191 | AR-P1 |
| Unsized array | Existing type rejection | E10265/E10266 family | AR-P1 |
| Native handler inconsistent | Existing handler validation | E10204 | AR-P16 |
| Unit bytes unavailable at lowering | Internal consistency failure; no artifact | compiler failure | AR-P17 |
| Unrepresentable/duplicate disk name | Packaging failure | `D64_NAME` | AR-P10 |

## Testing Requirements

- Unit tests for scalar, array, struct, embedded, and composed byte materialization.
- Unit tests for import aliases sharing one unit and distinct declarations with equal bytes staying
  distinct.
- Specification tests for zero resident bytes, unreachable-unit omission, resident-twin separation,
  native loadable assets, and destination constraints.
