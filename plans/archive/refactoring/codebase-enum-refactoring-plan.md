# Codebase Enum Refactoring Plan

> **Purpose**: Fix all string-based enum comparisons across the entire codebase
> **Problem**: Code uses string literals instead of proper enum values (e.g., `symbol.kind === 'Variable'` instead of `symbol.kind === SymbolKind.Variable`)
> **Impact**: Type safety, maintainability, refactorability
> **Last Updated**: January 15, 2026

---

## Problem Statement

The codebase currently has string-based enum comparisons scattered throughout, which reduces code quality:

### Current (BAD):

```typescript
if (symbol.kind === 'Variable') {
  // ❌ String literal
  // ...
}
```

### Should Be (GOOD):

```typescript
if (symbol.kind === SymbolKind.Variable) {
  // ✅ Enum value
  // ...
}
```

---

## Affected Enums

Based on codebase analysis, these enums likely have string comparison issues:

### 1. **SymbolKind** (packages/compiler/src/semantic/symbol.ts)

```typescript
export enum SymbolKind {
  Variable = 'Variable',
  Function = 'Function',
  Parameter = 'Parameter',
  MapVariable = 'MapVariable',
  ImportedSymbol = 'ImportedSymbol',
  Type = 'Type',
  Enum = 'Enum',
  EnumMember = 'EnumMember',
}
```

### 2. **StorageClass** (packages/compiler/src/semantic/symbol.ts)

```typescript
export enum StorageClass {
  ZeroPage = 'zp',
  RAM = 'ram',
  Data = 'data',
  Map = 'map',
}
```

### 3. **TokenType** (packages/compiler/src/lexer/types.ts)

- Already properly defined as enum
- Check if any code uses string comparisons instead of enum values

### 4. **Other Potential Enum Issues**

- CFG node kinds
- AST node types
- Diagnostic severity levels
- Any other enums in the codebase

---

## Implementation Plan

### **Phase 1: Audit (Search & Identify)**

**Task 1.1: Search for SymbolKind String Comparisons** (1 hour)

Search patterns:

```bash
# Find all symbol.kind comparisons
grep -r "\.kind\s*===\s*['\"]" packages/compiler/src/

# Find all symbol.kind !== comparisons
grep -r "\.kind\s*!==\s*['\"]" packages/compiler/src/

# Find switch statements on kind
grep -r "switch.*\.kind" packages/compiler/src/
```

**Expected Locations:**

- `packages/compiler/src/semantic/visitors/`
- `packages/compiler/src/semantic/analyzer.ts`
- Any phase 8 implementation code (when created)

**Task 1.2: Search for StorageClass String Comparisons** (30 min)

Search patterns:

```bash
# Find storage class comparisons
grep -r "storageClass\s*===\s*['\"]" packages/compiler/src/
grep -r "storageClass\s*!==\s*['\"]" packages/compiler/src/
```

**Task 1.3: Create Audit Report** (30 min)

Create `plans/enum-refactoring-audit-report.md` with:

- List of all files with string-based enum comparisons
- Count of occurrences per file
- Priority ranking (high-traffic files first)

---

### **Phase 2: Refactor (Fix String Comparisons)**

**Task 2.1: Fix SymbolKind Comparisons** (2-3 hours)

For each file identified in audit:

1. **Import the enum** (if not already imported):

```typescript
import { SymbolKind } from '../semantic/symbol.js';
```

2. **Replace string literals with enum values**:

```typescript
// Before:
if (symbol.kind === 'Variable') {
}
if (symbol.kind === 'Function') {
}

// After:
if (symbol.kind === SymbolKind.Variable) {
}
if (symbol.kind === SymbolKind.Function) {
}
```

3. **Fix switch statements**:

```typescript
// Before:
switch (symbol.kind) {
  case 'Variable':
    break;
  case 'Function':
    break;
}

// After:
switch (symbol.kind) {
  case SymbolKind.Variable:
    break;
  case SymbolKind.Function:
    break;
}
```

**Task 2.2: Fix StorageClass Comparisons** (1-2 hours)

Similar process for StorageClass enum.

**Task 2.3: Fix Other Enum Comparisons** (2-3 hours)

Fix any other enums found during audit.

---

### **Phase 3: Verification (Testing & Quality Check)**

**Task 3.1: Run All Tests** (15 min)

```bash
clear && yarn clean && yarn build && yarn test
```

All tests must pass. If any fail, fix the refactoring.

**Task 3.2: Type Check** (5 min)

```bash
clear && yarn build
```

Ensure no TypeScript errors introduced.

**Task 3.3: Manual Code Review** (30 min)

Review all changed files to ensure:

- No string literals remain for enum comparisons
- Proper imports added
- Code is more readable

---

## Detailed File-by-File Refactoring Guide

### Example: Fixing `symbol-table-builder.ts`

**Step 1: Identify Issues**

