import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import type { AssetHandlerOutput, AssetHandlerRequest } from "../asset-handler.js";
import { psidHandler } from "./psid.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 20, end: 60 });
const PAL_6581 = "c64-pal-prg-kernal-6581";
const NTSC_6581 = "c64-ntsc-prg-kernal-6581";
const PAL_8580 = "c64-pal-prg-kernal-8580";

/** Read one committed constructed fixture. */
function fixture(name: string): Buffer {
  return readFileSync(
    new URL(`../../../../../test/rd06/fixtures/public/psid/${name}.sid`, import.meta.url),
  );
}

/** Copy one fixture and apply one byte-level mutation. */
function patched(name: string, patch: (bytes: Buffer) => void): Buffer {
  const bytes = Buffer.from(fixture(name));
  patch(bytes);
  return bytes;
}

/** Build one handler request over already read bytes. */
function request(
  bytes: Buffer,
  selector: string | null = null,
  profileId: string = PAL_6581,
): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/music.sid",
    resolvedPath: "assets/music.sid",
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "MUSIC",
    profileId,
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

/** Require one accepted output. */
function output(
  name: string,
  selector: string | null = null,
  profileId = PAL_6581,
): AssetHandlerOutput {
  const result = psidHandler.parse(request(fixture(name), selector, profileId));
  expect(result.kind).toBe("output");
  if (result.kind !== "output") throw new Error(JSON.stringify(result.diagnostic));
  return result;
}

/** Require one exact failure code. */
function failure(name: string, code: string, selector: string | null = null, profileId = PAL_6581) {
  const result = psidHandler.parse(request(fixture(name), selector, profileId));
  expect(result.kind).toBe("failure");
  if (result.kind !== "failure") throw new Error("Expected a PSID failure");
  expect(result.diagnostic.code).toBe(code);
  return result.diagnostic;
}

describe("PSID container", () => {
  // Every accepted version exposes the exact payload bytes and effective entries.
  it.each([1, 2, 3, 4])("should parse version %i fixed-load data", (version) => {
    const bytes = fixture(`psid-v${version}-fixed`);
    const accepted = output(`psid-v${version}-fixed`);
    expect(accepted.resolvedSelector).toBe("data");
    const value = accepted.value;
    if (value.kind !== "embedded") throw new Error("Expected PSID data bytes");
    const dataOffset = version === 1 ? 0x76 : 0x7c;
    expect(value.bytes).toEqual([...bytes.subarray(dataOffset)]);
    expect(accepted.constraints).toEqual([
      { kind: "at", origin: "handler", addressSpaceId: "cpu16", start: 0xc000 },
    ]);
  });

  // A zero header load consumes the first two little-endian payload bytes.
  it.each([1, 2, 3, 4])("should strip the payload load address for version %i", (version) => {
    const bytes = fixture(`psid-v${version}-payload`);
    const accepted = output(`psid-v${version}-payload`);
    const value = accepted.value;
    if (value.kind !== "embedded") throw new Error("Expected PSID data bytes");
    const dataOffset = version === 1 ? 0x76 : 0x7c;
    expect(value.bytes).toEqual([...bytes.subarray(dataOffset + 2)]);
    expect(accepted.constraints[0]).toMatchObject({ kind: "at", start: 0xc000 });
  });

  // Scalar selectors expose words and own no resident bytes.
  it("should expose the init and play addresses as word scalars", () => {
    const init = output("psid-v1-fixed", "init_address");
    const play = output("psid-v1-fixed", "play_address");
    expect(init.value).toMatchObject({ kind: "embedded-scalar", value: 0xc000n });
    expect(play.value).toMatchObject({ kind: "embedded-scalar", value: 0xc003n });
    expect(init.constraints).toEqual([]);
    expect(play.constraints).toEqual([]);
  });

  // Big-endian header fields are decoded independently of the payload order.
  it("should decode every header field big-endian", () => {
    const accepted = output("psid-v2-fixed");
    expect(accepted.selectors.map(({ name }) => name)).toEqual([
      "data",
      "init_address",
      "play_address",
    ]);
    expect(output("psid-v2-fixed", "play_address").value).toMatchObject({ value: 0xc003n });
  });

  // Unknown selectors name the complete inventory.
  it("should list available selectors for an unknown name", () => {
    const diagnostic = failure("psid-v1-fixed", "E10133", "nope");
    expect(diagnostic.message).toContain("'data'");
    expect(diagnostic.message).toContain("'init_address'");
    expect(diagnostic.message).toContain("'play_address'");
  });
});

