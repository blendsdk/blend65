# Branch Selection: Technical Specification

> **Document**: 05-branch-selection.md
> **Parent**: [Index](00-index.md)

## Overview

The `generateBranch()` method currently always emits `JMP` (unconditional jump) instead of proper conditional branch instructions (`BNE`, `BEQ`, `BCS`, `BCC`, etc.). This means control flow tests expecting specific branch instructions fail.

## Architecture

### Current Architecture

```
IL: BRANCH condition ? then_block : else_block

generateBranch()
    ↓
; STUB: Branch on v1 ? _then_1 : _else_1
JMP _then_1  ; Always take then-branch (WRONG!)
```

### Proposed Architecture

```
IL: BRANCH condition ? then_block : else_block
    (where condition is result of CMP_EQ/CMP_NE/CMP_LT/etc.)

generateBranch()
    ↓
; Branch if x == 10
BNE _else_1  ; Skip then-block if NOT equal
    ; then-block code
JMP _endif_1
_else_1:
    ; else-block code
_endif_1:
```

## 6502 Branch Instruction Reference

| Condition | IL Opcode | Branch to ELSE | Notes |
|-----------|-----------|----------------|-------|
| `x == y` | CMP_EQ | `BNE` | Branch if NOT equal |
| `x != y` | CMP_NE | `BEQ` | Branch if equal |
| `x < y` | CMP_LT | `BCS` | Branch if carry set (>= unsigned) |
| `x <= y` | CMP_LE | `BCS`, then `BNE` | Complex - two branches |
| `x > y` | CMP_GT | `BCC`, or `BEQ` | Complex - two conditions |
| `x >= y` | CMP_GE | `BCC` | Branch if carry clear (< unsigned) |
| Boolean | - | `BEQ` | Branch if zero (false) |

**Key insight**: For if-then-else, we branch to ELSE when condition is FALSE.

## Implementation Details

### Track Last Comparison

The branch instruction needs to know what comparison was performed. We can:
1. Track the last comparison result in the condition SSA value
2. Look up the producing instruction for the condition

```typescript
/**
 * Tracks the comparison type that produced a condition value
 * Key: SSA result ID, Value: comparison opcode
 */
protected comparisonTypes: Map<string, ILOpcode> = new Map();
```

### Modified generateBinaryOp

```typescript
protected generateBinaryOp(instr: ILBinaryInstruction): void {
  // ... existing code ...
  
  // Track comparison type for later branch selection
  if (this.isComparisonOp(instr.opcode)) {
    this.comparisonTypes.set(instr.result.toString(), instr.opcode);
  }
}

protected isComparisonOp(opcode: ILOpcode): boolean {
  return opcode === ILOpcode.CMP_EQ ||
         opcode === ILOpcode.CMP_NE ||
         opcode === ILOpcode.CMP_LT ||
         opcode === ILOpcode.CMP_LE ||
         opcode === ILOpcode.CMP_GT ||
         opcode === ILOpcode.CMP_GE;
}
```

### Modified generateBranch

