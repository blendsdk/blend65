# Execution Plan: Symbolic Address Arithmetic

> **Implements**: asm-parity/RD-13 · [00-index.md](00-index.md)
> **Progress**: 54/54 tasks (100%) — complete
> **Last Updated**: 2026-07-21 (Phase 5 — ledgers re-authored, RD corrected, closed out)
> **CodeOps Skills Version**: 3.11.0

**Verify** (AR #95), run at every marked point:

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Ordering within every phase is **spec tests → RED → implement → GREEN → impl tests → full verify**.
One commit per phase. Byte-moving phases carry their source edit, ratchet and `SCOREBOARD.md` in
that **same** commit — the freshness gate rebuilds every pair from `examples/` source, so splitting
them is CI-red by construction.

> **The one deliberate deviation**: Phases 2 and 3 add behaviour-neutral *type scaffolding* (the
> operand variants, their printers, the mapping site) ahead of their spec tests. RED stays genuine
> because nothing **produces** the new operands until tasks 2.8 and 3.8 — the scaffolding cannot
> make a spec test pass. Noted so an executor or phase reviewer does not read it as a violation.

| Phase | Delivers | Byte movement | Tasks |
|---|---|---|---|
| 1 | M3 — `W10172` conforms to OP-5 | none | 6 |
| 2 | M1 — one-instruction byte-select | `balloon` code −11 B, **binary ±0** | 16 |
| 3 | M2 — the fold operand, built **unwired** | none | 12 |
| 4 | AC-6 — all three examples migrate | `balloon` code −2 B, **binary ±0** | 11 |
| 5 | M4/M5 — ledgers, back-propagation, closeout | none | 9 |

**No committed golden changes in any phase.** The 14 corpus fixtures are untouched by M1, M2 and M3
alike; only `balloon`, `balloon-color` and `boing-ball` move, and none has a golden. Every
"regenerate the goldens" step below is therefore a **zero-diff guard**, and the Prime-Directive
hand-review is pointed at `balloon`'s assembly against its committed twin instead.

---

## Phase 1 — M3: `W10172` conformance

Independently shippable, no dependency on M1, zero byte movement (AR #94). Touches no ratchet, no
golden, no scoreboard. Spec: [03-02 §1](03-02-diagnostics-examples-ledgers.md#1--m3--w10172-conformance-phase-1).

- [x] 1.1 Re-derive **ST-51a** (`translate-indexed.spec.test.ts:112,121`): invert the diagnostic
      expectation to absent, update the title, add the `spec/evaluations/F017-operators.md:442`
      citation to its header. `ASL` present / `__rt_mul8` absent stay unchanged
- [x] 1.2 Re-derive **ST-T16** (`translate.spec.test.ts:458,470`) the same way; the exact
      `LDA a`/`ASL`×3/`STA r` text assertion at `:467-469` stays byte-for-byte. **Also rewrite the
      comment at `:457`** — *"// mul by a constant power-of-two → shift sequence; W10172 emitted."*
      — which is the fifth site of the diagnostic's footprint and would otherwise state the
      opposite of what the test pins
- [x] 1.3 Write **ST-13c** — a user-written runtime power-of-two multiply emits no
      `ShiftAndAddMultiply`, with both `ASL`s pinned present. This is AC-7's witness and must
      survive Phase 4, when `balloon` loses its multiply entirely
- [x] 1.4 **Verify RED** — all three fail for the stated reason, not an unrelated one
      *(2026-07-21: 3 failed / 38 passed; each failure on the `ShiftAndAddMultiply`
      assertion alone — ST-13c's `ASL`×2, no-`__rt_mul8` and no-W10170 assertions
      passed on the unmodified compiler)*
- [x] 1.5 Delete the `bag.addWarning(DiagCode.ShiftAndAddMultiply, …)` call at
      `translate.ts:1588-1592`. Nothing else in `translateMul` moves; the registration at
      `diagnostic-codes.ts:374` **stays**
- [x] 1.6 **Verify GREEN** + full verify. Confirm zero byte movement: 14 goldens byte-identical,
      `budgets.json` untouched, `SCOREBOARD.md` unchanged
      *(2026-07-21: full verify green — codegen 78 files / 696 tests, whole run exit 0.
      `git status --porcelain` on `examples/`, the golden dir, `budgets.json` and
      `SCOREBOARD.md` returns **0 lines**; `spec/` clean)*

**Commit point.** Scope `fix(codegen)`.

---

## Phase 2 — M1: one-instruction byte-select

The hazard phase. Every path routes through `lowerAddressOf(arg, ctx, true)`, which carries both
the page-alignment mark and the positional slot claim. Spec:
[03-01 §1, §4, §5](03-01-operand-and-lowering.md).

- [x] 2.1 Add the **three ICE guards** (AR #92): trailing `iceUnsupported` in `leftIntoA`
      (`translate.ts:950`), an `else` on `bringValueIntoRegisters`'s `if (lo && hi)` (`:998`), and
      `iceUnsupported` replacing `rightSource`'s `{ none(), "Implied" }` fallthrough (`:1052`).
      **Full verify green here is the proof they are unreachable** for every currently-compiling
      program — it must be run and recorded before anything else in this phase
- [x] 2.2 Add the `addrByte` variant to `ILOperand` with `addrByteOf` and `isAddrByte`; extend the
      union's doc comment. `addr`'s two-position rule is **not** amended. No barrel change —
      `il/index.ts` does not export `addrOf`/`isAddr` either
- [x] 2.3 Add the `renderOperand` arm in `print-il.ts` (TS2366-forced until written)
- [x] 2.4 Add `instrOperandFor` in `instr/translate.ts` — the single `addrByte` → `InstrOperand`
      mapping site; shift-absent → `symbolRef(name, { byteSelect })`
- [x] 2.5 Write **ST-13a**, **ST-13b**, **ST-13g** — all four operand kinds including locals
      (AR #91), **and the three non-`poke` positions**: index `table[lo(&X)]` (AR #97), `let`
      initializer `let b: byte = lo(&X);` and assignment `v = hi(&X);` (AR #99). All three compile
      today; each would regress to an `E90001` without its arm, and no existing test covers them
- [x] 2.6 Re-derive **ST-9b** — no homing store, no slot reload, and a trailing **homing** `&` site
      (`let w: word = &helper + 2;`) still emits `store &Main_helper, __frame_Main_main_0sc2`,
      which is AC-3's real proof. **It must be a homing site, not a plain store**: every plain-store
      position lowers with `direct = true`, so the slot name never reaches the IL text and the
      assertion would be unwritable. Update the module header prose at
      `lower-address-of.spec.test.ts:6-10` to drop `lo`/`hi` extraction from the homing sentence
- [x] 2.7 **Verify RED**
- [x] 2.8 Switch `emitLo` (`lower.ts:2536`) and `emitHi` (`:2570`) to
      `lowerAddressOf(arg, ctx, true)` and return `addrByteOf(...)` **directly** — no `load`, no
      temp, mirroring the numeric-literal path at `:2534`
- [x] 2.9 Add the `byteRefOf` arm (`translate.ts:1008`): byteIndex 0 → the mapped operand in
      Immediate mode, byteIndex 1 → `imm8(0)`
- [x] 2.10 Add the `leftIntoA` arm (`translate.ts:920`): emit `LDA` Immediate, then `clearRegs()`,
      following the `isImmediate` arm exactly
- [x] 2.11 Add the `indexIntoX` arm (`translate.ts:1758`): emit `LDX` Immediate, following its
      `isImmediate` arm at `:1764-1767` (AR #97). **Without this `table[lo(&X)]` — which compiles
      today — becomes an `E90001`.** The trailing ICE at `:1786` stays for genuinely unhandled kinds
- [x] 2.12 Add the `translateConst` arm (`translate.ts:655`), **ahead of** its temp/immediate guard:
      `protectA()` · `LDA` Immediate via `instrOperandFor` · `bindA(dest.id)`, byte-only (AR #99).
      **This is not optional hardening.** Only a store source takes a lowered operand raw; all ten
      other expression positions funnel through `materialise` → `const` → `translateConst`
      (`lower.ts:2659-2666`), so without this arm `let b: byte = lo(&X);` and `v = hi(&X);` — both
      of which **compile today** — become `E90001` the moment task 2.8 lands, and task 4.7's
      migration cannot build at all
- [x] 2.13 **Verify GREEN**
- [x] 2.14 Implementation tests: `addrByteOf` / `isAddrByte` / `instrOperandFor`; **each of the
      three ICE guards firing** on a deliberately malformed operand (2.1 proved them unreachable,
      never that they work); the `indexIntoX` and `translateConst` arms
- [x] 2.15 **Seed and watch fail**: break ST-13a's byte-select expectation; and seed ST-C15
      **code-side** by dropping the alignment mark at `lower.ts:1863`, rebuilding, and watching
      `addr % 256 == 0` fail. Restore both. Perturbing ST-C15's assertion instead would prove only
      that the test runs, not that it detects the hazard it exists for
- [x] 2.16 Re-derive `balloon`'s `bytes` ratchet **from the new build**; regenerate
      `SCOREBOARD.md`; confirm the 14 goldens byte-identical and ST-C15 green (AC-2);
      **hand-review `balloon`'s regenerated assembly against `examples/balloon/balloon.asm`**, its
      committed hand-written twin — this is the code the RD exists to produce, and the only phase
      gate that reads it; full verify

> **Measured at 2.16 — the phase's byte prediction was wrong, and the reason matters.** The
> pointer idiom went 18 B → **7 B** and 24 cyc → **10 cyc** exactly as [03-01 §7](03-01-operand-and-lowering.md#7-projected-emission)
> projected. But `balloon`'s **binary did not shrink**: its sprite is `!align 256`, so all 11 saved
> code bytes were absorbed by page padding, which grew from 6 B to 17 B. The `bytes` ratchet
> re-derives to the same **318** and `budgets.json` is unchanged; the scoreboard moves on cycles
> only — `balloon` 300 → **286** (1.21× → **1.15×**), corpus 4237 → **4223**. Phase 4's further
> −2 B will be absorbed the same way, so this RD never moves `balloon`'s byte ratchet at all.
> That is not a defect in M1 — it is the cost RD-15 exists to remove, and the sharpest evidence yet
> for it: at 64-byte alignment the padding is 1 B and the saving is real.
>
> Also resolved here: **AR #100 (runtime)** — the shrink pushed `balloon`'s `!align` padding past
> 8 bytes, so ACME truncated its report byte column and it abutted the column-zero directive,
> breaking `parseReportFile`. A pre-existing parser defect, fixed with a regression test in the
> same commit.

**Commit point.** Scope `perf(codegen)`. Source, ratchet and scoreboard together.

---

## Phase 3 — M2: the fold operand, built unwired

Nothing in `examples/` uses the fold yet, so the 14 byte-identical goldens are a free proof that
M2 changed nothing it was not asked to change. Spec:
[03-01 §2, §3, §4](03-01-operand-and-lowering.md).

- [x] 3.1 Move `log2Exact` (`translate.ts:2330`) to a new `packages/codegen/src/util/bits.ts`;
      update both importers. `il/` must not import from `instr/`; `util/` rather than the package
      root because every codegen module lives under a subdirectory. Pure move — full verify green
- [x] 3.2 Add the `symbolExpr` variant to `InstrOperand` with its constructor and
      `isSymbolExprOperand`. `shift` (≥ 1) and `byteSelect` are **required**; there is **no**
      `offset` field. **Add both symbols to all three re-export lists** —
      `core/src/instr-model/index.ts`, `codegen/src/instr/operand.ts` (the shim `translate.ts:44`
      imports from), `codegen/src/instr/index.ts`. Only the shim is build-forced; TS2366 does not
      reach a re-export list
- [x] 3.3 Add the `symbolText` arm (`print-instr.ts:58`) rendering `<(sym / 2^k)` — divisor form,
      matching the hand idiom and the ACME 0.97 measurement (TS2366-forced until written)
- [x] 3.4 Extend `instrOperandFor`: shift-present → `symbolExpr(name, shift, select)`
- [x] 3.5 Write **ST-13d** and **ST-13e** in a new `symbolic-address.spec.test.ts` in test-harness
      under `skipIf(!hasAcme())`, building an **inline source through the `build()` facade in a temp
      dir** — `testing/balloon.ts` cannot serve, since it compiles the committed balloon, which does
      not carry the fold until Phase 4. Do **not** add a probe to `examples/` (that would owe the
      coverage manifest a tier). The oracle is the **assembled byte**, read by scanning
      `result.binary` for the `A9 xx 8D F8 07` pattern and comparing `xx` against the symbol map,
      never operand presence
- [x] 3.6 Write **ST-13h** (degenerate ends `k = 0`; **the `k = 8` and `k = 15` folds**; `/40`
      byte-identical with `W10171`; `>>16` still `W10174` + `E90001` with no emission) and
      **ST-13i** (named const for **both** operators — `/BLOCK` and `>>SHIFT`, AR #90; the `>>` half
      is where an unresolved const is a hard error rather than merely slow)
- [x] 3.7 **Verify RED**
- [x] 3.8 Add the fold pattern-match to `emitLo` only. **The two operators derive `k`
      differently**: `/` takes a power-of-two divisor and `k = log2Exact(divisor)`; `>>` takes a
      constant count `0..15` and `k = count`. Either right operand may be a literal or a const
      resolved through `ctx.model.constValues`. The symbol comes from
      `lowerAddressOf(binary.left, ctx, true)`. `k = 0` → M1's plain byte-select (an explicit
      branch — a `BinaryExpr` can never reach the `isAddressOfExpr` branch); `k = 1..15` →
      `addrByteOf(sym, "low", k)`; everything else falls through unchanged with **no new
      diagnostic**. **Do not mask the divisor to a byte** — `k = 1..15` needs values to 32768, and
      `translate.ts:1581`'s `& 0xff` is correct only for the byte-only multiply. `emitHi` gains no
      fold branch
- [x] 3.9 **Verify GREEN**
- [x] 3.10 Implementation tests: `symbolExpr`, `symbolText` across `k = 1..15` and both selects,
      `instrOperandFor`'s two branches, and **first-time direct coverage for `log2Exact`** — it has
      none today (module-private, reached only through `translateMul`), so there are no cases to
      relocate: 0 and negatives → `null`; 1 → 0; 2 → 1; 64 → 6; 256 → 8; 32768 → 15; 40 → `null`
- [x] 3.11 **Seed and watch fail**: perturb ST-13d's expected assembled byte and confirm it fails —
      this is the trap RD-03's `!align 256, 0` sprang, where a plausible operand assembled cleanly
      and meant something else
- [x] 3.12 Confirm **zero byte movement**: 14 goldens byte-identical, no ratchet moves,
      `SCOREBOARD.md` unchanged; full verify

> **Measured at 3.12 — zero byte movement, as designed.** No golden, no ratchet, no
> `SCOREBOARD.md` line moved: nothing under `examples/` uses the fold yet, so the 14 byte-identical
> goldens are a free proof M2 changed nothing it was not asked to. ST-13d's assembled byte reads
> **36** — `$0900 / 64` — and the seed at 3.11 detected a one-off in it.

**Commit point.** Scope `feat(codegen)`.

---

## Phase 4 — AC-6: the blessed idiom migrates

Lands only after M2 is wired. Migrating earlier makes `balloon` grow past its ratchet, fires
`W10171`, and reds the freshness gate. Spec:
[03-02 §2](03-02-diagnostics-examples-ledgers.md#2--ac-6--the-idiom-migration-phase-4).

- [x] 4.1 Write **ST-13f** plus a `testing/balloon-color.ts` builder mirroring `testing/balloon.ts`;
      new `balloon-color.spec.test.ts`, build-only under `skipIf(!hasAcme())`. Its `$07F8` byte
      **is** link-time — the migrated expression feeds the store directly. **Move `balloon-color`
      out of `pendingSuite` in `packages/test-harness/test/golden/examples-coverage.json` and name
      the new suite in `suites`** — the waiver exists only until this task lands
- [x] 4.2 Write **ST-13j** plus a `testing/boing-ball.ts` builder; new `boing-ball.spec.test.ts`.
      **Its CI half asserts only link-time facts** (AR #98): the `base` initializer's immediate ==
      `(symbolMap(BALL) / 64) & 0xFF`, plus the `ADC #1`/`#2`/`#3` → `STA $07F9`..`$07FB` chain that
      proves the value is still a usable 64-byte block base. The four pointer **values** do not
      exist in the PRG — they are computed at runtime as `p = base + frame * 4` — so write
      **ST-13k** alongside it under `skipIf(!hasVice())`, asserting `peek($07F8..$07FB)`; it runs in
      task 5.5, not in CI. **Clear its `pendingSuite` waiver too** — after 4.1 and 4.2 that list
      must be empty
- [x] 4.3 Re-derive **ST-C14** (`balloon.spec.test.ts:169-181`) to the two-instruction subsequence
      `LDA #<(__data_Main_BALLOON / 64)` · `STA $07F8`, and rewrite its comment to describe the
      folded form rather than a weakness that no longer exists. **`:166-167` — the
      embed-appears-exactly-once assertions in the same block — are not part of this and stay
      byte-for-byte.** ST-C15 (`:184-195`) is untouched, comment included
- [x] 4.4 **Verify RED**
- [x] 4.5 Migrate `examples/balloon/main.blend:11` to `poke($07F8, lo(&BALLOON / 64));` and rewrite
      the teaching comment at `:8-10` — the block is the address divided by 64, not the high byte
      times four
- [x] 4.6 Migrate `examples/balloon-color/main.blend:21` and its comment at `:18-20` the same way
- [x] 4.7 Migrate `examples/boing-ball/main.blend:54` to `let base: byte = lo(&BALL / 64);` and its
      comment at `:52-53`. A **`let` initializer**, not a `poke` value — same lowering route, and
      the one site whose result is then used arithmetically (`p = base + frame * 4`, `:91-99`)
- [x] 4.8 **Verify GREEN**
- [x] 4.9 Re-derive `balloon`'s ratchet from the new build and regenerate `SCOREBOARD.md` —
      **same commit** as tasks 4.5–4.7
- [x] 4.10 **Hand-review `balloon`'s regenerated assembly against `examples/balloon/balloon.asm`**,
      its committed hand-written twin, and judge the migrated demos' emissions the same way. A
      divergence is a defect: fix it or file it, never shrug it off. (The 14 goldens cannot change
      in this phase — see 4.11 — so there are no golden hunks to review; this is where the
      Prime-Directive read actually happens)
- [x] 4.11 Confirm **zero golden diff** — a non-empty one is a defect to stop on, since no corpus
      fixture should move — plus **ST-C15 still green** (AC-2) and no fixture grew; full verify

> **Measured at 4.9/4.10 — parity reached on this idiom, and the hand-review says so plainly.**
> `balloon`'s pointer store is now instruction-for-instruction what its committed twin writes:
>
> | | |
> |---|---|
> | twin (`balloon.asm`) | `lda #13` · `sta $07f8` — block counted by hand |
> | compiled | `LDA #<(__data_Main_BALLOON / 64)` · `STA $7F8` |
>
> Same two instructions, same 5 bytes, same 6 cycles — the difference is only that the assembler
> supplies the constant instead of the programmer counting blocks, which is the version that cannot
> go stale when the image moves. End to end this RD took the idiom **18 B / 24 cyc → 5 B / 6 cyc**,
> exactly [03-01 §7](03-01-operand-and-lowering.md#7-projected-emission).
>
> Bytes again land in padding, as in Phase 2: `balloon` 318 → **318**, ratchet unmoved,
> `budgets.json` untouched. Cycles carry it — `balloon` 286 → **282** (1.15× → **1.14×**), corpus
> 4223 → **4219**. Zero golden diff; ST-C15 green; `pendingSuite` **empty**, both demos now built by
> a named suite, and `boing-ball`'s four sprite pointers verified on VICE 3.10 as well.

**Commit point.** Scope `perf(examples)`. Source, ratchet and scoreboard together.

---

## Phase 5 — Ledgers, back-propagation, closeout

Spec: [03-02 §3–§5](03-02-diagnostics-examples-ledgers.md#3--m4--the-ledgers-stay-true-phases-2-4-5).

- [x] 5.1 Add the structural manifest check to `twin-manifest.spec.test.ts`: **no `twins.json` row
      carries `"issue": 58`** — flatly, with no exception clause, since all 17 rows are accounted
      for as 1 re-authored + 16 re-routed. **Watch it fail on all 17 first**; this is the phase's
      RED, and writing it after 5.2/5.3 would make it unfailable
- [x] 5.2 Re-author **all three** of `balloon`'s routing rows **from measurement**. The
      `hi(&BALLOON) * 4` row on `#58` describes a divergence that no longer exists at all — 0 `ASL`s,
      no warning, instruction-identical to the twin — and must name its measured owner rather than
      #58. The other two are off by the two migrated bytes and were **not** anticipated when this
      plan was written; Phase 4's review found them: `layout`/#52 reads *"code stream 237 vs 176,
      +61"* and `data placement`/#49 reads *"non-code 81 vs 75, +6"*. **The corrected figures this
      task was written with — 235/+59 and 83/+8 — are themselves wrong**: they account for Phase 4's
      2 bytes and not Phase 2's 11. Measured with `yarn twin:diff`, the truth is **code 224 vs 176,
      +48** and **non-code 94 vs 75, +19**. See [08-closeout.md](08-closeout.md#ledger-changes). The
      total is unchanged at 318 throughout, which is exactly why no
      gate caught it — the generator's stale-key abort is category-granular, and every category
      still has backing rows
- [x] 5.3 Re-route the **16** misrouted rows (8 instruction-selection + 8 layout) from `#58` to
      [#70](https://github.com/blendsdk/blend65/issues/70). They are re-routed, **not** fixed.
      5.1 turns green here
- [x] 5.4 Back-propagate the **three** RD corrections — the locals claim (AR #91), the "load source"
      framing (AR #88), and AC-6's scope, which the RD states as *"both examples"* while this plan
      migrates three (AR #96) — into
      [RD-13](../../requirements/RD-13-symbolic-address-arithmetic.md)
- [x] 5.5 Run the **local VICE 3.10 tier** for AC-10 and **ST-13k**: `balloon` renders and its
      shared observables pass unchanged; `boing-ball`'s four sprite pointers read `b, b+1, b+2, b+3`
      in memory — the runtime half CI structurally cannot prove
- [x] 5.6 Walk all **12 acceptance criteria** with evidence into `08-closeout.md`, stating plainly
      that RD-13 moves **1** of 53 routed divergence rows and re-routes 16 — and that `balloon`
      still does not beat its twin on bytes
- [x] 5.7 Confirm `git status --porcelain spec/` empty across the whole commit range (AC-11), and
      that the corpus total **strictly decreased** — AC-8's review half, which no test enforces
- [x] 5.8 Sync the feature roadmap and the portfolio roadmap; post the area report on
      [#58](https://github.com/blendsdk/blend65/issues/58), noting that #58 **stays open** for its
      remaining audit halves
- [x] 5.9 Full verify

**Commit point.** Scope `docs(rd-13)`.

---

## Standing constraints

| Constraint | Applies |
|---|---|
| `git status --porcelain spec/` stays empty | every commit (D3) |
| No plan, requirement, task, AR or issue ID in any code or doc comment | every file touched |
| Newly added lines Prettier-clean; never `--write` a file carrying pre-existing drift | every file touched |
| No new diagnostics — `k >= 16`, non-power-of-two divisors and every word-context form keep today's behaviour exactly (`W10171`, `W10174`, `E90001`) | Phases 3, 4 |
| No committed golden changes; a non-empty golden diff is a defect to stop on | every phase |
| A spec test is never edited to make an implementation pass | Phases 1, 2, 4 |
| Any undetermined decision: **STOP**, log as the next `AR #n (runtime)`, resolve with the user, back-propagate | every phase |
