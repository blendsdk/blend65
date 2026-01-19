# Codebase Refactoring Report

> **Generated:** 18/01/2026
> **Analysis Based On:** `plans/refactore.md` and `.clinerules/code.md`
> **Status:** Issues Identified - Refactoring Required

---

## Executive Summary

This report identifies code quality issues that violate the coding standards defined in `code.md` (Rules 22-24). The issues fall into three categories:

| Category | Files Affected | Total Violations |
|----------|---------------|-----------------|
| Inline Dynamic Imports | 2 files | 5 instances |
| constructor.name Comparisons | 0 files | 0 instances ✅ |
| Hardcoded String Type Comparisons | 7 files | 41+ instances |

**Total Refactoring Needed:** 46+ code locations across 9 files

---

## Issue Category 1: Inline Dynamic Imports (Rule 22 Violation)

### Problem
Using inline import expressions like `import('../path').Type` instead of proper import statements at the top of files.

### ❌ Wrong Pattern:
```typescript
function example(expr: import('../ast/base.js').Expression): void
```

### ✅ Correct Pattern:
```typescript
import type { Expression } from '../ast/base.js';
function example(expr: Expression): void
```

### Files Requiring Changes:

#### 1. `packages/compiler/src/__tests__/semantic/analysis/m6502-hints.test.ts`
**Violations: 2**

```typescript
// Line ~XX: Inline import for AccessPatternInfo
const info: import('../../../semantic/analysis/m6502-hints.js').AccessPatternInfo = {

// Line ~XX: Another inline import for AccessPatternInfo
const info: import('../../../semantic/analysis/m6502-hints.js').AccessPatternInfo = {
```

**Fix:** Add proper import at top of file:
```typescript
import type { AccessPatternInfo } from '../../../semantic/analysis/m6502-hints.js';
```

---

#### 2. `packages/compiler/src/semantic/analysis/hardware/c64/c64-hardware-analyzer.ts`
**Violations: 3**

```typescript
// Function parameter with inline import
funcDecl: import('../../../../ast/nodes.js').FunctionDecl,

// Another function parameter with inline import
funcDecl: import('../../../../ast/nodes.js').FunctionDecl,

// Return type with inline import
protected createDefaultLocation(): import('../../../../ast/base.js').SourceLocation {
```

**Fix:** Add proper imports at top of file:
```typescript
import type { FunctionDecl } from '../../../../ast/nodes.js';
import type { SourceLocation } from '../../../../ast/base.js';
```

---

## Issue Category 2: constructor.name Comparisons (Rule 23 Violation)

### Status: ✅ NO VIOLATIONS FOUND

The codebase correctly avoids using `constructor.name` for type checking.

---

## Issue Category 3: Hardcoded String Type Comparisons (Rule 24 Violation)

### Problem
Using hardcoded string literals like `'VariableDecl'` or `'FunctionDecl'` for AST node type checks instead of using:
- `ASTNodeType` enum from `ast/base.ts`
- Type guard functions from `ast/type-guards.ts` (preferred)

### ❌ Wrong Patterns:
```typescript
if (stmt.getNodeType() === 'VariableDecl') { ... }
if (nodeType === 'IfStatement') { ... }
if (funcDecl.getNodeType() === 'FunctionDecl') { ... }
```

### ✅ Correct Patterns:
```typescript
// Option 1: Using ASTNodeType enum
import { ASTNodeType } from '../ast/base.js';
if (stmt.getNodeType() === ASTNodeType.VARIABLE_DECL) { ... }

// Option 2: Using type guards (PREFERRED - enables type narrowing)
import { isVariableDecl, isFunctionDecl } from '../ast/type-guards.js';
if (isVariableDecl(stmt)) { ... }
if (isFunctionDecl(funcDecl)) { ... }
```

### Files Requiring Changes:

#### 1. `packages/compiler/src/semantic/analysis/definite-assignment.ts`
**Violations: 4**

```typescript
if (stmtType === 'IfStatement') { ... }
if (stmtType === 'WhileStatement') { ... }
if (stmtType === 'ForStatement') { ... }
if (stmtType === 'ReturnStatement') { ... }
```

**Recommended Fix:** Use type guards for type narrowing:
```typescript
import { isIfStatement, isWhileStatement, isForStatement, isReturnStatement } from '../../../ast/type-guards.js';

if (isIfStatement(statement)) { ... }
if (isWhileStatement(statement)) { ... }
if (isForStatement(statement)) { ... }
if (isReturnStatement(statement)) { ... }
```

---

#### 2. `packages/compiler/src/semantic/analysis/constant-propagation.ts`
**Violations: 7**

```typescript
if (nodeType === 'LiteralExpression') { ... }
if (nodeType === 'IdentifierExpression') { ... }
if (nodeType === 'BinaryExpression') { ... }
if (nodeType === 'UnaryExpression') { ... }
if (nodeType === 'BinaryExpression' || nodeType === 'UnaryExpression') { ... }
if (nodeType === 'IfStatement' || nodeType === 'WhileStatement') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import { 
  isLiteralExpression, isIdentifierExpression, 
  isBinaryExpression, isUnaryExpression,
  isIfStatement, isWhileStatement 
} from '../../../ast/type-guards.js';

if (isLiteralExpression(expr)) { ... }
if (isIdentifierExpression(expr)) { ... }
if (isBinaryExpression(expr)) { ... }
if (isUnaryExpression(expr)) { ... }
```

