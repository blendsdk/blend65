# Current State

Every line reference below was read on the working tree at `8f71432`. The RD owns the *measured
emissions*; this document owns the **seam inventory** — every site an implementer touches or must
deliberately not touch.

## The three defects, at their source

| Source form | Current path | Site |
|---|---|---|
| `hi(&X)` / `lo(&X)` | `lowerAddressOf(arg, ctx, /* direct */ false)` homes the full 16-bit address into a synthetic word frame slot, then a `load` reads one byte back at offset 0 or +1 | `lower.ts:2536-2544` (`emitLo`), `:2570-2578` (`emitHi`) |
| `lo(&X / 64)` | falls through to `lowerExpr(arg)` → `div` → `translateDivMod` → `JSR __rt_div16` + `W10171`, then a `trunc` | `lower.ts:2545-2552`, `translate.ts:1609` |
| `lo(&X >> 6)` | falls through to `lowerExpr(arg)` → word `shr` → no consuming store home → hard error | `translate.ts:838-842` |

## `lowerAddressOf` — the seam, and why nothing may route around it

```ts
// lower.ts:1844-1874
function lowerAddressOf(expr: UnaryExprNode, ctx: LowerCtx, direct: boolean): ILOperand {
  const slot = claimResultSlot(expr, ctx);      // :1845  positional — ctx.scCounter++
  const sym = ctx.model.symbolOf(expr.operand);
  ...
  } else if (sym.kind === "constant") {
    symbol = constDataSymbol(sym);
    ctx.addressTakenConsts.add(symbol);          // :1863  the page-alignment mark
  ...
  const address = addrOf(symbol);                // :1869  bare — NEVER carries an offset
  if (direct) return address;                    // :1870  after BOTH side effects
  ...
}
```

Three facts an implementer needs:

1. **The `direct` path runs both side effects first.** M1 and M2 call
   `lowerAddressOf(arg, ctx, true)` and then re-shape the returned operand. Nothing constructs a
   symbol name independently.
2. **The slot claim is positional and stays.** `claimResultSlot` names slots `0sc<N>` off
   `ctx.scCounter++` (`:1392`), matched against slots the SFA planner appends in AST preorder
   (`packages/frontend/src/sfa/model-adapter.ts:119-124`). After M1 the slot goes **unwritten** —
   2 dead bytes in the SFA RAM region, **zero** binary bytes. Dropping the claim would shift every
   later slot index in the same function.
3. **`lowerAddressOf` never produces an offset.** `addrOf(symbol)` at `:1869` is called bare.
   Offsets on `addr` come only from place computations (`:1064`, `:2048`, `:2055`, `:2155`,
   `:2162`), which never feed `lo()`/`hi()`. This is what makes the new operands' absent offset
   field correct rather than merely convenient.

All four operand kinds resolve to a link-time symbol: module variable → `__var_*`, **local** →
`__frame_*` (`:1851-1853`), const aggregate → `__data_*` (`:1855`), function/interrupt → entry
label (`:1865`).

## The IL operand union

`ILOperand` (`il/operand.ts:30-44`) is `immediate | temp | location | addr`. Its doc comment
(`:23-28`) states the rule this plan must leave standing:

> *"It is legal in exactly two positions: a `store` source … and an ALU right operand. Every other
> consumer rejects it loudly — never a silent misread."*

`addrOf` hardcodes `IL_WORD` (`:98-99`). `renderOperand` (`print-il.ts:44`) has an explicit
`: string` return and no default arm — a new kind is **TS2366 until handled**.

## The seven `isAddr` guards — the map that decides the design

| Site | Role | Behaviour on `addr` |
|---|---|---|
| `translate.ts:698` `translateStore` | **accepts** | emits the `#<sym`/`#>sym` two-byte marshalling pair |
| `translate.ts:1035` `rightSource` | **accepts** | byte-select derived from `byteIndex` |
| `translate.ts:921` `leftIntoA` | rejects | `iceUnsupported` |
| `translate.ts:954` `wordLeftByteIntoA` | rejects | `iceUnsupported` |
| `translate.ts:978` `bringValueIntoRegisters` | rejects | `iceUnsupported` |
| `translate.ts:1760` `indexIntoX` | rejects | `iceUnsupported` |
| `translate.ts:2044` indirect store | rejects | `iceUnsupported` |

