# Phase 2: Code Generation with ASM-IL Architecture

> **Status**: Planning
> **Phase**: 2
> **Priority**: HIGH
> **Dependencies**: Phase 1 (Compiler Entry Point)
> **Estimated Sessions**: 8-10

---

## Overview

This phase implements the code generation subsystem with a structured **ASM-IL (Assembly Intermediate Language)** layer. The ASM-IL provides a queryable, optimizable representation of 6502 assembly before text serialization.

### Key Architecture Decision

Instead of directly emitting assembly text strings, we introduce an intermediate representation:

```
IL Module
    │
    ▼
┌────────────────────────────────────────────────────┐
│              Code Generator                        │
│  IL instructions → AsmModule (structured)          │
└────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────┐
│         ASM-IL Optimizer (Pass-Through)            │
│  AsmModule → AsmModule (unchanged for now)         │
│  Future: peephole optimization                     │
└────────────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────────────┐
│              ACME Emitter                          │
│  AsmModule → .asm text string                      │
└────────────────────────────────────────────────────┘
    │
    ▼
   ACME Assembler → .prg binary
```

---

## Sub-Plan Documents

This phase is split into detailed sub-plans for manageability:

| Document                                                 | Description                                        | Est. Time |
| -------------------------------------------------------- | -------------------------------------------------- | --------- |
| [03a-asm-il-types.md](03a-asm-il-types.md)               | Type definitions (AsmInstruction, AsmModule, etc.) | 2-3 hrs   |
| [03b-asm-il-builder.md](03b-asm-il-builder.md)           | Builder classes (inheritance chain)                | 3-4 hrs   |
| [03c-asm-il-optimizer.md](03c-asm-il-optimizer.md)       | Optimizer skeleton (pass-through)                  | 2-3 hrs   |
| [03d-acme-emitter.md](03d-acme-emitter.md)               | ACME text serialization                            | 2-3 hrs   |
| [03e-codegen-rewire.md](03e-codegen-rewire.md)           | Refactor existing CodeGenerator                    | 4-6 hrs   |
| [03f-codegen-integration.md](03f-codegen-integration.md) | Final integration and E2E tests                    | 3-4 hrs   |

---

## Directory Structure

### New ASM-IL Package

```
packages/compiler/src/asm-il/
├── index.ts                     # Public exports
├── types.ts                     # Interfaces and enums
│
├── builder/                     # ASM-IL construction (inheritance chain)
│   ├── base-builder.ts          # BaseAsmBuilder - foundation
│   ├── instruction-builder.ts   # InstructionBuilder extends Base
│   ├── data-builder.ts          # DataBuilder extends Instruction
│   ├── module-builder.ts        # AsmModuleBuilder extends Data (final)
│   └── index.ts                 # Builder exports
│
├── optimizer/                   # ASM-IL optimization (pass-through)
│   ├── base-optimizer.ts        # BaseAsmOptimizer - foundation
│   ├── pass-through.ts          # PassThroughOptimizer
│   ├── asm-optimizer.ts         # AsmOptimizer (final orchestrator)
│   └── index.ts                 # Optimizer exports
│
└── emitters/                    # Output formats
    ├── base-emitter.ts          # BaseEmitter - foundation
    ├── acme-emitter.ts          # AcmeEmitter extends Base
    └── index.ts                 # Emitter exports
```

### Updated Codegen Package

```
packages/compiler/src/codegen/
├── base-generator.ts            # UPDATED: Use AsmModuleBuilder
├── globals-generator.ts         # UPDATED: Emit to ASM-IL
├── instruction-generator.ts     # UPDATED: Emit to ASM-IL
├── code-generator.ts            # UPDATED: Orchestrate pipeline
├── assembly-writer.ts           # DEPRECATED: Replaced by AcmeEmitter
├── ... (other files unchanged)
└── index.ts                     # UPDATED: Export new components
```

### Test Structure

```
packages/compiler/src/__tests__/asm-il/
├── types.test.ts                # Type/enum tests (~30 tests)
├── builder/
│   ├── base-builder.test.ts     # Base builder (~20 tests)
│   ├── instruction-builder.test.ts  # Instructions (~40 tests)
│   ├── data-builder.test.ts     # Data directives (~25 tests)
│   └── module-builder.test.ts   # Full builder (~35 tests)
├── optimizer/
│   ├── pass-through.test.ts     # Pass-through (~15 tests)
│   └── asm-optimizer.test.ts    # Orchestration (~20 tests)
├── emitters/
│   └── acme-emitter.test.ts     # ACME output (~50 tests)
└── integration/
    ├── simple-program.test.ts   # Simple E2E (~20 tests)
    └── full-pipeline.test.ts    # Complete pipeline (~30 tests)
```

