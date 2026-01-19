# Phase 4: Expression Translation

> **Phase**: 4 of 8  
> **Est. Time**: ~14.25 hours  
> **Tasks**: 10  
> **Tests**: ~170  
> **Prerequisites**: Phase 3c (Statement Generation)

---

## Overview

This phase implements expression translation from AST to IL with type coercion insertion.

## Directory Structure Created

```
packages/compiler/src/il/generator/
└── expressions.ts              # ILExpressionGenerator
```

---

## Task 4.1: Create Expression Generation Layer

**File**: `packages/compiler/src/il/generator/expressions.ts`

**Time**: 2 hours

**Tests**: 20 tests (expression dispatch)

**Key Concepts**:
- Dispatches to appropriate expression handler
- Checks for type coercion requirement
- Inserts coercion after base expression

---

## Task 4.2: Literal Expression Generation

**Time**: 1 hour

**Tests**: 15 tests (numbers, booleans, strings)

**Key Concepts**:
- Emits CONST instruction
- Handles numeric formats (decimal, hex, binary)
- String literals → pointer to data

---

## Task 4.3: Identifier Expression Generation

**Time**: 45 minutes

**Tests**: 10 tests (variable reads)

**Key Concepts**:
- Emits LOAD_VAR instruction
- Looks up variable register mapping

---

## Task 4.4: Binary Expression Generation

**Time**: 2 hours

**Tests**: 25 tests (all operators)

**Key Concepts**:
- Generates left and right operands
- Emits appropriate binary opcode
- Handles all arithmetic/bitwise/comparison ops

---

## Task 4.5: Unary Expression Generation

**Time**: 1 hour

**Tests**: 15 tests (negation, not, address-of)

**Key Concepts**:
- Emits NEG, NOT, or address-of handling
- Address-of returns pointer to variable

---

## Task 4.6: Call Expression Generation

**Time**: 1.5 hours

**Tests**: 20 tests (function calls, intrinsic detection)

**Key Concepts**:
- Generates arguments first
- Checks for intrinsic function
- Emits CALL or CALL_VOID

---

## Task 4.7: Index Expression Generation (Arrays)

**Time**: 1.5 hours

**Tests**: 15 tests (array access)

**Key Concepts**:
- Generates array and index expressions
- Emits LOAD_ARRAY or STORE_ARRAY

---

## Task 4.8: Assignment Expression Generation

**Time**: 1.5 hours

**Tests**: 15 tests (simple, compound assignments)

**Key Concepts**:
- Handles simple assignment (=)
- Handles compound (+=, -=, etc.)
- Emits STORE_VAR

---

## Task 4.9: Type Coercion Insertion

**Time**: 1.5 hours

**Tests**: 20 tests (all coercion types)

**Key Concepts**:
- Reads coercion metadata from semantic analysis
- Emits ZERO_EXTEND, TRUNCATE, etc.
- Preserves type safety

---

## Task 4.10: Short-Circuit Logical Operators

**Time**: 1.5 hours

**Tests**: 15 tests (&amp;&amp;, ||)

**Key Concepts**:
- Creates basic blocks for short-circuit
- && skips right if left is false
- || skips right if left is true

---

## Phase 4 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 4.1 | Expression generation layer | 2 hr | 20 | [ ] |
| 4.2 | Literal expressions | 1 hr | 15 | [ ] |
| 4.3 | Identifier expressions | 45 min | 10 | [ ] |
| 4.4 | Binary expressions | 2 hr | 25 | [ ] |
| 4.5 | Unary expressions | 1 hr | 15 | [ ] |
| 4.6 | Call expressions | 1.5 hr | 20 | [ ] |
| 4.7 | Index expressions | 1.5 hr | 15 | [ ] |
| 4.8 | Assignment expressions | 1.5 hr | 15 | [ ] |
| 4.9 | Type coercion insertion | 1.5 hr | 20 | [ ] |
| 4.10 | Short-circuit operators | 1.5 hr | 15 | [ ] |
| **Total** | | **14.25 hr** | **170** | |

---

## Success Criteria

- [ ] All expression types generate correct IL
- [ ] Type coercion automatically inserted
- [ ] Short-circuit operators create correct CFG
- [ ] 170 tests passing

---

**Previous**: [03c-generator-statements.md](03c-generator-statements.md)  
**Next**: [05-intrinsics.md](05-intrinsics.md)