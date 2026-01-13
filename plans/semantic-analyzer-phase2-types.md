# Semantic Analyzer Phase 2: Type Resolution

> **Phase**: 2 of 9
> **Focus**: Type system infrastructure and type resolution
> **Dependencies**: Phase 1 (Symbol Table Builder) must be complete
> **Duration**: 3-4 days
> **Tasks**: 10
> **Tests**: 60+

---

## **Phase Overview**

Phase 2 builds the type system infrastructure and implements the second semantic analysis pass: resolving type annotations and building the type information that will be used for type checking in Phase 3.

### **Objectives**

1. ✅ Create type system data structures
2. ✅ Implement type resolver visitor (Pass 2)
3. ✅ Resolve all type annotations
4. ✅ Build type compatibility matrix
5. ✅ Annotate symbols with resolved types
6. ✅ Prepare for type checking (Phase 3)

### **What This Phase Produces**

- Complete type information for all declarations
- Type compatibility rules
- Type conversion requirements
- Annotated symbol table with types
- Foundation for expression type checking

---

## **Type System Architecture**

### **Core Data Structures**

```typescript
/**
 * Represents type information
 */
export interface TypeInfo {
  /** Type kind */
  kind: TypeKind;

  /** Base type name */
  name: string;

  /** Size in bytes */
  size: number;

  /** Is this type signed? */
  isSigned: boolean;

  /** Can this type be assigned to? */
  isAssignable: boolean;

  /** Array element type (for arrays) */
  elementType?: TypeInfo;

  /** Array size (for fixed arrays) */
  arraySize?: number;

  /** Function signature (for functions/callbacks) */
  signature?: FunctionSignature;

  /** Type metadata */
  metadata?: TypeMetadata;
}

/**
 * Type kinds
 */
export enum TypeKind {
  Byte = 'byte', // 8-bit unsigned
  Word = 'word', // 16-bit unsigned
  Boolean = 'boolean', // 8-bit boolean
  Void = 'void', // No value
  String = 'string', // String literal
  Callback = 'callback', // Function pointer
  Array = 'array', // Array type
  Unknown = 'unknown', // Type error
}

/**
 * Function signature for callbacks and functions
 */
export interface FunctionSignature {
  /** Parameter types */
  parameters: TypeInfo[];

  /** Return type */
  returnType: TypeInfo;

  /** Parameter names (for error messages) */
  parameterNames?: string[];
}

/**
 * Type compatibility result
 */
export enum TypeCompatibility {
  /** Types are identical */
  Identical = 'Identical',

  /** Types are compatible (can assign without conversion) */
  Compatible = 'Compatible',

  /** Types require explicit conversion */
  RequiresConversion = 'RequiresConversion',

  /** Types are incompatible */
  Incompatible = 'Incompatible',
}

/**
 * Type system - manages all type information
 */
export class TypeSystem {
  /** Built-in types */
  protected builtinTypes: Map<string, TypeInfo>;

  /** Type compatibility cache */
  protected compatibilityCache: Map<string, TypeCompatibility>;

  constructor() {
    this.builtinTypes = new Map();
    this.compatibilityCache = new Map();
    this.initializeBuiltinTypes();
  }

  /**
   * Initialize built-in types
   */
  protected initializeBuiltinTypes(): void {
    // byte: 8-bit unsigned integer (0-255)
    this.builtinTypes.set('byte', {
      kind: TypeKind.Byte,
      name: 'byte',
      size: 1,
      isSigned: false,
      isAssignable: true,
    });

    // word: 16-bit unsigned integer (0-65535)
    this.builtinTypes.set('word', {
      kind: TypeKind.Word,
      name: 'word',
      size: 2,
      isSigned: false,
      isAssignable: true,
    });

    // boolean: 8-bit boolean (0 = false, non-zero = true)
    this.builtinTypes.set('boolean', {
      kind: TypeKind.Boolean,
      name: 'boolean',
      size: 1,
      isSigned: false,
      isAssignable: true,
    });

    // void: no value
    this.builtinTypes.set('void', {
      kind: TypeKind.Void,
      name: 'void',
      size: 0,
      isSigned: false,
      isAssignable: false,
    });

    // string: string literal (compile-time only)
    this.builtinTypes.set('string', {
      kind: TypeKind.String,
      name: 'string',
      size: 0, // Variable size
      isSigned: false,
      isAssignable: false,
    });
  }

  /**
   * Get a built-in type by name
   */
  public getBuiltinType(name: string): TypeInfo | undefined {
    return this.builtinTypes.get(name);
  }

  /**
   * Check if a type name is a built-in type
   */
  public isBuiltinType(name: string): boolean {
    return this.builtinTypes.has(name);
  }

  /**
   * Create an array type
   */
  public createArrayType(elementType: TypeInfo, size?: number): TypeInfo {
    return {
      kind: TypeKind.Array,
      name: `${elementType.name}[]`,
      size: size ? elementType.size * size : 0,
      isSigned: false,
      isAssignable: true,
      elementType,
      arraySize: size,
    };
  }

  /**
   * Create a callback type
   */
  public createCallbackType(signature: FunctionSignature): TypeInfo {
    const paramStr = signature.parameters.map(p => p.name).join(', ');
    const name = `(${paramStr}) => ${signature.returnType.name}`;

    return {
      kind: TypeKind.Callback,
      name,
      size: 2, // Function pointer is 16-bit
      isSigned: false,
      isAssignable: true,
      signature,
    };
  }

  /**
   * Check type compatibility
   */
  public checkCompatibility(from: TypeInfo, to: TypeInfo): TypeCompatibility {
    // Check cache first
    const cacheKey = `${from.name}->${to.name}`;
    const cached = this.compatibilityCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let result: TypeCompatibility;

    // Same type = identical
    if (from.kind === to.kind && from.name === to.name) {
      result = TypeCompatibility.Identical;
    }
    // byte can be assigned to word (widening)
    else if (from.kind === TypeKind.Byte && to.kind === TypeKind.Word) {
      result = TypeCompatibility.Compatible;
    }
    // boolean can be assigned to byte (boolean is byte)
    else if (from.kind === TypeKind.Boolean && to.kind === TypeKind.Byte) {
      result = TypeCompatibility.Compatible;
    }
    // byte can be assigned to boolean (any non-zero = true)
    else if (from.kind === TypeKind.Byte && to.kind === TypeKind.Boolean) {
      result = TypeCompatibility.Compatible;
    }
    // word to byte requires explicit conversion (narrowing)
    else if (from.kind === TypeKind.Word && to.kind === TypeKind.Byte) {
      result = TypeCompatibility.RequiresConversion;
    }
    // Array types must match element types and sizes
    else if (from.kind === TypeKind.Array && to.kind === TypeKind.Array) {
      const elementCompat = this.checkCompatibility(from.elementType!, to.elementType!);
      if (elementCompat === TypeCompatibility.Identical) {
        // Check array sizes
        if (from.arraySize === to.arraySize || !to.arraySize) {
          result = TypeCompatibility.Compatible;
        } else {
          result = TypeCompatibility.Incompatible;
        }
      } else {
        result = TypeCompatibility.Incompatible;
      }
    }
    // Callback types must match signatures
    else if (from.kind === TypeKind.Callback && to.kind === TypeKind.Callback) {
      result = this.checkSignatureCompatibility(from.signature!, to.signature!);
    }
    // Everything else is incompatible
    else {
      result = TypeCompatibility.Incompatible;
    }

    this.compatibilityCache.set(cacheKey, result);
    return result;
  }

  /**
   * Check function signature compatibility
   */
  protected checkSignatureCompatibility(
    from: FunctionSignature,
    to: FunctionSignature
  ): TypeCompatibility {
    // Must have same number of parameters
    if (from.parameters.length !== to.parameters.length) {
      return TypeCompatibility.Incompatible;
    }

    // Check parameter types (contravariant)
    for (let i = 0; i < from.parameters.length; i++) {
      const compat = this.checkCompatibility(to.parameters[i], from.parameters[i]);
      if (compat === TypeCompatibility.Incompatible) {
        return TypeCompatibility.Incompatible;
      }
    }

    // Check return type (covariant)
    const returnCompat = this.checkCompatibility(from.returnType, to.returnType);
    if (returnCompat === TypeCompatibility.Incompatible) {
      return TypeCompatibility.Incompatible;
    }

    return TypeCompatibility.Compatible;
  }

  /**
   * Check if a type can be assigned to another
   */
  public canAssign(from: TypeInfo, to: TypeInfo): boolean {
    const compat = this.checkCompatibility(from, to);
    return compat === TypeCompatibility.Identical || compat === TypeCompatibility.Compatible;
  }

  /**
   * Get the result type of a binary operation
   */
  public getBinaryOperationType(left: TypeInfo, right: TypeInfo, operator: string): TypeInfo {
    // Arithmetic operators (+, -, *, /, %)
    if (['+', '-', '*', '/', '%'].includes(operator)) {
      // word + word = word
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word')!;
      }
      // byte + byte = byte
      return this.getBuiltinType('byte')!;
    }

    // Comparison operators (==, !=, <, >, <=, >=)
    if (['==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      return this.getBuiltinType('boolean')!;
    }

    // Logical operators (&&, ||)
    if (['&&', '||'].includes(operator)) {
      return this.getBuiltinType('boolean')!;
    }

    // Bitwise operators (&, |, ^, <<, >>)
    if (['&', '|', '^', '<<', '>>'].includes(operator)) {
      // word & word = word
      if (left.kind === TypeKind.Word || right.kind === TypeKind.Word) {
        return this.getBuiltinType('word')!;
      }
      // byte & byte = byte
      return this.getBuiltinType('byte')!;
    }

    // Unknown operator
    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }

  /**
   * Get the result type of a unary operation
   */
  public getUnaryOperationType(operand: TypeInfo, operator: string): TypeInfo {
    // Logical NOT (!)
    if (operator === '!') {
      return this.getBuiltinType('boolean')!;
    }

    // Bitwise NOT (~)
    if (operator === '~') {
      return operand;
    }

    // Negation (-)
    if (operator === '-') {
      return operand;
    }

    // Address-of (@)
    if (operator === '@') {
      return this.getBuiltinType('word')!; // Address is 16-bit
    }

    // Unknown operator
    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }
}
```

