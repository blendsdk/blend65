/**
 * Specification tests (LOCAL tier) for `for`-loop termination and exact visit
 * counts on real hardware.
 *
 * A `for` loop whose counter passes its bound by WRAPPING rather than reaching
 * it must still terminate, and must visit its range exactly once. No in-process
 * interpreter can observe termination — a non-terminating loop simply never
 * returns — so these are the only tests that can. Each probe runs a real
 * compiled binary under VICE: the loop tallies its iterations into a word, the
 * program publishes that tally and then a settle sentinel, and the sentinel is
 * the whole point — it is written only if the loop actually terminated. A loop
 * that hangs never reaches it, and the observable wait times out.
 *
 * Gated on VICE + ACME, which CI has no emulator tier for; proven green
 * locally. Each cell covers a corner of the wrap space:
 * direction × width × sign × step × bound-spelling, plus interior and zero-trip
 * controls that already terminate today.
 */

import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build, type BuildResult } from "@blend65/compiler";
import { hasAcme, hasVice, setupEmulator } from "./fixture.js";
import { assertObservables, type ProgramObservables } from "./testing/observables.js";
import type { EmulatorDriver } from "./emulator/driver.js";

/**
 * A running hang must fail in bounded time, not wedge the suite. Green runs
 * settle in a few seconds; this cap only bites a regression that reintroduces
 * a non-terminating loop.
 */
const LOCAL_TEST_TIMEOUT = 30000;

/** The `$C0xx` free-RAM sentinels the probes publish into (untouched by KERNAL/BASIC). */
const SENTINEL_DONE = 0xc000; // settle byte — written last, proves the loop returned
const TALLY_LO = 0xc010; // iteration tally, low byte
const TALLY_HI = 0xc011; // iteration tally, high byte
const SETTLED = 0x5a;

/** One termination probe: a loop header, the counter cell it exercises, and its exact visit count. */
interface Cell {
  /** A `should … when …` sentence naming the behavior. */
  readonly name: string;
  /** The `for (...)` header — the counter cell under test. */
  readonly header: string;
  /** The exact number of iterations the loop must run before terminating. */
  readonly visits: number;
}

/**
 * The wrap-space corners. Each loop tallies its iterations into a word so a
 * 256-visit range is representable; the interior and zero-trip rows are
 * controls that already terminate correctly and must keep doing so.
 */
const CELLS: readonly Cell[] = [
  // byte · to · full-range wrap (the headline 256-visit page loop)
  {
    name: "terminates a full-range byte page loop with 256 visits",
    header: "for (let i: byte = 0 to 255)",
    visits: 256,
  },
  // byte · downto · bound at the extreme (the headline countdown)
  {
    name: "terminates a byte countdown to zero with 10 visits",
    header: "for (let i: byte = 9 downto 0)",
    visits: 10,
  },
  // word · to · bound at the extreme
  {
    name: "terminates a word loop to the 16-bit maximum with 16 visits",
    header: "for (let i: word = 0xFFF0 to 0xFFFF)",
    visits: 16,
  },
  // word · to · non-dividing step escapes past the extreme
  {
    name: "terminates a word loop whose step escapes the maximum with 6 visits",
    header: "for (let i: word = 0xFFF0 to 0xFFFF step 3)",
    visits: 6,
  },
  // sbyte · to · signed ascending THROUGH negatives (the signed-immediate cell)
  {
    name: "terminates a signed byte loop rising through negatives with 133 visits",
    header: "for (let i: sbyte = -5 to 127)",
    visits: 133,
  },
  // sbyte · downto · bound at the negative extreme
  {
    name: "terminates a signed byte countdown to the negative minimum with 9 visits",
    header: "for (let i: sbyte = -120 downto -128)",
    visits: 9,
  },
  // sword · to · bound at the positive extreme
  {
    name: "terminates a signed word loop to the 16-bit signed maximum with 8 visits",
    header: "for (let i: sword = 32760 to 32767)",
    visits: 8,
  },
  // sword · downto · bound at the negative extreme
  {
    name: "terminates a signed word countdown to the signed minimum with 8 visits",
    header: "for (let i: sword = -32761 downto -32768)",
    visits: 8,
  },
  // byte · to · non-dividing step lands on the bound then wraps (interior-escape)
  {
    name: "terminates a byte loop whose step lands on the bound with 128 visits",
    header: "for (let i: byte = 0 to 254 step 2)",
    visits: 128,
  },
  // byte · downto · non-dividing step escapes below zero
  {
    name: "terminates a byte countdown with a non-dividing step with 5 visits",
    header: "for (let i: byte = 9 downto 1 step 2)",
    visits: 5,
  },
  // byte · to · ordinary interior (control — wrap-safe, terminates today)
  {
    name: "terminates an ordinary interior byte loop with 10 visits",
    header: "for (let i: byte = 0 to 9)",
    visits: 10,
  },
  // byte · to · init past the bound (zero-trip control)
  {
    name: "runs an init-past-bound loop zero times",
    header: "for (let i: byte = 9 to 0)",
    visits: 0,
  },
];

