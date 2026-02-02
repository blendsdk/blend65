# God-Level SFA: Zero Page Allocation Strategy

> **Document**: god-level-sfa/03-zeropage-strategy.md
> **Purpose**: Comprehensive zero page allocation algorithm
> **Created**: 2025-02-01
> **Status**: Complete

## Overview

Zero page ($00-$FF) is the most precious memory on 6502. Accessing ZP is:
- **Faster**: 3 cycles vs 4 cycles for absolute addressing
- **Smaller**: 2 bytes vs 3 bytes per instruction
- **Required**: For indirect addressing modes (LDA ($nn),Y)

The God-Level SFA uses a **multi-phase ZP allocation** strategy that combines:
1. **Automatic hotness detection** (Oscar64 style)
2. **Explicit user directives** (Prog8 style)
3. **Platform-aware region management**
4. **Graceful overflow handling**

---

## 1. ZP Region Management

### 1.1 Platform-Specific ZP Regions

```typescript
interface ZpRegionConfig {
  /** Start of user-available ZP (inclusive) */
  userStart: number;
  /** End of user-available ZP (exclusive) */
  userEnd: number;
  /** System-reserved addresses (cannot use) */
  systemReserved: number[];
  /** Compiler scratch area (temporary use) */
  scratchRegion: ZpRegion;
  /** Total available bytes */
  availableBytes: number;
}

/**
 * C64 Zero Page Layout:
 * $00-$01: 6510 I/O port (SYSTEM)
 * $02-$8F: BASIC/Kernal (AVAILABLE with BASIC off)
 * $90-$FA: Kernal workspace (AVAILABLE with Kernal off)
 * $FB-$FE: Compiler scratch (SCRATCH)
 * $FF: CPU temporary (SYSTEM)
 */
const C64_ZP_CONFIG: ZpRegionConfig = {
  userStart: 0x02,
  userEnd: 0xfb,
  systemReserved: [0x00, 0x01, 0xff],
  scratchRegion: { start: 0xfb, end: 0xff, size: 4, label: 'scratch' },
  availableBytes: 249, // $02-$FA
};

/**
 * Commander X16 Zero Page Layout:
 * $00-$21: VERA/banking (SYSTEM)
 * $22-$7F: User available (AVAILABLE)
 * $80-$FF: Kernal (SYSTEM when Kernal enabled)
 */
const X16_ZP_CONFIG: ZpRegionConfig = {
  userStart: 0x22,
  userEnd: 0x80,
  systemReserved: Array.from({ length: 0x22 }, (_, i) => i),
  scratchRegion: { start: 0x7c, end: 0x80, size: 4, label: 'scratch' },
  availableBytes: 94, // $22-$7F
};
```

### 1.2 ZP Allocation Pool

```typescript
/**
 * Manages the pool of available ZP addresses.
 */
class ZpPool {
  protected available: number[] = [];
  protected allocated: Map<number, FrameSlot> = new Map();
  protected config: ZpRegionConfig;

  constructor(config: ZpRegionConfig) {
    this.config = config;
    this.initializePool();
  }

  /**
   * Initialize pool with all available addresses.
   */
  protected initializePool(): void {
    for (let addr = this.config.userStart; addr < this.config.userEnd; addr++) {
      if (!this.config.systemReserved.includes(addr) &&
          !(addr >= this.config.scratchRegion.start && 
            addr < this.config.scratchRegion.end)) {
        this.available.push(addr);
      }
    }
  }

  /**
   * Allocate contiguous bytes from the pool.
   * @param size Number of bytes needed
   * @returns Starting address or null if no space
   */
  allocate(size: number): number | null {
    // Find first contiguous block of 'size' bytes
    for (let i = 0; i <= this.available.length - size; i++) {
      let contiguous = true;
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
        return startAddr;
      }
    }

    return null; // No contiguous block found
  }

  /**
   * Get remaining available bytes.
   */
  get remainingBytes(): number {
    return this.available.length;
  }

  /**
   * Get usage statistics.
   */
  getStats(): ZpPoolStats {
    return {
      totalAvailable: this.config.availableBytes,
      used: this.config.availableBytes - this.available.length,
      remaining: this.available.length,
      usagePercent: ((this.config.availableBytes - this.available.length) / 
                     this.config.availableBytes) * 100,
    };
  }
}
```

