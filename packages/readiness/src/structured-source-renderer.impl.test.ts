import { describe, expect, it } from "vitest";

import { validateGeneratorIr } from "./generator-ir-validator.js";
import type { SourceRenderOptions } from "./roundtrip-model.js";
import { prepareSourceRenderInput, renderSourceModule } from "./source-renderer.js";
import { createStructuredGeneratedProgramsSpecFixture } from "./test-fixtures/structured-generated-programs-spec-fixture.js";

const fixture = createStructuredGeneratedProgramsSpecFixture();
const encoder = new TextEncoder();
const maximumOptions = { maxSourceBytes: 1_048_576, literalSpellings: [] } as const;

function render(module: unknown, options: SourceRenderOptions = maximumOptions) {
  const validation = validateGeneratorIr(module);
  expect(validation).toMatchObject({ ok: true, diagnostics: [] });
  if (!validation.ok) throw new TypeError("expected valid structured generator IR");
  const result = renderSourceModule(validation.module, options);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError("expected deterministic source");
  return result;
}

describe("structured canonical source formatting", () => {
  it("renders fixed arrays and indexed reads exactly", () => {
    expect(render(fixture.fixedArray).source).toBe(
      [
        "module StructuredArray;",
        "function main(): byte {",
        "  let values: byte[4] = [1, 2, 3, 4];",
        "  return values[2];",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("renders unsized const array parameters, references, and scalar call arguments exactly", () => {
    expect(render(fixture.firstUnsized).source).toBe(
      [
        "module FirstUnsized;",
        "function first(data: const byte[], i: byte): byte {",
        "  return data[i];",
        "}",
        "function main(): byte {",
        "  let values: byte[4] = [1, 2, 3, 4];",
        "  return first(values, 2);",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("renders ordered exclusive and inclusive loops with an omitted unit step", () => {
    expect(render(fixture.pairedForLoops).source).toBe(
      [
        "module PairedForLoops;",
        "function main(): byte {",
        "  let n: byte = 0;",
        "  for (let i: byte = 0 until 3) {",
        "    n = n + 1;",
        "  }",
        "  for (let j: byte = 0 to 2) {",
        "    n = n + 1;",
        "  }",
        "  return n;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("renders a larger positive loop step in lowercase decimal", () => {
    const source = render(fixture.loopExtremes.crossingByteMaximum).source;
    expect(source).toContain("for (let i: byte = 250 to 255 step 3) {");
    expect(source).not.toContain(" step 1");
  });

  it("preserves exact branch, while, and do-while block indentation", () => {
    expect(render(fixture.branch).source).toContain(
      ["  if (flag) {", "    poke(49152, 1);", "  } else {", "    poke(49152, 2);", "  }"].join(
        "\n",
      ),
    );
    expect(render(fixture.whileZero).source).toContain(
      ["  while (false) {", "    n = n + 1;", "  }"].join("\n"),
    );
    expect(render(fixture.doWhileOne).source).toContain(
      ["  do {", "    n = n + 1;", "  } while (false);"].join("\n"),
    );
  });

  it("applies numeric literal spellings only at their canonical expression paths", () => {
    const result = render(fixture.fixedArray, {
      maxSourceBytes: 1_048_576,
      literalSpellings: [
        {
          expressionPath: "/functions/0/body/0/initializer/0",
          spelling: "hex-dollar",
        },
        {
          expressionPath: "/functions/0/body/0/initializer/1",
          spelling: "hex-prefix",
        },
        {
          expressionPath: "/functions/0/body/0/initializer/2",
          spelling: "binary-prefix",
        },
      ],
    });
    expect(result.source).toContain("let values: byte[4] = [$1, 0x2, 0b11, 4];");
    expect(result.source).toContain("return values[2];");
  });

  it("emits one final LF, no blank lines, and exact UTF-8 bytes", () => {
    for (const module of [
      fixture.fixedArray,
      fixture.firstUnsized,
      fixture.mutableArray,
      fixture.branch,
      fixture.pairedForLoops,
    ]) {
      const result = render(module);
      expect(result.source.endsWith("\n")).toBe(true);
      expect(result.source.endsWith("\n\n")).toBe(false);
      expect(result.source).not.toContain("\n\n");
      expect(result.sourceBytes).toEqual(encoder.encode(result.source));
    }
  });

  it("is deterministic and returns fresh source-byte snapshots", () => {
    const first = render(fixture.nestedCalls);
    const second = render(fixture.nestedCalls);
    expect(second).toEqual(first);
    expect(second.sourceBytes).not.toBe(first.sourceBytes);

    first.sourceBytes[0] = first.sourceBytes[0]! ^ 0xff;
    expect(render(fixture.nestedCalls)).toEqual(second);
  });
});

describe("structured source-byte ceilings", () => {
  it.each([
    ["array", fixture.fixedArray],
    ["calls", fixture.nestedCalls],
    ["control flow", fixture.pairedForLoops],
  ] as const)("accepts the exact %s byte ceiling and rejects one byte less", (_name, module) => {
    const baseline = render(module);
    const exact = render(module, {
      maxSourceBytes: baseline.sourceBytes.byteLength,
      literalSpellings: [],
    });
    expect(exact.sourceBytes.byteLength).toBe(baseline.sourceBytes.byteLength);

    const closed = validateGeneratorIr(module);
    expect(closed.ok).toBe(true);
    if (!closed.ok) throw new TypeError("expected valid structured generator IR");
    const over = renderSourceModule(closed.module, {
      maxSourceBytes: baseline.sourceBytes.byteLength - 1,
      literalSpellings: [],
    });
    expect(over).toEqual({
      ok: false,
      diagnostics: [
        {
          code: "render.budget.source-bytes",
          path: "/sourceBytes",
          message: "rendered source exceeds the configured byte limit",
        },
      ],
    });
    expect(over).not.toHaveProperty("source");
    expect(over).not.toHaveProperty("sourceBytes");
  });

  it("rejects hostile render options without invoking an accessor", () => {
    const closed = validateGeneratorIr(fixture.fixedArray);
    expect(closed.ok).toBe(true);
    if (!closed.ok) throw new TypeError("expected valid structured generator IR");
    let invoked = false;
    const options: Record<string, unknown> = { literalSpellings: [] };
    Object.defineProperty(options, "maxSourceBytes", {
      enumerable: true,
      get: () => {
        invoked = true;
        return 1_048_576;
      },
    });

    expect(prepareSourceRenderInput(closed.module, options)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "render.input.invalid", path: "/options/maxSourceBytes" }],
    });
    expect(invoked).toBe(false);
  });
});
