# Oracles and Ledgers: Alignment Granularity

> **Document**: 03-02-oracles-and-ledgers.md
> **Parent**: [Index](00-index.md)
> **Covers**: RD-15 M4, M5 · decided by AR #107, #108, #109, #111, #112, #118

## 1 — The sixteen reshaped sites (Phase 1)

These are not oracle changes. Each restates the same requirement against the replacement shape, and
the type change forces every one of them — `yarn typecheck` fails until they are done, which is what
makes them Phase 1's red phase.

| File | Sites | `pageAligned: true` becomes | `pageAligned: false` becomes |
|---|---|---|---|
| `lower-address-of.spec.test.ts` | `:210, :232, :254, :255, :277, :279, :295, :312, :313, :333, :334, :354` | `boundary` is **256** | `boundary` is **absent** |
| `lower-address-of.impl.test.ts` | `:137, :156, :171` | the filter predicate becomes `e.boundary !== undefined` | — |
| `assemble.impl.test.ts` | `:155` | — | the field is **omitted** from the literal |

**The false-becomes-absent half is the load-bearing one** (plan criterion P-2). `:232` (by-reference
argument), `:254-255` (address of an interrupt handler), `:277-279` (address of a mutable module
array) and `:313` (an unaddressed neighbour) are RD-03 M1's membership rule — the rule RD-15
explicitly does not change. Reshaping them to `boundary === 256` would assert that these entries
carry a page demand, which is the opposite of what they say today, and would leave AC-7 pinned by
nothing. Absent means *no demand was ever registered*, which is the claim.

`assemble.impl.test.ts:155` carries its own reason in place — *"this case is about preamble
derivation, not placement"* — so omitting the field is the faithful translation of `false`.

## 2 — The six pinned assertions (Phase 2)

Three change; three are confirmed unchanged and thereby promoted from incidental coverage to the
pinned negative control.

| Assertion | Program's `&` form | Action |
|---|---|---|
| ST-C11 `!align 255, 0, 0` (`align-mixed.spec.test.ts:85-87`) | bare | **keep unmodified** — the bare-`&` control for M1's second row |
| ST-C12 `aligned % 256 === 0`, `plain === aligned + 4` (`:99, :104`) | bare | keep unmodified |
| ST-C13 `(a >> 8) * 4 === a / 64` (`:115`) | bare | keep unmodified |
| ST-C15 (`balloon.spec.test.ts:191`) | `/ 64` fold | re-derive |
| ST-13f (`balloon-color.spec.test.ts:51`) | `/ 64` fold | re-derive |
| ST-13j (`boing-ball.spec.test.ts:68`) | `/ 64` fold | re-derive |

**AC-8 is a no-edit criterion**: `align-mixed.spec.test.ts` and `examples/align-mixed/main.blend`
must appear in no diff of this plan. If either shows up in `git status`, that is the finding, not a
detail.

### The re-derivation, in all three

Each `expect(addr % 256).toBe(0)` becomes **two** clauses, and the accompanying `< 0x1000`
char-ROM assertion stays exactly as it is:

1. `addr % 64 === 0` — the boundary the program now demands.
2. The directive text: `!align 63, 0, 0` on the line immediately preceding the image's label, read
   out of `result.asmText` in ST-C11's style.

