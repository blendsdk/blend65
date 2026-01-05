/**
 * Type System AST Node Types for Blend65
 *
 * Defines Blend65's type system including:
 * - Primitive types (byte, word, boolean, void)
 * - Array types with fixed sizes
 * - Record types (struct-like)
 * - Storage class annotations
 * - Type annotations and constraints
 */
/**
 * Type utilities for compile-time type checking
 */
export var TypeUtils;
(function (TypeUtils) {
    /**
     * Check if a type is a primitive type
     */
    function isPrimitive(type) {
        return type.type === 'PrimitiveType';
    }
    TypeUtils.isPrimitive = isPrimitive;
    /**
     * Check if a type is an array type
     */
    function isArray(type) {
        return type.type === 'ArrayType';
    }
    TypeUtils.isArray = isArray;
    /**
     * Check if a type is a record type
     */
    function isRecord(type) {
        return type.type === 'RecordType';
    }
    TypeUtils.isRecord = isRecord;
    /**
     * Check if a type is storage-qualified
     */
    function hasStorageClass(type) {
        return type.type === 'StorageQualifiedType';
    }
    TypeUtils.hasStorageClass = hasStorageClass;
    /**
     * Get the base type, stripping storage qualifiers
     */
    function getBaseType(type) {
        if (hasStorageClass(type)) {
            return type.baseType;
        }
        return type;
    }
    TypeUtils.getBaseType = getBaseType;
    /**
     * Get storage class if present
     */
    function getStorageClass(type) {
        if (hasStorageClass(type)) {
            return type.storageClass;
        }
        return null;
    }
    TypeUtils.getStorageClass = getStorageClass;
})(TypeUtils || (TypeUtils = {}));
//# sourceMappingURL=types.js.map