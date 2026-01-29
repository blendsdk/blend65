# Module System: Phase 8

> **Document**: 11-module-system.md
> **Parent**: [Index](00-index.md)
> **Phase**: 8 (After Register Allocation)
> **REQ**: REQ-11 (Multi-Module)

## Overview

Currently the compiler processes single modules. For real programs, we need:
- Import/export resolution
- Cross-module function calls
- Shared global variables

---

## Module Compilation Model

### Single Module Output (Current)
```
main.blend → main.asm
```

### Multi-Module Output (Target)
```
main.blend    → main.asm (entry point)
utils.blend   → utils.asm (library)
hardware.blend → hardware.asm (library)

Link order: hardware.asm, utils.asm, main.asm
```

---

## Export/Import Handling

### Exported Symbols

```typescript
// In IL Module
interface ILModule {
  exports: Map<string, ExportedSymbol>;
}

interface ExportedSymbol {
  name: string;
  kind: 'function' | 'variable' | 'constant';
  label: string;  // Assembly label
}
```

### Code Generator Changes

```typescript
protected generateExports(): void {
  // Generate export labels at module level
  for (const [name, symbol] of this.currentModule.exports) {
    // Emit global label for cross-module linking
    this.asmBuilder.raw(`${symbol.label} = ${this.getSymbolAddress(name)}`);
  }
}
```

---

## Cross-Module Function Calls

```asm
; Calling exported function from another module
        JSR _utils_printChar   ; External label

; The linker/assembler resolves this at link time
```

---

## Task Breakdown

### Session 8.1: Export Generation (2-3 hours)

| Task | Description |
|------|-------------|
| 8.1.1 | Track exports in IL module |
| 8.1.2 | Generate export labels |
| 8.1.3 | Test export visibility |

### Session 8.2: Import Resolution (2-3 hours)

| Task | Description |
|------|-------------|
| 8.2.1 | Track imports in IL module |
| 8.2.2 | Generate external references |
| 8.2.3 | Test cross-module calls |

### Session 8.3: Multi-Module Tests (2-3 hours)

| Task | Description |
|------|-------------|
| 8.3.1 | Test two-module program |
| 8.3.2 | Test shared globals |
| 8.3.3 | Test library functions |

---

## Success Criteria

1. ✅ Exports generate correct labels
2. ✅ Imports resolve to external symbols
3. ✅ Cross-module calls work
4. ✅ 15+ module system tests pass