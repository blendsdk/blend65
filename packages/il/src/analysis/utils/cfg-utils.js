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
import { ILInstructionType } from '../../il-types.js';
// =============================================================================
// Basic Block Construction Utilities
// =============================================================================
/**
 * Build basic blocks from a linear sequence of IL instructions
 */
export function buildBasicBlocks(ilFunction) {
    const blocks = [];
    const instructions = ilFunction.instructions;
    if (instructions.length === 0) {
        return blocks;
    }
    // Identify basic block boundaries (leaders)
    const leaders = findBasicBlockLeaders(instructions);
    // Create basic blocks from leader positions
    for (let i = 0; i < leaders.length; i++) {
        const start = leaders[i];
        const end = i + 1 < leaders.length ? leaders[i + 1] : instructions.length;
        const blockInstructions = instructions.slice(start, end);
        const block = {
            id: i,
            label: `bb_${i}`,
            instructions: blockInstructions,
            predecessors: new Set(),
            successors: new Set(),
            dominatedBlocks: new Set(),
            isLoopHeader: false,
            isLoopExit: false,
        };
        blocks.push(block);
    }
    return blocks;
}
/**
 * Find instruction positions that start new basic blocks (leaders)
 */
function findBasicBlockLeaders(instructions) {
    const leaders = new Set();
    // First instruction is always a leader
    leaders.add(0);
    for (let i = 0; i < instructions.length; i++) {
        const instruction = instructions[i];
        // Branch targets are leaders
        if (instruction.type === ILInstructionType.BRANCH ||
            instruction.type === ILInstructionType.BRANCH_IF_TRUE ||
            instruction.type === ILInstructionType.BRANCH_IF_FALSE) {
            const target = extractBranchTarget(instruction);
            if (target !== null && target < instructions.length) {
                leaders.add(target);
            }
            // Instruction after branch is also a leader (for conditional branches)
            if (instruction.type !== ILInstructionType.BRANCH && i + 1 < instructions.length) {
                leaders.add(i + 1);
            }
        }
        // Function calls create new basic blocks
        if (instruction.type === ILInstructionType.CALL) {
            if (i + 1 < instructions.length) {
                leaders.add(i + 1);
            }
        }
        // Return statements end basic blocks
        if (instruction.type === ILInstructionType.RETURN) {
            if (i + 1 < instructions.length) {
                leaders.add(i + 1);
            }
        }
    }
    return Array.from(leaders).sort((a, b) => a - b);
}
/**
 * Extract branch target instruction index from branch instruction
 */
function extractBranchTarget(instruction) {
    if (instruction.operands.length > 0) {
        const target = instruction.operands[instruction.operands.length - 1];
        if (target.valueType === 'label' && typeof target.targetInstruction === 'number') {
            return target.targetInstruction;
        }
    }
    return null;
}
/**
 * Build control flow edges between basic blocks
 */
export function buildControlFlowEdges(blocks) {
    const edges = [];
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        const lastInstruction = block.instructions[block.instructions.length - 1];
        if (!lastInstruction)
            continue;
        switch (lastInstruction.type) {
            case ILInstructionType.BRANCH:
                // Unconditional jump
                const jumpTarget = extractBranchTarget(lastInstruction);
                if (jumpTarget !== null) {
                    const targetBlockId = findBlockContainingInstruction(blocks, jumpTarget);
                    if (targetBlockId !== -1) {
                        edges.push({
                            source: i,
                            target: targetBlockId,
                            type: 'unconditional',
                        });
                    }
                }
                break;
            case ILInstructionType.BRANCH_IF_TRUE:
            case ILInstructionType.BRANCH_IF_FALSE:
                // Conditional branch
                const branchTarget = extractBranchTarget(lastInstruction);
                if (branchTarget !== null) {
                    const targetBlockId = findBlockContainingInstruction(blocks, branchTarget);
                    if (targetBlockId !== -1) {
                        edges.push({
                            source: i,
                            target: targetBlockId,
                            type: 'conditional',
                            condition: lastInstruction.type === ILInstructionType.BRANCH_IF_TRUE ? 'true' : 'false',
                        });
                    }
                }
                // Fall-through edge
                if (i + 1 < blocks.length) {
                    edges.push({
                        source: i,
                        target: i + 1,
                        type: 'fall-through',
                    });
                }
                break;
            case ILInstructionType.CALL:
                // Function call - fall through to next block
                if (i + 1 < blocks.length) {
                    edges.push({
                        source: i,
                        target: i + 1,
                        type: 'call',
                    });
                }
                break;
            case ILInstructionType.RETURN:
                // Return statement - no outgoing edges
                break;
            default:
                // Regular instruction - fall through
                if (i + 1 < blocks.length) {
                    edges.push({
                        source: i,
                        target: i + 1,
                        type: 'fall-through',
                    });
                }
                break;
        }
    }
    return edges;
}
/**
 * Find which basic block contains the given instruction index
 */
