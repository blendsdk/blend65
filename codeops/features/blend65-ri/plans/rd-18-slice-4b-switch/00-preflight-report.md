# Preflight Report: RD-18 Slice 4b — The `switch` Sub-Machine

> **Status**: ✅ PASSED — all 6 findings resolved (user accepted every recommendation; fixes applied 2026-07-07)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-4b-switch/`
> **Codebase Grounded**: ~15 source files examined across frontend/codegen/core + spec Ch-05/F009/Ch-14; ~40 `file:line` references verified (3 parallel recon agents)
> **Last Updated**: 2026-07-07

⚠️ **Same-day / same-lineage review.** The plan was authored earlier today (commit `045bc4f`).
Same-agent bias risk is elevated; the scan was hardened with three independent recon agents and one
adversarial challenger on the MAJOR batch. A human domain-expert pass on the E10077 typing semantics
(PF-002) is still advisable.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn workspaces + Turbo, Vitest. 10 `@blend65/*`
packages; 6502 AOT compiler.
**Architecture:** Lexer → Parser → Analyzer (`type-check/*` Pass-3 + `function-collection` + SFA) →
IL (`il/lower.ts`) → Instr (`instr/translate.ts`) → ACME. `switch` front-end (tokens/AST/parser/walk)
is fully built; 4b wires semantics + one IL lowering case.
**Key Files Examined:** `frontend/semantics/type-check/statement-typing.ts`,
`expression-typing.ts`, `const-eval.ts`, `type-check/type-resolution.ts`, `core/semantics/type-utils.ts`,
`frontend/semantics/function-collection.ts`, `frontend/parser/parse-stmt.ts`, `core/ast/nodes.ts`,
`core/diagnostics/diagnostic-codes.ts`, `codegen/il/lower.ts`, `il/builder.ts`, `il/instruction.ts`,
`il/test-fixtures.ts`, `instr/translate.ts`, `test-harness/src/testing/slice4a.ts`,
`spec/05-statements-control-flow.md §8`, `spec/evaluations/F009-switch-statement.md`, `spec/14-diagnostics.md`.

**Recon verdict:** the plan's grounding is unusually strong — the vast majority of its `file:line`
cites land within tolerance (AST nodes, dispatch arms, builder API, terminator set, translate
dispatch, harness shape all confirmed). The findings below are the exceptions.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-002) | 🟠 |
| 3 | Logical Contradictions | 1 (PF-001) | 🟠 |
| 4 | Completeness Gaps | 1 (PF-003) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 (covered under PF-002 ST-4) | — |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 (covered under PF-003) | — |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 2 (PF-004, PF-006) | 🟡 |
| 13 | Codebase Alignment | 1 (PF-005) + reinforces PF-001/002/003 | 🟡 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 3 | ✅ all resolved (Option A each; fixes applied) |
| MINOR | 2 | ✅ resolved (fixes applied) |
| OBSERVATION | 1 | ✅ folded into task 2.2.2 |

---

### PF-001: `E10076` (at-most-one `default`) is unreachable from semantics 🟠 MAJOR

**Dimension:** Logical Contradictions (+ Codebase Alignment)
**Location:** `01-requirements.md` FR-5; `03-01-switch-semantics.md` §2 step 4 + §5; `07-testing-strategy.md` ST-11; `99-execution-plan.md` task 1.2.2; scope line in `00-index.md`/`01-requirements.md §2`.
**Codebase Evidence:** `packages/frontend/src/parser/parse-stmt.ts` `parseSwitch` (~:289–299) — `defaultClause` is a single slot; a second `default:` clause is fully parsed and then **silently overwrites** the first (last-wins) at ~:294, with **no diagnostic**. Missing default → E10072 + synthesized empty clause (~:303–310). So the AST reaching the analyzer always carries exactly **one** `defaultClause` with no residue that a duplicate ever existed.
**The Problem:** FR-5 lists "at most one `default` → E10076" as a delivered validator, and ST-11 tests it, but an E10076 check in `statement-typing.ts` **can never fire** — the parser already collapsed the duplicate. E10076 is also **absent from the registry** entirely. The plan hedges this as "resolve during implementation" (03-01 §2.4), which ships a success-criterion (FR-5) that cannot hold. A program with two `default:` clauses currently compiles silently (last-wins).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Decide now: E10076 is **parser-owned / deferred**. Drop it from the 4b delivered-validator set (FR-5, §2 step 4, success criteria); re-point ST-11 to assert the *actual* behavior (duplicate `default` silently accepted, last-wins); record a follow-up to add the check in the parser. | Honest; removes a phantom deliverable; no scope expansion | Duplicate-default stays silently accepted until a later slice |
| B | Add the duplicate-`default` check in `parse-stmt.ts` (~:293) + mint E10076. | Genuinely delivers FR-5 | **Parser work** — explicitly out of 4b scope; expands the slice |
| C | Leave as-is (resolve at impl time). | No doc churn now | Ships an undeliverable claim; the exact defect preflight exists to catch |

**Recommendation:** **Option A** — the parser's last-wins overwrite makes semantics-side E10076 structurally impossible; shipping it in FR-5/ST-11 is a phantom deliverable. Record B as a follow-up task, not 4b work. (Challenger concurred: REAL / MAJOR / A.)

**Confidence:** High. **Hardening:** independent challenger agreed; grounded in parser single-slot overwrite.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

### PF-002: `E10077` case-value-type-match rests on non-existent "TS-4 auto-promotion"; trigger under-specified; ST-4 oracle wrong 🟠 MAJOR

**Dimension:** Implicit Assumptions (+ Codebase Alignment / Testability)
**Location:** `01-requirements.md` FR-3; `03-01-switch-semantics.md` §2 step 2; `07-testing-strategy.md` ST-4.
**Codebase Evidence:**
- No auto-promotion exists. `core/semantics/type-utils.ts:165` `isAssignableTo` is **strict same-type** (`typeName(source) === typeName(target)`); comment says widening is "deferred to Slice 6." No `TS-4` token anywhere in the repo.
- Case-value literals **adapt** to the discriminant type: `expression-typing.ts:102–107` `typeNumericLiteral(expr, contextType)` returns the context type for any primitive-integer literal — so `case 5` on a `byte` discriminant is byte by construction.
- Out-of-range constants → **E10084** (range), not E10077: `expression-typing.ts:290–312` `checkConstRange` emits `ValueOutOfRange` (E10084) for e.g. `300` on `byte`.
- `checkAssignable`→`assignmentMismatchCode` emits **E10152/E10153/E10154**, not a switch-specific code.
- `evalConst` (`const-eval.ts:38–52`) folds a `BoolLit` to a boolean `value` — which the plan's own "does not fold to an **integer** constant → E10071" rule (§2 step 2 bullet 1) would catch **first**, before any E10077.

**The Problem:** The stated mechanism ("type the value against `dt` using the existing scalar assignability, auto-promotion per TS-4 as already implemented") is fictional. As written it is self-contradictory: (a) literals auto-adapt, so a numeric literal never mismatches; (b) the one genuine E10077 candidate the challenger identified — a `bool` case value on an integer switch — is **swallowed by E10071** under the plan's own ordering; (c) "reuse the existing assignability path" emits E10152/3/4, not E10077; (d) **ST-4** (`case 300` on `byte` → E10077) is a **wrong oracle** — that input yields **E10084**. The precedence between E10071 (non-integer const), E10077 (type mismatch), and E10084 (range) is undefined.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Rewrite §2 step 2 to (1) delete the TS-4/"existing assignability" claim, (2) define E10077's exact trigger — a folded constant whose type is a **different non-adapting primitive** (e.g. `bool` value on an integer switch) — and its **precedence** vs E10071 (non-const) and E10084 (range), (3) make the check bespoke (emit E10077, not E10152/3/4), (4) fix ST-4: keep `case 300`→**E10084**, add a real type-mismatch input (bool-vs-int) → E10077. | Makes E10077 well-defined and testable; keeps the code alive for its real case | Requires precise wording + a design call on E10071-vs-E10077 ordering |
| B | Drop E10077 entirely; rely on literal-adaptation + range (E10084) + non-const (E10071); defer case-type-mismatch. | Simplest; removes a near-vestigial code | Loses a spec-intended check (spec §8.6); AR-4 minted E10077 deliberately |
| C | Leave as-is. | No churn | Ships a fictional mechanism + a wrong spec-test oracle |

**Recommendation:** **Option A** — E10077 is *not* dead (a `bool`/non-adapting constant is a genuine trigger), but the plan must pin its trigger, its precedence vs E10071/E10084, and make it bespoke; and ST-4's expected code must change to E10084. (Challenger concurred: REAL / MAJOR / A, and supplied the bool-vs-int trigger.)

**Confidence:** High. **Hardening:** challenger corrected an over-reach in my draft (E10077 is not fully dead) — incorporated.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

### PF-003: Stray `fallthrough` outside a switch is not rejected — the fixture-repoint premise is false + a completeness gap 🟠 MAJOR

**Dimension:** Completeness Gaps (+ Edge Cases / Codebase Alignment)
**Location:** `03-02-switch-lowering.md` §4; `99-execution-plan.md` task 2.2.2; `07-testing-strategy.md` ST-18.
**Codebase Evidence:** `statement-typing.ts:138–140` `default:` arm **skips** `FallthroughStmt` (no error); the 4b plan adds fallthrough position/no-effect validation (E10074/E10073) only by scanning **within switch case bodies** (03-01 §2 step 5). `lower.ts` has no `FallthroughStmt` case → a stray fallthrough reaches `default: iceUnsupported()` → **E90001** (`lower.ts:234–235`). `parse-stmt.ts` dispatches `fallthrough;` as a general statement, so it parses anywhere.
**The Problem:** 03-02 §4 asserts a bare/out-of-switch `fallthrough` "remains rejected upstream (parser/semantics), so it is no longer a reliable codegen ICE fixture" and repoints `unsupportedFixture`. That premise is **false**: nothing in 4b rejects a stray fallthrough, so it still ICEs — the existing bare-fallthrough fixture keeps working, and repointing it **needlessly discards** that coverage. Separately, this exposes a real gap: 4b validates fallthrough *inside* switches but leaves an *out-of-switch* fallthrough **silently accepted** by semantics (inconsistent with adding E10074).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Correct the premise: **keep** the bare-fallthrough ICE fixture (no repoint / drop task 2.2.2's repoint), and **log the silent-accept gap** as a deferred decision (stray fallthrough → candidate E10074/E10130-style diagnostic in a later slice). | Proportionate; preserves ICE coverage; names the real gap | Stray fallthrough stays silently accepted until the deferred fix |
| B | Add explicit stray-fallthrough rejection to 4b semantics now (reuse/mint a code) + then repoint the fixture to a genuinely-unsupported node. | Closes the gap in 4b; makes the repoint premise true | Real scope expansion beyond "wire semantics + one lowering case" |
| C | Leave as-is. | No churn | Executes a repoint on a false premise + loses coverage |

**Recommendation:** **Option A** — the repoint is built on an incorrect assumption and would remove working ICE coverage; keep the fixture and record the out-of-switch-fallthrough gap as a deferred decision. (Challenger concurred: REAL / MAJOR / A.)

**Confidence:** High. **Hardening:** challenger agreed; grounded in the skipped `default` arm + no `FallthroughStmt` lowering case.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

### PF-004: "One new code (E10077)" understates the actual registry mint — five more codes are absent 🟡 MINOR

**Dimension:** Consistency
**Location:** `00-index.md:65` ("new code E10077"); `03-01-switch-semantics.md:4` ("the one new diagnostic code") + `:90` ("new mint is E10077 only"); vs `03-01 §1` + task 1.2.1 ("add any absent spec-numbered switch codes additively").
**Codebase Evidence:** `core/diagnostics/diagnostic-codes.ts` — of the switch band only **E10072** exists; **E10071/E10073/E10074/E10075/E10076/E10077 are all absent**. `spec/14-diagnostics.md` lists **none** of them either. So 4b mints **six** registry entries, all drifting from Ch-14.
**The Problem:** The plan is internally inconsistent — §5 says "new mint is E10077 only" while §1/task 1.2.1 correctly add five more. The Phase-4 additive-deviation / AR-115 drift accounting (SR-2) should record **6** new registry codes, not 1.

**Options:** (single viable path) Reword 00-index/§4/§5 to state 4b **adds six registry entries** (E10071/73/74/75/76 as spec-Ch-05 numbers absent from the registry + E10077 as the genuinely new mint), and have the Phase-4 drift note account for all six. *Considered and dropped:* leaving "E10077 only" — it under-scopes the mint and the deviation ledger.

**Recommendation:** Reword for accuracy per above.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

### PF-005: Spec citation drift — one wrong section label + off-by-one line cites 🟡 MINOR

**Dimension:** Consistency (+ Codebase Alignment)
**Location:** `01-requirements.md` FR-1/FR-2/FR-3/FR-4; `03-01-switch-semantics.md §2.1`.
**Codebase Evidence (`spec/05-statements-control-flow.md`):** E10075 operand-type is **§8.5 line 401** — the plan cites "§8.7 :401" (wrong section label; §8.7 is "Default Clause"). §8.6 cites are off by one: E10071 const-values is **:405** (plan: :406); type-match is **:406** (plan FR-3: :407); duplicate is **:407** (plan FR-4: :408). FR-6 (§8.3 :380–382) and FR-5 (§8.7 :412) are correct.
**The Problem:** Minor reference drift; harmless to execution but degrades the plan's otherwise-excellent traceability and could misdirect a reader verifying against the frozen spec.

**Options:** (single viable path) Correct the four cites: §8.7→**§8.5** for E10075; §8.6 lines to **405 / 406 / 407** for const / type-match / duplicate respectively.

**Recommendation:** Fix the cites.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

### PF-006: Stale `(IfStmt)` comment in the ST-L5 test — fold the fix into task 2.2.2 🔵 OBSERVATION

**Dimension:** Consistency
**Location:** Not in the plan text — a pre-existing code comment the plan's task 2.2.2 already edits nearby.
**Codebase Evidence:** `packages/codegen/src/il/lower.spec.test.ts:105` reads `// ST-L5 — an unsupported node (IfStmt) → ...`, but the fixture is `fallthroughStmt()` and `IfStmt` is fully lowered. Since task 2.2.2 already updates the ST-L5 expectation, sync this comment in the same edit.
**The Problem:** Pure hygiene; a stale comment names a node that is no longer the fixture.

**Options:** (single viable path) When task 2.2.2 touches ST-L5, also correct the `(IfStmt)` comment to match whatever fixture PF-003's resolution settles on.

**Recommendation:** Fold into task 2.2.2.

**User Decision:** Resolved — User accepted recommendation (2026-07-07)

---

## Determination

**✅ PASSED — all 6 findings resolved.** The user accepted every recommendation (Option A for the
three MAJORs; the single-viable fix for the two MINORs + observation) and the fixes were applied
2026-07-07 across `00-index.md`, `01-requirements.md`, `02-current-state.md`, `03-01-switch-semantics.md`,
`03-02-switch-lowering.md`, `07-testing-strategy.md`, `99-execution-plan.md`, and the
`00-ambiguity-register.md` amendment. No CRITICAL issues surfaced; every fix is a documentation/
semantics correction (no re-architecture). The plan is cleared for `exec_plan`.

### Net changes to the plan's contract
- **E10076** (duplicate `default`) — **dropped** from 4b's delivered validators (unreachable at
  semantics; parser-owned follow-up). Duplicate `default` is silently accepted (last-wins).
- **E10077** — kept **registered + wired** but with a corrected trigger/precedence (E10071 → E10084
  → E10077); its emission is **deferred-reachable** (Slice 7). ST-4 split into ST-4a (E10084) +
  ST-4b (`.todo`).
- **Out-of-switch `fallthrough`** — the ICE fixture is **kept** (not repointed); the silent-accept
  gap is a deferred follow-up.
- **Code mint** count corrected to **five** (E10077 + E10071/E10073/E10074/E10075); spec cites fixed.
