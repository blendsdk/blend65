# Semantic E2E Test Fixes

> **Document**: 11-semantic-e2e-fixes.md
> **Parent**: [Index](00-index.md)
> **Created**: 2025-01-31
> **Status**: CRITICAL - Blocking Phase 5 Completion

## Overview

This document provides deep analysis of the **18 remaining failing tests** in the semantic analyzer E2E test suite. These tests MUST be fixed before proceeding to Phase 6 (Frame Allocator).

**Current Status**: 2346 passing, 18 failing (98.2% pass rate)

---

## Root Cause Analysis

### Category 1: For Loop Analysis Bug (6 tests)

**Tests Affected:**
| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| warning-types.test.ts | should NOT warn when variable is used in loop | success=true | success=false |
| recursion-errors.test.ts | should accept iterative equivalents | success=true | success=false |
| complete-analysis.test.ts | should analyze program with loops | success=true | success=false |
| complete-analysis.test.ts | should analyze program with arrays | success=true | success=false |
| complete-analysis.test.ts | should analyze C64-style memory access pattern | success=true | success=false |
| recursion-errors.test.ts | should still analyze other passes (partial) | diagnostics>1 | diagnostics=1 |

**Example Failing Code:**
```js
// This code should pass but fails
function factorial(n: byte): byte {
  let result: byte = 1;
  for (let i: byte = 2 to n step 1) {
    result = result * i;
  }
  return result;
}
```

**Root Cause Hypothesis:**
- For loop counter variable type inference or symbol registration failing
- Possible issue with `updateSymbolType(variable, counterType)` call in StatementTypeChecker
- Or issue with for loop scope handling in SymbolTableBuilder

**Files to Investigate:**
- `src/semantic/visitors/type-checker/statements.ts` (visitForStatement)
- `src/semantic/visitors/symbol-table-builder.ts` (visitForStatement)
- `src/semantic/symbol-table.ts` (enterLoopScope)

**Fix Strategy:**
1. Create debug script to trace for loop analysis step by step
2. Check if counter variable is properly registered in symbol table
3. Check if counter type is properly resolved
4. Verify loop body statements are visited correctly

---

### Category 2: Type Mismatch Detection (2 tests)

**Tests Affected:**
| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| type-checking.test.ts | should detect wrong argument type | success=false | success=true |
| type-checking.test.ts | should detect type mismatch in assignment | success=false | success=true |

**Example Failing Code:**
```js
// This code SHOULD fail but passes
function process(x: byte): void {}

function main(): void {
  let flag: bool = true;
  process(flag);  // Should ERROR: bool not assignable to byte
}
```

```js
// This code SHOULD fail but passes
function main(): void {
  let x: byte = 10;
  let flag: bool = true;
  x = flag;  // Should ERROR: bool not assignable to byte
}
```

**Root Cause Analysis:**
The type checker uses `canAssign(from, to)` which delegates to `typeSystem.canAssign()`. The issue is that `bool→byte` returns `true` when it should return `false`.

**Files to Investigate:**
- `src/semantic/type-system.ts` (canAssign, checkCompatibility)
- `src/semantic/visitors/type-checker/expressions.ts` (argument type checking)
- `src/semantic/visitors/type-checker/declarations.ts` (assignment type checking)

**Fix Strategy:**
1. Check TypeSystem.checkCompatibility for bool→byte case
2. Ensure bool is NOT assignable to byte (Blend65 uses strict typing)
3. Verify the type checker actually calls canAssign with correct arguments

---

### Category 3: Multi-Module Analysis (8 tests)

**Tests Affected:**
| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| multi-module.test.ts | should resolve simple imports | success=true | success=false |
| multi-module.test.ts | should resolve multiple imports from same module | success=true | success=false |
| multi-module.test.ts | should resolve imports from multiple modules | success=true | success=false |
| multi-module.test.ts | should detect direct circular imports | cycleErrors>0 | cycleErrors=0 |
| multi-module.test.ts | should detect indirect circular imports | cycleErrors>0 | cycleErrors=0 |
| multi-module.test.ts | should type check imported function calls | success=true | success=false |
| multi-module.test.ts | should handle imported types correctly | success=true | success=false |
| multi-module.test.ts | should sum errors across modules | totalErrors≥2 | totalErrors=1 |
| multi-module.test.ts | should track diagnostics per module | errors>0 | errors=0 |

**Root Cause Analysis:**
The multi-module analysis infrastructure exists but the integration is incomplete:

1. **Import Resolution**: The ImportResolver exists but `analyzeMultiple()` isn't properly connecting it
2. **Circular Detection**: DependencyGraph exists but cycle detection not integrated into analyzer
3. **Cross-Module Type Checking**: GlobalSymbolTable exists but not used during type checking
4. **Diagnostic Attribution**: Per-module diagnostic tracking not implemented

**Files to Investigate:**
- `src/semantic/analyzer.ts` (analyzeMultiple method)
- `src/semantic/import-resolver.ts` (resolve imports)
- `src/semantic/dependency-graph.ts` (cycle detection)
- `src/semantic/global-symbol-table.ts` (cross-module lookup)

