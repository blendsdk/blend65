import { readFile } from "node:fs/promises";

import {
  matchesViceLaunchDescriptionV1,
  processFactFromViceLaunchArtifactV1,
  readViceLaunchArtifactV1,
  recordViceLauncherIdentityV1,
} from "./execution-vice-launch-artifact.js";

/** Reads the launcher's exact Linux PID/start/group identity. */
async function observeSelf() {
  const pid = process.pid;
  const stat = await readFile(`/proc/${pid}/stat`, "utf8");
  const commandEnd = stat.lastIndexOf(")");
  if (commandEnd < 0) throw new TypeError("Launcher identity is malformed.");
  const fields = stat
    .slice(commandEnd + 2)
    .trim()
    .split(/\s+/);
  if (!/^\d+$/.test(fields[2] ?? "") || !/^\d+$/.test(fields[19] ?? "")) {
    throw new TypeError("Launcher identity is malformed.");
  }
  return Object.freeze({
    bootId: (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim(),
    pid,
    startTicks: BigInt(fields[19]),
    processGroupId: Number(fields[2]),
    launchToken: null,
    launchTokenPath: null,
  });
}

/** Waits for the coordinator's durable lease-record acknowledgement. */
async function waitForAuthorization(path: string, uid: number, deadline: number) {
  for (;;) {
    const artifact = await readViceLaunchArtifactV1(path, uid);
    if (artifact.state === "lease-recorded") return artifact;
    if (artifact.state !== "identity-recorded" || Date.now() >= deadline) {
      throw new TypeError("VICE launcher authorization failed.");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
}

/** Records this PID, waits for the lease CAS, then replaces the same PID with VICE. */
async function main(): Promise<never> {
  const execve = process.execve;
  const uid = process.geteuid?.();
  const path = process.argv[2];
  if (
    typeof execve !== "function" ||
    uid === undefined ||
    path === undefined ||
    process.argv.length !== 3
  ) {
    throw new TypeError("VICE launcher environment is unavailable.");
  }
  const prepared = await readViceLaunchArtifactV1(path, uid);
  if (prepared.state !== "prepared" || prepared.identity !== null) {
    throw new TypeError("VICE launcher artifact was already consumed.");
  }
  const self = await observeSelf();
  const recorded = await recordViceLauncherIdentityV1(path, uid, self);
  const fact = processFactFromViceLaunchArtifactV1(recorded, path);
  if (fact === undefined || fact.pid !== process.pid || fact.startTicks !== self.startTicks) {
    throw new TypeError("VICE launcher identity recording failed.");
  }
  const authorized = await waitForAuthorization(path, uid, Date.now() + 15_000);
  if (
    !matchesViceLaunchDescriptionV1(authorized, prepared) ||
    authorized.identity?.pid !== process.pid ||
    authorized.identity.startTicks !== self.startTicks.toString(10)
  ) {
    throw new TypeError("VICE launcher authorization identity changed.");
  }
  process.chdir(authorized.cwd);
  return execve(
    authorized.executable,
    [authorized.executable, ...authorized.argv],
    Object.freeze({
      LANG: "C",
      LC_ALL: "C",
      TZ: "UTC",
      ...(authorized.display.length === 0 ? {} : { DISPLAY: authorized.display }),
    }),
  );
}

void main().catch(() => {
  process.exitCode = 127;
});
