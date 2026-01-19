# Phase 3a: IL Generator Base & Modules

> **Phase**: 3a of 8 (split from Phase 3)  
> **Est. Time**: ~6.5 hours  
> **Tasks**: 4  
> **Tests**: ~55  
> **Prerequisites**: Phase 2 (CFG Infrastructure)

---

## Overview

This phase creates the IL generator foundation and module-level generation.

## Directory Structure Created

```
packages/compiler/src/il/generator/
├── index.ts                    # Generator exports
├── base.ts                     # ILGeneratorBase
└── modules.ts                  # ILModuleGenerator
```

---

## Task 3.1: Create IL Generator Base Class

**File**: `packages/compiler/src/il/generator/base.ts`

**Time**: 2 hours

**Tests**: 15 tests (base functionality)

**Key Concepts**:
- Receives AST, symbol table, type system, target config
- Provides shared utilities for all generator layers
- Manages variable → register mapping
- Converts AST types to IL types

---

## Task 3.2: Create Module Generation Layer

**File**: `packages/compiler/src/il/generator/modules.ts`

**Time**: 2 hours

**Tests**: 20 tests (module generation, imports, exports)

**Key Concepts**:
- Generates IL for entire program/module
- Processes imports first
- Then global variables
- Then functions
- Finally exports

---

## Task 3.3: Update Generator Index Exports

**File**: `packages/compiler/src/il/generator/index.ts`

**Time**: 15 minutes

**Tests**: None (infrastructure)

---

## Task 3.4: Integration Test Module Generation

**Time**: 2 hours

**Tests**: 20 tests (end-to-end module generation)

---

## Phase 3a Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 3.1 | IL Generator base class | 2 hr | 15 | [ ] |
| 3.2 | Module generation layer | 2 hr | 20 | [ ] |
| 3.3 | Update generator exports | 15 min | 0 | [ ] |
| 3.4 | Integration tests | 2 hr | 20 | [ ] |
| **Total** | | **6.5 hr** | **55** | |

---

## Success Criteria

- [ ] Base class provides all utilities
- [ ] Module generation produces valid ILModule
- [ ] Imports/exports are tracked
- [ ] Global variables become ILGlobalVariable
- [ ] 55 tests passing

---

**Previous**: [02-cfg-infrastructure.md](02-cfg-infrastructure.md)  
**Next**: [03b-generator-declarations.md](03b-generator-declarations.md)