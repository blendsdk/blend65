/**
 * Global Memory Layout - Memory resource allocation across modules
 *
 * Tracks memory usage and allocation across all modules in a multi-module
 * compilation, ensuring proper resource allocation and conflict detection.
 *
 * **Storage Classes:**
 * - @zp: Zero page ($0000-$00FF) - Only 112 bytes available
 * - @ram: General purpose RAM
 * - @data: Initialized data section (ROM-able)
 * - @map: Memory-mapped hardware registers
 *
 * @module semantic/memory-layout
 */

import type { SourceLocation } from '../ast/base.js';
import type { ModuleAnalysisResult } from './analyzer.js';
import type { Symbol } from './symbol.js';

/**
 * Zero page memory allocation entry
 *
 * Represents a single variable allocated in zero page memory.
 */
export interface ZeroPageEntry {
  /** Variable/symbol name */
  name: string;

  /** Module where variable is declared */
  moduleName: string;

  /** Allocated zero page address (computed by allocator) */
  address: number;

  /** Size in bytes (1 for byte, 2 for word, etc.) */
  size: number;

  /** Is this variable exported? */
  isExported: boolean;

  /** Source location of declaration */
  location: SourceLocation;

  /** Original symbol */
  symbol: Symbol;
}

/**
 * Memory-mapped variable entry
 *
 * Represents a @map declaration that maps to specific hardware addresses.
 */
export interface MapEntry {
  /** Variable/map name */
  name: string;

  /** Module where @map is declared */
  moduleName: string;

  /** Start address of mapped region */
  startAddress: number;

  /** End address of mapped region (inclusive) */
  endAddress: number;

  /** Size in bytes */
  size: number;

  /** Map declaration form (simple, range, sequential, explicit) */
  form: 'simple' | 'range' | 'sequential' | 'explicit';

  /** Is this map exported? */
  isExported: boolean;

  /** Source location of declaration */
  location: SourceLocation;

  /** Original symbol */
  symbol: Symbol;
}

/**
 * Memory conflict between two allocations
 */
export interface MemoryConflict {
  /** Type of conflict */
  type: 'zp_overflow' | 'map_overlap' | 'zp_map_overlap';

  /** First entry involved in conflict */
  entry1: ZeroPageEntry | MapEntry;

  /** Second entry involved in conflict (if applicable) */
  entry2?: ZeroPageEntry | MapEntry;

  /** Human-readable conflict description */
  message: string;

  /** Source locations involved */
  locations: SourceLocation[];
}

/**
 * Statistics about memory usage
 */
export interface MemoryStatistics {
  /** Zero page usage in bytes */
  zeroPageUsed: number;

  /** Zero page available (typically 112 bytes) */
  zeroPageAvailable: number;

  /** Percentage of zero page used */
  zeroPageUsagePercent: number;

  /** Total RAM usage in bytes */
  totalRamUsage: number;

  /** Total data section usage in bytes */
  totalDataUsage: number;

  /** Number of @map declarations */
  mapCount: number;

  /** Number of modules analyzed */
  moduleCount: number;
}

/**
 * Global memory layout result
 *
 * Contains complete memory allocation information across all modules.
 */
export interface GlobalMemoryLayout {
  /** Zero page allocations (keyed by symbol name) */
  zeroPageAllocation: Map<string, ZeroPageEntry>;

  /** Memory-mapped declarations (keyed by symbol name) */
  memoryMaps: Map<string, MapEntry>;

  /** Memory conflicts detected */
  conflicts: MemoryConflict[];

  /** Memory usage statistics */
  statistics: MemoryStatistics;

  /** Was allocation successful? */
  success: boolean;
}

/**
 * Memory Layout Builder
 *
 * Analyzes module results and builds a global memory layout,
 * allocating zero page memory and detecting conflicts.
 *
 * **Algorithm:**
 * 1. Collect all @zp variables from all modules
 * 2. Allocate zero page addresses (fail if >112 bytes)
 * 3. Collect all @map declarations
 * 4. Detect memory conflicts (overlaps, overflows)
 * 5. Calculate memory statistics
 */
export class MemoryLayoutBuilder {
  /**
   * Zero page address pool (available for allocation)
   *
   * C64 zero page layout:
   * - $00-$01: 6502 CPU registers (not usable)
   * - $02-$8F: BASIC/KERNAL workspace (system reserved)
   * - $90-$FF: Available for user programs (112 bytes)
   */
  protected static readonly ZP_START = 0x90;
  protected static readonly ZP_END = 0xff;
  protected static readonly ZP_AVAILABLE = 112; // $90-$FF = 112 bytes

  /**
   * Warning threshold (80% of zero page capacity)
   */
  protected static readonly ZP_WARNING_THRESHOLD = 0.8;

