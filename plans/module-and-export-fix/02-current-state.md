# Current State: Module Declaration and Export Warning Fix

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Bug 1: Parser Module Declaration Analysis

### Current Implementation

**File:** `packages/compiler/src/parser/modules.ts`

**Method:** `parseModuleDecl()` (lines 74-92)

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

  // Module declarations are self-terminating (no semicolon needed) <-- BUG: WRONG COMMENT
  const location = this.createLocation(startToken, this.getCurrentToken());

  return new ModuleDecl(namePath, location, false);
}
```

### Root Cause

The comment on line 88 states:
> "Module declarations are self-terminating (no semicolon needed)"

**This contradicts the language specification:**
```ebnf
module_decl = "module" , name , ";" ;
```

The parser does NOT call `expectSemicolon()` after parsing the module name, leaving the semicolon unconsumed. When the parser continues, it encounters the semicolon and reports P004 error.

### Fix Required

Add `this.expectSemicolon('Expected semicolon after module declaration');` before creating the location.

---

## Bug 2: Semantic Analyzer Export Warning Analysis

### Current Implementation

**File:** `packages/compiler/src/semantic/analysis/variable-usage.ts`

**Method:** `detectUnusedVariables()` (lines 120-143)

```typescript
protected detectUnusedVariables(): void {
  for (const [_name, info] of this.usageMap) {
    const decl = info.declaration;

    // Skip exported variables (they may be used by other modules)
    // Note: isExported is protected, so we skip this check for now  <-- BUG: TODO NOT DONE
    // Exported variables will be handled in future enhancement

    // Detect completely unused variables
    if (info.readCount === 0 && info.writeCount === 0) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.WARNING,
        message: `Variable '${info.name}' is declared but never used`,
        location: decl.getLocation(),
      });
    }
    // Detect write-only variables (written but never read)
    else if (info.writeCount > 0 && info.readCount === 0) {
      this.diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.WARNING,
        message: `Variable '${info.name}' is assigned but never read`,
        location: decl.getLocation(),
      });
    }
  }
}
```

### Root Cause

The comments on lines 125-127 indicate the intent to skip exported variables:
> "Skip exported variables (they may be used by other modules)"
> "Note: isExported is protected, so we skip this check for now"
> "Exported variables will be handled in future enhancement"

**The check was never implemented.** The code needs to check `decl.isExported()` and skip the warning.

### Fix Required

Add check before generating warnings:

```typescript
// Skip exported variables (they may be used by other modules)
if (decl.isExported()) {
  continue;
}
```

---

## Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `packages/compiler/src/parser/modules.ts` | Module parsing | Add semicolon expectation |
| `packages/compiler/src/semantic/analysis/variable-usage.ts` | Unused var detection | Add export check |
| `packages/compiler/src/__tests__/parser/modules.test.ts` | Parser tests | Add semicolon test cases |
| `packages/compiler/src/__tests__/semantic/variable-usage.test.ts` | Semantic tests | Add export test cases |

## Dependencies

Both bugs are independent and can be fixed in any order. However, fixing Bug 1 first allows immediate testing with the Library Loading System.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Existing tests break | Low | Medium | Run full test suite after each fix |
| Regression in module parsing | Low | High | Add explicit test cases for semicolon |
| Export check misses edge cases | Low | Low | Test with real library files |