# Current State: Long-Branch Expansion

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The compiler generates conditional branches (BCS, BNE, etc.) with label targets for all control flow constructs (for-loop exits, if-else branches, while-loop conditions). These branches have NO awareness of the 6502's ±127 byte range limit.

The branch-opt pass (`branch-opt.ts`) handles the INVERSE transformation: it collapses `BCC skip; JMP target; skip:` into `BCS target` when the pattern is found. But no pass expands short branches into the long-branch pattern when the target is too far.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `codegen/generator/control.ts` | Emits BCS/BCC/BEQ/BNE for JUMP_GE/LT/EQ/NE | No changes (codegen is correct, pass handles expansion) |
| `codegen/asm-il/optimizer/passes/branch-opt.ts` | Pattern 3: collapses branch-over-JMP | No changes (inverse of what we need, runs before us) |
| `codegen/asm-il/optimizer/passes/index.ts` | Exports all passes | Add export for new pass |
| `codegen/asm-il/optimizer/pass-factory.ts` | Creates passes per opt level | Add new pass as LAST pass |
| `codegen/asm-il/types.ts` | AsmILElement, AsmInstruction types | No changes |
| `codegen/asm-il/optimizer/types.ts` | AsmOptimizationPass interface | No changes |

### Code Analysis

**How branches are generated (control.ts):**
```typescript
// genJumpGe emits BCS directly — no range awareness
protected genJumpGe(instr: ILInstruction): void {
  this.emitComment(instr);
  const label = this.getLabelOperand(instr.operands);
  this.asm.bcs(this.localLabel(label.name));
}
```

**How branch-opt collapses (branch-opt.ts Pattern 3):**
```
BCC skip; JMP target; skip: → BCS target (saves 3 bytes + 3 cycles)
```

**Branch inversions already defined (branch-opt.ts):**
```typescript
const BRANCH_INVERSIONS: Record<string, string> = {
  BCC: 'BCS', BCS: 'BCC',
  BEQ: 'BNE', BNE: 'BEQ',
  BMI: 'BPL', BPL: 'BMI',
  BVC: 'BVS', BVS: 'BVC',
};
```

## Gaps Identified

### Gap 1: No Long-Branch Expansion

**Current Behavior:** The compiler emits `BCS .endfor12` regardless of the distance to `.endfor12`. When function inlining at O2/O3 makes the loop body exceed 127 bytes, ACME reports "Target out of range".

**Required Behavior:** Branches whose targets may exceed ±127 bytes should be automatically expanded to `BCC .skip; JMP .endfor12; .skip:`.

**Fix Required:** New ASM-IL optimization pass.

### Gap 2: No Instruction Byte-Size Estimation Utility

**Current Behavior:** The size-opt pass uses a hardcoded 2-byte estimate per instruction. No shared utility exists for more accurate estimation.

**Required Behavior:** A simple byte-size estimation function based on addressing mode.

**Fix Required:** Either inline estimation in the new pass or create a shared utility. The conservative 2-byte estimate is acceptable for the threshold check.

## Dependencies

### Internal Dependencies

- `AsmOptimizationPass` interface (exists)
- `AsmILElement`, `isInstructionElement`, `isLabelElement` type guards (exist)
- Branch inversion mapping (exists in branch-opt.ts — should be extracted to shared constant or duplicated)

### External Dependencies

- None

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Infinite loop with branch-opt | Low | High | Use threshold (100) well below max range (127) — branch-opt only collapses when distance ≤ 127 |
| Over-expansion (unnecessary JMPs) | Low | Low | 100-byte threshold is conservative; most branches are well under 50 bytes |
| Under-expansion (misses cases) | Very Low | High | Use conservative 2-byte estimate per instruction, which underestimates actual sizes |
| Label collision | Very Low | High | Use unique counter-based label names (`.skip_long_N`) |
