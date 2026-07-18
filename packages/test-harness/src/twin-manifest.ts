/**
 * Twin-manifest loader and strict validator.
 *
 * The manifest maps each corpus program to its hand-written twin, an
 * optional measured-window reference (the twin's quiesced cycle count), and
 * an optional routing block classifying the pair's divergences. Two closed
 * vocabularies apply: routing KEYS are the five mechanical divergence
 * categories; each entry's DISPOSITION says where that divergence routes.
 * Validation is strict and loud — unknown keys, missing fields, and
 * vocabulary violations fail naming the file, the JSON path, and which
 * vocabulary was violated. A malformed manifest must never let the twin
 * tier silently no-op.
 *
 * The category strings are duplicated from the scripts-side corpus library
 * (a package cannot import repo scripts); the two copies cannot drift
 * silently — a renamed category makes every routing key stale, and the
 * scoreboard generator fails loudly on stale keys before writing output.
 *
 * Harness-internal (not on the package barrel).
 */

import { readFileSync } from "node:fs";

/** The five mechanical divergence categories — the routing-key vocabulary. */
const CATEGORIES: readonly string[] = Object.freeze([
  "instruction selection",
  "layout",
  "data placement",
  "addressing modes",
  "register usage",
]);

/** The routing dispositions — where a divergence group routes. */
const DISPOSITIONS = Object.freeze([
  "structural",
  "peephole",
  "data/placement",
  "ceremony",
  "parity",
] as const);

/** One routing entry: a disposition, issue-backed unless `parity`. */
export interface RoutingEntry {
  readonly disposition: (typeof DISPOSITIONS)[number];
  /** GitHub issue number — required unless `parity`, forbidden with it. */
  readonly issue?: number;
  /** The divergence is forced by a language gap the source cannot avoid. */
  readonly sourceForced?: boolean;
  readonly note?: string;
}

/** A pair's measured-window reference — the TWIN's quiesced cycle count. */
export interface MeasuredWindow {
  /** Must match a window name in the same program's budgets entry. */
  readonly window: string;
  readonly fromLabel: string;
  readonly toLabel: string;
  readonly cycles: number;
}

/** One source↔twin pair. */
export interface TwinPair {
  /** Repo-relative example directory of the compiled side. */
  readonly source: string;
  /** Repo-relative path of the hand-written twin `.asm`. */
  readonly twin: string;
  readonly measured?: MeasuredWindow;
  readonly routing?: Readonly<Record<string, readonly RoutingEntry[]>>;
}

/** The whole manifest. */
export interface TwinManifest {
  readonly pairs: Readonly<Record<string, TwinPair>>;
}

/** Fail validation naming the file and the JSON path. */
function fail(fileName: string, path: string, message: string): never {
  throw new Error(`${fileName}: ${path} ${message}`);
}

/** Assert `value` is a plain object (not array/null). */
function requireObject(fileName: string, path: string, value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(fileName, path, "must be an object");
  }
  return value as Record<string, unknown>;
}

/** Assert `value` is a non-empty string. */
function requireName(fileName: string, path: string, value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    fail(fileName, path, "must be a non-empty string");
  }
  return value;
}

/** Assert `value` is a non-negative integer. */
function requireCount(fileName: string, path: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    fail(fileName, path, "must be a non-negative integer");
  }
  return value;
}

/** Reject any key of `obj` outside `allowed`. */
function rejectUnknownKeys(
  fileName: string,
  path: string,
  obj: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      fail(fileName, path, `has unknown key '${key}'`);
    }
  }
}

