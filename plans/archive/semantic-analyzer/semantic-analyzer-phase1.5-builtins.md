# Semantic Analyzer Phase 1.5: Built-In Functions (Compiler Intrinsics)

> **Phase**: 1.5 (inserted between Phase 1 and Phase 2)
> **Focus**: Compiler intrinsic functions (peek, poke, length, sizeof, etc.)
> **Dependencies**: Phase 1 (Symbol Tables) complete
> **Duration**: 2 days
> **Tasks**: 8
> **Tests**: 40+

---

## **Phase Overview**

Phase 1.5 implements **compiler intrinsic functions** - built-in functions that don't need source declarations and receive special treatment from the compiler. These functions are essential for low-level memory access and system programming on the 6502.

### **Objectives**

1. ✅ Create built-in function registry in TypeSystem
2. ✅ Register critical intrinsics (peek, poke, peekw, pokew, length, sizeof)
3. ✅ Integrate with type checking (special handling in visitCallExpression)
4. ✅ Mark intrinsic calls for code generation
5. ✅ Support both compile-time and runtime intrinsics

### **What This Phase Produces**

- Built-in function registry accessible to type checker
- Special type checking for intrinsic calls
- AST annotations marking intrinsic calls
- Foundation for code generator intrinsic handling

---

## **Built-In Functions to Implement**

### **Category 1: Memory Access (CRITICAL)**

**`peek(address: word): byte`**

- Read byte from memory address
- Runtime intrinsic (generates LDA instruction)
- Most fundamental memory operation

**`poke(address: word, value: byte): void`**

- Write byte to memory address
- Runtime intrinsic (generates STA instruction)
- Essential for hardware access

**`peekw(address: word): word`**

- Read 16-bit word from memory (little-endian)
- Runtime intrinsic (generates LDA/LDA sequence)
- Essential for reading pointers

**`pokew(address: word, value: word): void`**

- Write 16-bit word to memory (little-endian)
- Runtime intrinsic (generates STA/STA sequence)
- Essential for writing pointers

### **Category 2: Array/String Utilities (CRITICAL)**

**`length(array: T[]): word`**

- Get array length at runtime
- Returns array size from metadata
- Overloaded for strings

**`length(str: string): word`**

- Get string length at runtime
- Returns string size from metadata
- Same function name, different parameter type

### **Category 3: Type Introspection (CRITICAL)**

**`sizeof(type: Type): byte`**

- Get size of type in bytes
- **Compile-time intrinsic** (no runtime code)
- Computed entirely from TypeInfo
- Examples: `sizeof(byte)` → 1, `sizeof(word)` → 2

---

## **Architecture Design**

### **Built-In Function Data Structure**

```typescript
// packages/compiler/src/semantic/types.ts

/**
 * Built-in function (compiler intrinsic)
 *
 * These are functions known to the compiler that receive special treatment.
 * They may be compile-time evaluated, emit inline assembly, or generate
 * optimized code sequences.
 */
export interface BuiltInFunction {
  /** Function name (identifier used in code) */
  name: string;

  /** Function signature (parameters and return type) */
  signature: FunctionSignature;

  /** Intrinsic identifier for code generation */
  intrinsicId: string;

  /** Human-readable description */
  description: string;

  /** True if this is compile-time evaluated (no runtime code) */
  isCompileTime: boolean;

  /** True if this is a runtime intrinsic (generates special code) */
  isIntrinsic: boolean;

  /** Category for organization */
  category: 'memory' | 'array' | 'type' | 'math' | 'system';
}
```

### **TypeSystem Extension**

