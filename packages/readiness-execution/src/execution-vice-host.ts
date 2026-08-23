import { randomBytes } from "node:crypto";
import type { BigIntStats } from "node:fs";
import {
  constants,
  link,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
  type FileHandle,
} from "node:fs/promises";
import net from "node:net";
import { performance } from "node:perf_hooks";

import type { ViceControlHostV1 } from "@blend65/test-harness/vice-control";
import type { ExecutionOperationIssueCodeV1, ExecutionOperationResultV1 } from "@blend65/readiness";

import {
  prepareRecordedViceControlHostV1,
  type RecordedViceAttemptHostV1,
} from "./execution-vice-control-host.js";
import {
  isCanonicalViceLaunchTokenPathV1,
  processFactFromViceLaunchArtifactV1,
  readViceLaunchArtifactV1,
} from "./execution-vice-launch-artifact.js";
import type { ExecutionProcessHandleV1 } from "./execution-process.js";
import {
  digestViceLeaseBytesV1,
  MAX_VICE_LEASE_BYTES_V1,
  parseViceLeaseRecordV1,
  processFactMatchesRecordV1,
  processFactToRecordV1,
} from "./execution-vice-record.js";
import type {
  ViceExecutionHostV1,
  ViceLeaseMutationV1,
  ViceLeaseNodeIdentityV1,
  ViceLeaseReferenceV1,
  ViceLeaseSnapshotV1,
  ViceLoopbackEndpointsV1,
  ViceProcessIdentityFactV1,
  ViceRecordedAttemptV1,
  ViceTerminationRequestV1,
} from "./execution-vice-types.js";

/** Fixed lease filename inside the trusted target namespace. */
const LEASE_FILENAME = "lease-v1.json";
/** Fixed cooperative mutation owner inside the pinned target directory. */
const MUTATION_LOCK_FILENAME = ".mutation-lock-v1.json";
/** Bounded lock claim size. */
const MAX_MUTATION_LOCK_BYTES = 2_048;

/** Pinned descriptor-relative namespace used for one complete observation or mutation. */
interface PinnedNamespace {
  readonly handle: FileHandle;
  readonly canonicalDirectory: string;
  readonly directory: ViceLeaseNodeIdentityV1;
  readonly fdDirectory: string;
  readonly lease: string;
}

/** Exact durable cooperative mutation owner. */
interface MutationOwner {
  readonly bootId: string;
  readonly pid: number;
  readonly startTicks: string;
  readonly token: string;
}

/** Exact single-link lock observation retained across stale-owner reclamation. */
interface MutationOwnerObservation {
  readonly owner: MutationOwner;
  readonly file: ViceLeaseNodeIdentityV1;
  readonly bytesDigest: string;
}

/** Creates one immutable passive-operation failure. */
function failure<T>(
  code: ExecutionOperationIssueCodeV1,
  path: string,
  message: string,
): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([Object.freeze({ code, path, message })]) as readonly [
      {
        readonly code: ExecutionOperationIssueCodeV1;
        readonly path: string;
        readonly message: string;
      },
    ],
  });
}

/** Creates one immutable passive-operation success. */
function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

/** Converts a bigint filesystem stat into bounded public identity facts. */
function nodeIdentity(stat: BigIntStats): ViceLeaseNodeIdentityV1 {
  return Object.freeze({
    device: stat.dev,
    inode: stat.ino,
    uid: Number(stat.uid),
    mode: Number(stat.mode & 0o7777n),
    links: Number(stat.nlink),
  });
}

/** Tests retained directory identity while treating link count as topology metadata. */
function sameDirectory(left: ViceLeaseNodeIdentityV1, right: ViceLeaseNodeIdentityV1): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.uid === right.uid &&
    left.mode === right.mode
  );
}

/** Tests exact retained regular-file identity, including its single-link fact. */
function sameFile(left: ViceLeaseNodeIdentityV1, right: ViceLeaseNodeIdentityV1): boolean {
  return sameDirectory(left, right) && left.links === right.links;
}

/** Tests an exact compare-and-swap reference. */
function sameReference(left: ViceLeaseReferenceV1, right: ViceLeaseReferenceV1): boolean {
  return (
    sameDirectory(left.directory, right.directory) &&
    sameFile(left.file, right.file) &&
    left.bytesDigest === right.bytesDigest
  );
}

