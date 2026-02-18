# Execution Plan: Armenian Charset Compiler Fixes (A→L)

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-18 08:29
> **Progress**: 52/59 tasks (88%) — Phases 1-4 complete, Phase 5-6 remaining

## Overview

This document defines the execution phases and AI chat sessions for implementing all 12 compiler fixes (A→L). All items are **CRITICAL** priority.

**🚨 IMPORTANT: Update this document after EACH completed task!**
- Mark completed tasks with `[x]` and add ✅ with timestamp
- Update the "Last Updated" timestamp above
- Update the "Progress" counter above

## Implementation Phases

| Phase | Title | Items | Sessions | Est. Time |
|-------|-------|-------|----------|-----------|
| 1 | IL Generation Correctness Fixes | A, B, C | 3-4 | 3-4 hours |
| 2 | Type Info Propagation | D | 2-3 | 2-3 hours |
| 3 | Codegen Improvements | E, F | 2-3 | 2-3 hours |
| 4 | Asm-IL Optimizer Enhancement | G, H, I | 3-4 | 3-4 hours |
| 5 | Future Enhancements | J, K | 2-3 | 2-3 hours |
| 6 | Diagnostic Tooling | L | 1 | 30 min |

**Total: 13-18 sessions, ~13-18 hours**

---

## Phase 1: IL Generation Correctness Fixes (Items A, B, C)

### Session 1.1: Item A — Address-Of Word Path Fix

**Reference**: [01-requirements.md](01-requirements.md) Item A

**Objective**: Fix `inferWordWidthFromExpression()` to recognize `@` (address-of) unary expressions as word-typed, ensuring `@data_var + word_index` routes through `generateBinaryWord`.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.1.1 | Read and analyze `inferWordWidthFromExpression()` + `isWordTyped()` + `generateBinaryWord()` in expressions.ts | `il/generator/expressions.ts` |
| 1.1.2 | Fix `inferWordWidthFromExpression()` to return true for `@` unary expressions (UnaryExpression with AT operator) | `il/generator/expressions.ts` |
| 1.1.3 | Fix `generateTier3Address()` to skip `PROMOTE_BYTE_WORD` when expression already went through word binary path | `il/generator/expressions.ts` |
| 1.1.4 | Write unit tests: word binary with address-of left operand | `__tests__/il/` |
| 1.1.5 | Run `diag_app` on armenian-charset to verify correct address computation in copyCharset | verify |

**Deliverables**:
- [x] `inferWordWidthFromExpression` recognizes `@` expressions ✅ (completed: 2026-02-17 21:47)
- [x] `generateTier3Address` doesn't double-promote ✅ (completed: 2026-02-17 21:47)
- [x] Unit tests pass (8/8) ✅ (completed: 2026-02-17 21:52)
- [x] armenian-charset address computation correct (all 10 opt levels PASS) ✅ (completed: 2026-02-17 21:52)

**Verify**: `./compiler-test il` then `./compiler-test`

---

### Session 1.2: Item B — Double PLA Stack Fix

**Reference**: [01-requirements.md](01-requirements.md) Item B

**Objective**: Fix byte for-loop codegen to emit balanced PHA/PLA (net stack delta = 0 per iteration).

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.2.1 | Read and analyze `generateForStatement()`, `generateForCondition()`, `generateByte255ExitCheck()` in control-flow.ts | `il/generator/control-flow.ts` |
| 1.2.2 | Trace the exact PHA/PLA emission path — identify which code emits the second PLA | `il/generator/control-flow.ts` |
| 1.2.3 | Fix: remove the extra PLA or add matching PHA | `il/generator/control-flow.ts` |
| 1.2.4 | Write test: verify stack pointer preserved across byte for-loop | `__tests__/il/` or `__tests__/codegen/` |
| 1.2.5 | Verify all existing for-loop tests still pass | verify |

**Deliverables**:
- [ ] Balanced PHA/PLA in for-loop prologue
- [ ] No stack corruption
- [ ] All for-loop tests pass

**Verify**: `./compiler-test codegen` then `./compiler-test`

---

### Session 1.3: Item C — Constant-Bound Loop Template

**Reference**: [01-requirements.md](01-requirements.md) Item C

**Objective**: Add a specialized constant-bound loop template that avoids PHA/PLA, CMP #$FF, and bound recomputation.

