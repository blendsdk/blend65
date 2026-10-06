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
const IMPORTS = "module Game; import { setNMI, restoreNMI } from c64.system;";

/** Read a reconciled half-open address range from the actual assembled PRG. */
function bytesAt(artifacts: Artifacts, start: number, end: number): number[] {
  const load = artifacts.prg.readUInt16LE(0);
  expect(start).toBeGreaterThanOrEqual(load);
  expect(end).toBeLessThanOrEqual(load + artifacts.prg.length - 2);
  return [...artifacts.prg.subarray(start - load + 2, end - load + 2)];
}

/** Correlate function ownership without assuming internal machine-label spellings. */
function functionCode(artifacts: Artifacts, qualifiedName: string) {
  const fn = profileRecords(artifacts.debug.functions).find(
    (entry) => entry.qualifiedName === qualifiedName,
  );
  expect(fn).toBeDefined();
  const intervals = profileRecords(artifacts.memory.intervals)
    .filter((entry) => {
      const owner = profileRecord(entry.owner);
      return entry.kind === "code" && owner.kind === "function" && owner.id === qualifiedName;
    })
    .sort((left, right) => Number(left.start) - Number(right.start));
  expect(intervals).toHaveLength(1);
  const interval = intervals[0]!;
  return { fn: fn!, bytes: bytesAt(artifacts, Number(interval.start), Number(interval.end)) };
}

