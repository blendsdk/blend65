# M3 + AC-6 + M4/M5 — Diagnostics, Examples, Ledgers

> **Decides**: AR #93 (`balloon-color` check shape) · AR #94 (M3 lands first) ·
> AR #98 (ST-13j's CI/VICE split)
> **Current state**: [02-current-state.md](02-current-state.md) owns the `W10172` footprint and the
> ledger inventory.

## 1. M3 — `W10172` conformance (Phase 1)

### The change

Delete the `this.bag.addWarning(DiagCode.ShiftAndAddMultiply, …)` call at `translate.ts:1588-1592`.
Nothing else in `translateMul` moves — the `ASL` sequence is correct and stays, as does the
`W10170` runtime-multiply warning at `:1599-1604`.

`DiagCode.ShiftAndAddMultiply` (`diagnostic-codes.ts:374`) **stays registered**. After this phase
it has no producer, which is the correct intermediate state: a diagnostic that fires only where the
spec forbids it is worse than one that does not fire. Its owner and end is
[#71](https://github.com/blendsdk/blend65/issues/71).

### Why this is a conformance fix, not a taste judgement

`spec/evaluations/F017-operators.md:442` (rule OP-5), verbatim:

> *"This warning is informational only… **It does NOT trigger for power-of-2 constants** (which use
> cheap shifts) or compile-time-constant expressions (which are folded)."*

The trigger is exactly inverted today. `spec/00-feature-index.md:226` corroborates — the message
advises *"consider power-of-2 stride for faster access"*, nonsensical when the multiplier already
is a power of two.

**The one apparent counter-text, disposed of.** `spec/04-expressions-operators.md:75` tags
"⚠️ W10172" on the codegen tier whose condition is *"One operand is a constant power of 2 **or small
constant**"*, and `:78` says the warning fires *"when a constant multiply generates a shift-and-add
sequence"* — with no power-of-2 carve-out. It is the first hit anyone gets greping `spec/` for
W10172, so leaving it unaddressed would expose this whole argument to a one-line rebuttal. It does
not contradict OP-5: Ch 04 is a two-line summary table, OP-5 is the specific normative rule and
states the exclusion explicitly; and a **pure** power-of-two multiply emits shifts with no adds at
all, so Ch 04's own words — "generates a shift-and-add sequence" — describe only the small-constant
half of that tier. Where a summary and a rule disagree, the rule governs. `spec/` is frozen under
D3 and is **not** edited to say so.

### The two re-derived spec tests

Both are **re-derivations against a named normative source**, never a weakening. Each keeps every
other assertion — the `ASL` count, the absence of a runtime multiply — and inverts only the warning
expectation. Both gain a header line citing `spec/evaluations/F017-operators.md:442`.

| Test | Was | Becomes |
|---|---|---|
| ST-51a `translate-indexed.spec.test.ts:112,121` | `expect(diags.some(d => d.code === ShiftAndAddMultiply)).toBe(true)` | `.toBe(false)` — a compiler-generated 2-byte element scale must not warn the user about a multiply they never wrote |
| ST-T16 `translate.spec.test.ts:458,470` | `expect(warnings.map(w => w.code)).toContain(ShiftAndAddMultiply)` | `.not.toContain(…)` — the exact `LDA`/`ASL`×3/`STA` text assertion at `:467-469` stays byte-for-byte |

