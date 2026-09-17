import { parseTree, printParseErrorCode } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import { validateProjectName } from "./basename.js";
import {
  escapeDiagnosticText,
  projectDiagnostic,
  PROJECT_CODES,
  sortDiagnostics,
} from "./diagnostics.js";
import { firstUnpairedSurrogate, utf16ByteBounds } from "./positions.js";
import { RESULT_KIND } from "./types.js";
import type {
  ManifestParseResult,
  OptimizationGoal,
  ProjectDiagnostic,
  SourceId,
  SourceSpan,
} from "./types.js";

/** Qualified configuration identities; accepting one does not imply a working code generator. */
export const PROFILES = Object.freeze([
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-pal-prg-takeover-6581",
  "c64-pal-prg-takeover-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
  "c64-ntsc-prg-takeover-6581",
  "c64-ntsc-prg-takeover-8580",
  "c64-pal-d64-kernal-6581",
]);

/** Keywords and globally reserved declaration names cannot name module components. */
const RESERVED_IDENTIFIERS = new Set(
  [
    "module import export from function return interrupt fn comptime",
    "if else while do for switch case default fallthrough break continue",
    "let const loadable place zeropage struct byte sbyte word sword boolean void",
    "true false enum type",
    "peek poke peekw pokew lo hi sizeof offsetof length",
    "asm_sei asm_cli asm_php asm_plp asm_nop embed bcd_add bcd_sub",
    "petscii screen_codes atascii internal_codes sin8 cos8 sin16 cos16 main",
  ]
    .join(" ")
    .split(" "),
);

/** Closed declarative keys; unknown fields never become executable extensions. */
const KEYS = new Set([
  "schemaVersion",
  "name",
  "sourceRoot",
  "entry",
  "target",
  "assetPaths",
  "outDir",
  "optimization",
  "boundsCheck",
  "divisionZeroCheck",
]);
const REQUIRED_KEYS = ["schemaVersion", "name", "sourceRoot", "entry", "target", "outDir"];
const MANIFEST_BYTES = 1_048_576;

/** Check ASCII module components without opening sources or interpreting a filename. */
export function validEntry(entry: string): boolean {
  return entry
    .split(".")
    .every(
      (component) =>
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(component) && !RESERVED_IDENTIFIERS.has(component),
    );
}

/** Recognize the four exact schema values without coercion. */
function isOptimization(value: unknown): value is OptimizationGoal {
  return value === "none" || value === "balanced" || value === "speed" || value === "size";
}

