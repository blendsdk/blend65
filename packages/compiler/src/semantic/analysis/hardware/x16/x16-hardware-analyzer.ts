/**
 * X16 Hardware Analyzer (Placeholder)
 *
 * **NOT YET IMPLEMENTED**
 *
 * This is a placeholder for the Commander X16 hardware analyzer.
 * Currently returns warnings that X16 support is not implemented.
 *
 * **Future X16-Specific Analysis:**
 * - Zero-page validation (only 22 bytes available: $00-$15)
 * - VERA graphics chip analysis ($9F20+)
 * - YM2151 FM sound chip analysis
 * - VERA PSG sound analysis
 * - 65C02 extended opcode support
 * - Bank switching validation
 */

import type { Program } from '../../../../ast/nodes.js';
import { BaseHardwareAnalyzer } from '../base-hardware-analyzer.js';

/**
 * X16 Hardware Analyzer (Placeholder)
 *
 * Returns warnings that X16 is not implemented.
 * Allows analysis to continue without errors.
 */
export class X16HardwareAnalyzer extends BaseHardwareAnalyzer {
  /**
   * Get human-readable target name
   *
   * @returns "Commander X16 (Not Implemented)"
   */
  public getTargetName(): string {
    return 'Commander X16 (Not Implemented)';
  }

  /**
   * Pre-analysis hook - warn about unimplemented target
   *
   * @param ast - Program AST
   */
  protected preAnalysis(ast: Program): void {
    this.addWarning(
      'Commander X16 target is not yet fully implemented. ' +
        'Hardware-specific analysis is skipped. ' +
        'Note: X16 has only 22 zero-page bytes available ($00-$15). ' +
        'Consider using C64 target (--target c64) for now.',
      ast.getLocation()
    );
  }

  /**
   * Analyze zero-page usage for X16 (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeZeroPage(_ast: Program): void {
    // X16 zero-page analysis not implemented
    // X16 only has 22 bytes of user zero-page ($00-$15)
    // This is much more restrictive than C64's 142 bytes
  }

  /**
   * Analyze VERA graphics hardware usage (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeGraphics(_ast: Program): void {
    // X16 VERA analysis not implemented
    // VERA is completely different from VIC-II
    // - No badlines
    // - Different register layout
    // - Different timing (40 MHz effective)
  }

  /**
   * Analyze YM2151/PSG sound hardware usage (placeholder)
   *
   * @param _ast - Program AST
   */
  protected analyzeSound(_ast: Program): void {
    // X16 sound analysis not implemented
    // X16 has YM2151 FM chip + VERA PSG
    // Very different from SID
  }
}