---

## 2. Hotness Detection (Access Analysis)

### 2.1 What Makes a Variable "Hot"?

A variable is "hot" if accessing it in zero page yields significant performance benefit:

| Factor | Impact | Rationale |
|--------|--------|-----------|
| **Loop depth** | High | Variables in inner loops dominate runtime |
| **Access count** | Medium | More accesses = more savings |
| **Type** | Medium | Pointers benefit most (enables indirect modes) |
| **Size** | Low | Smaller variables waste less ZP |

### 2.2 Hotness Scoring Algorithm

```typescript
/**
 * Comprehensive hotness score calculation.
 * Higher score = higher priority for ZP allocation.
 */
function calculateHotnessScore(
  slot: FrameSlot,
  accessInfo: SlotAccessInfo,
  config: ZpScoringWeights
): HotnessScoreResult {
  const breakdown: ZpScoreBreakdown = {
    typeWeight: 0,
    accessBonus: 0,
    loopBonus: 0,
    directiveBonus: 0,
    totalScore: 0,
  };

  // === Component 1: Type Weight ===
  breakdown.typeWeight = calculateTypeWeight(slot.type, config);

  // === Component 2: Access Frequency Bonus ===
  // Each access saves 1 cycle and 1 byte when in ZP
  const totalAccesses = accessInfo.readCount + accessInfo.writeCount;
  breakdown.accessBonus = totalAccesses * config.accessWeight;
  // Cap to prevent one variable from dominating
  breakdown.accessBonus = Math.min(breakdown.accessBonus, config.maxAccessBonus);

  // === Component 3: Loop Depth Multiplier ===
  // Variables in loops are exponentially more important
  // depth 0: 1x, depth 1: 2x, depth 2: 4x, depth 3: 8x
  const loopMultiplier = Math.pow(config.loopDepthMultiplier, accessInfo.maxLoopDepth);
  breakdown.loopBonus = (breakdown.typeWeight + breakdown.accessBonus) * (loopMultiplier - 1);

  // === Component 4: User Directive ===
  switch (slot.zpDirective) {
    case ZpDirective.Required:
      // MUST be in ZP - use infinity to guarantee allocation
      breakdown.directiveBonus = Infinity;
      break;
    case ZpDirective.Preferred:
      // High bonus to prioritize over automatic
      breakdown.directiveBonus = config.zpPreferredBonus;
      break;
    case ZpDirective.Forbidden:
      // Negative infinity ensures it never gets ZP
      breakdown.directiveBonus = -Infinity;
      break;
    case ZpDirective.None:
      // No adjustment
      breakdown.directiveBonus = 0;
      break;
  }

  // === Final Score ===
  if (slot.zpDirective === ZpDirective.Required) {
    breakdown.totalScore = Infinity;
  } else if (slot.zpDirective === ZpDirective.Forbidden) {
    breakdown.totalScore = -Infinity;
  } else {
    breakdown.totalScore = (breakdown.typeWeight + breakdown.accessBonus + 
                           breakdown.loopBonus + breakdown.directiveBonus);
  }

  return {
    slot,
    score: breakdown.totalScore,
    breakdown,
    accessInfo,
  };
}

/**
 * Type-based weight assignment (Oscar64 approach).
 */
function calculateTypeWeight(type: TypeInfo, config: ZpScoringWeights): number {
  // Pointers get highest weight - enables indirect Y addressing
  if (type.isPointer) {
    return config.pointerWeight;
  }

  // Arrays rarely fit in ZP
  if (type.isArray) {
    // Small arrays (2-4 bytes) might fit
    const arraySize = type.arraySize ?? 0;
    if (arraySize <= 4) {
      return config.byteWeight * 0.5; // Reduced priority
    }
    return 0; // Large arrays = no ZP
  }

  // Primitive types
  switch (type.name) {
    case 'byte':
    case 'bool':
      return config.byteWeight;
    case 'word':
      return config.wordWeight;
    default:
      return config.byteWeight; // Default to byte weight
  }
}
```

