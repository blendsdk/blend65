# Current State: ASM-IL Mandatory

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The current code generator has a **dual output path** architecture:

1. **Primary (Legacy) Path**: Direct text emission via `AssemblyWriter`
2. **Secondary (Optional) Path**: ASM-IL node emission via `AsmModuleBuilder`

The `useAsmIL` flag in `BaseCodeGenerator` controls which path is used:

```typescript
// base-generator.ts line ~47
protected useAsmIL: boolean = false;  // DEFAULT IS OFF!
```

When `useAsmIL` is false (default):
- `AssemblyWriter` methods are called to emit text directly
- No structured ASM-IL module is created
- Source locations are tracked via `SourceMapper` class
- Text is written character by character

When `useAsmIL` is true:
- BOTH `AssemblyWriter` AND `AsmModuleBuilder` are called (dual emission)
- ASM-IL nodes are created alongside text
- This is wasteful and inconsistent

### Relevant Files

| File                                   | Purpose                              | Changes Needed                    |
| -------------------------------------- | ------------------------------------ | --------------------------------- |
| `codegen/base-generator.ts`            | Base class with helpers              | Remove AssemblyWriter, useAsmIL   |
| `codegen/globals-generator.ts`         | Global variable generation           | Use only AsmBuilder methods       |
| `codegen/instruction-generator.ts`     | IL instruction translation           | Use only AsmBuilder methods       |
| `codegen/code-generator.ts`            | Final concrete class                 | Update generate() flow            |
| `codegen/assembly-writer.ts`           | Legacy text emission                 | Keep but remove from inheritance  |
| `codegen/source-mapper.ts`             | Source location tracking             | May be replaced by ASM-IL locs    |
| `asm-il/builder/module-builder.ts`     | Builds AsmModule                     | Add missing methods               |
| `asm-il/emitters/acme-emitter.ts`      | Converts to ACME text                | Enhance source loc comments       |
| `pipeline/codegen-phase.ts`            | Pipeline integration                 | Use compileToAcme() flow          |

### Code Analysis

**Problem 1: Default is Legacy Path**

```typescript
// base-generator.ts
protected useAsmIL: boolean = false;  // WRONG - should not exist
```

**Problem 2: Dual Emission Pattern**

Every emit method does BOTH paths:

```typescript
// base-generator.ts
protected emitLdaImmediate(value: number, comment?: string): void {
  // Legacy: AssemblyWriter (ALWAYS RUNS)
  this.emitInstruction('LDA', this.formatImmediate(value), comment, 2);

  // Phase 3e: AsmBuilder (ONLY IF useAsmIL is true)
  if (this.useAsmIL) {
    this.asmBuilder.ldaImm(value, comment);  // Duplicate work!
  }
}
```

**Problem 3: Pipeline Uses Legacy Path**

```typescript
// codegen-phase.ts
const codegenResult = this.codeGenerator.generate(ilModule, internalOptions);
// Uses generate() which defaults to useAsmIL=false
// NOT generateWithAsmIL()
```

## Gaps Identified

### Gap 1: Optional ASM-IL

**Current Behavior:** ASM-IL generation is optional and off by default
**Required Behavior:** ASM-IL is the only output mechanism
**Fix Required:** Remove flag, remove legacy path

### Gap 2: Dual Emission Waste

**Current Behavior:** Both AssemblyWriter and AsmBuilder called when useAsmIL=true
**Required Behavior:** Only AsmBuilder called, AcmeEmitter produces text
**Fix Required:** Remove all AssemblyWriter calls from CodeGenerator chain

### Gap 3: Source Locations Not on All Nodes

**Current Behavior:** Source locations tracked via SourceMapper, not on ASM-IL nodes
**Required Behavior:** Every AsmInstruction has sourceLocation property set
**Fix Required:** Pass IL metadata.location to all AsmBuilder calls

### Gap 4: Pipeline Not Using ASM-IL Flow

**Current Behavior:** Pipeline calls `generate()` which uses legacy path
**Required Behavior:** Pipeline uses `compileToAcme()` flow
**Fix Required:** Update codegen-phase.ts to use correct flow

## Dependencies

### Internal Dependencies

- `AsmModuleBuilder` must have all methods needed by CodeGenerator
- `AcmeEmitter` must emit source location comments
- Pipeline must be updated to use new flow

### External Dependencies

- None (pure internal refactoring)

## Risks and Concerns

| Risk                              | Likelihood | Impact | Mitigation                                        |
| --------------------------------- | ---------- | ------ | ------------------------------------------------- |
| Breaking existing tests           | Medium     | High   | Run full test suite after each change             |
| Output differs from current       | Medium     | Medium | Compare assembly output before/after              |
| Performance regression            | Low        | Low    | ASM-IL nodes are lightweight; measure if needed   |
| Missing AsmBuilder methods        | Medium     | Medium | Add missing methods to builder as needed          |
| Source locations missing/wrong    | Medium     | Medium | Verify all paths pass locations correctly         |

## Statistics

- **Files to modify**: ~8 files
- **Lines to change**: ~500-800 lines
- **Tests affected**: All codegen tests (500+)
- **Estimated sessions**: 4-6 sessions