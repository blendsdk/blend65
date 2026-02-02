# Blend Integration: FrameAllocator Class Structure

> **Document**: blend-integration/02a-allocator-class.md
> **Parent**: [02-allocator-impl.md](02-allocator-impl.md)
> **Status**: Design Complete
> **Target File**: `packages/compiler-v2/src/frame/allocator.ts`

## Overview

The `FrameAllocator` is the main class that orchestrates Static Frame Allocation (SFA). It coordinates:

1. **Call Graph Construction** - Build function call relationships
2. **Frame Size Calculation** - Determine bytes needed per function
3. **Frame Coalescing** - Share memory between non-overlapping functions
4. **Zero Page Allocation** - Assign hot variables to ZP
5. **Address Assignment** - Assign final memory addresses

---

## 1. Class Architecture

### 1.1 Inheritance Chain

```
BaseAllocator (utilities, error handling)
       ↓
CallGraphBuilder extends BaseAllocator (call graph)
       ↓
FrameSizeCalculator extends CallGraphBuilder (frame sizes)
       ↓
ZpAllocator extends FrameSizeCalculator (zero page)
       ↓
FrameAllocator extends ZpAllocator (final class)
```

### 1.2 File Structure

```
packages/compiler-v2/src/frame/
├── allocator/
│   ├── base.ts              # BaseAllocator
│   ├── call-graph-builder.ts # CallGraphBuilder
│   ├── frame-calculator.ts   # FrameSizeCalculator
│   ├── zp-allocator.ts       # ZpAllocator
│   ├── frame-allocator.ts    # FrameAllocator (final)
│   └── index.ts              # Exports
├── types.ts                  # Type definitions (from 01a-01g)
├── call-graph.ts             # Call graph types
├── platform.ts               # Platform configs
├── config.ts                 # Allocator config
└── index.ts                  # Module exports
```

---

## 2. BaseAllocator Class

### 2.1 Purpose

Foundation layer providing:
- Diagnostic collection
- Error handling utilities
- Configuration management
- Platform-specific utilities

### 2.2 Class Definition

```typescript
/**
 * Base class for the frame allocator inheritance chain.
 * Provides common utilities for error handling, diagnostics,
 * and configuration management.
 * 
 * @internal This class should not be instantiated directly.
 */
abstract class BaseAllocator {
  /** Allocator configuration */
  protected readonly config: FrameAllocatorConfig;
  
  /** Platform configuration (derived from config) */
  protected readonly platform: PlatformConfig;
  
  /** Collected diagnostics */
  protected readonly diagnostics: AllocationDiagnostic[];
  
  /** Has any error occurred? */
  protected hasErrors: boolean;
  
  /**
   * Create a new BaseAllocator.
   * @param config Allocator configuration
   */
  constructor(config: FrameAllocatorConfig) {
    this.config = config;
    this.platform = config.platform;
    this.diagnostics = [];
    this.hasErrors = false;
  }
  
  // --- Diagnostic Methods ---
  
  /**
   * Add an error diagnostic.
   * Sets hasErrors flag to true.
   */
  protected addError(
    code: string,
    message: string,
    details?: Partial<AllocationDiagnostic>
  ): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Error,
      code,
      message,
      ...details,
    });
    this.hasErrors = true;
  }
  
  /**
   * Add a warning diagnostic.
   */
  protected addWarning(
    code: string,
    message: string,
    details?: Partial<AllocationDiagnostic>
  ): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Warning,
      code,
      message,
      ...details,
    });
  }
  
  /**
   * Add an info diagnostic.
   */
  protected addInfo(
    code: string,
    message: string,
    details?: Partial<AllocationDiagnostic>
  ): void {
    this.diagnostics.push({
      severity: DiagnosticSeverity.Info,
      code,
      message,
      ...details,
    });
  }
  
  // --- Utility Methods ---
  
  /**
   * Get type size in bytes.
   * @param type TypeInfo from semantic analyzer
   * @returns Size in bytes
   */
  protected getTypeSize(type: TypeInfo): number {
    // Base types
    switch (type.kind) {
      case TypeKind.Byte:
      case TypeKind.Bool:
        return 1;
      case TypeKind.Word:
        return 2;
      case TypeKind.Void:
        return 0;
    }
    
    // Array types
    if (type.isArray && type.arraySize !== undefined) {
      const elementSize = this.getTypeSize(type.elementType!);
      return type.arraySize * elementSize;
    }
    
    // Default fallback
    this.addWarning(
      DiagnosticCodes.UNKNOWN_TYPE_SIZE,
      `Unknown type size for '${type.name}', defaulting to 1 byte`,
    );
    return 1;
  }
  
  /**
   * Format address as hex string.
   */
  protected formatAddress(addr: number): string {
    return `$${addr.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  
  /**
   * Check if address is in zero page range.
   */
  protected isZpAddress(addr: number): boolean {
    return addr >= 0x00 && addr <= 0xFF;
  }
  
  /**
   * Get all diagnostics.
   */
  getDiagnostics(): readonly AllocationDiagnostic[] {
    return this.diagnostics;
  }
  
  /**
   * Check if any errors occurred.
   */
  hasAllocationErrors(): boolean {
    return this.hasErrors;
  }
}
```

---

## 3. CallGraphBuilder Class

### 3.1 Purpose

Builds the call graph from AST, enabling:
- Recursion detection
- Thread context analysis
- Frame coalescing analysis

### 3.2 Class Definition

```typescript
/**
 * Builds the function call graph from the AST.
 * Enables recursion detection and frame coalescing analysis.
 * 
 * @internal Part of allocator inheritance chain.
 */
