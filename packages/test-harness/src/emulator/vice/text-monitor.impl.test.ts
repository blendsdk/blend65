/**
 * Implementation tests for `TextMonitorClient`'s transport behavior: replies
 * split across TCP frames, stale pre-send output (stop banners) being
 * drained, and socket death mid-exchange. A local loopback stub serves
 * canned monitor bytes — the parser itself is spec-tested separately.
 */

import { afterEach, describe, expect, it } from "vitest";
import net from "node:net";

import { TextMonitorClient } from "./text-monitor.js";

/** A loopback stub that reacts to received text with a scripted handler. */
interface StubMonitor {
  port: number;
  close: () => void;
}

function startStub(
  onConnection: (socket: net.Socket) => void,
): Promise<StubMonitor> {
  return new Promise((resolve, reject) => {
    const server = net.createServer(onConnection);
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr !== null ? addr.port : 0;
      resolve({ port, close: () => server.close() });
    });
  });
}

describe("Implementation: TextMonitorClient transport", () => {
  let stub: StubMonitor | undefined;
  let client: TextMonitorClient | undefined;

  afterEach(() => {
    client?.close();
    client = undefined;
    stub?.close();
    stub = undefined;
  });

  it("should assemble a reply split across multiple TCP frames", async () => {
    stub = await startStub((socket) => {
      socket.setEncoding("latin1");
      socket.on("data", (text: string) => {
        if (text.includes("stopwatch")) {
          socket.write("Stopwatch:    35");
          setTimeout(() => socket.write("67\n(C:$e5cf) "), 15);
        }
      });
    });
    client = new TextMonitorClient();
    await client.connect(stub.port);
    expect(await client.readStopwatch()).toBe(3567);
  });

  it("should drain stale pre-send output, including a prompt-terminated stop banner", async () => {
    stub = await startStub((socket) => {
      socket.setEncoding("latin1");
      // Unsolicited stop banner BEFORE any command — it even ends in a full
      // prompt, so an undrained reader would treat it as the reply.
      socket.write(
        "#1 (Stop on  exec 0848)\n" +
          ".C:0848  A0 28       LDY #$28       - A:00 X:00 Y:00 SP:f6 ..-..I.C    4021\n" +
          "(C:$0848) ",
      );
      socket.on("data", (text: string) => {
        if (text.includes("stopwatch")) {
          socket.write("Stopwatch:       99\n(C:$e5cf) ");
        }
      });
    });
    client = new TextMonitorClient();
    await client.connect(stub.port);
    // Give the banner time to arrive so the drain has something to discard.
    await new Promise((r) => setTimeout(r, 40));
    expect(await client.readStopwatch()).toBe(99);
  });

  it("should reject the in-flight exchange when the socket dies", async () => {
    stub = await startStub((socket) => {
      socket.setEncoding("latin1");
      socket.on("data", () => socket.destroy());
    });
    client = new TextMonitorClient();
    await client.connect(stub.port);
    await expect(client.readStopwatch()).rejects.toThrowError(/socket closed/);
  });
});
