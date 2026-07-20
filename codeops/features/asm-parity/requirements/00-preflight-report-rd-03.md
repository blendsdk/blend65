# Preflight Report: RD-03 — Placement

> **Status**: ✅ PASSED — all 29 findings resolved (2 critical, 7 major, 18 minor, 2 observation); fixes applied, iteration 2 verified
> **Iteration**: 1 (first scan)
> **Artifact**: requirements document at `requirements/RD-03-placement.md`
> **Codebase Grounded**: 30+ source files examined, 12 references verified, 4 live compiler builds + 6 ACME assemblies
> **Scan ref**: `2dcc2e3` (branch `feat/asm-parity`)
> **Last Updated**: 2026-07-20

**Same-session review**: NO — the RD was authored in a prior session. Bias risk is normal.

## Codebase Context Summary

**Tech Stack**: TypeScript ESM monorepo (Yarn v1 workspaces, Turborepo, Vitest), AOT compiler
targeting 6502. **Architecture**: Lexer → Parser → Analyzer → SFA → IL → Codegen → ACME emitter;
the R15 boundary (`frontend`/`language-server` must not import `codegen`) is load-bearing.

**Key files examined**: `packages/core/src/instr-model/stream.ts`,
`packages/codegen/src/il/lower.ts`, `packages/codegen/src/instr/{serialize-acme,print-instr}.ts`,
`packages/compiler/src/api/build.ts`, `packages/core/src/report/*`,
`packages/test-harness/src/{testing/balloon,testing/observables,twins.spec.test,golden-layout.spec.test}.ts`,
`packages/test-harness/test/golden/{budgets,twins}.json`, `spec/{11-memory-model,12-intrinsics,13-data-inclusion,future-considerations}.md`.

### Measured ground truth

Every figure below was produced by running the real compiler and the real assembler during this
scan — none is reasoned about.

| Build | Bytes | `__data_Main_BALLOON` |
|---|---|---|
| balloon today | 677 | `$0A67` |
| rewritten (63 pokes deleted, `hi(&BALLOON)*4`) | 312 | `$08FA` |
| rewritten + `!align 255, 0` | **318** | **`$0900`** |

Sprite block `$0900 / 64 = 36` = `hi($0900) * 4` ✅ — the mechanism works end to end.
Against the twin's 251 bytes: **2.70× → 1.27×**. Padding is **6 bytes**.