Clause 2 is load-bearing, not belt-and-braces, and this is the reasoning to restate in each test's
comment: `% 256 === 0` implies `% 64 === 0`, and all three images land on multiples of both, so
clause 1 alone **cannot fail** if the demand silently regresses to 256. That implication cuts both
ways, and the second direction decides the red phase: because every one of the three is
page-aligned today, clause 1 is already green on all three *before* the implementation lands, and
clause 2 is the only one that goes red. What `balloon-color` (`$0A00` → `$0980`) fails
deterministically is the **old** `% 256` assertion, once the image has moved — the forward tripwire,
not a red phase. Directive text is the only deterministic discriminator (AR #108).

None of the three is weakened, and each restates the requirement it is testing in the terms RD-15
establishes. The two assembled-pointer-byte oracles that ride alongside — `balloon-color`'s
`spritePointerByte` and `boing-ball`'s `immediateStoredTo` — are unaffected: both compute the
expectation from the resolved address (`Math.floor(address / 64) & 0xff`), so they follow the image
wherever it lands.

## 3 — Ledger corrections (Phase 3)

| # | Correction | Source |
|---|---|---|
| 1 | `RD-13-symbolic-address-arithmetic.md:157-159` predicts that RD-15's alignment will make `hi(&X) * 4` *"incorrect"*. Under the maximum rule it is false, and RD-13 already contradicts it at `:439`. Correct the prediction; leave the peephole **conclusion** visibly untouched — it stands on AR #79's wraparound argument, not on the prediction | AC-12, AR #109 |
| 2 | ~~Annotate `RD-03-placement.md` M2 in place as superseded~~ — **already applied** during RD authoring (`RD-03-placement.md:137-153`): the membership rule is stated as surviving intact, only the 256 value and the dissolved `hi(&X) * 4` justification as superseded. Verify only | AR #111 |
| 3 | ~~Add RD-15 to the README's *Suggested Implementation Order* wave table~~ — **already applied** (`README.md:84`, Wave B2 beside the placement slice), along with the RD-15 row and the dependency graph. Verify only | AR #112 |
| 4 | Back-propagate AR #113 into RD-15's *Technical Requirements*: the sentence *"Passing the normalized shift into that call is the whole mechanism"* describes the option the plan did not take. The mechanism passes the **derived boundary**; the allowlist stays in `foldedAddressByte` | AR #113 |
| 4b | The same decision's second consequence, in RD-15's *Combining demands* (`:271`): *"Insertion is `map.set(sym, Math.max(existing ?? 0, demand))`"*. Against `Map<string, AlignBoundary>` that fails twice — `Math.max` returns `number`, and `0` is not an `AlignBoundary` — so the RD as written prescribes code that cannot compile. Replace with the comparison form | AR #113 |
| 5 | Back-propagate AR #121 into RD-15's **AC-5** and its Spec-Test Inventory: drop the `lo(&X / 65536)` clause. Measured at authoring, `65536` exceeds the 16-bit maximum and the lexer rejects it with `E10216` (`packages/frontend/src/lexer/lexer.ts:238`) before lowering runs at all, so there is no boundary to keep; the extremes AC-5 covers are `k = 0` and `k = 15` | AR #121 |

Corrections 4, 4b and 5 are the runtime-ambiguity protocol working as intended, not defects in the
RD. The RD named a viable mechanism, the plan gate compared it against two others and chose
differently — 4 and 4b are the two sentences that choice invalidates; and the RD asserted a k=16
form was merely fold-rejected when it is in fact frontend-rejected. All are brought into line
rather than left describing code that does not exist.

## 4 — Closeout (Phase 3)

`08-closeout.md` walks all **fifteen** acceptance criteria with evidence, plus the three plan-local
ones. Three of them discharge by measurement or review rather than by a test:

| Criterion | Discharged by |
|---|---|
| **AC-10** — every 64-demand image's pad is `< 64` | Measurement at closeout: `balloon` 19, `balloon-color` 60, `boing-ball` 1. `align-mixed`'s 194 sits **outside** the bound's scope as the bare-`&` 256-demand control |
| **AC-11** — no corpus movement is claimed | `budgets.json` unchanged and `balloon` still 318 B, both mechanical. `balloon-color` measured at **454 B**, down from 582 — the budget convention, payload excluding the 2-byte load address, the same convention as `balloon`'s 318; the `.prg` file sizes are 456 and 584. Recorded as a measurement, never as a budget row |
| **AC-14** — Prime Directive review | Strategy-level, and deliberately so: the committed hand twin `examples/balloon/balloon.asm` contains **no** `!align` at all — it stages the sprite into the tape buffer with a copy loop — so in-place-plus-align is judged against staging-copy as a competent 6502 developer would judge the trade, not line-for-line against the twin |

The closeout states plainly that this RD recovers **128 bytes in a program with no budget**, that
the corpus byte total does not move, and that the deliverable is the bound.

### The emulator tier

AC-13's local VICE 3.10 run covers `balloon` and `boing-ball`. Stated for honesty rather than
buried: those are exactly the two programs whose image address this plan does **not** move.
`balloon-color`, the one image that does move, is build-tier only, and its hardware correctness
rests on ST-13f's assembled-pointer oracle. A one-off manual VICE look at `balloon-color` is taken
and **recorded** at closeout; it is not gated, because nothing in CI could re-run it.
