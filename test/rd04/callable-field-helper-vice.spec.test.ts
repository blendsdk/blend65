import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build the accepted witness and read the byte it stores before the startup return. */
async function runWitness(profile: string): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "blend65-callable-field-vice-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "callable-field-helper-vice",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        "struct Box { cb: fn(): byte; }",
        "let box: Box;",
        "function chosen(): byte { return 37; }",
        "function prepare(): void { box.cb = &chosen; }",
        "function invoke(value: Box): byte { return value.cb(); }",
        "function main(): void { prepare(); poke($0420, invoke(box)); }",
      ].join("\n"),
    );
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Callable-field witness did not build");
    const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
    const returnLabel = `b65_[A-Za-z0-9_]+_${Buffer.from("startup.restore").toString("hex")}`;
    const returnMatch = labels.match(
      new RegExp(`^\\s*${returnLabel}\\s*=\\s*\\$([0-9a-f]+)`, "imu"),
    );
    expect(returnMatch).not.toBeNull();
    const returnAddress = Number.parseInt(returnMatch?.[1] ?? "", 16);
    const started = await startVice(
      join(built.generation.directory, built.generation.primaryArtifact),
    );
    if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
    try {
      const checkpoint = await started.monitor.setExecuteCheckpoint(returnAddress);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(returnAddress);
        const memory = await started.monitor.readMemory(0x0420, 0x0421);
        return [...memory][0] ?? -1;
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true });
  }
}

describe.sequential("callable-field helper transfer runtime", () => {
  for (const profile of sourceLibraryProfiles) {
    // The helper's definite store must produce a real call to the chosen function.
    it(`should return the chosen value on ${profile}`, async () => {
      expect(await runWitness(profile)).toBe(37);
    }, 180_000);
  }
});
