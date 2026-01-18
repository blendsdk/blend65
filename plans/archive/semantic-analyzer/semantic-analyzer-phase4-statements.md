# Semantic Analyzer Phase 4: Statement Validation

> **Phase**: 4 of 9
> **Focus**: Statement-level semantic validation
> **Dependencies**: Phase 1-3 must be complete
> **Duration**: 4-5 days
> **Tasks**: 12
> **Tests**: 80+

---

## **Phase Overview**

Phase 4 implements the fourth semantic analysis pass: validating statement-level semantics including control flow statements (break/continue), const assignments, and other statement-specific rules.

### **Objectives**

1. ✅ Validate break/continue usage
2. ✅ Enforce const assignment rules
3. ✅ Validate switch/case statements (if implemented)
4. ✅ Check label/goto usage (if implemented)
5. ✅ Validate statement-specific semantic rules
6. ✅ Produce clear validation error messages

### **What This Phase Produces**

- Validated control flow statements
- Const assignment enforcement
- Statement-level semantic guarantees
- Foundation for control flow analysis (Phase 5)

---

## **Statement Validator Architecture**

### **Statement Validator Visitor**

```typescript
/**
 * Statement validator - validates statement-level semantics
 */
export class StatementValidator extends ContextAwareWalker {
  /** Symbol table */
  protected symbolTable: SymbolTable;

  /** Type system */
  protected typeSystem: TypeSystem;

  /** Diagnostics collector */
  protected diagnostics: Diagnostic[];

  /** Loop nesting depth (for break/continue validation) */
  protected loopDepth: number;

  /** Switch nesting depth (for break validation) */
  protected switchDepth: number;

  constructor(symbolTable: SymbolTable, typeSystem: TypeSystem) {
    super();
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.diagnostics = [];
    this.loopDepth = 0;
    this.switchDepth = 0;
  }

  /**
   * Get collected diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  /**
   * Report a diagnostic
   */
  protected reportDiagnostic(diagnostic: Diagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  //
  // Loop Statements
  //

  public visitWhileStatement(node: WhileStatement): void {
    // Type check condition (already done in Phase 3, but verify it's boolean-compatible)
    const conditionType = node.condition.accept(this);

    // Enter loop context
    this.loopDepth++;

    // Validate body
    node.body.accept(this);

    // Exit loop context
    this.loopDepth--;
  }

  public visitForStatement(node: ForStatement): void {
    // Validate initializer
    if (node.init) {
      node.init.accept(this);
    }

    // Type check condition
    if (node.condition) {
      node.condition.accept(this);
    }

    // Validate update
    if (node.update) {
      node.update.accept(this);
    }

    // Enter loop context
    this.loopDepth++;

    // Validate body
    node.body.accept(this);

    // Exit loop context
    this.loopDepth--;
  }

  //
  // Break and Continue Statements
  //

  public visitBreakStatement(node: BreakStatement): void {
    // Break must be inside a loop or switch
    if (this.loopDepth === 0 && this.switchDepth === 0) {
      this.reportDiagnostic({
        severity: 'error',
        message: 'Break statement must be inside a loop or switch statement',
        location: node.location,
        code: 'E4001',
      });
    }
  }

  public visitContinueStatement(node: ContinueStatement): void {
    // Continue must be inside a loop
    if (this.loopDepth === 0) {
      this.reportDiagnostic({
        severity: 'error',
        message: 'Continue statement must be inside a loop',
        location: node.location,
        code: 'E4002',
      });
    }
  }

  //
  // Assignment Validation
  //

  public visitAssignmentExpression(node: AssignmentExpression): void {
    // Get left side symbol
    if (node.left.kind === 'Identifier') {
      const identifier = node.left as Identifier;
      const symbol = this.symbolTable.lookup(identifier.name);

      if (symbol && symbol.isConst) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Cannot assign to const variable '${identifier.name}'`,
          location: node.location,
          code: 'E4003',
        });
      }
    }

    // Validate compound assignments (+=, -=, etc.)
    if (node.operator !== '=') {
      // Compound assignment operators
      this.validateCompoundAssignment(node);
    }

    // Continue traversal
    node.left.accept(this);
    node.right.accept(this);
  }

  /**
   * Validate compound assignment operators
   */
  protected validateCompoundAssignment(node: AssignmentExpression): void {
    // Left side must be numeric for +=, -=, *=, /=, %=
    if (['+', '-', '*', '/', '%'].some(op => node.operator === `${op}=`)) {
      const leftType = node.left.accept(this);
      if (leftType.kind !== TypeKind.Byte && leftType.kind !== TypeKind.Word) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Compound assignment operator '${node.operator}' requires numeric operand`,
          location: node.left.location,
          code: 'E4004',
        });
      }
    }

    // Bitwise compound assignments (&=, |=, ^=, <<=, >>=)
    if (['&', '|', '^', '<<', '>>'].some(op => node.operator === `${op}=`)) {
      const leftType = node.left.accept(this);
      if (leftType.kind !== TypeKind.Byte && leftType.kind !== TypeKind.Word) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Bitwise compound assignment operator '${node.operator}' requires numeric operand`,
          location: node.left.location,
          code: 'E4005',
        });
      }
    }
  }

  //
  // Variable Declaration Validation
  //

  public visitVariableDecl(node: VariableDecl): void {
    // Const variables must have initializers
    if (node.isConst && !node.initializer) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Const variable '${node.name}' must have an initializer`,
        location: node.location,
        code: 'E4006',
      });
    }

    // Storage class validation
    this.validateStorageClass(node);

    // Visit initializer
    if (node.initializer) {
      node.initializer.accept(this);
    }
  }

  /**
   * Validate storage class constraints
   */
  protected validateStorageClass(node: VariableDecl): void {
    // Zero page variables have size limit
    if (node.storageClass === 'zp') {
      const symbol = this.symbolTable.lookupLocal(node.name);
      if (symbol && symbol.type) {
        // Check if variable fits in zero page
        // (Actual zero page allocation is done in Phase 6)
        if (symbol.type.kind === TypeKind.Array) {
          this.reportDiagnostic({
            severity: 'warning',
            message: `Array variable '${node.name}' with @zp storage may exceed zero page capacity`,
            location: node.location,
            code: 'W4001',
          });
        }
      }
    }

    // @data variables cannot have runtime initializers
    if (node.storageClass === 'data' && node.initializer) {
      if (!this.isCompileTimeConstant(node.initializer)) {
        this.reportDiagnostic({
          severity: 'error',
          message: `@data variable '${node.name}' must have a compile-time constant initializer`,
          location: node.initializer.location,
          code: 'E4007',
        });
      }
    }
  }

  /**
   * Check if an expression is a compile-time constant
   */
  protected isCompileTimeConstant(expr: Expression): boolean {
    if (expr.kind === 'NumberLiteral' || expr.kind === 'BooleanLiteral') {
      return true;
    }

    if (expr.kind === 'StringLiteral') {
      return true;
    }

    if (expr.kind === 'ArrayLiteral') {
      const arrayLiteral = expr as ArrayLiteral;
      return arrayLiteral.elements.every(elem => this.isCompileTimeConstant(elem));
    }

    if (expr.kind === 'BinaryExpression') {
      const binary = expr as BinaryExpression;
      return this.isCompileTimeConstant(binary.left) && this.isCompileTimeConstant(binary.right);
    }

    if (expr.kind === 'UnaryExpression') {
      const unary = expr as UnaryExpression;
      return this.isCompileTimeConstant(unary.operand);
    }

    return false;
  }

  //
  // Memory-Mapped Declaration Validation
  //

  public visitMapDecl(node: MapDecl): void {
    // @map must be at module scope
    const currentScope = this.symbolTable.getCurrentScope();
    if (currentScope.kind !== ScopeKind.Module) {
      this.reportDiagnostic({
        severity: 'error',
        message: `@map declaration '${node.name}' must be at module scope`,
        location: node.location,
        code: 'E4008',
      });
    }

    // Validate address expression is compile-time constant
    if (!this.isCompileTimeConstant(node.address)) {
      this.reportDiagnostic({
        severity: 'error',
        message: `@map address for '${node.name}' must be a compile-time constant`,
        location: node.address.location,
        code: 'E4009',
      });
    }

    // Visit address expression
    node.address.accept(this);
  }

  //
  // If Statement Validation
  //

  public visitIfStatement(node: IfStatement): void {
    // Validate condition
    node.condition.accept(this);

    // Validate then branch
    node.thenBranch.accept(this);

    // Validate else branch if present
    if (node.elseBranch) {
      node.elseBranch.accept(this);
    }
  }

  //
  // Expression Statement Validation
  //

  public visitExpressionStatement(node: ExpressionStatement): void {
    // Some expressions have no effect as statements
    const expr = node.expression;

    // Warn about expressions with no side effects
    if (this.hasNoSideEffects(expr)) {
      this.reportDiagnostic({
        severity: 'warning',
        message: 'Expression has no effect',
        location: expr.location,
        code: 'W4002',
      });
    }

    // Validate expression
    expr.accept(this);
  }

  /**
   * Check if an expression has side effects
   */
  protected hasNoSideEffects(expr: Expression): boolean {
    // Literals have no side effects
    if (
      expr.kind === 'NumberLiteral' ||
      expr.kind === 'BooleanLiteral' ||
      expr.kind === 'StringLiteral'
    ) {
      return true;
    }

    // Identifiers have no side effects
    if (expr.kind === 'Identifier') {
      return true;
    }

    // Binary expressions without side effects
    if (expr.kind === 'BinaryExpression') {
      const binary = expr as BinaryExpression;
      return this.hasNoSideEffects(binary.left) && this.hasNoSideEffects(binary.right);
    }

    // Unary expressions (except address-of which might be used)
    if (expr.kind === 'UnaryExpression') {
      const unary = expr as UnaryExpression;
      if (unary.operator === '@') {
        return false; // Address-of might be used
      }
      return this.hasNoSideEffects(unary.operand);
    }

    // Assignments, calls, and member expressions have side effects
    return false;
  }
}
```

---

## **Implementation Tasks**

### **Task 4.1: Statement Validator Base Class**

**Files to Create:**

- `src/semantic/visitors/statement-validator.ts`

**Implementation:**

1. Create `StatementValidator` class extending `ContextAwareWalker`
2. Add symbol table and type system references
3. Add diagnostics collection
4. Add loop depth tracking
5. Add switch depth tracking
6. Implement helper methods

**Tests:** (8 tests)

- Validator instantiation
- Symbol table access
- Loop depth tracking
- Switch depth tracking
- Diagnostics collection

**Time Estimate:** 4 hours

---

### **Task 4.2: Loop Statement Validation**

**Implementation:**

1. Implement `visitWhileStatement()`
2. Implement `visitForStatement()`
3. Track loop nesting depth
4. Validate loop bodies

**Tests:** (10 tests)

- While loop validation
- For loop validation
- Nested loops
- Loop depth tracking
- Empty loop bodies

**Time Estimate:** 3 hours

---

### **Task 4.3: Break/Continue Validation**

**Implementation:**

1. Implement `visitBreakStatement()`
2. Implement `visitContinueStatement()`
3. Check loop/switch context
4. Report errors for misplaced break/continue

**Tests:** (12 tests)

- Break in loop (valid)
- Break outside loop (error)
- Continue in loop (valid)
- Continue outside loop (error)
- Break in nested loops
- Continue in nested loops
- Break in switch (valid)
- Continue in switch (error)

**Time Estimate:** 4 hours

---

### **Task 4.4: Const Assignment Validation**

**Implementation:**

1. Update `visitAssignmentExpression()`
2. Check if left side is const
3. Report const assignment errors
4. Handle all assignment operators

**Tests:** (10 tests)

- Assign to const variable (error)
- Assign to non-const variable (valid)
- Compound assignment to const (error)
- Multiple const assignments (errors)

**Time Estimate:** 3 hours

---

### **Task 4.5: Compound Assignment Validation**

**Implementation:**

1. Implement `validateCompoundAssignment()`
2. Check operator compatibility with types
3. Validate arithmetic compound assignments (+=, -=, etc.)
4. Validate bitwise compound assignments (&=, |=, etc.)

**Tests:** (10 tests)

- += with numeric types (valid)
- += with non-numeric types (error)
- &= with numeric types (valid)
- &= with non-numeric types (error)
- All compound operators

**Time Estimate:** 4 hours

---

### **Task 4.6: Variable Declaration Validation**

**Implementation:**

1. Implement `visitVariableDecl()`
2. Check const variables have initializers
3. Validate storage class constraints
4. Check @data compile-time initializers

**Tests:** (12 tests)

- Const without initializer (error)
- Const with initializer (valid)
- @data with compile-time constant (valid)
- @data with runtime expression (error)
- @zp with large array (warning)
- Storage class combinations

**Time Estimate:** 4 hours

---

### **Task 4.7: Compile-Time Constant Detection**

**Implementation:**

1. Implement `isCompileTimeConstant()`
2. Check literals (always constant)
3. Check binary expressions (both sides constant)
4. Check unary expressions (operand constant)
5. Check array literals (all elements constant)

**Tests:** (10 tests)

- Number literals are constant
- String literals are constant
- Identifier is not constant
- Constant arithmetic (1 + 2) is constant
- Variable reference (x + 1) is not constant
- Array of constants is constant
- Array with variables is not constant

**Time Estimate:** 4 hours

---

### **Task 4.8: Memory-Mapped Declaration Validation**

**Implementation:**

1. Implement `visitMapDecl()`
2. Check @map is at module scope
3. Validate address is compile-time constant
4. Report errors for invalid @map usage

**Tests:** (10 tests)

- @map at module scope (valid)
- @map in function (error)
- @map with constant address (valid)
- @map with variable address (error)
- @map with expression address
- All 4 @map forms

**Time Estimate:** 3 hours

---

### **Task 4.9: If Statement Validation**

**Implementation:**

1. Implement `visitIfStatement()`
2. Validate condition
3. Validate then/else branches
4. No special validation needed beyond type checking

**Tests:** (5 tests)

- If statement with valid condition
- If with then and else
- Nested if statements

**Time Estimate:** 2 hours

---

### **Task 4.10: Expression Statement Validation**

**Implementation:**

1. Implement `visitExpressionStatement()`
2. Implement `hasNoSideEffects()`
3. Warn about expressions with no side effects
4. Validate expression

**Tests:** (8 tests)

- Expression statement with call (valid)
- Expression statement with assignment (valid)
- Expression statement with literal (warning)
- Expression statement with identifier (warning)
- Side effect detection

**Time Estimate:** 3 hours

---

### **Task 4.11: Storage Class Validation**

**Implementation:**

1. Implement `validateStorageClass()`
2. Check @zp size constraints
3. Check @data initializer constraints
4. Warn about potential issues

**Tests:** (8 tests)

- @zp with byte (valid)
- @zp with large array (warning)
- @data with constant (valid)
- @data with variable (error)
- @ram (always valid)

**Time Estimate:** 4 hours

---

### **Task 4.12: Integration and Testing**

**Files to Create:**

- `src/semantic/__tests__/statement-validator.test.ts`
- `src/semantic/__tests__/statement-validation-integration.test.ts`

**Tests:** (20+ integration tests)

- End-to-end: Validate complete programs
- Complex control flow
- Const enforcement scenarios
- Storage class scenarios
- Error cases

**Time Estimate:** 6 hours

---

## **Task Implementation Checklist**

| Task | Description                     | Dependencies | Status |
| ---- | ------------------------------- | ------------ | ------ |
| 4.1  | Statement validator base class  | Phase 3      | [ ]    |
| 4.2  | Loop statement validation       | 4.1          | [ ]    |
| 4.3  | Break/continue validation       | 4.1, 4.2     | [ ]    |
| 4.4  | Const assignment validation     | 4.1          | [ ]    |
| 4.5  | Compound assignment validation  | 4.1          | [ ]    |
| 4.6  | Variable declaration validation | 4.1          | [ ]    |
| 4.7  | Compile-time constant detection | 4.1          | [ ]    |
| 4.8  | Memory-mapped validation        | 4.1, 4.7     | [ ]    |
| 4.9  | If statement validation         | 4.1          | [ ]    |
| 4.10 | Expression statement validation | 4.1          | [ ]    |
| 4.11 | Storage class validation        | 4.1, 4.7     | [ ]    |
| 4.12 | Integration testing             | 4.1-4.11     | [ ]    |

**Total**: 12 tasks, 80+ tests, ~4-5 days

---

## **Success Criteria**

Phase 4 is complete when:

- ✅ All 12 tasks completed
- ✅ 80+ tests passing
- ✅ Break/continue properly validated
- ✅ Const assignments enforced
- ✅ Storage classes validated
- ✅ Compile-time constants detected
- ✅ @map scope rules enforced
- ✅ Clear error messages
- ✅ Ready for Phase 5

---

## **Next Phase**

**After Phase 4 completion:**

Proceed to **Phase 5: Control Flow Analysis**

- Build control flow graphs (CFG)
- Reachability analysis
- Dead code detection
- Definite assignment analysis

---

**Ready to validate statements! 🎯**
