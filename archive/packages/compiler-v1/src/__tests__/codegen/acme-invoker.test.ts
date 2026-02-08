/**
 * ACME Invoker Tests
 *
 * Tests for the ACME assembler integration module.
 * Tests cover:
 * - ACME executable discovery
 * - Error classes for assembly failures
 * - Command-line argument building
 * - Integration tests (when ACME is available)
 *
 * Note: Some tests require ACME to be installed on the system.
 * These tests are skipped automatically if ACME is not found.
 *
 * @module codegen/acme-invoker.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import {
  findAcme,
  isAcmeAvailable,
  invokeAcme,
  assembleSimple,
  getAcmeVersion,
  AcmeError,
  AcmeNotFoundError,
  type AcmeOptions,
  type AcmeResult,
} from '../../codegen/acme-invoker.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Check if ACME is available for integration tests
 */
const ACME_PATH = findAcme();
const ACME_AVAILABLE = ACME_PATH !== null;

/**
 * Simple assembly source that produces valid PRG
 */
const SIMPLE_ASM_SOURCE = `
; Simple test program
* = $0801

; BASIC stub for SYS 2064
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00

* = $0810
  LDA #$05
  STA $D020
  RTS
`;

/**
 * Assembly source with labels for label file testing
 */
const LABELED_ASM_SOURCE = `
; Program with labels
* = $0801
!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00

* = $0810
main:
  JSR set_border
  RTS

set_border:
  LDA #$05
  STA $D020
  RTS

counter:
  !byte $00
`;

/**
 * Assembly source with syntax error
 */
const INVALID_ASM_SOURCE = `
* = $0801
  LDA  ; Missing operand - syntax error
  RTS
`;

// ============================================================================
// AcmeError Class Tests
// ============================================================================

describe('AcmeError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const error = new AcmeError(
        'Assembly failed',
        1,
        'stdout output',
        'stderr output',
        'LDA #$00',
      );

      expect(error.name).toBe('AcmeError');
      expect(error.message).toBe('Assembly failed');
      expect(error.exitCode).toBe(1);
      expect(error.stdout).toBe('stdout output');
      expect(error.stderr).toBe('stderr output');
      expect(error.source).toBe('LDA #$00');
    });

    it('should be an instance of Error', () => {
      const error = new AcmeError('test', 1, '', '', '');
      expect(error).toBeInstanceOf(Error);
    });

    it('should preserve stack trace', () => {
      const error = new AcmeError('test', 1, '', '', '');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AcmeError');
    });

    it('should handle empty strings', () => {
      const error = new AcmeError('', 0, '', '', '');
      expect(error.message).toBe('');
      expect(error.exitCode).toBe(0);
      expect(error.stdout).toBe('');
      expect(error.stderr).toBe('');
      expect(error.source).toBe('');
    });

    it('should handle multiline source', () => {
      const source = 'LDA #$00\nSTA $D020\nRTS';
      const error = new AcmeError('error', 1, '', '', source);
      expect(error.source).toBe(source);
    });
  });
});

// ============================================================================
// AcmeNotFoundError Class Tests
// ============================================================================

describe('AcmeNotFoundError', () => {
  describe('constructor', () => {
    it('should create error with searched paths', () => {
      const searchedPaths = ['/usr/bin/acme', '/usr/local/bin/acme'];
      const error = new AcmeNotFoundError(searchedPaths);

      expect(error.name).toBe('AcmeNotFoundError');
      expect(error.searchedPaths).toEqual(searchedPaths);
    });

    it('should include installation instructions in message', () => {
      const error = new AcmeNotFoundError([]);

      expect(error.message).toContain('ACME assembler not found');
      expect(error.message).toContain('brew install acme');
      expect(error.message).toContain('sudo apt install acme');
      expect(error.message).toContain('--acme-path');
    });

    it('should be an instance of Error', () => {
      const error = new AcmeNotFoundError([]);
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle empty search paths', () => {
      const error = new AcmeNotFoundError([]);
      expect(error.searchedPaths).toEqual([]);
    });

    it('should preserve search paths', () => {
      const paths = ['/path/1', '/path/2', '/path/3'];
      const error = new AcmeNotFoundError(paths);
      expect(error.searchedPaths).toHaveLength(3);
      expect(error.searchedPaths[0]).toBe('/path/1');
    });
  });
});

