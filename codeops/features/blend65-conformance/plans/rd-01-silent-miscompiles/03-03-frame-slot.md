# Frame Slot (M-03): widest-slot sizing + per-declaration types

> **Document**: 03-03-frame-slot.md
> **Parent**: [Index](00-index.md)
> **Implements**: RD-01 R5, R6; AR-3, AR-6, AR-9; AC-8, AC-9

## Overview

Three populations share one name-collapsed frame slot:

1. **Nested reuse / shadowing** — spec violations, cured by **diagnostics** (R5).
2. **Sibling reuse, store overrun** — spec-legal; the slot is sized last-wins so a wider store
   overruns the next variable. Cured by sizing the slot to the **widest** declaration (R6).
3. **Sibling reuse, read truncation** — the same last-wins collapse makes a *read* of the wider
   declaration resolve through the narrower type, so the load truncates. Cured by retaining
   **per-declaration types** so each use lowers at its own width (R6, AC-9).

**No diagnostic may fire on sibling reuse** — sharing one slot is the byte-frugal layout a
hand-coder wants; a diagnostic here would reject universal idiomatic code (Prime Directive
clause 4). **Allocation stays positional** (AR-3, load-bearing): this is a width rule and a
type-retention rule, never a scoping rule.

## Architecture

### Current Architecture

- `frame-computation.ts:52-64` — one `FrameSlot {name, kind, type, size, offset}` per local; a
  name collision keeps the last-declared type.
- `slotIlType` (`lower.ts:2822-2825`) resolves width by `slots.find(s => s.name === varName)` —
  name-keyed, last-wins. Reads (`lower.ts:1184`) and stores (`:525`, `:1634`) all use it.
- `function-collection.ts` harvests if/for/switch locals **flat** into one function scope;
  `bodyScope.symbols.set(name, sym)` keeps one `Symbol` per name (last-wins), no scope tree.

### Proposed Changes

> **Ordering (PF-002).** The name-collapse happens **upstream** of `frame-computation`: at
> `function-collection.ts:326` (`bodyScope.symbols.set(name, sym)` — a last-wins Map), so by the
> time `model-adapter.ts:429-441` projects `scope.symbols.values()` into `FunctionInfo.locals` and
> `computeFrame` (`frame-computation.ts:52-66`) runs, **exactly one width per name survives**. Widest-
> sizing is therefore not implementable at `frame-computation` — it must consume the retained
> widths. Parts land **C → A → B**: retention first, then diagnostics and sizing both build on it.

