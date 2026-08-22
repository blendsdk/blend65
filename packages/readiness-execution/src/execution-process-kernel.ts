import { fileURLToPath } from "node:url";

import type { ExecutionOperationResultV1 } from "@blend65/readiness";

import type {
  ExecutionChildIdentityV1,
  ExecutionProcessExitV1,
  ExecutionProcessHandleV1,
  ExecutionProcessRequestV1,
  ExecutionProcessRuntimeV1,
  ExecutionProcessSinkV1,
} from "./execution-process.js";
import {
  EXECUTION_PROCESS_ENVIRONMENT_V1,
  EXECUTION_PROCESS_KERNEL_LIMITS_V1,
  anchorFrameCodecV1,
  hostIdentityToWire,
  parentFrameCodecV1,
  validHostIdentity,
  validKernelArgv,
  wireIdentityToHost,
  type ExecutionAnchorSpawnInputV1,
  type ExecutionControlReadV1,
  type ExecutionGroupMembershipQueryV1,
  type ExecutionGroupMembershipV1,
  type ExecutionHostProcessExitV1,
  type ExecutionHostProcessIdentityV1,
  type ExecutionProcessAnchorFrameV1,
  type ExecutionProcessAnchorTransportV1,
  type ExecutionProcessControlTransportV1,
  type ExecutionProcessParentFrameV1,
  type ExecutionSelfGroupSignalV1,
  type ExecutionSpawnedAnchorV1,
  type ExecutionSpawnedTargetV1,
  type ExecutionTargetSpawnInputV1,
} from "./execution-process-kernel-protocol.js";
import type { ExecutionCancellationV1 } from "./execution-worker-protocol.js";
import { defaultExecutionProcessParentHostV1 } from "./execution-process-linux-host.js";

export {
  EXECUTION_PROCESS_KERNEL_LIMITS_V1,
  type ExecutionAnchorSpawnInputV1,
  type ExecutionControlReadV1,
  type ExecutionGroupMembershipQueryV1,
  type ExecutionGroupMembershipV1,
  type ExecutionHostProcessExitV1,
  type ExecutionHostProcessIdentityV1,
  type ExecutionProcessAnchorFrameBaseV1,
  type ExecutionProcessAnchorFrameV1,
  type ExecutionProcessAnchorTransportV1,
  type ExecutionProcessControlTransportV1,
  type ExecutionProcessEnvironmentV1,
  type ExecutionProcessParentFrameV1,
  type ExecutionProcessWireIdentityV1,
  type ExecutionSelfGroupSignalV1,
  type ExecutionSpawnedAnchorV1,
  type ExecutionSpawnedTargetV1,
  type ExecutionTargetSpawnInputV1,
} from "./execution-process-kernel-protocol.js";

