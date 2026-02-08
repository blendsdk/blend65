/**
 * BASIC Stub Generator
 *
 * Generates Commodore 64 BASIC stubs for autostart functionality.
 * The BASIC stub is a minimal BASIC program that automatically
 * executes machine code when the user types RUN.
 *
 * **BASIC Stub Format:**
 *
 * The generated BASIC program creates: `10 SYS <address>`
 *
 * Memory layout at $0801 (standard BASIC start):
 * ```
 * +0,1: Next line pointer (little-endian)
 * +2,3: Line number (10, little-endian)
 * +4:   SYS token ($9E)
 * +5-n: Address as ASCII digits
 * +n+1: End of line marker ($00)
 * +n+2,n+3: End of program marker ($00, $00)
 * ```
 *
 * @module codegen/basic-stub
 */

import { C64_BASIC_START, C64_CODE_START } from './types.js';

/**
 * BASIC token for SYS command
 *
 * On the C64, BASIC keywords are tokenized to single bytes.
 * SYS is token $9E (158 decimal).
 */
export const BASIC_TOKEN_SYS = 0x9e;

/**
 * End of BASIC line marker
 */
export const BASIC_END_OF_LINE = 0x00;

/**
 * Default line number for autostart stub
 */
export const BASIC_DEFAULT_LINE_NUMBER = 10;

/**
 * Options for BASIC stub generation
 */
export interface BasicStubOptions {
  /**
   * The address to SYS to (machine code entry point)
   *
   * Typically $0810 (2064 decimal) for standard C64 programs
   * that load at $0801 with a BASIC stub.
   */
  sysAddress: number;

  /**
   * BASIC line number for the SYS statement
   *
   * Default: 10
   * Must be between 0 and 63999.
   */
  lineNumber?: number;

  /**
   * Load address for the BASIC program
   *
   * Default: $0801 (C64 BASIC start)
   * This is used to calculate the "next line" pointer.
   */
  loadAddress?: number;
}

/**
 * Result of BASIC stub generation
 */
export interface BasicStubResult {
  /**
   * The generated BASIC stub as raw bytes
   */
  bytes: Uint8Array;

  /**
   * Size of the BASIC stub in bytes
   */
  size: number;

  /**
   * Address where machine code should start
   * (immediately after the BASIC stub)
   */
  codeStart: number;

  /**
   * BASIC representation for debugging
   * e.g., "10 SYS 2064"
   */
  basicLine: string;
}

/**
 * Validates a SYS address for C64 memory constraints
 *
 * @param address - The address to validate
 * @throws Error if address is out of valid range
 */
function validateSysAddress(address: number): void {
  // C64 RAM is 64KB (0-65535)
  // But addresses 0-1 are CPU port registers
  // And kernel ROM is at $E000-$FFFF (can be switched out)
  // For practical purposes, allow any 16-bit address

  if (!Number.isInteger(address)) {
    throw new Error(`SYS address must be an integer, got: ${address}`);
  }

  if (address < 0 || address > 0xffff) {
    throw new Error(
      `SYS address $${address.toString(16).toUpperCase()} is out of range. ` +
        `Must be between $0000 and $FFFF.`
    );
  }

  // Warn about common problematic ranges (but still allow)
  // Users may intentionally target these for advanced techniques
}

/**
 * Validates a BASIC line number
 *
 * C64 BASIC allows line numbers 0-63999.
 *
 * @param lineNumber - The line number to validate
 * @throws Error if line number is out of valid range
 */
function validateLineNumber(lineNumber: number): void {
  if (!Number.isInteger(lineNumber)) {
    throw new Error(`BASIC line number must be an integer, got: ${lineNumber}`);
  }

  if (lineNumber < 0 || lineNumber > 63999) {
    throw new Error(
      `BASIC line number ${lineNumber} is out of range. ` + `Must be between 0 and 63999.`
    );
  }
}

/**
 * Converts a number to ASCII digit bytes
 *
 * @param value - The number to convert
 * @returns Array of ASCII digit bytes (0x30-0x39)
 *
 * @example
 * ```typescript
 * numberToAsciiDigits(2064);
 * // Returns: [0x32, 0x30, 0x36, 0x34] which is "2064"
 * ```
 */
