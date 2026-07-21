# Execution Plan: Alignment Granularity

> **Implements**: asm-parity/RD-15 · [00-index.md](00-index.md)
> **Progress**: 0/24 tasks (0%)
> **Last Updated**: 2026-07-21 15:24
> **CodeOps Skills Version**: 3.11.0

**Verify** (AR #120), run at every marked point:

```
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

Ordering within every phase is **spec tests → RED → implement → GREEN → impl tests → full verify**.
One commit per phase.

| Phase | Delivers | Byte movement | Tasks |
|---|---|---|---|
| 1 | M3 — the mark becomes a value; sixteen sites reshaped | **none, and proven** | 9 |
| 2 | M1/M2/M4 — the 64 demand, coarsest-wins, three oracles re-derived | `balloon-color` −128 B | 8 |
| 3 | M5 — ledgers, back-propagation, closeout | none | 7 |

**No committed golden changes in any phase**, and no ratchet, budget or scoreboard movement in any
phase. The only program whose bytes move is `balloon-color`, which is tier `demo` — no golden, no
twin, no ratchet, no `budgets.json` row. Every "goldens byte-identical" step below is therefore a
zero-diff guard, and the Prime-Directive review (AC-14) is pointed at the emitted directive against
the idiom rather than at a golden diff.

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> The task checkboxes below are the **single source of truth** for progress. Every task line
> appears exactly once. The executing agent MUST:
>
> 1. **On implementation:** mark `[~]` with a timestamp — `- [~] 1.1 … ⏳ (implemented: YYYY-MM-DD HH:MM)`
> 2. **On verify pass:** promote to `[x]` — `- [x] 1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`
> 3. **Update the Progress header and Last Updated stamp after EVERY task** — never batch.
>    Only `[x]` counts as complete.
> 4. **Resume** by scanning top-to-bottom: the first `[~]` task first, else the first `[ ]`.
>
> Timestamps come from `date '+%Y-%m-%d %H:%M'` — never invented.

---

## Phase 1 — M3: the mark becomes a value

> **Phase ref**: _(recorded at phase start)_
> **Lenses**: api-surface

Behaviour-neutral by design: every demand is still 256, so this phase's own proof is that nothing
moved (AR #118). Spec: [03-01 §1, §3, §4](03-01-demand-and-emission.md) ·
[03-02 §1](03-02-oracles-and-ledgers.md#1--the-sixteen-reshaped-sites-phase-1).

- [ ] 1.1 Reshape the **12** `pageAligned` assertions in
      `packages/codegen/src/il/lower-address-of.spec.test.ts` (`:210, :232, :254, :255, :277, :279,
      :295, :312, :313, :333, :334, :354`). `true` → `boundary` is **256**; `false` → the entry
      carries **no boundary at all**, never `boundary === 256` — that distinction is the
      by-reference membership rule and flattening it leaves AC-7 pinned by nothing. Each comment
      restates its requirement in the new terms; none is weakened
- [ ] 1.2 Reshape the **4** remaining sites: the three filter predicates in
      `lower-address-of.impl.test.ts` (`:137, :156, :171`) become `e.boundary !== undefined`, and
      the `ConstDataEntry` literal in `assemble.impl.test.ts:155` **omits** the field — its own
      comment already says the case is about preamble derivation, not placement
- [ ] 1.3 **Verify RED** — `yarn turbo run typecheck` fails on all sixteen sites, in two distinct
      ways: fifteen read a `boundary` field that does not exist yet, and `assemble.impl.test.ts:155`
      omits a `pageAligned` field that is still required. Both are expected; the errors are confined
      to three test files
- [ ] 1.4 Add the `AlignBoundary` union and replace `pageAligned: boolean` with
      `boundary?: AlignBoundary` — `packages/codegen/src/il/cfg.ts:119`, exported alongside
      `ConstDataEntry`. The doc comment carries **why** the union is closed: `!align` takes a
      bitmask, so a non-power-of-two boundary assembles cleanly and aligns nothing
- [ ] 1.5 `packages/codegen/src/il/lower.ts` — rename `addressTakenConsts` to
      `alignmentDemands: Map<string, AlignBoundary>` (`:199`, created `:227`, threaded `:245, :258,
      :307, :343, :387, :411`); add the module-level `PAGE_BOUNDARY` constant (**this phase** — the
      default below refers to it, so Phase 1 does not compile without it; the other three fold
      constants arrive in 2.4); give `lowerAddressOf` (`:1845`) the defaulted
      `demand: AlignBoundary = PAGE_BOUNDARY` parameter and make `:1864` a coarsest-wins insert —
      **a comparison, not `Math.max`**, which widens the union back to `number`. Build the entry at
      `:282` with a conditional spread: `exactOptionalPropertyTypes` is on, so `boundary:
      map.get(sym)` does not typecheck. **No call site passes a demand in this phase**
- [ ] 1.6 `packages/codegen/src/instr/instr-program.ts` — delete `const PAGE = 256` (`:191`; it
      stops existing rather than moving) and key `constDataStream` (`:200-208`) on
      `entry.boundary !== undefined`. `print-instr.ts` is **not** touched
- [ ] 1.7 **Verify GREEN** — the sixteen reshaped sites pass
- [ ] 1.8 Implementation tests in `instr-program.impl.test.ts`: an entry carrying a boundary opens
      with the align directive immediately ahead of its label; an entry without one opens with the
      label
- [ ] 1.9 **Prove P-1 — zero movement.** 14 committed goldens byte-identical, `budgets.json`
      unchanged, no ratchet moves, `SCOREBOARD.md` unchanged, and ST-C15 / ST-13f / ST-13j still
      assert `% 256`, still **untouched**, still green. Full verify

**Deliverables**: the boundary is a value; nothing observable changed; the reshape is reviewable on
its own.

**Verify**: the command above.
**Commit point.** Scope `refactor(codegen)`.

---

## Phase 2 — M1/M2/M4: the 64-byte demand

> **Phase ref**: _(recorded at phase start)_
> **Lenses**: api-surface

Spec: [03-01 §2](03-01-demand-and-emission.md#2--the-demand-and-where-it-is-minted) ·
[03-02 §2](03-02-oracles-and-ledgers.md#2--the-six-pinned-assertions-phase-2) ·
[07 ST-15a…ST-15g](07-testing-strategy.md).

- [ ] 2.1 `[spec-author]` Write **ST-15a … ST-15g** in a new
      `packages/test-harness/src/align-granularity.spec.test.ts` under `skipIf(!hasAcme())`,
      building inline sources through the `build()` facade in a temp dir — the
      `symbolic-address.spec.test.ts:25-36` pattern. **Do not add anything to `examples/`** (it
      would owe the coverage manifest a tier and a suite). The header states the ACME bitmask trap
- [ ] 2.2 Re-derive **ST-C15** (`balloon.spec.test.ts:191`), **ST-13f**
      (`balloon-color.spec.test.ts:51`) and **ST-13j** (`boing-ball.spec.test.ts:68`): `% 256` → `%
      64` **plus** the directive text `!align 63, 0, 0` on the line immediately preceding the image
      label. Keep every `< 0x1000` and assembled-pointer clause. Restate in each comment why the
      directive clause is load-bearing — `% 256 === 0` implies `% 64 === 0`, so the address clause
      alone cannot fail if the demand regresses
- [ ] 2.3 **Verify RED**, against [07's red-phase table](07-testing-strategy.md#red-phase-expectations)
      specifically, and at **clause** granularity: ST-15a, ST-15c, ST-15d(b) and ST-15f fail now,
      and the three re-derived oracles fail now on their **directive-text clause only** — their
      `% 64` clause is already green, because all three images are page-aligned today and a multiple
      of 256 is a multiple of 64. The pre-green guards (ST-15b's `% 64` half, ST-15d(a)/(c), ST-15e,
      ST-15g, **and the `% 64` clause of each re-derived oracle**) pass now — **perturb each once
      and watch it fail**, then restore. A guard that cannot fail is worse than no guard, and this
      feature manufactures them: 64 and 256 coincide on most real addresses
- [ ] 2.4 Implement — add `BLOCK_BOUNDARY`, `BLOCK_SHIFT` and `boundaryOfShift` beside the fold in
      `lower.ts` (`PAGE_BOUNDARY` already exists from 1.5), and pass the demand at the **single**
      call site `:2570`: `lowerAddressOf(binary.left, ctx, true, boundaryOfShift(shift))`. An
      **allowlist**, not arithmetic on the shift — `/ 16384` is a VIC-bank read, and honoring it
      would insert up to 16 KB of padding. The other **eight** `lowerAddressOf` call sites are
      untouched: that is M2's structural guarantee, not a convention
- [ ] 2.5 **Verify GREEN**
- [ ] 2.6 Implementation tests in `lower-address-of.impl.test.ts`: the allowlist exhaustively
      through lowering (`lo(&X / 2^k)` for `k = 0..15` → 256 everywhere but `k = 6` → 64), the
      coarsest-wins insert in both source orders, and a symbol demanded 64 from two different
      functions staying 64
- [ ] 2.7 **Measure and record** for closeout: pad per 64-demand image (`balloon` 19,
      `balloon-color` 60, `boing-ball` 1) and `align-mixed`'s 194 as the out-of-scope bare-`&`
      control; `balloon-color` 584 → 456 B `.prg` (582 → 454 in the budget convention);
      `budgets.json` unchanged and `balloon` still 318 B; 14 goldens byte-identical. **A closeout
      that reports a corpus byte improvement is wrong** — the corpus total does not move
- [ ] 2.8 Full verify

**Deliverables**: a sprite image is aligned to what the VIC actually reads; `hi(&X) * 4` is still
correct, structurally; the three oracles can now fail in both directions.

**Verify**: the command above.
**Commit point.** Scope `feat(codegen)`.

---

## Phase 3 — M5: ledgers, back-propagation, closeout

> **Phase ref**: _(recorded at phase start)_

Spec: [03-02 §3–§4](03-02-oracles-and-ledgers.md#3--ledger-corrections-phase-3).

- [ ] 3.1 Correct `RD-13-symbolic-address-arithmetic.md:157-159`, which predicts this RD makes
      `hi(&X) * 4` *"incorrect"* — false under the maximum rule, and contradicted at `:439` on the
      same page. Leave RD-13's peephole **conclusion** visibly unchanged: it stands on AR #79's
      wraparound argument, not on the prediction (AC-12)
- [ ] 3.2 **Verify, do not re-apply**, the two ledger edits already made during RD authoring (they
      land with this plan's own commit, so expect them present and not pending):
      `RD-03-placement.md:137-153` annotates M2's boundary value as superseded while stating the
      membership rule survives intact (AR #111), and `README.md:84` carries RD-15 in **Wave B2**
      beside the placement slice (AR #112). Confirm both read true against the shipped
      implementation; re-applying either would duplicate it
- [ ] 3.3 Back-propagate **three** corrections into
      [RD-15](../../requirements/RD-15-alignment-granularity.md): the Technical-Requirements
      sentence *"passing the normalized shift into that call is the whole mechanism"* → the derived
      boundary, allowlist in `foldedAddressByte` (AR #113); the *Combining demands* sentence
      *"Insertion is `map.set(sym, Math.max(existing ?? 0, demand))`"* (`RD-15:271`) → the
      comparison form, since `Math.max` returns `number` and `0` is not an `AlignBoundary`, so the
      RD as written prescribes code that cannot typecheck (AR #113, same consequence); and AC-5 +
      the Spec-Test Inventory drop the `lo(&X / 65536)` clause — the lexer rejects the literal with
      `E10216` before lowering runs, so there is no boundary to keep (AR #121)
- [ ] 3.4 Run the **local VICE 3.10 tier** for AC-13: `balloon` and `boing-ball` render and their
      observables pass unchanged. Take the one-off manual look at `balloon-color` — the one image
      that actually moves — and **record** it; it is not gated, because nothing in CI can re-run it
- [ ] 3.5 Walk all **fifteen** acceptance criteria plus P-1, P-2 and P-3 with evidence into
      `08-closeout.md`, stating plainly that this RD recovers 128 B in a program with no budget,
      that the corpus total does not move, and that the deliverable is the bound (AC-10, AC-11,
      AC-14)
- [ ] 3.6 Sync the feature roadmap and the portfolio roadmap; post the area report on
      [#69](https://github.com/blendsdk/blend65/issues/69)
- [ ] 3.7 Confirm `git status --porcelain spec/` empty across the whole commit range, and that
      `align-mixed.spec.test.ts` and `examples/align-mixed/main.blend` appear in **no** diff of any
      phase (AC-8). Full verify

**Deliverables**: no ledger in the tree still predicts the thing this RD disproved; every criterion
is discharged with evidence.

**Verify**: the command above.
**Commit point.** Scope `docs(rd-15)`.

---

## Dependencies

```
Phase 1  (shape — nothing moves)
    ↓
Phase 2  (behaviour — balloon-color moves)
    ↓
Phase 3  (ledgers, closeout)
```

Phase 2 cannot precede Phase 1: there is no field to write a demand into. Phase 3's closeout
measurements are Phase 2's output.

## Standing constraints

| Constraint | Applies |
|---|---|
| `git status --porcelain spec/` stays empty | every commit (D3) |
| No plan, requirement, task, AR or issue ID in any code or doc comment | every file touched |
| Newly added lines Prettier-clean; never `--write` a file carrying pre-existing drift | every file touched |
| A spec test is never edited to make an implementation pass. The reshapes (1.1) and re-derivations (2.2) are **specification changes RD-15 mandates**, restating the same requirements against a boundary rule the RD supersedes — not accommodations to code | Phases 1, 2 |
| `align-mixed.spec.test.ts` and `examples/align-mixed/main.blend` are untouchable | every phase (AC-8) |
| No committed golden changes, no ratchet, budget or `SCOREBOARD.md` movement | every phase |
| No new diagnostics — a non-allowlisted divisor, a fold-rejected `k`, and every non-const `&` keep today's behaviour exactly | Phase 2 |
| Any undetermined decision: **STOP**, log as the next `AR #n (runtime)`, resolve with the user, back-propagate | every phase |

## Success criteria

1. ✅ All three phases complete
2. ✅ Verify green at every marked point; the local VICE tier green in Phase 3
3. ✅ RD-15's fifteen acceptance criteria discharged with evidence in `08-closeout.md`
4. ✅ P-1, P-2 and P-3 discharged
5. ✅ No dead code — `PAGE` is deleted, not orphaned
6. ✅ Ledgers carry no contradicted prediction and no un-annotated superseded requirement
7. ✅ Roadmaps synced; the area report posted on #69
