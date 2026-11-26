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
    expect(size.prg.length - 2, "saved size payload").toBe(701);
    // The optimized baseline is a validated candidate recipe, never the raw
    // canonical reference that bypasses the final-observer gate.
    const decision = (size.costs.decisions as readonly Record<string, unknown>[])[0]!;
    expect(decision.baselineCandidateId).not.toBe("reference");
    const candidates = decision.candidates as readonly Record<string, unknown>[];
    const baseline = candidates.find((candidate) => candidate.id === decision.baselineCandidateId)!;
    expect((baseline.feasibility as Record<string, unknown>).kind).toBe("feasible");
    expect(digest(size.prg), "saved size PRG").toBe(
      "0dcf3b28e8c7733734358c463ac9cffa7583a0c3164ad023da53dfc19deca8ec",
    );
    const none = await buildProfileSource(source, PROFILE, "none");
    expect(none.prg.length - 2, "saved none payload").toBe(2159);
    expect(digest(none.prg), "saved none PRG").toBe(
      "f40c0fa82e77b7ab74fc932d8267d84934724851be65170c71282f757271f6e6",
    );
  }, 180_000);

  it("selects the size-quality baseline in balanced and speed", async () => {
    const saved = await fixture("input-saved-caller.blend");
    for (const mode of ["balanced", "speed"] as const) {
      const artifacts = await buildProfileSource(saved, PROFILE, mode);
      expect(artifacts.prg.length - 2, `saved ${mode} payload`).toBe(701);
    }
    const acquisition = await fixture("input-caller.blend");
    for (const mode of ["balanced", "speed"] as const) {
      const artifacts = await buildProfileSource(acquisition, PROFILE, mode);
      // Two staging stores in the input snapshot read write a temporary nothing reads.
      expect(artifacts.prg.length - 2, `acquisition ${mode} payload`).toBe(929);
    }
  }, 600_000);

  it("pins the acquisition size artifact byte-for-byte", async () => {
    const source = await fixture("input-caller.blend");
    const size = await buildProfileSource(source, PROFILE, "size");
    expect(size.prg.length - 2, "acquisition size payload").toBe(929);
    expect(digest(size.prg), "acquisition size PRG").toBe(
      "17033c99fdb4773c56608dc0b607dc00651b9d8e29ac4dc148d304c52fb33786",
    );
  }, 180_000);
});
