/**
 * Optimization Metadata Keys (Phase 8)
 *
 * Defines all metadata keys used by advanced analysis passes.
 * Pattern: Flat enum (like TokenType, SymbolKind) for IL optimizer ease.
 *
 * These keys are stored in AST node metadata maps and consumed by:
 * - IL generator (code generation optimization)
 * - Diagnostic reporting (warnings about unused code, etc.)
 * - Development tools (IDE hints, performance insights)
 */

// ============================================
// TIER 1: BASIC ANALYSIS
// ============================================

/**
 * Main optimization metadata keys
 *
 * All Phase 8 analysis passes store their results using these keys.
 * Pattern: Flat enum for easy IL optimizer consumption.
 */
export enum OptimizationMetadataKey {
  // ==========================================
  // Definite Assignment Analysis (Task 8.1)
  // ==========================================

  /** Variable is always initialized before use (boolean) */
  DefiniteAssignmentAlwaysInitialized = 'DefiniteAssignmentAlwaysInitialized',

  /** Known initialization value for variable (number | string | boolean) */
  DefiniteAssignmentInitValue = 'DefiniteAssignmentInitValue',

  /** Variable used before initialization (boolean) - triggers error */
  DefiniteAssignmentUninitializedUse = 'DefiniteAssignmentUninitializedUse',

  // ==========================================
  // Variable Usage Analysis (Task 8.2)
  // ==========================================

  /** Number of times variable is read (number) */
  UsageReadCount = 'UsageReadCount',

  /** Number of times variable is written (number) */
  UsageWriteCount = 'UsageWriteCount',

  /** Is this variable used at all? (boolean) */
  UsageIsUsed = 'UsageIsUsed',

  /** Variable is only written, never read (boolean) */
  UsageIsWriteOnly = 'UsageIsWriteOnly',

  /** Variable is only read, never written (boolean) */
  UsageIsReadOnly = 'UsageIsReadOnly',

  /** Number of hot path accesses (in critical loops) (number) */
  UsageHotPathAccesses = 'UsageHotPathAccesses',

  /** Maximum loop nesting depth where variable is accessed (number) */
  UsageMaxLoopDepth = 'UsageMaxLoopDepth',

  /** Variable has its address taken (@ operator) (boolean) */
  UsageAddressOfTaken = 'UsageAddressOfTaken',

  // ==========================================
  // Dead Code Detection (Task 8.4)
  // ==========================================

  /** Is this code unreachable? (boolean) */
  DeadCodeUnreachable = 'DeadCodeUnreachable',

  /** Kind of dead code (DeadCodeKind enum) */
  DeadCodeKind = 'DeadCodeKind',

  /** Reason why code is dead (string) */
  DeadCodeReason = 'DeadCodeReason',

  /** Can this dead code be safely removed? (boolean) */
  DeadCodeRemovable = 'DeadCodeRemovable',

  // ==========================================
  // Call Graph Analysis (Task 8.12, used by 8.3)
  // ==========================================

  /** Function is never called (boolean) */
  CallGraphUnused = 'CallGraphUnused',

  /** Number of times function is called (number) */
  CallGraphCallCount = 'CallGraphCallCount',

  // ==========================================
  // TIER 2: DATA FLOW ANALYSIS
  // ==========================================

  // ==========================================
  // Reaching Definitions (Task 8.5)
  // ==========================================

  /** Set of definitions that reach this point (Set<string>) */
  ReachingDefinitionsSet = 'ReachingDefinitionsSet',

  /** Def-use chain: which uses this definition reaches (Set<ASTNode>) */
  DefUseChain = 'DefUseChain',

  /** Use-def chain: which definitions reach this use (Set<ASTNode>) */
  UseDefChain = 'UseDefChain',

  // ==========================================
  // Liveness Analysis (Task 8.6)
  // ==========================================

  /** Variables live at entry to this block (Set<string>) */
  LivenessLiveIn = 'LivenessLiveIn',

  /** Variables live at exit from this block (Set<string>) */
  LivenessLiveOut = 'LivenessLiveOut',

  /** Live range interval [start, end] (tuple) */
  LivenessInterval = 'LivenessInterval',

  /** Length of live range in instructions (number) */
  LivenessIntervalLength = 'LivenessIntervalLength',

  // ==========================================
  // Constant Propagation (Task 8.7)
  // ==========================================

