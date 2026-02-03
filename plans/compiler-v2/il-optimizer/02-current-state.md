# Current State: IL Optimizer

> **Document**: 02-current-state.md
> **Parent**: [Index](00-index.md)

## Existing Implementation

### What Exists

The compiler-v2 already has substantial analysis infrastructure in `packages/compiler-v2/src/il/analysis.ts` that can be leveraged for the IL optimizer.

### Relevant Files

| File | Purpose | Changes Needed |
|------|---------|----------------|
| `src/il/analysis.ts` | Liveness, dead store detection, hints | Use as-is |
| `src/il/enums.ts` | IL opcodes (~50) | No changes |
| `src/il/guards.ts` | Type guards for operands | No changes |
| `src/il/instruction.ts` | Instruction types, defUse | May extend hints |
| `src/il/operands.ts` | Operand types | No changes |
| `src/il/structures.ts` | ILFunction, ILProgram | No changes |
| `src/il/builder/` | IL construction | May reuse for transforms |
| `src/optimizer/index.ts` | **PLACEHOLDER** | Will implement |

### Code Analysis

#### Existing Analysis Functions

**`computeLiveRanges(func: ILFunction)`**
```typescript
// Backward dataflow analysis
// After calling: func.instructions[i].liveIn and .liveOut are populated
// Uses: liveIn = (liveOut - defs) ∪ uses

computeLiveRanges(func);
// Now each instruction has:
// - liveIn: Set<string>  (variables live at entry)
// - liveOut: Set<string> (variables live at exit)
```

**This is EXACTLY what DCE needs!**

---

**`isDeadStore(instr: ILInstruction): boolean`**
```typescript
// Returns true if:
// 1. Instruction is STORE_BYTE or STORE_WORD
// 2. Variable being stored is NOT in liveOut

// Example:
const instr = instructions[i];
if (isDeadStore(instr)) {
  // Safe to remove this instruction
}
```

**This is EXACTLY what DCE pass will use!**

---

**`computeHints(instr, loopDepth, nextInstr): OptimizationHints`**
```typescript
// Returns:
{
  isHotPath: boolean;      // In loop or hot slot
  isFrequentAccess: boolean; // High access count
  canCoalesce: boolean;    // Can merge with next
  isDead: boolean;         // Dead store
}
```

**Useful for prioritizing optimizations!**

---

**`canCoalesce(instr, nextInstr): boolean`**
```typescript
// Detects patterns like:
// - LOAD X followed by STORE X (no-op)
// - ADD_IMM 1 followed by STORE (can become INC)

if (canCoalesce(instructions[i], instructions[i + 1])) {
  // Merge or eliminate
}
```

**Useful for peephole patterns!**

---

**`runAnalysisPasses(func: ILFunction)`**
```typescript
// Runs:
// 1. computeLiveRanges() 
// 2. computeHints() for each instruction

runAnalysisPasses(func);
// Now func.instructions have liveIn, liveOut, hints populated
```

**Entry point for analysis!**

---

**`getAnalysisStats(func: ILFunction): AnalysisStats`**
```typescript
interface AnalysisStats {
  totalInstructions: number;
  deadStores: number;        // ← Tells us how much DCE can help
  hotInstructions: number;
  coalesceableInstructions: number;
  frequentAccesses: number;
  maxLoopDepth: number;
  loopCount: number;
}
```

**Useful for optimization statistics!**

---

## Gaps Identified

### Gap 1: No Pass Manager

**Current Behavior:** No infrastructure for running multiple optimization passes

**Required Behavior:** Pass manager that:
- Registers passes
- Orders passes by dependency
- Enables/disables per optimization level
- Tracks modifications

**Fix Required:** Create `src/optimizer/pass-manager.ts`

---

### Gap 2: No Constant Tracking

**Current Behavior:** Analysis tracks liveness but not values

**Required Behavior:** Track known constant values:
```typescript
// After LOAD_IMM 5; STORE_BYTE x
// We should know x = 5

interface ValueState {
  kind: 'constant' | 'unknown' | 'copy';
  value?: number;      // For constant
  copyOf?: string;     // For copy
}
```

**Fix Required:** Create constant analysis in DCE/propagation passes

---

### Gap 3: No Transform API

**Current Behavior:** Analysis only, no transformation

**Required Behavior:** API to modify IL:
```typescript
interface ILTransform {
  replaceInstruction(index: number, newInstr: ILInstruction): void;
  removeInstruction(index: number): void;
  insertInstruction(index: number, instr: ILInstruction): void;
}
```

**Fix Required:** Either modify in place or create new instruction array

---

### Gap 4: No Optimization Options

**Current Behavior:** No optimization levels

**Required Behavior:**
```typescript
interface OptimizationOptions {
  level: 'O0' | 'O1' | 'O2' | 'O3' | 'Os' | 'Oz';
  enabledPasses?: string[];
  debug?: boolean;
}
```

**Fix Required:** Create `src/optimizer/options.ts`

---

## Dependencies

### Internal Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `il/analysis.ts` | ✅ Ready | Full liveness analysis |
| `il/guards.ts` | ✅ Ready | Type guards |
| `il/enums.ts` | ✅ Ready | All opcodes defined |
| `il/builder/` | ✅ Ready | Can create instructions |

### External Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| IL Generator | ✅ Ready | Produces valid IL |
| Frame Allocator | ✅ Ready | Addresses assigned |
| Code Generator | 📋 Not Started | Consumer of optimized IL |

---

## Risks and Concerns

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Analysis invalidation after transform | High | Medium | Re-run analysis after each pass |
| Incorrect optimization | Medium | High | Comprehensive testing |
| Performance regression | Low | Medium | Benchmark before/after |
| Breaking existing tests | Low | High | Run all tests at each step |

---

## Reuse Strategy

### What to Reuse As-Is

1. **`computeLiveRanges()`** - Core liveness analysis
2. **`isDeadStore()`** - Dead store detection
3. **`computeHints()`** - Optimization hints
4. **`getAnalysisStats()`** - Statistics
5. **`ILBuilder`** - Creating new instructions

### What to Build New

1. **Pass Manager** - `optimizer/pass-manager.ts`
2. **Optimization Options** - `optimizer/options.ts`
3. **DCE Pass** - `optimizer/passes/dce.ts`
4. **Constant Folding Pass** - `optimizer/passes/constant-fold.ts`
5. **Constant Propagation Pass** - `optimizer/passes/constant-prop.ts`
6. **Copy Propagation Pass** - `optimizer/passes/copy-prop.ts`
7. **IL Peephole Pass** - `optimizer/passes/il-peephole.ts`

### What to Extend

1. **`instruction.ts`** - May add optimization metadata
2. **`analysis.ts`** - May add constant value tracking

---

## Related Documents

| Document | Description |
|----------|-------------|
| [01-requirements.md](01-requirements.md) | What we need to build |
| [03-infrastructure.md](03-infrastructure.md) | Pass manager design |
| [04-dce.md](04-dce.md) | DCE implementation |