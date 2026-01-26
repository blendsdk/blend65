# Address-of Operator & Callback Implementation Plan

> **Feature**: `@address` operator and `callback` function support  
> **Status**: Planning Complete  
> **Created**: January 2026

## Overview

This plan documents the implementation of the address-of operator (`@`) and callback function support for the Blend65 compiler. The feature enables:

1. **Address-of operator** (`@variable`, `@function`) - Get 16-bit memory address of any symbol
2. **Callback type** - Type-safe function references for IRQ handlers and event callbacks

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Index](00-index.md) | This document - overview and navigation |
| 01 | [Requirements](01-requirements.md) | Feature requirements and scope |
| 02 | [Current State](02-current-state.md) | Analysis of current implementation |
| 03 | [IL Infrastructure](03-il-infrastructure.md) | New IL opcodes and instruction classes |
| 04 | [IL Generator](04-il-generator.md) | IL generator changes |
| 05 | [ASM-IL Layer](05-asm-il-layer.md) | ASM-IL conversion implementation |
| 06 | [CodeGen Layer](06-codegen-layer.md) | 6502 assembly generation |
| 07 | [Testing Strategy](07-testing-strategy.md) | Test cases and verification |
| 99 | [Execution Plan](99-execution-plan.md) | Phases, sessions, and task checklist |

## Quick Reference

### Syntax Examples

```js
// Address-of operator
let addr: word = @myVariable;    // Get address of variable
let funcAddr: word = @myFunc;    // Get address of function

// Callback as function modifier
callback function rasterIRQ(): void {
    // IRQ handler code
}

// Callback as parameter type
function setInterrupt(line: byte, handler: callback): void {
    // Store handler address
}

// Usage
setInterrupt(100, rasterIRQ);    // Pass function as callback
```

### Target 6502 Assembly

```asm
; Load address of symbol (16-bit)
LDA #<symbol    ; Low byte
STA result_lo
LDA #>symbol    ; High byte
STA result_hi
```

## Scope Decisions

| Decision | Outcome |
|----------|---------|
| `@funcName` scope | Returns address of ANY function (not just callbacks) |
| Variable callback type | NOT supported (`let fn: callback = x; fn();`) |
| Indirect calls | NOT in scope (no `CALL_INDIRECT` implementation) |
| Callback uses | Function modifier + Parameter type only |

## Related Files

**Compiler Pipeline:**
- `packages/compiler/src/il/instructions.ts` - IL opcodes
- `packages/compiler/src/il/generator/expressions.ts` - Expression IL generation
- `packages/compiler/src/asm-il/` - ASM-IL conversion layer
- `packages/compiler/src/codegen/` - 6502 code generation

**Documentation:**
- `docs/language-specification/06-expressions-statements.md` - Expression syntax
- `docs/language-specification/11-functions.md` - Function and callback syntax