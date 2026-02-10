/**
 * Frame Allocator for Static Frame Allocation (SFA)
 *
 * Main orchestrator for the SFA process. Coordinates:
 * - FrameCalculator: Calculate frame sizes from functions
 * - ZpAllocator: Allocate zero page slots
 * - Coalescer: Build coalesce groups (Phase 3)
 *
 * **Allocation Process:**
 * 1. Check for recursion (SFA requires no recursion)
 * 2. Calculate frame sizes for each function
 * 3. Build coalesce groups (Phase 3)
 * 4. Assign frame region addresses
 * 5. Check frame region overflow
 * 6. Allocate ZP
 * 7. Compute stats
 *
 * @module frame/allocator/frame-allocator
 */

import { FunctionDecl, Program } from '../../ast/index.js';
import { isFunctionDecl } from '../../ast/type-guards.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { CallGraph } from '../../semantic/call-graph.js';
import { DiagnosticSeverity, SlotLocation } from '../enums.js';
import { FrameSlot } from '../types.js';
import { PlatformConfig, C64_PLATFORM_CONFIG } from '../platform.js';
import { Frame, FrameCalculator } from './frame-calculator.js';
import { ZpAllocator, ZpAllocationSummary } from './zp-allocator.js';
import type { ZpPool } from './zp-pool.js';
import type { GlobalAllocationResult } from '../types-global.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Diagnostic codes for frame allocation issues.
 *
 * Each code identifies a specific type of allocation problem.
 */
export enum FrameDiagnosticCode {
  /** Direct or indirect recursion detected */
  RECURSION = 'RECURSION',

  /** Frame region overflow (too many/large functions) */
  FRAME_OVERFLOW = 'FRAME_OVERFLOW',

  /** @zp variable couldn't be allocated to zero page */
  ZP_OVERFLOW = 'ZP_OVERFLOW',

  /** Function has no frame (stub/external) */
  NO_FRAME = 'NO_FRAME',
}

/**
 * A diagnostic message from frame allocation.
 *
 * Contains information about allocation issues, including
 * severity, code, message, and optional location info.
 */
export interface FrameDiagnostic {
  /** Diagnostic code for programmatic handling */
  readonly code: FrameDiagnosticCode;

  /** Severity level (error stops compilation) */
  readonly severity: DiagnosticSeverity;

  /** Human-readable error message */
  readonly message: string;

  /** Function name (if applicable) */
  readonly functionName?: string;

  /** Additional context (e.g., cycle path for recursion) */
  readonly context?: string[];
}

/**
 * Statistics about frame allocation.
 *
 * Provides metrics for understanding memory usage and
 * allocation efficiency.
 */
export interface FrameAllocationStats {
  /** Total functions processed */
  readonly functionCount: number;

  /** Functions with frames (non-stub) */
  readonly framesAllocated: number;

  /** Total frame region bytes used */
  readonly frameRegionBytesUsed: number;

  /** Total frame region bytes available */
  readonly frameRegionBytesAvailable: number;

  /** Frame region utilization percentage */
  readonly frameRegionUtilization: number;

  /** Total ZP bytes used */
  readonly zpBytesUsed: number;

  /** Total ZP bytes available */
  readonly zpBytesAvailable: number;

  /** ZP utilization percentage */
  readonly zpUtilization: number;

  /** Number of slots in ZP */
  readonly zpSlotCount: number;

  /** Number of slots in frame region */
  readonly frameSlotCount: number;

  /** Total slots across all frames */
  readonly totalSlotCount: number;

  /** Bytes saved by coalescing (0 until Phase 3) */
  readonly coalesceBytesSaved: number;

  /** Number of coalesce groups (0 until Phase 3) */
  readonly coalesceGroupCount: number;
}

/**
 * Result of frame allocation.
 *
 * Contains the frame map, statistics, diagnostics, and
 * overall success status.
 */
export interface FrameAllocationResult {
  /** Map from function name to Frame */
  readonly frameMap: Map<string, Frame>;

  /** Allocation statistics */
  readonly stats: FrameAllocationStats;

  /** Diagnostic messages (errors, warnings, info) */
  readonly diagnostics: readonly FrameDiagnostic[];

  /** Whether allocation succeeded (no errors) */
  readonly success: boolean;

