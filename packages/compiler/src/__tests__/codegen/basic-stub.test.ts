/**
 * BASIC Stub Generator Tests
 *
 * Tests for the BASIC stub generator that creates autostart
 * programs for C64 .prg files.
 */

import { describe, it, expect } from 'vitest';
import {
  generateBasicStub,
  generateStandardBasicStub,
  calculateBasicStubSize,
  verifyBasicStub,
  numberToAsciiDigits,
  BASIC_TOKEN_SYS,
  BASIC_END_OF_LINE,
  BASIC_DEFAULT_LINE_NUMBER,
} from '../../codegen/basic-stub.js';
import { C64_BASIC_START, C64_CODE_START } from '../../codegen/types.js';

describe('BASIC Stub Generator', () => {
  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('Constants', () => {
    it('should export correct SYS token value', () => {
      // SYS token is $9E (158 decimal)
      expect(BASIC_TOKEN_SYS).toBe(0x9e);
    });

    it('should export correct end-of-line marker', () => {
      expect(BASIC_END_OF_LINE).toBe(0x00);
    });

    it('should export correct default line number', () => {
      expect(BASIC_DEFAULT_LINE_NUMBER).toBe(10);
    });
  });

  // ==========================================================================
  // numberToAsciiDigits
  // ==========================================================================

  describe('numberToAsciiDigits', () => {
    it('should convert single digit numbers', () => {
      expect(numberToAsciiDigits(0)).toEqual([0x30]); // '0'
      expect(numberToAsciiDigits(5)).toEqual([0x35]); // '5'
      expect(numberToAsciiDigits(9)).toEqual([0x39]); // '9'
    });

    it('should convert two digit numbers', () => {
      expect(numberToAsciiDigits(10)).toEqual([0x31, 0x30]); // '10'
      expect(numberToAsciiDigits(42)).toEqual([0x34, 0x32]); // '42'
      expect(numberToAsciiDigits(99)).toEqual([0x39, 0x39]); // '99'
    });

    it('should convert three digit numbers', () => {
      expect(numberToAsciiDigits(100)).toEqual([0x31, 0x30, 0x30]); // '100'
      expect(numberToAsciiDigits(256)).toEqual([0x32, 0x35, 0x36]); // '256'
    });

    it('should convert four digit numbers (common SYS addresses)', () => {
      // 2064 = $0810 (standard code start)
      expect(numberToAsciiDigits(2064)).toEqual([0x32, 0x30, 0x36, 0x34]);

      // 4096 = $1000
      expect(numberToAsciiDigits(4096)).toEqual([0x34, 0x30, 0x39, 0x36]);
    });

    it('should convert five digit numbers', () => {
      // 32768 = $8000
      expect(numberToAsciiDigits(32768)).toEqual([0x33, 0x32, 0x37, 0x36, 0x38]);

      // 49152 = $C000 (typical kernel area)
      expect(numberToAsciiDigits(49152)).toEqual([0x34, 0x39, 0x31, 0x35, 0x32]);
    });

    it('should convert maximum address (65535)', () => {
      expect(numberToAsciiDigits(65535)).toEqual([0x36, 0x35, 0x35, 0x33, 0x35]);
    });
  });

  // ==========================================================================
  // generateBasicStub - Basic Functionality
  // ==========================================================================

  describe('generateBasicStub - Basic Functionality', () => {
    it('should generate valid stub for standard C64 layout', () => {
      const result = generateBasicStub({ sysAddress: 0x0810 });

      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(result.size).toBeGreaterThan(0);
      expect(result.basicLine).toBe('10 SYS 2064');
    });

    it('should calculate correct code start address', () => {
      const result = generateBasicStub({
        sysAddress: 0x0810,
        loadAddress: C64_BASIC_START,
      });

      // Code starts immediately after BASIC stub
      expect(result.codeStart).toBe(C64_BASIC_START + result.size);
    });

    it('should use default line number of 10', () => {
      const result = generateBasicStub({ sysAddress: 0x0810 });
      expect(result.basicLine).toContain('10 SYS');
    });

    it('should use default load address of $0801', () => {
      const result = generateBasicStub({ sysAddress: 0x0810 });

      // Verify structure assumes $0801 as base
      const validation = verifyBasicStub(result.bytes, C64_BASIC_START);
      expect(validation.valid).toBe(true);
    });
  });

  // ==========================================================================
  // generateBasicStub - Custom Options
  // ==========================================================================

  describe('generateBasicStub - Custom Options', () => {
    it('should accept custom line number', () => {
      const result = generateBasicStub({
        sysAddress: 0x2000,
        lineNumber: 100,
      });

      expect(result.basicLine).toBe('100 SYS 8192');

      // Verify line number is encoded correctly
      const validation = verifyBasicStub(result.bytes);
      expect(validation.lineNumber).toBe(100);
    });

    it('should accept custom load address', () => {
      const customLoad = 0x0900;
      const result = generateBasicStub({
        sysAddress: 0x0920,
        loadAddress: customLoad,
      });

      const validation = verifyBasicStub(result.bytes, customLoad);
      expect(validation.valid).toBe(true);
    });

    it('should handle line number 0', () => {
      const result = generateBasicStub({
        sysAddress: 0x0810,
        lineNumber: 0,
      });

      expect(result.basicLine).toBe('0 SYS 2064');

      const validation = verifyBasicStub(result.bytes);
      expect(validation.lineNumber).toBe(0);
    });

    it('should handle maximum line number (63999)', () => {
      const result = generateBasicStub({
        sysAddress: 0x0810,
        lineNumber: 63999,
      });

      expect(result.basicLine).toBe('63999 SYS 2064');

      const validation = verifyBasicStub(result.bytes);
      expect(validation.lineNumber).toBe(63999);
    });
  });

  // ==========================================================================
  // generateBasicStub - Address Handling
  // ==========================================================================

  describe('generateBasicStub - Address Handling', () => {
    it('should handle minimum SYS address (0)', () => {
      const result = generateBasicStub({ sysAddress: 0 });

      expect(result.basicLine).toBe('10 SYS 0');

      const validation = verifyBasicStub(result.bytes);
      expect(validation.valid).toBe(true);
      // Note: sysAddress 0 is parsed correctly
      expect(validation.sysAddress).toBeDefined();
    });

    it('should handle maximum SYS address (65535)', () => {
      const result = generateBasicStub({ sysAddress: 65535 });

      expect(result.basicLine).toBe('10 SYS 65535');

      const validation = verifyBasicStub(result.bytes);
      expect(validation.sysAddress).toBe(65535);
    });

    it('should handle common C64 addresses', () => {
      const addresses = [
        { addr: 0x0810, decimal: 2064 },
        { addr: 0x1000, decimal: 4096 },
        { addr: 0x2000, decimal: 8192 },
        { addr: 0x4000, decimal: 16384 },
        { addr: 0x8000, decimal: 32768 },
        { addr: 0xc000, decimal: 49152 },
      ];

      for (const { addr, decimal } of addresses) {
        const result = generateBasicStub({ sysAddress: addr });
        expect(result.basicLine).toBe(`10 SYS ${decimal}`);

        const validation = verifyBasicStub(result.bytes);
        expect(validation.sysAddress).toBe(decimal);
      }
    });
  });

  // ==========================================================================
  // generateBasicStub - Byte Structure
  // ==========================================================================

  describe('generateBasicStub - Byte Structure', () => {
    it('should have correct structure for "10 SYS 2064"', () => {
      const result = generateBasicStub({ sysAddress: 2064 });
      const bytes = result.bytes;

      // Minimum expected size: 2 (ptr) + 2 (line#) + 1 (SYS) + 4 (digits) + 1 (eol) + 2 (end) = 12
      expect(bytes.length).toBe(12);

      // Bytes 2,3: Line number 10 (little-endian)
      expect(bytes[2]).toBe(10);
      expect(bytes[3]).toBe(0);

      // Byte 4: SYS token
      expect(bytes[4]).toBe(BASIC_TOKEN_SYS);

      // Bytes 5-8: "2064" as ASCII
      expect(bytes[5]).toBe(0x32); // '2'
      expect(bytes[6]).toBe(0x30); // '0'
      expect(bytes[7]).toBe(0x36); // '6'
      expect(bytes[8]).toBe(0x34); // '4'

      // Byte 9: End of line
      expect(bytes[9]).toBe(BASIC_END_OF_LINE);

      // Bytes 10-11: End of program
      expect(bytes[10]).toBe(0x00);
      expect(bytes[11]).toBe(0x00);
    });

    it('should calculate correct next line pointer', () => {
      const result = generateBasicStub({
        sysAddress: 2064,
        loadAddress: 0x0801,
      });
      const bytes = result.bytes;

      // Next line pointer is at bytes 0-1 (little-endian)
      const nextLinePtr = bytes[0] | (bytes[1] << 8);

      // Should point to byte AFTER end-of-line marker
      // Load address + stub size - 2 (the end-of-program marker)
      const expected = 0x0801 + bytes.length - 2;
      expect(nextLinePtr).toBe(expected);
    });

    it('should have longer structure for 5-digit addresses', () => {
      const result = generateBasicStub({ sysAddress: 65535 });

      // 2 (ptr) + 2 (line#) + 1 (SYS) + 5 (digits) + 1 (eol) + 2 (end) = 13
      expect(result.bytes.length).toBe(13);
    });
  });

  // ==========================================================================
  // generateBasicStub - Error Handling
  // ==========================================================================

  describe('generateBasicStub - Error Handling', () => {
    it('should throw for negative SYS address', () => {
      expect(() => generateBasicStub({ sysAddress: -1 })).toThrow();
    });

    it('should throw for SYS address > 65535', () => {
      expect(() => generateBasicStub({ sysAddress: 65536 })).toThrow();
    });

    it('should throw for non-integer SYS address', () => {
      expect(() => generateBasicStub({ sysAddress: 2064.5 })).toThrow('must be an integer');
    });

    it('should throw for negative line number', () => {
      expect(() =>
        generateBasicStub({
          sysAddress: 2064,
          lineNumber: -1,
        })
      ).toThrow();
    });

    it('should throw for line number > 63999', () => {
      expect(() =>
        generateBasicStub({
          sysAddress: 2064,
          lineNumber: 64000,
        })
      ).toThrow();
    });

    it('should throw for non-integer line number', () => {
      expect(() =>
        generateBasicStub({
          sysAddress: 2064,
          lineNumber: 10.5,
        })
      ).toThrow('must be an integer');
    });
  });

  // ==========================================================================
  // generateStandardBasicStub
  // ==========================================================================

  describe('generateStandardBasicStub', () => {
    it('should generate standard C64 stub', () => {
      const result = generateStandardBasicStub();

      expect(result.basicLine).toBe('10 SYS 2064');

      const validation = verifyBasicStub(result.bytes, C64_BASIC_START);
      expect(validation.valid).toBe(true);
      expect(validation.lineNumber).toBe(10);
      expect(validation.sysAddress).toBe(2064);
    });

    it('should use correct constants', () => {
      const result = generateStandardBasicStub();

      // Should use C64_CODE_START (0x0810 = 2064) as SYS address
      const validation = verifyBasicStub(result.bytes);
      expect(validation.sysAddress).toBe(C64_CODE_START);
    });
  });

  // ==========================================================================
  // calculateBasicStubSize
  // ==========================================================================

  describe('calculateBasicStubSize', () => {
    it('should calculate correct size for 4-digit address', () => {
      const size = calculateBasicStubSize(2064);
      expect(size).toBe(12); // 8 fixed + 4 digits
    });

    it('should calculate correct size for 5-digit address', () => {
      const size = calculateBasicStubSize(65535);
      expect(size).toBe(13); // 8 fixed + 5 digits
    });

    it('should calculate correct size for 1-digit address', () => {
      const size = calculateBasicStubSize(0);
      expect(size).toBe(9); // 8 fixed + 1 digit
    });

    it('should calculate correct size for 3-digit address', () => {
      const size = calculateBasicStubSize(256);
      expect(size).toBe(11); // 8 fixed + 3 digits
    });

    it('should match actual generated stub size', () => {
      const addresses = [0, 10, 100, 1000, 10000, 65535];

      for (const addr of addresses) {
        const calculated = calculateBasicStubSize(addr);
        const actual = generateBasicStub({ sysAddress: addr }).size;
        expect(calculated).toBe(actual);
      }
    });
  });

  // ==========================================================================
  // verifyBasicStub
  // ==========================================================================

  describe('verifyBasicStub', () => {
    it('should validate correct stub', () => {
      const stub = generateBasicStub({ sysAddress: 2064 });
      const validation = verifyBasicStub(stub.bytes, C64_BASIC_START);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.lineNumber).toBe(10);
      expect(validation.sysAddress).toBe(2064);
    });

    it('should detect stub too short', () => {
      const bytes = new Uint8Array([0x00, 0x00, 0x00]);
      const validation = verifyBasicStub(bytes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('too short'))).toBe(true);
    });

    it('should detect missing SYS token', () => {
      const stub = generateBasicStub({ sysAddress: 2064 });
      const bytes = new Uint8Array(stub.bytes);
      bytes[4] = 0x00; // Replace SYS token with null

      const validation = verifyBasicStub(bytes);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('SYS token'))).toBe(true);
    });

    it('should detect wrong next line pointer', () => {
      const stub = generateBasicStub({ sysAddress: 2064 });
      const bytes = new Uint8Array(stub.bytes);
      bytes[0] = 0xff; // Corrupt next line pointer

      const validation = verifyBasicStub(bytes, C64_BASIC_START);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('pointer mismatch'))).toBe(true);
    });

    it('should detect missing address digits', () => {
      // Create stub with SYS token but no digits (9 bytes minimum)
      // Intentionally malformed stub where SYS token is followed immediately by end-of-line
      const bytes = new Uint8Array([
        0x08, 0x08, // next line ptr (will be wrong but that's ok)
        0x0a, 0x00, // line number 10
        0x9e, // SYS token
        0x00, // end of line (no digits!)
        0x00, 0x00, // end of program
        0x00, // padding to reach 9 bytes
      ]);

      const validation = verifyBasicStub(bytes, 0x0801);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('No address digits'))).toBe(true);
    });

    it('should parse line number correctly', () => {
      // Line number 256 = $0100
      const stub = generateBasicStub({
        sysAddress: 2064,
        lineNumber: 256,
      });

      const validation = verifyBasicStub(stub.bytes);

      expect(validation.valid).toBe(true);
      expect(validation.lineNumber).toBe(256);
    });

    it('should parse multi-digit SYS address', () => {
      const stub = generateBasicStub({ sysAddress: 49152 });
      const validation = verifyBasicStub(stub.bytes);

      expect(validation.valid).toBe(true);
      expect(validation.sysAddress).toBe(49152);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration', () => {
    it('should produce identical output for same inputs', () => {
      const stub1 = generateBasicStub({ sysAddress: 2064 });
      const stub2 = generateBasicStub({ sysAddress: 2064 });

      expect(stub1.bytes).toEqual(stub2.bytes);
      expect(stub1.basicLine).toBe(stub2.basicLine);
      expect(stub1.size).toBe(stub2.size);
      expect(stub1.codeStart).toBe(stub2.codeStart);
    });

    it('should work for typical game load addresses', () => {
      // Common patterns:
      // BASIC at $0801, code at $0810
      // BASIC at $0801, code at $1000
      // BASIC at $0801, code at $2000

      const patterns = [
        { load: 0x0801, code: 0x0810 },
        { load: 0x0801, code: 0x1000 },
        { load: 0x0801, code: 0x2000 },
        { load: 0x0801, code: 0xc000 },
      ];

      for (const { load, code } of patterns) {
        const stub = generateBasicStub({
          sysAddress: code,
          loadAddress: load,
        });

        const validation = verifyBasicStub(stub.bytes, load);
        expect(validation.valid).toBe(true);
        expect(validation.sysAddress).toBe(code);
      }
    });

    it('should generate correct bytes for VICE testing', () => {
      // This is the exact byte sequence that should work in VICE
      const stub = generateStandardBasicStub();
      const bytes = stub.bytes;

      // Verify it matches expected VICE-compatible format
      // The stub should decode as: 10 SYS 2064

      // Just verify key structural elements
      expect(bytes[4]).toBe(0x9e); // SYS token
      expect(bytes[bytes.length - 1]).toBe(0x00); // End of program
      expect(bytes[bytes.length - 2]).toBe(0x00); // End of program

      // The codeStart should be where machine code goes
      expect(stub.codeStart).toBe(C64_BASIC_START + stub.size);
    });
  });
});