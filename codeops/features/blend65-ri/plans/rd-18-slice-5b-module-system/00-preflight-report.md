# Preflight Report: RD-18 Slice 5b — Module System Completion

> **Status**: ✅ PREFLIGHT PASSED — all 10 findings resolved (1 critical, 3 major, 5 minor, 1 observation; fixes applied to the plan documents 2026-07-11 at the user's instruction)
> **Iteration**: 1 (first scan)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-5b-module-system/` (10 documents)
> **Codebase Grounded**: 32 source files examined, ~50 plan references verified against code
> **Last Updated**: 2026-07-11
> **Note**: Artifact created 2026-07-10 by the same model in a *prior* session (fresh context for this review; creation-time hardening included 3 recon agents + 1 challenger). This scan ran its own independent challenger over the CRITICAL/MAJOR batch.

## Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, strict), Yarn v1 workspaces + Turbo, Vitest; 10 `@blend65/*` packages.
**Architecture:** AOT compiler pipeline (Lexer → Parser → Analyzer(Pass 1–4) → SFA → IL → Instr → ACME serializer), platform plugins over shared hooks, test-harness with golden/ACME/VICE tiers.
**Key files examined:** frontend `semantics/` (analyze, function-collection, module-variable-collection, import-resolution, const-eval, type-check/{expression,statement}-typing, name-resolution), `sfa/model-adapter`, core (symbol, semantic-model, const-value, diagnostic-codes, call-graph, type-utils, ast/nodes, reserved-builtins), codegen (il/cfg, il/lower, il/optimizer, instr/translate, instr/instr-program, instr/serialize-acme, runtime/embed), platforms (shared-hooks + 5 plugins), compiler (api/options, run-frontend, host/disk-host), spec (grammar.ebnf, 03-variables, 10-modules, 14-diagnostics), examples + goldens + slice5a/4b harness files.

**Reference verification:** ~50 `file:line` claims mapped — 48 verified exact; 2 misattributions (PF-005; plus `optimize-il.ts` shorthand for `il/optimizer/optimize-il.ts` — trivial, not a finding). Load-bearing ground-truth claims **confirmed**: the AR-7 const mis-lowering hole is real (`lower.ts:1057` kind-filter + `:1064-67` byte default); `initCode` is frozen-empty with zero consumers; the E90001 merge guard, silent-poison qualified path, spec §4.4/§5.4 quotes, E10193/E10194 registry rows, `findCallCycles` Symbol-genericity, E10174 one-per-cycle+path precedent, embed scan covering all streams, and the six-file golden inventory all check out.

## Summary by Dimension

| # | Dimension | Findings | Highest severity |
|---|-----------|----------|------------------|
| 1 | Ambiguities | 1 (PF-003) | 🟠 |
| 2 | Implicit Assumptions | 2 (PF-002, PF-007) | 🟠 |
| 3 | Logical Contradictions | 0 | — |
| 4 | Completeness Gaps | 1 (PF-009) | 🟡 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 1 (PF-008) | 🟡 |
| 8 | Security Blind Spots | 0 | — |
| 9 | Edge Cases | 0 | — |
| 10 | Scope Creep Indicators | 0 | — |
| 11 | Ordering & Sequencing | 0 (folded into PF-003) | — |
| 12 | Consistency | 1 (PF-006) | 🟡 |
| 13 | Codebase Alignment | 4 (PF-001, PF-004, PF-005, PF-010) | 🔴 |

## Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 CRITICAL | 1 | resolved — fix applied |
| 🟠 MAJOR | 3 | resolved — fixes applied |
| 🟡 MINOR | 5 | resolved — fixes applied |
| 🔵 OBSERVATION | 1 | resolved — fix applied |

## Resolution summary (2026-07-11)

The user resolved every finding per its recommendation (PF-001…PF-004 individually;
PF-005…PF-010 as an accepted batch) and the fixes were applied to the plan documents:

- **PF-001** — `fn` → `function` at all declaration sites (03-04 §1 ×3, N5; 07 ST-1/ST-2/ST-22).
- **PF-002** — 03-02 §1 step 2 rewritten (CallExpr OR IntrinsicCallExpr except `lo`/`hi`,
  recursing into lo/hi args, `emitLo` const-ref nuance noted); new **ST-15b** (`peek` in a
  module initializer → ICE) added to 07 + task 2.1.1; register correction note appended.
- **PF-003** — ST-3/ST-7/ST-10 pinned "inside a function body" in the 07 oracle table.
- **PF-004 (Option A)** — `modelToModuleVars` alias guard added to 03-01 §3 + task 1.2.6;
  03-02 §4 Step 4 gains the declaring-scope/alias-skip ordinal rule; the import-of-variable
  impl test now asserts exactly ONE `ModuleVarInput`.
- **PF-005** — typeAssign references corrected to `expression-typing.ts` (03-01 §2, task 1.2.5).
- **PF-006** — "five goldens" → "six existing goldens" across 01/02/03-03/03-04/07/99.
  While applying, an adjacent wrong cross-reference in 03-03 §4 was also corrected:
  "(regression ST-21)" → "(regression ST-29)" (ST-21 is the range-check test; ST-29 is the
  golden regression — same consistency class as this finding).
- **PF-007** — AR-4 allowed-surface wording corrected (unary removed, parity noted) with an
  explicit preflight-corrections note in the register (decision itself unchanged).
- **PF-008** — ST-23 re-cited to AR-8 + spec 10-modules.md:197-199; the §5.3
  fall-through-vs-JSR deviation added to task 5.1.1's ledger checklist.
- **PF-009** — `hasInitCode` made optional-with-default on the shared shim AND
  `PlatformPlugin.emitStartupShim`; five delegations thread it (03-03 §3, task 3.2.4).
- **PF-010** — sanitize() doc-comment staleness noted in 03-03 §2 for task 3.2.3.

Post-fix verification: no declaration-site `fn` remains in any plan document (member-identifier
uses like `Nope.fn()` / `Math.fn` are intentionally untouched).

---

## Findings

### PF-001: Acceptance fixture written in a nonexistent `fn` keyword 🔴 CRITICAL

**Dimension:** 13 — Codebase Alignment (Phantom Reference)
**Location:** `03-04-acceptance-fixtures.md` §1 (all three fixture files — 7 declaration sites: `fn main`, `export fn add`, `export fn twice`); `07-testing-strategy.md` ST-1, ST-2, ST-22, N5 scenario texts
**Codebase Evidence:** `packages/frontend/src/lexer/keyword-map.ts:21` — the keyword is `"function"`; no `fn` alias exists anywhere in the lexer. `spec/grammar.ebnf.md:80` — `function_decl = [ "export" ] , "function" , identifier …` (frozen). Every shipped fixture (`examples/slice5a/main.blend` etc.) uses `function`.
**The Problem:** Task 4.1.1 mandates "Fixture sources (exact 03-04 §1 text)". As written the fixture fails to lex/parse, killing the entire 3-part acceptance bar (golden mint, ACME, VICE) — and the `fn` shorthand also infects Phase-1/3 spec-test scenario rows (ST-1/ST-2/ST-22/N5), which are an immutable oracle hit at the RED gates. Note `Nope.fn()` in ST-5/N3 is *fine* (`fn` there is a member identifier, not a keyword) — only declaration sites are wrong. Everything else in the fixture verifies clean: `$`-hex literals are supported (`lexer.ts:260`), `pokew` exists (`intrinsics/catalog.ts:130`), bare `poke`/`pokew` without import matches the shipped slice5a pattern, `Math.base + 1` types via literal adaptation (`expression-typing.ts:144-150`), and the derived init order/expected memory values are internally correct.

**Options:** Only one viable resolution — (a) replace `fn` → `function` at the declaration sites in 03-04 §1 and the 07 scenario rows. Considered and rejected: adding `fn` to the language (violates the frozen spec, D3, and the Language Guard).

**Recommendation:** Option (a).
**Confidence:** High. **Hardening:** independent challenger CONFIRMED (verified no `fn` support repo-wide; flagged the `Nope.fn()` non-defect).

**User Decision:** Resolved — user accepted the recommendation; fix applied.

---

### PF-002: The AR-4 call-rejection walk misses builtin intrinsic calls (`IntrinsicCallExpr`) 🟠 MAJOR

**Dimension:** 2 — Implicit Assumptions (+ 4 Test coverage)
**Location:** `03-02-initializers-init-order.md` §1 step 2 ("walk the initializer for ANY `CallExpr`"); `07-testing-strategy.md` (no ST covers an intrinsic call in an initializer)
**Codebase Evidence:** The 23 reserved builtins (`peek`, `peekw`, `poke`, `pokew`, `lo`, `hi`, `sizeof`, …, `asm_*`) parse as a distinct node kind `IntrinsicCallExpr` (`packages/core/src/ast/reserved-builtins.ts:21-48`; `nodes.ts:377` vs `:390`), so a `CallExpr`-only walk misses them. Precisely: `peek`/`peekw` type clean (`expression-typing.ts:403-415`) and lower clean (`emitPeek`/`emitPeekw`, `lower.ts:899-923`) → **silent widening** of the agreed call-free surface into `__init`; `poke`/`pokew` self-block via E10152 (void→byte); `sizeof`/`offsetof`/`length`/`asm_*` poison today. Platform-contributed intrinsics DO parse as plain `CallExpr` (`reserved-builtins.ts:10-11`, `expression-typing.ts:247-253`) and are caught. The `lo`/`hi` carve-out is *required* (AR-4's resolved allowed surface includes them) and safe: `emitLo`/`emitHi` (`lower.ts:946-961`) ICE loudly on any non-literal argument.
**The Problem:** As written, `let x: byte = peek($D012);` at module level bypasses the loud-deferral ICE, contradicting the user-resolved AR-4 decision ("user, intrinsic, or unresolved alike") — a silent semantic widening no planned test would catch.

**Options:** Only one viable resolution — (a) amend 03-02 §1 step 2 to: reject any `CallExpr` OR any `IntrinsicCallExpr` whose name ∉ {`lo`, `hi`}; recurse into `lo`/`hi` arguments (a nested call inside `lo(...)` must still be rejected); add one ST to the module-init-typing table (`let x: byte = peek($D012);` → ICE); add a one-line note that `lo(K)` over a const currently ICEs at `emitLo` (AST-kind check — loud, parity with function bodies). Considered and rejected: blanket `IntrinsicCallExpr` rejection (contradicts AR-4's resolved lo/hi allowance).

**Recommendation:** Option (a).
**Confidence:** High. **Hardening:** challenger CONFIRMED and narrowed the silent set to `peek`/`peekw`; refinements adopted.

**User Decision:** Resolved — user accepted the recommendation; fix applied (incl. ST-15b).

---

### PF-003: ST-3/ST-7/ST-10 scenarios ambiguous between module-level and function-local — Phase-1-unpassable (and ST-3 self-contradictory) if module-level 🟠 MAJOR

**Dimension:** 1 — Ambiguities (+ 11 Ordering)
**Location:** `07-testing-strategy.md` ST-3 (`let r: byte = Math.add(1, 2);`), ST-7 (`let x: byte = Math.scaled;`), ST-10 (`let x: byte = Math.add;`)
**Codebase Evidence:** Top-level `let` initializers are typed by NOTHING until Phase 2 task 2.2.1 (`statement-typing.ts:53-67` dispatches only `FunctionDecl`/`InterruptDecl`), yet ST-3…ST-11 must be GREEN at Phase-1 task 1.2.7 against an immutable oracle ("fix implementation only"). Additionally, ST-3 authored module-level is *permanently* contradictory: in the final system it is a call-bearing initializer → AR-4 ICE, never "typed byte; call edge recorded" (and call edges require an enclosing function — `recordCallEdge` via `enclosingFunctionSymbol`).
**The Problem:** ST-6 explicitly says "function-local"; the unmarked ST-3/ST-7/ST-10 rows read as module-level by default. Mis-authored oracle rows either block the 1.2.7 GREEN gate or force forbidden test edits. (ST-4/5/8/9/11 are grammar-forced into function bodies — no ambiguity there.)

**Options:** Only one viable resolution — (a) pin ST-3/ST-7/ST-10 as function-local shapes in the 07 table (e.g. "inside `main()`: …"). Considered and rejected: moving them to Phase 2 (ST-3 stays contradictory at module level regardless; the qualified-access surface is Phase-1 subject matter).

**Recommendation:** Option (a).
**Confidence:** High. **Hardening:** challenger AMENDED (dropped ST-5 from the finding — grammar-forced; confirmed the rest); amendment adopted.

**User Decision:** Resolved — user accepted the recommendation; fix applied.

---

### PF-004: Imported-variable aliases double-project in `modelToModuleVars`; AR-5's declIdx derivation needs an explicit alias-skip rule 🟠 MAJOR

**Dimension:** 13 — Codebase Alignment (Impact Blindness)
**Location:** `03-02-initializers-init-order.md` §4 Step 4 ("declIdx = the merged scope's `symbols` insertion order"); `03-01` Testing Requirements ("import-of-variable witness")
**Codebase Evidence:** `resolveImports` inserts the SAME Symbol into the importing scope, gated only on `exported` (`import-resolution.ts:100`) — importing an exported module `let` is legal today. `modelToModuleVars` (`model-adapter.ts:169-186`) iterates every module scope's `symbols` map and names entries after the *iterated* scope (`:173-174`), never checking `sym.scope` → an imported variable projects twice: `__var_<Home>_<name>` + phantom `__var_<Importer>_<name>`. Lowering never references the phantom (`moduleVarOf` uses `sym.scope`, `lower.ts:1052-61`) and no ACME collision is possible (import-name collisions are E10003), but `layoutModuleVariables` double-counts size and shifts addresses (no dedup). The sharper 5b risk: 03-02 §4's declIdx is ambiguous for a Symbol present in two scopes' maps — with imported modules ordered FIRST (Step 3), a scope-map-iterating implementation can assign an aliased variable the *importer's* (moduleOrderIdx, declIdx), deviating from spec Ch 10 §5.4's declaration-order baseline — and per AR-5's own note, that base order gets **golden-baked**. (The `initializers` map itself is Symbol-keyed at collection time and does not double-count.)
**The Problem:** A pre-existing latent defect (unexercised — no test or fixture imports a variable) that 5b's own surface (the planned import-of-variable witness, the variable-heavy fixture, the ordinal derivation) makes salient, with a spec-conformance + resource-report consequence the plan text never acknowledges.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Fix in this slice: one-line `if (sym.scope !== moduleScope) continue;` in `modelToModuleVars` (attach to task 1.2.6, whose file list already includes model-adapter.ts); amend 03-02 §4 Step 4 to "declIdx = the symbol's ordinal in its **declaring** scope; aliases are skipped during derivation"; extend the import-of-variable impl test to assert exactly ONE `ModuleVarInput` (home module name) | Closes a real layout/order hole exactly where the slice builds on it; tiny, grounded, test-witnessed | +1 small task's worth of work in Phase 1 |
| B | Amend only the plan text (declIdx = declaring-scope ordinal, aliases skipped) and record the phantom `__var_*` projection as a named pre-existing defect deferred to a later slice | Keeps 5b's diff minimal | Leaves a known RAM/report skew reachable from user code; the import-of-variable witness would pass while the phantom persists |

**Recommendation:** Option A — the fix is one line plus one assert, and the init-order correctness half is mandatory for this slice anyway; splitting them buys nothing.
**Confidence:** High. **Hardening:** challenger CONFIRMED with consequence-precision amendments (adopted: lowering-unaffected, no-collision, layout/report skew, golden-baked order risk).

**User Decision:** Resolved — user chose Option A; fix applied.

---

### PF-005: `typeAssign` misattributed to statement-typing.ts 🟡 MINOR

**Dimension:** 13 — Codebase Alignment (wrong file reference)
**Location:** `03-01-merging-qualified-access.md` §2 heading "typeAssign — qualified write target (statement-typing.ts)"; `99-execution-plan.md` task 1.2.5 file list
**Codebase Evidence:** `typeAssign` lives in `expression-typing.ts:198-217` (assignments are `AssignExpr` expressions reached via `typeOfExpr`; `ExpressionStmt` routes there — `statement-typing.ts:97-99`). The IdentExpr-only const guard the new arm extends is at `expression-typing.ts:202-211`.
**The Problem:** Task 1.2.5 would send the executor to the wrong file; the qualified-write arm belongs beside the existing guard.
**Recommendation (only viable):** Correct both references to `expression-typing.ts` (keep task 1.2.5, retargeted).

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

### PF-006: "Five goldens" — six exist 🟡 MINOR

**Dimension:** 12 — Consistency
**Location:** `00-index.md` (AC wording), `01-requirements.md` AC-2, `02-current-state.md` risk table, `03-03` §4, `03-04` §3, `07` ST-29
**Codebase Evidence:** Six `.golden` files exist: `packages/test-harness/test/golden/{gate,slice3a,slice3b,slice4a,slice4b,slice5a}.asm.golden` — the docs' own parenthetical lists all six while saying "five". The "both compiler assemble goldens" (`assemble.golden.spec.test.ts`, `assemble-rt.golden.spec.test.ts`) are separate and correctly counted.
**The Problem:** An executor verifying "five goldens byte-exact" could under-check by one.
**Recommendation (only viable):** Reword to "all six existing goldens (gate + the five slice goldens)".

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

### PF-007: AR-4's "allowed surface" lists unary arithmetic — the scalar engine neither types nor lowers `UnaryExpr` 🟡 MINOR

**Dimension:** 2 — Implicit Assumptions
**Location:** `00-ambiguity-register.md` AR-4 (allowed surface: "…unary/binary arith…"); inherited by `03-02` §1 step 4's parity framing
**Codebase Evidence:** `computeType`'s default arm silently poisons unary (`expression-typing.ts:96-99`, comment names unary explicitly); `lower.ts` has no `UnaryExpr` case (grep: zero hits). E.g. `let x: sbyte = -3;` — typed poison with NO diagnostic (in range, so no E10084), then a lowering ICE. Parity with function-local `let`s does hold (same behavior there today), so the plan's *mechanism* is right; the register's surface listing overstates.
**The Problem:** An executor (or test author) could reasonably write a unary-initializer test expecting success.
**Recommendation (only viable):** Correct the allowed-surface wording in the register + 03-02 (drop "unary" or annotate "unary currently ICEs at lowering — parity with locals; widens in a later slice"). No behavior change this slice.

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

### PF-008: ST-23's Source cites spec lines that prescribe the *opposite* startup shape 🟡 MINOR

**Dimension:** 7 — Testability (oracle citation accuracy)
**Location:** `07-testing-strategy.md` ST-23 Source column ("spec 10-modules.md:183-186")
**Codebase Evidence:** `spec/10-modules.md:183-192` prescribes **fall-through into `main()` with no JSR** ("there is no `JSR main` / `RTS`"); the shipped shim uses `JSR _main` (`shared-hooks.ts:93-99`) — a pre-existing, golden-pinned RD-07c deviation. ST-23's `JSR __init` placement is actually pinned by AR-8 + the shipped shim contract; the spec half that applies is §5.4's "before `main()`" (`:197-199`).
**The Problem:** In an immutable-oracle table, the citation should name what actually pins the expectation; as-is it invites a false "implementation contradicts spec" reading at RED.
**Recommendation (only viable):** Re-cite ST-23 to AR-8 + spec 10-modules.md:197-199; optionally note the pre-existing §5.3 fall-through deviation in the task-5.1.1 ledger update if not already recorded.

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

### PF-009: `PlatformPlugin.emitStartupShim` untouched by the shim signature change 🟡 MINOR

**Dimension:** 4 — Completeness Gaps
**Location:** `03-03-init-codegen.md` §3 (signature `c64StyleStartupShim(variant, hasInitCode)` + files list)
**Codebase Evidence:** Each plugin also exposes `emitStartupShim(variant)` delegating to `c64StyleStartupShim` (`c64.ts:92-94`); only `emitPreamble` is consumed by the live pipeline (`instr-program.ts:138`). Changing the shared hook's signature forces a decision at five delegation sites the plan never mentions.
**The Problem:** Typecheck will force *a* resolution, but the plan should record the intended one so five executors don't improvise five ways.
**Recommendation (only viable):** Make `hasInitCode` an optional parameter defaulting `false` on both the shared hook and `PlatformPlugin.emitStartupShim`, and pass it through the five delegations — keeps the public seam expressive and the diff additive. (Considered: pinning delegations to `false` — leaves a public API that cannot express init; rejected.)

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

### PF-010: `sanitize()`'s doc contract goes stale with `__init` 🔵 OBSERVATION

**Dimension:** 13 — Codebase Alignment (doc-contract nit)
**Location:** `03-03-init-codegen.md` §2
**Codebase Evidence:** `translate.ts:1121-1126` — sanitize's doc states the `__` prefix "is never produced here"; routing the synthetic `fn.name = "__init"` through it makes that sentence false (the *intent* — `__` reserved for compiler symbols — is preserved, since `__init` IS one).
**Recommendation (only viable):** Update the comment as part of task 3.2.3 (plain-language, no plan references).

**User Decision:** Resolved — user accepted the recommendation (minors batch); fix applied.

---

## Verified-clean highlights (no findings)

- **Dependencies/Ordering:** Phase chain is sound — `importEdges` recorded in 1.2.2 before Phase-2 consumption; `symbolMap` coverage precedes the init graph; `initOrder`/`constValues` precede Phase-3 lowering. No circular task deps.
- **Feasibility:** the synthetic `__init` `ILFunction` record matches the real interface (`cfg.ts:43-55`); `findCallCycles` is Symbol-generic and its E10174 anchor/path precedent matches AR-6's shape; the runtime-embed scan (`collectReferencedRoutines`) walks *all* streams, so `JSR __rt_mul8` inside `__init` is picked up with zero extra wiring; the optimizer preserves `initCode` (pass pipeline spreads/passes the program through).
- **Golden stability:** conditional `JSR __init` emission is structurally able to keep initializer-free output byte-identical (shim/preamble path verified end-to-end).
- **Fixture semantics:** init-order derivation, expected memory table, `outName` derivation (`main.blend` lexicographically first), and the AR-4(5a) live-value avoidance all check out.
- **ST-20's pinned code is correct:** `boolean → byte` routes to E10152 via `assignmentMismatchCode` (`expression-typing.ts:473-483`).
