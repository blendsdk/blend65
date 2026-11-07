# Asset Handler Core: RD-06 Native Assets

> **Document**: 03-01-asset-handler-core.md
> **Parent**: [Index](00-index.md)

## Overview

This component owns the target-neutral seam between the literal `embed(path[, selector])`
expression and one selected-profile asset handler. It decides which handler is a candidate, reads
the file once through the bounded reader, calls the handler, and returns either an exact typed value
plus provenance or a diagnostic. It knows nothing about SpritePad, CharPad, PSID, Koala, VIC-II or
SID.

The seam also owns canonical asset identity, resolved-identity aliasing, the selected-output
projection, and the evidence record fields that later stages consume. It does not allocate target
storage, choose a final address, or emit bytes.

## Architecture

### Current architecture

`analyzePreparedProjectWithAssets` in `packages/compiler/src/frontend/service.ts` hardcodes a native
extension regex, reads every asset as raw bytes, and returns E10204 for every readable native file.
`EmbeddedValue` only represents byte arrays. `SemanticAsset` carries only path, output hash, bytes
and optional source placement. Every embedded declaration currently becomes a resident root and
every reachable asset becomes a byte-backed layout object.

### Proposed changes

```text
literal embed(path, selector)
  -> source-discovery records literal path, selector, owner kind and call span
  -> frontend profile maps canonical extension to one handler key
  -> reserved-but-unimplemented native extension -> E10204 (never raw fallback)
  -> bounded input read (raw reader for raw; separate 1 MiB native read)
  -> handler.parse(request) -> typed output + provenance + constraints + selector inventory
  -> canonical identity = handler/version/path/input hash/selector/representation/output hash
  -> EmbeddedValue (resident array, scalar, or compile-time-only zero-byte value)
  -> SemanticAsset union: ResidentAsset | ScalarAsset
  -> only resident assets enter resident roots, layout, memory and cost evidence
  -> later stages consume only the symbolic asset
```

The C64 handler implementations live in `packages/compiler/src/assets/c64/`. The generic contract
lives in `packages/compiler/src/assets/asset-handler.ts`. The frontend profile
(`packages/compiler/src/frontend/profile.ts`) owns the extension map, reserved extensions, handler
keys/versions and regions as data. It never imports `target/`, `semantic/`, `machine/`, `layout/`,
`artifacts/`, `publication/`, `tools/` or `services/`. This preserves the enforced frontend import
boundary.

## Implementation Details

### Handler contract

File: `packages/compiler/src/assets/asset-handler.ts`

```ts
/** Exact type a selector can produce. */
export type AssetValueType =
  | { readonly kind: "scalar"; readonly scalar: ScalarType }
  | { readonly kind: "array"; readonly array: ArrayType };

/** One literal selector declared by a resolved handler output. */
export interface AssetSelectorInfo {
  readonly name: string;
  readonly type: AssetValueType;
  readonly available: boolean;
  readonly default: boolean;
}

/** One handler-owned placement or consumer constraint. */
export interface AssetConstraint {
  readonly kind: "at" | "align" | "noCross" | "region" | "visibility" | "writable" | "contiguous";
  readonly origin: "handler" | "profile" | "source";
  // Exact payload depends on kind; mirrors the existing evidence vocabulary.
}

/** Exact structured input passed to one handler. */
export interface AssetHandlerRequest {
  readonly sourceId: string;
  readonly literalPath: string;
  readonly resolvedPath: string; // project-relative, forward slashes
  readonly selector: string | null;
  readonly owner: "resident" | "loadable";
  readonly bytes: readonly number[];
  readonly inputSha256: string;
}

/** Exact output selected from one validated file. */
export interface AssetHandlerOutput {
  readonly handlerKey: string;
  readonly handlerVersion: string;
  readonly resolvedSelector: string;
  readonly representation: string;
  readonly value: EmbeddedValue;
  readonly outputSha256: string;
  readonly constraints: readonly AssetConstraint[];
  readonly selectors: readonly AssetSelectorInfo[];
}

/** One closed handler contract. */
export interface AssetHandler {
  readonly key: string;
  readonly version: string;
  readonly extensions: readonly string[];
  readonly defaultSelector: string | null;
  parse(request: AssetHandlerRequest): AssetHandlerOutput | AssetHandlerFailure;
}

/** One complete handler failure with a source-linked diagnostic. */
export interface AssetHandlerFailure {
  readonly kind: "failure";
  readonly diagnostic: ProjectDiagnostic;
}

/** Exact handler provenance carried to layout, debug and evidence. */
export interface AssetProvenance {
  readonly handlerKey: string;
  readonly handlerVersion: string;
  readonly selector: string;
  readonly representation: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly selectors: readonly AssetSelectorInfo[];
}
```