function findBlockContainingInstruction(blocks, instructionIndex) {
    let currentIndex = 0;
    for (let blockId = 0; blockId < blocks.length; blockId++) {
        const block = blocks[blockId];
        const blockSize = block.instructions.length;
        if (instructionIndex >= currentIndex && instructionIndex < currentIndex + blockSize) {
            return blockId;
        }
        currentIndex += blockSize;
    }
    return -1; // Not found
}
/**
 * Update basic block predecessor and successor sets based on edges
 */
export function updateBlockConnections(blocks, edges) {
    // Clear existing connections
    blocks.forEach(block => {
        block.predecessors.clear();
        block.successors.clear();
    });
    // Build connections from edges
    edges.forEach(edge => {
        const sourceBlock = blocks[edge.source];
        const targetBlock = blocks[edge.target];
        if (sourceBlock && targetBlock) {
            sourceBlock.successors.add(edge.target);
            targetBlock.predecessors.add(edge.source);
        }
    });
}
// =============================================================================
// Dominance Analysis Utilities
// =============================================================================
/**
 * Compute immediate dominators using iterative algorithm
 */
export function computeImmediateDominators(cfg) {
    const blocks = Array.from(cfg.blocks.keys());
    const immediateDominators = new Map();
    // Initialize: entry block dominates itself, others are undefined
    const entryBlock = cfg.entryBlock;
    immediateDominators.set(entryBlock, entryBlock);
    // Fixed-point iteration
    let changed = true;
    while (changed) {
        changed = false;
        for (const blockId of blocks) {
            if (blockId === entryBlock)
                continue;
            const block = cfg.blocks.get(blockId);
            if (!block || block.predecessors.size === 0)
                continue;
            // Find intersection of dominators of all predecessors
            const predecessors = Array.from(block.predecessors);
            let newDominator = predecessors[0];
            for (let i = 1; i < predecessors.length; i++) {
                const pred = predecessors[i];
                if (immediateDominators.has(pred)) {
                    newDominator = findCommonDominator(newDominator, pred, immediateDominators);
                }
            }
            if (immediateDominators.get(blockId) !== newDominator) {
                immediateDominators.set(blockId, newDominator);
                changed = true;
            }
        }
    }
    return immediateDominators;
}
/**
 * Find common dominator of two blocks
 */
function findCommonDominator(blockA, blockB, dominators) {
    const pathA = getDominatorPath(blockA, dominators);
    const pathB = getDominatorPath(blockB, dominators);
    // Find first common element in paths
    const setA = new Set(pathA);
    for (const block of pathB) {
        if (setA.has(block)) {
            return block;
        }
    }
    return blockA; // Fallback
}
/**
 * Get path from block to entry through dominators
 */
function getDominatorPath(blockId, dominators) {
    const path = [];
    let current = blockId;
    while (current !== undefined) {
        path.push(current);
        const dominator = dominators.get(current);
        if (dominator === current)
            break; // Reached entry block
        current = dominator;
    }
    return path;
}
/**
 * Build dominance tree from immediate dominators
 */