---

## **Type Resolver Visitor**

### **Pass 2: Type Resolution**

```typescript
/**
 * Type resolver - resolves type annotations and annotates symbols
 */
export class TypeResolver extends ContextAwareWalker {
  /** Type system */
  protected typeSystem: TypeSystem;

  /** Symbol table from Phase 1 */
  protected symbolTable: SymbolTable;

  /** Diagnostics collector */
  protected diagnostics: Diagnostic[];

  constructor(symbolTable: SymbolTable) {
    super();
    this.typeSystem = new TypeSystem();
    this.symbolTable = symbolTable;
    this.diagnostics = [];
  }

  /**
   * Get the type system
   */
  public getTypeSystem(): TypeSystem {
    return this.typeSystem;
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
  // Variable Declarations
  //

  public visitVariableDecl(node: VariableDecl): void {
    // Resolve type annotation
    const type = this.resolveTypeAnnotation(node.typeAnnotation, node.location);

    // Get symbol from symbol table
    const symbol = this.symbolTable.lookupLocal(node.name);
    if (symbol) {
      // Annotate symbol with type
      symbol.type = type;
    }

    // Visit initializer if present (will be type-checked in Phase 3)
    if (node.initializer) {
      node.initializer.accept(this);
    }
  }

  //
  // Memory-Mapped Declarations
  //

  public visitMapDecl(node: MapDecl): void {
    // Resolve type annotation
    const type = this.resolveTypeAnnotation(node.typeAnnotation, node.location);

    // Get symbol from symbol table
    const symbol = this.symbolTable.lookupLocal(node.name);
    if (symbol) {
      // Annotate symbol with type
      symbol.type = type;
    }

    // Visit address expression
    node.address.accept(this);
  }

  //
  // Function Declarations
  //

  public visitFunctionDecl(node: FunctionDecl): void {
    // Resolve return type
    const returnType = node.returnType
      ? this.resolveTypeAnnotation(node.returnType, node.location)
      : this.typeSystem.getBuiltinType('void')!;

    // Resolve parameter types
    const parameterTypes: TypeInfo[] = [];
    const parameterNames: string[] = [];

    this.symbolTable.enterScope(this.getScopeForNode(node)!);

    for (const param of node.parameters) {
      const paramType = this.resolveTypeAnnotation(param.typeAnnotation, param.location);
      parameterTypes.push(paramType);
      parameterNames.push(param.name);

      // Annotate parameter symbol with type
      const paramSymbol = this.symbolTable.lookupLocal(param.name);
      if (paramSymbol) {
        paramSymbol.type = paramType;
      }
    }

    this.symbolTable.exitScope();

    // Create function signature
    const signature: FunctionSignature = {
      parameters: parameterTypes,
      returnType,
      parameterNames,
    };

    // Create function type
    const functionType = this.typeSystem.createCallbackType(signature);

    // Get symbol from symbol table
    const symbol = this.symbolTable.lookupLocal(node.name);
    if (symbol) {
      // Annotate symbol with function type
      symbol.type = functionType;
    }

    // Visit function body (will type-check in Phase 3)
    if (node.body) {
      this.symbolTable.enterScope(this.getScopeForNode(node)!);
      node.body.accept(this);
      this.symbolTable.exitScope();
    }
  }

  //
  // Type Annotation Resolution
  //

  /**
   * Resolve a type annotation to TypeInfo
   */
  protected resolveTypeAnnotation(annotation: TypeAnnotation, location: SourceLocation): TypeInfo {
    // Simple type (byte, word, boolean, void, string)
    if (annotation.kind === 'simple') {
      const builtinType = this.typeSystem.getBuiltinType(annotation.name);
      if (builtinType) {
        return builtinType;
      }

      // Unknown type
      this.reportDiagnostic({
        severity: 'error',
        message: `Unknown type '${annotation.name}'`,
        location,
        code: 'E2002',
      });

      return {
        kind: TypeKind.Unknown,
        name: 'unknown',
        size: 0,
        isSigned: false,
        isAssignable: false,
      };
    }

    // Array type (byte[], word[10])
    if (annotation.kind === 'array') {
      const elementType = this.resolveTypeAnnotation(annotation.elementType, location);
      return this.typeSystem.createArrayType(elementType, annotation.size);
    }

    // Callback type ((byte, word) => void)
    if (annotation.kind === 'callback') {
      const paramTypes = annotation.parameters.map(p =>
        this.resolveTypeAnnotation(p.typeAnnotation, location)
      );
      const returnType = annotation.returnType
        ? this.resolveTypeAnnotation(annotation.returnType, location)
        : this.typeSystem.getBuiltinType('void')!;

      const signature: FunctionSignature = {
        parameters: paramTypes,
        returnType,
        parameterNames: annotation.parameters.map(p => p.name),
      };

      return this.typeSystem.createCallbackType(signature);
    }

    // Unknown annotation kind
    return {
      kind: TypeKind.Unknown,
      name: 'unknown',
      size: 0,
      isSigned: false,
      isAssignable: false,
    };
  }

  /**
   * Get scope for an AST node
   */
  protected getScopeForNode(node: ASTNode): Scope | null {
    // Implementation depends on symbol table structure
    // This is a placeholder
    return null;
  }
}
```

