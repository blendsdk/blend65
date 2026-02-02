# Current State: Beyond God-Level IL Generator

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

---

## Existing Implementation

### What Exists

#### SFA System (Fully Implemented ✅)

The Static Frame Allocation system is 80% complete and provides the foundation for our IL generator:

**Frame Types** (`packages/compiler-v2/src/frame/types.ts`):
```typescript
interface FrameSlot {
  name: string;              // Variable name
  kind: SlotKind;            // Parameter, Local, Return, Temporary
  type: TypeInfo;            // Full type information
  size: number;              // Bytes
  
  // ZP handling
  zpDirective: ZpDirective;  // Zp, Ram, None
  
  // Allocation results (set by allocator)
  location: SlotLocation;    // ZeroPage, FrameRegion, Register
  address: number;           // Final memory address
  offset: number;            // Offset from frame base
  register?: string;         // 'A', 'X', 'Y' for register params
  
  // Analysis data
  accessCount: number;       // Usage frequency
  maxLoopDepth: number;      // Hot path indicator
  zpScore: number;           // ZP priority score
}
```

**Frame Interface** (`packages/compiler-v2/src/frame/allocator/frame-calculator.ts`):
```typescript
interface Frame {
  functionName: string;
  slots: FrameSlot[];
  totalSize: number;
  isExported: boolean;
  isCallback: boolean;
  baseAddress: number;       // Assigned by allocator
  coalesceGroup: number;     // For coalescing optimization
}
```

**Slot Locations** (`packages/compiler-v2/src/frame/enums.ts`):
```typescript
enum SlotLocation {
  ZeroPage = 'ZeroPage',
  FrameRegion = 'FrameRegion',
  Register = 'Register',
  Unallocated = 'Unallocated',
}
```

#### FrameAllocator (Fully Implemented ✅)

Located at `packages/compiler-v2/src/frame/allocator/frame-allocator.ts`:

- Recursion detection
- Frame size calculation
- Frame region address assignment
- ZP allocation with scoring
- Diagnostics and statistics

**Key Output**: `FrameAllocationResult`
```typescript
interface FrameAllocationResult {
  frameMap: Map<string, Frame>;  // Function name → Frame
  stats: FrameAllocationStats;
  diagnostics: FrameDiagnostic[];
  success: boolean;
  zpAllocationSummary?: ZpAllocationSummary;
}
```

#### IL Module (Placeholder Only)

The IL module (`packages/compiler-v2/src/il/index.ts`) is currently just a placeholder:

```typescript
// Will be populated in Phase 7: IL Generator
// export * from './types.js';
// export * from './builder.js';
// export * from './generator.js';
```

---

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `frame/types.ts` | FrameSlot definition | None - use as-is |
| `frame/enums.ts` | SlotLocation, SlotKind | None - use as-is |
| `frame/allocator/frame-allocator.ts` | Main allocator | None - provides input |
| `frame/allocator/frame-calculator.ts` | Frame interface | None - use Frame type |
| `il/index.ts` | Module exports | Replace placeholder |
| `il/types.ts` | IL type definitions | **CREATE** |
| `il/builder.ts` | IL instruction builder | **CREATE** |
| `il/generator.ts` | AST → IL generator | **CREATE** |

---

## Code Analysis

### How SFA Data Flows to IL

```
┌─────────────────┐
│   Parser        │
│  (produces AST) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Semantic      │
│   Analyzer      │
└────────┬────────┘
         │ Builds CallGraph, SymbolTable
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Frame         │────▶│  FrameMap       │
│   Allocator     │     │  (func → Frame) │
└─────────────────┘     └────────┬────────┘
                                 │
         ┌───────────────────────┤
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   IL Generator  │◀────│   AST           │
│   (NEW)         │     │   (from parser) │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   IL Program    │
│   (output)      │
└─────────────────┘
```

### Key Integration Points

**1. FrameMap Access**
```typescript
// IL Generator receives frameMap from FrameAllocator
class ILGenerator {
  constructor(
    private frameMap: Map<string, Frame>,
    private symbolTable: SymbolTable,
  ) {}
}
```

**2. Variable Resolution**
```typescript
// Look up any variable's frame slot
getSlot(functionName: string, varName: string): FrameSlot | undefined {
  const frame = this.frameMap.get(functionName);
  return frame?.slots.find(s => s.name === varName);
}
```

**3. Address vs Slot**

Current basic approach (what the original plan had):
```typescript
// Raw address - loses context
const addr = frame.baseAddress + slot.offset;
this.builder.loadByte(addr);  // Just a number!
```

God-level approach (what we will do):
```typescript
// Slot-centric - full context preserved
this.builder.loadSlot(slot);  // Knows ZP vs Frame vs Register!
```

---

## Gaps Identified

### Gap 1: No IL Type System

**Current Behavior:** No IL types exist
**Required Behavior:** Complete IL type definitions
**Fix Required:** Create `il/types.ts` with opcodes, operands, instructions

### Gap 2: No Slot-Centric Operands

**Current Behavior:** Original plan uses raw addresses
**Required Behavior:** Operands carry FrameSlot references
**Fix Required:** Design ILOperand to reference slots

### Gap 3: No Optimization Hints

**Current Behavior:** No hints in original plan
**Required Behavior:** Live ranges, costs, addressing modes
**Fix Required:** Add hint fields to ILInstruction

### Gap 4: No Loop Structure

**Current Behavior:** Loops become flat jumps
**Required Behavior:** Loop boundaries preserved
**Fix Required:** Add ILLoop structure to ILFunction

### Gap 5: No Register Parameter Handling

**Current Behavior:** All params go to memory
**Required Behavior:** First params can use A/X/Y registers
**Fix Required:** Detect and generate register-based IL

---

## Dependencies

### Internal Dependencies

| Dependency | Import Path | What We Use |
|------------|-------------|-------------|
| AST types | `../ast/index.js` | Expression, Statement, etc. |
| AST guards | `../ast/type-guards.js` | isLiteralExpr, isBinaryExpr, etc. |
| Frame types | `../frame/types.js` | FrameSlot, createFrameSlot |
| Frame enums | `../frame/enums.js` | SlotLocation, SlotKind |
| Frame calculator | `../frame/allocator/frame-calculator.js` | Frame |
| Semantic types | `../semantic/types.js` | TypeInfo, TypeKind |
| Lexer types | `../lexer/types.js` | SourceLocation |

### External Dependencies

None - pure TypeScript implementation.

---

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Slot references create circular deps | Medium | High | Use minimal interface/import carefully |
| Live range analysis complexity | Low | Medium | Start with simple backward dataflow |
| Performance overhead of rich IL | Low | Low | IL is intermediate, not final output |
| Breaking existing SFA tests | Low | Medium | IL is additive, doesn't modify SFA |

---

## Validation Strategy

Before implementation, verify:

1. **SFA Integration**
   - [ ] Can access FrameSlot from frameMap
   - [ ] SlotLocation enum available
   - [ ] Frame.baseAddress correctly set

2. **AST Compatibility**
   - [ ] All expression types have type guards
   - [ ] All statement types have type guards
   - [ ] SourceLocation available on nodes

3. **Build System**
   - [ ] TypeScript compiles cleanly
   - [ ] Imports resolve correctly
   - [ ] No circular dependencies

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [01-requirements.md](01-requirements.md) | What we need to build |
| [03-il-types.md](03-il-types.md) | Type definitions to create |
| [SFA-IMPLEMENTATION-SUMMARY.md](/SFA-IMPLEMENTATION-SUMMARY.md) | SFA design reference |