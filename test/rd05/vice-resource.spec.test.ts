import { createServer } from "node:net";
import type { Socket } from "node:net";
import { describe, expect, it } from "vitest";
import { openViceMonitor } from "../m1/vice-monitor.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";

/** Exercise the real monitor against one process-attested loopback peer. */
async function withResourceReply(
  payload: readonly number[],
  error: number,
  inspect: (monitor: ViceMonitor, requests: Buffer[]) => Promise<void>,
) {
  const requests: Buffer[] = [];
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 11) {
        const size = 11 + pending.readUInt32LE(2);
        if (pending.length < size) return;
        const request = pending.subarray(0, size);
        pending = pending.subarray(size);
        requests.push(request);
        const response = Buffer.alloc(12 + payload.length);
        response[0] = 2;
        response[1] = 2;
        response.writeUInt32LE(payload.length, 2);
        response[6] = error === 0 ? 0x51 : 0;
        response[7] = error;
        response.writeUInt32LE(request.readUInt32LE(6), 8);
        response.set(payload, 12);
        socket.write(response);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("Missing TCP address");
  let monitor: ViceMonitor | undefined;
  try {
    monitor = await openViceMonitor(address.port, process.pid);
    expect(
      Reflect.get(monitor, "readIntegerResource"),
      "bounded integer-resource reader",
    ).toBeTypeOf("function");
    await inspect(monitor, requests);
  } finally {
    monitor?.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

/** Keep a missing planned method an assertion failure rather than a collection failure. */
async function resource(monitor: ViceMonitor, name: string): Promise<unknown> {
  const read: unknown = Reflect.get(monitor, "readIntegerResource");
  expect(read, "bounded integer-resource reader").toBeTypeOf("function");
  if (typeof read !== "function") throw new Error("Missing integer-resource reader");
  return Reflect.apply(read, monitor, [name]);
}

describe("bounded VICE integer resources", () => {
  // Each allowed name is encoded as one byte length followed by literal ASCII.
  it.each(["VICIIModel", "SidModel", "CIA1Model", "CIA2Model", "KernalRev"])(
    "should request %s with the resource-get command and decode its integer",
    async (name) => {
      await withResourceReply([1, 4, 3, 0, 0, 0], 0, async (monitor, requests) => {
        expect(await resource(monitor, name)).toBe(3);
        expect(requests).toHaveLength(1);
        const request = requests[0]!;
        expect([...request.subarray(0, 2)]).toEqual([2, 2]);
        expect(request[10]).toBe(0x51);
        expect(request.readUInt32LE(2)).toBe(name.length + 1);
        expect([...request.subarray(11)]).toEqual([name.length, ...Buffer.from(name, "ascii")]);
      });
    },
  );

  // Only the exact integer payload shape can attest an active machine setting.
  it.each([
    ["string type", [0, 4, 3, 0, 0, 0], 0],
    ["three-byte body", [1, 4, 3], 0],
    ["seven-byte body", [1, 4, 3, 0, 0, 0, 0], 0],
    ["wrong value length", [1, 3, 3, 0, 0, 0], 0],
    ["protocol error", [], 0x8f],
  ] as const)("should reject a %s reply", async (_name, payload, error) => {
    await withResourceReply(payload, error, async (monitor) => {
      await expect(resource(monitor, "VICIIModel")).rejects.toThrow();
    });
  });

  // This interface cannot become an unrestricted emulator configuration query.
  it.each(["VICII", "vicIImodel", "SidModel\0", "Sound", ""])(
    "should reject the undeclared resource name %j before transport",
    async (name) => {
      await withResourceReply([1, 4, 3, 0, 0, 0], 0, async (monitor, requests) => {
        await expect(resource(monitor, name)).rejects.toThrow();
        expect(requests).toEqual([]);
      });
    },
  );
});
