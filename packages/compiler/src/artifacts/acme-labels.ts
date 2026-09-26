import type { MachineProgram } from "../machine/machine-types.js";

/**
 * Make an ASCII label with a readable hint and an injective identity suffix.
 * Sanitization or truncation of the hint cannot cause collisions: the complete UTF-8 identity
 * remains encoded in the suffix. Neither source paths nor display names can inject ACME syntax.
 */
export function acmeLabelName(id: string, sourceName = id): string {
  const hint = sourceName.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80);
  return `b65_${hint}_${Buffer.from(id, "utf8").toString("hex")}`;
}

/** Derive the same source-related label spellings for serialization and debug evidence. */
export function acmeLabelNames(program: MachineProgram): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (const fn of [program.startup, ...program.functions]) {
    labels.set(fn.id, acmeLabelName(fn.id, fn.sourceName ?? fn.id));
    fn.blocks.forEach((block, index) => {
      if (!labels.has(block.label)) {
        labels.set(
          block.label,
          acmeLabelName(block.label, `${fn.sourceName ?? fn.id}_block_${index}`),
        );
      }
    });
  }
  for (const data of program.data) {
    labels.set(data.id, acmeLabelName(data.id, data.sourceName ?? data.id));
  }
  return labels;
}
