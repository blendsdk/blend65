import { describe, expect, it } from "vitest";

import {
  compareExecutionText,
  isExecutionDigest,
  isExecutionIdentifier,
  normalizeExecutionStringSet,
  readExecutionArray,
  readExecutionRecord,
} from "./execution-validation.js";

function isString(value: unknown): value is string {
  return typeof value === "string";
}

describe("execution hostile-input primitives", () => {
  it("should accept only plain exact own-data records", () => {
    expect(readExecutionRecord({ left: 1, right: 2 }, ["left", "right"])).toEqual({
      left: 1,
      right: 2,
    });
    expect(
      readExecutionRecord(Object.assign(Object.create(null), { value: 1 }), ["value"]),
    ).toEqual({ value: 1 });
    expect(readExecutionRecord(null, [])).toBeUndefined();
    expect(readExecutionRecord([], [])).toBeUndefined();
    expect(readExecutionRecord(new Date(), [])).toBeUndefined();
    expect(readExecutionRecord({ left: 1 }, ["right"])).toBeUndefined();
    expect(readExecutionRecord({ left: 1, extra: 2 }, ["left"])).toBeUndefined();

    const accessor = Object.defineProperty({}, "left", {
      enumerable: true,
      get: () => 1,
    });
    const hidden = Object.defineProperty({}, "left", {
      enumerable: false,
      value: 1,
    });
    const symbolic = { left: 1, [Symbol("extra")]: 2 };
    expect(readExecutionRecord(accessor, ["left"])).toBeUndefined();
    expect(readExecutionRecord(hidden, ["left"])).toBeUndefined();
    expect(readExecutionRecord(symbolic, ["left"])).toBeUndefined();
    expect(
      readExecutionRecord(
        new Proxy(
          { left: 1 },
          {
            ownKeys(): never {
              throw new Error("hostile ownKeys");
            },
          },
        ),
        ["left"],
      ),
    ).toBeUndefined();
  });

  it("should copy only bounded plain dense arrays", () => {
    expect(readExecutionArray(["a", "b"], 2)).toEqual(["a", "b"]);
    expect(readExecutionArray("a", 2)).toBeUndefined();
    class SubArray extends Array<string> {}
    expect(readExecutionArray(new SubArray("a"), 2)).toBeUndefined();
    expect(readExecutionArray(["a", "b"], 1)).toBeUndefined();
    const sparse = ["a", "b"];
    delete sparse[1];
    expect(readExecutionArray(sparse, 2)).toBeUndefined();
    const hidden = ["a"];
    Object.defineProperty(hidden, "0", { enumerable: false, value: "a" });
    expect(readExecutionArray(hidden, 1)).toBeUndefined();
    const symbolic = ["a"];
    Object.defineProperty(symbolic, Symbol("extra"), { value: true });
    expect(readExecutionArray(symbolic, 1)).toBeUndefined();
    const proxied = new Proxy(["a"], {
      getOwnPropertyDescriptor(_target, property): PropertyDescriptor | undefined {
        if (property === "0") throw new Error("hostile descriptor");
        return Reflect.getOwnPropertyDescriptor(["a"], property);
      },
    });
    expect(readExecutionArray(proxied, 1)).toBeUndefined();
  });

  it("should validate bounded identifiers and canonical digests", () => {
    expect(isExecutionDigest(`sha256:${"a".repeat(64)}`)).toBe(true);
    expect(isExecutionDigest(`sha256:${"A".repeat(64)}`)).toBe(false);
    expect(isExecutionDigest(1)).toBe(false);
    expect(isExecutionIdentifier("rule.valid-name_1")).toBe(true);
    expect(isExecutionIdentifier(1)).toBe(false);
    expect(isExecutionIdentifier("")).toBe(false);
    expect(isExecutionIdentifier("x".repeat(513))).toBe(false);
    expect(isExecutionIdentifier("bad value")).toBe(false);
  });

  it("should normalize unique lexical string sets without locale collation", () => {
    expect(normalizeExecutionStringSet(["z", "a"], 2, isString)).toEqual(["a", "z"]);
    expect(normalizeExecutionStringSet(["a", "a"], 2, isString)).toBeUndefined();
    expect(normalizeExecutionStringSet(["a", 1], 2, isString)).toBeUndefined();
    expect(normalizeExecutionStringSet("a", 2, isString)).toBeUndefined();
    expect(compareExecutionText("a", "b")).toBe(-1);
    expect(compareExecutionText("b", "a")).toBe(1);
    expect(compareExecutionText("a", "a")).toBe(0);
  });
});
