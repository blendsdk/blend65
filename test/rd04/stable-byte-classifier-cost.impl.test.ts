import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

/** Narrow one untrusted evidence record without trusting its shape. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new TypeError("Expected a costs record");
  return value as Record<string, unknown>;
}

/** Read a numeric evidence member or fail instead of treating it as zero. */
function numeric(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new TypeError(`Expected numeric ${label}`);
  return value;
}

const source = `module Game;
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

const cases = [
  { boundsCheck: false, prgBytes: 255, programBytes: 253, codeBytes: 241 },
  { boundsCheck: true, prgBytes: 271, programBytes: 269, codeBytes: 257 },
] as const;

describe("stable byte classifier accepted output", () => {
  for (const testCase of cases) {
    it(`keeps the exact chain artifact with bounds ${testCase.boundsCheck ? "on" : "off"}`, async () => {
      await withProfileProject(source, "c64-pal-prg-kernal-6581", async (project) => {
        const built = await buildProject({
          project,
          optimization: "none",
          boundsCheck: testCase.boundsCheck,
        });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") return;
        const image = await readFile(
          join(built.generation.directory, built.generation.primaryArtifact),
        );
        const costs = record(
          JSON.parse(await readFile(join(built.generation.directory, ".costs.json"), "utf8")),
        );
        const totals = record(costs.totals);
        const resources = Array.isArray(totals.resources) ? totals.resources.map(record) : [];
        const resource = (id: string): number => {
          const found = resources.find((entry) => entry.id === id);
          return found === undefined ? -1 : numeric(found.value, id);
        };
        const code = Array.isArray(costs.entries)
          ? costs.entries
              .map(record)
              .filter((entry) => entry.component === "code")
              .reduce((sum, entry) => sum + numeric(entry.bytes, "code bytes"), 0)
          : 0;
        expect({
          prgBytes: image.length,
          programBytes: numeric(totals.programBytes, "program bytes"),
          codeBytes: code,
          zeroPage: resource("zeroPage"),
          scratch: resource("scratch"),
        }).toEqual({
          prgBytes: testCase.prgBytes,
          programBytes: testCase.programBytes,
          codeBytes: testCase.codeBytes,
          zeroPage: 2,
          scratch: 0,
        });
      });
    }, 120_000);
  }
});
