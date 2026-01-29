# ASM-IL Mandatory Implementation Plan

> **Feature**: Make ASM-IL the mandatory output path for CodeGenerator
> **Status**: Planning Complete
> **Created**: January 28, 2026

## Overview

The Blend65 compiler currently has **two code generation paths**:

1. **Legacy Path** (default): `IL → CodeGenerator → AssemblyWriter → Text`
2. **ASM-IL Path** (optional): `IL → CodeGenerator → AsmModuleBuilder → AsmModule`

This plan implements the **correct architecture** where ASM-IL is the **only** path:

```
IL Module
    │
    ▼
┌────────────────────┐
│   CodeGenerator    │ ──►  ASM-IL Module (ALWAYS)
└────────────────────┘
    │
    ▼
┌────────────────────┐
│   ASM-IL Optimizer │ ──►  Optimized ASM-IL Module
└────────────────────┘
    │
    ▼
┌────────────────────┐
│   ACME Emitter     │ ──►  .asm text
└────────────────────┘
    │
    ▼
┌────────────────────┐
│      ACME          │ ──►  .prg binary
└────────────────────┘
```

## Document Index

| #   | Document                                        | Description                             |
| --- | ----------------------------------------------- | --------------------------------------- |
| 00  | [Index](00-index.md)                            | This document - overview and navigation |
| 01  | [Requirements](01-requirements.md)              | Feature requirements and scope          |
| 02  | [Current State](02-current-state.md)            | Analysis of current implementation      |
| 03  | [CodeGen Refactor](03-codegen-refactor.md)      | CodeGenerator technical specification   |
| 04  | [ASM-IL Builder](04-asm-il-builder.md)          | ASM-IL builder enhancements             |
| 05  | [Source Location](05-source-location.md)        | Source location handling                |
| 06  | [Pipeline Integration](06-pipeline-integration.md) | Pipeline changes                     |
| 07  | [Testing Strategy](07-testing-strategy.md)      | Test cases and verification             |
| 99  | [Execution Plan](99-execution-plan.md)          | Phases, sessions, and task checklist    |

## Quick Reference

### The Problem

```typescript
// base-generator.ts - WRONG!
protected useAsmIL: boolean = false;  // Should not exist!
```

The `useAsmIL` flag makes ASM-IL optional when it should be mandatory.

### The Fix

1. Remove `useAsmIL` flag entirely
2. Remove `AssemblyWriter` from CodeGenerator
3. Make `AsmModuleBuilder` the **only** output mechanism
4. All assembly text comes from `AcmeEmitter` converting ASM-IL

### Key Decisions

| Decision                   | Outcome                                    |
| -------------------------- | ------------------------------------------ |
| Remove dual output paths   | ASM-IL only                                |
| AssemblyWriter in CodeGen  | Remove (keep for other uses if any)        |
| Source location handling   | Preserved via ASM-IL `sourceLocation` field|
| Pipeline integration       | Use `compileToAcme()` flow                 |
| Backward compatibility     | Breaking change (internal API only)        |

## Related Files

**CodeGenerator:**
- `packages/compiler/src/codegen/base-generator.ts`
- `packages/compiler/src/codegen/instruction-generator.ts`
- `packages/compiler/src/codegen/code-generator.ts`

**ASM-IL:**
- `packages/compiler/src/asm-il/types.ts`
- `packages/compiler/src/asm-il/builder/`
- `packages/compiler/src/asm-il/emitters/`

**Pipeline:**
- `packages/compiler/src/pipeline/codegen-phase.ts`
- `packages/compiler/src/asm-il/compile-to-acme.ts`

## Success Criteria

1. ✅ `useAsmIL` flag removed
2. ✅ `AssemblyWriter` removed from CodeGenerator inheritance chain
3. ✅ All code generation produces ASM-IL nodes
4. ✅ Source locations preserved through ASM-IL
5. ✅ Pipeline uses ASM-IL path exclusively
6. ✅ All 7,000+ tests still pass
7. ✅ Generated assembly identical or improved