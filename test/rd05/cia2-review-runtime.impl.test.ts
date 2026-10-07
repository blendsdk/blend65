import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { CIA2_PROFILES } from "./cia2-fixture.js";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import { cia2ModelIdentity, qualifyCia2Timer } from "./cia2-vice-fixture.js";
import { CIA2_TIMER_SCENARIOS, cia2TimerSource } from "./cia2-vice-sources.js";

describe.sequential.each(CIA2_PROFILES)("CIA2 corrected helper/capture runtime on %s", (target) => {
  // The real one-shot underflow must survive copied helper inputs and two balanced
  // handler-side vector transactions, then restore registers and return to BASIC.
  it("should execute reusable mask clearing and repeated successor restoration", async () => {
    const scenario = CIA2_TIMER_SCENARIOS[0]!;
    const originalHandler =
      "interrupt function handler(): void { poke($0410, readAndClearPendingSources()); }";
    const nestedHandler = originalHandler.replace(
      "poke($0410, readAndClearPendingSources());",
      "setNMIExclusive(&successor); restoreNMI(); setNMIExclusive(&successor); restoreNMI(); poke($0410, readAndClearPendingSources());",
    );
    // The reused monitor observer selects the first restore expression for main.
    // Put this new handler after main without changing its executed operations.
    const source =
      cia2TimerSource(scenario)
        .replace("disableInterruptSources($1F);", "clear($1F);")
        .replace(originalHandler, "")
        .replace(
          "function main(): void",
          "function clear(mask: byte): void { poke($0415, peek(&mask)); disableInterruptSources(mask); }\nfunction main(): void",
        ) + `\n${nestedHandler}`;
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      const artifacts = await readProfileArtifacts(built);
      const started = await startVice(
        join(built.generation.directory, built.generation.primaryArtifact),
        80_000_000,
        target,
      );
      if ("kind" in started) throw new Error(`Unknown corrected CIA2 runtime: ${started.reason}`);
      try {
        await cia2ModelIdentity(started.monitor, target);
        await qualifyCia2Timer(started.monitor, artifacts, source, scenario);
        expect((await started.monitor.readMemory(0x0415, 0x0415))[0]).toBe(0x1f);
      } finally {
        await stopVice(started);
      }
    });
  }, 60_000);
});