**Fix Strategy:**
1. Review `analyzeMultiple()` implementation
2. Ensure ImportResolver.resolve() is called properly
3. Wire up DependencyGraph cycle detection
4. Ensure GlobalSymbolTable is populated before cross-module type checking
5. Track diagnostics per module in MultiModuleAnalysisResult

---

### Category 4: Analysis Continuation After Errors (1 test)

**Tests Affected:**
| Test File | Test Name | Expected | Actual |
|-----------|-----------|----------|--------|
| recursion-errors.test.ts | should still analyze other passes despite recursion | diagnostics>1 | diagnostics=1 |

**Example Code:**
```js
// Should produce 2 errors: recursion + type error
function recursive(): void { recursive(); }
function typeError(): byte { return true; }  // type error: bool not byte
```

**Root Cause Analysis:**
When recursion detection finds an error, subsequent passes (type checking) might be skipped or the type error isn't being detected (links to Category 2).

**Fix Strategy:**
1. Verify type checking runs even after recursion errors
2. This may be fixed automatically when Category 2 (type mismatch detection) is fixed

---

## Implementation Plan

### Session 5.18.1: Debug For Loop Issue

**Objective**: Identify and fix the for loop analysis bug

**Tasks**:
| # | Task | Priority |
|---|------|----------|
| 1 | Create debug script for for loop analysis | HIGH |
| 2 | Trace symbol table state during for loop visit | HIGH |
| 3 | Verify counter variable registration | HIGH |
| 4 | Check type resolution for counter variable | HIGH |
| 5 | Fix identified issue(s) | HIGH |
| 6 | Verify 6 for-loop related tests pass | HIGH |

**Estimated Time**: 1-2 hours

---

### Session 5.18.2: Fix Type Mismatch Detection

**Objective**: Ensure bool→byte type mismatch is detected

**Tasks**:
| # | Task | Priority |
|---|------|----------|
| 1 | Review TypeSystem.checkCompatibility | HIGH |
| 2 | Fix bool→byte compatibility (should be false) | HIGH |
| 3 | Verify canAssign is called during argument checking | HIGH |
| 4 | Verify canAssign is called during assignment checking | HIGH |
| 5 | Verify 2 type-checking tests pass | HIGH |
| 6 | Verify Category 4 test (analysis continuation) passes | MEDIUM |

**Estimated Time**: 30-60 minutes

---

### Session 5.18.3: Fix Multi-Module Analysis

**Objective**: Complete multi-module analysis integration

**Tasks**:
| # | Task | Priority |
|---|------|----------|
| 1 | Review analyzeMultiple() implementation | HIGH |
| 2 | Wire up ImportResolver properly | HIGH |
| 3 | Wire up DependencyGraph cycle detection | HIGH |
| 4 | Ensure GlobalSymbolTable is populated for cross-module | HIGH |
| 5 | Add per-module diagnostic tracking | MEDIUM |
| 6 | Verify all 8 multi-module tests pass | HIGH |

**Estimated Time**: 2-3 hours

---

## Fix Priority Order

**Phase 1: For Loop (Highest Priority)**
- Affects the most tests (6)
- Likely a simple bug in symbol/type handling
- Blocks real-world code patterns (loops are fundamental)

**Phase 2: Type Mismatch (High Priority)**
- Affects 2 tests directly, 1 indirectly
- Critical for type safety
- Probably a simple fix in TypeSystem

**Phase 3: Multi-Module (Medium Priority)**
- Affects 8 tests
- More complex integration work
- Can be done after single-module is solid

---

## Success Criteria

All 18 failing tests MUST pass:

- [ ] warning-types.test.ts: "should NOT warn when variable is used in loop"
- [ ] recursion-errors.test.ts: "should accept iterative equivalents"
- [ ] recursion-errors.test.ts: "should still analyze other passes despite recursion"
- [ ] complete-analysis.test.ts: "should analyze program with loops"
- [ ] complete-analysis.test.ts: "should analyze program with arrays"
- [ ] complete-analysis.test.ts: "should analyze C64-style memory access pattern"
- [ ] type-checking.test.ts: "should detect wrong argument type"
- [ ] type-checking.test.ts: "should detect type mismatch in assignment"
- [ ] multi-module.test.ts: "should resolve simple imports"
- [ ] multi-module.test.ts: "should resolve multiple imports from same module"
- [ ] multi-module.test.ts: "should resolve imports from multiple modules"
- [ ] multi-module.test.ts: "should detect direct circular imports"
- [ ] multi-module.test.ts: "should detect indirect circular imports"
- [ ] multi-module.test.ts: "should type check imported function calls"
- [ ] multi-module.test.ts: "should handle imported types correctly"
- [ ] multi-module.test.ts: "should sum errors across modules"
- [ ] multi-module.test.ts: "should track diagnostics per module"

**Target**: 2364/2389 tests passing (100% - 25 skipped)

---

## References

- Type Checker Implementation: `src/semantic/visitors/type-checker/`
- Symbol Table: `src/semantic/symbol-table.ts`
- Type System: `src/semantic/type-system.ts`
- Multi-Module: `src/semantic/analyzer.ts` (analyzeMultiple)
- Import Resolution: `src/semantic/import-resolver.ts`
- Dependency Graph: `src/semantic/dependency-graph.ts`