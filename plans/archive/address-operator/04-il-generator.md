# IL Generator Changes

> **Document**: 04-il-generator.md  
> **Parent**: [Index](00-index.md)

## Overview

This document describes the changes needed in the IL generator to properly handle:
1. The address-of operator (`@variable`, `@function`)
2. Function identifiers passed as callback parameters

## Files to Modify

| File | Purpose |
|------|---------|
| `packages/compiler/src/il/generator/expressions.ts` | Fix `@` operator and function references |

## Change 1: Fix Address-of Operator (`@`)

### Current Problem

The `@` operator handler just returns the operand register without emitting any address-loading instruction:

```typescript
case TokenType.ADDRESS:
  this.addWarning('Address-of operator not fully implemented', ...);
  return operandReg;  // BUG: Returns value, not address!
```

### Solution

Replace with proper implementation that emits `LOAD_ADDRESS`:

```typescript
case TokenType.ADDRESS: {
  // Address-of operator (@) - get memory address of symbol
  const operand = expr.getOperand();
  
  // Operand must be an identifier (variable or function name)
  if (!isIdentifierExpression(operand)) {
    this.addError(
      'Address-of operator requires an identifier',
      expr.getLocation(),
      'E_ADDRESS_REQUIRES_IDENTIFIER',
    );
    return this.builder.emitConst(0, expr.getLocation());
  }
  
  const name = operand.getName();
  
  // Check if it's a function
  const funcSymbol = this.lookupFunction(name);
  if (funcSymbol) {
    return this.builder.emitLoadAddress(name, 'function', expr.getLocation());
  }
  
  // Check if it's a variable (local, param, or global)
  const varSymbol = this.lookupVariable(name);
  if (varSymbol) {
    return this.builder.emitLoadAddress(name, 'variable', expr.getLocation());
  }
  
  // Unknown symbol
  this.addError(
    `Unknown symbol '${name}'`,
    operand.getLocation(),
    'E_UNKNOWN_SYMBOL',
  );
  return this.builder.emitConst(0, expr.getLocation());
}
```

## Change 2: Handle Function Identifiers

### Current Problem

When a function name is used as an argument (for callback parameters), `generateIdentifierExpression()` fails because it only checks for variables:

```typescript
// Current flow for: setInterrupt(100, rasterIRQ)
// When processing identifier "rasterIRQ":
generateIdentifierExpression(expr) {
  // Check local variable? NO
  // Check parameter? NO
  // Check global variable? NO
  // Result: ERROR "Unknown identifier"
}
```

### Solution

Add function lookup to `generateIdentifierExpression()`:

```typescript
/**
 * Generates IL for an identifier expression.
 * Handles variables, parameters, and function references.
 */
protected generateIdentifierExpression(expr: IdentifierExpression): ILRegister {
  const name = expr.getName();
  const location = expr.getLocation();
  
  // 1. Check local variables
  const localReg = this.getLocalVariable(name);
  if (localReg) {
    return localReg;
  }
  
  // 2. Check parameters
  const paramReg = this.getParameter(name);
  if (paramReg) {
    return paramReg;
  }
  
  // 3. Check global variables
  const globalSymbol = this.lookupGlobalVariable(name);
  if (globalSymbol) {
    return this.builder.emitLoadVar(name, location);
  }
  
  // 4. NEW: Check if it's a function (for callback parameters)
  const funcSymbol = this.lookupFunction(name);
  if (funcSymbol) {
    // Function used as value = get its address
    // This happens when passing function to callback parameter
    return this.builder.emitLoadAddress(name, 'function', location);
  }
  
  // Unknown identifier
  this.addError(
    `Unknown identifier '${name}'`,
    location,
    'E_UNKNOWN_IDENTIFIER',
  );
  return this.builder.emitConst(0, location);
}
```

## Helper Methods Needed

### lookupFunction()

Add method to check if identifier is a function:

```typescript
/**
 * Looks up a function by name in the symbol table.
 * 
 * @param name - The function name to look up
 * @returns The function symbol if found, undefined otherwise
 */
protected lookupFunction(name: string): FunctionSymbol | undefined {
  // Check symbol table for function
  const symbol = this.symbolTable.lookup(name);
  if (symbol && symbol.kind === SymbolKind.Function) {
    return symbol as FunctionSymbol;
  }
  return undefined;
}
```

### lookupVariable()

Add method to check if identifier is a variable:

```typescript
/**
 * Looks up a variable by name (local, param, or global).
 * 
 * @param name - The variable name to look up
 * @returns The variable symbol if found, undefined otherwise
 */
protected lookupVariable(name: string): VariableSymbol | undefined {
  // Check locals
  if (this.hasLocalVariable(name)) {
    return this.getLocalVariableSymbol(name);
  }
  
  // Check parameters
  if (this.hasParameter(name)) {
    return this.getParameterSymbol(name);
  }
  
  // Check globals
  const symbol = this.symbolTable.lookup(name);
  if (symbol && symbol.kind === SymbolKind.Variable) {
    return symbol as VariableSymbol;
  }
  
  return undefined;
}
```

## IL Output Examples

### Example 1: Variable Address

```js
let counter: byte = 0;
let addr: word = @counter;
```

Generated IL:
```
; Variable declaration
CONST 0 -> r1
STORE_VAR "counter", r1

; Address-of variable
LOAD_ADDRESS "counter", "variable" -> r2
STORE_VAR "addr", r2
```

### Example 2: Function Address

```js
callback function rasterIRQ(): void { }
let funcAddr: word = @rasterIRQ;
```

Generated IL:
```
; Function address
LOAD_ADDRESS "rasterIRQ", "function" -> r1
STORE_VAR "funcAddr", r1
```

### Example 3: Callback Parameter

```js
function setInterrupt(line: byte, handler: callback): void {
    // ... store handler address
}

callback function rasterIRQ(): void { }

setInterrupt(100, rasterIRQ);
```

Generated IL:
```
; Call with callback argument
CONST 100 -> r1                           ; line argument
LOAD_ADDRESS "rasterIRQ", "function" -> r2  ; handler argument (function address)
CALL "setInterrupt", r1, r2 -> r3
```

## Testing Requirements

| Test Case | Description |
|-----------|-------------|
| `@variable` generates LOAD_ADDRESS | Verify variable address loading |
| `@function` generates LOAD_ADDRESS | Verify function address loading |
| Function as callback arg | Verify function identifier emits address |
| Invalid `@` operand | Verify error for `@(1+2)` |
| Unknown symbol | Verify error for `@unknownVar` |
| Local variable address | Verify `@` works with local vars |
| Global variable address | Verify `@` works with global vars |
| Parameter address | Verify `@` works with parameters |