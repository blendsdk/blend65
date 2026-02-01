# Blend Integration: ZP Scoring Method

> **Document**: blend-integration/02c-zp-scoring.md
> **Parent**: [02-allocator-impl.md](02-allocator-impl.md)
> **Status**: Design Complete
> **Target File**: `packages/compiler-v2/src/frame/allocator/zp-allocator.ts`

## Overview

Zero page ($00-$FF) is the most precious memory on 6502. This document details:

1. **ZP Scoring Algorithm** - How to prioritize variables for ZP
2. **User Directives** - Handling @zp and @ram annotations
3. **ZP Pool Management** - Tracking available ZP addresses
4. **Allocation Algorithm** - Multi-phase ZP allocation

---

## 1. Why ZP Matters

| Aspect | Normal RAM | Zero Page |
|--------|-----------|-----------|
| **Access** | `LDA $0200` (4 cycles, 3 bytes) | `LDA $02` (3 cycles, 2 bytes) |
| **Indexed** | `LDA $0200,X` (4-5 cycles) | `LDA $02,X` (4 cycles) |
| **Indirect** | Not possible | `LDA ($02),Y` (5-6 cycles) |
| **Size** | 64KB | 256 bytes |

**Bottom line:** ZP is 20-30% faster and enables indirect addressing.

---

## 2. ZP Scoring Algorithm

### 2.1 Score Components

The ZP score determines priority for allocation:

```
ZP Score = TypeWeight 
         + AccessBonus 
         + LoopBonus 
         + DirectiveBonus
```

| Component | Range | Description |
|-----------|-------|-------------|
| **TypeWeight** | 0-2048 | Base weight by type (pointers highest) |
| **AccessBonus** | 0-1000 | Bonus per access (capped) |
| **LoopBonus** | 0-∞ | Exponential multiplier for loop depth |
| **DirectiveBonus** | -∞ to +∞ | User directive override |

### 2.2 Implementation

```typescript
/**
 * Calculate ZP priority score for a slot.
 * Higher score = higher priority for ZP allocation.
 */
protected calculateZpScore(
  slot: SlotInfo,
  accessInfo: SlotAccessInfo
): ZpScoreResult {
  const breakdown: ZpScoreBreakdown = {
    typeWeight: 0,
    accessBonus: 0,
    loopBonus: 0,
    directiveBonus: 0,
    totalScore: 0,
  };
  
  // === Component 1: Type Weight ===
  breakdown.typeWeight = this.calculateTypeWeight(slot.type);
  
  // === Component 2: Access Frequency ===
  // Each access saves 1 cycle when in ZP
  const totalAccesses = accessInfo.readCount + accessInfo.writeCount;
  breakdown.accessBonus = Math.min(
    totalAccesses * this.config.zpWeights.accessWeight,
    this.config.zpWeights.maxAccessBonus
  );
  
  // Slight bias for writes (more expensive operations)
  if (accessInfo.writeCount > 0) {
    breakdown.accessBonus *= this.config.zpWeights.writeBiasMultiplier;
  }
  
  // === Component 3: Loop Depth ===
  // Variables in loops benefit exponentially
  // Depth 0: 1x, Depth 1: 2x, Depth 2: 4x, Depth 3: 8x
  const loopMultiplier = Math.pow(
    this.config.zpWeights.loopDepthMultiplier,
    accessInfo.maxLoopDepth
  );
  breakdown.loopBonus = (breakdown.typeWeight + breakdown.accessBonus) 
                        * (loopMultiplier - 1);
  
  // === Component 4: User Directive ===
  switch (slot.zpDirective) {
    case ZpDirective.Required:
      // Infinity guarantees allocation (or error)
      breakdown.directiveBonus = Infinity;
      break;
    case ZpDirective.Preferred:
      // High bonus to prioritize over automatic
      breakdown.directiveBonus = this.config.zpWeights.zpPreferredBonus;
      break;
    case ZpDirective.Forbidden:
      // Negative infinity ensures no ZP
      breakdown.directiveBonus = -Infinity;
      break;
    case ZpDirective.None:
      // Compiler decides based on hotness
      breakdown.directiveBonus = 0;
      break;
  }
  
  // === Final Score ===
  if (slot.zpDirective === ZpDirective.Required) {
    breakdown.totalScore = Infinity;
  } else if (slot.zpDirective === ZpDirective.Forbidden) {
    breakdown.totalScore = -Infinity;
  } else {
    breakdown.totalScore = breakdown.typeWeight 
                         + breakdown.accessBonus 
                         + breakdown.loopBonus 
                         + breakdown.directiveBonus;
  }
  
  return {
    slot,
    score: breakdown.totalScore,
    breakdown,
    accessInfo,
  };
}
```

