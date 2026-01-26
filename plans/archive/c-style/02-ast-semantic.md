# Part 3: AST & Semantic Analyzer Tasks

> **Document**: 02-ast-semantic.md
> **Phase Coverage**: Phase 3 (AST) + Phase 4 (Semantic Analyzer)
> **Status**: Complete

---

## Phase 3: AST Changes

### Context

The Abstract Syntax Tree (AST) must be updated to support new language features: enhanced for loops with step/downto, do-while statement, and ternary expressions.

### Dependencies

- Phase 1 complete (new tokens available)
- Can partially overlap with Phase 2 (parser changes)

### Deliverables

- ForStatement updated with new fields (direction, step, variableType)
- New DoWhileStatement AST node
- New TernaryExpression AST node
- SwitchStatement renamed from MatchStatement (if needed)
- Type guards updated
- AST visitor updated
- All AST tests pass

---

### Phase 3 Tasks

#### Task 3.1: Update ForStatement AST Node

**Objective**: Add `direction`, `step`, and `variableType` fields to ForStatement.

**File**: `packages/compiler/src/ast/nodes.ts` (or relevant AST file)

**Current**:
```typescript
class ForStatement extends Statement {
  constructor(
    public readonly variable: string,
    public readonly start: Expression,
    public readonly end: Expression,
    public readonly body: Statement[],
    location: SourceLocation
  )
}
```

**New**:
```typescript
class ForStatement extends Statement {
  constructor(
    public readonly variable: string,
    public readonly variableType: string | null,  // For explicit `let i: word`
    public readonly start: Expression,
    public readonly end: Expression,
    public readonly direction: 'to' | 'downto',   // NEW: Loop direction
    public readonly step: Expression | null,       // NEW: Optional step value
    public readonly body: Statement[],
    location: SourceLocation
  )
  
  // Computed by semantic analyzer
  private _inferredCounterType: 'byte' | 'word' = 'byte';
  
  public getInferredCounterType(): 'byte' | 'word' {
    return this._inferredCounterType;
  }
  
  public setInferredCounterType(type: 'byte' | 'word'): void {
    this._inferredCounterType = type;
  }
}
```

**Tests**:
- Unit: Create ForStatement with all new fields
- Unit: Default values work (direction='to', step=null)
- Unit: Getter/setter for inferred counter type

---

#### Task 3.2: Create DoWhileStatement AST Node

**Objective**: Add new DoWhileStatement AST node class.

**File**: `packages/compiler/src/ast/nodes.ts`

**Implementation**:
```typescript
/**
 * Represents a do-while loop statement.
 * 
 * Syntax: do { body } while (condition);
 * 
 * Unlike while loops, do-while executes the body at least once
 * before checking the condition.
 */
export class DoWhileStatement extends Statement {
  constructor(
    public readonly body: Statement[],
    public readonly condition: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.DO_WHILE_STATEMENT, location);
  }
  
  public accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitDoWhileStatement(this);
  }
}
```

**Tests**:
- Unit: Create DoWhileStatement
- Unit: Access body and condition
- Unit: Accept method calls visitor

---

#### Task 3.3: Create TernaryExpression AST Node

**Objective**: Add new TernaryExpression AST node class.

**File**: `packages/compiler/src/ast/nodes.ts`

**Implementation**:
```typescript
/**
 * Represents a ternary conditional expression.
 * 
 * Syntax: condition ? thenExpr : elseExpr
 * 
 * Evaluates to thenExpr if condition is truthy,
 * otherwise evaluates to elseExpr.
 */
export class TernaryExpression extends Expression {
  constructor(
    public readonly condition: Expression,
    public readonly thenExpr: Expression,
    public readonly elseExpr: Expression,
    location: SourceLocation
  ) {
    super(ASTNodeType.TERNARY_EXPRESSION, location);
  }
  
  public accept<T>(visitor: ASTVisitor<T>): T {
    return visitor.visitTernaryExpression(this);
  }
}
```

