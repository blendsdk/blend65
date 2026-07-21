# Preflight Report: RD-15 — Alignment Granularity

> **Status**: ✅ PREFLIGHT PASSED — all 18 findings resolved (0 critical, 2 major, 14 minor, 2 observation), every recommendation accepted by the user 2026-07-21; fixes applied same-session (Step 7) across RD-15, the register, README and both roadmaps — the RD gained AC-15 and a ninth Won't-Have. The PF-080 companion issue is filed as [#74](https://github.com/blendsdk/blend65/issues/74), user-confirmed text, number patched into the RD
> **Iteration**: 1 (first scan)
> **Artifact**: Requirements document at `codeops/features/asm-parity/requirements/RD-15-alignment-granularity.md`
> **Codebase Grounded**: clustered fan-out (5 auditor dispatches) + lead reconnaissance; ~30 source/test/doc files examined; every citation in the RD mapped to the tree; the four-program measurement table independently re-verified by rebuild at HEAD `8a47ada`
> **Last Updated**: 2026-07-21
> **CodeOps Skills Version**: 3.11.0

> ⚠️ **SAME-SESSION REVIEW**: This artifact was created in the current session. Same-agent bias
> risk is elevated. Mitigations applied: five independent auditor contexts (Fable) with adversarial
> packets; the lead's two recon anomalies were withheld from the packets and both were
> independently rediscovered (PF-083, PF-084); a single independent challenger reviewed the MAJOR
> batch blind to the lead's picks and converged on both. Consider a fresh-session re-scan for
> maximum review independence.

### Codebase Context Summary

**Tech Stack:** TypeScript ESM monorepo (Yarn v1 workspaces + Turborepo, Vitest, Node 22) — AOT compiler for 6502/C64, 10 `@blend65/*` packages.
**Architecture:** pipeline Lexer → Parser → Analyzer → SFA → IL/Optimizer → Codegen → Emitter. The RD's mechanism rides `foldedAddressByte` (`packages/codegen/src/il/lower.ts:2559–2586`) → `lowerAddressOf` mark (`:1852–1866`) → `ConstDataEntry.pageAligned` (`cfg.ts:119`, written `lower.ts:282`) → `constDataStream` (`instr-program.ts:200–208`) → ACME bitmask render (`print-instr.ts:171–179`).
**Key files examined:** `lower.ts`, `cfg.ts`, `instr-program.ts`, `print-instr.ts`, the six alignment oracles (`align-mixed`/`balloon`/`balloon-color`/`boing-ball` spec suites), `lower-address-of.{spec,impl}.test.ts`, `assemble.impl.test.ts`, `budgets.json`, `examples/*`, RD-03, RD-13, the ambiguity register, README, both roadmaps, `expression-typing.ts`, `plan-allocation.ts` (challenger).
**Reference verification:** every code citation in the RD verified correct at HEAD; the measurement table (19/188→60/1/194 pads) re-verified by rebuilding all four examples; one stale doc citation found (PF-083); one impact-inventory omission found (PF-084).

### Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 | 🟡 |
| 2 | Implicit Assumptions | 2 | 🟡 |
| 3 | Logical Contradictions | 2 | 🟡 |
| 4 | Completeness Gaps | 2 | 🟡/🔵 |
| 5 | Dependency Issues | 2 | 🟡/🔵 |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 4 | 🟠 |
| 8 | Security Blind Spots | 0 (folded into PF-080) | — |
| 9 | Edge Cases | 2 | 🟠 |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 | 🟡 |
| 13 | Codebase Alignment | 2 | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | all resolved |
| 🟡 MINOR | 14 | all resolved |
| 🔵 OBSERVATION | 2 | all resolved |

**Verified clean (no finding):** the mechanism's feasibility and call chain; all complexity-S ratings; the Depends-On statuses; the six-oracle inventory's exhaustiveness (no seventh alignment oracle exists); AC-3's discrimination power (positively verified against ST-C12's in-tree precedent); `print-instr.ts` no-change claim; the AR #101–#112 decision mappings; dimension 10 (scope creep), 11 (ordering), and standalone 6/8.

---

## 🟠 MAJOR

