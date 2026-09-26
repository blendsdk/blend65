import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceCpuRegisters, ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Runtime observations, separate from the source-derived expectations and entry-frame evidence. */
interface Observation {
  value: number[];
  combined: number;
  effects: string[];
  effectBytes: number[];
  alias: number[];
  bcd: number;
  status: number;
  operands: number[];
  protectedStore: number;
  stops: number[];
  irq: { pc: number; cpu: ViceCpuRegisters; marker: number; vector: number[] };
}

/** Expected interrupt state comes from the CPU/KERNAL entry frame before generated PHP executes. */
interface InterruptExpectation {
  pc: number;
  cpu: ViceCpuRegisters;
  vector: number[];
}

/** Check actual IRQ return state, including live P bits but excluding represented B/unused bits. */
function assertInterruptReturn(actual: Observation["irq"], expected: InterruptExpectation): void {
  expect(actual.pc, "IRQ resumes the stacked PC without a JSR-style increment").toBe(expected.pc);
  for (const register of ["a", "x", "y", "sp"] as const) {
    expect(actual.cpu[register], `IRQ restores ${register}`).toBe(expected.cpu[register]);
  }
  expect(actual.cpu.p & 0xcf, "IRQ restores all live status bits").toBe(expected.cpu.p & 0xcf);
  expect(actual.marker, "The installed handler actually ran").toBe(1);
  expect(actual.vector, "Normal mainline restoration returns CINV ownership").toEqual(
    expected.vector,
  );
}

/** Independent source and CPU expectations shared by real execution and every mutation control. */
function assertBehavior(
  actual: Observation,
  interrupted: InterruptExpectation,
  safetyStop: number,
): void {
  expect(actual.value, "Byte addition wraps before widening to word").toEqual([4, 0]);
  expect(actual.combined, "Both argument values survive left-to-right calls").toBe(12);
  expect(actual.effects, "Each argument and checked operand effect occurs once in order").toEqual([
    "left",
    "right",
    "numerator",
    "divisor",
  ]);
  expect(actual.effectBytes).toEqual([17, 34]);
  expect(actual.alias, "Self-aliased aggregate return preserves the original pair").toEqual([9, 5]);
  expect(actual.bcd, "Decimal 99 plus one wraps to zero").toBe(0);
  expect(actual.status & 0x0c, "The stable safety stop has I set and D clear").toBe(0x04);
  expect(actual.operands, "Both checked operands execute before the stop").toEqual([1, 1]);
  expect(actual.protectedStore, "The protected result store never executes").toBe(0xa5);
  expect(actual.stops, "The safety stop remains in its bounded observable loop").toEqual([
    safetyStop,
    safetyStop + 1,
    safetyStop,
  ]);
  assertInterruptReturn(actual.irq, interrupted);
}

const controlInterrupt: InterruptExpectation = {
  pc: 0x1234,
  cpu: { a: 0x42, x: 0x17, y: 0x33, p: 0x89, sp: 0xfd },
  vector: [0x31, 0xea],
};
const controlStop = 0x2000;

/** Fresh synthetic good evidence isolates assertion sensitivity without another compiler path. */
function goodObservation(): Observation {
  return {
    value: [4, 0],
    combined: 12,
    effects: ["left", "right", "numerator", "divisor"],
    effectBytes: [17, 34],
    alias: [9, 5],
    bcd: 0,
    status: 0x04,
    operands: [1, 1],
    protectedStore: 0xa5,
    stops: [controlStop, controlStop + 1, controlStop],
    irq: {
      pc: controlInterrupt.pc,
      cpu: { ...controlInterrupt.cpu },
      marker: 1,
      vector: [0x31, 0xea],
    },
  };
}