```typescript
protected generateBranch(instr: ILBranchInstruction): void {
  const thenLabel = this.getBlockLabel(instr.thenTarget.name);
  const elseLabel = this.getBlockLabel(instr.elseTarget.name);
  
  // Look up what comparison produced this condition
  const conditionId = instr.condition.toString();
  const compType = this.comparisonTypes.get(conditionId);
  
  // Select appropriate branch instruction
  // We branch to ELSE when condition is FALSE
  switch (compType) {
    case ILOpcode.CMP_EQ:
      // Equal: branch to else if NOT equal (Z flag clear)
      this.emitComment(`Branch if not equal -> ${elseLabel}`);
      this.emitInstruction('BNE', elseLabel, 'Skip if not equal', 2);
      break;
      
    case ILOpcode.CMP_NE:
      // Not equal: branch to else if equal (Z flag set)
      this.emitComment(`Branch if equal -> ${elseLabel}`);
      this.emitInstruction('BEQ', elseLabel, 'Skip if equal', 2);
      break;
      
    case ILOpcode.CMP_LT:
      // Less than: branch to else if >= (carry set)
      this.emitComment(`Branch if >= -> ${elseLabel}`);
      this.emitInstruction('BCS', elseLabel, 'Skip if carry set', 2);
      break;
      
    case ILOpcode.CMP_GE:
      // Greater or equal: branch to else if < (carry clear)
      this.emitComment(`Branch if < -> ${elseLabel}`);
      this.emitInstruction('BCC', elseLabel, 'Skip if carry clear', 2);
      break;
      
    case ILOpcode.CMP_GT:
      // Greater than: branch to else if <= (carry clear OR zero)
      // This is complex: BCC or BEQ to else
      this.emitComment(`Branch if <= -> ${elseLabel}`);
      this.emitInstruction('BCC', elseLabel, 'Skip if <', 2);
      this.emitInstruction('BEQ', elseLabel, 'Skip if ==', 2);
      break;
      
    case ILOpcode.CMP_LE:
      // Less or equal: we need BCC (for <) or BEQ (for =)
      // Tricky - need to NOT branch if > 
      // BCS to check >=, then BNE for strictly >
      this.emitComment(`Branch if > -> ${elseLabel}`);
      // Only branch if carry set AND zero clear
      // Simplification: branch if carry set, then check zero
      this.emitInstruction('BEQ', `+$02`, 'If equal, continue to then', 2);
      this.emitInstruction('BCS', elseLabel, 'Skip if >', 2);
      break;
      
    default:
      // Boolean condition or unknown - test if zero
      this.emitComment(`Branch if false -> ${elseLabel}`);
      this.emitInstruction('BEQ', elseLabel, 'Skip if zero/false', 2);
      break;
  }
  
  // Note: We don't jump to then - fall through to then-block
  // The then-block should end with JMP to endif
}
```

## Code Examples

### Example 1: Equality Check

```js
// Input
if (x == 10) {
  poke($D020, 1);
}

// Expected Assembly
  LDA _x
  CMP #$0A
  BNE _endif_1    ; Skip if NOT equal
  LDA #$01
  STA $D020
_endif_1:
```

### Example 2: Inequality Check

```js
// Input
if (x != 5) {
  poke($D020, 1);
}

// Expected Assembly
  LDA _x
  CMP #$05
  BEQ _endif_1    ; Skip if equal
  LDA #$01
  STA $D020
_endif_1:
```

### Example 3: Less Than Check

```js
// Input
if (x < 10) {
  poke($D020, 1);
}

// Expected Assembly
  LDA _x
  CMP #$0A
  BCS _endif_1    ; Skip if carry set (>= 10)
  LDA #$01
  STA $D020
_endif_1:
```

## Error Handling

| Error Case | Handling Strategy |
|------------|-------------------|
| Unknown comparison type | Fall back to `BEQ` (test zero) |
| Complex expression | May need multiple branches |
| Boolean variable (not comparison) | Use `BEQ` to test if false |

## Testing Requirements

1. **E2E test**: Enable `generates BNE for equality comparison`
2. **E2E test**: Enable `generates BEQ for inequality comparison`
3. **Unit test**: Branch selection for CMP_LT
4. **Unit test**: Branch selection for CMP_GE
5. **Unit test**: Branch selection for boolean condition

## Files to Modify

1. `packages/compiler/src/codegen/instruction-generator.ts` - Branch selection logic
2. `packages/compiler/src/__tests__/e2e/control-flow.test.ts` - Enable 2 tests

## Complexity Assessment

This fix is **medium complexity** because:
- Need to track comparison types across instructions
- Branch selection depends on previous instruction
- Some comparisons need multiple branches

## Estimated Effort

- Implementation: 30-45 minutes
- Testing: 15-20 minutes
- Total: ~1 hour