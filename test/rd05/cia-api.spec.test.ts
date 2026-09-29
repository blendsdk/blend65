import { checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { analyzeProfileSource, profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

const primaryProfile = profiles[0];

/** Require successful source analysis while allowing ordinary unused-value warnings. */
async function expectAccepted(source: string, profile = primaryProfile) {
  const result = await analyzeProfileSource(source, profile);
  expect(result.kind, JSON.stringify(result.diagnostics)).toBe("complete");
  expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  if (result.kind !== "complete") throw new Error("Expected complete CIA source analysis");
  return result.program;
}

/** Require one ownership diagnostic at the operation that cannot be admitted. */
async function expectOwnershipError(source: string, operation: string) {
  await withProfileProject(source, primaryProfile, async (project) => {
    const result = await checkProject({ project });
    expect(result.kind).toBe("failure");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors.map(({ code }) => code)).toEqual(["E10278"]);
    expect(errors[0]).toMatchObject({
      code: "E10278",
      severity: "error",
      primarySpan: profileSpan(source, operation),
    });
  });
}

/** Keep a changed timer configuration inside an exclusive, nonreturning IRQ epoch. */
function exclusiveProgram(body: string): string {
  return `module Game;
interrupt function onIRQ(): void {}
function main(): void {
  asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  asm_plp();
  ${body}
  for (;;) { asm_nop(); }
}`;
}

describe.each(profiles)("CIA source operations for %s", (profile) => {
  // Both chips expose non-consuming word counter observations without IRQ ownership.
  it("accepts all four timer counters as word expressions", async () => {
    const source = `module Game;
function sample(): word {
  let a: word = c64.cia1.readTimerACounter();
  let b: word = c64.cia1.readTimerBCounter();
  let c: word = c64.cia2.readTimerACounter();
  let d: word = c64.cia2.readTimerBCounter();
  return a + b + c + d;
}
function main(): void { let measured: word = sample(); }`;
    await expectAccepted(source, profile);
  });

  // Named timer and interrupt bits are immutable byte facts usable in ordinary source.
  it("accepts every named CIA timer and interrupt bit as a byte constant", async () => {
    const source = `module Game;
const SOURCE_ALL: byte = c64.cia1.sourceAll;
const SOURCE_FLAG: byte = c64.cia1.sourceFlag;
const SOURCE_IRQ: byte = c64.cia1.sourceIrq;
const SOURCE_SERIAL: byte = c64.cia1.sourceSerial;
const SOURCE_A: byte = c64.cia1.sourceTimerA;
const SOURCE_B: byte = c64.cia1.sourceTimerB;
const SOURCE_TOD: byte = c64.cia1.sourceTodAlarm;
const COUNT_UNDERFLOWS: byte = c64.cia1.timerBCountAUnderflows;
const LOAD: byte = c64.cia1.timerLoad;
const ONE_SHOT: byte = c64.cia1.timerOneShot;
const START: byte = c64.cia1.timerStart;
function main(): void {}`;
    const program = await expectAccepted(source, profile);
    expect(program.calls).toEqual([]);
  });
});

describe("CIA timer ownership at the source boundary", () => {
  // An exclusive IRQ route admits the direct timer and interrupt operations on CIA1.
  it("accepts CIA1 latch, control, and source-mask operations in a nonreturning exclusive route", async () => {
    await expectAccepted(
      exclusiveProgram(`c64.cia1.writeTimerALatch($1234);
  c64.cia1.writeTimerBLatch($5678);
  c64.cia1.configureTimerA(c64.cia1.timerLoad | c64.cia1.timerStart);
  c64.cia1.configureTimerB(c64.cia1.timerBCountAUnderflows | c64.cia1.timerStart);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);
  c64.cia1.disableInterruptSources(c64.cia1.sourceTimerA);`),
    );
  });

  // A runtime byte is admitted; the direct output path must later bound its writable bits.
  it("accepts dynamic control flags that may contain all eight bits", async () => {
    await expectAccepted(
      exclusiveProgram(`let flags: byte = peek($0400);
  c64.cia1.configureTimerA(flags);
  c64.cia1.configureTimerB(flags);`),
    );
  });

  // Fixed flags outside the timer-owned mode set are diagnosed at their calls.
  it.each([
    "c64.cia1.configureTimerA($20)",
    "c64.cia1.configureTimerB($20)",
    "c64.cia1.configureTimerA($02)",
  ])("rejects unsupported constant control bits in %s", async (operation) => {
    const source = exclusiveProgram(`${operation};`);
    await expectOwnershipError(source, operation);
  });

  // Counter observation stays available on CIA2, but changing or clearing CIA2 state does not.
  it.each([
    "c64.cia2.writeTimerALatch($1234)",
    "c64.cia2.writeTimerBLatch($5678)",
    "c64.cia2.configureTimerA(c64.cia1.timerStart)",
    "c64.cia2.configureTimerB(c64.cia1.timerStart)",
    "c64.cia2.enableInterruptSources(c64.cia1.sourceTimerA)",
    "c64.cia2.disableInterruptSources(c64.cia1.sourceAll)",
    "c64.cia2.readAndClearPendingSources()",
  ])("rejects an unowned CIA2 operation at %s", async (operation) => {
    const statement = operation.endsWith("readAndClearPendingSources()")
      ? `let pending2: byte = ${operation};`
      : `${operation};`;
    const source = exclusiveProgram(statement);
    await expectOwnershipError(source, operation);
  });
});
