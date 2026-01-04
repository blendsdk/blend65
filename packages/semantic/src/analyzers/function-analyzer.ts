/**
 * Function Declaration Analysis for Blend65 Semantic Analysis
 * Task 1.5: Implement Function Declaration Analysis
 *
 * This analyzer validates function declarations according to the Blend65 language specification,
 * including function signature validation, callback function support, parameter type checking,
 * and function call validation.
 *
 * Key Features:
 * - Function signature validation with callback support
 * - Parameter and return type checking
 * - Callback function assignment validation
 * - Function call argument compatibility
 * - Export handling for module system
 * - Duplicate function detection
 *
 * Educational Focus:
 * - How compilers validate function contracts
 * - Callback function type checking for interrupt handlers
 * - Function overloading and signature matching
 * - Symbol table integration for function resolution
 */

import { FunctionDeclaration, Expression, Parameter } from '@blend65/ast';
import {
  FunctionSymbol,
  VariableSymbol,
  Blend65Type,
  SemanticError,
  SemanticResult,
  ScopeType,
  ParameterInfo,
  createFunctionSymbol,
  createCallbackType,
  isPrimitiveType,
  isCallbackType,
  typeToString,
  areCallbackTypesCompatible,
} from '../types.js';
import { SymbolTable } from '../symbol-table.js';
import { TypeChecker, FunctionSignature } from '../type-system.js';

/**
 * Function analyzer that validates function declarations and creates function symbols.
 * Provides comprehensive validation for both regular functions and v0.3 callback functions.
 */
export class FunctionAnalyzer {
  constructor(
    private symbolTable: SymbolTable,
    private typeChecker: TypeChecker
  ) {}

  /**
   * Analyze a function declaration and create a function symbol.
   * Performs comprehensive validation according to Blend65 language specification.
   *
   * Educational Note:
   * - Function declarations define the contract between caller and callee
   * - Callback functions enable interrupt handlers and function pointers
   * - Parameter validation prevents runtime type errors in 6502 assembly
   */
  analyzeFunctionDeclaration(
    funcDecl: FunctionDeclaration,
    currentScope: ScopeType
  ): SemanticResult<FunctionSymbol> {
    const errors: SemanticError[] = [];
    const location = funcDecl.metadata?.start || { line: 0, column: 0, offset: 0 };

    // 1. Validate function signature using TypeChecker
    const signatureResult = this.typeChecker.validateFunctionSignature(funcDecl, location);
    if (!signatureResult.success) {
      errors.push(...signatureResult.errors);
      return { success: false, errors };
    }
    const signature = signatureResult.data;

    // 2. Check for duplicate function declarations
    const duplicateResult = this.checkDuplicateFunctionDeclaration(funcDecl.name, location);
    if (!duplicateResult.success) {
      errors.push(...duplicateResult.errors);
    }

    // 3. Validate callback function restrictions (if applicable)
    if (funcDecl.callback) {
      const callbackValidation = this.validateCallbackFunctionDeclaration(signature, location);
      if (!callbackValidation.success) {
        errors.push(...callbackValidation.errors);
      }
    }

    // 4. Validate parameter names for uniqueness
    const paramResult = this.validateParameterNames(funcDecl.params, location);
    if (!paramResult.success) {
      errors.push(...paramResult.errors);
    }

    // 5. Additional function-level validations
    const additionalValidation = this.performAdditionalValidations(
      funcDecl,
      signature,
      currentScope,
      location
    );
    if (!additionalValidation.success) {
      errors.push(...additionalValidation.errors);
    }

    // Return errors if validation failed
    if (errors.length > 0) {
      return { success: false, errors };
    }

    // 6. Create and register function symbol
    const scope = this.symbolTable.getCurrentScope();
    const parameterInfo: ParameterInfo[] = signature.parameters.map(param => ({
      name: param.name,
      type: param.type,
      optional: param.hasDefaultValue,
      defaultValue: null, // We could store the AST node here if needed
    }));

    const functionSymbol = createFunctionSymbol(
      funcDecl.name,
      parameterInfo,
      signature.returnType,
      scope,
      location,
      {
        isCallback: funcDecl.callback,
        isExported: funcDecl.exported,
      }
    );

    const addResult = this.symbolTable.declareSymbol(functionSymbol);
    if (!addResult.success) {
      return { success: false, errors: addResult.errors };
    }

    return { success: true, data: functionSymbol };
  }

