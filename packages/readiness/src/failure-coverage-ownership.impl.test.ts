import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  rd05CoverageFiles,
  rd05ParticipatingExistingFiles,
  rd05PreimplementationAncestor,
  rd05ReviewOnlyExclusions,
} from "./test-fixtures/rd05-coverage-sources.js";

const SOURCE_DIRECTORY = new URL("./", import.meta.url);

function duplicateEntries(values: readonly string[]): readonly string[] {
  return values.filter((value, index) => values.indexOf(value) !== index);
}

describe("failure coverage ownership", () => {
  it("should own every failure and reduction production module exactly once", () => {
    const productionFiles = readdirSync(SOURCE_DIRECTORY)
      .filter(
        (name) =>
          (name.startsWith("failure-") || name.startsWith("reduction-")) &&
          name.endsWith(".ts") &&
          !name.includes(".test."),
      )
      .map((name) => `src/${name}`)
      .sort();
    const coveredNamespace = rd05CoverageFiles
      .filter((name) => name.startsWith("src/failure-") || name.startsWith("src/reduction-"))
      .sort();

    expect(coveredNamespace).toEqual(productionFiles);
    expect(rd05CoverageFiles).toEqual([...rd05CoverageFiles].sort());
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
  });
});
