import type { InventoryV1 } from "./model.js";
import type { Sha256Digest } from "./model-registry-model.js";
import { digestPublicationBytes, renderPublicationJson } from "./publication-model.js";
import { RULE_FAMILY_HANDLER_DECLARATIONS_V2 } from "./rule-family-handler-catalog.js";
import { readInventoryVersioned } from "./versioning.js";

/** Canonical successor inventory shared by model construction and parent publication. */
export interface RuleFamilySuccessorInventoryV2 {
  readonly inventory: InventoryV1;
  readonly canonicalBytes: Uint8Array;
  readonly inventoryDigest: Sha256Digest;
}

/** Checks that a retained declaration agrees with catalog-owned identity and contract metadata. */
function matchingRetainedDeclaration(
  actual: InventoryV1["handlerDeclarations"][number],
  expected: (typeof RULE_FAMILY_HANDLER_DECLARATIONS_V2)[number],
): boolean {
  return (
    actual.id === expected.id &&
    actual.kind === expected.kind &&
    actual.owner === expected.owner &&
    actual.contractVersion === expected.contractVersion
  );
}

/**
 * Projects a passive predecessor into the all-nine-bound schema-one successor inventory.
 *
 * @param predecessor Authenticated predecessor inventory.
 * @returns Canonical successor facts, or `undefined` when retained metadata is incompatible.
 *
 * @example
 * ```ts
 * const successor = projectRuleFamilySuccessorInventoryV2(predecessor);
 * ```
 */
export function projectRuleFamilySuccessorInventoryV2(
  predecessor: InventoryV1,
): RuleFamilySuccessorInventoryV2 | undefined {
  if (
    predecessor.handlerDeclarations.length !== RULE_FAMILY_HANDLER_DECLARATIONS_V2.length - 1 &&
    predecessor.handlerDeclarations.length !== RULE_FAMILY_HANDLER_DECLARATIONS_V2.length
  ) {
    return undefined;
  }
  const sourceById = new Map(
    predecessor.handlerDeclarations.map((declaration) => [declaration.id, declaration]),
  );
  if (sourceById.size !== predecessor.handlerDeclarations.length) return undefined;
  for (const declaration of predecessor.handlerDeclarations) {
    const expected = RULE_FAMILY_HANDLER_DECLARATIONS_V2.find(({ id }) => id === declaration.id);
    if (expected === undefined || !matchingRetainedDeclaration(declaration, expected)) {
      return undefined;
    }
  }
  for (const expected of RULE_FAMILY_HANDLER_DECLARATIONS_V2) {
    const actual = sourceById.get(expected.id);
    if (
      actual === undefined
        ? expected.id !== "transform.semantic-relations"
        : !matchingRetainedDeclaration(actual, expected)
    ) {
      return undefined;
    }
  }
  const projected: InventoryV1 = Object.freeze({
    ...predecessor,
    handlerDeclarations: Object.freeze(
      RULE_FAMILY_HANDLER_DECLARATIONS_V2.map((declaration) => Object.freeze({ ...declaration })),
    ),
  });
  const canonicalBytes = renderPublicationJson(projected);
  const reparsed = readInventoryVersioned(canonicalBytes);
  if (!reparsed.ok || reparsed.inventory === undefined) return undefined;
  return Object.freeze({
    inventory: reparsed.inventory,
    canonicalBytes,
    inventoryDigest: digestPublicationBytes(canonicalBytes),
  });
}
