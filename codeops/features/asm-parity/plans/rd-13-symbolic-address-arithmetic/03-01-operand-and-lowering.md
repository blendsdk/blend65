# M1 + M2 — Operand Model, Lowering, Instruction Selection

> **Decides**: AR #88 (distinct variants) · AR #89 (shift range) · AR #90 (named-const divisor) ·
> AR #91 (locals included) · AR #92 (three ICE guards) · AR #97 (`indexIntoX` arm) ·
> AR #99 (`translateConst` arm)
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
`isImmediateOperand`, which is suffixed to avoid the flat-barrel collision with the IL guard —
`codegen/src/index.ts` re-exports both `il/` and `instr/` with `export *`).

> **Three hand-maintained re-export lists must gain both symbols. TS2366 does not reach any of
> them.** `InstrOperand` is defined in `@blend65/core` but surfaced through explicit named lists:
> `core/src/instr-model/index.ts:33-42` · `codegen/src/instr/operand.ts:11-22` (the re-export shim
> `translate.ts:44` imports from) · `codegen/src/instr/index.ts:25-35`. Only the shim is
> build-forced; omitting the two barrels compiles clean and silently leaves the new variant present
> in a type that `@blend65/codegen` and `@blend65/core/platform` consumers can receive but cannot
> narrow.
>
> The IL side needs no such change, and that asymmetry is deliberate rather than an oversight:
> `il/index.ts:21` exports `imm`/`temp`/`loc` and their guards but **not** `addrOf`/`isAddr`, so
> `addrByteOf`/`isAddrByte` stay package-internal exactly as their `addr` siblings do.

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
`packages/codegen/src/util/bits.ts`, exported package-internally, imported by both.

**`util/`, not the package root.** `codegen/src/` holds only `index.ts` and three directories
(`il/`, `instr/`, `runtime/`) — every module in this package lives under a subdirectory, and a bare
`src/bits.ts` would be the only exception.

Behaviour is unchanged, but this is **not** a covered move: `log2Exact` is module-private today and
`grep log2Exact packages --include=*.test.ts` returns nothing — it is reached only indirectly
through `translateMul`. Exporting it is the moment to pin it, so the move lands **with first-time
direct coverage**, not with relocated cases that do not exist.

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
already use for a numeric literal (`lower.ts:2534`).

> **And that shape is exactly why `translateConst` is a consumer, not a path to avoid.** A numeric
> literal in a non-store position flows `materialise` → `const` → `translateConst` today. The
> byte-select will follow it — see §5e. An earlier draft of this document read
> `translateConst`'s temp/immediate guard (`translate.ts:655-657`) as *reassurance* that the direct
> return keeps the operand away from it. It does not: the lowering side routes it back in.

The slot is claimed and left **unwritten** — 2 dead bytes in the SFA RAM region, zero binary bytes.