/** JSON-pointer escaping is separate from display escaping; it must preserve field identity. */
function pointerFor(key: string): string {
  return "/" + key.replace(/~/g, "~0").replace(/\//g, "~1");
}

/** Render one offending scalar as a code point, or an original multi-character stem as JSON. */
function offendingText(value: string | null): string {
  if (value === null) return "";
  if ([...value].length === 1) {
    return " U+" + value.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
  }
  return " " + JSON.stringify(value);
}

/**
 * Validate a declarative JSONC manifest with raw UTF-8 proving spans.
 * Comments and trailing commas are accepted. Unknown/duplicate keys, invalid types,
 * names, entries and profiles fail without exposing partial configuration.
 * Path values receive type checks only; native containment belongs to project loading.
 * Literal lone UTF-16 surrogates and inputs over one MiB fail before parsing.
 * No filesystem read, output write, configuration execution or normalization occurs.
 * @param text Exact decoded manifest text, including any leading BOM.
 * @param sourceId Trusted display identity; defaults to blend65.json.
 * @example parseManifest('{"schemaVersion":1,"name":"Game","sourceRoot":"src","entry":"Game","target":"c64-pal-prg-kernal-6581","outDir":"build"}')
 */
export function parseManifest(
  text: string,
  sourceId: SourceId = "blend65.json",
): ManifestParseResult {
  const byteLength = Buffer.byteLength(text);
  const wholeSpan = { sourceId, start: 0, end: byteLength };
  if (firstUnpairedSurrogate(text) !== null) {
    return fail([
      projectDiagnostic(
        PROJECT_CODES.utf8,
        "Input '" + escapeDiagnosticText(sourceId) + "' is not valid UTF-8",
        wholeSpan,
      ),
    ]);
  }
  if (byteLength > MANIFEST_BYTES) {
    return fail([
      projectDiagnostic(
        PROJECT_CODES.limit,
        "Project host limit 'manifestBytes' exceeded: maximum " +
          MANIFEST_BYTES +
          ", observed " +
          byteLength,
        wholeSpan,
      ),
    ]);
  }

  const bom = text.startsWith("\ufeff") ? 1 : 0;
  const bounds = utf16ByteBounds(text);
  /** Widen parser recovery ranges when an error ends inside a UTF-16 surrogate pair. */
  function span(node: { readonly offset: number; readonly length: number }): SourceSpan {
    return {
      sourceId,
      start: bounds.starts[node.offset + bom]!,
      end: bounds.ends[node.offset + node.length + bom]!,
    };
  }
  const errors: ParseError[] = [];
  let root: Node | undefined;
  try {
    root = parseTree(text.slice(bom), errors, { allowTrailingComma: true });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return fail([
      projectDiagnostic(
        PROJECT_CODES.syntax,
        "Invalid JSONC at 0: nesting exceeds parser capacity",
        wholeSpan,
      ),
    ]);
  }
  if (errors.length > 0) {
    return fail(
      errors.map((error) => {
        const location = span(error);
        return projectDiagnostic(
          PROJECT_CODES.syntax,
          "Invalid JSONC at " + location.start + ": " + printParseErrorCode(error.error),
          location,
        );
      }),
    );
  }
  if (root === undefined || root.type !== "object") {
    return fail([
      projectDiagnostic(
        PROJECT_CODES.field,
        "Invalid project field '': expected an object",
        wholeSpan,
        "",
      ),
    ]);
  }

  const diagnostics: ProjectDiagnostic[] = [];
  const fields = new Map<string, Node>();
  const pending = [root];
  // Iterative traversal contains our own stack use even for deeply nested unknown data.
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (node.type === "object") {
      const seen = new Map<string, Node>();
      for (const property of node.children ?? []) {
        const key = property.children?.[0];
        const value = property.children?.[1];
        if (key === undefined || value === undefined) continue;
        const spelling: unknown = key.value;
        if (typeof spelling !== "string") continue;
        const prior = seen.get(spelling);
        if (prior !== undefined) {
          diagnostics.push(
            projectDiagnostic(
              PROJECT_CODES.duplicate,
              "Duplicate project key '" + escapeDiagnosticText(spelling) + "'",
              span(key),
              pointerFor(spelling),
              [{ span: span(prior), message: "First occurrence" }],
            ),
          );
        } else {
          seen.set(spelling, key);
          if (node === root) fields.set(spelling, value);
        }
        if (node === root && !KEYS.has(spelling)) {
          diagnostics.push(
            projectDiagnostic(
              PROJECT_CODES.field,
              "Invalid project field '" +
                escapeDiagnosticText(pointerFor(spelling)) +
                "': unknown key",
              span(key),
              pointerFor(spelling),
            ),
          );
        }
        pending.push(value);
      }
    } else {
      for (const child of node.children ?? []) pending.push(child);
    }
  }

  /** A field error uses the complete value token; missing keys use the complete root object. */
  function fieldError(key: string, reason: string): void {
    const node = fields.get(key);
    diagnostics.push(
      projectDiagnostic(
        PROJECT_CODES.field,
        "Invalid project field '" + pointerFor(key) + "': " + reason,
        span(node ?? root!),
        pointerFor(key),
      ),
    );
  }
  for (const key of REQUIRED_KEYS) {
    if (!fields.has(key)) fieldError(key, "required key is missing");
  }
  /** Missing fields are already diagnosed; wrong values are never coerced. */
  function stringField(key: string): string | undefined {
    const node = fields.get(key);
    if (node === undefined) return undefined;
    const value: unknown = node.value;
    if (node.type !== "string" || typeof value !== "string") {
      fieldError(key, "expected a string");
      return undefined;
    }
    return value;
  }
  const schema: unknown = fields.get("schemaVersion")?.value;
  if (fields.has("schemaVersion") && schema !== 1)
    fieldError("schemaVersion", "expected schema version 1");
  const name = stringField("name");
  const sourceRoot = stringField("sourceRoot");
  const entry = stringField("entry");
  const target = stringField("target");
  const outDir = stringField("outDir");
  if (name !== undefined) {
    const result = validateProjectName(name);
    if (result.kind === RESULT_KIND.failure)
      diagnostics.push(
        projectDiagnostic(
          PROJECT_CODES.name,
          "Invalid project name: " + result.reason + offendingText(result.offending),
          span(fields.get("name")!),
          "/name",
        ),
      );
  }
  if (entry !== undefined && !validEntry(entry))
    fieldError("entry", "expected a qualified ASCII module identifier");
  if (target !== undefined && !PROFILES.includes(target))
    diagnostics.push(
      projectDiagnostic(
        PROJECT_CODES.profile,
        "Target profile '" +
          escapeDiagnosticText(target) +
          "' is not a complete qualified profile ID — choose one of: " +
          PROFILES.join(", "),
        span(fields.get("target")!),
        "/target",
      ),
    );

  const assets: string[] = [];
  const assetNode = fields.get("assetPaths");
  if (assetNode !== undefined) {
    if (assetNode.type !== "array") fieldError("assetPaths", "expected an array of strings");
    else {
      for (const node of assetNode.children ?? []) {
        const value: unknown = node.value;
        if (node.type !== "string" || typeof value !== "string") {
          fieldError("assetPaths", "expected an array of strings");
          break;
        }
        assets.push(value);
      }
    }
  }
  const requestedOptimization: unknown = fields.get("optimization")?.value;
  let optimization: OptimizationGoal = "balanced";
  if (fields.has("optimization")) {
    if (isOptimization(requestedOptimization)) optimization = requestedOptimization;
    else fieldError("optimization", "expected none, balanced, speed or size");
  }
  /** Optional booleans default to false and do not accept textual or numeric substitutes. */
  function booleanField(key: string): boolean {
    if (!fields.has(key)) return false;
    const value: unknown = fields.get(key)!.value;
    if (typeof value === "boolean") return value;
    fieldError(key, "expected a boolean");
    return false;
  }
  const boundsCheck = booleanField("boundsCheck");
  const divisionZeroCheck = booleanField("divisionZeroCheck");
  if (
    diagnostics.length > 0 ||
    schema !== 1 ||
    name === undefined ||
    sourceRoot === undefined ||
    entry === undefined ||
    target === undefined ||
    outDir === undefined
  ) {
    return fail(diagnostics);
  }
  return Object.freeze({
    kind: RESULT_KIND.success,
    manifest: Object.freeze({
      schemaVersion: 1,
      name,
      sourceRoot,
      entry,
      target,
      outDir,
      optimization,
      assetPaths: Object.freeze(assets),
      boundsCheck,
      divisionZeroCheck,
    }),
  });
}

/** Freeze the complete failure rather than exposing parser recovery values. */
function fail(diagnostics: readonly ProjectDiagnostic[]): ManifestParseResult {
  return Object.freeze({ kind: RESULT_KIND.failure, diagnostics: sortDiagnostics(diagnostics) });
}
