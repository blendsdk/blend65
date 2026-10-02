import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import type { TypedProgram } from "@blend65/compiler/frontend";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { profileRecords, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";

type Profile = NonNullable<TypedProgram["profile"]>["id"];
const PROFILES: readonly Profile[] = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const PREDICATES = [
  { name: "joystickUp", mask: 1 },
  { name: "joystickDown", mask: 2 },
  { name: "joystickLeft", mask: 4 },
  { name: "joystickRight", mask: 8 },
  { name: "joystickFire", mask: 16 },
] as const;
const PORTS = [
  { number: 1, name: "readJoystick1", address: 0xdc01 },
  { number: 2, name: "readJoystick2", address: 0xdc00 },
] as const;
const INPUT_IMPORTS = [...PORTS, ...PREDICATES].map(({ name }) => name).join(", ");
const BOOT = 0x2f00;
const BEGIN = 0x3000;
const END = 0x3100;
const COMPLETE = 0x3200;
const PORT_STATES = [
  { latches: [0xff, 0xff], ddrs: [0, 0] },
  { latches: [0x5f, 0x9f], ddrs: [0xa0, 0x60] },
  { latches: [0xe5, 0xda], ddrs: [0x80, 0x20] },
  // With no controller attached, owned outputs may still pull the shared control lines low.
  { latches: [0xfe, 0xfd], ddrs: [0x01, 0x02] },
] as const;

/** Source checkpoints are ordinary helpers; installation, setup and read windows stay distinct. */
function markers() {
  return `place(at: $2f00) function boot(): void { asm_nop(); }
place(at: $3000) function begin(): void { asm_nop(); }
place(at: $3100) function end(): void { asm_nop(); }
place(at: $3200) function complete(): void { asm_nop(); }`;
}

/** Store the full sample and canonical predicates without deriving expected values from the compiler. */
function capture(expression: string, destination: string, offset: string) {
  return `let sample: byte = ${expression}; ${destination}[${offset}] = sample;
${PREDICATES.map(
  ({ name }, index) => `${destination}Flags[${offset} + ${index + 1}] = ${name}(sample);`,
).join("\n")}`;
}

/** Read actual Boolean bytes from typed storage alongside the separately saved raw sample. */
async function capturedSamples(monitor: ViceMonitor, address: number, count: number) {
  const bytes = await monitor.readMemory(address, address + count - 1);
  const flags = await monitor.readMemory(address + 0x200, address + 0x200 + count - 1);
  return [...bytes].map((value, index) => (index % 6 === 0 ? value : flags[index]!));
}

/** Independently derive active-low flags; upper bits never enter a control predicate. */
function expectedSample(pins: number) {
  return [pins, ...PREDICATES.map(({ mask }) => Number((pins & mask) === 0))];
}

/** Arm the stop wait before resuming so even a very short compiled window cannot race it. */
async function go(monitor: ViceMonitor, address: number) {
  const stopped = monitor.waitForStop();
  await monitor.resume();
  // The stop event carries the CPU address; checkpoint identities are used only for hit traces/deletion.
  expect(await stopped).toBe(address);
}

/** Observe both CIA blocks, including ICR and controls, without tracing fixture-owned writes. */
async function ciaTracepoints(monitor: ViceMonitor) {
  const events = new Map<number, string>();
  for (const base of [0xdc00, 0xdd00]) {
    for (let offset = 0; offset < 16; offset += 1) {
      for (const operation of ["load", "store"] as const) {
        const address = base + offset;
        events.set(
          await monitor.setAccessTracepoint(address, operation),
          `${operation}:$${address.toString(16)}`,
        );
      }
    }
  }
  return events;
}

/** Reads may affect arithmetic flags, but must preserve caller interrupt and decimal state. */
async function readWindow(
  monitor: ViceMonitor,
  events: ReadonlyMap<number, string>,
  end: number,
  addresses: readonly number[],
) {
  const before = await monitor.readCpuRegisters();
  monitor.takeCheckpointHits();
  await go(monitor, end);
  const hits = monitor.takeCheckpointHits();
  const after = await monitor.readCpuRegisters();
  expect(hits.flatMap((id) => (events.has(id) ? [events.get(id)!] : []))).toEqual(
    addresses.map((address) => `load:$${address.toString(16)}`),
  );
  expect(after.p & 0x0c).toBe(before.p & 0x0c);
}

/** Own one sequential VICE process and retain exact artifact, executable, ROM and model evidence. */
async function withMachine(
  program: string,
  profile: Profile,
  inspect: (monitor: ViceMonitor) => Promise<void>,
  simulateJoysticks = true,
) {
  await withProfileProject(program, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = await readProfileArtifacts(built);
    expect(
      profileRecords(artifacts.debug.tools).some(
        (tool) =>
          typeof tool.name === "string" &&
          tool.name.toLowerCase() === "acme" &&
          typeof tool.version === "string" &&
          /(^|\D)0\.97(\D|$)/u.test(tool.version),
      ),
      "Runtime evidence requires the selected assembler identity",
    ).toBe(true);
    const vice = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      100_000_000,
      profile,
      simulateJoysticks,
      simulateJoysticks,
    );
    if ("kind" in vice) throw new Error(`Runtime setup unavailable: ${vice.reason}`);
    try {
      const models = {
        VICIIModel: await vice.monitor.readIntegerResource("VICIIModel"),
        SidModel: await vice.monitor.readIntegerResource("SidModel"),
        CIA1Model: await vice.monitor.readIntegerResource("CIA1Model"),
        CIA2Model: await vice.monitor.readIntegerResource("CIA2Model"),
        KernalRev: await vice.monitor.readIntegerResource("KernalRev"),
      };
      expect(models).toEqual({
        VICIIModel: profile.includes("-pal-") ? 0 : 3,
        SidModel: profile.endsWith("6581") ? 0 : 1,
        CIA1Model: 0,
        CIA2Model: 0,
        KernalRev: 3,
      });
      console.info(
        "Joystick runtime identity",
        JSON.stringify({
          profile,
          joystickDevices: simulateJoysticks ? "io-simulation" : "none",
          models,
          vice: await vice.monitor.viceInfo(),
          executableSha256: vice.identity.executableSha256,
          roms: vice.identity.roms.map(({ name, sha256 }) => ({ name, sha256 })),
          prgSha256: createHash("sha256").update(artifacts.prg).digest("hex"),
          tools: artifacts.debug.tools,
        }),
      );
      const boot = await vice.monitor.setExecuteCheckpoint(BOOT);
      await go(vice.monitor, BOOT);
      await vice.monitor.deleteCheckpoint(boot);
      await inspect(vice.monitor);
    } finally {
      await stopVice(vice);
    }
  });
}

