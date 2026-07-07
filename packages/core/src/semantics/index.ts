/**
 * Public barrel for the Blend65 semantic vocabulary.
 *
 * Re-exports the resolved type union and its utilities, the platform-profile
 * stub, the scope/symbol/const-value/call-graph shapes, and the `SemanticModel`
 * contract plus its empty-model factory. This is pure data + pure functions (no
 * checker logic), so it lives in `@blend65/core` and is shared by `frontend` and
 * `language-server` without either importing `@blend65/codegen`.
 *
 * Only the empty model is currently constructed; the behavior that would
 * populate these shapes with real analysis results is not implemented yet.
 */

export type {
  PrimitiveName,
  PrimitiveType,
  ArrayType,
  StructType,
  EnumType,
  ErrorType,
  Type,
} from "./type.js";
export { ERROR_TYPE, primitive } from "./type.js";

export {
  isInteger,
  isSigned,
  isUnsigned,
  bitWidth,
  byteSize,
  isError,
  typeName,
  isAssignableTo,
  commonType,
} from "./type-utils.js";

export type { PlatformProfile } from "./platform-profile.js";
export { DEFAULT_PROFILE } from "./platform-profile.js";

export type { ScopeKind, Scope } from "./scope.js";
export { createScope } from "./scope.js";

export type { SymbolKind, Symbol } from "./symbol.js";

export type { ConstValue } from "./const-value.js";

export type { CallGraph } from "./call-graph.js";
export { emptyCallGraph } from "./call-graph.js";

export type { SemanticModel } from "./semantic-model.js";
export { createEmptyModel } from "./semantic-model.js";
