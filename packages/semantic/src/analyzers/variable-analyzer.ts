/**
 * Variable Declaration Analysis for Blend65 Semantic Analysis
 * Task 1.4: Implement Variable Declaration Analysis
 * Task 1.8: Enhanced Variable Usage Analysis (NEW)
 *
 * This analyzer validates variable declarations according to the Blend65 language specification,
 * including storage class validation, type checking, initialization validation, and scope restrictions.
 *
 * Task 1.8 Enhancement: Comprehensive optimization metadata collection for zero page promotion
 * and register allocation decisions with 6502-specific optimization hints.
 *
 * Integrates with existing TypeChecker and SymbolTable infrastructure from Tasks 1.1-1.3.
 * Uses Task 1.7 ExpressionAnalyzer variable reference tracking for optimization analysis.
 */

import { VariableDeclaration, Expression, StorageClass } from '@blend65/ast';
import {
  VariableSymbol,
  Blend65Type,
  SemanticError,
  SemanticResult,
  ScopeType,
  createVariableSymbol,
  VariableOptimizationMetadata,
  VariableUsageStatistics,
  ZeroPageCandidateInfo,
  RegisterCandidateInfo,
  VariableLifetimeInfo,
  Variable6502OptimizationHints,
  VariableMemoryLayoutInfo,
  ZeroPagePromotionFactor,
  ZeroPageAntiPromotionFactor,
  ZeroPageRecommendation,
  PreferredRegister,
  RegisterAllocationRecommendation,
  isPrimitiveType,
} from '../types.js';
import { SymbolTable } from '../symbol-table.js';
import { TypeChecker } from '../type-system.js';
import { ExpressionAnalysisResult } from './expression-analyzer.js';

/**
 * Variable analyzer that validates variable declarations and creates variable symbols
 */
export class VariableAnalyzer {
  constructor(
    private symbolTable: SymbolTable,
    private typeChecker: TypeChecker
  ) {}

  /**
   * Analyze a variable declaration and create a variable symbol
   * Performs comprehensive validation according to Blend65 language specification
   */
  analyzeVariableDeclaration(
    varDecl: VariableDeclaration,
    currentScope: ScopeType
  ): SemanticResult<VariableSymbol> {
    const errors: SemanticError[] = [];
    const location = varDecl.metadata?.start || { line: 0, column: 0, offset: 0 };

    // 1. Convert AST type to Blend65 type
    const typeResult = this.typeChecker.convertASTTypeToBlend65Type(varDecl.varType, location);
    if (!typeResult.success) {
      errors.push(...typeResult.errors);
      return { success: false, errors };
    }
    const variableType = typeResult.data;

    // 2. Validate storage class usage
    if (varDecl.storageClass) {
      const storageResult = this.validateStorageClassUsage(
        varDecl.storageClass,
        variableType,
        varDecl.initializer !== null,
        currentScope,
        location
      );
      if (!storageResult.success) {
        errors.push(...storageResult.errors);
      }
    }

    // 3. Check for duplicate declarations
    const duplicateResult = this.checkDuplicateDeclaration(varDecl.name, location);
    if (!duplicateResult.success) {
      errors.push(...duplicateResult.errors);
    }

    // 4. Validate initialization if present
    let initializerType: Blend65Type | null = null;
    if (varDecl.initializer) {
      const initResult = this.validateInitialization(
        varDecl.initializer,
        variableType,
        varDecl.storageClass,
        location
      );
      if (!initResult.success) {
        errors.push(...initResult.errors);
      } else {
        initializerType = initResult.data;
      }
    }

    // 5. Check required initializations for storage classes
    const initRequiredResult = this.checkRequiredInitialization(
      varDecl.storageClass,
      varDecl.initializer,
      location
    );
    if (!initRequiredResult.success) {
      errors.push(...initRequiredResult.errors);
    }

    // Return errors if validation failed
    if (errors.length > 0) {
      return { success: false, errors };
    }

    // 6. Create and register variable symbol
    const scope = this.symbolTable.getCurrentScope();
    const variableSymbol = createVariableSymbol(varDecl.name, variableType, scope, location, {
      storageClass: varDecl.storageClass || undefined,
      initialValue: varDecl.initializer || undefined,
      isExported: varDecl.exported,
      isLocal: false,
    });

    const addResult = this.symbolTable.declareSymbol(variableSymbol);
    if (!addResult.success) {
      return { success: false, errors: addResult.errors };
    }

    return { success: true, data: variableSymbol };
  }

