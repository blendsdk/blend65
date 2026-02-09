# Size Optimization (-Os, -Oz)

> **Phase**: 7 - Advanced Optimizations  
> **Document**: 05-size-opt.md  
> **Focus**: Code size reduction strategies  
> **Est. Lines**: ~300

---

## Overview

Size optimization is critical for the C64's 64KB address space. The `-Os` and `-Oz` flags enable size-preferring optimizations that trade speed for smaller code.

**Optimization Levels**:
- **-Os**: Prefer size over speed (balanced)
- **-Oz**: Minimum size at any cost (aggressive)

---

## 1. Size Optimization Strategies

### 1.1 Strategy Comparison

| Strategy | -Os | -Oz | Bytes Saved | Speed Impact |
|----------|-----|-----|-------------|--------------|
| Prefer JSR over inline | ✅ | ✅ | 3+ per site | ~12 cycles/call |
| Short branch when possible | ✅ | ✅ | 1 per branch | None |
| Constant deduplication | ✅ | ✅ | 1-3 per const | None |
| Tail call optimization | ✅ | ✅ | 3 per call | None |
| Code factoring | ❌ | ✅ | Variable | JSR overhead |
| Instruction compression | ❌ | ✅ | 1-2 per pattern | Slight |
| Overlapping sequences | ❌ | ✅ | 1-5 per overlap | None |

### 1.2 Enabling Size Optimization

```typescript
/**
 * Size optimization configuration.
 */
export interface SizeOptConfig {
  /** Minimum bytes saved to justify JSR */
  jsrThreshold: number;
  
  /** Enable aggressive factoring (-Oz) */
  aggressiveFactoring: boolean;
  
  /** Enable overlapping sequences (-Oz) */
  overlappingSequences: boolean;
  
  /** Maximum speed penalty acceptable (cycles) */
  maxSpeedPenalty: number;
}

/**
 * Get config for optimization level.
 */
function getSizeOptConfig(level: OptLevel): SizeOptConfig {
  switch (level) {
    case '-Os':
      return {
        jsrThreshold: 4,        // Only if saves 4+ bytes
        aggressiveFactoring: false,
        overlappingSequences: false,
        maxSpeedPenalty: 20,    // Up to 20 cycles slower
      };
    
    case '-Oz':
      return {
        jsrThreshold: 2,        // Even 2 bytes is worth it
        aggressiveFactoring: true,
        overlappingSequences: true,
        maxSpeedPenalty: 100,   // Accept significant slowdown
      };
    
    default:
      return null; // Size optimization disabled
  }
}
```

---

## 2. Prefer JSR Over Inlining

### 2.1 Inlining Reversal

When the same code sequence appears multiple times, replace with subroutine:

```asm
; Before (inlined - 18 bytes)
    LDA #$00          ; Site 1: 6 bytes
    STA $D020
    STA $D021
    
    LDA #$00          ; Site 2: 6 bytes
    STA $D020
    STA $D021
    
    LDA #$00          ; Site 3: 6 bytes
    STA $D020
    STA $D021

; After (-Os, factored - 15 bytes)
    JSR clear_border  ; 3 bytes
    JSR clear_border  ; 3 bytes
    JSR clear_border  ; 3 bytes
    
clear_border:         ; 6 bytes (subroutine)
    LDA #$00
    STA $D020
    STA $D021
    RTS

; Savings: 18 - 15 = 3 bytes (more sites = more savings)
```

### 2.2 Factoring Algorithm

