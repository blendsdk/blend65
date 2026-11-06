import { describe, expect, it } from "vitest";
import {
  buildProfileSource,
  profileRecord,
  profileRecords,
  profileSpan,
} from "./profile-fixture.js";

const TARGETS = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const SOURCE = `module Game;
import { setIRQ, restoreIRQ, setNMI, restoreNMI } from c64.system;
let ADDRESS: word = $c010;
let armed: byte = arm();
let result: word = peekw(ADDRESS);
function arm(): byte { setIRQ(&handler); return 0; }
interrupt function handler(): void {
  let a: byte = peek($c012);
  let b: byte = peek($c013);
  poke($c014, a);
  poke($c015, b);
}
interrupt function empty(): void {}
export function main(): void {
  setNMI(&empty); restoreNMI(); restoreIRQ(); pokew($c016, result);
}
`;

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

/** Missing storage coordinates must not turn an overlap check into a vacuous pass. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0)
    throw new TypeError("Expected integer evidence");
  return value;
}

/** One decoded instruction retains the exact public ranges that own its bytes. */
type Instruction = { address: number; opcode: number; operand: number; width: number };

/** One emitted entry context, without filling gaps between its published ranges. */
type Body = {
  contextIndex: number;
  addressSpaceIndex: number;
  instructions: Map<number, Instruction>;
};

/** A complete physical byte with validated symbol, context and lifetime links. */
type Home = {
  addressSpaceIndex: number;
  start: number;
  end: number;
  contextIndex: number;
  liveRanges: { start: number; end: number }[];
};

/** NMOS instruction widths establish boundaries, not generated behavior expectations. */
const WIDTHS = new Map<number, number>();
[
  "00 08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8",
  "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
  "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
].forEach((opcodes, index) => {
  for (const opcode of opcodes.split(" ")) WIDTHS.set(Number.parseInt(opcode, 16), index + 1);
});

/** Require a real indexed record; negative, missing and fractional links must fail. */
function indexed(records: Record<string, unknown>[], value: unknown): Record<string, unknown> {
  const record = records[integer(value)];
  if (!record) throw new Error("Missing indexed debug record");
  return record;
}

/** Validate the selected CPU address space rather than assuming index zero. */
function cpuSpace(artifacts: Artifacts, value: unknown): number {
  const index = integer(value);
  const spaces = profileRecords(artifacts.debug.addressSpaces);
  expect(spaces.filter((space) => space.id === "cpu16")).toHaveLength(1);
  expect(indexed(spaces, index)).toMatchObject({
    id: "cpu16",
    kind: "cpu",
    sizeBytes: 65536,
    banks: [],
  });
  return index;
}