Handler keys and versions are fixed: `spritepad` / `3.80`, `charpad` / `3.88`, `psid` / `1-4`,
`koala` / `classic`, `raw` / `1`. Producer provenance (operator, save settings, retention approval)
is fixture-manifest data, not a runtime handler field; it is consumed by tests and reports, not by
`AssetHandlerRequest`.

### Embedded values and semantic assets

File: `packages/compiler/src/assets/asset-types.ts` (extended)

```ts
/** Immutable scalar selected from a native asset. */
export interface EmbeddedScalarValue {
  readonly kind: "embedded-scalar";
  readonly assetId: string;
  readonly type: ScalarType;
  readonly constant: true;
  readonly value: bigint | boolean;
}

/** Immutable fixed-array selected from a native asset. */
export interface EmbeddedArrayValue {
  readonly kind: "embedded";
  readonly assetId: string;
  readonly type: ArrayType;
  readonly constant: true;
  readonly bytes: readonly number[];
}

export type EmbeddedValue = EmbeddedArrayValue | EmbeddedScalarValue;

/** Immutable resident asset with target bytes. */
export interface ResidentAsset {
  readonly kind: "resident-asset";
  readonly id: string;
  readonly sourcePath: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly bytes: readonly number[];
  readonly handler: AssetProvenance;
  readonly constraints: readonly AssetConstraint[];
  readonly placement?: PlacementConstraints;
}

/** Compile-time-only scalar or zero-byte asset with no resident address. */
export interface ScalarAsset {
  readonly kind: "scalar-asset";
  readonly id: string;
  readonly sourcePath: string;
  readonly inputSha256: string;
  readonly outputSha256: string;
  readonly handler: AssetProvenance;
  readonly scalarType: ScalarType | null;
  readonly scalarValue: bigint | boolean | null;
  readonly constraints: readonly AssetConstraint[];
}

export type SemanticAsset = ResidentAsset | ScalarAsset;
```

Scalar and zero-byte assets never enter `residentAssetRoots`, `machine/lower-data.ts`, final layout,
`.memory.json` or `.costs.json`. They are recorded in `.assets.json` with an additive
`placement.kind:"compileTime"` record (payload 0, emitted 0, encoded output hash) and in
`.debug.json` as compile-time symbols. This satisfies R6.6 without inventing resident storage.

### Identity

File: `packages/compiler/src/assets/asset-identity.ts`

```ts
/** Build the canonical native identity from every input that can change the selected output. */
export function nativeAssetId(provenance: AssetProvenance, sourcePath: string): string;

/** Keep the existing raw identity stable for unregistered bytes. */
export function rawAssetId(sourcePath: string, outputSha256: string): string;
```

The native hash input is:

```text
blend65-asset-v1\0<handlerKey>\0<handlerVersion>\0<sourcePath>\0<inputSha256>\0<selector>\0<representation>\0<outputSha256>
```

The `.assets.json` evidence `id` is extended additively to include the input identity and
representation, so distinct files with equal output bytes remain distinct (R6.7). The exact
canonical hash payload is updated in `artifacts/assets-evidence-validator.ts` and its test
expectations.

### Dispatch

File: `packages/compiler/src/assets/asset-dispatch.ts`

```ts
/** Resolve one literal request through the selected profile's closed handler map. */
export function dispatchAsset(
  request: AssetHandlerRequest,
  handlers: ReadonlyMap<string, AssetHandler>,
  reservedExtensions: ReadonlySet<string>,
): AssetHandlerOutput | AssetHandlerFailure;
```

