# IL Generator Requirements for Stub Functions (Built-In Intrinsics)

> **Phase**: 4 (Post Semantic Analyzer)
> **Focus**: Intermediate Language (IL) generation requirements for built-in functions
> **Status**: Requirements Documentation
> **Date**: January 2026

---

## **Executive Summary**

This document specifies how the IL Generator should handle **stub functions** (built-in compiler intrinsics) that are declared without implementations. These functions represent low-level operations that will be implemented directly as 6502 assembly instructions or compile-time operations.

### **Current Implementation Status**

✅ **Parser**: Handles stub function syntax (`function name(): type;`)
✅ **Semantic Analyzer**: Recognizes and validates stub functions
✅ **Symbol Table**: Creates function symbols for stub functions
✅ **Type Checker**: Validates stub function calls
✅ **Control Flow**: Skips CFG generation for stub functions

🔜 **IL Generator**: Not yet implemented
🔜 **Code Generator**: Not yet implemented

---

## **Multi-Target Architecture Considerations**

### **Target-Agnostic IL Design Philosophy**

The IL (Intermediate Language) represents **abstract, platform-independent operations**. Target-specific concerns (C64/C128/X16 hardware differences) are handled by:
- **Semantic Analyzer**: Target-aware analysis (already implemented with TargetConfig)
- **Code Generator**: Target-specific 6502 code generation (future phase)

**The IL Generator sits in the middle and must remain mostly target-agnostic while passing through target-specific metadata.**

### **Compiler Pipeline with Target Awareness**

```
Source Code → Lexer → Parser → AST → Semantic Analyzer → IL Generator → Code Generator → Assembly
                                           ↓                    ↓               ↓
                                    [Target-Aware]      [Target-Agnostic]  [Target-Specific]
                                    VIC-II/SID hints    Generic operations  Actual 6502 code
                                    Phase 8 analysis    Hardware access     C64/C128/X16 diffs
```

### **What IL Generator Needs from Target System**

The IL generator requires **minimal target awareness**:

1. **TargetConfig Parameter**
   - Used only for intrinsic resolution context
   - Does NOT dictate IL generation strategy
   - Passed through to maintain compilation context

2. **Generic Hardware Access**
   - Abstract "hardware register read/write" operations
   - NOT specific addresses (those come from semantic phase)
   - Code generator maps to actual hardware

3. **Metadata Passthrough**
   - Preserve semantic analysis results (VIC-II timing, SID conflicts)
   - Don't interpret target-specific metadata
   - Pass unchanged to code generator

### **Multi-Target Examples**

#### **Example 1: Hardware Register Access**

**C64 Code:**
```js
// Read VIC-II border color (C64: $D020)
let color = peek($D020);
```

**X16 Code:**
```js
// Read VERA composer control (X16: $9F29)
let control = peek($9F29);
```

**IL Generated (Both Cases):**
```
HardwareRead {
  addressExpr: Const(0xD020)  // or 0x9F29
  size: byte
  metadata: { ... timing hints from semantic phase ... }
}
```

**Code Generator Handles Differences:**
- C64: Maps to VIC-II address space, applies badline constraints
- X16: Maps to VERA address space, different timing model

#### **Example 2: Sound Chip Access**

**C64 Code (SID):**
```js
// Write to SID voice 1 frequency (C64: $D400)
poke($D400, freqLow);
poke($D401, freqHigh);
```

**X16 Code (YM2151):**
```js
// Write to YM2151 register (X16: $9F40)
poke($9F40, register);
poke($9F41, value);
```

**IL Generated (Both Cases):**
```
HardwareWrite {
  addressExpr: Const(0xD400)  // or 0x9F40
  valueExpr: Variable(freqLow)
  size: byte
  metadata: { sidVoiceConflict: true }  // Only for C64
}
```

**Semantic Analyzer Already Did Target Analysis:**
- C64: SID conflict detection (Phase 8)
- X16: YM2151 resource tracking (future)

**IL Just Passes Through - Code Generator Interprets:**
- C64: Apply SID voice timing constraints
- X16: Apply YM2151 register access patterns

### **What IL Generator Does NOT Do**

❌ **Does NOT create target-specific IL dialects**
   - No "C64-IL" vs "X16-IL" vs "C128-IL"
   - Single unified IL representation