export function buildDominanceTree(immediateDominators, entryBlock) {
    const children = new Map();
    const parent = new Map();
    const depth = new Map();
    // Initialize children sets
    for (const [block, idom] of immediateDominators) {
        if (!children.has(idom)) {
            children.set(idom, new Set());
        }
        if (!children.has(block)) {
            children.set(block, new Set());
        }
    }
    // Build parent-child relationships
    for (const [block, idom] of immediateDominators) {
        if (block !== idom) {
            // Not the entry block
            children.get(idom).add(block);
            parent.set(block, idom);
        }
    }
    // Compute depths using DFS
    function computeDepths(blockId, currentDepth) {
        depth.set(blockId, currentDepth);
        const blockChildren = children.get(blockId);
        if (blockChildren) {
            for (const child of blockChildren) {
                computeDepths(child, currentDepth + 1);
            }
        }
    }
    computeDepths(entryBlock, 0);
    return {
        root: entryBlock,
        children,
        parent,
        depth,
    };
}
// =============================================================================
// Loop Detection Utilities
// =============================================================================
/**
 * Find back edges in the control flow graph using DFS
 */
export function findBackEdges(cfg) {
    const backEdges = [];
    const visited = new Set();
    const onStack = new Set();
    function dfs(blockId) {
        visited.add(blockId);
        onStack.add(blockId);
        const block = cfg.blocks.get(blockId);
        if (!block)
            return;
        for (const successor of block.successors) {
            if (onStack.has(successor)) {
                // Found back edge
                backEdges.push({
                    latch: blockId,
                    header: successor,
                    isExiting: false, // Will be determined later
                });
            }
            else if (!visited.has(successor)) {
                dfs(successor);
            }
        }
        onStack.delete(blockId);
    }
    dfs(cfg.entryBlock);
    return backEdges;
}
/**
 * Identify natural loops from back edges
 */
export function identifyNaturalLoops(cfg, backEdges, dominanceTree) {
    const naturalLoops = [];
    for (let i = 0; i < backEdges.length; i++) {
        const backEdge = backEdges[i];
        // Verify this is a proper back edge (header dominates latch)
        if (!blockDominates(backEdge.header, backEdge.latch, dominanceTree)) {
            continue;
        }
        // Build loop body using backward traversal
        const loopBody = findLoopBody(cfg, backEdge);
        // Find loop exits
        const exits = findLoopExits(cfg, loopBody);
        // Determine nesting depth
        const nestingDepth = calculateNestingDepth(backEdge.header, naturalLoops);
        const loop = {
            id: i,
            header: backEdge.header,
            backEdges: [backEdge],
            body: loopBody,
            exits,
            nestingDepth,
            isInnermost: true, // Will be updated later
            characteristics: analyzeLoopCharacteristics(cfg, loopBody),
        };
        naturalLoops.push(loop);
    }
    // Update innermost flags
    updateInnermostFlags(naturalLoops);
    return naturalLoops;
}
/**
 * Check if blockA dominates blockB
 */
function blockDominates(blockA, blockB, dominanceTree) {
    let current = blockB;
    while (current !== undefined) {
        if (current === blockA)
            return true;
        current = dominanceTree.parent.get(current);
    }
    return false;
}
/**
 * Find all blocks in the natural loop body
 */
function findLoopBody(cfg, backEdge) {
    const body = new Set();
    const worklist = [backEdge.latch];
    body.add(backEdge.header);
    while (worklist.length > 0) {
        const blockId = worklist.pop();
        if (!body.has(blockId)) {
            body.add(blockId);
            const block = cfg.blocks.get(blockId);
            if (block) {
                for (const pred of block.predecessors) {
                    worklist.push(pred);
                }
            }
        }
    }
    return body;
}
/**
 * Find loop exit blocks
 */
function findLoopExits(cfg, loopBody) {
    const exits = new Set();
    for (const blockId of loopBody) {
        const block = cfg.blocks.get(blockId);
        if (!block)
            continue;
        for (const successor of block.successors) {
            if (!loopBody.has(successor)) {
                exits.add(successor);
            }
        }
    }
    return exits;
}
/**
 * Calculate nesting depth for a loop header
 */
function calculateNestingDepth(header, existingLoops) {
    let maxDepth = 0;
    for (const loop of existingLoops) {
        if (loop.body.has(header)) {
            maxDepth = Math.max(maxDepth, loop.nestingDepth);
        }
    }
    return maxDepth + 1;
}
/**
 * Analyze loop characteristics for optimization guidance
 */
