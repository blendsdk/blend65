import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const bounded = `module Game;
let answer: byte = 0;
function main(): void {
  let i: byte = peek($0400) & 3;
  poke($0400 + i, 7);
}`;

const unbounded = `module Game;
function main(): void {
  let i: byte = peek($0400);
  poke($0400 + i, 7);
}`;

const device = `module Game;
function main(): void {
  let i: byte = peek($0400) & 3;
  poke($D800 + i, 7);
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

/** Build one witness in one optimization mode and return its main body. */
async function buildBody(source: string, profile: string, optimization: "none" | "size") {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return [];
    return mainBody(join(built.generation.directory, ".asm"));
  });
}

describe.each(sourceLibraryProfiles)("straight-line ordinal write on %s", (profile) => {
  it("should use the absolute indexed store in size mode", async () => {
    const body = await buildBody(bounded, profile, "size");
    expect(body.some((line) => /^sta\+2 \$0400,x$/u.test(line))).toBe(true);
    expect(body.some((line) => /^sta \(/u.test(line))).toBe(false);
    expect(body.some((line) => /^ldx/u.test(line))).toBe(true);
  }, 120_000);

  it("should keep the canonical indirect store in none mode", async () => {
    const body = await buildBody(bounded, profile, "none");
    expect(body.some((line) => /^sta \(/u.test(line))).toBe(true);
    expect(body.some((line) => /^sta\+2 \$0400,x$/u.test(line))).toBe(false);
  }, 120_000);

  it("should keep the indirect store for an unbounded index", async () => {
    const body = await buildBody(unbounded, profile, "size");
    expect(body.some((line) => /^sta \(/u.test(line))).toBe(true);
    expect(body.some((line) => /^sta\+2 \$0400,x$/u.test(line))).toBe(false);
  }, 120_000);

  it("should keep the indirect store for a device-window base", async () => {
    const body = await buildBody(device, profile, "size");
    expect(body.some((line) => /^sta \(/u.test(line))).toBe(true);
    expect(body.some((line) => /^sta\+2 \$d800,x$/iu.test(line))).toBe(false);
  }, 120_000);
});