❌ **Does NOT hardcode hardware addresses**
   - Addresses come from source code or semantic analysis
   - IL treats them as abstract memory locations

❌ **Does NOT interpret hardware-specific constraints**
   - Constraints already analyzed in semantic phase
   - IL preserves metadata for code generator

❌ **Does NOT make target-specific optimization decisions**
   - Optimizations based on generic 6502 characteristics
   - Target-specific opts happen in code generator

### **Target Config Integration**

```typescript
/**
 * IL Generator constructor with target config
 */
class ILGenerator {
  constructor(
    ast: Program,
    symbolTable: GlobalSymbolTable,
    typeSystem: TypeSystem,
    targetConfig: TargetConfig  // NEW: minimal target awareness
  ) {
    this.ast = ast;
    this.symbolTable = symbolTable;
    this.typeSystem = typeSystem;
    this.targetConfig = targetConfig;  // Used for intrinsic resolution only
  }
  
  /**
   * Intrinsic resolution may need target context
   * Example: sizeof() might vary by target in future
   */
  protected resolveIntrinsic(name: string): IntrinsicInfo {
    const intrinsic = this.intrinsics.get(name);
    
    // Most intrinsics are target-agnostic
    // Future: Some might need target-specific behavior
    if (intrinsic && intrinsic.targetDependent) {
      return this.resolveTargetSpecificIntrinsic(name);
    }
    
    return intrinsic;
  }
}
```

### **Supported Target Platforms**

The IL generator supports multiple 6502-family targets through abstraction:

| Target | CPU | Graphics | Sound | IL Support |
|--------|-----|----------|-------|------------|
| **C64** | 6510 | VIC-II ($D000) | SID ($D400) | ✅ Full |
| **C128** | 8502 | VIC-II / VDC | SID x2 | ✅ Full |
| **X16** | 65C02 | VERA ($9F20) | YM2151 / PSG | ✅ Full |
| **Generic** | 6502 | None | None | ✅ Full |

**All targets use the same IL representation.**

---

## **Stub Function Architecture**

### **What Are Stub Functions?**

Stub functions are function declarations without bodies, terminated with semicolons:

```js
// Stub function (no body)
function peek(address: word): byte;

// Regular function (has body)
function readMemory(addr: word): byte {
    return peek(addr);
}
```

**Key Characteristics:**

- Declared with signature but no implementation
- Represent compiler intrinsics (built-in operations)
- Resolved by IL/code generator, not by runtime linking
- No Control Flow Graph (CFG) created
- Type checked like regular functions

### **How They Work**

1. **Source Code**: Developer imports/declares stub function
2. **Lexer/Parser**: Parses as `FunctionDecl` with `body = null`
3. **Symbol Table Builder**: Creates function symbol
4. **Type Checker**: Validates call sites (arguments, return types)
5. **Control Flow Analyzer**: Skips (no body to analyze)
6. **IL Generator**: ⚠️ **MUST HANDLE SPECIALLY** ⚠️
7. **Code Generator**: Emits native 6502 instructions

---

## **Current Semantic Analyzer Implementation**

### **Symbol Table Builder**

**File**: `packages/compiler/src/semantic/visitors/symbol-table-builder.ts`

```typescript
/**
 * Visit function declaration
 *
 * Creates a symbol for the function in current scope,
 * then creates a new function scope and declares parameters.
 */
public visitFunctionDecl(node: FunctionDecl): void {
  try {
    // Declare function in current (module) scope
    const symbol: Symbol = {
      name: node.getName(),
      kind: SymbolKind.Function,
      declaration: node,
      isExported: node.isExportedFunction(),
      isConst: false,
      scope: this.symbolTable.getCurrentScope(),
      location: node.getLocation(),
    };

    this.symbolTable.declare(symbol);
  } catch (error) {
    this.reportDuplicateDeclaration(node.getName(), node.getLocation());
  }

  // Create function scope
  const functionScope = this.symbolTable.createScope(
    ScopeKind.Function,
    this.symbolTable.getCurrentScope(),
    node
  );

  // Enter function scope
  this.symbolTable.enterScope(functionScope);

  // Declare parameters in function scope
  for (const param of node.getParameters()) {
    this.visitParameter(param);
  }

  // ✅ Visit function body statements (if present - stub functions have no body)
  const body = node.getBody();
  if (body) {
    for (const stmt of body) {
      stmt.accept(this);
    }
  }

  // Exit function scope
  this.symbolTable.exitScope();
}
```

