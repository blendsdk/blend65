# Array Size Inference Implementation Plan

> **✅ STATUS: COMPLETED** - All tasks implemented and tested  
> **Archived**: January 19, 2026

**Date**: January 18, 2026  
**Feature**: Array Size Inference from Initializers  
**Estimated Effort**: 8-12 hours  
**Status**: ~~Ready for Implementation~~ → **COMPLETED**

---

## Executive Summary

Implement array size inference to allow developers to omit array size when providing an initializer:

```js
// Current (explicit size required):
let colors: byte[3] = [2, 5, 6];

// New (size inferred from initializer):
let colors: byte[] = [2, 5, 6];  // Size 3 inferred
```

---

## Critical Semantics Clarifications

### Array Assignment Rules (MUST BE ENFORCED)

**✅ What `let` Allows:**
- Element mutation: `colors[0] = 10;`

**❌ What `let` Does NOT Allow:**
- Array reassignment: `colors = [1, 2];` ← ALWAYS ERROR
- Array resizing: Not possible (fixed memory)

**Arrays are fixed-size memory regions** - once allocated, size cannot change.

---

## Implementation Phases

### Phase 1: Language Specification (1 hour)
Update documentation to support optional array size

### Phase 2: Parser Changes (2-3 hours)
Make array size optional in type parsing

### Phase 3: Semantic Analyzer (3-4 hours)
Infer size from array literal initializers

### Phase 4: Testing (2-3 hours)
Comprehensive test coverage

### Phase 5: Documentation (30 minutes)
Update examples and guides

---

## Granular Task Breakdown

### **STEP 1: Update Language Specification** (30 min)

**File**: `docs/language-specification/05-type-system.md`

**Task 1.1**: Update grammar to make array size optional
```ebnf
// Old:
type_expr = type_name | type_name , "[" , integer , "]" ;

// New:
type_expr = type_name | type_name , "[" , [ integer ] , "]" ;
```

**Task 1.2**: Add array size inference section with examples

**Task 1.3**: Document error cases (no initializer with empty brackets)

---

### **STEP 2: Update Variables Documentation** (30 min)

**File**: `docs/language-specification/10-variables.md`

**Task 2.1**: Add array reassignment rules section

**Task 2.2**: Add size inference examples

**Task 2.3**: Clarify let vs const for arrays

---

### **STEP 3: Parser - Make Array Size Optional** (1 hour)

**File**: `packages/compiler/src/parser/declarations.ts`

**Task 3.1**: Modify `parseTypeExpression()` to accept optional size
- Change from `expect(NUMBER)` to conditional check
- Store `null` when size is omitted
- Track whether size was explicit or inferred

**Task 3.2**: Update AST to support optional size
- Modify `ArrayTypeExpression` (if exists) or
- Modify `VariableDecl` to track inference status

---

### **STEP 4: Parser - Validation** (30 min)

**File**: `packages/compiler/src/parser/declarations.ts`

**Task 4.1**: Add parser-level validation
- Error if `byte[]` without initializer
- Allow `byte[] = [...]` with initializer

**Task 4.2**: Add helpful error messages

---

### **STEP 5: Semantic Analyzer - Inference Logic** (2 hours)

**File**: `packages/compiler/src/semantic/analyzer.ts` or new file

**Task 5.1**: Create `inferArraySize()` function
- Check if initializer is ArrayLiteralExpression
- Return element count
- Return null if not inferable

**Task 5.2**: Integrate into variable declaration analysis
- Detect when size is null
- Call inference logic
- Update type information with inferred size

**Task 5.3**: Handle nested arrays
- Infer multi-dimensional sizes
- Validate consistency (all rows same size)

---

### **STEP 6: Semantic Analyzer - Validation** (1 hour)

**File**: `packages/compiler/src/semantic/analyzer.ts`

**Task 6.1**: Enforce array assignment rules
- Detect array reassignment attempts
- Report error: "Cannot reassign arrays"

**Task 6.2**: Validate const arrays
- Prevent element modification
- Prevent array reassignment (same as let)

**Task 6.3**: Type check inferred sizes
- Ensure later usage matches inferred size
- Warn on potential out-of-bounds access

---

### **STEP 7: Error Messages** (30 min)

**File**: `packages/compiler/src/ast/diagnostics.ts`

**Task 7.1**: Add new diagnostic codes
- `CANNOT_INFER_ARRAY_SIZE`
- `CANNOT_REASSIGN_ARRAY`
- `ARRAY_SIZE_MISMATCH`

**Task 7.2**: Add helpful error messages

---

### **STEP 8: Basic Tests** (1 hour)

**File**: `packages/compiler/src/__tests__/parser/array-size-inference.test.ts`

**Task 8.1**: Test basic inference
- Single-dimensional arrays
- Empty arrays
- Single element arrays

**Task 8.2**: Test parser errors
- Missing initializer with `byte[]`
- Invalid syntax

---

### **STEP 9: Advanced Tests** (1 hour)

