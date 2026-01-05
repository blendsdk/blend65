/**
 * Semantic Analysis Infrastructure - Core Types and Interfaces
 * Task 1.1: Create Semantic Analysis Infrastructure
 *
 * This file defines the foundational types for the Blend65 semantic analyzer:
 * - Symbol system for tracking variables, functions, modules, types, enums
 * - Type system with Blend65's unique storage classes
 * - Scope hierarchy for lexical scoping
 * - Error reporting with rich source location information
 * - Type compatibility checking utilities
 *
 * Educational Focus:
 * - How compilers represent program symbols internally
 * - Type system design for 6502 development
 * - Lexical scoping and symbol resolution
 * - Compiler error reporting best practices
 */
// ============================================================================
// PHASE 5: UTILITY FUNCTIONS AND TYPE GUARDS
// ============================================================================
/**
 * Type guard functions for symbol types.
 * Enables safe type narrowing in TypeScript.
 */
export function isVariableSymbol(symbol) {
    return symbol.symbolType === 'Variable';
}
export function isFunctionSymbol(symbol) {
    return symbol.symbolType === 'Function';
}
export function isModuleSymbol(symbol) {
    return symbol.symbolType === 'Module';
}
export function isTypeSymbol(symbol) {
    return symbol.symbolType === 'Type';
}
export function isEnumSymbol(symbol) {
    return symbol.symbolType === 'Enum';
}
/**
 * Type guard functions for Blend65 types.
 */
export function isPrimitiveType(type) {
    return type.kind === 'primitive';
}
export function isArrayType(type) {
    return type.kind === 'array';
}
export function isNamedType(type) {
    return type.kind === 'named';
}
export function isCallbackType(type) {
    return type.kind === 'callback';
}
/**
 * Helper functions for creating common types.
 *
 * Educational Note:
 * - Factory functions provide consistent type creation
 * - Reduces boilerplate and potential errors
 * - Centralized type creation for easy modification
 */
export function createPrimitiveType(name) {
    return { kind: 'primitive', name };
}
export function createArrayType(elementType, size) {
    return { kind: 'array', elementType, size };
}
export function createNamedType(name) {
    return { kind: 'named', name };
}
export function createCallbackType(parameterTypes, returnType) {
    return { kind: 'callback', parameterTypes, returnType };
}
/**
 * Type compatibility checking functions.
 *
 * Educational Note:
 * - Assignment compatibility: can we assign source to target?
 * - Type equality: are two types exactly the same?
 * - Implicit conversion: can we automatically convert between types?
 */
/**
 * Check if a source type can be assigned to a target type.
 *
 * Rules:
 * - Same types are always compatible
 * - byte/word are NOT implicitly compatible (explicit in 6502 code)
 * - Arrays must have same element type and size
 * - Callbacks must have same signature
 * - Named types require resolution
 */
export function isAssignmentCompatible(target, source) {
    // Same type is always compatible
    if (areTypesEqual(target, source)) {
        return true;
    }
    // Primitive type compatibility
    if (isPrimitiveType(target) && isPrimitiveType(source)) {
        // byte and word are NOT implicitly compatible in Blend65
        // This forces explicit conversions, making 6502 code clearer
        return false;
    }
    // Array type compatibility
    if (isArrayType(target) && isArrayType(source)) {
        return (target.size === source.size && isAssignmentCompatible(target.elementType, source.elementType));
    }
    // Callback type compatibility
    if (isCallbackType(target) && isCallbackType(source)) {
        return areCallbackTypesCompatible(target, source);
    }
    // Named types require resolution (handled in semantic analyzer)
    if (isNamedType(target) || isNamedType(source)) {
        // This will be handled by the semantic analyzer after type resolution
        return false; // Conservative approach for now
    }
    return false;
}
/**
 * Check if two types are exactly equal.
 */
export function areTypesEqual(type1, type2) {
    if (type1.kind !== type2.kind) {
        return false;
    }
    switch (type1.kind) {
        case 'primitive':
            return type1.name === type2.name;
        case 'array':
            const array2 = type2;
            return type1.size === array2.size && areTypesEqual(type1.elementType, array2.elementType);
        case 'named':
            return type1.name === type2.name;
        case 'callback':
            return areCallbackTypesCompatible(type1, type2);
        default:
            return false;
    }
}
/**
 * Check if two callback types are compatible.
 * Callback types are compatible if they have the same signature.
 */
export function areCallbackTypesCompatible(callback1, callback2) {
    // Same return type
    if (!areTypesEqual(callback1.returnType, callback2.returnType)) {
        return false;
    }
    // Same number of parameters
    if (callback1.parameterTypes.length !== callback2.parameterTypes.length) {
        return false;
    }
    // All parameter types match
    for (let i = 0; i < callback1.parameterTypes.length; i++) {
        if (!areTypesEqual(callback1.parameterTypes[i], callback2.parameterTypes[i])) {
            return false;
        }
    }
    return true;
}
/**
 * Get a human-readable string representation of a type.
 * Useful for error messages and debugging.
 */