  /**
   * Validate callback function assignment compatibility.
   *
   * Educational Note:
   * - Callback variables can only hold callback functions
   * - Signature must match exactly for type safety
   * - Essential for interrupt handlers and function dispatch tables
   */
  validateCallbackAssignment(
    targetType: Blend65Type,
    sourceFunction: FunctionSymbol,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const errors: SemanticError[] = [];

    // Target must be a callback type
    if (!isCallbackType(targetType)) {
      errors.push({
        errorType: 'CallbackMismatch',
        message: `Cannot assign function to non-callback type ${typeToString(targetType)}`,
        location,
        suggestions: [
          'Use a callback variable to hold function references',
          'Declare the target variable with callback type',
        ],
      });
      return { success: false, errors };
    }

    // Source must be a callback function
    if (!sourceFunction.isCallback) {
      errors.push({
        errorType: 'CallbackMismatch',
        message: `Cannot assign regular function '${sourceFunction.name}' to callback variable. Only callback functions can be assigned to callback variables.`,
        location,
        suggestions: [
          `Declare '${sourceFunction.name}' as a callback function`,
          'Use a regular function call instead of assignment',
          'Check if you meant to call the function directly',
        ],
      });
      return { success: false, errors };
    }

    // Create callback type from function signature
    const functionCallbackType = createCallbackType(
      sourceFunction.parameters.map(p => p.type),
      sourceFunction.returnType
    );

    // Check signature compatibility
    if (!areCallbackTypesCompatible(targetType as any, functionCallbackType)) {
      errors.push({
        errorType: 'CallbackMismatch',
        message:
          `Callback function '${sourceFunction.name}' signature does not match target callback type.\n` +
          `Expected: ${typeToString(targetType)}\n` +
          `Got: ${typeToString(functionCallbackType)}`,
        location,
        suggestions: [
          'Ensure callback function signature matches variable type',
          'Check parameter types and return type compatibility',
          'Verify parameter count matches exactly',
        ],
      });
      return { success: false, errors };
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate function call with argument type checking.
   *
   * Educational Note:
   * - Function calls must match the declared signature exactly
   * - Argument types are checked for compatibility
   * - Return type is inferred from function signature
   */
  validateFunctionCall(
    functionSymbol: FunctionSymbol,
    args: Expression[],
    location: { line: number; column: number; offset: number }
  ): SemanticResult<Blend65Type> {
    const errors: SemanticError[] = [];

    // Check argument count
    const requiredParams = functionSymbol.parameters.filter(p => !p.optional).length;
    const totalParams = functionSymbol.parameters.length;

    if (args.length < requiredParams || args.length > totalParams) {
      const expectedStr =
        requiredParams === totalParams
          ? `${requiredParams}`
          : `${requiredParams} to ${totalParams}`;

      errors.push({
        errorType: 'TypeMismatch',
        message: `Function '${functionSymbol.name}' expects ${expectedStr} arguments, got ${args.length}`,
        location,
        suggestions: [
          `Provide ${expectedStr} arguments to match function signature`,
          `Check '${functionSymbol.name}' function declaration for required parameters`,
        ],
      });
      return { success: false, errors };
    }

    // Check each argument type
    for (let i = 0; i < args.length; i++) {
      const expectedType = functionSymbol.parameters[i].type;

      // Get argument type
      const argTypeResult = this.typeChecker.checkExpressionType(args[i]);
      if (!argTypeResult.success) {
        errors.push(
          ...argTypeResult.errors.map(error => ({
            ...error,
            message: `Argument ${i + 1} error: ${error.message}`,
          }))
        );
        continue;
      }

      const actualType = argTypeResult.data;

      // Check type compatibility
      const compatibilityResult = this.typeChecker.checkAssignmentCompatibility(
        expectedType,
        actualType,
        location
      );

      if (!compatibilityResult.success) {
        errors.push({
          errorType: 'TypeMismatch',
          message: `Argument ${i + 1} to function '${functionSymbol.name}' has type ${typeToString(actualType)}, expected ${typeToString(expectedType)}`,
          location,
          suggestions: [
            'Check argument type matches parameter type',
            'Use explicit type conversion if needed',
            'Verify function signature and call arguments',
          ],
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    // Return the function's return type
    return { success: true, data: functionSymbol.returnType };
  }

  /**
   * Validate callback function call through callback variable.
   */
  validateCallbackCall(
    callbackVariable: VariableSymbol,
    args: Expression[],
    location: { line: number; column: number; offset: number }
  ): SemanticResult<Blend65Type> {
    const errors: SemanticError[] = [];

    // Variable must have callback type
    if (!isCallbackType(callbackVariable.varType)) {
      errors.push({
        errorType: 'CallbackMismatch',
        message: `Cannot call variable '${callbackVariable.name}' of type ${typeToString(callbackVariable.varType)} as function`,
        location,
        suggestions: [
          'Use a callback variable for indirect function calls',
          'Call the function directly by name',
          'Check variable type declaration',
        ],
      });
      return { success: false, errors };
    }

    const callbackType = callbackVariable.varType as any;

    // Check argument count
    if (args.length !== callbackType.parameterTypes.length) {
      errors.push({
        errorType: 'TypeMismatch',
        message: `Callback call expects ${callbackType.parameterTypes.length} arguments, got ${args.length}`,
        location,
        suggestions: [
          `Provide exactly ${callbackType.parameterTypes.length} arguments`,
          'Check callback type signature',
        ],
      });
      return { success: false, errors };
    }

    // Check argument types
    for (let i = 0; i < args.length; i++) {
      const expectedType = callbackType.parameterTypes[i];

      const argTypeResult = this.typeChecker.checkExpressionType(args[i]);
      if (!argTypeResult.success) {
        errors.push(...argTypeResult.errors);
        continue;
      }

      const actualType = argTypeResult.data;

      const compatibilityResult = this.typeChecker.checkAssignmentCompatibility(
        expectedType,
        actualType,
        location
      );

      if (!compatibilityResult.success) {
        errors.push({
          errorType: 'CallbackMismatch',
          message: `Callback argument ${i + 1} has type ${typeToString(actualType)}, expected ${typeToString(expectedType)}`,
          location,
          suggestions: [
            'Ensure callback argument types match signature',
            'Check callback variable type declaration',
          ],
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: callbackType.returnType };
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  /**
   * Check for duplicate function declarations in current scope.
   */
  private checkDuplicateFunctionDeclaration(
    functionName: string,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const existingSymbol = this.symbolTable.lookupSymbolInScope(
      functionName,
      this.symbolTable.getCurrentScope()
    );

    if (existingSymbol) {
      const symbolType = existingSymbol.symbolType;
      const error: SemanticError = {
        errorType: 'DuplicateSymbol',
        message: `Function '${functionName}' is already declared as ${symbolType.toLowerCase()} in this scope`,
        location,
        suggestions: [
          `Use a different function name`,
          `Remove duplicate declaration`,
          `Check for naming conflicts with variables or other functions`,
        ],
      };
      return { success: false, errors: [error] };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate callback function specific restrictions.
   */
  private validateCallbackFunctionDeclaration(
    signature: FunctionSignature,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const errors: SemanticError[] = [];

    // Callback functions should not have too many parameters (6502 limitation)
    if (signature.parameters.length > 4) {
      errors.push({
        errorType: 'CallbackMismatch',
        message: `Callback function has ${signature.parameters.length} parameters. Callback functions should have 4 or fewer parameters for 6502 efficiency.`,
        location,
        suggestions: [
          'Reduce the number of parameters',
          'Use a regular function if many parameters are needed',
          'Consider passing data through global variables',
        ],
      });
    }

    // Check parameter types for 6502 suitability
    for (let i = 0; i < signature.parameters.length; i++) {
      const param = signature.parameters[i];

      // Complex types not ideal for callbacks
      if (
        !isPrimitiveType(param.type) ||
        (param.type.name !== 'byte' && param.type.name !== 'word' && param.type.name !== 'boolean')
      ) {
        errors.push({
          errorType: 'CallbackMismatch',
          message: `Callback parameter '${param.name}' has type ${typeToString(param.type)}. Callback functions should use simple types (byte, word, boolean) for 6502 efficiency.`,
          location,
          suggestions: [
            'Use byte, word, or boolean types in callback functions',
            'Pass complex data through global variables',
            'Consider using a regular function for complex signatures',
          ],
        });
      }
    }

    // Check return type for 6502 suitability
    if (!isPrimitiveType(signature.returnType)) {
      errors.push({
        errorType: 'CallbackMismatch',
        message: `Callback function return type ${typeToString(signature.returnType)} is not suitable. Callback functions should return simple types (void, byte, word, boolean).`,
        location,
        suggestions: [
          'Use void, byte, word, or boolean return types',
          'Return complex data through global variables',
          'Consider using a regular function for complex return types',
        ],
      });
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: undefined };
  }

  /**
   * Validate parameter names for uniqueness.
   */
  private validateParameterNames(
    parameters: Parameter[],
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const parameterNames = new Set<string>();
    const errors: SemanticError[] = [];

    for (const param of parameters) {
      if (parameterNames.has(param.name)) {
        errors.push({
          errorType: 'DuplicateSymbol',
          message: `Parameter name '${param.name}' is used multiple times in function signature`,
          location,
          suggestions: ['Use unique parameter names', 'Check for typos in parameter names'],
        });
      } else {
        parameterNames.add(param.name);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: undefined };
  }

  /**
   * Perform additional function-level validations.
   */
  private performAdditionalValidations(
    funcDecl: FunctionDeclaration,
    signature: FunctionSignature,
    currentScope: ScopeType,
    location: { line: number; column: number; offset: number }
  ): SemanticResult<void> {
    const errors: SemanticError[] = [];

    // Check function naming conventions
    if (funcDecl.name.length === 0) {
      errors.push({
        errorType: 'InvalidOperation',
        message: 'Function name cannot be empty',
        location,
        suggestions: ['Provide a valid function name'],
      });
    }

    // Validate export at module scope
    if (funcDecl.exported && currentScope !== 'Global') {
      errors.push({
        errorType: 'InvalidScope',
        message: 'Functions can only be exported at module scope',
        location,
        suggestions: [
          'Remove export modifier for nested functions',
          'Move function to module level to export it',
        ],
      });
    }

    // Check for reserved function names
    const reservedNames = ['main', 'init', 'interrupt'];
    if (reservedNames.includes(funcDecl.name.toLowerCase())) {
      // This is a warning, not an error
      // We could add warnings to SemanticResult if needed
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: undefined };
  }

  // ============================================================================
  // TASK 1.9: FUNCTION OPTIMIZATION METADATA COLLECTION
  // ============================================================================

  /**
   * Collect comprehensive function call metadata from expression analysis results.
   * Integrates with Task 1.7 ExpressionAnalyzer function call tracking.
   *
   * Educational Note:
   * - Function call metadata drives inlining and call optimization decisions
   * - Call site analysis identifies hot paths and optimization opportunities
   * - Integration with expression analyzer provides complete call information
   */
  collectFunctionCallMetadata(
    functions: FunctionSymbol[],
    expressionResults?: any[] // Integration point with Task 1.7 ExpressionAnalyzer results
  ): Map<string, any> {
    const callMetadata = new Map<string, any>();

    for (const func of functions) {
      // Basic call statistics (will be enhanced with actual call site data)
      const callStats = {
        callCount: 0,
        directCallCount: 0,
        indirectCallCount: 0,
        callSites: [],
        callFrequency: 'never' as const,
        hotPathCalls: 0,
        loopCalls: [],
        callContexts: [],
      };

      // TODO: Integrate with Task 1.7 ExpressionAnalyzer results when available
      // This would extract actual function call information from expression analysis

      callMetadata.set(func.name, callStats);
    }

    return callMetadata;
  }

  /**
   * Analyze functions for inlining candidates based on size, complexity, and call patterns.
   *
   * Educational Note:
   * - Small, frequently called functions are prime inlining candidates
   * - Function complexity affects inlining decision (simple logic preferred)
   * - Call frequency and hot path analysis determine inlining priority
   * - 6502 code size constraints limit aggressive inlining
   */
  analyzeFunctionInliningCandidates(functions: FunctionSymbol[]): any[] {
    const inliningCandidates: any[] = [];

    for (const func of functions) {
      const candidate = this.analyzeFunctionInlining(func);
      if (candidate.isCandidate) {
        inliningCandidates.push(candidate);
      }
    }

    // Sort by inlining score (highest first)
    inliningCandidates.sort((a, b) => b.inliningScore - a.inliningScore);

    return inliningCandidates;
  }

  /**
   * Analyze callback function optimization opportunities.
   *
   * Educational Note:
   * - Callback functions have unique optimization challenges (indirect calls)
   * - Interrupt handlers require special timing and register preservation
   * - Function pointer dispatch can be optimized with jump tables
   * - 6502 indirect calls have higher overhead than direct calls
   */
  analyzeCallbackOptimization(functions: FunctionSymbol[]): any[] {
    const callbackOptimizations: any[] = [];

    for (const func of functions) {
      if (func.isCallback) {
        const optimization = this.analyzeCallbackFunction(func);
        callbackOptimizations.push(optimization);
      }
    }

    return callbackOptimizations;
  }

  /**
   * Analyze function call optimization opportunities.
   *
   * Educational Note:
   * - Parameter passing optimization reduces call overhead
   * - Register allocation coordination between caller and callee
   * - Stack usage optimization for 6502 limited stack space
   * - Calling convention optimization for performance
   */
  analyzeFunctionCallOptimization(functions: FunctionSymbol[], callSites?: any[]): any {
    const callOptimizations: any[] = [];

    for (const func of functions) {
      const optimization = this.analyzeFunctionCallConvention(func);
      callOptimizations.push(optimization);
    }

    return {
      optimizations: callOptimizations,
      globalOptimizations: this.analyzeGlobalCallOptimizations(functions),
    };
  }

  /**
   * Build comprehensive function optimization metadata for a function.
   *
   * Educational Note:
   * - Combines all optimization analyses into actionable metadata
   * - Provides prioritized optimization recommendations
   * - Includes 6502-specific performance characteristics
   * - Enables data-driven optimization decisions in code generation
   */
  buildFunctionOptimizationMetadata(
    functionSymbol: FunctionSymbol,
    callData?: any,
    expressionResults?: any[]
  ): any {
    // Collect call statistics
    const callStatistics = this.buildCallStatistics(functionSymbol, callData);

    // Analyze inlining potential
    const inliningCandidate = this.analyzeFunctionInlining(functionSymbol);

    // Analyze call optimization
    const callOptimization = this.analyzeFunctionCallConvention(functionSymbol);

    // Analyze callback optimization (if applicable)
    const callbackOptimization = functionSymbol.isCallback
      ? this.analyzeCallbackFunction(functionSymbol)
      : this.createDefaultCallbackOptimization();

    // Generate 6502-specific hints
    const sixtyTwoHints = this.generate6502OptimizationHints(functionSymbol);

    // Create performance profile
    const performanceProfile = this.createFunctionPerformanceProfile(functionSymbol);

    return {
      callStatistics,
      inliningCandidate,
      callOptimization,
      callbackOptimization,
      sixtyTwoHints,
      performanceProfile,
    };
  }

  // ============================================================================
  // PRIVATE OPTIMIZATION ANALYSIS METHODS
  // ============================================================================

  /**
   * Analyze individual function for inlining potential.
   */
  private analyzeFunctionInlining(func: FunctionSymbol): any {
    const complexityMetrics = this.calculateFunctionComplexity(func);

    // Calculate inlining score based on multiple factors
    let score = 0;
    const inliningFactors: any[] = [];
    const antiInliningFactors: any[] = [];

    // Small function bonus
    if (complexityMetrics.estimatedCodeSize < 20) {
      score += 30;
      inliningFactors.push({
        factor: 'small_function',
        weight: 30,
        description: `Function estimated at ${complexityMetrics.estimatedCodeSize} bytes (small enough for inlining)`,
      });
    }

    // Simple logic bonus
    if (complexityMetrics.cyclomaticComplexity <= 2) {
      score += 20;
      inliningFactors.push({
        factor: 'simple_logic',
        weight: 20,
        description: `Low cyclomatic complexity (${complexityMetrics.cyclomaticComplexity})`,
      });
    }

    // Few parameters bonus
    if (func.parameters.length <= 2) {
      score += 15;
      inliningFactors.push({
        factor: 'few_parameters',
        weight: 15,
        description: `Few parameters (${func.parameters.length} ≤ 2)`,
      });
    }

    // Single return bonus
    if (complexityMetrics.returnStatementCount === 1) {
      score += 10;
      inliningFactors.push({
        factor: 'single_return',
        weight: 10,
        description: 'Function has single return point',
      });
    }

    // Penalties - Apply stronger penalties for blockers
    if (complexityMetrics.estimatedCodeSize > 30) {
      // Lower threshold for large function
      score -= 60; // Stronger penalty
      antiInliningFactors.push({
        factor: 'large_function',
        weight: 60,
        description: `Function too large (${complexityMetrics.estimatedCodeSize} > 30 bytes)`,
      });
    }

    if (func.parameters.length > 4) {
      // Penalty for too many parameters
      score -= 50;
      antiInliningFactors.push({
        factor: 'many_parameters',
        weight: 50,
        description: `Too many parameters (${func.parameters.length} > 4)`,
      });
    }

    if (func.isCallback) {
      score -= 100; // Very strong penalty - callbacks should never be inlined
      antiInliningFactors.push({
        factor: 'callback_function',
        weight: 100,
        description: 'Callback function needs address (cannot be inlined)',
      });
    }

    if (func.isExported) {
      score -= 30;
      antiInliningFactors.push({
        factor: 'exported_function',
        weight: 30,
        description: 'Exported function has external visibility requirements',
      });
    }

    // Determine recommendation
    let recommendation: any;
    if (score >= 40) {
      recommendation = 'strongly_recommended';
    } else if (score >= 20) {
      recommendation = 'recommended';
    } else if (score >= 0) {
      recommendation = 'conditional';
    } else if (score >= -30) {
      recommendation = 'not_recommended';
    } else {
      recommendation = 'strongly_discouraged';
    }

    return {
      isCandidate: score > 0,
      inliningScore: Math.max(0, score),
      estimatedBenefit: Math.max(0, score * 2), // Estimated cycle savings
      estimatedCost: complexityMetrics.estimatedCodeSize,
      complexityMetrics,
      inliningFactors,
      antiInliningFactors,
      recommendation,
      highValueCallSites: [], // Will be populated with actual call site analysis
    };
  }

  /**
   * Analyze callback function for optimization opportunities.
   */
  private analyzeCallbackFunction(func: FunctionSymbol): any {
    const usagePatterns: any[] = [];
    const optimizationOpportunities: any[] = [];

    // Analyze callback usage patterns
    if (func.parameters.length === 0) {
      usagePatterns.push({
        pattern: 'single_assignment',
        frequency: 1,
        performance: 'medium' as const,
      });
    }

    // Generate optimization opportunities
    if (func.parameters.length <= 1 && func.returnType.kind === 'primitive') {
      optimizationOpportunities.push({
        opportunity: 'register_optimization',
        benefit: 5,
        applicability: 'always' as const,
        description: 'Simple callback can use registers for parameters and return',
      });
    }

    const performanceAnalysis = {
      indirectCallOverhead: 8, // Estimated additional cycles for indirect call
      setupCost: 3, // Cycles to set up function pointer
      benefitsFromOptimization: true,
      bottlenecks: [
        {
          bottleneck: 'indirect_call_overhead' as const,
          impact: 'medium' as const,
          description: 'Indirect calls have 8+ cycle overhead vs direct calls',
        },
      ],
    };

    return {
      isCallbackFunction: true,
      callbackUsage: usagePatterns,
      performanceAnalysis,
      optimizationOpportunities,
      interruptOptimization: this.analyzeInterruptOptimization(func),
    };
  }

  /**
   * Analyze function calling convention optimization.
   */
  private analyzeFunctionCallConvention(func: FunctionSymbol): any {
    const parameterOptimization = this.analyzeParameterPassing(func);
    const returnOptimization = this.analyzeReturnOptimization(func);
    const registerOptimization = this.analyzeFunctionRegisterUsage(func);
    const stackOptimization = this.analyzeStackUsage(func);
    const callConventionOptimization = this.analyzeCallingConvention(func);

    return {
      parameterOptimization,
      returnOptimization,
      registerOptimization,
      stackOptimization,
      callConventionOptimization,
    };
  }

  /**
   * Calculate function complexity metrics.
   */
  private calculateFunctionComplexity(func: FunctionSymbol): any {
    // TODO: This would analyze the function body AST when available
    // For now, provide estimates based on function signature

    const baseSize = 10; // Base function overhead
    const parameterSize = func.parameters.length * 3; // Estimated parameter handling
    const returnSize =
      func.returnType.kind !== 'primitive' || func.returnType.name !== 'void' ? 5 : 0;

    return {
      astNodeCount: 10 + func.parameters.length * 2, // Estimate
      estimatedCodeSize: baseSize + parameterSize + returnSize,
      localVariableCount: 0, // Would be calculated from function body
      internalCallCount: 0, // Would be calculated from function body
      maxNestingDepth: 1, // Default estimate
      returnStatementCount: 1, // Default estimate
      hasLoops: false, // Would be determined from AST analysis
      hasComplexControlFlow: false, // Would be determined from AST analysis
      cyclomaticComplexity: 1, // Basic complexity
    };
  }

  /**
   * Build call statistics for a function.
   */
  private buildCallStatistics(func: FunctionSymbol, callData?: any): any {
    // TODO: Integrate with actual call site analysis
    return {
      callCount: 0,
      directCallCount: 0,
      indirectCallCount: 0,
      callSites: [],
      callFrequency: 'never' as const,
      hotPathCalls: 0,
      loopCalls: [],
      callContexts: [],
    };
  }

  /**
   * Generate 6502-specific optimization hints.
   */
  private generate6502OptimizationHints(func: FunctionSymbol): any {
    const zeroPageOptimization = {
      benefitsFromZeroPage: func.parameters.length <= 2,
      zeroPageLocalVariables: [],
      zeroPageParameters: func.parameters.length <= 2 ? func.parameters.map(p => p.name) : [],
      estimatedBenefit: func.parameters.length <= 2 ? 5 : 0,
    };

    const registerStrategy = {
      strategy: 'balanced' as const,
      registerAssignments: this.generateRegisterAssignments(func),
      registerPressure: {
        overallPressure: 'low' as const,
        pressurePoints: [],
        needsSpilling: false,
        spillingCost: 0,
      },
    };

    const memoryLayout = {
      codeSection: 'hot_code' as const,
      localVariableLayout: {
        strategy: 'register_based' as const,
        variableGroups: [],
        stackFrameOptimization: {
          canOptimize: true,
          sizeReduction: 4,
          strategies: ['eliminate_frame_pointer' as const],
        },
      },
      alignmentPreference: {
        requiredAlignment: 1,
        preferredAlignment: 1,
        preferPageAlignment: false,
        reason: 'none' as const,
      },
    };

    const performanceCharacteristics = {
      executionFrequency: 'occasional' as const,
      hotspots: [],
      criticalPath: {
        isOnCriticalPath: false,
        criticalPathPercentage: 0,
        criticalOperations: [],
      },
      bottlenecks: [],
      optimizationPotential: {
        overallScore: 50,
        potentialOptimizations: [],
        estimatedTotalBenefit: 10,
        implementationComplexity: 'moderate' as const,
      },
    };

    const optimizationOpportunities = [
      {
        opportunity: 'register_optimization' as const,
        benefit: 5,
        complexity: 'simple' as const,
        description: 'Optimize register usage for parameters and return values',
      },
    ];

    return {
      zeroPageOptimization,
      registerStrategy,
      memoryLayout,
      performanceCharacteristics,
      optimizationOpportunities,
    };
  }

  /**
   * Create default callback optimization for non-callback functions.
   */
  private createDefaultCallbackOptimization(): any {
    return {
      isCallbackFunction: false,
      callbackUsage: [],
      performanceAnalysis: {
        indirectCallOverhead: 0,
        setupCost: 0,
        benefitsFromOptimization: false,
        bottlenecks: [],
      },
      optimizationOpportunities: [],
    };
  }

  /**
   * Create function performance profile.
   */
  private createFunctionPerformanceProfile(func: FunctionSymbol): any {
    // Calculate performance based on function characteristics
    const baseCycles = 8; // Minimum function call overhead
    const parameterCycles = func.parameters.length * 3; // Parameter passing cost
    const callbackPenalty = func.isCallback ? 8 : 0; // Indirect call overhead
    const complexityPenalty = func.parameters.length > 3 ? func.parameters.length * 2 : 0;

    const totalCycles = baseCycles + parameterCycles + callbackPenalty + complexityPenalty;

    const executionStats = {
      estimatedCycles: totalCycles,
      callFrequency: 'occasional' as const,
      executionTimeDistribution: {
        minimum: Math.max(6, totalCycles - 4),
        maximum: totalCycles + 8,
        average: totalCycles,
        standardDeviation: 3,
      },
      performanceVariability: {
        variability: 'low' as const,
        causes: [],
      },
    };

    // Stack usage varies with parameter count
    const stackDepth = 4 + func.parameters.length * 2;

    const resourceUsage = {
      registerUsage: {
        registersUsed: [],
        registerPressure: func.parameters.length > 2 ? ('medium' as const) : ('low' as const),
        registerConflicts: [],
      },
      memoryUsage: {
        totalMemoryUsed: 20 + func.parameters.length * 4,
        memoryBreakdown: [],
        accessPatterns: [],
      },
      stackUsage: {
        maxStackDepth: stackDepth,
        stackBreakdown: [],
        stackEfficiency: stackDepth < 10 ? ('good' as const) : ('acceptable' as const),
      },
      zeroPageUsage: {
        zeroPageBytesUsed: 0,
        zeroPageEfficiency: 'optimal' as const,
        zeroPageAllocations: [],
      },
    };

    const performanceMetrics = {
      cyclesPerCall: totalCycles,
      instructionsPerCall: Math.max(6, totalCycles / 2),
      memoryAccessesPerCall: 3 + func.parameters.length,
      branchInstructionsPerCall: 1,
      efficiencyRating: totalCycles < 15 ? ('good' as const) : ('acceptable' as const),
    };

    const optimizationRecommendations = [
      {
        recommendation: 'optimize_registers' as const,
        priority: func.parameters.length > 2 ? ('high' as const) : ('medium' as const),
        estimatedBenefit: Math.max(2, func.parameters.length),
        implementationEffort: 'low' as const,
        description: 'Optimize register allocation for parameters',
      },
    ];

    return {
      executionStats,
      resourceUsage,
      performanceMetrics,
      optimizationRecommendations,
    };
  }

  // Additional helper methods
  private analyzeParameterPassing(func: FunctionSymbol): any {
    const registerParameters: any[] = [];
    const stackParameters: any[] = [];

    // Simple heuristic: first 2 byte parameters can go in registers
    for (let i = 0; i < func.parameters.length; i++) {
      const param = func.parameters[i];
      if (i < 2 && param.type.kind === 'primitive' && param.type.name === 'byte') {
        registerParameters.push({
          parameterName: param.name,
          parameterType: param.type,
          preferredRegister: i === 0 ? 'A' : 'X',
          passingCost: 2,
        });
      } else {
        stackParameters.push({
          parameterName: param.name,
          parameterType: param.type,
          stackOffset: i * 2,
          passingCost: 5,
        });
      }
    }

    const totalCycles = registerParameters.length * 2 + stackParameters.length * 5;

    return {
      parameterCount: func.parameters.length,
      registerParameters,
      stackParameters,
      passingCost: {
        totalCycles,
        costBreakdown: [],
        isEfficient: totalCycles < 10,
        optimizationSuggestions: [],
      },
      optimizationOpportunities: [],
    };
  }

  private analyzeReturnOptimization(func: FunctionSymbol): any {
    let returnMethod: any = 'void';
    let returnCost = 0;

    if (func.returnType.kind === 'primitive') {
      switch (func.returnType.name) {
        case 'byte':
          returnMethod = 'register_A';
          returnCost = 1;
          break;
        case 'word':
          returnMethod = 'register_AX';
          returnCost = 2;
          break;
        case 'boolean':
          returnMethod = 'register_A';
          returnCost = 1;
          break;
      }
    }

    return {
      returnType: func.returnType,
      returnMethod,
      returnCost,
      canOptimize: returnCost > 0,
      optimizationOpportunities: [],
    };
  }

  private analyzeFunctionRegisterUsage(func: FunctionSymbol): any {
    return {
      registersUsed: ['A'],
      registersToPreserve: [],
      registerConflicts: [],
      optimizationOpportunities: [],
    };
  }

  private analyzeStackUsage(func: FunctionSymbol): any {
    const stackSpaceRequired = func.parameters.length * 2 + 2; // Parameters + return address

    return {
      stackSpaceRequired,
      stackUsageBreakdown: [],
      isStackUsageEfficient: stackSpaceRequired < 10,
      optimizationOpportunities: [],
    };
  }

  private analyzeCallingConvention(func: FunctionSymbol): any {
    return {
      followsStandardConvention: true,
      optimizedConvention: 'standard' as const,
      optimizationBenefits: [],
      constraints: [],
    };
  }

  private analyzeInterruptOptimization(func: FunctionSymbol): any {
    if (!func.isCallback) return undefined;

    return {
      interruptType: 'timer' as const,
      interruptFrequency: 'frequent' as const,
      registerPreservation: {
        registersToPreserve: ['A', 'X', 'Y'],
        modifiableRegisters: [],
        preservationCost: 12,
      },
      timingConstraints: {
        maxExecutionTime: 100,
        isCriticalTiming: true,
        jitterTolerance: 5,
        realTimeRequirements: [],
      },
      optimizations: [],
    };
  }

  private generateRegisterAssignments(func: FunctionSymbol): any[] {
    const assignments: any[] = [];

    // Assign first parameter to A register
    if (func.parameters.length > 0) {
      assignments.push({
        register: 'A',
        purpose: 'parameter' as const,
        variable: func.parameters[0].name,
        benefit: 5,
      });
    }

    return assignments;
  }

  private analyzeGlobalCallOptimizations(functions: FunctionSymbol[]): any {
    return {
      crossFunctionOptimizations: [],
      globalRegisterAllocation: [],
      callGraphOptimizations: [],
    };
  }

  /**
   * Get comprehensive analysis statistics for debugging and reporting.
   * Enhanced for Task 1.9 with optimization metadata tracking.
   */
  getAnalysisStatistics(): {
    functionsAnalyzed: number;
    callbackFunctions: number;
    exportedFunctions: number;
    averageParameterCount: number;
    functionsByReturnType: Record<string, number>;
    errorsDetected: number;
    optimizationCandidates: number;
    inliningCandidates: number;
  } {
    // Get all function symbols from symbol table
    const functions: FunctionSymbol[] = [];
    const collectFunctions = (scope: any): void => {
      for (const [_, symbol] of scope.symbols) {
        if (symbol.symbolType === 'Function') {
          functions.push(symbol as FunctionSymbol);
        }
      }
      for (const child of scope.children) {
        collectFunctions(child);
      }
    };
    collectFunctions(this.symbolTable.getGlobalScope());

    let callbackFunctions = 0;
    let exportedFunctions = 0;
    let totalParameters = 0;
    let optimizationCandidates = 0;
    let inliningCandidates = 0;
    const functionsByReturnType: Record<string, number> = {};

    for (const func of functions) {
      if (func.isCallback) {
        callbackFunctions++;
      }
      if (func.isExported) {
        exportedFunctions++;
      }
      totalParameters += func.parameters.length;

      const returnTypeName = typeToString(func.returnType);
      functionsByReturnType[returnTypeName] = (functionsByReturnType[returnTypeName] || 0) + 1;

      // Check optimization potential
      const inlining = this.analyzeFunctionInlining(func);
      if (inlining.isCandidate) {
        inliningCandidates++;
      }
      if (inlining.inliningScore > 0 || func.parameters.length <= 2) {
        optimizationCandidates++;
      }
    }

    return {
      functionsAnalyzed: functions.length,
      callbackFunctions,
      exportedFunctions,
      averageParameterCount: functions.length > 0 ? totalParameters / functions.length : 0,
      functionsByReturnType,
      errorsDetected: 0, // Updated during analysis
      optimizationCandidates,
      inliningCandidates,
    };
  }
}

/**
 * Convenience function to create and use a function analyzer.
 */
export function analyzeFunctionDeclaration(
  funcDecl: FunctionDeclaration,
  symbolTable: SymbolTable,
  typeChecker: TypeChecker,
  currentScope: ScopeType
): SemanticResult<FunctionSymbol> {
  const analyzer = new FunctionAnalyzer(symbolTable, typeChecker);
  return analyzer.analyzeFunctionDeclaration(funcDecl, currentScope);
}

/**
 * Convenience function for callback assignment validation.
 */
export function validateCallbackAssignment(
  targetType: Blend65Type,
  sourceFunction: FunctionSymbol,
  symbolTable: SymbolTable,
  typeChecker: TypeChecker,
  location: { line: number; column: number; offset: number }
): SemanticResult<void> {
  const analyzer = new FunctionAnalyzer(symbolTable, typeChecker);
  return analyzer.validateCallbackAssignment(targetType, sourceFunction, location);
}

/**
 * Convenience function for function call validation.
 */
export function validateFunctionCall(
  functionSymbol: FunctionSymbol,
  args: Expression[],
  symbolTable: SymbolTable,
  typeChecker: TypeChecker,
  location: { line: number; column: number; offset: number }
): SemanticResult<Blend65Type> {
  const analyzer = new FunctionAnalyzer(symbolTable, typeChecker);
  return analyzer.validateFunctionCall(functionSymbol, args, location);
}
