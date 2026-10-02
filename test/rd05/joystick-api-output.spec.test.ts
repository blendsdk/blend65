import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import type { TypedProgram } from "@blend65/compiler/frontend";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import {
  analyzeProfileSource,
  buildProfileSource as buildFixtureSource,
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

type Profile = NonNullable<TypedProgram["profile"]>["id"];
type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;

const PROFILES: readonly Profile[] = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
];
const PORTS = [
  { name: "readJoystick1", address: 0xdc01 },
  { name: "readJoystick2", address: 0xdc00 },
] as const;
const PREDICATES = [
  { name: "joystickUp", mask: 1 },
  { name: "joystickDown", mask: 2 },
  { name: "joystickLeft", mask: 4 },
  { name: "joystickRight", mask: 8 },
  { name: "joystickFire", mask: 16 },
] as const;
const MASKS = [...PREDICATES, { name: "joystickControls", mask: 31 }];

/** Retain our fixture source so debug addressing depends on source facts, not name formatting. */
async function buildProfileSource(program: string, profile: Profile) {
  return { ...(await buildFixtureSource(program, profile)), source: program };
}

/** Assemble ordinary source without introducing a source runtime or synthetic module. */
function source(imports: readonly string[], body: string, declarations = "", placement = "") {
  return `module Game;
${imports.length === 0 ? "" : `import { ${imports.join(", ")} } from c64.input;`}
${declarations}
${placement}function main(): void { ${body} }
`;
}

/** Fail on missing or malformed evidence instead of treating unavailable values as zero. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw new TypeError("Expected a nonnegative evidence integer");
  return value;
}

/** Recover one main function's final machine interval from the indexed public debug contract. */
function mainRange(artifacts: Artifacts) {
  const functions = profileRecords(artifacts.debug.functions);
  const ranges = profileRecords(artifacts.debug.ranges);
  const sources = profileRecords(artifacts.debug.sources);
  const proof = "function main(): void";
  const proofIndex = artifacts.source.indexOf(proof);
  if (proofIndex < 0) throw new Error("Fixture source must declare main");
  const proofStart = Buffer.byteLength(artifacts.source.slice(0, proofIndex));
  const proofEnd = proofStart + Buffer.byteLength(proof);
  const matches = functions.filter((record) => {
    const declaration = profileRecord(record.declaration);
    return (
      sources[integer(declaration.sourceIndex)]?.path === "src/game.blend" &&
      integer(declaration.startByte) <= proofStart &&
      integer(declaration.endByte) >= proofEnd
    );
  });
  expect(matches, "Source evidence must identify exactly one main declaration").toHaveLength(1);
  const main = matches[0];
  if (main === undefined || !Array.isArray(main.rangeIndexes) || main.rangeIndexes.length === 0)
    throw new Error("Debug evidence must locate the emitted main function");
  const machines = main.rangeIndexes.map((index) => {
    const range = ranges[integer(index)];
    if (range === undefined) throw new Error("Function range index must resolve");
    return profileRecord(range.machine);
  });
  return {
    start: Math.min(...machines.map((machine) => integer(machine.start))),
    end: Math.max(...machines.map((machine) => integer(machine.end))),
  };
}

/** Select actual assembled bytes by CPU address, accounting for the two-byte PRG header. */
function machineBytes(artifacts: Artifacts, start: number, end: number) {
  const load = artifacts.prg.readUInt16LE(0);
  if (start < load || end > load + artifacts.prg.length - 2 || end <= start)
    throw new Error("Machine interval must fit the actual PRG payload");
  return artifacts.prg.subarray(2 + start - load, 2 + end - load);
}

/** Read the complete main interval; expectations never come from assembly text. */
function mainBytes(artifacts: Artifacts) {
  const range = mainRange(artifacts);
  return machineBytes(artifacts, range.start, range.end);
}

// Official NMOS widths prevent operand bytes from being mistaken for instructions.
const WIDTHS = new Map<number, number>();
for (const [width, opcodes] of [
  [1, "00 08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8"],
  [
    2,
    "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
  ],
  [
    3,
    "0d 0e 19 1d 1e 20 2c 2d 2e 39 3d 3e 4c 4d 4e 59 5d 5e 6c 6d 6e 79 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
  ],
] as const) {
  for (const opcode of opcodes.split(" ")) WIDTHS.set(Number.parseInt(opcode, 16), width);
}