function analyzeLoopCharacteristics(cfg, loopBody) {
    let hasMultipleExits = false;
    let hasBreakStatements = false;
    let hasContinueStatements = false;
    let hasNestedLoops = false;
    let hasCallsInBody = false;
    let accessesArrays = false;
    let modifiesGlobals = false;
    let exitCount = 0;
    for (const blockId of loopBody) {
        const block = cfg.blocks.get(blockId);
        if (!block)
            continue;
        // Check for exits
        for (const successor of block.successors) {
            if (!loopBody.has(successor)) {
                exitCount++;
            }
        }
        // Analyze instructions
        for (const instruction of block.instructions) {
            switch (instruction.type) {
                case ILInstructionType.CALL:
                    hasCallsInBody = true;
                    break;
                case ILInstructionType.LOAD_ARRAY:
                case ILInstructionType.STORE_ARRAY:
                    accessesArrays = true;
                    break;
                case ILInstructionType.LOAD_VARIABLE:
                case ILInstructionType.STORE_VARIABLE:
                    // Simple heuristic: global if no local scope prefix
                    if (instruction.operands.length > 0) {
                        const operand = instruction.operands[0];
                        if (operand.valueType === 'variable' && !operand.name.includes('.')) {
                            modifiesGlobals = true;
                        }
                    }
                    break;
            }
        }
    }
    hasMultipleExits = exitCount > 1;
    return {
        hasMultipleExits,
        hasBreakStatements,
        hasContinueStatements,
        hasNestedLoops,
        hasCallsInBody,
        accessesArrays,
        modifiesGlobals,
    };
}
/**
 * Update innermost flags for natural loops
 */
function updateInnermostFlags(loops) {
    for (const loop of loops) {
        let isInnermost = true;
        for (const otherLoop of loops) {
            if (otherLoop !== loop && otherLoop.body.has(loop.header)) {
                isInnermost = false;
                break;
            }
        }
        // TypeScript doesn't allow modifying readonly properties directly,
        // so we use type assertion for this internal utility
        loop.isInnermost = isInnermost;
    }
}
// =============================================================================
// Variable Analysis Utilities
// =============================================================================
/**
 * Extract variable definitions from an instruction
 */
export function extractVariableDefinitions(instruction, blockId, instructionIndex) {
    const definitions = [];
    // Check if instruction defines a variable
    if (instruction.operands.length > 0) {
        const target = instruction.operands[0];
        if (target.valueType === 'variable') {
            const definition = {
                variable: target.name,
                blockId,
                instructionIndex,
                instruction,
                definitionType: classifyDefinitionType(instruction),
                reachingDefinitions: new Set(), // Will be populated later
            };
            definitions.push(definition);
        }
    }
    return definitions;
}
/**
 * Extract variable uses from an instruction
 */
export function extractVariableUses(instruction, blockId, instructionIndex) {
    const uses = [];
    // Skip the target operand (index 0) for most instructions
    const startIndex = isDefinitionInstruction(instruction) ? 1 : 0;
    for (let i = startIndex; i < instruction.operands.length; i++) {
        const operand = instruction.operands[i];
        if (operand.valueType === 'variable') {
            const use = {
                variable: operand.name,
                blockId,
                instructionIndex,
                instruction,
                usageType: classifyUsageType(instruction, i),
                operandIndex: i,
            };
            uses.push(use);
        }
    }
    return uses;
}
/**
 * Classify the type of variable definition
 */
function classifyDefinitionType(instruction) {
    switch (instruction.type) {
        case ILInstructionType.COPY:
        case ILInstructionType.STORE_VARIABLE:
            return 'assignment';
        case ILInstructionType.ADD:
        case ILInstructionType.SUB:
        case ILInstructionType.MUL:
        case ILInstructionType.DIV:
            return 'assignment';
        case ILInstructionType.CALL:
            return 'call-result';
        default:
            return 'assignment';
    }
}
/**
 * Classify the type of variable usage
 */
function classifyUsageType(instruction, operandIndex) {
    switch (instruction.type) {
        case ILInstructionType.BRANCH_IF_TRUE:
        case ILInstructionType.BRANCH_IF_FALSE:
            return 'condition';
        case ILInstructionType.LOAD_ARRAY:
        case ILInstructionType.STORE_ARRAY:
            return operandIndex === 1 ? 'index' : 'read';
        case ILInstructionType.CALL:
            return 'call-argument';
        case ILInstructionType.RETURN:
            return 'return-value';
        default:
            return 'read';
    }
}
/**
 * Check if instruction is a definition (modifies a variable)
 */
