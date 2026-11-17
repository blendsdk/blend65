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

describe("callable-field helper accepted output", () => {
  it("keeps the exact artifact cost for the global helper witness", async () => {
    const source = `module Game;
struct Box { cb: fn(): byte; }
let box: Box;
function chosen(): byte { return 37; }
function prepare(): void { box.cb = &chosen; }
function invoke(value: Box): byte { return value.cb(); }
function main(): void { prepare(); poke($C000, invoke(box)); }`;
    await withProfileProject(source, "c64-pal-prg-kernal-6581", async (project) => {
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
      }).toEqual({ prgBytes: 705, programBytes: 703, codeBytes: 691, zeroPage: 2, scratch: 0 });
    });
  }, 120_000);
});