/** Decode boundaries only: this is an opcode-width check, not a CPU execution model. */
function instructions(artifacts: Artifacts) {
  const bytes = mainBytes(artifacts);
  const start = mainRange(artifacts).start;
  const decoded: { pc: number; opcode: number; bytes: Buffer }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const width = WIDTHS.get(opcode);
    if (width === undefined || offset + width > bytes.length)
      throw new Error(
        `Expected a complete official NMOS instruction at $${(start + offset).toString(16)}`,
      );
    decoded.push({ pc: start + offset, opcode, bytes: bytes.subarray(offset, offset + width) });
    offset += width;
  }
  return decoded;
}

/** Reconcile complete shipped bytes and resource dimensions against final physical evidence. */
function accounting(artifacts: Artifacts) {
  const packageRecord = profileRecord(artifacts.build.package);
  expect(packageRecord.kind).toBe("prg");
  expect(packageRecord.loadAddress).toBe(artifacts.prg.readUInt16LE(0));
  expect(packageRecord.endAddress).toBe(
    integer(packageRecord.loadAddress) + artifacts.prg.length - 2,
  );
  const totals = profileRecord(artifacts.costs.totals);
  const entries = profileRecords(artifacts.costs.entries);
  const byteEntries = entries.filter((entry) => entry.kind === "bytes");
  const sum = (dimension: string) =>
    byteEntries
      .filter((entry) => entry.accounting === dimension)
      .reduce((total, entry) => total + integer(entry.bytes), 0);
  expect(totals.programBytes).toBe(artifacts.prg.length - 2);
  expect(sum("program")).toBe(totals.programBytes);
  const intervals = profileRecords(artifacts.memory.intervals);
  for (const interval of intervals) {
    expect(integer(interval.end) - integer(interval.start)).toBe(interval.size);
    expect(
      integer(interval.payloadBytes) +
        integer(interval.paddingBytes) +
        integer(interval.reservedBytes),
    ).toBe(interval.size);
  }
  const resources = profileRecords(totals.resources);
  const value = (id: string) => {
    const resource = resources.find((entry) => entry.kind === "standard" && entry.id === id);
    if (resource === undefined) throw new Error(`Missing complete ${id} accounting`);
    return integer(resource.value);
  };
  // Final resources reconcile with physical memory; cost entries need not repeat every dimension.
  const views = profileRecords(artifacts.memory.views).filter((view) => view.consumer === "cpu");
  expect(
    views.length,
    "The selected unbanked machine must publish its CPU memory view",
  ).toBeGreaterThan(0);
  expect(value("residentRam")).toBe(Math.max(...views.map((view) => integer(view.occupiedBytes))));
  expect(value("zeroPage")).toBe(Math.max(...views.map((view) => integer(view.zeroPageBytes))));
  const physical = (kind: string) =>
    Math.max(
      ...views.map((view) => {
        if (!Array.isArray(view.activeResidencyIds))
          throw new Error("CPU residency IDs are required");
        const active = view.activeResidencyIds;
        return intervals
          .filter((interval) => {
            if (!Array.isArray(interval.residencyIds))
              throw new Error("Physical residency IDs are required");
            return (
              interval.kind === kind &&
              interval.addressSpaceId === view.addressSpaceId &&
              interval.residencyIds.some((id) => active.includes(id))
            );
          })
          .reduce((total, interval) => total + integer(interval.size), 0);
      }),
    );
  expect(value("scratch")).toBe(physical("scratch"));
  const domains = profileRecords(artifacts.memory.stackDomains);
  for (const domain of domains)
    expect(integer(domain.peakBytes) + integer(domain.headroomBytes)).toBe(domain.capacityBytes);
  expect(value("hardwareStack")).toBe(
    Math.max(0, ...domains.map((domain) => integer(domain.peakBytes))),
  );
  expect(artifacts.costs.mode).toBe("none");
  expect(artifacts.costs.decisions).toEqual([]);
  return { totals, resources, byteEntries, sfa: physical("sfa") };
}

