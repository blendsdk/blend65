import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { profileRecords, readProfileArtifacts } from "../rd05/profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
} from "../rd05/source-library-fixture.js";

/** A successful public build retains its generation during native observation. */
type SuccessfulBuild = Extract<Awaited<ReturnType<typeof buildProject>>, { kind: "success" }>;

/** Public artifacts from the exact generation being executed. */
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Initializers deliberately change the interrupt mask before main begins. */
type InitializerControl = "asm_cli" | "asm_sei";

/** Combine callable initialization, balanced stack pressure and real BASIC borrowing. */
function behaviorSource(control: InitializerControl): string {
  return [
    "module Game;",
    "let initial: byte = 7;",
    `function initialize(): byte { ${control}(); return 9; }`,
    "let dynamic: byte = initialize();",
    "let answer: byte;",
    "zeropage { place(at: $03) owned: byte[7] = [1, 2, 3, 4, 5, 6, 7]; }",
    "function main(): void {",
    "  asm_sei();",
    ...Array.from({ length: 188 }, () => "  asm_php();"),
    ...Array.from({ length: 188 }, () => "  asm_plp();"),
    "  answer = initial + dynamic + owned[6];",
    "}",
  ].join("\n");
}

/** Keep each build and all its artifacts inside one finally-cleaned owned directory. */
async function withBuild(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (built: SuccessfulBuild, artifacts: Artifacts) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-stored-status-behavior-"),
  );
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "game.blend"), source);
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-startup-stored-status-behavior",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        outDir: "out",
        optimization: "none",
      }),
    );
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
    if (built.kind !== "success") throw new Error("Expected a legal stored-status build.");
    expect(built.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    await inspect(built, await readProfileArtifacts(built));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Advance to a bounded execute checkpoint and remove only that checkpoint. */
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

/** Narrow an address or size before using it to seed or inspect machine memory. */
function integer(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("Expected a nonnegative integer memory extent.");
  }
  return value;
}

/**
 * BASIC workspace ownership is physical: overlapping source intervals borrow
 * each byte once. Address two is free and does not require host preservation.
 */
function borrowedAddresses(artifacts: Artifacts): number[] {
  const addresses = new Set<number>();
  for (const interval of profileRecords(artifacts.memory.intervals)) {
    if (interval.resourceClass !== "zeroPage") continue;
    const start = integer(interval.start);
    const end = integer(interval.end);
    expect(end).toBeGreaterThanOrEqual(start);
    expect(end).toBeLessThanOrEqual(0x100);
    expect(integer(interval.size)).toBe(end - start);
    for (let address = Math.max(3, start); address < Math.min(0x90, end); address += 1) {
      addresses.add(address);
    }
  }
  for (let address = 3; address <= 9; address += 1) expect(addresses.has(address)).toBe(true);
  return [...addresses].sort((left, right) => left - right);
}

/** Independent host bytes differ from the source's initialized workspace values. */
function hostByte(address: number): number {
  return (address * 37 + 0x51) & 0xff;
}

/** Watch every forbidden CPU read and write without changing CPU execution. */
async function installDisplayTracepoints(
  monitor: ViceMonitor,
  tracepoints: Map<number, string>,
): Promise<void> {
  const addresses = [
    ...Array.from({ length: 0x2f }, (_, index) => 0xd000 + index),
    ...Array.from({ length: 8 }, (_, index) => 0x07f8 + index),
    0xdd00,
  ];
  for (const address of addresses) {
    for (const operation of ["load", "store"] as const) {
      const checkpoint = await monitor.setAccessTracepoint(address, operation);
      tracepoints.set(checkpoint, `${operation}:$${address.toString(16)}`);
    }
  }
  expect(tracepoints.size).toBe(112);
  monitor.takeCheckpointHits();
}

/** Check exact stored source values before startup hands BASIC workspace back. */
async function expectInitializedValues(
  monitor: ViceMonitor,
  artifacts: Artifacts,
  source: string,
): Promise<void> {
  for (const [declaration, value] of [
    ["let initial: byte = 7;", 7],
    ["let dynamic: byte = initialize();", 9],
    ["let answer: byte;", 23],
  ] as const) {
    const address = libraryGlobalAddress(artifacts, source, declaration, 1, "src/game.blend");
    expect([...(await monitor.readMemory(address, address))]).toEqual([value]);
  }
  expect([...(await monitor.readMemory(3, 9))]).toEqual([1, 2, 3, 4, 5, 6, 7]);
}

