# Phase 6: SSA Construction - Execution Plan

> **Status**: Ready for Implementation
> **Created**: January 21, 2026
> **Total Time**: ~11.5 hours (across 12 sessions)
> **Total Tests**: ~280 tests (regular + extreme)
> **Prerequisites**: Phases 1-5 Complete ✅

---

## 🚨 MANDATORY: Before Each Session

**Per agents.md and code.md, EVERY session must:**

0. ✅ Follow agents.md rule **CRITICAL RULE: Task Granularity & Architecture** strictly
1. ✅ Execute `clear && scripts/agent.sh start` as FIRST command
2. ✅ Read relevant language specification sections if needed
3. ✅ Follow code.md rules strictly
4. ✅ Create maximum and extreme test coverage
5. ✅ Execute `clear && scripts/agent.sh finished`
6. ✅ Run `/compact` after successful completion as LAST command This is critical

---

## Implementation Status

| Session | Micro-Task                        | Status |
| ------- | --------------------------------- | ------ |
| 1       | Directory structure + index.ts    | [x]    |
| 2       | Dominator tree types + interfaces | [x]    |
| 3       | Dominator tree algorithm + bug fix| [x]    |
| 4       | Dominator tree extreme tests      | [x]    |
| 5       | Dominance frontier implementation | [x]    |
| 6       | Dominance frontier extreme tests  | [x]    |
| 7       | Phi placement types               | [x]    |
| 8       | Phi placement algorithm           | [x]    |
| 9       | Phi placement extreme tests       | [x]    |
| 10      | Variable renaming                 | [x]    |
| 11      | SSA verification                  | [x]    |
| 12      | SSA constructor + integration     | [x]    |

---

## Session 1: Directory Structure + Index

**Goal**: Create SSA directory and export file
**Time**: ~15 minutes
**Files**: 1 new file
**Tests**: 0 (infrastructure only)

### Steps:

1. [ ] Create directory: `packages/compiler/src/il/ssa/`
2. [ ] Create `packages/compiler/src/il/ssa/index.ts` with exports scaffold
3. [ ] Add export to `packages/compiler/src/il/index.ts`
4. [ ] Verify build passes: `clear && yarn clean && yarn build`

### Deliverables:

```
packages/compiler/src/il/ssa/
├── index.ts           # Export scaffold
```

### Code.md Compliance:

- [ ] Rule 11: JSDoc header comment
- [ ] Rule 16: Proper ES module imports

---

## Session 2: Dominator Tree Types + Interfaces

**Goal**: Define types and interfaces for dominator computation
**Time**: ~30 minutes
**Files**: 1 new file
**Tests**: 10 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/dominators.ts`
2. [ ] Define `DominatorInfo` interface
3. [ ] Define `DominatorTree` class stub
4. [ ] Add JSDoc for all types
5. [ ] Create test file `packages/compiler/src/__tests__/il/ssa-dominators.test.ts`
6. [ ] Write 10 basic tests for type structure
7. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Types to Define:

```typescript
/**
 * Information about a block's dominator relationships.
 */
interface DominatorInfo {
  /** Block ID */
  blockId: number;
  /** Immediate dominator block ID (-1 for entry) */
  immediateDominator: number;
  /** Blocks dominated by this block */
  dominates: Set<number>;
  /** Depth in dominator tree (0 for entry) */
  depth: number;
}

/**
 * Dominator tree for a function's CFG.
 */
