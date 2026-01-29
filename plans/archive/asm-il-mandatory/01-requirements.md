# Requirements: ASM-IL Mandatory

> **Document**: 01-requirements.md
> **Parent**: [Index](00-index.md)

## Feature Overview

The Blend65 compiler's code generator must **exclusively** produce ASM-IL (Assembly Intermediate Language) as its output. The current implementation incorrectly has ASM-IL as an optional path, with the default being direct text emission via `AssemblyWriter`.

This change ensures:
1. **Optimizability**: ASM-IL modules can be optimized before final emission
2. **Consistency**: Single code path reduces bugs and maintenance burden
3. **Extensibility**: Easy to add new emitters (other assemblers, binary output)
4. **Debug Info**: Source locations properly tracked through structured nodes

## Functional Requirements

### Must Have

- [ ] Remove `useAsmIL` flag from `BaseCodeGenerator`
- [ ] Remove `AssemblyWriter` from CodeGenerator inheritance chain
- [ ] All instruction emission uses `AsmModuleBuilder` exclusively
- [ ] `generate()` method returns `CodegenResult` with `AsmModule` always populated
- [ ] Source locations preserved on all `AsmInstruction` nodes
- [ ] Pipeline uses `compileToAcme()` flow for final assembly text
- [ ] All 7,000+ existing tests continue to pass
- [ ] Generated assembly output equivalent or improved

### Should Have

- [ ] Debug comments in emitted assembly (from ASM-IL comments)
- [ ] VICE label file generation from ASM-IL labels
- [ ] Improved source maps using ASM-IL source locations
- [ ] Better error messages with source locations in codegen warnings

### Won't Have (Out of Scope)

- Full optimizer implementation (separate plan exists)
- New IL instructions (MUL, DIV, arrays are separate issues)
- Changes to IL generation
- Changes to semantic analysis

## Technical Requirements

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CodeGenerator                        │
│                                                          │
│  ┌──────────────────┐     ┌──────────────────────────┐  │
│  │   IL Module      │ ──► │   AsmModuleBuilder       │  │
│  │   (input)        │     │   (primary output)       │  │
│  └──────────────────┘     └──────────────────────────┘  │
│                                    │                     │
│                                    ▼                     │
│                           ┌──────────────────────────┐  │
│                           │   AsmModule              │  │
│                           │   - instructions[]       │  │
│                           │   - labels{}             │  │
│                           │   - sourceLocations      │  │
│                           └──────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────┐
│                    AcmeEmitter                          │
│                                                          │
│  - Convert AsmModule to ACME assembly text               │
│  - Include source comments from sourceLocation           │
│  - Generate VICE labels from AsmLabel nodes              │
└─────────────────────────────────────────────────────────┘
```

### Performance

- Code generation time should not regress significantly
- Memory usage may slightly increase due to ASM-IL nodes (acceptable)
- Final binary output must be identical or smaller

### Compatibility

- **Breaking change** for internal CodeGenerator API
- External CLI API unchanged
- Compiler output format unchanged (.asm, .prg files)

## Scope Decisions

| Decision                        | Options Considered        | Chosen            | Rationale                                                    |
| ------------------------------- | ------------------------- | ----------------- | ------------------------------------------------------------ |
| Remove AssemblyWriter entirely? | Keep for other uses, Remove | Keep externally  | May be useful for standalone assembly utilities               |
| Source location granularity     | Per-instruction, Per-block | Per-instruction  | Better debugging experience                                   |
| Backward compatibility          | Maintain both paths, Remove legacy | Remove legacy | Dual paths caused the bug; single path is cleaner            |
| Emit all comments               | Only debug, All comments  | All comments     | Helps with debugging generated code                           |

## Acceptance Criteria

1. ✅ `useAsmIL` flag completely removed from codebase
2. ✅ No `AssemblyWriter` calls in CodeGenerator inheritance chain
3. ✅ `CodegenResult.module` (AsmModule) always populated
4. ✅ Source locations present on 100% of instruction nodes
5. ✅ Generated assembly includes source location comments in debug mode
6. ✅ VICE labels correctly generated from ASM-IL
7. ✅ All existing tests pass
8. ✅ No regression in compilation speed (within 10%)