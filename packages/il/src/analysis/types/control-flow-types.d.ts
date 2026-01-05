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
    readonly executionFrequency?: number;
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
    readonly isReducible: boolean;
}
/**
 * Control flow graph edge with type classification
 */
export interface CFGEdge {
    readonly source: number;
    readonly target: number;
    readonly type: CFGEdgeType;
    readonly condition?: string;
    readonly probability?: number;
}
export type CFGEdgeType = 'fall-through' | 'conditional' | 'unconditional' | 'call' | 'return' | 'exception' | 'back-edge';
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
export type DominanceRelation = 'dominates' | 'strictly-dominates' | 'immediately-dominates' | 'post-dominates' | 'none';
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
    readonly tripCount?: number;
    readonly characteristics: LoopCharacteristics;
}
/**
 * Loop back edge from latch to header
 */
export interface BackEdge {
    readonly latch: number;
    readonly header: number;
    readonly isExiting: boolean;
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
export type LoopType = 'counting' | 'while' | 'do-while' | 'infinite' | 'complex' | 'irreducible';
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
export type InductionVariableUsage = 'loop-counter' | 'array-index' | 'pointer-offset' | 'computation' | 'derived';
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
    readonly operandIndex: number;
}
export type DefinitionType = 'assignment' | 'parameter' | 'initialization' | 'increment' | 'decrement' | 'call-result' | 'phi';
export type UsageType = 'read' | 'address' | 'condition' | 'index' | 'call-argument' | 'return-value';
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
    readonly transferFunction: string;
}
export type DataFlowEquationType = 'reaching-definitions' | 'live-variables' | 'available-expressions' | 'very-busy-expressions';
/**
 * Memory dependency between instructions
 */
export interface MemoryDependency {
    readonly source: InstructionLocation;
    readonly target: InstructionLocation;
    readonly dependencyType: MemoryDependencyType;
    readonly memoryLocation: MemoryLocation;
}
export type MemoryDependencyType = 'flow' | 'anti' | 'output' | 'input';
/**
 * Memory location specification for dependency tracking
 */
export interface MemoryLocation {
    readonly type: 'variable' | 'array-element' | 'pointer-target' | 'unknown';
    readonly identifier?: string;
    readonly offset?: number;
    readonly size: number;
}
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
    readonly weight: number;
}
export type InterferenceType = 'lifetime-overlap' | 'same-instruction' | 'assignment-conflict';
/**
 * Variable lifetime information for optimization
 */
export interface VariableLifetime {
    readonly variable: string;
    readonly firstUse: InstructionLocation;
    readonly lastUse: InstructionLocation;
    readonly totalInstructions: number;
    readonly usageFrequency: number;
    readonly isLoopCarried: boolean;
}
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
    readonly impact: number;
    readonly description: string;
    readonly suggestedOptimizations: ReadonlyArray<string>;
}
export type BottleneckType = 'memory-access' | 'division' | 'multiplication' | 'loop-overhead' | 'function-call' | 'branch-misprediction';
/**
 * Optimization opportunity identification
 */
export interface OptimizationOpportunity {
    readonly location: InstructionLocation;
    readonly opportunityType: OptimizationOpportunityType;
    readonly benefit: number;
    readonly complexity: OptimizationComplexity;
    readonly description: string;
    readonly requirements: ReadonlyArray<string>;
}
export type OptimizationOpportunityType = 'constant-folding' | 'loop-unrolling' | 'common-subexpression' | 'dead-code' | 'strength-reduction' | 'loop-invariant' | 'register-allocation' | 'inlining';
export type OptimizationComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'difficult';
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
    readonly accuracyScore: number;
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
//# sourceMappingURL=control-flow-types.d.ts.map