**M1 is uniform across all four operand kinds** `lowerAddressOf` resolves, including a local's
`__frame_*` symbol (AR #91). `emitLo`/`emitHi` perform no kind test; the uniformity is inherited
from `lowerAddressOf`, which is the point.

### M2 — the fold pattern, in `emitLo` only

Ahead of the existing `isAddressOfExpr` branch, `emitLo` recognizes one closed shape:

```
BinaryExpr( op ∈ {"/", ">>"}, left = UnaryExpr("&", …), right = <constant> )
```

**The two operators derive `k` differently, and conflating them is a defect.** For `/` the right
operand is a *divisor* and must be a power of two; for `>>` it is a *shift count* and must not be —
`lo(&X >> 6)` has right = 6, which is not a power of two:

| op | right operand | `k` |
|---|---|---|
| `/` | a power-of-two constant | `k = log2Exact(divisor)` |
| `>>` | a constant count `0..15` | `k = count` |

- The right operand is a `NumericLitExpr`, **or** an identifier the frontend has const-evaluated —
  read through `ctx.model.constValues`, the same map `emitHi` already reads at `lower.ts:2591`
  (AR #90). A non-numeric or unevaluated const is not a fold. **This applies to both operators**:
  AR #90's reasoning cuts harder for `>>` than for `/`, because an unfolded `/BLOCK` is merely slow
  while an unfolded `>>SHIFT` is a hard `E90001`.
- **The divisor is a word, not a byte.** `k = 1..15` needs divisors up to 32768, so `log2Exact` must
  be called on the *unmasked* value. The one existing call site — `translate.ts:1581`,
  `log2Exact(constSide.value & 0xff)` — masks to a byte because a power-of-two **multiply** is
  byte-only. Carrying that mask into this fold would make every divisor ≥ 256 return `null` and fall
  silently through to the runtime divide, **still emitting `W10171`** and so indistinguishable from
  the designed fall-through. ST-13h's `k ≥ 8` cases exist to catch exactly this.
- The symbol comes from `lowerAddressOf(binary.left, ctx, true)` — the **inner** `&` node, not
  `emitLo`'s own argument. Nothing constructs a symbol name independently, so the fold inherits the
  slot claim and RD-03's page-alignment mark exactly as M1 does.
- `k = 0` (`/1`, `>>0`) → emit M1's plain byte-select, `addrByteOf(symbol, "low")` with no shift.
  Note this is an explicit branch, **not** a fall-through: the argument is a `BinaryExpr`, so it can
  never reach the `isAddressOfExpr` branch below (AR #89).
- `k = 1..15` → `addrByteOf(symbol, "low", k)`.
- `k >= 16`, a non-power-of-two divisor, a divisor of 0, or anything else → **fall through
  unchanged** to today's path, carrying today's diagnostics exactly. No new diagnostic (AR #89).
  `log2Exact` already rejects 0 (`n < 1`), so `lo(&X / 0)` cannot fold.

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
One mapping site, so the two representations cannot drift. It lives in `instr/translate.ts` beside
its only consumers — it reads an IL type and returns a core type, so `il/` is not a legal home.

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

### 5d. `indexIntoX` (`translate.ts:1758`) — an address byte IS a legal index (AR #97)

```ts
if (isAddrByte(index)) {
  this.emit("LDX", "Immediate", instrOperandFor(index));
  return;
}
```

Placed beside its `isImmediate` arm (`:1764-1767`) and following it exactly. A block number indexing
a frame table is an ordinary byte, and `table[lo(&X)]` **compiles today** — without this arm M1 would
turn a working program into an `E90001`. It is also the largest single win in this RD:

| | Emission | Bytes |
|---|---|---|
| today | `LDA #<sym` · `STA 0sc0` · `LDA #>sym` · `STA 0sc0+1` · `LDX 0sc0` · `LDA table,X` · `STA $D020` | 19 |
| after | `LDX #<sym` · `LDA table,X` · `STA $D020` | **8** |

The trailing ICE at `:1786` stays for every other unhandled kind.

### 5e. `translateConst` (`translate.ts:655`) — the whole non-store surface, at one site (AR #99)

```ts
if (isAddrByte(src) && isTemp(dest)) {
  this.protectA();
  this.emit("LDA", "Immediate", instrOperandFor(src));
  this.bindA(dest.id);
  return;
}
```

Placed ahead of the existing temp/immediate guard, byte-only by construction (`addrByte` is always
`IL_BYTE`, so the 16-bit `LDX` half never applies).

**Why one arm covers so much.** Only a *store source* receives a lowered operand raw. Every other
expression position funnels through `materialise` (`lower.ts:2659-2666`), which passes temps
through and wraps everything else in `{ op: "const", … }` — and `translateConst` is the sole
consumer of `const`. The ten funnel sites:

| Position | Site |
|---|---|
| `let` initializer | `:523` |
| `for` initializer | `:704` |
| `&&` / `\|\|` operands | `:1426`, `:1438` |
| conditional condition and both arms | `:1459`, `:1472`, `:1482` |
| assignment | `:1645` |
| indexed-store value | `:1930` |
| coercion | `:2320` |

Today all ten work because `emitLo`/`emitHi` return a **temp**, which `materialise` passes through.
After M1 they return a bare `addrByte`, and without this arm every one of them becomes an `E90001`.
Measured before the change: `let b: byte = lo(&X);` and `v = hi(&X);` both compile today.

The emission stays optimal — the `store` that follows folds through `leftIntoA`'s register
suppression (`translate.ts:925-927`), so `let base: byte = lo(&BALL / 64);` is
`LDA #<(__data_Main_BALL / 64)` · `STA __frame_Main_main_base`, 5 bytes.

## 6. What is deliberately not touched

`addr`'s doc comment and its two-position rule · all seven `isAddr` guards · `translateDivMod` ·
the word `shr` path and its `E90001` · `instrByteSize` (keys on addressing mode) ·
`relax-branches.ts` (guards on `isLabelRef`) · `runtime/embed.ts` (inspects `JSR` operands) ·
`symbolRef`'s existing shape and its unparenthesized offset rendering.

Two facts that bound the blast radius, both worth stating because they are the reason a new operand
kind is safe here at all:

- **The peephole optimizer has no rules.** `optimizeInstr` (`peephole.ts:145-157`) is a v1 thin
  passthrough that validates stream structure and returns the program verbatim. Nothing downstream
  of translate inspects operand kinds, so no catalog needs auditing against the new variant.
- **`validateStream` checks opcode+mode legality only**, never operand kind, so `LDA` in `Immediate`
  mode stays legal whatever the operand carries.

One piece of deliberate symmetry, recorded so it is not later mistaken for dead code:
`symbolExpr`'s `"high"` byteSelect has **no producer** — `emitHi` gains no fold branch — and is
exercised only by rendering tests. It is the union shape AR #88 chose, not an unfinished path.

## 7. Projected emission

Re-derived from the built binary at implementation time, never assumed from this table.

| Path | Emission | Bytes | Cycles |
|---|---|---|---|
| today | `LDA #<` 2 · `STA` 3 · `LDA #>` 2 · `STA` 3 · `LDA` 3 · `ASL` 1 · `ASL` 1 · `STA` 3 | 18 | 24 |
| after M1 | `LDA #>` 2 · `ASL` 1 · `ASL` 1 · `STA` 3 | 7 | 10 |
| after M2 + AC-6 | `LDA #<(sym/64)` 2 · `STA` 3 | **5** | **6** |