/** Reject malformed public JSON before resolving function-entry discovery metadata. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected a public evidence record");
  }
  return value as Record<string, unknown>;
}

/** Narrow a public sidecar collection without treating unchecked JSON as typed evidence. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected public evidence records");
  return value.map(record);
}

/** Decode CINV's Y/X/A/P/PCL/PCH frame; the interrupt PC is already the exact resume address. */
async function interruptedState(
  monitor: ViceMonitor,
  vector: number[],
): Promise<InterruptExpectation> {
  const { sp } = await monitor.readCpuRegisters();
  const frame: number[] = [];
  for (let offset = 1; offset <= 6; offset += 1) {
    const address = 0x0100 + ((sp + offset) & 0xff);
    frame.push((await monitor.readMemory(address, address))[0]!);
  }
  return {
    pc: frame[4]! | (frame[5]! << 8),
    cpu: { a: frame[2]!, x: frame[1]!, y: frame[0]!, p: frame[3]!, sp: (sp + 6) & 0xff },
    vector,
  };
}

/** One bounded program makes every mutated observation part of an actual runtime contract. */
const source = [
  "module Game; import { setIRQ, restoreIRQ } from c64.system;",
  "const INPUT: word = $0440; const BCD_INPUT: word = $0441; const DIVISOR: word = $0442;",
  "const RESULT: word = $0450; const COMBINED: word = $0452; const ALIAS: word = $0453; const BCD_RESULT: word = $0455;",
  "const LEFT: word = $0460; const RIGHT: word = $0461; const NUM_COUNT: word = $0462; const DIV_COUNT: word = $0463;",
  "const PROTECTED: word = $0464; const IRQ_MARKER: word = $0465;",
  "struct Pair { first: byte; second: byte; }",
  "let pair: Pair = { first: 5, second: 9 };",
  "function left(): byte { poke(LEFT, 17); return 1; }",
  "function right(): byte { poke(RIGHT, 34); return 2; }",
  "function combine(a: byte, b: byte): byte { return a * 10 + b; }",
  "function swapped(value: Pair): Pair { return { first: value.second, second: value.first }; }",
  "function numerator(): byte { poke(NUM_COUNT, peek(NUM_COUNT) + 1); return 17; }",
  "function divisor(): byte { poke(DIV_COUNT, peek(DIV_COUNT) + 1); return peek(DIVISOR); }",
  "interrupt function onIRQ(): void { poke(IRQ_MARKER, 1); }",
  "function main(): void {",
  "  asm_sei(); asm_nop();",
  "  let wrapped: word = peek(INPUT) + byte(10); pokew(RESULT, wrapped);",
  "  poke(COMBINED, combine(left(), right()));",
  "  pair = swapped(pair); poke(ALIAS, pair.first); poke(ALIAS + 1, pair.second);",
  "  poke(BCD_RESULT, bcd_add(peek(BCD_INPUT), byte(1)));",
  "  setIRQ(&onIRQ); asm_cli(); asm_nop();",
  "  for (let spin: word = 0; spin < 50000; spin += 1) { if (peek(IRQ_MARKER) != 0) { break; } }",
  "  asm_sei(); asm_nop(); restoreIRQ();",
  "  let quotient: byte = numerator() / divisor(); poke(PROTECTED, quotient);",
  "}",
].join("\n");

