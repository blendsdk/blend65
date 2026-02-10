/**
 * Frame Allocator Enumerations
 *
 * Core enum types used by the Static Frame Allocation (SFA) system.
 * These enums define the vocabulary for frame slot storage, kinds,
 * zero page directives, thread contexts, and diagnostic severities.
 *
 * @module frame/enums
 */

/**
 * Storage location for a frame slot.
 *
 * Determines where the variable's memory is allocated:
 * - ZeroPage: Fast access, limited space ($02-$8F on C64)
 * - FrameRegion: Normal frame memory ($0200-$03FF on C64)
 * - Register: Passed via CPU register (A, X, Y)
 *
 * @example
 * ```typescript
 * const slot: FrameSlot = {
 *   location: SlotLocation.ZeroPage, // Fast 2-byte instructions
 *   // ...
 * };
 * ```
 */
export enum SlotLocation {
  /** Slot is in zero page ($00-$FF) - fastest access */
  ZeroPage = 'zp',

  /** Slot is in frame region (RAM) - normal access */
  FrameRegion = 'frame',

  /** Slot is passed via register (A, Y, X) - optimized parameter passing */
  Register = 'register',
}

/**
 * Kind of frame slot.
 *
 * Identifies the role of a slot within a function's frame:
 * - Parameter: Passed into the function
 * - Local: Declared within the function
 * - Return: Storage for return value
 * - Temporary: Compiler-generated for expression evaluation
 *
 * @example
 * ```typescript
 * // A function's frame might contain:
 * // - 2 Parameter slots
 * // - 1 Return slot
 * // - 3 Local slots
 * // - 1 Temporary slot (for complex expression)
 * ```
 */
export enum SlotKind {
  /** Function parameter - allocated first in frame */
  Parameter = 'parameter',

  /** Local variable - declared within function body */
  Local = 'local',

  /** Return value storage - only for non-void functions */
  Return = 'return',

  /** Compiler-generated temporary - for expression evaluation */
  Temporary = 'temporary',
}

/**
 * Zero page directive from source code annotations.
 *
 * Simplified mapping (no "required" modifier, no "prefer" ambiguity):
 * - `@zp` → ZpDirective.Zp (MUST be ZP, error if not)
 * - `@ram` → ZpDirective.Ram (MUST be RAM, never ZP)
 * - (no annotation) → ZpDirective.None (compiler decides, deterministic)
 *
 * **Why no "prefer" option?**
 * - Creates unpredictable behavior - developer won't know if variable is in ZP or RAM
 * - If you need ZP, use @zp and get a clear error if impossible
 * - If you don't care, let the compiler decide (it's deterministic based on hotness scoring)
 *
 * **Source Code Examples:**
 * ```js
 * // No directive - compiler decides (deterministic based on hotness scoring)
 * let counter: byte = 0;
 *
 * // @zp - MUST be in ZP (error if ZP is full)
 * @zp let ptr: word = $1000;
 *
 * // @ram - MUST be in RAM (never in ZP)
 * @ram let buffer: byte[256];
 * ```
 *
 * **Behavior Summary:**
 * | Directive | Behavior           | If ZP Full?               |
 * |-----------|--------------------|-----------------------------|
 * | `@zp`     | MUST be in ZP      | **Compile error**           |
 * | `@ram`    | MUST be in RAM     | N/A (never uses ZP)         |
 * | `@data`   | Data segment const | N/A (read-only data)        |
 * | (none)    | Compiler decides   | Silent fallback to RAM      |
 */
export enum ZpDirective {
  /** No directive specified - compiler decides based on scoring (deterministic) */
  None = 'none',

  /** @zp - MUST be in zero page, compile error if impossible */
  Zp = 'zp',

  /** @ram - MUST be in RAM, never allocate to ZP */
  Ram = 'ram',

  /** @data - Placed in data segment as read-only initialized constant */
  Data = 'data',
}

/**
 * Thread context for interrupt safety analysis.
 *
 * Used to determine which functions can safely share memory (coalescing):
 * - MainOnly: Only called from main program flow
 * - IsrOnly: Only called from interrupt handlers (NMI/IRQ)
 * - Both: Called from both contexts (cannot coalesce with either)
 *
 * **Why This Matters:**
 * Functions with different contexts CANNOT share frame memory
 * because an ISR could interrupt main and overwrite shared data.
 *
 * @example
 * ```typescript
 * // mainLoop() is ThreadContext.MainOnly
 * // handleIrq() is ThreadContext.IsrOnly
 * // utilityFunc() called by both is ThreadContext.Both
 *
 * // mainLoop and handleIrq CAN coalesce (never run simultaneously)
 * // utilityFunc CANNOT coalesce with either (could be interrupted)
 * ```
 */
export enum ThreadContext {
  /** Only called from main program flow - can coalesce with other main-only */
  MainOnly = 'main',

  /** Only called from interrupt handlers - can coalesce with other isr-only */
  IsrOnly = 'isr',

  /** Called from both main and ISR - cannot coalesce (safest, no sharing) */
  Both = 'both',
}

/**
 * Severity level for allocation diagnostics.
 *
 * Used by the frame allocator to report issues during allocation:
 * - Error: Critical issue, compilation stops
 * - Warning: Issue detected, compilation continues
 * - Info: Informational message for verbose output
 *
 * @example
 * ```typescript
 * const diagnostic: FrameDiagnostic = {
 *   severity: DiagnosticSeverity.Error,
 *   message: 'Zero page overflow: @zp variable "ptr" cannot fit',
 *   // ...
 * };
 * ```
 */
export enum DiagnosticSeverity {
  /** Critical error - compilation stops */
  Error = 'error',

  /** Warning - compilation continues */
  Warning = 'warning',

  /** Informational - for verbose output */
  Info = 'info',
}