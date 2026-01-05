/**
 * Intermediate Language (IL) Type System for Blend65
 * Task 2.1: Create IL Type System
 *
 * This file defines the core types for Blend65's Intermediate Language (IL).
 * The IL serves as an optimization-friendly representation between the AST
 * and target 6502 assembly code.
 *
 * Key Design Principles:
 * - Close to AST structure for easy transformation
 * - 6502-aware for efficient code generation
 * - Optimization-friendly with mutable instruction sequences
 * - Rich metadata integration from semantic analysis
 * - Support for multiple optimization passes
 *
 * Educational Focus:
 * - How compilers represent programs for optimization
 * - Intermediate representations in compiler design
 * - 6502-specific optimization considerations
 * - Integration between semantic analysis and code generation
 */
/**
 * All supported IL instruction types.
 * These map closely to 6502 operations and Blend65 language constructs.
 */
export var ILInstructionType;
(function (ILInstructionType) {
    // ============================================================================
    // MEMORY OPERATIONS
    // ============================================================================
    /** Load immediate value: LOAD_IMMEDIATE <dest> <value> */
    ILInstructionType["LOAD_IMMEDIATE"] = "LOAD_IMMEDIATE";
    /** Load from memory: LOAD_MEMORY <dest> <address> */
    ILInstructionType["LOAD_MEMORY"] = "LOAD_MEMORY";
    /** Store to memory: STORE_MEMORY <address> <value> */
    ILInstructionType["STORE_MEMORY"] = "STORE_MEMORY";
    /** Copy value: COPY <dest> <source> */
    ILInstructionType["COPY"] = "COPY";
    // ============================================================================
    // ARITHMETIC OPERATIONS
    // ============================================================================
    /** Add: ADD <dest> <left> <right> */
    ILInstructionType["ADD"] = "ADD";
    /** Subtract: SUB <dest> <left> <right> */
    ILInstructionType["SUB"] = "SUB";
    /** Multiply: MUL <dest> <left> <right> */
    ILInstructionType["MUL"] = "MUL";
    /** Divide: DIV <dest> <left> <right> */
    ILInstructionType["DIV"] = "DIV";
    /** Modulo: MOD <dest> <left> <right> */
    ILInstructionType["MOD"] = "MOD";
    /** Negate: NEG <dest> <source> */
    ILInstructionType["NEG"] = "NEG";
    // ============================================================================
    // LOGICAL OPERATIONS
    // ============================================================================
    /** Logical AND: AND <dest> <left> <right> */
    ILInstructionType["AND"] = "AND";
    /** Logical OR: OR <dest> <left> <right> */
    ILInstructionType["OR"] = "OR";
    /** Logical NOT: NOT <dest> <source> */
    ILInstructionType["NOT"] = "NOT";
    // ============================================================================
    // BITWISE OPERATIONS
    // ============================================================================
    /** Bitwise AND: BITWISE_AND <dest> <left> <right> */
    ILInstructionType["BITWISE_AND"] = "BITWISE_AND";
    /** Bitwise OR: BITWISE_OR <dest> <left> <right> */
    ILInstructionType["BITWISE_OR"] = "BITWISE_OR";
    /** Bitwise XOR: BITWISE_XOR <dest> <left> <right> */
    ILInstructionType["BITWISE_XOR"] = "BITWISE_XOR";
    /** Bitwise NOT: BITWISE_NOT <dest> <source> */
    ILInstructionType["BITWISE_NOT"] = "BITWISE_NOT";
    /** Shift left: SHIFT_LEFT <dest> <source> <amount> */
    ILInstructionType["SHIFT_LEFT"] = "SHIFT_LEFT";
    /** Shift right: SHIFT_RIGHT <dest> <source> <amount> */
    ILInstructionType["SHIFT_RIGHT"] = "SHIFT_RIGHT";
    // ============================================================================
    // COMPARISON OPERATIONS
    // ============================================================================
    /** Compare equal: COMPARE_EQ <dest> <left> <right> */
    ILInstructionType["COMPARE_EQ"] = "COMPARE_EQ";
    /** Compare not equal: COMPARE_NE <dest> <left> <right> */
    ILInstructionType["COMPARE_NE"] = "COMPARE_NE";
    /** Compare less than: COMPARE_LT <dest> <left> <right> */
    ILInstructionType["COMPARE_LT"] = "COMPARE_LT";
    /** Compare less than or equal: COMPARE_LE <dest> <left> <right> */
    ILInstructionType["COMPARE_LE"] = "COMPARE_LE";
    /** Compare greater than: COMPARE_GT <dest> <left> <right> */
    ILInstructionType["COMPARE_GT"] = "COMPARE_GT";
    /** Compare greater than or equal: COMPARE_GE <dest> <left> <right> */
    ILInstructionType["COMPARE_GE"] = "COMPARE_GE";
    // ============================================================================
    // CONTROL FLOW OPERATIONS
    // ============================================================================
    /** Unconditional branch: BRANCH <target> */
    ILInstructionType["BRANCH"] = "BRANCH";
    /** Conditional branch if true: BRANCH_IF_TRUE <condition> <target> */
    ILInstructionType["BRANCH_IF_TRUE"] = "BRANCH_IF_TRUE";
    /** Conditional branch if false: BRANCH_IF_FALSE <condition> <target> */
    ILInstructionType["BRANCH_IF_FALSE"] = "BRANCH_IF_FALSE";
    /** Conditional branch if zero: BRANCH_IF_ZERO <value> <target> */
    ILInstructionType["BRANCH_IF_ZERO"] = "BRANCH_IF_ZERO";
    /** Conditional branch if not zero: BRANCH_IF_NOT_ZERO <value> <target> */
    ILInstructionType["BRANCH_IF_NOT_ZERO"] = "BRANCH_IF_NOT_ZERO";
    // ============================================================================
    // FUNCTION OPERATIONS
    // ============================================================================
    /** Function call: CALL <function> [args...] */
    ILInstructionType["CALL"] = "CALL";
    /** Return from function: RETURN [value] */
    ILInstructionType["RETURN"] = "RETURN";
    // ============================================================================
    // VARIABLE OPERATIONS
    // ============================================================================
    /** Declare local variable: DECLARE_LOCAL <variable> <type> */
    ILInstructionType["DECLARE_LOCAL"] = "DECLARE_LOCAL";
    /** Load variable: LOAD_VARIABLE <dest> <variable> */
    ILInstructionType["LOAD_VARIABLE"] = "LOAD_VARIABLE";
    /** Store variable: STORE_VARIABLE <variable> <value> */
    ILInstructionType["STORE_VARIABLE"] = "STORE_VARIABLE";
    // ============================================================================
    // ARRAY OPERATIONS
    // ============================================================================
    /** Load array element: LOAD_ARRAY <dest> <array> <index> */
    ILInstructionType["LOAD_ARRAY"] = "LOAD_ARRAY";
    /** Store array element: STORE_ARRAY <array> <index> <value> */
    ILInstructionType["STORE_ARRAY"] = "STORE_ARRAY";
    /** Calculate array address: ARRAY_ADDRESS <dest> <array> <index> */
    ILInstructionType["ARRAY_ADDRESS"] = "ARRAY_ADDRESS";
    // ============================================================================
    // UTILITY OPERATIONS
    // ============================================================================
    /** Label: LABEL <name> */
    ILInstructionType["LABEL"] = "LABEL";
    /** No operation: NOP */
    ILInstructionType["NOP"] = "NOP";
    /** Comment: COMMENT <text> */
    ILInstructionType["COMMENT"] = "COMMENT";
    // ============================================================================
    // 6502-SPECIFIC OPERATIONS
    // ============================================================================
    /** Register operation: REGISTER_OP <register> <operation> [operand] */
    ILInstructionType["REGISTER_OP"] = "REGISTER_OP";
    /** Hardware peek: PEEK <dest> <address> */
    ILInstructionType["PEEK"] = "PEEK";
    /** Hardware poke: POKE <address> <value> */
    ILInstructionType["POKE"] = "POKE";
    /** Set processor flags: SET_FLAGS <flags> */
    ILInstructionType["SET_FLAGS"] = "SET_FLAGS";
    /** Clear processor flags: CLEAR_FLAGS <flags> */
    ILInstructionType["CLEAR_FLAGS"] = "CLEAR_FLAGS";
})(ILInstructionType || (ILInstructionType = {}));
// ============================================================================
// TYPE GUARDS AND UTILITIES
// ============================================================================
/**
 * Type guard functions for IL values.
 */
