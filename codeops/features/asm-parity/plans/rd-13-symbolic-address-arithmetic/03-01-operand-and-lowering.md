# M1 + M2 — Operand Model, Lowering, Instruction Selection

> **Decides**: AR #88 (distinct variants) · AR #89 (shift range) · AR #90 (named-const divisor) ·
> AR #91 (locals included) · AR #92 (three ICE guards)
> **Current state**: [02-current-state.md](02-current-state.md) owns every line reference; this
> document does not restate them.

## 1. The IL operand — `addrByte`

Additive. `addr` and all seven `isAddr` guards are untouched (AR #88).

```ts
// il/operand.ts — added to the union
| {
    readonly kind: "addrByte";
    readonly symbol: string;
    readonly select: "low" | "high";
    readonly shift?: number;        // 1..15; absent = plain byte-select
    readonly type: ILType;          // always IL_BYTE
  }
```

Constructor `addrByteOf(symbol, select, shift?)` hardcodes `IL_BYTE`, mirroring how `addrOf`
hardcodes `IL_WORD`. Guard `isAddrByte`. **No `offset` field** — `lowerAddressOf` never produces
one, and its absence is what makes the ACME precedence trap unreachable by construction.

The union's doc comment gains a paragraph describing the new variant. `addr`'s two-position rule
is **not** amended — it still says what it always said, and it is still true.

`renderOperand` (`print-il.ts:44`) gains an arm; its explicit `: string` return makes this a
compile error until written. Rendering, chosen so IL text stays greppable and unambiguous:

```
addrByte low  __data_Main_BALLOON            ->  <&__data_Main_BALLOON
addrByte high __data_Main_BALLOON            ->  >&__data_Main_BALLOON
addrByte low  __data_Main_BALLOON shift 6    ->  <&__data_Main_BALLOON/64
```

## 2. The instruction operand — `symbolExpr`

```ts
// core/src/instr-model/operand.ts — added to the union
| {
    readonly kind: "symbolExpr";
    readonly name: string;
    readonly shift: number;                    // REQUIRED, >= 1
    readonly byteSelect: "low" | "high";       // REQUIRED — never "none"
  }
```

Constructor `symbolExpr(name, shift, byteSelect)`, guard `isSymbolExprOperand` (suffixed like
`isImmediateOperand`, which is suffixed to avoid the flat-barrel collision with the IL guard).

**Every field is required on purpose.** A required `shift >= 1` gives each value exactly one
canonical spelling, honouring the serializer's determinism contract — the unshifted case is
`symbolRef`, which already exists and already round-trips. A required `byteSelect` keeps the
truncation that makes the fold safe at every address from being optional.

`symbolText` (`print-instr.ts:58`) gains the arm — TS2366 until written:

```ts
case "symbolExpr": {
  const sel = o.byteSelect === "low" ? "<" : ">";
  return `${sel}(${o.name} / ${1 << o.shift})`;
}
```

**Divisor form, not `>> k`.** It matches the hand-written idiom the goldens are benchmarked
against (`lda #sprite/64`) and is the form measured on ACME 0.97. Both spellings assemble to the
same byte; only one reads like what a 6502 developer wrote.

> **The parens are load-bearing and must never gain an unparenthesized addend.** Measured on ACME
> 0.97 with `sprite` at `$0900` (correct block `$24`): `#<(sprite / 64)` → `0x24`, but
> `#<(sprite+3 / 64)` → `0x00`, because ACME binds `/` tighter than `+`. It assembles silently.
> The variant has no offset field, so this cannot be written. Should a later requirement need one,
> the dividend must be self-parenthesized: `#<((sym+off) / 64)`.

## 3. `log2Exact` moves

`log2Exact` (`translate.ts:2330`) is module-private and both M2's fold (in `il/`) and
`translateMul` (in `instr/`) need it. `il/` must not import from `instr/`. It moves to a new
`packages/codegen/src/bits.ts`, exported package-internally, imported by both. Behaviour
unchanged — a pure move plus its existing unit coverage.

## 4. Lowering — `emitLo` / `emitHi`

Both keep their existing `isAddressOfExpr(arg)` branch position and both switch to
`lowerAddressOf(arg, ctx, /* direct */ true)`. **The `true` is the whole hazard.** It preserves the
positional slot claim and RD-03's page-alignment mark, both of which run before the `direct` return.

```ts
// emitLo / emitHi — the address branch, after
if (isAddressOfExpr(arg)) {
  const address = lowerAddressOf(arg, ctx, true);   // claims the slot, marks alignment
  if (!isAddr(address)) return address;             // ICE already reported
  return addrByteOf(address.symbol, /* "low" | "high" */);
}
```

The operand is returned **directly** — no `load`, no temp. This is the shape both functions
already use for a numeric literal (`lower.ts:2534`). It is also why routing the result through
`translateConst` is wrong: that path guards on temp/immediate (`translate.ts:655-657`).

The slot is claimed and left **unwritten** — 2 dead bytes in the SFA RAM region, zero binary bytes.

**M1 is uniform across all four operand kinds** `lowerAddressOf` resolves, including a local's
`__frame_*` symbol (AR #91). `emitLo`/`emitHi` perform no kind test; the uniformity is inherited
from `lowerAddressOf`, which is the point.

### M2 — the fold pattern, in `emitLo` only

Ahead of the existing `isAddressOfExpr` branch, `emitLo` recognizes one closed shape:

```
BinaryExpr( op ∈ {"/", ">>"}, left = UnaryExpr("&", …), right = <power-of-two constant> )
```

- The right operand is a `NumericLitExpr`, **or** an identifier the frontend has const-evaluated —
  read through `ctx.model.constValues`, the same map `emitHi` already reads at `lower.ts:2591`
  (AR #90). A non-numeric or unevaluated const is not a fold.
- `k = log2Exact(divisor)` for `/`, or the literal count for `>>`. Both converge on one operand,
  which is what AC-5 tests.
- `k = 0` → fall into M1's plain byte-select, not `#<(sym / 1)` (AR #89).
- `k = 1..15` → `addrByteOf(symbol, "low", k)`.
- `k >= 16`, a non-power-of-two divisor, or anything else → **fall through unchanged** to today's
  path. No new diagnostic (AR #89).

`emitHi` gains **no** fold branch: `hi(&X / 2^k)` and the word-context forms keep today's paths,
per the RD.

## 5. Instruction selection — every consumer

An `addrByte` is a byte value whose number only ACME knows. It behaves exactly like an immediate
whose value is not yet available, so it belongs everywhere a byte immediate belongs.

### 5a. `byteRefOf` (`translate.ts:1008`) — one arm covers most of the surface

```ts
if (isAddrByte(op)) {
  return byteIndex === 0
    ? { operand: instrOperandFor(op), mode: "Immediate" }
    : { operand: imm8(0), mode: "Immediate" };   // a byte value's high byte is 0
}
```

`instrOperandFor` is the single place that maps `addrByte` → `InstrOperand`: `symbolRef(name,
{ byteSelect: select })` when `shift` is absent, `symbolExpr(name, shift, select)` when present.
One mapping site, so the two representations cannot drift.

This arm transitively covers `rightSource` (`:1045`), `wordLeftByteIntoA` (`:958`),
`bringValueIntoRegisters`'s word path (`:991-992`), `copyWordToHome` (`:906`), the zero-extension
recursion (`:1021`), and runtime-call argument marshalling.

The `byteIndex === 1 → imm8(0)` half matters: without it a widened `hi(&X)` fed to a word consumer
reads a null and emits nothing.

### 5b. `leftIntoA` (`translate.ts:920`) — the hot path

`leftIntoA` does **not** call `byteRefOf`, so it needs its own arm, placed beside the `isImmediate`
arm and following it exactly (emit, then `clearRegs()`):

```ts
if (isAddrByte(op)) {
  this.emit("LDA", "Immediate", instrOperandFor(op));
  this.clearRegs();
  return;
}
```

This one arm produces both headline emissions:

| Source | Emission |
|---|---|
| `poke($07F8, hi(&X) * 4)` | `LDA #>X` · `ASL` · `ASL` · `STA $07F8` — `translateMul`'s power-of-two branch calls `leftIntoA(varSide)` and is otherwise unchanged |
| `poke($07F8, lo(&X / 64))` | `LDA #<(X / 64)` · `STA $07F8` |

### 5c. The three ICE guards (AR #92)

Added in the same phase, because they are what turn a missed consumer into a compile error instead
of a cleanly-assembling wrong binary:

| Site | Change |
|---|---|
| `leftIntoA` (`:950`) | trailing `iceUnsupported` after the if-chain |
| `bringValueIntoRegisters` (`:998`) | `else` branch on `if (lo !== null && hi !== null)` |
| `rightSource` (`:1052`) | replace the `{ none(), "Implied" }` fallthrough with `iceUnsupported` |

Each is verified unreachable for every currently-compiling program **before** the change lands —
the full suite green with the guards in place and the new operand not yet produced is that proof.

`indexIntoX` (`:1760`) is deliberately **not** given an `addrByte` arm: an address byte as an array
index has no meaning, and its existing trailing ICE stays loud.

## 6. What is deliberately not touched

`addr`'s doc comment and its two-position rule · all seven `isAddr` guards · `translateDivMod` ·
the word `shr` path and its `E90001` · `instrByteSize` · `relax-branches.ts` · `runtime/embed.ts` ·
the peephole catalog · `symbolRef`'s existing shape and its unparenthesized offset rendering.

## 7. Projected emission

Re-derived from the built binary at implementation time, never assumed from this table.

| Path | Emission | Bytes | Cycles |
|---|---|---|---|
| today | `LDA #<` 2 · `STA` 3 · `LDA #>` 2 · `STA` 3 · `LDA` 3 · `ASL` 1 · `ASL` 1 · `STA` 3 | 18 | 24 |
| after M1 | `LDA #>` 2 · `ASL` 1 · `ASL` 1 · `STA` 3 | 7 | 10 |
| after M2 + AC-6 | `LDA #<(sym/64)` 2 · `STA` 3 | **5** | **6** |