abstract class CallGraphBuilder extends BaseAllocator {
  /** The constructed call graph */
  protected callGraph: CallGraph | null;
  
  constructor(config: FrameAllocatorConfig) {
    super(config);
    this.callGraph = null;
  }
  
  // --- Public API ---
  
  /**
   * Build call graph from a program AST.
   * @param program The parsed and type-checked program
   */
  buildCallGraph(program: Program): void {
    // Implementation in 02d-call-graph-analysis.md
  }
  
  /**
   * Detect recursion in the call graph.
   * Adds errors for recursive functions.
   * @returns Array of recursive cycles found
   */
  detectRecursion(): Set<string>[] {
    // Implementation in 02d-call-graph-analysis.md
  }
  
  /**
   * Get the call graph (must call buildCallGraph first).
   */
  getCallGraph(): CallGraph {
    if (!this.callGraph) {
      throw new Error('Call graph not built. Call buildCallGraph() first.');
    }
    return this.callGraph;
  }
  
  // --- Protected Helpers ---
  
  /**
   * Check if two functions can have overlapping execution.
   * Used for coalescing decisions.
   */
  protected canOverlap(func1: string, func2: string): boolean {
    // Implementation in 02d-call-graph-analysis.md
  }
  
  /**
   * Get thread context for a function.
   */
  protected getThreadContext(funcName: string): ThreadContext {
    // Implementation in 02d-call-graph-analysis.md
  }
}
```

---

## 4. FrameSizeCalculator Class

### 4.1 Purpose

Calculates frame sizes for each function:
- Parameter slots
- Return value slot
- Local variable slots
- Total frame size

### 4.2 Class Definition

```typescript
/**
 * Calculates frame sizes for all functions.
 * 
 * @internal Part of allocator inheritance chain.
 */
abstract class FrameSizeCalculator extends CallGraphBuilder {
  /** Frame shells (sizes without addresses) */
  protected frameShells: Map<string, FrameShell>;
  
  constructor(config: FrameAllocatorConfig) {
    super(config);
    this.frameShells = new Map();
  }
  
  // --- Public API ---
  
