# Task 8.14: Tier 3 Integration - Detailed Implementation Plan

> **Parent Plan**: [Phase 8 Part 3 - Tier 3](phase8-part3-tier3.md)
>
> **Total Effort**: 21 hours, 77+ tests
> **Prerequisites**: Tasks 8.8-8.13 complete (all Tier 3 analyzers)

---

## Overview

Task 8.14 integrates all Tier 3 analyses and adds two missing optimizations (GVN, CSE). This is broken into **6 subtasks** for manageable implementation.

---

## Subtask Breakdown

| Subtask | Description | Hours | Tests | Files |
|---------|-------------|-------|-------|-------|
| 8.14.1 | GVN Metadata Keys | 1 | 6 | optimization-metadata-keys.ts |
| 8.14.2 | Global Value Numbering | 6 | 15 | global-value-numbering.ts |
| 8.14.3 | CSE Metadata Keys | 0.5 | 4 | optimization-metadata-keys.ts |
| 8.14.4 | Common Subexpression Elimination | 5 | 12 | common-subexpr-elimination.ts |
| 8.14.5 | Orchestrator Update | 2 | 10 | advanced-analyzer.ts |
| 8.14.6 | Integration Tests | 6.5 | 30 | tier3-integration.test.ts |
| **Total** | | **21** | **77+** | |

---

## Task 8.14.1: GVN Metadata Keys (1 hour, 6 tests)

**Goal**: Add metadata keys for Global Value Numbering

**File**: `packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts`

**Keys to Add**:

```typescript
// ==========================================
// Global Value Numbering (Task 8.18)
// ==========================================

/** Value number assigned to expression (number) */
GVNNumber = 'GVNNumber',

/** This computation is redundant (boolean) */
GVNRedundant = 'GVNRedundant',

/** Variable that can replace this expression (string) */
GVNReplacement = 'GVNReplacement',
```

**Tests** (6):
1. GVNNumber key exists
2. GVNRedundant key exists  
3. GVNReplacement key exists
4. Keys have correct string values
5. Keys are unique (no duplicates)
6. Enum export works correctly

**Deliverables**:
- [ ] Add 3 GVN metadata keys to enum
- [ ] Add 6 tests

---

## Task 8.14.2: Global Value Numbering (6 hours, 15 tests)

**Goal**: Implement GVN analyzer to eliminate redundant computations

**File**: `packages/compiler/src/semantic/analysis/global-value-numbering.ts`

**Core Algorithm**:
1. Assign unique "value number" to each expression based on structure
2. Same operator + same operand value numbers = same result value number
3. Mark redundant computations that recompute same value

**Class Structure**:

```typescript
export class GlobalValueNumberingAnalyzer {
  protected valueNumbers = new Map<string, number>();
  protected nextValueNumber = 1;
  protected diagnostics: Diagnostic[] = [];

  constructor(
    protected cfg: Map<string, ControlFlowGraph>,
    protected symbolTable: SymbolTable
  ) {}

  // Main entry
  analyze(ast: Program): void;

  // Core GVN
  protected assignValueNumbers(block: BasicBlock): void;
  protected getOrAssignValueNumber(expr: Expression): number;
  protected computeExpressionHash(expr: Expression): string;
  
  // Redundancy detection
  protected detectRedundantComputations(): void;
  protected markRedundant(node: ASTNode, replacement: string): void;

  // Helpers
  protected handleBinaryExpression(expr: BinaryExpression): string;
  protected handleUnaryExpression(expr: UnaryExpression): string;
  protected handleIdentifier(expr: Identifier): string;
  protected handleLiteral(expr: Literal): string;
  
  getDiagnostics(): Diagnostic[];
}
```

**Tests** (15):
1. Simple redundant expression (a+b twice)
2. Different expressions get different value numbers
3. Same expression gets same value number
4. Commutative operations (a+b = b+a for addition)
5. Non-commutative operations (a-b ≠ b-a)
6. Variable reference GVN
7. Literal value GVN
8. Nested expression GVN
9. Redundancy across blocks (with domination)
10. No redundancy after reassignment
11. Array access GVN
12. Member access GVN
13. GVN metadata correctly set
14. Replacement variable correctly identified
15. Complex real-world expression

**Deliverables**:
- [ ] Create GlobalValueNumberingAnalyzer class
- [ ] Implement value number assignment
- [ ] Implement redundancy detection
- [ ] Add 15 tests

