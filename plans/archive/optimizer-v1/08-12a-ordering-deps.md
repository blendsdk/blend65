# Task 8.12a: Pattern Dependency Analysis

> **Task**: 8.12a of 12 (Peephole Phase - Pattern Ordering)  
> **Time**: ~2 hours  
> **Tests**: ~35 tests  
> **Prerequisites**: Task 8.11 (Cost Model)

---

## Overview

Implement pattern dependency analysis to determine the correct order for applying peephole optimizations. Some patterns enable or disable other patterns, creating dependencies that must be respected to achieve optimal results. This task analyzes these relationships.

---

## Directory Structure

```
packages/compiler/src/optimizer/ordering/
├── index.ts              # Exports
├── types.ts              # Ordering types
├── dependency-graph.ts   # Dependency graph (THIS TASK)
├── pattern-analysis.ts   # Pattern relationship analysis (THIS TASK)
└── conflict-detection.ts # Conflict detection (THIS TASK)
```

---

## Implementation

### File: `types.ts`

```typescript
/**
 * Relationship between two patterns
 */
export enum PatternRelationship {
  /** No relationship */
  None = 'none',
  /** Pattern A enables pattern B */
  Enables = 'enables',
  /** Pattern A disables pattern B */
  Disables = 'disables',
  /** Patterns conflict (cannot both apply) */
  Conflicts = 'conflicts',
  /** Pattern A must run before pattern B */
  Precedes = 'precedes',
  /** Patterns are independent */
  Independent = 'independent',
}

/**
 * Dependency edge in the pattern graph
 */
export interface DependencyEdge {
  /** Source pattern ID */
  readonly from: string;
  /** Target pattern ID */
  readonly to: string;
  /** Type of relationship */
  readonly relationship: PatternRelationship;
  /** Confidence in this relationship (0-1) */
  readonly confidence: number;
  /** Reason for relationship */
  readonly reason: string;
}

/**
 * Pattern node in dependency graph
 */
export interface PatternNode {
  /** Pattern ID */
  readonly id: string;
  /** Patterns this one depends on */
  readonly dependencies: string[];
  /** Patterns that depend on this one */
  readonly dependents: string[];
  /** Computed priority (higher = earlier) */
  priority: number;
}

/**
 * Analysis result for pattern relationships
 */
export interface RelationshipAnalysis {
  /** Direct relationships found */
  readonly relationships: DependencyEdge[];
  /** Patterns grouped by category */
  readonly categories: Map<string, string[]>;
  /** Detected cycles */
  readonly cycles: string[][];
  /** Suggested ordering */
  readonly suggestedOrder: string[];
}
```

### File: `dependency-graph.ts`