/** Decode every physical variant only through its own aligned, owned ranges. */
function emittedBodies(artifacts: Artifacts, scope: string): Body[] {
  const functions = profileRecords(artifacts.debug.functions);
  const selected = functions.filter((fn) => fn.qualifiedName === scope);
  expect(selected).toHaveLength(1);
  const fn = selected[0]!;
  const functionIndex = functions.indexOf(fn);
  const variants = profileRecords(fn.entryVariants);
  const contexts = profileRecords(artifacts.debug.contexts);
  const ranges = profileRecords(artifacts.debug.ranges);
  expect(variants.length).toBeGreaterThan(0);
  if (!Array.isArray(fn.rangeIndexes)) throw new Error("Missing function range union");
  const bodies = variants.map((variant, entryVariantIndex) => {
    const matches = contexts.filter(
      (context) =>
        context.functionIndex === functionIndex && context.entryVariantIndex === entryVariantIndex,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]!.kind).toBe("entry");
    const contextIndex = contexts.indexOf(matches[0]!);
    if (!Array.isArray(variant.rangeIndexes) || variant.rangeIndexes.length === 0) {
      throw new Error("Missing entry-variant ranges");
    }
    const instructions = new Map<number, Instruction>();
    const occupied = new Set<number>();
    let addressSpaceIndex: number | undefined;
    for (const index of variant.rangeIndexes) {
      expect(fn.rangeIndexes).toContain(integer(index));
      const range = indexed(ranges, index);
      expect(range.contextIndex).toBe(contextIndex);
      expect(range.owner).toMatchObject({ kind: "function", functionIndex });
      const machine = profileRecord(range.machine);
      const space = cpuSpace(artifacts, machine.addressSpaceIndex);
      if (addressSpaceIndex !== undefined) expect(space).toBe(addressSpaceIndex);
      addressSpaceIndex = space;
      const start = integer(machine.start);
      const end = integer(machine.end);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(65536);
      for (let address = start; address < end; ) {
        const offset = 2 + address - artifacts.prg.readUInt16LE(0);
        expect(offset).toBeGreaterThanOrEqual(2);
        const opcode = artifacts.prg[offset]!;
        const width = WIDTHS.get(opcode);
        if (!width) throw new Error("Missing legal instruction boundary");
        expect(address + width).toBeLessThanOrEqual(end);
        expect(offset + width).toBeLessThanOrEqual(artifacts.prg.length);
        const operand =
          width === 3
            ? artifacts.prg.readUInt16LE(offset + 1)
            : width === 2
              ? artifacts.prg[offset + 1]!
              : 0;
        const previous = instructions.get(address);
        if (previous) {
          expect(previous).toEqual({ address, opcode, operand, width });
        } else {
          for (let byte = address; byte < address + width; byte += 1) {
            if (occupied.has(byte)) throw new Error("Misaligned overlapping instruction ranges");
            occupied.add(byte);
          }
        }
        instructions.set(address, { address, opcode, operand, width });
        address += width;
      }
    }
    if (addressSpaceIndex === undefined) throw new Error("Missing emitted address space");
    return { contextIndex, addressSpaceIndex, instructions };
  });
  for (const context of contexts.filter((record) => record.functionIndex === functionIndex)) {
    expect(context.kind).toBe("entry");
    expect(variants[integer(context.entryVariantIndex)]).toBeDefined();
  }
  return bodies;
}