### 2.3 Default Scoring Weights

```typescript
/**
 * Default weights for ZP scoring.
 * These can be tuned via compiler options.
 */
const DEFAULT_ZP_SCORING_WEIGHTS: ZpScoringWeights = {
  // Type weights (Oscar64 inspired)
  pointerWeight: 2048,    // 0x800 - Highest (indirect modes)
  byteWeight: 256,        // 0x100 - Medium
  wordWeight: 128,        // 0x080 - Lower (2 bytes = less benefit)

  // Access scoring
  accessWeight: 10,       // Points per access
  maxAccessBonus: 1000,   // Cap to prevent domination

  // Loop depth
  loopDepthMultiplier: 2, // 2x per nesting level

  // Directive bonuses
  zpPreferredBonus: 10000, // @zp preferred gets high priority

  // Reserved for future use
  writeBiasMultiplier: 1.2, // Writes slightly more important than reads
};
```

---

## 3. User Directives (@zp, @ram)

### 3.1 Directive Semantics (Simplified)

**Key Principle:** All directives are **predictable** - no ambiguous "prefer" semantics.

| Directive | Syntax | Behavior | Predictable? |
|-----------|--------|----------|--------------|
| `@zp` | `@zp let x: byte;` | **MUST** be in ZP, compile error if impossible | ✅ Yes |
| `@ram` | `@ram let x: byte;` | **MUST** be in RAM, never ZP | ✅ Yes |
| (none) | `let x: byte;` | **Automatic** - compiler decides (deterministic) | ✅ Yes |

**Why No "Prefer" Option:**
- Creates unpredictable behavior - developer won't know if variable landed in ZP or RAM
- If you need ZP, use `@zp` and get a clear error if impossible
- If you don't care, let the compiler decide (it's deterministic)

### 3.2 Processing User Directives

```typescript
/**
 * Extract ZP directive from a variable declaration.
 */
function extractZpDirective(decl: VariableDeclaration): ZpDirective {
  // Check for @zp annotation
  if (hasAnnotation(decl, 'zp')) {
    const annotation = getAnnotation(decl, 'zp');
    
    // Check if "required" modifier present
    if (annotation?.arguments?.includes('required')) {
      return ZpDirective.Required;
    }
    
    return ZpDirective.Preferred;
  }

  // Check for @ram annotation
  if (hasAnnotation(decl, 'ram')) {
    return ZpDirective.Forbidden;
  }

  // No directive = compiler decides
  return ZpDirective.None;
}

/**
 * Validate ZP directive against variable type.
 */
function validateZpDirective(
  slot: FrameSlot,
  diagnostics: AllocationDiagnostic[]
): boolean {
  // Large arrays should not be @zp required
  if (slot.zpDirective === ZpDirective.Required && 
      slot.type.isArray && (slot.type.arraySize ?? 0) > 16) {
    diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      code: 'SFA_LARGE_ARRAY_ZP',
      message: `@zp required on array '${slot.name}' (${slot.size} bytes) ` +
               `may exhaust zero page quickly.`,
      variableName: slot.name,
      suggestion: 'Consider using @zp (preferred) or removing the directive.',
    });
  }

  return true;
}
```

---

## 4. Multi-Phase ZP Allocation

### 4.1 Phase Overview

```
Phase 1: Collect ZP Requests
         ↓
Phase 2: Sort by Priority
         ↓
Phase 3: Allocate Required (@zp required)
         ↓
Phase 4: Allocate Preferred (@zp)
         ↓
Phase 5: Allocate Automatic (hottest first)
         ↓
Phase 6: Report Results
```

### 4.2 Complete Allocation Algorithm

