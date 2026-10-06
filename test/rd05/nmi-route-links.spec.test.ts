import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
} from "./profile-fixture.js";

const PROFILES = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
type Instruction = { address: number; bytes: number[] };

/** Preserve actual instruction boundaries and source provenance from public debug ranges. */
function instructions(
  artifacts: Artifacts,
  source?: string,
  proof?: string,
  occurrence = 0,
): Instruction[] {
  const span =
    source !== undefined && proof !== undefined
      ? profileSpan(source, proof, occurrence)
      : undefined;
  const sources = profileRecords(artifacts.debug.sources);
  const functions = profileRecords(artifacts.debug.functions);
  const contexts = profileRecords(artifacts.debug.contexts);
  const spaces = profileRecords(artifacts.debug.addressSpaces);
  const cpu = spaces.findIndex((space) => space.id === "cpu16" && space.kind === "cpu");
  expect(cpu).toBeGreaterThanOrEqual(0);
  const one = [
    0x08, 0x28, 0x40, 0x48, 0x58, 0x60, 0x68, 0x78, 0x8a, 0x98, 0x9a, 0xa8, 0xaa, 0xba, 0xd8, 0xea,
  ];
  const two = [0x09, 0x29, 0x84, 0x85, 0x86, 0xa0, 0xa2, 0xa4, 0xa5, 0xa6, 0xa9];
  const three = [0x20, 0x2c, 0x4c, 0x6c, 0x8c, 0x8d, 0x8e, 0xac, 0xad, 0xae];
  const load = artifacts.prg.readUInt16LE(0);
  const unique = new Map<number, Instruction>();
  for (const [rangeIndex, range] of profileRecords(artifacts.debug.ranges).entries()) {
    if (span !== undefined) {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") continue;
      const actual = profileRecord(origin.span);
      if (
        sources[Number(actual.sourceIndex)]?.path !== span.sourceId ||
        actual.startByte !== span.start ||
        actual.endByte !== span.end
      )
        continue;
    }
    const machine = profileRecord(range.machine);
    let address = Number(machine.start);
    const end = Number(machine.end);
    expect(machine.addressSpaceIndex).toBe(cpu);
    expect(address).toBeGreaterThanOrEqual(load);
    expect(end).toBeGreaterThan(address);
    expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
    const owner = profileRecord(range.owner);
    if (owner.kind === "function") {
      const fn = functions[Number(owner.functionIndex)];
      expect(fn).toBeDefined();
      expect(fn!.rangeIndexes).toContain(rangeIndex);
      if (range.contextIndex !== undefined)
        expect(contexts[Number(range.contextIndex)]?.functionIndex).toBe(owner.functionIndex);
    } else {
      expect(owner).toMatchObject({ kind: "platform", name: "startup" });
      expect(profileRecord(range.origin)).toMatchObject({ kind: "generated", cause: "startup" });
    }
    // A generated startup range is a whole block, while source operations can be single instructions.
    while (address < end) {
      const offset = address - load + 2;
      const opcode = artifacts.prg[offset]!;
      const size = one.includes(opcode)
        ? 1
        : two.includes(opcode)
          ? 2
          : three.includes(opcode)
            ? 3
            : 0;
      expect(size, `Documented instruction at $${address.toString(16)}`).toBeGreaterThan(0);
      if (size === 0) throw new Error("Unsupported instruction in linkage witness");
      expect(address + size).toBeLessThanOrEqual(end);
      const bytes = [...artifacts.prg.subarray(offset, offset + size)];
      if (unique.has(address)) expect(unique.get(address)!.bytes).toEqual(bytes);
      unique.set(address, { address, bytes });
      address += size;
    }
  }
  return [...unique.values()].sort((left, right) => left.address - right.address);
}

/** Decode an actual zero-page or absolute memory operand, not a textual assembly match. */
function operand(instruction: Instruction): number {
  expect([2, 3]).toContain(instruction.bytes.length);
  return instruction.bytes[1]! | ((instruction.bytes[2] ?? 0) << 8);
}

