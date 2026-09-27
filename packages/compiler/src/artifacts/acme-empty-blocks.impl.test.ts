import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { machineInstruction } from "../machine/lower-control.js";
import type { MachineFunction } from "../machine/machine-types.js";
import { selectTargetProfile } from "../target/profile.js";
import { runAcme } from "../tools/acme.js";
import { discoverAcme } from "../tools/discovery.js";
import { serializeAcme } from "./acme-serializer.js";
import type { AcmeSerializationInput } from "./acme-serializer.js";

const basicBytes = [0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00];
// Independent NMOS bytes: LDA #$11; RTS; RTS; LDA #$22; RTS.
const codeBytes = [0xa9, 0x11, 0x60, 0x60, 0xa9, 0x22, 0x60];
const expectedAddresses = {
  "basic.stub": 0x0801,
  startup: 0x080d,
  "startup.entry": 0x080d,
  "startup.restore": 0x0811,
  owner: 0x0810,
  "owner.entry": 0x0810,
  "owner.empty-first": 0x0811,
  "owner.empty-second": 0x0811,
  tail: 0x0813,
  "tail.entry": 0x0813,
  markers: 0x0810,
  "markers.entry": 0x0810,
  "markers.tail": 0x0813,
};

/** Build a tiny final layout with address-only markers sharing instruction and return origins. */
function fixture(reverse: boolean): AcmeSerializationInput {
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Expected the admitted C64 target");
  const profile = selected.profile;
  const functions: MachineFunction[] = [
    {
      id: "owner",
      origin: 0x0810,
      blocks: [
        { label: "owner.entry", origin: 0x0810, instructions: [], terminator: { kind: "return" } },
        {
          label: "owner.empty-first",
          origin: 0x0811,
          instructions: [],
          terminator: { kind: "fallthrough", target: "startup.restore" },
        },
        {
          label: "owner.empty-second",
          origin: 0x0811,
          instructions: [],
          terminator: { kind: "unreachable" },
        },
      ],
    },
    {
      id: "tail",
      origin: 0x0813,
      blocks: [
        { label: "tail.entry", origin: 0x0813, instructions: [], terminator: { kind: "return" } },
      ],
    },
    {
      id: "markers",
      origin: 0x0810,
      blocks: [
        {
          label: "markers.entry",
          origin: 0x0810,
          instructions: [],
          terminator: { kind: "fallthrough", target: "owner.entry" },
        },
        {
          label: "markers.tail",
          origin: 0x0813,
          instructions: [],
          terminator: { kind: "fallthrough", target: "tail.entry" },
        },
      ],
    },
  ];
  return {
    profile,
    certificate: {
      inventoryHash: "inventory",
      graphHash: "graph",
      profileId: profile.id,
      homes: [],
      interference: [],
      helperCalls: [],
      staticBytes: { ram: 0, zeroPage: 0 },
      peakBytes: { ram: 0, zeroPage: 0 },
      hardwareStackPeak: 2,
      closed: true,
    },
    layout: {
      kind: "complete",
      intervals: [
        { id: "basic.stub", kind: "stub", start: 0x0801, end: 0x080c, bytes: basicBytes },
        { id: "program.code", kind: "code", start: 0x080d, end: 0x0813, bytes: codeBytes },
      ],
      spriteBlocks: [],
      loadRange: { start: 0x0801, end: 0x0813 },
      program: {
        startup: {
          id: "startup",
          origin: 0x080d,
          blocks: [
            {
              label: "startup.entry",
              origin: 0x080d,
              instructions: [
                machineInstruction(profile.cpu, "lda", "immediate", {
                  kind: "immediate",
                  value: 0x11,
                }),
              ],
              terminator: { kind: "return" },
            },
            {
              label: "startup.restore",
              origin: 0x0811,
              instructions: [
                machineInstruction(profile.cpu, "lda", "immediate", {
                  kind: "immediate",
                  value: 0x22,
                }),
              ],
              terminator: { kind: "fallthrough", target: "tail.entry" },
            },
          ],
        },
        functions: reverse ? functions.reverse() : functions,
        data: [],
        requiredStorage: [],
      },
    },
  };
}

describe("ACME address-only block ordering", () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blend65-empty-blocks-"));
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it.each([false, true])(
    "should preserve exact bytes and labels with reversed enumeration=%s",
    async (reverse) => {
      const input = fixture(reverse);
      const before = structuredClone(input);
      const serialization = serializeAcme(input);
      expect(serialization.kind).toBe("complete");
      if (serialization.kind !== "complete") throw new Error(serialization.diagnostic);
      expect(serializeAcme(input)).toEqual(serialization);
      expect(input).toEqual(before);
      expect(
        Object.fromEntries(serialization.expectedLabels.map(({ id, address }) => [id, address])),
      ).toEqual(expectedAddresses);
      expect(serialization.expectedSegments).toEqual([
        { id: "basic.stub", start: 0x0801, end: 0x080c },
        { id: "program.code", start: 0x080d, end: 0x0813 },
      ]);
      // Both empty terminator kinds retain their order ahead of the instruction-bearing block.
      expect(
        serialization.expectedLabels
          .filter(({ address }) => address === 0x0811)
          .map(({ id }) => id),
      ).toEqual(["owner.empty-first", "owner.empty-second", "startup.restore"]);
      const discovered = await discoverAcme();
      if (discovered.kind !== "complete") throw new Error("Real ACME is required");
      const result = await runAcme({
        tool: discovered.tool,
        stagingDirectory: join(root, "staging"),
        artifactName: "markers",
        serialization,
        layout: input.layout,
      });
      expect(result.kind, JSON.stringify(result)).toBe("complete");
      expect([...(await readFile(join(root, "staging/markers.prg")))]).toEqual([
        1,
        8,
        ...basicBytes,
        ...codeBytes,
      ]);
      const labels = await readFile(join(root, "staging/.labels"), "utf8");
      const actual = new Map(
        [...labels.matchAll(/^\s*(\S+)\s*=\s*\$([0-9a-f]+)/gimu)].map((match) => [
          match[1]!,
          Number.parseInt(match[2]!, 16),
        ]),
      );
      const expected = new Map(Object.entries(expectedAddresses));
      for (const { id, name } of serialization.expectedLabels)
        expect(actual.get(name), id).toBe(expected.get(id));
    },
  );

  it("should keep strict ACME rejection for two genuinely overlapping byte-emitting blocks", async () => {
    const input = fixture(false);
    const functions = input.layout.program.functions.map((fn) =>
      fn.id !== "owner"
        ? fn
        : {
            ...fn,
            origin: 0x0811,
            blocks: fn.blocks.map((block) => ({ ...block, origin: 0x0811 })),
          },
    );
    const layout = { ...input.layout, program: { ...input.layout.program, functions } };
    const serialization = serializeAcme({ ...input, layout });
    if (serialization.kind !== "complete") throw new Error(serialization.diagnostic);
    const discovered = await discoverAcme();
    if (discovered.kind !== "complete") throw new Error("Real ACME is required");
    const result = await runAcme({
      tool: discovered.tool,
      stagingDirectory: join(root, "overlap"),
      artifactName: "overlap",
      serialization,
      layout,
    });
    expect(result).toEqual(expect.objectContaining({ kind: "error", reason: "process" }));
  });
});