/** Parent-side host authority. It deliberately exposes no signal operation. */
export interface ExecutionProcessParentHostV1 {
  randomBytes(byteLength: 32): Uint8Array;
  spawnAnchor(
    input: ExecutionAnchorSpawnInputV1,
    sink: ExecutionProcessSinkV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionSpawnedAnchorV1>>;
  observeGroup(
    input: ExecutionGroupMembershipQueryV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionGroupMembershipV1>;
}

/** Anchor-side host authority, including only a signal to its own process group. */
export interface ExecutionProcessAnchorHostV1 {
  observeSelf(
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionHostProcessIdentityV1>>;
  spawnTarget(
    input: ExecutionTargetSpawnInputV1,
    sink: ExecutionProcessSinkV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionOperationResultV1<ExecutionSpawnedTargetV1>>;
  signalSelfProcessGroup(
    input: ExecutionSelfGroupSignalV1,
  ): Promise<ExecutionOperationResultV1<void>>;
  observeGroup(
    input: ExecutionGroupMembershipQueryV1,
    cancellation: ExecutionCancellationV1,
  ): Promise<ExecutionGroupMembershipV1>;
}

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: Error): void;
}

function deferred<T>(): Deferred<T> {
  let resolve = (_value: T): void => undefined;
  let reject = (_reason: Error): void => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function issue<T>(message: string): ExecutionOperationResultV1<T> {
  return Object.freeze({
    ok: false,
    issues: Object.freeze([
      Object.freeze({ code: "execution.io" as const, path: "/process", message }),
    ]) as readonly [
      { readonly code: "execution.io"; readonly path: string; readonly message: string },
    ],
  });
}

function success<T>(value: T): ExecutionOperationResultV1<T> {
  return Object.freeze({ ok: true, value });
}

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Process control failed.";
  return raw.slice(0, EXECUTION_PROCESS_KERNEL_LIMITS_V1.protocolMessageBytes);
}

function sameIdentity(
  left: ExecutionHostProcessIdentityV1,
  right: ExecutionHostProcessIdentityV1,
): boolean {
  return (
    left.bootId === right.bootId &&
    left.pid === right.pid &&
    left.startTicks === right.startTicks &&
    left.processGroupId === right.processGroupId &&
    left.sessionId === right.sessionId
  );
}

function validRequest(request: ExecutionProcessRequestV1): boolean {
  return (
    typeof request === "object" &&
    request !== null &&
    validKernelArgv(request.executable, request.argv, request.cwd) &&
    Number.isFinite(request.deadline.hardDeadlineMs) &&
    Number.isFinite(request.deadline.workDeadlineMs) &&
    Number.isSafeInteger(request.deadline.cleanupGraceMs) &&
    request.deadline.cleanupGraceMs > 0 &&
    request.deadline.hardDeadlineMs > request.deadline.workDeadlineMs
  );
}

function validAnchor(identity: ExecutionHostProcessIdentityV1): boolean {
  return (
    validHostIdentity(identity) &&
    identity.pid === identity.processGroupId &&
    identity.pid === identity.sessionId
  );
}

function validTarget(
  anchor: ExecutionHostProcessIdentityV1,
  target: ExecutionHostProcessIdentityV1,
): boolean {
  return (
    validHostIdentity(target) &&
    target.bootId === anchor.bootId &&
    target.processGroupId === anchor.processGroupId &&
    target.sessionId === anchor.sessionId &&
    target.pid !== anchor.pid &&
    target.startTicks !== anchor.startTicks
  );
}

function targetExit(exit: ExecutionHostProcessExitV1): ExecutionProcessExitV1 | undefined {
  if (exit.kind === "exit") return Object.freeze({ exitCode: exit.exitCode, signal: null });
  if (exit.kind === "signal") return Object.freeze({ exitCode: null, signal: exit.signal });
  return undefined;
}

function parentFrame(
  nonce: string,
  sequence: number,
  fields:
    | { readonly kind: "bootstrap" }
    | {
        readonly kind: "launch";
        readonly executable: string;
        readonly argv: readonly string[];
        readonly cwd: string;
      }
    | { readonly kind: "terminate"; readonly signal: "SIGTERM" | "SIGKILL" },
): ExecutionProcessParentFrameV1 {
  return Object.freeze({
    revision: "execution-process-anchor-frame-v1",
    direction: "parent-to-anchor",
    nonce,
    sequence,
    ...fields,
  }) as ExecutionProcessParentFrameV1;
}

function anchorFrame(
  nonce: string,
  sequence: number,
  fields: AnchorFrameFields,
): ExecutionProcessAnchorFrameV1 {
  return Object.freeze({
    revision: "execution-process-anchor-frame-v1",
    direction: "anchor-to-parent",
    nonce,
    sequence,
    ...fields,
  }) as ExecutionProcessAnchorFrameV1;
}

type AnchorFrameFields = ExecutionProcessAnchorFrameV1 extends infer Frame
  ? Frame extends ExecutionProcessAnchorFrameV1
    ? Omit<Frame, "revision" | "direction" | "nonce" | "sequence">
    : never
  : never;

async function sendParentFrame(
  control: ExecutionProcessControlTransportV1,
  codec: ReturnType<typeof parentFrameCodecV1>,
  frame: ExecutionProcessParentFrameV1,
  cancellation: ExecutionCancellationV1,
): Promise<void> {
  const sent = await control.sendFrame(codec.encode(frame), cancellation);
  if (!sent.ok) throw new TypeError(sent.issues[0].message);
}

async function sendAnchorFrame(
  transport: ExecutionProcessAnchorTransportV1,
  codec: ReturnType<typeof anchorFrameCodecV1>,
  frame: ExecutionProcessAnchorFrameV1,
  cancellation: ExecutionCancellationV1,
): Promise<void> {
  const sent = await transport.sendFrame(codec.encode(frame), cancellation);
  if (!sent.ok) throw new TypeError(sent.issues[0].message);
}

async function receiveBeforeAnchorExit(
  anchor: ExecutionSpawnedAnchorV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionControlReadV1> {
  return Promise.race([
    anchor.control.receiveFrame(cancellation),
    anchor.completion.then((exit) => {
      throw new TypeError(
        exit.kind === "crash" ? exit.message : "Anchor exited before control completion.",
      );
    }),
  ]);
}

function anchorEntryPath(): string {
  return fileURLToPath(
    new URL(
      import.meta.url.endsWith(".ts")
        ? "../dist/execution-process-anchor-entry.js"
        : "./execution-process-anchor-entry.js",
      import.meta.url,
    ),
  );
}

/**
 * Creates an argv-only process runtime whose parent delegates all group signaling to an anchor.
 *
 * @example
 * ```ts
 * const runtime = createExecutionProcessRuntimeV1();
 * ```
 */
export function createExecutionProcessRuntimeV1(
  host: ExecutionProcessParentHostV1 = defaultExecutionProcessParentHostV1,
): ExecutionProcessRuntimeV1 {
  const runtime: ExecutionProcessRuntimeV1 = {
    async start(
      request: ExecutionProcessRequestV1,
      sink: ExecutionProcessSinkV1,
      cancellation: ExecutionCancellationV1,
    ): Promise<ExecutionOperationResultV1<ExecutionProcessHandleV1>> {
      if (
        !validRequest(request) ||
        cancellation.signal.aborted ||
        !(sink && typeof sink.onStdout === "function" && typeof sink.onStderr === "function")
      ) {
        return issue("Process request or cancellation state is invalid.");
      }
      let spawned: ExecutionSpawnedAnchorV1 | undefined;
      try {
        const nonceBytes = host.randomBytes(EXECUTION_PROCESS_KERNEL_LIMITS_V1.nonceBytes);
        if (!(nonceBytes instanceof Uint8Array) || nonceBytes.byteLength !== 32) {
          throw new TypeError("Process nonce source returned invalid bytes.");
        }
        const nonce = Buffer.from(nonceBytes).toString("hex");
        const launched = await host.spawnAnchor(
          {
            revision: "execution-anchor-spawn-v1",
            executable: process.execPath,
            argv: [anchorEntryPath()],
            cwd: request.cwd,
            environment: EXECUTION_PROCESS_ENVIRONMENT_V1,
            detached: true,
            shell: false,
            stdio: "ignore-output-control-pipes",
          },
          sink,
          cancellation,
        );
        if (!launched.ok) return launched;
        spawned = launched.value;
        if (!validAnchor(spawned.identity))
          throw new TypeError("Spawned anchor identity is invalid.");

        const outgoing = parentFrameCodecV1();
        const incoming = anchorFrameCodecV1();
        let parentSequence = 0;
        let anchorSequence = 0;
        await sendParentFrame(
          spawned.control,
          outgoing,
          parentFrame(nonce, parentSequence++, { kind: "bootstrap" }),
          cancellation,
        );
        const ready = incoming.decode(await receiveBeforeAnchorExit(spawned, cancellation));
        if (ready.nonce !== nonce || ready.sequence !== anchorSequence++) {
          throw new TypeError("Anchor readiness proof is invalid.");
        }
        if (ready.kind === "failure") throw new TypeError(`${ready.code}: ${ready.message}`);
        if (ready.kind !== "anchor-ready")
          throw new TypeError("Anchor readiness proof is invalid.");
        const readyIdentity = wireIdentityToHost(ready.identity);
        if (readyIdentity === undefined || !sameIdentity(readyIdentity, spawned.identity)) {
          throw new TypeError("Anchor readiness identity does not match its spawn identity.");
        }
        await sendParentFrame(
          spawned.control,
          outgoing,
          parentFrame(nonce, parentSequence++, {
            kind: "launch",
            executable: request.executable,
            argv: request.argv,
            cwd: request.cwd,
          }),
          cancellation,
        );
        const started = incoming.decode(await receiveBeforeAnchorExit(spawned, cancellation));
        if (started.nonce !== nonce || started.sequence !== anchorSequence++) {
          throw new TypeError("Target start proof is invalid.");
        }
        if (started.kind === "failure") throw new TypeError(`${started.code}: ${started.message}`);
        if (started.kind !== "target-started")
          throw new TypeError("Target start proof is invalid.");
        const targetIdentity = wireIdentityToHost(started.identity);
        if (targetIdentity === undefined || !validTarget(spawned.identity, targetIdentity)) {
          throw new TypeError("Target identity does not belong to the anchor group.");
        }

        const completion = deferred<ExecutionProcessExitV1>();
        let provisionalExit: ExecutionProcessExitV1 | undefined;
        let completionSettled = false;
        let pendingAcknowledgement:
          | { readonly kind: "term-applied" | "kill-armed"; readonly deferred: Deferred<void> }
          | undefined;
        let sendChain = Promise.resolve();
        let controlClosed = false;
        const failClosed = async (error: unknown): Promise<void> => {
          if (completionSettled) return;
          completionSettled = true;
          pendingAcknowledgement?.deferred.reject(new TypeError(message(error)));
          pendingAcknowledgement = undefined;
          try {
            await host.observeGroup(
              {
                revision: "execution-group-membership-query-v1",
                anchor: spawned!.identity,
                scope: "including-anchor",
              },
              cancellation,
            );
          } catch {
            // Loss of inspection is itself a blocker; the rejected completion retains ownership.
          }
          completion.reject(new TypeError(message(error)));
        };
        void (async () => {
          try {
            for (;;) {
              const frame = incoming.decode(await receiveBeforeAnchorExit(spawned!, cancellation));
              if (frame.nonce !== nonce || frame.sequence !== anchorSequence++) {
                throw new TypeError("Anchor control sequence or nonce is invalid.");
              }
              if (frame.kind === "target-exit") {
                if (provisionalExit !== undefined)
                  throw new TypeError("Duplicate target exit proof.");
                provisionalExit = Object.freeze({
                  exitCode: frame.exitCode,
                  signal: frame.signal,
                });
              } else if (frame.kind === "group-empty") {
                if (provisionalExit === undefined) {
                  throw new TypeError("Group absence arrived before target exit proof.");
                }
                completionSettled = true;
                completion.resolve(provisionalExit);
                return;
              } else if (frame.kind === "term-applied" || frame.kind === "kill-armed") {
                if (pendingAcknowledgement?.kind !== frame.kind) {
                  throw new TypeError("Unexpected termination acknowledgement.");
                }
                pendingAcknowledgement.deferred.resolve(undefined);
                pendingAcknowledgement = undefined;
              } else if (frame.kind === "failure") {
                throw new TypeError(`${frame.code}: ${frame.message}`);
              } else {
                throw new TypeError("Unexpected anchor control frame.");
              }
            }
          } catch (error) {
            await failClosed(error);
          }
        })();

        const childIdentity: ExecutionChildIdentityV1 = Object.freeze({
          bootId: targetIdentity.bootId,
          pid: targetIdentity.pid,
          startTicks: targetIdentity.startTicks,
          processGroupId: spawned.identity.processGroupId,
        });
        const handle: ExecutionProcessHandleV1 = Object.freeze({
          identity: childIdentity,
          completion: completion.promise,
          async revalidateIdentity() {
            if (completionSettled && provisionalExit !== undefined) return "absent" as const;
            const membership = await host.observeGroup(
              {
                revision: "execution-group-membership-query-v1",
                anchor: spawned!.identity,
                scope: "including-anchor",
              },
              cancellation,
            );
            if (membership.kind === "absent") return "absent" as const;
            if (
              membership.kind === "present" &&
              sameIdentity(membership.witness, spawned!.identity)
            ) {
              return "present" as const;
            }
            return "unknown" as const;
          },
          async terminate(signal: NodeJS.Signals) {
            if (signal !== "SIGTERM" && signal !== "SIGKILL") {
              throw new TypeError("Unsupported process-group signal.");
            }
            const expected = signal === "SIGTERM" ? "term-applied" : "kill-armed";
            const acknowledgement = deferred<void>();
            sendChain = sendChain.then(async () => {
              if (completionSettled || pendingAcknowledgement !== undefined) {
                throw new TypeError("Process control is no longer available.");
              }
              pendingAcknowledgement = { kind: expected, deferred: acknowledgement };
              await sendParentFrame(
                spawned!.control,
                outgoing,
                parentFrame(nonce, parentSequence++, { kind: "terminate", signal }),
                cancellation,
              );
              await acknowledgement.promise;
            });
            return sendChain;
          },
          async waitForGroupExit(deadlineMonotonicMs: number) {
            if (completionSettled && provisionalExit !== undefined) return true;
            let timeout: NodeJS.Timeout | undefined;
            try {
              return await Promise.race([
                completion.promise.then(
                  () => true,
                  () => false,
                ),
                new Promise<false>((resolve) => {
                  timeout = setTimeout(
                    () => resolve(false),
                    Math.max(0, deadlineMonotonicMs - performance.now()),
                  );
                  timeout.unref();
                }),
              ]);
            } finally {
              if (timeout !== undefined) clearTimeout(timeout);
            }
          },
        });
        const closeControl = async (): Promise<void> => {
          if (controlClosed) return;
          controlClosed = true;
          await spawned?.control.close(cancellation).catch(() => undefined);
        };
        void completion.promise.then(closeControl, closeControl);
        return success(handle);
      } catch (error) {
        if (spawned !== undefined) {
          await spawned.control.close(cancellation).catch(() => undefined);
        }
        return issue(message(error));
      }
    },
  };
  return Object.freeze(runtime);
}

async function sendAnchorFailure(
  transport: ExecutionProcessAnchorTransportV1,
  codec: ReturnType<typeof anchorFrameCodecV1>,
  nonce: string | undefined,
  sequence: number,
  code: "spawn" | "identity" | "membership" | "protocol" | "io",
  error: unknown,
  cancellation: ExecutionCancellationV1,
): Promise<void> {
  if (nonce === undefined) return;
  await sendAnchorFrame(
    transport,
    codec,
    anchorFrame(nonce, sequence, { kind: "failure", code, message: message(error) }),
    cancellation,
  ).catch(() => undefined);
}

/**
 * Runs the trusted anchor protocol over a raw transport and a self-group-only host authority.
 *
 * @example
 * ```ts
 * await runExecutionProcessAnchorV1(host, transport, cancellation);
 * ```
 */
export async function runExecutionProcessAnchorV1(
  host: ExecutionProcessAnchorHostV1,
  transport: ExecutionProcessAnchorTransportV1,
  cancellation: ExecutionCancellationV1,
): Promise<ExecutionOperationResultV1<void>> {
  const incoming = parentFrameCodecV1();
  const outgoing = anchorFrameCodecV1();
  let nonce: string | undefined;
  let parentSequence = 0;
  let anchorSequence = 0;
  let failureCode: "spawn" | "identity" | "membership" | "protocol" | "io" = "protocol";
  try {
    const bootstrap = incoming.decode(await transport.receiveFrame(cancellation));
    if (bootstrap.kind !== "bootstrap" || bootstrap.sequence !== parentSequence++) {
      throw new TypeError("Anchor bootstrap is invalid.");
    }
    nonce = bootstrap.nonce;
    const observed = await host.observeSelf(cancellation);
    if (!observed.ok) {
      failureCode = "identity";
      throw new TypeError(observed.issues[0].message);
    }
    const anchor = observed.value;
    if (!validAnchor(anchor)) {
      failureCode = "identity";
      throw new TypeError("Anchor self identity is invalid.");
    }
    await sendAnchorFrame(
      transport,
      outgoing,
      anchorFrame(nonce, anchorSequence++, {
        kind: "anchor-ready",
        identity: hostIdentityToWire(anchor),
      }),
      cancellation,
    );
    const launch = incoming.decode(await transport.receiveFrame(cancellation));
    if (
      launch.kind !== "launch" ||
      launch.nonce !== nonce ||
      launch.sequence !== parentSequence++
    ) {
      throw new TypeError("Anchor launch frame is invalid.");
    }
    failureCode = "spawn";
    const spawned = await host.spawnTarget(
      {
        revision: "execution-target-spawn-v1",
        executable: launch.executable,
        argv: launch.argv,
        cwd: launch.cwd,
        environment: EXECUTION_PROCESS_ENVIRONMENT_V1,
        detached: false,
        shell: false,
        stdio: "ignore-output-pipes",
      },
      transport,
      cancellation,
    );
    if (!spawned.ok) throw new TypeError(spawned.issues[0].message);
    const target = spawned.value;
    if (!validTarget(anchor, target.identity)) {
      failureCode = "identity";
      throw new TypeError("Target identity does not belong to the anchor group.");
    }
    await sendAnchorFrame(
      transport,
      outgoing,
      anchorFrame(nonce, anchorSequence++, {
        kind: "target-started",
        identity: hostIdentityToWire(target.identity),
      }),
      cancellation,
    );

    const targetCompletion = target.completion;
    let controlRead = transport.receiveFrame(cancellation);
    for (;;) {
      const raced = await Promise.race([
        targetCompletion.then((exit) => ({ kind: "target" as const, exit })),
        controlRead.then((read) => ({ kind: "control" as const, read })),
      ]);
      if (raced.kind === "target") {
        if (raced.exit.kind === "crash") {
          failureCode = raced.exit.code;
          throw new TypeError(raced.exit.message);
        }
        const observedExit = targetExit(raced.exit);
        if (observedExit === undefined) throw new TypeError("Target exit is invalid.");
        failureCode = "membership";
        let membershipPromise = host.observeGroup(
          {
            revision: "execution-group-membership-query-v1",
            anchor,
            scope: "excluding-anchor",
          },
          cancellation,
        );
        await sendAnchorFrame(
          transport,
          outgoing,
          anchorFrame(nonce, anchorSequence++, {
            kind: "target-exit",
            exitCode: observedExit.exitCode,
            signal: observedExit.signal,
          }),
          cancellation,
        );
        for (;;) {
          const membership = await membershipPromise;
          if (membership.kind === "absent") {
            await sendAnchorFrame(
              transport,
              outgoing,
              anchorFrame(nonce, anchorSequence++, { kind: "group-empty" }),
              cancellation,
            );
            await transport.close(cancellation);
            return success(undefined);
          }
          if (membership.kind !== "present") {
            throw new TypeError("Anchor could not prove descendant ownership.");
          }
          await new Promise<void>((resolve, reject) => {
            const finish = (): void => {
              cancellation.signal.removeEventListener("abort", onAbort);
              resolve();
            };
            const timeout = setTimeout(finish, 0);
            const onAbort = (): void => {
              clearTimeout(timeout);
              cancellation.signal.removeEventListener("abort", onAbort);
              reject(new TypeError("Descendant observation was cancelled."));
            };
            if (cancellation.signal.aborted) onAbort();
            else cancellation.signal.addEventListener("abort", onAbort, { once: true });
          });
          membershipPromise = host.observeGroup(
            {
              revision: "execution-group-membership-query-v1",
              anchor,
              scope: "excluding-anchor",
            },
            cancellation,
          );
        }
      } else {
        const frame = incoming.decode(raced.read);
        controlRead = transport.receiveFrame(cancellation);
        if (
          frame.kind !== "terminate" ||
          frame.nonce !== nonce ||
          frame.sequence !== parentSequence++
        ) {
          throw new TypeError("Anchor received an unexpected control frame.");
        }
        const signal: ExecutionSelfGroupSignalV1 = Object.freeze({
          revision: "execution-self-group-signal-v1",
          target: "self-process-group",
          signal: frame.signal,
        });
        if (frame.signal === "SIGKILL") {
          await sendAnchorFrame(
            transport,
            outgoing,
            anchorFrame(nonce, anchorSequence++, { kind: "kill-armed" }),
            cancellation,
          );
        }
        const applied = await host.signalSelfProcessGroup(signal);
        if (!applied.ok) {
          failureCode = "io";
          throw new TypeError(applied.issues[0].message);
        }
        if (frame.signal === "SIGTERM") {
          await sendAnchorFrame(
            transport,
            outgoing,
            anchorFrame(nonce, anchorSequence++, { kind: "term-applied" }),
            cancellation,
          );
        }
      }
    }
  } catch (error) {
    await sendAnchorFailure(
      transport,
      outgoing,
      nonce,
      anchorSequence,
      failureCode,
      error,
      cancellation,
    );
    await transport.close(cancellation).catch(() => undefined);
    return issue(message(error));
  }
}
