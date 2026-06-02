# Execution Plan: RD-03 Parser & AST

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Commit mode**: `--no-commit` — implement, verify, update this plan; the user performs all git operations (AR-7).
> **Progress**: 0/6 phases complete (0%)
> **Last Updated**: 2026-06-02
> **CodeOps Version**: (unstamped — no `codeops-mcp` dependency in this repo; consistent with RD-01/RD-02/RD-11a)

## Overview

Implement the parser + AST model in six phases, **spec-tests-first**. The AST vocabulary
(`NodeKind`, 50 node interfaces, `AstVisitor`, walkers, `RESERVED_BUILTINS`) and the parser
diagnostic codes are added to `@blend65/core` (addition-only — frozen RD-11a/RD-02 code is
never refactored, AR-Q2/D3). The parser logic (`parse`, cursor, Pratt, parse functions) is
built in `@blend65/frontend`. Each phase ends green against the verify command. No git
operations are performed.

**Verify command (run at the end of every phase):**

```bash
yarn install --frozen-lockfile && yarn turbo run build && yarn turbo run typecheck && yarn turbo run lint && yarn test
```

## Pre-flight (confirmed before execution)

- **AR-1..AR-7** ([00-ambiguity-register](00-ambiguity-register.md)) confirmed with the user.
- No open micro-decisions. If a runtime ambiguity surfaces, STOP and log it as the next `AR-N`
  (runtime), resolve with the user, back-propagate, resume.

## Implementation Phases

| Phase | Title                                              | Sessions | Est. Time |
| ----- | -------------------------------------------------- | -------- | --------- |
| 1     | AST catalogue + parser codes (core) + req fix      | 1–2      | 90 min    |
| 2     | Parser skeleton + source structure                 | 1–2      | 90 min    |
| 3     | Declarations                                        | 1–2      | 90 min    |
| 4     | Statements                                          | 1–2      | 90 min    |
| 5     | Expressions (Pratt) + intrinsics + struct literals  | 2        | 120 min   |
| 6     | Recovery, golden snapshots, fuzz, acceptance & close| 1–2      | 90 min    |

**Total: ~8–11 sessions, ~9 hours.**

---

## Phase 1 — AST catalogue & parser codes (core) + requirements fix

**Reference**: [03-01](03-01-ast-node-catalogue.md), [03-03](03-03-error-recovery.md). **Goal:**
the 50-kind AST vocabulary + visitor/walkers + `RESERVED_BUILTINS` exist in `@blend65/core`;
parser codes added to the registry; the RD-03 requirements doc is corrected (AR-1). Core stays
dependency-free.

