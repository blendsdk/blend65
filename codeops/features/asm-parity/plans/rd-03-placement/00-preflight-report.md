# Preflight Report: RD-03 Placement — implementation plan

> **Status**: ✅ **PREFLIGHT PASSED — all 28 findings resolved and applied** (0 critical, 5 major,
> 18 minor, 5 observation). Every finding accepted at the recommended resolution; none deferred,
> none dismissed. **Fixes applied 2026-07-20** to all 7 plan documents; the 4 RD defects
> (PF-008, PF-009, PF-010, PF-022) plus AC-9's tier label are back-propagated into
> [RD-03-placement.md](../../requirements/RD-03-placement.md).
> **Iteration**: 1 (first scan)
> **Artifact**: implementation plan at `codeops/features/asm-parity/plans/rd-03-placement/` (8 docs)
> **Source requirement**: [RD-03](../../requirements/RD-03-placement.md) · RD-stage preflight:
> [00-preflight-report-rd-03.md](../../requirements/00-preflight-report-rd-03.md) (29 findings, resolved)
> **Codebase Grounded**: 40+ source/test/data files examined; every code citation in the plan and
> the RD opened and checked; every empirical claim independently re-measured
> **Git ref at scan start**: `9534760` (branch `feat/asm-parity`)
> **Last Updated**: 2026-07-20
> **CodeOps Skills Version**: 3.11.0

> **Task and line numbers cited in the findings below are the pre-fix ones.** They are the audit
> record and are deliberately not rewritten. Applying PF-001 moved four tasks from Phase 5 into
> Phase 4 and renumbered both phases — see *Fixes applied* at the end for the mapping.

Scan method: lead reconnaissance + re-measurement, then a 5-cluster `preflight-auditor` fan-out on
a **different model family** (Fable), then one independent `design-challenger` over the whole MAJOR
batch — options only, without the lead's picks — reconciled before any recommendation was recorded.

---

## Codebase Context Summary

**Tech stack.** TypeScript (ESM, NodeNext, ES2023, `strict`), Yarn v1 workspaces + Turborepo,
Vitest, ESLint v9 flat config, Node 22. ACME 0.97 and VICE 3.10 present locally; CI installs ACME
and has **no** emulator tier (AR-27).

**Architecture.** AOT 6502 compiler, `Lexer → Parser → Analyzer → SFA → IL → Codegen → Emitter`
across 10 `@blend65/*` packages. The R15 boundary (`frontend`/`language-server` must never import
`codegen`) is enforced twice — ESLint `no-restricted-imports` and `test/boundary.spec.test.ts`.
The parity corpus is 14 byte-exact `*.asm.golden` files plus `balloon`, which deliberately has no
golden; ratchets live in `test/golden/budgets.json`, twin routing in `twins.json`, and the rendered
`SCOREBOARD.md` is gated in CI by a regenerate-and-diff step.

**Change surface (verified against the tree).**

| Seam | File | State today |
|---|---|---|
| directive model | `core/src/instr-model/stream.ts:37-44` | 7 variants, no alignment variant |
| render / size / column | `codegen/src/instr/print-instr.ts:148, 178, 295` | `directiveText` + `directiveByteSize` carry `_exhaustive: never`; `isColumnZeroDirective` does **not** |
| marking hook | `codegen/src/il/lower.ts:1807` (`lowerAddressOf`) | `sym.kind === "constant"` at `:1817-1818`; **8** call sites, all `&`-gated |
| lowering contexts | `lower.ts:294` (`__init`), `:363` (per function) | `LowerCtx` all-`readonly`, rebuilt per unit |
| ordering | `lower.ts:213-220` → `:229-231` → `:237-249` | functions, then init code, then `constData` — the plan's ordering premise holds |
| data entry | `codegen/src/il/cfg.ts:102-109` | 3 fields; exactly 2 construction sites tree-wide |
| emission | `codegen/src/instr/instr-program.ts:191-198` | `const entries = [label(entry.symbol)]` |
| serialization | `codegen/src/instr/serialize-acme.ts:125-131` | data streams appended after code, each via `printInstr` — AR #71's "no change" holds |
| balloon contract | `test-harness/src/testing/balloon.ts:67-81` | 10 checks; the two divergent rows at `:73`/`:79` |
| balloon suite | `test-harness/src/balloon.spec.test.ts:29` | one `skipIf(!(hasVice && hasAcme))` block — **entirely local** |

**Key files examined.** `stream.ts`, `print-instr.ts`, `print-instr.spec.test.ts`,
`instr-program.ts`, `serialize-acme.ts`, `relax-branches.ts`, `function-costs.ts`, `lower.ts`,
`cfg.ts`, `assemble.impl.test.ts`, `platform-plugin.ts`, `c64.ts`, `results.ts`, `build.ts`,
`build-resource-report.ts`, `invoke-acme.ts`, `balloon.ts`, `observables.ts`,
`balloon.spec.test.ts`, `twins.spec.test.ts`, `golden-layout.spec.test.ts`,
`examples-sync.spec.test.ts`, `budgets.spec.test.ts`, `slice3a/3b/7b/8b.spec.test.ts`,
`examples/balloon/main.blend`, `examples/slice7b/{main,game}.blend`, `examples/slice8/main.blend`,
`examples/slice8b/main.blend`, all 14 `*.asm.golden`, `budgets.json`, `twins.json`,
`SCOREBOARD.md`, `gen-parity-scoreboard.mjs`, `.github/workflows/ci.yml`.