### 2.3 Type Weights

```typescript
/**
 * Calculate type-based weight for ZP priority.
 * Based on Oscar64's approach - pointers benefit most.
 */
protected calculateTypeWeight(type: TypeInfo): number {
  const weights = this.config.zpWeights;
  
  // Pointers get highest weight - enables indirect addressing
  if (type.isPointer) {
    return weights.pointerWeight;  // Default: 2048
  }
  
  // Arrays rarely fit in ZP, low priority
  if (type.isArray) {
    const arraySize = type.arraySize ?? 0;
    // Small arrays (2-4 bytes) might fit
    if (arraySize <= 4) {
      return weights.byteWeight * 0.5;  // Reduced priority
    }
    return 0;  // Large arrays = no ZP
  }
  
  // Primitive types
  switch (type.kind) {
    case TypeKind.Byte:
    case TypeKind.Bool:
      return weights.byteWeight;   // Default: 256
    case TypeKind.Word:
      return weights.wordWeight;   // Default: 128 (2 bytes = less benefit per byte)
    default:
      return weights.byteWeight;
  }
}
```

### 2.4 Default Scoring Weights

```typescript
/**
 * Default weights for ZP scoring.
 * Tuned based on typical 6502 code patterns.
 */
const DEFAULT_ZP_WEIGHTS: ZpScoringWeights = {
  // Type weights (Oscar64 inspired)
  pointerWeight: 2048,      // Highest - indirect modes
  byteWeight: 256,          // Medium - most common
  wordWeight: 128,          // Lower - 2 bytes = less benefit/byte
  
  // Access scoring
  accessWeight: 10,         // 10 points per access
  maxAccessBonus: 1000,     // Cap to prevent domination
  
  // Loop depth
  loopDepthMultiplier: 2,   // 2x per nesting level
  
  // Directives
  zpPreferredBonus: 10000,  // @zp gets high priority
  
  // Write bias
  writeBiasMultiplier: 1.2, // Writes slightly more important
};
```

---

## 3. User Directives

### 3.1 Directive Semantics

| Directive | Syntax | Behavior | If No Space |
|-----------|--------|----------|-------------|
| `@zp required` | `@zp required let x: byte;` | Must be in ZP | **ERROR** |
| `@zp` | `@zp let x: byte;` | Prefer ZP | WARNING, use RAM |
| `@ram` | `@ram let x: byte;` | Never in ZP | N/A |
| (none) | `let x: byte;` | Compiler decides | Silent, use RAM |

### 3.2 Extracting Directives

```typescript
/**
 * Extract ZP directive from a variable declaration.
 */
protected extractZpDirective(decl: VariableDeclaration | Parameter): ZpDirective {
  // Check storage class for @zp annotation
  if (decl.storageClass) {
    const sc = decl.storageClass.toLowerCase();
    
    if (sc === '@zp required' || sc === '@zp_required') {
      return ZpDirective.Required;
    }
    if (sc === '@zp') {
      return ZpDirective.Preferred;
    }
    if (sc === '@ram') {
      return ZpDirective.Forbidden;
    }
  }
  
  // Check for attribute annotations
  if (decl.attributes) {
    for (const attr of decl.attributes) {
      if (attr.name === 'zp') {
        if (attr.arguments?.includes('required')) {
          return ZpDirective.Required;
        }
        return ZpDirective.Preferred;
      }
      if (attr.name === 'ram') {
        return ZpDirective.Forbidden;
      }
    }
  }
  
  // No directive = compiler decides
  return ZpDirective.None;
}
```

### 3.3 Directive Validation