**ACME 0.97 behaviour** (verified empirically): `!align 256, 0` assembles **silently and aligns
nothing** (ACME's form is `!align andValue, equalValue` — a bitmask, not a modulus);
`!align 255, 0` is correct; `!align 256` is a syntax error. Default pad fill is **`$EA`**;
`!align 255, 0, 0` gives `$00`.

### Method

13-dimension scan fanned out across 5 clustered `preflight-auditor` dispatches on a different
model family (① document soundness · ② grounding · ③ delivery · ④ risk · ⑤ fit), returning 52
raw findings, deduped to 29. One hardening challenger then reviewed the whole CRITICAL/MAJOR
batch without being told the lead's picks; it confirmed 8, demoted 3, and contributed two
resolutions nobody proposed. Every load-bearing claim was independently re-verified by the lead
before being recorded here.

### Summary by Dimension

| # | Dimension | Findings | Highest |
|---|-----------|---------|---------|
| 1 | Ambiguities | 3 | 🔴 |
| 2 | Implicit Assumptions | 5 | 🟠 |
| 3 | Logical Contradictions | 5 | 🟠 |
| 4 | Completeness Gaps | 6 | 🔴 |
| 5 | Dependency Issues | 2 | 🟠 |
| 6 | Feasibility Concerns | 2 | 🟠 |
| 7 | Testability | 4 | 🔴 |
| 8 | Security Blind Spots | 3 | 🟠 |
| 9 | Edge Cases | 4 | 🟡 |
| 10 | Scope Creep | 2 | 🟠 |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 4 | 🟡 |
| 13 | Codebase Alignment | 8 | 🔴 |

### Summary by Severity

| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 2 | ✅ all resolved |
| 🟠 MAJOR | 7 | ✅ all resolved |
| 🟡 MINOR | 18 | ✅ all resolved |
| 🔵 OBSERVATION | 2 | ✅ all resolved |

---

## 🔴 CRITICAL

### PF-001: The trigger rule is undefined, and the RD's own evidence cannot tell the two readings apart 🔴 CRITICAL

**Dimension:** 4 Completeness / 13 Codebase Alignment · **Location:** RD-03:65-71 (M1), :140-143
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:1022-1029` vs `:1807`; `packages/test-harness/test/golden/slice7b.asm.golden:89,91`; `examples/slice8/main.blend:27-28`

M1 aligns an array whose address is taken "via `&`". The technical section says that set is
"computed **before serialization**" — i.e. over IL. But at IL, `&X` and an ordinary
**by-reference array argument** are the same operand: the by-ref path emits the same `addrOf`
constructor that `lowerAddressOf` produces for `&X`. The committed proof:
`slice7b.asm.golden:89,91` emits `LDA #<__data_Game_TABLE` / `LDA #>__data_Game_TABLE` from plain
`sum(TABLE, len)` — **byte-identical to the instruction pair RD:143 cites as its verification
that `&` lowers correctly**.

Consequence under the IL reading: `slice7b` and `slice8b` align → AC-2's byte-identical
requirement fails → per AR #65's own per-fixture measurements the corpus takes **+159 and +276
bytes** → M4's stop condition trips. A second trap sits behind it: `slice8` contains
`pokew($FFFE, &onIRQ)`, so an `addrOf` scan unfiltered by symbol kind would try to page-align
**function labels**. Only the syntactic reading makes AR #65's "costs zero on today's corpus" true.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Pin M1 to the **AST unary-`&` set**, filtered to `sym.kind === "constant"`; by-ref params and function address-of explicitly excluded; add `slice7b`/`slice8b`/`slice8` as named negative controls in AC-2 | Matches AR #65's own rationale and M1's intent; costs zero on the corpus | Needs the rule stated precisely enough that an implementer cannot drift |
| B | Adopt the IL reading and re-derive M4/AC-2/AR #65 | Internally consistent | Corpus grows +435 B; contradicts M4's stop rule and AR #65's decision |

**Recommendation: Option A.** The challenger added the implementation detail that makes it free:
`lowerAddressOf` is *only* reached from real `&` expressions (`lower.ts:1042` guards with
`isAddressOfExpr`; the by-ref path never calls it), so marking inside `lowerAddressOf` when
`sym.kind === "constant"` implements the AST reading **with no separate AST pass**. The RD should
name that hook.

**Confidence:** High — measured, and the challenger independently confirmed. **Hardening:** challenger CONFIRMED at CRITICAL.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-002: AC-5 is unachievable — balloon's observable table is shared with the twin tier 🔴 CRITICAL

**Dimension:** 7 Testability / 13 Codebase Alignment · **Location:** RD-03:218-221 (AC-5), :89-91 (M5)
**Codebase Evidence:** `packages/test-harness/src/testing/balloon.ts:73,79`; `src/testing/observables.ts:5-12,38-41`; `src/twins.spec.test.ts:87,104-130`

AC-5 promises balloon's "existing observable set … **passes unchanged**". Two of its ten checks
are welded to the old staging site:

```ts
{ address: 0x07f8, value: 13, note: "sprite pointer: block 13 = $0340" },
{ address: 0x0340, bytesFile: "examples/balloon/balloon.bin", note: "staged sprite image" },
```

After M5 the pointer is **36** and the image lives at `$0900`. Worse, the **same table object** is
the twin-equivalence contract, consumed against `examples/balloon/balloon.asm`
(`twins.spec.test.ts:87`), which still stages at `$0340`. One table, two irreconcilable
expectations. And the fix-in-place is forbidden by the module's own doctrine
(`observables.ts:5-12`): *"implementation-coupled assertions — allocator-chosen addresses — stay
in the fixture suites by construction"* — post-RD the sprite address **becomes** allocator-chosen.
`Check` also has no symbol-relative form. AC-3 ("asserted against the symbol map") silently
contradicts AC-5 on exactly these rows.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Shrink the shared contract: position/enable/colour/flags stay shared; pointer + image-block checks move into balloon's own fixture suite, resolved from the symbol map. Add a Must-Have for the split | Is what `observables.ts`'s stated design already dictates | Shared twin contract gets smaller — must be stated deliberately, not by accident |
| B | Extend `Check` with a symbol-relative address form so the table stays shared | Keeps one table | Fights the design twice: twin symbol names differ, and it weakens the source-mandated-only invariant |

**Recommendation: Option A.** The challenger picked it independently and for the stronger reason:
this is not the pragmatic fix, it is the architecturally required one.

**Confidence:** High — verified. **Hardening:** challenger CONFIRMED at CRITICAL.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

## 🟠 MAJOR

### PF-003: M6/AC-9 has no substrate, and the summary layout it extends is pinned by frozen spec 🟠 MAJOR

**Dimension:** 6 Feasibility / 13 Codebase Alignment · **Location:** RD-03:93-95 (M6), :230-231 (AC-9), :154-157
**Codebase Evidence:** `packages/compiler/src/api/build.ts:103`; `packages/core/src/report/resource-report.ts:41-46,63`; `spec/11-memory-model.md:201-229`; `packages/core/src/report/render-report-terminal.golden.spec.test.ts:1-9`

Three compounding problems:

1. **No substrate.** `build.ts:103` threads only `binarySize`; `dataSize`/`dataRange` are never
   populated. Every real build prints `Data segment: 0 bytes ($0000–$0000)`.
2. **No producer.** M3 itself says absolute addresses are unknown at serialization, so padding is
   only knowable post-ACME — a read-back path that does not exist.
3. **Spec collision.** The summary's layout is transcribed **verbatim from frozen
   `spec/11-memory-model.md:201-229`**, with a golden asserting it and the renderer's own rule
   being *"the layout never changes, only the numbers"*. Adding a padding line diverges from a
   spec-derived golden — which sits awkwardly beside AC-8's "spec untouched" framing.

`@blend65/compiler` and `@blend65/cli` are both absent from "Packages touched", and all three
technical items are sized "complexity: S".

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | **Scope M6/AC-9 out** into a follow-on "resource report: data segment" RD | Keeps this slice single-purpose; M6's intent is temporarily covered by M4's ratchet | Padding stays invisible in the summary for now |
| B | Keep it: add the missing packages, add a 4th technical item naming the post-ACME derivation, re-size | Delivers the visibility M6 wants | Roughly doubles the RD; drags in a spec-format decision |
| C | Report padding in the **JSON mirror only**, or inside the existing `Data segment:` bracket | Avoids the golden and the spec-format issue | Less legible than a summary line |

**Recommendation: Option A.** The challenger agreed and added a mechanism worth recording for
whoever picks it up: emit a synthetic label immediately before the `!align`, and padding becomes
`__data_X − pre_align_label` straight from the symbol map — no ACME report parsing at all.

**Confidence:** High. **Hardening:** challenger CONFIRMED at MAJOR, recommended scope-out.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-004: "Any aligned address inside the bank works" is false — `$1000–$1FFF` is char-ROM shadow 🟠 MAJOR

**Dimension:** 8 Security/Safety · **Location:** RD-03:38-44
**Codebase Evidence:** `packages/core/src/semantics/platform-profile.ts:77` (`ramStart: 0x2000`); `packages/core/src/report/build-resource-report.ts:151`; `packages/test-harness/src/balloon.spec.test.ts:29`

In VIC banks 0 and 2 the chip reads the **character generator ROM** at bank offset
`$1000–$1FFF`, regardless of CPU `$01` banking (balloon's shim does `LDA #$36 / STA $01`, which is
CPU-side only). Sprite data placed there is invisible to the VIC — you get the charset rendered as
a sprite. With `checkDataOverlap` capping the image at `$0801`–`$1FFF` under `DEFAULT_PROFILE`,
roughly **half the emittable window is the shadow**. The RD's sentence is the premise the whole
document rests on, and it is false as prose.

balloon lands at `$0900` today with ~1.7 KB of headroom, and nothing constrains it. The only guard
(AC-5) is VICE-only and never runs in CI (AR-27), so the failure is both silent and CI-invisible.
Bank *exit* above `$3FFF` is the same gap one step further out.

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add an M-level requirement + diagnostic when a page-aligned array resolves into `$1000–$1FFF` | Closes it properly | Needs symbol-address plumbing into the build facade + platform-conditional logic — its own RD |
| B | Correct the prose, add a CI assertion that `__data_Main_BALLOON < $1000`, record the shadow as a known limitation, file the diagnostic as a follow-on | Cheap, honest, gives CI its first placement guard | Leaves the general case undiagnosed |

**Recommendation: Option B**, with the diagnostic filed as a follow-on issue.

**Confidence:** High on the hardware fact and the code evidence. **Hardening:** challenger
CONFIRMED the fact but **demoted CRITICAL → MAJOR** — the shipped example is safe and the gap is
latent. Severity recorded as the challenger's, not the auditor's.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-005: AC-7 is vacuous — the one program this RD changes is the one the guard does not scan 🟠 MAJOR

**Dimension:** 7 Testability · **Location:** RD-03:97-99 (M7), :225-226 (AC-7)
**Codebase Evidence:** `packages/test-harness/src/golden-layout.spec.test.ts:36-51`; `packages/test-harness/src/testing/balloon.ts:8-11`; `twins.spec.test.ts:93-99`

`GOLDEN_PROGRAMS` hard-lists 14 programs; **balloon is not among them** (deliberately — its
generated output is never committed). AC-2 simultaneously freezes the only three data-bearing
goldens byte-identical. So **no file the ST-B39/B40/B43/B44 scan reads can contain padding**, and
no committed artifact will ever contain the `!align` directive M3 mandates. AC-7 is green before a
line is written. (The scan's predicates only inspect jumps and labels, so they would ignore a
directive anyway.)

| Option | Description | Pros | Cons |
|---|---|---|---|
| A | Add `balloon.asm.golden` + a `GOLDEN_PROGRAMS` entry | Direct | Fights the committed design, and breaks `twins.spec.test.ts:97` (`[...goldens, "balloon"]` would duplicate balloon) |
| B | Add a **small mixed-alignment fixture** (two const arrays, one `&`-taken, one not) with a committed golden | One artifact discharges PF-005, PF-007 **and** PF-001's negative control | Real registration chain: manifest pair + twin + observables + budgets + `GOLDEN_PROGRAMS` |
| C | Restate AC-7 honestly as a no-regression check and add a separate discriminating AC | Cheapest | Leaves the new emission with no committed artifact |

**Recommendation: Options B + C together** — the challenger's call, and it is right: one new
fixture converts three vacuous criteria into discriminating ones. The RD must budget the
registration chain honestly rather than treating it as free.

**Confidence:** High. **Hardening:** challenger CONFIRMED at MAJOR.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-006: Three documents carry three different measured figures, and all three are wrong 🟠 MAJOR

**Dimension:** 3 Contradictions / 2 Implicit Assumptions · **Location:** RD-03:38, :236-242; `00-ambiguity-register.md:311,318`

| Source | Claims | Truth (measured) |
|---|---|---|
| RD:38 | data "lands at `$0830`" | `$0A67` pre-rewrite, `$08FA` post-rewrite — `$0830` matches nothing |
| RD:236 | "677 → ~312 bytes … 2.70× → ~1.24×" | excludes the alignment M1 mandates (its own footnote concedes this) |
| AR #65 | "+153 padding, −212 net" (≈465 B, 1.85×) | computed from the **pre-rewrite** `$0A67`; stale |
| **Measured** | — | **318 bytes, 1.27×, 6 bytes padding** |

M4's ratchet re-derivation depends on getting this right.

**Recommendation:** Correct the RD and the register to the measured figures, mark AR #65's
`+153`/`−212` explicitly superseded, **and** state that 6 bytes is an artifact of where the code
happens to end — any future code-size change re-rolls padding across 0–255. The challenger rated
that second half as mattering more than it looks: a ratchet implying 6 is stable will fail M4's
own discipline.

**Confidence:** High — measured end to end. **Hardening:** challenger CONFIRMED at MAJOR.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-007: M1's discriminating half is never tested where the bug would live 🟠 MAJOR

**Dimension:** 7 Testability · **Location:** RD-03:65-67 (M1), :210-212 (AC-2)

M1 promises an array whose address is never taken "is not aligned and pays no padding". But after
this RD **no single program contains both an aligned and an unaligned const stream**: balloon has
exactly one const array (which aligns), and the three data-bearing fixtures are frozen
byte-identical. The negative is only ever proven across programs — never where the bug lives:
stream ordering, and whether padding before an aligned stream displaces an unaligned neighbour.

**Recommendation:** Add a codegen `*.spec.test.ts` case with two const arrays (one address-taken,
one not) asserting both emitted addresses and the padding count — CI-runnable today — and fold it
into PF-005's fixture so one artifact closes both.

**Confidence:** High. **Hardening:** challenger CONFIRMED at MAJOR.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-008: The new directive lands in three exhaustive switches the RD never names 🟠 MAJOR

**Dimension:** 13 Codebase Alignment (Impact Blindness) · **Location:** RD-03:127-138, :145-148
**Codebase Evidence:** `packages/codegen/src/instr/print-instr.ts:165-166` (`directiveText`), `:295-315` (`directiveByteSize`), `:178-180` (`isColumnZeroDirective`)

Adding a variant to `AcmeDirective` forces changes in three switches carrying
`const _exhaustive: never` arms — each a hard compile error until handled. `directiveByteSize` is
the interesting one: it models **statically known** byte contributions, which an alignment
directive cannot supply, so its return value for `align` is a decision the RD must make (and
`programByteSize` becomes a lower bound). `isColumnZeroDirective` matters cosmetically — an
`!align` is conventionally column-0 like `* =`, and will otherwise render at instruction indent
in every golden.

**Refuted and worth recording:** `@blend65/platforms` genuinely needs **no** change (its plugins
only construct `outputFile` directives, never switch over the union), and branch relaxation and
per-function costs cannot be corrupted because both iterate `segment: "code"` streams only.

**Recommendation:** Cite the full path (`packages/codegen/src/instr/serialize-acme.ts:125-131`),
add `print-instr.ts` to the Emission section, and state what `directiveByteSize` returns for
`align`.

**Confidence:** High. **Hardening:** in-context only (below the challenger batch cut).

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

### PF-009: The frozen spec already assigns embedded-asset alignment to format handlers 🟠 MAJOR

**Dimension:** 13 Codebase Alignment / 10 Scope · **Location:** RD-03:110-111, :115-117
**Codebase Evidence:** `spec/future-considerations.md:292`

The RD cites FUT-014 as the alternative it avoids — but the *same entry* says: *"**In v3,
alignment is handled automatically by format handlers for embedded assets (F015).** For
hand-written data, the linker/platform profile can handle placement."* The RD separately declares
format handlers out of scope as unimplemented (verified true) but never reconciles the two. It
introduces an address-taken page-alignment policy that is **not** the mechanism v3 describes, and
argues spec-neutrality without engaging the one spec sentence that speaks to this.

Partially refuted, in the RD's favour: `spec/13-data-inclusion.md` (EMB-5) states no alignment
guarantee, and `spec/00-feature-index.md:152`'s "E10143 Alignment conflict" is itself stale
(`14-diagnostics.md:132` defines E10143 as "Backing value out of range"). So the spec does not
*normatively require* a particular alignment — it merely asserts the mechanism.

**Recommendation:** Add a paragraph to "What this is not" acknowledging `future-considerations.md:292`,
stating that the address-taken rule is a compiler placement policy that does not preclude format
handlers, and sketching how the two compose when handlers land — otherwise a future format-handler
RD collides with this one (what happens when a `.spd` handler wants 64-byte padding on an array
whose address is also taken?).

**Confidence:** Medium — the collision is real; its urgency depends on when format handlers land.
**Hardening:** in-context only.

**User Decision:** ✅ Resolved — user accepted the recommendation (all findings, 2026-07-20)

---

## 🟡 MINOR (18) — abbreviated

| # | Finding | Location |
|---|---|---|
| PF-010 | **M2's rationale is refuted by the RD's own Known Divergence.** M2 justifies page-over-block on `hi()` being "specified to fold at compile time (`spec/12-intrinsics.md:174`)" — but that line reads "when applied to **compile-time constants**", and `&BALLOON` is a **link-time** symbol the compiler demonstrably does not fold (8 instructions, runtime `ASL`/`ASL`). Conclusion survives on the arithmetic; the stated reason does not. Sweep AR #67/#68 too | RD:73-77 vs :175-192 |
| PF-011 | **AC-6's stop-rule has no mechanical gate.** `checkCostWithinBudget` fails only on `actual > budget` and its message invites "consciously raise the budget"; no assertion anywhere enforces "corpus total strictly decreases". Restate as verified against the committed scoreboard diff at closeout | RD:222-224; `budget-loader.ts:211-222` |
| PF-012 | **`hi(&X) * 4` wraps silently above `$3FFF`** → sprite pointer 0 → VIC reads zero page. Latent only because `DEFAULT_PROFILE` caps data at `$2000`; `c64.ts:55` declares `maxBinarySize: 26623`. Bound AC-3 to `address < $4000` + a Won't-Have line. (Challenger: cannot be folded into PF-004's diagnostic — this is *user-written* arithmetic the compiler cannot recognise as sprite-pointer intent) | RD:213-215 |
| PF-013 | **balloon's `twins.json` routing goes stale and the freshness gate won't catch it.** Still says "63 unrolled pokes forced by the `copy()` language gap", `sourceForced: true`, rendered into `SCOREBOARD.md`; `gen-parity-scoreboard.mjs:97-110` checks only *structural* staleness. RD-05 set the precedent for re-routing in-change | `twins.json:415-423` |
| PF-014 | **The blessed idiom emits a warning.** `poke($07F8, hi(&BALLOON) * 4)` emits `warning[W10172]: multiply by 4 generates a shift-and-add sequence` — the RD's flagship line tells the developer their code is slow while the compiler emits two `ASL`s. Same defect class as the #58/#60 routing. Also: RD:190's "scratch pair" is really a **frame slot** (`__frame_Main_main_0sc0`, absolute `$2000`), not zero page — the cost profile differs | verified by build |
| PF-015 | **Instruction count disagreement.** The listing shows **8** instructions (verified); the prose says "the extra five" (⇒9) and AR #67 says "9 instructions". It is four extra over a hand-coder's four | RD:177-190; AR #67 |
| PF-016 | **The register's hardening disclosure quotes the *ideal* form as verified output** — `LDA #>__data_Main_BALLOON` / `ASL` / `ASL` — which is exactly what the compiler does *not* emit. That sentence grounds a "Confidence High" rating | AR register:329-331 |
| PF-017 | **"The whole gap is one mistake repeated 63 times" is contradicted by the RD's own target** (~60 bytes remain), and "expected to **beat** the hand-written reference" names no axis — on bytes it stays ~1.27× behind; it beats the twin only at *runtime* (the twin copies 63 bytes at startup) | RD:16-17, :236-238 |
| PF-018 | **S1 is unbounded, has no AC, and has no eligible candidate.** AC-2 freezes the only three data-bearing fixtures; `slice8b`'s staging targets `$0400`/`$C000`, which the RD's own Won't-Have excludes. Either delete it or state it is a no-op on the current corpus, with the reason | RD:103-104 |
| PF-019 | **The new `AcmeDirective` variant is never named or shaped** — no variant name, no fields, no statement of page-only vs parameterized. Every sibling RD closed this with a naming batch (AR #13/#19/#33); RD-03's register has none | RD:129-138 |
| PF-020 | **The padding fill byte is unspecified.** ACME's default is `$EA` (verified: `EA EA EA EA EA EA`); `!align 255, 0, 0` gives `$00`. This becomes a committed golden byte pattern | RD:136-138 |
| PF-021 | **Security section credits a dead function.** `programByteSize` has **no production caller** (only its own export + tests) and structurally cannot count align padding. The live guard is `checkBinaryBudget` on post-ACME `binarySize`; the *binding* one is `checkDataOverlap`/E10033 at `$2000` — ~4× tighter, and it surfaces as "overlaps the RAM data region", which reads like a RAM bug rather than an alignment cost | RD:200-201 |
| PF-022 | **Terminology drift over the sets that gate the slice**: "fixture" / "program" / "corpus program" / "golden" quantify over different populations (14 goldens; balloon has a budgets row but no golden). Define once | M4, S1, AC-2, AC-6 |
| PF-023 | **The idiom generalizes wrongly and silently.** `&` on a *mutable* module array is equally legal but lives in SFA RAM and can never carry an `!align` — a developer copying balloon's line onto a buffer gets a wrong pointer with no diagnostic. Non-array const aggregates (const structs) are also unspecified | RD:65-71; `lower.ts:1813-1818` |
| PF-024 | **Multi-array behaviour unspecified**: stream ordering (padding is order-dependent), cumulative cost (~255 × N worst case), and zero-length aligned arrays (up to 255 padding bytes for a 0-byte payload — no diagnostic rejects a 0-byte embed) | RD:145-148 |
| PF-025 | **No AC names an owning tier or artifact.** AC-1/3/4/9 have none; AC-3 as phrased is VICE-only (the written value only exists at runtime), joining AC-5 — so CI proves neither. AC-1 and AC-4 *are* CI-provable if someone writes them | RD:205-232 |
| PF-026 | **Citation drift**: `serialize-acme.ts:125-129` should be `packages/codegen/src/instr/serialize-acme.ts:125-131` — bare filename where every sibling citation is fully rooted | RD:147-148 |
| PF-027 | **AC-6 hides two unnamed work items**: balloon's `frameUpdate` window carries `measuredMaxCycles: 125`, re-derivable only under VICE; and the `twins.json` routing prose (PF-013) | RD:222-224 |

## 🔵 OBSERVATIONS

| # | Finding |
|---|---|
| PF-028 | "Aligned" carries two granularities: the overview uses it in the sprite-block (64-byte) sense (:22, :42-44), from M1 onward it means page (256). A careful reader recovers via M2's heading; a parenthetical at :43 would avoid the reader concluding the data section is already page-aligned |
| PF-029 | Format-handler inventory, for whoever writes that RD: `FormatHandler` genuinely does not exist, but `E10203` **is** registered (`diagnostic-codes.ts:268`) and a dead hook exists (`platform-profile.ts:107`, `PlatformProfile.embedFormats`, never populated, never read). The RD's narrower claim ("absent from the frontend") holds |

---

## Verified clean — checked and refuted, recorded so they are not re-discovered

- **Label anchors do NOT break.** A proposed finding that deleting 63 pokes would renumber
  balloon's `Main_main_L5`/`L3` anchors was **refuted by measurement**: the label sets are
  identical before and after the rewrite.
- **R15 holds.** The address-taken set is computable entirely inside `packages/codegen/src/il/lower.ts`;
  no frontend or language-server import is implied.
- **No hidden runtime data copy.** `needsDataInit` (`instr-program.ts:233`) is declared on
  `PlatformPlugin` but consumed by no plugin — nothing contradicts "reads it in place".
- **`@blend65/platforms` needs no change** (plugins construct `outputFile` directives, never switch
  over the union). **Branch relaxation and per-function costs are safe** (both iterate
  `segment: "code"` only).
- **Data streams cannot overlap.** ACME lays streams sequentially and `!align` only inserts padding
  ahead of one — the RD's overlap safety claim is sound.
- **`origin`/`fill` genuinely are not substitutes** (both take literal numbers).
- **AC-2 works as a proof-of-negative** — the per-golden suites compare fresh builds against
  committed goldens in CI, and slice7/7b/8b are exactly the goldens containing `__data_`.
- **All four spec citations resolve exactly**; the balloon quotation is verbatim; the poke count is
  exactly 63; 677/251/2.70× match `budgets.json` and `SCOREBOARD.md`.
- **AR #65's padding arithmetic is internally consistent** (207+159+142+134+153 = 795).
- **Dimension 11 (Ordering & Sequencing): no findings.** RD-01/02/05 are all closed; the "in the
  same change" constraints are internally consistent.

## Adversarial checklist (same-agent bias)

- *What assumption might I be unconsciously confirming?* That the RD's thesis is sound. It
  survived — measured 318 B / 1.27× with the mechanism working end to end — but the two CRITICALs
  are both places where the document's *evidence* was accepted at face value, including by me in
  an earlier session.
- *What external standard might this violate?* VIC-II bank semantics (PF-004) — cited from domain
  knowledge, not from a document in this repo. **Flagged for human confirmation**: the
  `$1000–$1FFF` char-ROM shadow in banks 0/2 is well-established C64 hardware behaviour, but no
  artifact in this repo states it, so it deserves a second pair of eyes before it becomes a
  requirement.
- *What would a domain expert who disagrees flag?* That page alignment wastes up to 255 bytes on a
  machine with 38 KB of BASIC RAM, where a hand-coder picks the address. PF-024 carries the
  bounded form of that objection; AR #68's decision (page, for expressibility) stands.