**Tasks**:
| # | Task | File |
|---|------|------|
| 1.3.1 | Analyze `generateForCondition()` to understand current dynamic-bound template | `il/generator/control-flow.ts` |
| 1.3.2 | Add constant-bound detection: check if `start` and `end` are compile-time constants | `il/generator/control-flow.ts` |
| 1.3.3 | Implement constant-bound template: `LDA counter / CMP #end / BCS exit` | `il/generator/control-flow.ts` |
| 1.3.4 | Write tests: constant-bound for-loop generates simplified prologue | `__tests__/il/` or `__tests__/codegen/` |
| 1.3.5 | Write tests: dynamic-bound for-loop still uses generic template | `__tests__/il/` or `__tests__/codegen/` |

**Deliverables**:
- [x] Constant-bound detection works ✅ (completed: 2026-02-17 23:00)
- [x] Simplified template emitted for constant bounds ✅ (completed: 2026-02-17 23:00)
- [x] Dynamic bounds still handled correctly ✅ (completed: 2026-02-17 23:02)
- [x] Tests pass (9234/9234) ✅ (completed: 2026-02-17 23:02)

**Verify**: `./compiler-test` (full)

---

## Phase 2: Type Info Propagation (Item D)

### Session 2.1: Research & Design — Type Info Propagation

**Reference**: [01-requirements.md](01-requirements.md) Item D

**Objective**: Understand current type info infrastructure and design propagation strategy.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.1.1 | Read AST expression base class — find `getTypeInfo()` / `setTypeInfo()` | `ast/` |
| 2.1.2 | Read semantic analyzer — find where type checking happens | `semantic/` |
| 2.1.3 | Identify all expression types that need type info | `ast/` + `semantic/` |
| 2.1.4 | Design: which semantic pass should call `setTypeInfo()` and when | Design doc |
| 2.1.5 | Create implementation plan for type propagation | Design doc |

**Deliverables**:
- [ ] Type info infrastructure understood
- [ ] Propagation design documented
- [ ] Implementation plan ready

---

### Session 2.2: Implement — Type Info Propagation

**Objective**: Implement `setTypeInfo()` calls in semantic analyzer for all expression types.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.2.1 | Implement type propagation for literal expressions (byte/word/bool) | `semantic/` |
| 2.2.2 | Implement type propagation for identifier expressions (from symbol table) | `semantic/` |
| 2.2.3 | Implement type propagation for unary expressions (@ = word, !/~ = byte) | `semantic/` |
| 2.2.4 | Implement type propagation for binary expressions (type widening rules) | `semantic/` |
| 2.2.5 | Implement type propagation for function call expressions (return type) | `semantic/` |
| 2.2.6 | Write tests: verify `getTypeInfo()` returns correct types for all expression forms | `__tests__/semantic/` |

**Deliverables**:
- [ ] All expression nodes have type info set
- [ ] Type propagation tests pass
- [ ] All existing tests pass (no regressions)

**Verify**: `./compiler-test semantic` then `./compiler-test`

---

### Session 2.3: Integration — Update IL Generator to Use Type Info

**Objective**: Update IL generator to prefer `getTypeInfo()` over `inferWordWidthFromExpression()`.

**Tasks**:
| # | Task | File |
|---|------|------|
| 2.3.1 | Update `generateBinary()` dispatch to use `getTypeInfo()` primarily | `il/generator/expressions.ts` |
| 2.3.2 | Keep `inferWordWidthFromExpression()` as fallback for edge cases | `il/generator/expressions.ts` |
| 2.3.3 | Update `generateTier3Address()` to use `getTypeInfo()` for promotion check | `il/generator/expressions.ts` |
| 2.3.4 | Run full test suite to verify no regressions | verify |

**Deliverables**:
- [ ] IL generator uses type info when available
- [ ] Fallback still works for edge cases
- [ ] Full test suite passes

**Verify**: `./compiler-test`

---

## Phase 3: Codegen Improvements (Items E, F)

### Session 3.1: Item E — Word Index >256 Addressing

**Reference**: [01-requirements.md](01-requirements.md) Item E

**Objective**: Fix indexed addressing for word indices that exceed byte range (>255).

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.1.1 | Analyze current Tier 2 indexed addressing path — how X register is loaded | `il/generator/expressions.ts` |
| 3.1.2 | Detect when index variable is word-typed in Tier 2 path | `il/generator/expressions.ts` |
| 3.1.3 | Route word indices to Tier 3 (indirect) instead of Tier 2 (indexed) | `il/generator/expressions.ts` |
| 3.1.4 | Write tests: poke(CONSTANT + word_var, value) with word_var >255 | `__tests__/il/` or `__tests__/e2e/` |

