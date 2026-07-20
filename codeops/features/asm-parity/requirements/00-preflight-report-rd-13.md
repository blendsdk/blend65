# Preflight Report — RD-13: Symbolic Address Arithmetic

> **Artifact**: [`RD-13-symbolic-address-arithmetic.md`](RD-13-symbolic-address-arithmetic.md)
> **Date**: 2026-07-20
> **Method**: 5-cluster parallel fan-out (`preflight-auditor` × 5) on a different model family
> (Fable) than the author (Opus), plus lead verification of every load-bearing claim.
> **Findings**: PF-053 … PF-079 (27) — **8 major, 14 minor, 5 observations, 0 critical**
> **Verdict**: see [Verdict](#verdict).
> **CodeOps Skills Version**: 3.11.0

> ⚠️ **SAME-SESSION REVIEW.** RD-13 was authored minutes before this scan, by the same model that
> coordinated it. Every auditor was told so and instructed to be adversarial. The mitigation that
> actually did the work was **model diversity** — all five clusters ran on a different family — and
> **independent convergence**: the two most serious findings (PF-053, PF-054) were each raised by
> two clusters that could not see each other's output.

---

## Codebase Context Summary

The RD targets three files and one frozen-spec rule:

| Area | File | What the RD changes |
|---|---|---|
| Lowering | `packages/codegen/src/il/lower.ts:2530-2611` | `emitLo`/`emitHi` stop homing an address through a frame slot |
| Operand model | `packages/core/src/instr-model/operand.ts:30-40` | one additive variant (symbol ÷ 2^k) |
| Serializer | `packages/codegen/src/instr/print-instr.ts:58-79` | one forced arm (TS2366) |
| Instruction selection | `packages/codegen/src/instr/translate.ts:1582-1592` | removes a spec-non-conformant `W10172` |

The corpus instruments — 14 goldens, `budgets.json`, `twins.json`, `SCOREBOARD.md` and a hard-fail
freshness gate — are the ledger every change must keep true. `balloon` is a **fixture without a
golden**; `balloon-color` is outside the corpus entirely.

### Claims verified CORRECT (do not re-check)

The RD's central risk claims all survived adversarial verification, several reproduced with the
repo's own toolchain:

- **The blast radius is genuinely one forced site.** Repo-wide search confirms `symbolText`
  (`print-instr.ts:58-79`) is the *only* exhaustive switch over `InstrOperand.kind`.
  `instrByteSize` keys on addressing mode; `relax-branches.ts:224,266` guard `isLabelRef`;
  `embed.ts:70-75` inspects only `JSR`; `serialize-acme.ts` delegates to `printInstr`.
- **TS2366 reproduced** with the repo's own `tsc`: an explicit `: string` return over a
  non-exhaustive switch is a hard compile error under `strict` (`tsconfig.base.json:9`). The RD's
  "Correction to record" is right, and the roadmap did carry the earlier wrong claim.
- **`lowerAddressOf`'s double side effect is real** — slot claimed at `lower.ts:1845`, alignment
  marked at `:1863`, `if (direct) return address;` at `:1870`.
- **The alignment/CI-blindness hazard is real**: `examples/balloon/main.blend:11` is that file's
  only `&`; `GOLDEN_PROGRAMS` (`golden-layout.spec.test.ts:36-50`) has 14 entries and no balloon;
  every RD-03 alignment spec test takes `&` in *store* position, never through `lo()`/`hi()`.
- **The two-lowering-contexts hazard is covered**: `addressTakenConsts` is created once and shared
  across function and `__init` lowering (`lower.ts:222-226`, consumed at `:281`).
- **The AR #79 identity holds as qualified.** For page-aligned `X = 256p`,
  `hi(X)·4 mod 256 = 4(p mod 64) = (X & $3FFF)/64`. Verified at `$0900`, `$4900`, `$C800`,
  `$3F00`, `$4000`; fails at non-page-aligned `$0940`/`$4840` — exactly the case the
  qualification excludes and RD-15 motivates.
- **`hi(&X)*4` ≡ `lo(&X/64)` at every page-aligned address**, so AC-6's migration is
  value-preserving under RD-03's alignment — and provable **in CI** by AC-2 + AC-4, not only on
  VICE. (This is stronger than the RD claims; see PF-076.)
- **ACME 0.97 measured**: `/` truncates on integers; `#<(sym / 64)` and `#<(sym >> 6)` both yield
  `a9 21` at `sym = $0840`, matching the RD's probe in the select-free spelling.
- **Ledger counts exact**: `twins.json` carries 53 routed rows, 17 naming #58, one of them
  balloon's. `SCOREBOARD.md`: balloon 318/251/1.27×, corpus 3257/3.54×.
- **Spec text verbatim**: `F017-operators.md:442` carries the "does NOT trigger for power-of-2
  constants" sentence; the E1019x numbering really is inconsistent between
  `14-diagnostics.md:138-140` and `00-feature-index.md:171-173`.
- **`W10172` has no other dependants** repo-wide beyond the two named tests.
- **`ST-C15` already exists** (`balloon.spec.test.ts:184-195`) asserting `addr % 256 == 0` and
  `< $1000` under `skipIf(!hasAcme())` — so AC-2 has a real proving artifact that can fail in CI.

---

## Findings

### 🟠 MAJOR

**PF-053 — The spec-test blast radius is understated, and the RD makes the count a governance claim.**
*Dimensions: Test Impact, Impact Blindness · raised independently by clusters ② and ⑤.*
The RD states in bold: *"This is the one place RD-13 touches a `*.spec.test.ts` file."* It is not.
`packages/codegen/src/il/lower-address-of.spec.test.ts:157-174` — **ST-9b**, *"`lo(&fn)` / `hi(&fn)`
home the address and read the slot's low/high byte"* — asserts
`store &Main_helper, __frame_Main_main_0sc0` and `load i8u __frame_Main_main_0sc1+1`, i.e. exactly
the homing M1 abolishes. Its module header (`:6-10`) states the rule normatively: *"In every other
position (ALU arithmetic, `lo`/`hi` extraction) the address is first homed into a synthetic word
frame slot."* Separately, **ST-C14** (`balloon.spec.test.ts:166-181`) pins the ordered subsequence
`LDA #>__data_Main_BALLOON` / `ASL` / `ASL` / `STA $07F8`, which AC-6's migration removes from the
program entirely. The real set is **four spec tests plus a module header**, not two.
*Mitigating:* ST-C14 carries a comment explicitly inviting the change — *"when that is fixed this
expectation should move with it — not block it."*
→ **Resolution:** enumerate the full set under M1/M3, each with its re-derivation source.

**PF-054 — AC-3's named oracle cannot fail for the risk it gates.**
*Dimension: Testability · raised independently by clusters ② and ⑤.*
AC-3 claims the pinned `0sc*` lists in `model-adapter.spec.test.ts` prove the positional counter
never shifted. That file is in `packages/frontend/src/sfa/` and exercises only
`lex → parse → analyze → modelToFunctionInfo` — no codegen import (R15 forbids one) — and the RD
itself says the frontend is untouched. Its fixtures contain **no `&` site at all** (`&&`/`?:`
only). The counter M1 can shift is codegen's `ctx.scCounter++` (`lower.ts:1392`), which no cited
test observes. This is the RD-03 preflight's *"proof that cannot fail"* failure mode, reproduced.
Worse, nothing else catches it: after M1 no corpus program has a homing `&` site following a
`hi`/`lo` site, so no golden byte would move.
→ **Resolution:** re-point AC-3 at a codegen-tier oracle — the re-derived ST-9b asserting the `&`
site still consumes `0sc0` *and* a later slot site still gets `0sc1`.

**PF-055 — The Security section asserts a hard failure mode the RD's own design makes impossible.**
*Dimensions: Logical Contradiction, Security Blind Spot · raised by clusters ①, ②, ④.*
Security Considerations: *"The out-of-range case moves from silent wrap to a hard ACME error…a new
way for a previously-building program to stop building."* But M2 requires a **low-byte select**,
and `lo()` truncates by definition — measured, `lda #<(sym / 64)` at `sym = $FFC0` assembles
silently to `$FF`. Only the select-free spelling errors. The RD's own technical section says so:
*"always in immediate range — ACME never has to reject it."* This is residue from a pre-`#<(…)`
draft. It matters because it advertises a fail-loud safety net that cannot fire, which RD-15 could
rely on.
→ **Resolution:** rewrite the bullet: out-of-bank residency remains undiagnosed and silently wraps
(correctly, to the within-bank block), unchanged from today, tracked by #68. Delete the
build-failure risk.

**PF-056 — The new operand's rendering silently miscompiles under ACME precedence once `offset` is populated.**
*Dimension: Edge Cases · cluster ④; reproduced by the lead on ACME 0.97.*
The RD defines the variant as carrying *"a symbol, an optional offset and a power-of-two shift
count, serialized parenthesized … so ACME's precedence cannot reinterpret it."* A single outer
paren does not deliver that. Measured, `sprite` at `$0900` (correct block `$24`):

```
#<(sprite / 64    ) -> 0x24   correct
#<(sprite+3 / 64  ) -> 0x00   ACME binds / tighter than + : sprite + (3/64) = sprite + 0
#<((sprite+3) / 64) -> 0x24   correct
#<(sprite + 128/64) -> 0x02   silently a different address
```

All assemble cleanly — the exact trap class the RD cites RD-03's `!align 256, 0` for. Note the
existing `symbolRef` precedent renders offsets *unparenthesized* (`print-instr.ts:61`, `<sym+3`),
correct only because unary `<` binds loosest — so an implementer following house style inside the
new parens produces the wrong meaning.
→ **Resolution (recommended):** **drop the `offset` field.** No Must-Have consumes it, the
Won't-Have excludes the form it serves (`&X + n`), and PF-062 flags it independently as
pre-admitted scope creep. Dropping it removes the trap by construction. *Alternative:* require
`#<((sym+off) / 2^k)` as the stated serialization.

**PF-057 — `balloon-color` is the second migration site, named nowhere, and verified by nothing.**
*Dimensions: Completeness, Edge Cases, Testability · raised by clusters ③, ④, ⑤.*
AC-6 migrates *"the `examples/` sources that teach `hi(&X) * 4`"* — a definite description
resolving to exactly two files: `examples/balloon/main.blend:11` and
`examples/balloon-color/main.blend:21`. The RD discusses balloon down to the line and **never
mentions balloon-color**. That file has zero references in `packages/`, `test/`, `scripts/` or
`.github/` — no golden, no budget row, no twin, not compiled in CI. A migration typo or a wrong
block ships with **zero signal**. It is also precisely the fixture RD-15 is measured on (193 B /
33%), and it carries a teaching comment naming the doomed idiom.
→ **Resolution:** name both files in AC-6; migrate balloon-color's source *and* its comment; add a
minimal CI obligation (compile it, assert its block byte via the symbol map — its array is
address-taken, so the AC-2/AC-4 machinery applies unchanged). Or exclude it explicitly and hand it
to RD-15 in writing. Silence is the only wrong option.

**PF-058 — S1/AC-9 re-route to "their real owner" with the owner never named — and no existing issue owns the capability.**
*Dimension: Completeness · cluster ③; destination analysis by the lead.*
S1, AC-9, AR #81 and both roadmaps all say the 16 rows stop naming #58; none names a destination.
`twins.json` rows carry a numeric `issue:` field, so the plan cannot execute S1 without making a
routing decision the RD was supposed to settle — and AC-9 is satisfiable by pointing them at
*anything* that isn't #58, recreating the exact defect S1 exists to fix. The lead checked every
open issue: **#60 is itself an audit sweep** (same failure mode as #58); **#52** covers redundant
loads but not propagation across a frame slot (`slice3b`'s `5*3 → JSR __rt_mul8`). No open issue
owns local constant propagation / dead-store elimination.
→ **Resolution:** file a dedicated issue and route the 16 rows to it (RD-03 #67/#68 precedent).
Requires user authorization — outward-facing.

**PF-059 — The OP-5 spin-off is described as accomplished but was never filed.**
*Dimension: Completeness · cluster ③.*
*"'start emitting it rightly' is spun off"* — nothing was spun off. No issue, no roadmap row, and
no RD requirement to create one. The consequence left ownerless is a **registered diagnostic with
no producer** plus a **frozen-spec rule with no implementation**, and AR #80's "temporarily
producer-less" has no defined end. House style is the opposite: every RD-03 deferral carries a
filed issue or explicit routing.
→ **Resolution:** add an RD deliverable — file the OP-5-positive-case issue before closeout and
link it from the M3 note. Requires user authorization — outward-facing.

**PF-060 — M1's operand-kind scope is unspecified.**
*Dimension: Ambiguity/Testability · cluster ⑤.*
M1 says *"`hi(&X)` and `lo(&X)` materialize as a single immediate byte-select"* without saying
whether `X` ranges over const arrays, **functions**, or mutable module variables. ST-9b uses
`&helper` — a *function* address — which is why it collides. All three are link-time constants and
the fix is equally valid for each, but the RD must say so: if M1 is const-arrays-only, `lo(&fn)`
keeps its 11-instruction path and ST-9b survives; if it is universal, ST-9b must be re-derived.
The two readings imply different test sets and different closeouts.
→ **Resolution:** state the operand-kind scope explicitly in M1. Recommended: **all three** — the
mechanism is identical and a narrower rule would be arbitrary.

### 🟡 MINOR

| # | Finding | Evidence |
|---|---|---|
| **PF-061** | **The S1 exhibit is not in the population it illustrates.** `slice3a`'s divergence rows route to **#59/#60**, not #58 — so it is not one of the 16. Also the 16 do not all carry one note: it is an 8/8 split between *"constant-foldable program…"* and *"code-size consequence of the unfolded machinery"*. Appears in the RD **and** both roadmaps | `twins.json` slice3a rows: `issue: 59, 60, 59` |
| **PF-062** | **"six further `isAddr` guards reject it" miscounts.** Of the six, only four ICE (`:954, :978, :1760, :2044`); `:698` (store source) and `:1035` (ALU right) are the two **accepting** legal positions — which the sentence hides | verified at all seven sites |
| **PF-063** | **Three off-by-one spec citations.** `F017-operators.md:435-441` → `:435-442`; *"re-derived from `:441`"* → `:442` (line 441 is **blank**); `00-feature-index.md:170-172` → `:171-173`. AC-7 already cites `:442` correctly, and turns the number into a committed test header | verified |
| **PF-064** | **`ctx.constValues` citation points at prose.** `statement-typing.ts:253` is a JSDoc line; the map is declared at `context.ts:81` as `Map<Symbol, ConstValue>`, and `ConstValue.value` is `number \| boolean` (`const-value.ts:21`), not `number`. Conclusion unaffected | verified |
| **PF-065** | **AC-6's "their goldens are regenerated" is vacuous** — neither migration target has a golden, and the RD itself says so at `:107` | `golden/` holds 14 files, no balloon |
| **PF-066** | **Integration Points omits `examples/balloon` and `examples/balloon-color`**, which AC-6 mandates changing. RD-03's parallel section did list its `examples/` dirs | RD-03:330-334 |
| **PF-067** | **S1 is a Should-Have but AC-9 `[CI]` makes its outcome mandatory** — the RD can be delivered without S1 and then hard-fails its own AC | |
| **PF-068** | **M2's scope boundary is ambiguous.** `hi(&X / 2^k)` and word-context `&X / 2^k` sit in neither Must-Have nor Won't-Have; the Won't-Have's phrasing implies the whole `/2^k` family is in scope while the operand admits only `lo()`-wrapped forms | |
| **PF-069** | **M1's IL-legality is stated at two widths** — the constraint table says *"accepted where a byte value is accepted"* (universal); the technical section says the contract *"gains a third legal shape"* (one position). One must own the contract | |
| **PF-070** | **AC-6 is order-dependent on M2 and the RD never says so.** Migrating the sources before the fold is wired makes balloon *grow* past its ratchet, fires `W10171`, and reds the freshness gate — the RD-03 Phase-4 CI-red-by-construction trap | `gen-parity-scoreboard.spec.test.ts:203` |
| **PF-071** | **AC-9 should be `[CI + review]`.** The freshness gate checks structural staleness only and cannot fail on issue attribution — M4 concedes this in its own text. RD-03 relabelled the identical case | |
| **PF-072** | **AC-4's invariant breaks above `$4000`.** *"the assembled byte equals the resolved address ÷ 64"* — for `X ≥ $4000`, `X ÷ 64 ≥ 256`, so a **correct** emission fails the assertion. State it mod 256 (the honest within-bank semantics) or state the `< $4000` precondition | |
| **PF-073** | **AC-1's headline claims `lo(&X)` but its body tests only `hi(&X)`.** The `lo(&X)` half of M1 has no decidable check anywhere | |
| **PF-074** | **The ambiguity register's header is stale** — *"38 items resolved · Last Updated 2026-07-19"* against 43 items and a 2026-07-20 append; the Scope line stops at item 33 | `00-ambiguity-register.md:3-5` |

### 🔵 OBSERVATIONS

| # | Observation |
|---|---|
| **PF-075** | *"character-for-character the hand idiom"* is literally false — the emitted text carries `<` and defensive parens by requirement. Use "byte-for-byte equivalent". |
| **PF-076** | **AC-10 is not the sole proof after all.** `hi(&X)*4 ≡ lo(&X/64)` at every page-aligned address, so the migration is provable in CI from AC-2 + AC-4. The RD undersells its own coverage — worth correcting, since the "Local-only proof of the riskiest change" framing invites a plan to over-invest in VICE. |
| **PF-077** | **AC-7's balloon clause is vacuous after AC-6.** Migrated balloon contains no multiply, so it emits no `W10172` with or without M3. M3 needs a witness with a *user-written* power-of-two multiply. |
| **PF-078** | The "16 of 53" phrasing at `:73-74` collides with "17 of 53" at `:202` until the reader reaches S1. Reword to "16 of the 17 #58-routed rows". |
| **PF-079** | **The M1/M3 coupling is one-directional.** M1 must not ship without M3; M3 ships alone fine. Stated as symmetric, it would forbid a legitimate ordering. Also: `hi(&X >> 6)` keeps `E90001` one character from the blessed idiom. |

---

## Verdict

**✅ PREFLIGHT PASSED — all 27 findings resolved (8 major, 14 minor, 5 observations; 0 critical).**

The RD's **architecture survived intact**. No finding recommended a different mechanism, a
different scope, or a different sequence; scope creep returned exactly one finding (the operand's
unused `offset` field, PF-056/PF-062), and it was resolved by *removing* machinery. Every central
risk claim held under adversarial verification, several reproduced with the repo's own toolchain.

The defects clustered in **test accounting and boundary precision** — which is the honest
signature of a same-session artifact: the author knew what the code did and mis-stated what would
*prove* it. Three findings were errors in the RD's evidence rather than its reasoning (PF-061's
`slice3a` exhibit, PF-062's guard count, PF-063/PF-064's citations), and two — PF-053 and PF-054 —
were the kind only fresh eyes find, which is why both being raised by **two mutually blind
clusters** is the most reassuring result in this report.

Two findings became new GitHub issues rather than RD text, because the RD had described work it
did not own: [#70](https://github.com/blendsdk/blend65/issues/70) and
[#71](https://github.com/blendsdk/blend65/issues/71).

**Ready for `make_plan`.** The plan inherits one deliberately open decision — AR #82's IL carrier
shape — and it is now bounded by three hard constraints rather than two: the position contract
gains exactly one new legal shape (load source), all seven `isAddr` guards must be dispositioned
with `:698`/`:1035` staying *accepting*, and every emission-changing landing must carry its own
ledger regeneration (PF-070).

## Resolution Log

| Finding | Decision | Applied |
|---|---|---|
| PF-053 | Spec-test inventory expanded to a 5-row table (ST-51a, ST-T16, ST-9b, ST-C14 + module header), each with its re-derivation source | RD M3 |
| PF-054 | AC-3 re-pointed at codegen-side ST-9b; the frontend suite demoted to context, with the reason recorded in-criterion | RD AC-3 |
| PF-055 | Security bullet rewritten — no new build-failure mode exists; the wrap is correct and stays #68's | RD Security |
| PF-056 | **`offset` field dropped** from the operand; the measured ACME precedence table added as the reason | RD Technical, AR #87 |
| PF-057 | Both examples named; `balloon-color` migrated *and* given a CI block-byte assertion | RD AC-6, Integration, AR #86 |
| PF-058 | Filed [#70](https://github.com/blendsdk/blend65/issues/70); M5 and AC-9 now name it | RD M5/AC-9, AR #84 |
| PF-059 | Filed [#71](https://github.com/blendsdk/blend65/issues/71); the producer-less state now has an end | RD Won't-Have, AR #85 |
| PF-060 | M1 scoped to all three address-of kinds, with the ST-9b consequence stated | RD M1, AR #83 |
| PF-061 | Exhibit switched to `slice3b`; `slice3a` relabelled as a non-member; 8/8 note split recorded | RD M5 + both roadmaps |
| PF-062 | Corrected to "five ICE, two accepting"; `:698`/`:1035` named as must-stay-accepting | RD M1 |
| PF-063 | `:435-442`, `:442`, `:171-173` | RD M3, Won't-Have |
| PF-064 | Re-cited to `context.ts:81` + `const-value.ts:21`, typed `number \| boolean` | RD Won't-Have |
| PF-065 | Vacuous goldens clause deleted from AC-6 | RD AC-6 |
| PF-066 | Both `examples/` dirs added to Integration Points | RD Integration |
| PF-067 | S1 promoted to **M5** | RD M5 |
| PF-068 | M2 boundary stated: fold applies only under `lo()`; word-context forms keep current paths | RD M2 |
| PF-069 | Technical section made normative — exactly one new legal position (load source) | RD M1 + Technical |
| PF-070 | Ordering constraint added: AC-6 lands only after M2 | RD AC-6 |
| PF-071 | AC-9 relabelled `[CI + review]` | RD AC-9 |
| PF-072 | AC-4 restated `mod 256`, with the ≥ `$4000` reason | RD AC-4 |
| PF-073 | AC-1 now asserts both `hi(&X)` and `lo(&X)` | RD AC-1 |
| PF-074 | Register header corrected to 48 items / 2026-07-20; Scope line made self-maintaining | AR register |
| PF-075 | "character-for-character" → "byte-for-byte equivalent" | RD M2 |
| PF-076 | AC-10 no longer claims sole proof; the CI-provable identity recorded | RD AC-10 |
| PF-077 | AC-7's witness changed to a user-written power-of-two multiply | RD AC-7 |
| PF-078 | Reworded to "16 of the 17 #58-routed rows" | RD overview |
| PF-079 | Coupling restated one-directional | RD M3 |
