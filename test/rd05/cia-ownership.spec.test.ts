import { checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileSpan, withProfileProject } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;
const primaryProfile = profiles[0];

/** Check one complete selected-profile program, allowing ordinary unused-value warnings. */
async function expectAccepted(source: string, selectedProfile = primaryProfile) {
  await withProfileProject(source, selectedProfile, async (project) => {
    const result = await checkProject({ project });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    if (result.kind !== "success") throw new Error("Expected successful CIA ownership check");
    expect(result.profileId).toBe(selectedProfile);
  });
}

/** Require an ownership error at the exact source operation under test. */
async function expectRejectedAt(source: string, call: string) {
  return withProfileProject(source, primaryProfile, async (project) => {
    const result = await checkProject({ project });
    expect(result.kind).toBe("failure");
    const errors = result.diagnostics.filter(({ severity }) => severity === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      code: "E10278",
      severity: "error",
      primarySpan: profileSpan(source, call),
    });
    return errors[0];
  });
}

/** Distinguish an un-restored timer write from unrelated IRQ-vector or mask errors. */
function expectTimerMutationDetail(message: string | undefined) {
  expect(message).toMatch(/CIA1/i);
  expect(message).toMatch(/timer|latch|handler.*(?:writ|mutat)|(?:writ|mutat).*handler/i);
}

/** Wrap a mainline source fragment without adding implicit IRQ or CIA ownership. */
function program(body: string, declarations = "interrupt function onIRQ(): void {}"): string {
  return `module Game;
${declarations}
function main(): void {
  ${body}
}`;
}

/** Install while IRQs are masked, clear the unknown mask, then expose pending bits to source. */
function handoff(body: string, declarations?: string): string {
  return program(
    `asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  let initialPending: byte = c64.cia1.readAndClearPendingSources();
  poke($0400, initialPending);
  asm_plp();
  ${body}
  for (;;) { asm_nop(); }`,
    declarations,
  );
}

const guardedOperations = [
  {
    name: "Timer A latch",
    call: "c64.cia1.writeTimerALatch($1234)",
    statement: "c64.cia1.writeTimerALatch($1234);",
  },
  {
    name: "Timer B latch",
    call: "c64.cia1.writeTimerBLatch($5678)",
    statement: "c64.cia1.writeTimerBLatch($5678);",
  },
  {
    name: "Timer A control",
    call: "c64.cia1.configureTimerA(c64.cia1.timerStart)",
    statement: "c64.cia1.configureTimerA(c64.cia1.timerStart);",
  },
  {
    name: "Timer B control",
    call: "c64.cia1.configureTimerB(c64.cia1.timerStart)",
    statement: "c64.cia1.configureTimerB(c64.cia1.timerStart);",
  },
  {
    name: "source enable",
    call: "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)",
    statement: "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);",
  },
  {
    name: "source disable",
    call: "c64.cia1.disableInterruptSources(c64.cia1.sourceAll)",
    statement: "c64.cia1.disableInterruptSources(c64.cia1.sourceAll);",
  },
  {
    name: "pending-source read",
    call: "c64.cia1.readAndClearPendingSources()",
    statement: "let pending: byte = c64.cia1.readAndClearPendingSources();",
  },
] as const;