---

## Task 8.14.3: CSE Metadata Keys (0.5 hours, 4 tests)

**Goal**: Add metadata keys for Common Subexpression Elimination

**File**: `packages/compiler/src/semantic/analysis/optimization-metadata-keys.ts`

**Keys to Add**:

```typescript
// ==========================================
// Common Subexpression Elimination (Task 8.19)
// ==========================================

/** Available expressions at this point (Set<string>) */
CSEAvailable = 'CSEAvailable',

/** This subexpression can be eliminated (boolean) */
CSECandidate = 'CSECandidate',
```

**Tests** (4):
1. CSEAvailable key exists
2. CSECandidate key exists
3. Keys have correct string values
4. Keys are unique

**Deliverables**:
- [ ] Add 2 CSE metadata keys to enum
- [ ] Add 4 tests

---

## Task 8.14.4: Common Subexpression Elimination (5 hours, 12 tests)

**Goal**: Implement CSE analyzer for local redundancy detection

**File**: `packages/compiler/src/semantic/analysis/common-subexpr-elimination.ts`

**Difference from GVN**: CSE works within a single basic block only (simpler, faster)

**Class Structure**:

```typescript
export class CommonSubexpressionEliminationAnalyzer {
  protected diagnostics: Diagnostic[] = [];

  constructor(
    protected cfg: Map<string, ControlFlowGraph>,
    protected symbolTable: SymbolTable
  ) {}

  // Main entry
  analyze(ast: Program): void;

  // Core CSE
  protected analyzeBlock(block: BasicBlock): void;
  protected expressionToString(expr: Expression): string;
  protected invalidateExpressionsUsing(available: Set<string>, variable: string): void;

  // Helpers
  protected isAssignment(stmt: Statement): boolean;
  protected getAssignmentTarget(stmt: Statement): string | null;
  protected markAsCSECandidate(node: ASTNode): void;
  protected setAvailableExpressions(block: BasicBlock, available: Set<string>): void;

  getDiagnostics(): Diagnostic[];
}
```

**Tests** (12):
1. Simple repeated subexpression in block
2. Multiple occurrences detected
3. Expression invalidated by assignment
4. No CSE across blocks (unlike GVN)
5. Array access CSE
6. Member access CSE  
7. Nested subexpression
8. Commutative matching
9. Side effect expressions not eliminated
10. CSE metadata correctly set
11. Available set computed correctly
12. Complex real-world pattern

**Deliverables**:
- [ ] Create CommonSubexpressionEliminationAnalyzer class
- [ ] Implement block-local analysis
- [ ] Implement invalidation on assignment
- [ ] Add 12 tests

---

## Task 8.14.5: Orchestrator Update (2 hours, 10 tests)

**Goal**: Update AdvancedAnalyzer to call GVN and CSE

**File**: `packages/compiler/src/semantic/analysis/advanced-analyzer.ts`

**Changes**:

1. Add imports:
```typescript
import { GlobalValueNumberingAnalyzer } from './global-value-numbering.js';
import { CommonSubexpressionEliminationAnalyzer } from './common-subexpr-elimination.js';
```

2. Update `runTier3AdvancedAnalysis()` to add:
```typescript
// Task 8.18: Global Value Numbering
// Analyzes: redundant computations, value equivalence
// Metadata: GVNNumber, GVNRedundant, GVNReplacement
const gvnAnalyzer = new GlobalValueNumberingAnalyzer(this.cfgs, this.symbolTable);
gvnAnalyzer.analyze(ast);
this.diagnostics.push(...gvnAnalyzer.getDiagnostics());

// Task 8.19: Common Subexpression Elimination
// Analyzes: local redundant subexpressions
// Metadata: CSEAvailable, CSECandidate
const cseAnalyzer = new CommonSubexpressionEliminationAnalyzer(this.cfgs, this.symbolTable);
cseAnalyzer.analyze(ast);
this.diagnostics.push(...cseAnalyzer.getDiagnostics());
```

3. Update index.ts exports

**Tests** (10):
1. AdvancedAnalyzer calls GVN
2. AdvancedAnalyzer calls CSE
3. Tier 3 order is correct (GVN before CSE)
4. GVN metadata appears on AST nodes
5. CSE metadata appears on AST nodes
6. Diagnostics from GVN collected
7. Diagnostics from CSE collected
8. Full Tier 3 pipeline completes without error
9. Error handling (graceful failure)
10. Performance baseline test

