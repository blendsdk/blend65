/**
 * ASM-IL Types Tests - Type Guards
 *
 * Tests for the isXxxElement type guard functions.
 *
 * @module __tests__/codegen/asm-il/types/type-guards.test
 */

import { describe, it, expect } from 'vitest';
import {
  AsmAddressingMode,
  AsmILElement,
  createInstructionElement,
  createLabelElement,
  createDirectiveElement,
  createCommentElement,
  createBlankElement,
  createDataElement,
  isInstructionElement,
  isLabelElement,
  isDirectiveElement,
  isCommentElement,
  isBlankElement,
  isDataElement,
} from '../../../../codegen/asm-il/types.js';

describe('Type Guards', () => {
  // Create test elements of each type
  const instructionElem = createInstructionElement('LDA', AsmAddressingMode.Immediate, 0xff);
  const labelElem = createLabelElement('main');
  const directiveElem = createDirectiveElement('*=', 0x0801);
  const commentElem = createCommentElement('Test comment');
  const blankElem = createBlankElement();
  const dataElem = createDataElement([0x00, 0x01]);

  const allElements: AsmILElement[] = [
    instructionElem,
    labelElem,
    directiveElem,
    commentElem,
    blankElem,
    dataElem,
  ];

  describe('isInstructionElement', () => {
    it('should return true for instruction elements', () => {
      expect(isInstructionElement(instructionElem)).toBe(true);
    });

    it('should return false for non-instruction elements', () => {
      expect(isInstructionElement(labelElem)).toBe(false);
      expect(isInstructionElement(directiveElem)).toBe(false);
      expect(isInstructionElement(commentElem)).toBe(false);
      expect(isInstructionElement(blankElem)).toBe(false);
      expect(isInstructionElement(dataElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isInstructionElement(instructionElem)) {
        // TypeScript should allow access to instruction property
        expect(instructionElem.instruction.mnemonic).toBe('LDA');
      }
    });
  });

  describe('isLabelElement', () => {
    it('should return true for label elements', () => {
      expect(isLabelElement(labelElem)).toBe(true);
    });

    it('should return false for non-label elements', () => {
      expect(isLabelElement(instructionElem)).toBe(false);
      expect(isLabelElement(directiveElem)).toBe(false);
      expect(isLabelElement(commentElem)).toBe(false);
      expect(isLabelElement(blankElem)).toBe(false);
      expect(isLabelElement(dataElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isLabelElement(labelElem)) {
        expect(labelElem.label.name).toBe('main');
      }
    });
  });

  describe('isDirectiveElement', () => {
    it('should return true for directive elements', () => {
      expect(isDirectiveElement(directiveElem)).toBe(true);
    });

    it('should return false for non-directive elements', () => {
      expect(isDirectiveElement(instructionElem)).toBe(false);
      expect(isDirectiveElement(labelElem)).toBe(false);
      expect(isDirectiveElement(commentElem)).toBe(false);
      expect(isDirectiveElement(blankElem)).toBe(false);
      expect(isDirectiveElement(dataElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isDirectiveElement(directiveElem)) {
        expect(directiveElem.directive.directive).toBe('*=');
      }
    });
  });

  describe('isCommentElement', () => {
    it('should return true for comment elements', () => {
      expect(isCommentElement(commentElem)).toBe(true);
    });

    it('should return false for non-comment elements', () => {
      expect(isCommentElement(instructionElem)).toBe(false);
      expect(isCommentElement(labelElem)).toBe(false);
      expect(isCommentElement(directiveElem)).toBe(false);
      expect(isCommentElement(blankElem)).toBe(false);
      expect(isCommentElement(dataElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isCommentElement(commentElem)) {
        expect(commentElem.comment.text).toBe('Test comment');
      }
    });
  });

  describe('isBlankElement', () => {
    it('should return true for blank elements', () => {
      expect(isBlankElement(blankElem)).toBe(true);
    });

    it('should return false for non-blank elements', () => {
      expect(isBlankElement(instructionElem)).toBe(false);
      expect(isBlankElement(labelElem)).toBe(false);
      expect(isBlankElement(directiveElem)).toBe(false);
      expect(isBlankElement(commentElem)).toBe(false);
      expect(isBlankElement(dataElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isBlankElement(blankElem)) {
        expect(blankElem.kind).toBe('blank');
      }
    });
  });

  describe('isDataElement', () => {
    it('should return true for data elements', () => {
      expect(isDataElement(dataElem)).toBe(true);
    });

    it('should return false for non-data elements', () => {
      expect(isDataElement(instructionElem)).toBe(false);
      expect(isDataElement(labelElem)).toBe(false);
      expect(isDataElement(directiveElem)).toBe(false);
      expect(isDataElement(commentElem)).toBe(false);
      expect(isDataElement(blankElem)).toBe(false);
    });

    it('should narrow type correctly', () => {
      if (isDataElement(dataElem)) {
        expect(dataElem.data.bytes).toEqual([0x00, 0x01]);
      }
    });
  });

  describe('mutually exclusive type guards', () => {
    it('should identify exactly one type for each element', () => {
      for (const elem of allElements) {
        const matches = [
          isInstructionElement(elem),
          isLabelElement(elem),
          isDirectiveElement(elem),
          isCommentElement(elem),
          isBlankElement(elem),
          isDataElement(elem),
        ].filter(Boolean);

        expect(matches.length).toBe(1);
      }
    });

    it('should work with switch-like pattern', () => {
      const categorize = (elem: AsmILElement): string => {
        if (isInstructionElement(elem)) return 'instruction';
        if (isLabelElement(elem)) return 'label';
        if (isDirectiveElement(elem)) return 'directive';
        if (isCommentElement(elem)) return 'comment';
        if (isBlankElement(elem)) return 'blank';
        if (isDataElement(elem)) return 'data';
        return 'unknown';
      };

      expect(categorize(instructionElem)).toBe('instruction');
      expect(categorize(labelElem)).toBe('label');
      expect(categorize(directiveElem)).toBe('directive');
      expect(categorize(commentElem)).toBe('comment');
      expect(categorize(blankElem)).toBe('blank');
      expect(categorize(dataElem)).toBe('data');
    });
  });

  describe('array filtering', () => {
    it('should filter instructions from mixed array', () => {
      const instructions = allElements.filter(isInstructionElement);
      expect(instructions).toHaveLength(1);
      expect(instructions[0].instruction.mnemonic).toBe('LDA');
    });

    it('should filter labels from mixed array', () => {
      const labels = allElements.filter(isLabelElement);
      expect(labels).toHaveLength(1);
      expect(labels[0].label.name).toBe('main');
    });

    it('should filter directives from mixed array', () => {
      const directives = allElements.filter(isDirectiveElement);
      expect(directives).toHaveLength(1);
      expect(directives[0].directive.directive).toBe('*=');
    });

    it('should filter comments from mixed array', () => {
      const comments = allElements.filter(isCommentElement);
      expect(comments).toHaveLength(1);
      expect(comments[0].comment.text).toBe('Test comment');
    });

    it('should filter blanks from mixed array', () => {
      const blanks = allElements.filter(isBlankElement);
      expect(blanks).toHaveLength(1);
    });

    it('should filter data from mixed array', () => {
      const dataElems = allElements.filter(isDataElement);
      expect(dataElems).toHaveLength(1);
      expect(dataElems[0].data.bytes).toEqual([0x00, 0x01]);
    });
  });
});