**Part C — per-declaration types (population 3, AR-P4) — lands first.** Retain each declaration's
type and resolve **each use** to the type of the declaration in scope at that use, so a read lowers
at its own declared width regardless of the shared slot's storage size. Grounded mechanism: leave
slot allocation positional; add enough sibling-distinguishing structure (retained per-declaration
types on the `Symbol`, `core/src/semantics/symbol.ts`) that a use resolves to its own declaration's
type. Read width from that resolved type at **every local-width consumer in lowering** — not only
the read at `lower.ts:1184` but also the for-**counter** resolution `lower.ts:701` and the
let-store `:525` (PF-012; `:395`/`:1081` are parameter paths, already errors on collision). Option B
(scope-qualified slots) is **rejected** — it re-homes slots via the positional-slot-counter
fragility (issue #73), manufacturing the very defect class this RD kills (AR-3).

**Part A — R5 diagnostics (population 1).** Diagnose nested reuse and shadowing during symbol
collection / type-checking, where the scope relationship is known (needs Part C's sibling-vs-nested
structure to fire on nested reuse while staying silent on siblings):

- local shadowing a **module variable**, a **parameter**, or an **in-scope local** → `E10101`
- **duplicate in one scope** → `E10003`
- **nested** loop reusing its enclosing counter → `E10062`

**Part B — R6 slot sizing (population 2).** Size the collapsed slot to the **widest** colliding
declaration, at the seam where the colliding widths still exist — the retention layer's projection
into `FrameVar`s (`collectFrameVars` / `model-adapter.ts`), **not** `frame-computation.ts:52-64`,
which never sees more than one width per name. Offsets stay **positionally recomputed**: the
collapsed slot grows, and every later slot in that frame shifts by the width delta — **that shift is
the fix**, not a regression (PF-011). The invariant to assert is order-stability and no-overlap, not
offset identity.

## Implementation Details

### Diagnostics (Part A)

| Code | Trigger | Registered? |
| ---- | ------- | ----------- |
| `E10101` | shadow of module var / param / in-scope local | yes |
| `E10003` | same-scope duplicate | yes |
| `E10062` | **nested** counter reuse | **no — register it in `packages/core/src/diagnostics/diagnostic-codes.ts`** (RD AR-6; `spec/05:270` scopes it to nested reuse only) |

Message text drafted following registry phrasing (AR-P6); no `codeops`/RD ids in messages.
`E10062` registration is a `@blend65/core` edit (the registry lives only in core; `E10003`/`E10101`
already exist there).

### Symbol / type retention (Part C)

`registerLocal` (`function-collection.ts`) and the `Symbol` type (`core/src/semantics/symbol.ts`)
gain per-declaration type retention (indicative — final shape is the executor's, honoring "one
Symbol per name" storage where allocation depends on it): each declaration's `type` is preserved
and reachable from its uses, so type resolution at a use is per-declaration, not last-wins.
Lowering reads the resolved per-declaration width at `lower.ts:701` (counter), `:525` (let-store),
`:1184` (read), `:1634` (store) instead of the name-keyed `slotIlType`. The frame-slot table's
positional **algorithm** is unchanged; slot *offsets* recompute as sizes change (Part B).

### Sizing (Part B)

At the retention-layer projection into `FrameVar`s (`collectFrameVars` / `model-adapter.ts`) —
where all colliding declarations for a name are still visible — collapse them to one slot whose
`size`/`type` is the **widest**. `frame-computation.ts` then assigns offsets by its existing
positional running sum over the (now correctly-sized) slots; later slots shift by the width delta.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Nested reuse / shadowing (pop 1) | `E10062` / `E10101` / `E10003` | RD AR-6, R5 |
| Sibling reuse, wider store (pop 2) | widest-slot sizing; **no diagnostic** | RD R6, AC-9 |
| Sibling reuse, wider read (pop 3) | per-declaration read width; **no diagnostic** | RD AR-P4, AC-9 |
| **Sibling for-counters at differing widths** (`for(let i:byte…){} for(let i:word…){}`) | spec-legal siblings (E10062 is nested-only); per-declaration width covers `:701`, so **no new miscompile**; no diagnostic | AR-P4, PF-012 |
| Module-var shadow that compiles correctly today | `E10101` is **conformance**, not miscompile-prevention — severity story says so | RD AR-9 |

> **Traceability:** R5-is-diagnostics-not-scope, widest-not-last-wins, and per-declaration-types
> are RD AR-3 (+ AR-P4 for the mechanism). The positional-allocation fence is load-bearing.

## Testing Requirements

- Spec (`[CI]`, frontend tier): five R5 diagnostics — module-var shadow, param shadow, in-scope-local
  shadow (`E10101`), same-scope duplicate (`E10003`), nested counter reuse (`E10062`) (AC-8,
  ST-25…ST-29); sibling reuse compiles with **no diagnostic** + a **layout** assertion that the
  widened slot's neighbour is at a non-overlapping offset (pop 2, ST-30/ST-31); a **sibling
  for-counter** case at differing widths compiles with no diagnostic (PF-012, ST-30b).
- Spec (`[CI]`, **test-harness tier** — R15 keeps emitted asm out of the frontend, so the store/read
  **extent** lives here, not in the frontend ST-31 above): the pop-2 word/byte sibling store writes
  no byte outside its slot, **and** the pop-3 `pokew($D000, t)` in the `word` arm lowers
  `LDA t / LDX t+1 / STA $D000 / STX $D000+1`, not the truncated one-byte load — a value assertion,
  since an address-only oracle passes the truncation case while still wrong (AC-9, ST-32). **Plus the
  sibling for-counter width oracle** (ST-30c, PF-037): the byte loop's counter compare/step emit at
  byte width and the word loop's at word width — proving the `:701` per-declaration fix that the
  frontend tier (ST-30b) cannot observe.