```typescript
import { DependencyEdge, PatternNode, PatternRelationship } from './types.js';

/**
 * Directed graph for pattern dependencies
 */
export class DependencyGraph {
  /** All pattern nodes */
  protected nodes: Map<string, PatternNode> = new Map();
  
  /** All edges */
  protected edges: DependencyEdge[] = [];
  
  /** Adjacency list (from -> to[]) */
  protected adjacency: Map<string, Set<string>> = new Map();
  
  /** Reverse adjacency (to -> from[]) */
  protected reverseAdjacency: Map<string, Set<string>> = new Map();
  
  /**
   * Add a pattern to the graph
   */
  addPattern(id: string): void {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        dependencies: [],
        dependents: [],
        priority: 0,
      });
      this.adjacency.set(id, new Set());
      this.reverseAdjacency.set(id, new Set());
    }
  }
  
  /**
   * Add a dependency edge
   */
  addEdge(edge: DependencyEdge): void {
    // Ensure nodes exist
    this.addPattern(edge.from);
    this.addPattern(edge.to);
    
    // Add edge
    this.edges.push(edge);
    
    // Update adjacency
    this.adjacency.get(edge.from)!.add(edge.to);
    this.reverseAdjacency.get(edge.to)!.add(edge.from);
    
    // Update node dependencies
    const fromNode = this.nodes.get(edge.from)!;
    const toNode = this.nodes.get(edge.to)!;
    
    if (edge.relationship === PatternRelationship.Precedes ||
        edge.relationship === PatternRelationship.Enables) {
      this.nodes.set(edge.to, {
        ...toNode,
        dependencies: [...toNode.dependencies, edge.from],
      });
      this.nodes.set(edge.from, {
        ...fromNode,
        dependents: [...fromNode.dependents, edge.to],
      });
    }
  }
  
  /**
   * Get all pattern IDs
   */
  getPatterns(): string[] {
    return [...this.nodes.keys()];
  }
  
  /**
   * Get pattern node
   */
  getNode(id: string): PatternNode | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * Get all edges from a pattern
   */
  getEdgesFrom(id: string): DependencyEdge[] {
    return this.edges.filter(e => e.from === id);
  }
  
  /**
   * Get all edges to a pattern
   */
  getEdgesTo(id: string): DependencyEdge[] {
    return this.edges.filter(e => e.to === id);
  }
  
  /**
   * Get direct dependencies
   */
  getDependencies(id: string): string[] {
    return this.nodes.get(id)?.dependencies || [];
  }
  
  /**
   * Get direct dependents
   */
  getDependents(id: string): string[] {
    return this.nodes.get(id)?.dependents || [];
  }
  
  /**
   * Detect cycles using DFS
   */
  detectCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];
    
    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);
      
      const neighbors = this.adjacency.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          cycles.push([...path.slice(cycleStart), neighbor]);
        }
      }
      
      path.pop();
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }
    
    return cycles;
  }
  
  /**
   * Topological sort (Kahn's algorithm)
   */
  topologicalSort(): string[] | null {
    const inDegree = new Map<string, number>();
    
    // Initialize in-degrees
    for (const node of this.nodes.keys()) {
      inDegree.set(node, 0);
    }
    
    for (const edge of this.edges) {
      if (edge.relationship === PatternRelationship.Precedes ||
          edge.relationship === PatternRelationship.Enables) {
        inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
      }
    }
    
    // Find nodes with no incoming edges
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }
    
    const result: string[] = [];
    
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      
      const neighbors = this.adjacency.get(node) || new Set();
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    // Check if all nodes are included (no cycle)
    if (result.length !== this.nodes.size) {
      return null; // Cycle detected
    }
    
    return result;
  }
  
  /**
   * Calculate priorities for all patterns
   */
  calculatePriorities(): void {
    const order = this.topologicalSort();
    if (!order) {
      throw new Error('Cannot calculate priorities: graph has cycles');
    }
    
    // Patterns earlier in topological order get higher priority
    for (let i = 0; i < order.length; i++) {
      const node = this.nodes.get(order[i])!;
      this.nodes.set(order[i], {
        ...node,
        priority: order.length - i,
      });
    }
  }
}
```

### File: `pattern-analysis.ts`