```typescript
// packages/compiler/src/semantic/type-system.ts

export class TypeSystem {
  /** Built-in function registry */
  protected builtins: Map<string, BuiltInFunction>;

  constructor() {
    this.initializeBuiltinTypes();
    this.initializeBuiltInFunctions(); // NEW
  }

  /**
   * Initialize all built-in functions (compiler intrinsics)
   */
  protected initializeBuiltInFunctions(): void {
    this.builtins = new Map();

    // Category 1: Memory Access
    this.registerBuiltIn({
      name: 'peek',
      intrinsicId: 'intrinsic_peek',
      category: 'memory',
      description: 'Read byte from memory address',
      isCompileTime: false,
      isIntrinsic: true,
      signature: {
        parameters: [this.getBuiltinType('word')!],
        parameterNames: ['address'],
        returnType: this.getBuiltinType('byte')!,
      },
    });

    this.registerBuiltIn({
      name: 'poke',
      intrinsicId: 'intrinsic_poke',
      category: 'memory',
      description: 'Write byte to memory address',
      isCompileTime: false,
      isIntrinsic: true,
      signature: {
        parameters: [this.getBuiltinType('word')!, this.getBuiltinType('byte')!],
        parameterNames: ['address', 'value'],
        returnType: this.getVoidType(),
      },
    });

    // ... register all other intrinsics
  }

  /**
   * Register a built-in function
   */
  protected registerBuiltIn(builtin: BuiltInFunction): void {
    this.builtins.set(builtin.name, builtin);
  }

  /**
   * Get built-in function by name
   */
  public getBuiltInFunction(name: string): BuiltInFunction | undefined {
    return this.builtins.get(name);
  }

  /**
   * Check if identifier is a built-in function
   */
  public isBuiltInFunction(name: string): boolean {
    return this.builtins.has(name);
  }

  /**
   * Get all built-in functions
   */
  public getAllBuiltInFunctions(): BuiltInFunction[] {
    return Array.from(this.builtins.values());
  }

  /**
   * Get built-in functions by category
   */
  public getBuiltInsByCategory(category: BuiltInFunction['category']): BuiltInFunction[] {
    return Array.from(this.builtins.values()).filter(b => b.category === category);
  }
}
```

### **Type Checking Integration**

```typescript
// packages/compiler/src/semantic/visitors/type-checker/assignments.ts

public visitCallExpression(node: CallExpression): void {
  const calleeExpr = node.getCallee();

  // SPECIAL CASE: Built-in function call (intrinsic)
  if (calleeExpr.constructor.name === 'IdentifierExpression') {
    const identifier = calleeExpr as IdentifierExpression;
    const name = identifier.getName();
    const builtin = this.typeSystem.getBuiltInFunction(name);

    if (builtin) {
      // Type check as built-in intrinsic
      this.typeCheckBuiltInCall(node, builtin);
      return;
    }
  }

  // Regular function call (existing code)
  const calleeType = this.typeCheckExpression(calleeExpr);
  // ... rest of existing logic
}

/**
 * Type check built-in function call
 *
 * Handles special semantics for compiler intrinsics:
 * - Compile-time evaluation (sizeof)
 * - Overloaded functions (length)
 * - Runtime intrinsics (peek, poke)
 */
protected typeCheckBuiltInCall(
  node: CallExpression,
  builtin: BuiltInFunction
): void {
  const args = node.getArguments();

  // Special case: sizeof (compile-time intrinsic)
  if (builtin.intrinsicId === 'intrinsic_sizeof') {
    this.typeCheckSizeof(node, args);
    return;
  }

  // Special case: length (overloaded for arrays and strings)
  if (builtin.intrinsicId === 'intrinsic_length') {
    this.typeCheckLength(node, args);
    return;
  }

  // Standard intrinsic type checking
  const params = builtin.signature.parameters;

  // Check argument count
  if (args.length !== params.length) {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `Built-in function '${builtin.name}' expects ${params.length} argument${params.length !== 1 ? 's' : ''}, got ${args.length}`,
      location: node.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
  }

  // Type check each argument
  for (let i = 0; i < Math.min(args.length, params.length); i++) {
    const argType = this.typeCheckExpression(args[i]);
    const paramType = params[i];

    if (!this.typeSystem.canAssign(argType, paramType)) {
      const paramName =
        builtin.signature.parameterNames?.[i] || `parameter ${i + 1}`;
      this.reportDiagnostic({
        severity: DiagnosticSeverity.ERROR,
        message: `Argument type mismatch for '${paramName}' in '${builtin.name}': expected '${paramType.name}', got '${argType.name}'`,
        location: args[i].getLocation(),
        code: DiagnosticCode.TYPE_MISMATCH,
      });
    }
  }

  // Annotate AST with intrinsic information
  (node as any).typeInfo = builtin.signature.returnType;
  (node as any).isIntrinsic = true;
  (node as any).intrinsicId = builtin.intrinsicId;
  (node as any).isCompileTime = builtin.isCompileTime;
}

/**
 * Type check sizeof() intrinsic
 *
 * sizeof is special because it takes a type name, not an expression.
 * It's evaluated entirely at compile-time.
 */
protected typeCheckSizeof(
  node: CallExpression,
  args: Expression[]
): void {
  // sizeof expects exactly one argument
  if (args.length !== 1) {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `sizeof() expects exactly 1 argument, got ${args.length}`,
      location: node.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    return;
  }

  // Argument must be an identifier (type name)
  const arg = args[0];
  if (arg.constructor.name !== 'IdentifierExpression') {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `sizeof() expects a type name, not an expression`,
      location: arg.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    return;
  }

  // Get the type
  const identifier = arg as IdentifierExpression;
  const typeName = identifier.getName();
  const typeInfo = this.typeSystem.getBuiltinType(typeName);

  if (!typeInfo) {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `Unknown type '${typeName}' in sizeof()`,
      location: arg.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    return;
  }

  // Annotate with compile-time constant value
  (node as any).typeInfo = this.typeSystem.getBuiltinType('byte')!;
  (node as any).isIntrinsic = true;
  (node as any).intrinsicId = 'intrinsic_sizeof';
  (node as any).isCompileTime = true;
  (node as any).compileTimeValue = typeInfo.size;
}

/**
 * Type check length() intrinsic
 *
 * length is overloaded for arrays and strings.
 */
protected typeCheckLength(
  node: CallExpression,
  args: Expression[]
): void {
  // length expects exactly one argument
  if (args.length !== 1) {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `length() expects exactly 1 argument, got ${args.length}`,
      location: node.getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    return;
  }

  // Type check the argument
  const argType = this.typeCheckExpression(args[0]);

  // Must be array or string
  if (argType.kind !== TypeKind.Array && argType.name !== 'string') {
    this.reportDiagnostic({
      severity: DiagnosticSeverity.ERROR,
      message: `length() expects an array or string, got '${argType.name}'`,
      location: args[0].getLocation(),
      code: DiagnosticCode.TYPE_MISMATCH,
    });
    return;
  }

  // Return type is word
  (node as any).typeInfo = this.typeSystem.getBuiltinType('word')!;
  (node as any).isIntrinsic = true;
  (node as any).intrinsicId = 'intrinsic_length';
  (node as any).isCompileTime = false;
}
```

