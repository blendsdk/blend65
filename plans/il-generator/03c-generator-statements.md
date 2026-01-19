# Phase 3c: Statement Generation

> **Phase**: 3c of 8 (split from Phase 3)  
> **Est. Time**: ~9 hours  
> **Tasks**: 6  
> **Tests**: ~60  
> **Prerequisites**: Phase 3b (Declaration Generation)

---

## Overview

This phase creates statement-level IL generation for control flow and return statements.

## Directory Structure Created

```
packages/compiler/src/il/generator/
└── statements.ts               # ILStatementGenerator
```

---

## Task 3.5: Create Statement Generation Layer

**File**: `packages/compiler/src/il/generator/statements.ts`

**Time**: 3 hours

**Tests**: 35 tests (all statement types)

**Key Concepts**:
- Dispatches to appropriate statement handler
- Manages loop context for break/continue
- Handles block statements recursively

---

## Task 3.6: If Statement Generation

**Time**: 1.5 hours

**Tests**: 15 tests (if/else variants)

**Key Concepts**:
- Generates condition expression
- Creates then/else/end blocks
- Emits BRANCH instruction

---

## Task 3.7: While Statement Generation

**Time**: 1.5 hours

**Tests**: 15 tests (while loops, break, continue)

**Key Concepts**:
- Creates header/body/end blocks
- Pushes loop context for break/continue
- Emits condition check and BRANCH

---

## Task 3.8: For Statement Generation (FOR → WHILE Lowering)

**Time**: 2 hours

**Tests**: 20 tests (for loops, step values, nested)

**Key Concepts**:
- Lowers FOR to WHILE pattern
- Enables standard loop optimizations
- Adds loop metadata (depth, trip count)

---

## Task 3.9: Return Statement Generation

**Time**: 45 minutes

**Tests**: 10 tests (return value, return void)

**Key Concepts**:
- Emits RETURN or RETURN_VOID
- Validates return type matches function

---

## Task 3.10: Main ILGenerator Class + Exports

**Time**: 30 minutes

**Tests**: 10 tests (end-to-end generation)

**Key Concepts**:
- Final concrete class
- Combines all layers (Base → Modules → Decls → Stmts → Exprs)

---

## Phase 3c Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 3.5 | Statement generation layer | 3 hr | 35 | [ ] |
| 3.6 | If statement generation | 1.5 hr | 15 | [ ] |
| 3.7 | While statement generation | 1.5 hr | 15 | [ ] |
| 3.8 | For statement generation | 2 hr | 20 | [ ] |
| 3.9 | Return statement generation | 45 min | 10 | [ ] |
| 3.10 | Main ILGenerator class | 30 min | 10 | [ ] |
| **Total** | | **9 hr** | **60** | |

---

## Success Criteria

- [ ] All statement types generate correct IL
- [ ] Control flow creates proper CFG
- [ ] Break/continue resolve to correct labels
- [ ] For loops lower to while pattern
- [ ] Return statements type-check
- [ ] 60 tests passing

---

**Previous**: [03b-generator-declarations.md](03b-generator-declarations.md)  
**Next**: [04-expressions.md](04-expressions.md)