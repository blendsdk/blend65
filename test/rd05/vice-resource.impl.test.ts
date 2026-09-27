import { createServer } from "node:net";
import type { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { openViceMonitor } from "../m1/vice-monitor.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { startVice } from "../m1/vice-runtime.js";

/** Feed one owned loopback response through the real monitor's transport decoder. */
async function withPeer(mode: string, inspect: (monitor: ViceMonitor) => Promise<void>) {
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    let bytes = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      bytes = Buffer.concat([bytes, chunk]);
      if (bytes.length < 11 || bytes.length < 11 + bytes.readUInt32LE(2)) return;
      if (mode === "disconnect") {
        socket.destroy();
        return;
      }
      const response = Buffer.alloc(18);
      response[0] = mode === "header" ? 0 : 2;
      response[1] = 2;
      response.writeUInt32LE(mode === "oversized" ? 1_048_577 : 6, 2);
      response[6] = mode === "wrong-type" ? 0x52 : 0x51;
      response.writeUInt32LE(bytes.readUInt32LE(6) + (mode === "unknown-request" ? 1 : 0), 8);
      response.set([1, 4, 255, 255, 255, 255], 12);
      if (mode === "fragment") {
        socket.write(response.subarray(0, 5));
        setImmediate(() => socket.write(response.subarray(5)));
      } else socket.write(response);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing peer port");
  let monitor: ViceMonitor | undefined;
  try {
    monitor = await openViceMonitor(address.port, process.pid);
    await inspect(monitor);
  } finally {
    monitor?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

describe("integer-resource transport edges", () => {
  it("should decode an unsigned integer across a fragmented response", async () => {
    await withPeer("fragment", async (monitor) => {
      expect(await monitor.readIntegerResource("VICIIModel")).toBe(0xffff_ffff);
    });
  });

  it.each(["disconnect", "header", "oversized", "wrong-type", "unknown-request"])(
    "should reject a %s response without returning a machine identity",
    async (mode) => {
      await withPeer(mode, async (monitor) => {
        await expect(monitor.readIntegerResource("VICIIModel")).rejects.toThrow();
      });
    },
  );

  it.each(["c64-pal", "c64-ntsc-prg-kernal-8580;exit", "toString"])(
    "should reject helper profile %j before discovering or launching VICE",
    async (profile) => {
      await expect(
        Reflect.apply(startVice, undefined, ["unused.prg", 1000, profile]),
      ).rejects.toThrow("exact cooperative C64 profile");
    },
  );
});