// ============================================================================
// findAcme Function Tests
// ============================================================================

describe('findAcme', () => {
  describe('path searching', () => {
    it('should return string or null', () => {
      const result = findAcme();
      expect(result === null || typeof result === 'string').toBe(true);
    });

    it('should return existing file path if found', () => {
      const result = findAcme();
      if (result !== null) {
        expect(existsSync(result)).toBe(true);
      }
    });

    it('should return absolute path if found', () => {
      const result = findAcme();
      if (result !== null) {
        // Absolute paths start with / on Unix or drive letter on Windows
        const isAbsolute =
          result.startsWith('/') || /^[A-Za-z]:/.test(result);
        expect(isAbsolute).toBe(true);
      }
    });
  });

  describe('platform-specific behavior', () => {
    it('should handle missing PATH environment variable', () => {
      const originalPath = process.env['PATH'];
      delete process.env['PATH'];

      try {
        // Should not throw
        const result = findAcme();
        expect(result === null || typeof result === 'string').toBe(true);
      } finally {
        process.env['PATH'] = originalPath;
      }
    });
  });
});

// ============================================================================
// isAcmeAvailable Function Tests
// ============================================================================

describe('isAcmeAvailable', () => {
  describe('without path argument', () => {
    it('should return boolean', () => {
      const result = isAcmeAvailable();
      expect(typeof result).toBe('boolean');
    });

    it('should be consistent with findAcme', () => {
      const available = isAcmeAvailable();
      const found = findAcme();

      if (available) {
        expect(found).not.toBeNull();
      } else {
        expect(found).toBeNull();
      }
    });
  });

  describe('with path argument', () => {
    it('should return true for existing file', () => {
      // Use a file we know exists (the test file itself)
      const thisFile = import.meta.url.replace('file://', '');
      const normalizedPath = thisFile.startsWith('/') ? thisFile : '/' + thisFile;
      expect(isAcmeAvailable(normalizedPath)).toBe(true);
    });

    it('should return false for non-existing file', () => {
      expect(isAcmeAvailable('/nonexistent/path/to/acme')).toBe(false);
    });

    it('should return false for empty path', () => {
      expect(isAcmeAvailable('')).toBe(false);
    });

    it('should check specific path, not PATH', () => {
      // Even if ACME is in PATH, checking a wrong path should fail
      expect(isAcmeAvailable('/definitely/not/acme')).toBe(false);
    });
  });
});

// ============================================================================
// invokeAcme Function Tests (Unit Tests - No ACME Required)
// ============================================================================

