import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { BOING_BALL_DIR, assembleTwin, labels } from "./boing-ball-fixture.js";

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

/**
 * The measured expert-parity debt for the first game-shaped fixture.
 *
 * These pins are the current compiler output against the hand-written twin.
 * Improving the compiler should move them down; any increase is a regression
 * and must be justified by a new capability, not silent drift. The steady-state
 * frame cycle count is not published by the compiler for this non-returning
 * loop, so the byte and storage costs are the tracked rows for now.
 */
const expected = {
  exampleCodeBytes: 1151,
  exampleProgramBytes: 7167,
  exampleZeroPage: 0,
  twinCodeBytes: 442,
  twinProgramBytes: 7167,
} as const;

describe("boing-ball expert parity cost", () => {
  it("records the compiler output against the hand-written twin", async () => {
    const built = await buildProject({ project: join(BOING_BALL_DIR, "blend65.json") });
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
    const zeroPage = resources.find((entry) => entry.id === "zeroPage");
    const code = Array.isArray(costs.entries)
      ? costs.entries
          .map(record)
          .filter((entry) => entry.component === "code")
          .reduce((sum, entry) => sum + numeric(entry.bytes, "code bytes"), 0)
      : 0;
    const twin = await assembleTwin();
    try {
      const symbols = labels(twin.symbol);
      const start = symbols.get("start");
      const end = symbols.get("codeEnd");
      if (start === undefined || end === undefined)
        throw new Error("missing twin start/codeEnd symbols");
      const twinImage = await readFile(twin.prg);
      expect({
        exampleCodeBytes: code,
        exampleProgramBytes: numeric(totals.programBytes, "program bytes"),
        exampleZeroPage: zeroPage === undefined ? -1 : numeric(zeroPage.value, "zeroPage"),
        twinCodeBytes: end - start,
        twinProgramBytes: twinImage.length - 2,
      }).toEqual(expected);
      expect(image.length - 2, "PRG payload").toBe(numeric(totals.programBytes, "program bytes"));
    } finally {
      await twin.cleanup();
    }
  }, 180_000);
});
