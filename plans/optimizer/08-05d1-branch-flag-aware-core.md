# Task 8.5d.1: Core Flag-Aware Branch Patterns

> **Task**: 8.5d.1 of 25 (Peephole Phase)  
> **Time**: ~45 min  
> **Tests**: ~10 tests  
> **Prerequisites**: Tasks 8.5a-c (Branch Patterns)

---

## Overview

Implement core flag-aware branch patterns for the 6502 processor:
- Flag state tracking infrastructure
- Known flag elimination (branch always/never taken)
- Load-based flag inference (LDA sets Z/N)
- Dead branch removal with known flags

---

## Directory Structure

```
packages/compiler/src/optimizer/peephole/patterns/
├── index.ts                         # Pattern exports
├── branch-core.ts                   # Task 8.5a (done)
├── branch-chain.ts                  # Task 8.5b (done)
├── branch-complementary.ts          # Task 8.5c (done)
├── branch-flag-aware-core.ts        # THIS TASK
└── branch-flag-aware-cmp.ts         # Task 8.5d.2
```

---

## 6502 Flag Concepts

### Processor Status Register (P)

| Bit | Flag | Name | Description |
|-----|------|------|-------------|
| 0 | C | Carry | Set by ADC, SBC, CMP, shifts |
| 1 | Z | Zero | Set when result = 0 |
| 2 | I | Interrupt | Interrupt disable |
| 3 | D | Decimal | BCD mode |
| 4 | B | Break | Set by BRK |
| 5 | - | Unused | Always 1 |
| 6 | V | Overflow | Signed overflow |
| 7 | N | Negative | Set when bit 7 = 1 |

### Instructions That Set Flags

| Instruction | N | Z | C | V |
|-------------|---|---|---|---|
| LDA, LDX, LDY | ✓ | ✓ | - | - |
| ADC | ✓ | ✓ | ✓ | ✓ |
| SBC | ✓ | ✓ | ✓ | ✓ |
| CMP, CPX, CPY | ✓ | ✓ | ✓ | - |
| AND, ORA, EOR | ✓ | ✓ | - | - |
| INC, DEC | ✓ | ✓ | - | - |
| INX, DEX | ✓ | ✓ | - | - |
| INY, DEY | ✓ | ✓ | - | - |
| ASL, LSR | ✓ | ✓ | ✓ | - |
| ROL, ROR | ✓ | ✓ | ✓ | - |
| TAX, TAY | ✓ | ✓ | - | - |
| TXA, TYA | ✓ | ✓ | - | - |
| PLA | ✓ | ✓ | - | - |
| BIT | ✓ | ✓ | - | ✓ |

---

## Implementation

### File: `branch-flag-aware-core.ts`

