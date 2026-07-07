# Preflight Report: RD-18 Slice 4a — Conditionals, Loops & the CFG Codegen Keystone

> **Status**: ✅ **PASSED — all 4 findings resolved** (0 critical, 1 major, 3 minor, 0 observation); fixes applied & re-scanned 2026-07-07
> **Iteration**: 1 (first scan) + 2 (fix-verification re-scan, 2026-07-07)
> **Artifact**: Implementation plan at `codeops/features/blend65-ri/plans/rd-18-slice-4a-conditionals-loops/`
> **Codebase Grounded**: 13 source files examined, ~30 references verified (1 stale, 1 impact-blind gap)
> **Last Updated**: 2026-07-06
> **CodeOps Skills Version**: 3.2.0

> ⚠️ **NOT a same-session review** — the plan was created in a prior session (git status shows the
> directory untracked; this preflight session began fresh via `/clear`). Same-agent bias risk is
> the ordinary cross-session level, not elevated.

### Codebase Context Summary

**Tech Stack:** TypeScript (ESM/NodeNext, ES2023, strict), Yarn v1 workspaces + Turbo, Vitest. 10 `@blend65/*` packages.
**Architecture:** AOT 6502 compiler pipeline: Lexer → Parser → Analyzer (`analyze.ts`) → SFA → IL lowering (`lower.ts`) → IL→Instr translate (`translate.ts`) → ACME → PRG. Frontend (`analyze()`/`compile()`) is total (never throws; errors go to a `DiagnosticBag`).
**Key Files Examined:** `packages/codegen/src/il/{lower,builder,instruction,cfg}.ts`; `packages/codegen/src/instr/translate.ts`; `packages/frontend/src/semantics/{analyze,function-collection,post-check,const-eval}.ts`, `type-check/{statement-typing,type-resolution}.ts`; `packages/core/src/{diagnostics/diagnostic-codes,diagnostics/diagnostic-bag,semantics/scope,ast/nodes}.ts`; `parser/parse-stmt.ts`; `spec/05-statements-control-flow.md`.

**Reference verification (highlights):**
- ✅ `lower.ts:181-199` lowerStmt default→`iceUnsupported`; `builder.ts` reserveLabel(:77)/openBlock(:112)/terminate(:97)/isTerminated(:102); `instruction.ts:156-165` br/brcond/ret/unreachable; `cfg.ts` BasicBlock/ILFunction — all as described.
- ✅ `translate.ts:173` reads `blocks[0]` only; `:304-314` translateTerminator ret-only; `translateComparison` :600-630 `_cmp` labels; `cmpCounter` :157.
- ✅ Semantics: `statement-typing.ts` default no-op (:81-84); `function-collection.ts` flat local scan (:107-120), no nested scopes/for-counter; `post-check.ts` checkMainValidity only E10020/21/22; `analyze.ts` pipeline order; `const-eval.ts` fold set.
- ✅ **E10061 / E10102 / E10134 all currently free (0 occurrences)**; E10064/E10130/E10131 registered but 0 call sites; E10100=UndeclaredIdentifier (taken). `scope.ts` `"block"` kind exists, created only in a test.
- ✅ AST fields: `FunctionDeclNode.nameSpan`/`returnType`/`body`; `ForStmtNode` fields all match the plan.
- ⚠️ **Stale:** the "existing E10003 dup-check in the collector" (03-01 §B) — `function-collection.ts` does **no** duplicate detection (E10003 is emitted in `module-variable-collection.ts:50`). → PF-003.
- ⚠️ **Under-mapped:** `02-current-state.md §4` and `03-03` never mention the translator's D10 register-residency / prescan / store-fold machinery (`regA`/`regX`/`useCount`/`skipIndex`), which the multi-block change directly interacts with. → PF-001.
- ⚠️ **Impact-blind:** `ForStmtNode.varType` is `TypeNode | null`; the parser accepts a counter with no type annotation and emits no diagnostic. The plan assumes the type is present. → PF-002.

### Summary by Dimension

| # | Dimension | Findings | Highest Severity |
|---|-----------|----------|-----------------|
| 1 | Ambiguities | 0 | — |
| 2 | Implicit Assumptions | 1 (PF-002) | 🟡 |
| 3 | Logical Contradictions | 1 (PF-004) | 🟡 |
| 4 | Completeness Gaps | 2 (PF-001, PF-002) | 🟠 |
| 5 | Dependency Issues | 0 | — |
| 6 | Feasibility Concerns | 0 | — |
| 7 | Testability | 0 | — |
| 8 | Security Blind Spots | 0 (N/A — AOT compiler, no runtime input surface) | — |
| 9 | Edge Cases | 1 (PF-002) | 🟡 |
| 10 | Scope Creep | 0 | — |
| 11 | Ordering & Sequencing | 0 | — |
| 12 | Consistency | 1 (PF-004) | 🟡 |
| 13 | Codebase Alignment | 3 (PF-001, PF-002, PF-003) | 🟠 |