**Tests**:
- Unit: Create TernaryExpression
- Unit: Access condition, thenExpr, elseExpr
- Unit: Accept method calls visitor

---

#### Task 3.4: Add ASTNodeType Enum Values

**Objective**: Add new enum values for new node types.

**File**: `packages/compiler/src/ast/base.ts` (or relevant file)

**Add**:
```typescript
export enum ASTNodeType {
  // ... existing values ...
  
  DO_WHILE_STATEMENT = 'DoWhileStatement',
  TERNARY_EXPRESSION = 'TernaryExpression',
  
  // Note: SWITCH_STATEMENT may need to replace/alias MATCH_STATEMENT
  SWITCH_STATEMENT = 'SwitchStatement',
}
```

---

#### Task 3.5: Update Type Guards

**Objective**: Add type guards for new AST node types.

**File**: `packages/compiler/src/ast/type-guards.ts`

**Add**:
```typescript
export function isDoWhileStatement(node: ASTNode): node is DoWhileStatement {
  return node.getNodeType() === ASTNodeType.DO_WHILE_STATEMENT;
}

export function isTernaryExpression(node: ASTNode): node is TernaryExpression {
  return node.getNodeType() === ASTNodeType.TERNARY_EXPRESSION;
}

export function isSwitchStatement(node: ASTNode): node is SwitchStatement {
  return node.getNodeType() === ASTNodeType.SWITCH_STATEMENT;
}
```

**Tests**:
- Unit: isDoWhileStatement returns true for DoWhileStatement
- Unit: isTernaryExpression returns true for TernaryExpression
- Unit: isSwitchStatement returns true for SwitchStatement

---

#### Task 3.6: Update ASTVisitor Interface

**Objective**: Add visit methods for new node types to ASTVisitor.

**File**: `packages/compiler/src/ast/visitor.ts`

**Add methods**:
```typescript
export interface ASTVisitor<T> {
  // ... existing methods ...
  
  visitDoWhileStatement(node: DoWhileStatement): T;
  visitTernaryExpression(node: TernaryExpression): T;
  visitSwitchStatement(node: SwitchStatement): T;
}
```

**Update base implementations** (if any default visitor exists):
```typescript
export abstract class BaseASTVisitor<T> implements ASTVisitor<T> {
  // ... existing implementations ...
  
  visitDoWhileStatement(node: DoWhileStatement): T {
    // Default implementation or abstract
  }
  
  visitTernaryExpression(node: TernaryExpression): T {
    // Default implementation or abstract
  }
  
  visitSwitchStatement(node: SwitchStatement): T {
    // Default implementation or abstract
  }
}
```

---

#### Task 3.7: Rename MatchStatement to SwitchStatement

**Objective**: Rename the class (if separate from task 3.4).

**Files to Modify**:
- `packages/compiler/src/ast/nodes.ts` - Rename class
- `packages/compiler/src/ast/index.ts` - Update exports
- All imports throughout codebase

**Strategy**:
1. Create SwitchStatement as alias first
2. Search and replace usages
3. Remove old MatchStatement

---

#### Task 3.8: Update AST Tests

**Objective**: Update all AST tests for changes.

**Files to Modify**:
- `packages/compiler/src/__tests__/ast/`

**Tests to Add**:
- ForStatement with direction and step
- DoWhileStatement creation and visitor
- TernaryExpression creation and visitor
- SwitchStatement (renamed from MatchStatement)
- Type guard tests

---

## Phase 4: Semantic Analyzer Changes

### Context

The semantic analyzer must be updated to:
1. Type-check new constructs (ternary, do-while)
2. Implement loop counter type inference (byte vs word)
3. Implement loop overflow detection

### Dependencies

- Phase 3 complete (AST nodes available)
- Parser changes (Phase 2) mostly complete

### Deliverables

- Ternary expression type checking
- Do-while condition type checking
- For loop counter type inference
- Loop bounds overflow detection
- All semantic tests pass

