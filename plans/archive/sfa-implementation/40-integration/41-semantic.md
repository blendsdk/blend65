# Semantic Analyzer Integration

> **Document**: 40-integration/41-semantic.md
> **Parent**: [40-overview.md](40-overview.md)

## Changes Required

```typescript
// semantic/analyzer.ts
class SemanticAnalyzer {
  analyze(program: Program): SemanticResult {
    // Existing steps...
    const symbolTable = this.buildSymbolTable(program);
    this.typeCheck(program, symbolTable);
    const callGraph = this.buildCallGraph(program, symbolTable);
    
    // NEW: Frame allocation
    const frameAllocator = new FrameAllocator(this.config.platform);
    const frameResult = frameAllocator.allocate(program, callGraph, symbolTable);
    
    // Report diagnostics
    for (const diag of frameResult.diagnostics) {
      this.reportDiagnostic(diag);
    }
    
    return {
      symbolTable,
      callGraph,
      frameMap: frameResult.frameMap,  // NEW
      frameStats: frameResult.stats,   // NEW
      diagnostics: this.diagnostics,
    };
  }
}

// semantic/types.ts
export interface SemanticResult {
  symbolTable: SymbolTable;
  callGraph: CallGraph;
  frameMap: FrameMap;           // NEW
  frameStats: FrameAllocationStats;  // NEW
  diagnostics: Diagnostic[];
}
```

---

## Session
Implement in Session 4.1 per [../99-execution-plan.md](../99-execution-plan.md)