# Overview

> **Status**: Lexer-Derived Specification  
> **Last Updated**: January 8, 2026  
> **Related Documents**: [Lexical Structure](01-lexical-structure.md), [Program Structure](03-program-structure.md)

## Introduction

Blend65 is a modern programming language designed to compile to 6502-family systems, including:
- Commodore 64
- VIC-20
- Commander X16
- Other 6502-based platforms

The language aims to provide **structured programming**, **modularity**, and a **practical type system** while still enabling fine-grained memory placement and low-level control necessary for 6502 development.

## Design Goals

### 1. Modern Syntax with Low-Level Control

Blend65 combines modern programming language features with direct hardware access:
- Structured control flow (if/while/for/match)
- Type safety (byte/word/boolean/string types)
- Module system (import/export)
- Direct memory access (memory-mapped variables)
- Fine-grained memory placement (storage classes)

### 2. 6502-Specific Features

The language is designed specifically for 6502 systems and includes:
- **Storage classes** (`@zp`, `@ram`, `@data`) for memory placement control
- **Memory-mapped variables** (`@map`) for hardware register access
- **Callback functions** for interrupt handlers
- **Zero-overhead abstractions** that compile to efficient 6502 assembly

### 3. Readable and Maintainable

Unlike traditional 6502 assembly or BASIC:
- Clear variable and function names
- Block-structured syntax
- Type annotations for clarity
- Comments for documentation

### 4. Predictable Compilation

The language is designed for **predictable code generation**:
- No hidden allocations or runtime overhead
- Explicit memory placement
- Direct mapping to 6502 instructions
- Transparent compilation model

## Specification Status

This specification is **lexer-derived**, meaning:

- ✅ If a construct is tokenizable and parseable by the current frontend, it is specified here
- ❌ If a construct cannot be tokenized, it is not part of the language specification
- 🔄 Some higher-level semantics (type checking rules, code generation) may evolve as the compiler backend develops

### Implementation References

The specification is derived from:
- **Lexer**: `packages/compiler/src/lexer/lexer.ts` and `packages/compiler/src/lexer/types.ts`
- **Parser**: `packages/compiler/src/parser/`
- **Tests**: `packages/compiler/src/__tests__/lexer/` and `packages/compiler/src/__tests__/parser/`

If you need to understand the exact behavior of a language construct, these implementation files are the canonical source of truth.

## Key Language Characteristics

### Case-Sensitive Keywords

All keywords are **case-sensitive**:
- `break` is a keyword
- `Break` is an identifier

### Semicolon-Terminated Statements

Blend65 uses **semicolons** (`;`) to separate statements, not newlines:
```js
let x: byte = 5;
let y: byte = 10;
```

### Block-Structured with Explicit Terminators

Control flow and declarations use block structure with `end` terminators:
```js
function main(): void
  if x > 5 then
    doSomething();
  end if
end function
```

### Explicit Memory Control

Variables can be explicitly placed in different memory regions:
```js
@zp let counter: byte = 0;        // Zero page (fast)
@ram let buffer: byte[1000];      // General RAM (default)
@data const table: byte[256];     // Initialized data section
```

## Language Philosophy

Blend65 is designed around these core principles:

1. **Explicit over Implicit** - Memory placement, types, and control flow are always explicit
2. **Zero Cost Abstractions** - High-level constructs compile to efficient 6502 code
3. **Hardware First** - Language features map directly to 6502 capabilities
4. **Type Safety Where Possible** - Catch errors at compile time, not runtime
5. **Readable Assembly Alternative** - More maintainable than raw assembly, as efficient as hand-written code

## What Makes Blend65 Different?

### Compared to C64 BASIC:
- ✅ Structured programming (no GOTO spaghetti)
- ✅ Type safety
- ✅ Module system
- ✅ Compiles to native 6502 code (not interpreted)

### Compared to CC65 (C compiler):
- ✅ 6502-specific storage classes and memory mapping
- ✅ Simpler syntax for hardware access
- ✅ No pointer arithmetic confusion
- ✅ Designed for 6502, not ported from another architecture

### Compared to 6502 Assembly:
- ✅ High-level control flow
- ✅ Type checking
- ✅ Variables with meaningful names
- ✅ Module system and code organization
- ⚠️ Still compiles to equivalent assembly code

## Next Steps

To understand Blend65 in detail, read the specification documents in order:

1. **[Lexical Structure](01-lexical-structure.md)** - Learn about tokens, keywords, and literals
2. **[Grammar](02-grammar.md)** - Understand the EBNF grammar notation
3. **[Program Structure](03-program-structure.md)** - See how programs are organized
4. **[Module System](04-module-system.md)** - Learn about modules, imports, and exports
5. **[Type System](05-type-system.md)** - Understand types, aliases, and enums
6. **[Expressions & Statements](06-expressions-statements.md)** - Master the core language constructs

For specific features, jump to:
- **[Variables](10-variables.md)** - Variable declarations and storage classes
- **[Functions](11-functions.md)** - Function declarations and callbacks
- **[Memory-Mapped](12-memory-mapped.md)** - Hardware register access
- **[Examples](21-examples.md)** - Complete working code examples
