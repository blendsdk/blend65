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

**Part A — R5 diagnostics (populations 1).** Diagnose nested reuse and shadowing during symbol
collection / type-checking, where the scope relationship is known:

- local shadowing a **module variable**, a **parameter**, or an **in-scope local** → `E10101`
- **duplicate in one scope** → `E10003`
- **nested** loop reusing its enclosing counter → `E10062`

**Part B — R6 slot sizing (population 2).** In `frame-computation.ts`, when locals collide by
name, size the single slot to the **widest** colliding declaration (max `size`, widest `type`)
rather than last-wins. Offsets/positions of all other slots are unchanged (width-only change).

**Part C — per-declaration types (population 3, AR-P4).** Retain each declaration's type and
resolve **each use** to the type of the declaration in scope at that use, so a read lowers at its
own declared width regardless of the shared slot's storage size. Grounded mechanism: leave slot
allocation positional; add enough sibling-distinguishing structure that a use resolves to its own
declaration's type, and read width at the lowering use site (`lower.ts:1184`) from that resolved
type rather than from the name-keyed slot. Option B (scope-qualified slots) is **rejected** — it
re-homes slots via the positional-slot-counter fragility (issue #73), manufacturing the very
defect class this RD kills (AR-3).

## Implementation Details

### Diagnostics (Part A)

| Code | Trigger | Registered? |
| ---- | ------- | ----------- |
| `E10101` | shadow of module var / param / in-scope local | yes |
| `E10003` | same-scope duplicate | yes |
| `E10062` | **nested** counter reuse | **no — register it** (RD AR-6; `spec/05:270` scopes it to nested reuse only) |

Message text drafted following registry phrasing (AR-P6); no `codeops`/RD ids in messages.

### Symbol / type retention (Part C)

`function-collection.ts` `registerLocal` and the flat `bodyScope.symbols` map gain per-declaration
type retention (indicative — final shape is the executor's, honoring "one Symbol per name" storage
where allocation depends on it): each declaration's `type` is preserved and reachable from its
uses, so type resolution at a use is per-declaration, not last-wins. The frame-slot table and its
positional offsets are **not** restructured.

### Sizing (Part B)

`frame-computation.ts:52-64` — collapse colliding same-name locals to one slot whose `size`/`type`
is the widest; keep `offset` assignment positional and unchanged for every other slot.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| Nested reuse / shadowing (pop 1) | `E10062` / `E10101` / `E10003` | RD AR-6, R5 |
| Sibling reuse, wider store (pop 2) | widest-slot sizing; **no diagnostic** | RD R6, AC-9 |
| Sibling reuse, wider read (pop 3) | per-declaration read width; **no diagnostic** | RD AR-P4, AC-9 |
| Module-var shadow that compiles correctly today | `E10101` is **conformance**, not miscompile-prevention — severity story says so | RD AR-9 |

> **Traceability:** R5-is-diagnostics-not-scope, widest-not-last-wins, and per-declaration-types
> are RD AR-3 (+ AR-P4 for the mechanism). The positional-allocation fence is load-bearing.

## Testing Requirements

- Spec (`[CI]`): five R5 diagnostics — module-var shadow, param shadow, in-scope-local shadow
  (`E10101`), same-scope duplicate (`E10003`), nested counter reuse (`E10062`) (AC-8, ST-25…ST-29).
- Spec (`[CI]`): sibling reuse compiles with **no diagnostic**; a resolved-address assertion that
  the neighbour is untouched (pop 2); **a value assertion that `pokew($D000, t)` in the `word` arm
  lowers `LDA t / LDX t+1 / STA $D000 / STX $D000+1`, not the truncated one-byte load** (pop 3 —
  an address-only oracle passes the truncation case while still wrong) (AC-9, ST-30…ST-32).