describe('invokeAcme - Unit Tests', () => {
  describe('error handling', () => {
    it('should throw AcmeNotFoundError when ACME path does not exist', async () => {
      await expect(
        invokeAcme('LDA #$00', {
          format: 'prg',
          acmePath: '/nonexistent/acme',
        }),
      ).rejects.toThrow(AcmeNotFoundError);
    });

    it('should include searched path in error', async () => {
      try {
        await invokeAcme('LDA #$00', {
          format: 'prg',
          acmePath: '/my/custom/acme',
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AcmeNotFoundError);
        const acmeError = error as AcmeNotFoundError;
        expect(acmeError.searchedPaths).toContain('/my/custom/acme');
      }
    });
  });

  describe('options validation', () => {
    it('should accept prg format option', async () => {
      const options: AcmeOptions = {
        format: 'prg',
        acmePath: '/nonexistent',
      };

      // Should fail at ACME not found, not options
      await expect(invokeAcme('test', options)).rejects.toThrow(
        AcmeNotFoundError,
      );
    });

    it('should accept bin format option', async () => {
      const options: AcmeOptions = {
        format: 'bin',
        acmePath: '/nonexistent',
      };

      await expect(invokeAcme('test', options)).rejects.toThrow(
        AcmeNotFoundError,
      );
    });

    it('should accept labels option', async () => {
      const options: AcmeOptions = {
        format: 'prg',
        labels: true,
        acmePath: '/nonexistent',
      };

      await expect(invokeAcme('test', options)).rejects.toThrow(
        AcmeNotFoundError,
      );
    });

    it('should accept verbose option', async () => {
      const options: AcmeOptions = {
        format: 'prg',
        verbose: true,
        acmePath: '/nonexistent',
      };

      await expect(invokeAcme('test', options)).rejects.toThrow(
        AcmeNotFoundError,
      );
    });

    it('should accept timeout option', async () => {
      const options: AcmeOptions = {
        format: 'prg',
        timeout: 5000,
        acmePath: '/nonexistent',
      };

      await expect(invokeAcme('test', options)).rejects.toThrow(
        AcmeNotFoundError,
      );
    });
  });
});

// ============================================================================
// invokeAcme Function Tests (Integration Tests - ACME Required)
// ============================================================================

describe('invokeAcme - Integration Tests', () => {
  // Skip all tests if ACME is not available
  const describeAcme = ACME_AVAILABLE ? describe : describe.skip;

  describeAcme('successful assembly', () => {
    it('should assemble simple source to PRG format', async () => {
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, {
        format: 'prg',
      });

      expect(result.binary).toBeInstanceOf(Uint8Array);
      expect(result.binary.length).toBeGreaterThan(0);

      // PRG format: first 2 bytes are load address ($0801 = 0x01, 0x08)
      expect(result.binary[0]).toBe(0x01);
      expect(result.binary[1]).toBe(0x08);
    });

    it('should assemble to raw binary format', async () => {
      const rawSource = `
        * = $C000
        LDA #$05
        RTS
      `;

      const result = await invokeAcme(rawSource, {
        format: 'bin',
      });

      expect(result.binary).toBeInstanceOf(Uint8Array);
      // Raw binary: no load address header
      // LDA #$05 = A9 05 (2 bytes)
      // RTS = 60 (1 byte)
      expect(result.binary.length).toBe(3);
      expect(result.binary[0]).toBe(0xa9); // LDA immediate
      expect(result.binary[1]).toBe(0x05); // value
      expect(result.binary[2]).toBe(0x60); // RTS
    });

    it('should generate label file when requested', async () => {
      const result = await invokeAcme(LABELED_ASM_SOURCE, {
        format: 'prg',
        labels: true,
      });

      expect(result.labels).toBeDefined();
      expect(typeof result.labels).toBe('string');
      expect(result.labels!.length).toBeGreaterThan(0);

      // Label file should contain our labels
      expect(result.labels).toContain('main');
      expect(result.labels).toContain('set_border');
    });

    it('should capture stdout', async () => {
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, {
        format: 'prg',
      });

      expect(typeof result.stdout).toBe('string');
    });

    it('should capture stderr', async () => {
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, {
        format: 'prg',
      });

      expect(typeof result.stderr).toBe('string');
    });

    it('should work with verbose mode', async () => {
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, {
        format: 'prg',
        verbose: true,
      });

      expect(result.binary.length).toBeGreaterThan(0);
    });

    it('should use custom ACME path if provided', async () => {
      // Use the found ACME path explicitly
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, {
        format: 'prg',
        acmePath: ACME_PATH!,
      });

      expect(result.binary.length).toBeGreaterThan(0);
    });
  });

  describeAcme('error handling with real ACME', () => {
    it('should throw AcmeError on syntax error', async () => {
      await expect(
        invokeAcme(INVALID_ASM_SOURCE, { format: 'prg' }),
      ).rejects.toThrow(AcmeError);
    });

    it('should include error details in AcmeError', async () => {
      try {
        await invokeAcme(INVALID_ASM_SOURCE, { format: 'prg' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AcmeError);
        const acmeError = error as AcmeError;
        expect(acmeError.exitCode).not.toBe(0);
        expect(acmeError.source).toBe(INVALID_ASM_SOURCE);
        // ACME puts errors in stderr
        expect(acmeError.stderr.length > 0 || acmeError.message.length > 0).toBe(
          true,
        );
      }
    });

    it('should handle empty source', async () => {
      const result = await invokeAcme('', { format: 'prg' });
      // Empty source produces empty binary (just load address)
      expect(result.binary).toBeInstanceOf(Uint8Array);
    });

    it('should handle source with only comments', async () => {
      const result = await invokeAcme('; Just a comment\n; Another comment', {
        format: 'prg',
      });
      expect(result.binary).toBeInstanceOf(Uint8Array);
    });
  });

  describeAcme('temp file cleanup', () => {
    it('should clean up temp files on success', async () => {
      // Run assembly
      await invokeAcme(SIMPLE_ASM_SOURCE, { format: 'prg' });

      // Temp files should be cleaned up - we can't easily test this
      // without inspecting internals, but no errors should occur
    });

    it('should clean up temp files on failure', async () => {
      try {
        await invokeAcme(INVALID_ASM_SOURCE, { format: 'prg' });
      } catch {
        // Expected to fail - but cleanup should still happen
      }

      // No way to verify cleanup directly, but no resource leaks
    });
  });

  describeAcme('binary output validation', () => {
    it('should produce correct PRG header', async () => {
      const result = await invokeAcme(SIMPLE_ASM_SOURCE, { format: 'prg' });

      // Load address header: $0801 in little-endian
      expect(result.binary[0]).toBe(0x01);
      expect(result.binary[1]).toBe(0x08);
    });

    it('should produce correct binary size', async () => {
      const source = `
        * = $C000
        ; Just 3 bytes: LDA #$00, RTS
        LDA #$00
        RTS
      `;

      const result = await invokeAcme(source, { format: 'prg' });

      // PRG = 2 (header) + 3 (code) = 5 bytes
      expect(result.binary.length).toBe(5);
    });

    it('should handle different load addresses', async () => {
      const source = `
        * = $C000
        LDA #$00
        RTS
      `;

      const result = await invokeAcme(source, { format: 'prg' });

      // Load address header: $C000 in little-endian
      expect(result.binary[0]).toBe(0x00);
      expect(result.binary[1]).toBe(0xc0);
    });
  });
});