```typescript
import { BasePattern, PatternCategory, PatternMatch, PatternReplacement } from '../pattern.js';
import { ILInstruction, ILOpcode } from '../../../il/index.js';
import { OptimizationLevel } from '../../types.js';

/**
 * Branch mnemonics set
 */
const BRANCH_MNEMONICS = new Set([
  'BEQ', 'BNE', 'BCC', 'BCS', 'BMI', 'BPL', 'BVC', 'BVS'
]);

/**
 * Flag state enum
 */
export enum FlagState {
  Unknown = 'unknown',
  Set = 'set',      // Flag = 1
  Clear = 'clear',  // Flag = 0
}

/**
 * Known flag states after instruction execution
 */
export interface FlagStates {
  N: FlagState;  // Negative
  Z: FlagState;  // Zero
  C: FlagState;  // Carry
  V: FlagState;  // Overflow
}

/**
 * Create unknown flag states
 */
export function unknownFlags(): FlagStates {
  return {
    N: FlagState.Unknown,
    Z: FlagState.Unknown,
    C: FlagState.Unknown,
    V: FlagState.Unknown,
  };
}

/**
 * Instructions that set N and Z flags based on result
 */
const SETS_NZ_FROM_RESULT = new Set([
  'LDA', 'LDX', 'LDY',
  'AND', 'ORA', 'EOR',
  'INC', 'DEC',
  'INX', 'DEX', 'INY', 'DEY',
  'TAX', 'TAY', 'TXA', 'TYA',
  'PLA',
]);

/**
 * Get flag states after loading a known constant
 */
export function getFlagsAfterLoad(value: number): FlagStates {
  const byte = value & 0xFF;
  return {
    N: (byte & 0x80) ? FlagState.Set : FlagState.Clear,
    Z: (byte === 0) ? FlagState.Set : FlagState.Clear,
    C: FlagState.Unknown,
    V: FlagState.Unknown,
  };
}

/**
 * Determine if a branch is always taken given flag states
 */
export function isBranchAlwaysTaken(mnemonic: string, flags: FlagStates): boolean {
  switch (mnemonic) {
    case 'BEQ': return flags.Z === FlagState.Set;
    case 'BNE': return flags.Z === FlagState.Clear;
    case 'BCC': return flags.C === FlagState.Clear;
    case 'BCS': return flags.C === FlagState.Set;
    case 'BMI': return flags.N === FlagState.Set;
    case 'BPL': return flags.N === FlagState.Clear;
    case 'BVC': return flags.V === FlagState.Clear;
    case 'BVS': return flags.V === FlagState.Set;
    default: return false;
  }
}

/**
 * Determine if a branch is never taken given flag states
 */
export function isBranchNeverTaken(mnemonic: string, flags: FlagStates): boolean {
  switch (mnemonic) {
    case 'BEQ': return flags.Z === FlagState.Clear;
    case 'BNE': return flags.Z === FlagState.Set;
    case 'BCC': return flags.C === FlagState.Set;
    case 'BCS': return flags.C === FlagState.Clear;
    case 'BMI': return flags.N === FlagState.Clear;
    case 'BPL': return flags.N === FlagState.Set;
    case 'BVC': return flags.V === FlagState.Set;
    case 'BVS': return flags.V === FlagState.Clear;
    default: return false;
  }
}

/**
 * Pattern: Branch after LDA #0 - eliminate dead branches
 * 
 * Before:
 *   LDA #0
 *   BNE target    ; Never taken - Z always set after LDA #0
 * 
 * After:
 *   LDA #0        ; Branch removed
 * 
 * Saves: 2-3 cycles, 2 bytes
 */
export class BranchAfterLoadZeroPattern extends BasePattern {
  readonly id = 'branch-after-load-zero';
  readonly description = 'Remove dead branch after LDA #0';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, branch] = instructions;
    
    // Check: LDA #0
    if (!this.isLoadImmediate(load, 0)) {
      return null;
    }
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    // Flags after LDA #0: Z=1, N=0
    const flags = getFlagsAfterLoad(0);
    const mnemonic = branch.metadata?.get('mnemonic') as string;
    
    // Check: Branch never taken
    if (!isBranchNeverTaken(mnemonic, flags)) {
      return null;
    }
    
    return {
      matched: [load, branch],
      captures: this.capture([
        ['loadMnemonic', load.metadata?.get('mnemonic')],
        ['loadValue', 0],
        ['branchMnemonic', mnemonic],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loadMnemonic = match.captures.get('loadMnemonic') as string;
    
    // Keep only the load
    const load = this.createInstruction(ILOpcode.Load, {
      mnemonic: loadMnemonic,
      value: 0,
      addressingMode: 'immediate',
    });
    
    return {
      instructions: [load],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is LDA/LDX/LDY immediate with specific value */
  protected isLoadImmediate(inst: ILInstruction, value: number): boolean {
    if (inst.opcode !== ILOpcode.Load) return false;
    const mode = inst.metadata?.get('addressingMode');
    if (mode !== 'immediate') return false;
    const loadValue = inst.metadata?.get('value') as number;
    return loadValue === value;
  }
  
  /** Check if instruction is conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
}

/**
 * Pattern: Branch after LDA with high bit set - eliminate BPL
 * 
 * Before:
 *   LDA #$80      ; Loads negative value
 *   BPL target    ; Never taken - N always set
 * 
 * After:
 *   LDA #$80
 * 
 * Saves: 2-3 cycles, 2 bytes
 */
export class BranchAfterNegativeLoadPattern extends BasePattern {
  readonly id = 'branch-after-negative-load';
  readonly description = 'Remove dead BPL after loading negative value';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O2, OptimizationLevel.O3];
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, branch] = instructions;
    
    // Check: Load immediate with known value
    if (!this.isLoadImmediateAny(load)) {
      return null;
    }
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    const loadValue = load.metadata?.get('value') as number;
    const flags = getFlagsAfterLoad(loadValue);
    const mnemonic = branch.metadata?.get('mnemonic') as string;
    
    // Check: Branch never taken
    if (!isBranchNeverTaken(mnemonic, flags)) {
      return null;
    }
    
    return {
      matched: [load, branch],
      captures: this.capture([
        ['loadMnemonic', load.metadata?.get('mnemonic')],
        ['loadValue', loadValue],
        ['branchMnemonic', mnemonic],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loadMnemonic = match.captures.get('loadMnemonic') as string;
    const loadValue = match.captures.get('loadValue') as number;
    
    const load = this.createInstruction(ILOpcode.Load, {
      mnemonic: loadMnemonic,
      value: loadValue,
      addressingMode: 'immediate',
    });
    
    return {
      instructions: [load],
      cyclesSaved: 2,
      bytesSaved: 2,
    };
  }
  
  /** Check if instruction is LDA/LDX/LDY immediate */
  protected isLoadImmediateAny(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Load) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if instruction is conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
}

/**
 * Pattern: Convert dead branch to JMP when always taken
 * 
 * Before:
 *   LDA #0
 *   BEQ target    ; Always taken - Z always set
 * 
 * After:
 *   LDA #0
 *   JMP target    ; Unconditional jump
 * 
 * Saves: 0-1 cycles (branch prediction benefit)
 * Note: JMP is 3 bytes vs branch 2 bytes, but semantically clearer
 */
export class BranchAlwaysTakenToJmpPattern extends BasePattern {
  readonly id = 'branch-always-taken-to-jmp';
  readonly description = 'Convert always-taken branch to JMP';
  readonly category = PatternCategory.Branch;
  readonly levels = [OptimizationLevel.O3]; // Only at highest level
  readonly windowSize = 2;
  
  match(instructions: ILInstruction[]): PatternMatch | null {
    if (instructions.length < 2) return null;
    
    const [load, branch] = instructions;
    
    // Check: Load immediate
    if (!this.isLoadImmediateAny(load)) {
      return null;
    }
    
    // Check: Conditional branch
    if (!this.isConditionalBranch(branch)) {
      return null;
    }
    
    const loadValue = load.metadata?.get('value') as number;
    const flags = getFlagsAfterLoad(loadValue);
    const mnemonic = branch.metadata?.get('mnemonic') as string;
    
    // Check: Branch always taken
    if (!isBranchAlwaysTaken(mnemonic, flags)) {
      return null;
    }
    
    return {
      matched: [load, branch],
      captures: this.capture([
        ['loadMnemonic', load.metadata?.get('mnemonic')],
        ['loadValue', loadValue],
        ['branchTarget', branch.metadata?.get('target')],
      ]),
      confidence: 1.0,
    };
  }
  
  replace(match: PatternMatch): PatternReplacement {
    const loadMnemonic = match.captures.get('loadMnemonic') as string;
    const loadValue = match.captures.get('loadValue') as number;
    const target = match.captures.get('branchTarget') as string;
    
    const load = this.createInstruction(ILOpcode.Load, {
      mnemonic: loadMnemonic,
      value: loadValue,
      addressingMode: 'immediate',
    });
    
    const jmp = this.createInstruction(ILOpcode.Jump, {
      mnemonic: 'JMP',
      target,
      addressingMode: 'absolute',
    });
    
    return {
      instructions: [load, jmp],
      cyclesSaved: 0, // JMP is same cycles but unconditional
      bytesSaved: -1, // JMP is 1 byte larger
    };
  }
  
  /** Check if instruction is LDA/LDX/LDY immediate */
  protected isLoadImmediateAny(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Load) return false;
    const mode = inst.metadata?.get('addressingMode');
    return mode === 'immediate' && inst.metadata?.has('value');
  }
  
  /** Check if instruction is conditional branch */
  protected isConditionalBranch(inst: ILInstruction): boolean {
    if (inst.opcode !== ILOpcode.Branch) return false;
    const mnemonic = inst.metadata?.get('mnemonic') as string;
    return BRANCH_MNEMONICS.has(mnemonic);
  }
}

/**
 * Register all core flag-aware branch patterns
 */
export function registerCoreFlagAwareBranchPatterns(registry: PatternRegistry): void {
  registry.register(new BranchAfterLoadZeroPattern());
  registry.register(new BranchAfterNegativeLoadPattern());
  registry.register(new BranchAlwaysTakenToJmpPattern());
}
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `BranchAfterLoadZero match BNE` | Matches LDA #0 + BNE (never taken) |
| `BranchAfterLoadZero no match BEQ` | No match LDA #0 + BEQ (always taken) |
| `BranchAfterLoadZero replace` | Removes dead branch |
| `BranchAfterNegativeLoad match BPL` | Matches LDA #$80 + BPL |
| `BranchAfterNegativeLoad match BMI` | No match LDA #$80 + BMI (always taken) |
| `BranchAfterNegativeLoad replace` | Removes dead branch |
| `BranchAlwaysTaken match BEQ` | Matches LDA #0 + BEQ |
| `BranchAlwaysTaken replace` | Converts to JMP |
| `getFlagsAfterLoad zero` | Returns Z=set, N=clear |
| `getFlagsAfterLoad negative` | Returns N=set, Z=clear |

---

## Integration Notes

### Pattern Registration

```typescript
import { patternRegistry } from './registry.js';
import { registerCoreFlagAwareBranchPatterns } from './patterns/branch-flag-aware-core.js';

registerCoreFlagAwareBranchPatterns(patternRegistry);
```

### Optimization Levels

| Pattern | O1 | O2 | O3 | Os | Oz |
|---------|----|----|----|----|-----|
| BranchAfterLoadZeroPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| BranchAfterNegativeLoadPattern | ❌ | ✅ | ✅ | ❌ | ❌ |
| BranchAlwaysTakenToJmpPattern | ❌ | ❌ | ✅ | ❌ | ❌ |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `branch-flag-aware-core.ts` | [ ] |
| Implement FlagState infrastructure | [ ] |
| Implement BranchAfterLoadZeroPattern | [ ] |
| Implement BranchAfterNegativeLoadPattern | [ ] |
| Implement BranchAlwaysTakenToJmpPattern | [ ] |
| Add registration function | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Previous Task**: 8.5c → `08-05c-branch-complementary.md`  
**Next Task**: 8.5d.2 → `08-05d2-branch-flag-aware-cmp.md` (Comparison-aware patterns)