---

## **Implementation Tasks**

### **Task 2.1: Type System Data Structures**

**Files to Create:**

- `src/semantic/types.ts` - TypeInfo, TypeKind, FunctionSignature

**Implementation:**

1. Define `TypeInfo` interface
2. Define `TypeKind` enum
3. Define `FunctionSignature` interface
4. Define `TypeCompatibility` enum
5. Define `TypeMetadata` interface

**Tests:** (10 tests)

- TypeInfo creation for all built-in types
- TypeKind enum values
- FunctionSignature structure
- TypeCompatibility enum
- Type metadata

**Time Estimate:** 3 hours

---

### **Task 2.2: Type System Class**

**Files to Create:**

- `src/semantic/type-system.ts` - TypeSystem class

**Implementation:**

1. Implement `TypeSystem` class
2. Initialize built-in types (byte, word, boolean, void, string)
3. Implement `getBuiltinType()`
4. Implement `isBuiltinType()`
5. Implement `createArrayType()`
6. Implement `createCallbackType()`

**Tests:** (12 tests)

- Initialize built-in types
- Get built-in type by name
- Check if type name is built-in
- Create array type with size
- Create array type without size
- Create callback type
- Built-in type properties (size, signed, assignable)

**Time Estimate:** 4 hours

---

### **Task 2.3: Type Compatibility Checking**

