import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SourceSpan } from "../../project/types.js";
import type { AssetHandlerRequest } from "../asset-handler.js";
import { dispatchAsset } from "../asset-dispatch.js";
import { psidHandler } from "./psid.js";

const SPAN: SourceSpan = Object.freeze({ sourceId: "src/game.blend", start: 0, end: 10 });

/** Read one committed constructed fixture. */
function fixture(name = "psid-v1-fixed"): Buffer {
  return Buffer.from(
    readFileSync(
      new URL(`../../../../../test/rd06/fixtures/public/psid/${name}.sid`, import.meta.url),
    ),
  );
}

/** Build one handler request over exact bytes. */
function request(bytes: Buffer, selector: string | null = null): AssetHandlerRequest {
  return Object.freeze({
    sourceId: "src/game.blend",
    literalPath: "assets/music.sid",
    resolvedPath: "assets/music.sid",
    selector,
    owner: "resident",
    span: SPAN,
    declaration: "MUSIC",
    profileId: "c64-pal-prg-kernal-6581",
    bytes: Object.freeze([...bytes]),
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

/** Require one exact failure. */
function fails(bytes: Buffer, code = "E10204"): void {
  const result = psidHandler.parse(request(bytes));
  expect(result.kind).toBe("failure");
  if (result.kind !== "failure") throw new Error("Expected a PSID failure");
  expect(result.diagnostic.code).toBe(code);
}

describe("PSID boundary arithmetic", () => {
  // Every truncation before the declared data offset is structural.
  it("should reject a header truncated at every byte boundary", () => {
    const bytes = fixture();
    for (const length of [0, 1, 3, 4, 5, 0x0e, 0x75, 0x76]) {
      fails(bytes.subarray(0, length));
    }
  });

  // A payload shorter than the declared entry interval is rejected.
  it("should reject a payload that no longer contains its entries", () => {
    const bytes = fixture();
    for (const length of [0x76, 0x77, 0x79]) {
      fails(bytes.subarray(0, length));
    }
  });

  // A payload-supplied load address must leave at least one data byte.
  it("should reject a payload-load file with no data after the address", () => {
    const bytes = fixture("psid-v1-payload").subarray(0, 0x78);
    fails(bytes);
  });

  // A large interval below the visible BASIC ROM window remains legal.
  it("should accept a large interval clear of visible ROM windows", () => {
    const header = fixture().subarray(0, 0x76);
    header.writeUInt16BE(0x2000, 0x08);
    header.writeUInt16BE(0x2000, 0x0a);
    header.writeUInt16BE(0x2003, 0x0c);
    const bytes = Buffer.concat([header, Buffer.alloc(0x8000, 0x60)]);
    const result = psidHandler.parse(request(bytes));
    expect(result.kind).toBe("output");
  });

  // The first address past the end of the address space wraps and fails.
  it("should reject an interval ending past $FFFF", () => {
    const header = fixture().subarray(0, 0x76);
    header.writeUInt16BE(0xfffe, 0x08);
    header.writeUInt16BE(0xfffe, 0x0a);
    header.writeUInt16BE(0xfffe, 0x0c);
    fails(Buffer.concat([header, Buffer.alloc(4, 0x60)]));
  });
});

describe("PSID dispatch contract", () => {
  // The registered handler participates in the generic size and selector rules.
  it("should dispatch through the closed handler map", () => {
    const result = dispatchAsset(
      request(fixture()),
      new Map([["psid", psidHandler]]),
      new Set([".sid"]),
    );
    expect(result.kind).toBe("output");
    if (result.kind !== "output") throw new Error("Expected dispatch output");
    expect(result.handlerKey).toBe("psid");
    expect(result.resolvedSelector).toBe("data");
  });

  // An unavailable optional selector names the available inventory.
  it("should reject an unknown selector with every available name", () => {
    const result = dispatchAsset(
      request(fixture(), "audio"),
      new Map([["psid", psidHandler]]),
      new Set([".sid"]),
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected selector failure");
    expect(result.diagnostic.code).toBe("E10133");
    expect(result.diagnostic.message).toContain("'data'");
  });
});