```typescript
/**
 * Main ZP allocation algorithm.
 */
function allocateZeroPage(
  frames: Map<string, Frame>,
  accessAnalysis: Map<string, Map<string, SlotAccessInfo>>,
  config: FrameAllocatorConfig
): ZpAllocationResult {
  const pool = new ZpPool(config.platform.zpConfig);
  const diagnostics: AllocationDiagnostic[] = [];
  const allocations = new Map<FrameSlot, number>();
  const failedRequired: ZpAllocationRequest[] = [];
  const fellBackToRam: ZpAllocationRequest[] = [];

  // === Phase 1: Collect all ZP requests ===
  const requests: ZpAllocationRequest[] = [];

  for (const [funcName, frame] of frames) {
    const accessInfo = accessAnalysis.get(funcName) ?? new Map();

    for (const slot of frame.slots) {
      // Skip @ram annotated slots
      if (slot.zpDirective === ZpDirective.Forbidden) {
        continue;
      }

      const slotAccess = accessInfo.get(slot.name) ?? {
        readCount: 0,
        writeCount: 0,
        maxLoopDepth: 0,
        isHotPath: false,
      };

      const hotnessResult = calculateHotnessScore(slot, slotAccess, config.zpWeights);

      requests.push({
        slot,
        functionName: funcName,
        directive: slot.zpDirective,
        score: hotnessResult.score,
        scoreBreakdown: hotnessResult.breakdown,
      });
    }
  }

  // === Phase 2: Sort by priority ===
  // Required first, then by score descending
  requests.sort((a, b) => {
    // @zp required always first
    if (a.directive === ZpDirective.Required && b.directive !== ZpDirective.Required) {
      return -1;
    }
    if (b.directive === ZpDirective.Required && a.directive !== ZpDirective.Required) {
      return 1;
    }

    // @zp preferred next
    if (a.directive === ZpDirective.Preferred && b.directive === ZpDirective.None) {
      return -1;
    }
    if (b.directive === ZpDirective.Preferred && a.directive === ZpDirective.None) {
      return 1;
    }

    // Within same directive class, sort by score
    return b.score - a.score;
  });

  // === Phase 3-5: Allocate in priority order ===
  for (const request of requests) {
    const address = pool.allocate(request.slot.size);

    if (address !== null) {
      // Success - record allocation
      allocations.set(request.slot, address);

      // Update slot
      request.slot.location = SlotLocation.ZeroPage;
      request.slot.address = address;

      // Track what type of allocation this was
      if (request.directive === ZpDirective.None) {
        diagnostics.push({
          severity: DiagnosticSeverity.Info,
          code: DiagnosticCodes.ZP_AUTO_ALLOCATED,
          message: `Auto-allocated '${request.slot.name}' to ZP $${address.toString(16).padStart(2, '0')} ` +
                   `(score: ${request.score.toFixed(0)})`,
          functionName: request.functionName,
          variableName: request.slot.name,
        });
      }
    } else {
      // Failed - handle based on directive
      if (request.directive === ZpDirective.Required) {
        // ERROR: @zp required but no space
        failedRequired.push(request);
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          code: DiagnosticCodes.ZP_REQUIRED_FAILED,
          message: `Cannot allocate '${request.slot.name}' to zero page (no space).`,
          functionName: request.functionName,
          variableName: request.slot.name,
          suggestion: `ZP usage: ${pool.getStats().used}/${pool.getStats().totalAvailable} bytes. ` +
                     `Remove @zp from less critical variables.`,
        });
      } else if (request.directive === ZpDirective.Preferred) {
        // WARNING: @zp preferred, falling back
        fellBackToRam.push(request);
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          code: DiagnosticCodes.ZP_PREFERRED_FALLBACK,
          message: `'${request.slot.name}' requested zero page but allocated to RAM (ZP full).`,
          functionName: request.functionName,
          variableName: request.slot.name,
        });
      }
      // Automatic allocations that fail just stay in RAM (no diagnostic)
    }
  }

  // === Phase 6: Return results ===
  return {
    allocations,
    failedRequired,
    fellBackToRam,
    remainingZpBytes: pool.remainingBytes,
    stats: pool.getStats(),
    diagnostics,
    hasErrors: failedRequired.length > 0,
  };
}
```

---

## 5. Coalescing-Aware ZP Allocation

### 5.1 The Problem

When frames are coalesced, multiple functions share the same memory region. ZP allocation must consider:

1. **Slots from coalesced functions may have different ZP requests**
2. **ZP addresses are global, not per-coalesce-group**
3. **Highest-priority slot in any coalesced function should get ZP**

### 5.2 Coalesce-Aware Strategy

