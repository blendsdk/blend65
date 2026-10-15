import { buildProject, checkProject } from "@blend65/compiler";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryStartup,
  sourceLibraryProfiles,
} from "../rd05/source-library-fixture.js";
import type { LibraryArtifacts } from "../rd05/source-library-fixture.js";
import {
  cia2FunctionVariants,
  cia2Instructions,
  cia2OperationGroups,
} from "../rd05/cia2-output-fixture.js";

const modes = ["none", "size"] as const;
const owned = `zeropage {
  place(at: $03) owned: byte[7] = [1, 2, 3, 4, 5, 6, 7];
}`;
const samples = [
  { p: 0x20, ddrLow: 0, ciaDirection: 0, ciaLatch: 0 },
  { p: 0x2d, ddrLow: 1, ciaDirection: 1, ciaLatch: 2 },
  { p: 0xe9, ddrLow: 2, ciaDirection: 2, ciaLatch: 1 },
  { p: 0xe4, ddrLow: 7, ciaDirection: 3, ciaLatch: 3 },
] as const;

/** Reject absent, negative, or fractional physical accounting values. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected nonnegative integral resource evidence");
  return value;
}

/** Collect BASIC bytes actually occupied by final zero-page allocation, including helper homes. */
function borrowedBytes(artifacts: LibraryArtifacts): number[] {
  const addresses = new Set<number>();
  for (const interval of profileRecords(artifacts.memory.intervals)) {
    if (interval.resourceClass !== "zeroPage") continue;
    const start = integer(interval.start);
    const end = integer(interval.end);
    expect(end - start).toBe(interval.size);
    for (let address = Math.max(start, 3); address < Math.min(end, 0x90); address += 1)
      addresses.add(address);
  }
  return [...addresses].sort((left, right) => left - right);
}

/** Reconcile the selected artifact and bounded stack ledger without treating firmware reserve as use. */
function expectAccounting(artifacts: LibraryArtifacts): number[] {
  expectLibraryAccounting(artifacts);
  const unboundedEffects = profileRecords(artifacts.memory.unboundedEffects);
  expect(artifacts.memory.runtimeMemorySafety).toBe(
    unboundedEffects.length === 0 ? "proved" : "unproven",
  );
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
  const standards = resources.filter((resource) => resource.kind === "standard");
  expect(standards.map((resource) => resource.id)).toEqual([
    "zeroPage",
    "residentRam",
    "hardwareStack",
    "scratch",
  ]);
  for (const resource of standards) integer(resource.value);
  const domains = profileRecords(artifacts.memory.stackDomains);
  expect(domains.length).toBeGreaterThan(0);
  for (const domain of domains) {
    expect(Object.keys(domain).sort()).toEqual([
      "capacityBytes",
      "headroomBytes",
      "id",
      "peakBytes",
      "route",
    ]);
    expect(typeof domain.id).toBe("string");
    expect(Array.isArray(domain.route)).toBe(true);
    if (!Array.isArray(domain.route)) throw new TypeError("Missing bounded route");
    expect(domain.route.every((entry) => typeof entry === "string")).toBe(true);
    integer(domain.capacityBytes);
    expect(integer(domain.peakBytes) + integer(domain.headroomBytes)).toBe(domain.capacityBytes);
    expect(integer(domain.peakBytes)).toBeLessThanOrEqual(integer(domain.capacityBytes));
    expect(integer(domain.peakBytes), JSON.stringify(domain)).toBeLessThanOrEqual(236);
  }
  // The combined generated program/IRQ route uses capacity after the firmware reserve.
  const combinedDomains = domains.filter(
    (domain) =>
      Array.isArray(domain.route) &&
      domain.route[0] === "bounded-component:generated-program-and-irq",
  );
  expect(combinedDomains.length).toBeGreaterThan(0);
  for (const domain of combinedDomains)
    expect(integer(domain.capacityBytes), JSON.stringify(domain)).toBe(236);
  // These generated-route bounds do not prove an external NMI nesting or firmware completion bound.
  return domains.map((domain) => integer(domain.peakBytes));
}

/** Stop before executing an instruction; monitor replies contain the address, not checkpoint identity. */
async function stopAt(monitor: ViceMonitor, address: number): Promise<void> {
  const checkpoint = await monitor.setExecuteCheckpoint(address);
  try {
    const stopped = monitor.waitForStop(20_000);
    await monitor.resume();
    expect(await stopped).toBe(address);
  } finally {
    await monitor.deleteCheckpoint(checkpoint);
  }
}