---

### Phase 4 Tasks

#### Task 4.1: Add Ternary Expression Type Checking

**Objective**: Type check ternary expressions.

**File**: `packages/compiler/src/semantic/type-checker.ts` (or relevant file)

**Rules**:
1. Condition must be boolean (or implicitly convertible)
2. Then and else expressions must have compatible types
3. Result type is the common type of then/else

**Implementation**:
```typescript
visitTernaryExpression(node: TernaryExpression): TypeInfo {
  // Type check condition
  const condType = this.visit(node.condition);
  if (!this.isConvertibleToBoolean(condType)) {
    this.reportError(
      'Ternary condition must be boolean',
      node.condition.getLocation()
    );
  }
  
  // Type check branches
  const thenType = this.visit(node.thenExpr);
  const elseType = this.visit(node.elseExpr);
  
  // Find common type
  const resultType = this.findCommonType(thenType, elseType);
  if (resultType === null) {
    this.reportError(
      `Ternary branches have incompatible types: ${thenType} and ${elseType}`,
      node.getLocation()
    );
    return this.errorType();
  }
  
  return resultType;
}
```

**Tests**:
- Unit: `true ? 1 : 2` → byte
- Unit: `flag ? $1000 : $2000` → word
- Unit: Incompatible types produce error
- Unit: Non-boolean condition produces error

---

#### Task 4.2: Add Do-While Statement Analysis

**Objective**: Type check and analyze do-while statements.

**File**: `packages/compiler/src/semantic/type-checker.ts`

**Rules**:
1. Condition must be boolean
2. Body statements must be valid
3. Break/continue are valid within body

**Implementation**:
```typescript
visitDoWhileStatement(node: DoWhileStatement): void {
  // Enter loop scope
  this.enterLoopScope();
  
  // Check body statements
  for (const stmt of node.body) {
    this.visit(stmt);
  }
  
  // Exit loop scope before checking condition (it's evaluated after body)
  this.exitLoopScope();
  
  // Type check condition
  const condType = this.visit(node.condition);
  if (!this.isConvertibleToBoolean(condType)) {
    this.reportError(
      'Do-while condition must be boolean',
      node.condition.getLocation()
    );
  }
}
```

**Tests**:
- Unit: Valid do-while passes
- Unit: Non-boolean condition produces error
- Unit: Break/continue within body is valid

---

#### Task 4.3: Implement For Loop Counter Type Inference

**Objective**: Automatically infer byte or word type for loop counters.

**File**: `packages/compiler/src/semantic/type-checker.ts` or new `loop-analyzer.ts`

**Rules**:
1. If explicit type given (`let i: word`), use that
2. If start/end are literals, check if range fits in byte (0-255)
3. If range fits in byte, use byte (fast 8-bit counter)
4. If range exceeds byte, use word (slow 16-bit counter)
5. If can't determine, default to word (safe)

**Implementation**:
```typescript
visitForStatement(node: ForStatement): void {
  // Determine counter type
  let counterType: 'byte' | 'word' = 'byte';
  
  if (node.variableType !== null) {
    // Explicit type given
    counterType = node.variableType === 'word' ? 'word' : 'byte';
  } else {
    // Infer from bounds
    const startVal = this.evaluateConstExpr(node.start);
    const endVal = this.evaluateConstExpr(node.end);
    
    if (startVal !== null && endVal !== null) {
      // Both are constant - check range
      const maxVal = Math.max(startVal, endVal);
      if (maxVal > 255) {
        counterType = 'word';
        this.reportWarning(
          `For loop requires 16-bit counter (range exceeds byte). ` +
          `Consider using nested byte loops for better performance.`,
          node.getLocation()
        );
      }
    } else {
      // Can't determine at compile time - check types of expressions
      const startType = this.visit(node.start);
      const endType = this.visit(node.end);
      
      if (startType.name === 'word' || endType.name === 'word') {
        counterType = 'word';
      }
    }
  }
  
  // Store inferred type
  node.setInferredCounterType(counterType);
  
  // Register loop variable in scope
  this.declareVariable(node.variable, counterType);
  
  // Check body
  this.enterLoopScope();
  for (const stmt of node.body) {
    this.visit(stmt);
  }
  this.exitLoopScope();
}
```

