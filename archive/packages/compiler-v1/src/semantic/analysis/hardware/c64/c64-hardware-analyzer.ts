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

import type { Program, VariableDecl, FunctionDecl } from '../../../../ast/nodes.js';
import type {
  SimpleMapDecl,
  RangeMapDecl,
  SequentialStructMapDecl,
  ExplicitStructMapDecl,
} from '../../../../ast/nodes.js';
import { LiteralExpression } from '../../../../ast/nodes.js';
import type { Expression, SourceLocation } from '../../../../ast/base.js';
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
import {
  SIDConflictAnalyzer,
  type SIDAnalysisResult,
  type VoiceConflict,
  type FilterConflict,
  type VolumeConflict,
  type SIDTimingRequirements,
  isSIDAddress,
  isSIDVoiceRegister,
  isSIDFilterRegister,
  isSIDVolumeRegister,
} from './sid-conflicts.js';

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

  /** SID conflict analyzer for sound analysis */
  protected sidConflictAnalyzer: SIDConflictAnalyzer | null = null;

  /** Collected SID analysis result */
  protected sidAnalysisResult: SIDAnalysisResult | null = null;

  /** SID timing requirements */
  protected sidTimingRequirements: SIDTimingRequirements | null = null;

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
  // SID Analysis Public API
  // ============================================

  /**
   * Get SID conflict analyzer instance
   *
   * Creates the analyzer on first access using the target config.
   * Returns null if target config has no sound chip.
   *
   * @returns SID conflict analyzer or null
   */
  public getSIDConflictAnalyzer(): SIDConflictAnalyzer | null {
    if (!this.sidConflictAnalyzer && this.targetConfig.soundChip) {
      this.sidConflictAnalyzer = new SIDConflictAnalyzer(this.targetConfig);
    }
    return this.sidConflictAnalyzer;
  }

  /**
   * Get SID analysis result
   *
   * Returns the complete SID analysis result from the last analysis.
   *
   * @returns SID analysis result or null if not analyzed
   */
  public getSIDAnalysisResult(): SIDAnalysisResult | null {
    return this.sidAnalysisResult;
  }

  /**
   * Get SID timing requirements
   *
   * Returns timing requirements based on SID usage patterns.
   *
   * @returns SID timing requirements or null if not analyzed
   */
  public getSIDTimingRequirements(): SIDTimingRequirements | null {
    return this.sidTimingRequirements;
  }

  /**
   * Get all detected SID voice conflicts
   *
   * @returns Array of voice conflicts
   */
  public getSIDVoiceConflicts(): VoiceConflict[] {
    return this.sidAnalysisResult?.voiceConflicts ?? [];
  }

  /**
   * Get all detected SID filter conflicts
   *
   * @returns Array of filter conflicts
   */
  public getSIDFilterConflicts(): FilterConflict[] {
    return this.sidAnalysisResult?.filterConflicts ?? [];
  }

  /**
   * Get all detected SID volume conflicts
   *
   * @returns Array of volume conflicts
   */
  public getSIDVolumeConflicts(): VolumeConflict[] {
    return this.sidAnalysisResult?.volumeConflicts ?? [];
  }

  /**
   * Check if any SID conflicts were detected
   *
   * @returns True if SID conflicts exist
   */
  public hasSIDConflicts(): boolean {
    return (this.sidAnalysisResult?.totalConflicts ?? 0) > 0;
  }

  /**
   * Check if code appears to be a music player
   *
   * Based on SID usage patterns (uses all 3 voices).
   *
   * @returns True if code likely contains a music player
   */
  public isMusicPlayer(): boolean {
    return this.sidTimingRequirements?.isMusicPlayer ?? false;
  }

  /**
   * Get count of SID voices being used
   *
   * @returns Number of voices used (0-3)
   */
  public getUsedSIDVoiceCount(): number {
    return this.sidTimingRequirements?.voicesUsed ?? 0;
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
    funcDecl: FunctionDecl,
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
   *
   * **Analysis Performed:**
   * - Voice conflict detection (multiple functions writing to same voice)
   * - Filter resource tracking (conflicting filter settings)
   * - Volume conflict detection (multiple volume controllers)
   * - IRQ timing analysis (music player detection)
   *
   * **Metadata Generated:**
   * - SIDVoiceUsage: Which voices are used
   * - SIDVoiceConflict: Voice allocation conflicts
   * - SIDFilterInUse: Filter usage detected
   * - SIDTimingRequirements: IRQ timing needs
   *
   * @param ast - Program AST
   */
  protected analyzeSound(ast: Program): void {
    // Initialize SID conflict analyzer
    const sidAnalyzer = this.getSIDConflictAnalyzer();
    if (!sidAnalyzer) {
      // No sound chip config, skip SID analysis
      return;
    }

    // Reset analyzer for fresh analysis
    sidAnalyzer.reset();

    // Clear previous analysis results
    this.sidAnalysisResult = null;
    this.sidTimingRequirements = null;

    const declarations = ast.getDeclarations();

    // Phase 1: Collect @map declarations that target SID addresses
    for (const decl of declarations) {
      if (isSimpleMapDecl(decl)) {
        this.trackSimpleMapDeclSID(decl, sidAnalyzer);
      } else if (isRangeMapDecl(decl)) {
        this.trackRangeMapDeclSID(decl, sidAnalyzer);
      } else if (isSequentialStructMapDecl(decl)) {
        this.trackSequentialStructMapDeclSID(decl, sidAnalyzer);
      } else if (isExplicitStructMapDecl(decl)) {
        this.trackExplicitStructMapDeclSID(decl, sidAnalyzer);
      }
    }

    // Phase 2: Analyze function bodies for SID register writes
    for (const decl of declarations) {
      if (isFunctionDecl(decl)) {
        this.analyzeFunctionSIDUsage(decl, sidAnalyzer);
      }
    }

    // Phase 3: Analyze all conflicts
    this.sidAnalysisResult = sidAnalyzer.analyzeAllConflicts();
    this.sidTimingRequirements = sidAnalyzer.estimateTimingRequirements();

    // Phase 4: Generate diagnostics from detected conflicts
    this.generateSIDConflictDiagnostics();
  }

  /**
   * Track @map simple declaration for SID registers
   *
   * @param decl - Simple map declaration
   * @param analyzer - SID conflict analyzer
   */
  protected trackSimpleMapDeclSID(decl: SimpleMapDecl, analyzer: SIDConflictAnalyzer): void {
    const address = this.extractAddressFromExpression(decl.getAddress());
    if (address === null || !isSIDAddress(address)) {
      return; // Not a SID address
    }

    const name = decl.getName();
    const location = decl.getLocation();

    // Track voice, filter, or volume register
    if (isSIDVoiceRegister(address)) {
      analyzer.trackVoiceWrite(address, `@map:${name}`, location);
    } else if (isSIDFilterRegister(address)) {
      analyzer.trackFilterWrite(address, `@map:${name}`, location);
    } else if (isSIDVolumeRegister(address)) {
      analyzer.trackVolumeWrite(`@map:${name}`, location);
    }
  }

  /**
   * Track @map range declaration for SID registers
   *
   * @param decl - Range map declaration
   * @param analyzer - SID conflict analyzer
   */
  protected trackRangeMapDeclSID(decl: RangeMapDecl, analyzer: SIDConflictAnalyzer): void {
    const startAddress = this.extractAddressFromExpression(decl.getStartAddress());
    const endAddress = this.extractAddressFromExpression(decl.getEndAddress());

    if (startAddress === null || endAddress === null) {
      return; // Can't determine range
    }

    // Check if range overlaps SID address space
    if (endAddress < 0xd400 || startAddress > 0xd41c) {
      return; // No SID overlap
    }

    const name = decl.getName();
    const location = decl.getLocation();

    // Track all SID addresses in range
    analyzer.trackVoiceWriteRange(
      Math.max(startAddress, 0xd400),
      Math.min(endAddress, 0xd41c),
      `@map:${name}`,
      location
    );

    // Track filter and volume if in range
    for (let addr = Math.max(startAddress, 0xd415); addr <= Math.min(endAddress, 0xd418); addr++) {
      if (isSIDFilterRegister(addr)) {
        analyzer.trackFilterWrite(addr, `@map:${name}`, location);
      } else if (isSIDVolumeRegister(addr)) {
        analyzer.trackVolumeWrite(`@map:${name}`, location);
      }
    }
  }

  /**
   * Track @map sequential struct declaration for SID registers
   *
   * @param decl - Sequential struct map declaration
   * @param analyzer - SID conflict analyzer
   */
  protected trackSequentialStructMapDeclSID(
    decl: SequentialStructMapDecl,
    analyzer: SIDConflictAnalyzer
  ): void {
    const baseAddress = this.extractAddressFromExpression(decl.getBaseAddress());
    if (baseAddress === null) {
      return;
    }

    const name = decl.getName();
    const location = decl.getLocation();

    // Calculate address range covered by struct
    let currentAddress = baseAddress;
    for (const field of decl.getFields()) {
      const fieldSize = this.getTypeSize(field.baseType);
      const count = field.arraySize ?? 1;
      const endAddress = currentAddress + fieldSize * count - 1;

      // Check if this field overlaps SID registers
      if (currentAddress <= 0xd41c && endAddress >= 0xd400) {
        // Track all SID addresses in this field
        for (let addr = Math.max(currentAddress, 0xd400); addr <= Math.min(endAddress, 0xd41c); addr++) {
          if (isSIDVoiceRegister(addr)) {
            analyzer.trackVoiceWrite(addr, `@map:${name}.${field.name}`, location);
          } else if (isSIDFilterRegister(addr)) {
            analyzer.trackFilterWrite(addr, `@map:${name}.${field.name}`, location);
          } else if (isSIDVolumeRegister(addr)) {
            analyzer.trackVolumeWrite(`@map:${name}.${field.name}`, location);
          }
        }
      }

      currentAddress += fieldSize * count;
    }
  }

  /**
   * Track @map explicit struct declaration for SID registers
   *
   * @param decl - Explicit struct map declaration
   * @param analyzer - SID conflict analyzer
   */
  protected trackExplicitStructMapDeclSID(
    decl: ExplicitStructMapDecl,
    analyzer: SIDConflictAnalyzer
  ): void {
    const name = decl.getName();

    for (const field of decl.getFields()) {
      if (field.addressSpec.kind === 'single') {
        const address = this.extractAddressFromExpression(field.addressSpec.address);
        if (address !== null && isSIDAddress(address)) {
          if (isSIDVoiceRegister(address)) {
            analyzer.trackVoiceWrite(address, `@map:${name}.${field.name}`, field.location);
          } else if (isSIDFilterRegister(address)) {
            analyzer.trackFilterWrite(address, `@map:${name}.${field.name}`, field.location);
          } else if (isSIDVolumeRegister(address)) {
            analyzer.trackVolumeWrite(`@map:${name}.${field.name}`, field.location);
          }
        }
      } else if (field.addressSpec.kind === 'range') {
        const startAddr = this.extractAddressFromExpression(field.addressSpec.startAddress);
        const endAddr = this.extractAddressFromExpression(field.addressSpec.endAddress);
        if (startAddr !== null && endAddr !== null) {
          for (let addr = Math.max(startAddr, 0xd400); addr <= Math.min(endAddr, 0xd41c); addr++) {
            if (isSIDVoiceRegister(addr)) {
              analyzer.trackVoiceWrite(addr, `@map:${name}.${field.name}`, field.location);
            } else if (isSIDFilterRegister(addr)) {
              analyzer.trackFilterWrite(addr, `@map:${name}.${field.name}`, field.location);
            } else if (isSIDVolumeRegister(addr)) {
              analyzer.trackVolumeWrite(`@map:${name}.${field.name}`, field.location);
            }
          }
        }
      }
    }
  }

  /**
   * Analyze function body for SID register usage
   *
   * Tracks any SID register writes within the function body.
   * This is used to detect voice/filter/volume conflicts.
   *
   * @param funcDecl - Function declaration
   * @param _analyzer - SID conflict analyzer (unused in current implementation)
   */
  protected analyzeFunctionSIDUsage(
    funcDecl: FunctionDecl,
    _analyzer: SIDConflictAnalyzer
  ): void {
    const body = funcDecl.getBody();

    if (!body) {
      return; // No body (extern function)
    }

    // For now, track the function as a potential SID user if it has
    // any assignments to @map variables that target SID addresses.
    // More sophisticated analysis would walk the AST to find actual
    // SID register writes within function body.
    //
    // Note: The @map declarations are already tracked above.
    // Function-level tracking provides the "which function uses which voice"
    // information needed for conflict detection.
    //
    // A more advanced implementation would:
    // 1. Walk the function body AST
    // 2. Find assignment expressions
    // 3. Check if left-hand side resolves to a SID @map variable
    // 4. Track that write with this function's name
    //
    // For now, the @map-level tracking provides basic conflict detection.
    // Functions that use @map variables targeting the same SID registers
    // will be detected through the @map tracking.
  }

  /**
   * Generate diagnostics from detected SID conflicts
   *
   * Converts SID conflicts into compiler diagnostics.
   */
  protected generateSIDConflictDiagnostics(): void {
    if (!this.sidAnalysisResult) {
      return;
    }

    // Generate voice conflict diagnostics
    for (const conflict of this.sidAnalysisResult.voiceConflicts) {
      const voiceNum = conflict.voice + 1; // 1-based for display
      if (conflict.severity === 'error') {
        this.addError(
          conflict.message,
          conflict.locations[0] ?? this.createDefaultLocation(),
          DiagnosticCode.SID_VOICE_CONFLICT
        );
      } else {
        this.addWarning(
          `SID Voice ${voiceNum} is written by multiple sources: ${conflict.functions.join(', ')}. ` +
            `This may cause audio conflicts.`,
          conflict.locations[0] ?? this.createDefaultLocation(),
          DiagnosticCode.SID_VOICE_CONFLICT
        );
      }
    }

    // Generate filter conflict diagnostics
    for (const conflict of this.sidAnalysisResult.filterConflicts) {
      this.addWarning(
        conflict.message,
        conflict.locations[0] ?? this.createDefaultLocation(),
        DiagnosticCode.SID_FILTER_CONFLICT
      );
    }

    // Generate volume conflict diagnostics
    for (const conflict of this.sidAnalysisResult.volumeConflicts) {
      this.addWarning(
        conflict.message,
        conflict.locations[0] ?? this.createDefaultLocation(),
        DiagnosticCode.SID_VOLUME_CONFLICT
      );
    }

    // Generate timing recommendation if detected as music player
    if (this.sidTimingRequirements?.isMusicPlayer) {
      this.addInfo(
        this.sidTimingRequirements.recommendation,
        this.createDefaultLocation(),
        DiagnosticCode.SID_IRQ_TIMING
      );
    }
  }

  /**
   * Create a default source location for diagnostics without specific location
   *
   * @returns Default source location
   */
  protected createDefaultLocation(): SourceLocation {
    return {
      start: { line: 1, column: 1, offset: 0 },
      end: { line: 1, column: 1, offset: 0 },
    };
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