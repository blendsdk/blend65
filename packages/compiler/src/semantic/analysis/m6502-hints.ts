/**
 * 6502 Optimization Hints (Phase 8 - Task 8.13)
 *
 * Generates MOS 6502-specific optimization hints including:
 * - Zero-page allocation priority scoring
 * - Register preference hints (A, X, Y)
 * - Addressing mode recommendations
 * - Reserved zero-page location blacklist (target-configurable)
 * - Cycle count estimation
 *
 * **CRITICAL**: Not all zero-page is usable! Reserved ranges depend on target.
 * - C64: $00-$01 (CPU I/O) and $90-$FF (KERNAL) reserved, safe: $02-$8F (142 bytes)
 * - C128: Different KERNAL workspace
 * - X16: Only $00-$15 (22 bytes) safe
 *
 * **Target Configuration**: Zero-page reserved ranges now come from TargetConfig,
 * enabling support for different 6502-based systems (C64, C128, X16).
 *
 * **Analysis Only**: Marks opportunities; code generator uses hints.
 *
 * @example
 * ```typescript
 * // With target config (recommended)
 * const config = getTargetConfig(TargetArchitecture.C64);
 * const analyzer = new M6502HintAnalyzer(symbolTable, cfgs, config);
 * analyzer.analyze(ast);
 *
 * // Backward compatible (defaults to C64)
 * const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 *
 * // Check zero-page priority
 * const zpPriority = variable.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority);
 * ```
 */

