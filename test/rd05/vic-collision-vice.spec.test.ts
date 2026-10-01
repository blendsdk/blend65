import { createHash } from "node:crypto";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const profiles = [
  ["c64-pal-prg-kernal-6581", 0, 0],
  ["c64-pal-prg-kernal-8580", 0, 1],
  ["c64-ntsc-prg-kernal-6581", 3, 0],
  ["c64-ntsc-prg-kernal-8580", 3, 1],
] as const;

const operations = {
  sprite: "c64.vic.readAndClearSpriteSpriteCollisions()",
  background: "c64.vic.readAndClearSpriteBackgroundCollisions()",
} as const;

const scenarios = [
  {
    name: "sprites 0 and 7 overlap away from foreground",
    enabled: 0x81,
    foreground: false,
    first: "sprite",
    sprite: 0x81,
    background: 0,
  },
  {
    name: "only sprite 7 overlaps foreground",
    enabled: 0x80,
    foreground: true,
    first: "background",
    sprite: 0,
    background: 0x80,
  },
  {
    name: "both collision types occur and sprite participation is read first",
    enabled: 0x81,
    foreground: true,
    first: "sprite",
    sprite: 0x81,
    background: 0x80,
  },
  {
    name: "both collision types occur and background participation is read first",
    enabled: 0x81,
    foreground: true,
    first: "background",
    sprite: 0x81,
    background: 0x80,
  },
] as const;

type Scenario = (typeof scenarios)[number];
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/**
 * Create real display events, then wait a complete disabled frame before consuming either latch.
 * The bounded polling reports exhaustion in ordinary RAM. Raster 180 is beyond the sprites'
 * unexpanded Y=80..100 display and is below 256 on both selected video standards.
 */
function sourceFor(scenario: Scenario): string {
  const second = scenario.first === "sprite" ? "background" : "sprite";
  return `module Game;
function setupPoint(): void { asm_nop(); }
function readyPoint(): void { asm_nop(); }
function quietPoint(): void { asm_nop(); }
function firstPoint(): void { asm_nop(); }
function donePoint(): void { asm_nop(); }
function waitFrame(): void {
  let attempts: word = 20000;
  while ((peek($d012) == 180) && (attempts != 0)) { attempts -= 1; }
  while ((peek($d012) != 180) && (attempts != 0)) { attempts -= 1; }
  if (attempts == 0) { poke($0708, 1); }
}
function main(): void {
  asm_sei();
  poke($0000, peek($0000) | $07);
  poke($0001, (peek($0001) & $f8) | $06);
  poke($d015, 0);
  poke($d01a, 0);
  setupPoint();
  waitFrame();
  poke($0700, ${operations.sprite});
  poke($0701, ${operations.background});
  readyPoint();
  poke($d015, $${scenario.enabled.toString(16)});
  waitFrame();
  poke($d015, 0);
  waitFrame();
  poke($0702, peek($d019));
  quietPoint();
  poke($0703, ${operations[scenario.first]});
  firstPoint();
  poke($0704, ${operations[second]});
  poke($0705, ${operations.sprite});
  poke($0706, ${operations.background});
  poke($0707, peek($d019));
  donePoint();
  while (true) { asm_nop(); }
}`;
}

/** Resolve source-owned checkpoint functions through published debug entries and ACME labels. */
function functionAddress(artifacts: Artifacts, name: string): number {
  const functions = profileRecords(artifacts.debug.functions).filter(
    (fn) => fn.qualifiedName === `src/game.blend::Game.${name}`,
  );
  expect(functions, name).toHaveLength(1);
  const variants = profileRecords(functions[0]!.entryVariants);
  expect(variants, name).toHaveLength(1);
  const labels = new Map(
    [...artifacts.labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
      match[1]!,
      Number.parseInt(match[2]!, 16),
    ]),
  );
  const label = variants[0]!.label;
  if (typeof label !== "string") throw new Error(`Missing published entry for ${name}`);
  const address = labels.get(label);
  if (address === undefined) throw new Error(`Missing assembled entry for ${name}`);
  return address;
}

/**
 * Build a blank glyph and a solid glyph in VIC bank $4000, with a foreground stripe at x=136.
 * Sprite 0 occupies x=120..127; sprite 7 occupies x=120..143. Their left pixels collide,
 * but only sprite 7 touches the stripe. Setup never writes or observes collision latches.
 */