---

#### 3. `packages/compiler/src/semantic/visitors/type-checker/statements.ts`
**Violations: 4**

```typescript
if (nodeType === 'LiteralExpression' || nodeType === 'ArrayLiteralExpression') { ... }
if (nodeType === 'IdentifierExpression') { ... }
if (nodeType === 'BinaryExpression') { ... }
if (nodeType === 'UnaryExpression') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import {
  isLiteralExpression, isArrayLiteralExpression,
  isIdentifierExpression, isBinaryExpression, isUnaryExpression
} from '../../../../ast/type-guards.js';
```

---

#### 4. `packages/compiler/src/__tests__/semantic/alias-analysis.test.ts`
**Violations: 2**

```typescript
if (node.getNodeType && node.getNodeType() === 'IdentifierExpression') { ... }
const funcDecl = ast.declarations.find((d: any) => d.getNodeType() === 'FunctionDecl');
```

**Recommended Fix:** Use type guards:
```typescript
import { isIdentifierExpression, isFunctionDecl } from '../../../ast/type-guards.js';

if (isIdentifierExpression(node)) { ... }
const funcDecl = ast.declarations.find((d) => isFunctionDecl(d));
```

---

#### 5. `packages/compiler/src/__tests__/parser/elseif.test.ts`
**Violations: 3**

```typescript
if (elseBranch && elseBranch[0].getNodeType() === 'IfStatement') { ... }
if (elseBranch && elseBranch[0].getNodeType() === 'IfStatement') { ... }
if (elseBranch[0].getNodeType() === 'IfStatement') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import { isIfStatement } from '../../../ast/type-guards.js';

if (elseBranch && isIfStatement(elseBranch[0])) { ... }
```

---

#### 6. `packages/compiler/src/__tests__/semantic/analysis/escape-analysis.test.ts`
**Violations: 16**

Multiple instances of:
```typescript
if (funcDecl.getNodeType() === 'FunctionDecl') { ... }
if (testFunc.getNodeType() === 'FunctionDecl') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import { isFunctionDecl } from '../../../../ast/type-guards.js';

if (isFunctionDecl(funcDecl)) { ... }
if (isFunctionDecl(testFunc)) { ... }
```

---

#### 7. `packages/compiler/src/__tests__/semantic/analysis/definite-assignment.test.ts`
**Violations: 3**

```typescript
if (functionDecl.getNodeType() === 'FunctionDecl') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import { isFunctionDecl } from '../../../../ast/type-guards.js';

if (isFunctionDecl(functionDecl)) { ... }
```

---

#### 8. `packages/compiler/src/__tests__/semantic/analysis/constant-propagation.test.ts`
**Violations: 2**

```typescript
if (node.getNodeType && node.getNodeType() === 'VariableDecl') { ... }
```

**Recommended Fix:** Use type guards:
```typescript
import { isVariableDecl } from '../../../../ast/type-guards.js';

if (isVariableDecl(node)) { ... }
```

---

## Refactoring Priority

### Phase 1: Production Code (High Priority)
Files in `packages/compiler/src/semantic/` - These affect actual compiler behavior:

| File | Priority | Violations |
|------|----------|------------|
| `analysis/definite-assignment.ts` | 🔴 High | 4 |
| `analysis/constant-propagation.ts` | 🔴 High | 7 |
| `visitors/type-checker/statements.ts` | 🔴 High | 4 |
| `analysis/hardware/c64/c64-hardware-analyzer.ts` | 🔴 High | 3 inline imports |

### Phase 2: Test Code (Medium Priority)
Files in `packages/compiler/src/__tests__/` - These improve test maintainability:

| File | Priority | Violations |
|------|----------|------------|
| `semantic/analysis/escape-analysis.test.ts` | 🟡 Medium | 16 |
| `semantic/analysis/definite-assignment.test.ts` | 🟡 Medium | 3 |
| `semantic/analysis/constant-propagation.test.ts` | 🟡 Medium | 2 |
| `semantic/alias-analysis.test.ts` | 🟡 Medium | 2 |
| `parser/elseif.test.ts` | 🟡 Medium | 3 |
| `semantic/analysis/m6502-hints.test.ts` | 🟡 Medium | 2 inline imports |

---

## ASTNodeType Enum Reference

For reference, here are the available enum values that should be used instead of string literals:

```typescript
// From packages/compiler/src/ast/base.ts
export enum ASTNodeType {
  // Program Structure
  PROGRAM = 'Program',
  MODULE = 'Module',
  
  // Declarations
  IMPORT_DECL = 'ImportDecl',
  EXPORT_DECL = 'ExportDecl',
  FUNCTION_DECL = 'FunctionDecl',
  VARIABLE_DECL = 'VariableDecl',
  TYPE_DECL = 'TypeDecl',
  ENUM_DECL = 'EnumDecl',
  
  // @map Declarations
  SIMPLE_MAP_DECL = 'SimpleMapDecl',
  RANGE_MAP_DECL = 'RangeMapDecl',
  SEQUENTIAL_STRUCT_MAP_DECL = 'SequentialStructMapDecl',
  EXPLICIT_STRUCT_MAP_DECL = 'ExplicitStructMapDecl',
  
  // Expressions
  BINARY_EXPR = 'BinaryExpression',
  UNARY_EXPR = 'UnaryExpression',
  LITERAL_EXPR = 'LiteralExpression',
  IDENTIFIER_EXPR = 'IdentifierExpression',
  CALL_EXPR = 'CallExpression',
  INDEX_EXPR = 'IndexExpression',
  MEMBER_EXPR = 'MemberExpression',
  ASSIGNMENT_EXPR = 'AssignmentExpression',
  ARRAY_LITERAL_EXPR = 'ArrayLiteralExpression',
  
  // Statements
  RETURN_STMT = 'ReturnStatement',
  IF_STMT = 'IfStatement',
  WHILE_STMT = 'WhileStatement',
  FOR_STMT = 'ForStatement',
  MATCH_STMT = 'MatchStatement',
  BREAK_STMT = 'BreakStatement',
  CONTINUE_STMT = 'ContinueStatement',
  EXPR_STMT = 'ExpressionStatement',
  BLOCK_STMT = 'BlockStatement',
}
```

---

## Available Type Guards

For reference, here are the type guards available in `packages/compiler/src/ast/type-guards.ts`:

```typescript
// Base type guards
isExpression(node): node is Expression
isStatement(node): node is Statement
isDeclaration(node): node is Declaration

// Program structure
isProgram(node): node is Program
isModuleDecl(node): node is ModuleDecl

// Import/Export
isImportDecl(node): node is ImportDecl
isExportDecl(node): node is ExportDecl

// Declarations
isFunctionDecl(node): node is FunctionDecl
isVariableDecl(node): node is VariableDecl
isTypeDecl(node): node is TypeDecl
isEnumDecl(node): node is EnumDecl

// Expressions
isBinaryExpression(node): node is BinaryExpression
isUnaryExpression(node): node is UnaryExpression
isLiteralExpression(node): node is LiteralExpression
isIdentifierExpression(node): node is IdentifierExpression
isCallExpression(node): node is CallExpression
isIndexExpression(node): node is IndexExpression
isMemberExpression(node): node is MemberExpression
isAssignmentExpression(node): node is AssignmentExpression
isArrayLiteralExpression(node): node is ArrayLiteralExpression

// Statements
isReturnStatement(node): node is ReturnStatement
isIfStatement(node): node is IfStatement
isWhileStatement(node): node is WhileStatement
isForStatement(node): node is ForStatement
isMatchStatement(node): node is MatchStatement
isBreakStatement(node): node is BreakStatement
isContinueStatement(node): node is ContinueStatement
isExpressionStatement(node): node is ExpressionStatement
isBlockStatement(node): node is BlockStatement

// @map declarations
isSimpleMapDecl(node): node is SimpleMapDecl
isRangeMapDecl(node): node is RangeMapDecl
isSequentialStructMapDecl(node): node is SequentialStructMapDecl
isExplicitStructMapDecl(node): node is ExplicitStructMapDecl

// Convenience groups
isMapDecl(node): node is SimpleMapDecl | RangeMapDecl | ...
isLoopStatement(node): node is WhileStatement | ForStatement
```

---

## Next Steps

1. ✅ Report generated
2. ✅ User review of findings
3. ✅ Phase 1: Fix production code files (4 files) - **COMPLETED 18/01/2026**
   - `definite-assignment.ts` - 4 string comparisons → type guards
   - `constant-propagation.ts` - 7 string comparisons → type guards
   - `statements.ts` - 4 string comparisons → type guards
   - `c64-hardware-analyzer.ts` - 3 inline imports → proper imports
4. ✅ Phase 2: Fix test code files (6 files) - **COMPLETED 18/01/2026**
   - `escape-analysis.test.ts` - 16 string comparisons → type guards
   - `definite-assignment.test.ts` - 3 string comparisons → type guards
   - `constant-propagation.test.ts` - 2 string comparisons → type guards
   - `alias-analysis.test.ts` - 2 string comparisons → type guards
   - `elseif.test.ts` - 3 string comparisons → type guards
   - `m6502-hints.test.ts` - 2 inline imports → proper imports
5. ✅ Run full test suite to verify no regressions - **2428 tests pass (after Phase 2)**
6. ⏳ Update `code.md` if any new patterns are discovered

---

## Compliance Status After Refactoring

Once all changes are applied:
- ✅ Rule 22: No inline dynamic imports
- ✅ Rule 23: No constructor.name comparisons
- ✅ Rule 24: No hardcoded string type comparisons