  /**
   * Calculate frame sizes for all functions in the program.
   * @param program The parsed and type-checked program
   */
  calculateFrameSizes(program: Program): void {
    // Implementation in 02b-allocation-method.md
  }
  
  /**
   * Get frame shell for a function.
   */
  getFrameShell(funcName: string): FrameShell | undefined {
    return this.frameShells.get(funcName);
  }
  
  // --- Protected Helpers ---
  
  /**
   * Calculate size for a single function.
   */
  protected calculateFunctionSize(func: FunctionDeclaration): FrameShell {
    // Implementation in 02b-allocation-method.md
  }
  
  /**
   * Extract ZP directive from a variable declaration.
   */
  protected extractZpDirective(decl: VariableDeclaration): ZpDirective {
    // Implementation in 02c-zp-scoring.md
  }
}

/**
 * Frame shell - frame with sizes but no addresses yet.
 */
interface FrameShell {
  functionName: string;
  totalSize: number;
  slots: SlotInfo[];
  isRecursive: boolean;
  threadContext: ThreadContext;
}

/**
 * Slot info during size calculation.
 */
interface SlotInfo {
  name: string;
  kind: SlotKind;
  size: number;
  type: TypeInfo;
  zpDirective: ZpDirective;
}
```

---

## 5. ZpAllocator Class

### 5.1 Purpose

Allocates zero page addresses to high-priority variables:
- Score-based allocation (hotness detection)
- User directive handling (@zp, @ram)
- Platform-aware ZP region management

### 5.2 Class Definition

```typescript
/**
 * Allocates zero page addresses to hot variables.
 * 
 * @internal Part of allocator inheritance chain.
 */
abstract class ZpAllocator extends FrameSizeCalculator {
  /** ZP address pool */
  protected zpPool: ZpPool;
  
  /** ZP allocation results */
  protected zpAllocations: Map<string, Map<string, number>>;
  
  constructor(config: FrameAllocatorConfig) {
    super(config);
    this.zpPool = new ZpPool(config.platform);
    this.zpAllocations = new Map();
  }
  
  // --- Public API ---
  
  /**
   * Allocate zero page addresses to eligible slots.
   * @param accessAnalysis Variable access information from semantic analysis
   */
  allocateZeroPage(accessAnalysis: Map<string, Map<string, SlotAccessInfo>>): void {
    // Implementation in 02c-zp-scoring.md
  }
  
  /**
   * Get ZP allocation for a slot.
   */
  getZpAllocation(funcName: string, slotName: string): number | undefined {
    return this.zpAllocations.get(funcName)?.get(slotName);
  }
  
  // --- Protected Helpers ---
  
  /**
   * Calculate ZP priority score for a slot.
   */
  protected calculateZpScore(
    slot: SlotInfo,
    accessInfo: SlotAccessInfo
  ): number {
    // Implementation in 02c-zp-scoring.md
  }
}

/**
 * ZP address pool manager.
 */
class ZpPool {
  protected available: number[];
  protected allocated: Map<number, { func: string; slot: string }>;
  protected platform: PlatformConfig;
  
  constructor(platform: PlatformConfig) {
    this.platform = platform;
    this.available = [];
    this.allocated = new Map();
    this.initialize();
  }
  
  /**
   * Initialize pool with available ZP addresses.
   */
  protected initialize(): void {
    for (let addr = this.platform.zpStart; addr < this.platform.zpEnd; addr++) {
      if (!this.platform.zpReserved.includes(addr)) {
        this.available.push(addr);
      }
    }
  }
  