describe("CIA1 IRQ-route ownership", () => {
  // Device mutation and consuming reads require an exclusive installer, not a bare source call.
  it.each(guardedOperations)(
    "rejects $name without an IRQ installer",
    async ({ call, statement }) => {
      await expectRejectedAt(program(`${statement} for (;;) { asm_nop(); }`), call);
    },
  );

  // A chained KERNAL IRQ route cannot claim the complete CIA1 interrupt source.
  it.each(guardedOperations)(
    "rejects $name on a chained IRQ route",
    async ({ call, statement }) => {
      await expectRejectedAt(
        program(`c64.system.setIRQ(&onIRQ); ${statement} for (;;) { asm_nop(); }`),
        call,
      );
    },
  );

  // Restoring an unmodified exclusive vector ends CIA1 ownership at that point.
  it.each(guardedOperations)(
    "rejects $name after restoring the IRQ route",
    async ({ call, statement }) => {
      await expectRejectedAt(
        program(`asm_php(); asm_sei();
  c64.system.setIRQExclusive(&onIRQ);
  c64.system.restoreIRQ();
  asm_plp();
  ${statement}
  for (;;) { asm_nop(); }`),
        call,
      );
    },
  );

  // A live exclusive route admits every direct CIA1 operation and its typed arguments.
  it.each(guardedOperations)("accepts $name on a live exclusive route", async ({ statement }) => {
    await expectAccepted(handoff(statement));
  });

  // Ownership established by a caller remains available to a helper it calls.
  it("accepts a timer helper called after the exclusive handoff", async () => {
    await expectAccepted(
      handoff(
        "startTimer();",
        `interrupt function onIRQ(): void {}
function startTimer(): void { c64.cia1.writeTimerALatch($1234); }`,
      ),
    );
  });
});

describe("CIA1 interrupt-mask proof", () => {
  // Installing the vector does not reveal the pre-existing write-only interrupt mask.
  it("rejects enabling Timer A before clearing every prior source", async () => {
    const call = "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)";
    await expectRejectedAt(
      program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  ${call}; asm_plp(); for (;;) { asm_nop(); }`),
      call,
    );
  });

  // An ICR read acknowledges pending events; it cannot reveal which sources were enabled.
  it("does not infer the mask from a pending-source read", async () => {
    const call = "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)";
    await expectRejectedAt(
      program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  let pending: byte = c64.cia1.readAndClearPendingSources();
  ${call}; asm_plp(); for (;;) { asm_nop(); }`),
      call,
    );
  });

  // Both sides of a control-flow join must agree that the full mask was cleared.
  it("rejects enabling after only one branch clears the old mask", async () => {
    const call = "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)";
    await expectRejectedAt(
      program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  if (peek($0400) == 0) { c64.cia1.disableInterruptSources(c64.cia1.sourceAll); }
  ${call}; asm_plp(); for (;;) { asm_nop(); }`),
      call,
    );
  });

  // The masked vector/mask/pending handoff admits both timer bits once the mask is known.
  it.each(profiles)(
    "accepts the balanced handoff and both timer bits for %s",
    async (selectedProfile) => {
      await expectAccepted(
        handoff("c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);"),
        selectedProfile,
      );
    },
  );

  // A known raw ICR write destroys the compiler's proof of the selected source mask.
  it("rejects enabling after a literal write to the CIA1 interrupt control register", async () => {
    const call = "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)";
    await expectRejectedAt(handoff(`poke($DC0D, $00); ${call};`), call);
  });

  // CIA1 register mirrors have the same mask effect as their base addresses.
  it("rejects enabling after a literal write to a mirrored CIA1 interrupt control register", async () => {
    const call = "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA)";
    await expectRejectedAt(handoff(`poke($DC1D, $00); ${call};`), call);
  });

  // An enabled CIA1 source cannot be passed to a route that lacks exclusive ownership.
  it("rejects changing to a chained route while Timer A remains enabled", async () => {
    const call = "c64.system.setIRQ(&otherIRQ)";
    await expectRejectedAt(
      handoff(
        `c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA); ${call};`,
        "interrupt function onIRQ(): void {} interrupt function otherIRQ(): void {}",
      ),
      call,
    );
  });

  // Immediately after installation, the old write-only mask may still enable a source.
  it("rejects a chained route before the unknown old CIA1 mask is fully cleared", async () => {
    const call = "c64.system.setIRQ(&otherIRQ)";
    await expectRejectedAt(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  ${call}; asm_plp(); for (;;) { asm_nop(); }`,
        "interrupt function onIRQ(): void {} interrupt function otherIRQ(): void {}",
      ),
      call,
    );
  });

  // The ICR read returns one byte; ordinary branches may inspect both pending timer bits.
  it("accepts independent Timer A and B branches from one consumed pending byte", async () => {
    const handler = `interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0401, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0402, 1); }
}`;
    await expectAccepted(
      handoff(
        "c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);",
        handler,
      ),
    );
  });
});

