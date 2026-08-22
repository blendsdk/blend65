import { describe, expect, it, vi } from "vitest";

import {
  invokeBoundedAcmeV1,
  type AcmeInvocation,
  type AcmeProcessControlsV1,
} from "./invoke-acme.js";

const INVOCATION: AcmeInvocation = {
  acmeExe: "/tools/acme",
  asmPath: "/work/main.asm",
  binaryPath: "/work/main.prg",
  labelPath: "/work/main.lbl",
  reportPath: "/work/main.report",
  cwd: "/work",
};

function controls(): AcmeProcessControlsV1 {
  return {
    signal: new AbortController().signal,
    deadlineMonotonicMs: 10_000,
    onStdout: vi.fn(),
    onStderr: vi.fn(),
  };
}

describe("bounded ACME invocation", () => {
  it("should forward the exact invocation and controls without changing legacy argv behavior", async () => {
    const selectedControls = controls();
    const run = vi.fn(async () => ({ exitCode: 0, stderr: "" }));
    await expect(invokeBoundedAcmeV1(INVOCATION, { run }, selectedControls)).resolves.toEqual({
      exitCode: 0,
      stderr: "",
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(INVOCATION, selectedControls);
  });

  it("should preserve runner rejection for parent-side discovery classification", async () => {
    const unavailable = Object.assign(new Error("missing"), { code: "ENOENT" });
    await expect(
      invokeBoundedAcmeV1(
        INVOCATION,
        {
          run: async () => {
            throw unavailable;
          },
        },
        controls(),
      ),
    ).rejects.toBe(unavailable);
  });
});
