/**
 * Custom test assertions for SFA (Static Frame Allocation) testing
 *
 * These assertions provide convenient, readable test helpers for verifying
 * frame allocation results. They wrap common expectations with descriptive
 * error messages.
 *
 * **Usage:**
 * ```typescript
 * import { expectFrameAt, expectNoErrors, expectCoalesced } from './helpers/assertions.js';
 *
 * it('should allocate frames correctly', () => {
 *   const result = allocator.allocate(program, callGraph, symbolTable);
 *   expectNoErrors(result);
 *   expectFrameAt(result, 'main', 0x0200);
 * });
 * ```
 *
 * **Note:** These interfaces define the expected shape of SFA types.
 * The real types will be created in Phase 1 (Session 1.1-1.4) and will
 * implement these interfaces.
 *
 * @module __tests__/frame/helpers/assertions
 */

import { expect } from 'vitest';

// ============================================================================
// Type Definitions
// ============================================================================
// These interfaces define the expected shape of SFA types.
// Real implementations will be created in Phase 1.

/**
 * Location where a frame slot is allocated
 */
export enum SlotLocation {
  /** Zero Page: Fast 256-byte region ($00-$FF) */
  ZeroPage = 'ZeroPage',
  /** Frame Region: Main RAM region for frames */
  FrameRegion = 'FrameRegion',
  /** Register: 6502 register (A, X, Y) - rare */
  Register = 'Register',
}

/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * Diagnostic message from frame allocation
 */
export interface FrameDiagnostic {
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Error/warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Optional function name related to diagnostic */
  functionName?: string;
}

/**
 * A slot within a frame (represents a variable or parameter)
 */
export interface FrameSlot {
  /** Variable/parameter name */
  name: string;
  /** Size in bytes */
  size: number;
  /** Offset from frame base address */
  offset: number;
  /** Where the slot is allocated (ZP, RAM, register) */
  location: SlotLocation;
  /** Absolute address (computed: baseAddress + offset for RAM, or ZP address) */
  address: number;
}

/**
 * A function's frame (all its allocated memory)
 */
export interface Frame {
  /** Function name */
  functionName: string;
  /** Base address of the frame in RAM */
  baseAddress: number;
  /** Total size of the frame in bytes */
  totalSize: number;
  /** Slots within this frame */
  slots: FrameSlot[];
  /** Coalesce group ID (functions in same group share memory) */
  coalesceGroup: number;
  /** Number of bytes allocated in Zero Page */
  zpBytesUsed: number;
}

/**
 * Statistics about frame allocation
 */
export interface FrameAllocationStats {
  /** Total functions processed */
  totalFunctions: number;
  /** Total bytes allocated across all frames */
  totalBytesAllocated: number;
  /** Bytes saved through coalescing */
  bytesSavedByCoalescing: number;
  /** Percentage saved through coalescing (0.0 - 1.0) */
  coalescingSavingsPercent: number;
  /** Total Zero Page bytes used */
  zpBytesUsed: number;
  /** Number of coalesce groups formed */
  coalesceGroupCount: number;
}

/**
 * Result of frame allocation
 */
export interface FrameAllocationResult {
  /** Map of function name to Frame */
  frameMap: Map<string, Frame>;
  /** Allocation statistics */
  stats: FrameAllocationStats;
  /** Diagnostic messages (errors, warnings) */
  diagnostics: FrameDiagnostic[];
  /** Whether allocation succeeded (no errors) */
  success: boolean;
}

// ============================================================================
// Frame Existence Assertions
// ============================================================================

/**
 * Assert that a function has a frame allocated
 *
 * @param result - Frame allocation result
 * @param funcName - Function name to check
 *
 * @example
 * ```typescript
 * expectFrameExists(result, 'main');
 * expectFrameExists(result, 'helper');
 * ```
 */
export function expectFrameExists(result: FrameAllocationResult, funcName: string): void {
  const frame = result.frameMap.get(funcName);
  expect(frame, `Frame for '${funcName}' should exist`).toBeDefined();
}

