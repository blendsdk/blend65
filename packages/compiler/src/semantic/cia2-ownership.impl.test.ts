import { describe, expect, it } from "vitest";
import { selectTargetProfile } from "../target/profile.js";
import type { PlatformOperation, MemoryWriteOperation } from "./operations.js";
import type { SelectedEntry, VectorState } from "./interrupt-context-facts.js";
import {
  INITIAL_CIA2_FACTS,
  cia2FactsKey,
  mutateCia2Owner,
  rawCia2Effect,
} from "./cia2-ownership-facts.js";
import {
  applyCia2Operation,
  applyCia2RawWrite,
  cia2DeviceOwner,
  installCia2Lease,
  releaseCia2Lease,
} from "./cia2-ownership.js";

/** One evaluated source operation; local transitions do not evaluate arguments. */
function operation(name: string): PlatformOperation {
  return {
    kind: "platform",
    capability: `c64.cia2.${name}`,
    arguments: [],
    result: null,
    type: { kind: "scalar", name: "void" },
    effect: "volatile-write",
    span: { sourceId: "src/game.blend", start: 10, end: 20 },
  };
}

/** The physical binding and real selected profile identify the device owner. */
function selected(exclusive: boolean, slot: string): SelectedEntry {
  const target = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (target.kind !== "complete") throw new Error("Missing test profile");
  const capability = exclusive ? "c64.system.setNMIExclusive" : "c64.system.setNMI";
  const sink = target.profile.interrupts.sinks.find((entry) => entry.capability === capability)!;
  const variant = target.profile.interrupts.variants.find((entry) => entry.id === sink.variant)!;
  const span = operation("install").span;
  return {
    id: slot,
    route: {
      sink,
      variant,
      handler: { sourceId: span.sourceId, span },
      installation: { ...operation("install"), capability },
    },
    context: { domain: "nmi", irq: 0, nmi: 1, entrySlot: slot },
    ...(exclusive ? {} : { tail: slot }),
  };
}

/** Keep chain continuations separate from the actual downstream physical lease. */
function state(chain = false): Pick<VectorState, "vectors" | "words"> {
  const owner = selected(true, "owner");
  return {
    vectors: { irq: null, nmi: chain ? selected(false, "chain") : owner },
    words: new Map(chain ? [["chain", { entry: owner, path: [] }]] : []),
  };
}

/** Start a clean finite lease without claiming the unreadable hardware mask is known. */
function owned() {
  return installCia2Lease(INITIAL_CIA2_FACTS, "owner", true, true, operation("install")).facts;
}

/** A raw byte or word store has ordinary low-first, volatile source semantics. */
function raw(width: 1 | 2 = 1): MemoryWriteOperation {
  return {
    kind: "memory-write",
    address: "address",
    value: "value",
    width,
    byteOrder: "low-first",
    volatile: true,
    span: operation("raw").span,
  };
}