### Independent re-measurement — every empirical claim reproduced

Built with the committed `packages/cli/dist/bin.js` and real ACME 0.97 on this tree.

| Claim | Plan states | Measured | |
|---|---|---|---|
| balloon today | 677 B @ `$0A67` | 677 B @ `$0A67` | ✅ |
| pokes removed, pointer computed | 312 B @ `$08FA` | 312 B @ `$08FA` | ✅ |
| + page alignment | 318 B @ `$0900` (pad 6) | 318 B @ `$0900` (pad 6) | ✅ |
| sprite block | 36 | `hi($0900)*4 = $0900/64 = 36` | ✅ |
| the `hi(&X)*4` sequence | 8 instructions via `__frame_Main_main_0sc0` | identical, verbatim | ✅ |
| spurious `W10172` | emitted | emitted | ✅ |
| `!align 256, 0` | assembles, aligns nothing | exit 0, symbol at `$807` | ✅ |
| `!align 255, 0` | pads `$EA` | pads `$EA` | ✅ |
| `!align 255, 0, 0` | pads `$00` | pads `$00` | ✅ |
| `!align 256` | syntax error | syntax error | ✅ |

**This is the strongest-grounded plan in the initiative so far.** Its measurements are real, its
ACME trap table is correct in all four rows, and the free-proof premise — "no fixture takes a const
array's address today" — is **true repo-wide** (the only `&` in `examples/` and the inlined fixture
sources is `&onIRQ`/`&onNMI`). Dimension 10 returned **zero** findings: no scope creep in either
direction. The findings below are about oracles, plumbing prose, and phase placement — not about
the design, which survives intact.

---

## Summary by dimension

| # | Dimension | Findings | Highest |
|---|---|---|---|
| 1 | Ambiguities | 2 | 🟠 |
| 2 | Implicit Assumptions | 2 | 🟠 |
| 3 | Logical Contradictions | 2 | 🟠 |
| 4 | Completeness Gaps | 6 | 🟠 |
| 5 | Dependency Issues | 1 | 🟡 |
| 6 | Feasibility Concerns | 1 | 🟡 |
| 7 | Testability | 9 | 🟠 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 2 | 🟡 |
| 10 | Scope Creep | **0** | — |
| 11 | Ordering & Sequencing | 1 | 🟠 |
| 12 | Consistency | 7 | 🟡 |
| 13 | Codebase Alignment | 8 | 🟠 |

## Summary by severity

| Severity | Count | Status |
|---|---|---|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 5 | ✅ all resolved |
| 🟡 MINOR | 18 | ✅ all resolved |
| 🔵 OBSERVATION | 5 | ✅ all resolved |

---

# 🟠 MAJOR

### PF-001: Phase 4 leaves CI red, and M4's "in the same change" is split across two commits 🟠 MAJOR

**Dimension:** 11 Ordering & Sequencing (also 3, 13)
**Location:** `99-execution-plan.md` Phase 4 (`:88-109`) vs Phase 5 (`:113-133`); preamble `:17-18`; risk register `:159`
**Codebase Evidence:** `.github/workflows/ci.yml:60-61` — `yarn gen:scoreboard && git diff --exit-code -- packages/test-harness/test/golden/SCOREBOARD.md`, a **hard-fail** step (contrast `twin-diff` at `:52-53`, which carries `continue-on-error`). `scripts/gen-parity-scoreboard.mjs:207` rebuilds every pair from `examples/` source through the real compiler + ACME. `SCOREBOARD.md:9` currently reads `| balloon | 677 | 251 | 2.70 | 787 | 248 | 3.17 | 125 | 97 | 1.29 |`.