**What It Does:**

- Creates function symbol for all functions (including stubs)
- Creates function scope
- Declares parameters
- ✅ **Checks if body exists before processing** (handles stubs gracefully)
- No special metadata added for stub detection

### **Control Flow Analyzer**

**File**: `packages/compiler/src/semantic/visitors/control-flow-analyzer.ts`

```typescript
/**
 * Visit function declaration
 *
 * Builds a Control Flow Graph for the function.
 */
public visitFunctionDecl(node: FunctionDecl): void {
  if (this.shouldStop) return;

  // ✅ Skip stub functions entirely - they have no body to analyze
  const body = node.getBody();
  if (!body) {
    return;
  }

  // ... CFG building logic for regular functions
}
```

**What It Does:**

- ✅ **Explicitly skips stub functions** (no CFG created)
- Early return prevents CFG construction
- No special marking or metadata

### **Type Checker**

**File**: `packages/compiler/src/semantic/visitors/type-checker/*.ts`

**Current Behavior:**

- Type checks function calls normally
- Validates argument types against parameter types
- Checks return type compatibility
- ❌ **Does NOT distinguish stub functions from regular functions**
- ❌ **Does NOT add intrinsic metadata to AST**

---

## **Required Built-In Functions**

### **Category 1: Memory Access (CRITICAL - Runtime Intrinsics)**

#### **`peek(address: word): byte`**

**Purpose**: Read byte from memory address

**IL Requirements**:

- Intrinsic ID: `intrinsic_peek`
- Runtime operation (not compile-time)
- IL representation: `PEEK <address_expr>`
- Code generation: `LDA (address)` or `LDA absolute`

**Usage Example**:

```js
function peek(address: word): byte;

let color = peek($D020);  // Read border color register
```

#### **`poke(address: word, value: byte): void`**

**Purpose**: Write byte to memory address

**IL Requirements**:

- Intrinsic ID: `intrinsic_poke`
- Runtime operation (not compile-time)
- IL representation: `POKE <address_expr>, <value_expr>`
- Code generation: `STA absolute` or indirect addressing

**Usage Example**:

```js
function poke(address: word, value: byte): void;

poke($D020, 0);  // Set border color to black
```

#### **`peekw(address: word): word`**

**Purpose**: Read 16-bit word from memory (little-endian)

**IL Requirements**:

- Intrinsic ID: `intrinsic_peekw`
- Runtime operation
- IL representation: `PEEKW <address_expr>`
- Code generation: Two LDA instructions (low byte, high byte)

**Usage Example**:

```js
function peekw(address: word): word;

let pointer = peekw($FB);  // Read 16-bit pointer from zero page
```

#### **`pokew(address: word, value: word): void`**

**Purpose**: Write 16-bit word to memory (little-endian)

**IL Requirements**:

- Intrinsic ID: `intrinsic_pokew`
- Runtime operation
- IL representation: `POKEW <address_expr>, <value_expr>`
- Code generation: Two STA instructions (low byte, high byte)

**Usage Example**:

```js
function pokew(address: word, value: word): void;

pokew($FB, 0x1000);  // Write pointer to zero page
```

---

### **Category 2: Array/String Utilities (CRITICAL - Runtime Intrinsics)**

#### **`length(array: T[]): word` (Overload 1)**

**Purpose**: Get array length at runtime

**IL Requirements**:

- Intrinsic ID: `intrinsic_length_array`
- Runtime operation (reads array metadata)
- IL representation: `LENGTH_ARRAY <array_expr>`
- Code generation: Read from array descriptor

**Usage Example**:

```js
function length<T>(array: T[]): word;

let values: byte[] = [1, 2, 3, 4, 5];
let count = length(values);  // Returns 5
```

#### **`length(str: string): word` (Overload 2)**

**Purpose**: Get string length at runtime

**IL Requirements**:

- Intrinsic ID: `intrinsic_length_string`
- Runtime operation (reads string metadata)
- IL representation: `LENGTH_STRING <string_expr>`
- Code generation: Read from string descriptor or scan for null terminator

**Usage Example**:

```js
function length(str: string): word;

let message = "HELLO";
let len = length(message);  // Returns 5
```