export function numberToAsciiDigits(value: number): number[] {
  const digits: number[] = [];
  const str = value.toString();

  for (const char of str) {
    // ASCII '0' = 0x30, '1' = 0x31, etc.
    digits.push(char.charCodeAt(0));
  }

  return digits;
}

/**
 * Generate a BASIC stub for C64 autostart
 *
 * Creates a minimal BASIC program: `<line> SYS <address>`
 *
 * The BASIC stub allows the .prg to be loaded and run automatically
 * with `LOAD"*",8,1` followed by `RUN`.
 *
 * **Memory Layout (at loadAddress, default $0801):**
 * ```
 * Offset  Content           Description
 * ------  ----------------  ---------------------
 * +0,1    Next line ptr     Points past end of line (little-endian)
 * +2,3    Line number       e.g., 10 ($0A, $00)
 * +4      $9E               SYS token
 * +5-n    Address digits    ASCII digits of address
 * +n+1    $00               End of line
 * +n+2,3  $00, $00          End of BASIC program
 * ```
 *
 * @param options - Configuration for stub generation
 * @returns BasicStubResult containing bytes and metadata
 *
 * @throws Error if sysAddress or lineNumber is invalid
 *
 * @example
 * ```typescript
 * // Generate stub for machine code at $0810 (2064)
 * const result = generateBasicStub({ sysAddress: 0x0810 });
 *
 * // result.bytes contains the BASIC stub
 * // result.basicLine === "10 SYS 2064"
 * // result.codeStart === 0x080D (where to place machine code)
 * ```
 *
 * @example
 * ```typescript
 * // Custom line number and load address
 * const result = generateBasicStub({
 *   sysAddress: 0x2000,
 *   lineNumber: 100,
 *   loadAddress: 0x0801,
 * });
 * // result.basicLine === "100 SYS 8192"
 * ```
 */
export function generateBasicStub(options: BasicStubOptions): BasicStubResult {
  const sysAddress = options.sysAddress;
  const lineNumber = options.lineNumber ?? BASIC_DEFAULT_LINE_NUMBER;
  const loadAddress = options.loadAddress ?? C64_BASIC_START;

  // Validate inputs
  validateSysAddress(sysAddress);
  validateLineNumber(lineNumber);

  // Build the BASIC line bytes
  const bytes: number[] = [];

  // Placeholder for next line pointer (will calculate after)
  bytes.push(0x00, 0x00);

  // Line number (little-endian)
  bytes.push(lineNumber & 0xff);
  bytes.push((lineNumber >> 8) & 0xff);

  // SYS token
  bytes.push(BASIC_TOKEN_SYS);

  // Address as ASCII digits
  const addressDigits = numberToAsciiDigits(sysAddress);
  bytes.push(...addressDigits);

  // End of line marker
  bytes.push(BASIC_END_OF_LINE);

  // End of BASIC program (null pointer)
  bytes.push(0x00, 0x00);

  // Calculate next line pointer
  // For C64 BASIC, this points to where the "next line's link pointer" would be.
  // For a single-line program, this is the address of the end-of-program marker
  // (the two $00 bytes that act as a null link). The pointer should point to the
  // second byte of the end marker (the high byte of the null $0000 link address).
  // This ensures BASIC's line chaining works correctly when returning from SYS.
  const nextLinePointer = loadAddress + bytes.length - 1;

  // Update the next line pointer (first two bytes)
  bytes[0] = nextLinePointer & 0xff;
  bytes[1] = (nextLinePointer >> 8) & 0xff;

  // Calculate where machine code should start
  // It's immediately after the BASIC stub
  const codeStart = loadAddress + bytes.length;

  // Generate human-readable BASIC line
  const basicLine = `${lineNumber} SYS ${sysAddress}`;

  return {
    bytes: new Uint8Array(bytes),
    size: bytes.length,
    codeStart,
    basicLine,
  };
}

/**
 * Generate a standard C64 BASIC stub
 *
 * Convenience function that generates a stub for the most common
 * C64 configuration: BASIC at $0801, code at $0810.
 *
 * @returns BasicStubResult for standard C64 layout
 *
 * @example
 * ```typescript
 * const stub = generateStandardBasicStub();
 * // stub.basicLine === "10 SYS 2064"
 * // stub.codeStart === approximately $080D-$0810
 * ```
 */
export function generateStandardBasicStub(): BasicStubResult {
  return generateBasicStub({
    sysAddress: C64_CODE_START, // $0810 = 2064
    lineNumber: BASIC_DEFAULT_LINE_NUMBER, // 10
    loadAddress: C64_BASIC_START, // $0801
  });
}

