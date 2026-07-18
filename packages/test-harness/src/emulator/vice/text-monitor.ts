/**
 * `TextMonitorClient` — a persistent loopback socket to VICE's remote TEXT
 * monitor, which coexists with the binary monitor on its own port and is the
 * only interface exposing the machine-cycle stopwatch.
 *
 * Protocol invariants (each validated live against VICE 3.10):
 *
 * - The receive buffer is DRAINED before every send: the monitor emits break
 *   banners on its own whenever the machine stops, and stale output must
 *   never be parsed as a reply.
 * - A reply is complete when it ends in the monitor prompt `(C:$xxxx) `.
 * - The stopwatch value is accepted ONLY from an anchored `Stopwatch:` line
 *   in the post-send segment — a checkpoint break banner's register line ends
 *   in a raw, unlabeled stopwatch number, so a trailing-digits parse would
 *   silently read the wrong value.
 * - Any parse mismatch throws carrying the raw reply, never a guess.
 * - Text I/O is permitted only while the machine is stopped (a text command
 *   to a RUNNING machine halts it and emits spurious events on the binary
 *   socket); callers uphold this by exchanging only at checkpoint stops.
 *
 * Security: binds to 127.0.0.1 only; Node built-ins only.
 */

import net from "node:net";

/** The monitor prompt that terminates every reply, e.g. `(C:$e5cf) `. */
const PROMPT_RE = /\(C:\$[0-9a-f]{4}\) $/;
/** The one acceptable stopwatch line — anchored, never trailing digits. */
const STOPWATCH_RE = /^Stopwatch:\s+(\d+)\r?$/m;
/** Bounded connect-retry window while VICE binds the remote-monitor socket. */
const CONNECT_MAX_ATTEMPTS = 40;
const CONNECT_RETRY_MS = 250;

/**
 * Extract the stopwatch count from one monitor reply.
 *
 * Only an anchored `Stopwatch:` line is accepted; anything else — including
 * a break banner whose register line ends in a raw cycle number — throws an
 * error carrying the raw reply for diagnosis.
 *
 * @param reply The full post-send reply text (through the prompt).
 * @returns The absolute stopwatch count.
 * @throws {Error} When no anchored stopwatch line is present.
 */
export function parseStopwatchReply(reply: string): number {
  const match = STOPWATCH_RE.exec(reply);
  if (match === null) {
    throw new Error(`no stopwatch line in the monitor reply: ${JSON.stringify(reply)}`);
  }
  return Number(match[1]);
}

/** A pending reply waiter (one exchange at a time — exchanges are serialized). */
interface ReplyWaiter {
  resolve: (reply: string) => void;
  reject: (err: Error) => void;
}

/**
 * The remote text-monitor transport: `connect(port)`, `readStopwatch()`,
 * `close()`. One in-flight exchange at a time.
 */
export class TextMonitorClient {
  private socket: net.Socket | undefined;
  private received = "";
  private waiter: ReplyWaiter | undefined;

  /**
   * Connect to the remote monitor on `127.0.0.1:port`, retrying while VICE
   * binds the socket.
   *
   * @throws {Error} When the port never accepts within the retry window.
   */
  async connect(port: number): Promise<void> {
    this.socket = await new Promise<net.Socket>((resolve, reject) => {
      let attempts = 0;
      const attempt = (): void => {
        const socket = net.connect(port, "127.0.0.1");
        socket.once("connect", () => resolve(socket));
        socket.once("error", () => {
          socket.destroy();
          attempts += 1;
          if (attempts >= CONNECT_MAX_ATTEMPTS) {
            reject(new Error(`could not connect to the VICE remote monitor on 127.0.0.1:${port}`));
          } else {
            setTimeout(attempt, CONNECT_RETRY_MS);
          }
        });
      };
      attempt();
    });
    // latin1 keeps every byte 1:1 — monitor output is ASCII with 8-bit noise.
    this.socket.on("data", (chunk: Buffer) => {
      this.received += chunk.toString("latin1");
      this.checkWaiter();
    });
    this.socket.on("close", () => this.failWaiter(new Error("text monitor socket closed")));
    this.socket.on("error", () => {
      /* the close handler performs the rejection */
    });
  }

  /**
   * Read the absolute stopwatch count (machine cycles since power-on).
   *
   * Drains stale output, sends `stopwatch`, reads through the prompt, and
   * parses the anchored reply. Call only while the machine is stopped.
   *
   * @returns The absolute machine-cycle count.
   * @throws {Error} On a dead socket, a concurrent exchange, or an
   *   unparseable reply (the raw bytes are included).
   */
  async readStopwatch(): Promise<number> {
    const socket = this.socket;
    if (socket === undefined) {
      throw new Error("TextMonitorClient is not connected");
    }
    if (this.waiter !== undefined) {
      throw new Error("TextMonitorClient: an exchange is already in flight");
    }
    // Drain before send: drop stop banners and any other unsolicited output.
    this.received = "";
    const reply = await new Promise<string>((resolve, reject) => {
      this.waiter = { resolve, reject };
      socket.write("stopwatch\n");
      this.checkWaiter();
    });
    return parseStopwatchReply(reply);
  }

  /** Close the socket, rejecting any in-flight exchange. */
  close(): void {
    this.failWaiter(new Error("TextMonitorClient closed"));
    this.socket?.destroy();
    this.socket = undefined;
  }

  /** Resolve the pending waiter once the buffer ends in the monitor prompt. */
  private checkWaiter(): void {
    if (this.waiter !== undefined && PROMPT_RE.test(this.received)) {
      const waiter = this.waiter;
      this.waiter = undefined;
      waiter.resolve(this.received);
    }
  }

  /** Reject the pending waiter (socket close / client close). */
  private failWaiter(err: Error): void {
    if (this.waiter !== undefined) {
      const waiter = this.waiter;
      this.waiter = undefined;
      waiter.reject(err);
    }
  }
}
