# Frame Calculator Specification

> **Document**: 20-allocator/21-frame-calculator.md
> **Parent**: [20-overview.md](20-overview.md)

## Purpose

Calculates frame size for each function by analyzing AST and creating FrameSlots.

---

## Class Definition

```typescript
/**
 * Calculates frame structure from function AST.
 */
export class FrameCalculator {
  constructor(private symbolTable: SymbolTable) {}

  /**
   * Calculate frame for a function declaration.
   */
  calculateFrame(func: FunctionDeclaration): Frame {
    const frame = createFrame(
      func.getName(),
      this.determineThreadContext(func),
      func.getLocation()
    );

    // 1. Add parameters
    for (const param of func.getParameters()) {
      const slot = this.createSlotFromParam(param);
      addSlotToFrame(frame, slot);
    }

    // 2. Add locals (walk function body)
    const locals = this.collectLocals(func.getBody());
    for (const local of locals) {
      const slot = this.createSlotFromLocal(local);
      addSlotToFrame(frame, slot);
    }

    // 3. Add return slot if non-void
    if (!func.getReturnType().isVoid()) {
      const slot = createReturnSlot(
        this.getTypeSize(func.getReturnType()),
        func.getReturnType().toString(),
        func.getLocation()
      );
      addSlotToFrame(frame, slot);
    }

    return frame;
  }

  private getTypeSize(type: Type): number {
    if (type.isByte()) return 1;
    if (type.isWord()) return 2;
    if (type.isBool()) return 1;
    if (type.isPointer()) return 2;
    if (type.isArray()) return type.getElementCount() * this.getTypeSize(type.getElementType());
    throw new Error(`Unknown type size: ${type}`);
  }

  private collectLocals(body: Block): VariableDeclaration[] {
    const collector = new LocalVariableCollector();
    collector.visit(body);
    return collector.getLocals();
  }

  private getDirective(decl: VariableDeclaration): ZpDirective {
    if (decl.hasDirective('zp')) return ZpDirective.Required;
    if (decl.hasDirective('ram')) return ZpDirective.Forbidden;
    return ZpDirective.None;
  }
}
```

---

## Type Size Table

| Type | Size | Notes |
|------|------|-------|
| `byte` | 1 | |
| `word` | 2 | |
| `bool` | 1 | |
| `*T` (pointer) | 2 | |
| `byte[N]` | N | |
| `word[N]` | N×2 | |

---

## Unit Tests

```typescript
describe('FrameCalculator', () => {
  it('should calculate frame with two byte locals', () => {
    const source = `module Test; function main(): void { let x: byte = 0; let y: byte = 0; }`;
    const { program, symbolTable } = buildSymbolTable(source);
    const calc = new FrameCalculator(symbolTable);
    
    const func = program.getFunction('main')!;
    const frame = calc.calculateFrame(func);
    
    expect(frame.totalSize).toBe(2);
    expect(frame.slots).toHaveLength(2);
  });

  it('should include parameters in frame', () => {
    const source = `module Test; function add(a: byte, b: byte): byte { return a + b; }`;
    const { program, symbolTable } = buildSymbolTable(source);
    const calc = new FrameCalculator(symbolTable);
    
    const func = program.getFunction('add')!;
    const frame = calc.calculateFrame(func);
    
    expect(frame.slots.filter(s => s.kind === SlotKind.Parameter)).toHaveLength(2);
    expect(frame.slots.find(s => s.kind === SlotKind.Return)).toBeDefined();
  });

  it('should handle arrays correctly', () => {
    const source = `module Test; function main(): void { let buf: byte[16]; }`;
    const { program, symbolTable } = buildSymbolTable(source);
    const calc = new FrameCalculator(symbolTable);
    
    const frame = calc.calculateFrame(program.getFunction('main')!);
    
    expect(frame.totalSize).toBe(16);
  });
});
```

---

## Session
Implement in Session 2.1 per [../99-execution-plan.md](../99-execution-plan.md)