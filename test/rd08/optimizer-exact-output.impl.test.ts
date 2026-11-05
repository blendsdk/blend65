import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProfileSource } from "../rd05/profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";

/** Hash the exact published PRG bytes so a payload-only regression cannot pass. */
function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function fixture(name: string): Promise<string> {
  return await readFile(new URL(`../rd05/fixtures/${name}`, import.meta.url), "utf8");
}

describe("measured optimizer output identity", () => {
  it("pins the saved size and direct-lowering artifacts byte-for-byte", async () => {
    const source = await fixture("input-saved-caller.blend");
    const size = await buildProfileSource(source, PROFILE, "size");
    expect(size.prg.length - 2, "saved size payload").toBe(709);
    // The optimized baseline is a validated candidate recipe, never the raw
    // canonical reference that bypasses the final-observer gate.
    const decision = (size.costs.decisions as readonly Record<string, unknown>[])[0]!;
    expect(decision.baselineCandidateId).not.toBe("reference");
    const candidates = decision.candidates as readonly Record<string, unknown>[];
    const baseline = candidates.find((candidate) => candidate.id === decision.baselineCandidateId)!;
    expect((baseline.feasibility as Record<string, unknown>).kind).toBe("feasible");
    expect(digest(size.prg), "saved size PRG").toBe(
      "2bd0caf0d7bdbbf2edec32f1ab81770bdc5d6b3cad3227358c3c0b459f6e2c47",
    );
    const none = await buildProfileSource(source, PROFILE, "none");
    expect(none.prg.length - 2, "saved none payload").toBe(2163);
    expect(digest(none.prg), "saved none PRG").toBe(
      "0417b7da8c4eabb022e6ec868e0d8dcaf4b4727da83d43e29fcbe98e16a02a93",
    );
  }, 180_000);

  it("selects the size-quality baseline in balanced and speed", async () => {
    const saved = await fixture("input-saved-caller.blend");
    for (const mode of ["balanced", "speed"] as const) {
      const artifacts = await buildProfileSource(saved, PROFILE, mode);
      expect(artifacts.prg.length - 2, `saved ${mode} payload`).toBe(709);
    }
    const acquisition = await fixture("input-caller.blend");
    for (const mode of ["balanced", "speed"] as const) {
      const artifacts = await buildProfileSource(acquisition, PROFILE, mode);
      expect(artifacts.prg.length - 2, `acquisition ${mode} payload`).toBe(943);
    }
  }, 600_000);

  it("pins the acquisition size artifact byte-for-byte", async () => {
    const source = await fixture("input-caller.blend");
    const size = await buildProfileSource(source, PROFILE, "size");
    expect(size.prg.length - 2, "acquisition size payload").toBe(943);
    expect(digest(size.prg), "acquisition size PRG").toBe(
      "f258bc76bbd7c26415c6cc8e80f92c3675dcf4a912923eb444ab0e82e6c07049",
    );
  }, 180_000);
});
