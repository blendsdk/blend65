import { describe, expect, it } from "vitest";

import { createBoundaryVariants } from "./boundary-variants.js";

const INPUT = {
  type: "byte",
  spellings: ["parameter", "literal", "parameter", "const"],
  minNestingDepth: 1,
  maxNestingDepth: 2,
  allowEmpty: false,
} as const;

describe("boundary variant construction", () => {
  it("omits empty variants when not allowed and sorts duplicate-free spellings", () => {
    const result = createBoundaryVariants(INPUT);

    expect(result).toEqual({
      ok: true,
      variants: [
        { kind: "minimum", type: "byte", value: 0n },
        { kind: "maximum", type: "byte", value: 255n },
        { kind: "nearest-below", type: "byte", value: -1n },
        { kind: "nearest-above", type: "byte", value: 256n },
        { kind: "spelling", type: "byte", value: null, spelling: "const" },
        { kind: "spelling", type: "byte", value: null, spelling: "literal" },
        { kind: "spelling", type: "byte", value: null, spelling: "parameter" },
        { kind: "nesting", type: "byte", value: null, nestingDepth: 1 },
        { kind: "nesting", type: "byte", value: null, nestingDepth: 2 },
      ],
      diagnostics: [],
    });
    if (!result.ok) return;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.variants)).toBe(true);
    expect(result.variants.every(Object.isFrozen)).toBe(true);
  });

  it("supports a single closed depth and an empty spelling family", () => {
    expect(
      createBoundaryVariants({
        type: "boolean",
        spellings: [],
        minNestingDepth: 0,
        maxNestingDepth: 0,
        allowEmpty: false,
      }),
    ).toEqual({
      ok: true,
      variants: [
        { kind: "minimum", type: "boolean", value: false },
        { kind: "maximum", type: "boolean", value: true },
        { kind: "nesting", type: "boolean", value: null, nestingDepth: 0 },
      ],
      diagnostics: [],
    });
  });

  it.each([
    [{ ...INPUT, extra: true }, ""],
    [{ ...INPUT, type: "dword" }, "/type"],
    [{ ...INPUT, spellings: ["macro"] }, "/spellings"],
    [{ ...INPUT, spellings: "literal" }, "/spellings"],
    [{ ...INPUT, minNestingDepth: -1 }, "/minNestingDepth"],
    [{ ...INPUT, maxNestingDepth: 1.5 }, "/maxNestingDepth"],
    [{ ...INPUT, maxNestingDepth: 1_025 }, "/maxNestingDepth"],
    [{ ...INPUT, minNestingDepth: 2, maxNestingDepth: 1 }, "/maxNestingDepth"],
    [{ ...INPUT, allowEmpty: "yes" }, "/allowEmpty"],
  ])("returns stable input diagnostics for malformed case %#", (input, path) => {
    expect(createBoundaryVariants(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path }],
    });
  });

  it("rejects accessor and proxy input without reading values", () => {
    const accessor = Object.defineProperty({ ...INPUT }, "type", {
      enumerable: true,
      get: () => "byte",
    });
    expect(createBoundaryVariants(accessor)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "/type" }],
    });

    const hostile = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error("blocked");
        },
      },
    );
    expect(createBoundaryVariants(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "generation-input-invalid", path: "" }],
    });
  });
});
