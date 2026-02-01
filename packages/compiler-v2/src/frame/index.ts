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

// Enums - Phase 1 Session 1.1
export * from './enums.js';

// Types - Phase 1 Session 1.2
export * from './types.js';

// Platform Config - Phase 1 Session 1.3
export * from './platform.js';

// Call Graph - Phase 2 (future)
// export * from './call-graph.js';

// Allocator - Phase 2-3 (future)
// export * from './allocator.js';