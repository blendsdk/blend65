# Execution Plan — Placement (RD-03)

> **Implements**: asm-parity/RD-03 · [#49](https://github.com/blendsdk/blend65/issues/49)
> **Progress**: 41/41 tasks (100%) — complete
> **Last Updated**: 2026-07-20 (area report posted on #49; #49 stays open — placement slice only)
> **CodeOps Skills Version**: 3.11.0

**Verify** (every phase, before every commit — AR #75):

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

**Corpus-touching phases (4 and 5) run one more gate**, because the command above cannot see it —
the scoreboard freshness check, which CI hard-fails on (`.github/workflows/ci.yml:60-61`, contrast
the twin-diff step at `:52-53`, which carries `continue-on-error`):

```
yarn gen:scoreboard && git diff --exit-code -- packages/test-harness/test/golden/SCOREBOARD.md
```

The gate regenerates every pair from `examples/` source through the real compiler and ACME
(`scripts/gen-parity-scoreboard.mjs:207`). Any commit that changes a fixture's source without
committing the regenerated ledgers is red on that gate, which is why the corpus tasks live in the
same phase as the rewrite that moves them.

Phase order is the resolution of **AR #73**: the mechanism lands first, and its acceptance is that
**nothing moves**. No fixture takes a const array's address today, so a correct implementation is a
provable no-op — the 14 byte-identical goldens are a free proof that the rule excludes by-reference
arguments, which is the exact defect the RD-stage preflight caught (its PF-001; not to be confused
with this plan's preflight numbering). The corpus regenerates exactly once, in Phase 4 — ratchets,
routing prose and scoreboard included.

Commit one phase at a time via **/gitcm**.

---

## Phase 1 — The directive · tag: standard

Spec → red → implement → green. Pure model addition; nothing emits it yet, so the corpus cannot
move. Ends with all three switch sites handled and the build green.

- [x] 1.1 Write ST-C1–ST-C4 (`print-instr.spec.test.ts`): directive text is `!align 255, 0, 0`,
      byte size is `0`, column-zero is `true`, and a stream renders it at column 0 on its own line.
      Assert through the module's **public** surface — `printInstr` / `instrByteSize`, following the
      existing `textOf(directive({…}))` idiom at `print-instr.spec.test.ts:110-131`. `directiveText`,
      `isColumnZeroDirective` and `directiveByteSize` are module-private and **must not be exported**
      to make the test writable (unsanctioned api-surface change). Verify **red**
- [x] 1.2 Add the `align` variant to `AcmeDirective` (`core/src/instr-model/stream.ts:37-44`) with
      `boundary` and `fill`, JSDoc'd like its siblings
- [x] 1.3 Handle `directiveText` (`print-instr.ts:165-166`) — emit `boundary - 1` as the mask, in
      **one** place, with a comment stating that ACME's `!align` is a bitmask and that
      `!align 256, 0` silently aligns nothing
- [x] 1.4 Handle `directiveByteSize` (`:295-315`) — return `0`; document that `programByteSize` is
      thereby a lower bound
- [x] 1.5 Handle `isColumnZeroDirective` (`:178-180`) — return `true`. **The compiler will not flag
      this one.** Unlike the two above it carries no `const _exhaustive: never`; it is a boolean
      expression (`d.kind === "origin" || d.kind === "outputFile" || d.kind === "symbolDef"`) that
      silently returns `false` for a new variant, rendering `!align` at instruction indent. ST-C3
      is the only thing that catches it
- [x] 1.6 ST-C1–ST-C4 **green**; full verify. **All 14 goldens unchanged** (nothing emits the
      directive yet — if one moves, something else is wrong)

## Phase 2 — The marking rule · tag: **sensitive**

**The highest-risk phase, and the cheapest place to be wrong.** Its acceptance is that the corpus
does not move: `slice7b` and `slice8b` (const data reached by by-reference argument) and `slice8`
(`&onIRQ`) are the named negative controls. A golden that moves a byte here means the rule is
scanning IL operands instead of `&` sites.

- [x] 2.1 Write ST-C5–ST-C10, ST-C19 and ST-C19b in
      `packages/codegen/src/il/lower-address-of.spec.test.ts` (spec tier): `&T` marks; by-ref
      `sum(T, 3)` does **not**; `&onIRQ` marks nothing; `&` on a mutable array marks nothing; a
      const struct marks; with two arrays exactly the `&`-taken one marks; **with two arrays both
      `&`-taken, both mark** (ST-C19 — the set must be a set, not a single slot); and **a
      module-scope `let ptr: word = &T;` marks** (ST-C19b — the second lowering context, see 2.3).
      Verify **red**
- [x] 2.2 Add `pageAligned: boolean` to `ConstDataEntry` (`codegen/src/il/cfg.ts`), JSDoc'd. It is
      **required**, so both construction sites must supply it: `lower.ts:240` (task 2.4) and the
      typed literal at `packages/codegen/src/instr/assemble.impl.test.ts:151-155`, which gets
      `pageAligned: false`. These are the only two tree-wide; typecheck is red until both are done
- [x] 2.3 Create the address-taken set in `lowerToIL` and thread it into **both** `LowerCtx`
      construction sites — `lower.ts:294` (`lowerInitCode`, `fqName: "__init"`) and `:363`
      (`lowerFunction`). **They must share one instance.** `LowerCtx` is per lowering *unit*, not
      per program: adding a field forces both literals to supply one, but nothing forces them to
      supply the *same* one, and a fresh `new Set()` in the init context compiles and passes every
      test that puts `&` inside a function body. The init path is live —
      `let ptr: word = &TABLE;` at module scope reaches `lowerAddressOf` via `lower.ts:336`.
      ST-C19b is the spec-test row for exactly that. Fill the set **inside** `lowerAddressOf`
      (`lower.ts:1807`) gated on `sym.kind === "constant"`, and comment why it must be there: all
      **eight** call sites (`:336, :485, :1042, :1466, :1607, :2473, :2494, :2528`) are
      `isAddressOfExpr`-gated, so the by-ref argument path at `:1022-1029` — which emits the
      *identical* `addrOf` operand — can never reach it
- [x] 2.4 Populate `pageAligned` in the `constData` loop (`lower.ts:237-249`), noting that the set is
      already complete: every function lowers at `:213-220` and init code at `:229-231`, both
      **before** the loop at `:237-249`
- [x] 2.5 ST-C5–ST-C10, ST-C19 and ST-C19b **green**
- [x] 2.6 **The free proof**: full verify with all 14 goldens **byte-identical**. Confirm
      explicitly that `slice7b`/`slice8b` (by-ref) and `slice8` (`&onIRQ`) did not move — record
      the confirmation in the commit body, since this is the phase's real assertion. Do **not**
      claim `slice7` as a by-ref control: it reads `__data_Gfx_TABLE,X` directly indexed
      (`slice7.asm.golden:138`) and materializes no address at all
- [x] 2.7 Impl tests in `packages/codegen/src/il/lower-address-of.impl.test.ts` for the set's
      lifetime: two modules in one program, and a const array whose address is taken twice, both
      yield one marked entry

## Phase 3 — Emission and the mixed-alignment fixture · tag: complex

The directive starts being emitted. Still a corpus no-op — no existing fixture takes an address.

- [x] 3.1 Create the mixed-alignment fixture as **committed source**:
      `examples/align-mixed/main.blend` — two const arrays, the **address-taken one declared
      first** (ST-C12 computes "pays no padding" as
      `unaligned.addr === aligned.addr + aligned.data.length`; the symbol map exposes labels only,
      so declaration order is load-bearing). Head the file with a comment stating it is a placement
      probe deliberately **outside** the parity corpus — no golden, no twin, no `budgets.json` row
      (AR #70) — so future corpus tooling does not sweep it in. Verified drag-free:
      `examples-sync.spec.test.ts:38-63` iterates a closed `INLINED_MODULES` list,
      `twins.spec.test.ts:93-99` keys the pair set to `*.asm.golden` files plus balloon, and
      `budgets.spec.test.ts:226-230` closes over a fixed builder list
- [x] 3.2 Write ST-C11–ST-C13 in a new `packages/test-harness/src/align-mixed.spec.test.ts` under
      `describe.skipIf(!hasAcme())` — built through the real `build()` facade + real ACME following
      `testing/balloon.ts:44-58`, committing no generated output. It must live in
      `@blend65/test-harness`: `build()` comes from `@blend65/compiler`, so a `@blend65/codegen`
      home would invert the package edges. Verify **red**
- [x] 3.3 Prepend the directive in `constDataStream` (`instr-program.ts:191-198`) when
      `entry.pageAligned`, ahead of the label
- [x] 3.4 Confirm `serialize-acme.ts` needs **no** change (AR #71) — if it does, the directive is
      in the wrong place
- [x] 3.5 ST-C11 **green**: exactly one directive, immediately before the address-taken array's
      label and no other, and its rendered text is `!align 255, 0, 0` end to end
- [x] 3.6 ST-C12 **green**: resolved address `% 256 === 0`, and the unaligned array pays no
      padding. **This is the operand-trap oracle** — with `!align 256, 0` the build succeeds and
      ST-C11's placement clause still passes, so ST-C12 is what fails
- [x] 3.7 ST-C13 **green**: `hi(addr) * 4 === addr / 64` on the real resolved address
- [x] 3.8 Document in `03-01` §4 that padding is per-stream and cumulative, and that no reordering
      pass exists — verify the doc matches what was built
- [x] 3.9 Full verify; **14 goldens still byte-identical**

## Phase 4 — The balloon rewrite and corpus supersession · tag: complex

**The one phase where the corpus regenerates.** Everything that moves, moves here — the source, the
ratchets, the routing prose and the scoreboard, in one commit, so the tree is CI-clean at every
point (M4's "in the same change"; AR #73's "regenerates exactly once, at the balloon rewrite").

- [x] 4.1 Write ST-C14/ST-C15 (**CI tier**) in a second `describe.skipIf(!hasAcme())` block in
      `packages/test-harness/src/balloon.spec.test.ts`, alongside — **not inside** — the existing
      VICE block at `:29`. This is the in-tree dual-block convention
      (`slice3a.spec.test.ts:28/47`, `slice3b.spec.test.ts:26/48`, `slice7b.spec.test.ts:28/43`,
      `slice8b.spec.test.ts`); a hasAcme-only balloon build already runs in CI
      (`budgets.spec.test.ts:233`). Inside the VICE guard these tests **skip** in CI rather than
      fail, and AC-1/AC-4's `[CI]` labels become false with everything green. Assertions: no store
      to `$0340–$037E`; the sprite sequence appears in the binary exactly once; the pointer store
      appears as an ordered subsequence (`LDA #>__data_Main_BALLOON` … `ASL` … `ASL` …
      `STA $7F8`) — a **subsequence, not an exact match**, with a comment that #58/#60 will
      deliberately revise this shape; and `__data_Main_BALLOON % 256 === 0` and `< $1000`.
      Verify **red**
- [x] 4.2 Delete the 63 staging pokes from `examples/balloon/main.blend:11-73`; set the pointer via
      `poke($07F8, hi(&BALLOON) * 4)`. Replace the stale comment — it currently explains the copy
      as forced by compile-time-constant addresses, which is the thing being removed
- [x] 4.3 ST-C14/ST-C15 **green**. Record the measured byte count and symbol address; **expected
      318 bytes at `$0900`**, but re-derive rather than assume
- [x] 4.4 Split `BALLOON_OBSERVABLES` (`testing/balloon.ts:67-82`): the shared table keeps the
      **eight** source-mandated rows; the `$07F8` and `$0340` rows are removed. Comment the split,
      citing `observables.ts:5-12` — the address is now allocator-chosen and stops qualifying by
      the contract's own rule
- [x] 4.5 Add ST-C18 to the **VICE block** of `balloon.spec.test.ts`: symbol-resolved pointer and
      image-block checks (`peek($07F8) === addr / 64`; 63 bytes at `addr` match the committed asset)
- [x] 4.6 **Local tier**: ST-C17 green — the eight shared observables pass unchanged on VICE 3.10
- [x] 4.7 **Local tier**: ST-C18 green — the sprite renders from the new address
- [x] 4.8 **Local tier**: the twin tier passes against the **unmodified** twin with the shrunk
      shared table (AR #69 — the twin does not change)
- [x] 4.9 Re-derive balloon's `bytes` ratchet **from the aligned build** — never from an unaligned
      measurement (AR #65 addendum). Procedure per AR #56: the budget tier only fails on
      `actual > budget` and cannot produce a value, so build the fixture and read the reported
      `binarySize`, then write it into `budgets.json` by hand
- [x] 4.10 Re-derive all other fixtures' `bytes` ratchets the same way — **all must be unchanged**;
      any movement is a stop, not a budget bump
- [x] 4.11 Re-author **all four** of balloon's `twins.json` routing rows (`:405, :410, :415-416,
      :423`), not only the `#49` pair. The `#51` row ("the remaining size gap is the unrolled
      sprite copy below, not layout") and the `#52` row ("LDA 96 vs 27, STA 87 vs 21") are equally
      falsified once 63 LDA/STA pairs vanish, and the freshness gate is blind to prose — left
      alone, all three ship false. Drop `sourceForced`, retire the "63 unrolled pokes forced by the
      `copy()` language gap" attribution, and state the honest decomposition: the twin's copy is
      the *file-size* idiom (it stages below the PRG load base), the compiler's placement is the
      *runtime* idiom, and the residual splits into the padding accident (0–255, today 6),
      `hi(&X)*4` materialization → #58/#60, and load/store → #52. Add **ST-C20** — the mechanizable
      half of AC-8: balloon's routing entries carry no `sourceForced` and no note matching
      `/copy\(\) language gap/`
- [x] 4.12 Regenerate `SCOREBOARD.md` with **`yarn gen:scoreboard`** (`package.json:21`) — the file
      forbids hand-editing and the generator aborts before writing on stale routing. Then confirm
      the gate: `git diff --exit-code -- packages/test-harness/test/golden/SCOREBOARD.md` is clean
      after a second regeneration
- [x] 4.13 Full verify **plus the freshness gate**

## Phase 5 — Local re-measure, review gates and closeout · tag: complex

- [x] 5.1 Re-derive balloon's `frameUpdate` `staticMaxCycles`; **re-measure** `measuredMaxCycles`
      on VICE (local tier — CI cannot). Confirm `Main_main_L5`/`L3` still resolve (verified at
      planning time that they do). **If `measuredMaxCycles` moves, `SCOREBOARD.md` regenerates a
      second time** — it renders measured columns from committed `budgets.json`
      (`gen-parity-scoreboard.mjs:224-233`, rendered at `SCOREBOARD.md:9`) — so re-run
      `yarn gen:scoreboard` and the gate before committing this phase
- [x] 5.2 Verify no fixture grew and the corpus total strictly decreased — **a review gate, not a
      test** (the budget tier only fails on `actual > budget`). Read the `budgets.json` and
      `SCOREBOARD.md` diffs **from the Phase 4 commit** and state the result explicitly
- [x] 5.3 Confirm ST-B39/B40/B43/B44 green over the regenerated corpus — a **no-regression** gate;
      it cannot observe alignment (AR #70) and must not be cited as evidence for this RD
- [x] 5.4 Confirm `git status --porcelain spec/` empty and the boundary tier green (AC-10). For
      AC-9, also walk the RD's whole commit range for `spec/` paths — the working-tree check passes
      a *committed* spec edit clean, and CI has no `spec/` freeze step, so this is a **closeout
      review**, not a gate (see [01-requirements.md](01-requirements.md))
- [x] 5.5 Write `08-closeout.md`: the AC-1…AC-10 walk against committed artifacts, the delta
      record, a `git diff` over `test/golden/*.asm.golden` across the RD's commit range confirming
      all 14 are byte-identical (ST-C16), and the two carried divergences (the 8-instruction
      sequence and its spurious `W10172`) attributed to #58/#60
- [x] 5.6 Post the area report on [#49](https://github.com/blendsdk/blend65/issues/49) —
      **outward-facing; requires an explicit go-ahead** and is not covered by an auto-commit run.
      #49 stays **open**: this RD is its placement slice only.
      Posted 2026-07-20 —
      [comment-5024737189](https://github.com/blendsdk/blend65/issues/49#issuecomment-5024737189)

---

## Phase dependency

```
1 (directive) ──▶ 2 (marking) ──▶ 3 (emission + fixture) ──▶ 4 (balloon + corpus) ──▶ 5 (closeout)
   nothing          corpus            corpus                   corpus moves ONCE,       review
   emits it         must not move     must not move            ratchets follow          gates
```

Phases 1–3 are corpus-invariant by construction. If a golden moves in any of them, stop — the
marking rule is wrong, and that is exactly what those phases exist to reveal.

## Risk register

| Risk | Surfaces as | Mitigation |
|---|---|---|
| Marking scans IL operands, not `&` sites | `slice7b`/`slice8b`/`slice8` goldens move in Phase 2 | Task 2.6 makes it the phase's stated acceptance |
| The marking set is not shared between the two `LowerCtx` sites | **Nothing surfaces** — the whole suite passes while a module-scope `&` never aligns | Task 2.3 threads one instance from `lowerToIL`; ST-C5–C10 gain a module-scope row |
| `!align 256, 0` written instead of `255` | Builds and looks right; nothing aligns | ST-C12 asserts the **resolved** address; mask emitted in one place (1.3) |
| Padding assumed stable at 6 bytes | A later code change silently shifts balloon's size | 4.9 re-derives from the aligned build; the 0–255 re-roll is documented in the RD |
| Twin tier breaks when the shared table shrinks | **Local-only failure — CI never runs the twin tier**, so a break here is invisible to CI and must be caught by hand | Task 4.8 runs it explicitly, in the same phase as the split |
| Routing prose left stale | Freshness gate green, `SCOREBOARD.md` false | Task 4.11 (all four rows); the gate is known blind to prose |
| Corpus source and ledgers land in different commits | The intermediate tree fails CI's freshness gate | All of it is Phase 4; task 4.13 runs the gate as part of Verify |
