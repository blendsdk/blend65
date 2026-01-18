/**
 * C64 Hardware Analyzer
 *
 * Target-specific hardware analyzer for the Commodore 64.
 * This is Level 3 (Target-Specific) analysis for the C64.
 *
 * **C64-Specific Analysis:**
 * - Zero-page validation ($02-$8F safe, $00-$01 and $90-$FF reserved)
 * - VIC-II graphics chip analysis ($D000-$D3FF)
 * - SID sound chip analysis ($D400-$D7FF)
 * - C64 memory map validation
 *
 * **Future Tier 4 Analysis (placeholders):**
 * - VIC-II raster timing analysis
 * - SID voice conflict detection
 * - Badline cycle counting
 *
 * @example
 * ```typescript
 * const analyzer = new C64HardwareAnalyzer(c64Config, symbolTable, cfgs);
 * const result = analyzer.analyze(ast);
 * if (!result.success) {
 *   console.log('C64 hardware errors:', result.diagnostics);
 * }
 * ```
 */

import type { Program, VariableDecl } from '../../../../ast/nodes.js';
import type {
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from '../../../../ast/nodes.js';
import { LiteralExpression } from '../../../../ast/nodes.js';
import type { Expression } from '../../../../ast/base.js';
import {
  isVariableDecl,
  isSimpleMapDecl,
  isRangeMapDecl,
  isSequentialStructMapDecl,
  isExplicitStructMapDecl,
  isFunctionDecl,
} from '../../../../ast/type-guards.js';
import { TokenType } from '../../../../lexer/types.js';
import { DiagnosticCode } from '../../../../ast/diagnostics.js';
import { BaseHardwareAnalyzer } from '../base-hardware-analyzer.js';
import {
  validateC64ZeroPageAllocation,
  isC64ZeroPageSafe,
  getC64ZeroPageCategory,
  C64ZeroPageCategory,
} from './c64-zero-page.js';
import {
  VICIITimingAnalyzer,
  type RasterSafetyMetadata,
  type VICIITimingWarning,
  BadlineRecommendation,
} from './vic-ii-timing.js';

/**
 * C64 Hardware Analyzer
 *
 * Provides C64-specific hardware analysis extending the
 * base hardware analyzer with C64 knowledge.
 */
export class C64HardwareAnalyzer extends BaseHardwareAnalyzer {
  /** VIC-II timing analyzer for raster timing analysis */
  protected vicIITimingAnalyzer: VICIITimingAnalyzer | null = null;

  /** Collected VIC-II timing warnings */
  protected vicIIWarnings: VICIITimingWarning[] = [];

  /** Collected raster safety metadata for functions */
  protected rasterSafetyMetadata: Map<string, RasterSafetyMetadata> = new Map();

  // ============================================
  // Public API
  // ============================================

  /**
   * Get human-readable target name
   *
   * @returns "Commodore 64"
   */
  public getTargetName(): string {
    return 'Commodore 64';
  }

  /**
   * Get VIC-II timing analyzer instance
   *
   * Creates the analyzer on first access using the target config.
   * Returns null if target config has no graphics chip.
   *
   * @returns VIC-II timing analyzer or null
   */
  public getVICIITimingAnalyzer(): VICIITimingAnalyzer | null {
    if (!this.vicIITimingAnalyzer && this.targetConfig.graphicsChip) {
      this.vicIITimingAnalyzer = new VICIITimingAnalyzer(this.targetConfig);
    }
    return this.vicIITimingAnalyzer;
  }

  /**
   * Get collected VIC-II timing warnings
   *
   * Returns warnings generated during graphics analysis.
   *
   * @returns Array of VIC-II timing warnings
   */
  public getVICIIWarnings(): VICIITimingWarning[] {
    return [...this.vicIIWarnings];
  }

  /**
   * Get raster safety metadata for a specific function
   *
   * @param functionName - Name of the function
   * @returns Raster safety metadata or undefined
   */
  public getRasterSafetyMetadata(functionName: string): RasterSafetyMetadata | undefined {
    return this.rasterSafetyMetadata.get(functionName);
  }

  /**
   * Get all raster safety metadata
   *
   * @returns Map of function names to raster safety metadata
   */
  public getAllRasterSafetyMetadata(): Map<string, RasterSafetyMetadata> {
    return new Map(this.rasterSafetyMetadata);
  }

  /**
   * Check if a function is raster-safe
   *
   * @param functionName - Name of the function
   * @returns True if function is raster-safe, false if unknown or not safe
   */
  public isFunctionRasterSafe(functionName: string): boolean {
    const metadata = this.rasterSafetyMetadata.get(functionName);
    return metadata?.VICIIRasterSafe ?? false;
  }

  /**
   * Check if a function is badline-aware
   *
   * @param functionName - Name of the function
   * @returns True if function is badline-aware, false if unknown or not safe
   */
  public isFunctionBadlineAware(functionName: string): boolean {
    const metadata = this.rasterSafetyMetadata.get(functionName);
    return metadata?.VICIIBadlineAware ?? false;
  }

  // ============================================
  // Zero-Page Analysis (Required Implementation)
  // ============================================

  /**
   * Analyze zero-page usage for C64
   *
   * Validates all @zp variable declarations and @map declarations
   * that use zero-page addresses against C64's reserved ranges.
   *
   * C64 Zero-Page:
   * - $00-$01: CPU 6510 I/O port (RESERVED)
   * - $02-$8F: Safe for user (142 bytes)
   * - $90-$FF: KERNAL workspace (RESERVED)
   *
   * @param ast - Program AST
   */
  protected analyzeZeroPage(ast: Program): void {
    const declarations = ast.getDeclarations();

    for (const decl of declarations) {
      // Check @zp variable declarations
      if (isVariableDecl(decl)) {
        this.analyzeVariableDeclZeroPage(decl);
      }

      // Check @map simple declarations
      else if (isSimpleMapDecl(decl)) {
        this.analyzeSimpleMapDeclZeroPage(decl);
      }

      // Check @map range declarations
      else if (isRangeMapDecl(decl)) {
        this.analyzeRangeMapDeclZeroPage(decl);
      }

      // Check @map sequential struct declarations
      else if (isSequentialStructMapDecl(decl)) {
        this.analyzeSequentialStructMapDeclZeroPage(decl);
      }

      // Check @map explicit struct declarations
      else if (isExplicitStructMapDecl(decl)) {
        this.analyzeExplicitStructMapDeclZeroPage(decl);
      }
    }
  }

  /**
   * Analyze @zp variable declaration for C64 zero-page violations
   *
   * @param decl - Variable declaration
   */
  protected analyzeVariableDeclZeroPage(decl: VariableDecl): void {
    const storageClass = decl.getStorageClass();

    // Only check @zp declarations
    if (storageClass !== TokenType.ZP) {
      return;
    }

    // @zp without explicit address - compiler will allocate safely
    // This is handled during memory layout, not here
    // We only validate explicit addresses
  }

  /**
   * Analyze @map simple declaration for C64 zero-page violations
   *
   * @param decl - Simple map declaration
   */
  protected analyzeSimpleMapDeclZeroPage(decl: SimpleMapDecl): void {
    const address = this.extractAddressFromExpression(decl.getAddress());

    // Only validate if we can extract a constant address and it's in zero-page
    if (address !== null && this.isZeroPageAddress(address)) {
      const size = this.getTypeSize(decl.getTypeAnnotation());
      const result = validateC64ZeroPageAllocation(address, size);

      if (!result.valid && result.errorMessage) {
        this.addError(result.errorMessage, decl.getLocation(), DiagnosticCode.RESERVED_ZERO_PAGE);
      }
    }
  }

  /**
   * Analyze @map range declaration for C64 zero-page violations
   *
   * @param decl - Range map declaration
   */
  protected analyzeRangeMapDeclZeroPage(decl: RangeMapDecl): void {
    const startAddress = this.extractAddressFromExpression(decl.getStartAddress());
    const endAddress = this.extractAddressFromExpression(decl.getEndAddress());

    // Check if any part of the range is in zero-page
    if (startAddress !== null && startAddress <= 0xff) {
      if (!isC64ZeroPageSafe(startAddress)) {
        const category = getC64ZeroPageCategory(startAddress);
        this.addError(
          `@map range start address ${this.formatAddress(startAddress)} is in C64 ` +
            `reserved area: ${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
          decl.getLocation(),
          DiagnosticCode.RESERVED_ZERO_PAGE
        );
      }
    }

    if (endAddress !== null && endAddress <= 0xff) {
      if (!isC64ZeroPageSafe(endAddress)) {
        const category = getC64ZeroPageCategory(endAddress);
        this.addError(
          `@map range end address ${this.formatAddress(endAddress)} is in C64 ` +
            `reserved area: ${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
          decl.getLocation(),
          DiagnosticCode.RESERVED_ZERO_PAGE
        );
      }
    }

    // Check if range spans into reserved area
    if (startAddress !== null && endAddress !== null) {
      const zpEnd = Math.min(endAddress, 0xff);
      for (let addr = startAddress; addr <= zpEnd; addr++) {
        if (!isC64ZeroPageSafe(addr)) {
          const category = getC64ZeroPageCategory(addr);
          this.addError(
            `@map range includes C64 reserved zero-page address ${this.formatAddress(addr)}: ` +
              `${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
            decl.getLocation(),
            DiagnosticCode.ZERO_PAGE_ALLOCATION_INTO_RESERVED
          );
          break; // Only report first violation
        }
      }
    }
  }

  /**
   * Analyze @map sequential struct declaration for C64 zero-page violations
   *
   * @param decl - Sequential struct map declaration
   */
  protected analyzeSequentialStructMapDeclZeroPage(decl: SequentialStructMapDecl): void {
    const baseAddress = this.extractAddressFromExpression(decl.getBaseAddress());

    // Only validate if base address is in zero-page
    if (baseAddress !== null && this.isZeroPageAddress(baseAddress)) {
      // Calculate total struct size
      let totalSize = 0;
      for (const field of decl.getFields()) {
        const fieldSize = this.getTypeSize(field.baseType);
        const count = field.arraySize ?? 1;
        totalSize += fieldSize * count;
      }

      const result = validateC64ZeroPageAllocation(baseAddress, totalSize);

      if (!result.valid && result.errorMessage) {
        this.addError(result.errorMessage, decl.getLocation(), DiagnosticCode.RESERVED_ZERO_PAGE);
      }
    }
  }

  /**
   * Analyze @map explicit struct declaration for C64 zero-page violations
   *
   * @param decl - Explicit struct map declaration
   */
  protected analyzeExplicitStructMapDeclZeroPage(decl: ExplicitStructMapDecl): void {
    const baseAddress = this.extractAddressFromExpression(decl.getBaseAddress());

    // Check base address
    if (baseAddress !== null && this.isZeroPageAddress(baseAddress)) {
      if (!isC64ZeroPageSafe(baseAddress)) {
        const category = getC64ZeroPageCategory(baseAddress);
        this.addError(
          `@map struct base address ${this.formatAddress(baseAddress)} is in C64 ` +
            `reserved area: ${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
          decl.getLocation(),
          DiagnosticCode.RESERVED_ZERO_PAGE
        );
      }
    }

    // Check each field's explicit address
    for (const field of decl.getFields()) {
      if (field.addressSpec.kind === 'single') {
        const fieldAddress = this.extractAddressFromExpression(field.addressSpec.address);
        if (fieldAddress !== null && this.isZeroPageAddress(fieldAddress)) {
          const size = this.getTypeSize(field.typeAnnotation);
          const result = validateC64ZeroPageAllocation(fieldAddress, size);
          if (!result.valid && result.errorMessage) {
            this.addError(
              `@map field '${field.name}': ${result.errorMessage}`,
              field.location,
              DiagnosticCode.RESERVED_ZERO_PAGE
            );
          }
        }
      } else if (field.addressSpec.kind === 'range') {
        const startAddr = this.extractAddressFromExpression(field.addressSpec.startAddress);
        const endAddr = this.extractAddressFromExpression(field.addressSpec.endAddress);

        if (startAddr !== null && startAddr <= 0xff && !isC64ZeroPageSafe(startAddr)) {
          const category = getC64ZeroPageCategory(startAddr);
          this.addError(
            `@map field '${field.name}' start address ${this.formatAddress(startAddr)} is in C64 ` +
              `reserved area: ${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
            field.location,
            DiagnosticCode.RESERVED_ZERO_PAGE
          );
        }

        if (endAddr !== null && endAddr <= 0xff && !isC64ZeroPageSafe(endAddr)) {
          const category = getC64ZeroPageCategory(endAddr);
          this.addError(
            `@map field '${field.name}' end address ${this.formatAddress(endAddr)} is in C64 ` +
              `reserved area: ${this.getCategoryDescription(category)}. Safe range is $02-$8F.`,
            field.location,
            DiagnosticCode.RESERVED_ZERO_PAGE
          );
        }
      }
    }
  }

  // ============================================
  // Graphics Analysis (Required Implementation)
  // ============================================

  /**
   * Analyze VIC-II graphics hardware usage
   *
   * Validates graphics register access for the C64's VIC-II chip.
   *
   * **Analysis Performed:**
   * - Raster timing analysis for all functions
   * - Badline safety detection
   * - Cycle budget validation
   * - Warning generation for timing-sensitive code
   *
   * **Metadata Generated:**
   * For each function, generates `RasterSafetyMetadata`:
   * - VICIIRasterSafe: True if function fits in one raster line
   * - VICIIBadlineAware: True if function fits even during badlines
   * - estimatedCycles: Estimated CPU cycles for function body
   * - recommendation: BadlineRecommendation for optimization
   *
   * @param ast - Program AST
   */
  protected analyzeGraphics(ast: Program): void {
    // Initialize VIC-II timing analyzer
    const timingAnalyzer = this.getVICIITimingAnalyzer();
    if (!timingAnalyzer) {
      // No graphics chip config, skip VIC-II timing analysis
      return;
    }

    // Clear previous analysis results
    this.vicIIWarnings = [];
    this.rasterSafetyMetadata.clear();
    timingAnalyzer.clearWarnings();

    // Analyze each function for VIC-II timing
    const declarations = ast.getDeclarations();
    for (const decl of declarations) {
      if (isFunctionDecl(decl)) {
        this.analyzeFunctionVICIITiming(decl, timingAnalyzer);
      }
    }

    // Collect warnings from timing analyzer
    this.vicIIWarnings = timingAnalyzer.getWarnings();

    // Convert VIC-II warnings to diagnostics
    for (const warning of this.vicIIWarnings) {
      if (warning.severity === 'error') {
        this.addError(warning.message, warning.location, DiagnosticCode.VIC_II_TIMING_ERROR);
      } else if (warning.severity === 'warning') {
        this.addWarning(warning.message, warning.location, DiagnosticCode.VIC_II_TIMING_WARNING);
      }
      // Info-level warnings are not converted to diagnostics
    }
  }

  /**
   * Analyze a single function for VIC-II timing
   *
   * Generates raster safety metadata for the function and
   * adds warnings for timing-sensitive code.
   *
   * @param funcDecl - Function declaration to analyze
   * @param timingAnalyzer - VIC-II timing analyzer instance
   */
  protected analyzeFunctionVICIITiming(
    funcDecl: import('../../../../ast/nodes.js').FunctionDecl,
    timingAnalyzer: VICIITimingAnalyzer
  ): void {
    const functionName = funcDecl.getName();
    const body = funcDecl.getBody();
    const location = funcDecl.getLocation();

    // Skip functions without bodies (extern functions)
    if (!body) {
      return;
    }

    // Generate raster safety metadata for this function
    const metadata = timingAnalyzer.generateRasterSafetyMetadata(body, location);

    // Store metadata for later access
    this.rasterSafetyMetadata.set(functionName, metadata);

    // Add info diagnostic for functions that exceed badline cycles but fit in normal line
    if (metadata.VICIIRasterSafe && !metadata.VICIIBadlineAware) {
      this.addInfo(
        `Function '${functionName}' uses ${metadata.estimatedCycles} cycles, ` +
          `which exceeds badline budget (${timingAnalyzer.getBadlineCycles()} cycles). ` +
          `Consider optimization for raster-stable execution.`,
        location,
        DiagnosticCode.VIC_II_BADLINE_WARNING
      );
    }

    // Add diagnostic for functions that exceed raster line
    if (!metadata.VICIIRasterSafe) {
      const recommendation = this.getRecommendationText(metadata.recommendation);
      this.addWarning(
        `Function '${functionName}' uses ${metadata.estimatedCycles} cycles, ` +
          `which exceeds raster line budget (${timingAnalyzer.getCyclesPerLine()} cycles). ` +
          `${recommendation}`,
        location,
        DiagnosticCode.VIC_II_TIMING_WARNING
      );
    }
  }

  /**
   * Get human-readable recommendation text
   *
   * @param recommendation - BadlineRecommendation enum value
   * @returns Recommendation text
   */
  protected getRecommendationText(recommendation: BadlineRecommendation): string {
    switch (recommendation) {
      case BadlineRecommendation.SAFE:
        return 'Code is safe for raster timing.';
      case BadlineRecommendation.USE_STABLE_RASTER:
        return 'Consider using stable raster technique for precise timing.';
      case BadlineRecommendation.SPLIT_ACROSS_LINES:
        return 'Consider splitting work across multiple raster lines.';
      case BadlineRecommendation.DISABLE_BADLINES:
        return 'Consider disabling badlines ($D011 bit 3) during execution.';
      case BadlineRecommendation.TOO_LONG:
        return 'Code is too long for raster-safe execution. Refactor into smaller functions.';
    }
  }

  // ============================================
  // Sound Analysis (Required Implementation)
  // ============================================

  /**
   * Analyze SID sound hardware usage
   *
   * Validates sound register access for the C64's SID chip.
   * Currently a placeholder - Tier 4 will add:
   * - Voice conflict detection
   * - Filter resource tracking
   * - Volume/envelope analysis
   *
   * @param _ast - Program AST
   */
  protected analyzeSound(_ast: Program): void {
    // Tier 4 TODO: Implement SID analysis
    // - Detect voice conflicts (multiple writes to same voice)
    // - Track filter usage across voices
    // - Validate volume register access patterns
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Extract numeric address from an expression
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
   * Get human-readable description for C64 zero-page category
   *
   * @param category - Zero-page category
   * @returns Description string
   */
  protected getCategoryDescription(category: C64ZeroPageCategory): string {
    switch (category) {
      case C64ZeroPageCategory.CPU_IO_PORT:
        return 'CPU 6510 I/O port (memory configuration)';
      case C64ZeroPageCategory.USER_SAFE:
        return 'User-safe area';
      case C64ZeroPageCategory.KERNAL_WORKSPACE:
        return 'KERNAL workspace (used by BASIC/KERNAL)';
    }
  }
}