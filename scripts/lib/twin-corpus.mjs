// Shared corpus helpers for the parity scripts: strict pair-manifest
// loading, building a pair's generated side through the real compiler, and
// assembling a hand-written twin through real ACME. Library functions
// THROW on failure; each CLI catches and maps to exit 1 under its own
// stderr prefix.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

/** The PRG load-address header excluded from every byte figure. */
export const PRG_HEADER_BYTES = 2;

/**
 * The five mechanical divergence categories — the single vocabulary for
 * divergence rows and manifest routing keys. (The test-harness package
 * keeps its own frozen copy: packages cannot import repo scripts, and a
 * renamed category surfaces immediately as a stale routing key.)
 */
export const CATEGORIES = Object.freeze([
  "instruction selection",
  "layout",
  "data placement",
  "addressing modes",
  "register usage",
]);

/** The routing dispositions — where a divergence group routes. */
export const DISPOSITIONS = Object.freeze([
  "structural",
  "peephole",
  "data/placement",
  "ceremony",
  "parity",
]);

/** Fail validation naming the file and the JSON path. */
function invalid(fileName, path, message) {
  throw new Error(`${fileName}: ${path} ${message}`);
}

/** Assert `value` is a plain object (not array/null). */
function requireObject(fileName, path, value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalid(fileName, path, "must be an object");
  }
  return value;
}

/** Assert `value` is a non-empty string. */
function requireName(fileName, path, value) {
  if (typeof value !== "string" || value.length === 0) {
    invalid(fileName, path, "must be a non-empty string");
  }
  return value;
}

/** Assert `value` is a non-negative integer. */
function requireCount(fileName, path, value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    invalid(fileName, path, "must be a non-negative integer");
  }
  return value;
}

/** Reject any key of `obj` outside `allowed`. */
function rejectUnknownKeys(fileName, path, obj, allowed) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      invalid(fileName, path, `has unknown key '${key}'`);
    }
  }
}

/** Validate one routing entry. */
function parseRoutingEntry(fileName, path, value) {
  const obj = requireObject(fileName, path, value);
  rejectUnknownKeys(fileName, path, obj, ["disposition", "issue", "sourceForced", "note"]);
  const disposition = requireName(fileName, `${path}.disposition`, obj.disposition);
  if (!DISPOSITIONS.includes(disposition)) {
    invalid(
      fileName,
      `${path}.disposition`,
      `'${disposition}' is not a routing disposition (${DISPOSITIONS.join(", ")})`,
    );
  }
  if (disposition === "parity") {
    if (obj.issue !== undefined) {
      invalid(fileName, path, "carries disposition 'parity' and must not carry an issue");
    }
  } else if (obj.issue === undefined) {
    invalid(fileName, path, `with disposition '${disposition}' requires an issue number`);
  }
  if (obj.issue !== undefined && requireCount(fileName, `${path}.issue`, obj.issue) < 1) {
    invalid(fileName, `${path}.issue`, "must be a positive integer");
  }
  if (obj.sourceForced !== undefined && typeof obj.sourceForced !== "boolean") {
    invalid(fileName, `${path}.sourceForced`, "must be a boolean");
  }
  if (obj.note !== undefined) {
    requireName(fileName, `${path}.note`, obj.note);
  }
  return obj;
}

/** Validate one pair's routing block. */
function parseRouting(fileName, path, value) {
  const obj = requireObject(fileName, path, value);
  for (const [category, entries] of Object.entries(obj)) {
    if (!CATEGORIES.includes(category)) {
      invalid(
        fileName,
        path,
        `has unknown mechanical category '${category}' (expected one of: ${CATEGORIES.join(", ")})`,
      );
    }
    if (!Array.isArray(entries)) {
      invalid(fileName, `${path}.${category}`, "must be an array of routing entries");
    }
    entries.forEach((entry, index) =>
      parseRoutingEntry(fileName, `${path}.${category}[${index}]`, entry),
    );
  }
  return obj;
}

/** Validate one pair's measured block. */
function parseMeasured(fileName, path, value) {
  const obj = requireObject(fileName, path, value);
  rejectUnknownKeys(fileName, path, obj, ["window", "fromLabel", "toLabel", "cycles"]);
  requireName(fileName, `${path}.window`, obj.window);
  requireName(fileName, `${path}.fromLabel`, obj.fromLabel);
  requireName(fileName, `${path}.toLabel`, obj.toLabel);
  requireCount(fileName, `${path}.cycles`, obj.cycles);
  return obj;
}