/** Wraps a loop header into a full program that tallies visits and settles. */
function programFor(header: string): string {
  return `module Main;

function main(): void {
  let count: word = 0;
  ${header} {
    count = count + 1;
  }
  pokew(${hex(TALLY_LO)}, count);
  poke(${hex(SENTINEL_DONE)}, ${hex(SETTLED)});
}
`;
}

/** The shared observable contract: settle first, then read the tally little-endian. */
function observablesFor(visits: number): ProgramObservables {
  return {
    landmarks: [{ kind: "memory", address: SENTINEL_DONE, value: SETTLED }],
    checks: [
      {
        address: SENTINEL_DONE,
        value: SETTLED,
        note: "settle sentinel — the loop terminated and returned",
      },
      { address: TALLY_LO, value: visits & 0xff, note: "iteration tally, low byte" },
      { address: TALLY_HI, value: (visits >> 8) & 0xff, note: "iteration tally, high byte" },
    ],
  };
}

/** Format an address/byte as a Blend65 hex literal. */
function hex(value: number): string {
  return `0x${value.toString(16).toUpperCase()}`;
}

/** Compiles a program string through the real `build()` pipeline (ACME included). */
async function buildProgram(source: string): Promise<{ result: BuildResult; cleanup: () => void }> {
  const cwd = mkdtempSync(join(tmpdir(), "b65-loopterm-"));
  writeFileSync(join(cwd, "main.blend"), source, "utf8");
  const result = await build({
    platform: "c64",
    cwd,
    sourceFiles: ["main.blend"],
    outDir: join(cwd, "out"),
  });
  return { result, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
}

/**
 * A wrap-unsafe loop with a body fat enough to push its branches past the 6502
 * relative reach (−128..+127 bytes) must still ASSEMBLE: the wrap guard and the
 * loop back-edge relax to long form rather than emit an out-of-range short
 * branch ACME rejects. ACME-gated (CI installs ACME) but VICE-free — it reads
 * the assembler's verdict, not the running machine.
 */
const FAT_BODY = Array.from(
  { length: 40 },
  (_v, k) => `    poke(${hex(0x0400 + k)}, ${k & 0xff});`,
).join("\n");
const RELAX_SRC = `module Main;

function main(): void {
  for (let i: byte = 0 to 255) {
${FAT_BODY}
  }
  poke(${hex(SENTINEL_DONE)}, ${hex(SETTLED)});
}
`;

describe.skipIf(!hasAcme())("Specification: an oversized wrap-guarded loop assembles", () => {
  it(
    "should relax the loop branches and assemble under ACME when the body exceeds the relative reach",
    async () => {
      const { result, cleanup } = await buildProgram(RELAX_SRC);
      try {
        // No compile error, no assembler failure (E90001 is ACME rejecting an
        // out-of-range branch), and a real binary — the relaxation worked.
        expect(result.hasErrors).toBe(false);
        expect(result.diagnostics.filter((d) => d.code === "E90001")).toEqual([]);
        expect(result.binary).toBeInstanceOf(Uint8Array);
      } finally {
        cleanup();
      }
    },
    LOCAL_TEST_TIMEOUT,
  );
});

describe.skipIf(!(hasVice("c64") && hasAcme()))(
  "Specification: for-loop termination and visit counts on VICE",
  () => {
    const drivers: EmulatorDriver[] = [];
    const cleanups: (() => void)[] = [];

    afterAll(async () => {
      for (const driver of drivers) {
        await driver.shutdown();
      }
      for (const cleanup of cleanups) {
        cleanup();
      }
    });

    for (const cell of CELLS) {
      it(
        `should ${cell.name}`,
        async () => {
          const { result, cleanup } = await buildProgram(programFor(cell.header));
          cleanups.push(cleanup);
          // A loop that fails to compile cannot terminate correctly either —
          // the build must succeed before the machine can prove anything.
          expect(result.hasErrors).toBe(false);
          const env = await setupEmulator({ build: result, platform: "c64" });
          drivers.push(env.driver);
          await assertObservables(env.driver, observablesFor(cell.visits), {
            timeout: LOCAL_TEST_TIMEOUT,
          });
        },
        LOCAL_TEST_TIMEOUT + 10000,
      );
    }
  },
);