**The problem.** Task 4.2 rewrites `examples/balloon/main.blend` (677 → ~318 bytes), but the curing
tasks — 5.1 (bytes ratchet), 5.4 (routing prose), 5.5 (regenerate the scoreboard) — sit in Phase 5,
a separate `/gitcm` commit. The freshness gate rebuilds from source, so the Phase-4 tree is
CI-red by construction. The plan does not see this because its Verify command (fixed by AR #75)
is strictly weaker than CI and omits the gate — and its risk register asserts the opposite
("Local-only failure — CI stays green", `:159`).

It is also a self-contradiction: the preamble says "The corpus regenerates exactly once, **in
Phase 4**", Phase 4's banner says "Everything that moves, moves here", AR #73 says "the corpus then
regenerates exactly once, **at the balloon rewrite**" — yet nothing that regenerates is in Phase 4.
RD M4 (`RD-03-placement.md:145`) requires ratchets re-derived "in the same change", and AC-8's
routing re-audit likewise.

**Honest nuance (challenger).** CI triggers on `push: [v3]` and `pull_request` (`ci.yml:3-6`), and
work is on `feat/asm-parity` — so a red run only materializes with an open PR. The Phase-4 commit
is still not CI-clean as a tree state (bisect-hostile), and the M4 / AR #73 contradiction stands
regardless of push timing.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Move 5.1, 5.3, 5.4, 5.5 into Phase 4's commit; Phase 5 keeps 5.2 (VICE-local), the review gates and closeout. **Plus** append the freshness gate to the Verify line for corpus-touching phases | Makes the plan text, AR #73 and M4 simultaneously true; removes the false-ledger commit; fixes the root cause (Verify weaker than CI) for future RDs | Phase 4's commit grows; the 5.6 review gate must read the Phase-4 diff |
| B | Keep the split; state that Phases 4+5 are one push/PR unit, that Phase 4 alone is not CI-clean, and correct the risk register | Minimal edit | Documents the defect instead of removing it; still leaves a commit whose committed ledgers are false for its own tree |

**Recommendation: Option A.** It is what M4 and AR #73 already say — this is the plan drifting from
its own resolved decision, not a new decision. The Verify addendum matters independently: the root
cause is that the plan's green-check cannot see a gate CI fails on, and that trap outlives this RD.
*Executor note:* if 5.2's local re-measure moves `measuredMaxCycles`, `SCOREBOARD.md` regenerates a
second time in Phase 5 — the scoreboard renders measured columns from committed `budgets.json`
(`gen-parity-scoreboard.mjs:224-233`, rendered at `SCOREBOARD.md:9`). Say so in the task.

**Confidence:** High. **Hardening:** independent challenger; concurred, and contributed the CI-trigger
nuance, the Verify addendum, and the 5.2 second-regeneration note.

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**

---

### PF-002: The marking set's plumbing is described against one of two lowering contexts, and the one it omits is untested 🟠 MAJOR

**Dimension:** 2 Implicit Assumptions / 13 Codebase Alignment (Impact Blindness)
**Location:** `03-01-directive-and-marking.md` §3 ("The set lives on the lowering context"); `99-execution-plan.md` tasks 2.3, 2.4
**Codebase Evidence:** `packages/codegen/src/il/lower.ts:161-198` — `LowerCtx` is an all-`readonly` interface constructed at **two** sites: `:294` (`lowerInitCode`, `fqName: "__init"`) and `:363` (`lowerFunction`). The init path reaches `lowerAddressOf` at `:336`. `lowerAddressOf` has **8** call sites (`:336, :485, :1042, :1466, :1607, :2473, :2494, :2528`), all `&`-gated.

**The problem.** The plan says the set "lives on the lowering context" and justifies its
completeness solely with "every function lowered first (`:213-220`)". But `LowerCtx` is per
lowering *unit*, not per program — and there is a second one. Adding a field to the interface forces
both object literals to supply it (typecheck), but **nothing forces them to share an instance**: an
executor can hand `lowerInitCode`'s context a fresh `new Set()`, and it compiles.

The omitted path is live. Verified by compiling a probe on this tree:

```blend65
module Main;
const TABLE: byte[] = [1, 2, 3, 4];
let ptr: word = &TABLE;          // module scope — lowers through __init, not through any function
function main(): void { poke($D020, lo(ptr)); }
```

emits `LDA #<__data_Main_TABLE` / `LDA #>__data_Main_TABLE` **from `__init`** (`lower.ts:336` →
`lowerAddressOf`). Every planned spec test ST-C5…ST-C10 places `&` inside a function body, so this
implementation passes the entire committed suite while `M1` is silently violated for a real
surface — a const array whose address is taken only at module scope never aligns, and the sprite
pointer computed from it is wrong with no diagnostic.

The plan's own justification actively points away from it: task 2.4 says the set is complete
"because every function lowered first". True but incomplete — init lowering at `:229-231` also
precedes the `constData` loop at `:237-249`, and the plan never says so.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Amend §3 + tasks 2.3/2.4: the set is created in `lowerToIL` and threaded into **both** `LowerCtx` construction sites (`:294`, `:363`); add one spec-test row — a module-scope `let p: word = &T;` marks `T` | Closes a membership hole no planned test can see; corrects the mechanism prose; cost is a paragraph and one test | None material — the signature changes are internal to one file |
| B | Add only the spec-test row, leaving the prose as is | Mechanically forces correctness | In a plan this precise, wrong mechanism prose is itself a defect; the executor still has to rediscover the second context |

**Recommendation: Option A.** Phase 2 is the plan's own "sensitive" phase and its entire premise is
exact membership. A hole the oracle cannot see is exactly what this phase exists to prevent. The
ordering argument the plan gives covers completeness *in time*; it says nothing about *reachability
of the set* from the init context, which is the actual risk.

**Confidence:** High. **Hardening:** independent challenger; concurred without reservation and
supplied the precise failure mechanism (interface forces the field, not the shared instance).

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**

---

### PF-003: ST-C14/ST-C15 are declared CI-tier but have no file, and the only balloon suite is entirely VICE-gated 🟠 MAJOR

**Dimension:** 4 Completeness Gaps / 7 Testability
**Location:** `99-execution-plan.md:92-93` (task 4.1) and `:103` (task 4.5); `07-testing-strategy.md:66-67`
**Codebase Evidence:** `packages/test-harness/src/balloon.spec.test.ts:29` — the whole file is one `describe.skipIf(!(hasVice("c64") && hasAcme()))` block. Precedent for the correct shape: `slice3a.spec.test.ts:28/47`, `slice3b.spec.test.ts:26/48`, `slice7b.spec.test.ts:28/43`, `slice8b.spec.test.ts` — each carries a `describe.skipIf(!hasAcme())` block **and** a separate VICE block. `budgets.spec.test.ts:233` proves a hasAcme-only balloon build runs in CI.

**The problem.** Task 4.1 says "Write ST-C14/ST-C15 (CI tier)" and names no file; task 4.5 names
`balloon.spec.test.ts` for ST-C18. An implementer following 4.5's example puts 4.1's tests in the
same block. They pass locally — the implementer has VICE — and CI reports them **skipped, not
failed**. RD AC-1 and AC-4's "[CI]" labels become false with everything green, and ST-C15 is CI's
*only* placement assertion (`% 256 === 0` **and** `< $1000`, the check the RD-stage preflight added
precisely so CI would have one). A skipped test raises no alarm; this failure is invisible.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Name the file and the guard in task 4.1: a second `describe.skipIf(!hasAcme())` block in `balloon.spec.test.ts` (matching the slice dual-block precedent), or a new `balloon-placement.spec.test.ts` | Matches what every other fixture in the tree already does; makes the [CI] label true; one extra balloon build in CI, negligible | None |
| B | Add only a plan note "must run in CI — not inside the VICE guard" | One line | Strictly weaker; the plan names files everywhere else, and an unnamed 4.1 sitting beside a VICE-only 4.5 example is precisely how the mistake happens |

**Recommendation: Option A**, with the second-block-in-`balloon.spec.test.ts` shape — it is the
in-tree convention, verified across four sibling suites. Green CI asserting things it never ran is
the worst class of false confidence, and AC-1/AC-4 are this RD's central CI claims.

**Confidence:** High. **Hardening:** independent challenger; concurred and preferred the same-file
dual-block shape on convention grounds.

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**

---

### PF-004: AC-3's emitted-pointer-store clause is proven nowhere, and its only mapped test is a tautology 🟠 MAJOR

**Dimension:** 7 Testability (also 3, 12)
**Location:** `01-requirements.md:15` (M2 → AC-3 → ST-C13); `07-testing-strategy.md:57`
**Codebase Evidence:** RD `RD-03-placement.md:416-419` tags AC-3 **[CI]** and demands *both* "the emitted pointer store is equivalent to `LDA #>sym` / `ASL` / `ASL` / `STA $07F8`" **and** the symbol-map identity. The RD records the actual 8-instruction emission at `:358-367` (independently reproduced above) and routes it to #58/#60.

**The problem.** ST-C13 asserts only the identity, computing both sides in TypeScript from the same
symbol-map number: `(addr >> 8) * 4 === addr >> 6` holds arithmetically whenever `addr % 256 === 0`
— i.e. whenever ST-C12 already passed. **It cannot fail independently, and it inspects no emitted
instruction.** AC-3's first clause has no CI proof at all: the mixed fixture contains no `$07F8`
store; ST-C14 scans only for staging-store absence and sprite-bytes-once; ST-C15 checks only the
address. The one behavioural proof — `peek($07F8) === addr / 64` (ST-C18) — is **local VICE only**
and is mapped to AC-5, not AC-3.

The exposure is concrete and near-term: #58/#60 are the RD's own routed follow-ups and will rewrite
exactly this `hi(&X) * 4` materialization. A regression there (wrong byte, wrong shift count) keeps
every CI gate green while the sprite renders from garbage.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Extend ST-C14's existing CI asm scan with a loose **ordered-subsequence** assertion on the pointer store — `LDA #>__data_Main_BALLOON` … `ASL` … `ASL` … `STA $7F8` — and re-map AC-3 → ST-C13 + ST-C14 | ~10 lines; ST-C14 already reads balloon's emitted asm; expectation derives from the recorded planning-time measurement, satisfying 07's own "never from imagined behaviour" rule | Couples to codegen shape #58/#60 will deliberately change — acceptable if kept a subsequence and commented |
| B | Re-scope AC-3's equivalence clause to Local tier citing ST-C18; amend the M2 row; record the deviation from the RD's [CI] label | Honest; no new test | Downgrades a [CI] Must-Have when CI proof costs ~10 lines |
| C | Discharge the clause as a closeout review against the RD's Known Divergence | Cheapest | Violates the plan's own Kind discipline (`07-testing-strategy.md:16-18`: a closeout may not cite a review as if it were a test) |

**Recommendation: Option A.** A tautological test discharging a Must-Have is a mapping-integrity
defect, and the fix is cheap. Keep the assertion a subsequence rather than an exact 8-instruction
match, with a comment that #58/#60 revises it — a deliberate codegen change updating its own test
is normal and is exactly the signal you want when that work lands.

**Confidence:** High. **Hardening:** independent challenger; concurred, rated it "MAJOR at the low
end" (ST-C18 backstops behaviour locally), and contributed the subsequence-not-exact-match
refinement.

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**

---

### PF-005: The mixed-alignment fixture — the RD's only new artifact and the sole carrier of AC-7 — has no creation task, no name, and two contradictory homes 🟠 MAJOR

**Dimension:** 4 Completeness Gaps / 1 Ambiguities
**Location:** `99-execution-plan.md:71-73` (task 3.1); `03-02-balloon-and-corpus.md` §4
**Codebase Evidence:** the cited pattern `packages/test-harness/src/testing/balloon.ts:44-58` copies a **committed** source directory (`:45-47`) into a temp dir — it presupposes committed source. RD `RD-03-placement.md:321` lists "plus the new fixture's `examples/` directory" under Integration Points, but **no plan task creates one**. The test needs `build()` from `@blend65/compiler` (`balloon.ts:19`), so it cannot live in `@blend65/codegen` — that import would invert the package edges.

**The problem.** Task 3.1 names no path, no fixture name, and no package for either the source or
the test file. "Built in-test … following `testing/balloon.ts:44-58`" admits two readings — a
committed `examples/<name>/` directory (what the RD says, and what the cited pattern actually does)
or an inline source string written to the temp dir (the natural invention). The executor either
stalls or picks, and the natural pick contradicts the RD's committed text.

Verified drag-free either way: a new `examples/` directory trips nothing —
`examples-sync.spec.test.ts:38-63` iterates a closed `INLINED_MODULES` list,
`twins.spec.test.ts:93-99` keys the pair set to `*.asm.golden` files plus balloon, and
`budgets.spec.test.ts:226-230` closes over a fixed builder list.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A** | Name both in task 3.1 — a committed `examples/<name>/main.blend` (e.g. `align-mixed`) **plus** a new `describe.skipIf(!hasAcme())` spec file in `packages/test-harness/src/` — and make the fixture's creation an explicit subtask | Matches the RD's Integration Points and AR #70's own precedent citation; no RD amendment; keeps the negative control's source reviewable, which matters because the membership rule is syntactic; verified drag-free | `examples/` gains its first member with no budgets row — a new category convention doesn't yet cover |
| B | Decide inline-source-in-test and back-propagate a correction to the RD's Integration Points | Keeps `examples/` purely corpus | Abandons the pattern the task itself cites, for no gain |
| C | Commit the source under `packages/test-harness/src/testing/fixtures/` | Keeps `examples/` purely corpus fixtures | Needs the same RD back-propagation as B; `examples/` already tolerates the non-golden balloon |

**Recommendation: Option A**, plus a header comment in the fixture stating it is a placement probe
deliberately outside the corpus — no golden, no twin, no budgets row (AR #70) — so future corpus
tooling doesn't sweep it in. That header is the mitigation for A's only real cost.

**Confidence:** High. **Hardening:** independent challenger; concurred, surfaced Option C as a
genuine alternative it nonetheless did not recommend, and contributed the header-comment mitigation.

**User Decision:** ✅ Resolved — User accepted recommendation: **Option A**

---

# 🟡 MINOR (18)

> **User Decision — PF-006…PF-014** (batch A, findings that change test or plan substance):
> ✅ Resolved — User accepted all 9 recommendations.
> **User Decision — PF-015…PF-023** (batch B, correction-grade):
> ✅ Resolved — User accepted all 9 recommendations.
> PF-008, PF-009, PF-010 and PF-022 are defects in the **RD** and carry a back-propagation
> obligation in addition to the plan edit.

| # | Finding | Evidence |
|---|---|---|
| **PF-006** | **`assemble.impl.test.ts:151` is an unowned `ConstDataEntry` construction site.** Task 2.2 adds a **required** `aligned: boolean`; there are exactly two construction sites tree-wide — `lower.ts:240` (task 2.4 owns it) and this typed literal, which no task names. Phase 2 cannot typecheck green until it gains `aligned: false`. Loud and trivially fixed, hence MINOR rather than the MAJOR two clusters proposed — but the plan's task grain is line-level everywhere else | `packages/codegen/src/instr/assemble.impl.test.ts:151-155`; `99-execution-plan.md:53` |
| **PF-007** | **`twins.json` has FOUR balloon routing rows; task 5.4 names only the `#49` pair.** The `#51` row ("the remaining size gap is the unrolled sprite copy below, not layout") and the `#52` row ("LDA 96 vs 27, STA 87 vs 21") are equally falsified by the rewrite — 63 LDA/STA pairs vanish. The freshness gate is blind to prose, so all three ship false | `twins.json:405, 410, 415-416, 423`; `99-execution-plan.md:120-124` |
| **PF-008** | **S1's slice8b justification is factually wrong — and so is the RD's.** Both say slice8b's destinations "(`$0400` screen RAM, `$C000`) sit below the PRG load base". `$C000` is far **above** `$0801`; and neither is the const→copy destination — the copies go into the *mutable staging arrays* `title2`/`table2` via `copyBytes`, and `$0400`/`$C000` is where those are poked *from*. The no-op conclusion survives for a different reason (placement cannot substitute for a mutable buffer the source itself indexes), but the fence as written hands an executor a wrong classification rule. **Back-propagate to RD:184-188** | `examples/slice8b/main.blend:6-7, 17-18, 21-39`; `01-requirements.md:27-30` |
| **PF-009** | **`slice7` is mislabeled a "by-ref const data" negative control.** Verified: only `slice7b` (2 lines) and `slice8b` (4) contain `LDA #</#>__data`; `slice7` reads `__data_Gfx_TABLE,X` directly indexed and materializes no address. Consistent with the plan's own +159/+276 = +435 figure, which carries no slice7 term — and task 2.6 quietly drops slice7 from its confirmation list. As written, task 2.6 has the executor write a false statement into the permanent commit record. **Back-propagate to RD AC-2** | `slice7.asm.golden:138`; `07-testing-strategy.md:68`; `99-execution-plan.md:46` |
| **PF-010** | **RD:332-333 still lists "the new fixture's pair registration"** in `twins.spec.test.ts` — un-back-propagated residue directly contradicting AC-7, AR #70, plan 03-02 §4 and task 3.1, all of which mandate no golden, no twin, no pair. Since `01-requirements.md:7` makes the RD authoritative for uncited facts, an executor deferring to it registers a pair and fails `twins.spec.test.ts:93-99`. **Back-propagate: strike the phrase** | `RD-03-placement.md:332-333` |
| **PF-011** | **ST-C1–ST-C3 name module-private functions.** `print-instr.ts` exports only `hex16` (:46), `printInstr` (:222) and `instrByteSize` (:239); `directiveText` (:148), `isColumnZeroDirective` (:178) and `directiveByteSize` (:295) are private. Literal execution exports three internals — an unsanctioned api-surface change under this repo's active `api-surface` lens. The existing spec file already has the right idiom: `textOf(directive({…}))` through `printInstr`, and `instrByteSize` for size | `packages/codegen/src/instr/print-instr.spec.test.ts:110-131` |
| **PF-012** | **M2's page-vs-block granularity is undiscriminated at balloon.** `$08FA`'s next 64-byte boundary and next 256-byte boundary are **both `$0900`** — so an emission that wrongly passed `boundary: 64` still yields block 36, and ST-C13/ST-C15 both pass. Only the mixed fixture might catch it, by layout luck. Balloon can never be evidence for M2. One-line hardening: have ST-C11 also assert the rendered operand text `!align 255, 0, 0` end to end | `02-current-state.md:16-21`; `07-testing-strategy.md:55, 57, 67` |
| **PF-013** | **No test pins two address-taken arrays both aligned.** ST-C10 is one-taken/one-not; task 2.7 is same-array-twice and two-modules. An implementation storing a single symbol slot instead of a set passes every one of them, then emits one directive for a two-sprite program — the canonical C64 game shape this feature exists for. 07's stated exclusion ("cumulative padding … would test the assembler") justifies skipping the *e2e* case, not the unit marking case, which needs no assembler | `07-testing-strategy.md:39-46, 98-100`; `99-execution-plan.md:64-65` |
| **PF-014** | **ST-C12's "pays no padding" needs a declaration-order anchor.** The symbol map exposes labels only — no code-end symbol — so the claim is computable only as `unaligned.addr === aligned.addr + aligned.data.length`, which requires the fixture to declare the **address-taken array first**. Unpinned, an executor falls back to `% 256 !== 0`, which can flake when the unaligned array lands on a boundary by accident after any unrelated codegen size change | `07-testing-strategy.md:56`; `label-file.ts:29-49`; `lower.ts:237-250` |
| **PF-015** | **ST-C16 is not a test anyone writes.** No task creates it; the mechanism is the pre-existing golden tier, whose oracle is *whatever is committed*, with a sanctioned `UPDATE_GOLDEN` bypass. "Byte-identical to their pre-RD-03 state" is guarded only by nobody regenerating — a review act, which 07's own Kind doctrine forbids conflating with a test. State that ST-C16 is the existing tier plus a closeout `git diff` over `test/golden/*.asm.golden`, and that no `UPDATE_GOLDEN` run is permitted anywhere in this RD | `07-testing-strategy.md:15-18, 68`; `packages/test-harness/src/golden.ts:57-63` |
| **PF-016** | **AC-9's mapped proof, "existing gate \| CI", is a phantom.** Verified: CI has no `spec/` freeze step — install, typecheck, lint, build, ACME, test, twin-diff, freshness only — and no test anywhere guards `spec/`. The only check is task 5.8's manual `git status --porcelain spec/`, which reports working-tree changes and passes a *committed* spec edit clean. Relabel as a closeout review over the RD's commit range | `01-requirements.md:21`; `.github/workflows/ci.yml` |
| **PF-017** | **AC-8 is [CI] in the RD but review-only in the plan**, with no note of the downgrade — while its checkable half is trivially mechanizable: one assertion that balloon's routing entries carry no `sourceForced` and no `/copy\(\) language gap/` note. Verified this breaks nothing: `twin-manifest.spec.test.ts:78` asserts `sourceForced` only against a synthetic staged manifest, and the loader keeps the field optional | `RD-03-placement.md:453-457`; `01-requirements.md:16`; `twin-manifest.ts:48` |
| **PF-018** | **Traceability-table defects in `01-requirements.md`.** (a) M1's demand names the mutable-variable exclusion but its proof cell omits ST-C8, the only test that proves it (and ST-C9/ST-C10). (b) ST-C15 — the direct proof of AC-1 — is filed under M4's row (AC-6/AC-8, ratchets and prose), which it proves nothing about, while M1/M3 omit it. (c) M1 says "const **array**" while ST-C9 asserts the rule admits any const aggregate. The closeout's AC walk (task 5.9) follows this table | `01-requirements.md:13, 15, 16` |
| **PF-019** | **`examples/slice7b/game.blend:15` is `sum`'s *declaration*, not the call.** The call is `poke($C002, sum(TABLE, length(TABLE)))` at `examples/slice7b/main.blend:19`. The substantive trap is verified true; only the pointer is wrong — but it is the citation for the plan's single most important trap, at the exact spot that says "will silently do the wrong thing if the implementer trusts the obvious reading" | `02-current-state.md:52-53` |
| **PF-020** | **The regeneration mechanism is never named.** Task 5.5 says "Regenerate `SCOREBOARD.md`; freshness gate green" without naming `yarn gen:scoreboard` or the gate's actual check; 5.1/5.3 say "re-derive" without a procedure (the budget tier cannot produce new values — it only fails on `actual > budget`, so each fixture must be built and read per AR #56). The scoreboard header forbids hand-editing, and the generator aborts before writing on stale routing | `99-execution-plan.md:115-125`; root `package.json:21`; `ci.yml:61` |
| **PF-021** | **Phase 2's test tasks name no file**, alone among the phases — though exact in-tree homes exist: `packages/codegen/src/il/lower-address-of.spec.test.ts` (task 2.1) and `lower-address-of.impl.test.ts` (task 2.7). Task 3.1 likewise names no test file (see PF-005) | `99-execution-plan.md:50-52, 64-65` |
| **PF-022** | **"Three exhaustive switches" is false — only two force the decision.** `directiveText` (:148) and `directiveByteSize` (:295) carry `const _exhaustive: never`; `isColumnZeroDirective` (:178-180) is a boolean expression `d.kind === "origin" \|\| … \|\| "symbolDef"` and will silently return `false` for the new variant, rendering `!align` at instruction indent. Task 1.5 and ST-C3 do cover it, so the practical risk is low — but the claim inherited from the RD-stage PF-008 is wrong, and it is the reason an executor might trust the compiler to enumerate the sites. **Back-propagate to the RD** | `packages/codegen/src/instr/print-instr.ts:178-180`; `03-01-directive-and-marking.md` §2; `RD-03-placement.md` |
| **PF-023** | **Task count disagreement**: `00-index.md:50` says "5 phases, 41 tasks"; `99-execution-plan.md:4` says 0/40 and the checklist counts 40 (6+7+8+9+10) | `00-index.md:50` |

---

# 🔵 OBSERVATIONS (5)

> **User Decision — PF-024…PF-028:** ✅ Resolved — User accepted all 5; each is actioned as a
> document correction rather than merely noted.

| # | Finding |
|---|---|
| **PF-024** | `08-closeout.md`, created by task 5.9, is absent from the index's document map (`00-index.md:40-50`) — the plan's own table of contents is incomplete against its execution plan. |
| **PF-025** | The index routing tag reads "complex (Phase 2: sensitive)", noting one per-phase exception but not the other — Phase 1 is tagged `standard` (`99-execution-plan.md:24`). Suggest "complex (Phase 1: standard, Phase 2: sensitive)". |
| **PF-026** | `02-current-state.md:87` says `needsDataInit` is "declared on `PlatformPlugin`"; it is declared on `PreambleOptions` (`packages/core/src/platform/platform-plugin.ts:40`) and passed *to* plugins. The load-bearing claim — no plugin consumes it, so no hidden runtime const-data copy — was re-verified and **holds** (`c64.ts:89-93` drops it). Same wording appears in the RD-stage report's verified-clean list; the plan inherited it. |
| **PF-027** | ST-C4's "ahead of the label" clause is self-fulfilling at unit tier — the test constructs the stream `[align, label]` and rendering preserves entry order, so it asserts its own input. The property is established by `constDataStream` in Phase 3 and covered discriminatingly by ST-C11. Suggest scoping ST-C4 to what the renderer owns (column 0, own line). |
| **PF-028** | `lowerAddressOf` has **8** call sites (`lower.ts:336, 485, 1042, 1466, 1607, 2473, 2494, 2528`); the plan and RD cite `:1042` as though it were the only one. All eight are `isAddressOfExpr`-gated, so the exclusion claim **holds** — but task 2.3 instructs the executor to write a comment asserting "`lower.ts:1042` guards this call", which is true of one call site out of eight. See PF-002 for the consequential half. |

---

## Verified clean — checked and refuted, recorded so nobody re-checks

| Worry | Verdict |
|---|---|
| The free-proof premise ("no fixture takes a const array's address today") | **True repo-wide** — the only `&` in `examples/` and inlined fixture sources is `&onIRQ`/`&onNMI` |
| ACME `!align` semantics, all four rows of the plan's trap table | **All four independently reproduced** on ACME 0.97 |
| The 677 / 312 / 318 and `$0A67` / `$08FA` / `$0900` measurements | **All reproduced exactly**, including the 8-instruction sequence and `W10172` |
| `serialize-acme.ts` needs no change (AR #71) | **Holds** — data streams render through `printInstr` (`:127-132`) |
| Ordering: the set is complete when `constData` is built (AR #72) | **Holds** — functions `:213-220`, init `:229-231`, `constData` `:237-249` |
| `@blend65/platforms` needs no switch arm | **Holds** — plugins only construct `outputFile` directives |
| Relaxation / per-function costs unaffected by a data directive | **Holds** — `relax-branches.ts:91`, `function-costs.ts:52` skip non-`code` streams; and `relax-branches.ts:209-218` ICEs on a directive inside a code stream, so a misplaced align cannot silently corrupt displacement math |
| `programByteSize` has no production caller | **Holds** (its own JSDoc is stale, the plan's claim is right) |
| A hidden runtime const-data copy exists | **No** — `needsDataInit` reaches no plugin (`c64.ts:89-93`) |
| CI-tier resolved-address assertions are writable without VICE | **Yes** — `BuildResult.symbolMap` (`results.ts:55`, populated `build.ts:142`) |
| A new `examples/` directory drags in a golden/twin/budget row | **No** — `examples-sync`, twin-coverage and budget-coverage all enumerate closed lists |
| Nothing asserts the `AcmeDirective` union's shape or an observables table's length | **Confirmed** — the shrink from 10 to 8 checks breaks no existing test |
| `hi(&X)*4` wrap ≥ `$4000` | Double-guarded — E10033 at `dataBase = $2000` makes it physically unreachable under `DEFAULT_PROFILE` |
| Deleting the 63 pokes renumbers balloon's label anchors | **No** — `Main_main_L5`/`L3` survive |
| Zero-length array · `&` in an interrupt body · `&` in a non-entry module · double-`&` | All covered by 03-01 §4, the shared `lowerFunction` path, and task 2.7 |
| Dimension 10, scope creep, in either direction | **Zero findings** — every task traces to an M/AC, a plan-stage AR, or standing convention; no package outside the declared fence is touched |

---

## Adversarial checklist (same-agent bias)

Not a same-session review of the authoring context, but the same model family authored the plan.
Counter-measures actually applied: the 13-dimension scan ran as five independent
`preflight-auditor` dispatches on **Fable**, a different family, each blind to the others; the
whole MAJOR batch then went to an independent `design-challenger` on Fable **without the lead's
picks**. All ACME behaviour is cited to executed commands against ACME 0.97 on this machine, not to
memory of the manual. All byte and address figures are re-measured, not read from the documents.
Three findings (PF-002, PF-012, PF-016) came from asking "what would pass every test and still be
wrong?" rather than from reading the documents forward.

---

## ✅ Verdict — PREFLIGHT PASSED, all 28 findings resolved

The design is sound and stays as planned. No architectural change was recommended, none was made,
and Dimension 10 returned zero findings in either direction. The plan's empirical foundation is
the strongest in the initiative to date — every byte count, every symbol address, and all four
rows of the ACME `!align` trap table were reproduced independently before the scan began.

**The three findings that would actually have bitten**, in order of cost:

1. **PF-002** — a marking-set threaded into one of two lowering contexts passes every planned test
   and silently never aligns a module-scope `&`. Confirmed reachable by compiling a probe.
2. **PF-001** — Phase 4 as sequenced is CI-red by construction, and the plan's own Verify command
   cannot see the gate that fails.
3. **PF-003 / PF-004** — two [CI]-labelled acceptance criteria proven by tests that either land in
   a skipped block or cannot fail. Same disease: CI claiming what CI never ran.

A fourth pattern is worth naming because it recurred: **PF-002, PF-012 and PF-013 are all "passes
the whole suite while the emitted code is wrong."** Each closes for about one line of test.

### Fixes applied — plan documents ✅

All applied 2026-07-20, in the same pass that recorded the decisions.

| Doc | Findings |
|---|---|
| `99-execution-plan.md` | PF-001 (move 5.1/5.3/5.4/5.5 into Phase 4; add the freshness gate to Verify; note 5.2's possible second regeneration), PF-002, PF-003, PF-005, PF-006, PF-007, PF-013, PF-014, PF-020, PF-021 |
| `07-testing-strategy.md` | PF-004, PF-009, PF-011, PF-012, PF-013, PF-014, PF-015, PF-017, PF-027 |
| `01-requirements.md` | PF-004, PF-008, PF-016, PF-017, PF-018 |
| `03-01-directive-and-marking.md` | PF-002, PF-022, PF-028 |
| `03-02-balloon-and-corpus.md` | PF-005, PF-007 |
| `02-current-state.md` | PF-019, PF-026 |
| `00-index.md` | PF-023, PF-024, PF-025 |

**Two consequential renumberings the fixes introduced**, recorded so the diff is not surprising:

- **Phase 4 absorbed the four corpus tasks** (old 5.1/5.3/5.4/5.5). Phase 4 is now 4.1–4.13,
  Phase 5 is 5.1–5.6. Phase 3 gained the explicit fixture-creation task (3.1), so the plan is
  **41 tasks**, which is what `00-index.md` already claimed.
- **Three new ST IDs**: `ST-C19` (two arrays both `&`-taken — PF-013), `ST-C19b` (module-scope `&`
  — PF-002), `ST-C20` (twins routing prose, the mechanizable half of AC-8 — PF-017). Appended
  rather than renumbered, so every existing ST-C reference stays valid.

### Back-propagation to RD-03 (4 items) ✅ applied

| Finding | RD location | Correction |
|---|---|---|
| PF-008 | `RD-03-placement.md:184-188` (S1) | slice8b's const→copy destinations are the mutable staging arrays `title2`/`table2`, not `$0400`/`$C000` — and `$C000` is above the load base, not below it. The no-op conclusion stands on a different reason |
| PF-009 | AC-2 | `slice7` materializes no address; it is not a by-ref negative control. Only `slice7b` and `slice8b` are |
| PF-010 | `:332-333` (Integration Points) | Strike "the new fixture's pair registration" — residue contradicting AC-7 and AR #70 |
| PF-022 | Technical Requirements | Two exhaustive switches carry a `never` arm, not three; `isColumnZeroDirective` does not and must be handled deliberately |

PF-004 and PF-016/PF-017 additionally touch the RD's **tier labels** (AC-3, AC-8, AC-9). The
resolutions keep AC-3 and AC-8 at `[CI]` — each gained a cheap CI oracle (ST-C14's ordered
subsequence, ST-C20's routing assertion) — and relabel **AC-9 to `[Review]` in the RD itself**.
Restating it there rather than only in the plan's mapping table was a judgement made while
applying: `01-requirements.md:7` makes the RD authoritative for uncited facts, so a false `[CI]`
left in the RD beside a `Review` row in the plan would reproduce exactly the contradiction PF-010
was about.

## Relationship to the Ambiguity Register

No finding re-litigates AR #64–#75. PF-001 holds the plan *to* AR #73 rather than against it;
PF-005 implements AR #70's stated precedent rather than revisiting it. Findings PF-008, PF-009,
PF-010 and PF-022 are defects **in the RD** surfaced through the plan and are marked for
back-propagation.
