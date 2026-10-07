import { createHash } from "node:crypto";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import { CIA2_PROFILES } from "./cia2-fixture.js";
import { profileRecords, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import { cia2ModelIdentity, qualifyCia2Timer } from "./cia2-vice-fixture.js";
import { CIA2_TIMER_SCENARIOS, cia2TimerSource } from "./cia2-vice-sources.js";

describe.sequential.each(CIA2_PROFILES)("CIA2 source-programmed native timers on %s", (target) => {
  // Hardware timer acceptance and real RTI, not a monitor PC jump, are the behavior oracle.
  it.each(CIA2_TIMER_SCENARIOS)(
    "should qualify $name through genuine NMI acceptance",
    async (scenario) => {
      const source = cia2TimerSource(scenario);
      await withProfileProject(source, target, async (project) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const artifacts = await readProfileArtifacts(built);
        const primary = profileRecords(artifacts.build.artifacts).filter(
          ({ kind }) => kind === "primary",
        );
        expect(primary).toHaveLength(1);
        expect(primary[0]!.bytes).toBe(artifacts.prg.length);
        expect(primary[0]!.sha256).toBe(createHash("sha256").update(artifacts.prg).digest("hex"));
        const sources = profileRecords(artifacts.debug.sources).filter(
          ({ path }) => path === "src/game.blend",
        );
        expect(sources).toHaveLength(1);
        expect(sources[0]!.byteLength).toBe(Buffer.byteLength(source));
        expect(sources[0]!.sha256).toBe(createHash("sha256").update(source).digest("hex"));
        const started = await startVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          80_000_000,
          target,
        );
        if ("kind" in started)
          throw new Error(`Unknown native CIA2 qualification: ${started.reason}`);
        try {
          expect(started.identity.executableSha256).toMatch(/^[a-f0-9]{64}$/);
          expect(started.identity.roms).toHaveLength(3);
          await cia2ModelIdentity(started.monitor, target);
          await qualifyCia2Timer(started.monitor, artifacts, source, scenario);
        } finally {
          await stopVice(started);
        }
      });
    },
    60_000,
  );
});
