import { describe, expect, it } from "vitest";

import { parseStrictJson } from "./strict-json.js";

const encoder = new TextEncoder();

describe("strict JSON parser internals", () => {
  it.each([
    ["invalid UTF-8", new Uint8Array([0xff])],
    ["duplicate key", encoder.encode('{"a":1,"a":2}')],
    ["comment", encoder.encode('{"a":1/*comment*/}')],
    ["syntax error", encoder.encode('{"a":}')],
    ["deep array", encoder.encode(`${"[".repeat(33)}0${"]".repeat(33)}`)],
    ["deep object", encoder.encode(`${'{"a":'.repeat(33)}0${"}".repeat(33)}`)],
    ["oversized property", encoder.encode(`{"${"a".repeat(65_537)}":0}`)],
    ["oversized string", encoder.encode(`"${"a".repeat(65_537)}"`)],
  ])("rejects %s without accepting a partial value", (_name, bytes) => {
    expect(parseStrictJson(bytes)).toMatchObject({ ok: false });
  });

  it("escapes duplicate-property locations as RFC 6901 pointers", () => {
    expect(parseStrictJson(encoder.encode('{"a/b~c":1,"a/b~c":2}'))).toMatchObject({
      ok: false,
      problem: { path: "/a~1b~0c" },
    });
  });

  it.each([
    ["literal", `[${"0,".repeat(262_144)}0]`],
    ["array", `[${"[],".repeat(262_144)}[]]`],
    ["object", `[${"{},".repeat(262_144)}{}]`],
  ])("bounds aggregate %s values", (_name, text) => {
    expect(parseStrictJson(encoder.encode(text))).toMatchObject({
      ok: false,
      problem: { message: "JSON value limit exceeded." },
    });
  });

  it("accepts a complete JSON data value", () => {
    expect(parseStrictJson(encoder.encode('{"value":[true,null,1,"ok"]}'))).toEqual({
      ok: true,
      value: { value: [true, null, 1, "ok"] },
    });
  });
});
