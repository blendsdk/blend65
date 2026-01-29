# Semantic Fixes: Member Access Resolution

> **Document**: 03-semantic-fixes.md
> **Parent**: [Index](00-index.md)

## Overview

Fix the semantic analyzer to properly resolve member access expressions like `vic.borderColor`. Currently shows "type unknown" because member types aren't resolved from imported modules.

## Architecture

### Current Architecture

The semantic analyzer handles member expressions but doesn't fully resolve types for imported module members:

```typescript
// Current behavior (simplified)
visitMemberExpression(node: MemberExpression) {
  const objectType = this.resolveType(node.object);
  if (objectType.kind === 'unknown') {
    this.error("Member access is not yet fully implemented...");
  }
}
```

### Proposed Changes

1. Resolve the object's type from symbol table (including imported symbols)
2. Look up the member in the object's type definition
3. Return the member's type instead of 'unknown'

## Implementation Details

### Step 1: Trace Member Resolution Path

Find where member access fails:

```typescript
// In semantic/analyzer.ts or member-expression-analyzer.ts
visitMemberExpression(node: MemberExpression): Type {
  // 1. Resolve the object (e.g., 'vic')
  const objectType = this.visit(node.object);
  
  // 2. Get member name (e.g., 'borderColor')
  const memberName = node.property.name;
  
  // 3. Look up member in object's type
  if (objectType.kind === 'module' || objectType.kind === 'namespace') {
    const memberSymbol = this.lookupModuleMember(objectType, memberName);
    if (memberSymbol) {
      return memberSymbol.type;  // Return actual type!
    }
  }
  
  // 4. Handle @map declarations as struct-like members
  if (objectType.members?.has(memberName)) {
    return objectType.members.get(memberName).type;
  }
}
```

### Step 2: Handle Import Resolution

Ensure imported symbols resolve to their full type:

```typescript
// When resolving 'vic' identifier
lookupSymbol(name: string): Symbol {
  // Check local scope
  const local = this.currentScope.lookup(name);
  if (local) return local;
  
  // Check imported modules
  for (const import of this.imports) {
    if (import.name === name || import.exports.has(name)) {
      return this.resolveImportedSymbol(import, name);
    }
  }
}
```

### Step 3: Handle @map Member Access

For modules with @map declarations, members should resolve:

```blend
// In imported module
@map borderColor at $D020: byte;  // Export this

// In user code  
vic.borderColor = 0;  // Should resolve to byte type
```

## Code Examples

### Example 1: Before Fix

```blend
// hardware.blend imports vic module
vic.borderColor = COLOR_BLACK;  // Error: type unknown
```

### Example 2: After Fix

```blend
// hardware.blend imports vic module
vic.borderColor = COLOR_BLACK;  // Works: byte = byte
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Unknown member | Error: "Property 'X' does not exist on type 'Y'" |
| Wrong type assignment | Error: "Type mismatch in assignment" |
| Non-object member access | Error: "Cannot access property of non-object type" |

## Testing Requirements

- Unit tests for member expression type resolution
- Tests for imported module member access
- Tests for @map declaration member access
- Tests for error messages on invalid member access

## Files to Modify

| File | Changes |
|------|---------|
| `semantic/analyzer.ts` | Main member expression handling |
| `semantic/types.ts` | Module/namespace type with members |
| `semantic/symbol-table.ts` | Imported symbol lookup |

## Dependencies

- Symbol table must have imported modules registered
- Type system must support module/namespace types with members