/** Validate one routing entry. */
function parseRoutingEntry(fileName: string, path: string, value: unknown): RoutingEntry {
  const obj = requireObject(fileName, path, value);
  rejectUnknownKeys(fileName, path, obj, ["disposition", "issue", "sourceForced", "note"]);
  const disposition = requireName(fileName, `${path}.disposition`, obj.disposition);
  if (!(DISPOSITIONS as readonly string[]).includes(disposition)) {
    fail(
      fileName,
      `${path}.disposition`,
      `'${disposition}' is not a routing disposition (${DISPOSITIONS.join(", ")})`,
    );
  }
  if (disposition === "parity") {
    if (obj.issue !== undefined) {
      fail(fileName, path, "carries disposition 'parity' and must not carry an issue");
    }
  } else if (obj.issue === undefined) {
    fail(fileName, path, `with disposition '${disposition}' requires an issue number`);
  }
  const entry: { -readonly [K in keyof RoutingEntry]: RoutingEntry[K] } = {
    disposition: disposition as RoutingEntry["disposition"],
  };
  if (obj.issue !== undefined) {
    const issue = requireCount(fileName, `${path}.issue`, obj.issue);
    if (issue < 1) {
      fail(fileName, `${path}.issue`, "must be a positive integer");
    }
    entry.issue = issue;
  }
  if (obj.sourceForced !== undefined) {
    if (typeof obj.sourceForced !== "boolean") {
      fail(fileName, `${path}.sourceForced`, "must be a boolean");
    }
    entry.sourceForced = obj.sourceForced;
  }
  if (obj.note !== undefined) {
    entry.note = requireName(fileName, `${path}.note`, obj.note);
  }
  return entry;
}

/** Validate one pair's routing block. */
function parseRouting(
  fileName: string,
  path: string,
  value: unknown,
): Readonly<Record<string, readonly RoutingEntry[]>> {
  const obj = requireObject(fileName, path, value);
  const routing: Record<string, readonly RoutingEntry[]> = {};
  for (const [category, entriesValue] of Object.entries(obj)) {
    if (!CATEGORIES.includes(category)) {
      fail(
        fileName,
        path,
        `has unknown mechanical category '${category}' (expected one of: ${CATEGORIES.join(", ")})`,
      );
    }
    if (!Array.isArray(entriesValue)) {
      fail(fileName, `${path}.${category}`, "must be an array of routing entries");
    }
    routing[category] = entriesValue.map((entry, index) =>
      parseRoutingEntry(fileName, `${path}.${category}[${index}]`, entry),
    );
  }
  return routing;
}

/** Validate one pair's measured block. */
function parseMeasured(fileName: string, path: string, value: unknown): MeasuredWindow {
  const obj = requireObject(fileName, path, value);
  rejectUnknownKeys(fileName, path, obj, ["window", "fromLabel", "toLabel", "cycles"]);
  return {
    window: requireName(fileName, `${path}.window`, obj.window),
    fromLabel: requireName(fileName, `${path}.fromLabel`, obj.fromLabel),
    toLabel: requireName(fileName, `${path}.toLabel`, obj.toLabel),
    cycles: requireCount(fileName, `${path}.cycles`, obj.cycles),
  };
}

/** Validate one pair entry. */
function parsePair(fileName: string, path: string, value: unknown): TwinPair {
  const obj = requireObject(fileName, path, value);
  rejectUnknownKeys(fileName, path, obj, ["source", "twin", "measured", "routing"]);
  const pair: { -readonly [K in keyof TwinPair]: TwinPair[K] } = {
    source: requireName(fileName, `${path}.source`, obj.source),
    twin: requireName(fileName, `${path}.twin`, obj.twin),
  };
  if (obj.measured !== undefined) {
    pair.measured = parseMeasured(fileName, `${path}.measured`, obj.measured);
  }
  if (obj.routing !== undefined) {
    pair.routing = parseRouting(fileName, `${path}.routing`, obj.routing);
  }
  return pair;
}

/**
 * Read, parse, and strictly validate a twin manifest.
 *
 * @param path The manifest JSON file path.
 * @returns The validated {@link TwinManifest}.
 * @throws {Error} Naming the file, the JSON path, and — for vocabulary
 *   errors — which vocabulary was violated.
 * @example
 * const manifest = loadTwinManifest(join(root, "test", "golden", "twins.json"));
 */
export function loadTwinManifest(path: string): TwinManifest {
  const fileName = path.split("/").pop() ?? path;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${fileName}: cannot read/parse '${path}': ${(error as Error).message}`);
  }

  const root = requireObject(fileName, "$", parsed);
  rejectUnknownKeys(fileName, "$", root, ["pairs"]);
  const pairsObj = requireObject(fileName, "pairs", root.pairs);

  const pairs: Record<string, TwinPair> = {};
  for (const [pairName, pairValue] of Object.entries(pairsObj)) {
    pairs[pairName] = parsePair(fileName, `pairs.${pairName}`, pairValue);
  }
  return { pairs };
}