```typescript
import { PatternRelationship, DependencyEdge, RelationshipAnalysis } from './types.js';
import { DependencyGraph } from './dependency-graph.js';
import { PeepholePattern } from '../peephole/pattern.js';

/**
 * Analyzer for pattern relationships
 */
export class PatternRelationshipAnalyzer {
  /**
   * Analyze relationships between patterns
   */
  analyze(patterns: PeepholePattern[]): RelationshipAnalysis {
    const graph = new DependencyGraph();
    const relationships: DependencyEdge[] = [];
    
    // Add all patterns to graph
    for (const pattern of patterns) {
      graph.addPattern(pattern.id);
    }
    
    // Analyze pairwise relationships
    for (let i = 0; i < patterns.length; i++) {
      for (let j = 0; j < patterns.length; j++) {
        if (i !== j) {
          const relationship = this.analyzeRelationship(patterns[i], patterns[j]);
          if (relationship.relationship !== PatternRelationship.None) {
            relationships.push(relationship);
            graph.addEdge(relationship);
          }
        }
      }
    }
    
    // Detect cycles
    const cycles = graph.detectCycles();
    
    // Generate ordering
    const order = graph.topologicalSort();
    
    // Group by category
    const categories = this.groupByCategory(patterns);
    
    return {
      relationships,
      categories,
      cycles,
      suggestedOrder: order || [],
    };
  }
  
  /**
   * Analyze relationship between two patterns
   */
  analyzeRelationship(a: PeepholePattern, b: PeepholePattern): DependencyEdge {
    // Check for enabling relationship
    if (this.checkEnables(a, b)) {
      return {
        from: a.id,
        to: b.id,
        relationship: PatternRelationship.Enables,
        confidence: 0.8,
        reason: `${a.id} creates opportunities for ${b.id}`,
      };
    }
    
    // Check for disabling relationship
    if (this.checkDisables(a, b)) {
      return {
        from: a.id,
        to: b.id,
        relationship: PatternRelationship.Disables,
        confidence: 0.8,
        reason: `${a.id} prevents ${b.id} from matching`,
      };
    }
    
    // Check for conflict
    if (this.checkConflicts(a, b)) {
      return {
        from: a.id,
        to: b.id,
        relationship: PatternRelationship.Conflicts,
        confidence: 0.9,
        reason: `${a.id} and ${b.id} cannot both apply`,
      };
    }
    
    // Check for precedence based on category
    const precedence = this.checkCategoryPrecedence(a, b);
    if (precedence) {
      return {
        from: a.id,
        to: b.id,
        relationship: PatternRelationship.Precedes,
        confidence: 0.6,
        reason: precedence,
      };
    }
    
    // No relationship
    return {
      from: a.id,
      to: b.id,
      relationship: PatternRelationship.None,
      confidence: 1.0,
      reason: 'No relationship detected',
    };
  }
  
  /**
   * Check if pattern A enables pattern B
   */
  protected checkEnables(a: PeepholePattern, b: PeepholePattern): boolean {
    // A enables B if A's output can be B's input
    // Example: Dead store elimination enables redundant load elimination
    
    // Check if A reduces instructions that B looks for
    const aReduces = this.getReducedInstructions(a);
    const bLooksFor = this.getMatchedInstructions(b);
    
    // If A creates simpler patterns that B matches
    return aReduces.some(inst => bLooksFor.includes(inst));
  }
  
  /**
   * Check if pattern A disables pattern B
   */
  protected checkDisables(a: PeepholePattern, b: PeepholePattern): boolean {
    // A disables B if A removes what B needs
    // Example: Load elimination removes the load that store combining needs
    
    const aRemoves = this.getRemovedInstructions(a);
    const bNeeds = this.getRequiredInstructions(b);
    
    return aRemoves.some(inst => bNeeds.includes(inst));
  }
  
  /**
   * Check if patterns conflict
   */
  protected checkConflicts(a: PeepholePattern, b: PeepholePattern): boolean {
    // Patterns conflict if they match the same instruction sequence
    // but produce different outputs
    
    // Same window size and overlapping match patterns
    if (a.windowSize === b.windowSize) {
      // Would need to compare actual match patterns
      // For now, use heuristic based on category and description
      if (a.category === b.category) {
        // Same category might conflict
        return false; // Would need deeper analysis
      }
    }
    
    return false;
  }
  
  /**
   * Check category-based precedence
   */
  protected checkCategoryPrecedence(
    a: PeepholePattern,
    b: PeepholePattern
  ): string | null {
    // Define category ordering rules
    const categoryOrder: Record<string, number> = {
      'dead-code': 1,        // Remove dead code first
      'constant-fold': 2,    // Fold constants early
      'load-store': 3,       // Load/store optimization
      'redundancy': 4,       // Remove redundancy
      'combining': 5,        // Combine instructions
      'strength-reduce': 6,  // Strength reduction
      'branch': 7,           // Branch optimization last
    };
    
    const aOrder = categoryOrder[a.category] ?? 50;
    const bOrder = categoryOrder[b.category] ?? 50;
    
    if (aOrder < bOrder) {
      return `Category ${a.category} should precede ${b.category}`;
    }
    
    return null;
  }
  
  /**
   * Get instructions that pattern reduces/simplifies
   */
  protected getReducedInstructions(pattern: PeepholePattern): string[] {
    // Would analyze pattern's replacement to determine this
    // For now, return empty - would need pattern introspection
    return [];
  }
  
  /**
   * Get instructions that pattern matches
   */
  protected getMatchedInstructions(pattern: PeepholePattern): string[] {
    // Would analyze pattern's match criteria
    return [];
  }
  
  /**
   * Get instructions that pattern removes
   */
  protected getRemovedInstructions(pattern: PeepholePattern): string[] {
    return [];
  }
  
  /**
   * Get instructions that pattern requires
   */
  protected getRequiredInstructions(pattern: PeepholePattern): string[] {
    return [];
  }
  
  /**
   * Group patterns by category
   */
  protected groupByCategory(
    patterns: PeepholePattern[]
  ): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    
    for (const pattern of patterns) {
      const category = pattern.category;
      const existing = groups.get(category) || [];
      existing.push(pattern.id);
      groups.set(category, existing);
    }
    
    return groups;
  }
}

/** Default pattern analyzer */
export const patternAnalyzer = new PatternRelationshipAnalyzer();
```

