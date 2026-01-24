/**
 * Code Generation Types
 *
 * Defines TypeScript interfaces for the code generation subsystem.
 * These types support the CodeGenerator class that transforms IL
 * into 6502 assembly and binary output.
 *
 * **Key Interfaces:**
 * - {@link CodegenOptions} - Options for code generation
 * - {@link CodegenResult} - Complete code generation result
 * - {@link SourceMapEntry} - Source location mapping for debugging
 * - {@link CodegenStats} - Statistics about generated code
 *
 * **ASM-IL Integration (Phase 3e):**
 * The CodeGenerator now produces an AsmModule which is then
 * emitted to text via AcmeEmitter. The assembly string in
 * CodegenResult is still provided for backward compatibility.
 *
 * @module codegen/types
 */

import type { TargetConfig } from '../target/config.js';
import type { SourceLocation } from '../ast/base.js';
import type { AsmModule } from '../asm-il/types.js';

/**
 * Code generation warning with optional source location
 *
 * Enables rich diagnostic output by associating warnings with
 * their source locations for accurate error reporting.
 *
 * @example
 * ```typescript
 * const warning: CodegenWarning = {
 *   message: 'PEEK intrinsic not yet implemented - waiting for optimizer',
 *   location: { start: { line: 5, column: 10 }, end: { line: 5, column: 20 }, file: 'main.blend' }
 * };
 * ```
 */
export interface CodegenWarning {
  /**
   * Warning message text
   *
   * Human-readable description of the warning.
   */
  message: string;

  /**
   * Optional source location
   *
   * When provided, enables rich diagnostic output with source
   * code snippets and caret markers pointing to the issue.
   */
  location?: SourceLocation;
}

/**
 * Output format for code generation
 *
 * - 'asm': Assembly source only
 * - 'prg': C64 executable (.prg)
 * - 'crt': Cartridge image (NOT YET IMPLEMENTED)
 * - 'both': Assembly + PRG
 */
export type OutputFormat = 'asm' | 'prg' | 'crt' | 'both';

/**
 * Debug information mode
 *
 * - 'none': No debug information
 * - 'inline': Comments in assembly showing source locations
 * - 'vice': VICE label file for debugger integration
 * - 'both': Both inline comments and VICE labels
 */
export type DebugMode = 'none' | 'inline' | 'vice' | 'both';

/**
 * Code generation options
 *
 * Configuration passed to the code generator to control
 * output format, debug information, and assembly options.
 *
 * @example
 * ```typescript
 * const options: CodegenOptions = {
 *   target: C64_CONFIG,
 *   format: 'both',
 *   sourceMap: true,
 *   debug: 'inline',
 *   loadAddress: 0x0801,
 *   basicStub: true,
 * };
 * ```
 */
export interface CodegenOptions {
  /**
   * Target hardware configuration
   *
   * Contains architecture-specific settings like memory layout,
   * register addresses, and zero-page configuration.
   */
  target: TargetConfig;

  /**
   * Output format
   *
   * Controls what artifacts are generated:
   * - 'asm': Assembly source only
   * - 'prg': C64 executable (.prg) via ACME
   * - 'crt': Cartridge image (NOT YET IMPLEMENTED)
   * - 'both': Assembly + PRG
   */
  format: OutputFormat;

  /**
   * Generate source map information
   *
   * When true, tracks the mapping between generated assembly
   * addresses and original source locations.
   */
  sourceMap: boolean;

  /**
   * Debug information mode
   *
   * Controls what debug information is included:
   * - 'none': No debug information
   * - 'inline': Comments in assembly showing source locations
   * - 'vice': VICE label file for debugger integration
   * - 'both': Both inline comments and VICE labels
   */
  debug: DebugMode;

  /**
   * Program load address (default: $0801)
   *
   * The memory address where the program will be loaded.
   * For C64 BASIC programs, this is typically $0801.
   */
  loadAddress?: number;

  /**
   * Generate BASIC stub for autostart
   *
   * When true, generates a BASIC program that calls the
   * machine code entry point automatically on RUN.
   *
   * Default: true
   */
  basicStub?: boolean;

  /**
   * Path to ACME assembler executable
   *
   * If not provided, ACME will be searched for in PATH.
   * If ACME is not found, only .asm output will be generated.
   */
  acmePath?: string;
}

/**
 * Source map entry
 *
 * Maps a generated assembly address back to the original
 * source code location. Used for debugging and source maps.
 *
 * @example
 * ```typescript
 * const entry: SourceMapEntry = {
 *   address: 0x0810,
 *   source: { start: { line: 10, column: 1 }, end: { line: 10, column: 20 } },
 *   label: '_main',
 * };
 * ```
 */
export interface SourceMapEntry {
  /**
   * Generated assembly address
   *
   * The memory address in the generated code that corresponds
   * to the source location.
   */
  address: number;

  /**
   * Original source location
   *
   * The location in the Blend65 source file that generated
   * the code at this address.
   */
  source: SourceLocation;

