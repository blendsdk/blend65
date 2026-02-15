/**
 * Global Variable Allocator
 *
 * Assigns memory addresses to module-level variables based on their storage class.
 * Runs as part of the Frame Phase, BEFORE the existing function-local SFA allocation.
 *
 * **Allocation Order (Critical):**
 * 1. Collect all module-level VariableDecls from ALL programs
 * 2. Separate by storage class (@zp, @ram, @data, default)
 * 3. Allocate @zp globals to ZP pool (error if overflow)
 * 4. Allocate @ram + default globals to global RAM region
 * 5. Allocate @data globals to data segment
 * 6. Return GlobalAllocationResult with address map + remaining ZP pool
 *
 * **ZP Pool Sharing:**
 * The GlobalAllocator creates a ZpPool and allocates @zp globals first.
 * The same ZpPool (with globals already allocated) is then passed to
 * the function-local SFA allocator, ensuring no address conflicts.
 *
 * @module frame/allocator/global-allocator
 */

import { Program } from '../../ast/program.js';
import { VariableDecl } from '../../ast/declarations.js';
import { isVariableDecl, isExportDecl } from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import { TypeInfo, TypeKind, BUILTIN_TYPES } from '../../semantic/types.js';
import { DiagnosticSeverity } from '../enums.js';
import { getTypeSize } from '../types.js';
import type { PlatformConfig } from '../platform.js';
import { ZpPool } from './zp-pool.js';
import {
  createGlobalSlot,
  createEmptyGlobalAllocationResult,
} from '../types-global.js';
import type {
  GlobalSlot,
  GlobalStorageClass,
  GlobalAllocationResult,
  GlobalAllocationDiagnostic,
} from '../types-global.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Intermediate representation of a collected global variable.
 *
 * Created during the collection phase before storage class categorization.
 * Contains everything needed to create a GlobalSlot.
 */
interface CollectedGlobal {
  /** Variable name */
  readonly name: string;

  /** Module name this variable belongs to */
  readonly moduleName: string;

  /** Storage class token (ZP, RAM, DATA, or null for default) */
  readonly storageClassToken: TokenType | null;

  /** Resolved storage class string */
  readonly storageClass: GlobalStorageClass;

  /** Type information resolved from annotation */
  readonly type: TypeInfo;

  /** Size in bytes */
  readonly size: number;

  /** Whether the variable is exported */
  readonly isExported: boolean;

  /** Whether the variable is const */
  readonly isConst: boolean;

  /** The original AST node (for initializer access) */
  readonly node: VariableDecl;

  /**
   * Memory alignment requirement in bytes (power-of-2).
   * Comes from @data(align: N), @ram(align: N), or sugar keywords.
   * Undefined means no alignment requirement.
   */
  readonly alignment?: number;
}

/**
 * Variables categorized by storage class.
 *
 * Output of categorizeByStorageClass() — groups collected globals
 * into separate lists for each storage class allocation strategy.
 */
interface CategorizedGlobals {
  /** @zp globals — allocated to zero page */
  readonly zp: CollectedGlobal[];

  /** @ram globals — allocated to global RAM region */
  readonly ram: CollectedGlobal[];

  /** @data globals — allocated to data segment */
  readonly data: CollectedGlobal[];

  /** Default globals (no annotation) — allocated to global RAM region */
  readonly defaultGlobals: CollectedGlobal[];
}

// ============================================================================
// GlobalAllocator Class
// ============================================================================

/**
 * Allocates memory addresses for module-level global variables.
 *
 * The GlobalAllocator walks all parsed programs, collects module-level
 * variable declarations, categorizes them by storage class, and assigns
 * absolute memory addresses.
 *
 * **Usage:**
 * ```typescript
 * const allocator = new GlobalAllocator(C64_PLATFORM_CONFIG);
 * const result = allocator.allocate(allPrograms);
 *
 * if (result.success) {
 *   // Pass zpPool to function-local allocator
 *   frameAllocator.allocateWithPool(programs, callGraph, result.zpPool);
 * }
 * ```
 *
 * @see GlobalAllocationResult for the output structure
 * @see ZpPool for the shared zero page pool
 */