The function is pure except for the already-read bytes. A canonical extension in
`reservedExtensions` but without a registered handler returns E10204 before raw fallback (AR-53).
The function never touches the filesystem.

### Integration points

1. `source-discovery.ts` adds `owner: "resident" | "loadable"` to `EmbeddedRequest`, reusing the
   existing internal owner values without narrowing `mutable`/`local` diagnostics.
2. `service.ts` selects the frontend profile, looks up the handler by canonical extension, and calls
   `dispatchAsset`.
3. `builtin-calls.ts` injects either `EmbeddedArrayValue` or `EmbeddedScalarValue`.
4. `aggregate-types.ts` infers array extents only for array values. A scalar value must match the
   declared scalar type exactly; a selector type mismatch is E10144.
5. `placeSemanticAssets` merges source `place(...)` with handler constraints. Source may only
   strengthen; a weakening conflict is E10273 and a one-object handler-constraint failure is E10143.
6. `semantic/lower.ts` filters scalar assets out of `residentAssetRoots`.
7. `services/evidence.ts` writes resident asset records and compile-time scalar records.

### Owner and loadable behavior

`EmbeddedRequest.owner` is `"loadable"` when the initializer belongs to a `loadable const`. RD-06 is
resident-only (AR-3). If the extension resolves to a registered native handler and the owner is
`loadable`, dispatch stops before parsing and reports E10204 on the `embed(...)` call with a message
that native loadable delivery belongs to RD-07. Raw `loadable const` behavior is unchanged. The
temporary restriction is recorded in `test/rd04/expressiveness-ledger.json`.

### Error handling

| Error case | Handling strategy | AR Ref |
| --- | --- | --- |
| Path or selector not a string literal | Existing E10136 / E10250 before dispatch | AR-17 |
| Unknown extension with a selector | E10137 before any read | AR-18 |
| Reserved-but-unimplemented native extension | E10204 before raw fallback | AR-53 |
| Registered extension with no default and no selector | E10132 naming the available selectors | AR-24 |
| Selector absent from the parsed file's inventory | E10133 listing available selectors | AR-17 |
| Handler parse failure or adjacent version | E10204 naming the exact field/offset, no bytes | AR-17, AR-50 |
| Selected output exceeds 65,535 bytes | E10265 before selector exposure | AR-12 |
| Scalar selector used in array context or wrong declared type | E10144 with the required type | AR-23 |
| Array extent/type mismatch for a raw asset | Existing E10140 | AR-23 |
| Native handler under `loadable const` | E10204, RD-07 boundary + ledger | AR-3 |
| Two declarations resolve to the same canonical object | One asset address and W10151 | AR-26 |
| One-object handler alignment/visibility failure | E10143 naming the constraint | AR-11 |
| Source/cross-object/bank/reserved conflict | E10273 naming every contributor | AR-11 |

Diagnostics never include host absolute paths or arbitrary binary contents; E10130 is rendered with
project-relative roots (RD-06 R6.48).

## Code Examples

### Raw inclusion remains unchanged

```blend65
const TABLE: byte[] = embed("table.bin"); // handler "raw", selector "raw"
```

### Native selectors produce exact types

```blend65
const SPRITES: byte[] = embed("player.spd");            // default "sprites"
const COUNT: word = embed("player.spd", "count");       // scalar word, no resident bytes
const CHARSET: byte[] = embed("level.ctm", "charset");  // handler constraint: 2048 align, VIC
```

### Same file, different selectors

```blend65
const MAP: byte[] = embed("level.ctm", "map");
const MAP_WORD: word[] = embed("level.ctm", "map_word");
// Distinct canonical objects even when every value fits in a byte.
```

## Testing Requirements

- Unit tests for identity, dispatch, reserved extensions, owner rules, scalar/array injection and
  diagnostic spans.
- Integration tests for source-relative resolution, profile selection and evidence records.
- Regression tests proving the existing raw path and its W10151 behavior are unchanged.
- Negative tests for nonliteral arguments, unknown selectors, native loadable, reserved extensions
  and registered malformed input.
- Compile-time scalar records prove no resident bytes or placements.
