/**
 * ACME Emitter Types
 *
 * Type definitions for the ACME assembler emitter.
 *
 * @module asm-il/emitters/types
 */

import type { SourceLocation } from '../../ast/base.js';

/**
 * Configuration for the ACME emitter.
 */
export interface AcmeEmitterConfig {
  /** Include source comments in output */
  includeComments: boolean;
  /** Include blank lines for readability */
  includeBlankLines: boolean;
  /** Tab width for indentation (0 = use tabs) */
  indentWidth: number;
  /** Use uppercase mnemonics (LDA vs lda) */
  uppercaseMnemonics: boolean;
  /** Hex format: '$' prefix (ACME) or '0x' prefix */
  hexPrefix: '$' | '0x';
  /** Include byte/cycle counts as comments */
  includeCycleCounts: boolean;
  /** Line ending style */
  lineEnding: '\n' | '\r\n';
}

/**
 * Default ACME emitter configuration.
 */
export const DEFAULT_ACME_EMITTER_CONFIG: AcmeEmitterConfig = {
  includeComments: true,
  includeBlankLines: true,
  indentWidth: 8,
  uppercaseMnemonics: true,
  hexPrefix: '$',
  includeCycleCounts: false,
  lineEnding: '\n',
};

/**
 * Result from emitting an AsmModule.
 */
export interface EmitterResult {
  /** The generated assembly text */
  text: string;
  /** Number of lines generated */
  lineCount: number;
  /** Total bytes of code/data */
  totalBytes: number;
  /** Source map entries (line -> source location) */
  sourceMap: Map<number, SourceLocation>;
}