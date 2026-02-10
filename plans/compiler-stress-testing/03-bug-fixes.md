# Bug Fix Specifications

> **Document**: 03-bug-fixes.md
> **Parent**: [Index](00-index.md)

## Bug 1 Fix: UsageWalker Scope Tracking

### Overview
The `UsageWalker` in `advanced-analyzer.ts` must track scope changes like the type-checker does,
entering child scopes for all 7 scope-creating constructs (for, while, do-while, if-then, if-else,
switch/match, block statement).

### Architecture

**Current:** UsageWalker only overrides `visitFunctionDecl` to change `currentScope`.

**Proposed:** Add scope-tracking overrides for all scope-creating constructs, mirroring the
type-checker's scope entry/exit pattern.

### Implementation Details

**New Methods in UsageWalker:**

```typescript
// Scope navigation helpers (mirrors type-checker pattern)
protected enterChildScopeForNode(node: ASTNode): void {
    if (!this.currentScope) return;
    for (const child of this.currentScope.children) {
        if (child.node === node) {
            this.scopeStack.push(this.currentScope);
            this.currentScope = child;
            return;
        }
    }
}

protected enterChildScopeByNodeIndex(node: ASTNode, index: number): void {
    if (!this.currentScope) return;
    let matchCount = 0;
    for (const child of this.currentScope.children) {
        if (child.node === node) {
            if (matchCount === index) {
                this.scopeStack.push(this.currentScope);
                this.currentScope = child;
                return;
            }
            matchCount++;
        }
    }
}

protected exitScope(): void {
    if (this.scopeStack.length > 0) {
        this.currentScope = this.scopeStack.pop()!;
    }
}
```

**Override methods:**

```typescript
override visitForStatement(node: ForStatement): void {
    this.enterChildScopeForNode(node);
    super.visitForStatement(node);
    this.exitScope();
}

override visitWhileStatement(node: WhileStatement): void {
    this.enterChildScopeForNode(node);
    super.visitWhileStatement(node);
    this.exitScope();
}

override visitDoWhileStatement(node: DoWhileStatement): void {
    this.enterChildScopeForNode(node);
    super.visitDoWhileStatement(node);
    this.exitScope();
}

override visitIfStatement(node: IfStatement): void {
    // Visit condition in current scope
    node.getCondition().accept(this);
    // Then-branch: scope index 0
    this.enterChildScopeByNodeIndex(node, 0);
    for (const stmt of node.getThenBody()) stmt.accept(this);
    this.exitScope();
    // Else-branch: scope index 1
    const elseBody = node.getElseBody();
    if (elseBody && elseBody.length > 0) {
        this.enterChildScopeByNodeIndex(node, 1);
        for (const stmt of elseBody) stmt.accept(this);
        this.exitScope();
    }
}

override visitBlockStatement(node: BlockStatement): void {
    this.enterChildScopeForNode(node);
    super.visitBlockStatement(node);
    this.exitScope();
}
```

### Files to Modify
- `packages/compiler/src/semantic/analysis/advanced-analyzer.ts`

### Testing Requirements
- Verify for-loop variable used in body → NOT reported as unused
- Verify while-loop variable used in body → NOT reported as unused
- Verify if-branch variable used in body → NOT reported as unused
- Verify actually unused variables STILL reported
- No regressions in existing 8000+ tests

---

## Bug 2 Fix: Dynamic Address POKE/PEEK

### Overview
The IL generator must emit proper operands for POKE/PEEK when the address is not a
compile-time constant (e.g., `baseAddr + i`). The codegen must then handle these operands
to generate correct 6502 addressing modes.

### Architecture

**Current Flow (broken):**
1. `tryResolveConstantAddress(node)` returns `undefined` for `baseAddr + i`
2. Dynamic path emits `POKE` with empty operands `[]`
3. Codegen crashes: `getAddressOperand` expects operand at index 0

**Proposed Flow:**
1. `tryResolveConstantAddress(node)` returns `undefined` → falls into dynamic path
2. Dynamic path evaluates the address expression onto the stack/into a slot
3. Emits `POKE` with a dynamic-address marker operand (e.g., `{ kind: 'dynamic' }`)
4. Codegen detects dynamic-address operand → generates indirect addressing via ZP pointer

### 6502 Addressing Strategy

