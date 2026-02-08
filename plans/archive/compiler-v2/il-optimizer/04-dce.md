# Dead Code Elimination (DCE)

> **Document**: 04-dce.md
> **Parent**: [Index](00-index.md)

## Overview

Dead Code Elimination removes instructions that have no effect on program output. This is the first and most impactful optimization pass, leveraging the existing liveness analysis.

## What DCE Removes

1. **Dead Stores** - Stores to variables never read
2. **Unreachable Code** - Code after unconditional jumps
3. **Dead Computations** - Computations whose results are never used

## Implementation

```typescript
// optimizer/passes/dce.ts

export class DCEPass implements OptimizationPass {
  name = 'dce';
  dependencies: string[] = []; // First pass, no deps

  run(func: ILFunction, options: OptimizationOptions): PassResult {
    // Step 1: Run liveness analysis
    computeLiveRanges(func);
    
    const toRemove = new Set<number>();
    const instructions = func.instructions;
    
    // Step 2: Find dead stores
    for (let i = 0; i < instructions.length; i++) {
      if (isDeadStore(instructions[i])) {
        toRemove.add(i);
      }
    }
    
    // Step 3: Find unreachable code
    const unreachable = this.findUnreachableCode(instructions);
    for (const idx of unreachable) {
      toRemove.add(idx);
    }
    
    // Step 4: Remove marked instructions
    func.instructions = instructions.filter((_, i) => !toRemove.has(i));
    
    return {
      modified: toRemove.size > 0,
      instructionsRemoved: toRemove.size,
      instructionsAdded: 0,
    };
  }

  protected findUnreachableCode(instructions: ILInstruction[]): number[] {
    const unreachable: number[] = [];
    let isUnreachable = false;
    
    for (let i = 0; i < instructions.length; i++) {
      const instr = instructions[i];
      
      // Labels make code reachable again
      if (instr.opcode === ILOpcode.LABEL) {
        isUnreachable = false;
        continue;
      }
      
      if (isUnreachable) {
        unreachable.push(i);
        continue;
      }
      
      // Unconditional jumps and returns make following code unreachable
      if (instr.opcode === ILOpcode.JUMP || instr.opcode === ILOpcode.RETURN) {
        isUnreachable = true;
      }
    }
    
    return unreachable;
  }
}
```

## Examples

### Dead Store Removal

```
// Before:
let x: byte = 5;  // x never read
let y: byte = 10;
return y;

// IL Before:
LOAD_IMM 5
STORE_BYTE x    ← Dead (x not in liveOut)
LOAD_IMM 10
STORE_BYTE y
LOAD_BYTE y
RETURN

// IL After:
LOAD_IMM 10
STORE_BYTE y
LOAD_BYTE y
RETURN
```

### Unreachable Code Removal

```
// IL Before:
JUMP .exit
LOAD_IMM 5      ← Unreachable
STORE_BYTE x    ← Unreachable
.exit:
RETURN

// IL After:
JUMP .exit
.exit:
RETURN
```

## Testing Requirements

| Test Case | Description |
|-----------|-------------|
| Dead store removal | Variable assigned but never read |
| Multiple dead stores | Several dead variables |
| Store before overwrite | x=1; x=2; use x → first dead |
| Unreachable after jump | Code after unconditional JMP |
| Unreachable after return | Code after RTS |
| Label makes reachable | JMP .skip; dead; .skip: live |
| No false positives | Used variables NOT removed |
| Side-effect stores | peek/poke NOT removed |

## Files to Create

| File | Description |
|------|-------------|
| `optimizer/passes/dce.ts` | DCE implementation |
| `__tests__/optimizer/passes/dce.test.ts` | DCE tests |