describe("CIA1 interrupt-source arguments", () => {
  // Only Timer A and B can be enabled; the all-sources bit set can be disabled.
  it("accepts both timer enables and a full disable", async () => {
    await expectAccepted(
      handoff(`c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA | c64.cia1.sourceTimerB);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);`),
    );
  });

  // The returned IRQ flag and non-timer pending bits are not owned enable-mask bits.
  it.each([
    "c64.cia1.sourceIrq",
    "c64.cia1.sourceTodAlarm",
    "c64.cia1.sourceSerial",
    "c64.cia1.sourceFlag",
  ])("rejects enabling the unowned %s bit", async (bit) => {
    const call = `c64.cia1.enableInterruptSources(${bit})`;
    await expectRejectedAt(handoff(`${call};`), call);
  });

  // Disable accepts five source bits, but neither the IRQ status bit nor an extra bit.
  it.each(["c64.cia1.sourceIrq", "$20"])("rejects disabling an out-of-set %s bit", async (bit) => {
    const call = `c64.cia1.disableInterruptSources(${bit})`;
    await expectRejectedAt(handoff(`${call};`), call);
  });

  // A runtime byte remains legal because generated writes mask it to the owned bit set.
  it("accepts a dynamic byte that could contain every bit", async () => {
    await expectAccepted(
      handoff(`let mask: byte = peek($0401);
  c64.cia1.enableInterruptSources(mask);
  c64.cia1.disableInterruptSources(mask);`),
    );
  });

  // Explicit narrowing happens before the mask check: $100 becomes the safe byte zero.
  it("accepts a narrowed constant whose resulting byte contains no source bits", async () => {
    await expectAccepted(
      handoff(`c64.cia1.enableInterruptSources(byte($100));
  c64.cia1.disableInterruptSources(byte($100));`),
    );
  });

  // The installed route keeps its proved mask while its handler changes timer sources.
  it("accepts a handler switching from Timer A to B with one pending-source read", async () => {
    const handler = `interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  if ((pending & c64.cia1.sourceTimerA) != 0) { poke($0401, 1); }
  if ((pending & c64.cia1.sourceTimerB) != 0) { poke($0402, 1); }
  c64.cia1.disableInterruptSources(c64.cia1.sourceTimerA);
  c64.cia1.enableInterruptSources(c64.cia1.sourceTimerB);
}`;
    await expectAccepted(
      handoff("c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);", handler),
    );
  });
});