/** Resolve the published entry's actual ACME address rather than guessing layout. */
function entryAddress(artifacts: Artifacts, entry: Record<string, unknown>): number {
  const label = String(entry.label).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = artifacts.labels.match(new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)\\b`, "im"));
  expect(match).not.toBeNull();
  return Number.parseInt(match![1]!, 16);
}

/** Keep finite entry peaks separate from the unproved external aggregate. */
function expectEntryPeak(artifacts: Artifacts, entry: Record<string, unknown>, peak: number) {
  const rows = profileRecords(artifacts.memory.stackDomains);
  const row = rows.find((candidate) => candidate.id === `nmi-entry:${String(entry.id)}`);
  expect(row).toMatchObject({ capacityBytes: 236, peakBytes: peak, headroomBytes: 236 - peak });
  expect((row!.route as string[]).slice(0, 2)).toEqual(["per-entry:generated-nmi", entry.id]);
  expect(artifacts.memory.runtimeMemorySafety).toBe("unproven");
  expect(artifacts.memory.acmeReconciled).toBe(true);
  expect(profileRecords(artifacts.memory.unboundedEffects)).toContainEqual(
    expect.objectContaining({
      kind: "machineState",
      effectClass:
        "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline",
    }),
  );
  const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
  expect(resources.find((resource) => resource.id === "hardwareStack")).toMatchObject({
    kind: "standard",
    value: Math.max(...rows.map((candidate) => Number(candidate.peakBytes))),
  });
}

/** Loaded fill and padding are real bytes, not free alignment or firmware output. */
function expectLoadedAccounting(artifacts: Artifacts) {
  const payload = artifacts.prg.length - 2;
  expect(profileRecord(artifacts.costs.totals).programBytes).toBe(payload);
  const pieces = profileRecords(artifacts.costs.entries).filter(
    (entry) => entry.kind === "bytes" && entry.accounting === "program",
  );
  expect(pieces.reduce((total, entry) => total + Number(entry.bytes), 0)).toBe(payload);
  for (const interval of profileRecords(artifacts.memory.intervals)) {
    expect(interval.size).toBe(Number(interval.end) - Number(interval.start));
    expect(
      Number(interval.payloadBytes) +
        Number(interval.paddingBytes) +
        Number(interval.reservedBytes),
    ).toBe(interval.size);
  }
}

/** Retain individual source-correlated instruction boundaries when locating a volatile store. */
function pokeStores(artifacts: Artifacts, source: string, proof: string) {
  const span = profileSpan(source, proof);
  const sources = profileRecords(artifacts.debug.sources);
  const instructions = profileRecords(artifacts.debug.ranges)
    .filter((range) => {
      const origin = profileRecord(range.origin);
      if (origin.kind !== "source") return false;
      const actual = profileRecord(origin.span);
      return (
        sources[Number(actual.sourceIndex)]?.path === span.sourceId &&
        actual.startByte === span.start &&
        actual.endByte === span.end
      );
    })
    .map((range) => {
      const machine = profileRecord(range.machine);
      return {
        address: Number(machine.start),
        bytes: bytesAt(artifacts, Number(machine.start), Number(machine.end)),
      };
    })
    .sort((left, right) => left.address - right.address);
  expect(instructions.length).toBeGreaterThan(0);
  // Both absolute STA and indexed-indirect/indirect-indexed STA preserve a volatile poke.
  const stores = instructions.filter(({ bytes }) => [0x8d, 0x81, 0x91].includes(bytes[0]!));
  expect(stores).toHaveLength(1);
  expect(stores[0]!.bytes).toHaveLength(stores[0]!.bytes[0] === 0x8d ? 3 : 2);
  return stores[0]!;
}

describe("stock-chained NMI assembled output", () => {
  it.each(PROFILES)(
    "should emit a direct three-byte empty chain when building %s",
    async (profile) => {
      const source = `${IMPORTS} interrupt function handler(): void {} function main(): void { setNMI(&handler); restoreNMI(); }`;
      const artifacts = await buildProfileSource(source, profile);
      const { fn, bytes } = functionCode(artifacts, "src/game.blend::Game.handler");
      const entries = profileRecords(fn.entryVariants);
      expect(entries).toHaveLength(1);
      const address = entryAddress(artifacts, entries[0]!);
      expect(address & 0xff).toBe(0x47);
      expect(bytes).toHaveLength(3);
      expect(bytes[0]).toBe(0x6c);
      expect(bytesAt(artifacts, address, address + 3)).toEqual(bytes);
      expect(bytes[1]).toBeLessThanOrEqual(0xfe);
      // JMP indirect is 3 bytes/5 cycles; CPU entry adds 7 cycles/3 stack bytes,
      // and the existing stock dispatch adds 7 cycles but no generated bytes.
      expectEntryPeak(artifacts, entries[0]!, 3);
      expectLoadedAccounting(artifacts);
    },
    60_000,
  );

  it.each(PROFILES)(
    "should save only A and architectural status when a constant write clobbers A on %s",
    async (profile) => {
      const source = `${IMPORTS} interrupt function handler(): void { poke($0400, 7); } function main(): void { setNMI(&handler); restoreNMI(); }`;
      const artifacts = await buildProfileSource(source, profile);
      const { fn, bytes } = functionCode(artifacts, "src/game.blend::Game.handler");
      const entries = profileRecords(fn.entryVariants);
      expect(entries).toHaveLength(1);
      expect(bytes).toHaveLength(13);
      expect(bytes.slice(0, 10)).toEqual([0x08, 0x48, 0xd8, 0xa9, 7, 0x8d, 0, 4, 0x68, 0x28]);
      expect(bytes.slice(10, 11)).toEqual([0x6c]);
      expect(bytes[11]).toBeLessThanOrEqual(0xfe);
      // PHP/PHA/CLD/PLA/PLP/JMP is 8 bytes/21 cycles; the body is 5 bytes/6 cycles.
      // X/Y are untouched. PHP's B/reserved encoding is not a hardware flag latch.
      // These bytes predict binary normalization/restoration; native execution is separate.
      expectEntryPeak(artifacts, entries[0]!, 5);
      expectLoadedAccounting(artifacts);
    },
    60_000,
  );

  it.each(PROFILES)(
    "should retain an ordinary ordered helper call without private homes when building %s",
    async (profile) => {
      const source = `${IMPORTS} function writeConstant(): void { poke($0410, 9); } interrupt function handler(): void { const value: byte = 7; poke($0411, value); writeConstant(); } function main(): void { setNMI(&handler); restoreNMI(); }`;
      const artifacts = await buildProfileSource(source, profile);
      const handler = functionCode(artifacts, "src/game.blend::Game.handler");
      const helper = functionCode(artifacts, "src/game.blend::Game.writeConstant");
      expect(handler.bytes).toHaveLength(16);
      expect(handler.bytes.slice(0, 9)).toEqual([0x08, 0x48, 0xd8, 0xa9, 7, 0x8d, 0x11, 4, 0x20]);
      expect(handler.bytes.slice(11, 14)).toEqual([0x68, 0x28, 0x6c]);
      expect(helper.bytes).toEqual([0xa9, 9, 0x8d, 0x10, 4, 0x60]);
      const callTarget = handler.bytes[9]! | (handler.bytes[10]! << 8);
      expect(bytesAt(artifacts, callTarget, callTarget + 6)).toEqual(helper.bytes);
      // Ordinary JSR/RTS adds exactly 4 bytes/12 cycles and two live return-address bytes.
      const entry = profileRecords(handler.fn.entryVariants)[0]!;
      expectEntryPeak(artifacts, entry, 7);
      const link = handler.bytes[14]! | (handler.bytes[15]! << 8);
      const privateIntervals = profileRecords(artifacts.memory.intervals).filter((interval) =>
        ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
      );
      expect(privateIntervals.reduce((total, interval) => total + Number(interval.size), 0)).toBe(
        2,
      );
      for (const interval of privateIntervals)
        for (let address = Number(interval.start); address < Number(interval.end); address += 1)
          expect([link, link + 1]).toContain(address);
      expectLoadedAccounting(artifacts);
    },
    60_000,
  );

  const flowCases = [
    {
      name: "constant copy",
      declarations: "",
      body: "const base: word = $0400; let address: word = base; poke(address, 7);",
      proofs: ["poke(address, 7)"],
      targets: [0x0400],
    },
    {
      name: "global initializer plus one",
      declarations: "let BASE: word = $0400;",
      body: "let address: word = BASE + 1; poke(address, 9);",
      proofs: ["poke(address, 9)"],
      targets: [0x0401],
    },
    {
      name: "combined ordered flow",
      declarations: "let BASE: word = $0400;",
      body: "const base: word = $0400; let first: word = base; poke(first, 7); let second: word = BASE + 1; poke(second, 9);",
      proofs: ["poke(first, 7)", "poke(second, 9)"],
      targets: [0x0400, 0x0401],
    },
  ];
  for (const fixture of flowCases) {
    it.each(PROFILES)(
      `should preserve source-correlated volatile stores when ${fixture.name} runs on %s`,
      async (profile) => {
        const source = `${IMPORTS} ${fixture.declarations} interrupt function handler(): void {} function main(): void { setNMI(&handler); ${fixture.body} restoreNMI(); }`;
        const artifacts = await buildProfileSource(source, profile);
        const stores = fixture.proofs.map((proof) => pokeStores(artifacts, source, proof));
        for (const [index, store] of stores.entries()) {
          if (store.bytes[0] === 0x8d)
            expect(store.bytes[1]! | (store.bytes[2]! << 8)).toBe(fixture.targets[index]);
          if (index > 0) expect(store.address).toBeGreaterThan(stores[index - 1]!.address);
        }
        // Native checkpoints must prove one write of 7 to $0400 and/or 9 to $0401,
        // with $0400 preceding $0401 in the combined source. An indirect operand
        // alone does not prove its effective target; static output is not that proof.
        expectLoadedAccounting(artifacts);
      },
      60_000,
    );
  }
});
