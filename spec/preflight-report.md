# Blend65 v3 — Preflight & Disambiguation Report

> **Date**: May 29, 2026
> **Purpose**: Flush out discrepancies, contradictions, and ambiguities across the v3 feature
> evaluations (F001–F024) **before** consolidating them into the formal specification (00–15),
> writing platform appendixes, and assembling the master EBNF grammar.
> **Method**: Mechanical sweeps (grep/comm over all docs) + deep cross-reading audits.
> **Status legend**: ✅ Fixed · 🔧 Recommended fix (not yet applied) · 📋 Process recommendation

---

## 0. Why this pass came first

The per-feature evaluations are the **single source of truth**. The three remaining deliverables
(consolidated spec 00–15, platform appendixes, master EBNF) are all *derived* from them. Fixing
contradictions at the source is the cheapest it will ever be — otherwise every defect must be
fixed twice (source + derived doc) with a drift risk between them. v2 is **retained** until 00–15
demonstrably supersedes it and the migration gap table (§5) shows 100% coverage.

---

## 1. Reference Integrity (R-1, R-2) — ✅ COMPLETE

Mechanical sweep of every `Fxxx`, `FUT-xxx`, `REJ-xxx`, `Exxxxx`, `Wxxxxx` reference.

| Check | Result |
|-------|--------|
| Dangling feature-ID references | None. The single `F023` occurrences are intentional historical notes (retirement record in `future-considerations.md`; REJ-001 note in index). |
| Dangling FUT references | None. The single `FUT-019` occurrence is the intentional "ex-FUT-019" historical note in F024's Alternatives table. |
| Dangling REJ references | None. REJ-001 (type aliases) and REJ-002 (inline asm) resolve correctly. |
| Codes used in features but **unregistered** in index | **1 found → ✅ FIXED** (see §2). |
| Codes registered in index but **unused** in any feature | None. |

### 1.1 — ✅ FIXED: Unregistered error code `E10177`

- **File**: `evaluations/F018-functions.md` (rule FN-9 example, line ~259).
- **Defect**: The inline example used `E10177` for "cannot define function inside function," but
  that error is defined as **E10176** in both F018's own error table and the index registry.
  `E10177` was registered nowhere — a typo.
- **Fix applied**: `E10177` → `E10176`.

---

## 2. Self-Contradictions & Ambiguity — partially fixed

### 2.1 — ✅ FIXED (SEVERE): Type aliases declared both "rejected" and "valid"

Type aliases were formally **rejected** (REJ-001; feature ID F023 retired), and F016/F021 correctly
say so. But five other locations still presented `type Name = ...` as a working, valid feature —
a direct, reader-visible contradiction spanning the spec.

| File | Was | Now |
|------|-----|-----|
| `F003-module-contents.md` (line 18) | Listed "Type aliases `type SpriteId = byte;` ✅ Yes" as module content | Row removed |
| `F006-address-of.md` (lines 6, 12) | "define their own type alias: `type Address = word;`" | Rewritten: type aliases rejected (REJ-001); use `word` directly |
| `F010-signed-types.md` (line 637) | "Type aliases `type Velocity = sbyte;` — valid, works like all type aliases" | Rewritten: not available (REJ-001); use real type names |
| `F011-structs.md` (SR-A9 + interaction row) | "**Allowed.** `type Sprite = Enemy;` works like any type alias" | Rewritten: not available (REJ-001); use `import { X as Y }` to rename |
| `F022-enums.md` (line 273) | "...unlike transparent type aliases (F023)" | Rewritten: "...rejected (REJ-001)" (drops retired ID) |

**Canonical owner going forward**: F016 TS-A6 + F021 LS-9 own the "no type aliases" rule; every
other mention must *reference* REJ-001, never restate aliases as usable.

### 2.2 — ✅ FIXED: F018 FN-A3 answered its own question both ways

- **File**: `evaluations/F018-functions.md`, Resolved Ambiguity FN-A3 (parameter shadowing).
- **Defect**: The text said "**Yes**, but the compiler emits E10101 …" and then "Actually — **No**.
  E10101 prohibits all shadowing." A resolved-ambiguity entry that contradicts itself.
