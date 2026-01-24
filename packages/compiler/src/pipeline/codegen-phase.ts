/**
 * Code Generation Phase (Stub)
 *
 * Generates target code from optimized IL.
 * This is a **stub implementation** for Phase 1 - real code
 * generation will be implemented in Phase 2.
 *
 * **Phase Responsibilities:**
 * - Generate 6502 assembly from IL
 * - Produce binary .prg files
 * - Generate source maps
 * - Create VICE label files
 *
 * **Stub Implementation:**
 * The current implementation generates minimal placeholder output:
 * - Minimal assembly with BASIC stub
 * - Minimal PRG binary
 * - No source maps (future Phase 3)
 *
 * @module pipeline/codegen-phase
 */

import type { ILModule } from '../il/module.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import type { PhaseResult, CodegenResult, CodegenOptions } from './types.js';

/**
 * Code Generation Phase - generates target code from IL
 *
 * **STUB IMPLEMENTATION**
 *
 * This phase converts IL to target machine code.
 * Currently generates minimal placeholder output.
 * Real implementation will be done in Phase 2.
 *
 * **Future Implementation Will Include:**
 * - Full 6502 instruction selection
 * - Register allocation
 * - Memory layout
 * - BASIC stub generation
 * - Debug info generation
 *
 * @example
 * ```typescript
 * const codegenPhase = new CodegenPhase();
 * const result = codegenPhase.execute(ilModule, {
 *   target: targetConfig,
 *   format: 'prg',
 *   sourceMap: true,
 * });
 *
 * if (result.success) {
 *   writeFileSync('game.prg', result.data.binary);
 * }
 * ```
 */
export class CodegenPhase {
  /**
   * Generate target code from IL module
   *
   * **STUB:** Currently generates placeholder output.
   *
   * @param ilModule - Optimized IL module
   * @param options - Code generation options
   * @returns Phase result with generated code
   */
  public execute(ilModule: ILModule, options: CodegenOptions): PhaseResult<CodegenResult> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // STUB: Generate minimal output
    const assembly = this.generateStubAssembly(ilModule, options);
    const binary = this.generateStubBinary(options);

    // Generate VICE labels if debug mode includes 'vice'
    const viceLabels = this.shouldGenerateViceLabels(options) ? this.generateStubViceLabels(ilModule) : undefined;

    const result: CodegenResult = {
      assembly,
      binary,
      sourceMap: undefined, // Phase 3 implementation
      viceLabels,
    };

    return {
      data: result,
      diagnostics,
      success: true,
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Default load address for C64 BASIC programs
   */
  protected readonly DEFAULT_LOAD_ADDRESS = 0x0801;

  /**
   * Generate stub assembly output
   *
   * Creates a minimal assembly file with:
   * - Header comments
   * - BASIC stub for auto-run
   * - Placeholder main routine
   *
   * @param ilModule - IL module (for metadata)
   * @param options - Code generation options
   * @returns Assembly source string
   */
  protected generateStubAssembly(ilModule: ILModule, options: CodegenOptions): string {
    const loadAddress = this.DEFAULT_LOAD_ADDRESS;
    const timestamp = new Date().toISOString();
    const moduleName = ilModule.name;

    // Get entry point if available
    const entryPoint = ilModule.getEntryPointName() ?? 'main';

    return `; Blend65 Compiler Output (STUB)
; Module: ${moduleName}
; Generated: ${timestamp}
; Target: ${options.target.architecture}
;
; NOTE: This is a stub implementation.
; Real code generation will be implemented in Phase 2.
;
; Load Address: $${loadAddress.toString(16).toUpperCase().padStart(4, '0')}

* = $${loadAddress.toString(16).toUpperCase().padStart(4, '0')}

; ============================================
; BASIC Stub: 10 SYS ${loadAddress + 15}
; ============================================
!byte $0b, $08              ; Next line pointer (low, high)
!byte $0a, $00              ; Line number 10
!byte $9e                   ; SYS token
!text "${loadAddress + 15}" ; Address as ASCII
!byte $00                   ; End of line
!byte $00, $00              ; End of program

; ============================================
; Main Program Entry
; ============================================
* = $${(loadAddress + 15).toString(16).toUpperCase().padStart(4, '0')}

${entryPoint}:
    ; Stub: Set border and background color to black
    lda #$00
    sta $d020           ; Border color
    sta $d021           ; Background color

    ; Stub: Infinite loop
.loop:
    jmp .loop

; ============================================
; End of Program
; ============================================
`;
  }

  /**
   * Generate stub binary output (PRG format)
   *
   * Creates a minimal PRG file with:
   * - 2-byte load address header
   * - BASIC stub
   * - Minimal machine code
   *
   * @param options - Code generation options
   * @returns PRG binary data
   */
  protected generateStubBinary(_options: CodegenOptions): Uint8Array {
    const loadAddress = this.DEFAULT_LOAD_ADDRESS;

    // PRG format: 2-byte load address + program data
    // BASIC stub: 10 SYS 2064 ($0810)
    // Machine code at $0810: LDA #$00, STA $D020, STA $D021, JMP $0810

    const programStart = loadAddress + 15; // After BASIC stub

    // Build BASIC stub
    const basicStub = [
      // Next line pointer (points to $080B)
      0x0b,
      0x08,
      // Line number 10
      0x0a,
      0x00,
      // SYS token
      0x9e,
      // "2064" in ASCII (address of machine code)
      0x32,
      0x30,
      0x36,
      0x34,
      // End of line
      0x00,
      // End of program
      0x00,
      0x00,
    ];

    // Machine code: LDA #$00, STA $D020, STA $D021, JMP .loop
    const machineCode = [
      0xa9,
      0x00, // LDA #$00
      0x8d,
      0x20,
      0xd0, // STA $D020
      0x8d,
      0x21,
      0xd0, // STA $D021
      0x4c,
      programStart & 0xff,
      (programStart >> 8) & 0xff, // JMP programStart
    ];

    // Combine: load address + BASIC stub + machine code
    const prg = new Uint8Array(2 + basicStub.length + machineCode.length);

    // Load address (little-endian)
    prg[0] = loadAddress & 0xff;
    prg[1] = (loadAddress >> 8) & 0xff;

    // BASIC stub
    for (let i = 0; i < basicStub.length; i++) {
      prg[2 + i] = basicStub[i];
    }

    // Machine code
    for (let i = 0; i < machineCode.length; i++) {
      prg[2 + basicStub.length + i] = machineCode[i];
    }

    return prg;
  }

  /**
   * Generate stub VICE label file
   *
   * Creates a minimal label file for VICE debugger.
   *
   * @param ilModule - IL module (for function names)
   * @returns VICE label file content
   */
  protected generateStubViceLabels(ilModule: ILModule): string {
    const lines: string[] = ['# VICE labels generated by Blend65 compiler (STUB)', '#'];

    // Add entry point label
    const entryPoint = ilModule.getEntryPointName() ?? 'main';
    lines.push(`al C:0810 .${entryPoint}`);

    // Add loop label
    lines.push('al C:0810 .loop');

    return lines.join('\n');
  }

  /**
   * Check if VICE labels should be generated
   *
   * @param options - Code generation options
   * @returns True if debug includes 'vice' or 'both'
   */
  protected shouldGenerateViceLabels(options: CodegenOptions): boolean {
    const debug = options.debug ?? 'none';
    return debug === 'vice' || debug === 'both';
  }
}