import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const restore = "c64.system.restoreIRQ()";
const lease = `c64.system.setIRQExclusive(&onIRQ);
  ${restore};`;

/** Mask IRQ entry across the raw operation and the complete exclusive lease. */
function program(body: string, declarations = ""): string {
  return `module Game;
interrupt function onIRQ(): void {}
${declarations}
function main(): void {
  asm_php(); asm_sei();
  ${body}
  asm_plp();
}`;
}

/** Both public entry points must blame the final release and forbid generation. */
async function expectRejected(source: string, profile: string, restoreOccurrence = 0) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    for (const result of [checked, built]) {
      expect.soft(result.kind, JSON.stringify(result.diagnostics)).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect.soft(errors).toHaveLength(1);
      expect.soft(errors[0]).toMatchObject({
        code: "E10278",
        severity: "error",
        primarySpan: profileSpan(source, restore, restoreOccurrence),
      });
    }
    expect.soft(built).not.toHaveProperty("generation");
  });
}

/** Admission controls reach real artifact construction on the same public paths. */
async function expectAccepted(source: string, profile: string) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    for (const result of [checked, built]) {
      expect.soft(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
      expect.soft(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    }
    expect.soft(built).toHaveProperty("generation");
  });
}

const rawMutations = [
  { name: "Timer A latch", statement: "poke($DC04, 0);" },
  { name: "Timer B latch", statement: "poke($DC06, 0);" },
  { name: "Timer A control", statement: "poke($DC0E, 0);" },
  { name: "Timer B control", statement: "poke($DC0F, 0);" },
  { name: "interrupt mask", statement: "poke($DC0D, $1F);" },
  { name: "mirrored interrupt mask", statement: "poke($DC1D, $1F);" },
  { name: "word write crossing into Timer A", statement: "pokew($DC03, 0);" },
] as const;

describe.each(profiles)("CIA1 stock-handback provenance on %s", (profile) => {
  // Installing an exclusive route cannot erase earlier known raw device mutations.
  it.each(rawMutations)(
    "should reject final release after a pre-install raw $name mutation",
    async ({ statement }) => {
      await expectRejected(program(`${statement}\n  ${lease}`), profile);
    },
  );

  // Effects from ordinary transitive calls retain the same device provenance as direct writes.
  it("should reject final release after a transitive pre-install helper mutation", async () => {
    const declarations = `function mutateTimer(): void { poke($DC04, 0); }
function prepareDevice(): void { mutateTimer(); }`;
    await expectRejected(program(`prepareDevice();\n  ${lease}`, declarations), profile);
  });

  // A possible raw mutation in one runtime arm makes the shared final handback unsafe.
  it("should reject final release when one pre-install runtime arm mutates CIA1", async () => {
    const body = `if (peek($0403) == 0) { poke($DC0E, 0); }
  else { asm_nop(); }
  ${lease}`;
    await expectRejected(program(body), profile);
  });

  // Releasing a clean lease does not grant ownership for a later raw mutation.
  it("should reject the second final release after raw mutation between released leases", async () => {
    await expectRejected(program(`${lease}\n  poke($DC0D, $1F);\n  ${lease}`), profile, 1);
  });

  // Stock entry permits a final exclusive release without any preceding device mutation.
  it("should accept clean stock entry and final exclusive release", async () => {
    await expectAccepted(program(lease), profile);
  });

  // Ordinary RAM writes do not invalidate the stock CIA1 timer-service precondition.
  it("should accept a pre-install raw RAM write", async () => {
    await expectAccepted(program(`poke($0400, 1);\n  ${lease}`), profile);
  });

  // CIA1 port data and direction are outside the timer/control/ICR handback proof.
  it("should accept pre-install raw CIA1 port data and direction writes", async () => {
    const body = `poke($DC00, $FF); poke($DC01, $FF);
  poke($DC02, 0); poke($DC03, 0);
  ${lease}`;
    await expectAccepted(program(body), profile);
  });

  // Runtime addresses retain the existing explicit caller-owned hardware escape.
  it("should accept a pre-install opaque runtime word-address write", async () => {
    const body = `let address: word = $0400 + peek($0403);
  poke(address, 1);
  ${lease}`;
    await expectAccepted(program(body), profile);
  });
});
