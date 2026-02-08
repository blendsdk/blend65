/**
 * E2E Intrinsic Signature Tests
 *
 * Tests that all intrinsic functions accept correct arguments
 * and reject incorrect arguments.
 *
 * Intrinsic categories:
 * - Memory: peek, poke, peekw, pokew
 * - Byte extraction: lo, hi
 * - CPU control: sei, cli, nop, brk
 * - Stack operations: pha, pla, php, plp
 * - Optimization: barrier, volatile_read, volatile_write
 * - Compile-time: sizeof, length
 *
 * @module e2e/intrinsic-signatures
 */

import { describe, it, expect } from 'vitest';

import {
  compile,
  compileExpectSuccess,
  compileExpectFailure,
  compileToAsm,
  expectAsmContains,
  expectAsmInstruction,
} from './helpers/index.js';

// =============================================================================
// Memory Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - Memory Intrinsics', () => {
  describe('peek(address: word): byte', () => {
    it('accepts word literal address', () => {
      const result = compile(`
        function test(): byte {
          return peek($D020);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word variable address', () => {
      const result = compile(`
        let addr: word = $D020;
        function test(): byte {
          return peek(addr);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts hex address with 0x prefix', () => {
      const result = compile(`
        function test(): byte {
          return peek(0xD020);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts decimal address', () => {
      const result = compile(`
        function test(): byte {
          return peek(53280);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns byte type', () => {
      // Verify peek returns a byte that can be assigned to byte variable
      const result = compile(`
        function test(): byte {
          let value: byte = peek($D020);
          return value;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('poke(address: word, value: byte): void', () => {
    it('accepts word address and byte value', () => {
      const result = compile(`
        function test(): void {
          poke($D020, 0);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts variables for both arguments', () => {
      const result = compile(`
        let addr: word = $D020;
        let color: byte = 5;
        function test(): void {
          poke(addr, color);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts expression for value', () => {
      const result = compile(`
        function test(): void {
          poke($D020, 1 + 2);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('peekw(address: word): word', () => {
    it('accepts word address', () => {
      const result = compile(`
        function test(): word {
          return peekw($FFFA);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns word type', () => {
      const result = compile(`
        function test(): word {
          let vector: word = peekw($FFFA);
          return vector;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('pokew(address: word, value: word): void', () => {
    it('accepts word address and word value', () => {
      const result = compile(`
        function test(): void {
          pokew($FFFA, $1000);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts variables for both arguments', () => {
      const result = compile(`
        let addr: word = $FFFA;
        let handler: word = $1000;
        function test(): void {
          pokew(addr, handler);
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Byte Extraction Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - Byte Extraction', () => {
  describe('lo(value: word): byte', () => {
    it('accepts word literal', () => {
      const result = compile(`
        function test(): byte {
          return lo($1234);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word variable', () => {
      const result = compile(`
        let addr: word = $1234;
        function test(): byte {
          return lo(addr);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns byte type', () => {
      const result = compile(`
        function test(): byte {
          let low: byte = lo($1234);
          return low;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('hi(value: word): byte', () => {
    it('accepts word literal', () => {
      const result = compile(`
        function test(): byte {
          return hi($1234);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word variable', () => {
      const result = compile(`
        let addr: word = $1234;
        function test(): byte {
          return hi(addr);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns byte type', () => {
      const result = compile(`
        function test(): byte {
          let high: byte = hi($1234);
          return high;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('lo and hi together', () => {
    it('can extract both bytes from word', () => {
      const result = compile(`
        function test(): void {
          let addr: word = $1234;
          let low: byte = lo(addr);
          let high: byte = hi(addr);
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// CPU Control Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - CPU Control', () => {
  describe('sei(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          sei();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('cli(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          cli();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('nop(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          nop();
        }
      `);
      expect(result.success).toBe(true);
    });

    it('can be called multiple times for timing', () => {
      const result = compile(`
        function delay(): void {
          nop();
          nop();
          nop();
          nop();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('brk(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          brk();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('sei/cli pattern', () => {
    it('compiles interrupt disable/enable pattern', () => {
      const result = compile(`
        function criticalSection(): void {
          sei();
          poke($D020, 0);
          cli();
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Stack Operation Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - Stack Operations', () => {
  describe('pha(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          pha();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('pla(): byte', () => {
    it('accepts no arguments and returns byte', () => {
      const result = compile(`
        function test(): byte {
          return pla();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('php(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          php();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('plp(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          plp();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('push/pull patterns', () => {
    it('compiles accumulator save/restore pattern', () => {
      const result = compile(`
        function saveAccumulator(): void {
          pha();
          poke($D020, 0);
          pla();
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles processor status save/restore pattern', () => {
      const result = compile(`
        function saveFlags(): void {
          php();
          sei();
          poke($D020, 0);
          plp();
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Optimization Control Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - Optimization Control', () => {
  describe('barrier(): void', () => {
    it('accepts no arguments', () => {
      const result = compile(`
        function test(): void {
          barrier();
        }
      `);
      expect(result.success).toBe(true);
    });

    it('can be used between operations', () => {
      const result = compile(`
        function test(): void {
          poke($D020, 0);
          barrier();
          poke($D021, 1);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('volatile_read(address: word): byte', () => {
    it('accepts word address', () => {
      const result = compile(`
        function test(): byte {
          return volatile_read($D012);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns byte type', () => {
      const result = compile(`
        function test(): byte {
          let raster: byte = volatile_read($D012);
          return raster;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('volatile_write(address: word, value: byte): void', () => {
    it('accepts word address and byte value', () => {
      const result = compile(`
        function test(): void {
          volatile_write($D020, 0);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('volatile read/write pattern', () => {
    it('compiles raster polling loop pattern', () => {
      const result = compile(`
        function waitRaster(): void {
          while (volatile_read($D012) != 100) {
            nop();
          }
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Compile-Time Intrinsics
// =============================================================================

describe('E2E Intrinsic Signatures - Compile-Time', () => {
  describe('sizeof(type): byte', () => {
    it('accepts byte type', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(byte);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word type', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(word);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts boolean type', () => {
      const result = compile(`
        function test(): byte {
          return sizeof(boolean);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts variable expression', () => {
      const result = compile(`
        let x: word = 0;
        function test(): byte {
          return sizeof(x);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('returns compile-time constant', () => {
      // sizeof should return 1 for byte, 2 for word
      const result = compile(`
        function test(): byte {
          let size: byte = sizeof(byte);
          return size;
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('length(array): word', () => {
    it('accepts byte array', () => {
      const result = compile(`
        let data: byte[10];
        function test(): word {
          return length(data);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts word array', () => {
      const result = compile(`
        let values: word[5];
        function test(): word {
          return length(values);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts initialized array', () => {
      const result = compile(`
        let data: byte[3] = [1, 2, 3];
        function test(): word {
          return length(data);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('accepts @map array', () => {
      const result = compile(`
        @map screen at $0400: byte[1000];
        function test(): word {
          return length(screen);
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Real-World Usage Patterns
// =============================================================================

describe('E2E Intrinsic Signatures - Real-World Patterns', () => {
  describe('Hardware Interaction', () => {
    it('compiles border color change', () => {
      const result = compile(`
        function setBorderColor(color: byte): void {
          poke($D020, color);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles screen memory write', () => {
      const result = compile(`
        function writeChar(offset: word, char: byte): void {
          poke($0400 + offset, char);
        }
      `);
      expect(result.success).toBe(true);
    });

    it('compiles interrupt handler setup', () => {
      const result = compile(`
        function setupIrq(handler: word): void {
          sei();
          pokew($FFFE, handler);
          cli();
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Address Manipulation', () => {
    it('compiles address splitting', () => {
      const result = compile(`
        function getAddrLo(addr: word): byte {
          return lo(addr);
        }
        
        function getAddrHi(addr: word): byte {
          return hi(addr);
        }
      `);
      expect(result.success).toBe(true);
    });
  });

  describe('Timing-Critical Code', () => {
    it('compiles stable raster routine', () => {
      const result = compile(`
        function stableRaster(): void {
          sei();
          while (volatile_read($D012) != 50) {
            nop();
          }
          barrier();
          poke($D020, 1);
          cli();
        }
      `);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Error Cases - Incorrect Usage
// =============================================================================

describe('E2E Intrinsic Signatures - Error Cases', () => {
  describe('Wrong argument count', () => {
    it('rejects peek with no arguments', () => {
      const result = compile(`
        function test(): byte {
          return peek();
        }
      `);
      expect(result.success).toBe(false);
    });

    it('rejects poke with one argument', () => {
      const result = compile(`
        function test(): void {
          poke($D020);
        }
      `);
      expect(result.success).toBe(false);
    });

    it('rejects sei with arguments', () => {
      const result = compile(`
        function test(): void {
          sei(1);
        }
      `);
      expect(result.success).toBe(false);
    });
  });

  describe('Type mismatches', () => {
    // Note: Some type mismatches may be caught, others may compile with implicit conversion
    // These tests document actual behavior

    it('documents behavior when passing string to peek', () => {
      const result = compile(`
        function test(): byte {
          return peek("hello");
        }
      `);
      // Document actual behavior - should fail
      expect(result.success).toBe(false);
    });
  });
});