  /**
   * Allocate contiguous bytes from pool.
   * @param size Number of bytes needed
   * @returns Starting address or null if no space
   */
  allocate(size: number): number | null {
    // Find first contiguous block
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
        this.available.splice(i, size);
        return startAddr;
      }
    }
    
    return null;
  }
  
  /**
   * Get remaining available bytes.
   */
  get remainingBytes(): number {
    return this.available.length;
  }
}
```

---

## 6. FrameAllocator Class (Final)

### 6.1 Purpose

The final concrete class that:
- Orchestrates the full allocation pipeline
- Performs frame coalescing
- Assigns final addresses
- Produces the FrameMap result

### 6.2 Class Definition

```typescript
/**
 * Static Frame Allocator for Blend65 Compiler v2.
 * 
 * Implements the full SFA pipeline:
 * 1. Build call graph
 * 2. Detect recursion
 * 3. Calculate frame sizes
 * 4. Allocate zero page
 * 5. Coalesce frames
 * 6. Assign addresses
 * 
 * @example
 * ```typescript
 * const allocator = new FrameAllocator(config);
 * const result = allocator.allocate(program, accessAnalysis);
 * if (result.hasErrors) {
 *   // Handle errors
 * }
 * const frameMap = result.frameMap;
 * ```
 */
class FrameAllocator extends ZpAllocator {
  /** Final allocated frames */
  protected frames: Map<string, Frame>;
  
  /** Coalesce groups */
  protected coalesceGroups: CoalesceGroup[];
  
  constructor(config: FrameAllocatorConfig = DEFAULT_ALLOCATOR_CONFIG) {
    super(config);
    this.frames = new Map();
    this.coalesceGroups = [];
  }
  
  // --- Main Entry Point ---
  
  /**
   * Run the full allocation pipeline.
   * 
   * @param program The parsed and type-checked program
   * @param accessAnalysis Variable access analysis from semantic phase
   * @returns Allocation result with frames and diagnostics
   */
  allocate(
    program: Program,
    accessAnalysis: Map<string, Map<string, SlotAccessInfo>>
  ): AllocationResult {
    // Phase 1: Build call graph
    this.buildCallGraph(program);
    
    // Phase 2: Detect recursion (error if found)
    const cycles = this.detectRecursion();
    if (cycles.length > 0 && !this.config.allowRecursion) {
      // Errors already added by detectRecursion
      return this.buildErrorResult();
    }
    
    // Phase 3: Calculate frame sizes
    this.calculateFrameSizes(program);
    
    // Phase 4: Build coalesce groups
    if (this.config.enableCoalescing) {
      this.buildCoalesceGroups();
    } else {
      this.buildSingletonGroups();
    }
    
    // Phase 5: Assign frame addresses
    this.assignFrameAddresses();
    
    // Phase 6: Allocate zero page
    this.allocateZeroPage(accessAnalysis);
    
    // Phase 7: Build final frame map
    return this.buildResult();
  }
  
  // --- Frame Access ---
  
  /**
   * Get frame for a function.
   */
  getFrame(funcName: string): Frame | undefined {
    return this.frames.get(funcName);
  }
  
  /**
   * Get all frames.
   */
  getAllFrames(): Map<string, Frame> {
    return new Map(this.frames);
  }
  
  // --- Protected Implementation ---
  
  /**
   * Build coalesce groups from call graph.
   */
  protected buildCoalesceGroups(): void {
    // Implementation in 02b-allocation-method.md
  }
  
  /**
   * Build singleton groups (no coalescing).
   */
  protected buildSingletonGroups(): void {
    // Each function is its own group
    let groupId = 0;
    for (const [funcName, shell] of this.frameShells) {
      this.coalesceGroups.push({
        groupId: groupId++,
        members: new Set([funcName]),
        maxFrameSize: shell.totalSize,
        threadContext: shell.threadContext,
        baseAddress: 0,
      });
    }
  }
  
  /**
   * Assign addresses to coalesce groups.
   */
  protected assignFrameAddresses(): void {
    // Implementation in 02b-allocation-method.md
  }
  
