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
  | { kind: "ok"; bytes: Uint8Array; resolvedPath: string } // canonical absolute asset path
  | { kind: "not-found" }          // → E10201
  | { kind: "outside-root" }       // → E10205
  | { kind: "too-large"; size: number }; // → E10202-family message, 65536 cap

/** Resolves and reads a binary asset referenced from a source file.
 *  Keyed by the `SourceId` of the .blend file containing the embed() — the only file
 *  identity the frontend possesses (`AnalyzeInput` carries no paths; spans hold a
 *  `SourceId` only, and the SourceMap interns project-relative display paths). All path
 *  knowledge and resolution policy live in the implementation; `resolvedPath` in the ok
 *  arm is how the frontend learns the canonical asset path for `embeddedAssets`. */
export interface AssetReader {
  readAsset(sourceId: SourceId, relPath: string): AssetReadResult;
}
```

Binary contract is `Uint8Array` end-to-end — `CompilerHost.readFile` (utf8) is NOT used
(challenger-verified corruption ≥ `$80`).

### Disk implementation (compiler layer, beside `run-frontend.ts`)

Policy (AR-10/AR-11, mirroring the `runtime/embed.ts:97-111` guard shape):

1. Reject absolute `relPath` and any escape sequence / non-ASCII in the path literal
   (`not-found`-style rejection with an invalid-path message under E10201).
2. `sourcePath = sources.get(sourceId)` — the reader closes over the
   `Map<SourceId, absolutePath>` built during interning; an unknown id → `not-found`.
   Then `resolve(dirname(sourcePath), relPath)`.
3. Containment, lexical first and then canonical: check the resolved path against
   `resolve(config.projectRoot) + sep` → `outside-root` on escape. This step needs no
   filesystem access, so a `..` escape is E10205 whether or not the target exists (ST-28's
   "file existence irrelevant"). Then `realpathSync` the resolved path (ENOENT →
   `not-found`) and re-check the canonical path against `realpathSync(config.projectRoot)
   + sep` (computed once) → `outside-root` on a symlink escape — a lexical-only prefix
   check would pass a symlink inside the project pointing outside it, and RD-18's Security
   clause requires canonical paths. `--asset-path` does not exist (EMB-2 deviation,
   recorded).
4. `stat` BEFORE read: size > 65536 → `too-large` (size-bomb guard; nothing larger fits the
   address space).
5. `readFileSync` → re-check `bytes.byteLength <= 65536` (closes the stat→read race) →
   `ok` with `resolvedPath` = the canonical path from step 3.

`run-frontend.ts` builds the `Map<SourceId, absolutePath>` while interning (the absolute
path and the freshly-interned id sit adjacent in its read loop), constructs the reader from
it + `config.projectRoot`, and passes it as the new optional `AnalyzeInput.assetReader`.

### Analysis-time typing (frontend)

`EmbedExpr` is handled ONLY in declaration typing (like the string desugar — before coverage
checks); the typing site calls `readAsset(embedNode.span.sourceId, path)`. Legality (EMB-1's
const-only/compile-time rule, tightened by the recorded AR-11 decision to
module-level/full-initializer — Ch 13's text does not itself pin those two): the
initialiser must be exactly an `EmbedExprNode`, the
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
  The ok arm's `resolvedPath` feeds the `embeddedAssets` entry. `length()` folding and
  index-tier rules see a normal sized const array from here on.

### Provenance + watch seam (AR-12)

- `ConstValue` (`packages/core/src/semantics/const-value.ts`) gains optional
  `source?: "embed"`; `lower.ts`'s constData collection maps it to
  `ConstDataEntry.type: "embed"` (falling back to the existing struct/array derivation) — the
  pre-typed arm becomes honestly reachable.
- `SemanticModel` (`packages/core/src/semantics/semantic-model.ts`) gains
  `readonly embeddedAssets: ReadonlyMap<string, string>` (symbol FQN → canonical absolute
  asset path, taken from the ok arm's `resolvedPath`) — the invalidation edge a future
  watch/LS host needs. Populated at the typing site; empty map when no embeds.

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

Spec tier ST-25..ST-35 (incl. the security negatives — traversal via `..`, absolute path);
impl tier: byte-identity on a ≥`$80` fixture, provenance mapping, `embeddedAssets`
population, stat-cap ordering (no read on oversized) + the post-read size re-check, and
canonical containment incl. a symlink-escape probe (a symlink inside the project targeting
outside it → `outside-root`).