class DominatorTree {
  /** Get immediate dominator of a block */
  getImmediateDominator(blockId: number): number | undefined;
  /** Check if A dominates B */
  dominates(a: number, b: number): boolean;
  /** Get all blocks dominated by a block */
  getDominatedBlocks(blockId: number): Set<number>;
  /** Get dominator tree depth */
  getDepth(blockId: number): number;
}
```

### Tests to Write:

| #   | Test Description                                            |
| --- | ----------------------------------------------------------- |
| 1   | DominatorInfo interface has required fields                 |
| 2   | DominatorTree class instantiation                           |
| 3   | getImmediateDominator() returns undefined for unknown block |
| 4   | dominates() returns false for unrelated blocks              |
| 5   | getDominatedBlocks() returns empty set for unknown block    |
| 6   | getDepth() returns -1 for unknown block                     |
| 7   | Entry block immediate dominator is -1                       |
| 8   | Entry block depth is 0                                      |
| 9   | Entry block dominates itself                                |
| 10  | DominatorTree is frozen/immutable after construction        |

### Code.md Compliance:

- [ ] Rule 2: Clarity over cleverness
- [ ] Rule 3: Single responsibility
- [ ] Rule 9: Comments explain WHY
- [ ] Rule 11: JSDoc on all members
- [ ] Rule 12: Use `protected` not `private`

---

## Session 3: Dominator Tree Algorithm

**Goal**: Implement dominator computation algorithm
**Time**: ~45 minutes
**Files**: 1 existing file
**Tests**: 15 tests

### Steps:

1. [ ] Implement `computeDominators(func: ILFunction): DominatorTree`
2. [ ] Use iterative dataflow algorithm (simple, correct)
3. [ ] Handle entry block special case
4. [ ] Add helper: `computeIntersection(sets: Set<number>[]): Set<number>`
5. [ ] Write 15 algorithm tests
6. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Algorithm (Iterative Dataflow):

```
// Initialize: Dom(entry) = {entry}, Dom(others) = all blocks
// Repeat until no changes:
//   For each block B (except entry):
//     Dom(B) = {B} ∪ ∩(Dom(P) for P in predecessors(B))
```

### Tests to Write:

| #   | Test Description                                     |
| --- | ---------------------------------------------------- |
| 1   | Single block function (entry only)                   |
| 2   | Linear chain: A → B → C                              |
| 3   | Diamond pattern: A → B,C → D                         |
| 4   | Simple loop: A → B → C → B                           |
| 5   | Nested loops                                         |
| 6   | Multiple predecessors join                           |
| 7   | Early return (multiple exits)                        |
| 8   | Unreachable blocks ignored                           |
| 9   | Entry dominates all reachable blocks                 |
| 10  | Dominator chain depth correct                        |
| 11  | Immediate dominator is closest                       |
| 12  | dominates() reflexive (A dom A)                      |
| 13  | dominates() transitive (A dom B, B dom C → A dom C)  |
| 14  | dominates() antisymmetric (A dom B, B dom A → A = B) |
| 15  | Complex CFG with 10+ blocks                          |

### Code.md Compliance:

- [ ] Rule 1: DRY - extract helper functions
- [ ] Rule 2: Clarity over cleverness
- [ ] Rule 4: All tests must pass
- [ ] Rule 6: Maximum coverage

---

## Session 4: Dominator Tree Extreme Tests

**Goal**: Add extreme edge case tests
**Time**: ~45 minutes
**Files**: 1 existing file
**Tests**: 25 tests

### Steps:

1. [ ] Add performance tests (100+ block CFGs)
2. [ ] Add edge case tests (pathological CFGs)
3. [ ] Add stress tests (repeated computation)
4. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Extreme Tests to Write:

| #     | Test Description                         |
| ----- | ---------------------------------------- |
| 1-5   | CFG with 100 blocks (linear chain)       |
| 6-10  | CFG with 100 blocks (binary tree shape)  |
| 11-15 | CFG with deeply nested loops (10 levels) |
| 16-20 | Irreducible control flow patterns        |
| 21-25 | Maximum predecessor count (50+ preds)    |

---

## Session 5: Dominance Frontier Implementation

**Goal**: Compute dominance frontiers
**Time**: ~40 minutes
**Files**: 1 new file
**Tests**: 15 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/frontiers.ts`
2. [ ] Define `DominanceFrontier` class
3. [ ] Implement `computeFrontiers(func: ILFunction, domTree: DominatorTree)`
4. [ ] Add to exports
5. [ ] Write 15 tests
6. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Key Concept:

