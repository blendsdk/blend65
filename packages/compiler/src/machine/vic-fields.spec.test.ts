import { describe, expect, it } from "vitest";
import { vicConsumerBytes, vicFieldValue } from "./vic-fields.js";

describe("VIC field constants", () => {
  // Each field derives from the bank-relative address exactly as the hardware reads it.
  it.each([
    ["vic-sprite-block", 0x2000, 0x80],
    ["vic-charset-select", 0x2800, 0x0a],
    ["vic-bitmap-select", 0x2000, 0x08],
    ["vic-screen-select", 0x0c00, 0x30],
  ] as const)("should derive %s at $%s", (transform, address, expected) => {
    expect(vicFieldValue(transform, address, 0)).toBe(expected);
  });

  // Misalignment, out-of-bank and missing visibility fail closed.
  it("should reject misaligned, out-of-bank and character-ROM addresses", () => {
    expect(vicFieldValue("vic-bitmap-select", 0x2001, 0)).toBeNull();
    expect(vicFieldValue("vic-screen-select", 0x4000, 0)).toBeNull();
    expect(vicFieldValue("vic-screen-select", 0x1000, 0, 0x1000, 0x1fff)).toBeNull();
    expect(vicFieldValue("vic-charset-select", 0x1800, 0, 0x1000, 0x1fff)).toBeNull();
    expect(vicFieldValue("vic-bitmap-select", 0x0000, 0, 0x1000, 0x1fff)).toBeNull();
  });

  // Each transform consumes the exact object size the field implies.
  it("should expose the consumer size of every transform", () => {
    expect(vicConsumerBytes("vic-sprite-block")).toBe(64);
    expect(vicConsumerBytes("vic-charset-select")).toBe(2048);
    expect(vicConsumerBytes("vic-bitmap-select")).toBe(8000);
    expect(vicConsumerBytes("vic-screen-select")).toBe(1000);
  });
});
