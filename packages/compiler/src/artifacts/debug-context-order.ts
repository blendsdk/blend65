/** Return the canonical root ordering key for one validated execution context. */
export function debugContextKey(value: Record<string, unknown>): string {
  if (value.kind === "entry") {
    return `0\0${String(value.functionIndex).padStart(10, "0")}\0${String(value.entryVariantIndex).padStart(10, "0")}`;
  }
  const callSite = value.callSite as Record<string, unknown>;
  return `1\0${String(value.parentContextIndex).padStart(10, "0")}\0${String(callSite.sourceIndex).padStart(10, "0")}\0${String(callSite.startByte).padStart(16, "0")}\0${String(callSite.endByte).padStart(16, "0")}\0${String(value.functionIndex).padStart(10, "0")}`;
}