### PF-080: The 64-demand source form is legal on mutable arrays and functions, where it registers nothing and no alignment path exists — undefined by the RD, and the Security section overclaims "removed by construction" 🟠 MAJOR

**Dimension:** 9 Edge Cases (+ 8 Security, 4 Completeness)
**Location:** RD-15 M1 table (:90–95, scoped to const aggregates only); Security Considerations :324–327; no Won't-Have or AC covers the non-const case
**Codebase Evidence:** `lower.ts:2561` — `foldedAddressByte` gates only on `isAddressOfExpr`, never symbol kind; `lower.ts:1852–1866` — the alignment mark exists only in the `sym.kind === "constant"` branch; `expression-typing.ts:577` — `&` is legal on any variable; `spec/08-arrays-strings.md:347–350` — mutable arrays exist; `RD-03-placement.md:106` — a mutable module variable "can never carry an alignment directive"; challenger: module variables are placed by the frontend SFA planner (`plan-allocation.ts`) *before* codegen discovers the demand — honoring it would be a phase inversion, not an extension.
**The Problem:** `lo(&spriteBuf / 64)` on a RAM sprite buffer — the double-buffer idiom a real C64 game uses — compiles today, folds correctly, receives no demand under M1, and no alignment path for variable storage exists; the VIC reads `floor(addr/64)*64`, the exact silently-wrong-block failure the RD illustrates at :64–65. The behavior is pre-existing (RD-13 already folds it) and correct-as-mechanism, but the RD never states it, no Won't-Have scopes it out, no AC pins that the new `shift` parameter is inert in the variable/function branches of the very function M3 rewires, and the Security section's "removed by construction" claim is misleadingly scoped (true only for const images). Two conforming implementers could produce different demand maps for non-const symbols.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a Won't-Have naming mutable-aggregate and function operands of the fold shape; add one M1 sentence ("a `&` that does not resolve to a const aggregate registers no demand regardless of divisor"); narrow the Security claim to "for const images"; promote the negative fixture to a numbered AC mirroring AC-7 (no `!align`, fold byte unchanged); file the undiagnosed-hazard gap as a GitHub issue naming a compiler warning as its candidate fix | Smallest correct fix for a requirements doc; pins the inert-shift guarantee the mechanism depends on; follows the #67/#68 convention | Documents-and-defers a Prime-Directive-class silent hazard |
| B | Extend the demand map to module-variable storage in this RD | Closes the hazard | Phase inversion: SFA fixes RAM addresses before codegen sees the demand — a new cross-package feature with its own ambiguity gate, contradicting RD-03:106 |
| C | Diagnose `lo(&<non-const> / 64)` with a compiler warning in this RD | Cheap at the fold site; near-zero false positives (v3 has no user-placed variables) | Inconsistent alone (`hi(&mutableBuf) * 4` has the identical hazard and stays silent); new user-facing diagnostic surface with no AR behind it — would itself trigger the ambiguity protocol |

