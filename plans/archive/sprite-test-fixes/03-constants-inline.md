# Constants Inline Fix

> **Document**: 03-constants-inline.md
> **Parent**: [Index](00-index.md)

## Overview

Fix `generateIdentifier()` in the IL generator to resolve compile-time constants to immediate load instructions instead of slot loads.

## Implementation Details

### Change in `generateIdentifier()` — `expressions.ts`

**Before** the `tryResolveVariable(name)` call, add a constant check:

```typescript
protected generateIdentifier(expr: IdentifierExpression): void {
  const name = expr.getName();
  this.setLocation(expr.getLocation());

  // NEW: Check if this identifier is a compile-time constant.
  // Constants (e.g., const SPACE_CHAR: byte = 32) should be resolved
  // to immediate loads, not slot loads. The constant's value is known
  // at compile time via the symbol table.
  const constValue = this.tryResolveConstantAddress(name);
  // Actually, tryResolveConstantAddress takes Expression, not string.
  // Need to use the symbol table directly:
  const symbol = this.symbolTable.lookupGlobal(name);
  if (symbol && symbol.isConst && symbol.initializer) {
    const resolvedValue = this.tryResolveConstantAddress(symbol.initializer);
    if (resolvedValue !== undefined) {
      // Check if word-typed constant
      if (this.isWordTyped(expr)) {
        this.builder.loadImmWord(resolvedValue, `const ${name}`);
      } else {
        this.builder.loadImm(resolvedValue & 0xFF, `const ${name}`);
      }
      this.clearLocation();
      return;
    }
  }

  // ... existing tryResolveVariable code follows ...
}
```

### Key Considerations

1. **Existing `tryResolveConstantAddress`** already handles recursive constant resolution (const → const chains, binary expressions between constants)
2. **Word vs byte**: Use `isWordTyped(expr)` to determine whether to emit `loadImm` or `loadImmWord`
3. **Regression safety**: Constants used as poke/peek addresses already work via the separate `tryResolveConstantAddress` path in intrinsic generators — this fix only affects the VALUE expression path

## Testing Requirements

- Test: `const X: byte = 42; let y: byte = X;` → must generate `LDA #$2A` not `LDA $addr`
- Test: `const SCREEN: word = $0400; let p: word = SCREEN;` → must generate `LDA #$00 / LDX #$04`
- Test: `const A: byte = 5; const B: byte = A + 3;` → must resolve B to 8
