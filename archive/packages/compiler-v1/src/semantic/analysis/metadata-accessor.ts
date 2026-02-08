/**
 * Optimization Metadata Accessor (Phase 8)
 *
 * Provides type-safe, convenient access to optimization metadata
 * stored in AST node metadata maps.
 *
 * Pattern: Fluent interface for easy metadata access.
 * Usage: new OptimizationMetadataAccessor(node).getConstantValue()
 */

import type { ASTNode } from '../../ast/base.js';
import {
  OptimizationMetadataKey,
  DeadCodeKind,
  PurityLevel,
  EscapeReason,
  MemoryRegion,
  Register,
  AddressingMode,
  type InductionVariable,
} from './optimization-metadata-keys.js';
import type { Symbol } from '../symbol.js';

/**
 * Type-safe accessor for optimization metadata
 *
 * Provides convenient, type-safe access to Phase 8 metadata
 * stored in AST node metadata maps.
 *
 * @example
 * ```typescript
 * const accessor = new OptimizationMetadataAccessor(node);
 * const value = accessor.getConstantValue();
 * const isUsed = accessor.isUsed();
 * const zpPriority = accessor.getZeroPagePriority();
 * ```
 */
export class OptimizationMetadataAccessor {
  constructor(protected readonly node: ASTNode) {}

  // ==========================================
  // TIER 1: BASIC ANALYSIS
  // ==========================================

  // Definite Assignment
  /**
   * Is variable always initialized before use?
   */
  public isAlwaysInitialized(): boolean {
    return (
      this.node.metadata?.get(OptimizationMetadataKey.DefiniteAssignmentAlwaysInitialized) === true
    );
  }