**Implementation:**

1. Implement `checkCompatibility()` method
2. Handle identical types
3. Handle byte → word (widening)
4. Handle word → byte (narrowing, requires conversion)
5. Handle boolean ↔ byte conversions
6. Handle array type compatibility
7. Handle callback type compatibility
8. Implement compatibility caching

**Tests:** (15 tests)

- Identical types are identical
- byte → word is compatible
- word → byte requires conversion
- boolean → byte is compatible
- byte → boolean is compatible
- Array types with same elements compatible
- Array types with different elements incompatible
- Callback signature compatibility
- Incompatible types
- Compatibility caching

**Time Estimate:** 5 hours

---

### **Task 2.4: Binary and Unary Operation Types**

**Implementation:**

1. Implement `getBinaryOperationType()`
2. Handle arithmetic operators (+, -, \*, /, %)
3. Handle comparison operators (==, !=, <, >, <=, >=)
4. Handle logical operators (&&, ||)
5. Handle bitwise operators (&, |, ^, <<, >>)
6. Implement `getUnaryOperationType()`
7. Handle logical NOT (!)
8. Handle bitwise NOT (~)
9. Handle address-of (@)

**Tests:** (10 tests)

- Arithmetic operations return numeric types
- Comparison operations return boolean
- Logical operations return boolean
- Bitwise operations return numeric types
- Unary NOT returns boolean
- Bitwise NOT preserves type
- Address-of returns word

