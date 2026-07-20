# M3 + AC-6 + M4/M5 — Diagnostics, Examples, Ledgers

> **Decides**: AR #93 (`balloon-color` check shape) · AR #94 (M3 lands first)
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

### The two re-derived spec tests

Both are **re-derivations against a named normative source**, never a weakening. Each keeps every
other assertion — the `ASL` count, the absence of a runtime multiply — and inverts only the warning
expectation. Both gain a header line citing `spec/evaluations/F017-operators.md:442`.

| Test | Was | Becomes |
|---|---|---|
| ST-51a `translate-indexed.spec.test.ts:112,121` | `expect(diags.some(d => d.code === ShiftAndAddMultiply)).toBe(true)` | `.toBe(false)` — a compiler-generated 2-byte element scale must not warn the user about a multiply they never wrote |
| ST-T16 `translate.spec.test.ts:458,470` | `expect(warnings.map(w => w.code)).toContain(ShiftAndAddMultiply)` | `.not.toContain(…)` — the exact `LDA`/`ASL`×3/`STA` text assertion at `:466-469` stays byte-for-byte |

Titles are updated to state what they now pin (they currently read "with W10172" / "and warns
W10172"). No plan, requirement or task ID appears in any test file.

### AC-7's witness

A "balloon emits no `W10172`" clause would be **vacuous** after Phase 4 — the migrated program
contains no multiply at all. AC-7's witness is ST-13c, a probe with a *user-written* runtime
power-of-two multiply that survives every later phase.

## 2. AC-6 — the idiom migration (Phase 4)

### The three source edits

| File | Line | Was | Becomes |
|---|---|---|---|
| `examples/balloon/main.blend` | 11 | `poke($07F8, hi(&BALLOON) * 4);` | `poke($07F8, lo(&BALLOON / 64));` |
| `examples/balloon-color/main.blend` | 21 | `poke($07F8, hi(&BALLOON) * 4);` | `poke($07F8, lo(&BALLOON / 64));` |
| `examples/boing-ball/main.blend` | 54 | `let base: byte = hi(&BALL) * 4;` | `let base: byte = lo(&BALL / 64);` |

The balloon pair's teaching comments currently end *"…and the sprite pointer is just its block
number, high byte times four"* (`balloon:8-10`, `balloon-color:19-21`). Both are rewritten to
describe the block number as the address divided by 64 — the arithmetic the code now performs, and
the one that stays correct at 64-byte alignment.

> **`boing-ball` is the strongest of the three, and a different lowering position** (AR #96). Its
> site is a **`let` initializer**, not a `poke` value — it reaches `translateMul` and `leftIntoA`
> by the same route, so M1 covers it identically, but it is the one case where the migrated value
> is then used arithmetically: the ball is four consecutive 64-byte blocks addressed as
> `base+0..3` (`main.blend:56-59`). The program is already doing 64-byte block arithmetic while
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

`balloon.spec.test.ts:166-181` pins the ordered subsequence `LDA #>__data_Main_BALLOON` · `ASL` ·
`ASL` · `STA $07F8`. Its own comment (`:169-172`) anticipates this:

> *"the shape of the shift sequence is a known constant-materialisation weakness, and when that is
> fixed this expectation should move with it — not block it."*

It becomes a two-instruction subsequence, `LDA #<(__data_Main_BALLOON / 64)` · `STA $07F8`, and the
comment is rewritten to describe the folded form rather than a weakness that no longer exists.

**ST-C15 (`:184-195`) is not touched.** It asserts `addr % 256 == 0` and `addr < 0x1000` and is
AC-2's whole proof — it must keep failing if any path shortcuts `lowerAddressOf`.

### The `balloon-color` and `boing-ball` checks (AR #93, #96)

Two new build-only spec tests in test-harness, each with a `testing/<demo>.ts` builder mirroring
`testing/balloon.ts`, both under `skipIf(!hasAcme())` — ACME is installed in CI, VICE is not
(AR-27). Neither demo is referenced by anything in `packages/`, `test/`, `scripts/` or `.github/`
today, so these are their **first** CI signals of any kind.

| Assertion | `balloon-color` | `boing-ball` | Oracle |
|---|---|---|---|
| the program assembles | ✅ | ✅ | ACME exit status |
| the image is page-aligned and below `$1000` | `__data_Main_BALLOON` | `__data_Main_BALL` | symbol map — mirrors ST-C15 |
| the assembled sprite-pointer byte equals `(resolved address ÷ 64) mod 256` | `$07F8` | `$07F8` | symbol map — AC-4's rule |
| the three sibling pointers are that block **+1, +2, +3** | — | `$07F9`–`$07FB` | symbol map |

`boing-ball`'s fourth row is the one neither balloon carries: it proves the migrated value is still
usable as the base of 64-byte block arithmetic, which is the property RD-15 depends on.

Neither demo gains a golden, a `budgets.json` row or a twin — both stay outside the parity corpus
exactly as their own headers state (`balloon-color/main.blend:2-6`, `boing-ball/main.blend:3-4`).
Neither is inlined by `examples-sync.spec.test.ts`, so no inlined-source constant needs updating.

## 3. M4 — the ledgers stay true (Phases 2, 4, 5)

Each phase that moves bytes re-derives its own numbers in the same commit:

| Artifact | Rule |
|---|---|
| `budgets.json` | every affected `bytes` ratchet re-derived **from the new build**, never edited to a guess |
| goldens | regenerated and hand-reviewed — they must read like a competent asm developer wrote them |
| `SCOREBOARD.md` | regenerated in the same commit as the source and ratchet changes |

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

CI can check structure: after Phase 5, no `twins.json` row carries `"issue": 58` except the rows
belonging to #58's own remaining halves. Attribution *truth* and "re-authored from measurement"
cannot be judged by a gate and are walked at closeout — AC-9 is `[CI + review]` for that reason.

## 5. RD back-propagation (Phase 5)

Two corrections land in the RD itself so it stops describing behaviour the implementation does not
have. Both are recorded in [01-requirements.md](01-requirements.md#corrections-this-plan-makes-to-the-rd):
the locals claim (AR #91) and the "load source" framing (AR #88).
