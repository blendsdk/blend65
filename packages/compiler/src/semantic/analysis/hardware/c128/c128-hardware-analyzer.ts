/**
 * C128 Hardware Analyzer (Placeholder)
 *
 * **NOT YET IMPLEMENTED**
 *
 * This is a placeholder for the Commodore 128 hardware analyzer.
 * Currently returns warnings that C128 support is not implemented.
 *
 * **Future C128-Specific Analysis:**
 * - Zero-page validation (different KERNAL workspace than C64)
 * - VIC-II graphics chip analysis (same as C64)
 * - VDC 80-column chip analysis ($D600)
 * - Dual SID support
 * - 2 MHz mode considerations
 * - MMU configuration validation
 */

import type { Program } from '../../../../ast/nodes.js';
import { BaseHardwareAnalyzer } from '../base-hardware-analyzer.js';

/**
 * C128 Hardware Analyzer (Placeholder)
 *
 * Returns warnings that C128 is not implemented.
 * Allows analysis to continue without errors.
 */
export class C128HardwareAnalyzer extends BaseHardwareAnalyzer {
  /**
   * Get human-readable target name
   *
   * @returns "Commodore 128 (Not Implemented)"
   */
  public getTargetName(): string {
    return 'Commodore 128 (Not Implemented)';
  }

  /**
   * Pre-analysis hook - warn about unimplemented target
   *
   * @param ast - Program AST
   */
  protected preAnalysis(ast: Program): void {
    this.addWarning(
      'Commodore 128 target is not yet fully implemented. ' +
        'Hardware-specific analysis is skipped. ' +
        'Consider using C64 target (--target c64) for now.',
      ast.getLocation()
    );
  }

  /**
   * Analyze zero-page usage for C128 (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeZeroPage(_ast: Program): void {
    // C128 zero-page analysis not implemented
    // Would need to research C128 KERNAL zero-page usage
  }

  /**
   * Analyze graphics hardware usage (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeGraphics(_ast: Program): void {
    // C128 VIC-II/VDC analysis not implemented
  }

  /**
   * Analyze sound hardware usage (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeSound(_ast: Program): void {
    // C128 SID analysis not implemented
    // Would need to handle dual SID configuration
  }
}