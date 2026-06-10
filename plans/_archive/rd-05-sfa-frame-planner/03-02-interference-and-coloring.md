# Interference Graph & Frame Coloring: RD-05 SFA Frame Planner

> **Document**: 03-02-interference-and-coloring.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-05 R7–R18, R21/R22, §4.3/§4.4; spec Ch 11 §3.4

## Overview

Two frontend passes that share frame memory between functions whose lifetimes never overlap:
1. **`interference.ts`** — builds an interference graph from the call graph (ancestor-descendant
   pairs interfere; interrupt/escaped/`main` interfere with all; unreachable excluded).
2. **`coloring.ts`** — greedy chordal coloring assigns each function a frame offset such that
   interfering functions never overlap, minimizing the total frame-region size.

## Architecture

### New Types (core `sfa/`) — reused by ZP allocator (03-03)

```typescript
// packages/core/src/sfa/frame.ts (continued)

export interface InterferenceGraph {
  readonly nodes: ReadonlySet<string>;                 // function names
  /** Adjacency: name -> set of interfering names (symmetric). */
  readonly edges: ReadonlyMap<string, ReadonlySet<string>>;
}
```

### New Functions (frontend `sfa/`)

```typescript
// interference.ts
export function buildInterferenceGraph(fns: readonly FunctionInfo[]): InterferenceGraph;

// coloring.ts
export interface ColoringResult {
  readonly offsets: ReadonlyMap<string, number>;  // functionName -> frame offset
  readonly frameRegionSize: number;               // max(offset + size) = peak (R21/R22)
}
export function colorFrames(
  frames: ReadonlyMap<string, FunctionFrame>,
  graph: InterferenceGraph,
): ColoringResult;
```

## Implementation Details

### Interference graph construction (R10–R17, §4.3)

**Inputs:** `FunctionInfo[]` (provides `callees`, `isInterrupt`, `isEscaped`, `isReachable`).

**Step 0 — reachable set (R17):** `nodes = { fn.name | fn.isReachable }`. Unreachable functions
are excluded entirely (no node, no frame offset later). (Unused-function W10181 is a checker/RD-04
concern, not emitted here.)

**Step 1 — ancestor-descendant edges (R10/R11):** the call graph (built from `callees`) is a DAG
(recursion already rejected by RD-04, R8 — the planner asserts acyclicity but does not re-detect).
For every function `F`, every function reachable from `F` along call edges is a **descendant**;
`F` interferes with each descendant (they can be simultaneously active on the stack). Equivalent
to: for each edge chain, all ancestor-descendant pairs interfere.

Concrete (ancestor enumeration via DFS, §4.3):
```
for each reachable F:
  descendants = DFS(F over callees, excluding F itself)
  for each D in descendants: addEdge(F, D)
```

**Step 2 — always-live nodes (R13/R14/R15):** any node that is `isInterrupt` **or** `isEscaped`
**or** is `main` interferes with **every** other node:
```
alwaysLive = { n in nodes | n.isInterrupt || n.isEscaped || isMain(n) }
for each L in alwaysLive:
  for each other in nodes, other != L: addEdge(L, other)
```
- **R13 `main`:** as the root, `main` is an ancestor of all reachable functions, so Step 1 already
  connects it to all descendants; treating it as always-live is consistent and harmless.
- **R14 interrupt:** fire asynchronously → live throughout → interfere with all (incl. each other).
- **R15 escaped:** address-taken → conservatively always-live (FUT-003 insurance, AR-93).

`addEdge` is symmetric and idempotent (a `Map<string, Set<string>>`).

> **`isMain` rule:** a function is `main` if its `name` equals `"main"` or ends with `.main`
> (fully-qualified `module.main`). Recorded here so coloring is deterministic regardless of module
> naming; the live adapter (RD-04b) will mark the resolved entry point explicitly later.

### Frame coloring (R12/R16/R18, §4.4)

The interference graph from a call tree is **chordal**, so greedy coloring in a fixed order is
optimal. We color **intervals** (each function occupies `[offset, offset+size)`), not single
colors, because frames have sizes.

```
Input:  frames: Map<name, FunctionFrame>, graph: InterferenceGraph
Output: ColoringResult

1. order = nodes sorted by (frame.totalSize DESC, name ASC)   // determinism, R18
2. offsets = {}
3. for F in order:
     occupied = []                       // intervals of already-placed neighbors
     for N in graph.edges[F]:
       if N in offsets:
         occupied.push([ offsets[N], offsets[N] + frames[N].totalSize ))
     O = smallestNonNegativeOffset such that [O, O+frames[F].totalSize) overlaps no occupied interval
     offsets[F] = O
4. frameRegionSize = max over F of (offsets[F] + frames[F].totalSize), or 0 if empty
5. return { offsets, frameRegionSize }
```

**Smallest-offset search:** sort `occupied` by start; walk gaps from 0 upward, placing `F` in the
first gap ≥ `totalSize`; if none, place at the max end. Deterministic given the fixed order.

**Properties (§4.4):**
- Interfering functions never overlap (soundness).
- Non-interfering functions may overlap (sharing).
- `frameRegionSize` = peak simultaneous footprint (R21/R22) — **not** the sum of all frames.
- Deterministic (R18): identical `(frames, graph)` → identical offsets.

- **Zero-size frames:** a function with `totalSize 0` gets `offset 0` and contributes nothing to
  `frameRegionSize` (it occupies an empty interval).

## Code Examples

### Ch 11 §3.4 worked example (drives AC-07)

```
Call graph: main → {init, update, render}
            update → {handleInput, moveEnemies}
            render → {drawBackground, drawSprites}

Interference (ancestor-descendant + main-as-root):
  main ↔ everything
  update ↔ {handleInput, moveEnemies}
  render ↔ {drawBackground, drawSprites}

Non-interfering (may share):
  init ↔ update ↔ render          (sequential siblings under main)
  handleInput ↔ drawSprites        (different subtrees)
  moveEnemies ↔ drawBackground     (different subtrees)

Result: init/update/render share frame memory; handleInput/drawSprites share;
        moveEnemies/drawBackground share.  (AC-07)
```

## Error Handling

| Error Case                          | Handling Strategy                                            | AR Ref |
| ----------------------------------- | ------------------------------------------------------------ | ------ |
| Cycle in call graph (shouldn't occur) | Planner asserts acyclicity; DFS uses a visited set to avoid infinite loop, never throws | R8 |
| Unreachable functions               | Excluded from nodes; no offset assigned                      | R17    |
| Empty function set                  | `frameRegionSize = 0`; empty offsets map                     | R60    |
| Callee name not in node set         | Ignored (dangling edge from partial input) — error tolerance | R61    |

> **Traceability:** all behavior maps to RD-05 §4.3/§4.4 and Ch 11 §3.4.

## Testing Requirements

- Unit: interference edges for a linear chain, a tree, sibling subtrees.
- Unit: interrupt node interferes with all; escaped node interferes with all; unreachable excluded.
- Unit: coloring overlap for non-interfering, non-overlap for interfering; `frameRegionSize` = peak.
- **Golden/spec:** the Ch 11 §3.4 example (AC-07) — exact sharing groups + region size.
- Determinism: same input twice → identical offsets (R18/AC-16).
- See `07-testing-strategy.md` ST-I1..ST-I6, ST-C1..ST-C6.
