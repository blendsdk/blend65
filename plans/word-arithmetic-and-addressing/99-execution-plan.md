# Execution Plan: Word Arithmetic & Indirect Addressing

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)
> **Last Updated**: 2026-02-11 09:30
> **Progress**: 0/28 tasks (0%)

## Overview

**🚨 IMPORTANT: Update this document after EACH completed task!**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Word Arithmetic IL Opcodes | 2 | 60 min |
| 2 | Word Arithmetic Codegen | 2 | 60 min |
| 3 | Type-Aware Expression Generation | 2-3 | 90 min |
| 4 | Constant Folding + Address Decomposer | 1-2 | 45 min |
| 5 | Indirect Addressing IL + Codegen | 1-2 | 45 min |
| 6 | 3-Tier Intrinsic Refactor | 2-3 | 90 min |
| 7 | Word Comparisons + Increment | 1-2 | 45 min |
| 8 | Word Function Support | 1-2 | 45 min |
| 9 | Integration + E2E Testing | 2 | 60 min |
| 10 | Optimizer + Regression | 1 | 30 min |

**Total: ~14-20 sessions, ~8-10 hours**

---

## Phase 1: Word Arithmetic IL Opcodes

**Reference**: [03-word-arithmetic-opcodes.md](03-word-arithmetic-opcodes.md)

### Session 1.1: Add Word Arithmetic Enums + Builder Methods

**Objective**: Add all new IL opcodes and builder methods for word arithmetic.

| # | Task | File |
|---|------|------|
| 1.1.1 | Add word arithmetic opcodes to ILOpcode enum (ADD_WORD_IMM, ADD_WORD_BYTE_IMM, ADD_WORD_SLOT, ADD_WORD_BYTE_SLOT, SUB variants, PROMOTE_BYTE_WORD) | `il/enums.ts` |
| 1.1.2 | Add cost estimates for all new opcodes | `il/builder/base.ts` |
| 1.1.3 | Add builder methods: addWordImm(), addWordByteImm(), addWordSlot(), addWordByteSlot(), subWord variants, promoteByteWord() | `il/builder/arithmetic.ts` |
| 1.1.4 | Add unit tests for all new builder methods | `__tests__/il/` |

**Verify**: `./compiler-test il`

### Session 1.2: Add Comparison + Increment Opcodes

| # | Task | File |
|---|------|------|
| 1.2.1 | Add CMP_WORD_IMM, CMP_WORD_SLOT, INC_WORD, DEC_WORD opcodes to enum | `il/enums.ts` |
| 1.2.2 | Add cost estimates for comparison/increment opcodes | `il/builder/base.ts` |
| 1.2.3 | Add builder methods: cmpWordImm(), cmpWordSlot(), incWord(), decWord() | `il/builder/` |
| 1.2.4 | Add unit tests for comparison/increment builder methods | `__tests__/il/` |

**Verify**: `./compiler-test il`

---

## Phase 2: Word Arithmetic Codegen

**Reference**: [03-word-arithmetic-opcodes.md](03-word-arithmetic-opcodes.md)

### Session 2.1: Word Addition/Subtraction Codegen

**Objective**: Generate correct 6502 sequences for word ADD/SUB opcodes.

| # | Task | File |
|---|------|------|
| 2.1.1 | Implement genAddWordByteImm() — CLC/ADC/BCC/INX pattern | `codegen/generator/arithmetic.ts` |
| 2.1.2 | Implement genAddWordImm() — full 16-bit add with PHA/TXA/ADC/TAX/PLA | `codegen/generator/arithmetic.ts` |
| 2.1.3 | Implement genAddWordByteSlot() and genAddWordSlot() | `codegen/generator/arithmetic.ts` |
| 2.1.4 | Implement genSubWord variants (same pattern with SEC/SBC) | `codegen/generator/arithmetic.ts` |
| 2.1.5 | Implement genPromoteByteWord() — LDX #0 | `codegen/generator/memory.ts` |
| 2.1.6 | Add dispatch cases in generateInstruction() | `codegen/generator/arithmetic.ts` |
| 2.1.7 | Add codegen unit tests for all word arithmetic sequences | `__tests__/codegen/` |

**Verify**: `./compiler-test codegen`

### Session 2.2: Word Comparison + Increment Codegen

