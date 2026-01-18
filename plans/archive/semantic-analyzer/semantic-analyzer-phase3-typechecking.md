# Semantic Analyzer Phase 3: Type Checking

> **Phase**: 3 of 9
> **Focus**: Expression and statement type checking
> **Dependencies**: Phase 1 (Symbol Tables) and Phase 2 (Type Resolution) must be complete
> **Duration**: 1 week
> **Tasks**: 18
> **Tests**: 120+

---

## **Phase Overview**

Phase 3 implements the third semantic analysis pass: comprehensive type checking for all expressions, assignments, function calls, and return statements.

### **Objectives**

1. ✅ Type check all expressions
2. ✅ Validate assignments
3. ✅ Check function calls
4. ✅ Verify return types
5. ✅ Annotate AST with type information
6. ✅ Produce meaningful type error messages

### **What This Phase Produces**

- Fully type-checked AST
- Type annotations on all expression nodes
- Comprehensive type error diagnostics
- Foundation for code generation

---

## **Type Checker Architecture**

### **Type Checker Visitor**

```typescript
/**
 * Type checker - type checks all expressions and statements
 */
export class TypeChecker extends ContextAwareWalker {
  /** Type system from Phase 2 */
  protected typeSystem: TypeSystem;

  /** Symbol table from Phase 1 */
  protected symbolTable: SymbolTable;

  /** Diagnostics collector */
  protected diagnostics: Diagnostic[];

  /** Current function return type (for return statement checking) */
  protected currentFunctionReturnType: TypeInfo | null;

  constructor(symbolTable: SymbolTable, typeSystem: TypeSystem) {
    super();
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.diagnostics = [];
    this.currentFunctionReturnType = null;
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
  // Literal Expressions
  //

  public visitNumberLiteral(node: NumberLiteral): TypeInfo {
    // Determine type based on value
    let type: TypeInfo;

    if (node.value <= 255) {
      type = this.typeSystem.getBuiltinType('byte')!;
    } else if (node.value <= 65535) {
      type = this.typeSystem.getBuiltinType('word')!;
    } else {
      // Value too large
      this.reportDiagnostic({
        severity: 'error',
        message: `Number literal ${node.value} exceeds maximum value 65535`,
        location: node.location,
        code: 'E3001',
      });
      type = this.typeSystem.getBuiltinType('word')!;
    }

    // Annotate node with type
    node.typeInfo = type;
    return type;
  }

  public visitBooleanLiteral(node: BooleanLiteral): TypeInfo {
    const type = this.typeSystem.getBuiltinType('boolean')!;
    node.typeInfo = type;
    return type;
  }

  public visitStringLiteral(node: StringLiteral): TypeInfo {
    const type = this.typeSystem.getBuiltinType('string')!;
    node.typeInfo = type;
    return type;
  }

  public visitArrayLiteral(node: ArrayLiteral): TypeInfo {
    if (node.elements.length === 0) {
      // Empty array - cannot infer type
      this.reportDiagnostic({
        severity: 'error',
        message: 'Cannot infer type of empty array literal',
        location: node.location,
        code: 'E3002',
      });
      const type = this.typeSystem.createArrayType(this.typeSystem.getBuiltinType('byte')!, 0);
      node.typeInfo = type;
      return type;
    }

    // Type check first element to determine array type
    const firstElementType = node.elements[0].accept(this);

    // Type check remaining elements and ensure they match
    for (let i = 1; i < node.elements.length; i++) {
      const elementType = node.elements[i].accept(this);
      if (!this.typeSystem.canAssign(elementType, firstElementType)) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Array element type mismatch: expected '${firstElementType.name}', got '${elementType.name}'`,
          location: node.elements[i].location,
          code: 'E3003',
        });
      }
    }

    // Create array type
    const type = this.typeSystem.createArrayType(firstElementType, node.elements.length);
    node.typeInfo = type;
    return type;
  }

  //
  // Identifier Expression
  //

  public visitIdentifier(node: Identifier): TypeInfo {
    // Lookup symbol in symbol table
    const symbol = this.symbolTable.lookup(node.name);

    if (!symbol) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Undefined variable '${node.name}'`,
        location: node.location,
        code: 'E3004',
      });
      const type: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      node.typeInfo = type;
      return type;
    }

    if (!symbol.type) {
      // Symbol exists but has no type (should not happen after Phase 2)
      this.reportDiagnostic({
        severity: 'error',
        message: `Variable '${node.name}' has no type information`,
        location: node.location,
        code: 'E3005',
      });
      const type: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      node.typeInfo = type;
      return type;
    }

    node.typeInfo = symbol.type;
    return symbol.type;
  }

  //
  // Binary Expressions
  //

  public visitBinaryExpression(node: BinaryExpression): TypeInfo {
    // Type check operands
    const leftType = node.left.accept(this);
    const rightType = node.right.accept(this);

    // Get result type from type system
    const resultType = this.typeSystem.getBinaryOperationType(leftType, rightType, node.operator);

    // Check for unknown type (invalid operation)
    if (resultType.kind === TypeKind.Unknown) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Invalid binary operation: '${leftType.name}' ${node.operator} '${rightType.name}'`,
        location: node.location,
        code: 'E3006',
      });
    }

    node.typeInfo = resultType;
    return resultType;
  }

  //
  // Unary Expressions
  //

  public visitUnaryExpression(node: UnaryExpression): TypeInfo {
    // Type check operand
    const operandType = node.operand.accept(this);

    // Get result type from type system
    const resultType = this.typeSystem.getUnaryOperationType(operandType, node.operator);

    // Check for unknown type (invalid operation)
    if (resultType.kind === TypeKind.Unknown) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Invalid unary operation: ${node.operator} '${operandType.name}'`,
        location: node.location,
        code: 'E3007',
      });
    }

    // Special case: address-of operator
    if (node.operator === '@') {
      // Ensure operand is an lvalue
      if (!this.isLValue(node.operand)) {
        this.reportDiagnostic({
          severity: 'error',
          message: 'Address-of operator requires an lvalue',
          location: node.location,
          code: 'E3008',
        });
      }
    }

    node.typeInfo = resultType;
    return resultType;
  }

  //
  // Assignment Expression
  //

  public visitAssignmentExpression(node: AssignmentExpression): TypeInfo {
    // Type check left side (must be lvalue)
    const leftType = node.left.accept(this);

    // Check if left side is assignable
    if (!this.isLValue(node.left)) {
      this.reportDiagnostic({
        severity: 'error',
        message: 'Left side of assignment must be an lvalue',
        location: node.left.location,
        code: 'E3009',
      });
    }

    // Check if left side is const
    if (this.isConst(node.left)) {
      this.reportDiagnostic({
        severity: 'error',
        message: 'Cannot assign to const variable',
        location: node.left.location,
        code: 'E3010',
      });
    }

    // Type check right side
    const rightType = node.right.accept(this);

    // Check type compatibility
    if (!this.typeSystem.canAssign(rightType, leftType)) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Type mismatch in assignment: cannot assign '${rightType.name}' to '${leftType.name}'`,
        location: node.location,
        code: 'E3011',
      });
    }

    // Assignment expression has the type of the left side
    node.typeInfo = leftType;
    return leftType;
  }

  //
  // Function Call Expression
  //

  public visitCallExpression(node: CallExpression): TypeInfo {
    // Type check callee
    const calleeType = node.callee.accept(this);

    // Check if callee is callable (function or callback)
    if (calleeType.kind !== TypeKind.Callback) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Expression is not callable (type: '${calleeType.name}')`,
        location: node.callee.location,
        code: 'E3012',
      });
      const type: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      node.typeInfo = type;
      return type;
    }

    const signature = calleeType.signature!;

    // Check argument count
    if (node.arguments.length !== signature.parameters.length) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Expected ${signature.parameters.length} arguments, got ${node.arguments.length}`,
        location: node.location,
        code: 'E3013',
      });
    }

    // Type check arguments
    const argCount = Math.min(node.arguments.length, signature.parameters.length);
    for (let i = 0; i < argCount; i++) {
      const argType = node.arguments[i].accept(this);
      const paramType = signature.parameters[i];

      if (!this.typeSystem.canAssign(argType, paramType)) {
        const paramName = signature.parameterNames?.[i] || `parameter ${i + 1}`;
        this.reportDiagnostic({
          severity: 'error',
          message: `Argument type mismatch for '${paramName}': expected '${paramType.name}', got '${argType.name}'`,
          location: node.arguments[i].location,
          code: 'E3014',
        });
      }
    }

    // Call expression has the return type of the function
    node.typeInfo = signature.returnType;
    return signature.returnType;
  }

  //
  // Member Access Expression
  //

  public visitMemberExpression(node: MemberExpression): TypeInfo {
    // Type check object
    const objectType = node.object.accept(this);

    // Check if object is an array
    if (objectType.kind !== TypeKind.Array) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Cannot access member of non-array type '${objectType.name}'`,
        location: node.location,
        code: 'E3015',
      });
      const type: TypeInfo = {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
      node.typeInfo = type;
      return type;
    }

    // Type check index
    const indexType = node.property.accept(this);

    // Index must be numeric (byte or word)
    if (indexType.kind !== TypeKind.Byte && indexType.kind !== TypeKind.Word) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Array index must be numeric, got '${indexType.name}'`,
        location: node.property.location,
        code: 'E3016',
      });
    }

    // Member access returns element type
    const elementType = objectType.elementType!;
    node.typeInfo = elementType;
    return elementType;
  }

  //
  // Variable Declaration
  //

  public visitVariableDecl(node: VariableDecl): void {
    // Get symbol from symbol table
    const symbol = this.symbolTable.lookupLocal(node.name);
    if (!symbol || !symbol.type) {
      return; // Error already reported in Phase 1 or 2
    }

    // Type check initializer if present
    if (node.initializer) {
      const initType = node.initializer.accept(this);

      // Check type compatibility
      if (!this.typeSystem.canAssign(initType, symbol.type)) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Type mismatch in variable initialization: cannot assign '${initType.name}' to '${symbol.type.name}'`,
          location: node.initializer.location,
          code: 'E3017',
        });
      }
    }
  }

  //
  // Function Declaration
  //

  public visitFunctionDecl(node: FunctionDecl): void {
    // Get function symbol
    const symbol = this.symbolTable.lookupLocal(node.name);
    if (!symbol || !symbol.type || !symbol.type.signature) {
      return; // Error already reported
    }

    // Set current function return type
    this.currentFunctionReturnType = symbol.type.signature.returnType;

    // Enter function scope
    this.symbolTable.enterScope(this.getScopeForNode(node)!);

    // Type check function body
    if (node.body) {
      node.body.accept(this);
    }

    // Exit function scope
    this.symbolTable.exitScope();

    // Check if non-void function has return statement
    if (this.currentFunctionReturnType.kind !== TypeKind.Void && !this.allPathsReturn(node.body!)) {
      this.reportDiagnostic({
        severity: 'error',
        message: `Function '${node.name}' must return a value of type '${this.currentFunctionReturnType.name}'`,
        location: node.location,
        code: 'E3018',
      });
    }

    // Clear current function return type
    this.currentFunctionReturnType = null;
  }

  //
  // Return Statement
  //

  public visitReturnStatement(node: ReturnStatement): void {
    if (!this.currentFunctionReturnType) {
      this.reportDiagnostic({
        severity: 'error',
        message: 'Return statement outside function',
        location: node.location,
        code: 'E3019',
      });
      return;
    }

    if (node.value) {
      // Type check return value
      const returnType = node.value.accept(this);

      // Check type compatibility
      if (!this.typeSystem.canAssign(returnType, this.currentFunctionReturnType)) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Return type mismatch: expected '${this.currentFunctionReturnType.name}', got '${returnType.name}'`,
          location: node.value.location,
          code: 'E3020',
        });
      }
    } else {
      // Return without value
      if (this.currentFunctionReturnType.kind !== TypeKind.Void) {
        this.reportDiagnostic({
          severity: 'error',
          message: `Function must return a value of type '${this.currentFunctionReturnType.name}'`,
          location: node.location,
          code: 'E3021',
        });
      }
    }
  }

  //
  // Helper Methods
  //

  /**
   * Check if an expression is an lvalue (can be assigned to)
   */
  protected isLValue(expr: Expression): boolean {
    if (expr.kind === 'Identifier') {
      return true;
    }
    if (expr.kind === 'MemberExpression') {
      return true;
    }
    return false;
  }

  /**
   * Check if an expression refers to a const variable
   */
  protected isConst(expr: Expression): boolean {
    if (expr.kind === 'Identifier') {
      const symbol = this.symbolTable.lookup((expr as Identifier).name);
      return symbol?.isConst || false;
    }
    return false;
  }

  /**
   * Check if all paths in a block return
   */
  protected allPathsReturn(block: BlockStatement): boolean {
    // Implementation would check if all code paths contain a return statement
    // Simplified version: check if block contains at least one return
    for (const stmt of block.statements) {
      if (stmt.kind === 'ReturnStatement') {
        return true;
      }
    }
    return false;
  }

  /**
   * Get scope for an AST node
   */
  protected getScopeForNode(node: ASTNode): Scope | null {
    // Implementation depends on symbol table structure
    return null;
  }
}
```

---

## **Implementation Tasks**

### **Task 3.1: Type Checker Base Class**

**Files to Create:**

- `src/semantic/visitors/type-checker.ts`

**Implementation:**

1. Create `TypeChecker` class extending `ContextAwareWalker`
2. Add type system and symbol table references
3. Add diagnostics collection
4. Add current function return type tracking
5. Implement helper methods (isLValue, isConst, etc.)

**Tests:** (8 tests)

- Type checker instantiation
- Type system access
- Symbol table access
- Diagnostics collection
- Helper methods

**Time Estimate:** 4 hours

---

### **Task 3.2: Literal Expression Type Checking**

**Implementation:**

1. Implement `visitNumberLiteral()` - infer byte vs word
2. Implement `visitBooleanLiteral()`
3. Implement `visitStringLiteral()`
4. Implement `visitArrayLiteral()` - check element types
5. Report errors for literals out of range

**Tests:** (12 tests)

- Number literal: 0-255 is byte
- Number literal: 256-65535 is word
- Number literal: >65535 is error
- Boolean literal type
- String literal type
- Empty array literal (error)
- Array literal with uniform types
- Array literal with mixed types (error)
- Annotate nodes with types

**Time Estimate:** 4 hours

---

### **Task 3.3: Identifier Expression Type Checking**

**Implementation:**

1. Implement `visitIdentifier()`
2. Lookup symbol in symbol table
3. Report error for undefined variables
4. Return symbol type
5. Annotate node with type

**Tests:** (8 tests)

- Identifier with valid type
- Undefined identifier (error)
- Identifier without type info (error)
- Annotate node with type
- Lookup in current scope
- Lookup in parent scope

**Time Estimate:** 3 hours

---

### **Task 3.4: Binary Expression Type Checking**

**Implementation:**

1. Implement `visitBinaryExpression()`
2. Type check left and right operands
3. Get result type from type system
4. Report errors for invalid operations
5. Annotate node with result type

**Tests:** (15 tests)

- Arithmetic: byte + byte = byte
- Arithmetic: word + byte = word
- Arithmetic: byte + word = word
- Comparison: byte < word = boolean
- Logical: boolean && boolean = boolean
- Bitwise: byte & byte = byte
- Invalid operations (error)
- All operators covered
- Annotate nodes

**Time Estimate:** 5 hours

---

### **Task 3.5: Unary Expression Type Checking**

**Implementation:**

1. Implement `visitUnaryExpression()`
2. Type check operand
3. Get result type from type system
4. Handle address-of operator (@)
5. Validate lvalue for address-of
6. Report errors for invalid operations

**Tests:** (10 tests)

- Logical NOT: !boolean = boolean
- Bitwise NOT: ~byte = byte
- Address-of: @variable = word
- Address-of non-lvalue (error)
- Negation: -byte = byte
- Invalid operations (error)

**Time Estimate:** 4 hours

---

### **Task 3.6: Assignment Expression Type Checking**

**Implementation:**

1. Implement `visitAssignmentExpression()`
2. Check left side is lvalue
3. Check left side is not const
4. Type check right side
5. Verify type compatibility
6. Report errors

**Tests:** (12 tests)

- Valid assignment: byte = byte
- Valid assignment: word = byte (widening)
- Invalid assignment: byte = word (error)
- Assign to non-lvalue (error)
- Assign to const (error)
- Array element assignment
- Member expression assignment

**Time Estimate:** 4 hours

---

### **Task 3.7: Function Call Type Checking**

**Implementation:**

1. Implement `visitCallExpression()`
2. Type check callee
3. Verify callee is callable
4. Check argument count
5. Type check each argument
6. Verify argument type compatibility
7. Return function return type

**Tests:** (15 tests)

- Call with correct arguments
- Call with wrong argument count (error)
- Call with wrong argument types (error)
- Call non-function (error)
- Call with no arguments
- Call with multiple arguments
- Void function call
- Non-void function call

**Time Estimate:** 5 hours

---

### **Task 3.8: Member/Array Access Type Checking**

**Implementation:**

1. Implement `visitMemberExpression()`
2. Type check object
3. Verify object is array
4. Type check index
5. Verify index is numeric
6. Return element type

**Tests:** (10 tests)

- Array access with byte index
- Array access with word index
- Array access with non-numeric index (error)
- Non-array member access (error)
- Nested array access
- Return correct element type

**Time Estimate:** 4 hours

---

### **Task 3.9: Variable Declaration Type Checking**

**Implementation:**

1. Implement `visitVariableDecl()`
2. Get symbol type from symbol table
3. Type check initializer if present
4. Verify initializer type compatibility
5. Report type mismatch errors

**Tests:** (10 tests)

- Variable with valid initializer
- Variable with type mismatch (error)
- Variable without initializer
- Const variable with initializer
- Exported variable with initializer
- @zp variable with initializer

**Time Estimate:** 3 hours

---

### **Task 3.10: Function Declaration Type Checking**

**Implementation:**

1. Implement `visitFunctionDecl()`
2. Get function signature from symbol
3. Set current function return type
4. Enter function scope
5. Type check function body
6. Exit function scope
7. Verify all paths return (if non-void)

**Tests:** (12 tests)

- Function with return statement
- Function without return statement (void)
- Function without return statement (non-void, error)
- Function with multiple returns
- Function with conditional returns
- Check return type compatibility

**Time Estimate:** 5 hours

---

### **Task 3.11: Return Statement Type Checking**

**Implementation:**

1. Implement `visitReturnStatement()`
2. Check if inside function
3. Type check return value if present
4. Verify return type matches function
5. Handle void functions (no return value)
6. Report errors

**Tests:** (10 tests)

- Return with value in non-void function
- Return without value in void function
- Return with wrong type (error)
- Return without value in non-void function (error)
- Return outside function (error)

**Time Estimate:** 4 hours

---

### **Task 3.12: Control Flow Statement Type Checking**

**Implementation:**

1. Implement `visitIfStatement()`
2. Type check condition (must be boolean-compatible)
3. Type check then/else branches
4. Implement `visitWhileStatement()`
5. Implement `visitForStatement()`

**Tests:** (10 tests)

- If with boolean condition
- If with non-boolean condition (type coercion or error)
- While with boolean condition
- For loop type checking
- Nested control flow

**Time Estimate:** 4 hours

---

### **Task 3.13: Block Statement Type Checking**

**Implementation:**

1. Implement `visitBlockStatement()`
2. Type check all statements in block
3. No new scope (function-scoped language)

**Tests:** (5 tests)

- Block with multiple statements
- Empty block
- Block with declarations
- Nested blocks

**Time Estimate:** 2 hours

---

### **Task 3.14: Expression Statement Type Checking**

**Implementation:**

1. Implement `visitExpressionStatement()`
2. Type check the expression
3. Discard result type

**Tests:** (5 tests)

- Expression statement with valid expression
- Expression statement with function call
- Expression statement with assignment

**Time Estimate:** 2 hours

---

### **Task 3.15: Memory-Mapped Declaration Type Checking**

**Implementation:**

1. Implement `visitMapDecl()`
2. Type check address expression
3. Verify address is numeric (word)

**Tests:** (8 tests)

- @map with numeric address
- @map with expression address
- @map with non-numeric address (error)
- All 4 @map forms

**Time Estimate:** 3 hours

---

### **Task 3.16: Helper Methods**

**Implementation:**

1. Implement `isLValue()` - check if expression can be assigned to
2. Implement `isConst()` - check if expression is const
3. Implement `allPathsReturn()` - control flow analysis
4. Implement `getScopeForNode()` - scope lookup

**Tests:** (10 tests)

- isLValue for identifiers
- isLValue for member expressions
- isLValue for literals (false)
- isConst detection
- allPathsReturn analysis

**Time Estimate:** 4 hours

---

### **Task 3.17: Error Message Quality**

**Implementation:**

1. Improve all error messages
2. Add suggestions where possible
3. Include relevant context
4. Add error codes for all diagnostics

**Tests:** (10 tests)

- Verify error message quality
- Check error codes
- Validate suggestions
- Test formatting

**Time Estimate:** 4 hours

---

### **Task 3.18: Integration and Testing**

**Files to Create:**

- `src/semantic/__tests__/type-checker.test.ts`
- `src/semantic/__tests__/type-checking-integration.test.ts`

**Tests:** (20+ integration tests)

- End-to-end: Type check complete programs
- Complex expressions
- Function calls with various signatures
- Error scenarios
- Edge cases

**Time Estimate:** 6 hours

---

## **Task Implementation Checklist**

| Task | Description                        | Dependencies | Status |
| ---- | ---------------------------------- | ------------ | ------ |
| 3.1  | Type checker base class            | Phase 2      | [ ]    |
| 3.2  | Literal expression type checking   | 3.1          | [ ]    |
| 3.3  | Identifier type checking           | 3.1          | [ ]    |
| 3.4  | Binary expression type checking    | 3.1          | [ ]    |
| 3.5  | Unary expression type checking     | 3.1          | [ ]    |
| 3.6  | Assignment type checking           | 3.1          | [ ]    |
| 3.7  | Function call type checking        | 3.1          | [ ]    |
| 3.8  | Member/array access type checking  | 3.1          | [ ]    |
| 3.9  | Variable declaration type checking | 3.1          | [ ]    |
| 3.10 | Function declaration type checking | 3.1          | [ ]    |
| 3.11 | Return statement type checking     | 3.1          | [ ]    |
| 3.12 | Control flow statement checking    | 3.1          | [ ]    |
| 3.13 | Block statement type checking      | 3.1          | [ ]    |
| 3.14 | Expression statement checking      | 3.1          | [ ]    |
| 3.15 | Memory-mapped type checking        | 3.1          | [ ]    |
| 3.16 | Helper methods                     | 3.1          | [ ]    |
| 3.17 | Error message quality              | 3.1-3.16     | [ ]    |
| 3.18 | Integration testing                | 3.1-3.17     | [ ]    |

**Total**: 18 tasks, 120+ tests, ~1 week

---

## **Success Criteria**

Phase 3 is complete when:

- ✅ All 18 tasks completed
- ✅ 120+ tests passing
- ✅ All expressions type-checked
- ✅ All statements validated
- ✅ Function calls verified
- ✅ Return types checked
- ✅ AST fully annotated with types
- ✅ God-level error messages
- ✅ Ready for Phase 4

---

## **Next Phase**

**After Phase 3 completion:**

Proceed to **Phase 4: Statement Validation**

- Control flow validation (break/continue)
- Const assignment validation
- Statement-level semantic checks

---

**Ready to type check! ✅**