async function configureDisplay(monitor: ViceMonitor, scenario: Scenario): Promise<void> {
  const direction = (await monitor.readIo(0xdd02, 0xdd02))[0]!;
  const bank = (await monitor.readIo(0xdd00, 0xdd00))[0]!;
  await monitor.writeIo(0xdd0d, Uint8Array.of(0x7f));
  await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
  await monitor.writeIo(0xdd02, Uint8Array.of(direction | 3));
  await monitor.writeIo(0xdd00, Uint8Array.of((bank & 0xfc) | 2));
  await monitor.writeIo(0xd019, Uint8Array.of(0x0f));
  await monitor.writeIo(0xd01a, Uint8Array.of(0x06));
  await monitor.writeIo(0xd011, Uint8Array.of(0x1b));
  await monitor.writeIo(0xd016, Uint8Array.of(0x08));
  await monitor.writeIo(0xd018, Uint8Array.of(0x12));
  for (const address of [0xd010, 0xd017, 0xd01b, 0xd01c, 0xd01d])
    await monitor.writeIo(address, Uint8Array.of(0));
  await monitor.writeIo(0xd000, Uint8Array.of(120, 80));
  await monitor.writeIo(0xd00e, Uint8Array.of(120, 80));
  await monitor.writeIo(0xd020, Uint8Array.of(0));
  await monitor.writeIo(0xd021, Uint8Array.of(0));
  await monitor.writeIo(0xd027, Uint8Array.of(2));
  await monitor.writeIo(0xd02e, Uint8Array.of(3));
  const screen = new Uint8Array(1000);
  if (scenario.foreground) for (let row = 0; row < 25; row += 1) screen[row * 40 + 14] = 1;
  await monitor.writeMemory(0x4400, screen);
  await monitor.writeIo(0xd800, new Uint8Array(1000).fill(1));
  const charset = new Uint8Array(2048);
  charset.fill(0xff, 8, 16);
  await monitor.writeMemory(0x4800, charset);
  const leftPixels = new Uint8Array(64);
  for (let row = 0; row < 21; row += 1) leftPixels[row * 3] = 0xff;
  await monitor.writeMemory(0x5000, leftPixels);
  await monitor.writeMemory(0x5040, new Uint8Array(64).fill(0xff));
  await monitor.writeMemory(0x47f8, Uint8Array.of(0x40, 0, 0, 0, 0, 0, 0, 0x41));
  await monitor.writeMemory(0x0700, new Uint8Array(9));
  expect((await monitor.readMemory(0x0001, 0x0001))[0]! & 7).toBe(6);
  expect((await monitor.readIo(0xdd02, 0xdd02))[0]! & 3).toBe(3);
  expect((await monitor.readIo(0xdd00, 0xdd00))[0]! & 3).toBe(2);
  expect((await monitor.readIo(0xd015, 0xd015))[0]).toBe(0);
  expect((await monitor.readIo(0xd01a, 0xd01a))[0]! & 0x0f).toBe(6);
  expect((await monitor.readIo(0xd018, 0xd018))[0]! & 0xfe).toBe(0x12);
}