  /** ZP allocation summary (if ZP allocation was performed) */
  readonly zpAllocationSummary?: ZpAllocationSummary;

  /**
   * Global variable allocation result (if global allocation was performed).
   *
   * Contains the map of all module-level variables with their assigned addresses,
   * the shared ZP pool, and data/RAM segment sizes.
   * This is set by FramePhase when it runs GlobalAllocator before function-local SFA.
   * Downstream phases (IL, codegen) use this to resolve global variable references.
   */
  readonly globalAllocation?: GlobalAllocationResult;
}

// ============================================================================
// Frame Allocator
// ============================================================================

/**
 * Frame Allocator - Main orchestrator for Static Frame Allocation.
 *
 * Coordinates the entire SFA process:
 * 1. Recursion detection (SFA requirement)
 * 2. Frame size calculation
 * 3. Coalescing (Phase 3)
 * 4. Frame region address assignment
 * 5. ZP allocation
 *
 * **Usage:**
 * ```typescript
 * const allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
 * const result = allocator.allocate(program, callGraph, symbolTable);
 *
 * if (!result.success) {
 *   for (const diag of result.diagnostics) {
 *     console.error(`${diag.severity}: ${diag.message}`);
 *   }
 * } else {
 *   console.log(`Allocated ${result.stats.framesAllocated} frames`);
 *   console.log(`ZP usage: ${result.stats.zpUtilization.toFixed(1)}%`);
 * }
 * ```
 */
export class FrameAllocator {
  // ========================================
  // Protected Fields
  // ========================================

  /** Platform configuration */
  protected readonly config: PlatformConfig;

  /** Frame size calculator */
  protected readonly calculator: FrameCalculator;

  /** Zero page allocator */
  protected readonly zpAllocator: ZpAllocator;

  /**
   * Whether the ZP pool was shared from an external source (e.g., GlobalAllocator).
   * When true, the pool already has global @zp variables allocated and must NOT
   * be reset before function-local allocation.
   */
  protected readonly usesSharedZpPool: boolean;

  // ========================================
  // Constructor
  // ========================================

  /**
   * Create a new Frame Allocator.
   *
   * When a `zpPool` is provided (from GlobalAllocator), it is used for ZP
   * allocation instead of creating a fresh pool. This enables ZP pool sharing
   * between global and function-local allocation — globals are allocated first,
   * and the remaining ZP space is available for function-local variables.
   *
   * @param config - Platform configuration (default: C64)
   * @param symbolTable - Optional symbol table for frame calculator
   * @param zpPool - Optional pre-used ZP pool (e.g., from GlobalAllocator with @zp globals already allocated)
   *
   * @example
   * ```typescript
   * // Standard usage (fresh ZP pool)
   * const allocator = new FrameAllocator(C64_PLATFORM_CONFIG);
   *
   * // With shared ZP pool from GlobalAllocator
   * const globalResult = globalAllocator.allocate(programs);
   * const allocator = new FrameAllocator(config, symbolTable, globalResult.zpPool);
   * ```
   */
  constructor(config: PlatformConfig = C64_PLATFORM_CONFIG, symbolTable?: SymbolTable, zpPool?: ZpPool) {
    this.config = config;
    this.calculator = new FrameCalculator(symbolTable ?? new SymbolTable());

    // If a pre-used ZP pool is provided (e.g., from GlobalAllocator),
    // use it to ensure function-local allocations don't conflict with global @zp variables
    if (zpPool) {
      this.zpAllocator = new ZpAllocator(zpPool);
      this.usesSharedZpPool = true;
    } else {
      this.zpAllocator = new ZpAllocator(config);
      this.usesSharedZpPool = false;
    }
  }

  // ========================================
  // Main Allocation Method
  // ========================================

  /**
   * Allocate frames for all functions in a program.
   *
   * Performs the complete SFA process:
   * 1. Check for recursion (error if found)
   * 2. Calculate frame sizes
   * 3. Assign frame region addresses
   * 4. Check for overflow
   * 5. Allocate ZP
   * 6. Compute statistics
   *
   * @param program - The program AST
   * @param callGraph - Call graph for recursion detection
   * @param symbolTable - Symbol table for type resolution
   * @returns Allocation result with frameMap, stats, diagnostics
   *
   * @example
   * ```typescript
   * const result = allocator.allocate(program, callGraph, symbolTable);
   *
   * if (result.success) {
   *   for (const [funcName, frame] of result.frameMap) {
   *     console.log(`${funcName}: base=$${frame.baseAddress.toString(16)}`);
   *   }
   * }
   * ```
   */
  public allocate(
    program: Program,
    callGraph: CallGraph,
    _symbolTable: SymbolTable
  ): FrameAllocationResult {
    // Delegate to multi-program method with a single program
    return this.allocateMultiplePrograms([program], callGraph, _symbolTable);
  }

