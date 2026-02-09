# Formatting & Quick Fixes

> **Document**: 09-formatting-quickfixes.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Document Formatting (`formatting.ts`)

### Formatting Rules

The formatter applies consistent style to Blend65 source files:

| Rule | Before | After |
|------|--------|-------|
| Indentation | Mixed tabs/spaces | 2 spaces (configurable) |
| Trailing whitespace | `let x = 5;   ` | `let x = 5;` |
| Blank line normalization | 3+ blank lines | Max 2 blank lines |
| Semicolons | Missing or extra | Correct per language spec |
| Brace style | Inconsistent | K&R style (opening on same line) |
| Operator spacing | `x=5+3` | `x = 5 + 3` |
| Comma spacing | `fn(a,b,c)` | `fn(a, b, c)` |
| Keyword spacing | `if(x)` | `if (x)` |
| Storage class spacing | `@zp  let` | `@zp let` |

### Implementation Strategy

Walk the cached token array and AST to reconstruct formatted output:

1. **Token-based formatting** — adjust spacing between tokens
2. **AST-based indentation** — use AST depth for indentation level
3. **Preserve comments** — never remove or reformat comment content
4. **Preserve blank lines** — keep intentional blank lines (collapse 3+ to 2)

### Configuration Options

```jsonc
{
  "blend65.format.indentSize": 2,
  "blend65.format.insertSpaceAfterKeyword": true,
  "blend65.format.insertSpaceAroundOperators": true,
  "blend65.format.maxBlankLines": 2
}
```

## Quick Fixes (`code-actions.ts`)

### Code Action Triggers

Code actions are offered when a diagnostic has a known quick fix:

| Diagnostic | Quick Fix | Action |
|------------|-----------|--------|
| Missing semicolon | "Add missing semicolon" | Insert `;` at end of statement |
| Unused variable | "Remove unused variable" | Remove the declaration line |
| Unused import | "Remove unused import" | Remove the import item or entire import |
| Missing return type | "Add return type `:void`" | Append `: void` to function signature |
| Missing `export` on `main` | "Add `export` to `main`" | Prepend `export` keyword |
| Type mismatch (byte/word) | "Cast to byte" / "Cast to word" | Wrap expression with type hint |

### Implementation Pattern

```typescript
connection.onCodeAction((params: CodeActionParams): CodeAction[] => {
  const actions: CodeAction[] = [];
  
  for (const diagnostic of params.context.diagnostics) {
    // Match diagnostic code to known quick fixes
    if (diagnostic.code === 'MISSING_SEMICOLON') {
      actions.push({
        title: 'Add missing semicolon',
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [{
              range: { start: diagnostic.range.end, end: diagnostic.range.end },
              newText: ';'
            }]
          }
        }
      });
    }
  }
  
  return actions;
});
```

### Priority

Quick fixes are a **Phase 7** feature. The initial release focuses on diagnostics without fixes. Quick fixes will be added incrementally as common diagnostic patterns are identified.