  /**
   * Get known initialization value
   */
  public getInitValue(): number | string | boolean | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.DefiniteAssignmentInitValue) as
      | number
      | string
      | boolean
      | undefined;
  }

  /**
   * Was variable used before initialization?
   */
  public hasUninitializedUse(): boolean {
    return (
      this.node.metadata?.get(OptimizationMetadataKey.DefiniteAssignmentUninitializedUse) === true
    );
  }

  // Variable Usage
  /**
   * Get number of times variable is read
   */
  public getReadCount(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageReadCount) as number) ?? 0;
  }

  /**
   * Get number of times variable is written
   */
  public getWriteCount(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageWriteCount) as number) ?? 0;
  }

  /**
   * Is variable used at all?
   */
  public isUsed(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.UsageIsUsed) === true;
  }

  /**
   * Is variable only written, never read?
   */
  public isWriteOnly(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.UsageIsWriteOnly) === true;
  }

  /**
   * Is variable only read, never written?
   */
  public isReadOnly(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.UsageIsReadOnly) === true;
  }

  /**
   * Get number of hot path accesses
   */
  public getHotPathAccesses(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageHotPathAccesses) as number) ?? 0;
  }

  /**
   * Get maximum loop nesting depth
   */
  public getMaxLoopDepth(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.UsageMaxLoopDepth) as number) ?? 0;
  }

  // Dead Code
  /**
   * Is this code unreachable?
   */
  public isUnreachable(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeUnreachable) === true;
  }

  /**
   * Get dead code kind
   */
  public getDeadCodeKind(): DeadCodeKind | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeKind) as
      | DeadCodeKind
      | undefined;
  }

  /**
   * Get dead code reason
   */
  public getDeadCodeReason(): string | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeReason) as string | undefined;
  }

  /**
   * Can dead code be safely removed?
   */
  public isRemovable(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.DeadCodeRemovable) === true;
  }

  // Call Graph (Basic)
  /**
   * Is function never called?
   */
  public isUnusedFunction(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.CallGraphUnused) === true;
  }

  /**
   * Get number of times function is called
   */
  public getCallCount(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.CallGraphCallCount) as number) ?? 0;
  }

  // ==========================================
  // TIER 2: DATA FLOW ANALYSIS
  // ==========================================

  // Reaching Definitions
  /**
   * Get set of definitions that reach this point
   */
  public getReachingDefinitions(): Set<string> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.ReachingDefinitionsSet) as
      | Set<string>
      | undefined;
  }

  /**
   * Get def-use chain
   */
  public getDefUseChain(): Set<ASTNode> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.DefUseChain) as Set<ASTNode> | undefined;
  }

  /**
   * Get use-def chain
   */
  public getUseDefChain(): Set<ASTNode> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.UseDefChain) as Set<ASTNode> | undefined;
  }

  // Liveness
  /**
   * Get variables live at entry
   */
  public getLiveIn(): Set<string> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LivenessLiveIn) as
      | Set<string>
      | undefined;
  }

  /**
   * Get variables live at exit
   */
  public getLiveOut(): Set<string> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LivenessLiveOut) as
      | Set<string>
      | undefined;
  }

  /**
   * Get live range interval
   */
  public getLiveInterval(): [number, number] | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LivenessInterval) as
      | [number, number]
      | undefined;
  }

  /**
   * Get live range length
   */
  public getLiveIntervalLength(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LivenessIntervalLength) as
      | number
      | undefined;
  }

  // Constant Propagation
  /**
   * Get known constant value
   */
  public getConstantValue(): number | string | boolean | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantValue) as
      | number
      | string
      | boolean
      | undefined;
  }

  /**
   * Is expression constant foldable?
   */
  public isConstantFoldable(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantFoldable) === true;
  }

  /**
   * Get constant fold result
   */
  public getConstantFoldResult(): number | string | boolean | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantFoldResult) as
      | number
      | string
      | boolean
      | undefined;
  }

  /**
   * Is variable effectively const?
   */
  public isEffectivelyConst(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantEffectivelyConst) === true;
  }

  /**
   * Is branch condition constant?
   */
  public getConstantBranchCondition(): boolean | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.ConstantBranchCondition) as
      | boolean
      | undefined;
  }

  // ==========================================
  // TIER 3: ADVANCED ANALYSIS
  // ==========================================

  // Alias Analysis
  /**
   * Get what this pointer/reference points to
   */
  public getPointsTo(): Set<Symbol> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.AliasPointsTo) as
      | Set<Symbol>
      | undefined;
  }

  /**
   * Get non-alias set
   */
  public getNonAliasSet(): Set<Symbol> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.AliasNonAliasSet) as
      | Set<Symbol>
      | undefined;
  }

  /**
   * Get memory region
   */
  public getMemoryRegion(): MemoryRegion | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.AliasMemoryRegion) as
      | MemoryRegion
      | undefined;
  }

  // Purity Analysis
  /**
   * Get function purity level
   */
  public getPurityLevel(): PurityLevel | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityLevel) as PurityLevel | undefined;
  }

  /**
   * Get memory locations written by function
   */
  public getWrittenLocations(): Set<string> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityWrittenLocations) as
      | Set<string>
      | undefined;
  }

  /**
   * Get functions called by this function
   */
  public getCalledFunctions(): Set<string> | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityCalledFunctions) as
      | Set<string>
      | undefined;
  }

  /**
   * Does function have side effects?
   */
  public hasSideEffects(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityHasSideEffects) === true;
  }

  /**
   * Is function pure?
   */
  public isPure(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.PurityIsPure) === true;
  }

  // Escape Analysis
  /**
   * Does variable escape?
   */
  public escapes(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.EscapeEscapes) === true;
  }

  /**
   * Can be stack allocated?
   */
  public isStackAllocatable(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.EscapeStackAllocatable) === true;
  }

  /**
   * Get escape reason
   */
  public getEscapeReason(): EscapeReason | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.EscapeReason) as
      | EscapeReason
      | undefined;
  }

  // Loop Analysis
  /**
   * Is expression loop invariant?
   */
  public isLoopInvariant(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.LoopInvariant) === true;
  }

  /**
   * Can be hoisted out of loop?
   */
  public isHoistCandidate(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.LoopHoistCandidate) === true;
  }

  /**
   * Get loop iteration count
   */
  public getLoopIterationCount(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LoopIterationCount) as
      | number
      | undefined;
  }

  /**
   * Get loop nesting depth
   */
  public getLoopNestingDepth(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LoopNestingDepth) as number | undefined;
  }

  /**
   * Get induction variable information
   */
  public getInductionVariable(): InductionVariable | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.LoopInductionVariable) as
      | InductionVariable
      | undefined;
  }

  // Call Graph (Advanced)
  /**
   * Can function be inlined?
   */
  public isInlineCandidate(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.CallGraphInlineCandidate) === true;
  }

  /**
   * Get inline cost estimate
   */
  public getInlineCost(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.CallGraphInlineCost) as
      | number
      | undefined;
  }

  /**
   * Get recursion depth
   */
  public getRecursionDepth(): number {
    return (
      (this.node.metadata?.get(OptimizationMetadataKey.CallGraphRecursionDepth) as number) ?? 0
    );
  }

  /**
   * Is tail-recursive call?
   */
  public isTailRecursive(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.CallGraphTailRecursive) === true;
  }

  // ==========================================
  // 6502-SPECIFIC HINTS
  // ==========================================

  /**
   * Get zero-page allocation priority
   */
  public getZeroPagePriority(): number {
    return (this.node.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority) as number) ?? 0;
  }

  /**
   * Get preferred 6502 register
   */
  public getRegisterPreference(): Register {
    return (
      (this.node.metadata?.get(OptimizationMetadataKey.M6502RegisterPreference) as Register) ??
      Register.None
    );
  }

  /**
   * Get addressing mode hint
   */
  public getAddressingMode(): AddressingMode | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502AddressingMode) as
      | AddressingMode
      | undefined;
  }

  /**
   * Can use 16-bit operations?
   */
  public canUse16Bit(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502Use16Bit) === true;
  }

  /**
   * Get cycle count estimate
   */
  public getCycleEstimate(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502CycleEstimate) as
      | number
      | undefined;
  }

  /**
   * Get VIC-II bank constraint
   */
  public getVICBank(): number | undefined {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502VICBank) as number | undefined;
  }

  /**
   * Has sprite DMA interference?
   */
  public hasSpriteDMA(): boolean {
    return this.node.metadata?.get(OptimizationMetadataKey.M6502SpriteDMA) === true;
  }

  // ==========================================
  // SETTERS (for analysis passes)
  // ==========================================

  /**
   * Set metadata value (type-safe)
   *
   * This is the primary way analysis passes should write metadata.
   * Ensures metadata map exists before setting.
   *
   * @param key - Metadata key from OptimizationMetadataKey enum
   * @param value - Value to store
   */
  public set(key: OptimizationMetadataKey, value: unknown): void {
    if (!this.node.metadata) {
      this.node.metadata = new Map();
    }
    this.node.metadata.set(key, value);
  }

  /**
   * Check if metadata key exists
   */
  public has(key: OptimizationMetadataKey): boolean {
    return this.node.metadata?.has(key) ?? false;
  }

  /**
   * Delete metadata key
   */
  public delete(key: OptimizationMetadataKey): boolean {
    return this.node.metadata?.delete(key) ?? false;
  }

  /**
   * Clear all metadata
   */
  public clear(): void {
    this.node.metadata?.clear();
  }
}