```typescript
/**
 * Validate ZP directive against variable properties.
 */
protected validateZpDirective(
  slot: SlotInfo,
  funcName: string
): void {
  // Large arrays should not be @zp required
  if (slot.zpDirective === ZpDirective.Required) {
    if (slot.type.isArray && (slot.type.arraySize ?? 0) > 16) {
      this.addWarning(
        DiagnosticCodes.LARGE_ARRAY_ZP,
        `@zp required on array '${slot.name}' (${slot.size} bytes) ` +
        `may exhaust zero page quickly.`,
        {
          functionName: funcName,
          variableName: slot.name,
          suggestion: 'Consider using @zp (preferred) instead.',
        }
      );
    }
    
    // Check if size is reasonable for ZP
    if (slot.size > 32) {
      this.addWarning(
        DiagnosticCodes.LARGE_ZP_SLOT,
        `@zp required on '${slot.name}' (${slot.size} bytes) is large.`,
        {
          functionName: funcName,
          variableName: slot.name,
          suggestion: 'ZP is limited to 256 bytes total.',
        }
      );
    }
  }
}
```

---

## 4. ZP Pool Management

### 4.1 ZpPool Class

```typescript
/**
 * Manages the pool of available zero page addresses.
 */
class ZpPool {
  /** Available addresses (sorted) */
  protected available: number[];
  
  /** Allocated addresses with owner info */
  protected allocated: Map<number, ZpAllocationRecord>;
  
  /** Platform configuration */
  protected platform: PlatformConfig;
  
  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.available = [];
    this.allocated = new Map();
    this.initialize();
  }
  
  /**
   * Initialize pool with available addresses.
   */
  protected initialize(): void {
    // Add all addresses in the ZP range
    for (let addr = this.platform.zpStart; addr < this.platform.zpEnd; addr++) {
      // Skip reserved addresses
      if (this.platform.zpReserved.includes(addr)) {
        continue;
      }
      this.available.push(addr);
    }
    
    // Sort for contiguous block finding
    this.available.sort((a, b) => a - b);
  }
  
  /**
   * Allocate contiguous bytes from pool.
   * @param size Number of bytes needed
   * @param owner Owner information for debugging
   * @returns Starting address or null if no space
   */
  allocate(size: number, owner: ZpAllocationRecord): number | null {
    if (size <= 0) return null;
    
    // Find first contiguous block of 'size' bytes
    for (let i = 0; i <= this.available.length - size; i++) {
      let contiguous = true;
      
      // Check if next 'size' addresses are contiguous
      for (let j = 1; j < size; j++) {
        if (this.available[i + j] !== this.available[i] + j) {
          contiguous = false;
          break;
        }
      }
      
      if (contiguous) {
        const startAddr = this.available[i];
        
        // Remove from available
        this.available.splice(i, size);
        
        // Record allocation
        for (let j = 0; j < size; j++) {
          this.allocated.set(startAddr + j, owner);
        }
        
        return startAddr;
      }
    }
    
    return null;  // No contiguous block found
  }
  
  /**
   * Get remaining available bytes.
   */
  get remainingBytes(): number {
    return this.available.length;
  }
  
  /**
   * Get total allocated bytes.
   */
  get allocatedBytes(): number {
    return this.allocated.size;
  }
  
  /**
   * Get pool statistics.
   */
  getStats(): ZpPoolStats {
    const total = this.platform.zpEnd - this.platform.zpStart - 
                  this.platform.zpReserved.length;
    const used = this.allocated.size;
    
    return {
      totalAvailable: total,
      used,
      remaining: this.available.length,
      usagePercent: (used / total) * 100,
    };
  }
  
  /**
   * Get allocation map for debugging.
   */
  getAllocationMap(): Map<number, ZpAllocationRecord> {
    return new Map(this.allocated);
  }
}

/**
 * Record of a ZP allocation.
 */
interface ZpAllocationRecord {
  functionName: string;
  slotName: string;
  size: number;
  score: number;
  directive: ZpDirective;
}
```

---

## 5. ZP Allocation Algorithm

### 5.1 Multi-Phase Allocation

```
Phase 1: Collect all ZP requests
Phase 2: Sort by priority (Required > Preferred > Auto)
Phase 3: Allocate Required slots (error if fail)
Phase 4: Allocate Preferred slots (warning if fail)
Phase 5: Allocate Automatic slots (silent if fail)
Phase 6: Record results
```

### 5.2 Implementation

