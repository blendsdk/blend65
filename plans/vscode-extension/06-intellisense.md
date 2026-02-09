# IntelliSense: Completion, Hover & Signature Help (CRITICAL)

> **Document**: 06-intellisense.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete
> **Priority**: 🔴 CRITICAL

## Overview

IntelliSense is the highest-priority feature. It provides autocomplete, hover documentation, and parameter hints for all Blend65 constructs — especially the 10 intrinsics and 151 asm_* functions with rich 6502-specific documentation.

## Data Modules

### `data/intrinsics.ts` — 10 Intrinsic Functions

Pre-built structured data for each intrinsic, sourced from the language spec (`08-intrinsics.md`):

```typescript
interface IntrinsicDef {
  name: string;
  signature: string;           // e.g., "(address: word): byte"
  returnType: string;
  params: { name: string; type: string; description: string }[];
  description: string;         // Markdown documentation
  category: 'memory' | 'byte-extract' | 'compile-time' | 'optimizer';
  cycleCost: string;           // e.g., "4 cycles" or "0 (compile-time)"
  codeGen: string;             // What 6502 instruction(s) it generates
  example: string;             // Usage example
}
```

**All 10 intrinsics:**

| Name | Signature | Cycles | Code Gen |
|------|-----------|--------|----------|
| `peek` | `(address: word): byte` | 4 | `LDA` |
| `poke` | `(address: word, value: byte): void` | 4 | `STA` |
| `peekw` | `(address: word): word` | 8 | 2× `LDA` |
| `pokew` | `(address: word, value: word): void` | 8 | 2× `STA` |
| `lo` | `(value: word): byte` | 0 | compile-time |
| `hi` | `(value: word): byte` | 0-3 | compile-time or mask |
| `length` | `(array\|string): word` | 0 | compile-time |
| `barrier` | `(): void` | 0 | optimizer directive |
| `volatile_read` | `(address: word): byte` | 4 | forced `LDA` |
| `volatile_write` | `(address: word, value: byte): void` | 4 | forced `STA` |

### `data/asm-functions.ts` — 151 ASM Functions

Structured data for all asm_* functions, from the language spec (`09-asm-functions.md`):

```typescript
interface AsmFunctionDef {
  name: string;                // e.g., "asm_lda_imm"
  mnemonic: string;            // e.g., "LDA"
  addressingMode: string;      // e.g., "Immediate"
  syntax6502: string;          // e.g., "LDA #value"
  signature: string;           // e.g., "(value: byte): void"
  params: { name: string; type: string; description: string }[];
  description: string;         // What this instruction does
  category: string;            // "load-store" | "transfer" | "arithmetic" | etc.
  flags: string;               // Affected CPU flags: "N, Z" etc.
  cycles: number;              // Base cycle count
}
```

**Organized by category** (same as language spec):
- Load/Store (LDA, LDX, LDY, STA, STX, STY) — ~38 functions
- Transfer (TAX, TAY, TXA, TYA, TSX, TXS) — 6 functions
- Arithmetic (ADC, SBC, INC, DEC, INX, INY, DEX, DEY) — ~24 functions
- Logic (AND, ORA, EOR) — ~24 functions
- Compare (CMP, CPX, CPY) — ~14 functions
- Shift/Rotate (ASL, LSR, ROL, ROR) — ~20 functions
- Branch (BCC, BCS, BEQ, BNE, BMI, BPL, BVC, BVS) — 8 functions
- Jump/Call (JMP, JSR, RTS, RTI) — 5 functions
- Stack (PHA, PLA, PHP, PLP) — 4 functions
- Flags (CLC, SEC, CLI, SEI, CLD, SED, CLV) — 7 functions
- Bit/Misc (BIT, NOP, BRK) — ~4 functions

### `data/hardware.ts` — C64 Hardware Constants

Common C64 hardware addresses with descriptions:

```typescript
interface HardwareConstDef {
  name: string;                // e.g., "BORDER_COLOR"
  address: number;             // e.g., 0xD020
  addressHex: string;          // e.g., "$D020"
  type: string;                // "byte" or "word"
  description: string;         // e.g., "VIC-II border color register (0-15)"
  register: string;            // e.g., "VIC-II"
  readable: boolean;
  writable: boolean;
}
```

## Autocomplete (`completion.ts`)

### Completion Trigger Contexts

| Trigger | Context | Completions Offered |
|---------|---------|-------------------|
| Typing identifier | Anywhere | Keywords, types, symbols, intrinsics, asm_* |
| `.` after identifier | Member access | Enum members (e.g., `Direction.UP`) |
| `@` | Storage class or address-of | `@zp`, `@ram`, `@data`, `@address` |
| `asm_` | ASM function prefix | All 151 asm_* functions |
| Inside `import { }` | Import specifiers | Exported symbols from target module |