---

## Implementation Sessions

Each session is designed to be completable within AI context limits:

| Session | Focus                   | Deliverables                       | Tests |
| ------- | ----------------------- | ---------------------------------- | ----- |
| 1       | Plan documents          | 03a, 03b plan files                | -     |
| 2       | More plans              | 03c, 03d, 03e, 03f plan files      | -     |
| 3       | Types + base builder    | types.ts, base-builder.ts          | ~50   |
| 4       | Instruction builder     | instruction-builder.ts             | ~40   |
| 5       | Data + module builder   | data-builder.ts, module-builder.ts | ~60   |
| 6       | Optimizer skeleton      | optimizer/\*.ts                    | ~35   |
| 7       | ACME emitter            | emitters/\*.ts                     | ~50   |
| 8       | Codegen rewire (Part 1) | base-generator.ts updates          | ~30   |
| 9       | Codegen rewire (Part 2) | instruction-generator.ts updates   | ~40   |
| 10      | Integration             | code-generator.ts, E2E             | ~50   |

**Total Estimated Tests: ~355**

---

## Multi-Chain Inheritance Pattern

All builder classes use the same inheritance pattern as the parser:

```
Base → Layer1 → Layer2 → ... → Concrete
```

**Example: AsmModuleBuilder**

```
BaseAsmBuilder        (utilities, state management)
       ↓
InstructionBuilder    (CPU instruction methods)
       ↓
DataBuilder           (data directive methods)
       ↓
AsmModuleBuilder      (final concrete, module management)
```

**Benefits:**

- Each layer: 200-500 lines maximum
- Clear separation of concerns
- Easy to extend in future
- Fits AI context window

---

## Success Criteria

### Phase 2 Complete When:

- [ ] All ~355 tests passing
- [ ] `Compiler.compile()` produces .prg via ASM-IL pipeline
- [ ] Hello World runs in VICE
- [ ] Existing codegen tests still pass
- [ ] AssemblyWriter marked deprecated (but still functional)
- [ ] Documentation complete

### Output Quality:

- Same .asm output as current codegen (byte-for-byte)
- Same .prg binary (via ACME)
- Better internal structure

---

## Dependencies

### Required Before Phase 2:

- Phase 0: Config System (for compilation options)
- Phase 1: Compiler Entry (orchestrates pipeline)

### Provided to Later Phases:

- Phase 3: Source Maps (ASM-IL has location metadata)
- Phase 4: CLI (uses Compiler which uses ASM-IL)
- Future: Native Assembler (consumes AsmModule directly)
- Future: ASM-IL Optimizer (operates on AsmModule)

---

## Migration Strategy

### Step 1: Create ASM-IL (Sessions 3-7)

Build new ASM-IL infrastructure alongside existing codegen.
No changes to existing code yet.

### Step 2: Rewire Codegen (Sessions 8-9)

Update CodeGenerator to use ASM-IL internally.
AssemblyWriter still exists but unused.

### Step 3: Integration (Session 10)

Full pipeline working: IL → ASM-IL → ACME → .prg
Verify identical output.

### Step 4: Deprecation (Future)

Mark AssemblyWriter as deprecated.
Keep for backwards compatibility.

---

## Quick Reference: ASM-IL Types

```typescript
// Core instruction type
interface AsmInstruction {
  mnemonic: string; // 'LDA', 'STA', etc.
  mode: AddressingMode; // Immediate, Absolute, etc.
  operand?: number | string; // Value or label
  cycles: number; // CPU cycles
  bytes: number; // Instruction size
  comment?: string;
  sourceLocation?: SourceLocation;
}

// Complete module
interface AsmModule {
  name: string;
  origin: number;
  items: AsmItem[]; // Instructions, labels, data
  labels: Map<string, AsmLabel>;
}
```

---

**Next Steps:** Read sub-plan documents starting with [03a-asm-il-types.md](03a-asm-il-types.md)

---

## Related Documents

- [01-config-system.md](01-config-system.md) - Configuration (Phase 0)
- [02-compiler-entry.md](02-compiler-entry.md) - Compiler class (Phase 1)
- [04-source-maps.md](04-source-maps.md) - Debug support (Phase 3)
- `plans/optimizer/` - IL Optimizer documentation
