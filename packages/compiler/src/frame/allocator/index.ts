/**
 * Frame Allocator Module
 *
 * Core components for Static Frame Allocation (SFA):
 * - FrameCalculator: Calculates frame sizes from functions
 * - ZPPool: Manages zero page address pool
 * - ZPAllocator: Scores and allocates ZP slots
 * - FrameAllocator: Main allocator orchestrator
 * - FrameCoalescer: Coalesces non-overlapping function frames
 *
 * @module frame/allocator
 */

// Session 2.1: Frame Calculator
export * from './frame-calculator.js';

// Session 2.2: ZP Pool
export * from './zp-pool.js';

// Session 2.3-2.4: ZP Allocator
export * from './zp-allocator.js';

// Session 2.5-2.6: Frame Allocator
export * from './frame-allocator.js';

// Session 3.1-3.4: Frame Coalescer
export * from './coalescer.js';

// Global Variable Allocator
export * from './global-allocator.js';
