/**
 * Global Variable Allocation Types
 *
 * Type definitions for the global variable allocation system.
 * These types support module-level variable allocation with
 * storage classes (@zp, @ram, @data, default).
 *
 * **GlobalSlot**: Represents a single module-level variable with
 * its storage class, type, size, and assigned address.
 *
 * **GlobalAllocationResult**: Contains the complete result of
 * global allocation, including all assigned slots, the ZP pool
 * state (for sharing with function-local SFA), and diagnostics.
 *
 * @module frame/types-global
 */

import type { Expression } from '../ast/base.js';
import type { TypeInfo } from '../semantic/types.js';
import type { ZpPool } from './allocator/zp-pool.js';
import { DiagnosticSeverity } from './enums.js';

// ============================================================================
// Storage Class Type
// ============================================================================

/**
 * Storage class for a global variable.
 *
 * Determines where the variable is allocated in memory:
 * - 'zp': Zero page — fast 2-byte instructions, limited space
 * - 'ram': Global RAM region — normal 3-byte instructions
 * - 'data': Data segment — read-only initialized constants
 * - 'default': Compiler decides (typically global RAM region)
 */
export type GlobalStorageClass = 'zp' | 'ram' | 'data' | 'default';

// ============================================================================
// Global Slot
// ============================================================================

/**
 * Represents a single module-level variable with its allocation info.
 *
 * A GlobalSlot is created for every module-level variable declaration.
 * The GlobalAllocator assigns addresses based on the storage class:
 * - @zp → ZP pool address ($02-$8F)
 * - @ram → Global RAM region address (after code segment)
 * - @data → Data segment address (after global RAM)
 * - default → Global RAM region address
 *
 * @example
 * ```typescript
 * // For: @zp let score: byte = 0;
 * const slot: GlobalSlot = {
 *   name: 'score',
 *   qualifiedName: 'Game.score',
 *   moduleName: 'Game',
 *   storageClass: 'zp',
 *   type: BUILTIN_TYPES.BYTE,
 *   size: 1,
 *   address: 0x02,
 *   isExported: false,
 *   isConst: false,
 *   initializer: literalExpr,
 * };
 * ```
 */
export interface GlobalSlot {
  /** Variable name (local to module) */
  readonly name: string;

  /**
   * Fully qualified name (moduleName.variableName).
   * Used as the key in the globals map to avoid cross-module collisions.
   */
  readonly qualifiedName: string;

  /** Name of the module this variable belongs to */
  readonly moduleName: string;

  /** Storage class determining allocation strategy */
  readonly storageClass: GlobalStorageClass;

  /** Type information from semantic analysis */
  readonly type: TypeInfo;

  /** Size in bytes (determined from type) */
  readonly size: number;

  /**
   * Assigned absolute memory address.
   * Set by the GlobalAllocator during allocation.
   * 0 before allocation.
   */
  address: number;

  /** Whether the variable is exported from its module */
  readonly isExported: boolean;

  /** Whether the variable is declared as const */
  readonly isConst: boolean;

  /**
   * Initializer expression (if present).
   * Required for @data variables (compile-time constant).
   * Optional for @zp/@ram/default variables (runtime init).
   */
  readonly initializer?: Expression;
}

// ============================================================================
// Global Allocation Result
// ============================================================================

/**
 * Result of global variable allocation.
 *
 * Contains everything downstream phases need:
 * - globals: Map of all allocated global slots (qualifiedName → slot)
 * - zpPool: The ZP pool with globals already allocated (pass to SFA)
 * - dataSegmentSize: Total bytes needed for data segment
 * - ramRegionSize: Total bytes needed for global RAM
 * - diagnostics: Any errors or warnings from allocation
 *
 * @example
 * ```typescript
 * const result = globalAllocator.allocate(allPrograms);
 *
 * if (result.success) {
 *   // Pass zpPool to function-local allocator
 *   frameAllocator.allocateWithPool(programs, callGraph, result.zpPool);
 *
 *   // Use globals map in IL generator
 *   ilGenerator.setGlobalSlots(result.globals);
 * }
 * ```
 */
export interface GlobalAllocationResult {
  /** Whether allocation completed without errors */
  success: boolean;