/** Read CPU-port readbacks through the default CPU bank and CIA2 direction through the I/O bank. */
async function machineState(monitor: ViceMonitor) {
  return {
    cpu: [...(await monitor.readMemory(0, 1))],
    ciaDirection: (await monitor.readIo(0xdd02, 0xdd02))[0]!,
  };
}

/** Seed readable machine state while keeping KERNAL and I/O visible for the incoming SYS path. */
async function seedMachine(monitor: ViceMonitor, sample: (typeof samples)[number]) {
  const cpu = await monitor.readMemory(0, 1);
  await monitor.writeMemory(1, Uint8Array.of((cpu[1]! & 0xf8) | 7));
  await monitor.writeMemory(0, Uint8Array.of((cpu[0]! & 0xf8) | sample.ddrLow));
  const direction = (await monitor.readIo(0xdd02, 0xdd02))[0]!;
  const port = (await monitor.readIo(0xdd00, 0xdd00))[0]!;
  // Configure outputs before setting the latch, then expose the selected input directions.
  await monitor.writeIo(0xdd02, Uint8Array.of(0xff));
  await monitor.writeIo(0xdd00, Uint8Array.of((port & 0xfc) | sample.ciaLatch));
  await monitor.writeIo(0xdd02, Uint8Array.of((direction & 0xfc) | sample.ciaDirection));
  const pins = (await monitor.readIo(0xdd00, 0xdd00))[0]!;
  expect(pins & 3).toBe((sample.ciaLatch | ~sample.ciaDirection) & 3);
  return machineState(monitor);
}

interface StartupCase {
  /** Legal ordinary program whose startup must preserve incoming machine ownership. */
  readonly source: string;
  /** Compact eligibility, conservative full requirement, or either safe unrolled/full choice. */
  readonly selection: "compact" | "full" | "either";
  /** Independently determined source results captured before the normal restore transaction. */
  readonly outputs: readonly number[];
  /** Optional host preparation for an opaque source address or input. */
  readonly prepare?: (monitor: ViceMonitor) => Promise<void>;
  /** Additional explicitly placed BASIC bytes that must appear in the final allocation. */
  readonly additionalBorrowed?: readonly number[];
  /** Require compact startup to avoid accesses spanning an unallocated gap between objects. */
  readonly hasGap?: boolean;
  /** Host-only caller stack tops used to test startup without claiming BASIC outer-stack validity. */
  readonly callerStacks?: readonly number[];
  /** Supply an independent device input after startup and before the first source instruction. */
  readonly prepareMain?: (monitor: ViceMonitor) => Promise<void>;
}

