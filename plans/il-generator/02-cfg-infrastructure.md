# Phase 2: Basic Block & CFG Infrastructure

> **Phase**: 2 of 8  
> **Est. Time**: ~10 hours  
> **Tasks**: 6  
> **Tests**: ~125  
> **Prerequisites**: Phase 1 (IL Type System)

---

## Overview

This phase creates the basic block and control flow graph structures that organize IL instructions.

## Directory Structure Created

```
packages/compiler/src/il/
├── basic-block.ts              # BasicBlock class
├── function.ts                 # ILFunction class
├── module.ts                   # ILModule class
├── builder.ts                  # ILBuilder helper
├── printer.ts                  # IL pretty-printer
└── validator.ts                # IL validation
```

---

## Task 2.1: Define Basic Block Class

**File**: `packages/compiler/src/il/basic-block.ts`

**Time**: 1.5 hours

**Tests**: 20 tests (block creation, instruction add, CFG navigation)

**Key Concepts**:
- Single entry point (first instruction)
- Single exit point (last instruction - jump/branch/return)
- No branches except at the end
- Tracks predecessors and successors for CFG

---

## Task 2.2: Define ILFunction Class

**File**: `packages/compiler/src/il/function.ts`

**Time**: 2 hours

**Tests**: 25 tests (function creation, block management, CFG analysis)

**Key Concepts**:
- Contains all basic blocks for a function
- First block is entry block
- Tracks exit blocks (blocks with return)
- Supports dominator tree computation

---

## Task 2.3: Define ILModule Class

**File**: `packages/compiler/src/il/module.ts`

**Time**: 1.5 hours

**Tests**: 20 tests (module creation, function/global management)

**Key Concepts**:
- Contains all functions in a module
- Manages global variables with storage classes
- Tracks imports and exports

---

## Task 2.4: Create ILBuilder Helper

**File**: `packages/compiler/src/il/builder.ts`

**Time**: 2.5 hours

**Tests**: 30 tests (all emit methods, builder state)

**Key Concepts**:
- Fluent API for instruction emission
- Manages current function/block context
- Creates registers and labels automatically

---

## Task 2.5: Create ILPrinter

**File**: `packages/compiler/src/il/printer.ts`

**Time**: 1 hour

**Tests**: 10 tests (print various IL constructs)

**Key Concepts**:
- Pretty-prints IL for debugging
- Human-readable output format

---

## Task 2.6: Create ILValidator

**File**: `packages/compiler/src/il/validator.ts`

**Time**: 1.5 hours

**Tests**: 20 tests (valid/invalid IL detection)

**Key Concepts**:
- Validates IL before code generation
- Checks types, CFG, SSA, terminators

---

## Phase 2 Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 2.1 | Define BasicBlock class | 1.5 hr | 20 | [ ] |
| 2.2 | Define ILFunction class | 2 hr | 25 | [ ] |
| 2.3 | Define ILModule class | 1.5 hr | 20 | [ ] |
| 2.4 | Create ILBuilder helper | 2.5 hr | 30 | [ ] |
| 2.5 | Create ILPrinter | 1 hr | 10 | [ ] |
| 2.6 | Create ILValidator | 1.5 hr | 20 | [ ] |
| **Total** | | **10 hr** | **125** | |

---

## Success Criteria

- [ ] Basic blocks can hold instructions
- [ ] CFG navigation works (predecessors/successors)
- [ ] Functions manage blocks correctly
- [ ] Modules manage functions and globals
- [ ] Builder emits all instruction types
- [ ] Printer produces readable output
- [ ] Validator catches IL errors
- [ ] 125 tests passing

---

**Previous**: [01-type-system.md](01-type-system.md)  
**Next**: [03a-generator-base.md](03a-generator-base.md)