/** Match only exact source expression temporaries or the one approved declaration. */
function candidateHomes(
  artifacts: Artifacts,
  scope: string,
  proof: string,
  bodies: Body[],
  allowLocal: boolean,
): Home[] {
  const span = profileSpan(SOURCE, proof);
  const local = profileSpan(SOURCE, "let a: byte = peek($c012);");
  const sourceIndex = profileRecords(artifacts.debug.sources).findIndex(
    (source) => source.path === span.sourceId,
  );
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const inventory = profileRecords(artifacts.debug.symbols);
  const locations = profileRecords(artifacts.debug.locations);
  const ranges = profileRecords(artifacts.debug.ranges);
  const functions = profileRecords(artifacts.debug.functions);
  const functionIndex = functions.findIndex((fn) => fn.qualifiedName === scope);
  const symbols = inventory.filter((symbol) => {
    if (symbol.scope !== scope || symbol.byteWidth !== 1) return false;
    const wanted =
      symbol.kind === "temporary"
        ? span
        : allowLocal && symbol.kind === "local"
          ? local
          : undefined;
    if (!wanted) return false;
    const origin = profileRecord(symbol.origin);
    if (origin.kind !== "source") return false;
    const actual = profileRecord(origin.span);
    return (
      actual.sourceIndex === sourceIndex &&
      actual.startByte === wanted.start &&
      actual.endByte === wanted.end
    );
  });
  expect(symbols.length, `Exact source-retained byte at ${proof}`).toBeGreaterThan(0);
  const homes = symbols.flatMap((symbol) => {
    expect(symbol.byteWidth).toBe(1);
    if (!Array.isArray(symbol.locationIndexes)) throw new TypeError("Missing temporary locations");
    return symbol.locationIndexes.flatMap((index) => {
      const location = indexed(locations, index);
      expect(location.symbolIndex).toBe(inventory.indexOf(symbol));
      const contextIndex = integer(location.contextIndex);
      const body = bodies.find((entry) => entry.contextIndex === contextIndex);
      if (!body) throw new Error("Location belongs to another emitted context");
      if (!Array.isArray(location.liveRangeIndexes) || location.liveRangeIndexes.length === 0) {
        throw new Error("Missing physical lifetime ranges");
      }
      const liveRanges = location.liveRangeIndexes.map((rangeIndex) => {
        const range = indexed(ranges, rangeIndex);
        expect(range.contextIndex).toBe(contextIndex);
        expect(range.owner).toMatchObject({ kind: "function", functionIndex });
        const machine = profileRecord(range.machine);
        expect(cpuSpace(artifacts, machine.addressSpaceIndex)).toBe(body.addressSpaceIndex);
        const start = integer(machine.start);
        const end = integer(machine.end);
        expect(end).toBeGreaterThan(start);
        expect(end).toBeLessThanOrEqual(65536);
        return { start, end };
      });
      const availability = profileRecord(location.availability);
      if (availability.kind !== "available") return [];
      return profileRecords(availability.pieces).flatMap((piece) => {
        if (piece.kind !== "memory") return [];
        const machine = profileRecord(piece.machine);
        const home = {
          addressSpaceIndex: cpuSpace(artifacts, machine.addressSpaceIndex),
          start: integer(machine.start),
          end: integer(machine.end),
          contextIndex,
          liveRanges,
        };
        expect(home.addressSpaceIndex).toBe(body.addressSpaceIndex);
        expect(home.end).toBeLessThanOrEqual(65536);
        expect(home.end - home.start).toBe(1);
        expect(piece.byteLength).toBe(1);
        expect(piece.valueOffset).toBe(0);
        // A CPU coordinate must also be allocated, mutable function RAM in the active view.
        const privateRam = [
          [0x02, 0x90],
          [0x0801, 0xa000],
          [0xc000, 0xd000],
        ] as const;
        expect(privateRam.some(([start, end]) => home.start >= start && home.end <= end)).toBe(
          true,
        );
        const storage = profileRecords(artifacts.memory.intervals).filter(
          (interval) =>
            interval.addressSpaceId === "cpu16" &&
            interval.mutability === "mutable" &&
            profileRecord(interval.owner).kind === "function" &&
            ["sfa", "zeroPage"].includes(String(interval.kind)) &&
            ["general", "zeroPage"].includes(String(interval.resourceClass)) &&
            integer(interval.start) <= home.start &&
            home.end <= integer(interval.end),
        );
        expect(
          storage.length,
          "Retained home must belong to allocated private function storage",
        ).toBeGreaterThan(0);
        for (const interval of storage) {
          expect(interval.cpuMappings).toContain("cpu");
          expect(interval.residencyIds).toContain("resident");
        }
        return [home];
      });
    });
  });
  expect(homes.length, `Available physical byte at ${proof}`).toBeGreaterThan(0);
  return homes;
}

