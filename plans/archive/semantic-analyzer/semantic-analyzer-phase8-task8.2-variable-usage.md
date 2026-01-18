# Task 8.2: Variable Usage Analysis - Implementation Plan

> **Status**: Ready for Implementation
> **Estimated Time**: 4-5 hours
> **Dependencies**: Task 8.1 Complete ✅
> **Reference**: `definite-assignment.ts` (Task 8.1 implementation)

---

## Overview

Task 8.2 implements variable usage analysis to detect:
- **Unused variables** (declared but never read)
- **Write-only variables** (written but never read) 
- **Read-only variables** (read but never written after initialization)
- **Read/write counts** (for optimization hints)
- **Hot path accesses** (variables accessed in loops)
- **Loop depth tracking** (maximum nesting depth)

**Goal**: Generate metadata for IL optimizer and emit warnings for unused variables.

---

## Architecture Strategy

Following Task 8.1's successful pattern:

1. **Main Analyzer Class**: `VariableUsageAnalyzer` 
2. **Walker Classes**: Separate walkers for different traversal needs
3. **Metadata Keys**: Already defined in `optimization-metadata-keys.ts`
4. **Integration**: Called from `AdvancedAnalyzer.runTier1BasicAnalysis()`
5. **Tests**: Comprehensive test file with 15+ test suites

**File Structure**:
```
packages/compiler/src/semantic/analysis/
  ├── variable-usage.ts                    (NEW - main implementation)
  └── advanced-analyzer.ts                 (MODIFY - integration)

packages/compiler/src/__tests__/semantic/analysis/
  └── variable-usage.test.ts               (NEW - comprehensive tests)
```

---

## Metadata Generated

Per `optimization-metadata-keys.ts`:

```typescript
UsageReadCount = 'UsageReadCount'           // number
UsageWriteCount = 'UsageWriteCount'         // number
UsageIsUsed = 'UsageIsUsed'                 // boolean
UsageIsWriteOnly = 'UsageIsWriteOnly'       // boolean
UsageIsReadOnly = 'UsageIsReadOnly'         // boolean
UsageHotPathAccesses = 'UsageHotPathAccesses' // number
UsageMaxLoopDepth = 'UsageMaxLoopDepth'     // number
```

---

## CRITICAL: Small Granular Steps

**Each step is 30-60 minutes maximum, touches 1-2 files, and is immediately testable.**

---

## Phase 1: File Creation & Basic Structure (3 steps)

### Step 1.1: Create Empty Implementation File
**Time**: 10 minutes
**Files**: Create `packages/compiler/src/semantic/analysis/variable-usage.ts`

**Actions**:
- Create file with header comment
- Import required types
- Create empty `VariableUsageAnalyzer` class
- Add constructor with symbol table parameter
- Add empty `analyze(ast: Program)` method
- Add `getDiagnostics()` method returning empty array

**Test**: File compiles without errors

---

### Step 1.2: Create Empty Test File
**Time**: 10 minutes
**Files**: Create `packages/compiler/src/__tests__/semantic/analysis/variable-usage.test.ts`

**Actions**:
- Create file with test imports
- Add `analyzeCode()` helper function (copy from definite-assignment.test.ts)
- Add first empty test suite: `describe('VariableUsageAnalyzer', () => {})`
- Add single smoke test that calls analyzer

**Test**: Test file runs and passes (0 tests initially)

---

### Step 1.3: Export Analyzer from Index
**Time**: 5 minutes
**Files**: Modify `packages/compiler/src/semantic/analysis/index.ts`

**Actions**:
- Uncomment: `export { VariableUsageAnalyzer } from './variable-usage.js';`
- Verify export works

**Test**: Can import `VariableUsageAnalyzer` from `analysis` module

---

## Phase 2: Data Structures (2 steps)

### Step 2.1: Define Variable Usage Info Interface
**Time**: 15 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `VariableUsageInfo` interface with fields:
  - `name: string`
  - `readCount: number`
  - `writeCount: number`
  - `hotPathAccesses: number`
  - `maxLoopDepth: number`
  - `declaration: VariableDecl`