For `poke(constantBase + byteVar, value)`:
- Use Absolute,X: `LDX byteVar; STA constantBase,X`

For `poke(wordVar, value)`:
- Use Indirect Indexed: Store wordVar at ZP pointer, then `LDY #$00; STA (ptr),Y`

For `poke(wordVar + byteVar, value)`:
- Compute address into ZP pointer, then `LDY #$00; STA (ptr),Y`

### Files to Modify
- `packages/compiler/src/il/generator/expressions.ts` (generatePokeIntrinsic, generatePeekIntrinsic)
- `packages/compiler/src/codegen/generator/intrinsics.ts` (genPoke, genPeek, genPokew, genPeekw)
- Possibly `packages/compiler/src/il/types.ts` (new operand kind for dynamic addresses)

### Testing Requirements
- `poke($D020 + i, value)` compiles and generates `STA $D020,X`
- `peek($D000 + offset)` compiles and generates `LDA $D000,X`
- `poke(wordVar, value)` compiles and generates indirect addressing
- No crashes on any dynamic address pattern

---

## Bug 3 Fix: DFE After Inlining

### Overview
After function inlining, functions with zero remaining call sites (fully inlined) must be
removed from the program. Currently DFE runs before inlining and never again.

### Option A: Inlining Pass Self-Cleanup (Preferred)
After processing all candidates, the inlining pass rebuilds the call graph and removes
functions that now have 0 call sites and are not exported/callbacks.

```typescript
// After all inlining is done:
callGraph.rebuild(program);
const toRemove = program.functions.filter(f => {
    if (f.isExported || f.isCallback || f.name === 'main') return false;
    return callGraph.getCallCount(f.name) === 0;
});
for (const f of toRemove) {
    program.functions = program.functions.filter(fn => fn !== f);
    functionsRemoved++;
}
```

### Option B: Second DFE Pass
Add `dead-function-elim` after `function-inline` in the pass list:
```typescript
O3: ['dead-function-elim', 'dead-global-elim', 'function-inline', 'dead-function-elim'],
```

### Files to Modify
- `packages/compiler/src/optimizer/passes/function-inlining.ts` (Option A)
- OR `packages/compiler/src/optimizer/options.ts` (Option B)

### Testing Requirements
- At O3: inlined-only functions NOT in assembly output
- Exported functions ALWAYS in output (even if inlined at some sites)
- Multi-site inlined functions correctly handled
- No regressions in optimizer tests

---

## Bugs 4-6 Fix: Assembly Correctness

### Overview
These 3 bugs require investigation to determine the exact root cause before fixing.
They may share a common root in the optimizer or codegen.

### Investigation Approach

1. **Compile border-cycle at O0** — check if `color += 1` is present (if yes → optimizer bug)
2. **Compile border-cycle at O3** — dump IL before/after each optimizer pass
3. **Diff IL** — identify which pass removes/corrupts the instructions
4. **Fix the identified pass** — may be DCE, constant-prop, LICM, or inlining

### Possible Root Causes

**Bug 4 (`color += 1` missing):**
- DCE incorrectly marking the compound assignment as dead
- Constant propagation replacing `color` with a constant and removing the update
- Codegen not emitting INC for compound assignment after inlined code

**Bug 5 (`color = 0` wrong value):**
- Codegen tracking accumulator state incorrectly after inlined code
- Optimizer removing `LDA #$00` as redundant (wrong — A was clobbered)
- Copy propagation thinking A still holds 0 from earlier

**Bug 6 (loop counter re-init):**
- LICM hoisting `LDA #$00` (loop counter init) out of the while loop
- Inlining placing init code before the while-loop instead of inside it
- Constant propagation replacing loop init with a single store

### Files to Modify
- TBD after investigation — likely one or more of:
  - `packages/compiler/src/optimizer/passes/dce.ts`
  - `packages/compiler/src/optimizer/passes/constant-prop.ts`
  - `packages/compiler/src/optimizer/passes/licm.ts`
  - `packages/compiler/src/optimizer/passes/function-inlining.ts`
  - `packages/compiler/src/codegen/generator/statements.ts`

### Testing Requirements
- border-cycle produces correct assembly at O0, O1, O2, O3
- `color += 1` generates INC or ADC at all levels
- `color = 0` generates `LDA #$00; STA` at all levels
- Inlined loop counters initialize correctly inside outer loops
- No regressions in any existing tests
