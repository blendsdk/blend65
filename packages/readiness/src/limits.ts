/** Resource bounds applied before or during inventory traversal. */
export interface InventoryLimits {
  readonly maxInputBytes: number;
  readonly maxDepth: number;
  readonly maxSources: number;
  readonly maxSectionsPerSource: number;
  readonly maxFragments: number;
  readonly maxRules: number;
  readonly maxStringBytes: number;
  readonly maxArrayItems: number;
  readonly maxRelationshipsPerRule: number;
}

/**
 * Immutable resource policy for inventory schema version 1.
 *
 * @example
 * ```ts
 * const maximum = INVENTORY_V1_LIMITS.maxInputBytes;
 * ```
 */
export const INVENTORY_V1_LIMITS: InventoryLimits = Object.freeze({
  maxInputBytes: 8_388_608,
  maxDepth: 64,
  maxSources: 256,
  maxSectionsPerSource: 256,
  maxFragments: 65_536,
  maxRules: 32_768,
  maxStringBytes: 65_536,
  maxArrayItems: 65_536,
  maxRelationshipsPerRule: 512,
});
