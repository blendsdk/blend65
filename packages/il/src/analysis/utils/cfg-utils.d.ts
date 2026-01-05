/**
 * Control Flow Graph Analytics Utilities
 *
 * Comprehensive utility functions for sophisticated CFG analysis including:
 * - Basic block construction and edge analysis
 * - Dominance tree construction and queries
 * - Loop detection algorithms and natural loop analysis
 * - Data flow equation solving and fixed-point iteration
 * - Performance measurement and validation utilities
 *
 * @fileoverview Core utilities for god-level IL analytics system
 */
import { ILInstruction, ILFunction } from '../../il-types.js';
import { BasicBlock, ControlFlowGraph, CFGEdge, DominanceTree, NaturalLoop, BackEdge, VariableDefinition, VariableUse, InstructionLocation, CFGAnalysisMetrics } from '../types/control-flow-types.js';
/**
 * Build basic blocks from a linear sequence of IL instructions
 */
export declare function buildBasicBlocks(ilFunction: ILFunction): BasicBlock[];
/**
 * Build control flow edges between basic blocks
 */
export declare function buildControlFlowEdges(blocks: BasicBlock[]): CFGEdge[];
/**
 * Update basic block predecessor and successor sets based on edges
 */
export declare function updateBlockConnections(blocks: BasicBlock[], edges: CFGEdge[]): void;
/**
 * Compute immediate dominators using iterative algorithm
 */
export declare function computeImmediateDominators(cfg: ControlFlowGraph): Map<number, number>;
/**
 * Build dominance tree from immediate dominators
 */
export declare function buildDominanceTree(immediateDominators: Map<number, number>, entryBlock: number): DominanceTree;
/**
 * Find back edges in the control flow graph using DFS
 */
export declare function findBackEdges(cfg: ControlFlowGraph): BackEdge[];
/**
 * Identify natural loops from back edges
 */
export declare function identifyNaturalLoops(cfg: ControlFlowGraph, backEdges: BackEdge[], dominanceTree: DominanceTree): NaturalLoop[];
/**
 * Extract variable definitions from an instruction
 */
export declare function extractVariableDefinitions(instruction: ILInstruction, blockId: number, instructionIndex: number): VariableDefinition[];
/**
 * Extract variable uses from an instruction
 */
export declare function extractVariableUses(instruction: ILInstruction, blockId: number, instructionIndex: number): VariableUse[];
/**
 * Measure CFG analysis performance
 */
export declare function measureAnalysisPerformance<T>(analysisFunction: () => T, description: string): {
    result: T;
    metrics: Partial<CFGAnalysisMetrics>;
};
/**
 * Validate CFG structure for correctness
 */
export declare function validateCFGStructure(cfg: ControlFlowGraph): string[];
/**
 * Create instruction location helper
 */
export declare function createInstructionLocation(blockId: number, instructionIndex: number, instruction: ILInstruction): InstructionLocation;
//# sourceMappingURL=cfg-utils.d.ts.map