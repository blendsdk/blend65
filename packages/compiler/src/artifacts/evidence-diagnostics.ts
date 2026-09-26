import { findNodeAtLocation, parseTree } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import { escapeDiagnosticText, projectDiagnostic } from "../project/diagnostics.js";
import type { SourceSpan } from "../project/types.js";
import type { EvidenceValidationResult } from "./evidence.js";
import { canonicalEvidenceJson, isEvidenceRecord } from "./evidence-validation.js";

/** Optional field proof supplied by an existing payload validator. */
export type EvidenceFieldFailure = (path: readonly (string | number)[], invariant: string) => void;

/** Find the first repeated key, retaining both spellings instead of accepting last-key wins. */
function duplicateKey(root: Node, deep: boolean): readonly [Node, Node] | null {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.type === "object") {
      const seen = new Map<string, Node>();
      for (const property of node.children ?? []) {
        const key = property.children?.[0];
        if (key === undefined) continue;
        const previous = seen.get(String(key.value));
        if (previous !== undefined) return [key, previous];
        seen.set(String(key.value), key);
      }
    }
    if (deep) pending.push(...[...(node.children ?? [])].reverse());
  }
  return null;
}

/** Admit only integral finite JSON payloads; null has no meaning in these closed sidecars. */
function integralJson(value: unknown): boolean {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isSafeInteger(value);
  if (Array.isArray(value)) return value.every(integralJson);
  return isEvidenceRecord(value) && Object.values(value).every(integralJson);
}

/** Parse existing sidecar bytes and retain precise diagnostic identity at the validation boundary. */
export function parseEvidence<T>(
  name: string,
  bytes: Uint8Array,
  validate: (candidate: unknown, invalid?: EvidenceFieldFailure) => candidate is T,
): EvidenceValidationResult<T> {
  const sourceId = `.${name}.json`;
  let source = "";
  const span = (node?: { readonly offset: number; readonly length: number }): SourceSpan => ({
    sourceId,
    start: node === undefined ? 0 : Buffer.byteLength(source.slice(0, node.offset)),
    end:
      node === undefined
        ? bytes.byteLength
        : Buffer.byteLength(source.slice(0, node.offset + node.length)),
  });
  const malformed = (
    diagnostic: string,
    invariant: string,
    node?: { readonly offset: number; readonly length: number },
    pointer: string | null = null,
    previous?: Node,
  ): EvidenceValidationResult<T> =>
    Object.freeze({
      kind: "error",
      reason: "malformed",
      diagnostic,
      record: projectDiagnostic(
        "E10267",
        `Malformed public artifact '${sourceId}' at '${pointer ?? sourceId}' — ${escapeDiagnosticText(invariant)}`,
        span(node),
        pointer,
        previous === undefined ? [] : [{ span: span(previous), message: "First key is here" }],
      ),
    });
  const envelope = `${name} evidence has an invalid JSON envelope`;
  let tree: Node | undefined;
  let value: unknown;
  const errors: ParseError[] = [];
  try {
    // Keep a BOM visible to strict JSON validation and raw-byte span calculation.
    source = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    tree = parseTree(source, errors, { disallowComments: true, allowTrailingComma: false });
    if (errors.length > 0 || tree === undefined) {
      return malformed(envelope, "invalid JSON", errors[0]);
    }
    value = JSON.parse(source);
  } catch {
    return malformed(envelope, "invalid UTF-8 or JSON");
  }
  if (!isEvidenceRecord(value)) return malformed(envelope, "expected an object", tree);
  // Envelope duplicates are invalid even for an unknown version. Payload invariants
  // are inspected only once the version is supported.
  const duplicate = duplicateKey(tree, false);
  if (duplicate !== null) {
    return malformed(
      envelope,
      `Duplicate key '${String(duplicate[0].value)}'`,
      duplicate[0],
      null,
      duplicate[1],
    );
  }
  if (value.kind !== `blend65.${name}`) {
    return malformed(envelope, "missing or invalid kind", findNodeAtLocation(tree, ["kind"]));
  }
  const version = findNodeAtLocation(tree, ["schemaVersion"]);
  if (!Number.isInteger(value.schemaVersion) || Number(value.schemaVersion) <= 0) {
    return malformed(envelope, "schemaVersion must be a positive integer", version);
  }
  if (value.schemaVersion !== 1) {
    return Object.freeze({
      kind: "error",
      reason: "unsupported-version",
      diagnostic: `${name} evidence uses an unsupported schema version`,
      record: projectDiagnostic(
        "E10268",
        `Unsupported public artifact schema version ${String(value.schemaVersion)} for '${sourceId}' — supported version: 1`,
        span(version),
        "/schemaVersion",
      ),
    });
  }
  let fieldFailure: EvidenceValidationResult<T> | undefined;
  const nestedDuplicate = duplicateKey(tree, true);
  if (nestedDuplicate !== null) {
    return malformed(
      envelope,
      `Duplicate key '${String(nestedDuplicate[0].value)}'`,
      nestedDuplicate[0],
      null,
      nestedDuplicate[1],
    );
  }
  const invalid: EvidenceFieldFailure = (path, invariant) => {
    const pointer = path
      .map((part) => `/${String(part).replaceAll("~", "~0").replaceAll("/", "~1")}`)
      .join("");
    fieldFailure ??= malformed(
      `${name} evidence has an invalid version-1 payload`,
      invariant,
      findNodeAtLocation(tree!, [...path]),
      pointer,
    );
  };
  if (!validate(value, invalid) || !integralJson(value)) {
    return (
      fieldFailure ??
      malformed(
        `${name} evidence has an invalid version-1 payload`,
        "version-1 payload invariants failed",
        tree,
        "",
      )
    );
  }
  if (source !== `${canonicalEvidenceJson(value)}\n`) {
    return malformed(
      `${name} evidence is not in canonical byte form`,
      "expected canonical byte form",
    );
  }
  return Object.freeze({ kind: "complete", value });
}