/**
 * Assert that a function has a frame at a specific address
 *
 * @param result - Frame allocation result
 * @param funcName - Function name to check
 * @param expectedAddress - Expected base address
 *
 * @example
 * ```typescript
 * expectFrameAt(result, 'main', 0x0200);
 * expectFrameAt(result, 'init', 0x0210);
 * ```
 */
export function expectFrameAt(
  result: FrameAllocationResult,
  funcName: string,
  expectedAddress: number
): void {
  const frame = result.frameMap.get(funcName);
  expect(frame, `Frame for '${funcName}' should exist`).toBeDefined();
  expect(
    frame!.baseAddress,
    `Frame for '${funcName}' should be at $${expectedAddress.toString(16).toUpperCase()}, ` +
      `but was at $${frame!.baseAddress.toString(16).toUpperCase()}`
  ).toBe(expectedAddress);
}

/**
 * Assert that a function has a frame with a specific size
 *
 * @param result - Frame allocation result
 * @param funcName - Function name to check
 * @param expectedSize - Expected total size in bytes
 *
 * @example
 * ```typescript
 * expectFrameSize(result, 'main', 4); // 4 bytes
 * ```
 */
export function expectFrameSize(
  result: FrameAllocationResult,
  funcName: string,
  expectedSize: number
): void {
  const frame = result.frameMap.get(funcName);
  expect(frame, `Frame for '${funcName}' should exist`).toBeDefined();
  expect(
    frame!.totalSize,
    `Frame for '${funcName}' should have size ${expectedSize}, but was ${frame!.totalSize}`
  ).toBe(expectedSize);
}

// ============================================================================
// Slot Location Assertions
// ============================================================================

/**
 * Assert that a slot is allocated to Zero Page
 *
 * @param frame - Frame to check
 * @param slotName - Slot (variable) name
 *
 * @example
 * ```typescript
 * const frame = result.frameMap.get('main')!;
 * expectSlotInZP(frame, 'counter');
 * ```
 */
export function expectSlotInZP(frame: Frame, slotName: string): void {
  const slot = frame.slots.find((s) => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist in frame '${frame.functionName}'`).toBeDefined();
  expect(
    slot!.location,
    `Slot '${slotName}' should be in Zero Page, but was in ${slot!.location}`
  ).toBe(SlotLocation.ZeroPage);
}

/**
 * Assert that a slot is allocated to RAM (FrameRegion)
 *
 * @param frame - Frame to check
 * @param slotName - Slot (variable) name
 *
 * @example
 * ```typescript
 * const frame = result.frameMap.get('main')!;
 * expectSlotInRAM(frame, 'largeBuffer');
 * ```
 */
export function expectSlotInRAM(frame: Frame, slotName: string): void {
  const slot = frame.slots.find((s) => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist in frame '${frame.functionName}'`).toBeDefined();
  expect(slot!.location, `Slot '${slotName}' should be in RAM, but was in ${slot!.location}`).toBe(
    SlotLocation.FrameRegion
  );
}

/**
 * Assert that a slot exists with a specific address
 *
 * @param frame - Frame to check
 * @param slotName - Slot (variable) name
 * @param expectedAddress - Expected absolute address
 *
 * @example
 * ```typescript
 * const frame = result.frameMap.get('main')!;
 * expectSlotAt(frame, 'counter', 0x02);  // ZP address
 * expectSlotAt(frame, 'buffer', 0x0200); // RAM address
 * ```
 */