**Note**: Same function name, different intrinsic IDs based on argument type (overloading)

---

### **Category 3: Type Introspection (CRITICAL - Compile-Time Intrinsics)**

#### **`sizeof(type: Type): byte`**

**Purpose**: Get size of type in bytes (compile-time evaluation)

**IL Requirements**:

- Intrinsic ID: `intrinsic_sizeof`
- ✅ **COMPILE-TIME OPERATION** (no runtime code)
- IL representation: `CONST <computed_value>` (replaced with constant)
- Code generation: Emits literal value, no runtime computation

**Usage Example**:

```js
function sizeof(type: Type): byte;

const byteSize = sizeof(byte);    // Compile-time constant: 1
const wordSize = sizeof(word);    // Compile-time constant: 2
const structSize = sizeof(Sprite); // Compile-time: sum of field sizes
```

**Special Handling**:

- Argument is a **type name**, not an expression
- Must be evaluated during IL generation
- Result becomes a literal constant in IL
- No function call emitted at runtime

---

## **IL Generator Implementation Requirements**

### **Phase 1: Detection**

**IL Generator must detect stub functions:**

```typescript
/**
 * Visit function declaration
 */
public visitFunctionDecl(node: FunctionDecl): void {
  const body = node.getBody();

  if (!body) {
    // This is a stub function - mark as intrinsic
    this.registerIntrinsic(node);
    return; // Don't generate IL for stub functions
  }

  // Generate IL for regular function
  this.generateFunctionIL(node);
}
```

### **Phase 2: Call Site Handling**

**IL Generator must handle calls to stub functions:**

```typescript
/**
 * Visit call expression
 */
public visitCallExpression(node: CallExpression): void {
  const callee = node.getCallee();

  // Resolve callee to function symbol
  const symbol = this.resolveSymbol(callee);

  if (symbol && symbol.kind === SymbolKind.Function) {
    const funcDecl = symbol.declaration as FunctionDecl;

    if (!funcDecl.getBody()) {
      // This is an intrinsic call
      return this.generateIntrinsicCall(funcDecl.getName(), node);
    }
  }

  // Regular function call
  this.generateRegularCall(node);
}
```

### **Phase 3: Intrinsic Registry**

**IL Generator needs intrinsic mapping:**

```typescript
/**
 * Intrinsic function registry
 */
protected intrinsics: Map<string, IntrinsicInfo> = new Map([
  ['peek', {
    intrinsicId: 'intrinsic_peek',
    category: 'memory',
    isCompileTime: false,
    ilGenerator: (args) => this.generatePeekIL(args),
  }],
  ['poke', {
    intrinsicId: 'intrinsic_poke',
    category: 'memory',
    isCompileTime: false,
    ilGenerator: (args) => this.generatePokeIL(args),
  }],
  ['sizeof', {
    intrinsicId: 'intrinsic_sizeof',
    category: 'type',
    isCompileTime: true,
    ilGenerator: (args, typeSystem) => this.evaluateSizeof(args, typeSystem),
  }],
  // ... register all intrinsics
]);

/**
 * Generate IL for intrinsic call
 */
protected generateIntrinsicCall(
  functionName: string,
  callNode: CallExpression
): ILNode {
  const intrinsic = this.intrinsics.get(functionName);

  if (!intrinsic) {
    throw new Error(`Unknown intrinsic function: ${functionName}`);
  }

  if (intrinsic.isCompileTime) {
    // Evaluate at compile-time, emit constant
    return intrinsic.ilGenerator(callNode.getArguments(), this.typeSystem);
  } else {
    // Emit runtime intrinsic IL node
    return intrinsic.ilGenerator(callNode.getArguments());
  }
}
```

### **Phase 4: IL Node Types**

**New IL node types needed:**

```typescript
// IL Node Types for Intrinsics

/**
 * Memory access intrinsic (peek, poke, peekw, pokew)
 */
interface MemoryAccessIL extends ILNode {
  kind: 'MemoryAccess';
  intrinsicId: string; // 'intrinsic_peek' | 'intrinsic_poke' | ...
  addressExpr: ILExpression;
  valueExpr?: ILExpression; // For poke/pokew
  isWord: boolean; // true for peekw/pokew
}

/**
 * Length intrinsic (arrays, strings)
 */
interface LengthIL extends ILNode {
  kind: 'Length';
  intrinsicId: string; // 'intrinsic_length_array' | 'intrinsic_length_string'
  targetExpr: ILExpression;
}

/**
 * Compile-time constant (sizeof result)
 */
interface ConstantIL extends ILNode {
  kind: 'Constant';
  value: number;
  type: TypeInfo;
}
```

