import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

/** Resolve the single-byte local through source-backed final debug storage, never a guessed address. */
function localStorageAddress(debug: Record<string, unknown>, startByte: number): number {
  const symbolIndex = profileRecords(debug.symbols).findIndex(
    (symbol) =>
      symbol.kind === "local" &&
      profileRecord(profileRecord(symbol.origin).span).startByte === startByte,
  );
  if (symbolIndex < 0) throw new Error("Missing raw-write local symbol");
  const location = profileRecords(debug.locations).find((item) => item.symbolIndex === symbolIndex);
  const availability = profileRecord(location?.availability);
  expect(availability.kind).toBe("available");
  const pieces = profileRecords(availability.pieces);
  expect(pieces).toHaveLength(1);
  expect(pieces[0]).toMatchObject({ kind: "memory", byteLength: 1 });
  const start = profileRecord(pieces[0]?.machine).start;
  if (typeof start !== "number") throw new Error("Missing raw-write local address");
  return start;
}

it("executes fresh mutable reads after raw-address writes and synchronous calls", async () => {
  const source = `module Game;
let shared: byte;
struct Box { pointer: word; }
function set(address: word): void { poke(address, 2); }
function numericWrite(): void { poke($4000, 2); }
function g(): byte { return byte(255 + 10); }
function writeBox(box: Box): void { poke(box.pointer, 2); }
function raw(): byte { let value: byte = 1; poke(&value, 2); return value + 1; }
function alias(): byte {
  let value: byte = 1;
  let pointer: word = &value;
  value = 3;
  poke(pointer, 2);
  return value + 1;
}
function called(): byte { let value: byte = 1; set(&value); return value + 1; }
function wide(): word { let value: word = 1; pokew(&value, 512); return value + 1; }
function aggregateAlias(): byte {
  let value: byte = 1;
  let box: Box = { pointer: &value };
  writeBox(box);
  return value + 1;
}
function fieldAlias(): byte {
  let value: byte = 1;
  let box: Box = { pointer: &value };
  set(box.pointer);
  return value + 1;
}
function main(): void {
  poke($0420, raw());
  poke($0421, alias());
  poke($0422, called());
  pokew($0423, wide());
  let selected: byte = 1;
  set(&selected);
  switch (selected) { case 1: poke($0425, 11); case 2: poke($0425, 22); default: poke($0425, 99); }
  poke($0426, c64.profile.isPal ? byte(6) : byte(2));
  shared = 1;
  poke(&shared, 2);
  poke($0427, shared + 1);
  poke($0428, aggregateAlias());
  poke($0429, fieldAlias());
  let numericValue: byte = 1;
  numericWrite();
  poke($042a, numericValue + 1);
  let a: byte[500] = [0; 0];
  a[9] = 19;
  a[265] = 77;
  let i: byte = 255;
  a[g()];
  poke($042b, a[(i + 10)]);
}`;
  await withProfileProject(source, "c64-pal-prg-kernal-6581", async (project, root) => {
    // Discover the actual local address, then use it as a plain numeric operand in the callee.
    // Keep the literal width fixed so source identities and absolute instruction sizes stay stable.
    const probe = await buildProject({ project, optimization: "none" });
    expect(probe.kind, JSON.stringify(probe)).toBe("success");
    if (probe.kind !== "success") throw new Error("Local-address probe failed");
    const probed = await readProfileArtifacts(probe);
    const startByte = source.indexOf("let numericValue:");
    const localAddress = localStorageAddress(probed.debug, startByte);
    expect(localAddress).toBeGreaterThan(0xff);
    await writeFile(
      join(root, "src/game.blend"),
      source.replace("$4000", `$${localAddress.toString(16).padStart(4, "0")}`),
    );
    const built = await buildProject({ project, optimization: "none" });
    expect(built.kind, JSON.stringify(built)).toBe("success");
    if (built.kind !== "success") throw new Error("Mutable-value build failed");
    const artifacts = await readProfileArtifacts(built);
    // Fail instead of silently testing a different address if allocation ever changes on rebuild.
    expect(localStorageAddress(artifacts.debug, startByte)).toBe(localAddress);
    const label = `b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}`;
    const match = artifacts.labels.match(new RegExp(`^\\s*${label}\\s*=\\s*\\$([0-9a-f]+)`, "imu"));
    if (match === null) throw new Error("Missing cooperative return checkpoint");
    const address = Number.parseInt(match[1]!, 16);
    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(address);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(address);
        // Independent values: 2 + 1, word 512 + 1, case 2, PAL 6, and a[265] rather than a[9].
        expect([...(await started.monitor.readMemory(0x0420, 0x042b))]).toEqual([
          3, 3, 3, 1, 2, 22, 6, 3, 3, 3, 3, 77,
        ]);
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  });
}, 60_000);
