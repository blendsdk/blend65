import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

/** The four kinds of printed, stable names used by the completion record. */
export type CoverageKind = "grammar" | "semantic-rule" | "diagnostic" | "conformance";

/** One named obligation found directly in the frozen specification. */
export interface CoverageSourceKey {
  readonly key: string;
  readonly kind: CoverageKind;
  readonly source: string;
}

const DISPOSITIONS = new Set([
  "planned",
  "implemented",
  "rd-05",
  "rd-06",
  "rd-07",
  "spec-rejected",
]);

/** Read the printed production index, rule headings, active registry, and conformance headings. */
export async function readNormativeSourceKeys(
  specRoot: string,
): Promise<readonly CoverageSourceKey[]> {
  const keys: CoverageSourceKey[] = [];
  const grammar = await readFile(join(specRoot, "grammar.ebnf.md"), "utf8");
  const productionIndex = section(
    grammar,
    "## 10. Production Index",
    "## 11. Parser Architecture Notes",
  );
  for (const match of productionIndex.matchAll(/^\| `([a-z][a-z_0-9]*)` \|/gm)) {
    keys.push({ key: `grammar:${match[1]}`, kind: "grammar", source: "grammar.ebnf.md" });
  }

  const chapterFiles = (await readdir(specRoot)).filter((name) =>
    /^(0[1-9]|1[0-3])-[^/]+\.md$/.test(name),
  );
  for (const file of chapterFiles) {
    const chapter = await readFile(join(specRoot, file), "utf8");
    for (const line of chapter.split("\n")) {
      if (!/^#{2,5} /.test(line)) continue;
      for (const match of line.matchAll(/\b([A-Z]{2,4}-[0-9]+)\b/g)) {
        // UTF-8 is an encoding name in a heading, not a numbered semantic rule.
        if (match[1] === "UTF-8") continue;
        keys.push({ key: `rule:${file}#${match[1]}`, kind: "semantic-rule", source: file });
      }
    }
  }

  const registry = await readFile(join(specRoot, "14-diagnostics.md"), "utf8");
  const active = section(
    registry,
    "## 3. Active Error Registry",
    "## 5. Retirement and Migration History",
  );
  for (const match of active.matchAll(/^\| ([EW][0-9]{5}) \|/gm)) {
    keys.push({ key: `diagnostic:${match[1]}`, kind: "diagnostic", source: "14-diagnostics.md" });
  }

  const profile = await readFile(join(specRoot, "15-platform-profile.md"), "utf8");
  for (const match of profile.matchAll(/^### (5\.[1-5]) \S.*$/gm)) {
    keys.push({
      key: `conformance:15-platform-profile.md#${match[1]}`,
      kind: "conformance",
      source: "15-platform-profile.md",
    });
  }

  const seen = new Set<string>();
  for (const item of keys) {
    if (seen.has(item.key)) throw new Error(`Duplicate printed specification key: ${item.key}`);
    seen.add(item.key);
  }
  return keys.sort((left, right) => left.key.localeCompare(right.key));
}

/** Report every mismatch without rewriting the hand-maintained completion record. */
export function coverageViolations(
  document: unknown,
  expectedKeys: readonly CoverageSourceKey[],
  expectedIdentity: string,
): readonly string[] {
  if (!isRecord(document)) return ["Coverage document must be an object"];
  const violations: string[] = [];
  if (document.specificationIdentity !== expectedIdentity) {
    violations.push("Specification identity does not match the frozen corpus");
  }
  if (!Array.isArray(document.entries)) return [...violations, "Coverage entries must be an array"];

  const expected = new Map(expectedKeys.map((item) => [item.key, item]));
  const seen = new Set<string>();
  for (const [index, value] of document.entries.entries()) {
    if (!isRecord(value) || typeof value.key !== "string") {
      violations.push(`Entry ${index} must be an object with a string key`);
      continue;
    }
    const key = value.key;
    if (seen.has(key)) violations.push(`Duplicate coverage key: ${key}`);
    seen.add(key);
    const source = expected.get(key);
    if (source === undefined) {
      violations.push(`Unknown coverage key: ${key}`);
      continue;
    }
    if (value.kind !== source.kind || value.source !== source.source) {
      violations.push(`Incorrect kind or source for ${key}`);
    }
    if (typeof value.owner !== "string" || value.owner.trim() === "") {
      violations.push(`Missing owner for ${key}`);
    }
    if (!Array.isArray(value.proof) || value.proof.length === 0 || !value.proof.every(isRepoPath)) {
      violations.push(`Invalid proof path for ${key}`);
    }
    if (typeof value.disposition !== "string" || !DISPOSITIONS.has(value.disposition)) {
      violations.push(`Invalid disposition for ${key}`);
    }
  }
  for (const key of expected.keys()) {
    if (!seen.has(key)) violations.push(`Missing coverage key: ${key}`);
  }
  return violations;
}

/** Slice a named Markdown section so retired rows cannot enter the active key set. */
function section(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`Missing specification section: ${start} or ${end}`);
  return text.slice(from + start.length, to);
}

/** Keep paths relative to this repository; the ledger never reads external evidence. */
function isRepoPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