Titles are updated to state what they now pin (they currently read "with W10172" / "and warns
W10172"). No plan, requirement or task ID appears in any test file.

**A fifth site, not four.** The footprint table in [02](02-current-state.md) counts the producer,
the registration and the two assertions. There is also a **comment** at
`translate.spec.test.ts:457` — *"// mul by a constant power-of-two → shift sequence; W10172
emitted."* — sitting directly above ST-T16. Left alone it would state the opposite of what the test
pins, so it is rewritten with the assertion.

### AC-7's witness

A "balloon emits no `W10172`" clause would be **vacuous** after Phase 4 — the migrated program
contains no multiply at all. AC-7's witness is ST-13c, a probe with a *user-written* runtime
power-of-two multiply that survives every later phase.

`boing-ball` keeps a real one too — `let step: byte = frame * 4;` (`main.blend:94`) survives the
migration untouched, since only the `base` initializer changes. It is a corroborating witness, not
the primary one: ST-13c pins the diagnostic directly, while boing-ball's suite is build-only.

## 2. AC-6 — the idiom migration (Phase 4)

### The three source edits

| File | Line | Was | Becomes |
|---|---|---|---|
| `examples/balloon/main.blend` | 11 | `poke($07F8, hi(&BALLOON) * 4);` | `poke($07F8, lo(&BALLOON / 64));` |
| `examples/balloon-color/main.blend` | 21 | `poke($07F8, hi(&BALLOON) * 4);` | `poke($07F8, lo(&BALLOON / 64));` |
| `examples/boing-ball/main.blend` | 54 | `let base: byte = hi(&BALL) * 4;` | `let base: byte = lo(&BALL / 64);` |

The balloon pair's teaching comments currently end *"…and the sprite pointer is just its block
number, high byte times four"* (`balloon:8-10`, `balloon-color:18-20`). Both are rewritten to
describe the block number as the address divided by 64 — the arithmetic the code now performs, and
the one that stays correct at 64-byte alignment.

> **`boing-ball` is the strongest of the three, and a different lowering position** (AR #96). Its
> site is a **`let` initializer**, not a `poke` value. Before migration that reaches `translateMul`
> and `leftIntoA` exactly as the two `poke` sites do — a `mul`'s operands bypass `materialise`. The
> **migrated** form does not: a bare byte-select in a `let` initializer funnels through
> `materialise` → `const` → `translateConst`, which is why AR #99's arm is a prerequisite for this
> task rather than an unrelated hardening. It is also the one case where the migrated value
> is then used arithmetically: the ball is four consecutive 64-byte blocks reached as
> `base + step + 0..3`, where `step = frame * 4` animates (`main.blend:91-99`). The program is
> already doing 64-byte block arithmetic while
> naming its first block through a page-alignment identity that holds only by luck, and it is the
> example RD-15 breaks first — `hi(&X) * 4` computes the **wrong** block the moment the image is
> no longer page-aligned. Its comment at `:52-53` is rewritten the same way.

### Why this ordering is mandatory

Migrating before M2 is wired makes `balloon` grow past its ratchet, fires `W10171`, and reds the
scoreboard freshness gate — which rebuilds every pair from `examples/` source. The source edit, the
re-derived ratchet, the regenerated goldens and `SCOREBOARD.md` land in **one commit**.

`balloon` is exempt from `examples-sync.spec.test.ts` (built from its directory directly, nothing
inlined), so no inlined-source constant needs updating. `balloon-color` is inlined nowhere.

### ST-C14 re-derived

`balloon.spec.test.ts:169-181` pins the ordered subsequence `LDA #>__data_Main_BALLOON` · `ASL` ·
`ASL` · `STA $07F8` (comment `:169-172`, code `:173-181`).

> **The re-derivation stops at `:169`.** Lines `:166-167` in the same `it` block assert that the
> embedded sprite appears in the binary **exactly once** — the "never duplicate bytes in RAM"
> property. They have nothing to do with the pointer idiom and must survive byte-for-byte.

Its own comment (`:169-172`) anticipates this:

> *"the shape of the shift sequence is a known constant-materialisation weakness, and when that is
> fixed this expectation should move with it — not block it."*

It becomes a two-instruction subsequence, `LDA #<(__data_Main_BALLOON / 64)` · `STA $07F8`, and the
comment is rewritten to describe the folded form rather than a weakness that no longer exists.

**ST-C15 (`:184-195`) is not touched.** It asserts `addr % 256 == 0` and `addr < 0x1000` and is
AC-2's whole proof — it must keep failing if any path shortcuts `lowerAddressOf`. Its comment at
`:189` motivates the check through *"the sprite pointer is exactly the high byte times four"* — the
identity Phase 4 stops relying on. It still **holds** at page alignment, so the comment is stale
rather than wrong, and it stays: rewording it would mean touching AC-2's only proof for cosmetic
reasons. RD-15 is where that sentence is retired, when 64-byte alignment breaks the identity.

### The `balloon-color` and `boing-ball` checks (AR #93, #96)

Two new build-only spec tests in test-harness, each with a `testing/<demo>.ts` builder mirroring
`testing/balloon.ts`, both under `skipIf(!hasAcme())` — ACME is installed in CI, VICE is not
(AR-27). Neither demo is **compiled** by any suite today, so these are the first tests that build
them. (They are not wholly unreferenced: the examples coverage manifest names both, and it is that
manifest's `pendingSuite` waiver these two tasks clear — see §2.1 below.)

| Assertion | `balloon-color` | `boing-ball` | Oracle |
|---|---|---|---|
| the program assembles | ✅ | ✅ | ACME exit status |
| the image is page-aligned and below `$1000` | `__data_Main_BALLOON` | `__data_Main_BALL` | symbol map — mirrors ST-C15 |
| the folded block number equals `(resolved address ÷ 64) mod 256` | the byte stored to `$07F8` | the `base` **initializer** immediate | symbol map — AC-4's rule |
| the value is still usable as a block base | — | the `ADC #1`/`#2`/`#3` → `STA $07F9`..`$07FB` chain | emitted asm |

> **The two demos differ in where the block number is link-time, and ST-13j was originally
> specified against the wrong one** (AR #98). In `balloon-color` the migrated expression feeds the
> store directly, so `LDA #<(__data_Main_BALLOON / 64)` · `STA $07F8` puts the byte in the binary
> and a build-only oracle can read it. In `boing-ball` it does **not**: `base` is a `let`, and the
> four pointers are computed at runtime as `p = base + frame * 4` (`main.blend:94-99`). `$07F8`–
> `$07FB` are VIC pointer RAM, outside the load image — those four bytes exist nowhere in the PRG,
> at any frame. The link-time datum is the `base` initializer's immediate, and the *block-base*
> property is proved structurally by the `+1/+2/+3` chain rather than by reading memory.
>
> The memory reading — `peek($07F8..$07FB) == b, b+1, b+2, b+3` — is real and worth having, but it
> is an **emulator** assertion. It moves to the local VICE tier beside AC-10 (task 5.5), where the
> program is actually running and `frame` has a value. CI proves the link-time half; VICE proves the
> runtime half; neither pretends to be the other.

Neither demo gains a golden, a `budgets.json` row or a twin — both stay outside the parity corpus
exactly as their own headers state (`balloon-color/main.blend:3-6`, `boing-ball/main.blend:3-4`),
and the coverage manifest's `demo` tier enforces that absence. Neither is inlined by
`examples-sync.spec.test.ts`, so no inlined-source constant needs updating.

> `boing-ball`'s out-of-corpus status is **not** an invariant: RD-16
> ([#72](https://github.com/blendsdk/blend65/issues/72)) is sequenced immediately after this RD to
> give it a hand-written twin, which flips its tier to `corpus` and brings a golden, a ratchet and a
> scoreboard pair. It waits for RD-13 precisely because this migration moves its bytes. The suite
> built here is what RD-16 extends, not something it discards.

### 2.1 The coverage manifest (`examples-coverage.json`)

`packages/test-harness/test/golden/examples-coverage.json` tiers every `examples/` program and its
gate fails on any that no suite reaches. Both demos sit in `pendingSuite` with a stated reason —
the waiver that exists solely until the two suites above land. Tasks 4.1 and 4.2 each move their
demo from `pendingSuite` into `suites`, naming the new file. **After Phase 4 that list must be
empty**; emptying it is the point, not a formality.

## 3. M4 — the ledgers stay true (Phases 2, 4, 5)

Each phase that moves bytes re-derives its own numbers in the same commit:

| Artifact | Rule |
|---|---|
| `budgets.json` | every affected `bytes` ratchet re-derived **from the new build**, never edited to a guess |
| goldens | regenerated; the diff must be **empty** in every phase — see below |
| `SCOREBOARD.md` | regenerated in the same commit as the source and ratchet changes |

### The hand-review has to point at what actually moves

No committed golden can change in **any** phase of this RD. The 14 corpus fixtures are untouched by
M1, M2 and M3 alike — only `examples/balloon`, `examples/balloon-color` and `examples/boing-ball`
change, and none of the three has a golden. So "regenerate the goldens" means *regenerate and
confirm a zero diff*, and it is a **guard**, not an expectation: a non-empty golden diff in any
phase is a defect to stop on, because nothing in this RD should have moved those bytes.

That leaves a hole the plan has to close deliberately. `balloon` is the one program whose assembly
this RD rewrites — twice, in Phases 2 and 4 — and it has **no golden**, so a review scoped to golden
hunks would never read a single line of the code this RD exists to produce. In a project whose
Prime Directive makes output parity the benchmark, that is exactly backwards.

The review is therefore pointed at `balloon` itself, in both byte-moving phases: its regenerated
assembly is read by hand against `examples/balloon/balloon.asm`, its committed hand-written twin.
The ideal comparison already exists in the repo — a competent 6502 developer's version of the same
program — which makes this the strongest hand-review available anywhere in the corpus, not a
weaker substitute for one.

**AC-8's split holds.** "No individual fixture grows" is enforced by the budget tier. "Corpus total
strictly decreases" is a review gate walked at closeout — the budget tier only fails on
`actual > budget` and would pass growth accompanied by a raised ratchet.

## 4. M5 — re-routing the 16 misrouted rows (Phase 5)

`twins.json` carries 53 routed rows, **17** with `"issue": 58`. Exactly one — `balloon`'s
`hi(&BALLOON) * 4` entry — is a symbolic-address defect.

| Rows | Note text | Destination |
|---|---|---|
| 1 | `balloon`'s `hi(&BALLOON) * 4` divergence | **re-authored from measurement** — after Phase 4 the divergence it describes no longer exists |
| 8 | *"constant-foldable program: full runtime machinery emitted where a hand version folds to direct stores"* | [#70](https://github.com/blendsdk/blend65/issues/70) |
| 8 | *"code-size consequence of the unfolded machinery"* | [#70](https://github.com/blendsdk/blend65/issues/70) |

These 16 are local constant-propagation and dead-store gaps in codegen dataflow — nothing to do
with `packages/frontend` semantics or link-time symbols. They drive the corpus's worst ratios
(`slice6` 8.70×, `slice3b` 8.32×, `slice7b` 7.40×, `slice5a` 7.12×). M5 **re-routes them; it does
not fix them.**

> `examples/slice3a` is the clearest exhibit of the same defect but its rows already route to
> #59/#60, so it is **not** one of the 16.

### The enforceable half

CI can check structure: after Phase 5, **no `twins.json` row carries `"issue": 58`** — flatly, with
no exception clause. The RD's AC-9 phrases it as "except the rows belonging to #58's own remaining
halves", but the arithmetic leaves no such residue: all 17 rows are accounted for as 1 re-authored
plus 16 re-routed, and the re-authored `balloon` row names its measured owner rather than #58.
An exception set nobody can enumerate is not a check, so the plan states the assertion the data
actually supports. #58 stays open for its audit halves; it simply no longer owns any routed row.

Attribution *truth* and "re-authored from measurement" cannot be judged by a gate and are walked at
closeout — AC-9 is `[CI + review]` for that reason.

## 5. RD back-propagation (Phase 5)

Three corrections land in the RD itself so it stops describing behaviour the implementation does not
have. All are recorded in [01-requirements.md](01-requirements.md#corrections-this-plan-makes-to-the-rd):
the locals claim (AR #91), the "load source" framing (AR #88), and AC-6's scope — the RD says the
idiom migrates in *"both examples"* and names two, while this plan migrates **three** (AR #96).
Without the third correction the RD permanently understates what the closeout walk claims to have
discharged against it.
