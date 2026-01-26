# Requirements: Address-of Operator & Callback

> **Document**: 01-requirements.md  
> **Parent**: [Index](00-index.md)

## Feature Requirements

### 1. Address-of Operator (`@`)

The `@` operator returns the 16-bit memory address of a symbol.

#### 1.1 Variable Address

```js
let counter: byte = 0;
let counterAddr: word = @counter;  // Get address of counter
```

**Requirements:**
- Returns `word` (16-bit) value representing memory address
- Works with all variable types (byte, word, arrays)
- Works with all storage classes (@zp, @ram, @data, @map)

#### 1.2 Function Address

```js
function myFunc(): void { }
let funcAddr: word = @myFunc;  // Get address of function
```

**Requirements:**
- Returns `word` (16-bit) value representing function entry point
- Works with ANY function (not just callbacks)
- Useful for setting up IRQ vectors, jump tables

### 2. Callback Type

The `callback` keyword enables type-safe function references.

#### 2.1 Callback as Function Modifier

```js
callback function rasterIRQ(): void {
    // IRQ handler - must follow calling conventions
}
```

**Requirements:**
- Marks function as callable via indirect mechanism
- Compiler may generate special prologue/epilogue for callback functions
- Used for interrupt handlers, event callbacks

#### 2.2 Callback as Parameter Type

```js
function setRasterInterrupt(line: byte, handler: callback): void {
    // Store handler address in IRQ vector
}
```

**Requirements:**
- Parameter receives function address (16-bit word)
- Type system validates only functions can be passed
- Enables passing function references to other functions

#### 2.3 Usage Pattern

```js
// Define callback function
callback function rasterIRQ(): void {
    borderColor = borderColor + 1;
}

// Pass to function expecting callback parameter
setRasterInterrupt(100, rasterIRQ);
```

## Non-Requirements (Out of Scope)

| Feature | Status | Reason |
|---------|--------|--------|
| `let fn: callback = x` | ❌ Not supported | Storing callbacks in variables |
| `fn()` indirect call | ❌ Not supported | No `CALL_INDIRECT` implementation |
| Function pointers | ❌ Not supported | C-style function pointer types |

## Type System Requirements

### Type Resolution

| Expression | Result Type | Description |
|------------|-------------|-------------|
| `@variable` | `word` | Address of any variable |
| `@function` | `word` | Address of any function |
| `callback` param | `word` (internal) | Function address as parameter |

### Type Validation

1. **`@` operator**: Must be followed by valid identifier (variable or function)
2. **Callback parameter**: Must receive a function identifier (not expression)
3. **Callback modifier**: Only valid on function declarations

## Error Cases

| Error | Message | Example |
|-------|---------|---------|
| Invalid operand | "Address-of requires identifier" | `@(1+2)` |
| Unknown symbol | "Unknown identifier 'x'" | `@unknownVar` |
| Type mismatch | "Expected callback, got byte" | `setIRQ(100, 5)` |
| Invalid callback | "Cannot call callback variable" | `let f: callback = x; f();` |