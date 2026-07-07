/**
 * Config validation, in two passes over two different inputs:
 *  - {@link validateShape} walks the parse tree's top-level properties:
 *    unknown keys (W10240), wrong types (E10243 — the key falls back to its
 *    default). Returns only the shape-valid keys.
 *  - {@link validateSemantics} checks the MERGED config (so overrides are
 *    validated too): platform presence/membership (E10245/E10244), value
 *    rules (E10243), pattern containment (E10246), and promote/suppress
 *    overlap (W10241).
 *
 * Span strategy: file-sourced values anchor to their parse tree nodes
 * (code-unit offsets converted to bytes); values with no file position
 * (override-sourced, missing platform) get synthetic negative spans keyed
 * by schema ordinal + entry index so same-code diagnostics always survive
 * the bag's `(code, sourceId, start)` dedup.
 */

import { posix, win32 } from "node:path";
import { DiagCode, LineMap } from "@blend65/core";
import type { DiagnosticBag, SourceSpan } from "@blend65/core";
import { findNodeAtLocation, getNodeValue } from "jsonc-parser";
import type { Node } from "jsonc-parser";
import { CONFIG_SCHEMA } from "./defaults.js";
import { SYNTHETIC_SPAN_STRIDE } from "./types.js";
import type { BlendConfig, ConfigOverrides } from "./types.js";

/** Reserved synthetic-span ordinal for E10240 (explicit config path missing). */
export const RESERVED_ORDINAL_FILE_NOT_FOUND = CONFIG_SCHEMA.size;

/** Reserved synthetic-span ordinal for E10245 (platform unset after merge). */
export const RESERVED_ORDINAL_MISSING_PLATFORM = CONFIG_SCHEMA.size + 1;

/** Fallback ordinal for keys outside the schema (defensive — never expected). */
const RESERVED_ORDINAL_UNKNOWN_KEY = CONFIG_SCHEMA.size + 2;

/** Each schema key's stable position in CONFIG_SCHEMA declaration order. */
const SCHEMA_ORDINALS: ReadonlyMap<string, number> = new Map(
  [...CONFIG_SCHEMA.keys()].map((key, index) => [key, index]),
);

/** Inputs for the shape pass. */
export interface ValidateContext {
  /** Shared diagnostic accumulator (never throws). */
  readonly bag: DiagnosticBag;
  /** SourceId for spans (CONFIG_SOURCE_ID or a caller-supplied real id). */
  readonly sourceId: number;
  /** Parse tree root from `parseJsoncFile` (undefined → nothing to validate). */
  readonly tree: Node | undefined;
  /** Code-unit → byte offset converter for the parsed text. */
  readonly toByteOffset: (cuOffset: number) => number;
  /** The parsed text (BOM-normalized) for line/col message locations. */
  readonly configText?: string;
}

/** Inputs for the post-merge semantic pass. */
export interface SemanticContext {
  /** Shared diagnostic accumulator (never throws). */
  readonly bag: DiagnosticBag;
  /** SourceId for spans (CONFIG_SOURCE_ID or a caller-supplied real id). */
  readonly sourceId: number;
  /** The merged config — semantic checks see file AND override values. */
  readonly config: BlendConfig;
  /** Parse tree for file-anchored spans (omit on a discovery miss). */
  readonly tree?: Node | undefined;
  /** Code-unit → byte offset converter for the parsed text. */
  readonly toByteOffset?: ((cuOffset: number) => number) | undefined;
  /** The parsed text (BOM-normalized) for line/col message locations. */
  readonly configText?: string | undefined;
  /**
   * The invocation overrides that were merged. Used only to decide span
   * origin: an overridden key's diagnostics use synthetic spans, never the
   * stale file node.
   */
  readonly overrides?: ConfigOverrides | undefined;
  /** Registered platform names; membership check skipped when omitted. */
  readonly knownPlatforms?: readonly string[] | undefined;
}

/**
 * Pattern-containment rule, purely syntactic: a pattern is inside the
 * project root iff it is not absolute (POSIX, win32 drive, or UNC form)
 * and no `/`-separated segment equals `..` after `\` → `/` normalization.
 * Sound because glob metacharacters never match upward across separators;
 * deliberately rejects pathological-but-inside patterns like
 * `src/../src/*.blend`.
 *
 * @param pattern A raw include/exclude glob pattern.
 * @returns `true` when every expansion of the pattern stays under the root.
 */
export function isPatternInsideRoot(pattern: string): boolean {
  const normalized = pattern.replaceAll("\\", "/");
  if (posix.isAbsolute(normalized) || win32.isAbsolute(pattern)) {
    return false;
  }
  return normalized.split("/").every((segment) => segment !== "..");
}