**File**: Same as above

**Task 9.1**: Test nested array inference
- 2D arrays
- 3D arrays
- Inconsistent sizes (should error)

**Task 9.2**: Test with variable declarations
- let vs const
- Storage classes (@zp, @ram, @data)

---

### **STEP 10: Semantic Tests** (1 hour)

**File**: `packages/compiler/src/__tests__/semantic/array-inference-semantic.test.ts`

**Task 10.1**: Test inference in semantic phase
- Size correctly inferred
- Type information updated

**Task 10.2**: Test error cases
- Array reassignment attempts
- Const element modification
- Non-literal initializers

---

### **STEP 11: Integration Tests** (30 min)

**File**: `packages/compiler/src/__tests__/integration/array-inference.test.ts`

**Task 11.1**: End-to-end tests
- Full program with inferred arrays
- Multiple modules
- Complex expressions

---

### **STEP 12: Documentation Examples** (30 min)

**Files**: Various documentation files

**Task 12.1**: Update examples throughout docs

**Task 12.2**: Add to language specification examples section

---

## Task Checklist

### Phase 1: Language Specification
- [x] Task 1.1: Update type system grammar ✅
- [x] Task 1.2: Add inference section to type-system.md ✅
- [x] Task 2.1: Add array reassignment rules to variables.md ✅
- [x] Task 2.2: Add inference examples to variables.md ✅

### Phase 2: Parser Implementation
- [x] Task 3.1: Make array size optional in parser ✅
- [x] Task 3.2: Update AST/type tracking ✅
- [x] Task 4.1: Add parser validation ✅
- [x] Task 4.2: Add error messages ✅

### Phase 3: Semantic Analyzer
- [x] Task 5.1: Create inferArraySize() function ✅
- [x] Task 5.2: Integrate inference into analyzer ✅
- [x] Task 5.3: Handle nested arrays ✅
- [x] Task 6.1: Enforce no array reassignment ✅
- [x] Task 6.2: Validate const arrays ✅
- [x] Task 6.3: Type check inferred sizes ✅

### Phase 4: Error Handling
- [x] Task 7.1: Add diagnostic codes ✅
- [x] Task 7.2: Write error messages ✅

### Phase 5: Testing
- [x] Task 8.1: Basic inference tests ✅
- [x] Task 8.2: Parser error tests ✅
- [x] Task 9.1: Nested array tests ✅
- [x] Task 9.2: Declaration tests ✅
- [x] Task 10.1: Semantic inference tests ✅
- [x] Task 10.2: Semantic error tests ✅
- [x] Task 11.1: Integration tests ✅

### Phase 6: Documentation
- [x] Task 12.1: Update doc examples ✅
- [x] Task 12.2: Add to spec examples ✅

### Final Steps
- [x] Run full test suite ✅
- [x] Verify no regressions ✅
- [x] Update COMPILER-MASTER-PLAN.md ✅
- [x] Archive old array literals plan ✅

---

## Implementation Order

**Session 1: Documentation + Parser** (2-3 hours)
1. Tasks 1.1-2.2: Update specifications
2. Tasks 3.1-4.2: Parser changes
3. Tasks 7.1-7.2: Error messages

**Session 2: Semantic Analyzer** (3-4 hours)
1. Tasks 5.1-5.3: Inference logic
2. Tasks 6.1-6.3: Validation rules

**Session 3: Testing** (2-3 hours)
1. Tasks 8.1-9.2: Parser tests
2. Tasks 10.1-10.2: Semantic tests
3. Task 11.1: Integration tests

**Session 4: Polish** (30 min)
1. Tasks 12.1-12.2: Documentation
2. Final verification

---

## Success Criteria

### Must Have
- ✅ Parser accepts `byte[]` syntax
- ✅ Semantic analyzer infers size from `[1, 2, 3]`
- ✅ Nested arrays supported: `byte[][] = [[1, 2], [3, 4]]`
- ✅ Error on `byte[]` without initializer
- ✅ Error on array reassignment attempts
- ✅ All tests pass (50+ new tests)
- ✅ No regressions (2,428 existing tests still pass)

### Should Have
- ✅ Clear error messages
- ✅ Examples in documentation
- ✅ Support for all storage classes

### Nice to Have
- ✅ IDE-friendly error messages
- ✅ Quick fix suggestions

---

## Risk Assessment

### Low Risk
- Parser changes are straightforward
- Clear semantics
- Self-contained feature

### Medium Risk
- Nested array inference complexity
- Edge cases with non-literal initializers
- Interaction with type system

### Mitigation
- Granular testing at each step
- Incremental implementation
- Rollback plan if issues arise

---

## Notes

- Arrays are **fixed-size memory** in Blend65 (6502 systems language)
- Array reassignment is **never** allowed (even with same size)
- Size inference is **compile-time only** (no runtime overhead)
- Feature is **backward compatible** (explicit sizes still work)

---

**Ready to begin implementation!**