  /**
   * Build global memory layout from module results
   *
   * @param moduleResults - Analysis results from all modules
   * @returns Complete global memory layout
   */
  public buildLayout(moduleResults: Map<string, ModuleAnalysisResult>): GlobalMemoryLayout {
    const zeroPageAllocation = new Map<string, ZeroPageEntry>();
    const memoryMaps = new Map<string, MapEntry>();
    const conflicts: MemoryConflict[] = [];

    // Step 1: Collect all @zp variables
    const zpVariables = this.collectZeroPageVariables(moduleResults);

    // Step 2: Allocate zero page addresses
    const zpAllocResult = this.allocateZeroPage(zpVariables);
    for (const [name, entry] of zpAllocResult.allocations) {
      zeroPageAllocation.set(name, entry);
    }
    conflicts.push(...zpAllocResult.conflicts);

    // Step 3: Collect all @map declarations
    const mapDecls = this.collectMemoryMaps(moduleResults);
    for (const [name, entry] of mapDecls) {
      memoryMaps.set(name, entry);
    }

    // Step 4: Detect @map conflicts
    const mapConflicts = this.detectMapConflicts(mapDecls);
    conflicts.push(...mapConflicts);

    // Step 5: Detect @zp/@map overlaps
    const zpMapConflicts = this.detectZeroPageMapOverlaps(zpAllocResult.allocations, mapDecls);
    conflicts.push(...zpMapConflicts);

    // Step 6: Calculate statistics
    const statistics = this.calculateStatistics(
      moduleResults,
      zeroPageAllocation,
      memoryMaps,
      zpAllocResult.totalUsed
    );

    return {
      zeroPageAllocation,
      memoryMaps,
      conflicts,
      statistics,
      success: conflicts.length === 0,
    };
  }

  /**
   * Collect all @zp variables from all modules
   *
   * @param moduleResults - Module analysis results
   * @returns List of zero page variables to allocate
   */
  protected collectZeroPageVariables(
    moduleResults: Map<string, ModuleAnalysisResult>
  ): Array<{ name: string; moduleName: string; size: number; symbol: Symbol }> {
    const zpVars: Array<{ name: string; moduleName: string; size: number; symbol: Symbol }> = [];

    for (const [moduleName, result] of moduleResults) {
      const rootScope = result.symbolTable.getRootScope();

      for (const symbol of rootScope.symbols.values()) {
        // Check if variable has @zp storage class
        if (this.isZeroPageVariable(symbol)) {
          const size = this.getSymbolSize(symbol);
          zpVars.push({
            name: symbol.name,
            moduleName,
            size,
            symbol,
          });
        }
      }
    }

    return zpVars;
  }

  /**
   * Allocate zero page addresses for variables
   *
   * @param variables - Variables to allocate in zero page
   * @returns Allocation result with addresses and conflicts
   */
  protected allocateZeroPage(
    variables: Array<{ name: string; moduleName: string; size: number; symbol: Symbol }>
  ): {
    allocations: Map<string, ZeroPageEntry>;
    conflicts: MemoryConflict[];
    totalUsed: number;
  } {
    const allocations = new Map<string, ZeroPageEntry>();
    const conflicts: MemoryConflict[] = [];

    let currentAddress = MemoryLayoutBuilder.ZP_START;
    let totalUsed = 0;

    // Sort by size (largest first) for better packing
    const sorted = [...variables].sort((a, b) => b.size - a.size);

    for (const variable of sorted) {
      // Check if we have space
      if (currentAddress + variable.size > MemoryLayoutBuilder.ZP_END + 1) {
        // Zero page overflow
        const entry: ZeroPageEntry = {
          name: variable.name,
          moduleName: variable.moduleName,
          address: 0, // No address allocated
          size: variable.size,
          isExported: variable.symbol.isExported,
          location: variable.symbol.declaration.getLocation(),
          symbol: variable.symbol,
        };

        conflicts.push({
          type: 'zp_overflow',
          entry1: entry,
          message: `Zero page overflow: Cannot allocate '${variable.name}' (${variable.size} bytes). Zero page limit exceeded (max ${MemoryLayoutBuilder.ZP_AVAILABLE} bytes).`,
          locations: [variable.symbol.declaration.getLocation()],
        });

        continue;
      }

      // Allocate address
      const entry: ZeroPageEntry = {
        name: variable.name,
        moduleName: variable.moduleName,
        address: currentAddress,
        size: variable.size,
        isExported: variable.symbol.isExported,
        location: variable.symbol.declaration.getLocation(),
        symbol: variable.symbol,
      };

      allocations.set(this.getFullyQualifiedName(variable.moduleName, variable.name), entry);

      currentAddress += variable.size;
      totalUsed += variable.size;
    }

    return { allocations, conflicts, totalUsed };
  }