  /**
   * Build final result.
   */
  protected buildResult(): AllocationResult {
    // Build frames from shells + addresses + ZP allocations
    for (const group of this.coalesceGroups) {
      for (const funcName of group.members) {
        const shell = this.frameShells.get(funcName)!;
        const frame = this.buildFrame(shell, group);
        this.frames.set(funcName, frame);
      }
    }
    
    // Build statistics
    const stats = this.calculateStats();
    
    return {
      frameMap: createFrameMap(this.frames, stats),
      diagnostics: this.diagnostics,
      hasErrors: this.hasErrors,
    };
  }
  
  /**
   * Build error result (for early exit).
   */
  protected buildErrorResult(): AllocationResult {
    return {
      frameMap: createFrameMap(new Map(), createDefaultStats()),
      diagnostics: this.diagnostics,
      hasErrors: true,
    };
  }
  
  /**
   * Build a Frame from a FrameShell.
   */
  protected buildFrame(shell: FrameShell, group: CoalesceGroup): Frame {
    // Implementation in 02b-allocation-method.md
  }
  
  /**
   * Calculate allocation statistics.
   */
  protected calculateStats(): AllocationStats {
    // Implementation in 02b-allocation-method.md
  }
}
```

---

## 7. Type Definitions

### 7.1 Allocation Result

```typescript
/**
 * Result of frame allocation.
 */
interface AllocationResult {
  /** The allocated frame map */
  frameMap: FrameMap;
  
  /** All diagnostics (errors, warnings, info) */
  diagnostics: readonly AllocationDiagnostic[];
  
  /** Whether any errors occurred */
  hasErrors: boolean;
}
```

### 7.2 Coalesce Group

```typescript
/**
 * A group of functions that share the same frame memory.
 */
interface CoalesceGroup {
  /** Unique group ID */
  groupId: number;
  
  /** Function names in this group */
  members: Set<string>;
  
  /** Maximum frame size among members */
  maxFrameSize: number;
  
  /** Thread context (all members must match) */
  threadContext: ThreadContext;
  
  /** Base address assigned to this group */
  baseAddress: number;
}
```

### 7.3 Slot Access Info

```typescript
/**
 * Access information for a variable slot.
 * Provided by semantic analyzer.
 */
interface SlotAccessInfo {
  /** Number of read accesses */
  readCount: number;
  
  /** Number of write accesses */
  writeCount: number;
  
  /** Maximum loop nesting depth where accessed */
  maxLoopDepth: number;
  
  /** Is this on a hot execution path? */
  isHotPath: boolean;
}
```

---

## 8. Usage Example

```typescript
import { FrameAllocator, AllocatorConfigBuilder } from './frame/index.js';

// Create allocator with custom config
const config = new AllocatorConfigBuilder()
  .forPlatform('c64')
  .enableCoalescing(true)
  .setZpWeight('pointer', 4096)
  .build();

const allocator = new FrameAllocator(config);

// Run allocation
const result = allocator.allocate(program, accessAnalysis);

// Check for errors
if (result.hasErrors) {
  for (const diag of result.diagnostics) {
    if (diag.severity === DiagnosticSeverity.Error) {
      console.error(`${diag.code}: ${diag.message}`);
    }
  }
  throw new Error('Frame allocation failed');
}

// Use frame map
const frameMap = result.frameMap;
for (const [funcName, frame] of frameMap.frames) {
  console.log(`${funcName}: ${frame.totalFrameSize} bytes at ${frame.frameBaseAddress}`);
}
```

---

## Summary

| Class | Layer | Responsibility |
|-------|-------|----------------|
| `BaseAllocator` | Foundation | Utilities, diagnostics, config |
| `CallGraphBuilder` | Analysis | Call graph, recursion detection |
| `FrameSizeCalculator` | Sizing | Frame sizes, slot extraction |
| `ZpAllocator` | ZP | Zero page scoring and allocation |
| `FrameAllocator` | Final | Orchestration, coalescing, results |

---

**Next Document:** [02b-allocation-method.md](02b-allocation-method.md)