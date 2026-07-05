# Preflight Report: RD-18 — Codegen Language-Feature Completion

> **Status**: ✅ PREFLIGHT PASSED — all 6 findings resolved (0 critical, 2 major, 4 minor, 0 observation; user approved all recommendations 2026-07-04, PF-002 as Option A, and **all fixes applied** to RD-18 + `00-ambiguity-register.md` AR-112/AR-114/new AR-115). Iteration-2 re-scan clean: no stale diagnostic codes remain (E10180/E10181 gone; E10100/E10102/E10134 appear only in the "why these are wrong" prose), E10174 in place, `git status --porcelain spec/` empty (D3 intact).
> **Iteration**: 2 (re-scan after fixes)
> **Artifact**: Requirements document at `codeops/features/blend65-ri/requirements/RD-18-codegen-language-completion.md`
> **Codebase Grounded**: ~14 source/spec files examined, ~30 references verified
> **Last Updated**: 2026-07-04
> **Path convention**: this file holds the *latest* requirements-level audit; the prior RD-12 audit is preserved in git history. PF numbering restarts per artifact.
> **Review independence**: RD-18 was authored in a *prior* session (commit `7e7029d`), not this one — same-session bias risk is low. One independent adversarial challenger was run over the CRITICAL/MAJOR batch (hardening protocol) and reconciled before recommendations were recorded.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, ES2023, strict), Yarn v1 workspaces + Turborepo, Vitest. 10 `@blend65/*` packages.
**Architecture:** AOT 6502 compiler pipeline: Lexer → Parser → Analyzer (RD-04, 4 passes) → SFA (RD-05) → IL lowering (RD-06) → IL→Instr (RD-07) → ACME serialize (RD-09) → PRG → VICE (RD-12). Deliberate "walking skeleton at slice 2": semantic Passes 2/4 are no-ops, so the SFA allocator is starved and only the constant-`poke` gate assembles.
**Key Files Examined:** `packages/frontend/src/semantics/passes.ts`, `packages/frontend/src/sfa/model-adapter.ts`, `packages/codegen/src/{il/lower.ts,il/cfg.ts,instr/translate.ts,instr/peephole.ts}`, `packages/codegen/src/**/serialize-acme.ts`, `packages/core/src/diagnostics/diagnostic-codes.ts`, `spec/14-diagnostics.md`, `spec/00-feature-index.md`, `spec/evaluations/F015-data-inclusion.md`, sibling RD-04/06/07, `00-ambiguity-register.md` (AR-110..114), `_archive/rd-04-semantic-analysis/08-deferred-semantics-ledger.md`, `requirements/README.md`.

**Verification result:** The structural claims are accurate. Verified correct: `passes.ts:42/83` Pass 2/4 no-ops; `model-adapter.ts:34` returns `[]`; `serialize-acme.ts:101-103` threads symbols; `peephole.ts:76` `V1_RULES = []`; `il/cfg.ts` types-only; `translate.ts:258` default→ICE; ledger rows R7..R114 exist; ledger line refs 18/298/277-292 exact; AR-110..114 present and matching; parent AC ranges (RD-04 AC-01..20, RD-06 AC-01..19, RD-07 AC-01..19) exist; diagnostic codes **E10081** and **E10194** cited correctly. The failures are concentrated in one area: the **control-flow / function diagnostic codes**, which RD-18 pulled from a stale numbering scheme.

---

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 1 (PF-005) | 🟡 |
| 2 | Implicit Assumptions | 1 (PF-001) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-002) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-004) | 🟡 |
| 5 | Dependency Issues | 1 (PF-004) | 🟡 |
| 12 | Consistency | 2 (PF-003, PF-006) | 🟡 |
| 13 | Codebase Alignment | 2 (PF-001, PF-002) | 🟠 |

(Dimensions 6–11 scanned; no findings.)

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 0 | — |
| 🟠 MAJOR | 2 | ✅ all resolved (fixes applied, iter-2 verified) |
| 🟡 MINOR | 4 | ✅ all resolved (fixes applied, iter-2 verified) |
| 🔵 OBSERVATION | 0 | — |

---

## Root cause (underlies PF-001 & PF-002)

The frozen `spec/` carries **two mutually inconsistent diagnostic-numbering schemes**:

- **Canonical / implemented:** `spec/14-diagnostics.md` (self-declared "canonical registry of all compiler diagnostics", line 12) + `packages/core/src/diagnostics/diagnostic-codes.ts` (transcribed from Ch 14) + RD-04/RD-11.
- **Stale / pre-consolidation:** `spec/00-feature-index.md` + the `F0xx` evaluations + frozen chapters `05`/`06`, which use per-feature numbers that the Ch-14 consolidation later renumbered.

RD-18 sourced its control-flow/function codes from the **stale** scheme. Because `spec/` is frozen (D3), neither scheme can be edited, so the implementer must be told to cite the **canonical registry + `diagnostic-codes.ts`** (what the compiler emits).

---

## 🟠 MAJOR findings

### PF-001: Recursion is cited as E10180/E10181 — the compiler emits E10174 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment) / 2 (Implicit Assumptions)
**Location:** RD-18 §Slice Map row Slice 5 (line 131); §Acceptance Criteria AC-4 (lines 259-260).
**Codebase Evidence:**
- Canonical registry: `spec/14-diagnostics.md:112` → `E10174 | Recursion detected | "…calls itself (directly or indirectly)…"` (a **single, unified** code for direct + indirect).
- Code: `packages/core/src/diagnostics/diagnostic-codes.ts:83` → `RecursionDetected: "E10174"`.
- Parent RD-04: `R86` (line 249) and `AC-07` (line 835) both use **E10174**.
- `E10180`/`E10181` appear **only** in the stale scheme (`spec/00-feature-index.md`, `spec/06-functions.md:683-684`, F018) and are **absent** from `spec/14-diagnostics.md` and `diagnostic-codes.ts`.

**The Problem:** RD-18 tells the Slice 5 implementer to reject recursion with `E10180`/`E10181`, but the compiler's registry has no such codes — it emits the unified `E10174`. A Slice 5 rejection test written to the AC would assert codes the compiler never produces. Worse, it is **self-contradictory**: RD-18 AC-8 (lines 270-272) requires driving *RD-04 AC-02..20 shut* — and RD-04 AC-07 tests **E10174** — so AC-4 and AC-8 disagree within RD-18.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Re-cite **E10174** (unified) everywhere RD-18 says E10180/E10181 | Matches canonical registry, `diagnostic-codes.ts`, and RD-04 R86/AC-07; removes the AC-4↔AC-8 contradiction | none material |

**Recommendation:** Option A — the only viable path. E10180/E10181 exist nowhere the compiler reads; E10174 is the implemented code and is what the parent AC RD-18 promises to close already uses. *Considered and dropped:* "keep E10180/81, note spec inconsistency" — rejected, because the code would never be emitted and the internal AC contradiction would remain.

**Confidence:** High. **Hardening:** independent challenger CONFIRMED; verified against three authoritative sources.

**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

### PF-002: Three control-flow checks cite codes absent from the canonical registry, and minting new ones collides with the D3 spec-freeze 🟠 MAJOR

**Dimension:** 3 (Logical Contradictions) / 13 (Codebase Alignment)
**Location:** RD-18 §Slice Map Slice 4 (line 130), §Parked-Question Routing (lines 78, 155-159), §Acceptance Criteria AC-2/AC-3 (lines 251-256), and D3 (lines 80-81, AC-8 line 272).
**Codebase Evidence:** Against the canonical registry (`spec/14-diagnostics.md`) + `diagnostic-codes.ts`:
- **Non-boolean condition** — RD-18 cites `E10100` "with the exact code" (lines 130, 251-252). But `E10100` = **"Undeclared identifier"** (`14-diagnostics.md:70`; `diagnostic-codes.ts:57`; RD-04 AC-03 line 831). **No** non-boolean-condition code exists in the canonical registry.
- **All-paths-return** — RD-18 cites `E10102` (lines 130, 256). `E10102` is **absent** from `14-diagnostics.md` and `diagnostic-codes.ts` (it lives only in stale `00-feature-index.md:122` / ch05/ch06). Canonical nearest is `E10172` "Missing return value" — a *different* check (missing `return` statement, not path-completeness).
- **`fallthrough` in `default`** — RD-18 mints "new diagnostic **E10134**" (lines 78, 158, AC-3 line 256). `E10134` is already spent on **`embed()`/F015** in `spec/00-feature-index.md:143` and `F015-data-inclusion.md:450` (the whole E10134–E10139 band is F015). In the canonical registry the embed band is E10200–E10204, so E10134 is *unassigned there* — but there is **no** fallthrough code in the canonical registry either, and RD-18 double-books a number already used in frozen spec text.