/** The fixture releases joystick lines and stops timer outputs before measuring the selected pins. */
async function releasedPorts(monitor: ViceMonitor) {
  await monitor.writeIo(0xdc0e, Uint8Array.of(0));
  await monitor.writeIo(0xdc0f, Uint8Array.of(0));
  await monitor.writeIo(0xdc02, Uint8Array.of(0, 0));
  await monitor.writeIo(0xdc00, Uint8Array.of(255, 255));
}

/** Set external simulated switches, never substitute writes to CIA port registers for stimulation. */
async function switches(monitor: ViceMonitor, first: number, second: number) {
  await monitor.setJoystick1(first);
  await monitor.setJoystick2(second);
}

/** Keep the two independently stimulated ports distinct while covering every five-bit combination. */
function combinationSource(rawControl: boolean) {
  return `module Game;
${rawControl ? "" : `import { ${INPUT_IMPORTS} } from c64.input;`}
place(at: $4000) let samples: byte[384];
${rawControl ? "" : "place(at: $4200) let samplesFlags: boolean[384];"}
${markers()}
place(at: $2000) function main(): void {
  asm_sei(); boot();
  for (let i: word = 0; i < 32; i += 1) {
    begin();
    ${
      rawControl
        ? "samples[i * 12] = peek($dc01); samples[i * 12 + 6] = peek($dc00);"
        : `{ ${capture("readJoystick1()", "samples", "i * 12")} }
         { ${capture("readJoystick2()", "samples", "i * 12 + 6")} }`
    }
    end();
  }
  complete();
}`;
}

