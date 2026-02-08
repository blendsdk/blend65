/**
 * PassThroughPass Tests
 *
 * Tests for the no-op pass that returns programs unchanged.
 */

import { describe, it, expect } from 'vitest';
import { PassThroughPass } from '../../../../codegen/asm-il/optimizer/pass-through.js';
import { createAsmILProgram, createSection, createInstructionElement, AsmAddressingMode } from '../../../../codegen/asm-il/types.js';

describe('PassThroughPass', () => {
  it('should have the correct name', () => {
    const pass = new PassThroughPass();
    expect(pass.name).toBe('pass-through');
  });

  it('should not be a transform pass', () => {
    const pass = new PassThroughPass();
    expect(pass.isTransform).toBe(false);
  });

  it('should return the same program reference', () => {
    const pass = new PassThroughPass();
    const program = createAsmILProgram('test');
    const result = pass.run(program);

    // Must be same reference for convergence detection
    expect(result.program).toBe(program);
  });

  it('should always report unchanged', () => {
    const pass = new PassThroughPass();
    const program = createAsmILProgram('test');
    const result = pass.run(program);

    expect(result.changed).toBe(false);
  });

  it('should return empty transform stats', () => {
    const pass = new PassThroughPass();
    const program = createAsmILProgram('test');
    const result = pass.run(program);

    expect(result.stats.patternsMatched).toBe(0);
    expect(result.stats.instructionsRemoved).toBe(0);
    expect(result.stats.instructionsAdded).toBe(0);
    expect(result.stats.estimatedCyclesSaved).toBe(0);
    expect(result.stats.estimatedBytesSaved).toBe(0);
  });

  it('should work with a program containing sections and instructions', () => {
    const pass = new PassThroughPass();

    // Build a non-trivial program
    const program = createAsmILProgram('test-module');
    const section = createSection('main');
    section.elements.push(
      createInstructionElement('LDA', AsmAddressingMode.Immediate, 0xFF),
      createInstructionElement('STA', AsmAddressingMode.Absolute, 0xD020),
    );
    program.sections.push(section);

    const result = pass.run(program);

    // Program is returned unchanged — same reference
    expect(result.program).toBe(program);
    expect(result.changed).toBe(false);
    expect(result.program.sections).toHaveLength(1);
    expect(result.program.sections[0].elements).toHaveLength(2);
  });

  it('should be callable multiple times with consistent results', () => {
    const pass = new PassThroughPass();
    const program = createAsmILProgram('test');

    // Call multiple times — each should return same result
    const result1 = pass.run(program);
    const result2 = pass.run(program);

    expect(result1.program).toBe(program);
    expect(result2.program).toBe(program);
    expect(result1.changed).toBe(false);
    expect(result2.changed).toBe(false);
  });
});
