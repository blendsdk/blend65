/**
 * Implementation tests for the scoreboard generator's CLI-gated exports:
 * routing-enforcement classification, totals arithmetic, two-decimal
 * formatting, measured-column placement, routing-section rendering, and
 * render determinism — all over constructed reports, no builds.
 */

import { describe, expect, it } from "vitest";

import { renderScoreboard, routingProblems } from "../scripts/gen-parity-scoreboard.mjs";

describe("Implementation: routing enforcement", () => {
  it("should report every unrouted computed category", () => {
    const problems = routingProblems("pairx", new Set(["layout", "instruction selection"]), undefined);
    expect(problems).toEqual([
      "unrouted divergence group: pairx × instruction selection",
      "unrouted divergence group: pairx × layout",
    ]);
  });

  it("should report stale routing keys without computed rows", () => {
    const problems = routingProblems("pairx", new Set(["layout"]), {
      layout: [{ disposition: "parity" }],
      "register usage": [{ disposition: "parity" }],
    });
    expect(problems).toEqual([
      "stale routing key: pairx × register usage has no computed divergence rows",
    ]);
  });

  it("should report nothing when routing exactly covers the computed categories", () => {
    expect(
      routingProblems("pairx", new Set(["layout"]), { layout: [{ disposition: "parity" }] }),
    ).toEqual([]);
  });
});

describe("Implementation: scoreboard rendering", () => {
  const report = {
    pairs: {
      beta: {
        bytes: { generated: 100, hand: 50 },
        cycles: { generated: 200, hand: 80 },
        measured: undefined,
        routing: { layout: [{ disposition: "parity" }] },
      },
      alpha: {
        bytes: { generated: 300, hand: 100 },
        cycles: { generated: 400, hand: 100 },
        measured: { generated: 162, twin: 97 },
        routing: {
          "data placement": [
            { disposition: "data/placement", issue: 49, sourceForced: true, note: "unrolled pokes" },
          ],
        },
      },
    },
  };

  it("should sum totals and format every ratio to two decimals", () => {
    const scoreboard = renderScoreboard(report);
    expect(scoreboard).toContain("| **Total** | 400 | 150 | 2.67 | 600 | 180 | 3.33 | — | — | — |");
    expect(scoreboard).toContain("| alpha | 300 | 100 | 3.00 | 400 | 100 | 4.00 | 162 | 97 | 1.67 |");
  });

  it("should leave measured columns empty for pairs without committed measured data", () => {
    const scoreboard = renderScoreboard(report);
    expect(scoreboard).toContain("| beta | 100 | 50 | 2.00 | 200 | 80 | 2.50 | — | — | — |");
  });

  it("should sort pairs by name regardless of insertion order", () => {
    const scoreboard = renderScoreboard(report);
    expect(scoreboard.indexOf("| alpha |")).toBeLessThan(scoreboard.indexOf("| beta |"));
  });

  it("should render routing sections with issue links and source-forced annotations", () => {
    const scoreboard = renderScoreboard(report);
    expect(scoreboard).toContain(
      "| data placement | data/placement | [#49](https://github.com/blendsdk/blend65/issues/49) | **source-forced** — unrolled pokes |",
    );
    expect(scoreboard).toContain("| layout | parity | — | — |");
  });

  it("should render byte-identically across calls", () => {
    expect(renderScoreboard(report)).toBe(renderScoreboard(report));
  });
});
