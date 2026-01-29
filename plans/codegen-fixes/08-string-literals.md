# String Literals: Phase 5

> **Document**: 08-string-literals.md
> **Parent**: [Index](00-index.md)
> **Phase**: 5 (After Calling Convention)
> **REQ**: REQ-05 (String Literals)

## Overview

Currently string literals return address 0 (lost). Must allocate strings in data section and return actual address.

---

## Solution

### 1. IL Generator Fix (expressions.ts)

```typescript
protected generateStringLiteral(value: string, expr: LiteralExpression): VirtualRegister {
  // Allocate string in data section (with null terminator)
  const stringLabel = this.allocateStringConstant(value);
  
  // Return a LOAD_ADDRESS of the string label
  return this.builder?.emitLoadAddress(stringLabel, 'string') ?? null;
}

protected allocateStringConstant(value: string): string {
  // Check if already allocated
  const existing = this.stringConstants.get(value);
  if (existing) return existing;
  
  // Allocate new string
  const label = `_str_${this.stringCounter++}`;
  this.stringConstants.set(value, label);
  this.pendingStrings.push({ label, value });
  return label;
}
```

### 2. Code Generator: Data Section

```typescript
protected generateDataSection(): void {
  this.emitSectionComment('String Constants');
  
  for (const str of this.currentModule.getStringConstants()) {
    this.emitLabel(str.label, 'data');
    // Emit bytes with null terminator
    this.emitBytes(str.value);
    this.emitByte(0);  // Null terminator
  }
}

protected emitBytes(text: string): void {
  const bytes = text.split('').map(c => c.charCodeAt(0));
  this.asmBuilder.raw(`        !text "${escapeString(text)}", 0`);
}
```

---

## Task Breakdown

### Session 5.1: String Allocation (2-3 hours)

| Task | Description |
|------|-------------|
| 5.1.1 | Add string table to IL generator |
| 5.1.2 | Implement `allocateStringConstant()` |
| 5.1.3 | Fix `generateStringLiteral()` |

### Session 5.2: Data Section Emission (2-3 hours)

| Task | Description |
|------|-------------|
| 5.2.1 | Add `generateDataSection()` |
| 5.2.2 | Handle string escaping |
| 5.2.3 | Emit null terminators |

### Session 5.3: String Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 5.3.1 | Test string allocation |
| 5.3.2 | Test string address loading |
| 5.3.3 | Test string in data section |

---

## Success Criteria

1. ✅ Strings allocated in data section
2. ✅ String literals return correct address
3. ✅ Null terminators added
4. ✅ 15+ string tests pass