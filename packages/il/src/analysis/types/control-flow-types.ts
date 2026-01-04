/**
 * Advanced Control Flow Graph Analytics Types
 *
 * Comprehensive type definitions for sophisticated CFG analysis including:
 * - Dominance analysis with immediate dominators and dominance trees
 * - Advanced loop detection with natural loops and nesting analysis
 * - Data dependency analysis with def-use chains and variable dependency graphs
 * - Live variable analysis with precise lifetime tracking
 * - Critical path analysis for performance hotspot identification
 *
 * @fileoverview Core types for god-level IL analytics system
 */

import { ILInstruction } from '../../il-types.js';

// =============================================================================
// Basic Block and Control Flow Graph
// =============================================================================

/**
 * Basic block - maximal sequence of instructions with single entry and exit
 */
export interface BasicBlock {
  readonly id: number;
  readonly label: string;
  readonly instructions: ReadonlyArray<ILInstruction>;
  readonly predecessors: Set<number>;
  readonly successors: Set<number>;
  readonly dominatedBlocks: Set<number>;
  readonly isLoopHeader: boolean;
  readonly isLoopExit: boolean;
  readonly executionFrequency?: number; // Estimated execution frequency
}

/**
 * Control Flow Graph representation for a function
 */
export interface ControlFlowGraph {
  readonly functionName: string;
  readonly entryBlock: number;
  readonly exitBlocks: Set<number>;
  readonly blocks: ReadonlyMap<number, BasicBlock>;
  readonly edges: ReadonlyArray<CFGEdge>;
  readonly isReducible: boolean; // Whether CFG has only natural loops
}

/**
 * Control flow graph edge with type classification
 */
export interface CFGEdge {
  readonly source: number;
  readonly target: number;
  readonly type: CFGEdgeType;
  readonly condition?: string; // For conditional edges
  readonly probability?: number; // Branch probability if available
}

export type CFGEdgeType =
  | 'fall-through' // Sequential execution
  | 'conditional' // Conditional branch
  | 'unconditional' // Unconditional jump
  | 'call' // Function call
  | 'return' // Function return
  | 'exception' // Exception handling
  | 'back-edge'; // Loop back edge

// =============================================================================
// Dominance Analysis
// =============================================================================

/**
 * Dominance analysis results with comprehensive dominance information
 */
export interface DominanceAnalysis {
  readonly immediateDominators: ReadonlyMap<number, number>;
  readonly dominanceTree: DominanceTree;
  readonly dominanceFrontiers: ReadonlyMap<number, Set<number>>;
  readonly postDominators: ReadonlyMap<number, number>;
  readonly strictlyDominates: ReadonlyMap<number, Set<number>>;
}

/**
 * Dominance tree structure for optimization ordering
 */
export interface DominanceTree {
  readonly root: number;
  readonly children: ReadonlyMap<number, Set<number>>;
  readonly parent: ReadonlyMap<number, number>;
  readonly depth: ReadonlyMap<number, number>;
}

/**
 * Dominance relationship types
 */
export type DominanceRelation =
  | 'dominates' // A dominates B
  | 'strictly-dominates' // A strictly dominates B
  | 'immediately-dominates' // A immediately dominates B
  | 'post-dominates' // A post-dominates B
  | 'none'; // No dominance relationship

// =============================================================================
// Loop Analysis
// =============================================================================

/**
 * Advanced loop analysis with natural loop detection and classification
 */
export interface LoopAnalysis {
  readonly naturalLoops: ReadonlyArray<NaturalLoop>;
  readonly loopNesting: LoopNestingTree;
  readonly loopClassification: ReadonlyMap<number, LoopType>;
  readonly inductionVariables: ReadonlyMap<number, InductionVariableInfo[]>;
  readonly loopInvariantInstructions: ReadonlyMap<number, Set<number>>;
  readonly backEdges: ReadonlyArray<BackEdge>;
}

/**
 * Natural loop with header, body, and exit information
 */
