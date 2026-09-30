import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const primaryProfile = profiles[0];
const restore = "c64.system.restoreIRQ()";
const timerUse = `c64.cia1.writeTimerALatch($1234);
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);`;
const handler = `interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0401, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0402, 1); }
}`;

/** Keep source fixtures complete without supplying any implicit IRQ ownership. */
function program(body: string, declarations = handler): string {
  return `module Game;
${declarations}
function main(): void {
  ${body}
}`;
}

/** Clear unknown source masks and consume pending bits before restoring caller status. */
function exclusiveProgram(body: string, declarations = handler, predecessor = ""): string {
  return program(
    `${predecessor}
  asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let initialPending: byte = c64.cia1.readAndClearPendingSources();
  poke($0400, initialPending);
  asm_plp();
  ${body}`,
    declarations,
  );
}

/** Require public source admission, allowing unrelated unused-value warnings. */
async function expectAccepted(source: string, profile = primaryProfile) {
  await withProfileProject(source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    expect(checked.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  });
}

/** Require one source-linked ownership failure and reject artifact construction too. */
async function expectRejected(source: string, operation?: string) {
  await withProfileProject(source, primaryProfile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind).toBe("failure");
    const errors = checked.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10278",
      severity: "error",
      primarySpan:
        operation === undefined ? { sourceId: "src/game.blend" } : profileSpan(source, operation),
    });
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("failure");
    expect(built).not.toHaveProperty("generation");
  });
}

describe.each(profiles)("CIA1 Timer A return for %s", (profile) => {
  // The same entry and timer use must be valid before any attempted final release.
  it("should accept the complete entry handoff and Timer A use", async () => {
    await expectAccepted(exclusiveProgram(`${timerUse}\n  for (;;) { asm_nop(); }`), profile);
  });

  // Final release to stock KERNAL service permits normal main return on every profile.
  it("should accept final exclusive restore after Timer A use", async () => {
    const source = exclusiveProgram(`${timerUse}\n  ${restore};`);
    await withProfileProject(source, profile, async (project) => {
      const checked = await checkProject({ project });
      const errors = checked.diagnostics.filter(({ severity }) => severity === "error");
      // Any ownership failure must identify release, so entry errors cannot mimic missing handback.
      for (const error of errors.filter(({ code }) => code === "E10278"))
        expect.soft(error.primarySpan).toEqual(profileSpan(source, restore));
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      expect(errors).toEqual([]);
    });
  });

  // Source admission must reach actual PRG construction, rather than stop at checking.
  it("should build a PRG after final exclusive Timer A restore", async () => {
    const source = exclusiveProgram(`${timerUse}\n  ${restore};`);
    await withProfileProject(source, profile, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      for (const error of built.diagnostics.filter(({ code }) => code === "E10278"))
        expect.soft(error.primarySpan).toEqual(profileSpan(source, restore));
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a CIA1 returning PRG");
      expect(built.generation.primaryArtifact).toMatch(/\.prg$/u);
      const prg = await readFile(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      expect(prg.length).toBeGreaterThan(2);
    });
  });
});

describe("CIA1 final and nested release boundaries", () => {
  // An exclusive lease ends legally even if its body never wrote a typed CIA1 register.
  it("should accept final exclusive restore without a typed CIA1 write", async () => {
    await expectAccepted(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  ${restore}; asm_plp();`,
        "interrupt function onIRQ(): void {}",
      ),
    );
  });

  // Observation itself requires neither an exclusive lease nor a device handback.
  it("should accept counter observation without installing an IRQ route", async () => {
    await expectAccepted(program("poke($0400, lo(c64.cia1.readTimerACounter()));"));
  });

  // A lease whose only device work was observation still has a legal final release.
  it("should accept final exclusive restore after counter-only work", async () => {
    await expectAccepted(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  poke($0400, lo(c64.cia1.readTimerACounter()));
  ${restore}; asm_plp();`,
        "interrupt function onIRQ(): void {}",
      ),
    );
  });

  // Ordinary chaining retains its existing vector-only restore contract.
  it("should accept a plain chained IRQ install and restore", async () => {
    await expectAccepted(
      program(`c64.system.setIRQ(&onIRQ); ${restore};`, "interrupt function onIRQ(): void {}"),
    );
  });

  // A clean inner pop can expose the outer owner's typed CIA1 configuration unchanged.
  it("should accept a clean inner restore before final outer timer handback", async () => {
    await expectAccepted(
      exclusiveProgram(
        `${timerUse}
  c64.system.setIRQExclusive(&otherIRQ);
  ${restore};
  ${restore};`,
        `${handler}
interrupt function otherIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0404, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0405, 1); }
}`,
      ),
    );
  });

  // A changed inner device cannot be handed to the still-active outer handler by a vector pop.
  it("should reject a dirty inner restore at its source call", async () => {
    await expectRejected(
      exclusiveProgram(
        `c64.system.setIRQExclusive(&otherIRQ);
  c64.cia1.writeTimerALatch($2345);
  ${restore};
  for (;;) { asm_nop(); }`,
        `${handler}\ninterrupt function otherIRQ(): void {}`,
      ),
      restore,
    );
  });

  // Stock handback cannot be silently substituted for a known chained predecessor's service.
  it("should reject a dirty restore to a nonstock chained predecessor", async () => {
    await expectRejected(
      exclusiveProgram(
        `${timerUse}
  ${restore};
  for (;;) { asm_nop(); }`,
        `${handler}\ninterrupt function priorIRQ(): void {}`,
        "c64.system.setIRQ(&priorIRQ);",
      ),
      restore,
    );
  });

  // Normal exit cannot skip releasing an installed exclusive route.
  it("should reject main return with an unreleased CIA1 exclusive handler", async () => {
    await expectRejected(exclusiveProgram(timerUse));
  });

  // Both runtime arms have the same final lease; helper and bounded-loop writes remain legal.
  it("should accept final restore after conditional helper and bounded-loop timer writes", async () => {
    const declarations = `${handler}
function configureTimer(): void {
  for (let reload: word = $1000; reload < $1004; reload += 1) {
    c64.cia1.writeTimerALatch(reload);
  }
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
}`;
    await expectAccepted(
      exclusiveProgram(
        `if (peek($0403) == 0) { configureTimer(); }
  else { asm_nop(); }
  ${restore};`,
        declarations,
      ),
    );
  });

  // A raw control or ICR write lies outside the proved typed timer lease, including mirrors.
  it.each(["$DC0E", "$DC0F", "$DC0D", "$DC1E", "$DCFF", "$DC1D"])(
    "should reject final restore after a known raw CIA1 mutation at %s",
    async (address) => {
      await expectRejected(
        exclusiveProgram(`poke(${address}, 0); ${restore};
  for (;;) { asm_nop(); }`),
        restore,
      );
    },
  );

  // Runtime-computed addresses retain the explicit caller-owned hardware escape boundary.
  it("should accept an opaque runtime-address poke before final typed timer release", async () => {
    await expectAccepted(
      exclusiveProgram(`let address: word = $0400 + peek($0403);
  poke(address, 1);
  ${timerUse}
  ${restore};`),
    );
  });
});
