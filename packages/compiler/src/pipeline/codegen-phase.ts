/**
 * Code Generation Phase
 *
 * Generates ASM-IL (structured 6502 assembly) from optimized IL.
 * Also builds the data segment from @data global variables and
 * appends it to the AsmILProgram output.
 *
 * **V2 Differences from V1:**
 * - Generates AsmILProgram (structured ASM-IL), not raw assembly text
 * - The emitter phase converts AsmILProgram → assembly text
 * - The ASM optimizer operates on AsmILProgram before emission
 * - Data segment is built from @data globals and appended to output
 *
 * @module pipeline/codegen-phase
 */

import { CodeGenerator } from '../codegen/generator/index.js';
import { DataSegmentBuilder } from '../codegen/data-segment.js';
import type { CpuTarget } from '../codegen/cpu/index.js';
import { DEFAULT_CPU_TARGET } from '../codegen/cpu/index.js';
import type { ILProgram } from '../il/structures.js';
import type { AsmILProgram } from '../codegen/asm-il/types.js';
import { createSection, createCommentElement, createBlankElement, createDirectiveElement, createLabelElement } from '../codegen/asm-il/types.js';
import type { Diagnostic } from '../ast/diagnostics.js';
import { DiagnosticSeverity, DiagnosticCode } from '../ast/diagnostics.js';
import type { FrameAllocationResult } from '../frame/allocator/frame-allocator.js';
import type { GlobalAllocationResult } from '../frame/types-global.js';
import type { PhaseResult } from './types.js';

/**
 * Code Generation Phase - generates ASM-IL from IL
 *
 * Converts the IL program to a structured assembly representation
 * (AsmILProgram) that can be further optimized and then emitted
 * as assembly text. Optionally appends a data segment for @data
 * global variables.
 *
 * @example
 * ```typescript
 * const codegenPhase = new CodegenPhase();
 * const result = codegenPhase.execute(ilProgram, frameResult);
 * ```
 */
export class CodegenPhase {
  /**
   * Generate ASM-IL from IL program
   *
   * Creates a CodeGenerator and translates IL instructions to
   * structured 6502 assembly (AsmILProgram). If frame allocation
   * results are provided with global allocation data, also builds
   * and appends the data segment for @data constants.
   *
   * @param ilProgram - Optimized IL program
   * @param frameAllocation - Frame allocation result (optional, for data segment)
   * @param cpuTarget - CPU target (defaults to 6502)
   * @returns Phase result with generated AsmILProgram
   */
  public execute(
    ilProgram: ILProgram,
    frameAllocation?: FrameAllocationResult,
    cpuTarget: CpuTarget = DEFAULT_CPU_TARGET
  ): PhaseResult<AsmILProgram> {
    const startTime = performance.now();
    const diagnostics: Diagnostic[] = [];

    // Create code generator for the target CPU
    const generator = new CodeGenerator(
      ilProgram.moduleName,
      cpuTarget
    );

    // Generate ASM-IL from IL program
    const asmProgram = generator.generate(ilProgram);

    // Build and append data segment if @data globals exist
    const globalAllocation = frameAllocation?.globalAllocation;
    if (globalAllocation) {
      this.appendDataSegment(asmProgram, globalAllocation, diagnostics);
    }

    return {
      data: asmProgram,
      diagnostics,
      success: diagnostics.every(d => d.severity !== DiagnosticSeverity.ERROR),
      timeMs: performance.now() - startTime,
    };
  }

  /**
   * Builds the data segment from @data globals and appends it
   * to the AsmILProgram as a new section.
   *
   * The data segment contains raw byte data for all @data const
   * variables, packed sequentially. In the assembly output, this
   * appears as `!byte` directives in a labeled section.
   *
   * @param asmProgram - The AsmILProgram to append data segment to
   * @param globalAllocation - Global allocation result with @data globals
   * @param diagnostics - Array to collect any errors during data segment building
   */
  protected appendDataSegment(
    asmProgram: AsmILProgram,
    globalAllocation: GlobalAllocationResult,
    diagnostics: Diagnostic[]
  ): void {
    // Only build data segment if there are @data globals
    const hasDataGlobals = Array.from(globalAllocation.globals.values())
      .some(slot => slot.storageClass === 'data');

    if (!hasDataGlobals) {
      return;
    }

    // Build data segment bytes
    const builder = new DataSegmentBuilder();
    const result = builder.build(globalAllocation.globals);

    // Convert data segment errors to diagnostics
    for (const error of result.errors) {
      diagnostics.push({
        code: DiagnosticCode.TYPE_MISMATCH,
        severity: DiagnosticSeverity.ERROR,
        message: `Data segment error: ${error}`,
        location: {
          source: '<data-segment>',
          start: { line: 1, column: 1, offset: 0 },
          end: { line: 1, column: 1, offset: 0 },
        },
      });
    }

    // If no entries, nothing to append
    if (result.entries.length === 0) {
      return;
    }

    // Create a data segment section in the AsmILProgram
    const dataSection = createSection('data');

    // Section header comment
    dataSection.elements.push(createBlankElement());
    dataSection.elements.push(
      createCommentElement('============================================================')
    );
    dataSection.elements.push(
      createCommentElement('Data Segment (@data const blocks)')
    );
    dataSection.elements.push(
      createCommentElement('============================================================')
    );

    // Emit each data entry as labeled !byte directives.
    // Each entry gets an ACME label (from GlobalSlot.dataLabel) so the
    // code generator can reference the data by label rather than address.
    for (const entry of result.entries) {
      dataSection.elements.push(createBlankElement());
      dataSection.elements.push(
        createCommentElement(`${entry.qualifiedName} (${entry.size} bytes)`)
      );

      // Emit the ACME label before the byte data.
      // The code generator references this label in LDA/STA instructions
      // to correctly address @data const arrays/scalars.
      const globalSlot = globalAllocation.globals.get(entry.qualifiedName);
      if (globalSlot?.dataLabel) {
        dataSection.elements.push(createLabelElement(globalSlot.dataLabel));
      }

      // Emit bytes in chunks of 16 for readability
      const CHUNK_SIZE = 16;
      for (let offset = 0; offset < entry.bytes.length; offset += CHUNK_SIZE) {
        const chunk = Array.from(
          entry.bytes.slice(offset, Math.min(offset + CHUNK_SIZE, entry.bytes.length))
        );
        dataSection.elements.push(
          createDirectiveElement('!byte', undefined, chunk)
        );
      }
    }

    asmProgram.sections.push(dataSection);
  }
}