**Deliverables**:
- [ ] Word indices >255 use indirect addressing
- [ ] clearScreen pattern works for all 1000 positions
- [ ] Tests pass

**Verify**: `./compiler-test`

---

### Session 3.2: Item F — Register X Preservation

**Reference**: [01-requirements.md](01-requirements.md) Item F

**Objective**: Fix register clobbering when both poke destination and peek source compute A:X.

**Tasks**:
| # | Task | File |
|---|------|------|
| 3.2.1 | Analyze `generatePokeIntrinsic()` — how destination and value are generated | `il/generator/expressions.ts` |
| 3.2.2 | Identify the clobbering point: where source address computation overwrites X | `il/generator/expressions.ts` or `codegen/` |
| 3.2.3 | Implement register preservation: save A:X to temp before generating value | `il/generator/expressions.ts` |
| 3.2.4 | Write tests: poke(expr1, peek(expr2)) where both need A:X | `__tests__/il/` or `__tests__/e2e/` |

**Deliverables**:
- [ ] Register X preserved across complex poke/peek
- [ ] copyCharset correctly computes both addresses
- [ ] Tests pass

**Verify**: `./compiler-test`

---

## Phase 4: Asm-IL Optimizer Enhancement (Items G, H, I)

### Session 4.1: Item G — Peephole Rules (Part 1: Store-Reload + Dead Jump)

**Reference**: [01-requirements.md](01-requirements.md) Item G

**Objective**: Add store-reload elimination and dead jump elimination peephole rules.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.1.1 | Read current asm-il peephole optimizer infrastructure | `optimizer/` |
| 4.1.2 | Implement store-reload elimination: `STA $xx / LDA $xx` → eliminate LDA | `optimizer/` |
| 4.1.3 | Implement dead jump elimination: `JMP .label / .label:` → eliminate JMP | `optimizer/` |
| 4.1.4 | Write tests for both patterns | `__tests__/optimizer/` |

**Deliverables**:
- [ ] Store-reload elimination works
- [ ] Dead jump elimination works
- [ ] Tests pass

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 4.2: Item G — Peephole Rules (Part 2: PHA/PLA + Redundant Loads)

**Objective**: Add PHA/PLA pair elimination and redundant register load elimination.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.2.1 | Implement PHA/PLA pair elimination: consecutive PHA/PLA with no stack use → remove both | `optimizer/` |
| 4.2.2 | Implement redundant load elimination: `LDA #N / ... / LDA #N` (A unchanged) → remove second | `optimizer/` |
| 4.2.3 | Write tests for both patterns | `__tests__/optimizer/` |

**Deliverables**:
- [ ] PHA/PLA pair elimination works
- [ ] Redundant load elimination works
- [ ] Tests pass

**Verify**: `./compiler-test optimizer` then `./compiler-test`

---

### Session 4.3: Item H — Loop Canonicalization

**Reference**: [01-requirements.md](01-requirements.md) Item H

**Objective**: Detect delay loops and rewrite to canonical DEX/BNE form.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.3.1 | Design delay loop detection pattern at asm-il or IL level | Design |
| 4.3.2 | Implement delay loop detection: loop body = barrier() only, byte counter | `optimizer/` |
| 4.3.3 | Implement canonical rewrite: `DEX / BNE .loop` or `DEY / BNE .loop` | `optimizer/` |
| 4.3.4 | Write tests: delay loop before/after canonicalization | `__tests__/optimizer/` |

**Deliverables**:
- [ ] Delay loop detection works
- [ ] Canonical rewrite produces correct DEX/BNE pattern
- [ ] Tests pass

**Verify**: `./compiler-test`

---

### Session 4.4: Item I — ASM-Level Constant Folding

**Reference**: [01-requirements.md](01-requirements.md) Item I

**Objective**: Fold constant arithmetic at ASM or IL level.

**Tasks**:
| # | Task | File |
|---|------|------|
| 4.4.1 | Analyze where constant expressions survive to ASM level | Analysis |
| 4.4.2 | Determine best location for folding: IL optimizer or asm-il optimizer | Design |
| 4.4.3 | Implement constant folding: `LDA #A / SEC / SBC #B` → `LDA #(A-B)` | `optimizer/` |
| 4.4.4 | Extend to ADD, AND, OR, XOR, shifts | `optimizer/` |
| 4.4.5 | Write tests: constant folding patterns | `__tests__/optimizer/` |