export interface NaturalLoop {
  readonly id: number;
  readonly header: number;
  readonly backEdges: ReadonlyArray<BackEdge>;
  readonly body: Set<number>;
  readonly exits: Set<number>;
  readonly nestingDepth: number;
  readonly isInnermost: boolean;
  readonly tripCount?: number; // If determinable at compile time
  readonly characteristics: LoopCharacteristics;
}

/**
 * Loop back edge from latch to header
 */
export interface BackEdge {
  readonly latch: number;
  readonly header: number;
  readonly isExiting: boolean; // Whether this edge can exit the loop
}

/**
 * Loop nesting tree for hierarchical loop analysis
 */
export interface LoopNestingTree {
  readonly outerLoops: Set<number>;
  readonly innerLoops: ReadonlyMap<number, Set<number>>;
  readonly parentLoop: ReadonlyMap<number, number>;
  readonly nestingDepth: ReadonlyMap<number, number>;
  readonly maxNestingDepth: number;
}

/**
 * Loop type classification for optimization selection
 */
export type LoopType =
  | 'counting' // Simple counting loop with induction variable
  | 'while' // While loop with condition
  | 'do-while' // Do-while loop
  | 'infinite' // Infinite loop
  | 'complex' // Complex loop with multiple exits
  | 'irreducible'; // Irreducible loop (non-natural)

/**
 * Loop characteristics for optimization guidance
 */
export interface LoopCharacteristics {
  readonly hasMultipleExits: boolean;
  readonly hasBreakStatements: boolean;
  readonly hasContinueStatements: boolean;
  readonly hasNestedLoops: boolean;
  readonly hasCallsInBody: boolean;
  readonly accessesArrays: boolean;
  readonly modifiesGlobals: boolean;
}

/**
 * Induction variable information for loop optimization
 */
export interface InductionVariableInfo {
  readonly variable: string;
  readonly initialValue: number | 'unknown';
  readonly stepValue: number | 'unknown';
  readonly finalValue: number | 'unknown';
  readonly isLinear: boolean;
  readonly usagePattern: InductionVariableUsage;
}

export type InductionVariableUsage =
  | 'loop-counter' // Primary loop counter
  | 'array-index' // Array indexing
  | 'pointer-offset' // Pointer arithmetic
  | 'computation' // General computation
  | 'derived'; // Derived from other induction variables

// =============================================================================
// Data Dependency Analysis
// =============================================================================

/**
 * Comprehensive data dependency analysis with def-use chains
 */
export interface DataDependencyAnalysis {
  readonly defUseChains: ReadonlyMap<VariableDefinition, VariableUse[]>;
  readonly useDefChains: ReadonlyMap<VariableUse, VariableDefinition[]>;
  readonly dependencyGraph: VariableDependencyGraph;
  readonly dataFlowEquations: ReadonlyArray<DataFlowEquation>;
  readonly memoryDependencies: ReadonlyArray<MemoryDependency>;
}

/**
 * Variable definition site information
 */
export interface VariableDefinition {
  readonly variable: string;
  readonly blockId: number;
  readonly instructionIndex: number;
  readonly instruction: ILInstruction;
  readonly definitionType: DefinitionType;
  readonly reachingDefinitions: Set<VariableDefinition>;
}

/**
 * Variable use site information
 */
export interface VariableUse {
  readonly variable: string;
  readonly blockId: number;
  readonly instructionIndex: number;
  readonly instruction: ILInstruction;
  readonly usageType: UsageType;
  readonly operandIndex: number; // Which operand in the instruction
}

export type DefinitionType =
  | 'assignment' // Direct assignment
  | 'parameter' // Function parameter
  | 'initialization' // Variable initialization
  | 'increment' // Increment operation
  | 'decrement' // Decrement operation
  | 'call-result' // Result of function call
  | 'phi'; // PHI node for SSA form

export type UsageType =
  | 'read' // Variable read
  | 'address' // Address taken
  | 'condition' // Used in conditional
  | 'index' // Array index
  | 'call-argument' // Function call argument
  | 'return-value'; // Return statement