```typescript
/**
 * Factor repeated code into subroutines.
 */
export class CodeFactoringPass extends OptimizationPass {
  /**
   * Find repeated instruction sequences.
   */
  protected findRepeatedSequences(
    func: AsmFunction,
    minLength: number = 3
  ): RepeatedSequence[] {
    const sequences: RepeatedSequence[] = [];
    const instructions = func.getAllInstructions();
    
    // Build suffix array for sequence detection
    for (let length = minLength; length <= 10; length++) {
      const occurrences = this.findOccurrences(instructions, length);
      
      for (const [pattern, sites] of occurrences) {
        if (sites.length >= 2) {
          const savings = this.calculateSavings(pattern, sites.length);
          if (savings > 0) {
            sequences.push({ pattern, sites, savings });
          }
        }
      }
    }
    
    return sequences.sort((a, b) => b.savings - a.savings);
  }
  
  /**
   * Calculate bytes saved by factoring.
   */
  protected calculateSavings(pattern: AsmInstruction[], siteCount: number): number {
    const patternSize = this.calculateSize(pattern);
    const jsrSize = 3;  // JSR takes 3 bytes
    const rtsSize = 1;  // RTS takes 1 byte
    
    // Before: patternSize * siteCount
    // After: jsrSize * siteCount + patternSize + rtsSize
    const before = patternSize * siteCount;
    const after = (jsrSize * siteCount) + patternSize + rtsSize;
    
    return before - after;
  }
  
  /**
   * Apply factoring transformation.
   */
  protected applyFactoring(sequence: RepeatedSequence): void {
    // Create subroutine
    const subName = this.generateSubroutineName();
    const subroutine = this.createSubroutine(subName, sequence.pattern);
    
    // Replace each occurrence with JSR
    for (const site of sequence.sites) {
      this.replaceWithJSR(site, subName);
    }
    
    // Add subroutine to function
    this.addSubroutine(subroutine);
  }
}
```

---

## 3. Branch Optimization

### 3.1 Short vs Long Branches

6502 branches are limited to ±127 bytes. Long branches require workarounds:

```asm
; Short branch (2 bytes) - within range
    BEQ target        ; 2 bytes

; Long branch workaround (5 bytes) - out of range
    BNE skip          ; 2 bytes
    JMP target        ; 3 bytes
skip:

; Size optimization: Reorganize code to use short branches
```

### 3.2 Branch Distance Optimization

```typescript
/**
 * Optimize branch distances by code reordering.
 */
export class BranchDistanceOpt extends OptimizationPass {
  /**
   * Reorder basic blocks to minimize long branches.
   */
  public optimizeBranchDistances(func: AsmFunction): boolean {
    let changed = false;
    
    // Find all long branches
    const longBranches = this.findLongBranches(func);
    
    for (const branch of longBranches) {
      // Try to move target closer
      if (this.canMoveTarget(branch)) {
        this.moveBlockCloser(branch.target, branch.source);
        changed = true;
      }
      
      // Try to invert and fall through
      if (this.canInvertBranch(branch)) {
        this.invertBranch(branch);
        changed = true;
      }
    }
    
    return changed;
  }
  
  /**
   * Invert branch to avoid long jump.
   */
  protected invertBranch(branch: BranchInst): void {
    // BEQ far_target → BNE skip; JMP far_target; skip:
    // becomes
    // BNE near_fallthrough (if we can arrange the code)
    
    const inverted = this.getInvertedBranch(branch.opcode);
    // ... rewrite logic
  }
}
```

---

## 4. Constant Deduplication

### 4.1 Merge Duplicate Constants

```asm
; Before (6 bytes of constants)
    LDA #$41          ; 'A'
    ...
    LDA #$41          ; 'A' again (2 bytes wasted)
    ...
    LDA #$41          ; 'A' again (2 bytes wasted)

; With constant pooling (reference same location)
const_A:
    .byte $41         ; 1 byte, referenced multiple times
```

### 4.2 String Deduplication

```typescript
/**
 * Deduplicate string constants.
 */
export class StringDeduplication {
  /**
   * Find and merge duplicate strings.
   */
  public deduplicate(program: AsmProgram): void {
    const strings = new Map<string, string>(); // content → label
    
    for (const str of program.strings) {
      if (strings.has(str.content)) {
        // Replace with reference to existing
        const existingLabel = strings.get(str.content)!;
        this.replaceReferences(str.label, existingLabel);
        this.removeString(str);
      } else {
        strings.set(str.content, str.label);
      }
    }
  }
  
  /**
   * Merge overlapping strings (suffix sharing).
   */
  public mergeOverlapping(program: AsmProgram): void {
    // "Hello" and "ello" can share storage:
    // hello_str: .byte "Hello"
    // ello_str = hello_str + 1
    
    const sorted = [...program.strings].sort(
      (a, b) => b.content.length - a.content.length
    );
    
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[i].content.endsWith(sorted[j].content)) {
          // j is suffix of i
          const offset = sorted[i].content.length - sorted[j].content.length;
          this.replaceSuffix(sorted[j], sorted[i], offset);
        }
      }
    }
  }
}
```

