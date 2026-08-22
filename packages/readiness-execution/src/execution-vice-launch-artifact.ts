import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, rename, unlink } from "node:fs/promises";

import type { ViceProcessIdentityFactV1, ViceRecordedAttemptV1 } from "./execution-vice-types.js";

const ARTIFACT_SCHEMA = "blend65-vice-launch-v1";
const MAX_ARTIFACT_BYTES = 128 * 1024;
const HEX_64 = /^[0-9a-f]{64}$/;

/** Durable launch description exchanged only between the coordinator and its launcher. */
export interface ViceLaunchArtifactV1 {
  readonly schema: typeof ARTIFACT_SCHEMA;
  readonly target: "c64";
  readonly generation: number;
  readonly nonce: string;
  readonly launchToken: string;
  readonly binaryPort: number;
  readonly textPort: number;
  readonly executable: string;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly display: string;
  readonly state: "prepared" | "identity-recorded" | "lease-recorded";
  readonly identity: {
    readonly bootId: string;
    readonly pid: number;
    readonly startTicks: string;
    readonly processGroupId: number;
  } | null;
}

/** Returns whether two artifacts retain the exact immutable launch description. */
export function matchesViceLaunchDescriptionV1(
  left: ViceLaunchArtifactV1,
  right: ViceLaunchArtifactV1,
): boolean {
  return (
    left.schema === right.schema &&
    left.target === right.target &&
    left.generation === right.generation &&
    left.nonce === right.nonce &&
    left.launchToken === right.launchToken &&
    left.binaryPort === right.binaryPort &&
    left.textPort === right.textPort &&
    left.executable === right.executable &&
    left.cwd === right.cwd &&
    left.display === right.display &&
    left.argv.length === right.argv.length &&
    left.argv.every((argument, index) => argument === right.argv[index])
  );
}

/** Returns whether two artifacts are the same exact state transition input. */
function sameArtifact(left: ViceLaunchArtifactV1, right: ViceLaunchArtifactV1): boolean {
  return (
    matchesViceLaunchDescriptionV1(left, right) &&
    left.state === right.state &&
    (left.identity === null
      ? right.identity === null
      : right.identity !== null &&
        left.identity.bootId === right.identity.bootId &&
        left.identity.pid === right.identity.pid &&
        left.identity.startTicks === right.identity.startTicks &&
        left.identity.processGroupId === right.identity.processGroupId)
  );
}

/** Returns the canonical fixed-namespace token path for one exact launch token. */
export function viceLaunchTokenPathV1(uid: number, launchToken: Uint8Array): string {
  if (!Number.isSafeInteger(uid) || uid < 0 || launchToken.byteLength !== 32) {
    throw new TypeError("VICE launch-token path input is invalid.");
  }
  return `/run/user/${uid}/blend65/vice/c64/launch-${Buffer.from(launchToken).toString("hex")}.json`;
}

/** Validates that a path is exactly one canonical launch-token artifact. */
export function isCanonicalViceLaunchTokenPathV1(path: string, uid: number): boolean {
  return new RegExp(`^/run/user/${uid}/blend65/vice/c64/launch-[0-9a-f]{64}\\.json$`).test(path);
}