```typescript
/**
 * ZP allocation considering coalesce groups.
 * 
 * Strategy: For each coalesce group, only the highest-scoring slot
 * at each offset position should be considered for ZP.
 */
function allocateZpWithCoalescing(
  frames: Map<string, Frame>,
  groups: CoalesceGroup[],
  accessAnalysis: Map<string, Map<string, SlotAccessInfo>>,
  config: FrameAllocatorConfig
): ZpAllocationResult {
  const requests: ZpAllocationRequest[] = [];

  // For each coalesce group, find winning slots at each offset
  for (const group of groups) {
    // Collect all slots from group members, organized by offset
    const slotsByOffset = new Map<number, ZpAllocationRequest[]>();

    for (const funcName of group.members) {
      const frame = frames.get(funcName)!;
      const accessInfo = accessAnalysis.get(funcName) ?? new Map();

      for (const slot of frame.slots) {
        if (slot.zpDirective === ZpDirective.Forbidden) continue;

        const slotAccess = accessInfo.get(slot.name) ?? {
          readCount: 0, writeCount: 0, maxLoopDepth: 0, isHotPath: false
        };

        const hotnessResult = calculateHotnessScore(slot, slotAccess, config.zpWeights);

        const request: ZpAllocationRequest = {
          slot,
          functionName: funcName,
          directive: slot.zpDirective,
          score: hotnessResult.score,
          scoreBreakdown: hotnessResult.breakdown,
        };

        const offset = slot.offset;
        if (!slotsByOffset.has(offset)) {
          slotsByOffset.set(offset, []);
        }
        slotsByOffset.get(offset)!.push(request);
      }
    }

    // For each offset, pick the highest-priority slot
    for (const [offset, candidates] of slotsByOffset) {
      // Sort by priority
      candidates.sort((a, b) => {
        // @zp required always wins
        if (a.directive === ZpDirective.Required && b.directive !== ZpDirective.Required) {
          return -1;
        }
        if (b.directive === ZpDirective.Required && a.directive !== ZpDirective.Required) {
          return 1;
        }
        return b.score - a.score;
      });

      // Add winner to global requests
      requests.push(candidates[0]);
    }
  }

  // Proceed with normal allocation
  return allocateFromRequests(requests, config);
}
```

---

## 6. ZP Spillover and Recovery

### 6.1 When ZP is Exhausted

```typescript
/**
 * Strategy when ZP fills up:
 * 1. Required (@zp required) → ERROR
 * 2. Preferred (@zp) → WARNING + RAM fallback
 * 3. Automatic → Silent RAM fallback
 */
function handleZpExhaustion(
  request: ZpAllocationRequest,
  pool: ZpPool,
  diagnostics: AllocationDiagnostic[]
): ZpExhaustionResult {
  const stats = pool.getStats();

  switch (request.directive) {
    case ZpDirective.Required:
      return {
        success: false,
        action: 'error',
        diagnostic: {
          severity: DiagnosticSeverity.Error,
          code: DiagnosticCodes.ZP_REQUIRED_FAILED,
          message: `Cannot allocate '${request.slot.name}' to zero page.\n` +
                   `Required: ${request.slot.size} bytes, ` +
                   `Available: ${stats.remaining} bytes.`,
          suggestion: buildZpRecoverySuggestion(stats),
        },
      };

    case ZpDirective.Preferred:
      return {
        success: true, // Can continue with RAM
        action: 'fallback',
        diagnostic: {
          severity: DiagnosticSeverity.Warning,
          code: DiagnosticCodes.ZP_PREFERRED_FALLBACK,
          message: `'${request.slot.name}' allocated to RAM (ZP full).`,
          suggestion: `ZP: ${stats.used}/${stats.totalAvailable} bytes used.`,
        },
      };

    default:
      return {
        success: true, // Automatic just uses RAM
        action: 'silent_fallback',
        diagnostic: null,
      };
  }
}

/**
 * Build helpful suggestion for ZP recovery.
 */
function buildZpRecoverySuggestion(stats: ZpPoolStats): string {
  const suggestions: string[] = [];

  if (stats.usagePercent > 90) {
    suggestions.push('ZP is nearly full. Consider:');
    suggestions.push('  - Remove @zp from less critical variables');
    suggestions.push('  - Enable frame coalescing (-Ocoalesce)');
    suggestions.push('  - Use @ram for large buffers');
  }

  return suggestions.join('\n');
}
```