describe("finite CIA2 device facts", () => {
  it("should compare physical leases by value rather than insertion order", () => {
    const first = installCia2Lease(owned(), "inner", true, false, operation("install")).facts;
    expect(cia2FactsKey(first)).toBe(
      cia2FactsKey({
        ...first,
        leases: new Map([...first.leases].reverse()),
      }),
    );
    for (const changed of [
      { ...first, idleStock: false },
      { ...first, maskKnown: true },
      { ...first, maskExact: true },
      { ...first, possibleSources: 0 },
      mutateCia2Owner(first, "inner", "typed", true),
    ])
      expect(cia2FactsKey(changed)).not.toBe(cia2FactsKey(first));
  });

  it.each(Array.from({ length: 16 }, (_, mirror) => mirror))(
    "should invalidate every known timer/mask/control mirror in window %i",
    (mirror) => {
      for (const register of [4, 5, 6, 7, 13, 14, 15]) {
        const address = BigInt(0xdd00 + mirror * 16 + register);
        expect(rawCia2Effect(raw(), address, 0n)).toEqual({ device: true, firmware: false });
      }
      for (const register of [0, 1, 2, 3, 8, 9, 10, 11, 12]) {
        const address = BigInt(0xdd00 + mirror * 16 + register);
        expect(rawCia2Effect(raw(), address, 0n).device).toBe(false);
      }
    },
  );

  it("should account for word overlaps and the written firmware-enable byte", () => {
    expect(rawCia2Effect(raw(2), 0xdd03n, 0n).device).toBe(true);
    expect(rawCia2Effect(raw(2), 0xdd02n, 0n).device).toBe(false);
    expect(rawCia2Effect(raw(2), 0x02a0n, 0x00ffn).firmware).toBe(false);
    expect(rawCia2Effect(raw(2), 0x02a0n, 0x0100n).firmware).toBe(true);
    expect(rawCia2Effect(raw(2), 0x02a1n, 0xff00n).firmware).toBe(false);
    expect(rawCia2Effect(raw(), 0x02a1n, undefined).firmware).toBe(true);
    expect(rawCia2Effect(raw(), undefined, undefined)).toEqual({ device: false, firmware: false });
  });

  it("should require a full typed mask clear before enabling a source", () => {
    const enable = operation("enableInterruptSources");
    expect(applyCia2Operation(owned(), state(), undefined, enable, 1n).diagnostic?.code).toBe(
      "E10278",
    );
    for (const bits of [1n, undefined]) {
      const partial = applyCia2Operation(
        owned(),
        state(),
        undefined,
        operation("disableInterruptSources"),
        bits,
      ).facts;
      expect(partial.maskKnown).toBe(false);
    }
    const clear = applyCia2Operation(
      owned(),
      state(),
      undefined,
      operation("disableInterruptSources"),
      0x1fn,
    ).facts;
    expect(clear).toMatchObject({ maskKnown: true, maskExact: true, possibleSources: 0 });
    const dynamic = applyCia2Operation(clear, state(), undefined, enable, undefined).facts;
    expect(dynamic).toMatchObject({ maskKnown: true, maskExact: false, possibleSources: 3 });
  });

  it("should charge a chained mutation to the downstream exclusive owner without stealing ICR", () => {
    expect(cia2DeviceOwner(state(true))).toBe("owner");
    const entry = state(true).vectors.nmi!;
    const write = applyCia2Operation(
      owned(),
      state(true),
      entry,
      operation("writeTimerALatch"),
      1n,
    );
    expect(write.diagnostic).toBeNull();
    expect(write.facts.leases.get("owner")).toMatchObject({
      mutation: "typed",
      timerChanged: true,
    });
    expect(
      applyCia2Operation(
        write.facts,
        state(true),
        entry,
        operation("readAndClearPendingSources"),
        undefined,
      ).diagnostic?.code,
    ).toBe("E10278");
    expect(
      applyCia2Operation(
        write.facts,
        state(),
        undefined,
        operation("readAndClearPendingSources"),
        undefined,
      ).diagnostic,
    ).toBeNull();
  });

  it("should accept only an exactly restored inner mask without timer or raw changes", () => {
    const clear = applyCia2Operation(
      owned(),
      state(),
      undefined,
      operation("disableInterruptSources"),
      0x1fn,
    ).facts;
    const inner = installCia2Lease(clear, "inner", true, false, operation("install")).facts;
    const mutated = mutateCia2Owner(inner, "inner", "typed");
    expect(releaseCia2Lease(mutated, "inner", false, operation("restore")).diagnostic).toBeNull();
    for (const dirty of [
      { ...mutated, maskExact: false },
      { ...mutated, possibleSources: 1 },
      mutateCia2Owner(mutated, "inner", "typed", true),
      mutateCia2Owner(mutated, "inner", "raw"),
    ])
      expect(releaseCia2Lease(dirty, "inner", false, operation("restore")).diagnostic?.code).toBe(
        "E10278",
      );
  });

  it("should preserve mutation history when an equal live capture reuses its physical word", () => {
    const dirty = mutateCia2Owner(owned(), "owner", "typed", true);
    expect(installCia2Lease(dirty, "owner", true, true, operation("install")).facts).toBe(dirty);
    const released = releaseCia2Lease(dirty, "owner", true, operation("restore"));
    expect(released).toMatchObject({ diagnostic: null, stockHandback: true });
    expect(released.facts.leases.size).toBe(0);
    expect(released.facts).toMatchObject({ maskKnown: true, maskExact: true, possibleSources: 0 });
  });

  it("should retain a suspended physical lease until its final reader ends", () => {
    const dirty = mutateCia2Owner(owned(), "owner", "typed", true);
    const inner = releaseCia2Lease(dirty, "owner", true, operation("restore"), true);
    expect(inner.diagnostic).toBeNull();
    expect(inner.facts.leases.get("owner")).toEqual(dirty.leases.get("owner"));
    const reused = installCia2Lease(inner.facts, "owner", true, true, operation("install"));
    expect(reused.facts).toBe(inner.facts);
    const final = releaseCia2Lease(reused.facts, "owner", true, operation("restore"));
    expect(final.diagnostic).toBeNull();
    expect(final.facts.leases.has("owner")).toBe(false);
    const rawHistory = mutateCia2Owner(dirty, "owner", "raw");
    expect(
      releaseCia2Lease(rawHistory, "owner", true, operation("restore"), true).diagnostic?.code,
    ).toBe("E10278");
  });

  it("should never recover raw history or idle provenance from a later typed clear", () => {
    const damaged = applyCia2RawWrite(owned(), state(), raw(), 0xdd0dn, 0n);
    const clear = applyCia2Operation(
      damaged,
      state(),
      undefined,
      operation("disableInterruptSources"),
      0x1fn,
    ).facts;
    expect(clear.leases.get("owner")?.mutation).toBe("raw");
    expect(clear.idleStock).toBe(false);
    expect(releaseCia2Lease(clear, "owner", true, operation("restore")).diagnostic?.code).toBe(
      "E10278",
    );
    expect(
      installCia2Lease(
        { ...INITIAL_CIA2_FACTS, idleStock: false },
        "owner",
        true,
        true,
        operation("install"),
      ).diagnostic?.code,
    ).toBe("E10278");
  });
});