/** Find the immutable indirect-chain word from an emitted source-owned handler. */
function chain(artifacts: Artifacts, name: string) {
  const functions = profileRecords(artifacts.debug.functions);
  const index = functions.findIndex((fn) => fn.qualifiedName === `src/game.blend::Game.${name}`);
  expect(index).toBeGreaterThanOrEqual(0);
  const ranges = profileRecords(artifacts.debug.ranges).filter((range) => {
    const owner = profileRecord(range.owner);
    return owner.kind === "function" && owner.functionIndex === index;
  });
  const tails = instructions(artifacts).filter(
    (instruction) =>
      instruction.bytes[0] === 0x6c &&
      ranges.some((range) => {
        const machine = profileRecord(range.machine);
        return (
          Number(machine.start) <= instruction.address && instruction.address < Number(machine.end)
        );
      }),
  );
  expect(tails).toHaveLength(1);
  const home = operand(tails[0]!);
  expect(home & 0xff).toBeLessThanOrEqual(0xfe);
  const fn = functions[index]!;
  const label = String(profileRecords(fn.entryVariants)[0]!.label).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const match = artifacts.labels.match(new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"));
  expect(match).not.toBeNull();
  return { home, fn, published: Number.parseInt(match![1]!, 16) };
}

/** Prove capture/publication/removal share the decoded word while leaving NMINV low untouched. */
function expectTransaction(
  artifacts: Artifacts,
  source: string,
  install: string,
  restoreOccurrence: number,
  home: number,
  published: number,
) {
  const installCode = instructions(artifacts, source, install);
  const restoreCode = instructions(artifacts, source, "restoreNMI()", restoreOccurrence);
  expect(installCode.length).toBeGreaterThan(0);
  expect(restoreCode.length).toBeGreaterThan(0);
  const lowRead = installCode.findIndex(
    (instruction) => instruction.bytes[0] === 0xad && operand(instruction) === 0x0318,
  );
  const highRead = installCode.findIndex(
    (instruction) => instruction.bytes[0] === 0xad && operand(instruction) === 0x0319,
  );
  const storeAt = (code: Instruction[], address: number) =>
    code.findIndex(
      (instruction) =>
        [0x85, 0x8d].includes(instruction.bytes[0]!) && operand(instruction) === address,
    );
  const lowCapture = storeAt(installCode, home);
  const highCapture = storeAt(installCode, home + 1);
  const publication = storeAt(installCode, 0x0319);
  expect(lowRead).toBeGreaterThanOrEqual(0);
  expect(highRead).toBeGreaterThan(lowCapture);
  expect(lowCapture).toBeGreaterThan(lowRead);
  expect(highCapture).toBeGreaterThan(highRead);
  expect(publication).toBeGreaterThan(highCapture);
  expect(lowCapture).toBe(lowRead + 1);
  expect(highCapture).toBe(highRead + 1);
  expect(installCode[publication - 1]!.bytes).toEqual([0xa9, published >> 8]);
  const highRestoreRead = restoreCode.findIndex(
    (instruction) =>
      [0xa5, 0xad].includes(instruction.bytes[0]!) && operand(instruction) === home + 1,
  );
  expect(highRestoreRead).toBeGreaterThanOrEqual(0);
  expect(storeAt(restoreCode, 0x0319)).toBeGreaterThan(highRestoreRead);
  expect(storeAt(restoreCode, 0x0319)).toBe(highRestoreRead + 1);
  expect(storeAt(restoreCode, 0x0318)).toBe(-1);
  expect(
    restoreCode.some(
      (instruction) =>
        [0xa5, 0xad].includes(instruction.bytes[0]!) && operand(instruction) === home,
    ),
  ).toBe(false);
  for (const code of [installCode, restoreCode]) {
    expect(
      code.filter(
        (instruction) => instruction.bytes[0] === 0x8d && operand(instruction) === 0x0319,
      ),
    ).toHaveLength(1);
    expect(
      code.some((instruction) => instruction.bytes[0] === 0x8d && operand(instruction) === 0x0318),
    ).toBe(false);
    expect(code.filter((instruction) => instruction.bytes[0] === 0x08)).toHaveLength(1);
    expect(code.filter((instruction) => instruction.bytes[0] === 0x48)).toHaveLength(1);
    const last = code.map((instruction) => instruction.bytes[0]).slice(-2);
    expect(last).toEqual([0x68, 0x28]);
  }
  // Absolute-link removal omits the old 6-byte/8-cycle low restore; installation
  // omits its 5-byte/6-cycle low publication. ZP capture/restoration uses actual
  // two-byte/three-cycle opcodes rather than applying those absolute costs.
}

/** Every execution-storage byte must belong to a separately decoded two-byte link. */
function expectOnlyLinkHomes(artifacts: Artifacts, homes: number[]) {
  expect(new Set(homes).size).toBe(homes.length);
  const allowed = homes.flatMap((home) => [home, home + 1]);
  expect(new Set(allowed).size).toBe(allowed.length);
  const intervals = profileRecords(artifacts.memory.intervals);
  const privateIntervals = intervals.filter((interval) =>
    ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
  );
  expect(privateIntervals.reduce((sum, interval) => sum + Number(interval.size), 0)).toBe(
    allowed.length,
  );
  for (const interval of privateIntervals)
    for (let address = Number(interval.start); address < Number(interval.end); address += 1)
      expect(allowed).toContain(address);
  const startup = intervals.find((interval) => interval.id === "platform.startup-state");
  expect(startup).toMatchObject({
    kind: "bss",
    owner: { kind: "compiler", id: "platform.startup-state" },
  });
  expect(startup!.size).toBe(Number(startup!.end) - Number(startup!.start));
  expect(
    Number(startup!.payloadBytes) + Number(startup!.paddingBytes) + Number(startup!.reservedBytes),
  ).toBe(startup!.size);
  // Platform startup/global data is separate physical storage, not a hidden NMI home.
  const functionRanges = profileRecords(artifacts.debug.ranges)
    .filter((range) => profileRecord(range.owner).kind === "function")
    .map((range) => profileRecord(range.machine));
  for (const instruction of instructions(artifacts)) {
    if ([0x8d, 0x8e, 0x8c].includes(instruction.bytes[0]!))
      expect(operand(instruction)).not.toBe(0x0318);
    if (
      functionRanges.some(
        (range) =>
          Number(range.start) <= instruction.address && instruction.address < Number(range.end),
      ) &&
      [0xad, 0xae, 0xac, 0x2c].includes(instruction.bytes[0]!)
    )
      expect(operand(instruction)).not.toBe(0xdd0d);
  }
  expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
  expect(artifacts.memory.acmeReconciled).toBe(true);
}

describe("stock-chained NMI immutable linkage", () => {
  it.each(PROFILES)(
    "should share a page-safe capture and restore word when installing one handler on %s",
    async (profile) => {
      const source =
        "module Game; import { setNMI, restoreNMI } from c64.system; interrupt function B(): void {} function main(): void { setNMI(&B); restoreNMI(); }";
      const artifacts = await buildProfileSource(source, profile);
      const { home, published } = chain(artifacts, "B");
      expectTransaction(artifacts, source, "setNMI(&B)", 0, home, published);
      expectOnlyLinkHomes(artifacts, [home]);
      expect(
        profileRecords(artifacts.memory.stackDomains).find(
          (row) => row.id === "bounded-component-capacity",
        ),
      ).toMatchObject({ peakBytes: 2 });
    },
    60_000,
  );

  it.each(PROFILES)(
    "should retain distinct immutable predecessor words when two handlers nest on %s",
    async (profile) => {
      const source =
        "module Game; import { setNMI, restoreNMI } from c64.system; interrupt function B(): void {} interrupt function C(): void {} interrupt function unused(): void {} function main(): void { setNMI(&B); setNMI(&C); restoreNMI(); restoreNMI(); }";
      const artifacts = await buildProfileSource(source, profile);
      const b = chain(artifacts, "B");
      const c = chain(artifacts, "C");
      expectTransaction(artifacts, source, "setNMI(&B)", 1, b.home, b.published);
      expectTransaction(artifacts, source, "setNMI(&C)", 0, c.home, c.published);
      expectOnlyLinkHomes(artifacts, [b.home, c.home]);
      expect(
        profileRecords(artifacts.memory.stackDomains).find(
          (row) => row.id === "bounded-component-capacity",
        ),
      ).toMatchObject({ peakBytes: 2 });
      expect(
        profileRecords(artifacts.debug.functions).some(
          (fn) => fn.qualifiedName === "src/game.blend::Game.unused",
        ),
      ).toBe(false);
      for (const fn of [b.fn, c.fn]) {
        const entries = profileRecords(fn.entryVariants);
        expect(entries).toHaveLength(1);
        const row = profileRecords(artifacts.memory.stackDomains).find(
          (entry) => entry.id === `nmi-entry:${String(entries[0]!.id)}`,
        );
        expect(row).toMatchObject({ peakBytes: 3, capacityBytes: 236, headroomBytes: 233 });
      }
    },
    60_000,
  );

  it.each(PROFILES)(
    "should preserve disjoint main and IRQ links with a ten-byte bounded peak when IRQ installs NMI on %s",
    async (profile) => {
      const source =
        "module Game; import {setNMI,restoreNMI,setIRQ,restoreIRQ} from c64.system; interrupt function B():void{} interrupt function C():void{} interrupt function onIRQ():void {setNMI(&C);restoreNMI();} function main():void {asm_php();asm_sei();asm_nop();setNMI(&B);setIRQ(&onIRQ);asm_cli();asm_nop();asm_sei();asm_nop();restoreIRQ();restoreNMI();asm_plp();}";
      const artifacts = await buildProfileSource(source, profile);
      const b = chain(artifacts, "B");
      const c = chain(artifacts, "C");
      const irq = chain(artifacts, "onIRQ");
      expectTransaction(artifacts, source, "setNMI(&B)", 1, b.home, b.published);
      expectTransaction(artifacts, source, "setNMI(&C)", 0, c.home, c.published);
      expectOnlyLinkHomes(artifacts, [b.home, c.home, irq.home]);
      const rows = profileRecords(artifacts.memory.stackDomains);
      expect(rows.find((row) => row.id === "bounded-component-capacity")).toMatchObject({
        peakBytes: 10,
        capacityBytes: 236,
        headroomBytes: 226,
      });
      expect(rows.find((row) => row.id === "program")).toMatchObject({ peakBytes: 1 });
      expect(rows.find((row) => row.id === "interrupt-entry-save")).toMatchObject({ peakBytes: 9 });
      const bounded = rows.find((row) => row.id === "bounded-component-capacity")!;
      expect((bounded.route as string[])[0]).toBe("bounded-component:generated-program-and-irq");
      for (const fn of [b.fn, c.fn]) {
        const entry = profileRecords(fn.entryVariants)[0]!;
        const row = rows.find((candidate) => candidate.id === `nmi-entry:${String(entry.id)}`);
        expect(row).toMatchObject({ peakBytes: 3, capacityBytes: 236, headroomBytes: 233 });
        expect((row!.route as string[]).slice(0, 2)).toEqual(["per-entry:generated-nmi", entry.id]);
      }
      // Main PHP contributes 1; CPU/firmware/IRQ status contributes 7, and its
      // NMI transaction contributes 2. Startup and independent NMI peaks are not summed.
      expect(
        profileRecords(profileRecord(artifacts.costs.totals).resources).find(
          (resource) => resource.id === "hardwareStack",
        ),
      ).toMatchObject({ kind: "standard", value: 10 });
      for (const row of rows)
        expect(Number(row.peakBytes) + Number(row.headroomBytes)).toBe(row.capacityBytes);
    },
    60_000,
  );
});
