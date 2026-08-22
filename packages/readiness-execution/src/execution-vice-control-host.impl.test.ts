import net from "node:net";

import { describe, expect, it } from "vitest";

import type {
  ViceControlLaunchV1,
  ViceControlOwnedChildV1,
} from "@blend65/test-harness/vice-control";

import {
  createRecordedViceControlHostV1,
  prepareRecordedViceControlHostV1,
  type RecordedViceAttemptHostV1,
} from "./execution-vice-control-host.js";
import type { ViceLeaseNodeIdentityV1, ViceRecordedAttemptV1 } from "./execution-vice-types.js";

const DIRECTORY: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 11n,
  uid: 1000,
  mode: 0o700,
  links: 2,
};
const FILE: ViceLeaseNodeIdentityV1 = {
  device: 7n,
  inode: 12n,
  uid: 1000,
  mode: 0o600,
  links: 1,
};
const liveSignal = (): AbortSignal => new AbortController().signal;

function attempt(executable = "x64sc"): ViceRecordedAttemptV1 {
  return {
    target: "c64",
    claim: {
      directory: DIRECTORY,
      file: FILE,
      bytesDigest: "a".repeat(64),
    },
    generation: 1,
    nonce: "b".repeat(64),
    launchToken: new Uint8Array(32),
    launchTokenPath: `/run/user/1000/blend65/vice/c64/launch-${"0".repeat(64)}.json`,
    endpoints: { binaryPort: 20_000, textPort: 20_001 },
    executable,
    argv: ["-binarymonitor", "-binarymonitoraddress", "127.0.0.1:20000"],
    cwd: process.cwd(),
  };
}

function executionHost(
  overrides: Partial<RecordedViceAttemptHostV1> = {},
): RecordedViceAttemptHostV1 {
  return {
    nowMonotonicMilliseconds: () => 1,
    delay: async () => "elapsed",
    registerProcessHandle: () => undefined,
    observeProcess: async () => ({ ok: true, value: null }),
    observeLease: async () => ({ ok: true, value: { kind: "absent", directory: DIRECTORY } }),
    compareReplaceLease: async () => ({ ok: true, value: { kind: "changed" } }),
    compareRemoveLaunchArtifact: async () => ({ ok: true, value: "removed" }),
    revalidateAndTerminateVice: async () => ({ ok: true, value: "lease-changed" }),
    ...overrides,
  };
}

function launchRequest(
  recorded: ViceRecordedAttemptV1,
): Pick<ViceControlLaunchV1, "executable" | "argv" | "cwd"> {
  return {
    executable: recorded.executable,
    argv: recorded.argv,
    cwd: recorded.cwd,
  };
}

const foreignChild: ViceControlOwnedChildV1 = {
  identity: "foreign",
  exited: new Promise(() => undefined),
};

