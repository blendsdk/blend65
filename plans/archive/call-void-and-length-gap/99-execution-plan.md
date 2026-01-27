# Execution Plan: CALL_VOID Bug and length() String Support

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases and AI chat sessions for implementation.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Investigation & Fix | 1 | 30-45 min |

**Total: 1 session, ~30-45 minutes**

---

## Phase 1: Investigation and Fix

### Session 1.1: Implement Both Fixes

**Reference**: [03-call-void-fix.md](03-call-void-fix.md), [04-length-string.md](04-length-string.md)

**Objective**: Fix CALL_VOID bug and add string literal support to length()

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Investigate CALL_VOID root cause | `expressions.ts` |
| 1.1.2 | Fix CALL/CALL_VOID selection logic | `expressions.ts` |
| 1.1.3 | Add string literal support to length() | `expressions.ts` |
| 1.1.4 | Unskip and verify ternary test | `generator-expressions-ternary.test.ts` |
| 1.1.5 | Unskip and verify length() test | `type-acceptance.test.ts` |
| 1.1.6 | Run full test suite | - |

**Deliverables**:

- [ ] CALL_VOID bug fixed
- [ ] length("string") working
- [ ] Both skipped tests passing
- [ ] All existing tests passing

**Verify**: `./compiler-test`

---

## Task Checklist (All Phases)

### Phase 1: Investigation and Fix

- [x] 1.1.1 Investigate CALL_VOID root cause (add debug logging) ✅
- [x] 1.1.2 Fix CALL/CALL_VOID selection logic in generateCallExpression ✅
- [x] 1.1.3 Add string literal support to generateLengthIntrinsic ✅
- [x] 1.1.4 Unskip ternary test in generator-expressions-ternary.test.ts ✅
- [x] 1.1.5 Unskip length() test in type-acceptance.test.ts ✅
- [x] 1.1.6 Run full test suite and verify no regressions ✅

---

## Session Protocol

### Starting a Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 1, Session 1.1 per plans/call-void-and-length-gap/99-execution-plan.md"
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

### Task 1.1.1: Investigate CALL_VOID Root Cause

1. Add temporary console.log in `generateCallExpression`:
   ```typescript
   console.log('CALL lookup:', funcName, funcSymbol, funcSymbol?.type, funcSymbol?.type?.signature);
   ```
2. Run the failing test to see output
3. Determine if issue is symbol lookup or signature population

### Task 1.1.2: Fix CALL/CALL_VOID Selection

Based on investigation, apply one of these fixes:

**Option A**: Add IL function fallback lookup
```typescript
if (!funcSymbol?.type?.signature) {
  const ilFunc = this.module.getFunction(funcName);
  if (ilFunc && !ilFunc.isVoid()) {
    return this.builder?.emitCall(funcName, argRegs, ilFunc.getReturnType()) ?? null;
  }
}
```

**Option B**: Fix symbol table registration (if that's the root cause)

### Task 1.1.3: Add String Literal Support

Add before identifier handling in `generateLengthIntrinsic`:
```typescript
if (arg.getNodeType() === ASTNodeType.LITERAL_EXPR) {
  const literal = arg as LiteralExpression;
  const value = literal.getValue();
  if (typeof value === 'string') {
    return this.builder?.emitConstWord(value.length) ?? null;
  }
  this.addError('length() requires a string literal or array variable', ...);
  return null;
}
```

### Task 1.1.4: Unskip Ternary Test

Change `it.skip` to `it`:
```typescript
// In generator-expressions-ternary.test.ts
it('should generate ternary for function argument', () => {
  // ... test code ...
});
```

### Task 1.1.5: Unskip length() Test

Change `it.skip` to `it`:
```typescript
// In type-acceptance.test.ts
it('should accept length() with string literal', () => {
  // ... test code ...
});
```

---

## Dependencies

```
Task 1.1.1 (Investigate)
    ↓
Task 1.1.2 (Fix CALL_VOID)
    ↓
Task 1.1.3 (Fix length())
    ↓
Tasks 1.1.4, 1.1.5 (Unskip tests)
    ↓
Task 1.1.6 (Verify)
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ CALL_VOID bug fixed (non-void functions use CALL)
2. ✅ length("string") works correctly
3. ✅ Both previously skipped tests pass
4. ✅ All existing tests pass (no regressions)
5. ✅ Code is documented with JSDoc comments

---

## Quick Start

To execute this plan, start a new session and say:

> "Execute plans/call-void-and-length-gap/99-execution-plan.md Session 1.1"

Or use the trigger:

> "exec_plan call-void-and-length-gap"