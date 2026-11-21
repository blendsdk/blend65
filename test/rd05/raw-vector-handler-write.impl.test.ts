import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";

/** One handler and one ordinary function, so either kind of address can be written. */
const DECLARATIONS = `interrupt function onRaster(): void { poke($D020, 7); }
function plain(): void { poke($D021, 7); }`;

/** Wrap one statement in a program that declares both function kinds. */
function program(statement: string): string {
  return `module Game;
${DECLARATIONS}
function main(): void { ${statement} }
`;
}

/** What one raw word write actually did: whether it was refused, and what it emitted. */
interface Outcome {
  readonly codes: readonly string[];
  readonly writes: number;
}

/**
 * Compile one raw word write and report its refusal codes together with the writes it emitted.
 *
 * Both halves are needed in one record, because the defect this covers was not a wrong diagnostic
 * or wrong code in isolation: it was a build that reported success while emitting neither.
 */
async function outcome(statement: string, destination: string): Promise<Outcome> {
  return await withProfileProject(program(statement), PROFILE, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    const codes = [
      ...new Set(
        [
          ...(checked.kind === "success" ? [] : checked.diagnostics),
          ...(built.kind === "success" ? [] : built.diagnostics),
        ]
          .filter(({ severity }) => severity === "error")
          .map(({ code }) => code),
      ),
    ].sort();
    if (built.kind !== "success") return { codes, writes: 0 };
    const artifacts = await readProfileArtifacts(built);
    const low = Number.parseInt(destination, 16);
    const pattern = new RegExp(
      `^sta(\\+[12])? \\$(${low.toString(16).padStart(4, "0")}|${(low + 1).toString(16).padStart(4, "0")})$`,
      "iu",
    );
    const writes = artifacts.assembly
      .split("\n")
      .map((line) => line.split(";")[0]?.trim() ?? "")
      .filter((line) => pattern.test(line)).length;
    return { codes, writes };
  });
}

describe("a raw word write of a function address", () => {
  it.each([
    ["a handler at a recognized vector", "pokew($0314, &onRaster);", "0314", ["E10252"]],
    ["a handler at ordinary memory", "pokew($C000, &onRaster);", "c000", ["E10080"]],
    ["an ordinary function", "pokew($C000, &plain);", "c000", ["E10080"]],
    ["a function at a recognized vector", "pokew($0314, &plain);", "0314", ["E10080"]],
    [
      "an address held in a variable first",
      "let w: word = &onRaster; pokew($C000, w);",
      "c000",
      ["E10080"],
    ],
  ])(
    "should refuse rather than quietly emit nothing: %s",
    async (_case, statement, destination, codes) => {
      // The defect. Every one of these spellings used to compile successfully and emit no write at
      // all, because the value was abandoned without a diagnostic and the statement went with it.
      // Which code is right differs by destination; that none of them may be silent does not.
      expect(await outcome(statement, destination)).toEqual({ codes, writes: 0 });
    },
    180_000,
  );

  it.each([
    ["a converted handler address", "pokew($C000, word(&onRaster));"],
    ["a converted function address", "pokew($C000, word(&plain));"],
  ])(
    "should still emit both bytes once the conversion is written: %s",
    async (_case, statement) => {
      // The other half of the same invariant, and the reason the fix is a diagnostic rather than a
      // restriction: written down, exposing an address is ordinary and the write lands.
      expect(await outcome(statement, "c000")).toEqual({ codes: [], writes: 2 });
    },
    180_000,
  );

  it("should leave an address the compiler can no longer see as an unsafe boundary", async () => {
    // Routing the value through a variable erases what the compiler knew about it, and the
    // language keeps that an explicit boundary rather than a refusal. The write must land even at
    // a recognized vector, because nothing visible says a handler entry is what arrives there.
    expect(await outcome("let w: word = word(&onRaster); pokew($0314, w);", "0314")).toEqual({
      codes: [],
      writes: 2,
    });
  }, 180_000);

  it("should refuse an aggregate the same way, having dropped those writes too", async () => {
    // Not a function address at all, and the same silence: any value that is not a scalar met the
    // same unreported dead end. Covered here so the fix is pinned at its actual scope.
    expect(await outcome("let pair: byte[2]; pokew($C000, pair);", "c000")).toEqual({
      codes: ["E10080"],
      writes: 0,
    });
  }, 180_000);
});
