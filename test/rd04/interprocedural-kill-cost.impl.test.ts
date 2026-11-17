import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";

/** One accepted program and the exact output costs the analysis must preserve. */
interface CostCase {
  readonly name: string;
  readonly source: string;
  readonly prgBytes: number;
  readonly programBytes: number;
  readonly codeBytes: number;
  readonly zeroPage: number;
  readonly scratch: number;
}

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

const cases: readonly CostCase[] = [
  {
    name: "definite helper restore",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function repair(): void { callback = &chosen; }
function main(): void { pokew(&callback, 0); repair(); poke($C000, callback()); }`,
    prgBytes: 710,
    programBytes: 708,
    codeBytes: 696,
    zeroPage: 4,
    scratch: 0,
  },
  {
    name: "placed definite helper restore",
    source: `module Game;
place(at: $C100) let callback: fn(): byte;
function chosen(): byte { return 37; }
function repair(): void { callback = &chosen; }
function main(): void { pokew(&callback, 0); repair(); poke($C000, callback()); }`,
    prgBytes: 710,
    programBytes: 708,
    codeBytes: 696,
    zeroPage: 4,
    scratch: 0,
  },
  {
    name: "helper corrupt then restore",
    source: `module Game;
let callback: fn(): byte;
function chosen(): byte { return 37; }
function corruptThenRepair(): void { pokew(&callback, 0); callback = &chosen; }
function main(): void { callback = &chosen; corruptThenRepair(); poke($C000, callback()); }`,
    prgBytes: 720,
    programBytes: 718,
    codeBytes: 706,
    zeroPage: 4,
    scratch: 0,
  },
  {
    name: "disjoint borrowed field",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; poke(&box.prefix, 0); poke($C000, box.cb()); }`,
    prgBytes: 753,
    programBytes: 751,
    codeBytes: 739,
    zeroPage: 6,
    scratch: 0,
  },
  {
    name: "checked sibling-array write",
    source: `module Game;
struct Box { data: byte[2]; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function main(): void { box.cb = &chosen; poke(&box.data[peek($0400) & 1], 0); poke($C000, box.cb()); }`,
    prgBytes: 773,
    programBytes: 771,
    codeBytes: 759,
    zeroPage: 6,
    scratch: 0,
  },
  {
    name: "distinct aggregate objects",
    source: `module Game;
struct Box { cb: fn(): byte; }
let left: Box;
let right: Box;
function chosen(): byte { return 37; }
function inspect(p: Box): void { poke($C000, p.cb()); }
function main(): void { left.cb = &chosen; right.cb = &chosen; inspect(left); inspect(right); pokew(&left.cb, 0); poke($C000, right.cb()); }`,
    prgBytes: 861,
    programBytes: 859,
    codeBytes: 847,
    zeroPage: 8,
    scratch: 0,
  },
  {
    name: "opaque write without a later callable read",
    source: `module Game;
function main(): void { poke(peekw($0330), 0); poke($C000, 7); }`,
    prgBytes: 667,
    programBytes: 665,
    codeBytes: 653,
    zeroPage: 2,
    scratch: 0,
  },
  {
    name: "borrowed disjoint byte",
    source: `module Game;
struct Box { prefix: byte; cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function corruptPrefix(p: Box): void { poke(&p.prefix, 0); }
function main(): void { box.cb = &chosen; corruptPrefix(box); poke($C000, box.cb()); }`,
    prgBytes: 769,
    programBytes: 767,
    codeBytes: 755,
    zeroPage: 6,
    scratch: 0,
  },
  {
    name: "helper writes unrelated storage",
    source: `module Game;
let callback: fn(): byte;
let other: word;
function chosen(): byte { return 37; }
function touchOther(): void { pokew(&other, 0); }
function main(): void { callback = &chosen; other = 0; touchOther(); poke($C000, callback()); }`,
    prgBytes: 673,
    programBytes: 671,
    codeBytes: 659,
    zeroPage: 0,
    scratch: 0,
  },
];

describe("interprocedural kill analysis preserves accepted output", () => {
  it.each(cases)(
    "keeps the exact artifact cost for $name",
    async (testCase) => {
      await withProfileProject(testCase.source, "c64-pal-prg-kernal-6581", async (project) => {
        const built = await buildProject({ project, optimization: "none" });
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
          zeroPage: testCase.zeroPage,
          scratch: testCase.scratch,
        });
      });
    },
    120_000,
  );
});
