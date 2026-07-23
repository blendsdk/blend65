import { compareOrdinal } from "./authority-order.js";
import type { InventoryV1 } from "./model.js";

function literal(value: string): string {
  return JSON.stringify(value);
}

function union(values: readonly string[]): string {
  return values.length === 0 ? "never" : values.map(literal).join(" | ");
}

/**
 * Renders deterministic declaration identity types without executable logic.
 *
 * @example
 * ```ts
 * const source = renderDeclarationModule(inventory);
 * ```
 */
export function renderDeclarationModule(inventory: InventoryV1): string {
  const handlers = [...inventory.handlerDeclarations].sort((a, b) => compareOrdinal(a.id, b.id));
  const capabilities = [...inventory.evidenceCapabilityDeclarations].sort((a, b) =>
    compareOrdinal(a.id, b.id),
  );
  return [
    "// Generated from the authoritative compiler-readiness inventory.",
    `export type HandlerId = ${union(handlers.map(({ id }) => id))};`,
    `export type EvidenceCapabilityId = ${union(capabilities.map(({ id }) => id))};`,
    "",
  ].join("\n");
}