export function expectSlotAt(frame: Frame, slotName: string, expectedAddress: number): void {
  const slot = frame.slots.find((s) => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist in frame '${frame.functionName}'`).toBeDefined();
  expect(
    slot!.address,
    `Slot '${slotName}' should be at $${expectedAddress.toString(16).toUpperCase()}, ` +
      `but was at $${slot!.address.toString(16).toUpperCase()}`
  ).toBe(expectedAddress);
}

/**
 * Assert that a slot exists with a specific size
 *
 * @param frame - Frame to check
 * @param slotName - Slot (variable) name
 * @param expectedSize - Expected size in bytes
 *
 * @example
 * ```typescript
 * const frame = result.frameMap.get('main')!;
 * expectSlotSize(frame, 'counter', 1);  // byte
 * expectSlotSize(frame, 'pointer', 2);  // word
 * ```
 */
export function expectSlotSize(frame: Frame, slotName: string, expectedSize: number): void {
  const slot = frame.slots.find((s) => s.name === slotName);
  expect(slot, `Slot '${slotName}' should exist in frame '${frame.functionName}'`).toBeDefined();
  expect(
    slot!.size,
    `Slot '${slotName}' should have size ${expectedSize}, but was ${slot!.size}`
  ).toBe(expectedSize);
}

// ============================================================================
// Coalescing Assertions
// ============================================================================

/**
 * Assert that two functions are coalesced (share memory)
 *
 * @param result - Frame allocation result
 * @param func1 - First function name
 * @param func2 - Second function name
 *
 * @example
 * ```typescript
 * // These non-overlapping functions should share memory
 * expectCoalesced(result, 'funcA', 'funcB');
 * ```
 */
export function expectCoalesced(
  result: FrameAllocationResult,
  func1: string,
  func2: string
): void {
  const frame1 = result.frameMap.get(func1);
  const frame2 = result.frameMap.get(func2);
  expect(frame1, `Frame for '${func1}' should exist`).toBeDefined();
  expect(frame2, `Frame for '${func2}' should exist`).toBeDefined();
  expect(
    frame1!.coalesceGroup,
    `'${func1}' (group ${frame1!.coalesceGroup}) and '${func2}' (group ${frame2!.coalesceGroup}) ` +
      `should be in the same coalesce group`
  ).toBe(frame2!.coalesceGroup);
}

/**
 * Assert that two functions are NOT coalesced (have separate memory)
 *
 * @param result - Frame allocation result
 * @param func1 - First function name
 * @param func2 - Second function name
 *
 * @example
 * ```typescript
 * // Overlapping functions must not share memory
 * expectNotCoalesced(result, 'caller', 'callee');
 * ```
 */
export function expectNotCoalesced(
  result: FrameAllocationResult,
  func1: string,
  func2: string
): void {
  const frame1 = result.frameMap.get(func1);
  const frame2 = result.frameMap.get(func2);
  expect(frame1, `Frame for '${func1}' should exist`).toBeDefined();
  expect(frame2, `Frame for '${func2}' should exist`).toBeDefined();
  expect(
    frame1!.coalesceGroup,
    `'${func1}' and '${func2}' should NOT be in the same coalesce group ` +
      `(both in group ${frame1!.coalesceGroup})`
  ).not.toBe(frame2!.coalesceGroup);
}

/**
 * Assert that functions are all in the same coalesce group
 *
 * @param result - Frame allocation result
 * @param funcNames - Array of function names
 *
 * @example
 * ```typescript
 * expectAllCoalesced(result, ['funcA', 'funcB', 'funcC']);
 * ```
 */
export function expectAllCoalesced(result: FrameAllocationResult, funcNames: string[]): void {
  if (funcNames.length < 2) {
    throw new Error('expectAllCoalesced requires at least 2 function names');
  }

  const frames = funcNames.map((name) => {
    const frame = result.frameMap.get(name);
    expect(frame, `Frame for '${name}' should exist`).toBeDefined();
    return frame!;
  });

  const firstGroup = frames[0].coalesceGroup;
  for (let i = 1; i < frames.length; i++) {
    expect(
      frames[i].coalesceGroup,
      `'${funcNames[i]}' should be in same coalesce group as '${funcNames[0]}' ` +
        `(expected group ${firstGroup}, got ${frames[i].coalesceGroup})`
    ).toBe(firstGroup);
  }
}

// ============================================================================
// Diagnostic Assertions
// ============================================================================

/**
 * Assert that allocation succeeded without errors
 *
 * @param result - Frame allocation result
 *
 * @example
 * ```typescript
 * const result = allocator.allocate(program, callGraph, symbolTable);
 * expectNoErrors(result);
 * ```
 */
export function expectNoErrors(result: FrameAllocationResult): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length > 0) {
    const errorMessages = errors.map((e) => `  - [${e.code}] ${e.message}`).join('\n');
    expect.fail(`Allocation should have no errors, but found:\n${errorMessages}`);
  }
}

/**
 * Assert that allocation succeeded (alias for expectNoErrors with success check)
 *
 * @param result - Frame allocation result
 */
export function expectSuccess(result: FrameAllocationResult): void {
  expect(result.success, 'Allocation should succeed').toBe(true);
  expectNoErrors(result);
}

/**
 * Assert that allocation produced a specific error code
 *
 * @param result - Frame allocation result
 * @param errorCode - Expected error code
 *
 * @example
 * ```typescript
 * expectError(result, 'SFA_RECURSION_DETECTED');
 * ```
 */
export function expectError(result: FrameAllocationResult, errorCode: string): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const hasError = errors.some((e) => e.code === errorCode);
  if (!hasError) {
    const actualCodes = errors.map((e) => e.code).join(', ') || 'none';
    expect.fail(
      `Expected error with code '${errorCode}', but found: ${actualCodes}`
    );
  }
}

/**
 * Assert that allocation produced an error for a specific function
 *
 * @param result - Frame allocation result
 * @param errorCode - Expected error code
 * @param functionName - Function the error relates to
 */
export function expectErrorForFunction(
  result: FrameAllocationResult,
  errorCode: string,
  functionName: string
): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  const hasError = errors.some((e) => e.code === errorCode && e.functionName === functionName);
  if (!hasError) {
    const relevantErrors = errors
      .filter((e) => e.functionName === functionName)
      .map((e) => e.code)
      .join(', ') || 'none';
    expect.fail(
      `Expected error '${errorCode}' for function '${functionName}', ` +
        `but found errors: ${relevantErrors}`
    );
  }
}

/**
 * Assert that allocation produced a warning
 *
 * @param result - Frame allocation result
 * @param warningCode - Expected warning code
 */
export function expectWarning(result: FrameAllocationResult, warningCode: string): void {
  const warnings = result.diagnostics.filter((d) => d.severity === 'warning');
  const hasWarning = warnings.some((w) => w.code === warningCode);
  if (!hasWarning) {
    const actualCodes = warnings.map((w) => w.code).join(', ') || 'none';
    expect.fail(
      `Expected warning with code '${warningCode}', but found: ${actualCodes}`
    );
  }
}

/**
 * Assert exact number of errors
 *
 * @param result - Frame allocation result
 * @param count - Expected error count
 */
export function expectErrorCount(result: FrameAllocationResult, count: number): void {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors.length, `Expected ${count} errors, but found ${errors.length}`).toBe(count);
}

// ============================================================================
// Statistics Assertions
// ============================================================================

/**
 * Assert memory savings from coalescing
 *
 * @param result - Frame allocation result
 * @param minSavings - Minimum savings percentage (0.0 - 1.0)
 *
 * @example
 * ```typescript
 * // Expect at least 30% savings
 * expectCoalescingSavings(result, 0.3);
 * ```
 */
export function expectCoalescingSavings(
  result: FrameAllocationResult,
  minSavings: number
): void {
  expect(
    result.stats.coalescingSavingsPercent,
    `Coalescing should save at least ${(minSavings * 100).toFixed(1)}%, ` +
      `but only saved ${(result.stats.coalescingSavingsPercent * 100).toFixed(1)}%`
  ).toBeGreaterThanOrEqual(minSavings);
}

/**
 * Assert Zero Page usage within a range
 *
 * @param result - Frame allocation result
 * @param minBytes - Minimum ZP bytes (inclusive)
 * @param maxBytes - Maximum ZP bytes (inclusive)
 *
 * @example
 * ```typescript
 * expectZPUsage(result, 2, 10); // Between 2 and 10 bytes in ZP
 * ```
 */
export function expectZPUsage(
  result: FrameAllocationResult,
  minBytes: number,
  maxBytes: number
): void {
  expect(
    result.stats.zpBytesUsed,
    `ZP usage (${result.stats.zpBytesUsed}) should be at least ${minBytes}`
  ).toBeGreaterThanOrEqual(minBytes);
  expect(
    result.stats.zpBytesUsed,
    `ZP usage (${result.stats.zpBytesUsed}) should be at most ${maxBytes}`
  ).toBeLessThanOrEqual(maxBytes);
}

/**
 * Assert exact Zero Page bytes used
 *
 * @param result - Frame allocation result
 * @param expectedBytes - Expected ZP bytes
 */
export function expectExactZPUsage(result: FrameAllocationResult, expectedBytes: number): void {
  expect(
    result.stats.zpBytesUsed,
    `Expected exactly ${expectedBytes} ZP bytes, but got ${result.stats.zpBytesUsed}`
  ).toBe(expectedBytes);
}

/**
 * Assert total bytes allocated
 *
 * @param result - Frame allocation result
 * @param expectedBytes - Expected total bytes
 */
export function expectTotalAllocation(result: FrameAllocationResult, expectedBytes: number): void {
  expect(
    result.stats.totalBytesAllocated,
    `Expected ${expectedBytes} total bytes allocated, ` +
      `but got ${result.stats.totalBytesAllocated}`
  ).toBe(expectedBytes);
}

/**
 * Assert number of coalesce groups
 *
 * @param result - Frame allocation result
 * @param expectedCount - Expected number of groups
 */
export function expectCoalesceGroupCount(
  result: FrameAllocationResult,
  expectedCount: number
): void {
  expect(
    result.stats.coalesceGroupCount,
    `Expected ${expectedCount} coalesce groups, but got ${result.stats.coalesceGroupCount}`
  ).toBe(expectedCount);
}

// ============================================================================
// Test Data Builders
// ============================================================================

/**
 * Create a minimal FrameAllocationResult for testing assertions
 *
 * This is a test helper, not a mock. It creates valid data structures
 * that match the interface shape for testing assertion functions.
 *
 * @param options - Configuration options
 * @returns A valid FrameAllocationResult
 */
export function createTestAllocationResult(
  options: Partial<{
    frames: Map<string, Frame>;
    stats: Partial<FrameAllocationStats>;
    diagnostics: FrameDiagnostic[];
    success: boolean;
  }> = {}
): FrameAllocationResult {
  const defaultStats: FrameAllocationStats = {
    totalFunctions: options.frames?.size ?? 0,
    totalBytesAllocated: 0,
    bytesSavedByCoalescing: 0,
    coalescingSavingsPercent: 0,
    zpBytesUsed: 0,
    coalesceGroupCount: 1,
  };

  return {
    frameMap: options.frames ?? new Map(),
    stats: { ...defaultStats, ...options.stats },
    diagnostics: options.diagnostics ?? [],
    success: options.success ?? (options.diagnostics?.some((d) => d.severity === 'error') !== true),
  };
}

/**
 * Create a minimal Frame for testing
 *
 * @param funcName - Function name
 * @param options - Configuration options
 * @returns A valid Frame
 */
export function createTestFrame(
  funcName: string,
  options: Partial<{
    baseAddress: number;
    totalSize: number;
    slots: FrameSlot[];
    coalesceGroup: number;
    zpBytesUsed: number;
  }> = {}
): Frame {
  return {
    functionName: funcName,
    baseAddress: options.baseAddress ?? 0x0200,
    totalSize: options.totalSize ?? 0,
    slots: options.slots ?? [],
    coalesceGroup: options.coalesceGroup ?? 0,
    zpBytesUsed: options.zpBytesUsed ?? 0,
  };
}

/**
 * Create a minimal FrameSlot for testing
 *
 * @param name - Variable name
 * @param options - Configuration options
 * @returns A valid FrameSlot
 */
export function createTestSlot(
  name: string,
  options: Partial<{
    size: number;
    offset: number;
    location: SlotLocation;
    address: number;
  }> = {}
): FrameSlot {
  const location = options.location ?? SlotLocation.FrameRegion;
  const baseAddress = location === SlotLocation.ZeroPage ? 0x00 : 0x0200;
  const offset = options.offset ?? 0;

  return {
    name,
    size: options.size ?? 1,
    offset,
    location,
    address: options.address ?? baseAddress + offset,
  };
}

/**
 * Create a diagnostic for testing
 *
 * @param severity - Diagnostic severity
 * @param code - Error/warning code
 * @param message - Human-readable message
 * @param functionName - Optional related function name
 */
export function createTestDiagnostic(
  severity: DiagnosticSeverity,
  code: string,
  message: string,
  functionName?: string
): FrameDiagnostic {
  return { severity, code, message, functionName };
}