  /**
   * Collect all @map declarations from all modules
   *
   * @param moduleResults - Module analysis results
   * @returns Map of memory-mapped declarations
   */
  protected collectMemoryMaps(
    moduleResults: Map<string, ModuleAnalysisResult>
  ): Map<string, MapEntry> {
    const maps = new Map<string, MapEntry>();

    for (const [moduleName, result] of moduleResults) {
      const rootScope = result.symbolTable.getRootScope();

      for (const symbol of rootScope.symbols.values()) {
        // Check if this is a @map declaration
        if (this.isMemoryMappedVariable(symbol)) {
          const mapInfo = this.extractMapInfo(symbol);

          const entry: MapEntry = {
            name: symbol.name,
            moduleName,
            startAddress: mapInfo.startAddress,
            endAddress: mapInfo.endAddress,
            size: mapInfo.size,
            form: mapInfo.form,
            isExported: symbol.isExported,
            location: symbol.declaration.getLocation(),
            symbol,
          };

          maps.set(this.getFullyQualifiedName(moduleName, symbol.name), entry);
        }
      }
    }

    return maps;
  }

  /**
   * Detect conflicts between @map declarations
   *
   * @param maps - All memory-mapped declarations
   * @returns List of detected conflicts
   */
  protected detectMapConflicts(maps: Map<string, MapEntry>): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    const entries = Array.from(maps.values());

    // Check each pair for overlaps
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const map1 = entries[i];
        const map2 = entries[j];