export function typeToString(type) {
    switch (type.kind) {
        case 'primitive':
            return type.name;
        case 'array':
            return `${typeToString(type.elementType)}[${type.size}]`;
        case 'named':
            return type.name;
        case 'callback':
            const params = type.parameterTypes.map(t => typeToString(t)).join(', ');
            const returnStr = type.returnType.kind === 'primitive' && type.returnType.name === 'void'
                ? ''
                : `: ${typeToString(type.returnType)}`;
            return `callback(${params})${returnStr}`;
        default:
            return 'unknown';
    }
}
/**
 * Validate storage class usage.
 * Different storage classes have different constraints.
 */
export function validateStorageClassUsage(storageClass, scope, hasInitializer) {
    // Storage classes only allowed at global/module scope
    if (scope === 'Function' || scope === 'Block') {
        return {
            success: false,
            errors: [
                {
                    errorType: 'InvalidStorageClass',
                    message: `Storage class '${storageClass}' not allowed in ${scope.toLowerCase()} scope. Storage classes are only valid for global variables.`,
                    location: { line: 0, column: 0, offset: 0 }, // Will be filled by caller
                    suggestions: [
                        'Remove the storage class to create a local variable',
                        'Move the variable declaration to module level to use storage classes',
                    ],
                },
            ],
        };
    }
    // 'const' and 'data' require initializers
    if ((storageClass === 'const' || storageClass === 'data') && !hasInitializer) {
        return {
            success: false,
            errors: [
                {
                    errorType: 'ConstantRequired',
                    message: `Variables with '${storageClass}' storage class must have an initializer.`,
                    location: { line: 0, column: 0, offset: 0 },
                    suggestions: [
                        `Add an initializer: var name: type = value`,
                        `Use 'ram' or 'zp' storage class for uninitialized variables`,
                    ],
                },
            ],
        };
    }
    // 'io' variables cannot have initializers
    if (storageClass === 'io' && hasInitializer) {
        return {
            success: false,
            errors: [
                {
                    errorType: 'InvalidStorageClass',
                    message: `Variables with 'io' storage class cannot have initializers. They represent memory-mapped hardware registers.`,
                    location: { line: 0, column: 0, offset: 0 },
                    suggestions: [
                        'Remove the initializer for io variables',
                        'Use a different storage class if you need initialization',
                    ],
                },
            ],
        };
    }
    return { success: true, data: undefined };
}
// ============================================================================
// SYMBOL CREATION HELPER FUNCTIONS
// ============================================================================
/**
 * Helper functions for creating symbols with proper defaults.
 * These will be used by the semantic analyzer to create symbols consistently.
 */
export function createVariableSymbol(name, varType, scope, location, options = {}) {
    return {
        name,
        symbolType: 'Variable',
        sourceLocation: location,
        scope,
        isExported: options.isExported ?? false,
        varType,
        storageClass: options.storageClass ?? null,
        initialValue: options.initialValue ?? null,
        isLocal: options.isLocal ?? false,
    };
}
export function createFunctionSymbol(name, parameters, returnType, scope, location, options = {}) {
    return {
        name,
        symbolType: 'Function',
        sourceLocation: location,
        scope,
        isExported: options.isExported ?? false,
        parameters,
        returnType,
        isCallback: options.isCallback ?? false,
    };
}
export function createModuleSymbol(name, qualifiedName, scope, location) {
    return {
        name,
        symbolType: 'Module',
        sourceLocation: location,
        scope,
        isExported: false, // Modules themselves are not exported
        qualifiedName,
        exports: new Map(),
        imports: new Map(),
    };
}
export function createScope(scopeType, parent = null, name) {
    return {
        scopeType,
        parent,
        symbols: new Map(),
        children: [],
        name,
    };
}
// ============================================================================
// EXPORTS FOR SEMANTIC ANALYZER
// ============================================================================
/**
 * Main exports for use by other packages.
 * This is the public API of the semantic analysis infrastructure.
 *
 * Note: All types are already exported individually where they are defined.
 * This section serves as documentation of the complete API.
 */
/**
 * Summary of what we've built:
 *
 * 1. Complete symbol system for all Blend65 constructs
 * 2. Rich type system with 6502-specific storage classes
 * 3. Hierarchical scope management for lexical scoping
 * 4. Comprehensive error reporting with source locations
 * 5. Type compatibility checking for safe operations
 * 6. Helper functions and factory methods for consistent usage
 *
 * This foundation enables:
 * - Task 1.2: Symbol table implementation
 * - Task 1.3: Type system implementation
 * - Task 1.4+: All semantic analysis phases
 * - Eventually: Complete compilation to 6502 assembly
 *
 * The educational journey continues with implementing the semantic analyzer
 * that uses these types to validate real Blend65 programs!
 */
//# sourceMappingURL=types.js.map