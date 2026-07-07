/**
 * The `loadConfig()` orchestrator, in six steps: resolve path → read +
 * parse → shape validation → merge → semantic validation → result.
 * Synchronous; never throws — every failure degrades to diagnostics in
 * the caller's bag plus a fully-populated default-backed config.
 */

import { existsSync, readFileSync } from "node:fs";
import { Buffer } from "node:buffer";
import { dirname, resolve } from "node:path";
import { DiagCode, LineMap } from "@blend65/core";
import type { DiagnosticBag } from "@blend65/core";
import { findConfigUpwards } from "./discovery.js";
import { mergeConfig } from "./merge.js";
import { parseJsoncFile } from "./parse.js";
import { createOffsetConverter } from "./parse.js";
import { CONFIG_SOURCE_ID } from "./types.js";
import type { LoadConfigOptions, LoadConfigResult } from "./types.js";
import {
  RESERVED_ORDINAL_FILE_NOT_FOUND,
  syntheticSpan,
  validateSemantics,
  validateShape,
} from "./validate.js";

/**
 * Wraps `bag` so every error-severity emission ALSO invokes `onError`.
 * `hasErrors` must mean "this call emitted an error", which a before/after
 * `getErrors().length` comparison gets wrong when the caller's bag is
 * pre-populated, deduping, or already at its cap (where suppressed adds
 * change nothing observable in the bag).
 */
function withErrorTracking(bag: DiagnosticBag, onError: () => void): DiagnosticBag {
  return {
    addError: (code, span, message, options) => {
      onError();
      bag.addError(code, span, message, options);
    },
    addWarning: (code, span, message, options) => {
      bag.addWarning(code, span, message, options);
    },
    addICE: (code, span, message) => {
      onError();
      bag.addICE(code, span, message);
    },
    hasErrors: () => bag.hasErrors(),
    getAll: () => bag.getAll(),
    getErrors: () => bag.getErrors(),
    getWarnings: () => bag.getWarnings(),
    count: () => bag.count(),
    isErrorLimitReached: () => bag.isErrorLimitReached(),
  };
}

/** `true` when `value` is a plain JSON object (not null / array / scalar). */
function isPlainObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads and validates `blend65.json`.
 *
 * All diagnostics are appended to `options.bag` (accumulate, never throw).
 * The returned config is always fully populated; when `hasErrors` is true
 * its values are as-merged and untrusted — consumers gate on `hasErrors`
 * before reading it.
 *
 * @param options See {@link LoadConfigOptions}.
 * @returns The merged config plus whether THIS call emitted any error.
 */
export function loadConfig(options: LoadConfigOptions): LoadConfigResult {
  const sourceId = options.sourceId ?? CONFIG_SOURCE_ID;
  let hadError = false;
  const bag = withErrorTracking(options.bag, () => {
    hadError = true;
  });

  // Step 1 — resolve the config path (explicit beats discovery).
  const cwd = resolve(options.cwd ?? process.cwd());
  const explicitPath = options.configPath !== undefined ? resolve(options.configPath) : null;
  let configPath = explicitPath ?? findConfigUpwards(cwd, existsSync);

  // Step 2 — read + parse. A read failure (missing explicit path, or an
  // existing file that cannot be read) is E10240; a discovery miss is not
  // an error and simply leaves `text` null.
  let text: string | null = null;
  if (configPath !== null) {
    try {
      text = readFileSync(configPath, "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      bag.addError(
        DiagCode.ConfigFileNotFound,
        syntheticSpan(sourceId, RESERVED_ORDINAL_FILE_NOT_FOUND),
        `Configuration file not found: ${configPath} (${reason})`,
      );
      configPath = null; // nothing was loaded — defaults + overrides apply
    }
  }

  const parsed = text !== null ? parseJsoncFile(text) : null;
  const toByteOffset = parsed !== null ? createOffsetConverter(parsed.text) : undefined;
  if (parsed !== null && configPath !== null) {
    // Report ALL parse errors; offsets are already bytes.
    const lineMap = new LineMap(sourceId, parsed.text);
    for (const parseError of parsed.parseErrors) {
      const { line, column } = lineMap.getLineCol(parseError.offset);
      bag.addError(
        DiagCode.ConfigParseError,
        { sourceId, start: parseError.offset, end: parseError.offset + parseError.length },
        `Invalid blend65.json: ${parseError.message} (${configPath}:${line}:${column})`,
      );
    }
    // Top-level non-object ([], "x", null, 42) → E10242; the file then
    // contributes no values. An undefined value means nothing was
    // recoverable — the parse error above already covers that.
    if (parsed.value !== undefined && !isPlainObject(parsed.value)) {
      const byteLength = Buffer.byteLength(parsed.text, "utf8");
      bag.addError(
        DiagCode.ConfigNotAnObject,
        { sourceId, start: 0, end: Math.min(1, byteLength) },
        "blend65.json must contain a JSON object",
      );
    }
  }

  // Step 3 — shape validation over the parse tree (validateShape returns {}
  // for non-object roots, so the E10242 path needs no special-casing here).
  const fileValues =
    parsed !== null && toByteOffset !== undefined
      ? validateShape({
          bag,
          sourceId,
          tree: parsed.tree,
          toByteOffset,
          configText: parsed.text,
        })
      : {};

  // Steps 4 + 5 — defaults, file values, then overrides, plus origin.
  const config = mergeConfig(fileValues, options.overrides, {
    configPath,
    projectRoot: configPath !== null ? dirname(configPath) : cwd,
  });

  // Step 6 — post-merge semantics (overrides are validated too).
  validateSemantics({
    bag,
    sourceId,
    config,
    tree: parsed?.tree,
    toByteOffset,
    configText: parsed?.text,
    overrides: options.overrides,
    knownPlatforms: options.knownPlatforms,
  });

  // Step 7 — hasErrors = THIS call emitted an error.
  return { config, hasErrors: hadError };
}