import type { Program, VariableDecl } from '../../ast/nodes.js';
import type { Expression, SourceLocation } from '../../ast/base.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Symbol } from '../symbol.js';
import type { ControlFlowGraph } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { DiagnosticCode, DiagnosticSeverity } from '../../ast/diagnostics.js';
import type {
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from '../../ast/nodes.js';
import { LiteralExpression } from '../../ast/nodes.js';
import {
  isVariableDecl,
  isSimpleMapDecl,
  isRangeMapDecl,
  isSequentialStructMapDecl,
  isExplicitStructMapDecl,
} from '../../ast/type-guards.js';
import { TokenType } from '../../lexer/types.js';
import { OptimizationMetadataKey, type InductionVariable } from './optimization-metadata-keys.js';
import { ASTWalker } from '../../ast/walker/base.js';
import type { TargetConfig, ReservedZeroPageRange } from '../../target/config.js';
import { getDefaultTargetConfig } from '../../target/registry.js';

/**
 * 6502 Register preference
 */
export enum M6502Register {
  /** Accumulator - best for arithmetic */
  A = 'A',

  /** X register - best for indexing, loop counters */
  X = 'X',

  /** Y register - best for indexing, loop counters */
  Y = 'Y',

  /** No preference */
  Any = 'Any',
}

/**
 * Memory access pattern
 */
export enum MemoryAccessPattern {
  /** Single access */
  Single = 'Single',

  /** Sequential access (array iteration, stride +1) */
  Sequential = 'Sequential',

  /** Strided access (array iteration, stride > 1) */
  Strided = 'Strided',

  /** Random access (unpredictable) */
  Random = 'Random',

  /** Hot path (in critical loops) */
  HotPath = 'HotPath',
}

/**
 * Detailed access pattern information
 *
 * Provides comprehensive information about how a variable is accessed,
 * useful for optimization decisions.
 */
export interface AccessPatternInfo {
  /** The detected access pattern */
  pattern: MemoryAccessPattern;

  /** Access stride (null if not strided/sequential) */
  stride: number | null;

  /** Maximum loop nesting depth where accessed */
  loopDepth: number;

  /** Total number of accesses (reads + writes) */
  accessCount: number;

  /** Is this variable an induction variable? */
  isInductionVariable: boolean;

  /** Hot path accesses (in critical loops) */
  hotPathAccesses: number;
}

/**
 * Zero-page priority factor breakdown
 *
 * Provides detailed breakdown of how ZP priority score is calculated.
 * Useful for debugging and optimization decision transparency.
 *
 * Total score is sum of all factors, clamped to 0-100.
 */
export interface ZPPriorityFactors {
  /** Access frequency bonus (0-30 points) - more accesses = more cycles saved by ZP */
  accessFrequency: number;

  /** Loop depth bonus (0-25 points) - deep loop variables benefit most */
  loopDepthBonus: number;

  /** Hot path bonus (0-20 points) - critical path variables get priority */
  hotPathBonus: number;

  /** Variable size bonus (0-10 points) - bytes benefit more than words */
  sizeBonus: number;

  /** Arithmetic intensity bonus (0-10 points) - arithmetic-heavy variables benefit from A register */
  arithmeticBonus: number;

  /** Index variable bonus (0-5 points) - array index variables benefit from X/Y */
  indexBonus: number;

  /** Total priority score (0-100) */
  total: number;
}

/**
 * Safe zero-page range
 */
const SAFE_ZERO_PAGE = {
  start: 0x02,
  end: 0x8f,
  size: 0x8f - 0x02 + 1, // 142 bytes
};

/**
 * Reserved zero-page location range
 *
 * Describes a contiguous range of addresses that cannot be used
 * for @zp or @map declarations.
 */
interface ReservedRange {
  /** Start address (inclusive) */
  start: number;
  /** End address (inclusive) */
  end: number;
  /** Human-readable reason why this range is reserved */
  reason: string;
}

/**
 * Reserved zero-page locations (CANNOT USE!)
 *
 * Using these addresses will crash the C64 or corrupt system state.
 *
 * - $00-$01: CPU memory configuration registers (6510 I/O port)
 * - $90-$FF: KERNAL workspace (used by BASIC/KERNAL routines)
 *
 * Safe range: $02-$8F (142 bytes)
 */
const RESERVED_ZERO_PAGE: ReservedRange[] = [
  {
    start: 0x00,
    end: 0x01,
    reason: 'CPU memory configuration registers (6510 I/O port)',
  },
  {
    start: 0x90,
    end: 0xff,
    reason: 'KERNAL workspace (used by BASIC/KERNAL routines)',
  },
];

/**
 * Variable usage information for 6502 hints
 */
interface VariableHints {
  /** Variable symbol */
  symbol: Symbol;

  /** Read count */
  readCount: number;

  /** Write count */
  writeCount: number;

  /** Hot path accesses (in loops) */
  hotPathAccesses: number;

  /** Maximum loop depth */
  maxLoopDepth: number;

  /** Is this a loop counter? */
  isLoopCounter: boolean;

  /** Zero-page priority (0-100) */
  zpPriority: number;

  /** Register preference */
  registerPreference: M6502Register;

  /** Memory access pattern */
  accessPattern: MemoryAccessPattern;
}

/**
 * 6502 optimization hints analyzer
 *
 * Analyzes variable usage patterns and generates
 * 6502-specific optimization hints for the code generator.
 *
 * Key responsibilities:
 * - Calculate zero-page allocation priorities
 * - Recommend register usage
 * - Detect memory access patterns
 * - Enforce reserved zero-page blacklist (target-configurable)
 *
 * **Target Configuration**: The analyzer now accepts an optional TargetConfig
 * parameter to support different 6502-based targets. Zero-page reserved ranges
 * are obtained from the target config rather than hardcoded values.
 *
 * @example
 * ```typescript
 * // With explicit target config
 * const config = getTargetConfig(TargetArchitecture.C64);
 * const analyzer = new M6502HintAnalyzer(symbolTable, cfgs, config);
 *
 * // With default (C64) config
 * const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);
 * ```
 */
export class M6502HintAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  protected diagnostics: Diagnostic[] = [];

  /** Variable hints map */
  protected variableHints = new Map<string, VariableHints>();

  /** Target configuration for zero-page and hardware settings */
  protected readonly targetConfig: TargetConfig;

  /**
   * Creates a 6502 hint analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   * @param targetConfig - Optional target configuration (defaults to C64)
   */
  constructor(
    protected readonly symbolTable: SymbolTable,
    _cfgs: Map<string, ControlFlowGraph>,
    targetConfig?: TargetConfig
  ) {
    super();
    // Default to C64 config for backward compatibility
    this.targetConfig = targetConfig ?? getDefaultTargetConfig();
  }

  /**
   * Analyze program for 6502 optimization hints
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    // Phase 1: Collect variable usage (reuse from variable-usage.ts data if available)
    this.collectVariableUsage(ast);

    // Phase 2: Calculate zero-page priorities
    this.calculateZeroPagePriorities();

    // Phase 3: Determine register preferences
    this.determineRegisterPreferences();

    // Phase 4: Detect memory access patterns
    this.detectAccessPatterns();

    // Phase 5: Check for reserved zero-page violations
    this.checkReservedZeroPage(ast);

    // Phase 6: Set metadata on AST nodes
    this.setM6502Metadata();
  }

  /**
   * Collect variable usage information
   */
  protected collectVariableUsage(ast: Program): void {
    const declarations = ast.getDeclarations();

    for (const decl of declarations) {
      if (isVariableDecl(decl)) {
        const varDecl = decl;
        const varName = varDecl.getName();
        const symbol = this.symbolTable.lookup(varName);

        if (symbol) {
          // Get usage data from metadata (set by Task 8.2)
          const readCount = varDecl.metadata?.get(OptimizationMetadataKey.UsageReadCount) || 0;
          const writeCount = varDecl.metadata?.get(OptimizationMetadataKey.UsageWriteCount) || 0;
          const hotPathAccesses =
            varDecl.metadata?.get(OptimizationMetadataKey.UsageHotPathAccesses) || 0;
          const maxLoopDepth =
            varDecl.metadata?.get(OptimizationMetadataKey.UsageMaxLoopDepth) || 0;

          this.variableHints.set(varName, {
            symbol,
            readCount: typeof readCount === 'number' ? readCount : 0,
            writeCount: typeof writeCount === 'number' ? writeCount : 0,
            hotPathAccesses: typeof hotPathAccesses === 'number' ? hotPathAccesses : 0,
            maxLoopDepth: typeof maxLoopDepth === 'number' ? maxLoopDepth : 0,
            isLoopCounter: false, // Will be determined
            zpPriority: 0,
            registerPreference: M6502Register.Any,
            accessPattern: MemoryAccessPattern.Single,
          });
        }
      }
    }
  }

  /**
   * Calculate zero-page allocation priorities
   *
   * Enhanced multi-factor scoring system for ZP allocation priority.
   * Variables with higher scores should be prioritized for zero-page.
   *
   * Priority factors (0-100 total):
   * - Access frequency (0-30 points): More accesses = more cycles saved by ZP
   * - Loop depth (0-25 points): Variables in deep loops benefit most
   * - Hot path (0-20 points): Critical path variables get priority
   * - Size (0-10 points): Bytes benefit more than words
   * - Arithmetic intensity (0-10 points): Arithmetic-heavy variables benefit from A register
   * - Index variable (0-5 points): Array index variables benefit from X/Y
   *
   * Score: 0-100 (100 = highest priority)
   */
  protected calculateZeroPagePriorities(): void {
    for (const [_varName, hints] of this.variableHints) {
      // Calculate priority using the breakdown method for consistency
      const factors = this.calculateZPFactors(hints);
      hints.zpPriority = factors.total;
    }
  }

  /**
   * Calculate all ZP priority factors for a variable
   *
   * Internal method that calculates and returns all priority factors.
   * Used by both `calculateZeroPagePriorities()` and `getZPPriorityBreakdown()`.
   *
   * @param hints - Variable hints to calculate factors for
   * @returns All priority factors with their scores
   */
  protected calculateZPFactors(hints: VariableHints): ZPPriorityFactors {
    // Factor 1: Access frequency (0-30 points)
    // More accesses = more cycles saved by ZP (3 vs 4 cycles per access)
    const totalAccesses = hints.readCount + hints.writeCount;
    const accessFrequency = Math.min(30, totalAccesses * 1.5);

    // Factor 2: Loop depth bonus (0-25 points)
    // Variables in deep loops get multiplied benefits
    const loopDepthBonus = Math.min(25, hints.maxLoopDepth * 8);

    // Factor 3: Hot path bonus (0-20 points)
    // Critical path accesses are most valuable to optimize
    const hotPathBonus = Math.min(20, hints.hotPathAccesses * 2);

    // Factor 4: Variable size bonus (0-10 points)
    // Bytes benefit most from ZP (full cycle savings)
    // Words take 2 ZP bytes, so less efficient
    let sizeBonus = 0;
    const type = hints.symbol.type;
    if (type?.name === 'byte') {
      sizeBonus = 10; // Bytes benefit most from ZP
    } else if (type?.name === 'word') {
      sizeBonus = 5; // Words benefit but take 2 bytes
    }

    // Factor 5: Arithmetic intensity bonus (0-10 points)
    // Variables used heavily in arithmetic benefit from A register + ZP
    const arithmeticBonus = this.calculateArithmeticIntensity(hints.symbol);

    // Factor 6: Index variable bonus (0-5 points)
    // Array index variables benefit from X/Y registers + ZP indexed modes
    const indexBonus = this.isIndexVariable(hints.symbol) ? 5 : 0;

    // Calculate total (clamped to 0-100)
    const rawTotal =
      accessFrequency + loopDepthBonus + hotPathBonus + sizeBonus + arithmeticBonus + indexBonus;
    const total = Math.min(100, Math.max(0, Math.round(rawTotal)));

    return {
      accessFrequency: Math.round(accessFrequency),
      loopDepthBonus: Math.round(loopDepthBonus),
      hotPathBonus: Math.round(hotPathBonus),
      sizeBonus,
      arithmeticBonus,
      indexBonus,
      total,
    };
  }

  /**
   * Determine register preferences
   *
   * Uses a multi-factor decision tree to assign optimal 6502 register:
   *
   * Decision Tree:
   * 1. Indirect addressing → Y (best for (zp),Y mode)
   * 2. Array index → X (best for zp,X and abs,X modes)
   * 3. Loop counter → X (or Y for nested inner loops)
   * 4. Arithmetic-heavy → A (accumulator for ALU ops)
   * 5. Otherwise → Any
   *
   * @see getRegisterPreferenceReason() for human-readable explanations
   */
  protected determineRegisterPreferences(): void {
    // Track which register is assigned to outer loop counters
    // Inner loops should prefer Y if outer loop uses X
    let outerLoopUsesX = false;

    // First pass: identify outer loop variables using X
    for (const [_varName, hints] of this.variableHints) {
      if (hints.maxLoopDepth === 1 && this.isInductionVariable(hints.symbol)) {
        outerLoopUsesX = true;
        break;
      }
    }

    for (const [_varName, hints] of this.variableHints) {
      // Decision 1: Indirect addressing → Y
      // Y register is required for (zp),Y indirect indexed mode
      if (this.detectIndirectAddressing(hints.symbol)) {
        hints.registerPreference = M6502Register.Y;
        continue;
      }

      // Decision 2: Array index → X
      // X register is optimal for zp,X and absolute,X addressing
      if (this.detectArrayIndexUsage(hints.symbol)) {
        hints.registerPreference = M6502Register.X;
        continue;
      }

      // Decision 3: Loop counter → X or Y
      // Induction variables benefit from index registers
      if (this.isInductionVariable(hints.symbol)) {
        hints.isLoopCounter = true;
        
        // Inner loop counters (depth > 1) prefer Y if outer uses X
        if (hints.maxLoopDepth > 1 && outerLoopUsesX) {
          hints.registerPreference = M6502Register.Y;
        } else {
          hints.registerPreference = M6502Register.X;
        }
        continue;
      }

      // Also check for loop counter pattern (modified in loop)
      if (hints.maxLoopDepth > 0 && hints.writeCount > 0) {
        hints.isLoopCounter = true;
        
        // Inner loops prefer Y
        if (hints.maxLoopDepth > 1 && outerLoopUsesX) {
          hints.registerPreference = M6502Register.Y;
        } else {
          hints.registerPreference = M6502Register.X;
        }
        continue;
      }

      // Decision 4: Arithmetic-heavy → A
      // Accumulator is optimal for arithmetic operations
      const arithmeticIntensity = this.calculateArithmeticIntensity(hints.symbol);
      if (arithmeticIntensity >= 5) {
        hints.registerPreference = M6502Register.A;
        continue;
      }

      // Decision 5: High frequency → A
      // Variables accessed frequently benefit from accumulator
      if (hints.readCount + hints.writeCount > 10) {
        hints.registerPreference = M6502Register.A;
        continue;
      }

      // Default: No specific preference
      hints.registerPreference = M6502Register.Any;
    }
  }

  /**
   * Detect memory access patterns
   *
   * Uses a multi-phase approach:
   * 1. Basic pattern detection based on access counts and hot path info
   * 2. Enhanced detection using induction variable metadata from loop analysis
   *
   * Patterns detected:
   * - Single: Variable accessed only once
   * - Sequential: Variable is induction var with stride 1 (e.g., loop counter)
   * - Strided: Variable is induction var with stride > 1 (e.g., array[i*2])
   * - HotPath: Variable frequently accessed in critical loops
   * - Random: Multiple accesses with no predictable pattern
   */
  protected detectAccessPatterns(): void {
    for (const [_varName, hints] of this.variableHints) {
      // Phase 1: Basic pattern detection

      // Single access pattern - one-time use variable
      if (hints.readCount + hints.writeCount <= 1) {
        hints.accessPattern = MemoryAccessPattern.Single;
        continue;
      }

      // Phase 2: Enhanced detection using induction variable analysis
      // Check for sequential/strided patterns based on loop analysis
      const stride = this.analyzeAccessStride(hints.symbol);

      if (stride !== null) {
        if (stride === 1) {
          // Sequential access (stride = 1)
          hints.accessPattern = MemoryAccessPattern.Sequential;
        } else if (stride > 1) {
          // Strided access (stride > 1)
          hints.accessPattern = MemoryAccessPattern.Strided;
        }
        continue;
      }

      // Hot path pattern - variable frequently accessed in critical loops
      if (hints.hotPathAccesses > 0) {
        hints.accessPattern = MemoryAccessPattern.HotPath;
        continue;
      }

      // Multiple accesses with no detected pattern - default to random
      hints.accessPattern = MemoryAccessPattern.Random;
    }
  }

  /**
   * Check for reserved zero-page violations
   *
   * Validates @zp variable declarations and @map declarations
   * to ensure they don't use reserved zero-page addresses.
   *
   * Reserved ranges:
   * - $00-$01: CPU memory configuration registers
   * - $90-$FF: KERNAL workspace
   *
   * @param ast - Program AST to check
   */
  protected checkReservedZeroPage(ast: Program): void {
    const declarations = ast.getDeclarations();

    for (const decl of declarations) {
      // Check @zp variable declarations
      if (isVariableDecl(decl)) {
        this.checkVariableDeclZeroPage(decl);
      }

      // Check @map simple declarations
      else if (isSimpleMapDecl(decl)) {
        this.checkSimpleMapDeclZeroPage(decl);
      }

      // Check @map range declarations
      else if (isRangeMapDecl(decl)) {
        this.checkRangeMapDeclZeroPage(decl);
      }

      // Check @map sequential struct declarations
      else if (isSequentialStructMapDecl(decl)) {
        this.checkSequentialStructMapDeclZeroPage(decl);
      }

      // Check @map explicit struct declarations
      else if (isExplicitStructMapDecl(decl)) {
        this.checkExplicitStructMapDeclZeroPage(decl);
      }
    }
  }

  /**
   * Check @zp variable declaration for reserved zero-page violations
   *
   * @zp variables with explicit addresses need validation.
   * Note: @zp without address is allocated by compiler (safe).
   *
   * @param decl - Variable declaration to check
   */
  protected checkVariableDeclZeroPage(decl: VariableDecl): void {
    const storageClass = decl.getStorageClass();

    // Only check @zp declarations
    if (storageClass !== TokenType.ZP) {
      return;
    }

    // @zp without explicit address - compiler will allocate safely
    // The address is specified via metadata or symbol, not directly in AST
    // For now, we can't validate these until the memory layout pass assigns addresses
    // This will be validated in memory-layout.ts during address allocation
  }

  /**
   * Check @map simple declaration for reserved zero-page violations
   *
   * Simple @map: @map name at $ADDR: type
   *
   * @param decl - Simple map declaration to check
   */
  protected checkSimpleMapDeclZeroPage(decl: SimpleMapDecl): void {
    const address = this.extractAddressFromExpression(decl.getAddress());

    // Only validate if we can extract a constant address and it's in zero-page
    if (address !== null && address <= 0xff) {
      const size = this.getTypeSize(decl.getTypeAnnotation());
      const diagnostic = this.validateZeroPageAllocation(address, size, decl.getLocation());

      if (diagnostic) {
        this.diagnostics.push(diagnostic);
      }
    }
  }

  /**
   * Check @map range declaration for reserved zero-page violations
   *
   * Range @map: @map name from $START to $END: type
   *
   * @param decl - Range map declaration to check
   */
  protected checkRangeMapDeclZeroPage(decl: RangeMapDecl): void {
    const startAddress = this.extractAddressFromExpression(decl.getStartAddress());
    const endAddress = this.extractAddressFromExpression(decl.getEndAddress());

    // Only validate if we can extract constant addresses and they're in zero-page
    if (startAddress !== null && startAddress <= 0xff) {
      // Check start address
      if (M6502HintAnalyzer.isZeroPageReserved(startAddress)) {
        const reason = M6502HintAnalyzer.getReservationReason(startAddress);
        this.diagnostics.push({
          code: DiagnosticCode.RESERVED_ZERO_PAGE,
          severity: DiagnosticSeverity.ERROR,
          message: `@map range start address $${startAddress.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
          location: decl.getLocation(),
        });
      }
    }

    if (endAddress !== null && endAddress <= 0xff) {
      // Check end address
      if (M6502HintAnalyzer.isZeroPageReserved(endAddress)) {
        const reason = M6502HintAnalyzer.getReservationReason(endAddress);
        this.diagnostics.push({
          code: DiagnosticCode.RESERVED_ZERO_PAGE,
          severity: DiagnosticSeverity.ERROR,
          message: `@map range end address $${endAddress.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
          location: decl.getLocation(),
        });
      }
    }

    // Check if range spans into reserved area
    if (startAddress !== null && endAddress !== null) {
      if (startAddress <= 0xff || endAddress <= 0xff) {
        for (let addr = startAddress; addr <= endAddress && addr <= 0xff; addr++) {
          if (M6502HintAnalyzer.isZeroPageReserved(addr)) {
            const reason = M6502HintAnalyzer.getReservationReason(addr);
            this.diagnostics.push({
              code: DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED,
              severity: DiagnosticSeverity.ERROR,
              message: `@map range includes reserved zero-page address $${addr.toString(16).toUpperCase().padStart(2, '0')}: ${reason}. Safe range is $02-$8F.`,
              location: decl.getLocation(),
            });
            break; // Only report first violation
          }
        }
      }
    }
  }

  /**
   * Check @map sequential struct declaration for reserved zero-page violations
   *
   * Sequential @map: @map name at $BASE type ... end @map
   *
   * @param decl - Sequential struct map declaration to check
   */
  protected checkSequentialStructMapDeclZeroPage(decl: SequentialStructMapDecl): void {
    const baseAddress = this.extractAddressFromExpression(decl.getBaseAddress());

    // Only validate if base address is in zero-page
    if (baseAddress !== null && baseAddress <= 0xff) {
      // Calculate total struct size from fields
      let totalSize = 0;
      for (const field of decl.getFields()) {
        const fieldSize = this.getTypeSize(field.baseType);
        const count = field.arraySize ?? 1;
        totalSize += fieldSize * count;
      }

      // Validate the entire allocation
      const diagnostic = this.validateZeroPageAllocation(baseAddress, totalSize, decl.getLocation());

      if (diagnostic) {
        this.diagnostics.push(diagnostic);
      }
    }
  }

  /**
   * Check @map explicit struct declaration for reserved zero-page violations
   *
   * Explicit @map: @map name at $BASE layout ... end @map
   *
   * @param decl - Explicit struct map declaration to check
   */
  protected checkExplicitStructMapDeclZeroPage(decl: ExplicitStructMapDecl): void {
    const baseAddress = this.extractAddressFromExpression(decl.getBaseAddress());

    // Check base address if in zero-page
    if (baseAddress !== null && baseAddress <= 0xff) {
      if (M6502HintAnalyzer.isZeroPageReserved(baseAddress)) {
        const reason = M6502HintAnalyzer.getReservationReason(baseAddress);
        this.diagnostics.push({
          code: DiagnosticCode.RESERVED_ZERO_PAGE,
          severity: DiagnosticSeverity.ERROR,
          message: `@map struct base address $${baseAddress.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
          location: decl.getLocation(),
        });
      }
    }

    // Check each field's explicit address
    for (const field of decl.getFields()) {
      if (field.addressSpec.kind === 'single') {
        const fieldAddress = this.extractAddressFromExpression(field.addressSpec.address);
        if (fieldAddress !== null && fieldAddress <= 0xff) {
          const size = this.getTypeSize(field.typeAnnotation);
          const diagnostic = this.validateZeroPageAllocation(fieldAddress, size, field.location);
          if (diagnostic) {
            this.diagnostics.push(diagnostic);
          }
        }
      } else if (field.addressSpec.kind === 'range') {
        const startAddr = this.extractAddressFromExpression(field.addressSpec.startAddress);
        const endAddr = this.extractAddressFromExpression(field.addressSpec.endAddress);

        if (startAddr !== null && startAddr <= 0xff) {
          if (M6502HintAnalyzer.isZeroPageReserved(startAddr)) {
            const reason = M6502HintAnalyzer.getReservationReason(startAddr);
            this.diagnostics.push({
              code: DiagnosticCode.RESERVED_ZERO_PAGE,
              severity: DiagnosticSeverity.ERROR,
              message: `@map field '${field.name}' start address $${startAddr.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
              location: field.location,
            });
          }
        }

        if (endAddr !== null && endAddr <= 0xff) {
          if (M6502HintAnalyzer.isZeroPageReserved(endAddr)) {
            const reason = M6502HintAnalyzer.getReservationReason(endAddr);
            this.diagnostics.push({
              code: DiagnosticCode.RESERVED_ZERO_PAGE,
              severity: DiagnosticSeverity.ERROR,
              message: `@map field '${field.name}' end address $${endAddr.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
              location: field.location,
            });
          }
        }
      }
    }
  }

  /**
   * Extract numeric address from an expression
   *
   * Returns the address value if it's a constant literal, null otherwise.
   *
   * @param expr - Expression to extract address from
   * @returns Address value or null if not a constant
   */
  protected extractAddressFromExpression(expr: Expression): number | null {
    if (expr instanceof LiteralExpression) {
      const value = expr.getValue();
      if (typeof value === 'number') {
        return value;
      }
    }
    return null;
  }

  /**
   * Get size in bytes for a type annotation
   *
   * @param typeAnnotation - Type name (byte, word, etc.)
   * @returns Size in bytes
   */
  protected getTypeSize(typeAnnotation: string): number {
    switch (typeAnnotation.toLowerCase()) {
      case 'byte':
        return 1;
      case 'word':
        return 2;
      default:
        return 1; // Default to 1 byte for unknown types
    }
  }

  /**
   * Set 6502 metadata on AST nodes
   */
  protected setM6502Metadata(): void {
    for (const [_varName, hints] of this.variableHints) {
      const symbol = hints.symbol;
      const decl = symbol.declaration as VariableDecl;

      if (decl && decl.metadata) {
        // Set metadata
        decl.metadata.set(OptimizationMetadataKey.M6502ZeroPagePriority, hints.zpPriority);
        decl.metadata.set(
          OptimizationMetadataKey.M6502RegisterPreference,
          hints.registerPreference
        );

        // Estimate cycle count (simple heuristic)
        const cycleEstimate = this.estimateCycles(hints);
        decl.metadata.set(OptimizationMetadataKey.M6502CycleEstimate, cycleEstimate);
      }
    }
  }

  /**
   * Estimate cycle count for variable accesses
   *
   * Rough estimates:
   * - Zero-page: 3 cycles (LDA $ZP)
   * - Absolute: 4 cycles (LDA $ADDR)
   * - Indexed: 4-5 cycles (LDA $ADDR,X)
   *
   * @param hints - Variable hints
   * @returns Estimated cycles per access
   */
  protected estimateCycles(_hints: VariableHints): number {
    // TODO: Implement proper cycle estimation based on storage class
    // For now, return default estimate
    return 4; // Default to absolute addressing
  }

  /**
   * Get all diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get variable hints for debugging
   */
  public getVariableHints(): Map<string, VariableHints> {
    return new Map(this.variableHints);
  }

  /**
   * Get the target configuration used by this analyzer
   *
   * @returns Target configuration
   */
  public getTargetConfig(): TargetConfig {
    return this.targetConfig;
  }

  // ============================================
  // Target-Aware Zero-Page Methods (Instance)
  // ============================================

  /**
   * Check if address is in safe zero-page range for the target
   *
   * Uses the target configuration to determine the safe range.
   *
   * @param address - Address to check
   * @returns True if safe for the configured target
   *
   * @example
   * ```typescript
   * // C64: Safe range is $02-$8F
   * const c64Analyzer = new M6502HintAnalyzer(st, cfgs, c64Config);
   * c64Analyzer.isAddressSafeForTarget(0x50); // true
   * c64Analyzer.isAddressSafeForTarget(0x00); // false (CPU I/O)
   *
   * // X16: Safe range is $00-$15
   * const x16Analyzer = new M6502HintAnalyzer(st, cfgs, x16Config);
   * x16Analyzer.isAddressSafeForTarget(0x10); // true
   * x16Analyzer.isAddressSafeForTarget(0x50); // false (reserved)
   * ```
   */
  public isAddressSafeForTarget(address: number): boolean {
    const zp = this.targetConfig.zeroPage;
    return address >= zp.safeRange.start && address <= zp.safeRange.end;
  }

  /**
   * Check if address is reserved for the target
   *
   * Uses the target configuration's reserved ranges.
   *
   * @param address - Address to check
   * @returns True if address is reserved and cannot be used
   */
  public isAddressReservedForTarget(address: number): boolean {
    for (const range of this.targetConfig.zeroPage.reservedRanges) {
      if (address >= range.start && address <= range.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the reason why an address is reserved for the target
   *
   * @param address - Address to check
   * @returns Reason string, or undefined if not reserved
   */
  public getReservationReasonForTarget(address: number): string | undefined {
    for (const range of this.targetConfig.zeroPage.reservedRanges) {
      if (address >= range.start && address <= range.end) {
        return range.reason;
      }
    }
    return undefined;
  }

  /**
   * Get the safe zero-page range for the target
   *
   * @returns Safe range with start, end, and size
   */
  public getSafeZeroPageRangeForTarget(): { start: number; end: number; size: number } {
    const zp = this.targetConfig.zeroPage;
    return {
      start: zp.safeRange.start,
      end: zp.safeRange.end,
      size: zp.usableBytes,
    };
  }

  /**
   * Get all reserved zero-page ranges for the target
   *
   * @returns Array of reserved ranges
   */
  public getReservedRangesForTarget(): ReadonlyArray<ReservedZeroPageRange> {
    return this.targetConfig.zeroPage.reservedRanges;
  }

  /**
   * Validate a zero-page allocation for the target
   *
   * Uses the target configuration to validate the allocation.
   *
   * @param address - Starting address
   * @param size - Size in bytes
   * @param location - Source location for diagnostic
   * @returns Diagnostic if invalid, null if valid
   */
  public validateZeroPageAllocationForTarget(
    address: number,
    size: number,
    location: SourceLocation
  ): Diagnostic | null {
    const endAddress = address + size - 1;
    const safeRange = this.targetConfig.zeroPage.safeRange;

    // Check if allocation is within safe range
    if (address < safeRange.start || endAddress > safeRange.end) {
      // Check if it's in a reserved range
      for (const range of this.targetConfig.zeroPage.reservedRanges) {
        if (address >= range.start && address <= range.end) {
          return {
            code: DiagnosticCode.RESERVED_ZERO_PAGE,
            severity: DiagnosticSeverity.ERROR,
            message: `Zero-page address $${address.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${range.reason}. Safe range for ${this.targetConfig.architecture} is $${safeRange.start.toString(16).toUpperCase().padStart(2, '0')}-$${safeRange.end.toString(16).toUpperCase().padStart(2, '0')}.`,
            location,
          };
        }
      }

      // Check if end address extends into reserved range
      for (const range of this.targetConfig.zeroPage.reservedRanges) {
        if (endAddress >= range.start && endAddress <= range.end) {
          return {
            code: DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED,
            severity: DiagnosticSeverity.ERROR,
            message: `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} with size ${size} extends into reserved area at $${endAddress.toString(16).toUpperCase().padStart(2, '0')}: ${range.reason}. Safe range for ${this.targetConfig.architecture} is $${safeRange.start.toString(16).toUpperCase().padStart(2, '0')}-$${safeRange.end.toString(16).toUpperCase().padStart(2, '0')}.`,
            location,
          };
        }
      }
    }

    // Check each address in the allocation
    for (let addr = address; addr <= endAddress; addr++) {
      for (const range of this.targetConfig.zeroPage.reservedRanges) {
        if (addr >= range.start && addr <= range.end) {
          return {
            code: DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED,
            severity: DiagnosticSeverity.ERROR,
            message: `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} with size ${size} includes reserved address $${addr.toString(16).toUpperCase().padStart(2, '0')}: ${range.reason}. Safe range for ${this.targetConfig.architecture} is $${safeRange.start.toString(16).toUpperCase().padStart(2, '0')}-$${safeRange.end.toString(16).toUpperCase().padStart(2, '0')}.`,
            location,
          };
        }
      }
    }

    return null;
  }

  // ============================================
  // Static Methods (C64 Default - Backward Compatibility)
  // ============================================

  /**
   * Check if address is in safe zero-page range (C64 default)
   *
   * **Note:** This static method uses C64 default values for backward
   * compatibility. For target-aware checking, use the instance method
   * `isAddressSafeForTarget()`.
   *
   * @param address - Address to check
   * @returns True if safe (C64 safe range: $02-$8F)
   * @deprecated Use isAddressSafeForTarget() for target-aware checking
   */
  public static isZeroPageSafe(address: number): boolean {
    return address >= SAFE_ZERO_PAGE.start && address <= SAFE_ZERO_PAGE.end;
  }

  /**
   * Get safe zero-page range (C64 default)
   *
   * **Note:** This static method returns C64 default values for backward
   * compatibility. For target-aware range, use the instance method
   * `getSafeZeroPageRangeForTarget()`.
   *
   * @deprecated Use getSafeZeroPageRangeForTarget() for target-aware range
   */
  public static getSafeZeroPageRange(): { start: number; end: number; size: number } {
    return { ...SAFE_ZERO_PAGE };
  }

  /**
   * Check if a zero-page address is reserved (cannot be used)
   *
   * Reserved ranges:
   * - $00-$01: CPU memory configuration registers (6510 I/O port)
   * - $90-$FF: KERNAL workspace
   *
   * @param address - Zero-page address to check (0-255)
   * @returns True if address is reserved and cannot be used
   *
   * @example
   * ```typescript
   * M6502HintAnalyzer.isZeroPageReserved(0x00); // true - CPU config
   * M6502HintAnalyzer.isZeroPageReserved(0x02); // false - safe
   * M6502HintAnalyzer.isZeroPageReserved(0x90); // true - KERNAL
   * ```
   */
  public static isZeroPageReserved(address: number): boolean {
    for (const range of RESERVED_ZERO_PAGE) {
      if (address >= range.start && address <= range.end) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get the reason why a zero-page address is reserved
   *
   * @param address - Zero-page address to check (0-255)
   * @returns Human-readable reason why address is reserved, or undefined if safe
   *
   * @example
   * ```typescript
   * M6502HintAnalyzer.getReservationReason(0x00);
   * // "CPU memory configuration registers (6510 I/O port)"
   *
   * M6502HintAnalyzer.getReservationReason(0x50);
   * // undefined (address is safe)
   * ```
   */
  public static getReservationReason(address: number): string | undefined {
    for (const range of RESERVED_ZERO_PAGE) {
      if (address >= range.start && address <= range.end) {
        return range.reason;
      }
    }
    return undefined;
  }

  /**
   * Validate a zero-page allocation doesn't overlap reserved ranges
   *
   * Checks that the entire allocation (address to address + size - 1)
   * doesn't include any reserved addresses.
   *
   * @param address - Starting address of allocation
   * @param size - Size in bytes of allocation
   * @param location - Source location for diagnostic
   * @returns Diagnostic if allocation is invalid, null if valid
   *
   * @example
   * ```typescript
   * // Valid allocation at $02, size 1
   * validateZeroPageAllocation(0x02, 1, loc); // null
   *
   * // Invalid - starts in reserved area
   * validateZeroPageAllocation(0x00, 1, loc); // Diagnostic
   *
   * // Invalid - extends into reserved area
   * validateZeroPageAllocation(0x8F, 2, loc); // Diagnostic (ends at $90)
   * ```
   */
  public validateZeroPageAllocation(
    address: number,
    size: number,
    location: SourceLocation
  ): Diagnostic | null {
    const endAddress = address + size - 1;

    // Check start address
    if (M6502HintAnalyzer.isZeroPageReserved(address)) {
      const reason = M6502HintAnalyzer.getReservationReason(address);
      return {
        code: DiagnosticCode.RESERVED_ZERO_PAGE,
        severity: DiagnosticSeverity.ERROR,
        message: `Zero-page address $${address.toString(16).toUpperCase().padStart(2, '0')} is reserved: ${reason}. Safe range is $02-$8F.`,
        location,
      };
    }

    // Check end address (for multi-byte allocations)
    if (size > 1 && M6502HintAnalyzer.isZeroPageReserved(endAddress)) {
      const reason = M6502HintAnalyzer.getReservationReason(endAddress);
      return {
        code: DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED,
        severity: DiagnosticSeverity.ERROR,
        message: `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} with size ${size} extends into reserved area at $${endAddress.toString(16).toUpperCase().padStart(2, '0')}: ${reason}. Safe range is $02-$8F.`,
        location,
      };
    }

    // Check if any address in the range is reserved
    for (let addr = address; addr <= endAddress; addr++) {
      if (M6502HintAnalyzer.isZeroPageReserved(addr)) {
        const reason = M6502HintAnalyzer.getReservationReason(addr);
        return {
          code: DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED,
          severity: DiagnosticSeverity.ERROR,
          message: `Zero-page allocation at $${address.toString(16).toUpperCase().padStart(2, '0')} with size ${size} includes reserved address $${addr.toString(16).toUpperCase().padStart(2, '0')}: ${reason}. Safe range is $02-$8F.`,
          location,
        };
      }
    }

    return null;
  }

  /**
   * Get the reserved zero-page ranges
   *
   * Useful for diagnostics and documentation.
   *
   * @returns Array of reserved ranges with their reasons
   */
  public static getReservedRanges(): ReadonlyArray<Readonly<ReservedRange>> {
    return RESERVED_ZERO_PAGE;
  }

  // ============================================
  // Access Pattern Detection Methods (Task 8.13.4)
  // ============================================

  /**
   * Analyze access stride for a variable
   *
   * Examines the variable's induction variable metadata to determine
   * the stride (step) of access patterns. Used to detect sequential
   * (stride=1) vs strided (stride>1) access patterns.
   *
   * @param symbol - Symbol to analyze
   * @returns Access stride, or null if not a strided access pattern
   *
   * @example
   * ```typescript
   * // For loop counter: for i = 0; i < 10; i++
   * analyzeAccessStride(iSymbol); // 1 (sequential)
   *
   * // For strided access: for i = 0; i < 20; i += 2
   * analyzeAccessStride(iSymbol); // 2 (strided)
   *
   * // For random access variable
   * analyzeAccessStride(randomVar); // null
   * ```
   */
  public analyzeAccessStride(symbol: Symbol): number | null {
    // Check if variable has induction variable metadata
    const decl = symbol.declaration as VariableDecl | undefined;
    if (!decl?.metadata) {
      return null;
    }

    // Get induction variable info from loop analysis (Task 8.11)
    const inductionVarInfo = decl.metadata.get(
      OptimizationMetadataKey.LoopInductionVariable
    ) as InductionVariable | undefined;

    if (inductionVarInfo && inductionVarInfo.constantStep) {
      // Return the absolute stride value
      return Math.abs(inductionVarInfo.step);
    }

    // Check max loop depth - if in a loop, might have implicit stride
    const hints = this.variableHints.get(symbol.name);
    if (hints && hints.maxLoopDepth > 0 && hints.writeCount > 0) {
      // Variable is modified in a loop - likely has stride
      // Without explicit induction variable info, assume stride of 1
      return 1;
    }

    return null;
  }

  /**
   * Check if a variable has sequential access pattern
   *
   * A variable has sequential access if it's used as an induction
   * variable with a constant step of 1 (or -1 for counting down).
   *
   * @param symbol - Symbol to analyze
   * @returns True if variable has sequential (stride=1) access pattern
   *
   * @example
   * ```typescript
   * // Sequential: for i = 0; i < 10; i++
   * detectSequentialAccess(iSymbol); // true
   *
   * // Strided: for i = 0; i < 20; i += 2
   * detectSequentialAccess(iSymbol); // false (stride is 2)
   *
   * // Random access
   * detectSequentialAccess(randomVar); // false
   * ```
   */
  public detectSequentialAccess(symbol: Symbol): boolean {
    const stride = this.analyzeAccessStride(symbol);
    return stride === 1;
  }

  /**
   * Get detailed access pattern information for a variable
   *
   * Returns comprehensive information about how a variable is accessed,
   * including pattern type, stride, loop depth, and access counts.
   * This is useful for optimization decisions and debugging.
   *
   * @param varName - Name of variable to analyze
   * @returns Detailed access pattern information, or null if variable not found
   *
   * @example
   * ```typescript
   * const info = analyzer.getAccessPatternDetails('counter');
   * // {
   * //   pattern: MemoryAccessPattern.Sequential,
   * //   stride: 1,
   * //   loopDepth: 2,
   * //   accessCount: 15,
   * //   isInductionVariable: true,
   * //   hotPathAccesses: 10
   * // }
   * ```
   */
  public getAccessPatternDetails(varName: string): AccessPatternInfo | null {
    const hints = this.variableHints.get(varName);
    if (!hints) {
      return null;
    }

    const stride = this.analyzeAccessStride(hints.symbol);
    const isInductionVariable = this.isInductionVariable(hints.symbol);

    return {
      pattern: hints.accessPattern,
      stride: stride,
      loopDepth: hints.maxLoopDepth,
      accessCount: hints.readCount + hints.writeCount,
      isInductionVariable: isInductionVariable,
      hotPathAccesses: hints.hotPathAccesses,
    };
  }

  /**
   * Check if a symbol is an induction variable
   *
   * An induction variable is one that is systematically modified
   * in each loop iteration (typically a loop counter).
   *
   * @param symbol - Symbol to check
   * @returns True if symbol is an induction variable
   */
  protected isInductionVariable(symbol: Symbol): boolean {
    const decl = symbol.declaration as VariableDecl | undefined;
    if (!decl?.metadata) {
      return false;
    }

    const inductionVarInfo = decl.metadata.get(
      OptimizationMetadataKey.LoopInductionVariable
    ) as InductionVariable | undefined;

    return inductionVarInfo !== undefined;
  }

  /**
   * Detect access patterns with enhanced stride detection
   *
   * Updates the `detectAccessPatterns()` results for variables that have
   * induction variable metadata from loop analysis.
   *
   * Called internally by `analyze()` after basic pattern detection.
   *
   * @returns Map of variable names to their detected patterns
   */
  public detectAccessPatternsWithStride(): Map<string, MemoryAccessPattern> {
    const patterns = new Map<string, MemoryAccessPattern>();

    for (const [varName, hints] of this.variableHints) {
      let pattern = hints.accessPattern;

      // Enhanced detection using induction variable analysis
      if (hints.maxLoopDepth > 0) {
        const stride = this.analyzeAccessStride(hints.symbol);

        if (stride !== null) {
          if (stride === 1) {
            // Sequential access (stride = 1)
            pattern = MemoryAccessPattern.Sequential;
          } else if (stride > 1) {
            // Strided access (stride > 1)
            pattern = MemoryAccessPattern.Strided;
          }
        }
      }

      // Update hints with enhanced pattern
      hints.accessPattern = pattern;
      patterns.set(varName, pattern);
    }

    return patterns;
  }

  // ============================================
  // Zero-Page Priority Scoring Methods (Task 8.13.2)
  // ============================================

  /**
   * Calculate arithmetic intensity for a variable
   *
   * Measures how heavily a variable is used in arithmetic operations.
   * Variables with high arithmetic intensity benefit from:
   * - Zero-page access (faster load/store)
   * - A register preference (accumulator optimized for arithmetic)
   *
   * Heuristics:
   * - Base score from access patterns
   * - Bonus for induction variables (loop counters do arithmetic)
   * - Bonus for variables in deep loops (arithmetic often in loops)
   *
   * @param symbol - Symbol to analyze
   * @returns Arithmetic intensity score (0-10)
   *
   * @example
   * ```typescript
   * // Loop counter used in arithmetic: high intensity
   * // for (let i = 0; i < 10; i++) { sum = sum + arr[i]; }
   * calculateArithmeticIntensity(sumSymbol); // 8-10
   *
   * // Single-use flag variable: low intensity
   * // let done: bool = false;
   * calculateArithmeticIntensity(doneSymbol); // 0-2
   * ```
   */
  public calculateArithmeticIntensity(symbol: Symbol): number {
    const hints = this.variableHints.get(symbol.name);
    if (!hints) {
      return 0;
    }

    let intensity = 0;

    // Base: High read+write count suggests arithmetic use
    // Variables that are both read and written are likely used in arithmetic
    const totalAccesses = hints.readCount + hints.writeCount;
    if (hints.readCount > 0 && hints.writeCount > 0) {
      // Read-modify-write pattern (like x = x + 1) suggests arithmetic
      intensity += Math.min(4, Math.floor(totalAccesses / 3));
    }

    // Bonus for induction variables (loop counters are inherently arithmetic)
    if (this.isInductionVariable(symbol)) {
      intensity += 3;
    }

    // Bonus for deep loop usage (arithmetic often concentrated in loops)
    if (hints.maxLoopDepth > 0) {
      intensity += Math.min(3, hints.maxLoopDepth);
    }

    // Clamp to 0-10
    return Math.min(10, Math.max(0, intensity));
  }

  /**
   * Check if a variable is used as an array index
   *
   * Array index variables benefit from:
   * - Zero-page allocation (faster indexed addressing)
   * - X or Y register preference (used in indexed addressing modes)
   *
   * Detection heuristics:
   * - Induction variables are often used as array indices
   * - Variables with sequential access pattern are likely indices
   * - Variables in loops with write activity suggest index use
   *
   * @param symbol - Symbol to analyze
   * @returns True if variable is likely used as array index
   *
   * @example
   * ```typescript
   * // Loop counter used as array index
   * // for (let i = 0; i < 10; i++) { screen[i] = 0; }
   * isIndexVariable(iSymbol); // true
   *
   * // Non-index variable
   * // let total: word = 0;
   * isIndexVariable(totalSymbol); // false
   * ```
   */
  public isIndexVariable(symbol: Symbol): boolean {
    const hints = this.variableHints.get(symbol.name);
    if (!hints) {
      return false;
    }

    // Induction variables are very likely to be used as array indices
    if (this.isInductionVariable(symbol)) {
      return true;
    }

    // Sequential access pattern strongly suggests index usage
    if (hints.accessPattern === MemoryAccessPattern.Sequential) {
      return true;
    }

    // Strided access pattern also suggests index usage (e.g., i += 2)
    if (hints.accessPattern === MemoryAccessPattern.Strided) {
      return true;
    }

    // Variables that are modified in loops and have specific byte type
    // are often loop counters used as indices
    const type = symbol.type;
    if (hints.maxLoopDepth > 0 && hints.writeCount > 0 && type?.name === 'byte') {
      return true;
    }

    return false;
  }

  /**
   * Get detailed ZP priority breakdown for a variable
   *
   * Returns all priority factors that contribute to the ZP allocation
   * score. Useful for:
   * - Debugging why a variable has certain priority
   * - Optimization decision transparency
   * - IDE/tooling integration
   *
   * @param varName - Name of variable to get breakdown for
   * @returns Detailed factor breakdown, or null if variable not found
   *
   * @example
   * ```typescript
   * const breakdown = analyzer.getZPPriorityBreakdown('counter');
   * // {
   * //   accessFrequency: 15,
   * //   loopDepthBonus: 16,
   * //   hotPathBonus: 10,
   * //   sizeBonus: 10,
   * //   arithmeticBonus: 6,
   * //   indexBonus: 5,
   * //   total: 62
   * // }
   *
   * console.log(`Variable 'counter' has ZP priority ${breakdown.total}`);
   * console.log(`  - Access frequency: ${breakdown.accessFrequency}/30`);
   * console.log(`  - Loop depth bonus: ${breakdown.loopDepthBonus}/25`);
   * ```
   */
  public getZPPriorityBreakdown(varName: string): ZPPriorityFactors | null {
    const hints = this.variableHints.get(varName);
    if (!hints) {
      return null;
    }

    return this.calculateZPFactors(hints);
  }

  /**
   * Get ranked list of variables by ZP priority
   *
   * Returns all analyzed variables sorted by their ZP allocation priority,
   * highest first. Useful for:
   * - Memory allocation decisions
   * - Debugging ZP allocation order
   * - Optimization reports
   *
   * @returns Array of [varName, priority] pairs, sorted by priority descending
   *
   * @example
   * ```typescript
   * const rankings = analyzer.getZPPriorityRankings();
   * // [
   * //   ['loopCounter', 85],
   * //   ['screenPtr', 72],
   * //   ['tempByte', 45],
   * //   ['flags', 12]
   * // ]
   *
   * // Allocate ZP to top N variables
   * const zpVariables = rankings.slice(0, 10);
   * ```
   */
  public getZPPriorityRankings(): Array<[string, number]> {
    const rankings: Array<[string, number]> = [];

    for (const [varName, hints] of this.variableHints) {
      rankings.push([varName, hints.zpPriority]);
    }

    // Sort by priority descending (highest first)
    rankings.sort((a, b) => b[1] - a[1]);

    return rankings;
  }

  // ============================================
  // Register Preference Analysis Methods (Task 8.13.3)
  // ============================================

  /**
   * Detect if a variable is used as an array subscript
   *
   * Array index variables should prefer X or Y registers for
   * efficient indexed addressing modes:
   * - zp,X / zp,Y (4 cycles)
   * - abs,X / abs,Y (4-5 cycles)
   * - (zp,X) indexed indirect (6 cycles)
   * - (zp),Y indirect indexed (5-6 cycles)
   *
   * Detection heuristics:
   * 1. Induction variables in loops are commonly array indices
   * 2. Sequential/strided access patterns suggest index usage
   * 3. Byte variables modified in loops are likely indices
   *
   * @param symbol - Symbol to analyze
   * @returns True if variable is used as array subscript
   *
   * @example
   * ```typescript
   * // Array indexing pattern
   * // for (let i: byte = 0; i < 40; i++) { screen[i] = 32; }
   * detectArrayIndexUsage(iSymbol); // true
   *
   * // Non-index variable
   * // let total: word = 0;
   * detectArrayIndexUsage(totalSymbol); // false
   * ```
   */
  public detectArrayIndexUsage(symbol: Symbol): boolean {
    const hints = this.variableHints.get(symbol.name);
    if (!hints) {
      return false;
    }

    // Priority 1: Induction variables are very likely array indices
    // Loop counters are the most common array indices
    if (this.isInductionVariable(symbol)) {
      return true;
    }

    // Priority 2: Sequential access pattern indicates array iteration
    // Variables that step through memory sequentially
    if (hints.accessPattern === MemoryAccessPattern.Sequential) {
      return true;
    }

    // Priority 3: Strided access pattern indicates array iteration
    // e.g., screen[i * 40] for row-based access
    if (hints.accessPattern === MemoryAccessPattern.Strided) {
      return true;
    }

    // Priority 4: Byte variables modified in loops
    // Common pattern for 8-bit indices (0-255 range)
    const type = symbol.type;
    if (hints.maxLoopDepth > 0 && hints.writeCount > 0 && type?.name === 'byte') {
      return true;
    }

    return false;
  }

  /**
   * Detect if a variable is used in indirect addressing
   *
   * Variables used for indirect addressing should prefer Y register
   * because 6502 (zp),Y indirect indexed mode is the most flexible:
   * - (zp),Y: Load base address from zero-page, add Y offset
   * - Perfect for pointer arithmetic and buffer access
   *
   * Detection heuristics:
   * 1. Word (16-bit) variables are often pointers
   * 2. Variables used with address-of operator (@)
   * 3. Variables named with pointer conventions (ptr, pointer, addr)
   *
   * @param symbol - Symbol to analyze
   * @returns True if variable is used in indirect addressing
   *
   * @example
   * ```typescript
   * // Pointer variable (indirect addressing)
   * // let screenPtr: word = $0400;
   * // screenPtr[y] = charCode;  // Uses (zp),Y mode
   * detectIndirectAddressing(screenPtrSymbol); // true
   *
   * // Non-pointer variable
   * // let counter: byte = 0;
   * detectIndirectAddressing(counterSymbol); // false
   * ```
   */
  public detectIndirectAddressing(symbol: Symbol): boolean {
    const hints = this.variableHints.get(symbol.name);
    if (!hints) {
      return false;
    }

    // Priority 1: Word (16-bit) variables are likely pointers
    // Pointers need 16 bits to address full 64K memory space
    const type = symbol.type;
    if (type?.name === 'word') {
      // Check if the variable name suggests pointer usage
      const name = symbol.name.toLowerCase();
      if (
        name.includes('ptr') ||
        name.includes('pointer') ||
        name.includes('addr') ||
        name.includes('address') ||
        name.includes('screen') ||
        name.includes('buffer') ||
        name.includes('dest') ||
        name.includes('src') ||
        name.includes('source')
      ) {
        return true;
      }

      // Word variables used in hot paths might be used for indirect access
      if (hints.hotPathAccesses > 2) {
        return true;
      }
    }

    // Priority 2: Check if variable has address-of usage metadata
    // This would be set by earlier analysis passes
    const decl = symbol.declaration as VariableDecl | undefined;
    if (decl?.metadata) {
      const hasAddressOf = decl.metadata.get(OptimizationMetadataKey.UsageAddressOfTaken);
      if (hasAddressOf === true) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get human-readable reason for register preference
   *
   * Returns an explanation of why a particular register was
   * recommended for a variable. Useful for:
   * - Debugging register allocation decisions
   * - User-facing optimization reports
   * - IDE tooltips and hints
   *
   * @param symbol - Symbol to get preference reason for
   * @returns Human-readable explanation string
   *
   * @example
   * ```typescript
   * const reason = analyzer.getRegisterPreferenceReason(loopCounter);
   * // "Loop counter → X (optimal for loop operations)"
   *
   * const reason2 = analyzer.getRegisterPreferenceReason(screenPtr);
   * // "Indirect pointer → Y (required for (zp),Y addressing)"
   * ```
   */
  public getRegisterPreferenceReason(symbol: Symbol): string {
    const hints = this.variableHints.get(symbol.name);
    if (!hints) {
      return 'Unknown variable → Any (no analysis data)';
    }

    const register = hints.registerPreference;

    // Check each decision path in order to provide accurate reason
    switch (register) {
      case M6502Register.Y:
        // Y register: indirect addressing or inner loop
        if (this.detectIndirectAddressing(symbol)) {
          return 'Indirect pointer → Y (required for (zp),Y addressing)';
        }
        if (hints.maxLoopDepth > 1) {
          return 'Inner loop counter → Y (outer loop uses X)';
        }
        return 'Index variable → Y (available for indexed addressing)';

      case M6502Register.X:
        // X register: array index or loop counter
        if (this.detectArrayIndexUsage(symbol)) {
          return 'Array index → X (optimal for zp,X and abs,X modes)';
        }
        if (hints.isLoopCounter || this.isInductionVariable(symbol)) {
          return 'Loop counter → X (optimal for loop operations)';
        }
        if (hints.maxLoopDepth > 0 && hints.writeCount > 0) {
          return 'Loop variable → X (modified in loop)';
        }
        return 'Index variable → X (default index register)';

      case M6502Register.A:
        // A register: arithmetic or high frequency
        const intensity = this.calculateArithmeticIntensity(symbol);
        if (intensity >= 5) {
          return `Arithmetic-heavy → A (intensity ${intensity}/10)`;
        }
        if (hints.readCount + hints.writeCount > 10) {
          return `High frequency → A (${hints.readCount + hints.writeCount} accesses)`;
        }
        return 'Data variable → A (accumulator for processing)';

      case M6502Register.Any:
      default:
        // Any: no specific preference
        if (hints.readCount + hints.writeCount <= 1) {
          return 'Single-use variable → Any (no optimization benefit)';
        }
        return 'General variable → Any (no specific register benefit)';
    }
  }

  /**
   * Get register preference for a variable by name
   *
   * Convenience method to get the determined register preference
   * without needing direct access to variable hints.
   *
   * @param varName - Name of variable to check
   * @returns Register preference, or Any if variable not found
   *
   * @example
   * ```typescript
   * const pref = analyzer.getRegisterPreference('loopCounter');
   * // M6502Register.X
   * ```
   */
  public getRegisterPreference(varName: string): M6502Register {
    const hints = this.variableHints.get(varName);
    return hints?.registerPreference ?? M6502Register.Any;
  }

  /**
   * Get all variables with a specific register preference
   *
   * Useful for register allocation planning and debugging.
   *
   * @param register - Register to filter by
   * @returns Array of variable names that prefer this register
   *
   * @example
   * ```typescript
   * const xVars = analyzer.getVariablesPreferringRegister(M6502Register.X);
   * // ['loopCounter', 'arrayIndex']
   * ```
   */
  public getVariablesPreferringRegister(register: M6502Register): string[] {
    const variables: string[] = [];

    for (const [varName, hints] of this.variableHints) {
      if (hints.registerPreference === register) {
        variables.push(varName);
      }
    }

    return variables;
  }
}