```
// Dominance frontier of block B:
// DF(B) = {X | B dominates a predecessor of X, but B does not strictly dominate X}
//
// Where phi functions are needed = DF(assignment locations)
```

### Tests to Write:

| #   | Test Description                         |
| --- | ---------------------------------------- |
| 1   | Single block has empty frontier          |
| 2   | Linear chain has no frontiers            |
| 3   | Diamond join point is in frontier        |
| 4   | Loop header is in frontier               |
| 5   | Nested loop frontiers                    |
| 6   | Multiple assignment points               |
| 7   | If-else merge frontier                   |
| 8   | Switch statement frontiers               |
| 9   | Early return frontiers                   |
| 10  | Complex CFG frontiers                    |
| 11  | Frontier is empty for exit blocks        |
| 12  | Frontier computation is deterministic    |
| 13  | Frontier invariants hold                 |
| 14  | Frontier for entry block                 |
| 15  | Frontier consistency with dominator tree |

---

## Session 6: Dominance Frontier Extreme Tests

**Goal**: Add extreme edge case tests
**Time**: ~40 minutes
**Files**: 1 existing file
**Tests**: 20 tests

### Steps:

1. [ ] Add performance tests
2. [ ] Add pathological CFG tests
3. [ ] Add integration tests with dominator tree
4. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Extreme Tests to Write:

| #     | Test Description                 |
| ----- | -------------------------------- |
| 1-5   | Large CFG frontier computation   |
| 6-10  | Many-to-one merge points         |
| 11-15 | Iterative frontier (DF+)         |
| 16-20 | Frontier computation performance |

---

## Session 7: Phi Placement Types

**Goal**: Define types for phi placement
**Time**: ~30 minutes
**Files**: 1 new file
**Tests**: 10 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/phi.ts`
2. [ ] Define `PhiPlacementInfo` interface
3. [ ] Define `PhiPlacer` class stub
4. [ ] Add to exports
5. [ ] Write 10 type tests
6. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Types to Define:

```typescript
/**
 * Information about phi function placement.
 */
interface PhiPlacementInfo {
  /** Variable name */
  variable: string;
  /** Block IDs where phi functions are needed */
  phiBlocks: Set<number>;
  /** Assignment block IDs for this variable */
  defBlocks: Set<number>;
}

/**
 * Places phi functions at dominance frontiers.
 */
class PhiPlacer {
  /** Place phi functions for all variables */
  placePhiFunctions(
    func: ILFunction,
    frontiers: DominanceFrontier
  ): Map<number, PhiPlacementInfo[]>;
}
```

---

## Session 8: Phi Placement Algorithm

**Goal**: Implement phi placement algorithm
**Time**: ~45 minutes
**Files**: 1 existing file
**Tests**: 20 tests

### Steps:

1. [ ] Implement `placePhiFunctions()`
2. [ ] Collect all variable definitions
3. [ ] For each variable, place phis at DF(def blocks)
4. [ ] Iterate until fixed point (phi at DF creates new def)
5. [ ] Write 20 algorithm tests
6. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Algorithm (Worklist):

```
For each variable v:
  WorkList = {blocks where v is defined}
  EverOnWorkList = WorkList
  HasPhi = {}
  While WorkList not empty:
    n = WorkList.pop()
    For each block m in DF(n):
      If m not in HasPhi:
        Place phi for v at m
        HasPhi.add(m)
        If m not in EverOnWorkList:
          EverOnWorkList.add(m)
          WorkList.push(m)
