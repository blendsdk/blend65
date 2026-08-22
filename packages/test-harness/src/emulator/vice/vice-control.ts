import { NodeViceControlHost } from "./vice-control-host.js";
import { ViceControlSession } from "./vice-control-session.js";
import {
  viceControlFailure,
  viceControlSuccess,
  type ViceControlHostV1,
  type ViceControlLaunchV1,
  type ViceControlOwnedChildV1,
  type ViceControlRawChannelV1,
  type ViceControlResultV1,
  type ViceControlRuntimeV1,
  type ViceControlSessionV1,
} from "./vice-control-types.js";

export type {
  ViceCheckpointHitV1,
  ViceControlHostV1,
  ViceControlIssueV1,
  ViceControlLaunchV1,
  ViceControlOwnedChildV1,
  ViceControlRawChannelV1,
  ViceControlResultV1,
  ViceControlRuntimeV1,
  ViceControlSessionV1,
} from "./vice-control-types.js";

/** Fixed number of connection rounds within one low-level child attempt. */
const CONNECTION_ROUNDS = 60;
/** Delay between failed connection rounds. */
const CONNECTION_DELAY_MS = 250;
/** Maximum bounded length of any process-spawn string. */
const MAX_SPAWN_STRING_LENGTH = 16 * 1024;
/** Maximum number of exact argv entries accepted by the low-level runtime. */
const MAX_ARGV_ENTRIES = 1_024;

/** Returns whether one monitor endpoint is an exact non-privileged TCP port. */
function isPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65_535;
}

/** Validates all untrusted request structure before process creation. */
function validateLaunchRequest(request: ViceControlLaunchV1): boolean {
  if (typeof request !== "object" || request === null) return false;
  if (
    typeof request.executable !== "string" ||
    request.executable.length < 1 ||
    request.executable.length > MAX_SPAWN_STRING_LENGTH ||
    typeof request.cwd !== "string" ||
    request.cwd.length < 1 ||
    request.cwd.length > MAX_SPAWN_STRING_LENGTH ||
    !Array.isArray(request.argv) ||
    request.argv.length > MAX_ARGV_ENTRIES ||
    request.argv.some(
      (argument) =>
        typeof argument !== "string" ||
        argument.length > MAX_SPAWN_STRING_LENGTH ||
        argument.includes("\0"),
    ) ||
    request.executable.includes("\0") ||
    request.cwd.includes("\0")
  ) {
    return false;
  }
  const { binaryPort, textPort } = request.endpoints;
  const version = request.handshake.version;
  return (
    isPort(binaryPort) &&
    isPort(textPort) &&
    binaryPort !== textPort &&
    request.handshake.target === "c64" &&
    version.major === 3 &&
    Number.isInteger(version.minimumMinor) &&
    Number.isInteger(version.maximumMinor) &&
    version.minimumMinor >= 6 &&
    version.minimumMinor <= version.maximumMinor &&
    version.maximumMinor <= 255 &&
    (request.handshake.endpointOwnership === "required" ||
      request.handshake.endpointOwnership === "compatibility")
  );
}

/** Closes channels opened during an unsuccessful connection round. */
async function closeChannels(
  binary: ViceControlRawChannelV1 | undefined,
  text: ViceControlRawChannelV1 | undefined,
): Promise<void> {
  await Promise.all([binary?.close(), text?.close()]);
}

/** Maps any host ownership result into the stable fail-closed public reason. */
function endpointOwnershipFailure(): ViceControlResultV1<never> {
  return viceControlFailure(
    "vice.protocol",
    "vice.endpoint-owner",
    "VICE monitor endpoint ownership could not be proven.",
  );
}

/** Factory-scoped runtime that owns protocol, retry, and handshake policy. */
class ViceControlRuntime implements ViceControlRuntimeV1 {
  readonly #host: ViceControlHostV1;

  /** Creates a runtime over one least-authority raw host. */
  constructor(host: ViceControlHostV1) {
    this.#host = host;
  }

  /** Launches exactly one child and performs a bounded composite handshake. */
  async launch(
    request: ViceControlLaunchV1,
    signal: AbortSignal,
  ): Promise<ViceControlResultV1<ViceControlSessionV1>> {
    if (!validateLaunchRequest(request)) {
      return viceControlFailure("vice.protocol", "vice.request", "VICE launch request is invalid.");
    }
    if (signal.aborted) {
      return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE launch was cancelled.");
    }
    const spawned = await this.#host.spawn(
      { executable: request.executable, argv: request.argv, cwd: request.cwd },
      signal,
    );
    if (!spawned.ok) return spawned;
    const child = spawned.value;
    if (
      typeof child.identity !== "string" ||
      child.identity.length < 1 ||
      child.identity.length > 256
    ) {
      const closed = await this.#closeOwnedChild(child);
      if (!closed.ok) return this.#cleanupFailure();
      return viceControlFailure("vice.io", "vice.spawn", "VICE child identity is invalid.");
    }