describe("CIA1 device state and return to BASIC", () => {
  // Enabling B dirties the device even if a later write disables all sources.
  it("rejects IRQ restore after Timer B was enabled and then fully disabled", async () => {
    const call = "c64.system.restoreIRQ()";
    await expectRejectedAt(
      handoff(`c64.cia1.enableInterruptSources(c64.cia1.sourceTimerB);
  c64.cia1.disableInterruptSources(c64.cia1.sourceAll);
  ${call};`),
      call,
    );
  });

  // A timer-latch write cannot be undone by merely restoring the old IRQ vector.
  it("rejects IRQ restore after a typed timer write", async () => {
    const call = "c64.system.restoreIRQ()";
    await expectRejectedAt(
      program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.writeTimerALatch($1234); ${call}; asm_plp();
  for (;;) { asm_nop(); }`),
      call,
    );
  });

  // Literal writes to either timer register or the ICR also invalidate reverse handoff.
  it.each(["$DC04", "$DC06", "$DC0E", "$DC0F", "$DC0D"])(
    "rejects IRQ restore after a literal CIA1 write to %s",
    async (address) => {
      const call = "c64.system.restoreIRQ()";
      await expectRejectedAt(
        program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  poke(${address}, 0); ${call}; asm_plp();
  for (;;) { asm_nop(); }`),
        call,
      );
    },
  );

  // Mirrored timer and ICR registers also prevent an unproved return to the old owner.
  it.each(["$DC14", "$DC1D", "$DCFF"])(
    "rejects IRQ restore after a literal CIA1 mirror write to %s",
    async (address) => {
      const call = "c64.system.restoreIRQ()";
      await expectRejectedAt(
        program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  poke(${address}, 0); ${call}; asm_plp();
  for (;;) { asm_nop(); }`),
        call,
      );
    },
  );

  // Returning to BASIC after a timer mutation must identify the un-restored CIA1 state.
  it("rejects a normal main return after CIA1 takeover without a device hand-back", async () => {
    const source = program(`asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  c64.cia1.writeTimerALatch($1234); asm_plp();`);
    await withProfileProject(source, primaryProfile, async (project) => {
      const result = await checkProject({ project });
      expect(result.kind).toBe("failure");
      const errors = result.diagnostics.filter(({ severity }) => severity === "error");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ code: "E10278", severity: "error" });
      expect(errors[0]?.message).toMatch(/CIA1.*(?:BASIC|return)|(?:BASIC|return).*CIA1/i);
      expect(errors[0]?.primarySpan.sourceId).toBe("src/game.blend");
    });
  });

  // A selected handler's helper may change CIA1 while the mainline owns that route.
  it("rejects mainline IRQ restore when the selected handler helper can mutate CIA1", async () => {
    const call = "c64.system.restoreIRQ()";
    const declarations = `function changeTimer(): void { c64.cia1.writeTimerALatch($1234); }
interrupt function onIRQ(): void { changeTimer(); }`;
    const error = await expectRejectedAt(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  ${call}; asm_plp(); for (;;) { asm_nop(); }`,
        declarations,
      ),
      call,
    );
    expectTimerMutationDetail(error?.message);
  });

  // A nested handler restore cannot clean a timer change made by its temporary successor.
  it("rejects handler-side nested restore after the temporary handler mutates CIA1", async () => {
    const call = "c64.system.restoreIRQ()";
    const declarations = `function changeTimer(): void { c64.cia1.writeTimerALatch($1234); }
interrupt function nextIRQ(): void { changeTimer(); }
interrupt function onIRQ(): void {
  c64.system.setIRQExclusive(&nextIRQ);
  ${call};
}`;
    const error = await expectRejectedAt(
      program(
        "asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ); asm_plp(); for (;;) { asm_nop(); }",
        declarations,
      ),
      call,
    );
    expectTimerMutationDetail(error?.message);
  });

  // A handler may return to its interrupted code after a CIA write; that is not BASIC exit.
  it("accepts a mutating handler when the mainline never returns or restores the vector", async () => {
    const declarations = `function changeTimer(): void { c64.cia1.writeTimerALatch($1234); }
interrupt function onIRQ(): void {
  let pending: byte = c64.cia1.readAndClearPendingSources();
  changeTimer();
}`;
    await expectAccepted(
      handoff("c64.cia1.enableInterruptSources(c64.cia1.sourceTimerA);", declarations),
    );
  });

  // Counter observations do not alter timer or mask state, so normal hand-back is legal.
  it("allows counter-only handler and mainline to restore IRQ and return", async () => {
    const declarations = `interrupt function onIRQ(): void {
  let countB: word = c64.cia1.readTimerBCounter();
}`;
    await expectAccepted(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  let countA: word = c64.cia1.readTimerACounter();
  c64.system.restoreIRQ(); asm_plp();`,
        declarations,
      ),
    );
  });

  // A helper called by the selected handler does not dirty CIA1 when it only observes a counter.
  it("allows a counter-only handler helper to restore IRQ and return", async () => {
    const declarations = `function readTimer(): word { return c64.cia1.readTimerACounter(); }
interrupt function onIRQ(): void { let count: word = readTimer(); }`;
    await expectAccepted(
      program(
        `asm_php(); asm_sei(); c64.system.setIRQExclusive(&onIRQ);
  c64.system.restoreIRQ(); asm_plp();`,
        declarations,
      ),
    );
  });

  // A runtime address in game memory is not treated as a proven CIA1 register alias.
  it("allows a dynamic game-memory poke before a typed CIA1 timer operation", async () => {
    await expectAccepted(
      handoff(`let address: word = $0400 + peek($0401);
  poke(address, 1);
  c64.cia1.writeTimerALatch($1234);`),
    );
  });
});
