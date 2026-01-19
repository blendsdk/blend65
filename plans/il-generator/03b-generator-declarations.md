# Phase 3b: Declaration Generation

> **Phase**: 3b of 8 (split from Phase 3)  
> **Est. Time**: ~5 hours  
> **Tasks**: 3  
> **Tests**: ~50  
> **Prerequisites**: Phase 3a (Generator Base)

---

## Overview

This phase creates declaration-level IL generation for functions and variables.

## Directory Structure Created

```
packages/compiler/src/il/generator/
└── declarations.ts             # ILDeclarationGenerator
```

---

## Task 3.3: Create Declaration Generation Layer

**File**: `packages/compiler/src/il/generator/declarations.ts`

**Time**: 2.5 hours

**Tests**: 25 tests (function generation, parameters, locals)

**Key Concepts**:
- Generates IL for function declarations
- Handles stub/intrinsic functions (no body)
- Creates ILFunction with return type and parameters
- Sets up entry block for function body

---

## Task 3.4: Parameter & Local Variable Generation

**Time**: 1.5 hours

**Tests**: 15 tests (parameter registers, local variables)

**Key Concepts**:
- Maps function parameters to registers
- Generates local variable declarations
- Handles storage classes (@zp, @ram, @data)

---

## Task 3.5: Intrinsic Function Registration

**Time**: 1 hour

**Tests**: 10 tests (intrinsic detection, registration)

**Key Concepts**:
- Detects stub functions (no body)
- Registers as intrinsic for special handling
- Links to intrinsic registry

---

## Phase 3b Task Checklist

| Task | Description | Time | Tests | Status |
|------|-------------|------|-------|--------|
| 3.3 | Declaration generation layer | 2.5 hr | 25 | [ ] |
| 3.4 | Parameter/local generation | 1.5 hr | 15 | [ ] |
| 3.5 | Intrinsic function registration | 1 hr | 10 | [ ] |
| **Total** | | **5 hr** | **50** | |

---

## Success Criteria

- [ ] Functions generate correct ILFunction
- [ ] Parameters map to registers
- [ ] Local variables create ILGlobalVariable entries
- [ ] Intrinsics detected and registered
- [ ] 50 tests passing

---

**Previous**: [03a-generator-base.md](03a-generator-base.md)  
**Next**: [03c-generator-statements.md](03c-generator-statements.md)