function isDefinitionInstruction(instruction) {
    const definitionTypes = [
        ILInstructionType.COPY,
        ILInstructionType.STORE_VARIABLE,
        ILInstructionType.ADD,
        ILInstructionType.SUB,
        ILInstructionType.MUL,
        ILInstructionType.DIV,
        ILInstructionType.CALL,
        ILInstructionType.LOAD_VARIABLE,
        ILInstructionType.LOAD_ARRAY,
    ];
    return definitionTypes.includes(instruction.type);
}
// =============================================================================
// Performance and Validation Utilities
// =============================================================================
/**
 * Measure CFG analysis performance
 */
export function measureAnalysisPerformance(analysisFunction, description) {
    const startTime = getCurrentTime();
    const startMemory = getMemoryUsage();
    const result = analysisFunction();
    const endTime = getCurrentTime();
    const endMemory = getMemoryUsage();
    const metrics = {
        analysisTimeMs: endTime - startTime,
        memoryUsageBytes: endMemory - startMemory,
    };
    // Debug logging with fallback
    try {
        const globalConsole = typeof globalThis !== 'undefined' ? globalThis.console : undefined;
        if (globalConsole && typeof globalConsole.debug === 'function') {
            globalConsole.debug(`CFG Analysis ${description}: ${metrics.analysisTimeMs?.toFixed(2)}ms, ${metrics.memoryUsageBytes} bytes`);
        }
    }
    catch {
        // Ignore logging errors
    }
    return { result, metrics };
}
/**
 * Get current time in milliseconds (cross-platform)
 */
function getCurrentTime() {
    try {
        const globalPerformance = typeof globalThis !== 'undefined' ? globalThis.performance : undefined;
        if (globalPerformance && typeof globalPerformance.now === 'function') {
            return globalPerformance.now();
        }
    }
    catch {
        // Fall through to Date.now()
    }
    return Date.now(); // Fallback for environments without performance API
}
/**
 * Get current memory usage (Node.js specific)
 */
function getMemoryUsage() {
    // Type-safe check for Node.js process object
    const globalProcess = typeof globalThis !== 'undefined' ? globalThis.process : undefined;
    if (globalProcess && typeof globalProcess.memoryUsage === 'function') {
        try {
            return globalProcess.memoryUsage().heapUsed;
        }
        catch {
            return 0; // Fallback if memory usage call fails
        }
    }
    return 0; // Fallback for non-Node environments
}
/**
 * Validate CFG structure for correctness
 */
export function validateCFGStructure(cfg) {
    const errors = [];
    // Skip validation for empty CFGs
    if (cfg.blocks.size === 0) {
        return errors; // Empty CFG is valid
    }
    // Check entry block exists
    if (!cfg.blocks.has(cfg.entryBlock)) {
        errors.push(`Entry block ${cfg.entryBlock} does not exist`);
    }
    // Check all exit blocks exist
    for (const exitBlock of cfg.exitBlocks) {
        if (!cfg.blocks.has(exitBlock)) {
            errors.push(`Exit block ${exitBlock} does not exist`);
        }
    }
    // Check edge consistency
    for (const edge of cfg.edges) {
        if (!cfg.blocks.has(edge.source)) {
            errors.push(`Edge source block ${edge.source} does not exist`);
        }
        if (!cfg.blocks.has(edge.target)) {
            errors.push(`Edge target block ${edge.target} does not exist`);
        }
        // Verify edge is reflected in block connections
        const sourceBlock = cfg.blocks.get(edge.source);
        const targetBlock = cfg.blocks.get(edge.target);
        if (sourceBlock && !sourceBlock.successors.has(edge.target)) {
            errors.push(`Block ${edge.source} missing successor ${edge.target}`);
        }
        if (targetBlock && !targetBlock.predecessors.has(edge.source)) {
            errors.push(`Block ${edge.target} missing predecessor ${edge.source}`);
        }
    }
    return errors;
}
/**
 * Create instruction location helper
 */
export function createInstructionLocation(blockId, instructionIndex, instruction) {
    return {
        blockId,
        instructionIndex,
        instruction,
    };
}
//# sourceMappingURL=cfg-utils.js.map