  /**
   * Optional label at this address
   *
   * If a label (function name, etc.) is defined at this
   * address, it is included here.
   */
  label?: string;
}

/**
 * Statistics about generated code
 *
 * Provides metrics about the code generation output
 * for analysis and optimization guidance.
 */
export interface CodegenStats {
  /**
   * Total code bytes generated
   *
   * Size of the executable machine code, excluding
   * data sections and BASIC stub.
   */
  codeSize: number;

  /**
   * Total data bytes generated
   *
   * Size of all data sections (constants, strings,
   * initialized variables).
   */
  dataSize: number;

  /**
   * Zero-page bytes used
   *
   * Number of bytes allocated in zero-page for
   * @zp variables.
   */
  zpBytesUsed: number;

  /**
   * Number of functions generated
   *
   * Count of function entry points in the output.
   */
  functionCount: number;

  /**
   * Number of global variables
   *
   * Count of global variables (all storage classes).
   */
  globalCount: number;

  /**
   * Total program size (including header)
   *
   * Complete size of the .prg file including
   * load address and BASIC stub.
   */
  totalSize: number;
}

/**
 * Code generation result
 *
 * Contains all output artifacts from the code generator.
 * This is the return type of CodeGenerator.generate().
 *
 * @example
 * ```typescript
 * const result = codegen.generate(ilModule, options);
 *
 * // Write outputs
 * writeFileSync('game.asm', result.assembly);
 * if (result.binary) {
 *   writeFileSync('game.prg', result.binary);
 * }
 * if (result.viceLabels) {
 *   writeFileSync('game.labels', result.viceLabels);
 * }
 * ```
 */
export interface CodegenResult {
  /**
   * ASM-IL module (primary structured output)
   *
   * The code generator now produces an AsmModule as its primary
   * structured output. This module can be:
   * - Optimized via AsmOptimizer
   * - Emitted to text via AcmeEmitter
   *
   * The `assembly` string is derived from this module for
   * backward compatibility.
   *
   * @since Phase 3e (CodeGenerator Rewire)
   */
  module?: AsmModule;

  /**
   * Generated assembly text
   *
   * ACME-compatible 6502 assembly source code.
   * Always generated regardless of format option.
   *
   * **Note:** This is now derived from the `module` via AcmeEmitter
   * for backward compatibility. Prefer using `module` directly
   * for programmatic access to the assembly structure.
   */
  assembly: string;

  /**
   * Binary .prg data (if format includes 'prg')
   *
   * Ready-to-load C64 program in PRG format:
   * - 2-byte load address header (little-endian)
   * - BASIC stub (if enabled)
   * - Machine code
   * - Data sections
   *
   * Undefined if format is 'asm' only.
   */
  binary?: Uint8Array;

  /**
   * Source map entries (if sourceMap enabled)
   *
   * Array of mappings from generated addresses to
   * original source locations.
   */
  sourceMap?: SourceMapEntry[];

  /**
   * VICE label file content (if debug includes 'vice')
   *
   * Label definitions in VICE monitor format for
   * debugger integration.
   */
  viceLabels?: string;

  /**
   * Warnings during generation
   *
   * Non-fatal issues encountered during code generation.
   * Each warning can include an optional source location for
   * rich diagnostic output with code snippets.
   *
   * Examples:
   * - ACME not found (assembly generated but not binary)
   * - Unsupported IL instruction (placeholder generated)
   */
  warnings: CodegenWarning[];

  /**
   * Statistics about generated code
   *
   * Metrics for analysis and optimization guidance.
   */
  stats: CodegenStats;
}

/**
 * Default code generation options
 *
 * Creates a CodegenOptions object with sensible defaults
 * for the given target configuration.
 *
 * **Defaults:**
 * - format: 'prg' (generate .prg binary)
 * - sourceMap: false
 * - debug: 'none'
 * - loadAddress: 0x0801 (C64 BASIC start)
 * - basicStub: true
 *
 * @param target - Target hardware configuration
 * @returns CodegenOptions with default values
 *
 * @example
 * ```typescript
 * const options = getDefaultCodegenOptions(C64_CONFIG);
 * // options.format === 'prg'
 * // options.loadAddress === 0x0801
 * // options.basicStub === true
 * ```
 */
export function getDefaultCodegenOptions(target: TargetConfig): CodegenOptions {
  return {
    target,
    format: 'prg',
    sourceMap: false,
    debug: 'none',
    loadAddress: 0x0801,
    basicStub: true,
  };
}

/**
 * Standard C64 BASIC program load address
 *
 * The default load address for C64 programs that include
 * a BASIC stub for autostart.
 */
export const C64_BASIC_START = 0x0801;

/**
 * Standard C64 machine code start address (after BASIC stub)
 *
 * The typical address where machine code begins after
 * a minimal BASIC stub (10 SYS xxxx).
 */
export const C64_CODE_START = 0x0810;