  /** Known constant value (number | string | boolean) */
  ConstantValue = 'ConstantValue',

  /** Expression is constant and can be folded (boolean) */
  ConstantFoldable = 'ConstantFoldable',

  /** Result of constant folding (number | string | boolean) */
  ConstantFoldResult = 'ConstantFoldResult',

  /** Variable is effectively const (never changes) (boolean) */
  ConstantEffectivelyConst = 'ConstantEffectivelyConst',

  /** Branch condition is always true/false (boolean) */
  ConstantBranchCondition = 'ConstantBranchCondition',

  // ==========================================
  // TIER 3: ADVANCED ANALYSIS
  // ==========================================

  // ==========================================
  // Alias Analysis (Task 8.8)
  // ==========================================

  /** What this pointer/reference points to (Set<Symbol>) */
  AliasPointsTo = 'AliasPointsTo',

  /** Variables that definitely don't alias (Set<Symbol>) */
  AliasNonAliasSet = 'AliasNonAliasSet',

  /** Memory region this access touches (MemoryRegion enum) */
  AliasMemoryRegion = 'AliasMemoryRegion',

  /** Writes to code address range (self-modifying code) (boolean) */
  SelfModifyingCode = 'SelfModifyingCode',

  // ==========================================
  // Purity Analysis (Task 8.9)
  // ==========================================

  /** Function purity level (PurityLevel enum) */
  PurityLevel = 'PurityLevel',

  /** Memory locations written by function (Set<string>) */
  PurityWrittenLocations = 'PurityWrittenLocations',

  /** Functions called by this function (Set<string>) */
  PurityCalledFunctions = 'PurityCalledFunctions',

  /** Function has side effects (boolean) */
  PurityHasSideEffects = 'PurityHasSideEffects',

  /** Function result depends only on arguments (boolean) */
  PurityIsPure = 'PurityIsPure',

  // ==========================================
  // Escape Analysis (Task 8.10)
  // ==========================================

  /** Does this variable escape its scope? (boolean) */
  EscapeEscapes = 'EscapeEscapes',

  /** Can be allocated on stack (boolean) */
  EscapeStackAllocatable = 'EscapeStackAllocatable',

  /** Escape reason (EscapeReason enum) */
  EscapeReason = 'EscapeReason',

  /** Cumulative stack depth in bytes (number) */
  StackDepth = 'StackDepth',

  /** Stack usage exceeds 6502 limit (boolean) */
  StackOverflowRisk = 'StackOverflowRisk',

  /** Variable never escapes local scope (boolean) */
  EscapeLocalOnly = 'EscapeLocalOnly',

  // ==========================================
  // Loop Analysis (Task 8.11)
  // ==========================================

  /** Expression is loop invariant (boolean) */
  LoopInvariant = 'LoopInvariant',

  /** Can be hoisted out of loop (boolean) */
  LoopHoistCandidate = 'LoopHoistCandidate',

  /** Loop iteration count (number if known) */
  LoopIterationCount = 'LoopIterationCount',

  /** Loop nesting depth (number) */
  LoopNestingDepth = 'LoopNestingDepth',

  /** Induction variable information (InductionVariable) */
  LoopInductionVariable = 'LoopInductionVariable',

  // ==========================================
  // Call Graph (Task 8.12)
  // ==========================================

  /** Function can be inlined (boolean) */
  CallGraphInlineCandidate = 'CallGraphInlineCandidate',

  /** Estimated inline cost (number of instructions) */
  CallGraphInlineCost = 'CallGraphInlineCost',

  /** Recursion depth (number, 0 if not recursive) */
  CallGraphRecursionDepth = 'CallGraphRecursionDepth',

  /** Is tail-recursive call (boolean) */
  CallGraphTailRecursive = 'CallGraphTailRecursive',

  // ==========================================
  // Global Value Numbering (Task 8.14.1)
  // ==========================================

  /** Value number assigned to expression (number) */
  GVNNumber = 'GVNNumber',

  /** This computation is redundant (boolean) */
  GVNRedundant = 'GVNRedundant',

  /** Variable that can replace this expression (string) */
  GVNReplacement = 'GVNReplacement',

  // ==========================================
  // Common Subexpression Elimination (Task 8.14.3)
  // ==========================================

  /** Available expressions at this point (Set<string>) */
  CSEAvailable = 'CSEAvailable',