function parseArtifact(bytes: Uint8Array): ViceLaunchArtifactV1 {
  if (bytes.byteLength < 2 || bytes.byteLength > MAX_ARTIFACT_BYTES) {
    throw new TypeError("VICE launch artifact has an invalid size.");
  }
  const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("VICE launch artifact is invalid.");
  }
  const record = value as Record<string, unknown>;
  const identity = record.identity as Record<string, unknown> | null;
  if (
    Object.keys(record).length !== 13 ||
    record.schema !== ARTIFACT_SCHEMA ||
    record.target !== "c64" ||
    !Number.isSafeInteger(record.generation) ||
    (record.generation as number) < 1 ||
    typeof record.nonce !== "string" ||
    !HEX_64.test(record.nonce) ||
    typeof record.launchToken !== "string" ||
    !HEX_64.test(record.launchToken) ||
    !Number.isInteger(record.binaryPort) ||
    !Number.isInteger(record.textPort) ||
    (record.binaryPort as number) < 1 ||
    (record.binaryPort as number) > 65_535 ||
    (record.textPort as number) < 1 ||
    (record.textPort as number) > 65_535 ||
    record.binaryPort === record.textPort ||
    typeof record.executable !== "string" ||
    record.executable.length < 1 ||
    record.executable.length > 16 * 1024 ||
    record.executable.includes("\0") ||
    typeof record.cwd !== "string" ||
    record.cwd.length < 1 ||
    record.cwd.length > 16 * 1024 ||
    record.cwd.includes("\0") ||
    typeof record.display !== "string" ||
    record.display.length > 128 ||
    record.display.includes("\0") ||
    !Array.isArray(record.argv) ||
    record.argv.length > 1_024 ||
    record.argv.some(
      (argument) =>
        typeof argument !== "string" || argument.length > 16 * 1024 || argument.includes("\0"),
    ) ||
    (record.state !== "prepared" &&
      record.state !== "identity-recorded" &&
      record.state !== "lease-recorded") ||
    (identity !== null &&
      (typeof identity !== "object" ||
        Object.keys(identity).length !== 4 ||
        typeof identity.bootId !== "string" ||
        identity.bootId.length < 1 ||
        identity.bootId.length > 128 ||
        !Number.isSafeInteger(identity.pid) ||
        (identity.pid as number) <= 0 ||
        typeof identity.startTicks !== "string" ||
        !/^\d+$/.test(identity.startTicks) ||
        !Number.isSafeInteger(identity.processGroupId) ||
        (identity.processGroupId as number) <= 0))
  ) {
    throw new TypeError("VICE launch artifact fields are invalid.");
  }
  return Object.freeze(value as ViceLaunchArtifactV1);
}

/** Reads a bounded mode-0600 single-link artifact without following its final component. */
export async function readViceLaunchArtifactV1(
  path: string,
  uid: number,
): Promise<ViceLaunchArtifactV1> {
  if (!isCanonicalViceLaunchTokenPathV1(path, uid))
    throw new TypeError("VICE launch path is invalid.");
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat({ bigint: true });
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      Number(stat.uid) !== uid ||
      Number(stat.mode & 0o7777n) !== 0o600 ||
      Number(stat.nlink) !== 1 ||
      stat.size > BigInt(MAX_ARTIFACT_BYTES)
    )
      throw new TypeError("VICE launch artifact identity is invalid.");
    return parseArtifact(Uint8Array.from(await handle.readFile()));
  } finally {
    await handle.close();
  }
}

