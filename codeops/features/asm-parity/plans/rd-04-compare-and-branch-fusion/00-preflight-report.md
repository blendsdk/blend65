# Preflight Report: RD-04 Compare-and-Branch Fusion — Implementation Plan

> **Status**: ✅ PREFLIGHT PASSED — all 7 findings resolved (0 critical, 0 major, 6 minor, 1 observation; fixes applied and re-scan-verified)
> **Iteration**: 2 (iteration 1 = full 13-dimension scan; iteration 2 = fix verification + regression re-scan, same day; separate PF sequence from the requirements-set report)
> **Artifact**: Implementation plan at `codeops/features/asm-parity/plans/rd-04-compare-and-branch-fusion/` (8 documents + ambiguity register)
> **Codebase Grounded**: ~25 source/config/manifest files examined (9 deep-read); 45 references mapped — 40 verified, 5 contradicted (each contradicted reference became a finding)
> **Hardening**: one independent challenger spawned for the sole MAJOR-severity draft finding; it **refuted** the draft with an empirical compile test and the finding was downgraded and reframed (see PF-001). 1 of 2 challenger spawns used.
> **Last Updated**: 2026-07-19

## Codebase Context Summary

**Tech Stack:** TypeScript 5.9 ESM monorepo (Yarn v1 workspaces + Turbo, Node 22, Vitest, ESLint v9 flat config, `strict` tsconfig WITHOUT `noImplicitReturns`).
**Architecture:** AOT 6502 compiler pipeline; this plan touches AST→IL lowering (`packages/codegen/src/il/lower.ts`, 2 591 lines), the IL data model (`instruction.ts`/`cfg.ts`/`print-il.ts`/`termination.ts`), IL→6502 translation (`packages/codegen/src/instr/translate.ts`, 2 074 lines), the frontend SFA adapter (`packages/frontend/src/sfa/model-adapter.ts`), and the test-harness parity corpus (14 golden/twin pairs, `twins.json` routing, `budgets.json` ratchet + windows, committed `SCOREBOARD.md` with CI freshness gate).