  /** This subexpression can be eliminated (boolean) */
  CSECandidate = 'CSECandidate',

  // ==========================================
  // 6502-Specific Hints (Task 8.13)
  // ==========================================

  /** Zero-page allocation priority (0-255, higher = more important) */
  M6502ZeroPagePriority = 'M6502ZeroPagePriority',

  /** Preferred 6502 register (Register enum: A, X, Y) */
  M6502RegisterPreference = 'M6502RegisterPreference',

  /** Addressing mode hint (AddressingMode enum) */
  M6502AddressingMode = 'M6502AddressingMode',

  /** Can use 16-bit operations (word operations) (boolean) */
  M6502Use16Bit = 'M6502Use16Bit',

  /** Cycle count estimate (number) */
  M6502CycleEstimate = 'M6502CycleEstimate',

  /** VIC-II bank constraint (0-3) */
  M6502VICBank = 'M6502VICBank',

  /** Sprite DMA interference possible (boolean) */
  M6502SpriteDMA = 'M6502SpriteDMA',
}

// ============================================
// SUPPORTING ENUMS
// ============================================

/**
 * Dead code classification
 */
export enum DeadCodeKind {
  /** Statement can never execute (control flow) */
  UnreachableStatement = 'UnreachableStatement',

  /** Branch will never be taken (constant condition) */
  UnreachableBranch = 'UnreachableBranch',

  /** Store to variable that's never read */
  DeadStore = 'DeadStore',

  /** Expression result is computed but never used */
  UnusedResult = 'UnusedResult',
}

/**
 * Function purity levels
 */
export enum PurityLevel {
  /** Pure: no side effects, result depends only on args */
  Pure = 'Pure',

  /** Read-only: reads global state but doesn't modify it */
  ReadOnly = 'ReadOnly',

  /** Local effects: modifies local state only */
  LocalEffects = 'LocalEffects',

  /** Impure: has observable side effects */
  Impure = 'Impure',
}

/**
 * Variable escape reasons
 */
export enum EscapeReason {
  /** Doesn't escape */
  NoEscape = 'NoEscape',

  /** Passed to function */
  PassedToFunction = 'PassedToFunction',

  /** Returned from function */
  ReturnedFromFunction = 'ReturnedFromFunction',

  /** Stored in global/heap */
  StoredGlobally = 'StoredGlobally',

  /** Address taken (@address operator) */
  AddressTaken = 'AddressTaken',
}

/**
 * Memory regions for alias analysis
 */
export enum MemoryRegion {
  /** Zero-page ($00-$FF) */
  ZeroPage = 'ZeroPage',

  /** Regular RAM ($0100-$CFFF) */
  RAM = 'RAM',

  /** Hardware registers ($D000-$DFFF) */
  Hardware = 'Hardware',

  /** ROM or data segment */
  ROM = 'ROM',

  /** Unknown region */
  Unknown = 'Unknown',
}

/**
 * 6502 registers for register allocation hints
 */
export enum Register {
  /** Accumulator */
  A = 'A',

  /** X index register */
  X = 'X',

  /** Y index register */
  Y = 'Y',

  /** No preference */
  None = 'None',
}

/**
 * 6502 addressing modes
 */
export enum AddressingMode {
  /** Immediate (#value) */
  Immediate = 'Immediate',

  /** Zero-page (zp) */
  ZeroPage = 'ZeroPage',

  /** Zero-page,X (zp,x) */
  ZeroPageX = 'ZeroPageX',

  /** Zero-page,Y (zp,y) */
  ZeroPageY = 'ZeroPageY',

  /** Absolute (addr) */
  Absolute = 'Absolute',

  /** Absolute,X (addr,x) */
  AbsoluteX = 'AbsoluteX',

  /** Absolute,Y (addr,y) */
  AbsoluteY = 'AbsoluteY',

  /** Indirect ((addr)) */
  Indirect = 'Indirect',

  /** Indexed indirect ((zp,x)) */
  IndexedIndirect = 'IndexedIndirect',

  /** Indirect indexed ((zp),y) */
  IndirectIndexed = 'IndirectIndexed',
}

/**
 * Loop induction variable information
 */
export interface InductionVariable {
  /** Variable name */
  name: string;

  /** Initial value */
  initial: number;

  /** Step (increment per iteration) */
  step: number;

  /** Final value (if known) */
  final?: number;

  /** Is step constant? */
  constantStep: boolean;
}