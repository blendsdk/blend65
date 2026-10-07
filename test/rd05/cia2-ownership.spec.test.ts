import { describe, it } from "vitest";
import {
  CIA2_PROFILES,
  cia2Lease,
  cia2Source,
  expectCia2Accepted,
  expectCia2Rejected,
} from "./cia2-fixture.js";

/** Device configuration is ordinary source code; the pending bitset has two independent tests. */
const configuredLease = `disableInterruptSources($1F);
writeTimerALatch($1234); writeTimerBLatch($5678);
configureTimerA($19); configureTimerB($49); enableInterruptSources($03);
let pending: byte = readAndClearPendingSources();
if ((pending & $01) != 0) { poke($0410, 1); }
if ((pending & $02) != 0) { poke($0411, 1); }`;

/** Every mutation and consuming read needs an actual exclusive device owner. */
const ownedOperations = [
  ["timer A latch", "writeTimerALatch($1234);"],
  ["timer B latch", "writeTimerBLatch($5678);"],
  ["timer A control", "configureTimerA($19);"],
  ["timer B control", "configureTimerB($49);"],
  ["interrupt enable", "enableInterruptSources($03);"],
  ["interrupt disable", "disableInterruptSources($1F);"],
  ["pending-source consumption", "poke($0410, readAndClearPendingSources());"],
] as const;

describe.each(CIA2_PROFILES)("CIA2 admission on %s", (target) => {
  // Owning all NMI behavior does not require an invocation-private frame.
  it("should admit an empty balanced exclusive NMI lease", async () => {
    await expectCia2Accepted(cia2Lease(""), target);
  }, 60_000);

  // Mainline storage may hold the returned bitset without creating NMI private homes.
  it("should admit typed mainline timers and independent pending-bit branches", async () => {
    await expectCia2Accepted(cia2Lease(configuredLease), target);
  }, 60_000);

  describe.each(ownedOperations)("unowned %s", (_name, operation) => {
    it("should reject the operation in ordinary mainline code", async () => {
      await expectCia2Rejected(cia2Source(operation), target);
    }, 60_000);

    it("should reject the operation through an unowned ordinary helper", async () => {
      await expectCia2Rejected(
        cia2Source("useDevice();", "", `function useDevice(): void { ${operation} }`),
        target,
      );
    }, 60_000);

    it("should reject the operation in a callback chained to stock KERNAL", async () => {
      await expectCia2Rejected(cia2Source("setNMI(&handler); restoreNMI();", operation), target);
    }, 60_000);
  });

  // Observing a counter neither changes a write-only latch nor consumes an interrupt.
  it("should allow both counter observations without an NMI lease", async () => {
    await expectCia2Accepted(
      cia2Source("pokew($0410, readTimerACounter()); pokew($0412, readTimerBCounter());"),
      target,
    );
  }, 60_000);

  it("should allow unowned counter observations through an ordinary helper", async () => {
    await expectCia2Accepted(
      cia2Source(
        "observe();",
        "",
        "function observe(): void { pokew($0410, readTimerACounter()); pokew($0412, readTimerBCounter()); }",
      ),
      target,
    );
  }, 60_000);

  it("should allow counter observations in a stock-chained callback", async () => {
    await expectCia2Accepted(
      cia2Source("setNMI(&handler); restoreNMI();", "readTimerACounter(); readTimerBCounter();"),
      target,
    );
  }, 60_000);

  // Constants outside the documented timer fields are errors, even with a real lease.
  it.each([
    ["timer A", "configureTimerA($20);"],
    ["timer B", "configureTimerB($20);"],
    ["interrupt sources", "disableInterruptSources($1F); enableInterruptSources($10);"],
    ["interrupt disable", "disableInterruptSources($20);"],
  ])(
    "should reject known unsupported bits for %s",
    async (_name, operation) => {
      await expectCia2Rejected(cia2Lease(operation), target);
    },
    60_000,
  );

  // An unreadable mask becomes known only after a complete clear or equivalent proved state.
  it.each([
    ["no initialization", ""],
    ["a partial clear", "disableInterruptSources($01);"],
    ["a dynamic clear", "disableInterruptSources(peek($0400));"],
  ])(
    "should reject enabling a source after %s",
    async (_name, initialization) => {
      await expectCia2Rejected(cia2Lease(`${initialization} enableInterruptSources($01);`), target);
    },
    60_000,
  );

  // Dynamic arguments retain their existing bounded operation semantics in mainline code.
  it("should admit dynamic mainline flags after full mask initialization", async () => {
    await expectCia2Accepted(
      cia2Lease(`disableInterruptSources($1F);
configureTimerA(peek($0400)); configureTimerB(peek($0401));
enableInterruptSources(peek($0402)); disableInterruptSources(peek($0403));`),
      target,
    );
  }, 60_000);

  it("should admit typed device operations through a helper owned by its caller", async () => {
    await expectCia2Accepted(
      cia2Lease(
        "configureDevice();",
        "",
        `function configureDevice(): void { ${configuredLease} }`,
      ),
      target,
    );
  }, 60_000);

  // A chain forwarding to an exclusive owner still cannot consume that owner's pending bits.
  it("should reject consuming pending sources in a chain above an exclusive owner", async () => {
    const source = cia2Source(
      "setNMIExclusive(&successor); setNMI(&handler); restoreNMI(); restoreNMI();",
      "poke($0410, readAndClearPendingSources());",
    );
    await expectCia2Rejected(source, target);
  }, 60_000);

  // Non-consuming mutations belong to the downstream device owner, so the chain's pop is clean.
  it("should charge chained callback mutations to its downstream exclusive owner", async () => {
    await expectCia2Accepted(
      cia2Source(
        `setNMIExclusive(&successor); disableInterruptSources($1F);
setNMI(&handler); restoreNMI(); restoreNMI();`,
        `writeTimerALatch($1234); writeTimerBLatch($5678);
configureTimerA($19); configureTimerB($49);
enableInterruptSources($03); disableInterruptSources($1F);`,
      ),
      target,
    );
  }, 60_000);
});
