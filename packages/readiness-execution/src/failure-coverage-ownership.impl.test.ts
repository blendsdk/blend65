import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  rd05CoverageFiles,
  rd05ParticipatingExistingFiles,
  rd05PreimplementationAncestor,
  rd05ReviewOnlyExclusions,
} from "./test-fixtures/rd05-coverage-sources.js";

const SOURCE_DIRECTORY = new URL("./", import.meta.url);
const EXECUTION_CORE_FILES = new Set([
  "execution-predicate-contracts.ts",
  "execution-report-predicate-association.ts",
  "execution-report-provenance.ts",
  "execution-route-evidence.ts",
  "execution-tool-discovery.ts",
]);

function duplicateEntries(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("failure coverage ownership", () => {
  it("should own every failure and reduction production module exactly once", () => {
    const productionFiles = readdirSync(SOURCE_DIRECTORY)
      .filter(
        (name) =>
          (name.startsWith("failure-") ||
            name.startsWith("reduction-") ||
            EXECUTION_CORE_FILES.has(name)) &&
          name.endsWith(".ts") &&
          !name.includes(".test.") &&
          !name.endsWith("-spec-support.ts"),
      )
      .map((name) => `src/${name}`)
      .sort();

    expect(rd05CoverageFiles).toEqual(productionFiles);
    expect(rd05ParticipatingExistingFiles).toEqual([...rd05ParticipatingExistingFiles].sort());
    expect(rd05ReviewOnlyExclusions).toEqual([...rd05ReviewOnlyExclusions].sort());
    expect(duplicateEntries(rd05CoverageFiles)).toEqual([]);
    expect(duplicateEntries(rd05ParticipatingExistingFiles)).toEqual([]);
    expect(
      rd05CoverageFiles.filter((name) => rd05ParticipatingExistingFiles.includes(name)),
    ).toEqual([]);
    expect(rd05CoverageFiles.filter((name) => rd05ReviewOnlyExclusions.includes(name))).toEqual([]);
    expect(
      rd05ParticipatingExistingFiles.filter((name) => rd05ReviewOnlyExclusions.includes(name)),
    ).toEqual([]);
  });

  it("should retain an exact baseline and explicit review-only exclusions", () => {
    const sourceFiles = new Set(readdirSync(SOURCE_DIRECTORY).map((name) => `src/${name}`));

    expect(rd05PreimplementationAncestor).toMatch(/^[0-9a-f]{40}$/u);
    expect(rd05ParticipatingExistingFiles.every((name) => sourceFiles.has(name))).toBe(true);
    expect(rd05ReviewOnlyExclusions.every((name) => sourceFiles.has(name))).toBe(true);
    expect(rd05ReviewOnlyExclusions).toContain("src/index.ts");
    expect(rd05ReviewOnlyExclusions).toContain("src/execution-handler-catalog.generated.ts");
  });
});