export class GlobalAllocator {
  /** Platform configuration defining memory layout */
  protected readonly config: PlatformConfig;

  /** Zero page pool for @zp allocations (shared with function-local SFA) */
  protected readonly zpPool: ZpPool;

  /** Diagnostics collected during allocation */
  protected readonly diagnostics: GlobalAllocationDiagnostic[];

  /**
   * Creates a new GlobalAllocator.
   *
   * Initializes a fresh ZpPool from the platform configuration.
   * The pool will be used for @zp global allocations and then
   * passed downstream for function-local SFA allocations.
   *
   * @param config - Platform configuration defining memory layout
   */
  constructor(config: PlatformConfig) {
    this.config = config;
    this.zpPool = new ZpPool(config);
    this.diagnostics = [];
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Allocate addresses for all module-level global variables.
   *
   * This is the main entry point. Orchestrates the full allocation pipeline:
   * 1. Collect globals from all programs
   * 2. Categorize by storage class
   * 3. Allocate @zp globals (ZP pool)
   * 4. Allocate @ram + default globals (RAM region)
   * 5. Allocate @data globals (data segment)
   *
   * @param programs - All parsed programs (one per module)
   * @returns Complete allocation result with address map and ZP pool
   */
  allocate(programs: Program[]): GlobalAllocationResult {
    // Step 1: Collect all module-level VariableDecls
    const collected = this.collectGlobals(programs);

    // If no globals, return empty result with untouched ZP pool
    if (collected.length === 0) {
      return createEmptyGlobalAllocationResult(this.zpPool);
    }

    // Step 2: Categorize by storage class
    const categorized = this.categorizeByStorageClass(collected);

    // Step 3: Allocate @zp globals first (most constrained resource)
    const globals = new Map<string, GlobalSlot>();
    this.allocateZpGlobals(categorized.zp, globals);

    // Step 4: Allocate @ram + default globals
    const ramRegionSize = this.allocateRamGlobals(
      categorized.ram,
      categorized.defaultGlobals,
      globals,
    );

    // Step 5: Allocate @data globals
    const dataSegmentSize = this.allocateDataGlobals(categorized.data, globals);

    // Check for allocation errors
    const hasErrors = this.diagnostics.some(
      (d) => d.severity === DiagnosticSeverity.Error,
    );

    return {
      success: !hasErrors,
      globals,
      zpPool: this.zpPool,
      dataSegmentSize,
      ramRegionSize,
      diagnostics: [...this.diagnostics],
    };
  }

  // ========================================
  // Collection Phase
  // ========================================

  /**
   * Collect all module-level VariableDecl nodes from all programs.
   *
   * Walks each program's top-level declarations, unwrapping ExportDecl
   * wrappers to find VariableDecl nodes. Only module-level declarations
   * are collected (function-local variables are handled by SFA).
   *
   * @param programs - All parsed programs
   * @returns Array of collected globals with resolved metadata
   */
  protected collectGlobals(programs: Program[]): CollectedGlobal[] {
    const collected: CollectedGlobal[] = [];

    for (const program of programs) {
      const moduleName = program.getModule().getFullName();
      const declarations = program.getDeclarations();

      for (const decl of declarations) {
        // Unwrap ExportDecl to get the inner declaration
        let varDecl: VariableDecl | null = null;
        let isExported = false;

        if (isExportDecl(decl)) {
          const inner = decl.getDeclaration();
          if (isVariableDecl(inner)) {
            varDecl = inner;
            isExported = true;
          }
        } else if (isVariableDecl(decl)) {
          varDecl = decl;
          isExported = varDecl.isExportedVariable();
        }

        // Skip non-variable declarations (functions, types, imports, etc.)
        if (!varDecl) {
          continue;
        }

        // Resolve type and size from annotation
        const type = this.resolveTypeFromAnnotation(varDecl.getTypeAnnotation());
        const size = getTypeSize(type);

        // Map storage class token to GlobalStorageClass string
        const storageClassToken = varDecl.getStorageClass();
        const storageClass = this.tokenToStorageClass(storageClassToken);

        collected.push({
          name: varDecl.getName(),
          moduleName,
          storageClassToken,
          storageClass,
          type,
          size,
          isExported,
          isConst: varDecl.isConst(),
          node: varDecl,
          alignment: varDecl.getAlignment(),
        });
      }
    }

    return collected;
  }

  // ========================================
  // Categorization Phase
  // ========================================

  /**
   * Categorize collected globals by their storage class.
   *
   * Separates globals into four groups for different allocation strategies:
   * - @zp: Zero page allocation (most constrained)
   * - @ram: Global RAM region
   * - @data: Data segment (read-only, initialized)
   * - default: Global RAM region (same as @ram)
   *
   * @param collected - All collected global variables
   * @returns Categorized globals grouped by storage class
   */
  protected categorizeByStorageClass(collected: CollectedGlobal[]): CategorizedGlobals {
    const zp: CollectedGlobal[] = [];
    const ram: CollectedGlobal[] = [];
    const data: CollectedGlobal[] = [];
    const defaultGlobals: CollectedGlobal[] = [];

    for (const global of collected) {
      switch (global.storageClass) {
        case 'zp':
          zp.push(global);
          break;
        case 'ram':
          ram.push(global);
          break;
        case 'data':
          data.push(global);
          break;
        case 'default':
          defaultGlobals.push(global);
          break;
      }
    }

    return { zp, ram, data, defaultGlobals };
  }

  // ========================================
  // ZP Allocation Phase
  // ========================================

  /**
   * Allocate zero page addresses for @zp global variables.
   *
   * Uses the ZpPool's first-fit allocation strategy to assign
   * contiguous ZP addresses. If any variable cannot fit, an error
   * diagnostic is added and that variable is skipped.
   *
   * After this method, the zpPool has @zp globals allocated.
   * The remaining free space is available for function-local SFA.
   *
   * @param zpGlobals - Globals with @zp storage class
   * @param globals - Output map to populate with allocated slots
   */
  protected allocateZpGlobals(
    zpGlobals: CollectedGlobal[],
    globals: Map<string, GlobalSlot>,
  ): void {
    for (const global of zpGlobals) {
      const result = this.zpPool.allocate(global.size);

      if (result.success) {
        // Create the slot with the assigned ZP address
        const slot = createGlobalSlot(
          global.name,
          global.moduleName,
          'zp',
          global.type,
          global.size,
          {
            isExported: global.isExported,
            isConst: global.isConst,
            initializer: global.node.getInitializer() ?? undefined,
          },
        );
        slot.address = result.address;
        globals.set(slot.qualifiedName, slot);
      } else {
        // ZP overflow — add error diagnostic with usage stats
        const stats = this.zpPool.getStats();
        this.diagnostics.push({
          severity: DiagnosticSeverity.Error,
          message:
            `@zp variable "${global.name}" cannot fit in zero page: ` +
            `need ${global.size} byte(s), ${stats.bytesFree} available ` +
            `(${stats.bytesUsed}/${stats.bytesTotal} bytes used)`,
          variableName: global.name,
          moduleName: global.moduleName,
        });
      }
    }
  }

  // ========================================
  // RAM Allocation Phase (Stub — Session 2.2)
  // ========================================

  /**
   * Allocate RAM region addresses for @ram and default global variables.
   *
   * Assigns addresses in the global RAM region (after code segment).
   * Both @ram and default (no annotation) globals are allocated here.
   *
   * @param ramGlobals - Globals with @ram storage class
   * @param defaultGlobals - Globals with no storage class annotation
   * @param globals - Output map to populate with allocated slots
   * @returns Total RAM region size in bytes
   */
  protected allocateRamGlobals(
    ramGlobals: CollectedGlobal[],
    defaultGlobals: CollectedGlobal[],
    globals: Map<string, GlobalSlot>,
  ): number {
    // Phase 2 Fix: Separate const globals (inlined, no address needed)
    // from mutable globals (need real addresses).
    //
    // Const globals with resolvable literal initializers are purely
    // compile-time values — the IL generator inlines them as immediates.
    // They still get a GlobalSlot entry (so the IL generator can find
    // their metadata) but with address = -1 to signal "no allocation."

    // Step 1: Process @ram globals (explicit storage class — always allocate)
    // RAM region starts after the code segment.
    // The exact base address is determined during codegen when code size is known.
    let ramOffset = 0;

    for (const global of ramGlobals) {
      const slot = createGlobalSlot(
        global.name,
        global.moduleName,
        global.storageClass,
        global.type,
        global.size,
        {
          isExported: global.isExported,
          isConst: global.isConst,
          initializer: global.node.getInitializer() ?? undefined,
          alignment: global.alignment,
        },
      );

      slot.address = ramOffset;
      globals.set(slot.qualifiedName, slot);
      ramOffset += global.size;
    }

    // Step 2: Process default globals — skip inlinable consts,
    // route mutable globals through ZpPool to prevent address overlap.
    for (const global of defaultGlobals) {
      // Check if this is a const with a resolvable initializer.
      // These are inlined by the IL generator and need no runtime address.
      if (global.isConst && global.node.getInitializer() !== null) {
        const slot = createGlobalSlot(
          global.name,
          global.moduleName,
          global.storageClass,
          global.type,
          global.size,
          {
            isExported: global.isExported,
            isConst: true,
            initializer: global.node.getInitializer() ?? undefined,
          },
        );
        // Address -1 signals "inlined constant, no runtime allocation"
        slot.address = -1;
        globals.set(slot.qualifiedName, slot);
        continue;
      }

      // Mutable default global — allocate through ZpPool to prevent
      // address conflicts with SFA function-local variables.
      // This is the same mechanism used for @zp globals.
      const zpResult = this.zpPool.allocate(global.size);

      const slot = createGlobalSlot(
        global.name,
        global.moduleName,
        global.storageClass,
        global.type,
        global.size,
        {
          isExported: global.isExported,
          isConst: global.isConst,
          initializer: global.node.getInitializer() ?? undefined,
        },
      );

      if (zpResult.success) {
        // ZP allocation succeeded — use the pool-assigned address.
        // The IL generator will detect ZP-range addresses and use
        // SlotLocation.ZeroPage for fast 2-byte instructions.
        slot.address = zpResult.address;
      } else {
        // ZP pool full — fall back to RAM region (relative offset).
        // This handles very large programs with many globals.
        slot.address = ramOffset;
        ramOffset += global.size;

        this.diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          message:
            `Default global "${global.name}" could not fit in ZP pool, ` +
            `falling back to RAM region. ${zpResult.error ?? ''}`,
          variableName: global.name,
          moduleName: global.moduleName,
        });
      }

      globals.set(slot.qualifiedName, slot);
    }