/**
 * Charge the small forward-only fixture paths using official NMOS instruction timings.
 * This follows control-flow edges, not CPU values. Unknown opcodes, loops and broken targets
 * fail rather than becoming free. An outside-main jump charges its three cycles; shared
 * startup/restoration is outside this comparison and remains in complete artifact accounting.
 */
function mainCycleBounds(artifacts: Artifacts): readonly [number, number] {
  const decoded = instructions(artifacts);
  const byPc = new Map(decoded.map((instruction) => [instruction.pc, instruction]));
  const { start, end } = mainRange(artifacts);
  const fixed = new Map([
    [0x29, 2],
    [0x49, 2],
    [0x69, 2],
    [0xa2, 2],
    [0xa9, 2],
    [0xc9, 2],
    [0xe8, 2],
    [0xad, 4],
    [0x8d, 4],
    [0x8e, 4],
  ]);
  const visit = (pc: number): readonly [number, number] => {
    const instruction = byPc.get(pc);
    if (instruction === undefined) throw new Error("Cycle path must land on an instruction");
    const { opcode, bytes } = instruction;
    const next = pc + bytes.length;
    if (opcode === 0x4c) {
      const target = bytes.readUInt16LE(1);
      if (target < start || target >= end) return [3, 3];
      if (target <= pc) throw new Error("Cycle fixture must have no back edge");
      const following = visit(target);
      return [3 + following[0], 3 + following[1]];
    }
    if (opcode === 0xd0 || opcode === 0xf0) {
      const target = (next + (bytes[1]! < 128 ? bytes[1]! : bytes[1]! - 256)) & 65535;
      if (target <= pc) throw new Error("Cycle fixture must have no back edge");
      const fallthrough = visit(next);
      const taken = visit(target);
      const takenCost = 3 + (next >> 8 === target >> 8 ? 0 : 1);
      return [
        Math.min(2 + fallthrough[0], takenCost + taken[0]),
        Math.max(2 + fallthrough[1], takenCost + taken[1]),
      ];
    }
    const cycles = fixed.get(opcode);
    if (cycles === undefined) throw new Error(`Unaccounted fixture opcode $${opcode.toString(16)}`);
    const following = visit(next);
    return [cycles + following[0], cycles + following[1]];
  };
  return visit(start);
}

/** Enforce direct-operation timing independently of optional public cycle-report ownership. */
function mainCycleCeiling(artifacts: Artifacts, maximum: number) {
  expect(mainCycleBounds(artifacts)[1]).toBeLessThanOrEqual(maximum);
}

/** Keep independently chosen expert targets visible without treating canonical output as optimized. */
function recordExpertComparison(
  artifacts: Artifacts,
  profile: Profile,
  scenario: string,
  expert: { readonly bytes: number; readonly maximumCycles: number; readonly sfa: number },
) {
  const actual = {
    bytes: mainBytes(artifacts).length,
    cycles: mainCycleBounds(artifacts),
    sfa: accounting(artifacts).sfa,
  };
  console.info("Joystick expert comparison", JSON.stringify({ profile, scenario, actual, expert }));
}

/** Run one real compiled program between source-placed checkpoints using the existing VICE fixture. */
async function observe(
  program: string,
  profile: Profile,
  inspect: (monitor: ViceMonitor, resume: () => Promise<void>) => Promise<void>,
) {
  await withProfileProject(program, profile, async (project) => {
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built)).toBe("success");
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const artifacts = { ...(await readProfileArtifacts(built)), source: program };
    accounting(artifacts);
    const vice = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      100_000_000,
      profile,
    );
    if ("kind" in vice) throw new Error(`Runtime setup unavailable: ${vice.reason}`);
    try {
      // Stop after the fixture's explicit SEI so KERNAL scanning cannot enter the observation.
      expect([...machineBytes(artifacts, 0x2000, 0x2001)]).toEqual([0x78]);
      const entry = await vice.monitor.setExecuteCheckpoint(0x2001);
      await vice.monitor.setExecuteCheckpoint(0x3000);
      const stopped = vice.monitor.waitForStop();
      await vice.monitor.resume();
      expect(await stopped).toBe(0x2001);
      await vice.monitor.deleteCheckpoint(entry);
      await inspect(vice.monitor, async () => {
        const finished = vice.monitor.waitForStop();
        await vice.monitor.resume();
        expect(await finished).toBe(0x3000);
      });
    } finally {
      await stopVice(vice);
    }
  });
}