/** Returns the fixed runtime and target path for one effective user. */
function namespacePaths(uid: number): { readonly directory: string; readonly lease: string } {
  const directory = `/run/user/${uid}/blend65/vice/c64`;
  return { directory, lease: `${directory}/${LEASE_FILENAME}` };
}

/** Opens and pins the final namespace directory after validating every fixed component. */
async function openPinnedNamespace(uid: number): Promise<PinnedNamespace> {
  const expected = await ensureNamespace(uid);
  const canonicalDirectory = namespacePaths(uid).directory;
  const handle = await open(
    canonicalDirectory,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const stat = await handle.stat({ bigint: true });
    const directory = nodeIdentity(stat);
    const pathStat = nodeIdentity(await lstat(canonicalDirectory, { bigint: true }));
    if (
      !stat.isDirectory() ||
      !sameDirectory(directory, expected) ||
      !sameDirectory(directory, pathStat)
    ) {
      throw new TypeError("Lease namespace identity changed while opening.");
    }
    const fdDirectory = `/proc/self/fd/${handle.fd}`;
    return {
      handle,
      canonicalDirectory,
      directory,
      fdDirectory,
      lease: `${fdDirectory}/${LEASE_FILENAME}`,
    };
  } catch (error) {
    await handle.close();
    throw error;
  }
}

/** Revalidates that the fixed canonical path still names the pinned directory. */
async function revalidatePinnedNamespace(namespace: PinnedNamespace): Promise<boolean> {
  const path = nodeIdentity(await lstat(namespace.canonicalDirectory, { bigint: true }));
  const pinned = nodeIdentity(await namespace.handle.stat({ bigint: true }));
  return sameDirectory(path, namespace.directory) && sameDirectory(pinned, namespace.directory);
}

/** Creates and validates each fixed directory component without following a final symlink. */
async function ensureNamespace(uid: number): Promise<ViceLeaseNodeIdentityV1> {
  const runtime = `/run/user/${uid}`;
  const blend65 = `${runtime}/blend65`;
  const vice = `${blend65}/vice`;
  const target = `${vice}/c64`;
  for (const [path, create] of [
    [runtime, false],
    [blend65, true],
    [vice, true],
    [target, true],
  ] as const) {
    if (create) {
      try {
        await mkdir(path, { mode: 0o700 });
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
      }
    }
    const stat = await lstat(path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new TypeError("Lease namespace is not a directory.");
    const identity = nodeIdentity(stat);
    if (
      identity.uid !== uid ||
      identity.mode !== 0o700 ||
      !Number.isSafeInteger(identity.links) ||
      identity.links < 1
    ) {
      throw new TypeError("Lease namespace ownership is invalid.");
    }
  }
  return nodeIdentity(await lstat(target, { bigint: true }));
}

/** Opens a lease without following links and reads bounded stable bytes. */
async function readLeaseFile(
  path: string,
): Promise<{ readonly file: ViceLeaseNodeIdentityV1; readonly bytes: Uint8Array } | undefined> {
  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size > BigInt(MAX_VICE_LEASE_BYTES_V1)
    ) {
      throw new TypeError("Lease file is not a bounded regular file.");
    }
    const bytes = Uint8Array.from(await handle.readFile());
    const after = await handle.stat({ bigint: true });
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size) {
      throw new TypeError("Lease file changed during observation.");
    }
    return { file: nodeIdentity(after), bytes };
  } finally {
    await handle.close();
  }
}

/** Reads and validates one bounded cooperative lock owner. */
async function readMutationOwner(path: string): Promise<MutationOwnerObservation | undefined> {
  const observed = await readLeaseFile(path);
  if (observed === undefined || observed.file.mode !== 0o600 || observed.file.links !== 1) {
    return undefined;
  }
  if (observed.bytes.byteLength > MAX_MUTATION_LOCK_BYTES) return undefined;
  try {
    const value: unknown = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(observed.bytes),
    );
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (
      Object.keys(record).length !== 4 ||
      typeof record.bootId !== "string" ||
      record.bootId.length < 1 ||
      record.bootId.length > 128 ||
      !Number.isSafeInteger(record.pid) ||
      (record.pid as number) <= 0 ||
      typeof record.startTicks !== "string" ||
      !/^\d+$/.test(record.startTicks) ||
      typeof record.token !== "string" ||
      !/^[0-9a-f]{64}$/.test(record.token)
    )
      return undefined;
    return Object.freeze({
      owner: Object.freeze({
        bootId: record.bootId,
        pid: record.pid as number,
        startTicks: record.startTicks,
        token: record.token,
      }),
      file: observed.file,
      bytesDigest: digestViceLeaseBytesV1(observed.bytes),
    });
  } catch {
    return undefined;
  }
}