    return ramOffset;
  }

  // ========================================
  // Data Segment Allocation Phase (Stub — Session 2.2)
  // ========================================

  /**
   * Allocate data segment addresses for @data const global variables.
   *
   * Assigns addresses in the data segment (after global RAM region).
   * @data variables are read-only initialized constants placed as raw bytes.
   *
   * @param dataGlobals - Globals with @data storage class
   * @param globals - Output map to populate with allocated slots
   * @returns Total data segment size in bytes
   */
  protected allocateDataGlobals(
    dataGlobals: CollectedGlobal[],
    globals: Map<string, GlobalSlot>,
  ): number {
    // Data segment starts after the RAM region.
    // Addresses are relative offsets (kept for size tracking).
    // The code generator uses dataLabel (not address) for operands,
    // so ACME resolves the correct absolute address at assembly time.
    let offset = 0;

    for (const global of dataGlobals) {
      // Generate ACME-compatible label: __data_<module>_<name>
      // Replace dots with underscores for ACME compatibility
      const sanitizedModule = global.moduleName.replace(/\./g, '_');
      const dataLabel = `__data_${sanitizedModule}_${global.name}`;

      const slot = createGlobalSlot(
        global.name,
        global.moduleName,
        'data',
        global.type,
        global.size,
        {
          isExported: global.isExported,
          isConst: global.isConst,
          initializer: global.node.getInitializer() ?? undefined,
          dataLabel,
          alignment: global.alignment,
        },
      );

      // Address is a relative offset for size tracking only.
      // The dataLabel is used by the code generator for addressing.
      slot.address = offset;
      globals.set(slot.qualifiedName, slot);

      offset += global.size;
    }

    return offset;
  }

  // ========================================
  // Type Resolution Helpers
  // ========================================

  /**
   * Resolve a type annotation string to TypeInfo.
   *
   * Handles built-in types (byte, word, bool, string) and
   * array types (byte[N], word[N]).
   *
   * @param annotation - Type annotation string from the parser (e.g., "byte", "word", "byte[256]")
   * @returns Resolved TypeInfo (UNKNOWN if annotation is null)
   */
  protected resolveTypeFromAnnotation(annotation: string | null): TypeInfo {
    if (!annotation) {
      return BUILTIN_TYPES.UNKNOWN;
    }

    // Check for array type: "byte[256]", "word[10]", etc.
    const arrayMatch = annotation.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const elementType = this.getBuiltinType(arrayMatch[1]);
      const count = parseInt(arrayMatch[2], 10);
      return {
        kind: TypeKind.Array,
        name: annotation,
        size: elementType.size * count,
        elementType,
        elementCount: count,
      };
    }

    // Check for unsized array type: "byte[]"
    const unsizedMatch = annotation.match(/^(\w+)\[\]$/);
    if (unsizedMatch) {
      const elementType = this.getBuiltinType(unsizedMatch[1]);
      return {
        kind: TypeKind.Array,
        name: annotation,
        size: 0, // Size unknown without initializer
        elementType,
      };
    }

    return this.getBuiltinType(annotation);
  }

  /**
   * Get TypeInfo for a built-in type name.
   *
   * @param name - Type name (byte, word, bool, string, etc.)
   * @returns TypeInfo for the built-in type, or UNKNOWN
   */
  protected getBuiltinType(name: string): TypeInfo {
    switch (name.toLowerCase()) {
      case 'byte':
      case 'u8':
        return BUILTIN_TYPES.BYTE;
      case 'word':
      case 'u16':
        return BUILTIN_TYPES.WORD;
      case 'bool':
      case 'boolean':
        return BUILTIN_TYPES.BOOL;
      case 'string':
        return BUILTIN_TYPES.STRING;
      case 'void':
        return BUILTIN_TYPES.VOID;
      default:
        return BUILTIN_TYPES.UNKNOWN;
    }
  }

  // ========================================
  // Storage Class Helpers
  // ========================================

  /**
   * Map a storage class TokenType to a GlobalStorageClass string.
   *
   * @param token - Storage class token (ZP, RAM, DATA) or null
   * @returns Corresponding GlobalStorageClass
   */
  protected tokenToStorageClass(token: TokenType | null): GlobalStorageClass {
    switch (token) {
      case TokenType.ZP:
        return 'zp';
      case TokenType.RAM:
        return 'ram';
      case TokenType.DATA:
        return 'data';
      default:
        return 'default';
    }
  }

  // ========================================
  // Accessors
  // ========================================

  /**
   * Get the ZP pool instance.
   *
   * After allocate() is called, this pool has @zp globals already allocated.
   * Pass it to the function-local SFA allocator.
   *
   * @returns The ZpPool instance
   */
  getZpPool(): ZpPool {
    return this.zpPool;
  }

  /**
   * Get all diagnostics collected during allocation.
   *
   * @returns Array of diagnostic messages
   */
  getDiagnostics(): GlobalAllocationDiagnostic[] {
    return [...this.diagnostics];
  }
}
