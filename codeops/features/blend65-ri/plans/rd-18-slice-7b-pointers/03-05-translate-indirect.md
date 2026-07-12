# Translate: (zp),Y framings, regY mirror, staging, backstop

> **Document**: 03-05-translate-indirect.md
> **Parent**: [Index](00-index.md)

## Overview

The ICE seam (`translate.ts:372-377`) is replaced by real framings for the indirect pair,
under the 7a per-arm state-obligation discipline. Prescan liveness is already correct
(`destTempId`/`readOperands`, `:1619-1710`) — this component is emission + register state
only. New state: the **regY mirror**. New arm on `translateStore`-family value handling:
the **`addr` operand** (`LDA #<sym+off` / `#>sym+off` via `symbolRef` byteSelect).

## Implementation Details

### regY mirror (challenger obligation)

```ts
private regY: number | null = null;   // temp id whose byte value is in Y, or null
```

- Cleared in `resetBlockState`, at every `JSR` (`clearRegs` extended), and — the 7a X-mirror
  lesson — **invalidated by every emitted sequence that touches Y**. Scope correction (PF-010):
  **no existing emitter touches Y** — a verified sweep of `translate.ts`/`lower.ts` finds zero
  `LDY`/`INY`/`DEY`/`TAY` emission sites (7a struct copies/fills are per-byte Absolute pairs;
  the binder's `y` state is only ever `null`). The invalidation discipline therefore applies to
  every NEW Y-touching sequence 7b itself introduces (the arms below); the checklist task is a
  cheap confirming sweep plus the rule for the new arms.
- `offsetIntoY(operand)`: immediate → `LDY #imm` (skipped when the mirror already holds it);
  temp → `LDY` from its home (zp/abs) or `TAY` when A-resident (then A is still live — no
  spill needed; Y is not an accumulator); location → `LDY Absolute`.

### translateLoadIndirect (value, ptr, offset)

Mirrors `translateLoadIndexed` (`:1462-1501`) with the base swapped for the pair:

- `ptr` must be a `location` naming a ZP pair symbol (pair or scratch — lowering guarantees
  it; anything else → ICE).
- byte value: `protectA()`; `offsetIntoY(offset)`; `LDA IndirectY zpSlot(pair)`; `bindA`;
  then the 7a homing ladder — `foldStoreHome` STA, else binder spill when uses remain.
- word value: only when consumed by an immediate store (the 7a word-load discipline):
  `offsetIntoY(offset)` → `LDA (pair),Y / STA home+0` → `INY` (regY invalidated) →
  `LDA (pair),Y / STA home+1`; else ICE (`word indirect load not consumed by a store`).
  Lowering's straddle-aware predicate guarantees `offset ≤ 254` for word values (PF-003 —
  `INY` from `#$FF` wraps to 0); translate ICE-guards `imm(offset) > 254` on the word arms
  as a drift backstop.

### translateStoreIndirect (value, ptr, offset)

Mirrors `translateStoreIndexed` (`:1515-1559`):

- byte: value-in-A fast path (`offsetIntoY` must not clobber A — LDY never does);
  else `offsetIntoY` then `leftIntoA(value)`; `STA IndirectY zpSlot(pair)`.
- word immediate: `LDA #lo / STA (pair),Y / INY / LDA #hi / STA (pair),Y`.
- word from memory home: `LDA home+0 / STA (pair),Y / INY / LDA home+1 / STA (pair),Y`.
- word register-resident: loud ICE (the 7a wording — assign to a variable first).
- Every arm ends with the mirrors reflecting reality (`INY` sequences clear regY).

### The `addr` store arm (AR-12)

`translateStore` (`:541-552`) gains a source-kind arm before `bringValueIntoRegisters`:

```
LDA Immediate symbolRef(sym, { offset, byteSelect: "low" })   ; #<sym+off
STA Absolute  target+0
LDA Immediate symbolRef(sym, { offset, byteSelect: "high" })  ; #>sym+off
STA Absolute  target+1        ; regA cleared (holds no temp)
```

Also legal with a ZP-pair `location` target (the scratch seed store, [03-04 §5](03-04-lowering-indirect.md)).
Operand-shape correction (PF-013): `zpSlot` carries NO offset — the `…+1` high-byte store uses
the EXISTING word-store pattern, `symbolRef` in Absolute mode with an `offset` (the `symAt`
helper, `translate.ts:1650-1662`); ZP symbols resolve to `$00xx` header values, so ACME picks
the encoding (the golden pins the actual text). `protectA()` runs first (an addr store
clobbers A — same obligation as `translateConst`).

### Scratch/backstop (AR-4)

Any framing that must reference the scratch pair resolves its symbol through the plan; if
absent → **loud ICE** `"indirect staging demanded but no scratch pair reserved"` — the
predicate/demand drift detector. Never emit a dangling symbol.

### Existing guards unchanged

`protectA` (extended to the new A-clobbering arms), the live-across-call guard, per-block
reset, and the X-mirror discipline all stay; `clearRegs` now also clears regY.

## Error Handling

| Error Case | Handling Strategy | AR Ref |
| ---------- | ----------------- | ------ |
| non-location / non-pair `ptr` operand | ICE (lowering contract violation) | AR-2 |
| word indirect load not folded to a store | ICE (7a word-load discipline) | AR-2 |
| word indirect store from register-resident value | loud ICE (7a wording) | AR-2 |
| scratch demanded, not reserved | loud backstop ICE | AR-4 |
| `addr` reaching any untaught path | ICE via exhaustiveness | AR-12 |

## Integration Points

- Consumes exactly the IL shapes [03-04](03-04-lowering-indirect.md) emits; the dispatch's
  `never`-guard exhaustiveness stays intact.
- `print-instr.ts`/serializer/CPU table: NO changes (shipped `IndirectY` + byteSelect).
- Peephole: passthrough, untouched.

## Testing Requirements

- Spec tests (constructed IL → instr text): all load/store arms above incl. INY sequences,
  the addr arm both targets, regY reuse (two same-offset accesses emit one LDY), regY
  invalidation after INY/copy loops, backstop ICE (ST-48..ST-58).
- Impl tests: mirror state across block labels/calls; interplay with protectA on
  value-in-A + offset-in-Y combinations.