### Completion Item Kinds

| Content | LSP CompletionItemKind | Icon |
|---------|----------------------|------|
| Keywords | `Keyword` | 📝 |
| Types (`byte`, `word`, etc.) | `TypeParameter` | 🔤 |
| User variables | `Variable` | 📦 |
| User constants | `Constant` | 📌 |
| User functions | `Function` | 🔧 |
| Intrinsic functions | `Function` | 🔧 (with `(builtin)` detail) |
| asm_* functions | `Function` | 🔧 (with `(6502)` detail) |
| Enum names | `Enum` | 📋 |
| Enum members | `EnumMember` | 🔹 |
| Snippets | `Snippet` | ✂️ |
| Storage classes | `Keyword` | 📝 |

### Completion Resolution

For `resolveProvider: true`, the server provides detailed documentation on-demand when the user selects a completion item:

```typescript
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  // Look up full documentation for the selected item
  // Add item.documentation (MarkupContent with markdown)
  // Add item.detail (type signature)
  return item;
});
```

### Keyword Completions

All Blend65 keywords offered as completions (filtered by context):

**Module scope:** `module`, `import`, `export`, `from`, `function`, `let`, `const`, `type`, `enum`, `callback`
**Function scope:** `let`, `const`, `if`, `else`, `while`, `for`, `do`, `switch`, `case`, `default`, `break`, `continue`, `return`, `to`, `downto`, `step`

### Symbol Completions from Cache

Uses the cached `SymbolTable` from the document manager:

```typescript
// Get all visible symbols at cursor position
const symbols = documentState.symbolTable?.getAllVisibleSymbols();
if (symbols) {
  for (const [name, symbol] of symbols) {
    items.push({
      label: name,
      kind: mapSymbolKindToCompletionKind(symbol.kind),
      detail: symbol.type ? typeSystem.getTypeDescription(symbol.type) : undefined,
    });
  }
}
```

### Enum Member Completions

When `.` is typed after an enum name, offer its members:

```typescript
// Detect "EnumName." pattern
// Look up enum in symbol table
// Offer all enum members as completions
```

## Hover Info (`hover.ts`)

### Hover Content Strategy

| Target | Hover Content |
|--------|--------------|
| Variable | `let name: type` or `const NAME: type = value` |
| Function | Full signature: `function name(params): returnType` |
| Parameter | `(parameter) name: type` |
| Type alias | `type Name = resolvedType` |
| Enum name | `enum Name` with member count |
| Enum member | `(enum member) EnumName.MEMBER = value` |
| Intrinsic | Signature + description + cycle cost + code generation info |
| asm_* function | 6502 mnemonic + addressing mode + description + flags + cycles |
| Keyword | Brief description of the keyword |
| Number literal | Decimal, hex, and binary representations |

### Hover for Intrinsics (Rich)

```markdown
**peek**(address: word): byte

Read a byte from memory.

**Code Generation:** Single `LDA` instruction
**Cycle Cost:** 4 cycles

```js
let borderColor = peek($D020);
```
```

### Hover for ASM Functions (Rich)

```markdown
**asm_lda_imm**(value: byte): void

`LDA #value` — Load Accumulator (Immediate)

Loads a constant value into the accumulator register.

**Addressing Mode:** Immediate
**6502 Syntax:** `LDA #$FF`
**Cycles:** 2
**Flags Affected:** N, Z
```

### Hover for Numbers

Show all numeric representations:

```markdown
**$D020** — Decimal: 53280, Binary: 0b1101000000100000
```

## Signature Help (`signature-help.ts`)

### Trigger Characters

- `(` — Opening paren starts signature help
- `,` — Comma advances to next parameter

### Signature Help Content

When the cursor is inside a function call's argument list:

```typescript
// User types: poke($D020, |)
// Show:
SignatureInformation {
  label: "poke(address: word, value: byte): void",
  documentation: "Write a byte to memory.",
  parameters: [
    { label: "address: word", documentation: "Memory address to write to" },
    { label: "value: byte", documentation: "Value to write (0-255)" }
  ]
}
// activeParameter: 1 (cursor is at second param)
```

### Supported Call Types

| Call Type | Signature Source |
|-----------|----------------|
| User-defined functions | Symbol table (FunctionDecl parameters) |
| Intrinsic functions | Pre-built `data/intrinsics.ts` |
| asm_* functions | Pre-built `data/asm-functions.ts` |

### Parameter Detection

To determine which parameter the cursor is on, count commas before the cursor position within the current call expression's parentheses. Handle nested calls by tracking paren depth.
