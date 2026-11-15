import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

const boundedLeft = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed & 7; answer = 1 << count; }`;

const boundedRight = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed & 7; answer = byte(128) >> count; }`;

const unbounded = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed; answer = 1 << count; }`;

const reassigned = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void { let count: byte = seed & 7; count = seed; answer = 1 << count; }`;

const rawBarrier = `module Game;
let seed: byte = 7;
let answer: byte = 0;
function main(): void {
  let count: byte = seed & 7;
  poke(peekw($0330), 0);
  answer = 1 << count;
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
async function buildBody(source: string, profile: string) {
  return withProfileProject(source, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") return [];
    return mainBody(join(built.generation.directory, ".asm"));
  });
}

describe.each(sourceLibraryProfiles)("variable shift zero-count reuse on %s", (profile) => {
  it("should load a bounded left immediate before its count", async () => {
    const body = await buildBody(boundedLeft, profile);
    expect(body.some((line) => line === "lda #$01")).toBe(true);
    expect(body.filter((line) => /^ldx/u.test(line))).toHaveLength(1);
    expect(body.some((line) => /^cpx #\$08$/u.test(line))).toBe(false);
    expect(body.some((line) => /^bcs /u.test(line))).toBe(false);
    expect(body.some((line) => /^beq /u.test(line))).toBe(true);
    expect(body.some((line) => line === "asl")).toBe(true);
    expect(body.some((line) => line === "dex")).toBe(true);
    expect(body.some((line) => /^bne /u.test(line))).toBe(true);
  }, 120_000);

  it("should load a bounded right immediate before its count", async () => {
    const body = await buildBody(boundedRight, profile);
    expect(body.some((line) => line === "lda #$80")).toBe(true);
    expect(body.filter((line) => /^ldx/u.test(line))).toHaveLength(1);
    expect(body.some((line) => /^cpx #\$08$/u.test(line))).toBe(false);
    expect(body.some((line) => /^bcs /u.test(line))).toBe(false);
    expect(body.some((line) => line === "lsr")).toBe(true);
  }, 120_000);

  it("should keep the saturation tests for an unbounded count", async () => {
    const body = await buildBody(unbounded, profile);
    expect(body.some((line) => /^cpx #\$08$/u.test(line))).toBe(true);
    expect(body.some((line) => /^bcs /u.test(line))).toBe(true);
    const ldx = body.findIndex((line) => /^ldx/u.test(line));
    const immediate = body.findIndex((line) => line === "lda #$01");
    expect(ldx).toBeGreaterThanOrEqual(0);
    expect(immediate).toBeGreaterThan(ldx);
  }, 120_000);

  it("should keep the saturation tests after a reassignment", async () => {
    const body = await buildBody(reassigned, profile);
    expect(body.some((line) => /^cpx #\$08$/u.test(line))).toBe(true);
    expect(body.some((line) => /^bcs /u.test(line))).toBe(true);
  }, 120_000);

  it("should keep the saturation tests across an escaping raw write", async () => {
    const body = await buildBody(rawBarrier, profile);
    expect(body.some((line) => /^cpx #\$08$/u.test(line))).toBe(true);
    expect(body.some((line) => /^bcs /u.test(line))).toBe(true);
  }, 120_000);
});
