import { describe, expect, it } from "vitest";
import { runCli } from "./main.js";

describe("caller-owned output adapter", () => {
  it.each(["--help", "--version", "unknown"])(
    "should propagate output-sink failures for %s unchanged",
    async (argument) => {
      const failure = new Error("Caller output sink failed");
      const fail = () => {
        throw failure;
      };
      await expect(runCli([argument], { stdout: fail, stderr: fail })).rejects.toBe(failure);
    },
  );
});