**Time Estimate:** 4 hours

---

### **Task 2.5: Type Resolver Base Class**

**Files to Create:**

- `src/semantic/visitors/type-resolver.ts`

**Implementation:**

1. Create `TypeResolver` class extending `ContextAwareWalker`
2. Add type system instance
3. Add symbol table reference
4. Add diagnostics collection
5. Implement helper methods

**Tests:** (5 tests)

- Resolver instantiation
- Type system access
- Symbol table access
- Diagnostics collection

**Time Estimate:** 2 hours

---

### **Task 2.6: Variable Type Resolution**

**Implementation:**

1. Implement `visitVariableDecl()` method
2. Resolve type annotations
3. Annotate symbols with types
4. Handle missing type annotations (will infer in Phase 3)

**Tests:** (8 tests)

- Resolve byte type annotation
- Resolve word type annotation
- Resolve boolean type annotation
- Resolve array type annotation
- Resolve unknown type (error)
- Annotate symbol with resolved type

**Time Estimate:** 3 hours

---

### **Task 2.7: Memory-Mapped Type Resolution**

**Implementation:**

1. Implement `visitMapDecl()` method
2. Resolve @map type annotations
3. Annotate @map symbols with types

**Tests:** (5 tests)

- Resolve @map byte type
- Resolve @map word type
- Resolve @map array type
- Annotate @map symbol with type

**Time Estimate:** 2 hours

---

### **Task 2.8: Function Type Resolution**

**Implementation:**

1. Implement `visitFunctionDecl()` method
2. Resolve return type annotations
3. Resolve parameter type annotations
4. Create function signatures
5. Create callback types
6. Annotate function symbols with types
7. Annotate parameter symbols with types

**Tests:** (10 tests)

- Resolve function with return type
- Resolve function with void return
- Resolve function parameters
- Create function signature
- Create callback type
- Annotate function symbol
- Annotate parameter symbols
- Multiple parameters
- No parameters

**Time Estimate:** 4 hours

---

### **Task 2.9: Type Annotation Resolution**

**Implementation:**

1. Implement `resolveTypeAnnotation()` method
2. Handle simple types (byte, word, boolean, void, string)
3. Handle array types (byte[], word[10])
4. Handle callback types ((byte) => void)
5. Report errors for unknown types

**Tests:** (8 tests)

- Resolve simple type annotations
- Resolve array type annotations
- Resolve sized array annotations
- Resolve callback type annotations
- Report unknown type error

**Time Estimate:** 3 hours

---

### **Task 2.10: Integration and Testing**

**Files to Create:**

- `src/semantic/__tests__/type-system.test.ts`
- `src/semantic/__tests__/type-resolver.test.ts`
- `src/semantic/__tests__/type-compatibility.test.ts`

**Tests:** (10+ integration tests)

- End-to-end: Resolve types for complete program
- Complex type annotations
- Function signatures
- Type compatibility scenarios
- Error cases

**Time Estimate:** 4 hours

---

## **Task Implementation Checklist**

| Task | Description                      | Dependencies | Status |
| ---- | -------------------------------- | ------------ | ------ |
| 2.1  | Type system data structures      | Phase 1      | [ ]    |
| 2.2  | Type system class                | 2.1          | [ ]    |
| 2.3  | Type compatibility checking      | 2.2          | [ ]    |
| 2.4  | Binary and unary operation types | 2.2          | [ ]    |
| 2.5  | Type resolver base class         | 2.2          | [ ]    |
| 2.6  | Variable type resolution         | 2.5          | [ ]    |
| 2.7  | Memory-mapped type resolution    | 2.5          | [ ]    |
| 2.8  | Function type resolution         | 2.5          | [ ]    |
| 2.9  | Type annotation resolution       | 2.5          | [ ]    |
| 2.10 | Integration and testing          | 2.1-2.9      | [ ]    |

**Total**: 10 tasks, 60+ tests, ~3-4 days

---

## **Success Criteria**

Phase 2 is complete when:

- ✅ All 10 tasks completed
- ✅ 60+ tests passing
- ✅ All type annotations resolved
- ✅ Symbol table annotated with types
- ✅ Type compatibility rules working
- ✅ Type system ready for Phase 3
- ✅ No breaking changes
- ✅ Documentation complete

---

## **Next Phase**

**After Phase 2 completion:**

Proceed to **Phase 3: Type Checking**

- Type check all expressions
- Validate assignments
- Check function calls
- Verify return types

---

**Ready to resolve types! 🎯**