---

## 7. ZP Allocation Report

### 7.1 Detailed Report Structure

```typescript
interface ZpAllocationReport {
  /** Summary statistics */
  summary: {
    totalRequests: number;
    allocated: number;
    failedRequired: number;
    fellBackToRam: number;
    automaticAllocations: number;
  };

  /** ZP usage breakdown */
  usage: {
    totalAvailable: number;
    used: number;
    remaining: number;
    usagePercent: number;
  };

  /** Per-function breakdown */
  perFunction: Map<string, {
    functionName: string;
    zpSlots: number;
    zpBytes: number;
    ramSlots: number;
    ramBytes: number;
  }>;

  /** Allocations sorted by address */
  allocationsByAddress: Array<{
    address: number;
    slot: FrameSlot;
    functionName: string;
  }>;

  /** Diagnostics */
  diagnostics: AllocationDiagnostic[];
}

function generateZpReport(result: ZpAllocationResult): ZpAllocationReport {
  // Build detailed report for debugging/optimization
  // ...
}
```

### 7.2 Report Output Example

```
=== Zero Page Allocation Report ===

Summary:
  Requests: 45
  Allocated: 38
  Failed (@zp required): 0
  Fallback (@zp preferred): 3
  Automatic: 35

ZP Usage: 186/249 bytes (74.7%)

By Function:
  main:           4 slots,  8 bytes in ZP
  game_loop:      6 slots, 12 bytes in ZP
  move_player:    3 slots,  6 bytes in ZP
  draw_sprites:   8 slots, 24 bytes in ZP (most ZP)
  ...

Allocations:
  $02-$03: game_loop.player_x (word, score: 4096)
  $04-$05: game_loop.player_y (word, score: 4096)
  $06-$07: draw_sprites.sprite_ptr (pointer, score: 8192)
  ...

Warnings:
  - 'input_buffer' fell back to RAM (ZP full)
  - 'temp_array' fell back to RAM (ZP full)
```

---

## 8. Configuration Options

### 8.1 ZP-Related Compiler Options

```typescript
interface ZpAllocationOptions {
  /** Enable automatic ZP allocation (default: true) */
  enableAutoZp: boolean;

  /** Minimum score for automatic ZP allocation (default: 100) */
  autoZpMinScore: number;

  /** Reserve bytes for runtime use (default: 8) */
  zpReserveBytes: number;

  /** Enable ZP coalescing (default: true) */
  enableZpCoalescing: boolean;

  /** Scoring weights (default: DEFAULT_ZP_SCORING_WEIGHTS) */
  zpWeights: ZpScoringWeights;

  /** Verbose ZP allocation logging */
  verboseZpAllocation: boolean;
}

// Usage: blend65 compile --zp-auto=false --zp-reserve=16 main.blend
```

---

## 9. Summary

| Phase | Input | Output |
|-------|-------|--------|
| **Region Setup** | Platform config | ZpPool initialized |
| **Collect Requests** | All frames + access analysis | ZpAllocationRequest[] |
| **Sort by Priority** | Requests | Sorted requests |
| **Allocate Required** | @zp required slots | Allocations or errors |
| **Allocate Preferred** | @zp slots | Allocations or warnings |
| **Allocate Automatic** | Hottest slots | Allocations (silent) |
| **Generate Report** | All results | ZpAllocationReport |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Required → Error** | User explicitly demanded ZP |
| **Preferred → Warning** | User wanted ZP but can live without |
| **Automatic → Silent** | Compiler decides, user doesn't care |
| **Pointers prioritized** | Enables indirect Y addressing |
| **Loop depth exponential** | Inner loops dominate runtime |
| **Coalesce-aware** | Don't duplicate ZP in shared frames |

---

**Previous Document:** [02d-slot-layout.md](02d-slot-layout.md)  
**Next Document:** [04-call-graph-reuse.md](04-call-graph-reuse.md)