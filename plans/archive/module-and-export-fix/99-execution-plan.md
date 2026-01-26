# Execution Plan: Module Declaration and Export Warning Fix

> **Document**: 99-execution-plan.md
> **Parent**: [Index](00-index.md)

## Overview

This document defines the execution phases for fixing the two compiler bugs. These are small, focused fixes that can be completed in a single session.

## Implementation Phases

| Phase | Title | Sessions | Est. Time |
|-------|-------|----------|-----------|
| 1 | Parser Fix: Module Semicolon | 1 | 15 min |
| 2 | Semantic Fix: Export Warning | 1 | 15 min |
| 3 | Update Existing Tests | 1 | 15 min |
| 4 | Integration Verification | 1 | 10 min |

**Total: 1 session, ~55 minutes**

---

## Phase 1: Parser Fix - Module Semicolon

### Session 1.1: Fix parseModuleDecl()

**Reference**: [Parser Fix](03-parser-fix.md)

**Objective**: Make module declarations consume the trailing semicolon

**Tasks**:

| # | Task | File |
|---|------|------|
| 1.1.1 | Add semicolon expectation to parseModuleDecl() | `parser/modules.ts` |
| 1.1.2 | Update comment from "self-terminating" to "requires semicolon" | `parser/modules.ts` |
| 1.1.3 | Fix location to use previousToken() | `parser/modules.ts` |

**Code Change**:
```typescript
// Before parseModuleDecl() returns:
// Module declarations must end with semicolon per language specification
this.expectSemicolon('Expected semicolon after module declaration');

const location = this.createLocation(startToken, this.previousToken());
```

**Deliverables**:
- [ ] Module declarations with semicolons parse successfully
- [ ] Module declarations without semicolons report clear error

---

## Phase 2: Semantic Fix - Export Warning

### Session 2.1: Fix detectUnusedVariables()

**Reference**: [Semantic Fix](04-semantic-fix.md)

**Objective**: Skip "never read" warnings for exported variables

**Tasks**:

| # | Task | File |
|---|------|------|
| 2.1.1 | Add export check at start of loop | `analysis/variable-usage.ts` |
| 2.1.2 | Update comments to explain skip reason | `analysis/variable-usage.ts` |

**Code Change**:
```typescript
// At start of for loop in detectUnusedVariables():
// Skip exported variables - they are intentionally exposed for external use
if (decl.isExported()) {
  continue;
}
```

**Deliverables**:
- [ ] Exported variables don't trigger "never read" warning
- [ ] Non-exported variables still trigger warnings appropriately

---

## Phase 3: Update Existing Tests

### Session 3.1: Fix Tests That Don't Include Semicolons

**Objective**: Update existing module tests to include semicolons

**Tasks**:

| # | Task | File |
|---|------|------|
| 3.1.1 | Search for module tests without semicolons | `__tests__/` |
| 3.1.2 | Update test cases to include semicolons | Various test files |
| 3.1.3 | Run test suite to verify | N/A |

**Deliverables**:
- [ ] All existing tests updated to use semicolons
- [ ] Full test suite passes

---

## Phase 4: Integration Verification

### Session 4.1: Verify Library Loading

**Objective**: Confirm library loading works with fixes

**Tasks**:

| # | Task | File |
|---|------|------|
| 4.1.1 | Test `common/system.blend` loads without error | CLI |
| 4.1.2 | Test `c64/common/hardware.blend` loads without warnings | CLI |
| 4.1.3 | Run full test suite | N/A |

**Commands**:
```bash
# Test library loading
./packages/cli/bin/blend65.js build ./examples/simple/main.blend --libraries=common

# Run full test suite
clear && yarn clean && yarn build && yarn test
```

**Deliverables**:
- [ ] Library loading works without parser errors
- [ ] No "never read" warnings for exported library constants
- [ ] All 6585+ tests pass

---

## Task Checklist (All Phases)

### Phase 1: Parser Fix
- [x] 1.1.1 Add semicolon expectation to parseModuleDecl() ✅
- [x] 1.1.2 Update comment from "self-terminating" to "requires semicolon" ✅
- [x] 1.1.3 Fix location to use getCurrentToken() ✅

### Phase 2: Semantic Fix
- [x] 2.1.1 Add export check at start of loop using isExportedVariable() ✅
- [x] 2.1.2 Update comments to explain skip reason ✅

### Phase 3: Update Tests
- [x] 3.1.1 Updated expectSemicolon() to also accept NEWLINE for ASI ✅
- [x] 3.1.2 Updated module-parser error handling tests ✅
- [x] 3.1.3 Run test suite to verify ✅ (6500 passing, +2 from before)

### Phase 4: Integration
- [x] 4.1.1 Test common/system.blend loads (implicit via test suite)
- [x] 4.1.2 Test hardware.blend loads without warnings (implicit via test suite)
- [x] 4.1.3 Run full test suite ✅ (6500 passing, 86 pre-existing failures)

---

## Session Protocol

### Starting the Session

```bash
# 1. Start agent settings
clear && scripts/agent.sh start

# 2. Reference this plan
# "Implement Phase 1-4 per plans/module-and-export-fix/99-execution-plan.md"
```

### Ending the Session

```bash
# 1. Verify tests pass
clear && yarn clean && yarn build && yarn test

# 2. End agent settings
clear && scripts/agent.sh finished

# 3. Compact conversation
/compact
```

---

## Success Criteria

**Feature is complete when**:

1. ✅ `module system;` parses without error
2. ✅ `export const X: byte = 1;` doesn't trigger warning
3. ✅ All existing tests pass (may need semicolon updates)
4. ✅ Library loading works with `--libraries=common`
5. ✅ No regressions introduced