**Tests**:
- Unit: `for (i = 0 to 100)` → byte
- Unit: `for (i = 0 to 255)` → byte
- Unit: `for (i = 0 to 256)` → word (with warning)
- Unit: `for (i = 0 to 5000)` → word (with warning)
- Unit: `for (let i: word = 0 to 100)` → word (explicit)
- Unit: `for (let i: byte = 0 to 300)` → error (explicit but range exceeds)

---

#### Task 4.4: Implement Loop Bounds Overflow Detection

**Objective**: Detect potential overflow issues in loop bounds.

**File**: `packages/compiler/src/semantic/loop-analyzer.ts` or similar

**Checks**:
1. End value exceeds type capacity
2. Step value causes overflow before reaching end
3. Impossible loop (start > end with 'to')
4. Always-true/always-false conditions in while loops

**Implementation**:
```typescript
analyzeForLoopBounds(node: ForStatement): void {
  const startVal = this.evaluateConstExpr(node.start);
  const endVal = this.evaluateConstExpr(node.end);
  const stepVal = node.step ? this.evaluateConstExpr(node.step) : 1;
  const counterType = node.getInferredCounterType();
  
  // Check 1: End value exceeds type capacity
  if (endVal !== null) {
    const maxForType = counterType === 'byte' ? 255 : 65535;
    if (endVal > maxForType) {
      this.reportError(
        `For loop end value ${endVal} exceeds ${counterType} range (0-${maxForType})`,
        node.end.getLocation()
      );
    }
  }
  
  // Check 2: Impossible loop direction
  if (startVal !== null && endVal !== null) {
    if (node.direction === 'to' && startVal > endVal) {
      this.reportWarning(
        `For loop will never execute: start ${startVal} > end ${endVal}`,
        node.getLocation()
      );
    }
    if (node.direction === 'downto' && startVal < endVal) {
      this.reportWarning(
        `For loop will never execute: start ${startVal} < end ${endVal}`,
        node.getLocation()
      );
    }
  }
  
  // Check 3: Step causes overflow
  if (startVal !== null && endVal !== null && stepVal !== null && stepVal > 1) {
    let current = startVal;
    const maxForType = counterType === 'byte' ? 255 : 65535;
    let reachesEnd = false;
    
    while (current <= endVal && current <= maxForType) {
      if (current === endVal) {
        reachesEnd = true;
        break;
      }
      current += stepVal;
    }
    
    if (!reachesEnd && current > maxForType) {
      this.reportWarning(
        `For loop step ${stepVal} may cause overflow before reaching end ${endVal}`,
        node.getLocation()
      );
    }
  }
}
```

**Tests**:
- Unit: `for (let i: byte = 0 to 256)` → error
- Unit: `for (i = 100 to 50)` → warning (never executes)
- Unit: `for (i = 50 to 100 downto)` → would need explicit downto, syntax check
- Unit: `for (i = 250 to 255 step 10)` → warning (overflow)

---

#### Task 4.5: Add While Loop Condition Analysis

**Objective**: Detect always-true/always-false conditions in while loops.

**File**: `packages/compiler/src/semantic/type-checker.ts`

**Checks**:
1. `while (true)` - intentional infinite loop (no warning)
2. `while (byte >= 0)` - always true for unsigned (warning)
3. `while (byte < 0)` - always false for unsigned (error)