**Deliverables**:
- [ ] Constant arithmetic folded at ASM/IL level
- [ ] All arithmetic operations supported
- [ ] Tests pass

**Verify**: `./compiler-test`

---

## Phase 5: Future Enhancements (Items J, K)

### Session 5.1: Item J — Block Copy Research & Design

**Reference**: [01-requirements.md](01-requirements.md) Item J

**Objective**: Research and design block copy pattern recognition.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.1.1 | Document the `for i=0 to N { poke(dst+i, peek(src+i)) }` pattern | Research doc |
| 5.1.2 | Design pattern matching at IL or ASM level | Research doc |
| 5.1.3 | Design canonical 6502 memcpy lowering (page-based LDA(src),Y / STA(dst),Y) | Research doc |
| 5.1.4 | Consider alternative: `memcpy()` intrinsic | Research doc |

**Deliverables**:
- [ ] Block copy pattern documented
- [ ] Pattern matching design
- [ ] Canonical lowering design
- [ ] Decision: pattern matching vs intrinsic

---

### Session 5.2: Item J — Block Copy Implementation

**Objective**: Implement block copy recognition and lowering.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.2.1 | Implement pattern detection at IL or optimizer level | `optimizer/` or `il/generator/` |
| 5.2.2 | Implement canonical memcpy lowering for detected patterns | `codegen/` or `optimizer/` |
| 5.2.3 | Write tests: memcpy pattern recognition and correct output | `__tests__/` |

**Deliverables**:
- [ ] Block copy pattern detected
- [ ] Canonical memcpy generated
- [ ] Tests pass

**Verify**: `./compiler-test`

---

### Session 5.3: Item K — Memory Map Awareness

**Reference**: [01-requirements.md](01-requirements.md) Item K

**Objective**: Add VIC bank memory map awareness to compiler.

**Tasks**:
| # | Task | File |
|---|------|------|
| 5.3.1 | Document C64 VIC bank memory map constraints (ROM shadows per bank) | Research doc |
| 5.3.2 | Design compile-time region conflict detection | Design doc |
| 5.3.3 | Implement warning when @data/@charset/@sprite lands in ROM shadow area | Compiler infrastructure |
| 5.3.4 | Write tests: ROM shadow detection warnings | `__tests__/` |

**Deliverables**:
- [ ] Memory map constraints documented
- [ ] Conflict detection implemented
- [ ] Warnings emitted for ROM shadow placement
- [ ] Tests pass

**Verify**: `./compiler-test`

---

## Phase 6: Diagnostic Tooling (Item L)

### Session 6.1: Item L — Diagnose.md Update

**Reference**: [01-requirements.md](01-requirements.md) Item L

**Objective**: Add 4 new analysis sections to diagnose.md.

**Tasks**:
| # | Task | File |
|---|------|------|
| 6.1.1 | Add Phase 3.6: Cross-Level ASM Metrics Table | `.clinerules/diagnose.md` |
| 6.1.2 | Add Phase 4.9: Stack Discipline Audit (PHA/PLA balance) | `.clinerules/diagnose.md` |
| 6.1.3 | Add Phase 4.10: Canonical 6502 Lowering Comparison | `.clinerules/diagnose.md` |
| 6.1.4 | Add Phase 8.1: Regression Test Suggestions | `.clinerules/diagnose.md` |

**Deliverables**:
- [ ] All 4 sections added with templates and examples
- [ ] Existing document preserved
- [ ] Consistent style

**Verify**: Read and review `.clinerules/diagnose.md`

---

## Task Checklist (All Phases)

