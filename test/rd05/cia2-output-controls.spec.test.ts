import { describe, expect, it } from "vitest";
import { CIA2_PROFILES, cia2Source } from "./cia2-fixture.js";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import {
  cia2FunctionVariants,
  cia2FixedCycles,
  cia2Instructions,
  cia2OperationGroups,
  expectCia2ExternalUncertainty,
  expectCia2NoPrivateHomes,
} from "./cia2-output-fixture.js";

describe.each(CIA2_PROFILES)("CIA2 unaffected output on %s", (target) => {
  // Programs without a generated NMI hook gain no vector or CIA2 transaction.
  it("should keep an empty no-hook source free of NMI installation and CIA2 effects", async () => {
    const source = cia2Source("");
    const artifacts = await buildProfileSource(source, target);
    const main = cia2FunctionVariants(artifacts, "main");
    expect(main).toHaveLength(1);
    expect(
      cia2Instructions(main[0]!.bytes).filter(
        ({ opcode, operand }) =>
          [0x85, 0x86, 0x8d, 0x8e, 0xa5, 0xa6, 0xad, 0xae, 0xcd, 0x6c].includes(opcode) &&
          operand !== null &&
          (operand === 0x0318 || operand === 0x0319 || (operand >= 0xdd00 && operand <= 0xddff)),
      ),
    ).toEqual([]);
    expect(profileRecords(artifacts.debug.functions).map(({ kind }) => kind)).toEqual(["ordinary"]);
    expect(
      profileRecords(artifacts.memory.stackDomains).filter(
        ({ id }) => typeof id === "string" && id.startsWith("nmi-entry:"),
      ),
    ).toEqual([]);
    expectCia2ExternalUncertainty(artifacts);
  }, 60_000);

  // Stock chaining preserves original P and A and leaves the stock consumer's ICR untouched.
  it("should preserve the ordinary chain ABI without consuming CIA2 pending sources", async () => {
    const source = cia2Source("setNMI(&handler); restoreNMI();", "poke($0410, 7);");
    const artifacts = await buildProfileSource(source, target);
    const variants = cia2FunctionVariants(artifacts, "handler");
    expect(variants).toHaveLength(1);
    const handler = variants[0]!;
    expect(handler.start & 0xff).toBe(0x47);
    expect(handler.bytes.subarray(0, 10)).toEqual(
      Buffer.from([0x08, 0x48, 0xd8, 0xa9, 7, 0x8d, 0x10, 0x04, 0x68, 0x28]),
    );
    expect(handler.bytes.length).toBe(13);
    expect(cia2FixedCycles(handler.bytes)).toBe(27);
    expect(handler.bytes[10]).toBe(0x6c);
    expect(handler.bytes.readUInt16LE(11) & 0xff).toBeLessThanOrEqual(0xfe);
    for (const proof of ["setNMI(&handler)", "restoreNMI()"]) {
      const groups = cia2OperationGroups(artifacts, source, proof);
      expect(groups).toHaveLength(1);
      expect(
        cia2Instructions(groups[0]!.bytes).filter(({ operand }) => operand === 0xdd0d),
      ).toEqual([]);
    }
    expectCia2NoPrivateHomes(artifacts, ["handler"]);
    expectCia2ExternalUncertainty(artifacts);
  }, 60_000);
});