/**
 * Calculate the size of a BASIC stub before generating it
 *
 * Useful for calculating load addresses and memory layout
 * without actually generating the bytes.
 *
 * @param sysAddress - The SYS address (affects digit count)
 * @returns Size of the BASIC stub in bytes
 *
 * @example
 * ```typescript
 * const size = calculateBasicStubSize(2064);
 * // size === 13 (for "10 SYS 2064")
 *
 * const size2 = calculateBasicStubSize(49152);
 * // size2 === 14 (for "10 SYS 49152" - one more digit)
 * ```
 */
export function calculateBasicStubSize(sysAddress: number): number {
  // Fixed parts:
  // - Next line pointer: 2 bytes
  // - Line number: 2 bytes
  // - SYS token: 1 byte
  // - End of line: 1 byte
  // - End of program: 2 bytes
  // Total fixed: 8 bytes

  // Variable part: address digits
  const digitCount = sysAddress.toString().length;

  return 8 + digitCount;
}

/**
 * Verify that a BASIC stub is valid
 *
 * Performs structural validation on generated stub bytes.
 * Useful for testing and debugging.
 *
 * @param bytes - The stub bytes to verify
 * @param loadAddress - The expected load address
 * @returns Object with validation results and parsed data
 *
 * @example
 * ```typescript
 * const stub = generateBasicStub({ sysAddress: 0x0810 });
 * const validation = verifyBasicStub(stub.bytes, 0x0801);
 *
 * if (validation.valid) {
 *   console.log(`Stub SYS to ${validation.sysAddress}`);
 * }
 * ```
 */
export function verifyBasicStub(
  bytes: Uint8Array,
  loadAddress: number = C64_BASIC_START
): {
  valid: boolean;
  errors: string[];
  lineNumber?: number;
  sysAddress?: number;
  nextLinePointer?: number;
} {
  const errors: string[] = [];

  // Minimum size check
  // Minimum valid stub: 2(ptr) + 2(line#) + 1(SYS) + 1(digit) + 1(eol) + 2(end) = 9 bytes
  if (bytes.length < 9) {
    errors.push(`Stub too short: ${bytes.length} bytes (minimum 9)`);
    return { valid: false, errors };
  }

  // Extract next line pointer (little-endian)
  const nextLinePointer = bytes[0] | (bytes[1] << 8);

  // Extract line number (little-endian)
  const lineNumber = bytes[2] | (bytes[3] << 8);

  // Check for SYS token
  if (bytes[4] !== BASIC_TOKEN_SYS) {
    errors.push(`Expected SYS token ($9E) at offset 4, got $${bytes[4].toString(16).toUpperCase()}`);
  }

  // Parse address digits
  let addressStr = '';
  let i = 5;
  while (i < bytes.length && bytes[i] >= 0x30 && bytes[i] <= 0x39) {
    addressStr += String.fromCharCode(bytes[i]);
    i++;
  }

  if (addressStr.length === 0) {
    errors.push('No address digits found after SYS token');
    return { valid: false, errors, lineNumber, nextLinePointer };
  }

  const sysAddress = parseInt(addressStr, 10);

  // Check end of line marker
  if (bytes[i] !== BASIC_END_OF_LINE) {
    errors.push(
      `Expected end-of-line marker ($00) at offset ${i}, got $${bytes[i].toString(16).toUpperCase()}`
    );
  }

  // Check end of program marker (two $00 bytes)
  if (i + 1 >= bytes.length || bytes[i + 1] !== 0x00) {
    errors.push('Missing first byte of end-of-program marker');
  }
  if (i + 2 >= bytes.length || bytes[i + 2] !== 0x00) {
    errors.push('Missing second byte of end-of-program marker');
  }

  // Validate next line pointer
  // The pointer should point to the second byte of the end-of-program marker
  const expectedNextLinePointer = loadAddress + bytes.length - 1;
  if (nextLinePointer !== expectedNextLinePointer) {
    errors.push(
      `Next line pointer mismatch: got $${nextLinePointer.toString(16).toUpperCase()}, ` +
        `expected $${expectedNextLinePointer.toString(16).toUpperCase()}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    lineNumber,
    sysAddress,
    nextLinePointer,
  };
}