| # | Task | File |
|---|------|------|
| 2.2.1 | Implement genCmpWordImm() — CPX hi / BNE / CMP lo pattern | `codegen/generator/comparison.ts` |
| 2.2.2 | Implement genCmpWordSlot() | `codegen/generator/comparison.ts` |
| 2.2.3 | Implement genIncWord() — INC lo / BNE / INC hi pattern | `codegen/generator/arithmetic.ts` |
| 2.2.4 | Implement genDecWord() — LDA / BNE / DEC hi / DEC lo pattern | `codegen/generator/arithmetic.ts` |
| 2.2.5 | Add codegen unit tests for comparison/increment | `__tests__/codegen/` |

**Verify**: `./compiler-test codegen`

---

## Phase 3: Type-Aware Expression Generation

**Reference**: [04-type-aware-expressions.md](04-type-aware-expressions.md)

### Session 3.1: Expression Type Dispatch

**Objective**: Make generateBinary() check TypeInfo and dispatch to byte/word paths.

| # | Task | File |
|---|------|------|
| 3.1.1 | Add isWordTyped() helper that checks expr.getTypeInfo() | `il/generator/expressions.ts` |
| 3.1.2 | Modify generateBinary() to dispatch: word → generateBinaryWord(), byte → existing code | `il/generator/expressions.ts` |
| 3.1.3 | Implement generateBinaryWord() for +, - operators (immediate and slot paths) | `il/generator/expressions.ts` |
| 3.1.4 | Fix generateIdentifier() to use LOAD_WORD for word-typed slots | `il/generator/expressions.ts` |

**Verify**: `./compiler-test il`

### Session 3.2: Type Promotion + Mixed-Width Tests

| # | Task | File |
|---|------|------|
| 3.2.1 | Implement byte→word promotion: emit PROMOTE_BYTE_WORD when left is byte, result is word | `il/generator/expressions.ts` |
| 3.2.2 | Handle word assignment: generateVariableDecl checks slot.size for STORE_WORD | `il/generator/generator.ts` |
| 3.2.3 | Add comprehensive tests: byte+word, word+byte, word+word, word+imm | `__tests__/il/` |
| 3.2.4 | Run full test suite, fix any regressions | — |

**Verify**: `./compiler-test`

---

## Phase 4: Constant Folding + Address Decomposer

**Reference**: [05-indirect-addressing.md](05-indirect-addressing.md)

### Session 4.1: Enhanced Constant Folding + Address Decomposer

| # | Task | File |
|---|------|------|
| 4.1.1 | Enhance tryResolveConstantAddress() to handle +, -, *, <<, >>, &, \|, ^ between constants | `il/generator/expressions.ts` |
| 4.1.2 | Implement decomposeAddressExpression() — walks + chains, folds constants, collects variable terms | `il/generator/expressions.ts` |
| 4.1.3 | Add unit tests for constant folding: CONST+CONST, CONST*CONST, nested expressions | `__tests__/il/` |
| 4.1.4 | Add unit tests for address decomposer: pure const, const+var, const+var+var | `__tests__/il/` |

**Verify**: `./compiler-test il`

---

## Phase 5: Indirect Addressing IL + Codegen

**Reference**: [05-indirect-addressing.md](05-indirect-addressing.md)

### Session 5.1: Indirect Addressing Opcodes + Codegen

| # | Task | File |
|---|------|------|
| 5.1.1 | Add STORE_ZP_PTR, POKE_INDIRECT, PEEK_INDIRECT opcodes to enum + costs | `il/enums.ts`, `il/builder/base.ts` |
| 5.1.2 | Add builder methods: storeZpPtr(), pokeIndirect(), peekIndirect() | `il/builder/control.ts` |
| 5.1.3 | Implement codegen: STORE_ZP_PTR → STA $FB / STX $FC | `codegen/generator/intrinsics.ts` |
| 5.1.4 | Implement codegen: POKE_INDIRECT → LDY #0 / STA ($FB),Y | `codegen/generator/intrinsics.ts` |
| 5.1.5 | Implement codegen: PEEK_INDIRECT → LDY #0 / LDA ($FB),Y | `codegen/generator/intrinsics.ts` |
| 5.1.6 | Add unit tests for indirect addressing codegen | `__tests__/codegen/` |

**Verify**: `./compiler-test il codegen`

---

## Phase 6: 3-Tier Intrinsic Refactor

**Reference**: [05-indirect-addressing.md](05-indirect-addressing.md)

### Session 6.1: Refactor poke() and peek() to 3-Tier

| # | Task | File |
|---|------|------|
| 6.1.1 | Refactor generatePokeIntrinsic() with 3-tier: absolute → indexed → indirect | `il/generator/expressions.ts` |
| 6.1.2 | Refactor generatePeekIntrinsic() with 3-tier | `il/generator/expressions.ts` |
| 6.1.3 | Add integration tests: poke/peek with all 3 tiers | `__tests__/` |

