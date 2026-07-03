# SourceMap Registry: RD-11b

> **Document**: 03-01-sourcemap.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-11 R13 (completion), R14, R35 support · §4.2 (as amended by AR-104) · AC-03 (already green) enablement for consumers

## Overview

The `SourceMap` is the process-wide registry mapping interned `SourceId`s back to
file paths and contents, and the owner of the per-source `LineMap` cache (R14,
PF-006). It closes the loop RD-11a deliberately left open
(`source-span.ts:16-19`): spans stay tiny numeric triples; the registry resolves
them on demand.

## Architecture

### Current Architecture

`SourceId = number` (shipped). `LineMap` is a shipped class constructed from
`(sourceId, text)`. Nothing assigns ids today.

### Proposed Changes

One new file `packages/core/src/diagnostics/source-map.ts` exporting the
`SourceMap` interface and the `createSourceMap()` factory (closure-based, same
idiom as `createDiagnosticBag` — consistency per `diagnostic-bag.ts:103`).

## Implementation Details

### New Types/Interfaces

```typescript
/** RD-11 §4.2 as amended by AR-104 (adds `has`). */
export interface SourceMap {
  /** Intern a source file, returning its SourceId (path-keyed — see semantics). */
  intern(path: string, content: string): SourceId;
  /** `true` iff `id` was returned by a previous intern() call. Non-throwing probe (R51). */
  has(id: SourceId): boolean;
  /** Path for an interned id. Throws on unknown id. */
  getPath(id: SourceId): string;
  /** Content for an interned id. Throws on unknown id. */
  getContent(id: SourceId): string;
  /** Get-or-build the cached LineMap for an interned id (R14). Throws on unknown id. */
  getLineMap(id: SourceId): LineMap;
}

export function createSourceMap(): SourceMap;
```

### Semantics (all per AR-Q7 / AR-104)

| Case | Behavior |
| ---- | -------- |
| `intern(newPath, content)` | Assigns the next sequential id, starting at **0** |
| `intern(knownPath, sameContent)` | Returns the existing id; no state change |
| `intern(knownPath, newContent)` | Returns the **same** id; content replaced; cached `LineMap` invalidated (rebuilt lazily on next `getLineMap`) — the LSP re-edit path (AR-78 keep-ready) |
| `has(id)` | `true` for every id ever returned by `intern`; `false` otherwise (incl. negatives like `CONFIG_SOURCE_ID = -2` and fractional numbers) |
| `getPath/getContent/getLineMap(unknownId)` | `throw new Error("Unknown SourceId: <id>")` — programmer error; renderers must probe with `has()` first (R51) |

Determinism: ids are assigned in intern order — same intern sequence → same ids
(H5 hard invariant; feeds R18's deterministic bag ordering).

### Integration Points

- `renderTerminal` (03-03) is the first consumer: `has()` → degrade (R51); `getPath` for the `-->` line; `getLineMap` for line/col + excerpts (R35).
- RD-15 will intern every compiled file before lexing and pass real ids to the pipeline; `LoadConfigOptions.sourceId` (RD-16, `config/src/types.ts:104`) lets it replace the config sentinel.
- Exported from `diagnostics/index.ts` → root barrel (§4.8).

## Code Examples

```typescript
const sm = createSourceMap();
const a = sm.intern('main.blend', 'module main;\n'); // 0
const b = sm.intern('lib.blend', 'module lib;\n');   // 1
sm.intern('main.blend', 'module main;\n');           // 0 (no-op)
sm.intern('main.blend', 'module main2;\n');          // 0 (content replaced, LineMap invalidated)
sm.has(-2);                                          // false → renderer degrades (R51)
sm.getLineMap(a).getLineCol(7);                      // { line: 1, column: 8 }
```

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Getter on unknown id | Throw `Error("Unknown SourceId: <id>")` | AR-Q7 |
| Renderer meets unknown id | Never reaches the throwing getters — guards with `has()` | AR-Q7, R51 |
| Re-intern with changed content | Same id, replace, invalidate cache | AR-Q7 |

## Testing Requirements

- Spec tests ST-1..ST-5 (`source-map.spec.test.ts`) — see 07-testing-strategy.md.
- Impl tests (`source-map.impl.test.ts`): LineMap cache identity across calls, invalidation after content change, empty-content file, many-file id sequence, `has()` on fractional/negative ids.
