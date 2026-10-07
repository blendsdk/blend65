import { describe, it } from "vitest";
import {
  CIA2_PROFILES,
  cia2Lease,
  cia2Source,
  expectCia2Accepted,
  expectCia2Rejected,
} from "./cia2-fixture.js";

/** One ordinary release helper must select its policy from actual predecessor facts. */
const releaseHelpers = `function release(): void { restoreNMI(); }
function releaseWrapper(): void { release(); }`;

describe.each(CIA2_PROFILES)("CIA2 lease lifecycle on %s", (target) => {
  // A clean inner pop resumes its predecessor instead of ending the outer device epoch.
  it.each(["setNMIExclusive", "setNMI"])(
    "should admit a clean nested successor installed by %s",
    async (install) => {
      await expectCia2Accepted(
        cia2Lease(`disableInterruptSources($1F); ${install}(&successor); restoreNMI();`),
        target,
      );
    },
    60_000,
  );

  it("should propagate balanced installation effects through ordinary helpers", async () => {
    await expectCia2Accepted(
      cia2Source(
        "install(); disableInterruptSources($1F); release();",
        "",
        `function install(): void { setNMIExclusive(&handler); } ${releaseHelpers}`,
      ),
      target,
    );
  }, 60_000);

  // Each branch returns to the same ownership state before its join.
  it("should admit balanced conditional installations", async () => {
    await expectCia2Accepted(
      cia2Source(`if (peek($0400) != 0) {
setNMIExclusive(&handler); disableInterruptSources($1F); restoreNMI();
} else { setNMIExclusive(&successor); restoreNMI(); }`),
      target,
    );
  }, 60_000);

  it("should admit a balanced lease on an ordinary loop backedge", async () => {
    await expectCia2Accepted(
      cia2Source(`for (let i: byte = 0; i < 3; i = i + 1) {
setNMIExclusive(&handler); disableInterruptSources($1F); restoreNMI();
}`),
      target,
    );
  }, 60_000);

  it.each(["release()", "releaseWrapper()"])(
    "should use the same %s helper for clean inner and final typed releases",
    async (release) => {
      await expectCia2Accepted(
        cia2Source(
          `setNMIExclusive(&handler); disableInterruptSources($1F);
setNMIExclusive(&successor); ${release}; ${release};`,
          "",
          releaseHelpers,
        ),
        target,
      );
    },
    60_000,
  );

  // Equal nesting depth does not make a chained release equal to typed final shutdown.
  it.each(["release()", "releaseWrapper()"])(
    "should distinguish sequential chained and typed-exclusive depth-one calls to %s",
    async (release) => {
      await expectCia2Accepted(
        cia2Source(
          `setNMI(&handler); ${release};
setNMIExclusive(&handler); disableInterruptSources($1F);
writeTimerALatch($1234); configureTimerA($19); ${release};`,
          "",
          releaseHelpers,
        ),
        target,
      );
    },
    60_000,
  );

  // Finite ordinary function values preserve the same interprocedural ownership effect.
  it("should select release policies through a finite ordinary function target", async () => {
    await expectCia2Accepted(
      cia2Source(
        `let pop: fn(): void = (peek($0400) != 0) ? &release : &releaseWrapper;
setNMI(&handler); pop();
setNMIExclusive(&handler); disableInterruptSources($1F);
setNMIExclusive(&successor); pop(); pop();`,
        "",
        releaseHelpers,
      ),
      target,
    );
  }, 60_000);

  // Counter reads cannot reconstruct an older write-only reload latch.
  it.each([
    ["timer A", "writeTimerALatch($1234);"],
    ["timer B", "writeTimerBLatch($5678);"],
  ])(
    "should reject a dirty inner release with an unproved prior %s latch",
    async (_name, change) => {
      await expectCia2Rejected(
        cia2Lease(
          `disableInterruptSources($1F); setNMIExclusive(&successor); ${change} restoreNMI();`,
        ),
        target,
      );
    },
    60_000,
  );

  it("should reject a dirty inner release with an unproved prior interrupt mask", async () => {
    await expectCia2Rejected(
      cia2Lease(`setNMIExclusive(&successor);
disableInterruptSources($1F); enableInterruptSources($03); restoreNMI();`),
      target,
    );
  }, 60_000);
});