/**
 * Builds the synthetic span for a diagnostic whose value has no file
 * position: `start = end = -(2 + ordinal * stride + entry)`. Negative
 * starts are disjoint from real byte offsets, so file-anchored and
 * synthetic same-code diagnostics never dedup-collide.
 *
 * @param sourceId The config sourceId (sentinel or caller-supplied).
 * @param ordinal The key's CONFIG_SCHEMA ordinal, or a reserved ordinal.
 * @param entryIndex Offending entry index for array-valued keys (0 otherwise).
 * @returns A zero-length span in the synthetic negative coordinate space.
 */
export function syntheticSpan(sourceId: number, ordinal: number, entryIndex = 0): SourceSpan {
  const start = -(2 + ordinal * SYNTHETIC_SPAN_STRIDE + entryIndex);
  return { sourceId, start, end: start };
}

/** A span plus the human-location message prefix that goes with it. */
interface Anchor {
  readonly span: SourceSpan;
  /** `"blend65.json:3:14 — "` for file-anchored spans, `""` otherwise (F9). */
  readonly prefix: string;
}

/** Converts a parse tree node to a byte-offset span. */
function nodeSpan(
  sourceId: number,
  node: Node,
  toByteOffset: (cuOffset: number) => number,
): SourceSpan {
  const start = toByteOffset(node.offset);
  return { sourceId, start, end: toByteOffset(node.offset + node.length) };
}

/** Builds a file anchor: node span + `blend65.json:line:col — ` prefix. */
function fileAnchor(
  sourceId: number,
  node: Node,
  toByteOffset: (cuOffset: number) => number,
  lineMap: LineMap | undefined,
): Anchor {
  const span = nodeSpan(sourceId, node, toByteOffset);
  if (lineMap === undefined) {
    return { span, prefix: "" };
  }
  const { line, column } = lineMap.getLineCol(span.start);
  return { span, prefix: `blend65.json:${line}:${column} — ` };
}

/** Human description of an invalid value for E10243's `got <actual>` slot. */
function describeValue(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "string") return `"${value}"`;
  return typeof value === "object" ? "object" : String(value);
}

/**
 * CONFIG_SCHEMA's keys are exactly the 13 user-facing BlendConfig fields,
 * so narrowing a schema key string to `keyof BlendConfig` is sound by
 * construction (the schema table and the interface are maintained together).
 */
function asConfigKey(key: string): keyof BlendConfig {
  return key as keyof BlendConfig;
}

/** Reads the merged value for a schema key (read-only union access — no cast). */
function configValue(config: BlendConfig, key: keyof BlendConfig): unknown {
  return config[key];
}

/**
 * Shape pass over the parse tree's top-level properties (§4.3 step 3):
 * unknown keys emit W10240 (R19), known keys with the wrong type emit
 * E10243 and are dropped so their defaults apply (R20). Non-object roots
 * contribute nothing — E10242 classification is the loader's (step 2).
 *
 * @param ctx See {@link ValidateContext}.
 * @returns Only the shape-valid keys, typed and ready to merge.
 */
export function validateShape(ctx: ValidateContext): Partial<BlendConfig> {
  const values: Partial<BlendConfig> = {};
  const { tree, bag, sourceId, toByteOffset } = ctx;
  if (tree === undefined || tree.type !== "object" || tree.children === undefined) {
    return values;
  }
  const lineMap =
    ctx.configText !== undefined ? new LineMap(sourceId, ctx.configText) : undefined;

  for (const property of tree.children) {
    if (property.type !== "property" || property.children === undefined) {
      continue;
    }
    const keyNode = property.children[0];
    const valueNode = property.children[1];
    if (keyNode === undefined || typeof keyNode.value !== "string") {
      continue;
    }
    const key = keyNode.value;
    const entry = CONFIG_SCHEMA.get(key);
    if (entry === undefined) {
      const { span, prefix } = fileAnchor(sourceId, keyNode, toByteOffset, lineMap);
      bag.addWarning(
        DiagCode.ConfigUnknownKey,
        span,
        `${prefix}Unknown configuration key: "${key}"`,
      );
      continue;
    }
    if (valueNode === undefined) {
      continue; // value lost to a parse error — E10241 already covers it
    }
    const value: unknown = getNodeValue(valueNode);
    if (!entry.apply(values, value)) {
      const { span, prefix } = fileAnchor(sourceId, valueNode, toByteOffset, lineMap);
      bag.addError(
        DiagCode.ConfigInvalidValue,
        span,
        `${prefix}Invalid value for "${key}": expected ${entry.expected}, got ${describeValue(value)}`,
      );
    }
  }
  return values;
}

