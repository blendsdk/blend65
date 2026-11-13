import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";
import { CIA2_PROFILES, cia2Lease, expectCia2Rejected } from "./cia2-fixture.js";

/** Five simultaneously retained volatile bytes cannot all fit in the three CPU registers. */
const retainedSamples = `let a: byte = peek($0400); let b: byte = peek($0401);
let c: byte = peek($0402); let d: byte = peek($0403); let e: byte = peek($0404);
poke($0410, a); poke($0411, b); poke($0412, c); poke($0413, d); poke($0414, e);`;

/** Generated reentrancy rejection keeps the canonical diagnostic wording. */
const reentrancyMessage =
  /^Execution path '[^']+' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy$/;

describe.each(CIA2_PROFILES)("CIA2 private-storage closure on %s", (target) => {
  // Exclusive device ownership still admits only the handler's own hardware stack.
  it("should retain five volatile samples in the exclusive callback", async () => {
    const artifacts = await buildProfileSource(cia2Lease("", retainedSamples), target);
    expect(artifacts.memory.acmeReconciled).toBe(true);
    const totals = profileRecord(artifacts.costs.totals);
    const standard = (id: string) =>
      profileRecords(totals.resources).find((row) => row.kind === "standard" && row.id === id);
    expect(standard("zeroPage")?.value).toBe(0);
    expect(standard("scratch")?.value).toBe(0);
    expect(standard("hardwareStack")?.value).toBe(10);
  }, 60_000);

  // The complete transitive route includes ordinary helper locals and generated scratch.
  it("should reject five volatile samples retained by an ordinary callback helper", async () => {
    await expectCia2Rejected(
      cia2Lease("", "retainSamples();", `function retainSamples(): void { ${retainedSamples} }`),
      target,
      "E10245",
      reentrancyMessage,
    );
  }, 60_000);
});