/**
 * Read, parse, and strictly validate a twin manifest. Throws naming the
 * file, the JSON path, and — for vocabulary errors — which vocabulary was
 * violated (mechanical category vs routing disposition).
 */
export function loadManifest(manifestPath) {
  const fileName = basename(manifestPath);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`${fileName}: cannot read/parse '${manifestPath}': ${error.message}`);
  }
  const root = requireObject(fileName, "$", parsed);
  rejectUnknownKeys(fileName, "$", root, ["pairs"]);
  const pairs = requireObject(fileName, "pairs", root.pairs);
  for (const [name, pair] of Object.entries(pairs)) {
    const path = `pairs.${name}`;
    const obj = requireObject(fileName, path, pair);
    rejectUnknownKeys(fileName, path, obj, ["source", "twin", "measured", "routing"]);
    requireName(fileName, `${path}.source`, obj.source);
    requireName(fileName, `${path}.twin`, obj.twin);
    if (obj.measured !== undefined) {
      parseMeasured(fileName, `${path}.measured`, obj.measured);
    }
    if (obj.routing !== undefined) {
      parseRouting(fileName, `${path}.routing`, obj.routing);
    }
  }
  return root;
}

/**
 * Build one pair's generated side into a scratch dir through the real
 * compiler and return its artifacts. Enumerates the staged modules —
 * `main.blend` first, the remainder sorted — so multi-module examples
 * compile with their full import set.
 */
export async function buildGeneratedSide(compiler, sourceDir) {
  const scratch = mkdtempSync(join(tmpdir(), "b65-twin-gen-"));
  const modules = [];
  for (const file of readdirSync(sourceDir)) {
    if (file.endsWith(".blend") || file.endsWith(".bin")) {
      copyFileSync(join(sourceDir, file), join(scratch, file));
      if (file.endsWith(".blend")) {
        modules.push(file);
      }
    }
  }
  if (!modules.includes("main.blend")) {
    throw new Error(`'${sourceDir}' has no main.blend to build`);
  }
  const sourceFiles = ["main.blend", ...modules.filter((f) => f !== "main.blend").sort()];
  const outDir = join(scratch, "out");
  const result = await compiler.build({ platform: "c64", cwd: scratch, sourceFiles, outDir });
  if (result.hasErrors || result.binaryPath === undefined) {
    throw new Error(`building '${sourceDir}' failed`);
  }
  return {
    prgBytes: statSync(result.binaryPath).size - PRG_HEADER_BYTES,
    reportPath: result.binaryPath.replace(/\.prg$/, ".report"),
  };
}

/**
 * Assemble a hand-written twin through real ACME. Stages ONLY the named
 * twin plus the `.bin` assets beside it — never sibling twins, which
 * co-locate in the golden directory. The twin's own `!to` directive names
 * the output (adding -o would make ACME fall back to its headerless
 * format); `-o twin.prg` applies only when `!to` is absent.
 */
export function assembleTwin(twinPath) {
  const scratch = mkdtempSync(join(tmpdir(), "b65-twin-hand-"));
  const twinDir = dirname(twinPath);
  const twinName = basename(twinPath);
  copyFileSync(twinPath, join(scratch, twinName));
  for (const file of readdirSync(twinDir)) {
    if (file.endsWith(".bin")) {
      copyFileSync(join(twinDir, file), join(scratch, file));
    }
  }
  const source = readFileSync(twinPath, "utf8");
  const toMatch = /^\s*!to\s+"([^"]+)"/m.exec(source);
  const reportPath = join(scratch, "twin.report");
  const argv = ["--cpu", "6510", "--format", "cbm", "--report", reportPath];
  let prgPath;
  if (toMatch !== null) {
    prgPath = join(scratch, toMatch[1]);
  } else {
    prgPath = join(scratch, "twin.prg");
    argv.push("-o", prgPath);
  }
  argv.push(join(scratch, twinName));
  try {
    execFileSync("acme", argv, { cwd: scratch, stdio: ["ignore", "ignore", "pipe"] });
  } catch (error) {
    throw new Error(`ACME failed on twin '${twinPath}':\n${String(error.stderr ?? error.message)}`);
  }
  return { prgBytes: statSync(prgPath).size - PRG_HEADER_BYTES, reportPath };
}
