# Module Declaration and Export Warning Fix

> **Feature**: Fix two compiler bugs related to module declarations and export warnings
> **Status**: Planning Complete
> **Created**: January 26, 2026

## Overview

This plan addresses two compiler bugs discovered during Library Loading System testing:

1. **Parser Bug (High Priority)**: Module declarations with semicolons cause parser errors
2. **Semantic Analyzer Bug (Medium Priority)**: Exported variables incorrectly trigger "never read" warnings

Both bugs are simple fixes requiring minimal code changes but are blocking for the Library Loading System.

## Document Index

| #   | Document                                   | Description                             |
| --- | ------------------------------------------ | --------------------------------------- |
| 00  | [Index](00-index.md)                       | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)         | Bug descriptions and requirements       |
| 02  | [Current State](02-current-state.md)       | Analysis of current implementation      |
| 03  | [Parser Fix](03-parser-fix.md)             | Technical fix for module semicolon      |
| 04  | [Semantic Fix](04-semantic-fix.md)         | Technical fix for export warning        |
| 07  | [Testing Strategy](07-testing-strategy.md) | Test cases and verification             |
| 99  | [Execution Plan](99-execution-plan.md)     | Phases, sessions, and task checklist    |

## Quick Reference

### Bug 1: Module Declaration Semicolon

**Error:**
```
error[P004]: Unexpected token ';' at module scope.
  --> @stdlib/common/system.blend:13:14
    |
 13 | module system;
```

**Root Cause:** `parseModuleDecl()` doesn't consume the semicolon

**Fix Location:** `packages/compiler/src/parser/modules.ts`

---

### Bug 2: Export Variable Warning

**Warning:**
```
warning[S002]: Variable 'COLOR_LIGHT_GREEN' is assigned but never read
  --> @stdlib/c64/common/hardware.blend:225:8
    |
225 | export const COLOR_LIGHT_GREEN: byte = 13;
```

**Root Cause:** `detectUnusedVariables()` doesn't check export status

**Fix Location:** `packages/compiler/src/semantic/analysis/variable-usage.ts`

## Related Files

**Parser:**
- `packages/compiler/src/parser/modules.ts` - Module declaration parsing

**Semantic Analyzer:**
- `packages/compiler/src/semantic/analysis/variable-usage.ts` - Unused variable detection

**Language Specification:**
- `docs/language-specification/04-module-system.md` - Module syntax specification