**Deliverables**:
- [x] Add GVN import and call
- [x] Add CSE import and call
- [x] Update index.ts exports
- [x] Add 11 tests (orchestrator integration tests)

---

## Task 8.14.6: Integration Tests (6.5 hours, 30 tests)

**Goal**: Comprehensive end-to-end tests for Tier 3

**File**: `packages/compiler/src/__tests__/semantic/analysis/tier3-integration.test.ts`

**Test Categories**:

### Category A: Full Pipeline Tests (10 tests)
1. Complete Tier 1-3 pipeline runs
2. All analyzers produce metadata
3. Real C64 hardware access pattern
4. Complex expression optimization
5. Loop with invariant hoisting candidate
6. Function with purity analysis
7. Variable with escape analysis
8. Call graph with inlining candidate
9. 6502 hints on hot path variable
10. Multi-function program analysis

### Category B: Analysis Interdependencies (8 tests)
1. Loop analysis feeds into 6502 hints (ZP priority)
2. Usage analysis feeds into liveness
3. Constant propagation feeds into dead code
4. Reaching defs feed into GVN
5. Purity analysis affects inlining decisions
6. Escape analysis affects ZP allocation
7. Alias analysis affects CSE safety
8. Call graph affects purity transitivity

### Category C: Real C64 Patterns (7 tests)
1. VIC-II register manipulation
2. SID audio register access
3. Screen memory iteration
4. Color RAM update loop
5. Raster interrupt handling
6. Sprite multiplexing pattern
7. Zero-page intensive routine

### Category D: Performance Tests (5 tests)
1. 100 LOC completes < 100ms
2. 1000 LOC completes < 500ms
3. 5000 LOC completes < 1.5s
4. 10000 LOC completes < 2s
5. Memory usage within limits

**Deliverables**:
- [ ] Create tier3-integration.test.ts
- [ ] Add 10 full pipeline tests
- [ ] Add 8 interdependency tests
- [ ] Add 7 C64 pattern tests
- [ ] Add 5 performance tests

---

## Implementation Order

```
8.14.1 (GVN Keys) ──► 8.14.2 (GVN Analyzer)
                                          ├──► 8.14.5 (Orchestrator) ──► 8.14.6 (Integration)
8.14.3 (CSE Keys) ──► 8.14.4 (CSE Analyzer)
```

**Recommended Sequence**:
1. **8.14.1** - Add GVN metadata keys (foundation)
2. **8.14.3** - Add CSE metadata keys (can parallel with 8.14.1)
3. **8.14.2** - Implement GVN analyzer
4. **8.14.4** - Implement CSE analyzer
5. **8.14.5** - Update orchestrator to call GVN/CSE
6. **8.14.6** - Add integration tests

---

## Success Criteria

Each subtask is complete when:
- ✅ All code implemented per specification
- ✅ All tests passing
- ✅ JSDoc comments on public/protected methods
- ✅ No TypeScript errors
- ✅ Metadata keys properly set on AST nodes

**Final Integration Success**:
```typescript
it('should run complete Tier 3 analysis on C64 program', () => {
  const source = `
    @map screen at $0400: [byte; 1000];
    @zp counter at $02: byte;
    
    function clearScreen() {
      for (let i: byte = 0; i < 250; i = i + 1) {
        screen[i] = 32;
        screen[i + 250] = 32;  // CSE candidate: i + 250
        screen[i + 500] = 32;
        screen[i + 750] = 32;
      }
    }
  `;
  
  const analyzer = new SemanticAnalyzer();
  const result = analyzer.analyze(parse(source));
  
  expect(result.success).toBe(true);
  // All Tier 3 analyzers ran
  // GVN marked i + 250 etc. as recomputable
  // CSE marked block-local redundancies
  // M6502 hints: i has high ZP priority, X register preference
});
```

---

## Cross-References

- **Language Specification**: `docs/language-specification/13-6502-features.md`
- **Phase 8 Plan**: `plans/phase8-part3-tier3.md` (Tasks 8.14, 8.18, 8.19)
- **Code Standards**: `.clinerules/code.md` (Rules 4-8 testing)
- **Task 8.13 Plan**: Reference for detailed plan format