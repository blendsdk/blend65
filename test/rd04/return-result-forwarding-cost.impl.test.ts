import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

const cases = [
  {
    name: "byte return with bounds off",
    source: `module Game;
let data: byte[8] = [0; 8];
let total: byte = 0;
function next(value: byte): byte { return value + 1; }
function main(): void {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  total = next(7);
}`,
    prgBytes: 220,
    boundsCheck: false,
  },
  {
    name: "byte return with bounds on",
    source: `module Game;
let data: byte[8] = [0; 8];
let total: byte = 0;
function next(value: byte): byte { return value + 1; }
function main(): void {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  total = next(7);
}`,
    prgBytes: 236,
    boundsCheck: true,
  },
  {
    name: "helper return",
    source: `module Game;
let total: byte = 0;
function calculate(a: byte, b: byte): byte { return a * b; }
function main(): void { total = calculate(3, 4); }`,
    prgBytes: 149,
  },
] as const;

describe("return-result forwarding accepted output", () => {
  for (const testCase of cases) {
    it(`keeps the exact ${testCase.name} artifact`, async () => {
      await withProfileProject(testCase.source, "c64-pal-prg-kernal-6581", async (project) => {
        const built = await buildProject({
          project,
          optimization: "none",
          ...("boundsCheck" in testCase ? { boundsCheck: testCase.boundsCheck } : {}),
        });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") return;
        const image = await readFile(
          join(built.generation.directory, built.generation.primaryArtifact),
        );
        expect(image.length - 2).toBe(testCase.prgBytes);
      });
    }, 120_000);
  }
});
