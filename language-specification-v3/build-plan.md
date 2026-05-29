# Blend65 v3 — Specification Build Plan

> **Date**: May 29, 2026
> **Purpose**: Sequenced, gated plan for turning the 23 accepted feature evaluations (F001–F024,
> F023 retired) into the consolidated formal specification (00–15), the v2 retirement, the platform
> profile appendixes, and the master EBNF grammar.
> **Status legend**: ⬜ Not started · 🔄 In progress · ✅ Done · 🚦 Gate (must pass before proceeding)

---

## 0. Ground Rules (decisions locked in)

These were decided before this plan was written. They are **givens** for every phase below.

| # | Decision | Consequence |
|---|----------|-------------|
| D1 | **F001–F024 are archived, not retired.** | They move to `evaluations/` as the rationale/decision log behind the spec. 00–15 becomes the authoritative *reference*; the feature docs remain the authoritative *why*. |
| D2 | **A working compiler is the end goal.** | The master EBNF grammar (Phase 5) is **mandatory**, not optional. Codegen strategy and error-code coverage must survive consolidation intact. |
| D3 | **The feature docs are the single source of truth until 00–15 supersedes them.** | No content is invented during consolidation — every rule in 00–15 traces to a feature doc. Cheap preflight cleanups (§3 canonical owners, §5 REJ-002 check) are folded in *while writing*, not as separate chores. |
| D4 | **v2 is retained until the migration gate passes.** | `language-specification-v2/` is deleted only after 00–15 exists AND the migration table shows zero "NO DISPOSITION" gaps (Phase 4 gate). |
| D5 | **Standalone preflight steps §2.3/§3/§4/§6 are NOT done as separate passes.** | They are absorbed into Phase 2 (writing 00–15) and Phase 5 (EBNF). Doing them on the soon-to-be-archived feature docs would be wasted effort. |

---

## 1. Phase Overview

| Phase | Deliverable | Depends on | Gate |
|-------|-------------|-----------|------|
| **P0** | This build plan (chapter map, ownership, gates) | preflight-report.md | — |
| **P1** | Archive move: `features/` → `evaluations/`; tiny REJ-002 `asm_*` confirmation | P0 | — |
| **P2** | Consolidated spec chapters **00–15** | P1 | 🚦 G1: every feature doc mapped to ≥1 chapter; every error code present |
| **P3** | `v2-to-v3-migration.md`; then **delete** `language-specification-v2/` | P2 (G1) | 🚦 G2: zero "NO DISPOSITION" rows |
| **P4** | Platform profile appendixes (C64, C64U, CX16, 800XL, 7800) | P2 (G1) | 🚦 G3: each appendix fills every profile slot 00–15 references |
| **P5** | Master EBNF grammar | P2 (G1) | 🚦 G4: provably LL(k)/recursive-descent+Pratt; every construct covered |

P3, P4, P5 all depend only on P2's gate (G1). After G1 they can proceed in any order, but the
recommended order is P3 → P4 → P5 (retire the contradiction surface first, then platform detail,
then grammar last so it reflects the final consolidated prose).

---

## 2. Chapter Map for 00–15 (the heart of the plan)

Each chapter consolidates one or more feature docs. The **Canonical owner** column records which
feature doc owns each cross-cutting rule (from preflight-report.md §3) — the chapter states the rule
**once** and other chapters link to it. This is the spec-level DRY that Language-Guard L8 requires.

| Ch | Title | Feeds from | Canonical rules owned here |
|----|-------|-----------|----------------------------|
| **00** | Introduction & Design Axioms | index (A1–A5), language-guard | A1–A5; Language-Guard reference; stability classifications |
| **01** | Lexical Structure | F021 | tokens, keywords, literals, comments, reserved words (incl. retired `type`) |
| **02** | Type System | F016, F010, F022 | **TS-4** expression-operand auto-promotion; narrowing-requires-cast; boolean-is-not-numeric; cast rules; **F010 ST-1** mixed-signedness (E10081); **F010 ST-2** assignment-context widening; enum↔byte (F022 EN-9/EN-10) |
| **03** | Variables & Constants | F019, F005 | let/const, initialization, startup sequence, zeropage placement, memory placement |
| **04** | Expressions & Operators | F017, F024, F006, F020 | operator set + precedence table; **ternary at level 12 right-assoc** (F024); address-of `&` (F006); peek/poke/lo/hi/sizeof/offsetof/length (F020, incl. sizeof return-type rule) |
| **05** | Statements & Control Flow | F013, F008, F009 | **block** definition (F013); **boolean-condition rule E10100** (F013); if/else/while/do-while; for-loop; switch/fallthrough; break/continue |
| **06** | Functions | F018, F007 | declaration/calling; SFA frames; recursion prohibition (E10180/E10181); no-shadowing (E10101 — FN-A3 resolved); interrupt functions; `&fn` callback auto-detection |
| **07** | Structs | F011 | struct rules; no self-reference/circularity; no struct return; struct literals |
| **08** | Arrays & Strings | F014 | arrays; string literals as `const byte[]`; char literals; fill syntax; const params; index-type rules |
| **09** | Enums | F022 | byte-backed nominal type; asymmetric conversion |
| **10** | Modules & Multi-file | F001, F002, F003, F004 | module decl; contents & visibility; entry point `main`; multi-file compilation; `import { X as Y }` |
| **11** | Memory Model & SFA | F005, F018 (frame parts), F006 | static frame allocation; zero-page budget; address model (addresses are plain `word`) |
| **12** | CPU Control & Intrinsics | F012 | the 13 curated CPU-control intrinsics; BCD warning; (no inline asm — REJ-002) |
| **13** | Data Inclusion / Asset Embedding | F015 | `embed()`; format selectors; offset/size; const-only placement |
| **14** | Diagnostics: Error & Warning Registry | index appendix | the full E1xxxx / W1xxxx tables (single canonical copy) |
| **15** | Conformance & Platform Profile Contract | index, language-guard F2 | what a platform profile must define; conformance checklist; links to appendixes |