export function isILConstant(value) {
    return value.valueType === 'constant';
}
export function isILVariable(value) {
    return value.valueType === 'variable';
}
export function isILRegister(value) {
    return value.valueType === 'register';
}
export function isILTemporary(value) {
    return value.valueType === 'temporary';
}
export function isILMemoryLocation(value) {
    return value.valueType === 'memory';
}
export function isILLabel(value) {
    return value.valueType === 'label';
}
/**
 * Type guard functions for IL operands.
 */
export function isILParameterReference(operand) {
    return operand.operandType === 'parameter';
}
export function isILReturnReference(operand) {
    return operand.operandType === 'return';
}
// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================
/**
 * Factory functions for creating IL values.
 */
export function createILConstant(type, value, representation = 'decimal') {
    return {
        valueType: 'constant',
        type,
        value,
        representation,
    };
}
export function createILVariable(name, type, qualifiedName = [], storageClass = null, scope = 'local') {
    return {
        valueType: 'variable',
        name,
        qualifiedName,
        type,
        storageClass,
        scope,
    };
}
export function createILRegister(register, type) {
    return {
        valueType: 'register',
        register,
        type,
    };
}
export function createILTemporary(id, type, scope = 'expression') {
    return {
        valueType: 'temporary',
        id,
        type,
        scope,
    };
}
export function createILLabel(name) {
    return {
        valueType: 'label',
        name,
    };
}
/**
 * Factory functions for creating IL instructions.
 */
