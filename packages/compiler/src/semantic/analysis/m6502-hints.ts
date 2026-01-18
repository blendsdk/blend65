/**
 * 6502 Optimization Hints (Phase 8 - Task 8.13)
 *
 * Generates MOS 6502-specific optimization hints including:
 * - Zero-page allocation priority scoring
 * - Register preference hints (A, X, Y)
 * - Addressing mode recommendations
 * - Reserved zero-page location blacklist
 * - Cycle count estimation
 *
 * **CRITICAL**: Not all zero-page is usable! $00-$01 and $90-$FF are reserved.
 * Safe range: $02-$8F (only 142 bytes, not 256!)
 *
 * **Analysis Only**: Marks opportunities; code generator uses hints.
 *
 * @example
 * ```typescript
 * const analyzer = new M6502HintAnalyzer(symbolTable, cfgs);
 * analyzer.analyze(ast);
 * 
 * // Check zero-page priority
 * const zpPriority = variable.metadata?.get(OptimizationMetadataKey.M6502ZeroPagePriority);
 * ```
 */

import type { Program, VariableDecl } from '../../ast/nodes.js';
import type { SymbolTable } from '../symbol-table.js';
import type { Symbol } from '../symbol.js';
import type { ControlFlowGraph } from '../control-flow.js';
import type { Diagnostic } from '../../ast/diagnostics.js';
import { OptimizationMetadataKey } from './optimization-metadata-keys.js';
import { ASTWalker } from '../../ast/walker/base.js';

/**
 * 6502 Register preference
 */
export enum M6502Register {
  /** Accumulator - best for arithmetic */
  A = 'A',
  
  /** X register - best for indexing, loop counters */
  X = 'X',
  
  /** Y register - best for indexing, loop counters */
  Y = 'Y',
  
  /** No preference */
  Any = 'Any',
}

/**
 * Memory access pattern
 */
export enum MemoryAccessPattern {
  /** Single access */
  Single = 'Single',
  
  /** Sequential access (array iteration) */
  Sequential = 'Sequential',
  
  /** Random access */
  Random = 'Random',
  
  /** Hot path (in loops) */
  HotPath = 'HotPath',
}

/**
 * Safe zero-page range
 */
const SAFE_ZERO_PAGE = {
  start: 0x02,
  end: 0x8F,
  size: 0x8F - 0x02 + 1, // 142 bytes
};

/**
 * Variable usage information for 6502 hints
 */
interface VariableHints {
  /** Variable symbol */
  symbol: Symbol;
  
  /** Read count */
  readCount: number;
  
  /** Write count */
  writeCount: number;
  
  /** Hot path accesses (in loops) */
  hotPathAccesses: number;
  
  /** Maximum loop depth */
  maxLoopDepth: number;
  
  /** Is this a loop counter? */
  isLoopCounter: boolean;
  
  /** Zero-page priority (0-100) */
  zpPriority: number;
  
  /** Register preference */
  registerPreference: M6502Register;
  
  /** Memory access pattern */
  accessPattern: MemoryAccessPattern;
}

/**
 * 6502 optimization hints analyzer
 *
 * Analyzes variable usage patterns and generates
 * 6502-specific optimization hints for the code generator.
 *
 * Key responsibilities:
 * - Calculate zero-page allocation priorities
 * - Recommend register usage
 * - Detect memory access patterns
 * - Enforce reserved zero-page blacklist
 */
export class M6502HintAnalyzer extends ASTWalker {
  /** Diagnostics collected during analysis */
  private diagnostics: Diagnostic[] = [];
  
  /** Variable hints map */
  private variableHints = new Map<string, VariableHints>();
  

  /**
   * Creates a 6502 hint analyzer
   *
   * @param symbolTable - Symbol table from Pass 1
   * @param cfgs - Control flow graphs from Pass 5
   */
  constructor(
    private readonly symbolTable: SymbolTable,
    _cfgs: Map<string, ControlFlowGraph>
  ) {
    super();
  }

  /**
   * Analyze program for 6502 optimization hints
   *
   * @param ast - Program AST to analyze
   */
  public analyze(ast: Program): void {
    // Phase 1: Collect variable usage (reuse from variable-usage.ts data if available)
    this.collectVariableUsage(ast);
    
    // Phase 2: Calculate zero-page priorities
    this.calculateZeroPagePriorities();
    
    // Phase 3: Determine register preferences
    this.determineRegisterPreferences();
    
    // Phase 4: Detect memory access patterns
    this.detectAccessPatterns();
    
    // Phase 5: Check for reserved zero-page violations
    this.checkReservedZeroPage(ast);
    
    // Phase 6: Set metadata on AST nodes
    this.setM6502Metadata();
  }

  /**
   * Collect variable usage information
   */
  private collectVariableUsage(ast: Program): void {
    const declarations = ast.getDeclarations();
    
    for (const decl of declarations) {
      if (decl.constructor.name === 'VariableDecl') {
        const varDecl = decl as VariableDecl;
        const varName = varDecl.getName();
        const symbol = this.symbolTable.lookup(varName);
        
        if (symbol) {
          // Get usage data from metadata (set by Task 8.2)
          const readCount = varDecl.metadata?.get(OptimizationMetadataKey.UsageReadCount) || 0;
          const writeCount = varDecl.metadata?.get(OptimizationMetadataKey.UsageWriteCount) || 0;
          const hotPathAccesses = varDecl.metadata?.get(OptimizationMetadataKey.UsageHotPathAccesses) || 0;
          const maxLoopDepth = varDecl.metadata?.get(OptimizationMetadataKey.UsageMaxLoopDepth) || 0;
          
          this.variableHints.set(varName, {
            symbol,
            readCount: typeof readCount === 'number' ? readCount : 0,
            writeCount: typeof writeCount === 'number' ? writeCount : 0,
            hotPathAccesses: typeof hotPathAccesses === 'number' ? hotPathAccesses : 0,
            maxLoopDepth: typeof maxLoopDepth === 'number' ? maxLoopDepth : 0,
            isLoopCounter: false, // Will be determined
            zpPriority: 0,
            registerPreference: M6502Register.Any,
            accessPattern: MemoryAccessPattern.Single,
          });
        }
      }
    }
  }