---

## **Implementation Tasks**

### **Task 1.5.1: Built-In Function Data Structures** (2 hours)

**Files to Modify:**

- `packages/compiler/src/semantic/types.ts`

**Implementation:**

1. Add `BuiltInFunction` interface
2. Add category type union
3. Update exports

**Tests:** (5 tests)

- Interface structure validation
- Category type checking

**Time Estimate:** 2 hours

---

### **Task 1.5.2: TypeSystem Extension** (3 hours)

**Files to Modify:**

- `packages/compiler/src/semantic/type-system.ts`

**Implementation:**

1. Add `builtins` Map property
2. Implement `initializeBuiltInFunctions()`
3. Implement `registerBuiltIn()`
4. Implement lookup methods:
   - `getBuiltInFunction()`
   - `isBuiltInFunction()`
   - `getAllBuiltInFunctions()`
   - `getBuiltInsByCategory()`

**Tests:** (8 tests)

- Registry initialization
- Lookup by name
- Category filtering
- Unknown function handling

**Time Estimate:** 3 hours

---

### **Task 1.5.3: Register Memory Access Intrinsics** (2 hours)

**Implementation:**

1. Register `peek`
2. Register `poke`
3. Register `peekw`
4. Register `pokew`

**Tests:** (8 tests)

- Peek signature verification
- Poke signature verification
- Peekw signature verification
- Pokew signature verification
- All registered correctly

**Time Estimate:** 2 hours

---

### **Task 1.5.4: Register Array/String Intrinsics** (1 hour)

**Implementation:**

1. Register `length` (arrays)
2. Register `length` (strings) - same function, overloaded

**Tests:** (4 tests)

