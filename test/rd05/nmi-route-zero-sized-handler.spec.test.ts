import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";

const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
] as const;

describe.sequential.each(profiles)(
  "zero-sized locals in cooperative NMI handlers on %s",
  (profile) => {
    it.each([
      ["uninitialized", "let empty: byte[0];"],
      ["initialized", "let empty: byte[0] = [];"],
    ])(
      "chains an %s empty local without activation-private bytes or a wrapper",
      async (_, declaration) => {
        // An empty array owns no data bytes and therefore introduces no handler-private state.
        const source = `module Game;
import { setNMI, restoreNMI } from c64.system;
interrupt function handler(): void {
  ${declaration}
}
function main(): void { setNMI(&handler); restoreNMI(); }`;
        const artifacts = await buildProfileSource(source, profile);
        expect(artifacts.memory).toMatchObject({
          kind: "blend65.memory",
          schemaVersion: 1,
          profileId: profile,
          acmeReconciled: true,
        });
        const intervals = profileRecords(artifacts.memory.intervals).map((interval) => {
          const { start, end } = interval;
          if (
            typeof start !== "number" ||
            typeof end !== "number" ||
            !Number.isInteger(start) ||
            !Number.isInteger(end) ||
            start < 0 ||
            end <= start ||
            end > 0x10000
          )
            throw new Error("Expected a nonempty half-open physical byte interval");
          expect(interval.size).toBe(end - start);
          return { ...interval, start, end };
        });
        const code = intervals.filter((interval) => {
          const owner = profileRecord(interval.owner);
          return (
            interval.kind === "code" &&
            owner.kind === "function" &&
            owner.id === "src/game.blend::Game.handler"
          );
        });
        expect(code).toHaveLength(1);
        const handler = code[0];
        if (handler === undefined) throw new Error("Missing complete handler code interval");
        expect(handler.end - handler.start).toBe(3);
        expect(artifacts.prg.length).toBeGreaterThanOrEqual(2);
        const loadAddress = artifacts.prg.readUInt16LE(0);
        const offset = 2 + handler.start - loadAddress;
        expect(offset).toBeGreaterThanOrEqual(2);
        expect(offset + 3).toBeLessThanOrEqual(artifacts.prg.length);
        const bytes = artifacts.prg.subarray(offset, offset + 3);
        // A complete private-free entry chains directly: JMP (saved predecessor), with no A/X/Y/D wrapper.
        expect(bytes[0]).toBe(0x6c);
        const pointer = bytes.readUInt16LE(1);
        expect(pointer & 0xff).toBeLessThanOrEqual(0xfe);
        const storage = intervals.filter((interval) =>
          ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
        );
        // Only the immutable two-byte installation link remains; the empty local owns no byte.
        expect(storage.reduce((total, interval) => total + interval.end - interval.start, 0)).toBe(
          2,
        );
        expect(
          storage.filter((interval) => interval.start <= pointer && interval.end >= pointer + 2),
        ).toHaveLength(1);

        expect(artifacts.debug).toMatchObject({
          kind: "blend65.debug",
          schemaVersion: 1,
          profileId: profile,
          optimization: "none",
        });
        const ranges = profileRecords(artifacts.debug.ranges);
        const entries = profileRecords(artifacts.debug.functions)
          .flatMap((fn) => profileRecords(fn.entryVariants))
          .filter((entry) => {
            if (!Array.isArray(entry.rangeIndexes)) throw new Error("Missing entry range indexes");
            return entry.rangeIndexes.some((index: unknown) => {
              if (typeof index !== "number" || !Number.isInteger(index))
                throw new Error("Expected an integral debug range index");
              const machine = profileRecord(ranges[index]?.machine);
              return machine.start === handler.start && machine.end === handler.end;
            });
          });
        expect(entries).toHaveLength(1);
        const entry = entries[0];
        if (entry === undefined || typeof entry.id !== "string")
          throw new Error("Missing selected handler entry identity");
        const stack = profileRecords(artifacts.memory.stackDomains).filter(
          (row) => row.id === `nmi-entry:${entry.id}`,
        );
        // This is a per-entry CPU frame, distinct from an unproved whole-program external stack peak.
        expect(stack).toHaveLength(1);
        expect(stack[0]).toMatchObject({ capacityBytes: 236, peakBytes: 3, headroomBytes: 233 });
        expect((stack[0]!.route as string[]).slice(0, 2)).toEqual([
          "per-entry:generated-nmi",
          entry.id,
        ]);
        const payload = artifacts.prg.length - 2;
        expect(profileRecord(artifacts.costs.totals).programBytes).toBe(payload);
        const pieces = profileRecords(artifacts.costs.entries).filter(
          (entry) => entry.kind === "bytes" && entry.accounting === "program",
        );
        expect(pieces.length).toBeGreaterThan(0);
        expect(pieces.reduce((total, entry) => total + Number(entry.bytes), 0)).toBe(payload);
      },
    );
  },
);