describe.sequential("independent runtime oracle integrity", () => {
  it("accepts complete good observations", () => {
    expect(() => assertBehavior(goodObservation(), controlInterrupt, controlStop)).not.toThrow();
  });

  // B and the unused status representation bit are not live flags restored by RTI.
  it("accepts differing non-live interrupt status representation bits", () => {
    const observed = goodObservation();
    observed.irq.cpu = { ...observed.irq.cpu, p: observed.irq.cpu.p ^ 0x30 };
    expect(() => assertBehavior(observed, controlInterrupt, controlStop)).not.toThrow();
  });

  const mutations: [string, (observation: Observation) => void][] = [
    [
      "wrong scalar value",
      (o) => {
        o.value[0] = 5;
      },
    ],
    [
      "wrong argument value",
      (o) => {
        o.combined = 21;
      },
    ],
    [
      "reordered effects",
      (o) => {
        [o.effects[0], o.effects[1]] = [o.effects[1]!, o.effects[0]!];
      },
    ],
    [
      "duplicated effect",
      (o) => {
        o.effects.push("left");
      },
    ],
    [
      "wrong effect byte",
      (o) => {
        o.effectBytes[0] = 18;
      },
    ],
    [
      "corrupted alias result",
      (o) => {
        o.alias[1] = 9;
      },
    ],
    [
      "wrong decimal result",
      (o) => {
        o.bcd = 0x9a;
      },
    ],
    [
      "decimal mode left enabled",
      (o) => {
        o.status |= 0x08;
      },
    ],
    [
      "interrupt mask absent at the stop",
      (o) => {
        o.status &= ~0x04;
      },
    ],
    [
      "stop before numerator effects",
      (o) => {
        o.operands[0] = 0;
      },
    ],
    [
      "stop before divisor effects",
      (o) => {
        o.operands[1] = 0;
      },
    ],
    [
      "store after a failing check",
      (o) => {
        o.protectedStore = 0;
      },
    ],
    [
      "escape from the safety loop",
      (o) => {
        o.stops[2] = controlStop + 4;
      },
    ],
    [
      "incremented IRQ resume PC",
      (o) => {
        o.irq.pc += 1;
      },
    ],
    [
      "missing IRQ body",
      (o) => {
        o.irq.marker = 0;
      },
    ],
    [
      "unrestored IRQ vector",
      (o) => {
        o.irq.vector[0] = o.irq.vector[0]! ^ 1;
      },
    ],
    ...(["a", "x", "y", "sp"] as const).map((register): [string, (o: Observation) => void] => [
      `wrong IRQ ${register}`,
      (o) => {
        o.irq.cpu = { ...o.irq.cpu, [register]: o.irq.cpu[register] ^ 1 };
      },
    ]),
    ...[0x80, 0x40, 0x08, 0x04, 0x02, 0x01].map((bit): [string, (o: Observation) => void] => [
      `wrong IRQ live status bit ${bit}`,
      (o) => {
        o.irq.cpu = { ...o.irq.cpu, p: o.irq.cpu.p ^ bit };
      },
    ]),
  ];

  // Each clone changes one observation only; assembly and other compiler paths are never inputs.
  it.each(mutations)("rejects %s even without an assembly difference", (_name, mutate) => {
    const observed = structuredClone(goodObservation());
    mutate(observed);
    expect(() => assertBehavior(observed, controlInterrupt, controlStop)).toThrow();
  });

  it("uses the same assertions on a real checked program and its CINV return", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-oracle-integrity-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(join(root, "src/game.blend"), source);
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "oracle-integrity",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
          divisionZeroCheck: true,
        }),
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected an executable oracle fixture");
      const directory = built.generation.directory;
      const labels = await readFile(join(directory, ".labels"), "utf8");
      const addresses = new Map(
        [...labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
          match[1]!,
          Number.parseInt(match[2]!, 16),
        ]),
      );
      const startup = [...addresses].filter(([label]) =>
        label.endsWith(`_${Buffer.from("startup.entry").toString("hex")}`),
      );
      expect(startup).toHaveLength(1);
      const debug = record(JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")));
      const handler = records(debug.functions).find(
        (fn) => fn.qualifiedName === "src/game.blend::Game.onIRQ",
      );
      const variants = records(handler?.entryVariants);
      expect(variants).toHaveLength(1);
      const handlerLabel = variants[0]?.label;
      if (typeof handlerLabel !== "string") throw new Error("Missing public IRQ entry label");
      const irqEntry = addresses.get(handlerLabel);
      if (irqEntry === undefined) throw new Error("Missing assembled IRQ entry address");
      // Public labels and assembled bytes locate the specified stop; they supply no expected values.
      const prg = await readFile(join(directory, built.generation.primaryArtifact));
      const origin = prg.readUInt16LE(0);
      const safetyStops = [...new Set(addresses.values())].filter((address) => {
        const offset = address - origin + 2;
        return (
          offset >= 2 &&
          prg[offset] === 0x78 &&
          prg[offset + 1] === 0x4c &&
          prg[offset + 2] === (address & 0xff) &&
          prg[offset + 3] === address >> 8
        );
      });
      expect(safetyStops).toHaveLength(1);
      const safetyStop = safetyStops[0]!;
      const started = await startVice(join(directory, built.generation.primaryArtifact));
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const { monitor } = started;
      const checkpoints = new Set<number>();
      /** Register ownership immediately so every successful creation is cleaned up on failure. */
      const checkpoint = async (address: number): Promise<number> => {
        const id = await monitor.setExecuteCheckpoint(address);
        checkpoints.add(id);
        return id;
      };
      const remove = async (id: number): Promise<void> => {
        await monitor.deleteCheckpoint(id);
        checkpoints.delete(id);
      };
      /** Arm the stop listener before resuming so even an immediate checkpoint cannot be missed. */
      const resume = async (): Promise<number> => {
        const stopped = monitor.waitForStop(20_000);
        await monitor.resume();
        return stopped;
      };
      try {
        const entry = startup[0]![1];
        const entryCheckpoint = await checkpoint(entry);
        expect(await resume()).toBe(entry);
        await remove(entryCheckpoint);
        const originalVector = [...(await monitor.readMemory(0x0314, 0x0315))];
        const seed = new Uint8Array(0x26);
        seed[0] = 250;
        seed[1] = 0x99;
        seed[0x24] = 0xa5;
        await monitor.writeMemory(0x0440, seed);
        const effectCheckpoints = new Map<number, string>();
        for (const [index, name] of ["left", "right", "numerator", "divisor"].entries()) {
          const id = await monitor.setAccessTracepoint(0x0460 + index, "store");
          checkpoints.add(id);
          effectCheckpoints.set(id, name);
        }
        const irqCheckpoint = await checkpoint(irqEntry);
        await checkpoint(safetyStop);
        await checkpoint(safetyStop + 1);
        monitor.takeCheckpointHits();
        expect(await resume()).toBe(irqEntry);
        const interrupted = await interruptedState(monitor, originalVector);
        await remove(irqCheckpoint);
        const returnCheckpoint = await checkpoint(interrupted.pc);
        const resumedPc = await resume();
        const returnedCpu = await monitor.readCpuRegisters();
        expect(resumedPc).toBe(interrupted.pc);
        await remove(returnCheckpoint);
        const stops = [await resume(), await resume(), await resume()];
        const status = (await monitor.readCpuRegisters()).p;
        const output = [...(await monitor.readMemory(0x0450, 0x0455))];
        const effectBytes = [...(await monitor.readMemory(0x0460, 0x0465))];
        const effects = monitor.takeCheckpointHits().flatMap((id) => {
          const name = effectCheckpoints.get(id);
          return name === undefined ? [] : [name];
        });
        assertBehavior(
          {
            value: output.slice(0, 2),
            combined: output[2]!,
            alias: output.slice(3, 5),
            bcd: output[5]!,
            effects,
            effectBytes: effectBytes.slice(0, 2),
            operands: effectBytes.slice(2, 4),
            protectedStore: effectBytes[4]!,
            status,
            stops,
            irq: {
              pc: resumedPc,
              cpu: returnedCpu,
              marker: effectBytes[5]!,
              vector: [...(await monitor.readMemory(0x0314, 0x0315))],
            },
          },
          interrupted,
          safetyStop,
        );
      } finally {
        try {
          const cleanup = await Promise.allSettled(
            [...checkpoints].map((id) => monitor.deleteCheckpoint(id)),
          );
          const failed = cleanup.find((result) => result.status === "rejected");
          if (failed?.status === "rejected") throw failed.reason;
        } finally {
          await stopVice({ child: started.child, monitor });
        }
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 90_000);
});
