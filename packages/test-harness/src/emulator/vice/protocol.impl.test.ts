/**
 * Implementation tests for the VICE protocol codec — body-layout edges, error-code
 * frames, and malformed-frame handling. Written AFTER the codec; these cover
 * internals beyond the specification tests.
 */

import { describe, expect, it } from "vitest";
import {
  checkpointSetBody,
  decodeResponses,
  encodeCommand,
  memoryGetBody,
  memorySetBody,
  parseCheckpointInfo,
  parseDisplayGet,
  parsePaletteGet,
  parseRegistersGet,
  registersSetBody,
} from "./protocol.js";

/** Build a response frame for the decode edge tests. */
function frame(type: number, errorCode: number, requestId: number, body: number[]): Uint8Array {
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

describe("codec body builders", () => {
  it("memoryGetBody: sideeffects, start LE, inclusive end LE, memspace, bank LE", () => {
    expect([...memoryGetBody(0xc000, 0xc003)]).toEqual([0x00, 0x00, 0xc0, 0x03, 0xc0, 0x00, 0x00, 0x00]);
  });

  it("memorySetBody: end is start+len-1 and the data trails the 8-byte header", () => {
    expect([...memorySetBody(0x1000, new Uint8Array([0xaa, 0xbb]))]).toEqual([
      0x00, 0x00, 0x10, 0x01, 0x10, 0x00, 0x00, 0x00, 0xaa, 0xbb,
    ]);
  });

  it("checkpointSetBody: start LE, end LE, stop=1, enabled=1, op=exec(4), temp=0", () => {
    expect([...checkpointSetBody(0x0819)]).toEqual([0x19, 0x08, 0x19, 0x08, 0x01, 0x01, 0x04, 0x00]);
  });

  it("registersSetBody: memspace, count LE, then item-size(3), id, value LE per item", () => {
    expect([...registersSetBody([{ id: 0, value: 0x2a }, { id: 4, value: 0x01ff }])]).toEqual([
      0x00, 0x02, 0x00, 0x03, 0x00, 0x2a, 0x00, 0x03, 0x04, 0xff, 0x01,
    ]);
  });
});

describe("codec body parsers", () => {
  it("parseRegistersGet: id→value from item-size framed entries", () => {
    // count=2; [size3, id0, 0x2a00], [size3, id4, 0xf300]
    const body = new Uint8Array([0x02, 0x00, 0x03, 0x00, 0x2a, 0x00, 0x03, 0x04, 0xf3, 0x00]);
    const map = parseRegistersGet(body);
    expect(map.get(0)).toBe(0x2a);
    expect(map.get(4)).toBe(0xf3);
  });

  it("parseCheckpointInfo: number LE + currently-hit flag", () => {
    expect(parseCheckpointInfo(new Uint8Array([0x01, 0x00, 0x00, 0x00, 0x01]))).toEqual({
      number: 1,
      hit: true,
    });
    expect(parseCheckpointInfo(new Uint8Array([0x07, 0x00, 0x00, 0x00, 0x00])).hit).toBe(false);
  });

  it("parseDisplayGet: field-length-driven header, then image-length + image", () => {
    // fieldlen=13; w=2,h=2; (skip xoff/yoff/visw/vish); bpp=8; imagelen=4; image=[1,2,3,0]
    const body = new Uint8Array([
      0x0d, 0x00, 0x00, 0x00, // fieldlen 13
      0x02, 0x00, // w
      0x02, 0x00, // h
      0x00, 0x00, 0x00, 0x00, // xoff/yoff
      0x02, 0x00, 0x02, 0x00, // visw/vish
      0x08, // bpp
      0x04, 0x00, 0x00, 0x00, // imagelen 4
      0x01, 0x02, 0x03, 0x00, // image
    ]);
    const frameOut = parseDisplayGet(body);
    expect(frameOut.width).toBe(2);
    expect(frameOut.height).toBe(2);
    expect(frameOut.bpp).toBe(8);
    expect([...frameOut.data]).toEqual([0x01, 0x02, 0x03, 0x00]);
  });

  it("parsePaletteGet: num LE, then item-size(3)-framed RGB triples", () => {
    const body = new Uint8Array([0x02, 0x00, 0x03, 0x00, 0x00, 0x00, 0x03, 0xff, 0xff, 0xff]);
    expect(parsePaletteGet(body)).toEqual([
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    ]);
  });
});

describe("decodeResponses edge handling", () => {
  it("preserves a non-zero error code on the decoded frame", () => {
    const { frames } = decodeResponses(frame(0x31, 0x0d, 0x05, []));
    expect(frames).toHaveLength(1);
    expect(frames[0].errorCode).toBe(0x0d);
  });

  it("resynchronises past leading garbage before a valid frame (no silent mis-decode)", () => {
    const valid = frame(0x01, 0x00, 0x09, [0xab]);
    const noisy = new Uint8Array([0xff, 0x00, ...valid]);
    const { frames, consumed } = decodeResponses(noisy);
    expect(frames).toHaveLength(1);
    expect(frames[0].requestId).toBe(0x09);
    expect(consumed).toBe(noisy.length);
  });

  it("returns nothing for a header that claims more body than is present", () => {
    // A 12-byte header claiming a 10-byte body, but no body bytes follow.
    const header = frame(0x01, 0x00, 0x01, []).slice(0, 12);
    const dv = new DataView(header.buffer);
    dv.setUint32(2, 10, true); // claim 10 body bytes
    const { frames, consumed } = decodeResponses(header);
    expect(frames).toHaveLength(0);
    expect(consumed).toBe(0);
  });

  it("round-trips an encoded command body through the frame length field", () => {
    const cmd = encodeCommand(0x01, 0x1234, new Uint8Array([1, 2, 3, 4, 5]));
    const dv = new DataView(cmd.buffer);
    expect(dv.getUint32(2, true)).toBe(5); // body length
    expect(dv.getUint32(6, true)).toBe(0x1234); // request id
  });
});
