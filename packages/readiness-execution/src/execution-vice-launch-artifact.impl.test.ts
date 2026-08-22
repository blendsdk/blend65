import { randomBytes } from "node:crypto";
import { chmod, readFile, unlink, writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  authorizeViceLauncherExecV1,
  createViceLaunchArtifactV1,
  processFactFromViceLaunchArtifactV1,
  readViceLaunchArtifactV1,
  recordViceLauncherIdentityV1,
  viceLaunchTokenPathV1,
} from "./execution-vice-launch-artifact.js";
import { defaultViceExecutionHostV1 } from "./execution-vice-host.js";
import type { ViceRecordedAttemptV1 } from "./execution-vice-types.js";

function launchAttempt(
  token: Uint8Array,
  path: string,
  claim: ViceRecordedAttemptV1["claim"],
  argv: readonly string[] = ["-silent"],
): ViceRecordedAttemptV1 {
  return {
    target: "c64",
    claim,
    generation: 1,
    nonce: "a".repeat(64),
    launchToken: token,
    launchTokenPath: path,
    endpoints: { binaryPort: 20_000, textPort: 20_001 },
    executable: "x64sc",
    argv,
    cwd: process.cwd(),
  };
}

describe.skipIf(process.platform !== "linux")("VICE durable launch-token artifact", () => {
  it("records the launcher's exact identity before authorizing same-PID exec", async () => {
    const uid = process.geteuid?.();
    if (uid === undefined) return;
    const namespace = await defaultViceExecutionHostV1.observeLease(
      "c64",
      new AbortController().signal,
    );
    expect(namespace.ok).toBe(true);
    if (!namespace.ok) return;
    const token = Uint8Array.from(randomBytes(32));
    const path = viceLaunchTokenPathV1(uid, token);
    const attempt = launchAttempt(
      token,
      path,
      namespace.value.kind === "present"
        ? namespace.value.reference
        : {
            directory: namespace.value.directory,
            file: namespace.value.directory,
            bytesDigest: "0".repeat(64),
          },
    );
    try {
      await createViceLaunchArtifactV1(attempt, uid, "/usr/bin/false");
      const prepared = await readViceLaunchArtifactV1(path, uid);
      expect(prepared).toMatchObject({ state: "prepared", identity: null });
      expect(processFactFromViceLaunchArtifactV1(prepared, path)).toBeUndefined();
      const self = await defaultViceExecutionHostV1.observeProcess(
        process.pid,
        new AbortController().signal,
      );
      expect(self.ok && self.value !== null).toBe(true);
      if (!self.ok || self.value === null) return;
      await expect(authorizeViceLauncherExecV1(path, uid, prepared, self.value)).rejects.toThrow();
      const recorded = await recordViceLauncherIdentityV1(path, uid, self.value);
      const fact = processFactFromViceLaunchArtifactV1(recorded, path);
      expect(fact).toMatchObject({ pid: process.pid, launchTokenPath: path });
      expect(fact?.launchToken).toEqual(token);
      await expect(recordViceLauncherIdentityV1(path, uid, self.value)).rejects.toThrow();
      const recordedBytes = await readFile(path);
      const changed = { ...recorded, cwd: "/" };
      await writeFile(path, JSON.stringify(changed));
      await expect(authorizeViceLauncherExecV1(path, uid, prepared, self.value)).rejects.toThrow();
      await writeFile(path, recordedBytes);
      await authorizeViceLauncherExecV1(path, uid, prepared, self.value);
      expect(await readViceLaunchArtifactV1(path, uid)).toMatchObject({ state: "lease-recorded" });
      await expect(authorizeViceLauncherExecV1(path, uid, prepared, self.value)).rejects.toThrow();
    } finally {
      await unlink(path).catch(() => undefined);
    }
  });

  it("rejects non-canonical, malformed, oversized and weak artifact inputs", async () => {
    const uid = process.geteuid?.();
    if (uid === undefined) return;
    const namespace = await defaultViceExecutionHostV1.observeLease(
      "c64",
      new AbortController().signal,
    );
    expect(namespace.ok).toBe(true);
    if (!namespace.ok) return;
    const claim =
      namespace.value.kind === "present"
        ? namespace.value.reference
        : {
            directory: namespace.value.directory,
            file: namespace.value.directory,
            bytesDigest: "0".repeat(64),
          };
    const token = Uint8Array.from(randomBytes(32));
    const path = viceLaunchTokenPathV1(uid, token);
    expect(() => viceLaunchTokenPathV1(-1, token)).toThrow();
    expect(() => viceLaunchTokenPathV1(uid, token.subarray(0, 31))).toThrow();
    await expect(readViceLaunchArtifactV1("/tmp/not-a-vice-token.json", uid)).rejects.toThrow();
    await expect(
      createViceLaunchArtifactV1(
        launchAttempt(token, `${path}.changed`, claim),
        uid,
        "/usr/bin/false",
      ),
    ).rejects.toThrow();

    const priorDisplay = process.env.DISPLAY;
    try {
      process.env.DISPLAY = ":99";
      await createViceLaunchArtifactV1(launchAttempt(token, path, claim), uid, "/usr/bin/false");
      expect(await readViceLaunchArtifactV1(path, uid)).toMatchObject({ display: ":99" });
      const validBytes = await readFile(path);
      const valid = JSON.parse(validBytes.toString("utf8")) as Record<string, unknown>;
      for (const malformed of [
        Uint8Array.of(0x7b),
        new TextEncoder().encode("null"),
        new TextEncoder().encode(JSON.stringify({ ...valid, schema: "changed" })),
      ]) {
        await writeFile(path, malformed);
        await expect(readViceLaunchArtifactV1(path, uid)).rejects.toThrow();
      }
      await writeFile(path, validBytes);
      await chmod(path, 0o644);
      await expect(readViceLaunchArtifactV1(path, uid)).rejects.toThrow();
      await chmod(path, 0o600);
    } finally {
      if (priorDisplay === undefined) delete process.env.DISPLAY;
      else process.env.DISPLAY = priorDisplay;
      await unlink(path).catch(() => undefined);
    }

    const headlessToken = Uint8Array.from(randomBytes(32));
    const headlessPath = viceLaunchTokenPathV1(uid, headlessToken);
    try {
      delete process.env.DISPLAY;
      await createViceLaunchArtifactV1(
        launchAttempt(headlessToken, headlessPath, claim),
        uid,
        "/usr/bin/false",
      );
      expect(await readViceLaunchArtifactV1(headlessPath, uid)).toMatchObject({ display: "" });
    } finally {
      if (priorDisplay === undefined) delete process.env.DISPLAY;
      else process.env.DISPLAY = priorDisplay;
      await unlink(headlessPath).catch(() => undefined);
    }

    const oversizedToken = Uint8Array.from(randomBytes(32));
    const oversizedPath = viceLaunchTokenPathV1(uid, oversizedToken);
    try {
      await expect(
        createViceLaunchArtifactV1(
          launchAttempt(oversizedToken, oversizedPath, claim, ["x".repeat(128 * 1024)]),
          uid,
          "/usr/bin/false",
        ),
      ).rejects.toThrow();
    } finally {
      await unlink(oversizedPath).catch(() => undefined);
    }
  });
});
