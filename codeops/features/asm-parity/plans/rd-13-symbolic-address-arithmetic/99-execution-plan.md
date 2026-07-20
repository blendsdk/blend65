# Execution Plan: Symbolic Address Arithmetic

> **Implements**: asm-parity/RD-13 · [00-index.md](00-index.md)
> **Progress**: 0/52 tasks (0%)
> **Last Updated**: 2026-07-21
> **CodeOps Skills Version**: 3.11.0

**Verify** (AR #95), run at every marked point:

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Ordering within every phase is **spec tests → RED → implement → GREEN → impl tests → full verify**.
One commit per phase. Byte-moving phases carry their source edit, ratchet, goldens and
`SCOREBOARD.md` in that **same** commit — the freshness gate rebuilds every pair from `examples/`
source, so splitting them is CI-red by construction.

| Phase | Delivers | Byte movement | Tasks |
|---|---|---|---|
| 1 | M3 — `W10172` conforms to OP-5 | none | 6 |
| 2 | M1 — one-instruction byte-select | `balloon` −11 B | 14 |
| 3 | M2 — the fold operand, built **unwired** | none | 12 |
| 4 | AC-6 — all three examples migrate | `balloon` −2 B | 11 |
| 5 | M4/M5 — ledgers, back-propagation, closeout | none | 9 |

---

## Phase 1 — M3: `W10172` conformance

Independently shippable, no dependency on M1, zero byte movement (AR #94). Touches no ratchet, no
golden, no scoreboard. Spec: [03-02 §1](03-02-diagnostics-examples-ledgers.md#1--m3--w10172-conformance-phase-1).

- [ ] 1.1 Re-derive **ST-51a** (`translate-indexed.spec.test.ts:112,121`): invert the diagnostic
      expectation to absent, update the title, add the `spec/evaluations/F017-operators.md:442`
      citation to its header. `ASL` present / `__rt_mul8` absent stay unchanged
- [ ] 1.2 Re-derive **ST-T16** (`translate.spec.test.ts:458,470`) the same way; the exact
      `LDA a`/`ASL`×3/`STA r` text assertion at `:466-469` stays byte-for-byte
- [ ] 1.3 Write **ST-13c** — a user-written runtime power-of-two multiply emits no
      `ShiftAndAddMultiply`, with both `ASL`s pinned present. This is AC-7's witness and must
      survive Phase 4, when `balloon` loses its multiply entirely
- [ ] 1.4 **Verify RED** — all three fail for the stated reason, not an unrelated one
- [ ] 1.5 Delete the `bag.addWarning(DiagCode.ShiftAndAddMultiply, …)` call at
      `translate.ts:1588-1592`. Nothing else in `translateMul` moves; the registration at
      `diagnostic-codes.ts:374` **stays**
- [ ] 1.6 **Verify GREEN** + full verify. Confirm zero byte movement: 14 goldens byte-identical,
      `budgets.json` untouched, `SCOREBOARD.md` unchanged

**Commit point.** Scope `fix(codegen)`.

---

## Phase 2 — M1: one-instruction byte-select

The hazard phase. Every path routes through `lowerAddressOf(arg, ctx, true)`, which carries both
the page-alignment mark and the positional slot claim. Spec:
[03-01 §1, §4, §5](03-01-operand-and-lowering.md).

- [ ] 2.1 Add the **three ICE guards** (AR #92): trailing `iceUnsupported` in `leftIntoA`
      (`translate.ts:950`), an `else` on `bringValueIntoRegisters`'s `if (lo && hi)` (`:998`), and
      `iceUnsupported` replacing `rightSource`'s `{ none(), "Implied" }` fallthrough (`:1052`).
      **Full verify green here is the proof they are unreachable** for every currently-compiling
      program — it must be run and recorded before anything else in this phase
- [ ] 2.2 Add the `addrByte` variant to `ILOperand` with `addrByteOf` and `isAddrByte`; extend the
      union's doc comment. `addr`'s two-position rule is **not** amended
- [ ] 2.3 Add the `renderOperand` arm in `print-il.ts` (TS2366-forced until written)
- [ ] 2.4 Add `instrOperandFor` — the single `addrByte` → `InstrOperand` mapping site; shift-absent
      → `symbolRef(name, { byteSelect })`
- [ ] 2.5 Write **ST-13a**, **ST-13b**, **ST-13g** (all four operand kinds, locals included per
      AR #91)
- [ ] 2.6 Re-derive **ST-9b** — no homing store, no slot reload, and the trailing plain-store `&`
      site still receives `0sc2`, which is AC-3's real proof. Update the module header prose at
      `lower-address-of.spec.test.ts:6-10` to drop `lo`/`hi` extraction from the homing sentence
- [ ] 2.7 **Verify RED**
- [ ] 2.8 Switch `emitLo` (`lower.ts:2536`) and `emitHi` (`:2570`) to
      `lowerAddressOf(arg, ctx, true)` and return `addrByteOf(...)` **directly** — no `load`, no
      temp, mirroring the numeric-literal path at `:2534`
- [ ] 2.9 Add the `byteRefOf` arm (`translate.ts:1008`): byteIndex 0 → the mapped operand in
      Immediate mode, byteIndex 1 → `imm8(0)`
- [ ] 2.10 Add the `leftIntoA` arm (`translate.ts:920`): emit `LDA` Immediate, then `clearRegs()`,
      following the `isImmediate` arm exactly
- [ ] 2.11 **Verify GREEN**
- [ ] 2.12 Implementation tests: `addrByteOf` / `isAddrByte` / `instrOperandFor`
- [ ] 2.13 **Seed and watch fail**: break ST-13a's byte-select expectation and ST-C15's alignment
      assertion, confirm each fails loudly, restore. A claim that cannot be watched failing is not
      yet proven
- [ ] 2.14 Re-derive `balloon`'s `bytes` ratchet **from the new build**; regenerate
      `SCOREBOARD.md`; confirm the 14 goldens byte-identical and ST-C15 green (AC-2); full verify

**Commit point.** Scope `perf(codegen)`. Source, ratchet and scoreboard together.

---

## Phase 3 — M2: the fold operand, built unwired

Nothing in `examples/` uses the fold yet, so the 14 byte-identical goldens are a free proof that
M2 changed nothing it was not asked to change. Spec:
[03-01 §2, §3, §4](03-01-operand-and-lowering.md).

- [ ] 3.1 Move `log2Exact` (`translate.ts:2330`) to a new `packages/codegen/src/bits.ts`; update
      both importers. `il/` must not import from `instr/`. Pure move — full verify green
- [ ] 3.2 Add the `symbolExpr` variant to `InstrOperand` with its constructor and
      `isSymbolExprOperand`. `shift` (≥ 1) and `byteSelect` are **required**; there is **no**
      `offset` field
- [ ] 3.3 Add the `symbolText` arm (`print-instr.ts:58`) rendering `<(sym / 2^k)` — divisor form,
      matching the hand idiom and the ACME 0.97 measurement (TS2366-forced until written)
- [ ] 3.4 Extend `instrOperandFor`: shift-present → `symbolExpr(name, shift, select)`
- [ ] 3.5 Write **ST-13d** and **ST-13e** in the harness tier under `skipIf(!hasAcme())` — the
      oracle is the **assembled byte** checked against the symbol map, never operand presence
- [ ] 3.6 Write **ST-13h** (edges: `k = 0` degenerates; `/40` and `>>16` byte-identical to today,
      today's diagnostics intact) and **ST-13i** (named-const divisor, AR #90)
- [ ] 3.7 **Verify RED**
- [ ] 3.8 Add the fold pattern-match to `emitLo` only: `BinaryExpr(op ∈ {"/", ">>"}, &X,
      power-of-two constant)`, divisor a literal or a const resolved through `ctx.model.constValues`;
      `k = 0` → M1's plain byte-select; `k = 1..15` → `addrByteOf(sym, "low", k)`; everything else
      falls through unchanged with **no new diagnostic**. `emitHi` gains no fold branch
- [ ] 3.9 **Verify GREEN**
- [ ] 3.10 Implementation tests: `symbolExpr`, `symbolText` across `k = 1..15` and both selects,
      `instrOperandFor`'s two branches, `log2Exact` after its move
- [ ] 3.11 **Seed and watch fail**: perturb ST-13d's expected assembled byte and confirm it fails —
      this is the trap RD-03's `!align 256, 0` sprang, where a plausible operand assembled cleanly
      and meant something else
- [ ] 3.12 Confirm **zero byte movement**: 14 goldens byte-identical, no ratchet moves,
      `SCOREBOARD.md` unchanged; full verify

**Commit point.** Scope `feat(codegen)`.

---

## Phase 4 — AC-6: the blessed idiom migrates

Lands only after M2 is wired. Migrating earlier makes `balloon` grow past its ratchet, fires
`W10171`, and reds the freshness gate. Spec:
[03-02 §2](03-02-diagnostics-examples-ledgers.md#2--ac-6--the-idiom-migration-phase-4).

- [ ] 4.1 Write **ST-13f** plus a `testing/balloon-color.ts` builder mirroring `testing/balloon.ts`;
      new `balloon-color.spec.test.ts`, build-only under `skipIf(!hasAcme())`. This is the demo's
      **first** CI signal of any kind. **Move it out of the coverage manifest's `pendingSuite`
      waiver and name the new suite instead** — the waiver exists only until this task lands
- [ ] 4.2 Write **ST-13j** plus a `testing/boing-ball.ts` builder; new `boing-ball.spec.test.ts`,
      same tier. Its fourth assertion — `$07F8`..`$07FB` are `b, b+1, b+2, b+3` — is the one
      neither balloon carries, and it proves the migrated value is still usable as the base of
      64-byte block arithmetic (AR #96). **Clear its `pendingSuite` waiver too** — after 4.1 and
      4.2 that list must be empty
- [ ] 4.3 Re-derive **ST-C14** (`balloon.spec.test.ts:166-181`) to the two-instruction subsequence
      `LDA #<(__data_Main_BALLOON / 64)` · `STA $07F8`, and rewrite its comment to describe the
      folded form rather than a weakness that no longer exists
- [ ] 4.4 **Verify RED**
- [ ] 4.5 Migrate `examples/balloon/main.blend:11` to `poke($07F8, lo(&BALLOON / 64));` and rewrite
      the teaching comment at `:8-10` — the block is the address divided by 64, not the high byte
      times four
- [ ] 4.6 Migrate `examples/balloon-color/main.blend:21` and its comment at `:19-21` the same way
- [ ] 4.7 Migrate `examples/boing-ball/main.blend:54` to `let base: byte = lo(&BALL / 64);` and its
      comment at `:52-53`. A **`let` initializer**, not a `poke` value — same lowering route, and
      the one site whose result is then used arithmetically (`base+0..3`, `:56-59`)
- [ ] 4.8 **Verify GREEN**
- [ ] 4.9 Re-derive `balloon`'s ratchet from the new build; regenerate the goldens and
      `SCOREBOARD.md` — **same commit** as tasks 4.5–4.7
- [ ] 4.10 Hand-review every regenerated golden hunk against what a 6502 developer would write.
      A divergence is a defect: fix it or file it, never shrug it off
- [ ] 4.11 Confirm **ST-C15 still green** (AC-2 — the sprite is still page-aligned) and no fixture
      grew; full verify

**Commit point.** Scope `perf(examples)`. Source, ratchet, goldens and scoreboard together.

---

## Phase 5 — Ledgers, back-propagation, closeout

Spec: [03-02 §3–§5](03-02-diagnostics-examples-ledgers.md#3--m4--the-ledgers-stay-true-phases-2-4-5).

- [ ] 5.1 Re-author `balloon`'s `hi(&BALLOON) * 4` routing row in `twins.json` **from measurement** —
      the divergence it describes no longer exists
- [ ] 5.2 Re-route the **16** misrouted rows (8 instruction-selection + 8 layout) from `#58` to
      [#70](https://github.com/blendsdk/blend65/issues/70). They are re-routed, **not** fixed
- [ ] 5.3 Add the structural manifest check: no `twins.json` row carries `"issue": 58` except the
      rows belonging to #58's own remaining halves
- [ ] 5.4 Back-propagate the two RD corrections — the locals claim (AR #91) and the "load source"
      framing (AR #88) — into
      [RD-13](../../requirements/RD-13-symbolic-address-arithmetic.md)
- [ ] 5.5 Run the **local VICE 3.10 tier** for AC-10: `balloon` renders, its shared observables and
      its own sprite-pointer / image-block checks pass unchanged
- [ ] 5.6 Walk all **12 acceptance criteria** with evidence into `08-closeout.md`, stating plainly
      that RD-13 moves **1** of 53 routed divergence rows and re-routes 16 — and that `balloon`
      still does not beat its twin on bytes
- [ ] 5.7 Confirm `git status --porcelain spec/` empty across the whole commit range (AC-11), and
      that the corpus total **strictly decreased** — AC-8's review half, which no test enforces
- [ ] 5.8 Sync the feature roadmap and the portfolio roadmap; post the area report on
      [#58](https://github.com/blendsdk/blend65/issues/58), noting that #58 **stays open** for its
      remaining audit halves
- [ ] 5.9 Full verify

**Commit point.** Scope `docs(rd-13)`.

---

## Standing constraints

| Constraint | Applies |
|---|---|
| `git status --porcelain spec/` stays empty | every commit (D3) |
| No plan, requirement, task, AR or issue ID in any code or doc comment | every file touched |
| Newly added lines Prettier-clean; never `--write` a file carrying pre-existing drift | every file touched |
| No new diagnostics — `k >= 16`, non-power-of-two divisors and every word-context form keep today's behaviour exactly | Phases 3, 4 |
| A spec test is never edited to make an implementation pass | Phases 1, 2, 4 |
| Any undetermined decision: **STOP**, log as the next `AR #n (runtime)`, resolve with the user, back-propagate | every phase |