    let childExited = false;
    void child.exited.then(() => {
      childExited = true;
    });
    const connected = await this.#connectMonitors(request, child, signal, () => childExited);
    if (!connected.ok) {
      const closed = await this.#closeOwnedChild(child);
      if (!closed.ok) return this.#cleanupFailure();
      return connected;
    }
    const { binary, text } = connected.value;

    if (request.handshake.endpointOwnership === "required") {
      const binaryOwner = await this.#host.endpointBelongsToChild(
        child,
        "binary",
        request.endpoints.binaryPort,
      );
      const textOwner = await this.#host.endpointBelongsToChild(
        child,
        "text",
        request.endpoints.textPort,
      );
      if (!binaryOwner.ok || !binaryOwner.value || !textOwner.ok || !textOwner.value) {
        await closeChannels(binary, text);
        const closed = await this.#closeOwnedChild(child);
        if (!closed.ok) return this.#cleanupFailure();
        return endpointOwnershipFailure();
      }
    }

    const session = new ViceControlSession(binary, text, child, this.#host, signal);
    const handshake = await session.handshake(request);
    if (!handshake.ok) {
      const closed = await session.close();
      if (!closed.ok) return this.#cleanupFailure();
      return handshake;
    }
    return viceControlSuccess(session);
  }

  /** Returns the terminal reason used when exact owned-child cleanup cannot be proven. */
  #cleanupFailure<T>(): ViceControlResultV1<T> {
    return viceControlFailure(
      "vice.closed",
      "vice.closed",
      "VICE owned-child cleanup could not be proven.",
    );
  }

  /** Attempts exact child cleanup even when an injected host throws. */
  async #closeOwnedChild(child: ViceControlOwnedChildV1): Promise<ViceControlResultV1<true>> {
    try {
      return await this.#host.closeOwnedChild(child);
    } catch {
      return this.#cleanupFailure();
    }
  }

  /** Connects binary then text monitors without respawning or changing ports. */
  async #connectMonitors(
    request: ViceControlLaunchV1,
    _child: ViceControlOwnedChildV1,
    signal: AbortSignal,
    childExited: () => boolean,
  ): Promise<
    ViceControlResultV1<{
      readonly binary: ViceControlRawChannelV1;
      readonly text: ViceControlRawChannelV1;
    }>
  > {
    const started = this.#host.nowMilliseconds();
    for (let round = 0; round < CONNECTION_ROUNDS; round += 1) {
      if (signal.aborted) {
        return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE launch was cancelled.");
      }
      if (childExited()) {
        return viceControlFailure(
          "vice.io",
          "vice.child-exited",
          "VICE child exited during launch.",
        );
      }
      const binary = await this.#host.connectLoopback(
        "binary",
        request.endpoints.binaryPort,
        signal,
      );
      if (binary.ok) {
        const text = await this.#host.connectLoopback("text", request.endpoints.textPort, signal);
        if (text.ok) return viceControlSuccess({ binary: binary.value, text: text.value });
        await binary.value.close();
        if (text.issue.reason === "vice.cancelled") return text;
      } else if (binary.issue.reason === "vice.cancelled") {
        return binary;
      }
      if (childExited()) {
        return viceControlFailure(
          "vice.io",
          "vice.child-exited",
          "VICE child exited during launch.",
        );
      }
      const elapsed = this.#host.nowMilliseconds() - started;
      if (round + 1 >= CONNECTION_ROUNDS || elapsed + CONNECTION_DELAY_MS > 15_000) break;
      if ((await this.#host.delay(CONNECTION_DELAY_MS, signal)) === "aborted") {
        return viceControlFailure("vice.cancelled", "vice.cancelled", "VICE launch was cancelled.");
      }
    }
    return viceControlFailure("vice.io", "vice.connect", "VICE monitor connection failed.");
  }
}

/**
 * Creates a VICE control runtime over a raw host.
 *
 * @param host Optional least-authority operating-system boundary. Omit it to use the
 * platform-neutral Node compatibility host; positive endpoint ownership still requires
 * an injected host that can prove it.
 * @returns A runtime that owns framing, correlation, retry, and handshake policy.
 *
 * @example
 * ```ts
 * const runtime = createViceControlRuntimeV1(host);
 * const session = await runtime.launch(request, AbortSignal.timeout(15_000));
 * ```
 */
export function createViceControlRuntimeV1(
  host: ViceControlHostV1 = new NodeViceControlHost(),
): ViceControlRuntimeV1 {
  return Object.freeze(new ViceControlRuntime(host));
}

/** Process-wide production runtime used by the convenience launch helper. */
const DEFAULT_VICE_CONTROL_RUNTIME_V1 = createViceControlRuntimeV1();

/**
 * Launches one production VICE control session through the shared runtime.
 *
 * @example
 * ```ts
 * const launched = await launchViceControlV1(request, AbortSignal.timeout(15_000));
 * ```
 */
export function launchViceControlV1(
  request: ViceControlLaunchV1,
  signal: AbortSignal,
): Promise<ViceControlResultV1<ViceControlSessionV1>> {
  return DEFAULT_VICE_CONTROL_RUNTIME_V1.launch(request, signal);
}