describe.sequential("stored-status startup native behavior", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const control of ["asm_cli", "asm_sei"] as const) {
      for (const incomingP of [0x20, 0xed]) {
        it(`${profile}, ${control}, incoming P=$${incomingP.toString(16)}`, async () => {
          const source = behaviorSource(control);
          await withBuild(source, profile, async (built, artifacts) => {
            const borrowed = borrowedAddresses(artifacts);
            const startup = profileRecords(artifacts.memory.intervals).filter(
              (row) => row.id === "platform.startup-state",
            );
            expect(startup).toHaveLength(1);
            expect(startup[0]).toMatchObject({
              kind: "bss",
              resourceClass: "general",
              size: 7 + borrowed.length,
              payloadBytes: 7 + borrowed.length,
            });
            const bounded = profileRecords(artifacts.memory.stackDomains).filter(
              (row) => row.id === "bounded-component-capacity",
            );
            expect(bounded).toHaveLength(1);
            expect(bounded[0]).toMatchObject({
              capacityBytes: 236,
              peakBytes: 188,
              headroomBytes: 48,
            });

            const runtime = await startVice(
              join(built.generation.directory, built.generation.primaryArtifact),
              100_000_000,
              profile,
              false,
              false,
            );
            if ("kind" in runtime)
              throw new Error(`VICE observation is Unknown: ${runtime.reason}`);
            const monitor = runtime.monitor;
            const tracepoints = new Map<number, string>();
            try {
              // The SYS trampoline loads these saved registers after this stop.
              await stopAt(monitor, 0xe136);
              await monitor.writeMemory(0x030c, Uint8Array.of(0x43, 0x87, 0xa5, incomingP));
              // Host-side timer setup excludes stock IRQ work from this interval.
              await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
              await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
              await stopAt(monitor, libraryStartup(artifacts, "startup.entry"));
              const entry = await monitor.readCpuRegisters();
              expect([entry.a, entry.x, entry.y]).toEqual([0x43, 0x87, 0xa5]);
              expect(entry.p & 0xcf).toBe(incomingP & 0xcf);
              const originalPorts = await monitor.readMemory(0, 1);
              const originalDdra = await monitor.readIo(0xdd02, 0xdd02);
              // SYS itself may use low BASIC bytes, so seed only after its entry.
              for (const address of borrowed) {
                await monitor.writeMemory(address, Uint8Array.of(hostByte(address)));
              }
              await installDisplayTracepoints(monitor, tracepoints);

              await stopAt(monitor, libraryEntry(artifacts, "src/game.blend::Game.initialize"));
              const initializer = await monitor.readCpuRegisters();
              expect(initializer.p & 0x08).toBe(0);
              expect(initializer.p & 0x04).toBe(entry.p & 0x04);
              await stopAt(monitor, libraryEntry(artifacts, "src/game.blend::Game.main"));
              const main = await monitor.readCpuRegisters();
              expect(main.p & 0x08).toBe(0);
              expect(main.p & 0x04).toBe(control === "asm_cli" ? 0 : 4);
              expect(main.sp).toBe(entry.sp);
              await stopAt(monitor, libraryStartup(artifacts, "startup.restore"));
              expect((await monitor.readCpuRegisters()).sp).toBe(main.sp);
              await expectInitializedValues(monitor, artifacts, source);

              // Observe return before BASIC's first instruction can touch devices.
              await stopAt(monitor, 0xe147);
              const forbiddenAccesses = monitor.takeCheckpointHits().flatMap((checkpoint) => {
                const event = tracepoints.get(checkpoint);
                return event === undefined ? [] : [event];
              });
              expect(forbiddenAccesses).toEqual([]);
              const returned = await monitor.readCpuRegisters();
              expect([returned.a, returned.x, returned.y]).toEqual([entry.a, entry.x, entry.y]);
              expect(returned.p & 0xcf).toBe(entry.p & 0xcf);
              expect(returned.sp).toBe((entry.sp + 2) & 0xff);
              expect([...(await monitor.readMemory(0, 1))]).toEqual([...originalPorts]);
              expect([...(await monitor.readIo(0xdd02, 0xdd02))]).toEqual([...originalDdra]);
              for (const address of borrowed) {
                expect(
                  [...(await monitor.readMemory(address, address))],
                  `BASIC byte $${address.toString(16)}`,
                ).toEqual([hostByte(address)]);
              }
            } finally {
              try {
                for (const checkpoint of tracepoints.keys()) {
                  await monitor.deleteCheckpoint(checkpoint);
                }
              } finally {
                await stopVice(runtime);
              }
            }
          });
        }, 120_000);
      }
    }
  }
});