**Coverage check (G1)**: every F-doc appears in the "Feeds from" column at least once →
F001✓(10) F002✓(10) F003✓(10) F004✓(10) F005✓(03,11) F006✓(04,11) F007✓(06) F008✓(05) F009✓(05)
F010✓(02) F011✓(07) F012✓(12) F013✓(05) F014✓(08) F015✓(13) F016✓(02) F017✓(04) F018✓(06,11)
F019✓(03) F020✓(04) F021✓(01) F022✓(02,09) F024✓(04). **All 23 mapped.**

---

## 3. Phase Detail & Definition of Done

### P1 — Archive & tiny cleanup
- Move `features/` → `evaluations/` (preserve git history with `git mv`).
- Update links in `00-feature-index.md` and `preflight-report.md` to the new path.
- Confirm REJ-002 text explicitly names `asm_*` **functions** (not only `asm { }` blocks). Broaden if needed.
- **DoD**: archive moved, links resolve, REJ-002 covers both forms.

### P2 — Write 00–15
- Write chapters in dependency order: **00 → 01 → 02 → 04 → 05 → 06 → 07 → 08 → 09 → 03 → 10 → 11 → 12 → 13 → 14 → 15.**
  (Types/expressions/statements/functions first; placement, modules, memory, platform later.)
- While writing: state each canonical rule once in its owning chapter (§2 table); fold in preflight §2.3 tightenings (F018 FN-A9 known-limitation note, F012 CC-A7 → FUT pointer, F020 sizeof rule promotion); normalize grammar nonterminal names as fragments are quoted (preflight §4).
- **DoD / 🚦 G1**: all 16 chapters exist; coverage check passes; every error/warning code from the index appears in Ch 14; no rule stated in two chapters without a link.

### P3 — Migration table + delete v2
- Write `v2-to-v3-migration.md`: one row per v2 construct → v3 chapter / FUT / REJ disposition (seed from preflight §5).
- **🚦 G2**: zero "NO DISPOSITION" rows AND 00–15 exists → then `git rm -r language-specification-v2/`.

### P4 — Platform appendixes
- One appendix per platform filling every profile slot Ch 15 defines (zero-page range, RAM map, char encoding, binary format, resource limits, cycle timing).
- **🚦 G3**: every profile slot referenced in 00–15 has a value in all 5 appendixes.

### P5 — Master EBNF grammar
- Assemble from the (now normalized) grammar fragments across 01–13 into one document.
- **🚦 G4**: provably LL(k) / recursive-descent + Pratt parseable; dangling-else resolved via mandatory `block`; every language construct has a production.

---

## 4. Risk Register

| Risk | Mitigation |
|------|-----------|
| Drift between 00–15 and archived feature docs | D3: no invented content; archive is rationale-only, spec is normative. Conflicts resolve in favor of 00–15 going forward. |
| Rule restated in multiple chapters (re-introducing v2's L8 problem) | §2 canonical-owner table; state once + link. |
| Deleting v2 too early | G2 gate: hard precondition that 00–15 exists and migration is gap-free. |
| EBNF written against unstable prose | P5 sequenced last; depends on G1. |
| Platform-specific detail leaking into core chapters (P3 violation) | Ch 15 defines the profile contract; all hardware specifics live in P4 appendixes only. |

---

## 5. Current Status

- ✅ **P0** — this plan.
- ✅ **P1** — archive (`features/` → `evaluations/`) + REJ-002 confirmed (already covers both `asm { }` blocks and `asm_*()` functions).
- ⬜ P2 — chapters 00–15.
- ⬜ P3 — migration + v2 deletion (gated).
- ⬜ P4 — platform appendixes (gated).
- ⬜ P5 — master EBNF (gated).