**Key verifications (all confirmed against code):**
- Every statement-lowerer line reference (`lowerIf` :496, `lowerWhile` :525, `lowerDoWhile` :549, `lowerFor` :579, `lowerSwitch` :642, `lowerShortCircuit` :1261, `claimResultSlot` :1230, `materialise` :2490); `lower.ts` exports only `LowerInput`/`lowerToIL` (plan-AR #3's cycle argument holds).
- All five comparison framings and their internal label structure (`translate.ts:1050-1073`, `byteSignedOrdered` :1093 with `wantLess` :1099, `wordEquality` :1113 with the `diff` label at :1122, `wordUnsignedOrdered` :1133 with `falseL`/`trueL`/`endL` :1140-1142 and the `LDA #$01/#$00` tails :1159-1162, `wordSignedOrdered` :1173); the branch-tail flag reasoning (Z-freshness, carry preservation, N⊕V per `spec/02-type-system.md:36`) is sound.
- `brcond` reload-retest (:555-558) and its fusion-out-of-scope comment (:522-529); `prescanAll` :284; `terminatorReads` :1944 (`ret.value`/`brcond.cond`); single-use load deferral :588; `resetBlockState` :322.
- SFA adapter: Proxy kind-blind walk (`model-adapter.ts:119`), position-independent `isSlotSite` (:133-139), preorder + poisoned-placeholder rules (:89-105). The proposed position rule was walked against lowering claim order for the tricky nestings (`if (f(a && b))`, `if (p && (q ? r : s))`, `if ((a && b) == c)`, `!` chains) — the two walks agree by construction in every case.
- Corpus: 13 `.asm.golden` files + balloon (twin-only pair) = 14 pairs in `twins.json`; routing blocks include rasterpoll/balloon structural groups explicitly routed to issue #50; `examples-sync`, `twins`, `twin-manifest`, budget, scoreboard-freshness suites all exist; scripts (`gen-parity-scoreboard.mjs`, `twin-diff.mjs`, `annotate-cycles.mjs`) exist; `hasVice`/`hasAcme` (`fixture.ts:55/64`); `UPDATE_GOLDEN` (`golden.ts`). `examples/guards/` does not exist yet (correct).
- Every test-file home named in 07 exists except exactly the two marked "(new)" (`termination.spec.test.ts`, the two guards suites + testing module) — correct.
- GitHub issues #50, #65, #51 exist and are open (AR #25's filing condition already honored); phase-1 sequencing was explicitly checked for exhaustiveness traps (none: no `switch-exhaustiveness-check` ESLint rule; the printer is updated in the same phase).

**Same-agent note:** the plan was authored in a prior session by the same model family. Per protocol the MAJOR-severity draft batch went to an independent challenger, which refuted the draft's TypeScript claim with an empirical repro (repo tsc 5.9.3, exact flags) — the reconciled result is PF-001. TypeScript exhaustiveness behavior in this report is grounded in that compile test, not memory.

## Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 0 (see 13) | — |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 1 (PF-003) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-004, PF-007) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001, PF-002, PF-005, PF-006) | 🟡 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 0 | — |
| MINOR | 6 | all resolved — fixes applied 2026-07-19 |
| OBSERVATION | 1 | resolved — fix applied 2026-07-19 |

**Ambiguity Register respected (not re-litigated):** plan-AR #1–#7 and the imported req-AR #12/#17/#20–#25 are all honored by these findings. PF-001/PF-002 operate inside plan-AR #2's chosen mechanism (pre-pass + shared helper stand; only the exhaustiveness idiom and a red-phase description are corrected). PF-003 extends req-AR #24's supersession surface with two assets the register already governs (AR #18 routing, AR #15 measured windows). Nothing reopens a decided option.

---

## Findings

### PF-001: `terminatorTargets` exhaustiveness wording diverges from the repo's own idiom 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Convention Violations)
**Location:** `03-01-il-terminator-and-validation.md` §Shared successor helper ("An exhaustive `switch` (no `default`) so adding a terminator kind is a compile error here"); echoed in the Error Handling table and plan-AR #2's note.
**Codebase Evidence:** `packages/codegen/src/instr/print-instr.ts:130-134` and `packages/codegen/src/instr/translate.ts:427-433` — both existing exhaustiveness guards use a `default:` block with `const _exhaustive: never = x;`. `tsconfig.base.json:9` (`strict: true`, no `noImplicitReturns`).
**The Problem:** The plan's claim was challenged and **verified to work as written**: with the declared return type `readonly string[]`, TS2366 (under `strictNullChecks`) does make a missing case a compile error — confirmed by an empirical compile test with the repo's tsc 5.9.3 and exact flags. Two residual defects remain, both small: (a) the "no `default`" prescription diverges from the codebase's established never-idiom, and (b) the TS2366 guarantee is *contingent* — it evaporates if the signature ever gains `| undefined`, and its error names only the function, whereas the never-idiom's TS2322 names the exact missing kind. The never-idiom is strictly more robust and is what the repo already does.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Amend 03-01 (and plan-AR #2's wording) to specify the repo idiom: `default: { const _exhaustive: never = t; return _exhaustive; }` | Matches both existing guards; error names the missing kind; robust to signature drift | One sentence of plan editing |
| B | Keep "no default" as written | Works today (verified) | Diverges from repo convention; contingent guarantee; anonymous error |

**Recommendation:** Option A — one-line convention alignment that makes the tripwire structural instead of contingent.
Confidence: High — grounded in the challenger's compile test and both cited guard sites.
Hardening: Challenger diverged — it **refuted** this finding's original MAJOR form (which claimed no compile error fires at all; that was wrong) and proposed this MINOR reframe, which was adopted.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-002: Task 2.1.3's red-phase claim is false — unhandled terminators fall through *silently*, they do not ICE 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Stale Assumptions)
**Location:** `99-execution-plan.md` task 2.1.3 ("Red phase: `brcmp` inputs currently ICE as unhandled — verify and document").
**Codebase Evidence:** `packages/codegen/src/instr/translate.ts:532-563` — `translateTerminator`'s switch has no `default` and the method returns `void`, so an unhandled kind emits **nothing** and control falls into the next block's code. No ICE exists on this path (contrast the instruction switch, which ends in a `never` guard at :430-431). Because the method returns `void`, TS2366 offers no protection here either.
**The Problem:** The phase-2 red phase is still red (the byte-sequence assertions fail on missing output), but for a different reason than the task documents — and the actual behavior (silent no-emission for an unhandled terminator kind) is precisely the "silently stops firing" failure class this RD exists to eliminate (req-AR #23). The plan touches this exact switch in task 2.2.1 and leaves the silent fall-through in place for any future terminator kind.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Fix 2.1.3's description (red = missing output, not an ICE) AND extend task 2.2.1 to close the switch with the repo's `default:` never-guard | One extra line while already editing the switch; permanently removes the silent-skip class; consistent with PF-001's idiom | Marginally widens 2.2.1 |
| B | Fix only the 2.1.3 wording | Minimal | Leaves a known silent-miscompile hazard open in the file the plan is editing |

**Recommendation:** Option A — the guard costs one line inside a task that already rewrites this switch, and the plan's own security criteria (99 §Success Criteria 5) claim this hazard class is closed.
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-003: Phase-4 supersession surface omits the `twins.json` routing re-audit (and the balloon measured window) 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-04-guards-fixture-and-corpus.md` §Corpus supersession (items 1–6); `99-execution-plan.md` tasks 4.3.1–4.3.5.
**Codebase Evidence:** `packages/test-harness/test/golden/twins.json` — rasterpoll carries `instruction selection → structural → issue 50` ("poll compare/branch not fused (BNE 3 vs 1)") and balloon carries the same ("bounce compares: BNE 11 vs 3 — compare-and-branch fusion"). Per req-AR #18's addendum the scoreboard generator exits non-zero on any unrouted divergence group. `SCOREBOARD.md` balloon row: measured 162 vs 97 — a measured window over code the flip changes.
**The Problem:** The flip eliminates or shrinks exactly the divergence groups routed to #50 — the twin-diff group set changes for most pairs, so the committed routing blocks must be re-audited/updated in phase 4, or the generator/freshness gate fails mid-phase. Likewise balloon's committed measured window value changes and must be locally re-measured (AR #15 addendum asserts exact equality). Both are mechanically *caught* by existing gates, but the plan presents the supersession surface as an ordered enumeration ("The supersession surface, in order:") and names neither asset — the one place phase 4 would discover unplanned work by breakage.

**Options:**

Single viable resolution: add two entries to 03-04 §Corpus supersession (and touch-up task 4.3.3/4.3.4 file lists) — (a) re-run `twin-diff` per pair and update each pair's `routing` block for the changed group set (the #50-routed groups should shrink to nothing — that disappearance IS the evidenced fix), and (b) re-measure the balloon (and any other phase-stable) measured window locally and refresh `budgets.json`'s measured value. Rejected alternative: rely on the generator/budget gates to surface both mid-phase — that is discovery-by-breakage inside the plan's riskiest phase, and the plan's own text claims to enumerate this surface.

**Recommendation:** Adopt the single path above.
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-004: "All 15 goldens" — the corpus has 13 golden files; with `guards` it will have 14 🟡 MINOR

**Dimension:** 12 — Consistency (with a Codebase Alignment root)
**Location:** `03-04-guards-fixture-and-corpus.md` §Corpus supersession item 2 ("all 15 goldens including `guards`"); `99-execution-plan.md` Overview ("phase 4 changes all 15 in one verify-green unit") and task 4.3.2 ("Regenerate all 15 goldens"); `02-current-state.md` Risks ("all 15 goldens change in phase 4").
**Codebase Evidence:** `packages/test-harness/test/golden/` contains exactly 13 `.asm.golden` files (gate, rasterpoll, slice3a–slice8b). The balloon pair is twin-only — `twins.json` has 14 pairs, but no `balloon.asm.golden` exists and there is no `golden-balloon.spec.test.ts`.
**The Problem:** The plan conflates pairs with goldens: 14 pairs + `guards` = 15 *pairs*, but 13 goldens + `guards` = **14 golden files** to regenerate and hand-review. The error inflates the review-fatigue estimate and would make the closeout delta record's per-fixture enumeration come up one short against the plan's stated count.

**Options:**

Single viable resolution: correct the four locations to "all 14 goldens (the balloon pair is twin-only; 15 pairs on the scoreboard)". Rejected alternative: none — this is an arithmetic/terminology fix.

**Recommendation:** Apply the correction.
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-005: ST-9a's pinned printer text contradicts the printer's own rendering conventions 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Convention Violations) / 12 — Consistency
**Location:** `07-testing-strategy.md` ST-9a ("Printer line exactly `brcmp lt t0, 251 : byte, _L1, _L2`"); `03-01-il-terminator-and-validation.md` §Printer (same text, "reusing the comparison instruction's operand/type rendering").
**Codebase Evidence:** `packages/codegen/src/il/print-il.ts:44-49` — temps render as `%<id>` (`t0` is not a rendering that exists anywhere). :82-90 — the comparison form renders the type tag as a **prefix** between op and operands (`%2 = lt byte %0, 251`), never as a ` : byte` suffix. :183 — `brcond` renders targets as a plain comma list.
**The Problem:** 03-01 claims to reuse the comparison rendering while pinning text that matches it in neither operand style nor tag position. ST cases are immutable oracles — freezing a wrong pin means the printer's one terminator line reads unlike every other line of IL text, and fixing it later requires a sanctioned oracle supersession.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Re-pin to the existing conventions, e.g. `brcmp lt byte %0, 251, _L1, _L2` (op, prefix type tag, rendered operands, target list) | One consistent IL text grammar; actually reuses the comparison rendering as 03-01 intends | ST-9a and 03-01 text edits |
| B | Keep the ` : byte` suffix form as a deliberate terminator-specific style | No plan edit | Contradicts 03-01's own "reusing" claim; `t0` remains un-renderable without new operand code |

**Recommendation:** Option A — the plan already states the intent (reuse the comparison rendering); the pinned example just doesn't match it.
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-006: `cfg.ts` declares "Pure data, no behavior" — the helper's placement rationale ignores it 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (Convention Violations)
**Location:** `03-01-il-terminator-and-validation.md` §Shared successor helper ("Placed in `cfg.ts` because it is a block/CFG-level concern and `instruction.ts` declares itself behavior-free").
**Codebase Evidence:** `packages/codegen/src/il/cfg.ts:10-12` — "Every record is `readonly` — immutability is a contract: the optimizer reads, codegen reads, nobody mutates in place. **Pure data, no behavior.**"
**The Problem:** The stated justification for avoiding `instruction.ts` applies verbatim to the chosen destination: `cfg.ts` carries the same behavior-free module contract. Landing `terminatorTargets()` there as planned silently breaks a documented module invariant the rest of the package can rely on.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep the helper in `cfg.ts` and amend the module header in the same task (records + the one pure successor-enumeration helper) | Minimal churn; the helper genuinely is a CFG-level concern; pure function keeps the immutability spirit | Softens a crisp module contract |
| B | New tiny module (e.g. `il/successors.ts`) beside `termination.ts` | Both data modules keep their purity contracts intact | One more file for ~10 lines |

**Recommendation:** Option A — the contract's point is immutability of the records, which a pure read-only helper doesn't threaten; update the header honestly rather than scatter a 10-line module. (B is genuinely viable if the purity contract is valued as-is.)
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

### PF-007: "Four framings" vs "five framings" wording drift 🔵 OBSERVATION

**Dimension:** 12 — Consistency
**Location:** `00-index.md` Overview ("the four comparison framings materialize a 0/1 byte"); `02-current-state.md` §3 ("dispatches to four framing emitters —" followed by a list of five); vs `01-requirements.md` ("five framings, both polarities/operand orders") and `03-02` ("The five comparison framings").
**Codebase Evidence:** `translate.ts:1022-1073` — five framings exist, implemented as four private emitter methods plus one inline framing in `translateComparison`.
**The Problem:** Terminology drift only — 07's ST-10a matrix correctly enumerates all five width/signedness combinations, so there is no execution risk; but the index/current-state wording undercounts the surface the reader is told about.

**Options:** Single viable resolution: align 00-index and 02-current-state on "five framings (four emitter methods + one inline)".

**Recommendation:** Apply the wording fix (or accept as-is — observation only).
Confidence: High.

**User Decision:** Resolved — user accepted the recommendation ("apply all fixes per recommendations"); fix applied 2026-07-19 and verified in iteration 2.

---

## Iteration 2 — fix verification & regression re-scan (2026-07-19)

> **Previous Iteration**: 7 findings — all accepted per recommendation, fixes applied
> **This Iteration**: 0 new findings
> **Carried Forward**: none

**Fix verification (per finding):**

- **PF-001** ✅ — 03-01 §helper now specifies the `default:` never-guard idiom (citing `print-instr.ts:130-134` / `translate.ts:427-433`); Error Handling row reworded; 99 task 1.2.1 updated.
- **PF-002** ✅ — 99 task 2.1.3 now describes the real red mechanism (silent fall-through, byte assertions fail); task 2.2.1 and 03-02 §Dispatch add the `translateTerminator` never-guard; 03-02 Error Handling gains the row.
- **PF-003** ✅ — 03-04 §Corpus supersession gains the twin-diff routing re-audit (new item 4) and the measured-window re-measurement (item 3); items renumbered to 7; 99 task 4.3.3 names `twins.json` + the balloon frameUpdate re-measure.
- **PF-004** ✅ — counts corrected to 14 goldens / 15 pairs in 03-04 §2, 99 Overview + 4.3.2, and the 02 risk row.
- **PF-005** ✅ — ST-9a and 03-01 §Printer re-pinned to `brcmp lt byte %0, 251, _L1, _L2` with the format rationale. The verification sweep caught one residual location the first application missed — ST-8a still quoted the old `: byte` suffix style — fixed in this iteration (treated as completion of PF-005's fix, not a new finding).
- **PF-006** ✅ — 03-01 placement rationale now names `cfg.ts`'s "pure data, no behavior" header and amends it in task 1.2.1.
- **PF-007** ✅ — 00-index and 02-current-state now read "five framings (four emitter methods plus one inline)".

**Regression checks:** the 03-04 list renumbering's only inbound cross-references were verified — 99 task 4.3.1's "03-04 §1" still points at the unchanged item 1, and 07's integration note was updated to "items 2 and 6". A full stale-pattern sweep (`15 golden`, `t0, 251`, ` : byte,`, "ICE as unhandled", "four … framings", old item numbers) across all plan documents returns hits only inside this report and the session notes, where the original wording is quoted deliberately.

**Fresh scan:** the edited sections were re-read against the code; no new contradictions, phantom references, or sequencing changes were introduced (the never-guard additions land inside tasks that already edit those exact switches, so phase boundaries and the zero-golden-diff guarantees of phases 1–2 are unaffected).

**Result: ✅ PREFLIGHT PASSED — all 7 findings resolved, 0 new findings.**