```typescript
// Current code (BAD):
if (symbol.kind === 'Variable') {
  // handle variable
}
```

**Step 2: Add Import (if missing)**

```typescript
import { SymbolKind, StorageClass } from '../symbol.js';
```

**Step 3: Replace Strings with Enums**

```typescript
// Fixed code (GOOD):
if (symbol.kind === SymbolKind.Variable) {
  // handle variable
}
```

**Step 4: Test**

```bash
clear && yarn test symbol-table-builder.test.ts
```

---

## Priority Files

Based on codebase structure, prioritize these files:

### **High Priority** (Core Analysis)

1. `packages/compiler/src/semantic/visitors/symbol-table-builder.ts`
2. `packages/compiler/src/semantic/visitors/type-resolver.ts`
3. `packages/compiler/src/semantic/visitors/type-checker/*.ts`
4. `packages/compiler/src/semantic/analyzer.ts`

### **Medium Priority** (Supporting Infrastructure)

5. `packages/compiler/src/semantic/symbol-table.ts`
6. `packages/compiler/src/semantic/scope.ts`
7. `packages/compiler/src/semantic/global-symbol-table.ts`

### **Low Priority** (Tests and Utilities)

8. Test files (if they have string comparisons)
9. Utility functions

---

## Automated Search Script

Create a helper script `scripts/find-enum-strings.sh`:

```bash
#!/bin/bash

echo "=== Searching for string-based enum comparisons ==="

echo ""
echo "1. SymbolKind string comparisons:"
grep -rn "\.kind\s*[!=]==\s*['\"]" packages/compiler/src/ --include="*.ts" --exclude-dir=__tests__ | grep -v "TokenType\."

echo ""
echo "2. StorageClass string comparisons:"
grep -rn "storageClass\s*[!=]==\s*['\"]" packages/compiler/src/ --include="*.ts" --exclude-dir=__tests__

echo ""
echo "3. Switch on .kind:"
grep -rn "switch.*\.kind" packages/compiler/src/ --include="*.ts" --exclude-dir=__tests__

echo ""
echo "=== Search complete ==="
```

Usage:

```bash
chmod +x scripts/find-enum-strings.sh
./scripts/find-enum-strings.sh
```

---

## Success Criteria

### **Refactoring Complete When:**

1. ✅ **Zero String Comparisons** - No string literals used for enum comparisons
2. ✅ **All Tests Pass** - `yarn test` shows 100% passing
3. ✅ **Type Check Passes** - `yarn build` succeeds with no errors
4. ✅ **Code Review Complete** - Manual review confirms quality
5. ✅ **Documentation Updated** - This plan marked as complete

---

## Estimated Time

| Phase             | Tasks       | Time         | Status  |
| ----------------- | ----------- | ------------ | ------- |
| Phase 1: Audit    | 3           | 2 hours      | [ ]     |
| Phase 2: Refactor | 3           | 6-8 hours    | [ ]     |
| Phase 3: Verify   | 3           | 1 hour       | [ ]     |
| **Total**         | **9 tasks** | **9-11 hrs** | **[ ]** |

---

## Notes for AI Implementation

### **When Implementing This Plan:**

1. **Start with Audit** - Don't refactor until you know the full scope
2. **One File at a Time** - Refactor, test, commit pattern
3. **Preserve Behavior** - Only change string literals to enum values
4. **Watch for Edge Cases** - Some strings might be intentional (error messages, etc.)
5. **Update Tests Too** - Test files may also have string comparisons

### **Things to Watch For:**

- ❌ **Don't change:** Error message strings (these should stay as strings)
- ❌ **Don't change:** Log output strings (these are for display)
- ❌ **Don't change:** String literals in type definitions
- ✅ **Do change:** Comparison operations (`===`, `!==`, `switch/case`)
- ✅ **Do change:** Function parameters expecting enum values

---

## Example Refactoring Session

```bash
# 1. Run audit script
./scripts/find-enum-strings.sh > enum-audit.txt

# 2. Review results
cat enum-audit.txt

# 3. Pick first file to refactor
code packages/compiler/src/semantic/visitors/symbol-table-builder.ts

# 4. Make changes (replace strings with enums)

# 5. Test the specific file
clear && yarn test symbol-table-builder.test.ts

# 6. If pass, commit
git add packages/compiler/src/semantic/visitors/symbol-table-builder.ts
git commit -m "refactor(semantic): use SymbolKind enum instead of strings in symbol-table-builder"

# 7. Repeat for next file
```

---

## Future Prevention

### **Add ESLint Rule** (Future Enhancement)

Create custom ESLint rule to prevent string-based enum comparisons:

```javascript
// .eslintrc.js
rules: {
  'no-enum-string-compare': 'error'
}
```

This ensures future code uses proper enum values.

---

**Status**: Ready for implementation
**Next Step**: Run Phase 1 audit to identify all occurrences
