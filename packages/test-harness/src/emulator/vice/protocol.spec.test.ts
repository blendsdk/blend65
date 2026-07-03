/**
 * Specification tests for the pure VICE binary-monitor codec (ST-03..ST-08).
 *
 * Derived EXCLUSIVELY from RD-12 §4.5, the VICE 3.7+ binary-monitor frame spec,
 * and the body layouts pinned LIVE against VICE 3.10 this session (AR-H14/PF-004)
 * — never from reading the implementation (IMMUTABLE ORACLE RULE). The codec is a
 * pure `Uint8Array`↔structured-command transform with no I/O, so these run in CI
 * with no emulator.
 *
 * Frame headers (RD §4.5):
 *   command  : STX(0x02), api(0x02), bodylen(u32 LE), reqid(u32 LE), type(u8), body
 *   response : STX(0x02), api(0x02), bodylen(u32 LE), type(u8), errcode(u8),
 *              reqid(u32 LE), body
 */

import { describe, expect, it } from "vitest";
import {
  CMD,
  decodeResponses,
  encodeCommand,
  parseMemoryGet,
  parseRegistersAvailable,
} from "./protocol.js";

/** Build a well-formed response frame for the decode oracles. */
function responseFrame(type: number, errorCode: number, requestId: number, body: Uint8Array): Uint8Array {
  const buf = new Uint8Array(12 + body.length);
  const dv = new DataView(buf.buffer);
  buf[0] = 0x02;
  buf[1] = 0x02;
  dv.setUint32(2, body.length, true);
  buf[6] = type;
  buf[7] = errorCode;
  dv.setUint32(8, requestId, true);
  buf.set(body, 12);
  return buf;
}

describe("Specification: encodeCommand frame layout (ST-03)", () => {
  it("ST-03: encodes STX, api, LE body length, LE request id, type, then body", () => {
    const body = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const frame = encodeCommand(CMD.MEMORY_GET, 7, body);

    expect(frame[0]).toBe(0x02); // STX
    expect(frame[1]).toBe(0x02); // API version
    // body length u32 LE == 3
    expect([frame[2], frame[3], frame[4], frame[5]]).toEqual([0x03, 0x00, 0x00, 0x00]);
    // request id u32 LE == 7
    expect([frame[6], frame[7], frame[8], frame[9]]).toEqual([0x07, 0x00, 0x00, 0x00]);
    expect(frame[10]).toBe(CMD.MEMORY_GET); // command type
    expect([...frame.slice(11)]).toEqual([0xaa, 0xbb, 0xcc]);
    expect(frame.length).toBe(11 + 3);
  });
});

describe("Specification: decodeResponses framing (ST-04..ST-06)", () => {
  it("ST-04: decodes one complete frame with type/errorCode/requestId/body and full consumed", () => {
    const body = new Uint8Array([0x01, 0x00, 0x2a]);
    const frame = responseFrame(0x01, 0x00, 0x2a, body);

    const { frames, consumed } = decodeResponses(frame);
    expect(frames).toHaveLength(1);
    expect(frames[0].type).toBe(0x01);
    expect(frames[0].errorCode).toBe(0x00);
    expect(frames[0].requestId).toBe(0x2a);
    expect([...frames[0].body]).toEqual([0x01, 0x00, 0x2a]);
    expect(consumed).toBe(frame.length);
  });

  it("ST-05: leaves a partial frame unconsumed, then completes it on the next read", () => {
    const body = new Uint8Array([0x11, 0x22, 0x33, 0x44]);
    const frame = responseFrame(0x31, 0x00, 0x63, body);

    // First read: header only (body split off).
    const first = decodeResponses(frame.slice(0, 12));
    expect(first.frames).toHaveLength(0);
    expect(first.consumed).toBe(0);

    // Second read: the whole buffer (accumulator retained the header).
    const second = decodeResponses(frame);
    expect(second.frames).toHaveLength(1);
    expect([...second.frames[0].body]).toEqual([0x11, 0x22, 0x33, 0x44]);
    expect(second.consumed).toBe(frame.length);
  });

  it("ST-06: decodes two concatenated frames and reports the combined consumed length", () => {
    const a = responseFrame(0x01, 0x00, 0x01, new Uint8Array([0xde]));
    const b = responseFrame(0x31, 0x00, 0x02, new Uint8Array([0xad, 0xbe]));
    const combined = new Uint8Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);

    const { frames, consumed } = decodeResponses(combined);
    expect(frames).toHaveLength(2);
    expect(frames[0].requestId).toBe(0x01);
    expect(frames[1].requestId).toBe(0x02);
    expect([...frames[1].body]).toEqual([0xad, 0xbe]);
    expect(consumed).toBe(a.length + b.length);
  });
});

describe("Specification: body parsers (ST-07, ST-08)", () => {
  it("ST-07: parseRegistersAvailable yields a NAME→id map including A/X/Y/SP/PC", () => {
    // Live-pinned VICE 3.10 layout: count u16 LE, then per item
    // [item_size(1), id(1), bits(1), namelen(1), name].
    const items: Array<[string, number, number]> = [
      ["PC", 3, 16],
      ["A", 0, 8],
      ["X", 1, 8],
      ["Y", 2, 8],
      ["SP", 4, 8],
    ];
    const parts: number[] = [items.length & 0xff, (items.length >> 8) & 0xff];
    for (const [name, id, bits] of items) {
      const nameBytes = [...name].map((c) => c.charCodeAt(0));
      const itemSize = 1 /*id*/ + 1 /*bits*/ + 1 /*namelen*/ + nameBytes.length;
      parts.push(itemSize, id, bits, nameBytes.length, ...nameBytes);
    }
    const body = new Uint8Array(parts);

    const map = parseRegistersAvailable(body);
    expect(map.get("PC")).toBe(3);
    expect(map.get("A")).toBe(0);
    expect(map.get("X")).toBe(1);
    expect(map.get("Y")).toBe(2);
    expect(map.get("SP")).toBe(4);
  });

  it("ST-08: parseMemoryGet strips the 2-byte length prefix and returns the data bytes", () => {
    // Live-pinned: MEMORY_GET response body = len(u16 LE) + N data bytes.
    const body = new Uint8Array([0x03, 0x00, 0x11, 0x22, 0x33]);
    const data = parseMemoryGet(body);
    expect([...data]).toEqual([0x11, 0x22, 0x33]);
  });
});