        // Check if ranges overlap
        if (
          this.rangesOverlap(map1.startAddress, map1.endAddress, map2.startAddress, map2.endAddress)
        ) {
          conflicts.push({
            type: 'map_overlap',
            entry1: map1,
            entry2: map2,
            message:
              `Memory-mapped region overlap: '${map1.moduleName}.${map1.name}' ` +
              `($${map1.startAddress.toString(16).toUpperCase()}-$${map1.endAddress.toString(16).toUpperCase()}) ` +
              `overlaps with '${map2.moduleName}.${map2.name}' ` +
              `($${map2.startAddress.toString(16).toUpperCase()}-$${map2.endAddress.toString(16).toUpperCase()})`,
            locations: [map1.location, map2.location],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts between zero page allocations and @map declarations
   *
   * @param zpAllocs - Zero page allocations
   * @param maps - Memory-mapped declarations
   * @returns List of detected conflicts
   */
  protected detectZeroPageMapOverlaps(
    zpAllocs: Map<string, ZeroPageEntry>,
    maps: Map<string, MapEntry>
  ): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];

    for (const zpEntry of zpAllocs.values()) {
      const zpStart = zpEntry.address;
      const zpEnd = zpEntry.address + zpEntry.size - 1;

      for (const mapEntry of maps.values()) {
        // Check if @map overlaps with zero page allocation
        if (this.rangesOverlap(zpStart, zpEnd, mapEntry.startAddress, mapEntry.endAddress)) {
          conflicts.push({
            type: 'zp_map_overlap',
            entry1: zpEntry,
            entry2: mapEntry,
            message:
              `Zero page variable '${zpEntry.moduleName}.${zpEntry.name}' ` +
              `($${zpStart.toString(16).toUpperCase()}-$${zpEnd.toString(16).toUpperCase()}) ` +
              `overlaps with @map '${mapEntry.moduleName}.${mapEntry.name}' ` +
              `($${mapEntry.startAddress.toString(16).toUpperCase()}-$${mapEntry.endAddress.toString(16).toUpperCase()})`,
            locations: [zpEntry.location, mapEntry.location],
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Calculate memory usage statistics
   *
   * @param moduleResults - Module analysis results
   * @param _zpAllocs - Zero page allocations (unused, kept for API consistency)
   * @param maps - Memory-mapped declarations
   * @param zpUsed - Total zero page bytes used
   * @returns Memory statistics
   */
  protected calculateStatistics(
    moduleResults: Map<string, ModuleAnalysisResult>,
    _zpAllocs: Map<string, ZeroPageEntry>,
    maps: Map<string, MapEntry>,
    zpUsed: number
  ): MemoryStatistics {
    let totalRam = 0;
    let totalData = 0;

    // Calculate RAM and data usage from all modules
    for (const result of moduleResults.values()) {
      const rootScope = result.symbolTable.getRootScope();

      for (const symbol of rootScope.symbols.values()) {
        const size = this.getSymbolSize(symbol);

        if (this.isRamVariable(symbol)) {
          totalRam += size;
        } else if (this.isDataVariable(symbol)) {
          totalData += size;
        }
      }
    }

    const zpPercent = (zpUsed / MemoryLayoutBuilder.ZP_AVAILABLE) * 100;

    return {
      zeroPageUsed: zpUsed,
      zeroPageAvailable: MemoryLayoutBuilder.ZP_AVAILABLE,
      zeroPageUsagePercent: zpPercent,
      totalRamUsage: totalRam,
      totalDataUsage: totalData,
      mapCount: maps.size,
      moduleCount: moduleResults.size,
    };
  }

  /**
   * Check if two memory ranges overlap
   *
   * @param start1 - Start of first range
   * @param end1 - End of first range (inclusive)
   * @param start2 - Start of second range
   * @param end2 - End of second range (inclusive)
   * @returns True if ranges overlap
   */
  protected rangesOverlap(start1: number, end1: number, start2: number, end2: number): boolean {
    return start1 <= end2 && start2 <= end1;
  }

  /**
   * Check if symbol is a zero page variable
   *
   * @param symbol - Symbol to check
   * @returns True if variable has @zp storage class
   */
  protected isZeroPageVariable(symbol: Symbol): boolean {
    // Check symbol metadata for storage class
    // TODO: This needs to be implemented based on how storage classes are tracked
    return (
      symbol.declaration.constructor.name === 'VariableDecl' &&
      (symbol.declaration as any).storageClass === 'zp'
    );
  }

  /**
   * Check if symbol is a RAM variable
   *
   * @param symbol - Symbol to check
   * @returns True if variable has @ram storage class (or default)
   */
  protected isRamVariable(symbol: Symbol): boolean {
    return (
      symbol.declaration.constructor.name === 'VariableDecl' &&
      ((symbol.declaration as any).storageClass === 'ram' ||
        (symbol.declaration as any).storageClass === undefined)
    );
  }

  /**
   * Check if symbol is a data section variable
   *
   * @param symbol - Symbol to check
   * @returns True if variable has @data storage class
   */
  protected isDataVariable(symbol: Symbol): boolean {
    return (
      symbol.declaration.constructor.name === 'VariableDecl' &&
      (symbol.declaration as any).storageClass === 'data'
    );
  }

  /**
   * Check if symbol is a memory-mapped variable
   *
   * @param symbol - Symbol to check
   * @returns True if symbol is @map declaration
   */
  protected isMemoryMappedVariable(symbol: Symbol): boolean {
    return symbol.declaration.constructor.name === 'MapDecl';
  }

  /**
   * Extract map information from symbol
   *
   * @param symbol - Memory-mapped symbol
   * @returns Map metadata (address, size, form)
   */
  protected extractMapInfo(symbol: Symbol): {
    startAddress: number;
    endAddress: number;
    size: number;
    form: 'simple' | 'range' | 'sequential' | 'explicit';
  } {
    // TODO: Extract actual map information from AST node
    // This is a placeholder implementation
    const mapDecl = symbol.declaration as any;

    return {
      startAddress: mapDecl.address || 0,
      endAddress: (mapDecl.address || 0) + (mapDecl.size || 1) - 1,
      size: mapDecl.size || 1,
      form: mapDecl.form || 'simple',
    };
  }

  /**
   * Get size of symbol in bytes
   *
   * @param symbol - Symbol to measure
   * @returns Size in bytes
   */
  protected getSymbolSize(symbol: Symbol): number {
    const typeInfo = symbol.type;

    if (!typeInfo) {
      return 1; // Default to 1 byte if no type info
    }

    // If type has explicit size, use it (handles test mocks and custom sizes)
    if (typeof typeInfo.size === 'number') {
      return typeInfo.size;
    }

    // Handle arrays
    if (typeInfo.kind === 'array') {
      const elementSize = this.getTypeSize(typeInfo.elementType?.name || 'byte');
      const arraySize = typeInfo.arraySize || 0;
      return elementSize * arraySize;
    }

    // Handle basic types
    return this.getTypeSize(typeInfo.name);
  }

  /**
   * Get size of type in bytes
   *
   * @param typeName - Type name (byte, word, etc.)
   * @returns Size in bytes
   */
  protected getTypeSize(typeName: string): number {
    switch (typeName) {
      case 'byte':
      case 'boolean':
        return 1;
      case 'word':
        return 2;
      default:
        return 1; // Default to 1 byte
    }
  }

  /**
   * Get fully qualified symbol name
   *
   * @param moduleName - Module name
   * @param symbolName - Symbol name
   * @returns Fully qualified name (module.symbol)
   */
  protected getFullyQualifiedName(moduleName: string, symbolName: string): string {
    return `${moduleName}.${symbolName}`;
  }
}
