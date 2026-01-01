# Task 2.1: Remove OOP Nodes from AST

**Task ID:** 2.1_REMOVE_OOP_NODES
**Phase:** Phase 2 - AST Modifications
**Estimated Time:** 2-3 hours
**Dependencies:** Phase 1 complete
**Context Requirement:** ~15K tokens

---

## Objective

Remove object-oriented programming node types from the AST since Blend64 does not support classes, methods, or inheritance.

---

## Context

**What you're modifying:**
- `packages/ast/src/ast-types/oop.ts` - Remove entire file
- `packages/ast/src/ast-types/core.ts` - Remove OOP references
- `packages/ast/src/ast-types/index.ts` - Update exports

**Why this change is needed:**
- Blend64 has no classes, methods, or inheritance
- OOP constructs would never be used in Blend64 programs
- Simplifies AST and reduces memory usage

**What changes from original Blend:**
- Remove: ClassDeclaration, MethodDeclaration, PropertyDeclaration, ConstructorDeclaration
- Remove: NewExpr, ThisExpr from core expressions
- Keep: records (type declarations) as they become flat structs

---

## Input Files

**Required from blend-lang:**
- `/Users/gevik/workdir/blend-lang/packages/ast/src/ast-types/core.ts` - Core AST types
- `/Users/gevik/workdir/blend-lang/packages/ast/src/ast-types/oop.ts` - OOP types (to be removed)
- `/Users/gevik/workdir/blend-lang/packages/ast/src/ast-types/index.ts` - Main exports

**Reference documents:**
- `research/blend64-diff-from-blend.md` - Section 7 (Classes/OOP removed)

---

## Task Instructions

### Step 1: Copy source files
```bash
mkdir -p packages/ast/src/ast-types
cp /Users/gevik/workdir/blend-lang/packages/ast/src/ast-types/core.ts packages/ast/src/ast-types/
cp /Users/gevik/workdir/blend-lang/packages/ast/src/ast-types/index.ts packages/ast/src/ast-types/
# Note: Don't copy oop.ts - we're removing it
```

### Step 2: Remove OOP expressions from core.ts
In `packages/ast/src/ast-types/core.ts`, find the Expression union type and remove these types:

```typescript
// REMOVE these from the Expression union:
| NewExpr
| ThisExpr
```

### Step 3: Remove OOP expression interfaces
In the same file, remove these interface definitions completely:

```typescript
// REMOVE these entire interfaces:
export interface NewExpr extends BlendASTNode {
  type: 'NewExpr';
  callee: Expression;
  args: Expression[];
}

export interface ThisExpr extends BlendASTNode {
  type: 'ThisExpr';
}
```

### Step 4: Update index.ts exports
Modify `packages/ast/src/ast-types/index.ts` to remove OOP exports:

```typescript
// Remove this line:
// export * from './oop.js';

// Keep these:
export * from './core.js';
export * from './modules.js';
export * from './types.js';
```

### Step 5: Update core.ts comments
Add a comment explaining Blend64 differences:

```typescript
/**
 * Core AST Types - Fundamental Language Constructs
 *
 * Includes: Program, basic expressions, basic statements, identifiers, literals.
 * These types are required for any functioning Blend64 program.
 *
 * Blend64 changes from Blend:
 * - Removed OOP constructs (NewExpr, ThisExpr)
 * - Classes, methods, inheritance not supported
 * - Focus on procedural programming with records
 */
```

---

## Expected Output

**Modified files:**
- `packages/ast/src/ast-types/core.ts` - OOP expressions removed
- `packages/ast/src/ast-types/index.ts` - OOP exports removed

**Deleted files:**
- `packages/ast/src/ast-types/oop.ts` - Not copied (effectively removed)

**Success criteria:**
- [ ] NewExpr and ThisExpr removed from Expression union
- [ ] NewExpr and ThisExpr interfaces completely removed
- [ ] No imports or references to oop.ts remain
- [ ] File compiles without TypeScript errors
- [ ] Expression union type still includes all other expressions

---

## Code Examples

### Before (core.ts):
```typescript
export type Expression =
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | NewExpr        // REMOVE
  | ThisExpr       // REMOVE
  | Identifier
  | Literal;

export interface NewExpr extends BlendASTNode {
  type: 'NewExpr';
  callee: Expression;
  args: Expression[];
}

export interface ThisExpr extends BlendASTNode {
  type: 'ThisExpr';
}
```

### After (core.ts):
```typescript
export type Expression =
  | BinaryExpr
  | UnaryExpr
  | CallExpr
  | MemberExpr
  | Identifier
  | Literal;

// NewExpr and ThisExpr interfaces completely removed
```

---

## Testing

**Test cases to run:**
```bash
# Navigate to packages/ast
cd packages/ast

# Check TypeScript compilation
npx tsc --noEmit

# Verify no references to removed types
grep -r "NewExpr\|ThisExpr" src/ || echo "✓ OOP expressions successfully removed"

# Check exports are correct
node -e "
const ast = require('./src/index.js');
console.log('Available exports:', Object.keys(ast).sort());

// Verify OOP types don't exist
if (ast.NewExpr || ast.ThisExpr) {
  console.error('✗ OOP types still exported');
  process.exit(1);
} else {
  console.log('✓ OOP types successfully removed from exports');
}
"
```

**Expected results:**
- TypeScript compiles without errors
- No references to NewExpr or ThisExpr found
- Exports don't include OOP types
- Core expression types still available

---

## Next Task

Continue with: `phase-2-ast/TASK_2.2_ADD_STORAGE_NODES.md`

---

## Troubleshooting

**Common issues:**
- Problem: TypeScript errors about missing types → Solution: Check all references to NewExpr/ThisExpr are removed
- Problem: Expression union syntax error → Solution: Verify correct comma placement after removing types
- Problem: Import errors → Solution: Ensure oop.ts is not referenced anywhere