---

## **Code Generator Requirements**

### **Phase 1: Intrinsic IL Translation**

**Code generator must translate intrinsic IL to 6502:**

```typescript
/**
 * Generate 6502 code for IL node
 */
protected generateCode(ilNode: ILNode): void {
  switch (ilNode.kind) {
    case 'MemoryAccess':
      this.generateMemoryAccess(ilNode as MemoryAccessIL);
      break;

    case 'Length':
      this.generateLength(ilNode as LengthIL);
      break;

    case 'Constant':
      this.generateConstant(ilNode as ConstantIL);
      break;

    // ... other IL node types
  }
}

/**
 * Generate 6502 code for peek/poke operations
 */
protected generateMemoryAccess(node: MemoryAccessIL): void {
  switch (node.intrinsicId) {
    case 'intrinsic_peek':
      // LDA (address)
      this.emit('LDA', this.evaluateAddress(node.addressExpr));
      break;

    case 'intrinsic_poke':
      // LDA #value / STA address
      this.emit('LDA', this.evaluateExpression(node.valueExpr!));
      this.emit('STA', this.evaluateAddress(node.addressExpr));
      break;

    case 'intrinsic_peekw':
      // LDA address / LDX address+1 (or stack push)
      const addr = this.evaluateAddress(node.addressExpr);
      this.emit('LDA', addr);
      this.emit('LDX', `${addr}+1`);
      break;

    // ... pokew, etc.
  }
}
```

### **Phase 2: Optimization Opportunities**

**Intrinsics enable optimizations:**

1. **Constant Address Folding**:

   ```js
   peek($D020); // Can use absolute addressing directly
   ```

2. **Zero Page Optimization**:

   ```js
   peek($FB); // Use zero page addressing (faster, smaller)
   ```

3. **Inline Expansion**:

   ```js
   // peek($D020) becomes:
   LDA $D020
   // Instead of JSR peek / RTS overhead
   ```

4. **sizeof() Elimination**:
   ```js
   sizeof(byte); // Replaced with literal 1 at compile-time
   // No runtime code at all
   ```

---

## **AST Annotation Strategy**

### **Option 1: Runtime Metadata (Current - No Annotations)**

**Current State**: No special annotations on stub functions

**Pros**:

- Simple
- No AST changes needed

**Cons**:

- IL generator must detect stubs repeatedly
- Slower (needs symbol lookup at every call site)

### **Option 2: AST Metadata (Recommended)**

**Add metadata during semantic analysis:**

```typescript
// In Type Checker or dedicated IntrinsicResolver pass:

public visitFunctionDecl(node: FunctionDecl): void {
  if (!node.getBody()) {
    // Mark as intrinsic
    (node as any).isIntrinsic = true;
    (node as any).intrinsicId = this.resolveIntrinsicId(node.getName());
    (node as any).isCompileTime = this.isCompileTimeIntrinsic(node.getName());
  }
}

public visitCallExpression(node: CallExpression): void {
  const callee = this.resolveCallee(node);

  if (callee && (callee as any).isIntrinsic) {
    // Annotate call site with intrinsic info
    (node as any).isIntrinsicCall = true;
    (node as any).intrinsicId = (callee as any).intrinsicId;
    (node as any).isCompileTime = (callee as any).isCompileTime;
  }
}
```

**Pros**:

- Fast (no repeated lookups)
- Clear intent
- Enables optimization passes

**Cons**:

- AST mutation (but acceptable in semantic phase)
- Slightly more complex

**Recommendation**: Use Option 2 in future semantic analysis enhancement

---

## **Testing Requirements**

### **IL Generator Tests**

**Required test coverage:**

1. **Intrinsic Detection**:
   - Stub functions recognized
   - Regular functions distinguished
   - Mixed modules handled

2. **Call Site Handling**:
   - Intrinsic calls generate special IL
   - Compile-time intrinsics evaluated
   - Type checking already validated

