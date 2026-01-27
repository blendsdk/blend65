# Execution Plan: Array Return Types

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

**This is a simple, single-session fix.**

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Parser Fix + Tests | 1 | 15-20 min |

**Total: 1 session, ~15-20 minutes**

---

## Phase 1: Parser Fix + Tests

### Session 1.1: Implement Array Return Type Support

**Reference**: [Parser Changes](03-parser-changes.md)

**Objective**: Modify parser to accept array types as function return types

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Modify return type parsing to use `parseTypeAnnotation()` | `packages/compiler/src/parser/parser.ts` |
| 1.1.2 | Add unit tests for array return types | `packages/compiler/src/__tests__/parser/` |
| 1.1.3 | Run full test suite to verify no regressions | N/A |
| 1.1.4 | Update skipped test to unskip | `packages/compiler/src/__tests__/semantic/type-checker-assignments-complex.test.ts` |

**Deliverables**:

- [x] Parser accepts `byte[5]` as return type
- [x] Parser accepts `byte[]` as return type
- [x] Parser accepts `byte[2][3]` as return type
- [x] Existing simple return types still work
- [x] All tests passing

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Parser Fix + Tests

- [ ] 1.1.1 Modify `parseFunctionDecl()` to use `parseTypeAnnotation()` for return type
- [ ] 1.1.2 Add parser unit tests for array return types
- [ ] 1.1.3 Run full test suite - verify no regressions
- [ ] 1.1.4 Unskip the previously skipped test

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 1, Session 1.1 per plans/array-return-types/99-execution-plan.md"
```

### Ending a Session

```bash
# 1. Verify tests pass
./compiler-test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Implementation Details

### Task 1.1.1: Parser Modification

**File**: `packages/compiler/src/parser/parser.ts`

**Change**: In `parseFunctionDecl()`, replace the return type parsing block (~lines 298-314):

**Before**:
```typescript
// Parse optional return type
let returnType: string | null = null;
if (this.match(TokenType.COLON)) {
  if (
    this.check(
      TokenType.VOID,
      TokenType.BYTE,
      TokenType.WORD,
      TokenType.BOOLEAN,
      TokenType.STRING,
      TokenType.IDENTIFIER
    )
  ) {
    returnType = this.advance().value;
  } else {
    this.reportError(
      DiagnosticCode.EXPECTED_TOKEN,
      DeclarationParserErrors.expectedReturnType()
    );
  }
}
```

**After**:
```typescript
// Parse optional return type
// Uses parseTypeAnnotation() to handle full type expressions including arrays:
// - Simple types: byte, word, void, boolean, string, callback
// - Array types: byte[5], word[256]
// - Inferred arrays: byte[], word[]
// - Multidimensional: byte[2][3], byte[][]
let returnType: string | null = null;
if (this.match(TokenType.COLON)) {
  returnType = this.parseTypeAnnotation();
}
```

### Task 1.1.2: Test Addition

Add tests to verify:
1. Explicit array return type: `byte[5]`
2. Inferred array return type: `byte[]`
3. Multidimensional array: `byte[2][3]`
4. Regression: simple types still work

### Task 1.1.3: Full Test Run

```bash
./compiler-test
```

Ensure no regressions in:
- Parser tests
- Semantic tests
- E2E tests

### Task 1.1.4: Unskip Test

The test in `type-checker-assignments-complex.test.ts` that was skipped due to array return types should now pass - unskip it.

---

## Dependencies

```
Task 1.1.1 (Parser fix)
    ↓
Task 1.1.2 (Add tests)
    ↓
Task 1.1.3 (Full test run)
    ↓
Task 1.1.4 (Unskip test)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `function f(): byte[5]` parses without errors
2. ✅ `function f(): byte[]` parses without errors  
3. ✅ `function f(): byte[2][3]` parses without errors
4. ✅ Existing simple return types (`byte`, `word`, `void`) still work
5. ✅ All parser tests pass
6. ✅ Full test suite passes with no regressions
7. ✅ Previously skipped test is now passing