describe("recorded VICE control host guard surface", () => {
  it.each([
    [
      "executable",
      (request: ReturnType<typeof launchRequest>) => ({ ...request, executable: "x64" }),
    ],
    [
      "working directory",
      (request: ReturnType<typeof launchRequest>) => ({ ...request, cwd: "/" }),
    ],
    ["argument count", (request: ReturnType<typeof launchRequest>) => ({ ...request, argv: [] })],
    [
      "argument value",
      (request: ReturnType<typeof launchRequest>) => ({
        ...request,
        argv: request.argv.map((value, index) => (index === 2 ? "127.0.0.1:30000" : value)),
      }),
    ],
  ])("rejects a changed %s before spawning", async (_name, mutate) => {
    const recorded = attempt();
    const host = createRecordedViceControlHostV1(executionHost(), recorded);
    expect(await host.spawn(mutate(launchRequest(recorded)), liveSignal())).toMatchObject({
      ok: false,
      issue: { reason: "vice.request" },
    });
  });

  it("rejects cancelled and unprepared exact spawn requests", async () => {
    const recorded = attempt();
    const host = createRecordedViceControlHostV1(executionHost(), recorded);
    const aborted = new AbortController();
    aborted.abort();
    expect(await host.spawn(launchRequest(recorded), aborted.signal)).toMatchObject({
      ok: false,
      issue: { reason: "vice.cancelled" },
    });

    const unsupported = attempt("not-vice");
    expect(
      await createRecordedViceControlHostV1(executionHost(), unsupported).spawn(
        launchRequest(unsupported),
        liveSignal(),
      ),
    ).toMatchObject({ ok: false, issue: { reason: "vice.spawn" } });
  });

  it("fails closed when the fixed executable or its search path is unavailable", async () => {
    const priorPath = process.env.PATH;
    const recorded = attempt();
    try {
      delete process.env.PATH;
      await expect(
        prepareRecordedViceControlHostV1(executionHost(), recorded, 1000),
      ).rejects.toThrow();
      process.env.PATH = "relative-only";
      await expect(
        prepareRecordedViceControlHostV1(executionHost(), recorded, 1000),
      ).rejects.toThrow();
      await expect(
        prepareRecordedViceControlHostV1(executionHost(), attempt("not-vice"), 1000),
      ).rejects.toThrow();
    } finally {
      if (priorPath === undefined) delete process.env.PATH;
      else process.env.PATH = priorPath;
    }
  });

  it("rejects cancelled connections and foreign child capabilities", async () => {
    const host = createRecordedViceControlHostV1(executionHost(), attempt());
    const aborted = new AbortController();
    aborted.abort();
    expect(await host.connectLoopback("binary", 1, aborted.signal)).toMatchObject({
      ok: false,
      issue: { reason: "vice.cancelled" },
    });
    expect(await host.connectLoopback("binary", 1, liveSignal())).toMatchObject({
      ok: false,
      issue: { reason: "vice.connect" },
    });
    expect(await host.endpointBelongsToChild(foreignChild, "binary", 1)).toMatchObject({
      ok: false,
      issue: { reason: "vice.transport" },
    });
    expect(await host.closeOwnedChild(foreignChild)).toMatchObject({
      ok: false,
      issue: { reason: "vice.transport" },
    });
  });

  it("settles queued, cancelled and terminal raw socket readers without desynchronizing", async () => {
    let accept!: (socket: net.Socket) => void;
    const accepted = new Promise<net.Socket>((resolve) => {
      accept = resolve;
    });
    const server = net.createServer((socket) => accept(socket));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    expect(typeof address).toBe("object");
    if (typeof address !== "object" || address === null) return;
    const host = createRecordedViceControlHostV1(executionHost(), attempt());
    const connected = await host.connectLoopback("binary", address.port, liveSignal());
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;
    const peer = await accepted;
    const channel = connected.value;
    try {
      peer.write(Uint8Array.of(1));
      await new Promise((resolve) => setImmediate(resolve));
      expect(await channel.read()).toEqual({ ok: true, value: Uint8Array.of(1) });

      const cancelled = new AbortController();
      cancelled.abort();
      expect(await channel.read(cancelled.signal)).toMatchObject({
        ok: false,
        issue: { reason: "vice.cancelled" },
      });

      const pending = channel.read(liveSignal());
      peer.write(Uint8Array.of(2));
      expect(await pending).toEqual({ ok: true, value: Uint8Array.of(2) });

      const received = new Promise<Buffer>((resolve) => peer.once("data", resolve));
      expect(await channel.write(Uint8Array.of(3))).toEqual({ ok: true, value: true });
      expect(Uint8Array.from(await received)).toEqual(Uint8Array.of(3));

      const firstTerminal = channel.read(liveSignal());
      const secondTerminal = channel.read();
      peer.end();
      expect(await firstTerminal).toEqual({ ok: true, value: null });
      expect(await secondTerminal).toEqual({ ok: true, value: null });
      expect(await channel.read()).toEqual({ ok: true, value: null });
      expect(await channel.write(Uint8Array.of(4))).toMatchObject({
        ok: false,
        issue: { reason: "vice.closed" },
      });
      expect(await channel.close()).toEqual({ ok: true, value: true });
      expect(await channel.close()).toEqual({ ok: true, value: true });
    } finally {
      peer.destroy();
      await channel.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed when launcher process identity is unavailable", async () => {
    const recorded = attempt();
    expect(
      await createRecordedViceControlHostV1(executionHost(), recorded).spawn(
        launchRequest(recorded),
        liveSignal(),
      ),
    ).toMatchObject({ ok: false, issue: { reason: "vice.spawn" } });
  });

  it("fails closed when the lease changes after launcher identity observation", async () => {
    const recorded = attempt();
    const host = executionHost({
      observeProcess: async (pid) => ({
        ok: true,
        value: {
          bootId: "boot",
          pid,
          startTicks: 10n,
          processGroupId: pid,
          launchToken: recorded.launchToken,
        },
      }),
    });
    expect(
      await createRecordedViceControlHostV1(host, recorded).spawn(
        launchRequest(recorded),
        liveSignal(),
      ),
    ).toMatchObject({ ok: false, issue: { reason: "vice.spawn" } });
  });
});