3. **IL Emission**:
   - Memory access IL correct
   - Length IL correct
   - sizeof() becomes constant

4. **Error Cases**:
   - Unknown intrinsic detected
   - Invalid argument types caught
   - Missing intrinsic implementation

### **Code Generator Tests**

**Required test coverage:**

1. **6502 Emission**:
   - peek() generates LDA
   - poke() generates STA
   - peekw/pokew generate word operations

2. **Optimization**:
   - Constant addresses use absolute mode
   - Zero page addresses optimized
   - sizeof() emits no runtime code

3. **Integration**:
   - End-to-end: source → assembly
   - Real C64 hardware patterns
   - Performance benchmarks

---

## **Built-In Functions Source File**

### **BuiltIns.bl65 Module**

**Purpose**: Standard library of intrinsic declarations

**Location**: `examples/stdlib/BuiltIns.bl65` (or similar)

**Content**:

```js
/**
 * Built-In Functions (Compiler Intrinsics)
 *
 * These functions are implemented by the compiler itself, not as
 * regular Blend65 functions. They map directly to 6502 operations
 * or compile-time computations.
 */

// ============================================================
// Memory Access
// ============================================================

/**
 * Read byte from memory address
 *
 * @param address - Memory address (0-65535)
 * @returns Byte value at address
 *
 * @intrinsic intrinsic_peek
 * @codegen LDA (address)
 */
export function peek(address: word): byte;

/**
 * Write byte to memory address
 *
 * @param address - Memory address (0-65535)
 * @param value - Byte value to write
 *
 * @intrinsic intrinsic_poke
 * @codegen STA address
 */
export function poke(address: word, value: byte): void;

/**
 * Read 16-bit word from memory address (little-endian)
 *
 * @param address - Memory address (0-65535)
 * @returns Word value at address
 *
 * @intrinsic intrinsic_peekw
 * @codegen LDA address / LDX address+1
 */
export function peekw(address: word): word;

/**
 * Write 16-bit word to memory address (little-endian)
 *
 * @param address - Memory address (0-65535)
 * @param value - Word value to write
 *
 * @intrinsic intrinsic_pokew
 * @codegen STA address / STX address+1
 */
export function pokew(address: word, value: word): void;

// ============================================================
// Array/String Utilities
// ============================================================

/**
 * Get length of array at runtime
 *
 * @param array - Array to measure
 * @returns Number of elements in array
 *
 * @intrinsic intrinsic_length_array
 * @codegen Read from array descriptor
 */
export function length<T>(array: T[]): word;

// Note: length() is overloaded for strings (same function name)

// ============================================================
// Type Introspection (Compile-Time)
// ============================================================

/**
 * Get size of type in bytes (compile-time constant)
 *
 * This function is evaluated entirely at compile-time.
 * No runtime code is generated.
 *
 * @param type - Type to measure (identifier, not expression)
 * @returns Size in bytes (1, 2, etc.)
 *
 * @intrinsic intrinsic_sizeof
 * @compiletime true
 * @codegen Replaced with literal constant
 *
 * @example
 *   const byteSize = sizeof(byte);  // = 1
 *   const wordSize = sizeof(word);  // = 2
 */
export function sizeof(type: Type): byte;
```

**Usage**:

```js
// In user code:
import peek, poke, sizeof from "BuiltIns";

@map borderColor at $D020: byte;

function clearBorder(): void {
    poke($D020, 0);
}

function readBorder(): byte {
    return peek($D020);
}

const size = sizeof(word);  // Compile-time: 2
```

---

## **Implementation Roadmap**

### **Phase 4.1: Documentation (CURRENT)**

**Tasks**:

- ✅ Create this requirements document
- ✅ Define intrinsic IDs and behavior
- ✅ Specify IL requirements
- ✅ Specify code generation requirements

**Status**: ✅ COMPLETE

---

### **Phase 4.2: AST Annotations (Optional Enhancement)**

**Tasks**:

- Add `isIntrinsic` flag to FunctionDecl
- Add `intrinsicId` to call sites
- Add `isCompileTime` flag
- Update semantic analyzer to set these flags

**Status**: 🔜 FUTURE (not critical for initial IL implementation)

---

### **Phase 4.3: IL Generator Foundation**

**Tasks**:

