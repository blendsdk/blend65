/**
 * Specification tests for the VICE remote text-monitor stopwatch parser.
 *
 * Derived from the documented remote-monitor reply shapes (validated live
 * against VICE 3.10): a `Stopwatch:` line followed by the `(C:$xxxx) `
 * prompt. The checkpoint break banner is the adversarial case — its
 * disassembly/register line ends in a raw, unlabeled stopwatch number, so
 * only an anchored `Stopwatch:` line may ever be accepted. Canned byte
 * buffers, no emulator — CI-safe.
 */

import { describe, expect, it } from "vitest";

import { parseStopwatchReply } from "./text-monitor.js";

describe("Specification: text-monitor stopwatch parsing", () => {
  it("should return the count from a clean stopwatch reply", () => {
    expect(parseStopwatchReply("Stopwatch:       3567\n(C:$ea31) ")).toBe(3567);
  });

  it("should return the labeled count when a break banner ending in a raw number precedes it", () => {
    // A checkpoint break banner: the register line's last column is the raw
    // stopwatch value with no label. A trailing-digits parser would read
    // 4021 — only the anchored `Stopwatch:` line is the real reply.
    const polluted =
      "#1 (Stop on  exec 0848)\n" +
      ".C:0848  A0 28       LDY #$28       - A:fa X:00 Y:00 SP:f6 ..-..I.C    4021\n" +
      "Stopwatch:       3567\n" +
      "(C:$0848) ";
    expect(parseStopwatchReply(polluted)).toBe(3567);
  });

  it("should throw an error carrying the raw reply when no stopwatch line is present", () => {
    expect(() => parseStopwatchReply("(C:$e5cf) ")).toThrowError(/\(C:\$e5cf\)/);
  });
});