describe.each(PROFILES)("joystick public API and assembled output on %s", (profile) => {
  it("should bind both unsigned byte reads and all five pure boolean predicates", async () => {
    const names = [...PORTS, ...PREDICATES].map((operation) => operation.name);
    const analyzed = await analyzeProfileSource(
      source(
        names,
        "let first: byte = readJoystick1(); let second: byte = readJoystick2(); " +
          PREDICATES.map(({ name }) => `let ${name}Result: boolean = ${name}(first);`).join(" "),
      ),
      profile,
    );
    expect(analyzed.kind).toBe("complete");
    if (analyzed.kind !== "complete") throw new Error(JSON.stringify(analyzed.diagnostics));
    for (const operation of [...PORTS, ...PREDICATES]) {
      const read = operation.name.startsWith("read");
      const binding = analyzed.program.bindings.find(
        (candidate) => candidate.qualifiedName === `c64.input.${operation.name}`,
      );
      expect(binding?.storage).toBe("function");
      const capability = analyzed.program.profile?.capabilities.find(
        (candidate) => candidate.name === `c64.input.${operation.name}`,
      );
      if (binding === undefined)
        throw new Error("An accepted operation must have a resolved binding");
      expect(capability?.parameters).toEqual(read ? [] : [{ kind: "scalar", name: "byte" }]);
      expect(capability?.returnType).toEqual({ kind: "scalar", name: read ? "byte" : "boolean" });
      expect(binding?.type).toEqual({ kind: "scalar", name: read ? "byte" : "boolean" });
      expect(binding.operationEffect).toBe(read ? "volatile-read" : "pure");
    }
  });

  for (const { name } of PORTS) {
    it(`should reject an extra argument to ${name} as wrong arity`, async () => {
      const analyzed = await analyzeProfileSource(source([name], `${name}(0);`), profile);
      expect(analyzed.kind).toBe("error");
      expect(
        analyzed.diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.code),
      ).toEqual(["E10171"]);
      expect(
        analyzed.diagnostics.find((diagnostic) => diagnostic.code === "E10171")?.message,
      ).toContain("expects 0 parameters, got 1");
    });
  }
  for (const { name } of PREDICATES) {
    it(`should reject a missing argument to ${name} as wrong arity`, async () => {
      const analyzed = await analyzeProfileSource(source([name], `${name}();`), profile);
      expect(analyzed.kind).toBe("error");
      expect(
        analyzed.diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.code),
      ).toEqual(["E10171"]);
      expect(
        analyzed.diagnostics.find((diagnostic) => diagnostic.code === "E10171")?.message,
      ).toContain("expects 1 parameters, got 0");
    });
    it(`should reject a boolean argument to ${name} as a type mismatch`, async () => {
      const analyzed = await analyzeProfileSource(source([name], `${name}(true);`), profile);
      expect(analyzed.kind).toBe("error");
      expect(
        analyzed.diagnostics
          .filter((diagnostic) => diagnostic.severity === "error")
          .map((diagnostic) => diagnostic.code),
      ).toEqual(["E10172"]);
      expect(
        analyzed.diagnostics.find((diagnostic) => diagnostic.code === "E10172")?.message,
      ).toContain("expects 'byte', found 'boolean'");
    });
  }
  it("should reject an unknown input export without unresolved-name fallback", async () => {
    const analyzed = await analyzeProfileSource(
      source(["joystickDiagonal"], "joystickDiagonal(0);"),
      profile,
    );
    expect(analyzed.kind).toBe("error");
    expect(
      analyzed.diagnostics
        .filter((diagnostic) => diagnostic.severity === "error")
        .map((diagnostic) => diagnostic.code),
    ).toEqual(["E10012"]);
    expect(analyzed.diagnostics.find((diagnostic) => diagnostic.code === "E10012")?.message).toBe(
      "'joystickDiagonal' is not exported from module 'c64.input'",
    );
  });

  it("should execute every saved-byte predicate across all low and upper-bit combinations", async () => {
    // RAM supplies the complete saved-byte domain; separate port probes establish physical reads.
    const assignments = PREDICATES.map(
      ({ name }, index) => `
      flags[i * 5 + ${index}] = ${name}(sample);
      if (${name}(sample)) { branches[i * 10 + ${index * 2}] = 1; }
      else { branches[i * 10 + ${index * 2}] = 0; }
      if (!${name}(sample)) { branches[i * 10 + ${index * 2 + 1}] = 1; }
      else { branches[i * 10 + ${index * 2 + 1}] = 0; }`,
    ).join(" ");
    const program = source(
      PREDICATES.map(({ name }) => name),
      `asm_sei(); for (let i: word = 0; i < 256; i += 1) {
        let sample: byte = peek($c000 + i); sampled[i] = sample; ${assignments}
      } complete();`,
      "place(at: $4000) let sampled: byte[256]; place(at: $4100) let flags: boolean[1280]; " +
        "place(at: $4600) let branches: byte[2560]; " +
        "place(at: $3000) function complete(): void { asm_nop(); }",
      "place(at: $2000) ",
    );
    await observe(program, profile, async (monitor, resume) => {
      const inputs = Uint8Array.from({ length: 256 }, (_, index) => index);
      const expected = [...inputs].flatMap((sample) =>
        PREDICATES.map(({ mask }) => ((sample & mask) === 0 ? 1 : 0)),
      );
      const expectedBranches = [...inputs].flatMap((sample) =>
        PREDICATES.flatMap(({ mask }) => ((sample & mask) === 0 ? [1, 0] : [0, 1])),
      );
      await monitor.writeMemory(0xc000, inputs);
      await monitor.writeMemory(0x4000, new Uint8Array(4096).fill(0xa5));
      await resume();
      expect([...(await monitor.readMemory(0x4000, 0x40ff))]).toEqual([...inputs]);
      expect([...(await monitor.readMemory(0x4100, 0x45ff))]).toEqual(expected);
      expect([...(await monitor.readMemory(0x4600, 0x4fff))]).toEqual(expectedBranches);
    });
  }, 60_000);

  for (const gate of [0, 255]) {
    it(`should preserve read order, saved snapshots and short-circuit paths for saved gate ${gate}`, async () => {
      const program = source(
        [...PORTS, ...PREDICATES].map(({ name }) => name),
        `asm_sei(); readJoystick1(); readJoystick2(); readJoystick2(); readJoystick1();
         readJoystick1(); readJoystick1(); readJoystick1();
         let saved: byte = readJoystick1(); let later: byte = readJoystick2();
         poke($c100, saved); poke($c101, later);
         ${PREDICATES.map(
           ({ name }, index) =>
             `if (${name}(saved)) { poke($${(0xc106 + index).toString(16)}, 1); }
            else { poke($${(0xc106 + index).toString(16)}, 0); }`,
         ).join(" ")}
         let gate: byte = peek($c000);
         if (joystickUp(gate) && joystickFire(readJoystick1())) { poke($c102, 1); }
         if (joystickUp(gate) || joystickFire(readJoystick2())) { poke($c103, 1); }
         if (!joystickUp(gate) && joystickFire(readJoystick2())) { poke($c104, 1); }
         if (!joystickUp(gate) || joystickFire(readJoystick1())) { poke($c105, 1); }
         complete();`,
        "place(at: $3000) function complete(): void { asm_nop(); }",
        "place(at: $2000) ",
      );
      await observe(program, profile, async (monitor, resume) => {
        await monitor.writeMemory(0xc000, new Uint8Array([gate]));
        await monitor.writeMemory(0xc100, new Uint8Array(11));
        const pins = await monitor.readIo(0xdc00, 0xdc01);
        const traces = new Map<number, string>();
        for (let address = 0xdc00; address <= 0xdd0f; address += 1) {
          if (address > 0xdc0f && address < 0xdd00) continue;
          for (const access of ["load", "store"] as const)
            traces.set(await monitor.setAccessTracepoint(address, access), `${access}:${address}`);
        }
        monitor.takeCheckpointHits();
        await resume();
        const observed = monitor
          .takeCheckpointHits()
          .flatMap((id) => (traces.has(id) ? [traces.get(id)!] : []));
        const order = [
          0xdc01,
          0xdc00,
          0xdc00,
          0xdc01,
          0xdc01,
          0xdc01,
          0xdc01,
          0xdc01,
          0xdc00,
          ...(gate === 0 ? [0xdc01, 0xdc01] : [0xdc00, 0xdc00]),
        ];
        expect(observed).toEqual(order.map((address) => `load:${address}`));
        const asserted = gate === 0;
        const fire1 = (pins[1]! & 16) === 0;
        const fire2 = (pins[0]! & 16) === 0;
        expect([...(await monitor.readMemory(0xc106, 0xc10a))]).toEqual(
          PREDICATES.map(({ mask }) => Number((pins[1]! & mask) === 0)),
        );
        expect([...(await monitor.readMemory(0xc100, 0xc105))]).toEqual([
          pins[1],
          pins[0],
          Number(asserted && fire1),
          Number(asserted || fire2),
          Number(!asserted && fire2),
          Number(!asserted || fire1),
        ]);
      });
    }, 60_000);
  }

  for (const { name, address } of PORTS) {
    for (const use of ["discarded", "stored", "retained"] as const) {
      it(`should preserve a ${use} ${name} sample and account for its bytes and resources`, async () => {
        const empty = await buildProfileSource(source([], ""), profile);
        const body =
          use === "discarded"
            ? `${name}();`
            : use === "stored"
              ? `poke($0400, ${name}());`
              : `let sample: byte = ${name}(); poke($0400, sample); poke($0401, sample);`;
        const artifacts = await buildProfileSource(source([name], body), profile);
        const expected = [
          0xad,
          address & 255,
          address >> 8,
          ...(use === "discarded" ? [] : [0x8d, 0x00, 0x04]),
          ...(use === "retained" ? [0x8d, 0x01, 0x04] : []),
        ];
        const decoded = instructions(artifacts);
        if (use !== "retained")
          expect([...mainBytes(artifacts).subarray(0, expected.length)]).toEqual(expected);
        else {
          expect(decoded[0]?.bytes).toEqual(Buffer.from(expected.slice(0, 3)));
          expect(
            decoded
              .filter(
                ({ opcode, bytes }) =>
                  opcode === 0x8d && [0x0400, 0x0401].includes(bytes.readUInt16LE(1)),
              )
              .map(({ bytes }) => bytes.readUInt16LE(1)),
          ).toEqual([0x0400, 0x0401]);
        }
        expect(
          decoded.filter(
            ({ opcode, bytes }) => opcode === 0xad && bytes.readUInt16LE(1) === address,
          ),
        ).toHaveLength(1);
        expect(
          decoded.filter(({ opcode }) => [0x20, 0xaa, 0x8a, 0x78, 0x58].includes(opcode)),
        ).toEqual([]);
        const actual = accounting(artifacts);
        const baseline = accounting(empty);
        if (use !== "retained")
          expect(integer(actual.totals.programBytes) - integer(baseline.totals.programBytes)).toBe(
            expected.length,
          );
        expect(actual.resources.filter((entry) => entry.id !== "residentRam")).toEqual(
          baseline.resources.filter((entry) => entry.id !== "residentRam"),
        );
        if (use !== "retained") {
          expect(actual.sfa).toBe(baseline.sfa);
          // The operation body is followed by the common three-cycle restoration transfer.
          mainCycleCeiling(artifacts, (use === "discarded" ? 4 : 8) + 3);
        } else {
          // LDA/STA/STA costs 9 bytes and 12 cycles, plus the common JMP's 3 bytes/3 cycles.
          recordExpertComparison(artifacts, profile, `retained ${name}`, {
            bytes: 12,
            maximumCycles: 15,
            sfa: 0,
          });
        }
      });
    }
  }

  for (const { name, mask } of PREDICATES) {
    for (const inverted of [false, true]) {
      for (const placement of [0x2000, 0x20f4]) {
        it(`should select the ${inverted ? "negated " : ""}${name} mask at $${placement.toString(16)} and account for its branch paths`, async () => {
          const program = source(
            [name],
            `let sample: byte = peek($c000);
            if (${inverted ? "!" : ""}${name}(sample)) { poke($0400, 1); }`,
            "",
            `place(at: $${placement.toString(16)}) `,
          );
          const artifacts = await buildProfileSource(program, profile);
          const decoded = instructions(artifacts);
          const maskInstruction = decoded.find(
            ({ opcode, bytes }) => opcode === 0x29 && bytes[1] === mask,
          );
          expect(maskInstruction?.bytes).toEqual(Buffer.from([0x29, mask]));
          const branches = decoded.filter(({ opcode }) => opcode === 0xd0 || opcode === 0xf0);
          expect(branches).toHaveLength(1);
          const branch = branches[0]!;
          const displacement = branch.bytes[1]! < 128 ? branch.bytes[1]! : branch.bytes[1]! - 256;
          const nextPc = branch.pc + 2;
          const target = (nextPc + displacement) & 65535;
          const pageCycle = nextPc >> 8 === target >> 8 ? 0 : 1;
          expect(decoded.some(({ pc }) => pc === target)).toBe(true);
          expect(decoded.filter(({ opcode }) => opcode === 0x20)).toEqual([]);
          // LDA/AND/branch/LDA/STA/JMP is 15 bytes; the body-taking path costs 17 cycles.
          // Zero SFA also excludes Boolean homes. Canonical storage/layout is measured, not blessed.
          recordExpertComparison(
            artifacts,
            profile,
            `${inverted ? "negated " : ""}${name} at $${placement.toString(16)}, taken-page penalty ${pageCycle}`,
            { bytes: 15, maximumCycles: 17, sfa: 0 },
          );
        });
      }
    }
    it(`should materialize an escaping ${name} result as canonical zero or one without a helper`, async () => {
      const artifacts = await buildProfileSource(
        source(
          [name],
          `let sample: byte = peek($c000); result = ${name}(sample);`,
          "place(at: $c100) let result: boolean;",
        ),
        profile,
      );
      const decoded = instructions(artifacts);
      expect(decoded.some(({ opcode, bytes }) => opcode === 0x29 && bytes[1] === mask)).toBe(true);
      expect(decoded.filter(({ opcode }) => opcode === 0x20)).toEqual([]);
      // LDX #0/LDA/AND/branch/INX/STX/JMP is 16 bytes and at most 19 nominal cycles.
      // Its equal-contract reference includes restoration transfer, not an ordinary RTS.
      recordExpertComparison(artifacts, profile, `escaping ${name}`, {
        bytes: 16,
        maximumCycles: 19,
        sfa: 0,
      });
    });
  }

  it("should retain no library payload, storage or startup for unused mask imports", async () => {
    const plain = await buildProfileSource(source([], ""), profile);
    const imported = await buildProfileSource(
      source(
        MASKS.map(({ name }) => `${name}Mask`),
        "",
      ),
      profile,
    );
    expect(imported.prg).toEqual(plain.prg);
    expect(accounting(imported).totals).toEqual(accounting(plain).totals);
    expect(accounting(imported).sfa).toBe(accounting(plain).sfa);
  });
  for (const { name, mask } of MASKS) {
    it(`should fold ordinary ${name}Mask as an immediate with no runtime library or data`, async () => {
      const named = await buildProfileSource(
        source([`${name}Mask`], `poke($0400, ${name}Mask);`),
        profile,
      );
      const literal = await buildProfileSource(source([], `poke($0400, ${mask});`), profile);
      expect([...mainBytes(named).subarray(0, 5)]).toEqual([0xa9, mask, 0x8d, 0x00, 0x04]);
      expect(named.prg).toEqual(literal.prg);
      expect(accounting(named).totals).toEqual(accounting(literal).totals);
      expect(accounting(named).sfa).toBe(accounting(literal).sfa);
    });
  }
});
