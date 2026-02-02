# Testing Strategy: Beyond God-Level IL Generator

> **Document**: 09-testing-strategy.md
> **Parent**: [Index](00-index.md)

---

## Testing Overview

### Coverage Goals

| Category | Target Coverage |
|----------|----------------|
| Unit tests | ≥ 95% |
| Integration tests | All expression/statement types |
| E2E tests | 10+ real Blend programs |

---

## Test Categories

### Unit Tests: IL Types (`types.test.ts`)

| Test | Description |
|------|-------------|
| `ILOpcode values` | All opcodes have unique values |
| `createSlotOperand` | Creates slot operand with correct addressing hint |
| `createImmediateOperand` | Creates byte/word immediates |
| `createLabelOperand` | Creates label operands |
| `createInstruction` | Attaches operands correctly |
| `isSlotOperand` | Type guard works |
| `isZeroPageInstruction` | Detects ZP access |

### Unit Tests: IL Builder (`builder.test.ts`)

| Test | Description |
|------|-------------|
| `newLabel` | Generates unique labels |
| `loadSlot` | Emits LOAD_BYTE with slot operand |
| `loadImm` | Emits LOAD_IMM with immediate |
| `addSlot` | Emits ADD_BYTE correctly |
| `jump` | Emits JUMP with label |
| `call` | Emits CALL with function operand |
| `clear` | Resets builder state |

### Unit Tests: IL Generator (`generator.test.ts`)

| Test | Description |
|------|-------------|
| `literal expression` | Generates LOAD_IMM |
| `identifier expression` | Generates LOAD_BYTE |
| `binary add` | Generates ADD sequence |
| `variable declaration` | Generates store |
| `if statement` | Generates conditional jumps |
| `while loop` | Generates loop structure |
| `for loop` | Generates counted loop |
| `function call` | Generates CALL with params |
| `return statement` | Generates RETURN |

---

## Integration Tests

| Test | Components | Description |
|------|------------|-------------|
| `AST → IL` | Parser + Generator | Full expression types |
| `SFA → IL` | Frame + Generator | Slot context preserved |
| `ZP optimization` | All | ZP slots use ZP addressing |
| `Register params` | All | Register slots skip memory |
| `Loop detection` | Generator | For loops marked counted |

---

## End-to-End Tests

### Test Programs

| Program | Tests |
|---------|-------|
| `simple-add.blend` | Basic arithmetic IL |
| `variables.blend` | Variable loads/stores |
| `conditionals.blend` | If/else IL |
| `loops.blend` | While/for IL |
| `functions.blend` | Call/return IL |
| `nested-loops.blend` | Loop depth tracking |
| `zp-vars.blend` | ZP addressing hints |
| `array-access.blend` | Indexed addressing |
| `game-loop.blend` | Real-world pattern |
| `interrupt-handler.blend` | Callback marking |

### Test Flow

```
Source → Lexer → Parser → Semantic → SFA → IL Generator → Verify IL
```

---

## Test Utilities

```typescript
// Create mock FrameSlot for testing
function createTestSlot(
  name: string,
  options?: Partial<FrameSlot>
): FrameSlot {
  return {
    name,
    kind: SlotKind.Local,
    type: BUILTIN_TYPES.BYTE,
    size: 1,
    zpDirective: ZpDirective.None,
    location: SlotLocation.FrameRegion,
    address: 0x0200,
    offset: 0,
    accessCount: 1,
    maxLoopDepth: 0,
    zpScore: 0,
    ...options,
  };
}

// Create mock Frame for testing
function createTestFrame(
  functionName: string,
  slots: FrameSlot[]
): Frame {
  return {
    functionName,
    slots,
    totalSize: slots.reduce((sum, s) => sum + s.size, 0),
    isExported: false,
    isCallback: false,
    baseAddress: 0x0200,
    coalesceGroup: 0,
  };
}
```

---

## Verification Patterns

### Verify Instruction Sequence

```typescript
function verifyInstructions(
  instructions: ILInstruction[],
  expected: { opcode: ILOpcode; operandKind?: string }[]
): void {
  expect(instructions).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(instructions[i].opcode).toBe(expected[i].opcode);
    if (expected[i].operandKind) {
      expect(instructions[i].operands[0]?.kind).toBe(expected[i].operandKind);
    }
  }
}
```

### Verify ZP Addressing

```typescript
function verifyZeroPageAddressing(instructions: ILInstruction[]): void {
  for (const instr of instructions) {
    if (isSlotOperand(instr.operands[0])) {
      const slot = instr.operands[0].slot;
      if (slot.location === SlotLocation.ZeroPage) {
        expect(instr.operands[0].addressingHint).toBe(AddressingModeHint.ZeroPage);
      }
    }
  }
}
```

---

## Test Commands

```bash
# Run all IL tests
./compiler-test il

# Run specific test file
./compiler-test il/types
./compiler-test il/builder
./compiler-test il/generator

# Run with coverage
./compiler-test il --coverage
```

---

## Related Documents

| Document | Relationship |
|----------|-------------|
| [99-execution-plan.md](99-execution-plan.md) | Implementation schedule |
| `.clinerules/testing.md` | Test commands |