**Verify**: `./compiler-test il codegen pipeline`

### Session 6.2: Refactor pokew() and peekw() to 3-Tier

| # | Task | File |
|---|------|------|
| 6.2.1 | Refactor generatePokewIntrinsic() — remove broken fallback, add 3-tier | `il/generator/expressions.ts` |
| 6.2.2 | Refactor generatePeekwIntrinsic() — remove broken fallback, add 3-tier | `il/generator/expressions.ts` |
| 6.2.3 | Add integration tests: pokew/peekw with all 3 tiers | `__tests__/` |

**Verify**: `./compiler-test`

---

## Phase 7: Word Comparisons + Loops

### Session 7.1: Word in Control Flow

| # | Task | File |
|---|------|------|
| 7.1.1 | Make comparison generation type-aware: use CMP_WORD when comparing words | `il/generator/` |
| 7.1.2 | Make for-loop increment type-aware: use INC_WORD for word iterators | `il/generator/` |
| 7.1.3 | Make compound assignment type-aware: wordVar += n uses ADD_WORD_*_IMM | `il/generator/` |
| 7.1.4 | Add tests: word for-loop past 255, word comparisons, compound assignments | `__tests__/` |

**Verify**: `./compiler-test`

---

## Phase 8: Word Function Support

**Reference**: [08-word-functions.md](08-word-functions.md)

### Session 8.1: Word Parameters + Returns

| # | Task | File |
|---|------|------|
| 8.1.1 | Make function call generation pass word args via A:X | `il/generator/expressions.ts` |
| 8.1.2 | Make function prologue store A:X for word params | `il/generator/generator.ts`, `codegen/` |
| 8.1.3 | Make return statement load word into A:X | `il/generator/`, `codegen/` |
| 8.1.4 | Add tests: functions with word params and word returns | `__tests__/` |

**Verify**: `./compiler-test`

---

## Phase 9: Integration + E2E Testing

### Session 9.1: Comprehensive Integration Tests

| # | Task | File |
|---|------|------|
| 9.1.1 | Create E2E test: complete program with word arithmetic, dynamic poke, word loops | `__tests__/e2e/` |
| 9.1.2 | Verify sprite-test.blend compiles at O0, O1, O2, O3 | — |
| 9.1.3 | Create E2E test: multi-module with word function calls across modules | `__tests__/e2e/` |
| 9.1.4 | Run full test suite, fix any remaining issues | — |

**Verify**: `./compiler-test`

---

## Phase 10: Optimizer + Final Verification

### Session 10.1: Optimizer Awareness + Cleanup

| # | Task | File |
|---|------|------|
| 10.1.1 | Add new word opcodes to optimizer instruction tables (guards, analysis) | `il/guards.ts`, `il/analysis.ts` |
| 10.1.2 | Ensure optimizer doesn't break word arithmetic sequences | `optimizer/` |
| 10.1.3 | Final full test run, verify all 8578+ existing tests + new tests pass | — |
| 10.1.4 | Update PROJECT_STATUS.md with word arithmetic capabilities | `PROJECT_STATUS.md` |

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Word Arithmetic IL Opcodes
- [ ] 1.1.1 Add word arithmetic opcodes to ILOpcode enum
- [ ] 1.1.2 Add cost estimates for new opcodes
- [ ] 1.1.3 Add builder methods for word arithmetic
- [ ] 1.1.4 Add unit tests for builder methods
- [ ] 1.2.1 Add CMP_WORD/INC_WORD/DEC_WORD opcodes
- [ ] 1.2.2 Add cost estimates for cmp/inc/dec
- [ ] 1.2.3 Add builder methods for cmp/inc/dec
- [ ] 1.2.4 Add unit tests for cmp/inc/dec builders

### Phase 2: Word Arithmetic Codegen
- [ ] 2.1.1 genAddWordByteImm() codegen
- [ ] 2.1.2 genAddWordImm() codegen
- [ ] 2.1.3 genAddWordByteSlot() + genAddWordSlot()
- [ ] 2.1.4 genSubWord variants
- [ ] 2.1.5 genPromoteByteWord()
- [ ] 2.1.6 Dispatch cases in generateInstruction()
- [ ] 2.1.7 Codegen unit tests for word arithmetic
- [ ] 2.2.1 genCmpWordImm()
- [ ] 2.2.2 genCmpWordSlot()
- [ ] 2.2.3 genIncWord()
- [ ] 2.2.4 genDecWord()
- [ ] 2.2.5 Codegen unit tests for cmp/inc/dec