/**
 * Post-merge semantic pass: platform presence (E10245) and membership
 * (E10244), schema value rules (E10243 — range, enum, warning-code format),
 * pattern containment (E10246), and promote/suppress overlap (W10241).
 * Emits into `ctx.bag`; never throws. Errored values stay as-merged in
 * the config.
 *
 * @param ctx See {@link SemanticContext}.
 */
export function validateSemantics(ctx: SemanticContext): void {
  const { bag, sourceId, config, tree, toByteOffset, knownPlatforms, overrides } = ctx;
  const lineMap =
    ctx.configText !== undefined ? new LineMap(sourceId, ctx.configText) : undefined;

  /** Keys explicitly set by overrides — their diagnostics never anchor to file nodes. */
  const overriddenKeys = new Set<string>();
  if (overrides !== undefined) {
    for (const key of Object.keys(overrides) as (keyof BlendConfig)[]) {
      if (overrides[key] !== undefined) {
        overriddenKeys.add(key);
      }
    }
  }

  /**
   * Anchors a diagnostic for `key` (and optionally an array entry): the file
   * node when the value came from the file, else a synthetic span.
   */
  function anchorFor(key: string, entryIndex?: number): Anchor {
    if (tree !== undefined && toByteOffset !== undefined && !overriddenKeys.has(key)) {
      const path = entryIndex === undefined ? [key] : [key, entryIndex];
      const node = findNodeAtLocation(tree, path);
      if (node !== undefined) {
        return fileAnchor(sourceId, node, toByteOffset, lineMap);
      }
    }
    const ordinal = SCHEMA_ORDINALS.get(key) ?? RESERVED_ORDINAL_UNKNOWN_KEY;
    return { span: syntheticSpan(sourceId, ordinal, entryIndex ?? 0), prefix: "" };
  }

  // Platform presence — checked regardless of knownPlatforms.
  if (config.platform === "") {
    bag.addError(
      DiagCode.ConfigMissingPlatform,
      syntheticSpan(sourceId, RESERVED_ORDINAL_MISSING_PLATFORM),
      'No platform specified — set "platform" in blend65.json or pass --platform',
    );
  } else if (knownPlatforms !== undefined && !knownPlatforms.includes(config.platform)) {
    // Platform membership — only when the caller injected the registry names.
    const { span, prefix } = anchorFor("platform");
    bag.addError(
      DiagCode.ConfigUnknownPlatform,
      span,
      `${prefix}Unknown platform "${config.platform}". Available platforms: ${knownPlatforms.join(", ")}`,
    );
  }

  // Schema value rules (E10243): scalar rules + per-entry rules.
  for (const [key, entry] of CONFIG_SCHEMA) {
    const value = configValue(config, asConfigKey(key));
    if (entry.valueRule !== undefined) {
      const detail = entry.valueRule(value);
      if (detail !== null) {
        const { span, prefix } = anchorFor(key);
        bag.addError(
          DiagCode.ConfigInvalidValue,
          span,
          `${prefix}Invalid value for "${key}": expected ${detail}, got ${describeValue(value)}`,
        );
      }
    }
    if (entry.entryRule !== undefined && Array.isArray(value)) {
      value.forEach((element, index) => {
        const detail = entry.entryRule?.(element);
        if (detail !== null && detail !== undefined) {
          const { span, prefix } = anchorFor(key, index);
          bag.addError(
            DiagCode.ConfigInvalidValue,
            span,
            `${prefix}Invalid value for "${key}": expected ${detail}, got ${describeValue(element)}`,
          );
        }
      });
    }
  }

  // Pattern containment: one E10246 per offending entry.
  for (const key of ["include", "exclude"] as const) {
    config[key].forEach((pattern, index) => {
      if (!isPatternInsideRoot(pattern)) {
        const { span, prefix } = anchorFor(key, index);
        bag.addError(
          DiagCode.ConfigPatternEscapesRoot,
          span,
          `${prefix}Invalid pattern "${pattern}" in "${key}": patterns must be relative and must not escape the project root`,
        );
      }
    });
  }

  // Promote/suppress overlap: one W10241 per dual-listed code.
  if (Array.isArray(config.warnAsError)) {
    const promoted = new Set(config.warnAsError);
    config.suppressWarnings.forEach((code, index) => {
      if (promoted.has(code)) {
        const { span, prefix } = anchorFor("suppressWarnings", index);
        bag.addWarning(
          DiagCode.ConfigPromoteSuppressOverlap,
          span,
          `${prefix}Warning code "${code}" is both promoted (warnAsError) and suppressed (suppressWarnings) — suppression wins`,
        );
      }
    });
  }
}