- Length signature verification
- Overload handling

**Time Estimate:** 1 hour

---

### **Task 1.5.5: Register Type Introspection Intrinsics** (1 hour)

**Implementation:**

1. Register `sizeof` (compile-time)

**Tests:** (3 tests)

- Sizeof signature verification
- Compile-time flag verification

**Time Estimate:** 1 hour

---

### **Task 1.5.6: Type Checking Integration** (4 hours)

**Files to Modify:**

- `packages/compiler/src/semantic/visitors/type-checker/assignments.ts`

**Implementation:**

1. Modify `visitCallExpression()` to detect built-ins
2. Implement `typeCheckBuiltInCall()`
3. Implement `typeCheckSizeof()`
4. Implement `typeCheckLength()`
5. Add AST annotations for intrinsics

**Tests:** (12 tests)

- Built-in detection
- Argument type checking
- AST annotation verification
- Error handling

**Time Estimate:** 4 hours

---

### **Task 1.5.7: Integration Testing** (3 hours)

**Files to Create:**

- `packages/compiler/src/__tests__/semantic/builtins.test.ts`

**Implementation:**

1. Test all memory access intrinsics
2. Test length() with arrays and strings
3. Test sizeof() with all built-in types
4. Test error cases
5. Test AST annotations

**Tests:** (15 tests)

- End-to-end intrinsic usage
- Type error detection
- Compile-time evaluation
- Integration with semantic analyzer

**Time Estimate:** 3 hours

---

### **Task 1.5.8: Documentation** (1 hour)

**Files to Update:**

- JSDoc comments in all modified files
- Update this plan document with completion status

**Time Estimate:** 1 hour

---

## **Task Implementation Checklist**

| Task  | Description                       | Dependencies | Status |
| ----- | --------------------------------- | ------------ | ------ |
| 1.5.1 | Built-in function data structures | None         | [ ]    |
| 1.5.2 | TypeSystem extension              | 1.5.1        | [ ]    |
| 1.5.3 | Register memory access intrinsics | 1.5.2        | [ ]    |
| 1.5.4 | Register array/string intrinsics  | 1.5.2        | [ ]    |
| 1.5.5 | Register type introspection       | 1.5.2        | [ ]    |
| 1.5.6 | Type checking integration         | 1.5.3-1.5.5  | [ ]    |
| 1.5.7 | Integration testing               | 1.5.6        | [ ]    |
| 1.5.8 | Documentation                     | All          | [ ]    |

**Total**: 8 tasks, 40+ tests, ~2 days

---

## **Success Criteria**

Phase 1.5 is complete when:

- ✅ All 8 tasks completed
- ✅ 40+ tests passing
- ✅ All critical intrinsics registered (peek, poke, peekw, pokew, length, sizeof)
- ✅ Type checking correctly handles built-in calls
- ✅ AST properly annotated with intrinsic information
- ✅ sizeof() evaluated at compile-time
- ✅ length() works with arrays and strings
- ✅ No breaking changes to existing code
- ✅ Documentation complete
- ✅ Ready for code generation (intrinsic IDs available)

---

## **Code Generation Notes (Future Phase)**

When implementing IL generation and 6502 code generation, intrinsics will be handled as follows:

### **Runtime Intrinsics (peek, poke, peekw, pokew, length)**

These generate inline assembly:

```typescript
// IL Generator
if (node.isIntrinsic && !node.isCompileTime) {
  return this.generateIntrinsicCall(node.intrinsicId, node.getArguments());
}

// Code Generator
switch (intrinsicId) {
  case 'intrinsic_peek':
    // LDA (address)
    break;
  case 'intrinsic_poke':
    // LDA #value / STA address
    break;
  // ... etc
}
```

### **Compile-Time Intrinsics (sizeof)**

These are replaced with constant values:

```typescript
// IL Generator
if (node.isCompileTime) {
  return new ConstantValue(node.compileTimeValue);
}
```

---

## **Next Phase**

**After Phase 1.5 completion:**

Proceed to **Phase 2: Type Resolution** (already complete, but now with built-in function support)

Then proceed to **Phase 8: Advanced Analysis** implementation.

---

**Ready to implement compiler intrinsics! 🚀**
