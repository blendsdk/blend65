import { describe, expect, it, vi } from "vitest";

import {
  createDeterministicChoiceContext,
  drawBoundedInteger,
  drawBoundedIntegerFromContext,
  drawCounterBlock,
  drawCounterBlockFromContext,
} from "./deterministic-choice.js";

const SEED: `sha256:${string}` = `sha256:${"0".repeat(64)}`;

describe("deterministic choice input hardening", () => {
  it.each([
    [{ seed: "bad", generationPath: [], drawOrdinal: 0n, blockIndex: 0n }, "/seed"],
    [{ seed: SEED, generationPath: [-1], drawOrdinal: 0n, blockIndex: 0n }, "/generationPath/0"],
    [{ seed: SEED, generationPath: [], drawOrdinal: -1n, blockIndex: 0n }, "/drawOrdinal"],
    [{ seed: SEED, generationPath: [], drawOrdinal: 1n << 64n, blockIndex: 0n }, "/drawOrdinal"],
    [{ seed: SEED, generationPath: [], drawOrdinal: 0n, blockIndex: -1n }, "/blockIndex"],
    [{ seed: SEED, generationPath: [], drawOrdinal: 0n, blockIndex: 1n << 64n }, "/blockIndex"],
    [{ seed: SEED, generationPath: [], drawOrdinal: 0n, blockIndex: 0n, extra: true }, ""],
  ])("returns stable counter diagnostics for malformed input", (input, path) => {
    // @ts-expect-error Table intentionally contains hostile runtime inputs.
    expect(drawCounterBlock(input)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "choice.input.invalid", path }],
    });
  });

  it.each([
    [0n, "/upperExclusive"],
    [-1n, "/upperExclusive"],
    [(1n << 256n) + 1n, "/upperExclusive"],
  ])("rejects a bounded range of %s", (upperExclusive, path) => {
    expect(
      drawBoundedInteger({
        seed: SEED,
        generationPath: [],
        drawOrdinal: 0n,
        upperExclusive,
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path }],
    });
  });

  it("rejects throwing and malformed digest capabilities as data", () => {
    const input = {
      seed: SEED,
      generationPath: [],
      drawOrdinal: 0n,
      upperExclusive: 2n,
    };
    expect(
      drawBoundedInteger(input, () => {
        throw new TypeError("blocked");
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/blockIndex" }],
    });
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      expect(drawBoundedInteger(input, () => new Uint8Array(31))).toMatchObject({
        ok: false,
        diagnostics: [{ path: "/blockIndex" }],
      });
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
    }
    // @ts-expect-error Non-callable digest capability is intentional hostile input.
    expect(drawBoundedInteger(input, null)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/blockIndex" }],
    });
  });

  it("stops a hostile always-rejected source without biasing successful draws", () => {
    const upperExclusive = (1n << 255n) + 1n;
    const rejected = new Uint8Array(32).fill(0xff);
    const digest = vi.fn(() => rejected);
    const result = drawBoundedInteger(
      {
        seed: SEED,
        generationPath: [],
        drawOrdinal: 0n,
        upperExclusive,
      },
      digest,
    );

    expect(result).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/blockIndex" }],
    });
    expect(digest).toHaveBeenCalledTimes(1024);
  });

  it("supports the full 256-bit range and returns isolated repeatable blocks", () => {
    const fullRange = drawBoundedInteger({
      seed: SEED,
      generationPath: [0xffff_ffff],
      drawOrdinal: (1n << 64n) - 1n,
      upperExclusive: 1n << 256n,
    });
    expect(fullRange.ok).toBe(true);

    const input = {
      seed: SEED,
      generationPath: [3],
      drawOrdinal: 4n,
      blockIndex: 5n,
    };
    const first = drawCounterBlock(input);
    const second = drawCounterBlock(input);
    expect(first).toEqual(second);
    if (!first.ok || !second.ok) return;
    first.value[0] = first.value[0] === 0 ? 1 : 0;
    expect(first.value).not.toEqual(second.value);
  });

  it("streams default counter blocks without materializing defensive preimage copies", () => {
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      const result = drawBoundedInteger({
        seed: SEED,
        generationPath: [1, 2, 3],
        drawOrdinal: 4n,
        upperExclusive: 257n,
      });
      expect(result.ok).toBe(true);
      expect(slice).not.toHaveBeenCalled();
    } finally {
      slice.mockRestore();
    }
  });

  it("reuses validated and pre-encoded invariant context across repeated draws", () => {
    let rejectPathInspection = false;
    let pathInspections = 0;
    const generationPath = new Proxy([1, 2], {
      ownKeys: (target) => {
        pathInspections += 1;
        if (rejectPathInspection) throw new TypeError("path was revalidated");
        return Reflect.ownKeys(target);
      },
    });
    const encoded = vi.spyOn(TextEncoder.prototype, "encode");
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      const created = createDeterministicChoiceContext({ seed: SEED, generationPath });
      expect(created.ok).toBe(true);
      if (!created.ok) return;

      const initialPathInspections = pathInspections;
      rejectPathInspection = true;
      encoded.mockClear();
      slice.mockClear();

      const counter = drawCounterBlockFromContext(created.value, 3n, 4n);
      const bounded = drawBoundedIntegerFromContext(created.value, 5n, 1n << 256n);
      expect(counter.ok).toBe(true);
      expect(bounded.ok).toBe(true);
      expect(pathInspections).toBe(initialPathInspections);
      expect(slice).not.toHaveBeenCalled();
      expect(encoded).toHaveBeenCalledTimes(8);
      expect(encoded.mock.calls.map(([value]) => value)).toEqual([
        "3",
        "drawOrdinal",
        "4",
        "blockIndex",
        "5",
        "drawOrdinal",
        "0",
        "blockIndex",
      ]);

      const wrapper = drawCounterBlock({
        seed: SEED,
        generationPath: [1, 2],
        drawOrdinal: 3n,
        blockIndex: 4n,
      });
      expect(wrapper).toEqual(counter);
    } finally {
      encoded.mockRestore();
      slice.mockRestore();
    }
  });

  it("rejects forged reusable contexts without inspecting their properties", () => {
    const forged = new Proxy(
      {},
      {
        get: () => {
          throw new TypeError("blocked");
        },
      },
    );
    expect(
      // @ts-expect-error Runtime context intentionally lacks factory authority.
      drawCounterBlockFromContext(forged, 0n, 0n),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/context" }],
    });
  });

  it("validates reusable context inputs and per-draw scalar arguments", () => {
    expect(
      createDeterministicChoiceContext({
        // @ts-expect-error Malformed runtime seed is intentional.
        seed: "bad",
        generationPath: [],
      }),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/seed" }],
    });

    const created = createDeterministicChoiceContext({ seed: SEED, generationPath: [] });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    for (const [drawOrdinal, blockIndex, path] of [
      [-1n, 0n, "/drawOrdinal"],
      [0n, -1n, "/blockIndex"],
    ] as const) {
      expect(drawCounterBlockFromContext(created.value, drawOrdinal, blockIndex)).toMatchObject({
        ok: false,
        diagnostics: [{ path }],
      });
    }

    expect(
      // @ts-expect-error Null runtime context intentionally lacks factory authority.
      drawCounterBlockFromContext(null, 0n, 0n),
    ).toMatchObject({ ok: false, diagnostics: [{ path: "/context" }] });
    expect(
      // @ts-expect-error Null runtime context intentionally lacks factory authority.
      drawBoundedIntegerFromContext(null, 0n, 1n),
    ).toMatchObject({ ok: false, diagnostics: [{ path: "/context" }] });
    expect(drawBoundedIntegerFromContext(created.value, -1n, 1n)).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/drawOrdinal" }],
    });
    for (const upperExclusive of [0n, (1n << 256n) + 1n]) {
      expect(drawBoundedIntegerFromContext(created.value, 0n, upperExclusive)).toMatchObject({
        ok: false,
        diagnostics: [{ path: "/upperExclusive" }],
      });
    }
    expect(
      // @ts-expect-error Non-callable digest is intentional hostile input.
      drawBoundedIntegerFromContext(created.value, 0n, 1n, null),
    ).toMatchObject({
      ok: false,
      diagnostics: [{ path: "/blockIndex" }],
    });
  });

  it("materializes and isolates canonical bytes only for an injected block digest", () => {
    const slice = vi.spyOn(Uint8Array.prototype, "slice");
    const digest = vi.fn(() => new Uint8Array(32));
    try {
      const result = drawBoundedInteger(
        {
          seed: SEED,
          generationPath: [1],
          drawOrdinal: 2n,
          upperExclusive: 2n,
        },
        digest,
      );
      expect(result).toMatchObject({ ok: true, value: 0n });
      expect(digest).toHaveBeenCalledTimes(1);
      expect(slice).toHaveBeenCalledTimes(1);
    } finally {
      slice.mockRestore();
    }
  });

  it("rejects proxy input without leaking an exception", () => {
    const hostile = new Proxy(
      {
        seed: SEED,
        generationPath: [],
        drawOrdinal: 0n,
        blockIndex: 0n,
      },
      {
        ownKeys: () => {
          throw new TypeError("blocked");
        },
      },
    );
    expect(drawCounterBlock(hostile)).toMatchObject({
      ok: false,
      diagnostics: [{ code: "choice.input.invalid" }],
    });
  });
});