- Create IL node type definitions
- Create IL generator base classes
- Implement AST → IL traversal
- Add intrinsic detection logic
- Add intrinsic registry
- Implement basic IL emission

**Status**: 🔜 FUTURE (major undertaking, separate plan needed)

**Estimated Time**: 2-3 weeks

---

### **Phase 4.4: Intrinsic IL Generators**

**Tasks**:

- Implement peek/poke IL generation
- Implement peekw/pokew IL generation
- Implement length IL generation
- Implement sizeof compile-time evaluation
- Add IL optimization passes

**Status**: 🔜 FUTURE

**Estimated Time**: 1 week

---

### **Phase 4.5: Code Generator Integration**

**Tasks**:

- Implement 6502 code generation from IL
- Implement intrinsic IL → 6502 translation
- Add addressing mode optimization
- Add zero page detection
- Performance optimization

**Status**: 🔜 FUTURE (depends on 4.3, 4.4)

**Estimated Time**: 2-3 weeks

---

### **Phase 4.6: Testing & Validation**

**Tasks**:

- Create IL generator test suite
- Create code generator test suite
- End-to-end integration tests
- Real C64 hardware validation
- Performance benchmarks

**Status**: 🔜 FUTURE

**Estimated Time**: 1 week

---

## **TODO Comments Strategy**

### **Where to Add TODO Comments**

**1. Symbol Table Builder** (`symbol-table-builder.ts`):

```typescript
// TODO(IL-GEN): Stub functions are currently handled passively.
// Future: Add metadata to symbol for faster intrinsic detection.
// See: plans/il-generator-requirements.md - AST Annotation Strategy
const body = node.getBody();
if (body) {
  // ... process body
}
```

**2. Control Flow Analyzer** (`control-flow-analyzer.ts`):

```typescript
// TODO(IL-GEN): Stub functions are skipped (no CFG).
// This is correct behavior - intrinsics have no control flow.
// See: plans/il-generator-requirements.md
const body = node.getBody();
if (!body) {
  return;
}
```

**3. Type Checker** (`type-checker/assignments.ts` or similar):

```typescript
// TODO(IL-GEN): Add intrinsic metadata to call sites here.
// Annotate CallExpression with:
//   - isIntrinsicCall: boolean
//   - intrinsicId: string
//   - isCompileTime: boolean
// See: plans/il-generator-requirements.md - AST Annotation Strategy
public visitCallExpression(node: CallExpression): void {
  // ... existing type checking logic
}
```

**4. Future IL Generator Directory**:

```typescript
// TODO(IL-GEN): Create packages/compiler/src/il/ directory
// Required files:
//   - il/types.ts - IL node type definitions
//   - il/generator.ts - Main IL generator class
//   - il/intrinsics.ts - Intrinsic registry and handlers
//   - il/optimizer.ts - IL optimization passes
// See: plans/il-generator-requirements.md
```

---

## **Success Criteria**

### **For This Phase (Documentation)**

- ✅ Requirements document complete
- ✅ All intrinsics specified
- ✅ IL requirements defined
- ✅ Code generation strategy clear
- ✅ Implementation roadmap established

### **For Future IL Implementation**

- All stub functions handled by IL generator
- Compile-time intrinsics (sizeof) evaluated correctly
- Runtime intrinsics generate efficient IL
- 6502 code generator translates IL to assembly
- End-to-end tests pass (source → assembly → execution)
- Performance acceptable for real C64 programs

---

## **References**

### **Language Specification**

- `docs/language-specification/11-functions.md` - Function declarations
- `docs/language-specification/05-type-system.md` - Type system details

### **Semantic Analyzer Plans**

- `plans/semantic-analyzer-overview.md` - Current implementation status
- `plans/semantic-analyzer-phase1.5-builtins.md` - Alternative intrinsics approach

### **Source Files**

- `packages/compiler/src/semantic/visitors/symbol-table-builder.ts`
- `packages/compiler/src/semantic/visitors/control-flow-analyzer.ts`
- `packages/compiler/src/semantic/visitors/type-checker/`

### **Test Files**

- `packages/compiler/src/__tests__/integration/stub-functions-integration.test.ts`

---

**Document Status**: ✅ COMPLETE - Ready for review and future IL implementation

**Next Step**: Task 4.2 - Add TODO comments in semantic analyzer files