import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** What one run of a dispatch program left behind in memory. */
interface Observation {
  /** The byte the program stored from the result of its indirect call. */
  dispatched: number;
  /** The byte the program stored from the variable it did arithmetic on. */
  counted: number;
  /** The selector byte the program only ever reads, kept for precondition checks. */
  selector: number;
}

const target = "c64-pal-prg-kernal-6581";

/** Build one complete program and read the bytes it stored before the startup return. */
async function runProgram(source: readonly string[]): Promise<Observation> {
  const root = await mkdtemp(join(tmpdir(), "blend65-function-pointer-arithmetic-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "function-pointer-arithmetic",
        sourceRoot: "src",
        entry: "Game",
        target,
        outDir: "out",
        optimization: "none",
      }),
    );
    await writeFile(join(root, "src/game.blend"), source.join("\n"));
    const built = await buildProject({ project: join(root, "blend65.json"), optimization: "none" });
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("The dispatch program did not build");

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
        const stored = [...(await started.monitor.readMemory(0xc100, 0xc101))];
        const selector = [...(await started.monitor.readMemory(0xc000, 0xc000))];
        return {
          dispatched: stored[0] ?? -1,
          counted: stored[1] ?? -1,
          selector: selector[0] ?? -1,
        };
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

/** The two functions the dispatch may select between, with distinct results. */
const preamble: readonly string[] = [
  "module Game;",
  "function chosen(): byte { return 37; }",
  "function other(): byte { return 11; }",
];

describe.sequential("dispatch through a function variable followed by arithmetic", () => {
  // Building is not enough: a program that compiles but jumps to the wrong
  // function, or that skips the arithmetic, would still satisfy a build check.
  it("should call the initially selected function and still perform the arithmetic", async () => {
    const observed = await runProgram([
      ...preamble,
      "function main(): void {",
      "  let hook: fn(): byte = &chosen;",
      "  if (peek($C000) == 1) { hook = &other; }",
      "  let i: byte = 0;",
      "  poke($C100, hook());",
      "  i = i + 1;",
      "  poke($C101, i);",
      "}",
      "",
    ]);

    expect(
      observed.selector,
      "Fixture precondition: the untouched selector byte must not request the second function",
    ).not.toBe(1);
    expect(observed.dispatched).toBe(37);
    expect(observed.counted).toBe(1);
  }, 180_000);

  // The same shape aimed at the other function, so a dispatch that always
  // lands on one target cannot satisfy both cases.
  it("should call the other function when the variable holds it instead", async () => {
    const observed = await runProgram([
      ...preamble,
      "function main(): void {",
      "  let hook: fn(): byte = &other;",
      "  let i: byte = 0;",
      "  poke($C100, hook());",
      "  i = i + 1;",
      "  poke($C101, i);",
      "}",
      "",
    ]);

    expect(observed.dispatched).toBe(11);
    expect(observed.counted).toBe(1);
  }, 180_000);
});