---

## 5. Tail Call Optimization

### 5.1 Convert JSR+RTS to JMP

```asm
; Before (4 bytes)
    JSR other_func    ; 3 bytes
    RTS               ; 1 byte

; After (3 bytes)
    JMP other_func    ; 3 bytes (tail call)

; Savings: 1 byte + 12 cycles
```

### 5.2 Tail Call Detection

```typescript
/**
 * Detect and apply tail call optimization.
 */
export class TailCallOpt extends OptimizationPass {
  /**
   * Find tail calls (JSR followed by RTS).
   */
  public findTailCalls(func: AsmFunction): TailCall[] {
    const tailCalls: TailCall[] = [];
    
    for (let i = 0; i < func.instructions.length - 1; i++) {
      const inst = func.instructions[i];
      const next = func.instructions[i + 1];
      
      if (inst.opcode === 'JSR' && next.opcode === 'RTS') {
        // Check no code between (labels OK, but not other instructions)
        if (!this.hasIntervening(inst, next)) {
          tailCalls.push({ jsrIndex: i, rtsIndex: i + 1, target: inst.operand });
        }
      }
    }
    
    return tailCalls;
  }
  
  /**
   * Apply tail call optimization.
   */
  public applyTailCall(tailCall: TailCall): void {
    // Replace JSR with JMP
    this.replaceInstruction(tailCall.jsrIndex, {
      opcode: 'JMP',
      operand: tailCall.target,
    });
    
    // Remove RTS
    this.removeInstruction(tailCall.rtsIndex);
  }
}
```

---

## 6. Instruction Compression (-Oz)

### 6.1 Equivalent Shorter Sequences

```asm
; LDA #$00 (2 bytes) → alternative
    LDA #$00          ; 2 bytes
; Can sometimes be replaced with:
    TXA               ; 1 byte (if X is known to be 0)

; Store same value to multiple locations
    LDA #$00          ; 2 bytes
    STA addr1         ; 3 bytes
    LDA #$00          ; 2 bytes (redundant!)
    STA addr2         ; 3 bytes
; Becomes:
    LDA #$00          ; 2 bytes
    STA addr1         ; 3 bytes
    STA addr2         ; 3 bytes (A still holds 0)

; Savings: 2 bytes
```

### 6.2 Zero Page Utilization

```asm
; Absolute addressing (3 bytes)
    LDA $0300         ; 3 bytes

; Zero page addressing (2 bytes)
    LDA $30           ; 2 bytes

; Copy hot values to zero page and use shorter addressing
```

```typescript
/**
 * Move hot values to zero page for shorter addressing.
 */
export class ZeroPagePromotion {
  /**
   * Identify values to promote to ZP.
   */
  public identifyPromotionCandidates(func: AsmFunction): PromotionCandidate[] {
    const accessCounts = new Map<string, number>();
    
    // Count accesses to each address
    for (const inst of func.instructions) {
      if (this.isMemoryAccess(inst) && !this.isZeroPage(inst.operand)) {
        const addr = inst.operand;
        accessCounts.set(addr, (accessCounts.get(addr) ?? 0) + 1);
      }
    }
    
    // Candidates: high access count, absolute addressing
    const candidates: PromotionCandidate[] = [];
    for (const [addr, count] of accessCounts) {
      if (count >= 3) {  // At least 3 accesses to be worth it
        const savings = count; // 1 byte saved per access
        candidates.push({ address: addr, accessCount: count, savings });
      }
    }
    
    return candidates.sort((a, b) => b.savings - a.savings);
  }
}
```

---

## 7. Overlapping Code Sequences (-Oz)

### 7.1 Entry Point Sharing

```asm
; Two routines with shared suffix:
routine1:             ; Entry point 1
    LDX #$05
    
shared:               ; Shared code (entry point 2 for different X)
    STX $D020
    RTS

routine2:             ; Entry point 2 (overlaps with shared)
    LDX #$07
    BNE shared        ; Falls through to same code

; Instead of duplicating STX $D020; RTS
```

### 7.2 Overlapping Detection

