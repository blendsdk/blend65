import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { startVice, stopVice } from "../m1/vice-runtime.js";

/** Read a compiler label from the published ACME map. */
function labelAddress(labels: string, name: string): number {
  const encoded = `b65_${Buffer.from(name).toString("hex")}`;
  const matches = [
    ...labels.matchAll(new RegExp(`^\\s*${encoded}\\s*=\\s*\\$([0-9a-f]+)`, "gimu")),
  ];
  expect(matches).toHaveLength(1);
  return Number.parseInt(matches[0]![1]!, 16);
}

describe.sequential("finite C64 interrupt handler selection", () => {
  it("runs each chosen handler and restores CINV after both choices", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-irq-select-vice-"));
    try {
      await mkdir(join(root, "src"));
      await writeFile(
        join(root, "blend65.json"),
        JSON.stringify({
          schemaVersion: 1,
          name: "irq-select-vice",
          sourceRoot: "src",
          entry: "Game",
          target: "c64-pal-prg-kernal-6581",
          outDir: "out",
          optimization: "none",
        }),
      );
      await writeFile(
        join(root, "src/game.blend"),
        [
          "module Game;",
          "import { setIRQ, restoreIRQ } from c64.system;",
          "interrupt function first(): void { poke($0421, peek($0421) + 1); }",
          "interrupt function second(): void { poke($0422, peek($0422) + 1); }",
          "function waitForCount(address: word): void {",
          "  for (let spin: word = 0; spin < 50000; spin += 1) {",
          "    if (peek(address) >= 2) { return; }",
          "  }",
          "}",
          "function main(): void {",
          "  poke($0400, 0); poke($0421, 0); poke($0422, 0);",
          "  poke($0423, peek($0314)); poke($0424, peek($0315));",
          "  setIRQ(peek($0400) != 0 ? &first : &second);",
          "  waitForCount($0422); restoreIRQ();",
          "  poke($0400, 1);",
          "  setIRQ(peek($0400) != 0 ? &first : &second);",
          "  waitForCount($0421); restoreIRQ();",
          "}",
        ].join("\n"),
      );
      const built = await buildProject({
        project: join(root, "blend65.json"),
        optimization: "none",
      });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") return;
      const labels = await readFile(join(built.generation.directory, ".labels"), "utf8");
      const restore = labelAddress(labels, "startup.restore");
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      if ("kind" in started) throw new Error(`VICE qualification is Unknown: ${started.reason}`);
      const checkpoint = await started.monitor.setExecuteCheckpoint(restore);
      try {
        const stopped = started.monitor.waitForStop(20_000);
        await started.monitor.resume();
        expect(await stopped).toBe(restore);
        const observed = [...(await started.monitor.readMemory(0x0421, 0x0424))];
        expect(observed[0]).toBeGreaterThanOrEqual(2);
        expect(observed[1]).toBeGreaterThanOrEqual(2);
        expect([...(await started.monitor.readMemory(0x0314, 0x0315))]).toEqual(
          observed.slice(2, 4),
        );
      } finally {
        await started.monitor.deleteCheckpoint(checkpoint);
        await stopVice({ child: started.child, monitor: started.monitor });
      }
    } finally {
      await rm(root, { recursive: true });
    }
  }, 60_000);
});