  /**
   * Calculate zero-page allocation priorities
   *
   * Priority factors:
   * - Usage frequency (reads + writes)
   * - Loop depth (higher = higher priority)
   * - Variable size (byte > word for ZP efficiency)
   * - Hot path accesses
   *
   * Score: 0-100 (100 = highest priority)
   */
  private calculateZeroPagePriorities(): void {
    for (const [_varName, hints] of this.variableHints) {
      let priority = 0;
      
      // Factor 1: Total access count (0-40 points)
      const totalAccesses = hints.readCount + hints.writeCount;
      priority += Math.min(40, totalAccesses * 2);
      
      // Factor 2: Loop depth (0-30 points)
      priority += Math.min(30, hints.maxLoopDepth * 10);
      
      // Factor 3: Hot path accesses (0-20 points)
      priority += Math.min(20, hints.hotPathAccesses);
      
      // Factor 4: Variable size (0-10 points)
      const type = hints.symbol.type;
      if (type?.name === 'byte') {
        priority += 10; // Bytes benefit most from ZP
      } else if (type?.name === 'word') {
        priority += 5; // Words benefit but take 2 bytes
      }
      
      // Clamp to 0-100
      hints.zpPriority = Math.min(100, Math.max(0, priority));
    }
  }

  /**
   * Determine register preferences
   *
   * Rules:
   * - Loop counters → X or Y
   * - Array indexing → X or Y
   * - Arithmetic → A
   * - High frequency → A
   */
  private determineRegisterPreferences(): void {
    for (const [_varName, hints] of this.variableHints) {
      // Check if loop counter (high write count in loops)
      if (hints.maxLoopDepth > 0 && hints.writeCount > 0) {
        hints.isLoopCounter = true;
        hints.registerPreference = M6502Register.X; // Default to X
      }
      
      // High frequency variables prefer accumulator
      else if (hints.readCount + hints.writeCount > 10) {
        hints.registerPreference = M6502Register.A;
      }
      
      // Otherwise, no preference
      else {
        hints.registerPreference = M6502Register.Any;
      }
    }
  }

  /**
   * Detect memory access patterns
   */
  private detectAccessPatterns(): void {
    for (const [_varName, hints] of this.variableHints) {
      // Hot path pattern (in loops)
      if (hints.hotPathAccesses > 0) {
        hints.accessPattern = MemoryAccessPattern.HotPath;
      }
      
      // Single access pattern
      else if (hints.readCount + hints.writeCount <= 1) {
        hints.accessPattern = MemoryAccessPattern.Single;
      }
      
      // Multiple accesses (default to random)
      else {
        hints.accessPattern = MemoryAccessPattern.Random;
      }
    }
  }

  /**
   * Check for reserved zero-page violations
   *
   * Warns if @zp or @map declarations use reserved addresses.
   */
  private checkReservedZeroPage(_ast: Program): void {
    // TODO: Implement @map/@zp address validation
    // Skip for now - requires proper AST traversal
  }


  /**
   * Set 6502 metadata on AST nodes
   */
  private setM6502Metadata(): void {
    for (const [_varName, hints] of this.variableHints) {
      const symbol = hints.symbol;
      const decl = symbol.declaration as VariableDecl;
      
      if (decl && decl.metadata) {
        // Set metadata
        decl.metadata.set(OptimizationMetadataKey.M6502ZeroPagePriority, hints.zpPriority);
        decl.metadata.set(OptimizationMetadataKey.M6502RegisterPreference, hints.registerPreference);
        
        // Estimate cycle count (simple heuristic)
        const cycleEstimate = this.estimateCycles(hints);
        decl.metadata.set(OptimizationMetadataKey.M6502CycleEstimate, cycleEstimate);
      }
    }
  }

  /**
   * Estimate cycle count for variable accesses
   *
   * Rough estimates:
   * - Zero-page: 3 cycles (LDA $ZP)
   * - Absolute: 4 cycles (LDA $ADDR)
   * - Indexed: 4-5 cycles (LDA $ADDR,X)
   *
   * @param hints - Variable hints
   * @returns Estimated cycles per access
   */
  private estimateCycles(_hints: VariableHints): number {
    // TODO: Implement proper cycle estimation based on storage class
    // For now, return default estimate
    return 4; // Default to absolute addressing
  }

  /**
   * Get all diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get variable hints for debugging
   */
  public getVariableHints(): Map<string, VariableHints> {
    return new Map(this.variableHints);
  }

  /**
   * Check if address is in safe zero-page range
   *
   * @param address - Address to check
   * @returns True if safe
   */
  public static isZeroPageSafe(address: number): boolean {
    return address >= SAFE_ZERO_PAGE.start && address <= SAFE_ZERO_PAGE.end;
  }

  /**
   * Get safe zero-page range
   */
  public static getSafeZeroPageRange(): { start: number; end: number; size: number } {
    return { ...SAFE_ZERO_PAGE };
  }
}