### File: `conflict-detection.ts`

```typescript
import { PatternRelationship, DependencyEdge } from './types.js';
import { PeepholePattern, PatternMatch } from '../peephole/pattern.js';

/**
 * Conflict detection result
 */
export interface ConflictResult {
  /** Are patterns in conflict? */
  readonly hasConflict: boolean;
  /** Type of conflict */
  readonly conflictType?: 'overlap' | 'mutual-exclusion' | 'dependency-cycle';
  /** Affected instruction indices */
  readonly affectedInstructions?: number[];
  /** Resolution suggestion */
  readonly resolution?: string;
}

/**
 * Overlap analysis between matches
 */
export interface OverlapAnalysis {
  /** Do the matches overlap? */
  readonly overlaps: boolean;
  /** Indices of overlapping instructions */
  readonly overlapIndices: number[];
  /** Can matches be applied sequentially? */
  readonly canSequence: boolean;
}

/**
 * Detector for pattern conflicts
 */
export class PatternConflictDetector {
  /**
   * Check if two pattern matches conflict
   */
  checkMatchConflict(
    matchA: PatternMatch,
    matchB: PatternMatch
  ): ConflictResult {
    // Check for instruction overlap
    const overlap = this.analyzeOverlap(matchA, matchB);
    
    if (overlap.overlaps) {
      if (!overlap.canSequence) {
        return {
          hasConflict: true,
          conflictType: 'overlap',
          affectedInstructions: overlap.overlapIndices,
          resolution: 'Apply only one pattern to overlapping instructions',
        };
      }
    }
    
    return { hasConflict: false };
  }
  
  /**
   * Check if two patterns are mutually exclusive
   */
  checkMutualExclusion(
    patternA: PeepholePattern,
    patternB: PeepholePattern
  ): ConflictResult {
    // Patterns are mutually exclusive if they:
    // 1. Match the same instruction sequence
    // 2. Produce incompatible outputs
    
    if (this.matchSamePattern(patternA, patternB)) {
      return {
        hasConflict: true,
        conflictType: 'mutual-exclusion',
        resolution: 'Choose pattern with better cost improvement',
      };
    }
    
    return { hasConflict: false };
  }
  
  /**
   * Detect dependency cycle
   */
  checkDependencyCycle(edges: DependencyEdge[]): ConflictResult {
    // Build graph and check for cycles
    const graph = new Map<string, Set<string>>();
    
    for (const edge of edges) {
      if (edge.relationship === PatternRelationship.Precedes ||
          edge.relationship === PatternRelationship.Enables) {
        if (!graph.has(edge.from)) {
          graph.set(edge.from, new Set());
        }
        graph.get(edge.from)!.add(edge.to);
      }
    }
    
    // DFS to detect cycle
    const hasCycle = this.detectCycleInGraph(graph);
    
    if (hasCycle) {
      return {
        hasConflict: true,
        conflictType: 'dependency-cycle',
        resolution: 'Break cycle by removing lowest-confidence edge',
      };
    }
    
    return { hasConflict: false };
  }
  
  /**
   * Find all conflicts in a set of matches
   */
  findAllConflicts(
    matches: Array<{ pattern: PeepholePattern; match: PatternMatch }>
  ): ConflictResult[] {
    const conflicts: ConflictResult[] = [];
    
    for (let i = 0; i < matches.length; i++) {
      for (let j = i + 1; j < matches.length; j++) {
        const conflict = this.checkMatchConflict(
          matches[i].match,
          matches[j].match
        );
        if (conflict.hasConflict) {
          conflicts.push(conflict);
        }
      }
    }
    
    return conflicts;
  }
  
  /**
   * Resolve conflicts by choosing best option
   */
  resolveConflicts(
    matches: Array<{ pattern: PeepholePattern; match: PatternMatch; score: number }>,
    conflicts: ConflictResult[]
  ): Array<{ pattern: PeepholePattern; match: PatternMatch }> {
    if (conflicts.length === 0) {
      return matches;
    }
    
    // Sort by score (descending)
    const sorted = [...matches].sort((a, b) => b.score - a.score);
    
    // Greedily select non-conflicting matches
    const selected: Array<{ pattern: PeepholePattern; match: PatternMatch }> = [];
    const usedInstructions = new Set<number>();
    
    for (const item of sorted) {
      const indices = this.getMatchIndices(item.match);
      const overlaps = indices.some(i => usedInstructions.has(i));
      
      if (!overlaps) {
        selected.push({ pattern: item.pattern, match: item.match });
        indices.forEach(i => usedInstructions.add(i));
      }
    }
    
    return selected;
  }
  
  /**
   * Analyze overlap between two matches
   */
  protected analyzeOverlap(
    matchA: PatternMatch,
    matchB: PatternMatch
  ): OverlapAnalysis {
    const indicesA = this.getMatchIndices(matchA);
    const indicesB = this.getMatchIndices(matchB);
    
    const overlapIndices = indicesA.filter(i => indicesB.includes(i));
    const overlaps = overlapIndices.length > 0;
    
    // Can sequence if one match completely precedes the other
    const canSequence = !overlaps || 
      (Math.max(...indicesA) < Math.min(...indicesB)) ||
      (Math.max(...indicesB) < Math.min(...indicesA));
    
    return {
      overlaps,
      overlapIndices,
      canSequence,
    };
  }
  
  /**
   * Get instruction indices for a match
   */
  protected getMatchIndices(match: PatternMatch): number[] {
    // Would need to extract from match.matched
    return match.matched.map((_, i) => i);
  }
  
  /**
   * Check if two patterns match the same instruction pattern
   */
  protected matchSamePattern(
    a: PeepholePattern,
    b: PeepholePattern
  ): boolean {
    // Same window size is a strong indicator
    if (a.windowSize !== b.windowSize) return false;
    
    // Same category increases likelihood
    if (a.category !== b.category) return false;
    
    // Would need deeper pattern analysis
    return false;
  }
  
  /**
   * Detect cycle in directed graph using DFS
   */
  protected detectCycleInGraph(graph: Map<string, Set<string>>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const dfs = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      
      const neighbors = graph.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true; // Cycle found
        }
      }
      
      recursionStack.delete(node);
      return false;
    };
    
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (dfs(node)) return true;
      }
    }
    
    return false;
  }
}

/** Default conflict detector */
export const conflictDetector = new PatternConflictDetector();
```

