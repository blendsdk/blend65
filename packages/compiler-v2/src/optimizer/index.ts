/**
 * ASM Optimizer module for Blend65 v2
 *
 * Implements peephole optimization passes on the ASM-IL output.
 * Migrated from v1 with adjustments for SFA architecture.
 *
 * **Key Components:**
 * - Optimizer Types: Pass interface, optimization context
 * - Pass Runner: Executes optimization passes in order
 * - Peephole Passes: Pattern-based local optimizations
 *
 * **Optimization Passes:**
 * - Redundant load elimination (LDA followed by LDA same address)
 * - Dead store elimination (STA to never-read address)
 * - Branch chain optimization (JMP to JMP)
 * - Transfer elimination (TAX followed by TXA)
 * - INC/DEC optimization (ADC #1 → INC when possible)
 *
 * **Design:**
 * - Two-slot architecture: IL slot (empty for O2), ASM slot (active for O1)
 * - Simple pattern matching
 * - No complex data flow analysis
 *
 * @module optimizer
 */

// Will be populated in Phase 9: ASM Optimizer
// export * from './types.js';
// export * from './pass.js';
// export * from './optimizer.js';
// export * from './passes/index.js';