  /**
   * Allocate frames for functions across multiple programs (modules).
   *
   * Collects functions from ALL provided program ASTs and performs
   * the complete SFA process for all of them together. This ensures
   * functions defined in imported modules also receive frame allocations.
   *
   * **Why this is needed:**
   * In multi-module compilation, functions may be defined in different
   * modules. The IL generator needs frame allocations for ALL functions,
   * not just the primary module's. Without this, cross-module function
   * calls fail with "No frame for function" errors.
   *
   * @param programs - Array of program ASTs (from all modules)
   * @param callGraph - Call graph for recursion detection
   * @param symbolTable - Symbol table for type resolution
   * @returns Allocation result with frameMap, stats, diagnostics
   *
   * @example
   * ```typescript
   * const result = allocator.allocateMultiplePrograms(
   *   [primaryAst, utilsAst],
   *   primaryCallGraph,
   *   primarySymbolTable
   * );
   * ```
   */
  public allocateMultiplePrograms(
    programs: Program[],
    callGraph: CallGraph,
    _symbolTable: SymbolTable
  ): FrameAllocationResult {
    const diagnostics: FrameDiagnostic[] = [];
    const frameMap = new Map<string, Frame>();

    // Step 1: Check for recursion
    const recursionDiagnostics = this.checkRecursion(callGraph);
    diagnostics.push(...recursionDiagnostics);

    // If recursion detected, return early with error
    if (recursionDiagnostics.length > 0) {
      return {
        frameMap,
        stats: this.createEmptyStats(),
        diagnostics,
        success: false,
      };
    }

    // Step 2: Collect all functions from ALL programs (all modules)
    const functions: FunctionDecl[] = [];
    for (const program of programs) {
      functions.push(...this.collectFunctions(program));
    }

    // Step 3: Calculate frame sizes for each function
    for (const func of functions) {
      // Skip stub functions (no body = no frame)
      if (func.isStubFunction()) {
        continue;
      }

      const frame = this.calculator.calculateFrame(func);
      frameMap.set(func.getName(), frame);
    }

    // Step 4: Assign frame region addresses (basic - no coalescing yet)
    const overflowDiagnostics = this.assignFrameAddresses(frameMap);
    diagnostics.push(...overflowDiagnostics);

    // If overflow, return with error
    if (overflowDiagnostics.length > 0) {
      const stats = this.computeStats(frameMap, null);
      return {
        frameMap,
        stats,
        diagnostics,
        success: false,
      };
    }

    // Step 5: Allocate ZP for all slots
    // Only reset if NOT using a shared ZP pool (from GlobalAllocator).
    // When shared, the pool already has global @zp variables allocated
    // and resetting would erase those allocations.
    if (!this.usesSharedZpPool) {
      this.zpAllocator.reset();
    }
    const allSlots = this.collectAllSlots(frameMap);
    const zpSummary = this.zpAllocator.allocate(allSlots);

    // Add ZP overflow errors as diagnostics
    for (const error of zpSummary.errors) {
      diagnostics.push({
        code: FrameDiagnosticCode.ZP_OVERFLOW,
        severity: DiagnosticSeverity.Error,
        message: error.message,
        functionName: this.findFunctionForSlot(error.slot, frameMap),
      });
    }

    // Step 6: Compute final statistics
    const stats = this.computeStats(frameMap, zpSummary);

    return {
      frameMap,
      stats,
      diagnostics,
      success: diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length === 0,
      zpAllocationSummary: zpSummary,
    };
  }

  // ========================================
  // Recursion Detection
  // ========================================

