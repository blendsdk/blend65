import { describe, expect, it } from "vitest";

import { createUtf8ByteBoundaryIndex } from "./utf8-byte-boundaries.js";

describe("compact UTF-8 byte boundaries", () => {
  it("should validate every legal width and expose exact byte boundaries", () => {
    const bytes = Uint8Array.from([0x41, 0xc2, 0xa2, 0xe2, 0x82, 0xac, 0xf0, 0x90, 0x8d, 0x88]);
    const boundaries = createUtf8ByteBoundaryIndex(bytes);

    expect(boundaries).toBeDefined();
    expect(boundaries === undefined ? [] : [...boundaries]).toEqual([0, 1, 3, 6, 10]);
    expect(boundaries?.atOrBefore(9)).toBe(6);
    expect(boundaries?.atOrAfter(7)).toBe(10);
  });

  it("should reject overlong, surrogate, out-of-range, continuation, and truncated sequences", () => {
    for (const bytes of [
      [0xc0, 0x80],
      [0xe0, 0x80, 0x80],
      [0xed, 0xa0, 0x80],
      [0xf0, 0x80, 0x80, 0x80],
      [0xf4, 0x90, 0x80, 0x80],
      [0x80],
      [0xf0, 0x9f, 0x91],
    ]) {
      expect(createUtf8ByteBoundaryIndex(Uint8Array.from(bytes))).toBeUndefined();
    }
  });

  it("should index a one-mebibyte shallow source without per-code-point objects", () => {
    const bytes = new Uint8Array(1_048_576).fill(0x61);
    const boundaries = createUtf8ByteBoundaryIndex(bytes);

    expect(boundaries?.size).toBe(1_048_577);
    expect(boundaries?.has(524_288)).toBe(true);
    expect(boundaries?.has(1_048_576)).toBe(true);
  });

  it("should not reuse a public index after caller-owned bytes mutate", () => {
    const bytes = Uint8Array.from([0x61, 0x62]);
    expect(createUtf8ByteBoundaryIndex(bytes)?.size).toBe(3);
    bytes[0] = 0xff;
    expect(createUtf8ByteBoundaryIndex(bytes)).toBeUndefined();
  });

  it("should reuse an index only when explicitly permitted for private immutable bytes", () => {
    const bytes = new TextEncoder().encode("private");
    const first = createUtf8ByteBoundaryIndex(bytes, true);
    const second = createUtf8ByteBoundaryIndex(bytes, true);

    expect(first).toBe(second);
  });

  it("should implement the complete read-only set interface and clamp boundary searches", () => {
    const boundaries = createUtf8ByteBoundaryIndex(new TextEncoder().encode("aé"));
    expect(boundaries).toBeDefined();
    if (boundaries === undefined) return;

    expect(Object.prototype.toString.call(boundaries)).toBe("[object Utf8ByteBoundaryIndex]");
    expect([...boundaries.keys()]).toEqual([0, 1, 3]);
    expect([...boundaries.entries()]).toEqual([
      [0, 0],
      [1, 1],
      [3, 3],
    ]);
    const visited: number[] = [];
    const receiver = { visited };
    boundaries.forEach((value, duplicate, set) => {
      expect(value).toBe(duplicate);
      expect(set).toBe(boundaries);
      visited.push(value);
    }, receiver);
    expect(visited).toEqual([0, 1, 3]);
    expect(boundaries.has(Number.NaN)).toBe(false);
    expect(boundaries.has(-1)).toBe(false);
    expect(boundaries.has(4)).toBe(false);
    expect(boundaries.has(2)).toBe(false);
    expect(boundaries.atOrBefore(-10)).toBe(0);
    expect(boundaries.atOrAfter(10)).toBe(3);
  });

  it("should validate generic three- and four-byte sequences and reject each bad continuation", () => {
    for (const bytes of [
      [0xe1, 0x80, 0x80],
      [0xf1, 0x80, 0x80, 0x80],
      [0xe0, 0xa0, 0x80],
      [0xe0, 0xbf, 0xbf],
      [0xed, 0x80, 0x80],
      [0xed, 0x9f, 0xbf],
      [0xf0, 0x90, 0x80, 0x80],
      [0xf0, 0xbf, 0xbf, 0xbf],
      [0xf4, 0x80, 0x80, 0x80],
      [0xf4, 0x8f, 0xbf, 0xbf],
    ]) {
      expect(createUtf8ByteBoundaryIndex(Uint8Array.from(bytes))).toBeDefined();
    }
    for (const bytes of [
      [0xe1, 0x80, 0x40],
      [0xe1, 0x40, 0x80],
      [0xf1, 0x80, 0x40, 0x80],
      [0xf1, 0x80, 0x80, 0x40],
      [0xf1, 0x40, 0x80, 0x80],
      [0xf0, 0x8f, 0x80, 0x80],
      [0xf4, 0x90, 0x80, 0x80],
    ]) {
      expect(createUtf8ByteBoundaryIndex(Uint8Array.from(bytes))).toBeUndefined();
    }
  });
});
