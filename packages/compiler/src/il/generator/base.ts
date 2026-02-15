/**
 * IL Generator - Base Layer
 *
 * Foundation class with core infrastructure:
 * - Frame/symbol table management
 * - Variable resolution (both function-local and module-level)
 * - Current function tracking
 * - Loop depth tracking
 *
 * @module il/generator/base
 */

import { SourceLocation } from '../../ast/base.js';
import { Frame } from '../../frame/allocator/frame-calculator.js';
import { FrameSlot, createFrameSlot } from '../../frame/types.js';
import { SlotKind, SlotLocation, ZpDirective } from '../../frame/enums.js';
import type { GlobalSlot, GlobalAllocationResult } from '../../frame/types-global.js';
import { SymbolTable } from '../../semantic/symbol-table.js';
import { SymbolKind } from '../../semantic/symbol.js';
import { TypeKind, BUILTIN_TYPES, TypeInfo } from '../../semantic/types.js';
import { ILBuilder } from '../builder/index.js';
import { ILInstruction } from '../instruction.js';
import { ILLoop } from '../structures.js';

// ============================================================================
// ILGeneratorBase Class
// ============================================================================

/**
 * Base class for IL Generator.
 *
 * Provides core infrastructure:
 * - Frame map from SFA for variable slot lookups
 * - Symbol table for type/scope information
 * - ILBuilder for emitting instructions
 * - Current function and loop tracking
 *
 * Extended by expression and statement generation layers.
 *
 * @example
 * ```typescript
 * const generator = new ILGenerator(frameMap, symbolTable);
 * const ilProgram = generator.generate(program);
 * ```
 */
export class ILGeneratorBase {
  /** IL instruction builder */
  protected builder: ILBuilder;

  /** Frame map from SFA - contains slots for all functions */
  protected frameMap: Map<string, Frame>;

  /** Symbol table for type/scope lookups */
  protected symbolTable: SymbolTable;

  /** Name of the function currently being generated */
  protected currentFunction: string | null = null;

  /** Current loop nesting depth (for optimization hints) */
  protected currentLoopDepth: number = 0;

  /** Detected loops in current function */
  protected loops: ILLoop[] = [];

  /** Maximum loop depth reached in current function */
  protected maxLoopDepth: number = 0;

  /**
   * Global variable slots from the GlobalAllocator.
   *
   * When provided (via GlobalAllocationResult), these slots contain
   * properly allocated addresses for module-level variables.
   * Key is the qualified name (e.g., "Game.score") or simple name.
   *
   * Takes priority over the legacy symbol-table-based module variable resolution.
   */
  protected globalSlots: Map<string, GlobalSlot>;

  /**
   * Cache of FrameSlot conversions from GlobalSlots.
   *
   * Since ILBuilder operates on FrameSlots, we convert GlobalSlots to
   * FrameSlots on first access and cache the result.
   * Key is the simple variable name (for current-module lookups).
   */
  protected globalFrameSlotCache: Map<string, FrameSlot> = new Map();

  /**
   * Cache of module-level variable slots (legacy fallback).
   *
   * Used when no GlobalAllocationResult is provided.
   * Module-level variables are allocated in the frame region after function frames.
   * This cache stores synthetic FrameSlot objects for these variables.
   */
  protected moduleVariableSlots: Map<string, FrameSlot> = new Map();

  /** Next available address for module-level variables (legacy fallback, starts after frame region functions) */
  protected nextModuleVarAddress: number = 0;

  /**
   * Creates an IL generator.
   *
   * @param frameMap - Frame map from SFA (function name → Frame)
   * @param symbolTable - Symbol table from semantic analysis
   * @param globalAllocation - Optional result from GlobalAllocator with allocated global variable addresses
   */
  constructor(
    frameMap: Map<string, Frame>,
    symbolTable: SymbolTable,
    globalAllocation?: GlobalAllocationResult | null,
  ) {
    this.builder = new ILBuilder();
    this.frameMap = frameMap;
    this.symbolTable = symbolTable;

    // Use global slots from the allocator if available, otherwise empty
    this.globalSlots = globalAllocation?.globals ?? new Map();
  }