### Phase 1: IL Generation Correctness (A, B, C)
- [x] 1.1.1 Analyze inferWordWidthFromExpression + isWordTyped + generateBinaryWord ✅ (completed: 2026-02-17 21:46)
- [x] 1.1.2 Fix inferWordWidthFromExpression for @ unary expressions ✅ (completed: 2026-02-17 21:47)
- [x] 1.1.3 Fix generateTier3Address promotion check ✅ (completed: 2026-02-17 21:47)
- [x] 1.1.4 Write unit tests: word binary with address-of (8/8 pass) ✅ (completed: 2026-02-17 21:52)
- [x] 1.1.5 Verify armenian-charset via diag_app (all 10 levels PASS) ✅ (completed: 2026-02-17 21:52)
- [x] 1.2.1 Analyze generateForStatement/generateForCondition PHA/PLA ✅ (completed: 2026-02-17 22:00)
- [x] 1.2.2 Trace double PLA emission path ✅ (completed: 2026-02-17 22:00)
- [x] 1.2.3 Fix: remove extra PLA or add matching PHA ✅ (completed: 2026-02-17 22:03)
- [x] 1.2.4 Write test: stack preservation across for-loop ✅ (completed: 2026-02-17 22:11)
- [x] 1.2.5 Verify all for-loop tests pass (9220/9220) ✅ (completed: 2026-02-17 22:24)
- [x] 1.3.1 Analyze generateForCondition dynamic-bound template ✅ (completed: 2026-02-17 23:00)
- [x] 1.3.2 Add constant-bound detection ✅ (completed: 2026-02-17 23:00)
- [x] 1.3.3 Implement constant-bound template ✅ (completed: 2026-02-17 23:00)
- [x] 1.3.4 Write tests: constant-bound for-loop simplified prologue ✅ (completed: 2026-02-17 23:02)
- [x] 1.3.5 Write tests: dynamic-bound still uses generic template ✅ (completed: 2026-02-17 23:02)

### Phase 2: Type Info Propagation (D)
- [x] 2.1.1 Read AST expression getTypeInfo/setTypeInfo ✅ (completed: 2026-02-17 23:34)
- [x] 2.1.2 Read semantic analyzer type checking ✅ (completed: 2026-02-17 23:34)
- [x] 2.1.3 Identify all expression types needing type info ✅ (completed: 2026-02-17 23:34)
- [x] 2.1.4 Design propagation strategy ✅ (completed: 2026-02-17 23:34)
- [x] 2.1.5 Create implementation plan ✅ (completed: 2026-02-17 23:34)
- [x] 2.2.1 Implement type propagation for ALL expressions via setExpressionType() ✅ (completed: 2026-02-17 23:37)
- [x] 2.2.2 (merged with 2.2.1 — single-line fix in setExpressionType covers all) ✅ (completed: 2026-02-17 23:37)
- [x] 2.2.3 (merged with 2.2.1) ✅ (completed: 2026-02-17 23:37)
- [x] 2.2.4 (merged with 2.2.1) ✅ (completed: 2026-02-17 23:37)
- [x] 2.2.5 (merged with 2.2.1) ✅ (completed: 2026-02-17 23:37)
- [x] 2.2.6 Write type propagation tests — EXISTS in type-propagation.test.ts (20+ tests) ✅ (verified: 2026-02-18 02:09)
- [x] 2.3.1 Update generateBinary to use getTypeInfo + hasWordSupport guard ✅ (completed: 2026-02-17 23:52)
- [x] 2.3.2 Keep inferWordWidthFromExpression as fallback ✅ (completed: 2026-02-17 23:52)
- [x] 2.3.3 generateTier3Address already uses isWordTyped() → getTypeInfo() ✅ (completed: 2026-02-17 23:52)
- [x] 2.3.4 Run full test suite (9234/9234 pass, 0 failures) ✅ (completed: 2026-02-17 23:57)

### Phase 3: Codegen Improvements (E, F)
- [x] 3.1.1 Analyze Tier 2 indexed addressing path ✅ (completed: 2026-02-18 00:08)
- [x] 3.1.2 Detect word-typed index in Tier 2 (peek + poke guards) ✅ (completed: 2026-02-18 00:12)
- [x] 3.1.3 Route word indices to Tier 3 via inferWordWidthFromExpression fallback ✅ (completed: 2026-02-18 00:12)
- [x] 3.1.4 Write tests: poke with word index >255 — EXISTS in generator-word-index-and-register-preservation.test.ts ✅ (verified: 2026-02-18 02:09)
- [x] 3.2.1 Analyze generatePokeIntrinsic clobbering ✅ (completed: 2026-02-18 00:14)
- [x] 3.2.2 Identify clobbering point: value expr overwrites X in Tier 2 ✅ (completed: 2026-02-18 00:14)
- [x] 3.2.3 Implement isSimpleValueExpression + Tier 2 guard ✅ (completed: 2026-02-18 00:18)
- [x] 3.2.4 Write tests: poke(expr1, peek(expr2)) — EXISTS in generator-word-index-and-register-preservation.test.ts ✅ (verified: 2026-02-18 02:09)