/** The fixture's straight byte transfers are observed by identity, never evaluated numerically. */
function irqCaptureHomes(body: Body, candidates: Home[]): Home[] {
  const loads = new Map<number, "a" | "x" | "y">([
    [0xa5, "a"],
    [0xad, "a"],
    [0xa6, "x"],
    [0xae, "x"],
    [0xa4, "y"],
    [0xac, "y"],
  ]);
  const stores = new Map<number, "a" | "x" | "y">([
    [0x85, "a"],
    [0x8d, "a"],
    [0x86, "x"],
    [0x8e, "x"],
    [0x84, "y"],
    [0x8c, "y"],
  ]);
  const instructions = [...body.instructions.values()];
  const reads = instructions.filter(
    (instruction) => loads.has(instruction.opcode) && instruction.operand === 0xc012,
  );
  const intervening = instructions.filter(
    (instruction) => loads.has(instruction.opcode) && instruction.operand === 0xc013,
  );
  const writes = instructions.filter(
    (instruction) => stores.has(instruction.opcode) && instruction.operand === 0xc014,
  );
  expect(reads).toHaveLength(1);
  expect(intervening).toHaveLength(1);
  expect(writes).toHaveLength(1);
  const registers = { a: false, x: false, y: false };
  registers[loads.get(reads[0]!.opcode)!] = true;
  const retained = new Set<number>();
  const capturedBefore = new Set<number>();
  const used = new Set<Home>();
  const visited = new Set<number>();
  let sawIntervening = false;
  let reloaded = false;
  let pc = reads[0]!.address + reads[0]!.width;
  while (!visited.has(pc)) {
    visited.add(pc);
    const instruction = body.instructions.get(pc);
    if (!instruction) throw new Error("Missing aligned IRQ capture continuation");
    const { opcode, operand } = instruction;
    if (opcode === 0x4c) {
      pc = operand;
      continue;
    }
    const load = loads.get(opcode);
    const store = stores.get(opcode);
    if (load) {
      if (instruction === intervening[0]) sawIntervening = true;
      registers[load] = retained.has(operand);
      if (registers[load]) {
        const homes = candidates.filter(
          (home) => home.start === operand && home.contextIndex === body.contextIndex,
        );
        expect(homes.length).toBeGreaterThan(0);
        for (const home of homes) {
          expect(
            home.liveRanges.some(
              (range) => pc >= range.start && pc + instruction.width <= range.end,
            ),
          ).toBe(true);
          used.add(home);
        }
        if (sawIntervening && capturedBefore.has(operand)) reloaded = true;
      }
    } else if (store) {
      if (instruction === writes[0]) {
        expect(registers[store] && sawIntervening && reloaded).toBe(true);
        expect(used.size).toBeGreaterThan(0);
        return [...used];
      }
      if (registers[store]) {
        const homes = candidates.filter(
          (home) => home.start === operand && home.contextIndex === body.contextIndex,
        );
        expect(
          homes.length,
          "Every actual capture home needs exact source evidence",
        ).toBeGreaterThan(0);
        homes.forEach((home) => used.add(home));
        retained.add(operand);
        if (!sawIntervening) capturedBefore.add(operand);
      } else {
        retained.delete(operand);
      }
    } else if ([0xa9, 0xa2, 0xa0].includes(opcode)) {
      registers[opcode === 0xa9 ? "a" : opcode === 0xa2 ? "x" : "y"] = false;
    } else if (opcode === 0xaa) registers.x = registers.a;
    else if (opcode === 0xa8) registers.y = registers.a;
    else if (opcode === 0x8a) registers.a = registers.x;
    else if (opcode === 0x98) registers.a = registers.y;
    else if (![0x18, 0x38, 0x58, 0x78, 0xb8, 0xd8, 0xf8, 0xea, 0xc9].includes(opcode)) {
      throw new Error("Unsupported IRQ value transfer before delivery");
    }
    pc += instruction.width;
  }
  throw new Error("Cycle before IRQ byte delivery");
}

/** Require the initializer temporary, but permit proved direct delivery into the exact IRQ local. */
function retainedBytes(
  artifacts: Artifacts,
  scope: string,
  proof: string,
  allowLocal = false,
): Home[] {
  const bodies = emittedBodies(artifacts, scope);
  const candidates = candidateHomes(artifacts, scope, proof, bodies, allowLocal);
  return bodies.flatMap((body) => {
    const homes = candidates.filter((home) => home.contextIndex === body.contextIndex);
    expect(homes.length, "Every emitted context needs an available retained home").toBeGreaterThan(
      0,
    );
    if (allowLocal) return irqCaptureHomes(body, homes);
    for (const home of homes) {
      const instructions = [...body.instructions.values()];
      expect(
        instructions.some(
          ({ opcode, operand }) =>
            [0x84, 0x85, 0x86, 0x8c, 0x8d, 0x8e].includes(opcode) && operand === home.start,
        ),
      ).toBe(true);
      expect(
        instructions.some(
          ({ opcode, operand }) =>
            [0xa4, 0xa5, 0xa6, 0xac, 0xad, 0xae].includes(opcode) && operand === home.start,
        ),
      ).toBe(true);
    }
    return homes;
  });
}

/** Incomparable spaces are missing evidence, never an excuse to skip separation. */
function requireSeparation(main: Home, irq: Home): void {
  if (main.addressSpaceIndex !== irq.addressSpaceIndex)
    throw new Error("Incomparable CPU address spaces");
  if (!(main.end <= irq.start || irq.end <= main.start))
    throw new Error("Retained physical bytes overlap");
}