---

## Tests Required

| Test | Description |
|------|-------------|
| `dependency-graph.addPattern` | Add patterns to graph |
| `dependency-graph.addEdge` | Add dependency edges |
| `dependency-graph.detectCycles` | Find cycles in graph |
| `dependency-graph.topologicalSort` | Generate valid ordering |
| `dependency-graph.calculatePriorities` | Assign priorities |
| `pattern-analysis.analyzeRelationship` | Detect pattern relationships |
| `pattern-analysis.checkEnables` | Detect enabling relationship |
| `pattern-analysis.checkDisables` | Detect disabling relationship |
| `conflict-detection.checkMatchConflict` | Detect match conflicts |
| `conflict-detection.analyzeOverlap` | Analyze instruction overlap |
| `conflict-detection.resolveConflicts` | Choose best non-conflicting set |
| `conflict-detection.detectCycleInGraph` | Cycle detection |

---

## Task Checklist

| Item | Status |
|------|--------|
| Create `types.ts` | [ ] |
| Create `dependency-graph.ts` | [ ] |
| Create `pattern-analysis.ts` | [ ] |
| Create `conflict-detection.ts` | [ ] |
| Create `index.ts` exports | [ ] |
| Write unit tests | [ ] |
| 100% coverage | [ ] |

---

**Next Task**: 8.12b → `08-12b-ordering-algorithms.md`