### Summary by Severity

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | — |
| MAJOR | 1 | ✅ resolved (PF-001) |
| MINOR | 3 | ✅ resolved (PF-002, PF-003, PF-004) |
| OBSERVATION | 0 | — |

---

### PF-001: Multi-block `translate.ts` carries block-local fold state across block boundaries 🟠 MAJOR

**Dimension:** 13 (Codebase Alignment — Impact Blindness) / 4 (Completeness)
**Location:** `03-03-multiblock-translate.md` §1 (all-blocks loop) and §2; `02-current-state.md` §4.
**Codebase Evidence:** `translate.ts` — `prescan(block)` scans `blocks[0]` only (`:173-175`, `:193-205`); `useCount` populated only there (`:197`,`:203`) and consumed for load/store folds at `:338` (`<=1` → defer+fold single-use load) and `:581` (`>1` → don't fold store-home); `skipIndex` set at `:592`, read at `:177` (`if (i === this.skipIndex) return;`), reset **only** at field-init `:155` (never in `run()` or `clearRegs()` `:823`); `regA`/`regX` residency suppress `LDA` at `:462`.

**The Problem:** The plan's new "loop over all `fn.blocks`" (03-03 §1) reuses one `Translator` instance whose peephole state is **block-local by construction today** but is never reset between blocks. Two concrete wrong-code paths the keystone makes reachable:
1. **`skipIndex` is an instruction *index*, not a temp id.** A word-ALU store-fold in block A leaves `skipIndex ≥ 0`; block B's `instructions.forEach` restarts at index 0, so an instruction at that same index in B is silently dropped (`:177`).
2. **`prescan` under-counts non-entry blocks.** Any temp read twice inside a body/latch block has `useCount` 0 → `0 <= 1` → its load is folded as single-use into the first consumer (`:338`); the second consumer then reads nothing.

Neither is protected by "temps are block-local" (that only stops false-positive `regA` id matches). The 4a *fixture* is all-`byte` with single-use temps, so it likely stays green — but the keystone every later control-flow slice builds on would miscompile general programs. Additionally, 03-03 §2's "reuse the `translateComparison` pattern… branch on those flags" and the line-41 "fuse when flags live" hint are unsafe: `translateComparison` (`:600-630`) *materializes* a 0/1 boolean and consumes the flags itself (see PF-004).

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Mandate in 03-03 §1: run `prescan` per block (or over all blocks up front) **and** reset per-block-local state at each block boundary — `clearRegs()` + `skipIndex=-1` + `leadSpan=undefined` — and delete the "fuse when flags live" hint. | Cheap, total, correct for the keystone and all downstream slices; a few lines of plan text + impl. | None material. |
| B | Prove temps never cross blocks and no word-ALU/double-read occurs, keep state flowing. | No reset code. | Not defensible for a *keystone*; `skipIndex` bug is index-keyed and independent of temp locality; brittle against every future program and slice. |

**Recommendation:** **Option A** — a basic-block label is a branch target, so nothing may carry across it. State the reset explicitly (prescan-all-blocks + per-block `clearRegs()`/`skipIndex`/`leadSpan` reset) in 03-03 §1, add an impl test (P3) for a non-entry block with a twice-read temp and for a word-ALU-then-branch shape, and remove the flags-live fusion suggestion. This is the only viable resolution.

**Confidence:** High. **Hardening:** independent challenger CONFIRMED-MAJOR and strengthened it (surfaced the `skipIndex` index-keyed drop and the `useCount` under-count as concrete miscompiles, not theoretical); every cited line verified against the source.

**User Decision:** Resolved — User accepted recommendation (2026-07-07); fix applied.

---

### PF-002: For-counter with an omitted (or non-integer) type annotation is undefined in the plan 🟡 MINOR

**Dimension:** 4 (Completeness) / 9 (Edge Cases) / 13 (Impact Blindness) / 2 (Implicit Assumptions)
**Location:** `03-01-control-flow-semantics.md` §B (counter symbol build) and §D step 1 (counter-type check).
**Codebase Evidence:** `parse-stmt.ts:175-179` — the `: type` is optional, so `for (let i = 0 to 5) {}` parses with `ForStmtNode.varType === null` and **no** diagnostic. The plan unconditionally does `resolveTypeNode(varType)`, which returns `ERROR_TYPE` for `null` (`type-resolution.ts:23-24`). `integerRange(t)` returns `null` for `ERROR_TYPE` **and** for `boolean`/`void` (`type-resolution.ts:41,52`), so §D's E10064 range check silently degenerates and the literal width-adaptation cascade-suppresses. `spec/05-statements-control-flow.md:266-268` — the counter "must be an integer type"; every example annotates it; no inference rule exists.

**The Problem:** A type-less counter (parser-legal, spec-incomplete) yields a poisoned counter with **no diagnostic** → silent degraded/undefined codegen — the worst failure class, even though it can't crash (contract holds) and the fixture always annotates. §D step 1's annotated-but-non-integer case ("reuses the existing type-mismatch path") names no concrete check or code and has the *same* silent-pass behavior for `boolean`/`void` counters. Not a 4a blocker (pre-existing parser gap; fixture green), but it must be **named and guarded**, not left silently deferred.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | In §D, guard off `integerRange(counterType) === null` → emit a "for-counter must have an explicit integer type" diagnostic and poison the counter. One check covers null-annotation + boolean/void. | Matches spec, no inference machinery, one predicate covers the whole failure set; consistent with AR-11 additive-code precedent. | Needs a code decision (no dedicated counter-type code is currently registered). |
| B | Infer the counter type from `init`/`bound` when `varType` is null; separately reject non-integer annotations. | Accepts more programs. | New inference machinery; spec gives no inference rule; larger scope, contradicts the "match parser+spec reality" framing. |
| C | Explicitly defer in the Ambiguity Register (name it, accept the silent-poison risk for malformed input, fixtures avoid). | Zero new code in 4a. | Silent-miscompile class left open; weakest of the three. |

**Recommendation:** **Option A** — key the guard off `integerRange(counterType) === null` (covers the `null` annotation and `boolean`/`void` in one predicate), emit a diagnostic, poison. Register the code additively per the inherited AR-11 precedent (or reuse a free Ch-05 number if one maps). If the user prefers to keep 4a lean, **Option C** is acceptable *provided it is written into the register as a named deferral* — but silent `ERROR_TYPE → codegen` is not acceptable.

**Confidence:** Med→High (downgraded from an initial MAJOR after the challenger showed no crash + fixture-green + pre-existing). **Hardening:** challenger DOWNGRADED to MINOR and broadened the guard to the whole `integerRange===null` set; both mechanics verified in source.

**User Decision:** Resolved — User accepted recommendation (2026-07-07); fix applied.

---

### PF-003: "Existing E10003 dup-check in the collector" is a stale reference 🟡 MINOR

**Dimension:** 13 (Codebase Alignment — Stale Assumption)
**Location:** `03-01-control-flow-semantics.md` §B: *"Duplicate names across siblings fall to the existing E10003 dup-check in the collector."*
**Codebase Evidence:** `function-collection.ts` performs **no** duplicate detection — its header states *"Nothing here does typing, name resolution, or duplicate detection yet,"* and it writes locals with `bodyScope.symbols.set(...)` (last-wins). E10003 (`DuplicateDecl`) is emitted in `module-variable-collection.ts:50`, a different pass, over module variables — not function-body locals.

**The Problem:** With flat-recurse collection (AR-9), two `let x` in sibling blocks both `.set("x", …)` into the **function** scope Map → they **silently alias to one frame slot** (last-wins), with no E10003. The plan's stated safety net does not exist for this path. It doesn't affect the fixtures (they don't exercise it) and is consistent with deferring shadowing/dup checks (AR-2/AR-5), but the documented mechanism is factually wrong and could mislead the implementer into assuming a guard that isn't there.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Reword §B to state the actual behavior: `function-collection.ts` does no dup detection; duplicate sibling-block locals silently alias (last-wins), which is acceptable under flat-collection (AR-9) and not exercised by fixtures; real dup/shadow detection is deferred with E10101/E10062 (AR-2/AR-5). | Accurate, keeps scope unchanged, one paragraph edit. | Leaves a known latent aliasing gap (already an accepted deferral). |
| B | Add a real duplicate-local check (emit E10003) during flat collection now. | Closes the aliasing gap. | Expands 4a scope into deferred-validator territory (AR-2/AR-5); needs block-scope semantics to be meaningful. |

**Recommendation:** **Option A** — correct the claim; do not expand scope. Dup/shadow detection is deliberately deferred (AR-2/AR-5), so the honest statement is "flat collection, silent last-wins alias, fixtures avoid it," not a phantom E10003 net.

**Confidence:** High. **Hardening:** verified by direct file read (function-collection.ts header + module-variable-collection.ts:50).

**User Decision:** Resolved — User accepted recommendation (2026-07-07); fix applied.

---

### PF-004: 03-03 §2's `brcond` translation is internally inconsistent (flags-live vs materialized boolean) 🟡 MINOR

**Dimension:** 12 (Consistency) / 3 (Logical Contradiction)
**Location:** `03-03-multiblock-translate.md` §2 (`brcond` bullet) and the §2 note at line 41–49.
**Codebase Evidence:** `translateComparison` (`translate.ts:600-630`) does **not** leave the compare's CPU flags live for a downstream consumer — it emits `CMP` then materializes a 0/1 byte via `LDA #1 / <branch> / LDA #0` + a `_cmp` join label and binds the result temp into A (`:620-624`).

**The Problem:** §2 says to translate `brcond` by *"reuse the `translateComparison` pattern … the comparison sets the CPU flags; translate the `brcond` as a conditional branch on those flags,"* and line 41 hints at *"fuse … when the flags are still live."* But the current comparison lowering consumes the flags and hands back a materialized boolean — there are no live flags at the `brcond`. The plan's *other* stated shape in the same bullet — `LDA <cond>; BNE <trueTarget>; JMP <falseTarget>` — is the correct one. The two descriptions contradict, and the flags-live one presupposes a non-materializing comparison lowering that doesn't exist yet. An implementer following the first framing could wire `brcond` to phantom-live flags.

**Options:**

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | Keep only the correct materialized-boolean shape (`LDA <cond>; BNE trueTarget; JMP falseTarget`); delete the "branch on those flags" / "fuse when flags live" framing (or move it to an explicit RD-08 future-work note that first requires a non-materializing compare). | Removes the contradiction; matches the actual 3b comparison lowering; correct-first per the plan's own "unoptimized first" stance. | None. |
| B | Leave as-is (two shapes, reader picks the right one). | No edit. | Contradiction stands; risks a wrong `brcond` wiring; couples PF-001's unsafe-fusion hint. |

**Recommendation:** **Option A** — the condition operand is always a materialized boolean in 3b/4a, so specify exactly `LDA <cond>; BNE trueTarget; JMP falseTarget` and drop the flags-live language (fold-with-compare is an RD-08 peephole that needs a different compare lowering first). Pairs with PF-001's removal of the fusion hint.

**Confidence:** High. **Hardening:** verified against `translateComparison` source.

**User Decision:** Resolved — User accepted recommendation (2026-07-07); fix applied.

---

## Pass determination

**✅ PASSED — all 4 findings resolved (2026-07-07).** The user accepted every recommendation; fixes were
applied to the plan docs and an iteration-2 re-scan confirmed them. No design change, no scope expansion.

### Iteration 2 — fix verification & regression sweep (2026-07-07)

| Finding | Fix applied | Verification |
|---|---|---|
| PF-001 | `03-03` new **§1a** mandates `prescanAll()` (all blocks + terminator reads `brcond.cond`/`ret.value`) and a per-block `resetBlockState()` (`clearRegs()` + `skipIndex=-1` + `leadSpan=undefined` + clear `loadSource`); flags-live fusion hint removed. Exec 3.2.1 + impl-test 3.3.2 updated; testing P3 updated. | §1a states the reset before each block; the two miscompile paths (skipIndex-drop, useCount under-count) each have a named impl test. Resolved. |
| PF-002 | `03-01` §D now guards off `integerRange(counterType) === null` → **E10065** (covers null + non-integer), poisons; new **AR-15** mints E10065 (free in registry/spec/code, no Ch-05 drift); §A table + FR-3 + success-criterion #2 + ST-24 + exec 1.1.3/1.2.1/1.2.4 updated. | Silent `ERROR_TYPE` fall-through replaced by a loud diagnostic; code verified free (0 occurrences). Resolved. |
| PF-003 | `03-01` §B rewritten: `function-collection.ts` does no dup detection; sibling-block locals silently alias (last-wins), acceptable under AR-9; the phantom E10003 net claim removed (E10003 lives in `module-variable-collection.ts:50`). | Claim now matches the code. Resolved. |
| PF-004 | `03-03` §2 `brcond` bullet rewritten to the single correct shape `LDA <cond>; BNE trueTarget; JMP falseTarget`; the contradictory "branch on live flags" / fuse-when-live framing removed (noted as an RD-08 peephole needing a non-materializing compare). | Internal contradiction gone; matches `translateComparison`'s materialized-0/1 reality. Resolved. |

**Regression sweep:** cross-doc references consistent — `E10065`, `AR-15`, `ST-24` present in all
relevant docs; the four gate-range headers bumped `AR-1…AR-14` → `AR-1…AR-15`; success-criterion #2 and
exec 5.1.2 updated to four new codes; task count unchanged (35 — existing tasks amended, none added). No
new findings introduced by the edits. `spec/` untouched (D3).
