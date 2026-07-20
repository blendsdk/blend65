# RD-13: Symbolic Address Arithmetic — Fold It Where the Assembler Already Can

> **Document**: RD-13-symbolic-address-arithmetic.md
> **Status**: Draft (awaiting preflight)
> **Created**: 2026-07-20
> **Project**: blend65 — Asm-Parity Initiative
> **Issue**: [#58](https://github.com/blendsdk/blend65/issues/58) — **the symbolic-address slice
> only**. #58 is an *audit sweep* (deliverable: conformance tables + filed findings, scope
> `packages/frontend`); it stays open for its remaining halves, exactly as #49 stayed open after
> RD-03 took its placement slice.
> **Depends On**: RD-01 (parity instruments, ✅), RD-02 (twin corpus + scoreboard, ✅),
> RD-03 (address-taken alignment, ✅ — **load-bearing**, see M1)
> **Blocks**: RD-15 ([#69](https://github.com/blendsdk/blend65/issues/69) — 64-byte alignment)
> **CodeOps Skills Version**: 3.11.0

---

## Feature Overview

An address is a **link-time constant**. `__data_Main_BALLOON` has no number while the compiler
runs, but ACME resolves it and will compute any arithmetic on it for free at assembly time — that
is what an assembler *is*. A 6502 developer therefore treats `sprite / 64` as costing nothing.

The compiler does not. It materializes the address at runtime and computes on it with real
instructions. Three source forms, all legal in frozen v3.0, all measured live on the current tree:

| Source | Today | A hand-coder writes |
|---|---|---|
| `poke($07F8, hi(&X) * 4)` | **8 instructions** — homes the whole 16-bit address through a frame slot, reads one byte back, shifts twice — plus a spurious `W10172` | 4 (`LDA #>X` · `ASL` · `ASL` · `STA $07f8`) |
| `poke($07F8, lo(&X / 64))` | **11 instructions + `JSR __rt_div16`** (~150–200 cycles, `W10171`) — a runtime 16-bit software division of a link-time constant by a literal | 2 (`LDA #(X/64)` · `STA $07f8`) |
| `poke($07F8, lo(&X >> 6))` | `error[E90001]: IL→Instr: unsupported op 'word shr result not consumed by a store'` (`translate.ts:841`) — **rejected outright** | 2 |

The measured emissions, from `examples/balloon` and two probes built through the real CLI:

```asm
; poke($07F8, hi(&BALLOON) * 4)        ; poke($07F8, lo(&BALLOON / 64))
LDA #<__data_Main_BALLOON              LDA #<__data_Main_BALLOON
STA __frame_Main_main_0sc0             STA __frame_Main_main_0sc0
LDA #>__data_Main_BALLOON              LDA #>__data_Main_BALLOON
STA __frame_Main_main_0sc0+1           STA __frame_Main_main_0sc0+1
LDA __frame_Main_main_0sc0+1           LDA #$40
ASL                                    STA __zp_arg_0
ASL                                    LDA #$00
STA $7F8                               STA __zp_arg_1
                                       LDX __frame_Main_main_0sc0+1
                                       LDA __frame_Main_main_0sc0
                                       JSR __rt_div16
                                       STA $7F8
```

This is the Prime Directive's *"a restriction that forces un-idiomatic user code is itself the
bug"* in both directions at once. The one form that works (`hi(&X) * 4`) costs 4 extra
instructions and **requires page alignment to be arithmetically correct at all**; the two forms
that are alignment-independent either call a division routine or are rejected. That is precisely
why [#69](https://github.com/blendsdk/blend65/issues/69) (RD-15) is blocked: at a 64-byte
boundary `hi(&X) * 4` computes the **wrong** block, and no other way to name one survives codegen.

This RD is **grammar-free**. Every source form above already parses and type-checks in frozen
v3.0 — the defect is entirely in lowering and instruction selection. No `spec/` change, no
Language Guard evaluation, `git status --porcelain spec/` stays empty. It also moves the
implementation *toward* the spec's stated cost model: `spec/12-intrinsics.md:165-166` prices
`lo()`/`hi()` at *"0 cycles (compile-time if const)"*. An address is link-time rather than
compile-time, so that line does not literally bind here — but eight instructions is not what it
describes either.

### What this is not

- **It is not #58's audit sweep.** #58's inventory (const-evaluation completeness tables,
  type-rule conformance, aggregate semantics, poisoning discipline, diagnostics empathy) is a
  frontend audit whose deliverable is tables and filed findings. This RD takes one measured defect
  out of it and fixes it end to end.
- **It is not general constant folding.** 16 of the corpus's 53 routed divergence rows currently
  point at #58 with the note *"constant-foldable program: full runtime machinery emitted where a
  hand version folds to direct stores"*. Those are **misrouted** — see S1. They are local
  constant-propagation and dead-store gaps in codegen dataflow, not symbolic-address defects, and
  this RD does not close them.
- **It is not a const-declaration feature.** Naming a link-time value
  (`const BLOCK: byte = hi(&X) * 4;`) is a substantially different change — see Won't Have.

---

## Functional Requirements

### Must Have

**M1 — `hi(&X)` and `lo(&X)` materialize as a single immediate byte-select.**

The instruction-operand model **already expresses this**: `symbolRef`
(`packages/core/src/instr-model/operand.ts:30-40`) carries
`byteSelect: "low" | "high" | "none"`, rendered by `symbolText`
(`packages/codegen/src/instr/print-instr.ts:58-79`) as ACME's `<sym` / `>sym`, and
`translate.ts:698-714` already emits exactly that pair when storing an address. **No new operand
variant is required for M1.**

The defect is upstream, in lowering: `emitLo` (`packages/codegen/src/il/lower.ts:2536-2544`) and
`emitHi` (`:2570-2578`) both call `lowerAddressOf(arg, ctx, /* direct */ false)`, which **homes the
full address into a synthetic word frame slot** and returns the slot; the emitter then reads one
byte back out of it at offset 0 or +1.

> **🔴 The seam is `direct = true`, and routing around `lowerAddressOf` is a silent-corruption
> hazard.** RD-03 aligns a const array by marking it inside `lowerAddressOf`
> (`lower.ts:1863`, `ctx.addressTakenConsts.add(symbol)`), and that function also claims the
> site's frame slot (`:1845`). Its `direct` path (`:1870`) returns the raw address operand
> **after both side effects**. An implementation that shortcuts to a byte-select without calling
> `lowerAddressOf` loses page alignment — and `examples/balloon/main.blend:11` contains that
> program's **only** `&`, so its sprite would silently move off its block boundary. Nothing in CI
> would notice: `balloon` has no committed golden, and the alignment is only observable through
> the symbol map or on VICE. M1 must route through `lowerAddressOf(arg, ctx, true)`.

Two further constraints the implementation cannot choose away:

| Constraint | Evidence | Consequence |
|---|---|---|
| **The slot claim is positional and must survive.** `claimResultSlot` names slots `0sc<N>` off `ctx.scCounter++` (`lower.ts:1392`), matched against slots the SFA planner appends in AST preorder (`packages/frontend/src/sfa/model-adapter.ts:119-124`). Its own doc states *"Every `&` site claims a slot — including plain-store sites that end up not writing theirs — so the counter never depends on how the site is used"* (`:186-190`) | `model-adapter.spec.test.ts:250-323` pins the slot lists | Keep the claim. The slot goes unwritten — 2 dead bytes in the SFA **RAM** region, **zero** binary bytes, and the pinning spec tests stay green untouched |
| **An IL `addr` operand is rejected outside a store source / ALU right operand.** `leftIntoA` ICEs on it (`translate.ts:921-924`); six further `isAddr` guards reject it elsewhere | `il/operand.ts:20-28` states the rule normatively | A byte-selected address needs to be *representable in IL* and accepted where a byte value is accepted — an IL-level change, not an `InstrOperand` one |

**M2 — Link-time arithmetic on an address folds to an assembler expression.**
`lo(&X / 2^k)` and `lo(&X >> k)` emit a single immediate whose operand ACME evaluates —
`LDA #<(sym / 64)` — instead of `JSR __rt_div16` or `E90001`. Verified against ACME 0.97 during
RD-03's investigation: `LDA #(sprite / 64)` with `sprite` at `$0840` assembles to `a9 21` — block
33, folded entirely at assembly time.

> **The fold stops at the divide/shift forms. `hi(&X) * 4` is deliberately *not* folded to a
> single immediate**, and the reason is semantic rather than economic. `hi(&X) * 4` is a **byte**
> multiply: it wraps mod 256, and that wrap is not a defect — for a page-aligned `X` it yields
> `(X & $3FFF) / 64`, the block number *within the VIC bank*, which is exactly what a program
> that has moved its VIC bank wants. An arithmetic fold either has to reproduce that truncation
> or it changes the program's meaning. `lo(&X / 64)` needs no such care: `lo()` **is** the
> low-byte operation, so `#<(sym / 64)` is wrap-faithful by construction, always in immediate
> range, and character-for-character the hand idiom (`lda #sprite/64`). M1 already brings
> `hi(&X) * 4` down to the four instructions a hand-coder writes; building a
> multiply-over-address peephole to save two more bytes on an idiom that RD-15's 64-byte
> alignment will make *incorrect* is machinery with a shelf life. **`lo(&SPRITE / 64)` becomes
> the blessed sprite-block idiom** from this RD forward, and the `examples/` sources that
> currently teach `hi(&X) * 4` are updated to it.

This is the one place RD-13 extends `InstrOperand`. **Blast radius, measured rather than
estimated:**

| Site | Forced? | Note |
|---|---|---|
| `symbolText` (`print-instr.ts:58`) | ✅ **hard compile error** | Explicit `: string` return type + `strictNullChecks` (via `strict`, `tsconfig.base.json:9`) ⇒ **TS2366** *"Function lacks ending return statement…"*. Proven with the repo's own `tsc` on a minimal probe |
| `instrByteSize` (`print-instr.ts:256`) | — | Keys on **addressing mode**, not operand kind. An Immediate stays 2 bytes; no change |
| `relax-branches.ts:224,266` | — | Guards on `isLabelRef`; a new variant is correctly excluded |
| `runtime/embed.ts:75` | — | Inspects `JSR` operands only; an immediate never reaches it |

> **Correction to record.** An earlier note in the roadmap claimed this variant needed a hand-added
> `never` guard because a missing arm would "render `undefined` silently" — reasoning from
> `noImplicitReturns` being unset. That is **wrong**: the explicit return type makes it a hard
> error. The compiler forces the arm; no guard is needed.

**M3 — `W10172` stops firing where the frozen spec forbids it.**

> **M1 and M3 are coupled, not independently shippable.** After M1, `hi(&X)` yields a byte value
> and the `* 4` still lands in `translateMul`'s power-of-two branch — so M1 alone would leave a
> spurious `W10172` on the very sprite-pointer line it just fixed. Shipping M1 without M3 means
> the headline idiom still warns about a cost it does not incur.

`translate.ts:1582-1592` emits `W10172 "multiply by N generates a shift-and-add sequence"`
**only** inside the power-of-two branch, guarded by `log2Exact(constSide.value) !== null`. The
frozen spec says the opposite, verbatim (`spec/evaluations/F017-operators.md:435-441`, rule OP-5):

> *"When a **non-power-of-2** constant is used in multiplication, the compiler emits an
> informational warning about the shift-and-add decomposition cost… This warning is informational
> only… **It does NOT trigger for power-of-2 constants** (which use cheap shifts) or
> compile-time-constant expressions (which are folded)."*

The trigger is exactly inverted. The message text corroborates it — `spec/00-feature-index.md:226`
renders the warning as *"…consider power-of-2 stride for faster access"*, advice that is
nonsensical when the multiplier already **is** a power of two. Live confirmation: building
`examples/balloon` today prints `warning[W10172]: multiply by 4 generates a shift-and-add
sequence` for a line that emits two `ASL`s and no shift-and-add at all.

This is a **conformance defect, not a taste judgement**. Removing the power-of-two emission
*restores* conformance — no `spec/` edit, no Guard evaluation, no ambiguity to resolve.

It is not only cosmetic: the same warning fires on **compiler-generated** multiplies the user
never wrote. `translate-indexed.spec.test.ts:112` (ST-51a) pins it on a 2-byte element-scale
strength reduction — i.e. writing `arr[i]` on a `word[]` warns you about *your* multiply.

> **This is the one place RD-13 touches a `*.spec.test.ts` file, and it needs stating plainly.**
> Two spec-tier tests assert the non-conformant behaviour: ST-51a
> (`translate-indexed.spec.test.ts:112,121`) and ST-T16 (`translate.spec.test.ts:458,470`). The
> repo's immutable-oracle rule is *"a failing spec test means the implementation is wrong, never
> the test"* — and it holds precisely because a spec test derives from **requirements**. These two
> derive from the implementation instead: they contradict the normative source they are supposed
> to encode. They are **re-derived from `spec/evaluations/F017-operators.md:441`**, not weakened
> to let an implementation pass. Every other assertion in both tests (the `ASL` count, the absence
> of a runtime multiply) is preserved unchanged; only the warning expectation inverts.

**M4 — No fixture regresses, and the ledgers that describe the corpus stay true.**
Corpus total bytes must strictly decrease and **no individual fixture may grow**. Every affected
`bytes` ratchet is re-derived from the new build in the same change, and the balloon routing row
that describes this exact defect (`twins.json`, the `hi(&BALLOON) * 4` entry) is re-authored from
measurement rather than left asserting a divergence that no longer exists. This is RD-03's M4
discipline applied unchanged; the scoreboard freshness gate checks only *structural* staleness and
stays green on false prose.

### Should Have

**S1 — Re-audit the 16 misrouted `#58` divergence rows.**
17 of the corpus's 53 routed rows point at #58. Exactly **one** — balloon's `hi(&BALLOON) * 4`
entry — is a symbolic-address defect. The other 16 carry the note *"constant-foldable program:
full runtime machinery emitted where a hand version folds to direct stores"* and are **not #58's**:

```blend65
// examples/slice3a/main.blend — the whole program
let x: byte = 5;
poke(0xD020, x);
```
```asm
LDA #$05                      ; emitted today
STA __frame_Main_main_x
LDA __frame_Main_main_x       ; store, then reload the byte just stored
STA $D020
```

The frontend knows `x == 5` perfectly well; codegen materializes the frame slot anyway. Same
pattern in `slice3b` (`5 * 3` reaches `JSR __rt_mul8` because both operands live in frame slots)
and `slice5a` (cross-function propagation + inlining). These are **local constant propagation and
dead-store elimination** — codegen dataflow, nothing to do with `packages/frontend` semantics or
with link-time symbols.

They drive the corpus's worst ratios (`slice6` 8.70×, `slice3b` 8.32×, `slice7b` 7.40×,
`slice5a` 7.12×), so mis-attributing them hides the largest remaining parity gap behind an audit
sweep that would never fix it. S1 re-routes them to their real owner; it does **not** fix them.

> **Expectation set deliberately:** RD-13 moves **1** routed row, not 17. Anyone reading the
> closeout should see that stated up front rather than discover it.

### Won't Have (Out of Scope)

- **`const BLOCK: byte = hi(&X) * 4;` — excluded because the frozen spec forbids it, not merely
  because it is expensive.** Confirmed live: `error[E10193]: Initializer for const 'BLOCK' is not
  a compile-time constant expression`. That diagnostic is **normative**
  (`spec/14-diagnostics.md:140`), and the requirement behind it is stated independently in the
  feature index — *"`const` initializer must be a compile-time constant expression"*
  (`spec/00-feature-index.md:172`). `&X` genuinely is **not** a compile-time constant; it is a
  link-time one, and frozen v3.0 has no such category. Creating one is a **language change** —
  23-rule Language Guard evaluation plus a `spec/` amendment, both prohibited under D3 during
  compiler implementation. No amount of appetite puts this inside RD-13.

  > Two supporting notes for whoever picks this up post-v3. First, the implementation ripple is
  > the largest item here regardless: `ctx.constValues`
  > (`packages/frontend/src/semantics/type-check/statement-typing.ts:253`) is **number**-typed and
  > feeds range checks (`E10084`) and array sizes, neither of which a link-time value can satisfy.
  > The emission half, by contrast, is nearly free once M2 exists — a link-time const is the same
  > expression M2 renders, bound to a name by `AcmeDirective.symbolDef` instead of consumed by an
  > instruction (`symbolDef` carries a `number` today, rendered via `hex16`).
  >
  > Second, **the frozen spec numbers this family inconsistently** and someone will trip on it:
  > `spec/14-diagnostics.md:138-140` assigns E10191 = *assignment to const*, E10192 = *missing
  > initializer*, E10193 = *non-constant initializer*, while `spec/00-feature-index.md:170-172`
  > assigns E10190 = *missing initializer*, E10191 = *non-constant initializer*, E10192 =
  > *assignment to const*. The implementation follows `14-diagnostics.md`
  > (`diagnostic-codes.ts:262`, `NonConstInit: "E10193"`). Both documents state the same
  > **rule**, so the conclusion above is unaffected — but the discrepancy is real, pre-existing,
  > and not RD-13's to fix (D3).
- **Non-power-of-two divisors** (`&X / 40`). ACME would fold it, but the result is not a sprite
  block or any other hardware quantity, and admitting arbitrary divisors widens the operand's
  contract for no measured demand.
- **Making `W10172` fire where the spec *mandates* it** (non-power-of-two shift-and-add). OP-5 is
  not merely mis-triggered — **its positive case has no implementation at all**. A non-power-of-two
  constant multiply never generates a shift-and-add sequence; it falls straight through to
  `JSR __rt_mul8/16` with `W10170` (`translate.ts:1596-1604`). Emitting OP-5 correctly means first
  *building* constant strength reduction (`x * 40` → `(x << 5) + (x << 3)`, including the spec's
  `word` example), which is its own optimization RD.

  > **Consequence, stated so review does not have to discover it: after M3, `W10172` is a
  > registered diagnostic with no producer.** That is the correct intermediate state — a
  > diagnostic that fires only where the spec forbids it is worse than one that does not fire —
  > but it is deliberate, not an oversight. M3 is *"stop emitting it wrongly"*; *"start emitting
  > it rightly"* is spun off, and the closeout must not be read as full OP-5 conformance.
- **The 16 rows S1 re-routes.** Re-routed, not fixed.
- **64-byte alignment itself** — that is RD-15 (#69). This RD supplies the mechanism that
  unblocks it and nothing more.
- **Address arithmetic beyond `/ 2^k` and `>> k` on a bare `&X`** — no `&X + n`, no
  `&X` combined with a runtime value. Those already have working (if unoptimized) paths.

---

## Technical Requirements

### Carrying a byte-selected address through IL (complexity: S)

`ILOperand`'s `addr` variant (`packages/codegen/src/il/operand.ts:40-45`) is word-typed by
construction (`addrOf` hardcodes `IL_WORD`, `:98-99`) and normatively legal in only two positions.
M1 needs "the high byte of `&X`" to be a **byte-typed value** that flows into an ALU left operand
and a store source.

The two shapes worth weighing at plan time — both real, neither obviously dominant:

| Option | Shape | Cost |
|---|---|---|
| **Extend `addr`** | add an optional `select: "low" \| "high"`, typed `IL_BYTE` when present | Touches the operand's stated legality rule and every `isAddr` guard must be re-read to decide whether it means "word address" or "any address operand" — 7 sites |
| **A distinct operand kind** | e.g. `addrByte` | Leaves `addr`'s contract and all 7 guards untouched; adds a variant to the IL union and its printer |

The plan decides. The RD's requirement is only that the choice be **explicit about the 7 `isAddr`
guards** (`translate.ts:698, 921, 954, 978, 1035, 1760, 2044`), because silently widening `isAddr`
is how a word address reaches a byte consumer.

Either way, **the IL operand's position contract gains a third legal shape and must say so.**
`il/operand.ts:23-28` currently states that an address operand *"is legal in exactly two
positions: a `store` source … and an ALU right operand. Every other consumer rejects it loudly."*
M1 needs a byte-selected address to be legal as a **load source** as well, so that the `* 4`'s
`leftIntoA` sees a value already in `A`. That documented rule is load-bearing — it is what makes
drift fail loudly instead of silently misreading — so it is amended deliberately, in the same
change, not left describing a contract the code no longer honours.

> The `lowerAddressOf` routing constraint under M1 applies to **M2's fold path too**, not only to
> M1's byte-select. Any path that reaches a `&` site without calling `lowerAddressOf` loses both
> the RD-03 alignment mark and the positional slot claim.

### The link-time expression operand (complexity: S)

One additive `InstrOperand` variant carrying a symbol, an optional offset and a **power-of-two
shift count**, serialized parenthesized under a low-byte select — `#<(__data_Main_BALLOON / 64)` —
so ACME's precedence cannot reinterpret it. Blast radius is the table under M2: one forced site.

> **A restricted shape, deliberately — not a link-time expression tree.** The variant renders
> exactly **one** closed form. A general expression operand (arbitrary operators, nesting,
> multiple symbols) would be speculative generality: nothing in this RD or RD-15 needs it, and it
> is the shape that would make the single forced serializer site grow into a sub-language. The
> restriction is what keeps the blast radius at one site, and it is a requirement, not a
> convenience.
>
> The low-byte select is also what makes the fold **safe at every address**. `lo()` truncates by
> definition, so `#<(sym / 64)` is always in immediate range — ACME never has to reject it. (The
> pre-existing silent wrap of `hi(&X) * 4` above `$4000`, where the two `ASL`s discard the top
> bits and the VIC reads zero page, is untouched by this RD and stays tracked as
> [#68](https://github.com/blendsdk/blend65/issues/68).)

### Instruction selection (complexity: S)

`translate.ts:698-714` already demonstrates the emission shape for byte-selected symbols. M1 adds
the single-instruction load path; M2 adds the folded-immediate path. `translateMul`'s power-of-two
branch (`:1578-1594`) loses only its `bag.addWarning` call for M3 — the `ASL` sequence itself is
correct and stays.

---

## Integration Points

### Packages touched

`@blend65/core` (the new `InstrOperand` variant), `@blend65/codegen` (IL operand carrier, `emitHi`
/ `emitLo`, division/shift folding, `symbolText`, the `W10172` removal),
`@blend65/test-harness` (goldens, budgets, scoreboard, `twins.json` routing).

`@blend65/frontend`, `@blend65/language-server`, `@blend65/compiler` and `@blend65/cli` are **not**
touched. R15 holds trivially — nothing here adds a codegen import anywhere.

### With RD-03 (address-taken alignment, ✅)

Load-bearing, in one direction: RD-03's alignment mark lives inside the function M1 changes the
call into. See the hazard note under M1. RD-03's page alignment remains correct and unchanged —
`hi(&X) * 4` keeps working, it simply stops costing 8 instructions.

### With RD-15 (#69, 64-byte alignment)

M2 is the whole unblock. Once `&X / 64` folds, a 64-byte-aligned array can name its own sprite
block correctly, and RD-15's remaining question — *which* boundary a given array needs (64 for
sprites, 256 for indexed tables) — becomes answerable independently of how the block is spelled.

---

## Security Considerations

No new runtime surface, no I/O, no user input. Two notes:

- **The folded operand is emitted, never parsed.** Symbol names come from the compiler's own
  symbol construction (`constDataSymbol`, `frameSymbol`), not from source text, so the
  parenthesized expression cannot carry user-controlled assembler syntax.
- **The out-of-range case moves from silent wrap to a hard ACME error** (see above). Failing
  loudly is the safer direction, but it is a new way for a previously-building program to stop
  building.

---

## Acceptance Criteria

**CI** = runs on every push (ACME available, no emulator — AR-27). **Local** =
`skipIf(!hasVice())`, proven locally, never in CI.

1. [ ] **[CI]** **`hi(&X)` / `lo(&X)` cost one instruction each**: the emitted sequence for
   `poke($07F8, hi(&X) * 4)` contains no frame-slot store or reload of the address, and the high
   byte is read as an immediate byte-select of the symbol.
2. [ ] **[CI]** **Alignment survives** — the regression this RD is most able to cause:
   `__data_Main_BALLOON` still resolves to a multiple of 256 through the symbol map. Asserted on
   `balloon`, whose single `&` is the very site M1 rewrites.
3. [ ] **[CI]** **The synthetic slot count is unchanged**: `model-adapter.spec.test.ts`'s pinned
   `0sc*` lists pass **untouched**, proving the positional counter never shifted.
4. [ ] **[CI]** **`lo(&X / 2^k)` folds**: `poke($07F8, lo(&X / 64))` emits a single immediate load
   whose operand ACME resolves, with **no** `JSR __rt_div16` and no `W10171`; and the assembled
   byte equals the array's resolved address ÷ 64, read back from the symbol map. *Asserting the
   assembled byte against the symbol map — not merely the directive's presence — is the point:
   RD-03's `!align 256, 0` trap showed that a plausible-looking operand can assemble cleanly and
   mean something else.*
5. [ ] **[CI]** **`lo(&X >> k)` folds**: `poke($07F8, lo(&X >> 6))` builds — no `E90001` — and
   agrees byte-for-byte with the `/ 64` form.
6. [ ] **[CI + Local]** **The blessed idiom migrates**: the `examples/` sources that teach
   `hi(&X) * 4` use `lo(&X / 64)` instead, their goldens are regenerated, and `balloon` still
   resolves the same sprite block — proven on VICE by AC-10.
7. [ ] **[CI]** **`W10172` conforms to OP-5**: building `examples/balloon` emits **no** `W10172`;
   indexing a `word[]` emits no `W10172`; the `ASL` sequences both cases generate are unchanged.
   The two re-derived spec tests cite `spec/evaluations/F017-operators.md:442` in their headers.
8. [ ] **[CI + review]** **No fixture regresses**: no individual fixture grows; every `bytes`
   ratchet re-derived from the new build; goldens regenerated and hand-reviewed; the scoreboard
   freshness gate green. "Corpus total strictly decreases" is a **review gate, not a test** — the
   budget tier only fails on `actual > budget` and would pass growth accompanied by a raised
   ratchet.
9. [ ] **[CI]** **The routing ledger is true**: balloon's `hi(&BALLOON) * 4` row is re-authored
   from measurement, and the 16 rows under S1 no longer name #58 as their owner.
10. [ ] **[Local]** **`balloon` still renders on VICE 3.10**: its shared source-mandated
    observables and its own fixture-suite checks (sprite pointer, image block) pass unchanged.
    This is the only tier that can prove the VIC still reads real sprite data — AC-2 proves the
    address is aligned, AC-10 proves the sprite is *there*. With the idiom migration in AC-6 this
    is **not** a formality: it is the sole end-to-end check that `lo(&X / 64)` names the same
    block `hi(&X) * 4` did.
11. [ ] **[Review]** **`spec/` untouched**: `git status --porcelain spec/` empty (D3), no new
    syntax, and the `W10172` change is a **removal** of non-conformant behaviour, not a spec
    revision. Discharged by a closeout walk of the commit range.
12. [ ] **[CI]** **Boundary holds**: the repo-root boundary tier green (R15 / AR-20).

### Projected target

Instruction-level arithmetic, to be **re-derived from the built binary at implementation time**
and never assumed from these figures:

| Path | Emission | Bytes | Cycles |
|---|---|---|---|
| today | `LDA #<` 2 · `STA` 3 · `LDA #>` 2 · `STA` 3 · `LDA` 3 · `ASL` 1 · `ASL` 1 · `STA` 3 | 18 | 24 |
| M1 only (`hi(&X) * 4` kept) | `LDA #>` 2 · `ASL` 1 · `ASL` 1 · `STA` 3 | 7 | 10 |
| **M1 + M2 + AC-6 (`lo(&X / 64)`)** | `LDA #<(sym/64)` 2 · `STA` 3 | **5** | **6** |

`balloon` **318 → ~305 bytes** against its twin's 251 — **1.27× → ~1.21×** — and static cycles
300 → ~282, **1.21× → ~1.14×**. The corpus total moves by the same 13 bytes: 3257 → ~3244,
3.54× → ~3.53×.

Two honest qualifications:

- **The byte count is not the headline.** Thirteen bytes on one fixture is a rounding error
  against a 3257-byte corpus, and RD-13 moves **1** of 53 routed divergence rows. What it
  actually buys is that the two alignment-independent ways to name a sprite block stop being a
  runtime software division and a hard compile error — which is what makes RD-15's 193 bytes
  (33% of that demo) reachable at all, and what lets a developer write the idiom they would have
  written by hand.
- **`balloon` still does not beat its twin on bytes**, and this RD does not change that. It
  narrows the gap; the twin remains ahead at 251.
