# Parser Fix: Module Declaration Semicolon

> **Document**: 03-parser-fix.md
> **Parent**: [Index](00-index.md)

## Overview

This document details the fix for the module declaration semicolon parsing bug.

## Current Code

**File:** `packages/compiler/src/parser/modules.ts`

```typescript
protected parseModuleDecl(): ModuleDecl {
  this.validateModuleDeclaration(); // Check for duplicate

  const startToken = this.expect(TokenType.MODULE, "Expected 'module' keyword");

  // Parse module name path (e.g., Game.Main)
  const namePath: string[] = [];
  namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected module name').value);

  while (this.match(TokenType.DOT)) {
    namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after dot').value);
  }

  // Module declarations are self-terminating (no semicolon needed)  <-- WRONG
  const location = this.createLocation(startToken, this.getCurrentToken());

  return new ModuleDecl(namePath, location, false);
}
```

## Fixed Code

```typescript
protected parseModuleDecl(): ModuleDecl {
  this.validateModuleDeclaration(); // Check for duplicate

  const startToken = this.expect(TokenType.MODULE, "Expected 'module' keyword");

  // Parse module name path (e.g., Game.Main)
  const namePath: string[] = [];
  namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected module name').value);

  while (this.match(TokenType.DOT)) {
    namePath.push(this.expect(TokenType.IDENTIFIER, 'Expected identifier after dot').value);
  }

  // Module declarations must end with semicolon per language specification
  this.expectSemicolon('Expected semicolon after module declaration');

  const location = this.createLocation(startToken, this.previousToken());

  return new ModuleDecl(namePath, location, false);
}
```

## Changes Required

1. **Add semicolon expectation** - Call `this.expectSemicolon()` after parsing module name
2. **Update comment** - Change from "self-terminating" to "must end with semicolon"
3. **Fix location** - Use `this.previousToken()` instead of `this.getCurrentToken()` since semicolon is now consumed

## Implementation Details

### Line-by-Line Changes

```diff
-  // Module declarations are self-terminating (no semicolon needed)
+  // Module declarations must end with semicolon per language specification
+  this.expectSemicolon('Expected semicolon after module declaration');
+
-  const location = this.createLocation(startToken, this.getCurrentToken());
+  const location = this.createLocation(startToken, this.previousToken());
```

### Expected Behavior After Fix

| Input | Before Fix | After Fix |
|-------|------------|-----------|
| `module system;` | ERROR: Unexpected ';' | ✅ Parses successfully |
| `module Game.Main;` | ERROR: Unexpected ';' | ✅ Parses successfully |
| `module system` | ✅ Parsed (incorrectly) | ERROR: Expected semicolon |

## Testing Requirements

Add test cases in `packages/compiler/src/__tests__/parser/modules.test.ts`:

```typescript
describe('Module Declaration', () => {
  it('should parse module with semicolon', () => {
    const source = 'module system;';
    const result = parse(source);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.getModuleDecl().getNamePath()).toEqual(['system']);
  });

  it('should parse hierarchical module with semicolon', () => {
    const source = 'module Game.Main;';
    const result = parse(source);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.ast.getModuleDecl().getNamePath()).toEqual(['Game', 'Main']);
  });

  it('should report error for missing semicolon', () => {
    const source = 'module system\nlet x: byte = 1;';
    const result = parse(source);
    expect(result.diagnostics.some(d => d.message.includes('semicolon'))).toBe(true);
  });
});
```

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing tests | Run full test suite - fix tests that don't include semicolon |
| Location offset change | Use previousToken() to ensure correct span |