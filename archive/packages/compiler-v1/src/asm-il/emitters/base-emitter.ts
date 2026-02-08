/**
 * Base ASM-IL Emitter
 *
 * Abstract base class for assembly emitters.
 *
 * @module asm-il/emitters/base-emitter
 */

import type { SourceLocation } from '../../ast/base.js';
import type { AsmModule } from '../types.js';
import type { AcmeEmitterConfig, EmitterResult } from './types.js';
import { DEFAULT_ACME_EMITTER_CONFIG } from './types.js';

/**
 * Abstract base class for assembly emitters.
 * Provides common infrastructure for serializing AsmModule to text.
 */
export abstract class BaseEmitter {
  protected readonly config: AcmeEmitterConfig;
  protected lines: string[] = [];
  protected currentLine: number = 0;
  protected totalBytes: number = 0;
  protected sourceMap: Map<number, SourceLocation> = new Map();

  constructor(config: Partial<AcmeEmitterConfig> = {}) {
    this.config = { ...DEFAULT_ACME_EMITTER_CONFIG, ...config };
  }

  /** Emit the entire module to assembly text. */
  abstract emit(module: AsmModule): EmitterResult;

  /** Reset emitter state for new emission. */
  protected reset(): void {
    this.lines = [];
    this.currentLine = 0;
    this.totalBytes = 0;
    this.sourceMap = new Map();
  }

  /** Add a line to the output. */
  protected addLine(line: string, sourceLocation?: SourceLocation): void {
    this.lines.push(line);
    this.currentLine++;
    if (sourceLocation) {
      this.sourceMap.set(this.currentLine, sourceLocation);
    }
  }

  /** Add a blank line if configured. */
  protected addBlankLine(): void {
    if (this.config.includeBlankLines) {
      this.addLine('');
    }
  }

  /** Format a hex value with configured prefix. */
  protected formatHex(value: number, width: number = 2): string {
    const hex = value.toString(16).toUpperCase().padStart(width, '0');
    return `${this.config.hexPrefix}${hex}`;
  }

  /** Create indentation string. */
  protected indent(): string {
    return this.config.indentWidth === 0 ? '\t' : ' '.repeat(this.config.indentWidth);
  }

  /** Build the final result. */
  protected buildResult(): EmitterResult {
    return {
      text: this.lines.join(this.config.lineEnding),
      lineCount: this.lines.length,
      totalBytes: this.totalBytes,
      sourceMap: this.sourceMap,
    };
  }
}