| #     | Task                                                                                               | File |
| ----- | -------------------------------------------------------------------------------------------------- | ---- |
| 1.1   | Write spec tests **first**: ST-P1 (`node-kind`), ST-P2 (`reserved-builtins`), ST-P2b (codes), ST-P3 (`walk`) | `packages/core/src/ast/*.impl.test.ts`, `diagnostics/diagnostic-codes.impl.test.ts` |
| 1.2   | Verify 1.1 tests FAIL (red phase)                                                                  | — |
| 1.3   | Create `ast/node-kind.ts` (50 kinds), `ast/nodes.ts` (interfaces + unions), `ast/visitor.ts`, `ast/walk.ts`, `ast/reserved-builtins.ts`, `ast/index.ts` | `packages/core/src/ast/*` |
| 1.4   | Wire `export * from "./ast/index.js";` into core barrel                                            | `packages/core/src/index.ts` |
| 1.5   | Add E10072 + E10300–E10316 to `DiagCode` (addition-only block, AR-6)                              | `packages/core/src/diagnostics/diagnostic-codes.ts` |
| 1.6   | Edit `requirements/RD-03-parser-ast.md`: remove asm-block refs (R36, §4.2 catalogue, §4.5 interface + StmtNode, §4.11 visitAsmBlock, §4.10 asm row, §7 Q#1); update counts 51→50 / 14→13 / AC-13 (AR-1) | `requirements/RD-03-parser-ast.md` |
| 1.7   | Verify 1.1 tests PASS (green phase)                                                                | — |
| 1.8   | Run verify. **Phase gate:** build + tests green; core has no `@blend65/*` deps; R15 tier green; `git status --porcelain spec/` empty | — |

---

## Phase 2 — Parser skeleton + source structure (frontend)

**Reference**: [03-02](03-02-parser-algorithm.md). **Goal:** `parse()` exists; cursor works;
`Program`/`ModuleDecl`/`ImportStmt` + top-level dispatch + the error-sentinel/cascade machinery
are in place. Declarations/statements/expressions stubbed to follow.

| #     | Task                                                                                          | File |
| ----- | --------------------------------------------------------------------------------------------- | ---- |
| 2.1   | Write spec tests first: ST-P4 (cursor), ST-P5..P8 (module/import), plus a smoke `parse()` export check | `packages/frontend/src/parser/cursor.impl.test.ts`, `parser.spec.test.ts` |
| 2.2   | Verify red                                                                                     | — |
| 2.3   | Create `parser/cursor.ts` (peek/advance/check/expect/atEnd + panic state)                     | `packages/frontend/src/parser/cursor.ts` |
| 2.4   | Create `parser/parser.ts`: `parse()`, parser state, module-decl (E10001/E10002), import, top-level dispatch (E10310; KwType→E10224), the `emit`/panic helper + sentinel insertion + sync skeleton | `packages/frontend/src/parser/parser.ts` |
| 2.5   | Create `parser/index.ts`; wire `export * from "./parser/index.js";` into frontend barrel       | `packages/frontend/src/parser/index.ts`, `packages/frontend/src/index.ts` |
| 2.6   | Verify green                                                                                   | — |
| 2.7   | Run verify. **Phase gate:** green; R15 tier green; spec untouched                             | — |

---

## Phase 3 — Declarations

**Reference**: [03-02](03-02-parser-algorithm.md) §dispatch, [01](01-requirements.md) FR-16..23.
**Goal:** function/interrupt/struct/enum/let/const/zeropage + `export` rules + `type`→E10224.

| #     | Task                                                                                       | File |
| ----- | ------------------------------------------------------------------------------------------ | ---- |
| 3.1   | Write spec/impl tests first: ST-P14..P19, ST-P28 (`type`)                                  | `packages/frontend/src/parser/parser.impl.test.ts` |
| 3.2   | Verify red                                                                                  | — |
| 3.3   | Implement `parseFunctionDecl`, `parseParameter`, `parseInterruptDecl`, `parseStructDecl`/field, `parseEnumDecl`/member, `parseLetDecl`/`parseConstDecl`, `parseZeropageBlock`/field, `parseExportedDecl` (E10311), `parseType` | `packages/frontend/src/parser/parser.ts` (split to `parse-decl.ts`/`parse-type.ts` if >500 lines) |
| 3.4   | Emit E10303/E10311/E10314/E10315/E10316 + E10224 per [03-03](03-03-error-recovery.md)      | — |
| 3.5   | Verify green                                                                                | — |
| 3.6   | Run verify. **Phase gate:** green; R15 tier green; spec untouched                          | — |

---

## Phase 4 — Statements

**Reference**: [01](01-requirements.md) FR-24..35. **Goal:** block, if/else, while, do-while,
for (`to`/`downto`/`step`), switch/case/default, return/break/continue/fallthrough, expr-stmt.
(No asm — AR-1.)

| #     | Task                                                                                       | File |
| ----- | ------------------------------------------------------------------------------------------ | ---- |
| 4.1   | Write spec/impl tests first: ST-P20..P22, plus block/jump-stmt cases                       | `packages/frontend/src/parser/parser.impl.test.ts` |
| 4.2   | Verify red                                                                                  | — |
| 4.3   | Implement `parseBlock`, `parseIf` (composed else-if), `parseWhile`, `parseDoWhile` (E10305), `parseFor` (E10309), `parseSwitch`/case/default (E10072), `parseReturn`/`break`/`continue`, `fallthrough`, `parseExpressionStmt`, `parseStatement` dispatch (KwType→E10224) | `packages/frontend/src/parser/parser.ts` (or `parse-stmt.ts`) |
| 4.4   | Verify green                                                                                | — |
| 4.5   | Run verify. **Phase gate:** green; R15 tier green; spec untouched                          | — |

---

## Phase 5 — Expressions (Pratt) + intrinsics + struct literals

**Reference**: [03-02](03-02-parser-algorithm.md) §Pratt, [01](01-requirements.md) FR-37..46.
**Goal:** 14-level Pratt, right-assoc assignment/ternary, unary/cast, postfix `. [] ()`,
primaries, intrinsics (AR-3), struct-literal disambiguation, type expressions.

| #     | Task                                                                                       | File |
| ----- | ------------------------------------------------------------------------------------------ | ---- |
| 5.1   | Write spec/impl tests first: ST-P10..P13 (precedence/assoc/prefix), ST-P29 (intrinsics), ST-P33 (struct-lit vs block) | `packages/frontend/src/parser/pratt.impl.test.ts`, `parser.impl.test.ts` |
| 5.2   | Verify red                                                                                  | — |
| 5.3   | Implement `parser/pratt.ts`: binding-power tables, `parseExpression(minBP)`, `parsePrefix` (primaries, unary, cast), `parsePostfix` (field/index/call/intrinsic via `RESERVED_BUILTINS`), assignment/ternary/binary builders | `packages/frontend/src/parser/pratt.ts` |
| 5.4   | Implement struct-literal context flag (FR-45), `embed(...)`, numeric/bool/string/char/ident primaries | `packages/frontend/src/parser/pratt.ts` |
| 5.5   | Verify green                                                                                | — |
| 5.6   | Run verify. **Phase gate:** green; R15 tier green; spec untouched                          | — |

---

## Phase 6 — Recovery, golden snapshots, fuzz, acceptance & closeout

**Reference**: [03-03](03-03-error-recovery.md), [07](07-testing-strategy.md). **Goal:** pin
recovery/cascade end-to-end; golden AST snapshots; no-throw fuzz + determinism + performance;
walk all ACs; mark plan complete.

| #     | Task                                                                                       | File |
| ----- | ------------------------------------------------------------------------------------------ | ---- |
| 6.1   | Write spec tests: ST-P23..P27 (sentinels + recovery + cascade), ST-P30..P35 (golden, span, fuzz, perf) | `packages/frontend/src/parser/parser.impl.test.ts`, `parser.spec.test.ts` |
| 6.2   | Verify red where applicable; implement any remaining recovery wiring; generate + **review** golden `.snap` against spec | `packages/frontend/src/parser/__snapshots__/*` |
| 6.3   | Verify green                                                                                | — |
| 6.4   | Walk AC-01..AC-19 ([01 §AC](01-requirements.md)); tick each. Tick FR-1..FR-49. Set Index status → "Implemented" | `01-requirements.md`, `00-index.md` |
| 6.5   | Confirm `git status --porcelain spec/` empty (D3) and R15 boundary green (ST-R15a/b/c)      | — |
| 6.6   | Final verify run; record result here. **STOP** — hand off to the user for commit (`--no-commit`) | — |

---

## 🚨 Master Progress Checklist (All Phases) — MANDATORY

> **⚠️ EXECUTION RULE — APPLIES TO EVERY AGENT EXECUTING THIS PLAN:**
>
> 1. **After completing each task:** mark it `[x]` with a timestamp — e.g.
>    `- [x] 1.1 … ✅ (completed: YYYY-MM-DD HH:MM)`.
> 2. **After completing each phase:** confirm every task in that phase is `[x]`.
> 3. **Update the Progress header** (`> **Progress**: X/Y …`) after every update.
> 4. **This checklist MUST exist** — reconstruct it from the phase tables if missing.
> 5. **Never batch updates** — update immediately after each task.

### Phase 1 — AST catalogue & parser codes (core) + req fix
- [ ] 1.1 Spec tests first (ST-P1, P2, P2b, P3)
- [ ] 1.2 Verify red
- [ ] 1.3 Create `ast/` module (node-kind, nodes, visitor, walk, reserved-builtins, index)
- [ ] 1.4 Wire core barrel
- [ ] 1.5 Add E10072 + E10300–E10316 to `DiagCode`
- [ ] 1.6 Edit `requirements/RD-03-parser-ast.md` (remove asm — AR-1)
- [ ] 1.7 Verify green
- [ ] 1.8 Run verify (phase gate)

### Phase 2 — Parser skeleton + source structure
- [ ] 2.1 Spec tests first (ST-P4, P5–P8, smoke)
- [ ] 2.2 Verify red
- [ ] 2.3 Create `parser/cursor.ts`
- [ ] 2.4 Create `parser/parser.ts` (parse, module/import, dispatch, emit/panic/sync)
- [ ] 2.5 Create `parser/index.ts` + wire frontend barrel
- [ ] 2.6 Verify green
- [ ] 2.7 Run verify (phase gate)

### Phase 3 — Declarations
- [ ] 3.1 Spec/impl tests first (ST-P14–P19, P28)
- [ ] 3.2 Verify red
- [ ] 3.3 Implement declaration + type parse functions
- [ ] 3.4 Emit E10303/E10311/E10314/E10315/E10316 + E10224
- [ ] 3.5 Verify green
- [ ] 3.6 Run verify (phase gate)

### Phase 4 — Statements
- [ ] 4.1 Spec/impl tests first (ST-P20–P22 + block/jump)
- [ ] 4.2 Verify red
- [ ] 4.3 Implement statement parse functions (+ E10305/E10309/E10072)
- [ ] 4.4 Verify green
- [ ] 4.5 Run verify (phase gate)

### Phase 5 — Expressions (Pratt) + intrinsics + struct literals
- [ ] 5.1 Spec/impl tests first (ST-P10–P13, P29, P33)
- [ ] 5.2 Verify red
- [ ] 5.3 Implement `pratt.ts` (BP tables, prefix/infix/postfix, intrinsics)
- [ ] 5.4 Struct-literal context flag, embed, primaries
- [ ] 5.5 Verify green
- [ ] 5.6 Run verify (phase gate)

### Phase 6 — Recovery, golden, fuzz, acceptance & closeout
- [ ] 6.1 Spec tests (ST-P23–P27, P30–P35)
- [ ] 6.2 Implement remaining recovery; generate + review golden `.snap`
- [ ] 6.3 Verify green
- [ ] 6.4 Tick AC-01..AC-19 + FR-1..FR-49; Index → "Implemented"
- [ ] 6.5 Confirm spec untouched + R15 green
- [ ] 6.6 Final verify; STOP for user commit

---

## Dependencies

```
Phase 1 (core AST + codes)
    ↓
Phase 2 (parse skeleton)
    ↓
Phase 3 (declarations) → Phase 4 (statements) → Phase 5 (expressions)
    ↓
Phase 6 (recovery, golden, acceptance)
```

## Success Criteria

**Feature is complete when:**

1. ✅ All 6 phases completed.
2. ✅ All verification passing (`yarn install --frozen-lockfile && build && typecheck && lint && test`).
3. ✅ No warnings/errors.
4. ✅ No dead code — no unused parameters, functions, classes, or modules (code.md rule 4).
5. ✅ Security N/A (offline compiler component — no input/auth/network surface).
6. ✅ FR-1..FR-49 + AC-01..AC-19 ticked; `requirements/RD-03-parser-ast.md` corrected (asm removed).
7. ✅ `git status --porcelain spec/` empty (D3); R15 boundary green (ST-R15a/b/c).
8. ✅ **Post-completion:** ask the user to re-analyse the project and update `.clinerules/project.md`.

## Notes

- **Frozen baselines:** `spec/` is read-only (D3); RD-11a/RD-02 code is extended-not-refactored
  (AR-Q2) — only `diagnostic-codes.ts` is edited, by addition. `git status --porcelain spec/`
  must stay empty.
- **R15/AR-20 (load-bearing):** `@blend65/frontend` imports `@blend65/core` only; never
  `@blend65/codegen`. The root boundary tier guards this every phase.
- **Spec-tests-first:** each phase writes failing tests before implementation (testing.md Rule 10).
- **No git ops:** `--no-commit` — the agent stops at Phase 6.6 for the user's commit.
- **Coding standards (code.md):** no `private` (use `protected`); 2-space indent; ESM `.js`
  relative imports; kebab-case filenames; `*.impl.test.ts` for logic, `*.spec.test.ts` for
  behavioral/spec tiers. Split any file approaching 500 lines.
- **Runtime ambiguities:** if one surfaces, STOP, log it as the next `AR-N` (runtime) in
  `00-ambiguity-register.md`, resolve with the user, back-propagate, resume.