// ============================================================================
// assembleSimple Function Tests
// ============================================================================

describe('assembleSimple', () => {
  const describeAcme = ACME_AVAILABLE ? describe : describe.skip;

  describeAcme('convenience function', () => {
    it('should assemble simple source', async () => {
      const binary = await assembleSimple(SIMPLE_ASM_SOURCE);

      expect(binary).toBeInstanceOf(Uint8Array);
      expect(binary.length).toBeGreaterThan(0);
    });

    it('should use PRG format by default', async () => {
      const binary = await assembleSimple(SIMPLE_ASM_SOURCE);

      // PRG format: first 2 bytes are load address
      expect(binary[0]).toBe(0x01);
      expect(binary[1]).toBe(0x08);
    });

    it('should accept custom ACME path', async () => {
      const binary = await assembleSimple(SIMPLE_ASM_SOURCE, ACME_PATH!);
      expect(binary.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should throw AcmeNotFoundError when ACME not available', async () => {
      await expect(
        assembleSimple('LDA #$00', '/nonexistent/acme'),
      ).rejects.toThrow(AcmeNotFoundError);
    });
  });
});

// ============================================================================
// getAcmeVersion Function Tests
// ============================================================================

describe('getAcmeVersion', () => {
  const describeAcme = ACME_AVAILABLE ? describe : describe.skip;

  describeAcme('when ACME is available', () => {
    it('should return version string', async () => {
      const version = await getAcmeVersion();

      expect(version).not.toBeNull();
      expect(typeof version).toBe('string');
      expect(version!.length).toBeGreaterThan(0);
    });

    it('should return version with custom path', async () => {
      const version = await getAcmeVersion(ACME_PATH!);

      expect(version).not.toBeNull();
    });
  });

  describe('when ACME is not available', () => {
    it('should return null for non-existent path', async () => {
      const version = await getAcmeVersion('/nonexistent/acme');
      expect(version).toBeNull();
    });
  });
});

// ============================================================================
// AcmeOptions Interface Tests
// ============================================================================

describe('AcmeOptions interface', () => {
  it('should allow minimal options', () => {
    const options: AcmeOptions = {
      format: 'prg',
    };

    expect(options.format).toBe('prg');
    expect(options.acmePath).toBeUndefined();
    expect(options.labels).toBeUndefined();
    expect(options.verbose).toBeUndefined();
    expect(options.timeout).toBeUndefined();
  });

  it('should allow all options', () => {
    const options: AcmeOptions = {
      format: 'bin',
      acmePath: '/usr/local/bin/acme',
      labels: true,
      verbose: true,
      timeout: 60000,
    };

    expect(options.format).toBe('bin');
    expect(options.acmePath).toBe('/usr/local/bin/acme');
    expect(options.labels).toBe(true);
    expect(options.verbose).toBe(true);
    expect(options.timeout).toBe(60000);
  });
});

// ============================================================================
// AcmeResult Interface Tests
// ============================================================================

describe('AcmeResult interface', () => {
  it('should match expected structure', () => {
    // Type check only - this just ensures the interface is exported correctly
    const mockResult: AcmeResult = {
      binary: new Uint8Array([0x01, 0x08]),
      stdout: '',
      stderr: '',
    };

    expect(mockResult.binary).toBeInstanceOf(Uint8Array);
    expect(mockResult.labels).toBeUndefined();
    expect(mockResult.stdout).toBe('');
    expect(mockResult.stderr).toBe('');
  });

  it('should allow optional labels', () => {
    const mockResult: AcmeResult = {
      binary: new Uint8Array([0x01, 0x08]),
      labels: 'al C:0810 .main',
      stdout: '',
      stderr: '',
    };

    expect(mockResult.labels).toBe('al C:0810 .main');
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Edge Cases', () => {
  describe('source code handling', () => {
    const describeAcme = ACME_AVAILABLE ? describe : describe.skip;

    describeAcme('special characters in source', () => {
      it('should handle source with quotes', async () => {
        const source = `
          * = $0801
          !byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00
          * = $0810
          msg: !text "Hello", 0
        `;

        const result = await invokeAcme(source, { format: 'prg' });
        expect(result.binary.length).toBeGreaterThan(0);
      });

      it('should handle source with special ACME syntax', async () => {
        const source = `
          * = $0801
          !byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00
          * = $0810
          !for i, 0, 3 {
            NOP
          }
          RTS
        `;

        const result = await invokeAcme(source, { format: 'prg' });
        expect(result.binary.length).toBeGreaterThan(0);
      });

      it('should handle large source files', async () => {
        // Generate source with many instructions
        let source = '* = $0801\n';
        source +=
          '!byte $0b, $08, $0a, $00, $9e, $32, $30, $36, $34, $00, $00, $00\n';
        source += '* = $0810\n';

        for (let i = 0; i < 1000; i++) {
          source += `  NOP  ; Instruction ${i}\n`;
        }
        source += '  RTS\n';

        const result = await invokeAcme(source, { format: 'prg' });
        // 2 (header) + 12 (BASIC stub) + 1000 (NOPs) + 1 (RTS) = 1015
        expect(result.binary.length).toBeGreaterThanOrEqual(1015);
      });
    });
  });

  describe('platform differences', () => {
    it('should handle PATH with different separators', () => {
      // findAcme should work regardless of path separator
      const result = findAcme();
      // Just ensure it doesn't crash
      expect(result === null || typeof result === 'string').toBe(true);
    });
  });
});

// ============================================================================
// Type Export Tests
// ============================================================================

describe('Type Exports', () => {
  it('should export AcmeOptions type', () => {
    // TypeScript will fail to compile if type is not exported
    const options: AcmeOptions = { format: 'prg' };
    expect(options.format).toBe('prg');
  });

  it('should export AcmeResult type', () => {
    const result: AcmeResult = {
      binary: new Uint8Array(),
      stdout: '',
      stderr: '',
    };
    expect(result.binary).toBeInstanceOf(Uint8Array);
  });

  it('should export AcmeError class', () => {
    const error = new AcmeError('test', 1, '', '', '');
    expect(error).toBeInstanceOf(AcmeError);
    expect(error).toBeInstanceOf(Error);
  });

  it('should export AcmeNotFoundError class', () => {
    const error = new AcmeNotFoundError([]);
    expect(error).toBeInstanceOf(AcmeNotFoundError);
    expect(error).toBeInstanceOf(Error);
  });
});