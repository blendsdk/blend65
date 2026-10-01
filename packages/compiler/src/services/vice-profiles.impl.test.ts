import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ChildProcess, spawn } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { fakeTool } from "../../test-support/fake-tool.js";
import { launchVice, probeVice } from "./vice.js";

describe("closed emulator selection and bounded cleanup", () => {
  it.each(["c64-pal", "c64-pal-prg-takeover-6581", "c64-ntsc-prg-kernal-8580;exit", ""])(
    "should reject runtime identity %j before invoking an executable",
    async (profile) => {
      // Node is a real executable which would fail at runtime if VICE flags reached it.
      expect(
        await Reflect.apply(launchVice, undefined, [process.execPath, "unused.prg", profile]),
      ).toBe("start");
    },
  );

  it("should preserve cancellation before either external process starts", async () => {
    const signal = AbortSignal.abort();
    expect(await probeVice(process.execPath, signal)).toBe("cancelled");
    expect(
      await launchVice(process.execPath, "unused.prg", "c64-pal-prg-kernal-6581", signal),
    ).toBe("cancelled");
  });

  it.skipIf(process.platform !== "win32")(
    "should classify a vanished native Windows executable as emulator-start",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "blend65-vice-vanished-"));
      try {
        expect(
          await launchVice(join(root, "x64sc.exe"), "unused.prg", "c64-pal-prg-kernal-6581"),
        ).toBe("start");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    },
  );

  it("should report uncertain probe cleanup without requiring a close event", async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-probe-cleanup-"));
    const executable = join(root, process.platform === "win32" ? "x64sc.exe" : "x64sc");
    const marker = join(root, "pid");
    const controller = new AbortController();
    const realKill = process.kill.bind(process);
    let pid: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: ReturnType<typeof probeVice> | undefined;
    try {
      await fakeTool(
        executable,
        `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(Number(process.env.BLEND65_FAKE_TOOL_PID) || process.pid));
setInterval(() => {}, 1000);
`,
      );
      pending = probeVice(executable, controller.signal);
      const deadline = performance.now() + 4_000;
      while (pid === undefined && performance.now() < deadline) {
        const text = await readFile(marker, "utf8").catch(() => "");
        if (/^[1-9][0-9]*$/u.test(text)) pid = Number(text);
        else await new Promise((resolve) => setTimeout(resolve, 20));
      }
      if (pid === undefined) throw new Error("Owned probe did not publish its process identity");
      const realChildKill = ChildProcess.prototype.kill;
      if (process.platform === "win32")
        vi.spyOn(ChildProcess.prototype, "kill").mockImplementation(function (
          this: ChildProcess,
          signal,
        ) {
          if (this.pid === pid)
            throw Object.assign(new Error("Owned process denied"), { code: "EPERM" });
          return realChildKill.call(this, signal);
        });
      else
        vi.spyOn(process, "kill").mockImplementation((candidate, signal) => {
          if (Math.abs(candidate) === pid)
            throw Object.assign(new Error("Owned process denied"), { code: "EPERM" });
          return realKill(candidate, signal);
        });
      controller.abort();
      await expect(
        Promise.race([
          pending,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Probe cleanup did not settle")), 3_000);
          }),
        ]),
      ).resolves.toBe("cleanup-uncertain");
    } finally {
      clearTimeout(timer);
      vi.restoreAllMocks();
      controller.abort();
      if (pid !== undefined) {
        try {
          realKill(process.platform === "win32" ? pid : -pid, "SIGKILL");
        } catch {
          /* The owned group may already have exited. */
        }
      }
      await pending;
      await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
    }
  }, 15_000);

  it.each(["launch", "probe"])(
    "should let a built Node caller exit after uncertain %s cleanup",
    async (mode) => {
      // Like the real CLI, this isolated consumer loads built JavaScript. Build the package
      // before running this file directly; repository verification builds before tests.
      const root = await mkdtemp(join(tmpdir(), "blend65-uncertain-exit-"));
      const executable = join(root, "x64sc");
      const marker = join(root, "pid");
      await fakeTool(
        executable,
        `require("node:fs").writeFileSync(${JSON.stringify(marker)}, String(Number(process.env.BLEND65_FAKE_TOOL_PID) || process.pid));
setInterval(() => {}, 1000);
`,
      );
      const moduleUrl = new URL("../../dist/services/vice.js", import.meta.url).href;
      const script = `
import { readFile } from "node:fs/promises";
import { ChildProcess } from "node:child_process";
import { launchVice, probeVice } from ${JSON.stringify(moduleUrl)};
const controller = new AbortController();
const executable = ${JSON.stringify(executable)};
const pending = ${JSON.stringify(mode)} === "probe"
  ? probeVice(executable, controller.signal)
  : launchVice(executable, "unused.prg", "c64-pal-prg-kernal-6581", controller.signal);
let pid;
const deadline = performance.now() + 4000;
while (!pid && performance.now() < deadline) {
  const value = await readFile(${JSON.stringify(marker)}, "utf8").catch(() => "");
  if (/^[1-9][0-9]*$/.test(value)) pid = Number(value);
  else await new Promise(resolve => setTimeout(resolve, 20));
}
if (!pid) throw new Error("Missing owned emulator identity");
const realKill = process.kill.bind(process);
if (process.platform === "win32") {
  const realChildKill = ChildProcess.prototype.kill;
  ChildProcess.prototype.kill = function (signal) {
    if (this.pid === pid) throw Object.assign(new Error("Denied"), { code: "EPERM" });
    return realChildKill.call(this, signal);
  };
} else process.kill = (candidate, signal) => {
  if (Math.abs(candidate) === pid) throw Object.assign(new Error("Denied"), { code: "EPERM" });
  return realKill(candidate, signal);
};
controller.abort();
const outcome = await pending;
process.stdout.write(outcome);
process.exitCode = outcome === "cleanup-uncertain" ? 10 : 1;
`;
      const driver = spawn(process.execPath, ["--input-type=module", "-e", script], {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      driver.stdout.on("data", (bytes: Buffer) => {
        output += bytes.toString();
      });
      driver.stderr.on("data", (bytes: Buffer) => {
        output += bytes.toString();
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const closed = new Promise<number | null>((resolve, reject) => {
        driver.once("error", reject);
        driver.once("close", resolve);
      });
      try {
        const code = await Promise.race([
          closed,
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`Caller stayed alive: ${output}`)), 8_000);
          }),
        ]);
        expect(output).toBe("cleanup-uncertain");
        expect(code).toBe(10);
        const pid = Number(await readFile(marker, "utf8"));
        if (process.platform === "win32") expect(pid).toBeGreaterThan(0);
        else expect(process.kill(pid, 0)).toBe(true);
      } finally {
        clearTimeout(timer);
        const text = await readFile(marker, "utf8").catch(() => "");
        if (/^[1-9][0-9]*$/u.test(text)) {
          try {
            process.kill(process.platform === "win32" ? Number(text) : -Number(text), "SIGKILL");
          } catch {
            /* Already stopped. */
          }
        }
        if (driver.exitCode === null && driver.signalCode === null) driver.kill("SIGKILL");
        await closed;
        await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
      }
    },
    15_000,
  );
});
