import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];

/** Each case specifies legal source ownership or one exact unsafe vector-writing operation. */
type WriterCase = {
  name: string;
  declarations?: string;
  body: string;
  ownsNmi?: false;
  rejectedWrite?: string;
};

const CASES: WriterCase[] = [
  {
    name: "should allow a live local byte address during a balanced NMI lifetime",
    body: "let x: byte = 0; poke(word(&x), 1);",
  },
  {
    name: "should allow a module byte address during a balanced NMI lifetime",
    declarations: "let x: byte = 0;",
    body: "poke(word(&x), 1);",
  },
  {
    name: "should retain a local object's disjoint address through ordinary word copies",
    body: "let x: byte = 0; let address: word = word(&x); let copy: word = address; poke(copy, 1);",
  },
  {
    name: "should retain a module object's disjoint address through ordinary word copies",
    declarations: "let x: byte = 0;",
    body: "let address: word = word(&x); let copy: word = address; poke(copy, 1);",
  },
  {
    name: "should preserve an agreeing owned address across conditional joins",
    body: "let x: byte = 0; let address: word = word(&x); if (peek($c012) != 0) { address = word(&x); } else { address = word(&x); } poke(address, 1);",
  },
  {
    name: "should preserve an agreeing owned address across finite loop joins",
    body: "let x: byte = 0; let address: word = word(&x); for (let i: byte = 0; i < 2; i = i + 1) { address = word(&x); } poke(address, 1);",
  },
  {
    name: "should allow byte and word writes within a live local word object",
    body: "let x: word = 0; poke(word(&x), 1); pokew(word(&x), $2211);",
  },
  {
    name: "should allow byte and word writes within a module word object",
    declarations: "let x: word = 0;",
    body: "poke(word(&x), 1); pokew(word(&x), $2211);",
  },
  {
    name: "should allow byte and word writes within an owned zero-page word object",
    declarations: "zeropage { x: word = 0; }",
    body: "poke(word(&x), 1); pokew(word(&x), $2211);",
  },
  {
    name: "should allow byte and word writes at an explicitly placed disjoint RAM object",
    declarations: "place(at: $c020) let x: word = 0;",
    body: "poke(word(&x), 1); pokew(word(&x), $2211);",
  },
  {
    name: "should reject the second byte of a word write from a placed object next to NMINV",
    declarations: "place(at: $0317) let x: byte;",
    body: "pokew(word(&x), $2211);",
    rejectedWrite: "pokew(word(&x), $2211)",
  },
  {
    name: "should reject a fixed word write whose second byte overlaps the owned NMI vector",
    body: "pokew($0317, $2211);",
    rejectedWrite: "pokew($0317, $2211)",
  },
  {
    name: "should reject a fixed byte write to the owned NMI vector low byte",
    body: "poke($0318, 1);",
    rejectedWrite: "poke($0318, 1)",
  },
  {
    name: "should reject a fixed byte write to the owned NMI vector high byte",
    body: "poke($0319, 1);",
    rejectedWrite: "poke($0319, 1)",
  },
  {
    name: "should reject a loaded opaque address that may write the owned NMI vector",
    body: "let address: word = peekw($c010); poke(address, 1);",
    rejectedWrite: "poke(address, 1)",
  },
  {
    name: "should reject opaque address bits narrowed and recombined into an arbitrary word",
    body: "let address: word = peekw($c010); let lower: byte = lo(address); let upper: byte = hi(address); let rebuilt: word = word(lower) | (word(upper) << 8); poke(rebuilt, 1);",
    rejectedWrite: "poke(rebuilt, 1)",
  },
  {
    name: "should reject arbitrary address arithmetic without a proof of vector disjointness",
    body: "let address: word = peekw($c010); poke(address + 1, 1);",
    rejectedWrite: "poke(address + 1, 1)",
  },
  {
    name: "should allow an ordinary opaque address write without generated NMI ownership",
    ownsNmi: false,
    body: "let address: word = peekw($c010); poke(address, 1);",
  },
];

/** Keep high-level ownership balanced; raw writes do not acquire an artificial source restriction. */
function writerSource(fixture: WriterCase): string {
  const ownsNmi = fixture.ownsNmi !== false;
  return `module Game;
import { setNMI, restoreNMI } from c64.system;
${fixture.declarations ?? ""}
interrupt function empty(): void {}
export function main(): void {
  ${ownsNmi ? "setNMI(&empty);" : ""}
  ${fixture.body}
  ${ownsNmi ? "restoreNMI();" : ""}
}
`;
}

describe.each(TARGETS)("Owned address writes during NMI ownership on %s", (target) => {
  for (const fixture of CASES) {
    // A real build judges the complete ownership lifetime, not only frontend expression typing.
    it(
      fixture.name,
      async () => {
        const source = writerSource(fixture);
        await withProfileProject(source, target, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          if (fixture.rejectedWrite !== undefined) {
            expect(built.kind, JSON.stringify(built.diagnostics)).toBe("failure");
            expect(built.diagnostics).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  code: "E10278",
                  severity: "error",
                  primarySpan: profileSpan(source, fixture.rejectedWrite),
                }),
              ]),
            );
          } else {
            expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
            if (built.kind !== "success") throw new Error("Expected real ACME publication");
            const artifacts = await readProfileArtifacts(built);
            expect(artifacts.prg.length).toBeGreaterThan(2);
          }
        });
      },
      30_000,
    );
  }
});