describe.each(TARGETS)("Initializer and IRQ retained-byte separation on %s", (target) => {
  // IRQ's first sampled byte and the initializer's saved low byte can both remain live during preemption.
  it("should separate a saved initializer temporary from every actual retained IRQ byte", async () => {
    const artifacts = await buildProfileSource(SOURCE, target);
    const declaration = profileSpan(SOURCE, "let result: word = peekw(ADDRESS);");
    const initializerScope = `initializer::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
    const functions = profileRecords(artifacts.debug.functions);
    expect(functions.some((fn) => fn.qualifiedName === initializerScope)).toBe(true);
    const handler = functions.find((fn) => fn.qualifiedName === "src/game.blend::Game.handler");
    expect(handler).toMatchObject({ kind: "interrupt" });
    if (typeof handler?.qualifiedName !== "string") throw new TypeError("Missing handler scope");
    const initializer = retainedBytes(artifacts, initializerScope, "peekw(ADDRESS)");
    const interrupt = retainedBytes(artifacts, handler.qualifiedName, "peek($c012)", true);
    for (const main of initializer)
      for (const irq of interrupt) {
        requireSeparation(main, irq);
        expect(
          main.end <= irq.start || irq.end <= main.start,
          `Initializer [${main.start},${main.end}) and IRQ [${irq.start},${irq.end}) must be disjoint`,
        ).toBe(true);
      }
  }, 30_000);
});

/** Form synthetic instruction bytes without changing opcode or operand order. */
function instructionBytes(...instructions: number[][]): Uint8Array {
  return Uint8Array.from(instructions.flat());
}

/** Reuse the same CPU-space extent shape in synthetic ranges and location pieces. */
function syntheticExtent(start: number, end: number) {
  return { addressSpaceIndex: 0, start, end };
}

/** Build small typed observer inputs, never substituted for real compiler builds. */
function syntheticArtifacts(kind: "temporary" | "local", intermediates = false): Artifacts {
  const declaration = profileSpan(SOURCE, "let result: word = peekw(ADDRESS);");
  const initializerScope = `initializer::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
  const initializer = instructionBytes(
    [0xad, 0x10, 0xc0],
    [0x85, 0x40],
    [0xad, 0x11, 0xc0],
    [0xa5, 0x40],
    [0x60],
  );
  const irq = instructionBytes(
    [0xad, 0x12, 0xc0],
    [0x85, 0x41],
    ...(intermediates ? [[0xa5, 0x41, 0x85, 0x43]] : []),
    [0xad, 0x13, 0xc0],
    [0x85, 0x42],
    [0xa5, intermediates ? 0x43 : 0x41],
    [0x8d, 0x14, 0xc0],
    [0x40],
  );
  const prg = Buffer.alloc(2 + 0x100 + irq.length);
  prg.writeUInt16LE(0x2000);
  prg.set(initializer, 2);
  prg.set(irq, 2 + 0x100);
  const scopes = [initializerScope, "src/game.blend::Game.handler"];
  const localProof = "let a: byte = peek($c012);";
  const proof = kind === "local" ? localProof : "peek($c012)";
  const symbols = [
    { kind: "temporary", proof: "peekw(ADDRESS)", contextIndex: 0, home: 0x40 },
    { kind, proof, contextIndex: 1, home: 0x41 },
    ...(intermediates ? [{ kind: "local", proof: localProof, contextIndex: 1, home: 0x43 }] : []),
  ];
  return {
    prg,
    assembly: "",
    labels: "",
    build: {},
    memory: {
      intervals: [
        {
          addressSpaceId: "cpu16",
          start: 0x40,
          end: 0x44,
          owner: { kind: "function", id: "synthetic-overlay" },
          kind: "zeroPage",
          mutability: "mutable",
          resourceClass: "zeroPage",
          cpuMappings: ["cpu"],
          residencyIds: ["resident"],
        },
      ],
    },
    costs: {},
    debug: {
      sources: [{ path: "src/game.blend" }],
      addressSpaces: [{ id: "cpu16", kind: "cpu", sizeBytes: 65536, banks: [] }],
      functions: scopes.map((qualifiedName, index) => ({
        qualifiedName,
        rangeIndexes: [index],
        entryVariants: [
          { id: `body-${index}`, kind: "primary", label: `entry-${index}`, rangeIndexes: [index] },
        ],
      })),
      contexts: scopes.map((_scope, functionIndex) => ({
        kind: "entry",
        functionIndex,
        entryVariantIndex: 0,
      })),
      ranges: [initializer, irq].map((bytes, index) => ({
        machine: syntheticExtent(0x2000 + index * 0x100, 0x2000 + index * 0x100 + bytes.length),
        contextIndex: index,
        owner: { kind: "function", functionIndex: index },
      })),
      symbols: symbols.map((symbol, index) => {
        const span = profileSpan(SOURCE, symbol.proof);
        return {
          kind: symbol.kind,
          scope: scopes[symbol.contextIndex],
          byteWidth: 1,
          locationIndexes: [index],
          origin: {
            kind: "source",
            span: { sourceIndex: 0, startByte: span.start, endByte: span.end },
          },
        };
      }),
      locations: symbols.map(({ contextIndex, home }, symbolIndex) => {
        const machine = syntheticExtent(home, home + 1);
        const pieces = [{ kind: "memory", valueOffset: 0, byteLength: 1, machine }];
        const availability = { kind: "available", pieces };
        return { symbolIndex, contextIndex, liveRangeIndexes: [contextIndex], availability };
      }),
    },
  };
}

/** Apply the same retention and separation obligations to the small observer inputs. */
function observeSynthetic(artifacts: Artifacts): Home[] {
  const declaration = profileSpan(SOURCE, "let result: word = peekw(ADDRESS);");
  const scope = `initializer::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
  const initializer = retainedBytes(artifacts, scope, "peekw(ADDRESS)");
  const irq = retainedBytes(artifacts, "src/game.blend::Game.handler", "peek($c012)", true);
  for (const main of initializer) for (const home of irq) requireSeparation(main, home);
  return irq;
}

/** Access one synthetic location's machine field for precise corruption cases. */
function syntheticMachine(artifacts: Artifacts, index: number): Record<string, unknown> {
  const location = profileRecords(artifacts.debug.locations)[index]!;
  const pieces = profileRecords(profileRecord(location.availability).pieces);
  return profileRecord(pieces[0]!.machine);
}

describe("retained-byte home observer", () => {
  it.each(["temporary", "local"] as const)("accepts a proved %s-backed capture", (kind) => {
    expect(observeSynthetic(syntheticArtifacts(kind)).map((home) => home.start)).toEqual([0x41]);
  });

  it("includes both temporary and local intermediate homes actually carrying the value", () => {
    const homes = observeSynthetic(syntheticArtifacts("temporary", true));
    expect([...new Set(homes.map((home) => home.start))].sort()).toEqual([0x41, 0x43]);
  });

  /** Each mutation breaks one required evidence link or one actual byte transfer. */
  const corruptions: Record<string, (artifacts: Artifacts) => void> = {
    "missing mandatory initializer temporary": (artifacts) => {
      profileRecords(artifacts.debug.symbols)[0]!.kind = "local";
    },
    "missing IRQ symbol": (artifacts) => {
      artifacts.debug.symbols = profileRecords(artifacts.debug.symbols).slice(0, 1);
    },
    "wrong symbol link": (artifacts) => {
      profileRecords(artifacts.debug.locations)[1]!.symbolIndex = 0;
    },
    "missing location": (artifacts) => {
      profileRecords(artifacts.debug.symbols)[1]!.locationIndexes = [];
    },
    "wrong source": (artifacts) => {
      const origin = profileRecord(profileRecords(artifacts.debug.symbols)[1]!.origin);
      profileRecord(origin.span).sourceIndex = 1;
    },
    "wrong exact source span": (artifacts) => {
      const origin = profileRecord(profileRecords(artifacts.debug.symbols)[1]!.origin);
      profileRecord(origin.span).endByte = 0;
    },
    "wrong scope": (artifacts) => {
      profileRecords(artifacts.debug.symbols)[1]!.scope = "src/game.blend::Game.empty";
    },
    "wrong emitted context": (artifacts) => {
      profileRecords(artifacts.debug.locations)[1]!.contextIndex = 0;
    },
    "wrong lifetime context": (artifacts) => {
      profileRecords(artifacts.debug.locations)[1]!.liveRangeIndexes = [0];
    },
    "wrong symbol width": (artifacts) => {
      profileRecords(artifacts.debug.symbols)[1]!.byteWidth = 2;
    },
    "wrong physical width": (artifacts) =>
      Object.assign(syntheticMachine(artifacts, 1), { end: 0x43 }),
    "missing address space": (artifacts) =>
      Object.assign(syntheticMachine(artifacts, 1), { addressSpaceIndex: 1 }),
    "unavailable home": (artifacts) => {
      profileRecords(artifacts.debug.locations)[1]!.availability = { kind: "optimizedAway" };
    },
    "unrelated nearby local": (artifacts) => {
      const symbol = profileRecords(artifacts.debug.symbols)[1]!;
      const span = profileSpan(SOURCE, "let b: byte = peek($c013);");
      symbol.origin = {
        kind: "source",
        span: { sourceIndex: 0, startByte: span.start, endByte: span.end },
      };
    },
    "absent capture": (artifacts) => {
      artifacts.prg[2 + 0x100 + 4] = 0x42;
    },
    "absent same-home reload": (artifacts) => {
      artifacts.prg[2 + 0x100 + 11] = 0x42;
    },
    "actual IRQ home overlapping the initializer": (artifacts) => {
      const machine = syntheticMachine(artifacts, 1);
      machine.start = 0x40;
      machine.end = 0x41;
      artifacts.prg[2 + 0x100 + 4] = 0x40;
      artifacts.prg[2 + 0x100 + 11] = 0x40;
    },
    "a CPU-port capture instead of private RAM": (artifacts) => {
      Object.assign(syntheticMachine(artifacts, 1), { start: 0x0001, end: 0x0002 });
      for (const offset of [4, 11]) artifacts.prg[2 + 0x100 + offset] = 0x01;
    },
    "an extra volatile read hidden in a BIT instruction": (artifacts) => {
      const insertion = 2 + 0x100 + 5;
      artifacts.prg = Buffer.concat([
        artifacts.prg.subarray(0, insertion),
        Buffer.from([0x2c, 0x12, 0xc0]),
        artifacts.prg.subarray(insertion),
      ]);
      profileRecords(artifacts.debug.ranges)[1]!.machine = syntheticExtent(0x2100, 0x2113);
    },
  };
  it.each(Object.entries(corruptions))("rejects %s", (_name, corrupt) => {
    const artifacts = syntheticArtifacts("local");
    corrupt(artifacts);
    expect(() => observeSynthetic(artifacts)).toThrow();
  });

  it("rejects incomparable spaces instead of skipping their overlap obligation", () => {
    const homes = observeSynthetic(syntheticArtifacts("local"));
    expect(() => requireSeparation(homes[0]!, { ...homes[0]!, addressSpaceIndex: 1 })).toThrow();
  });

  it("rejects a second emitted context without its own retained-home evidence", () => {
    const artifacts = syntheticArtifacts("local");
    const payload = artifacts.prg.subarray(2 + 0x100);
    const expanded = Buffer.alloc(2 + 0x200 + payload.length);
    expanded.set(artifacts.prg);
    expanded.set(payload, 2 + 0x200);
    artifacts.prg = expanded;
    const handler = profileRecords(artifacts.debug.functions)[1]!;
    handler.rangeIndexes = [1, 2];
    handler.entryVariants = [
      ...profileRecords(handler.entryVariants),
      { id: "second-handler", kind: "primary", label: "second-handler", rangeIndexes: [2] },
    ];
    artifacts.debug.contexts = [
      ...profileRecords(artifacts.debug.contexts),
      { kind: "entry", functionIndex: 1, entryVariantIndex: 1 },
    ];
    artifacts.debug.ranges = [
      ...profileRecords(artifacts.debug.ranges),
      {
        machine: syntheticExtent(0x2200, 0x2200 + payload.length),
        contextIndex: 2,
        owner: { kind: "function", functionIndex: 1 },
      },
    ];
    expect(() => observeSynthetic(artifacts)).toThrow();
  });
});