- **Fix applied**: Collapsed to the correct single answer — **No** (E10101 prohibits all shadowing) —
  with a clean rationale.

### 2.3 — 🔧 RECOMMENDED: audit-flagged hedging to convert into hard rules

The contradiction/hedging audit flagged several "in theory / in practice / may / should" passages.
Most are benign cost commentary, but these touch on **determinism (H5)** and should be tightened to
either a hard rule or an explicit, documented limitation:

- `F018` FN-A9 / line ~629 — "In theory, a function's address could be installed …" recursion via
  raw `&`+poke is "the developer's responsibility." ✅ This is acceptable as a *documented limitation*
  but should be cross-listed in the index's "known limitations" once 00–15 is written.
- `F012` CC-A7 — 65C02 `WAI`/`STP` "Deferred." Should point at a FUT entry rather than inline prose.
- `F020` line ~497 — `sizeof` return type "byte if size ≤ 255, word if > 255." This is a *real
  semantic rule*, not hedging, but is buried in an A-item; promote it into a numbered rule in F020.

---

## 3. Semantic Consistency (S-1) — 🔧 RECOMMENDED

The recurring-rule audit found the rules are *substantively* consistent but **stated in multiple
places**, which invites future drift. Assign one canonical owner per rule; everyone else references it.

| Recurring rule | Canonical owner | Notes / action |
|----------------|-----------------|----------------|
| **Expression-operand auto-promotion** (`byte OP word` → `word`) | **F016 TS-4** | F010 only documents *assignment* widening (ST-2) and never states the expression rule. ✅ Not a contradiction, but F010 should add a one-line pointer to F016 TS-4 so the two sub-rules aren't conflated. |
| **Assignment-context widening** (narrow value → wider variable) | **F010 ST-2** | Keep; F016 should reference it rather than re-describe. |
| **Narrowing requires explicit cast** | **F016** | Consistent everywhere; make F016 the cited source. |
| **Mixed-signedness prohibition (E10081)** | **F010 ST-1** | Consistent across F010/F016/F017/F018/F019/F024. Keep F010 as owner; others cite it. |
| **Condition must be boolean (E10100)** | **F013** | Reused correctly by F024 and F016. Keep F013 as owner. |
| **Enum↔byte conversion** (implicit enum→byte, explicit byte→enum) | **F022 EN-9/EN-10**, integrated into **F016** conversion model | F016 and F022 agree. Keep. |

**Recommendation**: When writing 00-types / 04-expressions in the consolidated spec, state each rule
**once** in its owning chapter and have feature chapters link to it. This is the spec-level DRY that
the Language Guard L8 (feature-interaction) implicitly requires.

---

## 4. Grammar & Precedence (S-2) — 🔧 RECOMMENDED (pre-EBNF de-risk)

The grammar audit collected every EBNF fragment. Findings to resolve **before** writing the master grammar:

1. **`type` vs `type_expr` vs `type` naming.** Fragments variously use `type`, `type_expr`,
   `const_expr`, `const_expression`. Pick one canonical nonterminal name set for the master grammar
   and normalize.
2. **`block` is defined in F013** and *used* by F008/F009/F011/F018. Confirm the single definition
   in F013 is the one the master grammar adopts; remove any local redefinitions.
3. **Dangling-else**: F013's `if_stmt = "if" "(" expression ")" block [ "else" ( if_stmt | block ) ]`
   uses mandatory braces (`block`), which **eliminates** the classic dangling-else ambiguity. ✅ Good —
   document this explicitly as the reason the grammar stays LL(k).
4. **Ternary precedence**: F017 places `? :` at the lowest precedence level (12), right-associative;
   F024's `conditional-expression = logical-or-expression [ "?" expression ":" conditional-expression ]`
   is consistent with that. ✅ Verified consistent.
5. **Action**: the future master-EBNF doc should be assembled from these fragments *after* the naming
   normalization in (1) so it is provably LL(k)/recursive-descent + Pratt parseable.

---

## 5. v2 → v3 Migration Gap Analysis (M-1) — 🔧 RECOMMENDED

The disposition audit mapped every v2 construct to a v3 feature / FUT / REJ. Items needing an explicit,
recorded disposition before v2 can be deleted:

