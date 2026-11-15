import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** The classifier witness whose dense chain starts at `seed == 0`. */
const classifierSource = `module Game;
let data: byte[8] = [0; 8];
let seed: byte = 1;
let answer: byte = 0;
function work(): byte {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  if (seed == 0) { return 0; }
  if (seed == 1) { return 127; }
  if (seed == 2) { return 255; }
  if (seed == 3) { return 0; }
  if (seed == 4) { return 127; }
  if (seed == 5) { return 255; }
  if (seed == 6) { return 0; }
  if (seed == 7) { return 127; }
  return 255;
}
function main(): void { answer = work(); }`;

/** The same shape with a skipped comparison: the dense prefix ends at the gap. */
const gapSource = `module Game;
let seed: byte = 1;
let answer: byte = 0;
function work(): byte {
  if (seed == 0) { return 0; }
  if (seed == 2) { return 127; }
  return 255;
}
function main(): void { answer = work(); }`;

/** Read the assembled `Game.work` routine body without neighbouring routines. */
async function workBody(asmPath: string): Promise<readonly string[]> {
  const lines = (await readFile(asmPath, "utf8")).split("\n");
  const start = lines.findIndex((line) => /^b65_Game_work_[0-9a-f]+:/u.test(line));
  if (start < 0) throw new Error("Missing Game.work routine");
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^b65_/u.test(line) && !line.includes("_work_")) break;
    const text = line.trim();
    if (text.length === 0 || text.startsWith(";") || text.startsWith("*")) continue;
    body.push(text);
  }
  return body;
}

/** Build one witness and return its assembled work body. */
async function buildBody(source: string, profile: string, boundsCheck: boolean) {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none", boundsCheck });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return [];
    return workBody(join(built.generation.directory, ".asm"));
  });
}

describe.each(sourceLibraryProfiles)("stable byte classifier chain on %s", (profile) => {
  for (const boundsCheck of [false, true]) {
    it(`should reuse one seed load and compare immediately with bounds ${boundsCheck ? "on" : "off"}`, async () => {
      const body = await buildBody(classifierSource, profile, boundsCheck);
      expect(body.filter((line) => /^lda\+2 b65_Game_seed_/u.test(line))).toHaveLength(1);
      expect(body.filter((line) => /^eor/u.test(line))).toHaveLength(0);
      for (let value = 1; value <= 7; value += 1)
        expect(
          body.filter((line) => line === `cmp #$${value.toString(16).padStart(2, "0")}`),
        ).toHaveLength(1);
    }, 120_000);
  }

  it("should keep the ordinary reload at a skipped comparison", async () => {
    const body = await buildBody(gapSource, profile, false);
    expect(body.some((line) => /^eor #\$02$/u.test(line))).toBe(true);
  }, 120_000);
});
