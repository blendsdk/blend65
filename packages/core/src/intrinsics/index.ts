/**
 * Public barrel for the intrinsic system (`@blend65/core`).
 *
 * Surfaces the descriptor types, the registry contract + factory, and the core
 * catalog so the frontend (validation) and codegen (lowering/marshalling) consume
 * one shared model. The canonical `PlatformProfile` the descriptors' availability
 * predicates key on is exported from the `@blend65/core/platform` subpath.
 */

export type {
  IntrinsicTier,
  LoweringStrategy,
  ClobberEntry,
  TypeRef,
  IntrinsicParam,
  IntrinsicSignature,
  CostMetadata,
  IntrinsicDescriptor,
} from "./descriptor.js";

export type { IntrinsicRegistry } from "./registry.js";
export { createIntrinsicRegistry } from "./registry.js";

export { CORE_INTRINSICS, RT_ROUTINES } from "./catalog.js";