**Implementation**:
```typescript
analyzeWhileCondition(condition: Expression): void {
  // Check for unsigned comparison pitfalls
  if (isBinaryExpression(condition)) {
    const left = condition.left;
    const right = condition.right;
    const leftType = this.getType(left);
    const rightType = this.getType(right);
    
    // Check: byte >= 0 is always true
    if (this.isUnsignedType(leftType) && 
        this.isZeroLiteral(right) &&
        condition.operator === '>=') {
      this.reportWarning(
        `Condition is always true: ${leftType.name} is unsigned and always >= 0`,
        condition.getLocation()
      );
    }
    
    // Check: byte < 0 is always false
    if (this.isUnsignedType(leftType) && 
        this.isZeroLiteral(right) &&
        condition.operator === '<') {
      this.reportError(
        `Condition is always false: ${leftType.name} is unsigned and never < 0`,
        condition.getLocation()
      );
    }
  }
}
```

**Tests**:
- Unit: `while (x >= 0)` where x is byte → warning
- Unit: `while (x < 0)` where x is byte → error
- Unit: `while (true)` → no warning (intentional)

---

#### Task 4.6: Update Semantic Analyzer Visitor

**Objective**: Wire up new visit methods in the semantic analyzer.

**Files to Modify**:
- `packages/compiler/src/semantic/type-checker.ts`
- `packages/compiler/src/semantic/analyzer.ts`
- Any other visitor implementations

**Actions**:
1. Add `visitDoWhileStatement` method
2. Add `visitTernaryExpression` method  
3. Add `visitSwitchStatement` method (or update existing visitMatchStatement)
4. Update `visitForStatement` with new logic

---

#### Task 4.7: Update Semantic Analyzer Tests

**Objective**: Comprehensive tests for all semantic changes.

**Files to Modify**:
- `packages/compiler/src/__tests__/semantic/`

**Test Categories**:
- Ternary expression type inference
- Do-while type checking
- For loop counter type inference
- For loop bounds checking
- While loop condition analysis
- Error messages are clear and helpful

---

## Task Implementation Checklist

### Phase 3: AST

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 3.1 | Update ForStatement AST node | None | [ ] |
| 3.2 | Create DoWhileStatement AST node | None | [ ] |
| 3.3 | Create TernaryExpression AST node | None | [ ] |
| 3.4 | Add ASTNodeType enum values | None | [ ] |
| 3.5 | Update type guards | 3.2, 3.3 | [ ] |
| 3.6 | Update ASTVisitor interface | 3.2, 3.3 | [ ] |
| 3.7 | Rename MatchStatement to SwitchStatement | None | [ ] |
| 3.8 | Update AST tests | 3.1-3.7 | [ ] |

### Phase 4: Semantic Analyzer

| Task | Description | Dependencies | Status |
|------|-------------|--------------|--------|
| 4.1 | Add ternary expression type checking | Phase 3 | [ ] |
| 4.2 | Add do-while statement analysis | Phase 3 | [ ] |
| 4.3 | Implement for loop counter type inference | Phase 3 | [ ] |
| 4.4 | Implement loop bounds overflow detection | 4.3 | [ ] |
| 4.5 | Add while loop condition analysis | None | [ ] |
| 4.6 | Update semantic analyzer visitor | 4.1-4.5 | [ ] |
| 4.7 | Update semantic analyzer tests | 4.1-4.6 | [ ] |

---

## Success Criteria

### Phase 3 Complete When:
- [ ] ForStatement has direction, step, variableType fields
- [ ] DoWhileStatement AST node exists
- [ ] TernaryExpression AST node exists
- [ ] Type guards work for new nodes
- [ ] Visitor pattern works for new nodes
- [ ] All AST tests pass

### Phase 4 Complete When:
- [ ] Ternary expressions type checked correctly
- [ ] Do-while conditions type checked
- [ ] For loop counter type inferred (byte/word)
- [ ] Overflow detection generates warnings/errors
- [ ] While loop pitfalls detected
- [ ] All semantic tests pass

---

## Next Document

Proceed to [03-codegen-docs.md](03-codegen-docs.md) for Phase 5 & 6 tasks (Code Generation & Documentation).