describe.sequential("VIC collision latch behavior in pinned VICE", () => {
  for (const [profile, vic, sid] of profiles) {
    describe.sequential(profile, () => {
      // Real pixels establish participant masks; disabled display prevents re-latching between reads.
      it.each(scenarios)(
        "should preserve independent consuming masks and IRQ pending bits when $name",
        async (scenario) => {
          await withProfileProject(sourceFor(scenario), profile, async (project) => {
            const built = await buildProject({ project, optimization: "none" });
            expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
            if (built.kind !== "success")
              throw new Error("Expected a complete collision-runtime build");
            const artifacts = await readProfileArtifacts(built);
            const inputs = profileRecord(artifacts.build.semanticInputs);
            expect(profileRecord(inputs.target)).toMatchObject({
              profileId: profile,
              cpuId: "nmos6510",
            });
            expect(profileRecords(artifacts.build.portableTools)).toContainEqual(
              expect.objectContaining({ name: "acme", version: "0.97" }),
            );
            expect(artifacts.debug.primaryArtifact).toMatchObject({
              sha256: createHash("sha256").update(artifacts.prg).digest("hex"),
            });
            const loadAddress = artifacts.prg[0]! | (artifacts.prg[1]! << 8);
            expect(loadAddress + artifacts.prg.length - 2).toBeLessThanOrEqual(0x4400);
            // Fixture display RAM and sample RAM must not overwrite compiler-owned execution storage.
            for (const interval of profileRecords(artifacts.memory.intervals).filter(
              ({ kind }) => kind === "sfa" || kind === "zeroPage" || kind === "scratch",
            )) {
              const start = Number(interval.start);
              const end = Number(interval.end);
              expect(end <= 0x4400 || start >= 0x5080).toBe(true);
              expect(end <= 0x0700 || start >= 0x0709).toBe(true);
            }
            const started = await startVice(
              join(built.generation.directory, built.generation.primaryArtifact),
              100_000_000,
              profile,
            );
            if ("kind" in started)
              throw new Error(`VICE qualification is Unknown: ${started.reason}`);
            const { monitor } = started;
            const checkpoints: number[] = [];
            const events = new Map<number, string>();
            const resumeTo = async (address: number) => {
              const stop = monitor.waitForStop(20_000);
              await monitor.resume();
              expect(await stop).toBe(address);
            };
            const trace = () =>
              monitor
                .takeCheckpointHits()
                .flatMap((id) => (events.has(id) ? [events.get(id)!] : []));
            try {
              expect(started.identity.executableSha256).toBe(
                "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74",
              );
              expect(
                started.identity.roms.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })),
              ).toEqual([
                {
                  name: "kernal-901227-03.bin",
                  bytes: 8192,
                  sha256: "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
                },
                {
                  name: "basic-901226-01.bin",
                  bytes: 8192,
                  sha256: "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
                },
                {
                  name: "chargen-901225-01.bin",
                  bytes: 4096,
                  sha256: "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
                },
              ]);
              expect(await monitor.readIntegerResource("VICIIModel")).toBe(vic);
              expect(await monitor.readIntegerResource("SidModel")).toBe(sid);
              expect(await monitor.readIntegerResource("CIA1Model")).toBe(0);
              expect(await monitor.readIntegerResource("CIA2Model")).toBe(0);
              expect(await monitor.readIntegerResource("KernalRev")).toBe(3);
              const names = [
                "main",
                "setupPoint",
                "readyPoint",
                "quietPoint",
                "firstPoint",
                "donePoint",
              ] as const;
              const addresses = names.map((name) => functionAddress(artifacts, name));
              for (const address of addresses)
                checkpoints.push(await monitor.setExecuteCheckpoint(address));
              const [main, setup, ready, quiet, first, done] = addresses;
              await resumeTo(main!);
              await resumeTo(setup!);
              expect((await monitor.readCpuRegisters()).p & 4).toBe(4);
              await configureDisplay(monitor, scenario);
              for (const address of [0xd01e, 0xd01f, 0xd019]) {
                for (const operation of ["load", "store"] as const) {
                  const id = await monitor.setAccessTracepoint(address, operation);
                  checkpoints.push(id);
                  events.set(id, `${operation}:$${address.toString(16)}`);
                }
              }
              trace();
              await resumeTo(ready!);
              expect(trace()).toEqual(["load:$d01e", "load:$d01f"]);
              expect([...(await monitor.readMemory(0x0700, 0x0701))]).toEqual([0, 0]);
              await resumeTo(quiet!);
              expect(trace()).toEqual(["load:$d019"]);
              expect((await monitor.readIo(0xd015, 0xd015))[0]).toBe(0);
              expect((await monitor.readCpuRegisters()).p & 4).toBe(4);
              const pendingBits =
                (scenario.sprite !== 0 ? 4 : 0) | (scenario.background !== 0 ? 2 : 0) | 0x80;
              const before = (await monitor.readMemory(0x0702, 0x0702))[0]!;
              expect(before & 0x86).toBe(pendingBits);
              await resumeTo(first!);
              expect(trace()).toEqual([scenario.first === "sprite" ? "load:$d01e" : "load:$d01f"]);
              expect((await monitor.readMemory(0x0703, 0x0703))[0]).toBe(scenario[scenario.first]);
              await resumeTo(done!);
              const second = scenario.first === "sprite" ? "background" : "sprite";
              expect(trace()).toEqual([
                second === "sprite" ? "load:$d01e" : "load:$d01f",
                "load:$d01e",
                "load:$d01f",
                "load:$d019",
              ]);
              expect([...(await monitor.readMemory(0x0703, 0x0706))]).toEqual([
                scenario[scenario.first],
                scenario[second],
                0,
                0,
              ]);
              expect((await monitor.readMemory(0x0707, 0x0707))[0]).toBe(before);
              expect((await monitor.readMemory(0x0708, 0x0708))[0]).toBe(0);
              expect((await monitor.readCpuRegisters()).p & 4).toBe(4);
            } finally {
              try {
                for (const id of checkpoints) await monitor.deleteCheckpoint(id);
              } finally {
                await stopVice({ child: started.child, monitor });
              }
            }
          });
        },
        90_000,
      );
    });
  }
});