**The Problem:** All three checks genuinely need diagnostic codes the canonical registry does **not** provide. RD-18 papered over this by borrowing stale numbers (E10100, E10102) or an already-spent one (E10134). The moment you try to *create* the missing codes, you hit RD-18's own **D3**: "Keep `spec/` untouched; `git status --porcelain spec/` stays empty across every slice" (lines 80-81). The canonical registry is `spec/14-diagnostics.md`, so adding codes there violates D3; adding them only to `diagnostic-codes.ts` satisfies D3 but breaks the "Ch 14 is THE canonical registry / one-registry" invariant the code was transcribed from. RD-18 routes only **fallthrough** (Q4) to Slice 4's gate; it never acknowledges that **non-boolean-condition** and **all-paths-return** *also* lack canonical codes and hit the same D3 wall.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | (1) In RD-18, stop pinning specific codes for the three code-less checks (drop the "E10100"/"E10102"/"E10134" pins); (2) explicitly route **all three** to their owning slice's Zero-Ambiguity Gate (non-bool + all-paths → Slice 4, alongside fallthrough); (3) add a Scope Decision fixing the policy: **new codes are added to `diagnostic-codes.ts` only**, `spec/` stays frozen per D3, and the Ch-14 drift is a recorded, accepted deviation until a post-freeze spec-reconciliation pass | Keeps D3 intact (load-bearing per CLAUDE.md); unblocks the checks; makes the gap explicit rather than latent | Accepts a knowing drift between the frozen canonical registry and the code registry |
| B | Same (1)+(2), but resolve the policy the other way: treat the **diagnostics chapter as a permitted D3 carve-out** — `spec/14-diagnostics.md` may grow as new codes are minted, passing the Language Guard | Keeps a single canonical registry; no drift | Weakens the frozen-spec guarantee the whole project leans on; changes `git status --porcelain spec/` from "empty" to "diagnostics-only"; needs explicit user sign-off |

**Recommendation:** Option A. D3 (`spec/` frozen, porcelain-empty) is load-bearing across the project and CLAUDE.md; the code registry already exists as the compiler's operative source, so code-only additions are the smaller deviation. But the choice between A and B is a genuine policy call that is yours — B is legitimate if you'd rather preserve one canonical registry than preserve the freeze. Either way, RD-18 must (1) drop the three code pins and (2) route non-bool-condition and all-paths-return to Slice 4's gate next to fallthrough. *Considered and dropped:* "leave as-is, resolve at gates" — rejected, because RD-18 currently asserts these codes as *existing/exact* in ACs, which is factually wrong and will mislead the implementer.

**Confidence:** High on the facts (codes absent/mis-assigned); Medium on the A-vs-B policy pick (yours to make). **Hardening:** challenger CONFIRMED B, D and surfaced the missed E10102; reconciled.

**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

## 🟡 MINOR findings

### PF-003: `README.md:191` citation points to the wrong line for the stage-first rejection 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** RD-18 §The rollout model (line 122): "stage-first was explicitly rejected (`requirements/README.md:191`)".
**Codebase Evidence:** `requirements/README.md:191` is the *"Runtime-routine ABI"* row (AR-33) — unrelated. The stage-first / vertical-slice rejection is at **`README.md:195`**: "Build methodology | Vertical walking skeleton … | Fixes v2: '100% lexer/parser first' made later refinements ripple | AR-38".
**The Problem:** The substantive claim is TRUE and supported — only the line number is off by four, and RD-18's entire value proposition is precise references. A stale cite erodes that.
**Recommendation:** Change the cite to `requirements/README.md:195` (or `AR-38`). Only viable fix.
**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

### PF-004: `Depends On` header omits RD-11, which RD-18 consumes 🟡 MINOR

**Dimension:** 4/5 (Completeness / Dependency)
**Location:** RD-18 header (line 7): "Depends On: RD-04, RD-05, RD-06, RD-07, RD-09, RD-10, RD-12, RD-17".
**Codebase Evidence:** RD-18 relies on RD-11 in three places: Should-Have "Per-slice resource-report deltas (RD-11 `ResourceReport`)" (lines 87-88); the AR-111 rationale cites RD-11's `checkBinaryBudget`/E10034 as the anti-bloat guard (Scope Decisions line 202); Security "const-eval … bounded … budget checks" leans on the same. RD-11(b) is shipped in `@blend65/core` per CLAUDE.md.
**The Problem:** A consumed dependency isn't declared, so the dependency graph in the header is incomplete.
**Recommendation:** Add **RD-11** to the `Depends On` list. Only viable fix.
**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

