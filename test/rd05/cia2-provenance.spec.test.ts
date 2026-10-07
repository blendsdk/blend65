import { describe, it } from "vitest";
import {
  CIA2_PROFILES,
  cia2Lease,
  cia2Source,
  expectCia2Accepted,
  expectCia2Rejected,
} from "./cia2-fixture.js";

/** Timer, mask and control registers recur in every sixteen-byte CIA2 mirror. */
const rawDeviceWrites = Array.from({ length: 16 }, (_unused, mirror) =>
  [4, 5, 6, 7, 13, 14, 15].map((offset) => {
    const address = `$${(0xdd00 + mirror * 16 + offset).toString(16).toUpperCase()}`;
    return [address, `poke(${address}, 0);`] as const;
  }),
).flat();

describe.each(CIA2_PROFILES)("CIA2 handback provenance on %s", (target) => {
  // Raw device state is expressible but cannot certify a typed stock handback.
  it.each(rawDeviceWrites)(
    "should reject typed final handback after a raw write to %s",
    async (_address, write) => {
      await expectCia2Rejected(cia2Lease(`disableInterruptSources($1F); ${write}`), target);
    },
    60_000,
  );

  it.each(["$DD03", "$DD05", "$DD0C", "$DD0F", "$DDFC", "$DDFE"])(
    "should reject a raw word write overlapping owned device state at %s",
    async (address) => {
      await expectCia2Rejected(
        cia2Lease(`disableInterruptSources($1F); pokew(${address}, $1234);`),
        target,
      );
    },
    60_000,
  );

  // The firmware RS-232 enable byte is part of the qualified idle predecessor provenance.
  it.each(["poke($02A1, 1);", "pokew($02A0, $0100);"])(
    "should reject final handback after firmware-enable mutation %s",
    async (write) => {
      await expectCia2Rejected(cia2Lease(`disableInterruptSources($1F); ${write}`), target);
    },
    60_000,
  );

  // A known zero write preserves the qualified firmware-enable fact.
  it.each(["poke($02A1, 0);", "pokew($02A1, 0);"])(
    "should preserve idle firmware provenance after the proved zero write %s",
    async (write) => {
      await expectCia2Accepted(cia2Lease(`disableInterruptSources($1F); ${write}`), target);
    },
    60_000,
  );

  // Clearing ENABL cannot reconstruct device state after an unproved firmware epoch.
  it("should reject final handback after firmware was enabled and later cleared", async () => {
    await expectCia2Rejected(
      cia2Lease("disableInterruptSources($1F); poke($02A1, 1); poke($02A1, 0);"),
      target,
    );
  }, 60_000);

  // Proven-disjoint writes must not become a broad raw-memory prohibition.
  it.each(["$0400", "$02A0", "$02A2", "$DD08", "$DD09", "$DD0A", "$DD0B"])(
    "should preserve typed handback after a disjoint byte write to %s",
    async (address) => {
      await expectCia2Accepted(
        cia2Lease(`disableInterruptSources($1F); poke(${address}, 0);`),
        target,
      );
    },
    60_000,
  );

  // Raw vector writers invalidate the compiler-owned LIFO lifecycle.
  it.each(["$0318", "$0319"])(
    "should reject restore after a raw vector write to %s",
    async (address) => {
      await expectCia2Rejected(cia2Lease(`poke(${address}, 0);`), target);
    },
    60_000,
  );

  it("should reject an ordinary RTS function at the exclusive handler sink", async () => {
    await expectCia2Rejected(
      cia2Source("setNMIExclusive(&ordinary); restoreNMI();", "", "function ordinary(): void {}"),
      target,
      "E10244",
    );
  }, 60_000);

  it("should reject an erased handler address at the exclusive sink", async () => {
    await expectCia2Rejected(
      cia2Source("setNMIExclusive(word(&handler)); restoreNMI();"),
      target,
      "E10247",
    );
  }, 60_000);
});