```

### Tests to Write:

| #     | Test Description                      |
| ----- | ------------------------------------- |
| 1     | No phi needed (single assignment)     |
| 2     | Phi at if-else merge                  |
| 3     | Phi at loop header                    |
| 4     | Multiple variables need phi           |
| 5     | Nested loop phi placement             |
| 6     | Phi placement iterates to fixed point |
| 7     | Phi not placed for unused variable    |
| 8     | Phi with 2 predecessors               |
| 9     | Phi with 5+ predecessors              |
| 10    | Phi placement is deterministic        |
| 11    | Phi only at dominance frontiers       |
| 12    | No redundant phi placement            |
| 13    | Phi for parameter modification        |
| 14    | Phi for loop counter                  |
| 15    | Complex CFG phi placement             |
| 16-20 | Additional edge cases                 |

---

## Session 9: Phi Placement Extreme Tests

**Goal**: Add extreme edge case tests
**Time**: ~50 minutes
**Files**: 1 existing file
**Tests**: 30 tests

### Steps:

1. [ ] Add many-variable tests
2. [ ] Add complex CFG tests
3. [ ] Add performance tests
4. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

---

## Session 10: Variable Renaming

**Goal**: Implement SSA variable renaming
**Time**: ~60 minutes
**Files**: 1 new file
**Tests**: 35 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/renaming.ts`
2. [ ] Define `SSAName` type (variable.version)
3. [ ] Implement `renameVariables(func: ILFunction, domTree: DominatorTree)`
4. [ ] Walk dominator tree in preorder
5. [ ] Maintain version counter per variable
6. [ ] Update phi operands from predecessors
7. [ ] Write 35 tests
8. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Algorithm:

```
For each block B in dominator tree preorder:
  For each phi in B:
    Rename result to fresh version
  For each instruction in B:
    Rename uses to current version
    If defines variable, rename to fresh version
  For each successor S:
    Update phi operands from B with current versions
  Recurse to dominated blocks
  Pop version stack at end
```

### Tests to Write:

| #     | Test Description                              |
| ----- | --------------------------------------------- |
| 1     | Single assignment creates .0 version          |
| 2     | Two assignments create .0, .1 versions        |
| 3     | Phi result gets new version                   |
| 4     | Phi operands get correct predecessor versions |
| 5     | Uses renamed to current version               |
| 6     | Loop counter versions correctly               |
| 7     | Nested scope versions correctly               |
| 8     | Parameter versions start at .0                |
| 9     | Return value uses correct version             |
| 10    | Complex CFG renaming                          |
| 11-35 | Additional cases                              |

---

## Session 11: SSA Verification

**Goal**: Implement SSA form verification
**Time**: ~45 minutes
**Files**: 1 new file
**Tests**: 25 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/verification.ts`
2. [ ] Implement `verifySSA(func: ILFunction): ValidationResult`
3. [ ] Check: Each register defined exactly once
4. [ ] Check: All uses dominated by definition
5. [ ] Check: Phi operands from correct predecessors
6. [ ] Write 25 tests
7. [ ] Run tests: `clear && yarn clean && yarn build && yarn test`

### Invariants to Check:

```
1. Single assignment: Each VirtualRegister defined exactly once
2. Dominance: Definition of r dominates all uses of r
3. Phi correctness: Phi has operand from each predecessor
4. Phi position: Phi functions only at block start
5. No use before def: Every use has a reaching definition
```

---

## Session 12: SSA Constructor + Integration

**Goal**: Create main SSA constructor and integration tests
**Time**: ~60 minutes
**Files**: 1 new file
**Tests**: 75 tests

### Steps:

1. [ ] Create `packages/compiler/src/il/ssa/constructor.ts`
2. [ ] Implement `SSAConstructor` class
3. [ ] Orchestrate: dominators → frontiers → phi → rename → verify
4. [ ] Add logging/debugging support
5. [ ] Write integration tests
6. [ ] Write end-to-end tests (source → IL → SSA)
7. [ ] Run ALL tests: `clear && yarn clean && yarn build && yarn test`

### SSAConstructor API:

```typescript
class SSAConstructor {
  /** Convert function to SSA form */
  construct(func: ILFunction): SSAConstructionResult;

  /** Get dominator tree (for debugging) */
  getDominatorTree(): DominatorTree;

  /** Get dominance frontiers (for debugging) */
  getDominanceFrontiers(): DominanceFrontier;
}

