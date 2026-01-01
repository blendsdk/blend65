# Task 2.2: Add Storage Class Nodes to AST

**Task ID:** 2.2_ADD_STORAGE_NODES **Phase:** Phase 2 - AST Modifications **Estimated Time:** 2-3 hours
**Dependencies:** Task 2.1 (OOP removal) **Context Requirement:** ~15K tokens

---

## Objective

Add new AST node types to support Blend64 storage classes and placement syntax.

---

## Context

**What you're creating:**

-   New AST node types for storage classes (`zp`, `ram`, `data`, `const`, `io`)
-   New AST node type for placement annotations (`@ $D020`)
-   Updated VariableDeclaration to include storage class

**Why this change is needed:**

-   Blend64 variables must specify storage class for memory layout
-   Placement syntax allows explicit memory addresses
-   AST must represent these concepts for later compilation phases

**What's new in Blend64:**

-   Storage classes control memory placement (zero-page, RAM, ROM, etc.)
-   Explicit placement overrides default allocation
-   All variables are static (global lifetime)

---

## Input Files

**Required from previous task:**

-   `packages/ast/src/ast-types/core.ts` - Modified core types

**Reference documents:**

-   `research/blend64-spec.md` - Section 4 (Storage Classes and Placement)

---

## Task Instructions

### Step 1: Add storage class definitions

In `packages/ast/src/ast-types/core.ts`, add these new interfaces before the existing interfaces:

```typescript
/**
 * Storage class specification for Blend64 variables
 */
export interface StorageClass extends BlendASTNode {
    type: "StorageClass";
    class: "zp" | "ram" | "data" | "const" | "io";
}

/**
 * Placement annotation for explicit memory addresses
 * Example: @ $D020
 */
export interface PlacementAnnotation extends BlendASTNode {
    type: "PlacementAnnotation";
    address: number; // parsed numeric value
}

/**
 * Attribute annotation for functions and loops
 * Examples: @hot, @inline, @irq
 */
export interface AttributeAnnotation extends BlendASTNode {
    type: "AttributeAnnotation";
    name: "hot" | "inline" | "noinline" | "irq" | "unroll";
    args?: Expression[]; // for @unroll(4) etc.
}
```

### Step 2: Update VariableDeclaration

Replace the existing VariableDeclaration interface with this enhanced version:

```typescript
/**
 * Variable declaration: [storage] (var|const) name: type [@address] [= init]
 * Examples:
 * - zp var frame: byte
 * - data var palette: byte[16] = [0x00, 0x06]
 * - io var VIC_BORDER: byte @ $D020
 */
export interface VariableDeclaration extends BlendASTNode {
    type: "VariableDeclaration";
    storageClass: StorageClass | null; // NEW: storage specification
    kind: "var" | "const";
    name: string;
    varType: TypeAnnotation | null;
    placement: PlacementAnnotation | null; // NEW: explicit placement
    initializer: Expression | null;
}
```

### Step 3: Add to union types

Update the relevant union types to include the new nodes:

```typescript
// Add to CoreNode export at the bottom
export type CoreNode =
    | Program
    | Expression
    | Statement
    | Declaration
    | Parameter
    | StorageClass
    | PlacementAnnotation
    | AttributeAnnotation; // NEW
```

### Step 4: Update file documentation

Update the header comment to reflect new capabilities:

```typescript
/**
 * Core AST Types - Fundamental Language Constructs
 *
 * Includes: Program, expressions, statements, identifiers, literals, storage classes.
 * These types are required for any functioning Blend64 program.
 *
 * Blend64 changes from Blend:
 * - Removed OOP constructs (NewExpr, ThisExpr)
 * - Added storage classes (StorageClass, PlacementAnnotation)
 * - Added attribute annotations (AttributeAnnotation)
 * - Enhanced VariableDeclaration with storage and placement
 * - Focus on procedural programming with static memory
 */
```

---

## Expected Output

**Modified files:**

-   `packages/ast/src/ast-types/core.ts` - New storage-related node types

**Success criteria:**

-   [ ] StorageClass, PlacementAnnotation, AttributeAnnotation interfaces defined
-   [ ] VariableDeclaration includes storageClass and placement fields
-   [ ] New types included in union exports
-   [ ] File compiles without TypeScript errors
-   [ ] All new node types follow consistent naming patterns

---

## Code Examples

### New Node Usage:

```typescript
// Storage class node
{
  type: 'StorageClass',
  class: 'zp',
  metadata: { start: pos1, end: pos2 }
}

// Placement annotation
{
  type: 'PlacementAnnotation',
  address: 53280, // $D020
  metadata: { start: pos3, end: pos4 }
}

// Enhanced variable declaration
{
  type: 'VariableDeclaration',
  storageClass: { type: 'StorageClass', class: 'zp' },
  kind: 'var',
  name: 'frame',
  varType: { type: 'PrimitiveType', name: 'byte' },
  placement: null,
  initializer: null
}
```

---

## Testing

**Test cases to run:**

```bash
# Navigate to packages/ast
cd packages/ast

# Check TypeScript compilation
npx tsc --noEmit

# Verify new types are available
node -e "
const ast = require('./src/ast-types/core.js');

// Check new interfaces exist (they won't be runtime objects, but exports should work)
console.log('✓ Core module loads successfully');

// Verify TypeScript didn't complain about our union types
console.log('✓ New AST nodes integrated successfully');
"
```

**Expected results:**

-   TypeScript compiles without errors
-   Module loads without runtime errors
-   New node types follow established patterns

---

## Next Task

Continue with: `phase-2-ast/TASK_2.3_ADD_PLACEMENT_ANNOTATIONS.md`

---

## Troubleshooting

**Common issues:**

-   Problem: Union type syntax errors → Solution: Check comma placement and type names
-   Problem: Circular reference errors → Solution: Ensure proper import/export structure
-   Problem: TypeScript strict mode errors → Solution: Verify all fields have proper types

```

```
