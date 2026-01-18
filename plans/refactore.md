## CRITICAL: Refactore Code Base

**NO inline imports** - refactore inline imports like `import('../../../semantic/analysis/m6502-hints.js').AccessPatternInfo` to proper import at the top of .ts files - update the code.md to follow this critical rule strictly

**NO constructor.name == `...`** - refactore constructor.name evaluations to proper `instanceof` in typescript - update the code.md to follow this critical rule strictly

**NO hardcoded string comparison** - refactore card coded string comparisons like `if (stmt.getNodeType() === 'VariableDecl') {` to their proper enum or constant types (ASTNodeType) - search and fix any / all patterns alike and do proper refactoring - update the code.md to follow this critical rule strictly

---

## Progress Tracker (Updated 18/01/2026)

###  Completed

**Phase 4: code.md Updated**
- Added Rule 22: No Inline Dynamic Imports for Types
- Added Rule 23: No constructor.name Comparisons  
- Added Rule 24: No Hardcoded String Type Comparisons

**Phase 1: Inline Imports (Partial)**
-  `m6502-hints.ts` - Fixed 2 inline imports ’ proper top-level imports

**Phase 2: constructor.name (Partial)**
-  `m6502-hints.ts` - Fixed 7 instances ’ type guards (isVariableDecl, isSimpleMapDecl, etc.)

**Verification:**
- All 1955 tests passing 

---

### L Remaining Work

**Phase 1: Inline Imports (2 remaining)**
- [ ] `m6502-hints.test.ts` - 2 instances of `import('../../../semantic/analysis/m6502-hints.js').AccessPatternInfo`

**Phase 2: constructor.name (49+ remaining)**
Files requiring refactoring:
- [ ] `parser.ts` - 1 instance
- [ ] `analyzer.ts` - 3 instances
- [ ] `memory-layout.ts` - 4 instances
- [ ] `import-resolver.ts` - 2 instances
- [ ] `call-graph.ts` - 3 instances
- [ ] `loop-analysis.ts` - **44+ instances** (MAJOR - largest file)
- [ ] `tier3-integration.test.ts` - 2 instances

**Phase 3: getNodeType() string comparisons (59 remaining)**
Files requiring refactoring:
- [ ] `constant-propagation.ts` - 10+ instances
- [ ] `liveness.ts` - 8+ instances
- [ ] `reaching-definitions.ts` - 6+ instances
- [ ] `definite-assignment.ts` - 3 instances
- [ ] `dead-code.ts` - 3 instances
- [ ] `variable-usage.ts` - 1 instance
- [ ] `unused-functions.ts` - 1 instance
- [ ] Test files - 20+ instances (escape-analysis.test.ts, alias-analysis.test.ts, etc.)

---

## Quick Reference: Correct Patterns

### Inline Imports
```typescript
// L WRONG
function foo(expr: import('../ast/base.js').Expression): void

//  CORRECT
import type { Expression } from '../ast/base.js';
function foo(expr: Expression): void
```

### constructor.name
```typescript
// L WRONG
if (decl.constructor.name === 'VariableDecl')

//  CORRECT - use type guards
import { isVariableDecl } from '../ast/type-guards.js';
if (isVariableDecl(decl))

//  CORRECT - use instanceof
if (decl instanceof VariableDecl)
```

### getNodeType() String Comparison
```typescript
// L WRONG
if (stmt.getNodeType() === 'VariableDecl')

//  CORRECT - use ASTNodeType enum
import { ASTNodeType } from '../ast/base.js';
if (stmt.getNodeType() === ASTNodeType.VARIABLE_DECL)

//  BEST - use type guards (enables type narrowing)
import { isVariableDecl } from '../ast/type-guards.js';
if (isVariableDecl(stmt))
```

---

## Estimated Remaining Effort

- Phase 1 remaining: ~30 minutes
- Phase 2 remaining: ~5-6 hours (loop-analysis.ts alone is ~4 hours)
- Phase 3 remaining: ~6-8 hours
- Total: ~12-15 hours