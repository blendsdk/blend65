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
import type { AsmILProgram, AsmILSection } from '../codegen/asm-il/types.js';
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

      // Look up the GlobalSlot for this entry to get dataLabel and alignment
      const globalSlot = globalAllocation.globals.get(entry.qualifiedName);

      // Emit ACME !align directive before the label if alignment is required.
      // ACME syntax: !align <and_mask>, <fill_value>
      // where and_mask = alignment - 1 (e.g., 64-byte alignment → mask 63).
      // This pads the output with fill_value bytes until the program counter
      // is aligned to the specified boundary.
      if (globalSlot?.alignment) {
        const andMask = globalSlot.alignment - 1;
        dataSection.elements.push(
          createDirectiveElement('!align', `${andMask}, 0`, undefined,
            `align to ${globalSlot.alignment}-byte boundary`)
        );
      }

      // Emit the ACME label before the byte data.
      // The code generator references this label in LDA/STA instructions
      // to correctly address @data const arrays/scalars.
      if (globalSlot?.dataLabel) {
        dataSection.elements.push(createLabelElement(globalSlot.dataLabel));
      }

      // Emit VIC-II ROM shadow guard for aligned data entries.
      // Data with alignment >= 64 is VIC-II hardware-relevant (@sprite, @charset,
      // @screen, @bitmap, @page). These may land in the $1000-$1FFF ROM shadow
      // region (VIC Bank 0) where the VIC-II reads Character ROM instead of RAM.
      // ACME resolves the label address at assembly time, so we use an ACME !if
      // conditional to check and emit a warning if the data falls in the shadow.
      if (globalSlot?.alignment && globalSlot.alignment >= 64 && globalSlot?.dataLabel) {
        this.emitRomShadowGuard(dataSection, globalSlot.dataLabel, globalSlot.qualifiedName, globalSlot.alignment);
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

  /**
   * Emits ACME assembly-time guard directives to detect when aligned
   * VIC-II data lands in the Character ROM shadow region ($1000-$1FFF
   * in VIC Bank 0).
   *
   * The VIC-II video chip reads Character ROM (not RAM) at offsets
   * $1000-$1FFF within its active bank. If @charset, @sprite, @screen,
   * or @bitmap data is placed there by the assembler, the VIC-II will
   * not see the custom data — it will read the built-in C64 font instead.
   *
   * Since final addresses are resolved by ACME at assembly time (not
   * compile time), we emit ACME `!if` / `!warn` conditionals that check
   * the resolved label address and print a warning if it falls in the
   * ROM shadow range. This has zero runtime cost.
   *
   * @param section - The data section to append guard elements to
   * @param dataLabel - The ACME label name for the data entry
   * @param qualifiedName - The Blend source-level qualified variable name
   * @param alignment - The alignment in bytes (e.g., 64 for @sprite, 2048 for @charset)
   */
  protected emitRomShadowGuard(
    section: AsmILSection,
    dataLabel: string,
    qualifiedName: string,
    alignment: number
  ): void {
    // Determine a human-readable storage class name from alignment value.
    // These are the VIC-II hardware alignment values that correspond to
    // the sugar keywords defined in the language specification.
    const storageLabel = this.getStorageLabelFromAlignment(alignment);

    // Emit comment explaining the guard purpose
    section.elements.push(
      createCommentElement(`VIC-II ROM shadow guard for ${storageLabel} '${qualifiedName}'`)
    );

    // Emit ACME !if conditional: check if label address falls in $1000-$1FFF (Bank 0).
    // ACME evaluates this at assembly time when the label address is known.
    // Using !warn (not !error) so assembly still produces a binary — the programmer
    // may intentionally place data in the shadow (e.g., CPU reads it, copies elsewhere).
    section.elements.push(
      createDirectiveElement('!if', `(${dataLabel} >= $1000) AND (${dataLabel} < $2000) {`)
    );
    section.elements.push(
      createDirectiveElement(
        '!warn',
        `"VIC-II ROM shadow: ${storageLabel} '${qualifiedName}' may be at $1000-$1FFF (Bank 0)."`
      )
    );
    section.elements.push(
      createDirectiveElement(
        '!warn',
        `"  VIC-II reads Character ROM here, not RAM. Data won't be visible to VIC-II."`
      )
    );
    section.elements.push(
      createDirectiveElement('}')
    );
  }

  /**
   * Maps an alignment value to a human-readable storage class label
   * for use in ROM shadow warning messages.
   *
   * @param alignment - Alignment in bytes
   * @returns Human-readable storage label (e.g., "@charset", "@sprite")
   */
  protected getStorageLabelFromAlignment(alignment: number): string {
    switch (alignment) {
      case 64: return '@sprite';
      case 256: return '@page';
      case 1024: return '@screen';
      case 2048: return '@charset';
      case 8192: return '@bitmap';
      default: return `@data(align: ${alignment})`;
    }
  }
}
