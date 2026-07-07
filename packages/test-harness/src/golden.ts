/**
 * Golden-snapshot helper.
 *
 * Byte-exact comparison of `actual` against a committed golden file. In update
 * mode — explicit `updateMode` arg OR a truthy `process.env.UPDATE_GOLDEN` — it
 * writes `actual` to `goldenPath` instead of asserting (a manual developer
 * action). Reads/writes ONLY the caller-supplied path; update mode is an
 * explicit opt-in.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { AssertionError } from "./run/assertions.js";

/** How many context lines to show around the first divergence in a mismatch. */
const DIFF_CONTEXT = 2;

/** Whether update mode is active (explicit arg wins; else the env var). */
function isUpdateMode(updateMode: boolean | undefined): boolean {
  if (updateMode !== undefined) return updateMode;
  const env = process.env.UPDATE_GOLDEN;
  return env !== undefined && env !== "" && env !== "0" && env !== "false";
}

/** Build a unified-diff-style excerpt around the first differing line. */
function diffExcerpt(actual: string, expected: string): string {
  const actualLines = actual.split("\n");
  const expectedLines = expected.split("\n");
  const max = Math.max(actualLines.length, expectedLines.length);
  let firstDiff = 0;
  while (firstDiff < max && actualLines[firstDiff] === expectedLines[firstDiff]) {
    firstDiff += 1;
  }
  const start = Math.max(0, firstDiff - DIFF_CONTEXT);
  const end = Math.min(max, firstDiff + DIFF_CONTEXT + 1);
  const lines: string[] = [];
  for (let i = start; i < end; i++) {
    if (actualLines[i] === expectedLines[i]) {
      lines.push(`  ${expectedLines[i] ?? ""}`);
    } else {
      lines.push(`- ${expectedLines[i] ?? "<missing>"}`); // golden
      lines.push(`+ ${actualLines[i] ?? "<missing>"}`); // actual
    }
  }
  return `first difference at line ${firstDiff + 1}:\n${lines.join("\n")}`;
}

/**
 * Assert `actual` matches the golden file at `goldenPath`, or write it in
 * update mode.
 *
 * @param actual The content produced by the code under test.
 * @param goldenPath Path to the committed golden file.
 * @param updateMode Force update mode; defaults to the `UPDATE_GOLDEN` env var.
 * @throws {AssertionError} On a byte mismatch (compare mode) or a missing golden file.
 */
export function assertGolden(actual: string, goldenPath: string, updateMode?: boolean): void {
  if (isUpdateMode(updateMode)) {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, actual, "utf8");
    console.log(`[golden] wrote ${goldenPath}`);
    return;
  }

  if (!existsSync(goldenPath)) {
    throw new AssertionError(
      `golden file not found: ${goldenPath} — run with UPDATE_GOLDEN=1 to create it`,
    );
  }

  const expected = readFileSync(goldenPath, "utf8");
  if (actual !== expected) {
    throw new AssertionError(`golden mismatch for ${goldenPath}\n${diffExcerpt(actual, expected)}`);
  }
}
