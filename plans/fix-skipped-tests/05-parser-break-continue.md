# Parser Break/Continue Fix: 2 Skipped Tests

> **Document**: 05-parser-break-continue.md
> **Parent**: [Index](00-index.md)

## Overview

The parser silently drops `break`/`continue` at module scope — no AST node is created
and no error is reported. The semantic analyzer never sees them, so no diagnostic is emitted.

## Current Behavior

```js
// At module level:
break;  // Parser silently drops — no error, no AST node
```

## Expected Behavior

The parser should recognize `break`/`continue` keywords at module level and either:
1. **Preferred**: Create an error node in the AST with a diagnostic
2. **Alternative**: Report a parser error and skip the statement

## Implementation Approach

1. In the parser's module-level declaration parsing (likely `modules.ts` or `statements.ts`),
   add a check for `BREAK` and `CONTINUE` token types
2. When encountered at module scope, emit a parser diagnostic like:
   `"'break' statement can only appear inside a loop"`
3. Consume the token(s) and continue parsing

## Affected Files

- `packages/compiler/src/parser/modules.ts` or `statements.ts` — add break/continue handling
- `packages/compiler/src/__tests__/semantic/edge-cases/control-flow/break-continue.test.ts` — unskip 2 tests

## Test Expectations

The 2 existing tests expect `getErrors(source).length > 0` when break/continue appears at module scope.
The error can come from either parser diagnostics or semantic analysis — both paths are checked.
