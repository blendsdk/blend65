# Embed: RD-18 Slice 8b

> **Document**: 03-03-embed.md
> **Parent**: [Index](00-index.md)
> **Governs**: AR-10, AR-11, AR-12, AR-13

## Overview

Raw-binary `embed()` end-to-end: the core `AssetReader` seam, the compiler-layer disk
implementation with the Parked-Q2 traversal policy, analysis-time typing (EMB-1..4), and data
emission through the shipped const-data path.

## Implementation Details

### New types (core, `host/asset-reader.ts`)

```ts
export type AssetReadResult =
  | { kind: "ok"; bytes: Uint8Array }
  | { kind: "not-found" }          // → E10201
  | { kind: "outside-root" }       // → E10205
  | { kind: "too-large"; size: number }; // → E10202-family message, 65536 cap

/** Resolves and reads a binary asset referenced from a source file.
 *  `fromSourcePath` is the ABSOLUTE path of the .blend file containing the embed(). */
export interface AssetReader {
  readAsset(fromSourcePath: string, relPath: string): AssetReadResult;
}
```

Binary contract is `Uint8Array` end-to-end — `CompilerHost.readFile` (utf8) is NOT used
(challenger-verified corruption ≥ `$80`).

### Disk implementation (compiler layer, beside `run-frontend.ts`)

Policy (AR-10/AR-11, mirroring the `runtime/embed.ts:97-111` guard shape):

1. Reject absolute `relPath` and any escape sequence / non-ASCII in the path literal
   (`not-found`-style rejection with an invalid-path message under E10201).
2. `resolve(dirname(fromSourcePath), relPath)`, then containment check against
   `resolve(config.projectRoot) + sep` → `outside-root` on escape. `--asset-path` does not
   exist (EMB-2 deviation, recorded).
3. `stat` BEFORE read: size > 65536 → `too-large` (size-bomb guard; nothing larger fits the
   address space).
4. `readFileSync` → `ok`.

`run-frontend.ts` constructs it from `config.projectRoot` + the source-file map and passes it
as the new optional `AnalyzeInput.assetReader`.

### Analysis-time typing (frontend)

`EmbedExpr` is handled ONLY in declaration typing (like the string desugar — before coverage
checks). Legality (EMB-1, AR-11): the initialiser must be exactly an `EmbedExprNode`, the
declaration must be a **module-level `const`** with a `byte`-element array annotation
(sized or unsized); every other position/kind — `let`, local, zeropage field, expression
position, non-byte element — → **E10200** (Ch 13 wording). `format !== null` → loud **E90001**
"format-aware embed() is not supported yet — use raw embed(path)". `.selector` needs no
special case (field access on an array type fails through the existing path).

On the legal shape:
- No reader injected (LS/tests) → documented **silent poison** (ERROR_TYPE, no diagnostic,
  never a fabricated size) — AR-12.
- `not-found`/invalid-path → **E10201** (message names the path; no `--asset-path` clause).
- `outside-root` → **E10205** `EmbedPathEscapesRoot` (mint; message names the path and the
  project root, mirroring E10246's shape).
- `too-large` → **E10202**-family message naming the 65536 cap.
- `ok`: sized annotation with `bytes.length !== N` → **E10202** (Ch 13 wording). Else the
  symbol's array size is set/inferred from `bytes.length` (reusing the `inferUnsizedArray`
  patch path), and `ctx.constValues.set(sym, { type, value: 0, bytes, source: "embed" })`.
  `length()` folding and index-tier rules see a normal sized const array from here on.

### Provenance + watch seam (AR-12)

- `ConstValue` gains optional `source?: "embed"`; `lower.ts`'s constData collection maps it to
  `ConstDataEntry.type: "embed"` (falling back to the existing struct/array derivation) — the
  pre-typed arm becomes honestly reachable.
- `SemanticModel` gains `readonly embeddedAssets: ReadonlyMap<string, string>` (symbol FQN →
  resolved absolute asset path) — the invalidation edge a future watch/LS host needs. Populated
  at the typing site; empty map when no embeds.

### Emission (AR-13)

Nothing new: embed bytes flow as a `ConstDataEntry` through `constDataStream` → labeled
`!byte` rows (16/row) in the `data` segment, label `__data_<Module>_<name>`. No `!bin`.

## Error Handling

| Error case | Code | AR |
|------------|------|----|
| embed outside module-level const byte-array initialiser | E10200 | AR-11 |
| File not found / invalid path literal | E10201 | AR-10 |
| Resolved path escapes project root | E10205 (mint) | AR-10 |
| Explicit size ≠ file size; file > 65536 | E10202 | AR-11 |
| `format` argument present | E90001 loud | AR-11 |
| Reader absent (non-compiler host) | silent poison, documented | AR-12 |

## Testing Requirements

Spec tier ST-25..ST-36 (incl. the security negatives — traversal via `..`, absolute path,
symlink-free containment on resolved prefix); impl tier: byte-identity on a ≥`$80` fixture,
provenance mapping, `embeddedAssets` population, stat-cap ordering (no read on oversized).