```typescript
/**
 * Allocate zero page addresses to eligible slots.
 */
allocateZeroPage(
  accessAnalysis: Map<string, Map<string, SlotAccessInfo>>
): void {
  // === Phase 1: Collect all ZP requests ===
  const requests: ZpAllocationRequest[] = [];
  
  for (const [funcName, shell] of this.frameShells) {
    const accessInfo = accessAnalysis.get(funcName) ?? new Map();
    
    for (const slot of shell.slots) {
      // Skip @ram annotated slots
      if (slot.zpDirective === ZpDirective.Forbidden) {
        continue;
      }
      
      // Get access info (default if not found)
      const slotAccess = accessInfo.get(slot.name) ?? {
        readCount: 0,
        writeCount: 0,
        maxLoopDepth: 0,
        isHotPath: false,
      };
      
      // Calculate score
      const scoreResult = this.calculateZpScore(slot, slotAccess);
      
      // Validate directive
      this.validateZpDirective(slot, funcName);
      
      requests.push({
        slot,
        functionName: funcName,
        directive: slot.zpDirective,
        score: scoreResult.score,
        scoreBreakdown: scoreResult.breakdown,
        accessInfo: slotAccess,
      });
    }
  }
  
  // === Phase 2: Sort by priority ===
  requests.sort((a, b) => {
    // @zp required always first
    if (a.directive === ZpDirective.Required && 
        b.directive !== ZpDirective.Required) {
      return -1;
    }
    if (b.directive === ZpDirective.Required && 
        a.directive !== ZpDirective.Required) {
      return 1;
    }
    
    // @zp preferred next
    if (a.directive === ZpDirective.Preferred && 
        b.directive === ZpDirective.None) {
      return -1;
    }
    if (b.directive === ZpDirective.Preferred && 
        a.directive === ZpDirective.None) {
      return 1;
    }
    
    // Within same priority, sort by score descending
    return b.score - a.score;
  });
  
  // === Phase 3-5: Allocate in priority order ===
  const failedRequired: ZpAllocationRequest[] = [];
  const fallbackToRam: ZpAllocationRequest[] = [];
  
  for (const request of requests) {
    const owner: ZpAllocationRecord = {
      functionName: request.functionName,
      slotName: request.slot.name,
      size: request.slot.size,
      score: request.score,
      directive: request.directive,
    };
    
    const address = this.zpPool.allocate(request.slot.size, owner);
    
    if (address !== null) {
      // Success - record allocation
      this.recordZpAllocation(request.functionName, request.slot.name, address);
      
      // Log automatic allocations for visibility
      if (request.directive === ZpDirective.None) {
        this.addInfo(
          DiagnosticCodes.ZP_AUTO_ALLOCATED,
          `Auto-allocated '${request.slot.name}' in '${request.functionName}' ` +
          `to ZP $${address.toString(16).padStart(2, '0')} ` +
          `(score: ${request.score.toFixed(0)})`,
          {
            functionName: request.functionName,
            variableName: request.slot.name,
          }
        );
      }
    } else {
      // Failed - handle based on directive
      this.handleZpAllocationFailure(request, failedRequired, fallbackToRam);
    }
  }
  
  // === Phase 6: Report results ===
  this.reportZpAllocationResults(failedRequired, fallbackToRam);
}

/**
 * Record a ZP allocation.
 */
protected recordZpAllocation(
  funcName: string,
  slotName: string,
  address: number
): void {
  if (!this.zpAllocations.has(funcName)) {
    this.zpAllocations.set(funcName, new Map());
  }
  this.zpAllocations.get(funcName)!.set(slotName, address);
}

/**
 * Handle failed ZP allocation based on directive.
 */
protected handleZpAllocationFailure(
  request: ZpAllocationRequest,
  failedRequired: ZpAllocationRequest[],
  fallbackToRam: ZpAllocationRequest[]
): void {
  const stats = this.zpPool.getStats();
  
  switch (request.directive) {
    case ZpDirective.Required:
      // ERROR - @zp required but no space
      failedRequired.push(request);
      this.addError(
        DiagnosticCodes.ZP_REQUIRED_FAILED,
        `Cannot allocate '${request.slot.name}' to zero page: ` +
        `need ${request.slot.size} bytes, only ${stats.remaining} available.`,
        {
          functionName: request.functionName,
          variableName: request.slot.name,
          suggestion: this.buildZpRecoverySuggestion(stats),
        }
      );
      break;
      
    case ZpDirective.Preferred:
      // WARNING - @zp preferred, falling back
      fallbackToRam.push(request);
      this.addWarning(
        DiagnosticCodes.ZP_PREFERRED_FALLBACK,
        `'${request.slot.name}' in '${request.functionName}' ` +
        `requested zero page but allocated to RAM (ZP full).`,
        {
          functionName: request.functionName,
          variableName: request.slot.name,
        }
      );
      break;
      
    case ZpDirective.None:
      // Silent - automatic allocation just uses RAM
      break;
  }
}

/**
 * Build helpful suggestion for ZP recovery.
 */
protected buildZpRecoverySuggestion(stats: ZpPoolStats): string {
  const suggestions: string[] = [];
  
  if (stats.usagePercent > 90) {
    suggestions.push('Zero page is nearly full. Consider:');
    suggestions.push('  - Remove @zp from less critical variables');
    suggestions.push('  - Use @ram for large buffers');
    suggestions.push('  - Enable frame coalescing');
  } else if (stats.usagePercent > 70) {
    suggestions.push('Zero page is filling up. Watch for:');
    suggestions.push('  - Large arrays with @zp');
    suggestions.push('  - Many @zp required annotations');
  }
  
  return suggestions.join('\n');
}

/**
 * Report final ZP allocation results.
 */
protected reportZpAllocationResults(
  failedRequired: ZpAllocationRequest[],
  fallbackToRam: ZpAllocationRequest[]
): void {
  const stats = this.zpPool.getStats();
  
  this.addInfo(
    DiagnosticCodes.ZP_ALLOCATION_COMPLETE,
    `Zero page allocation: ${stats.used}/${stats.totalAvailable} bytes ` +
    `(${stats.usagePercent.toFixed(1)}% used).`
  );
  
  if (failedRequired.length > 0) {
    this.addError(
      DiagnosticCodes.ZP_ALLOCATION_ERRORS,
      `${failedRequired.length} @zp required allocation(s) failed.`
    );
  }
  
  if (fallbackToRam.length > 0) {
    this.addWarning(
      DiagnosticCodes.ZP_ALLOCATION_FALLBACKS,
      `${fallbackToRam.length} @zp preferred allocation(s) fell back to RAM.`
    );
  }
}
```