  // ═══════════════════════════════════════════════════════════════════
  // Variable Resolution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Resolve a variable name to its frame slot.
   *
   * Resolution order:
   * 1. Check current function's local variables (parameters, locals)
   * 2. Check module-level variables (globals)
   *
   * This provides complete SFA context (location, address, ZP status) for code generation.
   *
   * @param name - Variable name to resolve
   * @returns FrameSlot for the variable
   * @throws Error if no current function or variable not found
   *
   * @example
   * ```typescript
   * const slot = this.resolveVariable('counter');
   * // slot contains: name, kind, type, size, location, address, etc.
   * this.builder.loadSlot(slot);
   * ```
   */
  protected resolveVariable(name: string): FrameSlot {
    if (!this.currentFunction) {
      throw new Error(`Cannot resolve variable "${name}": no current function`);
    }

    // First, try function-local variables
    const frame = this.frameMap.get(this.currentFunction);
    if (frame) {
      const localSlot = frame.slots.find((s) => s.name === name);
      if (localSlot) {
        return localSlot;
      }
    }

    // Second, try module-level variables
    const moduleSlot = this.tryResolveModuleVariable(name);
    if (moduleSlot) {
      return moduleSlot;
    }

    throw new Error(
      `Unknown variable "${name}" in function "${this.currentFunction}"`
    );
  }

  /**
   * Try to resolve a variable, returning undefined if not found.
   *
   * Resolution order:
   * 1. Check current function's local variables
   * 2. Check module-level variables
   *
   * Useful for checking if a name refers to a local variable
   * or something else (intrinsic, etc.).
   *
   * @param name - Variable name to resolve
   * @returns FrameSlot or undefined if not found
   */
  protected tryResolveVariable(name: string): FrameSlot | undefined {
    // First, try function-local variables
    if (this.currentFunction) {
      const frame = this.frameMap.get(this.currentFunction);
      if (frame) {
        const localSlot = frame.slots.find((s) => s.name === name);
        if (localSlot) {
          return localSlot;
        }
      }
    }

    // Second, try module-level variables
    return this.tryResolveModuleVariable(name);
  }

