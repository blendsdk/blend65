import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Build one impossible-mask witness and read the boolean's stored branch value. */
async function runFold(profile: string, operator: "==" | "!="): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "blend65-mask-fold-vice-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "impossible-mask-fold",
        sourceRoot: "src",
        entry: "Game",
        target: profile,
        assetPaths: [],
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(
      join(root, "src/game.blend"),
      [
        "module Game;",
        "let finished: boolean = false;",
        "function main(): void {",
        `  finished = ((peek($DD0D) & 14) ${operator} 3);`,
        "  if (finished) { poke($0410, 1); } else { poke($0410, 0); }",
        "}",
      ].join("\n"),
    );
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Mask fold build did not succeed");
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
        return (await started.monitor.readMemory(0x0410, 0x0410))[0] ?? -1;
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

describe.sequential("impossible masked comparison runtime", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const [operator, expected] of [
      ["==", 0],
      ["!=", 1],
    ] as const) {
      // The read still executes once and the constant Boolean selects the arm.
      it(`should store ${expected} for '${operator}' on ${profile}`, async () => {
        expect(await runFold(profile, operator)).toBe(expected);
      }, 180_000);
    }
  }
});
