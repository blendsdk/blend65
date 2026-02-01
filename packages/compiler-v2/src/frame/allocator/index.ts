/**
 * Frame Allocator Module
 *
 * Core components for Static Frame Allocation (SFA):
 * - FrameCalculator: Calculates frame sizes from functions
 * - ZPPool: Manages zero page address pool (future)
 * - ZPAllocator: Scores and allocates ZP slots (future)
 * - FrameAllocator: Main allocator orchestrator (future)
 *
 * @module frame/allocator
 */

// Session 2.1: Frame Calculator
export * from './frame-calculator.js';

// Session 2.2: ZP Pool (future)
// export * from './zp-pool.js';

// Session 2.3-2.4: ZP Allocator (future)
// export * from './zp-allocator.js';

// Session 2.5-2.6: Frame Allocator (future)
// export * from './frame-allocator.js';