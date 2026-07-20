# 03-02 — The balloon rewrite, the observable split, and corpus supersession

Owns everything downstream of the compiler change ([03-01](03-01-directive-and-marking.md)).

## 1. The rewrite

`examples/balloon/main.blend` loses lines 11-73 — all 63 staging pokes — and the sprite pointer
becomes:

```blend65
poke($07F8, hi(&BALLOON) * 4);
```

The stale comment above it goes with them: it currently explains that "poke/peek addresses must be
compile-time constants, hence the unrolled copy", which is the reason the program is being changed.
What replaces it should say what the line does — the sprite is read where it lies, and the pointer
names its own address — without narrating the history.

Everything else in the file is untouched: the raster wait, the bounce logic, the position pokes.

### The divergence carried, not hidden

The one line above emits **8 instructions** where a hand-coder writes 4, and additionally emits
`warning[W10172]: multiply by 4 generates a shift-and-add sequence` — while the compiler in fact
emits two `ASL`s and incurs no shift-and-add cost. Both are constant-materialization defects routed
to #58/#60 (AR #67). They are recorded in the closeout, not fixed here.

## 2. The observable split (M6)

`BALLOON_OBSERVABLES` (`packages/test-harness/src/testing/balloon.ts:67-82`) is consumed by **two**
tiers: balloon's own suite and the twin tier (`twins.spec.test.ts:87`), the latter against a twin
that keeps staging at `$0340` with pointer 13 (AR #69 — the twin is not changing).

Two of its ten rows cannot survive that split:

```ts
{ address: 0x07f8, value: 13, note: "sprite pointer: block 13 = $0340" },
{ address: 0x0340, bytesFile: "examples/balloon/balloon.bin", note: "staged sprite image" },
```

**The shared table keeps only what both programs' sources still mandate** — position (174/141),
x-MSB, enable, colour, y-expand, multicolour, x-expand. Eight rows.

**The two divergent checks move into `balloon.spec.test.ts`**, resolved from the symbol map
(AR #74):

```ts
const addr = env.symbols.get("__data_Main_BALLOON");
expect(addr % 256).toBe(0);
expect(await peekByte(0x07f8)).toBe(addr / 64);
expect(await peekBytes(addr, 63)).toEqual(committedAsset);
```

This is not a workaround — it is what `testing/observables.ts:5-12` already prescribes:
*"implementation-coupled assertions — allocator-chosen addresses — stay in the fixture suites by
construction; equivalence between a program and its twin is judged only on what the program's
SOURCE mandates."* After this RD the sprite's address **becomes** allocator-chosen, so those rows
stop qualifying for the shared set by the contract's own rule.

> The shared twin contract is genuinely getting smaller, and that must be a deliberate, recorded
> act rather than a side effect. What it still proves is that both programs put the same sprite at
> the same screen position with the same VIC register state — the behaviour a player sees. What it
> no longer proves is that they agree on *where the bytes live*, which is exactly what this RD
> changes on purpose.

## 3. Corpus supersession

One phase, one regeneration (AR #73). In dependency order:

| Artifact | Change | Note |
|---|---|---|
| `budgets.json` balloon `bytes` | 677 → re-derived from the **aligned** build | Never from the 312 unaligned figure |
| `budgets.json` balloon `frameUpdate` window | `staticMaxCycles` re-derived; `measuredMaxCycles` re-measured on VICE | **Local tier** — CI cannot do this |
| Other 14 fixtures' ratchets | **Unchanged** — must be, or M1's rule is wrong | Re-derived anyway per AR #56 discipline |
| `twins.json` balloon routing | Prose re-authored; `sourceForced` dropped | See below |
| `SCOREBOARD.md` | Regenerated; freshness gate green | |

Label anchors need no attention: `Main_main_L5`/`L3` survive the rewrite unchanged (verified).

### The routing re-audit is prose work, not a number

`twins.json`'s balloon entries currently say the divergence is "63 unrolled pokes forced by the
`copy()` language gap" and carry `sourceForced: true`. Regeneration will **not** fix this — the
generator copies the notes verbatim and only aborts on *structural* staleness (a routing category
with no computed rows), so the gate stays green while the prose is false.

**Four rows are falsified by the rewrite, not one.** Task 4.11 must re-author all of them:

| `twins.json` | Row | Why it is now false |
|---|---|---|
| `:405` | `sourceForced: true` | Nothing is source-forced once the copy is gone |
| `:410` | the `#49` pair — "63 unrolled pokes forced by the `copy()` language gap" | The pokes no longer exist |
| `:415-416` | the `#51` row — "the remaining size gap is the unrolled sprite copy below, not layout" | The gap is now padding + `hi(&X)*4` + load/store; layout is exactly what changed |
| `:423` | the `#52` row — "LDA 96 vs 27, STA 87 vs 21" | 63 LDA/STA pairs vanish; the counts are wrong by construction |

The freshness gate cannot see any of it. Left alone, three false statements ship in the same commit
that makes them false — which is precisely the failure AC-8 exists to prevent.

What replaces it has to be honest in both directions (AR #69):

- The twin's copy is the **file-size** idiom — it stages below the PRG load base, buying RAM the
  compiler cannot reach. The compiler's placement is the **runtime** idiom — no startup copy.
  Neither is a defect; they are two expert choices.
- The residual 318 − 251 decomposes into: the **padding accident** (0–255, today 6), the
  `hi(&X) * 4` materialization → **#58/#60**, and load/store elimination → **#52**.

That decomposition is what makes "1.27×" a true statement rather than a flattering one.

## 4. The mixed-alignment fixture (AC-7)

The RD's only new artifact, and the sole carrier of AC-7. Two files, both named here because the
task grain elsewhere in this plan is line-level and this one previously named neither:

| File | What it is |
|---|---|
| `examples/align-mixed/main.blend` | **committed source** — two const arrays, the address-taken one **declared first** |
| `packages/test-harness/src/align-mixed.spec.test.ts` | the suite, under `describe.skipIf(!hasAcme())` |

Built through the real `build()` facade and real ACME following `testing/balloon.ts:44-58`,
committing no generated output. It asserts ST-C11–ST-C13 (see [07](07-testing-strategy.md)).

Three constraints that are easy to lose:

- **The source is committed, not inlined in the test.** The pattern the task cites (`balloon.ts:45-47`)
  copies a *committed* directory into a temp dir — it presupposes committed source, and the RD's
  Integration Points say the same. It also matters on the merits: the marking rule is **syntactic**,
  so the negative control's source must be reviewable in the tree, not buried in a template literal.
- **It lives in `@blend65/test-harness`.** `build()` comes from `@blend65/compiler`
  (`balloon.ts:19`); a `@blend65/codegen` home would invert the package edges.
- **Declaration order is load-bearing.** ST-C12 proves "the unaligned array pays no padding" as
  `unaligned.addr === aligned.addr + aligned.data.length` — the symbol map exposes labels only,
  with no code-end symbol — so the aligned array must come first.

**No committed golden and no hand-written twin** (AR #70). The reasoning is recorded in the RD's
AC-7 and the register; the short form is that a golden containing the silently-wrong
`!align 256, 0` would look plausible and pass, and a twin for a synthetic probe has no idiom to be
a twin *of* while permanently polluting the corpus ratio.

Head `main.blend` with a comment saying exactly that — a placement probe deliberately **outside**
the parity corpus, no golden, no twin, no `budgets.json` row — so future corpus tooling does not
sweep it in. Verified drag-free today: `examples-sync.spec.test.ts:38-63` iterates a closed
`INLINED_MODULES` list, `twins.spec.test.ts:93-99` keys the pair set to `*.asm.golden` files plus
balloon, and `budgets.spec.test.ts:226-230` closes over a fixed builder list. It becomes the first
`examples/` member with no budgets row, and the header comment is what tells the next person that
is deliberate.
