# Translate & Data Emission: RD-18 Slice 7a

> **Document**: 03-06-translate-data.md
> **Parent**: [Index](00-index.md)

## Overview

Retires the E90001 boundary for `load_indexed`/`store_indexed` (tier-1 `abs,X` framings — RD-07
R29/R42; the indirect pair stays ICE'd for 7b) and turns `constData` entries into ACME `!byte`
data streams through the already-shipped `segment:"data"` serializer path.

## Implementation Details

### 1. Translate arms (`translate.ts` dispatch)

**Prescan fixes FIRST (PF-002 — the plumbing is NOT ready for the load variants):** the loads
carry their destination in `value` (`instruction.ts:114-120`), which `destTempId`
(`translate.ts:1438-1453`) misses — it cases only the STORE variants, so a `load_indexed` def
is invisible to the prescan (a result live across a `JSR` escapes the curated call guard at
`:389-400`) — and `readOperands` (`:1508-1510`) counts that destination as a READ, permanently
inflating its `useCount` and disabling single-use folds. Required, in the same change as the
new arms:

- `destTempId`: return the `value` operand's temp id for `load_indexed`/`load_indirect`
- `readOperands`: return `[base, index]` (NOT `value`) for the load variants

New arms, following the shipped flag-fresh idioms:

- **`load_indexed` byte**: `LDX <idx-home>` → `LDA <sym>+k,X` (AbsoluteX; `symbolRef` offset
  path exists) → `STA <dest-home>` (home the result — obligation 2 below; a bare A-bind dies
  in the binder when the next op needs A, e.g. `sum = sum + a[i]`) → `bindA(dest)`
- **`store_indexed` byte**: materialise the value to A or confirm it readable from memory
  (immediate/home/bound — existing binder), `LDX <idx-home>` → `STA <sym>+k,X`
- **`load_indexed` word** (word elements): `LDX <idx>` → `LDA sym+k,X` / `STA <dest-lo-home>` →
  `LDA sym+k+1,X` / `STA <dest-hi-home>` — stash-to-home immediately so the A:X word-binding
  convention never collides with X-as-index (02-current-state risk row)
- **`store_indexed` word**: the source word must be readable from MEMORY before X is loaded —
  if the source is A:X-bound with no home (canonical: `warr[i] = f();`, word calls bind A:X),
  stash it to its home FIRST (PF-004: `LDX <idx>` physically destroys an X-resident high byte;
  reading it afterwards through the stale `regX` mirror would emit `TXA` and silently store the
  index as data). Then `LDX <idx>` → `LDA <src-lo-home>` / `STA sym+k,X` → `LDA <src-hi-home>`
  / `STA sym+k+1,X`
- `load_indirect`/`store_indirect`: keep the documented E90001 ICE (message updated to "7b")

**State obligations per arm (PF-002/PF-004 shared remedy)** — every new arm must satisfy ALL of:

1. **Prescan visibility**: the arm's destination is returned by `destTempId` and NOT counted by
   `readOperands` (the fixes above).
2. **Result homed**: the destination value is stored to its frame home before arm exit.
3. **Truthful mirrors at exit**: byte arms end `bindA(dest)` (which also nulls `regX` —
   `translate.ts:1383-1385`); word arms end with explicit mirror reconciliation
   (`clearRegs()` or exact `regA`/`regX` updates).
4. **X-mirror invalidation**: `LDX <idx>` invalidates any X-resident word high byte
   (`regX`, `translate.ts:166`) — reconcile (stash/clear) BEFORE emitting the `LDX`, never
   after.

Exact register choreography otherwise follows the shipped translate discipline (no arithmetic
synthesis — AR-15 guarantees the index is a ready byte offset; X chosen per RD-07 R42).

### 2. Data streams
For each `ILProgram.constData` entry, `generateInstr` appends an `InstrStream`
`{ symbol, segment: "data", entries: [label(symbol), directive(byte-rows…)] }` — `!byte` rows
capped at 16 values/row for readable goldens. The serializer already orders code → data
(`serialize-acme.ts:118-125`); ACME places the bytes in-image after code, so const data is
**read-in-place** — no startup copy. `needsDataInit` (`instr-program.ts:189`) auto-trips true
on non-empty `constData` — verified at preflight (PF-011): the flag has NO consumers
(`platform-plugin.ts:40` declares it; no preamble/shim/plugin reads it — contrast
`hasInitCode` → `shared-hooks.ts:100-101` `JSR __init`), so it flips true harmlessly and there
is nothing to neutralize; the implementation-time audit is a confirmation, not an
investigation. The goldens (all seven prior must stay byte-exact, plus the new slice7 golden)
remain the drift detector. Verify `printInstr` renders the `byte` directive; extend it if only
preamble directives are covered today.

### 3. Placement & overlap
Data streams extend the PRG image; the shipped post-ACME code/data overlap check (5a, E10033
band, keyed off the plan's `dataBase`) still guards the RAM region; binary growth surfaces in
the ResourceReport delta (rollout phase).

## Error Handling

| Error Case | Handling Strategy | AR Ref |
|------------|-------------------|--------|
| indirect ops reach translate | E90001 with the 7b message (documented boundary) | AR-1 |
| index temp not byte-typed | assert-ICE (lowering guarantees byte offsets) | AR-15 |
| constData entry with empty bytes | assert-ICE (images are ≥1 byte by E10111) | AR-13 |

## Testing Requirements
- Spec: ST-51a/ST-51b (scaling warning/shape), ST-53..ST-58 incl. ST-53a (accumulate through an
  indexed read — result homed) and ST-54a (word store from a live A:X source — stash before
  `LDX`) (ASM shapes via `emitAsm`, golden landmarks). Impl: framing unit tests per
  op × width, data-row formatting, prior-golden byte-exactness sweep.