---

## 6. ZP Request Type

```typescript
/**
 * A request for ZP allocation.
 */
interface ZpAllocationRequest {
  /** The slot requesting ZP */
  slot: SlotInfo;
  
  /** Owning function name */
  functionName: string;
  
  /** User directive */
  directive: ZpDirective;
  
  /** Calculated priority score */
  score: number;
  
  /** Score breakdown for debugging */
  scoreBreakdown: ZpScoreBreakdown;
  
  /** Access analysis info */
  accessInfo: SlotAccessInfo;
}
```

---

## 7. Example ZP Allocation

```typescript
// Given:
fn game_loop(): void {
  @zp required let player_x: byte = 100;  // Must be in ZP
  @zp let player_y: byte = 50;            // Prefer ZP
  let score: word = 0;                     // Compiler decides
  @ram let buffer: byte[256];             // Never in ZP
}

// In a tight loop:
for (let i: byte = 0; i < 255; i++) {
  player_x = player_x + velocity_x;       // Hot! (255 iterations)
}

// ZP Scoring:
// player_x: Required → Infinity (guaranteed)
// player_y: Preferred → 10256 (256 type + 10000 directive)
// score: Auto → 2340 (128 type + 2500 access + 1712 loop bonus)
// buffer: Forbidden → -Infinity (never)

// Allocation order:
// 1. player_x → $02 (Required)
// 2. player_y → $03 (Preferred)
// 3. score → $04-$05 (Auto, hot enough)
// 4. buffer → RAM only (Forbidden)

// ZP Usage: 4/142 bytes (C64)
```

---

## Summary

| Phase | Purpose | Output |
|-------|---------|--------|
| **Scoring** | Prioritize variables | ZP score per slot |
| **Collection** | Gather requests | Sorted request list |
| **Allocation** | Assign ZP addresses | Address map |
| **Reporting** | Inform user | Diagnostics |

---

**Previous Document:** [02b-allocation-method.md](02b-allocation-method.md)  
**Next Document:** [02d-call-graph-analysis.md](02d-call-graph-analysis.md)