- Add protected field: `usageMap: Map<string, VariableUsageInfo>`
- Initialize in constructor

**Test**: Code compiles, interface is properly typed

---

### Step 2.2: Add Loop Context Tracking
**Time**: 15 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Add protected field: `currentLoopDepth: number = 0`
- Create `enterLoop()` method: increments depth
- Create `exitLoop()` method: decrements depth
- Create `getCurrentLoopDepth()` method: returns current depth

**Test**: Loop depth tracking works correctly

---

## Phase 3: Variable Collection (2 steps)

### Step 3.1: Implement Variable Declaration Collection
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `collectVariableDeclarations(ast: Program)` method
- Walk AST to find all `VariableDecl` nodes
- For each variable:
  - Create `VariableUsageInfo` entry in `usageMap`
  - Initialize all counters to 0
  - Store declaration node reference
- Skip function parameters (they're special)

**Test**: Write test that verifies variables are collected

---

### Step 3.2: Create Test Suite for Variable Collection
**Time**: 20 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Variable Collection', () => {})`
- Test 1: Collects single variable
- Test 2: Collects multiple variables
- Test 3: Collects variables in nested scopes
- Test 4: Skips function parameters

**Test**: All collection tests pass

---

## Phase 4: Read Tracking (3 steps)

### Step 4.1: Create Read Tracking Walker
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `class ReadTracker extends ASTWalker`
- Constructor takes: `usageMap`, `symbolTable`, `currentLoopDepth`
- Override `visitIdentifierExpression(node)`
  - Lookup symbol
  - If variable, increment `readCount`
  - If in loop, increment `hotPathAccesses`
  - Update `maxLoopDepth` if needed
- Handle special case: Skip assignment targets (left side)

**Test**: Walker compiles and instantiates

---

### Step 4.2: Integrate Read Tracker into Analyzer
**Time**: 20 minutes  
**Files**: `variable-usage.ts`

**Actions**:
- In `analyze()` method, after collecting variables:
  - Create `ReadTracker` instance
  - Walk entire AST with tracker
  - Handle loop entry/exit correctly

**Test**: Analyzer runs without errors

---

### Step 4.3: Create Test Suite for Read Tracking
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Read Tracking', () => {})`
- Test 1: Tracks single read
- Test 2: Tracks multiple reads
- Test 3: Tracks reads in expressions
- Test 4: Tracks reads in nested scopes
- Test 5: Skips assignment targets

**Test**: All read tracking tests pass

---

## Phase 5: Write Tracking (3 steps)

### Step 5.1: Create Write Tracking Walker
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `class WriteTracker extends ASTWalker`
- Constructor takes: `usageMap`, `symbolTable`, `currentLoopDepth`
- Override `visitAssignmentExpression(node)`
  - Extract target identifier
  - Lookup symbol
  - If variable, increment `writeCount`
  - If in loop, increment `hotPathAccesses`
- Override `visitVariableDecl(node)`
  - If has initializer, increment `writeCount`

**Test**: Walker compiles and instantiates

---

### Step 5.2: Integrate Write Tracker into Analyzer
**Time**: 20 minutes
**Files**: `variable-usage.ts`

**Actions**:
- In `analyze()` method, after read tracking:
  - Create `WriteTracker` instance
  - Walk entire AST with tracker
  - Handle loop entry/exit correctly

**Test**: Analyzer runs without errors

---

### Step 5.3: Create Test Suite for Write Tracking
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Write Tracking', () => {})`
- Test 1: Tracks single write
- Test 2: Tracks multiple writes
- Test 3: Tracks writes in assignments
- Test 4: Tracks initialization as write
- Test 5: Tracks compound assignments (+=, -=, etc.)

**Test**: All write tracking tests pass

---

## Phase 6: Loop Depth Tracking (2 steps)

### Step 6.1: Implement Loop Traversal
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Update `ReadTracker` to handle loop statements:
  - `visitWhileStatement()`: enter loop, visit children, exit loop
  - `visitForStatement()`: enter loop, visit children, exit loop
- Update `WriteTracker` similarly
- Ensure loop depth increments/decrements correctly

**Test**: Loop depth tracking works

---

### Step 6.2: Create Test Suite for Loop Depth
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Loop Depth Tracking', () => {})`
- Test 1: Tracks variables in single loop
- Test 2: Tracks variables in nested loops
- Test 3: Tracks hot path accesses correctly
- Test 4: Updates maxLoopDepth correctly

**Test**: All loop depth tests pass

---

## Phase 7: Metadata Generation (3 steps)

### Step 7.1: Implement Metadata Setter
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `setVariableMetadata()` method
- For each variable in `usageMap`:
  - Set `UsageReadCount` on declaration
  - Set `UsageWriteCount` on declaration
  - Set `UsageHotPathAccesses` on declaration
  - Set `UsageMaxLoopDepth` on declaration
- Use `OptimizationMetadataKey` enum

**Test**: Metadata is set correctly

---

### Step 7.2: Implement Classification Flags
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- In `setVariableMetadata()`, compute boolean flags:
  - `UsageIsUsed = readCount > 0 || writeCount > 0`
  - `UsageIsWriteOnly = writeCount > 0 && readCount === 0`
  - `UsageIsReadOnly = readCount > 0 && writeCount <= 1` (1 for initializer)
- Set flags on declaration metadata

**Test**: Classification flags are correct

---

### Step 7.3: Create Test Suite for Metadata
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Metadata Generation', () => {})`
- Test 1: Sets read/write counts
- Test 2: Sets hot path accesses
- Test 3: Sets max loop depth
- Test 4: Sets isUsed flag correctly
- Test 5: Sets isWriteOnly flag correctly
- Test 6: Sets isReadOnly flag correctly

**Test**: All metadata tests pass

---

## Phase 8: Unused Variable Detection (3 steps)

### Step 8.1: Implement Unused Variable Detection
**Time**: 20 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Create `detectUnusedVariables()` method
- For each variable in `usageMap`:
  - If `readCount === 0 && writeCount <= 1`:
    - Generate WARNING diagnostic
    - Message: "Variable 'x' is declared but never used"
    - Exclude function parameters
    - Exclude exported variables

**Test**: Unused detection works

---

### Step 8.2: Implement Write-Only Variable Detection
**Time**: 20 minutes
**Files**: `variable-usage.ts`

**Actions**:
- In `detectUnusedVariables()`, add check:
  - If `writeCount > 0 && readCount === 0`:
    - Generate WARNING diagnostic
    - Message: "Variable 'x' is assigned but never read"
    - Set severity to WARNING

**Test**: Write-only detection works

---

### Step 8.3: Create Test Suite for Unused Detection
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Unused Variable Detection', () => {})`
- Test 1: Detects completely unused variable
- Test 2: Detects write-only variable
- Test 3: Does not warn for used variables
- Test 4: Does not warn for function parameters
- Test 5: Does not warn for exported variables

**Test**: All unused detection tests pass

---

## Phase 9: Integration (2 steps)

### Step 9.1: Integrate into AdvancedAnalyzer
**Time**: 15 minutes
**Files**: `advanced-analyzer.ts`

**Actions**:
- Import `VariableUsageAnalyzer`
- In `runTier1BasicAnalysis()`, after definite assignment:
  ```typescript
  // Task 8.2: Variable usage analysis
  const usageAnalyzer = new VariableUsageAnalyzer(this.symbolTable);
  usageAnalyzer.analyze(ast);
  this.diagnostics.push(...usageAnalyzer.getDiagnostics());
  ```
- Remove TODO comment

**Test**: Integration works without errors

---

### Step 9.2: Create Integration Test
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Integration', () => {})`
- Test 1: End-to-end analysis with unused variable
- Test 2: End-to-end analysis with write-only variable
- Test 3: End-to-end with hot path tracking
- Test 4: Verify metadata is available on AST nodes

**Test**: Integration tests pass

---

## Phase 10: Edge Cases & Polish (2 steps)

### Step 10.1: Handle Edge Cases
**Time**: 30 minutes
**Files**: `variable-usage.ts`

**Actions**:
- Handle function parameters (mark as used)
- Handle exported variables (skip unused warnings)
- Handle const variables (mark read-only correctly)
- Handle loop variables (for statement variables)
- Handle nested functions (scope isolation)

**Test**: Edge case handling works

---

### Step 10.2: Create Edge Case Tests
**Time**: 30 minutes
**Files**: `variable-usage.test.ts`

**Actions**:
- Add test suite: `describe('Edge Cases', () => {})`
- Test 1: Function parameters
- Test 2: Exported variables
- Test 3: Const variables
- Test 4: Loop variables
- Test 5: Nested functions
- Test 6: Module-level variables

**Test**: All edge case tests pass

---

## Phase 11: Final Verification (1 step)

### Step 11.1: Run Full Test Suite
**Time**: 15 minutes
**Files**: All test files

**Actions**:
- Run: `clear && yarn clean && yarn build && yarn test`
- Verify all tests pass (1400+ tests)
- Verify no regressions in existing tests
- Verify new tests are included in count

**Test**: Full test suite passes

---

## Task Completion Checklist

### Implementation Files
- [ ] `packages/compiler/src/semantic/analysis/variable-usage.ts` created
- [ ] `packages/compiler/src/semantic/analysis/index.ts` updated (export uncommented)
- [ ] `packages/compiler/src/semantic/analysis/advanced-analyzer.ts` updated (integration)

### Test Files
- [ ] `packages/compiler/src/__tests__/semantic/analysis/variable-usage.test.ts` created
- [ ] 50+ test cases covering all functionality
- [ ] All tests passing

### Functionality
- [ ] Variable collection works
- [ ] Read tracking works
- [ ] Write tracking works
- [ ] Loop depth tracking works
- [ ] Hot path tracking works
- [ ] Metadata generation works
- [ ] Unused variable detection works
- [ ] Write-only variable detection works
- [ ] Edge cases handled
- [ ] Integration complete

### Quality
- [ ] Code follows .clinerules/code.md standards
- [ ] JSDoc comments on all public methods
- [ ] Comprehensive test coverage
- [ ] No regressions in existing tests
- [ ] Full test suite passes

---

## Success Criteria

**Task 8.2 is complete when:**

1. ✅ `VariableUsageAnalyzer` class implemented
2. ✅ All 7 metadata keys are set correctly
3. ✅ Unused variable warnings generated
4. ✅ Write-only variable warnings generated
5. ✅ Loop depth and hot path tracking works
6. ✅ 50+ tests passing
7. ✅ Integrated into `AdvancedAnalyzer`
8. ✅ Full test suite passes (1400+ tests)
9. ✅ No regressions

---

## Estimated Time Breakdown

| Phase | Steps | Time |
|-------|-------|------|
| Phase 1: File Creation | 3 | 25 min |
| Phase 2: Data Structures | 2 | 30 min |
| Phase 3: Variable Collection | 2 | 50 min |
| Phase 4: Read Tracking | 3 | 80 min |
| Phase 5: Write Tracking | 3 | 80 min |
| Phase 6: Loop Depth | 2 | 60 min |
| Phase 7: Metadata | 3 | 90 min |
| Phase 8: Unused Detection | 3 | 70 min |
| Phase 9: Integration | 2 | 45 min |
| Phase 10: Edge Cases | 2 | 60 min |
| Phase 11: Verification | 1 | 15 min |
| **TOTAL** | **26 steps** | **~10 hours** |

**Note**: Times are conservative estimates. Many steps will be faster with good focus.

---

## Next Steps After Task 8.2

Once Task 8.2 is complete, proceed to:
- **Task 8.3**: Unused Function Detection (~2 hours)
- **Task 8.4**: Dead Code Detection (~3 hours)

Then Task 8.5-8.13 (Tier 2 & Tier 3 analyses).

---

## Reference Implementation

Use `definite-assignment.ts` as reference for:
- Walker pattern usage
- Metadata setting approach
- Test structure
- Integration pattern

**Key similarities**:
- Both use CFG for analysis
- Both generate metadata
- Both emit diagnostics
- Both have comprehensive tests

**Key differences**:
- Task 8.2 doesn't need dataflow analysis (simpler)
- Task 8.2 tracks counts, not just boolean flags
- Task 8.2 generates warnings, not errors