  /**
   * Try to resolve a module-level variable.
   *
   * Resolution strategy:
   * 1. If GlobalAllocator provided slots (globalSlots is non-empty),
   *    look up by simple name or qualified name from the GlobalSlot map.
   *    This provides properly allocated addresses from the GlobalAllocator.
   * 2. Otherwise, fall back to legacy symbol-table-based resolution
   *    that creates synthetic FrameSlots with sequentially assigned addresses.
   *
   * @param name - Variable name to resolve (simple name, e.g., "score")
   * @returns FrameSlot or undefined if not a module-level variable
   */
  protected tryResolveModuleVariable(name: string): FrameSlot | undefined {
    // Strategy 1: Use properly allocated GlobalSlots when available
    if (this.globalSlots.size > 0) {
      return this.tryResolveGlobalSlot(name);
    }

    // Strategy 2: Legacy fallback (no GlobalAllocator)
    return this.tryResolveLegacyModuleVariable(name);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Global Slot Resolution (New — uses GlobalAllocator results)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Try to resolve a variable name against the GlobalSlot map.
   *
   * Searches the globalSlots map by:
   * 1. Check the FrameSlot cache first (for previously converted slots)
   * 2. Try exact match by qualified name (e.g., "Game.score")
   * 3. Try match by simple name across all modules
   *
   * Converts the found GlobalSlot to a FrameSlot and caches it.
   *
   * @param name - Variable name (simple or qualified)
   * @returns FrameSlot or undefined if not found in global slots
   */
  protected tryResolveGlobalSlot(name: string): FrameSlot | undefined {
    // Check the FrameSlot cache first (avoids repeated conversions)
    if (this.globalFrameSlotCache.has(name)) {
      return this.globalFrameSlotCache.get(name);
    }

    // Try exact match by qualified name (e.g., "Game.score")
    const exactMatch = this.globalSlots.get(name);
    if (exactMatch) {
      return this.convertAndCacheGlobalSlot(name, exactMatch);
    }

    // Try match by simple name (search all global slots)
    for (const globalSlot of this.globalSlots.values()) {
      if (globalSlot.name === name) {
        return this.convertAndCacheGlobalSlot(name, globalSlot);
      }
    }

    // Not found in global slots — fall back to legacy resolution
    // (handles symbols like constants that might not have been allocated globally)
    return this.tryResolveLegacyModuleVariable(name);
  }

  /**
   * Convert a GlobalSlot to a FrameSlot and cache the result.
   *
   * Maps storage class to SlotLocation:
   * - 'zp' → SlotLocation.ZeroPage (fast 2-byte instructions)
   * - 'ram' / 'default' → SlotLocation.FrameRegion (absolute 3-byte instructions)
   * - 'data' → SlotLocation.FrameRegion (read-only, absolute addressing)
   *
   * Maps storage class to ZpDirective:
   * - 'zp' → ZpDirective.Zp
   * - 'ram' → ZpDirective.Ram
   * - 'data' → ZpDirective.Data
   * - 'default' → ZpDirective.None
   *
   * @param cacheKey - Key for the cache (simple variable name)
   * @param globalSlot - The GlobalSlot to convert
   * @returns The converted FrameSlot
   */
  protected convertAndCacheGlobalSlot(cacheKey: string, globalSlot: GlobalSlot): FrameSlot {
    // Determine SlotLocation based on storage class and actual address.
    // - @data slots always use FrameRegion (label-based addressing, not numeric)
    // - Default globals allocated through ZpPool get ZP-range addresses (0-255)
    //   and should use SlotLocation.ZeroPage for fast 2-byte instructions.
    // - Only globals with addresses >= 256 use FrameRegion (3-byte absolute).
    let location: SlotLocation;
    if (globalSlot.storageClass === 'data') {
      // @data globals use label-based addressing — always FrameRegion
      // (the numeric address is just a relative offset for size tracking)
      location = SlotLocation.FrameRegion;
    } else if (globalSlot.storageClass === 'zp' || (globalSlot.address >= 0 && globalSlot.address < 256)) {
      location = SlotLocation.ZeroPage;
    } else {
      location = SlotLocation.FrameRegion;
    }

    // Determine ZpDirective based on storage class
    let zpDirective: ZpDirective;
    switch (globalSlot.storageClass) {
      case 'zp':
        zpDirective = ZpDirective.Zp;
        break;
      case 'ram':
        zpDirective = ZpDirective.Ram;
        break;
      case 'data':
        zpDirective = ZpDirective.Data;
        break;
      default:
        zpDirective = ZpDirective.None;
        break;
    }

    // Create FrameSlot with the globally allocated address.
    // For @data globals, also propagate the dataLabel so the code generator
    // can emit ACME label-based operands instead of numeric addresses.
    // Alignment is also propagated so the codegen can emit !align directives.
    const frameSlot = createFrameSlot(globalSlot.name, SlotKind.Local, globalSlot.type, {
      zpDirective,
      location,
      address: globalSlot.address,
      offset: 0,
      dataLabel: globalSlot.dataLabel,
      alignment: globalSlot.alignment,
    });

    // Cache for future lookups
    this.globalFrameSlotCache.set(cacheKey, frameSlot);

    return frameSlot;
  }

  /**
   * Check if a variable name resolves to a GlobalSlot.
   *
   * Useful for checking storage class or const status of a global
   * variable without creating a FrameSlot conversion.
   *
   * @param name - Variable name (simple or qualified)
   * @returns The GlobalSlot or undefined if not found
   */
  protected findGlobalSlot(name: string): GlobalSlot | undefined {
    // Try exact match by qualified name
    const exactMatch = this.globalSlots.get(name);
    if (exactMatch) {
      return exactMatch;
    }

    // Try match by simple name
    for (const globalSlot of this.globalSlots.values()) {
      if (globalSlot.name === name) {
        return globalSlot;
      }
    }

    return undefined;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Legacy Module Variable Resolution (Fallback)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Legacy fallback: resolve a module-level variable via symbol table.
   *
   * Used when no GlobalAllocationResult is provided (backward compatibility).
   * Creates synthetic FrameSlots with sequentially assigned addresses
   * after function frames in the frame region.
   *
   * @param name - Variable name to resolve
   * @returns FrameSlot or undefined if not a module-level variable
   */
  protected tryResolveLegacyModuleVariable(name: string): FrameSlot | undefined {
    // Check legacy cache first
    if (this.moduleVariableSlots.has(name)) {
      return this.moduleVariableSlots.get(name);
    }

    // Look up in symbol table's root scope (module-level)
    const symbol = this.symbolTable.lookupGlobal(name);
    if (!symbol) {
      return undefined;
    }

    // Only handle variable/constant symbols (not functions)
    if (symbol.kind !== SymbolKind.Variable && symbol.kind !== SymbolKind.Constant) {
      return undefined;
    }

    // Determine the type from the symbol
    const typeInfo: TypeInfo = symbol.type ?? BUILTIN_TYPES.BYTE;

    // Initialize nextModuleVarAddress if needed (place after function frames)
    if (this.nextModuleVarAddress === 0) {
      this.initializeModuleVarAddress();
    }

    // Calculate size for address allocation
    let size = 1;
    switch (typeInfo.kind) {
      case TypeKind.Byte:
      case TypeKind.Bool:
        size = 1;
        break;
      case TypeKind.Word:
        size = 2;
        break;
      case TypeKind.Array:
        size = typeInfo.size ?? 1;
        break;
      default:
        size = typeInfo.size ?? 1;
    }

    // Allocate address for this module variable
    const address = this.nextModuleVarAddress;
    this.nextModuleVarAddress += size;

    // Create a synthetic FrameSlot for the module-level variable
    const slot = createFrameSlot(name, SlotKind.Local, typeInfo, {
      zpDirective: ZpDirective.None,
      location: SlotLocation.FrameRegion,
      address,
      offset: 0,
    });

    // Cache the slot
    this.moduleVariableSlots.set(name, slot);

    return slot;
  }

  /**
   * Initialize the starting address for legacy module-level variables.
   *
   * Module-level variables are placed after all function frames in the frame region.
   * This computes the next available address after the highest function frame.
   */
  protected initializeModuleVarAddress(): void {
    // Default to frame region start ($0200 for C64)
    let highestUsedAddress = 0x0200;

    // Find the highest address used by any function frame
    for (const frame of this.frameMap.values()) {
      const frameEnd = frame.baseAddress + frame.totalSize;
      if (frameEnd > highestUsedAddress) {
        highestUsedAddress = frameEnd;
      }
    }

    // Start module variables after function frames
    this.nextModuleVarAddress = highestUsedAddress;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Current Function Management
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get the current function's frame.
   *
   * @returns Frame for current function
   * @throws Error if no current function
   */
  protected getCurrentFrame(): Frame {
    if (!this.currentFunction) {
      throw new Error('No current function');
    }

    const frame = this.frameMap.get(this.currentFunction);
    if (!frame) {
      throw new Error(`No frame for function "${this.currentFunction}"`);
    }

    return frame;
  }

  /**
   * Begin generating a new function.
   *
   * Resets state for the new function:
   * - Clears the instruction builder
   * - Resets loop tracking
   * - Sets the current function name
   *
   * @param functionName - Name of the function to generate
   */
  protected beginFunction(functionName: string): void {
    this.currentFunction = functionName;
    this.builder.clear();
    this.loops = [];
    this.currentLoopDepth = 0;
    this.maxLoopDepth = 0;
  }

  /**
   * End generating the current function.
   *
   * @returns Generated instructions, loops, and max depth
   */
  protected endFunction(): {
    instructions: ILInstruction[];
    loops: ILLoop[];
    maxLoopDepth: number;
  } {
    const result = {
      instructions: this.builder.getInstructions(),
      loops: this.loops,
      maxLoopDepth: this.maxLoopDepth,
    };

    this.currentFunction = null;
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Loop Tracking
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Enter a loop (increment depth).
   *
   * Called at the start of while/for loop generation.
   */
  protected enterLoop(): void {
    this.currentLoopDepth++;
    this.maxLoopDepth = Math.max(this.maxLoopDepth, this.currentLoopDepth);
  }

  /**
   * Exit a loop (decrement depth).
   *
   * Called at the end of while/for loop generation.
   */
  protected exitLoop(): void {
    this.currentLoopDepth--;
  }

  /**
   * Record a detected loop for optimization hints.
   *
   * @param loop - Loop information
   */
  protected recordLoop(loop: ILLoop): void {
    this.loops.push(loop);
  }

  // ═══════════════════════════════════════════════════════════════════
  // Source Location
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Set source location for upcoming instructions.
   *
   * @param location - Source location
   */
  protected setLocation(location: SourceLocation): void {
    this.builder.setLocation(location);
  }

  /**
   * Clear source location.
   */
  protected clearLocation(): void {
    this.builder.clearLocation();
  }
}