/** Observe actual startup, source execution, and return under independently seeded state. */
async function observeStartup(
  artifacts: LibraryArtifacts,
  prgPath: string,
  profile: (typeof sourceLibraryProfiles)[number],
  mode: (typeof modes)[number],
  sample: (typeof samples)[number],
  fixture: StartupCase,
  callerStack?: number,
): Promise<void> {
  const runtime = await startVice(prgPath, 100_000_000, profile, false, false);
  if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
  const monitor = runtime.monitor;
  try {
    // Pinned BASIC SYS reads this status byte, loads A/X/Y, performs PLP, and jumps to startup.
    await stopAt(monitor, 0xe136);
    await monitor.writeMemory(0x030f, Uint8Array.of(sample.p));
    if (callerStack !== undefined) {
      // This independent CPU caller runs only in unoccupied host RAM and is outside compiled costs.
      for (const interval of profileRecords(artifacts.memory.intervals))
        expect(integer(interval.end) <= 0xc200 || integer(interval.start) >= 0xc210).toBe(true);
      const entryAddress = libraryStartup(artifacts, "startup.entry");
      await monitor.writeMemory(
        0xc200,
        Uint8Array.of(
          0xa2,
          callerStack,
          0x9a,
          0xa9,
          0xe1,
          0x48,
          0xa9,
          0x46,
          0x48,
          0xa9,
          sample.p,
          0x48,
          0x28,
          0x4c,
          entryAddress & 0xff,
          entryAddress >> 8,
        ),
      );
      await monitor.writeMemory(0x0014, Uint8Array.of(0x00, 0xc2));
    }
    await stopAt(monitor, libraryStartup(artifacts, "startup.entry"));
    const entry = await monitor.readCpuRegisters();
    expect(entry.p & 0xcf).toBe(sample.p & 0xcf);
    if (callerStack !== undefined) expect(entry.sp).toBe((callerStack - 2) & 0xff);
    const original = await seedMachine(monitor, sample);
    await fixture.prepare?.(monitor);
    const borrowed = borrowedBytes(artifacts);
    expect(borrowed).toEqual(expect.arrayContaining([3, 4, 5, 6, 7, 8, 9]));
    expect(borrowed).toEqual(expect.arrayContaining(fixture.additionalBorrowed ?? []));
    const saved = new Map<number, number>();
    for (const address of borrowed) {
      const value = (address * 29 + sample.p + 0x53) & 0xff;
      saved.set(address, value);
      await monitor.writeMemory(address, Uint8Array.of(value));
    }
    const forbiddenAccesses: number[] = [];
    for (const address of [0xdd00, 0xdd0d])
      for (const operation of ["load", "store"] as const)
        forbiddenAccesses.push(await monitor.setAccessTracepoint(address, operation));
    const gapAccesses: number[] = [];
    if (fixture.hasGap) {
      const gap = Array.from(
        { length: borrowed.at(-1)! - borrowed[0]! },
        (_, index) => borrowed[0]! + index,
      ).find((address) => !borrowed.includes(address));
      expect(gap, "Discontiguous objects require a real unallocated BASIC gap").toBeDefined();
      if (gap === undefined) throw new Error("Missing unallocated gap");
      for (const operation of ["load", "store"] as const)
        gapAccesses.push(await monitor.setAccessTracepoint(gap, operation));
    }
    monitor.takeCheckpointHits();

    await stopAt(monitor, libraryEntry(artifacts, "src/game.blend::Game.main"));
    const startupEvents = monitor.takeCheckpointHits();
    const main = await monitor.readCpuRegisters();
    expect(main.p & 8).toBe(0);
    expect(main.p & 4).toBe(entry.p & 4);
    expect([...(await monitor.readMemory(3, 9))]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    if (fixture.hasGap) expect([...(await monitor.readMemory(0x80, 0x82))]).toEqual([8, 9, 10]);
    const atMain = await machineState(monitor);
    expect(atMain.cpu[0]! & 7).toBe(7);
    expect(atMain.cpu[1]! & 7).toBe(6);
    expect(atMain.cpu[0]! & 0xf8).toBe(original.cpu[0]! & 0xf8);
    expect(atMain.cpu[1]! & 0xf8).toBe(original.cpu[1]! & 0xf8);
    expect(atMain.ciaDirection & 3).toBe(0);
    expect(atMain.ciaDirection & 0xfc).toBe(original.ciaDirection & 0xfc);
    if (mode === "size" && fixture.selection === "compact") {
      // The held status byte survives main; copying its D-cleared value transiently needs a second byte.
      expect(main.sp).toBe((entry.sp - 1) & 0xff);
      expect(Math.max(...expectAccounting(artifacts))).toBeGreaterThanOrEqual(2);
    } else if (mode === "none" || fixture.selection === "full") {
      expect(main.sp).toBe(entry.sp);
    } else {
      expect([entry.sp, (entry.sp - 1) & 0xff]).toContain(main.sp);
    }
    await fixture.prepareMain?.(monitor);

    await stopAt(monitor, libraryStartup(artifacts, "startup.restore"));
    expect([...(await monitor.readMemory(0xc100, 0xc100 + fixture.outputs.length - 1))]).toEqual(
      fixture.outputs,
    );
    // Compact restore must mask IRQ before touching owned state, even if source left I clear.
    if (mode === "size" && main.sp === ((entry.sp - 1) & 0xff))
      expect(libraryBytes(artifacts, libraryStartup(artifacts, "startup.restore"), 1)).toEqual([
        0x78,
      ]);
    // The pinned BASIC SYS continuation starts before its next PHP changes the stack or status.
    await stopAt(monitor, 0xe147);
    const returned = await monitor.readCpuRegisters();
    expect(returned.p & 0xcf).toBe(entry.p & 0xcf);
    expect(returned.sp).toBe((entry.sp + 2) & 0xff);
    if (callerStack !== undefined) expect(returned.sp).toBe(callerStack);
    expect(await machineState(monitor)).toEqual(original);
    for (const [address, value] of saved)
      expect(
        (await monitor.readMemory(address, address))[0],
        `Borrowed byte $${address.toString(16)}`,
      ).toBe(value);
    const events = [...startupEvents, ...monitor.takeCheckpointHits()];
    expect(events.filter((checkpoint) => forbiddenAccesses.includes(checkpoint))).toEqual([]);
    if (main.sp === ((entry.sp - 1) & 0xff))
      expect(events.filter((checkpoint) => gapAccesses.includes(checkpoint))).toEqual([]);
    for (const checkpoint of [...forbiddenAccesses, ...gapAccesses])
      await monitor.deleteCheckpoint(checkpoint);
  } finally {
    await stopVice(runtime);
  }
}

/** Build through the public API with real assembly, then give the root runner sequential runtime cases. */
async function inspectStartup(
  profile: (typeof sourceLibraryProfiles)[number],
  mode: (typeof modes)[number],
  fixture: StartupCase,
  varyState = false,
): Promise<void> {
  await withProfileProject(fixture.source, profile, async (project) => {
    const checked = await checkProject({ project });
    expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
    if (checked.kind !== "success") throw new Error("Expected legal ordinary startup source");
    const built = await buildProject({ project, optimization: mode });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a complete startup build");
    const artifacts = await readProfileArtifacts(built);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expectAccounting(artifacts);
    if (mode === "size" && fixture.selection === "compact")
      expect(libraryBytes(artifacts, libraryStartup(artifacts, "startup.entry"), 3)).toEqual([
        0x08, 0x78, 0xd8,
      ]);
    for (const sample of varyState ? samples : [samples[1]])
      for (const callerStack of fixture.callerStacks ?? [undefined])
        await observeStartup(
          artifacts,
          join(built.generation.directory, built.generation.primaryArtifact),
          profile,
          mode,
          sample,
          fixture,
          callerStack,
        );
  });
}

describe.each(sourceLibraryProfiles)("startup selection on %s", (profile) => {
  it.each(modes)(
    "should restore varied status, CPU ports, CIA2 direction, and all seven borrowed bytes in %s mode",
    async (mode) => {
      // Eligible startup keeps one platform-owned status byte through main and restores every borrowed byte.
      await inspectStartup(
        profile,
        mode,
        {
          source: `module Game;
${owned}
function main(): void { poke($C100, owned[0]); poke($C101, owned[6]); }
`,
          selection: "compact",
          outputs: [1, 7],
        },
        true,
      );
    },
    240_000,
  );

  it.each(modes)(
    "should restore two independently chosen caller stack pointers in %s mode",
    async (mode) => {
      // The CPU caller owns its return address; observation ends before BASIC uses its outer stack.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function main(): void { poke($C100, owned[0]); poke($C101, owned[6]); }
`,
        selection: "compact",
        outputs: [1, 7],
        callerStacks: [0xa0, 0xd0],
      });
    },
    150_000,
  );

  it.each(modes)(
    "should retain full startup for a volatile display-state dependency in %s mode",
    async (mode) => {
      // Device-defined display state is a source input, so display independence cannot be presumed.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function main(): void { poke($C100, peek($D018)); poke($C101, owned[0]); }
`,
        selection: "full",
        outputs: [0x21, 1],
        prepareMain: (monitor) => monitor.writeIo(0xd018, Uint8Array.of(0x21)),
      });
    },
    90_000,
  );

  it.each(modes)(
    "should restore discontiguous borrowed objects without omitting their distant bytes in %s mode",
    async (mode) => {
      // A gap cannot justify omitting a placed object; safe unrolled saves or full startup remain legal.
      await inspectStartup(profile, mode, {
        source: `module Game;
zeropage {
  place(at: $03) owned: byte[7] = [1, 2, 3, 4, 5, 6, 7];
  place(at: $80) distant: byte[3] = [8, 9, 10];
}
function main(): void { poke($C100, owned[6]); poke($C101, distant[2]); }
`,
        selection: "either",
        outputs: [7, 10],
        additionalBorrowed: [0x80, 0x81, 0x82],
        hasGap: true,
      });
    },
    90_000,
  );

  it.each(modes)(
    "should retain full startup for a raw stack-page observer in %s mode",
    async (mode) => {
      // Source visibility of page one blocks introducing held status state that changes the observed stack.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function main(): void { poke($C100, peek($0100)); poke($C101, owned[6]); }
`,
        selection: "full",
        outputs: [0xa6, 7],
        prepare: (monitor) => monitor.writeMemory(0x0100, Uint8Array.of(0xa6)),
      });
    },
    90_000,
  );

  it.each(modes)(
    "should retain full startup for an opaque initializer address in %s mode",
    async (mode) => {
      // A runtime destination in module initialization has no proved footprint for compact stack borrowing.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function initialize(): byte { poke(peekw($C110), 41); return 9; }
let initialized: byte = initialize();
function main(): void { poke($C100, initialized); poke($C101, peek($C112)); }
`,
        selection: "full",
        outputs: [9, 41],
        prepare: (monitor) => monitor.writeMemory(0xc110, Uint8Array.of(0x12, 0xc1, 0)),
      });
    },
    90_000,
  );

  it.each(modes)(
    "should retain full startup for an unproved source bank write in %s mode",
    async (mode) => {
      // Legal low-level source keeps generic startup when its runtime bank mutation is not statically proved.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function main(): void { poke($0001, peek($C111)); poke($C100, owned[6]); }
`,
        selection: "full",
        outputs: [7],
        prepare: (monitor) => monitor.writeMemory(0xc111, Uint8Array.of(0x36)),
      });
    },
    90_000,
  );

  it.each(modes)(
    "should preserve nested balanced status saves and a stack observer in %s mode",
    async (mode) => {
      // Each function balances only its own status saves; nested calls cannot consume platform state.
      await inspectStartup(profile, mode, {
        source: `module Game;
${owned}
function inner(): byte { asm_php(); asm_sei(); asm_plp(); return peek($0100); }
function outer(): byte { asm_php(); let value: byte = inner(); asm_plp(); return value; }
function main(): void { poke($C100, outer()); poke($C101, owned[6]); }
`,
        selection: "full",
        outputs: [0xa6, 7],
        prepare: (monitor) => monitor.writeMemory(0x0100, Uint8Array.of(0xa6)),
      });
    },
    90_000,
  );
});

describe.each(sourceLibraryProfiles)("NMI startup boundaries on %s", (profile) => {
  const source = `module Game;
import { setNMI, restoreNMI } from c64.system;
const CIA1_PA: word = $DC00;
const MARKER: word = $C102;
${owned}
interrupt function hook(): void { poke(CIA1_PA, $7F); poke(MARKER, 1); }
function main(): void {
  setNMI(&hook);
  asm_nop();
  restoreNMI();
  poke($C100, owned[0]); poke($C101, owned[6]);
}
`;
  const phases = [
    "before publication",
    "after publication",
    "before removal",
    "after removal",
    "normal restore",
  ] as const;
  it.each(modes.flatMap((mode) => phases.map((phase) => ({ mode, phase }))))(
    "should preserve an actual accepted NMI at $phase in $mode mode",
    async ({ mode, phase }) => {
      await withProfileProject(source, profile, async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
        if (checked.kind !== "success") throw new Error("Expected legal callback-only source");
        const built = await buildProject({ project, optimization: mode });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a complete NMI startup build");
        const artifacts = await readProfileArtifacts(built);
        expectAccounting(artifacts);
        const installs = cia2OperationGroups(artifacts, source, "setNMI(&hook)");
        const removals = cia2OperationGroups(artifacts, source, "restoreNMI()");
        expect(installs).toHaveLength(1);
        expect(removals).toHaveLength(1);
        const install = installs[0]!;
        const removal = removals[0]!;
        const vectorStores = [install, removal].map((operation) => {
          const instructions = cia2Instructions(operation.bytes);
          expect(instructions.filter((i) => i.opcode === 0x8d && i.operand === 0x318)).toEqual([]);
          const stores = instructions.filter((i) => i.opcode === 0x8d && i.operand === 0x319);
          expect(stores).toHaveLength(1);
          return operation.start + stores[0]!.offset;
        });
        const publication = vectorStores[0]!;
        const release = vectorStores[1]!;
        const variants = cia2FunctionVariants(artifacts, "hook");
        expect(variants).toHaveLength(1);
        const hook = libraryEntry(artifacts, "src/game.blend::Game.hook");
        expect(variants[0]!.start).toBe(hook);
        expect(hook & 0xff).toBe(0x47);
        const bytes = variants[0]!.bytes;
        expect(bytes[0]).toBe(0x08);
        expect(bytes.at(-3)).toBe(0x6c);
        const link = bytes.at(-2)! | (bytes.at(-1)! << 8);
        expect(link & 0xff).toBeLessThanOrEqual(0xfe);
        const restore = libraryStartup(artifacts, "startup.restore");
        const restoreIntervals = profileRecords(artifacts.memory.intervals).filter(
          (interval) => interval.id === "code.startup.restore",
        );
        expect(restoreIntervals).toHaveLength(1);
        expect(integer(restoreIntervals[0]!.start)).toBe(restore);
        const restoreEnd = integer(restoreIntervals[0]!.end);
        expect(restoreEnd).toBeGreaterThan(restore);
        const [arm, first, end] = {
          "before publication": [install.start, install.start, publication + 1],
          "after publication": [publication, publication + 3, removal.start],
          "before removal": [removal.start, removal.start, release + 1],
          "after removal": [release, release + 3, restore],
          "normal restore": [restore, restore, restoreEnd],
        }[phase]!;
        const installed = phase === "after publication" || phase === "before removal";
        const runtime = await startVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          100_000_000,
          profile,
          false,
          false,
        );
        if ("kind" in runtime) throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
        const monitor = runtime.monitor;
        try {
          const sample = samples[1];
          await stopAt(monitor, 0xe136);
          await monitor.writeMemory(0x030f, Uint8Array.of(sample.p));
          await stopAt(monitor, libraryStartup(artifacts, "startup.entry"));
          const entry = await monitor.readCpuRegisters();
          expect(entry.p & 0xcf).toBe(sample.p & 0xcf);
          expect([...(await monitor.readMemory(0xfffa, 0xfffb))]).toEqual([0x43, 0xfe]);
          expect([...(await monitor.readMemory(0xfe43, 0xfe46))]).toEqual([0x78, 0x6c, 0x18, 3]);
          expect([...(await monitor.readMemory(0x318, 0x319))]).toEqual([0x47, 0xfe]);
          const original = await seedMachine(monitor, sample);
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
          await monitor.writeIo(0xdc02, Uint8Array.of(0xff, 0));
          await monitor.writeIo(0xdc00, Uint8Array.of(0x3c));
          await monitor.writeMemory(0x02a1, Uint8Array.of(0));
          await monitor.writeIo(0xdd0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdd0e, Uint8Array.of(8, 8));
          expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x1f).toBe(0);
          await monitor.writeMemory(0xc102, Uint8Array.of(0));
          const saved = new Map<number, number>();
          const borrowed = borrowedBytes(artifacts);
          expect(borrowed).toEqual(expect.arrayContaining([3, 4, 5, 6, 7, 8, 9]));
          for (const address of borrowed) {
            const value = (address * 29 + sample.p + 0x53) & 0xff;
            saved.set(address, value);
            await monitor.writeMemory(address, Uint8Array.of(value));
          }
          const mainAddress = libraryEntry(artifacts, "src/game.blend::Game.main");
          await stopAt(monitor, mainAddress);
          const main = await monitor.readCpuRegisters();
          expect(main.p & 8).toBe(0);
          expect(main.p & 4).toBe(entry.p & 4);
          expect(main.sp).toBe((entry.sp - (mode === "size" ? 1 : 0)) & 0xff);
          if (mode === "size")
            expect(Math.max(...expectAccounting(artifacts))).toBeGreaterThanOrEqual(2);
          if (arm !== mainAddress) await stopAt(monitor, arm!);
          await monitor.writeIo(0xdd04, Uint8Array.of(2, 0));
          await monitor.writeIo(0xdd0d, Uint8Array.of(0x81));
          const paStore = await monitor.setAccessTracepoint(0xdc00, "store");
          const markerStore = await monitor.setAccessTracepoint(0xc102, "store");
          const icrLoad = await monitor.setAccessTracepoint(0xdd0d, "load");
          const icrStore = await monitor.setAccessTracepoint(0xdd0d, "store");
          const linkStores = [
            await monitor.setAccessTracepoint(link, "store"),
            await monitor.setAccessTracepoint(link + 1, "store"),
          ];
          monitor.takeCheckpointHits();
          // Timer timing is only a stimulus candidate; the hardware frame decides the phase.
          await monitor.writeIo(0xdd0e, Uint8Array.of(0x19));
          await stopAt(monitor, 0xfe43);
          const accepted = await monitor.readCpuRegisters();
          const page = await monitor.readMemory(0x100, 0x1ff);
          const stacked = [1, 2, 3].map((offset) => page[(accepted.sp + offset) & 0xff]!);
          const interrupted = stacked[1]! | (stacked[2]! << 8);
          expect(interrupted, `Accepted PC for ${phase}`).toBeGreaterThanOrEqual(first!);
          expect(interrupted, `Accepted PC for ${phase}`).toBeLessThan(end!);
          expect(stacked[0]! & 0x10).toBe(0);
          expect(accepted.p & 4).toBe(4);
          expect(accepted.p & 8).toBe(stacked[0]! & 8);
          expect([...(await monitor.readMemory(0x318, 0x319))]).toEqual(
            installed ? [0x47, hook >> 8] : [0x47, 0xfe],
          );
          const leadingEvents = monitor.takeCheckpointHits();
          expect(
            leadingEvents.filter((id) => [paStore, markerStore, icrLoad, icrStore].includes(id)),
          ).toEqual([]);
          await stopAt(monitor, 0xfe47);
          const prior = await monitor.readCpuRegisters();
          expect([prior.a, prior.x, prior.y, prior.sp]).toEqual([
            accepted.a,
            accepted.x,
            accepted.y,
            accepted.sp,
          ]);
          expect(prior.p & 0xcf).toBe(accepted.p & 0xcf);
          const hookEvents = monitor.takeCheckpointHits();
          expect(hookEvents.filter((id) => id === paStore || id === markerStore)).toEqual(
            installed ? [paStore, markerStore] : [],
          );
          expect(
            hookEvents.filter((id) => id === icrLoad || id === icrStore || linkStores.includes(id)),
          ).toEqual([]);
          expect((await monitor.readMemory(0xc102, 0xc102))[0]).toBe(installed ? 1 : 0);
          expect((await monitor.readIo(0xdc00, 0xdc00))[0]).toBe(installed ? 0x7f : 0x3c);
          const priorPage = await monitor.readMemory(0x100, 0x1ff);
          expect([1, 2, 3].map((offset) => priorPage[(accepted.sp + offset) & 0xff]!)).toEqual(
            stacked,
          );
          if (installed)
            expect([...(await monitor.readMemory(link, link + 1))]).toEqual([0x47, 0xfe]);
          await stopAt(monitor, interrupted);
          const resumed = await monitor.readCpuRegisters();
          expect([resumed.a, resumed.x, resumed.y]).toEqual([accepted.a, accepted.x, accepted.y]);
          expect(resumed.sp).toBe((accepted.sp + 3) & 0xff);
          expect(resumed.p & 0xcf).toBe(stacked[0]! & 0xcf);
          const stockEvents = monitor.takeCheckpointHits();
          expect(stockEvents.filter((id) => id === icrLoad)).toHaveLength(1);
          expect(
            stockEvents.filter(
              (id) => id === paStore || id === markerStore || linkStores.includes(id),
            ),
          ).toEqual([]);
          if (interrupted < restore) await stopAt(monitor, restore);
          expect([...(await monitor.readMemory(0xc100, 0xc102))]).toEqual([
            1,
            7,
            installed ? 1 : 0,
          ]);
          expect([...(await monitor.readMemory(0x318, 0x319))]).toEqual([0x47, 0xfe]);
          expect([...(await monitor.readMemory(link, link + 1))]).toEqual([0x47, 0xfe]);
          if (mode === "size") expect(libraryBytes(artifacts, restore, 1)).toEqual([0x78]);
          await stopAt(monitor, 0xe147);
          const returned = await monitor.readCpuRegisters();
          expect(returned.p & 0xcf).toBe(entry.p & 0xcf);
          expect(returned.sp).toBe((entry.sp + 2) & 0xff);
          expect(await machineState(monitor)).toEqual(original);
          for (const [address, value] of saved)
            expect((await monitor.readMemory(address, address))[0]).toBe(value);
        } finally {
          await stopVice(runtime);
        }
      });
    },
    120_000,
  );
});
