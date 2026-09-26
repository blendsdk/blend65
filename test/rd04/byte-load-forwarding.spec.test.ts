import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build only through the public service and keep the isolated generation alive for inspection. */
async function withBuild(
  source: string,
  inspect: (result: BuildSuccess) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "blend65-byte-load-forwarding-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "byte-load-forwarding",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const result = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "none",
    });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") throw new Error("Expected a resident-read build");
    await inspect(result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Validate public JSON records without trusting compiler-private types. */
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

/** Require each element of a public evidence collection to be an object. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected evidence records");
  return value.map(record);
}

/** Byte addresses and counts must be actual nonnegative safe integers. */
function bytes(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected a byte address or count");
  }
  return value;
}

/** Locate one existing public startup boundary, without using its instructions as a behavior oracle. */
function startupAddress(labels: string, suffix: string): number {
  const encoded = `b65_[A-Za-z0-9_]+_${Buffer.from(suffix).toString("hex")}`;
  const matches = [
    ...labels.matchAll(new RegExp(`^\\s*${encoded}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
  ];
  expect(matches, suffix).toHaveLength(1);
  return Number.parseInt(matches[0]![1]!, 16);
}

describe.sequential("resident byte read forwarding", () => {
  // Mutable uninitialized storage has no compile-time value. Each source form denotes the same
  // absolute read followed by an absolute write, with no intervening clobber or second consumer.
  it.each([
    ["array element", "place(at: $3000) let values: byte[2];", "values[1]"],
    [
      "struct field",
      "struct Pair { tag: byte; value: byte; } place(at: $3000) let item: Pair;",
      "item.value",
    ],
    ["direct memory read", "", "peek($3001)"],
  ])(
    "uses six bytes, eight nominal cycles and no temporary storage for a fixed %s",
    async (_name, declaration, value) => {
      const source = [
        "module Game;",
        declaration,
        `place(at: $2000) function transfer(): void { poke($0450, ${value}); }`,
        "function main(): void { transfer(); }",
      ].join("\n");
      await withBuild(source, async (result) => {
        const directory = result.generation.directory;
        const debug = record(JSON.parse(await readFile(join(directory, ".debug.json"), "utf8")));
        const functions = records(debug.functions);
        const functionIndex = functions.findIndex(
          (fn) => fn.qualifiedName === "src/game.blend::Game.transfer",
        );
        expect(functionIndex).toBeGreaterThanOrEqual(0);
        const ranges = records(debug.ranges)
          .filter((range) => {
            const owner = record(range.owner);
            return owner.kind === "function" && owner.functionIndex === functionIndex;
          })
          .map((range) => record(range.machine))
          .sort((a, b) => bytes(a.start) - bytes(b.start));
        expect(ranges.length).toBeGreaterThan(0);
        let end = 0x2000;
        for (const range of ranges) {
          expect(range.start, "The isolated routine's assembled ranges are contiguous").toBe(end);
          end = bytes(range.end);
        }
        const prg = await readFile(join(directory, result.generation.primaryArtifact));
        const origin = prg.readUInt16LE(0);
        const routine = prg.subarray(2 + 0x2000 - origin, 2 + end - origin);
        // NMOS LDA abs and STA abs each cost 3 bytes/4 cycles. The shared RTS costs 1 byte/6 cycles
        // and is excluded from the six-byte/eight-cycle body; no register or flag precondition is used.
        expect
          .soft([...routine], "LDA $3001; STA $0450; RTS")
          .toEqual([0xad, 0x01, 0x30, 0x8d, 0x50, 0x04, 0x60]);
        expect.soft(routine.length - 1, "Body bytes excluding the common return").toBe(6);
        const memory = record(JSON.parse(await readFile(join(directory, ".memory.json"), "utf8")));
        expect(memory.acmeReconciled).toBe(true);
        // These two void functions have no parameters, locals or helpers requiring a memory home.
        // Platform startup/return storage and the source object's own residency are separate costs.
        const homes = records(memory.intervals).filter((interval) => {
          const owner = record(interval.owner);
          return (
            (owner.kind === "function" || owner.kind === "helper") &&
            ["sfa", "zeroPage", "scratch"].includes(String(interval.kind))
          );
        });
        expect
          .soft(
            homes.reduce((sum, home) => sum + bytes(home.size), 0),
            "Temporary RAM/ZP bytes",
          )
          .toBe(0);
      });
    },
    60_000,
  );

  // Register forwarding must retain values when another call/read clobbers A, a value has multiple
  // consumers, the destination is dynamic, or a word requires both bytes. Raw input is seeded only
  // after program loading; no source-level constant permits replacing these observations.
  it("preserves resident reads and saved values across calls, clobbers, repeated uses and wider writes", async () => {
    const source = [
      "module Game;",
      "struct Pair { tag: byte; value: byte; }",
      "place(at: $3000) let values: byte[3];",
      "place(at: $3010) let item: Pair;",
      "place(at: $3020) let words: word[2];",
      "const INPUT: word = $0430; const OTHER: word = $0431; const TARGET: word = $0432;",
      "const OUTPUT: word = $0450; const CLOBBER: word = $0441;",
      "function clobber(): void { values[0] = 99; poke(CLOBBER, peek(OTHER)); }",
      "function main(): void {",
      "  asm_sei(); asm_nop();",
      "  poke(OUTPUT, values[1]); poke(OUTPUT + 1, item.value); poke(OUTPUT + 2, peek(INPUT));",
      "  let beforeCall: byte = values[0]; clobber(); poke(OUTPUT + 3, beforeCall);",
      "  let beforeRead: byte = values[2]; poke(OUTPUT + 4, peek(OTHER)); poke(OUTPUT + 5, beforeRead);",
      "  let repeated: byte = values[2]; poke(OUTPUT + 6, repeated); values[2] = 88; poke(OUTPUT + 7, repeated);",
      "  let target: word = peekw(TARGET); poke(target, values[0]);",
      "  let wide: word = words[0]; pokew(OUTPUT + 8, wide); pokew(OUTPUT + 10, words[1]);",
      "}",
    ].join("\n");
    await withBuild(source, async (result) => {
      const directory = result.generation.directory;
      const labels = await readFile(join(directory, ".labels"), "utf8");
      const entry = startupAddress(labels, "startup.entry");
      const restore = startupAddress(labels, "startup.restore");
      const started = await startVice(join(directory, result.generation.primaryArtifact));
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const { monitor } = started;
      const checkpoints = new Set<number>();
      /** Arm before resume so a fast execution stop cannot race the waiter. */
      const resume = async (): Promise<number> => {
        const stopped = monitor.waitForStop(20_000);
        await monitor.resume();
        return stopped;
      };
      try {
        const atEntry = await monitor.setExecuteCheckpoint(entry);
        checkpoints.add(atEntry);
        expect(await resume()).toBe(entry);
        await monitor.deleteCheckpoint(atEntry);
        checkpoints.delete(atEntry);
        await monitor.writeMemory(0x3000, Uint8Array.of(29, 91, 41));
        await monitor.writeMemory(0x3010, Uint8Array.of(3, 62));
        await monitor.writeMemory(0x3020, Uint8Array.of(0x34, 0x12, 0xef, 0xbe));
        await monitor.writeMemory(0x0430, Uint8Array.of(0xa7, 0x7c, 0x40, 0x04));
        await monitor.writeMemory(0x0440, Uint8Array.of(0, 0));
        await monitor.writeMemory(0x0450, new Uint8Array(12));
        const events = new Map<number, string>();
        for (const [address, operation, name] of [
          [0x3001, "load", "read array"],
          [0x0450, "store", "write array"],
          [0x3011, "load", "read field"],
          [0x0451, "store", "write field"],
          [0x0430, "load", "read memory"],
          [0x0452, "store", "write memory"],
        ] as const) {
          const id = await monitor.setAccessTracepoint(address, operation);
          checkpoints.add(id);
          events.set(id, name);
        }
        const atReturn = await monitor.setExecuteCheckpoint(restore);
        checkpoints.add(atReturn);
        monitor.takeCheckpointHits();
        expect(await resume()).toBe(restore);
        expect([...(await monitor.readMemory(0x0450, 0x045b))]).toEqual([
          91, 62, 0xa7, 29, 0x7c, 41, 41, 41, 0x34, 0x12, 0xef, 0xbe,
        ]);
        expect([...(await monitor.readMemory(0x0440, 0x0441))]).toEqual([99, 0x7c]);
        expect([...(await monitor.readMemory(0x3000, 0x3002))]).toEqual([99, 91, 88]);
        const observed = monitor.takeCheckpointHits().flatMap((id) => {
          const name = events.get(id);
          return name === undefined ? [] : [name];
        });
        expect(observed).toEqual([
          "read array",
          "write array",
          "read field",
          "write field",
          "read memory",
          "write memory",
        ]);
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
    });
  }, 90_000);
});