### PF-005: Per-slice const-evaluator scope is ambiguous for Slices 4–6 🟡 MINOR

**Dimension:** 1 (Ambiguities)
**Location:** RD-18 §Slice Map: Slice 3b "minimal const-eval for const scalars" (line 129); Slice 7 "full const evaluator (array sizes, R88–R93)" (line 133).
**Codebase Evidence:** The const evaluator is not yet built (Pass 2/4 no-op). Slice 4's surface includes `switch`/`case` (Ch 05) whose `case` labels must be compile-time constants, and `for … to/downto/step` bounds; Slice 6 includes `zext`/`sext`/`trunc` and non-const `lo`/`hi`. RD-18 defines only "minimal" (3b) and "full" (7) const-eval and is silent on what Slices 4/5/6 require in between.
**The Problem:** An implementer reaching Slice 4 won't know whether `case`-label / `for`-bound folding is in-scope for that slice or must wait for Slice 7's "full" evaluator — a real sequencing ambiguity.
**Recommendation:** Add one line to the Slice Map (or a note under §The rollout model) stating that each slice pulls in exactly the const-eval its surface needs (e.g. `case`-label + `for`-bound integer folding lands with Slice 4), with the "full" evaluator (array/aggregate sizing) as the Slice 7 completion — i.e. const-eval grows per slice like the other stages, not in two lumps. Only viable direction; the specifics are a Slice-4 `make_plan` detail.
**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

### PF-006: Module init-order placement — RD-18 (Slice 5) vs AR-112 (3b) 🟡 MINOR

**Dimension:** 12 (Consistency)
**Location:** RD-18 §Slice Map Slice 5 (line 131): "module init order (E10194) … Pass 4 init order"; vs `00-ambiguity-register.md` AR-112: "Module-level globals + init order … get explicit homes (3b/Slice 7)".
**Codebase Evidence:** `E10194` (circular module-level initializer) is verified in `spec/14-diagnostics.md:141` and `diagnostic-codes.ts:104`. AR-112 assigns "init order" to 3b; RD-18 assigns the cross-module topological init order (E10194 on cycle) to Slice 5.
**The Problem:** The RD and its own Ambiguity Register disagree on which slice owns module init order. RD-18's placement is arguably the more correct one (a cycle across modules only exists once Slice 5 introduces multiple modules), but the register should not contradict the RD it justifies.
**Recommendation:** Reconcile the wording — keep cross-module init order (E10194) in Slice 5 in RD-18 and adjust AR-112's parenthetical to match (single-module trivial init in 3b; cross-module ordering + E10194 in Slice 5). Only viable direction.
**User Decision:** Resolved — user approved ("apply"); fix applied to RD-18 per recommendation on 2026-07-04 (PF-002 resolved as **Option A** — new codes go to `diagnostic-codes.ts` only, `spec/` frozen; logged as AR-115). Verified in iteration-2 re-scan.

---

## Verdict

**✅ PREFLIGHT PASSED — all 6 findings resolved (iteration 2).** Both MAJOR diagnostic-code defects are fixed: recursion now cites the canonical unified `E10174` (PF-001), and the three code-less control-flow checks (non-boolean-condition, all-paths-return, `fallthrough`-in-`default`) are no longer pinned to wrong/spent codes — they are routed to Slice 4's gate as new `diagnostic-codes.ts` entries, with the D3-vs-registry policy settled as **Option A** and recorded in AR-115 (PF-002). The 4 MINOR fixes (README:195 cite, RD-11 dependency, per-slice const-eval note, AR-112 init-order reconciliation) are applied. `git status --porcelain spec/` remains empty. Ready for `make_plan` (Slice 3a first).

### Iteration-2 re-scan (2026-07-04)

- **Fix verification:** all 6 findings confirmed applied against RD-18 + register (grep sweep: no active `E10180`/`E10181` pins; `E10174` present in Slice-5 row, AC-4, Security; `Depends On` includes RD-11; `README.md:195`; const-eval note present; AR-115 added; AR-112 init-order reconciled; AR-114 stale `E10134` corrected).
- **Regression check:** Scope Decisions table still well-formed (6 data rows); no duplicate AR ids; `spec/` untouched (D3 invariant holds).
- **Fresh scan:** no new findings surfaced by the edits.