```typescript
/**
 * Find opportunities for overlapping code.
 */
export class OverlappingCodeOpt {
  /**
   * Find routines with identical suffixes.
   */
  public findOverlappingCandidates(funcs: AsmFunction[]): OverlapCandidate[] {
    const candidates: OverlapCandidate[] = [];
    
    for (let i = 0; i < funcs.length; i++) {
      for (let j = i + 1; j < funcs.length; j++) {
        const suffix = this.findCommonSuffix(funcs[i], funcs[j]);
        if (suffix.length >= 2) {  // At least 2 instructions
          const savings = this.calculateSize(suffix);
          candidates.push({
            func1: funcs[i],
            func2: funcs[j],
            suffix,
            savings,
          });
        }
      }
    }
    
    return candidates;
  }
  
  /**
   * Merge overlapping routines.
   */
  public mergeOverlapping(candidate: OverlapCandidate): void {
    // Keep suffix in func1
    // Modify func2 to jump to func1's suffix
    
    const suffixLabel = this.createSuffixLabel(candidate.func1);
    this.truncateToSuffix(candidate.func2, candidate.suffix.length);
    this.addBranchToSuffix(candidate.func2, suffixLabel);
  }
}
```

---

## 8. Dead Code Elimination for Size

### 8.1 Aggressive DCE

```typescript
/**
 * Size-focused dead code elimination.
 */
export class SizeDCE extends OptimizationPass {
  /**
   * Remove all unreachable code.
   */
  public removeUnreachable(func: AsmFunction): boolean {
    const reachable = this.computeReachable(func);
    let changed = false;
    
    for (const inst of func.instructions) {
      if (!reachable.has(inst)) {
        this.removeInstruction(inst);
        changed = true;
      }
    }
    
    return changed;
  }
  
  /**
   * Remove unused local variables.
   */
  public removeUnusedLocals(func: AsmFunction): boolean {
    const usedVars = this.computeUsedVariables(func);
    let changed = false;
    
    for (const local of func.locals) {
      if (!usedVars.has(local)) {
        this.removeLocal(local);
        changed = true;
      }
    }
    
    return changed;
  }
}
```

---

## 9. Size Measurement and Reporting

```typescript
/**
 * Measure and report code size.
 */
export class SizeReporter {
  /**
   * Generate size report.
   */
  public generateReport(program: AsmProgram): SizeReport {
    return {
      totalBytes: this.calculateTotalSize(program),
      codeBytes: this.calculateCodeSize(program),
      dataBytes: this.calculateDataSize(program),
      
      byFunction: this.sizeByFunction(program),
      
      largestFunctions: this.findLargestFunctions(program, 10),
      
      optimizationsSummary: {
        factoringSaved: this.factoringBytesSaved,
        tailCallsSaved: this.tailCallBytesSaved,
        branchOptSaved: this.branchOptBytesSaved,
        constantDedup: this.constantDedupBytesSaved,
      },
    };
  }
  
  /**
   * Compare before/after sizes.
   */
  public compareSize(before: number, after: number): string {
    const saved = before - after;
    const percent = ((saved / before) * 100).toFixed(1);
    return `${before} → ${after} bytes (saved ${saved} bytes, ${percent}%)`;
  }
}
```

---

## 10. Pass Ordering for Size

```typescript
/**
 * Optimal pass order for -Os/-Oz.
 */
const sizeOptPassOrder = [
  // First: Remove dead code
  'dead-code-elimination',
  
  // Then: Factor common sequences (need full code first)
  'code-factoring',
  
  // Then: Optimize branches (after factoring changes layout)
  'branch-distance-opt',
  
  // Then: Tail calls
  'tail-call-opt',
  
  // Then: Constants
  'constant-deduplication',
  
  // For -Oz only:
  'zero-page-promotion',
  'instruction-compression',
  'overlapping-code-opt',
  
  // Final pass: Verify size
  'size-verification',
];
```

---

## Success Criteria

- [ ] JSR factoring for repeated code
- [ ] Branch distance optimization
- [ ] Tail call optimization (JSR+RTS → JMP)
- [ ] Constant and string deduplication
- [ ] Zero page promotion for hot values
- [ ] -Os produces smaller code than -O2
- [ ] -Oz produces smallest possible code
- [ ] Size reporting with optimization breakdown
- [ ] ~25 tests passing for size optimization

---

**Previous Document**: [04-register-alloc.md](04-register-alloc.md)  
**Next Document**: [06-smc.md](06-smc.md)  
**Parent**: [00-phase-index.md](00-phase-index.md)