/**
 * Tests for Assembly Writer
 *
 * Tests for ACME-compatible 6502 assembly generation.
 *
 * @module __tests__/codegen/assembly-writer.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AssemblyWriter } from '../../codegen/assembly-writer.js';

describe('AssemblyWriter', () => {
  let writer: AssemblyWriter;

  beforeEach(() => {
    writer = new AssemblyWriter();
  });

  // ===========================================================================
  // Constructor and State Management
  // ===========================================================================

  describe('constructor and state', () => {
    it('should create empty writer', () => {
      expect(writer.getLineCount()).toBe(0);
      expect(writer.toString()).toBe('');
    });

    it('should accept source comments option', () => {
      const withComments = new AssemblyWriter(true);
      expect(withComments).toBeDefined();
    });

    it('should reset to initial state', () => {
      writer.emitRaw('test');
      writer.reset();
      expect(writer.getLineCount()).toBe(0);
      expect(writer.toString()).toBe('');
    });

    it('should track current address after origin', () => {
      writer.emitOrigin(0x0801);
      expect(writer.getCurrentAddress()).toBe(0x0801);
    });
  });

  // ===========================================================================
  // Header and Configuration
  // ===========================================================================

  describe('header and configuration', () => {
    it('should emit file header with module name', () => {
      writer.emitHeader('main.blend', 'c64');
      const asm = writer.toString();

      expect(asm).toContain('Blend65 Compiler Output');
      expect(asm).toContain('Module: main.blend');
      expect(asm).toContain('Target: c64');
    });

    it('should emit origin directive', () => {
      writer.emitOrigin(0x0801);
      const asm = writer.toString();

      expect(asm).toContain('* = $0801');
    });

    it('should emit origin with different addresses', () => {
      writer.emitOrigin(0xc000);
      expect(writer.toString()).toContain('* = $C000');
    });
  });

  // ===========================================================================
  // Section Organization
  // ===========================================================================

  describe('section organization', () => {
    it('should emit section header', () => {
      writer.emitSectionHeader('Code Section');
      const asm = writer.toString();

      expect(asm).toContain('; Code Section');
      expect(asm).toContain('---');
    });

    it('should emit section header with description', () => {
      writer.emitSectionHeader('Data Section', 'Global variables and constants');
      const asm = writer.toString();

      expect(asm).toContain('; Data Section');
      expect(asm).toContain('; Global variables and constants');
    });
  });

  // ===========================================================================
  // Labels
  // ===========================================================================

  describe('labels', () => {
    it('should emit global label', () => {
      writer.emitLabel('main');
      expect(writer.toString()).toBe('main:');
    });

    it('should emit local label with dot prefix', () => {
      writer.emitLocalLabel('loop');
      expect(writer.toString()).toBe('.loop:');
    });

    it('should emit multiple labels', () => {
      writer.emitLabel('func');
      writer.emitLocalLabel('start');
      writer.emitLocalLabel('end');
      const asm = writer.toString();

      expect(asm).toContain('func:');
      expect(asm).toContain('.start:');
      expect(asm).toContain('.end:');
    });
  });

  // ===========================================================================
  // Instructions
  // ===========================================================================

  describe('instructions', () => {
    it('should emit instruction without operand', () => {
      writer.emitInstruction('RTS');
      expect(writer.toString()).toBe('  RTS');
    });

    it('should emit instruction with operand', () => {
      writer.emitInstruction('LDA', '#$00');
      expect(writer.toString()).toBe('  LDA #$00');
    });

    it('should emit instruction with comment', () => {
      writer.emitInstruction('STA', '$D020', 'Border color');
      const asm = writer.toString();

      expect(asm).toContain('STA $D020');
      expect(asm).toContain('; Border color');
    });

    it('should uppercase mnemonics', () => {
      writer.emitInstruction('lda', '#$05');
      expect(writer.toString()).toBe('  LDA #$05');
    });

    it('should emit various addressing modes', () => {
      writer.emitInstruction('LDA', '#$00'); // Immediate
      writer.emitInstruction('STA', '$D020'); // Absolute
      writer.emitInstruction('LDX', '$02'); // Zero-page
      writer.emitInstruction('STA', '$0400,X'); // Indexed
      writer.emitInstruction('JMP', '($FFFC)'); // Indirect

      const asm = writer.toString();
      expect(asm).toContain('LDA #$00');
      expect(asm).toContain('STA $D020');
      expect(asm).toContain('LDX $02');
      expect(asm).toContain('STA $0400,X');
      expect(asm).toContain('JMP ($FFFC)');
    });
  });

  // ===========================================================================
  // Data Directives
  // ===========================================================================

  describe('data directives', () => {
    it('should emit bytes with numbers', () => {
      writer.emitBytes([0x0b, 0x08]);
      expect(writer.toString()).toContain('!byte $0B, $08');
    });

    it('should emit bytes with hex strings', () => {
      writer.emitBytes(['$FF', '$00']);
      expect(writer.toString()).toContain('!byte $FF, $00');
    });

    it('should emit bytes with comment', () => {
      writer.emitBytes([0x9e], 'SYS token');
      const asm = writer.toString();
      expect(asm).toContain('!byte $9E');
      expect(asm).toContain('; SYS token');
    });

    it('should emit words', () => {
      writer.emitWords([0x0801, 0xd020]);
      expect(writer.toString()).toContain('!word $0801, $D020');
    });

    it('should emit words with comment', () => {
      writer.emitWords([0xfffc], 'Reset vector');
      const asm = writer.toString();
      expect(asm).toContain('!word $FFFC');
      expect(asm).toContain('; Reset vector');
    });

    it('should emit text', () => {
      writer.emitText('HELLO');
      expect(writer.toString()).toContain('!text "HELLO"');
    });

    it('should emit null-terminated text', () => {
      writer.emitText('HELLO', true);
      expect(writer.toString()).toContain('!text "HELLO", $00');
    });

    it('should emit text with comment', () => {
      writer.emitText('GAME', false, 'Game title');
      const asm = writer.toString();
      expect(asm).toContain('!text "GAME"');
      expect(asm).toContain('; Game title');
    });

    it('should emit fill directive', () => {
      writer.emitFill(10, 0x00);
      expect(writer.toString()).toContain('!fill 10, $00');
    });

    it('should emit fill with comment', () => {
      writer.emitFill(256, 0xff, 'Buffer');
      const asm = writer.toString();
      expect(asm).toContain('!fill 256, $FF');
      expect(asm).toContain('; Buffer');
    });
  });

  // ===========================================================================
  // Comments
  // ===========================================================================

  describe('comments', () => {
    it('should emit comment', () => {
      writer.emitComment('This is a comment');
      expect(writer.toString()).toBe('  ; This is a comment');
    });

    it('should emit source location comment', () => {
      writer.emitSourceLocationComment('main.blend', 10, 5);
      expect(writer.toString()).toContain('FILE:main.blend');
      expect(writer.toString()).toContain('LINE:10');
      expect(writer.toString()).toContain('COL:5');
    });
  });

  // ===========================================================================
  // Raw Output
  // ===========================================================================

  describe('raw output', () => {
    it('should emit blank line', () => {
      writer.emitBlankLine();
      expect(writer.toString()).toBe('');
      expect(writer.getLineCount()).toBe(1);
    });

    it('should emit raw text', () => {
      writer.emitRaw('; Custom directive');
      expect(writer.toString()).toBe('; Custom directive');
    });

    it('should emit multiple raw lines', () => {
      writer.emitRawLines(['line1', 'line2', 'line3']);
      const asm = writer.toString();
      expect(asm).toContain('line1');
      expect(asm).toContain('line2');
      expect(asm).toContain('line3');
    });
  });

  // ===========================================================================
  // Output
  // ===========================================================================

  describe('output', () => {
    it('should return complete assembly as string', () => {
      writer.emitLabel('start');
      writer.emitInstruction('LDA', '#$00');
      writer.emitInstruction('RTS');

      const asm = writer.toString();
      expect(asm).toBe('start:\n  LDA #$00\n  RTS');
    });

    it('should return line count', () => {
      writer.emitLabel('test');
      writer.emitInstruction('NOP');
      writer.emitInstruction('RTS');

      expect(writer.getLineCount()).toBe(3);
    });
  });

  // ===========================================================================
  // Common Patterns
  // ===========================================================================

  describe('common patterns', () => {
    it('should emit BASIC stub', () => {
      writer.emitBasicStub(2064);
      const asm = writer.toString();

      // Should include section header
      expect(asm).toContain('BASIC Stub');
      expect(asm).toContain('10 SYS 2064');

      // Should include stub bytes
      expect(asm).toContain('!byte');
      expect(asm).toContain('SYS token');
    });

    it('should emit function prologue', () => {
      writer.emitFunctionPrologue('_main', 'Main entry point');
      const asm = writer.toString();

      expect(asm).toContain('_main:');
      expect(asm).toContain('Main entry point');
      expect(asm).toContain('prologue');
    });

    it('should emit function epilogue', () => {
      writer.emitFunctionEpilogue();
      const asm = writer.toString();

      expect(asm).toContain('epilogue');
      expect(asm).toContain('RTS');
    });

    it('should emit infinite loop', () => {
      writer.emitInfiniteLoop();
      const asm = writer.toString();

      expect(asm).toContain('.loop:');
      expect(asm).toContain('JMP .loop');
    });

    it('should emit infinite loop with custom label', () => {
      writer.emitInfiniteLoop('.halt');
      const asm = writer.toString();

      expect(asm).toContain('.halt:');
      expect(asm).toContain('JMP .halt');
    });
  });

  // ===========================================================================
  // String Escaping
  // ===========================================================================

  describe('string escaping', () => {
    it('should escape backslash', () => {
      writer.emitText('a\\b');
      expect(writer.toString()).toContain('a\\\\b');
    });

    it('should escape quotes', () => {
      writer.emitText('say "hi"');
      expect(writer.toString()).toContain('say \\"hi\\"');
    });

    it('should escape newlines', () => {
      writer.emitText('line1\nline2');
      expect(writer.toString()).toContain('line1\\nline2');
    });

    it('should escape tabs', () => {
      writer.emitText('col1\tcol2');
      expect(writer.toString()).toContain('col1\\tcol2');
    });
  });

  // ===========================================================================
  // Complete Assembly File
  // ===========================================================================

  describe('complete assembly file', () => {
    it('should generate complete program structure', () => {
      // Header
      writer.emitHeader('test.blend', 'c64');
      writer.emitOrigin(0x0801);

      // BASIC stub
      writer.emitBasicStub(0x0810);

      // Code section
      writer.emitSectionHeader('Main Program');
      writer.emitOrigin(0x0810);
      writer.emitLabel('_main');
      writer.emitInstruction('LDA', '#$00');
      writer.emitInstruction('STA', '$D020', 'Border color');
      writer.emitInstruction('STA', '$D021', 'Background color');
      writer.emitInfiniteLoop();

      const asm = writer.toString();

      // Verify structure
      expect(asm).toContain('Blend65 Compiler Output');
      expect(asm).toContain('* = $0801');
      expect(asm).toContain('BASIC Stub');
      expect(asm).toContain('Main Program');
      expect(asm).toContain('_main:');
      expect(asm).toContain('LDA #$00');
      expect(asm).toContain('STA $D020');
      expect(asm).toContain('JMP .loop');

      // Should have reasonable line count
      expect(writer.getLineCount()).toBeGreaterThan(20);
    });
  });
});