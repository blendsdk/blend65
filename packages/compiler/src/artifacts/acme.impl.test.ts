import { chmod, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { machineInstruction } from "../machine/lower-control.js";
import { NMOS_6510 } from "../target/nmos6510.js";
import { verifyAcmeOutput } from "./acme-output.js";
import type { AcmeSerializationResult } from "./acme-serializer.js";
import type { CompleteC64Layout } from "./acme-validate.js";
import { verifyPrg } from "./prg.js";
import { discoverAcme } from "../tools/discovery.js";

async function executable(root: string, name: string, version: string): Promise<string> {
  const path = join(root, name);
  await writeFile(path, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(version)});\n`);
  await chmod(path, 0o755);
  return path;
}

function dataLayout(): CompleteC64Layout {
  return Object.freeze({
    kind: "complete",
    intervals: Object.freeze([
      Object.freeze({
        id: "data",
        kind: "immutable" as const,
        start: 0x0801,
        end: 0x0802,
        bytes: Object.freeze([0x42, 0x65]),
      }),
    ]),
    spriteBlocks: Object.freeze([]),
    loadRange: Object.freeze({ start: 0x0801, end: 0x0802 }),
    program: Object.freeze({
      startup: Object.freeze({ id: "startup", blocks: Object.freeze([]) }),
      functions: Object.freeze([]),
      data: Object.freeze([]),
      requiredStorage: Object.freeze([]),
    }),
  });
}

describe("ACME driver hardening", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "blend65-acme-impl-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("should stop at the first PATH candidate when its version is wrong", async () => {
    const first = join(root, "first");
    const second = join(root, "second");
    await mkdir(first);
    await mkdir(second);
    await executable(first, "acme", "ACME, release 0.96\n");
    await executable(second, "acme", "ACME, release 0.97\n");

    await expect(discoverAcme({ path: `${first}:${second}` })).resolves.toEqual(
      expect.objectContaining({ kind: "error", reason: "version-mismatch" }),
    );
  });

  it("should reject relative explicit executable paths", async () => {
    await expect(discoverAcme({ explicitPath: "tools/acme" })).resolves.toEqual(
      expect.objectContaining({ kind: "error", reason: "invalid-path" }),
    );
  });

  it("should reject a release which only starts with the supported version", async () => {
    const candidate = await executable(root, "acme", "ACME, release 0.97.1\n");
    await expect(discoverAcme({ explicitPath: candidate })).resolves.toEqual(
      expect.objectContaining({ kind: "error", reason: "version-mismatch" }),
    );
  });

  it("should reject a release token with a textual suffix", async () => {
    const candidate = await executable(root, "acme", "ACME, release 0.97beta\n");
    await expect(discoverAcme({ explicitPath: candidate })).resolves.toEqual(
      expect.objectContaining({ kind: "error", reason: "version-mismatch" }),
    );
  });

  it("should reject PRG header, length, and layout-owned byte disagreement", () => {
    const layout = dataLayout();
    expect(verifyPrg(layout, Uint8Array.from([0x01, 0x08, 0x42, 0x65])).kind).toBe("complete");
    expect(verifyPrg(layout, Uint8Array.from([0x00, 0x08, 0x42, 0x65])).kind).toBe("error");
    expect(verifyPrg(layout, Uint8Array.from([0x01, 0x08, 0x42])).kind).toBe("error");
    expect(verifyPrg(layout, Uint8Array.from([0x01, 0x08, 0x42, 0x66])).kind).toBe("error");
  });

  it("should reject a same-width legal opcode which disagrees with the structured instruction", () => {
    const instruction = machineInstruction(NMOS_6510, "lda", "immediate", {
      kind: "immediate",
      value: 0x2a,
    });
    const layout: CompleteC64Layout = Object.freeze({
      kind: "complete",
      intervals: Object.freeze([
        Object.freeze({
          id: "program.code",
          kind: "code" as const,
          start: 0x0801,
          end: 0x0803,
          bytes: Object.freeze([0xa2, 0x2a, 0x60]),
        }),
      ]),
      spriteBlocks: Object.freeze([]),
      loadRange: Object.freeze({ start: 0x0801, end: 0x0803 }),
      program: Object.freeze({
        startup: Object.freeze({
          id: "startup",
          origin: 0x0801,
          blocks: Object.freeze([
            Object.freeze({
              label: "entry",
              origin: 0x0801,
              instructions: Object.freeze([instruction]),
              terminator: Object.freeze({ kind: "return" as const, opcode: "rts" as const }),
            }),
          ]),
        }),
        functions: Object.freeze([]),
        data: Object.freeze([]),
        requiredStorage: Object.freeze([]),
      }),
    });
    const serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }> =
      Object.freeze({
        kind: "complete",
        source: "",
        expectedLabels: Object.freeze([
          Object.freeze({ id: "startup", name: "b65_startup", address: 0x0801 }),
          Object.freeze({ id: "entry", name: "b65_entry", address: 0x0801 }),
        ]),
        expectedSegments: Object.freeze([
          Object.freeze({ id: "program.code", start: 0x0801, end: 0x0803 }),
        ]),
      });

    expect(
      verifyAcmeOutput({
        serialization,
        layout,
        report: Buffer.from("1 0801 a22a\n2 0803 60\n"),
        labels: Buffer.from("b65_startup = $0801\nb65_entry = $0801\n"),
        prg: Uint8Array.from([0x01, 0x08, 0xa2, 0x2a, 0x60]),
      }),
    ).toEqual(expect.objectContaining({ kind: "error" }));
  });
});