  /**
   * Validate storage class usage according to Blend65 language specification
   */
  private validateStorageClassUsage(
    storageClass: StorageClass,
    variableType: Blend65Type,
    hasInitializer: boolean,
    currentScope: ScopeType,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const errors: SemanticError[] = [];

    // Storage classes are only allowed at global (module) scope
    if (currentScope !== 'Global') {
      errors.push({
        errorType: 'InvalidStorageClass',
        message:
          `Storage class '${storageClass}' is not allowed in function scope. ` +
          `Only module-level variables can have storage classes.`,
        location,
        suggestions: [
          `Remove the '${storageClass}' storage class`,
          'Move variable to module level',
        ],
      });
      return { success: false, errors };
    }

    // Use TypeChecker for detailed storage class validation
    const storageResult = this.typeChecker.validateVariableStorageClass(
      storageClass,
      variableType,
      hasInitializer,
      location
    );

    return storageResult;
  }

  /**
   * Check for duplicate variable declarations in current scope
   */
  private checkDuplicateDeclaration(
    variableName: string,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    if (this.symbolTable.lookupSymbolInScope(variableName, this.symbolTable.getCurrentScope())) {
      const error: SemanticError = {
        errorType: 'DuplicateSymbol',
        message: `Variable '${variableName}' is already declared in this scope`,
        location,
        suggestions: [
          `Use a different variable name`,
          `Check for naming conflicts`,
          `Remove duplicate declaration`,
        ],
      };
      return { success: false, errors: [error] };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate variable initialization expression
   */
  private validateInitialization(
    initializer: Expression,
    variableType: Blend65Type,
    storageClass: StorageClass | null,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<Blend65Type> {
    const errors: SemanticError[] = [];

    // Get initializer type
    const initTypeResult = this.typeChecker.checkExpressionType(initializer);
    if (!initTypeResult.success) {
      errors.push(...initTypeResult.errors);
      return { success: false, errors };
    }
    const initializerType = initTypeResult.data;

    // Check assignment compatibility
    const compatResult = this.typeChecker.checkAssignmentCompatibility(
      variableType,
      initializerType,
      location
    );
    if (!compatResult.success) {
      errors.push(
        ...compatResult.errors.map(error => ({
          ...error,
          message: `Variable initialization type mismatch: ${error.message}`,
        }))
      );
    }

    // Additional validation for data/const storage classes
    if (storageClass === 'data' || storageClass === 'const') {
      const constantResult = this.validateConstantInitializer(initializer, location);
      if (!constantResult.success) {
        errors.push(...constantResult.errors);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: initializerType };
  }

  /**
   * Check that const and data storage classes have required initializers
   */
  private checkRequiredInitialization(
    storageClass: StorageClass | null,
    initializer: Expression | null,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    if ((storageClass === 'const' || storageClass === 'data') && !initializer) {
      const error: SemanticError = {
        errorType: 'ConstantRequired',
        message: `Variables with '${storageClass}' storage class must be initialized at declaration`,
        location,
        suggestions: [
          `Add an initializer: var name: type = value`,
          `Use a different storage class (ram, zp)`,
          `Provide a compile-time constant value`,
        ],
      };
      return { success: false, errors: [error] };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate that initializer is a compile-time constant (for data/const storage)
   */
  private validateConstantInitializer(
    initializer: Expression,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    // Check if expression is a compile-time constant
    if (!this.isCompileTimeConstant(initializer)) {
      const error: SemanticError = {
        errorType: 'ConstantRequired',
        message: 'Initializer for data/const variable must be a compile-time constant',
        location,
        suggestions: [
          'Use a literal value (number, boolean)',
          'Use a constant expression',
          'Use an array literal with constant elements',
          'Avoid function calls or variable references',
        ],
      };
      return { success: false, errors: [error] };
    }

    return { success: true, data: undefined };
  }

  /**
   * Determine if an expression is a compile-time constant
   */
  private isCompileTimeConstant(expression: Expression): boolean {
    switch (expression.type) {
      case 'Literal':
        return true;

      case 'ArrayLiteral':
        // Array literal is constant if all elements are constants
        return expression.elements.every(element => this.isCompileTimeConstant(element));

      case 'UnaryExpr':
        // Unary expression is constant if operand is constant
        return this.isCompileTimeConstant(expression.operand);

      case 'BinaryExpr':
        // Binary expression is constant if both operands are constants
        return (
          this.isCompileTimeConstant(expression.left) &&
          this.isCompileTimeConstant(expression.right)
        );

      case 'Identifier':
        // Could be a const variable, but for simplicity we're strict here
        // In a more sophisticated implementation, we'd look up the symbol
        return false;

      default:
        return false;
    }
  }

  // ============================================================================
  // TASK 1.8: ENHANCED VARIABLE OPTIMIZATION METADATA COLLECTION
  // ============================================================================

  /**
   * Collect comprehensive usage metadata for all variables from expression analysis results.
   * Integrates with Task 1.7 ExpressionAnalyzer VariableReference tracking.
   *
   * @param variables - All variable symbols to analyze
   * @param expressionResults - Expression analysis results containing variable references
   * @returns Aggregated usage metadata for optimization decisions
   */
  collectVariableUsageMetadata(
    variables: VariableSymbol[],
    expressionResults: ExpressionAnalysisResult[]
  ): Map<string, VariableUsageStatistics> {
    const usageMap = new Map<string, VariableUsageStatistics>();

    // Initialize usage statistics for all variables
    for (const variable of variables) {
      usageMap.set(variable.name, {
        accessCount: 0,
        readCount: 0,
        writeCount: 0,
        modifyCount: 0,
        loopUsage: [],
        hotPathUsage: 0,
        estimatedAccessFrequency: 'rare',
        accessPattern: 'single_use',
      });
    }

    // Aggregate usage data from all expression analysis results
    for (const exprResult of expressionResults) {
      for (const varRef of exprResult.optimizationData.usedVariables) {
        const stats = usageMap.get(varRef.symbol.name);
        if (!stats) continue;

        // Update access counts
        stats.accessCount++;

        switch (varRef.accessType) {
          case 'read':
          case 'array_read':
          case 'member_read':
            stats.readCount++;
            break;
          case 'write':
          case 'array_write':
          case 'member_write':
            stats.writeCount++;
            break;
          case 'modify':
            stats.modifyCount++;
            break;
        }

        // Track loop usage
        if (varRef.context.loopDepth > 0) {
          let loopUsage = stats.loopUsage.find(lu => lu.loopLevel === varRef.context.loopDepth);
          if (!loopUsage) {
            loopUsage = {
              loopLevel: varRef.context.loopDepth,
              accessesInLoop: 0,
              isLoopInvariant: false,
              isInductionVariable: false,
              estimatedIterations: Math.pow(10, varRef.context.loopDepth), // Simple heuristic
            };
            stats.loopUsage.push(loopUsage);
          }
          loopUsage.accessesInLoop++;
        }

        // Track hot path usage
        if (varRef.context.inHotPath) {
          stats.hotPathUsage++;
        }
      }
    }

    // Calculate derived statistics
    for (const [varName, stats] of usageMap) {
      // Determine access frequency (prioritize hot path usage over access count)
      if (stats.accessCount === 0) {
        stats.estimatedAccessFrequency = 'rare';
      } else if (stats.hotPathUsage > 0 || stats.loopUsage.length > 0) {
        stats.estimatedAccessFrequency = 'hot';
      } else if (stats.accessCount === 1) {
        stats.estimatedAccessFrequency = 'rare';
      } else if (stats.accessCount <= 5) {
        stats.estimatedAccessFrequency = 'normal';
      } else if (stats.accessCount <= 20) {
        stats.estimatedAccessFrequency = 'frequent';
      } else {
        stats.estimatedAccessFrequency = 'very_frequent';
      }

      // Determine access pattern (prioritize hot path over other patterns)
      if (stats.accessCount === 0) {
        stats.accessPattern = 'single_use';
      } else if (stats.hotPathUsage > 0) {
        stats.accessPattern = 'hot_path';
      } else if (stats.accessCount === 1) {
        stats.accessPattern = 'single_use';
      } else if (stats.readCount > 0 && stats.writeCount > 0) {
        stats.accessPattern = 'read_write';
      } else if (stats.modifyCount > stats.accessCount * 0.5) {
        stats.accessPattern = 'accumulator';
      } else if (stats.loopUsage.length > 0) {
        stats.accessPattern = 'loop_dependent';
      } else if (stats.readCount > 1) {
        stats.accessPattern = 'multiple_read';
      } else {
        stats.accessPattern = 'multiple_read';
      }
    }

    return usageMap;
  }

  /**
   * Analyze variables for zero page promotion candidates.
   * Zero page access is faster on 6502 (3 cycles vs 4+ cycles).
   *
   * @param variables - All variable symbols to analyze
   * @returns Array of zero page candidate analysis results
   */
  analyzeZeroPageCandidates(variables: VariableSymbol[]): ZeroPageCandidateInfo[] {
    const candidates: ZeroPageCandidateInfo[] = [];

    for (const variable of variables) {
      const candidateInfo = this.analyzeZeroPageCandidate(variable);
      candidates.push(candidateInfo);
    }

    // Sort by promotion score (highest first)
    candidates.sort((a, b) => b.promotionScore - a.promotionScore);

    return candidates;
  }

  /**
   * Analyze a single variable for zero page promotion.
   */
  private analyzeZeroPageCandidate(variable: VariableSymbol): ZeroPageCandidateInfo {
    const promotionFactors: ZeroPagePromotionFactor[] = [];
    const antiPromotionFactors: ZeroPageAntiPromotionFactor[] = [];

    // Calculate variable size in bytes
    const sizeInBytes = this.calculateVariableSizeInBytes(variable.varType);

    // Check if variable already has zp storage class
    if (variable.storageClass === 'zp') {
      antiPromotionFactors.push({
        factor: 'already_zp',
        weight: 100,
        description: 'Variable already has zp storage class',
      });
    }

    // Check if variable has no explicit storage class (good for promotion)
    if (!variable.storageClass) {
      promotionFactors.push({
        factor: 'no_storage_class',
        weight: 20,
        description: 'Variable has no explicit storage class, good candidate for promotion',
      });
    }

    // Size analysis
    if (sizeInBytes <= 1) {
      promotionFactors.push({
        factor: 'small_size',
        weight: 30,
        description: 'Single byte variable fits efficiently in zero page',
      });
    } else if (sizeInBytes <= 4) {
      promotionFactors.push({
        factor: 'small_size',
        weight: 15,
        description: 'Small multi-byte variable suitable for zero page',
      });
    } else if (sizeInBytes > 16) {
      antiPromotionFactors.push({
        factor: 'large_size',
        weight: 50,
        description: `Large variable (${sizeInBytes} bytes) would consume too much zero page space`,
      });
    }

    // Storage class analysis
    if (variable.storageClass === 'io') {
      antiPromotionFactors.push({
        factor: 'io_access',
        weight: 100,
        description: 'I/O variables should remain in I/O address space',
      });
    }

    if (variable.storageClass === 'const' || variable.storageClass === 'data') {
      antiPromotionFactors.push({
        factor: 'const_data',
        weight: 60,
        description: 'Constant data should remain in appropriate memory sections',
      });
    }

    // Type-based analysis
    if (
      isPrimitiveType(variable.varType) &&
      (variable.varType.name === 'byte' || variable.varType.name === 'word')
    ) {
      promotionFactors.push({
        factor: 'arithmetic_operations',
        weight: 25,
        description: 'Numeric types benefit from zero page arithmetic operations',
      });
    }

    // Calculate promotion score
    let score = 0;
    for (const factor of promotionFactors) {
      score += factor.weight;
    }
    for (const factor of antiPromotionFactors) {
      score -= factor.weight;
    }

    // Normalize score to 0-100 range
    score = Math.max(0, Math.min(100, score));

    // Determine recommendation
    let recommendation: ZeroPageRecommendation;
    if (score >= 80) {
      recommendation = 'strongly_recommended';
    } else if (score >= 60) {
      recommendation = 'recommended';
    } else if (score >= 40) {
      recommendation = 'neutral';
    } else if (score >= 20) {
      recommendation = 'not_recommended';
    } else {
      recommendation = 'strongly_discouraged';
    }

    // Estimate benefit (cycle savings per access)
    const estimatedBenefit = score > 50 ? (sizeInBytes <= 2 ? 1 : 0.5) : 0;

    return {
      isCandidate: score >= 40 && antiPromotionFactors.length === 0,
      promotionScore: score,
      estimatedBenefit,
      sizeRequirement: sizeInBytes,
      promotionFactors,
      antiPromotionFactors,
      recommendation,
    };
  }

  /**
   * Analyze variables for register allocation candidates.
   * 6502 has A, X, Y registers available for short-lived variables.
   *
   * @param variables - All variable symbols to analyze
   * @returns Array of register allocation candidate analysis
   */
  analyzeRegisterCandidates(variables: VariableSymbol[]): RegisterCandidateInfo[] {
    const candidates: RegisterCandidateInfo[] = [];

    for (const variable of variables) {
      const candidateInfo = this.analyzeRegisterCandidate(variable);
      candidates.push(candidateInfo);
    }

    // Sort by allocation score (highest first)
    candidates.sort((a, b) => b.allocationScore - a.allocationScore);

    return candidates;
  }

  /**
   * Analyze a single variable for register allocation.
   */
  private analyzeRegisterCandidate(variable: VariableSymbol): RegisterCandidateInfo {
    let allocationScore = 0;
    let preferredRegister: PreferredRegister = 'memory';
    const alternativeRegisters: PreferredRegister[] = [];

    // Only primitive byte/word types are suitable for register allocation
    if (
      !isPrimitiveType(variable.varType) ||
      (variable.varType.name !== 'byte' &&
        variable.varType.name !== 'word' &&
        variable.varType.name !== 'boolean')
    ) {
      return {
        isCandidate: false,
        preferredRegister,
        alternativeRegisters,
        allocationScore: 0,
        estimatedBenefit: 0,
        interferenceInfo: {
          interferingVariables: [],
          registerPressure: [],
          requiresSpilling: false,
          spillingCost: 0,
        },
        usagePatterns: [],
        recommendation: 'impossible',
      };
    }

    // Byte variables are better candidates than word variables
    if (variable.varType.name === 'byte' || variable.varType.name === 'boolean') {
      allocationScore += 40;
      preferredRegister = 'A'; // Accumulator for byte operations
      alternativeRegisters.push('X', 'Y');
    } else if (variable.varType.name === 'word') {
      allocationScore += 20;
      preferredRegister = 'zero_page'; // 16-bit values better in zero page pairs
      alternativeRegisters.push('A'); // Can use A for low byte operations
    }

    // Local variables are better candidates
    if (variable.isLocal) {
      allocationScore += 30;
    }

    // Variables without storage classes are better candidates
    if (!variable.storageClass) {
      allocationScore += 20;
    } else {
      // Variables with explicit storage classes usually should stay in memory
      allocationScore -= 30;
    }

    // Estimate benefit
    const estimatedBenefit = allocationScore > 50 ? 2 : 0; // 2 cycles saved per access

    // Determine recommendation
    let recommendation: RegisterAllocationRecommendation;
    if (allocationScore >= 80) {
      recommendation = 'strongly_recommended';
    } else if (allocationScore >= 60) {
      recommendation = 'recommended';
    } else if (allocationScore >= 40) {
      recommendation = 'conditional';
    } else if (allocationScore >= 20) {
      recommendation = 'not_recommended';
    } else {
      recommendation = 'impossible';
    }

    return {
      isCandidate: allocationScore >= 40,
      preferredRegister,
      alternativeRegisters,
      allocationScore,
      estimatedBenefit,
      interferenceInfo: {
        interferingVariables: [], // Would be filled by lifetime analysis
        registerPressure: [],
        requiresSpilling: false,
        spillingCost: 0,
      },
      usagePatterns: [],
      recommendation,
    };
  }

  /**
   * Analyze variable lifetimes for interference detection.
   * This is a simplified implementation - full lifetime analysis requires CFG.
   *
   * @param variables - All variable symbols to analyze
   * @param cfg - Optional control flow graph (not implemented yet)
   * @returns Lifetime analysis for interference detection
   */
  analyzeVariableLifetimes(variables: VariableSymbol[], cfg?: any): VariableLifetimeInfo[] {
    const lifetimeInfos: VariableLifetimeInfo[] = [];

    for (const variable of variables) {
      // Simplified lifetime analysis without CFG
      const lifetimeInfo: VariableLifetimeInfo = {
        definitionPoints: [variable.sourceLocation],
        usePoints: [], // Would be filled from expression analysis
        liveRanges: [
          {
            start: variable.sourceLocation,
            end: variable.sourceLocation, // Simplified - would extend to last use
            spansLoop: false,
            isHotPath: false,
          },
        ],
        spansFunctionCalls: false, // Conservative assumption
        spansLoops: false,
        estimatedDuration: variable.isLocal ? 10 : 100, // Basic blocks estimate
        interferingVariables: [], // Would be computed from live ranges
      };

      lifetimeInfos.push(lifetimeInfo);
    }

    return lifetimeInfos;
  }

  /**
   * Build comprehensive optimization metadata for variables.
   * Combines all analysis results into complete metadata.
   *
   * @param variables - All variable symbols to analyze
   * @param usageData - Usage statistics from expression analysis
   * @returns Complete optimization metadata for all variables
   */
  buildVariableOptimizationMetadata(
    variables: VariableSymbol[],
    usageData: Map<string, VariableUsageStatistics>
  ): Map<string, VariableOptimizationMetadata> {
    const metadataMap = new Map<string, VariableOptimizationMetadata>();

    // Get analysis results
    const zeroPageCandidates = this.analyzeZeroPageCandidates(variables);
    const registerCandidates = this.analyzeRegisterCandidates(variables);
    const lifetimeInfos = this.analyzeVariableLifetimes(variables);

    // Build metadata for each variable
    for (let i = 0; i < variables.length; i++) {
      const variable = variables[i];
      const usage = usageData.get(variable.name);
      const zeroPageInfo = zeroPageCandidates[i];
      const registerInfo = registerCandidates[i];
      const lifetimeInfo = lifetimeInfos[i];

      if (!usage) continue;

      const metadata: VariableOptimizationMetadata = {
        usageStatistics: usage,
        zeroPageCandidate: zeroPageInfo,
        registerCandidate: registerInfo,
        lifetimeInfo: lifetimeInfo,
        sixtyTwoHints: this.generate6502Hints(variable, usage, zeroPageInfo, registerInfo),
        memoryLayout: this.generateMemoryLayoutInfo(variable, usage, zeroPageInfo),
      };

      metadataMap.set(variable.name, metadata);

      // Attach metadata to the variable symbol
      variable.optimizationMetadata = metadata;
    }

    return metadataMap;
  }

  /**
   * Generate 6502-specific optimization hints for a variable.
   */
  private generate6502Hints(
    variable: VariableSymbol,
    usage: VariableUsageStatistics,
    zeroPageInfo: ZeroPageCandidateInfo,
    registerInfo: RegisterCandidateInfo
  ): Variable6502OptimizationHints {
    return {
      addressingMode: zeroPageInfo.isCandidate ? 'zero_page' : 'absolute',
      memoryBank:
        variable.storageClass === 'zp'
          ? 'zero_page'
          : variable.storageClass === 'io'
            ? 'io_area'
            : 'low_ram',
      alignmentPreference: {
        requiredAlignment:
          isPrimitiveType(variable.varType) && variable.varType.name === 'word' ? 2 : 1,
        preferredAlignment: 1,
        preferPageBoundary: false,
        reason: 'none',
      },
      hardwareInteraction: {
        isHardwareRegister: variable.storageClass === 'io',
        isMemoryMappedIO: variable.storageClass === 'io',
        isTimingCritical: usage.estimatedAccessFrequency === 'hot',
        usedInInterrupts: false, // Would need callback analysis
        hardwareComponents: [],
      },
      optimizationOpportunities: [],
      performanceHints: [
        {
          hint: usage.estimatedAccessFrequency === 'hot' ? 'hot_variable' : 'cold_variable',
          impact: usage.estimatedAccessFrequency === 'hot' ? 'high' : 'low',
          description: `Variable accessed ${usage.accessCount} times`,
        },
      ],
    };
  }

  /**
   * Generate memory layout information for a variable.
   */
  private generateMemoryLayoutInfo(
    variable: VariableSymbol,
    usage: VariableUsageStatistics,
    zeroPageInfo: ZeroPageCandidateInfo
  ): VariableMemoryLayoutInfo {
    return {
      preferredRegion: zeroPageInfo.isCandidate ? 'zero_page_normal' : 'ram_normal',
      sizeInBytes: this.calculateVariableSizeInBytes(variable.varType),
      alignment: {
        requiredAlignment: 1,
        preferredAlignment: 1,
        preferPageBoundary: false,
        reason: 'none',
      },
      groupingPreference: {
        shouldGroup: false,
        groupWith: [],
        groupingReason: 'function_locals',
        layoutPreference: 'sequential',
      },
      accessPatterns: [
        {
          pattern: 'sequential',
          frequency: usage.accessCount,
          spatialLocality: 'medium',
          temporalLocality: usage.accessPattern === 'hot_path' ? 'high' : 'medium',
        },
      ],
      localityInfo: {
        spatialLocality: 'medium',
        temporalLocality: usage.accessPattern === 'hot_path' ? 'high' : 'medium',
        coAccessedVariables: [],
        workingSetSize: 1,
        isHotData: usage.estimatedAccessFrequency === 'hot',
      },
    };
  }

  /**
   * Calculate variable size in bytes for 6502 memory layout.
   */
  private calculateVariableSizeInBytes(varType: Blend65Type): number {
    switch (varType.kind) {
      case 'primitive':
        switch (varType.name) {
          case 'byte':
          case 'boolean':
            return 1;
          case 'word':
            return 2;
          case 'void':
            return 0;
          default:
            return 1;
        }
      case 'array':
        const elementSize = this.calculateVariableSizeInBytes(varType.elementType);
        return elementSize * varType.size;
      case 'callback':
        return 2; // Function pointer = 2 bytes address
      case 'named':
        return 1; // Conservative estimate
      default:
        return 1;
    }
  }

  /**
   * Get comprehensive analysis statistics
   */
  getAnalysisStatistics(): {
    variablesAnalyzed: number;
    storageClassUsage: Record<StorageClass | 'none', number>;
    exportedVariables: number;
    errorsDetected: number;
  } {
    // Get all variable symbols from symbol table by walking through all scopes
    const variables: VariableSymbol[] = [];
    const collectVariables = (scope: any): void => {
      for (const [_, symbol] of scope.symbols) {
        if (symbol.symbolType === 'Variable') {
          variables.push(symbol as VariableSymbol);
        }
      }
      for (const child of scope.children) {
        collectVariables(child);
      }
    };
    collectVariables(this.symbolTable.getGlobalScope());

    const storageClassUsage: Record<StorageClass | 'none', number> = {
      zp: 0,
      ram: 0,
      data: 0,
      const: 0,
      io: 0,
      none: 0,
    };

    let exportedVariables = 0;

    for (const variable of variables) {
      if (variable.storageClass) {
        storageClassUsage[variable.storageClass]++;
      } else {
        storageClassUsage.none++;
      }

      if (variable.isExported) {
        exportedVariables++;
      }
    }

    return {
      variablesAnalyzed: variables.length,
      storageClassUsage,
      exportedVariables,
      errorsDetected: 0, // Updated during analysis
    };
  }
}

/**
 * Convenience function to create and use a variable analyzer
 */
export function analyzeVariableDeclaration(
  varDecl: VariableDeclaration,
  symbolTable: SymbolTable,
  typeChecker: TypeChecker,
  currentScope: ScopeType
): SemanticResult<VariableSymbol> {
  const analyzer = new VariableAnalyzer(symbolTable, typeChecker);
  return analyzer.analyzeVariableDeclaration(varDecl, currentScope);
}
