# Lowering: addr operand, marshalling, prologue, indirect places, tier-2

> **Document**: 03-04-lowering-indirect.md
> **Parent**: [Index](00-index.md)

## Overview

Lowering grows four things: the `addr` operand (AR-12), by-ref argument marshalling +
prologue copies (AR-2/AR-3), a second Place base kind so chains rooted at by-ref params emit
`load_indirect`/`store_indirect` (AR-7), and tier-2 runtime pointer formation (AR-4). The
two loud AR-3 argument ICEs land here. Translate stays arithmetic-free (7a AR-15 discipline):
every address computation is ordinary IL.

## Implementation Details

### 1. The `addr` operand (AR-12)

```ts
// il/operand.ts
| { readonly kind: "addr"; readonly symbol: string; readonly offset?: number }
// constructor: addrOf(symbol, offset?) — word-typed by definition
```

Legal ONLY as a `store` source (arg marshalling). Every other consumer of ILOperand gains an
exhaustiveness arm that ICEs loudly (`iceUnsupported("addr operand in <context>")`).
`--emit-il` prints `&sym+off`.

### 2. Call marshalling (extends `lowerUserCall`, `lower.ts:792-849`)

Per-argument, by the callee param's kind:
- **Scalar param**: unchanged (value store).
- **By-ref param, statically-addressable arg** (AR-3): resolve the arg's place chain via the
  7a machinery; requires a DIRECT base and `index === null` after const folding — i.e.
  symbol + const offset. Emit
  `store(addrOf(placeSymbol, constOffset) → loc(__frame_<Callee>_<param>, word))`.
  Covers whole vars, `Mod.var`, const-indexed elements, member chains, and const aggregates
  (`__data_*` labels — E10122 already gated mutable targets at typing).
- **By-ref param, whole pass-through** (the arg is itself a by-ref param of the CALLER,
  passed whole): word copy of the caller's own frame slot —
  `load(t, loc(__frame_<Caller>_<param>, word)); store(t → callee slot)`. The frame slot is
  the canonical home (AR-2) so no pair read is needed.
- **By-ref param, anything else** (runtime index anywhere in the chain, or pair-rooted with
  offset ≠ whole): **loud ICE** — `"aggregate argument requires runtime address computation
  — not supported until address-of lands"` (AR-3). Classification runs on the RESOLVED chain.

The 5a never-miscompile guards are unchanged; an `addr` store participates in the argument
window like any other store.

### 3. Prologue copies (AR-2)

For each pair-accessed by-ref param (the [03-03](03-03-sfa-pointers.md) shared predicate),
the function's ENTRY block begins with two BYTE copies (challenger refinement — no word-temp
machinery):

```
load  t0 ← loc(__frame_F_p, byte)          store t0 → loc(__zp_ptr_F_p, byte)
load  t1 ← loc(__frame_F_p, byte, +1)      store t1 → loc(__zp_ptr_F_p, byte, +1)
```

Ordinary byte load/stores — translate needs nothing new. Dead/pass-through-only params emit
no prologue. (`__init` never contains by-ref marshalling — 5b's call-free initializer rule.)

### 4. Place extension: pair bases (AR-7)

```ts
interface Place {
  readonly base:
    | { readonly kind: "direct"; readonly symbol: string }      // 7a behavior
    | { readonly kind: "pair"; readonly symbol: string };       // __zp_ptr_F_p
  readonly constOffset: number;
  readonly index: ILOperand | null;   // byte-offset temp/imm (7a domain) — see §5 for word
}
```

`basePlace`: an identifier resolving to a by-ref param symbol → pair base (its pair symbol).
Emission (`emitPlaceLoad`/`emitPlaceStore`):
- **direct** → unchanged 7a (`load`/`store`/`load_indexed`/`store_indexed`).
- **pair**, `constOffset ≤ 255`, index null → `load_indirect(value, ptr: loc(pairSym), offset: imm(constOffset))`.
- **pair**, byte index (tier-1-shaped element access through a sized ≤256 param or unsized
  byte-indexed) → `offset` = the scaled byte-offset operand (7a `scaleIndex` reused; const
  offset folded in via `addByteOffsets`).
- **pair**, `constOffset > 255` OR word index → effective-pointer formation (§5), then
  `load_indirect(..., ptr: t_eff, offset: imm(residual))`.

Whole-struct copy `p = q` through pairs: the 7a per-byte unroll emits `load_indirect`/
`store_indirect` per byte (mixed direct/pair sides compose naturally since each side lowers
independently).

### 5. Runtime pointer formation (tier-2 + big offsets — AR-4/AR-7)

`addr` is store-only (AR-12) and translate synthesizes no arithmetic (7a AR-15), so the
effective pointer is formed with EXISTING ops around the scratch pair. For a direct-base
tier-2 access (`big[i]` with `i: word`, incl. const `__data_*` tables), with element scaling
(7a `scaleIndex`, word-width here) already applied to the index:

```
store(addrOf(base, constOffset) → loc(__zp_ptr_scratch, word))  // the addr store seeds base
t_i   = zext(index) | index                                     // Slice-6 ops; word domain
t_eff = add(load(loc(__zp_ptr_scratch, word)), t_i)             // existing word add
store(t_eff → loc(__zp_ptr_scratch, word))                      // scratch now = base+offset+index
load_indirect(value, ptr: loc(__zp_ptr_scratch), offset: imm(0))
```

Pair-base word indexes and const offsets > 255 form identically, with the add's left operand
`load(loc(pairSym, word))` instead of the seeded scratch. Every op exists today; the only new
translate surface remains the indirect pair + the `addr` store arm. (Chatty IL is accepted —
correctness-first; Phase B owns tightening, per the AR-2 resolution note.)

### 6. Argument-form and unsupported ICEs (AR-3)

| Shape | Action |
| ----- | ------ |
| runtime-indexed arg place (`enemies[i]` as by-ref arg) | loud ICE (deferred to Slice 8 `&`) |
| pair-relative arg place (`p.field` as by-ref arg) | loud ICE (same class) |
| indexed compound-assign through a pair | same loud ICE as 7a's direct case (unchanged deferral) |

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| `addr` outside a store source | ICE via exhaustiveness arm | AR-12 |
| deferred argument shapes | loud `iceUnsupported`, precise wording | AR-3 |
| unsized/pair place with no pair symbol bound | ICE (SFA/lowering drift) | AR-4 |

## Integration Points

- Consumes [03-03](03-03-sfa-pointers.md)'s pair naming + shared access-set predicate.
- Emits only ops translate implements ([03-05](03-05-translate-indirect.md)); the IL printer
  gains `addr` rendering.
- CP-4: const-ness is invisible here — identical IL for const and mutable params.

## Testing Requirements

- Spec tests (IL-shape via `emitIl`): marshalling forms (static place, pass-through, const
  table), prologue presence/absence (dead + pass-through skip), pair-base load/store shapes,
  tier-2 formation sequence, both loud ICEs (ST-34..ST-39, ST-45..ST-47).
- Impl tests: place classification on resolved chains; scratch-sequence determinism.