**Recommendation:** Option A — with the fixture as a numbered AC and the filed issue naming Option C's warning as the candidate fix. B is not viable in this RD; C belongs in the issue, designed coherently.
**Confidence:** High. **Hardening:** challenger converged (severity MAJOR honest — not CRITICAL because the behavior predates this RD byte-for-byte; not MINOR because M1 elevates the form to a semantic statement that is silently ignored where the mistake draws wrong graphics). **Challenger:** converged.
**User Decision:** Resolved — user accepted recommendation: Option A (Won't-Have + M1 sentence + narrowed Security claim + numbered AC mirroring AC-7 + filed issue naming the warning as candidate fix), 2026-07-21; filed as [#74](https://github.com/blendsdk/blend65/issues/74)

### PF-081: The three re-derived `% 64` oracles are unfailable against the 256-regression direction — the same by-luck-pass class the RD's own M4 elevates to M-level 🟠 MAJOR

**Dimension:** 7 Testability
**Location:** RD-15 M4 (:145–153), AC-9 (:365–367), Spec-Test Inventory (:393–395)
**Codebase Evidence:** `% 256 === 0 ⟹ % 64 === 0`; at HEAD, balloon `$0900` and boing-ball `$0B00` are multiples of both, and balloon-color regressing `$0980 → $0A00` still satisfies `% 64` — so a per-example or global loss of the 64 demand leaves all three re-derived oracles green. No safety net exists elsewhere: no committed asm goldens for these three programs (`test/golden/` holds only slice/gate/guards/rasterpoll), balloon's 318 B budget is pad-invariant, AC-10 is "recorded, not gated" (and would be blind for two of three even if gated). The RD's own register (AR #108, `00-ambiguity-register.md:486`) states directive text is "the **only** deterministic 64-vs-256 discriminator", with exact in-tree precedent at `align-mixed.spec.test.ts:78–87`. RD-15:146 calls ST-13f "the change's built-in tripwire" — true only in the forward direction; after merge it trips on nothing.
**The Problem:** As specified, per-example regression detection rests solely on the new AC-1/AC-3 mechanism fixtures; the three real programs the RD names would never notice losing their demand (shape- or context-specific lowering drift, or a silent source-form change). M4 exists to hunt exactly this oracle class (PF-054 lineage) and the re-derivation as written re-creates it.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Add a directive-text assertion (`!align 63, 0, 0` immediately preceding the image label) to each of the three example suites alongside the `% 64` clause — extend M4's rows and AC-9 accordingly | The AR #108-endorsed discriminator; exact precedent incl. rationale comment (ST-C11); closes the hole in all three programs; ~6 lines/suite in the suites' existing raw-asm style | Couples three more suites to the emitter's rendered text |
| B | Gate AC-10's pad < 64 bound per 64-demand example | Turns the bound into an oracle | Strictly dominated: stays green under a 256-regression for balloon (pad 19 either way) and boing-ball (pad 1 either way) — same coincidence blindness, higher cost |
| C | State in M4 that per-example discrimination is deliberately delegated to AC-1/AC-3 fixtures | Converts oversight into recorded decision; keeps example suites address-abstract | Records the wrong decision: declining the register's own "only deterministic discriminator" inside the M that hunts this class |

**Recommendation:** Option A. On this emitter the text *is* the behavior — ACME's bitmask trap (`!align 64, 0` assembles silently and aligns nothing) is why ST-C11 already accepted this coupling on the record.
**Confidence:** High. **Hardening:** challenger converged (severity MAJOR honest — not CRITICAL because the escape direction is byte-waste, not wrong output, and the mechanism fixtures do gate global behavior). **Challenger:** converged.
**User Decision:** Resolved — user accepted recommendation: Option A (directive-text assertion `!align 63, 0, 0` + label adjacency added to all three example suites; M4 rows and AC-9 extended), 2026-07-21

---

## 🟡 MINOR

### PF-082: AC-5 claims the k = 15 guard extreme but no listed divisor reaches it 🟡 MINOR

**Dimension:** 3 Logical Contradictions (found independently by all five clusters)
**Location:** RD-15 AC-5 (:352–354)
**Codebase Evidence:** `lower.ts:2566` accepts shift ≤ 15; `log2Exact(16384) = 14`. Listed divisors `/1, /128, /16384` cover k ∈ {0, 7, 14}. The historically trap-prone extreme is 32768 = 2^15 (RD-13's ST-13h pinned it because a byte mask would have hidden it — commit `117da79`).
**The Problem:** A spec-test author transcribing AC-5 verbatim believes both extremes covered; the actual accepted upper boundary (15) and the just-outside rejection (k = 16, `/ 65536`) go untested.
**Options:** (A) add `lo(&X / 32768)` (and optionally `>> 15` per AC-6's equivalence, plus `/ 65536` as the rejection case) to AC-5's list; (B) reword the parenthetical to k ∈ {0, 14}. A is strictly better — the code's guard boundary is 15.
**Recommendation:** Option A.
**User Decision:** Resolved — user accepted recommendation: Option A (add `lo(&X / 32768)` and the `/ 65536` just-outside rejection case to AC-5), 2026-07-21

### PF-083: Stale citation `RD-03-placement.md:202` — the supersession note this doc set itself inserted shifted the target to :219 🟡 MINOR

**Dimension:** 13 Codebase Alignment (stale reference) — lead recon anomaly, independently found by 3 clusters
**Location:** RD-15:182; the same stale `:202` also appears in the register's AR #102 row (`00-ambiguity-register.md:480`)
**Codebase Evidence:** the `@align(n)` Won't-Have now sits at `RD-03-placement.md:219`; RD-03:202 is unrelated S1 prose. The AR #111 note inserted at RD-03:137–153 shifted everything after M2 by ~17 lines. RD-15's other RD-03 citations (:83–86, :100–119, :129) precede the insertion and remain correct.
**Options:** (A) update both citations to `:219` (docs commit together, so line cites are then stable — house style); (B) switch to section-name citations (insertion-proof).
**Recommendation:** Option A.
**User Decision:** Resolved — user accepted recommendation: Option A (update RD-15:182 and register AR #102 row to `:219`), 2026-07-21

### PF-084: A 16th `pageAligned` site is missing from M4's blast radius — `assemble.impl.test.ts` constructs a `ConstDataEntry` literal 🟡 MINOR

**Dimension:** 13 Codebase Alignment (test impact) — lead recon anomaly, independently found by 2 clusters
**Location:** RD-15:157–158 and inventory :401 ("~15 assertions" in two files); AR #106's "measured blast radius: 15" carries the same omission
**Codebase Evidence:** `packages/codegen/src/instr/assemble.impl.test.ts:151–156` — `pageAligned: false` in a ConstDataEntry literal; grep-verified as the only site outside the two named files; no ConstDataEntry construction exists outside `@blend65/codegen`.
**The Problem:** M3's type change makes this a hard compile error; AC-13's typecheck catches it loudly (hence MINOR), but an inventory sold as "measured" is falsified by one site.
**Options:** single viable fix — add `assemble.impl.test.ts` to M4's reshape list and the inventory (count → 16); correct AR #106's note in the same edit. (Considered and dropped: leaving it to be found at typecheck — contradicts the RD's own completeness claim.)
**Recommendation:** Apply the fix.
**User Decision:** Resolved — user accepted recommendation (add `assemble.impl.test.ts` to M4's reshape list + inventory, count → 16; correct AR #106's blast-radius note), 2026-07-21

### PF-085: The no-demand representation on ConstDataEntry is unspecified, and directive suppression, the "mechanical" reshapes, and the max-idiom all depend on it 🟡 MINOR

**Dimension:** 4 Completeness Gaps
**Location:** RD-15 M3 (:120–129); AC-7 (:359–362) requires directive suppression
**Codebase Evidence:** `lower.ts:282` writes the field on every entry; `instr-program.ts:201–203` branches on it. Under a Map, `get(symbol)` is `undefined` for never-taken symbols; the RD never names the entry's sentinel (absent field? 0? 1?) or the new suppression predicate. The ~15 reshapes assert `false` for unaligned cases today (e.g. `lower-address-of.spec.test.ts:232, :254–255, :277–279`) — "reshapes mechanically" is not true until the target representation is named.
**Options:** (A) one M3 sentence: no-demand entries carry `boundary?: number` absent, directive emitted iff present (matches Map semantics naturally); (B) `0`-means-unaligned. Either works — the RD must just pick one.
**Recommendation:** Option A.
**User Decision:** Resolved — user accepted recommendation: Option A (M3 names the representation: `boundary?: number`, absent = no demand, directive emitted iff present), 2026-07-21

### PF-086: The Should-Have's platform-allowlist evidence cites the wrong pipeline seam — the demand is decided in lowering, which has no `PlatformPlugin` 🟡 MINOR

**Dimension:** 2 Implicit Assumptions — independently found by 3 clusters
**Location:** RD-15 Should Have (:174–177: "`instr-program.ts:160` already has the `PlatformPlugin` in hand … costs little now")
**Codebase Evidence:** the allowlist is consumed at demand-registration in lowering (RD-15:216–229), but `LowerInput` (`lower.ts:84–96`) has no platform field; `lowerToIL` is called `{program, model, plan}` from `emit.ts:105` (+ ~70 test sites). The plugin at `instr-program.ts:160` arrives two stages downstream. Implementing S1 as evidenced means either threading the platform into `lowerToIL` (touches `@blend65/compiler`, outside the declared Packages-touched table :254–257) or storing raw shifts and resolving at assemble time — a different data shape than M3 specifies.
**Options:** (A) reword to name the real mechanism (optional `LowerInput` field threaded from emit.ts; test callers unaffected if optional) and re-price honestly, adding `@blend65/compiler` to the table if S1 is taken; (B) respec S1 so lowering records shifts and instr-program maps shift→boundary — requires reconciling M3; (C) drop the `:160` grounding and leave S1 a bare deferral.
**Recommendation:** Option A — keeps M3 intact and prices S1 truthfully. Not blocking; S1 is optional.
**User Decision:** Resolved — user accepted recommendation: Option A (reword S1 to the real seam — optional `LowerInput` field threaded from emit.ts — re-priced; `@blend65/compiler` noted as joining the blast radius if S1 is taken), 2026-07-21

### PF-087: A named-constant divisor (`lo(&X / BLOCK)`) demands 64 under the rule as written, but nothing pins it 🟡 MINOR

**Dimension:** 9 Edge Cases
**Location:** RD-15 M1 :94, Technical Requirements :224–226, inventory :388–401
**Codebase Evidence:** `lower.ts:2530–2537` — `constantOperandValue` deliberately accepts a resolved named constant ("refusing one would make the more readable spelling of a block size the slower one"), so `const BLOCK = 64; lo(&X / BLOCK)` reaches the fold at shift 6 and must demand 64. Every AC spells divisors as literals; an implementation keyed on a literal `64` token would pass every listed test — the unfailable-oracle class again, in miniature.
**Options:** single viable fix — add one named-constant case to AC-6's equivalence fixture (`/ 64` ≡ `>> 6` ≡ `/ BLOCK`). (Considered and dropped: a separate AC — overweight for one fixture line.)
**Recommendation:** Apply the fix.
**User Decision:** Resolved — user accepted recommendation (named-constant case added to AC-6's equivalence: `/ 64` ≡ `>> 6` ≡ `/ BLOCK`), 2026-07-21

### PF-088: "Re-derived" is used in two contradictory senses — M4's heading says six, its own table and AC-8 say three 🟡 MINOR

**Dimension:** 12 Consistency
**Location:** RD-15:135 (heading: "The six spec-tier assertions … are re-derived, not edited") vs :142–144 (three "keep unmodified"), :297 (Scope row: "re-derive three, keep three as control"), AC-8 (no edit allowed) vs AC-9 ("re-derived" = changed to `% 64`)
**Codebase Evidence:** document-only; AR #107 uses the three/three split.
**Options:** single viable fix — reword the M4 heading, e.g. "…are re-derived from the new boundary rule — three change to `% 64`, three are confirmed unchanged as the bare-`&` control."
**Recommendation:** Apply the reword.
**User Decision:** Resolved — user accepted recommendation (M4 heading reworded: three change to `% 64`, three confirmed unchanged as the bare-`&` control), 2026-07-21

### PF-089: The AC preamble contradicts AC-10/AC-11, and AC-10 mixes a bound, a non-member, and an ungated measurement 🟡 MINOR

**Dimension:** 1 Ambiguities
**Location:** RD-15:333–334 (preamble: "Absolute addresses and per-fixture byte counts are deliberately absent"), AC-10 (:368–370), AC-11 (:371–374)
**Codebase Evidence:** document-only; align-mixed (pad 194) is bare-`&`, not a 64-demand image (RD-15:49), yet sits inside a "< 64" criterion.
**The Problem:** (a) the preamble's absence claim is literally false against AC-10/AC-11's own numbers — the intended sense is "absent *from gates*"; (b) AC-10's bound sentence reads as pass/fail while its second sentence says "recorded, not gated", and 194 superficially violates the bound it sits under; a closeout checker cannot tell which clause fails the AC.
**Options:** (A) fix the preamble to "absent from gates" and split AC-10 — the bound for 64-demand images, then a clearly-labeled measurement table where align-mixed is marked "bare-`&` control, bound n/a", stating AC-10 is discharged at closeout by measurement; (B) additionally gate the bound (superseded by PF-081's Option A which guards the same property better).
**Recommendation:** Option A (with PF-081-A adopted, gating here adds nothing).
**User Decision:** Resolved — user accepted recommendation: Option A (preamble → "absent from gates"; AC-10 split into bound + labeled measurement table, align-mixed marked "bare-`&` control, bound n/a", discharged at closeout by measurement), 2026-07-21

### PF-090: M2's universal proviso is credited to AC-4 alone, and two named 256-demand shapes have zero coverage 🟡 MINOR

**Dimension:** 7 Testability
**Location:** RD-15:117–118 ("pinned by AC-4, not assumed"), :228–229 ("what AC-4 tests"); M1 table :95 rows plain `hi(&X)`, plain `lo(&X)`
**Codebase Evidence:** AC-4 exercises only the `hi(&X) * 4`-mixed path; the universal claim is actually pinned jointly by AC-2/AC-4/AC-5/AC-8, and plain `lo(&X)`/`hi(&X)` appear in no fixture. AR #103's proviso requires "AC pins as a test rather than assumes".
**Options:** (A) reword both sentences to "pinned jointly by AC-2/AC-4/AC-5/AC-8" AND add plain `lo(&X)` / `hi(&X)` cases to AC-5's fixture so every M1-table row is exercised; (B) reword only.
**Recommendation:** Option A — the fixture rows cost two lines and close the sample gap.
**User Decision:** Resolved — user accepted recommendation: Option A (proviso reworded to "pinned jointly by AC-2/AC-4/AC-5/AC-8"; plain `lo(&X)` / `hi(&X)` rows added to AC-5's fixture), 2026-07-21

### PF-091: The Spec-Test Inventory doesn't cover AC-7/AC-10/AC-11, and its reshape row traces to no AC 🟡 MINOR

**Dimension:** 7 Testability
**Location:** RD-15 inventory (:388–402) vs AC-7, AC-10, AC-11
**Codebase Evidence:** AC-7's mechanism half is already covered in-tree (`lower-address-of.spec.test.ts:279` "must not be marked aligned", inside the reshape row) and its golden half by the golden tier — but no row says so; AC-10 and AC-11 have no rows; the reshape row maps to M3/M4 but no numbered AC.
**Options:** single viable fix — add rows: AC-7 → existing reshape + slice goldens (CI); AC-11 → existing budget tier (file unchanged); AC-10 → "closeout measurement, no test"; annotate the reshape row as serving M3 under AC-13.
**Recommendation:** Apply the fix.
**User Decision:** Resolved — user accepted recommendation (inventory rows added for AC-7 → existing reshape + slice goldens, AC-11 → existing budget tier, AC-10 → closeout measurement no test; reshape row annotated under AC-13), 2026-07-21

### PF-092: "584 B" / "456 B" are `.prg` file sizes; "318 B" in the same AC is the budget (payload) convention 🟡 MINOR

**Dimension:** 2 Implicit Assumptions (measurement convention)
**Location:** RD-15:51 ("188 of 584 B"), AC-11 (:371–374: "456 B (down from 584)" beside "balloon remains 318 B")
**Codebase Evidence:** rebuilt at HEAD: balloon-color `main.prg` = 584 bytes on disk, CLI reports "Total binary: 582" (payload excl. the 2-byte load address); balloon `main.prg` = 320 vs `budgets.json` 318 — the budget convention is payload size. Budget-convention equivalents: 582 → 454.
**The Problem:** a closeout measuring balloon-color the way budgets are measured gets 454, not the recorded 456 — the "measurement, not a budget" fails to reproduce by exactly 2 bytes.
**Options:** (A) restate as 582 → 454 (budget convention, matching "balloon remains 318"); (B) annotate 584/456 as `.prg` file sizes.
**Recommendation:** Option A — one convention per criterion.
**User Decision:** Resolved — user accepted recommendation: Option A (AC-11 restated in the budget convention: 582 → 454), 2026-07-21

### PF-093: The feature roadmap's RD-13 row still asserts "193 B → 1 B" — the figures this RD proves wrong 🟡 MINOR

**Dimension:** 3 Logical Contradictions (cross-doc)
**Location:** `codeops/features/asm-parity/00-roadmap.md:362` vs the same file's corrected header (:16–17) and RD-15's table (:44–51); outside M5/AC-12's correction scope (limited to RD-13:157–159)
**Codebase Evidence:** as cited; mitigation exists (the header carries the correction), hence MINOR.
**Options:** (A) patch the row to the corrected figures ("188 B → 60 B", or annotate "stale — re-measured at RD-15"); (B) accept the header correction as sufficient and acknowledge the inconsistency in RD-15's Integration Points.
**Recommendation:** Option A — the roadmap is the document CLAUDE.md names authoritative; it should not disagree with itself.
**User Decision:** Resolved — user accepted recommendation: Option A (roadmap RD-13 row patched to the corrected figures, annotated "re-measured at RD-15 authoring"), 2026-07-21

### PF-094: The roadmap's gate record under-reports the gate — "#101–#110" / "ten items" vs the register's 12 🟡 MINOR

**Dimension:** 5 Dependency Issues (cross-doc integrity)
**Location:** `codeops/features/asm-parity/00-roadmap.md:6, :34` vs `00-ambiguity-register.md:469` (12 items, 101–112); RD-15:302–303's traceability note says "items 101–110", leaving #111 (cited at :271) and #112 outside any decision row
**Codebase Evidence:** as cited; README.md:5 already has the correct form.
**Options:** single viable fix — amend the roadmap gate text to "#101–#110 + #111–#112 surfaced during authoring (12 items)" and widen RD-15:303 to "(items 101–112)" naming #111/#112 as authoring-surfaced.
**Recommendation:** Apply the fix.
**User Decision:** Resolved — user accepted recommendation (roadmap gate text amended to "#101–#110 + #111–#112 surfaced during authoring (12 items)"; RD-15 traceability note widened to items 101–112), 2026-07-21

### PF-095: AC-14's named comparand contains no alignment idiom to review against 🟡 MINOR

**Dimension:** 7 Testability
**Location:** RD-15 AC-14 (:382–384)
**Codebase Evidence:** `examples/balloon/balloon.asm` has no `!align` anywhere — it stages the sprite into the tape buffer via a copy loop (`balloon.asm:22–34`) and its header says so. A reviewer following AC-14 literally has nothing to compare the directive to.
**Options:** (A) re-point the review at the hand idiom itself (`!align 63, 0, 0` as what a hand-coder writes for in-place sprite data, per the RD's own overview), noting the twin embodies the staging-copy alternative — the comparison is strategy-level; (B) drop the twin reference.
**Recommendation:** Option A.
**User Decision:** Resolved — user accepted recommendation: Option A (AC-14 re-pointed at the hand idiom itself; twin referenced as the staging-copy alternative, comparison strategy-level), 2026-07-21

---

## 🔵 OBSERVATION

### PF-096: The only program whose image physically moves has no emulator tier, and AC-13 doesn't say so 🔵 OBSERVATION

**Dimension:** 4 Completeness Gaps
**Location:** RD-15 AC-13 (:378–381)
**Codebase Evidence:** `balloon-color.spec.test.ts:10, :39` — build-only, `skipIf(!hasAcme())`; no VICE suite references balloon-color. Balloon (`$0900`) and boing-ball (`$0B00`) — the two programs the VICE tier runs — are exactly the two the RD proves land identically under both boundaries.
**Options:** one AC-13 sentence noting the moved image is build-tier only, its hardware correctness resting on ST-13f's assembled-pointer oracle; optionally a one-off manual VICE look at balloon-color at closeout, recorded not gated.
**Recommendation:** Add the sentence.
**User Decision:** Resolved — user accepted recommendation (AC-13 gains the honesty sentence: balloon-color is build-tier only, hardware correctness rests on ST-13f's assembled-pointer oracle; optional one-off manual VICE look at closeout), 2026-07-21

### PF-097: README table rows lag their own header (pre-existing drift, not introduced by RD-15) 🔵 OBSERVATION

**Dimension:** 5 Dependency Issues (companion-doc staleness)
**Location:** `requirements/README.md:46–48` — RD-05/RD-03/RD-13 rows still say preflighted/drafted while the header (:5) says all three ✅ closed; RD-15's own row (:49) is correct
**Codebase Evidence:** as cited.
**Options:** sweep the three row suffixes to ✅ closed next time README is touched (can ride this RD's fix batch).
**Recommendation:** Sweep them with this fix batch.
**User Decision:** Resolved — user accepted recommendation (README rows :46–48 swept to ✅ closed with this fix batch), 2026-07-21