/** Returns whether a durable lock owner still denotes its exact live process. */
async function mutationOwnerIsLive(owner: MutationOwner): Promise<boolean> {
  const bootId = (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
  if (bootId !== owner.bootId) return false;
  const process = await readLinuxProcess(owner.pid);
  return process !== null && process.startTicks.toString(10) === owner.startTicks;
}

/** Acquires the fixed descriptor-relative mutation lock, reclaiming only proven-stale owners. */
async function acquireMutationLock(
  namespace: PinnedNamespace,
): Promise<(() => Promise<void>) | undefined> {
  const ownerPath = `${namespace.fdDirectory}/${MUTATION_LOCK_FILENAME}`;
  for (let round = 0; round < 4; round += 1) {
    if (
      (await readdir(namespace.fdDirectory)).some((name) => name.startsWith(".mutation-reclaim-"))
    ) {
      return undefined;
    }
    const self = await readLinuxProcess(process.pid);
    if (self === null) throw new TypeError("Mutation owner identity is unavailable.");
    const owner: MutationOwner = Object.freeze({
      bootId: (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim(),
      pid: process.pid,
      startTicks: self.startTicks.toString(10),
      token: randomBytes(32).toString("hex"),
    });
    const candidate = `${namespace.fdDirectory}/.mutation-candidate-${owner.token}`;
    const handle = await open(
      candidate,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(new TextEncoder().encode(JSON.stringify(owner)));
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await link(candidate, ownerPath);
      await unlink(candidate);
      await namespace.handle.sync();
      const acquired = await readMutationOwner(ownerPath);
      if (
        acquired === undefined ||
        acquired.owner.bootId !== owner.bootId ||
        acquired.owner.pid !== owner.pid ||
        acquired.owner.startTicks !== owner.startTicks ||
        acquired.owner.token !== owner.token
      ) {
        return undefined;
      }
      return async (): Promise<void> => {
        const retained = await readMutationOwner(ownerPath);
        if (retained?.owner.token === owner.token) {
          await unlink(ownerPath);
          await namespace.handle.sync();
        }
      };
    } catch (error) {
      await unlink(candidate).catch(() => undefined);
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
    }

    const stale = await readMutationOwner(ownerPath);
    if (stale === undefined) return undefined;
    if (await mutationOwnerIsLive(stale.owner)) return undefined;
    const reclaim = `${namespace.fdDirectory}/.mutation-reclaim-${stale.owner.token}`;
    try {
      await link(ownerPath, reclaim);
    } catch {
      continue;
    }
    try {
      const current = await readLeaseFile(ownerPath);
      const retained = await readLeaseFile(reclaim);
      if (
        current !== undefined &&
        retained !== undefined &&
        current.file.device === stale.file.device &&
        current.file.inode === stale.file.inode &&
        retained.file.device === stale.file.device &&
        retained.file.inode === stale.file.inode &&
        digestViceLeaseBytesV1(current.bytes) === stale.bytesDigest &&
        digestViceLeaseBytesV1(retained.bytes) === stale.bytesDigest
      ) {
        await unlink(ownerPath);
        await namespace.handle.sync();
      }
    } finally {
      await unlink(reclaim).catch(() => undefined);
    }
  }
  return undefined;
}

/** Observes a lease only through the already-pinned directory descriptor. */
async function observePinnedLease(namespace: PinnedNamespace): Promise<ViceLeaseSnapshotV1> {
  if (!(await revalidatePinnedNamespace(namespace))) {
    throw new TypeError("Lease namespace path no longer names the pinned directory.");
  }
  const observed = await readLeaseFile(namespace.lease);
  if (observed === undefined) {
    return Object.freeze({ kind: "absent", directory: namespace.directory });
  }
  const reference: ViceLeaseReferenceV1 = Object.freeze({
    directory: namespace.directory,
    file: observed.file,
    bytesDigest: digestViceLeaseBytesV1(observed.bytes),
  });
  return Object.freeze({
    kind: "present",
    directory: namespace.directory,
    file: observed.file,
    bytes: observed.bytes.slice(),
    reference,
  });
}

/** Parses Linux `/proc/<pid>/stat` without being confused by spaces in the command name. */
async function readLinuxProcess(
  pid: number,
): Promise<{ readonly startTicks: bigint; readonly processGroupId: number } | null> {
  let stat: string;
  try {
    stat = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
  const commandEnd = stat.lastIndexOf(")");
  if (commandEnd < 0) throw new TypeError("Process stat is malformed.");
  const fields = stat
    .slice(commandEnd + 2)
    .trim()
    .split(/\s+/);
  if (!/^\d+$/.test(fields[2] ?? "") || !/^\d+$/.test(fields[19] ?? "")) {
    throw new TypeError("Process identity is malformed.");
  }
  return { processGroupId: Number(fields[2]), startTicks: BigInt(fields[19]) };
}

/** Production fixed-namespace host. */
class LinuxViceExecutionHost implements ViceExecutionHostV1, RecordedViceAttemptHostV1 {
  readonly #processes = new Map<
    number,
    {
      readonly process: ViceProcessIdentityFactV1;
      readonly handle: ExecutionProcessHandleV1;
    }
  >();

  async platform(
    _signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<"linux" | "unsupported">> {
    return success(process.platform === "linux" ? "linux" : "unsupported");
  }

  async effectiveUid(_signal: AbortSignal): Promise<ExecutionOperationResultV1<number>> {
    return typeof process.geteuid === "function"
      ? success(process.geteuid())
      : failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
  }

  nowMonotonicMilliseconds(): number {
    return performance.now();
  }

  async delay(milliseconds: number, signal: AbortSignal): Promise<"elapsed" | "aborted"> {
    if (signal.aborted) return "aborted";
    return new Promise((resolve) => {
      const abort = (): void => {
        clearTimeout(timer);
        resolve("aborted");
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        resolve("elapsed");
      }, milliseconds);
      signal.addEventListener("abort", abort, { once: true });
    });
  }

  randomBytes(byteLength: 32): Uint8Array {
    return Uint8Array.from(randomBytes(byteLength));
  }

  async observeLease(
    _target: "c64",
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseSnapshotV1>> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    try {
      const uid = process.geteuid?.();
      if (uid === undefined)
        return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
      const namespace = await openPinnedNamespace(uid);
      try {
        return success(await observePinnedLease(namespace));
      } finally {
        await namespace.handle.close();
      }
    } catch {
      return failure(
        "execution.identity",
        "/lease",
        "Lease namespace is unavailable or untrusted.",
      );
    }
  }

  async tryCreateLease(
    _target: "c64",
    expectedDirectory: ViceLeaseNodeIdentityV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    const uid = process.geteuid?.();
    if (uid === undefined)
      return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
    try {
      const namespace = await openPinnedNamespace(uid);
      const release = await acquireMutationLock(namespace);
      if (release === undefined) {
        await namespace.handle.close();
        return success({ kind: "changed" });
      }
      try {
        const directory = namespace.directory;
        if (
          !sameDirectory(directory, expectedDirectory) ||
          bytes.byteLength > MAX_VICE_LEASE_BYTES_V1
        )
          return success({ kind: "changed" });
        let handle: FileHandle;
        try {
          handle = await open(
            namespace.lease,
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
            0o600,
          );
        } catch (error) {
          if (error instanceof Error && "code" in error && error.code === "EEXIST")
            return success({ kind: "occupied" });
          throw error;
        }
        try {
          await handle.writeFile(bytes.slice());
          await handle.sync();
        } finally {
          await handle.close();
        }
        await namespace.handle.sync();
        const snapshot = await observePinnedLease(namespace);
        return success({ kind: "created", snapshot });
      } finally {
        await release();
        await namespace.handle.close();
      }
    } catch {
      return failure("execution.io", "/lease", "Lease creation failed.");
    }
  }

  async compareReplaceLease(
    _target: "c64",
    expected: ViceLeaseReferenceV1,
    bytes: Uint8Array,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    const uid = process.geteuid?.();
    if (uid === undefined || bytes.byteLength > MAX_VICE_LEASE_BYTES_V1)
      return failure("execution.identity", "/lease", "Lease replacement is invalid.");
    let temporary = "";
    try {
      const namespace = await openPinnedNamespace(uid);
      const release = await acquireMutationLock(namespace);
      if (release === undefined) {
        await namespace.handle.close();
        return success({ kind: "changed" });
      }
      try {
        const current = await observePinnedLease(namespace);
        if (current.kind !== "present") return success({ kind: "missing" });
        if (!sameReference(current.reference, expected)) return success({ kind: "changed" });
        temporary = `${namespace.fdDirectory}/.lease-${randomBytes(16).toString("hex")}.tmp`;
        const handle = await open(
          temporary,
          constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
          0o600,
        );
        try {
          await handle.writeFile(bytes.slice());
          await handle.sync();
        } finally {
          await handle.close();
        }
        const revalidated = await observePinnedLease(namespace);
        if (revalidated.kind !== "present" || !sameReference(revalidated.reference, expected)) {
          await unlink(temporary).catch(() => undefined);
          return success({ kind: "changed" });
        }
        if (!(await revalidatePinnedNamespace(namespace))) {
          await unlink(temporary).catch(() => undefined);
          return success({ kind: "changed" });
        }
        await rename(temporary, namespace.lease);
        await namespace.handle.sync();
        return success({ kind: "replaced", snapshot: await observePinnedLease(namespace) });
      } finally {
        await release();
        await namespace.handle.close();
      }
    } catch {
      if (temporary.length > 0) await unlink(temporary).catch(() => undefined);
      return failure("execution.io", "/lease", "Lease replacement failed.");
    }
  }

  async compareRemoveLease(
    _target: "c64",
    expected: ViceLeaseReferenceV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLeaseMutationV1>> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    try {
      const uid = process.geteuid?.();
      if (uid === undefined)
        return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
      const namespace = await openPinnedNamespace(uid);
      const release = await acquireMutationLock(namespace);
      if (release === undefined) {
        await namespace.handle.close();
        return success({ kind: "changed" });
      }
      try {
        const current = await observePinnedLease(namespace);
        if (current.kind !== "present") return success({ kind: "missing" });
        if (!sameReference(current.reference, expected)) return success({ kind: "changed" });
        if (!(await revalidatePinnedNamespace(namespace))) return success({ kind: "changed" });
        const record = parseViceLeaseRecordV1(current.bytes);
        await unlink(namespace.lease);
        const tokenPath = record?.child?.launchTokenPath ?? record?.attempt?.launchTokenPath;
        if (
          tokenPath !== undefined &&
          tokenPath.startsWith(`${namespace.canonicalDirectory}/launch-`)
        ) {
          await unlink(
            `${namespace.fdDirectory}/${tokenPath.slice(tokenPath.lastIndexOf("/") + 1)}`,
          ).catch(() => undefined);
        }
        await namespace.handle.sync();
        return success({ kind: "removed" });
      } finally {
        await release();
        await namespace.handle.close();
      }
    } catch {
      return failure("execution.io", "/lease", "Lease removal failed.");
    }
  }

  async compareRemoveLaunchArtifact(
    _target: "c64",
    expected: ViceLeaseReferenceV1,
    launchTokenPath: string,
    expectedProcess: ViceProcessIdentityFactV1 | null,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<"removed" | "missing" | "changed" | "process-present">> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    const uid = process.geteuid?.();
    if (uid === undefined)
      return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
    if (!isCanonicalViceLaunchTokenPathV1(launchTokenPath, uid)) {
      return failure("execution.identity", "/launch-token", "Launch-token path is invalid.");
    }
    let namespace: PinnedNamespace | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      namespace = await openPinnedNamespace(uid);
      release = await acquireMutationLock(namespace);
      if (release === undefined) return success("changed");
      const lease = await observePinnedLease(namespace);
      if (lease.kind !== "present" || !sameReference(lease.reference, expected)) {
        return success("changed");
      }
      const record = parseViceLeaseRecordV1(lease.bytes);
      const retainedPath = record?.child?.launchTokenPath ?? record?.attempt?.launchTokenPath;
      if (record === undefined || retainedPath !== launchTokenPath) return success("changed");
      let artifact;
      let artifactIdentity: ViceLeaseNodeIdentityV1;
      try {
        artifact = await readViceLaunchArtifactV1(launchTokenPath, uid);
        artifactIdentity = nodeIdentity(await lstat(launchTokenPath, { bigint: true }));
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "ENOENT"
          ? success("missing")
          : success("changed");
      }
      if (expectedProcess === null) {
        if (record.child !== null || artifact.state !== "prepared" || artifact.identity !== null) {
          return success("changed");
        }
      } else {
        const artifactProcess = processFactFromViceLaunchArtifactV1(artifact, launchTokenPath);
        if (
          artifactProcess === undefined ||
          (record.child === null
            ? artifact.state !== "identity-recorded"
            : !processFactMatchesRecordV1(expectedProcess, record.child)) ||
          !processFactMatchesRecordV1(artifactProcess, processFactToRecordV1(expectedProcess))
        ) {
          return success("changed");
        }
        const observed = await this.observeProcess(expectedProcess.pid, signal, launchTokenPath);
        if (!observed.ok) return observed;
        if (observed.value !== null) return success("process-present");
      }
      if (!(await revalidatePinnedNamespace(namespace))) return success("changed");
      const immediateArtifact = await readViceLaunchArtifactV1(launchTokenPath, uid);
      const immediateIdentity = nodeIdentity(await lstat(launchTokenPath, { bigint: true }));
      if (
        !sameFile(immediateIdentity, artifactIdentity) ||
        JSON.stringify(immediateArtifact) !== JSON.stringify(artifact)
      ) {
        return success("changed");
      }
      await unlink(
        `${namespace.fdDirectory}/${launchTokenPath.slice(launchTokenPath.lastIndexOf("/") + 1)}`,
      );
      await namespace.handle.sync();
      return success("removed");
    } catch {
      return failure("execution.io", "/launch-token", "Launch-token removal failed.");
    } finally {
      if (release !== undefined) await release().catch(() => undefined);
      if (namespace !== undefined) await namespace.handle.close().catch(() => undefined);
    }
  }

  async observeProcess(
    pid: number,
    signal: AbortSignal,
    launchTokenPath?: string,
  ): Promise<ExecutionOperationResultV1<ViceProcessIdentityFactV1 | null>> {
    if (!Number.isSafeInteger(pid) || pid <= 0)
      return failure("execution.invalid-schema", "/pid", "Process id is invalid.");
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    try {
      const observed = await readLinuxProcess(pid);
      if (observed === null) return success(null);
      const bootId = (await readFile("/proc/sys/kernel/random/boot_id", "utf8")).trim();
      let tokenFact: ViceProcessIdentityFactV1 | undefined;
      const retained = this.#processes.get(pid);
      const artifactPath = launchTokenPath ?? retained?.process.launchTokenPath ?? undefined;
      if (artifactPath !== undefined) {
        const uid = process.geteuid?.();
        if (uid === undefined)
          return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
        tokenFact = processFactFromViceLaunchArtifactV1(
          await readViceLaunchArtifactV1(artifactPath, uid),
          artifactPath,
        );
        if (
          tokenFact === undefined ||
          tokenFact.pid !== pid ||
          tokenFact.bootId !== bootId ||
          tokenFact.startTicks !== observed.startTicks ||
          tokenFact.processGroupId !== observed.processGroupId
        ) {
          return failure("execution.identity", "/process", "Launch-token identity changed.");
        }
      }
      return success(
        Object.freeze({
          bootId,
          pid,
          startTicks: observed.startTicks,
          processGroupId: observed.processGroupId,
          launchToken: tokenFact?.launchToken?.slice() ?? null,
          launchTokenPath: artifactPath ?? null,
        }),
      );
    } catch {
      return failure("execution.io", "/process", "Process identity is unreadable.");
    }
  }

  async allocateLoopbackEndpoints(
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceLoopbackEndpointsV1>> {
    const first = await this.#freePort(signal);
    if (!first.ok) return first;
    let second = await this.#freePort(signal);
    while (second.ok && second.value === first.value) second = await this.#freePort(signal);
    return second.ok
      ? success(Object.freeze({ binaryPort: first.value, textPort: second.value }))
      : second;
  }

  async createControlAttempt(
    attempt: ViceRecordedAttemptV1,
    signal: AbortSignal,
  ): Promise<ExecutionOperationResultV1<ViceControlHostV1>> {
    if (typeof process.execve !== "function")
      return failure("tier-unavailable", "/execve", "Same-PID execve is unavailable.");
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    const uid = process.geteuid?.();
    if (uid === undefined)
      return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
    try {
      return success(await prepareRecordedViceControlHostV1(this, attempt, uid));
    } catch {
      return failure(
        "execution.io",
        "/launch-token",
        "VICE launch-token artifact could not be created.",
      );
    }
  }

  async revalidateAndTerminateVice(
    request: ViceTerminationRequestV1,
    signal: AbortSignal,
  ): Promise<
    ExecutionOperationResultV1<
      "signalled" | "already-exited" | "lease-changed" | "identity-changed"
    >
  > {
    const uid = process.geteuid?.();
    if (uid === undefined)
      return failure("tier-unavailable", "/uid", "Effective user identity is unavailable.");
    let namespace: PinnedNamespace | undefined;
    let release: (() => Promise<void>) | undefined;
    try {
      namespace = await openPinnedNamespace(uid);
      release = await acquireMutationLock(namespace);
      if (release === undefined) return success("lease-changed");
      const lease = await observePinnedLease(namespace);
      if (lease.kind !== "present" || !sameReference(lease.reference, request.lease))
        return success("lease-changed");
      const record = parseViceLeaseRecordV1(lease.bytes);
      if (
        record === undefined ||
        record.generation !== request.generation ||
        record.nonce !== request.nonce ||
        record.child === null ||
        !processFactMatchesRecordV1(request.process, record.child) ||
        request.process.launchTokenPath === null ||
        request.process.launchTokenPath === undefined
      )
        return success("lease-changed");
      const processFact = await this.observeProcess(
        request.process.pid,
        signal,
        request.process.launchTokenPath,
      );
      if (!processFact.ok) return processFact;
      if (processFact.value === null) return success("already-exited");
      if (!processFactMatchesRecordV1(processFact.value, processFactToRecordV1(request.process)))
        return success("identity-changed");
      const retained = this.#processes.get(request.process.pid);
      if (
        retained === undefined ||
        !processFactMatchesRecordV1(retained.process, processFactToRecordV1(request.process))
      )
        return success("identity-changed");
      const ownership = await retained.handle.revalidateIdentity();
      if (ownership === "absent" || ownership === false) return success("already-exited");
      if (ownership !== "present" && ownership !== true) return success("identity-changed");
      const immediate = await this.observeProcess(
        request.process.pid,
        signal,
        request.process.launchTokenPath,
      );
      if (
        !immediate.ok ||
        immediate.value === null ||
        !processFactMatchesRecordV1(immediate.value, processFactToRecordV1(request.process))
      )
        return success("identity-changed");
      await retained.handle.terminate(request.phase === "graceful" ? "SIGTERM" : "SIGKILL", {
        signal,
        deadlineMonotonicMs: performance.now() + 2_000,
      });
      return success("signalled");
    } catch {
      return failure("execution.io", "/process", "VICE termination failed.");
    } finally {
      if (release !== undefined) await release().catch(() => undefined);
      if (namespace !== undefined) await namespace.handle.close().catch(() => undefined);
    }
  }

  /** Binds an exact durable process fact to its authenticated anchor capability. */
  registerProcessHandle(
    processFact: ViceProcessIdentityFactV1,
    handle: ExecutionProcessHandleV1,
  ): void {
    this.#processes.set(processFact.pid, { process: processFact, handle });
    void handle.completion.then(
      () => this.#processes.delete(processFact.pid),
      () => this.#processes.delete(processFact.pid),
    );
  }

  async #freePort(signal: AbortSignal): Promise<ExecutionOperationResultV1<number>> {
    if (signal.aborted) return failure("execution.stale-authority", "", "Operation is cancelled.");
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", () =>
        resolve(failure("execution.io", "/endpoint", "Loopback endpoint allocation failed.")),
      );
      server.listen(0, "127.0.0.1", () => {
        const address = server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        server.close(() =>
          resolve(
            port > 0
              ? success(port)
              : failure("execution.io", "/endpoint", "Loopback endpoint is invalid."),
          ),
        );
      });
    });
  }
}

/** Process-wide production host for the fixed Linux VICE namespace. */
export const defaultViceExecutionHostV1: ViceExecutionHostV1 = new LinuxViceExecutionHost();