  /**
   * Map of all allocated global slots.
   * Key is the qualified name (e.g., "Game.score").
   */
  globals: Map<string, GlobalSlot>;

  /**
   * ZP pool with global @zp variables already allocated.
   * Pass this to the function-local SFA allocator so local
   * variables don't conflict with global ZP addresses.
   */
  zpPool: ZpPool;

  /** Total size of the data segment in bytes */
  dataSegmentSize: number;

  /** Total size of the global RAM region in bytes */
  ramRegionSize: number;

  /** Diagnostics collected during allocation */
  diagnostics: GlobalAllocationDiagnostic[];
}

// ============================================================================
// Global Allocation Diagnostic
// ============================================================================

/**
 * Diagnostic message from global allocation.
 *
 * Reports errors (ZP overflow, invalid @data usage) and
 * informational messages (allocation stats).
 *
 * @example
 * ```typescript
 * const diagnostic: GlobalAllocationDiagnostic = {
 *   severity: DiagnosticSeverity.Error,
 *   message: '@zp variable "score" cannot fit in zero page: need 2 bytes, 0 available',
 *   variableName: 'score',
 *   moduleName: 'Game',
 * };
 * ```
 */
export interface GlobalAllocationDiagnostic {
  /** Severity level of the diagnostic */
  severity: DiagnosticSeverity;

  /** Human-readable diagnostic message */
  message: string;

  /** Name of the variable that caused the diagnostic (if applicable) */
  variableName?: string;

  /** Name of the module containing the variable (if applicable) */
  moduleName?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a new GlobalSlot with sensible defaults.
 *
 * Address is set to 0 (to be assigned by the allocator).
 *
 * @param name - Variable name
 * @param moduleName - Module name
 * @param storageClass - Storage class
 * @param type - Type information
 * @param size - Size in bytes
 * @param options - Optional overrides for isExported, isConst, initializer
 * @returns A new GlobalSlot
 *
 * @example
 * ```typescript
 * const slot = createGlobalSlot('score', 'Game', 'zp', BUILTIN_TYPES.BYTE, 1, {
 *   isExported: true,
 * });
 * ```
 */
export function createGlobalSlot(
  name: string,
  moduleName: string,
  storageClass: GlobalStorageClass,
  type: TypeInfo,
  size: number,
  options?: {
    isExported?: boolean;
    isConst?: boolean;
    initializer?: Expression;
  },
): GlobalSlot {
  return {
    name,
    qualifiedName: `${moduleName}.${name}`,
    moduleName,
    storageClass,
    type,
    size,
    address: 0,
    isExported: options?.isExported ?? false,
    isConst: options?.isConst ?? false,
    initializer: options?.initializer,
  };
}

/**
 * Creates an empty GlobalAllocationResult.
 *
 * Used as the starting point before allocation, or as a fallback
 * when there are no global variables to allocate.
 *
 * @param zpPool - The ZP pool instance (unmodified)
 * @returns An empty result with success=true and no globals
 *
 * @example
 * ```typescript
 * // No globals to allocate
 * const result = createEmptyGlobalAllocationResult(zpPool);
 * // result.globals is empty, result.success is true
 * ```
 */
export function createEmptyGlobalAllocationResult(
  zpPool: ZpPool,
): GlobalAllocationResult {
  return {
    success: true,
    globals: new Map(),
    zpPool,
    dataSegmentSize: 0,
    ramRegionSize: 0,
    diagnostics: [],
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Checks if a global slot is allocated to zero page.
 *
 * @param slot - GlobalSlot to check
 * @returns true if storageClass is 'zp'
 */
export function isZpGlobal(slot: GlobalSlot): boolean {
  return slot.storageClass === 'zp';
}

/**
 * Checks if a global slot is allocated to RAM.
 *
 * @param slot - GlobalSlot to check
 * @returns true if storageClass is 'ram' or 'default'
 */
export function isRamGlobal(slot: GlobalSlot): boolean {
  return slot.storageClass === 'ram' || slot.storageClass === 'default';
}

/**
 * Checks if a global slot is in the data segment.
 *
 * @param slot - GlobalSlot to check
 * @returns true if storageClass is 'data'
 */
export function isDataGlobal(slot: GlobalSlot): boolean {
  return slot.storageClass === 'data';
}
