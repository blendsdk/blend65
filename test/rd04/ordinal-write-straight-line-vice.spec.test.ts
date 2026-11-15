import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Run one ordinal-store witness and read back the stored byte. */
async function runOrdinal(profile: string, seed: number): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "blend65-ordinal-vice-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "ordinal-write-straight-line",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        assetPaths: [],
        outDir: "out",
        optimization: "size",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        "let answer: byte = 0;",
        "function main(): void {",
        `  poke($0400, ${seed});`,
        "  let i: byte = peek($0400) & 3;",
        "  poke($0400 + i, 7);",
        "  answer = peek($0400 + i);",
        "  poke($0420, answer);",
        "}",
      ].join("\n"),
    );
    const built = await buildProject({
      project: join(root, "blend65.json"),
      optimization: "size",
    });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Ordinal write build did not succeed");
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
        return (await started.monitor.readMemory(0x0420, 0x0420))[0] ?? -1;
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
      }
    } finally {
      await stopVice({ child: started.child, monitor: started.monitor });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe.sequential("straight-line ordinal write runtime", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const seed of [0, 1, 2, 3]) {
      // The indexed store and read target the same proved element.
      it(`should store and read 7 at index ${seed} on ${profile}`, async () => {
        expect(await runOrdinal(profile, seed)).toBe(7);
      }, 180_000);
    }
  }
});