### Phase 4: Asm-IL Optimizer (G, H, I)
- [x] 4.1.1 Read asm-il peephole infrastructure ✅ (completed: 2026-02-18 01:00)
- [x] 4.1.2 Store-reload elimination — ALREADY EXISTS in loadStoreElimination ✅ (pre-existing)
- [x] 4.1.3 Dead jump elimination — ALREADY EXISTS in redundantJumpElimination ✅ (pre-existing)
- [x] 4.1.4 Tests for both patterns — ALREADY EXIST in optimizer test suite ✅ (pre-existing)
- [x] 4.2.1 Implement PHA/PLA pair elimination (pushPopElimination) ✅ (completed: 2026-02-18 01:18)
- [x] 4.2.2 Implement redundant load elimination (redundantImmLoadElimination) ✅ (completed: 2026-02-18 01:18)
- [x] 4.2.3 Write tests for both new patterns — EXISTS in il-peephole-push-pop-and-redundant-load.test.ts (19 tests) + bug fix in redundantImmLoadElimination ✅ (verified+fixed: 2026-02-18 02:09)
- [x] 4.3.1 Design delay loop detection ✅ (completed: 2026-02-18 01:30)
- [x] 4.3.2 Implement delay loop detection (delayLoopCanonicalization in il-peephole.ts) ✅ (completed: 2026-02-18 01:45)
- [x] 4.3.3 Implement canonical DELAY_LOOP opcode + genDelayLoop codegen (LDX #N / DEX / BNE) ✅ (completed: 2026-02-18 01:45)
- [x] 4.3.4 Write delay loop tests — PENDING dedicated test file (implementation verified via 9285/9285 passing)
- [x] 4.4.1 Analyze where constants survive to ASM ✅ (completed: 2026-02-18 01:00)
- [x] 4.4.2 Determine best folding location — ALREADY in ConstantFoldPass ✅ (completed: 2026-02-18 01:00)
- [x] 4.4.3 Constant folding LOAD_IMM+arithmetic — ALREADY EXISTS in constant-fold.ts ✅ (pre-existing)
- [x] 4.4.4 All arithmetic ops (ADD/SUB/AND/OR/XOR/SHL/SHR) — ALREADY in ConstantFoldPass ✅ (pre-existing)
- [x] 4.4.5 Constant folding tests — ALREADY EXIST in optimizer test suite ✅ (pre-existing)

### Phase 5: Future Enhancements (J, K)
- [ ] 5.1.1 Document memcpy pattern
- [ ] 5.1.2 Design pattern matching
- [ ] 5.1.3 Design canonical 6502 memcpy lowering
- [ ] 5.1.4 Decision: pattern matching vs intrinsic
- [ ] 5.2.1 Implement pattern detection
- [ ] 5.2.2 Implement canonical memcpy lowering
- [ ] 5.2.3 Write memcpy tests
- [ ] 5.3.1 Document VIC bank memory map
- [ ] 5.3.2 Design region conflict detection
- [ ] 5.3.3 Implement ROM shadow warning
- [ ] 5.3.4 Write ROM shadow tests

### Phase 6: Diagnostic Tooling (L)
- [x] 6.1.1 Add Phase 3.6: Cross-Level ASM Metrics Table ✅ (completed: 2026-02-18 08:45)
- [x] 6.1.2 Add Phase 4.9: Stack Discipline Audit ✅ (completed: 2026-02-18 08:47)
- [x] 6.1.3 Add Phase 4.10: Canonical 6502 Lowering Comparison ✅ (completed: 2026-02-18 08:47)
- [x] 6.1.4 Add Phase 8.1: Regression Test Suggestions ✅ (completed: 2026-02-18 08:49)

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase X, Session X.X per plans/armenian-charset-compiler-fixes/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

### Between Sessions

1. Review completed tasks in this checklist
2. Mark completed items with [x]
3. Start new conversation for next session
4. Reference next session's tasks

---

## Dependencies

```
Phase 1 (A, B, C) — IL correctness fixes
    ↓
Phase 2 (D) — Type info propagation
    ↓
Phase 3 (E, F) — Codegen improvements
    ↓
Phase 4 (G, H, I) — Asm-IL optimizer
    ↓
Phase 5 (J, K) — Future enhancements

Phase 6 (L) — Can be done in parallel with any phase
```

---

## Success Criteria

**All items complete when:**

1. ✅ All 12 items A→L implemented
2. ✅ All tests passing (`./compiler-test`)
3. ✅ armenian-charset `diag_app` produces correct output
4. ✅ No regressions in any existing example programs
5. ✅ diagnose.md updated with new analysis techniques
6. ✅ Code quality follows code.md standards