async function replaceArtifact(
  path: string,
  uid: number,
  expected: ViceLaunchArtifactV1,
  artifact: ViceLaunchArtifactV1,
): Promise<void> {
  if (!isCanonicalViceLaunchTokenPathV1(path, uid))
    throw new TypeError("VICE launch path is invalid.");
  const directory = path.slice(0, path.lastIndexOf("/"));
  const temporary = `${directory}/.launch-${randomBytes(16).toString("hex")}.tmp`;
  const handle = await open(
    temporary,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(artifact));
    if (bytes.byteLength > MAX_ARTIFACT_BYTES)
      throw new TypeError("VICE launch artifact is too large.");
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    const current = await readViceLaunchArtifactV1(path, uid);
    if (!sameArtifact(current, expected)) {
      throw new TypeError("VICE launch artifact changed before replacement.");
    }
    const directoryStat = await lstat(directory, { bigint: true });
    if (
      !directoryStat.isDirectory() ||
      directoryStat.isSymbolicLink() ||
      Number(directoryStat.uid) !== uid
    ) {
      throw new TypeError("VICE launch directory is invalid.");
    }
    await rename(temporary, path);
    const directoryHandle = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/** Creates the canonical launch-token artifact before a launcher exists. */
export async function createViceLaunchArtifactV1(
  attempt: ViceRecordedAttemptV1,
  uid: number,
  resolvedExecutable: string,
): Promise<ViceLaunchArtifactV1> {
  const expectedPath = viceLaunchTokenPathV1(uid, attempt.launchToken);
  if (attempt.launchTokenPath !== expectedPath)
    throw new TypeError("VICE launch-token path changed.");
  const artifact: ViceLaunchArtifactV1 = Object.freeze({
    schema: ARTIFACT_SCHEMA,
    target: "c64",
    generation: attempt.generation,
    nonce: attempt.nonce,
    launchToken: Buffer.from(attempt.launchToken).toString("hex"),
    binaryPort: attempt.endpoints.binaryPort,
    textPort: attempt.endpoints.textPort,
    executable: resolvedExecutable,
    argv: Object.freeze([...attempt.argv]),
    cwd: attempt.cwd,
    display: process.env.DISPLAY ?? "",
    state: "prepared",
    identity: null,
  });
  const handle = await open(
    expectedPath,
    constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(artifact));
      if (bytes.byteLength > MAX_ARTIFACT_BYTES)
        throw new TypeError("VICE launch artifact is too large.");
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const directory = expectedPath.slice(0, expectedPath.lastIndexOf("/"));
    const directoryHandle = await open(
      directory,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    try {
      await directoryHandle.sync();
    } finally {
      await directoryHandle.close();
    }
  } catch (error) {
    await unlink(expectedPath).catch(() => undefined);
    throw error;
  }
  return artifact;
}

/** Durably records the launcher's own same-PID identity before it may exec VICE. */
export async function recordViceLauncherIdentityV1(
  path: string,
  uid: number,
  identity: ViceProcessIdentityFactV1,
): Promise<ViceLaunchArtifactV1> {
  const current = await readViceLaunchArtifactV1(path, uid);
  if (current.state !== "prepared" || current.identity !== null)
    throw new TypeError("VICE launch state changed.");
  const next: ViceLaunchArtifactV1 = Object.freeze({
    ...current,
    state: "identity-recorded",
    identity: Object.freeze({
      bootId: identity.bootId,
      pid: identity.pid,
      startTicks: identity.startTicks.toString(10),
      processGroupId: identity.processGroupId,
    }),
  });
  await replaceArtifact(path, uid, current, next);
  return next;
}

/** Allows exec only after the exact identity has been stored in the lease. */
export async function authorizeViceLauncherExecV1(
  path: string,
  uid: number,
  prepared: ViceLaunchArtifactV1,
  identity: ViceProcessIdentityFactV1,
): Promise<void> {
  const current = await readViceLaunchArtifactV1(path, uid);
  if (
    current.state !== "identity-recorded" ||
    current.identity === null ||
    !matchesViceLaunchDescriptionV1(current, prepared) ||
    current.identity.bootId !== identity.bootId ||
    current.identity.pid !== identity.pid ||
    current.identity.startTicks !== identity.startTicks.toString(10) ||
    current.identity.processGroupId !== identity.processGroupId
  )
    throw new TypeError("VICE launch identity is absent.");
  await replaceArtifact(path, uid, current, Object.freeze({ ...current, state: "lease-recorded" }));
}

/** Converts a finalized artifact into exact process facts after cross-checking its token. */
export function processFactFromViceLaunchArtifactV1(
  artifact: ViceLaunchArtifactV1,
  path: string,
): ViceProcessIdentityFactV1 | undefined {
  if (artifact.identity === null || artifact.state === "prepared") return undefined;
  return Object.freeze({
    bootId: artifact.identity.bootId,
    pid: artifact.identity.pid,
    startTicks: BigInt(artifact.identity.startTicks),
    processGroupId: artifact.identity.processGroupId,
    launchToken: Uint8Array.from(Buffer.from(artifact.launchToken, "hex")),
    launchTokenPath: path,
  });
}