interface SSAConstructionResult {
  success: boolean;
  errors: ValidationError[];
  stats: {
    phiCount: number;
    versionsCreated: number;
    blocksProcessed: number;
  };
}
```

### Integration Tests:

| #     | Test Description                                          |
| ----- | --------------------------------------------------------- |
| 1-20  | Simple function SSA conversion                            |
| 21-40 | Complex control flow SSA conversion                       |
| 41-55 | Real C64 patterns in SSA                                  |
| 56-70 | SSA verification passes after construction                |
| 71-75 | End-to-end: source → lexer → parser → semantic → IL → SSA |

---

## Code.md Compliance Checklist (All Sessions)

Before completing EACH session, verify:

- [ ] **Rule 1**: DRY - No duplicated logic
- [ ] **Rule 2**: Clarity over cleverness - Readable code
- [ ] **Rule 3**: Single responsibility - One concern per function
- [ ] **Rule 4**: All tests must pass
- [ ] **Rule 5**: Tests are part of the code - Maintain with care
- [ ] **Rule 6**: Maximum test coverage
- [ ] **Rule 7**: End-to-end tests where applicable
- [ ] **Rule 8**: Granular, focused tests
- [ ] **Rule 9**: Comments explain WHY
- [ ] **Rule 10**: Junior developer readable
- [ ] **Rule 11**: JSDoc on all public/protected members
- [ ] **Rule 12**: Use `protected` instead of `private`
- [ ] **Rule 14**: Code is maintainable and extensible
- [ ] **Rule 15**: Consistent with existing patterns
- [ ] **Rule 22**: No inline dynamic imports
- [ ] **Rule 23**: No constructor.name comparisons
- [ ] **Rule 24**: No hardcoded string type checks
- [ ] **Rule 25**: No mocking real objects
- [ ] **Rule 26**: No `as any` type bypassing
- [ ] **Rule 27**: Complete interface compliance
- [ ] **Rule 28**: When in doubt, be explicit

---

## Files to Create Summary

```
packages/compiler/src/il/ssa/
├── index.ts           # Session 1
├── dominators.ts      # Sessions 2-4
├── frontiers.ts       # Sessions 5-6
├── phi.ts             # Sessions 7-9
├── renaming.ts        # Session 10
├── verification.ts    # Session 11
└── constructor.ts     # Session 12

packages/compiler/src/__tests__/il/
├── ssa-dominators.test.ts    # Sessions 2-4
├── ssa-frontiers.test.ts     # Sessions 5-6
├── ssa-phi.test.ts           # Sessions 7-9
├── ssa-renaming.test.ts      # Session 10
├── ssa-verification.test.ts  # Session 11
└── ssa-integration.test.ts   # Session 12
```

---

## Test Count Summary

| Session   | Regular Tests | Extreme Tests | Total    |
| --------- | ------------- | ------------- | -------- |
| 1         | 0             | 0             | 0        |
| 2         | 10            | 0             | 10       |
| 3         | 15            | 0             | 15       |
| 4         | 0             | 25            | 25       |
| 5         | 15            | 0             | 15       |
| 6         | 0             | 20            | 20       |
| 7         | 10            | 0             | 10       |
| 8         | 20            | 0             | 20       |
| 9         | 0             | 30            | 30       |
| 10        | 35            | 0             | 35       |
| 11        | 25            | 0             | 25       |
| 12        | 75            | 0             | 75       |
| **TOTAL** | **205**       | **75**        | **~280** |

---

## Next Action

**Start with Session 1**: Create directory structure + index.ts

```bash
# Session 1 command sequence:
clear && scripts/agent.sh start
# ... create files ...
clear && yarn clean && yarn build
clear && scripts/agent.sh finished
# call attempt_completion
# run /compact
```

---

## Cross-References

- **agents.md**: Multi-session execution, task granularity
- **code.md**: All coding standards (Rules 1-28)
- **plans/il-generator/06-ssa-construction.md**: Original task breakdown
- **plans/il-generator/IL-GENERATOR-UNIFIED-TEST-PLAN.md**: Test specifications