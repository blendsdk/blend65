/**
 * Frame Allocator module for Blend65 v2 (NEW)
 *
 * Responsible for Static Frame Allocation (SFA) - the core architectural
 * difference from v1. Assigns fixed memory addresses to function frames
 * at compile time.
 *
 * **Key Components:**
 * - Frame Types: Frame, FrameSlot, FrameMap data structures
 * - Call Graph Builder: Builds function call relationships
 * - Recursion Detection: Detects direct and indirect recursion (error)
 * - Frame Allocator: Assigns base addresses to function frames
 *
 * **Frame Structure:**
 * Each function gets a Frame containing:
 * - Parameters (passed via frame slots, not stack)
 * - Local variables (fixed addresses)
 * - Return value slot
 *
 * **Memory Region (C64):**
 * Default frame region: $0200-$03FF (512 bytes)
 * Configurable via compiler options.
 *
 * @module frame
 */

// Will be populated in Phase 6: Frame Allocator
// export * from './types.js';
// export * from './call-graph.js';
// export * from './recursion.js';
// export * from './allocator.js';