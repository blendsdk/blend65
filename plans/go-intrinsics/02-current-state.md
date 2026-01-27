# Current State: Go-Intrinsics

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The Blend65 compiler has a complete intrinsics infrastructure:

1. **IL Intrinsics Registry** (`packages/compiler/src/il/intrinsics/registry.ts`)
   - All 18 intrinsics defined with full metadata
   - Categories: Memory, Optimization, CPU, Stack, Utility
   - Includes parameter types, return types, cycle counts, etc.

2. **IL Builder** (`packages/compiler/src/il/builder.ts`)
   - All emit methods exist: `emitSei()`, `emitCli()`, `emitBrk()`, etc.
   - Properly creates IL instructions for all intrinsics

3. **IL Generator** (`packages/compiler/src/il/generator/expressions.ts`)
   - `generateIntrinsicCall()` handles all 18 intrinsics
   - Maps function names to appropriate IL emission

4. **Code Generator** (`packages/compiler/src/codegen/instruction-generator.ts`)
   - Partial implementation - 12 of 18 intrinsics handled
   - Missing: `CPU_BRK`, `OPT_BARRIER`, `INTRINSIC_LO`, `INTRINSIC_HI`, `VOLATILE_READ`, `VOLATILE_WRITE`

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `instruction-generator.ts` | IL → 6502 translation | Add 6 switch cases |
| `il/instructions.ts` | IL instruction types | None (already complete) |
| `il/intrinsics/registry.ts` | Intrinsic metadata | None (already complete) |
| `il/generator/expressions.ts` | AST → IL intrinsics | None (already complete) |

### Code Analysis

**Current switch statement in `generateInstruction()` (~line 133-220):**

```typescript
// Currently handled CPU intrinsics
case ILOpcode.CPU_SEI:
case ILOpcode.CPU_CLI:
case ILOpcode.CPU_NOP:
case ILOpcode.CPU_PHA:
case ILOpcode.CPU_PLA:
case ILOpcode.CPU_PHP:
case ILOpcode.CPU_PLP:
  this.generateCpuInstruction(instr as ILCpuInstruction);
  break;

// Currently handled memory intrinsics
case ILOpcode.INTRINSIC_PEEK:
  this.generatePeek(instr as ILPeekInstruction);
  break;
case ILOpcode.INTRINSIC_POKE:
  this.generatePoke(instr as ILPokeInstruction);
  break;
case ILOpcode.INTRINSIC_PEEKW:
  this.generatePeekw(instr as ILPeekwInstruction);
  break;
case ILOpcode.INTRINSIC_POKEW:
  this.generatePokew(instr as ILPokewInstruction);
  break;

// MISSING - fall through to placeholder:
// case ILOpcode.CPU_BRK:
// case ILOpcode.OPT_BARRIER:
// case ILOpcode.INTRINSIC_LO:
// case ILOpcode.INTRINSIC_HI:
// case ILOpcode.VOLATILE_READ:
// case ILOpcode.VOLATILE_WRITE:
```

## Gaps Identified

### Gap 1: CPU_BRK Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Emit `BRK` instruction
**Fix Required:** Add case to `generateCpuInstruction()` switch

### Gap 2: OPT_BARRIER Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Emit comment only (no code generated)
**Fix Required:** Add dedicated case that emits comment

### Gap 3: INTRINSIC_LO Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Extract low byte from word value
**Fix Required:** Add new method `generateLo()`

**Implementation Note:** For runtime values, the low byte is naturally available in the accumulator for little-endian 16-bit values. May need minimal or no code depending on value location.

### Gap 4: INTRINSIC_HI Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Extract high byte from word value
**Fix Required:** Add new method `generateHi()`

**Implementation Note:** For runtime values stored in zero page, use `LDA zp+1`. For values in A/X pair, swap or use X directly.

### Gap 5: VOLATILE_READ Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Same as peek() but marked for optimizer
**Fix Required:** Add new method `generateVolatileRead()`

### Gap 6: VOLATILE_WRITE Not Handled

**Current Behavior:** Falls through to placeholder (NOP + comment)
**Required Behavior:** Same as poke() but marked for optimizer
**Fix Required:** Add new method `generateVolatileWrite()`

## Dependencies

### Internal Dependencies

- IL instruction types (`ILLoInstruction`, `ILHiInstruction`, etc.) - already defined
- Assembly writer utilities - already exist
- Helper methods (`emitInstruction`, `emitComment`, etc.) - already exist

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing code | Low | High | Run all 6,500+ tests |
| Incorrect assembly generation | Low | Medium | Test each intrinsic individually |
| Missing instruction types | None | N/A | Types already defined in instructions.ts |

## Test Coverage Status

- **IL Generator tests**: Comprehensive coverage for intrinsics
- **Codegen tests**: Missing tests for the 6 unimplemented intrinsics
- **Integration tests**: Partial - uses working intrinsics only