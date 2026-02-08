/**
 * Data Directive Builder
 *
 * Extends BranchJumpBuilder with data directive methods.
 * Part of the builder inheritance chain.
 *
 * @module asm-il/builder/data-builder
 */

import { BranchJumpBuilder } from './branch-jump-builder.js';
import type { AsmData } from '../types.js';
import { DataType } from '../types.js';

/**
 * Data Directive Builder
 *
 * Adds data directive methods:
 * - byte() - Single bytes: !byte $xx, $yy
 * - word() - 16-bit words: !word $xxxx
 * - text() - Text strings: !text "hello"
 * - fill() - Memory fill: !fill count, value
 */
export abstract class DataBuilder extends BranchJumpBuilder {
  // ========================================
  // BYTE DIRECTIVE
  // ========================================

  /**
   * Emit bytes: !byte $xx, $yy, ...
   *
   * Emits raw byte values into the assembly output.
   *
   * @param values - Array of byte values (0-255)
   * @param comment - Optional comment
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * builder.byte([0x00, 0x01, 0x02]); // !byte $00, $01, $02
   * ```
   */
  byte(values: number[], comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Byte,
      values,
      comment,
      sourceLocation: this.currentLocation,
    };

    this.addItem(data);
    this.addDataBytes(values.length);

    return this;
  }

  /**
   * Emit a single byte
   *
   * Convenience method for emitting a single byte value.
   *
   * @param value - Byte value (0-255)
   * @param comment - Optional comment
   * @returns this for chaining
   */
  singleByte(value: number, comment?: string): this {
    return this.byte([value], comment);
  }

  // ========================================
  // WORD DIRECTIVE
  // ========================================

  /**
   * Emit words: !word $xxxx, $yyyy, ...
   *
   * Emits 16-bit words in little-endian format.
   *
   * @param values - Array of word values (0-65535)
   * @param comment - Optional comment
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * builder.word([0x1234, 0x5678]); // !word $1234, $5678
   * ```
   */
  word(values: number[], comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Word,
      values,
      comment,
      sourceLocation: this.currentLocation,
    };

    this.addItem(data);
    this.addDataBytes(values.length * 2);

    return this;
  }

  /**
   * Emit a single word
   *
   * Convenience method for emitting a single 16-bit word.
   *
   * @param value - Word value (0-65535)
   * @param comment - Optional comment
   * @returns this for chaining
   */
  singleWord(value: number, comment?: string): this {
    return this.word([value], comment);
  }

  /**
   * Emit a word from a label reference
   *
   * Emits the address of a label as a 16-bit word.
   * The assembler will resolve the label to an address.
   *
   * @param label - Label name
   * @param comment - Optional comment
   * @returns this for chaining
   */
  wordLabel(label: string, comment?: string): this {
    // For label references, we use raw() since ACME handles this directly
    this.raw(`        !word ${label}${comment ? ` ; ${comment}` : ''}`);
    this.addDataBytes(2);
    return this;
  }

  // ========================================
  // TEXT DIRECTIVE
  // ========================================

  /**
   * Emit text: !text "string"
   *
   * Emits an ASCII string into the output.
   *
   * @param content - String content
   * @param comment - Optional comment
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * builder.text("HELLO"); // !text "HELLO"
   * ```
   */
  text(content: string, comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Text,
      values: content,
      comment,
      sourceLocation: this.currentLocation,
    };

    this.addItem(data);
    this.addDataBytes(content.length);

    return this;
  }

  /**
   * Emit null-terminated text
   *
   * Emits an ASCII string followed by a null byte (0x00).
   *
   * @param content - String content
   * @param comment - Optional comment
   * @returns this for chaining
   */
  textNullTerminated(content: string, comment?: string): this {
    this.text(content, comment);
    this.byte([0], 'null terminator');
    return this;
  }

  /**
   * Emit PETSCII text (for C64)
   *
   * Note: Actual PETSCII conversion would need to be done
   * by the emitter or a pre-processing step.
   *
   * @param content - String content
   * @param comment - Optional comment
   * @returns this for chaining
   */
  petscii(content: string, comment?: string): this {
    // For now, just emit as text - PETSCII conversion is done by ACME
    // with !pet directive, but we use raw for this
    this.raw(`        !pet "${content}"${comment ? ` ; ${comment}` : ''}`);
    this.addDataBytes(content.length);
    return this;
  }

  // ========================================
  // FILL DIRECTIVE
  // ========================================

  /**
   * Emit fill: !fill count, value
   *
   * Fills memory with a specified value.
   *
   * @param count - Number of bytes to fill
   * @param value - Fill value (default: 0)
   * @param comment - Optional comment
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * builder.fill(256, 0x00); // !fill 256, $00
   * ```
   */
  fill(count: number, value: number = 0, comment?: string): this {
    const data: AsmData = {
      kind: 'data',
      type: DataType.Fill,
      values: { count, value },
      comment,
      sourceLocation: this.currentLocation,
    };

    this.addItem(data);
    this.addDataBytes(count);

    return this;
  }

  /**
   * Emit zero-filled memory
   *
   * Convenience method for filling with zeros.
   *
   * @param count - Number of bytes to fill
   * @param comment - Optional comment
   * @returns this for chaining
   */
  zero(count: number, comment?: string): this {
    return this.fill(count, 0, comment);
  }

  /**
   * Reserve space (alias for zero fill)
   *
   * Reserves memory without initializing it.
   * In practice, fills with zeros.
   *
   * @param count - Number of bytes to reserve
   * @param comment - Optional comment
   * @returns this for chaining
   */
  reserve(count: number, comment?: string): this {
    return this.zero(count, comment ?? 'reserved');
  }
}