/**
 * Variable dependency graph for optimization ordering
 */
export interface VariableDependencyGraph {
  readonly variables: Set<string>;
  readonly dependencies: ReadonlyMap<string, Set<string>>;
  readonly transitiveClosure: ReadonlyMap<string, Set<string>>;
  readonly stronglyConnectedComponents: ReadonlyArray<Set<string>>;
}

/**
 * Data flow equation for iterative analysis
 */
export interface DataFlowEquation {
  readonly blockId: number;
  readonly equation: DataFlowEquationType;
  readonly inputs: Set<string>;
  readonly outputs: Set<string>;
  readonly transferFunction: string; // Description of transfer function
}

export type DataFlowEquationType =
  | 'reaching-definitions'
  | 'live-variables'
  | 'available-expressions'
  | 'very-busy-expressions';

/**
 * Memory dependency between instructions
 */
export interface MemoryDependency {
  readonly source: InstructionLocation;
  readonly target: InstructionLocation;
  readonly dependencyType: MemoryDependencyType;
  readonly memoryLocation: MemoryLocation;
}

export type MemoryDependencyType =
  | 'flow' // True dependency (RAW)
  | 'anti' // Anti dependency (WAR)
  | 'output' // Output dependency (WAW)
  | 'input'; // Input dependency (RAR)

/**
 * Memory location specification for dependency tracking
 */
export interface MemoryLocation {
  readonly type: 'variable' | 'array-element' | 'pointer-target' | 'unknown';
  readonly identifier?: string;
  readonly offset?: number;
  readonly size: number;
}

// =============================================================================
// Live Variable Analysis
// =============================================================================

/**
 * Live variable analysis with precise lifetime tracking
 */
export interface LiveVariableAnalysis {
  readonly liveIn: ReadonlyMap<number, Set<string>>;
  readonly liveOut: ReadonlyMap<number, Set<string>>;
  readonly liveRanges: ReadonlyMap<string, LiveRange>;
  readonly interferenceGraph: InterferenceGraph;
  readonly variableLifetimes: ReadonlyMap<string, VariableLifetime>;
}

/**
 * Live range for a variable across basic blocks
 */
export interface LiveRange {
  readonly variable: string;
  readonly startBlock: number;
  readonly endBlock: number;
  readonly liveBlocks: Set<number>;
  readonly liveInstructions: Set<InstructionLocation>;
  readonly isSpillCandidate: boolean;
}

/**
 * Interference graph for register allocation
 */
export interface InterferenceGraph {
  readonly variables: Set<string>;
  readonly edges: Set<VariableInterference>;
  readonly coloringHint: ReadonlyMap<string, number>;
  readonly spillPriority: ReadonlyMap<string, number>;
}

/**
 * Variable interference edge
 */
export interface VariableInterference {
  readonly variable1: string;
  readonly variable2: string;
  readonly interferenceType: InterferenceType;
  readonly weight: number; // Interference strength
}

export type InterferenceType =
  | 'lifetime-overlap' // Variables live at same time
  | 'same-instruction' // Used in same instruction
  | 'assignment-conflict'; // Assignment target conflict

/**
 * Variable lifetime information for optimization
 */
export interface VariableLifetime {
  readonly variable: string;
  readonly firstUse: InstructionLocation;
  readonly lastUse: InstructionLocation;
  readonly totalInstructions: number;
  readonly usageFrequency: number;
  readonly isLoopCarried: boolean; // Live across loop iterations
}

// =============================================================================
// Critical Path Analysis
// =============================================================================

/**
 * Critical path analysis for performance optimization
 */
export interface CriticalPathAnalysis {
  readonly criticalPaths: ReadonlyArray<CriticalPath>;
  readonly hotBlocks: ReadonlyArray<HotBlock>;
  readonly performanceBottlenecks: ReadonlyArray<PerformanceBottleneck>;
  readonly optimizationOpportunities: ReadonlyArray<OptimizationOpportunity>;
}

