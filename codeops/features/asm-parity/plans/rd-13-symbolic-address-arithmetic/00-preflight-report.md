# Preflight Report: RD-13 Symbolic Address Arithmetic (plan)

> **Artifact**: `codeops/features/asm-parity/plans/rd-13-symbolic-address-arithmetic/` — 8 documents, 1,022 lines, 5 phases, 52 tasks
> **Repo ref at scan**: `c4e10bf`, working tree clean · **Iterations**: 2 · **Date**: 2026-07-21
> **CodeOps Skills Version**: 3.11.0
> **Verdict**: ✅ **PASSED** — all 30 findings resolved and applied across 2 iterations
> (opened ❌ BLOCKED on 5 majors; iteration 2 reopened it on 1 critical — see [Iteration 2](#iteration-2))

> ⚠️ **SAME-SESSION REVIEW.** This plan was authored earlier in the same session that reviewed it.
> Counter-measures applied: the 13-dimension scan was fanned out to four independent auditors on a
> different model family (Fable), each given one dimension cluster and told to refute its own
> findings before reporting; the lead kept only the codegen operand/translate seam. Every claim
> bound to an external standard (the frozen spec, ACME 0.97) was re-read or re-measured rather than
> recalled.
>
> **The counter-measures earned their cost.** In iteration 1, three findings came from auditors and
> were missed by the lead; two came from the lead and were missed by every auditor. In iteration 2
> the single **critical** was found independently by *both* auditors and by neither the lead nor any
> of iteration 1's four — it lay in the one direction every scan had shared a blind spot about
> (lowering-side consumers, not translate-side ones). A same-session self-review would have shipped
> it. **A genuinely fresh session remains preferable for any iteration 3.**

## Scan coverage

| Cluster | Dimensions | Owner | Findings |
|---|---|---|---|
| ① document soundness | 1 Ambiguities · 3 Contradictions · 12 Consistency | auditor | 6 |
| ② grounding — spec / tests / examples / ledgers | 2 · 13 | auditor | 6 |
| ②b grounding — codegen operand + translate seam | 2 · 13 | lead | 8 |
| ③ delivery | 4 Completeness · 7 Testability · 11 Ordering | auditor | 5 |
| ④⑤ risk & fit | 5 Deps · 6 Feasibility · 8 Security · 9 Edges · 10 Creep | auditor | 6 |

Merged, deduped and renumbered to a single `PF-NNN` sequence. **Iteration 1**: 5 major · 14 minor ·
8 observations (PF-001–PF-027). **Iteration 2** added 1 critical · 1 minor · 1 observation
(PF-028–PF-030). Total **30**.

## Codebase grounding — what verified clean

The plan's empirical spine is unusually solid, and this is worth recording so it is not re-audited.

- **Every `file:line` reference checked (~40 of them) is exact.** `grep isAddr(` returns *exactly*
  the seven guards the inventory names — the seam list is complete, not merely correct. The three
  silent-failure holes exist and fail as described.
- **Codegen is unchanged since `8f71432`**, the ref `02-current-state.md:3` records.
- **The spec quote is verbatim.** `spec/evaluations/F017-operators.md:442` says what 03-02 §1 says
  it says; OP-5 is genuinely its rule name (`:433`); `spec/00-feature-index.md:226` corroborates.
- **Every ledger count is measurement-exact**: 15 budget programs, `balloon` = 318 B, 53 routed
  rows, exactly 17 carrying `"issue": 58`, splitting 8 + 8 + 1, 14 goldens + 14 twins with
  `balloon` in neither. No fourth `hi(&X) * 4` anywhere in `examples/`.
- **The byte/cycle table (03-01 §7) is arithmetically exact** — 18 → 7 → 5 bytes, 24 → 10 → 6
  cycles — and the lead traced the emission end to end (`emitPoke:2486` → `translateStore:716` →
  `bringValueIntoRegisters:982` → `leftIntoA`) to confirm both projections fall out of the two arms
  the plan adds. `balloon` −11 B / −2 B follow.
- **ACME 0.97 re-measured live**: `#<(sprite / 64)` → `$24`; `#<(sprite+3 / 64)` → `$00`. The
  precedence trap is real and the no-offset-field defence against it is sound.
- **AR #88's justification is verified in code**, not merely plausible: `translateStore:698-714`
  really writes both `symHome(target,0)` and `symHome(target,1)` unconditionally, and
  `rightSource:1040` really derives `byteSelect` from `byteIndex`. The rejected option (b) would
  have failed silently in both accepting guards.
- **Nine probe programs were built** against the current compiler; `02-current-state`'s three
  measured rows reproduce precisely.
- **Task arithmetic**: 6+14+12+11+9 = 52, consistent across every document. AR numbering 88–96 is
  continuous with the requirements-stage register. All intra-plan links resolve. The
  `08-closeout.md` forward link matches the rd-03/rd-05 convention — **not** a defect.
- **Scope creep: none.** Everything beyond the RD's letter is user-ratified in the register and
  load-bearing.

---

## 🟠 MAJOR findings

### PF-001 · ST-9b cannot discharge AC-3 — the replacement proof fails the same way the original did

**Dimension**: 7 Testability · 4 Completeness · **Source**: cluster ③, lead-verified

`07-testing-strategy.md:63-74` and task 2.6 stake AC-3 on: *"the trailing plain-store site still
names `0sc2`. If M1 dropped the claim, that site would collect `0sc0` and this test fails loudly."*

It cannot fail at all. A plain-store `&` site lowers with `direct = true` (`lower.ts:1644` for
assignment; `:371`, `:522`, `:1079`, `:2518` for the other store positions), and the `direct` return
at `:1870` hands back the bare address — so the emitted IL is `store &Main_helper, __var_Main_vec`.
**The claimed slot's name never appears in the IL text.** There is nothing to assert.

Worse, the drift is not caught elsewhere either: if M1 dropped the claims, the trailing site would
collect `0sc0`, which is also word-typed, so `claimResultSlot`'s byte-size check (`:1395-1400`)
passes and no ICE fires. The IL is byte-identical either way.

This is the **second** failed proof for AC-3 — the RD's original named a frontend suite that could
not import codegen and had no `&` fixture at all (07 §"ST-9b carries AC-3" recounts this). The
replacement inherits the flaw in a new form.

**Recommendation** — make the trailing site a *homing* site, e.g. `let w: word = &helper + 2;`. ALU
arithmetic lowers via `lowerUnary:1503` with `direct = false` and emits
`store &Main_helper, __frame_Main_main_0sc2` into the IL text — exactly the shape ST-9
(`lower-address-of.spec.test.ts:140-155`) already asserts for `0sc0`. The slot name becomes
observable and the assertion becomes writable. Update 07 §"ST-9b carries AC-3" and task 2.6 together.

---

### PF-002 · The `indexIntoX` exclusion regresses a compiling program to an ICE

**Dimension**: 9 Edge Cases · 13 Migration · **Source**: cluster ④⑤, lead-verified **empirically**

`03-01 §5c:191-193` states: *"`indexIntoX` (`:1760`) is deliberately **not** given an `addrByte`
arm: an address byte as an array index has no meaning, and its existing trailing ICE stays loud."*

Against `01-requirements.md:79`: *"**No program that builds today stops building.**"*

The lead built the counter-example. `table[lo(&BALLOON)]` compiles today and emits:

```
LDA #<__data_Main_BALLOON        ; 2
STA __frame_Main_main_0sc0       ; 3
LDA #>__data_Main_BALLOON        ; 2
STA __frame_Main_main_0sc0+1     ; 3
LDX __frame_Main_main_0sc0       ; 3
LDA __var_Main_table,X           ; 3
STA $D020                        ; 3      = 19 bytes
```

The index reaches `indexIntoX` as a temp with a memory home, handled at `:1773-1776`. After M1,
`emitLo` returns `addrByte` raw, `indexIntoX` has no arm, and it falls to the trailing
`iceUnsupported` at `:1786`. **The program stops building.**

The stated justification is also wrong on its own terms. An address byte is an ordinary byte value,
and a block number indexing a frame table is precisely the game idiom this project exists to serve.
The coverage is inconsistent by accident, too: a word-element array works (index routes through
`scaleIndex` → `mul` → `leftIntoA`, which gains an arm) and a >256-byte array works (via the
`byteRefOf` zero-extension recursion) — only the commonest case, a small byte array, ICEs.

**Recommendation** — give `indexIntoX` an `addrByte` arm (`LDX` Immediate via `instrOperandFor`,
mirroring its `isImmediate` arm at `:1764-1767`). One line, and it is also the *largest* win in the
plan: 19 bytes collapse to 8 — `LDX #<sym` · `LDA table,X` · `STA $D020` — which is exactly what a
6502 developer writes by hand. Add index position to ST-13g. Per the Prime Directive, *"a
restriction that forces un-idiomatic user code is itself the bug."*

---

### PF-003 · ST-13j's promised oracle cannot exist — boing-ball's four pointers are runtime-computed

**Dimension**: 7 Testability · 2 Implicit Assumptions · **Source**: clusters ② and ③ independently, lead-verified

`03-02 §2:105-113`, `07:29` and task 4.2 promise a **build-only** ACME test whose oracle is the
**symbol map**, asserting *"assembled `$07F8`..`$07FB` bytes == `b, b+1, b+2, b+3`"* — called
*"the one neither balloon carries"* and the property RD-15 depends on.

Those four bytes do not exist in the PRG. `examples/boing-ball/main.blend:94-99`:

```blend65
let step: byte = frame * 4;
let p: byte = base + step;
poke($07F8, p);
poke($07F9, p + 1);   // …and $07FA, $07FB
```

`frame` animates, so the pointers are computed at **runtime**; `$07F8`–`$07FB` are VIC pointer RAM
outside the load image. The only link-time byte is the single `LDA #<(BALL / 64)` immediate that
initializes `base`. No build-only test can read those addresses — only the VICE tier can, and VICE
is excluded from CI (AR-27).

**Recommendation** — split the criterion honestly: **CI half** — the `base` initializer's assembled
immediate equals `(symbolMap(BALL) / 64) & 0xFF`, plus the structural `ADC #1/#2/#3 → STA
$07F9..$07FB` chain, proving the migrated value is still usable as a block base; **local half** —
move the four-pointer memory assertion beside task 5.5's VICE run. Correct the oracle column in
03-02 and the tier in 07:29 so the test author does not discover this mid-phase.

---

### PF-004 · The fold's `k ≥ 8` half has no test, and a concrete silent-regression mechanism exists

**Dimension**: 7 Testability · 9 Edge Cases · **Source**: lead

AR #89 deliberately chose `k = 1..15` over `k = 1..7`. Every ST case that exercises the fold uses
`k = 6` (`/64`): ST-13d, ST-13e, ST-13f, ST-13i and ST-13j. ST-13h tests only the *rejected* ends
(`/1`, `>>0`, `/40`, `>>16`). The impl-test row *"`symbolText` renders … for `k = 1..15`"* tests the
**printer**, not the fold. Nothing exercises a folded `k ≥ 8`.

The mechanism that makes this bite: the only existing `log2Exact` call site is `translate.ts:1581` —
`log2Exact(constSide.value & 0xff)`. `log2Exact` itself is unmasked and correct (`:2330-2341`,
verified — it also correctly rejects 0, so `lo(&X / 0)` cannot fold). But an implementer relocating
that function in task 3.1 and writing the fold beside it in task 3.8 would plausibly carry the byte
mask over. With the mask, every divisor ≥ 256 becomes 0, `log2Exact` returns null, and the fold
**silently falls through to today's runtime divide — still emitting `W10171`**, indistinguishable
from the designed fall-through. Nothing in the plan fails.

**Recommendation** — add a `k ≥ 8` case to ST-13d or ST-13h (`lo(&X / 256)` → `#<(sym / 256)` and
`lo(&X / 32768)` → `#<(sym / 32768)`), and state in 03-01 §4 that the divisor is a **word** and must
not be byte-masked. The two degenerate ends were explicitly chosen; they should be tested.

---

### PF-005 · The Prime-Directive hand-review never reaches the code this RD produces

**Dimension**: 3 Contradictions · 4 Completeness · **Source**: cluster ①, escalated by the lead

Task 4.10 is the plan's only qualitative gate: *"Hand-review every regenerated golden hunk against
what a 6502 developer would write. A divergence is a defect."*

By the plan's own analysis no committed golden can change in **any** phase: only `balloon`'s
emission moves, and `balloon` has no golden (`07:84`; `00-index:20,22`; tasks 2.14 and 3.12 both
assert the 14 goldens byte-identical). The lead verified the inventory — 14 goldens, 14 twins,
`balloon` in neither; its hand twin lives at `examples/balloon/balloon.asm`, outside the golden
directory. Phase 4 edits only three non-corpus demo sources. Phase 2 has no hand-review at all.

So **the one program whose assembly this RD rewrites is never read by a human**, in a project whose
Prime Directive makes output parity the benchmark and requires goldens to *"read like a competent
asm dev wrote them."* Task 4.10 as written is vacuous; task 4.11 does not even carry the
byte-identity confirmation that 2.14 and 3.12 do.

**Recommendation** — re-point the review at the artifact that actually moves: add to tasks 2.14 and
4.9 a hand-review of `balloon`'s regenerated assembly against `examples/balloon/balloon.asm` (its
committed hand twin — the ideal comparison already exists), and re-scope 4.10 to *confirm* zero
committed-golden diffs, mirroring 2.14/3.12. Reword `07:84` to "byte-identical in every phase".

---

## 🟡 MINOR findings

| # | Finding | Source |
|---|---|---|
| **PF-006** | *"Today's behaviour"* for the rejected forms is enumerated incompletely. Measured: `lo(&B >> 16)` emits **`W10174`** ("Shift amount 16 >= type width") before its `E90001` — AR #89 names only `E90001` and `W10171`. And `hi(&B / 64)` is a **hard `E90001`**, not the slow divide path *"keeps today's paths"* implies. Separately, ST-13h's *"byte-identical to today's emission"* is unsatisfiable for `>> 16`, which has **no** emission today. Fix: name W10174; split the ST-13h row so the `>>` edge asserts the error and only the `/` edge asserts byte-identity | lead + ④⑤ |
| **PF-007** | The M2 fold's normative pattern (`03-01:114-116`) says `right = <power-of-two constant>` for **both** operators, but for `>>` the right operand is a *count* — `lo(&X >> 6)` has right = 6, not a power of two — so the pattern as written rejects ST-13e's own case and AR #89's `>> 0`. Also unresolved: whether a const-evaluated identifier folds as a `>>` count. AR #90's logic cuts *harder* here — an unfolded `/BLOCK` is merely slow, an unfolded `>>SHIFT` is a hard ICE. Fix: restate per operator; recommend accepting named counts | ④⑤ |
| **PF-008** | The *"referenced by nothing, confirmed by grep"* claim (`02:137-139`, `03-02:101-103`, AR #93) was true at `8f71432` and falsified by `2beb0d1` — `examples-coverage.json` names both demos, and `scripts/gen-boing-ball.mjs` names boing-ball. `02` declares itself the complete seam inventory yet omits both the manifest **and** `examples/boing-ball` (which landed at `85d0413`, after its baseline). Tasks 4.1/4.2 already depend on the manifest but never name its path. Fix: refresh `02`'s baseline and seam list; past-tense AR #93's evidence; reword *"first CI signal of any kind"* → *"first suite that compiles it"* | ①②④⑤ (3-way) |
| **PF-009** | Phase 5's declared RED (`07:104`, the `twins.json` structural check) cannot go red: tasks 5.1/5.2 fix the data **before** 5.3 writes the check. It is trivially red today (17 rows carry `issue: 58`). Also, 5.3's exception — *"except the rows belonging to #58's own remaining halves"* — is unspecifiable (17 = 1 re-authored + 16 re-routed leaves no residue), and 5.3 names no host file (`twin-manifest.spec.test.ts` exists). Fix: reorder 5.3 first with an observed RED; assert *"no row carries `issue: 58`"*; name the host | ①③ |
| **PF-010** | `07:94` specifies impl tests for the three ICE guards (*"each fires on a deliberately malformed operand"*) but **no task writes them** — 2.12 covers only `addrByteOf`/`isAddrByte`/`instrOperandFor`. Task 2.1 proves the guards *unreachable*, never that they *fire*. AR #92's deliverable can land with all 52 boxes checked and its only positive test missing. Fix: extend 2.12 | lead + ③ |
| **PF-011** | Task 2.13's ST-C15 seed — *"break ST-C15's alignment assertion"* — is assertion-side, so it proves only that the test executes. The hazard the whole 00-index §"one hazard" section stakes on ST-C15 is **code-side**: a path reaching a byte-select without `lowerAddressOf`, losing the mark at `lower.ts:1863`. Fix: seed by dropping the `:1863` mark, rebuild, watch `addr % 256 == 0` fail, restore | ③ |
| **PF-012** | `symbolExpr`/`isSymbolExprOperand` must be added to **three** hand-maintained re-export lists — `core/src/instr-model/index.ts:33-42`, `codegen/src/instr/operand.ts:11-22` (shim), `codegen/src/instr/index.ts:25-35` — and task 3.2 names none. Only the shim is build-forced (`translate.ts:44` imports from it); TS2366 does **not** reach re-export lists, so the two barrels can be silently omitted, leaving the variant un-narrowable by `@blend65/core/platform` consumers. Repo quality profile declares `lenses: [api-surface]`. Note this *strengthens* AR #88: the IL side needs no barrel change, since `il/index.ts:21` deliberately omits `addrOf`/`isAddr` too | lead |
| **PF-013** | `03-01 §3` and `07:93` both claim the `log2Exact` move carries *"its existing unit coverage"* / *"the existing cases, relocated"*. `grep -rn "log2Exact" packages --include=*.test.ts` returns **nothing** — it is module-private and reached only through `translateMul`. There are no cases to relocate. Fix: specify first-time direct coverage on export (0, 1, 2, 64, 256, 32768, 40, negative) — which also discharges PF-004 | lead |
| **PF-014** | `02:113`'s *"Grep-confirmed: those four are the entire footprint"* misses a fifth W10172 site: the comment at `translate.spec.test.ts:457` — *"// mul by a constant power-of-two → shift sequence; W10172 emitted."* — directly above ST-T16. Task 1.2 updates the title and assertion but not the comment, which would then state the opposite of what the test pins. Fix: add `:457` to task 1.2 | ② |
| **PF-015** | Four cited line ranges are off at a boundary. The consequential one: ST-C14 is cited as `balloon.spec.test.ts:166-181` in both `03-02` and task 4.3, but the pointer subsequence is `:169-181` — `:166-167` are the *embed-appears-exactly-once* assertions, which must not move (they guard the Prime Directive's "never duplicate bytes in RAM") and are absent from 07's "must NOT change" table. Also: ST-T16's text assertion is `:467-469` not `:466-469`; `balloon-color`'s comment is `:18-20` not `:19-21`; its header is `:3-6` not `:2-6` | ② |
| **PF-016** | `01-requirements.md:75-78` grounds its no-injection claim on symbol names coming *"never from source text"*. False — `constDataSymbol` interpolates the source module name and identifier verbatim (`lower.ts:1875-1880`), as does `frameSymbol`. The conclusion survives for a different reason: the identifier grammar `[A-Za-z_][A-Za-z0-9_]*` excludes every ACME-significant character. Fix: ground the claim in the charset, so a future grammar change cannot silently invalidate it | ④⑤ |
| **PF-017** | `01-requirements.md:50-51` says the AC table's *"Text is the RD's; this table adds **only** the phase"*, but AC-6 is expanded to three examples (AR #96) where the RD says *"both"*. Unlike the other two divergences it is neither in the corrections table nor in task 5.4, so the RD will permanently understate what closeout claims to discharge. Fix: add it to 5.4, or annotate the row and drop the "adds only" claim | ① |
| **PF-018** | Task 3.1 puts `log2Exact` at `packages/codegen/src/bits.ts`. `codegen/src/` currently holds only `index.ts`, `index.spec.test.ts` and three directories — every module in the package lives under a subdirectory. Fix: `src/util/bits.ts` preserves both the `il/`↛`instr/` layering rule and the package's own layout | lead |
| **PF-019** | M3's justification never disposes of `spec/04-expressions-operators.md:75,78`, which tags "⚠️ W10172" on the tier *"one operand is a constant power of 2 or small constant"* with no carve-out — the first hit anyone gets greping `spec/` for W10172. It is resolvable (OP-5 is the specific rule; a pure power-of-2 multiply emits shifts with no adds), and D3 forbids editing the spec, but leaving it undisposed exposes the whole conformance argument to a one-line rebuttal. Fix: one paragraph in 03-02 §1 | ② |

## 🔵 Observations

| # | Note |
|---|---|
| PF-020 | `instrOperandFor`'s home file is never named (task 2.4). It maps an IL type to a core type, so it belongs under `instr/` — one clause settles it |
| PF-021 | *"The peephole catalog"* (`03-01 §6`) does not exist — `optimizeInstr` is a v1 thin passthrough with no rules (`peephole.ts:145-157`). Reassuring rather than wrong: **nothing** downstream of translate inspects operand kinds, which is why the new variant's blast radius really is as small as the plan claims |
| PF-022 | ST-C15's comment (`balloon.spec.test.ts:189`) — *"the sprite pointer is exactly the high byte times four"* — motivates the check through the idiom Phase 4 retires. The identity still holds, so it is stale, not wrong; worth one line in task 4.3's neighbourhood saying it stays deliberately |
| PF-023 | Phases 2 and 3 place behaviour-neutral type scaffolding (2.2–2.4, 3.1–3.4) before their spec tests, deviating from the literal rule at `99:14`. RED stays genuine — nothing *produces* the new operands until 2.8/3.8 — but one acknowledging line would stop an executor or phase reviewer tripping on it |
| PF-024 | The "assembled byte" oracle for ST-13d/e/f is really a scan for the `LDA` immediate feeding the `STA` (`A9 xx 8D F8 07`) in `result.binary`. Writable — `testing/balloon.ts` exposes `symbolMap`, `asmText` and `binary` — but no existing helper reads a byte "at an address" outside the VICE tier, and the plan never names the mechanism. One sentence prevents a weakening to the operand-presence check `07:34` forbids |
| PF-025 | `boing-ball` retains a user-written runtime power-of-two multiply after migration (`frame * 4`, `:94`) — a natural real-program witness for AC-7 that `03-02 §1` overlooks while arguing ST-13c is needed because migrated `balloon` has none |
| PF-026 | RD-16 / [#72](https://github.com/blendsdk/blend65/issues/72) is unmentioned, yet it will overturn `03-02:115-116`'s *"both stay outside the parity corpus"* for `boing-ball`. No cycle — RD-16 is sequenced after RD-13 — but one hand-off sentence keeps a future reader from treating out-of-corpus status as an invariant |
| PF-027 | `symbolExpr`'s `"high"` byteSelect has no producer (`emitHi` gains no fold) and is exercised only by rendering tests. Acceptable as the symmetric union shape AR #88 chose; noted so it is not mistaken for dead code later |

## Resolutions

All 27 iteration-1 findings ruled by the user on 2026-07-21 and applied to the plan in the same session. Three
required a user decision on substance; the rest were accepted as recommended.

| Finding | Ruling | Where it landed |
|---|---|---|
| **PF-001** | Fixed — ST-9b's trailing site becomes a **homing** `&` (`let w: word = &helper + 2;`) so the slot name reaches the IL text | 07 §"ST-9b carries AC-3"; task 2.6 |
| **PF-002** | **User decision** — give `indexIntoX` an `addrByte` arm (rejected: keep the exclusion, drop the guarantee). Recorded as **AR #97** | 03-01 §5d; 01 in-scope; task 2.11; ST-13g |
| **PF-003** | **User decision** — split CI / VICE (rejected: all-VICE; drop the row). Recorded as **AR #98**; adds **ST-13k** | 03-02 §2; 07 ST-13j/ST-13k; tasks 4.2, 5.5 |
| **PF-004** | Fixed — ST-13h gains `k = 8` and `k = 15` folds; the "divisor is a word, do not byte-mask" warning is explicit | 03-01 §4; 07; tasks 3.6, 3.8 |
| **PF-005** | Fixed — the hand-review re-points from golden hunks (which cannot exist) to `balloon`'s assembly against its committed twin, in **both** byte-moving phases | 00-index; 03-02 §3; tasks 2.15, 4.10, 4.11 |
| **PF-006** | Fixed — `W10174` named; `hi(&X / 2^k)` stated as a hard error; ST-13h's `>>` edge split from the `/` edge | AR #89; 01 out-of-scope; 07 |
| **PF-007** | Fixed — the fold pattern restated per operator; const-evaluated `>>` counts accepted | 03-01 §4; task 3.8 |
| **PF-008** | Fixed — baseline refreshed to `c4e10bf`, the manifest and `boing-ball` added to the seam inventory, AR #93's grounds past-tensed | 02; 03-02 §2, §2.1; AR #93 |
| **PF-009** | Fixed — the structural check moves to **task 5.1** and is watched failing on all 17 rows; the unspecifiable exception clause is gone; host suite named | 03-02 §4; tasks 5.1–5.3 |
| **PF-010** | Fixed — the three guards' firing tests assigned | task 2.13; 07 impl table |
| **PF-011** | Fixed — ST-C15's seed is now code-side (drop the `:1863` mark) | task 2.14; 07 traps table |
| **PF-012** | Fixed — all three re-export lists named, with the note that TS2366 reaches none of them | 03-01 §2; task 3.2 |
| **PF-013** | Fixed — first-time direct coverage replaces "the existing cases, relocated" | 02; 03-01 §3; task 3.10; 07 |
| **PF-014** | Fixed — `translate.spec.test.ts:457` added as the footprint's fifth site | 02; 03-02 §1; task 1.2 |
| **PF-015** | Fixed — all four ranges corrected; `:166-167` added to the must-not-change table | 02; 03-02; 07; tasks 4.3, 4.6 |
| **PF-016** | Fixed — the no-injection claim re-grounded in the identifier charset | 01 §Security |
| **PF-017** | Fixed — AC-6's expansion added to the corrections table and to task 5.4 | 01; 03-02 §5; task 5.4 |
| **PF-018** | Fixed — `src/util/bits.ts`, preserving codegen's directory-only layout | 03-01 §3; task 3.1 |
| **PF-019** | Fixed — `spec/04-expressions-operators.md:75,78` cited and disposed of | 03-02 §1 |
| **PF-020 – PF-027** | Recorded; the actionable ones folded in — `instrOperandFor`'s file (task 2.4), the peephole/validate blast-radius facts (03-01 §6), ST-C15's comment left deliberately (03-02 §2), the scaffolding-first note (99 header), the binary-scan mechanism (07), boing-ball's surviving `frame * 4` (03-02 §1), the RD-16 hand-off (03-02 §2), `symbolExpr`'s producer-less `"high"` (03-01 §6) | various |

## Iteration 2

Two fresh auditors re-scanned after the fixes: one verifying each major fix **against the code**,
one regression-scanning the plan cold. PF-001, PF-002, PF-004 and PF-005 were confirmed fixed —
ST-9b's corrected program was lowered through the real frontend and emits
`store &Main_helper, __frame_Main_main_0sc2` exactly as claimed, and `#<(sym / 256)` /
`#<(sym / 32768)` were assembled on ACME 0.97. Three findings survived.

### PF-028 · 🔴 CRITICAL — the consumer inventory missed `materialise` → `const` → `translateConst`

**Found independently by both iteration-2 auditors.** `03-01 §5` audits the *translate-side*
consumers exhaustively and never audits the *lowering-side* positions that wrap a result in `const`.
Only a store source takes a lowered operand raw; every other expression position funnels through
`materialise` (`lower.ts:2659-2666`), which passes temps through and wraps everything else — and
`translateConst` (`translate.ts:655-658`) ICEs on a non-immediate source.

Today `emitLo`/`emitHi` return a **temp**, so the funnel is transparent. After task 2.8 they return
a bare `addrByte` and all **ten** funnel positions regress. Verified by building the current
compiler: `let b: byte = lo(&BALLOON);` and `v = hi(&BALLOON);` both compile today.

Two consequences, both load-bearing. It breaks `01:89`'s *"no program that builds today stops
building"* from **Phase 2**, silently — no existing test uses a byte-select in a `let` or
assignment, so the full verify stays green and the regression reaches users. And task **4.7**
writes `let base: byte = lo(&BALL / 64);`, exactly a materialised initializer, so Phase 4 could not
have gone green and ST-13j's oracle could never have existed.

Sharpest detail: `03-01 §4` cited `translateConst`'s guard as *reassurance* that the direct return
keeps the operand away from it. The lowering side routes it back in.

**Resolved** — user chose one `isAddrByte` arm on `translateConst` (rejected: pass `addrByte`
through `materialise`, which widens the reachable surface; narrow M1 to store positions, which
forfeits AC-6's third migration). Recorded as **AR #99**; new task **2.12**; ST-13g extended.

### PF-029 · 🟡 MINOR — the widened `>>` named-const acceptance had no test

PF-007's fix extended const-identifier resolution to **both** operators, but ST-13i exercised
`/BLOCK` only. The `>>` half is where it matters more — an unresolved named divisor is merely slow,
an unresolved named **count** is a hard `E90001`. **Resolved**: ST-13i now covers both spellings.

### PF-030 · 🔵 OBSERVATION — ST-13d/e had no named host suite or build mechanism

Task 3.5 placed them "in the harness tier" while the sibling tasks name both file and builder.
`testing/balloon.ts` cannot serve — it compiles the committed balloon, which carries no fold until
Phase 4. **Resolved**: task 3.5 now names `symbolic-address.spec.test.ts` and the inline-source /
temp-dir mechanism, and forecloses adding a probe to `examples/` (which would owe the coverage
manifest a tier).

---

**Plan deltas across both iterations**: 52 → **54 tasks** (Phase 2 gains the `indexIntoX` and
`translateConst` arms); AR #88–#96 → **#88–#99**; Phase 5 reordered so its RED can fail; ST-13k
added on the local VICE tier; ST-13g grown from four operand kinds to four kinds **plus** three
consumer positions.

## Relationship to the Ambiguity Register

No finding re-litigates a resolved AR item. Three findings *strengthen* a register decision by
supplying evidence it lacked (PF-012 → AR #88; PF-004 → AR #89; PF-002 → AR #92's rationale applied
to a site the register did not consider). PF-006, PF-008 and PF-017 record that AR #89, AR #93 and
AR #96 respectively rest on premises that have since drifted — the decisions stand, their stated
grounds need refreshing.
