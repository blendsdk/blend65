# Phase 4: Compiler Integration

> **Document**: 40-integration/40-overview.md
> **Parent**: [../00-index.md](../00-index.md)
> **Status**: Ready

## Overview

This phase integrates SFA into the existing compiler pipeline: Semantic Analyzer → IL Generator → Code Generator.

---

## 1. Integration Points

| Component | Integration | Changes |
|-----------|-------------|---------|
| **Semantic Analyzer** | Call FrameAllocator after call graph | Add allocation phase |
| **IL Generator** | Use FrameMap for address resolution | Pass frame info |
| **Code Generator** | Emit correct addressing modes | Use slot.location |

---

## 2. Semantic Analyzer Integration

```typescript
// semantic/analyzer.ts
class SemanticAnalyzer {
  analyze(program: Program): SemanticResult {
    // 1. Build symbol table (existing)
    const symbolTable = this.buildSymbolTable(program);
    
    // 2. Type check (existing)
    this.typeCheck(program, symbolTable);
    
    // 3. Build call graph (existing)
    const callGraph = this.buildCallGraph(program, symbolTable);
    
    // 4. NEW: Frame allocation
    const frameAllocator = new FrameAllocator(this.platformConfig);
    const frameResult = frameAllocator.allocate(program, callGraph, symbolTable);
    
    // 5. Report frame errors
    for (const diagnostic of frameResult.diagnostics) {
      this.reportDiagnostic(diagnostic);
    }
    
    return {
      symbolTable,
      callGraph,
      frameMap: frameResult.frameMap,  // NEW
      diagnostics: this.diagnostics,
    };
  }
}
```

---

## 3. IL Generator Integration

```typescript
// il/generator.ts
class ILGenerator {
  generate(program: Program, frameMap: FrameMap): ILProgram {
    this.frameMap = frameMap;
    // ... generate IL with frame addresses
  }
  
  private visitVariableAccess(node: VariableAccess): ILValue {
    const frame = this.frameMap.get(this.currentFunction);
    const slot = frame?.slots.find(s => s.name === node.getName());
    
    if (slot) {
      return {
        kind: 'address',
        address: slot.address,
        location: slot.location,  // ZP, Frame, or RAM
      };
    }
    // ... handle other cases
  }
}
```

---

## 4. Code Generator Integration

```typescript
// codegen/generator.ts
class CodeGenerator {
  private emitLoad(value: ILValue): void {
    if (value.location === SlotLocation.ZeroPage) {
      // Use ZP addressing mode (1 byte address, faster)
      this.emit(`lda $${value.address.toString(16).padStart(2, '0')}`);
    } else {
      // Use absolute addressing mode (2 byte address)
      this.emit(`lda $${value.address.toString(16).padStart(4, '0')}`);
    }
  }
  
  private emitStore(value: ILValue): void {
    if (value.location === SlotLocation.ZeroPage) {
      this.emit(`sta $${value.address.toString(16).padStart(2, '0')}`);
    } else {
      this.emit(`sta $${value.address.toString(16).padStart(4, '0')}`);
    }
  }
  
  private emitIndirectLoad(ptr: ILValue, offset: ILValue): void {
    if (ptr.location === SlotLocation.ZeroPage) {
      // Indirect Y addressing (only works with ZP)
      this.emit(`ldy #${offset.value}`);
      this.emit(`lda ($${ptr.address.toString(16).padStart(2, '0')}),y`);
    } else {
      // Must load address to ZP scratch first
      this.emit(`; Indirect via scratch`);
      // ... more complex code path
    }
  }
}
```

---

## 5. Sessions

| Session | Tasks | Est. Time |
|---------|-------|-----------|
| **4.1** | Semantic analyzer integration + tests | 20 min |
| **4.2** | IL generator integration + tests | 25 min |
| **4.3** | Code generator (basic) + tests | 25 min |
| **4.4** | Code generator (addressing modes) + tests | 20 min |
| **4.5** | E2E integration tests | 20 min |

**Total: ~2 hours**

---

## 6. Success Criteria

- [ ] Semantic analyzer calls frame allocator
- [ ] FrameMap passed through pipeline
- [ ] IL uses frame addresses
- [ ] Codegen emits correct addressing modes
- [ ] ZP uses 1-byte addresses
- [ ] RAM uses 2-byte addresses
- [ ] All E2E tests pass

---

**Next**: [../99-execution-plan.md](../99-execution-plan.md)