export function createILInstruction(type, operands, id, options = {}) {
    return {
        type,
        operands,
        id,
        ...options,
    };
}
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Get a string representation of an IL value for debugging.
 */
export function ilValueToString(value) {
    switch (value.valueType) {
        case 'constant':
            switch (value.representation) {
                case 'hexadecimal':
                    return typeof value.value === 'number'
                        ? `$${value.value.toString(16).toUpperCase()}`
                        : String(value.value);
                case 'binary':
                    return typeof value.value === 'number'
                        ? `0b${value.value.toString(2)}`
                        : String(value.value);
                case 'character':
                    return `'${value.value}'`;
                case 'string':
                    return `"${value.value}"`;
                case 'boolean':
                    return String(value.value);
                default:
                    return String(value.value);
            }
        case 'variable':
            return value.qualifiedName.length > 0
                ? `${value.qualifiedName.join('.')}.${value.name}`
                : value.name;
        case 'register':
            return value.register;
        case 'temporary':
            return `temp_${value.id}`;
        case 'memory':
            return `[${ilValueToString(value.address)}]`;
        case 'label':
            return value.name;
        default:
            return 'unknown';
    }
}
/**
 * Get a string representation of an IL instruction for debugging.
 */
export function ilInstructionToString(instruction) {
    const operandStrs = instruction.operands
        .map(op => {
        if ('valueType' in op) {
            return ilValueToString(op);
        }
        else if ('operandType' in op) {
            const ref = op;
            return ref.operandType === 'parameter'
                ? `param_${ref.parameterIndex}`
                : 'return';
        }
        else {
            return String(op);
        }
    })
        .join(', ');
    const resultStr = instruction.result ? ` -> ${ilValueToString(instruction.result)}` : '';
    return `${instruction.type}(${operandStrs})${resultStr}`;
}
/**
 * Create a basic IL program structure.
 */
export function createILProgram(name) {
    return {
        name,
        modules: [],
        globalData: [],
        imports: [],
        exports: [],
        sourceInfo: {
            originalFiles: [],
            compilationTimestamp: new Date(),
            compilerVersion: '0.1.0',
            targetPlatform: 'c64',
        },
    };
}
/**
 * Create a basic IL module structure.
 */
export function createILModule(qualifiedName) {
    return {
        qualifiedName,
        functions: [],
        moduleData: [],
        exports: [],
        imports: [],
    };
}
/**
 * Create a basic IL function structure.
 */
export function createILFunction(name, qualifiedName, returnType, sourceLocation) {
    return {
        name,
        qualifiedName,
        parameters: [],
        returnType,
        localVariables: [],
        instructions: [],
        labels: new Map(),
        isCallback: false,
        isExported: false,
        sourceLocation,
    };
}
//# sourceMappingURL=il-types.js.map