/**
 * Critical execution path through the function
 */
export interface CriticalPath {
  readonly id: number;
  readonly blocks: ReadonlyArray<number>;
  readonly totalCycles: number;
  readonly frequency: number;
  readonly bottleneckInstructions: ReadonlyArray<InstructionLocation>;
}

/**
 * Hot block with high execution frequency
 */
export interface HotBlock {
  readonly blockId: number;
  readonly executionFrequency: number;
  readonly cyclesPerExecution: number;
  readonly totalCycles: number;
  readonly hotSpots: ReadonlyArray<InstructionLocation>;
}

/**
 * Performance bottleneck identification
 */
export interface PerformanceBottleneck {
  readonly location: InstructionLocation;
  readonly bottleneckType: BottleneckType;
  readonly impact: number; // Performance impact score
  readonly description: string;
  readonly suggestedOptimizations: ReadonlyArray<string>;
}

export type BottleneckType =
  | 'memory-access' // Slow memory operation
  | 'division' // Expensive division
  | 'multiplication' // Expensive multiplication
  | 'loop-overhead' // Loop control overhead
  | 'function-call' // Function call overhead
  | 'branch-misprediction'; // Likely branch misprediction

/**
 * Optimization opportunity identification
 */
export interface OptimizationOpportunity {
  readonly location: InstructionLocation;
  readonly opportunityType: OptimizationOpportunityType;
  readonly benefit: number; // Estimated performance benefit
  readonly complexity: OptimizationComplexity;
  readonly description: string;
  readonly requirements: ReadonlyArray<string>;
}

export type OptimizationOpportunityType =
  | 'constant-folding' // Compile-time constant evaluation
  | 'loop-unrolling' // Loop unrolling opportunity
  | 'common-subexpression' // Common subexpression elimination
  | 'dead-code' // Dead code elimination
  | 'strength-reduction' // Strength reduction (mul -> shift)
  | 'loop-invariant' // Loop invariant code motion
  | 'register-allocation' // Better register allocation
  | 'inlining'; // Function inlining opportunity

export type OptimizationComplexity =
  | 'trivial' // Easy to implement
  | 'simple' // Straightforward
  | 'moderate' // Some complexity
  | 'complex' // Significant effort
  | 'difficult'; // Very challenging

// =============================================================================
// Shared Types
// =============================================================================

/**
 * Instruction location within the function
 */
export interface InstructionLocation {
  readonly blockId: number;
  readonly instructionIndex: number;
  readonly instruction: ILInstruction;
}

/**
 * CFG analysis result aggregation
 */
export interface ControlFlowAnalysisResult {
  readonly cfg: ControlFlowGraph;
  readonly dominanceAnalysis: DominanceAnalysis;
  readonly loopAnalysis: LoopAnalysis;
  readonly dataDepAnalysis: DataDependencyAnalysis;
  readonly liveVarAnalysis: LiveVariableAnalysis;
  readonly criticalPathAnalysis: CriticalPathAnalysis;
  readonly analysisMetrics: CFGAnalysisMetrics;
}

/**
 * Analysis performance and quality metrics
 */
export interface CFGAnalysisMetrics {
  readonly analysisTimeMs: number;
  readonly memoryUsageBytes: number;
  readonly basicBlockCount: number;
  readonly edgeCount: number;
  readonly loopCount: number;
  readonly variableCount: number;
  readonly accuracyScore: number; // 0-1 confidence in analysis
}

/**
 * CFG analysis configuration options
 */
export interface CFGAnalysisOptions {
  readonly enableDominanceAnalysis: boolean;
  readonly enableLoopAnalysis: boolean;
  readonly enableDataDependencyAnalysis: boolean;
  readonly enableLiveVariableAnalysis: boolean;
  readonly enableCriticalPathAnalysis: boolean;
  readonly maxIterations: number;
  readonly convergenceThreshold: number;
  readonly enablePerformanceProfiling: boolean;
}
