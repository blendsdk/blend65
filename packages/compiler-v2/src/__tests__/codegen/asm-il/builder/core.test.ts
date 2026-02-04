/**
 * ASM-IL Builder Tests - Core Functionality
 *
 * Tests for AsmILBuilder constructor, section management,
 * and basic element methods (comment, blank, label, directive, data).
 *
 * @module __tests__/codegen/asm-il/builder/core.test
 */

import { describe, it, expect } from 'vitest';
import { AsmILBuilder } from '../../../../codegen/asm-il/builder.js';
import {
  isCommentElement,
  isBlankElement,
  isLabelElement,
  isDirectiveElement,
  isDataElement,
} from '../../../../codegen/asm-il/types.js';

describe('AsmILBuilder - Core', () => {
  describe('constructor', () => {
    it('should create builder with module name', () => {
      const builder = new AsmILBuilder('main');
      const program = builder.build();

      expect(program.moduleName).toBe('main');
    });

    it('should create default section', () => {
      const builder = new AsmILBuilder('test');
      const program = builder.build();

      expect(program.sections).toHaveLength(1);
      expect(program.sections[0].name).toBe('default');
    });

    it('should initialize stats to zero', () => {
      const builder = new AsmILBuilder('test');
      const program = builder.build();

      expect(program.stats.instructionCount).toBe(0);
      expect(program.stats.labelCount).toBe(0);
      expect(program.stats.estimatedBytes).toBe(0);
      expect(program.stats.estimatedCycles).toBe(0);
    });
  });

  describe('section management', () => {
    it('should switch to new section', () => {
      const builder = new AsmILBuilder('test');

      builder.section('code');
      expect(builder.getCurrentSectionName()).toBe('code');
    });

    it('should create multiple sections', () => {
      const builder = new AsmILBuilder('test');

      builder.section('header');
      builder.section('code');
      builder.section('data');

      const program = builder.build();
      expect(program.sections).toHaveLength(4); // default + 3 new
    });

    it('should reuse existing section', () => {
      const builder = new AsmILBuilder('test');

      builder.section('code');
      builder.comment('First');
      builder.section('data');
      builder.comment('Second');
      builder.section('code'); // Switch back
      builder.comment('Third');

      const program = builder.build();
      const codeSection = program.sections.find((s) => s.name === 'code')!;

      // Should have both comments in code section
      expect(codeSection.elements).toHaveLength(2);
    });

    it('should add elements to current section', () => {
      const builder = new AsmILBuilder('test');

      builder.section('header').comment('Header comment');
      builder.section('code').comment('Code comment');

      const program = builder.build();
      const headerSection = program.sections.find((s) => s.name === 'header')!;
      const codeSection = program.sections.find((s) => s.name === 'code')!;

      expect(headerSection.elements).toHaveLength(1);
      expect(codeSection.elements).toHaveLength(1);
    });
  });

  describe('comment()', () => {
    it('should add comment element', () => {
      const builder = new AsmILBuilder('test');
      builder.comment('Test comment');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isCommentElement(elements[0])).toBe(true);
      if (isCommentElement(elements[0])) {
        expect(elements[0].comment.text).toBe('Test comment');
      }
    });

    it('should chain comment calls', () => {
      const builder = new AsmILBuilder('test');
      builder.comment('Line 1').comment('Line 2').comment('Line 3');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(3);
    });

    it('should handle empty comment', () => {
      const builder = new AsmILBuilder('test');
      builder.comment('');

      const elements = builder.getAllElements();
      expect(isCommentElement(elements[0])).toBe(true);
      if (isCommentElement(elements[0])) {
        expect(elements[0].comment.text).toBe('');
      }
    });
  });

  describe('blank()', () => {
    it('should add blank element', () => {
      const builder = new AsmILBuilder('test');
      builder.blank();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isBlankElement(elements[0])).toBe(true);
    });

    it('should chain blank calls', () => {
      const builder = new AsmILBuilder('test');
      builder.blank().blank().blank();

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(3);
      expect(elements.every(isBlankElement)).toBe(true);
    });
  });

  describe('label()', () => {
    it('should add global label', () => {
      const builder = new AsmILBuilder('test');
      builder.label('main');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isLabelElement(elements[0])).toBe(true);
      if (isLabelElement(elements[0])) {
        expect(elements[0].label.name).toBe('main');
        expect(elements[0].label.isLocal).toBe(false);
      }
    });

    it('should add local label', () => {
      const builder = new AsmILBuilder('test');
      builder.label('.loop', true);

      const elements = builder.getAllElements();
      expect(isLabelElement(elements[0])).toBe(true);
      if (isLabelElement(elements[0])) {
        expect(elements[0].label.name).toBe('.loop');
        expect(elements[0].label.isLocal).toBe(true);
      }
    });

    it('should add label with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.label('irq_handler', false, 'Interrupt handler');

      const elements = builder.getAllElements();
      if (isLabelElement(elements[0])) {
        expect(elements[0].label.comment).toBe('Interrupt handler');
      }
    });

    it('should increment label count', () => {
      const builder = new AsmILBuilder('test');
      builder.label('main').label('.loop', true).label('subroutine');

      const program = builder.build();
      expect(program.stats.labelCount).toBe(3);
    });
  });

  describe('directive()', () => {
    it('should add directive with name only', () => {
      const builder = new AsmILBuilder('test');
      builder.directive('!align');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isDirectiveElement(elements[0])).toBe(true);
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.directive).toBe('!align');
      }
    });

    it('should add directive with numeric value', () => {
      const builder = new AsmILBuilder('test');
      builder.directive('*=', 0x0801);

      const elements = builder.getAllElements();
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.value).toBe(0x0801);
      }
    });

    it('should add directive with string value', () => {
      const builder = new AsmILBuilder('test');
      builder.directive('!src', '"utils.asm"');

      const elements = builder.getAllElements();
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.value).toBe('"utils.asm"');
      }
    });

    it('should add directive with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.directive('*=', 0x0801, 'BASIC start');

      const elements = builder.getAllElements();
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.comment).toBe('BASIC start');
      }
    });
  });

  describe('dataDirective()', () => {
    it('should add byte directive with values', () => {
      const builder = new AsmILBuilder('test');
      builder.dataDirective('!byte', [0x0c, 0x08, 0x00]);

      const elements = builder.getAllElements();
      expect(isDirectiveElement(elements[0])).toBe(true);
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.directive).toBe('!byte');
        expect(elements[0].directive.values).toEqual([0x0c, 0x08, 0x00]);
      }
    });

    it('should add word directive with values', () => {
      const builder = new AsmILBuilder('test');
      builder.dataDirective('!word', [0x0801, 0x1000]);

      const elements = builder.getAllElements();
      if (isDirectiveElement(elements[0])) {
        expect(elements[0].directive.directive).toBe('!word');
        expect(elements[0].directive.values).toEqual([0x0801, 0x1000]);
      }
    });

    it('should estimate bytes for byte directive', () => {
      const builder = new AsmILBuilder('test');
      builder.dataDirective('!byte', [0x00, 0x01, 0x02]);

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(3);
    });

    it('should estimate bytes for word directive', () => {
      const builder = new AsmILBuilder('test');
      builder.dataDirective('!word', [0x0801, 0x1000]);

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(4); // 2 words × 2 bytes
    });
  });

  describe('data()', () => {
    it('should add raw data bytes', () => {
      const builder = new AsmILBuilder('test');
      builder.data([0x00, 0x01, 0x02]);

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(1);
      expect(isDataElement(elements[0])).toBe(true);
      if (isDataElement(elements[0])) {
        expect(elements[0].data.bytes).toEqual([0x00, 0x01, 0x02]);
      }
    });

    it('should add data with comment', () => {
      const builder = new AsmILBuilder('test');
      builder.data([0xff], 'Terminator');

      const elements = builder.getAllElements();
      if (isDataElement(elements[0])) {
        expect(elements[0].data.comment).toBe('Terminator');
      }
    });

    it('should estimate bytes for data', () => {
      const builder = new AsmILBuilder('test');
      builder.data([0x00, 0x01, 0x02, 0x03, 0x04]);

      const program = builder.build();
      expect(program.stats.estimatedBytes).toBe(5);
    });
  });

  describe('build()', () => {
    it('should return complete program structure', () => {
      const builder = new AsmILBuilder('test');

      builder
        .section('header')
        .comment('Generated by Blend65')
        .directive('*=', 0x0801)
        .section('code')
        .label('main')
        .blank();

      const program = builder.build();

      expect(program.moduleName).toBe('test');
      expect(program.sections.length).toBeGreaterThanOrEqual(2);
      expect(program.stats.labelCount).toBe(1);
    });

    it('should calculate accurate stats', () => {
      const builder = new AsmILBuilder('test');

      builder
        .label('one')
        .label('two')
        .label('three')
        .dataDirective('!byte', [0x00, 0x01])
        .data([0x02, 0x03, 0x04]);

      const program = builder.build();
      expect(program.stats.labelCount).toBe(3);
      expect(program.stats.estimatedBytes).toBe(5); // 2 + 3
    });
  });

  describe('getAllElements()', () => {
    it('should return elements from all sections', () => {
      const builder = new AsmILBuilder('test');

      builder.section('header').comment('Header');
      builder.section('code').comment('Code');
      builder.section('data').comment('Data');

      const elements = builder.getAllElements();
      expect(elements).toHaveLength(3);
    });

    it('should return elements in section order', () => {
      const builder = new AsmILBuilder('test');

      builder.section('first').comment('1');
      builder.section('second').comment('2');

      const elements = builder.getAllElements();
      const comments = elements.filter(isCommentElement);

      expect(comments[0].comment.text).toBe('1');
      expect(comments[1].comment.text).toBe('2');
    });
  });

  describe('fluent chaining', () => {
    it('should chain all basic methods', () => {
      const builder = new AsmILBuilder('test');

      // This should compile and work
      const result = builder
        .section('code')
        .comment('Start')
        .blank()
        .label('main')
        .directive('!align', 256)
        .dataDirective('!byte', [0x00])
        .data([0x01])
        .blank()
        .comment('End');

      // Should return the builder
      expect(result).toBe(builder);
    });
  });
});