  /**
   * Check for recursion in the call graph.
   *
   * SFA requires no recursion because function frames are
   * statically allocated and cannot be re-entered.
   *
   * @param callGraph - Call graph to check
   * @returns Array of diagnostics for any detected cycles
   */
  public checkRecursion(callGraph: CallGraph): FrameDiagnostic[] {
    const diagnostics: FrameDiagnostic[] = [];

    // Detect all cycles (direct and indirect)
    const cycles = callGraph.detectAllCycles();

    for (const cycle of cycles) {
      // Format cycle path for error message
      const cyclePath = cycle.join(' → ');
      const isDirectRecursion = cycle.length === 2 && cycle[0] === cycle[1];

      diagnostics.push({
        code: FrameDiagnosticCode.RECURSION,
        severity: DiagnosticSeverity.Error,
        message: isDirectRecursion
          ? `Direct recursion detected: function "${cycle[0]}" calls itself. ` +
            `SFA requires no recursion - function frames are statically allocated.`
          : `Indirect recursion detected: ${cyclePath}. ` +
            `SFA requires no recursion - function frames are statically allocated.`,
        functionName: cycle[0],
        context: cycle,
      });
    }

    return diagnostics;
  }

  // ========================================
  // Frame Address Assignment
  // ========================================

  /**
   * Assign frame region addresses to all frames.
   *
   * Basic allocation (no coalescing): Each frame gets its own
   * contiguous block in the frame region.
   *
   * @param frameMap - Map of function name to Frame
   * @returns Array of overflow diagnostics (if any)
   */
  protected assignFrameAddresses(frameMap: Map<string, Frame>): FrameDiagnostic[] {
    const diagnostics: FrameDiagnostic[] = [];

    let nextAddress = this.config.frameRegionStart;

    // Sort frames for deterministic allocation (alphabetical)
    const sortedFrames = Array.from(frameMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );

    for (const [_funcName, frame] of sortedFrames) {
      // Assign base address
      frame.baseAddress = nextAddress;

      // Update slot offsets to absolute addresses
      for (const slot of frame.slots) {
        // Slots in frame region get absolute address
        // (ZP slots will be updated by ZpAllocator)
        if (slot.location === SlotLocation.FrameRegion) {
          slot.address = frame.baseAddress + slot.offset;
        }
      }

      // Move to next frame
      nextAddress += frame.totalSize;
    }

    // Check for overflow
    if (nextAddress > this.config.frameRegionEnd) {
      const usedBytes = nextAddress - this.config.frameRegionStart;
      const availableBytes = this.config.frameRegionSize;

      diagnostics.push({
        code: FrameDiagnosticCode.FRAME_OVERFLOW,
        severity: DiagnosticSeverity.Error,
        message: `Frame region overflow: ${usedBytes} bytes used, ` +
          `${availableBytes} bytes available. ` +
          `Consider reducing function count or variable sizes.`,
      });
    }

    return diagnostics;
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Collect all functions from a program.
   *
   * Walks the program AST to find all function declarations.
   *
   * @param program - Program to collect from
   * @returns Array of function declarations
   */
  protected collectFunctions(program: Program): FunctionDecl[] {
    const functions: FunctionDecl[] = [];

    // Get declarations from program
    const declarations = program.getDeclarations();

    for (const decl of declarations) {
      if (isFunctionDecl(decl)) {
        functions.push(decl);
      }
    }

    return functions;
  }

  /**
   * Collect all slots from all frames.
   *
   * Used for ZP allocation which considers all slots together.
   *
   * @param frameMap - Map of frames
   * @returns Array of all frame slots
   */
  protected collectAllSlots(frameMap: Map<string, Frame>): FrameSlot[] {
    const slots: FrameSlot[] = [];

    for (const frame of frameMap.values()) {
      slots.push(...frame.slots);
    }

    return slots;
  }

  /**
   * Find the function name that contains a slot.
   *
   * Used for error messages.
   *
   * @param slot - Slot to find
   * @param frameMap - Map of frames to search
   * @returns Function name, or undefined if not found
   */
  protected findFunctionForSlot(
    slot: FrameSlot,
    frameMap: Map<string, Frame>
  ): string | undefined {
    for (const [funcName, frame] of frameMap) {
      if (frame.slots.includes(slot)) {
        return funcName;
      }
    }
    return undefined;
  }

  // ========================================
  // Statistics
  // ========================================

  /**
   * Compute allocation statistics.
   *
   * @param frameMap - Map of allocated frames
   * @param zpSummary - ZP allocation summary (if available)
   * @returns Allocation statistics
   */
  protected computeStats(
    frameMap: Map<string, Frame>,
    zpSummary: ZpAllocationSummary | null
  ): FrameAllocationStats {
    let frameRegionBytesUsed = 0;
    let totalSlotCount = 0;
    let frameSlotCount = 0;
    let zpSlotCount = 0;

    for (const frame of frameMap.values()) {
      frameRegionBytesUsed += frame.totalSize;
      totalSlotCount += frame.slots.length;

      for (const slot of frame.slots) {
        if (slot.location === SlotLocation.ZeroPage) {
          zpSlotCount++;
        } else {
          frameSlotCount++;
        }
      }
    }

    const frameRegionBytesAvailable = this.config.frameRegionSize;
    const frameRegionUtilization = frameRegionBytesAvailable > 0
      ? (frameRegionBytesUsed / frameRegionBytesAvailable) * 100
      : 0;

    const zpBytesUsed = zpSummary?.zpBytesUsed ?? 0;
    const zpBytesAvailable = this.config.zpAvailable;
    const zpUtilization = zpBytesAvailable > 0
      ? (zpBytesUsed / zpBytesAvailable) * 100
      : 0;

    return {
      functionCount: frameMap.size,
      framesAllocated: frameMap.size,
      frameRegionBytesUsed,
      frameRegionBytesAvailable,
      frameRegionUtilization,
      zpBytesUsed,
      zpBytesAvailable,
      zpUtilization,
      zpSlotCount: zpSummary?.zpAllocatedCount ?? zpSlotCount,
      frameSlotCount: zpSummary?.frameAllocatedCount ?? frameSlotCount,
      totalSlotCount,
      coalesceBytesSaved: 0, // Phase 3
      coalesceGroupCount: 0, // Phase 3
    };
  }

  /**
   * Create empty stats for error cases.
   */
  protected createEmptyStats(): FrameAllocationStats {
    return {
      functionCount: 0,
      framesAllocated: 0,
      frameRegionBytesUsed: 0,
      frameRegionBytesAvailable: this.config.frameRegionSize,
      frameRegionUtilization: 0,
      zpBytesUsed: 0,
      zpBytesAvailable: this.config.zpAvailable,
      zpUtilization: 0,
      zpSlotCount: 0,
      frameSlotCount: 0,
      totalSlotCount: 0,
      coalesceBytesSaved: 0,
      coalesceGroupCount: 0,
    };
  }

  // ========================================
  // Accessors
  // ========================================

  /**
   * Get the platform configuration.
   */
  getConfig(): PlatformConfig {
    return this.config;
  }

  /**
   * Get the frame calculator.
   */
  getCalculator(): FrameCalculator {
    return this.calculator;
  }

  /**
   * Get the ZP allocator.
   */
  getZpAllocator(): ZpAllocator {
    return this.zpAllocator;
  }

  /**
   * Reset the allocator state.
   *
   * Clears ZP allocator for reuse.
   */
  reset(): void {
    this.zpAllocator.reset();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a frame allocator for a platform.
 *
 * @param config - Platform configuration
 * @param symbolTable - Optional symbol table
 * @returns New FrameAllocator instance
 *
 * @example
 * ```typescript
 * const allocator = createFrameAllocator(C64_PLATFORM_CONFIG);
 * ```
 */
export function createFrameAllocator(
  config: PlatformConfig = C64_PLATFORM_CONFIG,
  symbolTable?: SymbolTable
): FrameAllocator {
  return new FrameAllocator(config, symbolTable);
}

/**
 * Create empty allocation stats.
 *
 * Useful for creating default/error state stats.
 *
 * @param config - Platform configuration (for available bytes)
 * @returns Empty stats with platform capacities
 */
export function createEmptyAllocationStats(config: PlatformConfig): FrameAllocationStats {
  return {
    functionCount: 0,
    framesAllocated: 0,
    frameRegionBytesUsed: 0,
    frameRegionBytesAvailable: config.frameRegionSize,
    frameRegionUtilization: 0,
    zpBytesUsed: 0,
    zpBytesAvailable: config.zpAvailable,
    zpUtilization: 0,
    zpSlotCount: 0,
    frameSlotCount: 0,
    totalSlotCount: 0,
    coalesceBytesSaved: 0,
    coalesceGroupCount: 0,
  };
}