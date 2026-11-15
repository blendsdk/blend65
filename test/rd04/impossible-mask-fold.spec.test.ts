import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const source = (operator: "==" | "!=", constant = 3) => `module Game;
let finished: boolean = false;
function main(): void {
  finished = ((peek($DD0D) & 14) ${operator} ${constant});
  if (finished) { poke($0410, 1); } else { poke($0410, 0); }
}`;

/** Read the assembled `Game.main` routine body without neighbouring routines. */
async function mainBody(asmPath: string): Promise<readonly string[]> {
  const lines = (await readFile(asmPath, "utf8")).split("\n");
  const start = lines.findIndex((line) => /^b65_Game_main_[0-9a-f]+:/u.test(line));
  if (start < 0) throw new Error("Missing Game.main routine");
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^b65_/u.test(line) && !line.includes("_main_")) break;
    const text = line.trim();
    if (text.length === 0 || text.startsWith(";") || text.startsWith("*")) continue;
    body.push(text);
  }
  return body;
}

/** Build one witness and return its assembled main body. */
async function buildBody(text: string, profile: string) {
  return withProfileProject(text, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return [];
    return mainBody(join(built.generation.directory, ".asm"));
  });
}

describe.each(sourceLibraryProfiles)("impossible masked comparison on %s", (profile) => {
  it("should materialize a false equality from one ICR read", async () => {
    const body = await buildBody(source("=="), profile);
    expect(body.filter((line) => line === "lda $dd0d")).toHaveLength(1);
    expect(body.some((line) => line === "lda #$00")).toBe(true);
    expect(body.some((line) => line === "and #$0e")).toBe(false);
    expect(body.some((line) => line === "eor #$03")).toBe(false);
  }, 120_000);

  it("should materialize a true inequality from one ICR read", async () => {
    const body = await buildBody(source("!="), profile);
    expect(body.filter((line) => line === "lda $dd0d")).toHaveLength(1);
    expect(body.some((line) => line === "lda #$01")).toBe(true);
    expect(body.some((line) => line === "and #$0e")).toBe(false);
    expect(body.some((line) => line === "eor #$03")).toBe(false);
  }, 120_000);

  it("should keep the mask and comparison for a reachable constant", async () => {
    const body = await buildBody(source("==", 2), profile);
    expect(body.filter((line) => line === "lda $dd0d")).toHaveLength(1);
    expect(body.some((line) => line === "and #$0e")).toBe(true);
    expect(body.some((line) => line === "eor #$02")).toBe(true);
  }, 120_000);
});