**None of these seven is edited.** A distinct `addrByte` kind is simply not matched by
`o.kind === "addr"` (AR #88), so the two accepting paths correctly do not accept it — a byte value
is not a word address — and the five rejecting paths correctly do not fire.

## The three silent-failure holes on the new operand's path

Verified unreachable today; each becomes reachable the moment a consumer is missed (AR #92).

| Site | Hole | Failure mode |
|---|---|---|
| `translate.ts:920-950` `leftIntoA` | an if-chain with **no trailing else** — an unhandled kind falls out emitting nothing | `translateStore:718` then `STA`s whatever stale value sits in A. Assembles cleanly |
| `translate.ts:993-998` `bringValueIntoRegisters` | `if (lo !== null && hi !== null)` with **no else** | a word-context use emits nothing at all |
| `translate.ts:1052` `rightSource` | falls through to `{ operand: none(), mode: "Implied" }` | renders a bare `ADC`/`CMP` mnemonic; only ACME notices, with no compiler diagnostic |

## The instruction operand union

`InstrOperand` (`core/src/instr-model/operand.ts:30-40`) is
`none | immediate | symbolRef | labelRef | zpSlot`. `symbolRef` already carries
`byteSelect: "low" | "high" | "none"` and an optional `offset`, and `translateStore:698-714`
already emits exactly the `#<sym` / `#>sym` pair — **M1 needs no new instruction operand**.

`symbolText` (`print-instr.ts:58-79`) renders it, with an explicit `: string` return ⇒ a new
variant is TS2366-forced. It renders offsets **unparenthesized** (`:61`, `<sym+3`), correct only
because unary `<` binds loosest — which is precisely why the new variant carries no offset field.

Non-forced sites, confirmed unaffected: `instrByteSize` (`:256`, keys on addressing mode — an
Immediate stays 2 bytes) · `relax-branches.ts:224,266` (guards on `isLabelRef`) ·
`runtime/embed.ts:75` (inspects `JSR` operands only).

## `W10172` — the whole surface

| Site | Role |
|---|---|
| `translate.ts:1588-1592` | the **only** producer, inside `translateMul`'s power-of-two branch, guarded by `log2Exact(constSide.value) !== null` |
| `core/src/diagnostics/diagnostic-codes.ts:374` | `ShiftAndAddMultiply: "W10172"` — the registration **stays** |
| `translate-indexed.spec.test.ts:112,121` | ST-51a — pins it on a compiler-generated 2-byte element scale |
| `translate.spec.test.ts:458,470` | ST-T16 — pins it on a power-of-two multiply |

Grep-confirmed: those four are the entire footprint. After M3 the diagnostic is registered with no
producer — the deliberate intermediate state owned by
[#71](https://github.com/blendsdk/blend65/issues/71).

`log2Exact` (`translate.ts:2330`) is module-private and M2's fold needs the same test. `il/lower.ts`
must not import from `instr/` (a layering inversion), so it moves to a shared module in the same
package — see [03-01](03-01-operand-and-lowering.md).

## The corpus and its ledgers

| Artifact | State |
|---|---|
| `budgets.json` | 15 programs; `balloon` = `{ bytes: 318, windows: [frameUpdate …] }` |
| goldens | 14 committed pairs — **`balloon` has none**, which is why AC-2 carries the alignment risk alone |
| `twins.json` | 53 routed rows, **17** carrying `"issue": 58`; exactly one is a symbolic-address defect |
| `SCOREBOARD.md` | committed, with a hard-fail freshness gate that **rebuilds every pair from `examples/` source** |
| `examples-sync.spec.test.ts` | pins every inlined fixture source byte-for-byte against `examples/`; `balloon` is exempt (built from the directory directly) |

**The Phase-4 trap, from RD-03's plan preflight:** because the freshness gate rebuilds from
`examples/` source, migrating `examples/balloon/main.blend` in one commit and updating its ratchet
and `SCOREBOARD.md` in a later one is **CI-red by construction**. They land together.

## `examples/balloon-color`

`grep -rn "balloon-color"` across `packages/`, `test/`, `scripts/` and `.github/` returns
**nothing**. It is compiled by no test, has no golden, no budget row and no twin — a migration typo
there ships with zero signal. Its `main.blend:21` carries the same `poke($07F8, hi(&BALLOON) * 4)`
as `balloon/main.blend:11`, and its header (`:2-6`) states the out-of-corpus intent that AR #93
preserves.