describe.each(PROFILES)("joystick compiled device observations on %s", (profile) => {
  for (const rawControl of [true, false]) {
    it(
      rawControl
        ? "should prove both simulated port devices and active-low polarity with compiled pin reads"
        : "should sample all 32 simulated switch combinations per port and evaluate all five predicates",
      async () => {
        await withMachine(combinationSource(rawControl), profile, async (monitor) => {
          await monitor.setExecuteCheckpoint(BEGIN);
          await monitor.setExecuteCheckpoint(END);
          await releasedPorts(monitor);
          await go(monitor, BEGIN);
          const events = await ciaTracepoints(monitor);
          for (let value = 0; value < 32; value += 1) {
            // Opposing switches are deliberate simulated states, not a physical-stick claim.
            await switches(monitor, value, 31 - value);
            if (rawControl) {
              // The selected I/O simulator supplies only five bits and fixes bits 5..7 at zero.
              expect(
                [...(await monitor.readIo(0xdc00, 0xdc01))],
                "Simulator stimulus pins",
              ).toEqual([31 - value, value]);
            }
            expect((await monitor.readCpuRegisters()).p & 4).toBe(4);
            await readWindow(monitor, events, END, [0xdc01, 0xdc00]);
            if (rawControl) {
              const bytes = await monitor.readMemory(0x4000 + value * 12, 0x400b + value * 12);
              expect([bytes[0], bytes[6]]).toEqual([value, 31 - value]);
            } else {
              expect(await capturedSamples(monitor, 0x4000 + value * 12, 12)).toEqual([
                ...expectedSample(value),
                ...expectedSample(31 - value),
              ]);
            }
            if (value < 31) await go(monitor, BEGIN);
          }
        });
      },
      120_000,
    );
  }

  it("should prove released-controller upper pins and known CIA1 latches with compiled pin reads", async () => {
    const program = `module Game;
place(at: $4000) let samples: byte[16];
${markers()}
place(at: $2000) function main(): void {
  asm_sei(); boot();
  for (let i: word = 0; i < 8; i += 1) {
    if (i < 4) { asm_sei(); } else { asm_cli(); }
    begin(); samples[i * 2] = peek($dc01); samples[i * 2 + 1] = peek($dc00); end();
  }
  asm_sei(); complete();
}`;
    await withMachine(
      program,
      profile,
      async (monitor) => {
        await monitor.setExecuteCheckpoint(BEGIN);
        await monitor.setExecuteCheckpoint(END);
        await releasedPorts(monitor);
        await monitor.writeIo(0xdc0d, Uint8Array.of(0x1f));
        await monitor.writeIo(0xd01a, Uint8Array.of(0));
        await go(monitor, BEGIN);
        const events = await ciaTracepoints(monitor);
        for (let round = 0; round < 8; round += 1) {
          const state = PORT_STATES[round % PORT_STATES.length]!;
          await monitor.writeIo(0xdc02, Uint8Array.of(0, 0));
          await monitor.writeIo(0xdc00, Uint8Array.from(state.latches));
          await monitor.writeIo(0xdc02, Uint8Array.from(state.ddrs));
          const pins = state.latches.map((latch, index) => (latch | ~state.ddrs[index]!) & 255);
          expect([...(await monitor.readIo(0xdc00, 0xdc01))], "Released-controller pins").toEqual(
            pins,
          );
          expect((await monitor.readCpuRegisters()).p & 4).toBe(round < 4 ? 4 : 0);
          await readWindow(monitor, events, END, [0xdc01, 0xdc00]);
          expect([...(await monitor.readMemory(0x4000 + round * 2, 0x4001 + round * 2))]).toEqual([
            pins[1],
            pins[0],
          ]);
          expect([...(await monitor.readIo(0xdc02, 0xdc03))]).toEqual(state.ddrs);
          await monitor.writeIo(0xdc02, Uint8Array.of(255, 255));
          expect([...(await monitor.readIo(0xdc00, 0xdc01))]).toEqual(state.latches);
          if (round < 7) await go(monitor, BEGIN);
        }
      },
      false,
    );
  }, 120_000);

  for (const port of PORTS) {
    for (const interruptsEnabled of [false, true]) {
      it(`should preserve both CIA1 port latches and DDRs while ${port.name} observes shared lines with caller IRQ ${interruptsEnabled ? "enabled" : "disabled"}`, async () => {
        const program = `module Game;
import { ${port.name}, ${PREDICATES.map(({ name }) => name).join(", ")} } from c64.input;
place(at: $4000) let samples: byte[24];
place(at: $4200) let samplesFlags: boolean[24];
${markers()}
place(at: $2000) function main(): void {
  asm_sei(); boot(); ${interruptsEnabled ? "asm_cli();" : ""}
  for (let i: word = 0; i < 4; i += 1) {
    begin(); ${capture(`${port.name}()`, "samples", "i * 6")} end();
  }
  asm_sei(); complete();
}`;
        await withMachine(
          program,
          profile,
          async (monitor) => {
            await monitor.setExecuteCheckpoint(BEGIN);
            await monitor.setExecuteCheckpoint(END);
            await releasedPorts(monitor);
            // Disable potential sources before CLI; no KERNAL scanning can enter a read window.
            await monitor.writeIo(0xdc0d, Uint8Array.of(0x1f));
            await monitor.writeIo(0xd01a, Uint8Array.of(0));
            await go(monitor, BEGIN);
            const events = await ciaTracepoints(monitor);
            for (const [index, state] of PORT_STATES.entries()) {
              await monitor.writeIo(0xdc02, Uint8Array.of(0, 0));
              await monitor.writeIo(0xdc00, Uint8Array.from(state.latches));
              await monitor.writeIo(0xdc02, Uint8Array.from(state.ddrs));
              const selected = port.number === 1 ? 1 : 0;
              // No controller is attached: pull-ups supply every input, and owned outputs may pull it low.
              const pins = (state.latches[selected]! | ~state.ddrs[selected]!) & 255;
              expect((await monitor.readCpuRegisters()).p & 4).toBe(interruptsEnabled ? 0 : 4);
              await readWindow(monitor, events, END, [port.address]);
              expect(await capturedSamples(monitor, 0x4000 + index * 6, 6)).toEqual(
                expectedSample(pins),
              );
              expect([...(await monitor.readIo(0xdc02, 0xdc03))]).toEqual(state.ddrs);
              // Pin reads cannot reveal an input latch. With no external controller, expose it as outputs.
              await monitor.writeIo(0xdc02, Uint8Array.of(255, 255));
              expect([...(await monitor.readIo(0xdc00, 0xdc01))]).toEqual(state.latches);
              if (index < PORT_STATES.length - 1) await go(monitor, BEGIN);
            }
          },
          false,
        );
      }, 120_000);
    }
  }

  it("should retain independent mainline and cooperative IRQ samples across fixture-owned port changes", async () => {
    const program = `module Game;
import { ${INPUT_IMPORTS} } from c64.input;
import { setIRQ, restoreIRQ } from c64.system;
place(at: $4000) let beforeSamples: byte[12];
place(at: $4010) let handlerSamples: byte[12];
place(at: $4020) let afterSamples: byte[12];
place(at: $4200) let beforeSamplesFlags: boolean[12];
place(at: $4210) let handlerSamplesFlags: boolean[12];
place(at: $4220) let afterSamplesFlags: boolean[12];
let handled: boolean = false;
${markers()}
place(at: $3300) function handlerBegin(): void { asm_nop(); }
place(at: $3400) function handlerEnd(): void { asm_nop(); }
place(at: $3500) function afterBegin(): void { asm_nop(); }
place(at: $3600) function afterEnd(): void { asm_nop(); }
interrupt function handler(): void {
  handlerBegin();
  { ${capture("readJoystick1()", "handlerSamples", "0")} }
  { ${capture("readJoystick2()", "handlerSamples", "6")} }
  handlerEnd(); handled = true;
}
place(at: $2000) function main(): void {
  asm_sei(); boot(); peek($dc0d); setIRQ(&handler); begin();
  { ${capture("readJoystick1()", "beforeSamples", "0")} }
  { ${capture("readJoystick2()", "beforeSamples", "6")} }
  end(); asm_cli(); while (!handled) { asm_nop(); } asm_sei();
  afterBegin();
  { ${capture("readJoystick1()", "afterSamples", "0")} }
  { ${capture("readJoystick2()", "afterSamples", "6")} }
  afterEnd(); restoreIRQ(); complete();
}`;
    await withMachine(program, profile, async (monitor) => {
      for (const address of [BEGIN, END, COMPLETE, 0x3300, 0x3400, 0x3500, 0x3600])
        await monitor.setExecuteCheckpoint(address);
      const originalVector = await monitor.readMemory(0x0314, 0x0315);
      await releasedPorts(monitor);
      await monitor.writeIo(0xdc0d, Uint8Array.of(0x1f));
      await monitor.writeIo(0xd01a, Uint8Array.of(0));
      await switches(monitor, 0x1a, 0x15);
      await go(monitor, BEGIN);
      const events = await ciaTracepoints(monitor);
      await readWindow(monitor, events, END, [0xdc01, 0xdc00]);
      const expectedBefore = [...expectedSample(0x1a), ...expectedSample(0x15)];
      expect(await capturedSamples(monitor, 0x4000, 12)).toEqual(expectedBefore);
      // The fixture owns a one-shot CIA1 source; the saved KERNAL chain owns its acknowledgement.
      await monitor.writeIo(0xdc04, Uint8Array.of(64, 0));
      await monitor.writeIo(0xdc0d, Uint8Array.of(0x81));
      await monitor.writeIo(0xdc0e, Uint8Array.of(0x19));
      await go(monitor, 0x3300);
      await switches(monitor, 0x0b, 0x16);
      await monitor.writeIo(0xdc00, Uint8Array.of(0x5f, 0x9f));
      await monitor.writeIo(0xdc02, Uint8Array.of(0xa0, 0x60));
      expect((await monitor.readCpuRegisters()).p & 0x0c).toBe(4);
      await readWindow(monitor, events, 0x3400, [0xdc01, 0xdc00]);
      const expectedHandler = [...expectedSample(0x0b), ...expectedSample(0x16)];
      expect(await capturedSamples(monitor, 0x4010, 12)).toEqual(expectedHandler);
      // Stop after the legitimate prior-handler work; its scanning and ICR reads are outside our window.
      await go(monitor, 0x3500);
      await releasedPorts(monitor);
      await switches(monitor, 0x1d, 0x0e);
      await readWindow(monitor, events, 0x3600, [0xdc01, 0xdc00]);
      expect(await capturedSamples(monitor, 0x4020, 12)).toEqual([
        ...expectedSample(0x1d),
        ...expectedSample(0x0e),
      ]);
      expect(await capturedSamples(monitor, 0x4000, 12)).toEqual(expectedBefore);
      expect(await capturedSamples(monitor, 0x4010, 12)).toEqual(expectedHandler);
      await go(monitor, COMPLETE);
      expect(await monitor.readMemory(0x0314, 0x0315)).toEqual(originalVector);
    });
  }, 120_000);
});