| v2 construct | Disposition | Action |
|--------------|-------------|--------|
| `asm_*` functions | Covered by **REJ-002** (inline assembly rejected) | ✅ Confirm REJ-002 text explicitly names `asm_*` *functions*, not only inline-asm blocks. If it only mentions blocks, broaden it. |
| Storage classes (`@zp` etc.) | Mapped to **F005** (memory placement) + `@` removed | ✅ Documented in F005. Keep. |
| `callback` keyword | Dropped; auto-detected via `&fn` | Documented in F018 FN-A5. Keep. |
| `string` *type* | Removed; string literals = `const byte[]` | Mapped to F014 STR-1. Keep. |
| `@address` built-in type | Removed; addresses are plain `word` | Mapped to F006. Keep (wording fixed in §2.1). |

**Recommendation**: produce a one-page `v2-to-v3-migration.md` disposition table as the deletion
justification log. **Do not delete `language-specification-v2/` until** (a) that table shows no
"NO DISPOSITION" gaps and (b) the consolidated 00–15 spec exists.

---

## 6. Structural Normalization (P-1, P-2, P-3) — 🔧 RECOMMENDED

These are consistency/format issues, not logic bugs, but they directly affect compiler-build planning:

- **P-1 — Index lacks dependency & stability columns.** `00-feature-index.md`'s summary table is
  `ID | Feature | Status | Guard | File`. Add **Depends-On** and **Stability** columns. This table
  becomes the compiler's feature-dependency DAG (pass ordering).
- **P-2 — "Depends on" declared inconsistently.** Only F010, F011, F016, F018, F022, F024 have an
  explicit `> **Depends on**:` header. F001–F009, F012, F013, F014, F015, F017, F019, F020, F021 state
  dependencies only in prose. Add a standardized header line to every feature doc.
- **P-3 — Two Language-Guard formats.** F010/F011/F016/F018/F022/F024 use full P/H/L/C/F **sub-tables**;
  the others use **prose bullet lists**. No unresolved ❌ exists in any feature (all pass), but the two
  formats prevent mechanical verification. Normalize all to the table format.

---

## 7. Guard Completeness — ✅ VERIFIED

Every accepted feature carries a Language-Guard verdict and **no feature has an unresolved ❌**. The
❌ marks present in feature bodies are content (prohibited-usage rows / error conditions), not guard
failures. (Format inconsistency is tracked under P-3.)

---

## 8. Recommended execution order (remaining work)

1. ✅ Reference/registry integrity (R-1, R-2) — **done**.
2. ✅ Type-alias contradiction + FN-A3 (§2.1, §2.2) — **done**.
3. 🔧 Apply §2.3 hedging tightenings + §5 REJ-002 `asm_*` confirmation.
4. 🔧 S-1 canonical-owner consolidation (§3) — best folded into writing 00–15.
5. 🔧 P-1/P-2/P-3 structural normalization (§6) — mechanical; do before 00–15.
6. 🔧 S-2 grammar nonterminal normalization (§4) — do before the master EBNF.
7. Write consolidated spec 00–15.
8. Write `v2-to-v3-migration.md`; then delete `language-specification-v2/`.
9. Platform profile appendixes.
10. Master EBNF grammar.

---

## 9. Fixes applied in this pass (changelog)

| # | File | Change |
|---|------|--------|
| 1 | `F018-functions.md` | `E10177` → `E10176` (unregistered code typo, FN-9 example) |
| 2 | `F018-functions.md` | FN-A3 self-contradiction ("Yes… Actually No") collapsed to correct **No** |
| 3 | `F003-module-contents.md` | Removed "Type aliases" row from module-contents table (REJ-001) |
| 4 | `F006-address-of.md` | Removed "define their own type alias" advice; cite REJ-001; addresses are plain `word` |
| 5 | `F010-signed-types.md` | Type-aliases interaction row → "not available (REJ-001)" |
| 6 | `F011-structs.md` | SR-A9 + interaction row → type aliases rejected (REJ-001); use `import { X as Y }` |
| 7 | `F022-enums.md` | "type aliases (F023)" → "rejected (REJ-001)" (drops retired ID reference) |