### Phase 3: Type-Aware Expression Generation
- [ ] 3.1.1 isWordTyped() helper
- [ ] 3.1.2 generateBinary() type dispatch
- [ ] 3.1.3 generateBinaryWord() for +, -
- [ ] 3.1.4 Fix generateIdentifier() for word slots
- [ ] 3.2.1 Byte→word promotion
- [ ] 3.2.2 Word assignment (STORE_WORD)
- [ ] 3.2.3 Mixed-width expression tests
- [ ] 3.2.4 Full regression test

### Phase 4: Constant Folding + Address Decomposer
- [ ] 4.1.1 Enhanced constant folding (all ops)
- [ ] 4.1.2 Address decomposer implementation
- [ ] 4.1.3 Constant folding tests
- [ ] 4.1.4 Address decomposer tests

### Phase 5: Indirect Addressing
- [ ] 5.1.1 STORE_ZP_PTR/POKE_INDIRECT/PEEK_INDIRECT opcodes
- [ ] 5.1.2 Builder methods for indirect ops
- [ ] 5.1.3 STORE_ZP_PTR codegen
- [ ] 5.1.4 POKE_INDIRECT codegen
- [ ] 5.1.5 PEEK_INDIRECT codegen
- [ ] 5.1.6 Indirect addressing tests

### Phase 6: 3-Tier Intrinsic Refactor
- [ ] 6.1.1 Refactor poke() 3-tier
- [ ] 6.1.2 Refactor peek() 3-tier
- [ ] 6.1.3 poke/peek integration tests
- [ ] 6.2.1 Refactor pokew() 3-tier (fix broken fallback)
- [ ] 6.2.2 Refactor peekw() 3-tier (fix broken fallback)
- [ ] 6.2.3 pokew/peekw integration tests

### Phase 7: Word Comparisons + Loops
- [ ] 7.1.1 Type-aware comparisons
- [ ] 7.1.2 Type-aware for-loop increment
- [ ] 7.1.3 Type-aware compound assignments
- [ ] 7.1.4 Word control flow tests

### Phase 8: Word Function Support
- [ ] 8.1.1 Word argument passing via A:X
- [ ] 8.1.2 Word parameter prologue
- [ ] 8.1.3 Word return via A:X
- [ ] 8.1.4 Word function tests

### Phase 9: Integration + E2E
- [ ] 9.1.1 E2E word arithmetic + dynamic poke test
- [ ] 9.1.2 Verify sprite-test.blend at all O levels
- [ ] 9.1.3 E2E multi-module word function test
- [ ] 9.1.4 Full regression test

### Phase 10: Optimizer + Final
- [ ] 10.1.1 Add word opcodes to optimizer tables
- [ ] 10.1.2 Verify optimizer doesn't break word sequences
- [ ] 10.1.3 Final full test run
- [ ] 10.1.4 Update PROJECT_STATUS.md

---

## Dependencies

```
Phase 1 (IL opcodes)
    ↓
Phase 2 (Codegen) ← Phase 1
    ↓
Phase 3 (Type-aware expr) ← Phase 1
    ↓
Phase 4 (Constant folding) ← independent, can parallel Phase 2-3
    ↓
Phase 5 (Indirect addressing) ← Phase 1, Phase 2
    ↓
Phase 6 (3-tier intrinsics) ← Phase 3, Phase 4, Phase 5
    ↓
Phase 7 (Word cmp/loops) ← Phase 1, Phase 2, Phase 3
    ↓
Phase 8 (Word functions) ← Phase 1, Phase 2, Phase 3
    ↓
Phase 9 (Integration) ← Phase 6, Phase 7, Phase 8
    ↓
Phase 10 (Optimizer) ← Phase 9
```

---

## Session Protocol

### Starting a Session

```bash
clear && scripts/agent.sh start
# Reference: "Implement Phase X, Session X.X per plans/word-arithmetic-and-addressing/99-execution-plan.md"
```

### Ending a Session

```bash
./compiler-test
clear && scripts/agent.sh finished
# Call attempt_completion
# User runs /compact
```

---

## Success Criteria

**Feature is complete when:**

1. ✅ All phases completed
2. ✅ All 8578+ existing tests passing (zero regressions)
3. ✅ New tests for all word arithmetic ops, indirect addressing, intrinsics
4. ✅ `sprite-test.blend` compiles at all optimization levels
5. ✅ `poke(SCREEN + i + j, val)` generates correct indirect addressing code
6. ✅ `let addr: word = $0400 + offset` produces correct 16-bit result
7. ✅ Word loops iterate past 255 correctly
8. ✅ PROJECT_STATUS.md updated
