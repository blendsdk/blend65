# Execution Plan — Placement (RD-03)

> **Implements**: asm-parity/RD-03 · [#49](https://github.com/blendsdk/blend65/issues/49)
> **Progress**: 0/40 tasks (0%)
> **Last Updated**: 2026-07-20
> **CodeOps Skills Version**: 3.11.0

**Verify** (every phase, before every commit — AR #75):

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Phase order is the resolution of **AR #73**: the mechanism lands first, and its acceptance is that
**nothing moves**. No fixture takes a const array's address today, so a correct implementation is a
provable no-op — the 14 byte-identical goldens are a free proof that the rule excludes by-reference
arguments, which is the exact defect the preflight caught (PF-001). The corpus regenerates exactly
once, in Phase 4.

Commit one phase at a time via **/gitcm**.

---

## Phase 1 — The directive · tag: standard

Spec → red → implement → green. Pure model addition; nothing emits it yet, so the corpus cannot
move. Ends with the three exhaustive switches handled and the build green.

- [ ] 1.1 Write ST-C1–ST-C4 (`print-instr.spec.test.ts`): directive text is `!align 255, 0, 0`,
      byte size is `0`, column-zero is `true`, and a stream renders it ahead of its label. Verify
      **red**
- [ ] 1.2 Add the `align` variant to `AcmeDirective` (`core/src/instr-model/stream.ts:37-44`) with
      `boundary` and `fill`, JSDoc'd like its siblings
- [ ] 1.3 Handle `directiveText` (`print-instr.ts:165-166`) — emit `boundary - 1` as the mask, in
      **one** place, with a comment stating that ACME's `!align` is a bitmask and that
      `!align 256, 0` silently aligns nothing
- [ ] 1.4 Handle `directiveByteSize` (`:295-315`) — return `0`; document that `programByteSize` is
      thereby a lower bound
- [ ] 1.5 Handle `isColumnZeroDirective` (`:178-180`) — return `true`
- [ ] 1.6 ST-C1–ST-C4 **green**; full verify. **All 14 goldens unchanged** (nothing emits the
      directive yet — if one moves, something else is wrong)

## Phase 2 — The marking rule · tag: **sensitive**

**The highest-risk phase, and the cheapest place to be wrong.** Its acceptance is that the corpus
does not move: `slice7`, `slice7b`, `slice8b` (const data reached by by-reference argument) and
`slice8` (`&onIRQ`) are the named negative controls. A golden that moves a byte here means the rule
is scanning IL operands instead of `&` sites.

- [ ] 2.1 Write ST-C5–ST-C10 (`codegen`, spec tier): `&T` marks; by-ref `sum(T, 3)` does **not**;
      `&onIRQ` marks nothing; `&` on a mutable array marks nothing; a const struct marks; with two
      arrays exactly the `&`-taken one marks. Verify **red**
- [ ] 2.2 Add `aligned: boolean` to `ConstDataEntry` (`codegen/src/il/cfg.ts`), JSDoc'd
- [ ] 2.3 Accumulate the address-taken set in the lowering context; fill it **inside**
      `lowerAddressOf` (`lower.ts:1807`) gated on `sym.kind === "constant"`. Comment why it must be
      here: `lower.ts:1042` guards this call with `isAddressOfExpr`, so the by-ref argument path at
      `:1022-1029` — which emits the *identical* `addrOf` operand — can never reach it
- [ ] 2.4 Populate `aligned` in the `constData` loop (`lower.ts:237-249`), noting that the set is
      already complete because every function lowered first (`:213-220`)
- [ ] 2.5 ST-C5–ST-C10 **green**
- [ ] 2.6 **The free proof**: full verify with all 14 goldens **byte-identical**. Confirm
      explicitly that `slice7b`/`slice8b` (by-ref) and `slice8` (`&onIRQ`) did not move — record
      the confirmation in the commit body, since this is the phase's real assertion
- [ ] 2.7 Impl tests for the set's lifetime: two modules in one program, and a const array whose
      address is taken twice, both yield one marked entry

## Phase 3 — Emission and the mixed-alignment fixture · tag: complex

The directive starts being emitted. Still a corpus no-op — no fixture takes an address yet.

- [ ] 3.1 Write ST-C11–ST-C13 against a new two-array fixture built in-test through the real
      `build()` facade + real ACME, following `testing/balloon.ts:44-58` and committing no
      generated output. Verify **red**
- [ ] 3.2 Prepend the directive in `constDataStream` (`instr-program.ts:191-198`) when
      `entry.aligned`, ahead of the label
- [ ] 3.3 Confirm `serialize-acme.ts` needs **no** change (AR #71) — if it does, the directive is
      in the wrong place
- [ ] 3.4 ST-C11 **green**: exactly one directive, immediately before the address-taken array's
      label and no other
- [ ] 3.5 ST-C12 **green**: resolved address `% 256 === 0`, and the unaligned array pays no
      padding. **This is the operand-trap oracle** — with `!align 256, 0` the build succeeds and
      ST-C11 still passes, so ST-C12 is what fails
- [ ] 3.6 ST-C13 **green**: `hi(addr) * 4 === addr / 64` on the real resolved address
- [ ] 3.7 Document in `03-01` §4 that padding is per-stream and cumulative, and that no reordering
      pass exists — verify the doc matches what was built
- [ ] 3.8 Full verify; **14 goldens still byte-identical**

## Phase 4 — The balloon rewrite and the observable split · tag: complex

**The one phase where the corpus regenerates.** Everything that moves, moves here.

- [ ] 4.1 Write ST-C14/ST-C15 (CI tier): no store to `$0340–$037E`; the sprite sequence appears in
      the binary exactly once; `__data_Main_BALLOON % 256 === 0` and `< $1000`. Verify **red**
- [ ] 4.2 Delete the 63 staging pokes from `examples/balloon/main.blend:11-73`; set the pointer via
      `poke($07F8, hi(&BALLOON) * 4)`. Replace the stale comment — it currently explains the copy
      as forced by compile-time-constant addresses, which is the thing being removed
- [ ] 4.3 ST-C14/ST-C15 **green**. Record the measured byte count and symbol address; **expected
      318 bytes at `$0900`**, but re-derive rather than assume
- [ ] 4.4 Split `BALLOON_OBSERVABLES` (`testing/balloon.ts:67-82`): the shared table keeps the
      **eight** source-mandated rows; the `$07F8` and `$0340` rows are removed. Comment the split,
      citing `observables.ts:5-12` — the address is now allocator-chosen and stops qualifying by
      the contract's own rule
- [ ] 4.5 Add ST-C18 to `balloon.spec.test.ts`: symbol-resolved pointer and image-block checks
      (`peek($07F8) === addr / 64`; 63 bytes at `addr` match the committed asset)
- [ ] 4.6 **Local tier**: ST-C17 green — the eight shared observables pass unchanged on VICE 3.10
- [ ] 4.7 **Local tier**: ST-C18 green — the sprite renders from the new address
- [ ] 4.8 **Local tier**: the twin tier passes against the **unmodified** twin with the shrunk
      shared table (AR #69 — the twin does not change)
- [ ] 4.9 Full verify

## Phase 5 — Corpus supersession and closeout · tag: complex

- [ ] 5.1 Re-derive balloon's `bytes` ratchet **from the aligned build** — never from an unaligned
      measurement (AR #65 addendum)
- [ ] 5.2 Re-derive balloon's `frameUpdate` `staticMaxCycles`; **re-measure**
      `measuredMaxCycles` on VICE (local tier — CI cannot). Confirm `Main_main_L5`/`L3` still
      resolve (verified at planning time that they do)
- [ ] 5.3 Re-derive all other fixtures' `bytes` ratchets per AR #56 discipline — **all must be
      unchanged**; any movement is a stop, not a budget bump
- [ ] 5.4 Re-author balloon's `twins.json` routing prose: drop `sourceForced`, retire the "63
      unrolled pokes forced by the `copy()` language gap" attribution, and state the honest
      decomposition — the twin's copy is the *file-size* idiom (it stages below the PRG load base),
      the compiler's placement is the *runtime* idiom, and the residual splits into the padding
      accident (0–255, today 6), `hi(&X)*4` materialization → #58/#60, and load/store → #52
- [ ] 5.5 Regenerate `SCOREBOARD.md`; freshness gate green
- [ ] 5.6 Verify no fixture grew and the corpus total strictly decreased — **a review gate, not a
      test** (the budget tier only fails on `actual > budget`). Read the `budgets.json` and
      `SCOREBOARD.md` diffs and state the result explicitly
- [ ] 5.7 Confirm ST-B39/B40/B43/B44 green over the regenerated corpus — a **no-regression** gate;
      it cannot observe alignment (AR #70) and must not be cited as evidence for this RD
- [ ] 5.8 Confirm `git status --porcelain spec/` empty (AC-9) and the boundary tier green (AC-10)
- [ ] 5.9 Write `08-closeout.md`: the AC-1…AC-10 walk against committed artifacts, the delta
      record, and the two carried divergences (the 8-instruction sequence and its spurious
      `W10172`) attributed to #58/#60
- [ ] 5.10 Post the area report on [#49](https://github.com/blendsdk/blend65/issues/49) —
      **outward-facing; requires an explicit go-ahead** and is not covered by an auto-commit run.
      #49 stays **open**: this RD is its placement slice only

---

## Phase dependency

```
1 (directive) ──▶ 2 (marking) ──▶ 3 (emission + fixture) ──▶ 4 (balloon) ──▶ 5 (corpus)
   nothing          corpus            corpus                   corpus          ratchets
   emits it         must not move     must not move            moves ONCE      follow
```

Phases 1–3 are corpus-invariant by construction. If a golden moves in any of them, stop — the
marking rule is wrong, and that is exactly what those phases exist to reveal.

## Risk register

| Risk | Surfaces as | Mitigation |
|---|---|---|
| Marking scans IL operands, not `&` sites | `slice7b`/`slice8b`/`slice8` goldens move in Phase 2 | Task 2.6 makes it the phase's stated acceptance |
| `!align 256, 0` written instead of `255` | Builds and looks right; nothing aligns | ST-C12 asserts the **resolved** address; mask emitted in one place (1.3) |
| Padding assumed stable at 6 bytes | A later code change silently shifts balloon's size | 5.1 re-derives from the aligned build; the 0–255 re-roll is documented in the RD |
| Twin tier breaks when the shared table shrinks | Local-only failure — CI stays green | Task 4.8 runs it explicitly before Phase 5 |
| Routing prose left stale | Freshness gate green, `SCOREBOARD.md` false | Task 5.4; the gate is known blind to prose |