describe("PSID rejection", () => {
  it("should reject RSID magic", () => {
    const bytes = patched("psid-v1-fixed", (value) => value.write("RSID", 0, "ascii"));
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected RSID rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });

  it("should reject every unsupported version", () => {
    for (const version of [0, 5, 6]) {
      const bytes = patched("psid-v1-fixed", (value) => value.writeUInt16BE(version, 0x04));
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected version rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject a wrong data offset", () => {
    const bytes = patched("psid-v2-fixed", (value) => value.writeUInt16BE(0x76, 0x06));
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected offset rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });

  it("should reject MUS and PlaySID dependence", () => {
    for (const flag of [0x0001, 0x0002]) {
      const bytes = patched("psid-v2-fixed", (value) => value.writeUInt16BE(flag, 0x76));
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected flag rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject relocation pages", () => {
    const bytes = patched("psid-v2-fixed", (value) => {
      value[0x78] = 1;
    });
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected relocation rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });

  it("should reject zero and out-of-range play and init addresses", () => {
    for (const patch of [
      (value: Buffer) => value.writeUInt16BE(0, 0x0c),
      (value: Buffer) => value.writeUInt16BE(0xc100, 0x0c),
      (value: Buffer) => value.writeUInt16BE(0xc100, 0x0a),
    ]) {
      const bytes = patched("psid-v1-fixed", patch);
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected entry rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject payload intervals under a visible ROM window", () => {
    for (const load of [0x1000, 0xa000]) {
      const bytes = patched("psid-v1-fixed", (value) => {
        value.writeUInt16BE(load, 0x08);
        value.writeUInt16BE(load, 0x0a);
        value.writeUInt16BE(load + 3, 0x0c);
      });
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected ROM-window rejection");
      expect(result.diagnostic.code).toBe("E10261");
    }
  });

  it("should reject a load interval that wraps past $10000", () => {
    const bytes = patched("psid-v1-fixed", (value) => value.writeUInt16BE(0xfffc, 0x08));
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected wrap rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });

  it("should reject invalid song and start-song ranges", () => {
    for (const [offset, value] of [
      [0x0e, 0],
      [0x0e, 257],
      [0x10, 0],
      [0x10, 2],
    ] as const) {
      const bytes = patched("psid-v1-fixed", (patch) => patch.writeUInt16BE(value, offset));
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected song rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject every reserved flag bit for its version", () => {
    for (const [name, flag] of [
      ["psid-v2-fixed", 0x0040],
      ["psid-v2-fixed", 0x0100],
      ["psid-v2-fixed", 0x8000],
      ["psid-v3-fixed", 0x0100],
      ["psid-v3-fixed", 0x8000],
      ["psid-v4-fixed", 0x0400],
      ["psid-v4-fixed", 0x8000],
    ] as const) {
      const bytes = patched(name, (value) =>
        value.writeUInt16BE(value.readUInt16BE(0x76) | flag, 0x76),
      );
      const result = psidHandler.parse(request(bytes));
      expect(result.kind, `${name} flag ${flag.toString(16)}`).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected reserved-flag rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject reserved header address bytes", () => {
    for (const [name, offset] of [
      ["psid-v2-fixed", 0x7a],
      ["psid-v2-fixed", 0x7b],
      ["psid-v3-fixed", 0x7b],
    ] as const) {
      const bytes = patched(name, (value) => {
        value[offset] = 1;
      });
      const result = psidHandler.parse(request(bytes));
      expect(result.kind, `${name} offset ${offset.toString(16)}`).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected reserved-byte rejection");
      expect(result.diagnostic.code).toBe("E10204");
    }
  });

  it("should reject a third SID model without a third SID address", () => {
    const bytes = patched("psid-v4-fixed", (value) =>
      value.writeUInt16BE(value.readUInt16BE(0x76) | 0x0300, 0x76),
    );
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected model-address rejection");
    expect(result.diagnostic.code).toBe("E10204");
  });
});

describe("PSID compatibility", () => {
  // Declared compatibility meanings are retained rather than discarded.
  it("should retain the declared compatibility record", () => {
    const v1 = output("psid-v1-fixed");
    expect(v1.compatibility).toEqual({
      video: "unknown",
      sidModel: "unknown",
      secondSid: false,
      thirdSid: false,
      songs: 1,
      startSong: 1,
    });
    const v2 = output("psid-v2-fixed");
    expect(v2.compatibility).toMatchObject({ video: "PAL", sidModel: "6581" });
    const both = patched("psid-v2-fixed", (value) => value.writeUInt16BE(0x003c, 0x76));
    const result = psidHandler.parse(request(both));
    expect(result.kind).toBe("output");
    if (result.kind !== "output") throw new Error("Expected both compatibility");
    expect(result.compatibility).toMatchObject({ video: "both", sidModel: "both" });
  });

  it("should accept an unknown compatibility set on every profile", () => {
    const bytes = patched("psid-v2-fixed", (value) => value.writeUInt16BE(0, 0x76));
    expect(psidHandler.parse(request(bytes, null, PAL_6581)).kind).toBe("output");
    expect(psidHandler.parse(request(bytes, null, NTSC_6581)).kind).toBe("output");
    expect(psidHandler.parse(request(bytes, null, PAL_8580)).kind).toBe("output");
  });

  it("should reject a specific incompatible video standard", () => {
    expect(failure("psid-v2-fixed", "E10261", null, NTSC_6581).message).toMatch(/PAL|NTSC/u);
  });

  it("should reject a specific incompatible SID model", () => {
    expect(failure("psid-v2-fixed", "E10261", null, PAL_8580).message).toMatch(/6581|8580/u);
  });

  it("should reject second and third SID endpoints on the one-SID profile", () => {
    const second = patched("psid-v3-fixed", (value) => {
      value[0x7a] = 1;
    });
    const third = patched("psid-v4-fixed", (value) => {
      value[0x7b] = 1;
    });
    for (const bytes of [second, third]) {
      const result = psidHandler.parse(request(bytes));
      expect(result.kind).toBe("failure");
      if (result.kind !== "failure") throw new Error("Expected topology rejection");
      expect(result.diagnostic.code).toBe("E10261");
    }
  });
});
